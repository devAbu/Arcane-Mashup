// Headless self-test + balance simulation. Usage: node tools/sim.js [runsPerMage] [verbose]
'use strict';
const D = require('../www/data.js');
const Core = require('../www/core.js');
const TXT = require('../www/strings.js');

let fails = 0;
function check(c, msg) { if (!c) { fails++; console.log('FAIL: ' + msg); } }

// ---- static data checks
check(D.FUSIONS.length === 10, '10 fusions');
const seen = {};
D.FUSIONS.forEach(f => { seen[f.a + '+' + f.b] = 1; check(TXT.fusions[f.id], 'text for fusion ' + f.id); });
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) check(D.FUSION_BY_PAIR[D.ELEMS[i] + '+' + D.ELEMS[j]], 'pair ' + D.ELEMS[i] + '+' + D.ELEMS[j] + ' has a fusion');
D.ELEMS.forEach(e => check(TXT.spells[e] && TXT.elements[e], 'text for ' + e));
D.PASSIVES.forEach(p => check(TXT.passives[p], 'text for passive ' + p));
D.PERM_ORDER.forEach(p => check(TXT.perm[p], 'text for perm ' + p));
Object.keys(D.MAGES).forEach(m => check(TXT.mages[m], 'text for mage ' + m));
Object.keys(D.BOSSES).forEach(b => check(TXT.bosses[b], 'text for boss ' + b));

// ---- every element pair in the slots activates its fusion and runs without NaN
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
  const s = Core.create({ mage: 'fire', seed: 7 + i * 5 + j });
  s.slots[0] = { el: D.ELEMS[i], lvl: 3, cd: 0 };
  s.slots[1] = { el: D.ELEMS[j], lvl: 2, cd: 0 };
  Core.refreshFusions(s);
  const f = D.FUSION_BY_PAIR[D.ELEMS[i] + '+' + D.ELEMS[j]];
  check(s.fus.length === 1 && s.fus[0].f.id === f.id, 'fusion active for ' + f.id);
  check(s.newFus.indexOf(f.idx) >= 0, 'fusion queued as new ' + f.id);
  // scatter enemies and run 40s; the fusion must actually deal damage
  let dealt = 0;
  for (let k = 0; k < 40; k++) {
    const a = k * 0.7, r = 40 + (k % 7) * 18;
    const e = s.E[k]; e.on = true; e.id = 1000 + k; e.kind = 'grunt'; e.boss = false; e.x = s.px + Math.cos(a) * r; e.y = s.py + Math.sin(a) * r;
    e.hp = e.maxhp = 100000; e.spd = 0; e.r = 9; e.dmg = 0; e.xp = 1;
  }
  for (let t = 0; t < 40 * 30; t++) { Core.step(s, 1 / 30, 0, 0); if (s.pending) s.pending = 0; }
  for (let k = 0; k < 40; k++) dealt += s.E[k].maxhp - s.E[k].hp;
  // only count fusion-caused damage by disabling base spells' contribution is hard; just assert something happened and finite
  check(isFinite(dealt) && dealt > 0, 'damage dealt in pair ' + f.id + ' (' + Math.round(dealt) + ')');
  check(isFinite(s.px) && isFinite(s.py), 'finite player pos ' + f.id);
}

// fusion alone damage check: a fusion with no base-spell help (slots with cooldown parked)
D.FUSIONS.forEach(f => {
  const s = Core.create({ mage: 'fire', seed: 99 });
  s.slots[0] = { el: f.a, lvl: 1, cd: 1e9 }; s.slots[1] = { el: f.b, lvl: 1, cd: 1e9 }; Core.refreshFusions(s);
  for (let k = 0; k < 30; k++) {
    const a = k * 0.9, r = 35 + (k % 5) * 20, e = s.E[k];
    e.on = true; e.id = 2000 + k; e.kind = 'grunt'; e.boss = false; e.x = s.px + Math.cos(a) * r; e.y = s.py + Math.sin(a) * r; e.hp = e.maxhp = 1e6; e.spd = 0; e.r = 9; e.dmg = 0;
  }
  for (let t = 0; t < 30 * 30; t++) Core.step(s, 1 / 30, 0, 0);
  let dealt = 0; for (let k = 0; k < 30; k++) dealt += s.E[k].maxhp - s.E[k].hp;
  check(dealt > 50, 'fusion ' + f.id + ' works on its own (' + Math.round(dealt) + ')');
});

