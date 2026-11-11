// 무대 그림 4종. 좌표는 배틀 화면과 같은 미터, 땅(지평선)은 y=0, 보이는 범위 x: -W/2~W/2, y: -0.8H~0.2H.
// back: 카메라와 조금만 움직이는 먼 풍경, ground: 동물과 함께 확대되는 땅, front: 화면 가장자리를 꾸미는 앞 풍경(고정)
// 하늘색은 CSS .sky-<무대> 가 칠한다.

const f = n => +n.toPrecision(4); // 유효숫자 4자리: 화면이 몇 cm인 작은 동물 판에서도 배경이 뭉개지지 않게
const rng = seed => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

// 능선: x0~x1 구간을 높이 0~max 로 출렁이게
function ridge(x0, x1, base, max, n, rnd, smoothness = 0.5) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, base - max * (0.35 + rnd() * 0.65)]);
  let d = `M${f(x0)},${f(base + Math.abs(max) * 3)}L${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i];
    d += smoothness ? `Q${f(px + (x - px) * smoothness)},${f(py)} ${f((px + x) / 2)},${f((py + y) / 2)}T${f(x)},${f(y)}` : `L${f(x)},${f(y)}`;
  }
  return d + `L${f(x1)},${f(base + Math.abs(max) * 3)}Z`;
}

const conifer = (x, h, fill) => {
  const w = h * 0.32;
  let s = `<rect x="${f(x - w * 0.08)}" y="${f(-h * 0.2)}" width="${f(w * 0.16)}" height="${f(h * 0.2)}" fill="#4a3b2a"/>`;
  for (let i = 0; i < 3; i++) {
    const top = -h * (1 - i * 0.22), bot = -h * (0.15 + (2 - i) * 0.22) + h * 0.12, ww = w * (0.55 + i * 0.25);
    s += `<path d="M${f(x)},${f(top)}L${f(x + ww)},${f(bot)}L${f(x - ww)},${f(bot)}Z" fill="${fill}"/>`;
  }
  return s;
};
const treeFern = (x, h, fill, trunk = '#4a3b2a') => {
  let s = `<path d="M${f(x - h * 0.03)},0L${f(x - h * 0.015)},${f(-h * 0.85)}L${f(x + h * 0.015)},${f(-h * 0.85)}L${f(x + h * 0.03)},0Z" fill="${trunk}"/>`;
  for (const a of [-70, -35, 0, 35, 70, -100, 100]) {
    const r = (a * Math.PI) / 180, ex = x + Math.sin(r) * h * 0.4, ey = -h * 0.85 - Math.cos(r) * h * 0.22 + Math.abs(a) * h * 0.0025;
    s += `<path d="M${f(x)},${f(-h * 0.86)}Q${f((x + ex) / 2)},${f(-h * 1.02)} ${f(ex)},${f(ey)}" stroke="${fill}" stroke-width="${f(h * 0.07)}" fill="none" stroke-linecap="round"/>`;
  }
  return s;
};
const tuft = (x, y, s, fill) => {
  let d = '';
  for (const [dx, hh, lean] of [[-0.3, 0.7, -0.35], [-0.1, 1, -0.1], [0.1, 0.85, 0.2], [0.3, 0.6, 0.4]])
    d += `M${f(x + dx * s - s * 0.07)},${f(y)}Q${f(x + dx * s)},${f(y - hh * s * 0.6)} ${f(x + dx * s + lean * s)},${f(y - hh * s)}Q${f(x + dx * s + s * 0.02)},${f(y - hh * s * 0.5)} ${f(x + dx * s + s * 0.07)},${f(y)}Z`;
  return `<path d="${d}" fill="${fill}"/>`;
};
const cloud = (x, y, s) => `<g class="cloud">${[[0, 0, 1], [0.8, 0.15, 0.75], [-0.8, 0.2, 0.7], [0.3, -0.35, 0.7], [-0.35, -0.25, 0.6]]
  .map(([dx, dy, r]) => `<ellipse cx="${f(x + dx * s)}" cy="${f(y + dy * s)}" rx="${f(r * s)}" ry="${f(r * s * 0.62)}"/>`).join('')}</g>`;
// 잎 한 장: (x,y)에서 각도 a(도)로 길이 l
const leaf = (x, y, l, a, fill) => {
  const w = l * 0.32;
  return `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" d="M0,0Q${f(l * 0.4)},${f(-w)} ${f(l)},0Q${f(l * 0.4)},${f(w)} 0,0Z" fill="${fill}"/>`
    + `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" d="M0,0L${f(l * 0.9)},0" stroke="#0003" stroke-width="${f(l * 0.03)}"/>`;
};
const blob = (x, y, r, fill, rnd, n = 6) => [...Array(n)].map(() =>
  `<ellipse cx="${f(x + (rnd() - 0.5) * r * 1.6)}" cy="${f(y + (rnd() - 0.5) * r * 0.8)}" rx="${f(r * (0.5 + rnd() * 0.4))}" ry="${f(r * (0.4 + rnd() * 0.3))}" fill="${fill}"/>`).join('');
