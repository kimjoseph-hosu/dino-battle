// 실행: node src/art/photo.test.js
import assert from 'node:assert';
import { removeBackground, shapeMask, maskAt, flipX } from './photo.js';

// 40x30 크림색 종이(오른쪽 아래가 그림자로 살짝 어두움) 위에 초록 몸통(10..29, 8..21), 몸통 안에 흰 눈(14,12)
const w = 40, h = 30, data = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const o = (y * w + x) * 4, shade = (x + y) * 1.2;
  data.set([245 - shade, 240 - shade, 225 - shade, 255], o);
  if (x >= 10 && x < 30 && y >= 8 && y < 22) data.set([60, 120, 50, 255], o);
}
data.set([255, 255, 255, 255], (12 * w + 14) * 4);

const out = removeBackground({ width: w, height: h, data }, 0.5);
assert.deepStrictEqual([out.width, out.height], [20, 14], '그림만 남게 잘림');
const a = (x, y) => out.data[(y * out.width + x) * 4 + 3];
assert.strictEqual(a(2, 2), 255, '몸통 안쪽은 남음');
assert.strictEqual(a(14 - 10, 12 - 8), 255, '그림 안의 흰 눈은 지우지 않음');

const m = { ...shapeMask(out, 20), aspect: out.height / out.width };
assert(maskAt(m, 0.5, m.aspect * 0.5) && !maskAt(m, 1.2, 0.1) && !maskAt(m, 0.5, m.aspect * 1.1));

const f = flipX(out);
assert.deepStrictEqual(f.data.subarray(0, 4), out.data.subarray((out.width - 1) * 4, out.width * 4));

// 종이만 있으면 null
assert.strictEqual(removeBackground({ width: 4, height: 4, data: new Uint8ClampedArray(64).fill(240) }), null);
console.log('photo ok');
