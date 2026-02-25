-- Adicionar gatilho de horário específico nas automações de coluna
ALTER TABLE public.crm_column_automation_triggers
DROP CONSTRAINT IF EXISTS crm_column_automation_triggers_trigger_type_check;

ALTER TABLE public.crm_column_automation_triggers
ADD CONSTRAINT crm_column_automation_triggers_trigger_type_check
CHECK (
  trigger_type IN (
    'enter_column',
    'leave_column',
    'time_in_column',
    'scheduled_time',
    'recurring',
    'message_received'
  )
);
