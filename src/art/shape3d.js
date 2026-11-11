// 3D 체형 틀. 2D(draw.js)와 같은 원형 이름·비율(params)을 받아 같은 몸 좌표에 모델을 만든다.
// 몸 좌표: 몸길이 1(꼬리끝 x=0 → 코끝 x=1), y 위, 땅 y=0, z 몸 왼쪽(카메라 쪽).
// 그림체는 reference/ 의 도감 느낌: 매끈한 몸, 차분한 흙빛, 짙은 등·크림빛 배, 은은한 얼룩과 피부 요철.
// 모델 = rig { root, all(몸 전체), head(⊃ jaw), tail[마디], legs[{ g 엉덩이·어깨, knee?, side, front, ph? }], wings[], swim, fly }
import * as THREE from 'three';
import { ARCHETYPES } from './draw.js';

const V = THREE.Vector3, sm = THREE.MathUtils.smoothstep;
const TOOTH = '#e8dfc6', EYE = '#120f0b', IRIS = '#b8862e', MOUTH = '#3f3530', HORN = '#8f826b', CLAW = '#2c2823', BEAK = '#b89a5a';

// ── 피부 질감(범프 맵) ──
// scale 비늘, fur 털결, feather 깃털, smooth 매끈(상어·고래), shell 껍데기
const bumps = {};
function bumpMap(kind) {
  if (bumps[kind]) return bumps[kind];
  const N = 256, c = Object.assign(document.createElement('canvas'), { width: N, height: N }), g = c.getContext('2d');
  let s = 3;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const wrap = f => { for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) f(dx, dy); }; // 가장자리는 반대편에도 그려 이음새 없이 반복
  g.fillStyle = '#777';
  g.fillRect(0, 0, N, N);
  if (kind === 'fur') {
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const x = r() * N, y = r() * N, l = 6 + r() * 10, v = 60 + r() * 150 | 0;
      g.strokeStyle = `rgb(${v},${v},${v})`;
      g.lineWidth = 1 + r() * 1.5;
      wrap((dx, dy) => { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx - l, y + dy + (r() - 0.5) * 4); g.stroke(); });
    }
  } else if (kind === 'feather') {
    for (let j = 0; j < 12; j++) for (let i = 0; i < 9; i++) {
      const x = i * 32 + (j % 2) * 16, y = j * 22;
      wrap((dx, dy) => {
        const gr = g.createLinearGradient(x + dx, y + dy, x + dx - 26, y + dy);
        gr.addColorStop(0, '#555');
        gr.addColorStop(0.3, '#b0b0b0');
        gr.addColorStop(1, '#808080');
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(x + dx - 12, y + dy, 16, 12, 0, 0, 7);
        g.fill();
      });
    }
  } else {
    const n = { scale: 700, smooth: 160, shell: 300 }[kind] ?? 700, big = kind === 'scale' ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const x = r() * N, y = r() * N, rad = 2.5 + r() * big;
      wrap((dx, dy) => {
        const gr = g.createRadialGradient(x + dx - rad * 0.3, y + dy - rad * 0.3, 0, x + dx, y + dy, rad);
        gr.addColorStop(0, kind === 'smooth' ? '#888' : '#c8c8c8');
        gr.addColorStop(0.75, kind === 'smooth' ? '#7a7a7a' : '#8a8a8a');
        gr.addColorStop(1, kind === 'smooth' ? '#727272' : '#4a4a4a');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x + dx, y + dy, rad, 0, 7);
        g.fill();
      });
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (bumps[kind] = t);
}
const mats = {};
const ROUGH = { scale: 0.58, fur: 0.9, feather: 0.85, smooth: 0.42, shell: 0.45 };
export const skinMat = kind => (mats[kind] ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: ROUGH[kind], metalness: 0, bumpMap: bumpMap(kind), bumpScale: kind === 'fur' ? 2 : 1.2 }));

// ── 색 ──
// 백과 팔레트를 참고 그림처럼 차분하게(채도를 낮춘다)
const mute = (hex, k = 0.6) => { const c = new THREE.Color(hex), h = {}; c.getHSL(h); return c.setHSL(h.h, h.s * k, h.l); };
// 큰 얼룩 + 잔얼룩(-1~1)
const mottle = p => Math.sin(p.x * 150 + Math.sin(p.z * 120) * 3) * Math.sin(p.z * 140 + Math.sin(p.x * 110) * 3) * 0.5 + Math.sin(p.x * 45 + p.y * 30) * Math.sin(p.z * 60 - p.x * 25) * 0.6;
// 짙은 등 → 몸 색 → 크림빛 배. dark: 다리처럼 한 톤 어두운 부위
export function skinPaint(back, belly, dark = 1) {
  const T = mute(back).multiplyScalar(0.5 * dark), B = mute(back).multiplyScalar(1.05 * dark), L = mute(belly, 0.55).multiplyScalar(dark === 1 ? 1.1 : 0.8);
  return (n, p) => (n.y > 0.15 ? B.clone().lerp(T, sm(n.y, 0.15, 0.95)) : B.clone().lerp(L, sm(-n.y, -0.15, 0.4))).multiplyScalar(1 + 0.16 * mottle(p));
}
const solid = hex => { const c = new THREE.Color(hex); return () => c.clone(); };

function paintGeo(geo, paint, kind = 'scale', Ctor = THREE.Mesh) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, col = new Float32Array(p.count * 3), a = new V(), b = new V();
  for (let i = 0; i < p.count; i++) paint(a.fromBufferAttribute(n, i), b.fromBufferAttribute(p, i)).toArray(col, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new Ctor(geo, skinMat(kind));
}

// ── 모양 도구 ──
// 고리 사이를 곡선으로 메워 매끈하게(Catmull-Rom, 고리 하나당 sub 개)
function smoothRings(R, sub) {
  const out = [];
  for (let k = 0; k < R.length - 1; k++) {
    const p0 = R[k - 1] ?? R[k], p1 = R[k], p2 = R[k + 1], p3 = R[k + 2] ?? R[k + 1];
    for (let j = 0; j < sub; j++) {
      const t = j / sub, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)));
    }
  }
  return [...out, R.at(-1)];
}
// 단면 고리들을 이은 매끈한 관. rings: [x, y, 반높이, 반너비, z?] — 고리는 중심선(xy 평면)에 수직으로 선다.
// top·bot: 위·아래(진행 방향 기준 왼쪽·오른쪽) 부풀림 배율. 이음새는 배 밑에 숨긴다
// skin: { owners: [{ bone, from }](축 위 시작점 오름차순), axis: 'x' | '-y', blend } → 뼈대로 휘는 한 덩어리(관절에서 살이 이어져 휜다)
export function loft(rings, paint, { n = 20, top = 1, bot = 1, sub = 3, kind = 'scale', skin } = {}) {
  const R = smoothRings(rings.map(r => (r.length < 5 ? [...r, 0] : r)), sub), pos = [], uv = [], idx = [], si = [], sw = [];
  let arc = 0;
  R.forEach(([x, y, h, w, z], k) => {
    const a = R[Math.max(0, k - 1)], b = R[Math.min(R.length - 1, k + 1)];
    const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / m, ny = (b[0] - a[0]) / m;
    if (k) arc += Math.hypot(x - R[k - 1][0], y - R[k - 1][1]);
    const per = Math.PI * (h + w) * 50, wt = skin && skinWeights(skin, skin.axis === 'x' ? x : -y);
    for (let i = 0; i <= n; i++) {
      if (wt) { si.push(wt[0], wt[1], 0, 0); sw.push(wt[2], 1 - wt[2], 0, 0); }
      const ang = -Math.PI / 2 + (i / n) * Math.PI * 2, s = Math.sin(ang), d = s * h * (s > 0 ? top : bot);
      pos.push(x + nx * d, y + ny * d, z + Math.cos(ang) * w);
      uv.push(arc * 50, (i / n) * per);
    }
  });
  for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < n; i++) {
    const a = k * (n + 1) + i, b = a + 1, c = a + n + 2, d = a + n + 1;
    idx.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  if (!skin) return paintGeo(g, paint, kind);
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const m = paintGeo(g, paint, kind, THREE.SkinnedMesh);
  m.userData.bones = skin.owners.map(o => o.bone);
  m.frustumCulled = false;
  PENDING.push(m); // build() 가 뼈대를 다 짠 뒤 묶는다
  return m;
}
// 축 위 s 자리 고리의 [뼈 a, 뼈 b, a 비율]: 맡은 구간 안은 한 뼈, 구간 경계 앞뒤 blend 안에서는 두 뼈가 부드럽게 나눈다
function skinWeights({ owners, blend }, s) {
  let i = 0;
  while (i + 1 < owners.length && owners[i + 1].from <= s) i++;
  const next = owners[i + 1], d0 = s - owners[i].from, d1 = next ? next.from - s : Infinity;
  if (i > 0 && d0 < blend) return [i, i - 1, 0.5 + 0.5 * sm(d0, 0, blend)];
  if (next && d1 < blend) return [i, i + 1, 0.5 + 0.5 * sm(d1, 0, blend)];
  return [i, i, 1];
}
let PENDING = [];
// 공 모양 덩어리(혹, 귀, 목방패, 골판 …): 가운데 c, 반지름 [rx, ry, rz], 회전 [x, y, z]
export function blob(c, r, paint, rot = [0, 0, 0], kind = 'scale', seg = 20) {
  const m = paintGeo(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)).scale(...r).rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]).translate(...c), paint, kind);
  return m;
}
// 고리 rings(x 순서) 위 x 자리의 고리
export const ringAt = (rings, x) => {
  const j = rings.findIndex(r => r[0] > x), k = j < 0 ? rings.length - 1 : Math.max(0, j - 1), a = rings[k], b = rings[k + 1] ?? a, q = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
  return a.map((v, i) => v + (b[i] - v) * q);
};
// 고리 목록의 t(0~1, 고리 순번 기준) 자리 고리, t0~t1 조각
const along = (R, t) => { const s = t * (R.length - 1), k = Math.min(R.length - 2, Math.floor(s)), q = s - k; return R[k].map((v, i) => v + (R[k + 1][i] - v) * q); };

