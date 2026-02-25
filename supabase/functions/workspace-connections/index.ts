import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
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

    // Verificar se o usuário é membro do workspace
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("user_id, workspace_id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      console.error("❌ [workspace-connections] Erro ao verificar membership:", membershipError);
      throw membershipError;
    }

    // Verificar se é master
    const { data: systemUser, error: suError } = await supabase
      .from("system_users")
      .select("id, profile")
      .eq("id", userId)
      .maybeSingle();

    if (suError) {
      console.error("❌ [workspace-connections] Erro ao buscar system_user:", suError);
    }

    const isMaster = systemUser?.profile === "master";
    const isMember = Boolean(membership);

    if (!isMember && !isMaster) {
      return new Response(JSON.stringify({ error: "forbidden", message: "Usuário não é membro do workspace" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar conexões do workspace (usando service role, bypassa RLS)
    const { data: connections, error: connError } = await supabase
      .from("connections")
      .select("id, instance_name, phone_number, status")
      .eq("workspace_id", workspaceId)
      .order("instance_name");

    if (connError) {
      console.error("❌ [workspace-connections] Erro ao buscar conexões:", connError);
      throw connError;
    }

    console.log(`✅ [workspace-connections] Retornando ${connections?.length || 0} conexões para workspace ${workspaceId}`);

    return new Response(JSON.stringify({ connections: connections || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("❌ [workspace-connections] error:", e);
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
