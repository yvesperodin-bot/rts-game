import { TICK_MS } from './constants.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { UI } from './ui.js';

const canvas = document.getElementById('view');
const minimap = document.getElementById('minimap');
const stage = document.getElementById('stage');

let app = null;

function resize() {
  canvas.width = stage.clientWidth;
  canvas.height = stage.clientHeight;
  app?.input.clampCamera();
}

export function startGame() {
  app?.input.destroy();
  const game = new Game(7);
  const input = new Input(game, canvas, minimap);
  const renderer = new Renderer(game, canvas, minimap);
  const ui = new UI(game, input, startGame);
  app = { game, input, renderer, ui };
  window.__app = app; // handy for debugging in the console
  resize();
  input.centerOn(7 + 1.5, 50 + 1.5);
}

window.addEventListener('resize', resize);
startGame();

// Fixed-timestep simulation (TICK_MS) decoupled from rendering.
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(now - last, 250);
  last = now;
  const { game, input, renderer, ui } = app;
  if (!game.paused && game.state === 'playing') {
    acc += dt;
    let steps = 0;
    while (acc >= TICK_MS && steps < 5) { game.tick(); acc -= TICK_MS; steps++; }
    if (steps === 5) acc = 0;
  } else {
    acc = 0;
  }
  input.update(dt / 1000);
  renderer.draw(input);
  ui.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
