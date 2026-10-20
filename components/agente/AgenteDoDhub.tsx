"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { CheckCircleIcon, CopyIcon } from "../ui/icons";

export interface ConexaoDoAgente {
  label: string | null;
  last_used_at: string | null;
  created_at: string;
}

const PEDIDOS = [
  { grupo: "Perguntar", texto: "O que está atrasado pra mim? Organiza por cliente." },
  { grupo: "Perguntar", texto: "O que a equipe tem pra entregar esta semana?" },
  { grupo: "Resumir", texto: "Resume o andamento do cliente X: tarefas abertas, projetos e posts esperando aprovação." },
  { grupo: "Resumir", texto: "Lê a última ata do cliente X e me diz o que ficou decidido e o que ainda está pendente." },
  { grupo: "Agir", texto: "Cria uma tarefa no cliente X, no projeto Site novo, pra Ana, entrega sexta, com checklist: texto, arte, aprovação." },
  { grupo: "Agir", texto: "Pega os próximos passos da última ata do cliente X e cria uma tarefa pra cada um." },
  { grupo: "Agir", texto: "Marca a tarefa Y como concluída e comenta que foi entregue ao cliente." },
];

const FERRAMENTAS = [
  "Ler tarefas (com checklist, subtarefas e comentários)",
  "Ler posts, atas e projetos de cada cliente",
  "Criar e editar tarefas, mudar status",
  "Comentar, fazer checklist, registrar horas e anexar arquivos",
];

