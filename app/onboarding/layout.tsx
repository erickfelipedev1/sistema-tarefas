import { redirect } from "next/navigation";
import { perfilAtual, usuarioAtual } from "@/lib/sessao";

// O onboarding é só pra quem ainda não tem nome no perfil. Quem já fez e
// digita /onboarding na barra de endereço volta pro sistema, em vez de ver o
// formulário de novo (e poder trocar o próprio nome por engano).
// Roda uma vez, na entrada: o passo "Tudo pronto!" depois de salvar o nome é
// estado da própria página, então não cai aqui.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const perfil = await perfilAtual();
  if (perfil?.name) redirect("/board");

  return <>{children}</>;
}
