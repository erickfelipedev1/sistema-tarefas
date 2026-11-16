-- Resposta nova da equipe na solicitação: o cliente é avisado dentro do portal (/cliente).
--
-- cliente_viu_em guarda quando o cliente abriu a conversa da solicitação pela
-- última vez. Comentário da equipe mais novo que isso = resposta nova (selo na
-- solicitação e faixa no topo do portal). Só o servidor grava (o cliente não usa
-- o Supabase Auth: a ação confere o cookie e que a solicitação é do login dele).
-- Pode rodar de novo sem problema.

alter table public.task_requests add column if not exists cliente_viu_em timestamptz;
