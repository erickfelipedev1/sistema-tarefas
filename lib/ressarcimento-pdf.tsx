// PDF do fechamento de ressarcimentos (bloco Financeiro). Documento puro do
// @react-pdf: é gerado no navegador (lib/comprovantes-para-pdf.ts prepara as
// imagens), então não registra fontes de disco: usa a Helvetica padrão.
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatarDataBR } from "@/lib/format";
import {
  EMPRESAS,
  MOTIVOS,
  ORDEM_DAS_EMPRESAS,
  type EmpresaDoRessarcimento,
  type Ressarcimento,
} from "@/lib/ressarcimento";

export interface ComprovanteDoPdf {
  numero: number;
  ressarcimentoId: string;
  nomeDoArquivo: string;
  imagens: string[]; // data URLs JPEG; vazio = não deu pra incluir
  aviso?: string;
}

const TEXTO = "#1a1a1a";
const MUDO = "#6b6b6b";
const LINHA = "#d9d9d9";
const VERDE = "#8BC34A";

const s = StyleSheet.create({
  pagina: { padding: 36, paddingBottom: 54, fontFamily: "Helvetica", fontSize: 9, color: TEXTO },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 9, color: MUDO, marginTop: 3 },
  barra: { height: 3, backgroundColor: VERDE, marginTop: 8, marginBottom: 10 },
  secao: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: VERDE,
  },
  empresa: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  pessoa: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 2 },
  cab: { flexDirection: "row", backgroundColor: "#f0f0f0", paddingVertical: 3, paddingHorizontal: 4 },
  cabTexto: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  linha: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: LINHA },
  direita: { textAlign: "right" },
  cinza: { color: MUDO, fontSize: 8 },
  subtotal: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 3, paddingHorizontal: 4 },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    padding: 8,
    backgroundColor: "#f0f7e6",
    borderLeftWidth: 4,
    borderLeftColor: VERDE,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  rodape: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUDO,
  },
  legenda: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  imagem: { width: "100%", height: 680, objectFit: "contain" },
});

