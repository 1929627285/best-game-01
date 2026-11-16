// Everything the player sees: the moonlit garden, the gardener, the wisps,
// the HUD and every screen. Drawing is layered back to front, and glows are
// pre-rendered sprites so the frame stays cheap even with a full swarm.
import { BLOOM, FIELD, NIGHTS_TO_WIN } from './config.js';

const TITLE_FONT = '700 62px Georgia, "Times New Roman", serif';
const HEADING_FONT = '700 34px Georgia, "Times New Roman", serif';
const UI_FONT = '600 15px "Trebuchet MS", Verdana, sans-serif';
const SMALL_FONT = '600 12px "Trebuchet MS", Verdana, sans-serif';
const BIG_FONT = '700 20px "Trebuchet MS", Verdana, sans-serif';

const INK = '#f4efe4';
const DIM = '#9fb4d8';
const LANTERN = '#ffd97a';
const HEART_COLOR = '#7fe8d4';
const BLOOM_COLOR = '#ffb3e2';

// Glow sprites, rendered once per colour and reused: a radial gradient baked
// onto a small canvas, drawn additively wherever light should bloom.
const glowCache = new Map();
function glowSprite(color) {
  let sprite = glowCache.get(color);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = 96;
  sprite.height = 96;
  const g = sprite.getContext('2d');
  const gradient = g.createRadialGradient(48, 48, 2, 48, 48, 48);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.35, color + 'aa');
  gradient.addColorStop(1, color + '00');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 96, 96);
  glowCache.set(color, sprite);
  return sprite;
}

function drawGlow(ctx, x, y, radius, color, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

// Static layers, rendered once and blitted: the sky, hills, ground and the
// edge vignette never change, so they cost one drawImage a frame instead of
// fresh full-screen gradients.
let backgroundLayerCache = null;
function backgroundLayer() {
  if (backgroundLayerCache) return backgroundLayerCache;
  const layer = document.createElement('canvas');
  layer.width = FIELD.width;
  layer.height = FIELD.height;
  const ctx = layer.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  sky.addColorStop(0, '#0b1026');
  sky.addColorStop(0.55, '#241a4a');
  sky.addColorStop(1, '#131c2e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = '#1b2440';
  ctx.beginPath();
  ctx.moveTo(0, 330);
  ctx.quadraticCurveTo(240, 250, 480, 320);
  ctx.quadraticCurveTo(720, 380, 960, 300);
  ctx.lineTo(960, 540);
  ctx.lineTo(0, 540);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#16233a';
  ctx.beginPath();
  ctx.moveTo(0, 380);
  ctx.quadraticCurveTo(300, 310, 620, 370);
  ctx.quadraticCurveTo(820, 410, 960, 360);
  ctx.lineTo(960, 540);
  ctx.lineTo(0, 540);
  ctx.closePath();
  ctx.fill();
  const ground = ctx.createLinearGradient(0, 330, 0, FIELD.height);
  ground.addColorStop(0, '#1a2f22');
  ground.addColorStop(1, '#0e1a13');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 350, FIELD.width, FIELD.height - 350);
  ctx.fillStyle = '#0e1a13';
  ctx.beginPath();
  ctx.ellipse(FIELD.width / 2, 470, 430, 130, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#16281d';
  ctx.beginPath();
  ctx.ellipse(FIELD.width / 2, 465, 400, 118, 0, 0, Math.PI * 2);
  ctx.fill();
  backgroundLayerCache = layer;
  return layer;
}

let vignetteLayerCache = null;
function vignetteLayer() {
  if (vignetteLayerCache) return vignetteLayerCache;
  const layer = document.createElement('canvas');
  layer.width = FIELD.width;
  layer.height = FIELD.height;
  const ctx = layer.getContext('2d');
  const vignette = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 240, FIELD.width / 2, FIELD.height / 2, 560);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(4, 6, 16, 0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  vignetteLayerCache = layer;
  return layer;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHeartShape(ctx, x, y, size, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -3, -5, -10, 0, -4);
  ctx.bezierCurveTo(5, -10, 9, -3, 0, 5);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, x, y, radius, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** The upgrade card icons, each a few strokes in the card's accent colour. */
export function drawUpgradeIcon(ctx, icon, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = size / 2;
  if (icon === 'ring') {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon === 'star') {
    drawStar(ctx, x, y, s, color);
  } else if (icon === 'bolt') {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y - s);
    ctx.lineTo(x - s * 0.5, y + s * 0.2);
    ctx.lineTo(x, y + s * 0.2);
    ctx.lineTo(x - s * 0.3, y + s);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'wing') {
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.4);
    ctx.quadraticCurveTo(x - s * 0.2, y - s, x + s, y - s * 0.6);
    ctx.quadraticCurveTo(x + s * 0.2, y, x - s, y + s * 0.4);
    ctx.fill();
  } else if (icon === 'heart') {
    drawHeartShape(ctx, x, y, s * 1.6, color);
  } else if (icon === 'flower') {
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(angle) * s * 0.55, y + Math.sin(angle) * s * 0.55, s * 0.42, s * 0.28, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon === 'magnet') {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.75, Math.PI, 0, false);
    ctx.lineWidth = s * 0.5;
    ctx.stroke();
  } else if (icon === 'thorn') {
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * s * 0.55 - s * 0.25, y + s * 0.7);
      ctx.lineTo(x + i * s * 0.55, y - s * 0.8);
      ctx.lineTo(x + i * s * 0.55 + s * 0.25, y + s * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  } else if (icon === 'chain') {
    ctx.beginPath();
    ctx.arc(x - s * 0.4, y, s * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + s * 0.4, y, s * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (icon === 'seed') {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s * 0.8, y, x, y + s);
    ctx.quadraticCurveTo(x - s * 0.8, y, x, y - s);
    ctx.fill();
  } else if (icon === 'shield') {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.8, y - s * 0.5);
    ctx.lineTo(x + s * 0.8, y + s * 0.2);
    ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.8, x, y + s);
    ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.8, x - s * 0.8, y + s * 0.2);
    ctx.lineTo(x - s * 0.8, y - s * 0.5);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s, y - s * 0.1, x + s * 0.4, y + s * 0.6);
    ctx.quadraticCurveTo(x, y + s, x - s * 0.4, y + s * 0.6);
    ctx.quadraticCurveTo(x - s, y - s * 0.1, x, y - s);
    ctx.fill();
  }
  ctx.restore();
}