export const group = (...kids) => { const g = new THREE.Group(); kids.flat(Infinity).forEach(k => k && g.add(k)); return g; };
export const at = (o, x, y, z = 0) => (o.position.set(x, y, z), o);
// 관절: (x, y, z)를 축으로 도는 묶음. 안의 부품은 몸 좌표 그대로 쓴다(겹겹이 넣어도 그대로)
export function joint(x, y, ...kids) {
  const p = at(new THREE.Bone(), x, y);
  p.add(at(group(...kids), -x, -y));
  p.userData.rest = p.rotation.clone();
  p.userData.pos = p.position.clone();
  return p;
}

// 꼬리(또는 뱀 몸) 뼈 사슬: rings 는 몸 쪽 → 끝. n마디로 나눠 마디마다 앞끝에서 돈다. tip: 끝 마디에 붙일 것(꼬리지느러미, 곤봉…)
export function tailBones(rings, n, tip) {
  const segs = [];
  let inner = tip;
  for (let i = n - 1; i >= 0; i--) { const [x, y] = along(rings, i / n); inner = joint(x, y, inner); segs.unshift(inner); }
  return segs;
}
// 몸통 한 덩어리: 꼬리끝 → 몸 → 목(→ 주둥이)까지 x 오름차순 고리 하나로 잇고, 꼬리 마디·몸·머리 뼈가 구간을 나눠 맡는다
// tail: 꼬리 뼈(몸 쪽 → 끝), all: 몸 뼈, head: 목·머리 뼈. 거꾸로 가는(x가 줄어드는) 고리는 버린다
export function trunk(rings, tail, all, head, paint, opts = {}) {
  const R = rings.filter((r, i) => !i || r[0] > Math.max(...rings.slice(0, i).map(q => q[0])));
  const px = b => b.userData.pos.x, owners = [...tail].reverse().map((b, i, arr) => ({ bone: b, from: i ? px(arr[i - 1]) : -Infinity }));
  owners.push({ bone: all, from: tail.length ? px(tail[0]) : -Infinity });
  if (head) owners.push({ bone: head, from: px(head) });
  return loft(R, paint, { ...opts, skin: { owners, axis: 'x', blend: opts.blend ?? 0.035 } });
}

// 다리: 점 [x, y, 반지름] 들(엉덩이 → … → 무릎 kneeAt 번째 → … → 발). 엉덩이·무릎 두 관절. z: 몸 옆 거리, foot: 발 부품
// 다리 전체가 한 덩어리로 엉덩이·무릎 뼈를 따라 휜다. 맨 위는 앞뒤로 넓게 퍼져(허벅지·어깨 근육) 몸에 스며든다
export function limb(pts, kneeAt, z, paint, foot, kind, zOut = 0) {
  const flare = [1.6, 1.3], ring = ([x, y, r], i) => [x, y, r * (flare[i] ?? 1), r * 0.9, z + zOut * Math.min(1, i / kneeAt)];
  const [hx, hy, hr] = pts[0], [kx, ky, kr] = pts[kneeAt];
  const knee = joint(kx, ky, foot), hip = joint(hx, hy, knee);
  // 맨 위는 둥근 돔으로 닫혀 몸통에 스며든다
  loft([[hx, hy + hr * 1.1, hr * 0.25, hr * 0.2], [hx, hy + hr * 0.75, hr * 1.25, hr * 0.75], ...pts].map((p, i) => (i > 1 ? ring(p, i - 2) : [...p, z])), paint, { n: 16, kind, skin: { owners: [{ bone: hip, from: -Infinity }, { bone: knee, from: -ky }], axis: '-y', blend: kr * 1.2 } });
  return { g: hip, knee };
}
// 발가락: 발꿈치 (x, y)에서 앞으로 n개, 끝에 짙은 발톱
function toes(x, y, z, r, len, paint, n = 3, spread = 0.8, claw = true) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const dz = (i - (n - 1) / 2) * r * spread, ex = x + len, ez = z + dz * 1.6;
    out.push(loft([[x, y, r * 0.5, r * 0.45, z + dz * 0.3], [x + len * 0.6, r * 0.3, r * 0.3, r * 0.3, z + dz * 1.2], [ex, r * 0.18, r * 0.15, r * 0.15, ez]], paint, { n: 10, sub: 2 }));
    if (claw) out.push(cone([ex, r * 0.18, ez], [ex + r * 0.6, 0.0005, ez], r * 0.16, CLAW));
  }
  return out;
}
// 원뿔(이빨, 뿔, 발톱): a 밑동 → b 끝, 밑동 반지름 r
export function cone(a, b, r, color, rough = 0.35) {
  const A = new V(...a), B = new V(...b), L = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, L, 10).translate(0, L / 2, 0), new THREE.MeshStandardMaterial({ color, roughness: rough }));
  m.position.copy(A);
  m.quaternion.setFromUnitVectors(new V(0, 1, 0), B.sub(A).normalize());
  return m;
}
// 휜 뿔·엄니: 점 [x, y, z] 들을 따라 가늘어지는 관
const horn = (pts, r, color) => {
  const col = new THREE.Color(color);
  return loft(pts.map(([x, y, z], i) => [x, y, r * (1 - i / pts.length) + 0.0008, r * (1 - i / pts.length) + 0.0008, z]), (n, p) => col.clone(), { n: 12, kind: 'shell' });
};

// 납작한 지느러미·돛: xy 윤곽 pts 를 두께 th 로(가장자리 둥글게), z 가운데
export function fin(pts, th, paint, kind = 'smooth', z = 0) {
  const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  return paintGeo(new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: th * 0.6, bevelSize: th * 0.5, bevelSegments: 2, curveSegments: 12 }).translate(0, 0, z - th / 2), paint, kind);
}

// ── 머리 ──
// 머리 기준 좌표 u(0 뒤통수 → 1 코끝), v(0 입선, 위 +)로 적은 [u, 위, 아래, 너비] 를 몸 좌표 고리로
const headRings = (L, x0, y0, hl, dp) => L.map(([u, t, b, w]) => [x0 + u * hl, y0 + ((t + b) / 2) * hl * dp, ((t - b) / 2) * hl * dp, w * hl]);
// 이빨 한 줄: 고리 가장자리(down 위턱 / 아니면 아래턱) x0~x1 사이 n개씩 양쪽. 앞으로 갈수록 조금 커진다
function teeth(rings, x0, x1, n, len, down) {
  const out = [];
  for (let i = 0; i < n; i++) for (const side of [1, -1]) {
    const [x, y, h, w] = ringAt(rings, x0 + ((x1 - x0) * i) / (n - 1)), l = len * (0.7 + 0.5 * (i / (n - 1))), e = y + (down ? -h : h), z = side * w * 0.78;
    out.push(cone([x, e + (down ? 1 : -1) * l * 0.3, z], [x + l * 0.15, e + (down ? -l : l), z * 0.97], l * 0.34, TOOTH));
  }
  return out;
}
// 작고 매서운 눈: 호박색 눈알 + 세로 눈동자, 짙은 눈꺼풀, 그 위로 튀어나온 눈두덩(그늘이 진다)
function eye(x, y, z, r, ridge, round = false) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color: round ? '#2a1c12' : IRIS, roughness: 0.15 }));
  const pupil = at(new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 10, 8), new THREE.MeshBasicMaterial({ color: EYE })), 0, 0, r * 0.62);
  pupil.scale.set(round ? 0.9 : 0.35, 1, 0.5);
  const lid = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.32, 8, 18), new THREE.MeshStandardMaterial({ color: '#2b2720', roughness: 0.7 }));
  const brow = at(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshStandardMaterial({ color: ridge, roughness: 0.6 })), -r * 0.3, r * 1.05, -r * 0.35);
  brow.scale.set(2.2, 0.75, 1.1);
  brow.rotation.z = 0.25; // 앞쪽이 내려간 눈두덩 → 매서운 눈매
  const e = at(group(lid, ball, pupil, round ? null : brow), x, y, z);
  e.lookAt(e.position.clone().add(new V(0.3, 0.12, Math.sign(z))));
  return e;
}
const eyes = (rings, x, a, r, ridge, round) => { const [, y, h, w] = ringAt(rings, x); return [1, -1].map(s => eye(x, y + Math.sin(a) * h, s * Math.cos(a) * w * 1.02, r, ridge, round)); };

