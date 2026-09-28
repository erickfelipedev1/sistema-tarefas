"use client";

import { useState } from "react";
import { autorizarApp, negarApp, type PedidoAutorizacao } from "./actions";

export default function AuthorizeButtons({ pedido }: { pedido: PedidoAutorizacao }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function responder(acao: typeof autorizarApp) {
    setEnviando(true);
    setErro(null);
    try {
      const r = await acao(pedido);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      setErro(r.erro ?? "Não deu pra concluir.");
    } catch {
      setErro("Não deu pra concluir. Tente conectar de novo pelo app de IA.");
    }
    setEnviando(false);
  }

  return (
    <>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={() => responder(negarApp)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => responder(autorizarApp)}
          className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {enviando ? "Conectando..." : "Autorizar"}
        </button>
      </div>
      {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
    </>
  );
}
