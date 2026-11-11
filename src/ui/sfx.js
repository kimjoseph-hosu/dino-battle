// 효과음: 파일 없이 WebAudio로 합성한다 (PLAN 2: 소리는 직접 합성).
// 브라우저는 사용자가 한 번 누른 뒤에야 소리를 낼 수 있어서, 첫 클릭 때 unlock()을 부른다.
// 소리 길: 효과음(fxBus) → [물속이면 먹먹하게] ─┐
//          배경음악(musicBus, music.js) ─────────┴→ master(전체 음소거) → 스피커
import { SFX_VOLUME, MUSIC_VOLUME } from '../config.js';

let ctx, master, fxBus, fxFilter, musicBus, noise;
const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 안 돼도 이번 화면에서는 적용 */ } };
let muted = load('dino-muted', '0') === '1', musicOn = load('dino-music', '1') === '1';

export function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    // 여러 소리가 한꺼번에 겹쳐도 찢어지지 않게 압축기를 거친다
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
    fxFilter = ctx.createBiquadFilter();
    fxFilter.type = 'lowpass';
    fxFilter.frequency.value = 20000;
    fxBus = ctx.createGain();
    fxBus.gain.value = SFX_VOLUME;
    fxBus.connect(fxFilter).connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? MUSIC_VOLUME : 0;
    musicBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const unlock = () => ac();
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  save('dino-muted', m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : 1;
}
export const isMusicOn = () => musicOn;
export function setMusicOn(on) {
  musicOn = on;
  save('dino-music', on ? '1' : '0');
  if (musicBus) musicBus.gain.setTargetAtTime(on ? MUSIC_VOLUME : 0, ctx.currentTime, 0.1);
}
export const music$ = () => (ac(), { ctx, bus: musicBus, noise });
// 무대: 물속이면 효과음을 먹먹하게(높은 소리를 깎는다)
export const setStageSound = stage => { ac(); fxFilter.frequency.setTargetAtTime(stage === 'underwater' ? 1100 : 20000, ctx.currentTime, 0.05); };
// 큰 소리가 날 때 배경음악을 잠깐 낮춘다
function duck(k = 0.35, hold = 0.35) {
  if (!musicOn) return;
  const g = musicBus.gain, t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setTargetAtTime(MUSIC_VOLUME * k, t, 0.02);
  g.setTargetAtTime(MUSIC_VOLUME, t + hold, 0.25);
}

// ── 소리 재료 ──
// 소리 크기 모양: 빠르게 올라갔다가 dur 동안 사라짐
function env(param, t, peak, attack, dur) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + dur);
}
function tone(type, f0, f1, dur, peak, delay = 0) {
  const c = ac(), t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env(g.gain, t, peak, 0.01, dur);
  o.connect(g).connect(fxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function hiss(type, f0, f1, dur, peak, delay = 0, Q = 1) {
  const c = ac(), t = c.currentTime + delay, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise;
  s.loop = true;
  fl.type = type;
  fl.Q.value = Q;
  fl.frequency.setValueAtTime(f0, t);
  fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g.gain, t, peak, 0.005, dur);
  s.connect(fl).connect(g).connect(fxBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}
// 목소리: 음 높이 곡선(pts: [[시간 비율, 배율]...]) + 떨림(vib Hz, depth) + 거칠기(am: 진폭 떨림 Hz) + 소리 색(필터)
function voice({ type = 'sawtooth', f, pts = [[0, 1], [1, 1]], dur, peak = 0.3, vib = 0, depth = 0, am = 0, filter = 'lowpass', cut = 900, Q = 1, delay = 0 }) {
  const c = ac(), t = c.currentTime + delay, o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(), out = c.createGain();
  o.type = type;
  pts.forEach(([k, m], i) => (i ? o.frequency.exponentialRampToValueAtTime(f * m, t + k * dur) : o.frequency.setValueAtTime(f * m, t)));
  const extra = [];
  if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = f * depth; l.connect(lg).connect(o.frequency); extra.push(l); }
  if (am) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = am; lg.gain.value = 0.5; out.gain.value = 0.5; l.connect(lg).connect(out.gain); extra.push(l); }
  fl.type = filter;
  fl.frequency.value = cut;
  fl.Q.value = Q;
  env(g.gain, t, peak, Math.min(0.08, dur * 0.15), dur);
  o.connect(fl).connect(g).connect(out).connect(fxBus);
  [o, ...extra].forEach(n => { n.start(t); n.stop(t + dur + 0.1); });
}

