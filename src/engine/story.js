// 문장 템플릿 자막. AI 해설(M6)이 실패하면 늘 이걸 쓴다.
import { EVENTS } from './events.js';
import { stay } from './battle.js';
import { isDino } from './riddle.js';

// 받침에 따라 이/가, 은/는, 을/를
// 받침에 따라 이/가, 은/는, 을/를. "티라노사우루스(그림)"처럼 뒤에 붙은 괄호는 건너뛰고 본다
const josa = (w, withJong, without) => {
  const base = w.replace(/\s*\([^)]*\)$/, ''), c = base.charCodeAt(base.length - 1) - 0xac00;
  return w + (c >= 0 && c < 11172 && c % 28 ? withJong : without);
};
export const ga = w => josa(w, '이', '가');
export const neun = w => josa(w, '은', '는');
export const wa = w => josa(w, '과', '와');
export const eul = w => josa(w, '을', '를');

// 원형별 공격: [자막, 큰 글자, 움직임]. 매 판 섞어서 쓴다 (PLAN 5.4)
// 움직임: bite 물기, shake 물고 흔들기, ram 들이받기, toss 들어 던지기, stomp 앞발 내리찍기,
//         pounce 덮치기, kick 발차기, slash 앞발 할퀴기, tail 몸을 돌려 꼬리치기, roll 몸 비틀며 물기
const ACTIONS = {
  theropod: [['힘껏 물었어요', '콰직!', 'bite'], ['꽉 물고 흔들었어요', '흔들흔들!', 'shake'], ['몸을 돌려 꼬리로 쳤어요', '휘익!', 'tail'], ['머리로 들이받았어요', '쿵!', 'ram']],
  ceratopsian: [['뿔로 들이받았어요', '쾅!', 'ram'], ['뿔로 들어 올려 던졌어요', '휙!', 'toss'], ['앞발을 들었다 내리찍었어요', '쿵쿵!', 'stomp'], ['몸을 돌려 꼬리로 쳤어요', '철썩!', 'tail']],
  sauropod: [['앞발을 들었다 쿵 내리찍었어요', '쿵!', 'stomp'], ['긴 꼬리를 채찍처럼 휘둘렀어요', '휘이익!', 'tail'], ['큰 몸으로 밀어냈어요', '쿠웅!', 'ram']],
  // 초식 포유류(매머드, 코뿔소, 코끼리…)는 물거나 할퀴지 않는다
  large_mammal_herb: [['머리로 힘껏 들이받았어요', '쿵!', 'ram'], ['앞발을 들었다 쿵 내리찍었어요', '쿵쿵!', 'stomp'], ['번쩍 들어 올려 밀어냈어요', '휙!', 'toss'], ['몸을 돌려 꼬리로 쳤어요', '철썩!', 'tail']],
  large_mammal: [['훌쩍 뛰어 덮쳤어요', '으르렁!', 'pounce'], ['앞발로 할퀴었어요', '샤샥!', 'slash'], ['꽉 물고 흔들었어요', '콱!', 'shake'], ['힘껏 물었어요', '콱!', 'bite']],
  marine_reptile: [['힘껏 물었어요', '콰직!', 'bite'], ['몸을 비틀며 물었어요', '빙글!', 'roll'], ['몸으로 들이받았어요', '쿵!', 'ram'], ['몸을 돌려 꼬리로 쳤어요', '철썩!', 'tail']],
  fish: [['힘껏 물었어요', '콰직!', 'bite'], ['몸으로 들이받았어요', '쿵!', 'ram'], ['꼬리를 휘둘렀어요', '철썩!', 'tail'], ['몸을 비틀며 물었어요', '빙글!', 'roll']],
  bird: [['부리로 콱 쪼았어요', '콱!', 'bite'], ['힘센 다리로 뻥 찼어요', '뻥!', 'kick'], ['날개를 펴고 덮쳤어요', '푸드득!', 'pounce'], ['부리로 물고 흔들었어요', '흔들흔들!', 'shake']],
  pterosaur: [['부리로 콕 쪼았어요', '콕!', 'bite'], ['날개를 펄럭이며 덮쳤어요', '펄럭!', 'pounce'], ['머리로 세게 밀쳤어요', '쿵!', 'ram']],
  arthropod: [['앞다리로 콕콕 찔렀어요', '콕콕!', 'bite'], ['몸으로 들이받았어요', '통!', 'ram'], ['몸을 돌려 꼬리로 쳤어요', '쿡!', 'tail'], ['폴짝 뛰어 덮쳤어요', '폴짝!', 'pounce']],
  snake: [['넓은 입으로 덥석 물었어요', '덥석!', 'bite'], ['몸으로 칭칭 감았어요', '칭칭!', 'shake'], ['꼬리로 휘둘러 쳤어요', '철썩!', 'tail'], ['머리로 세게 들이받았어요', '쿵!', 'ram']],
  sprawler: [['힘껏 물었어요', '콰직!', 'bite'], ['물고 빙글빙글 돌았어요', '빙글!', 'roll'], ['꼬리를 휘둘렀어요', '철썩!', 'tail'], ['꽉 물고 흔들었어요', '흔들흔들!', 'shake']],
  armored: [['꼬리를 휘둘러 쳤어요', '쾅!', 'tail'], ['단단한 몸으로 들이받았어요', '쿵!', 'ram'], ['앞발을 들었다 내리찍었어요', '쿵쿵!', 'stomp']],
  // 초식 동물은 물거나 할퀴지 않는다
  sprawler_herb: [['머리로 들이받았어요', '쿵!', 'ram'], ['꼬리를 휘둘렀어요', '철썩!', 'tail'], ['앞발로 쿵 밀었어요', '쿵쿵!', 'stomp']],
  theropod_herb: [['긴 발톱으로 휘둘렀어요', '샤샥!', 'slash'], ['몸을 돌려 꼬리로 쳤어요', '휘익!', 'tail'], ['머리로 밀어붙였어요', '쿵!', 'ram']],
  bird_herb: [['큰 부리로 콱 물었어요', '콱!', 'bite'], ['힘센 다리로 뻥 찼어요', '뻥!', 'kick'], ['몸으로 들이받았어요', '쿵!', 'ram']],
  // 사람(김요셉 선생님): 복싱 주먹, 유도 업어치기, 어깨로 밀기, 붙잡아 넘어뜨리기
  // 복싱(원투·훅·어퍼컷), 발차기, 유도(업어치기), 어깨로 몸통 박치기
  human: [['원, 투! 주먹을 쭉쭉 뻗었어요', '퍽퍽!', 'punch'], ['옆으로 크게 휘둘러 훅을 날렸어요', '휙 퍽!', 'hook'], ['아래에서 위로 어퍼컷을 날렸어요', '빡!', 'upper'],
    ['발을 높이 들어 힘껏 찼어요', '뻥!', 'kick'], ['태권도 돌려차기를 했어요', '팡!', 'roundkick'], ['번쩍 들어 업어치기 했어요', '휙!', 'toss'], ['어깨로 몸통 박치기를 했어요', '쿵!', 'ram']],
  // 종마다 따로(틀 공격이 안 어울리는 동물)
  pachycephalosaurus: [['두꺼운 머리로 박치기했어요', '쾅!', 'ram'], ['머리를 숙이고 달려와 부딪쳤어요', '쿵!', 'ram'], ['머리로 들이받아 넘겼어요', '휙!', 'toss']],
  leedsichthys: [['큰 몸으로 들이받았어요', '쿵!', 'ram'], ['꼬리를 휘둘렀어요', '철썩!', 'tail'], ['입을 크게 벌리고 밀어붙였어요', '우웅!', 'ram']],
};

