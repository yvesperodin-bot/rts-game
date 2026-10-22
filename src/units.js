import { DT } from './constants.js';
import { findPath, nearestFree } from './pathfinding.js';
import { rectDist, distTo, acquireTarget, fireAt } from './combat.js';

export function turnToward(cur, target, step) {
  let d = target - cur;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) <= step ? target : cur + Math.sign(d) * step;
}

export function setPath(game, u, gx, gy) {
  u.path = findPath(game.map, Math.floor(u.x), Math.floor(u.y), gx, gy) || [];
  u.pi = 0;
}

// Advance along u.path. Returns 'done' | 'moving' | 'blocked'.
export function stepPath(game, u, dt = DT) {
  if (!u.path || u.pi >= u.path.length) return 'done';
  let remaining = u.speed * dt;
  while (remaining > 0 && u.pi < u.path.length) {
    const w = u.path[u.pi];
    if (game.map.blocked(w.x, w.y)) return 'blocked';
    const wx = w.x + 0.5, wy = w.y + 0.5;
    const dx = wx - u.x, dy = wy - u.y, d = Math.hypot(dx, dy);
    if (d > 0.001) {
      const ang = Math.atan2(dy, dx);
      u.facing = turnToward(u.facing, ang, 0.5);
      if (u.def.armor === 'infantry' || !u.target) u.aim = u.def.armor === 'infantry' ? ang : u.facing;
    }
    if (d <= remaining) { u.x = wx; u.y = wy; remaining -= d; u.pi++; }
    else { u.x += (dx / d) * remaining; u.y += (dy / d) * remaining; remaining = 0; }
  }
  return u.pi >= u.path.length ? 'done' : 'moving';
}

// Distinct free tiles near (x, y), nearest first (used to spread out a group).
export function spreadTargets(game, x, y, n) {
  const map = game.map;
  const start = nearestFree(map, x, y);
  if (!start) return [];
  const out = [], seen = new Set([start.y * map.w + start.x]), q = [start];
  for (let h = 0; h < q.length && out.length < n; h++) {
    const c = q[h];
    out.push(c);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = c.x + dx, ny = c.y + dy, k = ny * map.w + nx;
      if (map.blocked(nx, ny) || seen.has(k)) continue;
      seen.add(k); q.push({ x: nx, y: ny });
    }
  }
  return out;
}

// Issue a move to a group, giving each unit its own destination tile.
export function orderMove(game, units, x, y, type = 'move') {
  const spots = spreadTargets(game, x, y, units.length);
  const sorted = [...units].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  sorted.forEach((u, i) => {
    const s = spots[Math.min(i, spots.length - 1)] || { x: x | 0, y: y | 0 };
    u.order = { type, x: s.x, y: s.y };
    u.target = null;
    u.hv = null;
    setPath(game, u, s.x, s.y);
  });
}

export function orderStop(game, units) {
  for (const u of units) { u.order = { type: 'idle' }; u.path = null; u.target = null; u.guard = { x: u.x, y: u.y }; if (u.type === 'harvester') u.hv = null; }
}

function updateMove(game, u) {
  const o = u.order;
  const r = stepPath(game, u);
  if (r === 'done') { u.order = { type: 'idle' }; u.guard = { x: u.x, y: u.y }; u.path = null; }
  else if (r === 'blocked') {
    u.retries = (u.retries || 0) + 1;
    if (u.retries > 4) { u.order = { type: 'idle' }; u.retries = 0; u.path = null; return; }
    setPath(game, u, o.x, o.y);
  }
}

export function separate(game) {
  // Gentle push so units don't stack on one spot.
  const us = game.units;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 0.7 || Math.abs(dy) > 0.7) continue;
      const d = Math.hypot(dx, dy) || 0.001, min = (a.def.r + b.def.r) * 0.9;
      if (d >= min) continue;
      const push = (min - d) * 0.25, px = (dx / d) * push, py = (dy / d) * push;
      tryShove(game, a, -px, -py); tryShove(game, b, px, py);
    }
  }
}

function tryShove(game, u, dx, dy) {
  const nx = u.x + dx, ny = u.y + dy;
  if (!game.map.blocked(Math.floor(nx), Math.floor(ny))) { u.x = nx; u.y = ny; }
}

