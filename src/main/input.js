// Counts keyboard and mouse activity across the whole desktop on X11.
//
// How: `xinput test-xi2 --root` prints every raw input event the X server
// sees, no matter which window is focused. We read its output line by line:
//   - RawKeyPress            -> +1 key
//   - RawMotion / RawButton  -> +1 pointer (mouse moves, clicks, scrolling)
//
// Pointer activity is what makes "reading docs" count even when you aren't
// typing anything.
//
// Privacy: the key code is used only to skip modifiers and held-down repeats,
// then it is thrown away. Only the counts ever leave this file.

const { spawn } = require('node:child_process')

// X keycodes we don't count: Shift, Ctrl, Alt, Super, Caps Lock, Menu, AltGr.
const MODIFIERS = new Set([37, 105, 50, 62, 64, 108, 133, 134, 66, 135, 92])

// A key held down repeats every ~30-40 ms. People don't press the same key
// twice that fast, so a same-key press within this window is a repeat.
const REPEAT_MS = 60

function startInputCounter({ onInput, onStatus }) {
  let child = null
  let stopped = false
  let keys = 0
  let pointer = 0
  let inKeyPress = false
  let lastCode = -1
  let lastAt = 0

  // Send counts in small batches instead of one message per event.
  const flushTimer = setInterval(() => {
    if (keys > 0 || pointer > 0) {
      onInput({ keys, pointer })
      keys = 0
      pointer = 0
    }
  }, 100)

  function handleLine(line) {
    if (line.startsWith('EVENT type')) {
      inKeyPress = line.includes('(RawKeyPress)')
      if (line.includes('(RawMotion)') || line.includes('(RawButtonPress)')) pointer++
      return
    }
    if (!inKeyPress) return
    const match = /^\s+detail: (\d+)/.exec(line)
    if (!match) return
    inKeyPress = false

    const code = Number(match[1])
    const now = Date.now()
    const isRepeat = code === lastCode && now - lastAt < REPEAT_MS
    lastCode = code
    lastAt = now
    if (isRepeat || MODIFIERS.has(code)) return
    keys++
  }

  function launch() {
    if (stopped) return
    const startedAt = Date.now()
    // stdbuf -oL makes xinput flush every line; otherwise output arrives in
    // 4 KB chunks when piped and the companion would react seconds late.
    child = spawn('stdbuf', ['-oL', 'xinput', 'test-xi2', '--root'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    let buffer = ''
    child.stdout.on('data', (chunk) => {
      buffer += chunk
      let newline
      while ((newline = buffer.indexOf('\n')) >= 0) {
        handleLine(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
      }
    })

    // If xinput is still alive after a moment, global counting works.
    const okTimer = setTimeout(() => onStatus('global'), 1500)

    const onGone = () => {
      clearTimeout(okTimer)
      child = null
      if (stopped) return
      onStatus('window')
      // Died right away (no X11, xinput missing): retry rarely. Otherwise soon.
      const ranLong = Date.now() - startedAt > 10_000
      setTimeout(launch, ranLong ? 2_000 : 60_000)
    }
    child.on('error', onGone)
    child.on('exit', onGone)
  }

  launch()

  return function stop() {
    stopped = true
    clearInterval(flushTimer)
    if (child) child.kill()
  }
}

module.exports = { startInputCounter }
