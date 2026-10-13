"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PacoteDisponivel } from "@/lib/pacotes";
import { mesAtual } from "@/lib/relatorio";
import { Button } from "./ui/Button";
import { PencilIcon } from "./ui/icons";

const SEM_PACOTE = "";

// Janela pra escolher o tipo de serviço do cliente (Start, Pro, Elite ou
// nenhum). Qualquer pessoa da equipe pode trocar; vale do mês atual em
// diante (quem decide isso, e o que cada um pode, é a função do banco,
// migration 0056). Aqui não aparece valor nenhum: o valor de cada pacote
// fica só no Faturamento.
export function TipoDeServicoDialog({
  projectId,
  clienteNome,
  pacoteAtual,
  pacotes,
  aoFechar,
}: {
  projectId: string;
  clienteNome: string;
  // Nome do pacote que o cliente tem hoje, se tiver.
  pacoteAtual: string | null;
  pacotes: PacoteDisponivel[];
  aoFechar: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const atual = pacotes.find((p) => p.nome === pacoteAtual)?.id ?? SEM_PACOTE;
  const [escolhido, setEscolhido] = useState(atual);
  // Só grava se a pessoa escolheu alguma coisa: abrir e salvar sem tocar em
  // nada não pode mudar o pacote (nem tirar um pacote desativado, que não
  // está na lista e por isso abre como "Sem pacote").
  const [mexeu, setMexeu] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Fechar no meio do salvar perderia o resultado (e o erro, se der).
  const fechar = () => {
    if (!salvando) aoFechar();
  };

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape" && !salvando) aoFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar, salvando]);

  async function salvar() {
    const pacoteDesativado = !!pacoteAtual && atual === SEM_PACOTE;
    if (!mexeu || (escolhido === atual && !pacoteDesativado)) return aoFechar();
    setSalvando(true);
    setErro(null);
    // O mês vai como o atual (em São Paulo); pra quem não vê faturamento o
    // banco usa o mês atual de qualquer jeito.
    const mes = `${mesAtual()}-01`;
    const { error } =
      escolhido === SEM_PACOTE
        ? await supabase.rpc("tirar_pacote_do_cliente", { p_project_id: projectId, p_from_month: mes })
        : await supabase.rpc("definir_pacote_do_cliente", {
            p_project_id: projectId,
            p_package_id: escolhido,
            p_start_month: mes,
          });
    setSalvando(false);
    if (error) {
      const texto = error.message ?? "";
      // Função que não existe, ou a antiga (que só o faturamento podia
      // chamar): falta a migration. As recusas da função nova já vêm
      // escritas pra quem usa a tela.
      const faltaMigration = error.code === "PGRST202" || /permissão pra mexer no faturamento/i.test(texto);
      const recusa = /sessão expirou|agendada|Pacote não encontrado|Cliente não encontrado/i.test(texto);
      setErro(
        faltaMigration
          ? "Não deu pra mudar o tipo de serviço. Confere se a migration 0056_tipo_de_servico.sql já foi rodada no Supabase."
          : `Não deu pra mudar o tipo de serviço.${recusa ? ` ${texto}` : " Tenta de novo."}`
      );
      return;
    }
    router.refresh();
    aoFechar();
  }

  const opcoes = [{ id: SEM_PACOTE, nome: "Sem pacote" }, ...pacotes];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tipo de serviço de ${clienteNome}`}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-dropdown"
      >
        <p className="text-sm font-semibold text-ink">Tipo de serviço de {clienteNome}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          O pacote que o cliente contratou. A troca vale deste mês em diante e entra no faturamento.
        </p>
        <div className="mt-3 space-y-1" role="radiogroup" aria-label="Pacote">
          {opcoes.map((p) => (
            <label
              key={p.id || "sem"}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                escolhido === p.id
                  ? "border-brand-forte/50 bg-brand/10 font-semibold text-ink"
                  : "border-line text-ink hover:bg-surface-hover"
              }`}
            >
              <input
                type="radio"
                name={`pacote-${projectId}`}
                checked={escolhido === p.id}
                // onClick também: clicar na opção que já está marcada não
                // dispara onChange, e é assim que se confirma "Sem pacote".
                onClick={() => setMexeu(true)}
                onChange={() => {
                  setEscolhido(p.id);
                  setMexeu(true);
                }}
                className="h-4 w-4 accent-[rgb(var(--color-brand))]"
              />
              {p.nome}
            </label>
          ))}
        </div>
        {pacoteAtual && atual === SEM_PACOTE && (
          <p className="mt-2 text-xs text-ink-muted">
            Hoje o cliente está no pacote {pacoteAtual}, que foi desativado. Ele só muda se você escolher uma opção
            acima.
          </p>
        )}
        {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// O tipo de serviço ao lado do nome do cliente, na página dele: a etiqueta
// com o pacote (ou "Sem pacote") e, se a troca estiver disponível, o lápis
// que abre a janela de escolher.
export function TipoDeServicoDoCliente({
  projectId,
  clienteNome,
  pacoteAtual,
  pacotes,
}: {
  projectId: string;
  clienteNome: string;
  pacoteAtual: string | null;
  // null = a troca não está disponível (falta a migration 0056).
  pacotes: PacoteDisponivel[] | null;
}) {
  const [aberto, setAberto] = useState(false);
  if (!pacoteAtual && !pacotes) return null;
  const etiqueta = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        pacoteAtual ? "bg-brand-light text-brand-forte" : "border border-dashed border-line text-ink-muted"
      }`}
    >
      {pacoteAtual ? `Pacote ${pacoteAtual}` : "Sem pacote"}
      {pacotes && <PencilIcon className="h-3 w-3" />}
    </span>
  );
  if (!pacotes) return etiqueta;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Trocar o tipo de serviço"
        aria-label={`Tipo de serviço: ${pacoteAtual ?? "sem pacote"}. Trocar`}
        className="rounded-full transition-opacity hover:opacity-80"
      >
        {etiqueta}
      </button>
      {aberto && (
        <TipoDeServicoDialog
          projectId={projectId}
          clienteNome={clienteNome}
          pacoteAtual={pacoteAtual}
          pacotes={pacotes}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
