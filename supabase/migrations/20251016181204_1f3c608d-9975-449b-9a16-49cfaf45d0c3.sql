-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'unread',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar constraint de status se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_status_check'
  ) THEN
    ALTER TABLE public.notifications 
    ADD CONSTRAINT notifications_status_check 
    CHECK (status IN ('unread', 'read'));
  END IF;
END $$;

-- Adicionar unique constraint se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_notification_per_user_message'
  ) THEN
    ALTER TABLE public.notifications 
    ADD CONSTRAINT unique_notification_per_user_message 
    UNIQUE (user_id, message_id);
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON public.notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_conversation ON public.notifications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- Políticas RLS: usuários veem apenas suas próprias notificações
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (user_id = current_system_user_id());

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (user_id = current_system_user_id());

-- Trigger para criar notificação automaticamente quando nova mensagem chega
CREATE OR REPLACE FUNCTION public.create_notification_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Se há usuário atribuído, criar notificação apenas para ele
  IF conv_record.assigned_user_id IS NOT NULL THEN
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
    ) VALUES (
      NEW.workspace_id,
      conv_record.assigned_user_id,
      NEW.id,
      NEW.conversation_id,
      conv_record.contact_id,
      conv_record.contact_name,
      notification_content,
      NEW.message_type,
      'unread'
    )
    ON CONFLICT (user_id, message_id) DO NOTHING;
  ELSE
    -- Criar notificação para todos os membros do workspace
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
    WHERE wm.workspace_id = NEW.workspace_id
      AND wm.is_hidden = false
    ON CONFLICT (user_id, message_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Notificações criadas para mensagem % da conversa %', NEW.id, NEW.conversation_id;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_create_notification_on_new_message ON public.messages;
CREATE TRIGGER trigger_create_notification_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_on_new_message();

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();