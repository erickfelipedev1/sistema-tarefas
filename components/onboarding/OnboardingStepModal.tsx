"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import {
  BuildingIcon,
  CheckCircleIcon,
  FileTextIcon,
  TargetIcon,
  UsersIcon,
  XIcon,
} from "../ui/icons";
import { metaForStep } from "@/lib/onboarding";
import type {
  CompanyInfoPayload,
  ObjectivesPayload,
  ParticipantsPayload,
} from "@/lib/onboarding";
import type { OnboardingStep, OnboardingStepKey } from "@/lib/types";

const campoClasse =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const labelClasse = "mb-1 block text-xs font-medium text-ink-muted";

const STEP_ICON: Record<OnboardingStepKey, (props: { className?: string }) => JSX.Element> = {
  company_info: BuildingIcon,
  objectives: TargetIcon,
  scope: FileTextIcon,
  participants: UsersIcon,
  approval: CheckCircleIcon,
};

// Modal com o formulário/revisão de uma etapa — o conteúdo muda de
// acordo com "step", mas a moldura (cabeçalho, fechar, rodapé) é a
// mesma, seguindo o mesmo padrão de modal já usado no sistema (ver
// NovoCanalModal / TaskModal).
export function OnboardingStepModal({
  step,
  wasCompleted,
  initialPayload,
  allSteps,
  tasks,
  saving,
  errorMessage,
  onClose,
  onSubmit,
}: {
  step: OnboardingStepKey;
  wasCompleted: boolean;
  initialPayload: Record<string, unknown> | null;
  allSteps: OnboardingStep[];
  tasks: { id: string; title: string; status: string; due_date: string | null }[];
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, complete: boolean) => void;
}) {
  const meta = metaForStep(step);
  const Icon = STEP_ICON[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-surface shadow-dropdown">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">{meta.title}</h2>
              <p className="text-xs text-ink-muted">{meta.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {step === "company_info" && (
            <CompanyInfoForm
              initialPayload={initialPayload as unknown as CompanyInfoPayload | null}
              saving={saving}
              onSubmit={onSubmit}
            />
          )}
          {step === "objectives" && (
            <ObjectivesForm
              initialPayload={initialPayload as unknown as ObjectivesPayload | null}
              saving={saving}
              onSubmit={onSubmit}
            />
          )}
          {step === "scope" && (
            <ScopeReview
              tasks={tasks}
              wasCompleted={wasCompleted}
              saving={saving}
              onSubmit={onSubmit}
            />
          )}
          {step === "participants" && (
            <ParticipantsForm
              initialPayload={initialPayload as unknown as ParticipantsPayload | null}
              saving={saving}
              onSubmit={onSubmit}
            />
          )}
          {step === "approval" && (
            <ApprovalReview
              allSteps={allSteps}
              wasCompleted={wasCompleted}
              saving={saving}
              onSubmit={onSubmit}
            />
          )}

          {errorMessage && (
            <p role="alert" className="mt-3 text-xs text-danger">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Etapa 1: Informações da empresa ---------------------------------

function CompanyInfoForm({
  initialPayload,
  saving,
  onSubmit,
}: {
  initialPayload: CompanyInfoPayload | null;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>, complete: boolean) => void;
}) {
  const [companyName, setCompanyName] = useState(initialPayload?.company_name ?? "");
  const [contactName, setContactName] = useState(initialPayload?.contact_name ?? "");
  const [segment, setSegment] = useState(initialPayload?.segment ?? "");
  const [notes, setNotes] = useState(initialPayload?.notes ?? "");
  const [erro, setErro] = useState<string | null>(null);

  function payload(): Record<string, unknown> {
    return {
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      segment: segment.trim() || undefined,
      notes: notes.trim() || undefined,
    };
  }

  function concluir(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !contactName.trim()) {
      setErro("Preenche o nome da empresa e o seu nome pra continuar.");
      return;
    }
    setErro(null);
    onSubmit(payload(), true);
  }

  return (
    <form onSubmit={concluir} className="space-y-3.5">
      <div>
        <label className={labelClasse}>Nome da empresa</label>
        <input
          autoFocus
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Ex: NDL Comércio Ltda."
          className={campoClasse}
        />
      </div>
      <div>
        <label className={labelClasse}>Seu nome</label>
        <input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Como podemos te chamar"
          className={campoClasse}
        />
      </div>
      <div>
        <label className={labelClasse}>Segmento (opcional)</label>
        <input
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          placeholder="Ex: Varejo, Advocacia, Indústria..."
          className={campoClasse}
        />
      </div>
      <div>
        <label className={labelClasse}>Observações (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Algo mais que a gente deveria saber sobre a empresa?"
          className={`${campoClasse} resize-none`}
        />
      </div>
      {erro && <p className="text-xs text-danger">{erro}</p>}
      <FormFooter
        saving={saving}
        onSaveDraft={() => onSubmit(payload(), false)}
      />
    </form>
  );
}

// --- Etapa 2: Objetivos do projeto ------------------------------------

function ObjectivesForm({
  initialPayload,
  saving,
  onSubmit,
}: {
  initialPayload: ObjectivesPayload | null;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>, complete: boolean) => void;
}) {
  const [objectives, setObjectives] = useState(initialPayload?.objectives ?? "");
  const [erro, setErro] = useState<string | null>(null);

  function payload(): Record<string, unknown> {
    return { objectives: objectives.trim() };
  }

  function concluir(e: React.FormEvent) {
    e.preventDefault();
    if (!objectives.trim()) {
      setErro("Conta pra gente o que você espera alcançar.");
      return;
    }
    setErro(null);
    onSubmit(payload(), true);
  }

  return (
    <form onSubmit={concluir} className="space-y-3.5">
      <div>
        <label className={labelClasse}>O que você espera alcançar com este projeto?</label>
        <textarea
          autoFocus
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          rows={6}
          placeholder="Ex: aumentar as vendas online, ter mais visibilidade da marca, organizar os processos internos..."
          className={`${campoClasse} resize-none`}
        />
      </div>
      {erro && <p className="text-xs text-danger">{erro}</p>}
      <FormFooter
        saving={saving}
        onSaveDraft={() => onSubmit(payload(), false)}
      />
    </form>
  );
}

// --- Etapa 3: Escopo do projeto ---------------------------------------

const STATUS_LABEL: Record<string, string> = {
  todo: "Aberta",
  doing: "Em andamento",
  done: "Concluída",
};

function ScopeReview({
  tasks,
  wasCompleted,
  saving,
  onSubmit,
}: {
  tasks: { id: string; title: string; status: string; due_date: string | null }[];
  wasCompleted: boolean;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>, complete: boolean) => void;
}) {
  const [confirmado, setConfirmado] = useState(wasCompleted);

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmado) return;
    onSubmit({ acknowledged: true }, true);
  }

  return (
    <form onSubmit={confirmar} className="space-y-3.5">
      <p className="text-sm text-ink-muted">
        Estas são as atividades e entregas já previstas para o seu projeto:
      </p>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-line bg-canvas px-4 py-5 text-center">
          <p className="text-xs text-ink-muted">
            Ainda não há atividades cadastradas — nossa equipe vai detalhar o
            escopo em breve.
          </p>
        </div>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-line bg-canvas p-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm"
            >
              <span className="truncate text-ink">{task.title}</span>
              <span className="flex-shrink-0 text-xs text-ink-muted">
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(e) => setConfirmado(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-line text-brand focus:ring-brand/30"
        />
        Li e estou de acordo com o escopo do projeto.
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" size="sm" disabled={!confirmado || saving}>
          {saving ? "Salvando..." : "Confirmar leitura"}
        </Button>
      </div>
    </form>
  );
}

// --- Etapa 4: Participantes --------------------------------------------

type Participante = { name: string; email: string; role: string };

function ParticipantsForm({
  initialPayload,
  saving,
  onSubmit,
}: {
  initialPayload: ParticipantsPayload | null;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>, complete: boolean) => void;
}) {
  const [participantes, setParticipantes] = useState<Participante[]>(
    initialPayload?.participants?.length
      ? initialPayload.participants.map((p) => ({
          name: p.name,
          email: p.email,
          role: p.role ?? "",
        }))
      : [{ name: "", email: "", role: "" }]
  );
  const [erro, setErro] = useState<string | null>(null);

  function atualizar(i: number, campo: keyof Participante, valor: string) {
    setParticipantes((atual) =>
      atual.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p))
    );
  }

  function adicionar() {
    setParticipantes((atual) => [...atual, { name: "", email: "", role: "" }]);
  }

  function remover(i: number) {
    setParticipantes((atual) => atual.filter((_, idx) => idx !== i));
  }

  function payload(): Record<string, unknown> {
    const validos = participantes
      .map((p) => ({ name: p.name.trim(), email: p.email.trim(), role: p.role.trim() }))
      .filter((p) => p.name || p.email);
    return { participants: validos };
  }

  function concluir(e: React.FormEvent) {
    e.preventDefault();
    const validos = participantes.filter((p) => p.name.trim() && p.email.trim());
    if (validos.length === 0) {
      setErro("Adiciona pelo menos uma pessoa (nome e e-mail) pra continuar.");
      return;
    }
    setErro(null);
    onSubmit(payload(), true);
  }

  return (
    <form onSubmit={concluir} className="space-y-3">
      <div className="space-y-3">
        {participantes.map((p, i) => (
          <div key={i} className="rounded-xl border border-line bg-canvas p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-muted">
                Participante {i + 1}
              </p>
              {participantes.length > 1 && (
                <button
                  type="button"
                  onClick={() => remover(i)}
                  className="text-xs text-ink-muted hover:text-danger"
                >
                  Remover
                </button>
              )}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                value={p.name}
                onChange={(e) => atualizar(i, "name", e.target.value)}
                placeholder="Nome"
                className={campoClasse}
              />
              <input
                type="email"
                value={p.email}
                onChange={(e) => atualizar(i, "email", e.target.value)}
                placeholder="E-mail"
                className={campoClasse}
              />
            </div>
            <input
              value={p.role}
              onChange={(e) => atualizar(i, "role", e.target.value)}
              placeholder="Função no projeto (opcional)"
              className={`${campoClasse} mt-2`}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={adicionar}
        className="text-xs font-medium text-brand hover:underline"
      >
        + Adicionar participante
      </button>

      {erro && <p className="text-xs text-danger">{erro}</p>}
      <FormFooter
        saving={saving}
        submitLabel="Salvar participantes"
        onSaveDraft={() => onSubmit(payload(), false)}
      />
    </form>
  );
}

// --- Etapa 5: Aprovação --------------------------------------------------

function ApprovalReview({
  allSteps,
  wasCompleted,
  saving,
  onSubmit,
}: {
  allSteps: OnboardingStep[];
  wasCompleted: boolean;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>, complete: boolean) => void;
}) {
  const company = allSteps.find((s) => s.step_key === "company_info")
    ?.payload as unknown as CompanyInfoPayload | undefined;
  const objectives = allSteps.find((s) => s.step_key === "objectives")
    ?.payload as unknown as ObjectivesPayload | undefined;
  const scopeOk = allSteps.find((s) => s.step_key === "scope")?.status === "completed";
  const participants = allSteps.find((s) => s.step_key === "participants")
    ?.payload as unknown as ParticipantsPayload | undefined;

  function confirmar() {
    onSubmit({ approved: true }, true);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Revise as informações abaixo antes de confirmar.
      </p>

      <ResumoLinha label="Empresa" valor={company?.company_name} />
      <ResumoLinha label="Contato" valor={company?.contact_name} />
      <ResumoLinha label="Objetivos" valor={objectives?.objectives} />
      <ResumoLinha
        label="Escopo"
        valor={scopeOk ? "Revisado e confirmado" : "Pendente"}
      />
      <ResumoLinha
        label="Participantes"
        valor={
          participants?.participants?.length
            ? participants.participants.map((p) => p.name).join(", ")
            : undefined
        }
      />

      {wasCompleted && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Aprovado
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" onClick={confirmar} disabled={saving}>
          {saving ? "Salvando..." : "Confirmar e aprovar"}
        </Button>
      </div>
    </div>
  );
}

function ResumoLinha({ label, valor }: { label: string; valor: string | undefined | null }) {
  return (
    <div className="rounded-lg border border-line bg-canvas px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
        {valor || "Não informado"}
      </p>
    </div>
  );
}

// --- Rodapé comum aos formulários (rascunho + concluir) -----------------

function FormFooter({
  saving,
  onSaveDraft,
  submitLabel = "Concluir etapa",
}: {
  saving: boolean;
  onSaveDraft: () => void;
  submitLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onSaveDraft}
        disabled={saving}
      >
        Salvar rascunho
      </Button>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Salvando..." : submitLabel}
      </Button>
    </div>
  );
}
