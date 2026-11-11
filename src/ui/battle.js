// 배틀 연출: 등장 → 라운드(최대 5) → 마무리(물러남 또는 K.O.) (PLAN 5.3). 결과는 engine이 이미 정해서 넘겨준다.
// 좌표: SVG 안은 미터(CSS px = 1m). 각 동물은 코끝이 x, 발이 높이 y에 오고, dir(+1 오른쪽, -1 왼쪽)을 본다.
// 날거나 물속을 헤엄치는 동물은 y가 0보다 커서 떠다니며 싸운다.
import { drawAnimal, shapeTest, liveArt, ART } from '../art/index.js';
import { arena3d } from './arena3d.js';
import { animate } from 'motion';
import { TIMING, BOING } from '../config.js';
import { STAGE_ART } from './stage.js';
import { EVENTS } from '../engine/events.js';
import { sfx, matOf, isMusicOn, setStageSound } from './sfx.js';
import * as music from './music.js';

const wait = ms => new Promise(r => setTimeout(r, ms));
const MAX_ZOOM = 6; // 더 당기면 큰 쪽 그림을 매 프레임 거대하게 다시 그려 번쩍인다. 아주 작은 쪽은 덜 커 보여도 괜찮다
const fmtLen = m => (m >= 1 ? `${+m.toFixed(1)}m` : `${+(m * 100).toFixed(1)}cm`);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// 사건 날씨에 흩뿌릴 조각들(용암·돌·작은 운석). 위치·크기·빠르기를 조금씩 다르게(--x 가로 %, --s 크기, --t 걸리는 초, --d 늦게 시작)
const bits = (n, cls, t = [1.6, 3]) => Array.from({ length: n }, () => `<i class="${cls}" style="--x:${Math.random() * 110 - 5}%;--s:${0.5 + Math.random()};--t:${t[0] + Math.random() * (t[1] - t[0])}s;--d:${-Math.random() * t[1]}s"></i>`).join('');
// 토네이도: 위가 넓고 아래가 좁은 고리를 쌓고, 고리마다 늦게 흔들려 꼬이는 모양
const TORNADO = `<div class="tornado">${Array.from({ length: 15 }, (_, i) => `<b style="--i:${i}"></b>`).join('')}</div>`;
const anim = (el, frames, ms, easing = 'ease-in-out') => el.animate(frames, { duration: ms, easing, fill: 'forwards' }).finished;

// 자세: dx 앞으로(m), dy 위로(m), r 코를 드는 각도(도), sx·sy 늘이기(sx -1 = 몸을 돌림, sy -1 = 몸을 뒤집음)
const REST = { dx: 0, dy: 0, r: 0, sx: 1, sy: 1 };
const LYING = { r: -8, sy: 0.55, sx: 1.08 };
const poseCss = (F, s) => `translate(${F.dir * s.dx}px, ${-s.dy}px) rotate(${-F.dir * s.r}deg) scale(${s.sx}, ${s.sy})`;

// 공격 움직임: wind 힘 모으기, hit 파고들기(여러 자세면 차례로), 그 밖은 부딪힌 뒤 효과
const BITE_WIND = F => ({ dx: -0.06 * F.L, r: 8 }), RAM_WIND = F => ({ dx: -0.12 * F.L, r: -6, sy: 0.95 });
const MOTIONS = {
  bite: { wind: BITE_WIND, hit: F => [{ dx: 0.04 * F.L, r: -10 }], jaw: true, dive: true },
  shake: { wind: BITE_WIND, hit: F => [{ dx: 0.04 * F.L, r: -10 }], jaw: true, dive: true, shake: true },
  ram: { wind: RAM_WIND, hit: F => [{ dx: 0.06 * F.L, r: -8 }], dive: true },
  toss: { wind: RAM_WIND, hit: F => [{ dx: 0.04 * F.L, r: -10 }], dive: true, toss: true },
  stomp: { wind: F => ({ dx: -0.05 * F.L, dy: 0.1 * F.h, r: 40 }), hit: () => [{ r: -6 }], ground: true },
  pounce: { wind: F => ({ dx: -0.08 * F.L, r: -4, sy: 0.85 }), hit: F => [{ dy: 0.35 * F.h, r: 10 }, { dx: 0.03 * F.L, r: -6 }], jaw: true, dive: true },
  kick: { wind: F => ({ dx: -0.05 * F.L, r: -4, sy: 0.88 }), hit: F => [{ dy: 0.3 * F.h, r: 18 }, { dy: 0.12 * F.h, r: 26 }] },
  slash: { wind: F => ({ r: 16, dy: 0.04 * F.h }), hit: F => [{ dx: 0.05 * F.L, r: -8 }], dive: true, claws: true },
  tail: { wind: () => ({ sx: -1, r: -4 }), hit: () => [{ sx: -1, r: 6 }], tail: true },
  roll: { wind: BITE_WIND, hit: F => [{ dx: 0.04 * F.L, r: -6, sy: -1, dy: F.h }], jaw: true, dive: true },
};

// 크기 차이가 크면 화면 구석에 계속 보여 주는 크기 비교 (PLAN 5.4)
function sizeBox(A, B) {
  const [big, small] = A.length_m.avg >= B.length_m.avg ? [A, B] : [B, A], k = big.length_m.avg / small.length_m.avg;
  if (k < 4) return '';
  return `<div class="sizebox">📏 <b>${big.name_ko}</b> ${fmtLen(big.length_m.avg)} · <b>${small.name_ko}</b> ${fmtLen(small.length_m.avg)}<br><em>몸길이가 약 ${Math.round(k)}배 차이!</em></div>`;
}

// .jiggle: 맞았을 때 탱글탱글 튕기는 층(Motion 스프링). .pose 바깥에 둬야 3D(arena3d)가 .pose 안 그림 위치로 같이 따라 튕긴다
const fighterSvg = (a, dir, s) => {
  const L = a.length_m.avg * s;
  return `<g class="pos"><g class="jiggle"><g class="pose"><g transform="translate(${-dir * L} 0) scale(${dir * L} ${L})">${drawAnimal(a)}</g></g></g></g>`;
};

