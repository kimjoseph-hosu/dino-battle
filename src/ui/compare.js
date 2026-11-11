// 크기 비교 화면 (PLAN 3·6): 선생님·어린이와 두 동물을 같은 눈금으로. 큰 개체는 점선, 아주 작으면 돋보기
import { drawAnimal, drawHuman } from '../art/index.js';
import { HUMANS } from '../config.js';
import { weightLike, sizeLike, thingFor, wa } from '../engine/story.js';
import { fitSvg, ruler } from './scene.js';

const place = (a, x, L, cls = '') => `<g class="${cls}" transform="translate(${x} 0) scale(${L})">${drawAnimal(a)}</g>`;

// 우리 주변 물건: 이모지(정사각형 글자)를 물건의 실제 너비 w·높이 h 로 늘려 같은 눈금에 세운다. 8m 이상은 층마다 창문이 있는 건물
const building = (n, w) => `<rect x="0" y="${-n * 3}" width="${w}" height="${n * 3}" fill="#8a93a6"/>`
  + [...Array(n)].map((_, i) => [0, 1, 2].map(k => `<rect x="${0.6 + k * 1.8}" y="${-(i + 1) * 3 + 0.9}" width="1.2" height="1.3" fill="#c8d0e0"/>`).join('')).join('');
const drawThing = t => {
  const fs = Math.max(t.h, HUMANS.teacher_m) * 0.13;
  const body = t.building ? building(t.building, t.w) : `<text transform="translate(${t.w / 2} 0) scale(${t.w} ${t.h})" y="-0.12" font-size="1" text-anchor="middle">${t.emoji}</text>`;
  return `<g class="human">${body}<text x="${t.w / 2}" y="${-t.h - fs * 0.6}" font-size="${fs}" text-anchor="middle" fill="#cfd5e2">${t.name}</text></g>`;
};

export function showCompare(root, A, B, { next, back }) {
  const things = [A, B].map(a => thingFor(a.length_m.avg)); // 동물마다 비슷한 크기의 물건, 동물 바로 앞에 세운다
  const names = [...new Set(things.map(t => t.name))];
  root.innerHTML = `<header class="step"><h1>얼마나 클까?</h1><p>선생님, 어린이, ${names.slice(0, -1).map(n => n + ', ').join('')}${wa(names.at(-1))} 같은 눈금으로 나란히 세워 봤어요</p></header>
    <svg class="scene compare"></svg>
    <div class="facts">${[A, B].map((a, i) => `<div class="fact p${i + 1}"><b>${a.name_ko}</b>
      <span>📏 ${a.size_raw}</span><span>⚖️ ${a.mass_raw}</span><small>${sizeLike(a.length_m.avg)} · ${weightLike(a.mass_kg.avg).replace(/만큼$/, "만큼 무거워요")}</small></div>`).join('')}</div>
    <nav><button class="back">← 다시 고르기</button><button class="next">누가 이길까? →</button></nav>`;

  const maxL = Math.max(A.length_m.max, B.length_m.max), gap = 0.6 + 0.08 * maxL;
  let x = 0, s = drawHuman(HUMANS.teacher_m, '선생님');
  x += HUMANS.teacher_m * 0.45;
  s += `<g transform="translate(${x} 0)">${drawHuman(HUMANS.child_m, '어린이')}</g>`;
  x += HUMANS.child_m * 0.3 + Math.min(gap, things[0].w * 0.5);
  const spots = [A, B].map((a, i) => {
    s += `<g transform="translate(${x} 0)">${drawThing(things[i])}</g>`;
    x += things[i].w + gap * 0.6;
    const at = x, L = a.length_m.avg, Lmax = a.length_m.max;
    if (Lmax > L * 1.05) s += place(a, at, Lmax, 'ghostmax'); // 큰 개체는 이만큼
    s += place(a, at, L, `who w-${a.id}`);
    x += Math.max(L, Lmax) + gap;
    return { a, at, L };
  });
  const svg = root.querySelector('svg');
  fitSvg(svg, ruler(-0.5, x) + s, 0.04);

  // 이름표 + 너무 작아 안 보이는 동물은 돋보기
  const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number), fs = vw / 45;
  let over = '';
  for (const { a, at, L } of spots) {
    const bb = svg.querySelector(`.w-${a.id}`).getBBox(), h = bb.height * L; // bbox는 몸길이 1 좌표
    over += `<text class="label" x="${at + L / 2}" y="${-h - fs * 0.6}" font-size="${fs}">${a.name_ko}</text>`;
    if ((h * svg.clientHeight) / vh < 28) { // 화면에서 28px보다 작으면
      const R = vh * 0.17, cx = at + L / 2, cy = vy + R * 1.25, z = (R * 1.3) / Math.max(L, h * 2), id = `mag-${a.id}`;
      over += `<line class="magline" x1="${cx}" y1="${cy + R}" x2="${cx}" y2="${-h - fs * 1.8}"/>`
        + `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>`
        + `<circle class="maglens" cx="${cx}" cy="${cy}" r="${R}"/>`
        + `<g clip-path="url(#${id})"><g transform="translate(${cx - (L * z) / 2} ${cy + (h * z) / 2}) scale(${L * z})">${drawAnimal(a)}</g></g>`
        + `<circle class="magring" cx="${cx}" cy="${cy}" r="${R}"/><text class="label" x="${cx}" y="${cy - R - fs * 0.4}" font-size="${fs * 0.8}">🔍 크게 보면</text>`;
    }
  }
  svg.firstChild.insertAdjacentHTML('beforeend', over);
  fitSvg(svg, svg.firstChild.innerHTML, 0.03);

  root.querySelector('.next').onclick = next;
  root.querySelector('.back').onclick = back;
}