// 짐승 목소리: 성대(톱니파 둘 + 낮은 한 옥타브, voiced) + 숨소리(breath) → 그르렁(rough) → 거칠게(dist) → 목구멍 울림(fm: 모음 필터 [[Hz 들(시간에 따라 고르게 지나감)], Q, 크기]) → 잔향
// 떨림·그르렁은 일정한 박자로 하면 엔진(오토바이) 소리처럼 들려서, 잡음을 느리게 걸러 불규칙하게 흔든다
// cut: 마지막에 높은 소리를 깎는 곳(Hz, 큰 동물일수록 낮게), gr: 그르렁 빠르기(Hz), jit: 음 높이 흔들림, wet: 잔향 크기, pts: 음 높이 곡선, vol: 크기 곡선
const SHAPE = {};
const shaper = k => (SHAPE[k] ??= Float32Array.from({ length: 1024 }, (_, i) => { const x = i / 511.5 - 1; return Math.tanh(k * x) / Math.tanh(k); }));
let room;
// 잔향: 넓은 곳에서 우는 느낌(2.2초 동안 사라지는 잡음 메아리)
function reverb() {
  if (room) return room;
  const c = ac(), n = c.sampleRate * 2.2, ir = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5); }
  room = c.createConvolver();
  room.buffer = ir;
  room.connect(fxBus);
  return room;
}
function beast({ f, pts = [[0, 1], [1, 1]], vol = [[0, 0], [0.08, 1], [0.7, 0.8], [1, 0]], dur, peak = 0.3, fm, voiced = 1, rough = 0, gr = 30, breath = 0, dist = 1, sub = 0, jit = 0.03, cut = 4000, wet = 0.3, delay = 0 }) {
  const c = ac(), t = c.currentTime + delay, end = t + dur, nodes = [];
  const osc = (type, k) => { const o = c.createOscillator(); o.type = type; pts.forEach(([u, m], i) => (i ? o.frequency.exponentialRampToValueAtTime(f * m * k, t + u * dur) : o.frequency.setValueAtTime(f * m * k, t))); nodes.push(o); return o; };
  // 불규칙한 흔들림: 잡음을 hz 아래로 걸러 param 에 더한다(걸러진 잡음은 작아져서 크게 키운다)
  const wobble = (hz, amt, to) => { const n = c.createBufferSource(), l = c.createBiquadFilter(), g = c.createGain(); n.buffer = noise; n.loop = true; l.type = 'lowpass'; l.frequency.value = hz; g.gain.value = amt / Math.sqrt(hz / 24000) / 0.6; n.connect(l).connect(g).connect(to); nodes.push(n); };
  const src = c.createGain(), o1 = osc('sawtooth', 1), o2 = osc('sawtooth', 1.013);
  src.gain.value = voiced;
  o1.connect(src); o2.connect(src);
  [o1, o2].forEach(o => wobble(9, f * jit, o.frequency));
  if (sub) { const s = osc('sine', 0.5), sg = c.createGain(); sg.gain.value = sub * voiced; s.connect(sg).connect(src); }
  const growl = c.createGain();
  growl.gain.value = 1 - rough * 0.4;
  if (rough) wobble(gr, rough * 0.45, growl.gain);
  src.connect(growl);
  if (breath) { const n = c.createBufferSource(), ng = c.createGain(); n.buffer = noise; n.loop = true; ng.gain.value = breath; n.connect(ng).connect(growl); nodes.push(n); }
  const ws = c.createWaveShaper(), out = c.createGain();
  ws.curve = shaper(dist);
  growl.connect(ws);
  for (const [fs, Q, g] of fm) {
    const bp = c.createBiquadFilter(), bg = c.createGain();
    bp.type = 'bandpass'; bp.Q.value = Q; bg.gain.value = g;
    fs.forEach((v, i) => (i ? bp.frequency.exponentialRampToValueAtTime(v, t + (i / (fs.length - 1)) * dur) : bp.frequency.setValueAtTime(v, t)));
    ws.connect(bp).connect(bg).connect(out);
  }
  const lp = c.createBiquadFilter(), amp = c.createGain(), send = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = cut;
  send.gain.value = wet;
  vol.forEach(([u, v], i) => (i ? amp.gain.linearRampToValueAtTime(v * peak, t + u * dur) : amp.gain.setValueAtTime(v * peak, t)));
  out.connect(lp).connect(amp).connect(fxBus);
  amp.connect(send).connect(reverb());
  nodes.forEach(n => { n.start(t, n.buffer ? Math.random() * 0.5 : 0); n.stop(end + 0.05); });
}
// 콧김: 코로 훅 내뿜는 잡음
const snort = (p, k, delay = 0) => { hiss('bandpass', 1800 * p, 700 * p, 0.18, 0.35 * k, delay, 1.2); hiss('lowpass', 500, 200, 0.2, 0.25 * k, delay); };

