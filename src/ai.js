import { ENEMY, PLAYER, DEFS, STARTS } from './constants.js';
import { enqueue, ownedCount, hasBuilding, canPlace, placeBuilding, isAvailable } from './production.js';
import { orderMove, orderHarvest } from './units.js';

// Buildings the AI works through, in order. Anything destroyed is rebuilt (counts are cumulative).
const BUILD_ORDER = ['power', 'refinery', 'barracks', 'power', 'factory', 'turret', 'refinery', 'power', 'turret', 'barracks', 'turret', 'power', 'turret', 'turret', 'power'];
const FIRST_WAVE = 270;     // seconds
const MAX_ARMY = 45;

export class AI {
  constructor(game, owner = ENEMY) {
    this.g = game;
    this.o = owner;
    this.wave = 0;
    this.nextWave = FIRST_WAVE;
    this.sent = new Set();
  }

  update() {
    const g = this.g;
    if (g.tickCount % 10 !== 0) return; // think twice a second
    this.build();
    this.train();
    this.manageUnits();
    this.waves();
  }

  mine(pred) { return this.g.units.filter(u => !u.dead && u.owner === this.o && pred(u)); }

  build() {
    const g = this.g, p = g.players[this.o], q = p.queues.building;
    if (q[0] && q[0].ready) { this.place(q[0].key); return; }
    if (q.length || !hasBuilding(g, this.o, 'conyard')) return;
    let want = null;
    // Keep power ahead of demand.
    if (p.use + 30 > p.supply && isAvailable(g, this.o, 'power') && q.length === 0) want = 'power';
    if (!want) {
      const req = {};
      for (const t of BUILD_ORDER) {
        req[t] = (req[t] || 0) + 1;
        if (ownedCount(g, this.o, t) < req[t]) { want = t; break; }
      }
    }
    if (want && isAvailable(g, this.o, want)) enqueue(g, this.o, want);
  }

  place(key) {
    const g = this.g, d = DEFS[key];
    const home = g.buildings.find(b => !b.dead && b.owner === this.o && b.type === 'conyard') || g.buildings.find(b => !b.dead && b.owner === this.o);
    if (!home) return;
    const front = { x: 32, y: 32 };
    let best = null, bs = Infinity;
    for (let y = home.ty - 9; y <= home.ty + 12; y++) {
      for (let x = home.tx - 9; x <= home.tx + 12; x++) {
        if (!canPlace(g, this.o, key, x, y, 1)) continue;
        const cx = x + d.w / 2, cy = y + d.h / 2;
        let s = Math.hypot(cx - home.x, cy - home.y) + Math.random() * 3;
        if (key === 'turret') s = Math.hypot(cx - front.x, cy - front.y) * 0.5 + Math.random() * 3 + (Math.hypot(cx - home.x, cy - home.y) > 8 ? 50 : 0);
        if (s < bs) { bs = s; best = [x, y]; }
      }
    }
    if (best) placeBuilding(g, this.o, key, best[0], best[1], 1);
    else { const q = g.players[this.o].queues.building; g.players[this.o].credits += q[0].spent; q.shift(); } // nowhere to put it
  }

  train() {
    const g = this.g, p = g.players[this.o];
    const army = this.mine(u => u.def.damage > 0).length;
    const harvesters = this.mine(u => u.type === 'harvester').length + p.queues.vehicle.filter(i => i.key === 'harvester').length;
    const wantH = Math.min(4, ownedCount(g, this.o, 'refinery') * 2);
    if (hasBuilding(g, this.o, 'factory') && p.queues.vehicle.length < 2) {
      if (harvesters < wantH) enqueue(g, this.o, 'harvester');
      else if (army < MAX_ARMY) enqueue(g, this.o, Math.random() < (this.wave > 0 ? 0.5 : 0.25) ? 'heavy' : 'light');
    }
    if (hasBuilding(g, this.o, 'barracks') && p.queues.infantry.length < 2 && army < MAX_ARMY) {
      enqueue(g, this.o, Math.random() < 0.6 ? 'rifle' : 'rocket');
    }
    // Replace lost harvesters even when the factory queue is busy.
    if (hasBuilding(g, this.o, 'factory') && harvesters < 1 && !p.queues.vehicle.some(i => i.key === 'harvester')) p.queues.vehicle.unshift({ key: 'harvester', progress: 0, spent: 0, ready: false });
  }

  manageUnits() {
    const g = this.g;
    for (const h of this.mine(u => u.type === 'harvester')) if (h.order.type === 'idle') orderHarvest(g, h, null);
    // Idle army members gather near the base entrance; survivors of a wave keep pushing.
    const rally = this.rallyPoint();
    for (const u of this.mine(u => u.def.damage > 0 && u.order.type === 'idle')) {
      if (this.sent.has(u.id)) {
        const t = this.targetFor(u);
        if (t) orderMove(g, [u], t.x, t.y, 'amove');
      } else if (Math.hypot(u.x - rally.x, u.y - rally.y) > 6 && !u.path) {
        orderMove(g, [u], rally.x + (Math.random() - 0.5) * 4, rally.y + (Math.random() - 0.5) * 4);
      }
    }
  }

  rallyPoint() {
    const s = STARTS[this.o];
    return { x: s.x - 5, y: s.y + 7 };
  }

  targetFor(u) {
    let best = null, bd = Infinity;
    for (const b of this.g.buildings) {
      if (b.dead || b.owner !== PLAYER) continue;
      const d = Math.hypot(b.x - u.x, b.y - u.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  waves() {
    const g = this.g;
    if (g.time < this.nextWave) return;
    const size = 4 + this.wave * 3;
    const army = this.mine(u => u.def.damage > 0 && !this.sent.has(u.id));
    if (army.length < Math.ceil(size * 0.6)) { this.nextWave = g.time + 15; return; } // not ready yet
    const squad = army.slice(0, size);
    const target = this.targetFor(squad[0]);
    if (!target) return;
    for (const u of squad) this.sent.add(u.id);
    orderMove(g, squad, target.x, target.y, 'amove');
    this.wave++;
    this.nextWave = g.time + 120 + this.wave * 25; // later waves are bigger and further apart
  }
}
