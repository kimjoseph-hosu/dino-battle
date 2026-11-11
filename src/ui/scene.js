// 미터 좌표로 그린 내용을 SVG에 넣고, 실제 그려진 범위에 맞춰 viewBox를 잡는다
export function fitSvg(svg, inner, pad = 0.06) {
  svg.innerHTML = `<g>${inner}</g>`;
  const b = svg.firstChild.getBBox(), p = Math.max(b.width, b.height) * pad;
  svg.setAttribute('viewBox', `${b.x - p} ${b.y - p} ${b.width + 2 * p} ${b.height + 2 * p}`);
}

export function ruler(x0, x1) {
  const step = [1, 5, 10, 20, 50, 100].find(n => (x1 - x0) / n <= 25) ?? 200, fs = (x1 - x0) / 70; // 라벨이 25개 넘으면 겹친다
  let s = `<line x1="${x0}" y1="0" x2="${x1}" y2="0" class="ground"/>`;
  for (let m = 0; x0 + m <= x1; m += step)
    s += `<line x1="${x0 + m}" y1="0" x2="${x0 + m}" y2="${fs}" class="tick"/><text x="${x0 + m}" y="${fs * 2.2}" font-size="${fs}" class="tick-label">${m}m</text>`;
  return s;
}
