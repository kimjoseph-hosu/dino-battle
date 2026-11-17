// 3D 무대(PLAN_BLOCK3D 5절). 배틀 흐름·움직임은 battle.js(2D SVG)가 그대로 하고, 여기서는 매 프레임 그 자리를 읽어 3D로 그린다.
// - 동물: .pose 안 그림의 SVG 행렬(위치·자세·눕기·뒤집기 모두 들어 있음)을 3D 행렬로 옮기고, 부위 동작은 motion3d 로(.pos 표시를 보고)
// - 카메라: 2D 카메라(.cam)가 보는 가운데·넓이를 따라가되, ARENA.CAM_ELEV_DEG 위에서 비스듬히 내려다본다
// - 무대 4종은 블록풍. 나무·풀·돌은 InstancedMesh 로 한 번에 그린다
import * as THREE from 'three';
import { buildModel, applyPose, rigInfo } from '../art/draw3d.js';
import { restPose, targetPose, blend, stateOf } from '../art/motion3d.js';
import { ARENA, CLOSE, REAL } from '../config.js';
import { stageLife } from './stagelife.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

const Q = new URLSearchParams(location.search), IS_REAL = Q.get('art') === 'real', LOW = Q.get('q') === 'low';

// 실사: 하늘(위)·지평선·땅(아래) 색 공 + 밝은 해를 환경 지도로 구워 몸에 은은한 하늘빛·땅빛 반사가 비치게(그림 파일 없이)
function skyEnv(renderer, look, sunDir) {
  const s = new THREE.Scene(), g = new THREE.SphereGeometry(1, 32, 16), p = g.attributes.position, col = [];
  const top = new THREE.Color(look.top), hor = new THREE.Color(look.horizon), gr = new THREE.Color(look.ground[0]).multiplyScalar(0.5), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    (y >= 0 ? c.copy(hor).lerp(top, Math.sqrt(y)) : c.copy(hor).lerp(gr, Math.min(1, -y * 4))).toArray(col, i * 3);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2da').multiplyScalar(40) }));
  sun.position.copy(sunDir).multiplyScalar(0.8);
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })), sun);
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, 0, 0.1, 10).texture;
  pm.dispose();
  return tex;
}

const V = 10; // 배틀 세계에서 큰 쪽 몸길이(battle.js 의 S). 무대 장식 크기는 이것에 맞춘다
const LOOKS = {
  grassland: { top: '#5ea6da', horizon: '#dcefef', ground: ['#94c75c', '#a6d26a'], fog: 1, hills: ['#9fbfb6', '#7fa88a'] },
  jungle: { top: '#4b8a72', horizon: '#c8ddb2', ground: ['#4d8732', '#5a983b'], fog: 0.75, hills: ['#86ad8a', '#4f8455'] },
  waterside: { top: '#69b2df', horizon: '#e6f2ec', ground: ['#e2cf98', '#d5bf86'], fog: 1, hills: ['#a9c3c3', '#86a89a'] },
  underwater: { top: '#0b3c63', horizon: '#2e86a6', ground: ['#cbbb8b', '#baa979'], fog: 0.35, hills: ['#2a7393', '#1f5c78'] },
};

const GEO = new THREE.BoxGeometry(1, 1, 1);
const mat = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 });

function seeded(n) {
  let s = n >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
// 같은 상자를 여러 개: list = [[x, y, z, w, h, d, ry], …]
function boxes(list, color) {
  const m = new THREE.InstancedMesh(GEO, mat(color), list.length), o = new THREE.Object3D();
  list.forEach(([x, y, z, w, h, d, ry = 0], i) => {
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    o.rotation.set(0, ry, 0);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.receiveShadow = true;
  m.userData.list = list;
  return m;
}
function gradient(top, bottom) {
  const c = Object.assign(document.createElement('canvas'), { width: 2, height: 256 }), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 땅: 두 색 줄무늬 + 밝고 어두운 얼룩 + 점점이 픽셀(마인크래프트처럼 또렷하게). dots: 작은 꽃·조약돌 픽셀 색들
function groundTex([a, b], rnd, dots = []) {
  const N = 32, c = Object.assign(document.createElement('canvas'), { width: N, height: N }), g = c.getContext('2d'), A = new THREE.Color(a), B = new THREE.Color(b), t0 = new THREE.Color();
  const blobs = Array.from({ length: 6 }, () => [rnd() * N, rnd() * N, 3 + rnd() * 5, rnd() < 0.5 ? 0.88 : 1.1]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    t0.copy((y >> 2) % 2 ? A : B);
    for (const [bx, by, r, k] of blobs) { const dx = Math.min(Math.abs(x - bx), N - Math.abs(x - bx)), dy = Math.min(Math.abs(y - by), N - Math.abs(y - by)); if (dx * dx + dy * dy < r * r) t0.multiplyScalar(k); } // 이음새 없이 반복되는 큰 얼룩
    if (rnd() < 0.18) t0.multiplyScalar(0.86 + rnd() * 0.28);
    g.fillStyle = t0.getStyle();
    g.fillRect(x, y, 1, 1);
  }
  for (const d of dots) for (let i = 0; i < 3; i++) { g.fillStyle = d; g.fillRect(Math.floor(rnd() * N), Math.floor(rnd() * N), 1, 1); }
  const t = new THREE.CanvasTexture(c);
  Object.assign(t, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, colorSpace: THREE.SRGBColorSpace });
  t.repeat.set(40, 40);
  return t;
}

// 하늘 배경막: 비스듬히 내려다보는 카메라는 진짜 하늘이 화면에 안 들어와서, 싸우는 자리 뒤에 하늘·구름·먼 산을 그린 판을 세운다.
// 아래쪽은 지평선 색이라 안개 낀 땅과 이어진다. 픽셀은 또렷하게(블록풍)
function skyCurtain(look, stage, rnd) {
  // 판은 가로로 아주 길어서(SKY_W : SKY_H) 그림도 같은 비율로 그려야 픽셀이 네모로 남는다
  const H = 64, W = Math.round((H * ARENA.SKY_W) / ARENA.SKY_H), c = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, look.top);
  gr.addColorStop(1, look.horizon);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  // 네모 구름은 따로 투명한 판에 그려 하늘막 바로 앞에 겹친다(stagelife.js 가 옆으로 천천히 흘린다)
  const cc = Object.assign(document.createElement('canvas'), { width: W, height: H }), cg = cc.getContext('2d');
  if (stage !== 'underwater') for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = 8 + rnd() * 30, w = 14 + rnd() * 26;
    cg.fillStyle = '#ffffffe8';
    for (const dx of [0, -W]) { cg.fillRect(x + dx, y, w, 4); cg.fillRect(x + dx + w * 0.2, y - 3, w * 0.5, 3); } // 오른쪽 끝을 넘으면 왼쪽에 이어서(이음새 없이 반복)
  }
  look.hills.forEach((color, k) => { // 먼 산 두 겹, 계단 모양(아래쪽 조금만)
    g.fillStyle = color;
    let h = 6 + rnd() * 6;
    for (let x = 0; x < W; x += 4) {
      h = Math.max(2, Math.min(14 - k * 6, h + (rnd() - 0.5) * 4));
      g.fillRect(x, H - h - (1 - k) * 3, 4, h + 8);
    }
  });
  landmark(g, stage, W, H, look);
  const t = new THREE.CanvasTexture(c);
  Object.assign(t, { magFilter: THREE.NearestFilter, colorSpace: THREE.SRGBColorSpace });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, fog: false }));
  const ct = new THREE.CanvasTexture(cc);
  Object.assign(ct, { magFilter: THREE.NearestFilter, colorSpace: THREE.SRGBColorSpace, wrapS: THREE.RepeatWrapping });
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ct, fog: false, transparent: true, depthWrite: false }));
  clouds.name = 'clouds';
  clouds.position.z = 0.01;
  sky.add(clouds);
  return sky;
}

