// 체형 원형 + 파라미터 → SVG. 좌표는 몸길이 1 기준(코끝~꼬리끝), y는 위쪽이 +, 땅은 y=0, 오른쪽을 본다.
// 배치할 때 scale(몸길이 m)를 걸면 모든 동물이 같은 눈금(미터)에 올라간다.
// 원형: theropod·bird(두발), sauropod·ceratopsian·armored·large_mammal·sprawler(네발), marine_reptile·fish(헤엄),
//       pterosaur(익룡), arthropod(절지동물), snake(뱀). 동물마다 art.params / art.features 로 덮어쓴다.

const f = n => +n.toFixed(4);
const pt = ([x, y]) => `${f(x)},${f(-y)}`;

// 점들을 지나는 부드러운 닫힌 곡선 (Catmull-Rom → 베지어)
export function smooth(pts) {
  const n = pts.length, at = i => pts[(i + n) % n];
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
  }
  return d + 'Z';
}
const poly = pts => `M${pts.map(pt).join('L')}Z`;

// 중심선 [[x, y, 반지름], ...] → 굵기가 변하는 관(꼬리, 목, 다리, 몸통)
export function tube(c) {
  const L = [], R = [];
  c.forEach(([x, y, r], i) => {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / m, dy = (b[1] - a[1]) / m;
    L.push([x - dy * r, y + dx * r]);
    R.push([x + dy * r, y - dx * r]);
  });
  const cap = (p, q) => {
    const m = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
    return [p[0] + (p[0] - q[0]) / m * p[2] * 0.8, p[1] + (p[1] - q[1]) / m * p[2] * 0.8];
  };
  return smooth([cap(c[0], c[1]), ...L, cap(c.at(-1), c.at(-2)), ...R.reverse()]);
}

// 입체감: 그리는 중인 동물의 피부색 부위에는 질감(비늘·털·깃털) + 빛(왼쪽 위 하이라이트, 가장자리 그늘)을 겹친다
// CUR 는 drawAnimal 이 동물 하나를 그리는 동안만 채워 둔다
let CUR = null;
// inner: 바탕색 위, 빛·질감 아래에 넣을 것(무늬)
const path = (d, fill, cls = '', inner = '') => {
  let s = `<path${cls && ` class="${cls}"`} d="${d}" fill="${fill}"/>${inner}`;
  if (CUR?.skin.has(fill) && CUR.tex) s += `<path class="vol" d="${d}" fill="${CUR.tex}"/>`;
  else if (CUR?.lite.has(fill) && CUR.liteTex) s += `<path class="vol" d="${d}" fill="${CUR.liteTex}"/>`;
  if (CUR?.lit.has(fill)) s += `<path class="vol" d="${d}" fill="${CUR.volMap.get(fill) ?? CUR.vol}"/>`;
  return s;
};
// 중심선의 t0~t1 부분만 관으로 (관절 마디 하나)
const subTube = (spine, t0, t1, n = 4) => tube([...Array(n)].map((_, i) => along(spine, t0 + ((t1 - t0) * i) / (n - 1))));
const seam = pts => `<path class="seam" d="M${pts.map(pt).join('L')}"/>`;

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = s => Math.round(Math.min(255, Math.max(0, ((n >> s) & 255) * (1 + k))));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

// 중심선 위 t(0~1) 위치의 [x, y, r]
function along(spine, t) {
  const s = t * (spine.length - 1), k = Math.min(spine.length - 2, Math.floor(s)), q = s - k, a = spine[k], b = spine[k + 1];
  return a.map((v, i) => v + (b[i] - v) * q);
}

// 머리 부품: 머리 기준 좌표(u: 0 뒤통수 → 1 코끝, v: 위) 를 몸 좌표로
const headMap = (x, y, hl, dp) => ([u, v]) => [x + u * hl, y + v * hl * dp];

const TOOTH = '#efe9d8', HORN = '#e6dcc0', EYE = '#15130d', IRIS = '#e0a43a', BEAK = '#d9b04a';

function eye(m, hl, dp, u, v, round = false, big = 1) {
  const [x, y] = m([u, v]), r = hl * 0.042 * big;
  const [bx1, by1] = m([u - 0.1, v + 0.11]), [bx2, by2] = m([u + 0.1, v + 0.03]);
  const e = (cx, cy, rx, ry, fill, op = 1) => `<ellipse class="tex" cx="${f(cx)}" cy="${f(-cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" opacity="${op}"/>`;
  return e(x, y, r * 1.8, r * 1.3, '#000', 0.25)
    + e(x, y, r * 1.3, r * 0.95, IRIS)
    + e(x + r * 0.1, y, round ? r * 0.55 : r * 0.25, r * 0.8, EYE)
    + e(x + r * 0.45, y + r * 0.35, r * 0.28, r * 0.22, '#fff')
    + (big > 1.2 ? '' : `<path class="brow" d="M${pt([bx1, by1])}L${pt([bx2, by2])}"/>`);
}

// 비늘 무늬: 몸 중심선 [[x, y, r]...] 의 윗부분에 작은 점을 흩뿌린다(늘 몸 안쪽)
function scales(spine, n, color) {
  let s = '', seed = spine.length * 7 + n;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const [x, y, r] = along(spine, rnd());
    s += `<circle class="tex" cx="${f(x + (rnd() - 0.5) * r * 0.4)}" cy="${f(-(y + r * (0.15 + rnd() * 0.6)))}" r="${f(r * (0.05 + rnd() * 0.06))}" fill="${color}"/>`;
  }
  return s;
}

function teeth(m, from, to, v, len, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const u = from + (to - from) * (i / (n - 1)), w = (to - from) / n * 0.45;
    s += `<path d="M${pt(m([u - w, v + 0.02]))}L${pt(m([u + w, v + 0.02]))}L${pt(m([u, v - len]))}Z" fill="${TOOTH}"/>`;
  }
  return s;
}
const horn = (m, hl, a, b, r, fill = HORN) => path(tube([[...m(a), hl * r], [...m(b), hl * 0.004]]), fill);

// ── 머리들 ──
// 파충류형(육식공룡, 악어, 도마뱀, 해양 파충류). o: teeth, crest, crest2, cryo, horns, nosehorn, bigEye
function reptileHead(x, y, hl, dp, c, o = {}) {
  const m = headMap(x, y, hl, dp), F = o.feats ?? [];
  const skull = [[0, 0.35], [0.3, 0.5], [0.65, 0.38], [0.95, 0.2], [1, 0.04], [0.7, -0.02], [0.3, -0.04], [0, -0.12]];
  const jaw = [[0.05, -0.05], [0.45, -0.04], [0.93, -0.02], [0.9, -0.1], [0.5, -0.22], [0.08, -0.3]];
  const t = o.teeth !== false && !F.includes('toothless');
  let deco = '';
  if (F.includes('crest')) deco += path(smooth([[0.1, 0.42], [0.3, 1.2], [0.6, 1.15], [0.75, 0.38]].map(m)), c.accent);
  if (F.includes('crest2')) deco += path(smooth([[0.15, 0.45], [0.42, 1.45], [0.8, 0.4]].map(m)), c.accent) + path(smooth([[0.25, 0.42], [0.52, 1.25], [0.85, 0.32]].map(m)), shade(c.accent, -0.2));
  if (F.includes('cryo')) deco += path(poly([[0.16, 0.42], [0.2, 1.15], [0.29, 0.8], [0.37, 1.3], [0.45, 0.8], [0.52, 1.15], [0.58, 0.42]].map(m)), c.accent);
  return `<g class="head">${deco}`
    + `<g class="jaw">${t ? teeth(m, 0.4, 0.88, -0.02, -0.08, 7) : ''}${path(smooth(jaw.map(m)), c.fill)}</g>`
    + (t ? teeth(m, 0.35, 0.95, -0.02, 0.1, 9) : '')
    + path(smooth(skull.map(m)), c.fill)
    + (F.includes('horns') ? horn(m, hl, [0.3, 0.42], [0.22, 0.95], 0.07, shade(c.back, -0.25)) : '')
    + (F.includes('nosehorn') ? horn(m, hl, [0.8, 0.25], [0.84, 0.62], 0.05, shade(c.back, -0.15)) : '')
    + eye(m, hl, dp, 0.3, 0.28, false, F.includes('bigeye') ? 1.6 : 1)
    + `<circle cx="${f(m([0.93, 0.13])[0])}" cy="${f(-m([0.93, 0.13])[1])}" r="${f(hl * 0.012)}" fill="${EYE}"/>`
    + `</g>`;
}

// 새 부리(공포새, 모아, 독수리, 거북). o: hook, teeth
function beakHead(x, y, hl, dp, c, o = {}) {
  const m = headMap(x, y, hl, dp);
  const skull = [[0, 0.25], [0.15, 0.55], [0.42, 0.55], [0.55, 0.25], [0.5, -0.12], [0.2, -0.28], [0, -0.1]];
  const upper = o.hook ? [[0.4, 0.5], [0.75, 0.42], [0.97, 0.2], [1.02, -0.12], [0.93, -0.02], [0.45, -0.02]] : [[0.4, 0.42], [0.75, 0.25], [1, 0.02], [0.45, -0.02]];
  const lower = [[0.45, -0.04], [0.9, -0.06], [0.5, -0.22]];
  return `<g class="head"><g class="jaw">${path(smooth(lower.map(m)), shade(BEAK, -0.15))}</g>`
    + path(smooth(skull.map(m)), c.fill) + path(smooth(upper.map(m)), BEAK)
    + (o.teeth ? teeth(m, 0.55, 0.9, -0.02, 0.07, 5) : '')
    + eye(m, hl, dp, 0.28, 0.25) + `</g>`;
}

// 익룡 머리: 긴 부리 + 볏
function pteroHead(x, y, hl, dp, c, o = {}) {
  const m = headMap(x, y, hl, dp), cr = o.crest ?? 0, dk = shade(c.back, -0.45);
  const skull = [[0, 0.3], [0.12, 0.55], [0.32, 0.42], [1, 0.02], [0.34, -0.12], [0, -0.22]];
  const jaw = [[0.12, -0.1], [0.98, -0.02], [0.3, -0.32]];
  let crestD = '';
  if (cr && o.crestType === 'sail') crestD = path(smooth([[0.08, 0.45], [0.12, 0.6 + 2.2 * cr], [0.3, 0.55 + 2.4 * cr], [0.5, 0.4 + 1.2 * cr], [0.62, 0.25], [0.3, 0.42]].map(m)), c.accent)
    + [0.18, 0.3, 0.42].map(u => seam([[u, 0.5], [u - 0.02, 0.5 + 1.6 * cr * (1 - Math.abs(u - 0.25))]].map(m))).join('');
  else if (cr) crestD = path(smooth([[0.02, 0.4], [-0.25 * cr - 0.05, 0.55 + 1.1 * cr], [0.16, 0.55], [0.3, 0.45]].map(m)), c.accent);
  // 앞으로 비스듬히 뻗은 바늘 이빨(물고기 잡기)
  const fang = (u, v, d) => path(poly([[u - 0.02, v], [u + 0.02, v], [u + 0.07, v + d]].map(m)), TOOTH);
  const tUp = o.teeth ? [0.45, 0.58, 0.7, 0.8, 0.88, 0.95].map(u => fang(u, 0, -0.14)).join('') : '';
  const tLo = o.teeth ? [0.5, 0.63, 0.75, 0.85, 0.93].map(u => fang(u, -0.04, 0.12)).join('') : '';
  return `<g class="head">${crestD}<g class="jaw">${tLo}${path(smooth(jaw.map(m)), c.fill)}${o.teeth ? '' : path(smooth([[0.8, -0.05], [0.98, -0.02], [0.85, -0.13]].map(m)), dk)}</g>`
    + tUp + path(smooth(skull.map(m)), c.fill)
    + path(smooth([[0.28, 0.15], [0.42, 0.28], [0.62, 0.16], [0.45, 0.06]].map(m)), dk, 'tex') // 콧구멍과 눈앞 구멍이 합쳐진 큰 구멍
    + (o.teeth ? '' : path(smooth([[0.82, 0.1], [1.0, 0.02], [0.83, -0.02]].map(m)), dk)) // 이빨 없는 부리 끝(각질)
    + seam([[0.15, -0.08], [0.6, -0.05], [0.97, -0.01]].map(m)) + eye(m, hl, dp, 0.15, 0.25) + `</g>`;
}

const SAURO = {
  base: { skull: [[0, 0.1], [0.3, 0.45], [0.42, 0.62], [0.6, 0.4], [1, 0.12], [0.98, -0.12], [0.5, -0.2], [0, -0.18]], eye: [0.45, 0.18], nos: [0.55, 0.5] },
  brachio: { skull: [[0, 0.08], [0.22, 0.45], [0.36, 0.95], [0.52, 0.85], [0.62, 0.42], [1, 0.15], [0.98, -0.14], [0.5, -0.22], [0, -0.2]], eye: [0.32, 0.25], nos: [0.44, 0.88] },
  diplo: { skull: [[0, 0.12], [0.22, 0.36], [0.4, 0.34], [0.75, 0.2], [1, 0.08], [0.98, -0.12], [0.5, -0.17], [0, -0.2]], eye: [0.3, 0.2], nos: [0.38, 0.36] },
  cama: { skull: [[0, 0.1], [0.2, 0.55], [0.45, 0.68], [0.75, 0.5], [1, 0.22], [0.98, -0.16], [0.5, -0.26], [0, -0.22]], eye: [0.36, 0.25], nos: [0.5, 0.66] },
};
function sauroHead(x, y, hl, dp, c, snout = 'base') {
  const m = headMap(x, y, hl, dp), S = SAURO[snout] ?? SAURO.base, [nu, nv] = m(S.nos);
  // 앞쪽 연필 같은 이빨, 입선, 콧구멍(정수리 쪽 높이)
  const pegs = [0.72, 0.8, 0.88, 0.95].map(u => path(tube([[...m([u, -0.02]), hl * 0.018], [...m([u + 0.01, -0.12]), hl * 0.004]]), TOOTH)).join('');
  return `<g class="head">${pegs}${path(smooth(S.skull.map(m)), c.fill)}${seam([[0.35, -0.08], [0.7, -0.04], [0.97, -0.02]].map(m))}`
    + `<ellipse class="tex" cx="${f(nu)}" cy="${f(-nv)}" rx="${f(hl * 0.035)}" ry="${f(hl * dp * 0.04)}" fill="${shade(c.back, -0.5)}"/>${eye(m, hl, dp, ...S.eye)}</g>`;
}

