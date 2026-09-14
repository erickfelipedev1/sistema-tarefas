"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

export default function ClientsList({
  initialClients,
}: {
  initialClients: Client[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("clients-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        (payload) => {
          setClients((current) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as Client;
              if (current.some((c) => c.id === novo.id)) return current;
              return [novo, ...current];
            }
            if (payload.eventType === "DELETE") {
              const removidoId = (payload.old as Client).id;
              return current.filter((c) => c.id !== removidoId);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewClient() {
    const nome = window.prompt("Nome do novo cliente:");
    if (!nome || !nome.trim()) return;

    setCreating(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({ name: nome.trim() })
      .select()
      .single();
    setCreating(false);

    if (!error && data) {
      setClients((current) =>
        current.some((c) => c.id === data.id) ? current : [data, ...current]
      );
      router.push(`/arquivos/cliente/${data.id}`);
    } else {
      window.alert(
        "Não deu pra criar o cliente. Confere se a migration 0014_drive.sql já foi rodada no Supabase."
      );
    }
  }

  async function handleDelete(client: Client) {
    const confirmado = window.confirm(
      `Excluir o cliente "${client.name}"? Os arquivos dele voltam para o Drive "Geral" — nada é apagado.`
    );
    if (!confirmado) return;

    setClients((current) => current.filter((c) => c.id !== client.id));
    await supabase.from("clients").delete().eq("id", client.id);
  }

  return (
    <div>
      <button
        onClick={handleNewClient}
        disabled={creating}
        className="mb-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {creating ? "Criando..." : "+ Novo cliente"}
      </button>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {clients.map((client) => (
          <div
            key={client.id}
            className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
          >
            <Link href={`/arquivos/cliente/${client.id}`} className="block">
              <p className="pr-6 text-sm font-semibold text-slate-800">
                {client.name}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                📁 Pasta de arquivos própria
              </p>
            </Link>
            <button
              onClick={() => handleDelete(client)}
              title="Excluir cliente"
              className="absolute right-3 top-3 text-xs text-slate-300 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {clients.length === 0 && (
          <p className="text-sm text-slate-400">
            Nenhum cliente ainda. Crie o primeiro.
          </p>
        )}
      </div>
    </div>
  );
}
