import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, contactId, workspaceId, agentId, phoneNumber, instanceName } = await req.json();
    
    console.log('🤖 AI Chat Response Started:', {
      conversationId,
      workspaceId,
      agentId,
      phoneNumber
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar configuração do agente
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      console.error('❌ Agente não encontrado:', agentError);
      return new Response(JSON.stringify({ success: false, error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Agente carregado:', {
      name: agent.name,
      model: agent.model,
      provider: agent.api_provider,
      process_messages: agent.process_messages
    });

    // 2. Buscar histórico de mensagens (últimas N mensagens)
    const messageLimit = agent.max_messages || 20;
    console.log(`📚 Buscando últimas ${messageLimit} mensagens da conversa...`);
    
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('content, sender_type, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(messageLimit);

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
    }

    // 3. Montar contexto da conversa - INCLUIR APENAS MENSAGENS DO LEAD
    const conversationHistory = messages
      ?.filter(msg => msg.sender_type !== 'agent' && msg.sender_type !== 'ia') // Filtrar respostas do agente
      .map(msg => ({
        role: 'user',
        content: msg.content
      })) || [];

    console.log(`📖 Histórico montado: ${conversationHistory.length} mensagens do lead`);

    // 4. Preparar chamada OpenAI
    const openaiApiKey = agent.api_key_encrypted;
    
    if (!openaiApiKey) {
      console.error('❌ API Key não configurada para este agente');
      return new Response(JSON.stringify({ success: false, error: 'API key not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiPayload = {
      model: agent.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: agent.system_instructions || 'Você é um assistente prestativo.' },
        ...conversationHistory
      ],
      max_tokens: agent.max_tokens || 500,
      temperature: agent.temperature || 0.7
    };

    console.log('📤 Chamando OpenAI API...');
    console.log('   Model:', openaiPayload.model);
    console.log('   Messages count:', openaiPayload.messages.length);
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openaiPayload),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API Error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const aiMessage = openaiData.choices[0].message.content;

    console.log('✅ OpenAI Response received');
    console.log('   Response length:', aiMessage.length, 'chars');
    console.log('   Preview:', aiMessage.substring(0, 100) + '...');

    // 5. Processar ações do agente (se configurado process_messages)
    let processedMessage = aiMessage;
    let actionsExecuted = [];
    
    if (agent.process_messages) {
      console.log('🔧 Processando ações do agente...');
      
      try {
        const { data: processResult, error: processError } = await supabase.functions.invoke('process-agent-response', {
          body: {
            agentResponse: aiMessage,
            contactId: contactId,
            conversationId: conversationId,
            workspaceId: workspaceId
          }
        });
        
        if (processError) {
          console.error('❌ Erro ao processar ações:', processError);
        } else if (processResult?.cleanedText) {
          processedMessage = processResult.cleanedText;
          actionsExecuted = processResult.executedActions || [];
          console.log(`✅ Ações processadas: ${actionsExecuted.length} ações executadas`);
        }
      } catch (processException) {
        console.error('❌ Exceção ao processar ações:', processException);
      }
    }

    // 6. Salvar mensagem no banco
    console.log('💾 Salvando mensagem da IA no banco...');
    
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: processedMessage,
        sender_type: 'agent',
        message_type: 'text',
        status: 'sending',
        origem_resposta: 'automatica',
        workspace_id: workspaceId
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao salvar mensagem:', insertError);
      throw insertError;
    }

    console.log('✅ Mensagem salva no banco:', newMessage.id);

    // 7. Enviar via Evolution
    if (phoneNumber && instanceName && newMessage) {
      console.log('📤 Enviando via Evolution...');
      console.log('   Phone:', phoneNumber);
      console.log('   Instance:', instanceName);
      
      try {
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            messageId: newMessage.id,
            phoneNumber: phoneNumber,
            content: processedMessage,
            messageType: 'text',
            evolutionInstance: instanceName,
            workspaceId: workspaceId
          }
        });

        if (sendError) {
          console.error('❌ Erro ao enviar via WhatsApp:', sendError);
        } else {
          console.log('✅ Mensagem enviada via WhatsApp provider');
        }
      } catch (sendException) {
        console.error('❌ Exceção ao enviar via WhatsApp:', sendException);
      }
    } else {
      console.warn('⚠️ Dados insuficientes para enviar via WhatsApp:', {
        hasPhone: !!phoneNumber,
        hasInstance: !!instanceName,
        hasMessage: !!newMessage
      });
    }

    return new Response(JSON.stringify({
      success: true,
      ai_response: processedMessage,
      message_id: newMessage.id,
      actions_executed: actionsExecuted,
      ai_active: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro AI Chat Response:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
