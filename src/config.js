// 모든 조절 상수는 여기 한 곳에 (PLAN 9절)
export const TIMING = { INTRO_MS: 2800, ROUND_MS: 5000, ROUNDS: 5, OUTRO_MS: 3300, KO_MS: 3400, EVENT_MS: 4600, METEOR_FALL_MS: 2800, BREATH_MS: 1200, KO_SLOW: 1.6, WIN_MS: 1600, CLOSE_MS: 900 };
// BREATH_MS: 라운드 사이 제자리 숨 고르기 시간, KO_SLOW: 마지막 한 방을 이만큼 느리게, WIN_MS: 이긴 동물이 신나서 폴짝 뛰고 결과 화면으로 넘어가기 전 시간 // 5라운드(K.O.·물러남이면 일찍 끝), 끝까지 가면 힘이 더 남은 쪽이 승리

// 종합 점수 S의 가중치 (PLAN 5.2)
export const WEIGHTS = { mass: 0.6, attack: 0.20, defense: 0.15, speed: 0.10, agility: 0.10, senses: 0.05, social: 0.05 };

export const BATTLE = {
  K: 1.3,               // 둘 다 빗나간 라운드에서 힘센 쪽이 이길 주사위 기울기
  MASS_LOG: [-3, 4.8],  // log10(kg) 이 범위를 0~10점으로 (1g ~ 63톤)
  // 공격이 맞을 확률 = HIT_BASE + HIT_AGI × ((내 민첩+감각)/2 − 상대 민첩) ± 날기·헤엄 보정
  HIT_BASE: 0.72, HIT_AGI: 0.03, HIT_MIN: 0.15, HIT_MAX: 0.95,
  HIT_VS_AIR: 0.15, HIT_FROM_AIR: 0.05, HIT_VS_WATER: 0.1, HIT_FROM_WATER: 0.08, HIT_STRANDED: 0.12,
  STAGE_POWER: 0.9,     // 무대 보정이 데미지에 주는 무게(물 밖의 물 동물은 힘을 못 씀)
  // 맞았을 때 데미지 = DMG_BASE × e^(DMG_K × (내 몸무게·공격 − 상대 몸무게·방어)) × (1 ± DMG_JITTER). 힘은 100에서 시작
  DMG_BASE: 20, DMG_K: 0.3, DMG_JITTER: 0.4, DMG_MIN: 2, DMG_MAX: 90,
  // 지침: 라운드마다 맞힐 확률이 TIRE_HIT × 라운드 × tire 만큼 준다. tire 0~1 = 무거울수록 크고, 빠르고 날쌜수록 작다
  TIRE_HIT: 0.04,
  // 물러남: 5라운드가 끝났을 때 힘이 적은 쪽이 판정 대신 도망치며 끝날 확률 = FLEE_K × (힘 차이 − FLEE_MIN)/100 + (힘 30 미만이면 FLEE_LOW) + FLEE_ROUND × 라운드 × (0.5 + tire)
  FLEE_MIN: 20, FLEE_K: 0.8, FLEE_LOW: 0.2, FLEE_ROUND: 0.04,
  SIMS: 2000,           // 예상 승률을 낼 때 미리 싸워 보는 횟수
};

// 무대별 보정(S에 더함, PLAN 5.2). mod: 서식지별, bigPenalty: 1톤~30톤으로 갈수록 최대 이만큼 감점, agilityBonus: 민첩 1점당 가산
export const STAGES = {
  grassland: { name: '초원', emoji: '🌾', desc: '탁 트인 넓은 들판', mod: { sea: -3, freshwater: -1.5, amphibious: -0.5, air: 0.5 } },
  jungle: { name: '정글', emoji: '🌴', desc: '나무가 빽빽한 숲', mod: { sea: -3, freshwater: -1.5, amphibious: -0.5, air: -0.5 }, bigPenalty: 1, agilityBonus: 0.06 },
  waterside: { name: '물가', emoji: '🏞️', desc: '얕은 물이 찰랑이는 강가', mod: { sea: -1, land: -0.5, amphibious: 1, freshwater: 1, air: 0.5 } },
  underwater: { name: '물속', emoji: '🌊', desc: '깊고 푸른 바닷속', mod: { land: -3, air: -3, amphibious: 0.3, freshwater: 0.5, sea: 1.5 } },
};

// 자연 사건(🌋 버튼으로 켜고 끔): BEFORE 라운드(0부터) 시작 전에 하나씩, 마지막 사건이 운석일 확률 METEOR, 힘 변화 흔들림 ±JITTER
export const EVENT = { AT: 2, METEOR_AT: 4, METEOR: 0.35, START: 0.6, JITTER: 0.25 }; // AT: 3라운드 앞(0부터 셈)에 날씨 사건(늘), 날씨는 끝까지 남아 영향(events.js stay). METEOR_AT: 5라운드 앞에 METEOR 확률로 운석. START: 날씨 사건 첫 충격 비율