// 이번 판에 쓸 공격 순서(섞음). 같은 판에서 같은 공격이 연달아 나오지 않게 돌려 쓴다
// 밟기(stomp 움직임: 앞발 내리찍기도)는 키 차이가 날 때만: 공룡은 상대 키가 내 키의 절반 이하, 사람은 상대 키가 1m 이하.
// 공룡은 발차기 대신 밟기. canStomp(a, 내 키, 상대 키) — 키를 모르면(null) 밟기 없음
export const STOMP = ['큰 발로 꾹 밟았어요', '쾅!', 'stomp'], HUMAN_STOMP = ['발로 꾹 밟았어요', '꾹!', 'stomp'];
export const canStomp = (a, mine, theirs) => !!mine && !!theirs && (isDino(a) ? theirs * 2 <= mine : a.archetype === 'human' && theirs <= 1);
export function actionDeck(a, rng = Math.random, stomp = false) {
  const key = ACTIONS[a.id] ? a.id : /초식/.test(a.diet ?? '') && ACTIONS[`${a.archetype}_herb`] ? `${a.archetype}_herb` : a.archetype;
  const base = (ACTIONS[key] ?? ACTIONS.large_mammal).filter(x => stomp || !isDino(a) || x[2] !== 'stomp');
  const extra = !stomp ? [] : isDino(a) ? [STOMP] : a.archetype === 'human' ? [HUMAN_STOMP] : [];
  const list = [...base, ...extra].map(([act, boom, motion]) => ({ act, boom, motion }));
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  let n = 0;
  return () => list[n++ % list.length];
}


