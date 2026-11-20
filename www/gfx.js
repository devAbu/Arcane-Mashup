// Arcane Mashup - rendering: all art is drawn with code into cached sprites (no image files), plus particles.
(function (root) {
  'use strict';
  const D = root.Data;
  const A = D.ARENA;
  const TAU = 6.283185;

  let S = 1, W = 360, H = 640;
  const spr = { glow: [], icon: [], fusion: [], fusionGray: [], enemy: {}, boss: {}, mage: {}, gem: [] };

  // ---------- helpers
  function mkc(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.max(1, Math.ceil(h * S));
    const g = c.getContext('2d'); g.scale(S, S);
    c.lw = w; c.lh = h;
    return [c, g];
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function shade(hex, f) {          // f<1 darker, f>1 lighter
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round((n >> 16) * f)), gg = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  }
  function whiteVersion(c) {
    const f = document.createElement('canvas'); f.width = c.width; f.height = c.height;
    const g = f.getContext('2d'); g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,0.88)'; g.fillRect(0, 0, f.width, f.height);
    f.lw = c.lw; f.lh = c.lh; c.f = f;
  }
  function glowSprite(col) {
    const [c, g] = mkc(40, 40);
    const gr = g.createRadialGradient(20, 20, 0, 20, 20, 20);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, col); gr.addColorStop(0.55, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 40, 40);
    return c;
  }

  // element glyphs, drawn in a 32x32 box
  function glyph(g, el, x, y, size, col) {
    const k = size / 32;
    g.save(); g.translate(x - size / 2, y - size / 2); g.scale(k, k);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    if (el === 'fire') {
      g.moveTo(16, 3); g.bezierCurveTo(24, 11, 27, 17, 23, 24); g.bezierCurveTo(21, 28, 11, 28, 9, 23);
      g.bezierCurveTo(6, 17, 11, 14, 12, 9); g.bezierCurveTo(14, 12, 15, 12, 16, 3); g.fill();
    } else if (el === 'ice') {
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.moveTo(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12); g.lineTo(16 - Math.cos(a) * 12, 16 - Math.sin(a) * 12); }
      g.stroke();
    } else if (el === 'lightning') {
      g.moveTo(18, 3); g.lineTo(8, 18); g.lineTo(15, 18); g.lineTo(12, 29); g.lineTo(24, 12); g.lineTo(17, 12); g.closePath(); g.fill();
    } else if (el === 'earth') {
      g.moveTo(7, 13); g.lineTo(16, 4); g.lineTo(25, 12); g.lineTo(23, 24); g.lineTo(13, 28); g.lineTo(6, 21); g.closePath(); g.fill();
    } else {
      g.arc(14, 12, 7, Math.PI, Math.PI * 2.1); g.moveTo(4, 16); g.lineTo(21, 16); g.arc(21, 20, 4, -Math.PI / 2, Math.PI * 0.9);
      g.moveTo(6, 23); g.lineTo(14, 23); g.stroke();
    }
    g.restore();
  }

  // ---------- sprite construction
  function buildEnemy(kind) {
    const def = D.ENEMIES[kind], r = def.r, sz = r * 2 + 10;
    const [c, g] = mkc(sz, sz), cx = sz / 2, cy = sz / 2;
    const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.4, 1, cx, cy, r * 1.15);
    gr.addColorStop(0, shade(def.color, 1.4)); gr.addColorStop(0.6, def.color); gr.addColorStop(1, def.dark);
    g.fillStyle = gr; g.strokeStyle = def.dark; g.lineWidth = 1.5;
    if (kind === 'runner') {
      g.beginPath(); g.moveTo(cx, cy - r * 1.25); g.lineTo(cx + r * 1.05, cy + r * 0.8); g.lineTo(cx, cy + r * 0.35); g.lineTo(cx - r * 1.05, cy + r * 0.8); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy + r * 0.05, r * 0.38, 0, TAU); g.fill();
      g.fillStyle = '#220'; g.beginPath(); g.arc(cx, cy + r * 0.1, r * 0.17, 0, TAU); g.fill();
    } else {
      if (kind === 'brute') {
        g.fillStyle = '#d8d0b8';
        g.beginPath(); g.moveTo(cx - r * 0.8, cy - r * 0.5); g.lineTo(cx - r * 1.1, cy - r * 1.3); g.lineTo(cx - r * 0.3, cy - r * 0.85); g.fill();
        g.beginPath(); g.moveTo(cx + r * 0.8, cy - r * 0.5); g.lineTo(cx + r * 1.1, cy - r * 1.3); g.lineTo(cx + r * 0.3, cy - r * 0.85); g.fill();
        g.fillStyle = gr;
      }
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.stroke();
      if (kind === 'grunt') {
        g.fillStyle = def.dark;
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; g.beginPath(); g.moveTo(cx + Math.cos(a - 0.12) * r * 0.95, cy + Math.sin(a - 0.12) * r * 0.95); g.lineTo(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3); g.lineTo(cx + Math.cos(a + 0.12) * r * 0.95, cy + Math.sin(a + 0.12) * r * 0.95); g.fill(); }
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(cx - r * 0.36, cy - r * 0.12, r * 0.28, 0, TAU); g.arc(cx + r * 0.36, cy - r * 0.12, r * 0.28, 0, TAU); g.fill();
      g.fillStyle = kind === 'brute' ? '#a00' : '#220';
      g.beginPath(); g.arc(cx - r * 0.34, cy - r * 0.08, r * 0.14, 0, TAU); g.arc(cx + r * 0.34, cy - r * 0.08, r * 0.14, 0, TAU); g.fill();
      if (kind === 'brute') { g.strokeStyle = '#210'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - r * 0.7, cy - r * 0.45); g.lineTo(cx - r * 0.1, cy - r * 0.25); g.moveTo(cx + r * 0.7, cy - r * 0.45); g.lineTo(cx + r * 0.1, cy - r * 0.25); g.stroke(); g.fillStyle = '#210'; g.fillRect(cx - r * 0.35, cy + r * 0.35, r * 0.7, r * 0.18); }
    }
    whiteVersion(c);
    return c;
  }
  function buildBoss(id) {
    const def = D.BOSSES[id], r = def.r, sz = r * 2 + 30;
    const [c, g] = mkc(sz, sz), cx = sz / 2, cy = sz / 2;
    if (id === 'colossus') {
      const gr = g.createLinearGradient(0, cy - r, 0, cy + r);
      gr.addColorStop(0, '#7a3a24'); gr.addColorStop(1, '#2e1209');
      g.fillStyle = gr; g.strokeStyle = '#1a0804'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(cx - r * 0.9, cy + r * 0.9); g.lineTo(cx - r * 1.15, cy - r * 0.1); g.lineTo(cx - r * 0.6, cy - r * 0.9); g.lineTo(cx + r * 0.6, cy - r * 0.9); g.lineTo(cx + r * 1.15, cy - r * 0.1); g.lineTo(cx + r * 0.9, cy + r * 0.9); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#ff9a3a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - r * 0.5, cy - r * 0.2); g.lineTo(cx - r * 0.2, cy + r * 0.2); g.lineTo(cx - r * 0.4, cy + r * 0.7); g.moveTo(cx + r * 0.45, cy - r * 0.1); g.lineTo(cx + r * 0.15, cy + r * 0.3); g.lineTo(cx + r * 0.5, cy + r * 0.65); g.stroke();
      g.fillStyle = '#ffd36a'; g.beginPath(); g.arc(cx - r * 0.32, cy - r * 0.5, r * 0.14, 0, TAU); g.arc(cx + r * 0.32, cy - r * 0.5, r * 0.14, 0, TAU); g.fill();
      g.fillStyle = '#ff6a2a'; g.beginPath(); g.arc(cx, cy + r * 0.05, r * 0.16, 0, TAU); g.fill();
    } else {
      const gr = g.createLinearGradient(0, cy - r, 0, cy + r * 1.1);
      gr.addColorStop(0, '#3a3560'); gr.addColorStop(1, '#14122b');
      g.fillStyle = gr; g.strokeStyle = '#0a0818'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx, cy - r * 1.2); g.bezierCurveTo(cx + r * 1.3, cy - r * 0.8, cx + r * 1.2, cy + r * 0.6, cx + r * 1.1, cy + r * 1.1);
      for (let i = 0; i < 5; i++) { const x = cx + r * 1.1 - (i + 0.5) * r * 0.44; g.lineTo(x, cy + r * (i % 2 ? 0.85 : 1.25)); }
      g.lineTo(cx - r * 1.1, cy + r * 1.1); g.bezierCurveTo(cx - r * 1.2, cy + r * 0.6, cx - r * 1.3, cy - r * 0.8, cx, cy - r * 1.2); g.fill(); g.stroke();
      g.fillStyle = '#05040c'; g.beginPath(); g.ellipse(cx, cy - r * 0.35, r * 0.55, r * 0.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffe44a'; g.beginPath(); g.ellipse(cx - r * 0.22, cy - r * 0.35, r * 0.13, r * 0.07, 0.3, 0, TAU); g.ellipse(cx + r * 0.22, cy - r * 0.35, r * 0.13, r * 0.07, -0.3, 0, TAU); g.fill();
      g.strokeStyle = '#ffe44a'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(cx - r * 0.7, cy + r * 0.2); g.lineTo(cx - r * 0.5, cy + r * 0.45); g.lineTo(cx - r * 0.7, cy + r * 0.6); g.moveTo(cx + r * 0.7, cy + r * 0.1); g.lineTo(cx + r * 0.5, cy + r * 0.4); g.lineTo(cx + r * 0.72, cy + r * 0.55); g.stroke();
    }
    whiteVersion(c);
    return c;
  }
  function buildMage(id) {
    const col = D.MAGES[id].color, sz = 52;
    const [c, g] = mkc(sz, sz), cx = sz / 2, cy = sz / 2 + 4;
    // staff
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx + 12, cy + 12); g.lineTo(cx + 14, cy - 14); g.stroke();
    g.fillStyle = col; g.beginPath(); g.arc(cx + 14, cy - 16, 3.6, 0, TAU); g.fill();
    // robe
    const gr = g.createLinearGradient(0, cy - 8, 0, cy + 14);
    gr.addColorStop(0, shade(col, 0.9)); gr.addColorStop(1, shade(col, 0.45));
    g.fillStyle = gr; g.strokeStyle = shade(col, 0.3); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(cx - 5, cy - 6); g.lineTo(cx + 5, cy - 6); g.lineTo(cx + 11, cy + 13); g.lineTo(cx - 11, cy + 13); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e9c9a0'; g.beginPath(); g.arc(cx, cy - 9, 5.2, 0, TAU); g.fill();
    g.fillStyle = '#251a10'; g.beginPath(); g.arc(cx - 1.8, cy - 9.5, 0.9, 0, TAU); g.arc(cx + 1.8, cy - 9.5, 0.9, 0, TAU); g.fill();
    // hat
    g.fillStyle = shade(col, 0.7); g.strokeStyle = shade(col, 0.3);
    g.beginPath(); g.moveTo(cx - 9, cy - 11); g.lineTo(cx + 9, cy - 11); g.lineTo(cx + 2, cy - 27); g.lineTo(cx - 1, cy - 22); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffe9a0'; g.fillRect(cx - 7, cy - 13.5, 14, 2.6);
    return c;
  }
  function buildGem(v) {
    const col = v >= 6 ? '#ffd86a' : v >= 3 ? '#7dffb0' : '#6fc3ff';
    const [c, g] = mkc(16, 16);
    g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(8, 1); g.lineTo(13, 8); g.lineTo(8, 15); g.lineTo(3, 8); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(8, 3); g.lineTo(10.5, 8); g.lineTo(8, 8); g.closePath(); g.fill();
    return c;
  }
  function buildTile() {
    const [c, g] = mkc(128, 128);
    g.fillStyle = '#16142e'; g.fillRect(0, 0, 128, 128);
    let seed = 12345; const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const l = 22 + Math.floor(rnd() * 8);
      g.fillStyle = 'rgb(' + l + ',' + (l - 2) + ',' + (l + 24) + ')';
      g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29);
      if (rnd() < 0.35) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x * 32 + 4, y * 32 + 4, 10 + rnd() * 10, 3); }
      if (rnd() < 0.15) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x * 32 + 5, y * 32 + 24); g.lineTo(x * 32 + 14, y * 32 + 14); g.lineTo(x * 32 + 22, y * 32 + 18); g.stroke(); }
    }
    return c;
  }
  function buildRune(col) {
    const [c, g] = mkc(110, 110);
    g.strokeStyle = rgba(col, 0.28); g.lineWidth = 2;
    g.beginPath(); g.arc(55, 55, 44, 0, TAU); g.stroke();
    g.beginPath(); g.arc(55, 55, 32, 0.3, TAU - 0.3); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.moveTo(55 + Math.cos(a) * 32, 55 + Math.sin(a) * 32); g.lineTo(55 + Math.cos(a + 2.1) * 32, 55 + Math.sin(a + 2.1) * 32); g.stroke(); }
    g.fillStyle = rgba(col, 0.22);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.5; g.beginPath(); g.arc(55 + Math.cos(a) * 44, 55 + Math.sin(a) * 44, 3, 0, TAU); g.fill(); }
    return c;
  }
  function buildVignette() {
    const [c, g] = mkc(W, H);
    const gr = g.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.48, Math.max(W, H) * 0.72);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(3,2,10,0.7)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    return c;
  }
  function buildIcon(i) {
    const el = D.ELEMS[i], [c, g] = mkc(40, 40);
    const gr = g.createRadialGradient(15, 13, 2, 20, 20, 19);
    gr.addColorStop(0, shade(D.ELEM_COLOR[el], 0.9)); gr.addColorStop(1, D.ELEM_DARK[el]);
    g.fillStyle = gr; g.beginPath(); g.arc(20, 20, 18, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2; g.stroke();
    glyph(g, el, 20, 20, 24, '#ffffff');
    return c;
  }
  function buildFusionIcon(f, gray) {
    const [c, g] = mkc(40, 40);
    const ca = gray ? '#4a4860' : D.ELEM_COLOR[f.a], cb = gray ? '#3a384d' : D.ELEM_COLOR[f.b];
    g.save(); g.beginPath(); g.arc(20, 20, 18, 0, TAU); g.clip();
    g.fillStyle = ca; g.fillRect(0, 0, 20, 40); g.fillStyle = cb; g.fillRect(20, 0, 20, 40);
    g.restore();
    g.strokeStyle = gray ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)'; g.lineWidth = 2; g.beginPath(); g.arc(20, 20, 18, 0, TAU); g.stroke();
    g.fillStyle = gray ? 'rgba(255,255,255,0.3)' : '#fff';
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 3 : 8; g.lineTo(20 + Math.cos(a) * rr, 20 + Math.sin(a) * rr); } g.closePath(); g.fill();
    return c;
  }

  const decor = [];
  (function () {
    let seed = 777; const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 46; i++) decor.push({ x: 80 + rnd() * (A - 160), y: 80 + rnd() * (A - 160), k: i % 3, rot: rnd() * 6 });
  })();

  function build() {
    spr.glow = D.ELEMS.map(function (el) { return glowSprite(D.ELEM_COLOR[el]); });
    spr.glowW = glowSprite('#ffffff');
    spr.glowP = glowSprite('#c9a0ff');
    spr.icon = D.ELEMS.map(function (el, i) { return buildIcon(i); });
    spr.fusion = D.FUSIONS.map(function (f) { return buildFusionIcon(f, false); });
    spr.fusionGray = D.FUSIONS.map(function (f) { return buildFusionIcon(f, true); });
    Object.keys(D.ENEMIES).forEach(function (k) { spr.enemy[k] = buildEnemy(k); });
    Object.keys(D.BOSSES).forEach(function (k) { spr.boss[k] = buildBoss(k); });
    Object.keys(D.MAGES).forEach(function (k) { spr.mage[k] = buildMage(k); });
    spr.gem = [buildGem(1), buildGem(3), buildGem(6)];
    spr.tile = buildTile();
    spr.runes = [buildRune('#6fdcff'), buildRune('#b794f6'), buildRune('#ff9a5a')];
    spr.vig = buildVignette();
    const [sc, sg] = mkc(30, 14); sg.fillStyle = 'rgba(0,0,0,0.35)'; sg.beginPath(); sg.ellipse(15, 7, 13, 5, 0, 0, TAU); sg.fill(); spr.shadow = sc;
    const [ic, ig] = mkc(36, 36); ig.fillStyle = 'rgba(190,235,255,0.55)'; ig.strokeStyle = 'rgba(255,255,255,0.8)'; ig.lineWidth = 1.5;
    ig.beginPath(); ig.moveTo(18, 2); ig.lineTo(32, 14); ig.lineTo(26, 33); ig.lineTo(10, 33); ig.lineTo(4, 14); ig.closePath(); ig.fill(); ig.stroke(); spr.ice = ic;
  }

  // ---------- particles (ring buffer, typed arrays => no per-frame allocation)
  const NP = 380;
  const PA = { x: new Float32Array(NP), y: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP), life: new Float32Array(NP), max: new Float32Array(NP), size: new Float32Array(NP), col: new Uint8Array(NP), grav: new Float32Array(NP), kind: new Uint8Array(NP) };
  let pi = 0;
  // 0-4 elements, 5 white, 6 red, 7 green, 8 purple, 9 gold, 10 grey
  const PCOL = ['#ff8a3a', '#9be8ff', '#fff06a', '#d2a468', '#a8ffd2', '#ffffff', '#ff4a5a', '#7dffa0', '#c9a0ff', '#ffd86a', '#8a88a0'];
  function emit(x, y, vx, vy, life, size, col, grav, kind) {
    const i = pi; pi = (pi + 1) % NP;
    PA.x[i] = x; PA.y[i] = y; PA.vx[i] = vx; PA.vy[i] = vy; PA.life[i] = life; PA.max[i] = life; PA.size[i] = size; PA.col[i] = col; PA.grav[i] = grav || 0; PA.kind[i] = kind || 0;
  }
  function burst(x, y, n, col, speed, life, size, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.35 + Math.random() * 0.65);
      emit(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + Math.random() * 0.4), size * (0.6 + Math.random() * 0.6), col, grav || 0, 0);
    }
  }
  // expanding ring (rendered as a particle of kind 1 that grows)
  function ring(x, y, r, col, life) { emit(x, y, 0, 0, life || 0.35, r, col, 0, 1); }
  function updateParticles(dt) {
    for (let i = 0; i < NP; i++) {
      if (PA.life[i] <= 0) continue;
      PA.life[i] -= dt;
      PA.x[i] += PA.vx[i] * dt; PA.y[i] += PA.vy[i] * dt; PA.vy[i] += PA.grav[i] * dt;
    }
  }
  function drawParticles(g, cx, cy) {
    for (let i = 0; i < NP; i++) {
      const l = PA.life[i]; if (l <= 0) continue;
      const f = l / PA.max[i], sx = PA.x[i] - cx, sy = PA.y[i] - cy;
      if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) continue;
      if (PA.kind[i] === 1) {
        g.globalAlpha = f * 0.8; g.strokeStyle = PCOL[PA.col[i]]; g.lineWidth = 3 * f + 1;
        g.beginPath(); g.arc(sx, sy, PA.size[i] * (1 - f * f), 0, TAU); g.stroke();
      } else {
        g.globalAlpha = Math.min(1, f * 1.6); g.fillStyle = PCOL[PA.col[i]];
        const s = PA.size[i] * (0.5 + f * 0.5);
        g.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
    }
    g.globalAlpha = 1;
  }
  function clearParticles() { PA.life.fill(0); }

  // ---------- world drawing
  function fusionOf(s, id) { for (let i = 0; i < s.fus.length; i++) if (s.fus[i].f.id === id) return s.fus[i]; return null; }

  function drawWorld(g, s, cx, cy, time) {
    g.fillStyle = '#06050e'; g.fillRect(0, 0, W, H);
    // floor tiles
    const tx0 = Math.max(0, Math.floor(cx / 128)), tx1 = Math.min(A / 128 - 1, Math.floor((cx + W) / 128));
    const ty0 = Math.max(0, Math.floor(cy / 128)), ty1 = Math.min(A / 128 - 1, Math.floor((cy + H) / 128));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) g.drawImage(spr.tile, tx * 128 - cx, ty * 128 - cy, 128, 128);
    // runes
    for (let i = 0; i < decor.length; i++) {
      const d = decor[i], sx = d.x - cx, sy = d.y - cy;
      if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
      g.drawImage(spr.runes[d.k], sx - 55, sy - 55, 110, 110);
    }
    // arena border
    g.strokeStyle = 'rgba(150,120,255,0.85)'; g.lineWidth = 5; g.strokeRect(-cx, -cy, A, A);
    g.strokeStyle = 'rgba(150,120,255,0.25)'; g.lineWidth = 14; g.strokeRect(-cx, -cy, A, A);

    // blizzard aura
    const bl = fusionOf(s, 'blizzard');
    if (bl) {
      const r = bl.f.r * (1 + 0.12 * (bl.fs - 1)), sx = s.px - cx, sy = s.py - cy;
      g.globalAlpha = 0.18; g.fillStyle = '#9be8ff'; g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
      g.globalAlpha = 0.5; g.strokeStyle = '#d8f6ff'; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.stroke();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 9; i++) { const a = time * 1.6 + i * TAU / 9, rr = r * (0.35 + 0.6 * ((i * 0.37 + time * 0.3) % 1)); g.fillRect(sx + Math.cos(a) * rr - 1.5, sy + Math.sin(a) * rr - 1.5, 3, 3); }
      g.globalAlpha = 1;
    }
    // ground zones
    for (let i = 0; i < s.Zs.length; i++) {
      const z = s.Zs[i]; if (!z.on) continue;
      const sx = z.x - cx, sy = z.y - cy;
      if (sx < -150 || sx > W + 150 || sy < -150 || sy > H + 150) continue;
      if (z.kind === 2) {          // pool
        const f = Math.min(1, z.life / 0.6);
        g.globalAlpha = 0.85 * f; g.drawImage(spr.glow[0], sx - z.r * 1.25, sy - z.r * 1.25, z.r * 2.5, z.r * 2.5);
        g.globalAlpha = 0.5 * f; g.fillStyle = '#ffb04a'; g.beginPath(); g.arc(sx + Math.sin(time * 3 + i) * z.r * 0.4, sy + Math.cos(time * 2.4 + i) * z.r * 0.3, 3 + Math.sin(time * 5 + i) * 1.5, 0, TAU); g.fill();
        g.globalAlpha = 1;
      } else if (z.kind === 4) {   // pillar
        if (z.state === 0) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 18);
          g.globalAlpha = 0.18 + 0.15 * pulse; g.fillStyle = z.fxi === 1 ? '#9be8ff' : '#fff06a'; g.beginPath(); g.arc(sx, sy, z.r, 0, TAU); g.fill();
          g.globalAlpha = 0.7; g.strokeStyle = z.fxi === 1 ? '#d8f6ff' : '#fff9b0'; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, z.r * (1 - 0.0 * pulse), 0, TAU); g.stroke(); g.globalAlpha = 1;
        }
      }
    }
    // gems
    for (let i = 0; i < s.G.length; i++) {
      const q = s.G[i]; if (!q.on) continue;
      const sx = q.x - cx, sy = q.y - cy + Math.sin(time * 4 + i) * 1.5;
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      g.drawImage(spr.gem[q.v >= 6 ? 2 : q.v >= 3 ? 1 : 0], sx - 6, sy - 6, 12, 12);
    }
    // shadows + enemies
    for (let i = 0; i < s.E.length; i++) {
      const e = s.E[i]; if (!e.on) continue;
      const sx = e.x - cx, sy = e.y - cy;
      if (sx < -70 || sx > W + 70 || sy < -70 || sy > H + 70) continue;
      const sp = e.boss ? spr.boss[e.bid] : spr.enemy[e.kind];
      const k = e.boss ? 1 + 0.03 * Math.sin(time * 3) : 1 + 0.07 * Math.sin(time * 9 + e.seed);
      const w = sp.lw, h = sp.lh * k;
      g.drawImage(spr.shadow, sx - e.r, sy + e.r * 0.45, e.r * 2, e.r * 0.9);
      if (e.boss) {
        const col = D.ELEM_COLOR[D.BOSSES[e.bid].el];
        g.globalAlpha = 0.5 + 0.2 * Math.sin(time * 4); g.drawImage(spr.glow[D.ELEMS.indexOf(D.BOSSES[e.bid].el)], sx - e.r * 2, sy - e.r * 2, e.r * 4, e.r * 4); g.globalAlpha = 1;
        void col;
      }
      g.drawImage(e.flash > 0 ? sp.f : sp, sx - w / 2, sy - h / 2, w, h);
      if (e.freezeT > 0) { g.globalAlpha = 0.8; g.drawImage(spr.ice, sx - e.r - 3, sy - e.r - 4, e.r * 2 + 6, e.r * 2 + 8); g.globalAlpha = 1; }
      else if (e.burnT > 0) { g.globalAlpha = 0.7; g.drawImage(spr.glow[0], sx - e.r * 0.9, sy - e.r * 1.8, e.r * 1.8, e.r * 1.8); g.globalAlpha = 1; }
    }
    // player
    {
      const sx = s.px - cx, sy = s.py - cy, m = spr.mage[s.mage];
      g.drawImage(spr.shadow, sx - 12, sy + 8, 24, 11);
      if (s.iframes > 0 && Math.floor(time * 18) % 2 === 0) g.globalAlpha = 0.45;
      const flip = Math.cos(s.face) < 0;
      if (flip) { g.save(); g.translate(sx, 0); g.scale(-1, 1); g.drawImage(m, -m.lw / 2, sy - m.lh / 2 - 3, m.lw, m.lh); g.restore(); }
      else g.drawImage(m, sx - m.lw / 2, sy - m.lh / 2 - 3, m.lw, m.lh);
      g.globalAlpha = 1;
    }
    // ion orbs
    for (let i = 0; i < s.orbN; i++) {
      const sx = s.orbX[i] - cx, sy = s.orbY[i] - cy;
      g.drawImage(spr.glow[2], sx - 16, sy - 16, 32, 32);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 3, 0, TAU); g.fill();
    }
    // tornado / orb / ring / strikes (drawn above units)
    for (let i = 0; i < s.Zs.length; i++) {
      const z = s.Zs[i]; if (!z.on) continue;
      const sx = z.x - cx, sy = z.y - cy;
      if (sx < -200 || sx > W + 200 || sy < -400 || sy > H + 200) continue;
      if (z.kind === 1) {          // tornado
        g.lineWidth = 3;
        for (let k = 0; k < 6; k++) {
          const f = k / 5, w = z.r * (0.35 + 0.65 * f), yy = sy + z.r * 0.6 - f * z.r * 1.7;
          g.globalAlpha = 0.65; g.strokeStyle = k % 2 ? '#ffb04a' : '#ff6a2a';
          g.beginPath(); g.ellipse(sx + Math.sin(time * 7 + k) * 3, yy, w, w * 0.32, 0, time * 9 + k, time * 9 + k + 4.2); g.stroke();
        }
        g.globalAlpha = 0.35; g.drawImage(spr.glow[0], sx - z.r, sy - z.r, z.r * 2, z.r * 2); g.globalAlpha = 1;
      } else if (z.kind === 5) {   // plasma orb
        const pr = 18 + Math.sin(time * 20) * 2;
        g.drawImage(spr.glow[2], sx - pr * 1.6, sy - pr * 1.6, pr * 3.2, pr * 3.2);
        g.drawImage(spr.glow[0], sx - pr, sy - pr, pr * 2, pr * 2);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 4, 0, TAU); g.fill();
      } else if (z.kind === 3) {   // steam ring
        const f = 1 - z.life / z.maxlife;
        g.globalAlpha = Math.max(0, 0.75 * (1 - f)); g.strokeStyle = '#f3f9ff'; g.lineWidth = 12 * (1 - f) + 2;
        g.beginPath(); g.arc(sx, sy, Math.max(2, z.ang), 0, TAU); g.stroke();
        g.globalAlpha = Math.max(0, 0.35 * (1 - f)); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(sx, sy, Math.max(2, z.ang), 0, TAU); g.fill(); g.globalAlpha = 1;
      } else if (z.kind === 4 && z.state === 1) {   // strike
        const f = Math.max(0, z.life / 0.25);
        if (z.fxi === 0) {
          g.globalAlpha = f; g.fillStyle = '#fff9c0'; g.fillRect(sx - z.r * 0.5, sy - 420, z.r, 420);
          g.fillStyle = '#ffe44a'; g.fillRect(sx - z.r * 0.9, sy - 420, z.r * 1.8, 420); g.globalAlpha = 1;
        } else {
          const h = z.r * 2.4 * (1 - (1 - f) * (1 - f) * 0.2);
          g.globalAlpha = Math.min(1, f * 1.6); g.fillStyle = '#d8f6ff'; g.strokeStyle = '#7fd4ff'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(sx - z.r * 0.75, sy + z.r * 0.3); g.lineTo(sx, sy - h); g.lineTo(sx + z.r * 0.75, sy + z.r * 0.3); g.closePath(); g.fill(); g.stroke(); g.globalAlpha = 1;
        }
      }
    }
    // projectiles
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < s.P.length; i++) {
      const p = s.P[i]; if (!p.on) continue;
      const sx = p.x - cx, sy = p.y - cy;
      if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
      if (p.kind === 4) {
        const a = Math.atan2(p.vy, p.vx);
        g.strokeStyle = 'rgba(190,255,225,0.9)'; g.lineWidth = 3.4; g.beginPath(); g.arc(sx - Math.cos(a) * 6, sy - Math.sin(a) * 6, p.r + 3, a - 1.1, a + 1.1); g.stroke();
        g.strokeStyle = 'rgba(140,255,200,0.35)'; g.lineWidth = 7; g.beginPath(); g.arc(sx - Math.cos(a) * 9, sy - Math.sin(a) * 9, p.r + 3, a - 0.9, a + 0.9); g.stroke();
      } else if (p.kind === 3) { continue; }
      else {
        const gi = p.kind === 5 ? 3 : p.kind, sz = p.kind === 5 ? 14 : p.r * 4.2;
        g.drawImage(spr.glow[gi], sx - sz / 2, sy - sz / 2, sz, sz);
      }
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < s.P.length; i++) {      // boulders
      const p = s.P[i]; if (!p.on || p.kind !== 3) continue;
      const sx = p.x - cx, sy = p.y - cy;
      g.fillStyle = '#8a6a42'; g.strokeStyle = '#3d2a14'; g.lineWidth = 2;
      g.beginPath(); const rot = time * 6 + i;
      for (let k = 0; k < 6; k++) { const a = rot + k * TAU / 6, rr = p.r * (k % 2 ? 0.85 : 1.15); g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(sx - p.r * 0.4, sy - p.r * 0.5, p.r * 0.6, p.r * 0.3);
    }
    // beams
    g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
    for (let i = 0; i < s.B.length; i++) {
      const b = s.B[i]; if (!b.on) continue;
      const f = b.life / b.max, dx = b.x2 - b.x1, dy = b.y2 - b.y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const col = b.el === 1 ? '#9be8ff' : '#fff06a';
      g.globalAlpha = f; g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.moveTo(b.x1 - cx, b.y1 - cy);
      const segs = Math.max(2, Math.min(7, (len / 22) | 0));
      for (let k = 1; k < segs; k++) { const t = k / segs, j = Math.sin(time * 90 + i * 7 + k * 13) * 7; g.lineTo(b.x1 + dx * t + nx * j - cx, b.y1 + dy * t + ny * j - cy); }
      g.lineTo(b.x2 - cx, b.y2 - cy); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    }
    g.globalAlpha = 1;
    // enemy bullets
    for (let i = 0; i < s.EBu.length; i++) {
      const b = s.EBu[i]; if (!b.on) continue;
      const sx = b.x - cx, sy = b.y - cy;
      g.drawImage(spr.glow[b.el === 2 ? 2 : 0], sx - 15, sy - 15, 30, 30);
    }
    g.globalCompositeOperation = 'source-over';
    drawParticles(g, cx, cy);
  }

  const Gfx = {
    spr: spr,
    resize: function (scale, w, h) { const re = scale !== S || w !== W || h !== H; S = scale; W = w; H = h; if (re) build(); },
    drawWorld: drawWorld, updateParticles: updateParticles, clearParticles: clearParticles,
    burst: burst, ring: ring, emit: emit, glyph: glyph, rgba: rgba, shade: shade,
    drawVignette: function (g) { g.drawImage(spr.vig, 0, 0, W, H); }
  };
  root.Gfx = Gfx;
})(typeof self !== 'undefined' ? self : this);
