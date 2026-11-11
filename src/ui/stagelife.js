// 무대 생물과 움직이는 장식(arena3d.js 가 매 프레임 update 를 부른다). 모두 블록풍 작은 상자, 같은 모양은 InstancedMesh 하나로.
// 싸움을 가리지 않게 동물 뒤쪽·양옆에서 천천히 움직인다. 크기와 자리는 카메라 거리(d)에 맞춰서, 확대해도 화면에서 늘 비슷한 크기.
// update(t 초, dt, { target 카메라가 보는 곳, d 카메라 거리, visH 보이는 높이, aspect, impact 세게 부딪힌 자리(없으면 null), movers 싸우는 둘 [{ center, speed, swim }] })
import * as THREE from 'three';
import { UNDERWATER as UW, LIFE } from '../config.js';

const GEO = new THREE.BoxGeometry(1, 1, 1), V3 = THREE.Vector3;
const o = new THREE.Object3D(), tmp = new V3();
const inst = (n, mat) => { const m = new THREE.InstancedMesh(GEO, mat, n); m.frustumCulled = false; m.count = 0; return m; };
const put = (m, i, p, [w, h, dd], ry = 0, rz = 0, rx = 0) => { o.position.copy(p); o.scale.set(w, h, dd); o.rotation.set(rx, ry, rz); o.updateMatrix(); m.setMatrixAt(i, o.matrix); };
const lit = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, ...extra });

export function stageLife(stage, scene, rnd, V) {
  if (stage === 'underwater') return underwater(scene, rnd);
  return { waterside, jungle, grassland }[stage]?.(scene, rnd, V) ?? null;
}

// 흔들리는 장식: userData.sway(상자 목록 [x, y, z, w, h, d, ry, 마디, 기울기])가 있는 InstancedMesh.
// 마디: 해초처럼 위 마디일수록 옆으로 크게 밀린다. 기울기: 풀·갈대처럼 밑동을 축으로 바람에 기운다
function swayer(scene) {
  const list = [];
  scene.traverse(m => m.userData.sway && list.push(m));
  return t => list.forEach(m => {
    m.userData.sway.forEach(([x, y, z, w, h, d, ry, j = 0, tilt = 0], i) => {
      const wave = Math.sin(t * 1.4 + x * 0.05 + z * 0.03), a = wave * 0.2 * tilt;
      put(m, i, tmp.set(x + wave * j * w * 0.35 - Math.sin(a) * h * 0.5, y - (1 - Math.cos(a)) * h * 0.5, z), [w, h, d], ry, a);
    });
    m.instanceMatrix.needsUpdate = true;
  });
}

