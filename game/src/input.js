// Keyboard and mouse: W/S throttle, arrows (or mouse) steer, F flaps,
// P pause, R restart, Enter or click confirms. The mouse steers toward
// where the pointer sits relative to the centre of the screen.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

export function createInput(canvas) {
  const keys = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let actions = 0;
  let flapsToggle = false;

  function keyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (event.code === 'KeyF') flapsToggle = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function keyUp(event) {
    keys.delete(event.code);
  }
  function mouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width - 0.5;
    mouseY = (event.clientY - rect.top) / rect.height - 0.5;
    mouseActive = true;
  }
  function mouseDown() {
    actions |= ACTION_CONFIRM;
  }
  function mouseLeave() {
    mouseActive = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  canvas.addEventListener('mouseleave', mouseLeave);

  /** Steering for this frame: roll/pitch in [-1, 1], throttle delta per second. */
  function steering() {
    let roll = 0;
    let pitch = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
    if (keys.has('ArrowUp')) pitch += 1;
    if (keys.has('ArrowDown')) pitch -= 1;
    if (mouseActive && roll === 0 && pitch === 0) {
      // The pointer steers gently; the keys always win over the mouse.
      roll = Math.max(-1, Math.min(1, mouseX * 2.4));
      pitch = Math.max(-1, Math.min(1, -mouseY * 2.2));
    }
    let throttle = 0;
    if (keys.has('KeyW')) throttle += 0.55;
    if (keys.has('KeyS')) throttle -= 0.55;
    const flaps = flapsToggle;
    flapsToggle = false;
    return { roll, pitch, throttle, flapsToggle: flaps };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { steering, takeActions };
}
