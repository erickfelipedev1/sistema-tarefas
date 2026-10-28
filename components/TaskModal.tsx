"use client";

import { linkDoArquivo } from "@/lib/arquivos";
import { CopyIcon, DownloadIcon } from "@/components/ui/icons";
import { TextoComLinks } from "@/components/ui/TextoComLinks";
import EditorDeTexto from "@/components/EditorDeTexto";
import { erroDeHorario } from "@/lib/horarios";
import { LIMITE_DO_HTML, htmlParaTexto, idsDeMencoes, sanitizarHtml, textoParaHtml } from "@/lib/texto-rico";
import { nomeSeguro } from "@/lib/nome-arquivo";
import { embedDoAnexo, idDoDriveDoAnexo, linkDoAnexo, linkParaBaixarAnexo, miniaturaDoAnexoNoDrive, PREFIXO_DO_DRIVE } from "@/lib/anexos";
import { enviarAnexoParaODrive, LIMITE_DO_SUPABASE } from "@/lib/drive-upload";
import { descartarAnexoDoDrive } from "@/lib/actions/drive";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  ChecklistItem,
  Profile,
  Project,
  RepeatRule,
  Task,
  TaskAttachment,
  TaskComment,
  TaskStatus,
} from "@/lib/types";
import { STATUS_OPTIONS, REPEAT_OPTIONS } from "@/lib/task-options";
import {
  syncTaskWiki,
  syncChecklistWiki,
  syncAnexosWiki,
  syncComentariosWiki,
} from "@/lib/task-wiki-sync";
import { carregarResumos, resumoVazio, type ResumoTarefa } from "@/lib/task-resumo";
import { avisarMencao, avisarMencaoNaDescricao, avisarTarefaAtribuida } from "@/lib/actions/push";
import PostDaTarefa from "./posts/PostDaTarefa";
import StatusDaPostagemPicker from "./posts/StatusDaPostagemPicker";
import VisualizadorDeArquivos, { tipoDoArquivoPeloNome } from "./VisualizadorDeArquivos";
import BaixarTodosOsAnexos from "./BaixarTodosOsAnexos";
import MencaoInput from "./MencaoInput";
import SubtarefasTab from "./SubtarefasTab";
import EtiquetasDaTarefa from "./EtiquetasDaTarefa";
import ClientesExtrasDaTarefa from "./ClientesExtrasDaTarefa";
import { idsMencionados, MENCAO_TODOS, nomeParaMencao, partirPorMencoes, pessoaAtiva } from "@/lib/mencoes";
import { carregarSubprojetos, type Subprojeto } from "@/lib/subprojetos";

type Aba = "detalhes" | "checklist" | "subtarefas" | "anexos" | "comentarios";

const ABAS: { key: Aba; label: string; icone: string }[] = [
  { key: "detalhes", label: "Detalhes", icone: "📋" },
  { key: "checklist", label: "Checklist", icone: "✅" },
  { key: "subtarefas", label: "Subtarefas", icone: "🧩" },
  { key: "anexos", label: "Anexos", icone: "📎" },
  { key: "comentarios", label: "Comentários", icone: "💬" },
];

