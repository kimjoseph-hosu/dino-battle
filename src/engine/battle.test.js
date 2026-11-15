// 실행: node src/engine/battle.test.js
import assert from 'node:assert';
import cards from '../../data/animals.json' with { type: 'json' };
import { winProb, battle, massScore, hitChance, mode, tire } from './battle.js';

const A = Object.fromEntries(cards.map(c => [c.id, c]));
const seeded = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

const p = winProb(A.tyrannosaurus, A.velociraptor, 'grassland');
assert(p > 0.8 && p < 0.995, `티라노 vs 랩터 ${p}`);
assert(Math.abs(p + winProb(A.velociraptor, A.tyrannosaurus, 'grassland') - 1) < 0.06, '대칭(먼저 공격하는 주사위 차이만큼)');
assert.strictEqual(winProb(A.smilodon, A.triceratops, 'grassland'), winProb(A.smilodon, A.triceratops, 'grassland'), '같은 입력 = 같은 확률');
assert(massScore(20) - massScore(1) < 2, '20배 무게 차가 결정적이면 안 됨');

// 같은 시드 = 같은 경기
assert.deepStrictEqual(battle(A.smilodon, A.triceratops, 'grassland', seeded(7)), battle(A.smilodon, A.triceratops, 'grassland', seeded(7)));

// K.O.가 아니면 무조건 5라운드를 다 하고 힘이 더 남은 쪽이 이긴다. 물러난 쪽은 힘이 더 적었다. 힘 기록은 줄어들기만 한다
const rng = seeded(1);
for (let i = 0; i < 300; i++) {
  const r = battle(A.allosaurus, A.stegosaurus, 'grassland', rng);
  assert(r.ko ? r.hp[1 - r.winner] === 0 : r.rounds.length === 5 && r.hp[r.winner] >= r.hp[1 - r.winner] && (!r.fled || r.hp[r.winner] > r.hp[1 - r.winner]), JSON.stringify(r.rounds));
  r.rounds.forEach(x => x.attacks.forEach(t => assert(t.hit ? t.dmg > 0 : t.dmg === 0)));
}

// 지침: 라운드가 지날수록 덜 맞히고, 무거운 쪽이 더 빨리 지친다
assert(hitChance(A.tyrannosaurus, A.triceratops, 'grassland', 4) < hitChance(A.tyrannosaurus, A.triceratops, 'grassland', 0));
assert(tire(A.brachiosaurus) > tire(A.velociraptor));
// 물러남이 가끔은 나온다(드물지도 너무 흔하지도 않게)
const fledRate = Array.from({ length: 400 }, () => battle(A.allosaurus, A.stegosaurus, 'grassland', rng, false)).filter(r => r.fled).length / 400;
assert(fledRate > 0.05 && fledRate < 0.6, `물러남 ${fledRate}`);

// 민첩할수록 덜 맞고, 하늘을 나는 상대는 땅에서 맞히기 어렵다
assert(hitChance(A.tyrannosaurus, A.velociraptor, 'grassland') < hitChance(A.tyrannosaurus, A.triceratops, 'grassland'));
assert.strictEqual(mode(A.quetzalcoatlus, 'grassland'), 'fly');
assert.strictEqual(mode(A.mosasaurus, 'underwater'), 'swim');
assert.strictEqual(mode(A.mosasaurus, 'grassland'), 'ground');
assert(hitChance(A.velociraptor, A.quetzalcoatlus, 'grassland') < hitChance(A.velociraptor, A.quetzalcoatlus, 'underwater'));

// 갑옷은 데미지를 줄인다: 안킬로사우루스는 티라노에게도 해볼 만하다
assert(winProb(A.ankylosaurus, A.tyrannosaurus, 'grassland') > 0.25);

// 무대: 물속에서는 바다 동물이, 정글에서는 날쌘 동물이 유리해진다
assert(winProb(A.mosasaurus, A.tyrannosaurus, 'underwater') > 0.8);
assert(winProb(A.mosasaurus, A.smilodon, 'grassland') < 0.2, '물 밖의 모사사우루스');
assert(winProb(A.velociraptor, A.brachiosaurus, 'jungle') > winProb(A.velociraptor, A.brachiosaurus, 'grassland'));