// 뿔공룡 머리. 뿔·목방패 크기는 params: brow(이마뿔), nose(코뿔), frill(목방패), frillSpikes, boss(코 위 혹)
function ceratoHead(x, y, hl, dp, c, p) {
  const m = headMap(x, y, hl, dp), { brow = 1, nose = 1, frill = 1, frillSpikes = false, boss = false, edge = frill >= 0.8, fen = false, jugal = 0 } = p;
  const fr = ([u, v]) => [0.42 + (u - 0.42) * frill, v * frill];
  const frillPts = [[0.4, -0.05], [0.12, 0.25], [-0.12, 0.8], [0.05, 1.0], [0.3, 0.8], [0.5, 0.3]].map(fr);
  const skull = [[0.25, 0.25], [0.55, 0.32], [0.85, 0.15], [1, -0.08], [0.93, -0.25], [0.65, -0.28], [0.35, -0.32], [0.2, -0.1]];
  let s = `<g class="head">`;
  if (frillSpikes) for (const [a, b] of [[[-0.1, 0.78], [-0.4, 1.2]], [[0.0, 0.95], [-0.15, 1.45]], [[0.15, 0.95], [0.1, 1.45]]]) s += horn(m, hl, fr(a), fr(b), 0.035);
  // 프릴 테두리 돌기: 바깥 윤곽(-0.12,0.8 → 0.3,0.8) 위의 작은 삼각형
  if (edge) for (let i = 0; i < 7; i++) {
    const t = i / 6, a = fr([0.12 - 0.24 * Math.cos(Math.PI * t * 0.9) * 0.5 - 0.06, 0.25 + 0.75 * Math.sin(Math.PI * (0.15 + t * 0.7))]), d = 0.07;
    s += path(poly([[a[0] - d * 0.6, a[1] - d * 0.2], [a[0] - d * 0.5, a[1] + d * 1.1], [a[0] + d * 0.6, a[1]]].map(m)), shade(c.accent, -0.25));
  }
  s += path(smooth(frillPts.map(m)), c.accent) + path(smooth(frillPts.map(([u, v]) => [u + 0.05, v * 0.85]).map(m)), c.fill);
  if (fen) s += [[0.05, 0.55], [0.22, 0.6]].map(([u, v]) => { const [px, py] = m(fr([u, v])); return `<ellipse class="tex" cx="${f(px)}" cy="${f(-py)}" rx="${f(hl * 0.08 * frill)}" ry="${f(hl * dp * 0.14 * frill)}" fill="${shade(c.back, -0.4)}" opacity=".55"/>`; }).join('');
  else s += `<g opacity=".35">${path(smooth([[0.12, 0.35], [0.0, 0.62], [0.18, 0.72], [0.3, 0.45]].map(fr).map(m)), shade(c.accent, -0.1))}</g>`; // 프릴 가운데 은은한 무늬
  if (brow) s += horn(m, hl, [0.5, 0.25], [0.5 + 0.16 * brow, 0.25 + 0.7 * brow], 0.045);
  s += path(smooth(skull.map(m)), c.fill);
  if (brow) s += horn(m, hl, [0.55, 0.25], [0.55 + 0.23 * brow, 0.25 + 0.65 * brow], 0.05);
  if (nose) s += horn(m, hl, [0.86, 0.12], [0.86 + 0.06 * nose, 0.12 + 0.2 * nose], 0.035 + 0.01 * nose);
  if (boss) s += path(smooth([[0.7, 0.18], [0.78, 0.38], [0.92, 0.3], [0.92, 0.1]].map(m)), shade(c.back, -0.2));
  if (jugal) s += horn(m, hl, [0.42, -0.15], [0.3, -0.15 - 0.3 * jugal], 0.06, shade(c.back, -0.2));
  // 부리(위가 갈고리처럼 굽음) + 입선 + 콧구멍
  return s + path(smooth([[0.84, 0.08], [1.04, -0.02], [1.0, -0.2], [0.9, -0.3], [0.86, -0.12]].map(m)), shade(c.back, -0.5))
    + seam([[0.4, -0.18], [0.7, -0.17], [0.88, -0.14]].map(m)) + `<ellipse class="tex" cx="${f(m([0.8, 0.02])[0])}" cy="${f(-m([0.8, 0.02])[1])}" rx="${f(hl * 0.035)}" ry="${f(hl * dp * 0.05)}" fill="${shade(c.back, -0.5)}"/>`
    + eye(m, hl, dp, 0.52, 0.12) + `</g>`;
}

// 포유류 머리. feats: sabre, trunk, tusks, tusks_down, horn_nose, antlers, ears(코끼리 귀), round_ears(곰)
const MAMMAL = {
  cat: { skull: [[0, 0.22], [0.22, 0.55], [0.5, 0.5], [0.78, 0.32], [1, 0.08], [0.96, -0.12], [0.6, -0.16], [0.2, -0.26], [0, -0.1]], jaw: [[0.15, -0.18], [0.7, -0.14], [0.66, -0.32], [0.22, -0.38]], eye: [0.55, 0.28], ear: 0.22 },
  dog: { skull: [[0, 0.22], [0.2, 0.52], [0.42, 0.45], [0.7, 0.2], [1, 0.08], [0.98, -0.08], [0.6, -0.12], [0.2, -0.24], [0, -0.1]], jaw: [[0.15, -0.16], [0.9, -0.1], [0.85, -0.22], [0.22, -0.34]], eye: [0.42, 0.28], ear: 0.18 },
  bear: { skull: [[0, 0.25], [0.2, 0.58], [0.45, 0.55], [0.7, 0.3], [1, 0.12], [0.98, -0.1], [0.6, -0.18], [0.2, -0.3], [0, -0.12]], jaw: [[0.15, -0.2], [0.85, -0.12], [0.8, -0.26], [0.22, -0.4]], eye: [0.48, 0.32], ear: 0.2 },
  elephant: { skull: [[0, 0.1], [0.08, 0.6], [0.35, 0.92], [0.7, 0.75], [1, 0.25], [0.95, -0.15], [0.6, -0.25], [0.2, -0.35], [0, -0.15]], jaw: [[0.3, -0.25], [0.7, -0.2], [0.6, -0.42], [0.35, -0.42]], eye: [0.5, 0.35], ear: 0 },
  rhino: { skull: [[0, 0.3], [0.2, 0.5], [0.5, 0.32], [0.85, 0.28], [1, 0.1], [0.96, -0.18], [0.6, -0.22], [0.2, -0.3], [0, -0.1]], jaw: [[0.15, -0.2], [0.9, -0.18], [0.85, -0.32], [0.22, -0.38]], eye: [0.45, 0.2], ear: 0.18 },
  deer: { skull: [[0, 0.22], [0.2, 0.48], [0.4, 0.42], [0.75, 0.2], [1, 0.05], [0.98, -0.12], [0.6, -0.14], [0.2, -0.22], [0, -0.08]], jaw: [[0.15, -0.14], [0.92, -0.12], [0.86, -0.22], [0.22, -0.3]], eye: [0.36, 0.28], ear: 0.26 },
  pig: { skull: [[0, 0.3], [0.2, 0.55], [0.5, 0.4], [0.85, 0.22], [1, 0.15], [1, -0.15], [0.6, -0.2], [0.2, -0.3], [0, -0.1]], jaw: [[0.12, -0.2], [0.92, -0.16], [0.85, -0.4], [0.3, -0.48]], eye: [0.4, 0.3], ear: 0.15 },
  sloth: { skull: [[0, 0.22], [0.25, 0.48], [0.6, 0.4], [0.9, 0.2], [1, 0.0], [0.92, -0.2], [0.6, -0.2], [0.2, -0.3], [0, -0.12]], jaw: [[0.2, -0.2], [0.85, -0.18], [0.75, -0.42], [0.25, -0.42]], eye: [0.5, 0.25], ear: 0.1 },
};
function mammalHead(x, y, hl, dp, c, kind) {
  let m = headMap(x, y, hl, dp);
  const F = c.feats, K = MAMMAL[kind] ?? MAMMAL.cat;
  const skull = K.skull, jaw = K.jaw;
  let back = '', front = '';
  const earC = c.ear ?? shade(c.back, -0.3);
  if (F.includes('ears')) front += path(smooth([[0.34, 0.5], [0.02, 0.55], [-0.12, 0.05], [0.0, -0.6], [0.26, -0.4], [0.4, 0.05]].map(m)), c.ear ?? shade(c.back, -0.12)) + seam([[0.3, 0.4], [0.06, 0.3], [0.04, -0.3]].map(m)); // 코끼리 귀: 머리 옆을 덮는 큰 부채
  else if (F.includes('round_ears')) back += `<circle cx="${f(m([0.2, 0.55])[0])}" cy="${f(-m([0.2, 0.55])[1])}" r="${f(hl * 0.1)}" fill="${earC}"/>`;
  else if (K.ear) back += path(smooth([[0.18, 0.4], [0.14, 0.42 + K.ear * 1.5], [0.36, 0.5]].map(m)), earC);
  // 눈 주변 무늬(판다·너구리): 눈을 감싸는 비스듬한 타원
  const mask = c.face ? (([ex, ey]) => `<ellipse cx="${f(ex)}" cy="${f(-ey)}" rx="${f(hl * 0.13)}" ry="${f(hl * dp * 0.12)}" transform="rotate(25 ${f(ex)} ${f(-ey)})" fill="${c.face}"/>`)(m([K.eye[0] - 0.02, K.eye[1] - 0.03])) : '';
  if (F.includes('antlers')) {
    const ant = shade(HORN, -0.25), mb = m;
    m = ([u, v]) => mb([0.3 + (u - 0.3) * 1.6, 0.5 + (v - 0.5) * 1.7]);
    back += horn(m, hl, [0.3, 0.5], [0.05, 1.4], 0.05, ant) + horn(m, hl, [0.32, 0.5], [0.7, 1.5], 0.05, ant);
    back += path(smooth([[-0.4, 1.2], [-0.2, 2.0], [0.4, 2.1], [0.2, 1.5], [0.05, 1.35]].map(m)), ant);
    back += path(smooth([[0.6, 1.4], [0.7, 2.1], [1.3, 2.0], [1.1, 1.5], [0.75, 1.45]].map(m)), ant);
    m = mb;
  }
  if (F.includes('sabre')) front += path(tube([[...m([0.74, -0.08]), hl * 0.045], [...m([0.73, -0.35]), hl * 0.03], [...m([0.66, -0.62]), hl * 0.003]]), TOOTH);
  if (F.includes('tusks')) front += path(tube([[...m([0.75, -0.2]), hl * 0.07], [...m([1.1, -0.75]), hl * 0.06], [...m([1.5, -0.6]), hl * 0.045], [...m([1.65, -0.15]), hl * 0.01]]), TOOTH);
  if (F.includes('tusks_down')) front += path(tube([[...m([0.6, -0.3]), hl * 0.05], [...m([0.62, -0.75]), hl * 0.04], [...m([0.45, -1.0]), hl * 0.006]]), TOOTH);
  if (F.includes('trunk')) {
    const s = m([0.95, -0.05]);
    front += path(tube([[...s, hl * 0.13], [s[0] + hl * 0.3, s[1] - hl * dp * 0.6, hl * 0.09], [s[0] + hl * 0.15, Math.max(0.03, s[1] - hl * dp * 1.6), hl * 0.05]]), c.fill);
  }
  if (F.includes('horn_nose')) front += horn(m, hl, [0.9, 0.2], [1.05, 1.05], 0.1) + horn(m, hl, [0.68, 0.38], [0.72, 0.85], 0.07);
  // 입선, 콧등 주름, 수염 자리 점(고양이·개)
  const det = seam([[0.25, -0.2], [0.6, -0.15], [0.95, -0.08]].map(m)) + (kind === 'cat' || kind === 'dog' ? [0.75, 0.82, 0.89].map(u => `<circle class="tex" cx="${f(m([u, -0.02])[0])}" cy="${f(-m([u, -0.02])[1])}" r="${f(hl * 0.012)}" fill="${shade(c.back, -0.5)}"/>`).join('') : '');
  return `<g class="head">${back}<g class="jaw">${path(smooth(jaw.map(m)), c.fill)}</g>`
    + path(smooth(skull.map(m)), c.fill) + det + mask + front + eye(m, hl, dp, ...K.eye, true)
    + (F.includes('trunk') ? '' : `<ellipse cx="${f(m([0.98, 0.06])[0])}" cy="${f(-m([0.98, 0.06])[1])}" rx="${f(hl * 0.04)}" ry="${f(hl * 0.03)}" fill="${EYE}"/>`) + `</g>`;
}

// 물고기 머리: 상어(shark) 또는 갑옷 머리(plate, 둔클레오스테우스)
function fishHead(x, y, hl, dp, c, kind) {
  const m = headMap(x, y, hl, dp);
  if (kind === 'plate') {
    const skull = [[0, 0.5], [0.5, 0.62], [0.9, 0.35], [1, 0.0], [0.85, -0.1], [0.3, -0.2], [0, -0.4]];
    const jaw = [[0.35, -0.15], [0.97, -0.05], [0.9, -0.4], [0.35, -0.5]];
    return `<g class="head"><g class="jaw">${path(smooth(jaw.map(m)), shade(c.back, -0.1))}${path(poly([[0.85, -0.08], [0.97, -0.05], [0.9, -0.28]].map(m)), TOOTH)}</g>`
      + path(smooth(skull.map(m)), shade(c.back, 0.05)) + path(poly([[0.85, 0.0], [1.0, 0.0], [0.93, -0.22]].map(m)), TOOTH)
      + seam([[0.15, 0.55], [0.35, -0.15]].map(m)) + seam([[0.55, 0.55], [0.6, 0.1]].map(m)) + eye(m, hl, dp, 0.62, 0.25) + `</g>`;
  }
  const skull = [[0, 0.5], [0.45, 0.55], [0.85, 0.38], [1, 0.1], [0.9, -0.15], [0.55, -0.25], [0, -0.45]];
  const jaw = [[0.35, -0.2], [0.82, -0.14], [0.7, -0.34], [0.3, -0.42]];
  return `<g class="head"><g class="jaw">${teeth(m, 0.4, 0.78, -0.17, -0.09, 6)}${path(smooth(jaw.map(m)), c.fill)}</g>`
    + teeth(m, 0.38, 0.82, -0.17, 0.1, 7) + path(smooth(skull.map(m)), c.fill)
    + [0.08, 0.15, 0.22].map(u => seam([[u, 0.15], [u - 0.02, -0.25]].map(m))).join('') + eye(m, hl, dp, 0.68, 0.2, true) + `</g>`;
}

