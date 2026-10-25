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
