// 블록 동물 도구와 특징 부품(PLAN_BLOCK3D 4.2·4.3). block3d.js 의 체형 틀이 가져다 쓴다.
// 모든 자리·크기는 블록 눈금: x 꼬리끝 0 → 코끝 N, y 땅 0에서 위, z 카메라 쪽. 상자를 놓을 때 몸 좌표(몸길이 1)로 바꾼다.
import * as THREE from 'three';
import { joint, group } from './shape3d.js';
import { tiledBox } from './blockSkin.js';
import { BLOCK } from '../config.js';

export const N = BLOCK.UNIT, U = 1 / N;
export const EYE = '#16120f', SPARK = '#ffffff', TOOTH = '#f3edd9', MOUTH = '#6e2427', TONGUE = '#b4545a', LIP = '#2a211b', NOSE = '#241b16', CLAW = '#2b2620', HORN = '#e9dfc3', IVORY = '#f4ecd6';
export const col = (c, k = 1, to, t = 0) => { const x = new THREE.Color(c); if (to) x.lerp(new THREE.Color(to), t); return '#' + x.multiplyScalar(k).getHexString(); };
export { group };

// ── 상자 ──
const GEO = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
const mat = (c, map) => { const k = c + (map?.uuid ?? ''); return mats.get(k) ?? mats.set(k, new THREE.MeshStandardMaterial({ color: c, map: map ?? null, flatShading: true, roughness: 0.9, vertexColors: true }) /* 꼭짓점 색 = 명암(block3d.js shade) */).get(k); };
const glass = new Map();
export const clear = (c, op = 0.45) => glass.get(c + op) ?? glass.set(c + op, new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: op, side: THREE.DoubleSide, roughness: 0.3 })).get(c + op);
// paint: 색 하나 | { top, side, bot } 면마다 색 | { tex, top, side, bot } 무늬(tex)에 top·side 색을 곱하고 bot 은 무늬 없는 색 | 재질 하나
// BoxGeometry 면 순서 +x −x +y −y +z −z
function faces(p) {
  if (p.isMaterial) return p;
  if (typeof p === 'string') return mat(p);
  const side = mat(p.side, p.tex), top = mat(p.top, p.tex), bot = mat(p.bot);
  return [side, side, top, bot, side, side];
}
// 상자: 가운데 (x, y, z), 크기 (w, h, d). rz·rx 로 돌릴 수 있다.
// 큰 상자(BLOCK.BEVEL 이상)는 가장 긴 축을 따라 모서리를 깎은 두 상자(+ 모양 단면)로 만들어 덜 네모나 보이게 한다
export function box(x, y, z, w, h, d, paint, rz = 0, rx = 0) {
  const dims = [w, h, d], long = dims.indexOf(Math.max(...dims)), [a, b] = dims.filter((_, i) => i !== long);
  if (BLOCK.BEVEL && !paint.isMaterial && Math.min(a, b) >= BLOCK.BEVEL) {
    const s = Math.min(a, b) >= 2.5 ? 0.5 : 0.25, /* 깎는 폭은 두 가지로만: 이웃 조각의 깎인 선이 맞는다 */ cut = (k, i) => dims.map((v, j) => (j === long || j !== [0, 1, 2].filter(q => q !== long)[k] ? v : v - 2 * s));
    return [0, 1].map(k => cube(x, y, z, ...cut(k), paint, rz, rx));
  }
  return cube(x, y, z, w, h, d, paint, rz, rx);
}
function cube(x, y, z, w, h, d, paint, rz, rx) {
  const m = new THREE.Mesh(paint.tex ? tiledBox(w, h, d) : GEO, faces(paint));
  m.position.set(x * U, y * U, z * U);
  m.scale.set(w * U, h * U, d * U);
  m.rotation.set(rx, 0, rz);
  m.userData.paint = paint; // 명암 칠할 때 몸·다리 구별
  return m;
}
export const both = f => [f(1), f(-1)]; // 몸 양쪽(z +, −)
// 몸통 썰기: x0 → x1 을 BLOCK.SLICE 길이마다 한 조각. f(t) → [가운데 높이, 높이, 너비] 로 굵기가 부드럽게 변한다
export function slab(x0, x1, f, paint) {
  const n = Math.max(3, Math.round((x1 - x0) / BLOCK.SLICE)), L = (x1 - x0) / n;
  const q = v => Math.round(v * 2) / 2; // 반 칸 단위: 이웃 조각이 같은 굵기면 이어지고, 바뀌는 곳만 계단이 진다
  return Array.from({ length: n }, (_, i) => { const t = (i + 0.5) / n, [y, h, d] = f(t); return box(x0 + L * (i + 0.5), q(y), 0, L, Math.round(h), Math.round(d), paint); /* 너비는 한 칸 단위(옆면 세로줄이 덜 생기게) */ });
}
// 점점 가늘어지는 마디 굵기 n개: r0 → r1
export const taper = (n, r0, r1) => Array.from({ length: n }, (_, i) => r0 + (r1 - r0) * Math.pow(i / (n - 1), 0.9));
export const J = (x, y, ...kids) => joint(x * U, y * U, ...kids); // 관절(motion3d 가 돌리는 축)
// 돌린 묶음: (x, y, z)를 축으로 rot 만큼 돌리고, 안의 상자는 축에서 잰 블록 좌표
export function piv(x, y, z, [rx, ry, rz], ...kids) {
  const g = group(...kids);
  g.position.set(x * U, y * U, z * U);
  g.rotation.set(rx, ry, rz);
  return g;
}
// 사슬(뿔·코·엄니·목): 마디마다 축에서 위(+y)로 len 만큼 뻗고, 다음 마디는 그 끝에서 bend 만큼 더 꺾인다(+ = 시계 반대)
export function chain(x, y, z, rot, segs, paint) {
  const root = piv(x, y, z, rot);
  let cur = root, prev = 0;
  for (const { len, w, d = w, bend = 0, c = paint } of segs) {
    const g = piv(0, prev, 0, [0, 0, cur === root ? 0 : bend], box(0, len / 2, 0, w, len + 0.15, d, c));
    cur.add(g);
    cur = g;
    prev = len;
  }
  return root;
}
// 점점 가늘어지는 뿔: 길이 len, 밑동 굵기 w, 마디 넷, 끝은 조금 짙게
export const horn = (x, y, z, rot, len, w, c = HORN, bend = 0.08) => chain(x, y, z, rot, [0.3, 0.27, 0.25, 0.18].map((f, i) => ({ len: len * f, w: w * (1 - i * 0.2), bend, c: i === 3 ? col(c, 0.8) : c })));
// 사슬 관절(꼬리·목·뱀 몸): 점 [x, y, z, 굵기] 들(몸 쪽 → 끝). 마디마다 앞끝이 관절이라 motion3d 의 꼬리 각도가 들어간다
export function segChain(pts, wk, paint, tip) {
  const segs = [];
  let inner = tip;
  for (let i = pts.length - 2; i >= 0; i--) {
    const [x0, y0, z0, r0] = pts[i], [x1, y1, z1] = pts[i + 1];
    const pa = paint.ring && i % 2 ? paint.ring : paint; // 꼬리 고리 무늬: 마디를 하나 걸러 고리 색
    inner = J(x0, y0, box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x0 - x1) + 0.3, r0, r0 * wk + Math.abs(z0 - z1) * 0.5, pa), inner);
    segs.unshift(inner);
  }
  return segs;
}
// 꼬리: 몸 쪽 (xa, ya) → 끝 (xb, yb), 마디 굵기 hs
export const tailChain = (xa, ya, xb, yb, hs, wk, paint, tip) => segChain([...hs.map((h, i) => [xa + ((xb - xa) * i) / hs.length, ya + ((yb - ya) * i) / hs.length, 0, h]), [xb, yb, 0, 0]], wk, paint, tip);