// ── 무늬·세부 묘사(모든 원형 공용) ──
// 중심선 위 t 의 점·접선·위쪽 법선. 무늬를 관의 법선 방향으로 계산하면 늘 몸 안쪽에 들어간다
function frameAt(spine, t) {
  const [x, y, r] = along(spine, t), a = along(spine, Math.max(0, t - 0.02)), b = along(spine, Math.min(1, t + 0.02));
  const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / m, ty = (b[1] - a[1]) / m, [nx, ny] = tx >= 0 ? [-ty, tx] : [ty, -tx];
  return { x, y, r, tx, ty, nx, ny, P: (k, d = 0) => [x + nx * r * k + tx * d, y + ny * r * k + ty * d] };
}
// 몸 무늬 pat = { kind: stripes 가는 줄 | bands 굵은 띠 | saddle 등 얼룩 | spots 점박이 | mottle 얼룩덜룩, color, op }
const MARK_GAP = { stripes: 1.5, bands: 1.7, saddle: 2.6, spots: 0.7, mottle: 0.8 };
function marks(spine, pat, t0 = 0, t1 = 1) {
  if (!pat?.kind || !MARK_GAP[pat.kind]) return '';
  const A = along(spine, t0), B = along(spine, t1), rm = Math.max(1e-4, (A[2] + B[2]) / 2), K = pat.kind;
  const n = Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / (rm * MARK_GAP[K])));
  let s = '', seed = Math.round(t0 * 977 + t1 * 131 + n * 31);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280), op = pat.op ?? (K === 'bands' ? 0.8 : 0.55);
  for (let i = 0; i < n; i++) {
    const { r, P } = frameAt(spine, t0 + ((t1 - t0) * (i + 0.3 + rnd() * 0.4)) / n);
    if (K === 'spots' || K === 'mottle') {
      for (let j = 0; j < (K === 'spots' ? 2 : 3); j++) {
        const [x, y] = P(K === 'spots' ? 0.2 + rnd() * 0.65 : -0.5 + rnd() * 1.3, (rnd() - 0.5) * r * 1.2), rr = r * (K === 'spots' ? 0.07 + rnd() * 0.07 : 0.1 + rnd() * 0.15);
        s += `<ellipse class="mk" cx="${f(x)}" cy="${f(-y)}" rx="${f(rr * 1.3)}" ry="${f(rr)}" fill="${pat.color}" opacity="${op}"/>`;
      }
      continue;
    }
    // 줄·띠·등 얼룩: 등에서 시작해 옆구리로 갈수록 가늘어지고 뒤로 살짝 기운다
    const w = r * { stripes: 0.2, bands: 0.3, saddle: 0.8 }[K], lo = { stripes: -0.2, bands: -0.8, saddle: 0.2 }[K], sk = r * 0.18;
    s += `<path class="mk" d="${smooth([P(0.94, -w), P(0.94, w), P((0.94 + lo) / 2, w * 0.75 - sk / 2), P(lo, w * 0.25 - sk), P(lo, -w * 0.25 - sk), P((0.94 + lo) / 2, -w * 0.75 - sk / 2)])}" fill="${pat.color}" opacity="${op}"/>`;
  }
  return s;
}
// 깃털 털옷: 관의 윗선을 따라 꼬리 쪽으로 눕는 깃털 끝(가는 잎 모양)
function plumes(spine, t0, t1, color, len = 0.5) {
  if (!color) return '';
  const A = along(spine, t0), B = along(spine, t1), rm = Math.max(1e-4, (A[2] + B[2]) / 2), n = Math.max(2, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / (rm * 0.26)));
  const back = spine[0][0] < spine.at(-1)[0] ? -1 : 1;
  let s = '';
  for (let i = 0; i < n; i++) {
    const { r, P } = frameAt(spine, t0 + ((t1 - t0) * (i + 0.5)) / n);
    s += `<path class="pl" d="${smooth([P(0.72, -r * 0.18 * back), P(0.96 + len * 0.25, r * len * 0.7 * back), P(0.86, r * 0.28 * back)])}" fill="${color}"/>`;
  }
  return s;
}
// 목 아래 피부 주름(짧은 곡선 몇 개)
function folds(spine, t0, t1, n = 2) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const { r, P } = frameAt(spine, t0 + ((t1 - t0) * (i + 0.5)) / n);
    s += `<path class="seam" d="M${pt(P(-0.95, -r * 0.15))}Q${pt(P(-0.62, r * 0.12))} ${pt(P(-0.35, -r * 0.05))}"/>`;
  }
  return s;
}

// 수각류·두발 초식공룡 머리. skull: 모양 틀(SKULLS), F: horns, nosehorn, crest, crest2, cryo, bigeye, feathers
// 틀 값: back 뒤통수 높이, tip 주둥이 끝 높이, jaw 아래턱 깊이, eye 눈 위치, brow 눈 위 뼈 돌출, fen 눈앞 구멍 크기,
//        upt 주둥이 오목함, kink 윗입술 꺾임(코엘로피시스·딜로포사우루스), rosette 주둥이 끝 부풀음(스피노),
//        nostril 콧구멍 위치(u), teeth 이빨 크기, beak 부리(초식)
const SKULLS = {
  rex: { back: 0.62, tip: 0.38, jaw: 0.46, eye: [0.24, 0.36], brow: 0.08, fen: 0.85, teeth: 1.35 },
  allo: { back: 0.5, tip: 0.26, jaw: 0.3, eye: [0.21, 0.3], brow: 0.04, fen: 1, teeth: 1 },
  abel: { back: 0.64, tip: 0.44, jaw: 0.34, eye: [0.3, 0.38], brow: 0.07, fen: 0.55, teeth: 0.8 },
  raptor: { back: 0.42, tip: 0.15, jaw: 0.2, eye: [0.19, 0.27], brow: 0.03, fen: 0.9, upt: 0.09, teeth: 0.8 },
  slim: { back: 0.42, tip: 0.13, jaw: 0.17, eye: [0.19, 0.26], brow: 0.02, fen: 1, upt: 0.03, kink: 0.09, teeth: 0.7 },
  spino: { back: 0.36, tip: 0.17, jaw: 0.16, eye: [0.3, 0.3], brow: 0.03, fen: 0.35, upt: 0.06, kink: 0.1, rosette: 1, nostril: 0.55, teeth: 1 },
  herb: { back: 0.5, tip: 0.2, jaw: 0.24, eye: [0.32, 0.3], brow: 0.02, fen: 0.3, beak: 1, teeth: 0 },
  // 바다 파충류: 어룡(가는 주둥이·큰 눈과 눈 둘레 뼈 고리), 플리오사우루스(거대한 악어 머리), 수장룡(작은 머리·바늘 이빨), 모사사우루스(왕도마뱀 머리), 고래
  ichthy: { back: 0.58, tip: 0.07, jaw: 0.12, eye: [0.17, 0.3], brow: 0, fen: 0, upt: 0.05, teeth: 0.45, big: 1.9, ring: 1 },
  plio: { back: 0.5, tip: 0.3, jaw: 0.38, eye: [0.24, 0.36], brow: 0.05, fen: 0.25, teeth: 1.5 },
  plesio: { back: 0.55, tip: 0.2, jaw: 0.2, eye: [0.28, 0.32], brow: 0.02, fen: 0, teeth: 1.1 },
  mosa: { back: 0.48, tip: 0.2, jaw: 0.27, eye: [0.24, 0.3], brow: 0.05, fen: 0.4, teeth: 1.05, nostril: 0.62 },
  whale: { back: 0.45, tip: 0.16, jaw: 0.24, eye: [0.1, 0.1], brow: 0, fen: 0, teeth: 1.25, nostril: 0.42 },
};
function theroHead(x, y, hl, dp, c, skull = 'allo', F = []) {
  const m = headMap(x, y, hl, dp), s = { upt: 0, kink: 0, rosette: 0, nostril: 0.9, ...(SKULLS[skull] ?? SKULLS.allo) }, ro = s.rosette;
  if (F.includes('toothless')) s.teeth = 0;
  const dk = shade(c.back, -0.42), [eu, ev] = s.eye, mid = (s.back + s.tip) / 2;
  const top = [[0, -0.14], [-0.02, s.back * 0.72], [0.1, s.back], [eu, s.back * 0.96 + s.brow], [0.5, mid + 0.02 - s.upt], [0.78, s.tip + 0.05 - s.upt * 0.5], [0.95, s.tip * 0.88 + ro * 0.07], [1.01, s.tip * 0.4 + ro * 0.05],
    [0.99, -0.025], [0.82, -0.03 + s.kink], [0.72, -0.045], [0.4, -0.05], [0.12, -0.1]];
  const jaw = [[0.05, -0.06], [0.45, -0.045], [0.93 + ro * 0.04, -0.035], [0.97 + ro * 0.04, -0.06 - s.jaw * 0.12], [0.76, -s.jaw * 0.58], [0.4, -s.jaw * 0.93], [0.14, -s.jaw], [0.02, -s.jaw * 0.62]];
  const dot = (u, v, rx, ry, fill, op = 1) => { const [px, py] = m([u, v]); return `<ellipse class="tex" cx="${f(px)}" cy="${f(-py)}" rx="${f(rx * hl)}" ry="${f(ry * hl * dp)}" fill="${fill}" opacity="${op}"/>`; };
  // 뒤에 그리는 장식(볏·뿔·머리 깃털)
  let behind = '';
  if (F.includes('crest')) behind += path(smooth([[0.12, s.back * 0.85], [0.3, s.back + 0.55], [0.62, mid + 0.5], [0.85, s.tip + 0.25], [0.8, s.tip], [0.4, mid]].map(m)), c.accent)
    + [0.3, 0.45, 0.6].map(u => seam([[u, mid + 0.05], [u + 0.04, mid + 0.42]].map(m))).join('');
  if (F.includes('crest2')) for (const [k, sh] of [[0, 0], [0.1, -0.2]]) behind += path(smooth([[0.18 + k, s.back * 0.9], [0.32 + k, s.back + 0.75], [0.48 + k, s.back + 0.82], [0.88, s.tip + 0.12], [0.6, mid]].map(m)), shade(c.accent, sh));
  if (F.includes('cryo')) behind += path(poly([[0.14, s.back * 0.9], [0.16, s.back + 0.55], [0.22, s.back + 0.4], [0.27, s.back + 0.78], [0.33, s.back + 0.45], [0.38, s.back + 0.62], [0.44, s.back * 0.9]].map(m)), c.accent);
  if (F.includes('feathers')) behind += [0, 0.06, 0.12].map(k => path(smooth([[0.02 + k, s.back * 0.85], [-0.12 + k, s.back + 0.2 - k], [0.08 + k, s.back * 0.95]].map(m)), c.accent)).join('');
  // 앞에 그리는 세부: 눈앞 구멍(움푹한 그늘), 눈두덩, 콧구멍, 입술선과 입술 비늘, 턱 근육
  let face = dot(0.49, mid * 0.38, 0.13 * s.fen, 0.11 * s.fen + 0.02, dk, 0.35 * Math.min(1, s.fen))
    + path(smooth([[eu - 0.1, s.back * 0.82 + s.brow], [eu, s.back * 0.98 + s.brow * 1.4], [eu + 0.1, s.back * 0.9], [eu, s.back * 0.86 + s.brow]].map(m)), shade(c.back, -0.18))
    + dot(s.nostril, s.tip * 0.62 + (s.nostril < 0.8 ? 0.12 : 0), 0.03, 0.035, dk, 0.8)
    + seam([[0.12, -0.085], [0.45, -0.055], [0.95, -0.03]].map(m))
    + [0.5, 0.6, 0.7, 0.8, 0.9].map(u => dot(u, 0.02, 0.018, 0.03, shade(c.back, 0.25), 0.5)).join('')
    + `<path class="seam" d="M${pt(m([0.04, -s.jaw * 0.35]))}Q${pt(m([0.16, -s.jaw * 0.05]))} ${pt(m([0.3, -s.jaw * 0.25]))}"/>`;
  if (skull === 'rex') face += [0.12, 0.2, 0.28].map((u, i) => dot(u, s.back * 0.9 + s.brow * 1.6 - i * 0.03, 0.035, 0.05, shade(c.back, -0.25))).join(''); // 눈 위 울퉁불퉁한 혹
  if (F.includes('horns')) face += skull === 'abel'
    ? path(tube([[...m([eu + 0.02, s.back * 0.95]), hl * 0.07], [...m([eu - 0.06, s.back + 0.3]), hl * 0.05], [...m([eu - 0.16, s.back + 0.36]), hl * 0.004]]), shade(c.back, -0.28)) // 카르노타우루스: 굵은 황소 뿔
    : path(smooth([[eu + 0.04, s.back * 0.92], [eu + 0.09, s.back + 0.2], [eu + 0.16, s.back * 0.95]].map(m)), c.accent); // 알로사우루스: 눈앞 작은 삼각 뿔
  if (F.includes('nosehorn')) face += path(smooth([[0.76, s.tip + 0.02], [0.82, s.tip + 0.32], [0.88, s.tip + 0.02]].map(m)), c.accent);
  if (s.beak) face += path(smooth([[0.8, s.tip + 0.03], [1.02, s.tip * 0.5], [1.0, -0.06], [0.82, -0.04]].map(m)), shade(BEAK, -0.25));
  const tu = s.teeth ? teeth(m, 0.38, 0.95 + ro * 0.03, -0.03, 0.09 * s.teeth, Math.round(8 + 3 / s.teeth)) : '';
  const tj = s.teeth ? teeth(m, 0.42, 0.9 + ro * 0.03, -0.03, -0.07 * s.teeth, 7) : '';
  return `<g class="head">${behind}<g class="jaw">${tj}${path(smooth(jaw.map(m)), c.fill)}${s.beak ? path(smooth([[0.8, -0.04], [0.97, -0.05], [0.9, -s.jaw * 0.35]].map(m)), shade(BEAK, -0.35)) : ''}</g>`
    + tu + path(smooth(top.map(m)), c.fill) + face + (s.ring ? (([ex, ey]) => `<circle cx="${f(ex)}" cy="${f(-ey)}" r="${f(hl * 0.042 * s.big * 1.55)}" fill="none" stroke="${shade(c.back, -0.35)}" stroke-width="${f(hl * 0.02)}"/>`)(m([eu, ev])) : '')
    + eye(m, hl, dp, eu, ev, false, s.big ?? (F.includes('bigeye') ? 1.6 : 1)) + `</g>`;
}

