// The shadow wisps and the Moth King: spawning, steering, attacks and death.
// Wisps pick the nearest thing worth eating (the gardener, the heart or a
// bloom), drifters shamble, darters dash, spitters shoot, bulwarks endure.
import { BOLT, BOSS, FIELD, WISP_KINDS } from './config.js';
import { borderPoint, chance, intRange, range, weightedPick } from './random.js';
import { damagePlayer } from './player.js';
import { damageHeart } from './garden.js';
import { floatText, spawnBurst, spawnSparkle } from './particles.js';

let nextId = 1;

export function spawnWisp(state, kind, x, y) {
  const def = WISP_KINDS[kind];
  const wisp = {
    id: nextId,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed * range(state.rng, 0.9, 1.1),
    radius: def.radius,
    score: def.score,
    dew: def.dew,
    target: 'player',
    retarget: 0,
    attackTimer: 0.5,
    shootTimer: range(state.rng, 1, 2),
    dashTimer: range(state.rng, 1.5, 3),
    dashing: 0,
    hitFlash: 0,
    fade: 0,
    wobble: range(state.rng, 0, Math.PI * 2),
    isBoss: false,
  };
  nextId += 1;
  state.wisps.push(wisp);
  return wisp;
}

export function spawnBoss(state) {
  const point = borderPoint(state.rng, FIELD.width, FIELD.height, 60);
  const boss = {
    id: nextId,
    kind: 'mothking',
    x: point.x,
    y: point.y,
    vx: 0,
    vy: 0,
    hp: BOSS.hp,
    maxHp: BOSS.hp,
    speed: BOSS.speed,
    radius: BOSS.radius,
    score: BOSS.score,
    dew: BOSS.dew,
    target: 'player',
    retarget: 0,
    attackTimer: 0.5,
    shootTimer: 2,
    burstTimer: BOSS.burstEvery,
    summonTimer: BOSS.summonEvery,
    dashTimer: 5,
    dashing: 0,
    telegraph: 0,
    hitFlash: 0,
    fade: 0,
    wobble: 0,
    isBoss: true,
  };
  nextId += 1;
  state.wisps.push(boss);
  state.boss = boss;
  state.audio.bossRoar();
  floatText(state, FIELD.width / 2, 120, 'The Moth King stirs…', '#c9a7ff', 22);
  return boss;
}

/** Pick the nearest edible target: player, heart, or a living bloom. */
function chooseTarget(state, wisp) {
  let best = 'player';
  let bestDistance = Math.hypot(wisp.x - state.player.x, wisp.y - state.player.y);
  const heartDistance = Math.hypot(wisp.x - state.heart.x, wisp.y - state.heart.y);
  if (heartDistance < bestDistance) {
    best = 'heart';
    bestDistance = heartDistance;
  }
  for (const bloom of state.blooms) {
    const distance = Math.hypot(wisp.x - bloom.x, wisp.y - bloom.y);
    if (distance < bestDistance) {
      best = bloom;
      bestDistance = distance;
    }
  }
  return best;
}

function targetPoint(state, target) {
  if (target === 'player') return { x: state.player.x, y: state.player.y, radius: state.player.radius };
  if (target === 'heart') return { x: state.heart.x, y: state.heart.y, radius: state.heart.radius };
  return { x: target.x, y: target.y, radius: target.radius };
}

function strikeTarget(state, wisp) {
  const target = wisp.target;
  if (target === 'player') {
    damagePlayer(state, 1, { x: wisp.x, y: wisp.y, wisp });
  } else if (target === 'heart') {
    damageHeart(state, 4);
    spawnBurst(state, state.heart.x, state.heart.y, { count: 8, color: '#7fe8d4', speed: 120, size: 3, life: 0.4 });
  } else {
    target.hp -= 1;
    target.hitFlash = 0.15;
    spawnBurst(state, target.x, target.y, { count: 8, color: '#ffb3e2', speed: 110, size: 3, life: 0.4 });
    if (target.hp <= 0) {
      spawnBurst(state, target.x, target.y, { count: 22, color: '#ffb3e2', speed: 170, size: 3, life: 0.7 });
      floatText(state, target.x, target.y - 18, 'Bloom lost!', '#ffb3e2', 14);
      state.blooms.splice(state.blooms.indexOf(target), 1);
    }
  }
}