// ── 얼굴(모든 동물 공통, 4.3) ──
// 눈: 홍채(육식 노랑·초식 갈색) + 동공(육식은 세로로 찢어진 눈) + 흰 빛점 + 눈두덩. 육식은 눈두덩을 앞으로 내려 깔아 사납게, 초식은 위에 얹는다. bigeye 는 크게
const tagEye = g => ((g.userData.eye = true), g);
export function eyes(x, y, z, s, K) {
  s *= (K.F.includes('bigeye') ? 1.6 : 1) * 1.25;
  const iris = K.meat ? '#d9a21e' : '#6b4524', pw = K.meat ? s * 0.32 : s * 0.55;
  return both(sd => group(
    tagEye(piv(x, y, sd * z, [0, 0, 0], // 눈알 묶음(깜빡일 때 위아래로 납작해진다): 홍채 + 동공 + 빛점
      box(0, 0, 0, s, s, 0.3, iris),
      box(s * 0.04, 0, sd * 0.17, pw, s * (K.meat ? 0.92 : 0.55), 0.04, EYE),
      box(s * 0.24, s * 0.24, sd * 0.2, s * 0.24, s * 0.24, 0.04, SPARK))),
    box(x - s * 0.08, y - s * 0.56, sd * (z - 0.02), s * 1.2, s * 0.14, 0.36, K.ridge), // 아래 눈꺼풀
    K.mask ? [box(x - s * 1.0, y - s * 0.05, sd * (z - 0.03), s * 2.0, s * 0.8, 0.32, K.mask), box(x + s * 0.85, y - s * 0.12, sd * (z - 0.03), s * 0.9, s * 0.5, 0.32, K.mask)] : null, // 눈을 지나는 줄(가면)
    K.F.includes('bigeye') ? box(x, y, sd * (z - 0.05), s * 1.35, s * 1.35, 0.2, K.ridge) // 큰 눈 테두리(눈뼈 고리)
      : K.meat ? box(x - s * 0.1, y + s * 0.62, sd * (z - 0.04), s * 1.8, s * 0.42, 0.42, K.ridge, -0.32)
        : box(x, y + s * 0.72, sd * (z - 0.08), s * 1.2, s * 0.28, 0.34, K.ridge)));
}
// 이빨 줄: x0 → x1, 높이 y(위턱이면 아래로), 옆면 z. 긴 이빨·짧은 이빨이 번갈아
export function teeth(x0, x1, y, z, down, s = 0.34) {
  const out = [];
  let i = 0;
  for (let x = x0; x <= x1; x += s * 1.7, i++) { const h = s * (i % 2 ? 1.05 : 1.55); out.push(...both(sd => box(x, y + (down ? -h / 2 : h / 2), sd * z, s, h, s, TOOTH))); }
  return out;
}
export const nostrils = (x, y, z, K) => both(sd => box(x, y, sd * z, 0.4, 0.2, 0.32, NOSE));