// ── 두발(수각류, 새) ──
// params: h 엉덩이 높이, bd 몸 굵기, hl 머리 길이, dp 머리 높이 비율, arm 팔 길이, hipX 엉덩이 위치, neck 목 높이 배율,
//   head(thero|reptile|small|croc|beak|beakHook|beakTooth), skull 수각류 머리 모양(SKULLS),
//   hand 손(rex 두 손가락|claw 세 발톱|wing 깃털 날개|nub 뭉툭|scythe 긴 낫 발톱|thumb 큰 엄지 발톱|grasp 쥐는 손),
//   tl 몸통 길이, leg 다리 굵기 배율, meta 발등 길이 배율(잘 달릴수록 김), belly 배 처짐, tailUp 꼬리 들림, sail 돛 높이, wing 날개 크기,
//   pattern 무늬(marks), mark 무늬 색, markOp 무늬 진하기
function biped(p, c) {
  const { h, bd, hl, dp, arm, hipX = 0.47, neck = 1, head = 'reptile', leg: lr = 1, sail = 0, wing = 0, meta = 1, belly = 0.25, tailUp = 0, hand = 'claw', skull = 'allo' } = p, F = c.feats;
  const X = hipX, hx = 1 - hl, hy = h + bd * 1.15 * neck, tl = Math.min(p.tl ?? 0.25, hx - X - 0.05);
  const bird = head.startsWith('beak'); // 새는 깃털 질감이 이미 있어 등 깃털 끝을 따로 세우지 않는다(가시처럼 보임)
  const pl = F.includes('feathers') && !bird ? shade(c.back, -0.18) : null;
  // 꼬리: 엉덩이 쪽이 몸만큼 굵고(꼬리 근육) 끝으로 가늘어진다
  const tailS = [[0, h + bd * (0.3 + tailUp), 0.0025], [(X - 0.07) * 0.3, h + bd * (0.48 + tailUp * 0.8), bd * 0.2], [(X - 0.07) * 0.62, h + bd * (0.5 + tailUp * 0.4), bd * 0.46], [X - 0.07, h + bd * 0.35, bd * 0.82]];
  // 몸통: 엉덩이 → 처진 배 → 가슴. 가슴 쪽이 낮게 앞으로 기운다
  const bodyS = [[X - 0.1, h + bd * 0.32, bd * 0.8], [X - 0.01, h + bd * 0.12, bd * 0.98], [X + tl * 0.45, h - bd * belly, bd * 1.05], [X + tl * 0.8, h - bd * belly * 0.6, bd * 0.9], [X + tl, h + bd * 0.25, bd * 0.66]];
  // 다리 관절: 넓적다리 근육(j1) ⊃ 정강이(j2) ⊃ 발등(j3) ⊃ 발가락(j4). 무릎은 앞, 발목은 뒤로 꺾인 지그재그
  const legD = (dx, fill, side) => {
    const r = bd * lr, hip = [X + dx - r * 0.1, h + r * 0.15, r * 0.74], knee = [X + dx + h * 0.16, h * 0.5, r * 0.38];
    const ankle = [X + dx - h * 0.06 * meta, h * (0.1 + 0.12 * meta), r * 0.16], ball = [X + dx + h * 0.05, r * 0.14 + 0.001, r * 0.13];
    const g = fill === c.fill ? chainFill([[hip[0], h + bd * 1.1, 0], hip, knee, ankle, ball], c) : { fill, defs: '' };
    const toe = (len, drop, k) => {
      const tip = [ball[0] + h * len, r * 0.04 * k + 0.0008];
      return path(tube([[ball[0], ball[1], r * 0.12], [ball[0] + h * len * 0.55, r * (0.07 - drop), r * 0.075], [...tip, r * 0.05]]), k ? g.fill : shade(c.back, -0.35))
        + path(tube([[...tip, r * 0.045], [tip[0] + h * 0.035, 0.0005, 0.0012]]), HORN);
    };
    let foot = toe(0.11, 0.01, 0) + toe(0.15, 0, 1);
    if (F.includes('sickle_claw')) foot += path(tube([[ball[0] + h * 0.02, r * 0.2, r * 0.06], [ball[0] + h * 0.03, r * 0.65, r * 0.045], [ball[0] + h * 0.09, r * 0.72, 0.0012]]), HORN);
    const thigh = [hip, [(hip[0] + knee[0]) / 2 - r * 0.08, (hip[1] + knee[1]) / 2 + r * 0.1, r * 0.7], knee];
    const shin = [knee, [(knee[0] + ankle[0]) / 2 - r * 0.07, (knee[1] + ankle[1]) / 2, r * 0.3], ankle];
    const near = side === 'near';
    const scutes = near ? [0.25, 0.45, 0.65, 0.85].map(t => { const q = along([ankle, ball], t); return seam([[q[0] - r * 0.13, q[1]], [q[0] + r * 0.13, q[1] + r * 0.03]]); }).join('') : '';
    const muscle = near ? `<path class="seam" d="M${pt([hip[0] + r * 0.55, hip[1] - r * 0.5])}Q${pt([knee[0] + r * 0.5, (hip[1] + knee[1]) / 2])} ${pt([knee[0] + r * 0.2, knee[1] + r * 0.2])}"/>` : '';
    return `<g class="leg hind ${side}" ${near ? c.cast : ''}>${g.defs}<g class="j1">${path(tube(thigh), g.fill)}${muscle}`
      + `<g class="j2">${path(tube(shin), g.fill)}<g class="j3">${path(tube([ankle, ball]), g.fill)}${scutes}<g class="j4">${foot}</g></g></g></g></g>`;
  };
  // 팔 관절: 위팔(a1) ⊃ 아래팔(a2) ⊃ 손(a3). 손 모양이 동물마다 다르다
  const armD = (dx, fill, side) => {
    const sh = [X + tl - 0.015 + dx, h - bd * 0.25, bd * 0.2], e = [sh[0] + arm * 0.18, sh[1] - arm * 0.45, bd * 0.12], w = [e[0] + arm * 0.42, e[1] - arm * 0.08, bd * 0.07];
    const finger = (k, len, rr = bd * 0.035) => {
      const b = [w[0] + arm * 0.22 * len, w[1] - arm * (0.1 + k * 0.06) * len];
      return path(tube([[w[0], w[1] - k * bd * 0.02, rr], [...b, rr * 0.7]]), fill) + path(tube([[...b, rr * 0.6], [b[0] + arm * 0.06 * len, b[1] - arm * 0.12 * len, 0.0008]]), HORN);
    };
    const hands = {
      rex: () => finger(0, 0.6) + finger(1, 0.5),
      claw: () => finger(0, 1) + finger(1, 0.9) + finger(2, 0.7),
      nub: () => '',
      thumb: () => finger(1, 0.8, bd * 0.04) + finger(2, 0.7, bd * 0.04) + path(tube([[w[0], w[1] + bd * 0.02, bd * 0.05], [w[0] + arm * 0.12, w[1] - arm * 0.05, bd * 0.035], [w[0] + arm * 0.18, w[1] - arm * 0.3, 0.001]]), HORN),
      grasp: () => [0, 1, 2, 3].map(k => finger(k * 0.6, 0.55)).join('') + path(tube([[w[0], w[1], bd * 0.04], [w[0] + arm * 0.1, w[1] - arm * 0.28, 0.001]]), HORN),
      scythe: () => [0, 1, 2].map(k => path(tube([[w[0], w[1] - k * bd * 0.03, bd * 0.035], [w[0] + arm * (0.3 - k * 0.05), w[1] - arm * (0.45 + k * 0.05), bd * 0.025], [w[0] + arm * (0.15 - k * 0.04), w[1] - arm * (0.8 + k * 0.05), 0.001]]), HORN)).join(''),
      wing: () => finger(0, 0.8) + finger(1, 0.7),
    };
    // 깃털 날개(랩터 무리): 아래팔과 손 뒤로 늘어지는 깃털 부채
    const vane = hand !== 'wing' ? '' : [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1].map((t, i) => {
      const b = [e[0] + (w[0] + arm * 0.15 - e[0]) * t, e[1] + (w[1] - e[1]) * t], tip = [b[0] - arm * (0.3 - t * 0.08), b[1] - arm * (0.28 + t * 0.14)], q = arm * 0.1;
      return path(smooth([[b[0] - q, b[1] + q * 0.3], [tip[0] + q * 0.5, tip[1] + q], tip, [b[0] + q, b[1] - q * 0.3]]), shade(c.accent, (side === 'near' ? 0 : -0.3) - (i % 2) * 0.1));
    }).join('');
    const g = fill === c.fill ? chainFill([[sh[0], h + bd * 1.1, 0], sh, e, w], c) : { fill, defs: '' };
    return `<g class="arm ${side}">${g.defs}<g class="a1">${path(tube([sh, e]), g.fill)}<g class="a2">${vane}${path(tube([e, w]), g.fill)}<g class="a3">${(hands[hand] ?? hands.claw)()}</g></g></g></g>`;
  };
  // 날개(새): 어깨에서 뒤로 접은 깃털 날개, 깃 끝이 겹친다
  const wingD = (dx, fill) => {
    if (!wing) return '';
    const s = [X + tl * 0.8 + dx, h + bd * 0.55], tip = [s[0] - wing * 0.75, s[1] + wing * 0.25], pts = [s, [s[0] - wing * 0.2, s[1] + wing * 0.32], tip];
    for (let k = 1; k <= 6; k++) pts.push([tip[0] + (s[0] - tip[0]) * (k / 6) + (k % 2 ? wing * 0.03 : 0), tip[1] - (tip[1] - s[1] + bd * 0.5) * (k / 6) * (1 - k / 12) - (k % 2 ? wing * 0.04 : 0)]);
    return `<g class="wing">${path(smooth(pts), fill)}${[0.3, 0.5, 0.7].map(t => seam([[s[0] - wing * t * 0.75, s[1] + wing * 0.25 * t], [s[0] - wing * t * 0.6, s[1] - bd * 0.2]])).join('')}</g>`;
  };
  const top = t => frameAt(bodyS, t).P(0.95);
  const sailD = sail ? path(smooth([top(0.02), [X - 0.04, top(0.15)[1] + sail * 0.7], [X + tl * 0.3, top(0.4)[1] + sail], [X + tl * 0.75, top(0.7)[1] + sail * 0.75], top(0.95), top(0.5)]), c.accent)
    + [0.2, 0.35, 0.5, 0.65, 0.8].map(t => seam([top(t), [top(t)[0] - sail * 0.1, top(t)[1] + sail * (0.95 - Math.abs(t - 0.45) * 1.2)]])).join('') : '';
  // 등 갈기(카르카로돈토사우루스): 목·등·꼬리 뿌리를 따라 뒤로 누운 가시 줄. 밑동은 몸 뒤에 숨는다
  const ridge = (S, t0, t1, n) => [...Array(n)].map((_, i) => {
    const Fr = frameAt(S, t0 + ((t1 - t0) * i) / (n - 1)), b = Fr.P(0.8), w = Fr.r * 0.14, L = Fr.r * (0.5 + 0.25 * Math.sin((Math.PI * i) / (n - 1)));
    return path(`M${pt([b[0] - Fr.tx * w, b[1] - Fr.ty * w])}L${pt([b[0] + Fr.nx * L - Fr.tx * L * 0.5, b[1] + Fr.ny * L - Fr.ty * L * 0.5])}L${pt([b[0] + Fr.tx * w, b[1] + Fr.ty * w])}Z`, shade(c.accent, -0.15));
  }).join('');
  const maneD = F.includes('mane') ? ridge(tailS, 0.55, 1, 5) + ridge(bodyS, 0.05, 0.95, 9) : '';
  // 꼬리 끝 깃털 부채(랩터): 꼬리 양옆으로 늘어선 깃
  const fan = !pl || wing ? '' : [0.02, 0.06, 0.1, 0.14, 0.18, 0.22].map((t, i) => {
    const F = frameAt(tailS, t), L = bd * (0.8 - i * 0.07), q = bd * 0.16;
    return [1, -1].map(sg => path(smooth([F.P(sg * 0.5, q), [F.x - L * 0.75 + F.nx * sg * L * 0.55, F.y + F.ny * sg * L * 0.55 + q], [F.x - L * 0.8 + F.nx * sg * L * 0.5, F.y + F.ny * sg * L * 0.5 - q], F.P(sg * 0.5, -q)]), shade(c.accent, sg > 0 ? -i * 0.04 : -0.25))).join('');
  }).join('');
  const heads = {
    thero: () => theroHead(hx, hy, hl, dp, c, skull, F),
    reptile: () => theroHead(hx, hy, hl, dp, c, skull, F),
    croc: () => theroHead(hx, hy, hl, dp, c, 'spino', F),
    small: () => theroHead(hx, hy, hl, dp, c, 'herb', F),
    beak: () => beakHead(hx, hy, hl, dp, c),
    beakHook: () => beakHead(hx, hy, hl, dp, c, { hook: true }),
    beakTooth: () => beakHead(hx, hy, hl, dp, c, { teeth: true }),
  };
  const neckS = [[X + tl - 0.015, h + bd * 0.3, bd * 0.7], [(X + tl + hx) / 2, (h + bd * 0.3 + hy) / 2 + bd * 0.32 * Math.min(neck, 1.6), bd * 0.5], [hx + 0.03, hy + hl * dp * 0.06, hl * dp * 0.36]];
  const ventral = `<path class="seam" d="M${pt(frameAt(bodyS, 0.3).P(-0.55))}Q${pt(frameAt(bodyS, 0.6).P(-0.8))} ${pt(frameAt(bodyS, 0.9).P(-0.5))}"/>`;
  return wingD(-0.03, c.far) + legD(-0.035, c.limbFar ?? c.far, 'far') + (wing ? '' : armD(-0.02, c.limbFar ?? c.far, 'far')) + sailD + maneD
    + tailChain(tailS, c, 0, fan)
    + `<g class="body">${path(tube(bodyS), c.fill, '', marks(bodyS, c.pat) + plumes(bodyS, 0, 1, pl))}${ventral}</g>`
    + (F.includes('mane') ? ridge(neckS, 0.15, 0.8, 4) : '')
    + neckChain(neckS, c, heads[head]())
    + legD(0, c.limb ?? c.fill, 'near') + (wing ? wingD(0, c.accent) : armD(0, c.limb ?? c.fill, 'near'));
}

