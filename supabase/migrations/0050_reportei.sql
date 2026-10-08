-- Analytics dos clientes (aba "Analytics" em /projetos/[id]): a qual projeto
-- do Reportei (https://app.reportei.com) cada cliente do d.hub corresponde.
-- É o "id" do projeto na API do Reportei; vazio = ainda não foi ligado.
alter table public.projects
  add column if not exists reportei_project_id bigint;