// ── 머리 ──
// type: thero | rex | beak | beakHook | beakTooth | cerato | mammal | sauro | small | croc | lizard | mosa | ptero
// (hx, hy): 머리 뒤끝·가운데 높이, hl 길이, hd 깊이, hw 너비. 반환 { parts, jaw(관절) }
export function head(type, hx, hy, hl, hd, hw, K, p = {}) {
  const F = K.F, toothy = (K.meat || ['croc', 'mosa', 'beakTooth'].includes(type) || (type === 'ptero' && p.teeth)) && !F.includes('toothless');
  const my = hy - hd * 0.35, out = [], jawParts = [];
  const beak = ['beak', 'beakHook', 'beakTooth', 'ptero'].includes(type);
  if (type === 'cerato') return ceratoHead(hx, hy, hl, hd, hw, K, p);
  if (type === 'mammal') return mammalHead(hx, hy, hl, hd, hw, K, p);
  // 앞으로 길쭉한 머리들: 뒤통수 비율 back, 주둥이 깊이 sn, 주둥이 너비 sw
  const shape = { thero: [0.62, 0.62, 0.78], rex: [0.6, 0.72, 0.8], croc: [0.28, 0.42, 0.55], mosa: [0.4, 0.5, 0.6], lizard: [0.5, 0.6, 0.7], sauro: [0.6, 0.72, 0.85], small: [0.55, 0.7, 0.75], beak: [0.45, 0.6, 0.6], beakHook: [0.45, 0.6, 0.6], beakTooth: [0.45, 0.55, 0.55], ptero: [0.18, 0.42, 0.5] }[type] ?? [0.6, 0.62, 0.78];
  const [back, sn, sw] = shape, bx = hx + hl * back;
  out.push(box(hx + (hl * back) / 2, hy + hd * 0.08, 0, hl * back, hd * 0.86, hw, K.head)); // 뒤통수(눈 있는 곳)
  const snout = beak ? K.beak : K.head;
  out.push(box(bx + (hl * (1 - back)) / 2, my + (hd * sn) / 2, 0, hl * (1 - back), hd * sn, hw * sw, snout)); // 주둥이(위턱)
  if (type === 'beakHook') out.push(box(hx + hl * 0.97, my - 0.35, 0, Math.max(0.5, hl * 0.08), 0.8, hw * sw * 0.7, K.beak)); // 갈고리 부리 끝
  if (type === 'ptero') out.push(box(hx + hl * 0.92, my + hd * sn * 0.25, 0, hl * 0.16, hd * sn * 0.5, hw * sw * 0.6, K.beak)); // 뾰족한 부리 끝
  if (type === 'sauro' && p.snout) out.push(box(hx + hl * 0.45, hy + hd * 0.55, 0, hl * 0.35, hd * 0.35, hw * 0.6, K.head)); // 브라키오사우루스 높은 콧등
  if (type === 'croc' || type === 'mosa') out.push(box(hx + hl * 0.18, hy + hd * 0.52, 0, hl * 0.2, hd * 0.25, hw * 0.75, K.head)); // 위로 솟은 눈두덩
  out.push(box(hx + hl * 0.55, my + 0.12, 0, hl * 0.85, 0.3, hw * sw * 0.8, MOUTH)); // 입 안(벌리면 보인다)
  out.push(box(hx + hl * (back * 0.6 + (1 - back * 0.6) / 2), my + 0.05, 0, hl * (1 - back * 0.6), 0.14, hw * sw + 0.06, LIP)); // 입선(다문 입에도 보이는 어두운 줄)
  const ts = Math.min(0.48, hd * 0.17);
  if (toothy) out.push(teeth(hx + hl * (back * 0.6), hx + hl * 0.95, my, (hw * sw) / 2 - 0.1, true, ts));
  const ex = hx + hl * (type === 'croc' ? 0.18 : type === 'ptero' ? 0.1 : back * 0.5), ey = hy + hd * (type === 'croc' || type === 'mosa' ? 0.5 : 0.25);
  out.push(eyes(ex, ey, hw / 2, Math.max(0.45, Math.min(1.1, hd * 0.22)), K));
  if (!beak) out.push(nostrils(hx + hl * 0.96, my + hd * sn - 0.04, Math.max(0.2, hw * sw * 0.25), K));
  // 아래턱
  const jw = hw * sw * 0.9, jh = Math.max(0.4, hd * (type === 'croc' || type === 'mosa' ? 0.28 : 0.3));
  jawParts.push(box(hx + hl * 0.52, my - jh / 2, 0, hl * 0.92, jh, jw, beak ? K.beak : K.under));
  jawParts.push(box(hx + hl * 0.5, my + 0.08, 0, hl * 0.6, 0.16, jw * 0.45, TONGUE)); // 혀
  if (toothy) jawParts.push(teeth(hx + hl * (back * 0.6) + ts, hx + hl * 0.92, my, jw / 2 - 0.1, false, ts * 0.85));
  out.push(headDeco(hx, hy, hl, hd, hw, K, p));
  return { parts: out, jaw: J(hx + hl * 0.08, my, jawParts) };
}