// 하늘막의 먼 경치 하나(무대마다): 초원은 연기 나는 화산, 정글은 절벽 폭포, 물가는 눈 덮인 산, 물속은 바위 아치. 계단 픽셀로
function landmark(g, stage, W, H, look) {
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const cx = W * 0.62, base = H - 4;
  if (stage === 'grassland') {
    for (let k = 0; k < 9; k++) px(cx - 22 + k * 2.2, base - k * 3, 44 - k * 4.4, 3, k > 6 ? '#8a6a5a' : '#7f8c8c'); // 화산
    px(cx - 3, base - 27, 6, 2, '#e0603a'); // 꼭대기 용암
    [[0, 0, 6], [2, -4, 7], [-1, -8, 8], [3, -12, 7], [1, -16, 6]].forEach(([dx, dy, w]) => px(cx - w / 2 + dx, base - 31 + dy, w, 4, '#c8c8c8d0')); // 연기
  } else if (stage === 'jungle') {
    px(cx - 16, base - 30, 32, 30, '#5f7a5a'); px(cx - 16, base - 32, 32, 3, '#3e6a34'); // 절벽 + 위 숲
    px(cx - 3, base - 30, 6, 30, '#dff4ff'); px(cx - 1, base - 30, 2, 30, '#ffffff'); px(cx - 6, base - 3, 12, 3, '#f4fbff'); // 폭포 + 물보라
  } else if (stage === 'waterside') {
    [[-30, 18], [0, 26], [26, 20]].forEach(([dx, h]) => { for (let k = 0; k < h; k += 2) px(cx + dx - (h - k) * 0.9, base - k, (h - k) * 1.8, 2, k > h - 7 ? '#f4f6f8' : look.hills[0]); }); // 눈 덮인 산 셋
  } else if (stage === 'underwater') {
    px(cx - 18, base - 22, 6, 22, '#2a6a84'); px(cx + 12, base - 22, 6, 22, '#2a6a84'); px(cx - 18, base - 26, 36, 6, '#2a6a84'); // 바위 아치
  }
}