function drawBackground(ctx, state) {
  ctx.drawImage(backgroundLayer(), 0, 0);

  for (const star of state.stars) {
    const twinkle = 0.5 + 0.5 * Math.sin(state.time * 1.7 + star.phase);
    ctx.globalAlpha = 0.35 + 0.55 * twinkle;
    ctx.fillStyle = '#e8ecff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The moon, high on the right, with a soft halo.
  drawGlow(ctx, 830, 78, 90, '#dfe6ff', 0.5);
  ctx.fillStyle = '#f2f0dc';
  ctx.beginPath();
  ctx.arc(830, 78, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ddd6b8';
  ctx.beginPath();
  ctx.arc(818, 68, 5, 0, Math.PI * 2);
  ctx.arc(842, 88, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Grass tufts sway almost imperceptibly.
  ctx.strokeStyle = '#2c4a34';
  ctx.lineWidth = 2;
  for (const tuft of state.tufts) {
    const sway = Math.sin(state.time * 1.2 + tuft.phase) * 2;
    ctx.beginPath();
    ctx.moveTo(tuft.x, tuft.y);
    ctx.quadraticCurveTo(tuft.x + sway, tuft.y - tuft.tall * 0.6, tuft.x + sway * 1.6, tuft.y - tuft.tall);
    ctx.stroke();
  }
  // A few wild glow-dots in the grass.
  for (let i = 0; i < 24; i += 1) {
    const tuft = state.tufts[i * 2];
    const glow = 0.4 + 0.4 * Math.sin(state.time * 2 + tuft.phase);
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#8affc1';
    ctx.beginPath();
    ctx.arc(tuft.x + 6, tuft.y - 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFireflies(ctx, state) {
  for (const fly of state.fireflies) {
    const glow = 0.5 + 0.5 * Math.sin(fly.phase * 2.2);
    drawGlow(ctx, fly.x, fly.y, 14, '#ffe9a8', 0.25 + 0.45 * glow);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(fly.x, fly.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHeart(ctx, state) {
  const heart = state.heart;
  const health = heart.hp / heart.maxHp;
  const pulse = 1 + 0.08 * Math.sin(state.time * 2.4);
  drawGlow(ctx, heart.x, heart.y, 90 * pulse, HEART_COLOR, 0.35 + 0.45 * health);
  ctx.save();
  ctx.translate(heart.x, heart.y);
  ctx.scale(pulse, pulse);
  // Faceted crystal.
  ctx.fillStyle = '#2a7d74';
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(20, -6);
  ctx.lineTo(12, 26);
  ctx.lineTo(-12, 26);
  ctx.lineTo(-20, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5fd8c8';
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(20, -6);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a9f5e8';
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(0, 6);
  ctx.lineTo(-20, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8ae9da';
  ctx.beginPath();
  ctx.moveTo(-12, 26);
  ctx.lineTo(12, 26);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  if (health < 0.35) {
    ctx.strokeStyle = '#0d2b27';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -12);
    ctx.lineTo(2, 0);
    ctx.lineTo(-3, 12);
    ctx.stroke();
  }
  if (heart.hitFlash > 0) {
    ctx.globalAlpha = Math.min(1, heart.hitFlash * 5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(20, -6);
    ctx.lineTo(12, 26);
    ctx.lineTo(-12, 26);
    ctx.lineTo(-20, -6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Health arc under the crystal.
  ctx.fillStyle = '#0a0f1e';
  roundRect(ctx, heart.x - 34, heart.y + 38, 68, 7, 3.5);
  ctx.fill();
  ctx.fillStyle = health > 0.35 ? HEART_COLOR : '#ff8a7a';
  roundRect(ctx, heart.x - 34, heart.y + 38, 68 * health, 7, 3.5);
  ctx.fill();
}

function drawBloom(ctx, state, bloom) {
  const sway = Math.sin(state.time * 1.8 + bloom.phase) * 0.08;
  const charging = bloom.zapTimer < 0.15;
  drawGlow(ctx, bloom.x, bloom.y - 12, 44, BLOOM_COLOR, charging ? 0.55 : 0.3);
  ctx.save();
  ctx.translate(bloom.x, bloom.y);
  ctx.rotate(sway);
  ctx.strokeStyle = '#3f7d4e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, -14);
  ctx.stroke();
  const petals = 5 + Math.min(3, bloom.level);
  for (let i = 0; i < petals; i += 1) {
    const angle = (i / petals) * Math.PI * 2 + state.time * 0.2;
    ctx.fillStyle = i % 2 ? '#ff9ed6' : BLOOM_COLOR;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * 9, -16 + Math.sin(angle) * 9, 8, 5, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(0, -16, 5, 0, Math.PI * 2);
  ctx.fill();
  if (bloom.hitFlash > 0) {
    ctx.globalAlpha = Math.min(1, bloom.hitFlash * 6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -14, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (bloom.hp < bloom.maxHp) {
    ctx.fillStyle = '#0a0f1e';
    roundRect(ctx, bloom.x - 14, bloom.y + 10, 28, 4, 2);
    ctx.fill();
    ctx.fillStyle = BLOOM_COLOR;
    roundRect(ctx, bloom.x - 14, bloom.y + 10, 28 * (bloom.hp / bloom.maxHp), 4, 2);
    ctx.fill();
  }
}

function drawWispBody(ctx, wisp, bodyColor, glowColor, state) {
  const bob = Math.sin(wisp.wobble * 1.6) * 3;
  const alpha = wisp.fade;
  drawGlow(ctx, wisp.x, wisp.y + bob, wisp.radius * 2.4, glowColor, 0.4 * alpha);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(wisp.x, wisp.y + bob);
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-wisp.radius, wisp.radius * 0.5);
  ctx.quadraticCurveTo(-wisp.radius, -wisp.radius, 0, -wisp.radius);
  ctx.quadraticCurveTo(wisp.radius, -wisp.radius, wisp.radius, wisp.radius * 0.5);
  for (let i = 0; i < 3; i += 1) {
    const x = wisp.radius - ((i + 0.5) / 3) * wisp.radius * 2;
    ctx.quadraticCurveTo(x + wisp.radius / 3, wisp.radius * 0.15, x, wisp.radius * 0.55);
  }
  ctx.closePath();
  ctx.fill();
  // Eyes, watching the gardener.
  const look = Math.atan2(state.player.y - wisp.y, state.player.x - wisp.x);
  const ex = Math.cos(look) * 2;
  const ey = Math.sin(look) * 2;
  ctx.fillStyle = '#fff8e0';
  ctx.beginPath();
  ctx.arc(-wisp.radius * 0.35 + ex, -wisp.radius * 0.25 + ey, Math.max(2, wisp.radius * 0.16), 0, Math.PI * 2);
  ctx.arc(wisp.radius * 0.35 + ex, -wisp.radius * 0.25 + ey, Math.max(2, wisp.radius * 0.16), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1230';
  ctx.beginPath();
  ctx.arc(-wisp.radius * 0.35 + ex * 1.6, -wisp.radius * 0.25 + ey * 1.6, Math.max(1, wisp.radius * 0.08), 0, Math.PI * 2);
  ctx.arc(wisp.radius * 0.35 + ex * 1.6, -wisp.radius * 0.25 + ey * 1.6, Math.max(1, wisp.radius * 0.08), 0, Math.PI * 2);
  ctx.fill();
  if (wisp.hitFlash > 0) {
    ctx.globalAlpha = Math.min(1, wisp.hitFlash * 7) * alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, wisp.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (wisp.hp < wisp.maxHp && !wisp.isBoss) {
    ctx.fillStyle = '#0a0f1e';
    roundRect(ctx, wisp.x - 14, wisp.y - wisp.radius - 10, 28, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#c9b8ff';
    roundRect(ctx, wisp.x - 14, wisp.y - wisp.radius - 10, 28 * (wisp.hp / wisp.maxHp), 4, 2);
    ctx.fill();
  }
}

function drawWisp(ctx, state, wisp) {
  if (wisp.isBoss) {
    drawBoss(ctx, state, wisp);
    return;
  }
  if (wisp.kind === 'darter') {
    drawWispBody(ctx, wisp, '#3d7f92', '#6fd3e8', state);
  } else if (wisp.kind === 'spitter') {
    drawWispBody(ctx, wisp, '#7d3d68', '#e87ab0', state);
    ctx.fillStyle = '#e87ab0';
    ctx.beginPath();
    ctx.arc(wisp.x, wisp.y + 4, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (wisp.kind === 'bulwark') {
    drawWispBody(ctx, wisp, '#4a3d7d', '#9a86e0', state);
    ctx.strokeStyle = '#2c2350';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(wisp.x + Math.cos(angle) * wisp.radius * 0.8, wisp.y + Math.sin(angle) * wisp.radius * 0.8);
      ctx.lineTo(wisp.x + Math.cos(angle) * (wisp.radius + 7), wisp.y + Math.sin(angle) * (wisp.radius + 7));
      ctx.stroke();
    }
  } else {
    drawWispBody(ctx, wisp, '#5a4aa8', '#8a7bd8', state);
  }
}

function drawBoss(ctx, state, boss) {
  const flap = Math.sin(state.time * 6) * 0.35;
  const bob = Math.sin(state.time * 1.4) * 5;
  if (boss.telegraph > 0) {
    ctx.strokeStyle = `rgba(255, 110, 110, ${0.4 + 0.4 * Math.sin(state.time * 20)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y + bob, boss.radius + 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawGlow(ctx, boss.x, boss.y + bob, 110, '#c9a7ff', 0.45 * boss.fade);
  ctx.save();
  ctx.globalAlpha = boss.fade;
  ctx.translate(boss.x, boss.y + bob);
  // Wings, flapping.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(-0.25 + flap * 0.4);
    const wing = ctx.createLinearGradient(0, 0, 62, 0);
    wing.addColorStop(0, '#7d63c8');
    wing.addColorStop(1, '#b79aff');
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.quadraticCurveTo(52, -34, 66, -8);
    ctx.quadraticCurveTo(58, 22, 10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#efe6ff';
    ctx.beginPath();
    ctx.arc(44, -8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a2f86';
    ctx.beginPath();
    ctx.arc(44, -8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Fuzzy body.
  ctx.fillStyle = '#3a2a63';
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#57419b';
  ctx.beginPath();
  ctx.ellipse(0, -4, 13, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Antennae with glowing tips.
  ctx.strokeStyle = '#c9a7ff';
  ctx.lineWidth = 2.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6, -26);
    ctx.quadraticCurveTo(side * 16, -44, side * 24, -40);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(side * 24, -40, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes.
  ctx.fillStyle = '#ffd97a';
  ctx.beginPath();
  ctx.arc(-7, -12, 4, 0, Math.PI * 2);
  ctx.arc(7, -12, 4, 0, Math.PI * 2);
  ctx.fill();
  if (boss.hitFlash > 0) {
    ctx.globalAlpha = Math.min(1, boss.hitFlash * 7) * boss.fade;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, state) {
  const player = state.player;
  if (player.dead) return;
  const blink = player.iframes > 0 && Math.floor(state.time * 16) % 2 === 0;
  const bob = player.moving ? Math.sin(player.walkPhase) * 2 : Math.sin(state.time * 2) * 1;
  drawGlow(ctx, player.x, player.y, 70, LANTERN, 0.5);
  ctx.save();
  ctx.globalAlpha = blink ? 0.35 : 1;
  ctx.translate(player.x, player.y + bob);
  ctx.scale(player.facing, 1);
  // Cloak.
  ctx.fillStyle = '#2e6e5e';
  ctx.beginPath();
  ctx.moveTo(-11, 12);
  ctx.quadraticCurveTo(-13, -6, 0, -10);
  ctx.quadraticCurveTo(13, -6, 11, 12);
  ctx.quadraticCurveTo(0, 16, -11, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3f8a76';
  ctx.beginPath();
  ctx.moveTo(-6, 12);
  ctx.quadraticCurveTo(-7, -4, 0, -8);
  ctx.quadraticCurveTo(7, -4, 6, 12);
  ctx.closePath();
  ctx.fill();
  // Face.
  ctx.fillStyle = '#ffd9b0';
  ctx.beginPath();
  ctx.arc(0, -10, 7, 0, Math.PI * 2);
  ctx.fill();
  // Pointed gardener's hat.
  ctx.fillStyle = '#d99a4e';
  ctx.beginPath();
  ctx.moveTo(-10, -13);
  ctx.quadraticCurveTo(0, -30, 9, -14);
  ctx.quadraticCurveTo(0, -18, -10, -13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b57a35';
  ctx.beginPath();
  ctx.ellipse(0, -13, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Lantern, swinging with the walk.
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.25 : Math.sin(state.time * 1.6) * 0.1;
  ctx.save();
  ctx.translate(12, 0);
  ctx.rotate(swing);
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, 4);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  roundRect(ctx, -5, 4, 10, 11, 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -5, 4, 10, 11, 2);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Pulse recharge ring under the gardener.
  if (player.pulseTimer > 0) {
    const fraction = 1 - player.pulseTimer / player.pulseCooldown;
    ctx.strokeStyle = 'rgba(255, 217, 122, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y + 18, 9, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
    ctx.stroke();
  }
}

function drawPickups(ctx, state) {
  for (const pickup of state.pickups) {
    const bob = Math.sin(pickup.phase) * 2;
    const blink = pickup.life < 3 && Math.floor(state.time * 6) % 2 === 0;
    if (blink) continue;
    if (pickup.kind === 'mote') {
      drawGlow(ctx, pickup.x, pickup.y + bob, 16, '#9fe8ff', 0.5);
      ctx.fillStyle = '#d8f6ff';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (pickup.kind === 'dew') {
      drawGlow(ctx, pickup.x, pickup.y + bob, 16, '#6fb7ff', 0.5);
      ctx.fillStyle = '#9fd0ff';
      ctx.beginPath();
      ctx.moveTo(pickup.x, pickup.y + bob - 6);
      ctx.quadraticCurveTo(pickup.x + 5, pickup.y + bob + 2, pickup.x, pickup.y + bob + 5);
      ctx.quadraticCurveTo(pickup.x - 5, pickup.y + bob + 2, pickup.x, pickup.y + bob - 6);
      ctx.fill();
    } else {
      ctx.fillStyle = BLOOM_COLOR;
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.rotate(pickup.phase * 0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawBolts(ctx, state) {
  for (const bolt of state.bolts) {
    drawGlow(ctx, bolt.x, bolt.y, 20, '#b48aff', 0.6);
    ctx.fillStyle = '#e6d8ff';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, state) {
  for (const p of state.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    if (p.zap) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = alpha * 0.35;
      ctx.beginPath();
      p.segments.forEach((point, i) => (i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      continue;
    }
    if (p.ring) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.textAlign = 'center';
  for (const text of state.texts) {
    const alpha = Math.max(0, text.life / text.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${text.size}px "Trebuchet MS", Verdana, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8, 10, 24, 0.8)';
    ctx.strokeText(text.text, text.x, text.y);
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
    ctx.restore();
  }
}

function drawBar(ctx, x, y, w, h, fraction, fill, back = '#0a0f1e') {
  ctx.fillStyle = back;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (fraction > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, Math.max(h, w * Math.min(1, fraction)), h, h / 2);
    ctx.fill();
  }
}

function drawHud(ctx, state) {
  const player = state.player;
  // Top bar backing.
  ctx.fillStyle = 'rgba(8, 10, 24, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, 44);
  // Hearts.
  // Hearts wrap to a second row past eight, so a well-upgraded gardener
  // never crowds the night label.
  const perRow = player.maxHearts > 8 ? 8 : player.maxHearts;
  for (let i = 0; i < player.maxHearts; i += 1) {
    drawHeartShape(ctx, 24 + (i % perRow) * 24, 24 + Math.floor(i / perRow) * 20, 18, i < player.hearts ? '#ff7a6b' : '#3a2a3a');
  }
  // Night and wave progress.
  ctx.textAlign = 'left';
  ctx.font = BIG_FONT;
  ctx.fillStyle = INK;
  const nightLabel = state.night === 0 ? 'Night 1 approaches' : `Night ${state.night} / ${NIGHTS_TO_WIN}`;
  ctx.fillText(nightLabel, 200, 28);
  ctx.font = SMALL_FONT;
  ctx.fillStyle = DIM;
  const left = state.spawnQueue + state.wisps.length;
  ctx.fillText(state.nightState === 'break' ? 'Dawn break — catch your breath' : `${left} wisps remain`, 200, 40);
  // Score, dew, best.
  ctx.textAlign = 'right';
  ctx.font = BIG_FONT;
  ctx.fillStyle = INK;
  ctx.fillText(`Score ${state.score}`, FIELD.width - 16, 24);
  ctx.font = UI_FONT;
  ctx.fillStyle = '#9fd0ff';
  ctx.fillText(`◆ ${state.dew} dew`, FIELD.width - 16, 40);
  ctx.fillStyle = DIM;
  ctx.font = SMALL_FONT;
  ctx.fillText(`Best ${Math.max(state.best, state.score)}`, FIELD.width - 120, 40);
  // Boss bar.
  if (state.boss) {
    const w = 420;
    ctx.textAlign = 'center';
    ctx.font = UI_FONT;
    ctx.fillStyle = '#e6d8ff';
    ctx.fillText('THE MOTH KING', FIELD.width / 2, 62);
    drawBar(ctx, FIELD.width / 2 - w / 2, 68, w, 10, state.boss.hp / state.boss.maxHp, '#b79aff');
  }
  // Level bar, bottom left.
  ctx.textAlign = 'left';
  ctx.font = UI_FONT;
  ctx.fillStyle = INK;
  ctx.fillText(`Lv ${player.level}`, 16, FIELD.height - 34);
  drawBar(ctx, 52, FIELD.height - 46, 170, 12, player.xp / player.xpNext, '#9fe8ff');
  ctx.font = SMALL_FONT;
  ctx.fillStyle = DIM;
  ctx.fillText(`${player.xp}/${player.xpNext} motes`, 52, FIELD.height - 18);
  // Pulse and planting hints, bottom right.
  ctx.textAlign = 'right';
  ctx.font = UI_FONT;
  ctx.fillStyle = player.pulseTimer <= 0 ? LANTERN : DIM;
  ctx.fillText(player.pulseTimer <= 0 ? '● Pulse ready (Space / click)' : '○ Pulse charging…', FIELD.width - 16, FIELD.height - 34);
  ctx.fillStyle = state.dew >= player.bloomCost ? '#ffb3e2' : DIM;
  ctx.fillText(`E / right-click: plant bloom (${player.bloomCost} dew) · ${state.blooms.length}/${BLOOM.max}`, FIELD.width - 16, FIELD.height - 18);
  // Controls reminder, bottom centre.
  ctx.textAlign = 'center';
  ctx.font = SMALL_FONT;
  ctx.fillStyle = 'rgba(159, 180, 216, 0.75)';
  ctx.fillText('WASD / arrows move · P pause · M sound', FIELD.width / 2, FIELD.height - 18);
  // Night banner.
  if (state.banner.timer > 0) {
    const alpha = Math.min(1, state.banner.timer);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = HEADING_FONT;
    ctx.fillStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(8, 10, 24, 0.7)';
    ctx.strokeText(state.banner.text, FIELD.width / 2, 110);
    ctx.fillText(state.banner.text, FIELD.width / 2, 110);
    ctx.font = UI_FONT;
    ctx.fillStyle = DIM;
    ctx.fillText(state.banner.sub, FIELD.width / 2, 134);
    ctx.restore();
  }
}

function drawButton(ctx, button, hover) {
  ctx.save();
  ctx.fillStyle = hover ? '#3a2a63' : 'rgba(20, 16, 44, 0.92)';
  ctx.strokeStyle = hover ? LANTERN : '#5a4aa8';
  ctx.lineWidth = 2;
  roundRect(ctx, button.x, button.y, button.w, button.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = hover ? '#fff6d8' : INK;
  ctx.font = BIG_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 1);
  ctx.restore();
}

function dimScreen(ctx, alpha) {
  ctx.fillStyle = `rgba(6, 8, 20, ${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(14, 12, 34, 0.94)';
  ctx.strokeStyle = '#5a4aa8';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();
}

function drawStats(ctx, state, x, y) {
  const minutes = Math.floor(state.elapsed / 60);
  const seconds = Math.floor(state.elapsed % 60);
  const rows = [
    ['Score', `${state.score}`],
    ['Best', `${Math.max(state.best, state.score)}`],
    ['Nights survived', `${Math.min(state.night, NIGHTS_TO_WIN)} / ${NIGHTS_TO_WIN}`],
    ['Wisps defeated', `${state.kills}`],
    ['Blooms planted', `${state.bloomsPlanted}`],
    ['Pulses fired', `${state.pulsesFired}`],
    ['Time', `${minutes}:${String(seconds).padStart(2, '0')}`],
  ];
  ctx.textAlign = 'left';
  ctx.font = UI_FONT;
  rows.forEach(([label, value], i) => {
    const rowY = y + i * 26;
    ctx.fillStyle = DIM;
    ctx.fillText(label, x, rowY);
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.fillText(value, x + 260, rowY);
    ctx.textAlign = 'left';
  });
}

function drawTitle(ctx, state, buttons, mouse) {
  dimScreen(ctx, 0.45);
  // Title with a lantern glow behind it.
  drawGlow(ctx, FIELD.width / 2, 130, 220, LANTERN, 0.25);
  ctx.textAlign = 'center';
  ctx.font = TITLE_FONT;
  ctx.fillStyle = '#fff6d8';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(20, 12, 40, 0.85)';
  ctx.strokeText('GLOWGARDEN', FIELD.width / 2, 148);
  ctx.fillText('GLOWGARDEN', FIELD.width / 2, 148);
  ctx.font = 'italic 600 19px Georgia, serif';
  ctx.fillStyle = '#d8c9ff';
  ctx.fillText('Defend the last light of the night — if you fall, the dark wins.', FIELD.width / 2, 180);

  drawPanel(ctx, FIELD.width / 2 - 320, 208, 640, 128);
  ctx.textAlign = 'left';
  ctx.font = UI_FONT;
  ctx.fillStyle = INK;
  const lines = [
    ['Goal', 'Survive 8 nights and drive off the Moth King.'],
    ['Move', 'WASD or arrow keys.'],
    ['Pulse', 'Space or click: lantern light that hurts every wisp around you.'],
    ['Plant', 'E or right-click: spend dew to grow a glowbloom that zaps wisps.'],
    ['Grow', 'Gather motes to level up and choose a boon. Gather dew to plant.'],
  ];
  lines.forEach(([head, body], i) => {
    const lineY = 232 + i * 22;
    ctx.fillStyle = LANTERN;
    ctx.fillText(head, FIELD.width / 2 - 300, lineY);
    ctx.fillStyle = INK;
    ctx.fillText(body, FIELD.width / 2 - 236, lineY);
  });

  for (const button of buttons) drawButton(ctx, button, isHover(button, mouse));
  ctx.textAlign = 'center';
  ctx.font = SMALL_FONT;
  ctx.fillStyle = DIM;
  ctx.fillText(`Best score: ${state.best}   ·   M toggles sound   ·   Headphones recommended for the night pad`, FIELD.width / 2, 512);
}

function drawHelp(ctx, buttons, mouse) {
  dimScreen(ctx, 0.6);
  drawPanel(ctx, FIELD.width / 2 - 330, 70, 660, 400);
  ctx.textAlign = 'center';
  ctx.font = HEADING_FONT;
  ctx.fillStyle = INK;
  ctx.fillText('How to play', FIELD.width / 2, 116);
  ctx.textAlign = 'left';
  ctx.font = UI_FONT;
  const lines = [
    'The garden heart glows at the centre of the field. Shadow wisps drift in',
    'from the dark to eat its light — and yours. You are Pip, the firefly',
    'gardener, and your lantern is the only thing they fear.',
    '',
    '• Pulse (Space / click) hurts every wisp in a ring around you.',
    '• Wisps drop motes (level up) and dew (currency) when they burst.',
    '• Plant glowblooms (E / right-click) to guard the garden while you move.',
    '• Each level-up offers three boons: pick the build that suits the night.',
    '• Drifters shamble, darters dash, spitters shoot, bulwarks endure.',
    '• On Night 8 the Moth King comes. Beat it before dawn to win.',
    '• Clearing a night restores a heart and mends the garden heart.',
    '',
    'Pause with P or Esc. Restart any time with R on an end screen.',
  ];
  lines.forEach((line, i) => {
    ctx.fillStyle = line.startsWith('•') ? INK : DIM;
    ctx.fillText(line, FIELD.width / 2 - 300, 148 + i * 22);
  });
  for (const button of buttons) drawButton(ctx, button, isHover(button, mouse));
}

function drawPause(ctx, buttons, mouse) {
  dimScreen(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.font = HEADING_FONT;
  ctx.fillStyle = INK;
  ctx.fillText('Paused', FIELD.width / 2, 190);
  ctx.font = UI_FONT;
  ctx.fillStyle = DIM;
  ctx.fillText('The garden holds its breath.', FIELD.width / 2, 218);
  for (const button of buttons) drawButton(ctx, button, isHover(button, mouse));
}

function drawUpgradeScreen(ctx, state, buttons, mouse) {
  dimScreen(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.font = HEADING_FONT;
  ctx.fillStyle = '#fff6d8';
  ctx.fillText(`Level ${state.player.level}! Choose a boon`, FIELD.width / 2, 118);
  ctx.font = UI_FONT;
  ctx.fillStyle = DIM;
  ctx.fillText('Click a card, or press 1, 2 or 3.', FIELD.width / 2, 146);
  state.upgradeChoices.forEach((upgrade, i) => {
    const button = buttons[i];
    const hover = isHover(button, mouse);
    ctx.save();
    ctx.fillStyle = hover ? '#2c2150' : 'rgba(20, 16, 44, 0.95)';
    ctx.strokeStyle = hover ? LANTERN : '#5a4aa8';
    ctx.lineWidth = hover ? 3 : 2;
    roundRect(ctx, button.x, button.y, button.w, button.h, 14);
    ctx.fill();
    ctx.stroke();
    drawUpgradeIcon(ctx, upgrade.icon, button.x + button.w / 2, button.y + 62, 52, LANTERN);
    ctx.textAlign = 'center';
    ctx.font = BIG_FONT;
    ctx.fillStyle = INK;
    ctx.fillText(upgrade.name, button.x + button.w / 2, button.y + 128);
    ctx.font = UI_FONT;
    ctx.fillStyle = DIM;
    wrapText(ctx, upgrade.describe(), button.x + button.w / 2, button.y + 158, button.w - 36, 22);
    ctx.font = SMALL_FONT;
    ctx.fillStyle = '#6f7fa8';
    ctx.fillText(`[${i + 1}]`, button.x + button.w / 2, button.y + button.h - 16);
    ctx.restore();
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = trial;
    }
  }
  ctx.fillText(line, x, lineY);
}

function drawEndScreen(ctx, state, buttons, mouse, won) {
  if (won) {
    const dawn = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    dawn.addColorStop(0, 'rgba(255, 190, 110, 0.28)');
    dawn.addColorStop(1, 'rgba(20, 12, 44, 0.72)');
    ctx.fillStyle = dawn;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  } else {
    dimScreen(ctx, 0.68);
  }
  ctx.textAlign = 'center';
  ctx.font = TITLE_FONT;
  ctx.fillStyle = won ? '#fff6d8' : '#e8c9ff';
  ctx.fillText(won ? 'DAWN BREAKS!' : 'THE DARK WINS', FIELD.width / 2, 130);
  ctx.font = 'italic 600 18px Georgia, serif';
  ctx.fillStyle = DIM;
  ctx.fillText(state.outcomeReason, FIELD.width / 2, 162);

  drawPanel(ctx, FIELD.width / 2 - 170, 186, 340, 200);
  drawStats(ctx, state, FIELD.width / 2 - 140, 214);
  if (state.score > 0 && state.score >= state.best) {
    ctx.textAlign = 'center';
    ctx.font = BIG_FONT;
    ctx.fillStyle = LANTERN;
    ctx.fillText('★ New best score! ★', FIELD.width / 2, 404);
  }
  for (const button of buttons) drawButton(ctx, button, isHover(button, mouse));
  ctx.textAlign = 'center';
  ctx.font = SMALL_FONT;
  ctx.fillStyle = DIM;
  ctx.fillText('Press R to play again', FIELD.width / 2, 526);
}

function isHover(button, mouse) {
  return mouse.x >= button.x && mouse.x <= button.x + button.w && mouse.y >= button.y && mouse.y <= button.y + button.h;
}

/**
 * The clickable controls of each screen, in logical coordinates. The game
 * loop hit-tests these same rects, so what is drawn is what is clickable.
 */
export function screenButtons(screen, state) {
  const centre = FIELD.width / 2;
  if (screen === 'title') {
    return [
      { id: 'start', label: '▶  Start the first night', x: centre - 150, y: 356, w: 300, h: 52 },
      { id: 'help', label: 'How to play', x: centre - 150, y: 418, w: 300, h: 40 },
      { id: 'mute', label: state.audio.muted ? 'Sound: off (M)' : 'Sound: on (M)', x: FIELD.width - 168, y: 12, w: 152, h: 32 },
    ];
  }
  if (screen === 'help') {
    return [{ id: 'back', label: 'Back', x: centre - 100, y: 424, w: 200, h: 44 }];
  }
  if (screen === 'pause') {
    return [
      { id: 'resume', label: 'Resume', x: centre - 130, y: 248, w: 260, h: 48 },
      { id: 'restart', label: 'Restart', x: centre - 130, y: 306, w: 260, h: 48 },
      { id: 'mute', label: state.audio.muted ? 'Sound: off (M)' : 'Sound: on (M)', x: centre - 130, y: 364, w: 260, h: 40 },
    ];
  }
  if (screen === 'upgrade') {
    const w = 220;
    const gap = 24;
    const total = w * 3 + gap * 2;
    return state.upgradeChoices.map((upgrade, i) => ({
      id: `upgrade:${i}`,
      label: upgrade.name,
      x: centre - total / 2 + i * (w + gap),
      y: 178,
      w,
      h: 230,
    }));
  }
  if (screen === 'over' || screen === 'victory') {
    return [
      { id: 'restart', label: '↻  Play again', x: centre - 150, y: 416, w: 300, h: 48 },
      { id: 'title', label: 'Back to title', x: centre - 150, y: 472, w: 300, h: 36 },
    ];
  }
  return [];
}

/** Draw one frame: the world, the HUD, then the active screen's overlay. */
export function drawGame(ctx, state, mouse) {
  ctx.save();
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground(ctx, state);
  drawFireflies(ctx, state);
  drawHeart(ctx, state);
  for (const bloom of state.blooms) drawBloom(ctx, state, bloom);
  const sorted = [...state.wisps].sort((a, b) => a.y - b.y);
  for (const wisp of sorted) drawWisp(ctx, state, wisp);
  drawPickups(ctx, state);
  drawBolts(ctx, state);
  drawPlayer(ctx, state);
  drawParticles(ctx, state);

  // Damage vignette.
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 60, 50, ${0.22 * state.flash})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  // Soft edge vignette, always on.
  ctx.drawImage(vignetteLayer(), 0, 0);
  ctx.restore();

  const screen = state.screen;
  if (screen === 'play' || screen === 'pause' || screen === 'upgrade') drawHud(ctx, state);
  const buttons = screenButtons(screen, state);
  if (screen === 'title') drawTitle(ctx, state, buttons, mouse);
  else if (screen === 'help') drawHelp(ctx, buttons, mouse);
  else if (screen === 'pause') drawPause(ctx, buttons, mouse);
  else if (screen === 'upgrade') drawUpgradeScreen(ctx, state, buttons, mouse);
  else if (screen === 'over') drawEndScreen(ctx, state, buttons, mouse, false);
  else if (screen === 'victory') drawEndScreen(ctx, state, buttons, mouse, true);
}