// ---- card offering: fusion-completing spells are favoured but not guaranteed
(function () {
  let withNew = 0, total = 0, undisc = 0;
  for (let n = 0; n < 600; n++) {
    const s = Core.create({ mage: 'fire', seed: n });
    s.slots[1] = { el: 'ice', lvl: 1, cd: 0 }; s.slots[2] = { el: 'earth', lvl: 2, cd: 0 }; Core.refreshFusions(s);
    const o = Core.offer(s, { steamburst: true, glacier: true });
    check(o.length === 3, 'offers 3 cards');
    total++; if (o.some(c => c.t === 'new')) withNew++;
    if (o.some(c => c.t === 'new' && c.und > 0)) undisc++;
  }
  console.log('offer (3 spells equipped): new-spell card in ' + Math.round(100 * withNew / total) + '% of offers; one with an undiscovered fusion in ' + Math.round(100 * undisc / total) + '%');
  check(withNew / total > 0.55 && withNew / total < 0.97, 'new spell offered often but not always');
})();

// ---- bot runs
function bot(s) {
  let ax = 0, ay = 0;
  for (let i = 0; i < Core.MAXE; i++) {
    const e = s.E[i]; if (!e.on) continue;
    const dx = s.px - e.x, dy = s.py - e.y, d2 = dx * dx + dy * dy + 1;
    if (d2 < 150 * 150) { const w = 1 / d2 * (e.boss ? 3 : 1); ax += dx * w * 1000; ay += dy * w * 1000; }
  }
  const danger = Math.hypot(ax, ay);
  let bg = null, bd = 1e9;
  for (let i = 0; i < Core.MAXG; i++) {
    const g = s.G[i]; if (!g.on) continue;
    const d = Math.hypot(g.x - s.px, g.y - s.py);
    if (d < bd) { bd = d; bg = g; }
  }
  if (bg && bd < 260 && danger < 4) { const dx = bg.x - s.px, dy = bg.y - s.py; ax += dx / bd * 1.2; ay += dy / bd * 1.2; }
  const cx = 768 - s.px, cy = 768 - s.py, cd = Math.hypot(cx, cy);
  if (cd > 350) { ax += cx / cd * 0.8; ay += cy / cd * 0.8; }
  // avoid arena edges
  const m = 120;
  if (s.px < m) ax += 1; if (s.px > 1536 - m) ax -= 1; if (s.py < m) ay += 1; if (s.py > 1536 - m) ay -= 1;
  return [ax, ay];
}
function pickCard(s, cards) {
  let best = cards[0], bs = -1;
  cards.forEach(c => {
    let sc = 0;
    if (c.t === 'new') sc = 5 + c.fus; else if (c.t === 'up') sc = 3 + (c.lvl <= 3 ? 1 : 0); else if (c.t === 'heal') sc = s.hp / s.maxhp < 0.5 ? 6 : 0; else sc = 1;
    if (sc > bs) { bs = sc; best = c; }
  });
  return best;
}

const runs = parseInt(process.argv[2] || '3', 10);
const verbose = process.argv[3] === 'v';
const tStart = Date.now();
let steps = 0, worst = 0;
Object.keys(D.MAGES).forEach(mage => {
  let wins = 0, tsum = 0, lsum = 0, ksum = 0, b1 = 0;
  for (let r = 0; r < runs; r++) {
    const s = Core.create({ mage, seed: 1000 + r * 17 });
    const dt = 1 / 30;
    while (!s.over && s.t < 480) {
      if (s.pending > 0) { const cs = Core.offer(s, {}); Core.choose(s, pickCard(s, cs)); continue; }
      const m = bot(s);
      const t0 = process.hrtime.bigint();
      Core.step(s, dt, m[0], m[1]);
      const us = Number(process.hrtime.bigint() - t0) / 1000; if (us > worst) worst = us;
      steps++;
      if (!isFinite(s.px + s.py + s.hp)) { check(false, 'NaN in state'); break; }
    }
    if (s.won) wins++;
    tsum += s.t; lsum += s.level; ksum += s.kills; b1 += s.bossKills;
    if (verbose) console.log(' ', mage, 'run', r, s.won ? 'WIN' : 'dead', Math.round(s.t) + 's lvl', s.level, 'kills', s.kills, 'bosses', s.bossKills, 'fus', s.fus.length, 'slots', s.slots.filter(Boolean).map(x => x.el + x.lvl).join(','));
  }
  console.log(mage.padEnd(5), 'wins ' + wins + '/' + runs, 'avg time ' + Math.round(tsum / runs) + 's', 'avg level ' + (lsum / runs).toFixed(1), 'avg kills ' + Math.round(ksum / runs), 'avg bosses ' + (b1 / runs).toFixed(1));
});
console.log('sim: ' + steps + ' steps, avg ' + ((Date.now() - tStart) / steps).toFixed(3) + ' ms/step, worst ' + (worst / 1000).toFixed(2) + ' ms');
if (fails) { console.log(fails + ' check(s) failed'); process.exit(1); }
console.log('all checks passed');
