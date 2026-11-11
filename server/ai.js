// AI 연결 (PLAN 8). Vite 개발 서버에 붙는 작은 프록시: 키는 .env 에만 있고 브라우저로 가지 않는다.
// 보내는 것은 동물 이름과 승부 결과뿐 (아이 사진·이름 금지). AI 답은 믿지 않고 여기서 검사·보정한다.
//   GET  /api/status       → { ai: 키 있음?, model }
//   GET  /api/ai-animals   → AI로 찾은 동물 목록(캐시)
//   POST /api/lookup       { name } → { animal } | { error }
//   POST /api/save-animal  { id, length_avg, mass_avg, habitat } → 교사가 고친 값 저장
//   POST /api/narrate      { ...승부 결과 } → { script } | { error }
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ARCHETYPES as ART } from '../src/art/draw.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const CACHE_FILE = new URL('../data/ai_animals.json', import.meta.url);
// 생김새는 손으로 다듬은 동물 카드(data/animals.json) 중 가장 닮은 것을 본뜨고(like), AI는 다른 점만 덧붙인다
const TEMPLATES = JSON.parse(readFileSync(new URL('../data/animals.json', import.meta.url), 'utf8'));
const TEMPLATE = Object.fromEntries(TEMPLATES.map(a => [a.id, a]));
const ARCHETYPES = Object.keys(ART);
const HABITATS = ['land', 'sea', 'freshwater', 'air', 'amphibious'];
// 그림 특징: AI가 고르기 쉽게 뜻을 같이 보낸다
const FEATURE_KO = {
  trunk: '코끼리 코', tusks: '위로 휜 긴 상아', tusks_down: '아래로 난 엄니', ears: '크게 펄럭이는 귀', round_ears: '동그란 귀(곰)', horn_nose: '코 위 큰 뿔(코뿔소)',
  antlers: '가지 친 사슴뿔', hump: '어깨 혹', fur: '긴 털', claws: '큰 앞발톱', sabre: '아주 긴 송곳니', feathers: '깃털', sickle_claw: '뒷발 낫 발톱',
  horns: '머리 뿔', nosehorn: '코 위 작은 뿔', crest: '머리 볏', crest2: '머리 볏 두 개', cryo: '왕관 같은 볏', bigeye: '큰 눈', toothless: '이빨 없음',
  plates: '등에 줄지은 판', thagomizer: '꼬리 끝 가시', spikes: '어깨·등 가시', bumps: '갑옷 혹', club: '꼬리 곤봉', spiked_club: '가시 꼬리 곤봉', shell: '등딱지',
  dorsal: '등지느러미', tail_fluke: '꼬리지느러미',
};
const FEATURES = Object.keys(FEATURE_KO);
const PATTERNS = ['none', 'stripes', 'bands', 'saddle', 'spots', 'mottle'];
const SKULLS = ['cat', 'dog', 'bear', 'elephant', 'rhino', 'deer', 'pig', 'sloth'];
const STATS = ['attack', 'defense', 'speed', 'agility', 'senses', 'social'];
const PALETTE = ['#7A5E40', '#D9C6A0'];
// 피·죽음·상처 표현은 쓰지 않는다 (PLAN 2). "피했어요"(피하다)는 괜찮다
const UNSAFE = /피를|피가|피투성|출혈|죽|상처|살해|찢어|사망|시체|잡아먹/;

const norm = s => String(s ?? '').replace(/[\s()]/g, '').toLowerCase();
const clamp = (x, a, b) => Math.min(b, Math.max(a, Number.isFinite(+x) ? +x : a));
const text = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const round = x => +(+x).toPrecision(3);

