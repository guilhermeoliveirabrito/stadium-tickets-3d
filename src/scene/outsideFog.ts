import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { type Material, type Mesh, ShaderChunk } from 'three'

/**
 * Neblina "de dentro": 0 = normal; 1 = tudo o que fica fora do estádio vira
 * neblina, seja qual for a distância até a câmera. A neblina comum depende da
 * distância e não cobria o chão logo depois da cobertura, visível das vistas
 * mais altas do anel superior. Esta mede a distância até o centro do estádio:
 * o estádio inteiro fica limpo e o resto se apaga.
 */
export const outsideFog = { value: 0 }

/** raio que cobre o estádio inteiro, até a beira da cobertura (m) */
const CLEAR_RADIUS = 132
/** a partir daqui o entorno fica todo coberto */
const FULL_RADIUS = 180

// A posição no mundo vai para o fragment e a conta é feita por pixel: o chão
// da cidade é feito de triângulos enormes, e calculada nos vértices a
// neblina era interpolada ao longo de centenas de metros.
ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec2 vOutsideXZ;
	uniform float uOutsideFog;
#endif
`

ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vOutsideXZ = vec2( 0.0 );
	if ( uOutsideFog > 0.0 ) {
		vec4 fogWorld = vec4( position, 1.0 );
		#ifdef USE_INSTANCING
			fogWorld = instanceMatrix * fogWorld;
		#endif
		vOutsideXZ = ( modelMatrix * fogWorld ).xz;
	}
#endif
`

ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
	uniform vec3 fogColor;
	uniform float uOutsideFog;
	varying float vFogDepth;
	varying vec2 vOutsideXZ;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif
`

ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	if ( uOutsideFog > 0.0 ) {
		fogFactor = max( fogFactor, smoothstep( ${CLEAR_RADIUS.toFixed(1)}, ${FULL_RADIUS.toFixed(1)}, length( vOutsideXZ ) ) * uOutsideFog );
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`

/** Raio (m) do centro do estádio a partir do qual um ponto fica fora dele, para outros shaders. */
export const OUTSIDE_FOG_RADII = [CLEAR_RADIUS, FULL_RADIUS] as const

/**
 * Liga o uniform da neblina de dentro em todos os materiais com neblina da
 * cena (precisa rodar antes da compilação dos shaders).
 */
export function OutsideFogSetup() {
  const scene = useThree((s) => s.scene)
  useLayoutEffect(() => {
    const seen = new Set<Material>()
    scene.traverse((object) => {
      const material = (object as Mesh).material as Material | Material[] | undefined
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        if (seen.has(m) || !('fog' in m) || !m.fog) continue
        seen.add(m)
        const previous = m.onBeforeCompile.bind(m)
        // a chave do programa continua a mesma (o código dos shaders não muda)
        const key = m.customProgramCacheKey()
        m.onBeforeCompile = (shader, renderer) => {
          previous(shader, renderer)
          shader.uniforms.uOutsideFog = outsideFog
        }
        m.customProgramCacheKey = () => key
      }
    })
  }, [scene])
  return null
}
