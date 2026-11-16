// Glowgarden: boot, the fixed-step game loop, and the screen state machine.
// The simulation always advances in whole STEP slices; the renderer draws the
// state those slices leave behind, scaled to fit the browser window.
import { BLOOM, FIELD, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput, endFrame, justPressed, moveVector } from './input.js';
import { createWorld, stepWorld } from './garden.js';
import { drawGame, screenButtons } from './render.js';
import { applyUpgrade, rollUpgrades } from './upgrades.js';
import { shotParams, stageShot } from './shots.js';

const BEST_KEY = 'glowgarden_best';

function loadBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Private mode or a sandboxed frame: the best score simply does not persist.
  }
}

function fitCanvas(canvas) {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  const cssWidth = Math.floor(FIELD.width * scale);
  const cssHeight = Math.floor(FIELD.height * scale);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  return (cssWidth * dpr) / FIELD.width;
}

function main() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const audio = createAudio();
  const input = createInput(canvas);
  const best = loadBest();

  let viewScale = fitCanvas(canvas);
  window.addEventListener('resize', () => {
    viewScale = fitCanvas(canvas);
  });

  const makeWorld = (seed) => createWorld(seed, audio, best);
  let state = makeWorld((Date.now() % 2147483647) + 1);
  state.screen = 'title';

  // Read-only hook for automated play-testing: window.__glowgarden.state.
  Object.defineProperty(window, '__glowgarden', { value: { get state() { return state; } } });

  const shot = shotParams();
  if (shot) {
    state = makeWorld(shot.seed);
    state.screen = stageShot(shot.name, state, () => makeWorld(shot.seed));
    state.best = Math.max(best, state.score);
  }

  function announce(text) {
    if (status) status.textContent = text;
  }

  function startRun() {
    state = makeWorld((Date.now() % 2147483647) + 1);
    state.screen = 'play';
    audio.unlock();
    announce('Night 1. Defend the garden heart.');
  }

  function backToTitle() {
    state = makeWorld((Date.now() % 2147483647) + 1);
    state.screen = 'title';
    announce('Glowgarden title screen.');
  }

  function endRun() {
    const won = state.outcome === 'won';
    state.screen = won ? 'victory' : 'over';
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.score);
    }
    if (won) audio.victory();
    else audio.defeat();
    announce(won ? 'Dawn breaks. You win.' : 'The garden falls dark. Game over.');
  }

  function openUpgrade() {
    state.upgradeChoices = rollUpgrades(state);
    state.screen = 'upgrade';
    audio.levelUp();
    announce(`Level ${state.player.level}. Choose a boon.`);
  }

  function chooseUpgrade(index) {
    const upgrade = state.upgradeChoices[index];
    if (!upgrade) return;
    applyUpgrade(state, upgrade);
    state.pendingLevels -= 1;
    audio.click();
    if (state.pendingLevels > 0) {
      openUpgrade();
    } else {
      state.screen = 'play';
    }
  }

  function plantAt(x, y) {
    const player = state.player;
    const dx = x - player.x;
    const dy = y - player.y;
    const distance = Math.hypot(dx, dy);
    const range = BLOOM.plantRange;
    if (distance > range) {
      return { x: player.x + (dx / distance) * range, y: player.y + (dy / distance) * range };
    }
    return { x, y };
  }

  function handleButtons() {
    const buttons = screenButtons(state.screen, state);
    for (const press of input.pressed) {
      audio.unlock();
      const hit = buttons.find(
        (button) => press.x >= button.x && press.x <= button.x + button.w && press.y >= button.y && press.y <= button.y + button.h,
      );
      if (!hit) continue;
      audio.click();
      if (hit.id === 'start' || hit.id === 'restart') startRun();
      else if (hit.id === 'help') state.screen = 'help';
      else if (hit.id === 'back') state.screen = 'title';
      else if (hit.id === 'resume') state.screen = 'play';
      else if (hit.id === 'title') backToTitle();
      else if (hit.id === 'mute') audio.toggleMute();
      else if (hit.id.startsWith('upgrade:')) chooseUpgrade(Number(hit.id.split(':')[1]));
      return true;
    }
    return false;
  }

  function handleKeys() {
    if (justPressed(input, 'KeyM')) audio.toggleMute();
    if (state.screen === 'title') {
      if (justPressed(input, 'Enter') || justPressed(input, 'Space')) startRun();
      else if (justPressed(input, 'KeyH')) state.screen = 'help';
    } else if (state.screen === 'help') {
      if (justPressed(input, 'Escape') || justPressed(input, 'Enter')) state.screen = 'title';
    } else if (state.screen === 'play') {
      if (justPressed(input, 'KeyP') || justPressed(input, 'Escape')) state.screen = 'pause';
    } else if (state.screen === 'pause') {
      if (justPressed(input, 'KeyP') || justPressed(input, 'Escape') || justPressed(input, 'Enter')) state.screen = 'play';
      else if (justPressed(input, 'KeyR')) startRun();
    } else if (state.screen === 'upgrade') {
      if (justPressed(input, 'Digit1')) chooseUpgrade(0);
      else if (justPressed(input, 'Digit2')) chooseUpgrade(1);
      else if (justPressed(input, 'Digit3')) chooseUpgrade(2);
    } else if (state.screen === 'over' || state.screen === 'victory') {
      if (justPressed(input, 'KeyR') || justPressed(input, 'Enter')) startRun();
    }
  }

  function playOrders() {
    const move = moveVector(input);
    let pulse = justPressed(input, 'Space');
    let plant = null;
    for (const press of input.pressed) {
      if (press.button === 2) {
        plant = plantAt(press.x, press.y);
      } else {
        pulse = true;
      }
    }
    if (justPressed(input, 'KeyE')) {
      plant = { x: state.player.x + state.player.facing * 26, y: state.player.y + 10 };
    }
    return { move, pulse, plant };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') state.screen = 'pause';
  });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: false });
  window.addEventListener('keydown', () => audio.unlock(), { once: false });

  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;

    if (!shot) {
      handleKeys();
      const clickedButton = handleButtons();
      if (state.screen === 'play' && !clickedButton) {
        accumulator += elapsed;
        let steps = 0;
        const orders = playOrders();
        while (accumulator >= STEP && steps < 5) {
          stepWorld(state, STEP, steps === 0 ? orders : { move: orders.move, pulse: false, plant: null });
          accumulator -= STEP;
          steps += 1;
          if (state.outcome) break;
        }
        if (steps === 5) accumulator = 0;
        if (state.outcome) endRun();
        else if (state.pendingLevels > 0) openUpgrade();
      } else if (state.screen === 'title') {
        // The garden idles behind the title, so the cover is alive.
        accumulator += elapsed;
        while (accumulator >= STEP) {
          stepWorld(state, STEP, { move: { x: 0, y: 0 }, pulse: false, plant: null });
          accumulator -= STEP;
          if (state.outcome) {
            state = makeWorld((Date.now() % 2147483647) + 1);
            state.screen = 'title';
            break;
          }
        }
      } else {
        accumulator = 0;
      }
    }

    ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
    drawGame(ctx, state, { x: input.mouseX, y: input.mouseY });
    endFrame(input);
  }
  requestAnimationFrame(frame);
  announce('Glowgarden loaded.');
}

main();
