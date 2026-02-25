-- Fix: permitir que o relatório agregue activities mesmo com RLS (executa como owner)
-- e tornar a comparação de `type` mais resiliente (trim/lower).

create or replace function public.report_team_work_ranking(
  p_workspace_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_responsible_id uuid default null
)
returns table (
  responsible_id uuid,
  mensagem bigint,
  ligacao_nao_atendida bigint,
  ligacao_atendida bigint,
  ligacao_abordada bigint,
  ligacao_agendada bigint,
  ligacao_follow_up bigint,
  reuniao_agendada bigint,
  reuniao_realizada bigint,
  reuniao_nao_realizada bigint,
  reuniao_reagendada bigint,
  whatsapp_enviado bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      a.responsible_id,
      lower(trim(coalesce(a.type, ''))) as t
    from public.activities a
    where a.workspace_id = p_workspace_id
      and (p_from is null or a.created_at >= p_from)
      and (p_to is null or a.created_at <= p_to)
      and (p_responsible_id is null or a.responsible_id = p_responsible_id)
  )
  select
    b.responsible_id,
    count(*) filter (where b.t = lower('Mensagem'))::bigint as mensagem,
    count(*) filter (where b.t = lower('Ligação não atendida'))::bigint as ligacao_nao_atendida,
    count(*) filter (where b.t = lower('Ligação atendida'))::bigint as ligacao_atendida,
    count(*) filter (where b.t = lower('Ligação abordada'))::bigint as ligacao_abordada,
    count(*) filter (where b.t = lower('Ligação agendada'))::bigint as ligacao_agendada,
    count(*) filter (where b.t = lower('Ligação de follow up'))::bigint as ligacao_follow_up,
    count(*) filter (where b.t = lower('Reunião agendada'))::bigint as reuniao_agendada,
    count(*) filter (where b.t = lower('Reunião realizada'))::bigint as reuniao_realizada,
    count(*) filter (where b.t = lower('Reunião não realizada'))::bigint as reuniao_nao_realizada,
    count(*) filter (where b.t = lower('Reunião reagendada'))::bigint as reuniao_reagendada,
    count(*) filter (where b.t = lower('WhatsApp enviado'))::bigint as whatsapp_enviado
  from base b
  where b.t in (
    lower('Mensagem'),
    lower('Ligação não atendida'),
    lower('Ligação atendida'),
    lower('Ligação abordada'),
    lower('Ligação agendada'),
    lower('Ligação de follow up'),
    lower('Reunião agendada'),
    lower('Reunião realizada'),
    lower('Reunião não realizada'),
    lower('Reunião reagendada'),
    lower('WhatsApp enviado')
  )
  group by b.responsible_id;
$$;

grant execute on function public.report_team_work_ranking(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.report_team_work_ranking(uuid, timestamptz, timestamptz, uuid) to anon;


