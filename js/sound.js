// =====================================================================
//  أصوات قصيرة مولَّدة بـ Web Audio (بدون ملفات صوتية)
//  لا يبدأ أي صوت إلا بعد لمسة من المستخدم — متوافق مع Safari
// =====================================================================

let ctx = null;
let enabled = localStorage.getItem('mj-sound') !== 'off';

export function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* الأصوات اختيارية */ }
}

export function isOn() { return enabled; }

export function toggle() {
  enabled = !enabled;
  localStorage.setItem('mj-sound', enabled ? 'on' : 'off');
  if (enabled) unlock();
  return enabled;
}

function tone(freq, at, dur, type = 'sine', vol = 0.14) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => tone(700, 0, 0.06, 'triangle', 0.06),
  correct: () => { tone(660, 0, 0.12); tone(990, 0.09, 0.2); },
  wrong: () => { tone(260, 0, 0.16, 'triangle', 0.1); tone(200, 0.12, 0.2, 'triangle', 0.08); },
  tick: () => tone(520, 0, 0.09, 'square', 0.05),
  go: () => { tone(523, 0, 0.12); tone(784, 0.1, 0.25); },
  stage: () => { tone(523, 0, 0.1); tone(659, 0.08, 0.1); tone(784, 0.16, 0.18); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.25)); },
  end: () => { tone(784, 0, 0.18); tone(523, 0.16, 0.3); }
};
