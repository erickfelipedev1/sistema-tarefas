"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/Button";

const MIN_SENHA = 6; // mínimo do Supabase Auth

const campoClasse =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Troca da própria senha em Meu perfil. Confere a senha atual antes (entrando
// de novo com ela), pra ninguém trocar a senha de uma sessão esquecida aberta.
export default function TrocarSenha() {
  const supabase = createClient();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);

    if (nova.length < MIN_SENHA) {
      setErro(`A nova senha precisa ter pelo menos ${MIN_SENHA} caracteres.`);
      return;
    }
    if (nova !== confirmacao) {
      setErro("A confirmação não bate com a nova senha.");
      return;
    }
    if (nova === atual) {
      setErro("A nova senha precisa ser diferente da atual.");
      return;
    }

    setSalvando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setSalvando(false);
      setErro("Sessão expirada. Atualize a página e entre de novo.");
      return;
    }

    const { error: erroAtual } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: atual,
    });
    if (erroAtual) {
      setSalvando(false);
      setErro("A senha atual está incorreta.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: nova });
    setSalvando(false);
    if (error) {
      setErro(`Não deu pra trocar a senha: ${error.message}`);
      return;
    }

    setAtual("");
    setNova("");
    setConfirmacao("");
    setSucesso(true);
  }

  return (
    <form onSubmit={trocar} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <p className="text-sm font-semibold text-ink">Senha</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="senha-atual" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Senha atual
          </label>
          <input
            id="senha-atual"
            type="password"
            autoComplete="current-password"
            required
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            className={campoClasse}
          />
        </div>
        <div>
          <label htmlFor="senha-nova" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Nova senha
          </label>
          <input
            id="senha-nova"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_SENHA}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            className={campoClasse}
          />
        </div>
        <div>
          <label htmlFor="senha-confirma" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Confirmar nova senha
          </label>
          <input
            id="senha-confirma"
            type="password"
            autoComplete="new-password"
            required
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className={campoClasse}
          />
        </div>
      </div>

      {erro && <p className="mt-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{erro}</p>}
      {sucesso && (
        <p className="mt-3 rounded-lg bg-success-light px-3 py-2 text-sm text-success">
          Senha trocada. Use a nova senha no próximo login.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={salvando || !atual || !nova || !confirmacao}>
          {salvando ? "Trocando..." : "Trocar senha"}
        </Button>
      </div>
    </form>
  );
}