function brl(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dataPago(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

const aPagar = (r: Ressarcimento) => r.status === "pendente" || r.status === "enviado";
const soma = (l: Ressarcimento[]) => l.reduce((t, r) => t + r.valor, 0);

// Empresa → pessoas (nome + PIX, como a tela), ordenadas.
function agrupar(itens: Ressarcimento[]) {
  return ORDEM_DAS_EMPRESAS.map((empresa) => {
    const daEmpresa = itens.filter((r) => r.empresa === empresa);
    const mapa = new Map<string, Ressarcimento[]>();
    for (const r of daEmpresa) {
      const chave = `${r.nome.trim().toLowerCase()}|${r.pix.trim().toLowerCase()}`;
      mapa.set(chave, [...(mapa.get(chave) ?? []), r]);
    }
    const pessoas = Array.from(mapa.values())
      .map((l) => [...l].sort((a, b) => a.data_despesa.localeCompare(b.data_despesa)))
      .sort((a, b) => a[0].nome.localeCompare(b[0].nome, "pt-BR"));
    return { empresa, itens: daEmpresa, pessoas };
  }).filter((g) => g.itens.length > 0);
}

export function DocumentoDosRessarcimentos({
  titulo,
  geradoEm,
  geradoPor,
  itens,
  comprovantes,
}: {
  titulo: string;
  geradoEm: string;
  geradoPor: string;
  itens: Ressarcimento[];
  comprovantes: ComprovanteDoPdf[];
}) {
  const validos = itens.filter((r) => r.status !== "recusado");
  const recusados = itens.filter((r) => r.status === "recusado");
  const grupos = agrupar(validos);
  const porItem = new Map<string, ComprovanteDoPdf[]>();
  for (const c of comprovantes) porItem.set(c.ressarcimentoId, [...(porItem.get(c.ressarcimentoId) ?? []), c]);
  const porId = new Map(itens.map((r) => [r.id, r]));
  const comImagem = comprovantes.filter((c) => c.imagens.length > 0);
  const semImagem = comprovantes.filter((c) => c.imagens.length === 0);

  const Rodape = () => (
    <View style={s.rodape} fixed>
      <Text>{titulo}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );

  return (
    <Document title={titulo} author={geradoPor}>
      <Page size="A4" style={s.pagina}>
        <Text style={s.titulo}>{titulo}</Text>
        <Text style={s.sub}>
          Gerado em {geradoEm} por {geradoPor}
        </Text>
        <View style={s.barra} />

        <Text style={s.secao}>Resumo para pagamento</Text>
        {grupos.length === 0 && <Text style={s.cinza}>Nenhuma despesa para pagar neste lote.</Text>}
        {grupos.map((g) => (
          <View key={g.empresa}>
            <Text style={s.empresa}>{EMPRESAS[g.empresa as EmpresaDoRessarcimento]}</Text>
            <View style={s.cab} wrap={false}>
              <Text style={[s.cabTexto, { width: 150 }]}>Nome</Text>
              <Text style={[s.cabTexto, { width: 183 }]}>Chave PIX</Text>
              <Text style={[s.cabTexto, s.direita, { width: 70 }]}>Despesas</Text>
              <Text style={[s.cabTexto, s.direita, { width: 120 }]}>A pagar (R$)</Text>
            </View>
            {g.pessoas.map((lista) => {
              const pagos = lista.filter((r) => r.status === "pago");
              return (
                <View key={`${lista[0].nome}|${lista[0].pix}`} style={s.linha} wrap={false}>
                  <View style={{ width: 150 }}>
                    <Text>{lista[0].nome}</Text>
                    {pagos.length > 0 && <Text style={s.cinza}>já pago: {brl(soma(pagos))}</Text>}
                  </View>
                  <Text style={{ width: 183 }}>{lista[0].pix}</Text>
                  <Text style={[s.direita, { width: 70 }]}>{lista.length}</Text>
                  <Text style={[s.direita, { width: 120 }]}>{brl(soma(lista.filter(aPagar)))}</Text>
                </View>
              );
            })}
            <View style={s.subtotal} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                A pagar — {EMPRESAS[g.empresa as EmpresaDoRessarcimento]}: {brl(soma(g.itens.filter(aPagar)))}
              </Text>
            </View>
          </View>
        ))}
        <View style={s.total} wrap={false}>
          <Text>TOTAL A PAGAR</Text>
          <Text>{brl(soma(validos.filter(aPagar)))}</Text>
        </View>

        <Text style={s.secao}>Despesas</Text>
        {grupos.map((g) => (
          <View key={g.empresa}>
            <Text style={s.empresa}>{EMPRESAS[g.empresa as EmpresaDoRessarcimento]}</Text>
            {g.pessoas.map((lista) => (
              <View key={`${lista[0].nome}|${lista[0].pix}`}>
                <Text style={s.pessoa} minPresenceAhead={40}>
                  {lista[0].nome}
                </Text>
                <View style={s.cab} wrap={false}>
                  <Text style={[s.cabTexto, { width: 50 }]}>Data</Text>
                  <Text style={[s.cabTexto, { width: 95 }]}>Motivo</Text>
                  <Text style={[s.cabTexto, { width: 190 }]}>Descrição</Text>
                  <Text style={[s.cabTexto, s.direita, { width: 60 }]}>Valor</Text>
                  <Text style={[s.cabTexto, { width: 68, paddingLeft: 8 }]}>Situação</Text>
                  <Text style={[s.cabTexto, { width: 60 }]}>Comprov.</Text>
                </View>
                {lista.map((r) => (
                  <View key={r.id} style={s.linha} wrap={false}>
                    <Text style={{ width: 50 }}>{formatarDataBR(r.data_despesa).slice(0, 5)}</Text>
                    <Text style={{ width: 95, paddingRight: 4 }}>{MOTIVOS[r.motivo].replace(/ \(.*\)$/, "")}</Text>
                    <Text style={{ width: 190, paddingRight: 4 }}>{r.descricao}</Text>
                    <Text style={[s.direita, { width: 60 }]}>{brl(r.valor)}</Text>
                    <Text style={{ width: 68, paddingLeft: 8 }}>
                      {r.status === "pago" ? `Pago em ${dataPago(r.pago_em)}` : "A pagar"}
                    </Text>
                    <Text style={{ width: 60 }}>
                      {(porItem.get(r.id) ?? []).map((c) => `C${c.numero}`).join(", ") || "—"}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        {recusados.length > 0 && (
          <>
            <Text style={s.secao}>Recusados (fora do total)</Text>
            <View style={s.cab} wrap={false}>
              <Text style={[s.cabTexto, { width: 100 }]}>Nome</Text>
              <Text style={[s.cabTexto, { width: 40 }]}>Data</Text>
              <Text style={[s.cabTexto, { width: 150 }]}>Descrição</Text>
              <Text style={[s.cabTexto, s.direita, { width: 65 }]}>Valor</Text>
              <Text style={[s.cabTexto, { width: 168, paddingLeft: 8 }]}>Motivo da recusa</Text>
            </View>
            {recusados.map((r) => (
              <View key={r.id} style={s.linha} wrap={false}>
                <Text style={{ width: 100, paddingRight: 4 }}>{r.nome}</Text>
                <Text style={{ width: 40 }}>{formatarDataBR(r.data_despesa).slice(0, 5)}</Text>
                <Text style={{ width: 150, paddingRight: 4 }}>{r.descricao}</Text>
                <Text style={[s.direita, { width: 65 }]}>{brl(r.valor)}</Text>
                <Text style={{ width: 168, paddingLeft: 8 }}>{r.observacao_financeiro ?? ""}</Text>
              </View>
            ))}
          </>
        )}

        {semImagem.length > 0 && (
          <>
            <Text style={s.secao}>Comprovantes não incluídos</Text>
            {semImagem.map((c) => {
              const r = porId.get(c.ressarcimentoId);
              return (
                <View key={c.numero} style={s.linha} wrap={false}>
                  <Text style={{ width: 28, fontFamily: "Helvetica-Bold" }}>C{c.numero}</Text>
                  <Text style={{ width: 200 }}>
                    {r ? `${r.nome} · ${formatarDataBR(r.data_despesa)} · ` : ""}
                    {c.nomeDoArquivo}
                  </Text>
                  <Text style={{ width: 295, color: MUDO }}>{c.aviso ?? "Não deu pra incluir — veja no d.hub"}</Text>
                </View>
              );
            })}
          </>
        )}
        <Rodape />
      </Page>

      {comImagem.flatMap((c) => {
        const r = porId.get(c.ressarcimentoId);
        const base = `C${c.numero} — ${r ? `${r.nome} · ${formatarDataBR(r.data_despesa)} · ${MOTIVOS[r.motivo].replace(/ \(.*\)$/, "")} · ${brl(r.valor)} · ` : ""}${c.nomeDoArquivo}`;
        return c.imagens.map((src, i) => (
          <Page key={`${c.numero}-${i}`} size="A4" style={s.pagina}>
            <Text style={s.legenda}>
              {base}
              {c.imagens.length > 1 ? ` (página ${i + 1} de ${c.imagens.length})` : ""}
            </Text>
            <Image src={src} style={s.imagem} />
            <Rodape />
          </Page>
        ));
      })}
    </Document>
  );
}
