import { ArrowRight, Database, KeyRound, ShieldCheck } from 'lucide-react'

export function SetupPage() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="eyebrow"><Database size={16} /> Conexão pendente</div>
        <h1>O aplicativo está pronto para receber seu Supabase.</h1>
        <p>
          O projeto <strong>nkrkjvknjwzfvmlhfhxl</strong> já está definido. Falta apenas inserir a chave pública
          do projeto para ativar autenticação e dados.
        </p>
        <ol className="setup-steps">
          <li><span><KeyRound size={19} /></span><div><strong>Copie a chave pública</strong><p>Supabase → Project Settings → API Keys → Publishable key.</p></div></li>
          <li><span><ArrowRight size={19} /></span><div><strong>Preencha o arquivo .env.local</strong><p>Use a variável VITE_SUPABASE_PUBLISHABLE_KEY.</p></div></li>
          <li><span><ShieldCheck size={19} /></span><div><strong>Aplique a migration</strong><p>Ela cria as tabelas, funções e políticas RLS do MVP.</p></div></li>
        </ol>
        <p className="security-note"><ShieldCheck size={17} /> Nunca coloque a service_role no navegador.</p>
      </section>
    </main>
  )
}