// 뿔공룡 머리: 머리통 + 주둥이 + 앵무새 부리 + 목방패(가장자리 돌기) + 이마뿔·코뿔(또는 코 혹)
function ceratoHead(hx, hy, hl, hd, hw, K, p) {
  const my = hy - hd * 0.45, F = hl * 0.5 * (p.frill ?? 1), fw = hw * 1.9 * (p.frill ?? 1);
  const knobs = [...Array.from({ length: 7 }, (_, k) => [F + 0.1, -fw / 2 + (fw * k) / 6]), ...[0.4, 0.7].flatMap(t => [[F * t, fw / 2 + 0.1], [F * t, -fw / 2 - 0.1]])];
  const spikes = p.frillSpikes ? [-0.35, -0.12, 0.12, 0.35].map(k => piv(0, F, fw * k, [k * 1.2, 0, 0.3], box(0, 1.2, 0, 0.5, 2.6, 0.5, HORN))) : null;
  const frill = piv(hx + hl * 0.15, hy + hd * 0.3, 0, [0, 0, 0.75], box(0, F / 2, 0, 0.6, F, fw, K.frill), box(0.32, F * 0.52, 0, 0.1, F * 0.72, fw * 0.74, K.frillIn),
    knobs.map(([y, z]) => box(0, y, z, 0.6, 0.6, 0.6, K.ridge, 0, Math.PI / 4)), spikes);
  const parts = [
    box(hx + hl * 0.35, hy + hd * 0.05, 0, hl * 0.5, hd, hw, K.head),
    box(hx + hl * 0.72, hy - hd * 0.1, 0, hl * 0.28, hd * 0.7, hw * 0.62, K.head),
    box(hx + hl * 0.92, hy - hd * 0.2, 0, hl * 0.14, hd * 0.5, hw * 0.4, K.beak),
    box(hx + hl * 0.99, hy - hd * 0.42, 0, hl * 0.06, hd * 0.25, hw * 0.3, K.beak), // 아래로 굽은 부리 끝
    box(hx + hl * 0.55, my + 0.12, 0, hl * 0.6, 0.3, hw * 0.5, MOUTH),
    frill,
    p.brow !== 0 && both(sd => horn(hx + hl * 0.42, hy + hd * 0.5, sd * hw * 0.28, [0, 0, -0.85], 3.2 * (p.brow ?? 1), 0.9)),
    p.boss ? box(hx + hl * 0.76, hy + hd * 0.3, 0, hl * 0.25, hd * 0.25, hw * 0.55, K.ridge) // 코 혹(파키리노사우루스)
      : p.nose !== 0 && horn(hx + hl * 0.76, hy + hd * 0.22, 0, [0, 0, -0.35], 1.8 * (p.nose ?? 1), 0.8),
    p.jugal && both(sd => box(hx + hl * 0.3, my - 0.1, sd * (hw / 2 + 0.25), 0.8, 0.8, 0.6, HORN, 0.6)), // 볼뿔
    eyes(hx + hl * 0.42, hy + hd * 0.18, hw / 2, Math.max(0.55, hd * 0.18), K),
    both(sd => box(hx + hl * 0.84, hy - hd * 0.02, sd * hw * 0.31, 0.4, 0.35, 0.1, K.ridge)),
  ];
  const jaw = J(hx + hl * 0.2, my, box(hx + hl * 0.55, my - hd * 0.13, 0, hl * 0.65, hd * 0.26, hw * 0.55, K.under), box(hx + hl * 0.9, my - hd * 0.08, 0, hl * 0.12, hd * 0.3, hw * 0.32, K.beak));
  return { parts, jaw };
}

