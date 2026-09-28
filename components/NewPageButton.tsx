"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/Button";
import { PlusIcon } from "./ui/icons";

export default function NewPageButton({
  projectId = null,
  label = "Nova página",
}: {
  projectId?: string | null;
  // Permite reaproveitar o mesmo botão/lógica com um texto diferente — por
  // exemplo "Criar primeira página" no estado vazio da Wiki.
  label?: string;
} = {}) {
  const router = useRouter();
  const supabase = createClient();
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const label =
      (user?.user_metadata?.username as string | undefined) ??
      user?.email ??
      null;

    const { data, error } = await supabase
      .from("pages")
      .insert({
        title: "Sem título",
        content: [],
        project_id: projectId,
        created_by_label: label,
      })
      .select()
      .single();

    setCreating(false);
    if (!error && data) {
      router.push(`/wiki/${data.id}`);
    }
  }

  return (
    <Button onClick={handleCreate} disabled={creating}>
      <PlusIcon className="h-4 w-4" />
      {creating ? "Criando..." : label}
    </Button>
  );
}
