import * as THREE from "three";
import { createStage, disposeTree } from "@/components/three/stage";
import { CAMERA, type Tier } from "@/components/WasteScene/config";
import { mulberry32 } from "@/lib/noise";
import {
  COLLECTOR,
  HOW_COLORS,
  MOBILE_PHONE_POSE,
  MOBILE_SUBJECT_POSE,
  NETWORK_ROUTES,
  PHONE_POSE,
  PIN_COUNTS,
  SELLER,
  SHOTS,
  SUBJECT_POSE,
} from "./config";
import {
  createBottleCluster,
  createBubble,
  createIsland,
  createListingPins,
  createPhone,
  createRing,
  createRoute,
  createSolidPin,
  project,
} from "./objects";

/** Everything the "How it works" timeline tweens. */
export type HowState = {
  camX: number; camY: number; camZ: number;
  lookX: number; lookY: number; lookZ: number;
  phoneIn: number; // 0..1 phone + bottles rise in
  flash: number; // 0..1 camera flash
  capture: number; // 0..1 bottles fly into the phone
  screen: number; // 0 viewfinder · 1 listing form · 2 live
  toMap: number; // 0..1 phone flies down to become the seller pin
  mapIn: number; // 0..1 island rises in
  radar: number; // 0..1 radar pulse strength around the seller
  collectorIn: number;
  route: number; // 0..1 route drawn + collector travels it
  bubble1: number;
  bubble2: number;
  done: number; // 0..1 pickup burst + check
  network: number; // 0..1 finale: more handovers across the island
};

export type HowSceneApi = Awaited<ReturnType<typeof createHowScene>>;

