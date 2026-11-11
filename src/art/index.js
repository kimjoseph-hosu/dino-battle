// 그림 렌더러 바꿔 끼우기: 화면(ui)은 그림을 여기서만 가져온다. 기본은 2D(SVG, draw.js).
// 기본은 블록 3D(block3d.js), ?art=3d 면 매끈한 3D(draw3d.js), ?art=2d 면 2D(블록·매끈 모두 draw3d.js 로 찍는다). 3D 모델이 아직 없는 동물이나 WebGL이 안 되는 컴퓨터는 자동으로 2D.
import * as d2 from './draw.js';
import * as d3 from './draw3d.js';
import { maskAt } from './photo.js';

const want = new URLSearchParams(location.search).get('art') ?? 'block'; // 기본은 블록 3D. ?art=2d 로 2D
export const ART = want === '3d' || want === 'block' ? want : '2d';
export const drawHuman = d2.drawHuman;
export const drawAnimal = a => (ART !== '2d' && !a.drawing && d3.drawAnimal(a)) || d2.drawAnimal(a);
// 배틀: 3D 동물은 사진을 살아 움직이는 3D로 바꾼다(2D는 CSS 애니메이션이 이미 움직인다)
export const liveArt = (a, el) => ART !== '2d' && !a.drawing && d3.live(a, el);

// 배틀 충돌 계산용: 몸길이 1 좌표(u 꼬리→코, v 땅에서 위)에 몸이 있나. el = drawAnimal 결과가 들어 있는 요소
export function shapeTest(a, el) {
  if (a.drawing) return (u, v) => maskAt(a.drawing, u, v);
  const t = ART !== '2d' && d3.shapeTest(a);
  if (t) return t;
  const paths = [...el.querySelectorAll('.animal path:not(.vol):not(.seam)')]; // 빛·질감 겹은 모양이 같아서 빼고 잰다
  return (u, v) => paths.some(p => p.isPointInFill(new DOMPoint(u, -v)));
}
