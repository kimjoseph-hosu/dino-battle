// M1 그림 확인 화면 (#gallery): 같은 눈금 한 줄 + 동물별 카드
import { animals } from '../data.js';
import { drawAnimal, drawHuman, liveArt } from '../art/index.js';
import { HUMANS } from '../config.js';
import { fitSvg, ruler } from './scene.js';
import { drawAnimal as draw2d } from '../art/draw.js';
import { posedShot, drawAnimal as draw3d } from '../art/draw3d.js';
import { REPS } from '../art/shape3d.js';
import { sfx } from './sfx.js';
import { STATES } from '../art/motion3d.js';

const place = (a, x) => `<g transform="translate(${x} 0) scale(${a.length_m.avg})">${drawAnimal(a)}</g>`;

export function showGallery(root) {
  const sorted = [...animals].sort((a, b) => a.length_m.avg - b.length_m.avg);
  // 같은 눈금으로 한 줄에 W미터씩 끊어 여러 줄로 쌓는다(한 줄이면 700m가 넘어 다 깨알만 해짐)
  const W = 120, GAP = 16;
  const rows = [];
  let x = 2.2, row = drawHuman(HUMANS.teacher_m, '선생님') + `<g transform="translate(1.2 0)">${drawHuman(HUMANS.child_m, '어린이')}</g>`;
  for (const a of sorted) {
    if (x + a.length_m.avg > W) { rows.push(row); row = ''; x = 0; }
    row += place(a, x); x += a.length_m.avg + 1;
  }
  rows.push(row);
  const lineup = rows.map((r, i) => `<g transform="translate(0 ${i * GAP})">${ruler(-1, W) + r}</g>`).join('');
  root.innerHTML = `<h1>그림 확인 (${animals.length}종)</h1><svg id="lineup" class="scene"></svg>
    <div class="cards">${animals.map(a => `<figure><svg class="scene" data-id="${a.id}"></svg>
      <figcaption><b>${a.name_ko}</b> <small>${a.archetype}</small><br>${a.size_raw} · ${a.mass_raw}</figcaption></figure>`).join('')}</div>`;
  fitSvg(root.querySelector('#lineup'), lineup, 0.02);
  for (const a of animals) fitSvg(root.querySelector(`svg[data-id="${a.id}"]`), place(a, 0));
}

// 3D 모델 확인 화면 (#model=mosasaurus): 기존 2D 옆에 3D 여러 각도 + 동작 다섯 가지(정지 컷 + 직접 움직여 보기)
const MOTION_KO = { idle: '대기', charge: '돌진', bite: '물기', hit: '맞음', tired: '지침' };
export function showModel(root, a) {
  const angles = [['게임 화면 각도', {}], ['앞쪽에서', { yaw: 1.0, elev: 0.25 }], ['뒤쪽 아래', { yaw: 2.6, elev: -0.15 }]];
  const img = s => `<img class="scene" src="${s.url}">`;
  root.innerHTML = `<h1>${a.name_ko} 2D ↔ 3D</h1><div class="cards model"><figure><svg class="scene"></svg><figcaption>기존 2D</figcaption></figure>`
    + angles.map(([t, o]) => `<figure>${img(posedShot(a, 'rest', 0, { ppu: 700, ...o }))}<figcaption>${t}</figcaption></figure>`).join('') + `</div>`
    + `<h2>움직여 보기</h2><div class="motion-btns">${STATES.map(st => `<button data-st="${st}">${MOTION_KO[st]}</button>`).join('')}<button data-st="walking">헤엄·걷기</button></div><div class="pos live-demo"><svg class="scene"></svg></div>`
    + `<h2>동작</h2><div class="cards motions">${STATES.map(st => [0.05, 0.17, 0.3].map(t => `<figure>${img(posedShot(a, st, t, { ppu: 500 }))}<figcaption>${MOTION_KO[st]} ${t}s</figcaption></figure>`).join('')).join('')}</div>`;
  fitSvg(root.querySelector('svg'), `<g transform="scale(${a.length_m.avg})">${draw2d(a)}</g>`);
  const demo = root.querySelector('.live-demo');
  fitSvg(demo.querySelector('svg'), `<g>${drawAnimal(a)}</g>`, 0.25);
  liveArt(a, demo);
  const MARK = { charge: 'charging', bite: 'biting', hit: 'hit', tired: 'tired', walking: 'walking' };
  const play = st => (demo.className = `pos live-demo ${MARK[st] ?? ''}`);
  root.querySelectorAll('.motion-btns button').forEach(b => (b.onclick = () => play(b.dataset.st)));
  play(location.hash.match(/&st=(\w+)/)?.[1]); // #model=mosasaurus&st=bite: 처음부터 그 동작
}

