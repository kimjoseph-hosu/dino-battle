// 3D 동물의 부위별 동작: 대기·돌진·물기·맞음·지침. three.js 없이 숫자(각도, 라디안)만 계산한다.
// 자세 P = { y 몸 오르내림(몸길이 1 기준), pitch 몸 앞뒤 기울기(+ 코가 위), hp·hy 머리 끄덕·도리(+ 코가 위·카메라 쪽),
//           roll 몸 좌우 출렁(걸을 때), blink 눈 감기(0 뜸 ~ 1 감음), jaw 턱 벌림, tp·ty 꼬리 마디마다 위아래(+ 위)·좌우, ls 다리마다 앞뒤 휘두름(+ 앞), lb 다리마다 무릎 굽힘, wf 날개 퍼덕(+ 위) }
// rig: { tail: 마디 수, legs: [{ front, side(+1 카메라 쪽 / -1), ph? 박자 }], swim: 헤엄치는 몸 }

export const STATES = ['idle', 'wind', 'charge', 'bite', 'hit', 'tired', 'roar', 'ko'];

export const restPose = rig => ({ y: 0, pitch: 0, roll: 0, blink: 0, hp: 0, hy: 0, jaw: 0, wf: 0, tp: Array(rig.tail).fill(0), ty: Array(rig.tail).fill(0), ls: rig.legs.map(() => 0), lb: rig.legs.map(() => 0) });

// 다리 박자: 네발은 대각선 걸음(왼앞+오른뒤), 두발·지느러미는 좌우 번갈아, 다리가 많으면 ph(앞에서 뒤로 물결)
const phase = (l, rig) => l.ph ?? (l.side > 0 ? 0 : Math.PI) + (l.front && rig.legs.length > 2 ? Math.PI : 0);
const S = Math.sin;
// 눈 깜빡임: 몇 초마다 한 번 짧게. ph 로 동물마다 때가 달라 둘이 같이 깜빡이지 않는다
const blinkAt = (t, rig) => (((t + (rig.ph ?? 0)) % 3.7) < 0.14 ? 1 : 0);

