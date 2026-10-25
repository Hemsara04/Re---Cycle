import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { glassBottle } from "@/components/WastePieces/geometries";
import { PROVINCES } from "@/lib/locations";
import { MATERIALS } from "@/lib/materials";
import { mulberry32 } from "@/lib/noise";
import { HOW_COLORS, MAP } from "./config";

// ─── Geography ───────────────────────────────────────────────────────────────

/** Simplified Sri Lanka coastline, clockwise from Point Pedro. [lng, lat] */
const COASTLINE: [number, number][] = [
  [80.25, 9.83], [80.45, 9.7], [80.6, 9.45], [80.82, 9.22], [81.0, 8.9], [81.23, 8.57], [81.38, 8.38],
  [81.55, 8.05], [81.72, 7.75], [81.85, 7.3], [81.86, 6.9], [81.7, 6.5], [81.45, 6.25], [81.1, 6.1],
  [80.75, 5.98], [80.55, 5.92], [80.3, 5.98], [80.1, 6.12], [79.98, 6.45], [79.86, 6.85], [79.84, 7.2],
  [79.8, 7.6], [79.76, 8.0], [79.85, 8.4], [79.92, 8.8], [79.9, 9.05], [80.05, 9.3], [79.95, 9.55],
  [79.95, 9.75], [80.1, 9.82],
];

/** [lng, lat] → world position on the map's top surface (north = −Z). */
export function project(lng: number, lat: number, y = 0) {
  return new THREE.Vector3((lng - MAP.centerLng) * MAP.scale, y, -(lat - MAP.centerLat) * MAP.scale);
}

export function createIsland() {
  const group = new THREE.Group();

  // Extruded landmass (shape drawn in XY with north = +Y, then laid flat)
  const shape = new THREE.Shape(
    COASTLINE.map(([lng, lat]) => new THREE.Vector2((lng - MAP.centerLng) * MAP.scale, (lat - MAP.centerLat) * MAP.scale)),
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: MAP.thickness,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -MAP.thickness - 0.05, 0); // top surface at y = 0
  const land = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({ color: HOW_COLORS.land, roughness: 0.55, metalness: 0.05, clearcoat: 0.4, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color("#6ee7a0") }),
  );
  land.receiveShadow = true;
  land.castShadow = true;
  group.add(land);

  // Glowing coastline on the top edge
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(COASTLINE.map(([lng, lat]) => project(lng, lat, 0.012))),
    new THREE.LineBasicMaterial({ color: HOW_COLORS.landEdge, transparent: true, opacity: 0.7, toneMapped: false }),
  );
  group.add(outline);

  // Ocean: dotted grid that fades out radially
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({ map: dotGridTexture(), transparent: true, depthWrite: false, toneMapped: false }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -MAP.thickness - 0.2;
  group.add(ocean);

  return group;
}

