// 자연 사건(무대 사건 카드 + 운석): 라운드 사이에 일어나서 동물 특성에 따라 힘이 줄거나(−) 늘어난다(+).
// 승부를 정하는 계산이라 엔진에 둔다. 문장은 아이 눈높이로(숫자 없이)
import { massScore, tire } from './battle.js';

const isWater = a => ['sea', 'freshwater', 'amphibious'].includes(a.habitat);
const isAir = a => a.habitat === 'air';
const fur = a => ['large_mammal', 'bird'].includes(a.archetype);

// stages: 일어날 수 있는 무대, say(물속이면 sayUnder): 알림, hit(a, stage) → [힘 변화, 이유]. when: "~때" (이유 문장에 씀)
// stay(a, stage): 날씨가 남아 있는 3·4·5라운드 내내 → { hit: 내 공격이 맞을 확률 ±, guard: 상대 공격이 덜 맞는 정도,
//   fast: 먼저 공격하기 빠르기 ±(stats.speed 점수에 더함), power: 내 데미지 배수,
//   drain: 4·5라운드 시작마다 힘 변화(이것만으로는 쓰러지지 않음), up/down: 날씨 덕분/때문에 공격 결과가 바뀌었을 때 말풍선, tick: 힘이 빠질 때 말풍선,
//   note: 4·5라운드 시작 때 날씨 영향을 알려 주는 말(없으면 tick → up) }. 운석은 없음
export const EVENTS = {
  rain: {
    emoji: '🌧️', name: '소나기', say: '소나기가 쏟아져요!', when: '소나기가 왔을 때', stages: ['grassland', 'jungle', 'waterside'],
    hit: a => isAir(a) ? [-15, '날개가 젖어서 잘 못 날아요']
      : isWater(a) ? [8, '비가 와서 기운이 나요']
      : massScore(a.mass_kg.avg) >= 7.7 ? [-8, '땅이 질척해서 미끄러워요'] : [-3, '비를 맞아도 괜찮아요'],
    stay: a => isAir(a) ? { hit: -0.25, fast: -2, down: '날개가 젖어서 빗나갔어요', note: '날개가 젖어서 느려요' }
      : isWater(a) ? { hit: 0.12, fast: 1, up: '비를 맞고 기운이 나요' }
      : massScore(a.mass_kg.avg) >= 7.7 ? { fast: -2, note: '땅이 질척해서 미끄러워요' } : {},
  },
  flood: {
    emoji: '🌊', name: '홍수', say: '물이 콸콸 넘쳐요!', when: '홍수가 났을 때', stages: ['grassland', 'jungle', 'waterside'],
    hit: a => isWater(a) ? [12, '물이 많아져서 신나요']
      : isAir(a) ? [-2, '높이 날아서 피했어요']
      : massScore(a.mass_kg.avg) >= 7.7 ? [-6, '몸이 커서 물살을 버텼어요'] : [-(20 - massScore(a.mass_kg.avg)), '물살에 휩쓸릴 뻔했어요'],
    // 물 동물은 빠르고 세진다, 작은 땅 동물은 물에 발이 빠져 느려진다
    stay: a => isWater(a) ? { hit: 0.15, guard: 0.12, fast: 3, power: 1.3, up: '물속을 쌩쌩 헤엄쳐요', note: '물속에서 빠르고 힘이 세져요' }
      : !isAir(a) && massScore(a.mass_kg.avg) < 7.7 ? { hit: -0.18, fast: -3, power: 0.85, down: '물살 때문에 휘청했어요', note: '물에 발이 빠져서 느려요' } : {},
  },
  heat: {
    emoji: '☀️', name: '뙤약볕', say: '해가 쨍쨍, 너무 더워요!', when: '뙤약볕이 내리쬘 때', stages: ['grassland', 'jungle', 'waterside'],
    hit: (a, stage) => ['sea', 'freshwater'].includes(a.habitat) && stage !== 'waterside' ? [-18, '물이 없어서 몸이 말라요']
      : tire(a) > 0.6 ? [-Math.round(22 * tire(a)), '덩치가 커서 몸이 뜨거워요'] : [-Math.round(22 * tire(a)), '그늘에서 잘 쉬었어요'],
    stay: (a, stage) => ['sea', 'freshwater'].includes(a.habitat) && stage !== 'waterside' ? { drain: -5, tick: '몸이 말라요' }
      : tire(a) > 0.5 ? { drain: -Math.round(8 * tire(a)), fast: -2, power: 0.9, tick: '헥헥, 너무 더워서 느려요' } : {},
  },
  ash: {
    emoji: '🌋', name: '화산 폭발', say: '화산이 펑! 재가 날려요!', sayUnder: '바닷속 화산이 펑! 물이 뿌예져요!', when: '화산이 터졌을 때', stages: ['grassland', 'jungle', 'waterside', 'underwater'],
    hit: (a, stage) => isAir(a) ? [-20, '재 때문에 날 수 없어요']
      : a.stats.defense >= 6 ? [-Math.max(4, 16 - a.stats.defense), '단단한 몸이 막아 줬어요']
      : [-(16 - a.stats.defense), stage === 'underwater' ? '뿌연 물 때문에 앞이 안 보여요' : '콜록콜록! 숨쉬기 힘들어요'],
    stay: a => isAir(a) ? { hit: -0.2, drain: -3, fast: -2, down: '재 때문에 앞이 안 보여요', tick: '콜록콜록' }
      : a.stats.senses >= 7 ? { hit: 0.1, up: '냄새로 상대를 찾았어요', note: '냄새로 상대를 찾아요' } : a.stats.senses <= 4 ? { hit: -0.15, down: '재 때문에 앞이 안 보여요', note: '앞이 잘 안 보여요' } : {},
  },
  cold: {
    emoji: '❄️', name: '추위', say: '갑자기 꽁꽁 추워져요!', sayUnder: '바닷물이 꽁꽁 차가워져요!', when: '추위가 왔을 때', stages: ['grassland', 'jungle', 'waterside', 'underwater'],
    hit: a => fur(a) ? [-3, a.archetype === 'bird' ? '깃털 덕분에 따뜻해요' : '털 덕분에 따뜻해요']
      : massScore(a.mass_kg.avg) >= 8.5 ? [-6, '몸이 커서 따뜻함이 오래가요'] : [-(20 - massScore(a.mass_kg.avg)), '몸이 꽁꽁 얼었어요'],
    stay: a => fur(a) ? { fast: 2, note: '추워도 씽씽 움직여요' } : massScore(a.mass_kg.avg) >= 8.5 ? {} : { hit: -0.12, fast: -3, drain: -Math.round(6 - massScore(a.mass_kg.avg) / 2), down: '몸이 굳어서 느려요', tick: '덜덜 떨려요' },
  },
  whirl: {
    emoji: '🌀', name: '소용돌이', say: '바닷속에 소용돌이가 쳐요!', when: '소용돌이가 쳤을 때', stages: ['underwater'],
    hit: a => {
      const s = a.stats.speed + a.stats.agility;
      return s >= 12 ? [-Math.max(3, 22 - s), '힘차게 헤엄쳐 빠져나왔어요'] : [-(22 - s), '빙글빙글 휩쓸렸어요'];
    },
    stay: a => {
      const s = a.stats.speed + a.stats.agility;
      return s < 10 ? { hit: -0.2, fast: -2, down: '빙글빙글 휩쓸렸어요', note: '빙글빙글 어지러워요' } : s >= 14 ? { hit: 0.1, fast: 2, up: '물살을 타고 쌩!' } : {};
    },
  },
  // 운석: 큰 동물은 숨을 곳이 없고, 작은 동물은 굴·틈에 숨는다(공룡 대멸종 때 작은 동물이 살아남은 것처럼)
  meteor: {
    emoji: '☄️', name: '운석', say: '하늘에서 운석이 떨어져요!', sayUnder: '바다 위로 운석이 떨어져요!', when: '운석이 떨어졌을 때', stages: ['grassland', 'jungle', 'waterside', 'underwater'],
    hit: (a, stage) => a.mass_kg.avg < 25 ? [-4, '몸이 작아서 숨을 곳을 찾았어요']
      : stage === 'underwater' && isWater(a) ? [-10, '깊은 물속이라 덜 흔들렸어요']
      : [-Math.round(15 + 6 * (massScore(a.mass_kg.avg) - 5)), '몸이 커서 숨을 곳이 없었어요'],
  },
};
