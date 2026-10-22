import { PLAYER } from './constants.js';

// Fog of war for the player: 0 = unexplored (black), explored-but-unseen (dimmed), visible.
export class Fog {
  constructor(map) {
    this.w = map.w;
    this.h = map.h;
    this.explored = new Uint8Array(map.w * map.h);
    this.visible = new Uint8Array(map.w * map.h);
  }

  update(game) {
    this.visible.fill(0);
    for (const e of game.entities) {
      if (e.dead || e.owner !== PLAYER) continue;
      const r = e.def.sight + (e.kind === 'building' ? Math.max(e.w, e.h) / 2 : 0);
      const r2 = r * r;
      const x0 = Math.max(0, Math.floor(e.x - r)), x1 = Math.min(this.w - 1, Math.ceil(e.x + r));
      const y0 = Math.max(0, Math.floor(e.y - r)), y1 = Math.min(this.h - 1, Math.ceil(e.y + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - e.x, dy = y + 0.5 - e.y;
          if (dx * dx + dy * dy <= r2) { const i = y * this.w + x; this.visible[i] = 1; this.explored[i] = 1; }
        }
      }
    }
  }

  isVisible(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.visible[(y | 0) * this.w + (x | 0)] === 1; }
  isExplored(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.explored[(y | 0) * this.w + (x | 0)] === 1; }
}
