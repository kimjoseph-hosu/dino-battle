// 📔 공룡 일기장: 배틀이 끝날 때마다 한 장씩. DIARY_URL(구글 시트 Apps Script)이 있으면 시트에 모아서 어느 주소로 들어와도 같은 일기장,
// 없거나 인터넷이 끊기면 이 기기(localStorage)에 남은 것만 보여 준다. 시트 쪽 코드는 server/diary.gs
import { drawAnimal } from '../art/index.js';
import { DIARY_URL, STAGES } from '../config.js';
import { ga } from '../engine/story.js';
import { fitSvg } from './scene.js';

const KEY = 'dino-diary';
const local = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; } };

// page = { date, stage, weather, a, b, winner, ko, reason, aId, bId, wId }
export function saveDiary(page) {
  try { localStorage.setItem(KEY, JSON.stringify([...local(), page].slice(-300))); } catch { /* 기기에 못 남겨도 시트에는 */ }
  // ponytail: 누구나 쓸 수 있는 공개 주소(반 하나 쓰기엔 충분). 장난 글이 걱정되면 Apps Script에 비밀 낱말 확인을 넣는다
  if (DIARY_URL) fetch(DIARY_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(page) }).catch(() => {});
}

const loadDiary = () => (DIARY_URL ? fetch(DIARY_URL).then(r => r.json()).then(l => (Array.isArray(l) && l.length ? l : local())).catch(local) : Promise.resolve(local()));

const day = d => { const t = new Date(d); return isNaN(t) ? '' : `${t.getMonth() + 1}월 ${t.getDate()}일`; };

export async function showDiary(root, animals, { home }) {
  root.innerHTML = `<header class="step"><h1>📔 공룡 일기장</h1><p>일기장을 펴는 중…</p></header>`;
  const pages = (await loadDiary()).slice().reverse(); // 새 일기부터
  let i = 0;
  const pic = (id, name, win) => {
    const a = animals.find(x => x.id === id);
    return `<figure class="${win ? 'win' : ''}">${a?.book ? `<img src="${import.meta.env.BASE_URL}book/${id}.jpg" alt="" onerror="this.remove()">` : a ? `<svg data-id="${id}"></svg>` : '<span>✏️</span>'}<figcaption>${win ? '👑 ' : ''}${name}</figcaption></figure>`;
  };
  const draw = () => {
    const p = pages[i], st = STAGES[p?.stage];
    root.innerHTML = `<header class="step"><h1>📔 공룡 일기장</h1><p>${pages.length ? `${i + 1} / ${pages.length}쪽` : '아직 일기가 없어요. 배틀을 하면 한 장씩 생겨요!'}</p></header>
      ${p ? `<article class="diary">
        <div class="dhead"><b>${day(p.date)}</b><span>${st ? `${st.emoji} ${st.name}` : ''} ${p.weather || '☀️'}</span></div>
        <div class="dpair">${pic(p.aId, p.a, p.wId === p.aId)}<strong>VS</strong>${pic(p.bId, p.b, p.wId === p.bId)}</div>
        <h2>${ga(p.winner)} ${String(p.ko).toLowerCase() === 'true' ? 'K.O.로 ' : ''}이겼어요!</h2>
        ${p.reason ? `<p>${p.reason}</p>` : ''}
      </article>` : ''}
      <nav><button class="back">← 처음으로</button>${pages.length > 1 ? `<button class="dprev" ${i ? '' : 'disabled'}>◀ 새 일기</button><button class="dnext" ${i < pages.length - 1 ? '' : 'disabled'}>지난 일기 ▶</button>` : ''}</nav>`;
    root.querySelectorAll('.diary svg[data-id]').forEach(svg => { const a = animals.find(x => x.id === svg.dataset.id); fitSvg(svg, `<g transform="scale(${a.length_m.avg})">${drawAnimal(a)}</g>`); });
    root.querySelector('.back').onclick = home;
    const go = d => { i = Math.max(0, Math.min(pages.length - 1, i + d)); draw(); };
    if (root.querySelector('.dprev')) { root.querySelector('.dprev').onclick = () => go(-1); root.querySelector('.dnext').onclick = () => go(1); }
  };
  draw();
}