// ----- economy: harvesting -----
const MINE_RATE = 22;    // ore/sec while mining
const UNLOAD_RATE = 120; // credits/sec while unloading

// Tile just outside building b that is closest to unit u.
export function approachTile(u, b) {
  return {
    x: Math.max(b.tx - 1, Math.min(b.tx + b.w, Math.floor(u.x))),
    y: Math.max(b.ty - 1, Math.min(b.ty + b.h, Math.floor(u.y))),
  };
}

function findOre(game, u) {
  const map = game.map, W = map.w;
  const claims = new Map();
  for (const o of game.units) if (o !== u && !o.dead && o.hv && o.hv.tile) { const k = o.hv.tile.y * W + o.hv.tile.x; claims.set(k, (claims.get(k) || 0) + 1); }
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  const seen = new Set([sy * W + sx]), q = [[sx, sy]];
  let fallback = null;
  for (let h = 0; h < q.length && h < 2500; h++) {
    const [x, y] = q[h], i = y * W + x;
    if (map.ore[i] > 0) {
      if ((claims.get(i) || 0) < 2) return { x, y };
      fallback = fallback || { x, y };
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * W + nx;
      if (map.blocked(nx, ny) || seen.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return fallback;
}

function nearestRefinery(game, u) {
  let best = null, bd = Infinity;
  for (const b of game.buildings) {
    if (b.dead || b.owner !== u.owner || b.type !== 'refinery') continue;
    const d = Math.hypot(b.x - u.x, b.y - u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

export function orderHarvest(game, u, tile) {
  u.order = { type: 'harvest' };
  u.target = null;
  if (tile) { u.hv = { state: 'goto', tile }; setPath(game, u, tile.x, tile.y); }
  else u.hv = { state: 'seek' };
}

export function orderReturn(game, u) {
  u.order = { type: 'harvest' };
  u.hv = { state: 'ret' };
}

function updateHarvester(game, u) {
  if (!u.hv) u.hv = { state: 'seek' };
  const hv = u.hv, cap = u.def.capacity, map = game.map;
  if (hv.wait > 0) { hv.wait--; return; }
  switch (hv.state) {
    case 'seek': {
      if (u.carry >= cap * 0.5) { hv.state = 'ret'; break; }
      const t = findOre(game, u);
      if (!t) { if (u.carry > 0) hv.state = 'ret'; else hv.wait = 40; break; }
      hv.tile = t; setPath(game, u, t.x, t.y); hv.state = 'goto';
      break;
    }
    case 'goto': {
      const t = hv.tile;
      if (map.ore[t.y * map.w + t.x] <= 0) { hv.state = 'seek'; break; }
      const r = stepPath(game, u);
      if (r === 'done') { if (Math.floor(u.x) === t.x && Math.floor(u.y) === t.y) hv.state = 'mine'; else hv.state = 'seek'; }
      else if (r === 'blocked') setPath(game, u, t.x, t.y);
      break;
    }
    case 'mine': {
      const i = Math.floor(u.y) * map.w + Math.floor(u.x);
      if (u.carry >= cap) { hv.state = 'ret'; hv.tile = null; break; }
      if (map.ore[i] <= 0) { hv.state = 'seek'; hv.tile = null; break; }
      u.carry += map.mine(i, Math.min(MINE_RATE * DT, cap - u.carry));
      break;
    }
    case 'ret': {
      const ref = nearestRefinery(game, u);
      if (!ref) { hv.wait = 40; break; }
      if (rectDist(u.x, u.y, ref) <= 1.3) { hv.state = 'unload'; u.path = null; break; }
      if (!u.path || u.pi >= u.path.length || hv.refId !== ref.id) {
        const a = approachTile(u, ref);
        setPath(game, u, a.x, a.y); hv.refId = ref.id;
      }
      const r = stepPath(game, u);
      if (r !== 'moving' && rectDist(u.x, u.y, ref) > 1.3) { hv.wait = 10; u.path = null; }
      break;
    }
    case 'unload': {
      const amt = Math.min(UNLOAD_RATE * DT, u.carry);
      u.carry -= amt;
      game.players[u.owner].credits += amt;
      if (u.carry <= 0.01) { u.carry = 0; hv.state = 'seek'; }
      break;
    }
  }
}

// ----- combat orders -----
export function orderAttack(game, units, target) {
  for (const u of units) {
    if (u.def.damage > 0) { u.order = { type: 'attack', id: target.id }; u.target = target.id; u.path = null; u.hv = null; }
    else orderMove(game, [u], target.x, target.y);
  }
}

export function orderCapture(game, units, target) {
  for (const u of units) { u.order = { type: 'capture', id: target.id }; u.path = null; u.target = null; }
}

function chase(game, u, t) {
  u.repathIn = (u.repathIn || 0) - 1;
  if (!u.path || u.chaseId !== t.id || u.repathIn <= 0) {
    const a = t.kind === 'building' ? approachTile(u, t) : { x: Math.floor(t.x), y: Math.floor(t.y) };
    setPath(game, u, a.x, a.y);
    u.chaseId = t.id;
    u.repathIn = t.kind === 'building' ? 60 : 12;
  }
  if (stepPath(game, u) === 'blocked') u.path = null;
}

// Move into range of t and fire when ready.
function engage(game, u, t) {
  const d = u.def, dist = distTo(u, t);
  if (dist > d.range) { chase(game, u, t); return; }
  u.path = null;
  const ang = Math.atan2(t.y - u.y, t.x - u.x);
  u.aim = d.armor === 'infantry' ? ang : turnToward(u.aim, ang, 0.35);
  if (d.armor !== 'infantry') u.facing = turnToward(u.facing, ang, 0.15);
  if (u.cd <= 0 && Math.abs(turnToward(u.aim, ang, 9) - u.aim) < 0.3) fireAt(game, u, t);
}

// Current auto-acquired target (sticky within a leash), or null.
function autoTarget(game, u) {
  let t = u.target ? game.get(u.target) : null;
  if (t && (t.owner === u.owner || distTo(u, t) > u.def.sight * 1.6)) t = null;
  if (!t && (game.tickCount + u.id) % 4 === 0) t = acquireTarget(game, u, u.def.sight);
  u.target = t ? t.id : null;
  return t;
}

function updateAttackMove(game, u) {
  const t = autoTarget(game, u);
  if (t) { engage(game, u, t); return; }
  if (u.chaseId) { u.chaseId = 0; u.path = null; }
  if (!u.path) setPath(game, u, u.order.x, u.order.y);
  updateMove(game, u);
}

function updateAttack(game, u) {
  const t = game.get(u.order.id);
  if (!t || t.owner === u.owner) { u.order = { type: 'idle' }; u.guard = { x: u.x, y: u.y }; u.target = null; return; }
  engage(game, u, t);
}

function updateIdle(game, u) {
  if (u.def.damage <= 0) return;
  const t = autoTarget(game, u);
  if (t) { engage(game, u, t); return; }
  if (u.chaseId) { u.chaseId = 0; u.path = null; }
  if (Math.hypot(u.x - u.guard.x, u.y - u.guard.y) > 1.5) {
    const gx = Math.floor(u.guard.x), gy = Math.floor(u.guard.y);
    u.order = { type: 'move', x: gx, y: gy };
    setPath(game, u, gx, gy);
  }
}

function updateCapture(game, u) {
  const t = game.get(u.order.id);
  if (!t || t.kind !== 'building' || t.owner === u.owner) { u.order = { type: 'idle' }; return; }
  if (rectDist(u.x, u.y, t) <= 1.3) {
    t.owner = u.owner;
    t.target = null;
    t.hp = Math.max(t.hp, t.maxHp * 0.25);
    u.dead = true;
    game.notify(u.owner === 0 ? `${t.def.names[0]} captured!` : 'A structure was captured!');
    return;
  }
  chase(game, u, t);
}

export function updateUnit(game, u) {
  if (u.cd > 0) u.cd -= DT;
  if (u.hit > 0) u.hit -= DT * 4;
  switch (u.order.type) {
    case 'move': updateMove(game, u); break;
    case 'harvest': updateHarvester(game, u); break;
    case 'amove': updateAttackMove(game, u); break;
    case 'attack': updateAttack(game, u); break;
    case 'capture': updateCapture(game, u); break;
    case 'idle': updateIdle(game, u); break;
    default: break;
  }
}
