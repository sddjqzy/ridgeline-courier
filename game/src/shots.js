// The screenshot scenes behind ?shot=takeoff|rings|landing|title. Each one
// plays the real rules forward from a fresh sortie for a fixed number of
// steps, steered by a simple autopilot (bank toward the next ring, pitch to
// hold its height, throttle to cruise), so the frame is what a real flight
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

const TAKEOFF_SECONDS = 9;
const RINGS_SECONDS = 9.5;
const LANDING_SECONDS = 20;

/**
 * Steer the plane toward a point at a target height. The heading aims at a
 * point beyond the target along the leg, so the approach is a straight line
 * through the target instead of a curve that orbits it; the bank eases off
 * close in, and near the target the throttle holds about 36 m/s, fast
 * enough to fly and slow enough to turn.
 */
function autopilot(plane, target, targetHeight, prev) {
  const dx = target.x - prev.x;
  const dz = target.z - prev.z;
  const dl = Math.hypot(dx, dz) || 1;
  const aimX = target.x + (dx / dl) * 200;
  const aimZ = target.z + (dz / dl) * 200;
  const ax = aimX - plane.x;
  const az = aimZ - plane.z;
  const dist = Math.hypot(target.x - plane.x, target.z - plane.z);
  const wantedHeading = Math.atan2(ax, -az);
  let diff = wantedHeading - plane.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  let roll = Math.max(-1, Math.min(1, diff * 2.0));
  if (dist < 300) roll *= Math.max(0.25, dist / 300);
  const heightError = targetHeight - plane.y;
  const pitch = Math.max(-1, Math.min(1, heightError * 0.06));
  const throttle = dist < 300 ? (plane.speed > 38 ? -0.4 : plane.speed < 34 ? 0.4 : 0) : 0.35;
  return { roll, pitch, throttle, flapsToggle: false };
}

function runSteps(world, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = steer(world.plane);
    const event = world.fly.step(STEP, input);
    world.missions.update(STEP, world.plane, event);
    if (world.plane.crashed || world.plane.landed) break;
  }
}

/**
 * Set the world to the named scene and return the screen to draw over it
 * and the best score to show. Any other name stages the title.
 */
export function stageShot(name, world) {
  world.reset();
  const plane = world.plane;
  const missions = world.missions;
  if (name === 'takeoff') {
    // Full throttle down the strip, just as the wing takes the weight.
    runSteps(world, TAKEOFF_SECONDS, () => ({ roll: 0, pitch: 0.55, throttle: 0.55, flapsToggle: false }));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'rings') {
    runSteps(world, 9, () => ({ roll: 0, pitch: 0.55, throttle: 0.55, flapsToggle: false }));
    const ring = missions.state.rings[missions.state.next];
    // Nine and a half seconds of cruise puts the plane on the ring's
    // doorstep, the gold ring big ahead and the valley below.
    runSteps(world, RINGS_SECONDS, (p) => autopilot(p, ring, ring.y, { x: 0, y: 30, z: 190 }));
    return { screen: SCREEN_PLAY, best: 320 };
  }
  if (name === 'landing') {
    // A second sortie set up on final approach: all rings flown, lined up
    // with the strip from the south, descending on the centreline with the
    // flaps down, on a 3-degree glidepath to the touchdown zone.
    world.reset();
    for (const ring of missions.state.rings) ring.passed = true;
    missions.state.next = missions.state.rings.length;
    missions.state.phase = 'approach';
    missions.state.score = 500;
    const ground = world.terrain.heightAt(0, 900);
    plane.x = 0;
    plane.z = 900;
    plane.y = ground + 80;
    plane.heading = 0;
    plane.pitch = -0.06;
    plane.roll = 0;
    plane.speed = 36;
    plane.throttle = 0.3;
    plane.flaps = true;
    plane.airborne = true;
    runSteps(world, LANDING_SECONDS, (p) => {
      // Two legs: south of the strip, get to the threshold at a safe height
      // over the hills; over the strip, fly down the centreline on a gentle
      // 3% slope and let her settle onto the asphalt.
      const overStrip = p.z < 280 && Math.abs(p.x) < 73;
      const target = overStrip ? { x: 0, z: -260 } : { x: 0, z: 280 };
      const glideHeight = overStrip
        ? (p.z + 260) * 0.03
        : Math.max(30, world.terrain.heightAt(p.x, p.z) + 25);
      const wanted = Math.atan2(target.x - p.x, -(target.z - p.z));
      let diff = wanted - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      let roll = Math.max(-1, Math.min(1, diff * 1.2));
      if (p.z < 400) roll *= 0.5;
      const pitch = Math.max(-1, Math.min(1, (glideHeight - p.y) * 0.05));
      const throttle = p.speed > 33 ? -0.3 : p.speed < 29 ? 0.3 : 0;
      return { roll, pitch, throttle, flapsToggle: false };
    });
    return { screen: plane.landed || plane.crashed ? SCREEN_OVER : SCREEN_PLAY, best: 500 };
  }
  // Title: a slow flyover of the valley behind the menu.
  runSteps(world, 9, () => ({ roll: 0, pitch: 0.55, throttle: 0.55, flapsToggle: false }));
  const ring = missions.state.rings[missions.state.next];
  runSteps(world, 14, (p) => autopilot(p, ring, ring.y, { x: 0, y: 30, z: 190 }));
  return { screen: SCREEN_TITLE, best: 640 };
}
