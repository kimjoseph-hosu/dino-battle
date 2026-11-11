// 블록 3D 동물(PLAN_BLOCK3D, ?art=block). 모든 부위가 상자(둥근 면 없음).
// shape3d.js 와 같은 몸 좌표·같은 rig { root, all, head(⊃jaw), tail[], legs[{ g, knee, side, front }], wings[], swim, fly } 를 돌려줘서
// motion3d.js(동작)·draw3d.js(찍기)·arena3d.js(무대)를 고치지 않고 그대로 쓴다.
// 디테일 4겹: 체형 틀 12개(여기) + 특징 부품·얼굴(blockParts.js) + 픽셀 무늬(blockSkin.js) + 인기 동물 손질(OVERRIDE)
// 블록 눈금: x 꼬리끝 0 → 코끝 N(=BLOCK.UNIT), y 땅 0에서 위, z 카메라 쪽
import { N, col, group, box, both, J, piv, chain, segChain, tailChain, slab, taper, eyes, head, bodyDeco, tailTip, feathers, fin, clear, CLAW, EYE, HORN, SPARK } from './blockParts.js';
import * as THREE from 'three';
import { BLOCK } from '../config.js';
import { skinTex, TEX_BLOCKS } from './blockSkin.js';
import { ARCHETYPES } from './draw.js';
import { LOOK } from './blockLook.js';

const lerp = (a, b, t) => a + (b - a) * t;
// 목: 어깨 (x0, y0) → 머리 뒤 (x1, y1)를 n마디 상자로. 굵기 th0 → th1, arc 만큼 위로 휜다(용각류)
function neckBoxes(x0, y0, x1, y1, th0, th1, wd, paint, arc = 0) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.min(9, Math.round(d / 1.4)));
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n, th = lerp(th0, th1, t), dx = Math.abs(x1 - x0) / n, dy = Math.abs(y1 - y0) / n;
    return box(lerp(x0, x1, t), lerp(y0, y1, t) + arc * Math.sin(Math.PI * t), 0, Math.max(th * 0.85, dx + 0.7), Math.max(th, dy + 0.7), wd * lerp(1, 0.75, t), paint);
  });
}

// ── 두발(수각류·새). params: hipX·h 엉덩이, bd 몸 굵기, hl·dp 머리, neck 목 높이, arm 팔, hand 'rex', leg 다리 굵기, head, wing 날개, sail 돛
function biped(p, K) {
  const F = K.F, bird = K.arch === 'bird', X = (p.hipX ?? 0.47) * N, H = p.h * N, R = p.bd * N, W = R * (bird ? 1.9 : 1.7), lr = p.leg ?? 1;
  const by = H + R * 0.55; // 몸통 가운데 높이
  const torso = bird
    ? [box(X + R * 0.3, by, 0, R * 2.6, R * 2, W, K.body), box(X + R * 1.3, by + R * 0.25, 0, R * 1.2, R * 1.6, W * 0.9, K.body), box(X + R * 0.3, by - R * 0.95, 0, R * 2, R * 0.4, W * 0.85, K.under)]
    : [slab(X - 2.4, X + 5.7, t => [by - R * 0.12 * t, R * 2 * (0.78 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.15))), W * (0.82 + 0.18 * Math.sin(Math.PI * t))], K.body), box(X + 1.6, by - R * 0.95, 0, 4.5, R * 0.5, W * 0.8, K.under)];
  const type = p.skull === 'rex' ? 'rex' : p.head && p.head !== 'thero' ? p.head : bird ? 'beakHook' : 'thero';
  const hl = p.hl * N, hd = hl * p.dp * (type === 'rex' ? 0.95 : 0.8), hw = Math.max(R * (bird ? 0.7 : 1.1), hd * 0.9), hx = N - hl, hy = by + R * 0.9 * (p.neck ?? 1);
  const n0 = [X + (bird ? R * 1.5 : 5.2), by + R * 0.2], n1 = [hx + 0.4, hy - hd * 0.15];
  const neck = neckBoxes(n0[0], n0[1], n1[0], n1[1], R * (bird ? 0.8 : 1.4), R * (bird ? 0.5 : 1), W * 0.62, K.body);
  const hd0 = head(type, hx, hy, hl, hd, hw, K, p);
  const headJ = J(n0[0] - 0.4, n0[1], neck, hd0.parts, hd0.jaw);
  // 팔·날개
  const wings = [];
  let arms;
  if (p.wing) arms = both(sd => { // 펼친 날개(어깨에서 퍼덕): 바깥으로 갈수록 짧아지는 깃털 판 세 장
    const span = p.wing * N * 0.9, sx = X + R, sy = by + R * 0.5;
    const j = J(sx, sy, [0, 1, 2].map(i => box(sx - R * 0.3 - i * 0.3, sy + 0.1 * i, sd * (W / 2 + (span * (i + 0.5)) / 3), R * (1.9 - i * 0.45), 0.35, span / 3 + 0.1, i === 2 ? K.dark : K.feather)));
    j.userData.side = sd;
    wings.push(j);
    return j;
  });
  else if (bird) arms = both(sd => feathers(X + R * 0.7, by + R * 0.35, sd * (W / 2 + 0.1), R * 2.2, R * 0.75, K, 3)); // 접은 날개
  else {
    const al = Math.max(p.arm * N, 1.4), fingers = p.hand === 'rex' ? 2 : 3, cl = F.includes('claws') ? 0.9 : 0.4;
    arms = both(sd => {
      const z = sd * W * 0.44, sx = X + 5, sy = by - R * 0.35;
      return group(box(sx, sy - al * 0.3, z, 0.6, al * 0.6, 0.6, K.limb), box(sx + al * 0.3, sy - al * 0.6, z, al * 0.6, 0.45, 0.5, K.limb),
        Array.from({ length: fingers }, (_, i) => box(sx + al * 0.65, sy - al * 0.6 - cl * 0.55, z + (i - (fingers - 1) / 2) * 0.24, 0.24, cl, 0.18, CLAW)),
        F.includes('feathers') ? feathers(sx + al * 0.3, sy - al * 0.6 - 0.4, z + sd * 0.15, al * 0.9, 0.55, K, 2) : null);
    });
  }
  // 다리: 넓적다리(엉덩이 관절) → 무릎 관절 → 정강이 → 발목 → 발 + 발톱
  const legs = both(sd => {
    const tw = R * 0.85 * lr, td = R * 0.7 * lr, z = sd * (W / 2 - td * 0.3), ky = H * 0.5, ay = H * 0.2, kx = X + 0.7, fl = Math.max(2, R * (bird ? 0.8 : 1.1)), fx = X + 0.4;
    const toe = k => fl * (k ? 0.5 : 0.68), tz = k => z + k * td * 0.34; // 발가락 셋: 가운데가 길다
    const foot = group(box(fx - fl * 0.18, 0.32, z, fl * 0.64, 0.64, td * 0.9, K.limb), [-1, 0, 1].map(k => [box(fx + fl * 0.1 + toe(k) / 2, 0.24, tz(k), toe(k), 0.48, td * 0.26, K.limb), box(fx + fl * 0.1 + toe(k) + 0.18, 0.2, tz(k), 0.4, 0.4, td * 0.22, CLAW)]),
      bird ? box(fx - fl * 0.6, 0.2, z, fl * 0.4, 0.35, 0.3, K.limb) : null, // 뒤로 난 발가락
      F.includes('sickle_claw') ? piv(fx + fl * 0.15, 0.6, z, [0, 0, -0.5], box(0, 0.55, 0, 0.32, 1.1, 0.32, CLAW)) : null); // 들어 올린 낫 발톱
    const knee = J(kx, ky, box(kx - 0.2, (ky + ay) / 2, z, tw * 0.55, ky - ay + 0.4, td * 0.6, K.limb), box(X - 0.1, ay / 2 + 0.3, z, tw * 0.42, ay + 0.2, td * 0.5, K.limb), foot);
    const thigh = H + R * 0.6 - ky, muscle = box(X + 0.35, ky + thigh * 0.68, z + sd * td * 0.12, tw * 1.18, thigh * 0.5, td * 1.05, K.limb); // 허벅지 근육: 위쪽이 불룩
    return { g: J(X, H + R * 0.3, box(X + 0.3, (H + R * 0.6 + ky) / 2, z, tw, thigh, td, K.limb), muscle, knee), knee, side: sd, front: false };
  });
  // 꼬리. 새는 짧은 꼬리 + 깃털 부채, 깃털 공룡은 꼬리 끝 깃털
  const tail = bird
    ? tailChain(X - R, by + R * 0.3, X - R * 2.2, by + R * 0.6, [R * 1.3, R * 0.7], 0.9, K.body, group(box(X - R * 2.4, by + R * 0.65, 0, R * 1.6, R * 0.3, W * 0.85, K.feather), box(X - R * 2.6, by + R * 0.85, 0, R * 1.2, R * 0.2, W * 0.6, K.dark)))
    : tailChain(X - 2.2, by + R * 0.15, 0, by - R * 0.5, taper(BLOCK.TAIL, R * 1.75, R * 0.35), 0.9, K.body, F.includes('feathers') ? both(sd => feathers(2.5, by - R * 0.35, sd * R * 0.35, 4, 0.5, K, 2)) : null);
  const top = t => [X - 2 + t * 7, by + R * 0.9];
  const all = J(X, by, torso, tail[0], headJ, arms, legs.map(l => l.g), bodyDeco(K, top, R, W, (p.sail ?? 0) * N));
  return { root: group(all), all, head: headJ, jaw: hd0.jaw, tail, legs, wings };
}

