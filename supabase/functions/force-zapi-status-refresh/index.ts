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
  console.log("🔄 FORCE Z-API STATUS REFRESH");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { connectionId } = await req.json();

    console.log("📋 Connection ID:", connectionId);

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
    console.log("📦 Connection metadata (full):", JSON.stringify(connection.metadata, null, 2));
    console.log("📦 Connection provider:", connection.provider?.provider);

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

    // Obter ID e token da instância Z-API do metadata
    const zapiInstanceId = 
      connection.metadata?.id || 
      connection.metadata?.instanceId || 
      connection.metadata?.instance_id;
    
    const zapiInstanceToken =
      connection.metadata?.token ||
      connection.metadata?.instanceToken ||
      connection.metadata?.instance_token ||
      connection.metadata?.accessToken;
    
    const zapiClientToken = connection.provider.zapi_client_token;

    console.log("🔍 Z-API credentials in metadata:", {
      hasId: !!zapiInstanceId,
      hasToken: !!zapiInstanceToken,
      hasClientToken: !!zapiClientToken,
      idValue: zapiInstanceId,
      tokenPreview: zapiInstanceToken ? zapiInstanceToken.substring(0, 10) + "..." : "N/A",
      metadataKeys: Object.keys(connection.metadata || {}),
    });
    
    if (!zapiInstanceId || !zapiInstanceToken || !zapiClientToken) {
      console.error("❌ Missing Z-API instance credentials in metadata:", connection.metadata);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Credenciais da instância Z-API não encontradas. Recrie a conexão.",
          metadata: connection.metadata,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // URL correta da Z-API para obter status
    // ✅ IMPORTANTE: Token já está na URL, não precisa de Client-Token no header
    const statusUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiInstanceToken}/status`;

    console.log("🔗 Requesting status from:", statusUrl);

    const zapiResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Client-Token": zapiClientToken, // ✅ Token de CLIENTE para operar instância
      },
    });

    console.log("📊 Z-API Response status:", zapiResponse.status);

    if (!zapiResponse.ok) {
      let errorData;
      try {
        errorData = await zapiResponse.json();
      } catch {
        errorData = { message: await zapiResponse.text() };
      }

      console.error("❌ Z-API error:", errorData);

      // Se for 404, a instância não existe mais
      if (zapiResponse.status === 404) {
        await supabase
          .from("connections")
          .update({
            status: "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("id", connectionId);

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
    console.log("✅ Z-API status response:", JSON.stringify(zapiStatus, null, 2));

    // Determinar status da conexão
    // Z-API pode retornar diferentes formatos dependendo da versão
    const isConnected = 
      zapiStatus.connected === true || 
      zapiStatus.state === "CONNECTED" ||
      zapiStatus.status === "CONNECTED" ||
      (zapiStatus.session && zapiStatus.session.connected === true);
    
    const newStatus = isConnected ? "connected" : "disconnected";
    
    // Tentar extrair número de telefone de diferentes campos possíveis
    const phoneNumber = 
      zapiStatus.phone || 
      zapiStatus.wid || 
      zapiStatus.phoneNumber ||
      (zapiStatus.session && zapiStatus.session.phone) ||
      null;

    console.log(`🔄 Connection detection:`);
    console.log(`   - connected field: ${zapiStatus.connected}`);
    console.log(`   - state field: ${zapiStatus.state}`);
    console.log(`   - status field: ${zapiStatus.status}`);
    console.log(`   - session.connected: ${zapiStatus.session?.connected}`);
    console.log(`   - Final isConnected: ${isConnected}`);
    console.log(`   - New status: ${newStatus}`);
    console.log(`   - Phone number: ${phoneNumber}`);
    console.log(`   - Current DB status: ${connection.status}`);

    // NÃO atualizar o banco se:
    // - Status atual é "qr" (aguardando scan do usuário)
    // - E o novo status é "disconnected" (ainda não conectou)
    const shouldUpdate = !(
      connection.status === 'qr' && 
      newStatus === 'disconnected'
    );

    if (!shouldUpdate) {
      console.log("⏸️ Mantendo status 'qr' - aguardando usuário escanear QR Code");
      
      return new Response(
        JSON.stringify({
          success: true,
          status: {
            connected: isConnected,
            phone: phoneNumber,
            raw: zapiStatus,
          },
          instanceName: connection.instance_name,
          newStatus: connection.status, // Mantém o status atual (qr)
          maintained: true, // Flag indicando que status foi mantido
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔄 Updating connection status to: ${newStatus}`);

    // Atualizar status no banco de dados
    const { error: updateError } = await supabase
      .from("connections")
      .update({
        status: newStatus,
        phone_number: phoneNumber || connection.phone_number,
        last_activity_at: isConnected ? new Date().toISOString() : connection.last_activity_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    if (updateError) {
      console.error("⚠️ Error updating connection status:", updateError);
    } else {
      console.log("✅ Connection status updated successfully");
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: {
          connected: isConnected,
          phone: phoneNumber,
          raw: zapiStatus,
        },
        instanceName: connection.instance_name,
        newStatus: newStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in force refresh:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