// 머리 모양들: skull 위턱, jaw 아래턱(뒤쪽 경첩 hinge 에서 돈다), eye [u, 눈 높이 각], teeth [u0, u1, 개수] 또는 없음
const HEADS = {
  reptile: { skull: [[-0.02, 0.32, -0.14, 0.17], [0.15, 0.45, -0.08, 0.2], [0.35, 0.5, -0.04, 0.19], [0.6, 0.4, -0.02, 0.14], [0.82, 0.28, -0.01, 0.1], [0.96, 0.15, 0, 0.06], [1.0, 0.05, 0, 0.02]],
    jaw: [[0.02, -0.02, -0.3, 0.15], [0.3, -0.02, -0.27, 0.14], [0.6, -0.02, -0.19, 0.11], [0.85, -0.02, -0.12, 0.07], [0.98, -0.02, -0.06, 0.03]], eye: [0.3, 0.6], teeth: [0.38, 0.95, 8] },
  croc: { skull: [[0, 0.36, -0.1, 0.2], [0.18, 0.4, -0.05, 0.2], [0.34, 0.26, -0.02, 0.13], [0.6, 0.19, 0, 0.09], [0.88, 0.17, 0, 0.085], [1.0, 0.08, 0, 0.05]],
    jaw: [[0.03, -0.01, -0.26, 0.18], [0.3, -0.01, -0.16, 0.12], [0.7, -0.01, -0.11, 0.08], [0.98, -0.01, -0.06, 0.05]], eye: [0.2, 1.0], teeth: [0.28, 0.97, 11] },
  lizard: { skull: [[0, 0.32, -0.1, 0.22], [0.3, 0.42, -0.05, 0.2], [0.65, 0.3, -0.02, 0.14], [0.92, 0.16, 0, 0.08], [1.0, 0.05, 0, 0.03]],
    jaw: [[0.03, -0.01, -0.28, 0.2], [0.4, -0.01, -0.2, 0.15], [0.8, -0.01, -0.12, 0.09], [0.98, -0.01, -0.05, 0.03]], eye: [0.3, 0.7] },
  sauro: { skull: [[0, 0.3, -0.15, 0.28], [0.3, 0.55, -0.1, 0.3], [0.48, 0.62, -0.08, 0.28], [0.72, 0.4, -0.04, 0.24], [1.0, 0.18, 0, 0.18]],
    jaw: [[0.25, -0.02, -0.3, 0.25], [0.7, -0.02, -0.24, 0.2], [0.98, -0.02, -0.14, 0.15]], eye: [0.45, 0.6] },
  small: { skull: [[0, 0.32, -0.2, 0.35], [0.3, 0.4, -0.12, 0.38], [0.7, 0.3, -0.06, 0.3], [1.0, 0.12, 0, 0.18]],
    jaw: [[0.25, -0.02, -0.28, 0.3], [0.9, -0.02, -0.2, 0.18]], eye: [0.35, 0.55] },
  cerato: { skull: [[0.15, 0.2, -0.3, 0.26], [0.42, 0.38, -0.3, 0.3], [0.66, 0.3, -0.3, 0.22], [0.82, 0.18, -0.3, 0.15], [0.9, 0.1, -0.32, 0.1]],
    beak: [[0.82, 0.16, -0.28, 0.1], [0.94, 0.06, -0.38, 0.07], [0.99, -0.1, -0.42, 0.035], [0.97, -0.38, -0.46, 0.005]], // 앵무새처럼 아래로 굽은 부리
    jaw: [[0.3, -0.2, -0.36, 0.24], [0.65, -0.22, -0.38, 0.17], [0.88, -0.26, -0.4, 0.08]], eye: [0.5, 0.55] },
  mammal: { skull: [[0, 0.22, -0.2, 0.26], [0.25, 0.55, -0.25, 0.32], [0.55, 0.5, -0.2, 0.28], [0.85, 0.3, -0.15, 0.18], [1.0, 0.1, -0.12, 0.12]],
    jaw: [[0.12, -0.16, -0.38, 0.2], [0.6, -0.15, -0.33, 0.15], [0.78, -0.14, -0.26, 0.1]], eye: [0.58, 0.55], round: true },
  beak: { skull: [[0, 0.3, -0.2, 0.22], [0.18, 0.56, -0.25, 0.26], [0.4, 0.56, -0.15, 0.2], [0.52, 0.42, -0.05, 0.14]],
    beak: [[0.4, 0.5, -0.02, 0.14], [0.7, 0.42, -0.02, 0.09], [0.9, 0.3, -0.04, 0.05], [1.0, 0.1, -0.12, 0.02]],
    jaw: [[0.42, -0.02, -0.2, 0.13], [0.7, -0.02, -0.12, 0.07], [0.93, -0.02, -0.05, 0.02]], eye: [0.25, 0.6], beakJaw: true },
  ptero: { skull: [[0, 0.3, -0.2, 0.17], [0.12, 0.52, -0.1, 0.17], [0.32, 0.4, -0.05, 0.11], [0.7, 0.18, -0.02, 0.05], [1.0, 0.02, -0.01, 0.008]],
    jaw: [[0.1, -0.06, -0.3, 0.14], [0.5, -0.04, -0.14, 0.07], [0.98, -0.02, -0.03, 0.01]], eye: [0.15, 0.6] },
};
// 모사사우루스·어룡·수장룡: 길고 낮은 주둥이, 아래가 평평한 위턱
HEADS.mosa = { skull: [[0, 0.33, -0.05, 0.12], [0.163, 0.43, -0.03, 0.15], [0.35, 0.41, -0.03, 0.15], [0.535, 0.33, -0.02, 0.13], [0.72, 0.22, -0.01, 0.1], [0.86, 0.15, 0, 0.065], [0.967, 0.06, 0, 0.03], [1, 0.0, 0, 0.005]],
  jaw: [[0.233, 0.04, -0.19, 0.135], [0.395, 0.03, -0.155, 0.13], [0.58, 0.0, -0.12, 0.1], [0.77, 0.0, -0.09, 0.08], [0.907, 0, -0.066, 0.05], [0.98, 0, -0.02, 0.014]], eye: [0.49, 0.75], teeth: [0.44, 0.92, 6] };
HEADS.beakHook = { ...HEADS.beak, beak: [[0.4, 0.55, -0.02, 0.15], [0.72, 0.48, -0.02, 0.1], [0.93, 0.3, -0.06, 0.06], [1.02, -0.02, -0.16, 0.025]] };
HEADS.beakTooth = { ...HEADS.beak, teeth: [0.55, 0.9, 5] };

// 머리 하나: 몸 좌표 (x, y)가 뒤통수 입선. 아래턱은 관절. 장식(뿔, 목방패, 코, 엄니 …)은 특징(F)과 params 로
function makeHead(type, x, y, hl, dp, K) {
  const H = HEADS[type] ?? HEADS.reptile, { skin, accent, ridge, F, p } = K;
  const S = headRings(H.skull, x, y, hl, dp), J = headRings(H.jaw, x, y, hl, dp);
  const toothArr = H.teeth ?? (type === 'ptero' && p.teeth ? [0.35, 0.95, 8] : null), toothy = toothArr && !F.includes('toothless');
  const beakPaint = solid(mute(BEAK, 0.8).getStyle());
  const jaw = joint(J[0][0], y, loft(J, H.beakJaw ? beakPaint : skin),
    toothy ? teeth(J, J[1][0], J.at(-1)[0] - hl * 0.04, Math.max(3, toothArr[2] - 2), hl * 0.05, false) : null,
    loft(J.map(([a, b, h, w]) => [a, b + h * 0.75, h * 0.2, w * 0.8]), solid(MOUTH), { n: 12 })); // 입 안(벌리면 보임)
  const out = [loft(S, skin), jaw, ...eyes(S, x + H.eye[0] * hl, H.eye[1], hl * 0.045 * (F.includes('bigeye') ? 1.6 : 1), ridge, H.round)];
  if (toothy) out.push(...teeth(S, x + toothArr[0] * hl, x + toothArr[1] * hl, toothArr[2], hl * 0.09, true));
  if (H.beak) out.push(loft(headRings(H.beak, x, y, hl, dp), beakPaint));
  // 콧구멍
  if (!F.includes('trunk')) out.push(at(new THREE.Mesh(new THREE.SphereGeometry(hl * 0.018, 8, 6), new THREE.MeshBasicMaterial({ color: EYE })), x + hl * 0.95, y + hl * dp * 0.12, hl * 0.05));
  const m = (u, v, z = 0) => [x + u * hl, y + v * hl * dp, z * hl];
  if (type === 'cerato') {
    // 목방패: 뒤통수 위로 비스듬히 세운 납작한 판(가장자리 짙게) + 이마뿔 둘 + 코뿔
    const { brow = 1, nose = 1, frill = 1 } = p;
    // 판은 몸빛, 테두리만 짙은 색(뒤에 조금 큰 판을 한 장 더). 밑동이 뒤통수에 묻히게 낮게 붙인다
    out.push(blob(m(0.16, 0.42), [hl * 0.06, hl * 0.52 * frill, hl * 0.5 * frill], skin, [0, 0, 0.75], K.kind));
    out.push(blob(m(0.14, 0.43), [hl * 0.045, hl * 0.57 * frill, hl * 0.55 * frill], accent, [0, 0, 0.75]));
    // 이마뿔: 굵은 밑동에서 앞·위로 휘어 뻗는다(brow 가 길이)
    if (brow) for (const s of [1, -1]) out.push(horn([m(0.5, 0.32, s * 0.15), m(0.5 + 0.28 * brow, 0.35 + 0.5 * brow, s * 0.17), m(0.5 + 0.62 * brow, 0.35 + 0.62 * brow, s * 0.15)], hl * (0.03 + 0.055 * brow), HORN));
    if (nose) out.push(horn([m(0.86, 0.12), m(0.9 + 0.04 * nose, 0.3 + 0.2 * nose)], hl * (0.035 + 0.012 * nose), HORN));
    // 목방패 가장자리 가시(뒤로 기운 판의 위쪽 테두리에서 바깥으로)
    if (p.frillSpikes) { const [cx, cy] = m(0.16, 0.42), r = hl * 0.55 * frill, d = [-0.68, 0.73]; for (const k of [-0.7, -0.25, 0.25, 0.7]) out.push(horn([[cx + d[0] * r * 0.85, cy + d[1] * r * 0.85, k * r * 0.8], [cx + d[0] * r * 1.5, cy + d[1] * r * 1.45, k * r * 1.1]], hl * 0.04, HORN)); }
    if (p.boss) out.push(blob(m(0.8, 0.22), [hl * 0.14, hl * 0.06, hl * 0.1], K.dark, [0, 0, 0], 'shell'));
  }
  // 수각류 머리 장식: 볏·눈 위 뿔·코뿔
  if (F.includes('horns')) for (const s of [1, -1]) out.push(horn([m(0.3, 0.42, s * 0.12), m(0.22, 0.85, s * 0.15)], hl * 0.06, HORN));
  if (F.includes('nosehorn')) out.push(horn([m(0.78, 0.25), m(0.82, 0.62)], hl * 0.05, HORN));
  if (F.includes('crest')) out.push(blob(m(0.45, 0.6), [hl * 0.32, hl * dp * 0.25, hl * 0.03], accent));
  if (F.includes('crest2')) for (const s of [1, -1]) out.push(blob(m(0.45, 0.75, s * 0.06), [hl * 0.3, hl * dp * 0.42, hl * 0.015], accent, [0, 0, -0.15]));
  if (F.includes('cryo')) out.push(blob(m(0.32, 0.72), [hl * 0.05, hl * dp * 0.45, hl * 0.2], accent));
  // 포유류: 검치, 아래로 굽은 엄니, 코뿔, 사슴뿔, 귀
  if (F.includes('sabre')) for (const s of [1, -1]) out.push(horn([m(0.74, 0, s * 0.11), m(0.73, -0.4, s * 0.1), m(0.68, -0.7, s * 0.09)], hl * 0.04, TOOTH));
  if (F.includes('tusks_down')) for (const s of [1, -1]) out.push(horn([m(0.6, -0.3, s * 0.1), m(0.62, -0.75, s * 0.11), m(0.45, -1.0, s * 0.1)], hl * 0.05, TOOTH));
  if (F.includes('horn_nose')) out.push(horn([m(0.9, 0.2), m(1.0, 0.6), m(1.06, 1.05)], hl * 0.1, HORN), horn([m(0.68, 0.38), m(0.72, 0.85)], hl * 0.07, HORN));
  if (F.includes('antlers')) for (const s of [1, -1]) {
    const ant = mute('#a08e70').getStyle();
    out.push(horn([m(0.3, 0.5, s * 0.15), m(0.1, 1.1, s * 0.6), m(-0.15, 1.5, s * 0.9)], hl * 0.05, ant), horn([m(0.15, 0.95, s * 0.45), m(0.6, 1.4, s * 0.6)], hl * 0.035, ant));
    out.push(blob(m(-0.1, 1.45, s * 0.9), [hl * 0.45, hl * 0.32, hl * 0.03], solid(ant), [-s * 0.5, 0, 0.35], 'shell'));
  }
  if (type === 'mammal' && !F.some(f => ['ears', 'round_ears', 'trunk', 'antlers'].includes(f))) for (const s of [1, -1]) out.push(blob(m(0.18, 0.62, s * 0.18), [hl * 0.06, hl * 0.13, hl * 0.03], skin, [0, 0, 0.2], K.kind));
  if (F.includes('trunk')) out.push(loft([m(0.9, 0.05), m(1.08, -0.35), m(1.05, -0.9), m(0.98, -1.45)].map(([a, b, c], i) => [a, b, hl * (0.13 - i * 0.025), hl * (0.12 - i * 0.022), c]), skin, { kind: K.kind }));
  if (F.includes('tusks')) for (const s of [1, -1]) out.push(horn([m(0.8, -0.25, s * 0.16), m(1.15, -0.8, s * 0.26), m(1.6, -0.75, s * 0.36), m(1.88, -0.2, s * 0.3), m(1.78, 0.25, s * 0.12)], hl * 0.085, TOOTH));
  if (F.includes('ears')) for (const s of [1, -1]) out.push(blob(m(0.15, 0.1, s * 0.3), [hl * 0.2, hl * 0.4, hl * 0.04], skin, [0, 0, 0.2], K.kind));
  if (F.includes('round_ears')) for (const s of [1, -1]) out.push(blob(m(0.22, 0.6, s * 0.2), [hl * 0.08, hl * 0.09, hl * 0.04], skin, [0, 0, 0], K.kind));
  return { parts: out, jaw };
}

