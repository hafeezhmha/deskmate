// Tiny chiptune sound effects made with the Web Audio API. No audio files.

let audio = null
let enabled = true

export function setSound(on) {
  enabled = on
}

function tone(freq, duration, { type = 'square', volume = 0.04, delay = 0, slide = 0 } = {}) {
  if (!enabled) return
  audio ??= new AudioContext()
  const start = audio.currentTime + delay
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(audio.destination)
  osc.start(start)
  osc.stop(start + duration)
}

export const sfx = {
  tap: () => tone(180, 0.05, { type: 'triangle', volume: 0.06 }),
  drum: () => {
    tone(140, 0.06, { type: 'triangle', volume: 0.07 })
    tone(160, 0.06, { type: 'triangle', volume: 0.07, delay: 0.12 })
  },
  hey: () => {
    tone(660, 0.09, { volume: 0.035 })
    tone(880, 0.12, { volume: 0.035, delay: 0.1 })
  },
  pop: () => tone(520, 0.06, { volume: 0.03, slide: 200 }),
  coin: () => {
    tone(988, 0.07, { volume: 0.03 })
    tone(1319, 0.12, { volume: 0.03, delay: 0.07 })
  },
  ship: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { volume: 0.035, delay: i * 0.1 })),
  buy: () => [784, 988].forEach((f, i) => tone(f, 0.08, { volume: 0.03, delay: i * 0.07 })),
}
