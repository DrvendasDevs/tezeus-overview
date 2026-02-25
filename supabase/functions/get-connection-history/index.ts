import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { connectionId, workspaceId } = await req.json();

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: "connectionId obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[get-connection-history] Buscando histórico para connection: ${connectionId}, workspace: ${workspaceId}`);

    // Primeiro, buscar pelo connection_id ou instance_id
    let { data, error } = await supabase
      .from("status_connections")
      .select("*")
      .or(`connection_id.eq.${connectionId},instance_id.eq.${connectionId}`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[get-connection-history] Erro na primeira query:", error);
    }

    console.log(`[get-connection-history] Primeira query: ${data?.length || 0} registros`);

    // Se não encontrou nada e tem workspaceId, buscar pelo workspace
    if ((!data || data.length === 0) && workspaceId) {
      console.log(`[get-connection-history] Tentando buscar pelo workspace_id: ${workspaceId}`);
      
      const { data: wsData, error: wsError } = await supabase
        .from("status_connections")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (wsError) {
        console.error("[get-connection-history] Erro na query por workspace:", wsError);
      } else {
        data = wsData;
        console.log(`[get-connection-history] Query por workspace: ${data?.length || 0} registros`);
      }
    }

    console.log(`[get-connection-history] Total encontrados: ${data?.length || 0} registros`);

    return new Response(
      JSON.stringify({ success: true, history: data || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[get-connection-history] Exception:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
