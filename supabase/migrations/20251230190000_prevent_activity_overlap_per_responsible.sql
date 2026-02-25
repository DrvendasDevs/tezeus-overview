-- Impede que o MESMO responsável tenha atividades sobrepostas no mesmo workspace
-- Regra aplicada apenas para atividades em aberto (is_completed != true)
--
-- Implementação preferencial: EXCLUDE constraint (GiST) com tstzrange.
-- Se houver dados legados com sobreposição, a constraint falharia ao aplicar.
-- Nesse caso, aplicamos um TRIGGER de validação (enforce para novas inserções/updates)
-- para não quebrar o deploy.

do $$
declare
  has_legacy_overlap boolean := false;
  constraint_exists boolean := false;
  trigger_exists boolean := false;
begin
  -- Garantir default coerente (se vier null, assumimos 30 min na regra)
  begin
    alter table public.activities
      alter column duration_minutes set default 30;
  exception when others then
    -- ignore (coluna pode já ter default ou permissões limitadas em ambientes específicos)
  end;

  -- Detectar se a constraint já existe
  select exists (
    select 1
    from pg_constraint
    where conname = 'activities_no_overlap_per_responsible'
  ) into constraint_exists;

  -- Detectar sobreposição existente (apenas atividades em aberto)
  select exists (
    select 1
    from public.activities a
    join public.activities b
      on a.id < b.id
     and a.workspace_id = b.workspace_id
     and a.responsible_id = b.responsible_id
    where a.responsible_id is not null
      and coalesce(a.is_completed, false) = false
      and coalesce(b.is_completed, false) = false
      and a.scheduled_for < (b.scheduled_for + (coalesce(b.duration_minutes, 30) * interval '1 minute'))
      and b.scheduled_for < (a.scheduled_for + (coalesce(a.duration_minutes, 30) * interval '1 minute'))
  ) into has_legacy_overlap;

  if (not constraint_exists) and (not has_legacy_overlap) then
    -- Constraint (opção B) - mais robusta e performática
    create extension if not exists btree_gist;

    alter table public.activities
      add constraint activities_no_overlap_per_responsible
      exclude using gist (
        workspace_id with =,
        responsible_id with =,
        tstzrange(
          scheduled_for,
          scheduled_for + (coalesce(duration_minutes, 30) * interval '1 minute'),
          '[)'
        ) with &&
      )
      where (responsible_id is not null and coalesce(is_completed, false) = false);
  else
    -- Fallback: trigger de validação (não valida retroativamente dados legados)
    -- (mantém o sistema funcionando e bloqueia novos conflitos)
    create or replace function public.enforce_activity_no_overlap()
    returns trigger
    language plpgsql
    as $fn$
    declare
      new_end timestamptz;
      conflict_id uuid;
    begin
      -- Só aplica para atividades em aberto e com responsável
      if new.responsible_id is null or coalesce(new.is_completed, false) = true then
        return new;
      end if;

      new_end :=
        new.scheduled_for + (coalesce(new.duration_minutes, 30) * interval '1 minute');

      select a.id
        into conflict_id
      from public.activities a
      where a.workspace_id = new.workspace_id
        and a.responsible_id = new.responsible_id
        and coalesce(a.is_completed, false) = false
        and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and a.scheduled_for < new_end
        and (a.scheduled_for + (coalesce(a.duration_minutes, 30) * interval '1 minute')) > new.scheduled_for
      limit 1;

      if conflict_id is not null then
        raise exception 'Conflito de agenda: já existe uma atividade para este responsável nesse período.'
          using errcode = '23P01';
      end if;

      return new;
    end;
    $fn$;

    select exists (
      select 1
      from pg_trigger
      where tgname = 'trg_enforce_activity_no_overlap'
    ) into trigger_exists;

    if not trigger_exists then
      create trigger trg_enforce_activity_no_overlap
      before insert or update of scheduled_for, duration_minutes, responsible_id, workspace_id, is_completed
      on public.activities
      for each row
      execute function public.enforce_activity_no_overlap();
    end if;
  end if;
end $$;


