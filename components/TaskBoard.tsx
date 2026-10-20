"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project, Task, TaskStatus } from "@/lib/types";
import { corDoCliente } from "@/lib/task-colors";
import { hhmm, rotuloDeHorario, umDiaSo } from "@/lib/horarios";
import { syncTaskWiki } from "@/lib/task-wiki-sync";
import TaskModal from "./TaskModal";
import TarefasEmLista from "./TarefasEmLista";
import { Avatar } from "./ui/Avatar";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { SearchInput } from "./ui/SearchInput";
import { StatTile } from "./ui/StatTile";
import { carregarResumos, formatarHoras, temConteudo, type ResumoTarefa } from "@/lib/task-resumo";
import { carregarCatalogo, carregarLigacoes, type Etiqueta } from "@/lib/etiquetas";
import { EtiquetaSelo } from "./EtiquetasDaTarefa";
import { carregarSubprojetos, type Subprojeto } from "@/lib/subprojetos";
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  ColumnsIcon,
  FolderIcon,
  PlusIcon,
  RowsIcon,
  SparklesIcon,
  Trash2Icon,
} from "./ui/icons";

const COLUNAS: { key: TaskStatus; label: string; dot: string }[] = [
  { key: "todo", label: "A Fazer", dot: "bg-brand-forte" },
  { key: "doing", label: "Em Andamento", dot: "bg-warning" },
  { key: "dependency", label: "Em Dependência", dot: "bg-orange-500" },
  { key: "approval", label: "Em Aprovação", dot: "bg-cal" },
  { key: "done", label: "Concluído", dot: "bg-success" },
  { key: "cancelled", label: "Cancelada", dot: "bg-slate-400" },
];

// Data de hoje no formato "AAAA-MM-DD" (igual ao due_date), respeitando o
// fuso horário local em vez de UTC.
function hojeISO() {
  return new Date().toLocaleDateString("en-CA");
}

// Subtarefas por tarefa principal: { idDaMae: [subtarefas] }.
type FilhasPorMae = Record<string, Task[]>;

// Põe (ou atualiza) uma subtarefa na lista da mãe dela, tirando-a de onde
// estava antes (ela pode ter mudado de mãe ou deixado de ser subtarefa).
function comFilha(atual: FilhasPorMae, tarefa: Task): FilhasPorMae {
  const sem: FilhasPorMae = {};
  let estava = false;
  for (const [mae, lista] of Object.entries(atual)) {
    const tinha = lista.some((f) => f.id === tarefa.id);
    estava = estava || tinha;
    sem[mae] = tinha ? lista.filter((f) => f.id !== tarefa.id) : lista;
  }
  // Tarefa comum que nunca foi subtarefa: nada muda (evita redesenhar à toa).
  if (!tarefa.parent_id) return estava ? sem : atual;
  const antigas = atual[tarefa.parent_id] ?? [];
  const anterior = antigas.find((f) => f.id === tarefa.id);
  const nova = anterior ? { ...anterior, ...tarefa } : tarefa;
  sem[tarefa.parent_id] = [...(sem[tarefa.parent_id] ?? []), nova].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  return sem;
}

function semFilha(atual: FilhasPorMae, id: string): FilhasPorMae {
  const proximo: FilhasPorMae = {};
  for (const [mae, lista] of Object.entries(atual)) {
    proximo[mae] = lista.some((f) => f.id === id) ? lista.filter((f) => f.id !== id) : lista;
  }
  return proximo;
}