// ── 네발 몸통·다리·꼬리(용각류·뿔공룡·갑옷공룡·포유류·악어형이 같이 쓴다)
// params: b0~b1 몸통, hip·sh 엉덩이·어깨 높이, bd 몸 굵기, legR 다리 굵기, frontLeg, bend 다리가 옆으로 벌어짐, tail [x, y], tr 꼬리 굵기
function quadBody(p, K, wk) {
  const F = K.F, x0 = p.b0 * N, x1 = p.b1 * N, L = x1 - x0, R = p.bd * N, Hh = p.hip * N, Hs = p.sh * N, W = R * 2 * wk, bend = p.bend ?? 0;
  const yAt = x => Hh + ((Hs - Hh) * (x - x0)) / L + R * 0.4; // 몸통 가운데 높이
  const body = [slab(x0 - L * 0.03, x1 + L * 0.03, t => { const k = Math.sin(Math.PI * t); return [yAt(x0 + L * t) - R * 0.05 * k, R * 2 * (0.88 + 0.2 * k), W * (0.9 + 0.14 * k)]; }, K.body)]; // 가운데가 불룩
  body.push(box(x0 + L * 0.5, yAt(x0 + L * 0.5) - R * 1.0, 0, L * 0.6, R * 0.25, W * 0.85, K.under)); // 배
  const lw = Math.max(1, p.legR * N * 2.6), nimble = K.arch === 'large_mammal' && p.legR < 0.045 && !bend; // 날렵한 포유류(고양이·개·사슴)
  const leg = (x, front, sd) => {
    const w = lw * (front ? p.frontLeg ?? 1 : 1), top = yAt(x) - R * 0.3, z = sd * (W / 2 - w * 0.45), ky = top * 0.45, out = sd * w * 1.4 * bend, zf = z + out;
    const claws = front && F.includes('claws') ? [-1, 0, 1].map(k => piv(x + w * 0.4, 0.4, zf + k * w * 0.3, [0, 0, -2.2], box(0, 0.8, 0, 0.3, 1.6, 0.3, CLAW))) // 큰 앞발톱
      : [-1, 0, 1].map(k => box(x + w * 0.55 + 0.1, 0.22, zf + k * w * 0.33, bend ? 0.8 : 0.25, 0.42, w * 0.24, bend ? CLAW : K.nail));
    const foot = group(box(x + 0.15, 0.3, zf, w * (nimble ? 1.3 : 1.1), 0.6, w * 1.1, K.limb), claws);
    const lower = box(x, (ky + 0.6) / 2, zf, w * (nimble ? 0.6 : 0.85), ky - 0.3, w * 0.85, K.limb);
    const knee = J(x, ky, lower, foot);
    const upper = bend ? box(x, top - w * 0.2, z + out / 2, w, Math.max(w, top - ky), Math.abs(out) + w, K.limb) // 옆으로 뻗은 윗다리(악어형)
      : box(x, (top + R * 0.5 + ky) / 2, z, w * (nimble ? 0.85 : 1), top + R * 0.5 - ky, w, K.limb);
    const skirt = F.includes('fur') ? [-1, 0, 1].map(k => box(x + k * w * 0.4, ky - 0.2 - ((k + 1) % 2) * 0.4, z, w * 0.5, 1.4 + ((k + 1) % 2) * 0.6, w * 1.25, K.dark)) : null; // 무릎 위 털 치마
    const haunch = !front && !bend && !F.includes('fur') ? box(x - w * 0.1, top - w * 0.1, z + sd * w * 0.08, w * 1.35, Math.max(w, (top - ky) * 0.55), w * 1.08, K.limb) : null; // 뒷다리 허벅지 근육
    return { g: J(x, top, upper, haunch, skirt, knee), knee, side: sd, front };
  };
  const legs = [];
  for (const sd of [1, -1]) legs.push(leg(x1 - lw * 0.6 - 0.3, true, sd), leg(x0 + lw * 0.6 + 0.3, false, sd));
  const [tx, ty] = p.tail, tr = Math.max(0.5, p.tr * N * 2.2), long = K.arch === 'sauropod';
  const tip = group(F.includes('fur') ? box(tx * N - 0.3, ty * N - 0.5, 0, 0.8, 1.4, 0.8, K.dark) : null, tailTip(K, tx * N, ty * N, tr * 0.6)); // 털술·곤봉·가시
  const hs = taper(long ? 9 : 6, tr, tr * (long ? 0.2 : 0.4)).map(h => Math.max(0.4, h));
  const tail = tailChain(x0 + 0.5, yAt(x0) + R * 0.2, tx * N, ty * N, hs, 0.9, K.body, tip);
  return { body, legs, tail, yAt, x0, x1, L, R, W, top: t => [x0 + t * L, yAt(x0 + t * L) + R * 0.95] };
}

