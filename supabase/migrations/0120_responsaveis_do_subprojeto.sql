-- Projetos do cliente: mais de um responsável (pedido da Emilly, menu Atualizações:
-- "Colocar mais de um responsável por projeto. Só dá para colocar 1").
--
-- responsible_ids guarda todos os responsáveis do projeto (como o cliente já faz).
-- responsible_id continua existindo: é o primeiro da lista (o "principal"), e a
-- tela escreve os dois. Quem ainda tem só o responsible_id (projeto antigo) abre
-- com ele marcado: a migration copia o valor pra lista.
-- Pode rodar de novo sem problema.

alter table public.subprojects
  add column if not exists responsible_ids uuid[] not null default '{}';

update public.subprojects
   set responsible_ids = array[responsible_id]
 where responsible_id is not null
   and cardinality(responsible_ids) = 0;

alter table public.subprojects drop constraint if exists subprojects_responsible_ids_check;
alter table public.subprojects
  add constraint subprojects_responsible_ids_check
  check (cardinality(responsible_ids) <= 20);

create index if not exists subprojects_responsible_ids_idx on public.subprojects using gin (responsible_ids);
