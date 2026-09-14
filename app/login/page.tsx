"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const usuario = normalizarUsername(username);
    if (!usernameValido(usuario)) {
      setError(
        "Usuário precisa ter de 3 a 30 caracteres: letras, números, ponto, _ ou -, sem espaços."
      );
      return;
    }

    const emailInterno = `${usuario}@${DOMINIO_INTERNO}`;
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailInterno,
        password,
      });
      setLoading(false);
      if (error) {
        setError(traduzErro(error.message));
        return;
      }
      router.push("/board");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email: emailInterno,
        password,
        options: { data: { username: usuario } },
      });
      setLoading(false);
      if (error) {
        setError(traduzErro(error.message));
        return;
      }
      setInfo("Conta criada! Já dá pra entrar com seu usuário e senha.");
      setMode("login");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Sistema de Tarefas</h1>
        <p className="mb-6 text-sm text-slate-500">
          {mode === "login"
            ? "Entre com seu usuário e senha."
            : "Escolha um usuário e senha para criar sua conta."}
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading
              ? "Aguarde..."
              : mode === "login"
              ? "Entrar"
              : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
        >
          {mode === "login"
            ? "Ainda não tem conta? Criar conta"
            : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}

function traduzErro(mensagem: string) {
  if (mensagem.includes("Invalid login credentials")) {
    return "Usuário ou senha incorretos.";
  }
  if (mensagem.includes("User already registered")) {
    return "Esse nome de usuário já está em uso.";
  }
  if (mensagem.includes("Password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  return mensagem;
}