// ── 무대 장식 ──
// 싸우는 띠(가운데)는 비워 둔다: 뒤(z < 0)와 멀리 양옆에만
const spot = (rnd, zMin, zMax, xMax = 14 * V, clear = 0) => {
  for (;;) {
    const x = (rnd() * 2 - 1) * xMax, z = zMin + rnd() * (zMax - zMin);
    if (Math.abs(x) > clear || z < -1.2 * V) return [x, z];
  }
};
function trees(rnd, n, { zMin = -2.4 * V, zMax = -0.8 * V, big = 1, leaf = ['#4f8f3a', '#5ea347', '#3f7a30'] } = {}) {
  const trunk = [], leaves = leaf.map(() => []);
  for (let i = 0; i < n; i++) {
    const [x, z] = spot(rnd, zMin, zMax, 14 * V, 4 * V), h = (0.7 + rnd() * 0.8) * V * big, s = (0.45 + rnd() * 0.35) * V * big;
    trunk.push([x, h / 2, z, 0.12 * V * big, h, 0.12 * V * big], [x, 0.04 * V * big, z, 0.22 * V * big, 0.08 * V * big, 0.22 * V * big]); // 줄기 + 뿌리 밑동
    const L = leaves[i % leaf.length];
    if (i % 4 === 3) for (let k = 0; k < 4; k++) L.push([x, h * 0.55 + k * s * 0.42, z, s * (1 - k * 0.22), s * 0.4, s * (1 - k * 0.22)]); // 뾰족한 침엽수(층층이 좁아진다)
    else L.push([x, h, z, s, s * 0.7, s], [x + s * 0.3, h - s * 0.35, z + s * 0.2, s * 0.65, s * 0.5, s * 0.65], [x - s * 0.25, h + s * 0.45, z - s * 0.1, s * 0.6, s * 0.45, s * 0.6]); // 둥근 나무(잎 덩어리 셋)
  }
  return [boxes(trunk, '#7a5634'), ...leaves.map((l, i) => boxes(l, leaf[i]))];
}
// 흔들리는 장식: 상자 목록을 userData.sway 에 남겨 두면 stagelife.js 가 매 프레임 흔든다(끝 두 값: 마디 번호, 밑동 기준 기울기 세기)
const swaying = m => ((m.userData.sway = m.userData.list), m);
const tufts = (rnd, n, color, h = 0.05) => swaying(boxes(Array.from({ length: n }, () => { const [x, z] = spot(rnd, -8 * V, 5 * V, 9 * V); return [x, h * V / 2, z, 0.022 * V, h * V * (0.6 + rnd() * 0.8), 0.04 * V, rnd() * 3, 0, 1]; }), color));
// 바위: 큰 돌 + 옆에 작은 돌. moss 가 있으면 위에 이끼 덮개
function rocks(rnd, n, color = '#9a978c', moss) {
  const st = [], top = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = spot(rnd, -10 * V, 5 * V, 10 * V, 2.5 * V), s = (0.08 + rnd() * 0.25) * V, r = rnd() * 3;
    st.push([x, s * 0.35, z, s, s * 0.7, s * 0.9, r], [x + s * 0.6, s * 0.15, z + s * 0.3, s * 0.45, s * 0.3, s * 0.4, r + 1]);
    if (moss) top.push([x, s * 0.72, z, s * 0.85, s * 0.08, s * 0.75, r]);
  }
  return [boxes(st, color), moss && boxes(top, moss)].filter(Boolean);
}
// 뒤쪽 언덕: 땅색 큰 상자를 계단처럼 쌓아 평평한 땅을 깬다
const terraces = (rnd, colors) => colors.map((c, k) => boxes(Array.from({ length: 14 }, () => { const x = (rnd() * 2 - 1) * 18 * V, z = -(3.5 + k * 2 + rnd() * 2) * V, w = (2 + rnd() * 3) * V, h = (0.25 + k * 0.35 + rnd() * 0.4) * V; return [x, h / 2, z, w, h, (1.5 + rnd()) * V]; }), c));
// 낮은 덤불(상자 두세 개 뭉치)과 꽃: 내려다보는 화면에서 싸우는 자리 바로 뒤를 채운다
function bushes(rnd, n, colors, size = 1) {
  const lists = colors.map(() => []);
  for (let i = 0; i < n; i++) {
    const [x, z] = spot(rnd, -4 * V, -0.7 * V, 12 * V, 3 * V), s = (0.12 + rnd() * 0.18) * V * size, l = lists[i % colors.length];
    l.push([x, s * 0.4, z, s, s * 0.8, s * 0.9, rnd()], [x + s * 0.45, s * 0.3, z + s * 0.2, s * 0.7, s * 0.6, s * 0.7, rnd()]);
  }
  return lists.map((l, i) => boxes(l, colors[i]));
}
const flowers = (rnd, n) => ['#f3d34a', '#f08aa8', '#ffffff'].map(c => boxes(Array.from({ length: n }, () => { const [x, z] = spot(rnd, -5 * V, 4 * V, 10 * V, 1.5 * V); return [x, 0.02 * V, z, 0.035 * V, 0.03 * V, 0.035 * V]; }), c));
function ferns(rnd, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = spot(rnd, -6 * V, -0.9 * V, 12 * V, 3 * V), s = (0.25 + rnd() * 0.3) * V, r = rnd() * 3;
    for (let k = 0; k < 3; k++) out.push([x, s * 0.3, z, s, s * 0.5, s * 0.12, r + (k * Math.PI) / 3, 0, 0.4]);
  }
  return swaying(boxes(out, '#3d7a2a'));
}
function kelp(rnd, n) {
  const stalks = [], tops = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = spot(rnd, -2.6 * V, -0.9 * V, 12 * V, 3 * V), k = 3 + Math.floor(rnd() * 4), s = 0.12 * V;
    for (let j = 0; j < k; j++) (j === k - 1 ? tops : stalks).push([x + Math.sin(j) * s * 0.4, s * (j + 0.5) * 1.6, z, s, s * 1.6, s * 0.5, rnd(), j]); // 끝 값 j: 몇 번째 마디(위로 갈수록 크게 흔들림, stagelife.js)
  }
  return [boxes(stalks, '#2f7d4a'), boxes(tops, '#4aa060')].map((m, i) => ((m.userData.sway = i ? tops : stalks), m));
}
// 산호: 덩어리 산호 + 가지 산호(줄기에서 가지가 위로 갈라진다)
const coral = rnd => ['#e0776b', '#f0a95a', '#c873b0', '#f2e0a0'].map(c => boxes(Array.from({ length: 14 }, () => { const [x, z] = spot(rnd, -5 * V, -1.2 * V, 10 * V, 2.5 * V), s = (0.1 + rnd() * 0.2) * V; return [x, s / 2, z, s * 0.7, s, s * 0.7, rnd()]; }).flatMap((b, i) => i % 2 ? [b] : [b, [b[0] - b[3] * 0.5, b[4] * 1.3, b[2], b[3] * 0.25, b[4] * 0.9, b[3] * 0.25], [b[0] + b[3] * 0.45, b[4] * 1.2, b[2], b[3] * 0.25, b[4] * 0.7, b[3] * 0.25]]), c));