export default function TaskBoard({
  initialTasks,
  currentUserId = null,
  currentUserLabel,
  projectId = null,
  allProjects = false,
  soMinhas = false,
  projects = [],
  clienteDaPagina,
  profiles = [],
  podeMudarDatas = true,
  tarefaInicial = null,
  title,
  subtitle,
  showHeader = true,
}: {
  initialTasks: Task[];
  // Só é usado quando soMinhas=true, pra filtrar o que chega em tempo real.
  currentUserId?: string | null;
  currentUserLabel: string;
  // Quadro de um único projeto (ou "Geral", quando null).
  projectId?: string | null;
  // Quadro principal: mostra tarefas de todos os projetos juntas, cada
  // uma com uma etiqueta indicando de qual projeto ela é.
  allProjects?: boolean;
  // Quadro individual: só mostra as tarefas que eu criei ou que foram
  // atribuídas a mim (usado no quadro principal — dentro de um projeto
  // específico o quadro continua mostrando todo mundo).
  soMinhas?: boolean;
  projects?: Project[];
  // Quadro dentro da página de um cliente: o cliente em questão, só pra pegar a
  // cor e o nome do cartão (a lista "projects" continua vazia aí).
  clienteDaPagina?: Project;
  profiles?: Profile[];
  // Pode mudar o início e a entrega de uma tarefa já criada. Por padrão
  // todo mundo pode; passe false pra travar as datas.
  podeMudarDatas?: boolean;
  // Tarefa pra abrir assim que a tela carrega (link de um aviso do sininho).
  tarefaInicial?: Task | null;
  // Cabeçalho completo (título, resumo em números, busca e filtro) — usado
  // na tela "Minhas tarefas". Dentro de um projeto específico o quadro fica
  // mais enxuto (showHeader=false), já que a página ali tem seu próprio
  // título.
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Onde o cartão arrastado vai cair: na coluna "col", antes do cartão
  // "antesDeId" (null = no fim da coluna). Aparece como uma linha verde.
  const [marcador, setMarcador] = useState<{ col: TaskStatus; antesDeId: string | null } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Task | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  // Etiquetas (migration 0069): o catálogo, o que cada tarefa tem e o filtro.
  const [catalogo, setCatalogo] = useState<Etiqueta[]>([]);
  const [ligacoes, setLigacoes] = useState<Record<string, string[]>>({});
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");
  // Projetos do cliente (migration 0083), só no quadro da página do cliente:
  // o nome no cartão e o filtro ("" = todos, "nenhum" = sem projeto).
  const [subprojetos, setSubprojetos] = useState<Subprojeto[]>([]);
  const [filtroProjeto, setFiltroProjeto] = useState("");
  // Clicar num dos cartões de resumo filtra o quadro por ele (clicar de novo
  // desliga): tarefas abertas, pra hoje, atrasadas ou concluídas.
  const [filtroResumo, setFiltroResumo] = useState<"abertas" | "hoje" | "atrasadas" | "concluidas" | null>(null);
  // Subtarefas de cada tarefa principal (aparecem dentro do cartão da mãe) e
  // quais mães estão com a lista recolhida.
  const [filhas, setFilhas] = useState<FilhasPorMae>({});
  // Quadro (colunas) ou lista; a escolha fica guardada neste navegador.
  const [visao, setVisao] = useState<"quadro" | "lista">("quadro");
  useEffect(() => {
    try {
      if (window.localStorage.getItem("dhub-visao-tarefas") === "lista") setVisao("lista");
    } catch {
      // sem armazenamento: fica no quadro
    }
  }, []);
  function escolherVisao(v: "quadro" | "lista") {
    setVisao(v);
    try {
      window.localStorage.setItem("dhub-visao-tarefas", v);
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
  }
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  // Checklist/comentários/anexos de cada cartão (✅ 2/5 · 💬 3 · 📎 1).
  const [resumos, setResumos] = useState<Record<string, ResumoTarefa>>({});
  const idsDasTarefas = useMemo(() => tasks.map((t) => t.id).sort().join(","), [tasks]);

  useEffect(() => {
    if (!idsDasTarefas) return;
    let ativo = true;
    carregarResumos(supabase, idsDasTarefas.split(",")).then((m) => {
      if (ativo) setResumos(m);
    });
    carregarLigacoes(supabase, idsDasTarefas.split(",")).then((m) => {
      if (ativo) setLigacoes(m);
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsDasTarefas]);

  // As subtarefas vêm numa consulta própria: o quadro individual só traz as
  // tarefas "minhas", mas dentro do cartão da principal aparecem todas.
  const idsDasMaes = useMemo(
    () =>
      tasks
        .filter((t) => !t.parent_id)
        .map((t) => t.id)
        .sort()
        .join(","),
    [tasks]
  );
  useEffect(() => {
    if (!idsDasMaes) return;
    let ativo = true;
    (async () => {
      const ids = idsDasMaes.split(",");
      const todas: Task[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await supabase
          .from("tasks")
          .select("*")
          .in("parent_id", ids.slice(i, i + 100))
          .order("created_at", { ascending: true });
        todas.push(...((data ?? []) as Task[]));
      }
      if (!ativo) return;
      const mapa: FilhasPorMae = {};
      for (const f of todas) (mapa[f.parent_id as string] ??= []).push(f);
      setFilhas(mapa);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsDasMaes]);

  useEffect(() => {
    let ativo = true;
    carregarCatalogo(supabase).then((c) => {
      if (ativo) setCatalogo(c);
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const etiquetaPorId = useMemo(() => new Map(catalogo.map((e) => [e.id, e])), [catalogo]);

  const quadroDoCliente = !allProjects && !!projectId;
  useEffect(() => {
    if (!quadroDoCliente || !projectId) return;
    let ativo = true;
    carregarSubprojetos(supabase, projectId).then(({ lista }) => {
      if (ativo) setSubprojetos(lista);
    });
    const canal = supabase
      .channel(`subprojetos-quadro-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subprojects" }, (payload) => {
        setSubprojetos((atual) => {
          if (payload.eventType === "DELETE") return atual.filter((p) => p.id !== (payload.old as Subprojeto).id);
          const novo = payload.new as Subprojeto;
          if (novo.project_id !== projectId) return atual;
          return atual.some((p) => p.id === novo.id) ? atual.map((p) => (p.id === novo.id ? novo : p)) : [...atual, novo];
        });
      })
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quadroDoCliente, projectId]);
  const subprojetoPorId = useMemo(() => new Map(subprojetos.map((p) => [p.id, p])), [subprojetos]);
  // Se o projeto filtrado sumiu (excluído), volta a mostrar tudo.
  const projetoDoFiltro = filtroProjeto && filtroProjeto !== "nenhum" && !subprojetoPorId.has(filtroProjeto) ? "" : filtroProjeto;

  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects]
  );
  // Cada cliente com a sua cor (cabeçalho e lateral do cartão).
  const clientesPorId = useMemo(
    () => new Map([...projects, ...(clienteDaPagina ? [clienteDaPagina] : [])].map((p) => [p.id, p])),
    [projects, clienteDaPagina]
  );
  // Tipo de serviço (pacote) de cada cliente, quando a página mandou.
  const pacoteById = useMemo(
    () => new Map(projects.flatMap((p) => (p.pacote_nome ? [[p.id, p.pacote_nome] as const] : []))),
    [projects]
  );
  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  function nomeDe(id: string) {
    const p = profileById.get(id);
    return p?.name || p?.username || "?";
  }

  // Se o quadro é individual (soMinhas), só deixa entrar uma tarefa que eu
  // criei ou que foi atribuída a mim.
  function minha(task: Task) {
    if (!soMinhas) return true;
    return (
      task.created_by === currentUserId ||
      (!!currentUserId && task.assigned_to.includes(currentUserId))
    );
  }

  // Mantém o quadro sincronizado em tempo real entre todos que estiverem
  // logados ao mesmo tempo (exige Realtime habilitado na tabela "tasks").
  useEffect(() => {
    const channel = supabase
      .channel(`tasks-realtime-${allProjects ? "all" : projectId ?? "geral"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          // Subtarefas mudam na lista de dentro do cartão da mãe, seja de
          // quem for a subtarefa.
          setFilhas((atual) =>
            payload.eventType === "DELETE"
              ? semFilha(atual, (payload.old as Task).id)
              : comFilha(atual, payload.new as Task)
          );
          setTasks((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Task;
              // Num quadro de projeto único, só entra se for deste mesmo
              // projeto (ou "Geral"). No quadro principal, entra sempre.
              if (!allProjects && (novo.project_id ?? null) !== projectId) {
                return current;
              }
              if (!minha(novo)) return current;
              if (current.some((t) => t.id === novo.id)) return current;
              return [...current, novo];
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as Task;
              if (
                (!allProjects && (atualizado.project_id ?? null) !== projectId) ||
                !minha(atualizado)
              ) {
                // Se a tarefa foi movida pra outro projeto, ou deixou de ser
                // minha (reatribuída pra outra pessoa), ela some do quadro.
                return current.filter((t) => t.id !== atualizado.id);
              }
              const jaEstava = current.some((t) => t.id === atualizado.id);
              if (!jaEstava) return [...current, atualizado];
              return current.map((t) =>
                t.id === atualizado.id ? atualizado : t
              );
            }
            if (payload.eventType === "DELETE") {
              const removidoId = (payload.old as Task).id;
              return current.filter((t) => t.id !== removidoId);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, allProjects, soMinhas, currentUserId]);

  function getNextPosition(status: TaskStatus) {
    const maxPosition = tasks
      .filter((t) => t.status === status)
      .reduce((max, t) => Math.max(max, t.position), 0);
    return maxPosition + 1;
  }

  function abrirCriar() {
    setTarefaEditando(null);
    setModalAberto(true);
  }

  function abrirEditar(task: Task) {
    setTarefaEditando(task);
    setModalAberto(true);
  }

  // Abre a tarefa do link. Cada navegação traz um objeto novo do servidor,
  // então abrir a mesma tarefa de novo (depois de fechar) também funciona.
  const inicialAberta = useRef<Task | null>(null);
  useEffect(() => {
    if (!tarefaInicial || inicialAberta.current === tarefaInicial) return;
    inicialAberta.current = tarefaInicial;
    abrirEditar(tarefaInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaInicial]);

  // Tarefas abertas na mesma sessão do modal (mãe <-> subtarefa): ao fechar,
  // o cartão de todas elas atualiza os indicadores.
  const visitadas = useRef<Set<string>>(new Set());

  function fecharModal() {
    // A pessoa pode ter mexido no checklist/comentários: atualiza o cartão.
    const aberta = tarefaEditando?.id;
    const mae = tarefaEditando?.parent_id;
    setModalAberto(false);
    setTarefaEditando(null);
    // Tira o "?tarefa=" do endereço pra um F5 não reabrir a tarefa.
    if (tarefaInicial && typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (aberta) {
      // Mexeu numa subtarefa: o contador da tarefa principal também muda.
      const ids = new Set<string>([aberta, ...visitadas.current]);
      if (mae) ids.add(mae);
      carregarResumos(supabase, Array.from(ids)).then((m) => setResumos((atual) => ({ ...atual, ...m })));
      carregarLigacoes(supabase, Array.from(ids)).then((m) =>
        setLigacoes((atual) => {
          const proximo = { ...atual };
          for (const id of ids) proximo[id] = m[id] ?? [];
          return proximo;
        })
      );
      carregarCatalogo(supabase).then(setCatalogo);
    }
    visitadas.current = new Set();
  }

  function handleCreated(nova: Task) {
    if (nova.parent_id) setFilhas((atual) => comFilha(atual, nova));
    setTasks((current) =>
      current.some((t) => t.id === nova.id) ? current : [...current, nova]
    );
  }

  function handleUpdated(atualizada: Task) {
    setFilhas((atual) => comFilha(atual, atualizada));
    setTasks((current) =>
      current.map((t) => (t.id === atualizada.id ? atualizada : t))
    );
  }

  function handleDeleted(taskId: string) {
    setFilhas((atual) => semFilha(atual, taskId));
    setTasks((current) => current.filter((t) => t.id !== taskId));
  }

  async function alternarSubtarefa(sub: Task) {
    const status: TaskStatus = sub.status === "done" ? "todo" : "done";
    setFilhas((atual) => comFilha(atual, { ...sub, status }));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", sub.id);
    if (error) {
      setFilhas((atual) => comFilha(atual, sub));
      return;
    }
    if (sub.parent_id) {
      carregarResumos(supabase, [sub.parent_id]).then((m) => setResumos((atual) => ({ ...atual, ...m })));
    }
  }

  async function moveTaskTo(task: Task, novoStatus: TaskStatus) {
    if (task.status === novoStatus) return;

    const maxPosition = tasks
      .filter((t) => t.status === novoStatus)
      .reduce((max, t) => Math.max(max, t.position), 0);

    setTasks((current) =>
      current.map((t) =>
        t.id === task.id
          ? { ...t, status: novoStatus, position: maxPosition + 1 }
          : t
      )
    );

    await supabase
      .from("tasks")
      .update({ status: novoStatus, position: maxPosition + 1 })
      .eq("id", task.id);

    // Arrastar entre colunas também muda o status — se a tarefa tem página
    // na Wiki, o resumo lá precisa acompanhar.
    if (task.page_id) {
      syncTaskWiki(
        supabase,
        { ...task, status: novoStatus, position: maxPosition + 1 },
        profiles,
        projects
      ).catch(() => {
        // Falha silenciosa: a tarefa já mudou de coluna, só o resumo na
        // Wiki que não atualizou dessa vez.
      });
    }
  }

  async function moveTask(task: Task, direction: -1 | 1) {
    const index = COLUNAS.findIndex((c) => c.key === task.status);
    const novoIndex = index + direction;
    if (novoIndex < 0 || novoIndex >= COLUNAS.length) return;
    await moveTaskTo(task, COLUNAS[novoIndex].key);
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    setDraggedId(task.id);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverCol(null);
    setMarcador(null);
  }

  // Sobre o espaço vazio da coluna: vai pro fim dela.
  function handleColumnDragOver(e: React.DragEvent, colKey: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colKey) setDragOverCol(colKey);
    setMarcador((atual) => (atual?.col === colKey && atual.antesDeId === null ? atual : { col: colKey, antesDeId: null }));
  }

  // Sobre um cartão: metade de cima = cai antes dele; metade de baixo = cai
  // depois (ou seja, antes do cartão seguinte).
  function handleCardDragOver(e: React.DragEvent, colKey: TaskStatus, task: Task, daColuna: Task[]) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colKey) setDragOverCol(colKey);
    const caixa = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const emCima = e.clientY < caixa.top + caixa.height / 2;
    let antesDeId: string | null = task.id;
    if (!emCima) {
      const i = daColuna.findIndex((t) => t.id === task.id);
      antesDeId = daColuna[i + 1]?.id ?? null;
    }
    setMarcador((atual) => (atual?.col === colKey && atual.antesDeId === antesDeId ? atual : { col: colKey, antesDeId }));
  }

  function handleColumnDragLeave(colKey: TaskStatus) {
    setDragOverCol((atual) => (atual === colKey ? null : atual));
  }

  async function handleDrop(e: React.DragEvent, colKey: TaskStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedId;
    setDraggedId(null);
    const task = tasks.find((t) => t.id === taskId);
    const alvo = marcador?.col === colKey ? marcador.antesDeId : null;
    setMarcador(null);
    if (!task) return;
    await reposicionar(task, colKey, alvo);
  }

  // Põe a tarefa na coluna "novoStatus", logo antes da tarefa "antesDeId" (null
  // = no fim). Renumera as posições da coluna (1, 2, 3...) e grava só as que
  // mudaram. Serve pra arrastar, pros botões ↑ ↓ e pra trocar de coluna.
  async function reposicionar(task: Task, novoStatus: TaskStatus, antesDeId: string | null) {
    const porPosicao = (a: Task, b: Task) => a.position - b.position;
    const outras = tasks.filter((t) => t.status === novoStatus && t.id !== task.id).sort(porPosicao);
    let indice = antesDeId ? outras.findIndex((t) => t.id === antesDeId) : -1;
    if (indice < 0) indice = outras.length;
    const nova = [...outras.slice(0, indice), { ...task, status: novoStatus }, ...outras.slice(indice)];
    const atuais = new Map(tasks.map((t) => [t.id, t]));
    const mudancas = nova
      .map((t, i) => ({ id: t.id, position: i + 1 }))
      .filter((c) => c.id === task.id ? task.status !== novoStatus || atuais.get(c.id)?.position !== c.position : atuais.get(c.id)?.position !== c.position);
    if (mudancas.length === 0) return;

    const anterior = tasks;
    const posicaoNova = new Map(mudancas.map((c) => [c.id, c.position]));
    setTasks((current) =>
      current.map((t) =>
        t.id === task.id
          ? { ...t, status: novoStatus, position: posicaoNova.get(t.id) ?? t.position }
          : posicaoNova.has(t.id)
          ? { ...t, position: posicaoNova.get(t.id) as number }
          : t
      )
    );

    const resultados = await Promise.all(
      mudancas.map((c) =>
        supabase
          .from("tasks")
          .update(c.id === task.id ? { status: novoStatus, position: c.position } : { position: c.position })
          .eq("id", c.id)
      )
    );
    if (resultados.some((r) => r.error)) {
      // Não salvou tudo: volta pro que estava, em vez de mostrar uma ordem que não existe.
      setTasks(anterior);
      return;
    }

    // Trocar de coluna também muda o status: o resumo da página na Wiki acompanha.
    if (task.status !== novoStatus && task.page_id) {
      syncTaskWiki(supabase, { ...task, status: novoStatus, position: posicaoNova.get(task.id) ?? task.position }, profiles, projects).catch(
        () => {
          // Falha silenciosa: a tarefa já mudou de lugar, só o resumo da Wiki não atualizou.
        }
      );
    }
  }

  async function deleteTask(task: Task) {
    const confirmado = window.confirm(
      `Tem certeza que quer excluir a tarefa "${task.title}"? Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    setTasks((current) => current.filter((t) => t.id !== task.id));
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  const hoje = hojeISO();

  // Resumo em números — sempre reflete todas as tarefas do quadro, mesmo
  // que a busca/filtro abaixo esteja escondendo algumas nas colunas.
  const resumo = useMemo(() => {
    const abertas = tasks.filter(
      (t) =>
        t.status === "todo" || t.status === "doing" || t.status === "dependency" || t.status === "approval"
    ).length;
    const paraHoje = tasks.filter(
      (t) =>
        t.due_date === hoje && t.status !== "done" && t.status !== "cancelled"
    ).length;
    const atrasadas = tasks.filter(
      (t) =>
        !!t.due_date &&
        t.due_date < hoje &&
        t.status !== "done" &&
        t.status !== "cancelled"
    ).length;
    const concluidas = tasks.filter((t) => t.status === "done").length;
    return { abertas, paraHoje, atrasadas, concluidas };
  }, [tasks, hoje]);

  // Quem já foi responsável por alguma tarefa aqui — usado pra montar o
  // filtro, em vez de listar todo mundo do sistema.
  const responsaveisNoQuadro = useMemo(() => {
    const ids = new Set(tasks.flatMap((t) => t.assigned_to));
    return Array.from(ids)
      .map((id) => profileById.get(id))
      .filter((p): p is Profile => !!p)
      .sort((a, b) => (a.name || a.username || "").localeCompare(b.name || b.username || ""));
  }, [tasks, profileById]);

  const tasksVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const passa = (t: Task) => {
      if (termo && !t.title.toLowerCase().includes(termo)) return false;
      if (filtroResponsavel && !t.assigned_to.includes(filtroResponsavel)) {
        return false;
      }
      if (filtroEtiqueta && !(ligacoes[t.id] ?? []).includes(filtroEtiqueta)) {
        return false;
      }
      if (projetoDoFiltro === "nenhum" ? !!t.subproject_id && subprojetoPorId.has(t.subproject_id) : projetoDoFiltro && t.subproject_id !== projetoDoFiltro) {
        return false;
      }
      if (filtroResumo) {
        const emAberto = t.status !== "done" && t.status !== "cancelled";
        if (filtroResumo === "abertas" && !emAberto) return false;
        if (filtroResumo === "hoje" && !(emAberto && t.due_date === hoje)) return false;
        if (filtroResumo === "atrasadas" && !(emAberto && !!t.due_date && t.due_date < hoje)) return false;
        if (filtroResumo === "concluidas" && t.status !== "done") return false;
      }
      return true;
    };
    // Subtarefa aparece dentro do cartão da principal, não solta na coluna.
    // Só fica solta quando a principal não está no quadro (é de outra pessoa)
    // ou não passa pelo filtro/busca atual.
    const principaisNaTela = new Set(tasks.filter((t) => !t.parent_id && passa(t)).map((t) => t.id));
    return tasks.filter((t) => passa(t) && (!t.parent_id || !principaisNaTela.has(t.parent_id)));
  }, [tasks, busca, filtroResponsavel, filtroEtiqueta, filtroResumo, hoje, ligacoes, projetoDoFiltro, subprojetoPorId]);

  return (
    <div>
      {showHeader ? (
        <>
          <PageHeader
            icon={<ClipboardListIcon className="h-8 w-8" />}
            title={title ?? "Minhas tarefas"}
            subtitle={
              subtitle ?? "Organize seu dia e acompanhe o que precisa ser feito."
            }
            actions={
              <>
                <SearchInput
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar tarefas..."
                  className="w-full sm:w-56"
                />
                <select
                  value={filtroResponsavel}
                  onChange={(e) => setFiltroResponsavel(e.target.value)}
                  className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                >
                  <option value="">Todos os responsáveis</option>
                  {responsaveisNoQuadro.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.username}
                    </option>
                  ))}
                </select>
                {catalogo.length > 0 && (
                  <select
                    value={filtroEtiqueta}
                    onChange={(e) => setFiltroEtiqueta(e.target.value)}
                    aria-label="Filtrar por etiqueta"
                    className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                  >
                    <option value="">Todas as etiquetas</option>
                    {catalogo.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                )}
                <SeletorDeVisao visao={visao} aoTrocar={escolherVisao} />
                <Button onClick={abrirCriar}>
                  <PlusIcon className="h-4 w-4" />
                  Nova tarefa
                </Button>
              </>
            }
          />

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={<ClipboardListIcon className="h-4 w-4" />}
              value={resumo.abertas}
              label="Tarefas abertas"
              tone="brand"
              ativo={filtroResumo === "abertas"}
              onClick={() => setFiltroResumo((a) => (a === "abertas" ? null : "abertas"))}
            />
            <StatTile
              icon={<CalendarIcon className="h-4 w-4" />}
              value={resumo.paraHoje}
              label="Para hoje"
              tone="warning"
              ativo={filtroResumo === "hoje"}
              onClick={() => setFiltroResumo((a) => (a === "hoje" ? null : "hoje"))}
            />
            <StatTile
              icon={<AlertTriangleIcon className="h-4 w-4" />}
              value={resumo.atrasadas}
              label="Atrasadas"
              tone="danger"
              ativo={filtroResumo === "atrasadas"}
              onClick={() => setFiltroResumo((a) => (a === "atrasadas" ? null : "atrasadas"))}
            />
            <StatTile
              icon={<CheckCircleIcon className="h-4 w-4" />}
              value={resumo.concluidas}
              label="Concluídas"
              tone="success"
              ativo={filtroResumo === "concluidas"}
              onClick={() => setFiltroResumo((a) => (a === "concluidas" ? null : "concluidas"))}
            />
          </div>
          {filtroResumo && (
            <p className="-mt-2 mb-4 flex items-center gap-2 text-xs text-ink-muted">
              Mostrando só:{" "}
              <b className="text-ink">
                {{ abertas: "tarefas abertas", hoje: "para hoje", atrasadas: "atrasadas", concluidas: "concluídas" }[filtroResumo]}
              </b>
              <button type="button" onClick={() => setFiltroResumo(null)} className="font-medium text-brand-forte hover:underline">
                Mostrar tudo
              </button>
            </p>
          )}
        </>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={abrirCriar}>
            <PlusIcon className="h-3.5 w-3.5" />
            Nova tarefa
          </Button>
          <SeletorDeVisao visao={visao} aoTrocar={escolherVisao} />
          {subprojetos.length > 0 && (
            <select
              value={projetoDoFiltro}
              onChange={(e) => setFiltroProjeto(e.target.value)}
              aria-label="Filtrar por projeto"
              className="h-8 max-w-[220px] rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            >
              <option value="">Todos os projetos</option>
              {subprojetos.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
              <option value="nenhum">Sem projeto</option>
            </select>
          )}
        </div>
      )}

      {visao === "lista" && (
        <TarefasEmLista
          colunas={COLUNAS}
          tarefas={tasksVisiveis}
          corDoCliente={(t) => corDoCliente(t.project_id ? clientesPorId.get(t.project_id) : null).fundo}
          filhas={filhas}
          hoje={hoje}
          mostrarCliente={allProjects}
          nomesDosProjetos={projectsById}
          pacotes={pacoteById}
          perfis={profileById}
          ligacoes={ligacoes}
          etiquetas={etiquetaPorId}
          resumos={resumos}
          filtrando={!!(busca || filtroResponsavel || filtroEtiqueta || filtroResumo || projetoDoFiltro)}
          aoAbrir={abrirEditar}
          aoMudarStatus={moveTaskTo}
          aoAlternarSubtarefa={alternarSubtarefa}
          aoExcluir={deleteTask}
        />
      )}

      {visao === "quadro" && (
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:snap-none sm:px-0 xl:grid xl:grid-cols-6 xl:overflow-visible">
        {COLUNAS.map((coluna) => {
          // Na ordem das posições (a que a pessoa arrumou).
          const tarefasDaColuna = tasksVisiveis
            .filter((t) => t.status === coluna.key)
            .sort((a, b) => a.position - b.position);
          return (
            <div
              key={coluna.key}
              onDragOver={(e) => handleColumnDragOver(e, coluna.key)}
              onDragLeave={() => handleColumnDragLeave(coluna.key)}
              onDrop={(e) => handleDrop(e, coluna.key)}
              data-mov="card"
              className={`w-[85%] flex-shrink-0 snap-start rounded-2xl p-1.5 transition-colors sm:w-auto sm:min-w-[270px] xl:min-w-0 ${
                dragOverCol === coluna.key ? "bg-brand/5 ring-2 ring-brand/30" : ""
              }`}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${coluna.dot}`} />
                <h2 className="text-sm font-semibold text-ink">{coluna.label}</h2>
                <span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                  {tarefasDaColuna.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {tarefasDaColuna.map((task, indice) => {
                  const marcaAntes = marcador?.col === coluna.key && marcador.antesDeId === task.id && draggedId !== task.id;
                  const marcaFim =
                    marcador?.col === coluna.key &&
                    marcador.antesDeId === null &&
                    indice === tarefasDaColuna.length - 1 &&
                    draggedId !== task.id;
                  const atrasada =
                    !!task.due_date &&
                    task.due_date < hoje &&
                    task.status !== "done" &&
                    task.status !== "cancelled";
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleCardDragOver(e, coluna.key, task, tarefasDaColuna)}
                      onClick={() => abrirEditar(task)}
                      data-mov="bloco"
                      className={`group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-surface pl-1.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                        draggedId === task.id
                          ? "opacity-40"
                          : task.status === "done"
                          ? // Concluída: cinza e apagada (volta ao normal com o mouse em cima).
                            "opacity-60 grayscale hover:opacity-90"
                          : ""
                      } ${
                        marcaAntes
                          ? "before:pointer-events-none before:absolute before:-top-[7px] before:inset-x-0 before:h-1 before:rounded-full before:bg-brand before:content-['']"
                          : ""
                      } ${
                        marcaFim
                          ? "after:pointer-events-none after:absolute after:-bottom-[7px] after:inset-x-0 after:h-1 after:rounded-full after:bg-brand after:content-['']"
                          : ""
                      }`}
                    >
                      {/* Faixa lateral na cor do cliente, por cima da borda. */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1.5"
                        style={{ backgroundColor: corDoCliente(task.project_id ? clientesPorId.get(task.project_id) : null).fundo }}
                      />
                      {/* Cabeçalho na cor do cliente: nome, tipo de serviço e excluir. */}
                      <div
                        className="flex items-center justify-between gap-2 px-3.5 py-2"
                        style={{
                          backgroundColor: corDoCliente(task.project_id ? clientesPorId.get(task.project_id) : null).fundo,
                          color: corDoCliente(task.project_id ? clientesPorId.get(task.project_id) : null).texto,
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide">
                          {task.project_id ? (
                            <Link
                              href={`/projetos/${task.project_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {clientesPorId.get(task.project_id)?.name ?? "Cliente"}
                              {pacoteById.get(task.project_id) && (
                                <span className="font-medium normal-case opacity-80"> · {pacoteById.get(task.project_id)}</span>
                              )}
                            </Link>
                          ) : (
                            "Sem cliente"
                          )}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task);
                          }}
                          title="Excluir tarefa"
                          className="flex-shrink-0 opacity-70 transition-opacity hover:opacity-100"
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="p-3.5">
                      <p className="text-[15px] font-medium leading-snug text-ink">{task.title}</p>

                      {(task.due_date || task.assigned_to.length > 0) && (
                        <div className="mt-3 flex items-start justify-between gap-3">
                          {task.due_date ? (
                            <span
                              className={`flex min-w-0 items-start gap-1.5 text-xs ${
                                atrasada ? "font-medium text-danger" : "text-ink-muted"
                              }`}
                            >
                              <CalendarIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                              <span>
                                {!umDiaSo(task)
                                  ? `${task.start_date!.split("-").reverse().slice(0, 2).join("/")}${
                                      task.start_time ? ` ${hhmm(task.start_time)}` : ""
                                    } → `
                                  : ""}
                                {task.due_date.split("-").reverse().join("/")}
                                {(() => {
                                  const hora = umDiaSo(task) ? rotuloDeHorario(task) : hhmm(task.due_time);
                                  return hora ? ` ${hora}` : "";
                                })()}
                              </span>
                            </span>
                          ) : (
                            <span />
                          )}
                          {task.assigned_to.length > 0 && (
                            <div className="flex flex-shrink-0 -space-x-2">
                              {task.assigned_to.slice(0, 3).map((id) => (
                                <Avatar
                                  key={id}
                                  name={nomeDe(id)}
                                  src={profileById.get(id)?.avatar_url}
                                  size="md"
                                  className="ring-2 ring-surface"
                                />
                              ))}
                              {task.assigned_to.length > 3 && (
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-hover text-[11px] font-semibold text-ink-muted ring-2 ring-surface">
                                  +{task.assigned_to.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {task.created_by_label && (
                        <p className="mt-2 truncate text-xs text-ink-muted">por {task.created_by_label}</p>
                      )}

                      {(ligacoes[task.id] ?? []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(ligacoes[task.id] ?? []).flatMap((id) => {
                            const et = etiquetaPorId.get(id);
                            return et ? [<EtiquetaSelo key={id} etiqueta={et} />] : [];
                          })}
                        </div>
                      )}

                      {task.subproject_id && subprojetoPorId.get(task.subproject_id) && (
                        <p className="mt-2 flex items-center gap-1 truncate text-[11px] font-medium text-ink-muted">
                          <FolderIcon className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{subprojetoPorId.get(task.subproject_id)?.name}</span>
                        </p>
                      )}

                      {task.parent_id && (
                        <p className="mt-2 truncate text-[11px] font-medium text-brand-forte">
                          ↳ Subtarefa
                          {tasks.find((t) => t.id === task.parent_id)
                            ? ` de ${tasks.find((t) => t.id === task.parent_id)?.title}`
                            : ""}
                        </p>
                      )}

                      {temConteudo(resumos[task.id]) && (
                        <IndicadoresTarefa resumo={resumos[task.id]} />
                      )}

                      {(filhas[task.id] ?? []).length > 0 && (
                        <SubtarefasNoCartao
                          subtarefas={filhas[task.id]}
                          hoje={hoje}
                          perfis={profileById}
                          recolhida={recolhidas.has(task.id)}
                          aoRecolher={() =>
                            setRecolhidas((atual) => {
                              const novo = new Set(atual);
                              if (novo.has(task.id)) novo.delete(task.id);
                              else novo.add(task.id);
                              return novo;
                            })
                          }
                          aoAbrir={abrirEditar}
                          aoAlternar={alternarSubtarefa}
                        />
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTask(task, -1);
                            }}
                            disabled={coluna.key === COLUNAS[0].key}
                            title="Mover para a coluna anterior"
                            className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                          >
                            <ChevronLeftIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTask(task, 1);
                            }}
                            disabled={coluna.key === COLUNAS[COLUNAS.length - 1].key}
                            title="Mover para a próxima coluna"
                            className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                          >
                            <ChevronRightIcon className="h-3.5 w-3.5" />
                          </button>
                          <span className="mx-0.5 h-3.5 w-px bg-line" aria-hidden="true" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reposicionar(task, coluna.key, tarefasDaColuna[indice - 1]?.id ?? null);
                            }}
                            disabled={indice === 0}
                            title="Subir na coluna"
                            aria-label="Subir na coluna"
                            className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                          >
                            <ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Desce uma posição: cai antes do cartão que vem DEPOIS do seguinte.
                              reposicionar(task, coluna.key, tarefasDaColuna[indice + 2]?.id ?? null);
                            }}
                            disabled={indice === tarefasDaColuna.length - 1}
                            title="Descer na coluna"
                            aria-label="Descer na coluna"
                            className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                          >
                            <ChevronDownIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}

                {tarefasDaColuna.length === 0 && (
                  <EmptyState
                    icon={<SparklesIcon className="h-4 w-4" />}
                    title={
                      busca || filtroResponsavel || filtroEtiqueta || filtroResumo || projetoDoFiltro
                        ? "Nada por aqui"
                        : "Tudo limpo por aqui"
                    }
                    description={
                      busca || filtroResponsavel || filtroEtiqueta || filtroResumo || projetoDoFiltro
                        ? "Nenhuma tarefa bate com o filtro atual."
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {showHeader && tasks.length === 0 && (
        <div className="mt-5 flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface px-6 py-7 text-center">
          <SparklesIcon className="h-5 w-5 text-brand-forte" />
          <p className="text-sm font-medium text-ink">Seu dia está livre ✨</p>
          <p className="text-xs text-ink-muted">
            Crie uma tarefa para começar a organizar seu trabalho.
          </p>
          <Button size="sm" variant="secondary" onClick={abrirCriar} className="mt-1.5">
            <PlusIcon className="h-3.5 w-3.5" />
            Criar tarefa
          </Button>
        </div>
      )}

      {modalAberto && (
        <TaskModal
          key={tarefaEditando?.id ?? "nova"}
          task={tarefaEditando}
          onAbrirOutra={(t) => {
            if (tarefaEditando) visitadas.current.add(tarefaEditando.id);
            abrirEditar(t);
          }}
          projectId={projectId}
          projects={projects}
          profiles={profiles}
          currentUserLabel={currentUserLabel}
          getNextPosition={getNextPosition}
          podeMudarDatas={podeMudarDatas}
          onClose={fecharModal}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

// Alterna entre o quadro (colunas) e a lista de tarefas.
function SeletorDeVisao({ visao, aoTrocar }: { visao: "quadro" | "lista"; aoTrocar: (v: "quadro" | "lista") => void }) {
  return (
    <div className="flex h-10 items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="Visualização">
      {(
        [
          ["quadro", "Quadro", ColumnsIcon],
          ["lista", "Lista", RowsIcon],
        ] as const
      ).map(([valor, rotulo, Icone]) => (
        <button
          key={valor}
          type="button"
          onClick={() => aoTrocar(valor)}
          aria-pressed={visao === valor}
          className={`flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
            visao === valor ? "bg-brand/10 text-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Icone className="h-4 w-4" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}

// As subtarefas dentro do cartão da tarefa principal: uma linha por subtarefa
// (concluir, abrir, responsáveis e prazo), com a lista recolhível. Clicar numa
// linha abre a subtarefa inteira; o resto do cartão continua abrindo a
// principal.
function SubtarefasNoCartao({
  subtarefas,
  hoje,
  perfis,
  recolhida,
  aoRecolher,
  aoAbrir,
  aoAlternar,
}: {
  subtarefas: Task[];
  hoje: string;
  perfis: Map<string, Profile>;
  recolhida: boolean;
  aoRecolher: () => void;
  aoAbrir: (t: Task) => void;
  aoAlternar: (t: Task) => void;
}) {
  const ativas = subtarefas.filter((s) => s.status !== "cancelled");
  const feitas = ativas.filter((s) => s.status === "done").length;
  const MAX = 6;
  const [verTodas, setVerTodas] = useState(false);
  const mostradas = verTodas ? ativas : ativas.slice(0, MAX);
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-2.5 rounded-lg border border-line bg-canvas/60 p-1.5"
    >
      <button
        type="button"
        onClick={aoRecolher}
        aria-expanded={!recolhida}
        className="flex w-full items-center justify-between gap-2 px-1 py-0.5 text-left text-[11px] font-medium text-ink-muted hover:text-ink"
      >
        <span>
          🧩 Subtarefas · {feitas}/{ativas.length}
        </span>
        <ChevronDownIcon className={`h-3 w-3 transition-transform ${recolhida ? "-rotate-90" : ""}`} />
      </button>
      {!recolhida && (
        <ul className="mt-1 space-y-0.5">
          {mostradas.map((s) => {
            const feita = s.status === "done";
            const atrasada = !!s.due_date && s.due_date < hoje && !feita;
            return (
              <li key={s.id} className={`rounded-md px-1 py-1 hover:bg-surface-hover ${feita ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-1.5">
                  <input
                    type="checkbox"
                    checked={feita}
                    onChange={() => aoAlternar(s)}
                    aria-label={feita ? "Reabrir subtarefa" : "Concluir subtarefa"}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => aoAbrir(s)}
                    title="Abrir a subtarefa"
                    className={`min-w-0 flex-1 text-left text-xs leading-snug ${
                      feita ? "text-ink-muted line-through" : "text-ink"
                    }`}
                  >
                    {s.title}
                  </button>
                </div>
                {(s.due_date || s.assigned_to.length > 0 || (s.status !== "todo" && s.status !== "done")) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-[22px] text-[10px] text-ink-muted">
                    {s.status !== "todo" && s.status !== "done" && (
                      <span>{COLUNAS.find((c) => c.key === s.status)?.label ?? ""}</span>
                    )}
                    {s.due_date && (
                      <span className={atrasada ? "font-medium text-danger" : ""}>
                        {s.due_date.split("-").reverse().slice(0, 2).join("/")}
                      </span>
                    )}
                    {s.assigned_to.length > 0 && (
                      <span className="flex -space-x-1">
                        {s.assigned_to.slice(0, 3).map((id) => (
                          <Avatar
                            key={id}
                            name={perfis.get(id)?.name || perfis.get(id)?.username || "?"}
                            src={perfis.get(id)?.avatar_url}
                            size="xs"
                            className="ring-1 ring-surface"
                          />
                        ))}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {ativas.length > MAX && (
            <li>
              <button
                type="button"
                onClick={() => setVerTodas((v) => !v)}
                className="px-1 text-[10px] font-medium text-brand-forte hover:underline"
              >
                {verTodas ? "Mostrar menos" : `+${ativas.length - MAX} mais`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// Linha do cartão que avisa o que a tarefa tem além da descrição.
function IndicadoresTarefa({ resumo }: { resumo: ResumoTarefa }) {
  const completo = resumo.checklistTotal > 0 && resumo.checklistFeitos === resumo.checklistTotal;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
      {resumo.checklistTotal > 0 && (
        <span
          title="Checklist"
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${
            completo ? "bg-success-light font-medium text-success" : "bg-surface-hover"
          }`}
        >
          ✅ {resumo.checklistFeitos}/{resumo.checklistTotal}
        </span>
      )}
      {resumo.subtarefasTotal > 0 && (
        <span
          title="Subtarefas"
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${
            resumo.subtarefasFeitas === resumo.subtarefasTotal
              ? "bg-success-light font-medium text-success"
              : "bg-surface-hover"
          }`}
        >
          🧩 {resumo.subtarefasFeitas}/{resumo.subtarefasTotal}
        </span>
      )}
      {resumo.comentarios > 0 && (
        <span title="Comentários" className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-1.5 py-0.5">
          💬 {resumo.comentarios}
        </span>
      )}
      {resumo.anexos > 0 && (
        <span title="Anexos" className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-1.5 py-0.5">
          📎 {resumo.anexos}
        </span>
      )}
      {resumo.horas > 0 && (
        <span title="Horas registradas" className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-1.5 py-0.5">
          ⏱️ {formatarHoras(resumo.horas)}
        </span>
      )}
    </div>
  );
}
