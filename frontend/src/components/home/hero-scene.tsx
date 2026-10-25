"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { MATERIALS } from "@/lib/materials";

/**
 * Floating "waste" objects — bottles, cans, boxes, chips — drifting in the
 * material colours used on the map. Pure three.js, no React renderer.
 */
export function HeroScene({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b8f71, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(5, 8, 6);
    scene.add(sun);

    // Bottle profile, revolved
    const bottlePts = [
      [0, -1.2], [0.42, -1.2], [0.48, -1.1], [0.48, 0.25], [0.3, 0.6], [0.17, 0.75], [0.17, 1.15], [0.2, 1.2], [0, 1.2],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const geometries = [
      new THREE.LatheGeometry(bottlePts, 24),
      new THREE.CylinderGeometry(0.42, 0.42, 1.2, 24),
      new THREE.BoxGeometry(1.3, 0.9, 0.9),
      new THREE.IcosahedronGeometry(0.6, 0),
      new THREE.TorusGeometry(0.45, 0.16, 12, 28),
    ];

    const group = new THREE.Group();
    scene.add(group);
    const items: { mesh: THREE.Mesh; speed: THREE.Vector3; phase: number; baseY: number }[] = [];

    const count = window.innerWidth < 640 ? 10 : 16;
    for (let i = 0; i < count; i++) {
      const m = MATERIALS[i % MATERIALS.length];
      const geo = geometries[i % geometries.length];
      const isGlass = m.id === "glass" || (geo === geometries[0] && i % 2 === 0);
      const mat = new THREE.MeshPhysicalMaterial({
        color: m.color,
        roughness: isGlass ? 0.1 : 0.45,
        metalness: m.id === "metal" ? 0.7 : 0.05,
        transmission: isGlass ? 0.6 : 0,
        thickness: 0.5,
        clearcoat: 0.6,
        flatShading: geo === geometries[3],
      });
      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i / count) * Math.PI * 2;
      const radius = 3.2 + (i % 3) * 1.4;
      mesh.position.set(Math.cos(angle) * radius * 1.3, Math.sin(angle) * radius * 0.6, -((i * 7) % 5));
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      const s = 0.7 + ((i * 13) % 7) / 10;
      mesh.scale.setScalar(s);
      group.add(mesh);
      items.push({
        mesh,
        speed: new THREE.Vector3(0.2 + Math.random() * 0.3, 0.15 + Math.random() * 0.3, 0.1),
        phase: Math.random() * Math.PI * 2,
        baseY: mesh.position.y,
      });
    }

    const pointer = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Pull back on narrow screens so the ring of objects still frames the headline
      camera.position.z = w < 640 ? 19 : 14;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(host);

    const timer = new THREE.Timer();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      timer.update();
      const t = timer.getElapsed();
      for (const it of items) {
        it.mesh.rotation.x += it.speed.x * 0.01;
        it.mesh.rotation.y += it.speed.y * 0.01;
        it.mesh.position.y = it.baseY + Math.sin(t * 0.6 + it.phase) * 0.25;
      }
      group.rotation.z = t * 0.03;
      group.rotation.y += (pointer.x * 0.25 - group.rotation.y) * 0.04;
      group.rotation.x += (pointer.y * 0.15 - group.rotation.x) * 0.04;
      renderer.render(scene, camera);
    };
    if (reduceMotion) renderer.render(scene, camera);
    else tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      geometries.forEach((g) => g.dispose());
      items.forEach((it) => (it.mesh.material as THREE.Material).dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={ref} aria-hidden className={className} />;
}