function decor(stage, rnd) {
  if (stage === 'jungle') return [...trees(rnd, 70, { big: 1.4, leaf: ['#2f6f2a', '#3f8433', '#265c22'] }), ferns(rnd, 60), ...bushes(rnd, 50, ['#2e6b28', '#3d8030'], 1.4), tufts(rnd, 500, '#3b7428', 0.12), ...rocks(rnd, 15, '#77786a', '#4a7a32'), ...terraces(rnd, ['#3f7a2e', '#356a28'])];
  if (stage === 'waterside') {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(60 * V, 30 * V), new THREE.MeshStandardMaterial({ color: '#5cb8e6', transparent: true, opacity: 0.45, roughness: 0.2 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.015 * V, 13.9 * V); // 앞쪽은 얕은 물, 싸우는 자리 바로 뒤부터 모래 둑
    water.receiveShadow = true;
    const pads = boxes(Array.from({ length: 30 }, () => [(rnd() * 2 - 1) * 12 * V, 0.02 * V, (1.5 + rnd() * 4) * V, (0.12 + rnd() * 0.1) * V, 0.01 * V, (0.12 + rnd() * 0.1) * V, rnd() * 3]), '#5f9a3a'); // 물 위 연잎
    return [water, pads, ...terraces(rnd, ['#cbb98a', '#a9b88a']), ...trees(rnd, 25, { zMin: -2.6 * V, zMax: -1.6 * V }), swaying(boxes(Array.from({ length: 160 }, () => { const [x, z] = spot(rnd, -1.6 * V, -1.25 * V, 12 * V); return [x, 0.12 * V, z, 0.03 * V, (0.15 + rnd() * 0.2) * V, 0.03 * V, 0, 0, 1]; }), '#7f9a48')), ...rocks(rnd, 25), ...bushes(rnd, 20, ['#6f9a44', '#83a94e'])];
  }
  if (stage === 'underwater') return [...kelp(rnd, 60), ...coral(rnd), ...rocks(rnd, 30, '#6f7f80', '#4a8a6a')];
  return [...trees(rnd, 30), ...bushes(rnd, 35, ['#5f9a3a', '#4f8a32', '#6fae44']), ...flowers(rnd, 60), tufts(rnd, 700, '#6a9e3c'), ...rocks(rnd, 25, '#9a978c', '#6a9e3c'), ...terraces(rnd, ['#8fbf58', '#7fae4c'])];
}

// 클로즈업 카메라: 머리(head)를 코가 향한 쪽(side ±1)으로 yaw 도 돌려 비스듬히, 눈높이보다 살짝 위에서. 거리는 머리 크기(size)에 비례
export function closeCam(head, size, side, yaw = CLOSE.YAW) {
  const a = (yaw * Math.PI) / 180, e = (CLOSE.ELEV * Math.PI) / 180;
  const dir = new THREE.Vector3(side * Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  return { pos: head.clone().addScaledVector(dir, size * CLOSE.DIST), look: head.clone() };
}
// 얼굴 자리와 크기(세계 단위). 아래턱 상자 위쪽을 머리 가운데로 친다. 아이 그림(턱 없음)은 그림 전체를 정면으로
const box3 = new THREE.Box3(), bs = new THREE.Vector3();
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);
function face(v) {
  const hy = v.rig.root.position.y; // 아이 그림 판: 가운데 높이(몸길이 1 기준)
  if (!v.rig.jaw) return { head: new THREE.Vector3(0.5, hy, 0).applyMatrix4(v.holder.matrix), size: 0.35 * v.F.L * Math.max(1, 2 * hy), yaw: 0 };
  v.holder.updateMatrixWorld(true);
  // 턱 상자가 비어 있는 몸(삼엽충 등)은 머리 전체, 그것도 없으면 몸 전체 상자의 가운데
  const jaw = !box3.setFromObject(v.rig.jaw).isEmpty();
  if (!jaw && box3.setFromObject(v.rig.head).isEmpty()) box3.setFromObject(v.rig.root);
  box3.getSize(bs);
  const head = box3.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, jaw ? bs.y * 0.6 : 0, 0));
  // 크기: 턱이 작고 머리가 큰 동물(매머드)도 머리·목까지 담기게 키의 1/4 보다는 크게
  return { head, size: clamp(Math.max(bs.x, bs.y, bs.z, 0.25 * v.F.h), 0.08 * v.F.L, 0.4 * v.F.L) };
}

// 그림이 3D 모델이 없으면(아이 그림) 사진 한 장을 세운다
function flat(a) {
  const { url, aspect } = a.drawing, tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, aspect), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
  m.position.set(0.5, aspect / 2, 0);
  m.castShadow = true;
  return { root: m };
}

