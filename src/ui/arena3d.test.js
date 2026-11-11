// 실행: node --test — 포효 클로즈업 카메라 자리: 코가 향한 쪽으로 45도, 살짝 위, 거리는 머리 크기에 비례
import assert from 'node:assert';
import { test } from 'node:test';
import * as THREE from 'three';
import { CLOSE } from '../config.js';
globalThis.location ??= { search: '', hash: '' }; // 3D 모델 모듈이 주소(?art=)를 읽는다
const { closeCam, footsteps, lookAt } = await import('./arena3d.js');

test('closeCam', () => {
  const head = new THREE.Vector3(2, 3, 0);
  for (const side of [1, -1]) {
    const { pos, look } = closeCam(head, 0.5, side), off = pos.clone().sub(head);
    assert.ok(look.equals(head), '얼굴을 본다');
    assert.ok(Math.abs(off.length() - 0.5 * CLOSE.DIST) < 1e-9, '거리 = 머리 크기 × DIST');
    assert.strictEqual(Math.sign(off.x), side, '코가 향한 쪽에서');
    assert.ok(Math.abs(Math.atan2(Math.abs(off.x), off.z) * 180 / Math.PI - CLOSE.YAW) < 1e-6, '정면에서 45도');
    assert.ok(off.y > 0 && off.y < off.length() * 0.2, '눈높이보다 살짝 위');
  }
  assert.ok(Math.abs(closeCam(head, 1, 1, 0).pos.x - head.x) < 1e-9, '아이 그림은 정면');
});

test('footsteps: 걸으면 발을 디딜 때 흙먼지, 큰 동물은 발자국. 서 있으면 없음', () => {
  const run = (moving, L) => {
    const scene = new THREE.Scene(), fs = footsteps(scene, { ground: ['#94c75c', '#a6d26a'] }), [dust, print] = scene.children;
    const v = { P: { ls: [0, 0] }, rig: { legs: [{ g: new THREE.Object3D() }, { g: new THREE.Object3D() }] }, F: { L }, side: 1 };
    for (let k = 0; k < 40; k++) { v.P.ls = [Math.sin(k * 0.3), Math.sin(k * 0.3 + Math.PI)]; fs.step(v, moving); }
    fs.update(0.05);
    return [dust.count, print.count];
  };
  const [d, p] = run(true, 5);
  assert.ok(d > 0 && p > 0, '흙먼지와 발자국');
  assert.ok(run(true, 1)[1] === 0, '작은 동물은 발자국 없음');
  assert.deepStrictEqual(run(false, 5), [0, 0], '서 있으면 없음');
});

test('lookAt: 상대 얼굴 쪽으로 고개(위·아래·카메라 쪽), 등 뒤면 그대로', () => {
  const at = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); o.updateMatrixWorld(); return { rig: { jaw: o } }; };
  const v = { ...at(1, 0.5, 0), holder: new THREE.Object3D() };
  const [, up] = lookAt(v, at(3, 2, 0)), [, down] = lookAt(v, at(3, 0, 0)), [side] = lookAt(v, at(3, 0.5, 1));
  assert.ok(up > 0.3 && down < 0 && side > 0.3, '큰 상대는 올려다보고, 작은 상대는 내려다보고, 옆이면 돌아본다');
  assert.deepStrictEqual(lookAt(v, at(-2, 0.5, 0)), [0, 0]);
});
