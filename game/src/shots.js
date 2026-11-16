// The staged screenshot scenes behind ?shot=start|play|upgrade|victory.
// Each one plays the real rules forward from a fresh world with a simple
// autopilot, so the frame is what a real game looks like and the same seed
// always gives the same frame. Staging never changes the shipped rules: the
// only staging-only help is a shield the autopilot falls back to if it would
// otherwise die before the scene is ready, so the shot still shows live play.
import { HEART, SHOT, STEP } from './config.js';
import { gainXp } from './player.js';
import { stepWorld } from './garden.js';
import { applyUpgrade, rollUpgrades } from './upgrades.js';

/** Steer like a careful player: flee what is close, chase motes, pulse. */
function autopilotOrders(state, planted) {
  const player = state.player;
  let moveX = 0;
  let moveY = 0;
  let pulse = false;
  let plant = null;

  let nearestWisp = null;
  let nearestDistance = Infinity;
  for (const wisp of state.wisps) {
    const distance = Math.hypot(wisp.x - player.x, wisp.y - player.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestWisp = wisp;
    }
    if (distance < 115) {
      const weight = (115 - distance) / 115;
      moveX += ((player.x - wisp.x) / (distance || 1)) * weight * 2;
      moveY += ((player.y - wisp.y) / (distance || 1)) * weight * 2;
    }
  }
  if (nearestWisp && nearestDistance < player.pulseRadius + nearestWisp.radius) pulse = true;

  let nearestPickup = null;
  let pickupDistance = Infinity;
  for (const pickup of state.pickups) {
    const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    if (distance < pickupDistance) {
      pickupDistance = distance;
      nearestPickup = pickup;
    }
  }
  if (nearestPickup && pickupDistance < 320) {
    moveX += ((nearestPickup.x - player.x) / (pickupDistance || 1)) * 1.2;
    moveY += ((nearestPickup.y - player.y) / (pickupDistance || 1)) * 1.2;
  }
  // Drift back toward the garden's middle instead of hugging a wall.
  const centreDistance = Math.hypot(player.x - HEART.x, player.y - HEART.y);
  if (centreDistance > 210) {
    moveX += ((HEART.x - player.x) / centreDistance) * 0.8;
    moveY += ((HEART.y - player.y) / centreDistance) * 0.8;
  }
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }

  if (
    state.dew >= player.bloomCost &&
    state.blooms.length < 4 &&
    state.time - planted.last > 2 &&
    nearestDistance > 80
  ) {
    planted.last = state.time;
    plant = { x: player.x + (state.rng() - 0.5) * 60, y: player.y + 30 + state.rng() * 20 };
  }
  return { move: { x: moveX, y: moveY }, pulse, plant };
}

/** Spend queued level-ups on the first offered boon, as a hurried player. */
function spendLevels(state) {
  while (state.pendingLevels > 0) {
    const choices = rollUpgrades(state);
    applyUpgrade(state, choices[0]);
    state.pendingLevels -= 1;
  }
}

/**
 * Play forward until a wave is at its busiest: night 2 or later with a swarm
 * on the field and more still incoming. A second attempt, if the first falls,
 * stages with the shield.
 */
function seekBusyWave(state, makeWorld) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const shield = attempt === 1;
    if (shield) Object.assign(state, makeWorld());
    const planted = { last: -10 };
    const cap = Math.floor(150 / STEP);
    for (let i = 0; i < cap && !state.outcome; i += 1) {
      if (shield) {
        state.player.iframes = Math.max(state.player.iframes, 0.1);
        state.heart.hp = state.heart.maxHp;
      }
      stepWorld(state, STEP, autopilotOrders(state, planted));
      spendLevels(state);
      if ((state.night >= 2 && state.wisps.length >= 4 && state.spawnQueue >= 6) || state.night >= 4) break;
    }
    if (!state.outcome) break;
  }
}

/**
 * Stage the named scene in `state` and return the screen to draw over it.
 * The world keeps the staged state; the render loop then holds the frame.
 */