// ── 몸 장식(특징) ──
// top(t): 몸통 앞뒤 t(0 엉덩이 쪽 → 1 어깨 쪽) 자리의 등 꼭대기 [x, y]. w: 몸 반너비, sail: 돛 높이
function bodyDeco(K, top, bd, w, sail = 0) {
  const { F, skin, accent, dark } = K, out = [];
  // 돛(디메트로돈·스피노사우루스): 등을 따라 솟은 막, 가시뼈 줄무늬
  if (sail) {
    const P = [[0.02, 0], [0.25, 0.85], [0.55, 1], [0.85, 0.6], [0.98, 0]].map(([t, k]) => { const [x, y] = top(t); return [x, y - bd * 0.15 + sail * k]; });
    out.push(fin([...P, top(0.5).map((v, i) => (i ? v - bd * 0.3 : v))], bd * 0.06, accent, 'scale'));
  }
  // 등 갈기(카르카로돈토사우루스): 등줄기를 따라 뒤로 누운 가시 줄, 가운데가 가장 길다
  if (F.includes('mane')) for (let i = 0; i < 11; i++) {
    const t = i / 10, [x, y] = top(t), L = bd * (0.45 + 0.3 * Math.sin(Math.PI * t));
    out.push(cone([x, y - bd * 0.12, 0], [x - L * 0.5, y + L, 0], bd * 0.1, K.ridge));
  }
  // 골판(스테고사우루스): 두 줄로 엇갈린 큰 판
  if (F.includes('plates')) for (let i = 0; i < 11; i++) {
    const t = -0.1 + i * 0.11, [x, y] = top(Math.max(0, Math.min(1, t))), sz = bd * (0.55 + 0.75 * Math.sin(Math.PI * Math.max(0.1, Math.min(0.95, 0.15 + t * 0.75))));
    out.push(blob([x + (t < 0 ? t * 0.3 : 0), y + sz * 0.5 + (t < 0 ? t * bd : 0), (i % 2 ? 1 : -1) * bd * 0.1], [sz * 0.38, sz * 0.75, bd * 0.025], accent, [0, 0, 0.12]));
  }
  // 옆구리 가시(에드몬토니아·힐라에오사우루스)
  if (F.includes('spikes')) for (let i = 0; i < 6; i++) for (const sd of [1, -1]) {
    const [x, y] = top(0.12 + i * 0.15), L = bd * (0.45 + (i > 3 ? 0.35 : 0));
    out.push(cone([x, y - bd * 0.45, sd * w * 0.85], [x - bd * 0.15, y - bd * 0.2, sd * (w * 0.85 + L)], bd * 0.09, HORN));
  }
  // 둥근 껍데기(글립토돈): 몸통을 덮는 돔
  if (F.includes('shell') && K.arch !== 'marine_reptile') { const [x0] = top(0), [x1] = top(1), [xm, ym] = top(0.5); out.push(blob([xm, ym - bd * 0.9, 0], [(x1 - x0) * 0.62, bd * 1.2, w * 1.15], accent, [0, 0, 0], 'shell', 28)); }
  // 골편: 등을 덮는 둥근 돌기 줄(엇갈려 놓는다)
  if (F.includes('bumps')) for (let i = 0; i < 12; i++) for (const k of [-2, -1, 0, 1, 2]) {
    const t = 0.04 + i * 0.08 + (k % 2 ? 0.04 : 0), [x, y] = top(Math.min(0.98, t)), a = (k / 2.6) * 1.2;
    out.push(blob([x, y - (1 - Math.cos(a)) * bd * 0.9, Math.sin(a) * w * 0.95], [bd * 0.13, bd * 0.09, bd * 0.11], skin, [a, 0, 0], 'scale', 10));
  }
  if (F.includes('hump')) { const [x, y] = top(0.8); out.push(blob([x, y - bd * 0.1, 0], [bd * 0.6, bd * 0.4, w * 0.6], skin, [0, 0, 0], K.kind)); }
  return out;
}

// ── 체형 틀 ──
// 두발(수각류, 새). params: h 엉덩이 높이, bd 몸 굵기, hl·dp 머리, arm 팔, hipX, neck 목 높이 배율, head, leg 다리 굵기, wing
function biped(p, K) {
  const { h, bd, hl, dp, arm, hipX: X = 0.47, neck = 1, head = 'reptile', leg: lr = 1, wing = 0, sail = 0 } = p, bird = K.arch === 'bird', F = K.F;
  const W = bird ? 1.05 : 0.8, hx = 1 - hl, hy = h + bd * 1.15 * neck;
  const body = [[X - 0.08, h + bd * 0.2, bd * 0.8, bd * 0.8 * W], [X + 0.03, h + bd * 0.1, bd, bd * W], [X + 0.15, h + bd * 0.08, bd * 0.95, bd * 0.9 * W], [X + 0.25, h + bd * 0.35, bd * 0.65, bd * 0.6 * W]];
  // 새는 꼬리가 짧고 깃털 다발이 끝을 채운다
  const tail = bird ? [[X - 0.05, h + bd * 0.25, bd * 0.7, bd * 0.7], [X - 0.15, h + bd * 0.35, bd * 0.35, bd * 0.35], [X - 0.22, h + bd * 0.4, bd * 0.1, bd * 0.1]]
    : [[X - 0.04, h + bd * 0.25, bd * 0.8, bd * 0.7 * W], [(X - 0.03) * 0.66, h + bd * 0.35, bd * 0.5, bd * 0.42 * W], [(X - 0.03) * 0.33, h + bd * 0.25, bd * 0.25, bd * 0.2 * W], [0, h + bd * 0.1, 0.002, 0.002]];
  const fan = bird || K.F.includes('feathers') ? blob([bird ? X - 0.17 : 0.12, h + bd * 0.5, 0], [bird ? 0.09 : 0.1, bd * 0.3, bd * 0.28], K.dark, [0, 0, bird ? 0.35 : 0.1], 'feather') : null;
  const nk = bird ? 0.6 : 1, neckS = [[X + 0.2, h + bd * 0.35, bd * 0.62, bd * 0.55 * W], [(X + 0.25 + hx) / 2, (h + bd * 0.35 + hy) / 2 + bd * 0.3, bd * 0.48 * nk, bd * 0.42 * W * nk], [hx + hl * 0.12, hy + hl * dp * 0.15, hl * dp * 0.34, hl * 0.17]];
  const hd = makeHead(head, hx, hy, hl, dp, K);
  const headJ = joint(X + 0.2, h + bd * 0.35, hd.parts);
  // 다리: 굵은 넓적다리 → 무릎 → 정강이 → 발목 → 발꿈치, 발가락 셋
  const legs = [1, -1].map(side => {
    const r = bd * lr, z = side * bd * 0.32 * W;
    const L = limb([[X, h, r * 0.8], [X + 0.025, h * 0.78, r * 0.85], [X + 0.04, h * 0.55, r * 0.5], [X + 0.01, h * 0.35, r * 0.34], [X - 0.02, h * 0.17, r * 0.24], [X - 0.012, bd * 0.12, r * 0.2]], 2, z, K.limb,
      group(toes(X - 0.012, bd * 0.12, z, r * 0.42, 0.06 * (bird ? 1.2 : 1) + r * 0.3, K.limb, 3, 0.9),
        F.includes('sickle_claw') ? cone([X - 0.005, bd * 0.14, z], [X + 0.03, bd * 0.5, z], bd * 0.06, CLAW) : null), K.kind); // 낫 모양 발톱은 들어 올린 채
    return { ...L, side, front: false };
  });
  // 팔(수각류), 접은 날개(날지 못하는 새) 또는 펼치는 날개(wing: 어깨에서 퍼덕)
  const wings = [];
  const arms = [1, -1].map(side => {
    const arm = Math.max(p.arm, bd * 0.9); // 몸보다 짧으면 몸 속에 묻혀 안 보인다
    const z = side * bd * 0.68 * W, a = [X + 0.2, h - bd * 0.05, bd * 0.2, bd * 0.18, z];
    if (wing) {
      const j = joint(X + 0.2, h + bd * 0.45, blob([X + 0.2 - wing * 0.22, h + bd * 0.5, side * bd * 0.85], [wing * 0.3, bd * 0.36, bd * 0.07], K.dark, [0, side * 0.1, 0.3], 'feather')); // 쉴 때는 접고, 날 때 펼쳐 퍼덕
      j.userData.side = side;
      wings.push(j);
      return j;
    }
    if (bird) return blob([X + 0.06, h + bd * 0.4, side * bd * 0.82], [bd * 0.55, bd * 0.3, bd * 0.1], K.dark, [0, side * 0.1, 0.3], 'feather');
    const e = [a[0] + arm * 0.35, a[1] - arm * 0.5, bd * 0.14, bd * 0.13, z * 1.25], w = [a[0] + arm * 0.8, a[1] - arm * 0.4, bd * 0.08, bd * 0.07, z * 1.25];
    const claws = (F.includes('claws') ? [-1, 0, 1] : [0]).map(k => cone([w[0], w[1], z * 1.25 + k * bd * 0.05], [w[0] + arm * (k === 0 && !F.includes('claws') ? 0.25 : 0.3), w[1] - arm * (F.includes('claws') ? 0.5 : 0.3), z * 1.25 + k * bd * 0.08], bd * 0.035, CLAW));
    const fe = F.includes('feathers') ? blob([(a[0] + w[0]) / 2, (a[1] + w[1]) / 2, z * 1.15], [arm * 0.55, bd * 0.2, bd * 0.04], K.dark, [0, 0, -0.6], 'feather') : null;
    return group(loft([a, e, w], K.limb, { n: 12 }), claws, fe);
  });
  const tailSegs = tailBones(tail, bird ? 2 : 4, fan);
  const top = t => { const [x, y, r] = ringAt(body, X - 0.08 + t * 0.33); return [x, y + r]; };
  const all = joint(X, h + bd * 0.3, tailSegs[0], headJ, arms, legs.map(l => l.g), bodyDeco(K, top, bd, bd * W, sail));
  trunk([...tail.slice(1).reverse(), ...body, ...neckS], tailSegs, all, headJ, K.skin, { kind: K.kind });
  return { root: group(all), all, head: headJ, jaw: hd.jaw, tail: tailSegs, legs, wings };
}

