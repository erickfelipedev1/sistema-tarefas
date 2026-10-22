"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buscarAjuda, PERGUNTAS, type PerguntaDeAjuda } from "@/lib/ajuda";
import { ATUALIZACOES } from "@/lib/atualizacoes";
import { ChevronLeftIcon, MessageCircleIcon, SearchIcon, SendIcon, XIcon } from "./ui/icons";

const SUGESTOES = [
  "Como crio uma tarefa?",
  "Qual a diferença entre tarefa Geral e Postagem?",
  "Como mudo a cor do post no Calendário de postagem?",
  "Como vejo ou baixo os anexos?",
  "Como peço uma mudança no d.hub?",
];

// As novidades também viram resposta (o que mudou, em linguagem de quem usa).
const NOVIDADES: PerguntaDeAjuda[] = ATUALIZACOES.map((a) => ({
  pergunta: a.titulo,
  resposta: a.texto,
  palavras: [a.area],
}));

// Bolinha de ajuda (canto de baixo, à direita): busca nas perguntas
// frequentes (lib/ajuda.ts) e nas Atualizações. Sem resposta, oferece falar
// com quem cuida do d.hub ou fazer um pedido de alteração.
export default function BolinhaDeAjuda() {
  const pathname = usePathname();
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState<PerguntaDeAjuda | null>(null);
  const [suporteId, setSuporteId] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  // Quem responde dúvidas que a ajuda não resolve: quem faz as mudanças do
  // d.hub (profiles.executa_pedidos_dhub).
  useEffect(() => {
    if (!aberta || suporteId) return;
    createClient()
      .from("profiles")
      .select("id")
      .eq("executa_pedidos_dhub", true)
      .limit(1)
      .then(({ data }) => setSuporteId((data?.[0]?.id as string | undefined) ?? null));
  }, [aberta, suporteId]);

  useEffect(() => {
    if (aberta) setTimeout(() => campo.current?.focus(), 50);
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta]);

  // Fecha ao trocar de tela (clicou num link da resposta).
  useEffect(() => {
    setAberta(false);
  }, [pathname]);

  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    const faq = buscarAjuda(busca, PERGUNTAS);
    const novidades = buscarAjuda(busca, NOVIDADES).filter((n) => !faq.some((f) => f.pergunta === n.pergunta));
    return [...faq.slice(0, 4), ...novidades.slice(0, 2)];
  }, [busca]);

  // No chat a caixa de escrever fica embaixo: a bolinha sai do caminho.
  if (pathname?.startsWith("/chat")) return null;

  const naoAchou = !!busca.trim() && resultados.length === 0;

  return (
    <div className="nao-imprime">
      {aberta && (
        <div
          role="dialog"
          aria-label="Ajuda do d.hub"
          className="fixed bottom-20 right-3 z-40 flex w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:right-5"
          style={{ maxHeight: "min(70dvh, 560px)" }}
        >
          <div className="flex items-center gap-2 border-b border-line bg-brand px-4 py-3 text-navy">
            {escolhida && (
              <button type="button" onClick={() => setEscolhida(null)} aria-label="Voltar" className="-ml-1 rounded-md p-1 hover:bg-black/10">
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Dúvidas sobre o d.hub</p>
              <p className="text-[11px] opacity-80">Pergunte do seu jeito: eu procuro a resposta.</p>
            </div>
            <button type="button" onClick={() => setAberta(false)} aria-label="Fechar ajuda" className="rounded-md p-1 hover:bg-black/10">
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {escolhida ? (
              <Resposta item={escolhida} />
            ) : (
              <>
                {!busca.trim() && (
                  <div className="space-y-1.5">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Perguntas comuns</p>
                    {SUGESTOES.map((s) => {
                      const item = PERGUNTAS.find((p) => p.pergunta === s);
                      return item ? <Opcao key={s} texto={s} aoClicar={() => setEscolhida(item)} /> : null;
                    })}
                  </div>
                )}
                {resultados.length > 0 && (
                  <div className="space-y-1.5">
                    {resultados.map((r) => (
                      <Opcao key={r.pergunta} texto={r.pergunta} aoClicar={() => setEscolhida(r)} />
                    ))}
                  </div>
                )}
                {naoAchou && (
                  <div className="rounded-xl bg-surface-hover/60 p-3 text-sm text-ink">
                    <p>Não achei uma resposta pra isso.</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {suporteId && (
                        <Link href={`/chat/dm/${suporteId}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-forte hover:underline">
                          <MessageCircleIcon className="h-3.5 w-3.5" />
                          Falar com o Erick no chat
                        </Link>
                      )}
                      <Link href="/atualizacoes?aba=pedidos" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-forte hover:underline">
                        <SendIcon className="h-3.5 w-3.5" />
                        Pedir uma mudança no d.hub
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!escolhida && (
            <div className="border-t border-line p-2.5">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  ref={campo}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Ex.: como reordeno o checklist?"
                  aria-label="Sua dúvida"
                  className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setAberta((a) => !a);
          setEscolhida(null);
        }}
        aria-label={aberta ? "Fechar ajuda" : "Abrir ajuda: tire suas dúvidas"}
        aria-expanded={aberta}
        title="Dúvidas sobre o d.hub"
        className="fixed bottom-4 right-3 z-40 flex items-center justify-center rounded-full bg-brand text-navy shadow-xl transition-transform hover:scale-105 active:scale-95 sm:right-5"
        style={{ height: "3.25rem", width: "3.25rem" }}
      >
        {aberta ? <XIcon className="h-5 w-5" /> : <span className="text-xl font-bold leading-none">?</span>}
      </button>
    </div>
  );
}

function Opcao({ texto, aoClicar }: { texto: string; aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="block w-full rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm text-ink hover:border-brand/40 hover:bg-surface-hover"
    >
      {texto}
    </button>
  );
}

function Resposta({ item }: { item: PerguntaDeAjuda }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink">{item.pergunta}</p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{item.resposta}</p>
      {item.link && (
        <Link href={item.link.href} className="inline-flex items-center rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-navy hover:bg-brand-hover">
          {item.link.rotulo}
        </Link>
      )}
    </div>
  );
}
