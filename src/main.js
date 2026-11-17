// 흐름: 동물 고르기(내 그림 추가 가능) → 무대 고르기 → 크기 비교 → 예측 투표 → 배틀 → 결과(이유·예측 비교·만약에). #gallery 는 그림 확인 화면
import '@fontsource/black-han-sans';
import '@fontsource/jua';
import { animals, addAnimals } from './data.js';
import { drawAnimal, drawHuman, shapeTest, heightOf } from './art/index.js';
import { battle, mode } from './engine/battle.js';
import { reasonLines, ga, neun, makeScript, withAiLines, weightLike, sizeLike } from './engine/story.js';
import { narrate, loadAiAnimals } from './ai.js';
import { showLookup } from './ui/lookup.js';
import { whatIf, eraRange, PERIODS, subRange } from './engine/whatif.js';
import { playBattle } from './ui/battle.js';
import { fitSvg } from './ui/scene.js';
import { showGallery, showModel, showTemplates, showSounds } from './ui/gallery.js';
import { showCompare } from './ui/compare.js';
import { showVote } from './ui/vote.js';
import { showStagePick } from './ui/stagepick.js';
import { showDrawing } from './ui/drawing.js';
import { showBlocks } from './ui/blockview.js';
import { sfx, unlock, isMuted, setMuted, isMusicOn, setMusicOn } from './ui/sfx.js';
import { STAGES, AI_WAIT_MS, HUMANS } from './config.js';
import { makeBracket, nextMatch, roundName, shuffle } from './engine/bracket.js';
import { showSize, showBracket, showMatchEnd, showChampion } from './ui/tournament.js';
import { spinStage } from './ui/roulette.js';
import { EVENTS } from './engine/events.js';
import { DINO, NOT_DINO, bossPool } from './engine/riddle.js';
import { showBoss } from './ui/boss.js';

const app = document.getElementById('app');
let stage = 'grassland'; // 마지막으로 고른 무대를 기억
const drawings = []; // 아이 그림(이 브라우저 창에서만, 새로고침하면 사라짐)
// 자연 사건(소나기·홍수·화산·운석…) 켜기. 오른쪽 아래 🌋 버튼, 이 브라우저에 기억
let events = (() => { try { return localStorage.getItem('dino-events') !== '0'; } catch { return true; } })();
let filter = { tab: 'all', q: '' }; // 고르기 화면의 사는 곳 탭·검색어를 기억
const mini = a => `<g transform="scale(${a.length_m.avg})">${drawAnimal(a)}</g>`;
const HABITAT = { land: '🦶 땅', sea: '🌊 바다', freshwater: '🏞️ 강', air: '🪽 하늘', amphibious: '🐊 물가' };
const REASON_ICON = { mass: '⚖️', attack: '🦷', defense: '🛡️', speed: '💨', agility: '🌀', senses: '👀', social: '🧠', flight: '🪽', swim: '🌊', dodge: '💨' };

// 고르기 탭: 사는 곳별(강은 물가에 합침) + 우리 반(아이 그림·AI로 찾은 동물)
const TABS = { all: '전체', land: '🦶 땅', sea: '🌊 바다', water: '🐊 물가', air: '🪽 하늘', ours: '✏️ 우리 반' };
const iconOf = (k, stage) => REASON_ICON[k] ?? EVENTS[k.slice(3)]?.emoji ?? STAGES[stage].emoji;
const tabsOf = a => [{ land: 'land', sea: 'sea', air: 'air', amphibious: 'water', freshwater: 'water' }[a.habitat], ...(a.drawing || !a.book ? ['ours'] : [])];
const byName = (a, b) => a.name_ko.localeCompare(b.name_ko, 'ko');

