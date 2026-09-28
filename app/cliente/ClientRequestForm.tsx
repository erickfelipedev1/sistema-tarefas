"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { enviarSolicitacaoCliente } from "./actions";

const TIPOS = [
  "Design",
  "Marketing",
  "Vídeo",
  "Social Media",
  "Tráfego pago",
  "Desenvolvimento",
  "Outro",
];
const URGENCIAS = ["Baixa", "Média", "Alta", "Urgente"];
const DESCRICAO_MAX = 2000;

const campoClasse =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export default function ClientRequestForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [demandType, setDemandType] = useState("");
  const [urgency, setUrgency] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [description, setDescription] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    setEnviando(true);
    const resultado = await enviarSolicitacaoCliente({
      title,
      demandType,
      urgency,
      dueDate,
      driveUrl,
      description,
    });
    setEnviando(false);

    if ("erro" in resultado) {
      setErro(resultado.erro);
      if (resultado.erro.includes("sessão")) router.push("/cliente/login");
      return;
    }

    setTitle("");
    setDemandType("");
    setUrgency("");
    setDueDate("");
    setDriveUrl("");
    setDescription("");
    setSucesso(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-line bg-surface p-5"
    >
      <h2 className="text-sm font-semibold text-ink">Nova solicitação</h2>

      <Campo label="O que você precisa?" htmlFor="titulo" required>
        <input
          id="titulo"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Arte para o post de lançamento"
          className={campoClasse}
        />
      </Campo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo label="Tipo" htmlFor="tipo">
          <select
            id="tipo"
            value={demandType}
            onChange={(e) => setDemandType(e.target.value)}
            className={campoClasse}
          >
            <option value="">Selecione</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Urgência" htmlFor="urgencia">
          <select
            id="urgencia"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            className={campoClasse}
          >
            <option value="">Selecione</option>
            {URGENCIAS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Prazo desejado" htmlFor="prazo">
          <input
            id="prazo"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={campoClasse}
          />
        </Campo>
      </div>

      <Campo label="Link com materiais (Drive, etc.)" htmlFor="drive">
        <input
          id="drive"
          type="url"
          value={driveUrl}
          onChange={(e) => setDriveUrl(e.target.value)}
          placeholder="https://"
          className={campoClasse}
        />
      </Campo>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="descricao" className="text-xs font-medium text-ink-muted">
            Detalhes
          </label>
          <span className="text-xs text-ink-muted">
            {description.length}/{DESCRICAO_MAX}
          </span>
        </div>
        <textarea
          id="descricao"
          rows={5}
          maxLength={DESCRICAO_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explique com detalhes o que precisa ser feito"
          className={campoClasse}
        />
      </div>

      {erro && (
        <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{erro}</p>
      )}
      {sucesso && (
        <p className="rounded-lg bg-success-light px-3 py-2 text-sm text-success">
          Solicitação enviada! A equipe já recebeu.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar solicitação"}
        </Button>
      </div>
    </form>
  );
}

function Campo({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}
