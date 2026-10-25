import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  CLOUD,
  FILLER_SIZE,
  HERO_MIX,
  type HeroKind,
  IDLE_DRIFT,
  MODEL_URLS,
  PIECE_SIZE,
  SIZE_JITTER,
  SPHERE_RADIUS,
  FLIGHT_SPIN,
} from "@/components/WasteScene/config";
import { mulberry32 } from "@/lib/noise";
import { bottleCap, crushedPetBottle, fragment, glassBottle, paperBall } from "./geometries";
import { applyWear, createWearUniforms, toPhysical, type WearUniforms } from "./materials";
import { dirtTexture, newsprintTexture } from "./textures";

type Kind = HeroKind | "cap" | "fragment";
type Part = { geometry: THREE.BufferGeometry; material: THREE.MeshPhysicalMaterial };

/** One flying object. `t` is animated by the GSAP timeline: 0 = in the cloud, 1 = docked. */
export type Piece = {
  t: number;
  kind: Kind;
  filler: boolean;
  index: number; // instance index within its kind
  seed: number;
  curve: THREE.CatmullRomCurve3;
  target: THREE.Vector3;
  normal: THREE.Vector3;
  qStart: THREE.Quaternion;
  qTarget: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  scale: THREE.Vector3;
};

export type PiecesOptions = {
  hero: number;
  filler: number;
  transmission: boolean;
  shadows: boolean;
  onProgress?: (fraction: number) => void;
};

// Per-kind tweaks applied to the normalised geometry and to the instance scale.
// rotateX turns a model so its flat side faces +Z (outward on the sphere).
const PREP: Record<Kind, { rotateX?: number; squash?: [number, number, number]; size: number }> = {
  can: { size: 0.62 },
  cardboard: { squash: [1, 0.32, 1], rotateX: -Math.PI / 2, size: 1.2 },
  oilJug: { size: 0.92 },
  circuitBoard: { rotateX: -Math.PI / 2, size: 1.0 },
  petBottle: { size: 0.95 },
  glassBottle: { size: 0.9 },
  paperBall: { size: 0.5 },
  cap: { size: 0.75 },
  fragment: { size: 1 },
};

const CAP_COLORS = ["#1f6fd1", "#d23b3b", "#f2f2ee", "#2f9e57", "#f0c419", "#1c1c1c", "#3d7fd9"];
const GLASS_COLORS = ["#9a5a1c", "#2f6b3a", "#dfe9e4", "#6d4317"];
const FRAGMENT_COLORS = ["#2f80ed", "#e0e0d8", "#14a39a", "#d9822b", "#7c8b99"];

function fibonacciSphere(n: number, offset = 0) {
  const pts: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i + offset;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return pts;
}

async function loadModelParts(url: string, kind: HeroKind, onProgress: (f: number) => void): Promise<Part[]> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url, (e) => e.total && onProgress(e.loaded / e.total));
  gltf.scene.updateMatrixWorld(true);

  const parts: Part[] = [];
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    parts.push({ geometry, material: toPhysical(mats[0], kind === "can" ? { clearcoat: 0.35 } : {}) });
  });

  // Normalise all parts of the model together (keep their relative placement)
  const box = new THREE.Box3();
  parts.forEach((p) => {
    p.geometry.computeBoundingBox();
    box.union(p.geometry.boundingBox!);
  });
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const prep = PREP[kind];
  const sq = prep.squash ?? [1, 1, 1];
  const s = 1 / Math.max(size.x * sq[0], size.y * sq[1], size.z * sq[2]);
  for (const p of parts) {
    p.geometry.translate(-center.x, -center.y, -center.z);
    p.geometry.scale(s * sq[0], s * sq[1], s * sq[2]);
    if (prep.rotateX) p.geometry.rotateX(prep.rotateX);
    p.geometry.computeBoundingSphere();
  }
  return parts;
}

function proceduralParts(kind: Kind, transmission: boolean): Part[] {
  const glassy = (params: THREE.MeshPhysicalMaterialParameters): THREE.MeshPhysicalMaterialParameters =>
    transmission ? params : { ...params, transmission: 0, transparent: true, opacity: 0.6, depthWrite: false };

  switch (kind) {
    case "petBottle":
      return [{
        geometry: crushedPetBottle(),
        material: new THREE.MeshPhysicalMaterial(glassy({
          color: "#d8eef7", roughness: 0.16, metalness: 0, transmission: 0.94, thickness: 0.12, ior: 1.45,
          clearcoat: 0.6, clearcoatRoughness: 0.2, side: THREE.DoubleSide, specularIntensity: 1,
        })),
      }];
    case "glassBottle":
      return [{
        geometry: glassBottle(),
        material: new THREE.MeshPhysicalMaterial(glassy({
          color: "#ffffff", roughness: 0.06, metalness: 0, transmission: 1, thickness: 0.35, ior: 1.52,
          clearcoat: 1, clearcoatRoughness: 0.05, attenuationDistance: 0.8, attenuationColor: new THREE.Color("#cfe6d8"),
        })),
      }];
    case "paperBall":
      return [{
        geometry: paperBall(),
        material: new THREE.MeshPhysicalMaterial({ map: newsprintTexture(), roughness: 0.95, sheen: 0.4, sheenRoughness: 0.8, clearcoat: 0.01 }),
      }];
    case "cap":
      return [{
        geometry: bottleCap(),
        material: new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
      }];
    case "fragment":
      return [{
        geometry: fragment(),
        material: new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.3, side: THREE.DoubleSide }),
      }];
    default:
      throw new Error(`No procedural geometry for ${kind}`);
  }
}