// 꼬리 관절 5마디: 몸 쪽(t1) ⊃ … ⊃ 끝(t5, tip 장식 포함). spine[0]이 꼬리 끝. 마디는 겹쳐 그려 이음새가 안 보인다
// 무늬·깃털은 마디끼리 겹치는 곳에 두 번 그려지지 않게 마디마다 맡은 구간(OWN)에만
const TAIL_SEGS = [[0.78, 1], [0.58, 0.83], [0.38, 0.63], [0.18, 0.43], [0, 0.23]], TAIL_OWN = [[0.8, 1], [0.6, 0.8], [0.4, 0.6], [0.2, 0.4], [0, 0.2]];
function tailChain(spine, c, dots = 0, tip = '') {
  const pl = c.feats.includes('feathers') && !c.bird ? shade(c.back, -0.18) : null;
  // 지느러미 꼬리(스피노사우루스 c.fin): 위아래로 높은 노 모양, 끝으로 갈수록 높다
  const fin = (t0, t1) => {
    if (!c.fin) return '';
    const q = [t0, (t0 + t1) / 2, t1].map(t => frameAt(spine, t)), H = t => c.fin * (1.2 - t);
    return path(smooth([...q.map((F, i) => F.P(0.6)), ...q.reverse().map(F => [F.x + F.nx * (F.r + H([t0, (t0 + t1) / 2, t1][2 - q.indexOf(F)])), F.y + F.ny * (F.r + H(0.5))])]), shade(c.back, -0.12))
      + path(smooth([...q.map(F => F.P(-0.6)), ...[...q].reverse().map(F => [F.x - F.nx * (F.r + c.fin * 0.45), F.y - F.ny * (F.r + c.fin * 0.45)])]), shade(c.back, -0.18));
  };
  const g = chainFill(spine, c), seg = (t0, t1, i) => fin(...TAIL_OWN[i]) + path(subTube(spine, t0, t1), g.fill, '', marks(spine, c.pat, ...TAIL_OWN[i]) + plumes(spine, ...TAIL_OWN[i], pl, 0.35)) + (dots ? scales([along(spine, t0), along(spine, t1)], Math.round(dots / 5), c.dots) : '');
  const chain = TAIL_SEGS.reduceRight((inner, [t0, t1], i) => `<g class="t${i + 1}">${i === 4 ? tip : ''}${seg(t0, t1, i)}${inner}</g>`, '');
  return `<g class="tail">${g.defs}${chain}</g>`;
}
// 목 관절 3마디: 아래(n1) ⊃ 가운데(n2) ⊃ 위(n3) ⊃ 머리. spine[0]이 몸 쪽
function neckChain(spine, c, headSvg) {
  const pl = c.feats.includes('feathers') && !c.bird ? shade(c.back, -0.18) : null;
  const g = chainFill(spine, c), seg = (t0, t1, o0, o1) => path(subTube(spine, t0, t1), g.fill, '', marks(spine, c.pat, o0, o1) + plumes(spine, o0, o1, pl, 0.4)) + folds(spine, o0, o1, 2);
  return `<g class="neck" ${c.cast}>${g.defs}<g class="n1">${seg(0, 0.4, 0, 0.37)}<g class="n2">${seg(0.35, 0.72, 0.37, 0.7)}<g class="n3">${seg(0.67, 1, 0.7, 0.95)}${headSvg}</g></g></g></g>`;
}
// 마디가 나뉜 꼬리·목은 마디마다 따로 색이 바뀌지 않게, 사슬 전체 높이에 맞춘 색·빛 그라디언트 하나를 같이 쓴다
let cg = 0;
function chainFill(spine, c) {
  const ys = spine.flatMap(([, y, r]) => [y + r, y - r]), top = Math.max(...ys), bot = Math.min(...ys), id = `ch${++cg}`;
  const fill = `url(#${id})`, line = (gid, stops) => `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(-top)}" x2="0" y2="${f(-bot)}">${stops}</linearGradient>`;
  CUR.lite.add(fill); // 움직이는 마디는 가벼운 질감(무거운 무늬는 몸통·머리만)
  CUR.lit.add(fill);
  CUR.volMap.set(fill, `url(#${id}v)`);
  return { fill, defs: `<defs>${line(id, c.stops)}${line(`${id}v`, c.light)}</defs>` };
}

// ── 네발(용각류, 뿔공룡, 갑옷공룡, 포유류, 악어·도마뱀형) ──
// params: hip·sh 엉덩이·어깨 높이, bd 몸 굵기, b0~b1 몸통 범위, neck [x,y] 머리 위치, nr 목 굵기, hl·dp 머리,
//         tail [x,y] 꼬리 끝, tr 꼬리 굵기, legR 다리 굵기, frontLeg 앞다리 굵기 배율, bend 무릎 굽힘(악어형),
//         head(sauro|cerato|mammal|croc|lizard|small|beak), sail 돛 높이, 뿔공룡 머리 params, snout 용각류 머리 모양,
//         foot 발(pillar 기둥발|stout 짧은 발톱|paw 발바닥·발톱|hoof 발굽|sprawl 벌린 발가락), sag 배 처짐, pattern·mark 무늬
function quad(p, c) {
  const { hip, sh, bd, b0, b1, neck: [nx, ny], nr, hl, dp, tail: [tx, ty], tr, legR, head, frontLeg = 1, bend = 0, sail = 0, sag = 0.15 } = p, F = c.feats;
  const foot = p.foot ?? { sauro: 'pillar', mammal: 'paw', croc: 'sprawl', lizard: 'sprawl', beak: 'sprawl' }[head] ?? 'stout';
  const dk = shade(c.back, -0.55), top0 = Math.max(hip, sh) + bd * 1.3;
  // 다리 관절: 넓적다리·위팔 근육(j1) ⊃ 정강이·아래팔(j2) ⊃ 발(j3) ⊃ 발가락·발굽(j4)
  // 발굽·발바닥 동물의 뒷다리는 발목(뒤꿈치)이 높이 들려 뒤로 꺾인다
  const leg = (x, top, r, fill, front, side) => {
    const tip = foot === 'hoof' || foot === 'paw', lift = tip && !front;
    const knee = [x + (front ? -0.1 : 0.35) * r + (front ? -1 : 1) * bend * r * 1.6, top * (lift ? 0.6 : 0.5), r * 0.9];
    const ground = foot === 'hoof' ? r * 0.42 : foot === 'pillar' ? r * 0.45 : r * 0.4;
    const ankle = [x + (lift ? -0.45 : 0.1) * r, Math.max(ground + r * 0.6, top * (lift ? 0.3 : tip ? 0.2 : 0.17)), r * (foot === 'pillar' ? 0.85 : 0.62)];
    const pad = [x + r * (foot === 'sprawl' ? 0.5 : 0.3), ground, r * (foot === 'hoof' ? 0.42 : foot === 'pillar' ? 0.9 : 0.6)];
    const g = fill === c.fill ? chainFill([[x, top0, 0], [x, top, r * 1.5], knee, ankle, pad], c) : { fill, defs: '' };
    const near = side === 'near';
    let toes = '';
    if (foot === 'hoof') toes = path(smooth([[pad[0] - r * 0.42, pad[1] + r * 0.05], [pad[0] + r * 0.45, pad[1] + r * 0.02], [pad[0] + r * 0.62, 0], [pad[0] - r * 0.45, 0]]), dk);
    else if (foot === 'pillar' || foot === 'stout') toes = [0, 1, 2].map(k => `<ellipse class="tex" cx="${f(pad[0] + r * (0.25 + k * 0.32))}" cy="${f(-r * 0.12)}" rx="${f(r * 0.17)}" ry="${f(r * 0.12)}" fill="${HORN}"/>`).join('');
    else if (foot === 'paw') toes = [0, 1, 2].map(k => path(smooth([[pad[0] + r * (0.05 + k * 0.28), r * 0.3], [pad[0] + r * (0.3 + k * 0.28), r * 0.25], [pad[0] + r * (0.3 + k * 0.28), 0], [pad[0] + r * (0.02 + k * 0.28), 0]]), g.fill)
      + (F.includes('claws') || front ? path(tube([[pad[0] + r * (0.32 + k * 0.28), r * 0.12, r * 0.07], [pad[0] + r * (0.45 + k * 0.28), 0.0005, 0.0006]]), shade(HORN, -0.3)) : '')).join('');
    else toes = [0, 1, 2, 3].map(k => path(tube([[pad[0], r * 0.25, r * 0.16], [pad[0] + r * (0.6 + k * 0.15), r * 0.08, r * 0.1], [pad[0] + r * (0.85 + k * 0.18), 0.001, r * 0.03]]), k % 2 ? g.fill : shade(c.back, -0.2))
      + path(tube([[pad[0] + r * (0.85 + k * 0.18), r * 0.02, r * 0.03], [pad[0] + r * (1 + k * 0.18), 0.0005, 0.0005]]), HORN)).join('');
    if (front && foot !== 'hoof' && F.includes('claws')) toes += [0, 1].map(k => path(tube([[x + r * 0.6, r * (0.5 + k * 0.3), r * 0.15], [x + r * 1.5, r * (0.2 + k * 0.3), r * 0.1], [x + r * 1.7, r * (0.6 + k * 0.3), r * 0.01]]), HORN)).join('');
    const padShape = foot === 'pillar' ? path(smooth([[ankle[0] - r * 0.8, ankle[1]], [pad[0] + r * 0.9, ankle[1] * 0.8], [pad[0] + r * 1.05, 0.0005], [pad[0] - r * 1.05, 0.0005]]), g.fill) : path(tube([ankle, pad]), g.fill);
    const muscle = near ? `<path class="seam" d="M${pt([x + r * 1.1, top - r * 0.4])}Q${pt([knee[0] + r * 0.9, (top + knee[1]) / 2])} ${pt([knee[0] + r * 0.5, knee[1] + r * 0.3])}"/>` : '';
    const wrinkle = near && (foot === 'pillar' || foot === 'stout') ? [0.3, 0.55].map(t => { const q = along([knee, ankle], t); return seam([[q[0] - r * 0.6, q[1] + r * 0.05], [q[0] + r * 0.6, q[1] - r * 0.05]]); }).join('') : '';
    return `<g class="leg ${front ? 'front' : 'hind'} ${side}" ${near ? c.cast : ''}>${g.defs}<g class="j1">${path(tube([[x, top, r * 1.55], [(x + knee[0]) / 2, (top + knee[1]) / 2, r * 1.2], knee]), g.fill)}${muscle}`
      + `<g class="j2">${path(tube([knee, [(knee[0] + ankle[0]) / 2, (knee[1] + ankle[1]) / 2, r * 0.75], ankle]), g.fill)}${wrinkle}<g class="j3">${padShape}<g class="j4">${toes}</g></g></g></g></g>`;
  };
  const legs = (dx, fill, side) => leg(b0 + 0.06 + dx, hip + bd * 0.2, legR, fill, false, side) + leg(b1 - 0.05 + dx, sh + bd * 0.2, legR * 0.95 * frontLeg, fill, true, side);
  // 몸통: 엉덩이 근육 → 처진 배 → 어깨. 다섯 점으로 등선과 배선이 따로 굽는다
  const yAt = t => hip + (sh - hip) * t;
  const bodyS = [[b0, yAt(0) + bd * 0.42, bd * 0.82], [b0 + (b1 - b0) * 0.25, yAt(0.25) + bd * (0.42 - sag * 0.5), bd * 0.98], [(b0 + b1) / 2, yAt(0.5) + bd * (0.45 - sag), bd * 1.03], [b0 + (b1 - b0) * 0.75, yAt(0.75) + bd * (0.42 - sag * 0.5), bd * 0.98], [b1, sh + bd * 0.42, bd * 0.84]];
  const tailS = [[tx, ty, 0.003], [(b0 + tx) / 2, (hip + ty) / 2 + bd * 0.4, tr * 0.55], [b0 + 0.05, hip + bd * 0.4, tr]];
  const top = t => { const [x, y, r] = along(bodyS, t); return [x, y + r * 0.92]; };
  const mid = [(b1 + nx) / 2, (sh + ny) / 2 + bd * 0.3];

  // 몸 장식
  let behind = '', over = '', tailDeco = '';
  if (sail) behind += path(smooth([top(0.05), [b0 + (b1 - b0) * 0.25, top(0.25)[1] + sail * 0.85], [b0 + (b1 - b0) * 0.55, top(0.55)[1] + sail], [b0 + (b1 - b0) * 0.85, top(0.85)[1] + sail * 0.6], top(0.97), top(0.5)]), c.accent)
    + [0.2, 0.35, 0.5, 0.65, 0.8].map(t => seam([top(t), [top(t)[0], top(t)[1] + sail * (1 - Math.abs(t - 0.55) * 1.1)]])).join('');
  if (F.includes('plates')) for (let i = 0; i < 9; i++) {
    const t = 0.05 + i * 0.11, [x, y] = top(t), s = bd * (0.45 + 0.55 * Math.sin(Math.PI * (0.2 + t * 0.7)));
    // 스테고사우루스 판: 끝이 둥근 오각형, 가운데 핏줄 무늬 홈
    behind += path(smooth([[x - s * 0.5, y - s * 0.15], [x - s * 0.42, y + s * 0.6], [x, y + s * 1.15], [x + s * 0.45, y + s * 0.55], [x + s * 0.5, y - s * 0.15]]), i % 2 ? c.accent : shade(c.accent, -0.15))
      + seam([[x, y], [x - s * 0.05, y + s * 0.8]]);
  }
  if (F.includes('hump')) behind += `<circle cx="${f(b1 - 0.08)}" cy="${f(-(sh + bd * 1.0))}" r="${f(bd * 0.55)}" fill="${shade(c.back, -0.1)}"/>`;
  if (F.includes('shell')) {
    over += path(smooth([[b0 - 0.04, hip + bd * 0.05], [b0 - 0.02, hip + bd * 1.1], [(b0 + b1) / 2, (hip + sh) / 2 + bd * 1.75], [b1 + 0.02, sh + bd * 1.1], [b1 + 0.04, sh + bd * 0.05]]), shade(c.back, 0.08));
    for (let i = 0; i < 18; i++) {
      const u = (i % 6) / 5, v = Math.floor(i / 6), x = b0 + (b1 - b0) * (0.1 + u * 0.8), y = (hip + sh) / 2 + bd * (0.35 + v * 0.42) * (1 - Math.abs(u - 0.5) * 0.6);
      over += `<circle class="tex" cx="${f(x)}" cy="${f(-y)}" r="${f(bd * 0.13)}" fill="none" stroke="${shade(c.back, -0.35)}" stroke-width="${f(bd * 0.03)}"/>`;
    }
  }
  // 골편(갑옷 혹): 등을 따라 두세 줄, 가운데가 솟은 타원 판
  if (F.includes('bumps')) for (let row = 0; row < (F.includes('club') || F.includes('spikes') ? 3 : 2); row++) for (let i = 0; i < 12; i++) {
    const t = 0.04 + i * 0.08 + (row % 2) * 0.04, { r, P } = frameAt(bodyS, Math.min(0.98, t)), [x, y] = P(0.85 - row * 0.32), s = r * (0.13 - row * 0.02);
    over += `<ellipse class="tex" cx="${f(x)}" cy="${f(-y)}" rx="${f(s * 1.3)}" ry="${f(s)}" fill="${shade(c.back, -0.3)}"/><ellipse class="tex" cx="${f(x - s * 0.2)}" cy="${f(-y - s * 0.25)}" rx="${f(s * 0.6)}" ry="${f(s * 0.4)}" fill="${shade(c.back, 0.25)}" opacity=".5"/>`;
  }
  if (F.includes('spikes')) for (let i = 0; i < 6; i++) { const [x, y] = top(0.15 + i * 0.13); over += horn(([u, v]) => [x + u * bd, y - bd * 0.25 + v * bd], bd, [0, 0], [0.35, 0.5 + (i > 3 ? 0.4 : 0)], 0.12); }
  // 옆구리 큰 가시(에드몬토니아·힐라에오사우루스): 어깨에서 앞·옆으로
  if (F.includes('spikes')) over += [0.8, 0.92].map((t, i) => { const [x, y] = frameAt(bodyS, t).P(0.1); return horn(([u, v]) => [x + u * bd, y + v * bd], bd, [0, 0], [0.9 - i * 0.2, -0.3 + i * 0.4], 0.14); }).join('');
  if (F.includes('fur')) {
    const pts = [];
    for (let i = 0; i <= 16; i++) pts.push(frameAt(bodyS, i / 16).P(i % 2 ? -1.22 : -1.02));
    over += path(smooth([...pts, ...[...Array(9)].map((_, i) => frameAt(bodyS, 1 - i / 8).P(-0.6))]), shade(c.back, -0.12));
  }
  if (p.shoulder && c.limb) {
    const q = [0.68, 0.76, 0.84, 0.92, 1].map(t => frameAt(bodyS, t));
    over += path(smooth([...q.map(F => F.P(0.97)), ...[...q].reverse().map(F => F.P(-0.97))]), c.limb);
  }
  if (F.includes('club')) tailDeco += path(smooth([[tx - 0.005, ty], [tx + tr * 0.3, ty + tr * 0.9], [tx + tr * 1.6, ty + tr * 0.85], [tx + tr * 2.2, ty], [tx + tr * 1.6, ty - tr * 0.85], [tx + tr * 0.3, ty - tr * 0.9]]), shade(c.back, -0.15))
    + seam([[tx + tr * 1.1, ty + tr * 0.85], [tx + tr * 1.1, ty - tr * 0.85]]);
  if (F.includes('spiked_club')) tailDeco += [-0.6, 0, 0.6].map(k => horn(([u, v]) => [tx + 0.02 + u * tr, ty + v * tr], tr, [0, 0], [k * 0.9, 1.3 - Math.abs(k) * 0.3], 0.25)).join('') + `<ellipse cx="${f(tx + 0.02)}" cy="${f(-ty)}" rx="${f(tr * 1.0)}" ry="${f(tr * 0.8)}" fill="${shade(c.back, -0.15)}"/>`;
  if (F.includes('thagomizer')) tailDeco += [0.12, 0.22].map(k => horn(([u, v]) => [tx + k + u * 0.05, ty + 0.02 + v * 0.05], 0.05, [0, 0], [-0.8, 1.5], 0.2) + horn(([u, v]) => [tx + k + u * 0.05, ty + 0.02 + v * 0.05], 0.05, [0, 0], [-1.2, 0.9], 0.18)).join('');

  const heads = {
    sauro: () => sauroHead(nx - hl * 0.1, ny, hl, dp, c, p.snout),
    cerato: () => ceratoHead(nx - hl * 0.25, ny, hl, dp, c, p),
    mammal: () => mammalHead(nx - hl * 0.15, ny, hl, dp, c, p.skull),
    croc: () => reptileHead(nx - hl * 0.05, ny, hl, dp, c, { feats: F }),
    lizard: () => reptileHead(nx - hl * 0.05, ny, hl, dp, c, { feats: F }),
    small: () => reptileHead(nx - hl * 0.1, ny, hl, dp, c, { feats: F, teeth: false }),
    beak: () => beakHead(nx - hl * 0.1, ny, hl, dp, c),
  };
  const lines = `<path class="seam" d="M${pt(frameAt(bodyS, 0.15).P(-0.6))}Q${pt(frameAt(bodyS, 0.5).P(-0.85))} ${pt(frameAt(bodyS, 0.85).P(-0.6))}"/>`
    + `<path class="seam" d="M${pt(frameAt(bodyS, 0.86).P(0.5))}Q${pt(frameAt(bodyS, 0.8).P(-0.1))} ${pt(frameAt(bodyS, 0.88).P(-0.55))}"/>`;
  return legs(0.035, c.limbFar ?? c.far, 'far') + behind
    + tailChain(tailS, c, 0, tailDeco)
    + `<g class="body">${path(tube(bodyS), c.fill, '', marks(bodyS, c.pat))}${['mammal'].includes(head) || F.includes('shell') ? '' : scales(bodyS, 26, c.dots)}${lines}${over}</g>`
    + neckChain([[b1 - 0.03, sh + bd * 0.5, nr * 1.6], [...mid, nr * 1.2], [nx, ny, nr]], c, heads[head]())
    + legs(0, c.limb ?? c.fill, 'near');
}