function haQuanto(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

// O agente de IA do d.hub é o Claude (ou o ChatGPT) da própria pessoa,
// conectado ao servidor MCP do d.hub (/api/mcp) com login pelo d.hub (OAuth):
// sem custo de API pro escritório, e as conversas ficam salvas no Claude.
export default function AgenteDoDhub({ conexoes }: { conexoes: ConexaoDoAgente[] }) {
  const [endereco, setEndereco] = useState("/api/mcp");
  const [copiado, setCopiado] = useState<string | null>(null);
  useEffect(() => setEndereco(`${window.location.origin}/api/mcp`), []);

  const usadas = conexoes.filter((c) => c.last_used_at).sort((a, b) => (b.last_used_at ?? "").localeCompare(a.last_used_at ?? ""));
  const ultima = usadas[0] ?? null;
  const conectado = conexoes.length > 0;

  async function copiar(valor: string, chave: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(chave);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      // Sem permissão pra copiar: o texto continua na tela pra selecionar.
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="grid items-center gap-4 px-5 py-6 sm:px-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:py-8">
          <div className="mx-auto w-full max-w-[260px]">
            <Robo />
          </div>
          <div className="text-center md:text-left">
            {conectado ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-light px-3 py-1 text-xs font-semibold text-success">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Conectado{ultima?.last_used_at ? ` · último uso ${haQuanto(ultima.last_used_at)}` : " · ainda não usado"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-light px-3 py-1 text-xs font-semibold text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
                Ainda não conectado
              </span>
            )}
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Seu agente é o Claude, ligado ao d.hub</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted md:mx-0">
              Conecte uma vez e converse com o Claude (no site, no app do computador ou no celular) como se ele fosse da equipe:
              ele lê as tarefas, posts e atas e faz o que você pedir, em seu nome. Sem custo extra, e as conversas ficam salvas no
              seu Claude.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section data-mov="card" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-ink">Conectar no Claude (uma vez só)</h3>
          <ol className="mt-4 space-y-4">
            <Passo n={1}>
              Abra o <b className="text-ink">claude.ai</b> (ou o app do Claude no computador) e vá em{" "}
              <b className="text-ink">Configurações → Conectores</b>.
            </Passo>
            <Passo n={2}>
              Clique em <b className="text-ink">Adicionar conector personalizado</b>. Em nome, coloque <b className="text-ink">d.hub</b>; em
              endereço, cole:
              <span className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink">{endereco}</code>
                <button
                  type="button"
                  onClick={() => copiar(endereco, "endereco")}
                  className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-hover"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  {copiado === "endereco" ? "Copiado ✓" : "Copiar"}
                </button>
              </span>
            </Passo>
            <Passo n={3}>
              Clique em <b className="text-ink">Conectar</b>. Vai abrir a tela do d.hub: entre com seu usuário e clique em{" "}
              <b className="text-ink">Autorizar</b>.
            </Passo>
            <Passo n={4}>
              Pronto. Numa conversa nova, peça qualquer coisa do d.hub. No celular, o conector aparece sozinho no app do Claude.
            </Passo>
          </ol>
          <p className="mt-5 rounded-xl bg-surface-hover/60 px-3 py-2.5 text-xs text-ink-muted">
            Antes de criar ou alterar algo, o Claude pede sua permissão (dá pra liberar de vez em cada ferramenta). Ele só vê o que
            você vê no d.hub, e tudo fica registrado em seu nome, com &quot;(via IA)&quot;.
          </p>
          <p className="mt-3 text-xs text-ink-muted">
            Usa ChatGPT, Claude Code ou quer gerenciar as conexões?{" "}
            <Link href="/conta/ia" className="font-medium text-brand-forte hover:underline">
              Integração com IA
            </Link>
            {conectado ? ` · ${conexoes.length} ${conexoes.length === 1 ? "conexão ativa" : "conexões ativas"}` : ""}
          </p>
        </section>

        <section data-mov="card" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-ink">O que ele consegue fazer</h3>
          <ul className="mt-3 space-y-2">
            {FERRAMENTAS.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-forte" />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-muted">
            Posts e atas ele só lê. Mensagens, faturas e arquivos do Drive ele não acessa.
          </p>
        </section>
      </div>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Peça assim (toque pra copiar)</h3>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {PEDIDOS.map((p, i) => (
            <button
              key={p.texto}
              type="button"
              data-mov="bloco"
              onClick={() => copiar(p.texto, `pedido-${i}`)}
              className="group flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand/40 hover:bg-surface-hover/40"
            >
              <span className="flex w-full items-center justify-between">
                <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-forte">
                  {p.grupo}
                </span>
                <span className="text-[11px] text-ink-muted group-hover:text-ink">{copiado === `pedido-${i}` ? "Copiado ✓" : "Copiar"}</span>
              </span>
              <span className="text-sm text-ink">&ldquo;{p.texto}&rdquo;</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-ink-muted">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-navy">{n}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

// O robô da página: liga, flutua, pisca e a antena acende. Com "efeitos de
// animação" desligados no sistema, só a antena e as faíscas piscam.
function Robo() {
  const palco = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const raiz = palco.current;
    if (!raiz) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduzido) {
        gsap.to(".ag-antena", { opacity: 0.3, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" });
        gsap.utils.toArray<SVGElement>(".ag-faisca").forEach((f, i) => {
          gsap.fromTo(f, { opacity: 0.15 }, { opacity: 1, duration: 0.9, yoyo: true, repeat: -1, delay: i * 0.4, ease: "sine.inOut" });
        });
        return;
      }
      gsap.from(".ag-cabeca", { scale: 0.6, opacity: 0, duration: 0.8, ease: "back.out(1.6)", transformOrigin: "50% 60%" });
      gsap.from(".ag-orbita", { scale: 0.3, opacity: 0, duration: 1, stagger: 0.15, ease: "power3.out", transformOrigin: "50% 50%" });
      gsap.to(".ag-cabeca", { y: -8, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 0.8 });
      gsap.to(".ag-sombra", { scaleX: 0.8, opacity: 0.25, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 0.8, transformOrigin: "50% 50%" });
      gsap.to(".ag-orbita-1", { rotation: 360, duration: 9, ease: "none", repeat: -1, svgOrigin: "160 128" });
      gsap.to(".ag-orbita-2", { rotation: -360, duration: 14, ease: "none", repeat: -1, svgOrigin: "160 128" });
      gsap.to(".ag-olho", { scaleY: 0.1, duration: 0.09, yoyo: true, repeat: -1, repeatDelay: 2.6, transformOrigin: "50% 50%", ease: "power1.inOut" });
      gsap.to(".ag-antena", { opacity: 0.25, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(".ag-antena-halo", { scale: 2.2, opacity: 0, duration: 1.4, repeat: -1, ease: "power2.out", transformOrigin: "50% 50%" });
      gsap.to(".ag-boca", { scaleX: 0.25, duration: 0.35, stagger: { each: 0.12, yoyo: true, repeat: -1 }, transformOrigin: "50% 50%", ease: "sine.inOut" });
      gsap.utils.toArray<SVGElement>(".ag-faisca").forEach((f, i) => {
        gsap.fromTo(
          f,
          { opacity: 0, scale: 0.2 },
          { opacity: 1, scale: 1, duration: 0.5, yoyo: true, repeat: -1, repeatDelay: 1.2, delay: i * 0.45, ease: "sine.inOut", transformOrigin: "50% 50%" }
        );
      });
    }, raiz);
    return () => ctx.revert();
  }, []);

  const faiscas = [
    { x: 52, y: 70, r: 3 },
    { x: 270, y: 58, r: 2.5 },
    { x: 286, y: 170, r: 3.5 },
    { x: 36, y: 186, r: 2.5 },
    { x: 160, y: 22, r: 2 },
  ];

  return (
    <svg ref={palco} viewBox="0 0 320 250" className="h-auto w-full" role="img" aria-label="Robô do agente de IA">
      <g className="ag-orbita ag-orbita-1">
        <ellipse cx="160" cy="128" rx="138" ry="56" fill="none" className="stroke-line" strokeWidth="1.5" strokeDasharray="4 7" />
        <circle cx="298" cy="128" r="6" className="fill-brand" />
      </g>
      <g className="ag-orbita ag-orbita-2">
        <ellipse cx="160" cy="128" rx="112" ry="92" fill="none" className="stroke-line" strokeWidth="1.5" strokeDasharray="2 9" transform="rotate(-24 160 128)" />
        <circle cx="88" cy="58" r="4.5" className="fill-brand-forte" />
      </g>
      {faiscas.map((f, i) => (
        <path
          key={i}
          className="ag-faisca fill-brand"
          d={`M${f.x} ${f.y - f.r * 2}l${f.r * 0.5} ${f.r * 1.5} ${f.r * 1.5} ${f.r * 0.5}-${f.r * 1.5} ${f.r * 0.5}-${f.r * 0.5} ${f.r * 1.5}-${f.r * 0.5}-${f.r * 1.5}-${f.r * 1.5}-${f.r * 0.5} ${f.r * 1.5}-${f.r * 0.5}Z`}
        />
      ))}
      <ellipse className="ag-sombra fill-ink" opacity="0.12" cx="160" cy="232" rx="56" ry="7" />
      <g className="ag-cabeca">
        <line x1="160" y1="74" x2="160" y2="52" className="stroke-ink-muted" strokeWidth="3" strokeLinecap="round" />
        <circle className="ag-antena-halo fill-brand" cx="160" cy="46" r="7" opacity="0.6" />
        <circle className="ag-antena fill-brand" cx="160" cy="46" r="7" />
        <rect x="84" y="74" width="152" height="118" rx="30" className="fill-surface-hover stroke-ink-muted" strokeWidth="3" />
        <rect x="72" y="114" width="12" height="36" rx="5" className="fill-ink-muted" />
        <rect x="236" y="114" width="12" height="36" rx="5" className="fill-ink-muted" />
        <rect x="102" y="94" width="116" height="78" rx="20" className="fill-navy" />
        <rect className="ag-olho fill-brand" x="128" y="114" width="16" height="22" rx="8" />
        <rect className="ag-olho fill-brand" x="176" y="114" width="16" height="22" rx="8" />
        <rect className="ag-boca fill-brand" x="134" y="150" width="14" height="5" rx="2.5" />
        <rect className="ag-boca fill-brand" x="153" y="150" width="14" height="5" rx="2.5" />
        <rect className="ag-boca fill-brand" x="172" y="150" width="14" height="5" rx="2.5" />
      </g>
    </svg>
  );
}