// 다시마·물풀: 아래(x,0)에서 위로 출렁이며 자람 (CSS .sway 로 흔들림)
const kelp = (x, h, w, fill, y = 0) => {
  let d = `M${f(x)},${f(y)}`;
  for (let i = 1; i <= 6; i++) d += `Q${f(x + (i % 2 ? w * 2 : -w * 2))},${f(y - (h * (i - 0.5)) / 6)} ${f(x)},${f(y - (h * i) / 6)}`;
  return `<path class="sway" style="animation-delay:-${f((x * 7) % 4)}s" d="${d}" stroke="${fill}" stroke-width="${f(w)}" fill="none" stroke-linecap="round"/>`;
};
const reed = (x, h, fill) => `<path d="M${f(x)},0Q${f(x + h * 0.05)},${f(-h * 0.5)} ${f(x + h * 0.08)},${f(-h)}" stroke="${fill}" stroke-width="${f(h * 0.025)}" fill="none"/>`
  + `<rect x="${f(x + h * 0.05)}" y="${f(-h * 0.92)}" width="${f(h * 0.05)}" height="${f(h * 0.2)}" rx="${f(h * 0.025)}" fill="#6b4a2a"/>`;
const ground = (X0, X1, H, grad) => `<rect x="${f(X0 * 2)}" y="0" width="${f((X1 - X0) * 2)}" height="${f(H)}" fill="url(#${grad})"/>`;
const grad = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const SUN = `<radialGradient id="sunGlow"><stop offset="0" stop-color="#fff8d8" stop-opacity=".9"/><stop offset="1" stop-color="#fff8d8" stop-opacity="0"/></radialGradient>`;
const sun = (W, H) => `<circle cx="${f(-W * 0.24)}" cy="${f(-H * 0.6)}" r="${f(H * 0.2)}" fill="url(#sunGlow)"/><circle cx="${f(-W * 0.24)}" cy="${f(-H * 0.6)}" r="${f(H * 0.055)}" fill="#fffbe6"/>`;
const clouds = (W, H) => `<g fill="#fff" opacity=".85">${[[-0.42, 0.7, 0.05], [0.05, 0.62, 0.07], [0.38, 0.72, 0.045], [0.7, 0.55, 0.06], [-0.8, 0.5, 0.05]].map(([x, y, s]) => cloud(W * x, -H * y, H * s)).join('')}</g>`;
const haze = (X0, X1, H, color) => `<rect x="${f(X0)}" y="${f(-H * 0.12)}" width="${f(X1 - X0)}" height="${f(H * 0.12)}" fill="url(#haze${color.slice(1)})"/>${grad(`haze${color.slice(1)}`, [[0, color, 0], [1, color, 0.75]])}`;

