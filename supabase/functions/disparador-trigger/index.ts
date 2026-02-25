import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS (inline) - evita dependência de ../_shared no deploy individual
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type TriggerRequest = {
  workspaceId: string;
  campaignId: string;
};

async function resolveSystemUserId(req: Request): Promise<{ systemUserId: string | null; systemUserEmail: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      systemUserId: req.headers.get("x-system-user-id"),
      systemUserEmail: req.headers.get("x-system-user-email"),
    };
  }

  const supabaseAuth = createClient( 
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) {
    return {
      systemUserId: req.headers.get("x-system-user-id"),
      systemUserEmail: req.headers.get("x-system-user-email"),
    };
  }

  const systemUserId = user.user_metadata?.system_user_id || user.user_metadata?.systemUserId || null;
  const systemUserEmail = user.user_metadata?.system_email || user.email || null;
  return { systemUserId, systemUserEmail };
}

async function assertWorkspaceMembership(supabase: any, workspaceId: string, systemUserId: string) {
  // Masters e support têm acesso a todos os workspaces
  const { data: userProfile } = await supabase
    .from("system_users")
    .select("profile")
    .eq("id", systemUserId)
    .maybeSingle();

  if (userProfile?.profile === "master" || userProfile?.profile === "support") {
    return; // bypass
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", systemUserId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("NOT_WORKSPACE_MEMBER");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<TriggerRequest>;
    const workspaceId = String(body.workspaceId || "");
    const campaignId = String(body.campaignId || "");

    if (!workspaceId || !campaignId) {
      return new Response(JSON.stringify({ success: false, error: "workspaceId e campaignId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { systemUserId } = await resolveSystemUserId(req);
    if (!systemUserId) {
      return new Response(JSON.stringify({ success: false, error: "AUTH_REQUIRED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await assertWorkspaceMembership(supabase, workspaceId, systemUserId);

    // Buscar campanha
    const { data: campaign, error: campaignErr } = await supabase
      .from("disparador_campaigns")
      .select("id, workspace_id, name, status, start_at, created_by, user_id")
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (campaignErr || !campaign) {
      return new Response(JSON.stringify({ success: false, error: "CAMPAIGN_NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar mensagens (variações)
    const { data: msgs } = await supabase
      .from("disparador_campaign_messages")
      .select("variation, content")
      .eq("campaign_id", campaignId);

    // Buscar contatos vinculados
    const { data: links } = await supabase
      .from("disparador_campaign_contacts")
      .select("contact_id")
      .eq("campaign_id", campaignId);

    const contactIds = (links || []).map((l: any) => l.contact_id).filter(Boolean);
    if (contactIds.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "CAMPAIGN_HAS_NO_CONTACTS" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: contacts } = await supabase
      .from("disparador_contacts_imported")
      .select("id, name, phone, tag, document_name")
      .eq("workspace_id", workspaceId)
      .in("id", contactIds);

    // Buscar conexões (instâncias) do workspace com seus secrets
    const { data: connectionsRaw } = await supabase
      .from("connections")
      .select(`
        id,
        instance_name,
        status,
        phone_number,
        metadata,
        provider_id,
        connection_secrets (
          token,
          evolution_url
        )
      `)
      .eq("workspace_id", workspaceId);

    const connections = (connectionsRaw || []).map((conn: any) => ({
      id: conn.id,
      instance_name: conn.instance_name,
      status: conn.status,
      phone_number: conn.phone_number,
      provider_id: conn.provider_id,
      metadata: conn.metadata,
      token: conn.connection_secrets?.token || null,
      evolution_url: conn.connection_secrets?.evolution_url || null,
    }));

    // 1) Tentar obter URL do env var
    let webhookUrl =
      Deno.env.get("DISPARADOR_N8N_WEBHOOK_URL") ||
      Deno.env.get("N8N_DISPARADOR_WEBHOOK_URL") ||
      "";

    // 2) Se não encontrar no env, buscar do banco de dados (tabela disparador_settings)
    if (!webhookUrl) {
      const { data: settingRow } = await supabase
        .from("disparador_settings")
        .select("value")
        .eq("key", "n8n_webhook_url")
        .maybeSingle();

      webhookUrl = (settingRow?.value || "").trim();
    }

    // 3) Se ainda não tiver URL, retornar erro com diagnóstico
    if (!webhookUrl) {
      const primaryRaw = Deno.env.get("DISPARADOR_N8N_WEBHOOK_URL");
      const fallbackRaw = Deno.env.get("N8N_DISPARADOR_WEBHOOK_URL");
      const primaryDefined = primaryRaw !== undefined;
      const fallbackDefined = fallbackRaw !== undefined;
      const primaryNonEmpty = (primaryRaw || "").trim().length > 0;
      const fallbackNonEmpty = (fallbackRaw || "").trim().length > 0;

      return new Response(JSON.stringify({
        success: false,
        error: "DISPARADOR_N8N_WEBHOOK_URL_NOT_CONFIGURED",
        env: {
          DISPARADOR_N8N_WEBHOOK_URL: { defined: primaryDefined, nonEmpty: primaryNonEmpty },
          N8N_DISPARADOR_WEBHOOK_URL: { defined: fallbackDefined, nonEmpty: fallbackNonEmpty },
        },
        db: { checked: true, found: false },
        hint: "Configure a URL do webhook: 1) Via secret DISPARADOR_N8N_WEBHOOK_URL, OU 2) Na tabela disparador_settings (key='n8n_webhook_url').",
      }), {
        status: 424,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secret = Deno.env.get("DISPARADOR_WEBHOOK_SECRET") || Deno.env.get("N8N_DISPARADOR_SECRET") || "";

    const nowIso = new Date().toISOString();

    // 1) Marcar campanha como "disparando" e atualizar start_at com a data/hora do disparo
    const { error: updateErr } = await supabase
      .from("disparador_campaigns")
      .update({ 
        status: "disparando", 
        start_at: nowIso,
        updated_at: nowIso 
      })
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId);

    if (updateErr) {
      console.error("[disparador-trigger] falha ao atualizar status da campanha:", updateErr);
    }

    // 2) Registrar estado "queued" por contato (upsert)
    const queuedRows = (contacts || []).map((c: any) => ({
      workspace_id: workspaceId,
      campaign_id: campaignId,
      contact_id: c.id,
      triggered_by: systemUserId,
      status: "queued",
      occurred_at: nowIso,
      error: null,
      external_id: null,
    }));

    // Para evitar duplicação, usamos o unique (campaign_id, contact_id)
    const { error: queuedErr } = await supabase
      .from("disparador_send_events")
      .upsert(queuedRows, { onConflict: "campaign_id,contact_id" });

    if (queuedErr) {
      console.error("[disparador-trigger] falha ao registrar queued:", queuedErr);
    }

    // 3) Enviar para n8n
    const payload = {
      event: "disparador.campaign.trigger",
      workspace_id: workspaceId,
      campaign_id: campaignId,
      triggered_by: systemUserId,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        start_at: nowIso, // Data/hora do disparo (atualizada)
        created_by: campaign.created_by,
        user_id: campaign.user_id,
      },
      messages: (msgs || [])
        .map((m: any) => ({ variation: Number(m.variation), content: String(m.content || "") }))
        .sort((a: any, b: any) => a.variation - b.variation),
      contacts: (contacts || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        tag: c.tag,
        document_name: c.document_name,
      })),
      connections: connections,
      date_time: nowIso,
    };

    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-secret": secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    const text = await n8nRes.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!n8nRes.ok) {
      return new Response(JSON.stringify({ success: false, error: "N8N_WEBHOOK_FAILED", details: parsed }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, response: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[disparador-trigger] erro:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "NOT_WORKSPACE_MEMBER" ? 403 : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

