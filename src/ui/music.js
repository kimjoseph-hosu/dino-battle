// 배경음악: 파일 없이 합성하는 전투 음악. 박자마다 조금 앞서 미리 예약하는 방식(16분음표 칸)
// 단계 level: 0 등장(북 연타가 커짐) → 1 초반 → 2 중반(금관 강세) → 3 마지막 라운드(가장 빠르게)
// danger: 한쪽 힘이 30 아래면 심장 박동 저음. end(kind): 고리를 멈추고 짧은 마무리(ko·win)
// D 단조: 라 → 시♭ → 도 → 라(A) 화음이 네 마디씩 돈다
import { music$, isMusicOn } from './sfx.js';

const BPM = [96, 108, 122, 138];
const CHORDS = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]]; // Dm, B♭, C, A (MIDI)
const BASS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 2, 0, 1, 0, 3, 0]; // 0 쉼, 1 바닥음, 2 다섯째 음, 3 옥타브
const hz = n => 440 * 2 ** ((n - 69) / 12);

let st = null; // { level, danger, stage, step, next, timer, filter }

// 악기: 시간 t 에 바로 연주(모두 음악 버스로)
function inst(t, { type = 'sine', f0, f1 = f0, dur, peak, cut = 20000, Q = 1, attack = 0.005, n = false }) {
  const { ctx, bus, noise } = music$(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
  let src;
  if (n) { src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; }
  else { src = ctx.createOscillator(); src.type = type; src.frequency.setValueAtTime(f0, t); src.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); }
  fl.type = n ? 'bandpass' : 'lowpass';
  fl.frequency.value = cut;
  fl.Q.value = Q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  src.connect(fl).connect(g).connect(st?.filter ?? bus);
  src.start(t);
  src.stop(t + attack + dur + 0.05);
}
const taiko = (t, k = 1) => { inst(t, { f0: 110, f1: 42, dur: 0.45, peak: 0.9 * k }); inst(t, { n: true, cut: 300, dur: 0.12, peak: 0.25 * k }); };
const tom = (t, f, k = 1) => inst(t, { f0: f, f1: f * 0.55, dur: 0.22, peak: 0.45 * k });
const hat = (t, k = 1) => inst(t, { n: true, cut: 7000, Q: 0.8, dur: 0.04, peak: 0.12 * k });
const wood = (t, k = 1) => inst(t, { type: 'triangle', f0: 1700, f1: 1500, dur: 0.05, peak: 0.12 * k }); // 정글: 나무 타악기
const bass = (t, n, len) => inst(t, { type: 'sawtooth', f0: hz(n - 12), dur: len, peak: 0.28, cut: 380, attack: 0.01 });
const pad = (t, notes, len) => notes.forEach((n, i) => [-6, 6].forEach(d => inst(t, { type: 'sawtooth', f0: hz(n) * 2 ** (d / 1200), dur: len, peak: 0.035 + (i === 0 ? 0.01 : 0), cut: 1100, attack: len * 0.3 })));
const brass = (t, notes, len = 0.22) => notes.forEach(n => inst(t, { type: 'square', f0: hz(n + 12), dur: len, peak: 0.06, cut: 1800, attack: 0.015 }));
const heart = t => [0, 0.16].forEach((d, i) => inst(t + d, { f0: 62, f1: 40, dur: 0.18, peak: i ? 0.35 : 0.5 }));

function playStep(s, t, beat) {
  const L = st.level, bar = Math.floor(s / 16), i = s % 16, ch = CHORDS[bar % 4], hi = st.stage === 'jungle' ? wood : hat;
  if (L === 0) { // 등장: 마디가 갈수록 북이 촘촘하고 커진다
    const gap = [8, 4, 2, 1][Math.min(3, bar)], k = Math.min(1, 0.4 + bar * 0.2);
    if (i % gap === 0) tom(t, i % 4 ? 160 : 120, k);
    if (i === 0) { taiko(t, k); pad(t, [ch[0] - 12, ch[0]], beat * 16); }
    return;
  }
  if ([0, 6, 8, 12].includes(i) || (L >= 2 && [3, 10, 14].includes(i))) (i % 8 === 0 ? taiko(t) : tom(t, i % 3 ? 150 : 190, 0.8));
  if (i % 2 === 0 || L >= 3) hi(t, i % 4 === 0 ? 1 : 0.6);
  const b = BASS[i];
  if (b) bass(t, b === 1 ? ch[0] : b === 2 ? ch[0] + 7 : ch[0] + 12, beat * 1.6);
  if (i === 0) pad(t, ch, beat * 16);
  if (L >= 2 && (i === 0 || i === 6 || (L >= 3 && i === 10))) brass(t, ch);
  if (st.danger && i % 8 === 0) heart(t);
}

function tick() {
  const { ctx } = music$();
  // 배틀 화면을 떠나면 저절로 멈춘다
  if (!document.querySelector('.arena')) return stop();
  const beat = 60 / BPM[st.level] / 4;
  while (st.next < ctx.currentTime + 0.15) {
    if (isMusicOn()) playStep(st.step, st.next, beat);
    st.next += beat;
    st.step++;
  }
}

export function start(stage) {
  stop();
  const { ctx, bus } = music$(), filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = stage === 'underwater' ? 900 : 20000; // 물속은 먹먹하게
  filter.connect(bus);
  st = { level: 0, danger: false, stage, step: 0, next: ctx.currentTime + 0.05, filter, timer: setInterval(() => tick(), 25) };
}
// 새 단계는 다음 마디 첫 칸부터
export const level = n => { if (st && n !== st.level) { st.level = n; st.step = Math.ceil(st.step / 16) * 16; } };
export const danger = on => { if (st) st.danger = on; };
export function stop() {
  if (!st) return;
  clearInterval(st.timer);
  const f = st.filter;
  setTimeout(() => f.disconnect(), 3000); // 남은 음이 끝난 뒤 정리
  st = null;
}
// 마무리: ko 큰 북 + 내려가는 화음, win 밝은 D 장조 금관
export function end(kind) {
  if (!st) return;
  const { ctx } = music$(), t = ctx.currentTime + 0.05, s = st;
  clearInterval(s.timer);
  if (isMusicOn()) {
    if (kind === 'ko') { taiko(t, 1.2); taiko(t + 0.3, 1); brass(t + 0.3, [50, 53, 57], 1.2); inst(t + 0.3, { type: 'sawtooth', f0: hz(38), f1: hz(31), dur: 1.4, peak: 0.25, cut: 500 }); }
    else { [[50, 54, 57], [52, 55, 59], [54, 57, 62]].forEach((c, i) => brass(t + i * 0.22, c, i === 2 ? 1.1 : 0.2)); taiko(t); taiko(t + 0.44, 1.1); }
  }
  st = null;
  setTimeout(() => s.filter.disconnect(), 4000);
}
