// 실행: node server/ai.test.js — 실제 AI는 부르지 않는다(가짜 fetch). 검사·보정·캐시·실패 처리만 본다
import assert from 'node:assert';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cardFromAi, scriptFromAi, aiMiddleware } from './ai.js';

// 1) 이상한 AI 답도 안전한 카드가 된다
const card = cardFromAi({
  is_real_animal: true, name_ko: '코끼리<script>', name_en: 'Elephant', era: '현재', place: '아프리카', habitat: 'swamp?',
  length_min: 7, length_avg: -3, length_max: 999, mass_avg: 6000, stats: { attack: 15, defense: 'x', speed: 4.6 },
  archetype: 'robot', palette: ['red', '#112233'], features: ['sabre', 'laser'], weapons: ['상아', '피를 내는 발'], confidence: 'sure',
}, '코끼리', 'test-model');
assert.strictEqual(card.name_ko, '코끼리script');
assert.deepStrictEqual(card.length_m, { min: 0.005, avg: 7, max: 60 });
assert.strictEqual(card.habitat, 'land');
assert.strictEqual(card.archetype, 'large_mammal');
assert.deepStrictEqual(card.stats, { attack: 10, defense: 0, speed: 5, agility: 0, senses: 0, social: 0 });
assert.deepStrictEqual(card.art.features, ['sabre']);
assert.deepStrictEqual(card.weapons, ['상아'], '피 표현은 버림');
assert.strictEqual(card.art.palette[1], '#112233');
assert.strictEqual(card.confidence, 'low');
assert.strictEqual(cardFromAi({ is_real_animal: false, name_ko: '용' }, '용', 'm'), null);

// 1-2) 생김새는 닮은 동물을 본뜨고 차이만 얹는다: 코끼리 = 매머드에서 털·혹 빼고 큰 귀, 판다 = 동굴곰 + 검은 다리·눈 무늬·어깨 띠
const ele = cardFromAi({ is_real_animal: true, name_ko: '코끼리', length_avg: 6, mass_avg: 5000, stats: {}, like: 'woolly_mammoth', archetype: 'theropod',
  remove_features: ['fur', 'hump'], add_features: ['ears'], palette: ['#8c8c8c', '#7a7a7a'], scale: { legs: 9 } }, '코끼리', 'm');
assert.strictEqual(ele.archetype, 'large_mammal', '체형은 본뜬 동물 것');
assert.deepStrictEqual(ele.art.features.sort(), ['ears', 'trunk', 'tusks']);
assert.strictEqual(ele.art.params.skull, 'elephant');
assert.strictEqual(ele.art.params.hip, +(0.48 * 2).toPrecision(3), '비율은 2배까지만');
const panda = cardFromAi({ is_real_animal: true, name_ko: '판다', length_avg: 1.6, mass_avg: 100, stats: {}, like: 'cave_bear', remove_features: ['fur'],
  palette: ['#f2f0e8', '#e8e4d8'], limb: '#1a1a1a', face: '#1a1a1a', ear: '#1a1a1a', shoulder: true }, '판다', 'm');
assert.deepStrictEqual([panda.art.params.limb, panda.art.params.face, panda.art.params.shoulder, panda.art.params.skull], ['#1a1a1a', '#1a1a1a', true, 'bear']);
assert.deepStrictEqual(panda.art.features, ['round_ears']);

// 2) 자막: 맞힌 줄엔 공격한 쪽, 피한 줄엔 피한 쪽 이름이 없거나, 너무 길거나, 피·죽음 표현이면 그 줄만 버린다
const p = { a: '티라노', b: '랩터', winner: '티라노', loser: '랩터', attacks: [
  { attacker: '랩터', defender: '티라노', hit: true }, { attacker: '티라노', defender: '랩터', hit: false },
  { attacker: '티라노', defender: '랩터', hit: true }, { attacker: '랩터', defender: '티라노', hit: true }] };
