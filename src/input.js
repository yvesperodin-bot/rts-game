import { TILE, MAP_W, MAP_H, STARTS } from './constants.js';

const SCROLL_SPEED = 900; // px/sec
const EDGE = 12;

export class Input {
  constructor(game, canvas, minimap) {
    this.game = game;
    this.canvas = canvas;
    this.minimap = minimap;
    this.camera = { x: 0, y: 0 };
    this.selection = [];
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, inside: false };
    this.ac = new AbortController();
    this.centerOn(STARTS[0].x + 1.5, STARTS[0].y + 1.5);
    this.bind();
  }

  destroy() { this.ac.abort(); }

  isSelected(e) { return this.selection.includes(e); }

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

  bind() {
    const opt = { signal: this.ac.signal };
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
      this.onKey(e);
    }, opt);
    window.addEventListener('keyup', e => this.keys.delete(e.code), opt);
    window.addEventListener('blur', () => this.keys.clear(), opt);
    this.canvas.addEventListener('mousemove', e => this.setMouse(e, true), opt);
    this.canvas.addEventListener('mouseleave', () => { this.mouse.inside = false; }, opt);
    this.canvas.addEventListener('contextmenu', e => e.preventDefault(), opt);
    this.minimap.addEventListener('contextmenu', e => e.preventDefault(), opt);
    const mm = e => {
      if (!(e.buttons & 1)) return;
      const r = this.minimap.getBoundingClientRect();
      this.centerOn((e.clientX - r.left) / r.width * MAP_W, (e.clientY - r.top) / r.height * MAP_H);
    };
    this.minimap.addEventListener('mousedown', mm, opt);
    this.minimap.addEventListener('mousemove', mm, opt);
  }

  setMouse(e, inside) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; this.mouse.inside = inside;
  }

  onKey() {}

  update(dt) {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.has('KeyA') && !this.attackMoveArmed) dx -= 1;
    if (k.has('ArrowLeft')) dx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;
    const m = this.mouse;
    if (m.inside) {
      if (m.x < EDGE) dx -= 1;
      if (m.x > this.canvas.width - EDGE) dx += 1;
      if (m.y < EDGE) dy -= 1;
      if (m.y > this.canvas.height - EDGE) dy += 1;
    }
    this.camera.x += Math.sign(dx) * SCROLL_SPEED * dt;
    this.camera.y += Math.sign(dy) * SCROLL_SPEED * dt;
    this.clampCamera();
  }
}
