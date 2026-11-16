// Keyboard and mouse state, read by the game loop. Keys are tracked by code
// so WASD and arrows share the same movement; clicks are delivered once, as
// press events the screens consume, so a held button never double-fires.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    pressed: [],
    releasedKeys: [],
    justPressedKeys: new Set(),
  };

  const toLogical = (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * 960;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * 540;
  };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      input.keys.add(event.code);
      input.justPressedKeys.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('pointermove', toLogical);
  canvas.addEventListener('pointerdown', (event) => {
    toLogical(event);
    input.mouseDown = true;
    input.pressed.push({ x: input.mouseX, y: input.mouseY, button: event.button });
  });
  window.addEventListener('pointerup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  return input;
}

/** The movement vector from the held keys, normalised. */
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

/** True once, on the frame the key went down. */
export function justPressed(input, code) {
  return input.justPressedKeys.has(code);
}

/** Clear the once-per-frame queues. Called at the end of every rendered frame. */
export function endFrame(input) {
  input.pressed.length = 0;
  input.justPressedKeys.clear();
}
