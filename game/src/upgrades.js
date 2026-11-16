// The level-up upgrades: one choice of three, each with a stack limit, so a
// run's build is the player's own. `apply` mutates the player or the garden;
// `describe` is the card text the choice screen shows.
export const UPGRADE_POOL = [
  {
    id: 'radius',
    name: 'Wider Lantern',
    icon: 'ring',
    maxStacks: 4,
    describe: () => '+25% pulse radius',
    apply: (state) => {
      state.player.pulseRadius *= 1.25;
    },
  },
  {
    id: 'damage',
    name: 'Bright Pulse',
    icon: 'star',
    maxStacks: 4,
    describe: () => '+1 pulse damage',
    apply: (state) => {
      state.player.pulseDamage += 1;
    },
  },
  {
    id: 'cooldown',
    name: 'Quick Charge',
    icon: 'bolt',
    maxStacks: 3,
    describe: () => 'Pulse recharges 18% faster',
    apply: (state) => {
      state.player.pulseCooldown *= 0.82;
    },
  },
  {
    id: 'speed',
    name: 'Swift Wings',
    icon: 'wing',
    maxStacks: 3,
    describe: () => '+12% movement speed',
    apply: (state) => {
      state.player.speed *= 1.12;
    },
  },
  {
    id: 'hearts',
    name: 'Hardy Petals',
    icon: 'heart',
    maxStacks: 3,
    describe: () => '+1 max heart, and heal 1',
    apply: (state) => {
      state.player.maxHearts += 1;
      state.player.hearts = Math.min(state.player.maxHearts, state.player.hearts + 1);
    },
  },
  {
    id: 'blooms',
    name: 'Bloom Power',
    icon: 'flower',
    maxStacks: 4,
    describe: () => 'Blooms zap faster and harder',
    apply: (state) => {
      state.player.bloomPower += 1;
      for (const bloom of state.blooms) bloom.level += 1;
    },
  },
  {
    id: 'magnet',
    name: 'Dew Magnet',
    icon: 'magnet',
    maxStacks: 3,
    describe: () => '+60% pickup radius',
    apply: (state) => {
      state.player.magnetRadius *= 1.6;
    },
  },
  {
    id: 'thorns',
    name: 'Thorn Vines',
    icon: 'thorn',
    maxStacks: 2,
    describe: () => 'Attackers take 2 damage back',
    apply: (state) => {
      state.player.thorns += 2;
    },
  },
  {
    id: 'chain',
    name: 'Chain Spark',
    icon: 'chain',
    maxStacks: 3,
    describe: () => 'Pulse chains to +2 nearby wisps',
    apply: (state) => {
      state.player.chainSparks += 2;
    },
  },
  {
    id: 'seeds',
    name: 'Star Seeds',
    icon: 'seed',
    maxStacks: 3,
    describe: () => 'Planting costs 5 less dew',
    apply: (state) => {
      state.player.bloomCost = Math.max(5, state.player.bloomCost - 5);
    },
  },
  {
    id: 'ward',
    name: 'Garden Ward',
    icon: 'shield',
    maxStacks: 3,
    describe: () => 'Heart +25 max health, heal 25',
    apply: (state) => {
      state.heart.maxHp += 25;
      state.heart.hp = Math.min(state.heart.maxHp, state.heart.hp + 25);
    },
  },
  {
    id: 'revive',
    name: 'Second Wind',
    icon: 'phoenix',
    maxStacks: 1,
    describe: () => 'Once: survive a fatal hit at half hearts',
    apply: (state) => {
      state.player.reviveReady = true;
    },
  },
];

/** Roll three distinct upgrades the player can still stack. */
export function rollUpgrades(state) {
  const available = UPGRADE_POOL.filter((upgrade) => (state.player.stacks[upgrade.id] || 0) < upgrade.maxStacks);
  const choices = [];
  const pool = [...available];
  while (choices.length < 3 && pool.length > 0) {
    const index = Math.floor(state.rng() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  // If every upgrade is maxed, offer healing instead of an empty choice.
  while (choices.length < 3) {
    choices.push({
      id: 'mend',
      name: 'Moon Mend',
      icon: 'heart',
      maxStacks: 99,
      describe: () => 'Heal 2 hearts and mend the heart +20',
      apply: (s) => {
        s.player.hearts = Math.min(s.player.maxHearts, s.player.hearts + 2);
        s.heart.hp = Math.min(s.heart.maxHp, s.heart.hp + 20);
      },
    });
  }
  return choices;
}

/** Apply the chosen upgrade and record its stack. */
export function applyUpgrade(state, upgrade) {
  state.player.stacks[upgrade.id] = (state.player.stacks[upgrade.id] || 0) + 1;
  upgrade.apply(state);
  state.upgradesTaken.push(upgrade.name);
}