function dotGridTexture(size = 1024) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const step = size / 64;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const dx = x - 31.5, dy = y - 31.5;
      const fade = Math.max(0, 1 - Math.hypot(dx, dy) / 32);
      ctx.fillStyle = `rgba(61,220,132,${0.28 * fade * fade})`;
      ctx.beginPath();
      ctx.arc(x * step + step / 2, y * step + step / 2, size / 700, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ─── Pins ────────────────────────────────────────────────────────────────────

/** Map pin: sphere head on a downward cone, tip at the origin. */
export function pinGeometry(scale = 1) {
  const head = new THREE.SphereGeometry(0.095, 20, 14);
  head.translate(0, 0.32, 0);
  const cone = new THREE.ConeGeometry(0.058, 0.28, 16, 1, true);
  cone.rotateX(Math.PI);
  cone.translate(0, 0.16, 0);
  const geo = mergeGeometries([head.toNonIndexed(), cone.toNonIndexed()])!;
  geo.scale(scale, scale, scale);
  geo.computeVertexNormals();
  return geo;
}

export type PinState = { t: number; position: THREE.Vector3 };

/** Listing pins spread over real district centres, coloured by material. */
export function createListingPins(count: number, shadows: boolean) {
  const rand = mulberry32(31);
  const districts = PROVINCES.flatMap((p) => p.districts);
  const pins: PinState[] = [];
  const mesh = new THREE.InstancedMesh(
    pinGeometry(),
    new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    count,
  );
  mesh.castShadow = shadows;
  mesh.frustumCulled = false;
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const d = districts[i % districts.length];
    const p = project(d.center.lng + (rand() - 0.5) * 0.22, d.center.lat + (rand() - 0.5) * 0.22);
    pins.push({ t: 0, position: p });
    mesh.setColorAt(i, color.set(MATERIALS[i % MATERIALS.length].color));
  }
  mesh.instanceColor!.needsUpdate = true;

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  const update = () => {
    pins.forEach((pin, i) => {
      // falls from above; hidden until its drop starts
      pos.copy(pin.position).setY((1 - pin.t) * 3.2);
      s.setScalar(pin.t <= 0 ? 0.0001 : Math.min(1, pin.t * 3));
      mesh.setMatrixAt(i, m.compose(pos, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  update();
  return { mesh, pins, update };
}

export function createSolidPin(color: string, scale: number, emissive = 0.35) {
  return new THREE.Mesh(
    pinGeometry(scale),
    new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.25, clearcoat: 1 }),
  );
}

/** Expanding ring (radar pulse / pickup burst). Lies flat on the map. */
export function createRing(color: string) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

// ─── Route between collector and seller ──────────────────────────────────────

export function createRoute(from: THREE.Vector3, to: THREE.Vector3, height = 1.1, radius = 0.022) {
  const mid = from.clone().lerp(to, 0.5).setY(height);
  const curve = new THREE.QuadraticBezierCurve3(from.clone().setY(0.05), mid, to.clone().setY(0.05));
  const geo = new THREE.TubeGeometry(curve, 96, radius, 8, false);
  const total = geo.index!.count;
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: HOW_COLORS.route, toneMapped: false, transparent: true }),
  );
  geo.setDrawRange(0, 0);
  /** reveal the tube from `from` to `to` */
  const setProgress = (p: number) => {
    const count = Math.floor((total * Math.min(1, Math.max(0, p))) / 6) * 6; // whole triangles
    geo.setDrawRange(0, count);
    mesh.visible = count > 0;
  };
  return { mesh, curve, setProgress };
}

