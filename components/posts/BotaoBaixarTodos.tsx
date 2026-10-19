"use client";

import { useState } from "react";
import {
  baixarUmPorUm,
  compartilharArquivos,
  podeCompartilharArquivos,
  prepararArquivos,
  type ItemParaBaixar,
} from "@/lib/baixar-varios";
import { Button } from "../ui/Button";
import { DownloadIcon } from "../ui/icons";

// "Baixar todos": cada arquivo solto. No computador baixa um atrás do outro; no
// celular abre o menu de compartilhar com todos, e ali é "Salvar imagens". Se o
// navegador do celular exigir um toque novo depois de preparar os arquivos, o
// botão vira "Salvar no celular" e o segundo toque abre o menu.
export default function BotaoBaixarTodos({
  itens,
  className,
  aoErro,
}: {
  itens: ItemParaBaixar[];
  className?: string;
  aoErro: (mensagem: string | null) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [prontos, setProntos] = useState<File[] | null>(null);
  if (itens.length < 2) return null;

  async function salvarNoCelular(arquivos: File[]) {
    const r = await compartilharArquivos(arquivos);
    if (r === "bloqueado") {
      setProntos(arquivos);
      return;
    }
    setProntos(null);
  }

  async function aoClicar() {
    aoErro(null);
    // Segundo toque: os arquivos já estão prontos, o menu abre direto.
    if (prontos) {
      await salvarNoCelular(prontos);
      return;
    }
    setOcupado(true);
    try {
      const arquivos = await prepararArquivos(itens, (feitos, total) => setProgresso(`${feitos}/${total}`));
      if (podeCompartilharArquivos(arquivos)) await salvarNoCelular(arquivos);
      else await baixarUmPorUm(arquivos);
    } catch (e) {
      aoErro(e instanceof Error ? e.message : "Não deu pra baixar. Tente de novo.");
    }
    setOcupado(false);
    setProgresso("");
  }

  return (
    <Button variant="secondary" size="sm" type="button" disabled={ocupado} onClick={aoClicar} className={className}>
      <DownloadIcon className="h-3.5 w-3.5" />
      {ocupado
        ? `Preparando ${progresso}...`
        : prontos
        ? `Salvar no celular (${prontos.length})`
        : `Baixar todos (${itens.length})`}
    </Button>
  );
}
