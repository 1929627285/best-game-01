// Glowgarden tuning: every number that shapes how the game feels lives here,
// so balance can be adjusted without touching the rules in the other files.
export const FIELD = { width: 960, height: 540 };

// The fixed simulation step. The renderer interpolates nothing: it draws the
// state after each whole step, so a staged screenshot is the same every run.
export const STEP = 1 / 60;

export const NIGHTS_TO_WIN = 8;
export const BREAK_SECONDS = 5;

export const PLAYER = {
  startX: FIELD.width / 2,
  startY: FIELD.height / 2 + 90,
  radius: 14,
  speed: 232,
  maxHearts: 6,
  invulnerableSeconds: 1.1,
  knockback: 260,
  pulseRadius: 118,
  pulseDamage: 1,
  pulseCooldown: 0.85,
  magnetRadius: 90,
  xpBase: 8,
  xpGrowth: 4,
};

export const HEART = {
  x: FIELD.width / 2,
  y: FIELD.height / 2 - 40,
  radius: 26,
  maxHp: 120,
  nightHeal: 12,
};

export const BLOOM = {
  cost: 25,
  max: 6,
  radius: 16,
  hp: 3,
  zapRange: 175,
  zapCooldown: 0.8,
  zapDamage: 1,
  plantRange: 210,
};

// Wisp kinds, in the order they join the nights. Speeds are px/s; a wisp's
// touch damage is always 1 heart, so bulkier kinds are slow instead of deadly.
export const WISP_KINDS = {
  drifter: { hp: 2, speed: 52, radius: 13, score: 10, dew: 4, firstNight: 1, weight: 10 },
  darter: { hp: 1, speed: 128, radius: 10, score: 15, dew: 4, firstNight: 2, weight: 6 },
  spitter: { hp: 2, speed: 46, radius: 13, score: 25, dew: 6, firstNight: 3, weight: 5 },
  bulwark: { hp: 7, speed: 34, radius: 21, score: 30, dew: 9, firstNight: 4, weight: 4 },
};

export const BOSS = {
  hp: 70,
  speed: 40,
  radius: 34,
  score: 500,
  dew: 40,
  burstEvery: 6,
  burstBolts: 12,
  summonEvery: 10,
  summonCount: 3,
};

export const BOLT = { speed: 170, radius: 6, damage: 1, life: 4 };

export const NIGHT_BUDGET = (night) => 6 + night * 4;
export const SPAWN_INTERVAL = (night) => Math.max(0.55, 1.5 - night * 0.12);
export const NIGHT_CLEAR_BONUS = (night) => 100 * night;

// Pickups: motes feed the level bar, dew buys blooms, petals are pure score.
export const PICKUP = { moteValue: 1, magnetSpeed: 320, life: 12, petalScore: 25 };

export const AUDIO = { musicVolume: 0.05, sfxVolume: 0.5 };

export const SHOT = { seed: 1, startSeconds: 5, upgradeCapSeconds: 240, victoryCapSeconds: 420 };