// 무게를 아이가 아는 것으로: 코끼리 6톤, 어린이 25kg, 고양이 4kg 기준
export const weightLike = kg =>
  kg >= 3000 ? `코끼리 약 ${+(kg / 6000).toFixed(1)}마리만큼` : kg >= 12 ? `어린이 약 ${Math.round(kg / 25)}명만큼` : kg >= 1 ? `고양이 약 ${Math.max(1, Math.round(kg / 4))}마리만큼` : '사과 몇 개만큼 가벼워요';

// 길이를 우리 주변 물건으로. 0.5~7.5m 는 0.5m 칸마다 물건 하나(at: 칸, len: 비교하는 크기 m, word: 길이·높이·키, w·h: 그림 너비·높이 m),
// 그보다 작으면 연필, 8m 이상은 세웠을 때 몇 층 건물인지(한 층 3m). 크기 비교 화면에 이모지로 같은 눈금에 그린다
export const THINGS = [
  { at: 0.5, emoji: '🎒', name: '책가방', word: '높이', len: 0.45, w: 0.35, h: 0.45 },
  { at: 1, emoji: '☂️', name: '우산', word: '길이', len: 1, w: 0.9, h: 1 },
  { at: 1.5, emoji: '🎹', name: '피아노', word: '너비', len: 1.5, w: 1.5, h: 1.2 },
  { at: 2, emoji: '🛏️', name: '침대', word: '길이', len: 2, w: 2, h: 0.9 },
  { at: 2.5, emoji: '🛋️', name: '소파', word: '길이', len: 2.4, w: 2.4, h: 0.9 },
  { at: 3, emoji: '🐊', name: '악어', word: '길이', len: 3, w: 3, h: 0.7 },
  { at: 3.5, emoji: '🦛', name: '하마', word: '길이', len: 3.5, w: 3.5, h: 1.5 },
  { at: 4, emoji: '🦈', name: '백상아리', word: '길이', len: 4, w: 4, h: 1.2 },
  { at: 4.5, emoji: '🚗', name: '자동차', word: '길이', len: 4.5, w: 4.5, h: 1.5 },
  { at: 5, emoji: '🦒', name: '기린', word: '키', len: 5, w: 2.5, h: 5 },
  { at: 5.5, emoji: '🐘', name: '코끼리', word: '몸길이', len: 5.5, w: 5.5, h: 3.2 },
  { at: 6, emoji: '🚑', name: '구급차', word: '길이', len: 6, w: 6, h: 2.5 },
  { at: 6.5, emoji: '🚚', name: '택배 트럭', word: '길이', len: 6.5, w: 6.5, h: 3 },
  { at: 7, emoji: '🚒', name: '소방차', word: '길이', len: 7, w: 7, h: 3.2 },
  { at: 7.5, emoji: '🐋', name: '범고래', word: '길이', len: 7.5, w: 7.5, h: 2 },
];
const PENCIL = { emoji: '✏️', name: '연필', len: 0.18, w: 0.18, h: 0.18 }, FLOOR_M = 3;
export const thingFor = m => {
  if (m >= 8) { const n = Math.round(m / FLOOR_M); return { building: n, name: `${n}층 건물`, w: 6, h: n * FLOOR_M }; }
  if (m < 0.25) return PENCIL;
  const at = Math.min(7.5, Math.round(m * 2) / 2);
  return THINGS.find(t => t.at === at);
};
export const sizeLike = m => {
  const t = thingFor(m);
  if (t.building) return `세우면 약 ${t.name} 높이`;
  if (t === PENCIL) return m < t.len * 0.8 ? '연필보다 짧아요' : `연필 약 ${+(m / t.len).toFixed(1)}자루 길이`;
  return `${t.name} ${wa(t.word)} 비슷해요`;
};

