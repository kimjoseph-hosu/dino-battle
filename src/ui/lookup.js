// 모르는 동물 찾기 (PLAN 8.1-1): 이름 → AI가 크기·특성 초안 → "AI가 찾은 정보예요" → 선생님이 확인·고쳐서 저장
// AI에는 동물 이름(글자)만 보낸다.
import { drawAnimal } from '../art/index.js';
import { findAnimal, addAnimals } from '../data.js';
import { lookup, saveAnimal, teacherPw } from '../ai.js';
import { fitSvg } from './scene.js';

export const AI_ERRORS = {
  nokey: 'AI 키가 아직 없어요. (.env 파일에 GEMINI_API_KEY를 넣고 다시 켜 주세요)',
  locked: '선생님 암호가 맞지 않아요. 다시 눌러서 암호를 넣어 주세요.',
  busy: 'AI가 지금 바빠요. 잠시 뒤에 다시 눌러 주세요.',
  unknown: '그런 동물은 찾지 못했어요. 이름을 다시 확인해 주세요.',
  failed: 'AI가 대답을 못 했어요. 다시 눌러 보거나 목록에서 골라 주세요.',
  offline: 'AI에 연결할 수 없어요. 인터넷을 확인해 주세요.',
};
const HABITAT = { land: '땅', sea: '바다', freshwater: '강·호수', air: '하늘', amphibious: '물가' };

// 이름으로 찾기 → { animal } | { error }. 이미 있는 동물이면 AI를 부르지 않는다
export async function findOrLookup(name) {
  const have = findAnimal(name);
  if (have) return { animal: have, existing: true };
  let r = await lookup(name);
  if (r.error === 'locked') { // 암호가 없거나 틀리면 한 번 물어보고 다시 해 본다
    const v = prompt('선생님 암호를 넣어 주세요');
    if (!v) return r;
    teacherPw.set(v.trim());
    r = await lookup(name);
    if (r.error === 'locked') teacherPw.set('');
  }
  if (r.animal) addAnimals([r.animal]);
  return r;
}

export function showLookup(root, { done, cancel }) {
  root.innerHTML = `<header class="step"><h1>🔎 다른 동물 찾기</h1><p>목록에 없는 동물 이름을 쓰면 AI가 크기와 특징을 찾아 줘요. 선생님이 확인해 주세요.</p></header>
    <div class="lookup">
      <div class="ask"><input class="name" placeholder="예: 코끼리, 메갈로돈" autocomplete="off"><button class="find">AI로 찾기</button></div>
      <p class="msg"></p>
      <div class="preview" hidden>
        <svg class="scene"></svg>
        <div class="facts1"><span class="badge">🤖 AI가 찾은 정보예요 — 맞는지 확인해 주세요</span>
          <b class="nm"></b><p class="meta"></p>
          <label>📏 몸길이(m) <input class="len" type="number" min="0.01" max="60" step="any"></label>
          <label>⚖️ 몸무게(kg) <input class="kg" type="number" min="0.001" max="200000" step="any"></label>
          <label>🏠 사는 곳 <select class="hab">${Object.entries(HABITAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        </div>
      </div>
    </div>
    <nav><button class="back">← 취소</button><button class="next" disabled>확인했어요, 고르러 가기</button></nav>`;
  const $ = s => root.querySelector(s);
  let found = null;

  const find = async () => {
    const q = $('.name').value.trim();
    if (!q) return;
    $('.find').disabled = true;
    $('.msg').textContent = '🔎 찾는 중이에요…';
    const r = await findOrLookup(q);
    $('.find').disabled = false;
    if (!r.animal) { $('.msg').textContent = AI_ERRORS[r.error] ?? AI_ERRORS.failed; return; }
    found = r.animal;
    $('.msg').textContent = r.existing ? '📚 이미 목록에 있는 동물이에요!' : '';
    $('.preview').hidden = false;
    $('.badge').hidden = r.existing;
    $('.nm').textContent = found.name_ko;
    $('.meta').textContent = `${found.era} · ${found.place} · ${found.diet}${found.fun_fact ? ` — ${found.fun_fact}` : ''}`;
    $('.len').value = found.length_m.avg;
    $('.kg').value = found.mass_kg.avg;
    $('.hab').value = found.habitat;
    [$('.len'), $('.kg'), $('.hab')].forEach(el => (el.disabled = r.existing));
    fitSvg($('svg'), `<g transform="scale(${found.length_m.avg})">${drawAnimal(found)}</g>`);
    $('.next').disabled = false;
  };
  $('.find').onclick = find;
  $('.name').onkeydown = e => { if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); find(); } };
  $('.back').onclick = cancel;
  $('.next').onclick = async () => {
    const edit = { id: found.id, length_avg: +$('.len').value, mass_avg: +$('.kg').value, habitat: $('.hab').value };
    const changed = found.origin === 'ai_estimated' && (edit.length_avg !== found.length_m.avg || edit.mass_avg !== found.mass_kg.avg || edit.habitat !== found.habitat);
    if (changed) {
      const r = await saveAnimal(edit);
      if (r.animal) Object.assign(found, r.animal); // 같은 객체를 고쳐서 목록에도 반영
    }
    done(found);
  };
  $('.name').focus();
}