// ── AI 답 → 동물 카드 (믿지 않고 범위·형식을 모두 맞춘다) ──
export function cardFromAi(raw, query, model, today = new Date().toISOString().slice(0, 10)) {
  if (!raw || raw.is_real_animal !== true) return null;
  const name = text(raw.name_ko, 20);
  if (!name) return null;
  const range = (min, avg, max, lo, hi) => {
    const v = [min, avg, max].map(x => clamp(x, lo, hi)).sort((a, b) => a - b);
    return { min: round(v[0]), avg: round(v[1]), max: round(v[2]) };
  };
  const length = range(raw.length_min, raw.length_avg, raw.length_max, 0.005, 60);
  const mass = range(raw.mass_min, raw.mass_avg, raw.mass_max, 0.0001, 200000);
  const T = TEMPLATE[raw.like];
  const archetype = T?.archetype ?? (ARCHETYPES.includes(raw.archetype) ? raw.archetype : 'large_mammal');
  const hex = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : null);
  const base = T?.art.palette ?? PALETTE;
  const palette = [0, 1, 2].map(i => hex(raw.palette?.[i]) ?? base[i]).filter(Boolean);
  const list = (a, n) => (Array.isArray(a) ? a.map(x => text(x, 16)).filter(x => x && !UNSAFE.test(x)).slice(0, n) : []);
  const fmtLen = v => (v < 1 ? `${round(v * 100)}cm` : `${round(v)}m`);
  const fmtKg = v => (v >= 1000 ? `${round(v / 1000)}톤` : v >= 1 ? `${round(v)}kg` : `${round(v * 1000)}g`);
  const fun = text(raw.fun_fact, 80);
  return {
    id: `ai-${norm(raw.name_en || name).replace(/[^a-z0-9가-힣]/g, '') || Date.now()}`,
    name_ko: name, name_en: text(raw.name_en, 40), queries: [...new Set([norm(query), norm(name)])],
    era: text(raw.era, 24) || '알 수 없음', place: text(raw.place, 50) || '알 수 없음', diet: text(raw.diet, 20) || '알 수 없음',
    name_meaning: '', size_raw: `약 ${fmtLen(length.min)}~${fmtLen(length.max)}`, mass_raw: `약 ${fmtKg(mass.min)}~${fmtKg(mass.max)}`,
    habitat: HABITATS.includes(raw.habitat) ? raw.habitat : 'land',
    length_m: length, mass_kg: mass,
    stats: Object.fromEntries(STATS.map(k => [k, Math.round(clamp(raw.stats?.[k], 0, 10))])),
    weapons: list(raw.weapons, 3), armor: list(raw.armor, 2), archetype,
    art: artFromAi(raw, T, archetype, palette, hex),
    fun_fact: UNSAFE.test(fun) ? '' : fun,
    confidence: ['low', 'medium', 'high'].includes(raw.confidence) ? raw.confidence : 'low',
    source_note: `AI 추정(${model}, ${today}). 선생님 확인 필요`, origin: 'ai_estimated',
  };
}

// 본뜬 동물(T)의 그림 설정에 AI가 말한 차이(특징 더하기·빼기, 무늬, 부위별 색, 머리 모양, 비율)를 얹는다
function artFromAi(raw, T, archetype, palette, hex) {
  const pick = a => (Array.isArray(a) ? a.filter(x => FEATURES.includes(x)) : []);
  const drop = new Set(pick(raw.remove_features));
  const features = [...new Set([...(T?.art.features ?? []), ...pick(raw.add_features), ...pick(raw.features)])].filter(x => !drop.has(x));
  const { pattern: _p, mark: _m, markOp: _o, ...tp } = T?.art.params ?? {}; // 무늬는 본뜬 동물 것을 쓰지 않는다(얼룩말이 사슴 점박이가 되지 않게)
  const p = { ...ART[archetype].params, ...tp };
  if (PATTERNS.includes(raw.pattern) && raw.pattern !== 'none') Object.assign(p, { pattern: raw.pattern, mark: hex(raw.mark) ?? undefined });
  for (const k of ['limb', 'face', 'ear']) if (hex(raw[k])) p[k] = raw[k];
  if (raw.shoulder === true && p.limb) p.shoulder = true;
  if (SKULLS.includes(raw.skull) && archetype === 'large_mammal') p.skull = raw.skull;
  // 비율: 다리 길이·목 길이·몸 굵기·머리 크기를 0.6~2배로
  const k = n => clamp(raw.scale?.[n] ?? 1, 0.6, 2), [kl, kn, kb, kh] = ['legs', 'neck', 'body', 'head'].map(k);
  if (p.hip != null) { // 네발: 다리가 길어지면 몸·머리·꼬리가 함께 오르고, 목이 길어지면 머리가 어깨에서 더 멀어진다
    p.neck = [p.neck[0], p.sh * kl + (p.neck[1] - p.sh) * kn];
    p.tail = [p.tail[0], p.tail[1] + p.hip * (kl - 1)];
    p.hip *= kl; p.sh *= kl;
    if (p.legR != null) p.legR *= kb;
  } else if (p.h != null) p.h *= kl; // 두발·익룡
  if (typeof p.neck === 'number') p.neck *= kn;
  if (p.neckL != null) p.neckL *= kn;
  if (p.bd != null) p.bd *= kb;
  if (p.r != null) p.r *= kb;
  if (p.hl != null) p.hl *= kh;
  const r4 = v => (typeof v === 'number' ? round(v) : Array.isArray(v) ? v.map(r4) : v);
  return { palette, features, params: Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined).map(([n, v]) => [n, r4(v)])), ...(T && { like: T.id }) };
}

