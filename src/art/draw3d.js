// 3D 그림 찍기·움직이기(Three.js). 모양은 shape3d.js(체형 틀), 동작은 motion3d.js.
// 좌표는 2D(draw.js)와 같다: 몸길이 1(꼬리끝 x=0 → 코끝 x=1), y 위, 땅 y=0. z는 몸 왼쪽(카메라 쪽).
// 정지 화면에는 찍은 사진 한 장(<image>)을, 배틀에는 같은 자리에 살아 움직이는 캔버스(live)를 끼운다.
import * as THREE from 'three';
import { shapeMask, maskAt } from './photo.js';
import { restPose, targetPose, blend, stateOf } from './motion3d.js';
import { build as buildSmooth } from './shape3d.js';
import { build as buildBlock } from './block3d.js';

// ?art=block 이면 블록 모델(block3d.js), 아니면 매끈한 모델(shape3d.js). rig 모양이 같아서 나머지는 그대로
const build = (new URLSearchParams(location.search).get('art') ?? 'block') === 'block' ? a => buildBlock(a) ?? buildSmooth(a) : buildSmooth; // 기본은 블록 모델. 블록이 아직 없는 동물은 매끈한 모델
export const buildModel = build;

const V = THREE.Vector3;

// 자세 P(motion3d.js)를 부위에 입힌다
export function applyPose(rig, P) {
  const set = (o, x, y, z) => { const r = o.userData.rest; o.rotation.set(r.x + x, r.y + y, r.z + z); };
  rig.all.position.y = rig.all.userData.pos.y + P.y;
  set(rig.all, P.roll ?? 0, 0, P.pitch);
  rig.eyes?.forEach(e => (e.scale.y = 1 - 0.9 * Math.min(1, P.blink ?? 0))); // 눈 감기(눈알 묶음을 위아래로 납작하게)
  const nod = rig.nod ?? 1; // 등딱지 동물은 고개를 조금만
  set(rig.head, 0, P.hy * nod, P.hp * nod);
  set(rig.jaw, 0, 0, -P.jaw);
  rig.tail.forEach((t, i) => set(t, 0, P.ty[i], -P.tp[i])); // 꼬리는 뒤(-x)로 뻗어서 위로 들려면 -z
  rig.legs.forEach((l, i) => { set(l.g, 0, 0, P.ls[i] * (rig.swim ? 0.6 : 1)); if (l.knee) set(l.knee, 0, 0, -P.lb[i]); });
  rig.wings?.forEach(w => set(w, -w.userData.side * P.wf, 0, 0)); // 어깨를 축으로 바깥(+)·안으로
}
export const rigInfo = rig => ({ tail: rig.tail.length, legs: rig.legs, swim: rig.swim, fly: rig.fly, ph: rig.ph });

// ── 빛과 카메라 ──
// 참고 그림처럼 흰 스튜디오: 왼쪽 위 주광(그림자) + 약한 보조광 + 뒤쪽 윤곽광
function studio() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8c8474', 1.0));
  const key = new THREE.DirectionalLight('#fff4e2', 2.6), fill = new THREE.DirectionalLight('#e6eeff', 0.5), rim = new THREE.DirectionalLight('#ffffff', 1.0);
  key.position.set(0.1, 1.2, 0.8);
  key.target.position.set(0.55, 0.08, 0);
  fill.position.set(1.6, 0.3, 1);
  rim.position.set(0.8, 0.6, -1.2);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -0.7, right: 0.7, top: 0.7, bottom: -0.7, near: 0.1, far: 3 });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.002;
  key.shadow.radius = 4;
  scene.add(key, key.target, fill, rim);
  return scene;
}
function makeRenderer(opts = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, ...opts });
  r.setPixelRatio(1);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  return r;
}

// yaw(옆으로 돌린 각)·elev(내려다보는 각)에서 정사영 카메라를 겨누고, 카메라에서 본 모델 범위를 잰다
function aim(cam, root, yaw, elev) {
  cam.position.set(0.5 + Math.sin(yaw) * Math.cos(elev) * 5, 0.1 + Math.sin(elev) * 5, Math.cos(yaw) * Math.cos(elev) * 5);
  cam.lookAt(0.5, 0.1, 0);
  cam.updateMatrixWorld();
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), v = new V();
  root.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) box.expandByPoint(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).applyMatrix4(cam.matrixWorldInverse)); // 뼈대로 휜 살도 포함
  });
  return { box, ox: new V(0, 0, 0).applyMatrix4(cam.matrixWorldInverse).x }; // ox: 꼬리끝 바닥(몸 좌표 원점)
}
const frustum = (cam, l, r, t, b, box) => { Object.assign(cam, { left: l, right: r, top: t, bottom: b, near: -box.max.z - 1, far: -box.min.z + 1 }); cam.updateProjectionMatrix(); };