// 네발(용각류, 뿔공룡, 갑옷공룡, 포유류, 악어·도마뱀형). params: hip·sh 엉덩이·어깨 높이, bd 몸 굵기, b0~b1 몸통, neck [x, y] 머리 자리,
// nr 목 굵기, hl·dp 머리, tail [x, y] 꼬리끝, tr 꼬리 굵기, legR 다리 굵기, frontLeg 앞다리 배율, bend 무릎이 옆으로 벌어짐(악어형), head
function quad(p, K) {
  const { hip, sh, bd, b0, b1, neck: [nx, ny], nr, hl, dp, tail: [tx, ty], tr, legR, head, frontLeg = 1, bend = 0, sail = 0 } = p, F = K.F;
  const W = { armored: 1.35, sprawler: 1.3, ceratopsian: 1.05, sauropod: 0.95 }[K.arch] ?? 0.85;
  const body = [[b0 - 0.02, hip + bd * 0.38, bd * 0.8, bd * 0.8 * W], [b0 + (b1 - b0) * 0.3, hip + (sh - hip) * 0.3 + bd * 0.45, bd, bd * W], [b0 + (b1 - b0) * 0.7, hip + (sh - hip) * 0.7 + bd * 0.45, bd, bd * W], [b1 + 0.02, sh + bd * 0.4, bd * 0.82, bd * 0.8 * W]];
  const tail = [[b0 + 0.04, hip + bd * 0.4, tr, tr * W], [(b0 + tx) / 2, (hip + ty) / 2 + bd * 0.4, tr * 0.55, tr * 0.55 * W], [tx + (b0 - tx) * 0.15, ty + bd * 0.08, tr * 0.2, tr * 0.2 * W], [tx, ty, 0.002, 0.002]];
  // 꼬리 끝 장식
  const tip = group(
    F.includes('club') || F.includes('spiked_club') ? blob([tx + tr * 0.6, ty, 0], [tr * 1.4, tr * 0.8, tr * 1.6], K.dark) : null,
    F.includes('spiked_club') ? [[0, 1, 0], [0, -0.3, 1], [0, -0.3, -1], [0.5, 0.7, 0.7], [0.5, 0.7, -0.7]].map(([a, b, c]) => cone([tx + tr * (0.6 + a), ty + b * tr * 0.5, c * tr * 0.8], [tx + tr * (0.6 + a * 1.5), ty + b * tr * 1.5, c * tr * 2.2], tr * 0.25, HORN)) : null,
    // 꼬리 끝 가시 넷(스테고사우루스)
    F.includes('thagomizer') ? [0.04, 0.1].flatMap(k => [1, -1].map(sd => cone([tx + k, ty + 0.005, sd * 0.008], [tx + k - 0.05, ty + 0.06, sd * 0.06], 0.008, HORN))) : null);
  // 목: 어깨에서 머리 자리까지
  const off = { sauro: 0.1, cerato: 0.25, mammal: 0.15 }[head] ?? 0.05, hx = nx - hl * off;
  const neckS = [[b1 - 0.03, sh + bd * 0.5, nr * 1.6, nr * 1.5 * W], [(b1 + nx) / 2, (sh + ny) / 2 + bd * 0.3, nr * 1.2, nr * 1.15], [hx + hl * 0.28, ny + hl * dp * 0.12, Math.max(nr, hl * dp * 0.36), Math.max(nr * 0.9, hl * 0.25)]];
  const hd = makeHead(head, hx, ny, hl, dp, K);
  const headJ = joint(b1 - 0.03, sh + bd * 0.5, hd.parts);
  // 다리: 윗다리 → 무릎(악어형은 옆으로 벌어짐) → 아랫다리 → 발
  const nimble = head === 'mammal' && !bend && legR < 0.045 && K.arch === 'large_mammal'; // 날렵한 포유류(고양이·개·사슴): 발끝으로 선다
  const leg = (x, top, r, front, side) => {
    const z = side * bd * 0.45 * W, out = side * bend * r * 3; // 다리는 몸 밑에서 나온다(윗다리가 몸통에 묻힘)
    const knee = [x + r * 0.2 + (front ? -1 : 1) * r * 0.4, top * 0.48, r * 0.8];
    const pts = !nimble ? [[x, top, r * 1.25], [(x + knee[0]) / 2, (top + knee[1]) / 2, r * 1.0], knee, [x + r * 0.15, top * 0.2, r * 0.72], [x + r * 0.3, r * 0.5, r * 0.78]]
      : front ? [[x, top, r * 1.5], [x - r * 0.2, top * 0.75, r * 1.25], [x - r * 0.5, top * 0.5, r * 0.85], [x - r * 0.1, top * 0.22, r * 0.62], [x + r * 0.2, r * 0.5, r * 0.62]] // 팔꿈치는 뒤로
        : [[x, top, r * 1.7], [x + r * 0.6, top * 0.7, r * 1.35], [x + r * 0.8, top * 0.5, r * 0.85], [x - r * 0.7, top * 0.25, r * 0.55], [x - r * 0.2, r * 0.5, r * 0.6]]; // 무릎은 앞, 발목(뒤꿈치)은 뒤로
    const L = limb(pts, 2, z, K.limb,
      front && F.includes('claws') ? toes(x + r * 0.3, r * 0.4, z + out, r * 0.6, r * 2.2, K.limb, 3, 0.6) // 큰 앞발톱(메가테리움)
        : (head === 'mammal' || head === 'sauro') && !bend ? blob([x + r * 0.35, r * 0.3, z + out], [r * 1.05, r * 0.35, r * 1], K.limb) : toes(x + r * 0.3, r * 0.4, z + out, r * 0.7, r * 1.6, K.limb, bend ? 4 : 3, 0.7), K.kind, out);
    return { ...L, side, front };
  };
  const legs = [];
  for (const side of [1, -1]) legs.push(leg(b1 - 0.05, sh + bd * 0.2, legR * 0.95 * frontLeg, true, side), leg(b0 + 0.06, hip + bd * 0.2, legR, false, side));
  const tailSegs = tailBones(tail, 4, tip);
  const top = t => { const [x, y, r] = ringAt(body, b0 + t * (b1 - b0)); return [x, y + r]; };
  const all = joint((b0 + b1) / 2, (hip + sh) / 2 + bd * 0.4, tailSegs[0], headJ, legs.map(l => l.g), bodyDeco(K, top, bd, bd * W, sail));
  trunk([...tail.slice(1).reverse(), ...body, ...neckS], tailSegs, all, headJ, K.skin, { kind: K.kind, bot: K.F.includes('fur') ? 1.45 : 1 });
  return { root: group(all), all, head: headJ, jaw: hd.jaw, tail: tailSegs, legs };
}

