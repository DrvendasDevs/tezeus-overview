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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar agente ativo/padrão
    const { data: activeAgent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (agentError || !activeAgent) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhum agente ativo encontrado'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar arquivos de conhecimento se habilitado
    let knowledgeContent = '';
    if (activeAgent.knowledge_base_enabled) {
      const { data: knowledgeFiles } = await supabase
        .from('ai_agent_knowledge_files')
        .select('content_extracted, file_name')
        .eq('agent_id', activeAgent.id)
        .eq('is_processed', true);

      if (knowledgeFiles && knowledgeFiles.length > 0) {
        knowledgeContent = knowledgeFiles
          .map(file => `[${file.file_name}]\n${file.content_extracted}`)
          .filter(Boolean)
          .join('\n\n---\n\n');
      }
    }

    // Verificar horário de funcionamento
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const currentDay = now.getDay(); // 0 = domingo, 1 = segunda, etc.

    let isWorkingHours = true;
    if (activeAgent.working_hours_enabled) {
      const workingDays = activeAgent.working_days || [];
      const isWorkingDay = workingDays.includes(currentDay);
      
      if (!isWorkingDay) {
        isWorkingHours = false;
      } else if (activeAgent.working_hours_start && activeAgent.working_hours_end) {
        const startTime = activeAgent.working_hours_start;
        const endTime = activeAgent.working_hours_end;
        isWorkingHours = currentTime >= startTime && currentTime <= endTime;
      }
    }

    const agentConfig = {
      id: activeAgent.id,
      name: activeAgent.name,
      description: activeAgent.description,
      model: activeAgent.model,
      api_provider: activeAgent.api_provider,
      system_instructions: activeAgent.system_instructions,
      temperature: activeAgent.temperature,
      max_tokens: activeAgent.max_tokens,
      response_delay_ms: activeAgent.response_delay_ms,
      knowledge_base_enabled: activeAgent.knowledge_base_enabled,
      knowledge_content: knowledgeContent,
      auto_responses_enabled: activeAgent.auto_responses_enabled,
      working_hours_enabled: activeAgent.working_hours_enabled,
      working_hours_start: activeAgent.working_hours_start,
      working_hours_end: activeAgent.working_hours_end,
      working_days: activeAgent.working_days,
      fallback_message: activeAgent.fallback_message,
      is_working_hours: isWorkingHours,
      current_time: currentTime,
      current_day: currentDay
    };

    console.log('Configurações do agente enviadas para N8N:', activeAgent.name);

    return new Response(JSON.stringify({
      success: true,
      data: agentConfig
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro ao buscar configurações do agente:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});