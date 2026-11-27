"use client";

import dynamic from "next/dynamic";

// O editor da Wiki (BlockNote) usa "window" ao montar: no servidor ele
// quebrava a renderização ("window is not defined") e a página caía pra
// renderização só no navegador com erro 500 no log. Aqui ele já carrega só
// no navegador, com um espaço reservado enquanto isso.
const PageEditorNoNavegador = dynamic(() => import("./PageEditor"), {
  ssr: false,
  loading: () => <p className="py-10 text-center text-sm text-ink-muted">Abrindo a página...</p>,
});

export default PageEditorNoNavegador;
