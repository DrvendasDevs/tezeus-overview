-- Alterar padrão do agente_ativo para false (inativo por padrão)
ALTER TABLE public.conversations ALTER COLUMN agente_ativo SET DEFAULT false;

-- Criar trigger para atualizar automaticamente last_activity_at quando mensagens são inseridas
CREATE OR REPLACE FUNCTION public.update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET 
    last_activity_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger que executa automaticamente
DROP TRIGGER IF EXISTS trigger_update_conversation_activity ON public.messages;
CREATE TRIGGER trigger_update_conversation_activity
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_activity();