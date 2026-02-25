import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userId = req.headers.get("x-system-user-id");
    const workspaceIdHeader = req.headers.get("x-workspace-id");
    const body = await req.json().catch(() => ({}));

    const workspaceId = body.workspaceId || workspaceIdHeader;
    const userRole = String(body?.userRole || "").toLowerCase();
    // support também precisa ter acesso privilegiado (mesmo sem membership explícito)
    const isPrivileged = userRole === "master" || userRole === "admin" || userRole === "support";
    const includeRelations = body?.includeRelations !== false; // default true
    const from = body?.from ?? null;
    const to = body?.to ?? null;
    const hasRange = !!(from && to);
    const cardIdsInput = Array.isArray(body?.cardIds) ? body.cardIds.filter(Boolean) : [];
    if (!userId) {
      return new Response(JSON.stringify({ error: "missing x-system-user-id" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Membership check (read allowed for any member)
    // Admin/Master podem acessar qualquer workspace
    if (!isPrivileged) {
      console.log(`🔍 [report-indicator-cards-lite] Verificando membership: userId=${userId}, workspaceId=${workspaceId}`);
      
      const { data: wm, error: wmError } = await supabase
        .from("workspace_members")
        .select("user_id, workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      console.log(`🔍 [report-indicator-cards-lite] Membership result:`, { wm, wmError });

      if (wmError) throw wmError;
      if (!wm) {
        console.error(`❌ [report-indicator-cards-lite] Usuário ${userId} não é membro do workspace ${workspaceId}`);
        return new Response(JSON.stringify({ error: "forbidden", details: `User ${userId} is not a member of workspace ${workspaceId}` }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.log(`✅ [report-indicator-cards-lite] Acesso privilegiado para role=${userRole}`);
    }

    // Get pipeline ids for workspace (used to scope cards, even when cardIds is provided)
    const { data: pipelines, error: pipelinesError } = await supabase
      .from("pipelines")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (pipelinesError) throw pipelinesError;
    const pipelineIds = (pipelines || []).map((p) => p.id);
    if (pipelineIds.length === 0) {
      return new Response(JSON.stringify({ cards: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cards (minimal fields) — optionally scoped by cardIds for 2-phase loading
    let cardsQuery = supabase
      .from("pipeline_cards")
      .select("id, pipeline_id, column_id, responsible_user_id, contact_id, status, qualification, created_at, updated_at")
      .in("pipeline_id", pipelineIds);
    if (cardIdsInput.length > 0) {
      cardsQuery = cardsQuery.in("id", cardIdsInput);
    }
    if (hasRange) {
      // Data "operacional": updated_at, mas também considerar created_at para compatibilidade
      // (ex.: cards antigos com updated_at não confiável / null em alguns ambientes).
      cardsQuery = cardsQuery.or(
        `and(updated_at.gte.${from},updated_at.lte.${to}),and(created_at.gte.${from},created_at.lte.${to})`
      );
    }

    const { data: cardsRaw, error: cardsError } = await cardsQuery;

    if (cardsError) throw cardsError;
    // Extra safe: ensure returned cards are within workspace pipeline ids
    const pipelineIdSet = new Set(pipelineIds);
    const cards = (cardsRaw || []).filter((c: any) => c?.pipeline_id && pipelineIdSet.has(c.pipeline_id));

    if (!includeRelations) {
      const outNoRelations = (cards || []).map((c: any) => ({
        id: c.id,
        pipeline_id: c.pipeline_id,
        column_id: c.column_id,
        responsible_user_id: c.responsible_user_id,
        contact_id: c.contact_id,
        status: c.status,
        qualification: c.qualification,
        created_at: c.created_at,
        updated_at: c.updated_at,
        product_ids: [],
        product_items: [],
        tag_ids: [],
      }));
      return new Response(JSON.stringify({ cards: outNoRelations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cardIds = (cards || []).map((c: any) => c.id).filter(Boolean);
    const contactIds = Array.from(new Set((cards || []).map((c: any) => c?.contact_id).filter(Boolean))) as string[];

    // Products mapping
    const [{ data: pcp, error: pcpError }, { data: ctags, error: ctagsError }] = await Promise.all([
      cardIds.length
        ? supabase
            .from("pipeline_cards_products")
            .select("pipeline_card_id, product_id, product_name_snapshot, quantity, unit_value, total_value")
            .in("pipeline_card_id", cardIds)
        : Promise.resolve({ data: [], error: null }),
      contactIds.length
        ? supabase.from("contact_tags").select("contact_id, tag_id").in("contact_id", contactIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (pcpError) throw pcpError;
    if (ctagsError) throw ctagsError;

    const productIdsByCard = new Map<string, string[]>();
    const productItemsByCard = new Map<
      string,
      Array<{
        product_id: string;
        product_name_snapshot: string | null;
        quantity: number | null;
        unit_value: number | null;
        total_value: number | null;
      }>
    >();
    (pcp || []).forEach((row: any) => {
      if (!row?.pipeline_card_id || !row?.product_id) return;
      const arr = productIdsByCard.get(row.pipeline_card_id) || [];
      arr.push(row.product_id);
      productIdsByCard.set(row.pipeline_card_id, arr);

      const items = productItemsByCard.get(row.pipeline_card_id) || [];
      items.push({
        product_id: row.product_id,
        product_name_snapshot: row.product_name_snapshot ?? null,
        quantity: row.quantity ?? null,
        unit_value: row.unit_value ?? null,
        total_value: row.total_value ?? null,
      });
      productItemsByCard.set(row.pipeline_card_id, items);
    });

    const tagsByContact = new Map<string, string[]>();
    (ctags || []).forEach((row: any) => {
      if (!row?.contact_id || !row?.tag_id) return;
      const arr = tagsByContact.get(row.contact_id) || [];
      arr.push(row.tag_id);
      tagsByContact.set(row.contact_id, arr);
    });

    const out = (cards || []).map((c: any) => ({
      id: c.id,
      pipeline_id: c.pipeline_id,
      column_id: c.column_id,
      responsible_user_id: c.responsible_user_id,
      contact_id: c.contact_id,
      status: c.status,
      qualification: c.qualification,
      created_at: c.created_at,
      updated_at: c.updated_at,
      product_ids: productIdsByCard.get(c.id) || [],
      product_items: productItemsByCard.get(c.id) || [],
      tag_ids: c.contact_id ? tagsByContact.get(c.contact_id) || [] : [],
    }));

    return new Response(JSON.stringify({ cards: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("❌ [report-indicator-cards-lite] error:", e);
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


