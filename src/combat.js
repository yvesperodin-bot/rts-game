import { DT, WEAPON_MULT, PROJECTILE, PLAYER } from './constants.js';

export function rectDist(px, py, b) {
  const cx = Math.max(b.tx, Math.min(px, b.tx + b.w)), cy = Math.max(b.ty, Math.min(py, b.ty + b.h));
  return Math.hypot(px - cx, py - cy);
}

// Distance from attacker a (unit or building centre) to target t's nearest point.
export function distTo(a, t) {
  return t.kind === 'building' ? rectDist(a.x, a.y, t) : Math.hypot(t.x - a.x, t.y - a.y);
}

// Best enemy within `range`: armed things first, then the nearest.
export function acquireTarget(game, e, range) {
  let best = null, bs = Infinity;
  for (const o of game.entities) {
    if (o.dead || o.owner === e.owner) continue;
    const d = distTo(e, o);
    if (d > range) continue;
    const s = d + (o.def.damage > 0 ? 0 : 3);
    if (s < bs) { bs = s; best = o; }
  }
  return best;
}

export function addEffect(game, kind, x, y, dur, r, extra = {}) {
  game.effects.push({ kind, x, y, t: 0, dur, r, delay: 0, ...extra });
}

export function fireAt(game, e, t) {
  const d = e.def, ang = Math.atan2(t.y - e.y, t.x - e.x);
  e.aim = ang;
  e.cd = d.cooldown;
  const pr = PROJECTILE[d.weapon];
  game.projectiles.push({
    x: e.x + Math.cos(ang) * 0.5, y: e.y + Math.sin(ang) * 0.5, tid: t.id, tx: t.x, ty: t.y,
    speed: pr.speed, dmg: d.damage, weapon: d.weapon, owner: e.owner, aid: e.id, dead: false, n: 0,
  });
  addEffect(game, 'flash', e.x + Math.cos(ang) * 0.6, e.y + Math.sin(ang) * 0.6, 0.12, 0.25);
}

export function applyDamage(game, target, dmg, weapon, attacker) {
  if (target.dead) return;
  target.hp -= dmg * WEAPON_MULT[weapon][target.def.armor];
  target.hit = 1;
  if (target.owner === PLAYER && game.tickCount - (game.lastAlert || -999) > 160) {
    game.lastAlert = game.tickCount;
    game.notify(target.kind === 'building' ? 'Base under attack!' : 'Unit under attack!');
  }
  if (target.kind === 'unit' && attacker && !attacker.dead && target.def.damage > 0 && target.order.type === 'idle' && !target.target) target.target = attacker.id;
  if (target.hp <= 0) kill(game, target);
}

export function kill(game, e) {
  if (e.dead) return;
  e.dead = true;
  if (e.kind === 'building') {
    const m = game.map;
    for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) m.bld[m.idx(x, y)] = 0;
    const n = 3 + e.w * e.h;
    for (let i = 0; i < Math.min(n, 9); i++) {
      addEffect(game, 'boom', e.x + (Math.random() - 0.5) * e.w, e.y + (Math.random() - 0.5) * e.h, 0.7, 0.7 + Math.random() * 0.5, { delay: i * 0.08 });
    }
    if (e.owner === PLAYER) game.notify(`${e.def.names[0]} destroyed`);
  } else if (e.def.armor === 'infantry') {
    addEffect(game, 'corpse', e.x, e.y, 0.9, e.def.r, { owner: e.owner });
  } else {
    addEffect(game, 'boom', e.x, e.y, 0.6, 1.1);
    addEffect(game, 'corpse', e.x, e.y, 1.5, e.def.r, { owner: e.owner, wreck: true });
  }
}

export function updateProjectiles(game) {
  for (const p of game.projectiles) {
    const t = game.get(p.tid);
    if (t) { p.tx = t.x; p.ty = t.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * DT;
    p.ang = Math.atan2(dy, dx);
    if (p.weapon === 'rocket' && ++p.n % 2 === 0) addEffect(game, 'smoke', p.x, p.y, 0.5, 0.18);
    const near = t && t.kind === 'building' ? rectDist(p.x, p.y, t) : d - 0.15;
    if (near <= step) {
      p.dead = true;
      if (t) applyDamage(game, t, p.dmg, p.weapon, game.get(p.aid));
      addEffect(game, p.weapon === 'smallarms' ? 'spark' : 'boom', p.tx, p.ty, p.weapon === 'smallarms' ? 0.15 : 0.35, p.weapon === 'smallarms' ? 0.15 : 0.45);
    } else { p.x += (dx / d) * step; p.y += (dy / d) * step; }
  }
  game.projectiles = game.projectiles.filter(p => !p.dead);
}

export function updateEffects(game) {
  for (const f of game.effects) f.t += DT;
  game.effects = game.effects.filter(f => f.t < f.dur + f.delay);
}

export function updateTurrets(game) {
  const factor = (o) => game.players[o].powerFactor;
  for (const b of game.buildings) {
    if (b.dead || !b.def.weapon) continue;
    if (b.hit > 0) b.hit -= DT * 4;
    if (b.cd > 0) b.cd -= DT * factor(b.owner);
    let t = b.target ? game.get(b.target) : null;
    if (t && (t.owner === b.owner || distTo(b, t) > b.def.range * 1.1)) t = null;
    if (!t && (game.tickCount + b.id) % 4 === 0) t = acquireTarget(game, b, b.def.range);
    b.target = t ? t.id : null;
    if (t) {
      b.aim = Math.atan2(t.y - b.y, t.x - b.x);
      if (b.cd <= 0) fireAt(game, b, t);
    }
  }
  for (const b of game.buildings) if (!b.def.weapon && b.hit > 0) b.hit -= DT * 4;
}
