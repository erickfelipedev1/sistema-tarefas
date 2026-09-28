"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { entrarCliente } from "../actions";

const campoClasse =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export default function ClientLoginForm({ usuarioInicial }: { usuarioInicial: string }) {
  const [usuario, setUsuario] = useState(usuarioInicial);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    // Se der certo, a action redireciona pra /cliente e nada volta aqui.
    const resultado = await entrarCliente(usuario, senha);
    setEntrando(false);
    if (resultado?.erro) setErro(resultado.erro);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="usuario" className="mb-1.5 block text-xs font-medium text-ink-muted">
          Usuário
        </label>
        <input
          id="usuario"
          type="text"
          required
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className={campoClasse}
        />
      </div>
      <div>
        <label htmlFor="senha" className="mb-1.5 block text-xs font-medium text-ink-muted">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          required
          autoComplete="current-password"
          autoFocus={!!usuarioInicial}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={campoClasse}
        />
      </div>

      {erro && (
        <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      <Button type="submit" disabled={entrando} className="w-full">
        {entrando ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