// 헤엄(상어·물고기). params: bd 몸 굵기, hl·dp 머리, flukeUp 꼬리지느러미 위쪽, dorsal(특징) 등지느러미
function fish(p, K) {
  const { bd, hl, flukeUp = 1 } = p, y = bd * 2.2, W = 0.8;
  const body = [[0.06, y, bd * 0.12, bd * 0.08], [0.2, y, bd * 0.42, bd * 0.32], [0.4, y + bd * 0.05, bd * 0.85, bd * 0.7 * W], [0.6, y + bd * 0.08, bd, bd * W], [0.8, y + bd * 0.05, bd * 0.9, bd * 0.85 * W], [1 - hl * 0.6, y, bd * 0.75, bd * 0.7 * W]];
  const fp = K.skin;
  // 꼬리지느러미: 초승달(위·아래 날개)
  const fluke = fin([[0.1, y + bd * 0.1], [0.02, y + bd * 1.6 * flukeUp], [-0.005, y + bd * 1.7 * flukeUp], [0.05, y], [-0.005, y - bd * 1.3], [0.02, y - bd * 1.2], [0.1, y - bd * 0.1]], bd * 0.06, fp);
  const tailSegs = tailBones(body.slice(0, 3).reverse(), 3, fluke);
  // 머리: 원뿔 주둥이 + 아래쪽 입(아래턱이 벌어짐)
  const x0 = 1 - hl * 1.1, S = [[x0, y + bd * 0.05, bd * 0.85, bd * 0.75 * W], [x0 + hl * 0.5, y + bd * 0.1, bd * 0.65, bd * 0.6], [x0 + hl * 0.85, y + bd * 0.12, bd * 0.38, bd * 0.36], [1, y + bd * 0.05, bd * 0.08, bd * 0.08]];
  const J = [[x0 + hl * 0.2, y - bd * 0.45, bd * 0.3, bd * 0.6], [x0 + hl * 0.6, y - bd * 0.4, bd * 0.2, bd * 0.42], [x0 + hl * 0.88, y - bd * 0.3, bd * 0.08, bd * 0.2]];
  const jaw = joint(x0 + hl * 0.2, y - bd * 0.35, loft(J, K.skin, { kind: 'smooth' }), teeth(J, J[0][0] + hl * 0.1, J[2][0], 5, bd * 0.18, false), loft(J.map(([a, b, h, w]) => [a, b + h * 0.7, h * 0.3, w * 0.9]), solid(MOUTH), { n: 12 }));
  const gills = [0, 1, 2, 3, 4].flatMap(i => [1, -1].map(s => { const g = new THREE.Mesh(new THREE.BoxGeometry(bd * 0.02, bd * 0.6, bd * 0.02), new THREE.MeshStandardMaterial({ color: mute(K.back).multiplyScalar(0.55), roughness: 0.6 })); return at(g, x0 - i * bd * 0.12, y - bd * 0.05, s * bd * 0.72 * W); }));
  // 갑옷 머리(둔클레오스테우스): 뭉툭한 뼈판 투구 + 이빨 대신 칼날 같은 턱뼈
  const plate = p.head === 'plate';
  const armor = plate ? [blob([x0 + hl * 0.4, y + bd * 0.2, 0], [hl * 0.62, bd * 1.05, bd * 0.85], K.dark, [0, 0, -0.1], 'shell', 24), cone([1 - hl * 0.12, y - bd * 0.15, 0], [1 - hl * 0.08, y - bd * 0.55, 0], bd * 0.12, TOOTH)] : [];
  const headJ = joint(x0, y, jaw, plate ? null : teeth(S, x0 + hl * 0.3, x0 + hl * 0.8, 6, bd * 0.22, true), eyes(S, x0 + hl * (plate ? 0.7 : 0.62), 0.35, bd * 0.08, K.ridge, true), plate ? null : gills, armor);
  const dorsal = K.F.includes('dorsal') ? fin([[0.5, y + bd * 0.8], [0.58, y + bd * 2], [0.63, y + bd * 1.95], [0.66, y + bd * 0.8]], bd * 0.08, fp) : null;
  // 가슴·배 지느러미 = 다리(헤엄칠 때 저어 준다)
  const pec = (x, s, side, front) => {
    const g = at(group(fin([[0, 0], [-bd * 1.4 * s, -bd * 0.9 * s], [-bd * 1.2 * s, -bd * 1.05 * s], [bd * 0.4, -bd * 0.1]], bd * 0.05, K.limb)), x, y - bd * 0.45, side * bd * 0.6);
    g.rotation.set(side * 0.7, 0, 0);
    g.userData.rest = g.rotation.clone();
    return { g, side, front };
  };
  const legs = [pec(0.72, 1, 1, true), pec(0.72, 1, -1, true), pec(0.35, 0.5, 1, false), pec(0.35, 0.5, -1, false)];
  const all = joint(0.55, y, tailSegs[0], headJ, dorsal, legs.map(l => l.g));
  trunk([...body.slice(0, -1), ...S], tailSegs, all, headJ, K.skin, { kind: 'smooth' });
  all.userData.y0 = y;
  return { root: group(all), all, head: headJ, jaw, tail: tailSegs, legs, swim: true };
}

// 헤엄치는 파충류·고래(모사사우루스, 수장룡, 어룡, 거북, 바실로사우루스).
// params: bd 몸 굵기, hl·dp 머리, neckL 목 길이, fl 지느러미발 크기, flukeUp 꼬리지느러미 위쪽(작으면 모사사우루스처럼 꼬리가 아래로 꺾임), head(beak = 거북)
function marine(p, K) {
  const { bd, hl: hl0, dp, neckL = 0, fl = 1, flukeUp = 0.4, head = 'reptile' } = p, F = K.F;
  const hl = hl0 * 1.65, y = bd * (1.2 + fl * 0.65), k = Math.sqrt(bd / 0.055), shell = F.includes('shell');
  const hx = 1 - hl, front = neckL ? hx - neckL * 0.9 : hx + hl * 0.35, hy = neckL ? y + bd * 0.9 : y - bd * 0.16;
  const fluke = F.includes('tail_fluke'), down = fluke && flukeUp < 0.6 ? bd * 0.67 : 0;
  // 꼬리(몸 쪽 → 끝). 꼬리지느러미가 없으면 짧고 가늘게
  const tl = fluke ? 1 : 0.6, tailR = [[0.44, y, bd * 0.91, bd * 0.6], [0.3, y, bd * 0.65 * tl, bd * 0.38 * tl], [0.2, y - down * 0.05, bd * 0.45 * tl, bd * 0.24 * tl], [0.12, y - down * 0.25, bd * 0.29 * tl, bd * 0.15 * tl], [0.06, y - down * 0.55, bd * 0.16 * tl, bd * 0.09 * tl], [0.02, y - down, 0.003, 0.002]];
  // 몸통: 0.4 → 앞끝(목이 있으면 목 밑동)
  const prof = [[0, 0.85], [0.25, 1.07], [0.5, 1.16], [0.7, 1.11], [0.85, 0.95], [1, neckL ? 0.75 : 0.67]];
  const body = prof.map(([t, r]) => [0.4 + (front - 0.4) * t, y + (neckL ? 0 : bd * 0.09 * t), bd * r * (shell ? 1.1 : 1), bd * r * 0.72 * (shell ? 1.5 : 1)]);
  const neckS = neckL ? [[(front + hx) / 2, (y + hy) / 2 + bd * 0.3, bd * 0.4, bd * 0.34], [hx + hl * 0.25, hy + hl * dp * 0.12, hl * dp * 0.33, hl * 0.13]] : [[hx + hl * 0.42, y + bd * 0.09, bd * 0.36, bd * 0.29]];
  // 꼬리지느러미: 모사사우루스형(아래 날개가 크고 꼬리가 꺾임) 또는 초승달(어룡·고래)
  let tip = null;
  if (fluke && down) {
    const fs = new THREE.Shape();
    const P = [[0.13, 0.098], [0.075, 0.107], [0.042, 0.12], [0.036, 0.11], [0.05, 0.094], [0.028, 0.068], [0.003, 0.033], [0.016, 0.031], [0.045, 0.054], [0.085, 0.08], [0.13, 0.088]].map(([a, b]) => new THREE.Vector2(a, y + (b - 0.101) * (bd / 0.055)));
    fs.moveTo(P[0].x, P[0].y);
    fs.splineThru(P.slice(1));
    tip = paintGeo(new THREE.ExtrudeGeometry(fs, { depth: 0.003 * k, bevelEnabled: true, bevelThickness: 0.0025 * k, bevelSize: 0.002 * k, bevelSegments: 3, curveSegments: 24 }).translate(0, 0, -0.0015 * k), skinPaint(K.back, K.back));
  } else if (fluke) tip = fin([[0.1, y + bd * 0.1], [0.025, y + bd * 1.5 * flukeUp], [0, y + bd * 1.6 * flukeUp], [0.04, y], [0, y - bd * 1.4], [0.025, y - bd * 1.3], [0.1, y - bd * 0.1]], bd * 0.08, K.skin);
  const tail = tailBones(tailR, 4, tip);
  // 머리: 거북은 부리, 나머지는 길고 낮은 주둥이
  const hd = makeHead(head === 'beak' ? 'beak' : 'mosa', hx, hy, hl, head === 'beak' ? dp * 0.8 : dp, K);
  const headJ = neckL ? joint(front, y + bd * 0.1, hd.parts) : joint(hx + hl * 0.07, y, hd.parts);
  // 지느러미발: 노 모양. 앞 한 쌍이 크다
  const flipper = (x, s, side, frontF) => {
    const L = 0.14 * s * fl, wd = k * Math.sqrt(fl), f = loft([[0, 0, 0.011 * s * wd, 0.005 * k], [L * 0.25, 0.003 * s, 0.017 * s * wd, 0.0045 * k], [L * 0.5, 0.003 * s, 0.016 * s * wd, 0.004 * k], [L * 0.8, 0.001 * s, 0.009 * s * wd, 0.003 * k], [L, -0.001 * s, 0.002, 0.0012]], K.limb, { n: 14 });
    const g = at(group(f), x, y - bd * 0.4, side * bd * 0.65 * (shell ? 1.4 : 1));
    g.rotation.set(side * 0.4, side * 0.3, -2.75); // 아래·뒤로 뻗고 바깥으로 벌림
    g.userData.rest = g.rotation.clone();
    return { g, side, front: frontF };
  };
  const fx = 0.4 + (front - 0.4) * 0.75;
  const legs = [flipper(fx, 1, 1, true), flipper(fx, 1, -1, true), flipper(0.45, 0.75, 1, false), flipper(0.45, 0.75, -1, false)];
  const deco = [
    F.includes('dorsal') ? fin([[0.48, y + bd * 0.8], [0.55, y + bd * 1.9], [0.59, y + bd * 1.85], [0.63, y + bd * 0.8]], bd * 0.08, K.skin) : null,
    // 거북 등딱지: 몸 위를 덮는 낮은 돔 + 배딱지
    shell ? blob([(0.4 + front) / 2, y + bd * 0.2, 0], [(front - 0.4) * 0.62, bd * 1.05, bd * 1.25], K.accent, [0, 0, 0], 'shell', 28) : null,
  ];
  const all = joint(0.55, y, tail[0], headJ, legs.map(l => l.g), deco);
  trunk([...tailR.slice(1).reverse(), ...body, ...neckS], tail, all, headJ, K.skin);
  return { root: group(all), all, head: headJ, jaw: hd.jaw, tail, legs, swim: true };
}