// ── 물속: 물고기 떼, 보글보글 물방울, 빛줄기, 흔들리는 해초, 해파리 ──
function underwater(scene, rnd) {
  const sway = swayer(scene);
  // 물고기: 몸 + 꼬리 + 눈 둘. 노랑·주황·하늘색이 섞인 떼
  const COLORS = ['#ffc23a', '#ff9a3a', '#7fd3ff', '#ffe06a'];
  const body = inst(UW.FISH, lit('#ffffff')), tail = inst(UW.FISH, lit('#ffffff')), eye = inst(UW.FISH * 2, new THREE.MeshBasicMaterial({ color: '#1a1410' }));
  const fish = Array.from({ length: UW.FISH }, (_, i) => {
    const color = new THREE.Color(COLORS[i % COLORS.length]);
    body.setColorAt(i, color);
    tail.setColorAt(i, color.clone().multiplyScalar(0.8));
    return { off: new V3((rnd() - 0.5) * 2.2, (rnd() - 0.5) * 0.9, (rnd() - 0.5) * 1.4), ph: rnd() * 6, pos: new V3(), push: new V3(), face: 1, init: false };
  });
  body.count = tail.count = UW.FISH;
  eye.count = UW.FISH * 2;
  // 물방울: 모아 둔 것을 다시 쓴다. 바닥 구멍(vents)에서 줄지어, 헤엄치는 동물 뒤로, 부딪히면 한꺼번에
  const bub = inst(UW.BUBBLES, lit('#e4f8ff', { transparent: true, opacity: 0.75, roughness: 0.1, emissive: '#3a6f88' })), pool = [];
  const vents = Array.from({ length: UW.VENTS }, () => ({ x: rnd() * 2 - 1, z: 0.08 + rnd() * 0.25, next: rnd() * 2 }));
  const emit = (p, k = 1) => { if (pool.length < UW.BUBBLES) pool.push({ p: p.clone(), r: (0.5 + rnd() * 0.7) * k, life: 2.5 + rnd() * 2, ph: rnd() * 6, up: 0.8 + rnd() * 0.5 }); };
  // 빛줄기: 위에서 비스듬히 내려오는 흐린 빛 기둥(더해지는 빛이라 겹쳐도 어두워지지 않는다)
  const rays = Array.from({ length: UW.RAYS }, (_, i) => {
    const m = new THREE.Mesh(GEO, new THREE.MeshBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    scene.add(m);
    return { m, x: (UW.RAYS > 1 ? (i / (UW.RAYS - 1)) * 2 - 1 : 0) + (rnd() - 0.5) * 0.3, ph: rnd() * 6 };
  });
  // 해파리: 반투명 분홍 종 + 촉수 넷, 위아래로 둥둥
  const jellyMat = lit('#f7a8d8', { transparent: true, opacity: 0.7, emissive: '#5a1a40' });
  const jelly = Array.from({ length: UW.JELLY }, (_, i) => {
    const bell = new THREE.Mesh(GEO, jellyMat), g = new THREE.Group();
    bell.scale.set(1, 0.6, 1);
    g.add(bell, ...[[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].map(([x, z]) => { const t = new THREE.Mesh(GEO, jellyMat); t.scale.set(0.12, 1.1, 0.12); t.position.set(x, -0.8, z); return t; }));
    scene.add(g);
    return { g, bell, ph: rnd() * 6, x: UW.JELLY > 1 ? (i / (UW.JELLY - 1)) * 1.4 - 0.7 : 0.5 };
  });
  scene.add(body, tail, eye, bub);
  let school = null;

  return {
    update(t, dt, { target, d, visH, aspect, impact, movers }) {
      sway(t);
      const visW = visH * aspect, s = d * 0.014; // 물고기 한 마리 크기의 기준
      // 떼 가운데: 동물 뒤쪽에서 화면을 가로질러 천천히 오간다
      const goal = new V3(target.x + visW * 0.4 * Math.sin(t * 0.11), Math.max(s * 5, visH * (0.28 + 0.06 * Math.sin(t * 0.23))), target.z - d * 0.1);
      school ??= goal.clone();
      school.lerp(goal, 1 - Math.exp(-dt * 0.8));
      fish.forEach((f, i) => {
        const want = f.off.clone().multiplyScalar(s * 7).add(school).add(tmp.set(Math.sin(t * 1.3 + f.ph) * s * 1.5, Math.sin(t * 0.9 + f.ph) * s, 0));
        if (impact) { const away = f.pos.clone().sub(impact), L = away.length(); if (L < visH) f.push.addScaledVector(away.normalize(), s * 80 * (1 - L / visH)); } // 놀라서 흩어진다
        f.push.multiplyScalar(Math.exp(-dt * 1.6));
        const old = f.pos.clone();
        if (!f.init) { f.pos.copy(want); f.init = true; }
        f.pos.lerp(want, 1 - Math.exp(-dt * 1.2)).addScaledVector(f.push, dt);
        if (Math.abs(f.pos.x - old.x) > s * 0.002) f.face = Math.sign(f.pos.x - old.x);
        const ry = f.face > 0 ? 0 : Math.PI, wig = Math.sin(t * 9 + f.ph) * 0.4, fx = f.face;
        put(body, i, f.pos, [s * 2, s * 1.1, s * 0.6], ry);
        put(tail, i, tmp.copy(f.pos).add(new V3(-fx * s * 1.25, 0, 0)), [s * 0.7, s * 1.1, s * 0.15], ry + wig);
        for (const sd of [1, -1]) put(eye, i * 2 + (sd > 0 ? 0 : 1), tmp.copy(f.pos).add(new V3(fx * s * 0.6, s * 0.15, sd * s * 0.31)), [s * 0.25, s * 0.25, s * 0.05]);
      });
      body.instanceMatrix.needsUpdate = tail.instanceMatrix.needsUpdate = eye.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = tail.instanceColor.needsUpdate = true;

      // 물방울 만들기
      for (const v of vents) if ((v.next -= dt) <= 0) { v.next = 0.25 + rnd() * 0.5; emit(new V3(target.x + v.x * visW * 0.55, 0, target.z - v.z * d), 0.8); }
      for (const m of movers) if (m?.swim && m.speed > s * 3 && rnd() < dt * 10) emit(m.center.clone().add(new V3((rnd() - 0.5) * s * 4, s * 2, (rnd() - 0.5) * s * 2)));
      if (impact) for (let k = 0; k < 18; k++) emit(impact.clone().add(new V3((rnd() - 0.5) * s * 8, (rnd() - 0.5) * s * 4, (rnd() - 0.5) * s * 4)), 1.2);
      // 물방울 올라가기: 좌우로 살랑, 위로 갈수록 조금 커지고 수면 근처에서 터진다
      for (let i = pool.length - 1; i >= 0; i--) {
        const b = pool[i];
        b.life -= dt;
        b.p.y += dt * s * 5 * b.up;
        b.p.x += Math.sin(t * 3 + b.ph) * s * 0.6 * dt;
        if (b.life <= 0 || b.p.y > visH * 1.4) pool.splice(i, 1);
      }
      pool.forEach((b, i) => { const k = s * 0.45 * b.r * (1 + 0.25 * Math.min(1, b.p.y / visH)); put(bub, i, b.p, [k, k, k], t * 0.5 + b.ph, t * 0.4); });
      bub.count = pool.length;
      bub.instanceMatrix.needsUpdate = true;

      // 빛줄기: 천천히 흔들리고 밝기가 숨 쉬듯
      for (const r of rays) {
        r.m.position.set(target.x + r.x * visW * 0.55, visH * 0.75, target.z - d * 0.28);
        r.m.scale.set(s * 7, visH * 1.8, s * 2);
        r.m.rotation.set(0, 0, -0.35 + 0.06 * Math.sin(t * 0.3 + r.ph));
        r.m.material.opacity = 0.06 + 0.035 * Math.sin(t * 0.5 + r.ph);
      }
      // 해파리: 종이 오므렸다 폈다 하며 둥둥
      for (const j of jelly) {
        j.g.position.set(target.x + j.x * visW * 0.42 + Math.sin(t * 0.1 + j.ph) * visW * 0.05, visH * (0.36 + 0.05 * Math.sin(t * 0.6 + j.ph)), target.z - d * 0.16);
        j.g.scale.setScalar(s * 3);
        j.bell.scale.set(1 - 0.12 * Math.sin(t * 2.4 + j.ph), 0.6 * (1 + 0.15 * Math.sin(t * 2.4 + j.ph)), 1 - 0.12 * Math.sin(t * 2.4 + j.ph));
      }
    },
  };
}

// ── 공통 도구 ──
const colorTmp = new THREE.Color();
// 하늘막 앞 구름 판을 옆으로 천천히 흘린다(arena3d 의 'clouds')
function cloudDrift(scene) { const c = scene.getObjectByName('clouds'); return t => c && (c.material.map.offset.x = t * 0.004); }
// 조각(나뭇잎·씨앗·물보라): 모아 두고 다시 쓴다. move(q, dt, t)가 움직이고, 수명 끝 무렵 작아지며 사라진다
function bits(scene, max, mat, shape = [1, 1, 1]) {
  const m = inst(max, mat), pool = [];
  scene.add(m);
  return {
    pool,
    emit(p, v, opt = {}) { if (pool.length < max) pool.push({ p: p.clone(), v: v.clone(), age: 0, life: 3, size: 1, spin: 1, ph: Math.random() * 6, ...opt }); },
    step(dt, t, move, s) {
      for (let i = pool.length - 1; i >= 0; i--) { const q = pool[i]; q.age += dt; if (q.age > q.life) pool.splice(i, 1); else move(q, dt, t); }
      pool.forEach((q, i) => {
        const k = s * q.size * Math.min(1, (q.life - q.age) * 3), a = q.ph + t * q.spin;
        put(m, i, q.p, shape.map(v => v * k), a, a * 0.7, q.ph * 2);
        if (q.color) m.setColorAt(i, colorTmp.set(q.color));
      });
      m.count = pool.length;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    },
  };
}
// 놀라면 밀려났다가 돌아오는 힘: 부딪힌 자리에서 멀어지는 쪽으로
function scare(f, impact, visH, k, dt) {
  if (impact) { const a = f.pos.clone().sub(impact), L = a.length(); if (L < visH) f.push.addScaledVector(a.normalize(), k * (1 - L / visH)); }
  f.push.multiplyScalar(Math.exp(-dt * 1.4));
}
// 날아다니는 작은 것(나비·잠자리·반딧불이): 몸 + 날개 둘(어깨를 축으로 퍼덕). 동물 뒤쪽 자리(화면 비율 hx·hy·hz)를 맴돈다
// dart: 잠자리처럼 멈췄다 휙 옮겨 가기, glow: 반딧불이처럼 빛나며 깜빡(날개 없음)
function flyers(scene, n, rnd, { colors, body = '#2e2620', glow = false, wing = [0.9, 0.06, 0.9], dart = false, flap = 16 }) {
  const B = inst(n, glow ? new THREE.MeshBasicMaterial({ color: body }) : lit(body)), W = inst(n * 2, lit('#ffffff'));
  B.count = n;
  W.count = glow ? 0 : n * 2;
  scene.add(B, W);
  const list = Array.from({ length: n }, (_, i) => {
    for (const k of [0, 1]) W.setColorAt(i * 2 + k, colorTmp.set(colors[i % colors.length]));
    return { hx: rnd() * 2 - 1, hy: 0.08 + rnd() * 0.25, hz: 0.04 + rnd() * 0.16, ph: rnd() * 6, pos: new V3(), push: new V3(), init: false, next: rnd() * 2, face: 1 };
  });
  return (t, dt, { target, d, visH, impact }, s, visW) => {
    list.forEach((f, i) => {
      if (dart && (f.next -= dt) <= 0) { f.next = 1 + rnd() * 2.5; f.hx = rnd() * 2 - 1; f.hy = 0.08 + rnd() * 0.22; }
      const goal = new V3(target.x + f.hx * visW * 0.5 + Math.sin(t * 0.5 + f.ph) * s * 6, f.hy * visH + Math.sin(t * (dart ? 2 : 1.7) + f.ph) * s * (dart ? 0.5 : 2.5), target.z - f.hz * d);
      scare(f, impact, visH, s * 90, dt);
      const old = f.pos.clone();
      if (!f.init) { f.pos.copy(goal); f.init = true; }
      f.pos.lerp(goal, 1 - Math.exp(-dt * (dart ? 3 : 0.9))).addScaledVector(f.push, dt);
      if (Math.abs(f.pos.x - old.x) > s * 0.003) f.face = Math.sign(f.pos.x - old.x);
      const ry = f.face > 0 ? 0 : Math.PI, k = glow ? 0.55 + 0.45 * Math.sin(t * 2 + f.ph) : 1;
      put(B, i, f.pos, glow ? [s * 0.5 * k, s * 0.5 * k, s * 0.5 * k] : [s * 1.2, s * 0.3, s * 0.3], ry);
      if (glow) return;
      const fl = 0.9 * Math.sin(t * flap + f.ph), hw = (wing[2] * s) / 2;
      for (const sd of [1, -1]) put(W, i * 2 + (sd > 0 ? 0 : 1), tmp.copy(f.pos).add(new V3(0, hw * Math.sin(fl), sd * (s * 0.15 + hw * Math.cos(fl)))), wing.map(v => v * s), ry, 0, -sd * fl);
    });
    B.instanceMatrix.needsUpdate = W.instanceMatrix.needsUpdate = true;
    if (W.instanceColor) W.instanceColor.needsUpdate = true;
  };
}
// 하늘을 지나가는 작은 익룡 무리: V자로 period 초마다 한 번 화면을 가로지른다
function pteroFlock(scene, n, rnd, period, color = '#6a564a') {
  const B = inst(n * 2, lit(color)), W = inst(n * 2, lit(color));
  B.count = W.count = n * 2;
  scene.add(B, W);
  const start = rnd() * period, dir = rnd() < 0.5 ? 1 : -1;
  return (t, dt, { target, d, visH }, s, visW) => {
    const u = (((t + start) % period) / period) * 1.6 - 0.3; // 0~1 동안 지나가고 나머지는 화면 밖에서 쉰다
    const bs = s * 1.3;
    for (let i = 0; i < n; i++) {
      const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1), p = new V3(target.x + dir * (u * 2.4 - 1.2) * visW * 0.6 - dir * Math.abs(k) * bs * 3, visH * 0.46 + Math.abs(k) * bs * 0.6 + Math.sin(t * 1.2 + i) * bs * 0.3, target.z - d * 0.24 + k * bs * 2);
      const ry = dir > 0 ? 0 : Math.PI, fl = 0.6 * Math.sin(t * 5 + i);
      put(B, i * 2, p, [bs * 1.4, bs * 0.3, bs * 0.35], ry);
      put(B, i * 2 + 1, tmp.copy(p).add(new V3(dir * bs * 1.1, bs * 0.1, 0)), [bs * 1.1, bs * 0.15, bs * 0.15], ry, dir * 0.15); // 긴 부리
      for (const sd of [1, -1]) put(W, i * 2 + (sd > 0 ? 0 : 1), tmp.copy(p).add(new V3(0, bs * 1.1 * Math.sin(fl), sd * bs * 1.1 * Math.cos(fl))), [bs * 0.8, bs * 0.08, bs * 2.2], ry, 0, -sd * fl);
    }
    B.instanceMatrix.needsUpdate = W.instanceMatrix.needsUpdate = true;
  };
}

// ── 물가: 반짝이는 물결, 발밑 물결 고리, 첨벙 물보라, 잠자리, 갈대 흔들림, 튀어 오르는 물고기 ──
function waterside(scene, rnd, V) {
  const sway = swayer(scene), drift = cloudDrift(scene), L = LIFE.waterside, wy = 0.015 * V + 0.02;
  const spark = inst(L.SPARKLE, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
  spark.count = L.SPARKLE;
  const sp = Array.from({ length: L.SPARKLE }, () => [rnd() * 2 - 1, rnd() * 1.4 - 0.3, rnd() * 6, 0.6 + rnd()]);
  const ring = inst(L.RIPPLE * 4, new THREE.MeshBasicMaterial({ color: '#eefaff', transparent: true, opacity: 0.75 })), rings = [];
  const splash = bits(scene, L.SPLASH, lit('#e4f6ff', { emissive: '#3a6a88' }));
  const dfly = flyers(scene, L.DRAGONFLY, rnd, { colors: ['#a8dcff', '#c8ecff'], body: '#2a6a9a', wing: [0.45, 0.04, 1.4], dart: true, flap: 40 });
  const fishMat = lit('#8fb4c4'), fishB = new THREE.Mesh(GEO, fishMat), fishT = new THREE.Mesh(GEO, fishMat), fish = new THREE.Group();
  fish.add(fishB, fishT);
  fish.visible = false;
  scene.add(spark, ring, fish);
  const jump = { wait: 2 + rnd() * 3, u: -1, x: 0, z: 0, dir: 1 }, lastRing = [-9, -9];
  const splashAt = (x, z, n, k, s) => {
    for (let i = 0; i < n; i++) splash.emit(new V3(x, wy, z), new V3((rnd() - 0.5) * s * 14 * k, s * (8 + rnd() * 10) * k, (rnd() - 0.5) * s * 10 * k), { life: 1.2, size: 0.5 + rnd() * 0.5 });
    rings.push({ x, z, age: 0, life: 1.6, r0: s * 1.5 * k, big: k });
  };
  return {
    update(t, dt, ctx) {
      sway(t);
      drift(t);
      const { target, d, visH, aspect, impact, movers } = ctx, s = d * 0.012, visW = visH * aspect;
      // 물 위 반짝임: 짧은 흰 줄이 반짝 나타났다 사라진다(물은 싸우는 자리 바로 뒤부터 앞쪽)
      sp.forEach(([fx, fz, ph, sv], i) => {
        const tw = Math.pow(Math.max(0, Math.sin(t * sv * 1.5 + ph)), 6);
        put(spark, i, tmp.set(target.x + fx * visW * 0.6 + Math.sin(t * 0.2 + ph) * s * 3, wy + 0.01, Math.max(-1.05 * V, target.z + fz * d * 0.5)), [s * 0.9 * tw + 1e-4, s * 0.03, s * 0.2 * tw + 1e-4]);
      });
      spark.instanceMatrix.needsUpdate = true;
      // 물결 고리: 물을 걷거나 헤엄치면 발밑에서 퍼진다. 세게 부딪히면 크게 + 물보라
      movers.forEach((m, k) => { if (m && m.speed > s * 2 && t - lastRing[k] > 0.35) { lastRing[k] = t; rings.push({ x: m.center.x, z: m.center.z, age: 0, life: 1.4, r0: s * 1.5, big: 1 }); } });
      if (impact) splashAt(impact.x, impact.z, 26, 1.4, s);
      for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].age += dt) > rings[i].life || rings.length > L.RIPPLE) rings.splice(i, 1);
      rings.forEach((g, i) => {
        const u = g.age / g.life, r = g.r0 + u * s * 7 * g.big, th = s * 0.3 * (1 - u) + 1e-4;
        put(ring, i * 4, tmp.set(g.x + r, wy, g.z), [th, s * 0.03, 2 * r]);
        put(ring, i * 4 + 1, tmp.set(g.x - r, wy, g.z), [th, s * 0.03, 2 * r]);
        put(ring, i * 4 + 2, tmp.set(g.x, wy, g.z + r), [2 * r, s * 0.03, th]);
        put(ring, i * 4 + 3, tmp.set(g.x, wy, g.z - r), [2 * r, s * 0.03, th]);
      });
      ring.count = rings.length * 4;
      ring.instanceMatrix.needsUpdate = true;
      splash.step(dt, t, (q, dt) => { q.v.y -= s * 40 * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < wy) q.age = q.life; }, s);
      dfly(t, dt, ctx, s, visW);
      // 가끔 멀리서 물고기가 폴짝
      if (jump.u < 0 && (jump.wait -= dt) <= 0) {
        Object.assign(jump, { u: 0, x: target.x + (rnd() * 2 - 1) * visW * 0.5, z: Math.max(-1.0 * V, target.z - d * (0.05 + rnd() * 0.1)), dir: rnd() < 0.5 ? 1 : -1 });
        splashAt(jump.x, jump.z, 8, 0.6, s);
      }
      if (jump.u >= 0) {
        jump.u += dt / 1.1;
        const u = Math.min(1, jump.u), fs = s * 1.2;
        fish.visible = true;
        fish.position.set(jump.x + jump.dir * u * s * 7, wy + Math.sin(Math.PI * u) * s * 8, jump.z);
        fish.rotation.set(0, jump.dir > 0 ? 0 : Math.PI, (0.5 - u) * 2);
        fishB.scale.set(fs * 2, fs * 0.9, fs * 0.6);
        fishT.scale.set(fs * 0.6, fs, fs * 0.15);
        fishT.position.set(-fs * 1.2, 0, 0);
        if (jump.u >= 1) { jump.u = -1; jump.wait = 4 + rnd() * 5; fish.visible = false; splashAt(fish.position.x, jump.z, 8, 0.6, s); }
      }
    },
  };
}

