import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

export function UpdatePrompt() {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const handleUpdate = () => setAvailable(true)
    window.addEventListener('meu-ritmo:update-available', handleUpdate)
    return () => window.removeEventListener('meu-ritmo:update-available', handleUpdate)
  }, [])

  if (!available) return null

  return (
    <aside className="update-prompt" role="status" aria-live="polite">
      <span><RefreshCw size={19} /></span>
      <div><strong>Nova versão disponível</strong><small>Atualize para receber as melhorias mais recentes.</small></div>
      <button className="secondary-button" type="button" onClick={() => window.location.reload()}>Atualizar</button>
      <button className="icon-button" type="button" aria-label="Fechar aviso de atualização" onClick={() => setAvailable(false)}><X size={17} /></button>
    </aside>
  )
}