export const introLine = (a, b) => `${a.name_ko} 대 ${b.name_ko}!`;

export const roundLine = (W, act) => `${ga(W.name_ko)} ${act.act}!`;

export const outroLine = (W, L) => `${neun(L.name_ko)} 힘이 다 빠져서 물러났어요. ${W.name_ko} 승리!`;
export const fleeLine = (W, L) => `${neun(L.name_ko)} 이길 수 없다는 걸 알고 도망쳤어요. ${W.name_ko} 승리!`;
export const finisherLine = W => `${W.name_ko}의 마지막 한 방!`;
export const eventOutLine = (W, L, id) => `${neun(L.name_ko)} ${EVENTS[id].when} 깜짝 놀라 멀리 피했어요. ${W.name_ko} 승리!`;
export const koLine = (W, L) => `${neun(L.name_ko)} 쿵 쓰러져서 눈앞이 빙글빙글! ${W.name_ko} K.O. 승리!`;

// 승부를 가른 이유 (engine의 reasons 키 → 문장)
const REASONS = {
  mass: W => `${ga(W.name_ko)} 훨씬 무거웠어요.${W.mass_kg.avg >= 12 ? ` ${weightLike(W.mass_kg.avg)}이나 돼요!` : ''}`, // 유치원생용: 숫자 대신 코끼리·어린이 몇 명만큼
  attack: W => `${W.name_ko}의 ${ga(W.weapons[0] ?? '공격')} 더 강했어요.`,
  defense: W => `${W.name_ko}의 ${ga(W.armor[0] ?? '튼튼한 몸')} 공격을 잘 막아냈어요.`,
  speed: W => `${ga(W.name_ko)} 더 빨랐어요.`,
  agility: W => `${ga(W.name_ko)} 더 날쌔게 피했어요.`,
  senses: W => `${ga(W.name_ko)} 상대를 먼저 알아챘어요.`,
  social: W => `${ga(W.name_ko)} 더 영리하게 싸웠어요.`,
  flight: (W, L) => `${neun(W.name_ko)} 하늘을 날아서 ${L.name_ko}의 공격이 잘 닿지 않았어요.`,
  swim: (W, L) => `${neun(W.name_ko)} 물속을 자유롭게 헤엄쳐서 ${L.name_ko}의 공격을 요리조리 피했어요.`,
  dodge: W => `${ga(W.name_ko)} 날쌔게 공격을 여러 번 피했어요.`,
  stage: (W, L, stage) => {
    const watery = a => ['sea', 'freshwater'].includes(a.habitat);
    if (stage === 'underwater' && ['land', 'air'].includes(L.habitat)) return `${neun(L.name_ko)} 물속에서 숨을 오래 참을 수 없었어요.`;
    if (stage === 'underwater' && watery(W)) return `물속은 ${W.name_ko}의 집이었어요!`;
    if ((stage === 'grassland' || stage === 'jungle') && watery(L)) return `${L.name_ko}에게는 물이 필요했어요. 땅 위에서는 힘을 못 썼어요.`;
    if (stage === 'waterside' && L.habitat === 'sea') return `${neun(L.name_ko)} 얕은 물가에서 헤엄치기 힘들었어요.`;
    if (stage === 'waterside' && ['amphibious', 'freshwater'].includes(W.habitat)) return `${neun(W.name_ko)} 물가에 익숙했어요.`;
    if (stage === 'jungle' && L.mass_kg.avg > W.mass_kg.avg) return `${neun(L.name_ko)} 덩치가 커서 빽빽한 정글에서 움직이기 힘들었어요.`;
    if (stage === 'jungle') return `${neun(W.name_ko)} 날쌔서 정글 나무 사이로 잘 피했어요.`;
    return `${W.name_ko}에게 이 무대가 더 잘 맞았어요.`;
  },
};
// 피하기 자막: 날면 날아올라, 헤엄치면 물속으로, 땅이면 폴짝
const DODGES = { fly: ['훨훨 날아올라 피했어요', '하늘로 휙 피했어요'], swim: ['물속으로 쏙 피했어요', '빙글 헤엄쳐 피했어요'], ground: ['휙 피했어요', '폴짝 뛰어 피했어요', '몸을 비틀어 피했어요'] };

