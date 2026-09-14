"use client";

import { useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@mantine/core/styles.css";
import { createClient } from "@/lib/supabase/client";
import type { Page } from "@/lib/types";

export default function PageEditor({ page }: { page: Page }) {
  const supabase = createClient();
  const [title, setTitle] = useState(page.title);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
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
      await supabase
        .from("pages")
        .update({
          title: nextTitle.trim() || "Sem título",
          content: editor.document,
          updated_at: new Date().toISOString(),
        })
        .eq("id", page.id);
      setStatus("saved");
    }, 800);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave(e.target.value);
          }}
          placeholder="Título da página"
          className="w-full border-none bg-transparent text-3xl font-bold text-slate-900 focus:outline-none"
        />
        <span className="whitespace-nowrap text-xs text-slate-400">
          {status === "saving" ? "Salvando..." : status === "saved" ? "Salvo" : ""}
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <BlockNoteView editor={editor} onChange={() => scheduleSave(title)} />
      </div>
    </div>
  );
}