const WIDE = { armored: 1.35, sprawler: 1.3, ceratopsian: 1.05, sauropod: 0.95 };
const QHEAD = { ceratopsian: 'cerato', large_mammal: 'mammal', sauropod: 'sauro', armored: 'small', sprawler: 'croc' };
// 네발 틀. params: neck [x, y] 머리 자리, nr 목 굵기, hl·dp 머리, head, sail
function quad(p, K) {
  const F = K.F, Q = quadBody(p, K, WIDE[K.arch] ?? 0.85), type = p.head ?? QHEAD[K.arch], hl = p.hl * N, [nx, ny] = [p.neck[0] * N, p.neck[1] * N];
  let hx = nx - hl * 0.1, hd = Math.max(1, hl * p.dp * 0.45), hw = Math.max(1, Math.min(Q.W * 0.6, hd * 1.1));
  if (type === 'cerato') [hx, hd, hw] = [nx - hl * 0.25, hl * p.dp * 0.55, Q.W * 0.62];
  if (type === 'mammal') { hx = nx - hl * 0.15; hd = hl * p.dp * 0.6; hw = Math.min(Q.W * 0.75, hd * 0.9); }
  if (type === 'croc') { hd = Math.max(1, hl * p.dp * 0.4); hw = Math.max(1.2, hl * 0.32); }
  const hd0 = head(type, hx, ny, hl, hd, hw, K, p);
  const sx = Q.x1 - 0.5, sy = Q.yAt(Q.x1) + Q.R * 0.3, nr = Math.max(1, (p.nr ?? 0.05) * N * 2.4);
  const neck = neckBoxes(sx + 0.5, sy, hx + 0.6, ny, type === 'cerato' ? Q.R * 1.5 : K.arch === 'sauropod' ? Q.R * 1.4 : Math.max(nr, Q.R * 0.9), Math.max(nr * 0.8, hd * (K.arch === 'sauropod' ? 1 : 0.8)), Q.W * 0.6, K.body, K.arch === 'sauropod' ? Q.R * 0.6 : 0);
  // 털: 몸통 아랫단 들쭉날쭉한 털끝 + 목 갈기
  const fur = F.includes('fur') ? [
    ...Array.from({ length: Math.ceil(Q.L / 0.9) }, (_, i) => { const x = Q.x0 + 0.45 + i * 0.9, h = 0.9 + K.rnd() * 1.4; return both(sd => box(x, Q.yAt(x) - Q.R * 0.95 - h / 2 + 0.4, sd * Q.W * 0.5, 0.95, h, 0.5, i % 2 ? K.dark : K.body)); }),
    box(Q.x1 + 0.6, Q.yAt(Q.x1) - Q.R * 0.6, 0, 2, Q.R * 1.4, Q.W * 0.75, K.dark),
  ] : null;
  const headJ = J(sx, sy, neck, hd0.parts, hd0.jaw);
  const all = J((Q.x0 + Q.x1) / 2, Q.yAt((Q.x0 + Q.x1) / 2), Q.body, Q.tail[0], headJ, Q.legs.map(l => l.g), bodyDeco(K, Q.top, Q.R, Q.W, (p.sail ?? 0) * N), fur);
  return { root: group(all), all, head: headJ, jaw: hd0.jaw, tail: Q.tail, legs: Q.legs, wings: [], nod: F.includes('shell') ? 0.4 : 1 };
}

// 지느러미발·지느러미(다리 자리): 관절 (x, y), 아래·뒤로 len 만큼, 바깥으로 벌림
const flipper = (x, y, z, len, w, paint, sd, front, rz = 2.4) => ({ g: J(x, y, piv(x, y, sd * z, [-sd * 0.6, 0, rz], box(0, len / 2, 0, w, len, 0.35, paint), box(0, len * 0.92, 0, w * 0.6, len * 0.18, 0.4, paint))), side: sd, front });
// 꼬리지느러미: 초승달(위·아래 날개) 또는 모사사우루스형(아래 날개가 크다)
const fluke = (x, y, R, up, down, paint) => group(fin(x, y, R * 2.4 * up, R * 1.3, paint, 0.65), fin(x, y, R * 2.4 * down, R * 1.3, paint, Math.PI - 0.65));

