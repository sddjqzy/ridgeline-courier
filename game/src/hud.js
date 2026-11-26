// The HUD and the screens: altitude, speed and heading, a lit attitude
// indicator and gauges, the mission checklist, warnings, and the title,
// pause and end screens. Everything is drawn in screen space, on top of
// the 3D scene.
import { STALL_SPEED } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = 'rgba(10,22,36,0.62)';
const PANEL_EDGE = 'rgba(180,220,240,0.35)';
const INK = '#eaf6ff';
const AMBER = '#ffd34d';
const GREEN = '#6fe08a';
const RED = '#ff6a5a';

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  function panel(x, y, w, h, r = 10) {
    ctx.fillStyle = PANEL;
    ctx.strokeStyle = PANEL_EDGE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
  }

  function headingLabel(deg) {
    const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(deg / 45) % 8;
    if (deg % 90 === 0) return names[index];
    return String(Math.round(deg / 5) * 5).padStart(3, '0');
  }

  function drawCompass(w, plane) {
    const deg = ((plane.heading * 180) / Math.PI % 360 + 360) % 360;
    const cx = w / 2;
    panel(cx - 170, 12, 340, 46);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 170, 12, 340, 46);
    ctx.clip();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px sans-serif';
    for (let d = -60; d <= 60; d += 5) {
      const a = Math.round((deg + d) / 5) * 5;
      const norm = ((a % 360) + 360) % 360;
      const x = cx + d * 2.4;
      const major = norm % 45 === 0;
      const mid = norm % 15 === 0;
      ctx.strokeStyle = INK;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, major ? 32 : mid ? 28 : 24);
      ctx.stroke();
      if (major) ctx.fillText(headingLabel(norm), x, 48);
      else if (norm % 90 === 0) ctx.fillText(headingLabel(norm), x, 48);
    }
    ctx.restore();
    // Centre caret and the heading readout.
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(cx - 7, 12);
    ctx.lineTo(cx + 7, 12);
    ctx.lineTo(cx, 21);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${String(Math.round(deg)).padStart(3, '0')}°`, cx, 72);
  }

  function drawTapes(w, h, plane) {
    const knots = Math.round(plane.speed * 1.944);
    const feet = Math.round(plane.y * 3.281);
    // Airspeed, left.
    panel(14, 80, 132, 74);
    ctx.fillStyle = '#9fd8ef';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('AIRSPEED', 26, 100);
    ctx.fillStyle = INK;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(String(knots), 26, 132);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#9fd8ef';
    ctx.fillText('KT', 108, 132);
    ctx.fillStyle = '#2c6b8f';
    ctx.fillRect(26, 142, 108, 4);
    ctx.fillStyle = '#7fd0f0';
    ctx.fillRect(26, 142, Math.min(108, (knots / 130) * 108), 4);
    // Altitude, right.
    panel(w - 146, 80, 132, 74);
    ctx.fillStyle = '#9fd8ef';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALTITUDE', w - 134, 100);
    ctx.fillStyle = INK;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(String(feet), w - 134, 132);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#9fd8ef';
    ctx.fillText('FT', w - 52, 132);
    ctx.fillStyle = '#2c6b8f';
    ctx.fillRect(w - 134, 142, 108, 4);
    ctx.fillStyle = '#7fd0f0';
    ctx.fillRect(w - 134, 142, Math.min(108, (feet / 1500) * 108), 4);
    void h;
  }

  /** The attitude indicator: a lit dial with a sky/ground split that banks. */
  function drawAttitude(w, h, plane) {
    const cx = 92;
    const cy = h - 92;
    const r = 62;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-plane.roll);
    ctx.translate(0, plane.pitch * 110);
    ctx.fillStyle = '#3f8fd0';
    ctx.fillRect(-r - 4, -r * 2 - 4, (r + 4) * 2, r * 2 + 4);
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(-r - 4, 0, (r + 4) * 2, r * 2 + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    for (const deg of [-20, -10, 10, 20]) {
      const y = -Math.tan((deg * Math.PI) / 180) * 110;
      ctx.beginPath();
      ctx.moveTo(-18, y);
      ctx.lineTo(18, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(-8, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(8, 0);
    ctx.lineTo(26, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(0, -r - 2);
    ctx.lineTo(-5, -r - 10);
    ctx.lineTo(5, -r - 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#eaf6ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#9fd8ef';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 16);
    void w;
  }

  function drawGauges(w, h, plane) {
    const x = w - 186;
    const y = h - 168;
    panel(x, y, 172, 154);
    ctx.textAlign = 'left';
    bar(x + 14, y + 30, 144, 12, plane.fuel / 100, plane.fuel < 25 ? RED : GREEN, 'FUEL');
    bar(x + 14, y + 66, 144, 12, 1 - plane.damage / 100, plane.damage > 60 ? RED : GREEN, 'AIRFRAME');
    bar(x + 14, y + 102, 144, 12, plane.throttle, '#7fd0f0', 'THROTTLE');
    ctx.fillStyle = '#9fd8ef';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(plane.flaps ? 'FLAPS DOWN' : 'FLAPS UP', x + 14, y + 140);
    ctx.fillStyle = plane.airborne ? GREEN : INK;
    ctx.fillText(plane.airborne ? 'AIRBORNE' : 'ON GROUND', x + 96, y + 140);
    void h;
  }

  function bar(x, y, w, h, frac, colour, label) {
    ctx.fillStyle = '#9fd8ef';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(label, x, y - 6);
    ctx.fillStyle = '#16324a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, Math.max(0, Math.min(w, w * frac)), h);
    ctx.strokeStyle = 'rgba(234,246,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawMission(w, plane, missions) {
    const m = missions.state;
    panel(w - 246, 168, 232, 52 + m.rings.length * 24 + 44);
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MAIL RUN — RIDGELINE VALLEY', w - 234, 190);
    m.rings.forEach((ring, i) => {
      const y = 212 + i * 24;
      ctx.fillStyle = ring.passed ? GREEN : i === m.next ? AMBER : '#9fb6c6';
      ctx.font = 'bold 13px sans-serif';
      const mark = ring.passed ? '✓' : i === m.next ? '➤' : '·';
      ctx.fillText(`${mark} ${i + 1}. ${ring.name}`, w - 234, y);
    });
    ctx.fillStyle = INK;
    ctx.font = 'bold 13px sans-serif';
    const next = m.rings[m.next];
    const target = next
      ? `NEXT RING ${Math.round(missions.ringDistance(plane))} m`
      : 'LAND ON THE STRIP';
    ctx.fillText(target, w - 234, 212 + m.rings.length * 24 + 8);
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`SCORE ${m.score}`, w - 234, 212 + m.rings.length * 24 + 30);
  }

  function drawWarnings(w, h, plane, time) {
    const warnings = [];
    if (plane.airborne && plane.speed < STALL_SPEED + 2) warnings.push('STALL — NOSE DOWN, POWER UP');
    if (plane.fuel < 25 && plane.fuel > 0) warnings.push('LOW FUEL');
    if (plane.fuel <= 0) warnings.push('FUEL EMPTY — GLIDING');
    if (warnings.length === 0) return;
    if (Math.floor(time * 2) % 2 === 0) return; // blink
    ctx.fillStyle = RED;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    warnings.forEach((text, i) => {
      ctx.fillText(text, w / 2, h * 0.3 + i * 30);
    });
  }

  function drawMessage(w, h, missions) {
    const m = missions.state;
    if (m.time > m.messageUntil) return;
    ctx.fillStyle = 'rgba(10,22,36,0.72)';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    const text = m.message;
    const tw = ctx.measureText(text).width;
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2 - 16, h - 240, tw + 32, 34, 9);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(text, w / 2, h - 217);
  }

  function drawFlightMarker(w, h, plane) {
    // A small circle where the velocity vector points: the pilot's aim point.
    const cx = w / 2;
    const cy = h / 2 - plane.pitch * 130;
    ctx.strokeStyle = 'rgba(234,246,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 11, cy);
    ctx.moveTo(cx + 11, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx, cy - 11);
    ctx.stroke();
  }

  function shade(w, h, alpha) {
    ctx.fillStyle = `rgba(6,14,24,${alpha})`;
    ctx.fillRect(0, 0, w, h);
  }

  function title(w, h, best) {
    shade(w, h, 0.45);
    ctx.textAlign = 'center';
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('RIDGELINE COURIER', w / 2, h * 0.3);
    ctx.fillStyle = INK;
    ctx.font = '24px sans-serif';
    ctx.fillText('Fly the mail through five valley rings — then land her home.', w / 2, h * 0.3 + 44);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#cfe6f2';
    const lines = [
      'W / S — throttle up and down      ↑ / ↓ — pitch      ← / → — bank and turn',
      'Mouse — steer toward the pointer      F — flaps for landing      P — pause      R — restart',
      'Mind the fuel gauge: a hard bank bleeds speed, and a slow wing stalls.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.46 + i * 28));
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Click or press Enter to fly', w / 2, h * 0.62);
    if (best > 0) {
      ctx.fillStyle = INK;
      ctx.font = '17px sans-serif';
      ctx.fillText(`Best score: ${best}`, w / 2, h * 0.62 + 32);
    }
  }

  function paused(w, h) {
    shade(w, h, 0.5);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('PAUSED', w / 2, h / 2 - 10);
    ctx.font = '18px sans-serif';
    ctx.fillText('P or Enter to keep flying — R to restart the sortie', w / 2, h / 2 + 28);
  }

  function over(w, h, plane, missions, best) {
    const m = missions.state;
    shade(w, h, 0.55);
    ctx.textAlign = 'center';
    const delivered = m.phase === 'done' && m.next >= m.rings.length && plane.landed;
    ctx.fillStyle = delivered ? GREEN : RED;
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(delivered ? 'MAIL DELIVERED' : plane.crashed ? 'SORTIE LOST' : 'SORTIE OVER', w / 2, h * 0.34);
    ctx.fillStyle = INK;
    ctx.font = '20px sans-serif';
    const detail = plane.crashed
      ? `The courier went down: ${plane.crashReason}.`
      : delivered
        ? 'All five rings flown and a clean landing on the strip.'
        : 'The run ended before the mail was through.';
    ctx.fillText(detail, w / 2, h * 0.34 + 38);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Score ${m.score}    ·    Best ${Math.max(best, m.score)}`, w / 2, h * 0.34 + 84);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#cfe6f2';
    ctx.fillText(`Rings ${m.rings.filter((r) => r.passed).length} of 5  ·  ${Math.round(m.time)} s in the air  ·  Fuel ${Math.round(plane.fuel)} left`, w / 2, h * 0.34 + 118);
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press R or click to fly again', w / 2, h * 0.34 + 162);
  }

  /** Draw the HUD and, on top of it, whichever screen is showing. */
  function draw(view, screen, best) {
    const { plane, missions, time } = view;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawCompass(w, plane);
      drawTapes(w, h, plane);
      drawAttitude(w, h, plane);
      drawGauges(w, h, plane);
      drawMission(w, plane, missions);
      drawFlightMarker(w, h, plane);
      drawWarnings(w, h, plane, time);
      drawMessage(w, h, missions);
    }
    if (screen === SCREEN_TITLE) title(w, h, best);
    else if (screen === SCREEN_PAUSED) paused(w, h);
    else if (screen === SCREEN_OVER) over(w, h, plane, missions, best);
  }

  return { draw };
}
