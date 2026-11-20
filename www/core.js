// Arcane Mashup - game simulation (no DOM, runs in the browser and in Node for tests)
(function (root) {
  'use strict';
  const D = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('./data.js') : root.Data;

  const MAXE = 170, MAXP = 200, MAXG = 260, MAXZ = 48, MAXB = 28, MAXEB = 90, MAXEV = 320;
  const CELL = 64, GN = Math.ceil(D.ARENA / CELL);
  const A = D.ARENA;
  const EB = D.ELEM_BIT;
  const ELI = { fire: 0, ice: 1, lightning: 2, earth: 3, wind: 4 };

  // event kinds (consumed by the renderer / audio)
  const K = { CAST: 1, KILL: 2, BOOM: 3, GEM: 4, LEVEL: 5, FUSION: 6, BOSS: 7, BOSSDIE: 8, BLINK: 9, DEAD: 10, WIN: 11, HURT: 12, HEAL: 13, BULLET: 14, ZAP: 15, SWARM: 16 };
  // zone kinds
  const Z = { TORNADO: 1, POOL: 2, RING: 3, PILLAR: 4, ORB: 5 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mk(n, f) { const a = []; for (let i = 0; i < n; i++) a.push(f(i)); return a; }

  const lvlDmg = function (L) { return 1 + 0.38 * (L - 1); };
  const lvlCd = function (L) { return 1 - 0.06 * (L - 1); };
  const lvlCount = function (L) { return L >= 5 ? 3 : L >= 3 ? 2 : 1; };
  const xpNeed = function (level) { return Math.round(5 + level * 3.4 + Math.pow(level, 1.5) * 0.7); };

  // reusable effect descriptors (avoid allocations in the hot path)
  function fx() { return { burn: 0, burnT: 0, slow: 0, slowT: 0, freeze: 0, knock: 0 }; }
  const FX_NONE = fx();
  const FX_SPLASH = fx(), FX_STEAM = fx(), FX_TORN = fx(), FX_MAGMA = fx(), FX_GLACIER = fx(), FX_THUNDER = fx(), FX_BLIZZ = fx();
  FX_SPLASH.burn = 3; FX_SPLASH.burnT = 1.5;
  FX_STEAM.knock = D.FUSIONS[2].knock;
  FX_TORN.burn = 4; FX_TORN.burnT = 1.5;
  FX_MAGMA.burn = 5; FX_MAGMA.burnT = 1.2;
  FX_GLACIER.slow = 0.5; FX_GLACIER.slowT = 2; FX_GLACIER.knock = 10;
  FX_THUNDER.freeze = 0.45;
  FX_BLIZZ.slow = 0.38; FX_BLIZZ.slowT = 0.8;

  // ---------------------------------------------------------------- create
  function create(o) {
    o = o || {};
    const s = {};
    s.rand = mulberry32((o.seed !== undefined ? o.seed : (Math.random() * 4294967296)) >>> 0);
    const mage = D.MAGES[o.mage || 'fire'];
    const perm = o.perm || {};
    const pv = function (id) { return perm[id] || 0; };
    s.mage = o.mage || 'fire';
    s.t = 0; s.over = false; s.won = false; s.revived = false;
    s.px = A / 2; s.py = A / 2; s.face = 0;
    s.maxhp = D.PLAYER.hp + pv('vit') * 10 + (mage.perk.hp || 0);
    s.hp = s.maxhp; s.iframes = 0;
    s.speedMul = 1 + pv('swift') * 0.03 + (mage.perk.speed || 0);
    s.pickupMul = 1 + pv('magnet') * 0.1 + (mage.perk.magnet || 0);
    s.dmgMul = 1 + pv('power') * 0.05 + (mage.perk.dmg || 0);
    s.xpMul = 1 + pv('wisdom') * 0.06;
    s.freezeMul = 1 + (mage.perk.freeze || 0);
    s.cdMul = 1;
    s.pas = { hp: 0, speed: 0, magnet: 0, haste: 0, might: 0 };
    s.level = 1; s.xp = 0; s.need = xpNeed(1); s.pending = 0;
    s.slots = [null, null, null, null];
    s.slots[0] = { el: mage.start, lvl: 1, cd: 0.4 };
    s.fus = []; s.newFus = []; s.fusEver = {};
    s.kills = 0; s.bossKills = 0;
    s.nextId = 1; s.stamp = 1;
    s.spawnT = 0.6; s.swarmT = 45; s.bossIdx = 0; s.boss = null;
    s.warnBoss = 0;
    s.shake = 0;

    s.E = mk(MAXE, function () { return { on: false, id: 0, kind: 'grunt', boss: false, bid: '', x: 0, y: 0, hp: 1, maxhp: 1, spd: 0, r: 8, dmg: 0, xp: 1, burnT: 0, burnDps: 0, slowT: 0, slowMul: 1, freezeT: 0, kx: 0, ky: 0, flash: 0, t1: 0, t2: 0, t3: 0, mark: 0, ionT: -9, ringId: 0, seed: 0 }; });
    s.P = mk(MAXP, function () { return { on: false, x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 0, mask: 0, pierce: 0, life: 0, splash: 0, burn: 0, burnT: 0, slow: 0, slowT: 0, knock: 0, kind: 0, nh: 0, hits: new Int32Array(8) }; });
    s.G = mk(MAXG, function () { return { on: false, x: 0, y: 0, v: 1, fly: false }; });
    s.Zs = mk(MAXZ, function () { return { on: false, kind: 0, x: 0, y: 0, r: 10, life: 0, maxlife: 1, t: 0, tick: 0.3, dmg: 0, mask: 0, vx: 0, vy: 0, tx: 0, ty: 0, t2: 0, delay: 0, state: 0, fxi: 0, n: 0, id: 0, ang: 0 }; });
    s.B = mk(MAXB, function () { return { on: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0, max: 0.2, el: 0 }; });
    s.EBu = mk(MAXEB, function () { return { on: false, x: 0, y: 0, vx: 0, vy: 0, r: 6, dmg: 0, life: 0, el: 0 }; });
    s.orbN = 0; s.orbX = new Float32Array(8); s.orbY = new Float32Array(8);
    s.ev = { n: 0, k: new Uint8Array(MAXEV), x: new Float32Array(MAXEV), y: new Float32Array(MAXEV), a: new Float32Array(MAXEV), b: new Float32Array(MAXEV) };
    s.head = new Int16Array(GN * GN); s.next = new Int16Array(MAXE);
    s.qb = new Int16Array(MAXE); s.qa = new Int16Array(MAXE);
    refreshFusions(s);
    return s;
  }

  function ev(s, k, x, y, a, b) {
    const e = s.ev; if (e.n >= MAXEV) return;
    const i = e.n++; e.k[i] = k; e.x[i] = x; e.y[i] = y; e.a[i] = a || 0; e.b[i] = b || 0;
  }

  // ---------------------------------------------------------------- spatial grid
  function buildGrid(s) {
    s.head.fill(-1);
    for (let i = 0; i < MAXE; i++) {
      const e = s.E[i]; if (!e.on) continue;
      let cx = (e.x / CELL) | 0, cy = (e.y / CELL) | 0;
      if (cx < 0) cx = 0; else if (cx >= GN) cx = GN - 1;
      if (cy < 0) cy = 0; else if (cy >= GN) cy = GN - 1;
      const c = cy * GN + cx;
      s.next[i] = s.head[c]; s.head[c] = i;
    }
  }
  function query(s, x, y, r, buf) {
    let x0 = ((x - r) / CELL) | 0, x1 = ((x + r) / CELL) | 0, y0 = ((y - r) / CELL) | 0, y1 = ((y + r) / CELL) | 0;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 >= GN) x1 = GN - 1; if (y1 >= GN) y1 = GN - 1;
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      let i = s.head[cy * GN + cx];
      while (i >= 0) { buf[n++] = i; i = s.next[i]; }
    }
    return n;
  }

  // ---------------------------------------------------------------- damage
  function hurt(s, e, dmg, mask) {
    if (!e.on) return;
    let m = 1;
    if (e.boss) {
      const b = D.BOSSES[e.bid];
      if (mask & EB[b.weak]) m = D.WEAK_MUL; else if (mask & EB[b.el]) m = D.RESIST_MUL;
    }
    e.hp -= dmg * m * s.dmgMul;
    e.flash = 0.09;
    if (e.hp <= 0) kill(s, e);
  }
  function applyFx(s, e, f, ox, oy) {
    if (f.burn) { if (f.burn > e.burnDps) e.burnDps = f.burn; if (f.burnT > e.burnT) e.burnT = f.burnT; }
    if (f.slow) { const m = 1 - f.slow; if (e.slowT <= 0 || m < e.slowMul) e.slowMul = m; if (f.slowT > e.slowT) e.slowT = f.slowT; }
    if (f.freeze) { const t = f.freeze * (e.boss ? 0.25 : 1) * s.freezeMul; if (t > e.freezeT) e.freezeT = t; }
    if (f.knock) {
      let dx = e.x - ox, dy = e.y - oy; const d = Math.hypot(dx, dy) || 1;
      const k = f.knock * 6 * (e.boss ? 0.12 : 1) / d;
      e.kx += dx * k; e.ky += dy * k;
    }
  }
  function areaHurt(s, x, y, r, dmg, mask, f) {
    const n = query(s, x, y, r + 20, s.qa); let c = 0;
    for (let k = 0; k < n; k++) {
      const e = s.E[s.qa[k]]; if (!e.on) continue;
      const dx = e.x - x, dy = e.y - y, rr = r + e.r;
      if (dx * dx + dy * dy <= rr * rr) { hurt(s, e, dmg, mask); if (e.on || f.knock) applyFx(s, e, f, x, y); c++; }
    }
    return c;
  }
  function hurtPlayer(s, dmg) {
    if (s.over || s.iframes > 0) return;
    s.hp -= dmg; s.iframes = D.PLAYER.iframes; s.shake = 0.18;
    ev(s, K.HURT, s.px, s.py, dmg);
    if (s.hp <= 0) { s.hp = 0; s.over = true; s.won = false; ev(s, K.DEAD, s.px, s.py); }
  }
  function dropGem(s, x, y, v) {
    for (let i = 0; i < MAXG; i++) {
      const g = s.G[i];
      if (!g.on) { g.on = true; g.x = x; g.y = y; g.v = v; g.fly = false; return; }
    }
    addXp(s, v);
  }
  function addXp(s, v) {
    s.xp += v * s.xpMul;
    while (s.xp >= s.need) {
      s.xp -= s.need; s.level++; s.need = xpNeed(s.level); s.pending++;
      s.hp = Math.min(s.maxhp, s.hp + s.maxhp * 0.08);
      ev(s, K.LEVEL, s.px, s.py, s.level);
    }
  }
  function kill(s, e) {
    e.on = false; s.kills++;
    ev(s, K.KILL, e.x, e.y, e.boss ? 1 : 0, e.r);
    if (e.boss) {
      s.bossKills++; s.boss = null;
      for (let i = 0; i < 8; i++) dropGem(s, e.x + (s.rand() - 0.5) * 60, e.y + (s.rand() - 0.5) * 60, 6);
      s.hp = Math.min(s.maxhp, s.hp + s.maxhp * 0.3);
      ev(s, K.BOSSDIE, e.x, e.y, ELI[D.BOSSES[e.bid].el]);
      for (let i = 0; i < MAXEB; i++) s.EBu[i].on = false;
      if (s.bossKills >= D.BOSS_ORDER.length && !s.over) { s.over = true; s.won = true; ev(s, K.WIN, s.px, s.py); }
    } else dropGem(s, e.x, e.y, e.xp);
  }

  // ---------------------------------------------------------------- fusions
  function refreshFusions(s) {
    const keep = {};
    s.fus.forEach(function (fi) { keep[fi.f.id] = fi; });
    const out = [];
    for (let i = 0; i < D.SLOTS; i++) for (let j = i + 1; j < D.SLOTS; j++) {
      const a = s.slots[i], b = s.slots[j];
      if (!a || !b || a.el === b.el) continue;
      const f = D.FUSION_BY_PAIR[a.el + '+' + b.el];
      if (!f) continue;
      let fi = keep[f.id];
      if (!fi) {
        fi = { f: f, fl: 1, fs: 1, t: 1.0, ang: 0 };
        if (!s.fusEver[f.id]) { s.fusEver[f.id] = true; s.newFus.push(f.idx); ev(s, K.FUSION, s.px, s.py, f.idx); }
      }
      fi.fl = (a.lvl + b.lvl) / 2; fi.fs = 1 + 0.3 * (fi.fl - 1);
      out.push(fi);
    }
    s.fus = out;
  }

  function nearest(s, x, y, maxd, skipMark) {
    let best = null, bd = maxd * maxd;
    for (let i = 0; i < MAXE; i++) {
      const e = s.E[i]; if (!e.on) continue;
      if (skipMark && e.mark === skipMark) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function randomEnemy(s, x, y, maxd) {
    let pick = null, cnt = 0; const md = maxd * maxd;
    for (let i = 0; i < MAXE; i++) {
      const e = s.E[i]; if (!e.on || e.mark === s.stamp) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy > md) continue;
      cnt++; if (s.rand() * cnt < 1) pick = e;
    }
    return pick;
  }
  function beam(s, x1, y1, x2, y2, life, el) {
    for (let i = 0; i < MAXB; i++) {
      const b = s.B[i];
      if (!b.on) { b.on = true; b.x1 = x1; b.y1 = y1; b.x2 = x2; b.y2 = y2; b.life = life; b.max = life; b.el = el; return; }
    }
  }
  function zone(s, kind, x, y, r, life, dmg, mask) {
    for (let i = 0; i < MAXZ; i++) {
      const z = s.Zs[i];
      if (!z.on) {
        z.on = true; z.kind = kind; z.x = x; z.y = y; z.r = r; z.life = life; z.maxlife = life; z.t = 0; z.tick = 0.3;
        z.dmg = dmg; z.mask = mask; z.vx = 0; z.vy = 0; z.tx = x; z.ty = y; z.t2 = 0; z.delay = 0; z.state = 0; z.fxi = 0; z.n = 0; z.id = s.nextId++; z.ang = s.rand() * 6.283;
        return z;
      }
    }
    return null;
  }
  function proj(s, x, y, ang, speed, r, dmg, mask, pierce, life, kind) {
    for (let i = 0; i < MAXP; i++) {
      const p = s.P[i];
      if (!p.on) {
        p.on = true; p.x = x; p.y = y; p.vx = Math.cos(ang) * speed; p.vy = Math.sin(ang) * speed; p.r = r; p.dmg = dmg; p.mask = mask;
        p.pierce = pierce; p.life = life; p.splash = 0; p.burn = 0; p.burnT = 0; p.slow = 0; p.slowT = 0; p.knock = 0; p.kind = kind; p.nh = 0;
        return p;
      }
    }
    return null;
  }

  function castSpell(s, sl) {
    const S = D.SPELLS[sl.el], L = sl.lvl, ei = ELI[sl.el];
    const tgt = nearest(s, s.px, s.py, S.range);
    if (!tgt) return false;
    const n = lvlCount(L), dmg = S.dmg * lvlDmg(L), mask = EB[sl.el];
    const base = Math.atan2(tgt.y - s.py, tgt.x - s.px);
    ev(s, K.CAST, s.px, s.py, ei);
    if (sl.el === 'lightning') {
      const jumps = S.jumps + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0);
      s.stamp++;
      let start = tgt;
      for (let b = 0; b < n; b++) {
        if (!start) break;
        let cur = start, px = s.px, py = s.py;
        for (let j = 0; j <= jumps && cur; j++) {
          cur.mark = s.stamp;
          beam(s, px, py, cur.x, cur.y, 0.16, 2);
          px = cur.x; py = cur.y;
          const cx = cur.x, cy = cur.y;
          hurt(s, cur, dmg, mask);
          cur = nearest(s, cx, cy, S.jr, s.stamp);
        }
        start = nearest(s, s.px, s.py, S.range, s.stamp);
      }
      return true;
    }
    for (let i = 0; i < n; i++) {
      const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 0.2;
      const a = base + spread;
      const p = proj(s, s.px, s.py, a, S.speed, S.r, dmg, mask, S.pierce || 0, S.range / S.speed + 0.15, ei);
      if (!p) continue;
      if (sl.el === 'fire') { p.splash = S.splash; p.burn = S.burn * lvlDmg(L); p.burnT = S.burnT; }
      else if (sl.el === 'ice') { p.slow = S.slow; p.slowT = S.slowT; }
      else p.knock = S.knock;
    }
    return true;
  }

  function sparkZap(s, x, y, e, el) { beam(s, x, y, e.x, e.y, 0.14, el); }

  function updateFusion(s, fi, dt) {
    const f = fi.f, fs = fi.fs, id = f.id;
    if (id === 'blizzard') {
      fi.t -= dt;
      if (fi.t <= 0) {
        fi.t = f.tick;
        areaHurt(s, s.px, s.py, f.r * (1 + 0.12 * (fs - 1)), f.dmg * fs, f.mask, FX_BLIZZ);
      }
      return;
    }
    if (id === 'ionorbit') {
      const n = Math.min(6, f.n + Math.floor(fs - 1));
      fi.ang += f.spin * dt;
      s.orbN = n;
      for (let i = 0; i < n; i++) {
        const a = fi.ang + i * 6.283 / n;
        const ox = s.px + Math.cos(a) * f.orbitR, oy = s.py + Math.sin(a) * f.orbitR;
        s.orbX[i] = ox; s.orbY[i] = oy;
        const c = query(s, ox, oy, f.r + 20, s.qa);
        for (let k = 0; k < c; k++) {
          const e = s.E[s.qa[k]]; if (!e.on || s.t - e.ionT < f.hitcd) continue;
          const dx = e.x - ox, dy = e.y - oy, rr = f.r + e.r;
          if (dx * dx + dy * dy <= rr * rr) { e.ionT = s.t; hurt(s, e, f.dmg * fs, f.mask); }
        }
      }
      return;
    }
    fi.t -= dt;
    if (fi.t > 0) return;
    let fired = false;
    if (id === 'firestorm') {
      const tg = nearest(s, s.px, s.py, 330);
      if (tg) {
        const z = zone(s, Z.TORNADO, tg.x, tg.y, f.r * (1 + 0.1 * (fs - 1)), f.dur + 0.4 * (fs - 1), f.dmg * fs, f.mask);
        if (z) { z.tick = f.tick; z.n = 1; fired = true; }
      }
    } else if (id === 'frozenchain') {
      const tg = nearest(s, s.px, s.py, 270);
      if (tg) {
        const jumps = f.jumps + Math.floor(fs - 1);
        s.stamp++; let cur = tg, px = s.px, py = s.py;
        FX_THUNDER.freeze = f.freeze;
        for (let j = 0; j <= jumps && cur; j++) {
          cur.mark = s.stamp; beam(s, px, py, cur.x, cur.y, 0.2, 1);
          px = cur.x; py = cur.y; const cx = cur.x, cy = cur.y;
          hurt(s, cur, f.dmg * fs, f.mask);
          if (cur.on) applyFx(s, cur, FX_THUNDER, cx, cy);
          cur = nearest(s, cx, cy, f.range, s.stamp);
        }
        FX_THUNDER.freeze = 0.45; fired = true;
      }
    } else if (id === 'steamburst') {
      if (nearest(s, s.px, s.py, f.r + 60)) {
        const z = zone(s, Z.RING, s.px, s.py, f.r * (1 + 0.08 * (fs - 1)), 0.4, f.dmg * fs, f.mask);
        if (z) { z.ang = 0; fired = true; ev(s, K.BOOM, s.px, s.py, 0, 40); }
      }
    } else if (id === 'plasmaorb') {
      const tg = nearest(s, s.px, s.py, 300);
      if (tg) {
        const z = zone(s, Z.ORB, s.px, s.py, 14, f.life, f.dmg * fs, f.mask);
        if (z) {
          const a = Math.atan2(tg.y - s.py, tg.x - s.px);
          z.vx = Math.cos(a) * f.speed; z.vy = Math.sin(a) * f.speed; z.tick = f.tick; z.n = 3 + Math.floor(fs - 1); fired = true;
        }
      }
    } else if (id === 'magma') {
      s.stamp++;
      for (let i = 0; i < f.n + Math.floor(fs - 1); i++) {
        const e = randomEnemy(s, s.px, s.py, f.range);
        if (!e) break;
        e.mark = s.stamp;
        const z = zone(s, Z.POOL, e.x, e.y, f.r * (1 + 0.08 * (fs - 1)), f.life, f.dmg * fs, f.mask);
        if (z) { z.tick = f.tick; fired = true; }
      }
    } else if (id === 'glacier') {
      const tg = nearest(s, s.px, s.py, 280);
      if (tg) {
        const a = Math.atan2(tg.y - s.py, tg.x - s.px), cs = Math.cos(a), sn = Math.sin(a);
        const n = f.n + Math.floor(fs - 1);
        for (let i = 0; i < n; i++) {
          const d = 28 + f.gap * i;
          const z = zone(s, Z.PILLAR, s.px + cs * d, s.py + sn * d, f.r, 0.5 + f.delay * i, f.dmg * fs, f.mask);
          if (z) { z.delay = 0.12 + f.delay * i; z.fxi = 1; }
        }
        fired = true;
      }
    } else if (id === 'thunderpillar') {
      s.stamp++;
      for (let i = 0; i < f.n + Math.floor(fs - 1); i++) {
        const e = randomEnemy(s, s.px, s.py, f.range);
        if (!e) break;
        e.mark = s.stamp;
        const z = zone(s, Z.PILLAR, e.x, e.y, f.r, f.delay + 0.35, f.dmg * fs, f.mask);
        if (z) { z.delay = f.delay; z.fxi = 0; fired = true; }
      }
    } else if (id === 'sandstorm') {
      if (nearest(s, s.px, s.py, 200)) {
        const n = f.n + Math.floor(2 * (fs - 1)), off = s.rand() * 6.283;
        for (let i = 0; i < n; i++) {
          const p = proj(s, s.px, s.py, off + i * 6.283 / n, f.speed, f.r, f.dmg * fs, f.mask, 3, f.life, 5);
          if (p) p.knock = 12;
        }
        fired = true; ev(s, K.CAST, s.px, s.py, 3);
      }
    }
    fi.t = fired ? f.cd * s.cdMul : 0.25;
    if (fired) ev(s, K.ZAP, s.px, s.py, f.idx);
  }

  // ---------------------------------------------------------------- zones / projectiles
  function updateZones(s, dt) {
    for (let i = 0; i < MAXZ; i++) {
      const z = s.Zs[i]; if (!z.on) continue;
      z.life -= dt;
      if (z.life <= 0) { z.on = false; continue; }
      const age = z.maxlife - z.life;
      if (z.kind === Z.TORNADO || z.kind === Z.POOL) {
        if (z.kind === Z.TORNADO) {
          z.t2 -= dt;
          if (z.t2 <= 0) { z.t2 = 0.3; const tg = nearest(s, z.x, z.y, 400); if (tg) { z.tx = tg.x; z.ty = tg.y; } }
          const dx = z.tx - z.x, dy = z.ty - z.y, d = Math.hypot(dx, dy) || 1;
          if (d > 6) { z.x += dx / d * 58 * dt; z.y += dy / d * 58 * dt; }
        }
        z.t -= dt;
        if (z.t <= 0) { z.t = z.tick; areaHurt(s, z.x, z.y, z.r, z.dmg, z.mask, z.kind === Z.TORNADO ? FX_TORN : FX_MAGMA); }
      } else if (z.kind === Z.RING) {
        const prog = Math.min(1, age / 0.3), rad = z.r * prog;
        z.ang = rad; z.x = s.px; z.y = s.py;
        const n = query(s, z.x, z.y, rad + 24, s.qa);
        for (let k = 0; k < n; k++) {
          const e = s.E[s.qa[k]]; if (!e.on || e.ringId === z.id) continue;
          const dx = e.x - z.x, dy = e.y - z.y;
          if (Math.sqrt(dx * dx + dy * dy) - e.r <= rad) { e.ringId = z.id; hurt(s, e, z.dmg, z.mask); if (e.on) applyFx(s, e, FX_STEAM, z.x, z.y); }
        }
      } else if (z.kind === Z.PILLAR) {
        if (z.state === 0) {
          z.delay -= dt;
          if (z.delay <= 0) {
            z.state = 1;
            areaHurt(s, z.x, z.y, z.r, z.dmg, z.mask, z.fxi === 1 ? FX_GLACIER : FX_THUNDER);
            ev(s, K.BOOM, z.x, z.y, z.fxi === 1 ? 1 : 2, z.r);
            if (z.life > 0.25) z.life = 0.25;
          }
        }
      } else if (z.kind === Z.ORB) {
        z.x += z.vx * dt; z.y += z.vy * dt;
        z.t -= dt;
        if (z.t <= 0) {
          z.t = z.tick;
          s.stamp++; let cx = z.x, cy = z.y;
          for (let j = 0; j < z.n; j++) {
            const e = nearest(s, z.x, z.y, D.FUSIONS[3].range, s.stamp);
            if (!e) break;
            e.mark = s.stamp; sparkZap(s, z.x, z.y, e, 2); hurt(s, e, z.dmg, z.mask);
          }
          areaHurt(s, cx, cy, z.r, z.dmg * 0.8, z.mask, FX_NONE);
        }
      }
    }
  }

  function updateProjectiles(s, dt) {
    for (let i = 0; i < MAXP; i++) {
      const p = s.P[i]; if (!p.on) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x > A || p.y > A) { p.on = false; continue; }
      const n = query(s, p.x, p.y, p.r + 18, s.qb);
      for (let k = 0; k < n; k++) {
        const e = s.E[s.qb[k]]; if (!e.on) continue;
        const dx = e.x - p.x, dy = e.y - p.y, rr = p.r + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        let seen = false;
        for (let h = 0; h < p.nh && h < 8; h++) if (p.hits[h] === e.id) { seen = true; break; }
        if (seen) continue;
        p.hits[p.nh & 7] = e.id; p.nh++;
        const ex = e.x, ey = e.y;
        hurt(s, e, p.dmg, p.mask);
        if (e.on) {
          if (p.burn) { if (p.burn > e.burnDps) e.burnDps = p.burn; if (p.burnT > e.burnT) e.burnT = p.burnT; }
          if (p.slow) { e.slowMul = 1 - p.slow; if (p.slowT > e.slowT) e.slowT = p.slowT; }
          if (p.knock) { const sp = Math.hypot(p.vx, p.vy) || 1, k2 = p.knock * 6 * (e.boss ? 0.12 : 1) / sp; e.kx += p.vx * k2; e.ky += p.vy * k2; }
        }
        if (p.splash) { areaHurt(s, ex, ey, p.splash, p.dmg * 0.55, p.mask, FX_SPLASH); ev(s, K.BOOM, ex, ey, 0, p.splash); }
        if (p.pierce <= 0) { p.on = false; break; }
        p.pierce--;
      }
    }
  }

  // ---------------------------------------------------------------- enemies
  function spawnEnemy(s, kind, x, y, bossId) {
    for (let i = 0; i < MAXE; i++) {
      const e = s.E[i];
      if (e.on) continue;
      const t = s.t, hpM = 1 + t / 100 + Math.pow(t / 280, 2), spM = 1 + Math.min(0.35, t / 900);
      let def = bossId ? D.BOSSES[bossId] : D.ENEMIES[kind];
      e.on = true; e.id = s.nextId++; e.kind = bossId ? 'boss' : kind; e.boss = !!bossId; e.bid = bossId || '';
      e.x = Math.max(8, Math.min(A - 8, x)); e.y = Math.max(8, Math.min(A - 8, y));
      e.maxhp = bossId ? def.hp : def.hp * hpM; e.hp = e.maxhp;
      e.spd = def.spd * (bossId ? 1 : spM); e.r = def.r; e.dmg = def.dmg * (bossId ? 1 : 1 + t / 600); e.xp = bossId ? 6 : def.xp;
      e.burnT = 0; e.burnDps = 0; e.slowT = 0; e.slowMul = 1; e.freezeT = 0; e.kx = 0; e.ky = 0; e.flash = 0;
      e.t1 = bossId ? 2.5 : 0; e.t2 = bossId ? 5 : 0; e.t3 = 0; e.mark = 0; e.ionT = -9; e.ringId = 0; e.seed = s.rand() * 6.283;
      return e;
    }
    return null;
  }
  function ringPos(s, dist) {
    const a = s.rand() * 6.283;
    return [s.px + Math.cos(a) * dist, s.py + Math.sin(a) * dist];
  }
  function bullet(s, x, y, ang, speed, dmg, el) {
    for (let i = 0; i < MAXEB; i++) {
      const b = s.EBu[i];
      if (!b.on) { b.on = true; b.x = x; b.y = y; b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed; b.r = 6; b.dmg = dmg; b.life = 4.5; b.el = el; return; }
    }
  }

  function bossAI(s, e, dt) {
    const hpf = e.hp / e.maxhp, ang = Math.atan2(s.py - e.y, s.px - e.x);
    if (e.bid === 'colossus') {
      e.t1 -= dt;
      if (e.t1 <= 0) {
        e.t1 = hpf < 0.5 ? 2.7 : 3.6;
        const n = hpf < 0.5 ? 14 : 10, off = s.rand() * 6.283;
        for (let i = 0; i < n; i++) bullet(s, e.x, e.y, off + i * 6.283 / n, 105, 11, 0);
        ev(s, K.BULLET, e.x, e.y, 0);
      }
      e.t2 -= dt;
      if (e.t2 <= 0) {
        e.t2 = 9;
        for (let i = 0; i < 4; i++) { const a = i * 1.571; spawnEnemy(s, 'grunt', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40); }
      }
    } else {
      e.t1 -= dt;
      if (e.t1 <= 0) {
        e.t1 = hpf < 0.5 ? 3.6 : 5;
        const p = ringPos(s, 170);
        ev(s, K.BLINK, e.x, e.y, 0); e.x = Math.max(20, Math.min(A - 20, p[0])); e.y = Math.max(20, Math.min(A - 20, p[1]));
        ev(s, K.BLINK, e.x, e.y, 1);
      }
      e.t2 -= dt;
      if (e.t2 <= 0) {
        e.t2 = hpf < 0.5 ? 1.7 : 2.5;
        const n = hpf < 0.5 ? 5 : 3;
        for (let i = 0; i < n; i++) bullet(s, e.x, e.y, ang + (i - (n - 1) / 2) * 0.24, 175, 12, 2);
        ev(s, K.BULLET, e.x, e.y, 2);
      }
    }
  }

  function updateEnemies(s, dt) {
    const px = s.px, py = s.py, pr = D.PLAYER.r;
    for (let i = 0; i < MAXE; i++) {
      const e = s.E[i]; if (!e.on) continue;
      if (e.flash > 0) e.flash -= dt;
      // damage over time
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= e.burnDps * dt * s.dmgMul * (e.boss && D.BOSSES[e.bid].el === 'fire' ? D.RESIST_MUL : 1);
        if (e.hp <= 0) { kill(s, e); continue; }
      }
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
      let mul = e.slowMul;
      if (e.freezeT > 0) { e.freezeT -= dt; mul = 0; }
      const dx = px - e.x, dy = py - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > pr + e.r - 2 || e.boss) {
        const sp = e.spd * mul * dt;
        e.x += dx / d * sp; e.y += dy / d * sp;
      }
      // knockback velocity
      if (e.kx !== 0 || e.ky !== 0) {
        e.x += e.kx * dt; e.y += e.ky * dt;
        const dec = Math.exp(-6 * dt); e.kx *= dec; e.ky *= dec;
        if (Math.abs(e.kx) < 1 && Math.abs(e.ky) < 1) { e.kx = 0; e.ky = 0; }
      }
      // light separation
      const n = query(s, e.x, e.y, e.r * 2 + 6, s.qa);
      for (let k = 0; k < n; k++) {
        const o = s.E[s.qa[k]]; if (o === e || !o.on) continue;
        const ox = e.x - o.x, oy = e.y - o.y, min = (e.r + o.r) * 0.8, dd = ox * ox + oy * oy;
        if (dd < min * min && dd > 0.01) {
          const dist = Math.sqrt(dd), push = (min - dist) * 0.5 * Math.min(1, dt * 14);
          e.x += ox / dist * push; e.y += oy / dist * push;
        }
      }
      if (e.x < 6) e.x = 6; else if (e.x > A - 6) e.x = A - 6;
      if (e.y < 6) e.y = 6; else if (e.y > A - 6) e.y = A - 6;
      if (e.boss && e.freezeT <= 0) bossAI(s, e, dt);
      // touch player
      const tx = px - e.x, ty = py - e.y, rr = pr + e.r - 2;
      if (tx * tx + ty * ty < rr * rr) hurtPlayer(s, e.dmg);
    }
  }

  function updateBullets(s, dt) {
    for (let i = 0; i < MAXEB; i++) {
      const b = s.EBu[i]; if (!b.on) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > A || b.y > A) { b.on = false; continue; }
      const dx = s.px - b.x, dy = s.py - b.y, rr = D.PLAYER.r + b.r - 2;
      if (dx * dx + dy * dy < rr * rr && s.iframes <= 0) { b.on = false; hurtPlayer(s, b.dmg); }
    }
  }

  function updateGems(s, dt) {
    const pick = D.PLAYER.pickup * s.pickupMul, pk2 = pick * pick;
    for (let i = 0; i < MAXG; i++) {
      const g = s.G[i]; if (!g.on) continue;
      const dx = s.px - g.x, dy = s.py - g.y, d2 = dx * dx + dy * dy;
      if (!g.fly && d2 < pk2) g.fly = true;
      if (g.fly) {
        const d = Math.sqrt(d2) || 1, sp = 260 + 200 * Math.max(0, 1 - d / pick);
        g.x += dx / d * sp * dt; g.y += dy / d * sp * dt;
        if (d < 12) { g.on = false; addXp(s, g.v); ev(s, K.GEM, g.x, g.y, g.v); }
      }
    }
  }

  function spawnDirector(s, dt) {
    const t = s.t;
    let alive = 0;
    for (let i = 0; i < MAXE; i++) if (s.E[i].on) alive++;
    // boss
    if (s.bossIdx < D.BOSS_ORDER.length && !s.boss) {
      const id = D.BOSS_ORDER[s.bossIdx], def = D.BOSSES[id];
      if (t >= def.at) {
        const p = ringPos(s, 300), e = spawnEnemy(s, 'boss', p[0], p[1], id);
        if (e) { s.boss = e; s.bossIdx++; ev(s, K.BOSS, e.x, e.y, s.bossIdx - 1); }
      }
    }
    s.swarmT -= dt;
    if (s.swarmT <= 0) {
      s.swarmT = 45;
      const n = Math.min(18, 10 + Math.floor(t / 40));
      for (let i = 0; i < n; i++) {
        const a = i * 6.283 / n, e = spawnEnemy(s, 'runner', s.px + Math.cos(a) * 330, s.py + Math.sin(a) * 330);
        if (e) e.hp *= 0.8;
      }
      ev(s, K.SWARM, s.px, s.py, 0);
    }
    s.spawnT -= dt;
    if (s.spawnT <= 0) {
      let iv = Math.max(0.3, 1.25 - t * 0.0027);
      if (s.boss) iv *= 1.7;
      s.spawnT = iv;
      const cap = Math.min(MAXE - 25, 45 + t / 4);
      const grp = 1 + Math.floor(t / 80);
      for (let g = 0; g < grp && alive < cap; g++, alive++) {
        const r = s.rand();
        let kind = 'grunt';
        if (t > 25 && r < Math.min(0.32, (t - 25) / 300)) kind = 'runner';
        else if (t > 70 && r > 1 - Math.min(0.2, (t - 70) / 500)) kind = 'brute';
        const p = ringPos(s, 330 + s.rand() * 50);
        spawnEnemy(s, kind, p[0], p[1]);
      }
    }
  }

  // ---------------------------------------------------------------- main step
  function step(s, dt, ix, iy) {
    s.ev.n = 0;
    if (s.over) return;
    s.t += dt;
    if (s.iframes > 0) s.iframes -= dt;
    if (s.shake > 0) s.shake -= dt;
    // move
    const m = Math.hypot(ix, iy);
    if (m > 0.05) {
      const k = Math.min(1, m) / m, sp = D.PLAYER.speed * s.speedMul * dt;
      s.px += ix * k * sp; s.py += iy * k * sp; s.face = Math.atan2(iy, ix);
      if (s.px < 12) s.px = 12; else if (s.px > A - 12) s.px = A - 12;
      if (s.py < 12) s.py = 12; else if (s.py > A - 12) s.py = A - 12;
    }
    buildGrid(s);
    for (let i = 0; i < D.SLOTS; i++) {
      const sl = s.slots[i]; if (!sl) continue;
      sl.cd -= dt;
      if (sl.cd <= 0) {
        const ok = castSpell(s, sl);
        sl.cd = ok ? D.SPELLS[sl.el].cd * lvlCd(sl.lvl) * s.cdMul : 0.12;
      }
    }
    s.orbN = 0;
    for (let i = 0; i < s.fus.length; i++) updateFusion(s, s.fus[i], dt);
    updateProjectiles(s, dt);
    updateZones(s, dt);
    updateEnemies(s, dt);
    updateBullets(s, dt);
    updateGems(s, dt);
    for (let i = 0; i < MAXB; i++) { const b = s.B[i]; if (b.on) { b.life -= dt; if (b.life <= 0) b.on = false; } }
    spawnDirector(s, dt);
  }

  // ---------------------------------------------------------------- level-up cards
  // discovered: object {fusionId: true} from the save, used to favour undiscovered fusions
  function offer(s, discovered) {
    discovered = discovered || {};
    const cards = [];
    const eq = s.slots.filter(Boolean);
    const free = D.SLOTS - eq.length;
    if (free > 0) {
      D.ELEMS.forEach(function (el) {
        if (eq.some(function (x) { return x.el === el; })) return;
        let nf = 0, und = 0, hint = null;
        eq.forEach(function (x) {
          const f = D.FUSION_BY_PAIR[el + '+' + x.el]; if (!f) return;
          nf++; if (!discovered[f.id]) { und++; }
          if (!hint) hint = f;
        });
        cards.push({ t: 'new', el: el, w: 0.4 + 0.2 * nf + 0.5 * und, fus: nf, und: und, hint: hint ? hint.id : null, hintKnown: hint ? !!discovered[hint.id] : true });
      });
    }
    s.slots.forEach(function (sl, i) {
      if (!sl || sl.lvl >= D.MAX_SPELL_LVL) return;
      let nf = 0; eq.forEach(function (x) { if (x.el !== sl.el) nf++; });
      cards.push({ t: 'up', slot: i, el: sl.el, lvl: sl.lvl + 1, w: 1.0 + 0.15 * nf });
    });
    D.PASSIVES.forEach(function (id) { cards.push({ t: 'pas', id: id, w: 0.55 }); });
    const hpf = s.hp / s.maxhp;
    if (hpf < 0.7) cards.push({ t: 'heal', w: hpf < 0.4 ? 1.3 : 0.5 });

    const out = [];
    for (let n = 0; n < 3 && cards.length; n++) {
      let tot = 0; cards.forEach(function (c) { tot += c.w; });
      let r = s.rand() * tot, pick = 0;
      for (let i = 0; i < cards.length; i++) { r -= cards[i].w; if (r <= 0) { pick = i; break; } }
      out.push(cards.splice(pick, 1)[0]);
    }
    // never leave the player stuck with one spell: make sure a new spell shows up early
    if (free > 0 && !out.some(function (c) { return c.t === 'new'; }) && out.length) {
      const news = cards.filter(function (c) { return c.t === 'new'; });
      if (news.length && (eq.length <= 1 || s.rand() < 0.25)) out[out.length - 1] = news[Math.floor(s.rand() * news.length)];
    }
    return out;
  }

  function choose(s, c) {
    if (c.t === 'new') {
      for (let i = 0; i < D.SLOTS; i++) if (!s.slots[i]) { s.slots[i] = { el: c.el, lvl: 1, cd: 0.2 }; break; }
      refreshFusions(s);
    } else if (c.t === 'up') {
      const sl = s.slots[c.slot]; if (sl && sl.lvl < D.MAX_SPELL_LVL) sl.lvl++;
      refreshFusions(s);
    } else if (c.t === 'pas') {
      s.pas[c.id]++;
      if (c.id === 'hp') { s.maxhp += 20; s.hp = Math.min(s.maxhp, s.hp + 20); }
      else if (c.id === 'speed') s.speedMul += 0.08;
      else if (c.id === 'magnet') s.pickupMul += 0.3;
      else if (c.id === 'haste') s.cdMul *= 0.92;
      else if (c.id === 'might') s.dmgMul += 0.10;
    } else if (c.t === 'heal') {
      s.hp = Math.min(s.maxhp, s.hp + s.maxhp * 0.4); ev(s, K.HEAL, s.px, s.py, 0);
    }
    if (s.pending > 0) s.pending--;
  }

  function revive(s) {
    s.over = false; s.won = false; s.revived = true;
    s.hp = Math.round(s.maxhp * 0.5); s.iframes = 2.5;
    for (let i = 0; i < MAXEB; i++) s.EBu[i].on = false;
    for (let i = 0; i < MAXE; i++) {
      const e = s.E[i]; if (!e.on) continue;
      const dx = e.x - s.px, dy = e.y - s.py, d = Math.hypot(dx, dy) || 1;
      if (e.boss) { e.x += dx / d * 120; e.y += dy / d * 120; }
      else if (d < 230) { e.on = false; dropGem(s, e.x, e.y, e.xp); }
    }
    ev(s, K.BOOM, s.px, s.py, 4, 230); ev(s, K.HEAL, s.px, s.py, 1);
  }

  // base coins for a finished run (the game applies the Fortune upgrade)
  function baseCoins(s) { return Math.floor(s.t * 0.5 + s.kills * 0.3 + s.bossKills * 40 + (s.won ? 100 : 0)); }

  const Core = { create, step, offer, choose, revive, baseCoins, xpNeed, lvlDmg, lvlCd, lvlCount, K, Z, ELI, MAXE, MAXP, MAXG, MAXZ, MAXB, MAXEB, refreshFusions };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof self !== 'undefined' ? self : this);
