-- ✅ Atualizar trigger para calcular unread_count corretamente
-- Evita incrementar contador em UPDATEs de status (delivered_at, read_at)

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_unread_count integer;
BEGIN
  -- ✅ Calcular o total REAL de mensagens não lidas (apenas de contato e não lidas)
  SELECT COUNT(*) INTO new_unread_count
  FROM public.messages
  WHERE conversation_id = NEW.conversation_id
    AND sender_type = 'contact'
    AND read_at IS NULL;

  -- Atualizar a conversa
  -- Se a nova mensagem é do agente/system, resetar unread_count para 0
  -- Se é do contato, usar o valor calculado
  UPDATE public.conversations 
  SET 
    last_activity_at = NEW.created_at,
    updated_at = NEW.created_at,
    unread_count = CASE 
      WHEN NEW.sender_type = 'agent' OR NEW.sender_type = 'system' THEN 0
      ELSE new_unread_count
    END
  WHERE id = NEW.conversation_id;
  
  -- Log para debug
  RAISE NOTICE 'Conversa % atualizada - sender_type: %, unread_count: %', 
    NEW.conversation_id, NEW.sender_type, 
    CASE WHEN NEW.sender_type = 'agent' OR NEW.sender_type = 'system' THEN 0 ELSE new_unread_count END;
  
  RETURN NEW;
END;
$function$;

-- ✅ Remover trigger antigo de unread_count se existir
DROP TRIGGER IF EXISTS update_conversation_unread_count ON messages;

-- ✅ Adicionar índice para otimizar query de contagem
CREATE INDEX IF NOT EXISTS idx_messages_conversation_unread 
ON messages(conversation_id, sender_type, read_at) 
WHERE sender_type = 'contact' AND read_at IS NULL;