// Arcane Mashup - game flow, input, HUD and all screens (everything is drawn on one canvas).
(function () {
  'use strict';
  const D = Data, C = Core, T = TXT, K = C.K;
  const canvas = document.getElementById('c');
  const g = canvas.getContext('2d', { alpha: false });
  const A = D.ARENA, TAU = Math.PI * 2;

  let S = 1, W = 360, H = 640, bg = null;
  let state = 'menu';                 // menu | grimoire | upgrades | play | levelup | pause | end
  let showSettings = false;
  let run = null, cards = [], banner = null, toastMsg = null, endInfo = null, endDelay = 0;
  let clock = 0, last = 0, movedT = 0, pickHintDone = false;
  let buttons = [];
  const ptr = { down: false, id: -1, x: 0, y: 0, sx: 0, sy: 0, moved: false, btn: null };
  const joy = { active: false, id: -1, bx: 0, by: 0, x: 0, y: 0, ix: 0, iy: 0 };
  const scroll = { y: 0, start: 0, max: 0 };

  // ---------------------------------------------------------------- setup
  function resize() {
    const cw = window.innerWidth, ch = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    S = canvas.width / 360; W = 360; H = canvas.height / S;
    Gfx.resize(S, W, H);
    buildBackdrop();
  }
  function buildBackdrop() {
    bg = document.createElement('canvas'); bg.width = canvas.width; bg.height = canvas.height;
    const b = bg.getContext('2d'); b.scale(S, S);
    const gr = b.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0b0a1c'); gr.addColorStop(0.55, '#1b1344'); gr.addColorStop(1, '#2b1a5a');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    let seed = 99; const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 70; i++) { b.fillStyle = 'rgba(255,255,255,' + (0.15 + rnd() * 0.5) + ')'; b.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.4, 1 + rnd() * 1.4); }
  }

  // ---------------------------------------------------------------- drawing helpers
  const fonts = {};
  function font(size, bold) { const k = size * 2 + (bold ? 1 : 0); return fonts[k] || (fonts[k] = (bold ? 'bold ' : '') + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'); }
  function rrect(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }
  function txt(s, x, y, size, color, align, bold) {
    g.font = font(size, bold); g.fillStyle = color || '#fff'; g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillText(s, x, y);
  }
  function txtO(s, x, y, size, color, align, bold) {
    g.font = font(size, bold); g.textAlign = align || 'left'; g.textBaseline = 'middle';
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineJoin = 'round'; g.strokeText(s, x, y);
    g.fillStyle = color || '#fff'; g.fillText(s, x, y);
  }
  const wrapCache = {};
  function wrap(s, maxW, size) {
    const key = s + '|' + maxW + '|' + size;
    if (wrapCache[key]) return wrapCache[key];
    g.font = font(size, false);
    const words = s.split(' '), lines = []; let cur = '';
    words.forEach(function (w) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return (wrapCache[key] = lines);
  }
  function panel(x, y, w, h, fill, stroke, r) {
    rrect(x, y, w, h, r || 12); g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.6; g.stroke(); }
  }
  function btn(id, x, y, w, h, label, fn, o) {
    o = o || {};
    buttons.push({ id: id, x: x, y: y, w: w, h: h, fn: fn, disabled: !!o.disabled });
    const pressed = ptr.down && ptr.btn && ptr.btn.id === id && !ptr.moved;
    g.save();
    if (pressed) { g.translate(x + w / 2, y + h / 2); g.scale(0.97, 0.97); g.translate(-(x + w / 2), -(y + h / 2)); }
    panel(x, y + 3, w, h, 'rgba(0,0,0,0.4)', null, 13);
    panel(x, y, w, h, o.disabled ? '#3b3957' : (o.color || '#6a4cff'), 'rgba(255,255,255,0.35)', 13);
    if (!o.disabled) { rrect(x + 2, y + 2, w - 4, h * 0.45, 11); g.fillStyle = 'rgba(255,255,255,0.16)'; g.fill(); }
    if (o.sub) { txt(label, x + w / 2, y + h * 0.38, o.size || 17, o.disabled ? '#9a98b4' : '#fff', 'center', true); txt(o.sub, x + w / 2, y + h * 0.74, 11, o.disabled ? '#85839f' : 'rgba(255,255,255,0.85)', 'center'); }
    else txt(label, x + w / 2, y + h / 2 + 1, o.size || 17, o.disabled ? '#9a98b4' : '#fff', 'center', true);
    g.restore();
  }
  function hit(x, y) {
    for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; }
    return null;
  }
  function icon(el, x, y, size) { g.drawImage(Gfx.spr.icon[C.ELI[el]], x - size / 2, y - size / 2, size, size); }
  function coinIcon(x, y, r) {
    g.fillStyle = '#e8b52a'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = '#fff2a8'; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#fff2a8'; g.fillRect(x - r * 0.15, y - r * 0.5, r * 0.3, r);
  }
  function toast(m) { toastMsg = { text: m, t: 1.8 }; }
  function fmtTime(t) { t = Math.max(0, Math.floor(t)); const m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function adLabel(p, base) {
    const st = AdService.status(p);
    if (st.phase === 'playing') return { label: T.adPlaying + ' ' + st.left, sub: T.adSimNote, disabled: true };
    if (st.phase === 'cooldown') return { label: base, sub: T.adCooldown + ' ' + st.left + 's', disabled: true };
    return { label: base, sub: T.watchAd, disabled: false };
  }
  function drawBackdrop() { g.drawImage(bg, 0, 0, W, H); }
  function drawGear(x, y, r, col) {
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r * 0.62, 0, TAU); g.fill();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.save(); g.translate(x, y); g.rotate(a); g.fillRect(-r * 0.2, -r, r * 0.4, r * 0.55); g.restore(); }
    g.fillStyle = '#2b2455'; g.beginPath(); g.arc(x, y, r * 0.28, 0, TAU); g.fill();
  }
  function backBtn() { btn('back', 12, 12, 78, 36, T.back, back, { color: '#4a3fa0', size: 15 }); }
  function coinsBar() { panel(W - 112, 14, 100, 30, 'rgba(0,0,0,0.45)', 'rgba(255,255,255,0.25)', 15); coinIcon(W - 96, 29, 9); txt(String(Save.data.coins), W - 82, 30, 15, '#ffe9a0', 'left', true); }

  // ---------------------------------------------------------------- screens: menu
  function drawMenu() {
    drawBackdrop();
    // drifting element orbs
    for (let i = 0; i < 5; i++) {
      const gl = Gfx.spr.glow[i], x = W / 2 + Math.sin(clock * 0.5 + i * 1.7) * (110 + i * 12), y = H * 0.3 + Math.cos(clock * 0.37 + i * 2.3) * 70;
      g.globalAlpha = 0.5; g.drawImage(gl, x - 28, y - 28, 56, 56);
    }
    g.globalAlpha = 1;
    btn('gear', 12, 12, 40, 36, '', function () { showSettings = true; }, { color: '#3d3480' });
    drawGear(32, 30, 11, '#fff');
    coinsBar();
    // title
    txtO(T.title, W / 2, 82, 34, '#ffe9a0', 'center', true);
    txt(T.tagline, W / 2, 112, 13, '#c9b8ff', 'center');
    // chosen mage
    const m = Save.data.mage, md = D.MAGES[m], ms = Gfx.spr.mage[m];
    g.drawImage(Gfx.spr.glow[C.ELI[md.start]], W / 2 - 70, H * 0.285 - 70, 140, 140);
    const bob = Math.sin(clock * 2.2) * 3;
    g.drawImage(ms, W / 2 - ms.lw * 1.4, H * 0.285 - ms.lh * 1.4 + bob, ms.lw * 2.8, ms.lh * 2.8);
    txt(T.mages[m].name + ' - ' + T.mages[m].title, W / 2, H * 0.285 + 78, 16, '#fff', 'center', true);
    txt(T.mages[m].perk, W / 2, H * 0.285 + 98, 12, '#bfb4ee', 'center');
    // mage selector
    const my = H * 0.285 + 118, cw = 104;
    D.MAGE_ORDER.forEach(function (id, i) {
      const x = W / 2 - (cw * 3 + 16) / 2 + i * (cw + 8), unlocked = !!Save.data.mages[id], sel = Save.data.mage === id;
      btn('mage_' + id, x, my, cw, 62, '', function () { chooseMage(id); }, { color: sel ? '#5a46d6' : '#2f2870' });
      if (sel) { g.strokeStyle = '#ffe9a0'; g.lineWidth = 2.2; rrect(x, my, cw, 62, 13); g.stroke(); }
      const sp = Gfx.spr.mage[id];
      g.globalAlpha = unlocked ? 1 : 0.4; g.drawImage(sp, x + 4, my + 4, 34, 34); g.globalAlpha = 1;
      icon(D.MAGES[id].start, x + cw - 20, my + 20, 22);
      txt(T.mages[id].name, x + cw / 2, my + 48, 13, '#fff', 'center', true);
      if (!unlocked) { coinIcon(x + 16, my + 24, 7); txt(String(D.MAGES[id].cost), x + 26, my + 24, 12, '#ffe9a0', 'left', true); }
    });
    // actions
    const py = Math.max(my + 82, H - 214);
    btn('play', 60, py, 240, 66, T.play, startRun, { color: '#e8872a', size: 28 });
    btn('grim', 24, py + 82, 156, 52, T.grimoire, function () { enterScreen('grimoire'); }, { color: '#3f6fe0', sub: Save.discoveredCount() + ' / ' + D.FUSIONS.length, size: 16 });
    btn('upg', 188, py + 82, 148, 52, T.upgrades, function () { enterScreen('upgrades'); }, { color: '#2fa56a', size: 16 });
    if (Save.data.best.time > 0) txt(T.best + ' ' + fmtTime(Save.data.best.time) + '  -  ' + T.lvl + ' ' + Save.data.best.level, W / 2, H - 14, 12, '#a99ee0', 'center');
  }
  function chooseMage(id) {
    Snd.play('click');
    if (Save.data.mages[id]) { Save.data.mage = id; Save.save(); return; }
    if (Save.spend(D.MAGES[id].cost)) { Save.data.mages[id] = true; Save.data.mage = id; Save.save(); Snd.play('reward'); Snd.vibrate(30); }
    else { Snd.play('error'); toast(T.notEnough); }
  }

  // ---------------------------------------------------------------- screens: grimoire + upgrades
  function enterScreen(s) { state = s; scroll.y = 0; Snd.play('click'); }
  function scrollArea(top, bottom, contentH, drawFn) {
    scroll.max = Math.max(0, contentH - (bottom - top));
    if (scroll.y < 0) scroll.y = 0; if (scroll.y > scroll.max) scroll.y = scroll.max;
    g.save(); g.beginPath(); g.rect(0, top, W, bottom - top); g.clip();
    drawFn(top - scroll.y);
    g.restore();
    if (scroll.max > 0) { const th = (bottom - top) * (bottom - top) / contentH, ty = top + (bottom - top - th) * (scroll.y / scroll.max); panel(W - 6, ty, 3, th, 'rgba(255,255,255,0.35)', null, 2); }
  }
  function drawGrimoire() {
    drawBackdrop(); backBtn();
    txtO(T.grimoire, W / 2, 30, 24, '#ffe9a0', 'center', true);
    txt(T.discoveredCount + ' ' + Save.discoveredCount() + ' / ' + D.FUSIONS.length, W / 2, 62, 13, '#c9b8ff', 'center');
    const cw = 166, ch = 112;
    scrollArea(78, H - 6, 8 + Math.ceil(D.FUSIONS.length / 2) * (ch + 8), function (oy) {
      D.FUSIONS.forEach(function (f, i) {
        const x = 10 + (i % 2) * (cw + 8), y = oy + 6 + Math.floor(i / 2) * (ch + 8), known = !!Save.data.disc[f.id];
        panel(x, y, cw, ch, known ? '#2c2563' : '#1a1830', known ? Gfx.rgba(D.ELEM_COLOR[f.a], 0.9) : 'rgba(255,255,255,0.12)', 12);
        g.drawImage(known ? Gfx.spr.fusion[f.idx] : Gfx.spr.fusionGray[f.idx], x + 8, y + 8, 38, 38);
        if (known) {
          txt(T.fusions[f.id].name, x + 52, y + 20, 14, '#fff', 'left', true);
          txt(T.elements[f.a] + ' + ' + T.elements[f.b], x + 52, y + 38, 11, '#cdbfff', 'left');
          wrap(T.fusions[f.id].desc, cw - 16, 11).forEach(function (l, k) { txt(l, x + 8, y + 62 + k * 14, 11, '#e6e0ff', 'left'); });
        } else {
          txt('???', x + 52, y + 20, 15, '#8f8ca8', 'left', true);
          txt(T.undiscovered, x + 52, y + 38, 11, '#77748f', 'left');
          wrap(T.undiscoveredHint, cw - 16, 11).forEach(function (l, k) { txt(l, x + 8, y + 62 + k * 14, 11, '#77748f', 'left'); });
        }
      });
    });
  }
  function drawUpgrades() {
    drawBackdrop(); backBtn(); coinsBar();
    txtO(T.upgrades, W / 2, 72, 24, '#ffe9a0', 'center', true);
    scrollArea(92, H - 6, 8 + D.PERM_ORDER.length * 78, function (oy) {
      D.PERM_ORDER.forEach(function (id, i) {
        const p = D.PERM[id], lvl = Save.data.perm[id] || 0, y = oy + 6 + i * 78, maxed = lvl >= p.max;
        panel(10, y, W - 20, 70, '#2a2460', Gfx.rgba(p.color, 0.8), 12);
        txt(T.perm[id].name, 22, y + 18, 15, '#fff', 'left', true);
        txt(T.perm[id].desc, 22, y + 38, 11, '#cdbfff', 'left');
        for (let k = 0; k < p.max; k++) { g.fillStyle = k < lvl ? p.color : 'rgba(255,255,255,0.15)'; g.fillRect(22 + k * 11, y + 52, 8, 8); }
        const cost = D.permCost(id, lvl), can = !maxed && Save.data.coins >= cost;
        btn('perm_' + id, W - 112, y + 12, 94, 46, maxed ? T.maxed : String(cost), function () { buyPerm(id); }, { color: '#2fa56a', disabled: maxed || !can, size: 15 });
        if (!maxed) coinIcon(W - 112 + 16, y + 35, 7);
      });
    });
  }
  function buyPerm(id) {
    const p = D.PERM[id], lvl = Save.data.perm[id] || 0;
    if (lvl >= p.max) return;
    if (Save.spend(D.permCost(id, lvl))) { Save.data.perm[id] = lvl + 1; Save.save(); Snd.play('reward'); Snd.vibrate(25); } else { Snd.play('error'); toast(T.notEnough); }
  }

  // ---------------------------------------------------------------- settings panel
  function drawSettings() {
    g.fillStyle = 'rgba(4,3,12,0.78)'; g.fillRect(0, 0, W, H);
    buttons = [];
    const pw = 290, ph = 282, px = (W - pw) / 2, py = Math.max(60, (H - ph) / 2 - 20);
    panel(px, py, pw, ph, '#231d52', 'rgba(255,255,255,0.4)', 16);
    txt(T.settings, W / 2, py + 28, 20, '#ffe9a0', 'center', true);
    [['music', T.music], ['sfx', T.sfx], ['vib', T.vibration]].forEach(function (r, i) {
      const y = py + 56 + i * 52, on = Save.setting(r[0]);
      txt(r[1], px + 22, y + 20, 16, '#fff', 'left', true);
      btn('set_' + r[0], px + pw - 110, y, 88, 40, on ? T.on : T.off, function () { Snd.toggle(r[0]); }, { color: on ? '#2fa56a' : '#6a3f4f', size: 15 });
    });
    btn('setclose', px + 55, py + ph - 58, pw - 110, 42, T.close, function () { showSettings = false; Snd.play('click'); }, { color: '#4a3fa0', size: 16 });
  }

  // ---------------------------------------------------------------- run flow
  function startRun() {
    Snd.unlock(); Snd.play('click');
    run = C.create({ mage: Save.data.mage, perm: Save.data.perm });
    run.credited = 0; run.counted = false; run.doubled = false;
    Gfx.clearParticles();
    state = 'play'; banner = null; endInfo = null; endDelay = 0; movedT = 0; showSettings = false;
    joy.active = false; joy.ix = joy.iy = 0;
    Snd.setMode('play'); Snd.duck(false);
  }
  function toMenu() { state = 'menu'; run = null; Snd.setMode('menu'); Snd.play('click'); }
  function pauseGame() { if (state === 'play') { state = 'pause'; joy.active = false; joy.ix = joy.iy = 0; Snd.duck(true); Snd.play('click'); } }
  function resumeGame() { if (state === 'pause') { state = 'play'; Snd.duck(false); Snd.play('click'); } }
  function back() {
    if (showSettings) { showSettings = false; return true; }
    if (state === 'grimoire' || state === 'upgrades') { state = 'menu'; return true; }
    if (state === 'play') { pauseGame(); return true; }
    if (state === 'pause') { resumeGame(); return true; }
    if (state === 'end') { toMenu(); return true; }
    return false;
  }
  function enterLevelUp() {
    state = 'levelup'; joy.active = false; joy.ix = joy.iy = 0;
    cards = C.offer(run, Save.discovered());
    Snd.duck(true);
  }
  function pickCard(c) {
    Snd.play('card'); Snd.vibrate(20);
    C.choose(run, c); pickHintDone = true;
    handleEvents();
    if (run.pending > 0) cards = C.offer(run, Save.discovered());
    else { state = 'play'; Snd.duck(false); }
  }
  function finishRun() {
    state = 'end'; Snd.duck(false); Snd.setMode('menu'); Snd.play(run.won ? 'win' : 'dead');
    const fort = 1 + 0.08 * (Save.data.perm.fortune || 0);
    const total = Math.floor(C.baseCoins(run) * fort), add = Math.max(0, total - run.credited);
    run.credited = Math.max(run.credited, total); Save.addCoins(add);
    const prevBest = Save.data.best.time;
    Save.recordRun({ time: run.t, level: run.level, kills: run.kills, won: run.won }, !run.counted);
    run.counted = true;
    endInfo = { coins: run.credited, newBest: run.t > prevBest + 1 && prevBest > 0 };
  }
  function doRevive() {
    const r = run;
    AdService.show('revive', function () {
      if (state !== 'end' || run !== r) return;
      C.revive(run); state = 'play'; Snd.play('reward'); Snd.setMode(run.boss ? 'boss' : 'play'); Snd.vibrate(60); handleEvents();
    });
  }
  function doDouble() {
    const r = run;
    AdService.show('double', function () {
      if (state !== 'end' || run !== r || run.doubled) return;
      run.doubled = true; Save.addCoins(run.credited); endInfo.coins = run.credited * 2; run.credited *= 2; Snd.play('reward'); Snd.vibrate(40);
    });
  }
  function doReroll() {
    const r = run;
    AdService.show('reroll', function () {
      if (state !== 'levelup' || run !== r) return;
      cards = C.offer(run, Save.discovered()); Snd.play('reward');
    });
  }

  // ---------------------------------------------------------------- game events -> effects
  function handleEvents() {
    const e = run.ev, pc = Gfx;
    for (let i = 0; i < e.n; i++) {
      const x = e.x[i], y = e.y[i], a = e.a[i];
      switch (e.k[i]) {
        case K.CAST: Snd.play('cast', a); pc.burst(x, y, 2, a, 60, 0.25, 4); break;
        case K.KILL: Snd.play('kill', a === 1); if (a === 1) { pc.burst(x, y, 36, 9, 190, 0.9, 7); pc.ring(x, y, 70, 5, 0.5); Snd.vibrate(120); } else pc.burst(x, y, 7, 8, 90, 0.4, 4); break;
        case K.BOOM: Snd.play('boom', a); pc.ring(x, y, e.b[i], a === 4 ? 9 : a, 0.35); pc.burst(x, y, 6, a === 4 ? 9 : a, 100, 0.35, 4); break;
        case K.GEM: Snd.play('gem'); break;
        case K.LEVEL: Snd.play('level'); Snd.vibrate(35); pc.ring(x, y, 60, 9, 0.5); pc.burst(x, y, 14, 9, 130, 0.6, 4); break;
        case K.FUSION: onFusion(a, x, y); break;
        case K.ZAP: Snd.play('zap'); break;
        case K.HURT: Snd.play('hurt'); Snd.vibrate(28); pc.burst(x, y, 8, 6, 120, 0.4, 4); break;
        case K.HEAL: Snd.play('heal'); pc.burst(x, y, 12, 7, 90, 0.6, 4, -40); break;
        case K.BULLET: Snd.play('bullet', a); break;
        case K.BLINK: Snd.play('blink'); pc.burst(x, y, 14, a === 0 ? 8 : 2, 130, 0.45, 5); break;
        case K.SWARM: Snd.play('swarm'); showBanner(T.swarm, null, '#ff7a7a', false); break;
        case K.BOSS: Snd.play('bossSpawn'); Snd.setMode('boss'); Snd.vibrate([90, 60, 90]); showBanner(T.bossIncoming, T.bosses[D.BOSS_ORDER[a]].name, '#ff5a5a', false); break;
        case K.BOSSDIE: Snd.setMode('play'); pc.burst(x, y, 50, a, 240, 1.0, 8); pc.ring(x, y, 120, a, 0.6); showBanner(T.bossDown, null, '#ffe9a0', false); break;
        case K.DEAD: pc.burst(x, y, 30, 6, 170, 0.8, 6); endDelay = 1.1; break;
        case K.WIN: endDelay = 1.6; break;
        default: break;
      }
    }
    e.n = 0;
  }
  function onFusion(idx, x, y) {
    const f = D.FUSIONS[idx], isNew = Save.discover(f.id);
    Snd.play(isNew ? 'discover' : 'fusion'); Snd.vibrate(isNew ? [30, 40, 60] : 30);
    Gfx.ring(x, y, 90, 9, 0.6); Gfx.burst(x, y, 20, C.ELI[f.a], 150, 0.7, 5); Gfx.burst(x, y, 20, C.ELI[f.b], 150, 0.7, 5);
    if (isNew) { Save.addCoins(D.FIRST_FUSION_BONUS); showBanner(T.fusionNew, T.fusions[f.id].name + '  +' + D.FIRST_FUSION_BONUS, '#ffd86a', true, f.idx); }
    else showBanner(T.fusionActive, T.fusions[f.id].name, '#c9b8ff', false, f.idx);
  }
  function showBanner(title, sub, color, big, fusionIdx) { banner = { title: title, sub: sub, color: color, big: big, t: 0, dur: big ? 3.4 : 2.4, fi: fusionIdx === undefined ? -1 : fusionIdx }; }

  // ---------------------------------------------------------------- play: update + draw
  function updatePlay(dt) {
    C.step(run, dt, joy.ix, joy.iy);
    handleEvents();
    Gfx.updateParticles(dt);
    if (joy.active) movedT += dt;
    // projectile sparks
    const P = run.P;
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; if (!p.on || p.kind > 1 || Math.random() > 0.22) continue;
      Gfx.emit(p.x, p.y, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.3, 3, p.kind, 0, 0);
    }
    if (banner) { banner.t += dt; if (banner.t > banner.dur) banner = null; }
    if (run.over) { endDelay -= dt; if (endDelay <= 0) finishRun(); return; }
    if (run.pending > 0) enterLevelUp();
  }
  function camera() {
    let cx = run.px - W / 2, cy = run.py - H * 0.46;
    cx = Math.max(0, Math.min(A - W, cx)); cy = Math.max(0, Math.min(A - H, cy));
    if (run.shake > 0) { cx += (Math.random() - 0.5) * 7; cy += (Math.random() - 0.5) * 7; }
    return [cx, cy];
  }
  function drawScene() {
    const c = camera();
    Gfx.drawWorld(g, run, c[0], c[1], clock);
    Gfx.drawVignette(g);
    if (run.iframes > 0.25 && !run.over) { g.fillStyle = 'rgba(255,40,60,' + Math.min(0.28, run.iframes * 0.4) + ')'; g.fillRect(0, 0, W, H); }
  }
  function drawHUD() {
    // xp bar
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, 7);
    g.fillStyle = '#8a6cff'; g.fillRect(0, 0, W * Math.min(1, run.xp / run.need), 7);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, W * Math.min(1, run.xp / run.need), 2);
    // hp
    panel(10, 14, 132, 14, 'rgba(0,0,0,0.55)', 'rgba(255,255,255,0.4)', 7);
    const hpf = Math.max(0, run.hp / run.maxhp);
    if (hpf > 0) { rrect(11, 15, 130 * hpf, 12, 6); g.fillStyle = hpf < 0.3 ? '#ff3a4a' : '#ff6b81'; g.fill(); }
    txt(Math.ceil(run.hp) + '/' + run.maxhp, 76, 21.5, 10, '#fff', 'center', true);
    txt(T.lvl + ' ' + run.level, 150, 21, 13, '#d8ccff', 'left', true);
    // timer
    txtO(fmtTime(run.t), W / 2 + 30, 34, 18, '#fff', 'center', true);
    // pause
    btn('pause', W - 44, 12, 34, 34, '', pauseGame, { color: '#3d3480' });
    g.fillStyle = '#fff'; g.fillRect(W - 34, 21, 5, 16); g.fillRect(W - 25, 21, 5, 16);
    // slots
    for (let i = 0; i < D.SLOTS; i++) {
      const x = 10 + i * 33, y = 36, sl = run.slots[i];
      panel(x, y, 29, 29, 'rgba(0,0,0,0.5)', sl ? Gfx.rgba(D.ELEM_COLOR[sl.el], 0.95) : 'rgba(255,255,255,0.25)', 8);
      if (sl) { icon(sl.el, x + 14.5, y + 14.5, 23); txtO(String(sl.lvl), x + 24, y + 24, 10, '#fff', 'center', true); }
    }
    // active fusions
    for (let i = 0; i < run.fus.length; i++) g.drawImage(Gfx.spr.fusion[run.fus[i].f.idx], 10 + i * 24, 70, 21, 21);
    // boss bar
    if (run.boss && run.boss.on) {
      const b = run.boss, def = D.BOSSES[b.bid], bw = 250, bx = (W - bw) / 2, by = 98;
      panel(bx, by, bw, 15, 'rgba(0,0,0,0.65)', 'rgba(255,255,255,0.5)', 7);
      rrect(bx + 1, by + 1, (bw - 2) * Math.max(0, b.hp / b.maxhp), 13, 6); g.fillStyle = D.ELEM_COLOR[def.el]; g.fill();
      txtO(T.bosses[b.bid].name, W / 2, by + 28, 12, '#fff', 'center', true);
      icon(def.weak, W / 2 - 52, by + 46, 18); txtO(T.weakTo + ' ' + T.elements[def.weak], W / 2 - 38, by + 46, 11, D.ELEM_COLOR[def.weak], 'left', true);
    }
    // banner
    if (banner) {
      const f = Math.min(1, banner.t / 0.25) * Math.min(1, (banner.dur - banner.t) / 0.4), bh = banner.sub ? 58 : 40, by = (run.boss ? 168 : 104) - (1 - f) * 20;
      g.globalAlpha = f;
      panel(40, by, W - 80, bh, 'rgba(10,8,30,0.88)', banner.color, 14);
      if (banner.fi >= 0) g.drawImage(Gfx.spr.fusion[banner.fi], 48, by + bh / 2 - 15, 30, 30);
      const tx = banner.fi >= 0 ? W / 2 + 14 : W / 2;
      txt(banner.title, tx, by + (banner.sub ? 19 : 20), banner.big ? 16 : 14, banner.color, 'center', true);
      if (banner.sub) txt(banner.sub, tx, by + 40, 13, '#fff', 'center', true);
      g.globalAlpha = 1;
    }
    // joystick
    if (joy.active) {
      g.globalAlpha = 0.3; g.fillStyle = '#fff'; g.beginPath(); g.arc(joy.bx, joy.by, 42, 0, TAU); g.fill();
      g.globalAlpha = 0.65; g.beginPath(); g.arc(joy.x, joy.y, 18, 0, TAU); g.fill(); g.globalAlpha = 1;
    } else if (Save.data.runs === 0 && movedT < 1.2 && run.t < 20) drawMoveHint();
  }
  // animated hint (no words): a ghost thumb drags a joystick in a circle
  function drawMoveHint() {
    const cx = W / 2, cy = H * 0.76, t = clock * 2.2, kx = cx + Math.cos(t) * 24, ky = cy + Math.sin(t) * 24, pulse = 0.5 + 0.5 * Math.sin(clock * 5);
    g.globalAlpha = 0.28; g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 42, 0, TAU); g.fill();
    g.globalAlpha = 0.45 + 0.2 * pulse; g.beginPath(); g.arc(kx, ky, 18, 0, TAU); g.fill();
    g.globalAlpha = 0.9; g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(kx + 4, ky + 6, 9, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(kx + 4, ky + 6, 9 + pulse * 7, 0, TAU); g.stroke(); g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- overlays
  function dim(a) { g.fillStyle = 'rgba(4,3,12,' + a + ')'; g.fillRect(0, 0, W, H); }
  function drawLevelUp() {
    dim(0.72);
    txtO(T.levelUp, W / 2, 62, 30, '#ffe9a0', 'center', true);
    txt(T.chooseOne, W / 2, 90, 13, '#c9b8ff', 'center');
    const cw = W - 28, ch = 98, top = 110;
    cards.forEach(function (c, i) {
      const x = 14, y = top + i * (ch + 10);
      let col = '#6fdcff', title = '', sub = '', tag = '', el = null, fusSub = null;
      if (c.t === 'new') { el = c.el; col = D.ELEM_COLOR[el]; title = T.spells[el].name; sub = T.spells[el].desc; tag = T.newSpell; if (c.hint) fusSub = c.hintKnown ? T.fusions[c.hint].name + (c.fus > 1 ? ' +' + (c.fus - 1) : '') : T.fusionUnlocks; }
      else if (c.t === 'up') { el = c.el; col = D.ELEM_COLOR[el]; title = T.spells[el].name; sub = T.upgradeLabel + ': ' + T.lvl + ' ' + (c.lvl - 1) + ' > ' + c.lvl + (c.lvl >= D.MAX_SPELL_LVL ? ' (' + T.maxed + ')' : ''); tag = T.lvl + ' ' + c.lvl; }
      else if (c.t === 'pas') { col = '#b794f6'; title = T.passives[c.id].name; sub = T.passives[c.id].desc; }
      else { col = '#7dffa0'; title = T.heal; sub = T.healDesc; }
      btn('card' + i, x, y, cw, ch, '', function () { pickCard(c); }, { color: '#2a2468' });
      g.strokeStyle = col; g.lineWidth = 2.4; rrect(x, y, cw, ch, 13); g.stroke();
      if (el) icon(el, x + 38, y + ch / 2, 52);
      else { g.fillStyle = Gfx.rgba(col, 0.35); g.beginPath(); g.arc(x + 38, y + ch / 2, 25, 0, TAU); g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); txt(c.t === 'heal' ? '+' : '*', x + 38, y + ch / 2 + 1, 24, '#fff', 'center', true); }
      txt(title, x + 78, y + 24, 17, '#fff', 'left', true);
      const lines = wrap(sub, cw - 92, 12);
      lines.slice(0, 2).forEach(function (l, k) { txt(l, x + 78, y + 46 + k * 15, 12, '#d6ccff', 'left'); });
      if (fusSub) txt('✦ ' + fusSub, x + 78, y + ch - 14, 12, '#ffd86a', 'left', true);
      if (tag) { panel(x + cw - 78, y + 8, 70, 20, Gfx.rgba(col, 0.28), col, 10); txt(tag, x + cw - 43, y + 18.5, 11, '#fff', 'center', true); }
    });
    // first-run hint: a tapping finger on the first card
    if (Save.data.runs === 0 && !pickHintDone && cards.length) {
      const p = 0.5 + 0.5 * Math.sin(clock * 6), fx = W - 52, fy = top + 70;
      g.fillStyle = '#ffe9a0'; g.globalAlpha = 0.95; g.beginPath(); g.arc(fx, fy + p * 6, 11, 0, TAU); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.globalAlpha = 1 - p; g.beginPath(); g.arc(fx, fy + p * 6, 11 + p * 12, 0, TAU); g.stroke(); g.globalAlpha = 1;
    }
    const ad = adLabel('reroll', T.reroll);
    btn('reroll', 60, top + 3 * (ch + 10) + 2, W - 120, 48, ad.label, ad.disabled ? function () {} : doReroll, { color: '#2fa56a', sub: ad.sub, disabled: ad.disabled, size: 16 });
  }
  function drawPause() {
    dim(0.72);
    txtO(T.paused, W / 2, H * 0.2, 32, '#ffe9a0', 'center', true);
    btn('resume', 70, H * 0.2 + 36, W - 140, 58, T.resume, resumeGame, { color: '#e8872a', size: 22 });
    [['music', T.music], ['sfx', T.sfx], ['vib', T.vibration]].forEach(function (r, i) {
      const y = H * 0.2 + 116 + i * 52, on = Save.setting(r[0]);
      txt(r[1], 60, y + 20, 16, '#fff', 'left', true);
      btn('set_' + r[0], W - 150, y, 90, 40, on ? T.on : T.off, function () { Snd.toggle(r[0]); }, { color: on ? '#2fa56a' : '#6a3f4f', size: 15 });
    });
    btn('quit', 70, H * 0.2 + 290, W - 140, 46, T.quit, function () { Snd.play('click'); run.over = true; run.won = false; finishRun(); }, { color: '#7a3040', size: 16 });
  }
  function drawEnd() {
    dim(0.78);
    const won = run.won;
    txtO(won ? T.victory : T.defeat, W / 2, 70, 34, won ? '#ffe9a0' : '#ff8a8a', 'center', true);
    const rows = [[T.time, fmtTime(run.t)], [T.level, String(run.level)], [T.kills, String(run.kills)], [T.fusionsUsed, Object.keys(run.fusEver).length + ' / ' + D.FUSIONS.length]];
    panel(40, 100, W - 80, 24 + rows.length * 28, 'rgba(36,30,86,0.9)', 'rgba(255,255,255,0.3)', 14);
    rows.forEach(function (r, i) { txt(r[0], 58, 126 + i * 28, 15, '#cdbfff', 'left'); txt(r[1], W - 58, 126 + i * 28, 15, '#fff', 'right', true); });
    const cy = 100 + 24 + rows.length * 28 + 22;
    coinIcon(W / 2 - 62, cy, 11); txt('+' + endInfo.coins + ' ' + T.coins.toLowerCase(), W / 2 - 46, cy, 20, '#ffe9a0', 'left', true);
    if (endInfo.newBest) txt(T.newBest, W / 2, cy + 26, 14, '#7dffa0', 'center', true);
    let y = cy + 46;
    if (!won && !run.revived) {
      const ad = adLabel('revive', T.revive);
      btn('revive', 50, y, W - 100, 56, ad.label, ad.disabled ? function () {} : doRevive, { color: '#2fa56a', sub: ad.sub, disabled: ad.disabled, size: 20 }); y += 66;
    }
    if (!run.doubled) {
      const ad = adLabel('double', T.doubleCoins);
      btn('double', 50, y, W - 100, 56, ad.label, ad.disabled ? function () {} : doDouble, { color: '#2fa56a', sub: ad.sub, disabled: ad.disabled, size: 20 }); y += 66;
    }
    btn('retry', 50, y, W - 100, 56, T.retry, startRun, { color: '#e8872a', size: 22 }); y += 66;
    btn('menu', 50, y, W - 100, 46, T.menu, toMenu, { color: '#4a3fa0', size: 17 });
  }

  // ---------------------------------------------------------------- input
  function pos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    Snd.unlock();
    const p = pos(e), b = hit(p[0], p[1]);
    if (!ptr.down || b) { ptr.down = true; ptr.id = e.pointerId; ptr.sx = ptr.x = p[0]; ptr.sy = ptr.y = p[1]; ptr.moved = false; ptr.btn = b; scroll.start = scroll.y; }
    if (!b && state === 'play' && !joy.active) { joy.active = true; joy.id = e.pointerId; joy.bx = joy.x = p[0]; joy.by = joy.y = p[1]; joy.ix = joy.iy = 0; }
  }, { passive: false });
  canvas.addEventListener('pointermove', function (e) {
    e.preventDefault();
    const p = pos(e);
    if (joy.active && e.pointerId === joy.id) {
      let dx = p[0] - joy.bx, dy = p[1] - joy.by; const d = Math.hypot(dx, dy), R = 42;
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      joy.x = joy.bx + dx; joy.y = joy.by + dy; joy.ix = dx / R; joy.iy = dy / R;
      return;
    }
    if (ptr.down && e.pointerId === ptr.id) {
      ptr.x = p[0]; ptr.y = p[1];
      if (Math.hypot(p[0] - ptr.sx, p[1] - ptr.sy) > 9) ptr.moved = true;
      if (ptr.moved && (state === 'grimoire' || state === 'upgrades')) scroll.y = scroll.start + (ptr.sy - p[1]);
    }
  }, { passive: false });
  function up(e) {
    e.preventDefault();
    if (joy.active && e.pointerId === joy.id) { joy.active = false; joy.ix = joy.iy = 0; return; }
    if (ptr.down && e.pointerId === ptr.id) {
      const p = pos(e); ptr.down = false;
      if (e.type === 'pointerup' && !ptr.moved && ptr.btn) {
        const b = hit(p[0], p[1]);
        if (b && b.id === ptr.btn.id && !b.disabled && b.fn) b.fn();
        else if (b && b.disabled) Snd.play('error');
      }
      ptr.btn = null;
    }
  }
  canvas.addEventListener('pointerup', up, { passive: false });
  canvas.addEventListener('pointercancel', up, { passive: false });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') back();
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[e.key];
    if (k && state === 'play') { keys[e.key] = k; syncKeys(); }
  });
  const keys = {};
  window.addEventListener('keyup', function (e) { delete keys[e.key]; syncKeys(); });
  function syncKeys() {   // desktop testing helper: arrow keys / WASD
    if (joy.active) return;
    let x = 0, y = 0; Object.keys(keys).forEach(function (k) { x += keys[k][0]; y += keys[k][1]; });
    joy.ix = Math.max(-1, Math.min(1, x)); joy.iy = Math.max(-1, Math.min(1, y));
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { pauseGame(); Snd.suspend(); } else Snd.resume();
  });
  window.addEventListener('resize', resize);
  try {                                   // Android back button (Capacitor App plugin)
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.addListener) App.addListener('backButton', function () { if (!back() && App.exitApp) App.exitApp(); });
  } catch (e) { /* not running inside Capacitor */ }

  // ---------------------------------------------------------------- main loop
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000)); last = now; clock += dt;
    g.setTransform(S, 0, 0, S, 0, 0);
    buttons = [];
    AdService.tick();
    if (toastMsg) { toastMsg.t -= dt; if (toastMsg.t <= 0) toastMsg = null; }
    if (state === 'menu') drawMenu();
    else if (state === 'grimoire') drawGrimoire();
    else if (state === 'upgrades') drawUpgrades();
    else {
      if (state === 'play') updatePlay(dt);
      else if (state === 'end') Gfx.updateParticles(dt);
      if (run) {
        drawScene();
        if (state === 'play') drawHUD();
        else if (state === 'levelup') drawLevelUp();
        else if (state === 'pause') drawPause();
        else if (state === 'end') drawEnd();
      }
    }
    if (showSettings) drawSettings();
    if (toastMsg) { g.globalAlpha = Math.min(1, toastMsg.t * 2); panel(W / 2 - 100, H - 70, 200, 34, 'rgba(10,8,30,0.9)', 'rgba(255,255,255,0.4)', 17); txt(toastMsg.text, W / 2, H - 52.5, 14, '#fff', 'center', true); g.globalAlpha = 1; }
  }

  resize();
  Snd.setMode('menu');
  last = performance.now();
  requestAnimationFrame(frame);

  // small hook for automated tests
  window.__game = { get state() { return state; }, get run() { return run; }, startRun: startRun, joy: joy, Save: Save, C: C, back: back, pickCard: pickCard, get cards() { return cards; }, toMenu: toMenu, get S() { return S; } };
})();
