"use client";

import TelaDeErro from "@/components/TelaDeErro";

// Erro no layout raiz: substitui a página inteira, então precisa de html/body.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR" translate="no">
      <body style={{ margin: 0 }}>
        <TelaDeErro error={error} reset={reset} />
      </body>
    </html>
  );
}
