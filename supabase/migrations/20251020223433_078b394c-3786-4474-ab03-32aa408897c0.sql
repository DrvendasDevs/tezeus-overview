-- Atualizar função para deletar usuários ao apagar empresa
CREATE OR REPLACE FUNCTION public.delete_workspace_cascade(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reserved_workspace_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Block deletion of reserved workspace
  IF p_workspace_id = reserved_workspace_id THEN
    RAISE EXCEPTION 'Cannot delete reserved workspace';
  END IF;

  -- Delete in correct order to avoid foreign key violations
  
  -- 1. Delete messages (depends on conversations)
  DELETE FROM public.messages WHERE workspace_id = p_workspace_id;
  
  -- 2. Delete conversation-related data
  DELETE FROM public.conversation_tags WHERE conversation_id IN (
    SELECT id FROM public.conversations WHERE workspace_id = p_workspace_id
  );
  DELETE FROM public.conversation_assignments WHERE conversation_id IN (
    SELECT id FROM public.conversations WHERE workspace_id = p_workspace_id
  );
  DELETE FROM public.conversations WHERE workspace_id = p_workspace_id;
  
  -- 3. Delete contact-related data
  -- Primeiro, deletar n8n_chat_histories usando os números de telefone dos contatos
  DELETE FROM public.n8n_chat_histories 
  WHERE session_id IN (
    SELECT DISTINCT phone 
    FROM public.contacts 
    WHERE workspace_id = p_workspace_id 
    AND phone IS NOT NULL
    AND phone != ''
  )
  OR session_id IN (
    SELECT DISTINCT regexp_replace(phone, '[^0-9]', '', 'g')
    FROM public.contacts 
    WHERE workspace_id = p_workspace_id 
    AND phone IS NOT NULL
    AND phone != ''
  )
  OR session_id IN (
    SELECT DISTINCT '55' || regexp_replace(phone, '[^0-9]', '', 'g')
    FROM public.contacts 
    WHERE workspace_id = p_workspace_id 
    AND phone IS NOT NULL
    AND phone != ''
    AND regexp_replace(phone, '[^0-9]', '', 'g') !~ '^55'
  )
  OR session_id IN (
    SELECT DISTINCT '+55' || regexp_replace(phone, '[^0-9]', '', 'g')
    FROM public.contacts 
    WHERE workspace_id = p_workspace_id 
    AND phone IS NOT NULL
    AND phone != ''
    AND regexp_replace(phone, '[^0-9]', '', 'g') !~ '^55'
  )
  OR session_id IN (
    SELECT DISTINCT substring(regexp_replace(phone, '[^0-9]', '', 'g') FROM 3)
    FROM public.contacts 
    WHERE workspace_id = p_workspace_id 
    AND phone IS NOT NULL
    AND phone != ''
    AND regexp_replace(phone, '[^0-9]', '', 'g') ~ '^55'
  );
  
  DELETE FROM public.contact_tags WHERE contact_id IN (
    SELECT id FROM public.contacts WHERE workspace_id = p_workspace_id
  );
  DELETE FROM public.activities WHERE workspace_id = p_workspace_id;
  DELETE FROM public.contacts WHERE workspace_id = p_workspace_id;
  
  -- 4. Delete connection-related data
  DELETE FROM public.connection_secrets WHERE connection_id IN (
    SELECT id FROM public.connections WHERE workspace_id = p_workspace_id
  );
  DELETE FROM public.connections WHERE workspace_id = p_workspace_id;
  
  -- 5. Delete workspace configuration data
  DELETE FROM public.evolution_instance_tokens WHERE workspace_id = p_workspace_id;
  DELETE FROM public.workspace_webhook_secrets WHERE workspace_id = p_workspace_id;
  DELETE FROM public.workspace_webhook_settings WHERE workspace_id = p_workspace_id;
  
  -- 6. Delete users that ONLY belong to this workspace
  -- First, identify users that only have membership in this workspace
  DELETE FROM public.system_users 
  WHERE id IN (
    SELECT wm.user_id 
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
    AND NOT EXISTS (
      SELECT 1 
      FROM public.workspace_members wm2 
      WHERE wm2.user_id = wm.user_id 
      AND wm2.workspace_id != p_workspace_id
    )
    -- Don't delete master users
    AND NOT EXISTS (
      SELECT 1 
      FROM public.system_users su 
      WHERE su.id = wm.user_id 
      AND su.profile = 'master'
    )
  );
  
  -- 7. Delete workspace members (for users that belong to other workspaces too)
  DELETE FROM public.workspace_members WHERE workspace_id = p_workspace_id;
  
  DELETE FROM public.workspace_limits WHERE workspace_id = p_workspace_id;
  
  -- 8. Delete workspace-specific data
  DELETE FROM public.tags WHERE workspace_id = p_workspace_id;
  DELETE FROM public.dashboard_cards WHERE workspace_id = p_workspace_id;
  DELETE FROM public.clientes WHERE workspace_id = p_workspace_id;
  
  -- 9. Delete webhook logs
  DELETE FROM public.webhook_logs WHERE workspace_id = p_workspace_id;
  
  -- 10. Finally delete the workspace itself
  DELETE FROM public.workspaces WHERE id = p_workspace_id;
  
END;
$function$;