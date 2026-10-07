"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Quem faz parte do time (tabela team_members, migration 0044). Aparece pro
// próprio líder e pra quem tem "ve_tudo"; marcar ou desmarcar grava na hora e
// recalcula o relatório. Não sai na impressão.
export default function EditarTime({
  lider,
  liderNome,
  pessoas,
  membrosIniciais,
}: {
  lider: string;
  liderNome: string;
  pessoas: { id: string; nome: string }[];
  membrosIniciais: string[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [membros, setMembros] = useState(() => new Set(membrosIniciais));
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar(id: string) {
    const entrar = !membros.has(id);
    setOcupado(id);
    setErro(null);
    // upsert: se outra aba já tinha colocado a pessoa no time, não é erro.
    const { error } = entrar
      ? await supabase
          .from("team_members")
          .upsert({ leader_id: lider, member_id: id }, { onConflict: "leader_id,member_id", ignoreDuplicates: true })
      : await supabase.from("team_members").delete().eq("leader_id", lider).eq("member_id", id);
    setOcupado(null);
    if (error) {
      setErro("Não foi possível alterar o time. Tenta de novo.");
      router.refresh();
      return;
    }
    setMembros((atual) => {
      const novo = new Set(atual);
      if (entrar) novo.add(id);
      else novo.delete(id);
      return novo;
    });
    router.refresh();
  }

  return (
    <details className="nao-imprime mt-3 rounded-2xl border border-line bg-surface p-5">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Time de {liderNome}{" "}
        <span className="font-normal text-ink-muted">
          ({membros.size} {membros.size === 1 ? "pessoa" : "pessoas"})
        </span>
      </summary>
      <p className="mt-2 text-xs text-ink-muted">
        Marque quem responde a {liderNome}. As entregas dessas pessoas entram neste relatório.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {pessoas.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface-hover"
          >
            <input
              type="checkbox"
              checked={membros.has(p.id)}
              disabled={ocupado !== null}
              onChange={() => alternar(p.id)}
              className="h-4 w-4 accent-[rgb(var(--color-brand))]"
            />
            <span className="truncate">{p.nome}</span>
          </label>
        ))}
      </div>
      {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}
    </details>
  );
}
