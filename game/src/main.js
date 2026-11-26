// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens:
// title, play, paused and game over.
//
// ?seed=N fixes the valley. ?shot=takeoff|rings|landing|title (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createTerrain } from './terrain.js';
import { createPlane } from './flight.js';
import { createMissions } from './missions.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261126;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const terrain = createTerrain(createRandom(seed));
const plane = createPlane(terrain);
const missions = createMissions(terrain);
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();
const world = { plane: plane.state, fly: plane, missions, terrain, reset };

let time = 0;

function reset() {
  plane.reset();
  missions.reset();
  time = 0;
}
reset();

/** Anything thrown while booting or painting is written where a screenshot run can see it. */
window.addEventListener('error', (event) => {
  document.title = `ERROR: ${event.message}`;
});

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    const view = { plane: plane.state, missions, terrain, time };
    renderer.drawScene(view);
    hud.draw(view, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Flying. Five rings, then land on the strip.');
  }

  function endGame(delivered) {
    screen = SCREEN_OVER;
    if (missions.state.score > best) {
      best = missions.state.score;
      saveBest(best);
    }
    announce(delivered ? `Mail delivered. Score ${missions.state.score}.` : `Sortie over. Score ${missions.state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    time += STEP;
    const event = plane.step(STEP, input.steering());
    const missionEvent = missions.update(STEP, plane.state, event);
    audio.setFlight(plane.state.throttle, plane.state.speed, plane.state.airborne);
    if (missionEvent === 'ring') audio.chime();
    else if (event === 'scrape') audio.thud();
    else if (event === 'touchdown') audio.thud();
    if (missionEvent === 'delivered' || missionEvent === 'landed-early' || missionEvent === 'crashed') {
      endGame(missionEvent === 'delivered');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const view = { plane: plane.state, missions, terrain, time };
    renderer.drawScene(view);
    hud.draw(view, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Ridgeline Courier. Press Enter or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
