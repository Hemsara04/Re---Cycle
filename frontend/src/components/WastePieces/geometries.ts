import * as THREE from "three";
import { fbm3, mulberry32, noise3 } from "@/lib/noise";

/**
 * Procedural stand-ins for items without a suitable CC0 model.
 * Conventions for every geometry returned here (and for the prepared GLB models):
 *   - centred on the origin, longest side = 1 unit
 *   - the "flat" side of flat objects faces +Z, because +Z is pointed outward
 *     from the sphere when a piece docks.
 */

export function normalize(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  geo.translate(-center.x, -center.y, -center.z);
  const s = 1 / Math.max(size.x, size.y, size.z);
  geo.scale(s, s, s);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function lathe(profile: [number, number][], segments: number) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

/** A PET bottle, squashed flat and dented, like it's been stepped on. */
export function crushedPetBottle() {
  const geo = lathe(
    [
      [0.001, 0], [0.13, 0], [0.16, 0.02], [0.17, 0.06], [0.165, 0.12], [0.172, 0.2], [0.165, 0.3],
      [0.172, 0.4], [0.168, 0.52], [0.16, 0.6], [0.13, 0.7], [0.09, 0.78], [0.065, 0.84],
      [0.06, 0.9], [0.068, 0.91], [0.068, 0.96], [0.06, 0.97], [0.001, 0.97],
    ],
    40,
  );
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // flatten along Z, more in the body than at the neck (the neck is stiffer)
    const body = 1 - THREE.MathUtils.smoothstep(v.y, 0.55, 0.85);
    const squash = 1 - 0.62 * body * (0.75 + 0.5 * noise3(v.x * 3, v.y * 4, 1.3));
    v.z *= squash;
    // crinkles
    const dent = (fbm3(v.x * 9, v.y * 9, v.z * 9, 3) - 0.5) * 0.06 * body;
    v.x += dent;
    v.z += dent * 0.6;
    // a slight bend
    v.x += Math.sin(v.y * 3) * 0.03 * body;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return normalize(geo);
}

/** Long-neck glass bottle (beer / arrack). */
export function glassBottle() {
  const geo = lathe(
    [
      [0.001, 0], [0.14, 0], [0.16, 0.012], [0.165, 0.04], [0.165, 0.52], [0.15, 0.6], [0.1, 0.68],
      [0.065, 0.74], [0.058, 0.8], [0.056, 0.93], [0.064, 0.94], [0.066, 0.985], [0.055, 1], [0.001, 1],
    ],
    36,
  );
  geo.computeVertexNormals();
  return normalize(geo);
}

/** A crumpled ball of newspaper: displaced icosphere, faceted for sharp creases. */
export function paperBall(seed = 7) {
  // Polyhedron geometries are already non-indexed, so every face stays sharp (faceted creases)
  const geo = new THREE.IcosahedronGeometry(0.5, 5);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const o = seed * 13.1;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    // ridged noise gives fold lines rather than smooth bumps
    const ridged = 1 - Math.abs(noise3(n.x * 3 + o, n.y * 3, n.z * 3) * 2 - 1);
    const big = fbm3(n.x * 1.6 + o, n.y * 1.6, n.z * 1.6, 3);
    const r = 0.5 * (0.78 + 0.32 * big + 0.12 * ridged);
    v.copy(n).multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y * 0.92, v.z);
  }
  geo.computeVertexNormals();
  return normalize(geo);
}

/** Ridged bottle cap, lying flat (axis along +Z). */
export function bottleCap() {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.42, 48, 2, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const r = Math.hypot(x, z);
    if (r > 0.45 && Math.abs(y) < 0.2) {
      const a = Math.atan2(z, x);
      const k = 1 + 0.035 * Math.sign(Math.sin(a * 24));
      pos.setXYZ(i, x * k, y, z * k);
    }
  }
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return normalize(geo);
}

/** Irregular flat plastic/glass fragment. */
export function fragment(seed = 3) {
  const rand = mulberry32(seed);
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const pos = geo.attributes.position;
  // jitter shared vertices consistently so the mesh stays closed
  const cache = new Map<string, THREE.Vector3>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let j = cache.get(key);
    if (!j) {
      j = new THREE.Vector3((rand() - 0.5) * 0.25, (rand() - 0.5) * 0.25, (rand() - 0.5) * 0.1);
      cache.set(key, j);
    }
    pos.setXYZ(i, pos.getX(i) * 1.2 + j.x, pos.getY(i) * 0.9 + j.y, pos.getZ(i) * 0.22 + j.z);
  }
  geo.computeVertexNormals();
  return normalize(geo);
}