function grassland(W, H) {
  const r = rng(11), X0 = -W * 1.2, X1 = W * 1.2;
  let back = `<defs>${SUN}</defs>${sun(W, H)}${clouds(W, H)}`;
  back += `<path d="${ridge(X0, X1, 0, H * 0.3, 14, r, 0)}" fill="#a7bccc"/><path d="${ridge(X0, X1, 0, H * 0.18, 18, r, 0)}" fill="#93ac9f"/><path d="${ridge(X0, X1, 0, H * 0.09, 10, r)}" fill="#86a56a"/>`;
  for (let i = 0; i < 26; i++) {
    const x = X0 + (X1 - X0) * r(), h = H * (0.05 + r() * 0.09), fill = r() < 0.5 ? '#56764a' : '#4b6a40';
    back += r() < 0.55 ? conifer(x, h, fill) : treeFern(x, h, fill);
  }
  back += haze(X0, X1, H, '#eef3dc');
  let g = `<defs>${grad('earthG', [[0, '#a3bb6a'], [0.35, '#8aa553'], [1, '#5f7d3a']])}</defs>${ground(X0, X1, H, 'earthG')}`;
  g += `<rect x="${f(X0 * 2)}" y="0" width="${f((X1 - X0) * 2)}" height="${f(H * 0.008)}" fill="#c3d38e" opacity=".7"/>`;
  for (let i = 0; i < 70; i++) {
    const depth = r(), x = X0 + (X1 - X0) * r(), y = H * 0.17 * depth ** 1.5;
    if (r() < 0.2) g += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(H * (0.006 + depth * 0.012))}" ry="${f(H * (0.003 + depth * 0.006))}" fill="#b6ab8b"/>`;
    else g += tuft(x, y, H * (0.012 + depth * 0.03), depth > 0.5 ? '#5a7833' : '#6f8f40');
  }
  return { back, ground: g, front: '' };
}

function jungle(W, H) {
  const r = rng(23), X0 = -W * 1.2, X1 = W * 1.2, top = -H * 0.8;
  let back = '';
  // 빛줄기
  for (let i = 0; i < 5; i++) {
    const x = X0 * 0.5 + r() * W, w = H * (0.04 + r() * 0.06);
    back += `<path d="M${f(x)},${f(top)}L${f(x + w)},${f(top)}L${f(x + w * 3 + H * 0.3)},0L${f(x + H * 0.3)},0Z" fill="#fffbd0" opacity=".12"/>`;
  }
  // 줄기들(멀수록 흐리게)
  for (const [n, color, wMax] of [[16, '#7f9a6c', 0.025], [10, '#5d7350', 0.045]]) {
    for (let i = 0; i < n; i++) {
      const x = X0 + (X1 - X0) * r(), w = H * wMax * (0.6 + r() * 0.6);
      back += `<path d="M${f(x - w * 1.6)},0Q${f(x - w)},${f(-H * 0.05)} ${f(x - w * 0.7)},${f(-H * 0.12)}L${f(x - w * 0.6)},${f(top)}L${f(x + w * 0.6)},${f(top)}L${f(x + w * 0.7)},${f(-H * 0.12)}Q${f(x + w)},${f(-H * 0.05)} ${f(x + w * 1.6)},0Z" fill="${color}"/>`;
    }
  }
  // 덤불과 숲 지붕
  for (let i = 0; i < 22; i++) back += blob(X0 + (X1 - X0) * r(), -H * (0.03 + r() * 0.05), H * (0.06 + r() * 0.05), r() < 0.5 ? '#4f7340' : '#5e8449', r);
  for (let i = 0; i < 26; i++) back += blob(X0 + (X1 - X0) * r(), top + H * r() * 0.12, H * (0.1 + r() * 0.08), r() < 0.5 ? '#2f4f2a' : '#3b5f32', r);
  for (let i = 0; i < 10; i++) back += treeFern(X0 + (X1 - X0) * r(), H * (0.1 + r() * 0.1), '#46693a', '#4a3b2a');
  back += haze(X0, X1, H, '#d6e6b8');
  let g = `<defs>${grad('earthJ', [[0, '#6c7f3c'], [0.4, '#55652e'], [1, '#3a4520']])}</defs>${ground(X0, X1, H, 'earthJ')}`;
  for (let i = 0; i < 60; i++) {
    const depth = r(), x = X0 + (X1 - X0) * r(), y = H * 0.17 * depth ** 1.5, s = H * (0.02 + depth * 0.05);
    g += r() < 0.5 ? tuft(x, y, s, depth > 0.5 ? '#3f5e2a' : '#4f7333') : leaf(x, y, s, -150 + r() * 120, depth > 0.5 ? '#3a5a2a' : '#4c6e34');
  }
  // 앞 풍경: 위에서 늘어진 덩굴, 아래 구석의 큰 잎
  let front = '';
  for (let i = 0; i < 9; i++) {
    const x = -W / 2 + W * r(), len = H * (0.15 + r() * 0.35), sway = H * 0.03 * (r() - 0.5);
    front += `<path d="M${f(x)},${f(top)}Q${f(x + sway * 3)},${f(top + len / 2)} ${f(x + sway)},${f(top + len)}" stroke="#2f4a22" stroke-width="${f(H * 0.006)}" fill="none"/>`;
    for (let k = 1; k < 5; k++) front += leaf(x + sway * (k / 5) * 2, top + (len * k) / 5, H * 0.03, k % 2 ? 30 : 150, '#3d6a2c');
  }
  for (const [cx, dir] of [[-W / 2, 1], [W / 2, -1]])
    for (let k = 0; k < 6; k++) front += leaf(cx, H * 0.2, H * (0.18 + r() * 0.1), dir > 0 ? -80 + k * 14 : -100 - k * 14, k % 2 ? '#2e5524' : '#3a6a2c');
  return { back, ground: g, front };
}

