-- WON OFICIAL passa a ser empresa do OLACYR (migration 0099): o faturamento
-- dela aparece no resumo do dono e no portal dele, e ganha a aba Faturamento.
--
-- Pode rodar de novo sem problema.

update public.projects
   set empresa_de = '66481c87-7d97-4d30-a816-f39be01f071c',
       faturamento_avancado = true
 where id = '024d5e68-34d0-43bf-bc41-24c82d09f0e7'; -- WON OFICIAL
