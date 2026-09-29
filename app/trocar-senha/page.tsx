"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { criarSenhaNova } from "./actions";

const campoClasse =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none";

// Primeiro acesso com a senha padrão: a pessoa só entra no sistema depois
// de criar a própria senha (o middleware manda pra cá enquanto
// profiles.precisa_trocar_senha = true).
export default function TrocarSenhaPage() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const r = await criarSenhaNova(senha, confirmacao);
    setSalvando(false);
    if ("erro" in r) {
      setErro(r.erro);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    const destino =
      next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && !next.startsWith("/trocar-senha")
        ? next
        : "/painel";
    window.location.href = destino;
  }

  async function sair() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Logo tamanho="md" />
        <h1 className="mt-5 text-xl font-semibold text-slate-900">Crie sua senha</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">
          Você entrou com a senha padrão. Pra continuar, defina uma senha só sua.
        </p>

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium text-slate-700">
              Nova senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={campoClasse}
              placeholder="Pelo menos 6 caracteres"
            />
          </div>
          <div>
            <label htmlFor="confirmacao" className="mb-1 block text-sm font-medium text-slate-700">
              Confirmar nova senha
            </label>
            <input
              id="confirmacao"
              type="password"
              autoComplete="new-password"
              required
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className={campoClasse}
            />
          </div>

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          <button
            type="submit"
            disabled={salvando}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar e entrar"}
          </button>
        </form>

        <button
          type="button"
          onClick={sair}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
