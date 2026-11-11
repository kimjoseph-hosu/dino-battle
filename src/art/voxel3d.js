// 고해상도 블록(복셀) 동물(PLAN_VOXEL, ?art=voxel). 매끈한 모델(shape3d.js)을 작은 정육면체로 깎는다.
// - 몸길이 1을 N칸으로 나눈 격자. 세로(y) 기둥마다 모델 겉면을 지나는 높이를 모아, 안쪽 구간을 블록으로 채운다
// - 블록마다 색(겉면 꼭짓점 색)과 주인 뼈(머리·턱·꼬리 마디·다리…)를 기억해서, 블록 덩어리를 그 뼈에 붙인다
//   → rig 모양이 shape3d 와 똑같아서 motion3d.js(동작)·arena3d.js(무대)를 그대로 쓴다
// - 겉에 드러난 면만 만들고, 뼈마다 한 덩어리로 합친다
import * as THREE from 'three';
import { build as buildSmooth } from './shape3d.js';
import { VOXEL } from '../config.js';

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
// 정육면체 면 6개: 법선, 네 꼭짓점(0/1 격자 모서리)
const FACES = [
  [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
  [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
  [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
  [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]],
  [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
];

// 메시가 속한 움직이는 뼈(가장 가까운 Bone 조상). 한 덩어리 살(SkinnedMesh)은 꼭짓점마다 가장 무거운 뼈
const ownerOf = (o, root) => { for (let p = o.parent; p && p !== root; p = p.parent) if (p.isBone) return p; return root; };

export function build(a, N = VOXEL.N) {
  const rig = buildSmooth(a);
  if (!rig) return null;
  const root = rig.root;
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const meshes = [];
  root.traverse(o => o.isMesh && o.visible && meshes.push(o));
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  box.applyMatrix4(toRoot);
  const c = 1 / N, x0 = box.min.x - c, y0 = Math.max(0, box.min.y) - c, z0 = box.min.z - c; // 땅(y=0) 아래는 버린다
  const NX = Math.ceil((box.max.x - x0) / c) + 2, NY = Math.ceil((box.max.y - y0) / c) + 2, NZ = Math.ceil((box.max.z - z0) / c) + 2;
  const at = (i, j, k) => (j * NZ + k) * NX + i;
  const fill = new Uint16Array(NX * NY * NZ), col = new Float32Array(NX * NY * NZ * 3); // fill: 주인 번호 + 1 (0 = 빈칸)
  const owners = [];
  const ownerId = b => { let i = owners.indexOf(b); if (i < 0) i = owners.push(b) - 1; return i + 1; };
  const set = (i, j, k, id, r, g, b) => { if (j < 0 || j >= NY) return; const n = at(i, j, k); fill[n] = id; col[n * 3] = r; col[n * 3 + 1] = g; col[n * 3 + 2] = b; };

  // 세 방향(위에서·옆에서·앞에서)으로 겉면을 훑는다. 위에서 본 기둥으로 안쪽을 채우고, 겉면이 지나는 칸은 그 자리 색으로 칠한다
  // (위에서만 보면 옆구리 칸이 등·배 색 중 가까운 쪽을 받아 줄무늬가 생긴다)
  const AX = [['x', 'z', 'y'], ['y', 'z', 'x'], ['x', 'y', 'z']], O = { x: x0, y: y0, z: z0 }, D = { x: NX, y: NY, z: NZ };
  const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], C = [new THREE.Color(), new THREE.Color(), new THREE.Color()], M = new THREE.Matrix4();
  for (const m of meshes) {
    const g = m.geometry, pos = g.attributes.position, vc = m.material.vertexColors && g.attributes.color, idx = g.index;
    const base = m.material.color ?? new THREE.Color('#888'), skinned = m.isSkinnedMesh;
    M.multiplyMatrices(toRoot, m.matrixWorld);
    const meshOwner = skinned ? null : ownerId(ownerOf(m, root));
    const boneId = v => { // 한 덩어리 살: 그 꼭짓점을 가장 많이 맡은 뼈
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      return ownerId(m.skeleton.bones[sw.getX(v) >= sw.getY(v) ? si.getX(v) : si.getY(v)]);
    };
    const tris = idx ? idx.count / 3 : pos.count / 3, T = [];
    for (let t = 0; t < tris; t++) {
      const v = [0, 1, 2].map(q => (idx ? idx.getX(t * 3 + q) : t * 3 + q));
      const tri = v.map((vi, q) => {
        P[q].fromBufferAttribute(pos, vi).applyMatrix4(M);
        if (vc) C[q].fromBufferAttribute(vc, vi); else C[q].copy(base);
        return { x: P[q].x, y: P[q].y, z: P[q].z, r: C[q].r, g: C[q].g, b: C[q].b };
      });
      tri.own = meshOwner ?? boneId(v[0]);
      T.push(tri);
    }
    for (const [U, W, H] of AX) {
      const cols = new Map(); // 기둥(u,w) → [높이, r, g, b, 주인]…
      for (const tri of T) {
        const [A, B, E] = tri;
        const det = (B[U] - A[U]) * (E[W] - A[W]) - (E[U] - A[U]) * (B[W] - A[W]);
        if (Math.abs(det) < 1e-12) continue; // 이 방향에서 보면 선
        const i0 = Math.ceil((Math.min(A[U], B[U], E[U]) - O[U]) / c - 0.5), i1 = Math.floor((Math.max(A[U], B[U], E[U]) - O[U]) / c - 0.5);
        const k0 = Math.ceil((Math.min(A[W], B[W], E[W]) - O[W]) / c - 0.5), k1 = Math.floor((Math.max(A[W], B[W], E[W]) - O[W]) / c - 0.5);
        for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
          const pu = O[U] + (i + 0.5) * c, pw = O[W] + (k + 0.5) * c;
          const u = ((pu - A[U]) * (E[W] - A[W]) - (E[U] - A[U]) * (pw - A[W])) / det, w = ((B[U] - A[U]) * (pw - A[W]) - (pu - A[U]) * (B[W] - A[W])) / det;
          if (u < 0 || w < 0 || u + w > 1) continue;
          const s = 1 - u - w, key = i * 4096 + k;
          (cols.get(key) ?? cols.set(key, []).get(key)).push([s * A[H] + u * B[H] + w * E[H], s * A.r + u * B.r + w * E.r, s * A.g + u * B.g + w * E.g, s * A.b + u * B.b + w * E.b, tri.own]);
        }
      }
      for (const [key, hits] of cols) {
        const iu = Math.floor(key / 4096), iw = key % 4096, J = h => Math.floor((h[0] - O[H]) / c);
        const put = (j, h) => { const q = { [U]: iu, [W]: iw, [H]: j }; if (q.x >= 0 && q.x < NX && q.z >= 0 && q.z < NZ) set(q.x, q.y, q.z, h[4], h[1], h[2], h[3]); };
        hits.sort((p, q) => p[0] - q[0]);
        if (H === 'y' && hits.length % 2 === 0) for (let h = 0; h < hits.length; h += 2) { // 짝이 안 맞으면(열린 끝) 겉면 칸만
          const lo = hits[h], hi = hits[h + 1], j0 = J(lo), j1 = J(hi);
          for (let j = j0; j <= j1; j++) put(j, j - j0 < j1 - j ? lo : hi);
        }
        for (const h of hits) put(J(h), h); // 겉면이 지나는 칸은 늘 그 자리 색(얇은 이빨·발톱도 남는다)
      }
    }
  }

  // 뼈마다 드러난 면만 모아 한 덩어리. 꼭짓점은 몸 좌표 → 그 뼈의 쉬는 자리 좌표로
  const geo = owners.map(() => ({ p: [], n: [], c: [] }));
  for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const n = at(i, j, k), id = fill[n];
    if (!id) continue;
    const G = geo[id - 1];
    for (const [nv, quad] of FACES) {
      const ii = i + nv[0], jj = j + nv[1], kk = k + nv[2];
      if (ii >= 0 && ii < NX && jj >= 0 && jj < NY && kk >= 0 && kk < NZ && fill[at(ii, jj, kk)]) continue;
      for (const q of [0, 1, 2, 0, 2, 3]) {
        const [dx, dy, dz] = quad[q];
        G.p.push(x0 + (i + dx) * c, y0 + (j + dy) * c, z0 + (k + dz) * c);
        G.n.push(...nv);
        G.c.push(col[n * 3], col[n * 3 + 1], col[n * 3 + 2]);
      }
    }
  }
  for (const m of meshes) m.parent.remove(m);
  owners.forEach((b, o) => {
    const G = geo[o];
    if (!G.p.length) return;
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute(G.n, 3));
    bg.setAttribute('color', new THREE.Float32BufferAttribute(G.c, 3));
    const mesh = new THREE.Mesh(bg, MAT);
    // 몸 좌표 → 뼈 좌표: (뼈의 몸 좌표 행렬)의 역
    mesh.matrixAutoUpdate = false;
    mesh.matrix.multiplyMatrices(toRoot, b.matrixWorld).invert();
    mesh.castShadow = mesh.receiveShadow = true;
    b.add(mesh);
  });
  rig.voxels = { N, faces: geo.reduce((s, G) => s + G.p.length / 18, 0) };
  return rig;
}
