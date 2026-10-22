import { canPlace } from './production.js';
import { DEFS, PLAYER, TILE, MAP_W, MAP_H, T, FACTIONS, ORE_PER_TILE } from './constants.js';

const GRASS = ['#3b6a32', '#3f7036', '#386330', '#43753a'];
const DIRT = ['#8b6b44', '#94734b', '#836440', '#7d5f3b'];
export const MINI_COLORS = { [T.GRASS]: [59, 106, 50], [T.DIRT]: [139, 107, 68], [T.ROCK]: [85, 90, 98], [T.ORE]: [214, 170, 40] };

export class Renderer {
  constructor(game, canvas, minimap) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mini = minimap;
    this.mctx = minimap.getContext('2d');
    this.miniBuf = document.createElement('canvas');
    this.miniBuf.width = MAP_W; this.miniBuf.height = MAP_H;
    this.miniTick = 0;
    this.terrain = document.createElement('canvas');
    this.terrain.width = MAP_W * TILE; this.terrain.height = MAP_H * TILE;
    const c = this.terrain.getContext('2d');
    for (let i = 0; i < MAP_W * MAP_H; i++) this.drawTile(c, i);
  }

  drawTile(c, i) {
    const m = this.game.map;
    const x = (i % MAP_W) * TILE, y = ((i / MAP_W) | 0) * TILE;
    const t = m.terrain[i], sh = m.shade[i];
    if (t === T.ROCK) {
      c.fillStyle = '#3d4046'; c.fillRect(x, y, TILE, TILE);
      c.fillStyle = '#6a6f78';
      c.beginPath(); c.moveTo(x + 3, y + 26); c.lineTo(x + 9, y + 5); c.lineTo(x + 22, y + 3); c.lineTo(x + 29, y + 20); c.lineTo(x + 20, y + 29); c.closePath(); c.fill();
      c.fillStyle = '#868b94';
      c.beginPath(); c.moveTo(x + 9, y + 5); c.lineTo(x + 22, y + 3); c.lineTo(x + 17, y + 14); c.closePath(); c.fill();
      return;
    }
    c.fillStyle = t === T.GRASS ? GRASS[sh] : DIRT[sh];
    c.fillRect(x, y, TILE, TILE);
    if (t === T.GRASS && sh === 1) { c.fillStyle = '#4b8140'; c.fillRect(x + 8 + sh * 3, y + 12, 2, 5); c.fillRect(x + 20, y + 22, 2, 4); }
    if (t === T.ORE && m.ore[i] > 0) {
      const n = Math.max(1, Math.ceil((m.ore[i] / ORE_PER_TILE) * 7));
      for (let k = 0; k < n; k++) {
        const px = x + 3 + ((i * 37 + k * 53) % 24), py = y + 3 + ((i * 59 + k * 31) % 24);
        c.fillStyle = k % 2 ? '#f2c230' : '#d9a416';
        c.beginPath(); c.moveTo(px, py - 4); c.lineTo(px + 4, py); c.lineTo(px, py + 4); c.lineTo(px - 4, py); c.closePath(); c.fill();
      }
    }
  }

  draw(input) {
    const { ctx, canvas, game } = this;
    const cam = input.camera;
    const m = game.map;
    if (m.dirty.length) {
      const c = this.terrain.getContext('2d');
      for (const i of m.dirty) this.drawTile(c, i);
      m.dirty.length = 0;
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    this.drawWorld(ctx, input);
    ctx.restore();
    this.drawOverlay(ctx, input);
    this.miniTick++;
    if (this.miniTick % 4 === 0) this.drawMinimap(input);
  }

  visibleRect(input) {
    const cam = input.camera;
    return { x0: Math.floor(cam.x / TILE), y0: Math.floor(cam.y / TILE), x1: Math.ceil((cam.x + this.canvas.width) / TILE), y1: Math.ceil((cam.y + this.canvas.height) / TILE) };
  }

  drawWorld(ctx, input) {
    const game = this.game;
    ctx.drawImage(this.terrain, 0, 0);
    for (const b of game.buildings) if (this.seen(b)) this.drawBuilding(ctx, b, input);
    const units = game.units.filter(u => this.seen(u)).sort((a, b) => a.y - b.y);
    for (const u of units) this.drawUnit(ctx, u, input);
    if (input.placing) {
      const d = DEFS[input.placing], { tx, ty } = input.placeTile();
      for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
        const ok = game.map.buildable(tx + x, ty + y) && canPlace(game, PLAYER, input.placing, tx, ty);
        ctx.fillStyle = ok ? 'rgba(80,255,120,0.4)' : 'rgba(255,60,60,0.45)';
        ctx.fillRect((tx + x) * TILE, (ty + y) * TILE, TILE, TILE);
        ctx.strokeStyle = '#fff6'; ctx.strokeRect((tx + x) * TILE + 0.5, (ty + y) * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
    for (const p of input.pings) {
      ctx.strokeStyle = `rgba(125,255,125,${1 - p.t * 2})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x * TILE, p.y * TILE, 14 - p.t * 20, 0, 7); ctx.stroke();
    }
  }

  // Hook for fog of war (extended later).
  seen() { return true; }

  drawOverlay(ctx, input) {
    const d = input.drag;
    if (d) {
      ctx.strokeStyle = '#7dff7d'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(125,255,125,0.12)';
      ctx.fillRect(d.x0, d.y0, input.mouse.x - d.x0, input.mouse.y - d.y0);
      ctx.strokeRect(d.x0 + 0.5, d.y0 + 0.5, input.mouse.x - d.x0, input.mouse.y - d.y0);
    }
  }

  drawBuilding(ctx, b, input) {
    const f = FACTIONS[b.owner];
    const x = b.tx * TILE, y = b.ty * TILE, w = b.w * TILE, h = b.h * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 4, y + 4, w, h);
    ctx.fillStyle = f.dark; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = f.color;
    switch (b.type) {
      case 'conyard':
        ctx.fillRect(cx - 18, cy - 18, 36, 36);
        ctx.fillStyle = f.dark; ctx.fillRect(cx - 12, cy - 12, 24, 24);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(cx - 4, cy - 14, 8, 28); ctx.fillRect(cx - 14, cy - 4, 28, 8);
        break;
      case 'power':
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath(); ctx.moveTo(cx + 4, cy - 20); ctx.lineTo(cx - 10, cy + 2); ctx.lineTo(cx, cy + 2); ctx.lineTo(cx - 4, cy + 20); ctx.lineTo(cx + 10, cy - 4); ctx.lineTo(cx, cy - 4); ctx.closePath(); ctx.fill();
        break;
      case 'refinery':
        ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.arc(x + 28, cy, 18, 0, 7); ctx.fill();
        ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(x + w - 28, cy, 14, 0, 7); ctx.fill();
        ctx.fillStyle = f.color; ctx.fillRect(cx - 6, y + h - 14, 12, 8);
        break;
      case 'barracks':
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 10 + i * 17, y + 14, 12, 36);
        break;
      case 'factory':
        ctx.fillStyle = '#555c66'; ctx.fillRect(x + 12, y + h - 40, w - 24, 30);
        ctx.fillStyle = f.color;
        for (let i = 0; i < 4; i++) ctx.fillRect(x + 12, y + h - 38 + i * 7, w - 24, 3);
        ctx.fillRect(x + 12, y + 12, w - 24, 14);
        break;
      case 'turret':
        ctx.fillStyle = '#2c3036'; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.aim);
        ctx.fillStyle = f.color; ctx.fillRect(0, -3, 20, 6); ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
        ctx.restore();
        break;
    }
    if (b.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${b.hit * 0.5})`; ctx.fillRect(x, y, w, h); }
    this.drawBar(ctx, x + 2, y - 7, w - 4, b.hp / b.maxHp, input.isSelected(b) || b.hp < b.maxHp);
    if (input.isSelected(b)) this.drawBrackets(ctx, x - 2, y - 2, w + 4, h + 4);
  }

  drawBrackets(ctx, x, y, w, h) {
    ctx.strokeStyle = '#7dff7d'; ctx.lineWidth = 2; const L = 8;
    ctx.beginPath();
    for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      ctx.moveTo(px + sx * L, py); ctx.lineTo(px, py); ctx.lineTo(px, py + sy * L);
    }
    ctx.stroke();
  }

  drawBar(ctx, x, y, w, frac, show) {
    if (!show) return;
    ctx.fillStyle = '#000a'; ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = frac > 0.6 ? '#4cd964' : frac > 0.3 ? '#f5c542' : '#ff4a3d';
    ctx.fillRect(x, y, Math.max(0, w * frac), 4);
  }

  drawUnit(ctx, u, input) {
    const f = FACTIONS[u.owner];
    const px = u.x * TILE, py = u.y * TILE, r = u.def.r * TILE;
    const sel = input.isSelected(u);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px + 2, py + 3, r, r * 0.8, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(px, py);
    if (u.def.armor === 'infantry') {
      ctx.fillStyle = f.color; ctx.strokeStyle = f.dark; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.rotate(u.aim);
      if (u.type === 'rifle') { ctx.fillStyle = '#222'; ctx.fillRect(2, -1.5, 11, 3); }
      else if (u.type === 'rocket') { ctx.fillStyle = '#d0d0d0'; ctx.fillRect(-4, -2, 16, 4); ctx.fillStyle = '#ff9a3c'; ctx.fillRect(10, -2.5, 4, 5); }
      else { ctx.rotate(-u.aim); ctx.fillStyle = '#fff'; ctx.fillRect(-1.5, -6, 3, 12); ctx.fillRect(-6, -1.5, 12, 3); }
    } else {
      ctx.rotate(u.facing);
      const len = r * 2.2, wid = r * 1.7;
      ctx.fillStyle = '#23272d'; ctx.fillRect(-len / 2 - 1, -wid / 2 - 3, len + 2, 4); ctx.fillRect(-len / 2 - 1, wid / 2 - 1, len + 2, 4);
      ctx.fillStyle = f.dark; ctx.strokeStyle = f.color; ctx.lineWidth = 2;
      ctx.fillRect(-len / 2, -wid / 2, len, wid); ctx.strokeRect(-len / 2, -wid / 2, len, wid);
      if (u.type === 'harvester') {
        const fill = u.carry / u.def.capacity;
        ctx.fillStyle = '#3a3f46'; ctx.fillRect(-len / 2 + 3, -wid / 2 + 3, len * 0.55, wid - 6);
        ctx.fillStyle = '#f2c230'; ctx.fillRect(-len / 2 + 3, -wid / 2 + 3, len * 0.55 * fill, wid - 6);
        ctx.fillStyle = f.color; ctx.fillRect(len / 2 - 8, -wid / 2 + 3, 5, wid - 6);
      } else {
        ctx.rotate(u.aim - u.facing);
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); ctx.fill();
        ctx.fillStyle = '#ddd'; ctx.fillRect(0, u.type === 'heavy' ? -3.5 : -1.5, r * 1.6, u.type === 'heavy' ? 7 : 3);
        if (u.type === 'heavy') { ctx.fillStyle = '#222'; ctx.fillRect(r * 1.3, -4, 4, 8); }
      }
    }
    ctx.restore();
    if (u.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${u.hit * 0.6})`; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); }
    if (sel) { ctx.strokeStyle = '#7dff7d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, py, r + 5, (r + 5) * 0.8, 0, 0, 7); ctx.stroke(); }
    this.drawBar(ctx, px - 12, py - r - 9, 24, u.hp / u.maxHp, sel || u.hp < u.maxHp);
  }

  drawMinimap(input) {
    const { game, mctx, mini } = this;
    const buf = this.miniBuf.getContext('2d');
    const img = buf.createImageData(MAP_W, MAP_H);
    const m = game.map;
    for (let i = 0; i < MAP_W * MAP_H; i++) {
      const c = MINI_COLORS[m.terrain[i]];
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    buf.putImageData(img, 0, 0);
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(this.miniBuf, 0, 0, mini.width, mini.height);
    const s = mini.width / MAP_W;
    for (const b of game.buildings) if (this.seen(b)) { mctx.fillStyle = FACTIONS[b.owner].color; mctx.fillRect(b.tx * s, b.ty * s, b.w * s, b.h * s); }
    for (const u of game.units) if (this.seen(u)) { mctx.fillStyle = FACTIONS[u.owner].color; mctx.fillRect(u.x * s - 1, u.y * s - 1, 3, 3); }
    this.drawMinimapFog?.(mctx, s);
    const cam = input.camera;
    mctx.strokeStyle = '#fff'; mctx.lineWidth = 1;
    mctx.strokeRect(cam.x / TILE * s + 0.5, cam.y / TILE * s + 0.5, this.canvas.width / TILE * s, this.canvas.height / TILE * s);
  }
}
