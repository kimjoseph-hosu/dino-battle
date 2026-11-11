// 실행: node src/art/motion3d.test.js
import assert from 'node:assert';
import { STATES, targetPose, blend, restPose, stateOf } from './motion3d.js';

const rig = { tail: 4, legs: [{ front: true, side: 1 }, { front: true, side: -1 }, { front: false, side: 1 }, { front: false, side: -1 }], swim: false };
const cls = (...c) => ({ contains: x => c.includes(x) });

for (const s of STATES) for (const t of [0, 0.37, 2.1]) {
  const P = targetPose(s, t, rig, { moving: true });
  const nums = [P.y, P.pitch, P.roll, P.blink, P.hp, P.hy, P.jaw, P.wf, ...P.tp, ...P.ty, ...P.ls, ...P.lb];
  assert(nums.every(Number.isFinite), `${s} 숫자 아님`);
  assert(nums.every(v => Math.abs(v) < 1.2), `${s} 각도가 너무 큼`);
  assert(P.tp.length === 4 && P.ls.length === 4);
}
// 동작마다 특징이 실제로 나오나
assert(targetPose('tired', 0, rig).hp < -0.2, '지치면 고개를 떨군다');
assert(targetPose('hit', 0, rig).hp > 0.2, '맞으면 머리가 젖혀진다');
assert(Math.max(...[0, 0.1, 0.2, 0.3, 0.4].map(t => targetPose('bite', t, rig).jaw)) > 0.5, '물 때 턱을 크게 벌린다');
assert(targetPose('charge', 0, rig).pitch < 0, '돌진하면 몸을 낮춘다');
// 섞기: 충분히 지나면 목표에 닿는다
const cur = restPose(rig), to = targetPose('hit', 0, rig);
for (let i = 0; i < 60; i++) blend(cur, to, 1 / 30);
assert(Math.abs(cur.hp - to.hp) < 1e-3 && Math.abs(cur.ls[2] - to.ls[2]) < 1e-3);
// 배틀 표시 → 동작
assert.equal(stateOf(cls('hit', 'biting')).state, 'hit');
assert.equal(stateOf(cls('biting', 'charging')).state, 'bite');
assert.equal(stateOf(cls('whip')).state, 'charge');
assert.equal(stateOf(cls('tired', 'walking')).state, 'tired');
assert.equal(stateOf(cls('walking')).o.moving, true);
assert(Math.abs(targetPose('idle', 0.3, rig, { flying: true }).wf) > 0.3, '날면 날개를 크게 퍼덕인다');
assert.equal(stateOf(cls('flying')).o.flying, true);
assert(Array.from({ length: 80 }, (_, i) => targetPose('idle', i * 0.05, rig).blink).some(b => b === 1), '가끔 눈을 깜빡인다');
assert(targetPose('idle', 1, rig).blink === 0 || targetPose('idle', 2, rig).blink === 0, '늘 감고 있지는 않다');
assert(targetPose('hit', 0, rig).blink > 0.5, '맞으면 눈을 질끈 감는다');
assert(Math.max(...[0, 0.2, 0.4].map(t => Math.abs(targetPose('idle', t, rig, { moving: true, step: t * 9 }).roll))) > 0.02, '걸으면 몸이 좌우로 출렁인다');
// 공격 종류마다 다른 부위 동작
const icl = (...c) => Object.assign(c, { contains: x => c.includes(x) }); // 배열이라 [...cl] 가 된다
assert.deepEqual(stateOf(icl('winding', 'm-toss')), { state: 'wind', o: { moving: false, whip: false, flying: false, motion: 'toss' } });
assert.equal(stateOf(icl('charging', 'biting', 'm-roll')).state, 'charge', '굴리기는 몸을 비튼다');
assert.equal(stateOf(icl('charging', 'biting', 'm-bite')).state, 'bite');
assert.equal(stateOf(icl('tired', 'ko')).state, 'ko');
assert.equal(stateOf(icl('biting', 'roar')).state, 'roar');
assert(targetPose('wind', 0, rig, { motion: 'ram' }).hp < -0.2, '들이받기 전에 머리를 숙인다');
assert(targetPose('wind', 0, rig, { motion: 'stomp' }).ls[0] > 0.5, '짓밟기 전에 앞다리를 든다');
assert(Math.abs(targetPose('charge', 0, rig, { motion: 'kick' }).ls[2]) > 0.8, '발차기는 뒷다리를 크게 뻗는다');
assert(targetPose('roar', 0, rig).jaw > 0.6 && targetPose('roar', 0, rig).hp > 0.25, '포효는 고개를 들고 입을 크게');
assert.equal(targetPose('ko', 0, rig).blink, 1, 'K.O. 되면 눈을 감는다');
console.log('motion3d ok');
