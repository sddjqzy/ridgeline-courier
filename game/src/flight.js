// The flight model: throttle, pitch and bank in, a plane that climbs, turns,
// stalls and lands out. Speed is the resource: bank hard and it bleeds away,
// pull up slow and the nose drops, so throttle and turn discipline pay.
import {
  FUEL_BURN_BASE,
  FUEL_BURN_THROTTLE,
  FUEL_START,
  MAX_PITCH,
  MAX_ROLL,
  MAX_SPEED,
  MIN_SPEED,
  PARK_HEIGHT,
  STALL_SPEED,
} from './config.js';

const G = 9.81;

export function createPlane(terrain) {
  const state = freshState();
  return { state, reset, step };

  function freshState() {
    return {
      x: 0,
      z: 190, // parked near the southern threshold, facing north
      y: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: 0,
      throttle: 0,
      fuel: FUEL_START,
      damage: 0,
      flaps: false,
      airborne: false,
      flown: false, // true once the sortie has left the ground
      landed: false,
      crashed: false,
      crashReason: '',
      verticalSpeed: 0,
      rollOut: 0, // metres rolled on the ground after touchdown
    };
  }

  function reset() {
    const s = freshState();
    s.y = terrain.heightAt(s.x, s.z) + PARK_HEIGHT;
    Object.assign(state, s);
  }

  /**
   * One fixed step. `input` carries roll/pitch in [-1, 1], a throttle delta
   * per second, and a flaps toggle. Returns an event string or ''.
   */
  function step(dt, input) {
    const s = state;
    if (s.crashed || s.landed) return '';

    if (input.flapsToggle) s.flaps = !s.flaps;
    if (s.fuel > 0) {
      s.throttle = Math.max(0, Math.min(1, s.throttle + input.throttle * dt));
    } else {
      s.throttle = 0; // tank dry: the engine is out, glide what you have
    }

    // Speed chases the throttle, and banked turns and flaps bleed it away.
    const target = MIN_SPEED + s.throttle * (MAX_SPEED - MIN_SPEED) - (s.flaps ? 7 : 0);
    const accel = target > s.speed ? 7 : 9;
    s.speed += Math.max(-accel * dt, Math.min(accel * dt, target - s.speed));
    s.speed -= (Math.abs(s.roll) * 2.2 + (s.flaps ? 2.5 : 0)) * dt * (s.airborne ? 1 : 0.2);
    s.speed = Math.max(0, s.speed);

    // Bank and pitch ease toward what the pilot asks for.
    const rollTarget = input.roll * MAX_ROLL;
    const pitchTarget = input.pitch * MAX_PITCH;
    s.roll += Math.max(-2.4 * dt, Math.min(2.4 * dt, rollTarget - s.roll));
    s.pitch += Math.max(-1.7 * dt, Math.min(1.7 * dt, pitchTarget - s.pitch));

    // A banked wing turns the plane: bank right and the nose swings right.
    // The 1.35 factor is the courier's light controls: it answers at once.
    // On the ground the wing does nothing, so the turn is only a taxi nudge.
    const turnRate = (G * Math.tan(s.roll)) / Math.max(s.speed, 14) * 1.35 * (s.airborne ? 1 : 0.15);
    s.heading += turnRate * dt;

    // Climb comes from pitch and speed; below stall speed the nose drops.
    let climb = Math.sin(s.pitch) * s.speed;
    if (s.speed < STALL_SPEED && s.airborne) {
      climb -= (STALL_SPEED - s.speed) * 1.1;
      s.pitch += (-0.18 - s.pitch) * dt * 1.5;
    }
    s.verticalSpeed = climb;
    s.y += climb * dt;
    s.x += Math.sin(s.heading) * Math.cos(s.pitch) * s.speed * dt;
    s.z += -Math.cos(s.heading) * Math.cos(s.pitch) * s.speed * dt;

    // Fuel burns with the throttle; the tank is the sortie's clock.
    s.fuel = Math.max(0, s.fuel - (FUEL_BURN_BASE + FUEL_BURN_THROTTLE * s.throttle) * dt);

    // Keep the sortie inside the valley: the ridge turns the plane back.
    const edge = Math.max(Math.abs(s.x), Math.abs(s.z));
    if (edge > 1750) {
      s.heading += Math.PI * dt * 0.8;
      s.x = Math.max(-1750, Math.min(1750, s.x));
      s.z = Math.max(-1750, Math.min(1750, s.z));
    }

    const ground = terrain.heightAt(s.x, s.z);
    if (!s.airborne && s.speed > 26 && s.pitch > 0.02) {
      s.airborne = true; // rotation speed: the wing takes the weight
      s.flown = true;
      return 'takeoff';
    }
    if (s.y <= ground + PARK_HEIGHT) {
      return touchGround(ground, dt);
    }
    return '';
  }

  function touchGround(ground, dt) {
    const s = state;
    s.y = ground + PARK_HEIGHT;
    const onStrip = terrain.onRunway(s.x, s.z);
    const gentle = s.verticalSpeed > -6 && s.speed < 40 && Math.abs(s.roll) < 0.3;
    if (!s.airborne) {
      // Still rolling on the strip: brakes and drag slow the plane down.
      // A sortie that has flown and rolls to a stop is a landing.
      s.speed = Math.max(0, s.speed - 14 * dt);
      s.rollOut += s.speed * dt;
      if (s.flown && s.speed < 9) {
        s.landed = true;
        return 'landed';
      }
      return '';
    }
    if (onStrip && gentle) {
      s.airborne = false;
      s.pitch = 0;
      s.roll = 0;
      if (s.speed < 9) {
        s.landed = true;
        return 'landed';
      }
      return 'touchdown';
    }
    if (ground < -2 && !onStrip) {
      // The lake: a ditching at any speed is the end of the sortie.
      s.crashed = true;
      s.crashReason = 'ditched in the lake';
      return 'crashed';
    }
    if (s.verticalSpeed < -9 || s.speed > 42) {
      s.crashed = true;
      s.crashReason = onStrip ? 'crashed on the runway' : 'hit the terrain';
      return 'crashed';
    }
    // A hard scrape: it costs airframe, and the plane bounces back up.
    s.damage = Math.min(100, s.damage + 30);
    s.y = ground + PARK_HEIGHT + 4;
    s.speed *= 0.65;
    s.pitch = 0.05;
    if (s.damage >= 100) {
      s.crashed = true;
      s.crashReason = 'airframe gave out';
      return 'crashed';
    }
    return 'scrape';
  }
}