// 한 판의 대본: 라운드마다 공격 두 번(누가, 어떤 공격, 맞았나), 자막. 템플릿으로 만들고, AI 자막이 오면 덮어쓴다
// modes: [A의 움직임, B의 움직임] (engine/battle.js mode), motion: 확인용으로 모든 공격을 이 움직임으로 고정
// 날씨가 공격 결과를 바꿨을 때 말풍선: 맞았으면 날씨 덕을 본 쪽, 빗나갔으면 날씨 탓을 한 쪽 이야기
function wxLine(wx, att, def, hit, stage) {
  const sa = stay(wx, att, stage), sd = stay(wx, def, stage), e = EVENTS[wx].emoji;
  if (hit) return sa.up ? `${e} ${neun(att.name_ko)} ${sa.up}!` : `${e} ${neun(def.name_ko)} ${sd.down ?? '날씨 때문에 못 피했어요'}!`;
  return sa.down ? `${e} ${neun(att.name_ko)} ${sa.down}!` : `${e} ${neun(def.name_ko)} ${sd.up ?? '날씨 덕분에 피했어요'}!`;
}

// heights: 두 동물의 키(m, 그림에서 잰 것). 없으면 밟기 없음
export function makeScript(A, B, res, modes, motion, stage, heights = null) {
  // motion(확인용 #fight=…&m=hook): 그 움직임만. 자막은 그 움직임을 쓰는 공격 문장(내 공격 목록 먼저), 없으면 움직임 이름
  const named = (a, m) => { const x = (ACTIONS[a.id] ?? ACTIONS[a.archetype] ?? []).find(e => e[2] === m) ?? Object.values(ACTIONS).flat().find(e => e[2] === m) ?? (m === 'stomp' && STOMP); return x ? { act: x[0], boom: x[1], motion: m } : { act: m, boom: '쾅!', motion: m }; };
  const F = [A, B], deck = F.map((a, i) => (motion ? () => named(a, motion) : actionDeck(a, Math.random, !!heights && canStomp(a, heights[i], heights[1 - i]))));
  let n = 0;
  const rounds = res.rounds.map(r => ({
    winner: r.winner,
    // 자연 사건: 알림 한 줄 + 동물마다 어떻게 됐는지
    ...(r.event && { event: { ...r.event, say: `${EVENTS[r.event.id].emoji} ${r.event.say}`, lines: F.map((a, i) => `${neun(a.name_ko)} ${r.event.why[i]}!`) } }),
    ...(r.wx && { wx: r.wx }),
    // 4·5라운드 시작: 날씨 영향을 받는 동물마다 [동물 번호, 말풍선, 힘 변화]. 힘이 빠지면 tick, 아니면 note → up
    ...(r.wx && !(r.event && r.event.id !== 'meteor') && { notes: F.map((a, i) => {
      const st = stay(r.wx, a, stage), d = r.tick?.[i] ?? 0, t = d < 0 ? st.tick : st.note ?? st.up ?? st.tick;
      return t && [i, `${EVENTS[r.wx].emoji} ${neun(a.name_ko)} ${t}!`, d];
    }).filter(Boolean) }),
    attacks: r.attacks.map(t => {
      const act = deck[t.by](), att = F[t.by], def = F[1 - t.by], dodge = DODGES[modes[1 - t.by]];
      return { ...t, ...act, text: t.ko ? `${finisherLine(att)} ${act.act}!` : roundLine(att, act), dodgeText: `${ga(def.name_ko)} ${dodge[n++ % dodge.length]}!`, ...(t.wx && { wxText: wxLine(t.wx, att, def, t.hit, stage) }) };
    }),
  }));
  const W = F[res.winner], L = F[1 - res.winner];
  return { intro: introLine(A, B), rounds, outro: res.ko ? koLine(W, L) : res.byEvent ? eventOutLine(W, L, res.byEvent) : res.fled ? fleeLine(W, L) : outroLine(W, L) };
}
// AI가 쓴 줄 중 쓸 수 있는 것만 바꿔 넣는다(서버에서 이미 검사함). ai.lines = 공격 순서대로
export function withAiLines(script, ai) {
  if (!ai) return script;
  let k = 0;
  return {
    intro: ai.intro ?? script.intro,
    rounds: script.rounds.map(r => ({ ...r, attacks: r.attacks.map(t => { const line = ai.lines?.[k++]; return line ? { ...t, [t.hit ? 'text' : 'dodgeText']: line } : t; }) })),
    outro: ai.outro ?? script.outro,
  };
}

