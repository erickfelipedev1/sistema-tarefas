"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { linkDoArquivo } from "@/lib/arquivos";
import { nomeSeguro } from "@/lib/nome-arquivo";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { ImageIcon, SendIcon, Trash2Icon, XIcon } from "./ui/icons";

const BUCKET = "pedido-imagens";
const MAX_IMAGENS = 10;

// Pedidos de alteração no d.hub (migration 0088). As regras de quem aprova e
// quem faz moram no banco; a tela só mostra os botões de quem pode.
type StatusDoPedido = "aguardando" | "aprovado" | "recusado" | "em_andamento" | "feito";

interface Pedido {
  id: string;
  titulo: string;
  descricao: string | null;
  status: StatusDoPedido;
  motivo_recusa: string | null;
  created_by: string | null;
  created_by_label: string | null;
  decidido_por: string | null;
  decidido_em: string | null;
  feito_em: string | null;
  created_at: string;
  // Prints e exemplos (migration 0089): caminhos no bucket "pedido-imagens".
  imagens?: string[];
}

interface ImagemNova {
  caminho: string;
  previa: string;
}

const STATUS: Record<StatusDoPedido, { rotulo: string; classe: string }> = {
  aguardando: { rotulo: "Aguardando aprovação", classe: "bg-warning-light text-warning" },
  aprovado: { rotulo: "Aprovado", classe: "bg-brand-light text-brand-forte" },
  em_andamento: { rotulo: "Em andamento", classe: "bg-cal/15 text-cal" },
  feito: { rotulo: "Feito", classe: "bg-success-light text-success" },
  recusado: { rotulo: "Recusado", classe: "bg-danger-light text-danger" },
};

const GRUPOS: { status: StatusDoPedido; titulo: string }[] = [
  { status: "aguardando", titulo: "Aguardando aprovação" },
  { status: "aprovado", titulo: "Aprovados, pra fazer" },
  { status: "em_andamento", titulo: "Em andamento" },
  { status: "feito", titulo: "Feitos" },
  { status: "recusado", titulo: "Recusados" },
];

const campo =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