// 이긴 이유: 날아서 이기면 "날기", 물 밖의 모사사우루스에게 이기면 "무대"
const fly = Array.from({ length: 40 }, () => battle(A.quetzalcoatlus, A.velociraptor, 'grassland', rng)).find(r => r.winner === 0);
assert.strictEqual(fly.reasons[0], 'flight', fly.reasons);
const r = Array.from({ length: 50 }, () => battle(A.mosasaurus, A.triceratops, 'grassland', rng)).find(r => r.winner === 1);
assert(r.reasons.includes('stage'), r.reasons);

console.log('ok');

// "만약에": 시대·대륙·서식지
import { eraRange, continents, whatIf } from './whatif.js';
import books from '../../source/animals_from_books.json' with { type: 'json' };
import { neun } from './story.js';
const full = id => ({ ...books.find(b => b.name_ko.startsWith(A[id].name_ko)), ...A[id] });
assert.deepStrictEqual(eraRange('백악기 후기'), [100.5, 66]); // 실제 경계(백악기는 전기·후기 둘)
assert.deepStrictEqual(eraRange('쥐라기 중기'), [174, 163]);
assert(continents('미국과 캐나다 등 북아메리카의 숲').includes('북아메리카'));
assert.strictEqual(continents('전 세계의 바다').length, 7);
assert(whatIf(full('tyrannosaurus'), full('triceratops'), neun).met, '티라노와 트리케라톱스는 같은 시대·같은 곳');
assert(!whatIf(full('mosasaurus'), full('titanoboa'), neun).met, '백악기 끝과 팔레오세는 맞닿기만 해서 함께 살지 않았다');
const ts = whatIf(full('tyrannosaurus'), full('smilodon'), neun);
assert(!ts.met && ts.lines[0].includes('6300만 년'), ts.lines);
const mt = whatIf(full('mosasaurus'), full('tyrannosaurus'), neun);
assert(!mt.met && mt.lines.some(l => l.includes('바다에서')), mt.lines);
for (const b of books) { // 95종 모두 시대와 대륙을 읽을 수 있다
  const [s, e] = eraRange(b.era);
  assert(s > e && Number.isFinite(s) && Number.isFinite(e), b.era);
  assert(continents(b.place).length, b.place);
}
console.log('whatif ok', ts.lines);

// 길이를 우리 주변 물건으로
import { sizeLike } from './story.js';
assert.strictEqual(sizeLike(12.5), '세우면 약 4층 건물 높이');
assert.strictEqual(sizeLike(0.065), '연필보다 짧아요');
assert.strictEqual(sizeLike(4.5), '자동차 길이와 비슷해요');
assert.strictEqual(sizeLike(7.9), '범고래 길이와 비슷해요');
assert.strictEqual(sizeLike(0.3), '책가방 높이와 비슷해요');
console.log('sizeLike ok', sizeLike(30), sizeLike(1.65), sizeLike(5), sizeLike(0.2));