// 공격마다 다른 부딪힘 효과(블록 조각). 카메라는 그대로(차분하게)
// ground 짓밟기·들이받기: 땅에 금이 쩍(어두운 띠가 사방으로) + 흙먼지 고리 / tail 꼬리치기: 휘두른 궤적 / bite 물기: 위아래 이빨 자국이 탁 닫힌다 / kick 발차기: 흙이 위로
export function impactFx(scene, look) {
  const MAX = 120, o = new THREE.Object3D(), crack = new THREE.Color(look.ground[0]).multiplyScalar(0.45);
  const mk = (m, n) => { const x = new THREE.InstancedMesh(GEO, m, n); x.frustumCulled = false; scene.add(x); return x; };
  const solid = mk(new THREE.MeshLambertMaterial(), MAX), glow = mk(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), MAX);
  const bits = [], c = new THREE.Color();
  const add = (mesh, b) => bits.push({ mesh, age: 0, ...b });
  return {
    spawn(kind, at, s, dir = 1) {
      if (kind === 'ground') {
        for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + Math.random() * 0.4, L = s * (1.2 + Math.random()); add(solid, { p: new THREE.Vector3(at.x + Math.cos(a) * L * 0.5, 0.004 * s, at.z + Math.sin(a) * L * 0.5), sc: [L, 0.01 * s, s * 0.12], ry: -a, life: 1.6, color: crack, grow: 0.15 }); }
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; add(solid, { p: new THREE.Vector3(at.x, s * 0.1, at.z), v: new THREE.Vector3(Math.cos(a) * s * 3, s * 0.6, Math.sin(a) * s * 3), sc: [s * 0.2, s * 0.2, s * 0.2], life: 0.7, color: new THREE.Color(look.ground[1]).lerp(new THREE.Color('#c8b48a'), 0.5), shrink: true }); }
      } else if (kind === 'tail') {
        for (let k = 0; k < 9; k++) { const a = -0.9 + k * 0.22; add(glow, { p: new THREE.Vector3(at.x - dir * Math.cos(a) * s * 1.4, at.y + Math.sin(a) * s * 1.2, at.z + s * 0.3), sc: [s * 0.35, s * 0.08, s * 0.08], rz: a + Math.PI / 2, life: 0.35 + k * 0.03, color: new THREE.Color('#ffffff'), shrink: true }); }
      } else if (kind === 'bite') {
        for (const up of [1, -1]) for (let k = 0; k < 5; k++) add(glow, { p: new THREE.Vector3(at.x + (k - 2) * s * 0.28, at.y + up * s * 0.55, at.z + s * 0.3), v: new THREE.Vector3(0, -up * s * 3, 0), stop: at.y + up * s * 0.12, sc: [s * 0.14, s * 0.3, s * 0.14], life: 0.45, color: new THREE.Color('#fffbe8'), shrink: true });
      } else if (kind === 'punch') {
        for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; add(glow, { p: new THREE.Vector3(at.x, at.y, at.z + s * 0.3), v: new THREE.Vector3(Math.cos(a) * s * 4, Math.sin(a) * s * 4, 0), sc: [s * 0.5, s * 0.09, s * 0.09], rz: a, life: 0.35, color: new THREE.Color('#fff1a0'), shrink: true }); }
      } else if (kind === 'kick') {
        for (let k = 0; k < 12; k++) add(solid, { p: new THREE.Vector3(at.x, s * 0.1, at.z), v: new THREE.Vector3((Math.random() - 0.5) * s * 3, s * (3 + Math.random() * 3), (Math.random() - 0.5) * s * 2), g: s * 12, sc: [s * 0.18, s * 0.18, s * 0.18], life: 0.8, color: new THREE.Color(look.ground[1]).multiplyScalar(0.8), shrink: true });
      }
      while (bits.length > MAX) bits.shift();
    },
    update(dt) {
      const n = new Map([[solid, 0], [glow, 0]]);
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        if ((b.age += dt) > b.life) { bits.splice(i, 1); continue; }
        if (b.v) { if (b.g) b.v.y -= b.g * dt; b.p.addScaledVector(b.v, dt); if (b.stop != null && Math.sign(b.v.y) * (b.p.y - b.stop) > 0) { b.p.y = b.stop; b.v.set(0, 0, 0); } }
        const k = b.shrink ? 1 - b.age / b.life : Math.min(1, 1 + (b.grow ?? 0) * b.age);
        o.position.copy(b.p); o.rotation.set(0, b.ry ?? 0, b.rz ?? 0); o.scale.set(b.sc[0] * k, b.sc[1] * (b.shrink ? k : 1), b.sc[2] * k); o.updateMatrix();
        const i2 = n.get(b.mesh);
        b.mesh.setMatrixAt(i2, o.matrix);
        b.mesh.setColorAt(i2, c.copy(b.color).lerp(look.ground0 ??= new THREE.Color(look.ground[0]), b.shrink ? 0 : Math.max(0, b.age / b.life - 0.5) * 2)); // 땅 금은 반쯤 지나면 땅색으로 흐려진다
        n.set(b.mesh, i2 + 1);
      }
      for (const [m, k] of n) { m.count = k; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    },
  };
}
const HIT_KIND = { punch: 'punch', hook: 'punch', upper: 'punch', roundkick: 'punch', stomp: 'ground', ram: 'ground', toss: 'ground', tail: 'tail', bite: 'bite', shake: 'bite', roll: 'bite', pounce: 'bite', kick: 'kick' };

// v 가 상대 u 의 얼굴을 보려면 고개를 얼마나 돌려야 하나: [도리(+ 몸 왼쪽=카메라 쪽), 끄덕(+ 위)] 라디안. 몸 좌표(코 +x, 위 +y)에서 잰다
const lk = new THREE.Vector3(), lk2 = new THREE.Vector3(), lkM = new THREE.Matrix4();
export function lookAt(v, u) {
  lkM.copy(v.holder.matrix).invert();
  const me = v.rig.jaw ? v.rig.jaw.getWorldPosition(lk).applyMatrix4(lkM) : lk.set(0.9, 0.4, 0);
  const to = (u.rig?.jaw ? u.rig.jaw.getWorldPosition(lk2) : u.mover?.center ? lk2.copy(u.mover.center) : null)?.applyMatrix4(lkM);
  if (!to) return [0, 0];
  const d = to.sub(me), fwd = Math.max(1e-3, Math.hypot(d.x, d.z));
  if (d.x < 0) return [0, 0]; // 상대가 등 뒤면(지나쳐 갔을 때) 억지로 돌리지 않는다
  return [clamp(Math.atan2(d.z, d.x), -0.5, 0.5), clamp(Math.atan2(d.y, fwd), -0.35, 0.35)];
}