// ── 정글: 떨어지는 나뭇잎(세게 부딪히면 우수수), 반딧불이, 흔들리는 덩굴, 낮게 깔린 안개, 가끔 지나가는 익룡 ──
function jungle(scene, rnd) {
  const sway = swayer(scene), drift = cloudDrift(scene), L = LIFE.jungle;
  const LEAVES = ['#4f9a38', '#7fb83a', '#e0c040', '#c8902a'];
  const leaves = bits(scene, L.LEAF + 40, lit('#ffffff'), [1, 0.15, 0.8]);
  const ffly = flyers(scene, L.FIREFLY, rnd, { colors: ['#ffffff'], body: '#e6ff7a', glow: true });
  const SEG = 10, vine = inst(L.VINE * SEG, lit('#3d7a2a')), vleaf = inst(L.VINE * SEG, lit('#56a03c'));
  vine.count = L.VINE * SEG;
  vleaf.count = L.VINE * (SEG >> 1);
  const vines = Array.from({ length: L.VINE }, (_, i) => [(i / Math.max(1, L.VINE - 1)) * 2 - 1 + (rnd() - 0.5) * 0.2, 0.07 + rnd() * 0.08, rnd() * 6]);
  const mist = Array.from({ length: L.MIST }, () => { const m = new THREE.Mesh(GEO, new THREE.MeshBasicMaterial({ color: '#f2fff0', transparent: true, opacity: 0.09, depthWrite: false })); scene.add(m); return { m, fx: rnd() * 2 - 1, fz: 0.02 + rnd() * 0.2, sp: 0.5 + rnd() }; });
  const flock = pteroFlock(scene, 2, rnd, 24, '#4a3c34');
  scene.add(vine, vleaf);
  let next = 0;
  return {
    update(t, dt, ctx) {
      sway(t);
      drift(t);
      const { target, d, visH, aspect, impact } = ctx, s = d * 0.012, visW = visH * aspect;
      const drop = (fast = 1) => leaves.emit(new V3(target.x + (rnd() * 2 - 1) * visW * 0.55, visH * 0.8, target.z - d * (0.02 + rnd() * 0.2)), new V3((rnd() - 0.5) * s, -s * 2.2 * fast, 0), { life: 8, size: 0.9, spin: 1.5, color: LEAVES[Math.floor(rnd() * LEAVES.length)] });
      if ((next -= dt) <= 0) { next = 0.35 + rnd() * 0.3; drop(); }
      if (impact) for (let i = 0; i < 30; i++) drop(1.6); // 우수수
      leaves.step(dt, t, (q, dt, t) => { q.p.x += Math.sin(t * 1.5 + q.ph) * s * 1.2 * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < s * 0.2) { q.v.set(0, 0, 0); q.spin = 0; q.life = Math.min(q.life, q.age + 1.5); } }, s);
      ffly(t, dt, ctx, s, visW);
      // 덩굴: 화면 위에서 늘어져 마디마다 조금씩 더 흔들린다
      vines.forEach(([fx, fz, ph], i) => {
        let x = target.x + fx * visW * 0.55, y = visH * 0.62, a = 0;
        const z = target.z - fz * d, sl = s * 1.7;
        for (let j = 0; j < SEG; j++) {
          a += Math.sin(t * 0.9 + ph) * 0.05;
          const cx = x + Math.sin(a) * sl * 0.5, cy = y - Math.cos(a) * sl * 0.5;
          put(vine, i * SEG + j, tmp.set(cx, cy, z), [s * 0.35, sl * 1.05, s * 0.35], 0, a);
          if (j % 2) put(vleaf, i * (SEG >> 1) + (j >> 1), tmp.set(cx + s * 0.45, cy, z), [s * 0.8, s * 0.15, s * 0.6], 0, a + 0.4);
          x += Math.sin(a) * sl;
          y -= Math.cos(a) * sl;
        }
      });
      vine.instanceMatrix.needsUpdate = vleaf.instanceMatrix.needsUpdate = true;
      // 안개: 바닥에 낮게 깔려 옆으로 천천히 흐른다(화면 밖으로 나가면 반대편에서 다시)
      for (const m of mist) {
        const span = visW * 1.4, x = ((((m.fx * visW * 0.7 + t * s * 1.5 * m.sp) % span) + span) % span) - span / 2;
        m.m.position.set(target.x + x, s * 1.5, target.z - m.fz * d);
        m.m.scale.set(visW * 0.35, s * 1.2, d * 0.08);
      }
      flock(t, dt, ctx, s, visW);
    },
  };
}