// need = 2: 보통 배틀, 4·8·16: 토너먼트 출전 동물 고르기
function pick(chosen = [], need = 2) {
  const tour = need > 2;
  // 아이 그림은 방금 올린 걸 찾기 쉽게 맨 앞, 나머지는 가나다 순
  const all = [...drawings, ...[...animals].sort(byName)];
  const count = k => all.filter(a => k === 'all' || tabsOf(a).includes(k)).length;
  app.innerHTML = `<header class="title"><h1>상상 동물•공룡 배틀</h1><p>${tour ? `🏆 토너먼트에 나갈 동물 ${need}마리를 골라요` : '싸울 동물 두 마리를 골라요'}</p>${tour ? '' : '<button class="tour">🏆 토너먼트</button><button class="boss">🕵️ 수수께끼 보스</button>'}</header>
    <div class="filters"><input class="search" type="search" placeholder="🔎 이름으로 찾기">
      ${Object.entries(TABS).map(([k, v]) => `<button class="tab${filter.tab === k ? ' on' : ''}" data-tab="${k}">${v} <small>${count(k)}</small></button>`).join('')}</div>
    <div class="pick"><button class="card add draw-add"><span>✏️</span><b>내 그림 추가</b><small>그림 사진을 올려요</small></button>
      <button class="card add dice-add"><span>🎲</span><b>${tour ? '나머지 채우기' : '아무거나!'}</b><small>${tour ? '빈자리를 뽑아 채워요' : '두 마리를 뽑아요'}</small></button>
      <button class="card add find-add"><span>🔎</span><b>다른 동물 찾기</b><small>AI가 찾아 줘요</small></button>
      ${all.map(a => `<button class="card${a.drawing ? ' mine' : ''}" data-id="${a.id}" data-tabs="${tabsOf(a).join(' ')}" data-names="${[a.name_ko, a.alias, a.name_en].filter(Boolean).join(' ').toLowerCase()}">
      <svg class="scene"></svg><em></em>
      <b>${a.name_ko}</b>
      <span class="tags">${a.drawing ? '<i>✏️ 우리 반 그림</i>' : `<i>${a.era}</i>`}${a.source_note?.startsWith('AI') ? '<i>🤖 AI</i>' : ''}<i>${HABITAT[a.habitat]}</i></span>
      <small>${a.size_raw}</small></button>`).join('')}</div>
    <footer class="tray">${tour ? '<button class="back">← 마릿수</button><div class="slot count"></div><button class="reset">🔄 초기화</button><button class="go" disabled>대진표 만들기 →</button>' : '<button class="reset">🔄 초기화</button><div class="slot s1"></div><strong>VS</strong><div class="slot s2"></div><button class="go" disabled>무대 고르기 →</button>'}</footer>`;
  const go = app.querySelector('.go');
  const refresh = () => {
    app.querySelectorAll('.card[data-id]').forEach(el => {
      const i = chosen.findIndex(a => a.id === el.dataset.id);
      el.classList.toggle('on', i >= 0);
      el.classList.toggle('p2', !tour && i === 1);
      el.querySelector('em').textContent = i >= 0 ? i + 1 : '';
    });
    if (tour) app.querySelector('.count').textContent = `${chosen.length} / ${need}마리`;
    else [0, 1].forEach(i => (app.querySelector(`.s${i + 1}`).textContent = chosen[i]?.name_ko ?? '?'));
    go.disabled = chosen.length !== need;
    reset.disabled = !chosen.length;
  };
  // 초기화: 고른 동물을 모두 비운다
  const reset = app.querySelector('.reset');
  reset.onclick = () => { chosen = []; refresh(); };
  // 지금 보이는(탭·검색에 맞는) 동물 중에서 뽑는다. 보통은 두 마리 새로, 토너먼트는 빈자리만(모자라면 안 보이는 동물로)
  app.querySelector('.dice-add').onclick = () => {
    const seen = all.filter(a => !app.querySelector(`.card[data-id="${a.id}"]`).hidden), rest = xs => shuffle(xs.filter(a => !chosen.includes(a)));
    if (!tour && seen.length < 2) return;
    chosen = tour ? [...chosen, ...rest(seen), ...rest(all.filter(a => !seen.includes(a)))].slice(0, need) : shuffle(seen).slice(0, 2);
    refresh();
    app.querySelector(`.card[data-id="${chosen[0].id}"]`).scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  app.querySelector('.find-add').onclick = () => showLookup(app, { done: a => pick([...chosen, a].slice(-need), need), cancel: () => pick(chosen, need) });
  app.querySelector('.draw-add').onclick = () => showDrawing(app, {
    save: d => { drawings.unshift(d); pick([...chosen, d].slice(-need), need); },
    cancel: () => pick(chosen, need),
  });
  app.querySelectorAll('.card[data-id]').forEach(el => {
    const a = all.find(a => a.id === el.dataset.id);
    fitSvg(el.querySelector('svg'), mini(a));
    el.onclick = () => {
      chosen = chosen.includes(a) ? chosen.filter(c => c !== a) : [...chosen, a].slice(-need);
      refresh();
    };
  });
  go.onclick = () => (tour ? startTour(chosen) : stagePick(...chosen));
  if (tour) app.querySelector('.tray .back').onclick = tournament;
  else { app.querySelector('.tour').onclick = tournament; app.querySelector('.boss').onclick = riddle; }
  // 사는 곳 탭 + 이름 검색(한글 이름, 별명, 영어 이름)
  const applyFilter = () => {
    const q = filter.q.trim().toLowerCase().replace(/\s/g, '');
    app.querySelectorAll('.card[data-id]').forEach(el => {
      el.hidden = !((filter.tab === 'all' || el.dataset.tabs.split(' ').includes(filter.tab)) && (!q || el.dataset.names.replace(/\s/g, '').includes(q)));
    });
  };
  app.querySelectorAll('.tab').forEach(t => (t.onclick = () => {
    filter.tab = t.dataset.tab;
    app.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
    applyFilter();
  }));
  app.querySelector('.search').value = filter.q;
  app.querySelector('.search').oninput = e => { filter.q = e.target.value; applyFilter(); };
  applyFilter();
  refresh();
}

const stagePick = (A, B) => showStagePick(app, A, B, stage, { next: s => { stage = s; compare(A, B); }, back: () => pick([A, B]) });
const compare = (A, B) => showCompare(app, A, B, { next: () => vote(A, B), back: () => stagePick(A, B) });
// 투표 화면에 들어올 때 승부를 미리 정하고 AI 자막을 미리 부탁해 둔다(기다리는 시간 숨기기, PLAN 8.2)
const vote = (A, B) => {
  const match = prepare(A, B);
  showVote(app, A, B, stage, { fight: v => fight(A, B, v, match), back: () => compare(A, B) });
};

// AI에는 이름과 승부 결과만 보낸다. "(그림)"도 떼고 보낸다
const plain = a => a.name_ko.replace(/\(그림\)$/, '');
function prepare(A, B, motion) {
  const F = [A, B], res = battle(A, B, stage, Math.random, true, { events }), modes = F.map(a => mode(a, stage)), script = makeScript(A, B, res, modes, motion, stage, F.every(heightOf) ? F.map(heightOf) : null);
  const [W, L] = [F[res.winner], F[1 - res.winner]];
  const ai = motion || plain(A) === plain(B) ? Promise.resolve(null) : narrate({
    stage: STAGES[stage].name, a: plain(A), b: plain(B), winner: plain(W), loser: plain(L), ko: res.ko, fled: res.fled,
    reasons: reasonLines(W, L, res.reasons, stage).map(t => t.replaceAll('(그림)', '')),
    attacks: script.rounds.flatMap(r => r.attacks.map(t => ({ attacker: plain(F[t.by]), defender: plain(F[1 - t.by]), action: t.act, hit: t.hit, ko: t.ko }))),
  });
  return { res, script, modes, ai };
}

// votes: [A에 손 든 수, B에 손 든 수] 또는 null(건너뜀)
async function fight(A, B, votes, match = prepare(A, B)) {
  await play(A, B, match);
  result(A, B, match.res, votes);
}
async function play(A, B, match) {
  const ai = await Promise.race([match.ai, new Promise(r => setTimeout(r, AI_WAIT_MS, null))]);
  const script = withAiLines(match.script, ai);
  if (match.res.byEvent) script.outro = match.script.outro; // 사건으로 끝난 판은 AI가 모르는 결말이라 템플릿 문장
  await playBattle(app, A, B, match.res, stage, script, match.modes);
}

// ── 수수께끼 보스: 힌트로 정체 맞히기(ui/boss.js) → 보스와 싸울 동물 고르기(pick) → 보통 배틀 흐름
const riddle = () => { const P = bossPool(animals); showBoss(app, P[Math.floor(Math.random() * P.length)], animals, { fight: boss => pick([boss]), again: riddle, back: () => pick() }); };

// ── 토너먼트: 마릿수 → 동물 고르기(pick) → 대진표 → (무대 룰렛 → 배틀 → 한 줄 결과) 반복 → 우승. 투표는 시작 전 "누가 우승할까?" 한 번만
let tour = null; // { rounds, guess }
const tournament = () => showSize(app, { choose: n => pick([], n), back: () => pick() });
const startTour = list => { tour = { rounds: makeBracket(list), guess: null }; bracket(); };
function bracket() {
  if (!nextMatch(tour.rounds)) return showChampion(app, tour.rounds, tour.guess, { again: () => startTour(tour.rounds[0]), other: tournament });
  showBracket(app, tour.rounds, tour.guess, { setGuess: a => { tour.guess = a; bracket(); }, next: tourMatch, home: () => pick() });
}
async function tourMatch() {
  const { r, i, a: A, b: B } = nextMatch(tour.rounds);
  stage = await spinStage(app, A, B, `⚔️ ${roundName(tour.rounds, r)}`);
  const match = prepare(A, B);
  await play(A, B, match);
  const [W, L] = match.res.winner === 0 ? [A, B] : [B, A];
  tour.rounds[r + 1][i] = W;
  const k = match.res.reasons[0];
  showMatchEnd(app, W, reasonLines(W, L, match.res.reasons, stage)[0], iconOf(k, stage), { next: bracket });
}

function predictionHtml(A, B, res, votes) {
  if (!votes) return '';
  const [va, vb] = votes, pick = va === vb ? -1 : va > vb ? 0 : 1;
  const verdict = pick < 0 ? '🤝 우리 반 의견이 반반이었어요!' : pick === res.winner ? '🎉 우리 반 예상이 맞았어요!' : '😮 이번엔 예상과 달랐어요!';
  return `<div class="predict"><p>우리 반 예상: <b class="c1">${A.name_ko} ${va}명</b> · <b class="c2">${B.name_ko} ${vb}명</b></p><strong>${verdict}</strong></div>`;
}

// 시간 띠: 동물마다 막대 + 이름·시대(백과 표기 그대로), 아래 세 줄 = 대(고생대·중생대·신생대·지금) / 기(캄브리아기 … 빙하기) / 공룡 시대의 전기·중기·후기.
// 진짜 길이대로면 공룡 시대가 좁고 빙하기 동물이 '지금'에 붙어 버려서, 구간마다 폭을 정해 두고 그 안에서만 비례로 놓는다(백만 년 전 → 띠의 %)
const TL = [[539, 0], [252, 20], [66, 68], [2.6, 82], [0.012, 93], [0, 100]];
const tlX = ma => { const i = TL.findIndex(([m]) => m <= ma); if (i <= 0) return i ? 100 : 0; const [[m0, x0], [m1, x1]] = [TL[i - 1], TL[i]]; return x0 + ((m0 - ma) / (m0 - m1)) * (x1 - x0); };
const TL_ERAS = [['고생대', 539, 252], ['중생대 · 공룡 시대', 252, 66], ['신생대', 66, 0.012], ['지금', 0.012, 0]];
const TL_PERIODS = Object.entries(PERIODS).map(([n, [s, e]]) => [n, s, e]).concat([['지금', 0.012, 0]]);
const TL_SUBS = ['트라이아스기', '쥐라기', '백악기'].flatMap(n => (n === '백악기' ? [['전기', 'early'], ['후기', 'late']] : [['전기', 'early'], ['중기', 'mid'], ['후기', 'late']]).map(([t, part]) => [t, ...subRange(n, part)]));
const shortEra = era => era.replace(/^(고생대|중생대|신생대)\s+(?=[^(\s])/, ''); // "중생대 백악기 후기" → "백악기 후기"
function timelineHtml(A, B) {
  const live = [A, B].map(a => eraRange(a.era));
  const bar = (a, i) => {
    const [s, e] = live[i], l = tlX(s), w = Math.max(2.5, tlX(e) - l);
    return `<div class="tl-row"><i class="c${i + 1}" style="left:${l}%;width:${w}%"></i><b class="c${i + 1}" style="${l + w / 2 > 55 ? `right:${100 - l - w}%` : `left:${l}%`}">${a.name_ko} <small>· ${shortEra(a.era)}</small></b></div>`;
  };
  // 칸 하나: 좁으면 글자를 빼고(마우스를 올리면 이름), 두 동물 중 누가 그때 살았으면 밝게
  const cells = (list, minW) => list.map(([t, s, e]) => {
    const l = tlX(s), w = tlX(e) - l, on = live.some(([ls, le]) => ls > e && le < s);
    return `<span class="${on ? 'on' : ''}" title="${t}" style="left:${l}%;width:${w}%">${w >= minW ? t : ''}</span>`;
  }).join('');
  return `<div class="tl">${[A, B].map(bar).join('')}<div class="tl-bands era">${cells(TL_ERAS, 4)}</div><div class="tl-bands per">${cells(TL_PERIODS, 7)}</div><div class="tl-bands sub">${cells(TL_SUBS, 4)}</div></div>`;
}

function whatIfHtml(A, B) {
  const w = whatIf(A, B, neun);
  return w.met
    ? `<div class="whatif met"><h2>🦕 진짜로 만났을지도 몰라요!</h2><p>둘은 같은 시대(${A.era}), 같은 곳(${w.shared.join('·')})에 살았어요.</p>${timelineHtml(A, B)}</div>`
    : `<div class="whatif"><h2>🌈 만약에…</h2><p>진짜로는 만난 적 없지만 상상 속에서 만났어요.</p>${timelineHtml(A, B)}<ul>${w.lines.map(l => `<li>${l}</li>`).join('')}</ul></div>`;
}

// 이긴 동물 도감 카드(교육용): 백과 추출본의 이름 뜻·시대·사는 곳·먹이·크기·무게 + 무기·몸 지키기, 출처(책·쪽)
function dexHtml(a) {
  const ok = v => v && v !== '알 수 없음';
  const row = (icon, k, v) => (ok(v) ? `<li><span>${icon}</span><b>${k}</b><em>${v}</em></li>` : '');
  const now = /현재|지금/.test(a.era ?? ''); // 지금 사는 동물·사람: "살았던" 대신 "사는"
  return `<div class="dex"><h2>📒 ${a.name_ko} 도감</h2><ul>`
    + row('💬', '이름 뜻', a.name_meaning) + row('⏳', now ? '시대' : '살았던 때', a.era) + row('🌍', now ? '사는 곳' : '살았던 곳', a.place)
    + row(/육식/.test(a.diet ?? '') ? '🍖' : /초식/.test(a.diet ?? '') ? '🌿' : '🍽️', '먹이', a.diet)
    + row('📏', '크기', ok(a.size_raw) && a.size_raw + ` · ${sizeLike(a.length_m.avg)}`)
    + row('⚖️', '무게', ok(a.mass_raw) && a.mass_raw + (a.mass_kg.avg >= 1 ? ` · ${weightLike(a.mass_kg.avg)}` : '')) // 아주 가벼운 동물은 백과 표기만
    + row('🦷', '무기', a.weapons?.join(', ')) + row('🛡️', '몸 지키기', a.armor?.join(', ')) + row('🧬', '지금 친척', a.kin) + row('✨', '알고 있니?', a.fun_fact)
    + `</ul><p class="src">${a.book ? `📖 ${a.book} ${a.page}쪽` : a.origin ? '🤖 AI가 찾은 정보예요. 선생님과 함께 확인해요' : ''}</p></div>`;
}

// ── 공부 탭 꼭지들(백과에 자주 나오는 것) ──
// 1) 공룡일까? 아이들이 공룡으로 많이 아는 동물 중 공룡이 아닌 것을 알려 준다
const NOT_DINO_BY = { pterosaur: '하늘을 날던 파충류, 익룡이에요.', marine_reptile: '바다에 살던 파충류예요.', fish: '물고기예요.', large_mammal: '털이 있고 젖을 먹이는 포유류예요.', sprawler: '악어 친척이에요.', snake: '아주 큰 뱀이에요.', arthropod: '곤충·게·새우와 같은 무리예요.', human: '사람이에요! 사람은 공룡이 사라지고 아주 아주 오랜 뒤에 나타났어요.' };
const PLESIO = ['nothosaurus', 'pliosaurus', 'liopleurodon', 'elasmosaurus'], ICHTHYO = ['shonisaurus', 'shastasaurus', 'ophthalmosaurus'];
function kindHtml(a) {
  if (DINO.includes(a.archetype) && !NOT_DINO[a.id]) return '<p class="kind yes">🦖 진짜 공룡이에요!</p>';
  if (a.archetype === 'bird') return '<p class="kind bird">🐦 새예요. 새는 공룡의 후손이라 “살아 있는 공룡”이라고도 해요!</p>';
  const t = NOT_DINO[a.id] ?? (PLESIO.includes(a.id) ? '바다에 살던 파충류, 수장룡 무리예요.' : ICHTHYO.includes(a.id) ? '바다에 살던 파충류, 어룡이에요. 물고기처럼 생겼지만 공기로 숨을 쉬었어요.' : NOT_DINO_BY[a.archetype] ?? '공룡과 다른 동물이에요.');
  return `<p class="kind no">❗ 공룡이 아니에요! ${t}</p>`;
}
// 2) 같은 때·같은 곳에 살던 이웃(데이터에서 자동으로). 백과 그림이 있는 동물 먼저
function friendsHtml(a, skip) {
  const list = animals.filter(b => !skip.includes(b) && b.id !== a.id && b.era && b.place && whatIf(a, b, neun).met).sort((x, y) => !!y.book - !!x.book).slice(0, 4);
  if (!list.length) return '';
  return `<div class="friends"><h3>🤝 ${a.name_ko}의 이웃</h3><p>같은 때, 같은 곳에 살았어요</p><div>${list.map(b => `<figure>${b.book ? `<img src="${import.meta.env.BASE_URL}book/${b.id}.jpg" alt="" onerror="this.remove()">` : ''}<figcaption>${b.name_ko}</figcaption></figure>`).join('')}</div></div>`;
}
// 3) 나와 크기 비교: 선생님·어린이·두 동물을 같은 눈금으로(그린 뒤 fitSvg)
function sizeScene(A, B) {
  let x = 0, s = drawHuman(HUMANS.teacher_m, '선생님');
  x += HUMANS.teacher_m * 0.5;
  s += `<g transform="translate(${x} 0)">${drawHuman(HUMANS.child_m, '어린이')}</g>`;
  x += HUMANS.child_m * 0.5 + 0.5;
  const fs = Math.max(A.length_m.avg, B.length_m.avg, 2) * 0.08;
  for (const [i, a] of [A, B].entries()) {
    const L = a.length_m.avg;
    s += `<g transform="translate(${x} 0) scale(${L})">${drawAnimal(a)}</g><text x="${x + L / 2}" y="${fs * 1.4}" font-size="${fs}" text-anchor="middle" class="p${i + 1}">${a.name_ko}</text>`;
    x += L + 0.6 + L * 0.1;
  }
  return s + `<line x1="-0.5" y1="0" x2="${x}" y2="0" class="ground"/>`;
}
// 5) 몸 구석구석: 무기·몸 지키기를 그림의 그 부위에 화살표로. 부위 자리는 그림 모양(shapeTest)에서 찾는다
const PART_AT = [[/주먹/, 'nose'], [/이빨|턱|송곳니|부리|물/, 'nose'], [/엄니|코/, 'snout'], [/뿔|프릴|볏|목 ?방패|머리|박치기/, 'head'], [/발톱|발|낫|차기/, 'foot'], [/꼬리|곤봉|가시 꼬리/, 'tail'], [/골판|돛|등|가시|날개|지느러미/, 'back']];
function partsFill(svg, a) {
  fitSvg(svg, drawAnimal(a));
  const test = shapeTest(a, svg), pts = [];
  for (let i = 0; i <= 80; i++) for (let j = 0; j <= 60; j++) if (test(i / 80, j / 50)) pts.push([i / 80, j / 50]);
  const items = [...(a.weapons ?? []), ...(a.armor ?? [])].slice(0, 5);
  if (!pts.length || !items.length) return;
  const best = (f, P = pts) => P.reduce((b, p) => (f(p) > f(b) ? p : b), P[0]);
  const top = best(p => p[1])[1], low = best(p => -p[1])[1], maxU = best(p => p[0])[0], minU = best(p => -p[0])[0], cy = (top + low) / 2;
  const at = {
    nose: best(p => p[0] - Math.abs(p[1] - cy) * 0.2), snout: best(p => p[0] - p[1] * 0.3),
    head: best(p => p[1], pts.filter(p => p[0] > maxU - 0.18)), tail: best(p => -p[0]),
    foot: best(p => -p[1] - Math.abs(p[0] - 0.55) * 0.3), back: best(p => p[1], pts.filter(p => Math.abs(p[0] - (minU + maxU) / 2) < 0.08)),
    body: [(minU + maxU) / 2, cy],
  };
  const fs = 0.065 * Math.max(maxU - minU, top - low), used = []; // 키 큰 동물도 글씨가 같은 크기로 보이게
  const labels = items.map((t, k) => {
    const where = PART_AT.find(([re]) => re.test(t))?.[1] ?? 'body', [u, v] = at[where] ?? at.body;
    const up = v >= cy || where === 'back' || where === 'head', n = used.filter(w => w === up).length;
    used.push(up);
    const ly = up ? top + fs * (1.6 + n * 1.6) : low - fs * (2 + n * 1.6), lx = Math.min(maxU - fs * 2, Math.max(minU + fs * 2, u + (n % 2 ? 1 : -1) * fs * 2.5));
    return `<line x1="${u}" y1="${-v}" x2="${lx}" y2="${-ly + (up ? fs * 0.4 : -fs)}" class="pline"/><circle cx="${u}" cy="${-v}" r="${fs * 0.25}" class="pdot"/>`
      + `<text x="${lx}" y="${-ly}" font-size="${fs}" text-anchor="middle" class="ptxt">${t}</text>`;
  });
  fitSvg(svg, drawAnimal(a) + labels.join(''), 0.04);
}

// 두 동물 나란히 비교(공부 탭): 몸길이·몸무게는 막대(큰 쪽이 꽉 참), 살았던 때·먹이는 글로
function compareHtml(A, B) {
  const bar = (k, fmt) => { const m = Math.max(k(A), k(B)); return [A, B].map((a, i) => `<div class="cbar p${i + 1}"><i style="width:${Math.max(4, (k(a) / m) * 100)}%"></i><span>${a.name_ko} ${fmt(a)}</span></div>`).join(''); };
  const txt = (f) => [A, B].map((a, i) => `<span class="p${i + 1}">${a.name_ko}: ${f(a) || '?'}</span>`).join('');
  return `<div class="cmp"><h2>⚖️ 둘을 비교해요</h2>
    <h3>📏 몸길이</h3>${bar(a => a.length_m.avg, a => sizeLike(a.length_m.avg))}
    <h3>🏋️ 몸무게</h3>${bar(a => Math.sqrt(a.mass_kg.avg), a => (a.mass_kg.avg >= 1 ? weightLike(a.mass_kg.avg) : '아주 가벼워요'))}
    <h3>⏳ 살았던 때</h3><p class="ctxt">${txt(a => a.era)}</p>
    <h3>🍽️ 먹이</h3><p class="ctxt">${txt(a => a.diet)}</p></div>`;
}
const bookPic = a => (a.book ? `<img class="bookpic" src="${import.meta.env.BASE_URL}book/${a.id}.jpg" alt="${a.name_ko}" onerror="this.remove()">` : '');

// 결과: 탭 둘 — 🏆 결과(누가 왜 이겼나, 예측, 다시 하기) / 📒 공룡 공부(두 동물 도감·비교·이긴 이유 전부·만약에·예상 승률). ←/→ 키로도 넘긴다
function result(A, B, res, votes) {
  const [W, L] = res.winner === 0 ? [A, B] : [B, A];
  const pA = Math.round(res.P * 100); // 이 판과 같은 조건(사건 켬/끔)으로 미리 계산한 승률
  const lines = reasonLines(W, L, res.reasons, stage);
  const reason = i => `<li><span>${iconOf(res.reasons[i], stage)}</span>${lines[i]}</li>`;
  app.innerHTML = `<nav class="rtabs"><button class="rtab on" data-t="win">🏆 결과</button><button class="rtab" data-t="learn">📒 공룡 공부</button></nav>
  <div class="result rpane" data-p="win">
    <div class="left"><div class="podium"><span class="ribbon">${res.ko ? 'K.O. 승리!' : '승리!'}</span>${W.archetype === 'human' ? '' : bookPic(W)}<svg class="scene"></svg><b>${W.name_ko}</b></div></div>
    <div class="why">
      <h1>${ga(W.name_ko)} 이겼어요!</h1>
      <ul class="reasons top">${reason(0)}</ul>
      ${predictionHtml(A, B, res, votes)}
      <div class="buttons"><button class="again">🔁 같은 동물로 다시</button><button class="other">🦖 다른 동물 고르기</button></div>
      <button class="tolearn">📒 두 공룡 더 알아보기 →</button>
    </div></div>
  <div class="learn rpane" data-p="learn" hidden>
    <div class="lpair">${[A, B].map(a => `<div class="lcard">${a.archetype === 'human' ? `<svg class="scene charpic" data-id="${a.id}"></svg>` : bookPic(a)}${kindHtml(a)}${dexHtml(a)}${friendsHtml(a, [A, B])}</div>`).join('')}</div>
    <div class="lsec"><h2>🔍 몸 구석구석</h2><div class="lpair"><svg class="parts"></svg><svg class="parts"></svg></div></div>
    <div class="lsec"><h2>🧍 나와 크기 비교</h2><svg class="lsize"></svg></div>
    ${compareHtml(A, B)}
    <div class="whyall"><h2>🤔 ${ga(W.name_ko)} 이긴 까닭</h2><ul class="reasons">${res.reasons.map((_, i) => reason(i)).join('')}</ul>
      ${res.upset ? `<p class="upset">🎲 이번에는 ${ga(W.name_ko)} 뒤집었어요! 다시 하면 결과가 바뀔 수도 있어요.</p>` : ''}</div>
    ${whatIfHtml(A, B)}
    <div class="odds"><p>${STAGES[stage].emoji} ${STAGES[stage].name}에서 싸우기 전 예상</p>
      <div class="oddbar"><i style="width:${pA}%">${A.name_ko} ${pA}%</i><i style="width:${100 - pA}%">${B.name_ko} ${100 - pA}%</i></div></div>
  </div>`;
  fitSvg(app.querySelector('svg'), mini(W));
  // 공부 탭 그림은 탭을 처음 열 때 그린다(숨긴 채로는 그림 크기를 잴 수 없다)
  let drawn = false;
  const drawLearn = () => { if (drawn) return; drawn = true; app.querySelectorAll('.charpic').forEach(el => fitSvg(el, mini([A, B].find(a => a.id === el.dataset.id)))); app.querySelectorAll('.parts').forEach((el, i) => partsFill(el, [A, B][i])); fitSvg(app.querySelector('.lsize'), sizeScene(A, B), 0.04); };
  const show = t => { app.querySelectorAll('.rtab').forEach(b => b.classList.toggle('on', b.dataset.t === t)); app.querySelectorAll('.rpane').forEach(p => (p.hidden = p.dataset.p !== t)); if (t === 'learn') drawLearn(); scrollTo(0, 0); };
  app.querySelectorAll('.rtab').forEach(b => (b.onclick = () => show(b.dataset.t)));
  app.querySelector('.tolearn').onclick = () => show('learn');
  app.querySelector('.again').onclick = () => fight(A, B, votes);
  app.querySelector('.other').onclick = () => pick([A, B]);
}

// AI로 찾아 둔 동물(서버 캐시)을 먼저 불러온다. 서버가 없으면 빈 목록
addAnimals(await loadAiAnimals());

// #result=id,id: 결과 화면만, #block(=id,id…): 블록 3D 돌려 보기, #gallery: 그림 확인, #model=mosasaurus: 2D↔3D 비교, #templates: 3D 체형 틀, #fight=tyrannosaurus,triceratops(&s=jungle&m=tail): 바로 배틀, 무대·공격 움직임 고정(확인용)
const fightIds = location.hash.match(/^#fight=(\w+),(\w+)/)?.slice(1).map(id => animals.find(a => a.id === id));
const modelId = location.hash.match(/^#model=(\w+)/)?.[1];
if (location.hash.startsWith('#block')) showBlocks(app);
else if (location.hash === '#gallery') showGallery(app);
else if (location.hash === '#sounds') showSounds(app);
else if (location.hash === '#boss') riddle();
else if (location.hash.startsWith('#templates')) showTemplates(app);
else if (modelId) showModel(app, animals.find(a => a.id === modelId));
else if (location.hash.startsWith('#result=')) { // #result=tyrannosaurus,triceratops: 배틀 없이 결과 화면만(확인용)
  const [A, B] = location.hash.slice(8).split('&')[0].split(',').map(id => animals.find(a => a.id === id));
  result(A, B, battle(A, B, stage, Math.random, true, { events }), null);
  if (location.hash.includes('&learn')) app.querySelector('.rtab[data-t="learn"]').click(); // &learn: 공부 탭부터
} else if (fightIds?.every(Boolean)) {
  stage = location.hash.match(/&s=(\w+)/)?.[1] ?? stage;
  fight(...fightIds, null, prepare(...fightIds, location.hash.match(/&m=(\w+)/)?.[1]));
} else pick();

// 키보드: Enter = 다음/시작, Esc = 뒤로 (교사가 키보드로 넘길 수 있게)
document.addEventListener('keydown', e => {
  if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && app.querySelector('.rtabs')) return app.querySelector(`.rtab[data-t="${e.key === 'ArrowRight' ? 'learn' : 'win'}"]`).click(); // 결과 탭 넘기기
  const btn = app.querySelector(e.key === 'Enter' ? '.next:not(:disabled), .go:not(:disabled), .again' : e.key === 'Escape' ? '.back, .other' : null);
  if (btn) { e.preventDefault(); btn.click(); }
});

// 소리: 첫 클릭 때 켜고(브라우저 규칙), 버튼마다 딸깍. 오른쪽 아래 버튼으로 끄고 켠다
document.addEventListener('pointerdown', e => { unlock(); if (e.target.closest('button')) sfx.click(); });
const mute = document.body.appendChild(Object.assign(document.createElement('button'), { className: 'mute', title: '소리 끄기/켜기' }));
const showMute = () => (mute.textContent = isMuted() ? '🔇' : '🔊');
mute.onclick = () => { setMuted(!isMuted()); showMute(); };
showMute();
// 배경음악만 따로 끄고 켜기(기본 켜짐)
const tune = document.body.appendChild(Object.assign(document.createElement('button'), { className: 'mute tune', title: '배경음악 끄기/켜기', textContent: '🎵' }));
const showTune = () => tune.classList.toggle('off', !isMusicOn());
tune.onclick = () => { setMusicOn(!isMusicOn()); showTune(); };
showTune();
// 자연 사건 켜고 끄기(기본 켜짐)
const evBtn = document.body.appendChild(Object.assign(document.createElement('button'), { className: 'mute evt', title: '자연 사건(소나기·화산·운석) 켜기/끄기', textContent: '🌋' }));
const showEv = () => evBtn.classList.toggle('off', !events);
evBtn.onclick = () => { events = !events; try { localStorage.setItem('dino-events', events ? '1' : '0'); } catch { /* 이번 화면에서만 */ } showEv(); };
showEv();
// 전체화면(TV·전자칠판용). Esc로 나가도 버튼 모양이 따라 바뀐다
const fsBtn = document.body.appendChild(Object.assign(document.createElement('button'), { className: 'mute fs', title: '전체화면 켜기/끄기' }));
const showFs = () => (fsBtn.textContent = document.fullscreenElement ? '🗗' : '⛶');
fsBtn.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
document.addEventListener('fullscreenchange', showFs);
showFs();
