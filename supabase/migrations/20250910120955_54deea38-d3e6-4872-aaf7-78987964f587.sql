-- Temporariamente ajustar a política para permitir acesso aos dados de webhook
-- Criar uma política mais permissiva para masters

DROP POLICY IF EXISTS "workspace_webhook_settings_access" ON public.workspace_webhook_settings;

-- Política temporária mais permissiva para masters 
CREATE POLICY "workspace_webhook_settings_master_access" 
ON public.workspace_webhook_settings 
FOR ALL 
USING (
  -- Service role sempre pode acessar
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR 
  -- Masters podem acessar tudo
  (EXISTS (
    SELECT 1 FROM public.system_users su 
    WHERE su.email = (auth.jwt() ->> 'email') 
    AND su.profile = 'master'
  )) OR
  -- Usuários workspace específicos usando direct lookup
  (EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.system_users su ON su.id = wm.user_id
    WHERE wm.workspace_id = workspace_webhook_settings.workspace_id
    AND su.email = (auth.jwt() ->> 'email')
  ))
)
WITH CHECK (
  -- Service role sempre pode inserir/atualizar
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR 
  -- Masters podem inserir/atualizar tudo
  (EXISTS (
    SELECT 1 FROM public.system_users su 
    WHERE su.email = (auth.jwt() ->> 'email') 
    AND su.profile = 'master'
  )) OR
  -- Usuários workspace específicos usando direct lookup
  (EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.system_users su ON su.id = wm.user_id
    WHERE wm.workspace_id = workspace_webhook_settings.workspace_id
    AND su.email = (auth.jwt() ->> 'email')
  ))
);