/**
 * Entorno do estádio (cidade, estacionamento, trânsito, pessoas na esplanada).
 * Nas vistas de dentro (setor, bloco e camarote) nada disso aparece: enquanto
 * a câmera desce, a neblina de dentro (outsideFog.ts) apaga tudo o que fica
 * fora do estádio, e depois o entorno deixa de ser desenhado e animado (ver
 * CameraRig).
 */
export const outside = { visible: true }
