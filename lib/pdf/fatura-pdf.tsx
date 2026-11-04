// PDF da fatura (aba Faturamento, migration 0098). Cada empresa tem a sua
// identidade visual (lib/pdf/temas.ts); quem não tem usa a da now d.gital:
// faixa verde-escuro com o logo em lima, Urbanist nos títulos e Manrope no
// corpo. Só roda no servidor (rotas /api/faturas/[id]/pdf e do portal).
import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, Path, renderToBuffer, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { formatarDataBR } from "@/lib/format";
import {
  calcularFatura,
  TIPOS_DE_PIX,
  type DadosDoCliente,
  type Emissor,
  type FaturaAvancada,
  type ParcelaDaFatura,
} from "@/lib/faturamento-avancado";
import { LOGO_NOW_CAMINHOS, LOGO_NOW_VIEWBOX } from "./logo-now";
import { temaDaEmpresa, type TemaDaFatura } from "./temas";

const TEXTO = "#1B1F14";
const MUDO = "#6B7260";

const pasta = path.join(process.cwd(), "lib", "pdf", "fonts");
const pastaLogos = path.join(process.cwd(), "lib", "pdf", "logos");
let fontesRegistradas = false;
function registrarFontes() {
  if (fontesRegistradas) return;
  Font.register({
    family: "Urbanist",
    fonts: [
      { src: path.join(pasta, "urbanist-latin-700-normal.woff"), fontWeight: 700 },
      { src: path.join(pasta, "urbanist-latin-800-normal.woff"), fontWeight: 800 },
    ],
  });
  Font.register({
    family: "Manrope",
    fonts: [
      { src: path.join(pasta, "manrope-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(pasta, "manrope-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(pasta, "manrope-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Montserrat",
    fonts: [
      { src: path.join(pasta, "montserrat-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(pasta, "montserrat-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(pasta, "montserrat-latin-700-normal.woff"), fontWeight: 700 },
      { src: path.join(pasta, "montserrat-latin-800-normal.woff"), fontWeight: 800 },
    ],
  });
  Font.register({
    family: "Poppins",
    fonts: [
      { src: path.join(pasta, "poppins-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(pasta, "poppins-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(pasta, "poppins-latin-700-normal.woff"), fontWeight: 700 },
      { src: path.join(pasta, "poppins-latin-800-normal.woff"), fontWeight: 800 },
    ],
  });
  // Sem hifenização automática: nomes e valores não podem quebrar no meio.
  Font.registerHyphenationCallback((palavra) => [palavra]);
  fontesRegistradas = true;
}

// As fontes não têm o espaço "sem quebra" que o toLocaleString põe entre "R$"
// e o valor.
function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
}

function numero(valor: number) {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function criarEstilos(t: TemaDaFatura) {
  return StyleSheet.create({
    pagina: { fontFamily: t.fonteCorpo, fontSize: 9, color: TEXTO, paddingBottom: 56 },
    faixa: {
      backgroundColor: t.faixa,
      paddingHorizontal: 40,
      paddingTop: 30,
      paddingBottom: 26,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    marcaTexto: { fontFamily: t.fonteTitulo, fontWeight: 800, fontSize: 24, color: t.sobreFaixa, letterSpacing: 2 },
    faixaDireita: { alignItems: "flex-end" },
    tituloFatura: { fontFamily: t.fonteTitulo, fontWeight: 800, fontSize: 24, color: t.sobreFaixa, letterSpacing: 2 },
    numeroFatura: { fontFamily: t.fonteTitulo, fontWeight: 700, fontSize: 11, color: t.detalheFaixa, marginTop: 3 },
    corpo: { paddingHorizontal: 40, paddingTop: 22 },
    datas: { flexDirection: "row", gap: 24, marginBottom: 18 },
    rotulo: { fontFamily: t.fonteTitulo, fontWeight: 700, fontSize: 7.5, color: t.destaque, letterSpacing: 1.2, textTransform: "uppercase" },
    valorData: { fontFamily: t.fonteTitulo, fontWeight: 700, fontSize: 12, marginTop: 2 },
    partes: { flexDirection: "row", gap: 24, marginBottom: 18 },
    parte: { flex: 1, borderTopWidth: 2, borderTopColor: t.destaque, paddingTop: 7 },
    nomeParte: { fontFamily: t.fonteTitulo, fontWeight: 700, fontSize: 11, marginTop: 3, marginBottom: 3 },
    linhaParte: { color: MUDO, lineHeight: 1.45 },
    descricao: { fontFamily: t.fonteTitulo, fontWeight: 700, fontSize: 13, marginBottom: 10 },
    cabecalhoTabela: {
      flexDirection: "row",
      backgroundColor: t.tabela,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
    },
    cabecalhoTexto: { fontFamily: t.fonteTitulo, fontWeight: 700, fontSize: 7.5, color: t.detalheFaixa, letterSpacing: 1, textTransform: "uppercase" },
    linhaTabela: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: t.linha },
    colDescricao: { flex: 1, paddingRight: 8 },
    colQtd: { width: 44, textAlign: "right" },
    colUnit: { width: 78, textAlign: "right" },
    colTotal: { width: 84, textAlign: "right" },
    nomeItem: { fontWeight: 600 },
    detalheItem: { color: MUDO, marginTop: 2, lineHeight: 1.4 },
    totais: { marginTop: 12, alignSelf: "flex-end", width: 230 },
    linhaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
    caixaTotal: {
      marginTop: 6,
      backgroundColor: t.tabela,
      borderRadius: 4,
      paddingVertical: 9,
      paddingHorizontal: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    textoCaixaTotal: { fontFamily: t.fonteTitulo, fontWeight: 700, fontSize: 9, color: t.detalheFaixa, letterSpacing: 1, textTransform: "uppercase" },
    valorCaixaTotal: { fontFamily: t.fonteTitulo, fontWeight: 800, fontSize: 16, color: "#FFFFFF" },
    secao: { marginTop: 20 },
    tituloSecao: { fontFamily: t.fonteTitulo, fontWeight: 700, fontSize: 7.5, color: t.destaque, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
    linhaParcela: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: t.linha },
    caixaPagamento: { backgroundColor: t.suave, borderRadius: 4, padding: 10, borderLeftWidth: 3, borderLeftColor: t.destaque },
    chavePix: { fontFamily: t.fonteTitulo, fontWeight: 700, fontSize: 12, marginTop: 2 },
    observacoes: { color: MUDO, lineHeight: 1.5 },
    rodape: {
      position: "absolute",
      left: 40,
      right: 40,
      bottom: 22,
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 0.5,
      borderTopColor: t.linha,
      paddingTop: 7,
      color: MUDO,
      fontSize: 7.5,
    },
  });
}

export interface DadosDoPdf {
  fatura: FaturaAvancada;
  parcelas: ParcelaDaFatura[];
  emissor: Emissor | null;
  cliente: DadosDoCliente | null;
  // Nome do cliente no sistema: escolhe o tema e serve de nome quando a razão
  // social não foi preenchida.
  nomeDoCliente: string;
}

function LogoNow({ largura, cor }: { largura: number; cor: string }) {
  const [, , w, h] = LOGO_NOW_VIEWBOX.split(" ").map(Number);
  return (
    <Svg viewBox={LOGO_NOW_VIEWBOX} style={{ width: largura, height: (largura * h) / w }}>
      {LOGO_NOW_CAMINHOS.map((d, i) => (
        <Path key={i} d={d} fill={cor} />
      ))}
    </Svg>
  );
}

function Marca({ tema, estilos }: { tema: TemaDaFatura; estilos: ReturnType<typeof criarEstilos> }) {
  if (tema.logo) {
    // Passa os bytes: o react-pdf trata caminho do Windows ("C:\...") como URL.
    const arquivo = path.join(pastaLogos, tema.logo.arquivo);
    const formato = /\.jpe?g$/i.test(arquivo) ? "jpg" : "png";
    const imagem = (
      <Image
        src={{ data: readFileSync(arquivo), format: formato }}
        style={{ width: tema.logo.largura, height: tema.logo.largura / tema.logo.proporcao }}
      />
    );
    if (tema.logoComBorda) {
      return (
        <View style={{ borderWidth: 0.8, borderColor: tema.sobreFaixa, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 12 }}>
          {imagem}
        </View>
      );
    }
    if (!tema.mostrarNome) return imagem;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {imagem}
        <Text style={estilos.marcaTexto}>{tema.marca}</Text>
      </View>
    );
  }
  if (tema.chave === "now") return <LogoNow largura={150} cor={tema.sobreFaixa} />;
  return <Text style={estilos.marcaTexto}>{tema.marca}</Text>;
}

function Parte({
  s,
  titulo,
  nome,
  linhas,
}: {
  s: ReturnType<typeof criarEstilos>;
  titulo: string;
  nome: string;
  linhas: (string | null | undefined)[];
}) {
  return (
    <View style={s.parte}>
      <Text style={s.rotulo}>{titulo}</Text>
      <Text style={s.nomeParte}>{nome}</Text>
      {linhas.filter(Boolean).map((l, i) => (
        <Text key={i} style={s.linhaParte}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function FaturaPdf({ dados }: { dados: DadosDoPdf }) {
  const { fatura: f, parcelas, emissor, cliente } = dados;
  const tema = temaDaEmpresa(dados.nomeDoCliente);
  const s = criarEstilos(tema);
  const itens = f.items ?? [];
  const totais = calcularFatura(itens, f.discount, f.tax_percent, f.tax_added);
  const emitida = f.created_at.slice(0, 10);
  const tipoPix = TIPOS_DE_PIX.find((p) => p.valor === emissor?.pix_type)?.rotulo;
  const rotuloImposto = `${f.tax_label || "Imposto"} (${numero(f.tax_percent)}%)${f.tax_added ? "" : " · incluso"}`;
  const temPagamento = !!(emissor?.pix_key || emissor?.bank_info);
  const nomeEmissor = emissor?.legal_name || "now d.gital";

  return (
    <Document title={`Fatura ${f.number ?? ""}`.trim()} author={nomeEmissor} creator="d.hub">
      <Page size="A4" style={s.pagina}>
        <View style={s.faixa}>
          <Marca tema={tema} estilos={s} />
          <View style={s.faixaDireita}>
            <Text style={s.tituloFatura}>FATURA</Text>
            {f.number && <Text style={s.numeroFatura}>Número {f.number}</Text>}
          </View>
        </View>

        <View style={s.corpo}>
          <View style={s.datas}>
            <View>
              <Text style={s.rotulo}>Emissão</Text>
              <Text style={s.valorData}>{formatarDataBR(emitida)}</Text>
            </View>
            <View>
              <Text style={s.rotulo}>Total</Text>
              <Text style={s.valorData}>{moeda(f.amount)}</Text>
            </View>
          </View>

          <View style={s.partes}>
            <Parte
              s={s}
              titulo="Emitente"
              nome={nomeEmissor}
              linhas={[
                emissor?.document && `CNPJ ${emissor.document}`,
                emissor?.address,
                emissor?.email,
                emissor?.phone,
              ]}
            />
            <Parte
              s={s}
              titulo="Cliente"
              nome={cliente?.legal_name || dados.nomeDoCliente}
              linhas={[
                cliente?.document && `CNPJ/CPF ${cliente.document}`,
                cliente?.address,
                cliente?.contact_name && `A/C ${cliente.contact_name}`,
                cliente?.billing_email,
              ]}
            />
          </View>

          <Text style={s.descricao}>{f.description}</Text>

          <View style={s.cabecalhoTabela}>
            <Text style={[s.cabecalhoTexto, s.colDescricao]}>Descrição</Text>
            <Text style={[s.cabecalhoTexto, s.colQtd]}>Qtd</Text>
            <Text style={[s.cabecalhoTexto, s.colUnit]}>Valor unit.</Text>
            <Text style={[s.cabecalhoTexto, s.colTotal]}>Total</Text>
          </View>
          {itens.map((item, i) => (
            <View key={i} style={[s.linhaTabela, i % 2 === 1 ? { backgroundColor: tema.suave } : {}]} wrap={false}>
              <View style={s.colDescricao}>
                <Text style={s.nomeItem}>{item.name}</Text>
                {item.detail && <Text style={s.detalheItem}>{item.detail}</Text>}
              </View>
              <Text style={s.colQtd}>{numero(item.quantity)}</Text>
              <Text style={s.colUnit}>{item.unit_price > 0 ? moeda(item.unit_price) : "—"}</Text>
              <Text style={[s.colTotal, { fontWeight: 700 }]}>{item.unit_price > 0 ? moeda(item.quantity * item.unit_price) : "incluso"}</Text>
            </View>
          ))}

          <View style={s.totais} wrap={false}>
            <View style={s.linhaTotal}>
              <Text style={{ color: MUDO }}>Subtotal</Text>
              <Text>{moeda(totais.subtotal)}</Text>
            </View>
            {totais.desconto > 0 && (
              <View style={s.linhaTotal}>
                <Text style={{ color: MUDO }}>Desconto</Text>
                <Text>− {moeda(totais.desconto)}</Text>
              </View>
            )}
            {f.tax_percent > 0 && (
              <View style={s.linhaTotal}>
                <Text style={{ color: MUDO }}>{rotuloImposto}</Text>
                <Text>
                  {f.tax_added ? "+ " : ""}
                  {moeda(totais.imposto)}
                </Text>
              </View>
            )}
            <View style={s.caixaTotal}>
              <Text style={s.textoCaixaTotal}>Total a pagar</Text>
              <Text style={s.valorCaixaTotal}>{moeda(f.amount)}</Text>
            </View>
          </View>

          {/* Sem datas de vencimento na fatura: as parcelas só aparecem quando há mais de uma ou já houve pagamento. */}
          {(parcelas.length > 1 || parcelas.some((p) => p.status === "paid")) && (
            <View style={s.secao} wrap={false}>
              <Text style={s.tituloSecao}>{parcelas.length > 1 ? "Parcelas" : "Pagamento"}</Text>
              {parcelas.map((p) => {
                const status = p.status === "paid" ? "Paga" : "A pagar";
                const corStatus = p.status === "paid" ? "#3F7D1E" : MUDO;
                return (
                  <View key={p.position} style={s.linhaParcela}>
                    <Text style={{ width: 60, color: MUDO }}>
                      {p.position}/{parcelas.length}
                    </Text>
                    <Text style={{ flex: 1 }}>
                      {p.status === "paid" && p.paid_at ? `Paga em ${formatarDataBR(p.paid_at)}` : `Parcela ${p.position}`}
                    </Text>
                    <Text style={{ width: 80, textAlign: "right", fontWeight: 700 }}>{moeda(p.amount)}</Text>
                    <Text style={{ width: 62, textAlign: "right", fontWeight: 700, color: corStatus }}>{status}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {temPagamento && (
            <View style={s.secao} wrap={false}>
              <Text style={s.tituloSecao}>Como pagar</Text>
              <View style={s.caixaPagamento}>
                {emissor?.pix_key && (
                  <View>
                    <Text style={s.rotulo}>Pix{tipoPix ? ` · ${tipoPix}` : ""}</Text>
                    <Text style={s.chavePix}>{emissor.pix_key}</Text>
                  </View>
                )}
                {emissor?.bank_info && (
                  <Text style={[s.linhaParte, { marginTop: emissor.pix_key ? 8 : 0 }]}>{emissor.bank_info}</Text>
                )}
              </View>
            </View>
          )}

          {f.notes && (
            <View style={s.secao}>
              <Text style={s.tituloSecao}>Observações</Text>
              <Text style={s.observacoes}>{f.notes}</Text>
            </View>
          )}
        </View>

        <View style={s.rodape} fixed>
          <Text>
            {nomeEmissor}
            {emissor?.email ? ` · ${emissor.email}` : ""}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function gerarPdfDaFatura(dados: DadosDoPdf): Promise<Buffer> {
  registrarFontes();
  return renderToBuffer(<FaturaPdf dados={dados} />);
}
