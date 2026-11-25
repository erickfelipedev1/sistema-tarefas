"use client";

import { useState } from "react";
import { useBlockNoteEditor, useComponentsContext, useEditorState } from "@blocknote/react";
import GradeDeCores from "@/components/GradeDeCores";
import { corParaMostrar } from "@/lib/wiki-esquema";
import { ehCodigoDeCor } from "@/lib/paleta-de-cores";

// Botão "Cores" do menu de formatação da Wiki, no lugar do do BlockNote (que
// só tem 9 cores): a paleta grande pra cor da letra e pro marca-texto, com
// código digitável e "Sem cor". Mesmo menu (Components.Generic.Menu) que o
// botão original usa, pra o editor não perder a seleção.
export default function BotaoDeCoresDoEditor() {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  const [aba, setAba] = useState<"letra" | "marca">("letra");

  const estado = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor.isEditable) return undefined;
      const blocos = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
      if (!blocos.some((b) => b.content !== undefined)) return undefined;
      const estilos = editor.getActiveStyles();
      return { letra: estilos.textColor as string | undefined, marca: estilos.backgroundColor as string | undefined };
    },
  });

  if (!estado) return null;

  const tipo = aba === "letra" ? "textColor" : "backgroundColor";
  const valorAtual = aba === "letra" ? estado.letra : estado.marca;

  function aplicar(cor: string | null) {
    if (cor) editor.addStyles({ [tipo]: cor });
    else editor.removeStyles({ [tipo]: "" });
    // Mesmo truque do botão original (foco do menu do Mantine).
    setTimeout(() => editor.focus());
  }

  const amostraLetra = corParaMostrar(estado.letra, "texto");
  const amostraMarca = corParaMostrar(estado.marca, "fundo");

  return (
    <Components.Generic.Menu.Root>
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          className="bn-button"
          label="Cores"
          mainTooltip="Cor da letra e marca-texto"
          icon={
            <span
              className="grid h-5 w-5 place-items-center rounded text-[13px] font-bold leading-none"
              style={{ color: amostraLetra, backgroundColor: amostraMarca }}
            >
              <span className="border-b-2" style={{ borderColor: amostraLetra ?? "currentColor" }}>
                A
              </span>
            </span>
          }
        />
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-color-picker-dropdown">
        <div className="w-[18.5rem] p-2" onKeyDown={(e) => e.stopPropagation()}>
          <div className="mb-2 flex gap-1 text-xs font-medium">
            {(
              [
                ["letra", "Cor da letra"],
                ["marca", "Marca-texto"],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAba(valor)}
                className={`flex-1 rounded-md px-2 py-1 ${aba === valor ? "font-semibold" : "opacity-60 hover:opacity-100"}`}
                style={aba === valor ? { boxShadow: "inset 0 0 0 1px rgba(128,128,128,.5)" } : undefined}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <GradeDeCores
            key={aba}
            valor={ehCodigoDeCor(valorAtual) ? valorAtual : null}
            aoEscolher={(hex) => aplicar(hex)}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aplicar(null)}
            className="mt-2 w-full rounded-md px-2 py-1 text-xs font-medium opacity-80 hover:opacity-100"
            style={{ boxShadow: "inset 0 0 0 1px rgba(128,128,128,.45)" }}
          >
            {aba === "letra" ? "Tirar a cor da letra" : "Tirar o marca-texto"}
          </button>
        </div>
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}