function waterside(W, H) {
  const r = rng(37), X0 = -W * 1.2, X1 = W * 1.2;
  let back = `<defs>${SUN}${grad('lake', [[0, '#8ec5dd'], [1, '#bfe2ec']])}</defs>${sun(W, H)}${clouds(W, H)}`;
  back += `<path d="${ridge(X0, X1, -H * 0.04, H * 0.24, 12, r, 0)}" fill="#a3b9c9"/><path d="${ridge(X0, X1, -H * 0.04, H * 0.1, 10, r)}" fill="#7f9f6c"/>`;
  for (let i = 0; i < 14; i++) back += `<g transform="translate(0 ${f(-H * 0.04)})">${conifer(X0 + (X1 - X0) * r(), H * (0.05 + r() * 0.06), '#4f6e45')}</g>`;
  back += `<rect x="${f(X0)}" y="${f(-H * 0.045)}" width="${f(X1 - X0)}" height="${f(H * 0.05)}" fill="url(#lake)"/>`;
  for (let i = 0; i < 20; i++) back += `<rect x="${f(X0 + (X1 - X0) * r())}" y="${f(-H * (0.005 + r() * 0.035))}" width="${f(H * (0.03 + r() * 0.06))}" height="${f(H * 0.002)}" fill="#fff" opacity=".6"/>`;
  for (let i = 0; i < 30; i++) back += reed(X0 + (X1 - X0) * r(), H * (0.03 + r() * 0.03), '#5d7a3a');
  let g = `<defs>${grad('earthW', [[0, '#c2b07c'], [0.5, '#a08c5a'], [1, '#7d6a40']])}${grad('pool', [[0, '#7cc3e0', 0.85], [1, '#4f9fc7', 0.85]])}</defs>${ground(X0, X1, H, 'earthW')}`;
  // 얕은 물웅덩이(동물 발이 잠기는 곳)
  for (let i = 0; i < 9; i++) {
    const x = X0 + (X1 - X0) * r(), y = H * (0.005 + r() * 0.12), w = H * (0.3 + r() * 0.6), h = H * (0.015 + r() * 0.03);
    g += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w)}" ry="${f(h)}" fill="url(#pool)"/><ellipse cx="${f(x - w * 0.2)}" cy="${f(y - h * 0.3)}" rx="${f(w * 0.4)}" ry="${f(h * 0.15)}" fill="#fff" opacity=".5"/>`;
  }
  for (let i = 0; i < 50; i++) {
    const depth = r(), x = X0 + (X1 - X0) * r(), y = H * 0.17 * depth ** 1.5;
    g += r() < 0.4 ? `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(H * (0.008 + depth * 0.015))}" ry="${f(H * (0.004 + depth * 0.008))}" fill="#8f8a7a"/>` : tuft(x, y, H * (0.015 + depth * 0.03), '#6b8a3a');
  }
  let front = '';
  for (const [cx, dir] of [[-W / 2, 1], [W / 2, -1]])
    for (let k = 0; k < 9; k++) front += `<g transform="translate(0 ${f(H * 0.2)})">${reed(cx + dir * H * k * 0.02, H * (0.18 + r() * 0.14), '#4c6a2c')}</g>`;
  return { back, ground: g, front };
}

