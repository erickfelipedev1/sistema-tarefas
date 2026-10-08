"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { avisarAvaliacaoEnviada } from "@/lib/actions/push";
import {
  CRITERIOS,
  ESCALA,
  formatarMedia,
  mediaDasNotas,
  notasCompletas,
  type Avaliacao,
  type Notas,
} from "@/lib/avaliacoes";
import { formatarDataBR } from "@/lib/format";
import { nomeDoMes } from "@/lib/relatorio";
import { Button } from "@/components/ui/Button";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Ficha de avaliação de um colaborador num mês (tabela evaluations, migration
// 0046): nota de 1 a 5 em cada critério e dois textos. Rascunho fica só com
// quem avalia; "Enviar" libera pro colaborador (e avisa no celular dele).
// Depois de enviada ainda dá pra corrigir — ele vê a versão nova.
export default function AvaliacaoForm({
  pessoaId,
  pessoaNome,
  mes,
  avaliacao,
}: {
  pessoaId: string;
  pessoaNome: string;
  mes: string;
  avaliacao: Avaliacao | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const primeiroNome = pessoaNome.split(" ")[0];
  const [notas, setNotas] = useState<Notas>({
    quality: avaliacao?.quality ?? null,
    deadlines: avaliacao?.deadlines ?? null,
    communication: avaliacao?.communication ?? null,
    proactivity: avaliacao?.proactivity ?? null,
    teamwork: avaliacao?.teamwork ?? null,
  });
  const [fortes, setFortes] = useState(avaliacao?.strengths ?? "");
  const [melhorar, setMelhorar] = useState(avaliacao?.improvements ?? "");
  const [ocupado, setOcupado] = useState<"salvar" | "enviar" | "excluir" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const enviada = avaliacao?.status === "sent";
  const media = mediaDasNotas(notas);

  async function gravar(enviar: boolean) {
    setErro(null);
    setAviso(null);
    if ((enviar || enviada) && !notasCompletas(notas)) {
      return setErro(
        enviada
          ? "Esta avaliação já foi enviada: os cinco critérios precisam ter nota."
          : "Pra enviar, dê nota nos cinco critérios."
      );
    }
    if (
      enviar &&
      !fortes.trim() &&
      !melhorar.trim() &&
      !window.confirm(`Enviar a avaliação de ${primeiroNome} só com as notas, sem nenhum texto de feedback?`)
    ) {
      return;
    }

    setOcupado(enviar ? "enviar" : "salvar");
    const agora = new Date().toISOString();
    const campos = {
      ...notas,
      strengths: fortes.trim(),
      improvements: melhorar.trim(),
      updated_at: agora,
      // Só "Enviar" mexe na situação. Salvar nunca rebaixa nem reenvia: se
      // outra aba já enviou (ou excluiu), o que está no banco é que vale.
      ...(enviar ? { status: "sent", sent_at: agora } : {}),
    };
    const { data, error } = avaliacao
      ? await supabase.from("evaluations").update(campos).eq("id", avaliacao.id).select("id").maybeSingle()
      : await supabase
          .from("evaluations")
          .insert({ person_id: pessoaId, month: `${mes}-01`, ...campos })
          .select("id")
          .maybeSingle();
    setOcupado(null);
    if (error?.code === "23505" || (!error && !data)) {
      // Alguém criou ou excluiu esta avaliação em outra aba desde que a ficha abriu.
      router.refresh();
      return setErro("Esta avaliação mudou em outra aba. Recarregue a página e confira antes de salvar de novo.");
    }
    if (error || !data) {
      return setErro("Não foi possível salvar a avaliação. Tenta de novo.");
    }
    if (enviar) {
      // Aviso no celular do colaborador; se falhar, a avaliação já está salva.
      avisarAvaliacaoEnviada(data.id as string).catch(() => {});
      setAviso(`Avaliação enviada. ${primeiroNome} já consegue ver.`);
    } else {
      setAviso(enviada ? `Alterações salvas. ${primeiroNome} já vê a versão nova.` : "Rascunho salvo. Só você vê.");
    }
    router.refresh();
  }

  async function excluir() {
    if (!avaliacao) return;
    const pergunta = enviada
      ? `Excluir a avaliação de ${primeiroNome} de ${nomeDoMes(mes)}? Ela some também pra ${primeiroNome}, junto com a resposta.`
      : `Excluir o rascunho da avaliação de ${primeiroNome}?`;
    if (!window.confirm(pergunta)) return;
    setOcupado("excluir");
    setErro(null);
    const { error } = await supabase.from("evaluations").delete().eq("id", avaliacao.id);
    setOcupado(null);
    if (error) return setErro("Não foi possível excluir. Tenta de novo.");
    router.push(`/relatorio?aba=avaliacoes&mes=${mes}`);
    router.refresh();
  }

  return (
    <div>
      <div className="space-y-4">
        {CRITERIOS.map((c) => {
          const nota = notas[c.chave];
          return (
            <div key={c.chave}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-ink">{c.rotulo}</p>
                <p className="text-xs text-ink-muted">{nota ? ESCALA[nota] : c.dica}</p>
              </div>
              <div className="mt-1.5 flex gap-1.5" role="group" aria-label={c.rotulo}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNotas((atual) => ({ ...atual, [c.chave]: atual[c.chave] === n ? null : n }))}
                    aria-pressed={nota === n}
                    title={ESCALA[n]}
                    className={`h-9 w-11 rounded-lg border text-sm font-semibold transition-colors ${
                      nota === n
                        ? "border-brand bg-brand text-navy"
                        : "border-line text-ink-muted hover:bg-surface-hover hover:text-ink"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
        Média: <span className="font-semibold text-ink">{formatarMedia(media)}</span>
      </p>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">Pontos fortes</span>
        <textarea
          value={fortes}
          onChange={(e) => setFortes(e.target.value)}
          rows={4}
          placeholder="O que foi bem neste mês, com exemplos."
          className={campoClasse}
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">O que melhorar</span>
        <textarea
          value={melhorar}
          onChange={(e) => setMelhorar(e.target.value)}
          rows={4}
          placeholder="O que precisa mudar e como você espera que mude."
          className={campoClasse}
        />
      </label>

      {avaliacao?.reply && (
        <div className="mt-4 rounded-xl border border-line bg-surface-hover px-4 py-3">
          <p className="text-xs font-semibold text-ink">
            Resposta de {primeiroNome}
            {avaliacao.replied_at && (
              <span className="font-normal text-ink-muted"> · {formatarDataBR(avaliacao.replied_at)}</span>
            )}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{avaliacao.reply}</p>
        </div>
      )}

      <div className="nao-imprime mt-4 flex flex-wrap items-center justify-end gap-2">
        {erro && <p className="mr-auto text-sm text-danger">{erro}</p>}
        {!erro && aviso && <p className="mr-auto text-sm text-ink-muted">{aviso}</p>}
        {avaliacao && (
          <Button variant="ghost" size="sm" onClick={excluir} disabled={ocupado !== null}>
            {ocupado === "excluir" ? "Excluindo..." : "Excluir"}
          </Button>
        )}
        {enviada ? (
          <Button onClick={() => gravar(false)} disabled={ocupado !== null}>
            {ocupado === "salvar" ? "Salvando..." : "Salvar alterações"}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => gravar(false)} disabled={ocupado !== null}>
              {ocupado === "salvar" ? "Salvando..." : "Salvar rascunho"}
            </Button>
            <Button onClick={() => gravar(true)} disabled={ocupado !== null}>
              {ocupado === "enviar" ? "Enviando..." : `Enviar para ${primeiroNome}`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