// ── 헤엄치는 파충류·고래(모사사우루스, 수장룡, 어룡, 거북, 바실로사우루스). params: bd, hl·dp, neckL 목, fl 지느러미발, flukeUp, head(beak = 거북)
function marine(p, K) {
  const F = K.F, R = p.bd * N, hl = p.hl * 1.65 * N, fl = p.fl ?? 1, y = p.bd * (1.2 + fl * 0.65) * N, shell = F.includes('shell'), neckL = (p.neckL ?? 0) * N;
  const hx = N - hl, front = neckL ? hx - neckL * 0.9 : hx + hl * 0.25, hy = neckL ? y + R * 1.5 : y - R * 0.1, x0 = 0.4 * N, L = front - x0, W = R * 1.5 * (shell ? 1.5 : 1);
  const body = [slab(x0 - L * 0.03, x0 + L * 1.03, t => { const k = Math.sin(Math.PI * t); return [y, R * 2 * (0.85 + 0.3 * k) * (shell ? 1.1 : 1), W * (0.85 + 0.15 * k)]; }, K.body)];
  body.push(box(x0 + L * 0.5, y - R * 1.1, 0, L * 0.7, R * 0.3, W * 0.8, K.under));
  const tf = F.includes('tail_fluke'), up = p.flukeUp ?? 0.4, down = tf && up < 0.6 ? R * 1.4 : 0, tl = tf ? 1 : 0.6;
  const tail = segChain([[0.44 * N, y, 0, R * 1.7], [0.3 * N, y, 0, R * 1.2 * tl], [0.2 * N, y - down * 0.05, 0, R * 0.85 * tl], [0.12 * N, y - down * 0.25, 0, R * 0.55 * tl], [0.05 * N, y - down * 0.6, 0, R * 0.3 * tl], [0.01 * N, y - down, 0, 0]], 0.7, K.body,
    tf ? fluke(0.03 * N, y - down, R, down ? 0.35 : up, down ? 0.9 : Math.max(up, 0.7), K.body) : null);
  const type = p.head === 'beak' ? 'beak' : 'mosa', hd = Math.max(1, hl * (p.dp ?? 0.6) * 0.42), hw = Math.max(1, hd * 1.1);
  const hd0 = head(type, hx, hy, hl, hd, hw, K, p);
  const neck = neckL ? neckBoxes(front, y + R * 0.2, hx + 0.6, hy, R * 1.2, R * 0.75, R * 1.1, K.body) : [box((front + hx + 1) / 2, y, 0, Math.max(1, hx + 1 - front), R * 1.5, W * 0.6, K.body)];
  const headJ = J(neckL ? front : hx + hl * 0.07, y, neck, hd0.parts, hd0.jaw);
  const fx = x0 + L * 0.75, fw = Math.max(1, R * 0.9 * Math.sqrt(fl));
  const legs = [...both(sd => flipper(fx, y - R * 0.6, W * 0.45, 0.14 * fl * N, fw, K.limb, sd, true)), ...both(sd => flipper(0.45 * N, y - R * 0.6, W * 0.45, 0.1 * fl * N, fw * 0.8, K.limb, sd, false))];
  const deco = [
    F.includes('dorsal') ? fin(0.55 * N, y + R * 0.9, R * 1.8, R * 1.8, K.body, 0.5) : null,
    shell ? [box(x0 + L * 0.5, y + R * 0.6, 0, L * 1.05, R * 1.0, W * 1.05, K.shell), box(x0 + L * 0.5, y + R * 1.15, 0, L * 0.7, R * 0.5, W * 0.7, K.shell)] : null, // 거북 등딱지
  ];
  const all = J(0.55 * N, y, body, tail[0], headJ, legs.map(l => l.g), deco);
  return { root: group(all), all, head: headJ, jaw: hd0.jaw, tail, legs, wings: [], swim: true };
}

// ── 물고기·상어. params: bd, hl·dp, flukeUp·flukeDown, head 'plate'(둔클레오스테우스)
function fish(p, K) {
  const F = K.F, R = p.bd * N, hl = p.hl * N, y = p.bd * 2.2 * N, W = R * 1.6, plate = p.head === 'plate';
  const body = [slab(0.32 * N, 0.83 * N, t => { const h = R * (1.5 + 0.55 * Math.sin(Math.PI * Math.pow(t, 0.8))); return [y + R * 0.06, h, W * (h / (2 * R))]; }, K.body)];
  body.push(box(0.6 * N, y - R * 0.8, 0, 0.32 * N, R * 0.4, W * 0.8, K.under));
  const tail = segChain([[0.32 * N, y, 0, R * 1.4], [0.2 * N, y, 0, R * 0.8], [0.1 * N, y, 0, R * 0.4], [0.04 * N, y, 0, 0]], 0.7, K.body, fluke(0.05 * N, y, R, p.flukeUp ?? 1, p.flukeDown ?? 0.8, K.body));
  const x0 = N - hl * 1.1, hd = R * 1.8, hw = W * 0.85, my = y - R * 0.45;
  const parts = [
    box(x0 + hl * 0.4, y + R * 0.08, 0, hl * 0.8, hd, hw, plate ? K.dark : K.body),
    box(x0 + hl * 0.92, y + R * 0.2, 0, hl * 0.32, hd * 0.6, hw * 0.6, plate ? K.dark : K.body), // 뭉툭한 주둥이
    box(x0 + hl * 0.6, my + 0.15, 0, hl * 0.7, 0.3, hw * 0.6, '#5a2f2c'),
    eyes(x0 + hl * (plate ? 0.72 : 0.68), y + R * 0.4, hw / 2, Math.max(0.5, R * 0.38), K),
    plate ? box(x0 + hl * 1.0, my - 0.2, 0, 0.5, 0.9, hw * 0.4, '#f3edd9') // 칼날 턱뼈
      : [0, 1, 2, 3].map(i => both(sd => box(x0 - i * 0.7, y, sd * W * 0.46, 0.2, R * 1.1, 0.1, K.ridge))), // 아가미 틈
  ];
  const jaw = J(x0 + hl * 0.2, my, box(x0 + hl * 0.6, my - R * 0.25, 0, hl * 0.8, R * 0.5, hw * 0.75, K.under),
    plate ? null : Array.from({ length: 5 }, (_, i) => both(sd => box(x0 + hl * (0.4 + i * 0.12), my + 0.2, sd * (hw * 0.33), 0.3, 0.45, 0.3, '#f3edd9'))));
  if (!plate) parts.push(Array.from({ length: 6 }, (_, i) => both(sd => box(x0 + hl * (0.35 + i * 0.11), my - 0.2, sd * (hw * 0.28), 0.3, 0.5, 0.3, '#f3edd9'))));
  const headJ = J(x0, y, parts, jaw);
  const legs = [...both(sd => flipper(0.72 * N, y - R * 0.6, W * 0.45, R * 2.2, R * 1.1, K.limb, sd, true, 2.3)), ...both(sd => flipper(0.38 * N, y - R * 0.6, W * 0.4, R * 1.2, R * 0.8, K.limb, sd, false, 2.3))];
  const deco = F.includes('dorsal') ? [fin(0.6 * N, y + R * 0.95, R * 2.2, R * 1.8, K.body, 0.5), fin(0.33 * N, y + R * 0.6, R * 0.7, R * 0.7, K.body, 0.5)] : null;
  const all = J(0.55 * N, y, body, tail[0], headJ, legs.map(l => l.g), deco);
  return { root: group(all), all, head: headJ, jaw, tail, legs, wings: [], swim: true };
}

