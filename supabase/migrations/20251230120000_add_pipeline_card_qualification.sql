-- Add qualification to pipeline_cards (qualify deals/opportunities, not activities)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pipeline_card_qualification') then
    create type public.pipeline_card_qualification as enum ('unqualified', 'qualified', 'disqualified');
  end if;
end$$;

alter table public.pipeline_cards
  add column if not exists qualification public.pipeline_card_qualification not null default 'unqualified';

create index if not exists idx_pipeline_cards_pipeline_qualification
  on public.pipeline_cards (pipeline_id, qualification);

-- Optional backfill from legacy activity priority usage (if it was used as deal qualification)
update public.pipeline_cards pc
set qualification = 'qualified'
where exists (
  select 1
  from public.activities a
  where a.pipeline_card_id = pc.id
    and a.priority = 'qualificado'
);

update public.pipeline_cards pc
set qualification = 'disqualified'
where exists (
  select 1
  from public.activities a
  where a.pipeline_card_id = pc.id
    and a.priority = 'desqualificado'
);