// 포유류 머리. 코끼리형(elephant·trunk)은 높은 정수리 + 코, 나머지는 주둥이 + 코끝. 귀·엄니·뿔·검치는 headDeco
function mammalHead(hx, hy, hl, hd, hw, K, p) {
  const F = K.F, my = hy - hd * 0.45, ele = p.skull === 'elephant' || F.includes('trunk');
  const parts = [
    box(hx + hl * 0.35, hy + hd * 0.05, 0, hl * 0.7, hd, hw, K.head),
    ele ? [box(hx + hl * 0.3, hy + hd * 0.62, 0, hl * 0.45, hd * 0.4, hw * 0.8, K.head), box(hx + hl * 0.76, hy - hd * 0.08, 0, hl * 0.2, hd * 0.7, hw * 0.7, K.head)]
      : [box(hx + hl * 0.82, hy - hd * 0.18, 0, hl * 0.36, hd * 0.55, hw * 0.6, K.head), box(hx + hl * 0.99, hy - hd * 0.05, 0, 0.3, hd * 0.25, hw * 0.4, K.ridge), nostrils(hx + hl * 0.98, hy + hd * 0.06, hw * 0.15, K),
        box(hx + hl * 0.8, my + hd * 0.02, 0, hl * 0.32, hd * 0.1, hw * 0.62, K.under)], // 주둥이 아래 밝은 털
    box(hx + hl * 0.6, my + 0.12, 0, hl * 0.5, 0.3, hw * 0.45, MOUTH),
    K.meat && !F.includes('sabre') ? teeth(hx + hl * 0.62, hx + hl * 0.95, my, hw * 0.3 - 0.12, true) : null,
    eyes(hx + hl * (ele ? 0.45 : 0.55), hy + hd * 0.18, hw / 2, Math.max(0.5, hd * 0.15), K),
    headDeco(hx, hy, hl, hd, hw, K, p, ele),
  ];
  const jaw = J(hx + hl * 0.2, my, box(hx + hl * (ele ? 0.5 : 0.55), my - hd * 0.12, 0, hl * (ele ? 0.45 : 0.75), hd * 0.24, hw * 0.55, K.under),
    K.meat ? teeth(hx + hl * 0.62, hx + hl * 0.95, my, hw * 0.27 - 0.12, false) : null,
    F.includes('tusks_down') ? both(sd => chain(hx + hl * 0.55, my - hd * 0.2, sd * hw * 0.25, [0, 0, Math.PI], [0, 0.35, 0.4].map((b, i) => ({ len: hl * 0.25, w: 0.8 - i * 0.15, bend: b })), IVORY)) : null); // 아래로 굽은 엄니(디노테리움)
  return { parts, jaw };
}

