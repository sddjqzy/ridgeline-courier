// The 3D scene: sky, sun and ridge silhouette, a projected heightfield, the
// strip, the rings, the trees and the plane itself, all painted on one 2D
// canvas with a small camera and perspective projection. No libraries.
import { CAMERA_BACK, CAMERA_UP, FOV, RING_RADIUS, WATER_LEVEL } from './config.js';
import { groundColour, RUNWAY, WINDSOCK } from './terrain.js';
import { hash2 } from './random.js';

const GRID_STEP = 90;
const GRID_RADIUS = 1200;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  // Sixteen clouds that drift slowly over the valley, fixed by seed.
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    clouds.push({
      x: -1600 + hash2(i, 3, 77) * 3200,
      z: -1600 + hash2(i, 5, 77) * 3200,
      y: 300 + hash2(i, 7, 77) * 130,
      s: 70 + hash2(i, 9, 77) * 110,
      drift: 1.5 + hash2(i, 11, 77) * 2.5,
    });
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  }
  window.addEventListener('resize', resize);
  resize();

  /** Build the camera basis from the plane's pose. */
  function camera(plane) {
    const sinH = Math.sin(plane.heading);
    const cosH = Math.cos(plane.heading);
    const back = {
      x: -sinH * CAMERA_BACK,
      z: cosH * CAMERA_BACK,
      y: -CAMERA_UP + Math.sin(plane.pitch) * 4,
    };
    const pos = { x: plane.x + back.x, y: plane.y + back.y, z: plane.z + back.z };
    const target = {
      x: plane.x + sinH * 26,
      y: plane.y + Math.sin(plane.pitch) * 18 - 1,
      z: plane.z - cosH * 26,
    };
    let f = norm({
      x: target.x - pos.x,
      y: target.y - pos.y,
      z: target.z - pos.z,
    });
    // Roll the camera with the plane, but only part-way: the horizon tilts
    // without ever turning the world upside down.
    const roll = plane.roll * 0.45;
    const up0 = { x: 0, y: 1, z: 0 };
    const r0 = norm(cross(f, up0));
    const u0 = cross(r0, f);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const r = {
      x: r0.x * cr + u0.x * sr,
      y: r0.y * cr + u0.y * sr,
      z: r0.z * cr + u0.z * sr,
    };
    const u = cross(r, f);
    return { pos, f, r, u };
  }

  function norm(v) {
    const len = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }
  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  /** Project a world point; returns null when behind the camera. */
  function makeProjector(cam) {
    const focal = (height / 2) / Math.tan(FOV / 2);
    return (x, y, z) => {
      const vx = x - cam.pos.x;
      const vy = y - cam.pos.y;
      const vz = z - cam.pos.z;
      const cx = vx * cam.r.x + vy * cam.r.y + vz * cam.r.z;
      const cy = vx * cam.u.x + vy * cam.u.y + vz * cam.u.z;
      const cz = vx * cam.f.x + vy * cam.f.y + vz * cam.f.z;
      if (cz < 1.2) return null;
      return {
        x: width / 2 + (cx * focal) / cz,
        y: height / 2 - (cy * focal) / cz,
        scale: focal / cz,
        depth: cz,
      };
    };
  }

  function drawSky(cam, time) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#2b6cb8');
    g.addColorStop(0.45, '#7fb6dd');
    g.addColorStop(0.62, '#cfe8f2');
    g.addColorStop(1, '#dceef5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    // The sun, fixed in the north-west sky.
    const sun = { x: width * 0.2, y: height * 0.16 };
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 90);
    glow.addColorStop(0, 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.25, 'rgba(255,236,170,0.55)');
    glow.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 90, sun.y - 90, 180, 180);
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 17, 0, Math.PI * 2);
    ctx.fill();
    // A hazy ridge silhouette along the horizon, so the skyline reads.
    ctx.fillStyle = 'rgba(96,118,150,0.5)';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.62);
    for (let sx = 0; sx <= width; sx += 24) {
      const n = hash2(Math.floor(sx / 24), 4, 31) * 0.5 + hash2(Math.floor(sx / 24), 8, 31) * 0.5;
      ctx.lineTo(sx, height * (0.60 - n * 0.07));
    }
    ctx.lineTo(width, height * 0.62);
    ctx.closePath();
    ctx.fill();
    void cam;
    void time;
  }

  function drawClouds(project, time) {
    ctx.save();
    for (const cloud of clouds) {
      const cx = cloud.x + time * cloud.drift;
      const p = project(cx, cloud.y, cloud.z);
      if (!p || p.depth < 80) continue; // a cloud on the lens would blot the sky
      const w = Math.min(cloud.s * p.scale, 700);
      if (w < 6 || p.x < -w || p.x > width + w || p.y < -w * 0.4 || p.y > height + w * 0.4) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, w, w * 0.36, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - w * 0.55, p.y + w * 0.08, w * 0.6, w * 0.28, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + w * 0.55, p.y + w * 0.08, w * 0.6, w * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTerrain(project, plane, terrain, time) {
    const cx = Math.round(plane.x / GRID_STEP) * GRID_STEP;
    const cz = Math.round(plane.z / GRID_STEP) * GRID_STEP;
    const n = Math.ceil(GRID_RADIUS / GRID_STEP);
    const quads = [];
    for (let i = -n; i < n; i += 1) {
      for (let j = -n; j < n; j += 1) {
        const x0 = cx + i * GRID_STEP;
        const z0 = cz + j * GRID_STEP;
        const mx = x0 + GRID_STEP / 2;
        const mz = z0 + GRID_STEP / 2;
        const dx = mx - plane.x;
        const dz = mz - plane.z;
        const dist = Math.hypot(dx, dz);
        if (dist > GRID_RADIUS) continue;
        // Skip the far side: only quads roughly ahead of the plane matter.
        const h00 = terrain.heightAt(x0, z0);
        const h10 = terrain.heightAt(x0 + GRID_STEP, z0);
        const h01 = terrain.heightAt(x0, z0 + GRID_STEP);
        const h11 = terrain.heightAt(x0 + GRID_STEP, z0 + GRID_STEP);
        quads.push({ x0, z0, h00, h10, h01, h11, dist });
      }
    }
    quads.sort((a, b) => b.dist - a.dist);
    for (const q of quads) {
      const p00 = project(q.x0, q.h00, q.z0);
      const p10 = project(q.x0 + GRID_STEP, q.h10, q.z0);
      const p01 = project(q.x0, q.h01, q.z0 + GRID_STEP);
      const p11 = project(q.x0 + GRID_STEP, q.h11, q.z0 + GRID_STEP);
      if (!p00 || !p10 || !p01 || !p11) continue;
      const hm = (q.h00 + q.h10 + q.h01 + q.h11) / 4;
      const slope = Math.max(Math.abs(q.h10 - q.h00), Math.abs(q.h01 - q.h00)) / GRID_STEP;
      const jitter = hash2(Math.round(q.x0 / GRID_STEP), Math.round(q.z0 / GRID_STEP), 13);
      let col = groundColour(hm, slope, jitter);
      if (hm < WATER_LEVEL + 0.4) {
        // Water shimmers with the clock.
        const shimmer = 0.5 + 0.5 * Math.sin(time * 0.7 + q.x0 * 0.05 + q.z0 * 0.04);
        col = [46 + shimmer * 14, 104 + shimmer * 16, 138 + shimmer * 12];
      }
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.beginPath();
      const pts = [p00, p10, p11, p01];
      let started = false;
      for (const p of pts) {
        const px = p ? p.x : width / 2;
        const py = p ? p.y : height / 2;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function quad(project, corners, fill) {
    const pts = corners.map(([x, y, z]) => project(x, y, z));
    if (pts.some((p) => !p)) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
  }

  function drawRunway(project) {
    const { x, z, length, width: w } = RUNWAY;
    const y = 0.6;
    const hw = w / 2;
    const hl = length / 2;
    quad(project, [
      [x - hw, y, z - hl],
      [x + hw, y, z - hl],
      [x + hw, y, z + hl],
      [x - hw, y, z + hl],
    ], '#3a3f46');
    // Edge lines and centreline dashes.
    quad(project, [[x - hw + 0.8, y + 0.05, z - hl], [x - hw + 2, y + 0.05, z - hl], [x - hw + 2, y + 0.05, z + hl], [x - hw + 0.8, y + 0.05, z + hl]], '#e8e8e8');
    quad(project, [[x + hw - 2, y + 0.05, z - hl], [x + hw - 0.8, y + 0.05, z - hl], [x + hw - 0.8, y + 0.05, z + hl], [x + hw - 2, y + 0.05, z + hl]], '#e8e8e8');
    for (let dz = -hl + 20; dz < hl - 20; dz += 44) {
      quad(project, [[x - 1, y + 0.05, z + dz], [x + 1, y + 0.05, z + dz], [x + 1, y + 0.05, z + dz + 22], [x - 1, y + 0.05, z + dz + 22]], '#f5f5f0');
    }
    // Threshold bars at both ends.
    for (const end of [-hl + 8, hl - 8]) {
      for (let k = -3; k <= 3; k += 1) {
        quad(project, [[x + k * 3.4 - 1.2, y + 0.05, z + end], [x + k * 3.4 + 1.2, y + 0.05, z + end], [x + k * 3.4 + 1.2, y + 0.05, z + end + 9], [x + k * 3.4 - 1.2, y + 0.05, z + end + 9]], '#f5f5f0');
      }
    }
    // The windsock beside the southern end.
    const base = project(WINDSOCK.x, 0, WINDSOCK.z);
    const top = project(WINDSOCK.x, 11, WINDSOCK.z);
    if (base && top) {
      ctx.strokeStyle = '#d8d8d8';
      ctx.lineWidth = Math.max(1, 2.4 * top.scale);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      const sockEnd = project(WINDSOCK.x + 7, 10.2, WINDSOCK.z + 2);
      if (sockEnd) {
        ctx.fillStyle = '#ff7a1a';
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(sockEnd.x, sockEnd.y - 3);
        ctx.lineTo(sockEnd.x, sockEnd.y + 3);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawRings(project, missions) {
    const { rings, next } = missions.state;
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      if (ring.passed) continue;
      const isNext = i === next;
      // The ring faces the pilot flying in from the previous waypoint.
      const prev = i === 0 ? { x: 0, y: 30, z: 190 } : rings[i - 1];
      let nx = ring.x - prev.x;
      let ny = ring.y - prev.y;
      let nz = ring.z - prev.z;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      // A frame in the ring's plane: right and up vectors.
      let rx = -nz;
      let rz = nx;
      const rl = Math.hypot(rx, rz) || 1;
      rx /= rl;
      rz /= rl;
      const ux = -ny * rz;
      const uy = nz * rx - nx * rz;
      const uz = rx * ny;
      const up = { x: ux, y: uy, z: uz };
      const ul = Math.hypot(up.x, up.y, up.z) || 1;
      up.x /= ul;
      up.y /= ul;
      up.z /= ul;
      const dist = Math.hypot(ring.x - 0, ring.y - 0, ring.z - 0);
      void dist;
      const colour = isNext ? '#ffd34d' : 'rgba(120,200,255,0.85)';
      ctx.save();
      ctx.lineJoin = 'round';
      for (const pass of [0, 1]) {
        ctx.beginPath();
        let first = true;
        for (let k = 0; k <= 28; k += 1) {
          const a = (k / 28) * Math.PI * 2;
          const px = ring.x + (rx * Math.cos(a) + up.x * Math.sin(a)) * RING_RADIUS;
          const py = ring.y + (0 * Math.cos(a) + up.y * Math.sin(a)) * RING_RADIUS;
          const pz = ring.z + (rz * Math.cos(a) + up.z * Math.sin(a)) * RING_RADIUS;
          const p = project(px, py, pz);
          if (!p) {
            first = true;
            continue;
          }
          if (first) {
            ctx.moveTo(p.x, p.y);
            first = false;
          } else ctx.lineTo(p.x, p.y);
        }
        if (pass === 0) {
          ctx.strokeStyle = isNext ? 'rgba(255,211,77,0.25)' : 'rgba(120,200,255,0.18)';
          ctx.lineWidth = 14;
        } else {
          ctx.strokeStyle = colour;
          ctx.lineWidth = 3.5;
        }
        ctx.stroke();
      }
      ctx.restore();
      if (isNext) {
        const p = project(ring.x, ring.y + RING_RADIUS + 8, ring.z);
        if (p) {
          ctx.fillStyle = '#ffd34d';
          ctx.font = `bold ${Math.max(13, Math.min(20, 420 / Math.max(20, p.depth)))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(`RING ${i + 1} · ${rings[i].name.toUpperCase()}`, p.x, p.y);
        }
      }
    }
  }

  function drawTrees(project, plane, terrain) {
    const trees = terrain.treesNear(plane.x, plane.z, 650);
    for (const tree of trees) {
      const base = project(tree.x, tree.y, tree.z);
      if (!base) continue;
      const hPx = tree.s * base.scale;
      if (hPx < 3) continue;
      if (base.x < -40 || base.x > width + 40 || base.y < -40 || base.y > height + 40) continue;
      ctx.fillStyle = '#2d5a2e';
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - hPx);
      ctx.lineTo(base.x - hPx * 0.42, base.y - hPx * 0.1);
      ctx.lineTo(base.x + hPx * 0.42, base.y - hPx * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a7038';
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - hPx * 0.75);
      ctx.lineTo(base.x - hPx * 0.3, base.y - hPx * 0.05);
      ctx.lineTo(base.x + hPx * 0.3, base.y - hPx * 0.05);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPlaneShadow(project, plane, terrain) {
    const ground = terrain.heightAt(plane.x, plane.z);
    const above = plane.y - ground;
    if (above < 1 || above > 400) return;
    const p = project(plane.x, ground + 0.8, plane.z);
    if (!p) return;
    const rx = Math.min(120, 9 * p.scale * Math.min(1, 60 / above));
    const ry = rx * 0.32;
    ctx.fillStyle = `rgba(20,30,20,${Math.max(0.06, 0.3 - above * 0.0006)})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(2, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** The courier plane itself, seen from behind and slightly above. */
  function drawPlane(project, plane, time) {
    const p = project(plane.x, plane.y, plane.z);
    if (!p) return;
    const sx = p.x;
    const sy = p.y - plane.pitch * 90;
    const s = 1.15;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(plane.roll * 0.55);
    ctx.scale(s, s);
    // Propeller blur: a translucent disc with spokes that spin with time.
    // The nose points away from the camera, so the prop sits at the top.
    ctx.save();
    ctx.translate(0, -42);
    ctx.fillStyle = 'rgba(220,225,230,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,95,100,0.5)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k += 1) {
      const a = time * 38 + (k * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * 26, -Math.sin(a) * 26);
      ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26);
      ctx.stroke();
    }
    ctx.restore();
    // Main wing, with red and green tip lights.
    ctx.fillStyle = '#e8e2d2';
    roundRect(-104, -2, 208, 15, 7);
    ctx.fill();
    ctx.fillStyle = '#c23b2e';
    roundRect(-104, -2, 14, 15, 6);
    ctx.fill();
    ctx.fillStyle = '#c23b2e';
    roundRect(90, -2, 14, 15, 6);
    ctx.fill();
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(-106, 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#37d67a';
    ctx.beginPath();
    ctx.arc(106, 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Tailplane and fin: the tail is nearest the camera, at the bottom.
    ctx.fillStyle = '#dcd5c2';
    roundRect(-44, 26, 88, 11, 5);
    ctx.fill();
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.moveTo(-9, 30);
    ctx.lineTo(9, 30);
    ctx.lineTo(4, 58);
    ctx.lineTo(-4, 58);
    ctx.closePath();
    ctx.fill();
    // Fuselage: cream body, red cheatline, dark cockpit glass near the nose.
    ctx.fillStyle = '#f2ead8';
    ctx.beginPath();
    ctx.ellipse(0, 4, 15, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c23b2e';
    ctx.fillRect(-15, 12, 30, 5);
    ctx.fillStyle = '#22384f';
    ctx.beginPath();
    ctx.ellipse(-6.5, -16, 4.5, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(6.5, -16, 4.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22384f';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N7-RL', 0, 24);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.closePath();
  }

  /** After the last ring, a green diamond marks the strip so the pilot can find home. */
  function drawStripMarker(project, plane, missions) {
    if (missions.state.phase !== 'approach') return;
    const p = project(0, 4, 260);
    if (!p) return;
    const dist = Math.round(Math.hypot(plane.x, plane.y - 2, plane.z - 260));
    const s = Math.max(10, Math.min(26, 500 / Math.max(20, p.depth)));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = '#6fe08a';
    ctx.fillStyle = 'rgba(111,224,138,0.25)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6fe08a';
    ctx.font = `bold ${Math.max(13, Math.min(19, s))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`STRIP ${dist} m`, 0, -s - 8);
    ctx.restore();
  }

  /** Paint one frame of the world; the HUD is drawn by hud.js afterwards. */
  function drawScene(view) {
    const { plane, missions, terrain, time } = view;
    resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = camera(plane);
    const project = makeProjector(cam);
    drawSky(cam, time);
    drawClouds(project, time);
    drawTerrain(project, plane, terrain, time);
    drawRunway(project);
    drawTrees(project, plane, terrain);
    drawRings(project, missions);
    drawStripMarker(project, plane, missions);
    drawPlaneShadow(project, plane, terrain);
    drawPlane(project, plane, time);
    return { project, cam };
  }

  return { drawScene, width: () => width, height: () => height };
}