/** Distribute `n` hero pieces across kinds according to HERO_MIX. */
function heroKinds(n: number, rand: () => number): HeroKind[] {
  const entries = Object.entries(HERO_MIX) as [HeroKind, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const kinds: HeroKind[] = [];
  for (const [k, w] of entries) for (let i = 0; i < Math.round((w / total) * n); i++) kinds.push(k);
  while (kinds.length < n) kinds.push("petBottle");
  kinds.length = n;
  // shuffle so the same kinds don't cluster on the sphere
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return kinds;
}

export class WastePieces {
  readonly group = new THREE.Group();
  readonly pieces: Piece[] = [];
  readonly uniforms: WearUniforms;
  readonly core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private meshes = new Map<Kind, THREE.InstancedMesh[]>();
  private disposables: { dispose(): void }[] = [];
  private tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), p: new THREE.Vector3(), d: new THREE.Vector3() };

  private constructor(uniforms: WearUniforms) {
    this.uniforms = uniforms;
    // Dark inner core: reads as the shadowed gaps between pieces once assembled
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS - 0.18, 64, 32),
      new THREE.MeshStandardMaterial({ color: "#0a0f0c", roughness: 1, metalness: 0 }),
    );
    this.core.scale.setScalar(0.001);
    this.group.add(this.core);
  }

  static async create(opts: PiecesOptions) {
    const rand = mulberry32(2026);
    const dirt = dirtTexture();
    const self = new WastePieces(createWearUniforms(dirt));
    self.disposables.push(dirt, self.core.geometry, self.core.material);

    // ── assign kinds ──
    const heroes = heroKinds(opts.hero, rand);
    const fillers: Kind[] = Array.from({ length: opts.filler }, () => (rand() < 0.62 ? "cap" : "fragment"));
    const counts = new Map<Kind, number>();
    [...heroes, ...fillers].forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));

    // ── load models (in parallel) + build procedural parts ──
    const modelKinds = Object.keys(MODEL_URLS) as (keyof typeof MODEL_URLS)[];
    const progress = new Map<string, number>();
    const report = () => opts.onProgress?.([...progress.values()].reduce((a, b) => a + b, 0) / modelKinds.length);
    const loaded = await Promise.all(
      modelKinds.map((k) =>
        counts.has(k)
          ? loadModelParts(MODEL_URLS[k], k, (f) => {
              progress.set(k, f);
              report();
            }).then((parts) => {
              progress.set(k, 1);
              report();
              return [k, parts] as const;
            })
          : Promise.resolve([k, [] as Part[]] as const),
      ),
    );
    const partsByKind = new Map<Kind, Part[]>(loaded);
    for (const k of counts.keys()) if (!partsByKind.has(k)) partsByKind.set(k, proceduralParts(k, opts.transmission));

    // ── one InstancedMesh per (kind, part) ──
    for (const [kind, count] of counts) {
      const meshes = partsByKind.get(kind)!.map(({ geometry, material }) => {
        geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
        applyWear(material, self.uniforms);
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false; // instances move far outside the base bounds
        mesh.castShadow = opts.shadows;
        mesh.receiveShadow = opts.shadows && !material.transmission;
        self.group.add(mesh);
        self.disposables.push(geometry, material);
        return mesh;
      });
      self.meshes.set(kind, meshes);
    }

    // ── targets on the sphere, start positions in the cloud, flight curves ──
    const heroTargets = fibonacciSphere(heroes.length);
    const fillerTargets = fibonacciSphere(fillers.length, 1.3);
    const nextIndex = new Map<Kind, number>();
    const color = new THREE.Color();

    const build = (kind: Kind, normal: THREE.Vector3, filler: boolean) => {
      const index = nextIndex.get(kind) ?? 0;
      nextIndex.set(kind, index + 1);
      const seed = rand();
      const jitter = 1 + (rand() * 2 - 1) * SIZE_JITTER;
      const base = (filler ? FILLER_SIZE * (0.7 + rand() * 0.6) : PIECE_SIZE * jitter) * PREP[kind].size;
      // a little non-uniform scale so repeated models don't read as clones
      const scale = new THREE.Vector3(base * (0.92 + rand() * 0.16), base * (0.92 + rand() * 0.16), base);

      // radial offset = half the piece's depth along +Z, so it sits on the surface
      const geo = partsByKind.get(kind)![0].geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const halfZ = (geo.boundingBox!.max.z - geo.boundingBox!.min.z) / 2;
      const radius = SPHERE_RADIUS + halfZ * scale.z * 0.55 - (filler ? 0.06 : 0);
      const target = normal.clone().multiplyScalar(radius);

      // orientation: local +Z = outward normal, random roll around it
      const tangent = new THREE.Vector3(0, 1, 0).cross(normal);
      if (tangent.lengthSq() < 1e-4) tangent.set(1, 0, 0);
      tangent.normalize().applyAxisAngle(normal, rand() * Math.PI * 2);
      const bitangent = normal.clone().cross(tangent);
      const qTarget = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, bitangent, normal));

      // start somewhere in the cloud, keeping the area right in front of the camera clear
      const start = new THREE.Vector3();
      do {
        start.set(
          (rand() * 2 - 1) * CLOUD.x * (filler ? 1.25 : 1),
          (rand() * 2 - 1) * CLOUD.y * (filler ? 1.25 : 1),
          CLOUD.zFar + rand() * (CLOUD.zNear - CLOUD.zFar),
        );
      } while (Math.hypot(start.x, start.y) < 2.2 && start.z > -2);
      const qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6.28, rand() * 6.28, rand() * 6.28));

      // curved path: swing out sideways, then approach the dock point radially
      const mid = start.clone().lerp(target, 0.45);
      const swing = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      mid.addScaledVector(swing, start.distanceTo(target) * (0.25 + rand() * 0.25));
      const approach = target.clone().addScaledVector(normal, 1.4 + rand());
      const curve = new THREE.CatmullRomCurve3([start, mid, approach, target], false, "centripetal");

      // per-instance tint + wear seed
      const meshes = self.meshes.get(kind)!;
      if (kind === "cap") color.set(CAP_COLORS[Math.floor(rand() * CAP_COLORS.length)]);
      else if (kind === "fragment") color.set(FRAGMENT_COLORS[Math.floor(rand() * FRAGMENT_COLORS.length)]);
      else if (kind === "glassBottle") color.set(GLASS_COLORS[Math.floor(rand() * GLASS_COLORS.length)]);
      else color.setHSL(0, 0, 0.88 + rand() * 0.12);
      for (const mesh of meshes) {
        mesh.setColorAt(index, color);
        (mesh.geometry.getAttribute("aSeed") as THREE.InstancedBufferAttribute).setX(index, seed * 10);
      }

      const piece: Piece = {
        t: 0, kind, filler, index, seed, curve, target, normal: normal.clone(), qStart, qTarget,
        spinAxis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        scale,
      };
      self.pieces.push(piece);
    };

    heroes.forEach((k, i) => build(k, heroTargets[i], false));
    fillers.forEach((k, i) => build(k, fillerTargets[i], true));
    for (const meshes of self.meshes.values()) {
      for (const mesh of meshes) {
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.geometry.getAttribute("aSeed").needsUpdate = true;
      }
    }
    self.update(0);
    return self;
  }

  /** Writes every instance matrix for the current piece progress + idle drift. */
  update(time: number) {
    const { m, q, q2, p, d } = this.tmp;
    for (const piece of this.pieces) {
      const t = piece.t;
      const u = Math.min(Math.max(t, 0), 1);
      const free = (1 - u) * (1 - u); // how much "floating" is left

      if (t <= 1) piece.curve.getPoint(u, p);
      else p.copy(piece.target).addScaledVector(piece.normal, -(t - 1) * 1.2); // overshoot into the surface

      // slow drifting while scattered
      if (free > 0.001) {
        const s = piece.seed * 100;
        d.set(Math.sin(time * 0.31 + s), Math.cos(time * 0.27 + s * 1.3), Math.sin(time * 0.23 + s * 0.7));
        p.addScaledVector(d, IDLE_DRIFT * free);
      }

      // rotation: tumble in the cloud, spin while flying, lock to target orientation
      q.slerpQuaternions(piece.qStart, piece.qTarget, u * u * (3 - 2 * u));
      const spin = FLIGHT_SPIN * (1 - u) + time * 0.25 * free;
      if (spin !== 0) q.premultiply(q2.setFromAxisAngle(piece.spinAxis, spin));

      m.compose(p, q, piece.scale);
      for (const mesh of this.meshes.get(piece.kind)!) mesh.setMatrixAt(piece.index, m);
    }
    for (const meshes of this.meshes.values()) for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    for (const meshes of this.meshes.values()) meshes.forEach((m) => m.dispose());
  }
}
