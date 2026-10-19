"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { conectarInstagram, contasDoInstagram } from "@/lib/actions/instagram";
import type { ContaDoInstagram } from "@/lib/instagram";

// O Instagram do cliente, na página dele: liga a conta de Instagram (a que a
// Meta enxerga pelo acesso do d.hub) pra poder publicar os posts direto.
// Qualquer pessoa da equipe liga ou desliga.
export default function InstagramDoCliente({
  projectId,
  username,
  contaId,
}: {
  projectId: string;
  // @usuario da conta ligada (vazio = ligada sem nome); null = não ligada.
  username: string | null;
  contaId: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [contas, setContas] = useState<ContaDoInstagram[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ligado = contaId !== null;

  async function abrir() {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (!vaiAbrir || contas || carregando) return;
    setCarregando(true);
    setErro(null);
    const r = await contasDoInstagram();
    setCarregando(false);
    if ("erro" in r) setErro(r.erro);
    else setContas(r.contas);
  }

  async function ligar(id: string | null) {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const r = await conectarInstagram(projectId, id);
    setSalvando(false);
    if ("erro" in r) {
      setErro(r.erro);
      return;
    }
    setAberto(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="true"
        aria-expanded={aberto}
        title="Ligar o Instagram deste cliente pra publicar os posts por aqui"
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted hover:text-ink"
      >
        <span className={`h-2 w-2 rounded-full ${ligado ? "bg-success" : "bg-ink-muted/40"}`} aria-hidden="true" />
        {ligado ? (username ? `Instagram @${username}` : "Instagram ligado") : "Instagram"}
      </button>
      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar"
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute left-0 top-full z-20 mt-1.5 w-80 rounded-xl border border-line bg-surface p-3 shadow-lg">
            <p className="text-xs font-medium text-ink">Instagram deste cliente</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Escolha a conta pra publicar os posts direto do d.hub. Ela precisa ser Comercial ou Criador e estar ligada a
              uma Página, com acesso dado ao d.hub na Meta.
            </p>
            {carregando && <p className="mt-3 text-xs text-ink-muted">Buscando as contas...</p>}
            {contas && contas.length === 0 && (
              <p className="mt-3 text-xs text-ink-muted">Nenhuma conta de Instagram encontrada no acesso do d.hub.</p>
            )}
            {contas && contas.length > 0 && (
              <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
                {contas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => ligar(c.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-hover disabled:opacity-50 ${
                        c.id === contaId ? "bg-brand/10" : ""
                      }`}
                    >
                      <span className="min-w-0 truncate text-ink">
                        {c.username ? `@${c.username}` : c.id}
                        {c.pagina && <span className="ml-1.5 text-xs text-ink-muted">{c.pagina}</span>}
                      </span>
                      {c.id === contaId && <span className="text-xs font-medium text-success">ligada</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {ligado && (
              <button
                type="button"
                disabled={salvando}
                onClick={() => ligar(null)}
                className="mt-3 text-xs font-medium text-danger hover:underline disabled:opacity-50"
              >
                Desligar o Instagram deste cliente
              </button>
            )}
            {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
          </div>
        </>
      )}
    </div>
  );
}