// ── 익룡. params: h, bd, neck [x, y], hl·dp, crest 볏, longTail, teeth, wing 날개 크기
function ptero(p, K) {
  const R = p.bd * N, H = p.h * N, nx = p.neck[0] * N, ny = p.neck[1] * N, hl = p.hl * N, hd = Math.max(0.8, hl * p.dp * 0.5), span = (p.wing ?? 0.5) * N, crest = p.crest ?? 0;
  const by = H + R * 0.3;
  const torso = [box(0.2 * N, by, 0, R * 2.4, R * 1.8, R * 1.6, K.body), box(0.27 * N, by + R * 0.3, 0, R * 1.2, R * 1.5, R * 1.4, K.body)];
  const hx = nx - hl * 0.05, hd0 = head('ptero', hx, ny, hl, hd, Math.max(0.8, R * 0.8), K, p);
  if (crest) hd0.parts.push(piv(hx + hl * 0.12, ny + hd * 0.4, 0, [0, 0, 0.7], box(0, (hl * p.dp * (0.4 + 1.2 * crest)) / 2, 0, hl * 0.22, hl * p.dp * (0.4 + 1.2 * crest), 0.25, K.accent)));
  const neck = neckBoxes(0.28 * N, by + R * 0.6, hx + 0.4, ny, R * 0.75, R * 0.5, R * 0.7, K.body);
  const headJ = J(0.28 * N, by + R * 0.6, neck, hd0.parts, hd0.jaw);
  // 날개: 어깨에서 바깥(z)으로, 앞쪽 팔뼈 + 뒤로 늘어진 막 세 칸(바깥일수록 좁다)
  const wings = both(sd => {
    const sx = 0.28 * N, sy = by + R * 0.6, z0 = R * 0.7;
    const j = J(sx, sy, box(sx, sy + 0.15, sd * (z0 + span * 0.45), 0.6, 0.45, span * 0.9, K.limb),
      [0.45, 0.3, 0.15].map((len, i) => box(sx - (span * len) / 2 - 0.2, sy, sd * (z0 + span * (0.18 + i * 0.32)), span * len, 0.22, span * 0.34, K.membrane)));
    j.userData.side = sd;
    return j;
  });
  const legs = both(sd => {
    const z = sd * R * 0.5, x = 0.18 * N, ky = H * 0.5;
    const knee = J(x, ky, box(x + 0.2, ky / 2 + 0.2, z, 0.5, ky, 0.5, K.limb), box(x + 0.5, 0.2, z, 1.2, 0.4, 0.7, K.limb));
    return { g: J(x, H, box(x, (H + ky) / 2, z, R * 0.6, H - ky + 0.4, R * 0.6, K.limb), knee), knee, side: sd, front: false };
  });
  const tail = p.longTail ? segChain([[0.12 * N, by, 0, R * 0.5], [0.05 * N, by + R * 0.3, 0, R * 0.2], [0.01 * N, by + R * 0.4, 0, 0]], 1, K.body, box(0.02 * N, by + R * 0.9, 0, 1, R * 0.8, 0.2, K.accent))
    : segChain([[0.12 * N, by, 0, R * 0.6], [0.08 * N, by, 0, 0]], 1, K.body);
  const all = J(0.2 * N, by, torso, tail[0], headJ, wings, legs.map(l => l.g));
  return { root: group(all), all, head: headJ, jaw: hd0.jaw, tail, legs, wings, fly: true };
}

