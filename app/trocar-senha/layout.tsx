import { redirect } from "next/navigation";
import { perfilAtual, usuarioAtual } from "@/lib/sessao";

// Esta tela é só pro primeiro acesso com a senha padrão
// (profiles.precisa_trocar_senha). Quem já criou a própria senha e digita
// /trocar-senha na barra de endereço volta pro sistema.
export default async function TrocarSenhaLayout({ children }: { children: React.ReactNode }) {
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const perfil = await perfilAtual();
  if (perfil?.precisa_trocar_senha !== true) redirect("/painel");

  return <>{children}</>;
}
