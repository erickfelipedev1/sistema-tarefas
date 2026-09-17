-- Limpeza dos projetos duplicados que a migração 0023 criou sem querer:
-- quando um cliente tinha o mesmo nome de um projeto já existente, mas
-- escrito com letras diferentes (ex: "Giordano" vs "GIORDANO"), ou quando
-- havia dois clientes com o nome exatamente igual, a checagem "já existe
-- um projeto com esse nome?" não enxergava o outro registro que estava
-- sendo inserido na mesma leva — resultado: projeto duplicado.
--
-- O que esse script faz:
--   1) Para cada grupo de projetos com o mesmo nome (comparação sem
--      diferenciar maiúsculas/minúsculas), escolhe quem fica: prefere a
--      versão que não está toda em maiúsculas (o "nome bonito"); em caso
--      de empate, fica o mais antigo. Reaponta tasks/pages/drive_folders/
--      drive_files/task_requests do(s) duplicado(s) pro escolhido, e
--      apaga o(s) duplicado(s).
--   2) Junta "ADG" dentro de "ADG Advogados" (nomes diferentes, mas é o
--      mesmo cliente) do mesmo jeito.
--   3) Apaga "projeto2" só se estiver realmente vazio (sem nenhuma tarefa,
--      página, pasta, arquivo ou solicitação linkada) — se tiver algo
--      dentro, não mexe e avisa no final pra conferir manualmente.
--
-- Seguro rodar mais de uma vez: depois de limpo, não sobra duplicata nem
-- "ADG"/"projeto2" pra mexer de novo.

do $$
declare
  grupo record;
  vencedor uuid;
  perdedor uuid;
  id_projeto2 uuid;
  tem_dados boolean;
  i int;
begin
  -- 1) Duplicatas por nome.
  for grupo in
    select array_agg(id order by (name = upper(name)) asc, created_at asc) as ids
    from public.projects
    group by trim(lower(name))
    having count(*) > 1
  loop
    vencedor := grupo.ids[1];
    for i in 2..array_length(grupo.ids, 1) loop
      perdedor := grupo.ids[i];

      update public.tasks set project_id = vencedor where project_id = perdedor;
      update public.pages set project_id = vencedor where project_id = perdedor;
      update public.drive_folders set project_id = vencedor where project_id = perdedor;
      update public.drive_files set project_id = vencedor where project_id = perdedor;
      update public.task_requests set project_id = vencedor where project_id = perdedor;

      delete from public.projects where id = perdedor;
    end loop;
  end loop;

  -- 2) "ADG" -> "ADG Advogados".
  select id into vencedor from public.projects where trim(name) = 'ADG Advogados' limit 1;
  select id into perdedor from public.projects where trim(name) = 'ADG' limit 1;
  if vencedor is not null and perdedor is not null and vencedor <> perdedor then
    update public.tasks set project_id = vencedor where project_id = perdedor;
    update public.pages set project_id = vencedor where project_id = perdedor;
    update public.drive_folders set project_id = vencedor where project_id = perdedor;
    update public.drive_files set project_id = vencedor where project_id = perdedor;
    update public.task_requests set project_id = vencedor where project_id = perdedor;
    delete from public.projects where id = perdedor;
  end if;

  -- 3) "projeto2": apaga só se estiver vazio.
  select id into id_projeto2 from public.projects where trim(name) = 'projeto2' limit 1;
  if id_projeto2 is not null then
    select exists(
      select 1 from public.tasks where project_id = id_projeto2
      union all select 1 from public.pages where project_id = id_projeto2
      union all select 1 from public.drive_folders where project_id = id_projeto2
      union all select 1 from public.drive_files where project_id = id_projeto2
      union all select 1 from public.task_requests where project_id = id_projeto2
    ) into tem_dados;

    if not tem_dados then
      delete from public.projects where id = id_projeto2;
    else
      raise notice 'projeto2 tem tarefas/páginas/arquivos dentro — não apaguei, confere manualmente.';
    end if;
  end if;
end $$;
