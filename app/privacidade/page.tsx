import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade · d.hub",
  description: "Como o d.hub trata os dados de quem usa o sistema.",
};

// Página pública (sem login): o Google Cloud exige o endereço de uma política
// de privacidade para publicar a conexão com o Google Drive (OAuth).
export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-ink sm:py-14">
      <p className="text-sm font-semibold text-brand-forte">d.hub</p>
      <h1 className="mt-1 text-3xl font-bold">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-ink-muted">Atualizada em 13 de outubro de 2026.</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold">1. O que é o d.hub</h2>
          <p className="mt-2">
            O d.hub é o sistema interno da equipe da Now Digital Lab para organizar tarefas, clientes, posts e
            demandas, e para dar aos clientes um portal onde acompanham o andamento do trabalho. Esta página explica
            quais dados o sistema trata e como.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Quais dados tratamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>Equipe:</b> nome, usuário, foto de perfil e o que a pessoa registra no sistema (tarefas, comentários,
              horas, arquivos e posts).
            </li>
            <li>
              <b>Clientes:</b> o nome da empresa, os contatos informados, os documentos, faturas, posts e comentários
              trocados pelo portal do cliente.
            </li>
            <li>
              <b>Arquivos:</b> imagens, vídeos e documentos que a equipe envia para os posts e para as pastas dos
              clientes.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Para que usamos</h2>
          <p className="mt-2">
            Apenas para operar o serviço contratado: organizar o trabalho, mostrar ao cliente o que está sendo feito e
            levar posts para aprovação. Não vendemos dados, não usamos para publicidade e não compartilhamos com
            terceiros, exceto com os fornecedores de infraestrutura necessários para o sistema funcionar (hospedagem e
            banco de dados).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Conexão com o Google Drive</h2>
          <p className="mt-2">
            Para guardar vídeos grandes dos posts, o d.hub pode se conectar a uma conta do Google Drive indicada pela
            administração. Essa conexão usa apenas a permissão <code>drive.file</code>, que só permite ao d.hub ver e
            gerenciar os arquivos <b>que ele mesmo criou</b> — nunca o restante do Drive. Os vídeos enviados ficam numa
            pasta própria e são compartilhados por link para que possam ser exibidos no preview do post e no portal do
            cliente. Nenhum dado do Google Drive é lido para outra finalidade, vendido ou usado para publicidade.
          </p>
          <p className="mt-2">
            O uso e a transferência, para qualquer outro app, de informações recebidas das APIs do Google seguirão a{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-forte underline"
            >
              Política de Dados do Usuário dos Serviços de API do Google
            </a>
            , incluindo os requisitos de Uso Limitado.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Segurança</h2>
          <p className="mt-2">
            O acesso ao sistema exige login, os arquivos ficam em armazenamento privado e as chaves de acesso a
            serviços externos ficam guardadas no servidor, fora do alcance do navegador. O portal do cliente só abre
            com o link exclusivo de cada cliente.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Por quanto tempo guardamos</h2>
          <p className="mt-2">
            Os dados ficam enquanto durar a relação de trabalho e enquanto forem necessários para o serviço. Ao
            encerrar, podem ser apagados a pedido.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Seus direitos</h2>
          <p className="mt-2">
            Conforme a Lei Geral de Proteção de Dados (LGPD), você pode pedir acesso, correção ou exclusão dos seus
            dados. Para isso, fale com a equipe responsável pelo d.hub na Now Digital Lab, pelos canais de contato que
            você já usa conosco.
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/login" className="font-medium text-brand-forte hover:underline">
          Entrar no d.hub
        </Link>
      </p>
    </main>
  );
}
