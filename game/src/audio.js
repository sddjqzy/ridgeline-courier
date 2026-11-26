// Sound with no assets: the engine, the wind and the chimes are all
// synthesised in WebAudio when the player first touches a control.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineSub = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;

  /** Start the audio graph; safe to call on every gesture. */
  function unlock() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      return;
    }
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineSub = context.createOscillator();
    engineSub.type = 'sine';
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOsc.start();
    engineSub.start();

    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = context.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(context.destination);
    noise.start();
  }

  /** Called every frame while flying: engine note follows the throttle. */
  function setFlight(throttle, speed, airborne) {
    if (!context) return;
    const t = context.currentTime;
    const freq = 52 + throttle * 46 + speed * 0.35;
    engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    engineSub.frequency.setTargetAtTime(freq / 2, t, 0.08);
    engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.05 : throttle * 0.045, t, 0.1);
    windGain.gain.setTargetAtTime(airborne ? Math.min(0.12, speed * 0.0016) : 0, t, 0.15);
  }

  function tone(freq, when, duration, type, volume) {
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  function chime() {
    if (!context) return;
    const t = context.currentTime;
    tone(880, t, 0.35, 'sine', 0.16);
    tone(1318, t + 0.09, 0.5, 'sine', 0.14);
  }

  function beep() {
    if (!context) return;
    tone(660, context.currentTime, 0.16, 'square', 0.07);
  }

  function thud() {
    if (!context) return;
    tone(70, context.currentTime, 0.3, 'sine', 0.22);
  }

  return { unlock, setFlight, chime, beep, thud };
}
