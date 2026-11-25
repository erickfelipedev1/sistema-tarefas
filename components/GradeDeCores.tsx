"use client";

import { useState } from "react";
import { LINHAS_DA_PALETA, lerCodigoDeCor } from "@/lib/paleta-de-cores";

// Paleta grande (lib/paleta-de-cores.ts) + campo pra digitar o código da cor.
// Usada na cor da página da Wiki e no botão de cores do editor — por isso não
// usa as cores do tema do d.hub: herda a letra de quem a envolve (o menu do
// editor é claro ou escuro conforme a página).
export default function GradeDeCores({
  valor,
  aoEscolher,
}: {
  valor: string | null;
  aoEscolher: (hex: string) => void;
}) {
  const atual = valor?.toLowerCase() ?? null;
  const [digitado, setDigitado] = useState(atual?.startsWith("#") ? atual.toUpperCase() : "");
  const [sobre, setSobre] = useState<string | null>(null);
  const lido = lerCodigoDeCor(digitado);

  function usarDigitado() {
    if (lido) aoEscolher(lido);
  }

  return (
    <div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${LINHAS_DA_PALETA[0].length}, 1rem)` }}>
        {LINHAS_DA_PALETA.flat().map((hex) => {
          const ativo = hex === atual;
          return (
            <button
              key={hex}
              type="button"
              title={hex.toUpperCase()}
              aria-label={`Cor ${hex.toUpperCase()}`}
              aria-pressed={ativo}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setSobre(hex)}
              onMouseLeave={() => setSobre(null)}
              onClick={() => {
                setDigitado(hex.toUpperCase());
                aoEscolher(hex);
              }}
              className={`h-4 w-4 rounded-[3px] transition-transform hover:z-10 hover:scale-125 ${ativo ? "z-10 scale-125 ring-2 ring-offset-1" : ""}`}
              style={{
                backgroundColor: hex,
                boxShadow: "inset 0 0 0 1px rgba(128,128,128,.35)",
                ...(ativo ? { ["--tw-ring-color" as string]: "currentColor" } : {}),
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-6 w-6 flex-shrink-0 rounded-md"
          style={{ backgroundColor: sobre ?? lido ?? atual ?? "transparent", boxShadow: "inset 0 0 0 1px rgba(128,128,128,.45)" }}
        />
        <input
          value={digitado}
          onChange={(e) => setDigitado(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              usarDigitado();
            }
          }}
          placeholder={sobre ? sobre.toUpperCase() : "#FF6600"}
          aria-label="Código da cor"
          maxLength={7}
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 font-mono text-xs uppercase outline-none"
          style={{ boxShadow: "inset 0 0 0 1px rgba(128,128,128,.45)", color: "inherit" }}
        />
        <button
          type="button"
          onClick={usarDigitado}
          disabled={!lido}
          className="rounded-md px-2 py-1 text-xs font-medium disabled:opacity-40"
          style={{ boxShadow: "inset 0 0 0 1px rgba(128,128,128,.45)" }}
        >
          Usar
        </button>
      </div>
    </div>
  );
}
