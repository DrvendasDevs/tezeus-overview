-- Adicionar novos campos na tabela ai_agents
ALTER TABLE public.ai_agents 
  ADD COLUMN IF NOT EXISTS max_messages INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS ignore_interval INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assign_responsible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS split_responses BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS process_messages BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS disable_outside_platform BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS knowledge_base_url TEXT;

-- Comentários nos campos para documentação
COMMENT ON COLUMN public.ai_agents.max_messages IS 'Máximo de mensagens no histórico da conversa';
COMMENT ON COLUMN public.ai_agents.ignore_interval IS 'Intervalo em segundos para ignorar mensagens repetidas';
COMMENT ON COLUMN public.ai_agents.assign_responsible IS 'Se o agente pode assumir tickets com responsável';
COMMENT ON COLUMN public.ai_agents.split_responses IS 'Se deve dividir respostas longas em blocos menores';
COMMENT ON COLUMN public.ai_agents.process_messages IS 'Se deve processar mensagens automaticamente';
COMMENT ON COLUMN public.ai_agents.disable_outside_platform IS 'Se desabilita quando responder fora da plataforma';
COMMENT ON COLUMN public.ai_agents.knowledge_base_url IS 'URL do arquivo de base de conhecimento no Supabase Storage';