// 발자국·흙먼지: 걷거나 달릴 때 발을 디딜 때마다 발밑에 흙 블록이 튀고, 큰 동물은 발자국이 잠깐 남았다 사라진다
// (물속은 없음. 헤엄·나는 동물도 없음). 다리 앞뒤 휘두름(ls)이 앞으로 가장 나갔다 돌아서는 순간을 "디딤"으로 본다
export function footsteps(scene, look) {
  const DUST = 90, PRINT = 40, o = new THREE.Object3D(), c = new THREE.Color(), ground = new THREE.Color(look.ground[0]), dark = ground.clone().multiplyScalar(0.55), dustC = new THREE.Color(look.ground[1]).lerp(new THREE.Color('#c8b48a'), 0.5);
  const dust = new THREE.InstancedMesh(GEO, mat(dustC.getStyle()), DUST), print = new THREE.InstancedMesh(GEO, new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: -2 }), PRINT);
  dust.frustumCulled = print.frustumCulled = false;
  print.receiveShadow = true;
  scene.add(dust, print);
  const puffs = [], prints = [], tmp = new THREE.Vector3();
  return {
    // v: 무대의 동물 하나, moving: 걷거나 달리는 중
    step(v, moving) {
      const ls = v.P.ls, prev = (v.lsPrev ??= ls.slice()), up = (v.lsUp ??= ls.map(() => false));
      ls.forEach((x, i) => {
        const rising = x > prev[i] + 1e-4, falling = x < prev[i] - 1e-4;
        if (moving && up[i] && falling) { // 앞으로 내딛던 발이 돌아서는 순간 = 땅을 디딤
          v.rig.legs[i].g.getWorldPosition(tmp);
          const L = v.F.L, s = L * 0.045;
          for (let k = 0; k < 4; k++) puffs.push({ p: new THREE.Vector3(tmp.x + (Math.random() - 0.5) * s * 2, s * 0.4, tmp.z + (Math.random() - 0.5) * s * 2), v: new THREE.Vector3((Math.random() - 0.5) * s * 4, s * (2 + Math.random() * 2), (Math.random() - 0.5) * s * 3), age: 0, life: 0.6, size: s * (0.5 + Math.random() * 0.5) });
          if (L > 2.5) prints.push({ x: tmp.x + v.side * s, z: tmp.z, age: 0, life: 4, w: s * 2.2, d: s * 1.6 }); // 큰 동물만 발자국
        }
        if (rising) up[i] = true; else if (falling) up[i] = false;
        prev[i] = x;
      });
      while (puffs.length > DUST) puffs.shift();
      while (prints.length > PRINT) prints.shift();
    },
    update(dt) {
      let n = 0;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const q = puffs[i];
        if ((q.age += dt) > q.life) { puffs.splice(i, 1); continue; }
        q.v.y -= q.size * 12 * dt;
        q.p.addScaledVector(q.v, dt);
        const k = q.size * (1 - q.age / q.life);
        o.position.copy(q.p); o.rotation.set(q.age * 3, q.age * 2, 0); o.scale.setScalar(k); o.updateMatrix();
        dust.setMatrixAt(n++, o.matrix);
      }
      dust.count = n;
      dust.instanceMatrix.needsUpdate = true;
      n = 0;
      for (let i = prints.length - 1; i >= 0; i--) {
        const q = prints[i];
        if ((q.age += dt) > q.life) { prints.splice(i, 1); continue; }
        o.position.set(q.x, 0.004 * q.w, q.z); o.rotation.set(0, 0, 0); o.scale.set(q.w, 0.01 * q.w, q.d); o.updateMatrix();
        print.setMatrixAt(n, o.matrix);
        print.setColorAt(n++, c.copy(dark).lerp(ground, Math.max(0, (q.age / q.life - 0.5) * 2))); // 반쯤 지나면 땅색으로 흐려진다
      }
      print.count = n;
      print.instanceMatrix.needsUpdate = true;
      if (print.instanceColor) print.instanceColor.needsUpdate = true;
    },
  };
}

