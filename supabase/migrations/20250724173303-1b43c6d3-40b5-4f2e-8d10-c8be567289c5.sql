-- Adicionar campos necessários para integração WhatsApp na tabela messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhor performance na busca por external_id
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON public.messages(external_id);

-- Adicionar campos de controle para conversas
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Criar função para atualizar unread_count automaticamente
CREATE OR REPLACE FUNCTION update_conversation_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Incrementar contador quando nova mensagem de contato chega
  IF NEW.sender_type = 'contact' THEN
    UPDATE conversations 
    SET unread_count = unread_count + 1,
        last_activity_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  ELSE
    -- Resetar contador quando agente responde
    UPDATE conversations 
    SET unread_count = 0,
        last_activity_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar contador automaticamente
DROP TRIGGER IF EXISTS trigger_update_unread_count ON public.messages;
CREATE TRIGGER trigger_update_unread_count
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_unread_count();

-- Habilitar realtime para todas as tabelas relacionadas
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;