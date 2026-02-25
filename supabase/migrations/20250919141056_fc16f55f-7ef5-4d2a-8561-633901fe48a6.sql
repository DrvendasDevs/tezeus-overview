-- Primeiro remover a função existente e recriar
DROP FUNCTION IF EXISTS public.is_workspace_member(uuid, system_profile);

-- Função para verificar se é membro do workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_uuid uuid, required_profile system_profile DEFAULT 'user')
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.workspace_members wm
        JOIN public.system_users su ON su.id = wm.user_id
        WHERE wm.workspace_id = workspace_uuid 
        AND wm.user_id = current_system_user_id()
        AND (
            required_profile = 'user' OR 
            (required_profile = 'admin' AND su.profile IN ('admin', 'master')) OR
            (required_profile = 'master' AND su.profile = 'master')
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Atualizar a política de conversas para garantir filtragem correta
DROP POLICY IF EXISTS "conversations_select_improved" ON public.conversations;

CREATE POLICY "conversations_select_improved" ON public.conversations
FOR SELECT USING (
    -- Masters e Admins veem todas as conversas do workspace
    (
        (is_current_user_master() OR is_current_user_admin()) 
        AND is_workspace_member(workspace_id, 'user')
    ) 
    OR 
    -- Usuários normais veem apenas conversas atribuídas a eles ou sem atribuição
    (
        NOT is_current_user_admin() 
        AND NOT is_current_user_master() 
        AND is_workspace_member(workspace_id, 'user') 
        AND (
            assigned_user_id = current_system_user_id() 
            OR assigned_user_id IS NULL
        )
    )
);