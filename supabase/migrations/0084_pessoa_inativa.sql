-- Pessoa que saiu da equipe: profiles.ativo = false.
--
-- Ela não aparece mais nas listas de escolha (responsável, menção,
-- participantes da ata, mensagem nova, solicitações, painel, responsáveis do
-- cliente), mas o perfil continua existindo pra o nome seguir no histórico
-- (tarefas, comentários, atas). Uma sessão que ainda estava aberta é
-- encerrada no próximo carregamento (app/(app)/layout.tsx → /sair), e o token
-- da IA conectada para de valer (lib/mcp-tokens.ts). O login em si é
-- bloqueado no Supabase Auth (banimento), fora desta migration.
--
-- Pode rodar de novo sem problema.

alter table public.profiles
  add column if not exists ativo boolean not null default true;
