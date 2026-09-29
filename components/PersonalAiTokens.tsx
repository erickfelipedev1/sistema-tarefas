"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { CopyIcon, SparklesIcon, Trash2Icon } from "./ui/icons";
import { formatarRelativo } from "@/lib/format";
import { criarTokenPessoal, revogarTokenPessoal } from "@/lib/actions/personal-tokens";
import type { PersonalApiToken } from "@/lib/types";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Tela onde cada pessoa gera/revoga o próprio token pra conectar a IA dela
// (Claude Desktop, Claude Code etc.) ao NowHub via MCP — depois de
// conectado, pedir "cria uma tarefa no projeto X" pra IA já cria de
// verdade aqui, em nome de quem gerou o token (ver app/api/[transport]/
// route.ts).
export default function PersonalAiTokens({
  initialTokens,
}: {
  initialTokens: PersonalApiToken[];
}) {
  const router = useRouter();
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("");
  const [tokenRecemCriado, setTokenRecemCriado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // router.refresh() busca os dados novos no servidor e passa de novo como
  // "initialTokens" — mas como esse componente continua montado (não
  // remonta), o useState sozinho não pegaria o valor novo. Esse efeito
  // sincroniza o estado local sempre que a prop mudar.
  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);

  const urlDoServidor =
    typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

  function criar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await criarTokenPessoal(label || null);
      if ("erro" in resultado) {
        setErro(resultado.erro);
        return;
      }
      setTokenRecemCriado(resultado.token);
      setCopiado(false);
      setLabel("");
      // Busca a lista de novo do servidor (com o id/prefixo reais) em vez
      // de inventar uma entrada otimista aqui — evita ficar com um id
      // falso na tela que não existe de verdade no banco (e que quebraria
      // o botão de revogar antes da próxima navegação).
      router.refresh();
    });
  }

  function revogar(id: string) {
    const ok = window.confirm(
      "Revogar esse token? A IA conectada com ele para de funcionar na hora — não dá pra desfazer."
    );
    if (!ok) return;
    startTransition(async () => {
      const resultado = await revogarTokenPessoal(id);
      if ("erro" in resultado) {
        setErro(resultado.erro);
        return;
      }
      setTokens((atual) =>
        atual.map((t) =>
          t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t
        )
      );
      router.refresh();
    });
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de clipboard: sem problema, o texto já está
      // selecionável na tela.
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-brand" />
          <h1 className="text-lg font-semibold text-ink">Integração com IA</h1>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Conecte sua própria IA (Claude Desktop, Claude Code etc.) ao Now
          Organiza. Depois de conectada, você pode pedir coisas como &quot;cria
          uma tarefa no projeto X&quot; ou &quot;quais são minhas tarefas hoje&quot; e ela
          faz de verdade no sistema, em seu nome.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <p className="text-sm font-semibold text-ink">ChatGPT</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          O ChatGPT não usa token: ele pede pra você entrar no NowHub e
          autorizar. Precisa de plano Plus, Pro, Business ou superior, no site
          (chatgpt.com).
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-xs text-ink-muted">
          <li>
            Em <strong className="text-ink">Configurações → Apps → Configurações avançadas</strong>,
            ative o <strong className="text-ink">Modo desenvolvedor</strong>.
          </li>
          <li>
            Crie um app/conector com o endereço{" "}
            <code className="rounded bg-canvas px-1.5 py-0.5 text-ink">{urlDoServidor}</code>{" "}
            e autenticação <strong className="text-ink">OAuth</strong>.
          </li>
          <li>
            Clique em conectar, entre com seu usuário e clique em{" "}
            <strong className="text-ink">Autorizar</strong>. O token aparece na lista
            abaixo — revogue por lá pra desconectar.
          </li>
        </ol>
      </div>

      {tokenRecemCriado && (
        <div className="rounded-2xl border border-success/30 bg-success-light px-5 py-4">
          <p className="text-sm font-semibold text-success">
            Token criado! Copie agora — ele não aparece de novo depois que
            você sair dessa tela.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink">
              {tokenRecemCriado}
            </code>
            <Button variant="secondary" size="sm" onClick={() => copiar(tokenRecemCriado)}>
              <CopyIcon className="h-3.5 w-3.5" />
              {copiado ? "Copiado!" : "Copiar"}
            </Button>
          </div>

          <div className="mt-4 space-y-2 text-xs text-ink-muted">
            <p className="font-medium text-ink">Como conectar:</p>
            <p>
              <strong className="text-ink">Endereço do servidor:</strong>{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-ink">{urlDoServidor}</code>
            </p>
            <p>
              <strong className="text-ink">Claude Code:</strong> no terminal,
              rode{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-ink">
                claude mcp add --transport http nowhub {urlDoServidor} --header
                &quot;Authorization: Bearer {tokenRecemCriado}&quot;
              </code>
            </p>
            <p>
              <strong className="text-ink">Claude Desktop:</strong> em
              Configurações → Conectores → Adicionar conector personalizado,
              cole o endereço acima e, em cabeçalhos/headers, adicione{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-ink">Authorization</code>{" "}
              com o valor{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-ink">
                Bearer {tokenRecemCriado}
              </code>
              .
            </p>
          </div>
        </div>
      )}

      {erro && (
        <p className="rounded-lg bg-danger-light px-3 py-2 text-xs text-danger">{erro}</p>
      )}

      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <p className="text-sm font-semibold text-ink">Gerar novo token</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Dá pra ter mais de um (ex: um pro Claude Desktop do notebook, outro
          pro Claude Code) — cada um pode ser revogado sem afetar os outros.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome pra identificar (opcional, ex: Notebook)"
            className={`${campoClasse} max-w-xs`}
          />
          <Button onClick={criar} disabled={pending}>
            {pending ? "Gerando..." : "Gerar token"}
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Seus tokens</p>
        {tokens.length === 0 ? (
          <p className="text-xs text-ink-muted">Nenhum token gerado ainda.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => {
              const ativo = !t.revoked_at;
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-ink">{t.token_prefix}…</code>
                      {t.label && (
                        <span className="truncate text-xs text-ink-muted">{t.label}</span>
                      )}
                      <Badge tone={ativo ? "success" : "neutral"}>
                        {ativo ? "Ativo" : "Revogado"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      Criado {formatarRelativo(t.created_at)}
                      {t.last_used_at && ` · usado pela última vez ${formatarRelativo(t.last_used_at)}`}
                    </p>
                  </div>
                  {ativo && (
                    <button
                      onClick={() => revogar(t.id)}
                      disabled={pending}
                      title="Revogar token"
                      className="flex-shrink-0 rounded-lg p-2 text-ink-muted hover:bg-danger-light hover:text-danger disabled:opacity-50"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
