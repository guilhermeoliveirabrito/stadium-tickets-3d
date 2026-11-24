import { useEffect } from 'react'
import { LogoMark } from './Logo'

const COPY = {
  webgl: {
    title: 'Seu navegador não abriu o 3D',
    text: 'O estádio é desenhado em 3D com WebGL 2, e este navegador não conseguiu ativá-lo. Ative a aceleração de hardware nas configurações do navegador ou abra o site no Chrome, Edge, Firefox ou Safari atualizados.',
    action: 'Tentar de novo',
  },
  error: {
    title: 'Algo deu errado ao montar o estádio',
    text: 'Um erro interrompeu a cena. Recarregar a página costuma resolver, e os ingressos comprados continuam guardados.',
    action: 'Recarregar',
  },
}

/** No lugar da experiência quando o 3D não abre (sem WebGL 2) ou quando a cena quebra. */
export function Fallback({ reason }: { reason: keyof typeof COPY }) {
  const copy = COPY[reason]
  useEffect(() => {
    // a abertura de texto do index.html ficaria parada atrás da mensagem
    document.getElementById('boot')?.remove()
  }, [])
  return (
    <div className="fallback" role="alert">
      <div className="fallback__card">
        <LogoMark size={44} />
        <h1 className="fallback__title">{copy.title}</h1>
        <p className="fallback__text">{copy.text}</p>
        <button className="btn btn--primary fallback__btn" type="button" onClick={() => window.location.reload()}>
          {copy.action}
        </button>
      </div>
    </div>
  )
}
