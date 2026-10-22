// A* over the tile grid (8-directional, no corner cutting).
const SQRT2 = Math.SQRT2;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Nearest unblocked tile to (x, y), searching in growing rings.
export function nearestFree(map, x, y, maxR = 12) {
  x = Math.max(0, Math.min(map.w - 1, x | 0)); y = Math.max(0, Math.min(map.h - 1, y | 0));
  if (!map.blocked(x, y)) return { x, y };
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx, ny = y + dy;
        if (map.blocked(nx, ny)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = { x: nx, y: ny }; }
      }
    }
    if (best) return best;
  }
  return null;
}

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n, fv) {
    const a = this.a;
    a.push([n, fv]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][1] <= a[i][1]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0][0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let s = i;
        if (l < a.length && a[l][1] < a[s][1]) s = l;
        if (r < a.length && a[r][1] < a[s][1]) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]]; i = s;
      }
    }
    return top;
  }
}

// Returns an array of {x, y} tiles from (excluding) start to the goal, or null if no route at all.
// If the goal is blocked or unreachable, heads for the reachable tile closest to it.
export function findPath(map, sx, sy, gx, gy) {
  sx |= 0; sy |= 0;
  const goal = nearestFree(map, gx, gy);
  if (!goal) return null;
  gx = goal.x; gy = goal.y;
  if (sx === gx && sy === gy) return [];
  const W = map.w, N = W * map.h;
  const g = new Float32Array(N).fill(Infinity), f = new Float32Array(N);
  const parent = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const hfn = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return dx + dy + (SQRT2 - 2) * Math.min(dx, dy); };
  const start = sy * W + sx, goalI = gy * W + gx;
  g[start] = 0; f[start] = hfn(sx, sy);
  const open = new Heap();
  open.push(start, f[start]);
  let best = start, bestH = f[start], iter = 0;
  while (open.size && iter++ < 6000) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goalI) { best = cur; break; }
    const cx = cur % W, cy = (cur / W) | 0;
    const h = hfn(cx, cy);
    if (h < bestH) { bestH = h; best = cur; }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (map.blocked(nx, ny)) continue;
      if (dx && dy && (map.blocked(cx + dx, cy) || map.blocked(cx, cy + dy))) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + (dx && dy ? SQRT2 : 1);
      if (ng < g[ni]) { g[ni] = ng; parent[ni] = cur; f[ni] = ng + hfn(nx, ny); open.push(ni, f[ni]); }
    }
  }
  const path = [];
  for (let c = best; c !== start && c !== -1; c = parent[c]) path.push({ x: c % W, y: (c / W) | 0 });
  return path.reverse();
}
