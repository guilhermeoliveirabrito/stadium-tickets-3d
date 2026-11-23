/**
 * Guarda o resultado da primeira chamada. Usado nas partes pesadas da cena:
 * em desenvolvimento o StrictMode do React chama cada useMemo duas vezes, e
 * gerar o estádio e a cidade em dobro atrasava o carregamento.
 */
export function once<T>(build: () => T): () => T {
  let done = false
  let value: T
  return () => {
    if (!done) {
      value = build()
      done = true
    }
    return value
  }
}
