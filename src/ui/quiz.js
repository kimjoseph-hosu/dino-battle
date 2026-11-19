// 🧭 공룡 탐험대: 무대 다섯 곳을 지나며 퀴즈를 풀고 알을 모은다 → 마지막 그림자 보스 → 모은 동물 중 하나로 보스 배틀.
// 선생님은 누르기만, 아이들은 소리 질러 맞힌다. 문제·힌트는 읽어 준다. 틀려도 "아니에요!" 하고 힌트가 하나 더(떨어지지 않음)
// 키보드: 1~4 고르기, 스페이스 다음 힌트(다시 듣기), Enter 다음
import { drawAnimal } from '../art/index.js';
import { adventure, makeQuestion } from '../engine/quiz.js';
import { kindLine } from '../engine/riddle.js';
import { ga, neun } from '../engine/story.js';
import { STAGES } from '../config.js';
import { fitSvg } from './scene.js';
import { sfx, isMuted } from './sfx.js';
import { quizStage } from './quizstage.js';

const mini = a => `<g transform="scale(${a.length_m.avg})">${drawAnimal(a)}</g>`;
const card = (a, i) => `<button class="qc" data-i="${i}"><kbd>${i + 1}</kbd><svg class="scene"></svg><b>${a.name_ko}</b><em></em></button>`;

// 브라우저 읽어 주기(글을 못 읽는 아이도 듣게). queue 면 앞 말을 끊지 않고 이어서
export function speak(text, queue = false) {
  const s = globalThis.speechSynthesis;
  if (!s || isMuted()) return;
  if (!queue) s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 0.9;
  s.speak(u);
}
const hush = () => globalThis.speechSynthesis?.cancel();
let keys = () => {};