let R = null, broken = false;
function ctx() {
  if (R || broken) return R;
  try {
    R = { renderer: makeRenderer({ preserveDrawingBuffer: true }), scene: studio(), cam: new THREE.OrthographicCamera(), flat: document.createElement('canvas') };
  } catch (e) {
    console.warn('WebGL을 쓸 수 없어 2D로 그립니다', e);
    broken = true;
  }
  return R;
}

// 성능 확인(?fps): 화면 구석에 초당 프레임 수와 3D 그림 찍는 데 든 시간
const stats = { shots: 0, ms: 0, build: 0, fps: 0, low: Infinity };
const meter = new URLSearchParams(location.search).has('fps') && document.body.appendChild(Object.assign(document.createElement('div'), { className: 'fps' }));
const showStats = () => meter && (meter.textContent = `${stats.fps ? `${stats.fps} fps (최저 ${stats.low}) · ` : ''}3D 그림 ${stats.shots}장 찍기 ${Math.round(stats.ms)}ms·만들기 ${Math.round(stats.build)}ms`);

// 모델 root 를 카메라에 겨누고 그린다(R.renderer 캔버스에). 반환: 몸 좌표에서 놓일 자리(x0, w, aspect)와 픽셀 크기
function draw(root, yaw, elev, ppu) {
  const { renderer, scene, cam } = R;
  scene.add(root);
  const { box, ox } = aim(cam, root, yaw, elev);
  frustum(cam, box.min.x, box.max.x, box.max.y, box.min.y, box);
  const w = Math.ceil((box.max.x - box.min.x) * ppu), h = Math.ceil((box.max.y - box.min.y) * ppu);
  renderer.setSize(w, h, false);
  renderer.setViewport(0, 0, w, h);
  renderer.render(scene, cam);
  scene.remove(root);
  // 가로는 원점에서 잰 거리, 바닥(v=0)은 가장 낮은 점
  return { x0: box.min.x - ox, w: box.max.x - box.min.x, aspect: h / w, yaw, elev, px: [w, h] };
}
const dispose = root => root.traverse(o => o.geometry?.dispose());

// 확인 화면용: 바로 찍은 사진(동기, data URL)
export function snapshot(root, { yaw = 0.32, elev = 0.14, ppu = 500 } = {}) {
  if (!ctx()) return null;
  const f = draw(root, yaw, elev, ppu);
  return { ...f, url: R.renderer.domElement.toDataURL('image/webp', 0.92) };
}

// 화면 그림: 자리(몸 좌표)는 바로 정하고, 사진은 프레임마다 시간을 나눠 찍어 채운다(동물 95종 카드가 한꺼번에 멈추지 않게).
// 다 찍히면 같은 동물의 <image data-a3> 를 모두 채운다. 충돌용 모양 지도는 배틀에 나올 때만(maskOf)
const cache = new Map(), queue = [];
const SHOT = { yaw: 0.32, elev: 0.14, ppu: 500 };
function shot(a) {
  if (cache.has(a.id)) return cache.get(a.id);
  let e = null;
  const t0 = performance.now(), rig = ctx() && build(a);
  stats.build += performance.now() - t0;
  if (rig) {
    rig.root.updateMatrixWorld(true);
    const { box, ox } = aim(R.cam, rig.root, SHOT.yaw, SHOT.elev), h = box.max.y - box.min.y;
    e = { x0: box.min.x - ox, w: box.max.x - box.min.x, aspect: h / (box.max.x - box.min.x), yaw: SHOT.yaw, elev: SHOT.elev, url: null };
    queue.push(() => {
      const t1 = performance.now();
      draw(rig.root, SHOT.yaw, SHOT.elev, SHOT.ppu);
      R.renderer.domElement.toBlob(b => {
        e.url = URL.createObjectURL(b);
        document.querySelectorAll(`image[data-a3="${a.id}"]`).forEach(im => im.setAttribute('href', e.url));
      }, 'image/webp', 0.92);
      dispose(rig.root);
      stats.shots++;
      stats.ms += performance.now() - t1;
      showStats();
    });
    if (queue.length === 1) requestAnimationFrame(pump);
  }
  cache.set(a.id, e);
  return e;
}
function pump() {
  const end = performance.now() + 12; // 한 프레임에 12ms까지만
  while (queue.length && performance.now() < end) queue.shift()();
  if (queue.length) requestAnimationFrame(pump);
}
// 충돌용 모양 지도: 다시 만들어 한 번 찍고 픽셀을 읽는다(배틀에 나오는 두 마리만)
function maskOf(a) {
  const e = shot(a);
  if (!e || e.mask) return e;
  const rig = build(a), f = draw(rig.root, e.yaw, e.elev, 250), [w, h] = f.px;
  Object.assign(R.flat, { width: w, height: h });
  const fc = R.flat.getContext('2d', { willReadFrequently: true });
  fc.drawImage(R.renderer.domElement, 0, 0);
  Object.assign(e, shapeMask(fc.getImageData(0, 0, w, h), 120));
  dispose(rig.root);
  return e;
}

