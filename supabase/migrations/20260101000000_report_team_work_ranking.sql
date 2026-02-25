-- Relatórios Avançados: Equipe – Ranking de Trabalho (por responsável)
-- Retorna contagens por responsible_id para os tipos oficiais de atividades do sistema.

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
as $$
  select
    a.responsible_id,
    count(*) filter (where a.type = 'Mensagem')::bigint as mensagem,
    count(*) filter (where a.type = 'Ligação não atendida')::bigint as ligacao_nao_atendida,
    count(*) filter (where a.type = 'Ligação atendida')::bigint as ligacao_atendida,
    count(*) filter (where a.type = 'Ligação abordada')::bigint as ligacao_abordada,
    count(*) filter (where a.type = 'Ligação agendada')::bigint as ligacao_agendada,
    count(*) filter (where a.type = 'Ligação de follow up')::bigint as ligacao_follow_up,
    count(*) filter (where a.type = 'Reunião agendada')::bigint as reuniao_agendada,
    count(*) filter (where a.type = 'Reunião realizada')::bigint as reuniao_realizada,
    count(*) filter (where a.type = 'Reunião não realizada')::bigint as reuniao_nao_realizada,
    count(*) filter (where a.type = 'Reunião reagendada')::bigint as reuniao_reagendada,
    count(*) filter (where a.type = 'WhatsApp enviado')::bigint as whatsapp_enviado
  from public.activities a
  where a.workspace_id = p_workspace_id
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at <= p_to)
    and (p_responsible_id is null or a.responsible_id = p_responsible_id)
    and a.type in (
      'Mensagem',
      'Ligação não atendida',
      'Ligação atendida',
      'Ligação abordada',
      'Ligação agendada',
      'Ligação de follow up',
      'Reunião agendada',
      'Reunião realizada',
      'Reunião não realizada',
      'Reunião reagendada',
      'WhatsApp enviado'
    )
  group by a.responsible_id;
$$;


