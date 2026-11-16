// Every sound is synthesised with WebAudio oscillators and filtered noise:
// no audio files, no network, and the same code runs in any desktop browser.
// The context is created on the first user gesture (browsers require one),
// and every method is safe to call before that or when audio is unavailable.
import { AUDIO } from './config.js';

function makeNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    musicGain: null,
    noise: null,
    muted: false,
    musicStarted: false,
    pickupStreak: 0,
    pickupStreakTimer: 0,
  };

  function ensure() {
    if (audio.context) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    try {
      audio.context = new Ctor();
    } catch {
      return false;
    }
    audio.master = audio.context.createGain();
    audio.master.gain.value = AUDIO.sfxVolume;
    audio.master.connect(audio.context.destination);
    audio.musicGain = audio.context.createGain();
    audio.musicGain.gain.value = AUDIO.musicVolume;
    audio.musicGain.connect(audio.context.destination);
    audio.noise = makeNoiseBuffer(audio.context);
    return true;
  }

  function tone({ frequency, endFrequency, type = 'sine', duration, volume, delay = 0, destination = null }) {
    if (!ensure() || audio.muted) return;
    const start = audio.context.currentTime + delay;
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(destination || audio.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function puff({ duration, volume, frequency, delay = 0 }) {
    if (!ensure() || audio.muted) return;
    const start = audio.context.currentTime + delay;
    const source = audio.context.createBufferSource();
    source.buffer = audio.noise;
    const filter = audio.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = audio.context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(audio.master);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  return {
    get muted() {
      return audio.muted;
    },
    /** Call from any user gesture: unlocks the context and starts the pad. */
    unlock() {
      if (!ensure()) return;
      if (audio.context.state === 'suspended') audio.context.resume();
      this.startMusic();
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.master) audio.master.gain.value = audio.muted ? 0 : AUDIO.sfxVolume;
      if (audio.musicGain) audio.musicGain.gain.value = audio.muted ? 0 : AUDIO.musicVolume;
      return audio.muted;
    },
    /** A slow two-oscillator night pad with a breathing filter. */
    startMusic() {
      if (!ensure() || audio.musicStarted || audio.muted) return;
      audio.musicStarted = true;
      const context = audio.context;
      const notes = [110, 164.81, 220, 277.18];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = index % 2 ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index * 3 - 4;
        const gain = context.createGain();
        gain.gain.value = index === 0 ? 0.5 : 0.22;
        const lfo = context.createOscillator();
        lfo.frequency.value = 0.07 + index * 0.03;
        const lfoGain = context.createGain();
        lfoGain.gain.value = 0.12;
        lfo.connect(lfoGain).connect(gain.gain);
        oscillator.connect(gain).connect(audio.musicGain);
        oscillator.start();
        lfo.start();
      });
    },
    pulse() {
      tone({ frequency: 520, endFrequency: 140, type: 'sine', duration: 0.22, volume: 0.5 });
      puff({ duration: 0.12, volume: 0.25, frequency: 900 });
    },
    zap() {
      tone({ frequency: 1400, endFrequency: 300, type: 'sawtooth', duration: 0.08, volume: 0.12 });
    },
    pickup() {
      audio.pickupStreak = audio.pickupStreakTimer > 0 ? audio.pickupStreak + 1 : 0;
      audio.pickupStreakTimer = 0.9;
      const step = Math.min(audio.pickupStreak, 7);
      tone({ frequency: 660 * 2 ** (step / 12), type: 'sine', duration: 0.12, volume: 0.3 });
    },
    coin() {
      tone({ frequency: 880, type: 'triangle', duration: 0.09, volume: 0.25 });
      tone({ frequency: 1320, type: 'triangle', duration: 0.14, volume: 0.22, delay: 0.05 });
    },
    hurt() {
      tone({ frequency: 160, endFrequency: 55, type: 'sawtooth', duration: 0.25, volume: 0.4 });
      puff({ duration: 0.18, volume: 0.3, frequency: 400 });
    },
    wispDown() {
      tone({ frequency: 740, endFrequency: 1180, type: 'sine', duration: 0.12, volume: 0.2 });
      tone({ frequency: 1180, endFrequency: 1560, type: 'sine', duration: 0.1, volume: 0.14, delay: 0.05 });
    },
    plant() {
      tone({ frequency: 330, type: 'triangle', duration: 0.2, volume: 0.3 });
      tone({ frequency: 495, type: 'triangle', duration: 0.26, volume: 0.26, delay: 0.07 });
      tone({ frequency: 660, type: 'sine', duration: 0.3, volume: 0.22, delay: 0.14 });
    },
    levelUp() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) =>
        tone({ frequency, type: 'triangle', duration: 0.3, volume: 0.28, delay: index * 0.07 }),
      );
    },
    nightClear() {
      [392, 523.25, 659.25].forEach((frequency, index) =>
        tone({ frequency, type: 'sine', duration: 0.35, volume: 0.25, delay: index * 0.1 }),
      );
    },
    bossRoar() {
      tone({ frequency: 98, endFrequency: 62, type: 'sawtooth', duration: 0.9, volume: 0.4 });
      tone({ frequency: 147, endFrequency: 90, type: 'sawtooth', duration: 0.9, volume: 0.25, delay: 0.1 });
    },
    victory() {
      [523.25, 587.33, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, index) =>
        tone({ frequency, type: 'triangle', duration: 0.4, volume: 0.3, delay: index * 0.11 }),
      );
    },
    defeat() {
      [392, 369.99, 329.63, 261.63].forEach((frequency, index) =>
        tone({ frequency, type: 'triangle', duration: 0.45, volume: 0.3, delay: index * 0.16 }),
      );
    },
    click() {
      tone({ frequency: 700, type: 'sine', duration: 0.06, volume: 0.2 });
    },
    /** Age the pickup pitch ladder. Called once per step. */
    step(dt) {
      if (audio.pickupStreakTimer > 0) audio.pickupStreakTimer -= dt;
    },
  };
}