// 몸무게 → 음 높이 배율: 가벼우면 높고(1.8), 무거우면 낮다(0.45)
const pitch = kg => Math.min(1.8, Math.max(0.45, 1.75 - 0.27 * Math.log10(kg + 1)));
const weight = kg => Math.min(1, Math.max(0.25, 0.35 + 0.15 * Math.log10(kg + 1))); // 무거울수록 크게

// 맞는 몸의 재질: armor 갑옷·껍데기(깡), fur 털(푹), flesh 맨살(퍽)
const ARMOR = ['shell', 'bumps', 'plates', 'club', 'spiked_club', 'spikes'];
export function matOf(a) {
  const F = a.art?.features ?? [];
  if (a.archetype === 'armored' || a.archetype === 'arthropod' || F.some(x => ARMOR.includes(x))) return 'armor';
  if (a.archetype === 'large_mammal' || a.archetype === 'bird' || F.includes('fur') || F.includes('feathers')) return 'fur';
  return 'flesh';
}
// 울음소리 종류
export function voiceOf(a) {
  const F = a.art?.features ?? [], k = a.archetype, s = a.art?.params?.skull;
  if (a.drawing) return 'roar';
  if (F.includes('trunk')) return 'trumpet';
  if (k === 'large_mammal') return s === 'cat' || F.includes('sabre') ? 'snarl' : s === 'dog' ? 'howl' : s === 'bear' ? 'growl' : 'bellow';
  if (k === 'bird') return 'shriek';
  if (k === 'pterosaur') return 'screech';
  if (k === 'sprawler' || k === 'snake') return 'hiss';
  if (k === 'marine_reptile') return 'moan';
  if (k === 'fish') return 'gulp';
  if (k === 'arthropod') return a.art?.params?.kind === 'dragonfly' ? 'buzz' : 'chitter';
  if (k === 'theropod' && /^초식/.test(a.diet ?? '')) return 'grunt'; // 풀 먹는 두발 공룡(테리지노·플라테오)
  if (k === 'sauropod') return 'boom';
  if (k === 'ceratopsian' || k === 'armored') return 'grunt';
  return 'roar';
}

