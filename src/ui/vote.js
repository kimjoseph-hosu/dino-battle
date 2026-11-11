// 예측 투표 화면 (PLAN 3·4): 특성 비교 막대 + "누가 이길 것 같아?" 손든 수 입력(건너뛰기 가능)
import { drawAnimal } from '../art/index.js';
import { STAGES } from '../config.js';
import { massScore, parts, mode, hitChance } from '../engine/battle.js';
import { stageNote } from '../engine/story.js';
import { fitSvg } from './scene.js';

// 몸길이도 로그 스케일 0~10 (1cm ~ 40m)
const lengthScore = m => Math.min(10, Math.max(0, ((Math.log10(m) + 2) / 3.6) * 10));
const STATS = [
  ['📏', '크기', a => lengthScore(a.length_m.avg)], ['⚖️', '무게', a => massScore(a.mass_kg.avg)],
  ['🦷', '무기', a => a.stats.attack], ['🛡️', '방어', a => a.stats.defense],
  ['💨', '속도', a => a.stats.speed], ['🌀', '민첩', a => a.stats.agility],
];

export function showVote(root, A, B, stage, { fight, back }) {
  const votes = [0, 0];
  const hint = a => {
    const n = stageNote(a, stage, parts(a, stage).stage);
    const m = { fly: '<p class="hint good">🪽 날아다니며 싸워요</p>', swim: '<p class="hint good">🌊 헤엄치며 싸워요</p>' }[mode(a, stage)] ?? '';
    return m + (n ? `<p class="hint ${n.good ? 'good' : 'bad'}">${STAGES[stage].emoji} ${n.text}</p>` : '');
  };
  const side = (a, i) => `<div class="side p${i + 1}"><svg class="scene"></svg><b>${a.name_ko}</b>
    ${hint(a)}
    <div class="count"><button data-i="${i}" data-d="-1">−</button><output>0</output><button data-i="${i}" data-d="1">+</button></div><small>✋ 손 든 친구</small></div>`;
  root.innerHTML = `<header class="step"><h1>누가 이길 것 같아?</h1><p>${STAGES[stage].emoji} ${STAGES[stage].name}에서 싸워요. 이길 것 같은 동물에 손을 들어 보세요!</p></header>
    <div class="vote">${side(A, 0)}
      <div class="stats">${STATS.map(([icon, name, get]) => {
        const [a, b] = [get(A), get(B)];
        return `<div class="row"><span class="l${a > b ? ' more' : ''}"><i style="width:${a * 10}%"></i></span><em>${icon} ${name}</em><span class="r${b > a ? ' more' : ''}"><i style="width:${b * 10}%"></i></span></div>`;
      }).join('')}
        <div class="row hitrow"><b class="l">${Math.round(hitChance(A, B, stage) * 100)}%</b><em>🎯 맞힐 확률</em><b class="r">${Math.round(hitChance(B, A, stage) * 100)}%</b></div></div>
      ${side(B, 1)}</div>
    <nav><button class="back">← 크기 다시 보기</button><button class="skip">투표 건너뛰기</button><button class="next go">배틀 시작!</button></nav>`;

  root.querySelectorAll('.side svg').forEach((svg, i) => {
    const a = [A, B][i];
    fitSvg(svg, `<g transform="scale(${i ? -a.length_m.avg : a.length_m.avg} ${a.length_m.avg})">${drawAnimal(a)}</g>`);
  });
  root.querySelectorAll('.count button').forEach(btn => (btn.onclick = () => {
    const i = +btn.dataset.i;
    votes[i] = Math.max(0, votes[i] + +btn.dataset.d);
    root.querySelectorAll('.count output')[i].textContent = votes[i];
  }));
  root.querySelector('.next').onclick = () => fight(votes[0] + votes[1] ? [...votes] : null);
  root.querySelector('.skip').onclick = () => fight(null);
  root.querySelector('.back').onclick = back;
}
