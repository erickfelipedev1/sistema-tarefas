-- Ficou uma dupla ainda ("Chloe Semi Joias" 2x) depois da 0024 — a causa
-- mais provável é espaço duplo/sobrando no MEIO do nome (a 0024 só tirava
-- espaço das pontas com trim(), não normalizava espaço interno). Esse
-- script repete a mesma lógica de fusão, só que agora colapsando qualquer
-- sequência de espaços em um só antes de comparar. Seguro rodar de novo
-- mesmo se não sobrar nada pra fundir.

do $$
declare
  grupo record;
  vencedor uuid;
  perdedor uuid;
  i int;
begin
  for grupo in
    select array_agg(id order by (name = upper(name)) asc, created_at asc) as ids
    from public.projects
    group by lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
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
end $$;
