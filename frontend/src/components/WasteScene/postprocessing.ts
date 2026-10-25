import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/** Film grain + soft vignette, applied after tone mapping. */
const GrainShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAmount: { value: 0.045 },
    uVignette: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    uniform float uVignette;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float n = hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5;
      c.rgb += n * uAmount;
      float d = distance(vUv, vec2(0.5));
      c.rgb *= mix(1.0, smoothstep(0.85, 0.2, d), uVignette);
      gl_FragColor = c;
    }
  `,
};

export type PostSettings = { dof: boolean; bloom: boolean; grain: boolean; msaa: number };

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  settings: PostSettings,
) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: settings.msaa,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  let bokeh = settings.dof
    ? new BokehPass(scene, camera, { focus: 10, aperture: 0.0016, maxblur: 0.006 })
    : null;
  if (bokeh) composer.addPass(bokeh);

  const bloom = settings.bloom ? new UnrealBloomPass(size, 0.42, 0.55, 0.9) : null;
  if (bloom) composer.addPass(bloom);

  composer.addPass(new OutputPass()); // ACES tone mapping + sRGB happen here

  const grain = settings.grain ? new ShaderPass(GrainShader) : null;
  if (grain) composer.addPass(grain);

  return {
    composer,
    setSize(w: number, h: number, dpr: number) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
    },
    /** Keep the sphere in focus while the cloud around it softens. */
    setFocus(distance: number) {
      if (!bokeh) return;
      (bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = distance;
    },
    hasDof: () => bokeh !== null,
    /** First thing to go when the frame rate drops: the extra depth render is the costliest pass. */
    dropDof() {
      if (!bokeh) return;
      composer.removePass(bokeh);
      bokeh.dispose();
      bokeh = null;
    },
    render(time: number) {
      if (grain) grain.uniforms.uTime.value = time;
      composer.render();
    },
    dispose() {
      composer.passes.forEach((p) => (p as { dispose?: () => void }).dispose?.());
      composer.dispose();
      target.dispose();
    },
  };
}

export type Post = ReturnType<typeof createPost>;