// ── 절지동물(params.kind). 다리 여러 쌍은 앞에서 뒤로 물결치며 꼼지락(ph)
const range = (a, b, n) => [...Array(n)].map((_, i) => a + ((b - a) * i) / (n - 1));
const stillJaw = (x, y) => J(x, y, group());
function manyLegs(xs, top, z, r, K, out = 1) {
  return xs.flatMap((x, i) => both(sd => {
    const knee = J(x, top * 0.4, box(x + r, top * 0.2, sd * (z + out), r, top * 0.4 + 0.2, r, K.dark));
    return { g: J(x, top, box(x, top * 0.7, sd * (z + out / 2), r, r, out + r, K.dark), knee), knee, side: sd, front: i < xs.length / 2, ph: i * 0.8 + (sd > 0 ? 0 : Math.PI) };
  }));
}
const BUGS = {
  trilobite(K) { // 넓적한 세 줄 등딱지(가운데가 솟음) + 마디 고랑 + 머리 방패와 눈
    const y = 0.9, jaw = stillJaw(23, y);
    const legs = manyLegs(range(5, 17, 6), y, 3, 0.3, K, 3);
    const headJ = J(17, y, box(20, y + 0.4, 0, 6, 0.9, 13, K.body), box(20.5, y + 1, 0, 4, 1, 3.5, K.body), both(sd => box(19.5, y + 1.3, sd * 3, 1, 1, 1, EYE)), jaw);
    const tail = [J(3, y, box(2.5, y + 0.3, 0, 4, 0.7, 9, K.body))];
    const all = J(12, y, box(11, y + 0.8, 0, 14, 1.3, 4, K.body), both(sd => box(11, y + 0.35, sd * 4.3, 14, 0.6, 4.6, K.body)), range(5, 17, 9).map(x => box(x, y + 0.6, 0, 0.3, 1.6, 12.6, K.ridge)), headJ, tail[0], legs.map(l => l.g));
    return { root: group(all), all, head: headJ, jaw, tail, legs, nod: 0.2 };
  },
  anomalocaris(K) { // 납작한 몸 + 양옆 물결 날개판 + 꼬리 부채 + 앞 집게다리 + 자루 눈
    const y = 3.1, jaw = stillJaw(23.5, y);
    const legs = range(5, 19, 10).flatMap((x, i) => both(sd => ({ g: J(x, y, box(x, y - 0.2, sd * 2.8, 1.3, 0.2, 2.8 + Math.sin(i / 3), K.accent)), side: sd, front: i < 5, ph: i * 0.7 })));
    const tail = segChain([[3, y, 0, 1.2], [1, y, 0, 0]], 1.5, K.body, [-0.5, 0, 0.5].map(a => piv(1, y, 0, [a, 0, 0], box(-1, 0, 0, 2.2, 0.2, 2.5, K.accent))));
    const headJ = J(20, y, box(22, y, 0, 3, 1.4, 2.4, K.body), both(sd => [chain(23, y - 0.3, sd * 0.7, [0, 0, -2], [{ len: 1.5, w: 0.5 }, { len: 1.3, w: 0.4, bend: 0.6 }, { len: 1, w: 0.3, bend: 0.7 }], K.dark), box(21, y + 1, sd, 0.3, 1.2, 0.3, K.dark), box(21, y + 1.8, sd * 1.3, 0.9, 0.9, 0.9, EYE)]), jaw);
    const all = J(12, y, range(5, 19, 6).map((x, i) => box(x, y, 0, 3, 1.2 + i * 0.1, 2.6 + i * 0.15, K.body)), tail[0], headJ, legs.map(l => l.g));
    return { root: group(all), all, head: headJ, jaw, tail, legs, swim: true, nod: 0.4 };
  },
  hallucigenia(K) { // 가는 관 몸 + 아래로 긴 다리 + 등 가시 + 둥근 머리
    const y = 2.4, jaw = stillJaw(23.5, y);
    const legs = manyLegs(range(5, 20, 7), y, 0.4, 0.25, K, 0.3);
    const headJ = J(21.5, y, box(23, y + 0.3, 0, 1.8, 1.6, 1.6, K.body), both(sd => box(23.6, y + 0.7, sd * 0.6, 0.35, 0.35, 0.3, EYE)), jaw);
    const tail = segChain([[4, y, 0, 1.2], [0.5, y - 0.2, 0, 0]], 1, K.body);
    const all = J(12, y, box(13, y, 0, 18, 1.3, 1.3, K.body), range(5, 18, 7).map(x => both(sd => piv(x, y + 0.6, sd * 0.3, [sd * 0.3, 0, -0.25], box(0, 1.8, 0, 0.3, 3.6, 0.3, K.accent)))), headJ, tail[0], legs.map(l => l.g));
    return { root: group(all), all, head: headJ, jaw, tail, legs, nod: 0.5 };
  },
  eurypterid(K) { // 머리 방패 + 마디진 배 + 꼬리 가시 + 노다리
    const y = 1.9, jaw = stillJaw(23, y);
    const legs = manyLegs(range(16, 21, 4), y, 1.5, 0.3, K, 1.2);
    const paddles = both(sd => ({ g: J(15, y, box(13, y - 0.4, sd * 3.2, 3.5, 0.25, 2, K.dark)), side: sd, front: false }));
    const headJ = J(16, y, box(19.5, y + 0.3, 0, 7, 1, 4.6, K.body), both(sd => box(20.5, y + 1, sd * 1.4, 0.8, 0.6, 0.8, EYE)), jaw);
    const tail = segChain([[7, y, 0, 1.4], [3.5, y + 0.4, 0, 0.6], [0, y + 1.4, 0, 0]], 1, K.body);
    const all = J(12, y, range(8, 15.5, 6).map((x, i) => box(x, y, 0, 1.5, 1.2 + i * 0.1, 2.2 + i * 0.4, i % 2 ? K.dark : K.body)), headJ, tail[0], legs.map(l => l.g), paddles.map(l => l.g));
    return { root: group(all), all, head: headJ, jaw, tail, legs: [...legs, ...paddles], nod: 0.3 };
  },
  dragonfly(K) { // 큰 겹눈 머리 + 가슴 + 길고 가는 배 + 투명한 날개 넷 + 다리 세 쌍
    const y = 2.9, glassy = clear('#cfe8f0', 0.45), jaw = stillJaw(21, y);
    const wings = [[17.5, 1], [15.5, 0.85]].flatMap(([x, k]) => both(sd => { const j = J(x, y + 0.9, box(x - 0.3, y + 0.9, sd * 4.2 * k, 1.6, 0.1, 7.5 * k, glassy), box(x + 0.3, y + 0.95, sd * 4.2 * k, 0.15, 0.15, 7.5 * k, K.dark)); j.userData.side = sd; return j; }));
    const legs = manyLegs([16, 17, 18], y - 0.5, 0.5, 0.2, K, 0.8);
    const headJ = J(19, y, box(20.2, y + 0.2, 0, 1.6, 1.6, 1.8, K.body), both(sd => box(20.6, y + 0.4, sd * 1, 1.3, 1.3, 0.8, K.accent)), jaw);
    const tail = segChain([[15, y, 0, 0.8], [10, y, 0, 0.7], [5, y, 0, 0.6], [0, y + 0.2, 0, 0]], 1, K.body);
    const all = J(17, y, box(17, y, 0, 3, 2, 2, K.body), range(1, 14, 7).map(x => box(x, y, 0, 0.25, 0.95, 0.95, K.dark)), wings, headJ, tail[0], legs.map(l => l.g));
    return { root: group(all), all, head: headJ, jaw, tail, legs, wings, fly: true, nod: 0.4 };
  },
  millipede(K) { // 납작하고 긴 마디 몸(두 색 번갈아) + 마디마다 다리 + 더듬이
    const y = 1.2, jaw = stillJaw(23.5, y);
    const legs = manyLegs(range(1.5, 20.5, 14), y * 0.8, 1.6, 0.25, K, 0.6);
    const headJ = J(21.5, y, box(22.6, y, 0, 1.6, 1.3, 3, K.body), both(sd => box(23.6, y + 1, sd * 0.9, 0.2, 0.2, 2, K.dark, 0, sd * 0.5)), jaw);
    const tail = segChain([[2, y, 0, 1.4], [0, y - 0.2, 0, 0]], 2.5, K.body);
    const all = J(12, y, range(1.5, 21, 18).map((x, i) => box(x, y + 0.2, 0, 1.15, 1.6, 4, i % 2 ? K.body : K.dark)), headJ, tail[0], legs.map(l => l.g));
    return { root: group(all), all, head: headJ, jaw, tail, legs, nod: 0.3 };
  },
};
const arthropod = (p, K) => (BUGS[p.kind] ?? BUGS.trilobite)(K);