// 울음: 종류마다 음색, 몸무게만큼 낮고 길게. short: 공격 순간의 짧은 기합
const VOICES = {
  // 큰 육식공룡: 흐읍(들이쉼) → 크아아아앙-(입이 열렸다 닫히며 낮게 웅웅 깔림) → 후, 후(끝 숨). 짧은 기합은 본 울음만
  roar: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, L = (full ? 2.6 : 1.5) * d, at = full ? 0.3 : 0;
    if (full) hiss('lowpass', 300, 1100, 0.4, 0.25);
    beast({ f: 90 * p, pts: [[0, 0.7], [0.12, 1.15], [0.35, 1.2], [0.6, 1.0], [0.85, 0.8], [1, 0.6]], vol: [[0, 0], [0.1, 0.85], [0.25, 1], [0.45, 0.8], [0.6, 0.95], [0.85, 0.45], [1, 0]], dur: L, peak: 1.6, delay: at,
      fm: [[[330 * q, 470 * q, 450 * q, 400 * q, 320 * q], 3, 1], [[650 * q, 950 * q, 900 * q, 780 * q, 600 * q], 4, 0.6], [[1600 * q, 2100 * q, 2000 * q, 1700 * q], 5, 0.15]],
      voiced: 0.45, rough: 0.8, gr: 22, breath: 1.1, dist: 2.5, sub: 0.7, cut: 1300 * q, wet: 0.4 });
    // 땅이 울리는 낮은 웅웅
    beast({ f: 45 * p, pts: [[0, 0.9], [0.4, 1.1], [1, 0.8]], vol: [[0, 0], [0.3, 1], [0.7, 0.8], [1, 0]], dur: L * 1.1, peak: 0.9, delay: at, fm: [[[110, 90], 1, 1]], voiced: 1, rough: 0.5, gr: 8, breath: 0.4, dist: 1.5, cut: 250, wet: 0.2 });
    if (full) [0, 0.35].forEach(dl => hiss('lowpass', 700 * q, 200, 0.3, 0.3, at + L + 0.1 + dl));
    return at + L + (full ? 0.75 : 0);
  },
  // 초식공룡: 훅(콧김) → 음무우우-(입을 다문 낮은 울음) → 음(짧게 한 번 더)
  grunt: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6;
    snort(p, 1);
    const moo = (L, delay, peak) => beast({ f: 70 * p, pts: [[0, 0.9], [0.2, 1.15], [0.6, 1.05], [1, 0.75]], vol: [[0, 0], [0.15, 1], [0.6, 0.8], [1, 0]], dur: L, peak, delay,
      fm: [[[260 * q, 330 * q, 300 * q, 250 * q], 3, 1], [[600 * q, 750 * q, 650 * q], 4, 0.45]], voiced: 0.75, rough: 0.6, gr: 18, breath: 0.6, dist: 2, sub: 0.7, cut: 1000 * q, wet: 0.3 });
    moo((full ? 1.4 : 0.6) * d, 0.2, 1.2);
    if (full) moo(0.45 * d, 0.3 + 1.5 * d, 0.8);
    return full ? 0.3 + 1.95 * d : 0.2 + 0.6 * d;
  },
  // 코끼리: 우르르(낮은 울림) → 뿌우우우-(떨리며 높아졌다 끝에 꺾임) → 숨
  trumpet: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, at = full ? 0.35 : 0, L = (full ? 1.8 : 0.9) * d;
    if (full) beast({ f: 40, vol: [[0, 0], [0.4, 1], [1, 0]], dur: 0.5, peak: 0.8, fm: [[[120, 100], 1, 1]], voiced: 1, rough: 0.6, gr: 10, breath: 0.3, cut: 300, wet: 0.2 });
    beast({ f: 380 * q, pts: [[0, 0.8], [0.1, 1.2], [0.5, 1.15], [0.75, 1.28], [0.9, 1.2], [1, 0.85]], vol: [[0, 0], [0.05, 1], [0.5, 0.85], [0.8, 0.95], [1, 0]], dur: L, peak: 0.8, delay: at,
      fm: [[[1000 * q, 1250 * q, 1300 * q, 1150 * q], 6, 1], [[2100 * q, 2500 * q, 2600 * q], 8, 0.5], [[600, 600], 3, 0.4]], rough: 0.2, gr: 14, breath: 0.25, dist: 2, jit: 0.05, cut: 3500, wet: 0.45 });
    if (full) hiss('bandpass', 1200, 500, 0.4, 0.15, at + L, 1);
    return at + L + (full ? 0.4 : 0);
  },
  // 고양잇과: 그르르(낮게 깔림) → 으르아아오오-(입이 크게 열렸다 오므려짐) → 어, 어(잦아드는 짧은 울음)
  snarl: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, at = full ? 0.35 : 0, L = (full ? 2 : 1) * d;
    if (full) beast({ f: 60 * p, vol: [[0, 0], [0.5, 1], [1, 0.3]], dur: 0.45, peak: 0.7, fm: [[[400 * q, 300 * q], 3, 1]], voiced: 0.6, rough: 0.9, gr: 16, breath: 0.6, dist: 2, cut: 900 * q, wet: 0.2 });
    beast({ f: 150 * p, pts: [[0, 0.8], [0.15, 1.2], [0.4, 1.2], [0.7, 0.95], [1, 0.6]], vol: [[0, 0], [0.06, 1], [0.4, 0.9], [0.7, 0.7], [1, 0]], dur: L, peak: 1.4, delay: at,
      fm: [[[700 * q, 1000 * q, 800 * q, 500 * q, 400 * q], 4, 1], [[1200 * q, 1600 * q, 1300 * q, 900 * q], 5, 0.6], [[2600 * q, 2800 * q, 2300 * q], 6, 0.2]],
      voiced: 0.5, rough: 0.6, gr: 20, breath: 1, dist: 2.5, sub: 0.4, cut: 2200 * q, wet: 0.35 });
    if (full) [0, 0.4].forEach((dl, i) => beast({ f: 120 * p, pts: [[0, 1], [1, 0.7]], vol: [[0, 0], [0.2, 1], [1, 0]], dur: 0.3, peak: 0.9 - i * 0.3, delay: at + L + 0.15 + dl,
      fm: [[[500 * q, 380 * q], 4, 1], [[900 * q, 700 * q], 5, 0.5]], voiced: 0.5, rough: 0.5, gr: 18, breath: 0.9, dist: 2, cut: 1800 * q, wet: 0.35 }));
    return at + L + (full ? 0.85 : 0);
  },
  // 목 긴 공룡: 입을 다문 채 몸통이 울리는 낮은 웅- 우웅-(교실 스피커에서도 들리게 배음을 남긴다)
  boom: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, L = (full ? 2.2 : 1) * d;
    const hum = (len, delay, peak) => beast({ f: 70 * p, pts: [[0, 0.85], [0.3, 1.1], [0.7, 1.05], [1, 0.8]], vol: [[0, 0], [0.3, 1], [0.7, 0.85], [1, 0]], dur: len, peak, delay,
      fm: [[[180 * q, 240 * q, 220 * q, 170 * q], 3, 1], [[420 * q, 520 * q, 450 * q], 4, 0.4]], voiced: 0.9, rough: 0.4, gr: 10, breath: 0.35, dist: 1.8, sub: 0.8, cut: 700 * q, wet: 0.5 });
    hum(L, 0, 1.6);
    if (full) hum(1 * d, L + 0.4, 1.1);
    return full ? L + 0.4 + d : L;
  },
  // 갯과: 낮게 웍 → 아우우우우-(올라갔다 길게 끌다 내려감)
  howl: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, at = full ? 0.4 : 0, L = (full ? 2.4 : 0.8) * d;
    if (full) beast({ f: 160 * p, pts: [[0, 1], [1, 0.8]], vol: [[0, 0], [0.2, 1], [1, 0]], dur: 0.3, peak: 0.8, fm: [[[600 * q, 450 * q], 4, 1]], voiced: 0.6, rough: 0.7, gr: 20, breath: 0.6, dist: 2, cut: 1500, wet: 0.3 });
    beast({ f: 400 * p, pts: [[0, 0.85], [0.25, 1.15], [0.6, 1.12], [0.85, 1.05], [1, 0.78]], vol: [[0, 0], [0.15, 1], [0.8, 0.85], [1, 0]], dur: L, peak: 0.55, delay: at,
      fm: [[[800, 600, 520, 450], 5, 1], [[1300, 1000, 850, 800], 6, 0.5]], voiced: 1, rough: 0.05, breath: 0.15, dist: 1.2, jit: 0.02, cut: 3000, wet: 0.5 });
    return at + L;
  },
  // 곰: 그르르르워어-(거칠게 떨리는 낮은 울음) → 훅, 훅
  growl: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, L = (full ? 2.2 : 0.9) * d;
    beast({ f: 80 * p, pts: [[0, 0.9], [0.4, 1.15], [0.8, 1.0], [1, 0.75]], vol: [[0, 0], [0.2, 0.8], [0.5, 1], [0.85, 0.7], [1, 0]], dur: L, peak: 2,
      fm: [[[350 * q, 500 * q, 450 * q, 350 * q], 3, 1], [[800 * q, 1000 * q, 850 * q], 4, 0.5]], voiced: 0.6, rough: 0.95, gr: 18, breath: 0.9, dist: 2.5, sub: 0.5, cut: 1300 * q, wet: 0.3 });
    if (full) [0, 0.3].forEach(dl => hiss('lowpass', 900 * q, 250, 0.22, 0.35, L + 0.1 + dl));
    return full ? L + 0.65 : L;
  },
  // 그 밖의 큰 짐승(코뿔소·사슴·나무늘보): 훅(콧김) → 우어어어-(들소처럼 낮게 올라갔다 내려감)
  bellow: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, at = full ? 0.2 : 0, L = (full ? 1.8 : 0.8) * d;
    if (full) snort(p, 1);
    beast({ f: 90 * p, pts: [[0, 0.85], [0.3, 1.15], [0.7, 1.05], [1, 0.75]], vol: [[0, 0], [0.15, 1], [0.7, 0.8], [1, 0]], dur: L, peak: 1.8, delay: at,
      fm: [[[300 * q, 450 * q, 400 * q, 300 * q], 3, 1], [[700 * q, 900 * q, 750 * q], 4, 0.5]], voiced: 0.7, rough: 0.55, gr: 18, breath: 0.6, dist: 2, sub: 0.6, cut: 1100 * q, wet: 0.35 });
    return at + L;
  },
  // 큰 새: 끼아악, 끼아악(두 번 크게) → 끽(짧게)
  shriek: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, n = full ? 3 : 1, gap = 0.25;
    let t = 0;
    for (let i = 0; i < n; i++) {
      const L = (i === 2 ? 0.45 : 0.85) * d;
      beast({ f: 700 * p, pts: [[0, 1.1], [0.2, 1.3], [1, 0.8]], vol: [[0, 0], [0.08, 1], [0.6, 0.7], [1, 0]], dur: L, peak: 0.9 - i * 0.15, delay: t,
        fm: [[[1500 * q, 2200 * q, 1800 * q], 5, 1], [[3000 * q, 3500 * q, 2800 * q], 6, 0.5]], voiced: 0.8, rough: 0.4, gr: 35, breath: 0.6, dist: 2.5, cut: 6000, wet: 0.35 });
      t += L + gap;
    }
    return t - gap;
  },
  // 익룡: 끼이이이익-(거칠게 높아졌다 길게 떨어짐)
  screech: (p, d) => {
    const q = Math.sqrt(p), L = (d > 0.6 ? 1.8 : 0.7) * d;
    beast({ f: 600 * p, pts: [[0, 1.1], [0.15, 1.4], [0.6, 1.0], [1, 0.65]], vol: [[0, 0], [0.06, 1], [0.6, 0.75], [1, 0]], dur: L, peak: 1.4,
      fm: [[[1400 * q, 2000 * q, 1500 * q, 1100 * q], 5, 1], [[2800 * q, 3300 * q, 2600 * q], 6, 0.5]], voiced: 0.6, rough: 0.6, gr: 40, breath: 0.9, dist: 3, cut: 5000, wet: 0.4 });
    return L;
  },
  // 악어·도마뱀·뱀: 쉬이이익(입을 벌린 바람 소리) → 그르르르(땅을 울리는 낮은 떨림)
  hiss: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, H = (full ? 1.1 : 0.6) * d;
    hiss('highpass', 3500, 2200, H, 0.35);
    hiss('bandpass', 1500, 900, H, 0.2, 0, 1.5);
    if (!full) return H;
    const L = 1.6 * d;
    beast({ f: 50 * p, pts: [[0, 0.9], [0.5, 1.1], [1, 0.8]], vol: [[0, 0], [0.3, 1], [0.8, 0.8], [1, 0]], dur: L, peak: 1.3, delay: H * 0.7,
      fm: [[[200 * q, 260 * q, 200 * q], 2, 1], [[500 * q, 600 * q], 3, 0.3]], voiced: 0.7, rough: 0.9, gr: 12, breath: 0.4, dist: 2, sub: 0.6, cut: 600, wet: 0.35 });
    return H * 0.7 + L;
  },
  // 바다 파충류·고래: 우우우웅-(물속에서 길게 미끄러지는 소리, 메아리 크게) → 한 번 더 높게
  moan: (p, d) => {
    const q = Math.sqrt(p), full = d > 0.6, L = (full ? 2.6 : 1) * d;
    const song = (len, delay, k, peak) => beast({ f: 140 * p * k, pts: [[0, 0.8], [0.3, 1.3], [0.65, 1.1], [1, 0.7]], vol: [[0, 0], [0.25, 1], [0.75, 0.8], [1, 0]], dur: len, peak, delay,
      fm: [[[400 * q, 600 * q, 500 * q, 350 * q], 4, 1], [[900 * q, 1200 * q, 1000 * q], 5, 0.4]], voiced: 1, rough: 0.1, gr: 6, breath: 0.2, dist: 1.2, jit: 0.025, cut: 1500, wet: 0.6 });
    song(L, 0, 1, 1.2);
    if (full) song(1.2 * d, L * 0.8, 1.3, 0.8);
    return full ? L * 0.8 + 1.2 * d : L;
  },
  gulp: () => { tone('sine', 120, 60, 0.25, 0.5); [0, 0.08, 0.16].forEach((dl, i) => tone('sine', 400 + i * 150, 900 + i * 150, 0.06, 0.15, dl)); },
  chitter: () => [...Array(9)].forEach((_, i) => tone('triangle', 2600 + (i % 3) * 400, 1800, 0.025, 0.12, i * 0.035)),
  buzz: (p, d) => voice({ f: 140, dur: 0.6 * d, peak: 0.2, am: 60, cut: 3000 }),
};