// ── 헤엄치는 동물(해양 파충류, 물고기, 고래, 거북) ──
// params: bd, hl, dp, neckL 목 길이, fl 지느러미 크기, hind 뒷지느러미 크기(앞 = 1), deep 몸 높이 배율,
//         flukeUp·flukeDown 꼬리지느러미 위·아래 날개 크기(어룡 1·1, 상어 1.2·0.6, 모사사우루스 1·0.35, 고래 옆모습 0.3·0.3),
//         head(reptile|shark|plate|beak), skull 파충류 머리 모양(SKULLS: ichthy 어룡|plio 플리오사우루스|plesio 수장룡|mosa 모사사우루스|whale 고래)
function swimmer(p, c) {
  const { bd, hl, dp, neckL = 0, fl = 1, head = 'reptile', hind = 0.7, deep = 1 } = p, F = c.feats, y = bd * (1.2 + 1.0 * fl);
  const front = 1 - hl - neckL, L = front - 0.36;
  // 지느러미: 뿌리가 넓고 끝이 뾰족하게 뒤로 젖힌 날개꼴 + 가운데 뼈 줄
  const flipper = (x, s, fill) => {
    const k = s * fl, root = [x, y - bd * 0.35 * deep], tip = [x - 0.1 * k, y - bd * (0.6 + 1.5 * k)];
    return `<g class="flipper">${path(smooth([[x + bd * 0.5 * k, root[1]], [x + 0.012 * k, y - bd * (0.4 + 0.8 * k)], tip, [x - 0.075 * k, y - bd * (0.4 + 0.9 * k)], [x - bd * 0.4 * k, root[1] + bd * 0.08]]), fill)}`
      + seam([[x, root[1] - bd * 0.1], [x - 0.05 * k, y - bd * (0.5 + 1.1 * k)]]) + `</g>`;
  };
  // 꼬리지느러미: 두 날개가 뒤로 젖힌 초승달(위·아래 크기는 동물마다)
  const up = p.flukeUp ?? 0.4, dn = p.flukeDown ?? 1.1, U = bd * 1.5 * up, D = bd * 1.5 * dn;
  const fluke = F.includes('tail_fluke') ? path(smooth([[0.1, y + bd * 0.12], [0.06, y + U * 0.6], [-0.01, y + U], [0.025, y + U * 0.35], [0.03, y], [0.025, y - D * 0.35], [-0.01, y - D], [0.06, y - D * 0.6], [0.1, y - bd * 0.12]]), c.fill)
    + seam([[0.07, y], [0.0, y + U * 0.85]]) + seam([[0.07, y], [0.0, y - D * 0.85]]) : '';
  const bodyS = [[0.36, y, bd * 0.8 * deep], [0.36 + L * 0.3, y, bd * 0.95 * deep], [0.36 + L * 0.6, y, bd * deep], [front - 0.02, y, bd * 0.8 * deep], [front + 0.03, y + bd * 0.05, neckL ? bd * 0.4 : bd * 0.42 * Math.sqrt(deep)]];
  const hy = neckL ? y + bd * 0.9 : y - hl * dp * 0.08;
  const dorsal = F.includes('dorsal') ? path(smooth([[0.36 + L * 0.35, y + bd * 0.8 * deep], [0.36 + L * 0.52, y + bd * (1.2 + 0.8 * deep)], [0.36 + L * 0.6, y + bd * (1.15 + 0.75 * deep)], [0.36 + L * 0.68, y + bd * 0.8 * deep]]), c.fill) : '';
  const shell = F.includes('shell') ? path(smooth([[0.3, y], [0.38, y + bd * 1.3], [0.36 + L * 0.5, y + bd * 1.75], [front - 0.04, y + bd * 1.2], [front, y]]), shade(c.back, -0.1))
    + [0.25, 0.5, 0.75].map(t => seam([[0.36 + L * t, y + bd * 0.2], [0.36 + L * t, y + bd * (1.2 + (t === 0.5 ? 0.5 : 0.2))]])).join('')
    + [0.2, 0.4, 0.6, 0.8].map(t => seam([[0.36 + L * t - 0.02, y + bd * (1.25 + 0.4 * Math.sin(Math.PI * t))], [0.36 + L * t + 0.02, y + bd * (1.25 + 0.4 * Math.sin(Math.PI * t))]])).join('') : '';
  // 물고기 아가미구멍(상어 다섯 줄)·비늘 없는 매끈한 배
  const gills = head === 'shark' ? [0, 1, 2, 3, 4].map(i => seam([[front - 0.005 - i * 0.012, y + bd * 0.35], [front - 0.012 - i * 0.012, y - bd * 0.25]])).join('') : '';
  const heads = {
    reptile: () => (p.skull ? theroHead(1 - hl, hy, hl, dp, c, p.skull, F) : reptileHead(1 - hl, hy, hl, dp, c, { feats: F })),
    shark: () => fishHead(1 - hl, hy, hl, dp, c, 'shark'),
    plate: () => fishHead(1 - hl, hy, hl, dp, c, 'plate'),
    beak: () => beakHead(1 - hl, hy, hl, dp, c, { hook: true }),
  };
  // 헤엄: 꼬리 3마디가 물결치고(끝에 꼬리지느러미), 목이 긴 동물은 목 2마디
  return flipper(front - 0.15, 1, c.far) + flipper(0.44, hind, c.far) + dorsal
    + tailChain([[0.02, y, 0.004], [0.15, y, bd * 0.3 * deep], [0.28, y, bd * 0.55 * deep], [0.42, y, bd * 0.85 * deep]], c, 0, fluke)
    + `<g class="body">${path(tube(bodyS), c.fill, '', marks(bodyS, c.pat))}${head === 'shark' ? '' : scales(bodyS, 26, c.dots)}${shell}${gills}<path class="seam" d="M${pt(frameAt(bodyS, 0.1).P(-0.5))}Q${pt(frameAt(bodyS, 0.5).P(-0.75))} ${pt(frameAt(bodyS, 0.95).P(-0.45))}"/></g>`
    + (neckL ? neckChain([[front, y + bd * 0.05, bd * 0.42], [(front + 1 - hl) / 2, y + bd * 0.6, bd * 0.3], [1 - hl + 0.01, hy + hl * dp * 0.1, hl * dp * 0.3]], c, heads[head]()) : heads[head]())
    + flipper(front - 0.17, 1, c.fill) + flipper(0.42, hind, c.fill);
}

// ── 익룡 ── params: h 엉덩이 높이, bd, neck [x,y], hl, dp, crest 볏 크기, crestType(sail 주둥이부터 솟은 큰 돛 볏|back 뒤통수 뾰족 볏), longTail, wing 날개 크기, teeth
// 날개 = 팔뼈(어깨 → 팔꿈치 → 손목) + 아주 긴 넷째 손가락. 막은 손가락 끝에서 발목까지, 결을 따라 가는 줄(섬유)
function ptero(p, c) {
  const { h, bd, neck: [nx, ny], hl, dp, crest = 0, crestType = 'back', longTail = false, wing = 0.5, teeth = false } = p;
  const sh = [0.3, h + bd * 0.6], elbow = [sh[0] - wing * 0.05, sh[1] + wing * 0.22], wrist = [sh[0] + wing * 0.1, sh[1] + wing * 0.5];
  const tip = [sh[0] - wing * 0.85, sh[1] + wing * 0.85], ankle = [0.17, h * 0.55];
  const wingD = (dx, fill, mem, near) => {
    const X = ([x, y]) => [x + dx, y], fold = [(tip[0] + ankle[0]) / 2 + wing * 0.18, (tip[1] + ankle[1]) / 2 + wing * 0.02];
    // 막 뒷가장자리는 살짝 물결(막이 팽팽히 당겨진 모양)
    const edge = [0.25, 0.5, 0.75].map((t, i) => X([tip[0] + (ankle[0] - tip[0]) * t + wing * 0.1 * Math.sin(Math.PI * t) + (i % 2 ? wing * 0.02 : 0), tip[1] + (ankle[1] - tip[1]) * t + wing * 0.08 * Math.sin(Math.PI * t)]));
    const memD = `M${pt(X(sh))}L${pt(X(elbow))}L${pt(X(wrist))}L${pt(X(tip))}` + edge.map(q => `L${pt(q)}`).join('') + `L${pt(X(ankle))}Z`;
    const fibers = near ? [0.2, 0.4, 0.6, 0.8].map(t => seam([X([wrist[0] + (tip[0] - wrist[0]) * t, wrist[1] + (tip[1] - wrist[1]) * t]), X([fold[0] + (ankle[0] - fold[0]) * (1 - t) * 0.5, fold[1] - wing * 0.05 * t])])).join('') : '';
    const propat = path(smooth([X(sh), X([wrist[0] + wing * 0.02, wrist[1] - wing * 0.02]), X([sh[0] + wing * 0.12, sh[1] + wing * 0.2])]), mem); // 어깨~손목 앞쪽 작은 막
    const bones = path(tube([[...X(sh), bd * 0.32], [...X(elbow), bd * 0.22], [...X(wrist), bd * 0.18]]), fill) + path(tube([[...X(wrist), bd * 0.16], [...X([wrist[0] - wing * 0.25, wrist[1] + wing * 0.18]), bd * 0.08], [...X(tip), bd * 0.025]]), fill);
    const claws = near ? [0, 1, 2].map(k => path(tube([[...X(wrist), bd * 0.05], [...X([wrist[0] + wing * 0.05, wrist[1] - wing * (0.02 + k * 0.025)]), 0.0008]]), HORN)).join('') : '';
    return `<g class="wing"><g opacity=".9">${path(memD, mem)}${propat}</g>${fibers}${bones}${claws}</g>`;
  };
  const legD = (dx, fill, side) => `<g class="leg hind ${side}"><g class="j1">${path(tube([[0.18 + dx, h, bd * 0.35], [0.21 + dx, h * 0.5, bd * 0.2]]), fill)}`
    + `<g class="j2">${path(tube([[0.21 + dx, h * 0.5, bd * 0.2], [0.18 + dx, bd * 0.15, bd * 0.12]]), fill)}<g class="j3">${path(tube([[0.16 + dx, bd * 0.1, bd * 0.1], [0.25 + dx, bd * 0.03, bd * 0.03]]), fill)}`
    + `<g class="j4">${[0, 1, 2].map(k => path(tube([[0.24 + dx, bd * 0.03, bd * 0.025], [0.27 + dx + k * 0.004, 0.0005, 0.0006]]), HORN)).join('')}</g></g></g></g></g>`;
  const tail = longTail ? path(tube([[0.12, h + bd * 0.1, bd * 0.2], [0.05, h + bd * 0.3, bd * 0.06], [0.01, h + bd * 0.35, 0.003]]), c.fill)
    + path(smooth([[0.0, h + bd * 0.35], [0.03, h + bd * 0.8], [0.065, h + bd * 0.35], [0.03, h - bd * 0.05]]), c.accent) + seam([[0.03, h + bd * 0.7], [0.03, h + bd * 0.02]]) : '';
  const mem = shade(c.back, 0.25), memFar = shade(c.back, -0.1), pb = [[0.1, h + bd * 0.1, bd * 0.6], [0.2, h + bd * 0.3, bd], [0.3, h + bd * 0.5, bd * 0.75]];
  return wingD(-0.04, c.far, memFar, false) + legD(-0.03, c.far, 'far')
    + `<g class="tail">${tail}</g>`
    + `<g class="body">${path(tube(pb), c.fill, '', marks(pb, c.pat) + plumes(pb, 0, 1, shade(c.back, -0.15), 0.3))}</g>`
    + neckChain([[0.3, h + bd * 0.6, bd * 0.45], [(0.3 + nx) / 2, (h + ny) / 2 + 0.02, bd * 0.36], [nx, ny, bd * 0.3]], c, pteroHead(nx - hl * 0.05, ny, hl, dp, c, { crest, crestType, teeth }))
    + legD(0, c.fill, 'near') + wingD(0, c.fill, mem, true);
}

