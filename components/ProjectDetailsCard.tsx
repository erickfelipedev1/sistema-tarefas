"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ProjectStatus } from "@/lib/types";
import { PROJECT_STAGES } from "@/lib/project-status";
import { Button } from "./ui/Button";

const campoClasse =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Dados que alimentam o portal do cliente (Visão geral em
// /progresso/<token>): etapa, responsável, datas e o "informações
// iniciais confirmadas". A equipe edita aqui — o cliente só visualiza.
export default function ProjectDetailsCard({
  projectId,
  profiles,
  initialStatus,
  initialResponsibleId,
  initialStartDate,
  initialTargetEndDate,
  initialInfoConfirmed,
}: {
  projectId: string;
  profiles: Profile[];
  initialStatus: ProjectStatus;
  initialResponsibleId: string | null;
  initialStartDate: string | null;
  initialTargetEndDate: string | null;
  initialInfoConfirmed: boolean;
}) {
  const supabase = createClient();
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);
  const [responsibleId, setResponsibleId] = useState(initialResponsibleId ?? "");
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [targetEndDate, setTargetEndDate] = useState(initialTargetEndDate ?? "");
  const [infoConfirmed, setInfoConfirmed] = useState(initialInfoConfirmed);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const responsavel = profiles.find((p) => p.id === responsibleId);

    const { error } = await supabase
      .from("projects")
      .update({
        status,
        responsible_id: responsibleId || null,
        responsible_label: responsavel ? responsavel.name || responsavel.username : null,
        start_date: startDate || null,
        target_end_date: targetEndDate || null,
        initial_info_confirmed: infoConfirmed,
      })
      .eq("id", projectId);

    setSalvando(false);
    if (error) {
      setErro(
        "Não foi possível salvar. Confere se a migration 0030_client_portal.sql já foi rodada no Supabase."
      );
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  }

  return (
    <div className="mb-5 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Portal do cliente</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Esses dados aparecem na Visão geral do link público do projeto
        (/progresso/…) — o cliente só visualiza, quem edita é a equipe.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Etapa</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className={campoClasse}
          >
            {PROJECT_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Responsável</label>
          <select
            value={responsibleId}
            onChange={(e) => setResponsibleId(e.target.value)}
            className={campoClasse}
          >
            <option value="">Não definido</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.username}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Início previsto</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={campoClasse}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Previsão de entrega
          </label>
          <input
            type="date"
            value={targetEndDate}
            onChange={(e) => setTargetEndDate(e.target.value)}
            className={campoClasse}
          />
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={infoConfirmed}
          onChange={(e) => setInfoConfirmed(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-line accent-brand"
        />
        Cliente já passou as informações iniciais (alinhamento feito por fora do sistema)
      </label>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
        {salvo && <span className="text-xs text-success">Salvo.</span>}
        {erro && <span className="text-xs text-danger">{erro}</span>}
      </div>
    </div>
  );
}
