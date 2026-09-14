"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeletePageButton({ pageId }: { pageId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmado = window.confirm(
      "Excluir esta página? Essa ação não pode ser desfeita."
    );
    if (!confirmado) return;

    setDeleting(true);
    await supabase.from("pages").delete().eq("id", pageId);
    setDeleting(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Excluir página"
      className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-50"
    >
      {deleting ? "…" : "🗑️"}
    </button>
  );
}
