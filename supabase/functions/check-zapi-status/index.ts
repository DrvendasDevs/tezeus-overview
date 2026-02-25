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
  console.log("🔥 CHECK Z-API STATUS - BUILD 2025-11-05");
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

    // Obter ID e token da instância Z-API do metadata
    const zapiInstanceId = connection.metadata?.id || connection.metadata?.instanceId || connection.metadata?.instance_id;
    const zapiInstanceToken =
      connection.metadata?.token ||
      connection.metadata?.instanceToken ||
      connection.metadata?.instance_token ||
      connection.metadata?.accessToken;
    
    if (!zapiInstanceId || !zapiInstanceToken) {
      console.error("❌ Missing Z-API instance credentials in metadata:", connection.metadata);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Credenciais da instância Z-API não encontradas no metadata",
          status: "credentials_missing",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chamar Z-API para obter status usando o formato correto
    // ✅ CORREÇÃO: Usar apenas a base URL da Z-API
    let baseUrl = zapiUrl;
    if (zapiUrl.includes('/instances/integrator')) {
      baseUrl = zapiUrl.split('/instances/integrator')[0];
    }
    baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    
    const fullUrl = `${baseUrl}/instances/${zapiInstanceId}/token/${zapiInstanceToken}/status`;

    console.log("🔗 Base URL:", baseUrl);
    console.log("🔗 Status URL:", fullUrl);
    console.log("📊 Fetching instance status...");

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

      // Se for 404, a instância não existe
      if (zapiResponse.status === 404) {
        console.log("⚠️ Instance not found in Z-API");
        
        return new Response(
          JSON.stringify({
            success: false,
            error: "Instância não encontrada no Z-API",
            status: "not_found",
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const zapiStatus = await zapiResponse.json();
    console.log("✅ Z-API status response:", zapiStatus);

    // Determinar se está conectado - cobrir diferentes formatos de resposta da Z-API
    const isConnected = 
      zapiStatus.connected === true || 
      zapiStatus.state === "CONNECTED" ||
      zapiStatus.status === "CONNECTED" ||
      (zapiStatus.session && zapiStatus.session.connected === true);

    // Extrair número de telefone de diferentes campos possíveis
    const phoneNumber = 
      zapiStatus.phone || 
      zapiStatus.wid || 
      zapiStatus.phoneNumber ||
      (zapiStatus.session && zapiStatus.session.phone) ||
      null;

    // Extrair informações principais do status
    const statusInfo = {
      connected: isConnected,
      phone: phoneNumber,
      battery: zapiStatus.battery || null,
      platform: zapiStatus.platform || null,
      pushname: zapiStatus.pushname || null,
      serverToken: zapiStatus.serverToken || null,
      wid: zapiStatus.wid || null,
      locale: zapiStatus.locale || null,
      version: zapiStatus.version || null,
      // Informações adicionais que a Z-API pode retornar
      raw: zapiStatus,
    };

    console.log(`🔍 Connection detection:`);
    console.log(`   - connected field: ${zapiStatus.connected}`);
    console.log(`   - state field: ${zapiStatus.state}`);
    console.log(`   - status field: ${zapiStatus.status}`);
    console.log(`   - session.connected: ${zapiStatus.session?.connected}`);
    console.log(`   - Final isConnected: ${isConnected}`);
    console.log(`   - Phone number: ${phoneNumber}`);

    // Atualizar status no banco de dados se necessário
    const newStatus = isConnected ? "connected" : "disconnected";
    if (connection.status !== newStatus || connection.phone_number !== phoneNumber) {
      console.log(`🔄 Updating connection status from '${connection.status}' to '${newStatus}'`);
      
      const { error: updateError } = await supabase
        .from("connections")
        .update({
          status: newStatus,
          phone_number: phoneNumber || connection.phone_number,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId);

      if (updateError) {
        console.error("⚠️ Error updating connection status:", updateError);
      } else {
        console.log("✅ Connection status updated in database");
      }
    }

    console.log("✅ Status check completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        status: statusInfo,
        instanceName: connection.instance_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error checking Z-API status:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
