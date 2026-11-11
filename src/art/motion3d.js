// 3D 동물의 부위별 동작: 대기·돌진·물기·맞음·지침. three.js 없이 숫자(각도, 라디안)만 계산한다.
// 자세 P = { y 몸 오르내림(몸길이 1 기준), pitch 몸 앞뒤 기울기(+ 코가 위), hp·hy 머리 끄덕·도리(+ 코가 위·카메라 쪽),
//           jaw 턱 벌림, tp·ty 꼬리 마디마다 위아래(+ 위)·좌우, ls 다리마다 앞뒤 휘두름(+ 앞), lb 다리마다 무릎 굽힘, wf 날개 퍼덕(+ 위) }
// rig: { tail: 마디 수, legs: [{ front, side(+1 카메라 쪽 / -1), ph? 박자 }], swim: 헤엄치는 몸 }

export const STATES = ['idle', 'charge', 'bite', 'hit', 'tired'];

export const restPose = rig => ({ y: 0, pitch: 0, hp: 0, hy: 0, jaw: 0, wf: 0, tp: Array(rig.tail).fill(0), ty: Array(rig.tail).fill(0), ls: rig.legs.map(() => 0), lb: rig.legs.map(() => 0) });

// 다리 박자: 네발은 대각선 걸음(왼앞+오른뒤), 두발·지느러미는 좌우 번갈아, 다리가 많으면 ph(앞에서 뒤로 물결)
const phase = (l, rig) => l.ph ?? (l.side > 0 ? 0 : Math.PI) + (l.front && rig.legs.length > 2 ? Math.PI : 0);
const S = Math.sin;

// t: 초, o: { moving 자리를 옮기는 중, step 걸음 위상(라디안, 이동 속도에 맞춰 쌓임), whip 꼬리로 치는 중 }
const MOTIONS = {
  // 대기: 숨쉬기, 고개 살짝, 꼬리 천천히 흔들기. 헤엄치면 꼬리·지느러미가 크게, 걸으면 다리가 걷는다
  idle(P, t, rig, o) {
    P.y = 0.004 * S(t * 1.6);
    P.pitch = 0.012 * S(t * 0.9);
    P.hp = 0.04 * S(t * 1.1 + 0.5);
    P.hy = 0.06 * S(t * 0.7);
    P.jaw = 0.05 + 0.03 * S(t * 1.3);
    P.wf = o.flying ? 0.55 * S(t * 5) : 0.04 * S(t * 1.2);
    const amp = rig.swim ? 0.13 : 0.06, f = rig.swim ? 3 : 1.5;
    P.ty = P.ty.map((_, i) => amp * (0.5 + i * 0.4) * S(t * f - i * 0.8));
    P.tp = P.tp.map((_, i) => 0.025 * S(t * f * 0.5 - i * 0.6));
    rig.legs.forEach((l, i) => {
      const p = phase(l, rig);
      if (o.flying) P.ls[i] = -0.6; // 날 때는 다리를 뒤로 접는다
      else if (rig.swim) P.ls[i] = 0.3 * S(t * 2.4 + p);
      else if (o.moving) { const g = o.step ?? t * 9; P.ls[i] = 0.45 * S(g + p); P.lb[i] = 0.35 * Math.max(0, S(g + p + 1.2)); }
    });
  },
  // 돌진: 몸을 낮추고 머리를 앞으로, 꼬리는 곧게 뻗어 빠르게 떨고, 다리는 크게 내닫는다
  charge(P, t, rig, o) {
    P.y = 0.006 * S(t * 12);
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
  },
  // 물기: 턱을 크게 벌렸다 탁 닫기를 되풀이, 벌릴 때 머리를 젖힌다
  bite(P, t, rig) {
    const open = Math.pow(0.5 + 0.5 * S(t * 13), 0.7);
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

// 배틀 화면의 표시(.pos 의 class)로 지금 동작 고르기. 맞음 > 물기 > 돌진 > 지침 > 대기
export function stateOf(cl) {
  const o = { moving: cl.contains('walking'), whip: cl.contains('whip'), flying: cl.contains('flying') };
  const state = cl.contains('hit') ? 'hit' : cl.contains('biting') ? 'bite' : cl.contains('charging') || o.whip ? 'charge' : cl.contains('tired') ? 'tired' : 'idle';
  return { state, o };
}
