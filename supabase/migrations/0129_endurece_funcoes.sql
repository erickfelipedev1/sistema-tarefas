-- Endurecimento das funções (avisos do Supabase, 26/11):
--
-- 1) Funções com SECURITY DEFINER que qualquer um, mesmo sem login (anon),
--    podia chamar pela API (/rest/v1/rpc/...). Ficam abertas sem login só as
--    do portal do cliente, que exigem o token do link (share_token):
--    comment_on_post, get_project_*, save_onboarding_step,
--    send_project_message e submit_project_feedback.
--    - As da equipe (faturamento, pacotes, avaliações, canais, estratégia...)
--      passam a exigir login. Todas as regras de acesso que usam essas
--      funções já são só pra "authenticated", e o app só chama essas RPCs
--      logado.
--    - As de gatilho não são chamadas por ninguém pela API: o Postgres não
--      confere permissão de EXECUTE quando o gatilho dispara, então ninguém
--      precisa delas (nem anon nem authenticated).
-- 2) Funções sem search_path fixo (20 gatilhos e mes_da_conclusao): passam a
--    rodar sempre com "public", não com o caminho de quem chamou.
-- 3) Funções novas criadas pelo postgres deixam de nascer abertas pra
--    PUBLIC/anon: a do portal do cliente precisa de "grant execute ... to
--    anon" explícito na migration dela.

-- 1a) Equipe: só logado.
revoke execute on function public.aceitar_servico_enviado(uuid, numeric, boolean) from public, anon;
revoke execute on function public.definir_pacote_do_cliente(uuid, uuid, date) from public, anon;
revoke execute on function public.dispensar_tarefas_do_faturamento(uuid[], text) from public, anon;
revoke execute on function public.lancar_tarefa_no_faturamento(uuid, uuid, numeric) from public, anon;
revoke execute on function public.pacote_do_cliente(uuid) from public, anon;
revoke execute on function public.pacotes_disponiveis() from public, anon;
revoke execute on function public.pacotes_dos_clientes() from public, anon;
revoke execute on function public.pode_acessar_anexo_chat(text) from public, anon;
revoke execute on function public.pode_aprovar_estrategia() from public, anon;
revoke execute on function public.pode_escrever_analise() from public, anon;
revoke execute on function public.pode_ver_canal(uuid) from public, anon;
revoke execute on function public.pode_ver_cliente_da_estrategia(uuid) from public, anon;
revoke execute on function public.pode_ver_faturamento() from public, anon;
revoke execute on function public.recusar_servico_enviado(uuid, text) from public, anon;
revoke execute on function public.responder_avaliacao(uuid, text) from public, anon;
revoke execute on function public.situacao_das_minhas_tarefas(uuid[]) from public, anon;
revoke execute on function public.tem_visao_geral() from public, anon;
revoke execute on function public.tirar_pacote_do_cliente(uuid, date) from public, anon;

-- Logado continua podendo (já tinham grant explícito; reforça).
grant execute on function public.aceitar_servico_enviado(uuid, numeric, boolean) to authenticated;
grant execute on function public.definir_pacote_do_cliente(uuid, uuid, date) to authenticated;
grant execute on function public.dispensar_tarefas_do_faturamento(uuid[], text) to authenticated;
grant execute on function public.lancar_tarefa_no_faturamento(uuid, uuid, numeric) to authenticated;
grant execute on function public.pacote_do_cliente(uuid) to authenticated;
grant execute on function public.pacotes_disponiveis() to authenticated;
grant execute on function public.pacotes_dos_clientes() to authenticated;
grant execute on function public.pode_acessar_anexo_chat(text) to authenticated;
grant execute on function public.pode_aprovar_estrategia() to authenticated;
grant execute on function public.pode_escrever_analise() to authenticated;
grant execute on function public.pode_ver_canal(uuid) to authenticated;
grant execute on function public.pode_ver_cliente_da_estrategia(uuid) to authenticated;
grant execute on function public.pode_ver_faturamento() to authenticated;
grant execute on function public.recusar_servico_enviado(uuid, text) to authenticated;
grant execute on function public.responder_avaliacao(uuid, text) to authenticated;
grant execute on function public.situacao_das_minhas_tarefas(uuid[]) to authenticated;
grant execute on function public.tem_visao_geral() to authenticated;
grant execute on function public.tirar_pacote_do_cliente(uuid, date) to authenticated;

-- 1b) Gatilhos com SECURITY DEFINER: ninguém chama pela API.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prosecdef
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
  end loop;
end;
$$;

-- 2) search_path fixo.
alter function public.fn_analise_antes_de_editar() set search_path = public;
alter function public.fn_ata_antes_de_gravar() set search_path = public;
alter function public.fn_cliente_extra_valido() set search_path = public;
alter function public.fn_est_mapeamento_antes_de_gravar() set search_path = public;
alter function public.fn_est_mes_antes_de_gravar() set search_path = public;
alter function public.fn_est_otimizacao_antes_de_gravar() set search_path = public;
alter function public.fn_est_peca_antes_de_gravar() set search_path = public;
alter function public.fn_est_semana_antes_de_gravar() set search_path = public;
alter function public.fn_est_tarefa_ata_antes_de_gravar() set search_path = public;
alter function public.fn_imagens_do_pedido() set search_path = public;
alter function public.fn_notificacao_so_leitura() set search_path = public;
alter function public.fn_pedido_antes_de_gravar() set search_path = public;
alter function public.fn_post_antes_de_gravar() set search_path = public;
alter function public.fn_projects_protege_instagram() set search_path = public;
alter function public.fn_subprojeto_antes_de_gravar() set search_path = public;
alter function public.fn_subtarefas_seguem_cliente() set search_path = public;
alter function public.fn_tarefa_no_projeto_do_cliente() set search_path = public;
alter function public.fn_tarefa_valida_pai() set search_path = public;
alter function public.fn_task_completed_at() set search_path = public;
alter function public.mes_da_conclusao(timestamp with time zone) set search_path = public;
alter function public.protege_flags_de_acesso() set search_path = public;

-- 3) Funções novas não nascem abertas pra todo mundo.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
