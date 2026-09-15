"use client";

import { useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@mantine/core/styles.css";
import { createClient } from "@/lib/supabase/client";
import { formatarRelativo } from "@/lib/format";
import type { Page } from "@/lib/types";

export default function PageEditor({ page }: { page: Page }) {
  const supabase = createClient();
  const [title, setTitle] = useState(page.title);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [updatedAt, setUpdatedAt] = useState(page.updated_at);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialContent =
    Array.isArray(page.content) && (page.content as unknown[]).length > 0
      ? (page.content as never)
      : undefined;

  const editor = useCreateBlockNote({
    initialContent,
  });

  function scheduleSave(nextTitle: string) {
    setStatus("saving");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const agora = new Date().toISOString();
      await supabase
        .from("pages")
        .update({
          title: nextTitle.trim() || "Sem título",
          content: editor.document,
          updated_at: agora,
        })
        .eq("id", page.id);
      setUpdatedAt(agora);
      setStatus("saved");
    }, 800);
  }

  return (
    <div>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave(e.target.value);
        }}
        placeholder="Título da página"
        className="w-full border-none bg-transparent text-3xl font-semibold tracking-tight text-ink placeholder:text-slate-300 focus:outline-none sm:text-4xl"
      />

      <div className="mb-6 mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        {page.created_by_label && <span>por {page.created_by_label}</span>}
        {page.created_by_label && <span className="text-slate-300">·</span>}
        <span>Atualizado {formatarRelativo(updatedAt)}</span>
        {status !== "idle" && (
          <>
            <span className="text-slate-300">·</span>
            <span
              className={
                status === "saving" ? "text-warning" : "text-success"
              }
            >
              {status === "saving" ? "Salvando..." : "Salvo"}
            </span>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white px-2 py-4 sm:px-6">
        <BlockNoteView editor={editor} onChange={() => scheduleSave(title)} />
      </div>
    </div>
  );
}
