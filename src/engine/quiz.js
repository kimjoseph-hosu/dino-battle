// 공룡 탐험대 퀴즈: 문제 만들기(화면은 ui/quiz.js). 무대 다섯 곳을 지나며 문제 하나씩, 마지막은 그림자 보스 → 보스 배틀
// 문제 = { type, stage, prompt(읽어 주는 말), answer(동물 | true/false | null = 배틀로 정함), choices, hints?, part? }
import { bossHints, bossPool, isDino } from './riddle.js';

export const TYPES = ['sound', 'zoom', 'bigger', 'dino', 'winner'];
export const STAGE_ORDER = ['grassland', 'jungle', 'waterside', 'underwater'];
const WATER = ['sea', 'freshwater'];

const mix = (xs, rng) => xs.map(x => [rng(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
// 이 무대에 어울리는 백과 동물: 물속은 물 동물, 나머지는 땅·하늘·물가 동물. 아이 그림은 빼고, 이미 나온 동물(used)도 뺀다
export const fits = (list, stage, used = new Set()) => list.filter(a => !a.drawing && a.book && !used.has(a.id)
  && (stage === 'underwater' ? [...WATER, 'amphibious'].includes(a.habitat) : !WATER.includes(a.habitat)));
// 서로 다른 동물 n마리(이름도 겹치지 않게). differ(a, b): 서로 달라야 할 조건(예: 몸 틀이 달라 울음소리가 다르게)
function distinct(pool, n, rng, differ = (a, b) => a.name_ko !== b.name_ko) {
  const out = [];
  for (const a of mix(pool, rng)) if (out.every(b => differ(a, b))) { out.push(a); if (out.length === n) break; }
  return out;
}

// 눈에 띄는 부위: 꼬리 무기 → tail, 낫 발톱 → foot, 등 장식 → back, 나머지는 머리
export function partOf(a) {
  const F = a.art?.features ?? [];
  if (F.some(f => ['club', 'spiked_club', 'thagomizer'].includes(f))) return 'tail';
  if (F.includes('sickle_claw')) return 'foot';
  if (F.some(f => ['plates', 'sail', 'spikes'].includes(f)) || a.art?.params?.sail) return 'back';
  return 'head';
}

const MAKE = {
  // 울음소리만 듣고 맞히기: 보기 셋은 몸 틀이 달라 소리가 서로 다르다
  sound: (list, stage, rng, used) => {
    const c = distinct(fits(list, stage, used), 3, rng, (a, b) => a.archetype !== b.archetype && a.name_ko !== b.name_ko);
    return { type: 'sound', stage, prompt: '이 울음소리는 누구일까요?', answer: c[0], choices: mix(c, rng) };
  },
  // 몸 한 곳을 아주 가까이 → 힌트마다 멀어진다
  zoom: (list, stage, rng, used) => {
    const c = distinct(fits(list, stage, used), 4, rng);
    return { type: 'zoom', stage, prompt: '아주 가까이서 봤어요. 누구일까요?', answer: c[0], choices: mix(c, rng), part: partOf(c[0]) };
  },
  // 둘 중 누가 더 클까: 몸길이가 1.6~8배 차이(너무 비슷하면 헷갈리고, 너무 차이 나면 한쪽이 점이 된다)
  bigger: (list, stage, rng, used) => {
    const pool = mix(fits(list, stage, used), rng);
    for (const a of pool) for (const b of pool) {
      const k = a.length_m.avg / b.length_m.avg;
      if (k >= 1.6 && k <= 8) return { type: 'bigger', stage, prompt: '누가 더 클까요?', answer: a, choices: mix([a, b], rng) };
    }
    return null;
  },
  // 공룡일까 아닐까: 반은 진짜 공룡, 반은 공룡처럼 보이는 다른 동물(익룡·바다 파충류·악어·포유류…)
  dino: (list, stage, rng, used) => {
    const want = rng() < 0.5, pool = fits(list, stage, used).filter(a => isDino(a) === want);
    const a = mix(pool.length ? pool : fits(list, stage, used), rng)[0];
    return a && { type: 'dino', stage, prompt: `${a.name_ko}, 공룡일까요?`, answer: isDino(a), animal: a, choices: [true, false] };
  },
  // 누가 이길까: 정답은 진짜 배틀로 정한다(answer null). 몸길이 3배 이내로 비슷한 둘(너무 뻔하지 않게)
  winner: (list, stage, rng, used) => {
    const c = distinct(fits(list, stage, used), 2, rng, (a, b) => a.name_ko !== b.name_ko && Math.max(a.length_m.avg / b.length_m.avg, b.length_m.avg / a.length_m.avg) <= 3);
    return c.length === 2 && { type: 'winner', stage, prompt: '누가 이길까요?', answer: null, choices: c };
  },
  // 그림자 보스(마지막): 안개 속 그림자, 힌트마다 안개가 걷힌다. 보기 넷은 사는 곳이 같은 큰 동물 위주
  shadow: (list, stage, rng, used) => {
    const P = bossPool(fits(list, stage, used)), boss = mix(P, rng)[0];
    if (!boss) return null;
    const same = mix(P.filter(a => a !== boss && a.name_ko !== boss.name_ko), rng).slice(0, 3);
    return { type: 'shadow', stage, prompt: '안개 속에서 보스가 나타났어요! 누구일까요?', answer: boss, choices: mix([boss, ...same], rng), hints: bossHints(boss) };
  },
};
export const makeQuestion = (type, list, stage, rng = Math.random, used = new Set()) => MAKE[type](list, stage, rng, used);

// 탐험 한 판: 무대 넷에서 서로 다른 문제 넷 + 마지막 그림자 보스(초원 또는 정글). 한 번 나온 동물은 다시 안 나온다
export function adventure(list, rng = Math.random) {
  const used = new Set(), types = mix(TYPES, rng).slice(0, 4), out = [];
  const add = q => { if (!q) return; out.push(q); [q.answer, q.animal, ...(q.choices ?? [])].forEach(a => a?.id && used.add(a.id)); };
  STAGE_ORDER.forEach((stage, i) => add(makeQuestion(types[i], list, stage, rng, used) ?? makeQuestion('zoom', list, stage, rng, used)));
  add(makeQuestion('shadow', list, rng() < 0.5 ? 'grassland' : 'jungle', rng, used));
  return out;
}