// 확인 화면용: 동작 state 의 t초 자세로 찍기
export function posedShot(a, state, t, opts) {
  const rig = ctx() && build(a);
  if (!rig) return null;
  applyPose(rig, targetPose(state, t, rigInfo(rig), { moving: true }));
  return snapshot(rig.root, opts);
}

export function drawAnimal(a) {
  const s = shot(a);
  if (!s) return null;
  const hgt = s.w * s.aspect;
  return `<g class="animal model3d" data-id="${a.id}"><defs><radialGradient id="g3${a.id}"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`
    + `<ellipse class="gshadow" cx=".5" cy="0" rx=".5" ry=".035" fill="url(#g3${a.id})"/>`
    + `<image data-a3="${a.id}" href="${s.url ?? ''}" x="${s.x0}" y="${-hgt}" width="${s.w}" height="${hgt}" preserveAspectRatio="none"/></g>`;
}

export function shapeTest(a) {
  const s = maskOf(a);
  return s && ((u, v) => maskAt(s, (u - s.x0) / s.w, v / s.w));
}

// ── 살아 움직이는 3D(배틀) ──
// el 안의 사진(<image>)을 같은 자리·같은 눈금의 캔버스로 바꾸고, 가장 가까운 .pos 의 표시(biting, hit …)를 보고 움직인다.
// 턱을 벌리거나 꼬리를 휘둘러도 잘리지 않게 사진보다 둘레를 넉넉히 잡는다.
// WebGL 은 사진 찍기와 같은 것 하나만 쓴다(셰이더를 다시 만들지 않아 배틀 시작이 멈추지 않음): 그린 뒤 각 동물 캔버스로 복사
const views = new Set();
export function live(a, el) {
  const s = shot(a), img = el.querySelector('.model3d image');
  if (!s || !img || !ctx()) return false;
  const rig = build(a), cam = new THREE.OrthographicCamera(), scene = studio();
  scene.add(rig.root);
  const { box, ox } = aim(cam, rig.root, s.yaw, s.elev), bw = box.max.x - box.min.x, bh = box.max.y - box.min.y;
  const px = 0.06 + bw * 0.06, pt = 0.05 + bh * 0.6, pb = 0.02 + bh * 0.25;
  frustum(cam, box.min.x - px, box.max.x + px, box.max.y + pt, box.min.y - pb, box);
  const W = bw + 2 * px, H = bh + pt + pb, ppu = 650 * Math.min(1.5, devicePixelRatio || 1);
  const cv = Object.assign(document.createElement('canvas'), { width: Math.ceil(W * ppu), height: Math.ceil(H * ppu) });
  Object.assign(cv.style, { width: '100%', height: '100%', display: 'block' });
  const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  // 몸 좌표(1 = 몸길이)대로면 캔버스가 1px 남짓이라 브라우저가 안 그린다 → K배로 크게 놓고 1/K로 줄인다
  const K = 1000;
  Object.entries({ x: (box.min.x - ox - px) * K, y: -(bh + pt) * K, width: W * K, height: H * K, transform: `scale(${1 / K})` }).forEach(([k, v]) => fo.setAttribute(k, v));
  fo.append(cv);
  img.replaceWith(fo);
  const info = rigInfo(rig);
  views.add({ rig, info, scene, cam, cv, c2: cv.getContext('2d'), el, pos: el.closest('.pos') ?? el, P: restPose(info) });
  if (views.size === 1) requestAnimationFrame(tick);
  return true;
}
let last = 0, frames = 0, sec = 0;
function tick(now) {
  const t = now / 1000, dt = Math.min(0.1, last ? t - last : 0);
  last = t;
  frames++;
  if (t - sec >= 1) { // 1초마다 fps (처음 1초는 준비 중이라 최저에서 뺀다)
    if (sec) { stats.fps = frames; stats.low = Math.min(stats.low, frames); showStats(); }
    sec = t;
    frames = 0;
  }
  const r = R.renderer, gl = r.domElement;
  for (const v of views) {
    if (!v.el.isConnected) { v.rig.root.traverse(o => o.geometry?.dispose()); views.delete(v); continue; }
    const { state, o } = stateOf(v.pos.classList);
    o.step = v.step = (v.step ?? 0) + dt * (+v.pos.dataset?.gait || 9);
    applyPose(v.rig, blend(v.P, targetPose(state, t, v.info, o), dt));
    const { width: w, height: h } = v.cv;
    if (gl.width < w || gl.height < h) r.setSize(Math.max(gl.width, w), Math.max(gl.height, h), false);
    r.setViewport(0, 0, w, h);
    r.render(v.scene, v.cam);
    v.c2.clearRect(0, 0, w, h);
    v.c2.drawImage(gl, 0, gl.height - h, w, h, 0, 0, w, h); // 뷰포트는 캔버스 왼쪽 아래
  }
  if (views.size) requestAnimationFrame(tick);
  else last = sec = 0;
}
