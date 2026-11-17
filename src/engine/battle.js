// 승패는 여기서만 정한다. 같은 입력이면 같은 확률 (PLAN 5)
// 한 판 = K.O.가 아니면 무조건 5라운드. 끝나면 힘(HP)이 더 남은 쪽이 이기고, 크게 밀리거나 지친 쪽은 도망치며 끝난다(fled). 라운드마다 두 동물이 한 번씩 공격하고, 공격마다
//   맞을 확률(민첩·감각·날기·헤엄) → 맞으면 힘 차이만큼 데미지. 힘이 0이 되면 K.O.
import { WEIGHTS, BATTLE, STAGES, TIMING, EVENT } from '../config.js';
import { EVENTS } from './events.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sum = o => Object.values(o).reduce((s, v) => s + v, 0);

// 몸무게는 로그 스케일 0~10점
export const massScore = kg => clamp((Math.log10(kg) - BATTLE.MASS_LOG[0]) / (BATTLE.MASS_LOG[1] - BATTLE.MASS_LOG[0]) * 10, 0, 10);

// 항목별 가중 점수 (이유 설명에도 쓴다)
export function parts(a, stage) {
  const p = { mass: WEIGHTS.mass * massScore(a.mass_kg.avg) };
  for (const k in a.stats) p[k] = WEIGHTS[k] * a.stats[k];
  const st = STAGES[stage];
  p.stage = (st.mod[a.habitat] ?? 0)
    - (st.bigPenalty ?? 0) * clamp((Math.log10(a.mass_kg.avg) - 3) / 1.5, 0, 1)
    + (st.agilityBonus ?? 0) * a.stats.agility;
  return p;
}
const score = (a, stage) => sum(parts(a, stage));

// 물에 들어가 헤엄치며 싸우는 사람(선생님)과 물가에서 물고기를 잡던 공룡들
// 물속에서는 헤엄치고, 물가는 얕아서 걷다가 홍수(wx = 'flood')로 물이 불면 헤엄친다(물 동물보다 먼저 본다: 스피노사우루스는 amphibious 지만 물가에서 걷는다)
export const SWIMMERS = ['kim_yoseph', 'spinosaurus', 'baryonyx', 'suchomimus'];
// 이 무대에서 어떻게 움직이나: fly 날기, swim 헤엄, ground 땅(또는 물 밖에 나온 물 동물). wx: 지금 남아 있는 날씨
export function mode(a, stage, wx = null) {
  const water = stage === 'underwater' || stage === 'waterside';
  if (a.habitat === 'air') return stage === 'underwater' ? 'ground' : 'fly';
  if (SWIMMERS.includes(a.id)) return stage === 'underwater' || (stage === 'waterside' && wx === 'flood') ? 'swim' : 'ground';
  if (['sea', 'freshwater', 'amphibious'].includes(a.habitat)) return water ? 'swim' : 'ground';
  return 'ground';
}

// 물에서 사는데 물이 없는 무대에 섰나
const stranded = (a, stage) => ['sea', 'freshwater'].includes(a.habitat) && mode(a, stage) === 'ground';

// 얼마나 빨리 지치나 0~1: 덩치가 클수록(몸이 뜨거워져서) 빨리, 빠르고 날쌜수록 늦게
export const tire = a => clamp(0.6 * massScore(a.mass_kg.avg) / 10 + 0.4 * (1 - (a.stats.speed + a.stats.agility) / 20), 0, 1);

// 공격이 맞을 확률: 공격하는 쪽 민첩·감각 대 피하는 쪽 민첩, 그리고 날기·헤엄 상황. round(0부터)가 지날수록 지쳐서 덜 맞힌다
// wx: 남아 있는 날씨(사건 id). 날씨에 따라 더 맞히거나(hit) 덜 맞는다(guard) — events.js stay
export const stay = (wx, a, stage) => (wx && EVENTS[wx].stay?.(a, stage)) || {};
export function hitChance(att, def, stage, round = 0, wx = null) {
  const B = BATTLE, ma = mode(att, stage, wx), md = mode(def, stage, wx);
  let p = B.HIT_BASE + B.HIT_AGI * ((att.stats.agility + att.stats.senses) / 2 - def.stats.agility) - B.TIRE_HIT * round * tire(att);
  if (md === 'fly' && ma === 'ground') p -= B.HIT_VS_AIR; // 하늘에 있는 상대는 닿기 어렵다
  if (ma === 'fly' && md === 'ground') p += B.HIT_FROM_AIR; // 위에서 내리꽂는다
  if (md === 'swim' && ma === 'ground') p -= B.HIT_VS_WATER; // 물속에서 요리조리
  if (ma === 'swim' && md === 'ground') p += B.HIT_FROM_WATER;
  if (stranded(att, stage)) p -= B.HIT_STRANDED; // 물 밖에 나온 물 동물은 잘 못 움직인다
  if (stranded(def, stage)) p += B.HIT_STRANDED;
  p += (stay(wx, att, stage).hit ?? 0) - (stay(wx, def, stage).guard ?? 0);
  return clamp(p, B.HIT_MIN, B.HIT_MAX);
}

