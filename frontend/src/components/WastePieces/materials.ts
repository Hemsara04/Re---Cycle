import * as THREE from "three";
import { COLORS } from "@/components/WasteScene/config";

/**
 * Uniforms shared by every piece, so one GSAP tween drives the whole sphere:
 *   uClean 0 → 1  dirty/worn → clean/polished
 *   uGlow  0 → 1  green fresnel rim around the assembled sphere
 */
export type WearUniforms = {
  uClean: THREE.IUniform<number>;
  uGlow: THREE.IUniform<number>;
  uGlowColor: THREE.IUniform<THREE.Color>;
  uDirtColor: THREE.IUniform<THREE.Color>;
  uDirt: THREE.IUniform<THREE.Texture>;
  uCenter: THREE.IUniform<THREE.Vector3>;
};

export function createWearUniforms(dirt: THREE.Texture): WearUniforms {
  return {
    uClean: { value: 0 },
    uGlow: { value: 0 },
    uGlowColor: { value: new THREE.Color(COLORS.glow) },
    uDirtColor: { value: new THREE.Color(COLORS.dirt) },
    uDirt: { value: dirt },
    uCenter: { value: new THREE.Vector3() },
  };
}

const VERT_PARS = /* glsl */ `
attribute float aSeed;
varying float vSeed;
varying vec3 vWearWorld;
varying vec3 vWearLocal;
`;

const VERT_MAIN = /* glsl */ `
#include <project_vertex>
vec4 wearWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wearWorld = instanceMatrix * wearWorld;
#endif
vWearWorld = (modelMatrix * wearWorld).xyz;
vWearLocal = position;
vSeed = aSeed;
`;

const FRAG_PARS = /* glsl */ `
uniform float uClean;
uniform float uGlow;
uniform vec3 uGlowColor;
uniform vec3 uDirtColor;
uniform sampler2D uDirt;
uniform vec3 uCenter;
varying float vSeed;
varying vec3 vWearWorld;
varying vec3 vWearLocal;
`;

// Grime: biplanar lookup in object space (no UVs needed), offset per instance so
// no two pieces share the same stains. Dirty pieces are also desaturated.
const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
float wearN = 0.5 * texture2D(uDirt, vWearLocal.xy * 1.7 + vSeed).r
            + 0.5 * texture2D(uDirt, vWearLocal.zy * 1.7 + vSeed * 1.73).r;
float grime = smoothstep(0.3, 0.85, wearN) * (1.0 - uClean) * (0.55 + 0.45 * fract(vSeed * 7.13));
float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(luma), 0.4 * (1.0 - uClean));
diffuseColor.rgb = mix(diffuseColor.rgb, uDirtColor * (0.55 + 0.45 * wearN), grime * 0.8);
diffuseColor.rgb *= mix(0.82, 1.06, uClean);
`;

const FRAG_ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp(mix(roughnessFactor * mix(1.0, 0.55, uClean), 1.0, grime * 0.85), 0.04, 1.0);
`;

// Rim relative to the *sphere* centre, not each piece, so the whole globe glows at its edge.
const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
vec3 sphereN = normalize(vWearWorld - uCenter);
vec3 toCam = normalize(cameraPosition - vWearWorld);
float rim = pow(1.0 - clamp(dot(sphereN, toCam), 0.0, 1.0), 4.0);
totalEmissiveRadiance += uGlowColor * rim * uGlow;
`;

/** Patch a physical material with the shared dirty→clean + glow behaviour. */
export function applyWear(material: THREE.MeshPhysicalMaterial, uniforms: WearUniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = VERT_PARS + shader.vertexShader.replace("#include <project_vertex>", VERT_MAIN);
    shader.fragmentShader =
      FRAG_PARS +
      shader.fragmentShader
        .replace("#include <color_fragment>", FRAG_COLOR)
        .replace("#include <roughnessmap_fragment>", FRAG_ROUGH)
        .replace("#include <emissivemap_fragment>", FRAG_EMISSIVE);
  };
  material.customProgramCacheKey = () => "waste-wear";
  return material;
}

/** glTF loads MeshStandardMaterial; upgrade it to physical so it gets clearcoat/sheen. */
export function toPhysical(src: THREE.Material, extra: THREE.MeshPhysicalMaterialParameters = {}) {
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshPhysicalMaterial({
    color: s.color,
    map: s.map,
    normalMap: s.normalMap,
    normalScale: s.normalScale,
    roughnessMap: s.roughnessMap,
    metalnessMap: s.metalnessMap,
    aoMap: s.aoMap,
    aoMapIntensity: s.aoMapIntensity ?? 1,
    roughness: s.roughness,
    metalness: s.metalness,
    side: s.side,
    clearcoat: 0.08,
    clearcoatRoughness: 0.5,
    ...extra,
  });
  return m;
}
