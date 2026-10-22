import { CATEGORIES, DEFS, FACTIONS, ARMOR_LABEL, PLAYER } from './constants.js';
import { enqueue, cancel, isAvailable } from './production.js';
import { entityName } from './entities.js';

export class UI {
  constructor(game, input, restart) {
    this.game = game;
    this.input = input;
    this.restart = restart;
    this.top = document.getElementById('topbar');
    this.notices = document.getElementById('notices');
    this.selinfo = document.getElementById('selinfo');
    this.overlay = document.getElementById('overlay');
    this.build = document.getElementById('build');
    this.overlay.className = 'hidden';
    this.overlay.innerHTML = '';
    this.last = 0;
    this.items = {};
    this.buildSidebar();
  }

  buildSidebar() {
    this.build.innerHTML = '';
    for (const [cat, info] of Object.entries(CATEGORIES)) {
      const h = document.createElement('h4');
      h.textContent = info.label;
      this.build.appendChild(h);
      for (const key of info.keys) {
        const def = DEFS[key];
        const btn = document.createElement('button');
        btn.className = 'item';
        btn.title = `${def.desc}${def.requires?.length ? ' Requires: ' + def.requires.join(', ') : ''}`;
        btn.innerHTML = `<span class="name">${def.names[PLAYER]}</span><span class="right"><span class="tag"></span> <span class="cost">$${def.cost}</span></span><div class="prog"></div>`;
        btn.addEventListener('click', () => this.onItem(cat, key));
        btn.addEventListener('contextmenu', e => { e.preventDefault(); cancel(this.game, PLAYER, key); });
        this.build.appendChild(btn);
        this.items[key] = { btn, tag: btn.querySelector('.tag'), prog: btn.querySelector('.prog') };
      }
    }
  }

  onItem(cat, key) {
    const g = this.game;
    if (g.paused || g.state !== 'playing') return;
    const q = g.players[PLAYER].queues[cat];
    if (cat === 'building' && q[0] && q[0].key === key && q[0].ready) { this.input.placing = key; return; }
    if (!enqueue(g, PLAYER, key)) g.notify(isAvailable(g, PLAYER, key) ? 'Queue full' : 'Requirements not met');
  }

  update(now) {
    if (now - this.last < 100) return;
    this.last = now;
    const g = this.game, p = g.players[PLAYER];
    const low = p.use > p.supply;
    const pct = p.supply ? Math.min(100, (p.use / p.supply) * 100) : (p.use ? 100 : 0);
    const mins = Math.floor(g.time / 60), secs = String(Math.floor(g.time % 60)).padStart(2, '0');
    this.top.innerHTML = `<span>Credits <b>${Math.floor(p.credits)}</b></span>
      <span class="${low ? 'low' : ''}">Power <b>${p.use}</b> / ${p.supply}<span class="powerbar"><i style="width:${pct}%;background:${low ? '#ff5a4a' : '#4cd964'}"></i></span>${low ? ' LOW POWER' : ''}</span>
      <span>${FACTIONS[PLAYER].name}</span><span style="margin-left:auto">${mins}:${secs}${g.paused ? ' &nbsp;PAUSED' : ''}</span>`;
    this.notices.innerHTML = g.notices.map(n => `<div>${n.text}</div>`).join('');
    this.updateItems(p);
    this.updateSelection();
    this.updateOverlay();
  }

  updateItems(p) {
    const g = this.game;
    for (const [cat, info] of Object.entries(CATEGORIES)) {
      const q = p.queues[cat];
      for (const key of info.keys) {
        const it = this.items[key];
        const locked = !isAvailable(g, PLAYER, key);
        it.btn.classList.toggle('locked', locked);
        const front = q[0];
        const count = q.filter(i => i.key === key).length;
        const isFront = front && front.key === key;
        it.btn.classList.toggle('ready', !!(isFront && front.ready));
        it.prog.style.width = isFront ? `${Math.min(1, front.progress) * 100}%` : '0';
        it.tag.textContent = isFront && front.ready ? 'READY' : isFront && front.stalled ? (count > 1 ? `x${count} ⏸` : '⏸') : count > 1 ? `x${count}` : count ? 'building' : '';
      }
    }
  }

  updateSelection() {
    const sel = this.input.selection.filter(e => !e.dead);
    if (!sel.length) { this.selinfo.innerHTML = ''; return; }
    if (sel.length > 1) {
      const counts = {};
      for (const e of sel) counts[entityName(e)] = (counts[entityName(e)] || 0) + 1;
      this.selinfo.innerHTML = `<b>${sel.length} selected</b><br><small>${Object.entries(counts).map(([k, v]) => `${v}× ${k}`).join(', ')}</small>`;
      return;
    }
    const e = sel[0], d = e.def, frac = e.hp / e.maxHp;
    const stats = d.damage ? `Damage ${d.damage} (${d.weapon}) · Range ${d.range}` : '';
    const extra = e.type === 'harvester' ? `Cargo ${Math.floor(e.carry)}/${d.capacity}` : '';
    this.selinfo.innerHTML = `<b style="color:${FACTIONS[e.owner].color}">${entityName(e)}</b> <small>${FACTIONS[e.owner].name}</small>
      <div class="hpbar"><i style="width:${frac * 100}%;background:${frac > 0.6 ? '#4cd964' : frac > 0.3 ? '#f5c542' : '#ff4a3d'}"></i></div>
      <small>HP ${Math.ceil(e.hp)}/${e.maxHp} · Armor ${ARMOR_LABEL[d.armor]}<br>${[stats, extra].filter(Boolean).join(' · ')}</small>`;
  }

  updateOverlay() {
    const g = this.game, o = this.overlay;
    if (g.state !== 'playing') {
      if (!o.dataset.end) {
        o.dataset.end = g.state;
        o.className = '';
        o.innerHTML = `<div style="color:${g.state === 'won' ? '#7dff7d' : '#ff6a5a'}">${g.state === 'won' ? 'VICTORY' : 'DEFEAT'}</div><small>${g.state === 'won' ? 'All enemy structures destroyed.' : 'All of your structures were destroyed.'}</small><button id="restart">Play Again</button>`;
        o.querySelector('#restart').addEventListener('click', () => this.restart());
      }
    } else if (g.paused) {
      o.className = ''; o.dataset.paused = '1'; o.innerHTML = 'PAUSED<small>Press P to resume</small>';
    } else if (o.dataset.paused) {
      delete o.dataset.paused; o.className = 'hidden'; o.innerHTML = '';
    }
  }
}
