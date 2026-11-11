// "만약에" 문구: 두 동물이 진짜로 만날 수 있었는지 (시대·대륙·서식지). 백과의 era·place 문장을 읽는다.

// 지질 시대(백만 년 전, 시작~끝)
export const PERIODS = {
  캄브리아기: [539, 485], 오르도비스기: [485, 444], 실루리아기: [444, 419], 데본기: [419, 359], 석탄기: [359, 299],
  페름기: [299, 252], 트라이아스기: [252, 201], 쥐라기: [201, 145], 백악기: [145, 66],
  팔레오세: [66, 56], 에오세: [56, 34], 올리고세: [34, 23], 마이오세: [23, 5.3], 플라이오세: [5.3, 2.6], 빙하기: [2.6, 0.012],
};

// 전기(초기)·중기·후기의 실제 경계(국제 연대 층서표, 백만 년 전): [시작, 전기 끝, 중기 끝, 끝].
// 백악기는 전기·후기 둘뿐이라 '중기'는 그 경계 무렵(1억 1300만~9400만 년 전)으로 본다. 여기 없는 시대는 3등분
export const SUB = { 페름기: [299, 273, 259, 252], 트라이아스기: [252, 247, 237, 201], 쥐라기: [201, 174, 163, 145], 백악기: [145, 100.5, 100.5, 66] };
export function subRange(name, part) {
  const [s, e] = PERIODS[name], third = (s - e) / 3, [a, b, c, d] = SUB[name] ?? [s, s - third, e + third, e];
  if (part === 'early') return [a, b];
  if (part === 'mid') return name === '백악기' ? [113, 94] : [b, c];
  if (part === 'late') return [c, d];
  return [s, e];
}

// era 문장 → [시작, 끝] (백만 년 전). 여러 시대가 나오면 모두 덮는 범위
export function eraRange(era) {
  let start = -Infinity, end = Infinity;
  for (const name of Object.keys(PERIODS)) {
    const i = era.indexOf(name);
    if (i < 0) continue;
    const q = era.slice(i + name.length, i + name.length + 3);
    const [qs, qe] = subRange(name, /^\s?(초|전)/.test(q) ? 'early' : /^\s?(중)/.test(q) ? 'mid' : /^\s?(후|말)/.test(q) ? 'late' : 'all');
    start = Math.max(start, qs);
    end = Math.min(end, qe);
  }
  if (era.includes('년 전')) end = Math.min(end, 0.0006); // "약 600년 전까지"
  if (/현재|지금|현생/.test(era)) return [Number.isFinite(start) && start > 0 ? start : 0.3, 0]; // 지금 사는 동물
  if (start === -Infinity) start = 2.6; // 신생대 끝무렵만 적힌 경우
  return [start, end];
}

const CONTINENTS = {
  북아메리카: ['북아메리카', '북·남', '미국', '캐나다', '텍사스', '네바다', '애리조나', '캔자스', '오클라호마', '알래스카', '뉴멕시코'],
  남아메리카: ['남아메리카', '북·남', '남미', '아르헨티나', '브라질', '콜롬비아', '파타고니아'],
  유럽: ['유럽', '영국', '독일', '프랑스', '포르투갈', '스위스', '루마니아', '러시아', '노르웨이'],
  아시아: ['아시아', '중국', '몽골', '인도', '시베리아', '파키스탄', '신장'],
  아프리카: ['아프리카', '모로코', '이집트', '니제르', '케냐', '레소토'],
  오세아니아: ['오스트레일리아', '뉴질랜드'],
  남극: ['남극'],
};
export const continents = place =>
  place.includes('전 세계') ? Object.keys(CONTINENTS) : Object.keys(CONTINENTS).filter(c => CONTINENTS[c].some(k => place.includes(k)));

const WATER = ['sea', 'freshwater'], HOME = { land: '땅', sea: '바다', freshwater: '강', air: '하늘', amphibious: '물가' };

export function fmtYears(ma) {
  if (ma >= 100) return `약 ${+(ma / 100).toFixed(1)}억 년`;
  if (ma >= 1) return `약 ${Math.round(ma) * 100}만 년`;
  return `약 ${Math.round(ma * 1000) * 1000}년`;
}

// → { met, lines: [...] }
export function whatIf(a, b, josaNeun) {
  const [as, ae] = eraRange(a.era), [bs, be] = eraRange(b.era);
  const gap = Math.max(0, be - as, ae - bs); // 겹치면 0
  const shared = continents(a.place).filter(c => continents(b.place).includes(c));
  const habitatClash = WATER.includes(a.habitat) !== WATER.includes(b.habitat) && ![a.habitat, b.habitat].includes('amphibious');
  const lines = [];
  if (gap > 0) lines.push(`${josaNeun(a.name_ko)} ${a.era}, ${josaNeun(b.name_ko)} ${b.era}에 살았어요. ${fmtYears(gap)}이나 차이 나요!`);
  else if (Math.min(as, bs) - Math.max(ae, be) <= 0) lines.push(`${josaNeun(a.name_ko)} ${a.era}, ${josaNeun(b.name_ko)} ${b.era}에 살았어요. 시대가 딱 맞닿아 있지만 함께 살지는 않았어요.`); // 한쪽이 사라질 때 다른 쪽이 나타남(백악기 끝 ↔ 팔레오세)
  if (!shared.length) lines.push(`${josaNeun(a.name_ko)} ${a.place}, ${josaNeun(b.name_ko)} ${b.place}에 살았어요.`);
  if (habitatClash) lines.push(`${josaNeun(a.name_ko)} ${HOME[a.habitat]}에서, ${josaNeun(b.name_ko)} ${HOME[b.habitat]}에서 살았어요.`);
  return { met: !lines.length, shared, lines };
}
