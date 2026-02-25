import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS (inline) - evita dependência de ../_shared no deploy individual
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type WebhookEvent =
  | "disparador.send.sent"
  | "disparador.send.failed"
  | "disparador.response"
  | "disparador.campaign.completed";

type WebhookPayload = {
  event?: WebhookEvent | string;
  workspace_id?: string;
  campaign_id?: string;
  contact_id?: string;
  triggered_by?: string;
  external_id?: string;
  error?: string;
  kind?: "positive" | "negative" | "any";
  raw?: string;
};

function assertSecret(req: Request) {
  const expected = Deno.env.get("DISPARADOR_WEBHOOK_SECRET") || Deno.env.get("N8N_DISPARADOR_SECRET") || "";
  if (!expected) return;
  const received = req.headers.get("x-secret") || req.headers.get("x-disparador-secret") || "";
  if (!received || received !== expected) {
    throw new Error("INVALID_SECRET");
  }
}

function normalizeEvent(payload: WebhookPayload): WebhookEvent | null {
  const e = String(payload.event || "").trim();
  if (!e) return null;
  if (e === "disparador.send.sent" || e === "disparador.send.failed" || e === "disparador.response" || e === "disparador.campaign.completed") {
    return e as WebhookEvent;
  }
  // Compat: aceitar sinônimos comuns do n8n
  if (e === "send.sent" || e === "sent") return "disparador.send.sent";
  if (e === "send.failed" || e === "failed") return "disparador.send.failed";
  if (e === "response") return "disparador.response";
  if (e === "completed" || e === "campaign.completed") return "disparador.campaign.completed";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    assertSecret(req);
    const payload = (await req.json().catch(() => ({}))) as WebhookPayload;
    const event = normalizeEvent(payload);
    const workspaceId = String(payload.workspace_id || "");
    const campaignId = String(payload.campaign_id || "");
    const contactId = String(payload.contact_id || "");
    const triggeredBy = payload.triggered_by ? String(payload.triggered_by) : null;
    const nowIso = new Date().toISOString();

    if (!event || !workspaceId || !campaignId) {
      return new Response(JSON.stringify({ success: false, error: "INVALID_PAYLOAD", received: payload }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (event === "disparador.campaign.completed") {
      await supabase
        .from("disparador_campaigns")
        .update({ status: "concluida", updated_at: nowIso })
        .eq("id", campaignId)
        .eq("workspace_id", workspaceId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!contactId) {
      return new Response(JSON.stringify({ success: false, error: "contact_id é obrigatório para este evento" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "disparador.send.sent" || event === "disparador.send.failed") {
      const status = event === "disparador.send.sent" ? "sent" : "failed";
      const row = {
        workspace_id: workspaceId,
        campaign_id: campaignId,
        contact_id: contactId,
        triggered_by: triggeredBy,
        status,
        external_id: payload.external_id ? String(payload.external_id) : null,
        error: status === "failed" ? (payload.error ? String(payload.error) : "Falha não especificada") : null,
        occurred_at: nowIso,
      };

      const { error } = await supabase
        .from("disparador_send_events")
        .upsert(row, { onConflict: "campaign_id,contact_id" });

      if (error) {
        console.error("[disparador-webhook] erro upsert send:", error);
        return new Response(JSON.stringify({ success: false, error: "DB_ERROR", details: error }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "disparador.response") {
      const incomingKind = (payload.kind || "any") as "positive" | "negative" | "any";
      const safeKind = incomingKind === "positive" || incomingKind === "negative" ? incomingKind : "any";

      // Se já existe "positive/negative", não rebaixar para "any"
      const { data: existing } = await supabase
        .from("disparador_response_events")
        .select("kind")
        .eq("campaign_id", campaignId)
        .eq("contact_id", contactId)
        .maybeSingle();

      const existingKind = existing?.kind as ("any" | "positive" | "negative" | undefined);
      const nextKind = (existingKind === "positive" || existingKind === "negative")
        ? existingKind
        : safeKind;

      // Se a nova resposta vier como positiva/negativa, ela ganha do "any"
      const finalKind = safeKind === "positive" || safeKind === "negative" ? safeKind : nextKind;

      const row = {
        workspace_id: workspaceId,
        campaign_id: campaignId,
        contact_id: contactId,
        kind: finalKind,
        raw: payload.raw ? String(payload.raw) : null,
        occurred_at: nowIso,
      };

      const { error } = await supabase
        .from("disparador_response_events")
        .upsert(row, { onConflict: "campaign_id,contact_id" });

      if (error) {
        console.error("[disparador-webhook] erro upsert response:", error);
        return new Response(JSON.stringify({ success: false, error: "DB_ERROR", details: error }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "UNSUPPORTED_EVENT" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "INVALID_SECRET" ? 401 : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