/** One step of wisp steering, attacks and the boss's patterns. */
export function updateWisps(state, dt) {
  const player = state.player;
  for (const wisp of state.wisps) {
    wisp.hitFlash = Math.max(0, wisp.hitFlash - dt);
    wisp.fade = Math.min(1, wisp.fade + dt * 1.4);
    wisp.wobble += dt * 3;
    wisp.retarget -= dt;
    if (wisp.retarget <= 0) {
      wisp.target = chooseTarget(state, wisp);
      wisp.retarget = 0.4;
    }
    const point = targetPoint(state, wisp.target);
    const dx = point.x - wisp.x;
    const dy = point.y - wisp.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;

    let speed = wisp.speed;
    if (wisp.kind === 'darter') {
      wisp.dashTimer -= dt;
      if (wisp.dashTimer <= 0) {
        wisp.dashing = 0.35;
        wisp.dashTimer = range(state.rng, 2, 3.5);
      }
      if (wisp.dashing > 0) {
        wisp.dashing -= dt;
        speed *= 2.6;
      }
    }
    if (wisp.kind === 'spitter' && distance < 230) {
      // Spitters hold their distance and strafe.
      const strafe = Math.sin(wisp.wobble) > 0 ? 1 : -1;
      wisp.vx = -ny * strafe * speed + nx * speed * 0.2;
      wisp.vy = nx * strafe * speed + ny * speed * 0.2;
    } else {
      // A gentle weave keeps the swarm from marching in lockstep.
      const weave = Math.sin(wisp.wobble) * 0.35;
      wisp.vx = (nx - ny * weave) * speed;
      wisp.vy = (ny + nx * weave) * speed;
    }
    if (wisp.isBoss) updateBoss(state, wisp, dt, nx, ny, distance);

    wisp.x += wisp.vx * dt;
    wisp.y += wisp.vy * dt;
    wisp.x = Math.min(FIELD.width - wisp.radius, Math.max(wisp.radius, wisp.x));
    wisp.y = Math.min(FIELD.height - wisp.radius, Math.max(wisp.radius, wisp.y));

    // Melee strike when close enough to the target.
    wisp.attackTimer -= dt;
    if (distance <= point.radius + wisp.radius + 6 && wisp.attackTimer <= 0) {
      wisp.attackTimer = wisp.isBoss ? 0.9 : 0.8;
      strikeTarget(state, wisp);
    }
    // Spitters shoot shadow bolts from range.
    if (wisp.kind === 'spitter') {
      wisp.shootTimer -= dt;
      if (wisp.shootTimer <= 0 && distance < 340) {
        wisp.shootTimer = range(state.rng, 2, 2.8);
        const aim = Math.atan2(player.y - wisp.y, player.x - wisp.x);
        state.bolts.push({
          x: wisp.x,
          y: wisp.y,
          vx: Math.cos(aim) * BOLT.speed,
          vy: Math.sin(aim) * BOLT.speed,
          radius: BOLT.radius,
          damage: BOLT.damage,
          life: BOLT.life,
        });
      }
    }
  }

  // Separation: wisps push apart so the swarm never stacks into one blob.
  for (let i = 0; i < state.wisps.length; i += 1) {
    for (let j = i + 1; j < state.wisps.length; j += 1) {
      const a = state.wisps[i];
      const b = state.wisps[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const min = a.radius + b.radius - 2;
      if (distance > 0 && distance < min) {
        const push = ((min - distance) / 2 / distance) * 0.6;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }
}

/** The Moth King's patterns: radial bursts, summons, and a telegraphed charge. */
function updateBoss(state, boss, dt, nx, ny, distance) {
  boss.burstTimer -= dt;
  if (boss.burstTimer <= 0) {
    boss.burstTimer = BOSS.burstEvery;
    for (let i = 0; i < BOSS.burstBolts; i += 1) {
      const angle = (i / BOSS.burstBolts) * Math.PI * 2 + state.time;
      state.bolts.push({
        x: boss.x,
        y: boss.y,
        vx: Math.cos(angle) * BOLT.speed * 0.85,
        vy: Math.sin(angle) * BOLT.speed * 0.85,
        radius: BOLT.radius + 1,
        damage: BOLT.damage,
        life: BOLT.life,
      });
    }
    spawnBurst(state, boss.x, boss.y, { count: 20, color: '#c9a7ff', speed: 150, size: 3, life: 0.5 });
  }
  boss.summonTimer -= dt;
  if (boss.summonTimer <= 0) {
    boss.summonTimer = BOSS.summonEvery;
    for (let i = 0; i < BOSS.summonCount; i += 1) {
      const angle = state.rng() * Math.PI * 2;
      spawnWisp(state, 'drifter', boss.x + Math.cos(angle) * 60, boss.y + Math.sin(angle) * 60);
    }
    floatText(state, boss.x, boss.y - 48, 'The King calls its swarm!', '#c9a7ff', 15);
  }
  if (boss.hp <= boss.maxHp / 2) {
    if (boss.telegraph > 0) {
      boss.telegraph -= dt;
      boss.vx = 0;
      boss.vy = 0;
      if (boss.telegraph <= 0) {
        boss.dashing = 0.5;
        boss.dashTimer = 6;
      }
    } else if (boss.dashing > 0) {
      boss.dashing -= dt;
      boss.vx = nx * 320;
      boss.vy = ny * 320;
    } else {
      boss.dashTimer -= dt;
      if (boss.dashTimer <= 0 && distance < 420) boss.telegraph = 0.6;
    }
  }
}

/** Damage a wisp; on death it bursts into motes, dew and score. */
export function damageWisp(state, wisp, amount) {
  if (wisp.hp <= 0) return;
  wisp.hp -= amount;
  wisp.hitFlash = 0.12;
  if (wisp.hp > 0) return;
  state.kills += 1;
  state.score += wisp.score;
  floatText(state, wisp.x, wisp.y - 16, `+${wisp.score}`, '#ffe9a8', 14);
  spawnBurst(state, wisp.x, wisp.y, {
    count: wisp.isBoss ? 60 : 18,
    color: wisp.isBoss ? '#c9a7ff' : '#8a7bd8',
    speed: wisp.isBoss ? 260 : 160,
    size: 3,
    life: 0.7,
  });
  spawnSparkle(state, wisp.x, wisp.y, '#ffffff');
  state.audio.wispDown();
  dropPickups(state, wisp);
  const index = state.wisps.indexOf(wisp);
  if (index !== -1) state.wisps.splice(index, 1);
  if (wisp.isBoss) {
    state.boss = null;
    state.bossDown = true;
  }
}

function dropPickups(state, wisp) {
  const motes = wisp.isBoss ? 10 : intRange(state.rng, 2, 3);
  for (let i = 0; i < motes; i += 1) scatterPickup(state, wisp, 'mote', 1);
  const dew = wisp.dew;
  const dewDrops = Math.max(1, Math.round(dew / 2));
  for (let i = 0; i < dewDrops; i += 1) scatterPickup(state, wisp, 'dew', Math.ceil(dew / dewDrops));
  if (!wisp.isBoss && chance(state.rng, 0.12)) scatterPickup(state, wisp, 'petal', 1);
}

function scatterPickup(state, wisp, kind, value) {
  const angle = state.rng() * Math.PI * 2;
  const speed = range(state.rng, 30, 90);
  state.pickups.push({
    kind,
    value,
    x: wisp.x,
    y: wisp.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 12,
    phase: range(state.rng, 0, Math.PI * 2),
  });
}

/** The night's spawn mix: new kinds join as the nights deepen. */
export function nightKinds(night) {
  return Object.entries(WISP_KINDS)
    .filter(([, def]) => def.firstNight <= night)
    .map(([kind, def]) => [kind, def.weight]);
}

export function rollKind(state, night) {
  return weightedPick(state.rng, nightKinds(night));
}
