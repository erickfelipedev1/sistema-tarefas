import { redirect } from "next/navigation";
import { lerSessaoCliente } from "@/lib/client-auth";
import ClientLoginForm from "./ClientLoginForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Solicitações · Now Organiza" };

// Login do cliente. O link que a equipe manda já vem com o usuário
// preenchido (?u=usuario) — o cliente só digita a senha.
export default async function ClienteLoginPage({
  searchParams,
}: {
  searchParams: { u?: string };
}) {
  if (await lerSessaoCliente()) redirect("/cliente");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold text-ink">Solicitações</h1>
        <p className="mb-6 mt-1 text-sm text-ink-muted">
          Entre com o usuário e a senha que a equipe te enviou.
        </p>
        <ClientLoginForm usuarioInicial={searchParams.u ?? ""} />
      </div>
    </main>
  );
}
