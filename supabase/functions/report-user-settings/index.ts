import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userId = req.headers.get("x-system-user-id");
    const workspaceIdHeader = req.headers.get("x-workspace-id");
    const body = await req.json().catch(() => ({}));

    const workspaceId = (body as any)?.workspaceId || workspaceIdHeader;
    const settings = (body as any)?.settings;

    if (!userId) return json({ error: "missing x-system-user-id" }, 401);
    if (!workspaceId) return json({ error: "workspaceId is required" }, 400);

    // membership check (masters/support bypass — podem acessar qualquer workspace)
    const { data: userProfile } = await supabase
      .from("system_users")
      .select("profile")
      .eq("id", userId)
      .maybeSingle();

    const isMasterOrSupport = userProfile?.profile === "master" || userProfile?.profile === "support";

    if (!isMasterOrSupport) {
      const { data: wm, error: wmError } = await supabase
        .from("workspace_members")
        .select("user_id, workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      if (wmError) throw wmError;
      if (!wm) return json({ error: "forbidden" }, 403);
    }

    // READ
    if (settings === undefined) {
      const { data, error } = await supabase
        .from("report_user_settings")
        .select("settings")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return json({ settings: (data as any)?.settings || null });
    }

    // WRITE (upsert)
    const { data: upserted, error: upsertError } = await supabase
      .from("report_user_settings")
      .upsert(
        {
          workspace_id: workspaceId,
          user_id: userId,
          settings: settings ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,user_id" },
      )
      .select("settings")
      .maybeSingle();

    if (upsertError) throw upsertError;
    return json({ success: true, settings: (upserted as any)?.settings ?? settings ?? {} });
  } catch (e) {
    console.error("❌ [report-user-settings] error:", e);
    return json({ error: (e as any)?.message || String(e) }, 500);
  }
});


