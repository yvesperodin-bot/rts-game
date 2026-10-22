import { DT } from './constants.js';
import { findPath, nearestFree } from './pathfinding.js';

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

export function updateUnit(game, u) {
  if (u.cd > 0) u.cd -= DT;
  if (u.hit > 0) u.hit -= DT * 4;
  switch (u.order.type) {
    case 'move': updateMove(game, u); break;
    default: break;
  }
}