// 머리 장식(특징): 볏·뿔·코뿔·사슴뿔·귀·검치·코·엄니
function headDeco(hx, hy, hl, hd, hw, K, p, ele = false) {
  const F = K.F, my = hy - hd * 0.4, top = hy + hd * 0.5, out = [];
  if (F.includes('horns')) out.push(both(sd => horn(hx + hl * 0.3, top, sd * hw * 0.3, [sd * 0.2, 0, 0.1], hd * 0.7, 0.6))); // 눈 위 뿔(카르노타우루스)
  if (F.includes('nosehorn')) out.push(horn(hx + hl * 0.78, my + hd * 0.6, 0, [0, 0, -0.2], hd * 0.55, 0.55)); // 코뿔(케라토사우루스)
  if (F.includes('crest')) out.push(box(hx + hl * 0.5, top + hd * 0.18, 0, hl * 0.6, hd * 0.4, 0.3, K.accent)); // 머리 위 볏
  if (F.includes('crest2')) out.push(both(sd => box(hx + hl * 0.5, top + hd * 0.3, sd * 0.35, hl * 0.6, hd * 0.65, 0.2, K.accent, -0.12))); // 볏 두 장(딜로포사우루스)
  if (F.includes('cryo')) out.push(box(hx + hl * 0.32, top + hd * 0.3, 0, 0.5, hd * 0.6, hw * 0.9, K.accent)); // 가로 볏(크리올로포사우루스)
  if (F.includes('sabre')) out.push(both(sd => chain(hx + hl * 0.8, my, sd * hw * 0.22, [0, 0, Math.PI], [{ len: hd * 0.45, w: 0.45 }, { len: hd * 0.4, w: 0.35, bend: -0.15 }], TOOTH))); // 칼 송곳니
  if (F.includes('horn_nose')) out.push(horn(hx + hl * 0.92, my + hd * 0.55, 0, [0, 0, -0.25], hd * 1.3, 1.1), horn(hx + hl * 0.68, top - hd * 0.1, 0, [0, 0, -0.1], hd * 0.6, 0.8)); // 큰 코뿔
  if (F.includes('antlers')) { // 넓적한 사슴뿔(메갈로케로스)
    const ant = '#a08e70';
    out.push(both(sd => piv(hx + hl * 0.3, top, sd * hw * 0.3, [-sd * 0.9, 0, 0.3], box(0, hd * 0.6, 0, 0.5, hd * 1.2, 0.5, ant), box(0, hd * 1.3, 0, hd * 1.2, hd * 0.6, 0.3, ant), [-0.4, 0, 0.4].map(k => box(k * hd, hd * 1.75, 0, 0.35, hd * 0.5, 0.3, ant)))));
  }
  if (ele || F.includes('ears')) { const ear = F.includes('ears') ? hd * 0.9 : hd * 0.45; out.push(both(sd => box(hx + hl * 0.12, hy + hd * 0.05, sd * (hw / 2 + 0.2), Math.max(1, ear * 0.7), ear, 0.35, K.dark))); }
  else if (K.arch === 'large_mammal' && !F.includes('antlers')) out.push(both(sd => box(hx + hl * 0.2, top + 0.3, sd * hw * 0.32, 0.8, F.includes('round_ears') ? 0.8 : 1.1, 0.45, K.dark)));
  if (F.includes('trunk')) { const Lt = (hy - hd * 0.15) * 0.8, w = hw * 0.42; out.push(chain(hx + hl * 0.85, hy - hd * 0.1, 0, [0, 0, Math.PI], [0, 0.05, 0.1, 0.25, 0.5].map((b, i) => ({ len: Lt / 5, w: w * (1 - i * 0.1), bend: b, c: i === 4 ? K.dark : undefined })), K.body)); }
  if (F.includes('tusks')) out.push(both(sd => chain(hx + hl * 0.78, my + 0.3, sd * hw * 0.3, [0, -sd * 0.18, -2.6], [0, 0.5, 0.55, 0.6].map((b, i) => ({ len: hl * 0.33, w: 0.9 - i * 0.12, bend: b })), IVORY)));
  return out;
}

