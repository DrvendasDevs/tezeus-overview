-- Desabilitar RLS nas 3 tabelas
ALTER TABLE crm_column_automations DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_column_automation_triggers DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_column_automation_actions DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas RLS
DROP POLICY IF EXISTS "Users can view column automations in their workspace" ON crm_column_automations;
DROP POLICY IF EXISTS "Admins can insert column automations in their workspace" ON crm_column_automations;
DROP POLICY IF EXISTS "Admins can update column automations in their workspace" ON crm_column_automations;
DROP POLICY IF EXISTS "Admins can delete column automations in their workspace" ON crm_column_automations;

DROP POLICY IF EXISTS "Users can view automation triggers" ON crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can insert automation triggers" ON crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can update automation triggers" ON crm_column_automation_triggers;
DROP POLICY IF EXISTS "Admins can delete automation triggers" ON crm_column_automation_triggers;

DROP POLICY IF EXISTS "Users can view automation actions" ON crm_column_automation_actions;
DROP POLICY IF EXISTS "Admins can insert automation actions" ON crm_column_automation_actions;
DROP POLICY IF EXISTS "Admins can update automation actions" ON crm_column_automation_actions;
DROP POLICY IF EXISTS "Admins can delete automation actions" ON crm_column_automation_actions;