// arena: .arena 요소, f: battle.js 의 싸우는 둘(F.a, F.pos, F.pose), stage: 무대 이름. 반환값이 없으면 3D를 못 써서 2D 그대로
export function arena3d(arena, f, stage) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    console.warn('WebGL을 쓸 수 없어 2D 무대로 합니다', e);
    return null;
  }
  const look = LOOKS[stage] ?? LOOKS.grassland, rnd = seeded([...stage].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
  const svg = arena.querySelector('svg'), camEl = arena.querySelector('.cam');
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cv = renderer.domElement;
  cv.className = 'a3d-canvas';
  arena.prepend(cv);
  arena.classList.add('a3d');

  const scene = new THREE.Scene();
  scene.background = gradient(look.top, look.horizon);
  scene.fog = new THREE.Fog(look.hills[1], 1, 2); // 먼 땅은 하늘막 아래 산 색으로 흐려져 이어진다
  scene.add(new THREE.HemisphereLight(stage === 'underwater' ? '#cfefff' : '#ffffff', look.ground[0], stage === 'underwater' ? 1.3 : 1.1));
  const sun = new THREE.DirectionalLight(stage === 'underwater' ? '#d8f2ff' : '#fff2da', 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02 * V; // 맞닿은 상자 경계의 그림자 줄 막기
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80 * V, 80 * V), new THREE.MeshStandardMaterial({ map: groundTex(look.ground, rnd, { grassland: ['#f3d34a', '#ffffff', '#8a8478'], jungle: ['#2a4a1e', '#5a4a30'], waterside: ['#f0e4c0', '#9a8a6a'], underwater: ['#e0d4b0', '#9aa8a0'] }[stage]), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  const sky = skyCurtain(look, stage, rnd);
  scene.add(ground, sky, ...decor(stage, rnd));
  // 실사: 낮은 해 + 환경광 + 톤 매핑, 후처리(구석 그림자 AO → 색 → 비네트)
  const sunEl = (REAL.SUN_ELEV * Math.PI) / 180, yw = (REAL.SUN_YAW * Math.PI) / 180;
  const sunDir = new THREE.Vector3(Math.sin(yw) * Math.cos(sunEl), Math.sin(sunEl), Math.cos(yw) * Math.cos(sunEl)); // 왼쪽 옆(조금 카메라 쪽)에서 비춰 몸의 굴곡이 그림자로 드러난다
  let composer, ao;
  if (IS_REAL) {
    renderer.toneMapping = THREE.NeutralToneMapping; // 밝은 곳만 부드럽게 눌러 주고 색은 그대로(ACES 는 피부색이 회색으로 바랜다)
    renderer.toneMappingExposure = REAL.EXPOSURE;
    scene.environment = skyEnv(renderer, look, sunDir);
    scene.environmentIntensity = REAL.ENV;
    scene.children.find(o => o.isHemisphereLight).intensity = REAL.HEMI;
    sun.intensity = REAL.SUN;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.radius = 3;
    sun.shadow.normalBias = 0.002 * V;
  }
  const life = stageLife(stage, scene, rnd, V); // 무대의 작은 생물·물방울 등(stagelife.js)
  const steps = stage === 'underwater' ? null : footsteps(scene, look), hits = impactFx(scene, look);

  // 효과(먼지·불꽃·할퀸 자국·K.O. 별): battle.js 가 .fx 에 그리는 2D 조각을 매 프레임 블록 조각으로 옮긴다
  const fxEl = arena.querySelector('.fx'), FX_MAX = 160, fxMesh = new THREE.InstancedMesh(GEO, new THREE.MeshBasicMaterial(), FX_MAX), o = new THREE.Object3D(), tint = new THREE.Color();
  fxMesh.frustumCulled = false;
  fxMesh.castShadow = true;
  scene.add(fxMesh);
  const cam = new THREE.PerspectiveCamera(ARENA.FOV, 1, 0.1, 2000 * V);
  if (IS_REAL && !LOW) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, cam));
    if (REAL.AO) composer.addPass((ao = new GTAOPass(scene, cam, 1, 1)));
    composer.addPass(new OutputPass());
    const vig = new ShaderPass(VignetteShader);
    vig.uniforms.darkness.value = REAL.VIGNETTE;
    composer.addPass(vig);
  }
  const views = f.map(F => {
    const rig = F.a.drawing ? flat(F.a) : buildModel(F.a);
    if (!rig) return null;
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.add(rig.root);
    scene.add(holder);
    const info = rig.all && rigInfo(rig);
    return { F, rig, info, holder, inner: F.pose.firstElementChild, P: info && restPose(info) };
  });
  if (views.some(v => !v)) { // 한쪽이라도 3D로 못 그리면 2D 그대로
    cv.remove();
    arena.classList.remove('a3d');
    renderer.dispose();
    return null;
  }

  const elev = (ARENA.CAM_ELEV_DEG * Math.PI) / 180, ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
  let last = 0, cu = null, last3 = null;
  // ?fps: 왼쪽 아래에 1초마다 화면 수(전자칠판에서 30 이상이면 괜찮다)
  const fpsEl = Q.has('fps') ? arena.appendChild(Object.assign(document.createElement('div'), { style: 'position:absolute;left:8px;bottom:8px;z-index:9;color:#fff;background:#0008;padding:2px 8px;border-radius:6px;font:16px monospace' })) : null;
  const v0 = {};
  const tick = now => {
    if (!arena.isConnected) return renderer.dispose();
    const t = now / 1000, dt = Math.min(0.1, last ? t - last : 0);
    last = t;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); composer?.setPixelRatio(renderer.getPixelRatio()); composer?.setSize(w, h); }
    // 2D 카메라가 보는 가운데와 높이(세계 단위). SVG 는 y가 아래로라 뒤집는다
    const toWorld = camEl.getCTM().inverse(), c = new DOMPoint(svg.clientWidth / 2, svg.clientHeight / 2).matrixTransform(toWorld);
    const visH = svg.clientHeight * Math.hypot(toWorld.a, toWorld.b), d = (visH / 2 / Math.tan((ARENA.FOV * Math.PI) / 360)) * ARENA.FIT;
    const target = new THREE.Vector3(c.x, Math.max(0, -c.y) * 0.5, -visH * ARENA.LOOK_BACK); // 조금 뒤를 봐서 동물은 화면 아래, 뒤 배경이 더 보이게
    const wideP = new THREE.Vector3(target.x, target.y + Math.sin(elev) * d, target.z + Math.cos(elev) * d);
    // 하늘막: 카메라를 따라 늘 싸우는 자리 뒤 같은 거리에, 화면을 넉넉히 덮는 크기로
    sky.scale.set(ARENA.SKY_W * d, ARENA.SKY_H * d, 1);
    sky.position.set(target.x, (ARENA.SKY_H / 2) * d, target.z - ARENA.SKY_BACK * d);
    scene.fog.near = d * 0.9;
    scene.fog.far = d + (stage === 'underwater' ? 4 : 45) * V * look.fog * Math.max(1, visH / (3 * V));
    if (IS_REAL) sun.position.copy(sunDir).multiplyScalar(2 * d).add(target);
    else sun.position.set(target.x - 0.6 * d, 1.2 * d, 0.8 * d);
    sun.target.position.copy(target);
    const sh = IS_REAL ? 1.6 * visH : visH; // 해가 낮으면 그림자가 길어 더 넓게 담는다
    Object.assign(sun.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 0.1, far: 4 * d });
    sun.shadow.camera.updateProjectionMatrix();
    for (const v of views) {
      // 몸 좌표(u 꼬리→코, v 위) → SVG 세계(x, 아래로 y) 행렬을 3D(위로 y)로.
      // 2D는 돌아설 때 그림을 좌우로 뒤집는데(폭이 0을 지난다), 3D에서는 그만큼 몸을 세로축으로 돌린다. 오른쪽 동물도 거울 대신 180도 돌려 세운다
      const m = toWorld.multiply(v.inner.getCTM()), L0 = v.F.L, ab = Math.hypot(m.a, m.b);
      if (ab > L0 * 1e-4) v.u = [m.a / ab, -m.b / ab];
      const xl = ab / L0, [ux, uy] = v.u ?? [1, 0], turn = Math.sqrt(Math.max(0, 1 - xl * xl));
      ax.set(ux * xl * L0, uy * xl * L0, turn * L0); // 코 쪽: 돌아서는 동안은 카메라 쪽으로 돈다
      ay.set(-m.c, m.d, 0);
      az.crossVectors(ax, ay).normalize().multiplyScalar(L0);
      v.holder.matrix.makeBasis(ax, ay, az).setPosition(m.e, -m.f, 0);
      v.side = Math.sign(ax.x) || 1; // 코가 화면 오른쪽(+1)·왼쪽(-1)
      v.holder.matrixWorldNeedsUpdate = true;
      // 몸 가운데 자리와 움직인 빠르기(헤엄치면 물방울이 생긴다)
      const ctr = new THREE.Vector3(0.5, 0.2, 0).applyMatrix4(v.holder.matrix);
      v.mover = { center: ctr, speed: v.mover && dt ? ctr.distanceTo(v.mover.center) / dt : 0, swim: v.F.mode === 'swim' };
      if (!v.info) continue;
      const { state, o } = stateOf(v.F.pos.classList);
      o.step = v.step = (v.step ?? 0) + dt * (+v.F.pos.dataset.gait || 9);
      blend(v.P, targetPose(state, t, v.info, o), dt);
      // 상대 얼굴 쪽으로 고개를 돌린다(큰 상대는 올려다보고 작은 상대는 내려다본다). 포효·맞음·K.O.·물기 중에는 그 동작대로
      const other = views.find(u => u !== v), want = ['idle', 'wind', 'charge', 'tired'].includes(state) && other ? lookAt(v, other) : [0, 0];
      v.lk = (v.lk ?? [0, 0]).map((a, i) => a + (want[i] - a) * Math.min(1, dt * 4));
      applyPose(v.rig, { ...v.P, hy: v.P.hy + v.lk[0], hp: v.P.hp + v.lk[1] });
      if (steps && !v.info.swim && !o.swim && !o.flying && !v.F.y) { v.holder.updateMatrixWorld(true); steps.step(v, o.moving || state === 'charge'); }
    }
    // 카메라: 평소엔 2D 카메라를 따른 넓은 화면. 클로즈업 중엔 그때 있던 자리에서 목표(얼굴 또는 넓은 화면)로 천천히 옮겨 간다
    let camP = wideP, camQ = target;
    if (cu) {
      const e = smooth(Math.min(1, (now - cu.t0) / cu.ms));
      if (cu.i != null) { const fc = face(views[cu.i]), c = closeCam(fc.head, fc.size, views[cu.i].side, fc.yaw); [camP, camQ] = [c.pos, c.look]; }
      camP = cu.p.clone().lerp(camP, e);
      camQ = cu.q.clone().lerp(camQ, e);
      if (cu.i == null && e >= 1) cu = null;
    }
    cam.position.copy(camP);
    cam.lookAt(camQ);
    last3 = [camP, camQ];
    // ponytail: near 를 거리에 맞춰 줄인다. 아주 작은 동물을 가까이 볼 땐 먼 배경이 조금 깜빡일 수 있음 → 그때는 logarithmicDepthBuffer
    const near = Math.min(0.1, 0.05 * camP.distanceTo(camQ));
    if (Math.abs(cam.near - near) > near * 0.01) { cam.near = near; cam.updateProjectionMatrix(); }
    let n = 0, lastFx = null;
    for (const el of fxEl.children) {
      if (n >= FX_MAX) break;
      const bb = el.getBBox();
      if (!bb.width) continue;
      const m = toWorld.multiply(el.getCTM()), c = new DOMPoint(bb.x + bb.width / 2, bb.y + bb.height / 2).matrixTransform(m), size = Math.max(bb.width, bb.height) * Math.hypot(m.a, m.b), op = +getComputedStyle(el).opacity;
      const cl = el.classList, kind = cl.contains('star') ? 'star' : cl.contains('spark') ? 'spark' : cl.contains('slash') ? 'slash' : 'dust';
      o.position.set(c.x, -c.y, kind === 'dust' ? (((n * 37) % 7) / 3 - 1) * size * 0.5 : size * 0.3);
      o.rotation.set(kind === 'dust' ? n : t * 3 + n, kind === 'dust' ? n * 2 : t * 4, kind === 'slash' ? 0.5 : 0);
      const k = kind === 'dust' ? size * 0.8 * (0.4 + 0.6 * op) : op > 0.05 ? size * (kind === 'slash' ? 0.15 : 0.6) : 0;
      o.scale.set(k, kind === 'slash' ? size * 0.9 * op : k, k);
      o.updateMatrix();
      (lastFx ??= new THREE.Vector3()).copy(o.position);
      fxMesh.setMatrixAt(n, o.matrix);
      fxMesh.setColorAt(n, tint.set(kind === 'dust' ? el.getAttribute('fill').slice(0, 7) : kind === 'star' ? '#ffd23a' : kind === 'spark' ? '#fff3a0' : '#ffffff'));
      n++;
    }
    // 세게 부딪힌 순간: 먼지 조각이 한꺼번에 여럿 생긴다 → 그 자리를 무대 생물에게 알린다
    const impact = fxEl.children.length - (v0.fx ?? 0) >= 5 && lastFx ? lastFx.clone() : null;
    v0.fx = fxEl.children.length;
    if (impact) { // 누가 무슨 공격으로 쳤나(공격자 .pos 에 m-종류 표시가 남아 있다)
      const att = views.find(u => [...u.F.pos.classList].some(c => c.startsWith('m-'))), m = att && [...att.F.pos.classList].find(c => c.startsWith('m-')).slice(2), kind = HIT_KIND[m];
      if (kind && !(!['bite', 'tail', 'punch'].includes(kind) && stage === 'underwater')) hits.spawn(kind, impact, Math.min(...views.map(u => u.F.L)) * 0.12, att.side);
    }
    // K.O. 순간에는 무대 생물이 잠깐 거의 멈춘다(그 순간을 강조)
    const ko = arena.querySelector('.boom')?.classList.contains('ko');
    v0.koAt = ko ? v0.koAt ?? t : null;
    const slow = v0.koAt != null && t - v0.koAt < 1.6 ? 0.08 : 1;
    v0.lt = (v0.lt ?? t) + dt * slow;
    life?.update(v0.lt, dt * slow, { target, d, visH: 2 * d * Math.tan((ARENA.FOV * Math.PI) / 360), aspect: w / h, impact, movers: views.map(v => v.mover) });
    steps?.update(dt);
    hits.update(dt);
    fxMesh.count = n;
    fxMesh.instanceMatrix.needsUpdate = true;
    if (fxMesh.instanceColor) fxMesh.instanceColor.needsUpdate = true;
    if (ao) { // 구석 그림자 반경은 지금 화면 크기에 맞춘다(작은 동물 클로즈업도 같은 느낌)
      const r = REAL.AO_RADIUS * camP.distanceTo(camQ);
      if (Math.abs(r - (v0.aoR ?? 0)) > r * 0.05) ao.updateGtaoMaterial({ radius: (v0.aoR = r), thickness: r * 2, scale: REAL.AO });
    }
    composer ? composer.render(dt) : renderer.render(scene, cam);
    if (fpsEl && (v0.fn = (v0.fn ?? 0) + 1) && now - (v0.ft ??= now) > 1000) { fpsEl.textContent = `${Math.round((v0.fn * 1000) / (now - v0.ft))} fps`; v0.fn = 0; v0.ft = now; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // closeup(i, ms): i번 동물 얼굴로, closeup(null, ms): 넓은 화면으로. 지금 카메라 자리에서 ms 동안 천천히
  return {
    closeup: (i, ms) => {
      if (last3) cu = { i, ms, t0: performance.now(), p: last3[0].clone(), q: last3[1].clone() };
      return new Promise(r => setTimeout(r, ms));
    },
  };
}
