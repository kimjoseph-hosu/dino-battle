// 토너먼트 대진: rounds[0] = 섞은 출전 동물(4·8·16), rounds[r+1][i] = rounds[r]의 i번째 경기(2i, 2i+1) 승자. 아직이면 null
export function shuffle(xs, rnd = Math.random) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeBracket(xs, rnd) {
  const rounds = [shuffle(xs, rnd)];
  for (let n = xs.length / 2; n >= 1; n /= 2) rounds.push(Array(n).fill(null));
  return rounds;
}

// 다음에 할 경기(앞 라운드부터 위에서 아래로). 다 끝났으면 null
export function nextMatch(rounds) {
  for (let r = 0; r < rounds.length - 1; r++) {
    const i = rounds[r + 1].indexOf(null);
    if (i >= 0) return { r, i, a: rounds[r][2 * i], b: rounds[r][2 * i + 1] };
  }
  return null;
}

export const champion = rounds => rounds.at(-1)[0];

// x가 이긴 상대들(1라운드부터)
export const beaten = (rounds, x) => rounds.slice(0, -1).flatMap((row, r) => {
  const i = rounds[r + 1].indexOf(x);
  return i < 0 ? [] : [row[2 * i] === x ? row[2 * i + 1] : row[2 * i]];
});

// 라운드 이름: 마지막 = 결승, 그 앞 = 준결승, 나머지 = N강
export const roundName = (rounds, r) => ['결승', '준결승'][rounds.length - 2 - r] ?? `${rounds[r].length}강`;
