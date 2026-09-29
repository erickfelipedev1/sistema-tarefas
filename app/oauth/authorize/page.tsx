import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerCliente } from "@/lib/oauth";
import AuthorizeButtons from "./AuthorizeButtons";

export const dynamic = "force-dynamic";

export const metadata = { title: "Autorizar acesso · NowHub" };

type Params = Record<string, string | undefined>;

// Tela de consentimento do OAuth: o ChatGPT (ou outro app de IA) manda a
// pessoa pra cá, ela confirma, e volta pro app com um código.
export default async function AuthorizePage({ searchParams }: { searchParams: Params }) {
  const cliente = lerCliente(searchParams.client_id);
  const redirectUri = searchParams.redirect_uri ?? "";
  const valido =
    !!cliente &&
    cliente.redirects.includes(redirectUri) &&
    searchParams.response_type === "code" &&
    !!searchParams.code_challenge &&
    (searchParams.code_challenge_method ?? "S256") === "S256";

  if (!valido) {
    return (
      <Cartao>
        <p className="text-lg font-semibold text-slate-900">Pedido inválido</p>
        <p className="mt-2 text-sm text-slate-500">
          O link de conexão está incompleto ou expirou. Tente conectar de novo pelo app de IA.
        </p>
      </Cartao>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const volta = `/oauth/authorize?${new URLSearchParams(searchParams as Record<string, string>)}`;
    redirect(`/login?next=${encodeURIComponent(volta)}`);
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("name, username")
    .eq("id", user.id)
    .maybeSingle();
  const quem = perfil?.name || perfil?.username || "você";

  return (
    <Cartao>
      <h1 className="text-xl font-semibold text-slate-900">Conectar {cliente.nome}</h1>
      <p className="mt-2 text-sm text-slate-600">
        <strong>{cliente.nome}</strong> quer acessar o NowHub em nome de{" "}
        <strong>{quem}</strong>. Ele vai poder ver seus clientes e tarefas, criar e editar
        tarefas e comentar — tudo registrado no seu nome.
      </p>
      <p className="mt-3 text-xs text-slate-500">
        Dá pra desconectar quando quiser em Integração com IA, revogando o token.
      </p>
      <AuthorizeButtons
        pedido={{
          clientId: searchParams.client_id!,
          redirectUri,
          state: searchParams.state ?? "",
          codeChallenge: searchParams.code_challenge!,
          scope: searchParams.scope ?? "",
        }}
      />
    </Cartao>
  );
}

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
