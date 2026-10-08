import { CRITERIOS, ESCALA, formatarMedia, mediaDasNotas, type Avaliacao } from "@/lib/avaliacoes";
import { nomeDoMes } from "@/lib/relatorio";
import ResponderAvaliacao from "./ResponderAvaliacao";

// Uma avaliação como o avaliado vê: notas por critério, os dois textos e o
// espaço pra responder.
export default function AvaliacaoRecebida({ avaliacao: a }: { avaliacao: Avaliacao }) {
  return (
    <section data-mov="card" className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-base font-semibold capitalize text-ink">
          {nomeDoMes(a.month.slice(0, 7)).replace(" de ", " ")}
        </p>
        <p className="text-sm text-ink-muted">
          Média{" "}
          <span className="text-lg font-semibold tabular-nums text-ink">{formatarMedia(mediaDasNotas(a))}</span> de 5
        </p>
      </div>

      <dl className="mt-4 space-y-2.5">
        {CRITERIOS.map((c) => {
          const nota = a[c.chave] ?? 0;
          return (
            <div
              key={c.chave}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[200px_auto_1fr]"
            >
              <dt className="text-sm text-ink">{c.rotulo}</dt>
              <dd className="flex items-center gap-2">
                <span className="flex gap-1" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      data-mov="ponto"
                      className={`h-2.5 w-5 rounded-full ${n <= nota ? "bg-brand-forte" : "bg-surface-hover"}`}
                    />
                  ))}
                </span>
                <span className="text-sm font-semibold tabular-nums text-ink">{nota || "—"}</span>
              </dd>
              <dd className="col-span-2 text-xs text-ink-muted sm:col-span-1">{nota ? ESCALA[nota] : ""}</dd>
            </div>
          );
        })}
      </dl>

      {a.strengths && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-semibold text-ink">Pontos fortes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{a.strengths}</p>
        </div>
      )}
      {a.improvements && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-ink">O que melhorar</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{a.improvements}</p>
        </div>
      )}

      <ResponderAvaliacao id={a.id} inicial={a.reply ?? ""} />
    </section>
  );
}
