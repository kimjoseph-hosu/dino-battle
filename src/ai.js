// 브라우저 쪽 AI 호출. 서버(/api)가 없거나 실패해도 절대 멈추지 않는다 — 실패하면 null
// 선생님 암호는 이 기기(브라우저)에 한 번 넣으면 기억한다. 없으면 AI 자막도 쉬고 기본 자막이 나온다
const PW = 'teacher-pw';
export const teacherPw = { get: () => { try { return localStorage.getItem(PW) ?? ''; } catch { return ''; } },
  set: v => { try { v ? localStorage.setItem(PW, v) : localStorage.removeItem(PW); } catch {} } };
const post = (url, body, ms) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-teacher-pw': teacherPw.get() }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) })
  .then(r => r.json()).catch(() => ({ error: 'offline' }));

export const loadAiAnimals = () => fetch('/api/ai-animals').then(r => r.json()).then(l => (Array.isArray(l) ? l : [])).catch(() => []);
// → { animal } | { error: 'nokey' | 'locked' | 'busy' | 'unknown' | 'failed' | 'offline' }
export const lookup = name => post('/api/lookup', { name }, 20000);
export const saveAnimal = edit => post('/api/save-animal', edit, 5000);
export const narrate = payload => post('/api/narrate', payload, 22000).then(r => r.script ?? null);
