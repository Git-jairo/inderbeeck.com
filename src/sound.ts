// Tiny synthesized UI sounds (no audio files). The AudioContext is created
// lazily because browsers only allow audio after a user gesture.
let ctx: AudioContext | null = null

const NOTES = [220, 261.63, 329.63, 392, 440, 523.25] // A minor pentatonic-ish

function getCtx() {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function playNote(index: number, volume = 0.05) {
  const ac = getCtx()
  if (!ac) return
  // Still suspended (no user gesture yet): resume() was requested above, so
  // retry once it lands; hover sounds before any click simply stay silent.
  if (ac.state === 'suspended') {
    void ac.resume().then(
      () => playNote(index, volume),
      () => {},
    )
    return
  }
  if (ac.state !== 'running') return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const filter = ac.createBiquadFilter()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = NOTES[index % NOTES.length]
  filter.type = 'lowpass'
  filter.frequency.value = 1400
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
  osc.connect(filter).connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.4)
}

// One soft tone for the contact links: just above the top of the nav notes
// (C5), with a gentle attack and a short fade so it stays subtle.
export function playChime(volume = 0.03) {
  const ac = getCtx()
  if (!ac) return
  if (ac.state === 'suspended') {
    void ac.resume().then(
      () => playChime(volume),
      () => {},
    )
    return
  }
  if (ac.state !== 'running') return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = 659.25 // E5
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.45)
}

// ---------- Startup swell ----------
// A warm, slow major chord (F# major) that swells over about 3 seconds, one note
// after the other from low to high, and then fades into a long reverb tail, in the
// spirit of an old computer waking up. Synthesized.
let startupPlayed = false

function reverbImpulse(ac: AudioContext) {
  const length = Math.floor(ac.sampleRate * 4)
  const buf = ac.createBuffer(2, length, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6)
  }
  return buf
}

function playChord(ac: AudioContext, volume: number) {
  const t = ac.currentTime + 0.05
  const master = ac.createGain()
  master.gain.value = volume
  master.connect(ac.destination)

  // the sound opens up (filter sweep) and then settles
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(380, t)
  lp.frequency.linearRampToValueAtTime(3200, t + 3.2)
  lp.frequency.exponentialRampToValueAtTime(800, t + 8.5)

  const dry = ac.createGain()
  dry.gain.value = 0.65
  const wet = ac.createGain()
  wet.gain.value = 0.6
  const reverb = ac.createConvolver()
  reverb.buffer = reverbImpulse(ac)
  lp.connect(dry).connect(master)
  lp.connect(reverb).connect(wet).connect(master)

  const notes: [number, OscillatorType, number][] = [
    [92.5, 'triangle', 1], // F#2
    [185, 'sine', 0.8], // F#3
    [233.08, 'sine', 0.6], // A#3
    [277.18, 'sine', 0.55], // C#4
    [369.99, 'sine', 0.5], // F#4
    [466.16, 'sine', 0.35], // A#4
    [554.37, 'sine', 0.25], // C#5
  ]
  notes.forEach(([freq, type, level], i) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = (i % 2 ? 1 : -1) * (3 + i) // slight detune = warmth
    // notes enter one after the other (low first) and each takes ~2.7s to bloom
    const on = t + i * 0.2
    gain.gain.setValueAtTime(0, on)
    gain.gain.linearRampToValueAtTime(level, on + 2.7)
    gain.gain.exponentialRampToValueAtTime(0.0001, on + 8)
    osc.connect(gain).connect(lp)
    osc.start(on)
    osc.stop(on + 8.2)
  })
}

/**
 * Plays the startup swell once. Browsers block audio until the visitor has
 * interacted, so if it can't start right away it plays on the first click or key.
 */
export function playStartup(volume = 0.05) {
  if (startupPlayed) return
  const ac = getCtx()
  if (!ac) return
  const unlock = () => {
    window.removeEventListener('pointerdown', attempt)
    window.removeEventListener('keydown', attempt)
  }
  const tryPlay = () => {
    if (startupPlayed || ac.state !== 'running') return
    startupPlayed = true
    unlock()
    playChord(ac, volume)
  }
  function attempt() {
    void ac!.resume().then(tryPlay, () => {})
  }
  void ac.resume().then(tryPlay, () => {})
  window.addEventListener('pointerdown', attempt)
  window.addEventListener('keydown', attempt)
}
