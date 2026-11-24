import type { BufferGeometry } from 'three'

/** A geometria sem índice, para juntar peças; a que já não tem índice volta como está (sem o aviso do three.js). */
export const nonIndexed = (geometry: BufferGeometry) => (geometry.index ? geometry.toNonIndexed() : geometry)
