"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { linkDoArquivo } from "@/lib/arquivos";
import { nomeSeguro } from "@/lib/nome-arquivo";
import { formatarDataBR, formatarMoeda, formatarTamanho } from "@/lib/format";
import {
  ACEITA_ANEXO,
  BUCKET_DOS_RESSARCIMENTOS as BUCKET,
  EMPRESAS,
  LIMITE_DO_ANEXO,
  MAX_ANEXOS,
  MOTIVOS,
  ORDEM_DAS_EMPRESAS,
  STATUS_DO_RESSARCIMENTO,
  csvDosRessarcimentos,
  hojeSP,
  lerValor,
  normalizarRessarcimento,
  rotuloDoLote,
  type AnexoDoRessarcimento,
  type EmpresaDoRessarcimento,
  type MotivoDoRessarcimento,
  type Ressarcimento,
} from "@/lib/ressarcimento";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { CopyIcon, DownloadIcon, FileTextIcon, PaperclipIcon, SendIcon, Trash2Icon, WalletIcon, XIcon } from "../ui/icons";

const campo =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const PENDENTES = "pendentes";

interface ArquivoNovo {
  id: string;
  arquivo: File;
  previa: string | null;
}

function somar(itens: Ressarcimento[]) {
  return itens.reduce((t, r) => t + r.valor, 0);
}

