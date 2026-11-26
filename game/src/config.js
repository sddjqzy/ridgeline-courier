// Tunables for Ridgeline Courier: one place for every number the flight model,
// the world and the missions share, so a balance change never needs a code hunt.
export const STEP = 1 / 60;
export const BEST_KEY = 'ridgeline-courier-best';

/** World size in metres; the valley is a square island of this side. */
export const WORLD_HALF = 1800;
/** Sea level; terrain below this is the lake. */
export const WATER_LEVEL = 0;
/** Height of the plane's belly above the ground when parked. */
export const PARK_HEIGHT = 1.6;
/** Lowest speed that still flies (m/s); below it the nose drops. */
export const STALL_SPEED = 24;
/** Speed the throttle can reach at full power (m/s). */
export const MAX_SPEED = 62;
/** Speed at idle throttle (m/s): still above the stall, so the wing flies. */
export const MIN_SPEED = 28;
/** How fast the plane may bank (radians). */
export const MAX_ROLL = 0.95;
/** How fast the plane may pitch (radians). */
export const MAX_PITCH = 0.5;
/** Fuel units at the start of a sortie. */
export const FUEL_START = 100;
/** Seconds a full tank lasts near cruise throttle. */
export const FUEL_BURN_BASE = 0.09;
export const FUEL_BURN_THROTTLE = 0.42;
/** Radius of a target ring in metres. */
export const RING_RADIUS = 22;
/** Points for each ring, and for a clean landing. */
export const RING_POINTS = 100;
export const LANDING_POINTS = 300;
/** Camera chase distance behind the plane, and height above it. */
export const CAMERA_BACK = 15;
export const CAMERA_UP = 4.6;
/** Vertical field of view in radians. */
export const FOV = 1.22;
