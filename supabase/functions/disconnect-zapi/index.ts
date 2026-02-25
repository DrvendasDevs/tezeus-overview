import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  console.log("🔥 DISCONNECT Z-API - BUILD 2025-11-05");
  console.log("🔥 Method:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { connectionId } = await req.json();

    console.log("📋 Request params:", { connectionId });

    if (!connectionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "connectionId é obrigatório",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão com provider
    const { data: connection, error: connError } = await supabase
      .from("connections")
      .select("*, provider:whatsapp_providers(*)")
      .eq("id", connectionId)
      .maybeSingle();

    if (connError || !connection) {
      console.error("❌ Connection not found:", connError);
      return new Response(
        JSON.stringify({ success: false, error: "Conexão não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Connection found: ${connection.instance_name}`);

    // Verificar se é Z-API
    if (!connection.provider || connection.provider.provider !== "zapi") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Esta conexão não está configurada para usar Z-API",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapiUrl = connection.provider.zapi_url;
    const zapiClientToken = connection.provider.zapi_client_token;

    if (!zapiUrl || !zapiClientToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuração Z-API incompleta (URL ou token ausente)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Z-API provider validated");

    // Extrair ID e token da instância do metadata
    const zapiInstanceId = 
      connection.metadata?.id || 
      connection.metadata?.instanceId || 
      connection.metadata?.instance_id;
    
    const zapiInstanceToken =
      connection.metadata?.token ||
      connection.metadata?.instanceToken ||
      connection.metadata?.instance_token;

    if (!zapiInstanceId || !zapiInstanceToken) {
      console.error("❌ Missing Z-API instance credentials in metadata");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Credenciais da instância Z-API não encontradas no metadata",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chamar Z-API para fazer disconnect (endpoint correto)
    // ✅ CORREÇÃO: Usar apenas a base URL da Z-API (sem /instances/integrator/on-demand)
    let baseUrl = zapiUrl;
    if (zapiUrl.includes('/instances/integrator')) {
      baseUrl = zapiUrl.split('/instances/integrator')[0];
    }
    baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    
    const fullUrl = `${baseUrl}/instances/${zapiInstanceId}/token/${zapiInstanceToken}/disconnect`;

    console.log("🔗 Base URL:", baseUrl);
    console.log("🔗 Disconnect URL:", fullUrl);
    console.log("📱 Disconnecting instance...");

    const zapiResponse = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Client-Token": zapiClientToken, // ✅ Token de CLIENTE para operar instância
      },
    });

    if (!zapiResponse.ok) {
      let errorData;
      try {
        errorData = await zapiResponse.json();
      } catch {
        errorData = { message: await zapiResponse.text() };
      }

      console.error("❌ Z-API error:", {
        status: zapiResponse.status,
        error: errorData,
      });

      // Se for 404, a instância já não existe ou já está desconectada
      if (zapiResponse.status === 404) {
        console.log("⚠️ Instance not found or already disconnected");
        
        // Atualizar status no banco mesmo assim
        await supabase
          .from("connections")
          .update({
            status: "disconnected",
            qr_code: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connectionId);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Instância desconectada (já estava desconectada no Z-API)",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro Z-API (${zapiResponse.status}): ${errorData?.message || "Erro desconhecido"}`,
          details: errorData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapiResult = await zapiResponse.json();
    console.log("✅ Z-API logout response:", zapiResult);

    // Atualizar status no banco
    const { error: updateError } = await supabase
      .from("connections")
      .update({
        status: "disconnected",
        qr_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    if (updateError) {
      console.error("❌ Error updating connection:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Erro ao atualizar status no banco de dados",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Instance disconnected successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Instância Z-API desconectada com sucesso",
        instanceName: connection.instance_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error disconnecting Z-API instance:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
