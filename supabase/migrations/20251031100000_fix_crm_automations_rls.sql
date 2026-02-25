-- Correção das políticas RLS para automações do CRM
-- Esta migration corrige as políticas RLS que estavam usando FOR ALL com apenas USING
-- Para INSERT, é necessário usar WITH CHECK separadamente

-- Remover políticas antigas que usavam FOR ALL
DROP POLICY IF EXISTS "Admins can manage column automations in their workspace" ON public.crm_column_automations;
DROP POLICY IF EXISTS "Admins can manage automation triggers" ON public.crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can manage automation actions" ON public.crm_column_automation_actions;

-- Remover políticas que podem já existir (para recriar corretamente)
DROP POLICY IF EXISTS "Admins can insert column automations in their workspace" ON public.crm_column_automations;
DROP POLICY IF EXISTS "Admins can update column automations in their workspace" ON public.crm_column_automations;
DROP POLICY IF EXISTS "Admins can delete column automations in their workspace" ON public.crm_column_automations;

-- Criar políticas separadas para crm_column_automations
CREATE POLICY "Admins can insert column automations in their workspace" 
ON public.crm_column_automations 
FOR INSERT 
WITH CHECK (is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "Admins can update column automations in their workspace" 
ON public.crm_column_automations 
FOR UPDATE 
USING (is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile))
WITH CHECK (is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "Admins can delete column automations in their workspace" 
ON public.crm_column_automations 
FOR DELETE 
USING (is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile));

-- Remover políticas que podem já existir para triggers
DROP POLICY IF EXISTS "Admins can insert automation triggers" ON public.crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can update automation triggers" ON public.crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can delete automation triggers" ON public.crm_column_automation_triggers;

-- Criar políticas separadas para crm_column_automation_triggers
CREATE POLICY "Admins can insert automation triggers" 
ON public.crm_column_automation_triggers 
FOR INSERT 
WITH CHECK (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_triggers.automation_id
    AND is_workspace_member(a.workspace_id, 'admin'::system_profile)
  )
);

CREATE POLICY "Admins can update automation triggers" 
ON public.crm_column_automation_triggers 
FOR UPDATE 
USING (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_triggers.automation_id
    AND is_workspace_member(a.workspace_id, 'admin'::system_profile)
  )
)
WITH CHECK (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_triggers.automation_id
    AND is_workspace_member(a.workspace_id, 'admin'::system_profile)
  )
);

CREATE POLICY "Admins can delete automation triggers" 
ON public.crm_column_automation_triggers 
FOR DELETE 
USING (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_triggers.automation_id
    AND is_workspace_member(a.workspace_id, 'admin'::system_profile)
  )
);

-- Remover políticas que podem já existir para actions
DROP POLICY IF EXISTS "Admins can insert automation actions" ON public.crm_column_automation_actions;
DROP POLICY IF EXISTS "Admins can update automation actions" ON public.crm_column_automation_actions;
DROP POLICY IF EXISTS "Admins can delete automation actions" ON public.crm_column_automation_actions;

-- Criar políticas separadas para crm_column_automation_actions
CREATE POLICY "Admins can insert automation actions" 
ON public.crm_column_automation_actions 
FOR INSERT 
WITH CHECK (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_actions.automation_id
    AND is_workspace_member(a.workspace_id, 'admin'::system_profile)
  )
);

CREATE POLICY "Admins can update automation actions" 
ON public.crm_column_automation_actions 
FOR UPDATE 
USING (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_actions.automation_id
    AND is_workspace_member(a.workspace_id, 'admin'::system_profile)
  )
)
WITH CHECK (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_actions.automation_id
    AND is_workspace_member(a.workspace_id, 'admin'::system_profile)
  )
);

CREATE POLICY "Admins can delete automation actions" 
ON public.crm_column_automation_actions 
FOR DELETE 
USING (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_actions.automation_id
    AND is_workspace_member(a.workspace_id, 'admin'::system_profile)
  )
);

