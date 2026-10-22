import { DT, START_CREDITS, STARTS, PLAYER, ENEMY } from './constants.js';
import { GameMap } from './map.js';
import { createUnit, createBuilding } from './entities.js';
import { updateUnit, separate } from './units.js';
import { updateProduction } from './production.js';
import { Fog } from './fog.js';
import { AI } from './ai.js';
import { updateProjectiles, updateEffects, updateTurrets } from './combat.js';

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
    this.fog = new Fog(this.map);
    this.fog.update(this);
    this.ai = new AI(this, ENEMY);
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

  // Can the player see this entity right now (units) or has explored its ground (buildings)?
  canSee(e) {
    if (e.owner === PLAYER) return true;
    return e.kind === 'unit' ? this.fog.isVisible(e.x, e.y) : this.fog.isExplored(e.x, e.y);
  }

  checkEnd() {
    const mine = this.buildings.some(b => !b.dead && b.owner === PLAYER);
    const theirs = this.buildings.some(b => !b.dead && b.owner === ENEMY);
    if (!mine) this.state = 'lost';
    else if (!theirs) this.state = 'won';
  }

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
    updateProduction(this);
    for (const u of this.units) updateUnit(this, u);
    updateTurrets(this);
    updateProjectiles(this);
    updateEffects(this);
    separate(this);
    this.cleanup();
    this.ai.update();
    if (this.tickCount % 2 === 0) this.fog.update(this);
    if (this.tickCount % 10 === 0) this.checkEnd();
    for (const n of this.notices) n.ttl -= DT;
    this.notices = this.notices.filter(n => n.ttl > 0);
  }
}
