// Vercel 함수: 개발 서버와 같은 aiMiddleware 를 그대로 쓴다. /api/* 는 vercel.json 이 여기로 보낸다(?p=경로)
// 동물 목록은 Vercel Blob(비공개)의 ai_animals.json 하나에 오래 저장한다. 처음엔 data/ai_animals.json 으로 시작
import { readFileSync } from 'node:fs';
import { get, put } from '@vercel/blob';
import { aiMiddleware } from '../server/ai.js';

const KEY = 'ai_animals.json';
const seed = () => JSON.parse(readFileSync(new URL('../data/ai_animals.json', import.meta.url), 'utf8'));
// ponytail: 파일 하나를 통째로 덮어써서, 두 사람이 같은 순간에 저장하면 한쪽이 사라질 수 있다. 여러 반이 함께 쓰면 동물마다 따로 저장할 것
const store = {
  read: async () => {
    const r = await get(KEY, { access: 'private', useCache: false }).catch(() => null);
    return r?.statusCode === 200 ? JSON.parse(await new Response(r.stream).text()) : seed();
  },
  write: list => put(KEY, JSON.stringify(list, null, 2), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' }),
};

const handle = aiMiddleware(process.env, { store });
export default (req, res) => {
  const u = new URL(req.url, 'http://x');
  req.url = '/api/' + (u.searchParams.get('p') ?? '');
  return handle(req, res, () => { res.statusCode = 404; res.end('{"error":"not found"}'); });
};
