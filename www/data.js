// Arcane Mashup - game data (numbers and ids only; all text is in strings.js)
(function (root) {
  'use strict';

  const ELEMS = ['fire', 'ice', 'lightning', 'earth', 'wind'];
  const ELEM_BIT = { fire: 1, ice: 2, lightning: 4, earth: 8, wind: 16 };
  const ELEM_COLOR = { fire: '#ff7a2f', ice: '#6fdcff', lightning: '#ffe44a', earth: '#c49a5e', wind: '#8dffc4' };
  const ELEM_DARK = { fire: '#8c2a0a', ice: '#1d6a8c', lightning: '#8c7a10', earth: '#6a4a26', wind: '#1f8c5e' };

  // Each pair of different elements has exactly one fusion: 5 elements -> 10 fusions.
  const FUSIONS = [
    { id: 'firestorm',     a: 'fire',      b: 'wind',      cd: 7,   dur: 4,   r: 46,  dmg: 6,  tick: 0.25 },
    { id: 'frozenchain',   a: 'ice',       b: 'lightning', cd: 2.4, jumps: 4, range: 115, dmg: 12, freeze: 0.9 },
    { id: 'steamburst',    a: 'fire',      b: 'ice',       cd: 4,   r: 120, dmg: 18, knock: 70 },
    { id: 'plasmaorb',     a: 'fire',      b: 'lightning', cd: 6,   life: 5, speed: 70, range: 110, dmg: 7, tick: 0.3 },
    { id: 'magma',         a: 'fire',      b: 'earth',     cd: 3.5, n: 3,  r: 34,  life: 4, dmg: 5, tick: 0.3, range: 220 },
    { id: 'glacier',       a: 'ice',       b: 'earth',     cd: 4.5, n: 6,  gap: 34, r: 22, dmg: 16, delay: 0.07 },
    { id: 'blizzard',      a: 'ice',       b: 'wind',      r: 70,  dmg: 3,  tick: 0.4 },
    { id: 'thunderpillar', a: 'lightning', b: 'earth',     cd: 3.2, n: 3,  r: 28,  dmg: 24, delay: 0.5, range: 240 },
    { id: 'ionorbit',      a: 'lightning', b: 'wind',      n: 3,   orbitR: 54, spin: 3, dmg: 6, hitcd: 0.4, r: 9 },
    { id: 'sandstorm',     a: 'earth',     b: 'wind',      cd: 5,   n: 10, speed: 200, life: 0.75, dmg: 8, r: 7 }
  ];
  const FUSION_BY_PAIR = {};
  FUSIONS.forEach(function (f, i) {
    f.idx = i;
    f.mask = ELEM_BIT[f.a] | ELEM_BIT[f.b];
    FUSION_BY_PAIR[f.a + '+' + f.b] = f;
    FUSION_BY_PAIR[f.b + '+' + f.a] = f;
  });

  // Base spells, one per element. Level 1..5 scaling is applied in core.
  const SPELLS = {
    fire:      { cd: 1.1, dmg: 14, speed: 250, r: 6,  splash: 36, burn: 4, burnT: 2, range: 270 },
    ice:       { cd: 1.0, dmg: 13, speed: 300, r: 6,  pierce: 2, slow: 0.45, slowT: 1.6, range: 270 },
    lightning: { cd: 1.4, dmg: 11, jumps: 2, range: 160, jr: 100 },
    earth:     { cd: 1.9, dmg: 24, speed: 150, r: 11, pierce: 3, knock: 30, range: 250 },
    wind:      { cd: 1.0, dmg: 11, speed: 380, r: 10, pierce: 5, knock: 22, range: 270 }
  };
  const MAX_SPELL_LVL = 5;
  const SLOTS = 4;

  const ENEMIES = {
    grunt:  { hp: 14, spd: 44, r: 9,  dmg: 8,  xp: 1, color: '#8a5cc2', dark: '#3b1f63' },
    runner: { hp: 8,  spd: 80, r: 7,  dmg: 6,  xp: 1, color: '#e0508c', dark: '#6a1838' },
    brute:  { hp: 60, spd: 30, r: 14, dmg: 14, xp: 4, color: '#5a80b8', dark: '#1d3358' }
  };

  const BOSSES = {
    colossus: { el: 'fire',      weak: 'ice',   hp: 1700, spd: 30, r: 26, dmg: 18, at: 150, color: '#ff6a2a', dark: '#5a1608' },
    wraith:   { el: 'lightning', weak: 'earth', hp: 3400, spd: 46, r: 20, dmg: 22, at: 300, color: '#ffe44a', dark: '#5a4c08' }
  };
  const BOSS_ORDER = ['colossus', 'wraith'];
  const WEAK_MUL = 2.0, RESIST_MUL = 0.4;

  const MAGES = {
    fire: { start: 'fire', cost: 0,   perk: { dmg: 0.10 },                 color: '#ff7a2f' },
    ice:  { start: 'ice',  cost: 300, perk: { hp: 15, freeze: 0.2, dmg: 0.05 },       color: '#6fdcff' },
    wind: { start: 'wind', cost: 500, perk: { speed: 0.12, magnet: 0.12 }, color: '#8dffc4' }
  };
  const MAGE_ORDER = ['fire', 'ice', 'wind'];

  // Permanent upgrades (bought with coins)
  const PERM = {
    vit:     { max: 10, cost: 40, grow: 1.45, color: '#ff6b81' },
    power:   { max: 10, cost: 60, grow: 1.5,  color: '#ff9f43' },
    swift:   { max: 8,  cost: 50, grow: 1.5,  color: '#8dffc4' },
    wisdom:  { max: 8,  cost: 55, grow: 1.5,  color: '#b794f6' },
    magnet:  { max: 6,  cost: 35, grow: 1.5,  color: '#6fdcff' },
    fortune: { max: 8,  cost: 70, grow: 1.55, color: '#ffe44a' }
  };
  const PERM_ORDER = ['vit', 'power', 'swift', 'wisdom', 'magnet', 'fortune'];

  const PASSIVES = ['hp', 'speed', 'magnet', 'haste', 'might'];

  const PLAYER = { hp: 100, speed: 118, r: 10, pickup: 48, iframes: 0.55 };

  const Data = {
    ELEMS, ELEM_BIT, ELEM_COLOR, ELEM_DARK, FUSIONS, FUSION_BY_PAIR, SPELLS, MAX_SPELL_LVL, SLOTS,
    ENEMIES, BOSSES, BOSS_ORDER, WEAK_MUL, RESIST_MUL, MAGES, MAGE_ORDER, PERM, PERM_ORDER, PASSIVES, PLAYER,
    ARENA: 1536,
    FIRST_FUSION_BONUS: 25,
    permCost: function (id, lvl) { const p = PERM[id]; return Math.round(p.cost * Math.pow(p.grow, lvl)); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Data; else root.Data = Data;
})(typeof self !== 'undefined' ? self : this);
