-- Devolve os documentos COMPARTILHADOS (não-privados) de um projeto, pra
-- mostrar na página pública /progresso/<token> — mesmo padrão de
-- segurança de get_project_progress (migration 0018): função
-- "security definer" travada pelo token, o cliente (sem login) nunca
-- acessa drive_folders/drive_files direto.
--
-- Só pega pastas de primeiro nível do projeto (parent_folder_id nulo) e
-- os arquivos delas + os arquivos soltos na raiz — não desce em
-- subpastas aninhadas. Arquivos/pastas privados (owner_id preenchido,
-- ex: "Meus arquivos" de alguém da equipe) nunca aparecem aqui.
create or replace function public.get_project_documents(p_token uuid)
returns json
language plpgsql
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

  select json_build_object(
    'folders', (
      select coalesce(json_agg(
        json_build_object('id', f.id, 'name', f.name)
        order by f.name
      ), '[]'::json)
      from public.drive_folders f
      where f.project_id = projeto.id
        and f.parent_folder_id is null
        and f.owner_id is null
    ),
    'files', (
      select coalesce(json_agg(
        json_build_object(
          'id', fl.id,
          'folder_id', fl.folder_id,
          'file_name', fl.file_name,
          'file_path', fl.file_path,
          'file_size', fl.file_size,
          'created_at', fl.created_at
        )
        order by fl.file_name
      ), '[]'::json)
      from public.drive_files fl
      where fl.project_id = projeto.id
        and fl.owner_id is null
        and (
          fl.folder_id is null
          or fl.folder_id in (
            select id from public.drive_folders
            where project_id = projeto.id
              and parent_folder_id is null
              and owner_id is null
          )
        )
    )
  )
  into resultado;

  return resultado;
end;
$$;

grant execute on function public.get_project_documents(uuid) to anon, authenticated;