// t: 초, o: { moving 자리를 옮기는 중, step 걸음 위상(라디안, 이동 속도에 맞춰 쌓임), whip 꼬리로 치는 중, motion 공격 종류(battle.js MOTIONS) }
// 앞다리·뒷다리 따로 정하기
const legsBy = (P, rig, front, back) => rig.legs.forEach((l, i) => { const v = l.front ? front : back; if (v) [P.ls[i], P.lb[i]] = typeof v === 'function' ? v(l, i) : v; });
const MOTIONS = {
  // 대기: 숨쉬기, 고개 살짝, 꼬리 천천히 흔들기. 헤엄치면 꼬리·지느러미가 크게, 걸으면 다리가 걷는다
  idle(P, t, rig, o) {
    P.y = 0.006 * S(t * 1.4); // 숨쉬기: 몸이 천천히 오르내리고 가슴(앞)이 살짝 들린다
    P.pitch = 0.016 * S(t * 1.4 + 0.6);
    P.blink = blinkAt(t, rig);
    P.hp = 0.04 * S(t * 1.1 + 0.5);
    P.hy = 0.06 * S(t * 0.7);
    P.jaw = 0.05 + 0.03 * S(t * 1.3);
    P.wf = o.flying ? 0.55 * S(t * 5) : 0.04 * S(t * 1.2);
    const amp = rig.swim ? 0.13 : 0.09, f = rig.swim ? 3 : 1.3;
    P.ty = P.ty.map((_, i) => amp * (0.5 + i * 0.4) * S(t * f - i * 0.8));
    P.tp = P.tp.map((_, i) => 0.025 * S(t * f * 0.5 - i * 0.6));
    rig.legs.forEach((l, i) => {
      const p = phase(l, rig);
      if (o.flying) P.ls[i] = -0.6; // 날 때는 다리를 뒤로 접는다
      else if (rig.swim) P.ls[i] = 0.3 * S(t * 2.4 + p);
      else if (o.moving) { const g = o.step ?? t * 9; P.ls[i] = 0.45 * S(g + p); P.lb[i] = 0.35 * Math.max(0, S(g + p + 1.2)); }
    });
    if (o.moving && !rig.swim && !o.flying) { // 걸을 때 무게감: 발을 디딜 때마다 몸이 내려앉고 좌우로 출렁
      const g = o.step ?? t * 9;
      P.y += 0.008 * Math.abs(S(g)) - 0.004;
      P.roll = 0.035 * S(g);
    }
  },
  // 힘 모으기: 공격 종류마다 다른 예비 자세
  wind(P, t, rig, o) {
    const m = o.motion;
    P.y = -0.004;
    if (m === 'ram' || m === 'toss') { // 머리를 땅까지 숙이고 앞발로 땅을 긁는다
      P.pitch = -0.06; P.hp = -0.35; P.jaw = 0.05;
      legsBy(P, rig, (l, i) => [l.side > 0 ? 0.35 * S(t * 11) : 0.1, 0.35], [-0.1, 0.25]);
      P.tp = P.tp.map(() => 0.06);
    } else if (m === 'stomp') { // 일어서며 앞다리를 높이 들어 올린다
      P.hp = 0.22; P.jaw = 0.3;
      legsBy(P, rig, [0.9, 0.9], [-0.15, 0.1]);
      P.tp = P.tp.map(() => -0.08);
    } else if (m === 'pounce' || m === 'kick') { // 납작 웅크린다. 발차기는 한쪽 뒷다리를 뒤로 당긴다
      P.y = -0.01; P.hp = -0.06; P.jaw = m === 'pounce' ? 0.25 : 0.1;
      legsBy(P, rig, [-0.2, 0.6], (l) => (m === 'kick' && l.side > 0 ? [-0.7, 0.9] : [0.15, 0.7]));
    } else if (m === 'slash') { // 앞발을 치켜든다
      P.hp = 0.1; P.jaw = 0.35;
      legsBy(P, rig, [0.75, 0.7], null);
    } else if (m === 'tail') { // 몸을 틀어 꼬리를 반대쪽으로 크게 감는다
      P.hy = 0.35; P.roll = 0.04;
      P.ty = P.ty.map((_, i) => -0.25 * (0.6 + i * 0.25));
    } else { // 물기·흔들기·굴리기: 고개를 젖히고 입을 쩍
      P.pitch = 0.02; P.hp = 0.25; P.jaw = 0.65;
    }
  },
  // 포효(등장·이긴 뒤): 고개를 높이 들고 입을 크게, 목이 부르르 떨린다
  roar(P, t, rig) {
    P.pitch = 0.04; P.hp = 0.35 + 0.03 * S(t * 30); P.hy = 0.05 * S(t * 2);
    P.jaw = 0.75; P.wf = 0.6 * S(t * 6);
    P.tp = P.tp.map(() => 0.08);
    P.ty = P.ty.map((_, i) => 0.06 * S(t * 3 - i * 0.6));
  },
  // K.O.: 눈 감고 고개·꼬리 축 늘어지고 다리는 가끔 바르르
  ko(P, t, rig) {
    P.blink = 1; P.hp = -0.3; P.jaw = 0.3; P.wf = -0.4;
    P.tp = P.tp.map(() => -0.05);
    P.ty = P.ty.map(() => 0);
    P.ls = P.ls.map((_, i) => (rig.swim ? 0 : 0.12 * S(t * 7 + i) * Math.max(0, S(t * 0.9))));
    P.lb = P.lb.map(() => 0.25);
  },
  // 돌진: 몸을 낮추고 머리를 앞으로, 꼬리는 곧게 뻗어 빠르게 떨고, 다리는 크게 내닫는다. 공격 종류마다 머리·다리를 다르게
  charge(P, t, rig, o) {
    P.y = 0.006 * S(t * 12);
    P.roll = 0.03 * S(t * 12);
    P.pitch = -0.05;
    P.hp = -0.08;
    P.jaw = 0.14;
    P.wf = -0.35; // 날개를 뒤로 젖혀 내리꽂는다
    P.ty = P.ty.map((_, i) => (o.whip ? 0.45 * (0.4 + i * 0.3) * S(t * 9 - i * 0.5) : 0.04 * S(t * 12 - i)));
    P.tp = P.tp.map(() => 0.05);
    rig.legs.forEach((l, i) => {
      const p = phase(l, rig);
      P.ls[i] = (rig.swim ? 0.5 : 0.7) * S(t * (rig.swim ? 8 : 12) + p);
      if (!rig.swim) P.lb[i] = 0.5 * Math.max(0, S(t * 12 + p + 1.2));
    });
    const m = o.motion;
    if (m === 'ram' || m === 'toss') { P.hp = -0.35; P.jaw = 0.05; } // 뿔·이마를 앞으로 낮게(부딪힌 뒤 대기로 돌아가며 머리가 위로 쳐올려진다)
    else if (m === 'stomp') { P.hp = -0.15; P.jaw = 0.35; legsBy(P, rig, [-0.3, 0], [0.2, 0.3]); } // 앞다리를 곧게 내리찍는다
    else if (m === 'kick') { P.jaw = 0.2; legsBy(P, rig, rig.legs.length > 2 ? [0.1, 0.2] : null, (l) => (l.side > 0 ? [rig.legs.length > 2 ? -0.95 : 1.0, 0] : [-0.35, 0.3])); } // 두발은 한 발 앞으로, 네발은 뒷발로 뒤차기
    else if (m === 'pounce') { P.jaw = 0.6; legsBy(P, rig, [0.9, 0.15], [-0.6, 0.1]); } // 앞발 뻗고 뒷발 뒤로 쭉
    else if (m === 'slash') { P.jaw = 0.3; legsBy(P, rig, (l) => [0.4 + 0.5 * S(t * 16 + (l.side > 0 ? 0 : 1.5)), 0.4], null); } // 앞발로 번갈아 할퀸다
    else if (m === 'roll') { P.roll = 0.6 * S(t * 9); P.jaw = 0.5; } // 물고 몸을 비틀어 굴린다
    else if (m === 'shake') { P.hy = 0.3 * S(t * 18); P.jaw = 0.5; } // 물고 고개를 마구 흔든다
  },
  // 물기: 턱을 크게 벌렸다 탁 닫기를 되풀이, 벌릴 때 머리를 젖힌다
  bite(P, t, rig) {
    const open = Math.pow(0.5 + 0.5 * S(t * 13), 0.7);
    P.blink = 0.4 * open; // 물 때 눈을 찡그린다
    P.pitch = -0.03;
    P.hp = 0.12 * open - 0.05;
    P.jaw = 0.6 * open;
    P.wf = 0.2 * open;
    P.ty = P.ty.map((_, i) => 0.08 * S(t * 6 - i * 0.7));
    P.ls = P.ls.map(() => 0.15); // 버티기
  },
  // 맞음: 머리가 뒤로 젖혀지고 몸이 움찔, 꼬리가 말려 올라가고 다리는 뒤로 밀린다
  hit(P, t) {
    const shudder = 0.05 * S(t * 40);
    P.y = 0.008;
    P.pitch = 0.08;
    P.hp = 0.28;
    P.hy = -0.22 + shudder;
    P.blink = 0.85; // 맞으면 눈을 질끈
    P.jaw = 0.22;
    P.wf = 0.45 + shudder;
    P.tp = P.tp.map(() => 0.12);
    P.ty = P.ty.map((_, i) => -0.08 - shudder * i);
    P.ls = P.ls.map(() => -0.35);
    P.lb = P.lb.map(() => 0.2);
  },
  // 지침: 고개를 떨구고 입을 벌린 채 헐떡, 몸이 처지고 꼬리는 늘어진다
  tired(P, t, rig) {
    const pant = S(t * 3.2);
    P.blink = Math.max(0.55, blinkAt(t, rig)); // 지쳐서 눈이 반쯤 감긴다
    P.y = -0.012 + 0.005 * pant;
    P.pitch = -0.03;
    P.hp = -0.26 + 0.03 * pant;
    P.jaw = 0.22 + 0.06 * pant;
    P.wf = -0.25;
    P.tp = P.tp.map((_, i) => -0.04 * (1 + i * 0.4));
    P.ty = P.ty.map((_, i) => 0.03 * S(t * 0.8 - i));
    P.ls = P.ls.map(() => (rig.swim ? 0.05 * S(t * 1.2) : 0.1));
    P.lb = P.lb.map(() => (rig.swim ? 0 : 0.3));
  },
};

