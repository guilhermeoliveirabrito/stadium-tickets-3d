import { PlayIcon } from './icons'

/**
 * Prévia da vista do lugar, em destaque: a foto da vista de verdade (tirada
 * logo que a câmera para no lugar) com um botão de play no meio.
 */
export function PovPreview({
  shot,
  label,
  tag,
  onClick,
  tab,
}: {
  shot: string | null
  label: string
  tag: string
  onClick: () => void
  tab: number
}) {
  return (
    <button className="pov-preview" type="button" onClick={onClick} tabIndex={tab} data-shot={!!shot}>
      {shot ? <img src={shot} alt="" /> : <span className="pov-preview__loading" />}
      <span className="pov-preview__shade" />
      <span className="pov-preview__tag">{tag}</span>
      <span className="pov-preview__play">
        <PlayIcon />
      </span>
      <span className="pov-preview__label">{label}</span>
    </button>
  )
}
