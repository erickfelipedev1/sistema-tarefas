"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

// Campo de senha com o olho pra ver o que se digita. O className vai no campo
// (ganha espaço à direita pro botão).
export function CampoDeSenha({ className = "", ...resto }: Props) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="relative">
      <input {...resto} type={visivel ? "text" : "password"} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Esconder a senha" : "Mostrar a senha"}
        aria-pressed={visivel}
        title={visivel ? "Esconder a senha" : "Mostrar a senha"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600 focus-visible:text-slate-700"
      >
        {visivel ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}