// script: engine/story.js makeScript (+AI 자막), modes: [A, B] 의 fly | swim | ground
export async function playBattle(root, A, B, res, stage, script, modes) {
  // 배틀 세계 단위: 큰 쪽 몸길이 = 10 (미터를 그대로 쓰면 몇 cm짜리 판은 아주 작은 숫자라 브라우저가 움직이는 그림을 엉뚱하게 그려 화면이 번쩍인다)
  const S = 10 / Math.max(A.length_m.avg, B.length_m.avg);
  const pips = '<u></u>'.repeat(TIMING.ROUNDS);
  const plate = (a, i) => `<div class="plate p${i + 1}"><b>${a.name_ko}</b><span class="bar"><i class="ghost"></i><i class="hp"></i></span><div class="pips">${pips}</div></div>`;
  root.innerHTML = `<div class="arena sky-${stage}">
    <svg class="field"><defs><radialGradient id="battleShadow"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".6" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><g class="bg"></g><g class="cam"><g class="ground"></g><g class="shadows"><ellipse class="shadow"/><ellipse class="shadow"/></g>${fighterSvg(A, 1, S)}${fighterSvg(B, -1, S)}<g class="fx"></g></g><g class="front"></g></svg>
    <div class="hud">${plate(A, 0)}<div class="round"></div>${plate(B, 1)}</div>
    <div class="vs"><span>${A.name_ko}</span><em>VS</em><span>${B.name_ko}</span></div>
    ${sizeBox(A, B)}<div class="banner"></div><div class="boom"></div><div class="caption"><span></span></div></div>`;
  const $ = s => root.querySelector(s);
  const arena = $('.arena'), svg = $('svg'), bg = $('.bg'), fx = $('.fx');
  const caption = t => ($('.caption span').textContent = t);

  const f = [A, B].map((a, i) => {
    const pos = svg.querySelectorAll('.pos')[i], pose = pos.querySelector('.pose'), bb = pose.getBBox();
    return {
      a, pos, pose, jiggle: pos.querySelector('.jiggle'), shadow: svg.querySelectorAll('.shadow')[i], dir: i ? -1 : 1, L: a.length_m.avg * S, h: bb.height, bw: bb.width, x: 0, y: 0, p: REST, hp: 100,
      mode: modes[i], plate: root.querySelectorAll('.plate')[i], filled: shapeTest(a, pose),
    };
  });
  f.forEach(F => {
    Object.entries({ cx: -F.dir * F.bw * 0.5, cy: 0, rx: F.bw * 0.42, ry: Math.max(F.h * 0.05, F.bw * 0.03) }).forEach(([k, v]) => F.shadow.setAttribute(k, v));
    if (F.mode !== 'ground') F.pos.classList.add(F.mode === 'fly' ? 'flying' : 'swimming');
  });
  // 3D면 무대까지 3D(arena3d.js, 2D 움직임을 따라 그린다). 못 쓰면 2D 무대에 부위별로 움직이는 모델만
  const view3d = ART !== '2d' && arena3d(arena, f, stage);
  if (!view3d) f.forEach(F => liveArt(F.a, F.pose));
  const minL = Math.min(f[0].L, f[1].L), minH = Math.min(f[0].h, f[1].h), maxH = Math.max(f[0].h, f[1].h);
  // 확대 기준 크기: 키, 단 길고 납작한 동물(메갈라니아·악어·뱀)은 몸길이의 35%를 키로 친다
  const minS = Math.min(...f.map(F => Math.max(F.h, 0.35 * F.L)));

  // ── 그림 모양 재기(몸길이 1 좌표) ──
  // 모양 재기는 무거워서(isPointInFill) 같은 점은 한 번만 잰다. 공격마다 다시 재면 화면이 잠깐 멈칫한다
  const filled = (F, u, v) => { const k = `${u.toFixed(2)},${v.toFixed(3)}`; return (F.seen ??= new Map()).get(k) ?? F.seen.set(k, F.filled(u, v)).get(k); };
  // 높이 y(m)에서 코끝부터 몸이 시작되는 곳까지 거리(m)
  const frontAt = (F, y) => {
    for (let u = 1.08; u > -0.05; u -= 0.01) if (filled(F, u, y / F.L)) return (1 - u) * F.L;
    return 0.5 * F.L;
  };
  // 높이 y(m)에서 꼬리 끝부터 몸이 시작되는 곳까지 거리(m) — 몸을 돌려 꼬리로 칠 때
  const rearAt = (F, y) => {
    for (let u = -0.05; u < 1.08; u += 0.01) if (filled(F, u, y / F.L)) return (u + 0.02) * F.L;
    return 0.5 * F.L;
  };
  const noseY = F => {
    if (F.ny != null) return F.ny;
    for (let u = 1.08; u > 0; u -= 0.01) {
      const vs = [];
      for (let v = 0; v < 1; v += 0.004) if (filled(F, u, v)) vs.push(v);
      if (vs.length) return (F.ny = (vs.reduce((a, b) => a + b) / vs.length) * F.L);
    }
    return (F.ny = 0.5 * F.h);
  };

  // ── 높이: 날거나 물속을 헤엄치는 동물은 떠서 싸운다 ──
  // rise: 위아래로 움직일 수 있나(물가의 헤엄은 물 위에서만), engage: 맞붙는 높이, rest: 쉬는 높이
  f.forEach((F, i) => {
    const O = f[1 - i];
    F.rise = F.mode === 'fly' || (F.mode === 'swim' && stage === 'underwater');
    const bothUp = F.rise && (O.mode === 'fly' || (O.mode === 'swim' && stage === 'underwater'));
    F.engage = !F.rise ? 0 : Math.max(0, (bothUp ? maxH * 0.9 : O.h * 0.55) - noseY(F));
    F.rest = !F.rise ? 0 : F.engage + (F.mode === 'fly' ? maxH * 0.6 + F.h * 0.3 : maxH * 0.3);
  });

  // 카메라 기본 화면: 쉬는 자리 + 떠 있는 높이까지 + 여유(크기에 맞춰 넓어지거나 좁아진다). 땅은 화면 아래쪽 20%
  const maxL = Math.max(f[0].L, f[1].L), gap = Math.min(0.5 * S, 0.5 * maxL) + 0.15 * maxL, close = 0.02 * minL; // 여유 간격도 크기에 비례(고정 0.5m면 3cm 동물은 점이 되어 매번 크게 확대)
  const top = Math.max(...f.map(F => F.rest + F.h));
  const halfW = (gap + Math.max(f[0].L, f[1].L)) * 1.1, aspect = svg.clientWidth / svg.clientHeight;
  const PULL = 1.12; // 시점을 이만큼 뒤로(기본 화면도, 확대도)
  const H = PULL * Math.max(maxH * 1.6, top * 1.4, (2 * halfW) / aspect), W = H * aspect;
  const viewBox = (x, y, w, h) => svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  viewBox(-W / 2, -H * 0.8, W, H);
  // 확대가 큰 판이면 처음부터 빛·질감 겹(z>6)과 부위 그림자 필터(z>1.3)를 끈다. 카메라가 움직일 때마다 켰다 끄면 깜빡인다
  // 큰 쪽이 화면 너비 3배를 넘게 커지면 브라우저가 그 그림을 못 그려 화면이 하얗게 빈다 → 그 아래로만 확대
  const zCap = Math.min(MAX_ZOOM, (3 * W) / Math.max(f[0].bw, f[1].bw));
  const zWant = (H * 0.32) / PULL / minS, zMax = clamp(zWant, 1.15, zCap);
  const tiny = zWant > 6; // 크기 차가 아주 큰 판(배율은 막혀도 깜빡임 줄이는 설정은 그대로)
  arena.classList.toggle('zoomed', zMax > 2); // 크게 확대하는 판은 빛 겹·주름선을 처음부터 끈다(확대 화면에서 다시 그리느라 번쩍임)
  arena.classList.toggle('closeup', zMax > 1.3);
  const art = STAGE_ART[stage], scene = art.build(W, H);
  bg.innerHTML = scene.back;
  $('.ground').innerHTML = scene.ground;
  $('.front').innerHTML = scene.front;
  bg.querySelectorAll('.cloud').forEach((c, i) => c.animate([{ transform: 'translate(0px,0px)' }, { transform: `translate(${W * (0.04 + i * 0.01)}px,0px)` }], { duration: 20000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }));

  // ── 움직임 도구 ──
  // 자리 옮기기(x 앞뒤, y 높이). 그림자는 땅에 남고, 높이 뜰수록 작아진다
  const move = (F, x, y, ms, easing) => {
    const from = { x: F.x, y: F.y }, sh = v => Math.max(0.3, 1 - v / (H * 0.7));
    Object.assign(F, { x, y });
    // 땅에서 자리를 옮기는 동안은 다리 관절로 걷는다
    if (F.mode === 'ground' && Math.abs(x - from.x) > 0.02 * F.L) {
      // 걸음 박자를 이동 속도에 맞춘다(한 걸음 주기에 몸길이 0.4만큼). 느리게 옮기면 천천히 걸어 발이 미끄러져 보이지 않게
      const cycle = clamp((0.4 * F.L * ms) / Math.abs(x - from.x), 300, 1600);
      F.pos.style.setProperty('--step', `${cycle / 2}ms`);
      F.pos.dataset.gait = (2 * Math.PI * 1000) / cycle;
      F.pos.classList.add('walking');
      sfx.steps('ground', F.a.mass_kg.avg, Math.round(ms / (cycle / 2)), cycle / 2000);
      clearTimeout(F.walkT);
      F.walkT = setTimeout(() => F.pos.classList.remove('walking'), ms);
    }
    else if (F.mode !== 'ground' && Math.hypot(x - from.x, y - from.y) > 0.1 * F.L) sfx.steps(F.mode, F.a.mass_kg.avg, Math.round(ms / (F.mode === 'fly' ? 140 : 300)), F.mode === 'fly' ? 0.14 : 0.3);
    anim(F.shadow, [{ transform: `translate(${from.x}px,0px) scale(${sh(from.y)})` }, { transform: `translate(${x}px,0px) scale(${sh(y)})` }], ms, easing);
    return anim(F.pos, [{ transform: `translate(${from.x}px,${-from.y}px)` }, { transform: `translate(${x}px,${-y}px)` }], ms, easing);
  };
  const pose = (F, states, ms, easing) => {
    const fr = [F.p, ...states.map(s => ({ ...REST, ...s }))];
    F.p = fr.at(-1);
    // linear(쉬는 동작)는 마디마다 부드럽게 이어서 툭툭 꺾이지 않게
    return anim(F.pose, fr.map(s => ({ transform: poseCss(F, s), ...(easing === 'linear' && { easing: 'ease-in-out' }) })), ms, easing);
  };
  // 쉬는 동안의 움직임: 걷기(땅) / 날갯짓하며 둥실(하늘) / 물결치며 헤엄(물)
  const IDLE = {
    ground: (F, i) => (i % 2 ? { r: -1.5 } : { dy: 0.04 * F.h, r: 2 }),
    fly: (F, i) => (i % 2 ? { dy: -0.06 * F.h, r: -4 } : { dy: 0.1 * F.h, r: 5 }),
    swim: (F, i) => (i % 2 ? { dy: -0.03 * F.h, r: -3 } : { dy: 0.04 * F.h, r: 3 }),
  };
  const idle = (F, ms, steps) => pose(F, [...Array(steps * 2)].map((_, i) => IDLE[F.mode](F, i)).concat([{}]), ms, 'linear');
  // 착지: 달리기를 멈추고, 공중에 떠 있었으면 무릎을 굽혀 받은 뒤 선다
  const land = F => {
    const cl = F.pos.classList;
    cl.remove('running');
    if (!cl.replace('airborne', 'crouch')) return;
    clearTimeout(F.landT);
    F.landT = setTimeout(() => cl.remove('crouch'), 220);
  };
  const goTo = (F, x, y, ms) => Promise.all([move(F, x, y, ms), idle(F, ms, F.mode === 'ground' ? 2 : 1)]);
  // 카메라: (x, y)를 화면의 같은 자리에 둔 채 z배 확대. CSS로 키우면 80배일 때 거대한 그림을 매번 다시 그려 깜빡이므로
  // SVG 보이는 영역(viewBox)을 줄인다. 먼 풍경(bg)은 조금만, 앞 풍경(front)은 그대로 보이게 반대로 줄여 둔다
  const front = $('.front');
  let camNow = { x: 0, y: 0, z: 1 }, camRun = 0;
  const around = ({ x, y }, k) => `translate(${x} ${-y}) scale(${k}) translate(${-x} ${y})`;
  const setCam = c => {
    viewBox(c.x + (-W / 2 - c.x) / c.z, -c.y + (-H * 0.8 + c.y) / c.z, W / c.z, H / c.z);
    bg.setAttribute('transform', around(c, (1 + (c.z - 1) * 0.2) / c.z)); // 먼 풍경은 조금만 (깊이감)
    front.setAttribute('transform', around(c, 1 / c.z));
  };
  const camTo = (x, y, z, ms) => {
    // 배율은 곱으로 이어지게(1→80을 그냥 이으면 첫 순간에 확 튀어 들어간다)
    const from = camNow, run = ++camRun, t0 = performance.now(), ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    camNow = { x, y, z };
    return new Promise(done => {
      const step = now => {
        if (run !== camRun) return done(); // 다음 카메라 이동이 이어받음
        const t = Math.min(1, (now - t0) / ms), e = ease(t);
        setCam({ x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e, z: from.z * (z / from.z) ** e });
        t < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  };
  // 점들(x, 높이 y)이 모두 화면 안에 남는 카메라 [x, y, z]. 확대 중심은 화면의 같은 자리에 머무르므로 남은 여유만큼만 당긴다
  const frame = (pts, z) => {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const x = (x0 + x1) / 2, y = (y0 + y1) / 2, sx = (x1 - x0) / 2 || 1e-9, sy = (y1 - y0) / 2 || 1e-9;
    return [x, y, clamp(0.9 * Math.min((W / 2 - Math.abs(x)) / sx, (0.8 * H - y) / sy, (y + 0.2 * H) / sy), 1, z)];
  };
  const bodyAt = (F, up = 0) => [F.x - F.dir * F.bw / 2, F.y + up + F.h]; // 몸 가운데·머리 높이
  const ends = F => [[F.x, F.y + F.h / 2], [F.x - F.dir * F.bw, F.y + F.h / 2]]; // 코끝·꼬리끝
  const pop = (el, t, ms = 900) => {
    el.textContent = t;
    return el.animate([{ scale: 0.2, opacity: 1, rotate: '-8deg' }, { scale: 1.2, opacity: 1, rotate: '3deg', offset: 0.2 }, { scale: 1, opacity: 1, offset: 0.7 }, { scale: 1.05, opacity: 0 }], ms).finished;
  };
  const shake = k => k && arena.animate([0, -1, 0.8, -0.5, 0.3, 0].map((d, i) => ({ translate: `${d * k}px ${(i % 2 ? -d : d) * k * 0.6}px` })), 340);
  const puff = (x, y, size, n = 8, color = art.dust) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, d = size * (0.8 + Math.random() * 0.8);
      fx.insertAdjacentHTML('beforeend', `<circle cx="${x}" cy="${-y}" r="${size * 0.28}" fill="${color}"/>`);
      const c = fx.lastChild;
      c.animate([{ transform: 'translate(0px,0px) scale(0.3)', opacity: 0.9 }, { transform: `translate(${Math.cos(a) * d}px,${-Math.abs(Math.sin(a)) * d * 0.7}px) scale(1.5)`, opacity: 0 }], { duration: 650, easing: 'ease-out' }).finished.then(() => c.remove());
    }
  };
  // 타격 별빛(부딪힌 자리에 번쩍)
  const spark = (x, y, s) => {
    const pts = [...Array(16)].map((_, i) => { const r = i % 2 ? s * 0.35 : s, a = (i / 16) * Math.PI * 2; return `${x + Math.cos(a) * r},${-y + Math.sin(a) * r}`; }).join(' ');
    fx.insertAdjacentHTML('beforeend', `<polygon class="spark" points="${pts}"/>`);
    const el = fx.lastChild;
    el.animate([{ transform: 'scale(0.3) rotate(0deg)', opacity: 0.75 }, { transform: 'scale(1) rotate(20deg)', opacity: 0 }], { duration: 380, easing: 'ease-out' }).finished.then(() => el.remove());
  };
  // 할퀸 자국(하얀 줄 세 개, 금방 사라짐)
  const claws = (x, y, s, dir) => {
    for (let i = 0; i < 3; i++) {
      const ox = x + dir * (i - 1) * s * 0.35;
      fx.insertAdjacentHTML('beforeend', `<path class="slash" pathLength="1" d="M${ox - dir * s * 0.3},${-y - s * 0.6}Q${ox + dir * s * 0.3},${-y} ${ox - dir * s * 0.1},${-y + s * 0.6}"/>`);
      const el = fx.lastChild;
      el.animate([{ opacity: 1, strokeDashoffset: 1 }, { opacity: 1, strokeDashoffset: 0, offset: 0.4 }, { opacity: 0, strokeDashoffset: 0 }], 500).finished.then(() => el.remove());
    }
  };
  // 탱글: 납작하게 눌렸다(k=1) → 스프링이 0을 지나 길쭉하게 튀어 오르고(k<0) → 출렁이다 멈춘다. 몸은 맞은 반대쪽으로 살짝 젖혀진다
  // power: 0 약하게, 1 세게, 2 K.O. — 스프링 값은 config BOING
  const boing = (F, power) => {
    const s = BOING.SQUASH[power], tilt = BOING.TILT[power];
    F.boingRun?.stop();
    F.boingRun = animate(1, 0, {
      type: 'spring', visualDuration: BOING.DURATION, bounce: BOING.BOUNCE,
      onUpdate: k => (F.jiggle.style.transform = `rotate(${-F.dir * tilt * k}deg) scale(${1 + s * k}, ${1 - s * k})`),
    });
  };
  const hurt = (F, dmg) => {
    F.hp = clamp(F.hp - dmg, 0, 100); // 자연 사건은 힘을 채워 주기도 한다(dmg < 0)
    F.plate.querySelector('.hp').style.width = `${F.hp}%`;
    F.plate.querySelector('.ghost').style.width = `${F.hp}%`;
    F.plate.classList.toggle('low', F.hp <= 30);
    F.pos.classList.toggle('tired', F.hp <= 30);
  };

  // 공격 한 번: 힘 모으기 → 파고들기(실제로 몸이 겹치게) → 맞으면 멈칫·날아감, 빗나가면 상대가 휙 피함
  // power: 0 약하게, 1 세게, 2 마지막 한 방(K.O.)
  // 공격 중 자세는 3/4만 크게(몸 큰 동물이 크게 기울면 머리·꼬리가 화면 밖으로 휘둘러 나간다). 몸 돌리기(sx)·뛰기(dy)는 그대로
  const tame = s => ({ ...s, ...(s.r != null && { r: s.r * 0.75 }), ...(s.dx != null && { dx: s.dx * 0.75 }) });
  const poseT = (F, states, ms, easing) => pose(F, states.map(tame), ms, easing);
  async function strike(Att, Def, act, power, ms, hit) {
    const M = MOTIONS[act.motion], pen = (power ? 0.12 : 0.04) * minL;
    let hyD, hyA, ty = 0, dive = 0, jump = 0, target;
    if (Att.rise) {
      // 날거나 헤엄치는 쪽: 상대 몸 가운데 높이로 날아/헤엄쳐 들어간다
      const hyW = Def.y + 0.55 * Def.h;
      ty = Math.max(0, hyW - noseY(Att));
      hyA = hyW - ty;
      hyD = hyW - Def.y;
    } else if (Def.y > 0) {
      // 땅에서 떠 있는 상대를 칠 때: 닿는 높이에서, 모자라면 폴짝 뛰어오른다
      hyD = clamp(noseY(Att) - Def.y, 0.15 * Def.h, 0.85 * Def.h);
      hyA = Math.min(noseY(Att), Def.y + hyD);
      jump = Math.max(0, Def.y + hyD - noseY(Att));
    } else {
      hyD = hyA = Math.min(M.tail ? 0.6 * Att.h : noseY(Att), 0.6 * Def.h);
      if (M.dive && noseY(Att) > 1.3 * Def.h) {
        // 훨씬 큰 쪽: 발 쪽 회전축을 중심으로 코가 상대 높이까지 내려오게 숙인다
        const dxn = Att.bw / 2, ny = noseY(Att), R = Math.hypot(dxn, ny);
        hyD = 0.6 * Def.h;
        dive = clamp(Math.acos(clamp(hyD / R, -1, 1)) - Math.atan2(dxn, ny), 0, 0.7);
        target = Def.x + Att.dir * (frontAt(Def, hyD) + pen - (dxn * Math.cos(dive) + ny * Math.sin(dive) - dxn));
      }
    }
    target ??= Def.x + Att.dir * (frontAt(Def, hyD) + (M.tail ? rearAt(Att, hyA) : frontAt(Att, Math.max(0, hyA))) + pen);
    const fd = frontAt(Def, hyD), hitX = Def.x + Att.dir * fd, hitY = M.ground && !Def.y ? Math.min(hyD, 0.2 * minH) : Def.y + hyD;

    // 땅에서 뛰어오르는 공격(덮치기·발차기·떠 있는 상대)은 무릎을 굽혀 웅크렸다 공중에서 다리를 접고, 나머지는 달려든다.
    // 피할 쪽(땅)은 공격자가 힘을 모을 때 미리 웅크린다
    const leap = Att.mode === 'ground' && (jump > 0 || act.motion === 'pounce' || act.motion === 'kick');
    if (leap) Att.pos.classList.add('crouch');
    if (!hit && Def.mode === 'ground') Def.pos.classList.add('crouch');
    // 예비 동작: 힘을 모은 뒤 한 번 더 웅크려 잠깐 버티고 튀어 나간다
    const w = M.wind(Att), coil = { ...w, dx: (w.dx ?? 0) * 1.1, r: (w.r ?? 0) * 1.1, sy: 1 - (1 - (w.sy ?? 1)) * 1.1 };
    await Promise.all([poseT(Att, [w, coil], ms * 0.32, 'ease-in-out'), Att.rise ? move(Att, Att.x - Att.dir * 0.05 * Att.L, Att.y + 0.1 * Att.h, ms * 0.32, 'ease-out') : null]);
    sfx.windup(act.motion, Att.a);

    Att.pos.classList.add('charging');
    if (leap) Att.pos.classList.replace('crouch', 'airborne');
    else if (Att.mode === 'ground') Att.pos.classList.add('running');
    if (M.jaw) Att.pos.classList.add('biting');
    if (M.tail) Att.pos.classList.add('whip');
    const deg = (-dive * 180) / Math.PI;
    let lunge = dive ? (act.motion === 'pounce' ? [{ dy: 0.2 * Att.h, r: 6 }, { r: deg }] : [{ r: deg }]) : M.hit(Att);
    if (jump) lunge = [{ dy: jump * 1.1, r: 12 }, { dy: jump, r: 4 }];
    const z = power || tiny ? zMax : Math.min(1.06 * Math.max(1, (H * 0.05) / PULL / minS), zCap); // 크기 차가 아주 큰 판은 한 배율로(공격마다 50배↔80배로 바뀌지 않게)
    // 빗나가는 공격: 상대가 먼저 휙 피한다(나는 쪽은 위로, 헤엄치는 쪽은 빙글, 땅은 폴짝)
    const away = Def.x - Def.dir * (0.15 * minL + 0.18 * Def.L);
    if (!hit) sfx.dodge(Def.mode, Def.a.mass_kg.avg);
    const dodge = hit ? null : {
      fly: () => Promise.all([move(Def, away, Def.y + Math.max(0.6 * Def.h, 0.25 * Att.h), ms * 0.2, 'ease-out'), poseT(Def, [{ r: 18 }], ms * 0.2)]),
      swim: () => Promise.all([move(Def, away, Def.y + (Def.rise ? 0.5 * Def.h : 0), ms * 0.2, 'ease-out'), poseT(Def, [{ r: -15, sy: 0.9 }], ms * 0.2)]),
      ground: () => (Def.pos.classList.replace('crouch', 'airborne'), Promise.all([move(Def, away, 0, ms * 0.2, 'ease-out'), poseT(Def, [{ dy: 0.35 * Def.h, r: 10 }, {}], ms * 0.2)]).then(() => land(Def))),
    }[Def.mode]();
    // move 가 자리(x, y)를 바로 바꿔 두므로 여기서는 공격자 출발·도착 자리와 피한 상대의 도착 자리까지 화면에 넣는다
    // (크기 차가 아주 큰 판은 작은 쪽이 보이게 큰 쪽 몸 가운데까지만)
    const att0 = ends(Att);
    await Promise.all([move(Att, target, ty, ms * 0.18, 'ease-in'), (dive ? pose : poseT)(Att, lunge, ms * 0.18, 'ease-in'), camTo(...frame([[hitX, hitY], ...(tiny ? [bodyAt(Att)] : [...att0, ...ends(Att)]), bodyAt(Def)], z), ms * 0.18), dodge]);
    if (jump) setTimeout(() => land(Att), ms * 0.4); // 떠 있는 상대를 친 뒤 내려올 때 착지
    else land(Att);

    if (!hit) {
      // 헛손질: 별빛 없이 바람만
      pop($('.boom'), '휙!', 700);
      puff(hitX, hitY, 0.12 * minH, 5, '#ffffffaa');
      Att.pos.classList.remove('biting', 'whip', 'charging');
      const t = ms * 0.5;
      return Promise.all([poseT(Att, [{ dx: 0.06 * Att.L, r: -7 }, { dx: -0.01 * Att.L, r: 2 }, {}], t), poseT(Def, [{}], t)]);
    }

    // 부딪힘
    pop($('.boom'), power ? act.boom : '툭!', 800);
    sfx.impact(act.motion, power, Att.a.mass_kg.avg, matOf(Def.a));
    if (power && art.water) art.bubbles ? sfx.bubbles() : sfx.splash();
    shake([0, 5, 10][power]);
    Def.pos.classList.add('hit');
    setTimeout(() => Def.pos.classList.remove('hit'), power ? 500 : 300);
    boing(Def, power);
    boing(Att, 0); // 때린 쪽도 반동으로 살짝
    // 별빛은 아주 강한 한 방(K.O. 또는 데미지 40 이상)에만 작게 한 번(확대된 화면을 하얗게 덮지 않게)
    if (power === 2 || act.dmg >= 40) spark(hitX, hitY, 0.22 * minH);
    puff(hitX, hitY, (power ? 0.35 : 0.2) * minH);
    if (M.ground && !Def.y) puff(hitX, 0, 0.3 * minH, 10, art.kick);
    if (M.claws) claws(hitX, hitY, 0.5 * minH, Att.dir);
    await wait(power ? 90 : 50); // 멈칫

    const heavier = clamp(Math.log10(Att.a.mass_kg.avg / Def.a.mass_kg.avg) / 2, 0, 1);
    let t = ms * 0.5 - (power ? 90 : 50);
    Att.pos.classList.remove('biting', 'whip', 'charging');

    if (!power) return Promise.all([poseT(Att, [{ dx: 0.03 * Att.L, r: -3 }, { dx: -0.01 * Att.L, r: 1 }, {}], t), move(Def, Def.x - Def.dir * 0.08 * minL, Def.y, t, 'ease-out'), poseT(Def, [{ r: 7 }, { r: -2 }, {}], t)]);

    if (M.shake) {
      // 물고 흔들기: 둘이 함께 흔들린 뒤 내던진다
      const s = t * 0.5;
      sfx.rattle(Att.a.mass_kg.avg);
      await Promise.all([poseT(Att, [{ r: -14 }, { r: -2 }, { r: -14 }, { r: -4 }], s), poseT(Def, [{ r: 10, dy: 0.1 * Def.h }, { r: -6 }, { r: 10, dy: 0.1 * Def.h }, { r: -4 }], s)]);
      t -= s;
    }
    const lift = 0.6 * (0.15 + 0.35 * heavier) * Def.h * (M.toss ? 2 : 1) * (power === 2 ? 1.4 : 1);
    const kb = 0.6 * minL * (0.35 + 0.45 * heavier) * (power === 2 ? 1.3 : 1);
    const air = Def.y > 0;
    // K.O.: 하늘·물속에 떠 있던 쪽은 땅(바닥)으로 떨어져 눕는다
    const fall = power === 2
      ? [{ r: M.toss ? 50 : 30, dy: air ? 0 : lift }, { r: -10, sy: 0.5, sx: 1.1 }, { dy: 0.06 * Def.h, r: -6, sy: 0.62, sx: 1.05 }, LYING]
      : [{ r: M.toss ? 35 : 16, dy: air ? 0 : lift }, { r: -5, sy: 0.92 }, { r: 2, sy: 1.02 }, {}]; // 내려앉아 출렁였다 선다
    await Promise.all([
      poseT(Att, [{ dx: 0.03 * Att.L, r: M.toss ? 20 : -3 }, { dx: -0.01 * Att.L, r: M.toss ? 6 : 1 }, {}], t),
      move(Def, Def.x - Def.dir * kb, power === 2 ? 0 : Def.y + (air ? lift * 0.5 : 0), t, power === 2 && air ? 'cubic-bezier(.5,0,.9,.6)' : 'cubic-bezier(.2,.7,.3,1)'),
      poseT(Def, fall, t),
      camTo(...frame([[hitX, hitY], ...(tiny ? [bodyAt(Att)] : ends(Att)), bodyAt(Def, air ? 0 : lift)], z), t), // 날아간 쪽을 따라간다
      wait(t * 0.6).then(() => (air && power !== 2 ? null : (puff(Def.x - Def.dir * 0.3 * Def.L, 0, (power === 2 ? 0.45 : 0.25) * minH, 10, art.kick), sfx.land(Def.a.mass_kg.avg, power === 2)))),
    ]);
  }

  // ── 자연 사건: 화면 날씨 → 알림 → 동물마다 버티기(움찔하거나 신나서 폴짝) ──
  // 날씨는 다음 사건이 올 때까지 남는다(싸우는 동안은 조금 옅게). 새 사건이 오면 앞 날씨는 사라진다
  async function natural(ev) {
    const E = TIMING.EVENT_MS, info = EVENTS[ev.id];
    await camTo(0, 0, 1, 400);
    // 앞 날씨가 다 사라진 뒤에 새 날씨가 나타난다(겹쳐 보이면 사건이 두 개 일어난 것처럼 보인다)
    // 운석은 날씨를 지우지 않고 위에 잠깐 겹쳤다가 사라진다(날씨는 끝까지 남는다)
    const meteor = ev.id === 'meteor';
    if (!meteor) arena.querySelectorAll('.weather').forEach(old => old.animate([{}, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => old.remove()));
    const w = arena.appendChild(Object.assign(document.createElement('div'), { className: `weather w-${ev.id}` }));
    const fall = ev.id === 'meteor' ? TIMING.METEOR_FALL_MS : E * 0.28; // 큰 운석은 천천히 떨어진다(config.js)
    w.style.setProperty('--ms', `${E}ms`);
    w.style.setProperty('--fall', `${fall}ms`);
    w.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 300, fill: 'backwards' });
    if (ev.id === 'meteor') w.innerHTML = '<i class="meteor"></i><b class="mboom"></b><b class="shock"></b><b class="flash"></b>' + bits(7, 'mini', [1.8, 3.6]);
    if (ev.id === 'ash') w.innerHTML = bits(10, 'lava') + bits(12, 'rock');
    if (ev.id === 'whirl') w.innerHTML = TORNADO;
    if (ev.id === 'flood') w.innerHTML = `<div class="water"><b class="surf"></b>${bits(16, 'splash', [0.9, 1.8])}</div>`;
    caption(ev.say);
    $('.round').textContent = `${info.emoji} ${info.name}`;
    sfx.drum();
    pop($('.banner'), `${info.emoji} ${info.name}!`, E * 0.3);
    if (ev.id === 'rain' || ev.id === 'flood') sfx.splash();
    if (ev.id === 'whirl') sfx.bubbles();
    await wait(fall);
    if (ev.id === 'meteor' || ev.id === 'ash') { sfx.land(1e5, true); shake(ev.id === 'meteor' ? 16 : 8); }
    for (const [i, F] of f.entries()) {
      const d = ev.d[i];
      caption(ev.lines[i]);
      if (d < 0) {
        boing(F, d <= -25 ? 1 : 0);
        F.pos.classList.add('hit');
        setTimeout(() => F.pos.classList.remove('hit'), 400);
        pose(F, [{ r: -4, sy: 0.94 }, { r: 3 }, { r: -2, sy: 0.97 }, {}], E * 0.2);
      } else pose(F, [{ dy: 0.25 * F.h, r: 8 }, {}, { dy: 0.15 * F.h, r: 5 }, {}], E * 0.2);
      hurt(F, -d);
      music.danger(f.some(F => F.hp <= 30));
      await wait(E * 0.3);
    }
    if (meteor) w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1200, fill: 'forwards' }).finished.then(() => w.remove());
    else w.animate([{ opacity: 1 }, { opacity: 0.8 }], { duration: 1000, fill: 'forwards' });
  }

  // 날씨가 남아 있는 4·5라운드 시작: 영향을 받는 동물마다 한 줄. 힘이 빠지면 움찔, 좋으면 폴짝
  async function weatherNotes(notes) {
    const E = TIMING.EVENT_MS;
    for (const [i, text, d] of notes) {
      const F = f[i];
      caption(text);
      if (d < 0) { boing(F, 0); hurt(F, -d); pose(F, [{ r: -4, sy: 0.94 }, { r: 2 }, {}], E * 0.15); }
      else pose(F, [{ dy: 0.15 * F.h, r: 6 }, {}], E * 0.15);
      await wait(E * 0.25);
    }
  }

  // ── 라운드 사이 숨 고르기: 제자리에서. 힘이 많으면 고개를 들고 당당히 천천히, 많이 맞았으면 고개를 숙이고 크게 들썩이며 헉헉 ──
  // 아이들이 글 없이도 누가 지쳤는지 본다. 자리·카메라는 그대로(빙빙 돌기는 정신없어서 뺐다, 2026-11-05)
  const breathe = () => Promise.all(f.map(F => {
    const n = F.hp > 50 ? 2 : 4, k = F.hp > 50 ? 0 : 1; // 지친 쪽은 숨이 빠르다
    const beat = i => (k ? (i % 2 ? { r: -8, sy: 0.93, dy: -0.02 * F.h } : { r: -5, sy: 1.01 }) : (i % 2 ? { r: 7, sy: 1.02 } : { r: 4 }));
    return pose(F, [...Array(n * 2)].map((_, i) => beat(i)).concat([{}]), TIMING.BREATH_MS, 'linear');
  }));
  // 이긴 동물: 신나서 폴짝폴짝(날거나 헤엄치는 동물은 위로 둥실). 결과 화면으로 넘어가기 전에 잠깐 보여 준다
  const cheer = W => pose(W, [{ dy: 0.18 * W.h, r: 12 }, { r: 2 }, { dy: 0.18 * W.h, r: 12 }, { r: 2 }, {}], TIMING.WIN_MS)
    .then(() => W.mode === 'ground' && sfx.land(W.a.mass_kg.avg));

  // ── 등장: VS → 뛰어/날아/헤엄쳐 들어와서 으르렁 ──
  const I = TIMING.INTRO_MS;
  caption(script.intro);
  setStageSound(stage);
  music.start(stage);
  sfx.drum();
  $('.vs').animate([{ opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, offset: 0.15 }, { opacity: 1, scale: 1, offset: 0.75 }, { opacity: 0, scale: 0.9 }], I);
  f.forEach(F => { F.x = -F.dir * (W / 2 + F.L); F.y = F.rest; });
  await Promise.all(f.map(F => Promise.all([move(F, -F.dir * gap, F.rest, I * 0.7, 'ease-out'), idle(F, I * 0.7, 3)])));
  // 차례로 운다: 앞 동물의 울음이 거의 끝나갈 때(70%) 다음 동물이 받아친다. 울기 전에 카메라가 그 얼굴로 천천히 다가간다
  // 3D: 45도 비스듬히(arena3d closeup), 2D: 몸 앞쪽으로 확대만. 기기에서 '동작 줄이기'를 켰으면 넓은 화면 그대로
  const C = TIMING.CLOSE_MS, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const closeup = F => (view3d ? view3d.closeup(F ? f.indexOf(F) : null, C)
    : F ? camTo(...frame([[F.x, F.y + F.h], [F.x - F.dir * 0.35 * F.L, F.y + 0.3 * F.h]], zCap), C) : camTo(0, 0, 1, C));
  for (const F of f) {
    if (!calm) await closeup(F);
    F.pos.classList.add('biting');
    const len = sfx.voice(F.a) * 1000;
    await pose(F, [{ r: 10 }, {}], Math.min(I * 0.3, len));
    F.pos.classList.remove('biting');
    await wait(Math.max(0, len * 0.7 - I * 0.3));
  }
  if (!calm) await closeup(null);

  // ── 라운드(최대 5): 공격 두 번(각각 다가가기 20% → 공격 80%) → 제자리 ──
  const R = TIMING.ROUND_MS, slot = R * 0.42;
  let ko = false;
  for (const [i, r] of script.rounds.entries()) {
    if (r.notes?.length) await weatherNotes(r.notes);
    if (r.event) {
      await natural(r.event);
      if (!r.attacks.length) { f[r.winner].plate.querySelectorAll('.pips u')[i].classList.add('won'); break; } // 사건으로 힘이 다 빠짐 → 물러남
    }
    $('.round').textContent = `${i + 1}라운드${r.wx ? ` ${EVENTS[r.wx].emoji}` : ''}`; // 날씨가 남아 있으면 같이 보여 준다
    pop($('.banner'), `${i + 1}라운드`, R * 0.3);
    music.level(i < 2 ? 1 : i < 4 ? 2 : 3); // 라운드가 갈수록 빠르고 강하게
    sfx.bell();
    for (const t of r.attacks) {
      const [Att, Def] = [f[t.by], f[1 - t.by]];
      caption(t.text);
      await Promise.all(f.map(F => goTo(F, -F.dir * close, F.engage, slot * 0.2)));
      await strike(Att, Def, t, t.ko ? 2 : t.dmg >= 25 ? 1 : 0, slot * 0.8 * (t.ko ? TIMING.KO_SLOW : 1), t.hit); // 마지막 한 방은 느리게
      if (t.hit) { hurt(Def, t.dmg); music.danger(f.some(F => F.hp <= 30)); }
      else caption(t.dodgeText);
      if (t.wxText) { caption(t.wxText); await wait(900); } // 날씨 때문에 맞거나 빗나갔다
      if (t.ko) { ko = true; break; }
    }
    f[r.winner].plate.querySelectorAll('.pips u')[i].classList.add('won');
    if (ko) break;
    await Promise.all([camTo(0, 0, 1, R * (tiny ? 0.3 : 0.16)), ...f.map(F => goTo(F, -F.dir * gap, F.rest, R * 0.16))]); // 크게 확대했던 판은 천천히 빠진다
    if (i < script.rounds.length - 1) await breathe();
  }

  const [Wf, Lf] = [f[res.winner], f[1 - res.winner]];
  if (ko) {
    // ── K.O.: 쓰러져 납작, 머리 위로 별이 빙글빙글 ──
    const O = TIMING.KO_MS;
    caption(script.outro);
    Lf.pos.classList.add('tired');
    $('.boom').classList.add('ko');
    pop($('.boom'), 'K.O.!', O * 0.6);
    music.end('ko');
    sfx.ko();
    setTimeout(() => { sfx.voice(Wf.a); if (!isMusicOn()) sfx.fanfare(); }, O * 0.35);
    const sx = Lf.x - Lf.dir * 0.12 * Lf.bw, sy = Lf.h * 0.62, s = Lf.h * 0.16;
    for (let k = 0; k < 3; k++) {
      fx.insertAdjacentHTML('beforeend', `<text class="star" font-size="${s * 2}" x="0" y="0">★</text>`);
      const el = fx.lastChild;
      el.animate([...Array(13)].map((_, j) => {
        const a = (j / 12 + k / 3) * Math.PI * 2;
        return { transform: `translate(${sx + Math.cos(a) * s * 2.2}px,${-sy - s + Math.sin(a) * s * 0.7}px)` };
      }), { duration: 900, iterations: Infinity });
    }
    Wf.pos.classList.add('biting');
    const back = move(Wf, Wf.x - Wf.dir * (0.15 * Wf.L + 0.5 * Lf.bw), Wf.rise ? Wf.engage + 0.5 * Wf.h : 0, O * 0.3); // 쓰러진 상대에게서 물러나(자리는 바로 바뀐다)
    await Promise.all([
      // 멀리서 둘 다 보이게: 쓰러진 쪽(별)과 이긴 쪽을 함께 담는다. 크기 차가 아주 큰 판만 작은 쪽을 당겨 본다
      camTo(...(tiny ? [sx, sy * 0.6, clamp((H * 0.3) / PULL / Lf.h, 1, zCap)] : frame([[sx, sy + 2 * s], bodyAt(Lf), ...ends(Wf), bodyAt(Wf)], 1.3)), O * 0.4),
      back,
      pose(Wf, [{ r: 14 }, { r: 2 }, { r: 14, sx: 1.04, sy: 1.04 }, { r: 4, sx: 1.04, sy: 1.04 }], O * 0.5),
    ]);
    Wf.pos.classList.remove('biting');
    await cheer(Wf);
    return;
  }

  // ── 물러남: 진 쪽은 고개를 떨구고 물러나고(날거나 헤엄쳐 떠나고), 이긴 쪽은 크게 으르렁 ──
  const O = TIMING.OUTRO_MS;
  caption(script.outro);
  Lf.pos.classList.add('tired');
  Wf.pos.classList.add('biting');
  sfx.voice(Wf.a);
  music.end('win');
  if (!isMusicOn()) setTimeout(sfx.fanfare, O * 0.4);
  await Promise.all([
    camTo(Wf.x - Wf.dir * Wf.L * 0.5, Wf.y + Wf.h * 0.5, 1.1, O * 0.4),
    move(Lf, Lf.x - Lf.dir * 0.8 * Lf.L, Lf.rise ? Lf.y + Lf.h : 0, O, 'ease-in'),
    anim(Lf.pos, [{ opacity: 1 }, { opacity: 0.55 }], O),
    pose(Lf, [{ r: -6, sy: 0.95 }, { r: -3, sy: 0.96 }, { r: -8, sy: 0.93 }], O),
    pose(Wf, [{ r: 14 }, { r: 2 }, { r: 14, sx: 1.04, sy: 1.04 }, { r: 4, sx: 1.04, sy: 1.04 }], O),
  ]);
  Wf.pos.classList.remove('biting');
  await cheer(Wf);
}