// duel(A, B, stage) → 이긴 쪽 번호(배틀을 보여 주고 돌아온다), bossFight(A, boss, stage) → 보통 배틀·결과 화면으로, home → 첫 화면
// first: 첫 문제 종류를 정한다(확인용 #quiz=winner)
export function showQuiz(root, list, { duel, bossFight, home, first }) {
  const qs = adventure(list);
  if (first) qs[0] = makeQuestion(first, list, qs[0].stage) ?? qs[0];
  const eggs = []; // 탐험에서 만난 동물(보스와 싸울 후보)
  let k = 0;

  const eggRow = () => qs.map((q, i) => `<span class="egg${i < eggs.length ? ' got' : ''}${i === k ? ' now' : ''}">${i === qs.length - 1 ? '👑' : '🥚'}${i < eggs.length ? '<svg class="scene"></svg>' : ''}</span>`).join('');
  const frame = (q, body) => {
    const st = STAGES[q.stage];
    root.innerHTML = `<div class="quiz">
      <header class="qhead"><h1>🧭 공룡 탐험대</h1><span class="where">${st.emoji} ${st.name}${q.type === 'shadow' ? ' · 👑 보스' : ` · ${k + 1}번째 탐험`}</span><div class="eggs">${eggRow()}</div></header>
      <div class="qbody"><div class="qstage"><div class="qcover"></div></div><div class="qside"><p class="qprompt">${q.prompt}</p><div class="qhints"></div>${body}</div></div>
      <nav><button class="back">← 그만하기</button><button class="say">🔈 다시 듣기</button><button class="qhint">💡 힌트</button><button class="next" hidden>다음 탐험 →</button></nav></div>`;
    root.querySelectorAll('.eggs .got svg').forEach((svg, i) => fitSvg(svg, mini(eggs[i])));
    root.querySelector('.back').onclick = () => { hush(); home(); };
    return quizStage(root.querySelector('.qstage'), q.stage);
  };
  const $ = s => root.querySelector(s);
  const cardsSvg = choices => root.querySelectorAll('.qc svg').forEach((svg, i) => fitSvg(svg, mini(choices[i])));
  // 맞힘: 알 하나 + 무대에서 정체 공개(색·포효) + 한 줄 + 다음 버튼
  const reveal = (q, S, found, line) => {
    eggs.push(found);
    root.querySelectorAll('.qc, .qyn').forEach(b => (b.disabled = true));
    $('.eggs').innerHTML = eggRow();
    root.querySelectorAll('.eggs .got svg').forEach((svg, i) => fitSvg(svg, mini(eggs[i])));
    root.querySelectorAll('.eggs .egg')[eggs.length - 1]?.classList.add('pop');
    $('.qcover').classList.add('off');
    $('.qprompt').textContent = line;
    $('.qhint').hidden = true;
    sfx.fanfare();
    setTimeout(() => sfx.voice(found), 500);
    speak(`맞았어요! ${line}`);
    if (S) { S.silhouette(false); S.setMist(0); S.wide(); setTimeout(() => S.roar(), 400); }
    const next = $('.next');
    next.hidden = false;
    if (q.type === 'shadow') { next.textContent = '⚔️ 보스와 싸우기 →'; next.onclick = () => { hush(); finale(found, q.stage); }; }
    else next.onclick = () => { hush(); k++; run(); };
  };
  // 틀림: 그 보기만 흐리게 "아니에요!" + 힌트 하나 더
  const nope = (b, a, more) => {
    b.disabled = true;
    b.classList.add('no');
    b.querySelector('em').textContent = '아니에요!';
    sfx.drum();
    speak(a ? `${ga(a.name_ko)} 아니에요!` : '아니에요!');
    more?.();
  };

  function run() {
    const q = qs[k];
    ({ shadow, sound, zoom, bigger, dino, winner }[q.type])(q);
  }

  // 그림자 보스: 안개 속 까만 그림자가 걸어 나온다. 힌트마다 안개가 걷히고 힌트 글이 하나씩
  function shadow(q) {
    const S = frame(q, `<div class="qcards c4">${q.choices.map(card).join('')}</div>`);
    cardsSvg(q.choices);
    let n = 0;
    S?.put([q.answer]);
    S?.silhouette(true);
    S?.jumpMist(1);
    S?.walkIn();
    sfx.voice(q.answer, true);
    const hint = () => {
      if (n >= q.hints.length) return speak(q.hints.map(h => h.text).join('. '));
      const h = q.hints[n++];
      $('.qhints').insertAdjacentHTML('beforeend', `<span class="chip">${h.icon} ${h.text}</span>`);
      S?.setMist(1 - n / (q.hints.length + 1));
      speak(h.text, true);
    };
    $('.qhint').onclick = hint;
    $('.say').onclick = () => speak([q.prompt, ...q.hints.slice(0, n).map(h => h.text)].join('. '));
    root.querySelectorAll('.qc').forEach(b => (b.onclick = () => {
      const a = q.choices[+b.dataset.i];
      if (a === q.answer) reveal(q, S, a, `정체는 ${a.name_ko}!`);
      else nope(b, a, hint);
    }));
    speak(q.prompt);
    setTimeout(hint, 2600);
  }

  // 울음소리: 무대는 안개로 가려 두고 소리만. 맞히면 안개가 걷히며 그 동물이 포효
  function sound(q) {
    const S = frame(q, `<div class="qcards c3">${q.choices.map(card).join('')}</div>`);
    cardsSvg(q.choices);
    $('.qcover').innerHTML = '<span>🔊</span>';
    S?.put([q.answer]);
    S?.jumpMist(1);
    const play = () => sfx.voice(q.answer);
    $('.qhint').textContent = '🔊 한 번 더 듣기';
    $('.qhint').onclick = play;
    $('.say').onclick = () => { speak(q.prompt); setTimeout(play, 1800); };
    root.querySelectorAll('.qc').forEach(b => (b.onclick = () => {
      const a = q.choices[+b.dataset.i];
      if (a === q.answer) reveal(q, S, a, `이 소리는 ${a.name_ko}!`);
      else nope(b, a, () => setTimeout(play, 900));
    }));
    speak(q.prompt);
    setTimeout(play, 1800);
  }

  // 아주 가까이: 몸 한 곳을 확대해 보여 주고, 힌트마다 카메라가 물러난다
  function zoom(q) {
    const S = frame(q, `<div class="qcards c4">${q.choices.map(card).join('')}</div>`);
    cardsSvg(q.choices);
    const steps = [0, 0.18, 0.45, 0.8];
    let n = 0;
    S?.put([q.answer]);
    S?.zoomTo(q.part, steps[0]);
    const hint = () => { if (n < steps.length - 1) { S?.zoomTo(q.part, steps[++n]); sfx.bell(); } speak(n < steps.length - 1 ? '조금 더 멀리서 볼까요?' : '거의 다 보여요!'); };
    $('.qhint').onclick = hint;
    $('.say').onclick = () => speak(q.prompt);
    root.querySelectorAll('.qc').forEach(b => (b.onclick = () => {
      const a = q.choices[+b.dataset.i];
      if (a === q.answer) reveal(q, S, a, `${neun(a.name_ko)} 이렇게 생겼어요!`);
      else nope(b, a, hint);
    }));
    speak(q.prompt);
  }

  // 누가 더 클까: 무대는 가려 두고 고르게 → 정답이면 두 동물을 실제 크기 비율로 나란히
  function bigger(q) {
    const S = frame(q, `<div class="qcards c2">${q.choices.map(card).join('')}</div>`);
    cardsSvg(q.choices);
    $('.qcover').innerHTML = '<span>❓</span>';
    $('.qhint').hidden = true;
    $('.say').onclick = () => speak(q.prompt);
    root.querySelectorAll('.qc').forEach(b => (b.onclick = () => {
      const a = q.choices[+b.dataset.i], small = q.choices.find(c => c !== q.answer);
      S?.put(q.choices);
      if (a === q.answer) reveal(q, S, a, `${ga(a.name_ko)} ${small.name_ko}보다 훨씬 커요!`);
      else { nope(b, a); $('.qcover').classList.add('off'); S?.wide(); setTimeout(() => root.querySelector(`.qc:not(:disabled)`)?.click(), 2200); } // 틀려도 크기를 보여 주고 정답으로
    }));
    speak(q.prompt);
  }

  // 공룡일까: 동물을 보여 주고 🙆 / 🙅
  function dino(q) {
    const a = q.animal;
    const S = frame(q, `<div class="qcards c2 yn"><button class="qyn" data-v="1"><kbd>1</kbd>🙆<b>공룡이에요</b><em></em></button><button class="qyn" data-v="0"><kbd>2</kbd>🙅<b>공룡이 아니에요</b><em></em></button></div>`);
    S?.put([a]);
    S?.walkIn(1800);
    $('.qhint').hidden = true;
    $('.say').onclick = () => speak(q.prompt);
    root.querySelectorAll('.qyn').forEach(b => (b.onclick = () => {
      if (!!+b.dataset.v === q.answer) reveal(q, S, a, kindLine(a).text.replace(/^[^가-힣]+/, ''));
      else nope(b, null);
    }));
    speak(q.prompt);
  }

  // 누가 이길까: 고르면 진짜 배틀을 보고 돌아온다. 맞히든 틀리든 이긴 동물의 알을 얻는다
  function winner(q) {
    const S = frame(q, `<div class="qcards c2">${q.choices.map(card).join('')}</div>`);
    cardsSvg(q.choices);
    S?.put(q.choices);
    $('.qhint').hidden = true;
    $('.say').onclick = () => speak(q.prompt);
    root.querySelectorAll('.qc').forEach(b => (b.onclick = async () => {
      const guess = +b.dataset.i;
      hush();
      const w = await duel(q.choices[0], q.choices[1], q.stage);
      const W = q.choices[w];
      // 배틀 화면에서 돌아와 다시 그린다
      const S2 = frame(q, `<div class="qcards c2">${q.choices.map(card).join('')}</div>`);
      cardsSvg(q.choices);
      S2?.put([W]);
      const right = guess === w;
      root.querySelectorAll('.qc').forEach((c, i) => c.classList.toggle(i === w ? 'yes' : 'no', true));
      reveal(q, S2, W, `${ga(W.name_ko)} 이겼어요!${right ? '' : ' 다음엔 맞힐 수 있어요!'}`);
      if (!right) $('.qprompt').textContent = `${ga(W.name_ko)} 이겼어요!`;
    }));
    speak(q.prompt);
  }

  // 마지막: 탐험에서 만난 동물 중 하나를 골라 보스와 배틀
  function finale(boss, stage) {
    const team = eggs.slice(0, -1);
    root.innerHTML = `<div class="quiz"><header class="qhead"><h1>👑 ${boss.name_ko}에게 도전!</h1><span class="where">탐험에서 만난 친구 중에서 골라요</span></header>
      <div class="qcards c${team.length} team">${team.map(card).join('')}</div>
      <nav><button class="back">← 그만하기</button></nav></div>`;
    cardsSvg(team);
    root.querySelector('.back').onclick = () => { hush(); home(); };
    root.querySelectorAll('.qc').forEach(b => (b.onclick = () => { hush(); bossFight(team[+b.dataset.i], boss, stage); }));
    speak(`누가 ${boss.name_ko}와 싸울까요?`);
  }

  // 키보드: 1~4 보기, 스페이스 힌트(퀴즈 화면일 때만). 새 탐험을 시작하면 앞 판 것은 뗀다
  document.removeEventListener('keydown', keys);
  keys = e => {
    if (!root.querySelector('.quiz')) return;
    if (/^[1-4]$/.test(e.key)) root.querySelectorAll('.qc:not(:disabled), .qyn:not(:disabled)').forEach(b => b.querySelector('kbd')?.textContent === e.key && b.click());
    if (e.key === ' ') { e.preventDefault(); const h = root.querySelector('.qhint:not([hidden])'); (h ?? root.querySelector('.say'))?.click(); }
  };
  document.addEventListener('keydown', keys);
  run();
}
