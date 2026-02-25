-- Criar tabela para filas de atendimento
CREATE TABLE public.queues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para conversas
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  queue_id UUID REFERENCES public.queues(id),
  assigned_user_id UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending', 'transferred')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para mensagens
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'agent', 'system')),
  sender_id UUID, -- ID do usuário se for agent, NULL se for contact ou system
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video', 'system')),
  file_url TEXT,
  file_name TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para participantes da conversa (para conversas em grupo)
CREATE TABLE public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('participant', 'admin', 'observer')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(conversation_id, user_id)
);

-- Criar tabela para vincular tags às conversas
CREATE TABLE public.conversation_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, tag_id)
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS (permitir todas as operações por enquanto)
CREATE POLICY "Allow all operations on queues" ON public.queues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on conversation_participants" ON public.conversation_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on conversation_tags" ON public.conversation_tags FOR ALL USING (true) WITH CHECK (true);

-- Criar triggers para atualizar updated_at
CREATE TRIGGER update_queues_updated_at
  BEFORE UPDATE ON public.queues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para melhor performance
CREATE INDEX idx_conversations_contact_id ON public.conversations(contact_id);
CREATE INDEX idx_conversations_assigned_user_id ON public.conversations(assigned_user_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user_id ON public.conversation_participants(user_id);

-- Inserir algumas filas padrão
INSERT INTO public.queues (name, description) VALUES 
('Sem Fila', 'Conversa sem fila específica'),
('DS Agente', 'Fila para agentes DS'),
('Vendas', 'Fila de vendas');

-- Inserir dados de exemplo
-- Primeiro, vamos inserir alguns contatos de exemplo se não existirem
INSERT INTO public.contacts (name, phone, email) 
VALUES 
('Daiane Silva', '(21) 9 8985-5941', 'daiane@email.com'),
('Eva Santos', '(11) 9 7777-8888', 'eva@acess.com'),
('Igsanara Costa', '(31) 9 6666-7777', 'igsanara@email.com'),
('Eduardo Lima', '(41) 9 5555-6666', 'eduardo@email.com'),
('Fulano Pereira', '(51) 9 4444-5555', 'fulano@email.com')
ON CONFLICT (phone) DO NOTHING;

-- Inserir conversas de exemplo
INSERT INTO public.conversations (contact_id, queue_id, status, last_message_at)
SELECT 
  c.id,
  q.id,
  'open',
  now() - (INTERVAL '1 hour' * (row_number() OVER ()))
FROM public.contacts c
CROSS JOIN (SELECT id FROM public.queues WHERE name = 'Vendas' LIMIT 1) q
WHERE c.name IN ('Daiane Silva', 'Eva Santos', 'Igsanara Costa', 'Eduardo Lima', 'Fulano Pereira');

-- Inserir mensagens de exemplo
INSERT INTO public.messages (conversation_id, sender_type, content, created_at)
SELECT 
  conv.id,
  'contact',
  CASE 
    WHEN c.name = 'Daiane Silva' THEN 'Oi, gostaria de saber sobre os produtos'
    WHEN c.name = 'Eva Santos' THEN 'Preciso de mais informações sobre os serviços'
    WHEN c.name = 'Igsanara Costa' THEN 'Gostaria de agendar uma reunião'
    WHEN c.name = 'Eduardo Lima' THEN 'Muito interessado no produto'
    ELSE 'Olá, tenho algumas dúvidas'
  END,
  now() - (INTERVAL '2 hours' * (row_number() OVER ()))
FROM public.conversations conv
JOIN public.contacts c ON conv.contact_id = c.id;