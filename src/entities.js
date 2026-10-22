import { UNIT_DEFS, BUILDING_DEFS, FACTIONS } from './constants.js';

export function createUnit(game, type, owner, x, y) {
  const def = UNIT_DEFS[type];
  const mods = FACTIONS[owner].mods;
  const hp = Math.round(def.hp * mods.hp);
  const u = {
    id: game.nextId++, kind: 'unit', type, owner, def, x, y,
    hp, maxHp: hp, speed: def.speed * mods.speed,
    facing: Math.PI / 2, aim: Math.PI / 2,
    order: { type: 'idle' }, path: null, pi: 0, target: null, cd: 0,
    carry: 0, hv: null, guard: { x, y }, dead: false, hit: 0,
  };
  game.addEntity(u);
  return u;
}

export function createBuilding(game, type, owner, tx, ty) {
  const def = BUILDING_DEFS[type];
  const b = {
    id: game.nextId++, kind: 'building', type, owner, def, tx, ty, w: def.w, h: def.h,
    x: tx + def.w / 2, y: ty + def.h / 2,
    hp: def.hp, maxHp: def.hp, aim: Math.PI / 2, target: null, cd: 0, dead: false, hit: 0,
  };
  for (let y = ty; y < ty + b.h; y++) for (let x = tx; x < tx + b.w; x++) game.map.bld[game.map.idx(x, y)] = b.id;
  game.addEntity(b);
  return b;
}

export function entityName(e) { return e.def.names[e.owner]; }
