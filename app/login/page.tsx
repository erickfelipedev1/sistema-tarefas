"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";

// O Supabase Auth exige um e-mail por baixo dos panos, então cada username
// vira um e-mail interno falso (ex: "erick" -> "erick@sistema-tarefas.app").
// Isso nunca aparece pra ninguém — a pessoa só usa usuário e senha.
const DOMINIO_INTERNO = "sistema-tarefas.app";

function normalizarUsername(bruto: string) {
  return bruto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");
}

function usernameValido(username: string) {
  return /^[a-z0-9._-]{3,30}$/.test(username);
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const usuario = normalizarUsername(username);
    if (!usernameValido(usuario)) {
      setError(
        "Usuário precisa ter de 3 a 30 caracteres: letras, números, ponto, _ ou -, sem espaços."
      );
      return;
    }

    const emailInterno = `${usuario}@${DOMINIO_INTERNO}`;
    setLoading(true);

    // Só login: contas novas são criadas pelo administrador (cadastro
    // público fechado — ver Supabase > Authentication).
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInterno,
      password,
    });
    setLoading(false);
    if (error) {
      setError(traduzErro(error.message));
      return;
    }
    // ?next= vem do middleware (ex: tela de autorizar o ChatGPT). Só
    // caminhos internos, pra não virar redirecionamento pra fora.
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/board");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1">
          <Logo tamanho="md" />
        </h1>
        <p className="mb-5 text-xs text-slate-500">Central de tarefas, clientes e demandas.</p>
        <p className="mb-6 text-sm text-slate-500">
          Entre com seu usuário e senha.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Usuário
            </label>
            <input
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="seu.usuario"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Aguarde..." : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Não tem acesso? Peça seu usuário pra equipe.
        </p>
      </div>
    </div>
  );
}

function traduzErro(mensagem: string) {
  if (mensagem.includes("Invalid login credentials")) {
    return "Usuário ou senha incorretos.";
  }
  if (mensagem.includes("Password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  return mensagem;
}
