// Arcane Mashup - ALL user-visible text lives in this file (translate here).
(function (root) {
  'use strict';
  const TXT = {
    title: 'ARCANE MASHUP',
    tagline: 'Mix elements. Break the rules.',
    play: 'PLAY',
    grimoire: 'Grimoire',
    upgrades: 'Upgrades',
    settings: 'Settings',
    back: 'Back',
    close: 'Close',
    resume: 'Resume',
    quit: 'Quit run',
    retry: 'Try again',
    menu: 'Menu',
    music: 'Music',
    sfx: 'Effects',
    vibration: 'Vibration',
    on: 'ON',
    off: 'OFF',
    best: 'Best',
    coins: 'Coins',
    paused: 'PAUSED',
    levelUp: 'LEVEL UP!',
    chooseOne: 'Choose one',
    reroll: 'Reroll',
    newSpell: 'New spell',
    upgradeLabel: 'Upgrade',
    maxed: 'MAX',
    lvl: 'Lv',
    fusionNew: 'NEW FUSION',
    fusionUnlocks: 'Unlocks a fusion!',
    fusionWith: '+',
    undiscovered: 'Undiscovered',
    undiscoveredHint: 'Keep mixing spells to find it.',
    discovered: 'Discovered',
    discoveredCount: 'Discovered',
    firstFusionBonus: 'first discovery bonus',
    weakTo: 'Weak to',
    resists: 'Resists',
    victory: 'VICTORY!',
    defeat: 'YOU FELL',
    time: 'Time',
    kills: 'Kills',
    level: 'Level',
    fusionsUsed: 'Fusions',
    coinsEarned: 'Coins earned',
    revive: 'Revive',
    doubleCoins: 'Double coins',
    watchAd: 'Watch ad',
    adPlaying: 'Ad',
    adCooldown: 'Wait',
    adReward: 'Reward!',
    adSimNote: 'Test ad (simulated)',
    unlock: 'Unlock',
    unlocked: 'Unlocked',
    selected: 'Selected',
    select: 'Select',
    notEnough: 'Not enough coins',
    maxLevel: 'MAX',
    startSpell: 'Starts with',
    chooseMage: 'Choose your mage',
    map: 'Ruined Courtyard',
    bossIncoming: 'A BOSS APPROACHES',
    bossDown: 'BOSS DEFEATED',
    swarm: 'SWARM!',
    fusionActive: 'Fusion',
    hintMove: 'Drag to move',
    hintPick: 'Tap a card',
    heal: 'Heal',
    healDesc: 'Restore 40% health.',
    quitConfirm: 'Quit this run?',
    yes: 'Yes',
    no: 'No',
    runBonus: 'Run bonus',
    newBest: 'New best!',

    elements: {
      fire: 'Fire', ice: 'Ice', lightning: 'Lightning', earth: 'Earth', wind: 'Wind'
    },

    spells: {
      fire:      { name: 'Fireball',   desc: 'Hurls a fireball that burns.' },
      ice:       { name: 'Frost Shard', desc: 'Piercing shard that slows foes.' },
      lightning: { name: 'Arc Bolt',   desc: 'Lightning that jumps between foes.' },
      earth:     { name: 'Boulder',    desc: 'Heavy rock that smashes and shoves.' },
      wind:      { name: 'Gale Slash', desc: 'Fast crescent that cuts through lines.' }
    },

    fusions: {
      firestorm:     { name: 'Firestorm',     desc: 'A roaming fire tornado that scorches everything.' },
      frozenchain:   { name: 'Frozen Chain',  desc: 'Chain lightning that freezes each target.' },
      steamburst:    { name: 'Steam Burst',   desc: 'Scalding blast around you that knocks foes away.' },
      plasmaorb:     { name: 'Plasma Orb',    desc: 'A slow orb that zaps nearby enemies.' },
      magma:         { name: 'Magma Pools',   desc: 'Molten pools erupt beneath enemies.' },
      glacier:       { name: 'Glacier Spikes', desc: 'A line of ice spikes bursts from the ground.' },
      blizzard:      { name: 'Blizzard',      desc: 'A freezing aura that chills and cuts.' },
      thunderpillar: { name: 'Thunder Pillars', desc: 'Lightning pillars strike random foes and stun them.' },
      ionorbit:      { name: 'Ion Orbit',     desc: 'Charged orbs circle you and shock on contact.' },
      sandstorm:     { name: 'Sandstorm',     desc: 'A ring of razor sand flies out in all directions.' }
    },

    passives: {
      hp:     { name: 'Vitality',  desc: '+20 max health and heal 20.' },
      speed:  { name: 'Swift Feet', desc: '+8% move speed.' },
      magnet: { name: 'Magnet',    desc: '+30% pickup range.' },
      haste:  { name: 'Arcane Haste', desc: 'Spells cast 8% faster.' },
      might:  { name: 'Arcane Might', desc: '+10% spell damage.' }
    },

    mages: {
      fire: { name: 'Pyra',  title: 'Fire Mage',  perk: '+10% spell damage' },
      ice:  { name: 'Frey',  title: 'Ice Mage',   perk: '+15 health, longer freezes' },
      wind: { name: 'Zeph',  title: 'Wind Mage',  perk: '+12% speed, bigger pickup range' }
    },

    perm: {
      vit:     { name: 'Vitality',   desc: '+10 max health per level' },
      power:   { name: 'Power',      desc: '+5% spell damage per level' },
      swift:   { name: 'Swiftness',  desc: '+3% move speed per level' },
      wisdom:  { name: 'Wisdom',     desc: '+6% experience per level' },
      magnet:  { name: 'Magnetism',  desc: '+10% pickup range per level' },
      fortune: { name: 'Fortune',    desc: '+8% coins per run per level' }
    },

    bosses: {
      colossus: { name: 'Cinder Colossus' },
      wraith:   { name: 'Tempest Wraith' }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TXT; else root.TXT = TXT;
})(typeof self !== 'undefined' ? self : this);
