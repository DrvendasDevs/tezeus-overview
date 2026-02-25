import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  // Use the request origin when available (works better with some proxies)
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type FunnelPreset = {
  id: string;
  name: string;
  filters: Array<{ type: string; value: string; operator?: string }>;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userId = req.headers.get("x-system-user-id");
    const userEmail = req.headers.get("x-system-user-email");
    const workspaceIdHeader = req.headers.get("x-workspace-id");

    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspaceId || workspaceIdHeader;

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

    // Validate role + membership
    const [{ data: su, error: suError }, { data: wm, error: wmError }] = await Promise.all([
      supabase.from("system_users").select("id, profile").eq("id", userId).maybeSingle(),
      supabase
        .from("workspace_members")
        .select("user_id, workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (suError) throw suError;
    if (wmError) throw wmError;

    const profile = (su as any)?.profile || null;
    // Masters e support têm acesso a todos os workspaces (mesmo sem registro em workspace_members)
    const isMasterOrSupport = profile === "master" || profile === "support";
    const isMember = isMasterOrSupport || Boolean(wm);
    const canWrite = isMember && (profile === "master" || profile === "admin");

    // GET: return saved funnels
    if (req.method === "GET" || (!body || typeof body !== "object") || body.funnels === undefined) {
      if (!isMember) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("report_indicator_funnel_presets")
        .select("workspace_id, funnels")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (error) throw error;
      return new Response(JSON.stringify({ funnels: (data as any)?.funnels || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: save
    if (!canWrite) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const funnels = (body.funnels || []) as FunnelPreset[];
    const sanitized = Array.isArray(funnels)
      ? funnels.map((f, idx) => ({
          id: String((f as any)?.id || `funnel-${idx + 1}`),
          name: String((f as any)?.name || `Funil ${idx + 1}`),
          filters: Array.isArray((f as any)?.filters) ? (f as any).filters : [],
        }))
      : [];

    const { error: upsertError } = await supabase.from("report_indicator_funnel_presets").upsert(
      {
        workspace_id: workspaceId,
        funnels: sanitized,
        created_by_id: userId,
        updated_by_id: userId,
      },
      { onConflict: "workspace_id" }
    );

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true, funnels: sanitized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("❌ [report-indicator-funnel-presets] error:", e);
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


