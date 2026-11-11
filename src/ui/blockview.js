// 블록 3D 확인 화면
// #block, #block=tyrannosaurus,triceratops: 빙글 돌려 보며 동작(대기·돌진·물기·맞음·지침)을 차례로. &yaw=0.6 그 각도에서, &st=bite 그 동작만
// #block=all: 99종 한눈에(격자 사진, 이상한 동물 골라내기), #block=reps: 체형 틀마다 대표 한 마리
import * as THREE from 'three';
import { animals } from '../data.js';
import { build } from '../art/block3d.js';
import { REPS } from '../art/shape3d.js';
import { applyPose, rigInfo } from '../art/draw3d.js';
import { targetPose, blend, restPose, STATES } from '../art/motion3d.js';

const KO = { idle: '대기', wind: '힘 모으기', charge: '돌진', bite: '물기', hit: '맞음', tired: '지침', roar: '포효', ko: 'K.O.' };
const STATE_S = 2.5; // 동작 하나를 보여 주는 초
const CSS = `<style>
  .bv { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px; padding: 16px; }
  .bv.grid { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  .bv figure { margin: 0; background: #fff2; border-radius: 12px; overflow: hidden; }
  .bv canvas, .bv img { width: 100%; aspect-ratio: 4 / 3; display: block; }
  .bv figcaption { padding: 8px 14px; font-size: 24px; } .bv.grid figcaption { font-size: 17px; padding: 4px 10px; }
  .bv small { opacity: .7; margin-left: 8px; }
</style>`;

// 하늘·풀밭·빛(그림자)
function stage() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe0f2');
  scene.add(new THREE.HemisphereLight('#ffffff', '#7a8a5a', 1.4));
  const sun = new THREE.DirectionalLight('#fff3dc', 2.4);
  sun.position.set(0.8, 2, 1.2);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1 });
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.004; // 맞닿은 상자 경계에 그림자 줄이 생기지 않게
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: '#9fc76c', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(sun, ground);
  return scene;
}
// 동물 크기에 맞춰 카메라: 몸 가운데를 비스듬히 위에서
function frame(cam, root) {
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()), dist = 0.9 + Math.max(size.y * 1.9, size.x * 0.75), mid = size.y * 0.45;
  cam.position.set(0, mid + dist * 0.3, dist);
  cam.lookAt(0, mid, 0);
}
const renderer = canvas => { const r = new THREE.WebGLRenderer({ canvas: canvas ?? undefined, antialias: true, preserveDrawingBuffer: !canvas }); r.shadowMap.enabled = true; return r; };

export function showBlocks(root) {
  const many = location.hash.match(/^#block=(all|reps)/)?.[1];
  if (many) return showGrid(root, many === 'all' ? animals : animals.filter(a => REPS.has(a.id)));
  const ids = location.hash.match(/^#block=([\w,]+)/)?.[1].split(',') ?? ['tyrannosaurus', 'triceratops', 'woolly_mammoth'];
  const list = ids.map(id => animals.find(a => a.id === id)).filter(Boolean);
  root.innerHTML = `${CSS}<h1 style="padding:16px 16px 0">블록 3D 확인</h1>
  <div class="bv">${list.map(a => `<figure><canvas></canvas><figcaption>${a.name_ko}<small></small></figcaption></figure>`).join('')}</div>`;
  const views = list.map((a, i) => {
    const rig = build(a), cv = root.querySelectorAll('.bv canvas')[i], label = cv.nextElementSibling.querySelector('small');
    if (!rig) return (label.textContent = '블록 모델 없음'), null;
    const r = renderer(cv), scene = stage(), turn = new THREE.Group(), cam = new THREE.PerspectiveCamera(35, 4 / 3, 0.05, 20);
    rig.root.position.x = -0.5; // 몸 가운데를 축으로 돈다
    turn.add(rig.root);
    scene.add(turn);
    frame(cam, rig.root);
    if (/&face/.test(location.hash)) { // &face: 얼굴을 비스듬히 가까이(얼굴 디테일 확인)
      turn.updateMatrixWorld(true);
      const c = new THREE.Box3().setFromObject(rig.head.children[0]).getCenter(new THREE.Vector3()), r = new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3()).x * 0.22;
      cam.position.set(c.x + r * 1.5, c.y + r * 0.5, c.z + r * 2.2);
      cam.lookAt(c.x + r * 0.15, c.y, c.z);
    }
    const info = rigInfo(rig);
    return { r, scene, cam, turn, rig, info, label, P: restPose(info) };
  }).filter(Boolean);

  const yaw = +location.hash.match(/&yaw=([\d.-]+)/)?.[1] || null, fixSt = location.hash.match(/&st=(\w+)/)?.[1];
  let last = 0;
  const tick = now => {
    if (!root.querySelector('.bv')) return views.forEach(v => v.r.dispose()); // 다른 화면으로 가면 멈춤
    const t = now / 1000, dt = Math.min(0.1, last ? t - last : 0), state = fixSt ?? STATES[Math.floor(t / STATE_S) % STATES.length];
    last = t;
    for (const v of views) {
      const { clientWidth: w, clientHeight: h } = v.r.domElement;
      if (v.r.domElement.width !== w) v.r.setSize(w, h, false);
      v.turn.rotation.y = /&face/.test(location.hash) ? 0 : yaw ?? t * 0.5;
      applyPose(v.rig, blend(v.P, targetPose(state, t, v.info, { motion: location.hash.match(/&m=(\w+)/)?.[1] }), dt)); // &m=stomp: 공격 종류
      v.label.textContent = KO[state];
      v.r.render(v.scene, v.cam);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// 격자: 렌더러 하나로 한 마리씩 사진을 찍어 채운다(프레임마다 몇 마리씩, 화면이 멈추지 않게)
function showGrid(root, list) {
  root.innerHTML = `${CSS}<h1 style="padding:16px 16px 0">블록 3D ${list.length}종</h1>
  <div class="bv grid">${list.map(a => `<figure><img alt=""><figcaption>${a.name_ko}<small>${a.archetype}</small></figcaption></figure>`).join('')}</div>`;
  const imgs = root.querySelectorAll('.bv img'), r = renderer(null), scene = stage(), cam = new THREE.PerspectiveCamera(35, 4 / 3, 0.05, 20);
  r.setSize(400, 300, false);
  let i = 0;
  const step = () => {
    const end = performance.now() + 30;
    while (i < list.length && performance.now() < end) {
      const a = list[i], im = imgs[i++];
      try {
        const rig = build(a);
        if (!rig) { im.alt = '블록 모델 없음'; continue; }
        const turn = new THREE.Group();
        rig.root.position.x = -0.5;
        turn.add(rig.root);
        turn.rotation.y = -0.6; // 앞얼굴이 보이게
        scene.add(turn);
        frame(cam, rig.root);
        r.render(scene, cam);
        im.src = r.domElement.toDataURL('image/webp', 0.9);
        scene.remove(turn);
      } catch (e) {
        console.error(a.id, e);
        im.alt = '오류: ' + e.message;
        im.closest('figure').style.outline = '3px solid red';
      }
    }
    if (i < list.length) requestAnimationFrame(step);
    else r.dispose();
  };
  requestAnimationFrame(step);
}
