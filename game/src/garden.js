// The garden itself: the world state, the nights, spawning, blooms, pickups,
// bolts and the win/lose rules. stepWorld advances one fixed step of the
// whole simulation; the renderer only ever draws the state it leaves behind.
import { BLOOM, BREAK_SECONDS, FIELD, HEART, NIGHTS_TO_WIN, NIGHT_BUDGET, NIGHT_CLEAR_BONUS, PICKUP, SPAWN_INTERVAL } from './config.js';
import { borderPoint, makeRng, range } from './random.js';
import { createPlayer, damagePlayer, gainXp, updatePlayer } from './player.js';
import { damageWisp, rollKind, spawnBoss, spawnWisp, updateWisps } from './wisps.js';
import { addShake, floatText, spawnBurst, spawnRing, spawnSparkle, spawnZap, updateEffects } from './particles.js';

export function createWorld(seed, audio, best = 0) {
  const rng = makeRng(seed);
  const visual = makeRng(1234);
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: visual() * FIELD.width, y: visual() * FIELD.height * 0.55, r: 0.6 + visual() * 1.4, phase: visual() * Math.PI * 2 });
  }
  const tufts = [];
  for (let i = 0; i < 70; i += 1) {
    tufts.push({ x: visual() * FIELD.width, y: FIELD.height * 0.66 + visual() * FIELD.height * 0.34, phase: visual() * Math.PI * 2, tall: 5 + visual() * 7 });
  }
  const fireflies = [];
  for (let i = 0; i < 16; i += 1) {
    fireflies.push({ x: visual() * FIELD.width, y: visual() * FIELD.height, phase: visual() * Math.PI * 2, speed: 8 + visual() * 14 });
  }
  return {
    seed,
    rng,
    audio,
    time: 0,
    elapsed: 0,
    screen: 'title',
    outcome: null,
    outcomeReason: '',
    player: createPlayer(),
    heart: { x: HEART.x, y: HEART.y, radius: HEART.radius, hp: HEART.maxHp, maxHp: HEART.maxHp, hitFlash: 0 },
    wisps: [],
    bolts: [],
    blooms: [],
    pickups: [],
    particles: [],
    texts: [],
    stars,
    tufts,
    fireflies,
    night: 0,
    nightState: 'break',
    breakTimer: 2.5,
    spawnQueue: 0,
    spawnTimer: 0,
    bossSpawned: false,
    bossDown: false,
    boss: null,
    score: 0,
    dew: 20,
    kills: 0,
    bloomsPlanted: 0,
    pulsesFired: 0,
    pendingLevels: 0,
    upgradesTaken: [],
    shake: 0,
    flash: 0,
    best,
    banner: { text: 'Night 1 approaches', sub: 'Keep the garden glowing', timer: 2.5 },
  };
}

export function setBanner(state, text, sub, seconds = 2.5) {
  state.banner = { text, sub, timer: seconds };
}

/** Open the next night: a spawn queue, and the Moth King on the last one. */
export function startNight(state) {
  state.night += 1;
  state.spawnQueue = NIGHT_BUDGET(state.night);
  state.spawnTimer = 0.6;
  state.nightState = 'active';
  setBanner(state, `Night ${state.night}`, state.night === NIGHTS_TO_WIN ? 'Something huge moves in the dark…' : 'The wisps are coming');
  if (state.night === NIGHTS_TO_WIN) {
    state.bossSpawned = true;
    spawnBoss(state);
  }
}

/** Hurt the garden heart; at zero the garden falls dark. */
export function damageHeart(state, amount) {
  const heart = state.heart;
  if (heart.hp <= 0) return;
  heart.hp = Math.max(0, heart.hp - amount);
  heart.hitFlash = 0.2;
  addShake(state, 5);
  state.flash = Math.max(state.flash, 0.5);
  state.audio.hurt();
  spawnBurst(state, heart.x, heart.y, { count: 10, color: '#7fe8d4', speed: 140, size: 3, life: 0.5 });
}

