// 백과 추출본(이름·뜻·시대·사는 곳·식성·크기 표기)과 animals.json(수치·특성·그림)을 합친다.
import books from '../source/animals_from_books.json';
import cards from '../data/animals.json';

const byName = Object.fromEntries(books.map(b => [b.name_ko.split('(')[0], b]));

// 이름으로 찾기(교사가 입력한 이름): 한글 이름, 별명, 영어 이름. 띄어쓰기·대소문자 무시
const norm = s => (s ?? '').replace(/[\s()]/g, '').toLowerCase();
export function findAnimal(q) {
  const n = norm(q);
  if (!n) return null;
  return animals.find(a => [a.name_ko, a.alias, a.name_en, ...(a.queries ?? [])].some(x => norm(x) === n)) ?? null;
}
// 백과에는 있지만 아직 특성 데이터(animals.json)가 없는 동물인지
export const inBooksOnly = q => !findAnimal(q) && books.some(b => norm(b.name_ko).startsWith(norm(q)) && norm(q).length > 1);

// AI로 찾은 동물(서버 캐시)을 목록에 더한다. 백과 목록과는 따로 둔다(PLAN 4.1: 백과 목록은 늘리지 않음)
// 같은 이름의 백과 카드가 생기면(예: 나중에 백과에 넣은 기가노토사우루스) AI 카드는 빼고 백과 카드만 쓴다
export const addAnimals = list => list.forEach(a => !animals.some(x => x.id === a.id || x.name_ko === a.name_ko) && animals.push(a));
export const aiAnimals = () => animals.filter(a => a.origin === 'ai_estimated' || a.origin === 'teacher_edited');

export const animals = cards.map(c => {
  const b = byName[c.name_ko];
  if (!b) throw new Error(`백과 목록에 없는 이름: ${c.name_ko}`);
  return { ...b, ...c };
});
