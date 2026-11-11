// 실행: node --test — 포효 클로즈업 카메라 자리: 코가 향한 쪽으로 45도, 살짝 위, 거리는 머리 크기에 비례
import assert from 'node:assert';
import { test } from 'node:test';
import * as THREE from 'three';
import { CLOSE } from '../config.js';
globalThis.location ??= { search: '', hash: '' }; // 3D 모델 모듈이 주소(?art=)를 읽는다
const { closeCam } = await import('./arena3d.js');

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
