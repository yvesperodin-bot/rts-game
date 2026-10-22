export class UI {
  constructor(game, input) {
    this.game = game;
    this.input = input;
    this.top = document.getElementById('topbar');
    this.last = 0;
  }

  update(now) {
    if (now - this.last < 100) return;
    this.last = now;
    const p = this.game.players[0];
    this.top.innerHTML = `<span>Credits: <b>${Math.floor(p.credits)}</b></span>`;
  }
}
