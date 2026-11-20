// Arcane Mashup - local save (level progress, coins, settings, best result). Offline, localStorage only.
(function (root) {
  'use strict';
  const KEY = 'arcane_mashup_save_v1';

  function fresh() {
    return {
      v: 1,
      coins: 0,
      best: { time: 0, level: 0, kills: 0, won: false },
      mage: 'fire',
      mages: { fire: true },
      perm: {},
      disc: {},            // discovered fusions { fusionId: true }
      runs: 0, wins: 0,
      settings: { music: true, sfx: true, vib: true }
    };
  }

  let d = fresh();
  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) {
        const j = JSON.parse(raw), f = fresh();
        d = Object.assign(f, j);
        d.best = Object.assign(f.best, j.best || {});
        d.settings = Object.assign(f.settings, j.settings || {});
        d.mages = Object.assign({ fire: true }, j.mages || {});
        d.perm = j.perm || {}; d.disc = j.disc || {};
      }
    } catch (e) { d = fresh(); }
    return d;
  }
  function save() {
    try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable: ignore */ }
  }

  const Save = {
    get data() { return d; },
    load: load,
    save: save,
    reset: function () { d = fresh(); save(); },
    addCoins: function (n) { d.coins += Math.max(0, Math.floor(n)); save(); },
    spend: function (n) { if (d.coins < n) return false; d.coins -= n; save(); return true; },
    setting: function (k, v) { if (v !== undefined) { d.settings[k] = v; save(); } return d.settings[k]; },
    discovered: function () { return d.disc; },
    discover: function (id) { if (d.disc[id]) return false; d.disc[id] = true; save(); return true; },
    discoveredCount: function () { return Object.keys(d.disc).length; },
    recordRun: function (r, countRun) {
      if (countRun !== false) { d.runs++; if (r.won) d.wins++; }
      if (r.time > d.best.time) d.best.time = Math.floor(r.time);
      if (r.level > d.best.level) d.best.level = r.level;
      if (r.kills > d.best.kills) d.best.kills = r.kills;
      if (r.won) d.best.won = true;
      save();
    }
  };
  load();
  root.Save = Save;
})(typeof self !== 'undefined' ? self : this);