// 체형 틀 확인 화면 (#templates): 틀마다 대표 동물 한 마리, 3D(크게) + 기존 2D(작게)
const ARCH_KO = { theropod: '수각류', bird: '새', sauropod: '용각류', ceratopsian: '뿔공룡', armored: '갑옷공룡', large_mammal: '큰 포유류', sprawler: '악어·도마뱀형', marine_reptile: '해양 파충류', fish: '물고기', pterosaur: '익룡', arthropod: '절지동물', snake: '뱀' };
export function showTemplates(root) {
  const reps = location.hash.includes('&all') ? animals : animals.filter(a => REPS.has(a.id)); // #templates&all: 전체
  const count = arch => animals.filter(a => a.archetype === arch).length;
  root.innerHTML = `<h1>${reps.length > 20 ? `3D 전체 ${reps.length}종` : `체형 틀 ${reps.length}개`}</h1><div class="cards templates${reps.length > 20 ? ' all' : ''}">${reps.map(a => `<figure data-id="${a.id}"><svg class="scene s3"></svg><svg class="scene s2"></svg>
    <figcaption><b>${ARCH_KO[a.archetype]}</b> · ${a.name_ko} <small>(이 틀 ${count(a.archetype)}종)</small></figcaption></figure>`).join('')}</div>`;
  const st = location.hash.match(/&st=(\w+)/)?.[1]; // #templates&st=bite: 틀마다 그 동작 자세로
  for (const a of reps) {
    const f = root.querySelector(`figure[data-id="${a.id}"]`);
    if (st) f.querySelector('.s3').outerHTML = `<img class="scene s3" src="${posedShot(a, st, 0.12, { ppu: 500 }).url}">`;
    else fitSvg(f.querySelector('.s3'), draw3d(a) ?? '', 0.04);
    fitSvg(f.querySelector('.s2'), draw2d(a), 0.04);
  }
}

// 울음소리 확인 화면 (#sounds): 무리마다 대표 동물 몇 마리의 울음과 공격 기합을 눌러 들어 본다
const SOUND_SETS = [
  ['🦖 육식공룡 (크아아앙)', ['tyrannosaurus', 'spinosaurus', 'allosaurus', 'velociraptor']],
  ['🦕 초식공룡 (콧김 + 음무우-)', ['triceratops', 'ankylosaurus', 'stegosaurus', 'therizinosaurus']],
  ['🦕 목 긴 공룡 (웅- 우웅-)', ['brachiosaurus', 'diplodocus', 'saltasaurus', 'iguanodon']],
  ['🐅 고양잇과 (으르아아오)', ['smilodon']],
  ['🐘 코끼리류 (뿌우우)', ['woolly_mammoth', 'deinotherium']],
  ['🐺 갯과 (아우우우-)', ['dire_wolf', 'repenomamus']],
  ['🐻 곰 (그르르워어-)', ['cave_bear', 'diprotodon']],
  ['🦏 큰 짐승 (훅 + 우어어-)', ['woolly_rhinoceros', 'megaloceros', 'megatherium', 'paraceratherium']],
  ['🐦 큰 새 (끼아악)', ['haasts_eagle', 'phorusrhacos', 'gastornis', 'archaeopteryx']],
  ['🦅 익룡 (끼이이익-)', ['quetzalcoatlus', 'rhamphorhynchus']],
  ['🐊 악어·도마뱀·뱀 (쉬이익 + 그르르)', ['deinosuchus', 'dimetrodon', 'titanoboa', 'megalania']],
  ['🌊 바다 파충류·고래 (우우웅-)', ['mosasaurus', 'basilosaurus', 'elasmosaurus', 'nothosaurus']],
  ['🦂 곤충·물고기 (짧은 효과음, 그대로)', ['trilobite', 'meganeura', 'megalodon']],
];
export function showSounds(root) {
  const byId = id => animals.find(a => a.id === id);
  root.innerHTML = `<header class="title"><h1>울음소리 들어 보기</h1><p>같은 무리도 몸무게에 따라 높낮이와 길이가 달라요</p></header>`
    + SOUND_SETS.map(([t, ids]) => `<section class="sounds"><h2>${t}</h2>${ids.map(byId).filter(Boolean).map(a => `<div><b>${a.name_ko}</b> <small>${a.mass_raw}</small>
      <button data-id="${a.id}">🔊 울음</button><button data-id="${a.id}" data-short="1">⚔️ 공격 기합</button></div>`).join('')}</section>`).join('');
  root.querySelectorAll('button[data-id]').forEach(b => (b.onclick = () => sfx.voice(byId(b.dataset.id), !!b.dataset.short)));
}
