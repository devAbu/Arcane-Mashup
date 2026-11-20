// Arcane Mashup - AdService: the ONLY place that knows about ads.
//
// Rewarded video only (hint/reroll, revive, bonus). No banners, no forced ads.
// Right now this module SIMULATES an ad: a short countdown on the button, then the reward, then a cooldown.
// To use real AdMob later, replace the body of `start()` below with the SDK call and invoke `finish(p)`
// from the SDK's "user earned reward" callback. The rest of the game only uses isReady / status / show.
(function (root) {
  'use strict';

  const SIM_SECONDS = 3;                 // length of the simulated ad
  const COOLDOWN = { reroll: 15, revive: 10, double: 10 };   // seconds before the same placement can be used again

  const st = {};                         // per placement: { phase: 'idle'|'playing'|'cooldown', until: ms, cb: fn }
  function now() { return Date.now(); }
  function get(p) { return st[p] || (st[p] = { phase: 'idle', until: 0, cb: null }); }

  function refresh(p) {
    const s = get(p), t = now();
    if (s.phase !== 'idle' && t >= s.until) {
      if (s.phase === 'playing') { finish(p); } else s.phase = 'idle';
    }
    return s;
  }
  function finish(p) {
    const s = get(p), cb = s.cb; s.cb = null;
    s.phase = 'cooldown'; s.until = now() + (COOLDOWN[p] || 10) * 1000;
    if (cb) { try { cb(); } catch (e) { /* ignore */ } }
  }
  function start(p) {
    // --- simulated ad. Replace with the real SDK call; call finish(p) when the reward is earned. ---
    const s = get(p);
    s.phase = 'playing'; s.until = now() + SIM_SECONDS * 1000;
  }

  const AdService = {
    simulated: true,
    // true when the placement can be started right now
    isReady: function (p) { return refresh(p).phase === 'idle'; },
    // { phase, left } where left is whole seconds remaining of the countdown / cooldown
    status: function (p) {
      const s = refresh(p);
      return { phase: s.phase, left: s.phase === 'idle' ? 0 : Math.max(1, Math.ceil((s.until - now()) / 1000)) };
    },
    // begin an ad; onReward runs once when the player has earned the reward
    show: function (p, onReward) {
      const s = refresh(p);
      if (s.phase !== 'idle') return false;
      s.cb = onReward || null;
      start(p);
      return true;
    },
    // call every frame while an ad is counting down so the reward fires on time
    tick: function () { Object.keys(st).forEach(refresh); }
  };
  root.AdService = AdService;
})(typeof self !== 'undefined' ? self : this);