// ─── Chat bubbles (sprites with canvas text) ─────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function createBubble(text: string, opts: { bg: string; fg: string; tail: "left" | "right"; icon?: "check" }) {
  const scale = 2;
  const ctx0 = document.createElement("canvas").getContext("2d")!;
  ctx0.font = `600 ${30 * scale}px system-ui, sans-serif`;
  const pad = 26 * scale;
  const iconW = opts.icon ? 44 * scale : 0;
  const w = Math.ceil(ctx0.measureText(text).width + pad * 2 + iconW);
  const h = 84 * scale;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h + 18 * scale;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = opts.bg;
  roundRect(ctx, 0, 0, w, h, 30 * scale);
  ctx.fill();
  // tail
  const tx = opts.tail === "left" ? 40 * scale : w - 40 * scale;
  ctx.beginPath();
  ctx.moveTo(tx - 14 * scale, h - 2);
  ctx.lineTo(tx + (opts.tail === "left" ? -6 : 6) * scale, h + 16 * scale);
  ctx.lineTo(tx + 14 * scale, h - 2);
  ctx.fill();
  if (opts.icon === "check") {
    ctx.strokeStyle = opts.fg;
    ctx.lineWidth = 7 * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pad, h / 2);
    ctx.lineTo(pad + 12 * scale, h / 2 + 12 * scale);
    ctx.lineTo(pad + 32 * scale, h / 2 - 12 * scale);
    ctx.stroke();
  }
  ctx.fillStyle = opts.fg;
  ctx.font = `600 ${30 * scale}px system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad + iconW, h / 2 + 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // colour < 1 keeps white bubbles under the bloom threshold
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0.82, 0.82, 0.82), transparent: true, opacity: 0, depthTest: false, toneMapped: false }),
  );
  const worldH = 0.34;
  sprite.scale.set((worldH * c.width) / c.height, worldH, 1);
  sprite.center.set(opts.tail === "left" ? 0.1 : 0.9, 0); // anchor at the tail
  sprite.renderOrder = 10;
  return sprite;
}

// ─── Phone ───────────────────────────────────────────────────────────────────

const SCREEN_W = 540, SCREEN_H = 1140;

function screenCanvas() {
  const c = document.createElement("canvas");
  c.width = SCREEN_W;
  c.height = SCREEN_H;
  return [c, c.getContext("2d")!] as const;
}

/** A little "photo" of glass bottles drawn in 2D, shared by viewfinder and listing. */
function drawBottlesPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dim = 1) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, `rgba(36,52,44,${dim})`);
  g.addColorStop(1, `rgba(12,18,15,${dim})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const bottles = [
    { cx: 0.32, color: "#9a5a1c", s: 1 },
    { cx: 0.52, color: "#2f6b3a", s: 1.12 },
    { cx: 0.7, color: "#cfe6d8", s: 0.92 },
  ];
  for (const b of bottles) {
    const bw = w * 0.15 * b.s, bh = h * 0.62 * b.s;
    const bx = x + w * b.cx - bw / 2, by = y + h * 0.88 - bh;
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.85 * dim;
    ctx.beginPath();
    ctx.roundRect(bx, by + bh * 0.38, bw, bh * 0.62, bw * 0.18);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.1, by + bh * 0.4);
    ctx.quadraticCurveTo(bx + bw * 0.3, by + bh * 0.2, bx + bw * 0.36, by);
    ctx.lineTo(bx + bw * 0.64, by);
    ctx.quadraticCurveTo(bx + bw * 0.7, by + bh * 0.2, bx + bw * 0.9, by + bh * 0.4);
    ctx.fill();
    ctx.globalAlpha = 0.35 * dim;
    ctx.fillStyle = "#fff";
    ctx.fillRect(bx + bw * 0.18, by + bh * 0.45, bw * 0.1, bh * 0.45); // highlight
    ctx.globalAlpha = 1;
  }
}

function statusBar(ctx: CanvasRenderingContext2D, color = "#fff") {
  ctx.fillStyle = color;
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("9:41", 48, 60);
  ctx.fillRect(SCREEN_W - 110, 42, 50, 22);
}