function underwater(W, H) {
  const r = rng(51), X0 = -W * 1.2, X1 = W * 1.2, top = -H * 0.8;
  let back = '';
  for (let i = 0; i < 7; i++) {
    const x = X0 * 0.4 + r() * W * 1.2, w = H * (0.03 + r() * 0.05);
    back += `<path d="M${f(x)},${f(top)}L${f(x + w)},${f(top)}L${f(x + w * 2 - H * 0.2)},0L${f(x - H * 0.2)},0Z" fill="#dff6ff" opacity=".1"/>`;
  }
  back += `<path d="${ridge(X0, X1, 0, H * 0.26, 10, r)}" fill="#1f6a86"/><path d="${ridge(X0, X1, 0, H * 0.14, 14, r)}" fill="#1a5872"/>`;
  for (let i = 0; i < 30; i++) back += kelp(X0 + (X1 - X0) * r(), H * (0.1 + r() * 0.25), H * 0.008, r() < 0.5 ? '#2c6e63' : '#235c55');
  // 멀리 물고기 떼
  for (let i = 0; i < 3; i++) {
    const fx = X0 * 0.5 + r() * W, fy = -H * (0.4 + r() * 0.3);
    back += `<g class="fish" style="animation-delay:-${i * 3}s">${[...Array(7)].map(() => {
      const x = fx + (r() - 0.5) * H * 0.15, y = fy + (r() - 0.5) * H * 0.06, s = H * 0.008;
      return `<path d="M${f(x)},${f(y)}q${f(s * 2)},${f(-s)} ${f(s * 3)},0q${f(-s)},${f(s)} ${f(-s * 3)},0Zm${f(-s * 0.2)},0l${f(-s)},${f(-s * 0.6)}v${f(s * 1.2)}Z" fill="#14465c"/>`;
    }).join('')}</g>`;
  }
  let g = `<defs>${grad('sand', [[0, '#d8c58f'], [0.4, '#c2ad74'], [1, '#97834f']])}</defs>${ground(X0, X1, H, 'sand')}`;
  for (let i = 0; i < 40; i++) {
    const depth = r(), x = X0 + (X1 - X0) * r(), y = H * 0.17 * depth ** 1.5, s = H * (0.02 + depth * 0.04), k = r();
    if (k < 0.3) g += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s * 0.7)}" ry="${f(s * 0.35)}" fill="#7f7a6c"/>`;
    else if (k < 0.55) g += [...Array(4)].map((_, j) => `<path d="M${f(x)},${f(y)}Q${f(x + (j - 1.5) * s * 0.3)},${f(y - s * 0.5)} ${f(x + (j - 1.5) * s * 0.5)},${f(y - s * (0.7 + (j % 2) * 0.3))}" stroke="${r() < 0.5 ? '#e0876a' : '#e8a3b8'}" stroke-width="${f(s * 0.12)}" fill="none" stroke-linecap="round"/>`).join('');
    else g += kelp(x, s * 2.5, s * 0.12, '#3d8a5a', y);
  }
  let front = `<rect x="${f(-W / 2)}" y="${f(top)}" width="${f(W)}" height="${f(H)}" fill="#0b4d70" opacity=".14"/>`;
  for (let i = 0; i < 18; i++) {
    const x = -W / 2 + W * r(), y = H * (0.1 + r() * 0.1), rr = H * (0.005 + r() * 0.01);
    front += `<circle class="bubble" style="--rise:${f(-H * (0.6 + r() * 0.4))}px;animation-delay:-${f(r() * 6)}s;animation-duration:${f(4 + r() * 4)}s" cx="${f(x)}" cy="${f(y)}" r="${f(rr)}"/>`;
  }
  for (const [cx, dir] of [[-W / 2, 1], [W / 2, -1]])
    for (let k = 0; k < 5; k++) front += kelp(cx + dir * H * k * 0.035, H * (0.35 + r() * 0.3), H * 0.018, k % 2 ? '#1f5d4a' : '#2a7258', H * 0.2);
  return { back, ground: g, front };
}

// dust: 부딪힐 때 튀는 것의 색, water: 첨벙(효과음·물보라)
export const STAGE_ART = {
  grassland: { build: grassland, dust: '#efe6cc', kick: '#d4c69a' },
  jungle: { build: jungle, dust: '#e2e8c6', kick: '#8a7a4a' },
  waterside: { build: waterside, dust: '#e8f6ff', kick: '#bfe3f5', water: true },
  underwater: { build: underwater, dust: '#e6f7ff', kick: '#d8c58f', water: true, bubbles: true },
};