export function targetPose(state, t, rig, o = {}) {
  const P = restPose(rig);
  (MOTIONS[state] ?? MOTIONS.idle)(P, t, rig, o);
  return P;
}

// 지금 자세 cur 를 목표 to 쪽으로 부드럽게(dt초, 동작이 바뀔 때 툭 끊기지 않게)
export function blend(cur, to, dt, rate = 12) {
  const k = 1 - Math.exp(-rate * dt);
  for (const key in to) {
    if (Array.isArray(to[key])) to[key].forEach((v, i) => (cur[key][i] += (v - cur[key][i]) * k));
    else cur[key] += (to[key] - cur[key]) * k;
  }
  return cur;
}

// 배틀 화면의 표시(.pos 의 class)로 지금 동작 고르기. K.O. > 맞음 > 포효 > 물기 > 힘 모으기 > 돌진 > 지침 > 대기
export function stateOf(cl) {
  const motion = typeof cl[Symbol.iterator] === 'function' ? [...cl].find(c => c.startsWith('m-'))?.slice(2) : undefined;
  const o = { moving: cl.contains('walking'), whip: cl.contains('whip'), flying: cl.contains('flying'), motion };
  const state = cl.contains('ko') ? 'ko' : cl.contains('hit') ? 'hit' : cl.contains('roar') ? 'roar' : cl.contains('biting') && !['pounce', 'roll', 'shake'].includes(motion) ? 'bite' : cl.contains('winding') ? 'wind'
    : cl.contains('charging') || o.whip ? 'charge' : cl.contains('tired') ? 'tired' : 'idle';
  return { state, o };
}
