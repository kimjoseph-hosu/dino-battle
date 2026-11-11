// 아이 그림 사진의 종이 배경을 브라우저 안에서 지운다 (PLAN 7.2). 사진은 밖으로 보내지 않는다.
// 방법: 테두리 픽셀로 종이 색을 추정 → 테두리에서부터 이어진 "종이 같은" 픽셀만 지움(그림 안쪽의 흰 눈·이빨은 남음)
// → 남은 그림만 잘라냄. 입력·출력은 ImageData 모양 { width, height, data }.

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// strength 0~1: 클수록 더 많이 지운다
export function removeBackground(img, strength = 0.5) {
  const { width: w, height: h, data: d } = img;
  // 종이 색 = 테두리 픽셀 채널별 중앙값
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const med = c => { const v = border.map(p => d[p * 4 + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const [pr, pg, pb] = [med(0), med(1), med(2)], paperL = lum(pr, pg, pb);
  const thr = 25 + strength * 90;
  // 종이 같은 픽셀: 종이 색과 가깝거나, 색이 거의 없고(그림자 진 종이) 충분히 밝음
  const paperish = p => {
    const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2];
    if (Math.hypot(r - pr, g - pg, b - pb) < thr) return true;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx - mn < 28 && lum(r, g, b) > paperL - thr * 1.2;
  };

  const bg = new Uint8Array(w * h), stack = border.filter(paperish);
  while (stack.length) {
    const p = stack.pop();
    if (bg[p]) continue;
    bg[p] = 1;
    const x = p % w, y = (p / w) | 0;
    for (const q of [x > 0 && p - 1, x < w - 1 && p + 1, y > 0 && p - w, y < h - 1 && p + w]) if (q !== false && !bg[q] && paperish(q)) stack.push(q);
  }

  // 남은 그림의 범위로 자르기
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0; p < w * h; p++) if (!bg[p]) { const x = p % w, y = (p / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null; // 다 지워짐
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const p = (y + y0) * w + x + x0, o = (y * cw + x) * 4;
    out.set(d.subarray(p * 4, p * 4 + 3), o);
    // 지운 곳 옆 테두리는 반투명하게(가장자리 부드럽게)
    const edge = !bg[p] && ((x + x0 > 0 && bg[p - 1]) || (x + x0 < w - 1 && bg[p + 1]) || (y + y0 > 0 && bg[p - w]) || (y + y0 < h - 1 && bg[p + w]));
    out[o + 3] = bg[p] ? 0 : edge ? 150 : 255;
  }
  return { width: cw, height: ch, data: out };
}

// 충돌 계산용 모양 지도: 가로 cols칸, 칸마다 그림이 있으면 1
export function shapeMask(img, cols = 80) {
  const { width: w, height: h, data: d } = img, rows = Math.max(1, Math.round((cols * h) / w)), mask = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = Math.min(w - 1, Math.floor(((c + 0.5) * w) / cols)), y = Math.min(h - 1, Math.floor(((r + 0.5) * h) / rows));
    mask[r * cols + c] = d[(y * w + x) * 4 + 3] > 100 ? 1 : 0;
  }
  return { mask, cols, rows };
}

// 몸길이 1 좌표(u: 0 꼬리쪽 → 1 머리쪽, v: 땅에서 위로)에 그림이 있나. aspect = 높이/너비
export function maskAt({ mask, cols, rows, aspect }, u, v) {
  const c = Math.floor(u * cols), r = Math.floor((1 - v / aspect) * rows);
  return c >= 0 && c < cols && r >= 0 && r < rows && mask[r * cols + c] === 1;
}

// 좌우 뒤집기(머리가 오른쪽을 보게 맞출 때)
export function flipX(img) {
  const { width: w, height: h, data: d } = img, out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set(d.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (y * w + (w - 1 - x)) * 4);
  return { width: w, height: h, data: out };
}
