// The valley itself: a seeded heightfield with a river plain, a ridge to the
// north, a lake in the south-east, and a flattened grass strip for the runway.
// Everything the game asks about the ground goes through heightAt().
import { valueNoise, hash2 } from './random.js';
import { WATER_LEVEL, WORLD_HALF } from './config.js';

/** Runway centre, heading north (-z), 520 m long and 26 m wide. */
export const RUNWAY = {
  x: 0,
  z: 0,
  length: 520,
  width: 26,
  heading: 0, // north
};

/** A windsock pole stands beside the strip's southern end. */
export const WINDSOCK = { x: 34, z: 210 };

const SEED = 20261126;

function baseHeight(x, z) {
  // Rolling hills, two octaves, plus a high ridge along the northern edge.
  const hills = valueNoise(x, z, 620, SEED) * 95;
  const detail = valueNoise(x + 300, z - 170, 190, SEED + 7) * 26;
  const ridge = Math.max(0, (-z - 1150) / 650) * 210 * (0.55 + 0.45 * valueNoise(x, 0, 700, SEED + 21));
  // A lake hollow in the south-east corner.
  const dx = x - 1150;
  const dz = z - 1150;
  const lake = Math.max(0, 1 - (dx * dx + dz * dz) / (620 * 620)) * 46;
  return 6 + hills + detail + ridge - lake;
}

/** Distance from a point to the runway rectangle (0 inside it). */
export function runwayDistance(x, z) {
  const dx = Math.abs(x - RUNWAY.x) - RUNWAY.width / 2;
  const dz = Math.abs(z - RUNWAY.z) - RUNWAY.length / 2;
  const ox = Math.max(dx, 0);
  const oz = Math.max(dz, 0);
  return Math.hypot(ox, oz);
}

export function createTerrain() {
  function heightAt(x, z) {
    const cx = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, x));
    const cz = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, z));
    let h = baseHeight(cx, cz);
    // Flatten the strip and its apron so take-offs and landings are level.
    const d = runwayDistance(cx, cz);
    const flat = d < 60 ? 1 : d > 190 ? 0 : 1 - (d - 60) / 130;
    h = h * (1 - flat) + 0 * flat;
    // A gentle bowl at the world edge keeps the plane inside the valley.
    const edge = Math.max(Math.abs(cx), Math.abs(cz));
    if (edge > 1500) h += (edge - 1500) * 0.55;
    return h;
  }

  function slopeAt(x, z) {
    const e = 8;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  /** Is the point on the strip (inside the rectangle, near ground level)? */
  function onRunway(x, z) {
    return runwayDistance(x, z) <= 0.5;
  }

  /** Tree spots: deterministic per 90 m cell, only on gentle low ground. */
  function treesNear(x, z, radius) {
    const out = [];
    const cell = 90;
    const i0 = Math.floor((x - radius) / cell);
    const i1 = Math.floor((x + radius) / cell);
    const j0 = Math.floor((z - radius) / cell);
    const j1 = Math.floor((z + radius) / cell);
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        if (hash2(i, j, SEED + 99) > 0.42) continue;
        const tx = (i + 0.5 + (hash2(i, j, SEED + 5) - 0.5) * 0.7) * cell;
        const tz = (j + 0.5 + (hash2(i, j, SEED + 6) - 0.5) * 0.7) * cell;
        if (Math.hypot(tx - x, tz - z) > radius) continue;
        const h = heightAt(tx, tz);
        if (h < 2 || h > 130) continue;
        if (slopeAt(tx, tz) > 0.55) continue;
        if (runwayDistance(tx, tz) < 45) continue;
        out.push({ x: tx, z: tz, y: h, s: 7 + hash2(i, j, SEED + 11) * 6 });
      }
    }
    return out;
  }

  return { heightAt, slopeAt, onRunway, treesNear };
}

/** Colour of the ground at a height, as [r, g, b]; slopes darken it. */
export function groundColour(height, slope, jitter) {
  let c;
  if (height < WATER_LEVEL + 0.4) c = [52, 110, 138]; // shallow water edge
  else if (height < 3) c = [196, 178, 120]; // sandy shore
  else if (height < 60) c = [104, 158, 74]; // valley grass
  else if (height < 130) c = [122, 148, 66]; // high meadow
  else if (height < 210) c = [139, 122, 88]; // rocky slopes
  else c = [232, 238, 242]; // snow on the ridge
  const shade = 1 - Math.min(0.35, slope * 0.55) + (jitter - 0.5) * 0.08;
  return [Math.round(c[0] * shade), Math.round(c[1] * shade), Math.round(c[2] * shade)];
}