// 맞았을 때 탱글탱글 튕기기(ui/battle.js, Motion 스프링). SQUASH: 눌리는 정도(약·세게·K.O.), TILT: 젖혀지는 각도(도),
// DURATION: 출렁임이 거의 끝나는 시간(초), BOUNCE: 0 = 한 번에 멈춤 ~ 1 = 오래 출렁
export const BOING = { SQUASH: [0.1, 0.2, 0.28], TILT: [3, 6, 9], DURATION: 0.5, BOUNCE: 0.6 };

// AI 자막을 배틀 시작 때 이만큼만 더 기다리고, 늦으면 문장 템플릿으로 (PLAN 8.2)
export const AI_WAIT_MS = 1500;

export const SFX_VOLUME = 0.5; // 효과음 전체 크기 (0~1)
export const MUSIC_VOLUME = 0.5; // 배경음악 크기 (0~1). 효과음이 묻히지 않게 작게

export const HUMANS = { teacher_m: 1.65, child_m: 1.1 };

// 블록 3D(?art=block, PLAN_BLOCK3D): 한 눈금 = 몸길이의 1/UNIT. 큰 동물이든 작은 동물이든 블록 수가 비슷해서 디테일 양이 같다
// BEVEL: 이 크기(블록) 이상인 상자는 모서리를 반 칸 깎아 두 상자로(0이면 끔), SLICE: 몸통을 이 길이마다 한 조각으로 썬다, TAIL: 수각류 꼬리 마디 수
// SAT·LIGHT: 몸 색 채도·밝기 배율(1 = 백과 팔레트 그대로)
export const BLOCK = { UNIT: 24, BEVEL: 1.2, SLICE: 1.4, TAIL: 10, SAT: 1.6, LIGHT: 1.15 };
// 3D 무대(?art=3d·block): 카메라가 내려다보는 각(도), 화각(도), 화면에 담는 여유(1 = 2D 화면과 같은 넓이), 싸우는 자리보다 뒤를 보는 정도(화면 높이 배),
// 하늘 배경막을 세우는 거리·너비·높이(카메라 거리 배. 거리가 작을수록 하늘이 넓게 보이고 뒤쪽 땅은 덜 보인다)
export const ARENA = { CAM_ELEV_DEG: 35, FOV: 38, FIT: 1.3, LOOK_BACK: 0.15, SKY_BACK: 0.32, SKY_W: 3.2, SKY_H: 0.4 };
// 등장 포효 클로즈업: 얼굴을 비스듬히 보는 각(도, 0 = 정면), 카메라 높이(도, 눈높이보다 살짝 위), 거리(머리 크기 배. 작으면 얼굴만 꽉 차서 무서울 수 있다). CLOSE_MS: 다가가고 빠지는 시간
export const CLOSE = { YAW: 45, ELEV: 5, DIST: 6 };
// 실사 3D(?art=real, PLAN_REAL3D): 해 높이·방향(도. 낮을수록 그림자가 길고 근육·비늘이 도드라진다), 해·하늘빛·환경광 세기, 노출,
// AO 구석 그림자 세기(0 끔)·반경(화면 높이 배), 비네트(화면 가장자리 어둡게). ?q=low 면 후처리를 끈다(느린 컴퓨터)
export const REAL = { SUN_ELEV: 22, SUN_YAW: -70, SUN: 3.4, HEMI: 0.2, ENV: 0.55, EXPOSURE: 1.0, AO: 1, AO_RADIUS: 0.03, VIGNETTE: 1.1 };
// 무대 생물(stagelife.js): 물속의 물고기 떼 수, 물방울 최대 수, 바닥에서 물방울이 나오는 곳 수, 빛줄기 수, 해파리 수
export const UNDERWATER = { FISH: 14, BUBBLES: 140, VENTS: 6, RAYS: 5, JELLY: 2 };
// 무대 생물(stagelife.js) 개수: 물가·정글·초원
export const LIFE = {
  waterside: { SPARKLE: 50, DRAGONFLY: 3, RIPPLE: 24, SPLASH: 60 },
  jungle: { LEAF: 50, FIREFLY: 24, VINE: 6, MIST: 6 },
  grassland: { BUTTERFLY: 4, SEED: 24, PTERO: 5 },
};

// 📔 공룡 일기장을 모을 구글 시트 Apps Script 웹 앱 주소(server/diary.gs). 비우면 기기마다 따로 저장
export const DIARY_URL = 'https://script.google.com/macros/s/AKfycbyjikj5EhXW7O_X2_T8Esppa4wInTcHvpZat6n41h4cxcABP370e7fec4fhMrXTzlk/exec';
