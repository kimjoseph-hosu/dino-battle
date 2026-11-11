// 아이 그림 추가 (PLAN 7.2): 사진 올리기 → 배경 지우기(브라우저 안) → 머리 방향 맞추기 → 동물 이름 → 저장
// 개인정보: 사진은 이 브라우저 안에서만 쓴다. 어디에도 보내지 않고, 아이 이름은 받지 않는다.
import { animals, findAnimal, inBooksOnly } from '../data.js';
import { removeBackground, shapeMask, flipX } from '../art/photo.js';
import { findOrLookup, AI_ERRORS } from './lookup.js';

const MAX_SIDE = 700; // 처리할 사진 크기(긴 변). 클수록 느리다
let count = 0;

export function showDrawing(root, { save, cancel }) {
  root.innerHTML = `<header class="step"><h1>✏️ 내 그림 추가</h1><p>그림을 찍은 사진을 올려 주세요. 사진은 이 컴퓨터 밖으로 나가지 않아요.</p></header>
    <div class="draw">
      <label class="drop"><input type="file" accept="image/*" capture="environment" hidden>
        <canvas></canvas><span class="empty">📷 여기를 눌러 사진 고르기<br><small>(또는 사진을 끌어다 놓기)</small></span></label>
      <div class="controls">
        <label>🧽 배경 지우기 <input class="strength" type="range" min="0" max="100" value="50"><small>그림까지 지워지면 왼쪽으로, 종이가 남으면 오른쪽으로</small></label>
        <button class="flip">↔️ 좌우 뒤집기</button><small>머리가 <b>오른쪽</b>을 보게 맞춰 주세요 👉</small>
        <label>🦖 무슨 동물이에요?
          <input class="name" list="animal-names" placeholder="예: 티라노사우루스" autocomplete="off">
          <datalist id="animal-names">${animals.map(a => `<option value="${a.name_ko}">`).join('')}</datalist></label>
        <p class="found"></p>
      </div>
    </div>
    <nav><button class="back">← 취소</button><button class="next" disabled>저장하고 고르러 가기</button></nav>`;
  const $ = s => root.querySelector(s);
  const canvas = $('canvas'), file = $('input[type=file]'), save$ = $('.next');
  let src = null, cut = null, flipped = false, base = null;

  const render = () => {
    if (!src) return;
    cut = removeBackground(src, $('.strength').value / 100);
    if (cut && flipped) cut = flipX(cut);
    $('.empty').hidden = true;
    if (!cut) { canvas.width = canvas.height = 1; return refresh(); }
    canvas.width = cut.width;
    canvas.height = cut.height;
    canvas.getContext('2d').putImageData(new ImageData(cut.data, cut.width, cut.height), 0, 0);
    refresh();
  };
  const refresh = () => {
    const q = $('.name').value;
    base = findAnimal(q);
    $('.found').innerHTML = !q.trim() ? ''
      : base ? `✅ <b>${base.name_ko}</b>: ${base.size_raw} · ${base.mass_raw}<br><small>그림을 이 크기로 맞춰서 싸워요</small>`
      : inBooksOnly(q) ? '📚 백과에는 있지만 아직 싸울 준비가 안 된 동물이에요. (전체 동물은 곧 추가돼요)'
      : '🤔 아직 모르는 동물이에요. <button class="ai-find">🔎 AI로 찾아보기</button>';
    save$.disabled = !(cut && base);
    const ai = $('.ai-find');
    if (ai) ai.onclick = async () => {
      ai.disabled = true;
      ai.textContent = '🔎 찾는 중…';
      const r = await findOrLookup(q);
      if (!r.animal) { $('.found').textContent = AI_ERRORS[r.error] ?? AI_ERRORS.failed; return; }
      $('.name').value = r.animal.name_ko;
      refresh();
      if (!r.existing) $('.found').insertAdjacentHTML('beforeend', '<br><small>🤖 AI가 찾은 정보예요. 크기가 이상하면 "다른 동물 찾기"에서 고칠 수 있어요</small>');
    };
  };
  const load = f => {
    if (!f?.type.startsWith('image/')) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, c.width, c.height);
      src = g.getImageData(0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      render();
    };
    img.src = url;
  };

  file.onchange = () => load(file.files[0]);
  const drop = $('.drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); };
  $('.strength').oninput = render;
  $('.flip').onclick = () => { flipped = !flipped; render(); };
  $('.name').oninput = refresh;
  $('.back').onclick = cancel;
  save$.onclick = () => canvas.toBlob(blob => {
    const id = `drawing-${++count}`;
    save({
      ...base, id, name_ko: `${base.name_ko}(그림)`, origin: 'drawing', alias: undefined,
      drawing: { url: URL.createObjectURL(blob), aspect: cut.height / cut.width, ...shapeMask(cut) },
    });
  }, 'image/png');
}