// ── AI 자막 검사: 길이, 표현, 이름(누가 맞히고 누가 피했는지 바꾸지 못하게) ──
// p.attacks: [{ attacker, defender, hit, ko }] 순서대로. 맞힌 줄엔 공격한 쪽, 피한 줄엔 피한 쪽 이름이 있어야 한다
export function scriptFromAi(raw, p) {
  const ok = (s, mustHave, max = 46) => {
    const t = text(s, 200);
    return t && t.length <= max && !UNSAFE.test(t) && mustHave.every(n => t.includes(n)) ? t : null;
  };
  if (!raw) return null;
  return {
    intro: ok(raw.intro, [p.a, p.b], 40),
    lines: p.attacks.map((t, i) => ok(raw.lines?.[i], [t.hit ? t.attacker : t.defender])),
    outro: ok(raw.outro, [p.winner], 60),
  };
}

const LOOKUP_SCHEMA = {
  type: 'object',
  properties: {
    is_real_animal: { type: 'boolean' }, name_ko: { type: 'string' }, name_en: { type: 'string' },
    era: { type: 'string' }, place: { type: 'string' }, diet: { type: 'string' }, habitat: { type: 'string', enum: HABITATS },
    length_min: { type: 'number' }, length_avg: { type: 'number' }, length_max: { type: 'number' },
    mass_min: { type: 'number' }, mass_avg: { type: 'number' }, mass_max: { type: 'number' },
    stats: { type: 'object', properties: Object.fromEntries(STATS.map(k => [k, { type: 'integer' }])), required: STATS },
    weapons: { type: 'array', items: { type: 'string' } }, armor: { type: 'array', items: { type: 'string' } },
    like: { type: 'string', enum: TEMPLATES.map(a => a.id) }, archetype: { type: 'string', enum: ARCHETYPES },
    palette: { type: 'array', items: { type: 'string' } },
    add_features: { type: 'array', items: { type: 'string', enum: FEATURES } }, remove_features: { type: 'array', items: { type: 'string', enum: FEATURES } },
    pattern: { type: 'string', enum: PATTERNS }, mark: { type: 'string' }, limb: { type: 'string' }, face: { type: 'string' }, ear: { type: 'string' }, shoulder: { type: 'boolean' },
    skull: { type: 'string', enum: SKULLS },
    scale: { type: 'object', properties: { legs: { type: 'number' }, neck: { type: 'number' }, body: { type: 'number' }, head: { type: 'number' } } },
    fun_fact: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['is_real_animal', 'name_ko', 'habitat', 'length_avg', 'mass_avg', 'stats', 'like', 'archetype', 'palette', 'add_features', 'remove_features', 'pattern', 'mark', 'limb', 'face', 'ear', 'shoulder', 'confidence'],
};
const LIKE_LIST = ARCHETYPES.map(k => `${k}: ${TEMPLATES.filter(a => a.archetype === k).map(a => `${a.id}(${a.name_ko}${a.art.features.length ? ' ' + a.art.features.map(f => FEATURE_KO[f]).join('·') : ''})`).join(', ')}`).join('\n');
const lookupPrompt = name => `너는 초등학생용 동물·고생물 도감 편집자야. 동물 이름: "${name}"
이 이름이 실제로 존재했거나 지금 사는 동물(공룡, 고대 동물, 현생 동물)이면 is_real_animal=true, 아니면 false.
- name_ko: 한국어 대표 이름, era: 살았던 시대(예: "백악기 후기", 지금 사는 동물은 "현재"), place: 살았던 곳(대륙 이름 포함), diet: 식성
- length_*: 몸길이(m), mass_*: 몸무게(kg). 연구 추정의 최소·대표·최대값. 자신 없으면 confidence를 low로.
- stats: 0~10 정수. attack 무는 힘·무기, defense 갑옷·가죽·덩치, speed 달리기·헤엄 속도, agility 날쌤, senses 감각, social 무리 생활.
생김새(그림): 아래 동물 중 몸 모양이 가장 닮은 것 하나를 like 에 고르고, 그 동물과 다른 점만 적어.
${LIKE_LIST}
- archetype: like 로 고른 동물의 체형(앞의 영어 낱말)
- add_features / remove_features: 고른 동물에 더하거나 뺄 특징. 특징 뜻: ${FEATURES.map(f => `${f}=${FEATURE_KO[f]}`).join(', ')}
  특징은 그 동물에 눈에 띄게 있는 것만 더한다(없는 혹·뿔을 지어내지 마)
- 예시(이 형식을 따라 해):
  코끼리 → like woolly_mammoth, remove_features [fur, hump], add_features [ears], palette [#8c8a86, #7a7874, #6a6864]
  판다 → like cave_bear, remove_features [fur], palette [#f2f0e8, #ece8dc, #1e1e1e], limb #1e1e1e, face #1e1e1e, ear #1e1e1e, shoulder true
  얼룩말 → like megaloceros, remove_features [antlers], skull deer, palette [#f4f4f0, #ffffff, #1a1a1a], pattern bands, mark #1a1a1a
  호랑이 → like smilodon, remove_features [sabre], palette [#d8822e, #f4ead8, #1e1a16], pattern stripes, mark #1e1a16
- palette: [등 색, 배 색, 볏·장식 색] (#RRGGBB). 실제 동물 색에 가깝게. 다리·눈 주변·귀만 다른 색이면 그 색은 palette 가 아니라 limb·face·ear 에 넣고, 줄무늬·점은 pattern·mark 로
- pattern: 몸 무늬(none 없음, stripes 가는 줄, bands 굵은 띠, saddle 등 얼룩, spots 점박이, mottle 얼룩덜룩), mark: 무늬 색
- limb: 다리 색이 몸과 다르면 그 색, face: 눈 주변 무늬 색(판다·너구리), ear: 귀 색 — 몸과 같으면 "none". shoulder: 어깨에 다리 색 띠가 있으면 true(판다). 무늬가 없으면 pattern none, mark "none"
- skull(포유류만): 머리 모양 cat 고양이 | dog 개·늑대·여우 | bear 곰·판다 | elephant 코끼리 | rhino 코뿔소·하마 | deer 사슴·말·기린·얼룩말 | pig 돼지·멧돼지 | sloth 나무늘보·아르마딜로
- scale: 고른 동물보다 다리(legs)·목(neck)·몸 굵기(body)·머리(head)가 몇 배인지(0.6~2, 같으면 1). 예) 기린 → like megaloceros, scale.neck 2, scale.legs 1.3
- weapons/armor: 짧은 한국어 낱말, fun_fact: 초등학생 눈높이 한 문장. 피·상처·죽음 표현은 쓰지 마.`;

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: { intro: { type: 'string' }, lines: { type: 'array', items: { type: 'string' } }, outro: { type: 'string' } },
  required: ['intro', 'lines', 'outro'],
};
const narratePrompt = p => `초등학교 1~2학년이 보는 상상 동물 배틀의 자막을 써 줘. 승패는 이미 정해졌으니 절대 바꾸지 마.
무대: ${p.stage}. ${p.a} 대 ${p.b}.
공격 순서(${p.attacks.length}번): ${p.attacks.map((t, i) => `${i + 1}) ${t.attacker}의 ${t.action} → ${t.hit ? (t.ko ? `맞음! ${t.defender}가 쓰러져 빙글빙글(K.O.)` : '맞음') : `${t.defender}가 피함`}`).join(' / ')}
최종 승자: ${p.winner}. ${p.ko ? `${p.loser}는 쓰러져 눈앞이 빙글빙글(K.O.).` : p.fled ? `${p.loser}는 이길 수 없다고 느껴 경기 도중 도망침.` : `${p.loser}는 5라운드 끝까지 버텼지만 힘이 더 많이 빠져 물러남.`}
이긴 이유: ${p.reasons.join(' ')}
규칙: 아주 쉬운 말, 신나는 말투, "~어요"체. 의성어 좋아. 피·상처·죽음·잡아먹기 표현 금지.
- intro: 두 이름을 모두 넣어 30자 안쪽
- lines: 공격 순서와 똑같은 개수. 맞은 공격은 공격한 쪽 이름을 넣어 그 동작을, 피한 공격은 피한 쪽 이름을 넣어 피한 모습을 각각 30자 안쪽으로
- outro: 승자 이름을 넣어 결과를 45자 안쪽으로`;

