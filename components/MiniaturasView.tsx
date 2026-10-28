"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listarImagensSemMiniatura, registrarMiniatura, type ImagemSemMiniatura } from "@/lib/actions/miniaturas";
import { BUCKET_DOS_POSTS } from "@/lib/posts";
import { caminhoDaMiniatura, subirMiniatura } from "@/lib/miniatura-de-imagem";
import { Button } from "@/components/ui/Button";

const TIPOS: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Gera a miniatura das imagens antigas dos posts, uma por vez, aqui no
// navegador (baixa o original, reduz, sobe a miniatura e grava o caminho no
// post). O original não é tocado: "Baixar" e o Instagram seguem usando ele.
// Pode parar e continuar: o que já tem miniatura sai da fila.
export default function MiniaturasView() {
  const [rodando, setRodando] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [feitas, setFeitas] = useState(0);
  const [puladas, setPuladas] = useState(0);
  const [mb, setMb] = useState(0);
  const [falhas, setFalhas] = useState<{ nome: string; motivo: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [fim, setFim] = useState(false);
  const parar = useRef(false);

  async function comecar() {
    setRodando(true);
    setErro(null);
    setFim(false);
    setFeitas(0);
    setPuladas(0);
    setMb(0);
    setFalhas([]);
    parar.current = false;

    const lista = await listarImagensSemMiniatura().catch(() => ({ erro: "A conexão caiu. Tente de novo." }));
    if ("erro" in lista) {
      setErro(lista.erro);
      setRodando(false);
      return;
    }
    setTotal(lista.itens.length);

    const supabase = createClient();
    for (const item of lista.itens as ImagemSemMiniatura[]) {
      if (parar.current) break;
      try {
        const { data: blob, error } = await supabase.storage.from(BUCKET_DOS_POSTS).download(item.path);
        if (error || !blob) throw new Error("Não consegui baixar o original.");
        const extensao = (item.path.split(".").pop() ?? "").toLowerCase();
        const tipo = Object.values(TIPOS).includes(blob.type) ? blob.type : TIPOS[extensao] || "";
        const arquivo = new File([blob], item.name || "imagem", { type: tipo });
        const thumb = await subirMiniatura(supabase.storage, item.path, arquivo, true);
        if (!thumb || thumb !== caminhoDaMiniatura(item.path)) {
          // Imagem pequena, formato que o navegador não abre ou miniatura que não ficou menor.
          setPuladas((n) => n + 1);
          continue;
        }
        const r = await registrarMiniatura(item.postId, item.onde, item.path, thumb);
        if ("erro" in r) throw new Error(r.erro);
        setFeitas((n) => n + 1);
        setMb((n) => Math.round((n + arquivo.size / 1048576) * 10) / 10);
      } catch (e) {
        setFalhas((atual) => [...atual, { nome: item.name, motivo: e instanceof Error ? e.message : "Falhou." }]);
      }
    }
    setFim(!parar.current);
    setRodando(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-muted">
          Cria uma versão leve (até 1280 px) das imagens e capas de posts que ainda não têm. As telas passam a mostrar a
          leve e o original continua guardado para o botão Baixar e para o Instagram. Cada imagem é baixada uma vez, só
          agora.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={comecar} disabled={rodando}>
            {rodando ? "Gerando..." : feitas > 0 || falhas.length > 0 ? "Rodar de novo" : "Gerar miniaturas"}
          </Button>
          {rodando && (
            <Button
              variant="secondary"
              onClick={() => {
                parar.current = true;
              }}
            >
              Parar
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
        <p className="text-ink">
          Geradas: <b>{feitas}</b> ({mb.toLocaleString("pt-BR")} MB de originais lidos)
          {total !== null && (
            <>
              {" "}
              · Na fila: <b>{total}</b>
            </>
          )}{" "}
          · Puladas: <b>{puladas}</b>
        </p>
        {rodando && <p className="mt-2 text-ink-muted">Trabalhando... deixe esta aba aberta.</p>}
        {fim && feitas === 0 && puladas > 0 && (
          <p className="mt-2 font-medium text-danger">
            Nenhuma miniatura foi gerada ({puladas} puladas). Pode ser formato que o navegador não abre ou permissão do
            bucket: avise o suporte antes de rodar de novo.
          </p>
        )}
        {fim && feitas > 0 && (
          <p className="mt-2 font-medium text-success">
            Pronto. As telas já carregam as versões leves{puladas > 0 ? ` (${puladas} imagens ficaram sem, por serem leves ou de formato não suportado)` : ""}.
          </p>
        )}
        {erro && <p className="mt-2 text-danger">{erro}</p>}
        {falhas.length > 0 && (
          <div className="mt-3">
            <p className="font-medium text-danger">Falharam ({falhas.length}):</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-muted">
              {falhas.map((f, i) => (
                <li key={i}>
                  {f.nome}: {f.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