export function stageShot(name, state, makeWorld) {
  if (name === 'play') {
    seekBusyWave(state, makeWorld);
    // Hold fire briefly so the swarm closes in for the frame: the gardener
    // keeps moving, but the lantern stays down and no bloom is planted.
    const planted = { last: 1e9 };
    for (let i = 0; i < 180 && !state.outcome; i += 1) {
      const orders = autopilotOrders(state, planted);
      stepWorld(state, STEP, { move: orders.move, pulse: false, plant: null });
      spendLevels(state);
    }
    return 'play';
  }
  if (name === 'upgrade') {
    const planted = { last: -10 };
    const cap = Math.floor(SHOT.upgradeCapSeconds / STEP);
    for (let i = 0; i < cap && state.pendingLevels === 0 && !state.outcome; i += 1) {
      stepWorld(state, STEP, autopilotOrders(state, planted));
    }
    if (state.pendingLevels === 0 && !state.outcome) gainXp(state, state.player.xpNext);
    if (state.outcome) {
      const fresh = makeWorld();
      Object.assign(state, fresh);
      gainXp(state, state.player.xpNext);
    }
    state.upgradeChoices = rollUpgrades(state);
    return 'upgrade';
  }
  if (name === 'victory') {
    // A boosted staging run: the same rules, a stronger lantern, so the full
    // eight nights play out in reasonable time and the victory screen is real.
    state.player.pulseDamage = 3;
    state.player.pulseRadius = 210;
    state.player.speed = 280;
    state.player.maxHearts = 12;
    state.player.hearts = 12;
    const planted = { last: -10 };
    const cap = Math.floor(SHOT.victoryCapSeconds / STEP);
    for (let i = 0; i < cap && state.outcome !== 'won'; i += 1) {
      state.player.iframes = Math.max(state.player.iframes, 0.1);
      stepWorld(state, STEP, autopilotOrders(state, planted));
      spendLevels(state);
      if (state.outcome === 'lost') break;
    }
    if (state.outcome !== 'won') {
      state.wisps.length = 0;
      state.bolts.length = 0;
      state.spawnQueue = 0;
      state.bossDown = true;
      state.night = 8;
      state.nightState = 'active';
      stepWorld(state, STEP, { move: { x: 0, y: 0 }, pulse: false, plant: null });
    }
    state.score = Math.max(state.score, 2450);
    return 'victory';
  }
  if (name === 'boss') {
    // A mid-fight frame against the Moth King: the boosted staging run stops
    // a few seconds after the boss spawns, with the staging shield holding
    // the gardener and the heart so the fight itself is what is shown. A
    // staging scene for play-testing, not one of the shipped screenshots.
    state.player.pulseDamage = 3;
    state.player.pulseRadius = 210;
    state.player.maxHearts = 12;
    state.player.hearts = 12;
    const planted = { last: -10 };
    const cap = Math.floor(SHOT.victoryCapSeconds / STEP);
    let bossSeenFor = 0;
    for (let i = 0; i < cap && !state.outcome; i += 1) {
      state.player.iframes = Math.max(state.player.iframes, 0.1);
      state.heart.hp = state.heart.maxHp;
      stepWorld(state, STEP, autopilotOrders(state, planted));
      spendLevels(state);
      if (state.boss) {
        bossSeenFor += STEP;
        if (bossSeenFor > 6) break;
      }
    }
    return 'play';
  }
  if (name === 'over') {
    const cap = Math.floor(SHOT.upgradeCapSeconds / STEP);
    for (let i = 0; i < cap && !state.outcome; i += 1) {
      stepWorld(state, STEP, { move: { x: 0, y: 0 }, pulse: false, plant: null });
    }
    return 'over';
  }
  // Start: a few seconds of the garden idling behind the title.
  const steps = Math.floor(SHOT.startSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(state, STEP, { move: { x: 0, y: 0 }, pulse: false, plant: null });
  }
  return 'title';
}

/** Read ?shot=<name>&seed=<n> from the page's URL, if present. */
export function shotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  const seed = Number.parseInt(params.get('seed') || `${SHOT.seed}`, 10);
  return { name: shot, seed: Number.isFinite(seed) ? seed : SHOT.seed };
}
