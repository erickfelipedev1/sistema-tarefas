import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteDaRequisicao, perfilAtual, usuarioAtual } from "@/lib/sessao";
import TaskBoard from "@/components/TaskBoard";
import NewPageButton from "@/components/NewPageButton";
import ShareProjectLink from "@/components/ShareProjectLink";
import ClientRequestAccess, {
  type AcessoCliente,
} from "@/components/ClientRequestAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import ProjectTabs from "@/components/ProjectTabs";
import Coreografia from "@/components/movimento/Coreografia";
import DriveBrowser from "@/components/DriveBrowser";
import InvoicesManager from "@/components/InvoicesManager";
import OptimizationsManager from "@/components/OptimizationsManager";
import PostsManager from "@/components/PostsManager";
import PacoteDoClienteCard, { type PacoteDoCliente } from "@/components/PacoteDoClienteCard";
import { TipoDeServicoDoCliente } from "@/components/TipoDeServico";
import { pacotesDisponiveis } from "@/lib/pacotes";
import AnalyticsCliente from "@/components/AnalyticsCliente";
import CorDoCliente from "@/components/CorDoCliente";
import InstagramDoCliente from "@/components/InstagramDoCliente";
import { corDoCliente } from "@/lib/task-colors";
import ProjectDetailsCard from "@/components/ProjectDetailsCard";
import ProjectMessagesManager from "@/components/ProjectMessagesManager";
import ProjectFeedbackList from "@/components/ProjectFeedbackList";
import { PaginaRow } from "@/components/WikiPagesPanel";
import type { PaginaResumo } from "@/lib/wiki";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpenIcon, ChevronLeftIcon } from "@/components/ui/icons";

