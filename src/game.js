import { DT, START_CREDITS, STARTS } from './constants.js';
import { GameMap } from './map.js';
import { createUnit, createBuilding } from './entities.js';
import { updateUnit, separate } from './units.js';

export class Game {
  constructor(seed = 7) {
    this.map = new GameMap(seed);
    this.tickCount = 0;
    this.time = 0;
    this.state = 'playing'; // playing | won | lost
    this.paused = false;
    this.nextId = 1;
    this.entities = [];
    this.units = [];
    this.buildings = [];
    this.byId = new Map();
    this.projectiles = [];
    this.effects = [];
    this.notices = [];
    this.players = [0, 1].map(owner => ({
      owner, credits: START_CREDITS, supply: 0, use: 0, powerFactor: 1,
      queues: { building: [], infantry: [], vehicle: [] },
    }));
    for (let o = 0; o < 2; o++) this.setupBase(o);
  }

  setupBase(owner) {
    const s = STARTS[owner];
    createBuilding(this, 'conyard', owner, s.x, s.y);
    createBuilding(this, 'power', owner, s.x + 4, s.y);
    createBuilding(this, 'refinery', owner, s.x + 4, s.y + 3);
    const h = createUnit(this, 'harvester', owner, s.x + 3.5, s.y + 5.5);
    h.order = { type: 'harvest' };
    h.hv = { state: 'seek' };
    if (owner === 0) {
      for (let i = 0; i < 3; i++) createUnit(this, 'rifle', owner, s.x + 1 + i, s.y + 4.5);
    }
  }

  addEntity(e) {
    this.entities.push(e);
    (e.kind === 'unit' ? this.units : this.buildings).push(e);
    this.byId.set(e.id, e);
  }

  get(id) {
    const e = this.byId.get(id);
    return e && !e.dead ? e : null;
  }

  canSee(e) { return true; } // fog of war hooks in later

  notify(text, owner = 0) {
    if (owner !== 0) return;
    this.notices.push({ text, ttl: 5 });
    if (this.notices.length > 4) this.notices.shift();
  }

  cleanup() {
    if (!this.entities.some(e => e.dead)) return;
    for (const e of this.entities) if (e.dead) this.byId.delete(e.id);
    this.entities = this.entities.filter(e => !e.dead);
    this.units = this.units.filter(e => !e.dead);
    this.buildings = this.buildings.filter(e => !e.dead);
  }

  tick() {
    this.tickCount++;
    this.time += DT;
    for (const u of this.units) updateUnit(this, u);
    separate(this);
    this.cleanup();
    for (const n of this.notices) n.ttl -= DT;
    this.notices = this.notices.filter(n => n.ttl > 0);
  }
}
