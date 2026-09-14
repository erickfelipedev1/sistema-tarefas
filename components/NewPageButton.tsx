"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewPageButton() {
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
    <button
      onClick={handleCreate}
      disabled={creating}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
    >
      {creating ? "Criando..." : "+ Nova página"}
    </button>
  );
}
