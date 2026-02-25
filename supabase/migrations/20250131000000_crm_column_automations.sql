-- Criar tabela de automações de coluna do CRM
CREATE TABLE IF NOT EXISTS public.crm_column_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID NOT NULL REFERENCES public.pipeline_columns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de gatilhos de automação
CREATE TABLE IF NOT EXISTS public.crm_column_automation_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.crm_column_automations(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('enter_column', 'leave_column', 'time_in_column', 'recurring', 'message_received')),
  trigger_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de ações de automação
CREATE TABLE IF NOT EXISTS public.crm_column_automation_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.crm_column_automations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('send_message', 'send_funnel', 'move_to_column', 'add_tag', 'add_agent', 'remove_agent')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_crm_column_automations_column_id ON public.crm_column_automations(column_id);
CREATE INDEX IF NOT EXISTS idx_crm_column_automations_workspace_id ON public.crm_column_automations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_column_automations_active ON public.crm_column_automations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_crm_column_automation_triggers_automation_id ON public.crm_column_automation_triggers(automation_id);
CREATE INDEX IF NOT EXISTS idx_crm_column_automation_triggers_type ON public.crm_column_automation_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_crm_column_automation_actions_automation_id ON public.crm_column_automation_actions(automation_id);
CREATE INDEX IF NOT EXISTS idx_crm_column_automation_actions_order ON public.crm_column_automation_actions(automation_id, action_order);

-- Habilitar RLS
ALTER TABLE public.crm_column_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_column_automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_column_automation_actions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para crm_column_automations
-- Remover políticas existentes antes de criar (idempotente)
DROP POLICY IF EXISTS "Users can view column automations in their workspace" ON public.crm_column_automations;
DROP POLICY IF EXISTS "Admins can manage column automations in their workspace" ON public.crm_column_automations;
DROP POLICY IF EXISTS "Admins can insert column automations in their workspace" ON public.crm_column_automations;
DROP POLICY IF EXISTS "Admins can update column automations in their workspace" ON public.crm_column_automations;
DROP POLICY IF EXISTS "Admins can delete column automations in their workspace" ON public.crm_column_automations;

CREATE POLICY "Users can view column automations in their workspace" 
ON public.crm_column_automations 
FOR SELECT 
USING (is_current_user_master() OR is_workspace_member(workspace_id, 'user'::system_profile));

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

-- Políticas RLS para crm_column_automation_triggers
-- Remover políticas existentes antes de criar (idempotente)
DROP POLICY IF EXISTS "Users can view automation triggers" ON public.crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can manage automation triggers" ON public.crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can insert automation triggers" ON public.crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can update automation triggers" ON public.crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can delete automation triggers" ON public.crm_column_automation_triggers;

CREATE POLICY "Users can view automation triggers" 
ON public.crm_column_automation_triggers 
FOR SELECT 
USING (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_triggers.automation_id
    AND is_workspace_member(a.workspace_id, 'user'::system_profile)
  )
);

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

-- Políticas RLS para crm_column_automation_actions
-- Remover políticas existentes antes de criar (idempotente)
DROP POLICY IF EXISTS "Users can view automation actions" ON public.crm_column_automation_actions;
DROP POLICY IF EXISTS "Admins can manage automation actions" ON public.crm_column_automation_actions;
DROP POLICY IF EXISTS "Admins can insert automation actions" ON public.crm_column_automation_actions;
DROP POLICY IF EXISTS "Admins can update automation actions" ON public.crm_column_automation_actions;
DROP POLICY IF EXISTS "Admins can delete automation actions" ON public.crm_column_automation_actions;

CREATE POLICY "Users can view automation actions" 
ON public.crm_column_automation_actions 
FOR SELECT 
USING (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.crm_column_automations a
    WHERE a.id = crm_column_automation_actions.automation_id
    AND is_workspace_member(a.workspace_id, 'user'::system_profile)
  )
);

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

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_crm_column_automations_updated_at ON public.crm_column_automations;
CREATE TRIGGER update_crm_column_automations_updated_at
  BEFORE UPDATE ON public.crm_column_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.crm_column_automations IS 'Automações configuradas para colunas do pipeline CRM';
COMMENT ON TABLE public.crm_column_automation_triggers IS 'Gatilhos que disparam automações de coluna';
COMMENT ON TABLE public.crm_column_automation_actions IS 'Ações executadas quando uma automação é disparada';
COMMENT ON COLUMN public.crm_column_automation_triggers.trigger_type IS 'Tipos: enter_column, leave_column, time_in_column, recurring, message_received';
COMMENT ON COLUMN public.crm_column_automation_actions.action_type IS 'Tipos: send_message, send_funnel, move_to_column, add_tag, add_agent, remove_agent';


