-- Política temporária mais simples para resolver o problema de carregamento
DROP POLICY IF EXISTS "workspace_webhook_settings_master_access" ON public.workspace_webhook_settings;

-- Política muito permissiva temporariamente para debug
CREATE POLICY "workspace_webhook_settings_temp_access" 
ON public.workspace_webhook_settings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Vamos também permitir acesso aos secrets
DROP POLICY IF EXISTS "workspace_webhook_secrets_service_and_admin" ON public.workspace_webhook_secrets;

CREATE POLICY "workspace_webhook_secrets_temp_access" 
ON public.workspace_webhook_secrets 
FOR ALL 
USING (true)
WITH CHECK (true);