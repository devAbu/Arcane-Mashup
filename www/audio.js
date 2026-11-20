// Arcane Mashup - sound effects + music, all synthesized with Web Audio (no files, works offline).
// Music, effects and vibration have separate switches stored in the save file.
(function (root) {
  'use strict';

  let ctx = null, master = null, sfxBus = null, musBus = null, delay = null, noiseBuf = null;
  let mode = 'off';                  // 'off' | 'menu' | 'play' | 'boss'
  let ducked = false, timer = null, nextTime = 0, step = 0, active = 0;
  const last = {};
  const opt = function (k) { return root.Save ? root.Save.setting(k) : true; };

  const midi = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };

  function init() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = opt('sfx') ? 1 : 0; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = opt('music') ? 0.3 : 0; musBus.connect(master);
    delay = ctx.createDelay(1); delay.delayTime.value = 0.32;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dl = ctx.createGain(); dl.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(dl); dl.connect(musBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(o) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    let out = g;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
    out.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  function noise(o) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(o.gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
  }
  function gate(name, gap) {            // rate limit per sound
    const n = ctx.currentTime;
    if (last[name] && n - last[name] < gap) return false;
    last[name] = n; return true;
  }

  // element order matches Core.ELI: 0 fire, 1 ice, 2 lightning, 3 earth, 4 wind
  const CAST = [
    function () { noise({ dur: 0.18, gain: 0.07, filter: 'bandpass', freq: 500, f1: 1400, q: 0.8 }); tone({ type: 'sawtooth', f0: 200, f1: 420, dur: 0.12, gain: 0.04, lp: 1200 }); },
    function () { tone({ type: 'triangle', f0: 1500, f1: 2300, dur: 0.12, gain: 0.05 }); tone({ type: 'sine', f0: 2200, f1: 1800, dur: 0.1, gain: 0.03 }); },
    function () { tone({ type: 'sawtooth', f0: 900, f1: 120, dur: 0.1, gain: 0.05, lp: 2500 }); noise({ dur: 0.07, gain: 0.05, filter: 'highpass', freq: 4000 }); },
    function () { tone({ type: 'sine', f0: 120, f1: 55, dur: 0.18, gain: 0.14 }); noise({ dur: 0.1, gain: 0.05, filter: 'lowpass', freq: 500 }); },
    function () { noise({ dur: 0.16, gain: 0.06, filter: 'bandpass', freq: 1600, f1: 700, q: 1.2 }); }
  ];
  const BOOM = [
    function () { tone({ type: 'sine', f0: 160, f1: 50, dur: 0.22, gain: 0.12 }); noise({ dur: 0.2, gain: 0.07, filter: 'lowpass', freq: 900 }); },
    function () { tone({ type: 'triangle', f0: 1800, f1: 600, dur: 0.18, gain: 0.06 }); noise({ dur: 0.1, gain: 0.05, filter: 'highpass', freq: 5000 }); },
    function () { noise({ dur: 0.22, gain: 0.1, filter: 'bandpass', freq: 2400, q: 0.7 }); tone({ type: 'sawtooth', f0: 500, f1: 60, dur: 0.2, gain: 0.08, lp: 1800 }); },
    function () { tone({ type: 'sine', f0: 90, f1: 40, dur: 0.3, gain: 0.16 }); noise({ dur: 0.25, gain: 0.08, filter: 'lowpass', freq: 400 }); },
    function () { tone({ type: 'sine', f0: 200, f1: 700, dur: 0.3, gain: 0.08 }); noise({ dur: 0.35, gain: 0.07, filter: 'bandpass', freq: 800, f1: 3000 }); }
  ];

  const SFX = {
    click: function () { tone({ type: 'triangle', f0: 1400, f1: 1000, dur: 0.04, gain: 0.07 }); },
    error: function () { tone({ type: 'square', f0: 170, f1: 120, dur: 0.14, gain: 0.07, lp: 900 }); },
    card: function () {
      const t = ctx.currentTime;
      [72, 79, 84].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.15, gain: 0.1, t: t + i * 0.05 }); });
    },
    cast: function (a) { if (gate('c' + a, 0.09)) (CAST[a] || CAST[0])(); },
    boom: function (a) { if (gate('b' + a, 0.07)) (BOOM[a] || BOOM[0])(); },
    zap: function () { if (gate('zap', 0.12)) { tone({ type: 'sine', f0: 400, f1: 900, dur: 0.12, gain: 0.05 }); } },
    hurt: function () { tone({ type: 'sawtooth', f0: 220, f1: 70, dur: 0.18, gain: 0.14, lp: 900 }); noise({ dur: 0.1, gain: 0.08, filter: 'lowpass', freq: 800 }); },
    kill: function (boss) {
      if (boss) { tone({ type: 'sawtooth', f0: 240, f1: 40, dur: 1.0, gain: 0.2, lp: 800 }); noise({ dur: 0.8, gain: 0.16, filter: 'lowpass', freq: 900 }); return; }
      if (gate('kill', 0.045)) tone({ type: 'sine', f0: 700 + Math.random() * 300, f1: 1400, dur: 0.06, gain: 0.04 });
    },
    gem: function () {
      const n = ctx.currentTime;
      const chain = (last.gemT && n - last.gemT < 0.5) ? Math.min(12, (last.gemN || 0) + 1) : 0;
      last.gemT = n; last.gemN = chain;
      if (gate('gem', 0.04)) tone({ type: 'sine', f0: midi(76 + chain), dur: 0.07, gain: 0.04 });
    },
    level: function () {
      const t = ctx.currentTime;
      [69, 73, 76, 81].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.22, gain: 0.12, t: t + i * 0.07 }); tone({ type: 'sine', f0: midi(n + 12), dur: 0.2, gain: 0.04, t: t + i * 0.07 }); });
      noise({ t: t + 0.2, dur: 0.3, gain: 0.04, filter: 'highpass', freq: 6000 });
    },
    fusion: function () {
      const t = ctx.currentTime;
      [60, 67, 72, 76, 79, 84].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.3, gain: 0.1, t: t + i * 0.06 }); });
      tone({ type: 'sawtooth', f0: 110, f1: 440, dur: 0.4, gain: 0.05, lp: 1500, t: t });
      noise({ t: t + 0.25, dur: 0.5, gain: 0.05, filter: 'highpass', freq: 5000 });
    },
    discover: function () {
      const t = ctx.currentTime;
      [64, 68, 71, 76, 80, 83, 88].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.35, gain: 0.1, t: t + i * 0.07 }); tone({ type: 'sine', f0: midi(n + 12), dur: 0.3, gain: 0.04, t: t + i * 0.07 }); });
      noise({ t: t + 0.4, dur: 0.6, gain: 0.05, filter: 'highpass', freq: 6000 });
    },
    bossSpawn: function () {
      const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) tone({ type: 'square', f0: i % 2 ? 392 : 294, dur: 0.22, gain: 0.07, lp: 1400, t: t + i * 0.26 });
      tone({ type: 'sawtooth', f0: 70, f1: 48, dur: 1.4, gain: 0.18, lp: 500, attack: 0.1, t: t + 0.7 });
      noise({ t: t + 0.7, dur: 1.0, gain: 0.07, filter: 'lowpass', freq: 400 });
    },
    swarm: function () { const t = ctx.currentTime; tone({ type: 'sawtooth', f0: 180, f1: 260, dur: 0.4, gain: 0.07, lp: 900, t: t }); tone({ type: 'sawtooth', f0: 190, f1: 270, dur: 0.4, gain: 0.07, lp: 900, t: t + 0.18 }); },
    bullet: function (a) { if (gate('bul', 0.25)) { if (a === 2) tone({ type: 'sawtooth', f0: 1000, f1: 200, dur: 0.15, gain: 0.06, lp: 2400 }); else { tone({ type: 'sine', f0: 140, f1: 60, dur: 0.25, gain: 0.15 }); noise({ dur: 0.2, gain: 0.07, filter: 'lowpass', freq: 800 }); } } },
    blink: function () { tone({ type: 'sine', f0: 300, f1: 1400, dur: 0.15, gain: 0.07 }); },
    heal: function () { const t = ctx.currentTime; [76, 83, 88].forEach(function (n, i) { tone({ type: 'sine', f0: midi(n), dur: 0.2, gain: 0.07, t: t + i * 0.07 }); }); },
    reward: function () { const t = ctx.currentTime; [72, 76, 79, 84, 88].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.28, gain: 0.1, t: t + i * 0.08 }); }); noise({ t: t + 0.35, dur: 0.4, gain: 0.04, filter: 'highpass', freq: 6000 }); },
    dead: function () { const t = ctx.currentTime; [69, 65, 62, 57].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.5, gain: 0.12, t: t + i * 0.3, lp: 1500 }); }); },
    win: function () { const t = ctx.currentTime; [60, 64, 67, 72, 76, 79, 84].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.4, gain: 0.11, t: t + i * 0.1 }); }); noise({ t: t + 0.5, dur: 0.8, gain: 0.05, filter: 'highpass', freq: 5000 }); }
  };

  // ---------- music: procedural loop, 4 bars, D minor ----------
  const BPM = 98, STEP = 60 / BPM / 4;
  const PROG = [
    { root: 38, tones: [50, 53, 57] },   // Dm
    { root: 34, tones: [46, 50, 53] },   // Bb
    { root: 41, tones: [53, 57, 60] },   // F
    { root: 36, tones: [48, 52, 55] }    // C
  ];
  const MEL = (function () {
    const m = new Array(64).fill(0);
    [[0, 74], [3, 77], [6, 76], [8, 74], [16, 72], [19, 74], [22, 77], [24, 76], [32, 77], [35, 81], [38, 79], [40, 77], [48, 76], [51, 72], [54, 74], [56, 76], [60, 74]]
      .forEach(function (p) { m[p[0]] = p[1]; });
    return m;
  })();

  function schedStep(st, t) {
    const intensity = mode === 'menu' ? 0 : mode === 'boss' ? 2 : 1;
    const bar = Math.floor(st / 16), inBar = st % 16, ch = PROG[bar];
    if (inBar === 0) {
      ch.tones.forEach(function (n, i) {
        tone({ type: 'sawtooth', f0: midi(n), dur: STEP * 16 + 0.5, gain: intensity === 0 ? 0.035 : 0.022, attack: 0.5, t: t, dest: musBus, lp: 600, detune: i * 4 - 4 });
      });
    }
    const bassPat = intensity === 0 ? [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] :
      intensity === 1 ? [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0] : [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1];
    if (bassPat[inBar]) tone({ type: 'triangle', f0: midi(ch.root), dur: STEP * (intensity === 0 ? 8 : 1.6), gain: 0.16, t: t, dest: musBus, lp: 500 });
    if (intensity >= 1) {
      if (inBar % 4 === 0) tone({ type: 'sine', f0: 140, f1: 45, dur: 0.16, gain: 0.28, t: t, dest: musBus });
      if (inBar === 4 || inBar === 12) noise({ t: t, dur: 0.12, gain: 0.07, filter: 'bandpass', freq: 1800, q: 0.9, dest: musBus });
      if (intensity === 2 || inBar % 4 === 2) noise({ t: t, dur: 0.035, gain: intensity === 2 ? 0.03 : 0.04, filter: 'highpass', freq: 7000, dest: musBus });
    }
    const arpEvery = intensity === 0 ? 4 : 2;
    if (inBar % arpEvery === 0) {
      const k = (inBar / arpEvery) % 4, note = ch.tones[[0, 1, 2, 1][k]] + (intensity === 2 ? 24 : 12);
      const dest = ctx.createGain(); dest.gain.value = 1; dest.connect(musBus); dest.connect(delay);
      tone({ type: 'triangle', f0: midi(note), dur: STEP * 1.8, gain: intensity === 0 ? 0.05 : 0.06, t: t, dest: dest, lp: 2200 });
    }
    if (intensity >= 1 && MEL[st]) {
      const dest = ctx.createGain(); dest.gain.value = 1; dest.connect(musBus); dest.connect(delay);
      tone({ type: 'sine', f0: midi(MEL[st]), dur: STEP * 3, gain: 0.09, t: t, dest: dest, attack: 0.02 });
      tone({ type: 'triangle', f0: midi(MEL[st] + 12), dur: STEP * 2, gain: 0.02, t: t, dest: dest });
    }
  }
  function tick() {
    if (!ctx || !opt('music') || mode === 'off' || ctx.state !== 'running') return;
    while (nextTime < ctx.currentTime + 0.3) { schedStep(step, nextTime); nextTime += STEP; step = (step + 1) % 64; }
  }
  function startMusic() { if (!ctx || timer) return; nextTime = ctx.currentTime + 0.08; timer = setInterval(tick, 50); }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }
  function applyBusGains() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.cancelScheduledValues(t); sfxBus.gain.setTargetAtTime(opt('sfx') ? 1 : 0, t, 0.03);
    musBus.gain.cancelScheduledValues(t); musBus.gain.setTargetAtTime(opt('music') ? (ducked ? 0.12 : 0.3) : 0, t, 0.15);
  }
  function refreshMusic() {
    if (!ctx) return;
    if (opt('music') && mode !== 'off') startMusic(); else stopMusic();
    applyBusGains();
  }

  const Snd = {
    unlock: function () {                    // call from a user gesture
      if (!init()) return;
      if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) { /* ignore */ } }
      refreshMusic();
    },
    play: function (name, a) {
      if (!ctx || ctx.state !== 'running' || !opt('sfx')) return;
      const f = SFX[name]; if (!f) return;
      if (active > 18) return;
      active++; setTimeout(function () { active--; }, 350);
      f(a);
    },
    setMode: function (m) { if (m === mode) return; mode = m; refreshMusic(); },
    duck: function (d) { if (d !== ducked) { ducked = d; applyBusGains(); } },
    suspend: function () { if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* ignore */ } } },
    resume: function () { if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } } },
    toggle: function (k) {                   // 'music' | 'sfx' | 'vib'
      const v = !opt(k); root.Save.setting(k, v);
      if (k === 'music') refreshMusic(); else if (k === 'sfx') { applyBusGains(); if (v) Snd.play('click'); }
      else if (k === 'vib' && v) Snd.vibrate(30);
      return v;
    },
    vibrate: function (p) {
      if (!opt('vib')) return;
      try { if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(p); } catch (e) { /* ignore */ }
    }
  };
  root.Snd = Snd;
})(typeof self !== 'undefined' ? self : this);
