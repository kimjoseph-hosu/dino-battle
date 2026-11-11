// 무대 룰렛(토너먼트): 네 무대 원판이 돌다가 천천히 멈춘다. 칸을 지날 때마다 딸깍. 멈춘 무대 key를 돌려준다
import { STAGES } from '../config.js';
import { drawAnimal } from '../art/index.js';
import { fitSvg } from './scene.js';
import { sfx } from './sfx.js';

const COLOR = { grassland: '#7fb045', jungle: '#2f7a3a', waterside: '#3f9c98', underwater: '#2b5fa8' };
const SPIN_MS = 3800, HOLD_MS = 1500;
const pt = deg => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)]; // 위에서 시계 방향

export function spinStage(root, A, B, title) {
  const keys = Object.keys(STAGES), n = keys.length, step = 360 / n;
  const sectors = keys.map((k, i) => {
    const [[x0, y0], [x1, y1]] = [pt(i * step - step / 2), pt(i * step + step / 2)], [tx, ty] = pt(i * step).map(v => v * 0.62);
    return `<path d="M0 0L${x0} ${y0}A1 1 0 0 1 ${x1} ${y1}Z" fill="${COLOR[k]}" stroke="#fff6" stroke-width=".02"/>
      <text x="${tx}" y="${ty}" font-size=".3" text-anchor="middle" dominant-baseline="central" transform="rotate(${i * step} ${tx} ${ty})">${STAGES[k].emoji}</text>`;
  }).join('');
  root.innerHTML = `<header class="step"><h1>${title}</h1><p>${A.name_ko} 대 ${B.name_ko} — 어디서 싸울까?</p></header>
    <svg class="scene pair"></svg>
    <div class="wheel"><b class="pointer">▼</b><svg viewBox="-1.05 -1.05 2.1 2.1"><g>${sectors}</g><circle r=".12" fill="#fff3c0"/></svg></div>
    <p class="spun"></p>`;
  // 두 동물을 같은 눈금으로(B는 왼쪽을 보게 뒤집음)
  const [la, lb] = [A.length_m.avg, B.length_m.avg], gap = 0.3 * Math.max(la, lb);
  fitSvg(root.querySelector('.pair'), `<g transform="scale(${la})">${drawAnimal(A)}</g><g transform="translate(${la + gap + lb} 0) scale(${-lb} ${lb})">${drawAnimal(B)}</g>`);

  const k = Math.floor(Math.random() * n), end = 360 * 6 - k * step + (Math.random() - 0.5) * step * 0.7;
  const g = root.querySelector('.wheel g');
  return new Promise(done => {
    const t0 = performance.now();
    let last = 0;
    const frame = now => {
      const t = Math.min(1, (now - t0) / SPIN_MS), deg = end * (1 - (1 - t) ** 3);
      g.setAttribute('transform', `rotate(${deg})`);
      const slot = Math.floor((deg + step / 2) / step);
      if (slot !== last) { last = slot; sfx.click(); }
      if (t < 1) return requestAnimationFrame(frame);
      const s = STAGES[keys[k]];
      root.querySelector('.spun').textContent = `${s.emoji} ${s.name}에서 싸워요!`;
      sfx.fanfare();
      setTimeout(() => done(keys[k]), HOLD_MS);
    };
    requestAnimationFrame(frame);
  });
}
