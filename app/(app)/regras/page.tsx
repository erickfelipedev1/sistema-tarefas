import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import {
  ESCALA_LIXO,
  LIXEIRAS,
  REGRAS_GERAIS,
  REGRAS_LIXO,
  diaDaSemanaSP,
  perfisDoNome,
  type PerfilBasico,
} from "@/lib/regras";

export const dynamic = "force-dynamic";

// Regras do escritório: escala do lixo (com o responsável de hoje em
// destaque), como fazer a retirada e as regras gerais. Conteúdo em
// lib/regras.ts.
export default async function RegrasPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, name, username, avatar_url");
  const perfis = (data ?? []) as PerfilBasico[];

  const hoje = diaDaSemanaSP();
  const escalaHoje = ESCALA_LIXO.find((e) => e.dia === hoje);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader title="Regras" subtitle="Combinados do escritório e a escala da retirada do lixo." />

      <section className="rounded-2xl border border-brand-forte/40 bg-brand-light p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-forte">Lixo de hoje</p>
        {escalaHoje ? (
          <>
            <p className="mt-1 text-lg font-semibold text-ink">
              {escalaHoje.rotulo}: verificar às 12h e às 18h
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {escalaHoje.nomes.map((nome) => (
                <Pessoa key={nome} nome={nome} perfis={perfis} destaque />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-1 text-lg font-semibold text-ink">Fim de semana, sem escala hoje.</p>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-ink">Escala da semana</h2>
          <ul className="mt-3 divide-y divide-line">
            {ESCALA_LIXO.map((e) => {
              const ehHoje = e.dia === hoje;
              return (
                <li key={e.dia} className={`flex flex-wrap items-center gap-3 py-3 ${ehHoje ? "-mx-2 rounded-lg bg-surface-hover px-2" : ""}`}>
                  <span className="w-20 flex-shrink-0 text-sm font-medium text-ink">
                    {e.rotulo}
                    {ehHoje && <Badge tone="brand" className="ml-2">hoje</Badge>}
                  </span>
                  <span className="flex flex-1 flex-wrap gap-2">
                    {e.nomes.map((nome) => (
                      <Pessoa key={nome} nome={nome} perfis={perfis} />
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-ink">Lixeiras pra verificar</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-ink">
            {LIXEIRAS.map((l) => (
              <li key={l} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-forte" aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
          <h2 className="mt-5 text-sm font-semibold text-ink">Como funciona</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {REGRAS_LIXO.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="flex-shrink-0 text-brand-forte" aria-hidden="true">→</span>
                {r}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink">Regras gerais</h2>
        <ol className="mt-3 space-y-2.5 text-sm text-ink">
          {REGRAS_GERAIS.map((r, i) => (
            <li key={r} className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-navy">
                {i + 1}
              </span>
              <span className="pt-0.5">{r}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Pessoa({ nome, perfis, destaque = false }: { nome: string; perfis: PerfilBasico[]; destaque?: boolean }) {
  const achados = perfisDoNome(nome, perfis);
  const perfil = achados.length === 1 ? achados[0] : null;
  const rotulo = perfil?.name || nome;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 ${
        destaque ? "text-sm" : "text-xs"
      }`}
      title={achados.length > 1 ? `Mais de uma pessoa com o nome ${nome}` : undefined}
    >
      <Avatar name={rotulo} src={perfil?.avatar_url} size={destaque ? "md" : "sm"} />
      <span className="font-medium text-ink">{rotulo}</span>
    </span>
  );
}
