-- Criar tabela para configuração de agentes IA
CREATE TABLE public.ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  agent_type TEXT NOT NULL DEFAULT 'conversational',
  api_provider TEXT NOT NULL DEFAULT 'openai',
  api_key_encrypted TEXT,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  system_instructions TEXT DEFAULT 'Você é um assistente útil e prestativo.',
  temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER DEFAULT 1000 CHECK (max_tokens > 0),
  response_delay_ms INTEGER DEFAULT 1000 CHECK (response_delay_ms >= 0),
  knowledge_base_enabled BOOLEAN DEFAULT false,
  auto_responses_enabled BOOLEAN DEFAULT true,
  working_hours_enabled BOOLEAN DEFAULT false,
  working_hours_start TIME,
  working_hours_end TIME,
  working_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- 1=Segunda, 7=Domingo
  fallback_message TEXT DEFAULT 'Desculpe, não estou disponível no momento. Um atendente humano entrará em contato em breve.',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações
CREATE POLICY "Allow all operations on ai_agents" 
ON public.ai_agents 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ai_agents_updated_at
BEFORE UPDATE ON public.ai_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela para arquivos da base de conhecimento
CREATE TABLE public.ai_agent_knowledge_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  content_extracted TEXT,
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para knowledge files
ALTER TABLE public.ai_agent_knowledge_files ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações nos arquivos
CREATE POLICY "Allow all operations on ai_agent_knowledge_files" 
ON public.ai_agent_knowledge_files 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Inserir agente padrão (Tezeus)
INSERT INTO public.ai_agents (
  name,
  description,
  agent_type,
  system_instructions,
  is_default,
  is_active
) VALUES (
  'Tezeus',
  'Assistente inteligente principal do sistema',
  'conversational',
  'Você é o Tezeus, um assistente inteligente especializado em atendimento ao cliente. Seja sempre educado, prestativo e eficiente. Ajude os usuários com suas dúvidas e necessidades de forma clara e objetiva.',
  true,
  true
);

-- Criar storage bucket para knowledge base
INSERT INTO storage.buckets (id, name, public) 
VALUES ('agent-knowledge', 'agent-knowledge', false);

-- Políticas para o bucket de knowledge base
CREATE POLICY "Users can view knowledge files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'agent-knowledge');

CREATE POLICY "Users can upload knowledge files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'agent-knowledge');

CREATE POLICY "Users can update knowledge files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'agent-knowledge');

CREATE POLICY "Users can delete knowledge files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'agent-knowledge');