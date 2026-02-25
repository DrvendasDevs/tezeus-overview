-- Atualiza a função de ranking de trabalho para:
-- - rodar sem filtros (período/workspace/responsável são ignorados)
-- - normalizar acentos/maiúsculas/minúsculas
-- - manter security definer e grants

create or replace function public.report_team_work_ranking(
  p_workspace_id uuid default null,
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
  with norm as (
    select
      a.responsible_id,
      translate(lower(trim(coalesce(a.type, ''))),
                'ãâáàêéèîíìõôóòûúùç',
                'aaaaeeeiioooouuuc') as t
    from public.activities a
    where a.responsible_id is not null
  )
  select
    n.responsible_id,
    count(*) filter (where n.t = 'mensagem')::bigint as mensagem,
    count(*) filter (where n.t = 'ligacao nao atendida')::bigint as ligacao_nao_atendida,
    count(*) filter (where n.t = 'ligacao atendida')::bigint as ligacao_atendida,
    count(*) filter (where n.t = 'ligacao abordada')::bigint as ligacao_abordada,
    count(*) filter (where n.t = 'ligacao agendada')::bigint as ligacao_agendada,
    count(*) filter (where n.t = 'ligacao de follow up')::bigint as ligacao_follow_up,
    count(*) filter (where n.t = 'reuniao agendada')::bigint as reuniao_agendada,
    count(*) filter (where n.t = 'reuniao realizada')::bigint as reuniao_realizada,
    count(*) filter (where n.t = 'reuniao nao realizada')::bigint as reuniao_nao_realizada,
    count(*) filter (where n.t = 'reuniao reagendada')::bigint as reuniao_reagendada,
    count(*) filter (where n.t = 'whatsapp enviado')::bigint as whatsapp_enviado
  from norm n
  group by n.responsible_id;
$$;

grant execute on function public.report_team_work_ranking(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.report_team_work_ranking(uuid, timestamptz, timestamptz, uuid) to anon;