export default function TaskModal({
  task,
  projectId,
  projects,
  profiles,
  currentUserLabel,
  getNextPosition,
  initialDueDate,
  initialDueTime,
  initialSubprojectId,
  podeMudarDatas = true,
  onAbrirOutra,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  task: Task | null;
  projectId: string | null;
  projects: Project[];
  profiles: Profile[];
  currentUserLabel: string;
  getNextPosition: (status: TaskStatus) => number;
  // Pré-preenche o prazo ao criar (ex: clicou num dia específico do
  // calendário). Ignorado quando já existe uma tarefa (edição).
  initialDueDate?: string | null;
  // Idem pro horário ("HH:MM") — ex: clicou num horário na visão Semana/Dia.
  initialDueTime?: string | null;
  // Idem pro projeto do cliente (criando de dentro de um projeto, aba "Projetos").
  initialSubprojectId?: string | null;
  // Por padrão qualquer pessoa muda o início e a entrega de uma tarefa já
  // criada; passe false pra deixar as datas só pra leitura.
  podeMudarDatas?: boolean;
  // Abre outra tarefa no lugar desta (da subtarefa pra principal e vice-versa).
  onAbrirOutra?: (task: Task) => void;
  onClose: () => void;
  onCreated: (task: Task) => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}) {
  const supabase = createClient();
  const [current, setCurrent] = useState<Task | null>(task);
  const [aba, setAba] = useState<Aba>("detalhes");
  // Tela larga (computador): "Comentários" abre ao lado dos detalhes, pra
  // anotar enquanto lê a descrição. Em tela estreita continua trocando de aba.
  const [larga, setLarga] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    const consulta = window.matchMedia("(min-width: 1024px)");
    const aoMudar = () => setLarga(consulta.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  // A descrição formatada (HTML limpo do editor); vazio = só texto simples.
  const [descriptionHtml, setDescriptionHtml] = useState(task?.description_html ?? "");
  // Quem foi mencionado (@nome) na descrição (só conta quem está na equipe).
  const [mencoesDaDescricao, setMencoesDaDescricao] = useState<string[]>(task?.description_mentions ?? []);
  const idsDaEquipe = new Set(profiles.map((p) => p.id));
  // Descrição salva aparece como texto (com links clicáveis); clicar fora de
  // um link abre a edição.
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  // Período: tarefa nova começa hoje (ou no dia escolhido no calendário, se
  // for antes de hoje) e termina na entrega.
  const hojeLocal = new Date().toLocaleDateString("en-CA");
  const [startDate, setStartDate] = useState(
    task ? task.start_date ?? "" : initialDueDate && initialDueDate < hojeLocal ? initialDueDate : hojeLocal
  );
  const [dueDate, setDueDate] = useState(task?.due_date ?? initialDueDate ?? "");
  const [startTime, setStartTime] = useState(task?.start_time?.slice(0, 5) ?? "");
  const [dueTime, setDueTime] = useState(task?.due_time?.slice(0, 5) ?? initialDueTime ?? "");
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(
    task?.repeat_rule ?? "none"
  );
  const [assignedTo, setAssignedTo] = useState<string[]>(
    task?.assigned_to ?? []
  );
  const [color, setColor] = useState(task?.color ?? "gray");
  // Geral (padrão) ou Postagem: na postagem, a copy e o post ficam em Detalhes.
  const [tipo, setTipo] = useState<"geral" | "postagem">(task?.tipo ?? "geral");
  const [taskProjectId, setTaskProjectId] = useState(
    task?.project_id ?? projectId ?? ""
  );
  // Projeto do cliente (migration 0083): só existe pra tarefa de cliente.
  const [subprojetoId, setSubprojetoId] = useState(task?.subproject_id ?? initialSubprojectId ?? "");
  const [subprojetos, setSubprojetos] = useState<Subprojeto[]>([]);
  useEffect(() => {
    let ativo = true;
    setSubprojetos([]);
    if (!taskProjectId) return;
    carregarSubprojetos(supabase, taskProjectId).then(({ lista }) => {
      if (ativo) setSubprojetos(lista);
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskProjectId]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Quanto tem em cada aba (checklist, comentários...) — aparece no menu.
  const [resumo, setResumo] = useState<ResumoTarefa>(resumoVazio());

  const isNovo = !current;
  // Tarefa já criada + quem não é da liderança: início e entrega só pra ler.
  const datasTravadas = !isNovo && !podeMudarDatas;

  // O que aparece ao lado de cada item do menu: contagem, ou "✓" na aba
  // Copywrite quando já tem texto.
  function contadorDoMenu(key: Aba): string | null {
    return contadorDaAba(key, resumo);
  }

  // Recarrega ao abrir e a cada troca de aba (a pessoa pode ter mexido
  // no checklist/comentários na aba anterior).
  useEffect(() => {
    if (!current) return;
    carregarResumos(supabase, [current.id]).then((m) => setResumo(m[current.id] ?? resumoVazio()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, aba]);

  // Impede o scroll da página por trás enquanto o modal está aberto.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // A tarefa nasce assim que a pessoa dá o nome (ao sair do campo, no Enter
  // ou depois de uma pausa digitando); o resto vai salvando sozinho depois.
  const criandoRef = useRef(false);
  // Uma criação por vez: o botão Salvar e o "sair do campo" podem disparar juntos,
  // e quem chegou depois espera a mesma criação em vez de ser ignorado.
  const criacaoRef = useRef<Promise<boolean> | null>(null);
  function criar(): Promise<boolean> {
    if (!criacaoRef.current) {
      criacaoRef.current = criarTarefa().finally(() => {
        criacaoRef.current = null;
      });
    }
    return criacaoRef.current;
  }
  // Devolve se a tarefa existe depois da chamada (criada agora ou já criada).
  async function criarTarefa(): Promise<boolean> {
    if (!title.trim()) {
      setErro("Dá um nome pra tarefa antes de criar.");
      return false;
    }
    if (criandoRef.current || current) return !!current;
    // Sem período escolhido: começa e entrega hoje (dá pra mudar depois).
    const inicio = startDate || hojeLocal;
    const entrega = dueDate || (inicio > hojeLocal ? inicio : hojeLocal);
    if (inicio > entrega) {
      setErro("O início não pode ser depois da entrega.");
      return false;
    }
    const erroHora = erroDeHorario(inicio, entrega, startTime, dueTime);
    if (erroHora) {
      setErro(erroHora);
      return false;
    }
    if (descriptionHtml.length > LIMITE_DO_HTML) {
      setErro("A descrição está grande demais pra salvar. Encurte um pouco o texto.");
      return false;
    }
    criandoRef.current = true;
    setStartDate(inicio);
    setDueDate(entrega);
    setSaving(true);
    setErro(null);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        ...(descriptionHtml ? { description_html: descriptionHtml } : {}),
        ...(mencoesDaDescricao.length > 0 ? { description_mentions: mencoesDaDescricao } : {}),
        status,
        position: getNextPosition(status),
        start_date: inicio,
        due_date: entrega,
        ...(startTime ? { start_time: startTime } : {}),
        due_time: dueTime || null,
        repeat_rule: repeatRule,
        color,
        project_id: taskProjectId || null,
        ...(taskProjectId && subprojetoId ? { subproject_id: subprojetoId } : {}),
        ...(tipo !== "geral" ? { tipo } : {}),
        assigned_to: assignedTo,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();

    setSaving(false);
    if (error || !data) {
      criandoRef.current = false;
      setErro(
        error?.message.includes("start_date")
          ? "Pra criar tarefa com período, rode a migration 0040_tarefa_periodo.sql no Supabase."
          : `Não deu pra criar a tarefa: ${error?.message ?? "erro desconhecido"}`
      );
      return false;
    }

    // A tarefa não cria mais página de detalhamento na Wiki: a Wiki do
    // cliente é um bloco de notas (as páginas antigas continuam existindo).
    const tarefaFinal = data as Task;

    setCurrent(tarefaFinal);
    onCreated(tarefaFinal);
    // Notificação no celular dos responsáveis (menos quem criou).
    avisarTarefaAtribuida(tarefaFinal.id).catch(() => {});
    if (mencoesDaDescricao.length > 0) avisarMencaoNaDescricao(tarefaFinal.id).catch(() => {});
    return true;
  }

  // Botão Salvar, no alto: cria a tarefa (se ainda não foi criada) e fecha. O resto
  // já salva sozinho ao sair de cada campo; clicar aqui tira o foco do campo antes.
  async function salvarEFechar() {
    if (isNovo && !(await criar())) return;
    onClose();
  }

  // Troca o projeto do cliente; as subtarefas acompanham a tarefa principal.
  async function mudarProjeto(id: string | null) {
    if (!current) return;
    const tarefaId = current.id;
    if (!(await salvarCampo({ subproject_id: id }))) return;
    if (!current.parent_id) await supabase.from("tasks").update({ subproject_id: id }).eq("parent_id", tarefaId);
  }

  // Parou de digitar o nome de uma tarefa nova: cria (1,5 s depois).
  useEffect(() => {
    if (!isNovo || !title.trim()) return;
    const espera = window.setTimeout(() => {
      criar();
    }, 1500);
    return () => window.clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, isNovo]);

  // Imagem colada, arrastada ou escolhida no editor (descrição e copy): vai
  // pros anexos da tarefa no armazenamento (sem entrar na lista de Anexos) e
  // o texto guarda o link do próprio d.hub.
  async function enviarImagemDoEditor(arquivo: File): Promise<string | null> {
    if (!current) {
      setErro("Dê um nome pra tarefa antes de pôr imagem: ela é criada na hora.");
      return null;
    }
    if (!arquivo.type.startsWith("image/")) return null;
    if (arquivo.size > 10 * 1024 * 1024) {
      setErro("Imagem grande demais (máximo 10 MB).");
      return null;
    }
    const nome = arquivo.name && arquivo.name !== "image.png" ? arquivo.name : `imagem.${arquivo.type.split("/")[1] || "png"}`;
    const caminho = `${current.id}/editor/${Date.now()}-${nomeSeguro(nome)}`;
    const { error } = await supabase.storage.from("task-attachments").upload(caminho, arquivo, { contentType: arquivo.type });
    if (error) {
      setErro(`Não deu pra enviar a imagem: ${error.message}`);
      return null;
    }
    return linkDoArquivo("task-attachments", caminho);
  }

  async function salvarCampo(campos: Partial<Task>): Promise<boolean> {
    if (!current) return false;
    const antes = current;
    const atualizado = { ...current, ...campos } as Task;
    setCurrent(atualizado);
    onUpdated(atualizado);
    const { error } = await supabase.from("tasks").update(campos).eq("id", current.id);
    // O banco recusa a troca de data por quem não é da liderança (migration
    // 0057): desfaz na tela e avisa, em vez de parecer que salvou.
    if (error && ("start_date" in campos || "due_date" in campos)) {
      setCurrent(antes);
      onUpdated(antes);
      setStartDate(antes.start_date ?? "");
      setDueDate(antes.due_date ?? "");
      setErro(
        /liderança/i.test(error.message)
          ? "Só a liderança pode alterar as datas de uma tarefa já criada."
          : "Não deu pra salvar a data. Tenta de novo."
      );
      return false;
    }

    if (error && "copy_html" in campos) {
      setCurrent(antes);
      onUpdated(antes);
      setErro(
        /copy_html/i.test(error.message)
          ? "Não deu pra salvar a copy formatada. Confere se a migration 0087_copy_formatada.sql já foi rodada no Supabase."
          : "Não deu pra salvar a copy. Tenta de novo."
      );
      return false;
    }

    if (error && "post_status_id" in campos) {
      setCurrent(antes);
      onUpdated(antes);
      setErro("Não deu pra mudar o status da postagem. Tenta de novo.");
      return false;
    }

    if (error && "tipo" in campos) {
      setCurrent(antes);
      onUpdated(antes);
      setTipo(antes.tipo ?? "geral");
      setErro("Não deu pra mudar o tipo da tarefa. Tenta de novo.");
      return false;
    }

    if (error && "subproject_id" in campos) {
      setCurrent(antes);
      onUpdated(antes);
      setSubprojetoId(antes.subproject_id ?? "");
      setErro("Não deu pra mudar o projeto da tarefa. Tenta de novo.");
      return false;
    }

    // A descrição não gravou (ex: falta a migration 0075): desfaz na tela e avisa,
    // em vez de parecer salva e sumir ao reabrir.
    if (error && ("description" in campos || "description_html" in campos)) {
      setCurrent(antes);
      onUpdated(antes);
      setDescription(antes.description ?? "");
      setDescriptionHtml(antes.description_html ?? "");
      setErro(
        /description_html/i.test(error.message)
          ? "Não deu pra salvar a descrição formatada. Confere se a migration 0075_descricao_formatada.sql já foi rodada no Supabase."
          : "Não deu pra salvar a descrição. Tenta de novo."
      );
      return false;
    }

    // Se essa tarefa já tem uma página vinculada na Wiki, mantém o resumo
    // lá em cima sempre atualizado com os dados mais recentes.
    if (atualizado.page_id) {
      syncTaskWiki(supabase, atualizado, profiles, projects).catch(() => {
        // Falha silenciosa: a tarefa já foi salva, só o resumo na Wiki
        // que não atualizou dessa vez — não trava o autosave por isso.
      });
    }
    return true;
  }

  function adicionarResponsavel(id: string) {
    if (!id || assignedTo.includes(id)) return;
    const proximos = [...assignedTo, id];
    setAssignedTo(proximos);
    if (!isNovo && current) {
      const tarefaId = current.id;
      salvarCampo({ assigned_to: proximos }).then(() =>
        avisarTarefaAtribuida(tarefaId, [id]).catch(() => {})
      );
    }
  }

  function removerResponsavel(id: string) {
    const proximos = assignedTo.filter((a) => a !== id);
    setAssignedTo(proximos);
    if (!isNovo) salvarCampo({ assigned_to: proximos });
  }

  // Duplicar (pedido da Emilly, 2026-10-22): uma tarefa nova igual a esta,
  // com o checklist (desmarcado) e as etiquetas. Não leva comentários,
  // anexos, horas nem o post; menções da descrição não avisam de novo.
  const [duplicando, setDuplicando] = useState(false);
  async function duplicar() {
    if (!current || duplicando) return;
    setDuplicando(true);
    setErro(null);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: `${current.title} (cópia)`.slice(0, 500),
        description: current.description,
        description_html: current.description_html ?? null,
        description_mentions: [],
        copy_text: current.copy_text ?? null,
        copy_html: current.copy_html ?? null,
        status: "todo",
        position: getNextPosition("todo"),
        start_date: current.start_date ?? null,
        due_date: current.due_date,
        start_time: current.start_time ?? null,
        due_time: current.due_time,
        repeat_rule: current.repeat_rule,
        color: current.color,
        project_id: current.project_id,
        subproject_id: current.subproject_id ?? null,
        parent_id: current.parent_id ?? null,
        tipo: current.tipo ?? "geral",
        assigned_to: current.assigned_to,
        created_by_label: currentUserLabel,
      })
      .select()
      .single();
    if (error || !data) {
      setDuplicando(false);
      setErro(`Não deu pra duplicar a tarefa: ${error?.message ?? "erro desconhecido"}`);
      return;
    }
    const nova = data as Task;
    const [{ data: itens }, { data: etiquetas }] = await Promise.all([
      supabase.from("task_checklist_items").select("title, position").eq("task_id", current.id),
      supabase.from("task_label_links").select("label_id").eq("task_id", current.id),
    ]);
    await Promise.all([
      (itens ?? []).length
        ? supabase.from("task_checklist_items").insert((itens ?? []).map((i) => ({ task_id: nova.id, title: i.title, position: i.position, done: false })))
        : Promise.resolve(),
      (etiquetas ?? []).length
        ? supabase.from("task_label_links").insert((etiquetas ?? []).map((l) => ({ task_id: nova.id, label_id: l.label_id })))
        : Promise.resolve(),
    ]);
    setDuplicando(false);
    onCreated(nova);
    if (nova.assigned_to.length > 0) avisarTarefaAtribuida(nova.id).catch(() => {});
    // Abre a cópia pra já ajustar o que precisar.
    if (onAbrirOutra) onAbrirOutra(nova);
  }

  async function excluirTarefa() {
    if (!current) return;
    // Todas as subtarefas contam (até as canceladas): elas ficam no quadro
    // como tarefas avulsas.
    const { count: filhas } = current.parent_id
      ? { count: 0 }
      : await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("parent_id", current.id);
    const ok = window.confirm(
      filhas && filhas > 0
        ? `Excluir esta tarefa? ${filhas === 1 ? "A subtarefa dela fica" : `As ${filhas} subtarefas dela ficam`} no quadro como tarefa${filhas === 1 ? "" : "s"} avulsa${filhas === 1 ? "" : "s"}. Ela vai pra Lixeira e dá pra restaurar em até 30 dias.`
        : "Excluir esta tarefa? Ela vai pra Lixeira e dá pra restaurar em até 30 dias."
    );
    if (!ok) return;
    await supabase.from("tasks").delete().eq("id", current.id);
    onDeleted(current.id);
    onClose();
  }

  const comentariosAoLado = larga && aba === "comentarios" && !!current;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        // dvh = a área realmente visível no celular (sem as barras do Safari/Chrome);
        // onde o navegador não conhece, vale o max-h-[90vh] da classe.
        style={{ maxHeight: "90dvh" }}
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl transition-[max-width] md:flex-row ${
          comentariosAoLado ? "max-w-6xl" : "max-w-2xl"
        }`}
      >
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-1 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink">
              {isNovo ? "Nova tarefa" : "Atualize aqui sua tarefa"}
            </h2>
            <div className="flex flex-shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={salvarEFechar}
                // Sem "disabled" enquanto salva: clicar tira o foco do nome, que já começa a
                // criar a tarefa, e um botão desativado engoliria o próprio clique.
                className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-navy hover:bg-brand-hover"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="text-xl leading-none text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>
          </div>
          {current?.parent_id && (
            <button
              type="button"
              onClick={async () => {
                const { data } = await supabase.from("tasks").select("*").eq("id", current.parent_id as string).maybeSingle();
                if (data) onAbrirOutra?.(data as Task);
              }}
              className="mb-1 text-xs font-medium text-brand-forte hover:underline"
            >
              ↳ Subtarefa de outra tarefa · abrir a principal
            </button>
          )}
          {!isNovo && (
            <p className="mb-4 text-xs text-ink-muted">
              As alterações são salvas automaticamente.
            </p>
          )}
          {erro && (
            <p className="mb-3 rounded-lg bg-danger-light px-3 py-2 text-xs text-danger">
              {erro}
            </p>
          )}

          {(aba === "detalhes" || comentariosAoLado) && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">
                  Nome da tarefa *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  onBlur={() => {
                    if (isNovo) {
                      if (title.trim()) criar();
                      return;
                    }
                    if (title.trim() && title.trim() !== current?.title) salvarCampo({ title: title.trim() });
                  }}
                  placeholder="Nome da tarefa..."
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-ink-muted">Tipo</p>
                <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="Tipo da tarefa">
                  {(
                    [
                      ["geral", "Geral"],
                      ["postagem", "🖼️ Postagem"],
                    ] as const
                  ).map(([valor, rotulo]) => (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={tipo === valor}
                      onClick={() => {
                        if (tipo === valor) return;
                        setTipo(valor);
                        if (!isNovo) salvarCampo({ tipo: valor });
                      }}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        tipo === valor ? "bg-brand text-navy" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">
                  Descrição
                </label>
                {!isNovo && !editandoDescricao && (description.trim() || descriptionHtml) ? (
                  <div
                    role="button"
                    tabIndex={0}
                    title="Clique pra editar"
                    onClick={() => setEditandoDescricao(true)}
                    onKeyDown={(e) => e.key === "Enter" && setEditandoDescricao(true)}
                    className="max-h-64 min-h-[5.5rem] w-full cursor-text overflow-y-auto break-words rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-ink-muted/40"
                  >
                    {descriptionHtml ? (
                      <div
                        className="texto-rico"
                        onClick={(e) => {
                          // Clicar num link abre o link; no resto do texto, edita.
                          if ((e.target as HTMLElement).closest("a")) e.stopPropagation();
                        }}
                        dangerouslySetInnerHTML={{ __html: sanitizarHtml(descriptionHtml) }}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">
                        <TextoComLinks texto={description} />
                      </span>
                    )}
                  </div>
                ) : (
                  <EditorDeTexto
                    pessoas={profiles}
                    aoEnviarImagem={enviarImagemDoEditor}
                    comCorretor
                    valorHtml={descriptionHtml || textoParaHtml(description)}
                    autoFocus={editandoDescricao}
                    aoMudar={isNovo ? (html) => {
                      setDescriptionHtml(html);
                      setDescription(htmlParaTexto(html));
                      setMencoesDaDescricao(idsDeMencoes(html, [...idsDaEquipe]).filter((id) => idsDaEquipe.has(id)));
                    } : undefined}
                    aoSair={(html, mudou) => {
                      if (isNovo) return;
                      // Clicar dentro e fora sem mexer não muda (nem reformata) nada.
                      if (!mudou) {
                        setEditandoDescricao(false);
                        return;
                      }
                      if (html.length > LIMITE_DO_HTML) {
                        setErro("A descrição está grande demais pra salvar. Encurte um pouco o texto.");
                        return;
                      }
                      const texto = htmlParaTexto(html);
                      setDescriptionHtml(html);
                      setDescription(texto);
                      setEditandoDescricao(false);
                      const mencionados = idsDeMencoes(html, [...idsDaEquipe]).filter((id) => idsDaEquipe.has(id));
                      const jaMencionados = current?.description_mentions ?? [];
                      const tarefaId = current?.id;
                      const mudouMencoes =
                        mencionados.length !== jaMencionados.length || mencionados.some((id) => !jaMencionados.includes(id));
                      salvarCampo({
                        description: texto || null,
                        description_html: html || null,
                        ...(mudouMencoes ? { description_mentions: mencionados } : {}),
                      }).then((gravou) => {
                        // O aviso do sininho nasce no banco; aqui vai o push pro celular.
                        if (gravou && tarefaId && mencionados.some((id) => !jaMencionados.includes(id))) {
                          avisarMencaoNaDescricao(tarefaId).catch(() => {});
                        }
                      });
                    }}
                  />
                )}
              </div>

              {current && (
                <ResumoDaTarefa
                  taskId={current.id}
                  pageId={current.page_id}
                  resumo={resumo}
                  onAbrir={setAba}
                  onMudou={() =>
                    carregarResumos(supabase, [current.id]).then((m) =>
                      setResumo(m[current.id] ?? resumoVazio())
                    )
                  }
                />
              )}

              <div>
                <label className="mb-2 block text-xs font-medium text-ink-muted">
                  Status
                </label>
                <div className="flex flex-wrap gap-3">
                  {STATUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-center gap-1.5 text-sm text-ink-muted"
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={status === opt.key}
                        onChange={() => {
                          setStatus(opt.key);
                          if (!isNovo) salvarCampo({ status: opt.key });
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                {/* Concluir com subtarefa aberta é permitido; só avisa. */}
                {status === "done" && resumo.subtarefasTotal > resumo.subtarefasFeitas && (
                  <p className="mt-2 rounded-lg bg-warning-light px-3 py-2 text-xs text-warning">
                    Esta tarefa está concluída, mas ainda tem {resumo.subtarefasTotal - resumo.subtarefasFeitas}{" "}
                    {resumo.subtarefasTotal - resumo.subtarefasFeitas === 1 ? "subtarefa aberta" : "subtarefas abertas"}.{" "}
                    <button type="button" onClick={() => setAba("subtarefas")} className="font-medium underline">
                      Ver subtarefas
                    </button>
                  </p>
                )}
              </div>

              {current && <EtiquetasDaTarefa key={current.id} taskId={current.id} aoMudar={() => undefined} />}

              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Início{isNovo && <span className="text-danger"> *</span>}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    max={dueDate || undefined}
                    disabled={datasTravadas}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && dueDate && v > dueDate) {
                        setErro("O início não pode ser depois da entrega.");
                        return;
                      }
                      setErro(null);
                      setStartDate(v);
                      if (!isNovo) salvarCampo({ start_date: v || null });
                    }}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-ink-muted"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">Hora de início</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      const v = e.target.value;
                      const falha = erroDeHorario(startDate, dueDate, v, dueTime);
                      if (falha) {
                        setErro(falha);
                        return;
                      }
                      setErro(null);
                      setStartTime(v);
                      if (!isNovo) salvarCampo({ start_time: v || null });
                    }}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Entrega{isNovo && <span className="text-danger"> *</span>}
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    min={startDate || undefined}
                    disabled={datasTravadas}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && startDate && v < startDate) {
                        setErro("A entrega não pode ser antes do início.");
                        return;
                      }
                      setErro(null);
                      setDueDate(v);
                      if (!isNovo) salvarCampo({ due_date: v || null });
                    }}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-ink-muted"
                  />
                </div>
                {datasTravadas && (
                  <p className="w-full text-xs text-ink-muted">
                    As datas ficam travadas depois que a tarefa é criada. Só a liderança pode alterar.
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Hora de fim
                  </label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => {
                      const v = e.target.value;
                      const falha = erroDeHorario(startDate, dueDate, startTime, v);
                      if (falha) {
                        setErro(falha);
                        return;
                      }
                      setErro(null);
                      setDueTime(v);
                      if (!isNovo) salvarCampo({ due_time: v || null });
                    }}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Repetir
                  </label>
                  <select
                    value={repeatRule}
                    onChange={(e) => {
                      const v = e.target.value as RepeatRule;
                      setRepeatRule(v);
                      if (!isNovo) salvarCampo({ repeat_rule: v });
                    }}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                  >
                    {REPEAT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {repeatRule !== "none" && (
                <p className="-mt-2 text-xs text-ink-muted">
                  A recorrência é só uma lembrança por enquanto — ainda não
                  recria a tarefa automaticamente.
                </p>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">
                  Responsáveis
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {assignedTo.map((id) => {
                    const p = profiles.find((pr) => pr.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-forte"
                      >
                        {p?.name || p?.username || "?"}
                        <button
                          type="button"
                          onClick={() => removerResponsavel(id)}
                          className="text-brand-forte/60 hover:text-brand-forte"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                  {assignedTo.length === 0 && (
                    <span className="text-xs text-ink-muted">Ninguém</span>
                  )}
                </div>
                <select
                  value=""
                  onChange={(e) => adicionarResponsavel(e.target.value)}
                  className="mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                >
                  <option value="">+ Adicionar responsável</option>
                  {profiles
                    .filter((p) => !assignedTo.includes(p.id) && pessoaAtiva(p))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.username || "Sem nome"}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-3">
                {projects.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-muted">
                      Cliente
                    </label>
                    <select
                      value={taskProjectId}
                      disabled={!!current?.parent_id}
                      title={current?.parent_id ? "A subtarefa fica sempre no cliente da tarefa principal." : undefined}
                      onChange={(e) => {
                        setTaskProjectId(e.target.value);
                        // O projeto é do cliente: trocar de cliente tira a tarefa dele.
                        const tinhaProjeto = !!subprojetoId;
                        setSubprojetoId("");
                        if (!isNovo)
                          salvarCampo({ project_id: e.target.value || null, ...(tinhaProjeto ? { subproject_id: null } : {}) });
                      }}
                      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    >
                      <option value="">Geral</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {current && !current.parent_id && projects.length > 1 && (
                  <ClientesExtrasDaTarefa key={current.id} taskId={current.id} principalId={taskProjectId} projects={projects} />
                )}

                {taskProjectId && subprojetos.length > 0 && (
                  <div className="min-w-0">
                    <label htmlFor="projeto-da-tarefa" className="mb-1 block text-xs font-medium text-ink-muted">
                      Projeto
                    </label>
                    <select
                      id="projeto-da-tarefa"
                      value={subprojetoId}
                      onChange={(e) => {
                        setSubprojetoId(e.target.value);
                        if (!isNovo) mudarProjeto(e.target.value || null);
                      }}
                      className="max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    >
                      <option value="">Nenhum</option>
                      {subprojetos
                        .filter((sp) => sp.status !== "concluido" || sp.id === subprojetoId)
                        .map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name}
                            {sp.status === "concluido" ? " (concluído)" : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

              </div>

              {tipo === "postagem" && current && (
                <section className="space-y-5 rounded-xl border border-line bg-canvas/40 p-3 sm:p-4" aria-label="Postagem">
                  <StatusDaPostagemPicker
                    valor={current.post_status_id ?? null}
                    aoMudar={(id) => salvarCampo({ post_status_id: id })}
                  />
                  {/* A copy da peça: vira a legenda do post. */}
                  <CopyTab
                    key={current.id}
                    valorHtml={current.copy_html || textoParaHtml(current.copy_text ?? "")}
                    aoEnviarImagem={enviarImagemDoEditor}
                    onSalvar={async (html, texto) => {
                      if (html.length > LIMITE_DO_HTML) {
                        setErro("A copy está grande demais pra salvar. Encurte um pouco o texto.");
                        return false;
                      }
                      return salvarCampo({ copy_html: html || null, copy_text: texto.trim() || null });
                    }}
                  />
                  <div className="border-t border-line pt-4">
                    <PostDaTarefa
                      taskId={current.id}
                      projectId={current.project_id}
                      projectName={projects.find((p) => p.id === current.project_id)?.name ?? "o cliente"}
                      dueDate={current.due_date}
                      currentUserLabel={currentUserLabel}
                    />
                  </div>
                </section>
              )}
              {tipo === "postagem" && isNovo && (
                <p className="text-xs text-ink-muted">A copy e o post do cliente aparecem aqui depois de criar a tarefa.</p>
              )}

              {!isNovo && current?.due_date && (
                <Link
                  href="/calendario"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success-light px-4 py-2 text-xs font-medium text-success hover:bg-success/10"
                >
                  📅 Ver no Calendário
                </Link>
              )}

              {!isNovo && (
                <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={duplicar}
                    disabled={duplicando}
                    title="Criar uma cópia desta tarefa"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover disabled:opacity-60"
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                    {duplicando ? "Duplicando..." : "Duplicar"}
                  </button>
                  <button
                    onClick={excluirTarefa}
                    title="Excluir tarefa"
                    className="text-sm text-ink-muted hover:text-danger"
                  >
                    🗑️
                  </button>
                </div>
              )}

              {isNovo && (
                <p className="text-xs text-ink-muted">
                  Clique em Salvar no alto, ou a tarefa é criada sozinha assim que
                  você dá o nome. Checklist, anexos e comentários ficam disponíveis
                  logo depois.
                </p>
              )}
            </div>
          )}

          {aba === "checklist" && current && (
            <ChecklistTab taskId={current.id} pageId={current.page_id} />
          )}
          {aba === "subtarefas" && current && !current.parent_id && (
            <SubtarefasTab
              tarefa={current}
              pessoas={profiles}
              currentUserLabel={currentUserLabel}
              getNextPosition={getNextPosition}
              aoCriar={onCreated}
              aoAtualizar={onUpdated}
              aoAbrir={(t) => onAbrirOutra?.(t)}
              aoMudar={() =>
                carregarResumos(supabase, [current.id]).then((m) => setResumo(m[current.id] ?? resumoVazio()))
              }
            />
          )}
          {aba === "anexos" && current && (
            <AnexosTab
              taskId={current.id}
              pageId={current.page_id}
              currentUserLabel={currentUserLabel}
            />
          )}
          {aba === "comentarios" && current && !comentariosAoLado && (
            <ComentariosTab
              taskId={current.id}
              pageId={current.page_id}
              currentUserLabel={currentUserLabel}
              pessoas={profiles}
            />
          )}
        </div>

        {/* Comentários ao lado dos detalhes (tela larga): cada coluna rola sozinha. */}
        {comentariosAoLado && current && (
          <div className="flex w-full flex-shrink-0 flex-col overflow-y-auto border-t border-line bg-canvas/40 p-6 md:w-[420px] md:border-l md:border-t-0">
            <h3 className="mb-3 text-sm font-semibold text-ink">Comentários</h3>
            <ComentariosTab
              taskId={current.id}
              pageId={current.page_id}
              currentUserLabel={currentUserLabel}
              pessoas={profiles}
              listaAlta
            />
          </div>
        )}

        <div className="flex flex-shrink-0 flex-row gap-1 border-t border-line bg-canvas p-2 md:w-40 md:flex-col md:border-l md:border-t-0">
          <p className="hidden px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted md:block">
            Menu
          </p>
          {ABAS.filter((item) => !(item.key === "subtarefas" && current?.parent_id)).map((item) => (
            <button
              key={item.key}
              disabled={item.key !== "detalhes" && isNovo}
              onClick={() => setAba(item.key)}
              title={item.label}
              aria-label={item.label}
              className={`relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-1 py-2 text-sm font-medium md:flex-none md:justify-start md:px-3 md:text-left disabled:cursor-not-allowed disabled:opacity-30 ${
                aba === item.key
                  ? "bg-brand text-navy"
                  : "text-ink-muted hover:bg-surface-hover"
              }`}
            >
              <span>{item.icone}</span>
              <span className="hidden md:inline">{item.label}</span>
              {!isNovo && contadorDoMenu(item.key) && (
                <span
                  className={`absolute right-0 top-0 rounded-full px-1 text-[9px] font-semibold leading-4 md:static md:ml-auto md:px-1.5 md:py-0.5 md:text-[10px] md:leading-normal ${
                    aba === item.key ? "bg-navy/15 text-navy" : "bg-surface-hover text-ink"
                  }`}
                >
                  {contadorDoMenu(item.key)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChecklistTab({
  taskId,
  pageId,
}: {
  taskId: string;
  pageId: string | null;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", taskId)
        .order("position", { ascending: true });
      if (ativo) {
        setItems(data ?? []);
        setCarregando(false);
      }
    })();

    const channel = supabase
      .channel(`checklist-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_checklist_items" },
        (payload) => {
          setItems((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as ChecklistItem;
              if (novo.task_id !== taskId) return current;
              if (current.some((i) => i.id === novo.id)) return current;
              return [...current, novo].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const at = payload.new as ChecklistItem;
              if (at.task_id !== taskId) return current;
              // Outra pessoa pode ter reordenado: mantém na ordem das posições.
              return current.map((i) => (i.id === at.id ? at : i)).sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as ChecklistItem).id;
              return current.filter((i) => i.id !== id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoItem.trim()) return;
    const maxPos = items.reduce((m, i) => Math.max(m, i.position), 0);
    const { data, error } = await supabase
      .from("task_checklist_items")
      .insert({ task_id: taskId, title: novoItem.trim(), position: maxPos + 1 })
      .select()
      .single();
    if (!error && data) {
      const proximos = items.some((i) => i.id === data.id)
        ? items
        : [...items, data];
      setItems(proximos);
      setNovoItem("");
      syncChecklistWiki(supabase, pageId, proximos).catch(() => {});
    }
  }

  async function alternar(item: ChecklistItem) {
    const proximos = items.map((i) =>
      i.id === item.id ? { ...i, done: !i.done } : i
    );
    setItems(proximos);
    await supabase
      .from("task_checklist_items")
      .update({ done: !item.done })
      .eq("id", item.id);
    syncChecklistWiki(supabase, pageId, proximos).catch(() => {});
  }

  // Reordenar (pedido da Mariana, 2026-10-21): arrastar o item ou usar as
  // setas. As posições viram 1, 2, 3... e só o que mudou é gravado.
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  async function reordenar(novaOrdem: ChecklistItem[]) {
    const antes = items;
    const proximos = novaOrdem.map((i, indice) => ({ ...i, position: indice + 1 }));
    const mudaram = proximos.filter((i) => antes.find((a) => a.id === i.id)?.position !== i.position);
    setItems(proximos);
    if (mudaram.length === 0) return;
    const resultados = await Promise.all(
      mudaram.map((i) => supabase.from("task_checklist_items").update({ position: i.position }).eq("id", i.id))
    );
    if (resultados.some((r) => r.error)) {
      setItems(antes);
      return;
    }
    syncChecklistWiki(supabase, pageId, proximos).catch(() => {});
  }

  function mover(item: ChecklistItem, passo: -1 | 1) {
    const i = items.findIndex((x) => x.id === item.id);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= items.length) return;
    const nova = [...items];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    reordenar(nova);
  }

  function soltarAntesDe(alvoId: string) {
    const origem = arrastando;
    setArrastando(null);
    setSobre(null);
    if (!origem || origem === alvoId) return;
    const item = items.find((x) => x.id === origem);
    if (!item) return;
    const sem = items.filter((x) => x.id !== origem);
    const indice = sem.findIndex((x) => x.id === alvoId);
    sem.splice(indice < 0 ? sem.length : indice, 0, item);
    reordenar(sem);
  }

  async function remover(item: ChecklistItem) {
    const proximos = items.filter((i) => i.id !== item.id);
    setItems(proximos);
    await supabase.from("task_checklist_items").delete().eq("id", item.id);
    syncChecklistWiki(supabase, pageId, proximos).catch(() => {});
  }

  const feitos = items.filter((i) => i.done).length;

  return (
    <div>
      {items.length > 0 && (
        <p className="mb-2 text-xs text-ink-muted">
          {feitos}/{items.length} concluídos
        </p>
      )}
      <div className="space-y-1">
        {items.map((item, indice) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              setArrastando(item.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", item.id);
            }}
            onDragEnd={() => {
              setArrastando(null);
              setSobre(null);
            }}
            onDragOver={(e) => {
              if (!arrastando) return;
              e.preventDefault();
              if (sobre !== item.id) setSobre(item.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              soltarAntesDe(item.id);
            }}
            className={`group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-hover ${
              arrastando === item.id ? "opacity-40" : ""
            } ${sobre === item.id && arrastando !== item.id ? "shadow-[inset_0_2px_0_0_rgb(var(--color-brand))]" : ""}`}
          >
            <span
              className="cursor-grab select-none px-0.5 text-xs leading-none text-ink-muted active:cursor-grabbing"
              title="Arraste pra mudar a ordem"
              aria-hidden="true"
            >
              ⠿
            </span>
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => alternar(item)}
            />
            <span
              className={`flex-1 text-sm ${
                item.done ? "text-ink-muted line-through" : "text-ink"
              }`}
            >
              {item.title}
            </span>
            <span className="flex flex-shrink-0 items-center sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => mover(item, -1)}
                disabled={indice === 0}
                aria-label={`Subir "${item.title}"`}
                title="Subir"
                className="flex h-7 w-7 items-center justify-center rounded text-xs text-ink-muted hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => mover(item, 1)}
                disabled={indice === items.length - 1}
                aria-label={`Descer "${item.title}"`}
                title="Descer"
                className="flex h-7 w-7 items-center justify-center rounded text-xs text-ink-muted hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30"
              >
                ↓
              </button>
            </span>
            <button
              onClick={() => remover(item)}
              className="text-xs text-ink-muted hover:text-danger"
            >
              ✕
            </button>
          </div>
        ))}
        {/* Soltar no fim da lista. */}
        {arrastando && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (sobre !== "fim") setSobre("fim");
            }}
            onDrop={(e) => {
              e.preventDefault();
              soltarAntesDe("fim");
            }}
            className={`h-6 rounded-md border border-dashed ${sobre === "fim" ? "border-brand" : "border-transparent"}`}
          />
        )}
        {!carregando && items.length === 0 && (
          <p className="text-xs text-ink-muted">Nenhum item ainda.</p>
        )}
      </div>
      <form onSubmit={adicionar} className="mt-3 flex gap-2">
        <input
          value={novoItem}
          onChange={(e) => setNovoItem(e.target.value)}
          placeholder="Novo item..."
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-navy hover:bg-brand-hover"
        >
          Adicionar
        </button>
      </form>
    </div>
  );
}

