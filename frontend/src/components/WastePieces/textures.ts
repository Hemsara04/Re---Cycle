import * as THREE from "three";
import { fbm3, mulberry32 } from "@/lib/noise";

/** Runtime-generated textures — zero download cost. */

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

/**
 * Tileable grime mask (white = dirty). Sampled biplanarly in the wear shader,
 * so it needs no UVs and works on every piece.
 */
export function dirtTexture(size = 256) {
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // sample a torus so the texture tiles seamlessly
      const a = (x / size) * Math.PI * 2;
      const b = (y / size) * Math.PI * 2;
      const nx = Math.cos(a) * 1.6, ny = Math.sin(a) * 1.6, nz = Math.cos(b) * 1.6, nw = Math.sin(b) * 1.6;
      const blotch = fbm3(nx + nw * 0.7, ny, nz + 3.1, 5);
      const speck = fbm3(nx * 6, ny * 6 + nw * 4, nz * 6, 2);
      const v = Math.min(1, Math.max(0, (blotch - 0.38) * 2.2 + (speck - 0.5) * 0.5));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** Newsprint for the crumpled paper balls. */
export function newsprintTexture(size = 512) {
  const [c, ctx] = canvas(size);
  const rand = mulberry32(11);
  ctx.fillStyle = "#e9e4d8";
  ctx.fillRect(0, 0, size, size);
  // columns of "text": short grey dashes
  const cols = 4, gutter = 14, colW = (size - gutter * (cols + 1)) / cols;
  for (let col = 0; col < cols; col++) {
    const x0 = gutter + col * (colW + gutter);
    let y = 18;
    while (y < size - 10) {
      if (rand() < 0.07) {
        // a headline or a photo block
        ctx.fillStyle = rand() < 0.5 ? "#3a3a3a" : "#9a958c";
        const h = 14 + rand() * 40;
        ctx.fillRect(x0, y, colW, h);
        y += h + 8;
        continue;
      }
      let x = x0;
      ctx.fillStyle = `rgba(40,40,40,${0.45 + rand() * 0.3})`;
      while (x < x0 + colW - 4) {
        const w = Math.min(4 + rand() * 18, x0 + colW - x);
        ctx.fillRect(x, y, w, 2.2);
        x += w + 3;
      }
      y += 6;
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft radial blob used as a contact shadow under the sphere. */
export function radialTexture(inner = "rgba(0,0,0,0.85)", outer = "rgba(0,0,0,0)", size = 256) {
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
