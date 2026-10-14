-- Otimizações no Analytics do cliente: o que o tráfego otimizou aparece no
-- fim da aba Analytics, na equipe (lendo a tabela optimizations, como antes)
-- e no portal do cliente (/progresso/<token>), por esta função.
--
-- Decisão do Erick (2026-10-14): o cliente passa a ver data, onde foi, o que
-- foi feito e o "por quê" (justificativa), e quem registrou (pelo nome do
-- perfil, não pelo login). Isso vale pra TODO o histórico já registrado. A tabela
-- optimizations não ganha política pública: o portal só enxerga o que esta
-- função devolve, e só do projeto daquele link.
create or replace function public.get_project_optimizations(p_token uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  projeto record;
  resultado json;
begin
  select id into projeto from public.projects where share_token = p_token;
  if not found then
    return null;
  end if;

  select coalesce(json_agg(
    json_build_object(
      'id', o.id,
      'opt_date', o.opt_date,
      'place', o.place,
      'action_taken', o.action_taken,
      'justification', o.justification,
      'created_by_label', coalesce(nullif(trim(pf.name), ''), o.created_by_label)
    )
    order by o.opt_date desc, o.created_at desc
  ), '[]'::json)
  into resultado
  from (
    select * from public.optimizations
    where project_id = projeto.id
    order by opt_date desc, created_at desc
    limit 100
  ) o
  left join public.profiles pf on pf.id = o.created_by;

  return resultado;
end;
$$;

grant execute on function public.get_project_optimizations(uuid) to anon, authenticated;
