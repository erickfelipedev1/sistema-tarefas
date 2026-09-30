import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Protege as rotas: quem não está logado é mandado para /login. Quem
 * ainda não preencheu o próprio nome é mandado para /onboarding.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname.startsWith("/login");
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  // Página pública de progresso do projeto (link que o cliente recebe) —
  // não passa por login, o acesso é controlado pelo token na própria URL.
  // Área do cliente (/cliente) tem login próprio (lib/client-auth.ts), sem
  // sessão do Supabase — também não passa pelo login da equipe.
  const isPublicRoute =
    pathname.startsWith("/progresso") ||
    pathname === "/cliente" ||
    pathname.startsWith("/cliente/");
  // Rotas de API (ex: /api/mcp) cuidam da própria autenticação (Bearer
  // token pessoal, no caso do MCP) — não fazem parte do fluxo de login por
  // cookie, então não podem ser redirecionadas pra /login aqui.
  const isApiRoute = pathname.startsWith("/api/");
  // Endpoints OAuth chamados de servidor pra servidor pelo app de IA
  // (ChatGPT) — sem cookie. /oauth/authorize NÃO entra aqui: precisa do
  // login da equipe.
  const isOAuthMachineRoute =
    pathname.startsWith("/.well-known/") ||
    pathname === "/oauth/token" ||
    pathname === "/oauth/register";
  if (isOAuthMachineRoute) return response;

  // Arquivos do PWA (manifesto, service worker, tela offline) abrem sem login.
  if (
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/offline.html"
  ) {
    return response;
  }

  if (!user && !isLoginRoute && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Volta pra onde a pessoa estava depois de entrar (ex: a tela de
    // autorizar o ChatGPT).
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (user && isLoginRoute) {
    const next = request.nextUrl.searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = "/board";
    return NextResponse.redirect(url);
  }

  if (user && !isOnboardingRoute && !isLoginRoute && !isPublicRoute && !isApiRoute) {
    // "*" em vez de listar colunas: precisa_trocar_senha só existe depois da
    // migration 0037, e sem ela esta consulta não pode falhar (senão todo
    // mundo cairia no onboarding).
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.name) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Senha padrão: só libera o sistema depois de criar uma senha nova.
    const isTrocarSenhaRoute = pathname.startsWith("/trocar-senha");
    if (profile.precisa_trocar_senha === true && !isTrocarSenhaRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/trocar-senha";
      url.search = "";
      url.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