// 익룡. params: h 엉덩이 높이, bd, neck [x, y] 머리 자리, hl·dp, crest 볏, longTail, wing 날개 크기
function ptero(p, K) {
  const { h, bd, neck: [nx, ny], hl, dp, crest = 0, longTail = false, wing = 0.5 } = p;
  const body = [[0.1, h + bd * 0.1, bd * 0.55, bd * 0.5], [0.2, h + bd * 0.3, bd, bd * 0.85], [0.3, h + bd * 0.55, bd * 0.75, bd * 0.7]];
  const neckS = [[0.28, h + bd * 0.6, bd * 0.42, bd * 0.4], [(0.3 + nx) / 2, (h + ny) / 2 + 0.02, bd * 0.32, bd * 0.3], [nx - hl * 0.02, ny + hl * dp * 0.1, bd * 0.3, bd * 0.28]];
  const hd = makeHead('ptero', nx - hl * 0.05, ny, hl, dp, K);
  if (crest) hd.parts.push(blob([nx - hl * 0.02 * crest, ny + hl * dp * (0.35 + 0.55 * crest), 0], [hl * (0.06 + 0.12 * crest), hl * dp * (0.25 + 0.7 * crest), hl * 0.012], K.accent, [0, 0, 0.6]));
  const headJ = joint(0.28, h + bd * 0.6, hd.parts);
  // 날개: 어깨 → 손목 → 날개끝, 그 아래로 발목까지 막. 어깨에서 퍼덕인다
  const wings = [1, -1].map(side => {
    const z = side * bd * 0.6, sh = [0.3, h + bd * 0.6], wr = [sh[0] + wing * 0.08, sh[1] + wing * 0.55], tip = [sh[0] - wing * 0.7, sh[1] + wing * 1.05], ank = [0.16, h + bd * 0.2];
    const zs = side * wing * 0.25; // 날개끝은 바깥으로
    const g = new THREE.BufferGeometry();
    const P = [[...sh, z], [...wr, z + zs * 0.4], [...tip, z + zs], [(tip[0] + ank[0]) / 2 + wing * 0.25, (tip[1] + ank[1]) / 2, z + zs * 0.5], [...ank, z]];
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 2, 0, 2, 3, 0, 3, 4].flatMap(i => P[i]), 3));
    const mem = new THREE.Mesh(g.toNonIndexed(), new THREE.MeshStandardMaterial({ color: mute(K.back).lerp(new THREE.Color(K.belly), 0.35), roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    mem.geometry.computeVertexNormals();
    const bone = loft([[...sh, bd * 0.3, bd * 0.28, z], [...wr, bd * 0.2, bd * 0.18, z + zs * 0.4], [...tip, bd * 0.04, bd * 0.04, z + zs]], K.limb, { n: 10 });
    const j = joint(sh[0], sh[1], mem, bone);
    j.userData.side = side;
    return j;
  });
  const legs = [1, -1].map(side => {
    const z = side * bd * 0.5, r = bd * 0.33;
    return { ...limb([[0.18, h, r], [0.21, h * 0.5, r * 0.6], [0.18, bd * 0.15, r * 0.36]], 1, z, K.limb, toes(0.18, bd * 0.12, z, r * 0.5, 0.06, K.limb, 3, 0.7), K.kind), side, front: false };
  });
  const tailR = longTail ? [[0.12, h + bd * 0.1, bd * 0.2, bd * 0.2], [0.05, h + bd * 0.3, bd * 0.06, bd * 0.06], [0.01, h + bd * 0.35, 0.002, 0.002]] : [[0.12, h + bd * 0.12, bd * 0.3, bd * 0.3], [0.07, h + bd * 0.1, bd * 0.03, bd * 0.03]];
  const tail = tailBones(tailR, longTail ? 2 : 1, longTail ? blob([0.02, h + bd * 0.55, 0], [0.02, bd * 0.35, 0.003], K.accent) : null);
  const all = joint(0.2, h + bd * 0.3, headJ, tail[0], wings, legs.map(l => l.g));
  trunk([...tailR.slice(1).reverse(), ...body, ...neckS], tail, all, headJ, K.skin, { kind: K.kind });
  return { root: group(all), all, head: headJ, jaw: hd.jaw, tail, legs, wings, fly: true };
}

// 삼엽충
function trilobite(K) {
  const y = 0.035, shell = skinPaint(K.back, K.belly);
  // 낮은 둥근 등딱지: 가운데(축엽)가 솟고 양옆(늑엽)이 넓게 내려온다
  const body = [[0.0, y - 0.01, 0.006, 0.06], [0.06, y, 0.04, 0.17], [0.3, y + 0.03, 0.09, 0.25], [0.6, y + 0.04, 0.1, 0.28], [0.85, y + 0.035, 0.09, 0.27], [0.97, y + 0.005, 0.05, 0.2], [1.0, y - 0.01, 0.006, 0.08]];
  const ridges = [];
  for (let i = 0; i < 11; i++) { // 가슴·꼬리 마디 고랑
    const x = 0.08 + i * 0.05, [, yy, hh, ww] = ringAt(body, x);
    ridges.push(loft([[x - 0.004, yy, hh * 1.04, ww * 1.0], [x + 0.004, yy, hh * 1.04, ww * 1.0]], solid(mute(K.back).multiplyScalar(0.6).getStyle()), { n: 24, sub: 1, bot: 0.25 }));
  }
  // 머리 방패(눈 둘) — 턱은 없고 방패가 끄덕인다
  const headShield = blob([0.82, y + 0.035, 0], [0.17, 0.085, 0.3], shell, [0, 0, -0.08], 'shell');
  const eyesT = [1, -1].map(s => at(blob([0, 0, 0], [0.028, 0.03, 0.028], solid('#2a241c'), [0, 0, 0], 'shell', 12), 0.8, y + 0.11, s * 0.12));
  const jaw = joint(0.95, y, group());
  const headJ = joint(0.7, y, headShield, eyesT, jaw);
  // 다리: 등딱지 밑으로 끝만 살짝 보이는 짧은 다리 여러 쌍(앞에서 뒤로 물결치며 꼼지락)
  const legs = [];
  for (let i = 0; i < 8; i++) for (const side of [1, -1]) {
    const x = 0.2 + i * 0.08, z = side * 0.15;
    const L = limb([[x, y, 0.01], [x + 0.008, y * 0.5, 0.007], [x + 0.016, 0.003, 0.004]], 1, z, K.limb, null, 'shell', 0);
    legs.push({ ...L, side, front: i > 3, ph: i * 0.7 + (side > 0 ? 0 : Math.PI) });
  }
  const tail = [joint(0.08, y, group())];
  const all = joint(0.5, y, loft(body, shell, { kind: 'shell', bot: 0.45, n: 28 }), ridges, headJ, tail[0], legs.map(l => l.g));
  return { root: group(all), all, head: headJ, jaw, tail, legs, nod: 0.2 };
}

// 다리 여러 쌍(앞에서 뒤로 물결치며 꼼지락): xs 자리마다 양쪽, 위 top → 바닥, z 몸 옆, out 바깥으로 벌림
function manyLegs(xs, top, z, r, K, out = 0) {
  return xs.flatMap((x, i) => [1, -1].map(side => ({ ...limb([[x, top, r], [x + r, top * 0.5, r * 0.7], [x + r * 2, 0.002, r * 0.4]], 1, side * z, K.limb, null, 'shell', side * out), side, front: i < xs.length / 2, ph: i * 0.8 + (side > 0 ? 0 : Math.PI) })));
}
const range = (a, b, n) => [...Array(n)].map((_, i) => a + ((b - a) * i) / (n - 1));
const stillJaw = (x, y) => joint(x, y, group());
const bugEye = (x, y, z, r) => at(blob([0, 0, 0], [r, r, r], solid('#2a241c'), [0, 0, 0], 'shell', 12), x, y, z);

// 아노말로카리스: 납작한 몸 양옆에 물결치는 날개판, 꼬리 부채, 앞으로 뻗은 집게다리 한 쌍, 자루 눈
function anomalocaris(K) {
  const y = 0.13, body = [[0.08, y, 0.02, 0.03], [0.3, y + 0.01, 0.05, 0.08], [0.6, y + 0.01, 0.06, 0.09], [0.85, y + 0.01, 0.055, 0.075], [0.95, y, 0.035, 0.05]];
  // 날개판 = 다리(헤엄칠 때 앞에서 뒤로 물결)
  const legs = range(0.18, 0.82, 10).flatMap((x, i) => [1, -1].map(side => {
    const g = joint(x, y, blob([x, y - 0.01, side * 0.12], [0.045, 0.006, 0.07 + 0.02 * Math.sin(i / 3)], K.accent, [side * 0.15, 0, 0], 'shell', 14));
    return { g, side, front: i < 5, ph: i * 0.7 };
  }));
  const fan = group([0.22, 0, -0.22].map(a => blob([0.03, y + a * 0.15, 0], [0.07, 0.012, 0.03], K.accent, [0, 0, a], 'shell', 12)));
  const tail = tailBones([[0.12, y], [0.05, y]], 1, fan);
  // 집게다리: 머리 앞에서 아래로 말린 관
  const arm = sd => loft([[0.95, y - 0.01, 0.016, 0.014, sd * 0.03], [1.02, y - 0.06, 0.013, 0.012, sd * 0.035], [1.0, y - 0.11, 0.01, 0.009, sd * 0.03], [0.96, y - 0.1, 0.004, 0.004, sd * 0.025]], K.dark, { n: 10, kind: 'shell' });
  const eyesA = [1, -1].flatMap(sd => [loft([[0.88, y + 0.03, 0.006, 0.006, sd * 0.03], [0.9, y + 0.08, 0.005, 0.005, sd * 0.05]], K.dark, { n: 8 }), bugEye(0.9, y + 0.09, sd * 0.055, 0.018)]);
  const jaw = stillJaw(0.97, y);
  const headJ = joint(0.85, y, arm(1), arm(-1), eyesA, jaw);
  const all = joint(0.5, y, tail[0], headJ, legs.map(l => l.g));
  trunk(body, tail, all, headJ, K.skin, { kind: 'shell' });
  return { root: group(all), all, head: headJ, jaw, tail, legs, swim: true, nod: 0.4 };
}

// 할루키게니아: 가는 관 몸, 아래로 긴 다리 일곱 쌍, 등에 가시 일곱 쌍, 둥근 머리
function hallucigenia(K) {
  const y = 0.1, body = [[0.02, y - 0.01, 0.01, 0.01], [0.3, y, 0.028, 0.028], [0.85, y, 0.026, 0.026], [0.93, y + 0.01, 0.02, 0.02]];
  const spines = range(0.18, 0.75, 7).flatMap(x => [1, -1].map(sd => cone([x, y + 0.02, sd * 0.01], [x + 0.03, y + 0.17, sd * 0.03], 0.012, K.spine)));
  const legs = manyLegs(range(0.2, 0.85, 7), y, 0.015, 0.008, K, 0.01);
  const jaw = stillJaw(0.98, y);
  const headJ = joint(0.9, y, blob([0.96, y + 0.015, 0], [0.04, 0.035, 0.035], K.skin), [1, -1].map(sd => bugEye(0.98, y + 0.03, sd * 0.02, 0.008)), jaw);
  const tail = tailBones([[0.15, y], [0.02, y]], 1, null);
  const all = joint(0.5, y, tail[0], headJ, spines, legs.map(l => l.g));
  trunk(body, tail, all, headJ, K.skin, { kind: 'shell' });
  return { root: group(all), all, head: headJ, jaw, tail, legs, nod: 0.5 };
}