// 한 번 맞혔을 때 데미지: (공격하는 쪽 몸무게 + 공격력) 대 (맞는 쪽 몸무게 + 방어력). 갑옷이 데미지를 줄인다
const punch = (a, stage) => 0.55 * massScore(a.mass_kg.avg) + 0.45 * a.stats.attack + BATTLE.STAGE_POWER * parts(a, stage).stage;
const guard = (a, stage) => 0.55 * massScore(a.mass_kg.avg) + 0.45 * a.stats.defense + BATTLE.STAGE_POWER * parts(a, stage).stage;
export const damage = (att, def, stage, rng) =>
  Math.round(clamp(BATTLE.DMG_BASE * Math.exp(BATTLE.DMG_K * (punch(att, stage) - guard(def, stage))) * (1 - BATTLE.DMG_JITTER + 2 * BATTLE.DMG_JITTER * rng()), BATTLE.DMG_MIN, BATTLE.DMG_MAX));

// 이번 판의 자연 사건: 3라운드 앞에 날씨 하나(무대에 맞는 것 중에서, 늘 일어남), 5라운드 앞에 METEOR 확률로 운석
function eventDeck(stage, rng) {
  const pool = Object.keys(EVENTS).filter(k => k !== 'meteor' && EVENTS[k].stages.includes(stage));
  return { [EVENT.AT]: pool[Math.floor(rng() * pool.length)], [EVENT.METEOR_AT]: rng() < EVENT.METEOR ? 'meteor' : null };
}

// 자연 사건 하나: 두 동물 힘을 바꾼다(최대 100). 둘 다 0이 되면 덜 잃은 쪽이 겨우 버틴다
// 날씨 사건은 3·4·5라운드 내내 영향이 남으니 처음 한 번은 START 만큼만
function applyEvent(id, F, hp, stage, rng) {
  const k = id === 'meteor' ? 1 : EVENT.START;
  const d = F.map(a => Math.round(k * EVENTS[id].hit(a, stage)[0] * (1 - EVENT.JITTER + 2 * EVENT.JITTER * rng())));
  const before = [...hp];
  F.forEach((_, i) => (hp[i] = Math.min(100, Math.max(0, hp[i] + d[i]))));
  if (hp.every(h => h === 0)) hp[d[0] >= d[1] ? 0 : 1] = 1;
  return { id, d: hp.map((h, i) => h - before[i]), why: F.map(a => EVENTS[id].hit(a, stage)[1]), say: (stage === 'underwater' && EVENTS[id].sayUnder) || EVENTS[id].say };
}