function AnexosTab({
  taskId,
  pageId,
  currentUserLabel,
}: {
  taskId: string;
  pageId: string | null;
  currentUserLabel: string;
}) {
  const supabase = createClient();
  const [anexos, setAnexos] = useState<TaskAttachment[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (ativo) setAnexos(data ?? []);
    })();

    const channel = supabase
      .channel(`anexos-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_attachments" },
        (payload) => {
          setAnexos((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as TaskAttachment;
              if (novo.task_id !== taskId) return current;
              if (current.some((a) => a.id === novo.id)) return current;
              return [novo, ...current];
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as TaskAttachment).id;
              return current.filter((a) => a.id !== id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Vários de uma vez (escolhendo na janela ou arrastando pra área): um
  // atrás do outro, com o progresso. O Supabase aceita até 50 MB por arquivo;
  // vídeo (de qualquer tamanho) e o que passou de LIMITE_DO_SUPABASE vão pro
  // Google Drive do d.hub (link aberto pra quem tiver) e o anexo guarda
  // "drive:<código>". Vídeo pesava quase todo o espaço do plano do Supabase.
  const LIMITE_MB = Math.round(LIMITE_DO_SUPABASE / 1024 / 1024);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [sobreArea, setSobreArea] = useState(false);
  async function enviarArquivos(arquivos: File[]) {
    if (arquivos.length === 0 || enviando) return;
    setEnviando(true);
    const semDrive: string[] = [];
    const falhas: string[] = [];
    let atuais = anexos;
    for (let i = 0; i < arquivos.length; i++) {
      const arquivo = arquivos[i];
      const quantos = arquivos.length > 1 ? ` ${i + 1} de ${arquivos.length}` : "";
      setProgresso(`Enviando${quantos}...`);
      let caminho = "";
      const ehVideo = arquivo.type.startsWith("video/") || tipoDoArquivoPeloNome(arquivo.name) === "video";
      if (arquivo.size > LIMITE_DO_SUPABASE || ehVideo) {
        const r = await enviarAnexoParaODrive(arquivo, (f) =>
          setProgresso(`Enviando${quantos} pro Google Drive... ${Math.round(f * 100)}%`)
        );
        if ("erro" in r) {
          // Vídeo que cabe no Supabase não se perde se o Drive falhar: segue pra lá.
          if (arquivo.size > LIMITE_DO_SUPABASE) {
            (r.naoConfigurado ? semDrive : falhas).push(arquivo.name);
            continue;
          }
        } else {
          caminho = `${PREFIXO_DO_DRIVE}${r.id}`;
        }
      }
      if (!caminho) {
        caminho = `${taskId}/${Date.now()}-${i}-${nomeSeguro(arquivo.name)}`;
        const { error: erroUpload } = await supabase.storage.from("task-attachments").upload(caminho, arquivo);
        if (erroUpload) {
          falhas.push(arquivo.name);
          continue;
        }
      }
      const { data, error } = await supabase
        .from("task_attachments")
        .insert({ task_id: taskId, file_name: arquivo.name, file_path: caminho, uploaded_by_label: currentUserLabel })
        .select()
        .single();
      if (error || !data) {
        // Não ficou registrado: não deixa o arquivo órfão no Drive.
        const idNoDrive = idDoDriveDoAnexo(caminho);
        if (idNoDrive) descartarAnexoDoDrive(idNoDrive).catch(() => {});
        else supabase.storage.from("task-attachments").remove([caminho]).catch(() => {});
        falhas.push(arquivo.name);
        continue;
      }
      atuais = atuais.some((a) => a.id === data.id) ? atuais : [data, ...atuais];
      setAnexos(atuais);
    }
    setEnviando(false);
    setProgresso(null);
    syncAnexosWiki(supabase, pageId, atuais).catch(() => {});
    const avisos = [
      semDrive.length
        ? `Passam de ${LIMITE_MB} MB e o Google Drive do d.hub não está ligado, então não foram: ${semDrive.join(", ")}. Mande pelo Drive e cole o link nos comentários.`
        : "",
      falhas.length ? `Não deu pra enviar: ${falhas.join(", ")}. Tente de novo.` : "",
    ].filter(Boolean);
    if (avisos.length) window.alert(avisos.join("\n\n"));
  }

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    await enviarArquivos(arquivos);
  }

  async function remover(anexo: TaskAttachment) {
    const proximos = anexos.filter((a) => a.id !== anexo.id);
    setAnexos(proximos);
    const idNoDrive = idDoDriveDoAnexo(anexo.file_path);
    if (idNoDrive) await descartarAnexoDoDrive(idNoDrive).catch(() => {});
    else await supabase.storage.from("task-attachments").remove([anexo.file_path]);
    await supabase.from("task_attachments").delete().eq("id", anexo.id);
    syncAnexosWiki(supabase, pageId, proximos).catch(() => {});
  }

  // Pré-visualização: clicar no anexo abre aqui dentro (setas passam pro próximo).
  const [vendo, setVendo] = useState<number | null>(null);

  // Miniaturas das imagens: os links assinados de todas saem num pedido só
  // (em vez de cada miniatura passar pela rota /arquivos), direto do
  // armazenamento. O plano do Supabase não gera versão reduzida: é a foto.
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const [falhas, setFalhas] = useState<Set<string>>(new Set());
  // (Os do Drive têm miniatura do próprio Drive.)
  const caminhosDasImagens = anexos
    .filter((a) => !idDoDriveDoAnexo(a.file_path) && ["imagem", "video"].includes(tipoDoArquivoPeloNome(a.file_name)))
    .map((a) => a.file_path)
    .sort()
    .join("|");
  useEffect(() => {
    const faltam = caminhosDasImagens.split("|").filter((c) => c && !(c in miniaturas));
    if (faltam.length === 0) return;
    let ativo = true;
    supabase.storage
      .from("task-attachments")
      .createSignedUrls(faltam, 3600)
      .then(({ data }) => {
        if (!ativo) return;
        const novos: Record<string, string> = {};
        for (const c of faltam) novos[c] = "";
        for (const d of data ?? []) if (d.path && d.signedUrl) novos[d.path] = d.signedUrl;
        setMiniaturas((atual) => ({ ...atual, ...novos }));
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminhosDasImagens]);

  return (
    <div>
      <label
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) {
            e.preventDefault();
            setSobreArea(true);
          }
        }}
        onDragLeave={() => setSobreArea(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobreArea(false);
          enviarArquivos(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`mb-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
          sobreArea ? "border-brand bg-brand/10" : "border-line hover:border-brand/50 hover:bg-surface-hover/40"
        } ${enviando ? "pointer-events-none opacity-70" : ""}`}
      >
        <span className="text-sm font-medium text-ink">
          {progresso ?? (sobreArea ? "Solte os arquivos aqui" : "Anexar arquivos")}
        </span>
        <span className="text-xs text-ink-muted">
          Clique pra escolher (dá pra marcar vários) ou arraste pra cá · acima de {LIMITE_MB} MB vai pro Google Drive
        </span>
        <input type="file" multiple onChange={enviarArquivo} disabled={enviando} className="sr-only" />
      </label>
      {/* No celular, o seletor de "arquivos" só marca vários segurando o dedo num
          item. Este abre a galeria de fotos e vídeos, que tem marcação direta. */}
      <label
        className={`mb-3 hidden cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-hover [@media(pointer:coarse)]:flex ${
          enviando ? "pointer-events-none opacity-70" : ""
        }`}
      >
        Escolher fotos e vídeos (vários)
        <input type="file" multiple accept="image/*,video/*" onChange={enviarArquivo} disabled={enviando} className="sr-only" />
      </label>
      {anexos.length > 1 && (
        <div className="mb-2 flex justify-end">
          <BaixarTodosOsAnexos
            anexos={anexos.map((a) => ({
              nome: a.file_name,
              url: linkParaBaixarAnexo(a.file_path, a.file_name),
              noDrive: !!idDoDriveDoAnexo(a.file_path),
            }))}
          />
        </div>
      )}
      <div className="space-y-1">
        {anexos.map((a, indice) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
          >
            <button
              type="button"
              onClick={() => setVendo(indice)}
              title="Visualizar"
              className="flex min-w-0 items-center gap-2 text-left text-sm text-ink hover:underline"
            >
              {idDoDriveDoAnexo(a.file_path) ? (
                <MiniaturaDoDrive
                  url={miniaturaDoAnexoNoDrive(a.file_path) ?? ""}
                  extensao={(a.file_name.split(".").pop() ?? "").slice(0, 4)}
                />
              ) : tipoDoArquivoPeloNome(a.file_name) === "imagem" && !falhas.has(a.file_path) && miniaturas[a.file_path] !== "" ? (
                <span className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded border border-line bg-canvas">
                  {miniaturas[a.file_path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={miniaturas[a.file_path]}
                      alt=""
                      decoding="async"
                      onError={() => setFalhas((atual) => new Set(atual).add(a.file_path))}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 animate-pulse bg-surface-hover" aria-hidden="true" />
                  )}
                </span>
              ) : tipoDoArquivoPeloNome(a.file_name) === "video" ? (
                <MiniaturaDeVideo />
              ) : (
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border border-line bg-canvas text-[10px] font-semibold uppercase text-ink-muted">
                  {(a.file_name.split(".").pop() ?? "").slice(0, 4) || "📎"}
                </span>
              )}
              <span className="truncate">{a.file_name}</span>
            </button>
            <div className="flex flex-shrink-0 items-center gap-3">
              <a
                href={linkParaBaixarAnexo(a.file_path, a.file_name)}
                download={a.file_name}
                // Do Drive abre em outra aba (arquivo grande: o Drive pede pra confirmar).
                target={idDoDriveDoAnexo(a.file_path) ? "_blank" : undefined}
                rel={idDoDriveDoAnexo(a.file_path) ? "noopener noreferrer" : undefined}
                title={`Baixar ${a.file_name}`}
                aria-label={`Baixar ${a.file_name}`}
                className="flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                Baixar
              </a>
              <button
                onClick={() => remover(a)}
                aria-label={`Remover ${a.file_name}`}
                className="text-xs text-ink-muted hover:text-danger"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {anexos.length === 0 && (
          <p className="text-xs text-ink-muted">Nenhum anexo ainda.</p>
        )}
      </div>
      {vendo !== null && anexos.length > 0 && (
        <VisualizadorDeArquivos
          arquivos={anexos.map((a) => ({
            nome: a.file_name,
            url: linkDoAnexo(a.file_path),
            urlBaixar: linkParaBaixarAnexo(a.file_path, a.file_name),
            embed: embedDoAnexo(a.file_path) ?? undefined,
          }))}
          inicial={Math.min(vendo, anexos.length - 1)}
          aoFechar={() => setVendo(null)}
        />
      )}
    </div>
  );
}

// Anexo guardado no Google Drive: a miniatura vem do Drive (imagem, vídeo,
// PDF...). Sem miniatura lá, fica a extensão com o selo do Drive.
function MiniaturaDoDrive({ url, extensao }: { url: string; extensao: string }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span
      className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-canvas text-[10px] font-semibold uppercase text-ink-muted"
      title="Guardado no Google Drive"
    >
      {extensao || "📎"}
      {url && !falhou && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFalhou(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span className="absolute bottom-0 right-0 rounded-tl bg-white/90 px-0.5 text-[8px] font-bold leading-tight text-[#1a73e8]" aria-hidden="true">
        D
      </span>
    </span>
  );
}

// Miniatura de vídeo sem baixar nada: um <video preload="metadata"> puxava boa
// parte do arquivo (em vídeo de celular, quase ele todo) a cada vez que a lista
// de anexos aparecia, e o link assinado muda sempre, então o navegador nunca
// reaproveitava. O vídeo só é baixado quando a pessoa abre o anexo.
function MiniaturaDeVideo() {
  return (
    <span
      className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-black text-[11px] text-white/80"
      aria-hidden="true"
    >
      ▶
    </span>
  );
}

function ComentariosTab({
  taskId,
  pageId,
  currentUserLabel,
  pessoas,
  listaAlta = false,
}: {
  taskId: string;
  pageId: string | null;
  currentUserLabel: string;
  // A equipe que dá pra mencionar com "@".
  pessoas: Profile[];
  // Ao lado dos detalhes a lista de comentários pode ser mais alta.
  listaAlta?: boolean;
}) {
  const supabase = createClient();
  const [comentarios, setComentarios] = useState<TaskComment[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  // Quem pode editar/excluir: o autor do comentário, ou líder (ve_tudo).
  const [euId, setEuId] = useState<string | null>(null);
  const [souLider, setSouLider] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState("");
  // Quem foi escolhido na lista do "@" (ao escrever e ao editar).
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [escolhidosEdicao, setEscolhidosEdicao] = useState<string[]>([]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !ativo) return;
      setEuId(user.id);
      const { data: perfil } = await supabase.from("profiles").select("ve_tudo").eq("id", user.id).maybeSingle();
      if (ativo) setSouLider(!!perfil?.ve_tudo);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const podeMexer = (c: TaskComment) => souLider || (!!euId && c.created_by === euId);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (ativo) setComentarios(data ?? []);
    })();

    const channel = supabase
      .channel(`comentarios-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const novo = payload.new as TaskComment;
            if (novo.task_id !== taskId) return;
            setComentarios((current) =>
              current.some((c) => c.id === novo.id) ? current : [...current, novo]
            );
          }
          if (payload.eventType === "UPDATE") {
            const novo = payload.new as TaskComment;
            if (novo.task_id !== taskId) return;
            setComentarios((current) => current.map((c) => (c.id === novo.id ? novo : c)));
          }
          if (payload.eventType === "DELETE") {
            const id = (payload.old as TaskComment).id;
            setComentarios((current) => current.filter((c) => c.id !== id));
          }
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function salvarEdicao(c: TaskComment) {
    const texto = textoEditado.trim();
    if (!texto || texto === c.content) {
      setEditandoId(null);
      return;
    }
    // Menções que já havia e continuam escritas, mais as novas escolhidas.
    const mencoes = idsMencionados(texto, pessoas, [...(c.mentions ?? []), ...escolhidosEdicao]);
    const novasMencoes = mencoes.filter((id) => !(c.mentions ?? []).includes(id));
    const { data, error } = await supabase
      .from("task_comments")
      .update({ content: texto, edited_at: new Date().toISOString(), mentions: mencoes })
      .eq("id", c.id)
      .select()
      .maybeSingle();
    if (error || !data) {
      window.alert(
        error?.message.includes("edited_at")
          ? "Pra editar comentários, rode a migration 0039_comentarios_editar_excluir.sql no Supabase."
          : `Não deu pra editar: ${error?.message ?? "sem permissão pra esse comentário."}`
      );
      return;
    }
    setComentarios((cur) => cur.map((x) => (x.id === c.id ? (data as TaskComment) : x)));
    setEditandoId(null);
    sincronizarWiki();
    if (novasMencoes.length > 0) avisarMencao(c.id, novasMencoes).catch(() => {});
  }

  // Relê a lista do banco antes de atualizar a Wiki — assim não perde um
  // comentário que chegou de outra pessoa enquanto este era salvo.
  async function sincronizarWiki() {
    const { data } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    if (data) syncComentariosWiki(supabase, pageId, data).catch(() => {});
  }

  async function excluir(c: TaskComment) {
    if (!window.confirm("Excluir este comentário?")) return;
    const { data, error } = await supabase.from("task_comments").delete().eq("id", c.id).select("id");
    if (error || !data?.length) {
      window.alert(`Não deu pra excluir: ${error?.message ?? "sem permissão pra esse comentário."}`);
      return;
    }
    setComentarios((cur) => cur.filter((x) => x.id !== c.id));
    sincronizarWiki();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoComentario.trim()) return;
    const texto = novoComentario.trim();
    const mencoes = idsMencionados(texto, pessoas, escolhidos);
    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: taskId,
        content: texto,
        created_by_label: currentUserLabel,
        mentions: mencoes,
      })
      .select()
      .single();
    if (!error && data) {
      if (mencoes.length > 0) avisarMencao(data.id).catch(() => {});
      setEscolhidos([]);
      const proximos = comentarios.some((cm) => cm.id === data.id)
        ? comentarios
        : [...comentarios, data];
      setComentarios(proximos);
      setNovoComentario("");
      syncComentariosWiki(supabase, pageId, proximos).catch(() => {});
    }
  }

  return (
    <div>
      <div className={`mb-3 space-y-2 overflow-y-auto ${listaAlta ? "max-h-[52vh]" : "max-h-64"}`}>
        {comentarios.map((c) => (
          <div key={c.id} className="group rounded-lg bg-canvas px-3 py-2">
            {editandoId === c.id ? (
              <div>
                <MencaoInput
                  multilinha
                  linhas={3}
                  autoFocus
                  value={textoEditado}
                  onChange={setTextoEditado}
                  pessoas={pessoas}
                  aoEscolher={(id) => setEscolhidosEdicao((atual) => [...atual, id])}
                  ariaLabel="Editar comentário"
                  aoTeclar={(e) => {
                    if (e.key === "Escape") setEditandoId(null);
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) salvarEdicao(c);
                  }}
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
                <div className="mt-1.5 flex justify-end gap-2">
                  <button type="button" onClick={() => setEditandoId(null)} className="rounded-md px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-hover">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => salvarEdicao(c)} className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-navy hover:bg-brand-hover">
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm text-ink">
                <TextoComMencoes
                  texto={c.content}
                  nomes={[
                    ...(c.mentions ?? []).flatMap((id) => {
                      const p = pessoas.find((x) => x.id === id);
                      return p ? [nomeParaMencao(p)] : [];
                    }),
                    MENCAO_TODOS.name ?? "Todos",
                  ]}
                />
              </p>
            )}
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[10px] text-ink-muted">
                {c.created_by_label ?? "Alguém"} · {new Date(c.created_at).toLocaleString("pt-BR")}
                {c.edited_at && " · editado"}
              </p>
              {podeMexer(c) && editandoId !== c.id && (
                <div className="flex gap-2 text-[11px] text-ink-muted">
                  <button
                    type="button"
                    onClick={() => {
                      setEditandoId(c.id);
                      setTextoEditado(c.content);
                      setEscolhidosEdicao([]);
                    }}
                    className="hover:text-ink hover:underline"
                  >
                    Editar
                  </button>
                  <button type="button" onClick={() => excluir(c)} className="hover:text-red-500 hover:underline">
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {comentarios.length === 0 && (
          <p className="text-xs text-ink-muted">Nenhum comentário ainda.</p>
        )}
      </div>
      <form onSubmit={enviar} className="flex gap-2">
        <MencaoInput
          value={novoComentario}
          onChange={setNovoComentario}
          pessoas={pessoas}
          aoEscolher={(id) => setEscolhidos((atual) => [...atual, id])}
          ariaLabel="Novo comentário"
          placeholder="Escreva um comentário... (use @ pra mencionar alguém)"
          className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-navy hover:bg-brand-hover"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

// Texto do comentário com os nomes mencionados em destaque (e os links
// clicáveis, como antes).
function TextoComMencoes({ texto, nomes }: { texto: string; nomes: string[] }) {
  return (
    <>
      {partirPorMencoes(texto, nomes).map((parte, i) =>
        parte.mencao ? (
          <span key={i} className="rounded bg-cal/15 px-1 font-medium text-cal">
            {parte.texto}
          </span>
        ) : (
          <TextoComLinks key={i} texto={parte.texto} />
        )
      )}
    </>
  );
}

// Aba "Copywrite": o texto da peça (legenda, roteiro, chamada) escrito e
// revisado dentro da própria tarefa. Salva sozinho ao sair do campo.
function CopyTab({
  valorHtml,
  onSalvar,
  aoEnviarImagem,
}: {
  valorHtml: string;
  // Devolve se gravou.
  onSalvar: (html: string, texto: string) => Promise<boolean> | boolean;
  aoEnviarImagem?: (arquivo: File) => Promise<string | null>;
}) {
  const [estado, setEstado] = useState<"salvo" | "salvando" | "sujo">("salvo");
  const [copiado, setCopiado] = useState(false);
  // O texto puro só existe no navegador (htmlParaTexto usa o DOM).
  const [texto, setTexto] = useState("");
  useEffect(() => setTexto(htmlParaTexto(valorHtml)), [valorHtml]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sem permissão da área de transferência: a pessoa copia na mão.
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">Copywrite</p>
        <span className="text-[11px] text-ink-muted">
          {estado === "salvando" ? "Salvando..." : estado === "sujo" ? "Alterações não salvas" : "Salvo"}
        </span>
      </div>
      <EditorDeTexto
        valorHtml={valorHtml}
        rotulo="Copywrite"
        comCorretor
        placeholder="Escreva aqui a copy da peça: legenda, roteiro, headline, chamada..."
        aoEnviarImagem={aoEnviarImagem}
        aoMudar={(h) => {
          setTexto(htmlParaTexto(h));
          setEstado("sujo");
        }}
        aoSair={async (h, mudou) => {
          if (!mudou) {
            setEstado("salvo");
            return;
          }
          setEstado("salvando");
          const gravou = await onSalvar(h, htmlParaTexto(h));
          setEstado(gravou ? "salvo" : "sujo");
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] tabular-nums text-ink-muted">
          {texto.length.toLocaleString("pt-BR")} caracteres
        </span>
        <button
          type="button"
          onClick={copiar}
          disabled={!texto.trim()}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copiado ? "Copiado!" : "Copiar texto"}
        </button>
      </div>
    </div>
  );
}

function contadorDaAba(aba: Aba, r: ResumoTarefa): string | null {
  if (aba === "checklist" && r.checklistTotal) return `${r.checklistFeitos}/${r.checklistTotal}`;
  if (aba === "subtarefas" && r.subtarefasTotal) return `${r.subtarefasFeitas}/${r.subtarefasTotal}`;
  if (aba === "comentarios" && r.comentarios) return String(r.comentarios);
  if (aba === "anexos" && r.anexos) return String(r.anexos);
  return null;
}

// Resumo na aba Detalhes (a que abre primeiro): mostra o checklist — dá pra
// marcar os itens daqui mesmo —, os últimos comentários e os anexos, pra
// ninguém precisar abrir aba por aba pra descobrir o que a tarefa tem.
function ResumoDaTarefa({
  taskId,
  pageId,
  resumo,
  onAbrir,
  onMudou,
}: {
  taskId: string;
  pageId: string | null;
  resumo: ResumoTarefa;
  onAbrir: (aba: Aba) => void;
  onMudou: () => void;
}) {
  const supabase = createClient();
  const [itens, setItens] = useState<ChecklistItem[]>([]);
  const [comentarios, setComentarios] = useState<TaskComment[]>([]);
  const [anexos, setAnexos] = useState<TaskAttachment[]>([]);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      supabase.from("task_checklist_items").select("*").eq("task_id", taskId).order("position"),
      supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(2),
      supabase.from("task_attachments").select("*").eq("task_id", taskId).order("created_at"),
    ]).then(([c, m, a]) => {
      if (!ativo) return;
      setItens((c.data as ChecklistItem[]) ?? []);
      setComentarios(((m.data as TaskComment[]) ?? []).reverse());
      setAnexos((a.data as TaskAttachment[]) ?? []);
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function alternar(item: ChecklistItem) {
    const proximos = itens.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i));
    setItens(proximos);
    await supabase.from("task_checklist_items").update({ done: !item.done }).eq("id", item.id);
    syncChecklistWiki(supabase, pageId, proximos).catch(() => {});
    onMudou();
  }

  if (itens.length === 0 && comentarios.length === 0 && anexos.length === 0) return null;

  const feitos = itens.filter((i) => i.done).length;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-canvas p-3">
      {itens.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">
              ✅ Checklist <span className="font-normal text-ink-muted">({feitos}/{itens.length})</span>
            </span>
            <button type="button" onClick={() => onAbrir("checklist")} className="text-xs font-medium text-brand-forte hover:underline">
              Editar
            </button>
          </div>
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full bg-brand-forte" style={{ width: `${(feitos / itens.length) * 100}%` }} />
          </div>
          <ul className="space-y-1">
            {itens.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={item.done} onChange={() => alternar(item)} />
                  <span className={item.done ? "text-ink-muted line-through" : "text-ink"}>{item.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {comentarios.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">
              💬 Comentários <span className="font-normal text-ink-muted">({resumo.comentarios || comentarios.length})</span>
            </span>
            <button type="button" onClick={() => onAbrir("comentarios")} className="text-xs font-medium text-brand-forte hover:underline">
              Ver todos
            </button>
          </div>
          <ul className="space-y-1.5">
            {comentarios.map((c) => (
              <li key={c.id} className="rounded-lg bg-surface px-2.5 py-1.5 text-sm">
                <span className="text-xs font-medium text-ink-muted">{c.created_by_label ?? "Alguém"}: </span>
                <span className="whitespace-pre-wrap break-words text-ink"><TextoComLinks texto={c.content} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {anexos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-ink">📎 Anexos:</span>
          {anexos.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onAbrir("anexos")}
              className="max-w-[200px] truncate rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink hover:border-brand"
            >
              {a.file_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
