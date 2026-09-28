"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trash2Icon } from "./ui/icons";

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
      aria-label="Excluir página"
      className="rounded-md p-1 text-ink-muted transition-colors hover:bg-danger-light hover:text-danger disabled:opacity-50"
    >
      {deleting ? (
        <span className="text-xs">…</span>
      ) : (
        <Trash2Icon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