// ── 몸 장식(특징) ──
// top(t): 몸통 t(0 엉덩이 쪽 → 1 어깨 쪽) 자리의 등 꼭대기 [x, y]. R 몸 반높이, W 몸 너비, sail 돛 높이(블록)
export function bodyDeco(K, top, R, W, sail = 0) {
  const F = K.F, out = [];
  if (sail) for (let i = 0; i <= 12; i++) { // 돛: 가운데가 가장 높은 계단 판 + 가시뼈 줄
    const t = i / 12, [x, y] = top(t), h = sail * Math.sin(Math.PI * (0.08 + t * 0.84));
    out.push(box(x, y + h / 2 - 0.3, 0, 1.3, h + 0.6, 0.3, K.accent), box(x, y + h / 2 - 0.3, 0, 0.2, h + 0.6, 0.36, K.ridge));
  }
  if (F.includes('mane')) for (let i = 0; i < 11; i++) { const t = i / 10, [x, y] = top(t), L = R * (0.5 + 0.35 * Math.sin(Math.PI * t)); out.push(piv(x, y - 0.2, 0, [0, 0, 0.6], box(0, L / 2, 0, 0.35, L, 0.35, K.ridge))); }
  if (F.includes('plates')) for (let i = 0; i < 11; i++) { // 골판: 마름모 두 줄, 엇갈리게, 가운데가 크다
    const t = -0.1 + i * 0.11, [x, y] = top(Math.max(0, Math.min(1, t))), sz = R * (0.55 + 0.8 * Math.sin(Math.PI * Math.max(0.1, Math.min(0.95, 0.15 + t * 0.75))));
    out.push(box(x, y + sz * 0.3, (i % 2 ? 1 : -1) * 0.35, sz * 0.75, sz * 0.75, 0.35, K.plate, Math.PI / 4));
  }
  if (F.includes('spikes')) for (let i = 0; i < 5; i++) for (const sd of [1, -1]) { // 옆구리 가시: 띄엄띄엄, 어깨 쪽이 길다
    const [x, y] = top(0.1 + i * 0.2), L = R * (0.55 + (i > 2 ? 0.45 : 0)), w = Math.max(0.5, R * 0.22);
    out.push(piv(x, y - R * 0.45, sd * W * 0.45, [sd * 1.35, 0, 0.35], box(0, L / 2, 0, w, L, w, HORN), box(0, L, 0, w * 0.55, L * 0.25, w * 0.55, '#ffffff')));
  }
  if (F.includes('shell') && K.arch !== 'marine_reptile') { // 둥근 등딱지(글립토돈): 층층이 줄어드는 돔
    const [x0] = top(0), [x1] = top(1), [xm, ym] = top(0.5), L = x1 - x0;
    out.push(box(xm, ym - R * 0.6, 0, L * 1.2, R * 1.2, W * 1.12, K.shell), box(xm, ym + R * 0.15, 0, L * 0.95, R * 0.5, W * 0.85, K.shell), box(xm, ym + R * 0.5, 0, L * 0.6, R * 0.3, W * 0.5, K.shell));
  }
  if (F.includes('bumps')) for (let i = 0; i < 10; i++) for (const k of [-2, -1, 0, 1, 2]) { // 골편: 등 위 작은 상자 격자, 줄마다 높이 다르게
    const t = 0.04 + i * 0.1 + (k % 2 ? 0.05 : 0), [x, y] = top(Math.min(0.98, t)), s = Math.max(0.55, R * 0.32);
    out.push(box(x, y + s * 0.25 - Math.abs(k) * R * 0.12, k * W * 0.2, s, s * (0.7 + (i % 2) * 0.35), s, K.osteo));
  }
  // 등 줄: 등뼈를 따라 진한 띠
  if (K.dorsal) for (let i = 0; i < 10; i++) { const [x, y] = top((i + 0.5) / 10), [x1] = top(0.1), [x0] = top(0); out.push(box(x, y + 0.04, 0, x1 - x0 + 0.1, 0.2, W * 0.34, K.dorsal)); }
  // 등 비늘 돌기: 비늘 피부인데 다른 등 장식이 없으면, 등뼈를 따라 작은 마름모 한 줄(악어 등처럼)
  if (K.kind === 'scale' && !sail && !['plates', 'bumps', 'spikes', 'shell', 'mane', 'fur', 'feathers'].some(f => F.includes(f))) {
    const s = Math.max(0.35, Math.min(0.75, R * 0.22)), n = 9;
    for (let i = 0; i <= n; i++) { const [x, y] = top(i / n); out.push(box(x, y + s * 0.15, 0, s, s, s * 0.8, K.ridge, Math.PI / 4)); }
  }
  if (F.includes('hump')) { const [x, y] = top(0.8); out.push(box(x, y + R * 0.15, 0, R * 1.6, R * 0.7, W * 0.7, K.body)); }
  return out;
}

