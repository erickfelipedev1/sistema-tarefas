import { Button } from "../ui/Button";
import { SparklesIcon } from "../ui/icons";

// Área de destaque que responde a pergunta "o que eu preciso fazer
// agora?" — o elemento de maior prioridade visual da tela. Fica
// dinâmico: muda de acordo com a etapa atual, e vira uma mensagem de
// conclusão quando tudo já foi feito.
export function NextStepCard({
  done,
  hint,
  ctaLabel,
  onClick,
}: {
  done: boolean;
  hint: string;
  ctaLabel: string;
  onClick: () => void;
}) {
  if (done) {
    return (
      <div className="mb-6 rounded-2xl border border-brand/30 bg-brand-light p-5 sm:p-6">
        <p className="text-base font-semibold text-ink sm:text-lg">
          Seu onboarding está completo! 🎉
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Todas as etapas foram concluídas e seu projeto está pronto para
          começar.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <SparklesIcon className="h-3.5 w-3.5 text-brand" />
        Próximo passo
      </p>
      <p className="mt-1.5 text-sm text-ink sm:text-base">{hint}</p>
      <Button onClick={onClick} className="mt-4">
        {ctaLabel}
        <span aria-hidden>→</span>
      </Button>
    </div>
  );
}
