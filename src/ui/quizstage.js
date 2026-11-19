// 탐험대 퀴즈의 3D 무대: 배틀과 같은 땅·장식·하늘에 동물을 세운다(움직이는 블록 모델).
// 안개(mist 1 → 0), 까만 그림자(silhouette), 걸어 나오기(walkIn), 부위 확대(zoomTo), 포효(roar), 두 동물 나란히(실제 크기 비율)
import * as THREE from 'three';
import { buildModel, applyPose, rigInfo } from '../art/draw3d.js';
import { restPose, targetPose, blend } from '../art/motion3d.js';
import { V, LOOKS, GROUND_DOTS, seeded, gradient, groundTex, decor } from './arena3d.js';

const lerp = (a, b, t) => a + (b - a) * t;
const BLACK = new THREE.MeshBasicMaterial({ color: '#0b0d10' });

// el 에 캔버스를 넣는다. WebGL 이 안 되면 null(화면은 그림 카드만으로 진행)
export function quizStage(el, stage) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { return null; }
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  const cv = renderer.domElement;
  el.prepend(cv);
  const look = LOOKS[stage] ?? LOOKS.grassland, rnd = seeded([...stage].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
  const scene = new THREE.Scene();
  scene.background = gradient(look.top, look.horizon);
  scene.fog = new THREE.Fog(look.hills[1], 1, 2);
  scene.add(new THREE.HemisphereLight(stage === 'underwater' ? '#cfefff' : '#ffffff', look.ground[0], 1.2));
  const sun = new THREE.DirectionalLight('#fff2da', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.02 * V;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80 * V, 80 * V), new THREE.MeshStandardMaterial({ map: groundTex(look.ground, rnd, GROUND_DOTS[stage]), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground, ...decor(stage, rnd));
  const cam = new THREE.PerspectiveCamera(36, 1, 0.01, 500 * V);

  let actors = [], mist = 0, mistTo = 0, view = { kind: 'wide' }, camP = null, camQ = null, last = 0;
  const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();

  // 동물 세우기: 하나면 가운데, 둘이면 마주 보게(크기는 실제 몸길이 비율, 큰 쪽 = V)
  function put(list) {
    actors.forEach(a => scene.remove(a.holder));
    const S = V / Math.max(...list.map(a => a.length_m.avg)), gap = 0.12 * V;
    actors = list.map((a, i) => {
      const rig = buildModel(a);
      if (!rig) return null;
      rig.root.traverse(o => o.isMesh && (o.castShadow = true, o.userData.mat = o.material));
      const holder = new THREE.Group(), L = a.length_m.avg * S, info = rigInfo(rig);
      holder.add(rig.root);
      holder.scale.setScalar(L);
      const back = list.length === 1 ? -L / 2 : i ? gap + L : -gap - L; // 꼬리 끝 x
      if (list.length > 1 && i) holder.rotation.y = Math.PI; // 오른쪽 동물은 돌아서서 왼쪽을 본다
      holder.position.x = back;
      scene.add(holder);
      return { a, rig, info, holder, P: restPose(info), x: back, from: back, t0: 0, ms: 0, state: 'idle', until: 0 };
    }).filter(Boolean);
    camP = null;
  }
  // 까만 그림자로(on) / 제 색으로
  const silhouette = on => actors.forEach(v => v.rig.root.traverse(o => o.isMesh && (o.material = on ? BLACK : o.userData.mat)));
  // 걸어 들어오기: 화면 왼쪽 밖에서 제자리까지 ms 동안
  function walkIn(ms = 2600) {
    const now = performance.now();
    actors.forEach(v => Object.assign(v, { from: v.x - 2.2 * V, t0: now, ms }));
  }
  const roar = (ms = 1800) => actors.forEach(v => Object.assign(v, { state: 'roar', until: performance.now() + ms }));
  // 카메라: wide 전체 / part(어느 동물 i, 부위, 0 아주 가까이 ~ 1 멀리)
  const wide = () => (view = { kind: 'wide' });
  const zoomTo = (part, k = 0, i = 0) => (view = { kind: 'part', part, k, i });

  // 부위 자리(세계 좌표)와 동물 크기
  function partAt(v, part) {
    v.holder.updateMatrixWorld(true);
    box.setFromObject(v.rig.root).getSize(size);
    const c = box.getCenter(mid).clone();
    const pick = o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    if (part === 'head') return [pick(v.rig.head.children[0]), size.length()];
    if (part === 'tail' && v.rig.tail.length) return [pick(v.rig.tail.at(-1)), size.length()];
    if (part === 'foot' && v.rig.legs.length) { const l = v.rig.legs.find(l => !l.front) ?? v.rig.legs[0]; const b = new THREE.Box3().setFromObject(l.g); return [new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y + (b.max.y - b.min.y) * 0.15, b.max.z), size.length()]; }
    if (part === 'back') return [new THREE.Vector3(c.x, box.max.y - size.y * 0.1, c.z), size.length()];
    return [c, size.length()];
  }

  const tick = now => {
    if (!cv.isConnected) return renderer.dispose();
    requestAnimationFrame(tick);
    const t = now / 1000, dt = Math.min(0.1, last ? t - last : 0);
    last = t;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    for (const v of actors) {
      const k = v.ms ? Math.min(1, (now - v.t0) / v.ms) : 1, moving = k < 1;
      v.holder.position.x = lerp(v.from, v.x, 1 - (1 - k) ** 2);
      if (v.state === 'roar' && now > v.until) v.state = 'idle';
      blend(v.P, targetPose(v.state, t, v.info, { moving, step: t * 7 }), dt);
      applyPose(v.rig, v.P);
    }
    // 카메라 목표: 전체(모든 동물이 들어오게, 비스듬히 위에서) 또는 부위 가까이
    let P, Q;
    if (actors.length) {
      box.makeEmpty();
      actors.forEach(v => box.expandByObject(v.rig.root));
      box.getSize(size);
      const c = box.getCenter(new THREE.Vector3()), d = Math.max(size.x * 0.95 / cam.aspect + size.y * 0.4, size.y * 1.6, 0.25 * V) * 1.35;
      if (view.kind === 'part' && actors[view.i]) {
        const [p, s] = partAt(actors[view.i], view.part), dd = lerp(s * 0.32, d, view.k);
        Q = p.clone().lerp(c, view.k);
        P = Q.clone().add(new THREE.Vector3(0.35 * dd, 0.25 * dd, dd));
      } else {
        Q = new THREE.Vector3(c.x, c.y * 0.8, c.z);
        P = Q.clone().add(new THREE.Vector3(0.25 * d, 0.3 * d, d));
      }
    } else { Q = new THREE.Vector3(0, 0.15 * V, 0); P = new THREE.Vector3(0.2 * V, 0.45 * V, 1.6 * V); }
    const e = camP ? 1 - Math.exp(-dt * 2.5) : 1; // 카메라는 천천히 옮겨 간다
    camP = camP ? camP.lerp(P, e) : P.clone();
    camQ = camQ ? camQ.lerp(Q, e) : Q.clone();
    cam.position.copy(camP);
    cam.lookAt(camQ);
    cam.near = Math.max(0.001, camP.distanceTo(camQ) * 0.02);
    cam.updateProjectionMatrix();
    // 안개: mist 1 이면 동물이 안개에 거의 묻히고, 0 이면 맑게(먼 배경만 흐리게)
    mist += (mistTo - mist) * Math.min(1, dt * 1.5);
    const dist = camP.distanceTo(camQ);
    // 동물 자리(카메라에서 dist)의 안개 짙기가 F = mist^0.6 이 되게(near 0, far = dist / F). 힌트마다 조금씩 걷힌다. mist 0 이면 배틀처럼 먼 배경만 흐리게
    const F = mist ** 0.6;
    scene.fog.near = dist * 1.6 * (1 - F) ** 4;
    scene.fog.far = Math.min(dist * 6 + 30 * V * look.fog, dist / Math.max(F, 1e-3));
    sun.position.set(camQ.x - 0.6 * dist, camQ.y + 1.2 * dist, camQ.z + 0.8 * dist);
    sun.target.position.copy(camQ);
    Object.assign(sun.shadow.camera, { left: -dist, right: dist, top: dist, bottom: -dist, near: 0.01, far: 4 * dist });
    sun.shadow.camera.updateProjectionMatrix();
    renderer.render(scene, cam);
  };
  requestAnimationFrame(tick);
  return { put, silhouette, walkIn, roar, wide, zoomTo, setMist: k => (mistTo = k), jumpMist: k => (mist = mistTo = k) };
}
