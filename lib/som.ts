// Som de notificação ("plim" de duas notas), gerado com Web Audio: não
// precisa de arquivo de áudio. Os navegadores só liberam áudio depois de
// algum clique ou tecla na página — por isso prepararSom() fica escutando a
// primeira interação (ver lib/notifications.tsx) e deixa o AudioContext
// pronto; daí em diante o som toca mesmo com a aba em segundo plano.

let contexto: AudioContext | null = null;
let ultimoSom = 0;

function obterContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!contexto) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    contexto = new Ctor();
  }
  return contexto;
}

// Chamado no primeiro clique/tecla: cria e "destrava" o áudio.
export function prepararSom() {
  const ctx = obterContexto();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

function nota(ctx: AudioContext, frequencia: number, inicio: number, duracao: number) {
  const osc = ctx.createOscillator();
  const volume = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequencia;
  volume.gain.setValueAtTime(0.0001, inicio);
  volume.gain.exponentialRampToValueAtTime(0.18, inicio + 0.015);
  volume.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
  osc.connect(volume).connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + duracao + 0.02);
}

export function tocarSomNotificacao() {
  const ctx = obterContexto();
  if (!ctx) return;
  // Várias mensagens de uma vez não viram uma rajada de sons.
  const agora = Date.now();
  if (agora - ultimoSom < 1500) return;
  ultimoSom = agora;

  const tocar = () => {
    const t = ctx.currentTime + 0.01;
    nota(ctx, 880, t, 0.22);
    nota(ctx, 1320, t + 0.12, 0.3);
  };
  if (ctx.state === "suspended") {
    ctx.resume().then(tocar).catch(() => {});
  } else {
    tocar();
  }
}