// 꼬리 끝 장식: 곤봉·가시 곤봉·가시 넷. (x, y) 꼬리 끝, tr 꼬리 굵기
export function tailTip(K, x, y, tr) {
  const F = K.F, out = [];
  if (F.includes('club') || F.includes('spiked_club')) { // 3×3 상자 뭉치
    const s = Math.max(1, tr * 1.4);
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) out.push(box(x + s * 0.5, y + a * s * 0.45, b * s * 0.6, s * 1.4, s * 0.9 * (a ? 0.8 : 1), s * 0.9 * (b ? 0.8 : 1), (a + b) % 2 ? K.osteo : K.ridge));
    if (F.includes('spiked_club')) for (const a of [-1, 1]) for (const b of [-1, 1]) out.push(piv(x + s * 0.5, y + a * s, b * s * 1.1, [b * 0.8, 0, -a * 0.8], box(0, s * 0.5, 0, 0.35, s, 0.35, HORN)));
  }
  if (F.includes('thagomizer')) for (const k of [0, 1]) for (const sd of [1, -1]) out.push(piv(x + 1 + k * 1.6, y + 0.2, sd * 0.3, [sd * 0.9, 0, 0.9], box(0, 1.2, 0, 0.4, 2.4, 0.4, HORN), box(0, 2.3, 0, 0.25, 0.4, 0.25, '#ffffff')));
  return out;
}
// 깃털 판(팔·꼬리): (x, y, z) 가운데, 길이 L, 층판 n장이 조금씩 겹쳐 내려간다
export const feathers = (x, y, z, L, h, K, n = 3) => Array.from({ length: n }, (_, i) => box(x - i * L * 0.12, y - i * h * 0.35, z, L * (1 - i * 0.15), h, 0.2, i % 2 ? K.dark : K.feather));
// 지느러미(등지느러미·꼬리지느러미 날개): (x, y) 밑동, 높이 h, 너비 w, 뒤로 rz 만큼 기울인 계단 판
export const fin = (x, y, h, w, paint, rz = 0.5, z = 0) => piv(x, y, z, [0, 0, rz], [0, 1, 2].map(i => box(-w * 0.15 * i, (h * (i + 0.5)) / 3, 0, w * (1 - i * 0.28), h / 3 + 0.1, 0.3, paint)));