// ── 초원: 흔들리는 풀, 나비, 바람에 날리는 씨앗, 하늘을 지나가는 익룡 무리, 흐르는 구름 ──
function grassland(scene, rnd) {
  const sway = swayer(scene), drift = cloudDrift(scene), L = LIFE.grassland;
  const fly = flyers(scene, L.BUTTERFLY, rnd, { colors: ['#ffd23a', '#ff8ad0', '#8ad0ff', '#ffffff'], body: '#3a2a20', wing: [1.6, 0.06, 1.6], flap: 12 });
  const seeds = bits(scene, L.SEED * 2, lit('#ffffff', { emissive: '#666666' }));
  const flock = pteroFlock(scene, L.PTERO, rnd, 16);
  let next = 0;
  return {
    update(t, dt, ctx) {
      sway(t);
      drift(t);
      const { target, d, visH, aspect, impact } = ctx, s = d * 0.012, visW = visH * aspect;
      if ((next -= dt) <= 0) { next = 0.5 + rnd() * 0.5; seeds.emit(new V3(target.x - visW * 0.65, visH * (0.08 + rnd() * 0.3), target.z - d * (0.02 + rnd() * 0.2)), new V3(s * (5 + rnd() * 3), s * 0.4, 0), { life: 10, size: 0.35, spin: 0.6 }); }
      if (impact) for (let i = 0; i < 14; i++) seeds.emit(impact.clone().add(new V3(0, s * 2, 0)), new V3((rnd() - 0.5) * s * 12, s * (2 + rnd() * 6), (rnd() - 0.5) * s * 6), { life: 4, size: 0.35, spin: 1 });
      seeds.step(dt, t, (q, dt, t) => { q.v.multiplyScalar(Math.exp(-dt * 0.3)); q.v.x += s * 2 * dt; q.p.addScaledVector(q.v, dt); q.p.y += Math.sin(t * 2 + q.ph) * s * 0.6 * dt; }, s);
      fly(t, dt, ctx, s, visW);
      flock(t, dt, ctx, s, visW);
    },
  };
}
