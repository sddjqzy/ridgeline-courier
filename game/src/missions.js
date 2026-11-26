// The sortie: five mail rings over the valley, in order, then a landing back
// on the strip. The rings are placed where the terrain lets them be flown,
// each one higher than the ground beneath it.
import { LANDING_POINTS, RING_POINTS, RING_RADIUS } from './config.js';

const RING_SPOTS = [
  { x: 350, y: 95, z: -600, name: 'Mill Bend' },
  { x: -520, y: 150, z: -1080, name: 'North Ridge' },
  { x: -820, y: 185, z: -180, name: 'West Pines' },
  { x: 180, y: 130, z: 720, name: 'River Mouth' },
  { x: 880, y: 115, z: 1080, name: 'Lake Shore' },
];

export function createMissions(terrain) {
  const rings = RING_SPOTS.map((spot) => {
    const ground = terrain.heightAt(spot.x, spot.z);
    return { ...spot, y: Math.max(spot.y, ground + 48), passed: false };
  });
  const state = {
    rings,
    next: 0,
    score: 0,
    time: 0,
    phase: 'takeoff', // takeoff -> rings -> approach -> done
    message: 'Throttle up (W) and lift off the strip.',
    messageUntil: 0,
  };
  return { state, reset, update, ringDistance };

  function reset() {
    for (const ring of rings) ring.passed = false;
    state.next = 0;
    state.score = 0;
    state.time = 0;
    state.phase = 'takeoff';
    state.message = 'Throttle up (W) and lift off the strip.';
    state.messageUntil = 0;
  }

  function say(text, seconds = 4) {
    state.message = text;
    state.messageUntil = state.time + seconds;
  }

  function ringDistance(plane) {
    const ring = rings[state.next];
    if (!ring) return 0;
    return Math.hypot(ring.x - plane.x, ring.y - plane.y, ring.z - plane.z);
  }

  /** Advance the mission by one step; returns an event string or ''. */
  function update(dt, plane, event) {
    state.time += dt;
    if (state.phase === 'done') return '';
    if (event === 'takeoff') {
      state.phase = 'rings';
      say(`Airborne. Ring 1 of 5: ${rings[0].name} — follow the gold ring.`, 5);
      return 'takeoff';
    }
    if (event === 'crashed') {
      state.phase = 'done';
      return 'crashed';
    }
    if (event === 'landed') {
      if (state.next >= rings.length) {
        const fuelBonus = Math.round(plane.fuel * 2);
        const timeBonus = Math.max(0, 300 - Math.round(state.time));
        state.score += LANDING_POINTS + fuelBonus + timeBonus;
        state.phase = 'done';
        say(`Mail delivered. Landing +${LANDING_POINTS}, fuel +${fuelBonus}, time +${timeBonus}.`, 8);
        return 'delivered';
      }
      state.phase = 'done';
      say('Landed early — the mail run is unfinished.', 6);
      return 'landed-early';
    }
    if (state.phase === 'rings' || state.phase === 'approach') {
      const ring = rings[state.next];
      if (ring) {
        const d = Math.hypot(ring.x - plane.x, ring.y - plane.y, ring.z - plane.z);
        if (d < RING_RADIUS) {
          ring.passed = true;
          state.score += RING_POINTS;
          state.next += 1;
          if (state.next >= rings.length) {
            state.phase = 'approach';
            say('All rings flown. Turn back and land on the strip.', 6);
          } else {
            say(`Ring ${state.next} of 5: ${rings[state.next].name}. +${RING_POINTS}`, 4);
          }
          return 'ring';
        }
      }
    }
    if (event === 'scrape') say('Terrain scrape — airframe damaged.', 3);
    if (plane.fuel <= 0 && state.phase !== 'done') say('Fuel empty — gliding. Find the strip.', 5);
    return '';
  }
}