export const sfx = {
  click: () => tone('triangle', 660, 990, 0.06, 0.15),
  // 울음: 동물(a)에 맞는 소리, short 면 공격할 때 짧은 기합. 소리 길이(초)를 돌려준다(길이를 모르는 짧은 울음은 대략)
  voice(a, short = false) {
    const kg = a.mass_kg.avg;
    const vary = k => 1 + (Math.random() - 0.5) * k; // 같은 동물도 울 때마다 높이·길이가 조금씩 다르다
    const d = (short ? 0.45 : 0.8 + 0.25 * weight(kg)) * vary(0.15), len = VOICES[voiceOf(a)](pitch(kg) * vary(0.08), d) ?? d;
    if (!short) duck(0.45, len); // 우는 동안 배경음악을 낮춘다
    return len;
  },
  // 힘 모으기(동작마다): 휘두를 때 바람, 덮치기·발차기는 뛰어오르는 소리, 들이받기는 콧김, 내리찍기는 기합
  windup(motion, a) {
    const p = pitch(a.mass_kg.avg);
    ({
      tail: () => hiss('bandpass', 250, 2200, 0.45, 0.35, 0, 2),
      roll: () => hiss('bandpass', 400, 1800, 0.35, 0.3, 0, 3),
      slash: () => hiss('bandpass', 1200, 3200, 0.18, 0.25, 0, 2),
      pounce: () => { hiss('bandpass', 300, 2000, 0.25, 0.3, 0, 2); tone('sine', 200 * p, 420 * p, 0.12, 0.15); },
      kick: () => hiss('bandpass', 500, 2400, 0.2, 0.28, 0, 2),
      ram: () => [0, 0.12].forEach(dl => hiss('bandpass', 1100, 600, 0.09, 0.25, dl, 3)),
      toss: () => [0, 0.12].forEach(dl => hiss('bandpass', 1100, 600, 0.09, 0.25, dl, 3)),
      stomp: () => sfx.voice(a, true),
      bite: () => sfx.voice(a, true),
      shake: () => sfx.voice(a, true),
    }[motion] ?? (() => hiss('bandpass', 300, 2600, 0.28, 0.35, 0, 2.5)))();
  },
  // 부딪힘: 동작 소리 + 맞는 몸 재질 소리. power 0 약, 1 강, 2 마지막 한 방. kg = 공격하는 쪽 몸무게
  impact(motion, power, kg, mat) {
    const p = pitch(kg), k = [0.45, 0.8, 1][power] * weight(kg);
    ({
      bite: () => { hiss('highpass', 3000, 1500, 0.04, 0.5 * k); tone('sine', 230 * p, 80 * p, 0.14, 0.7 * k); if (power) hiss('bandpass', 900, 300, 0.18, 0.4 * k, 0.02, 2); },
      shake: () => { hiss('highpass', 3000, 1500, 0.04, 0.5 * k); tone('sine', 230 * p, 80 * p, 0.14, 0.7 * k); },
      roll: () => { hiss('highpass', 3000, 1500, 0.04, 0.5 * k); tone('sine', 200 * p, 70 * p, 0.2, 0.7 * k); },
      ram: () => { tone('sine', 130 * p, 35 * p, 0.45, 0.95 * k); hiss('lowpass', 1200, 200, 0.3, 0.6 * k); tone('triangle', 320 * p, 150 * p, 0.1, 0.3 * k); },
      toss: () => { tone('sine', 130 * p, 40 * p, 0.35, 0.85 * k); hiss('lowpass', 1200, 200, 0.25, 0.5 * k); hiss('bandpass', 400, 2400, 0.35, 0.25, 0.08, 2); },
      stomp: () => { tone('sine', 75 * p, 25 * p, 0.7, 1 * k); hiss('lowpass', 450, 80, 0.8, 0.55 * k); },
      pounce: () => { tone('sine', 150 * p, 45 * p, 0.35, 0.85 * k); hiss('lowpass', 2000, 300, 0.25, 0.5 * k); },
      kick: () => { hiss('highpass', 2200, 900, 0.07, 0.6 * k); tone('sine', 260 * p, 90 * p, 0.14, 0.7 * k); },
      slash: () => [0, 0.06, 0.12].forEach(dl => hiss('bandpass', 4500, 2500, 0.08, 0.35 * k, dl, 4)),
      tail: () => { hiss('highpass', 5000, 3000, 0.035, 0.8 * k); tone('sine', 160 * p, 50 * p, 0.3, 0.7 * k, 0.02); },
    }[motion] ?? (() => { tone('sine', 150 * p, 38 * p, 0.3, 0.9 * k); hiss('lowpass', 2500, 250, 0.22, 0.6 * k); }))();
    // 재질: 갑옷은 쇳소리 같은 '깡'(어긋난 배음 두 개), 털은 푹신한 낮은 '푹', 맨살은 짧은 '찰싹'
    if (mat === 'armor') { tone('triangle', 520 * p, 500 * p, 0.25, 0.25 * k); tone('triangle', 765 * p, 740 * p, 0.18, 0.18 * k); hiss('bandpass', 2600, 1800, 0.08, 0.3 * k, 0, 3); }
    else if (mat === 'fur') hiss('lowpass', 700, 200, 0.15, 0.4 * k);
    else hiss('bandpass', 1800, 900, 0.06, 0.35 * k, 0, 1.5);
    if (power === 2) tone('square', 90, 30, 0.5, 0.15);
    duck(power ? 0.3 : 0.6, power ? 0.45 : 0.2);
  },
  // 물고 흔들기: 퍽퍽퍽 세 번
  rattle(kg) { const p = pitch(kg); [0, 0.13, 0.26].forEach(dl => { tone('sine', 180 * p, 70 * p, 0.12, 0.4, dl); hiss('lowpass', 1500, 400, 0.08, 0.25, dl); }); },
  // 떨어져 땅에 닿음(던져지거나 쓰러질 때)
  land(kg, big = false) { const p = pitch(kg), w = weight(kg); tone('sine', 110 * p, 30 * p, big ? 0.6 : 0.35, (big ? 1 : 0.6) * w); hiss('lowpass', 900, 120, big ? 0.6 : 0.35, 0.45 * w); },
  // 피하기: 땅은 폴짝, 하늘은 푸드득, 물은 쏴
  dodge(mode, kg) {
    const p = pitch(kg);
    if (mode === 'fly') [0, 0.09, 0.18].forEach(dl => hiss('lowpass', 1200, 400, 0.07, 0.25, dl));
    else if (mode === 'swim') hiss('bandpass', 500, 1600, 0.35, 0.3, 0, 1.5);
    else { tone('sine', 300 * p, 650 * p, 0.09, 0.2); hiss('lowpass', 1500, 400, 0.12, 0.2, 0.05); }
  },
  // 걷기·날기·헤엄 소리를 이동하는 동안 n 번(간격 gap 초). 큰 동물은 쿵쿵, 작은 동물은 사박사박
  steps(mode, kg, n, gap) {
    const p = pitch(kg), w = weight(kg);
    for (let i = 0; i < Math.min(n, 12); i++) {
      const dl = i * gap;
      if (mode === 'fly') hiss('lowpass', 900, 350, 0.08, 0.12 * w, dl);
      else if (mode === 'swim') { if (i % 2 === 0) hiss('bandpass', 600, 1200, gap * 1.5, 0.1, dl, 1.2); }
      else if (kg >= 30) { tone('sine', 90 * p, 40 * p, 0.14, 0.32 * w, dl); hiss('lowpass', 350, 120, 0.1, 0.12 * w, dl); }
      else hiss('bandpass', 2500, 1500, 0.03, 0.06, dl, 2);
    }
  },
  splash() {
    hiss('highpass', 1200, 700, 0.45, 0.4);
    [0.05, 0.12, 0.2].forEach((d, i) => tone('sine', 900 + i * 300, 1500 + i * 300, 0.06, 0.12, d));
  },
  bubbles: () => [0, 0.07, 0.15, 0.22].forEach((d, i) => tone('sine', 300 + i * 120, 700 + i * 150, 0.08, 0.18, d)),
  bell() {
    tone('triangle', 880, 870, 1.1, 0.25);
    tone('sine', 1320, 1310, 0.8, 0.12);
  },
  drum() {
    tone('sine', 100, 45, 0.35, 0.8);
    hiss('lowpass', 3000, 600, 0.12, 0.3);
    tone('sine', 100, 45, 0.35, 0.8, 0.22);
  },
  // K.O.: 내려가는 소리 + 빙글빙글 별 반짝
  ko() {
    tone('square', 700, 90, 0.8, 0.16);
    [1568, 1976, 2349, 1976, 1568, 1976].forEach((fq, i) => tone('triangle', fq, fq, 0.14, 0.1, 0.85 + i * 0.13));
  },
  fanfare: () => [523, 659, 784, 1047].forEach((fq, i) => tone('square', fq, fq, i === 3 ? 0.55 : 0.16, 0.1, i * 0.14)),
};
