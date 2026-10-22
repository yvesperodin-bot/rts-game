import { DT, DEFS, CATEGORIES, BUILD_RADIUS } from './constants.js';
import { createUnit, createBuilding, entityName } from './entities.js';
import { nearestFree } from './pathfinding.js';
import { orderMove, orderHarvest } from './units.js';

export const MAX_QUEUE = 5;

export function hasBuilding(game, owner, type) {
  return game.buildings.some(b => !b.dead && b.owner === owner && b.type === type);
}
export function ownedCount(game, owner, type) {
  let n = 0;
  for (const b of game.buildings) if (!b.dead && b.owner === owner && b.type === type) n++;
  return n;
}

export function isAvailable(game, owner, key) {
  const def = DEFS[key];
  if (!hasBuilding(game, owner, CATEGORIES[def.cat].producer)) return false;
  return (def.requires || []).every(r => hasBuilding(game, owner, r));
}

export function updatePower(game) {
  for (const p of game.players) { p.supply = 0; p.use = 0; }
  for (const b of game.buildings) {
    if (b.dead) continue;
    const p = game.players[b.owner];
    if (b.def.power > 0) p.supply += b.def.power; else p.use -= b.def.power;
  }
  for (const p of game.players) p.powerFactor = p.use <= p.supply ? 1 : Math.max(0.25, p.supply / p.use);
}

export function enqueue(game, owner, key) {
  const def = DEFS[key];
  const q = game.players[owner].queues[def.cat];
  if (q.length >= MAX_QUEUE || !isAvailable(game, owner, key)) return false;
  q.push({ key, progress: 0, spent: 0, ready: false });
  return true;
}

// Cancel the most recently queued item of this type and refund what was spent.
export function cancel(game, owner, key) {
  const p = game.players[owner];
  const q = p.queues[DEFS[key].cat];
  for (let i = q.length - 1; i >= 0; i--) {
    if (q[i].key !== key) continue;
    p.credits += q[i].spent;
    q.splice(i, 1);
    return true;
  }
  return false;
}

function producerFor(game, owner, type) {
  return game.buildings.find(b => !b.dead && b.owner === owner && b.type === type) || null;
}

export function updateProduction(game) {
  updatePower(game);
  for (const p of game.players) {
    for (const [cat, q] of Object.entries(p.queues)) {
      const item = q[0];
      if (!item || item.ready) continue;
      const def = DEFS[item.key];
      const producer = producerFor(game, p.owner, CATEGORIES[cat].producer);
      if (!producer || !isAvailable(game, p.owner, item.key)) { item.stalled = true; continue; }
      const rate = (DT / def.time) * p.powerFactor;
      const need = rate * def.cost;
      if (p.credits < need) { item.stalled = true; continue; }
      item.stalled = false;
      p.credits -= need; item.spent += need; item.progress += rate;
      if (item.progress < 1) continue;
      item.progress = 1;
      if (cat === 'building') {
        item.ready = true;
        game.notify(`${entityName({ def, owner: p.owner })} ready to place`, p.owner);
      } else {
        const prod = producerFor(game, p.owner, def.producer);
        if (prod) { spawnUnit(game, p.owner, item.key, prod); q.shift(); game.notify(`${entityName({ def, owner: p.owner })} trained`, p.owner); }
      }
    }
  }
}

function spawnUnit(game, owner, key, prod) {
  const t = nearestFree(game.map, Math.floor(prod.x), prod.ty + prod.h) || { x: prod.tx, y: prod.ty };
  const u = createUnit(game, key, owner, t.x + 0.5, t.y + 0.5);
  if (key === 'harvester') { orderHarvest(game, u, null); return u; }
  const rx = t.x + Math.round((Math.random() - 0.5) * 4), ry = t.y + 2 + Math.round(Math.random() * 2);
  orderMove(game, [u], rx, ry);
  return u;
}

export function canPlace(game, owner, key, tx, ty, margin = 0) {
  const def = DEFS[key], map = game.map;
  for (let y = ty; y < ty + def.h; y++) for (let x = tx; x < tx + def.w; x++) if (!map.buildable(x, y)) return false;
  for (const u of game.units) {
    if (!u.dead && u.x >= tx && u.x < tx + def.w && u.y >= ty && u.y < ty + def.h) return false;
  }
  if (margin) {
    for (let y = ty - margin; y < ty + def.h + margin; y++) {
      for (let x = tx - margin; x < tx + def.w + margin; x++) if (map.inBounds(x, y) && map.bld[map.idx(x, y)]) return false;
    }
  }
  return game.buildings.some(b => {
    if (b.dead || b.owner !== owner) return false;
    const gx = Math.max(b.tx - (tx + def.w), tx - (b.tx + b.w), 0);
    const gy = Math.max(b.ty - (ty + def.h), ty - (b.ty + b.h), 0);
    return Math.max(gx, gy) <= BUILD_RADIUS;
  });
}

export function placeBuilding(game, owner, key, tx, ty, margin = 0) {
  const q = game.players[owner].queues.building;
  const item = q[0];
  if (!item || item.key !== key || !item.ready || !canPlace(game, owner, key, tx, ty, margin)) return null;
  q.shift();
  return createBuilding(game, key, owner, tx, ty);
}
