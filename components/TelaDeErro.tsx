"use client";

import { useEffect } from "react";

// Tela mostrada quando alguma página quebra no navegador (em vez do
// "Application error" em branco do Next). Mostra o motivo — pra dar pra
// mandar print — e um botão de recarregar.
//
// Caso mais comum no celular: a aba ficou aberta durante um deploy novo e
// tenta carregar um pedaço do app que não existe mais. Aí recarrega sozinho,
// uma vez só (pra não entrar em loop se o erro for outro).

const ERRO_DE_VERSAO =
  /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i;
const CHAVE = "dhub-recarregou-por-erro";

export default function TelaDeErro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    if (!ERRO_DE_VERSAO.test(`${error?.name} ${error?.message}`)) return;
    try {
      if (sessionStorage.getItem(CHAVE)) return;
      sessionStorage.setItem(CHAVE, "1");
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);

  const detalhe = [error?.name, error?.message].filter(Boolean).join(": ") || "Erro desconhecido";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        background: "#0A0D08",
        color: "#F3F6EF",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, margin: 0 }}>Algo deu errado nesta tela</h1>
      <p style={{ margin: 0, color: "#93A08C", fontSize: 15, maxWidth: 340 }}>
        Tente recarregar. Se continuar, manda um print desta tela pra equipe.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={() => {
            try {
              sessionStorage.removeItem(CHAVE);
            } catch {}
            window.location.reload();
          }}
          style={{
            background: "#AEDF55",
            color: "#12160D",
            border: 0,
            borderRadius: 10,
            padding: "12px 20px",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Recarregar
        </button>
        <button
          onClick={() => reset()}
          style={{
            background: "transparent",
            color: "#F3F6EF",
            border: "1px solid #2A3325",
            borderRadius: 10,
            padding: "12px 20px",
            fontSize: 15,
          }}
        >
          Tentar de novo
        </button>
      </div>
      <code
        style={{
          marginTop: 16,
          fontSize: 12,
          color: "#93A08C",
          maxWidth: 340,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {detalhe}
        {error?.digest ? `\n(${error.digest})` : ""}
      </code>
    </main>
  );
}