export default function RessarcimentoView({
  euId,
  meuNome,
  financeiro,
  loteInicial,
}: {
  euId: string;
  meuNome: string;
  financeiro: boolean;
  loteInicial: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [itens, setItens] = useState<Ressarcimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nomesDeQuemLancou, setNomesDeQuemLancou] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  // Formulário
  const [empresa, setEmpresa] = useState<EmpresaDoRessarcimento | "">("");
  const [nome, setNome] = useState(meuNome);
  const [pix, setPix] = useState("");
  const [data, setData] = useState(hojeSP());
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState<MotivoDoRessarcimento>("transporte");
  const [descricao, setDescricao] = useState("");
  const [arquivos, setArquivos] = useState<ArquivoNovo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const hoje = hojeSP();

  useEffect(() => {
    let ativo = true;
    supabase
      .from("ressarcimentos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000)
      .then(({ data: linhas, error }) => {
        if (!ativo) return;
        if (error) setErro("Não deu pra carregar os ressarcimentos. Confira se a migration 0123_ressarcimentos.sql já foi rodada.");
        const lidas = (linhas ?? []).map(normalizarRessarcimento);
        setItens(lidas);
        // Chave PIX do meu lançamento mais recente (a lista já vem do mais novo pro mais antigo).
        const ultima = lidas.find((r) => r.solicitante_id === euId);
        if (ultima) setPix((atual) => (atual ? atual : ultima.pix));
        setCarregando(false);
      });
    if (financeiro) {
      supabase
        .from("profiles")
        .select("id, name, username")
        .then(({ data: perfis }) => {
          if (!ativo) return;
          setNomesDeQuemLancou(
            Object.fromEntries((perfis ?? []).map((p) => [p.id as string, ((p.name as string) || (p.username as string) || "").trim()]))
          );
        });
    }
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function adicionarArquivos(novos: File[]) {
    const validos = novos.filter((a) => a.type.startsWith("image/") || a.type === "application/pdf");
    if (validos.length === 0) return setAviso("Só imagem ou PDF.");
    const cabem = MAX_ANEXOS - arquivos.length;
    if (cabem <= 0) return setAviso(`No máximo ${MAX_ANEXOS} comprovantes por ressarcimento.`);
    const aceitos: ArquivoNovo[] = [];
    let maiorQueOLimite = "";
    for (const arquivo of validos) {
      if (arquivo.size > LIMITE_DO_ANEXO) {
        maiorQueOLimite = `"${arquivo.name}" passa de 10 MB.`;
        continue;
      }
      if (aceitos.length >= cabem) break;
      aceitos.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        arquivo,
        previa: arquivo.type.startsWith("image/") ? URL.createObjectURL(arquivo) : null,
      });
    }
    setAviso(
      maiorQueOLimite ||
        (validos.length > cabem ? `No máximo ${MAX_ANEXOS} comprovantes: entraram ${aceitos.length}.` : null)
    );
    setArquivos((atual) => [...atual, ...aceitos]);
  }

  function tirarArquivo(a: ArquivoNovo) {
    if (a.previa) URL.revokeObjectURL(a.previa);
    setArquivos((atual) => atual.filter((x) => x.id !== a.id));
  }

  function colar(e: React.ClipboardEvent) {
    const colados = Array.from(e.clipboardData.files ?? []).filter(
      (a) => a.type.startsWith("image/") || a.type === "application/pdf"
    );
    if (colados.length === 0) return;
    e.preventDefault();
    adicionarArquivos(colados);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setSucesso(null);
    if (!empresa) return setAviso("Escolha a empresa.");
    if (nome.trim().length < 2) return setAviso("Informe o nome da pessoa para ressarcimento.");
    if (pix.trim().length < 3) return setAviso("Informe a chave PIX.");
    if (!data) return setAviso("Informe a data da despesa.");
    if (data > hojeSP()) return setAviso("A data da despesa não pode ser no futuro.");
    const valorLido = lerValor(valor);
    if (valorLido === null) return setAviso("Informe um valor válido, por exemplo 25,90.");
    if (!descricao.trim()) return setAviso("Descreva a despesa.");

    setEnviando(true);
    setAviso(null);
    const subidos: AnexoDoRessarcimento[] = [];
    for (let i = 0; i < arquivos.length; i++) {
      const { arquivo } = arquivos[i];
      const nomeDoArquivo = arquivo.name && arquivo.name !== "image.png" ? arquivo.name : `comprovante.${arquivo.type.split("/")[1] || "png"}`;
      const path = `${euId}/${Date.now()}-${i}-${nomeSeguro(nomeDoArquivo)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, arquivo, { contentType: arquivo.type });
      if (error) {
        if (subidos.length) await supabase.storage.from(BUCKET).remove(subidos.map((s) => s.path));
        setEnviando(false);
        return setAviso(`Não deu pra enviar o comprovante "${nomeDoArquivo}": ${error.message}`);
      }
      subidos.push({ path, name: nomeDoArquivo, size: arquivo.size, type: arquivo.type });
    }

    const { data: criado, error } = await supabase
      .from("ressarcimentos")
      .insert({
        solicitante_id: euId,
        empresa,
        nome: nome.trim(),
        pix: pix.trim(),
        data_despesa: data,
        valor: valorLido,
        motivo,
        descricao: descricao.trim(),
        anexos: subidos,
      })
      .select()
      .single();
    setEnviando(false);
    if (error || !criado) {
      if (subidos.length) await supabase.storage.from(BUCKET).remove(subidos.map((s) => s.path));
      return setAviso(`Não deu pra enviar o ressarcimento. ${error?.message ?? ""}`.trim());
    }
    const novo = normalizarRessarcimento(criado);
    setItens((atual) => (atual.some((r) => r.id === novo.id) ? atual : [novo, ...atual]));
    arquivos.forEach((a) => a.previa && URL.revokeObjectURL(a.previa));
    setArquivos([]);
    setData(hojeSP());
    setValor("");
    setMotivo("transporte");
    setDescricao("");
    setSucesso("Ressarcimento enviado. Ele vai pro financeiro no próximo fechamento (dia 1 ou 16).");
  }

  async function apagar(r: Ressarcimento) {
    if (!window.confirm(`Apagar o ressarcimento de ${formatarMoeda(r.valor)}?`)) return;
    setErro(null);
    const { data: apagados, error } = await supabase.from("ressarcimentos").delete().eq("id", r.id).select("id");
    if (error) return setErro("Não deu pra apagar o ressarcimento.");
    if (!apagados || apagados.length === 0) {
      // Já não está pendente (ex.: a quinzena fechou com a página aberta): não
      // apaga nada e mostra o estado atual.
      const { data: atual } = await supabase.from("ressarcimentos").select("*").eq("id", r.id).maybeSingle();
      if (atual) {
        const linha = normalizarRessarcimento(atual);
        setItens((lista) => lista.map((x) => (x.id === linha.id ? linha : x)));
      }
      return setErro("Esse ressarcimento já foi enviado ao financeiro e não pode mais ser apagado.");
    }
    setItens((atual) => atual.filter((x) => x.id !== r.id));
    if (r.anexos.length) await supabase.storage.from(BUCKET).remove(r.anexos.map((a) => a.path));
  }

  // Ação do financeiro: grava e troca a linha local pela devolvida. Devolve o
  // erro (ou null) pra quem marca vários de uma vez juntar as falhas.
  async function gravar(r: Ressarcimento, campos: Partial<Ressarcimento>): Promise<string | null> {
    const { data: linha, error } = await supabase.from("ressarcimentos").update(campos).eq("id", r.id).select().single();
    if (error || !linha) return `Não deu pra atualizar o ressarcimento. ${error?.message ?? ""}`.trim();
    const nova = normalizarRessarcimento(linha);
    setItens((atual) => atual.map((x) => (x.id === nova.id ? nova : x)));
    return null;
  }

  async function mudar(r: Ressarcimento, campos: Partial<Ressarcimento>) {
    setErro(null);
    const falha = await gravar(r, campos);
    if (falha) setErro(falha);
  }

  async function pagarVarios(lista: Ressarcimento[]) {
    setErro(null);
    let falhas = 0;
    for (const r of lista) if (await gravar(r, { status: "pago" })) falhas += 1;
    if (falhas > 0) {
      setErro(`${falhas} de ${lista.length} não foram marcados como pagos. Recarregue a página e confira.`);
    }
  }

  const meus = useMemo(() => itens.filter((r) => r.solicitante_id === euId), [itens, euId]);
  const mesAtual = hoje.slice(0, 7);
  const totalPendente = somar(meus.filter((r) => r.status === "pendente"));
  const totalPagoNoMes = somar(
    meus.filter((r) => r.status === "pago" && r.pago_em && new Date(r.pago_em).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7) === mesAtual)
  );

  return (
    <div className="space-y-6">
      <form
        onSubmit={enviar}
        onPaste={colar}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) e.preventDefault();
        }}
        onDrop={(e) => {
          const soltos = Array.from(e.dataTransfer.files ?? []);
          if (soltos.length) {
            e.preventDefault();
            adicionarArquivos(soltos);
          }
        }}
        data-mov="card"
        className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
      >
        <h2 className="text-sm font-semibold text-ink">Novo ressarcimento</h2>

        <div>
          <p className="mb-1 text-xs font-medium text-ink">Empresa *</p>
          <div className="grid grid-cols-2 gap-2">
            {ORDEM_DAS_EMPRESAS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmpresa(e)}
                aria-pressed={empresa === e}
                className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                  empresa === e ? "border-brand bg-brand-light text-brand-forte" : "border-line bg-surface text-ink hover:bg-surface-hover"
                }`}
              >
                {EMPRESAS[e]}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">Nome da pessoa para ressarcimento *</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} autoComplete="name" className={campo} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">Chave PIX *</span>
          <input value={pix} onChange={(e) => setPix(e.target.value)} maxLength={140} autoComplete="off" className={campo} />
          <span className="mt-1 block text-[11px] text-ink-muted">CPF, e-mail, celular ou chave aleatória.</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">Data da despesa *</span>
            <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={campo} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">Valor (R$) *</span>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="25,90"
              autoComplete="off"
              className={campo}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">Motivo *</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDoRessarcimento)} className={campo}>
            {(Object.keys(MOTIVOS) as MotivoDoRessarcimento[]).map((m) => (
              <option key={m} value={m}>
                {MOTIVOS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">Descrição *</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ex.: Uber do escritório até o cliente X para a gravação"
            className={campo}
          />
        </label>

        <div>
          <p className="mb-1 text-xs font-medium text-ink">Comprovantes (recibo, nota ou comprovante do PIX)</p>
          {arquivos.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {arquivos.map((a) => (
                <div key={a.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line bg-canvas">
                  {a.previa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.previa} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-ink-muted">
                      <FileTextIcon className="h-6 w-6" />
                      <span className="w-full truncate text-center text-[10px]">{a.arquivo.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => tirarArquivo(a)}
                    aria-label="Tirar comprovante"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={() => seletor.current?.click()} disabled={arquivos.length >= MAX_ANEXOS}>
            <PaperclipIcon className="h-3.5 w-3.5" />
            Adicionar comprovante
          </Button>
          <input
            ref={seletor}
            type="file"
            accept={ACEITA_ANEXO}
            multiple
            hidden
            onChange={(e) => {
              const escolhidos = Array.from(e.target.files ?? []);
              e.target.value = "";
              adicionarArquivos(escolhidos);
            }}
          />
          <p className="mt-1 text-[11px] text-ink-muted">
            Até {MAX_ANEXOS} arquivos (imagem ou PDF, 10 MB cada). Dá pra soltar ou colar aqui. Sem comprovante o financeiro pode recusar.
          </p>
        </div>

        {aviso && <p className="text-xs text-danger">{aviso}</p>}
        {sucesso && <p className="rounded-lg bg-success-light px-3 py-2 text-xs text-success">{sucesso}</p>}

        <Button type="submit" disabled={enviando} className="w-full sm:w-auto">
          <SendIcon className="h-3.5 w-3.5" />
          {enviando ? "Enviando..." : "Enviar ressarcimento"}
        </Button>
      </form>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      <section data-mov="card" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Meus ressarcimentos</h2>
          {meus.length > 0 && (
            <p className="text-xs text-ink-muted">
              Pendente: <strong className="text-ink">{formatarMoeda(totalPendente)}</strong> · Pago no mês:{" "}
              <strong className="text-ink">{formatarMoeda(totalPagoNoMes)}</strong>
            </p>
          )}
        </div>
        {carregando ? (
          <p className="py-6 text-center text-sm text-ink-muted">Carregando...</p>
        ) : meus.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              icon={<WalletIcon className="h-6 w-6" />}
              title="Nenhum ressarcimento ainda"
              description="Os que você lançar aparecem aqui, com o andamento de cada um."
            />
          </div>
        ) : (
          meus.map((r) => <CartaoMeu key={r.id} r={r} aoApagar={() => apagar(r)} />)
        )}
      </section>

      {financeiro && !carregando && (
        <BlocoFinanceiro
          itens={itens}
          nomes={nomesDeQuemLancou}
          loteInicial={loteInicial}
          aoPagar={(r) => mudar(r, { status: "pago" })}
          aoPagarVarios={pagarVarios}
          aoDesfazer={(r) => mudar(r, { status: "enviado", observacao_financeiro: null })}
          aoRecusar={(r) => {
            const motivoDaRecusa = window.prompt("Por que recusar? (obrigatório, quem lançou vai ver)");
            if (motivoDaRecusa === null) return;
            const texto = motivoDaRecusa.trim();
            if (!texto) return setErro("Informe o motivo da recusa.");
            mudar(r, { status: "recusado", observacao_financeiro: texto.slice(0, 500) });
          }}
        />
      )}
    </div>
  );
}

function Comprovantes({ anexos }: { anexos: AnexoDoRessarcimento[] }) {
  if (anexos.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {anexos.map((a) => (
        <a
          key={a.path}
          href={linkDoArquivo(BUCKET, a.path)}
          target="_blank"
          rel="noopener noreferrer"
          title={`${a.name} (${formatarTamanho(a.size)})`}
          className="flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-canvas px-2 py-1 text-xs text-brand-forte hover:bg-surface-hover"
        >
          <PaperclipIcon className="h-3 w-3 flex-shrink-0" />
          <span className="max-w-[10rem] truncate">{a.name}</span>
        </a>
      ))}
    </div>
  );
}

function CartaoMeu({ r, aoApagar }: { r: Ressarcimento; aoApagar: () => void }) {
  const status = STATUS_DO_RESSARCIMENTO[r.status];
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{formatarMoeda(r.valor)}</p>
          <p className="text-xs text-ink-muted">
            {EMPRESAS[r.empresa]} · {formatarDataBR(r.data_despesa)} · {MOTIVOS[r.motivo]}
          </p>
        </div>
        <Badge tone={status.tom}>{status.rotulo}</Badge>
      </div>
      {r.descricao && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-muted">{r.descricao}</p>}
      <Comprovantes anexos={r.anexos} />
      <p className="mt-2 text-[11px] text-ink-muted">
        {r.status === "pendente" && "Vai pro financeiro no próximo fechamento (dia 1 ou 16)"}
        {r.status === "enviado" && `Enviado ao financeiro em ${formatarDataBR(r.lote)}`}
        {r.status === "pago" && `Pago em ${r.pago_em ? new Date(r.pago_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""}`}
        {r.status === "recusado" && `Recusado${r.observacao_financeiro ? `: ${r.observacao_financeiro}` : ""}`}
      </p>
      {r.status === "pendente" && (
        <div className="mt-3">
          <Button size="sm" variant="danger" onClick={aoApagar}>
            <Trash2Icon className="h-3.5 w-3.5" />
            Apagar
          </Button>
        </div>
      )}
    </article>
  );
}

function BlocoFinanceiro({
  itens,
  nomes,
  loteInicial,
  aoPagar,
  aoPagarVarios,
  aoDesfazer,
  aoRecusar,
}: {
  itens: Ressarcimento[];
  nomes: Record<string, string>;
  loteInicial: string | null;
  aoPagar: (r: Ressarcimento) => void;
  aoPagarVarios: (lista: Ressarcimento[]) => void;
  aoDesfazer: (r: Ressarcimento) => void;
  aoRecusar: (r: Ressarcimento) => void;
}) {
  const lotes = useMemo(
    () => Array.from(new Set(itens.map((r) => r.lote).filter((l): l is string => !!l))).sort().reverse(),
    [itens]
  );
  const [escolhido, setEscolhido] = useState<string>(() => loteInicial ?? PENDENTES);
  // Sem lote inicial, começa no mais recente (quando os dados já chegaram).
  const jaEscolheu = useRef(!!loteInicial);
  useEffect(() => {
    if (jaEscolheu.current) return;
    jaEscolheu.current = true;
    if (lotes.length > 0) setEscolhido(lotes[0]);
  }, [lotes]);

  const doLote = useMemo(
    () => itens.filter((r) => (escolhido === PENDENTES ? r.status === "pendente" : r.lote === escolhido)),
    [itens, escolhido]
  );

  function baixarCsv() {
    const csv = csvDosRessarcimentos(doLote, window.location.origin);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ressarcimentos-${escolhido === PENDENTES ? "pendentes" : escolhido}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section data-mov="card" className="space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Financeiro</h2>
        <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} aria-label="Lote" className={`${campo} !w-auto max-w-full`}>
          <option value={PENDENTES}>Pendentes (ainda não fechados)</option>
          {lotes.map((l) => (
            <option key={l} value={l}>
              {rotuloDoLote(l)}
            </option>
          ))}
        </select>
      </div>

      {doLote.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-muted">Nada neste lote.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink">
              Total do lote: <strong>{formatarMoeda(somar(doLote))}</strong>{" "}
              <span className="text-xs text-ink-muted">({doLote.length} pedido{doLote.length > 1 ? "s" : ""})</span>
            </p>
            <Button size="sm" variant="secondary" onClick={baixarCsv}>
              <DownloadIcon className="h-3.5 w-3.5" />
              Baixar planilha (CSV)
            </Button>
          </div>

          {ORDEM_DAS_EMPRESAS.map((empresa) => {
            const daEmpresa = doLote.filter((r) => r.empresa === empresa);
            if (daEmpresa.length === 0) return null;
            const pessoas = new Map<string, Ressarcimento[]>();
            for (const r of daEmpresa) {
              const chave = `${r.nome.trim().toLowerCase()}|${r.pix.trim().toLowerCase()}`;
              pessoas.set(chave, [...(pessoas.get(chave) ?? []), r]);
            }
            const grupos = Array.from(pessoas.values()).sort((a, b) => a[0].nome.localeCompare(b[0].nome, "pt-BR"));
            return (
              <div key={empresa} className="space-y-2">
                <h3 className="flex items-center justify-between border-b border-line pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <span>{EMPRESAS[empresa]}</span>
                  <span className="normal-case tracking-normal text-ink">{formatarMoeda(somar(daEmpresa))}</span>
                </h3>
                {grupos.map((lista) => (
                  <GrupoDaPessoa
                    key={`${lista[0].nome}|${lista[0].pix}`}
                    lista={lista}
                    nomes={nomes}
                    aoPagar={aoPagar}
                    aoPagarVarios={aoPagarVarios}
                    aoDesfazer={aoDesfazer}
                    aoRecusar={aoRecusar}
                  />
                ))}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

function GrupoDaPessoa({
  lista,
  nomes,
  aoPagar,
  aoPagarVarios,
  aoDesfazer,
  aoRecusar,
}: {
  lista: Ressarcimento[];
  nomes: Record<string, string>;
  aoPagar: (r: Ressarcimento) => void;
  aoPagarVarios: (lista: Ressarcimento[]) => void;
  aoDesfazer: (r: Ressarcimento) => void;
  aoRecusar: (r: Ressarcimento) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const { nome, pix } = lista[0];
  const aPagar = lista.filter((r) => r.status !== "pago" && r.status !== "recusado");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(pix);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie a chave PIX:", pix);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-canvas p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-ink">
            {nome} <span className="font-normal text-ink-muted">· {formatarMoeda(somar(lista))}</span>
          </p>
          <p className="break-all text-xs text-ink-muted">PIX: {pix}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={copiar}>
            <CopyIcon className="h-3.5 w-3.5" />
            {copiado ? "Copiado" : "Copiar PIX"}
          </Button>
          {aPagar.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                if (window.confirm(`Marcar ${aPagar.length} pedido(s) de ${nome} como pagos (${formatarMoeda(somar(aPagar))})?`)) aoPagarVarios(aPagar);
              }}
            >
              Marcar tudo como pago
            </Button>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {lista.map((r) => (
          <ItemDoFinanceiro key={r.id} r={r} lancador={nomes[r.solicitante_id] ?? null} aoPagar={aoPagar} aoDesfazer={aoDesfazer} aoRecusar={aoRecusar} />
        ))}
      </div>
    </div>
  );
}

function ItemDoFinanceiro({
  r,
  lancador,
  aoPagar,
  aoDesfazer,
  aoRecusar,
}: {
  r: Ressarcimento;
  lancador: string | null;
  aoPagar: (r: Ressarcimento) => void;
  aoDesfazer: (r: Ressarcimento) => void;
  aoRecusar: (r: Ressarcimento) => void;
}) {
  const status = STATUS_DO_RESSARCIMENTO[r.status];
  const encerrado = r.status === "pago" || r.status === "recusado";
  return (
    <article className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{formatarMoeda(r.valor)}</p>
          <p className="text-xs text-ink-muted">
            {formatarDataBR(r.data_despesa)} · {MOTIVOS[r.motivo]}
            {lancador && lancador.toLowerCase() !== r.nome.trim().toLowerCase() ? ` · lançado por ${lancador}` : ""}
          </p>
        </div>
        <Badge tone={status.tom}>{status.rotulo}</Badge>
      </div>
      {r.descricao && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-muted">{r.descricao}</p>}
      <Comprovantes anexos={r.anexos} />
      {r.status === "recusado" && r.observacao_financeiro && (
        <p className="mt-2 rounded-lg bg-danger-light px-3 py-2 text-xs text-danger">Motivo: {r.observacao_financeiro}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!encerrado && (
          <>
            <Button size="sm" onClick={() => aoPagar(r)}>
              Marcar como pago
            </Button>
            <Button size="sm" variant="danger" onClick={() => aoRecusar(r)}>
              Recusar
            </Button>
          </>
        )}
        {encerrado && (
          <Button size="sm" variant="ghost" onClick={() => aoDesfazer(r)}>
            Desfazer
          </Button>
        )}
      </div>
    </article>
  );
}
