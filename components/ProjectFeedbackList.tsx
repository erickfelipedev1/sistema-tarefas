import { formatarDataHora } from "@/lib/format";

interface FeedbackRow {
  id: string;
  stage_label: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

// Avaliações que o cliente mandou pelo portal público (FeedbackWidget) —
// só leitura pra equipe, dentro da aba "Mensagens" de /projetos/[id].
export default function ProjectFeedbackList({ feedback }: { feedback: FeedbackRow[] }) {
  if (feedback.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm font-semibold text-ink">Avaliações do cliente</p>
      <div className="space-y-2">
        {feedback.map((item) => (
          <div key={item.id} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <svg
                    key={n}
                    viewBox="0 0 24 24"
                    className={`h-3.5 w-3.5 ${
                      n <= item.rating ? "fill-brand text-brand" : "fill-none text-line"
                    }`}
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z"
                    />
                  </svg>
                ))}
              </div>
              <span className="text-xs text-ink-muted">
                {formatarDataHora(item.created_at)}
                {item.stage_label && ` · ${item.stage_label}`}
              </span>
            </div>
            {item.comment && (
              <p className="mt-1.5 text-sm text-ink-muted">{item.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
