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
  console.log("🔥 REFRESH Z-API QR CODE - BUILD 2025-11-05");
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

    // Buscar conexão
    const { data: connection, error: connError } = await supabase
      .from("connections")
      .select("id, instance_name, status, metadata, provider_id, workspace_id, connection_secrets(token)")
      .eq("id", connectionId)
      .maybeSingle();

    if (connError) {
      console.error("❌ Error fetching connection:", connError);
      return new Response(
        JSON.stringify({ success: false, error: "Conexão não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!connection) {
      console.error("❌ Connection not found for id:", connectionId);
      return new Response(
        JSON.stringify({ success: false, error: "Conexão não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Connection found: ${connection.instance_name}`);

    // Buscar provider associado
    let provider = null;
    if (connection.provider_id) {
      const { data: providerData, error: providerError } = await supabase
        .from("whatsapp_providers")
        .select("*")
        .eq("id", connection.provider_id)
        .maybeSingle();

      if (providerError) {
        console.error("❌ Error fetching provider:", providerError);
      } else {
        provider = providerData;
      }
    } else {
      // Fallback: tentar localizar provider ativo para esta conexão
      const { data: providers, error: providersError } = await supabase
        .from("whatsapp_providers")
        .select("*")
        .eq("workspace_id", connection.workspace_id)
        .eq("provider", "zapi")
        .order("updated_at", { ascending: false });

      if (providersError) {
        console.error("❌ Error fetching fallback providers:", providersError);
      } else if (providers && providers.length > 0) {
        provider = providers[0];
        console.log("ℹ️ Using fallback Z-API provider for workspace:", provider.id);
      }
    }

    // Verificar se é Z-API
    if (!provider || provider.provider !== "zapi") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Esta conexão não está configurada para usar Z-API",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapiUrl = provider.zapi_url;
    const zapiToken = provider.zapi_token;
    const zapiClientToken = provider.zapi_client_token;

    if (!zapiUrl || !zapiToken || !zapiClientToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuração Z-API incompleta (URL, token ou client_token ausente)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Z-API provider validated");

    // Verificar status atual da conexão
    if (connection.status === "connected") {
      console.log("⚠️ Connection already connected");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Conexão já está ativa. Desconecte primeiro para obter novo QR code.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          error: "Credenciais da instância Z-API não encontradas. Recrie a conexão.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 1: Reiniciar a instância (necessário para gerar novo QR code)
    console.log("🔄 Step 1: Restarting Z-API instance before generating QR code...");
    
    // ✅ CORREÇÃO: Usar apenas a base URL da Z-API (sem /instances/integrator/on-demand)
    // O zapiUrl pode vir com caminho completo, então vamos extrair apenas a base
    let baseUrl = zapiUrl;
    if (zapiUrl.includes('/instances/integrator')) {
      // Se contém o caminho do endpoint de criação, extrair apenas a base
      baseUrl = zapiUrl.split('/instances/integrator')[0];
    }
    baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    
    const restartUrl = `${baseUrl}/instances/${zapiInstanceId}/token/${zapiInstanceToken}/restart`;
    
    console.log("🔗 Base URL:", baseUrl);
    console.log("🔗 Restart URL:", restartUrl);

    const restartResponse = await fetch(restartUrl, {
      method: "GET",
      headers: {
        "Client-Token": zapiClientToken, // ✅ Token de CLIENTE para operar instância
      },
    });

    if (!restartResponse.ok) {
      const restartError = await restartResponse.text();
      console.error("❌ Failed to restart Z-API instance:", restartError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao reiniciar instância Z-API: ${restartError}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Instance restarted successfully");

    // Aguardar um momento para a instância reiniciar
    console.log("⏳ Waiting 2 seconds for instance to restart...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // PASSO 2: Buscar o QR code
    console.log("🔄 Step 2: Fetching new QR code...");
    const qrCodeUrl = `${baseUrl}/instances/${zapiInstanceId}/token/${zapiInstanceToken}/qr-code/image`;

    console.log("🔗 QR Code URL:", qrCodeUrl);
    console.log("📱 Z-API Instance ID:", zapiInstanceId);

    const zapiResponse = await fetch(qrCodeUrl, {
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

      // Se instância não existe, tentar recriar
      if (zapiResponse.status === 404) {
        console.log("🔄 Instance not found, attempting to recreate...");
        
        return new Response(
          JSON.stringify({
            success: false,
            error: "Instância não encontrada no Z-API. Recrie a conexão.",
            needsRecreation: true,
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

    // A resposta pode ser JSON ou texto puro (base64)
    const contentType = zapiResponse.headers.get("content-type");
    let zapiResult: any;
    let qrCode: string | null = null;

    console.log("✅ Z-API QR code response received, content-type:", contentType);

    try {
      // Tentar parsear como JSON primeiro
      zapiResult = await zapiResponse.json();
      
      // Extrair QR code de possíveis formatos de resposta
      qrCode = zapiResult.qrcode || zapiResult.value || zapiResult.code || zapiResult.base64;
      
      // Se a resposta inteira for uma string base64, usar ela
      if (!qrCode && typeof zapiResult === 'string' && zapiResult.startsWith('data:image')) {
        qrCode = zapiResult;
      }
      
      console.log("📋 Z-API response structure:", Object.keys(zapiResult));
    } catch (jsonError) {
      // Se não for JSON, pode ser texto puro (base64 direto)
      const textResponse = await zapiResponse.text();
      
      console.log("📄 Z-API returned text response, length:", textResponse.length);
      
      // Se começar com data:image, é um base64 válido
      if (textResponse.startsWith('data:image')) {
        qrCode = textResponse;
      } else if (textResponse.length > 50) {
        // Assumir que é base64 puro e adicionar prefixo
        qrCode = `data:image/png;base64,${textResponse}`;
      }
      
      zapiResult = { raw: textResponse };
    }

    if (!qrCode) {
      console.error("❌ No QR code in response:", zapiResult);
      
      // Verificar se já está conectado
      if (zapiResult?.connected || zapiResult?.status === "CONNECTED") {
        await supabase
          .from("connections")
          .update({
            status: "connected",
            qr_code: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connectionId);

        return new Response(
          JSON.stringify({
            success: true,
            alreadyConnected: true,
            message: "Instância já está conectada",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "QR code não disponível na resposta da Z-API",
          details: zapiResult,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar conexão com novo QR code
    // ✅ IMPORTANTE: Mesclar com metadata existente para preservar credenciais da instância
    const { error: updateError } = await supabase
      .from("connections")
      .update({
        status: "qr",
        qr_code: qrCode,
        updated_at: new Date().toISOString(),
        metadata: {
          ...connection.metadata, // Preservar credenciais existentes (id, token)
          ...zapiResult, // Adicionar resposta do QR code
          last_qr_refresh: new Date().toISOString(),
        },
      })
      .eq("id", connectionId);

    if (updateError) {
      console.error("❌ Error updating connection:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Erro ao atualizar conexão no banco de dados",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ QR code refreshed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        qrCode: qrCode,
        instanceName: connection.instance_name,
        message: "QR code atualizado com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error refreshing Z-API QR code:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
