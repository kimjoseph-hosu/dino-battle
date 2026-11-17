// 수수께끼 보스 화면: 그림자 보스 + 후보 넷. 힌트를 소리 내어 읽어 주고, 힌트마다 그림자가 또렷해진다.
// 아이들이 외치면 선생님은 후보를 누르기만 한다(틀리면 "아니에요!" 하고 다음 힌트). 맞히면 정체가 드러나고 배틀로
import { drawAnimal } from '../art/index.js';
import { bossHints, suspects } from '../engine/riddle.js';
import { ga, neun } from '../engine/story.js';
import { fitSvg } from './scene.js';
import { sfx, isMuted } from './sfx.js';

const mini = a => `<g transform="scale(${a.length_m.avg})">${drawAnimal(a)}</g>`;

// 브라우저 읽어 주기(글을 못 읽는 아이도 혼자 듣게). queue 면 앞 말을 끊지 않고 이어서
export function speak(text, queue = false) {
  const s = globalThis.speechSynthesis;
  if (!s || isMuted()) return;
  if (!queue) s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 0.9;
  s.speak(u);
}

export function showBoss(root, boss, list, { fight, again, back }) {
  const hints = bossHints(boss), cands = suspects(boss, list);
  let shown = 0;
  root.innerHTML = `<header class="step"><h1>🕵️ 수수께끼 보스</h1><p>보스가 다가와요! 힌트를 듣고 누군지 맞혀 봐요</p></header>
    <div class="riddle"><div class="shadow"><svg class="scene"></svg><span class="q">?</span></div><ol class="hints"></ol></div>
    <div class="suspects">${cands.map((a, i) => `<button data-i="${i}"><svg class="scene"></svg><b>${a.name_ko}</b><em></em></button>`).join('')}</div>
    <nav><button class="back">← 처음으로</button><button class="say">🔈 다시 듣기</button><button class="next">다음 힌트 →</button></nav>`;
  const shadow = root.querySelector('.shadow'), ol = root.querySelector('.hints'), next = root.querySelector('.next');
  fitSvg(shadow.querySelector('svg'), mini(boss));
  root.querySelectorAll('.suspects svg').forEach((svg, i) => fitSvg(svg, mini(cands[i])));

  const hint = (queue = false) => {
    if (shown >= hints.length) return;
    const h = hints[shown++];
    ol.insertAdjacentHTML('beforeend', `<li><span>${h.icon}</span>${h.text}</li>`);
    shadow.style.setProperty('--k', shown / hints.length); // 힌트가 늘수록 그림자가 또렷해진다
    speak(h.text, queue);
    if (shown >= hints.length) { next.disabled = true; next.textContent = '힌트 끝! 골라 봐요'; }
  };
  const reveal = () => {
    shadow.classList.add('out');
    root.querySelector('.step h1').textContent = `정체는 ${boss.name_ko}!`;
    root.querySelector('.step p').textContent = `${neun(boss.name_ko)} 이제 도전자를 기다려요`;
    root.querySelectorAll('.suspects button').forEach((b, i) => { b.disabled = true; b.classList.toggle('yes', cands[i] === boss); });
    root.querySelector('nav').innerHTML = '<button class="back">🔁 다른 보스</button><button class="next go">⚔️ 보스와 싸울 동물 고르기</button>';
    root.querySelector('nav .back').onclick = again;
    root.querySelector('nav .next').onclick = () => { globalThis.speechSynthesis?.cancel(); fight(boss); };
    sfx.voice(boss);
    speak(`맞았어요! 정체는 ${boss.name_ko}!`);
  };
  root.querySelectorAll('.suspects button').forEach(b => (b.onclick = () => {
    const a = cands[+b.dataset.i];
    if (a === boss) return reveal();
    b.disabled = true;
    b.classList.add('no');
    b.querySelector('em').textContent = '아니에요!';
    speak(`${ga(a.name_ko)} 아니에요!`);
    if (cands.filter((c, i) => !root.querySelector(`.suspects [data-i="${i}"]`).disabled).length === 1) return setTimeout(reveal, 900); // 하나만 남으면 그게 보스
    hint(true);
  }));
  next.onclick = () => hint();
  root.querySelector('.say').onclick = () => speak(hints.slice(0, shown).map(h => h.text).join('. '));
  root.querySelector('.back').onclick = () => { globalThis.speechSynthesis?.cancel(); back(); };
  hint();
}