function drawCamera() {
  const [c, ctx] = screenCanvas();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawBottlesPhoto(ctx, 0, 150, SCREEN_W, 760);
  statusBar(ctx);
  // focus brackets
  ctx.strokeStyle = "#ffd60a";
  ctx.lineWidth = 5;
  const bx = 110, by = 330, bw = 320, bh = 420, l = 46;
  for (const [x, y, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * l, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * l);
    ctx.stroke();
  }
  // detected chip
  ctx.fillStyle = "rgba(20,163,154,0.9)";
  ctx.beginPath();
  ctx.roundRect(SCREEN_W / 2 - 120, 200, 240, 54, 27);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Glass · detected", SCREEN_W / 2, 236);
  // shutter
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(SCREEN_W / 2, 1010, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(SCREEN_W / 2, 1010, 52, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

function drawListing(live: boolean) {
  const [c, ctx] = screenCanvas();
  ctx.fillStyle = "#f6faf5";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  statusBar(ctx, "#1a2a22");
  ctx.fillStyle = "#1a2a22";
  ctx.font = "800 44px system-ui, sans-serif";
  ctx.fillText("Post your waste", 44, 150);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(44, 190, SCREEN_W - 88, 360, 28);
  ctx.clip();
  drawBottlesPhoto(ctx, 44, 190, SCREEN_W - 88, 360);
  ctx.restore();

  const chip = (x: number, y: number, label: string, bg: string, fg: string) => {
    ctx.font = "600 26px system-ui, sans-serif";
    const w = ctx.measureText(label).width + 44;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 50, 25);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(label, x + 22, y + 34);
    return w;
  };
  let x = 44;
  x += chip(x, 584, "Glass", "#14a39a", "#fff") + 12;
  chip(x, 584, "18 kg", "#e3efe6", "#1a2a22");

  ctx.fillStyle = "#1a2a22";
  ctx.font = "700 36px system-ui, sans-serif";
  ctx.fillText("Arrack & beer bottles", 44, 690);
  ctx.fillStyle = "#5b6e64";
  ctx.font = "500 27px system-ui, sans-serif";
  ctx.fillText("Pickup  ·  Sat 9:00 – 12:00", 44, 744);
  ctx.fillText("Near Colombo, Western Province", 44, 790);

  // publish button / live state
  ctx.fillStyle = live ? "#e3f7ea" : "#2f7a4f";
  ctx.beginPath();
  ctx.roundRect(44, 920, SCREEN_W - 88, 100, 26);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.fillStyle = live ? "#1f7a45" : "#fff";
  ctx.fillText(live ? "✓  Your listing is live" : "Publish listing", SCREEN_W / 2, 982);

  if (live) {
    ctx.fillStyle = "#3ddc84";
    ctx.beginPath();
    ctx.arc(SCREEN_W / 2, 370, 86, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0b2a18";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(SCREEN_W / 2 - 38, 372);
    ctx.lineTo(SCREEN_W / 2 - 8, 402);
    ctx.lineTo(SCREEN_W / 2 + 42, 340);
    ctx.stroke();
  }
  return c;
}

export function createPhone() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(1.5, 3.08, 0.15, 8, 0.2),
    new THREE.MeshPhysicalMaterial({ color: HOW_COLORS.phone, metalness: 0.7, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }),
  );
  body.castShadow = true;
  group.add(body);

  const textures = [drawCamera(), drawListing(false), drawListing(true)].map((c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: textures[0], toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.86) });
  const screen = new THREE.Mesh(new RoundedPlane(1.36, 2.92, 0.15), screenMat);
  screen.position.z = 0.0765;
  group.add(screen);

  // white flash overlay for the "photo taken" moment
  const flash = new THREE.Mesh(
    new RoundedPlane(1.36, 2.92, 0.15),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, toneMapped: false }),
  );
  flash.position.z = 0.078;
  group.add(flash);

  return {
    group,
    setScreen(mode: number) {
      const tex = textures[Math.max(0, Math.min(2, Math.round(mode)))];
      if (screenMat.map !== tex) screenMat.map = tex;
    },
    setFlash(v: number) {
      flash.material.opacity = v;
    },
    textures,
  };
}

/** Flat rounded rectangle with 0..1 UVs (for the phone screen). */
class RoundedPlane extends THREE.ShapeGeometry {
  constructor(w: number, h: number, r: number) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    super(s, 12);
    const uv = this.attributes.uv, pos = this.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  }
}

// ─── The photographed subject ────────────────────────────────────────────────

export function createBottleCluster(transmission: boolean) {
  const group = new THREE.Group();
  const geo = glassBottle();
  const specs = [
    { color: "#9a5a1c", x: -0.42, z: 0.1, s: 1.25, rz: 0 },
    { color: "#2f6b3a", x: 0.05, z: -0.15, s: 1.45, rz: 0 },
    { color: "#dfe9e4", x: 0.5, z: 0.15, s: 1.15, rz: 0 },
    { color: "#9a5a1c", x: 0.1, z: 0.55, s: 1.2, rz: Math.PI / 2 - 0.15 }, // one lying down
  ];
  for (const sp of specs) {
    const mat = new THREE.MeshPhysicalMaterial(
      transmission
        ? // partly diffuse + coloured attenuation so the glass still reads against the dark studio
          { color: sp.color, roughness: 0.1, transmission: 0.72, thickness: 0.6, ior: 1.52, attenuationColor: new THREE.Color(sp.color), attenuationDistance: 0.6, clearcoat: 1, clearcoatRoughness: 0.05, emissive: sp.color, emissiveIntensity: 0.12 }
        : { color: sp.color, roughness: 0.1, transparent: true, opacity: 0.7, clearcoat: 1 },
    );
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(sp.s);
    m.position.set(sp.x, sp.rz ? 0.12 : sp.s / 2, sp.z);
    m.rotation.z = sp.rz;
    m.castShadow = true;
    group.add(m);
  }
  return group;
}
