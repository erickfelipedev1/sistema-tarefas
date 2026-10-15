// Texto formatado da descrição da tarefa (migration 0075): negrito, cor, lista,
// alinhamento... guardado como HTML em tasks.description_html, ao lado do texto
// puro em tasks.description (que o resto do sistema, o MCP e a Wiki continuam
// lendo).
//
// O HTML vem do navegador de quem edita, então NUNCA vai direto pra tela:
// "sanitizarHtml" reconstrói o texto só com o que a lista abaixo permite
// (marcas, estilos e links conhecidos) e descarta o resto. Só roda no
// navegador (usa o DOMParser): no servidor devolve vazio.

export const LIMITE_DO_HTML = 40000;

export const FONTES_DO_TEXTO: { nome: string; css: string }[] = [
  { nome: "Arial", css: "Arial, Helvetica, sans-serif" },
  { nome: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { nome: "Trebuchet", css: "'Trebuchet MS', Helvetica, sans-serif" },
  { nome: "Georgia", css: "Georgia, serif" },
  { nome: "Times", css: "'Times New Roman', Times, serif" },
  { nome: "Courier", css: "'Courier New', Courier, monospace" },
];

export const TAMANHOS_DO_TEXTO = [10, 12, 14, 16, 18, 20, 24, 28, 32];

const TAGS_DE_TEXTO = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "SUB", "SUP"]);
const TAGS_DE_BLOCO = new Set(["P", "DIV", "UL", "OL", "LI", "BLOCKQUOTE"]);
// Some com o elemento inteiro (não só a marca): nada disso vira texto.
const DESCARTAR = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "LINK", "META", "TEMPLATE", "NOSCRIPT",
  "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "IMG", "VIDEO", "AUDIO", "CANVAS", "TITLE", "HEAD",
]);

const COR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\))$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_NO_TEXTO = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Texto puro (com quebras de linha) -> HTML pra abrir no editor.
export function textoParaHtml(texto: string): string {
  return texto
    .split("\n")
    .map((linha) => (linha ? `<div>${escaparHtml(linha)}</div>` : "<div><br></div>"))
    .join("");
}

function estiloPermitido(el: HTMLElement): string {
  const s = el.style;
  const saida: string[] = [];

  const cor = s.getPropertyValue("color").trim();
  if (cor && COR.test(cor)) saida.push(`color: ${cor}`);

  const fundo = (s.getPropertyValue("background-color") || s.getPropertyValue("background")).trim();
  if (fundo && COR.test(fundo)) saida.push(`background-color: ${fundo}`);

  const tamanho = s.getPropertyValue("font-size").trim();
  const px = /^(\d{1,2}(?:\.\d+)?)px$/.exec(tamanho);
  if (px && Number(px[1]) >= 8 && Number(px[1]) <= 48) saida.push(`font-size: ${px[1]}px`);

  const familia = s.getPropertyValue("font-family").toLowerCase();
  if (familia) {
    const achada = FONTES_DO_TEXTO.find((f) => familia.includes(f.nome.toLowerCase().split(" ")[0].replace(/'/g, "")));
    if (achada) saida.push(`font-family: ${achada.css}`);
  }

  const peso = s.getPropertyValue("font-weight").trim();
  if (/^(bold|bolder|600|700|800|900)$/.test(peso)) saida.push("font-weight: 700");

  if (s.getPropertyValue("font-style").trim() === "italic") saida.push("font-style: italic");

  const decoracao = `${s.getPropertyValue("text-decoration")} ${s.getPropertyValue("text-decoration-line")}`.toLowerCase();
  const linhas = [decoracao.includes("underline") ? "underline" : "", decoracao.includes("line-through") ? "line-through" : ""]
    .filter(Boolean)
    .join(" ");
  if (linhas) saida.push(`text-decoration: ${linhas}`);

  const alinhamento = s.getPropertyValue("text-align").trim();
  if (/^(left|center|right|justify)$/.test(alinhamento)) saida.push(`text-align: ${alinhamento}`);

  const recuo = /^(\d{1,3})px$/.exec(s.getPropertyValue("margin-left").trim());
  if (recuo && Number(recuo[1]) > 0 && Number(recuo[1]) <= 240) saida.push(`margin-left: ${recuo[1]}px`);

  const vertical = s.getPropertyValue("vertical-align").trim();
  if (vertical === "sub" || vertical === "super") saida.push(`vertical-align: ${vertical}`);

  return saida.join("; ");
}

// <font color/size/face> (o que alguns navegadores geram) vira estilo.
function estiloDoFont(el: HTMLElement): string {
  const saida: string[] = [];
  const cor = el.getAttribute("color")?.trim();
  if (cor && COR.test(cor)) saida.push(`color: ${cor}`);
  const tamanhos = [0, 10, 13, 16, 18, 24, 32, 48];
  const n = Number(el.getAttribute("size"));
  if (n >= 1 && n <= 7) saida.push(`font-size: ${tamanhos[n]}px`);
  return saida.join("; ");
}

function comLinks(texto: string, destino: Node, doc: Document) {
  let ultimo = 0;
  for (const m of texto.matchAll(LINK_NO_TEXTO)) {
    const inicio = m.index ?? 0;
    // Pontuação no fim do endereço não faz parte dele.
    const url = m[0].replace(/[).,;:!?\]}]+$/, "");
    if (inicio > ultimo) destino.appendChild(doc.createTextNode(texto.slice(ultimo, inicio)));
    const a = doc.createElement("a");
    a.setAttribute("href", url.toLowerCase().startsWith("www.") ? `https://${url}` : url);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    a.textContent = url;
    destino.appendChild(a);
    ultimo = inicio + url.length;
  }
  if (ultimo < texto.length) destino.appendChild(doc.createTextNode(texto.slice(ultimo)));
}

