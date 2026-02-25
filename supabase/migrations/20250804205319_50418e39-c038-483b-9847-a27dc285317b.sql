-- Primeiro, vamos verificar e ajustar a estrutura da tabela messages existente
-- Adicionar as colunas necessárias se não existirem
DO $$ 
BEGIN
  -- Verificar se a coluna mime_type existe, se não, adicionar
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'messages' AND column_name = 'mime_type') THEN
    ALTER TABLE public.messages ADD COLUMN mime_type TEXT;
  END IF;
  
  -- Verificar se sender_type aceita os valores corretos
  -- Remover constraint existente se houver
  IF EXISTS (SELECT 1 FROM information_schema.check_constraints 
             WHERE constraint_name LIKE '%sender_type%' AND table_name = 'messages') THEN
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_type_check;
  END IF;
  
  -- Adicionar nova constraint para sender_type
  ALTER TABLE public.messages ADD CONSTRAINT messages_sender_type_check 
  CHECK (sender_type IN ('client', 'operator', 'contact', 'agent', 'ia'));
  
  -- Verificar message_type constraint
  IF EXISTS (SELECT 1 FROM information_schema.check_constraints 
             WHERE constraint_name LIKE '%message_type%' AND table_name = 'messages') THEN
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
  END IF;
  
  -- Adicionar nova constraint para message_type
  ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check 
  CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker'));
END $$;

-- Criar bucket de storage para mídias do chat se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;