function dataCurta(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function PedidosDhub({
  euId,
  euRotulo,
  aprova,
  executa,
  nomeDeQuemAprova,
}: {
  euId: string;
  euRotulo: string;
  aprova: boolean;
  executa: boolean;
  nomeDeQuemAprova: string;
}) {
  const supabase = createClient();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [verFeitos, setVerFeitos] = useState(false);
  const [imagens, setImagens] = useState<ImagemNova[]>([]);
  const [subindo, setSubindo] = useState(0);
  const seletor = useRef<HTMLInputElement>(null);

  // Cada imagem sobe na hora (pasta de quem envia); o pedido guarda os caminhos.
  async function adicionarImagens(arquivos: File[]) {
    const validas = arquivos.filter((a) => a.type.startsWith("image/"));
    if (validas.length === 0) return;
    const cabem = MAX_IMAGENS - imagens.length - subindo;
    if (cabem <= 0) return setAviso(`No máximo ${MAX_IMAGENS} imagens por pedido.`);
    const lote = validas.slice(0, cabem);
    setAviso(validas.length > cabem ? `No máximo ${MAX_IMAGENS} imagens por pedido: entraram ${cabem}.` : null);
    setSubindo((n) => n + lote.length);
    for (const arquivo of lote) {
      if (arquivo.size > 10 * 1024 * 1024) {
        setAviso(`"${arquivo.name}" passa de 10 MB.`);
        setSubindo((n) => n - 1);
        continue;
      }
      const nome = arquivo.name && arquivo.name !== "image.png" ? arquivo.name : `print.${arquivo.type.split("/")[1] || "png"}`;
      const caminho = `${euId}/${Date.now()}-${nomeSeguro(nome)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type });
      setSubindo((n) => n - 1);
      if (error) {
        setAviso(`Não deu pra enviar a imagem: ${error.message}`);
        continue;
      }
      setImagens((atual) => [...atual, { caminho, previa: URL.createObjectURL(arquivo) }]);
    }
  }

  async function tirarImagem(img: ImagemNova) {
    setImagens((atual) => atual.filter((i) => i.caminho !== img.caminho));
    URL.revokeObjectURL(img.previa);
    await supabase.storage.from(BUCKET).remove([img.caminho]);
  }

  function colarImagem(e: React.ClipboardEvent) {
    const arquivos = Array.from(e.clipboardData.files ?? []).filter((a) => a.type.startsWith("image/"));
    if (arquivos.length === 0) return;
    e.preventDefault();
    adicionarImagens(arquivos);
  }

  useEffect(() => {
    let ativo = true;
    supabase
      .from("dhub_pedidos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro("Não deu pra carregar os pedidos. Confira se a migration 0088_pedidos_dhub.sql já foi rodada.");
        setPedidos((data ?? []) as Pedido[]);
        setCarregando(false);
      });
    const canal = supabase
      .channel("dhub-pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "dhub_pedidos" }, (payload) => {
        setPedidos((atual) => {
          if (payload.eventType === "DELETE") return atual.filter((p) => p.id !== (payload.old as Pedido).id);
          const novo = payload.new as Pedido;
          return atual.some((p) => p.id === novo.id)
            ? atual.map((p) => (p.id === novo.id ? { ...p, ...novo } : p))
            : [novo, ...atual];
        });
      })
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const porStatus = useMemo(() => {
    const mapa: Record<StatusDoPedido, Pedido[]> = { aguardando: [], aprovado: [], em_andamento: [], feito: [], recusado: [] };
    for (const p of pedidos) mapa[p.status]?.push(p);
    return mapa;
  }, [pedidos]);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return setAviso("Diga em poucas palavras o que você quer mudar.");
    if (subindo > 0) return setAviso("Espere as imagens terminarem de subir.");
    setEnviando(true);
    setAviso(null);
    const { data, error } = await supabase
      .from("dhub_pedidos")
      .insert({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        created_by: euId,
        created_by_label: euRotulo.slice(0, 80) || null,
        ...(imagens.length ? { imagens: imagens.map((i) => i.caminho) } : {}),
      })
      .select()
      .single();
    setEnviando(false);
    if (error || !data) return setAviso(`Não deu pra enviar o pedido. ${error?.message ?? ""}`.trim());
    const novo = data as Pedido;
    setPedidos((atual) => (atual.some((p) => p.id === novo.id) ? atual : [novo, ...atual]));
    setTitulo("");
    setDescricao("");
    imagens.forEach((i) => URL.revokeObjectURL(i.previa));
    setImagens([]);
    setAviso(
      novo.status === "aprovado"
        ? "Pedido enviado e já aprovado. Foi pro Erick fazer."
        : `Pedido enviado. Agora aguarda a aprovação de ${nomeDeQuemAprova}.`
    );
  }

  async function mudar(p: Pedido, campos: Partial<Pedido>) {
    setErro(null);
    const antes = p;
    setPedidos((atual) => atual.map((x) => (x.id === p.id ? { ...x, ...campos } : x)));
    const { error } = await supabase.from("dhub_pedidos").update(campos).eq("id", p.id);
    if (error) {
      setPedidos((atual) => atual.map((x) => (x.id === p.id ? antes : x)));
      setErro(error.message);
    }
  }

  async function recusar(p: Pedido) {
    const motivo = window.prompt("Por que recusar? (opcional, quem pediu vai ver)") ?? null;
    if (motivo === null) return;
    await mudar(p, { status: "recusado", motivo_recusa: motivo.trim() || null });
  }

  async function apagar(p: Pedido) {
    if (!window.confirm(`Apagar o pedido "${p.titulo}"?`)) return;
    const { error } = await supabase.from("dhub_pedidos").delete().eq("id", p.id);
    if (error) return setErro("Não deu pra apagar o pedido.");
    setPedidos((atual) => atual.filter((x) => x.id !== p.id));
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={pedir}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) e.preventDefault();
        }}
        onDrop={(e) => {
          const arquivos = Array.from(e.dataTransfer.files ?? []);
          if (arquivos.some((a) => a.type.startsWith("image/"))) {
            e.preventDefault();
            adicionarImagens(arquivos);
          }
        }}
        data-mov="card"
        className="space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-5"
      >
        <div>
          <h2 className="text-sm font-semibold text-ink">Pedir uma alteração no d.hub</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {aprova
              ? "Seus pedidos já entram aprovados e vão direto pro Erick."
              : `O pedido vai pra aprovação de ${nomeDeQuemAprova}; aprovado, vai pro Erick fazer.`}
          </p>
        </div>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={160}
          placeholder="O que você quer mudar? Ex.: Filtro por cliente no Calendário de postagem"
          aria-label="O que você quer mudar"
          className={campo}
        />
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onPaste={colarImagem}
          maxLength={5000}
          rows={3}
          placeholder="Detalhes (opcional): onde, como deveria funcionar, um exemplo... Dá pra colar um print aqui (Ctrl+V)."
          aria-label="Detalhes do pedido"
          className={campo}
        />
        {(imagens.length > 0 || subindo > 0) && (
          <div className="flex flex-wrap gap-2">
            {imagens.map((img) => (
              <div key={img.caminho} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.previa} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => tirarImagem(img)}
                  aria-label="Tirar imagem"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
            {Array.from({ length: subindo }, (_, i) => (
              <div key={`subindo-${i}`} className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-line text-[10px] text-ink-muted">
                Enviando...
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => seletor.current?.click()} disabled={imagens.length + subindo >= MAX_IMAGENS}>
              <ImageIcon className="h-3.5 w-3.5" />
              Adicionar imagens
            </Button>
            <input
              ref={seletor}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const arquivos = Array.from(e.target.files ?? []);
                e.target.value = "";
                adicionarImagens(arquivos);
              }}
            />
            {aviso && <p className="text-xs text-ink-muted">{aviso}</p>}
          </div>
          <Button type="submit" size="sm" disabled={enviando || subindo > 0}>
            <SendIcon className="h-3.5 w-3.5" />
            {enviando ? "Enviando..." : "Enviar pedido"}
          </Button>
        </div>
      </form>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      {carregando ? (
        <p className="py-6 text-center text-sm text-ink-muted">Carregando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState icon={<SendIcon className="h-6 w-6" />} title="Nenhum pedido ainda" description="Os pedidos de alteração aparecem aqui, com o andamento de cada um." />
        </div>
      ) : (
        GRUPOS.filter((g) => porStatus[g.status].length > 0).map((g) => {
          const recolhido = (g.status === "feito" || g.status === "recusado") && !verFeitos;
          return (
            <section key={g.status} data-mov="card">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {g.titulo}
                <span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium normal-case">{porStatus[g.status].length}</span>
                {(g.status === "feito" || g.status === "recusado") && (
                  <button type="button" onClick={() => setVerFeitos((v) => !v)} className="normal-case tracking-normal text-brand-forte hover:underline">
                    {recolhido ? "Mostrar" : "Esconder"}
                  </button>
                )}
              </h2>
              {!recolhido && (
                <div className="space-y-2">
                  {porStatus[g.status].map((p) => (
                    <CartaoDoPedido
                      key={p.id}
                      pedido={p}
                      euId={euId}
                      aprova={aprova}
                      executa={executa}
                      aoAprovar={() => mudar(p, { status: "aprovado" })}
                      aoRecusar={() => recusar(p)}
                      aoReabrir={() => mudar(p, { status: "aguardando" })}
                      aoMudarAndamento={(s) => mudar(p, { status: s })}
                      aoMudarDescricao={(d) => mudar(p, { descricao: d })}
                      aoApagar={() => apagar(p)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function CartaoDoPedido({
  pedido: p,
  euId,
  aprova,
  executa,
  aoAprovar,
  aoRecusar,
  aoReabrir,
  aoMudarAndamento,
  aoMudarDescricao,
  aoApagar,
}: {
  pedido: Pedido;
  euId: string;
  aprova: boolean;
  executa: boolean;
  aoAprovar: () => void;
  aoRecusar: () => void;
  aoReabrir: () => void;
  aoMudarAndamento: (s: StatusDoPedido) => void;
  aoMudarDescricao: (descricao: string) => void;
  aoApagar: () => void;
}) {
  const status = STATUS[p.status];
  const podeApagar = aprova || (p.created_by === euId && p.status === "aguardando");
  const faz = executa || aprova;
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 break-words text-sm font-semibold text-ink">{p.titulo}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.classe}`}>{status.rotulo}</span>
      </div>
      {p.descricao && (
        <DescricaoDoPedido texto={p.descricao} podeRiscar={executa || aprova} aoMudar={aoMudarDescricao} />
      )}
      {(p.imagens ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {(p.imagens ?? []).map((caminho) => (
            <a
              key={caminho}
              href={linkDoArquivo(BUCKET, caminho)}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir a imagem"
              className="block h-20 w-20 overflow-hidden rounded-lg border border-line bg-canvas hover:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={linkDoArquivo(BUCKET, caminho)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {p.status === "recusado" && p.motivo_recusa && (
        <p className="mt-2 rounded-lg bg-danger-light px-3 py-2 text-xs text-danger">Motivo: {p.motivo_recusa}</p>
      )}
      <p className="mt-2 text-[11px] text-ink-muted">
        Pedido por {p.created_by_label ?? "alguém"} em {dataCurta(p.created_at)}
        {p.feito_em ? ` · feito em ${dataCurta(p.feito_em)}` : ""}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {p.status === "aguardando" && aprova && (
          <>
            <Button size="sm" onClick={aoAprovar}>
              Aprovar
            </Button>
            <Button size="sm" variant="danger" onClick={aoRecusar}>
              Recusar
            </Button>
          </>
        )}
        {p.status === "recusado" && aprova && (
          <Button size="sm" variant="secondary" onClick={aoReabrir}>
            Reabrir
          </Button>
        )}
        {p.status === "aprovado" && aprova && (
          <Button size="sm" variant="ghost" onClick={aoReabrir} title="Desfaz a aprovação: volta pra aguardando">
            Desfazer aprovação
          </Button>
        )}
        {p.status === "aprovado" && faz && (
          <>
            <Button size="sm" variant="secondary" onClick={() => aoMudarAndamento("em_andamento")}>
              Começar
            </Button>
            <Button size="sm" onClick={() => aoMudarAndamento("feito")}>
              Marcar como feito
            </Button>
          </>
        )}
        {p.status === "em_andamento" && faz && (
          <Button size="sm" onClick={() => aoMudarAndamento("feito")}>
            Marcar como feito
          </Button>
        )}
        {p.status === "feito" && faz && (
          <Button size="sm" variant="ghost" onClick={() => aoMudarAndamento("aprovado")}>
            Reabrir
          </Button>
        )}
        {podeApagar && (
          <button
            type="button"
            onClick={aoApagar}
            aria-label="Apagar pedido"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-light hover:text-danger"
          >
            <Trash2Icon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

// Linha feita = entre ~~ ~~ (migration 0091). Quem faz ou quem aprova clica
// pra riscar/desriscar; o resto só vê.
const FEITA = /^\s*~~([\s\S]*)~~\s*$/;

function DescricaoDoPedido({
  texto,
  podeRiscar,
  aoMudar,
}: {
  texto: string;
  podeRiscar: boolean;
  aoMudar: (descricao: string) => void;
}) {
  const linhas = texto.split("\n");
  const temItens = linhas.filter((l) => l.trim()).length > 1;
  if (!temItens && !FEITA.test(texto)) {
    return <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-muted">{texto}</p>;
  }

  function alternar(indice: number) {
    const novas = linhas.map((l, i) => {
      if (i !== indice) return l;
      const feita = FEITA.exec(l);
      return feita ? feita[1] : `~~${l}~~`;
    });
    aoMudar(novas.join("\n"));
  }

  return (
    <ul className="mt-1 space-y-0.5">
      {linhas.map((l, i) => {
        if (!l.trim()) return <li key={i} className="h-2" aria-hidden="true" />;
        const feita = FEITA.exec(l);
        const conteudo = feita ? feita[1] : l;
        const classe = `whitespace-pre-wrap break-words text-sm ${feita ? "text-ink-muted/70 line-through" : "text-ink-muted"}`;
        return (
          <li key={i}>
            {podeRiscar ? (
              <button
                type="button"
                onClick={() => alternar(i)}
                title={feita ? "Desmarcar (ainda não foi feito)" : "Marcar como feito"}
                className={`flex w-full items-start gap-1.5 rounded px-1 text-left hover:bg-surface-hover ${classe}`}
              >
                <span className={`mt-0.5 flex-shrink-0 text-xs ${feita ? "text-success" : "text-ink-muted/50"}`}>{feita ? "✓" : "○"}</span>
                <span className="min-w-0 flex-1">{conteudo}</span>
              </button>
            ) : (
              <p className={`flex items-start gap-1.5 px-1 ${classe}`}>
                {feita && <span className="mt-0.5 flex-shrink-0 text-xs text-success">✓</span>}
                <span className="min-w-0 flex-1">{conteudo}</span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
