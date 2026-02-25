-- Add user and value info to pipeline_card_history for status events
alter table if exists public.pipeline_card_history
add column if not exists changed_by_id uuid,
add column if not exists changed_by_name text,
add column if not exists status_value numeric,
add column if not exists status_value_currency text;

comment on column public.pipeline_card_history.changed_by_id is 'User who executed the change';
comment on column public.pipeline_card_history.changed_by_name is 'Display name of the user who executed the change';
comment on column public.pipeline_card_history.status_value is 'Deal value at the moment of the status change';
comment on column public.pipeline_card_history.status_value_currency is 'Currency for status_value (e.g., BRL)';

