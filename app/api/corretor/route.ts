import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Corretor da descrição e da copy (botão "Revisar" do editor): manda o texto
// pro LanguageTool (serviço gratuito de ortografia e gramática, em
// português) e devolve os apontamentos. Passa pelo servidor pra só quem está
// logado usar e o navegador não falar direto com o serviço.
export const dynamic = "force-dynamic";

const LIMITE = 20000; // o serviço gratuito aceita até 20 mil caracteres

interface RespostaDoLanguageTool {
  matches?: {
    offset: number;
    length: number;
    message: string;
    shortMessage?: string;
    replacements?: { value: string }[];
    rule?: { issueType?: string };
  }[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Entre no d.hub pra usar o corretor." }, { status: 401 });

  let texto = "";
  try {
    const corpo = (await request.json()) as { texto?: unknown };
    texto = typeof corpo.texto === "string" ? corpo.texto : "";
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (!texto.trim()) return NextResponse.json({ itens: [] });
  if (texto.length > LIMITE) {
    return NextResponse.json({ erro: "Texto grande demais pra revisar de uma vez (até 20 mil caracteres)." }, { status: 400 });
  }

  const form = new URLSearchParams({ text: texto, language: "pt-BR" });
  let resposta: Response;
  try {
    resposta = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: form.toString(),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ erro: "O corretor não respondeu. Tente de novo em instantes." }, { status: 502 });
  }
  if (resposta.status === 429) {
    return NextResponse.json({ erro: "Muitas revisões seguidas. Espere um minuto e tente de novo." }, { status: 429 });
  }
  if (!resposta.ok) {
    return NextResponse.json({ erro: "O corretor não respondeu. Tente de novo em instantes." }, { status: 502 });
  }
  const dados = (await resposta.json()) as RespostaDoLanguageTool;
  const itens = (dados.matches ?? []).slice(0, 100).map((m) => ({
    offset: m.offset,
    length: m.length,
    trecho: texto.slice(m.offset, m.offset + m.length),
    mensagem: m.shortMessage || m.message,
    sugestoes: (m.replacements ?? []).slice(0, 4).map((r) => r.value),
  }));
  return NextResponse.json({ itens });
}