const s = scriptFromAi({
  intro: '티라노 대 랩터, 시작!', outro: '랩터가 이겼어요!',
  lines: ['랩터가 슝 달려들었어요!', '랩터가 쏙 피했어요!', '티라노가 죽일 듯 덤볐어요', '아주'.repeat(25) + ' 랩터'],
}, p);
assert.strictEqual(s.intro, '티라노 대 랩터, 시작!');
assert.strictEqual(s.outro, null, '승자 이름이 없으면 버림');
assert.strictEqual(s.lines[0], '랩터가 슝 달려들었어요!');
assert.strictEqual(s.lines[1], '랩터가 쏙 피했어요!', '피한 줄은 피한 쪽 이름 + "피했어요" 괜찮음');
assert.strictEqual(s.lines[2], null, '죽음 표현');
assert.strictEqual(s.lines[3], null, '너무 김');

// 3) 서버: 키 없음 / AI 답 / 캐시 / 바쁨(429)
const call = async (mw, url, body) => {
  const req = (async function* () { if (body) yield JSON.stringify(body); })();
  Object.assign(req, { url, method: body ? 'POST' : 'GET' });
  const res = { setHeader() {}, end(s) { this.body = JSON.parse(s); } };
  await mw(req, res, () => (res.body = 'next'));
  return res.body;
};
const cacheFile = join(mkdtempSync(join(tmpdir(), 'dino-')), 'ai.json');
assert.deepStrictEqual(await call(aiMiddleware({}, { cacheFile }), '/api/status'), { ai: false, model: 'gemini-3.5-flash-lite' });
assert.strictEqual((await call(aiMiddleware({}, { cacheFile }), '/api/lookup', { name: '코끼리' })).error, 'nokey');
assert.strictEqual(await call(aiMiddleware({}, { cacheFile }), '/other'), 'next');
// 선생님 암호: 없거나 틀리면 locked, 맞으면 통과(여기선 키가 없어 nokey). 목록 보기(GET)는 암호 없이 된다
const locked = aiMiddleware({ TEACHER_PASSWORD: '1731' }, { cacheFile });
const callPw = (pw, body) => { const req = (async function* () { yield JSON.stringify(body); })(); Object.assign(req, { url: '/api/lookup', method: 'POST', headers: pw ? { 'x-teacher-pw': pw } : {} });
  const res = { setHeader() {}, end: s => (res.body = JSON.parse(s)) }; return locked(req, res).then(() => res.body.error); };
assert.strictEqual(await callPw(null, { name: '코끼리' }), 'locked');
assert.strictEqual(await callPw('0000', { name: '코끼리' }), 'locked');
assert.strictEqual(await callPw('1731', { name: '코끼리' }), 'nokey');
assert(Array.isArray(await call(locked, '/api/ai-animals')));

let calls = 0;
const fakeFetch = async (url, opt) => {
  calls++;
  const sent = JSON.parse(opt.body);
  assert(opt.headers['x-goog-api-key'] === 'SECRET-KEY-123' && sent.store === false && !opt.body.includes('SECRET-KEY-123'), '키는 헤더로만');
  const out = JSON.stringify({ is_real_animal: true, name_ko: '코끼리', name_en: 'Elephant', habitat: 'land', length_avg: 6, mass_avg: 6000, stats: {}, archetype: 'large_mammal', confidence: 'high' });
  return { ok: true, status: 200, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'text', text: out }] }] }) };
};
const mw = aiMiddleware({ GEMINI_API_KEY: 'SECRET-KEY-123' }, { fetchImpl: fakeFetch, cacheFile });
const first = await call(mw, '/api/lookup', { name: '코끼리' });
assert.strictEqual(first.animal?.name_ko, '코끼리', JSON.stringify(first));
assert.strictEqual((await call(mw, '/api/lookup', { name: ' 코끼리 ' })).cached, true, '두 번째는 캐시');
assert.strictEqual(calls, 1);
assert.strictEqual((await call(mw, '/api/ai-animals')).length, 1);
const saved = await call(mw, '/api/save-animal', { id: 'ai-elephant', length_avg: 7.5, mass_avg: 5000, habitat: 'land' });
assert.strictEqual(saved.animal.origin, 'teacher_edited');
assert.strictEqual(saved.animal.length_m.avg, 7.5);

const busy = aiMiddleware({ GEMINI_API_KEY: 'k' }, { fetchImpl: async () => ({ ok: false, status: 429 }), cacheFile });
assert.strictEqual((await call(busy, '/api/lookup', { name: '기린' })).error, 'busy');
console.log('ai ok');
