import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id",
  "Access-Control-Max-Age": "86400",
};

// Get active WhatsApp provider for workspace
async function getActiveProvider(workspaceId: string, supabase: any) {
  try {
    console.log("🔧 Getting active provider for workspace:", workspaceId);

    const { data: provider, error } = await supabase
      .from("whatsapp_providers")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    if (error || !provider) {
      console.error("❌ No active provider found:", error);
      throw new Error(
        "⚠️ Nenhum provedor WhatsApp ativo configurado. Configure um provedor (Evolution ou Z-API) antes de criar uma instância.",
      );
    }

    console.log("✅ Active provider found:", {
      provider: provider.provider,
      hasEvolutionUrl: !!provider.evolution_url,
      hasEvolutionToken: !!provider.evolution_token,
      hasZapiUrl: !!provider.zapi_url,
      hasZapiToken: !!provider.zapi_token,
    });

    return provider;
  } catch (error) {
    console.error("❌ Error getting active provider:", error);
    throw error;
  }
}

serve(async (req) => {
  console.log("🔥 EVOLUTION CREATE INSTANCE - BUILD 2025-11-05-20:50 UTC");
  console.log("🔥 EVOLUTION CREATE INSTANCE STARTED");
  console.log("🔥 Method:", req.method);
  console.log("🔥 URL:", req.url);
  console.log("🔥 Headers:", Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests first
  if (req.method === "OPTIONS") {
    console.log("⚡ CORS preflight request received");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Test endpoint
  if (req.url.includes("test")) {
    console.log("🧪 Test endpoint called");
    return new Response(
      JSON.stringify({ success: true, message: "Function is working", timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ✅ CRITICAL: Parse request body OUTSIDE of try-catch to avoid "Body already consumed" error
  let requestBody;
  try {
    const bodyText = await req.text();
    console.log("📋 Raw request body:", bodyText);
    requestBody = JSON.parse(bodyText);
  } catch (parseError) {
    console.error("❌ Failed to parse request body:", parseError);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Invalid JSON in request body",
        details: parseError instanceof Error ? parseError.message : String(parseError)
      }), 
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    console.log("🚀 Evolution Create Instance Function Started - Method:", req.method);
    console.log("📋 Parsed request body:", requestBody);
    const { 
      instanceName, 
      workspaceId, 
      autoCreateCrmCard, 
      defaultPipelineId,
      defaultColumnId,
      defaultColumnName,
      queueId,
      historyRecovery = 'none',
      phoneNumber,
      metadata,
      provider = 'evolution'  // 🆕 Provider escolhido pelo usuário
    } = requestBody;
    
    console.log(`🎯 Provider selecionado pelo usuário: ${provider}`);
    
    // Map historyRecovery to days
    const historyDaysMap: Record<string, number> = {
      none: 0,
      week: 7,
      month: 30,
      quarter: 90,
    };
    
    const historyDays = historyDaysMap[historyRecovery] || 0;
    
    console.log("📋 Request params:", {
      instanceName,
      workspaceId,
      autoCreateCrmCard,
      defaultPipelineId,
      defaultColumnId,
      defaultColumnName,
      historyRecovery,
      historyDays,
      phoneNumber: phoneNumber || 'not provided',
    });

    if (!instanceName || !workspaceId) {
      console.error("❌ Missing required fields:", { instanceName: !!instanceName, workspaceId: !!workspaceId });
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: instanceName and workspaceId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Initialize Supabase client
    console.log("🔧 Initializing Supabase client...");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Missing Supabase environment variables");
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("✅ Supabase client initialized");

    console.log("Supabase URL:", supabaseUrl ? "Present" : "Missing");
    console.log("Supabase Service Key:", supabaseServiceKey ? "Present" : "Missing");

    // 🆕 Buscar provider ESPECÍFICO escolhido pelo usuário (não apenas o ativo)
    console.log(`🔍 Buscando configuração do provider: ${provider} para workspace: ${workspaceId}`);
    
    let selectedProvider;
    try {
      const { data, error: providerError } = await supabase
        .from("whatsapp_providers")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("provider", provider)
        .maybeSingle();

      if (providerError) {
        console.error("❌ Database error fetching provider:", providerError);
        console.error("❌ Provider error details:", JSON.stringify(providerError, null, 2));
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro ao buscar provider: ${providerError.message || 'Erro desconhecido'}`,
            details: providerError.code || 'UNKNOWN'
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!data) {
        console.error("❌ Provider not found");
        console.error("❌ Workspace ID:", workspaceId);
        console.error("❌ Provider requested:", provider);
        
        const providerName = provider === 'evolution' ? 'Evolution API' : 'Z-API';
        let errorMessage = `Provider ${providerName} não está configurado para este workspace.`;
        
        // Verificar se existe algum provider configurado para este workspace (com tratamento de erro)
        try {
          const { data: anyProvider, error: anyProviderError } = await supabase
            .from("whatsapp_providers")
            .select("provider, is_active")
            .eq("workspace_id", workspaceId);
          
          if (!anyProviderError && anyProvider && anyProvider.length > 0) {
            console.log("📋 Providers existentes neste workspace:", anyProvider);
            const providersList = anyProvider.map(p => `${p.provider}${p.is_active ? ' (ativo)' : ' (inativo)'}`).join(', ');
            errorMessage += ` Providers encontrados: ${providersList}. Configure o ${providerName} em Configurações > Providers WhatsApp.`;
          } else {
            errorMessage += ` Nenhum provider configurado para este workspace. Configure em Configurações > Providers WhatsApp.`;
          }
        } catch (queryError) {
          console.error("❌ Erro ao verificar providers existentes:", queryError);
          // Continuar com mensagem de erro básica se a query falhar
          errorMessage += ` Configure em Configurações > Providers WhatsApp.`;
        }
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: errorMessage
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      selectedProvider = data;
    } catch (providerException) {
      console.error("❌ Exception fetching provider:", providerException);
      console.error("❌ Exception details:", JSON.stringify(providerException, Object.getOwnPropertyNames(providerException)));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Exceção ao buscar provider",
          details: providerException instanceof Error ? providerException.message : String(providerException)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Verificar se o provider está ativo
    if (!selectedProvider.is_active) {
      console.error("❌ Provider encontrado mas está inativo");
      const providerName = provider === 'evolution' ? 'Evolution API' : 'Z-API';
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Provider ${providerName} está configurado mas está inativo. Ative o provider em Configurações > Providers WhatsApp.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Provider ${provider} encontrado:`, {
      hasEvolutionUrl: !!selectedProvider.evolution_url,
      hasEvolutionToken: !!selectedProvider.evolution_token,
      hasZapiUrl: !!selectedProvider.zapi_url,
      hasZapiToken: !!selectedProvider.zapi_token,
    });
    
    // Validar token Z-API antes de continuar
    if (provider === 'zapi' && !selectedProvider.zapi_token) {
      console.error("❌ Z-API token is missing for provider!");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token do Z-API não está configurado. Configure o token em Configurações > Providers WhatsApp.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const activeProvider = selectedProvider; // Manter variável activeProvider para compatibilidade com código existente
    console.log("Active Provider:", activeProvider.provider);
    console.log("Creating instance for workspace:", workspaceId, "instance:", instanceName);

    // Check workspace connection limit
    const { data: limitData, error: limitError } = await supabase
      .from("workspace_limits")
      .select("connection_limit")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (limitError) {
      console.error("Error checking workspace limits:", limitError);
      return new Response(JSON.stringify({ success: false, error: "Error checking workspace limits" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionLimit = limitData?.connection_limit || 1;
    console.log("Workspace connection limit:", connectionLimit);

    // Check current connection count
    const { data: existingConnections, error: countError } = await supabase
      .from("connections")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (countError) {
      console.error("Error counting existing connections:", countError);
      return new Response(JSON.stringify({ success: false, error: "Error counting existing connections" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentConnectionCount = existingConnections?.length || 0;
    console.log("Current connection count:", currentConnectionCount, "Limit:", connectionLimit);

    // 1. Default Connection Logic: Check if there's already a default connection
    // If no default exists, this will be the default
    const { data: existingDefaultConnection } = await supabase
      .from("connections")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("is_default", true)
      .maybeSingle();
    
    const isDefault = !existingDefaultConnection;
    console.log(`🌟 Instance will be default? ${isDefault} (Current count: ${currentConnectionCount}, Existing default: ${!!existingDefaultConnection})`);

    if (currentConnectionCount >= connectionLimit) {
      console.error("Connection limit reached:", currentConnectionCount, ">=", connectionLimit);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Connection limit reached. Current: ${currentConnectionCount}, Limit: ${connectionLimit}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if instance name already exists for this workspace
    const { data: existingInstance } = await supabase
      .from("connections")
      .select("id, status, created_at")
      .eq("workspace_id", workspaceId)
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (existingInstance) {
      console.error("Instance name already exists:", {
        instanceName,
        existingId: existingInstance.id,
        existingStatus: existingInstance.status,
        createdAt: existingInstance.created_at
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Já existe uma conexão com o nome "${instanceName}" neste workspace. Por favor, escolha outro nome ou delete a conexão existente primeiro.`,
          existingConnection: {
            id: existingInstance.id,
            status: existingInstance.status,
            createdAt: existingInstance.created_at
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create connection record first
    // Ensure column values are properly saved - only set null if truly empty/undefined
    const connectionDataToInsert: any = {
      instance_name: instanceName,
      workspace_id: workspaceId,
      provider_id: activeProvider.id,  // ✅ NOVO: Vincular ao provider usado
      status: "creating",
      history_recovery: historyRecovery,
      history_days: historyDays,
      phone_number: phoneNumber || null,
      auto_create_crm_card: autoCreateCrmCard || false,
      queue_id: queueId || null,
      metadata: metadata || null,
      is_default: isDefault
    };

    // Handle pipeline and column fields - ensure they're saved when provided
    if (defaultPipelineId && typeof defaultPipelineId === 'string' && defaultPipelineId.trim() !== '') {
      connectionDataToInsert.default_pipeline_id = defaultPipelineId;
    } else {
      connectionDataToInsert.default_pipeline_id = null;
    }

    if (defaultColumnId && typeof defaultColumnId === 'string' && defaultColumnId.trim() !== '') {
      connectionDataToInsert.default_column_id = defaultColumnId;
    } else {
      connectionDataToInsert.default_column_id = null;
    }

    if (defaultColumnName && typeof defaultColumnName === 'string' && defaultColumnName.trim() !== '') {
      connectionDataToInsert.default_column_name = defaultColumnName;
    } else {
      connectionDataToInsert.default_column_name = null;
    }

    console.log("💾 Inserting connection data:", JSON.stringify(connectionDataToInsert, null, 2));

    let connectionData;
    try {
      const { data, error: insertError } = await supabase
        .from("connections")
        .insert(connectionDataToInsert)
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error creating connection record:", insertError);
        console.error("❌ Insert error details:", JSON.stringify(insertError, null, 2));
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Erro ao criar registro de conexão",
          details: insertError.message || String(insertError),
          code: insertError.code || 'UNKNOWN'
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      connectionData = data;
    } catch (insertException) {
      console.error("❌ Exception creating connection record:", insertException);
      console.error("❌ Exception details:", JSON.stringify(insertException, Object.getOwnPropertyNames(insertException)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Exceção ao criar registro de conexão",
        details: insertException instanceof Error ? insertException.message : String(insertException)
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Connection record created:", connectionData.id);

    // Generate unique token and store connection secrets
    const token = crypto.randomUUID();

    const providerUrl = activeProvider.provider === 'evolution' 
      ? activeProvider.evolution_url 
      : activeProvider.zapi_url;

    // Validate provider URL before proceeding
    if (!providerUrl) {
      console.error("❌ Provider URL is missing:", {
        provider: activeProvider.provider,
        hasEvolutionUrl: !!activeProvider.evolution_url,
        hasZapiUrl: !!activeProvider.zapi_url
      });
      
      // Clean up connection record
      await supabase.from("connections").delete().eq("id", connectionData.id);
      
      const providerName = activeProvider.provider === 'evolution' ? 'Evolution API' : 'Z-API';
      return new Response(JSON.stringify({ 
        success: false, 
        error: `URL do ${providerName} não está configurada. Configure a URL em Configurações > Providers WhatsApp.`
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("💾 Storing connection secrets:", {
      connection_id: connectionData.id,
      hasToken: !!token,
      providerUrl: providerUrl.substring(0, 50) + '...',
      provider: activeProvider.provider
    });

    try {
      const { error: secretError, data: secretData } = await supabase.from("connection_secrets").insert({
        connection_id: connectionData.id,
        token: token,
        evolution_url: providerUrl,
      }).select();

      if (secretError) {
        console.error("❌ Error storing connection secrets:", secretError);
        console.error("❌ Secret error details:", JSON.stringify(secretError, null, 2));
        // Clean up connection record
        await supabase.from("connections").delete().eq("id", connectionData.id);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Erro ao salvar segredos da conexão",
          details: secretError.message || String(secretError)
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log("✅ Connection secrets stored successfully:", secretData);
    } catch (secretException) {
      console.error("❌ Exception storing connection secrets:", secretException);
      console.error("❌ Exception details:", JSON.stringify(secretException, Object.getOwnPropertyNames(secretException)));
      // Clean up connection record
      await supabase.from("connections").delete().eq("id", connectionData.id);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Exceção ao salvar segredos da conexão",
        details: secretException instanceof Error ? secretException.message : String(secretException)
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Connection secrets stored");

    // ✅ VERIFICAR PROVIDER E CRIAR INSTÂNCIA
    if (activeProvider.provider === 'zapi') {
      console.log("📋 Z-API provider selected - creating instance via Z-API");
      
      // Preparar payload Z-API
      const webhookBaseUrl = `${supabaseUrl}/functions/v1`;
      const zapiPayload = {
        name: instanceName,
        sessionName: instanceName,
        deliveryCallbackUrl: `${webhookBaseUrl}/zapi-webhook`,
        receivedCallbackUrl: `${webhookBaseUrl}/zapi-webhook`,
        disconnectedCallbackUrl: `${webhookBaseUrl}/zapi-webhook`,
        connectedCallbackUrl: `${webhookBaseUrl}/zapi-webhook`,
        messageStatusCallbackUrl: `${webhookBaseUrl}/zapi-webhook-status`,
        chatPresenceCallbackUrl: `${webhookBaseUrl}/zapi-webhook`,
        isDevice: true,
        businessDevice: true
      };

      console.log('📤 Payload being sent to Z-API:', JSON.stringify(zapiPayload, null, 2));

      // ✅ CRITICAL FIX: Usar endpoint correto da Z-API para criação de instâncias
      // Documentação: https://developer.z-api.io/partner/create-instance
      const fullUrl = 'https://api.z-api.io/instances/integrator/on-demand';
      
      console.log("🔗 Z-API URL:", fullUrl);

      // Validar token antes de enviar
      if (!activeProvider.zapi_token) {
        console.error("❌ Z-API token is missing!");
        await supabase.from("connection_secrets").delete().eq("connection_id", connectionData.id);
        await supabase.from("connections").delete().eq("id", connectionData.id);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: "Token do Z-API não configurado. Configure o token em Automações > WhatsApp Providers",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Limpar token (remover espaços em branco)
      const cleanToken = activeProvider.zapi_token.trim();
      
      console.log("🔑 Z-API Token length:", cleanToken.length);
      console.log("🔑 Z-API Token preview:", cleanToken.substring(0, 10) + "..." + cleanToken.substring(cleanToken.length - 5));
      console.log("🔑 Z-API URL:", activeProvider.zapi_url);
      console.log("🔑 Full URL to call:", fullUrl);

      // 📋 LOG COMPLETO DA REQUISIÇÃO (para debug)
      console.log("\n📤 ===== REQUISIÇÃO Z-API COMPLETA =====");
      console.log(JSON.stringify({
        endpoint: `POST ${fullUrl}`,
        headers: {
          "Client-Token": `${cleanToken.substring(0, 15)}...${cleanToken.substring(cleanToken.length - 5)}`,
          "Content-Type": "application/json"
        },
        body: zapiPayload
      }, null, 2));
      console.log("======================================\n");

      // Chamar Z-API com timeout
      let zapiResponse;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        // ✅ Endpoint de criação /integrator/on-demand usa APENAS "Authorization: Bearer {token}"
        // (Token de Integrador/Parceiro - não precisa de Client-Token aqui)
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cleanToken}`,
        };
        
        console.log("📤 Request headers sendo enviados:", {
          "Content-Type": headers["Content-Type"],
          "Authorization": `Bearer ${cleanToken.substring(0, 20)}...`
        });

        zapiResponse = await fetch(fullUrl, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(zapiPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log("✅ Z-API response status:", zapiResponse.status);
      } catch (fetchError) {
        console.error("❌ Z-API request failed:", fetchError);
        await supabase.from("connection_secrets").delete().eq("connection_id", connectionData.id);
        await supabase.from("connections").delete().eq("id", connectionData.id);

        const errorMessage =
          (fetchError as any).name === "AbortError"
            ? "Request timeout - Z-API não respondeu em 30 segundos"
            : `Falha na conexão com Z-API: ${(fetchError as Error).message}`;

        return new Response(JSON.stringify({ success: false, error: errorMessage }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!zapiResponse.ok) {
        // ✅ CRITICAL FIX: Ler o corpo da resposta apenas UMA VEZ
        const responseText = await zapiResponse.text();
        let errorData;
        
        try {
          // Tentar parsear como JSON
          errorData = JSON.parse(responseText);
        } catch {
          // Se não for JSON válido, usar como texto
          errorData = { message: responseText };
        }

        console.error("❌ Z-API error response:", {
          status: zapiResponse.status,
          statusText: zapiResponse.statusText,
          error: errorData,
          headers: Object.fromEntries(zapiResponse.headers.entries()),
        });

        // Log detalhado para troubleshooting
        if (zapiResponse.status === 401) {
          console.error("🔐 ERRO 401 - Bad Credentials:");
          console.error("  - ATENÇÃO: Você precisa usar o TOKEN DE INTEGRATOR, não o token de uma instância!");
          console.error("  - Onde encontrar: Painel Z-API > Integrações > Criar Token de Integrator");
          console.error("  - Token usado (preview):", cleanToken.substring(0, 10) + "..." + cleanToken.substring(cleanToken.length - 5));
          console.error("  - URL chamada:", fullUrl);
          console.error("  - Detalhes do erro:", errorData);
        }

        await supabase.from("connection_secrets").delete().eq("connection_id", connectionData.id);
        await supabase.from("connections").delete().eq("id", connectionData.id);

        // Mensagem específica para erro 401
        let errorMessage = `Erro Z-API (${zapiResponse.status}): ${errorData?.message || errorData?.error || 'Erro desconhecido'}`;
        
        if (zapiResponse.status === 401) {
          errorMessage = '❌ Token Z-API inválido. Você precisa usar o TOKEN DE INTEGRATOR do painel Z-API (Integrações > Criar Token de Integrator), não o token de uma instância específica.';
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage,
            details: errorData,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const zapiData = await zapiResponse.json();
      console.log("📦 Z-API response data (full):", JSON.stringify(zapiData, null, 2));

      // Extrair ID e token da resposta da Z-API
      const zapiInstanceId = zapiData.id;
      const zapiInstanceToken = zapiData.token;

      console.log("🔍 Extracted Z-API credentials:", {
        id: zapiInstanceId,
        hasId: !!zapiInstanceId,
        token: zapiInstanceToken ? zapiInstanceToken.substring(0, 10) + "..." : "MISSING",
        hasToken: !!zapiInstanceToken,
        allKeys: Object.keys(zapiData)
      });

      // VALIDAÇÃO CRÍTICA: Verificar se Z-API retornou os dados necessários
      if (!zapiInstanceId || !zapiInstanceToken) {
        console.error("❌ Z-API não retornou id ou token!");
        console.error("Resposta completa da Z-API:", zapiData);
        
        await supabase.from("connection_secrets").delete().eq("connection_id", connectionData.id);
        await supabase.from("connections").delete().eq("id", connectionData.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Z-API não retornou as credenciais da instância (id e token). Resposta recebida: " + JSON.stringify(zapiData),
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("✅ Z-API instance created with valid credentials");

      // Atualizar conexão com dados do Z-API
      const metadata = {
        id: zapiInstanceId,
        token: zapiInstanceToken,
        instanceId: zapiInstanceId, // Alias para compatibilidade
        instanceToken: zapiInstanceToken, // Alias para compatibilidade
        created_at: new Date().toISOString(),
        raw_response: zapiData // Guardar resposta completa para referência
      };

      console.log("💾 Metadata to save:", JSON.stringify(metadata, null, 2));

      const updateData: any = {
        status: "disconnected", // Z-API começa desconectado até escanear QR
        metadata: metadata,
      };

      // Se Z-API retornou QR code
      if (zapiData.qrcode) {
        console.log("📱 QR code found in response");
        updateData.qr_code = zapiData.qrcode;
        updateData.status = "qr";
      }

      console.log("🔄 Updating connection with:", JSON.stringify(updateData, null, 2));

      const { error: updateError } = await supabase
        .from("connections")
        .update(updateData)
        .eq("id", connectionData.id);

      if (updateError) {
        console.error("❌ Error updating connection for Z-API:", updateError);
        
        await supabase.from("connection_secrets").delete().eq("connection_id", connectionData.id);
        await supabase.from("connections").delete().eq("id", connectionData.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Erro ao salvar dados da conexão: " + updateError.message,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("✅ Z-API instance created successfully");

      // ===== ASSINATURA DA INSTÂNCIA Z-API =====
      try {
        const baseUrl = fullUrl.replace('/instances/integrator/on-demand', '');
        const subscriptionUrl = `${baseUrl}/instances/${zapiInstanceId}/token/${zapiInstanceToken}/integrator/on-demand/subscription`;
        
        console.log("📤 [Z-API] Iniciando assinatura da instância");
        console.log("📤 [Z-API] URL de assinatura:", subscriptionUrl);
        console.log("📤 [Z-API] Instance ID:", zapiInstanceId);
        console.log("📤 [Z-API] Token preview:", zapiInstanceToken.substring(0, 10) + "...");
        
        const subscriptionResponse = await fetch(subscriptionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanToken}`, // Usa o mesmo token de integrator
            'Content-Type': 'application/json',
          },
        });
        
        const subscriptionData = await subscriptionResponse.text();
        
        if (subscriptionResponse.ok) {
          console.log("✅ [Z-API] Instância assinada com sucesso:", subscriptionData);
        } else {
          console.error("❌ [Z-API] Erro ao assinar instância (status:", subscriptionResponse.status, "):", subscriptionData);
        }
      } catch (subError: any) {
        console.error("❌ [Z-API] Exceção ao assinar instância:", subError.message);
      }
      // ===== FIM DA ASSINATURA =====

      return new Response(
        JSON.stringify({
          success: true,
          connection: {
            ...connectionData,
            ...updateData,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Using Evolution provider, proceeding with automatic instance creation");

    // Prepare Evolution API request
    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook-v2`;

    // Payload seguindo formato Evolution API v2 (camelCase)
    const evolutionPayload: any = {
      instanceName: instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      rejectCall: false,
      msgCall: "",
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
      webhook: {
        url: webhookUrl,
        byEvents: true,
        base64: true,
        events: [
          "QRCODE_UPDATED",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "CONNECTION_UPDATE"
        ]
      }
    };

    // Only add number if provided
    if (phoneNumber) {
      evolutionPayload.number = phoneNumber;
    }
    
    console.log('📤 Payload being sent to Evolution API:', JSON.stringify(evolutionPayload, null, 2));

    // Normalize URL to avoid double slashes
    const baseUrl = activeProvider.evolution_url!.endsWith("/") 
      ? activeProvider.evolution_url!.slice(0, -1) 
      : activeProvider.evolution_url!;
    const fullUrl = `${baseUrl}/instance/create`;

    console.log("🔗 URL:", fullUrl);
    console.log("🔑 Using apikey authentication (consistent with webhook)");

    // Call Evolution API with error handling and timeout
    let evolutionResponse;
    try {
      console.log("🔑 Making Evolution API request");
      console.log("🔗 URL:", fullUrl);

      // Create fetch with timeout to prevent 502 errors
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      evolutionResponse = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: activeProvider.evolution_token!,
        },
        body: JSON.stringify(evolutionPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log("✅ Evolution API response status:", evolutionResponse.status);
    } catch (fetchError) {
      console.error("❌ Evolution API request failed:", fetchError);
      await supabase.from("connections").delete().eq("id", connectionData.id);

      const errorMessage =
        (fetchError as any).name === "AbortError"
          ? "Request timeout - Evolution API não respondeu em 30 segundos"
          : `Falha na conexão com Evolution API: ${(fetchError as Error).message}`;

      return new Response(JSON.stringify({ success: false, error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!evolutionResponse.ok) {
      let errorData;
      try {
        errorData = await evolutionResponse.json();
      } catch {
        errorData = { message: await evolutionResponse.text() };
      }

      console.error("Evolution API error:", {
        status: evolutionResponse.status,
        error: errorData,
        payload: evolutionPayload,
      });

      // Parse error message for better user feedback
      let userFriendlyError = `Erro na Evolution API (${evolutionResponse.status})`;
      
      if (errorData?.response?.message) {
        const messages = Array.isArray(errorData.response.message) 
          ? errorData.response.message 
          : [errorData.response.message];
        
        // Check for specific error types
        const errorText = messages.join(' ');
        
        if (errorText.includes("Can't reach database server")) {
          userFriendlyError = '⚠️ O servidor Evolution API está com problemas de conexão ao banco de dados. Verifique se o PostgreSQL do Evolution está rodando e acessível.';
        } else if (errorText.includes('PrismaClientKnownRequestError')) {
          userFriendlyError = '⚠️ Erro interno no servidor Evolution API (Prisma Database). Verifique os logs do servidor Evolution.';
        } else if (errorText.includes('ECONNREFUSED')) {
          userFriendlyError = '⚠️ Não foi possível conectar ao servidor Evolution API. Verifique se o servidor está rodando.';
        } else if (errorText.includes('ETIMEDOUT')) {
          userFriendlyError = '⚠️ Timeout ao conectar com o servidor Evolution API. Verifique a conectividade de rede.';
        } else {
          // Use first message if available, truncate to reasonable length
          userFriendlyError = messages[0].substring(0, 300);
        }
      } else if (errorData?.message) {
        userFriendlyError = errorData.message.substring(0, 300);
      }

      // Clean up database records
      await supabase.from("connection_secrets").delete().eq("connection_id", connectionData.id);
      await supabase.from("connections").delete().eq("id", connectionData.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: userFriendlyError,
          details: errorData,
          technicalInfo: `Status: ${evolutionResponse.status}`
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const evolutionData = await evolutionResponse.json();
    console.log("Evolution API response data:", evolutionData);

    // Update connection with Evolution API response
    const updateData: any = {
      metadata: evolutionData,
    };

    // Determine status and extract QR code
    if (evolutionData.instance?.qrcode?.base64) {
      updateData.status = "qr";
      updateData.qr_code = `data:image/png;base64,${evolutionData.instance.qrcode.base64}`;
    } else if (evolutionData.instance?.qrcode?.code) {
      updateData.status = "qr";
      updateData.qr_code = evolutionData.instance.qrcode.code;
    } else if (evolutionData.qrcode?.base64) {
      updateData.status = "qr";
      updateData.qr_code = `data:image/png;base64,${evolutionData.qrcode.base64}`;
    } else if (evolutionData.qrcode?.code) {
      updateData.status = "qr";
      updateData.qr_code = evolutionData.qrcode.code;
    } else if (evolutionData.instance?.state === "open") {
      updateData.status = "connected";
      
      // ✅ Priorizar número da Evolution, mas manter o manual se não vier
      if (evolutionData.instance?.owner) {
        updateData.phone_number = evolutionData.instance.owner;
        console.log(`📱 Phone from Evolution: ${evolutionData.instance.owner}`);
      } else if (!phoneNumber) {
        console.log(`⚠️ No phone from Evolution and none provided manually`);
      }
      // Se não veio da Evolution e não foi fornecido manualmente, manter null
    } else {
      updateData.status = "creating";
    }
    
    console.log(`💾 Updating connection with:`, {
      status: updateData.status,
      phone_from_evolution: evolutionData.instance?.owner,
      phone_manual: phoneNumber,
      phone_will_save: updateData.phone_number
    });

    const { error: updateError } = await supabase.from("connections").update(updateData).eq("id", connectionData.id);

    if (updateError) {
      console.error("Error updating connection:", updateError);
    }

    console.log("Instance created successfully:", {
      id: connectionData.id,
      instance_name: instanceName,
      status: updateData.status,
    });

    // Atualizar status para syncing - a Evolution enviará histórico automaticamente
    if (historyDays > 0 || historyRecovery !== 'none') {
      await supabase
        .from('connections')
        .update({
          history_sync_status: 'syncing',
          history_sync_started_at: new Date().toISOString()
        })
        .eq('id', connectionData.id);
      
      console.log(`✅ History sync configured for ${instanceName} - waiting for Evolution to send history via webhook`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        connection: {
          ...connectionData,
          ...updateData,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ CRITICAL ERROR in evolution-create-instance:", error);
    console.error("❌ Error name:", (error as any)?.name);
    console.error("❌ Error message:", (error as Error)?.message);
    console.error("❌ Error stack:", (error as Error)?.stack);
    
    // Try to get more error details
    let errorDetails: any = {};
    try {
      errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch {
      errorDetails = String(error);
    }
    console.error("❌ Full error object:", errorDetails);

    const errorMessage = (error as Error)?.message || "Erro desconhecido";
    const errorName = (error as any)?.name || "UnknownError";
    
    // Extract more context if available
    let contextInfo = '';
    if (error instanceof TypeError) {
      contextInfo = ' (TypeError - possível problema de tipo ou valor)';
    } else if (error instanceof ReferenceError) {
      contextInfo = ' (ReferenceError - variável ou função não encontrada)';
    } else if (error instanceof SyntaxError) {
      contextInfo = ' (SyntaxError - erro de sintaxe)';
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro interno: ${errorMessage}${contextInfo}`,
        errorType: errorName,
        details: Deno.env.get("DENO_ENV") === 'development' ? {
          stack: (error as Error)?.stack,
          name: errorName,
          message: errorMessage,
          rawError: errorDetails
        } : {
          message: errorMessage,
          type: errorName
        }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