export default async function ProjetoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { aba?: string; post?: string; novo?: string };
}) {
  const { id } = params;
  const supabase = await clienteDaRequisicao();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const user = await usuarioAtual();

  const userLabel =
    (user?.user_metadata?.username as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  // Aba "Otimizações": só pro tráfego (profiles.faz_otimizacoes, migration
  // 0043) e pros líderes (ve_tudo).
  const perfil = await perfilAtual();
  const souLider = perfil?.ve_tudo === true;
  const temOtimizacoes = souLider || perfil?.faz_otimizacoes === true;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("position", { ascending: true });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, name, avatar_url")
    .order("name", { ascending: true });

  // Quem cuida do cliente (migration 0055; marcado na lista de clientes).
  const responsaveisDoCliente = ((project.responsible_ids as string[] | null) ?? []).flatMap((pessoaId) => {
    const pessoa = (profiles ?? []).find((p) => p.id === pessoaId);
    return pessoa ? [pessoa.name || pessoa.username || "Sem nome"] : [];
  });

  // O pacote que o cliente tem hoje (migration 0053): nome e o que inclui,
  // sem valor — a função do banco só devolve isso. Sem a migration, ou sem
  // pacote, o cartão não aparece.
  const { data: pacoteDoCliente } = await supabase.rpc("pacote_do_cliente", { p_project_id: id });
  // Os pacotes que dá pra escolher (migration 0056); null = troca indisponível.
  const pacotesParaEscolher = await pacotesDisponiveis(supabase);

  // Páginas da Wiki do cliente, com as fixadas em destaque (migration 0054).
  // Sem a migration a coluna não existe e a consulta falha: aí vale a lista
  // simples, sem destaque.
  const paginasDoCliente = (colunas: string) =>
    supabase.from("pages").select(colunas).eq("project_id", id).order("updated_at", { ascending: false });
  const comDestaque = await paginasDoCliente("id, title, created_by_label, updated_at, pinned_at");
  // A Wiki do cliente é um bloco de notas: as páginas de detalhamento de
  // tarefa (as que cada tarefa criava) ficam de fora.
  const paginasDeTarefa = new Set((tasks ?? []).map((t) => t.page_id).filter((id): id is string => !!id));
  const pages = (((comDestaque.error
    ? (await paginasDoCliente("id, title, created_by_label, updated_at")).data
    : comDestaque.data) ?? []) as unknown as PaginaResumo[]).filter((p) => !paginasDeTarefa.has(p.id));
  const fixadas = pages
    .filter((p) => p.pinned_at)
    .sort((a, b) => (b.pinned_at ?? "").localeCompare(a.pinned_at ?? ""));
  const naoFixadas = pages.filter((p) => !p.pinned_at);

  const { data: feedback } = await supabase
    .from("project_feedback")
    .select("id, stage_label, rating, comment, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  // Logins do cliente pra área de solicitações — client_logins só é
  // acessível pela service_role (migration 0032).
  let acessosCliente: AcessoCliente[] = [];
  let erroAcessos: string | null = null;
  try {
    const { data, error } = await createAdminClient()
      .from("client_logins")
      .select("id, username, created_at, last_login_at")
      .eq("project_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    acessosCliente = data ?? [];
  } catch {
    erroAcessos =
      "Não deu pra carregar os acessos do cliente. Confere se a migration 0032_client_logins.sql já foi rodada no Supabase.";
  }

  return (
    <Coreografia>
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/projetos"
        data-mov="topo"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
        Clientes
      </Link>

      <div data-mov="topo" className="mb-5 mt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className="h-8 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: corDoCliente(project).fundo }}
            aria-hidden="true"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            {project.name}
          </h1>
          <TipoDeServicoDoCliente
            projectId={id}
            clienteNome={project.name}
            pacoteAtual={(pacoteDoCliente as PacoteDoCliente | null)?.name ?? null}
            pacotes={pacotesParaEscolher}
          />
          <CorDoCliente projectId={id} cor={(project.color as string | null) ?? null} />
          <InstagramDoCliente
            projectId={id}
            contaId={(project.instagram_account_id as string | null) ?? null}
            username={project.instagram_account_id ? (project.instagram_username as string | null) ?? "" : null}
          />
        </div>
        <p className="mt-0.5 text-sm text-ink-muted">
          Quadro de tarefas e Wiki próprios
          {responsaveisDoCliente.length > 0
            ? ` · ${responsaveisDoCliente.length === 1 ? "Responsável" : "Responsáveis"}: ${responsaveisDoCliente.join(", ")}`
            : project.created_by_label && ` · Responsável: ${project.created_by_label}`}
        </p>
      </div>

      {pacoteDoCliente && (
        <div data-mov="card">
          <PacoteDoClienteCard pacote={pacoteDoCliente as PacoteDoCliente} />
        </div>
      )}

      <div data-mov="card">
        <ShareProjectLink projectId={id} shareToken={project.share_token} />
      </div>

      <div data-mov="card">
        <ClientRequestAccess
          projectId={id}
          acessos={acessosCliente}
          semResponsavel={!project.responsible_id}
          erroCarregar={erroAcessos}
        />
      </div>

      <div data-mov="card">
        <ProjectDetailsCard
          projectId={id}
          initialStatus={project.status}
          initialStartDate={project.start_date}
          initialTargetEndDate={project.target_end_date}
          initialInfoConfirmed={project.initial_info_confirmed}
        />
      </div>

      <ProjectTabs
        inicial={searchParams?.aba}
        posts={
          <PostsManager
            projectId={id}
            projectName={project.name}
            currentUserId={user?.id ?? ""}
            currentUserLabel={userLabel}
            souLider={souLider}
            profiles={profiles ?? []}
            postInicial={searchParams?.post}
            novoEm={searchParams?.novo}
            instagramLigado={project.instagram_account_id ? (project.instagram_username as string | null) ?? "" : null}
          />
        }
        tarefas={
          <TaskBoard
            initialTasks={tasks ?? []}
            currentUserLabel={userLabel}
            projectId={id}
            clienteDaPagina={project}
            profiles={profiles ?? []}
            showHeader={false}
          />
        }
        otimizacoes={
          temOtimizacoes ? (
            <OptimizationsManager
              projectId={id}
              currentUserId={user?.id ?? ""}
              currentUserLabel={userLabel}
              souLider={souLider}
              profiles={profiles ?? []}
            />
          ) : undefined
        }
        wiki={
          <div>
            <div className="mb-3 flex items-center justify-end">
              <NewPageButton projectId={id} label="Nova nota" />
            </div>
            {pages.length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface">
                <EmptyState
                  icon={<BookOpenIcon className="h-6 w-6" />}
                  title="Nenhuma nota ainda para este cliente"
                  description="Use como bloco de notas do cliente: combinados, briefing, links e lembretes."
                />
              </div>
            ) : (
              <>
                {fixadas.length > 0 && (
                  <section className="mb-5">
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Em destaque
                    </h2>
                    <div className="divide-y divide-line rounded-2xl border border-brand-forte/30 bg-surface">
                      {fixadas.map((p) => (
                        <PaginaRow key={p.id} pagina={p} fixavel />
                      ))}
                    </div>
                  </section>
                )}
                {naoFixadas.length > 0 && (
                  <section>
                    {fixadas.length > 0 && (
                      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Outras notas
                      </h2>
                    )}
                    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
                      {naoFixadas.map((p) => (
                        <PaginaRow key={p.id} pagina={p} fixavel />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        }
        arquivos={
          <DriveBrowser
            projectId={id}
            currentUserId={user?.id ?? ""}
            currentUserLabel={userLabel}
          />
        }
        faturas={
          <InvoicesManager projectId={id} currentUserLabel={userLabel} />
        }
        mensagens={
          <div>
            <ProjectMessagesManager projectId={id} currentUserLabel={userLabel} />
            <ProjectFeedbackList feedback={feedback ?? []} />
          </div>
        }
        analytics={
          <AnalyticsCliente
            projectId={id}
            projectName={project.name}
            podeVerOtimizacoes={temOtimizacoes}
            analise={{
              // Escreve a "Análise de relatório": liderança e tráfego.
              podeEscrever: souLider || perfil?.faz_otimizacoes === true,
              souLider,
              currentUserId: user?.id ?? "",
              autorRotulo:
                (profiles ?? []).find((p) => p.id === user?.id)?.name || userLabel || "Equipe",
            }}
          />
        }
      />
    </main>
    </Coreografia>
  );
}
