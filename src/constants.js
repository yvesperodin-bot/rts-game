// Shared constants and data tables. All names/art are original placeholders.
export const TILE = 32;
export const MAP_W = 64;
export const MAP_H = 64;
export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
export const TICK_MS = 1000 / TICK_RATE;
export const START_CREDITS = 3000;
export const ORE_PER_TILE = 400;
export const BUILD_RADIUS = 2; // max empty tiles between a new building and the base
export const PLAYER = 0;
export const ENEMY = 1;

export const T = { GRASS: 0, DIRT: 1, ROCK: 2, ORE: 3 };

// Conyard top-left tiles for each side.
export const STARTS = [{ x: 7, y: 50 }, { x: 53, y: 11 }];
export const ORE_SPOTS = [
  { x: 18, y: 53, r: 3.6 }, { x: 45, y: 13, r: 3.6 },
  { x: 32, y: 32, r: 3.2 }, { x: 14, y: 30, r: 3 }, { x: 50, y: 34, r: 3 },
  { x: 30, y: 11, r: 3 }, { x: 34, y: 54, r: 3 },
];

// Index = owner. Factions share the tech tree but differ in names, colours and stat mods.
export const FACTIONS = [
  { id: 'solari', name: 'Solari League', color: '#3b9cff', dark: '#173f6b', mods: { hp: 0.9, speed: 1.1 } },
  { id: 'ember', name: 'Ember Dominion', color: '#ff5240', dark: '#6b1d16', mods: { hp: 1.15, speed: 0.95 } },
];

export const ARMOR_LABEL = { infantry: 'Light', vehicle: 'Heavy', building: 'Structure' };

// damage multiplier [weapon][armor]
export const WEAPON_MULT = {
  smallarms: { infantry: 1.0, vehicle: 0.3, building: 0.2 },
  rocket: { infantry: 0.5, vehicle: 1.5, building: 1.3 },
  cannon: { infantry: 0.8, vehicle: 1.0, building: 1.0 },
};
export const PROJECTILE = {
  smallarms: { speed: 22, color: '#ffe680', size: 2 },
  rocket: { speed: 9, color: '#ff9a3c', size: 4 },
  cannon: { speed: 14, color: '#fff2c0', size: 4 },
};

// speed: tiles/sec, range/sight: tiles, cooldown: sec, time: build seconds
export const UNIT_DEFS = {
  rifle: { names: ['Lancer', 'Cinder Trooper'], cat: 'infantry', producer: 'barracks', armor: 'infantry', cost: 100, time: 5, hp: 60, speed: 2.6, sight: 6, range: 4, damage: 6, cooldown: 0.8, weapon: 'smallarms', r: 0.28, desc: 'Cheap small-arms infantry.' },
  rocket: { names: ['Stormcaller', 'Blazelancer'], cat: 'infantry', producer: 'barracks', armor: 'infantry', cost: 250, time: 8, hp: 50, speed: 2.2, sight: 6, range: 5.5, damage: 30, cooldown: 2.0, weapon: 'rocket', r: 0.28, desc: 'Anti-armor and anti-structure rockets.' },
  engineer: { names: ['Wrench Corps', 'Tinker'], cat: 'infantry', producer: 'barracks', armor: 'infantry', cost: 300, time: 8, hp: 40, speed: 2.4, sight: 5, range: 0, damage: 0, cooldown: 1, weapon: null, r: 0.28, desc: 'Captures enemy buildings.' },
  harvester: { names: ['Ore Hauler', 'Slag Hauler'], cat: 'vehicle', producer: 'factory', armor: 'vehicle', cost: 700, time: 12, hp: 300, speed: 1.8, sight: 5, range: 0, damage: 0, cooldown: 1, weapon: null, r: 0.4, capacity: 200, desc: 'Gathers ore for the refinery.' },
  light: { names: ['Skiff Tank', 'Scorpion Tank'], cat: 'vehicle', producer: 'factory', armor: 'vehicle', cost: 600, time: 10, hp: 200, speed: 3.4, sight: 7, range: 5, damage: 18, cooldown: 1.1, weapon: 'cannon', r: 0.4, desc: 'Fast light tank.' },
  heavy: { names: ['Bulwark Tank', 'Behemoth'], cat: 'vehicle', producer: 'factory', armor: 'vehicle', cost: 1000, time: 16, hp: 450, speed: 2.2, sight: 7, range: 5.5, damage: 40, cooldown: 1.6, weapon: 'cannon', r: 0.5, desc: 'Slow, heavily armored tank.' },
};

// power: + supplies, - consumes
export const BUILDING_DEFS = {
  conyard: { names: ['Command Hub', 'Dominion Keep'], cat: null, armor: 'building', w: 3, h: 3, cost: 0, time: 0, hp: 1000, power: 20, sight: 8, requires: [], desc: 'Base command. Builds structures.' },
  power: { names: ['Solar Array', 'Slag Reactor'], cat: 'building', armor: 'building', w: 2, h: 2, cost: 300, time: 10, hp: 400, power: 100, sight: 5, requires: [], desc: 'Supplies power.' },
  refinery: { names: ['Ore Processor', 'Smelter'], cat: 'building', armor: 'building', w: 3, h: 2, cost: 600, time: 14, hp: 600, power: -30, sight: 6, requires: ['power'], desc: 'Harvesters unload ore here.' },
  barracks: { names: ['Drill Hall', 'Warren'], cat: 'building', armor: 'building', w: 2, h: 2, cost: 400, time: 12, hp: 500, power: -20, sight: 6, requires: ['power'], desc: 'Trains infantry.' },
  factory: { names: ['Assembly Works', 'Forge'], cat: 'building', armor: 'building', w: 3, h: 3, cost: 1000, time: 18, hp: 800, power: -30, sight: 6, requires: ['refinery', 'barracks'], desc: 'Builds vehicles.' },
  turret: { names: ['Bolt Tower', 'Cinder Turret'], cat: 'building', armor: 'building', w: 1, h: 1, cost: 500, time: 10, hp: 350, power: -15, sight: 7, requires: ['barracks'], range: 6.5, damage: 25, cooldown: 1.0, weapon: 'cannon', desc: 'Defensive cannon. Needs power.' },
};

export const BUILDABLE = ['power', 'refinery', 'barracks', 'factory', 'turret'];
export const CATEGORIES = {
  building: { label: 'Structures', keys: BUILDABLE, producer: 'conyard' },
  infantry: { label: 'Infantry', keys: ['rifle', 'rocket', 'engineer'], producer: 'barracks' },
  vehicle: { label: 'Vehicles', keys: ['harvester', 'light', 'heavy'], producer: 'factory' },
};
export const DEFS = { ...UNIT_DEFS, ...BUILDING_DEFS };
