import { ArrowLeft, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const updatedAt = '17 de julho de 2026'
const contactEmail = 'brunossoares.bfs@gmail.com'

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade" subtitle="Como o Meu Ritmo trata e protege seus dados.">
      <LegalSection title="1. Dados que coletamos">
        <p>Tratamos dados de cadastro e autenticação, como nome, e-mail e foto de perfil quando você entra com o Google. Também armazenamos o conteúdo que você cria no aplicativo, incluindo tarefas, prioridades, estimativas e sessões de foco.</p>
        <p>Podemos registrar informações técnicas essenciais para segurança e funcionamento, como data de acesso, eventos de autenticação e erros da aplicação.</p>
      </LegalSection>
      <LegalSection title="2. Como usamos seus dados">
        <p>Usamos os dados para autenticar sua conta, disponibilizar as funcionalidades de planejamento, manter seu conteúdo sincronizado, prevenir abusos, corrigir falhas e prestar suporte.</p>
      </LegalSection>
      <LegalSection title="3. Serviços utilizados">
        <p>O Meu Ritmo utiliza Supabase para autenticação e banco de dados, Vercel para hospedagem e Google OAuth quando você escolhe entrar com o Google. Esses provedores podem processar dados em outros países conforme suas próprias políticas e mecanismos de proteção.</p>
      </LegalSection>
      <LegalSection title="4. Compartilhamento e venda de dados">
        <p>Não vendemos seus dados pessoais. O compartilhamento ocorre somente com os provedores necessários à operação, por obrigação legal ou para proteger direitos e a segurança do serviço.</p>
      </LegalSection>
      <LegalSection title="5. Segurança e retenção">
        <p>Aplicamos conexão criptografada, autenticação e políticas de isolamento por usuário no banco de dados. Mantemos os dados enquanto a conta estiver ativa ou pelo período necessário para cumprir obrigações legais e de segurança.</p>
      </LegalSection>
      <LegalSection title="6. Seus direitos">
        <p>Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade ou exclusão de seus dados, conforme a Lei Geral de Proteção de Dados. Para exercer seus direitos ou pedir a exclusão da conta, escreva para <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
      </LegalSection>
      <LegalSection title="7. Sessão e armazenamento local">
        <p>O aplicativo usa recursos do navegador necessários para manter sua sessão autenticada e suas preferências. Você pode encerrar a sessão usando o botão “Sair”.</p>
      </LegalSection>
      <LegalSection title="8. Alterações">
        <p>Esta política pode ser atualizada para refletir mudanças no produto ou na legislação. A versão vigente será publicada nesta página com a data da última atualização.</p>
      </LegalSection>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso" subtitle="Regras essenciais para usar o Meu Ritmo.">
      <LegalSection title="1. Aceitação">
        <p>Ao criar uma conta ou usar o Meu Ritmo, você concorda com estes Termos e com a Política de Privacidade. Se não concordar, não utilize o serviço.</p>
      </LegalSection>
      <LegalSection title="2. Finalidade do serviço">
        <p>O Meu Ritmo oferece ferramentas de planejamento pessoal, organização de tarefas e acompanhamento de foco. O serviço não substitui orientação profissional, médica, financeira ou jurídica.</p>
      </LegalSection>
      <LegalSection title="3. Conta e segurança">
        <p>Você é responsável por fornecer informações corretas, proteger suas credenciais e pelas atividades realizadas na sua conta. Avise-nos se identificar acesso não autorizado.</p>
      </LegalSection>
      <LegalSection title="4. Uso permitido">
        <p>Você não pode usar o aplicativo para atividades ilegais, tentar acessar dados de terceiros, explorar vulnerabilidades, interferir no serviço ou automatizar requisições de forma abusiva.</p>
      </LegalSection>
      <LegalSection title="5. Seu conteúdo">
        <p>Você mantém a titularidade do conteúdo que registra. Concede apenas a autorização técnica necessária para armazená-lo, processá-lo e exibi-lo dentro das funcionalidades contratadas.</p>
      </LegalSection>
      <LegalSection title="6. Disponibilidade e mudanças">
        <p>Buscamos manter o serviço disponível e seguro, mas podem ocorrer manutenções, falhas ou mudanças de funcionalidades. Não garantimos operação ininterrupta nem adequação a uma finalidade específica.</p>
      </LegalSection>
      <LegalSection title="7. Encerramento">
        <p>Você pode deixar de usar o serviço a qualquer momento e solicitar a exclusão da conta. Podemos suspender acessos que violem estes Termos ou representem risco para usuários e infraestrutura.</p>
      </LegalSection>
      <LegalSection title="8. Contato e legislação">
        <p>Estes Termos são regidos pelas leis brasileiras. Dúvidas ou solicitações podem ser enviadas para <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
      </LegalSection>
    </LegalLayout>
  )
}

function LegalLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" to="/login"><span className="brand-mark image-mark primary-brand-mark"><img src={`${import.meta.env.BASE_URL}app-icon-192.png`} alt="" /></span><strong>Meu Ritmo</strong></Link>
        <Link className="legal-back" to="/login"><ArrowLeft size={17} /> Voltar ao aplicativo</Link>
      </header>
      <article className="legal-document">
        <div className="legal-title"><span><ShieldCheck size={18} /> Documento público</span><h1>{title}</h1><p>{subtitle}</p><small>Última atualização: {updatedAt}</small></div>
        <div className="legal-content">{children}</div>
      </article>
    </main>
  )
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>
}
