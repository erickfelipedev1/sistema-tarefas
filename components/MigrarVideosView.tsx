"use client";

import { useRef, useState } from "react";
import { migrarVideosParaODrive } from "@/lib/actions/migrar-videos";
import { Button } from "@/components/ui/Button";

// Chama a migração em passos (cada um trabalha uns 2 minutos) até acabar ou
// você parar. Pode fechar a aba: o que já passou fica passado, e dá pra
// continuar depois.
export default function MigrarVideosView() {
  const [rodando, setRodando] = useState(false);
  const [migrados, setMigrados] = useState(0);
  const [mb, setMb] = useState(0);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [falhas, setFalhas] = useState<{ id: string; nome: string; motivo: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [fim, setFim] = useState(false);
  const parar = useRef(false);

  async function comecar() {
    setRodando(true);
    setErro(null);
    setFim(false);
    parar.current = false;
    const ignorar: string[] = falhas.map((f) => f.id);
    for (;;) {
      let r;
      try {
        r = await migrarVideosParaODrive(ignorar);
      } catch {
        setErro("A conexão caiu no meio. Clique em Continuar pra seguir de onde parou.");
        break;
      }
      if ("erro" in r) {
        setErro(r.erro);
        break;
      }
      setMigrados((n) => n + r.migrados.length);
      setMb((n) => Math.round((n + r.migrados.reduce((s, m) => s + m.mb, 0)) * 10) / 10);
      setRestantes(r.restantes);
      if (r.falhas.length > 0) {
        ignorar.push(...r.falhas.map((f) => f.id));
        setFalhas((atual) => [...atual, ...r.falhas]);
      }
      if (r.restantes === 0) {
        setFim(true);
        break;
      }
      // Nada andou nem falhou neste passo: evita ficar em laço.
      if (r.migrados.length === 0 && r.falhas.length === 0) break;
      if (parar.current) break;
    }
    setRodando(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-muted">
          Cada vídeo é baixado do Supabase, enviado pro Drive (o tamanho é conferido) e só então o anexo passa a apontar
          pro Drive e o arquivo sai do Supabase. Pra quem usa a tarefa nada muda: mesmo nome, mesmo lugar, com o selo D.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={comecar} disabled={rodando}>
            {rodando ? "Migrando..." : migrados > 0 || falhas.length > 0 ? "Continuar" : "Começar a migração"}
          </Button>
          {rodando && (
            <Button
              variant="secondary"
              onClick={() => {
                parar.current = true;
              }}
            >
              Parar depois do passo atual
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
        <p className="text-ink">
          Migrados: <b>{migrados}</b> ({mb.toLocaleString("pt-BR")} MB){" "}
          {restantes !== null && (
            <>
              · Faltam: <b>{restantes}</b>
            </>
          )}
        </p>
        {rodando && <p className="mt-2 text-ink-muted">Trabalhando... cada passo leva até uns 2 minutos, deixe esta aba aberta.</p>}
        {fim && <p className="mt-2 font-medium text-success">Tudo migrado. O espaço no Supabase cai na próxima atualização do painel.</p>}
        {erro && <p className="mt-2 text-danger">{erro}</p>}
        {falhas.length > 0 && (
          <div className="mt-3">
            <p className="font-medium text-danger">Não migraram ({falhas.length}), seguem no Supabase:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-muted">
              {falhas.map((f) => (
                <li key={f.id}>
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