async function callModel(env, prompt, schema, timeoutMs, fetchImpl = fetch) {
  const res = await fetchImpl(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ model: env.GEMINI_MODEL, input: prompt, store: false, response_format: { type: 'text', mime_type: 'application/json', schema } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429) throw Object.assign(new Error('busy'), { code: 'busy' });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`), { code: 'http' });
  const json = await res.json();
  // 응답에서 글 찾기: Interactions 형식(steps[].content[].text) → 예전 형식(candidates)
  const out = json.output_text
    ?? json.steps?.filter(s => s.type === 'model_output').flatMap(s => s.content ?? []).find(c => c.type === 'text')?.text
    ?? json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw Object.assign(new Error('응답에 글이 없음'), { code: 'empty' });
  return JSON.parse(out);
}


async function body(req) {
  let s = '';
  for await (const chunk of req) { s += chunk; if (s.length > 20000) throw new Error('too big'); }
  return JSON.parse(s || '{}');
}

// fetchImpl·cacheFile 은 검사(테스트)에서 바꿔 끼우려고 열어 둔 것
// store 는 동물 목록을 어디에 둘지(기본: 파일). Vercel 에서는 api/index.js 가 Blob 저장소로 바꿔 끼운다
export const fileStore = cacheFile => ({
  read: async () => { try { return existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : []; } catch { return []; } },
  write: async list => writeFileSync(cacheFile, JSON.stringify(list, null, 2) + '\n'),
});
export function aiMiddleware(rawEnv, { fetchImpl = fetch, cacheFile = CACHE_FILE, store = fileStore(cacheFile) } = {}) {
  const readCache = store.read, writeCache = store.write;
  const env = { GEMINI_API_KEY: rawEnv.GEMINI_API_KEY?.trim(), GEMINI_MODEL: rawEnv.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite' };
  // 선생님 암호: TEACHER_PASSWORD 가 있으면 AI를 부르거나 저장하는 요청(POST)은 x-teacher-pw 헤더가 맞아야 한다
  // ponytail: 4자리 숫자는 마음먹고 하나씩 넣어 보면 뚫린다. 그때는 더 긴 암호 + 횟수 제한을 붙일 것
  const pw = rawEnv.TEACHER_PASSWORD?.trim();
  const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
  const fail = (res, e) => send(res, 200, { error: e.code === 'busy' ? 'busy' : 'failed', detail: String(e.message).slice(0, 200) });

  return async (req, res, next) => {
    if (!req.url.startsWith('/api/')) return next();
    const path = req.url.split('?')[0];
    try {
      if (path === '/api/status') return send(res, 200, { ai: !!env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
      if (path === '/api/ai-animals') return send(res, 200, await readCache());
      if (req.method !== 'POST') return send(res, 404, { error: 'not found' });
      if (pw && req.headers?.['x-teacher-pw'] !== pw) return send(res, 200, { error: 'locked' });
      const p = await body(req);

      if (path === '/api/lookup') {
        const q = text(p.name, 30);
        if (!q) return send(res, 400, { error: 'name' });
        const hit = (await readCache()).find(a => a.queries?.includes(norm(q)));
        if (hit) return send(res, 200, { animal: hit, cached: true });
        if (!env.GEMINI_API_KEY) return send(res, 200, { error: 'nokey' });
        const card = cardFromAi(await callModel(env, lookupPrompt(q), LOOKUP_SCHEMA, 30000, fetchImpl), q, env.GEMINI_MODEL);
        if (!card) return send(res, 200, { error: 'unknown' });
        const list = (await readCache()).filter(a => a.id !== card.id);
        await writeCache([...list, card]);
        return send(res, 200, { animal: card });
      }

      if (path === '/api/save-animal') {
        const list = await readCache(), a = list.find(x => x.id === p.id);
        if (!a) return send(res, 404, { error: 'not found' });
        const L = clamp(p.length_avg, 0.005, 60), M = clamp(p.mass_avg, 0.0001, 200000);
        Object.assign(a, {
          length_m: { min: round(Math.min(a.length_m.min, L)), avg: round(L), max: round(Math.max(a.length_m.max, L)) },
          mass_kg: { min: round(Math.min(a.mass_kg.min, M)), avg: round(M), max: round(Math.max(a.mass_kg.max, M)) },
          habitat: HABITATS.includes(p.habitat) ? p.habitat : a.habitat, origin: 'teacher_edited',
        });
        await writeCache(list);
        return send(res, 200, { animal: a });
      }

      if (path === '/api/narrate') {
        if (!env.GEMINI_API_KEY) return send(res, 200, { error: 'nokey' });
        const n = s => text(s, 24);
        const q = {
          stage: n(p.stage), a: n(p.a), b: n(p.b), winner: n(p.winner), loser: n(p.loser), ko: !!p.ko, fled: !!p.fled,
          reasons: (p.reasons ?? []).slice(0, 2).map(r => text(r, 80)),
          attacks: (p.attacks ?? []).slice(0, 10).map(t => ({ attacker: n(t.attacker), defender: n(t.defender), action: n(t.action), hit: !!t.hit, ko: !!t.ko })),
        };
        const script = scriptFromAi(await callModel(env, narratePrompt(q), SCRIPT_SCHEMA, 20000, fetchImpl), q);
        return send(res, 200, script ? { script } : { error: 'failed' });
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      return fail(res, e);
    }
  };
}
