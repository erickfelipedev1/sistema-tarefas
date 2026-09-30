"use client";

import TelaDeErro from "@/components/TelaDeErro";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <TelaDeErro error={error} reset={reset} />;
}