/** Plant a glowbloom: it zaps nearby wisps until they tear it down. */
export function plantBloom(state, x, y) {
  const player = state.player;
  if (player.dead) return false;
  if (state.dew < player.bloomCost) {
    floatText(state, player.x, player.y - 26, 'Need more dew!', '#9fb4d8', 13);
    return false;
  }
  if (state.blooms.length >= BLOOM.max) {
    floatText(state, player.x, player.y - 26, 'The garden is full!', '#9fb4d8', 13);
    return false;
  }
  const px = Math.min(FIELD.width - BLOOM.radius, Math.max(BLOOM.radius, x));
  const py = Math.min(FIELD.height - BLOOM.radius, Math.max(BLOOM.radius, y));
  if (Math.hypot(px - state.heart.x, py - state.heart.y) < 70) return false;
  for (const bloom of state.blooms) {
    if (Math.hypot(px - bloom.x, py - bloom.y) < 48) return false;
  }
  state.dew -= player.bloomCost;
  state.blooms.push({
    x: px,
    y: py,
    hp: BLOOM.hp,
    maxHp: BLOOM.hp,
    radius: BLOOM.radius,
    zapTimer: 0.3,
    level: player.bloomPower,
    phase: state.rng() * Math.PI * 2,
    hitFlash: 0,
    born: state.time,
  });
  state.bloomsPlanted += 1;
  state.score += 5;
  state.audio.plant();
  spawnRing(state, px, py, { color: '#ffb3e2', maxRadius: 60, life: 0.4 });
  spawnSparkle(state, px, py, '#ffb3e2');
  return true;
}

function updateBlooms(state, dt) {
  for (const bloom of state.blooms) {
    bloom.hitFlash = Math.max(0, bloom.hitFlash - dt);
    bloom.zapTimer -= dt;
    if (bloom.zapTimer > 0) continue;
    let nearest = null;
    let nearestDistance = BLOOM.zapRange;
    for (const wisp of state.wisps) {
      const distance = Math.hypot(wisp.x - bloom.x, wisp.y - bloom.y);
      if (distance < nearestDistance) {
        nearest = wisp;
        nearestDistance = distance;
      }
    }
    if (!nearest) continue;
    const cooldown = Math.max(0.35, BLOOM.zapCooldown - bloom.level * 0.08);
    const damage = BLOOM.zapDamage + Math.floor(bloom.level / 2);
    bloom.zapTimer = cooldown;
    spawnZap(state, bloom.x, bloom.y - 10, nearest.x, nearest.y, '#ffd1ec');
    spawnBurst(state, nearest.x, nearest.y, { count: 4, color: '#ffd1ec', speed: 80, size: 2, life: 0.3 });
    state.audio.zap();
    damageWisp(state, nearest, damage);
  }
}

function updateBolts(state, dt) {
  const player = state.player;
  for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
    const bolt = state.bolts[i];
    bolt.life -= dt;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    if (state.rng() < 0.5) {
      state.particles.push({ x: bolt.x, y: bolt.y, vx: 0, vy: 0, life: 0.2, maxLife: 0.2, size: 3, color: '#b48aff', drag: 0 });
    }
    let spent = bolt.life <= 0 || bolt.x < 0 || bolt.x > FIELD.width || bolt.y < 0 || bolt.y > FIELD.height;
    if (!spent && !player.dead && Math.hypot(bolt.x - player.x, bolt.y - player.y) < bolt.radius + player.radius) {
      damagePlayer(state, bolt.damage, { x: bolt.x - bolt.vx * 0.1, y: bolt.y - bolt.vy * 0.1 });
      spent = true;
    }
    if (!spent && Math.hypot(bolt.x - state.heart.x, bolt.y - state.heart.y) < bolt.radius + state.heart.radius) {
      damageHeart(state, 4);
      spent = true;
    }
    if (spent) state.bolts.splice(i, 1);
  }
}

