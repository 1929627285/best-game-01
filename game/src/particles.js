// Particles, floating score texts and screen shake: the feedback layer that
// makes every hit, pickup and pulse feel answered. All of it is cosmetic;
// nothing here changes the rules, and it all fades on its own.
export function spawnBurst(state, x, y, { count, color, speed = 120, size = 3, life = 0.6 }) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng() * Math.PI * 2;
    const velocity = speed * (0.3 + state.rng() * 0.7);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: life * (0.6 + state.rng() * 0.6),
      maxLife: life,
      size: size * (0.6 + state.rng() * 0.8),
      color,
      drag: 3.2,
    });
  }
}

export function spawnRing(state, x, y, { color, maxRadius, life = 0.35 }) {
  state.particles.push({ ring: true, x, y, radius: 8, maxRadius, life, maxLife: life, color, size: 3 });
}

export function spawnSparkle(state, x, y, color) {
  spawnBurst(state, x, y, { count: 10, color, speed: 70, size: 2.5, life: 0.7 });
}

/** A short-lived lightning jag between two points, drawn by the renderer. */
export function spawnZap(state, x1, y1, x2, y2, color) {
  const segments = [];
  const parts = 5;
  for (let i = 0; i <= parts; i += 1) {
    const t = i / parts;
    const jitter = i === 0 || i === parts ? 0 : (state.rng() - 0.5) * 26;
    segments.push({ x: x1 + (x2 - x1) * t + jitter, y: y1 + (y2 - y1) * t + jitter });
  }
  state.particles.push({
    zap: true,
    segments,
    x: x1,
    y: y1,
    vx: 0,
    vy: 0,
    life: 0.18,
    maxLife: 0.18,
    size: 2,
    color,
    drag: 0,
  });
}

export function spawnBoltTrail(state, x, y, color) {
  state.particles.push({
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.25,
    maxLife: 0.25,
    size: 4,
    color,
    drag: 0,
  });
}

export function floatText(state, x, y, text, color, size = 15) {
  state.texts.push({ x, y, text, color, size, life: 1.0, maxLife: 1.0 });
}

export function addShake(state, amount) {
  state.shake = Math.min(16, state.shake + amount);
}

/** Age particles and texts, apply drag, drop the dead. */
export function updateEffects(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    if (p.ring) {
      p.radius += ((p.maxRadius - p.radius) / Math.max(p.life, 0.001)) * dt * 0.5;
      continue;
    }
    const drag = 1 - Math.min(1, (p.drag || 0) * dt);
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = state.texts.length - 1; i >= 0; i -= 1) {
    const text = state.texts[i];
    text.life -= dt;
    text.y -= 34 * dt;
    if (text.life <= 0) state.texts.splice(i, 1);
  }
  state.shake = Math.max(0, state.shake - 40 * dt);
  state.flash = Math.max(0, state.flash - 2.4 * dt);
}
