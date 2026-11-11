// 토너먼트 화면: 마릿수 고르기 → (동물 고르기는 main의 pick) → 대진표 ↔ 경기 → 우승
import { drawAnimal } from '../art/index.js';
import { nextMatch, champion, beaten, roundName } from '../engine/bracket.js';
import { ga, eul } from '../engine/story.js';
import { fitSvg } from './scene.js';
import { sfx } from './sfx.js';

export const SIZES = [4, 8, 16];
const mini = a => `<g transform="scale(${a.length_m.avg})">${drawAnimal(a)}</g>`;
const fill = root => root.querySelectorAll('svg[data-i]').forEach(svg => fitSvg(svg, mini(svg._a)));

export function showSize(root, { choose, back }) {
  root.innerHTML = `<header class="step"><h1>🏆 토너먼트</h1><p>몇 마리가 겨룰까요?</p></header>
    <div class="sizes">${SIZES.map(n => `<button data-n="${n}"><b>${n}</b>마리<small>${'🦖'.repeat(n / 4)}</small></button>`).join('')}</div>
    <nav><button class="back">← 처음으로</button></nav>`;
  root.querySelectorAll('.sizes button').forEach(b => (b.onclick = () => choose(+b.dataset.n)));
  root.querySelector('.back').onclick = back;
}

// 대진표. 첫 경기 전에는 "누가 우승할까?" — 동물을 누르면 우리 반 예상(⭐)
export function showBracket(root, rounds, guess, { setGuess, next, home }) {
  const m = nextMatch(rounds), fresh = !rounds[1].some(Boolean);
  const slot = (a, r) => {
    if (!a) return '<div class="slot empty">?</div>';
    const i = rounds[r].indexOf(a), w = rounds[r + 1]?.[i >> 1]; // 이 경기 승자가 정해졌고 내가 아니면 탈락(흐리게)
    return `<div class="slot${w && w !== a ? ' out' : ''}${a === guess ? ' guess' : ''}" data-r="${r}" data-i="${i}"><svg data-i></svg><b>${a.name_ko}</b></div>`;
  };
  const col = (row, r) => r === rounds.length - 1
    ? `<div class="col final"><h3>🏆 우승</h3><div class="ms"><div class="m">${slot(row[0], r)}</div></div></div>`
    : `<div class="col"><h3>${roundName(rounds, r)}</h3><div class="ms">${row.filter((_, i) => i % 2 === 0).map((_, i) =>
      `<div class="m${m && m.r === r && m.i === i ? ' now' : ''}">${slot(row[2 * i], r)}${slot(row[2 * i + 1], r)}</div>`).join('')}</div></div>`;
  root.innerHTML = `<header class="step"><h1>${fresh ? '누가 우승할까?' : '🏆 대진표'}</h1>
      <p>${fresh ? '손을 가장 많이 든 동물을 눌러요 ⭐' : guess ? `우리 반 예상: ⭐ ${guess.name_ko}` : ''}</p></header>
    <div class="bracket n${rounds[0].length}">${rounds.map(col).join('')}</div>
    <nav><button class="home">🏠 그만하기</button><button class="next">⚔️ ${roundName(rounds, m.r)} 시작!</button></nav>`;
  root.querySelectorAll('.slot[data-r]').forEach(el => {
    el.querySelector('svg')._a = rounds[el.dataset.r][el.dataset.i];
    if (fresh) el.onclick = () => setGuess(el.querySelector('svg')._a);
  });
  fill(root);
  root.querySelector('.next').onclick = next;
  root.querySelector('.home').onclick = home;
}

// 한 경기 끝: 이긴 동물 + 이유 한 줄 → 대진표로
export function showMatchEnd(root, W, line, icon, { next }) {
  root.innerHTML = `<header class="step"><h1>${ga(W.name_ko)} 이겼어요!</h1></header>
    <div class="matchend"><svg class="scene"></svg><ul class="reasons top"><li><span>${icon}</span>${line}</li></ul></div>
    <nav><button class="next">🏆 대진표 보기 →</button></nav>`;
  fitSvg(root.querySelector('svg'), mini(W));
  root.querySelector('.next').onclick = next;
}

export function showChampion(root, rounds, guess, { again, other }) {
  const W = champion(rounds);
  const trail = beaten(rounds, W).map(x => `${eul(x.name_ko)} 이기고`).concat('우승!');
  root.innerHTML = `<div class="champ"><div class="podium"><span class="ribbon">🏆 우승!</span><svg class="scene"></svg><b>${W.name_ko}</b></div>
    <ol class="trail">${trail.map(t => `<li>${t}</li>`).join('')}</ol>
    ${guess ? `<div class="predict"><strong>${guess === W ? '🎉 우리 반 예상이 맞았어요!' : `😮 우리 반은 ${ga(guess.name_ko)} 우승할 줄 알았어요!`}</strong></div>` : ''}
    <div class="buttons"><button class="again">🔁 같은 동물로 다시</button><button class="other">🏆 새 토너먼트</button></div></div>`;
  fitSvg(root.querySelector('svg'), mini(W));
  sfx.fanfare();
  root.querySelector('.again').onclick = again;
  root.querySelector('.other').onclick = other;
}