// ── 자연 사건(opts.events) ──
{
  const { EVENTS } = await import('./events.js');
  const { reasonLines, makeScript } = await import('./story.js');
  const ev = { events: true };
  assert.deepStrictEqual(battle(A.smilodon, A.triceratops, 'grassland', seeded(3), false, ev), battle(A.smilodon, A.triceratops, 'grassland', seeded(3), false, ev), '같은 시드 = 같은 경기(사건 포함)');
  assert(EVENTS.meteor.hit(A.trilobite, 'grassland')[0] > EVENTS.meteor.hit(A.tyrannosaurus, 'grassland')[0], '운석: 작은 동물이 덜 잃음');
  assert(EVENTS.rain.hit(A.quetzalcoatlus)[0] < EVENTS.rain.hit(A.tyrannosaurus)[0], '소나기: 나는 동물이 더 잃음');
  assert(EVENTS.cold.hit(A.woolly_mammoth)[0] > EVENTS.cold.hit(A.trilobite)[0], '추위: 털 있는 매머드가 버팀');
  const fw = EVENTS.flood.stay(A.spinosaurus), fs = EVENTS.flood.stay(A.velociraptor);
  assert(fw.fast > 0 && fw.power > 1 && fs.fast < 0, '홍수: 물 동물은 빠르고 세짐, 작은 땅 동물은 느려짐');
  const r = seeded(9);
  let byEv = 0, meteors = 0, at5 = 0, wxSeen = 0, wxTurn = 0, wxReason = 0, wxLong = 0, wxShown = 0;
  for (const st of ['grassland', 'jungle', 'waterside', 'underwater']) for (let i = 0; i < 200; i++) {
    const [a, b] = [cards[Math.floor(r() * cards.length)], cards[Math.floor(r() * cards.length)]];
    const res = battle(a, b, st, r, false, ev);
    res.rounds.forEach((x, k) => x.event && assert(x.event.id === 'meteor' ? k === 4 : k === 2, `사건 자리: ${x.event.id} @${k + 1}라운드`));
    if (res.rounds[2]) assert(res.rounds[2].event && res.rounds[2].event.id !== 'meteor', '3라운드 앞 날씨는 늘 일어남');
    res.rounds.forEach((x, k) => assert(!!x.wx === k >= 2 && (k < 2 || x.wx === res.rounds[2].event.id), '날씨는 3라운드부터 끝까지 그대로'));
    res.rounds.forEach((x, k) => x.tick && assert(k >= 3 && x.hp.every(h => h >= 0), '힘 빠짐은 4·5라운드 시작에만'));
    // 날씨 힘 빠짐만으로는 쓰러지지 않는다: 사건 없이 끝난 라운드에서 공격 없이 0이 되는 일 없음
    res.rounds.forEach(x => !x.event && !x.attacks.length && assert(false, '공격 없는 라운드는 사건 라운드뿐'));
    res.rounds.filter(x => x.event).forEach(x => assert(EVENTS[x.event.id].stages.includes(st), `${x.event.id}는 ${st}에 안 맞음`));
    if (res.rounds[4]) { at5++; meteors += res.rounds[4].event?.id === 'meteor'; }
    wxSeen += res.rounds.some(x => x.wx);
    wxTurn += res.rounds.some(x => x.attacks.some(t => t.wx));
    wxReason += res.reasons.some(k => k.startsWith('wx_'));
    if (res.byEvent) { byEv++; assert(!res.ko && res.hp[res.winner] > 0 && res.hp[1 - res.winner] === 0, '사건으로 끝나면 K.O. 아님'); }
    const W = [a, b][res.winner], L = [a, b][1 - res.winner];
    reasonLines(W, L, res.reasons, st).forEach(t => assert(typeof t === 'string' && !t.includes('undefined'), t));
    let noted = 0;
    makeScript(a, b, res, ['ground', 'ground'], null, st).rounds.forEach(x => {
      if (x.event) assert(x.event.lines.length === 2);
      x.notes?.forEach(([, t]) => assert(!t.includes('undefined'), t));
      if (x.notes?.length) noted++;
      x.attacks.forEach(t => t.wx && assert(t.wxText && !t.wxText.includes('undefined'), t.wxText));
    });
    if (res.rounds[3]) { wxLong++; wxShown += noted > 0 || res.rounds.some(x => x.attacks.some(t => t.wx)); }
  }
  assert(meteors / at5 > 0.28 && meteors / at5 < 0.42, `5라운드 운석 ${meteors}/${at5} (약 35%)`);
  assert(wxShown > wxLong * 0.6, `4라운드까지 간 판 중 날씨 영향이 화면에 보인 판 ${wxShown}/${wxLong}`);
  // 사건이 승부를 너무 흔들지 않는다: 사건 켬/끔 승률 차이 평균
  const pairs = [['tyrannosaurus', 'triceratops'], ['velociraptor', 'smilodon'], ['quetzalcoatlus', 'tyrannosaurus'], ['woolly_mammoth', 'smilodon'], ['trilobite', 'anomalocaris']];
  const shift = pairs.map(([x, y]) => Math.abs(winProb(A[x], A[y], 'grassland', ev) - winProb(A[x], A[y], 'grassland')));
  assert(shift.reduce((s, v) => s + v, 0) / shift.length < 0.12, `사건 켬/끔 승률 차이 ${shift.map(v => v.toFixed(2))}`);
  console.log('events ok', { byEvent: byEv, meteor5: `${meteors}/${at5}`, wxTurn: `${wxTurn}/${wxSeen}`, wxShown: `${wxShown}/${wxLong}`, wxReason, shift: shift.map(v => v.toFixed(2)).join(' ') }, '티라노 vs 삼엽충(초원) 사건 끔/켬', winProb(A.tyrannosaurus, A.trilobite, 'grassland'), winProb(A.tyrannosaurus, A.trilobite, 'grassland', ev));
}
