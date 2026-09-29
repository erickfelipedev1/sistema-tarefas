"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { PageHeader } from "./ui/PageHeader";
import TrocarSenha from "./TrocarSenha";

const MAX_NAME = 50;
const MAX_CARGO = 60;
const MAX_FOTO_MB = 5;

const campoClasse =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

// Troca de nome, cargo e foto depois do onboarding — mesmo bucket "avatars" e
// mesmo caminho (<id>/avatar.<ext>) que o onboarding já usa.
export default function ProfileEditor({
  userId,
  username,
  initialName,
  initialAvatarUrl,
  initialCargo,
  cargoDisponivel,
}: {
  userId: string;
  username: string | null;
  initialName: string;
  initialAvatarUrl: string | null;
  initialCargo: string;
  cargoDisponivel: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const inputFoto = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [cargo, setCargo] = useState(initialCargo);
  const [salvos, setSalvos] = useState({ name: initialName.trim(), cargo: initialCargo.trim() });
  const mudou = name.trim() !== salvos.name || cargo.trim() !== salvos.cargo;
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function salvarPerfil(campos: {
    name?: string;
    avatar_url?: string | null;
    cargo?: string | null;
  }) {
    const { error } = await supabase.from("profiles").update(campos).eq("id", userId);
    if (error) {
      setErro(`Não deu pra salvar: ${error.message}`);
      return false;
    }
    router.refresh();
    return true;
  }

  async function trocarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);
    setSucesso(null);

    if (!file.type.startsWith("image/")) {
      setErro("Escolha um arquivo de imagem (JPG, PNG...).");
      return;
    }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      setErro(`A foto pode ter no máximo ${MAX_FOTO_MB} MB.`);
      return;
    }

    setEnviandoFoto(true);
    const extensao = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/avatar.${extensao}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      setEnviandoFoto(false);
      setErro("Não deu pra enviar a foto. Tente de novo.");
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const novaUrl = `${data.publicUrl}?t=${Date.now()}`;
    if (await salvarPerfil({ avatar_url: novaUrl })) {
      setAvatarUrl(novaUrl);
      setSucesso("Foto atualizada.");
    }
    setEnviandoFoto(false);
  }

  async function removerFoto() {
    setErro(null);
    setSucesso(null);
    if (await salvarPerfil({ avatar_url: null })) {
      setAvatarUrl(null);
      setSucesso("Foto removida.");
    }
  }

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault();
    const nome = name.trim();
    if (!nome) {
      setErro("O nome não pode ficar vazio.");
      return;
    }
    setErro(null);
    setSucesso(null);
    setSalvando(true);
    const campos: { name: string; cargo?: string | null } = { name: nome };
    if (cargoDisponivel) campos.cargo = cargo.trim() || null;
    if (await salvarPerfil(campos)) {
      setSalvos({ name: nome, cargo: cargo.trim() });
      setSucesso("Dados atualizados.");
    }
    setSalvando(false);
  }

  return (
    <div>
      <PageHeader title="Meu perfil" subtitle="Como a equipe te vê no sistema, e sua senha." />

      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <p className="text-sm font-semibold text-ink">Foto</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Avatar name={name || username} src={avatarUrl} size="md" className="!h-16 !w-16 !text-xl" />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={enviandoFoto}
                onClick={() => inputFoto.current?.click()}
              >
                {enviandoFoto ? "Enviando..." : avatarUrl ? "Trocar foto" : "Adicionar foto"}
              </Button>
              {avatarUrl && (
                <Button variant="ghost" size="sm" disabled={enviandoFoto} onClick={removerFoto}>
                  Remover
                </Button>
              )}
            </div>
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              onChange={trocarFoto}
              className="hidden"
            />
          </div>
        </div>

        <form onSubmit={salvarDados} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <p className="text-sm font-semibold text-ink">Dados</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="nome" className="mb-1.5 block text-xs font-medium text-ink-muted">
                Nome
              </label>
              <input
                id="nome"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
                maxLength={MAX_NAME}
                className={campoClasse}
              />
            </div>
            <div>
              <label htmlFor="cargo" className="mb-1.5 block text-xs font-medium text-ink-muted">
                Cargo
              </label>
              <input
                id="cargo"
                value={cargo}
                onChange={(e) => setCargo(e.target.value.slice(0, MAX_CARGO))}
                maxLength={MAX_CARGO}
                placeholder="Ex: Designer, Gestor de tráfego"
                disabled={!cargoDisponivel}
                className={`${campoClasse} disabled:opacity-60`}
              />
            </div>
          </div>
          {!cargoDisponivel && (
            <p className="mt-2 text-xs text-warning">
              O campo Cargo fica disponível depois de rodar a migration 0034_profile_cargo.sql no
              Supabase.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {username ? (
              <p className="text-xs text-ink-muted">
                Seu usuário de login continua <strong className="text-ink">{username}</strong>.
              </p>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={salvando || !mudou}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>

        {erro && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{erro}</p>}
        {sucesso && (
          <p className="rounded-lg bg-success-light px-3 py-2 text-sm text-success">{sucesso}</p>
        )}

        <TrocarSenha />
      </div>
    </div>
  );
}
