-- Adiciona flag para marcar coluna como etapa de oferta
alter table public.pipeline_columns
  add column if not exists is_offer_stage boolean not null default false;


