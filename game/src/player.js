// Pip, the firefly gardener: movement, the lantern pulse, damage and levels.
// The pulse is radial and instant, so it answers the moment the key or mouse
// goes down; the expanding ring is only the visual echo of the hit.
import { BLOOM, FIELD, PLAYER } from './config.js';
import { damageWisp } from './wisps.js';
import { addShake, floatText, spawnBurst, spawnRing, spawnZap } from './particles.js';

export function createPlayer() {
  return {
    x: PLAYER.startX,
    y: PLAYER.startY,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    speed: PLAYER.speed,
    hearts: PLAYER.maxHearts,
    maxHearts: PLAYER.maxHearts,
    iframes: 0,
    pulseTimer: 0,
    pulseRadius: PLAYER.pulseRadius,
    pulseDamage: PLAYER.pulseDamage,
    pulseCooldown: PLAYER.pulseCooldown,
    magnetRadius: PLAYER.magnetRadius,
    thorns: 0,
    chainSparks: 0,
    bloomCost: BLOOM.cost,
    bloomPower: 0,
    stacks: {},
    reviveReady: false,
    reviveUsed: false,
    xp: 0,
    xpNext: PLAYER.xpBase,
    level: 1,
    facing: 1,
    walkPhase: 0,
    moving: false,
    dead: false,
  };
}

/** Move, recharge the pulse, and fire it when asked. */
export function updatePlayer(state, dt, move, wantsPulse) {
  const player = state.player;
  if (player.dead) return;
  player.iframes = Math.max(0, player.iframes - dt);
  player.pulseTimer = Math.max(0, player.pulseTimer - dt);

  const speed = player.speed;
  player.vx = move.x * speed;
  player.vy = move.y * speed;
  player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
  player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
  player.moving = move.x !== 0 || move.y !== 0;
  if (move.x !== 0) player.facing = move.x > 0 ? 1 : -1;
  if (player.moving) player.walkPhase += dt * 10;

  if (wantsPulse && player.pulseTimer <= 0) firePulse(state);
}

/** The lantern pulse: damage everything in range, then chain sparks beyond it. */
export function firePulse(state) {
  const player = state.player;
  player.pulseTimer = player.pulseCooldown;
  state.pulsesFired += 1;
  spawnRing(state, player.x, player.y, { color: '#ffd97a', maxRadius: player.pulseRadius, life: 0.32 });
  spawnBurst(state, player.x, player.y, { count: 14, color: '#ffe9a8', speed: 200, size: 3, life: 0.4 });
  state.audio.pulse();
  addShake(state, 2);

  const inRange = [];
  const beyond = [];
  for (const wisp of state.wisps) {
    const dx = wisp.x - player.x;
    const dy = wisp.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= player.pulseRadius + wisp.radius) inRange.push({ wisp, distance });
    else if (distance <= player.pulseRadius + 170 + wisp.radius) beyond.push({ wisp, distance });
  }
  for (const { wisp } of inRange) damageWisp(state, wisp, player.pulseDamage);
  beyond.sort((a, b) => a.distance - b.distance);
  let chains = player.chainSparks;
  let fromX = player.x;
  let fromY = player.y;
  for (const { wisp } of beyond) {
    if (chains <= 0) break;
    chains -= 1;
    spawnZap(state, fromX, fromY, wisp.x, wisp.y, '#9fe8ff');
    damageWisp(state, wisp, 1);
    fromX = wisp.x;
    fromY = wisp.y;
  }
  if (inRange.length > 0) state.audio.zap();
}

/** Hurt the player, with knockback, brief invulnerability and thorns payback. */
export function damagePlayer(state, amount, source) {
  const player = state.player;
  if (player.dead || player.iframes > 0) return;
  player.hearts -= amount;
  player.iframes = PLAYER.invulnerableSeconds;
  state.flash = 1;
  addShake(state, 9);
  state.audio.hurt();
  spawnBurst(state, player.x, player.y, { count: 16, color: '#ff8a7a', speed: 180, size: 3, life: 0.5 });
  if (source) {
    const dx = player.x - source.x;
    const dy = player.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + (dx / distance) * 26));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + (dy / distance) * 26));
    if (player.thorns > 0 && source.wisp) damageWisp(state, source.wisp, player.thorns);
  }
  if (player.hearts <= 0) {
    if (player.reviveReady && !player.reviveUsed) {
      player.reviveUsed = true;
      player.reviveReady = false;
      player.hearts = Math.max(1, Math.ceil(player.maxHearts / 2));
      player.iframes = 2;
      spawnRing(state, player.x, player.y, { color: '#8affc1', maxRadius: 220, life: 0.6 });
      floatText(state, player.x, player.y - 30, 'Second Wind!', '#8affc1', 20);
      state.audio.levelUp();
      return;
    }
    player.dead = true;
    player.hearts = 0;
  }
}

/** Feed the level bar; each level queues one upgrade choice. */
export function gainXp(state, amount) {
  const player = state.player;
  player.xp += amount;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level += 1;
    player.xpNext = PLAYER.xpBase + player.level * PLAYER.xpGrowth;
    state.pendingLevels += 1;
  }
}
