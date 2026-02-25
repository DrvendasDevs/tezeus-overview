-- Recriar trigger para masters/admins receberem TODAS as notificações
DROP FUNCTION IF EXISTS create_notification_on_new_message() CASCADE;

CREATE OR REPLACE FUNCTION create_notification_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  conv_record RECORD;
  notification_content TEXT;
BEGIN
  -- Apenas processar mensagens de contato (inbound)
  IF NEW.sender_type != 'contact' THEN
    RETURN NEW;
  END IF;

  -- Buscar informações da conversa e contato
  SELECT c.*, ct.name as contact_name, ct.id as contact_id
  INTO conv_record
  FROM public.conversations c
  JOIN public.contacts ct ON c.contact_id = ct.id
  WHERE c.id = NEW.conversation_id;

  -- Definir conteúdo da notificação baseado no tipo de mensagem
  notification_content := CASE
    WHEN NEW.message_type = 'image' THEN '📷 Imagem'
    WHEN NEW.message_type = 'video' THEN '🎥 Vídeo'
    WHEN NEW.message_type = 'audio' THEN '🎵 Áudio'
    WHEN NEW.message_type = 'document' THEN '📄 Documento'
    ELSE NEW.content
  END;

  -- Criar notificações seguindo as regras:
  -- 1. Masters e Admins SEMPRE recebem (todas as conversas)
  -- 2. Se tem assigned_user: ele também recebe
  -- 3. Se NÃO tem assigned_user: todos os users comuns também recebem
  
  INSERT INTO public.notifications (
    workspace_id,
    user_id,
    message_id,
    conversation_id,
    contact_id,
    title,
    content,
    message_type,
    status
  )
  SELECT
    NEW.workspace_id,
    wm.user_id,
    NEW.id,
    NEW.conversation_id,
    conv_record.contact_id,
    conv_record.contact_name,
    notification_content,
    NEW.message_type,
    'unread'
  FROM public.workspace_members wm
  JOIN public.system_users su ON su.id = wm.user_id
  WHERE wm.workspace_id = NEW.workspace_id
    AND wm.is_hidden = false
    AND su.status = 'active'
    AND (
      -- Masters e Admins recebem SEMPRE
      su.profile IN ('master', 'admin')
      OR
      -- User atribuído recebe sempre
      wm.user_id = conv_record.assigned_user_id
      OR
      -- Se NÃO há atribuição, users comuns também recebem
      (conv_record.assigned_user_id IS NULL AND su.profile = 'user')
    )
  ON CONFLICT (user_id, message_id) DO NOTHING;

  RAISE NOTICE 'Notificações criadas para mensagem % da conversa %', NEW.id, NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER trigger_create_notification_on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_on_new_message();