// 실행: node src/engine/bracket.test.js
import assert from 'node:assert';
import { makeBracket, nextMatch, champion, beaten, roundName } from './bracket.js';

for (const n of [4, 8, 16]) {
  const xs = [...Array(n).keys()].map(i => ({ i }));
  const rounds = makeBracket(xs);
  assert.deepStrictEqual(rounds.map(r => r.length), [...Array(Math.log2(n) + 1).keys()].map(k => n >> k));
  assert.deepStrictEqual(new Set(rounds[0]), new Set(xs), '모두 한 번씩 출전');
  let m, games = 0;
  while ((m = nextMatch(rounds))) {
    assert(m.a && m.b && m.a !== m.b, '빈자리 없는 경기');
    rounds[m.r + 1][m.i] = m.a.i < m.b.i ? m.a : m.b; // 번호 작은 쪽이 이김
    games++;
  }
  assert.strictEqual(games, n - 1, `${n}마리 = ${n - 1}경기`);
  assert.strictEqual(champion(rounds).i, 0);
  assert.strictEqual(beaten(rounds, champion(rounds)).length, Math.log2(n));
  assert.strictEqual(roundName(rounds, rounds.length - 2), '결승');
  if (n === 16) assert.strictEqual(roundName(rounds, 0), '16강');
}
console.log('bracket ok');