// 사건 이유: 이긴 쪽이 별로 안 잃었으면 그 까닭을, 이긴 쪽도 크게 잃었으면(둘 다 힘들었으면) "더 잘 버텼어요"
const eventReason = (W, id, stage) => {
  const E = EVENTS[id], [d, why] = E.hit(W, stage);
  return d > -10 ? `${E.when} ${neun(W.name_ko)} ${why}.` : `${E.when} ${ga(W.name_ko)} 더 잘 버텼어요.`;
};
// 날씨 이유: 날씨가 남아 있는 동안 날씨 덕분에 여러 번 맞히거나 피했다
const wxReason = (W, id, stage) => `${EVENTS[id].when} ${ga(W.name_ko)} 더 잘 싸웠어요${stay(id, W, stage).up ? `. ${stay(id, W, stage).up}` : ''}.`;
export const reasonLines = (W, L, keys, stage) => keys.map(k => (k.startsWith('ev_') ? eventReason(W, k.slice(3), stage) : k.startsWith('wx_') ? wxReason(W, k.slice(3), stage) : REASONS[k](W, L, stage)));

// 투표 화면 무대 힌트. value = 엔진의 무대 보정값(parts().stage)
export function stageNote(a, stage, value) {
  if (Math.abs(value) < 0.4) return null;
  const good = value > 0, watery = ['sea', 'freshwater'].includes(a.habitat);
  const text = good
    ? { underwater: '물속이 우리 집!', waterside: '물가가 익숙해요', jungle: '날쌔서 정글에서 유리해요' }[stage] ?? '이 무대가 잘 맞아요'
    : stage === 'underwater' ? '숨을 참아야 해요! 물속은 힘들어요'
    : watery && stage !== 'waterside' ? '물이 필요해! 땅 위에서는 힘들어요'
    : stage === 'waterside' ? '물이 얕아서 헤엄치기 힘들어요'
    : stage === 'jungle' ? '덩치가 커서 정글은 비좁아요' : '이 무대는 조금 힘들어요';
  return { good, text };
}
