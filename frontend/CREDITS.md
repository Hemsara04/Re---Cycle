# Credits

All third-party assets are free to use commercially. No attribution is legally required for CC0, but credit is given gladly.

## 3D models: Poly Haven (CC0 1.0)

Downloaded at 1k resolution, then optimised with `gltf-transform optimize`: meshopt compression, WebP textures at 512 px, and simplification. Files are in `public/models/`.

| File | Source | Author | Used as |
|---|---|---|---|
| `can_rusted.glb` | https://polyhaven.com/a/can_rusted | Poly Haven | aluminium / tin cans |
| `cardboard_box_01.glb` | https://polyhaven.com/a/cardboard_box_01 | Poly Haven | flattened cardboard boxes (squashed at load time) |
| `plastic_bottle_gallon.glb` | https://polyhaven.com/a/plastic_bottle_gallon | Poly Haven | used cooking-oil container |
| `circuit_board.glb` | https://polyhaven.com/a/circuit_board | Benny Weimer / Poly Haven | old circuit boards |

Licence: https://polyhaven.com/license (CC0 1.0 Universal)

## iPhone 17 Pro model ("How it works", step 1)

`public/models/iphone_17_pro.glb` is loaded if present; otherwise a procedural phone stands in.
Intended source: "iPhone 17 Pro" by Ranguel on Sketchfab, CC BY 4.0 (attribution required):
https://sketchfab.com/3d-models/iphone-17-pro-4541aa8a28324b33a2baaf81d263aaec
Optimise it the same way as the other models before committing (`npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024`).
The code finds its height, width and front face automatically and lays the app's own screen UI and Dynamic Island over the display.
Unofficial, fan-made model; Apple and iPhone are trademarks of Apple Inc.

## HDRI: Poly Haven (CC0 1.0)

| File | Source | Used for |
|---|---|---|
| `public/hdri/studio_small_09_1k.hdr` | https://polyhaven.com/a/studio_small_09 | image-based lighting and reflections |

## Procedural (made in code, no external asset)

These are generated in `src/components/WastePieces/geometries.ts` and `textures.ts`:

- **Crushed PET bottles**: lathe geometry, squashed and dented with noise; transmission material (IOR 1.45)
- **Glass bottles**: lathe geometry; transmission material (IOR 1.52), tinted amber, green or clear per instance
- **Crumpled paper balls**: ridged-noise displaced icosphere with a generated newsprint texture
- **Bottle caps**: ridged cylinder, instanced
- **Plastic fragments**: jittered low-poly shards, instanced
- **Grime mask**: tileable fractal-noise texture that drives the dirty → clean transition
- **"How it works" scene**: Sri Lanka coastline (simplified by hand), map pins, phone, screen UI, chat bubbles and route are all generated in `src/components/HowItWorks/objects.ts`
- **Static fallback image**: `public/images/waste-globe.svg`, generated with a script

## Libraries

three.js (MIT), GSAP and ScrollTrigger (free "no charge" licence), Lenis (MIT), meshoptimizer decoder (MIT, bundled with three.js).
