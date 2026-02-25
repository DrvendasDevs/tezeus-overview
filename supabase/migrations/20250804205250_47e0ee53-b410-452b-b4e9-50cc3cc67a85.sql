-- Criar tabela de mensagens conforme especificação
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'operator')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'audio')),
  content TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir todas as operações (ajustar conforme necessário)
CREATE POLICY "Allow all operations on messages" ON public.messages
FOR ALL USING (true) WITH CHECK (true);

-- Criar tabela de conversas se não existir
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para conversas
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Criar política para conversas
CREATE POLICY "Allow all operations on conversations" ON public.conversations
FOR ALL USING (true) WITH CHECK (true);

-- Adicionar foreign key
ALTER TABLE public.messages 
ADD CONSTRAINT fk_messages_conversation 
FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Criar bucket de storage para mídias do chat
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas para o bucket chat-media
CREATE POLICY "Allow public access to chat-media" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-media');

CREATE POLICY "Allow upload to chat-media" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "Allow update to chat-media" ON storage.objects
FOR UPDATE USING (bucket_id = 'chat-media');

CREATE POLICY "Allow delete from chat-media" ON storage.objects
FOR DELETE USING (bucket_id = 'chat-media');