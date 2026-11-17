// 수수께끼 보스: 동물 데이터로 힌트를 만들고(쉬운 것 → 결정적인 것), 헷갈릴 만한 후보를 뽑는다. 화면은 ui/boss.js
import { sizeLike } from './story.js';

// 공룡일까? (공부 탭 kindHtml 과 힌트가 같이 쓴다)
export const DINO = ['theropod', 'sauropod', 'ceratopsian', 'armored'];
export const NOT_DINO = {
  glyptodon: '등딱지를 멘 포유류예요. 아르마딜로 친척이에요.', doedicurus: '등딱지를 멘 포유류예요. 아르마딜로 친척이에요.',
  mosasaurus: '바다에 살던 커다란 도마뱀 친척이에요.', archelon: '아주 아주 큰 바다거북이에요.', basilosaurus: '고래예요. 아기에게 젖을 먹이는 포유류예요.',
  megalodon: '아주 아주 큰 상어예요.', dunkleosteus: '갑옷을 입은 옛날 물고기예요.', pakicetus: '고래의 아주 먼 조상이에요.', ambulocetus: '걸어 다니던 고래 조상이에요.',
  tiktaalik: '물고기가 땅으로 올라오던 때의 동물이에요.', megalania: '아주 큰 도마뱀이에요.', meganeura: '아주 큰 잠자리 친척이에요.',
  dimetrodon: '등에 돛이 있지만 공룡보다 먼저 산 동물이에요. 포유류의 아주 먼 친척이에요.', gorgonops: '포유류의 아주 먼 친척이에요.', lystrosaurus: '포유류의 아주 먼 친척이에요.',
};
export const isDino = a => DINO.includes(a.archetype) && !NOT_DINO[a.id];

const jong = w => { w = w.replace(/[^가-힣]+$/, ''); const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 > 0; };
const iye = w => w + (jong(w) ? '이에요' : '예요');
const HOME = { land: ['🦶', '나는 땅 위를 걸어 다녀요'], sea: ['🌊', '나는 바다에서 헤엄쳐요'], freshwater: ['🏞️', '나는 강에서 헤엄쳐요'], air: ['🪽', '나는 하늘을 날아요'], amphibious: ['🐊', '나는 물가에 살아요. 물에도 들어가요'] };

// → [{ icon, text }] 사는 곳 → 먹이 → 공룡일까 → 크기 → 무기 → 이름 뜻 (없는 건 건너뜀)
export function bossHints(a) {
  const d = a.diet ?? '', w = a.weapons?.[0], m = a.name_meaning;
  return [
    HOME[a.habitat] && { icon: HOME[a.habitat][0], text: HOME[a.habitat][1] },
    d && (/육식/.test(d) ? { icon: '🍖', text: '나는 고기를 먹어요' } : /초식/.test(d) ? { icon: '🌿', text: '나는 풀과 나뭇잎을 먹어요' } : { icon: '🍽️', text: '나는 이것저것 다 먹어요' }),
    isDino(a) ? { icon: '🦖', text: '나는 공룡이에요' } : a.archetype === 'bird' ? { icon: '🐦', text: '나는 새예요' } : { icon: '❗', text: '나는 공룡이 아니에요' },
    { icon: '📏', text: `내 몸은 ${(t => (t.endsWith('요') ? t : iye(t)))(sizeLike(a.length_m.avg))}` },
    w ? { icon: '🦷', text: `내 무기는 ${iye(w)}` } : a.armor?.[0] && { icon: '🛡️', text: `내 몸을 지키는 건 ${iye(a.armor[0])}` },
    m && m !== '알 수 없음' && { icon: '💬', text: `내 이름은 “${m}”${jong(m) ? '이라는' : '라는'} 뜻이에요` },
  ].filter(Boolean);
}

// 보스가 될 수 있는 동물: 백과 동물 중 힌트가 넉넉하고 보스다운 크기(50kg 이상)
export const bossPool = list => list.filter(a => !a.drawing && a.book && a.weapons?.length && a.mass_kg.avg >= 50);

// 후보 넷(보스 + 헷갈릴 동물 셋): 사는 곳이 같은 동물 둘 + 아무나 하나, 섞어서
export function suspects(boss, list, rng = Math.random) {
  const pool = bossPool(list).filter(a => a.id !== boss.id && a.name_ko !== boss.name_ko);
  const mix = xs => xs.map(x => [rng(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  const same = mix(pool.filter(a => a.habitat === boss.habitat)).slice(0, 2);
  const rest = mix(pool.filter(a => !same.includes(a))).slice(0, 3 - same.length);
  return mix([boss, ...same, ...rest]);
}
