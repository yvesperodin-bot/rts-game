import { MAP_W, MAP_H, T, STARTS, ORE_SPOTS, ORE_PER_TILE } from './constants.js';

function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GameMap {
  constructor(seed = 7) {
    this.w = MAP_W;
    this.h = MAP_H;
    const n = this.w * this.h;
    this.terrain = new Uint8Array(n);
    this.ore = new Uint16Array(n);
    this.bld = new Int32Array(n); // building id occupying tile (0 = none)
    this.shade = new Uint8Array(n);
    this.dirty = []; // tile indices whose terrain art must be redrawn
    let s = seed;
    do { this.generate(s++); } while (!this.connected());
  }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  blocked(x, y) { return !this.inBounds(x, y) || this.terrain[y * this.w + x] === T.ROCK || this.bld[y * this.w + x] !== 0; }
  buildable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    const t = this.terrain[i];
    return (t === T.GRASS || t === T.DIRT) && this.bld[i] === 0;
  }

  generate(seed) {
    const r = rng(seed);
    this.terrain.fill(T.GRASS);
    this.ore.fill(0);
    this.bld.fill(0);
    for (let i = 0; i < this.shade.length; i++) this.shade[i] = (r() * 4) | 0;

    const blob = (cx, cy, rad, fn) => {
      for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) {
        for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
          if (!this.inBounds(x, y)) continue;
          if (Math.hypot(x - cx, y - cy) < rad * (0.7 + r() * 0.5)) fn(this.idx(x, y));
        }
      }
    };
    const farFromStarts = (x, y, d) => STARTS.every(s => Math.hypot(x - s.x - 1, y - s.y - 1) > d);

    for (let k = 0; k < 28; k++) blob(r() * this.w, r() * this.h, 2 + r() * 4, i => { this.terrain[i] = T.DIRT; });
    for (let k = 0; k < 24; k++) {
      let cx = r() * this.w, cy = r() * this.h;
      if (!farFromStarts(cx, cy, 13)) continue;
      const steps = 2 + ((r() * 3) | 0);
      for (let s = 0; s < steps; s++) {
        blob(cx, cy, 1.4 + r() * 2.2, i => { this.terrain[i] = T.ROCK; });
        cx += (r() - 0.5) * 5; cy += (r() - 0.5) * 5;
      }
    }
    // Clear the start areas.
    for (const s of STARTS) {
      for (let y = s.y - 3; y <= s.y + 8; y++) {
        for (let x = s.x - 3; x <= s.x + 9; x++) {
          if (this.inBounds(x, y)) this.terrain[this.idx(x, y)] = (x + y) % 5 === 0 ? T.DIRT : T.GRASS;
        }
      }
    }
    for (const o of ORE_SPOTS) {
      blob(o.x, o.y, o.r, i => { this.terrain[i] = T.ORE; this.ore[i] = ORE_PER_TILE; });
    }
  }

  connected() {
    const seen = new Uint8Array(this.w * this.h);
    const s = STARTS[0];
    const q = [this.idx(s.x + 1, s.y + 4)];
    seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const x = q[h] % this.w, y = (q[h] / this.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const i = this.idx(nx, ny);
        if (seen[i] || this.terrain[i] === T.ROCK) continue;
        seen[i] = 1; q.push(i);
      }
    }
    const e = STARTS[1];
    if (!seen[this.idx(e.x + 1, e.y + 4)]) return false;
    return ORE_SPOTS.every(o => seen[this.idx(o.x, o.y)]);
  }

  // Remove up to `amount` ore from tile i; returns amount actually taken.
  mine(i, amount) {
    const take = Math.min(amount, this.ore[i]);
    const before = this.ore[i];
    this.ore[i] -= take;
    if (this.ore[i] <= 0) {
      this.ore[i] = 0;
      this.terrain[i] = T.DIRT;
      this.dirty.push(i);
    } else if (((before / 100) | 0) !== ((this.ore[i] / 100) | 0)) {
      this.dirty.push(i);
    }
    return take;
  }
}