// ── 절지동물 ── params.kind: trilobite | anomalocaris | hallucigenia | eurypterid | millipede | dragonfly
function arthropod(p, c) {
  const k = p.kind, dk = shade(c.back, -0.3);
  // 다리마다 따로 꼼지락(.aleg, 조금씩 늦게)
  const legs = (xs, top, len, fill = dk) => xs.map((x, i) => `<g class="aleg" style="animation-delay:-${f(i * 0.13)}s">${path(tube([[x, top, 0.008], [x + 0.01, top * 0.5, 0.007], [x + (i % 2 ? 0.02 : -0.01), 0, 0.004]]), fill)}</g>`).join('');
  const range = (a, b, n) => [...Array(n)].map((_, i) => a + ((b - a) * i) / (n - 1));
  if (k === 'trilobite') {
    const body = [[0, 0.015], [0.04, 0.09], [0.3, 0.2], [0.7, 0.22], [0.92, 0.17], [1, 0.05], [0.98, 0.0], [0.02, 0.0]];
    const spine = path(tube([[0.7, 0.03, 0.018], [0.5, 0.012, 0.01], [0.3, 0.004, 0.002]]), shade(c.back, -0.2));
    const axis = path(smooth([[0.08, 0.1], [0.3, 0.215], [0.66, 0.235], [0.66, 0.19], [0.3, 0.17], [0.1, 0.07]]), shade(c.back, 0.12));
    const tips = range(0.1, 0.62, 10).map(x => path(poly([[x - 0.012, 0.012], [x + 0.012, 0.012], [x - 0.02, -0.002]]), shade(c.back, -0.15))).join('');
    return `<g class="body">${legs(range(0.15, 0.85, 8), 0.03)}${spine}${tips}${path(smooth(body), c.fill)}${axis}`
      + range(0.12, 0.62, 10).map(x => seam([[x, 0.02], [x + 0.02, 0.2 * Math.sin(Math.PI * (0.15 + x * 0.8))]])).join('')
      + `${path(smooth([[0.66, 0.2], [0.8, 0.25], [0.95, 0.15], [0.9, 0.08], [0.68, 0.1]]), shade(c.back, 0.1))}</g>`
      + `<g class="head">${path(smooth([[0.74, 0.2], [0.8, 0.255], [0.86, 0.2], [0.8, 0.215]]), EYE)}${[0.765, 0.785, 0.805, 0.825].map(x => `<circle class="tex" cx="${f(x)}" cy="${f(-0.225)}" r="0.004" fill="#fff"/>`).join('')}</g>`;
  }
  if (k === 'anomalocaris') {
    const y = 0.13;
    let s = `<g class="tail">${[[0, 0.22], [0.02, 0.05], [0.04, 0.12]].map(([dx, dy]) => path(smooth([[0.12, y], [dx, y + dy], [dx + 0.05, y - 0.02]]), c.accent)).join('')}</g><g class="body">`;
    s += range(0.15, 0.8, 11).map((x, i) => `<ellipse cx="${f(x)}" cy="${f(-(y - 0.02))}" rx="${f(0.055)}" ry="${f(0.06 + 0.04 * Math.sin(i / 3))}" fill="${i % 2 ? c.accent : shade(c.accent, -0.15)}"/>`).join('');
    s += path(tube([[0.1, y, 0.025], [0.5, y + 0.01, 0.06], [0.85, y + 0.01, 0.055]]), c.fill) + range(0.2, 0.8, 9).map(x => seam([[x, y + 0.06], [x, y - 0.05]])).join('') + `</g>`;
    s += `<g class="head">${path(tube([[0.85, y + 0.02, 0.05], [0.93, y + 0.02, 0.045]]), c.fill)}`
      + [0, 1].map(j => path(tube([[0.95, y - 0.01 - j * 0.01, 0.018], [1.02, y - 0.07, 0.014], [0.99, y - 0.12, 0.01], [0.95, y - 0.1, 0.004]]), shade(c.back, -0.15))
        + [[0.99, y - 0.04], [1.0, y - 0.07], [0.99, y - 0.1]].map(([x, yy]) => path(poly([[x - 0.006, yy], [x + 0.006, yy - 0.004], [x - 0.02, yy - 0.012]]), HORN)).join('')).join('')
      + path(tube([[0.88, y + 0.06, 0.006], [0.9, y + 0.1, 0.006]]), dk) + eyeDot(0.9, y + 0.11, 0.018) + `</g>`;
    return s;
  }
  if (k === 'hallucigenia') {
    const y = 0.1;
    return `<g class="body">${legs(range(0.2, 0.85, 7), y)}`
      + range(0.18, 0.75, 7).map(x => path(poly([[x - 0.015, y + 0.02], [x + 0.02, y + 0.17], [x + 0.025, y + 0.02]]), c.accent)).join('')
      + path(tube([[0.02, y - 0.01, 0.01], [0.3, y, 0.028], [0.85, y, 0.026], [0.93, y + 0.01, 0.02]]), c.fill) + `</g>`
      + `<g class="head"><circle cx="0.96" cy="${f(-(y + 0.015))}" r="0.035" fill="${c.fill}"/>${eyeDot(0.97, y + 0.025, 0.01)}</g>`;
  }
  if (k === 'eurypterid') {
    const y = 0.08;
    return `<g class="body">${legs(range(0.62, 0.86, 4), y, 0.1)}`
      + `<g class="flipper">${path(tube([[0.6, y, 0.02], [0.5, y - 0.03, 0.03], [0.42, y - 0.02, 0.045]]), dk)}</g>`
      + range(0.12, 0.62, 9).map((x, i) => `<ellipse cx="${f(x)}" cy="${f(-y)}" rx="0.04" ry="${f(0.035 + 0.025 * (i / 8))}" fill="${i % 2 ? c.fill : shade(c.back, -0.05)}"/>`).join('')
      + range(0.16, 0.58, 8).map(x => seam([[x, y + 0.04], [x, y - 0.035]])).join('')
      + `</g><g class="tail">${path(tube([[0.12, y, 0.02], [0.04, y + 0.03, 0.01], [0, y + 0.06, 0.002]]), dk)}${path(poly([[0.05, y + 0.03], [-0.01, y + 0.075], [0.02, y + 0.035]]), shade(c.back, -0.4))}</g>`
      + `<g class="head">${path(smooth([[0.62, y - 0.04], [0.66, y + 0.08], [0.88, y + 0.08], [1, y + 0.02], [0.95, y - 0.04]]), c.fill)}${eyeDot(0.84, y + 0.06, 0.015)}</g>`;
  }
  if (k === 'millipede') {
    const y = 0.06;
    return `<g class="body">${legs(range(0.05, 0.92, 22), y * 0.6)}`
      + range(0.04, 0.9, 20).map((x, i) => path(smooth([[x - 0.028, y - 0.04], [x - 0.03, y + 0.05], [x + 0.03, y + 0.055], [x + 0.032, y - 0.04]]), i % 2 ? c.fill : shade(c.back, -0.08))
        + `<ellipse class="tex" cx="${f(x)}" cy="${f(-(y + 0.03))}" rx="0.008" ry="0.006" fill="${shade(c.back, 0.35)}"/><ellipse class="tex" cx="${f(x + 0.004)}" cy="${f(-(y - 0.015))}" rx="0.007" ry="0.005" fill="${shade(c.back, 0.2)}"/>`).join('')
      + `</g><g class="head">${path(smooth([[0.9, y - 0.035], [0.92, y + 0.04], [1, y + 0.02], [0.99, y - 0.03]]), c.fill)}`
      + path(tube([[0.98, y + 0.04, 0.004], [1.04, y + 0.1, 0.002]]), dk) + eyeDot(0.96, y + 0.015, 0.008) + `</g>`;
  }
  // dragonfly
  const y = 0.12;
  const wingP = (a, b, fill) => `<g transform="rotate(${f(b[2])} ${f(a[0])} ${f(-a[1])})"><ellipse cx="${f(a[0])}" cy="${f(-a[1])}" rx="${f(b[0])}" ry="${f(b[1])}" fill="${fill}" opacity=".55"/>`
    + [-0.3, 0.25].map(k => `<path class="seam" d="M${f(a[0] - b[0] * 0.95)},${f(-a[1] + b[1] * k)}Q${f(a[0])},${f(-a[1] + b[1] * k * 1.6)} ${f(a[0] + b[0] * 0.95)},${f(-a[1] + b[1] * k * 0.4)}"/>`).join('')
    + `<ellipse class="tex" cx="${f(a[0] + b[0] * 0.78)}" cy="${f(-a[1] - b[1] * 0.35)}" rx="${f(b[0] * 0.06)}" ry="${f(b[1] * 0.22)}" fill="${shade(c.back, -0.4)}"/></g>`;
  return `<g class="wing">${wingP([0.6, y + 0.22], [0.32, 0.06, -55], shade(c.accent, -0.2))}${wingP([0.5, y + 0.2], [0.3, 0.055, -40], shade(c.accent, -0.2))}</g>`
    + `<g class="body">${legs([0.68, 0.73, 0.78], y - 0.02)}${path(tube([[0.0, y + 0.01, 0.012], [0.3, y, 0.018], [0.62, y, 0.022]]), c.fill)}`
    + range(0.08, 0.58, 9).map(x => seam([[x, y + 0.02], [x, y - 0.02]])).join('') + path(tube([[0.62, y, 0.04], [0.78, y + 0.005, 0.045]]), c.fill) + `</g>`
    + `<g class="head"><circle cx="0.86" cy="${f(-(y + 0.01))}" r="0.05" fill="${shade(c.accent, -0.1)}"/>${eyeDot(0.88, y + 0.025, 0.02)}</g>`
    + `<g class="wing">${wingP([0.64, y + 0.24], [0.33, 0.06, -62], c.accent)}${wingP([0.56, y + 0.22], [0.31, 0.055, -48], c.accent)}</g>`;
}
const eyeDot = (x, y, r) => `<circle class="tex" cx="${f(x)}" cy="${f(-y)}" r="${f(r)}" fill="${EYE}"/><circle class="tex" cx="${f(x + r * 0.3)}" cy="${f(-y - r * 0.3)}" r="${f(r * 0.35)}" fill="#fff"/>`;

// ── 뱀 ── params: r 몸 굵기
function snake(p, c) {
  const r = p.r ?? 0.04;
  const S = [[0, r * 0.4, 0.004], [0.08, r * 0.7, r * 0.5], [0.2, r, r * 0.85], [0.33, r * 1.6, r], [0.46, r, r], [0.6, r * 1.6, r], [0.72, r * 1.05, r * 0.95], [0.82, r * 2.2, r * 0.85], [0.88, r * 3.6, r * 0.75]];
  const blotch = t => { const [x, y, rr] = along(S, t); return `<ellipse class="tex" cx="${f(x)}" cy="${f(-(y + rr * 0.35))}" rx="${f(rr * 0.9)}" ry="${f(rr * 0.4)}" fill="${c.accent}" opacity=".7"/>`; };
  // 몸 5마디: 머리 쪽(t1) ⊃ … ⊃ 꼬리 끝(t5). 마디마다 조금씩 늦게 휘어 물결처럼 움직인다
  const segs = [[0.78, 1], [0.58, 0.82], [0.38, 0.62], [0.18, 0.42], [0, 0.22]];
  const belly = (t0, t1) => `<path class="seam" d="M${[0, 0.25, 0.5, 0.75, 1].map(k => pt(frameAt(S, t0 + (t1 - t0) * k).P(-0.62))).join('L')}"/>`;
  const chain = segs.reduceRight((inner, [t0, t1], i) => `<g class="t${i + 1}">${path(subTube(S, t0, t1), c.fill, '', marks(S, c.pat, ...TAIL_OWN[i]))}${blotch((t0 + t1) / 2)}${belly(...TAIL_OWN[i])}${inner}</g>`, '');
  return `<g class="tail snake">${chain}</g>` + reptileHead(0.88, r * 3.5, 0.12, 0.45, c, { feats: c.feats, teeth: false });
}

// 사람(옆모습, 키 1). 몸길이 대신 키가 1이라 가로는 가운데(x 0.5) 둘레만 쓴다. params: shirt 윗옷, pants 바지, hair 머리카락 색, 피부는 palette[0]
function person(p, c) {
  const skin = c.back, sh = p.shirt ?? '#2a2a2e', pa = p.pants ?? '#2a2a2e', hr = p.hair ?? '#1b1410', x = 0.5, far = k => shade(k, -0.25);
  const leg = (dx, k) => path(tube([[x + dx, 0.52, 0.05], [x + dx + 0.01, 0.31, 0.045]]), k(pa)) + path(tube([[x + dx + 0.01, 0.32, 0.036], [x + dx, 0.05, 0.03]]), k(skin))
    + `<ellipse cx="${f(x + dx + 0.03)}" cy="-0.025" rx="0.055" ry="0.025" fill="${k('#e8e8e8')}"/>`;
  const arm = (dx, k) => path(tube([[x + dx, 0.79, 0.04], [x + dx + 0.04, 0.64, 0.035], [x + dx + 0.09, 0.56, 0.03]]), k(skin)) + `<circle cx="${f(x + dx + 0.1)}" cy="-0.55" r="0.035" fill="${k(skin)}"/>`;
  return leg(-0.02, far) + arm(-0.03, far)
    + path(tube([[x, 0.48, 0.09], [x + 0.005, 0.66, 0.1], [x, 0.8, 0.115]]), sh) // 윗옷
    + path(tube([[x + 0.005, 0.8, 0.035], [x + 0.01, 0.86, 0.035]]), skin) // 목
    + `<circle cx="${f(x + 0.015)}" cy="-0.905" r="0.07" fill="${skin}"/>`
    + `<path d="M${f(x - 0.058)},-0.9A0.072,0.072 0 0 1 ${f(x + 0.085)},-0.925L${f(x + 0.06)},-0.95L${f(x - 0.03)},-0.89Z" fill="${hr}"/>` // 머리카락
    + `<circle cx="${f(x + 0.06)}" cy="-0.91" r="0.009" fill="#1a1410"/>` // 눈
    + leg(0.02, k => k) + arm(0.03, k => k);
}