function copiar(origem: Node, destino: Node, doc: Document, dentroDeLink: boolean, linkificar: boolean) {
  origem.childNodes.forEach((no) => {
    if (no.nodeType === Node.TEXT_NODE) {
      const texto = no.textContent ?? "";
      if (dentroDeLink || !linkificar) destino.appendChild(doc.createTextNode(texto));
      else comLinks(texto, destino, doc);
      return;
    }
    if (no.nodeType !== Node.ELEMENT_NODE) return;
    const el = no as HTMLElement;
    // Elementos de SVG/MathML (nome em minúsculas, outro "namespace") somem inteiros.
    if (el.namespaceURI !== "http://www.w3.org/1999/xhtml") return;
    const tag = el.tagName.toUpperCase();
    if (DESCARTAR.has(tag)) return;

    if (tag === "BR") {
      destino.appendChild(doc.createElement("br"));
      return;
    }

    if (tag === "A") {
      const href = (el.getAttribute("href") ?? "").trim();
      if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
        const a = doc.createElement("a");
        a.setAttribute("href", href);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        copiar(el, a, doc, true, linkificar);
        destino.appendChild(a);
      } else {
        copiar(el, destino, doc, dentroDeLink, linkificar);
      }
      return;
    }

    if (TAGS_DE_TEXTO.has(tag) || TAGS_DE_BLOCO.has(tag) || tag === "SPAN" || tag === "FONT") {
      const novo = doc.createElement(tag === "FONT" ? "span" : tag === "STRIKE" || tag === "DEL" ? "s" : tag.toLowerCase());
      const estilo = [tag === "FONT" ? estiloDoFont(el) : "", estiloPermitido(el)].filter(Boolean).join("; ");
      if (estilo) novo.setAttribute("style", estilo);
      // Menção "@Nome": a marca guarda o id da pessoa (só no formato de uuid).
      const mencao = tag === "SPAN" ? el.getAttribute("data-mencao") : null;
      if (mencao && UUID.test(mencao)) novo.setAttribute("data-mencao", mencao.toLowerCase());
      copiar(el, novo, doc, dentroDeLink, linkificar);
      destino.appendChild(novo);
      return;
    }

    // Qualquer outra marca (h1, table, section...): fica só o conteúdo.
    copiar(el, destino, doc, dentroDeLink, linkificar);
  });
}

// Reconstrói o HTML só com o que é permitido. Seguro de pôr em
// dangerouslySetInnerHTML. "linkificar" transforma endereços soltos em links:
// vale na leitura; o editor desliga (o link não pode virar parte do texto
// salvo, senão corrigir o endereço digitado deixaria o link velho).
export function sanitizarHtml(html: string, linkificar = true): string {
  if (typeof DOMParser === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const saida = doc.implementation.createHTMLDocument("");
  const raiz = saida.createElement("div");
  copiar(doc.body, raiz, saida, false, linkificar);
  return raiz.innerHTML;
}

// O texto puro de um HTML (pra coluna "description", a Wiki e o MCP): uma
// linha por parágrafo e "•" / "1." nas listas.
export function htmlParaTexto(html: string): string {
  if (typeof DOMParser === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(`<body>${sanitizarHtml(html, false)}</body>`, "text/html");
  const partes: string[] = [];
  const quebra = () => {
    if (partes.length > 0 && !partes[partes.length - 1].endsWith("\n")) partes.push("\n");
  };
  const andar = (no: Node, numero?: { n: number }) => {
    no.childNodes.forEach((filho) => {
      if (filho.nodeType === Node.TEXT_NODE) {
        partes.push(filho.textContent ?? "");
        return;
      }
      if (filho.nodeType !== Node.ELEMENT_NODE) return;
      const el = filho as HTMLElement;
      if (el.tagName === "BR") {
        partes.push("\n");
        return;
      }
      if (el.tagName === "UL" || el.tagName === "OL") {
        quebra();
        andar(el, el.tagName === "OL" ? { n: 0 } : undefined);
        quebra();
        return;
      }
      if (el.tagName === "LI") {
        quebra();
        if (numero) {
          numero.n += 1;
          partes.push(`${numero.n}. `);
        } else {
          partes.push("• ");
        }
        andar(el);
        quebra();
        return;
      }
      if (TAGS_DE_BLOCO.has(el.tagName)) {
        quebra();
        andar(el);
        quebra();
        return;
      }
      andar(el);
    });
  };
  andar(doc.body);
  return partes.join("").replace(/\n{3,}/g, "\n\n").trim();
}

// Os ids das pessoas mencionadas (@nome) num HTML da descrição, sem repetir.
export function idsDeMencoes(html: string): string[] {
  if (typeof DOMParser === "undefined" || !html) return [];
  const doc = new DOMParser().parseFromString(`<body>${sanitizarHtml(html, false)}</body>`, "text/html");
  const ids = new Set<string>();
  doc.querySelectorAll("[data-mencao]").forEach((el) => {
    const id = el.getAttribute("data-mencao");
    if (id && UUID.test(id)) ids.add(id.toLowerCase());
  });
  return Array.from(ids).slice(0, 20);
}