// 유립테루스(바다전갈): 앞 머리방패, 마디진 배, 꼬리 끝 가시, 양옆 노다리 한 쌍 + 걷는 다리
function eurypterid(K) {
  const y = 0.08, body = [[0.0, y + 0.06, 0.003, 0.003], [0.05, y + 0.04, 0.008, 0.008], [0.14, y + 0.01, 0.018, 0.025], [0.3, y, 0.03, 0.06], [0.5, y, 0.036, 0.085], [0.65, y, 0.035, 0.09]];
  const ringPaint = solid(mute(K.back).multiplyScalar(0.62).getStyle());
  const rings = range(0.18, 0.6, 9).map(x => { const [, yy, hh, ww] = ringAt(body, x); return loft([[x - 0.006, yy, hh * 1.05, ww * 1.03], [x + 0.006, yy, hh * 1.05, ww * 1.03]], ringPaint, { n: 20, sub: 1 }); });
  const legs = manyLegs(range(0.66, 0.88, 4), y, 0.06, 0.008, K, 0.05);
  const paddle = [1, -1].map(sd => ({ g: joint(0.6, y, loft([[0.6, y, 0.012, 0.01, sd * 0.07], [0.5, y - 0.03, 0.014, 0.012, sd * 0.13], [0.42, y - 0.03, 0.035, 0.006, sd * 0.15]], K.dark, { n: 10, kind: 'shell' })), side: sd, front: false }));
  const jaw = stillJaw(0.98, y);
  const headJ = joint(0.66, y, blob([0.82, y + 0.01, 0], [0.18, 0.04, 0.1], K.skin, [0, 0, -0.05], 'shell'), [1, -1].map(sd => bugEye(0.84, y + 0.045, sd * 0.05, 0.015)), jaw);
  const tail = tailBones([[0.3, y], [0.14, y + 0.01], [0.0, y + 0.06]], 2, null);
  const all = joint(0.5, y, tail[0], headJ, rings, legs.map(l => l.g), paddle.map(l => l.g));
  trunk(body, tail, all, null, K.skin, { kind: 'shell', bot: 0.5 });
  return { root: group(all), all, head: headJ, jaw, tail, legs: [...legs, ...paddle], nod: 0.3 };
}

// 메가네우라(거대 잠자리): 큰 겹눈 머리, 가슴, 길고 가는 배, 투명한 날개 넷(퍼덕), 가는 다리 세 쌍
function dragonfly(K) {
  const y = 0.12, body = [[0.0, y + 0.01, 0.012, 0.012], [0.3, y, 0.018, 0.018], [0.6, y, 0.022, 0.022], [0.65, y, 0.04, 0.038], [0.78, y + 0.005, 0.045, 0.04]];
  const seams = range(0.08, 0.58, 9).map(x => loft([[x - 0.004, y, 0.021, 0.021], [x + 0.004, y, 0.021, 0.021]], K.dark, { n: 12, sub: 1 }));
  const wingMat = new THREE.MeshStandardMaterial({ color: K.wingColor, roughness: 0.2, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const wings = [[0.7, -0.55], [0.62, -0.4]].flatMap(([x, a]) => [1, -1].map(sd => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8).scale(0.07, 0.004, 0.33).rotateY(sd * a * 0.6).translate(x - 0.04, y + 0.03, sd * 0.3), wingMat);
    const j = joint(x, y + 0.03, m);
    j.userData.side = sd;
    return j;
  }));
  const legs = manyLegs([0.68, 0.73, 0.78], y - 0.02, 0.02, 0.005, K, 0.03);
  const jaw = stillJaw(0.9, y);
  const headJ = joint(0.8, y, blob([0.86, y + 0.01, 0], [0.05, 0.045, 0.05], K.skin), [1, -1].map(sd => at(blob([0, 0, 0], [0.03, 0.035, 0.03], K.accent, [0, 0, 0], 'shell', 14), 0.87, y + 0.025, sd * 0.03)), jaw);
  const tail = tailBones([[0.6, y], [0.3, y], [0.0, y + 0.01]], 2, null);
  const all = joint(0.7, y, tail[0], headJ, seams, wings, legs.map(l => l.g));
  trunk(body, tail, all, null, K.skin, { kind: 'shell' });
  return { root: group(all), all, head: headJ, jaw, tail, legs, wings, fly: true, nod: 0.4 };
}

// 아르트로플레우라(거대 노래기): 납작하고 긴 마디 몸, 마디마다 다리 한 쌍, 작은 머리와 더듬이
function millipede(K) {
  const y = 0.05, body = [[0.0, y - 0.01, 0.01, 0.03], [0.05, y, 0.035, 0.06], [0.5, y, 0.045, 0.08], [0.88, y, 0.04, 0.07], [0.93, y - 0.005, 0.03, 0.05]];
  const segs = range(0.05, 0.88, 18).map((x, i) => blob([x, y + 0.005, 0], [0.026, 0.045, 0.085], i % 2 ? K.skin : K.dark, [0, 0, 0], 'shell', 14));
  const legs = manyLegs(range(0.06, 0.86, 14), y * 0.6, 0.06, 0.006, K, 0.03);
  const jaw = stillJaw(0.99, y);
  const headJ = joint(0.9, y, blob([0.95, y, 0], [0.05, 0.03, 0.05], K.skin, [0, 0, 0], 'shell'), [1, -1].map(sd => loft([[0.97, y + 0.02, 0.004, 0.004, sd * 0.02], [1.03, y + 0.08, 0.002, 0.002, sd * 0.05]], K.dark, { n: 6 })), jaw);
  const tail = tailBones([[0.3, y], [0.0, y]], 2, null);
  const all = joint(0.5, y, tail[0], headJ, segs, legs.map(l => l.g));
  trunk(body, tail, all, headJ, K.skin, { kind: 'shell' });
  return { root: group(all), all, head: headJ, jaw, tail, legs, nod: 0.3 };
}

// 절지동물. params.kind 로 고른다
const BUGS = { trilobite, anomalocaris, hallucigenia, eurypterid, dragonfly, millipede };
const arthropod = (p, K) => (BUGS[p.kind] ?? trilobite)(K);

// 뱀: 몸 전체가 꼬리 사슬(머리 쪽이 몸통에 가까움), 앞쪽 1/4은 고개를 든다. params: r 몸 굵기
function snake(p, K) {
  const r = p.r ?? 0.04;
  // 몸 쪽(머리 뒤) → 꼬리끝. 옆(z)으로 S자, 앞쪽은 들어 올린다
  const S = [[0.8, r * 2.6, r * 0.75, r * 0.8, 0], [0.7, r * 1.3, r * 0.9, r * 0.95, r * 0.8], [0.58, r * 0.95, r, r * 1.05, -r * 1.2], [0.45, r * 0.95, r, r * 1.05, r * 1.4], [0.32, r * 0.95, r, r, -r * 1.2], [0.2, r * 0.9, r * 0.8, r * 0.85, r * 0.9], [0.09, r * 0.7, r * 0.5, r * 0.55, -r * 0.4], [0, r * 0.4, 0.003, 0.003, 0]];
  const body = tailBones(S, 5, null);
  const neck = [[0.79, r * 2.5, r * 0.75, r * 0.8], [0.86, r * 3.4, r * 0.7, r * 0.72], [0.9, r * 3.6, r * 0.66, r * 0.7]];
  const hd = makeHead('lizard', 0.88, r * 3.3, 0.12, 0.45, { ...K, F: [...K.F, 'toothless'] });
  const headJ = joint(0.8, r * 2.6, hd.parts);
  const all = joint(0.5, r, body[0], headJ);
  trunk([...S.slice(1).reverse(), ...neck], body, all, headJ, K.skin);
  return { root: group(all), all, head: headJ, jaw: hd.jaw, tail: body, legs: [] };
}

const TEMPLATES = { theropod: biped, bird: biped, sauropod: quad, ceratopsian: quad, armored: quad, large_mammal: quad, sprawler: quad, fish, marine_reptile: marine, pterosaur: ptero, arthropod, snake };
// 원형 이름 → 틀 하나로 몇 종을 묶는지(확인 화면용)
export const TEMPLATE_NAMES = Object.keys(TEMPLATES);
const SKIN = { large_mammal: 'fur', bird: 'feather', fish: 'smooth', pterosaur: 'fur', arthropod: 'shell' };

// 틀마다 대표 동물(확인 화면 #templates)
export const REPS = new Set(['tyrannosaurus', 'phorusrhacos', 'brachiosaurus', 'triceratops', 'ankylosaurus', 'woolly_mammoth', 'deinosuchus', 'mosasaurus', 'megalodon', 'quetzalcoatlus', 'trilobite', 'titanoboa']);
// 동물 카드 → rig: 체형 틀(archetype) + 비율(art.params) + 색(art.palette) + 특징(art.features)
export function build(a) {
  const make = TEMPLATES[a.archetype];
  if (!make || !a.art?.palette) return null;
  const [back, belly, accent] = a.art.palette, F = a.art.features ?? [];
  const kind = F.includes('feathers') && a.archetype === 'theropod' ? 'feather' : SKIN[a.archetype] ?? 'scale';
  const K = {
    arch: a.archetype, F, kind, back, belly, p: { ...ARCHETYPES[a.archetype].params, ...a.art.params },
    skin: skinPaint(back, belly), limb: skinPaint(back, belly, 0.85), dark: skinPaint(back, belly, 0.7),
    accent: skinPaint(accent ?? mute(back).multiplyScalar(0.8).getStyle(), accent ? new THREE.Color(accent).lerp(new THREE.Color(back), 0.4).getStyle() : belly), ridge: mute(back).multiplyScalar(0.8).getStyle(),
    spine: mute(accent ?? belly).getStyle(), wingColor: mute(accent ?? '#b9dcc8').getStyle(),
  };
  PENDING = [];
  const rig = make(K.p, K);
  // 한 덩어리 살(SkinnedMesh)은 뼈대가 다 짜인 뒤 쉬는 자세 기준으로 묶는다. 살은 root 에 두고 뼈만 움직인다
  rig.root.add(...PENDING);
  rig.root.updateMatrixWorld(true);
  for (const m of PENDING) m.bind(new THREE.Skeleton(m.userData.bones));
  rig.root.traverse(o => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return rig;
}