// → { rounds: [{ winner, attacks: [{ by, hit, dmg, ko }], hp }], winner, ko, fled(진 쪽이 물러남), hp, reasons, P, upset }
// opts.events: 라운드 사이 자연 사건을 넣는다. 그 라운드에 event = { id, d: [A 힘 변화, B 힘 변화] }(공격 전에 일어남).
// 사건으로 힘이 다 빠지면 byEvent = 사건 id (K.O.가 아니라 깜짝 놀라 피한 것)
export function battle(a, b, stage, rng = Math.random, withP = true, opts = {}) {
  const F = [a, b], hp = [100, 100], wins = [0, 0], rounds = [], dodged = [0, 0], B = BATTLE, evGain = [0, 0];
  const strong = 1 / (1 + Math.exp(-BATTLE.K * (score(a, stage) - score(b, stage))));
  const deck = opts.events ? eventDeck(stage, rng) : {}, wxHelp = [0, 0];
  let byEvent = null, wx = null;
  while (rounds.length < TIMING.ROUNDS && hp.every(h => h > 0)) {
    // 날씨가 남아 있으면 라운드 시작마다 힘이 조금 빠지는 동물이 있다(이것만으로는 쓰러지지 않는다)
    const tick = wx && F.map((a, i) => { const before = hp[i]; hp[i] = clamp(hp[i] + (stay(wx, a, stage).drain ?? 0), Math.min(hp[i], 1), 100); return hp[i] - before; });
    if (tick) tick.forEach((d, i) => (evGain[i] += d));
    const id = deck[rounds.length], event = id ? applyEvent(id, F, hp, stage, rng) : null;
    if (id && id !== 'meteor') wx = id;
    if (event) event.d.forEach((d, i) => (evGain[i] += d));
    if (event && hp.some(h => h === 0)) {
      byEvent = event.id;
      const w = hp[0] === 0 ? 1 : 0;
      wins[w]++;
      rounds.push({ winner: w, attacks: [], hp: [...hp], event, wx });
      break;
    }
    // 빠른 쪽이 먼저 공격(속도 차이만큼 유리한 주사위)
    const sp = F.map(x => x.stats.speed + (stay(wx, x, stage).fast ?? 0));
    const first = rng() < 0.5 + 0.06 * (sp[0] - sp[1]) ? 0 : 1;
    const attacks = [], dealt = [0, 0];
    for (const i of [first, 1 - first]) {
      if (hp.some(h => h <= 0)) break;
      // 날씨가 결과를 바꿨으면(날씨가 없었다면 반대였으면) wx 표시 → 화면에 말풍선
      const j = 1 - i, u = rng(), hit = u < hitChance(F[i], F[j], stage, rounds.length, wx), dmg = hit ? Math.min(BATTLE.DMG_MAX, Math.round(damage(F[i], F[j], stage, rng) * (stay(wx, F[i], stage).power ?? 1))) : 0;
      const turned = wx && hit !== u < hitChance(F[i], F[j], stage, rounds.length);
      if (turned) wxHelp[hit ? i : j]++;
      hp[j] = Math.max(0, hp[j] - dmg);
      dealt[i] += dmg;
      if (!hit) dodged[j]++;
      attacks.push({ by: i, hit, dmg, ko: hp[j] === 0, ...(turned && { wx }) });
    }
    // 이번 라운드는 더 많이 때린 쪽이 이긴다(라운드 승리 표시, 힘이 같을 때 승부). 같으면(둘 다 빗나감 등) 힘센 쪽이 유리한 주사위
    const w = dealt[0] === dealt[1] ? (rng() < strong ? 0 : 1) : dealt[0] > dealt[1] ? 0 : 1;
    wins[w]++;
    rounds.push({ winner: w, attacks, hp: [...hp], ...(event && { event }), ...(wx && { wx }), ...(tick?.some(d => d) && { tick }) });
  }
  const out = hp.some(h => h === 0), ko = out && !byEvent;
  // 끝까지 싸운 뒤 힘이 적은 쪽이 크게 밀렸거나 지쳤으면 도망치며 끝난다(승패는 그대로 힘으로)
  const lo = hp[0] < hp[1] ? 0 : 1, gap = hp[1 - lo] - hp[lo], r = rounds.length - 1;
  const fled = !out && gap > 0 && rng() < B.FLEE_K * Math.max(0, gap - B.FLEE_MIN) / 100 + (hp[lo] < 30 ? B.FLEE_LOW : 0) + B.FLEE_ROUND * r * (0.5 + tire(F[lo]));
  const winner = out ? (hp[0] === 0 ? 1 : 0) : hp[0] !== hp[1] ? (hp[0] > hp[1] ? 0 : 1) : wins[0] > wins[1] ? 0 : 1; // 5라운드는 홀수라 라운드 승수는 비기지 않는다

  // 승부를 가른 이유: 경기에서 일어난 일(날기·헤엄·피하기) 하나 + 점수 차이가 큰 항목
  const [W, L] = winner === 0 ? [a, b] : [b, a], pw = parts(W, stage), pl = parts(L, stage);
  const events = [];
  // 자연 사건에서 상대보다 크게 덜 잃었으면 그 사건이 첫 번째 이유(키 ev_<사건>). 그때는 날기·헤엄 이유는 빼고 점수 이유만 뒤에
  const gain = r => r.event.d[winner] - r.event.d[1 - winner];
  const evBest = rounds.filter(r => r.event).sort((x, y) => gain(y) - gain(x))[0];
  if (byEvent) events.push(`ev_${byEvent}`);
  else if (evBest && evGain[winner] - evGain[1 - winner] >= 10 && gain(evBest) > 0) events.push(`ev_${evBest.event.id}`);
  else if (wx && wxHelp[winner] - wxHelp[1 - winner] >= 2) events.push(`wx_${wx}`); // 날씨 덕분에 여러 번 맞히거나 피했다
  else if (mode(W, stage, wx) === 'fly' && mode(L, stage, wx) === 'ground') events.push('flight');
  else if (mode(W, stage, wx) === 'swim' && mode(L, stage, wx) === 'ground') events.push('swim');
  else if (dodged[winner] >= 2 && dodged[winner] > dodged[1 - winner]) events.push('dodge');
  const byScore = Object.keys(pw).map(k => [k, pw[k] - pl[k]]).filter(([k, d]) => d > 0 && !(k === 'agility' && events[0] === 'dodge')).sort((x, y) => y[1] - x[1]).map(([k]) => k);
  const reasons = [...events, ...byScore].slice(0, 2);

  const P = withP ? winProb(a, b, stage, opts) : null;
  return { rounds, winner, ko, fled, byEvent, hp, reasons, P, upset: withP && (winner === 0) !== (P >= 0.5) };
}

// 이길 확률: 같은 규칙으로 정해진 주사위(시드)로 여러 번 싸워 본 결과. 같은 입력이면 늘 같은 값
const cache = new Map();
export function winProb(a, b, stage, opts = {}) {
  const key = `${a.id}|${b.id}|${stage}|${!!opts.events}|${JSON.stringify([a.stats, b.stats, a.mass_kg.avg, b.mass_kg.avg])}`;
  if (cache.has(key)) return cache.get(key);
  let s = 12345, wins = 0;
  const rng = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = 0; i < BATTLE.SIMS; i++) wins += battle(a, b, stage, rng, false, opts).winner === 0;
  const p = wins / BATTLE.SIMS;
  cache.set(key, p);
  return p;
}
