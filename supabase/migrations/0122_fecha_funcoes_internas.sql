-- Segurança (auditoria de 19/11): funções internas que qualquer um podia
-- chamar direto pela API.
--
-- * fechar_pacotes_do_cliente(projeto, mês) apaga/encerra os pacotes de
--   faturamento de um projeto e NÃO confere quem chama — é só o miolo de
--   definir_pacote_do_cliente e tirar_pacote_do_cliente (que conferem o papel).
--   Com a chave pública do site e o código de um projeto (que aparece nos links
--   dos arquivos do portal), dava pra chamar direto. Agora só as duas funções
--   que a usam (donas: postgres, security definer) conseguem executar.
-- * catalogo_de_servicos() lista os serviços ativos: deixa de valer pra quem
--   não está logado (a equipe continua vendo).

revoke execute on function public.fechar_pacotes_do_cliente(uuid, date) from public, anon, authenticated;
revoke execute on function public.catalogo_de_servicos() from public, anon;
grant execute on function public.catalogo_de_servicos() to authenticated;
