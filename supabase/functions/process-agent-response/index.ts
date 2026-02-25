import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActionMatch {
  type: 'add-tag' | 'transfer-queue' | 'transfer-connection' | 'create-card' | 'transfer-column' | 'save-info';
  params: any;
  fullMatch: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      agentResponse, 
      contactId, 
      conversationId,
      workspaceId 
    } = await req.json();

    console.log('🤖 Processando resposta do agente:', {
      contactId,
      conversationId,
      workspaceId,
      responsePreview: agentResponse?.substring(0, 100)
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolver telefone da instância associado à conversa (se existir)
    let instancePhone: string | null = null;
    if (conversationId) {
      const { data: conversationDetails, error: conversationError } = await supabase
        .from('conversations')
        .select(`
          id,
          connection_id,
          connection:connection_id (
            phone_number
          )
        `)
        .eq('id', conversationId)
        .maybeSingle();

      if (conversationError) {
        console.error('⚠️ Não foi possível carregar dados da conversa para obter o telefone da instância:', conversationError.message);
      } else {
        instancePhone = conversationDetails?.connection?.[0]?.phone_number ?? null;
        console.log('📞 INSTANCE_PHONE detectado:', instancePhone || 'não informado');
      }
    }

    // Regex para detectar ações no formato [ADD_ACTION]: [param1: value1], [param2: value2]
    const actionPattern = /\[ADD_ACTION\]:\s*(?:\[([^\]]+)\](?:,\s*)?)+/gi;
    
    const actions: ActionMatch[] = [];
    let cleanText = agentResponse;

    let match;
    while ((match = actionPattern.exec(agentResponse)) !== null) {
      const fullMatch = match[0];
      
      // Extrair todos os parâmetros [key: value]
      const paramPattern = /\[([^:]+):\s*([^\]]+)\]/g;
      const params: Record<string, string> = {};
      let paramMatch;
      
      while ((paramMatch = paramPattern.exec(fullMatch)) !== null) {
        const key = paramMatch[1].trim();
        const value = paramMatch[2].trim();
        params[key] = value;
      }

      console.log('🔍 Parâmetros detectados:', params);

      // Substituir placeholders pelos valores reais
      const processedParams: Record<string, string> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value === 'CONTACT_ID') {
          processedParams[key] = contactId;
        } else if (value === 'CONVERSATION_ID') {
          processedParams[key] = conversationId;
        } else if (value === 'WORKSPACE_ID') {
          processedParams[key] = workspaceId;
        } else if (value === 'INSTANCE_PHONE') {
          processedParams[key] = instancePhone || '';
        } else {
          processedParams[key] = value;
        }
      }

      // Determinar tipo de ação baseado nos parâmetros
      let actionType: ActionMatch['type'] | null = null;
      
      if ('tag_id' in processedParams) {
        actionType = 'add-tag';
        console.log('📌 Ação detectada: Adicionar Tag ->', processedParams.tag_id);
      } else if ('fila_id' in processedParams) {
        actionType = 'transfer-queue';
        console.log('🔀 Ação detectada: Transferir Fila ->', processedParams.fila_id);
      } else if ('conection_id' in processedParams) {
        actionType = 'transfer-connection';
        console.log('🔀 Ação detectada: Transferir Conexão ->', processedParams.conection_id);
      } else if ('card_id' in processedParams && processedParams.card_id === 'ID_DO_CARD') {
        actionType = 'transfer-column';
        console.log('↔️ Ação detectada: Transferir Coluna ->', processedParams.pipeline_id, processedParams.coluna_id);
      } else if ('pipeline_id' in processedParams && 'coluna_id' in processedParams && !('card_id' in processedParams)) {
        actionType = 'create-card';
        console.log('📋 Ação detectada: Criar Card ->', processedParams.pipeline_id, processedParams.coluna_id);
      } else if ('field_name' in processedParams && 'field_value' in processedParams) {
        actionType = 'save-info';
        console.log('💾 Ação detectada: Salvar Info ->', processedParams.field_name);
      }

      if (actionType) {
        actions.push({
          type: actionType,
          params: processedParams,
          fullMatch
        });
      }
    }

    // Executar todas as ações
    const executionResults = [];
    for (const action of actions) {
      try {
        const result = await supabase.functions.invoke('execute-agent-action', {
          body: {
            action: action.type,
            params: action.params,
            contactId,
            conversationId,
            workspaceId
          }
        });

        executionResults.push({
          action: action.type,
          params: action.params,
          success: result.data?.success || false,
          error: result.error?.message
        });

        console.log(`✅ Ação ${action.type} executada:`, result.data);
      } catch (error) {
        console.error(`❌ Erro ao executar ${action.type}:`, error);
        executionResults.push({
          action: action.type,
          params: action.params,
          success: false,
          error: (error as Error).message
        });
      }

      // Remover marcação do texto
      cleanText = cleanText.replace(action.fullMatch, '');
    }

    // Limpar espaços extras
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

    console.log('✨ Processamento concluído:', {
      actionsDetected: actions.length,
      actionsExecuted: executionResults.filter(r => r.success).length,
      cleanTextPreview: cleanText.substring(0, 100)
    });

    return new Response(JSON.stringify({
      success: true,
      cleanText,
      actionsExecuted: executionResults,
      actionsCount: actions.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro process-agent-response:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