// ── 뱀: 몸 전체가 꼬리 사슬(머리 쪽 → 꼬리끝, 옆으로 S자), 앞쪽은 고개를 든다. params: r 몸 굵기
function snake(p, K) {
  const r = (p.r ?? 0.04) * N, h = r * 2;
  const body = segChain([[19, r, 0, h * 0.9], [16.5, r, r * 1.2, h], [13.5, r, -r * 1.4, h * 1.05], [10.5, r, r * 1.6, h * 1.05], [7.5, r, -r * 1.4, h], [4.8, r * 0.9, r * 1.1, h * 0.85], [2.2, r * 0.7, -r * 0.5, h * 0.6], [0, r * 0.5, 0, 0]], 1, K.body);
  const hl = 0.12 * N, hd = r * 1.3, hw = r * 1.7, hy = r * 3.3;
  const hd0 = head('lizard', N - hl, hy, hl, hd, hw, { ...K, F: [...K.F, 'toothless'], meat: false }, p);
  hd0.parts.push(box(N + 0.4, hy - hd * 0.3, 0, 1, 0.12, 0.3, '#d23a3a')); // 갈라진 혀
  const neck = neckBoxes(19, r, N - hl + 0.6, hy, h * 0.9, hd * 0.9, hw * 1.1, K.body);
  const headJ = J(19, r * 1.5, neck, hd0.parts, hd0.jaw);
  const all = J(12, r, body[0], headJ);
  return { root: group(all), all, head: headJ, jaw: hd0.jaw, tail: body, legs: [], wings: [] };
}

const TEMPLATES = { theropod: biped, bird: biped, sauropod: quad, ceratopsian: quad, armored: quad, large_mammal: quad, sprawler: quad, fish, marine_reptile: marine, pterosaur: ptero, arthropod, snake };
// 인기 동물 손질(PLAN_BLOCK3D 4.5): 블록 전용 비율·특징을 덮어써서 더 그 동물답게. 데이터 파일의 art.block 이 있으면 그것이 우선
const OVERRIDE = {
  tyrannosaurus: { hl: 0.15, dp: 0.85, arm: 0.035 }, // 아주 큰 머리, 손가락 둘 달린 작은 앞발
  triceratops: { brow: 1.35, nose: 0.6 }, // 긴 이마뿔 둘, 짧은 코뿔
  spinosaurus: { head: 'croc', hl: 0.17, dp: 0.5 }, // 악어처럼 길고 낮은 주둥이
  brachiosaurus: { neck: [0.8, 0.85], snout: true, frontLeg: 1.15 }, // 하늘로 세운 목, 높은 콧등, 긴 앞다리
  ankylosaurus: { addF: ['spikes'] }, // 옆구리 가시
  velociraptor: { bd: 0.065, hl: 0.13, neck: 1.3 }, // 너무 가늘어 도마뱀 같던 몸을 통통하게, 고개를 들어 새처럼
  smilodon: { hip: 0.33, sh: 0.4, bd: 0.125, legR: 0.045, frontLeg: 1.2, hl: 0.2, dp: 0.95 }, // 등이 엉덩이 쪽으로 낮고, 굵은 앞다리·큰 머리(말처럼 보이지 않게)
  quetzalcoatlus: { bd: 0.09, wing: 0.6, dp: 0.4 }, // 몸을 키우고 날개 판은 줄이고, 부리는 굵게(실처럼 보이지 않게)
  mosasaurus: { bd: 0.07 }, // 통통한 바다 도마뱀
  megalodon: { bd: 0.105 }, // 더 묵직한 큰 상어
  stegosaurus: {}, woolly_mammoth: {}, // 지금 모습으로 충분히 닮음(2026-11-05 확인)
};
const KIND = { large_mammal: 'fur', bird: 'feather', fish: 'smooth', marine_reptile: 'smooth', pterosaur: 'fur', arthropod: 'shell' };

// 백과 팔레트는 흙빛이라 블록으로 칠하면 칙칙하다: 채도·밝기를 올린다(BLOCK.SAT·LIGHT)
const vivid = hex => { const c = new THREE.Color(hex), h = {}; c.getHSL(h); return '#' + c.setHSL(h.h, Math.min(1, h.s * BLOCK.SAT), Math.min(0.85, h.l * BLOCK.LIGHT)).getHexString(); };

