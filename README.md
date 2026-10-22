# Ashfall Command

A small 1990s-style real-time strategy game for the browser: build a base, harvest ore, train units and destroy the enemy's structures. Plain JavaScript (ES modules) and HTML5 canvas, no frameworks, no build step. All names and art are original placeholders.

## Run

ES modules are blocked by Chrome and Edge when a page is opened from `file://`, so serve the folder:

```bash
npx serve .
```

Then open the printed URL (usually http://localhost:3000). Firefox can also open `index.html` directly. Any static server works (`python -m http.server`, etc.).

## Controls

| Input | Action |
| --- | --- |
| Left click / drag | Select unit or building / box-select units (Shift adds) |
| Double click | Select all units of that type on screen |
| Right click | Move; attack an enemy; harvest ore (harvesters); return to refinery; capture an enemy building (engineers) |
| `A` then left click | Attack-move |
| `S` | Stop |
| `Ctrl+1..9` / `1..9` | Save / recall control group |
| `WASD`, arrow keys, screen edge | Scroll the camera (`A`/`S` only scroll while no units are selected) |
| Minimap | Left click/drag moves the camera, right click orders a move |
| `H` | Jump to your Command Hub |
| `P` | Pause |
| `Esc` | Cancel placement / attack-move, clear selection |

**Building:** click a structure in the sidebar to queue it (right click cancels one and refunds). When it shows READY, click it again and click the map to place it. A structure must be within 2 tiles of your existing base on grass or dirt. Units and infantry/vehicles are queued from the Barracks / Assembly Works.

## Rules

- Start with 3000 credits, a Command Hub, a power array, an ore processor and a hauler.
- **Power:** each structure draws power. When use exceeds supply, production and turret fire slow down (minimum 25%).
- **Tech:** Solar Array → Ore Processor / Drill Hall → Assembly Works (needs both) and Bolt Tower (needs Drill Hall).
- **Armor:** small arms are weak against vehicles and structures, rockets are strong against vehicles and structures, cannons are balanced.
- **Fog of war:** black is unexplored, dimmed is explored but not currently visible.
- **Win** by destroying (or capturing) every enemy building; **lose** if all of yours are destroyed.
- **AI:** builds in a fixed order, rebuilds what it loses, keeps harvesters working and sends waves of increasing size at increasing intervals (first wave at about 4.5 minutes).

## Factions

| | Solari League (you) | Ember Dominion (AI) |
| --- | --- | --- |
| Infantry | Lancer, Stormcaller, Wrench Corps | Cinder Trooper, Blazelancer, Tinker |
| Vehicles | Ore Hauler, Skiff Tank, Bulwark Tank | Slag Hauler, Scorpion Tank, Behemoth |
| Traits | +10% speed, -10% HP | -5% speed, +15% HP |

## Code layout

```
index.html, style.css
src/
  main.js         bootstrap, fixed-timestep loop (20 ticks/s) separate from rendering
  constants.js    tunables, unit/building tables, armor multipliers
  map.js          64x64 terrain generation, ore, occupancy grid
  pathfinding.js  A*
  entities.js     unit/building factories
  game.js         game state and per-tick update order
  units.js        orders: move, attack, attack-move, harvest, capture
  combat.js       targeting, projectiles, damage, death effects, turrets
  production.js   build queues, power, placement rules
  ai.js           enemy AI
  fog.js          fog of war
  input.js        camera, selection, commands
  render.js       canvas renderer and minimap
  ui.js           HUD, sidebar, end screen
```
