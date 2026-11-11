// 무대 고르기 (PLAN 3·2): 초원 / 정글 / 물가 / 물속. 카드마다 실제 무대 그림을 작게 보여준다.
import { STAGES } from '../config.js';
import { STAGE_ART } from './stage.js';

export function showStagePick(root, A, B, current, { next, back }) {
  const W = 16, H = 9;
  root.innerHTML = `<header class="step"><h1>어디서 싸울까?</h1><p>${A.name_ko} 대 ${B.name_ko}, 어디서 만날까요?</p></header>
    <div class="stages">${Object.entries(STAGES).map(([key, s]) => {
      const sc = STAGE_ART[key].build(W, H);
      return `<button class="stagecard sky-${key}${key === current ? ' on next' : ''}" data-key="${key}">
        <svg viewBox="${-W / 2} ${-H * 0.8} ${W} ${H}" preserveAspectRatio="xMidYMid slice">${sc.back}${sc.ground}${sc.front}</svg>
        <span><b>${s.emoji} ${s.name}</b><small>${s.desc}</small></span></button>`;
    }).join('')}</div>
    <nav><button class="back">← 다시 고르기</button></nav>`;
  root.querySelectorAll('.stagecard').forEach(el => (el.onclick = () => next(el.dataset.key)));
  root.querySelector('.back').onclick = back;
}
