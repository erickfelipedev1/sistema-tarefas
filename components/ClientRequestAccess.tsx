"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  criarAcessoCliente,
  removerAcessoCliente,
  trocarSenhaAcessoCliente,
} from "@/lib/actions/client-logins";
import { formatarDataHora } from "@/lib/format";

export interface AcessoCliente {
  id: string;
  username: string;
  created_at: string;
  last_login_at: string | null;
}

const campoClasse =
  "rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none";

// Logins do cliente pra área de solicitações (/cliente). Cada login entra
// com usuário e senha e só vê/envia solicitações deste cliente. A senha
// nunca é mostrada depois de criada (fica só o hash) — dá pra trocar.
export default function ClientRequestAccess({
  projectId,
  acessos,
  semResponsavel,
  erroCarregar,
}: {
  projectId: string;
  acessos: AcessoCliente[];
  semResponsavel: boolean;
  erroCarregar: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  function linkDe(username: string) {
    const origem = typeof window !== "undefined" ? window.location.origin : "";
    return `${origem}/cliente/login?u=${encodeURIComponent(username)}`;
  }

  async function copiar(username: string) {
    const link = linkDe(username);
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(username);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      window.prompt("Copia o link:", link);
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const resultado = await criarAcessoCliente(projectId, usuario, senha);
    setSalvando(false);
    if ("erro" in resultado) {
      setErro(resultado.erro);
      return;
    }
    setUsuario("");
    setSenha("");
    setAberto(false);
    router.refresh();
  }

  async function trocarSenha(acesso: AcessoCliente) {
    const nova = window.prompt(`Nova senha para ${acesso.username} (mínimo 8 caracteres):`);
    if (!nova) return;
    const resultado = await trocarSenhaAcessoCliente(acesso.id, nova);
    window.alert("erro" in resultado ? resultado.erro : "Senha trocada.");
  }

  async function remover(acesso: AcessoCliente) {
    const ok = window.confirm(
      `Remover o acesso de "${acesso.username}"? Ele para de conseguir entrar na hora. As solicitações já enviadas continuam no sistema.`
    );
    if (!ok) return;
    const resultado = await removerAcessoCliente(acesso.id, projectId);
    if ("erro" in resultado) window.alert(resultado.erro);
    else router.refresh();
  }

  return (
    <div className="mb-6 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink-muted">
          🔑 Acesso do cliente para solicitações
        </span>
        {!aberto && !erroCarregar && (
          <button
            onClick={() => setAberto(true)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover"
          >
            Criar acesso
          </button>
        )}
      </div>

      {erroCarregar && <p className="mt-2 text-xs text-danger">{erroCarregar}</p>}

      {semResponsavel && (
        <p className="mt-2 text-xs text-warning">
          Este cliente ainda não tem responsável. As solicitações vão para quem criou o
          cliente — defina um responsável abaixo pra elas irem pra pessoa certa.
        </p>
      )}

      {acessos.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {acessos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{a.username}</p>
                <p className="text-xs text-ink-muted">
                  {a.last_login_at
                    ? `Último acesso ${formatarDataHora(a.last_login_at)}`
                    : "Ainda não entrou"}
                </p>
              </div>
              <button
                onClick={() => copiar(a.username)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover"
              >
                {copiado === a.username ? "Copiado!" : "Copiar link"}
              </button>
              <button
                onClick={() => trocarSenha(a)}
                className="text-xs text-ink-muted hover:text-ink"
              >
                Trocar senha
              </button>
              <button
                onClick={() => remover(a)}
                className="text-xs text-ink-muted hover:text-danger"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <form onSubmit={criar} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Usuário
            <input
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="nome.cliente"
              className={campoClasse}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Senha
            <input
              required
              type="text"
              autoComplete="off"
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="mínimo 8 caracteres"
              className={campoClasse}
            />
          </label>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-navy hover:bg-brand-hover disabled:opacity-50"
          >
            {salvando ? "Criando..." : "Criar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              setErro(null);
            }}
            className="px-2 py-1.5 text-xs text-ink-muted hover:text-ink"
          >
            Cancelar
          </button>
          {erro && <p className="w-full text-xs text-danger">{erro}</p>}
          <p className="w-full text-xs text-ink-muted">
            Anote a senha antes de criar: depois ela não aparece mais aqui (dá pra trocar).
          </p>
        </form>
      )}
    </div>
  );
}