// 동물 카드 → rig: 체형 틀(archetype) + 비율(art.params) + 색(art.palette [등, 배, 강조]) + 특징(art.features) + 무늬(params.pattern·mark)
export function build(a) {
  const make = TEMPLATES[a.archetype];
  if (!make || !a.art?.palette) return null;
  const { addF = [], ...ov } = OVERRIDE[a.id] ?? {};
  const L = LOOK[a.id]; // 종마다 고유한 색·무늬(blockLook.js). 없으면 백과 팔레트를 선명하게
  const [back, belly, accent] = L ? [L[0], L[1], L[4] ?? (a.art.palette[2] && vivid(a.art.palette[2]))] : a.art.palette.map(vivid), F = [...(a.art.features ?? []), ...addF];
  const p = { ...ARCHETYPES[a.archetype].params, ...a.art.params, ...ov, ...a.art.block, ...(L && { pattern: L[2], mark: L[3], markOp: L[2] ? 0.8 : 0 }) };
  const seed = [...a.id].reduce((h, c) => Math.imul(h, 31) + c.charCodeAt(0) | 0, 7) >>> 0;
  let s = seed;
  const acc = accent ?? col(back, 0.8), kind = F.includes('feathers') ? 'feather' : KIND[a.archetype] ?? 'scale';
  const tex = skinTex(back, { pattern: p.pattern, mark: p.mark, markOp: p.markOp, kind, seed });
  const K = {
    F, kind, arch: a.archetype, meat: /이빨|송곳니|턱/.test((a.weapons ?? []).join(' ')) && !/부리/.test((a.weapons ?? []).join(' ')),
    body: { tex, side: '#ffffff', top: '#d6d6d6', bot: belly }, // 등(위)은 짙게, 배(아래)는 밝게
    limb: { tex, side: '#dcdcdc', top: '#e4e4e4', bot: col(back, 0.7) },
    under: { top: belly, side: col(belly, 0.93), bot: col(belly, 0.85) },
    shell: { tex: skinTex(acc, { kind: 'shell', seed }), side: '#ffffff', top: '#e0e0e0', bot: col(acc, 0.7) },
    frill: { top: col(acc, 0.85), side: acc, bot: col(acc, 0.7) }, frillIn: col(acc, 1.15, belly, 0.3),
    accent: acc, plate: acc, feather: col(back, 0.92), membrane: col(back, 1, belly, 0.35),
    dark: col(back, 0.68), ridge: col(back, 0.55), osteo: col(back, 1.25, belly, 0.25), nail: col(belly, 0.8), beak: col(back, 0.5, '#3a3128', 0.5),
    rnd: () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296,
  };
  // 부위별 표식(blockLook 6번째 칸): head 머리 색, mask 눈을 지나는 줄, dorsal 등 줄, tail 꼬리 고리
  const M = L?.[5] ?? {};
  K.head = M.head ? { tex: skinTex(M.head, { pattern: p.pattern, mark: p.mark, markOp: p.markOp, kind, seed }), side: '#ffffff', top: '#d6d6d6', bot: belly } : K.body;
  K.mask = M.mask;
  K.dorsal = M.dorsal;
  if (M.tail) K.body = { ...K.body, ring: { top: col(M.tail, 0.85), side: M.tail, bot: col(M.tail, 0.75) } };
  const rig = make(p, K);
  shade(rig.root, K, back, belly);
  rig.eyes = [];
  rig.root.traverse(o => o.userData.eye && rig.eyes.push(o));
  rig.ph = (seed % 1000) / 270; // 깜빡이는 때가 동물마다 다르게
  mergeBoxes(rig.root);
  rig.root.traverse(o => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return rig;
}

// 명암(꼭짓점 색, 재질 색·무늬에 곱해진다). 동물을 만들 때 한 번만 칠한다
// - 몸 옆면: 위(등)는 짙게 → 아래는 배 색 쪽으로 밝게. 다리 옆면: 발 쪽으로 어둡게
// - 다른 상자 속에 묻힌 꼭짓점은 어둡게: 다리·목·꼬리가 몸에 붙는 곳, 이빨 뿌리가 그늘진다(구석 그림자)
function shade(root, K, back, belly) {
  root.updateMatrixWorld(true);
  const boxes = [];
  root.traverse(o => o.isMesh && o.geometry.attributes.position.count === 24 && boxes.push(o));
  const inv = boxes.map(b => b.matrixWorld.clone().invert()), v = new THREE.Vector3(), q = new THREE.Vector3();
  const B = new THREE.Color(back), L = new THREE.Color(belly), ratio = [L.r / B.r, L.g / B.g, L.b / B.b].map(r => 1 + (Math.min(r, 3) - 1) * 0.5);
  const inside = (p, self) => { let n = 0; for (let j = 0; j < boxes.length; j++) if (j !== self && (q.copy(p).applyMatrix4(inv[j]), Math.abs(q.x) < 0.49 && Math.abs(q.y) < 0.49 && Math.abs(q.z) < 0.49)) n++; return n; };
  boxes.forEach((b, i) => {
    const g = (b.geometry = b.geometry.clone()), pos = g.attributes.position, nor = g.attributes.normal, col = new Float32Array(72), paint = b.userData.paint;
    for (let k = 0; k < 24; k++) {
      const t = pos.getY(k) + 0.5, side = Math.abs(nor.getY(k)) < 0.5;
      let c = [1, 1, 1];
      if (side && (paint === K.body || paint === K.head)) c = ratio.map(r => r + (0.82 - r) * t);
      else if (side && paint === K.limb) c = [1, 1, 1].map(() => 0.72 + 0.28 * t);
      const ao = paint === SPARK ? 0 : inside(v.fromBufferAttribute(pos, k).applyMatrix4(b.matrixWorld), i);
      c.forEach((x, j) => (col[k * 3 + j] = x * (ao ? 0.55 : 1)));
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  });
}

// 같은 마디(같이 움직이는 묶음) 안에서 같은 재질인 상자들을 한 덩어리로 합친다. 동물 한 마리에 상자가 수백 개라 그대로 그리면 느리다.
// 면마다 색이 다른 상자는 면 종류(+x … −z)별로 모아 재질 그룹 6개로 둔다
function mergeBoxes(root) {
  const parents = [];
  root.traverse(o => parents.push(o));
  for (const par of parents) {
    const sets = new Map();
    for (const m of par.children) {
      if (!m.isMesh || m.children.length || m.geometry.attributes.position.count !== 24) continue;
      const key = Array.isArray(m.material) ? m.material.map(x => x.uuid).join() : m.material.uuid;
      (sets.get(key) ?? sets.set(key, []).get(key)).push(m);
    }
    for (const list of sets.values()) {
      if (list.length < 2) continue;
      const P = [], Nm = [], UV = [], CO = [], faces = [[], [], [], [], [], []];
      list.forEach((m, i) => {
        m.updateMatrix();
        const g = m.geometry.clone().applyMatrix4(m.matrix), idx = g.index.array;
        P.push(...g.attributes.position.array);
        Nm.push(...g.attributes.normal.array);
        UV.push(...g.attributes.uv.array);
        CO.push(...(g.attributes.color?.array ?? new Float32Array(72).fill(1)));
        for (let f = 0; f < 6; f++) for (let k = 0; k < 6; k++) faces[f].push(idx[f * 6 + k] + i * 24);
        g.dispose();
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nm, 3));
      // 무늬는 상자마다 새로 시작하지 않고 몸 좌표에 맞춰 이어 깐다(면 방향에 따라 xy·zy·xz 평면)
      const k = N / TEX_BLOCKS;
      for (let v = 0; v < P.length / 3; v++) {
        const [x, y, z] = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], [nx, ny] = [Math.abs(Nm[v * 3]), Math.abs(Nm[v * 3 + 1])];
        [UV[v * 2], UV[v * 2 + 1]] = nx > 0.5 ? [z * k, y * k] : ny > 0.5 ? [x * k, z * k] : [x * k, y * k];
      }
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(CO, 3));
      geo.setIndex(faces.flat());
      if (Array.isArray(list[0].material)) faces.forEach((_, f) => geo.addGroup(f * 6 * list.length, 6 * list.length, f));
      list.forEach(m => par.remove(m));
      par.add(new THREE.Mesh(geo, list[0].material));
    }
  }
}
