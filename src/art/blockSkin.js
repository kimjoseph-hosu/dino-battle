// 블록 동물 픽셀 무늬(PLAN_BLOCK3D 4.4). 동물마다 32×32 픽셀 한 장(등 색 + 무늬 색)을 만들어 몸·다리 상자에 바둑판처럼 깐다.
// 픽셀은 또렷하게(NearestFilter, 마인크래프트 느낌). 상자 크기와 상관없이 블록 하나에 픽셀 4개가 되도록 상자마다 UV를 늘린다.
// 비늘·털 결은 그림으로만 표현하고 상자를 늘리지 않는다(속도 유지).
import * as THREE from 'three';

export const TEX_BLOCKS = 8; // 그림 한 장이 덮는 블록 수
const PX = 32;

const texCache = new Map();
// back: 등 색, pattern: stripes | bands | spots | mottle | saddle, mark: 무늬 색, markOp: 무늬 진하기, kind: scale | fur | feather | smooth | shell
export function skinTex(back, { pattern, mark, markOp = 0.65, kind = 'scale', seed = 1 } = {}) {
  const key = [back, pattern, mark, markOp, kind, seed].join('|');
  if (texCache.has(key)) return texCache.get(key);
  let s = seed >>> 0 || 1;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const c = Object.assign(document.createElement('canvas'), { width: PX, height: PX }), g = c.getContext('2d');
  const base = new THREE.Color(back), tmp = new THREE.Color();
  const px = (x, y, color, a = 1) => { g.globalAlpha = a; g.fillStyle = color; g.fillRect(((x % PX) + PX) % PX, ((y % PX) + PX) % PX, 1, 1); };
  // 바탕 결
  for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
    let k = 1;
    if (kind === 'fur') k = 0.9 + 0.14 * Math.sin(x * 2.1 + Math.floor(y / 3) * 1.3) * rnd() + 0.04; // 세로 털결
    else if (kind === 'feather') k = (y % 4 === 3 ? 0.82 : 1) * (0.95 + rnd() * 0.08) * ((x + (Math.floor(y / 4) % 2) * 2) % 4 === 0 ? 0.9 : 1); // 깃털 줄
    else if (kind === 'shell') k = (x % 8 === 0 || y % 8 === 0 ? 0.72 : 0.96 + rnd() * 0.08); // 등딱지 판
    else if (kind === 'smooth') k = 0.97 + rnd() * 0.05;
    else k = ((x + y * 3) % 5 === 0 ? 0.86 : 0.94 + rnd() * 0.1); // 비늘 점
    tmp.copy(base).multiplyScalar(k);
    px(x, y, '#' + tmp.getHexString());
  }
  // 무늬
  const m = mark ?? '#' + base.clone().multiplyScalar(0.5).getHexString();
  const blob = (cx, cy, r, a) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + rnd() * r) px(cx + x, cy + y, m, a); };
  if (pattern === 'stripes') for (let k = 0; k < 4; k++) for (let y = 0; y < PX; y++) { const x0 = k * 8 + Math.round(Math.sin(y / 5 + k) * 1.5); px(x0, y, m, markOp); px(x0 + 1, y, m, markOp); }
  else if (pattern === 'bands') for (let k = 0; k < 2; k++) for (let y = 0; y < PX; y++) for (let x = 0; x < 6; x++) px(k * 16 + x, y, m, markOp);
  else if (pattern === 'spots') for (let i = 0; i < 9; i++) blob(Math.floor(rnd() * PX), Math.floor(rnd() * PX), 1 + Math.floor(rnd() * 2), markOp);
  else if (pattern === 'mottle') for (let i = 0; i < 12; i++) blob(Math.floor(rnd() * PX), Math.floor(rnd() * PX), 1 + Math.floor(rnd() * 3), markOp * 0.9);
  else if (pattern === 'saddle') for (let k = 0; k < 2; k++) for (let y = 14; y < PX; y++) for (let x = 0; x < 10 - (y < 18 ? 18 - y : 0); x++) px(k * 16 + 3 + x, y, m, markOp);
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  Object.assign(t, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, colorSpace: THREE.SRGBColorSpace, generateMipmaps: false });
  texCache.set(key, t);
  return t;
}

// 크기 (w, h, d 블록)인 상자 모양: 면마다 UV를 크기만큼 늘려 그림이 늘 같은 굵기로 깔린다. 면 순서 +x −x +y −y +z −z
const geoCache = new Map();
export function tiledBox(w, h, d) {
  const r = v => Math.max(0.25, Math.round(v * 4) / 4), key = `${r(w)},${r(h)},${r(d)}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.BoxGeometry(1, 1, 1), uv = g.attributes.uv;
  [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]].forEach(([su, sv], f) => {
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, (uv.getX(i) * su) / TEX_BLOCKS, (uv.getY(i) * sv) / TEX_BLOCKS);
  });
  geoCache.set(key, g);
  return g;
}
