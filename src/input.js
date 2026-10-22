import { TILE, MAP_W, MAP_H, STARTS, PLAYER, T } from './constants.js';
import { canPlace, placeBuilding } from './production.js';
import { DEFS } from './constants.js';
import { orderMove, orderStop, orderHarvest, orderReturn } from './units.js';

const SCROLL_SPEED = 900; // px/sec
const EDGE = 12;

export class Input {
  constructor(game, canvas, minimap) {
    this.game = game;
    this.canvas = canvas;
    this.minimap = minimap;
    this.camera = { x: 0, y: 0 };
    this.selection = [];
    this.groups = {};
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, inside: false };
    this.drag = null; // {x0, y0} in screen px
    this.attackMoveArmed = false;
    this.placing = null; // building key being placed
    this.pings = [];
    this.ac = new AbortController();
    this.centerOn(STARTS[0].x + 1.5, STARTS[0].y + 1.5);
    this.bind();
  }

  destroy() { this.ac.abort(); }

  isSelected(e) { return this.selection.includes(e); }
  own() { return this.selection.filter(e => !e.dead && e.owner === PLAYER); }
  ownUnits() { return this.own().filter(e => e.kind === 'unit'); }

  centerOn(tx, ty) {
    this.camera.x = tx * TILE - this.canvas.width / 2;
    this.camera.y = ty * TILE - this.canvas.height / 2;
    this.clampCamera();
  }

  clampCamera() {
    const maxX = MAP_W * TILE - this.canvas.width, maxY = MAP_H * TILE - this.canvas.height;
    this.camera.x = maxX < 0 ? maxX / 2 : Math.max(0, Math.min(maxX, this.camera.x));
    this.camera.y = maxY < 0 ? maxY / 2 : Math.max(0, Math.min(maxY, this.camera.y));
  }

  // screen px -> world tile coords
  toWorld(sx, sy) { return { x: (sx + this.camera.x) / TILE, y: (sy + this.camera.y) / TILE }; }

  bind() {
    const opt = { signal: this.ac.signal };
    window.addEventListener('keydown', e => {
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.onKey(e);
    }, opt);
    window.addEventListener('keyup', e => this.keys.delete(e.code), opt);
    window.addEventListener('blur', () => this.keys.clear(), opt);
    const c = this.canvas;
    c.addEventListener('mousemove', e => { this.setMouse(e, true); }, opt);
    c.addEventListener('mouseleave', () => { this.mouse.inside = false; }, opt);
    c.addEventListener('contextmenu', e => e.preventDefault(), opt);
    c.addEventListener('mousedown', e => this.onMouseDown(e), opt);
    window.addEventListener('mouseup', e => this.onMouseUp(e), opt);
    c.addEventListener('dblclick', e => this.onDblClick(e), opt);
    const mm = this.minimap;
    mm.addEventListener('contextmenu', e => e.preventDefault(), opt);
    const mmWorld = e => {
      const r = mm.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * MAP_W, y: (e.clientY - r.top) / r.height * MAP_H };
    };
    const mmMove = e => { if (e.buttons & 1) { const p = mmWorld(e); this.centerOn(p.x, p.y); } };
    mm.addEventListener('mousedown', e => {
      if (e.button === 2) { const p = mmWorld(e); this.command(p.x, p.y); } else mmMove(e);
    }, opt);
    mm.addEventListener('mousemove', mmMove, opt);
  }

  setMouse(e, inside) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; this.mouse.inside = inside;
  }

  placeTile() {
    const d = DEFS[this.placing], w = this.toWorld(this.mouse.x, this.mouse.y);
    return { tx: Math.round(w.x - d.w / 2), ty: Math.round(w.y - d.h / 2) };
  }

  tryPlace() {
    const { tx, ty } = this.placeTile();
    if (placeBuilding(this.game, PLAYER, this.placing, tx, ty)) this.placing = null;
    else this.game.notify('Cannot build there');
  }

  onKey(e) {
    const g = this.game;
    if (e.code === 'KeyP') { if (g.state === 'playing') g.paused = !g.paused; return; }
    if (g.paused) return;
    if (e.code === 'Escape') { this.placing = null; this.attackMoveArmed = false; this.selection = []; return; }
    if (e.code === 'KeyA' && this.ownUnits().length) { this.attackMoveArmed = true; return; }
    if (e.code === 'KeyS' && this.ownUnits().length) { orderStop(g, this.ownUnits()); return; }
    if (e.code === 'KeyH') { const c = g.buildings.find(b => b.owner === PLAYER && b.type === 'conyard'); if (c) this.centerOn(c.x, c.y); return; }
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m) {
      if (e.ctrlKey) this.groups[m[1]] = this.own().map(x => x.id);
      else if (this.groups[m[1]]) this.selection = this.groups[m[1]].map(id => g.get(id)).filter(Boolean);
    }
  }

  update(dt) {
    const k = this.keys;
    // A and S double as attack-move / stop when units are selected, so they only scroll with an empty selection.
    const free = !this.ownUnits().length;
    let dx = 0, dy = 0;
    if (k.has('ArrowLeft') || (k.has('KeyA') && free)) dx -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) dx += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) dy -= 1;
    if (k.has('ArrowDown') || (k.has('KeyS') && free)) dy += 1;
    const m = this.mouse;
    if (m.inside && !this.drag) {
      if (m.x < EDGE) dx -= 1;
      if (m.x > this.canvas.width - EDGE) dx += 1;
      if (m.y < EDGE) dy -= 1;
      if (m.y > this.canvas.height - EDGE) dy += 1;
    }
    this.camera.x += Math.sign(dx) * SCROLL_SPEED * dt;
    this.camera.y += Math.sign(dy) * SCROLL_SPEED * dt;
    this.clampCamera();
    this.selection = this.selection.filter(e => !e.dead);
    for (const p of this.pings) p.t += dt;
    this.pings = this.pings.filter(p => p.t < 0.5);
    this.canvas.style.cursor = this.attackMoveArmed ? 'crosshair' : this.placing ? 'cell' : 'default';
  }

  // ----- picking & selection -----
  pick(wx, wy) {
    const g = this.game;
    let best = null, bd = Infinity;
    for (const u of g.units) {
      if (u.dead || !g.canSee(u)) continue;
      const d = Math.hypot(u.x - wx, u.y - wy);
      if (d < u.def.r + 0.25 && d < bd) { bd = d; best = u; }
    }
    if (best) return best;
    for (const b of g.buildings) {
      if (b.dead || !g.canSee(b)) continue;
      if (wx >= b.tx && wx < b.tx + b.w && wy >= b.ty && wy < b.ty + b.h) return b;
    }
    return null;
  }

  onMouseDown(e) {
    if (this.game.paused || this.game.state !== 'playing') return;
    this.setMouse(e, true);
    if (e.button === 2) {
      if (this.placing || this.attackMoveArmed) { this.placing = null; this.attackMoveArmed = false; return; }
      const w = this.toWorld(this.mouse.x, this.mouse.y);
      this.command(w.x, w.y);
      return;
    }
    if (e.button !== 0) return;
    if (this.placing) { this.tryPlace(); return; }
    if (this.attackMoveArmed) {
      const w = this.toWorld(this.mouse.x, this.mouse.y);
      this.attackMoveArmed = false;
      this.command(w.x, w.y, true);
      return;
    }
    this.drag = { x0: this.mouse.x, y0: this.mouse.y };
  }

  onMouseUp(e) {
    if (e.button !== 0 || !this.drag) return;
    const d = this.drag;
    this.drag = null;
    const g = this.game;
    const x0 = Math.min(d.x0, this.mouse.x), x1 = Math.max(d.x0, this.mouse.x);
    const y0 = Math.min(d.y0, this.mouse.y), y1 = Math.max(d.y0, this.mouse.y);
    let picked;
    if (x1 - x0 < 5 && y1 - y0 < 5) {
      const w = this.toWorld(this.mouse.x, this.mouse.y);
      const hit = this.pick(w.x, w.y);
      picked = hit ? [hit] : [];
      if (hit && hit.owner !== PLAYER) { this.selection = [hit]; return; }
      if (e.shiftKey && hit) {
        const has = this.selection.includes(hit);
        this.selection = has ? this.selection.filter(s => s !== hit) : [...this.own(), hit];
        return;
      }
    } else {
      const a = this.toWorld(x0, y0), b = this.toWorld(x1, y1);
      picked = g.units.filter(u => !u.dead && u.owner === PLAYER && u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y);
    }
    this.selection = e.shiftKey ? [...new Set([...this.own(), ...picked])] : picked;
  }

  onDblClick() {
    const w = this.toWorld(this.mouse.x, this.mouse.y);
    const hit = this.pick(w.x, w.y);
    if (!hit || hit.kind !== 'unit' || hit.owner !== PLAYER) return;
    const a = this.toWorld(0, 0), b = this.toWorld(this.canvas.width, this.canvas.height);
    this.selection = this.game.units.filter(u => !u.dead && u.owner === PLAYER && u.type === hit.type && u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y);
  }

  // ----- commands -----
  command(wx, wy, attackMove = false) {
    const units = this.ownUnits();
    if (!units.length) return;
    wx = Math.max(0, Math.min(MAP_W - 0.01, wx)); wy = Math.max(0, Math.min(MAP_H - 0.01, wy));
    this.pings.push({ x: wx, y: wy, t: 0 });
    const g = this.game;
    if (!attackMove) {
      const hit = this.pick(wx, wy);
      const harvesters = units.filter(u => u.type === 'harvester');
      if (hit && hit.owner === PLAYER && hit.type === 'refinery' && harvesters.length) {
        harvesters.forEach(u => orderReturn(g, u));
        orderMove(g, units.filter(u => u.type !== 'harvester'), wx, wy);
        return;
      }
      const tx = Math.floor(wx), ty = Math.floor(wy);
      if (harvesters.length && g.map.inBounds(tx, ty) && g.map.ore[ty * g.map.w + tx] > 0) {
        harvesters.forEach(u => orderHarvest(g, u, { x: tx, y: ty }));
        orderMove(g, units.filter(u => u.type !== 'harvester'), wx, wy);
        return;
      }
    }
    orderMove(g, units, wx, wy, attackMove ? 'amove' : 'move');
  }
}
