"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_WORKSPACE = 80;
const MAX_NAME = 50;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [needsWorkspaceStep, setNeedsWorkspaceStep] = useState(false);

  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const { data: settings } = await supabase
        .from("settings")
        .select("workspace_name")
        .eq("id", true)
        .maybeSingle();

      const precisaDoWorkspace = !settings?.workspace_name;
      setNeedsWorkspaceStep(precisaDoWorkspace);
      setStep(precisaDoWorkspace ? 0 : 1);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleWorkspaceNext(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    setSaving(true);
    await supabase
      .from("settings")
      .upsert({ id: true, workspace_name: workspaceName.trim() });
    setSaving(false);
    setStep(1);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const extensao = file.name.split(".").pop() ?? "png";
    const path = `${userId}/avatar.${extensao}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
    }
    setUploading(false);
  }

  async function handleNameNext(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !userId) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ name: name.trim(), avatar_url: avatarUrl })
      .eq("id", userId);
    setSaving(false);
    setStep(2);
  }

  function handleFinish() {
    router.push("/board");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Carregando...
      </div>
    );
  }

  const totalSteps = needsWorkspaceStep ? 3 : 2;
  const currentDot = needsWorkspaceStep ? step : step - 1;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= currentDot ? "bg-slate-900" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {step === 0 && needsWorkspaceStep && (
          <form onSubmit={handleWorkspaceNext}>
            <h1 className="mb-1 text-2xl font-bold text-slate-900">
              Nomeie o workspace
            </h1>
            <p className="mb-6 text-sm text-slate-500">
              Escolha algo que sua equipe reconheça, como o nome da
              empresa. Dá pra mudar depois.
            </p>
            <div className="relative mb-6">
              <input
                autoFocus
                value={workspaceName}
                onChange={(e) =>
                  setWorkspaceName(e.target.value.slice(0, MAX_WORKSPACE))
                }
                placeholder="Ex: Now Digital Lab"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-12 text-sm focus:border-slate-500 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {workspaceName.length}
              </span>
            </div>
            <button
              type="submit"
              disabled={!workspaceName.trim() || saving}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Próximo"}
            </button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleNameNext}>
            <h1 className="mb-1 text-2xl font-bold text-slate-900">
              Qual é o seu nome?
            </h1>
            <p className="mb-6 text-sm text-slate-500">
              Pra sua equipe te reconhecer no sistema.
            </p>
            <div className="relative mb-4">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
                placeholder="Seu nome"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-12 text-sm focus:border-slate-500 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {name.length}
              </span>
            </div>

            <label className="mb-6 flex items-center gap-3 text-sm text-slate-600">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-lg font-semibold text-white">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (name || userEmail || "?").slice(0, 1).toUpperCase()
                )}
              </span>
              <span>
                <span className="block font-medium text-slate-700">
                  {uploading ? "Enviando..." : "Adicionar uma foto (opcional)"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="mt-1 text-xs"
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Próximo"}
            </button>
          </form>
        )}

        {step === 2 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-slate-900">
              Tudo pronto!
            </h1>
            <p className="mb-6 text-sm text-slate-500">
              Sua conta está configurada. Já dá pra usar o quadro de
              tarefas, a wiki e as mensagens.
            </p>
            <button
              onClick={handleFinish}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Começar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