export async function createHowScene(opts: {
  canvas: HTMLCanvasElement;
  tier: Tier;
  mobile: boolean;
  onProgress?: (f: number) => void;
}) {
  const { tier, mobile, onProgress } = opts;
  const stage = await createStage({ canvas: opts.canvas, tier, mobile, fov: 32, portraitFov: 1.5, shadowExtent: 6 });
  const { scene, camera, settings } = stage;
  const shadows = settings.shadows > 0;
  const shots = SHOTS[mobile ? "mobile" : "desktop"];
  const phonePose = mobile ? MOBILE_PHONE_POSE : PHONE_POSE;
  const subjectPose = mobile ? MOBILE_SUBJECT_POSE : SUBJECT_POSE;

  const envPromise = stage.loadEnvironment((f) => onProgress?.(f * 0.85));

  // ── step 1: phone + subject ──
  const phone = createPhone();
  scene.add(phone.group);
  const bottles = createBottleCluster(settings.transmission);
  scene.add(bottles);
  const flashLight = new THREE.PointLight("#ffffff", 0, 12, 2);
  scene.add(flashLight);

  // ── step 2: the island, listing pins, seller pin, radar ──
  const map = new THREE.Group();
  map.add(createIsland());
  const listings = createListingPins(PIN_COUNTS[tier], shadows);
  map.add(listings.mesh);
  const sellerPos = project(SELLER.lng, SELLER.lat);
  const collectorPos = project(COLLECTOR.lng, COLLECTOR.lat);
  const sellerPin = createSolidPin(HOW_COLORS.seller, 1.6, 0.5);
  sellerPin.position.copy(sellerPos);
  sellerPin.castShadow = shadows;
  map.add(sellerPin);
  const radar = [0, 1, 2].map(() => createRing(HOW_COLORS.seller));
  radar.forEach((r) => {
    r.position.copy(sellerPos).setY(0.02);
    map.add(r);
  });

  // ── step 3: collector, route, chat, pickup ──
  const collectorPin = createSolidPin(HOW_COLORS.collector, 1.4, 0.45);
  collectorPin.castShadow = shadows;
  map.add(collectorPin);
  const route = createRoute(collectorPos, sellerPos);
  map.add(route.mesh);
  const courier = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 20, 14),
    new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
  );
  map.add(courier);
  const bubble1 = createBubble("Hi! Are the bottles still available?", { bg: HOW_COLORS.whatsapp, fg: "#062b14", tail: "right" });
  const bubble2 = createBubble("Yes! Come by 10am", { bg: "#ffffff", fg: "#1a2a22", tail: "right" });
  const doneBubble = createBubble("Picked up · 18 kg saved", { bg: HOW_COLORS.seller, fg: "#062b14", tail: "right", icon: "check" });
  // both bubbles grow leftwards (towards open space) and are stacked so they never overlap
  bubble1.position.copy(collectorPos).add(new THREE.Vector3(0.05, 1.35, 0));
  bubble2.position.copy(sellerPos).add(new THREE.Vector3(0.05, 0.8, 0));
  doneBubble.position.copy(sellerPos).add(new THREE.Vector3(-0.1, 0.85, 0));
  map.add(bubble1, bubble2, doneBubble);
  const burst = createRing(HOW_COLORS.seller);
  burst.position.copy(sellerPos).setY(0.03);
  map.add(burst);

  // ── finale: more handovers light up across the island ──
  const rand = mulberry32(5);
  const network = Array.from({ length: NETWORK_ROUTES }, (_, i) => {
    const a = listings.pins[Math.floor(rand() * listings.pins.length)].position;
    let b = listings.pins[Math.floor(rand() * listings.pins.length)].position;
    if (a.distanceTo(b) < 0.8) b = listings.pins[(i * 7 + 3) % listings.pins.length].position;
    const r = createRoute(a, b, 0.5 + a.distanceTo(b) * 0.35, 0.014);
    map.add(r.mesh);
    return { ...r, offset: i / NETWORK_ROUTES };
  });

  scene.add(map);

  // soft shadow catcher under the map
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.3 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = -0.4;
  catcher.receiveShadow = true;
  catcher.visible = shadows;
  map.add(catcher);

  // ── state ──
  const s1 = shots.step1;
  const state: HowState = {
    camX: s1.cam[0], camY: s1.cam[1], camZ: s1.cam[2],
    lookX: s1.look[0], lookY: s1.look[1], lookZ: s1.look[2],
    phoneIn: 0, flash: 0, capture: 0, screen: 0, toMap: 0, mapIn: 0,
    radar: 0, collectorIn: 0, route: 0, bubble1: 0, bubble2: 0, done: 0, network: 0,
  };

  // ── per frame ──
  const look = new THREE.Vector3();
  const phoneHome = new THREE.Vector3(...phonePose.position);
  const subjectHome = new THREE.Vector3(...subjectPose.position);
  const phoneTarget = sellerPos.clone().setY(0.6);
  const tmp = new THREE.Vector3();
  const qUpright = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, phonePose.rotationY, 0));
  const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const ease = (t: number) => t * t * (3 - 2 * t);
  const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

  stage.setFocus(() => camera.position.distanceTo(look));
  stage.setFrame(({ time, pointer }) => {
    // camera (parallax shrinks once we're looking down at the map)
    const par = 1 - state.mapIn * 0.6;
    camera.position.set(
      state.camX + pointer.x * CAMERA.parallax.x * par,
      state.camY - pointer.y * CAMERA.parallax.y * par,
      state.camZ,
    );
    look.set(state.lookX, state.lookY, state.lookZ);
    camera.lookAt(look);

    // phone: rises in, idles, then flies to the seller's spot and shrinks into the pin
    const tm = ease(state.toMap);
    phone.group.visible = state.phoneIn > 0.001 && tm < 0.98;
    tmp.copy(phoneHome).setY(phoneHome.y - (1 - ease(state.phoneIn)) * 2.5 + Math.sin(time * 0.8) * 0.05 * (1 - tm));
    phone.group.position.copy(tmp).lerp(phoneTarget, tm);
    phone.group.quaternion.slerpQuaternions(qUpright, qFlat, tm);
    phone.group.rotateY(Math.sin(time * 0.5) * 0.04 * (1 - tm));
    phone.group.scale.setScalar(Math.max(0.001, (0.6 + 0.4 * ease(state.phoneIn)) * (1 - tm * 0.92)));
    phone.setScreen(state.screen);
    phone.setFlash(state.flash);
    flashLight.position.copy(phone.group.position).add(new THREE.Vector3(0.6, 0.3, -0.6));
    flashLight.intensity = state.flash * 60;

    // bottles: appear with the phone, then get "captured" into it
    const cap = ease(state.capture);
    bottles.visible = state.phoneIn > 0.001 && cap < 0.99;
    bottles.position.copy(subjectHome).lerp(phone.group.position, cap);
    bottles.position.y -= (1 - ease(state.phoneIn)) * 1.5;
    bottles.scale.setScalar(Math.max(0.001, 1 - cap));
    bottles.rotation.y = time * 0.15 + cap * 3;

    // map rises in from below
    map.visible = state.mapIn > 0.001;
    map.position.y = -(1 - ease(state.mapIn)) * 4;
    listings.update();

    // seller pin appears exactly where the phone lands
    const sellerS = clamp01((state.toMap - 0.85) / 0.15);
    sellerPin.scale.setScalar(Math.max(0.001, ease(sellerS)));
    sellerPin.rotation.y = time * 0.8;

    radar.forEach((r, i) => {
      const phase = (time * 0.45 + i / radar.length) % 1;
      r.scale.setScalar(0.15 + phase * 1.6);
      r.material.opacity = (1 - phase) * 0.6 * state.radar;
      r.visible = state.radar > 0.001;
    });

    // collector + route + chat
    const cIn = ease(state.collectorIn);
    route.curve.getPoint(clamp01(state.route), tmp);
    collectorPin.position.copy(collectorPos).setY((1 - cIn) * 2.5);
    collectorPin.scale.setScalar(Math.max(0.001, cIn));
    route.setProgress(state.route);
    courier.visible = state.route > 0.001 && state.route < 0.999;
    courier.position.copy(tmp);
    courier.scale.setScalar(1 + Math.sin(time * 8) * 0.15);
    const pop = (sprite: THREE.Sprite, v: number, base: number) => {
      sprite.material.opacity = v;
      sprite.visible = v > 0.001;
      const k = base * (0.7 + 0.3 * ease(v));
      sprite.scale.set((sprite.scale.x / sprite.scale.y) * k, k, 1);
    };
    pop(bubble1, state.bubble1 * (1 - state.done), 0.34);
    pop(bubble2, state.bubble2 * (1 - state.done), 0.34);
    pop(doneBubble, state.done * (1 - state.network), 0.38);
    burst.visible = state.done > 0.001 && state.done < 0.999;
    burst.scale.setScalar(0.2 + state.done * 2.4);
    burst.material.opacity = (1 - state.done) * 0.9;

    // finale network
    for (const r of network) r.setProgress((state.network - r.offset * 0.6) / 0.4);
  });

  stage.track({ dispose: () => disposeTree(scene) });
  phone.textures.forEach((t) => stage.track(t)); // only one is attached at a time

  await envPromise;
  onProgress?.(0.9);
  await stage.compile();
  onProgress?.(1);

  return {
    state,
    pins: listings.pins,
    shots,
    renderOnce: stage.renderOnce,
    dispose: stage.dispose,
  };
}