// 원형 = 그리는 함수 + 기본 비율. 동물 카드의 art.params가 덮어쓴다.
export const ARCHETYPES = {
  theropod: { draw: biped, params: { h: 0.32, bd: 0.085, hl: 0.12, dp: 0.7, arm: 0.05, head: 'thero' } },
  bird: { draw: biped, params: { h: 0.5, bd: 0.16, hl: 0.16, dp: 0.9, arm: 0.06, hipX: 0.3, neck: 1.8, head: 'beakHook', leg: 0.55 } },
  marine_reptile: { draw: swimmer, params: { bd: 0.055, hl: 0.13, dp: 0.6 } },
  fish: { draw: swimmer, params: { bd: 0.075, hl: 0.16, dp: 0.9, head: 'shark', flukeUp: 1 } },
  sauropod: { draw: quad, params: { hip: 0.17, sh: 0.22, bd: 0.075, b0: 0.36, b1: 0.6, neck: [0.9, 0.52], nr: 0.022, hl: 0.07, dp: 0.8, tail: [0, 0.14], tr: 0.05, legR: 0.018, head: 'sauro' } },
  ceratopsian: { draw: quad, params: { hip: 0.2, sh: 0.17, bd: 0.105, b0: 0.28, b1: 0.66, neck: [0.76, 0.2], nr: 0.05, hl: 0.3, dp: 0.75, tail: [0, 0.16], tr: 0.05, legR: 0.033, head: 'cerato' } },
  armored: { draw: quad, params: { hip: 0.15, sh: 0.13, bd: 0.1, b0: 0.32, b1: 0.75, neck: [0.86, 0.13], nr: 0.045, hl: 0.12, dp: 0.7, tail: [0.02, 0.12], tr: 0.04, legR: 0.03, head: 'small' } },
  large_mammal: { draw: quad, params: { hip: 0.37, sh: 0.4, bd: 0.12, b0: 0.12, b1: 0.68, neck: [0.84, 0.54], nr: 0.07, hl: 0.19, dp: 0.85, tail: [0.02, 0.42], tr: 0.035, legR: 0.03, head: 'mammal' } },
  sprawler: { draw: quad, params: { hip: 0.07, sh: 0.07, bd: 0.045, b0: 0.38, b1: 0.72, neck: [0.82, 0.075], nr: 0.03, hl: 0.18, dp: 0.45, tail: [0, 0.05], tr: 0.035, legR: 0.014, bend: 1, head: 'croc' } },
  pterosaur: { draw: ptero, params: { h: 0.25, bd: 0.07, neck: [0.6, 0.6], hl: 0.38, dp: 0.35, wing: 0.55 } },
  arthropod: { draw: arthropod, params: { kind: 'trilobite' } },
  snake: { draw: snake, params: { r: 0.04 } },
  human: { draw: person, params: {} },
};

let uid = 0;
// 동물 카드 → 몸길이 1 기준의 <g>. 몸길이 m로 scale 하면 실제 크기.
export function drawAnimal(a) {
  // 아이 그림: 가로를 몸길이 1에 맞춘 사진 한 장
  if (a.drawing) return `<g class="animal drawing" data-id="${a.id}"><image href="${a.drawing.url}" x="0" y="${-a.drawing.aspect}" width="1" height="${a.drawing.aspect}" preserveAspectRatio="none"/></g>`;
  const arch = ARCHETYPES[a.archetype] ?? ARCHETYPES.large_mammal;
  const [back, belly, accent] = a.art.palette, id = `cs${++uid}`;
  const kind = SKIN[a.archetype] ?? 'scale';
  const stops = `<stop offset="0" stop-color="${shade(back, -0.22)}"/><stop offset="0.38" stop-color="${back}"/><stop offset="0.52" stop-color="${back}"/><stop offset="0.74" stop-color="${belly}"/><stop offset="1" stop-color="${shade(belly, -0.2)}"/>`;
  const gl = kind === 'shell' ? 1.5 : 1;
  // 원통 음영: 윗면 하이라이트 → 중간 → 아랫면 깊은 그늘 → 맨 아래 땅에서 튀는 반사광
  const light = `<stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset=".13" stop-color="#fff" stop-opacity="${0.42 * gl}"/><stop offset=".3" stop-color="#fff" stop-opacity="${0.1 * gl}"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity=".32"/><stop offset=".93" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/>`;
  const c = { back, stops, light, fill: `url(#${id})`, far: shade(back, -0.3), accent: accent ?? shade(back, -0.2), dots: shade(back, -0.28), feats: a.art.features ?? [] };
  c.cast = `filter="url(#d${id})"`;
  const ap = a.art.params ?? {};
  c.fin = ap.paddle;
  c.bird = a.archetype === 'bird';
  // 부위별 색(판다 검은 다리·눈 무늬·귀·어깨 띠 같은 것): limb 다리·팔, face 눈 주변, ear 귀, shoulder 어깨 띠를 다리 색으로
  const hex = v => (/^#[0-9a-f]{6}$/i.test(v ?? '') ? v : null);
  [c.limb, c.face, c.ear] = [hex(ap.limb), hex(ap.face), hex(ap.ear)];
  c.limbFar = c.limb && shade(c.limb, -0.3);
  c.pat = ap.pattern && { kind: ap.pattern, color: ap.mark ?? shade(back, -0.4), op: ap.markOp };
  CUR = { skin: new Set([c.fill, c.accent, c.limb]), lit: new Set([c.fill, c.far, c.accent, c.limb, c.limbFar, HORN, TOOTH, BEAK]), vol: `url(#v${id})`, volMap: new Map([[c.fill, `url(#s${id})`]]), tex: kind === 'shell' ? null : `url(#t${id})`,
    lite: new Set([c.far]), liteTex: kind === 'shell' ? null : `url(#l${id})` };
  const body = arch.draw({ ...arch.params, ...a.art.params }, c);
  CUR = null;
  return `<g class="animal" data-id="${a.id}">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`
    // 빛: 위에서 비추는 원통 음영(윗면 하이라이트 띠 → 아래로 갈수록 그늘)
    + `<linearGradient id="v${id}" x1="0" y1="0" x2="0" y2="1">${light}</linearGradient>`
    // 몸통·머리처럼 한 덩어리인 부위: 공 모양 음영(왼쪽 위 하이라이트 → 오른쪽 아래 그늘)
    + `<radialGradient id="s${id}" cx=".4" cy=".3" r=".78" fx=".33" fy=".2"><stop offset="0" stop-color="#fff" stop-opacity="${0.5 * gl}"/><stop offset=".22" stop-color="#fff" stop-opacity="${0.14 * gl}"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`
    // 앞다리·목이 몸통 위에 드리우는 부드러운 그림자
    + `<filter id="d${id}" x="-0.3" y="-0.3" width="1.6" height="1.6" primitiveUnits="userSpaceOnUse"><feDropShadow dx="-0.004" dy="0.007" stdDeviation="0.007" flood-color="#000" flood-opacity=".45"/></filter>`
    // 발밑에 번지는 바닥 그림자
    + `<radialGradient id="g${id}"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".6" stop-color="#000" stop-opacity=".2"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`
    + texture(`t${id}`, kind, back) + liteTexture(`l${id}`, kind, back) + `</defs>`
    + `<ellipse class="gshadow" cx=".5" cy="0" rx=".5" ry=".035" fill="url(#g${id})"/>` + body + `</g>`;
}

// 원형별 피부 질감
const SKIN = { theropod: 'scale', sauropod: 'scale', ceratopsian: 'scale', armored: 'scale', sprawler: 'scale', snake: 'scale', marine_reptile: 'fine', fish: 'fine', large_mammal: 'fur', pterosaur: 'fur', bird: 'feather', arthropod: 'shell' };
// 질감 무늬(몸길이 1 좌표에서 반복). 한 칸(4×4 비늘·털결)마다 크고 작은 얼룩 반점을 섞어 자연스러운 피부처럼
// 비늘: 빛 받은 둥근 비늘, 털: 짧은 결, 깃털: 겹친 반달, fine: 작은 비늘
// 움직이는 마디(꼬리·목·다리)용 가벼운 질감: 그라디언트 없는 작은 무늬 몇 개(관절이 움직일 때마다 다시 그려도 가볍게)
function liteTexture(id, kind, back) {
  const dk = shade(back, -0.5), lt = shade(back, 0.4);
  if (kind === 'fur') {
    const u = 0.012;
    return `<pattern id="${id}" width="${f(u)}" height="${f(u)}" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)"><path d="M${f(u * 0.2)},${f(u * 0.15)}l${f(u * 0.1)},${f(u * 0.7)}M${f(u * 0.65)},${f(u * 0.1)}l${f(u * 0.1)},${f(u * 0.7)}" stroke="${dk}" stroke-width="${f(u * 0.12)}" opacity=".5"/></pattern>`;
  }
  if (kind === 'feather') {
    const w = 0.02, h = w * 0.7;
    return `<pattern id="${id}" width="${f(w)}" height="${f(h)}" patternUnits="userSpaceOnUse"><path d="M0,${f(h * 0.6)}a${f(w / 2)},${f(h * 0.7)} 0 0 0 ${f(w)},0" stroke="${dk}" stroke-width="${f(w * 0.07)}" fill="none" opacity=".55"/></pattern>`;
  }
  const w = kind === 'fine' ? 0.008 : 0.014, h = w * 0.8;
  return `<pattern id="${id}" width="${f(w)}" height="${f(h)}" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)"><ellipse cx="${f(w / 2)}" cy="${f(h / 2)}" rx="${f(w * 0.42)}" ry="${f(h * 0.38)}" fill="${dk}" opacity=".32"/><ellipse cx="${f(w * 0.42)}" cy="${f(h * 0.38)}" rx="${f(w * 0.2)}" ry="${f(h * 0.16)}" fill="${lt}" opacity=".35"/></pattern>`;
}
// 몸통·머리용 질감. 화면 어디가 움직여도 SVG 전체가 다시 그려지므로, 무늬 안에는 그라디언트 없이 단색 도형만 쓴다
function texture(id, kind, back) {
  const dk = shade(back, -0.5), lt = shade(back, 0.45), N = 4;
  const blotch = (w, h) => `<ellipse cx="${f(w * 0.3)}" cy="${f(h * 0.35)}" rx="${f(w * 0.18)}" ry="${f(h * 0.12)}" fill="${dk}" opacity=".22"/><ellipse cx="${f(w * 0.75)}" cy="${f(h * 0.78)}" rx="${f(w * 0.12)}" ry="${f(h * 0.09)}" fill="${dk}" opacity=".18"/><ellipse cx="${f(w * 0.62)}" cy="${f(h * 0.2)}" rx="${f(w * 0.1)}" ry="${f(h * 0.07)}" fill="${lt}" opacity=".15"/>`;
  if (kind === 'fur') {
    const u = 0.011, W = u * N;
    let s = '';
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = i * u + (j % 2) * u * 0.5, y = j * u;
      s += `<path d="M${f(x + u * 0.1)},${f(y + u * 0.2)}q${f(u * 0.25)},${f(u * 0.3)} ${f(u * 0.2)},${f(u * 0.8)}M${f(x + u * 0.6)},${f(y + u * 0.05)}q${f(u * 0.2)},${f(u * 0.3)} ${f(u * 0.15)},${f(u * 0.75)}" stroke="${dk}" stroke-width="${f(u * 0.1)}" fill="none" opacity=".6"/>`
        + `<path d="M${f(x + u * 0.35)},${f(y + u * 0.1)}q${f(u * 0.2)},${f(u * 0.3)} ${f(u * 0.15)},${f(u * 0.7)}" stroke="${lt}" stroke-width="${f(u * 0.08)}" fill="none" opacity=".45"/>`;
    }
    return `<pattern id="${id}" width="${f(W)}" height="${f(W)}" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">${blotch(W, W)}${s}</pattern>`;
  }
  if (kind === 'feather') {
    const w = 0.02, h = w * 0.7, W = w * 3, H = h * 3;
    const arc = (x, y) => `<path d="M${f(x)},${f(y)}a${f(w / 2)},${f(h * 0.8)} 0 0 0 ${f(w)},0" stroke="${dk}" stroke-width="${f(w * 0.07)}" fill="${lt}" fill-opacity=".18" opacity=".7"/>`;
    let s = '';
    for (let j = 0; j <= 3; j++) for (let i = -1; i <= 3; i++) s += arc(i * w + (j % 2) * w * 0.5, j * h + h * 0.5);
    return `<pattern id="${id}" width="${f(W)}" height="${f(H)}" patternUnits="userSpaceOnUse">${blotch(W, H)}${s}</pattern>`;
  }
  const w = kind === 'fine' ? 0.008 : 0.014, h = w * 0.8, W = w * N, H = h * N;
  let sc = '';
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = i * w + (j % 2) * w * 0.5, y = j * h + h * 0.25, k = ((i * 7 + j * 3) % 5) / 10; // 비늘 크기를 조금씩 다르게
    const rx = w * (0.4 + k * 0.15), ry = h * (0.36 + k * 0.12);
    // 비늘 하나 = 어두운 테두리 + 빛 받은 윗부분(단색 두 겹)
    sc += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${dk}" opacity=".38"/><ellipse cx="${f(x - rx * 0.18)}" cy="${f(y - ry * 0.22)}" rx="${f(rx * 0.55)}" ry="${f(ry * 0.45)}" fill="${lt}" opacity=".42"/>`;
  }
  return `<pattern id="${id}" width="${f(W)}" height="${f(H)}" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)">${blotch(W, H)}${sc}</pattern>`;
}

// 비교용 사람 실루엣(키 h m), 미터 좌표 그대로
export function drawHuman(h, label) {
  const r = h * 0.065;
  const limb = (x0, y0, x1, y1, w) => path(tube([[x0, y0, w], [x1, y1, w * 0.8]]), '#8a93a6');
  return `<g class="human">${limb(-0.05 * h, h * 0.5, -0.06 * h, 0.03, h * 0.045)}${limb(0.05 * h, h * 0.5, 0.06 * h, 0.03, h * 0.045)}`
    + path(tube([[0, h * 0.8, h * 0.1], [0, h * 0.52, h * 0.09]]), '#8a93a6')
    + limb(-0.11 * h, h * 0.8, -0.14 * h, h * 0.5, h * 0.03) + limb(0.11 * h, h * 0.8, 0.14 * h, h * 0.5, h * 0.03)
    + `<circle cx="0" cy="${f(-(h - r))}" r="${f(r)}" fill="#8a93a6"/>`
    + `<text x="0" y="${f(-h - r)}" font-size="${f(h * 0.13)}" text-anchor="middle" fill="#cfd5e2">${label}</text></g>`;
}