function updatePickups(state, dt) {
  const player = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = state.pickups[i];
    pickup.life -= dt;
    pickup.phase += dt * 4;
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (!player.dead && distance < player.magnetRadius) {
      const pull = PICKUP.magnetSpeed * (1 - distance / (player.magnetRadius * 1.6));
      pickup.vx += (dx / distance) * pull * dt * 4;
      pickup.vy += (dy / distance) * pull * dt * 4;
    }
    pickup.vx *= 1 - Math.min(1, 2.5 * dt);
    pickup.vy *= 1 - Math.min(1, 2.5 * dt);
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    if (pickup.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }
    if (!player.dead && distance < player.radius + 10) {
      if (pickup.kind === 'mote') {
        gainXp(state, pickup.value);
        state.audio.pickup();
        spawnSparkle(state, pickup.x, pickup.y, '#9fe8ff');
      } else if (pickup.kind === 'dew') {
        state.dew += pickup.value;
        state.audio.coin();
        floatText(state, pickup.x, pickup.y - 10, `+${pickup.value} dew`, '#9fe8ff', 12);
      } else {
        state.score += PICKUP.petalScore;
        state.audio.coin();
        floatText(state, pickup.x, pickup.y - 10, `+${PICKUP.petalScore}`, '#ffb3e2', 13);
      }
      state.pickups.splice(i, 1);
    }
  }
}

function updateNights(state, dt) {
  if (state.nightState === 'break') {
    state.breakTimer -= dt;
    if (state.breakTimer <= 0) startNight(state);
    return;
  }
  if (state.nightState !== 'active') return;
  if (state.spawnQueue > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = SPAWN_INTERVAL(state.night);
      const point = borderPoint(state.rng, FIELD.width, FIELD.height, 26);
      spawnWisp(state, rollKind(state, state.night), point.x, point.y);
      state.spawnQueue -= 1;
    }
  }
  if (state.spawnQueue === 0 && state.wisps.length === 0) {
    if (state.night >= NIGHTS_TO_WIN && state.bossDown) return; // victory is set below
    const bonus = NIGHT_CLEAR_BONUS(state.night);
    state.score += bonus;
    state.player.hearts = Math.min(state.player.maxHearts, state.player.hearts + 1);
    state.heart.hp = Math.min(state.heart.maxHp, state.heart.hp + HEART.nightHeal);
    setBanner(state, `Night ${state.night} clear!`, `+${bonus} bonus · the garden breathes`, BREAK_SECONDS);
    state.audio.nightClear();
    state.nightState = 'break';
    state.breakTimer = BREAK_SECONDS;
  }
}

/**
 * Advance the whole simulation one fixed step. `orders` carries the player's
 * intent for this step: movement, pulse, and an optional planting point.
 */
export function stepWorld(state, dt, orders) {
  state.time += dt;
  state.elapsed += dt;
  if (state.banner.timer > 0) state.banner.timer -= dt;
  state.heart.hitFlash = Math.max(0, state.heart.hitFlash - dt);

  updateNights(state, dt);
  updatePlayer(state, dt, orders.move, orders.pulse);
  if (orders.plant) plantBloom(state, orders.plant.x, orders.plant.y);
  updateWisps(state, dt);
  updateBolts(state, dt);
  updateBlooms(state, dt);
  updatePickups(state, dt);
  updateEffects(state, dt);
  state.audio.step(dt);

  // Fireflies drift through the garden whatever else is happening.
  for (const fly of state.fireflies) {
    fly.phase += dt;
    fly.x += Math.sin(fly.phase * 0.7) * fly.speed * dt;
    fly.y += Math.cos(fly.phase * 0.5) * fly.speed * dt * 0.7;
    if (fly.x < 0) fly.x += FIELD.width;
    if (fly.x > FIELD.width) fly.x -= FIELD.width;
    if (fly.y < 0) fly.y += FIELD.height;
    if (fly.y > FIELD.height) fly.y -= FIELD.height;
  }

  if (!state.outcome) {
    if (state.player.dead) {
      state.outcome = 'lost';
      state.outcomeReason = 'Pip fell in the dark.';
    } else if (state.heart.hp <= 0) {
      state.outcome = 'lost';
      state.outcomeReason = 'The garden heart went dark.';
    } else if (state.bossDown && state.night >= NIGHTS_TO_WIN && state.spawnQueue === 0 && state.wisps.length === 0) {
      state.outcome = 'won';
      state.outcomeReason = 'The Moth King is gone. Dawn breaks over the garden.';
      state.score += 250;
    }
  }
}
