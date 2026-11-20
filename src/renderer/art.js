// All of Zaif's pixel art, drawn from rectangles at 1 pixel = 1 room pixel.
// The canvas is ROOM_W x ROOM_H and CSS scales it up with crisp pixels.
//
// Nothing here knows about game rules: game.js decides *what* to draw
// (pose, which furniture is owned, time of day) and these functions draw it.

export const ROOM_W = 208
export const ROOM_H = 112
export const FLOOR_Y = 76 // where the wall meets the floor
export const WALK_Y = 107 // Zaif's feet when standing in the room
export const CHAIR = { x: 155, seatY: 100, standX: 150 } // desk chair
export const COUCH = { x: 68, seatY: 94 }

const INK = '#2b2233'
const SKIN = '#f2c79a'
const BLUSH = '#ec9a8a'
const HAIR = '#4a3426'
const PANTS = '#3a3550'
const SHOE = '#3b2f2f'
const SHADOW = 'rgba(30, 20, 40, 0.18)'

// ---------------------------------------------------------------- helpers

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

// A filled box with a 1px ink outline: the basic building block of the style.
function box(ctx, x, y, w, h, fill, outline = INK) {
  rect(ctx, x, y, w, h, outline)
  rect(ctx, x + 1, y + 1, w - 2, h - 2, fill)
}

function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + r * 0.8) ctx.fillRect(cx + dx, cy + dy, 1, 1)
    }
  }
}

// Draw a tiny bitmap given as strings ('#' = pixel).
function glyph(ctx, rows, x, y, color) {
  ctx.fillStyle = color
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] === '#') ctx.fillRect(x + dx, y + dy, 1, 1)
  })
}

// Small deterministic "random" so the same code line always looks the same.
function hash(n) {
  n = (n ^ 61) ^ (n >>> 16)
  n = (n + (n << 3)) | 0
  n = n ^ (n >>> 4)
  n = Math.imul(n, 0x27d4eb2d)
  return (n ^ (n >>> 15)) >>> 0
}

// ---------------------------------------------------------------- the room

function sky(hour) {
  if (hour >= 21 || hour < 5) return { top: '#1b2142', bottom: '#2f3a6b', night: true }
  if (hour < 8) return { top: '#8fb3e0', bottom: '#f6c39a' }
  if (hour < 17) return { top: '#79c2ec', bottom: '#c4e8f6' }
  return { top: '#5a5a9c', bottom: '#f0956a' }
}

export function isNight(hour) {
  return hour >= 20 || hour < 6
}

function drawWindow(ctx, view) {
  const s = sky(view.hour)
  rect(ctx, 42, 8, 52, 1, '#8a5a3c') // curtain rod
  box(ctx, 49, 11, 38, 34, '#f6efe2')
  rect(ctx, 51, 13, 34, 15, s.top)
  rect(ctx, 51, 28, 34, 14, s.bottom)
  if (s.night) {
    for (let i = 0; i < 9; i++) {
      const h = hash(i + 7)
      const twinkle = (Math.floor(view.t * 1.5) + i) % 5 !== 0
      if (twinkle) rect(ctx, 52 + (h % 32), 14 + ((h >> 8) % 26), 1, 1, '#fff6cf')
    }
    disc(ctx, 77, 19, 3, '#f6efe2') // moon
    disc(ctx, 79, 18, 2, s.top)
  } else {
    // Two clouds drifting slowly across the glass.
    for (let i = 0; i < 2; i++) {
      const cx = 51 + ((view.t * (1.2 + i * 0.7) + i * 19) % 40) - 4
      const cy = 17 + i * 9
      rect(ctx, Math.round(cx), cy, 7, 2, '#ffffff')
      rect(ctx, Math.round(cx) + 2, cy - 1, 3, 1, '#ffffff')
    }
  }
  rect(ctx, 67, 13, 2, 29, '#f6efe2') // window cross
  rect(ctx, 51, 27, 34, 2, '#f6efe2')
  box(ctx, 46, 44, 44, 3, '#d9c3a0') // sill
  // Curtains with a darker fold line.
  for (const x of [43, 87]) {
    rect(ctx, x, 9, 6, 38, view.walls.curtain)
    rect(ctx, x + 2, 9, 1, 38, 'rgba(0,0,0,0.12)')
    rect(ctx, x + 5, 9, 1, 38, 'rgba(0,0,0,0.12)')
  }
}

function drawClock(ctx, view) {
  const cx = 188
  const cy = 26
  disc(ctx, cx, cy, 7, INK)
  disc(ctx, cx, cy, 6, '#f6efe2')
  const hand = (fraction, length, color) => {
    const angle = fraction * Math.PI * 2 - Math.PI / 2
    for (let i = 1; i <= length; i++) {
      rect(ctx, cx + Math.round(Math.cos(angle) * i), cy + Math.round(Math.sin(angle) * i), 1, 1, color)
    }
  }
  hand((view.hour % 12) / 12, 3, INK)
  hand(view.minute / 60, 5, '#b8533a')
  rect(ctx, cx, cy, 1, 1, INK)
}

// One trophy per perfect week, on a little wall shelf. Fits six.
function drawTrophyShelf(ctx, count) {
  box(ctx, 103, 46, 36, 3, '#a0683f')
  rect(ctx, 106, 49, 2, 3, '#7a4d2e')
  rect(ctx, 134, 49, 2, 3, '#7a4d2e')
  for (let i = 0; i < Math.min(count, 6); i++) {
    const x = 106 + i * 5
    rect(ctx, x - 1, 38, 6, 1, INK)
    rect(ctx, x, 39, 4, 2, '#f2b134')
    rect(ctx, x - 1, 39, 1, 2, INK)
    rect(ctx, x + 4, 39, 1, 2, INK)
    rect(ctx, x + 1, 41, 2, 2, '#d99a22')
    rect(ctx, x, 43, 4, 1, '#d99a22')
    rect(ctx, x, 44, 4, 2, INK)
    rect(ctx, x + 1, 39, 1, 1, '#fff2c4') // shine
  }
}

function drawPoster(ctx) {
  box(ctx, 28, 15, 14, 20, '#f6efe2')
  rect(ctx, 30, 17, 10, 14, '#5b7bd5')
  // A little rocket: ambition!
  rect(ctx, 34, 19, 2, 1, '#f6efe2')
  rect(ctx, 33, 20, 4, 5, '#f6efe2')
  rect(ctx, 34, 21, 2, 1, '#79c2ec')
  rect(ctx, 32, 24, 1, 2, '#e0734f')
  rect(ctx, 37, 24, 1, 2, '#e0734f')
  rect(ctx, 34, 25, 2, 2, '#f2b134')
  rect(ctx, 31, 32, 8, 1, INK)
  rect(ctx, 32, 33, 6, 1, INK)
}

function drawFairyLights(ctx, view, glow) {
  const colors = ['#ffd27f', '#ff8fa3', '#8be28b', '#7fd1ff']
  for (let x = 4; x < ROOM_W - 4; x++) {
    const sag = Math.round(Math.sin(((x - 4) / 40) * Math.PI) ** 2 * 3)
    if (!glow) rect(ctx, x, 4 + sag, 1, 1, '#5a4a3a')
    if ((x - 4) % 9 === 0) {
      const color = colors[((x - 4) / 9) % colors.length]
      const on = glow ? (Math.floor(view.t * 2) + x) % 7 !== 0 : true
      if (on) {
        if (glow) rect(ctx, x - 1, 5 + sag, 3, 3, color + '55')
        rect(ctx, x, 5 + sag, 1, 2, color)
      }
    }
  }
}

function drawRug(ctx) {
  const rows = [
    [70, 130],
    [62, 138],
    [60, 140],
    [60, 140],
    [62, 138],
    [70, 130],
  ]
  rows.forEach(([a, b], i) => rect(ctx, a, 103 + i, b - a, 1, '#c96b5b'))
  rect(ctx, 66, 105, 68, 1, '#e9c46a')
  rect(ctx, 66, 106, 68, 1, '#e9c46a')
}

function drawFridge(ctx, open) {
  box(ctx, 6, 54, 19, 47, '#e9eef2')
  rect(ctx, 7, 55, 2, 45, '#d3dbe3')
  rect(ctx, 7, 68, 17, 1, INK)
  rect(ctx, 21, 58, 1, 6, '#9aa7b3')
  rect(ctx, 12, 59, 2, 2, '#e0734f') // magnets
  rect(ctx, 15, 61, 2, 2, '#5b7bd5')
  if (!open) {
    rect(ctx, 21, 72, 1, 10, '#9aa7b3')
    return
  }
  box(ctx, 6, 68, 19, 33, '#fff3cf')
  rect(ctx, 7, 79, 17, 1, '#d8cfa8')
  rect(ctx, 7, 89, 17, 1, '#d8cfa8')
  for (const x of [9, 12, 15]) rect(ctx, x, 75, 2, 4, '#d94b4b')
  rect(ctx, 18, 73, 2, 6, '#8be28b')
  rect(ctx, 9, 85, 5, 4, '#f2b134')
  box(ctx, 24, 68, 6, 33, '#dfe6ec') // the door, swung open
}

function drawCoffee(ctx, brewing) {
  box(ctx, 26, 84, 18, 17, '#8f5c37')
  rect(ctx, 28, 87, 6, 1, '#6e4630')
  rect(ctx, 36, 87, 6, 1, '#6e4630')
  box(ctx, 25, 82, 20, 3, '#b98a5e')
  box(ctx, 29, 70, 11, 13, '#3b3346')
  rect(ctx, 31, 72, 7, 3, '#7a6f8a')
  rect(ctx, 33, 76, 3, 1, INK)
  rect(ctx, 33, 79, 3, 2, '#f2efe6')
  rect(ctx, 38, 71, 1, 1, brewing ? '#8be28b' : '#d94b4b')
}

function drawCouch(ctx) {
  const main = '#c96b5b'
  const dark = '#a8534a'
  box(ctx, 47, 80, 42, 14, dark)
  rect(ctx, 48, 81, 40, 1, main)
  box(ctx, 48, 91, 20, 6, main)
  box(ctx, 68, 91, 20, 6, main)
  box(ctx, 46, 96, 44, 7, dark)
  box(ctx, 43, 86, 7, 17, main)
  box(ctx, 86, 86, 7, 17, main)
  rect(ctx, 48, 103, 2, 1, INK)
  rect(ctx, 86, 103, 2, 1, INK)
}

function drawPlant(ctx) {
  const leaves = [
    [99, 82, 5],
    [95, 87, 3],
    [104, 86, 3],
    [100, 76, 3],
  ]
  for (const [x, y, r] of leaves) disc(ctx, x, y, r + 1, INK)
  for (const [x, y, r] of leaves) disc(ctx, x, y, r, '#4f9a5a')
  rect(ctx, 98, 80, 1, 6, '#3d7d49')
  rect(ctx, 96, 86, 2, 1, '#3d7d49')
  rect(ctx, 102, 85, 2, 1, '#3d7d49')
  box(ctx, 94, 91, 11, 3, '#b5683c')
  box(ctx, 95, 93, 9, 9, '#c97a4a')
}

function drawBookshelf(ctx) {
  box(ctx, 106, 62, 22, 39, '#8a5a3c')
  const colors = ['#c25b4a', '#5b7bd5', '#e9c46a', '#3f8f5a', '#9b7fe6', '#f2efe6']
  for (const shelfY of [74, 86, 99]) {
    rect(ctx, 107, shelfY, 20, 2, '#6e4630')
    let x = 108
    let i = shelfY
    while (x < 125) {
      const w = 2 + (hash(i) % 2)
      const h = 8 + (hash(i + 3) % 3)
      rect(ctx, x, shelfY - h, w, h, colors[hash(i + 9) % colors.length])
      x += w + (hash(i + 5) % 3 === 0 ? 1 : 0)
      i++
    }
  }
}

function drawArcade(ctx) {
  box(ctx, 128, 66, 15, 36, '#5b4b8a')
  box(ctx, 127, 63, 17, 6, '#e0734f')
  rect(ctx, 130, 65, 13, 1, '#f2b134')
  box(ctx, 130, 71, 11, 10, '#1a1630')
  rect(ctx, 129, 84, 13, 3, '#463a70')
  rect(ctx, 132, 82, 1, 2, INK)
  rect(ctx, 131, 81, 3, 1, '#d94b4b')
  rect(ctx, 137, 84, 1, 1, '#f2b134')
  rect(ctx, 139, 84, 1, 1, '#8be28b')
  rect(ctx, 130, 90, 11, 1, '#7a6aa8')
}

// Things that give off light are drawn again after the night tint.
function drawArcadeScreen(ctx, view) {
  const playing = view.arcadeOn
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 9; x++) {
      const on = playing ? hash(x * 31 + y * 7 + Math.floor(view.t * 4)) % 5 === 0 : (x + y + Math.floor(view.t)) % 9 === 0
      if (on) rect(ctx, 131 + x, 72 + y, 1, 1, playing ? '#8be28b' : '#5b7bd5')
    }
  }
}

function drawChair(ctx) {
  box(ctx, 146, 84, 4, 16, '#4a4458')
  box(ctx, 146, 99, 12, 3, '#5c556b')
  rect(ctx, 151, 102, 2, 3, INK)
  rect(ctx, 147, 105, 10, 1, INK)
}

function drawDesk(ctx, view) {
  box(ctx, 160, 93, 46, 3, '#a0683f')
  rect(ctx, 162, 96, 2, 9, '#7a4d2e')
  rect(ctx, 202, 96, 2, 9, '#7a4d2e')
  box(ctx, 186, 95, 15, 7, '#8f5c37')
  rect(ctx, 192, 98, 3, 1, INK)
  // Monitor
  box(ctx, 174, 74, 26, 17, '#3b3346')
  rect(ctx, 185, 91, 4, 2, '#3b3346')
  rect(ctx, 182, 92, 10, 1, INK)
  // Keyboard
  rect(ctx, 161, 91, 12, 2, INK)
  rect(ctx, 162, 91, 10, 1, '#e9e2d6')
  // Mug
  box(ctx, 202, 88, 4, 5, '#f2efe6')
  // Unread letters, lying in front of the monitor.
  if (view.unreadMail > 1) drawEnvelope(ctx, 174, 88)
  if (view.unreadMail > 0) drawEnvelope(ctx, 176, 89)
  if (view.owned.has('duck')) {
    rect(ctx, 194, 89, 6, 4, INK)
    rect(ctx, 195, 89, 4, 3, '#f2d14b')
    rect(ctx, 197, 86, 4, 4, INK)
    rect(ctx, 198, 87, 2, 2, '#f2d14b')
    rect(ctx, 201, 88, 1, 1, '#f08a2c')
    rect(ctx, 199, 87, 1, 1, INK)
  }
}

function drawEnvelope(ctx, x, y) {
  box(ctx, x, y, 8, 5, '#fffaf0')
  rect(ctx, x + 1, y + 1, 1, 1, INK)
  rect(ctx, x + 2, y + 2, 1, 1, INK)
  rect(ctx, x + 3, y + 2, 2, 1, '#d94b4b') // wax seal
  rect(ctx, x + 5, y + 2, 1, 1, INK)
  rect(ctx, x + 6, y + 1, 1, 1, INK)
}

function drawScreen(ctx, view) {
  const x0 = 176
  const y0 = 76
  const w = 22
  const h = 13
  if (view.monitor === 'off') {
    rect(ctx, x0, y0, w, h, '#141220')
    if (Math.floor(view.t * 1.2) % 2) rect(ctx, x0 + w - 2, y0 + h - 2, 1, 1, '#8be28b')
    return
  }
  if (view.monitor === 'docs') {
    // A white docs page with a heading, scrolling as you scroll.
    rect(ctx, x0, y0, w, h, '#f6f3ea')
    const top = view.docLine
    for (let row = 0; row < 6; row++) {
      const line = top + row
      const heading = hash(line + 3) % 7 === 0
      const width = heading ? 8 : 12 + (hash(line) % 8)
      rect(ctx, x0 + 2, y0 + 1 + row * 2, Math.min(width, w - 4), 1, heading ? '#2b2233' : '#a59d8f')
    }
    return
  }
  if (view.monitor === 'chat') {
    // A chat with an AI: your messages on the right, its replies on the left.
    rect(ctx, x0, y0, w, h, '#1e1b2e')
    const top = view.codeLine
    for (let row = 0; row < 6; row++) {
      const line = top + row
      const mine = hash(line + 11) % 3 === 0
      const width = mine ? 5 + (hash(line) % 6) : 8 + (hash(line) % 10)
      const x = mine ? x0 + w - 2 - width : x0 + 2
      rect(ctx, x, y0 + 1 + row * 2, width, 1, mine ? '#7fd1ff' : '#c59bff')
    }
    return
  }
  rect(ctx, x0, y0, w, h, '#1e1b2e')
  const colors = ['#7fd1ff', '#ffd27f', '#c59bff', '#8be28b', '#ff8fa3']
  // Code scrolls up as keys come in; the last row is the line being typed.
  const top = view.codeLine
  for (let row = 0; row < 6; row++) {
    const line = top + row
    const indent = (hash(line) % 4) * 2
    let width = 4 + (hash(line + 99) % 12)
    if (row === 5) width = Math.min(width, view.typedInLine)
    rect(ctx, x0 + 1 + indent, y0 + 1 + row * 2, Math.max(0, Math.min(width, w - 2 - indent)), 1, colors[hash(line + 5) % colors.length])
  }
  if (view.monitor === 'code' && Math.floor(view.t * 2) % 2 === 0) {
    rect(ctx, x0 + 2 + Math.min(view.typedInLine, 16), y0 + 11, 1, 1, '#ffffff')
  }
}

export function drawRoom(ctx, view) {
  const walls = view.walls
  rect(ctx, 0, 0, ROOM_W, FLOOR_Y, walls.wall)
  for (let x = 2; x < ROOM_W; x += 10) rect(ctx, x, 0, 4, FLOOR_Y, walls.stripe)
  rect(ctx, 0, 0, ROOM_W, 2, 'rgba(0,0,0,0.08)')
  rect(ctx, 0, FLOOR_Y - 3, ROOM_W, 3, '#8a5a3c')
  rect(ctx, 0, FLOOR_Y - 3, ROOM_W, 1, '#a9744f')

  rect(ctx, 0, FLOOR_Y, ROOM_W, ROOM_H - FLOOR_Y, walls.floor)
  for (let y = FLOOR_Y + 5, row = 0; y < ROOM_H; y += 6, row++) {
    rect(ctx, 0, y, ROOM_W, 1, walls.floorDark)
    for (let x = (row % 2) * 13; x < ROOM_W; x += 26) rect(ctx, x, y - 5, 1, 5, walls.floorDark)
  }

  drawWindow(ctx, view)
  drawClock(ctx, view)
  if (view.trophies) drawTrophyShelf(ctx, view.trophies)
  if (view.owned.has('poster')) drawPoster(ctx)
  if (view.owned.has('lights')) drawFairyLights(ctx, view, false)
  if (view.owned.has('rug')) drawRug(ctx)

  drawFridge(ctx, view.fridgeOpen)
  if (view.owned.has('coffee')) drawCoffee(ctx, view.coffeeOn)
  drawCouch(ctx)
  drawPlant(ctx)
  if (view.owned.has('books')) drawBookshelf(ctx)
  if (view.owned.has('arcade')) drawArcade(ctx)
  drawChair(ctx)
  drawDesk(ctx, view)
}

// Night tint first, then light sources on top so they glow.
export function drawLighting(ctx, view) {
  if (isNight(view.hour)) {
    rect(ctx, 0, 0, ROOM_W, ROOM_H, 'rgba(18, 20, 52, 0.30)')
    if (view.owned.has('lights')) {
      rect(ctx, 0, 0, ROOM_W, 30, 'rgba(255, 200, 120, 0.06)')
      drawFairyLights(ctx, view, true)
    }
    if (view.monitor !== 'off') rect(ctx, 166, 70, 40, 30, 'rgba(127, 209, 255, 0.07)')
  }
  drawScreen(ctx, view)
  if (view.owned.has('arcade')) drawArcadeScreen(ctx, view)
}

// ---------------------------------------------------------------- Zaif
//
// Zaif is ~10 x 19 pixels. Positions are relative to an anchor point:
// standing poses anchor at the feet, sitting poses at the seat.
// `facing` is 1 (right), -1 (left, mirrored), 0 (front) or 'back'.

export function drawZaif(ctx, g) {
  const c = g.colors
  const mirror = g.facing === -1 ? -1 : 1
  const ox = Math.round(g.x)
  const oy = Math.round(g.y)
  const R = (dx, dy, w, h, color) => {
    ctx.fillStyle = color
    ctx.fillRect(mirror > 0 ? ox + dx : ox - dx - w, oy + dy, w, h)
  }
  const view = g.facing === 'back' ? 'back' : g.facing === 0 ? 'front' : 'side'
  const f = g.frame

  // Head. `b` is the chin row; the head grows upward from there.
  function head(hx, b, { eyes = 'open', faceView = view, mouth = false } = {}) {
    R(hx - 4, b - 9, 8, 1, INK)
    R(hx - 5, b - 8, 10, 8, INK)
    R(hx - 4, b, 8, 1, INK)
    R(hx - 4, b - 8, 8, 2, c.hat)
    R(hx - 4, b - 6, 8, 1, c.hatDark)
    R(hx - 2, b - 10, 3, 1, INK) // pom
    R(hx - 1, b - 10, 1, 1, c.hatDark)
    R(hx - 4, b - 5, 8, 5, SKIN)
    if (faceView === 'back') {
      R(hx - 4, b - 5, 8, 5, HAIR)
      R(hx - 1, b - 7, 2, 1, c.hatDark)
      return
    }
    let eyeA = hx - 2
    let eyeB = hx + 1
    if (faceView === 'side') {
      R(hx - 4, b - 5, 2, 3, HAIR)
      eyeA = hx
      eyeB = hx + 2
    } else {
      R(hx - 4, b - 5, 1, 2, HAIR)
      R(hx + 3, b - 5, 1, 2, HAIR)
    }
    if (eyes === 'open') {
      R(eyeA, b - 4, 1, 2, INK)
      R(eyeB, b - 4, 1, 2, INK)
    } else if (eyes === 'down') {
      R(eyeA, b - 3, 1, 2, INK)
      R(eyeB, b - 3, 1, 2, INK)
    } else {
      R(eyeA, b - 3, 1, 1, INK)
      R(eyeB, b - 3, 1, 1, INK)
    }
    R(eyeA - 1, b - 2, 1, 1, BLUSH)
    R(eyeB + 1, b - 2, 1, 1, BLUSH)
    if (mouth) R(Math.round((eyeA + eyeB) / 2), b - 1, 1, 1, '#9a4a4a')
  }

  // Torso: 5 rows starting at `t`. Arms are drawn separately per pose.
  function torso(t, { strings = view !== 'back' } = {}) {
    R(-4, t, 8, 5, INK)
    R(-3, t, 6, 5, c.top)
    R(-3, t + 3, 6, 1, c.topDark)
    if (strings) {
      R(-2, t, 1, 2, '#f2efe6')
      R(1, t, 1, 2, '#f2efe6')
    }
  }
  const armsDown = (t) => {
    R(-4, t, 1, 4, c.topDark)
    R(3, t, 1, 4, c.topDark)
    R(-4, t + 4, 1, 1, SKIN)
    R(3, t + 4, 1, 1, SKIN)
  }

  const blinking = g.blink
  const eyesOpen = blinking ? 'closed' : 'open'

  switch (g.pose) {
    // ------------------------------------------------ standing poses
    case 'stand':
    case 'walk':
    case 'drink':
    case 'water':
    case 'read':
    case 'stretch':
    case 'play':
    case 'talk': {
      const walking = g.pose === 'walk'
      const bob = walking && f % 2 === 1 ? -1 : 0
      R(-4, 0, 8, 1, SHADOW)
      // Legs: lift one at a time while walking.
      const liftL = walking && f % 4 === 1 ? 1 : 0
      const liftR = walking && f % 4 === 3 ? 1 : 0
      R(-3, -4, 2, 3 - liftL, PANTS)
      R(1, -4, 2, 3 - liftR, PANTS)
      const shoeShift = view === 'side' ? 1 : 0
      R(-4 + shoeShift, -1 - liftL, 3, 1, SHOE)
      R(1 + shoeShift, -1 - liftR, 3, 1, SHOE)

      const t = -9 + bob
      torso(t)
      const b = -10 + bob
      if (g.pose === 'stretch') {
        R(-6, t - 6, 2, 1, c.topDark)
        R(4, t - 6, 2, 1, c.topDark)
        R(-6, t - 10, 1, 4, c.topDark)
        R(5, t - 10, 1, 4, c.topDark)
        R(-6, t - 11, 1, 1, SKIN)
        R(5, t - 11, 1, 1, SKIN)
        head(0, b, { eyes: 'closed', mouth: true })
      } else if (g.pose === 'drink') {
        R(-4, t, 1, 4, c.topDark)
        R(-4, t + 4, 1, 1, SKIN)
        R(3, t - 1, 1, 3, c.topDark)
        const sip = f % 6 < 3
        head(0, b, { eyes: sip ? 'closed' : 'open' })
        // A cola can, or a mug if g.cup is set.
        R(2, b - 3 + (sip ? 0 : 2), 2, 3, g.cup || '#d94b4b')
        R(2, b - 3 + (sip ? 0 : 2), 1, 1, g.cup ? '#ffffff' : '#ffb3a7')
      } else if (g.pose === 'water') {
        R(-4, t, 1, 4, c.topDark)
        R(-4, t + 4, 1, 1, SKIN)
        R(3, t + 1, 2, 1, c.topDark)
        R(4, t + 2, 4, 3, '#6fa37a')
        R(8, t + 1, 2, 1, '#6fa37a')
        head(0, b, { eyes: 'down' })
      } else if (g.pose === 'read') {
        R(-4, t, 1, 3, c.topDark)
        R(3, t, 1, 3, c.topDark)
        R(-3, t + 1, 6, 4, '#c25b4a')
        R(-2, t + 1, 4, 3, '#f6efe2')
        R(0, t + 1, 1, 3, '#d8cfa8')
        R(-4, t + 3, 1, 1, SKIN)
        R(3, t + 3, 1, 1, SKIN)
        head(0, b, { eyes: blinking ? 'closed' : 'down' })
      } else if (g.pose === 'play') {
        // From behind, elbows jiggle while mashing buttons.
        const j = f % 2
        R(-4 - j, t + 1, 1, 3, c.topDark)
        R(3 + (1 - j), t + 1, 1, 3, c.topDark)
        head(0, b + (f % 4 === 0 ? -1 : 0))
      } else {
        armsDown(t)
        const talking = g.pose === 'talk' && f % 2 === 0
        head(0, b, { eyes: eyesOpen, mouth: talking })
      }
      break
    }

    // ------------------------------------------------ at the desk (anchor: seat)
    case 'sit-type':
    case 'sit-idle':
    case 'sit-phone':
    case 'sit-sleep':
    case 'sit-wait':
    case 'sit-tap':
    case 'sit-drum':
    case 'sit-nag':
    case 'sit-cheer': {
      const cheer = g.pose === 'sit-cheer'
      const hop = cheer && f % 2 === 0 ? -2 : 0
      const tapping = g.pose === 'sit-tap' && f % 2 === 0
      // Legs: thighs forward along the seat, shins down to the floor.
      R(-3, -2 + hop, 7, 2, PANTS)
      R(3, 0 + hop, 2, 3 - (tapping ? 1 : 0), PANTS)
      R(3, 3 + hop - (tapping ? 1 : 0), 3, 1, SHOE)

      const t = -7 + hop
      const b = -8 + hop
      torso(t, { strings: false })
      const lookAtYou = ['sit-wait', 'sit-tap', 'sit-drum', 'sit-nag', 'sit-cheer'].includes(g.pose)

      if (g.pose === 'sit-type' || g.pose === 'sit-drum') {
        const fast = g.pose === 'sit-drum' ? f : Math.floor(f / 2)
        R(1, t + 2, 5, 1, c.topDark)
        R(1, t + 3, 4, 1, c.topDark)
        R(6, t + 1 - (fast % 2), 1, 1, SKIN)
        R(5, t + 2 - ((fast + 1) % 2), 1, 1, SKIN)
      } else if (g.pose === 'sit-phone') {
        R(1, t + 3, 2, 1, c.topDark)
        R(3, t, 2, 3, INK)
        R(4, t + 1, 1, 1, '#9fe3ff')
        R(3, t + 3, 2, 1, SKIN)
      } else if (g.pose === 'sit-sleep') {
        R(1, t + 2, 6, 1, c.topDark)
        R(1, t + 3, 5, 1, c.topDark)
      } else if (g.pose === 'sit-nag') {
        const wave = f % 2
        R(-4, t, 1, 4, c.topDark)
        R(-4, t + 4, 1, 1, SKIN)
        R(3, t, 3, 1, c.topDark)
        R(5 + wave, t - 5, 1, 5, c.topDark)
        R(5 + wave, t - 6, 1, 1, SKIN)
      } else if (cheer) {
        R(-6, t, 2, 1, c.topDark)
        R(4, t, 2, 1, c.topDark)
        R(-6, t - 5, 1, 5, c.topDark)
        R(5, t - 5, 1, 5, c.topDark)
        R(-6, t - 6, 1, 1, SKIN)
        R(5, t - 6, 1, 1, SKIN)
      } else {
        armsDown(t)
      }

      if (g.pose === 'sit-sleep') {
        head(3, b + 3, { eyes: 'closed', faceView: 'side' })
      } else if (g.pose === 'sit-phone') {
        head(1, b + 1, { eyes: blinking ? 'closed' : 'down', faceView: 'side' })
      } else if (lookAtYou) {
        const annoyed = g.pose === 'sit-drum' || g.pose === 'sit-tap'
        head(0, b, { eyes: cheer ? 'closed' : annoyed ? 'closed' : eyesOpen, faceView: 'front', mouth: g.pose === 'sit-nag' || cheer })
      } else {
        head(g.pose === 'sit-type' ? 1 : 0, b, { eyes: eyesOpen, faceView: 'side' })
      }
      break
    }

    // ------------------------------------------------ on the couch (anchor: seat)
    case 'couch': {
      R(-3, -2, 6, 2, PANTS)
      R(-3, 0, 2, 3, PANTS)
      R(1, 0, 2, 3, PANTS)
      R(-4, 3, 3, 1, SHOE)
      R(1, 3, 3, 1, SHOE)
      const breathe = f % 8 < 4 ? 0 : 1
      const t = -7 + breathe
      torso(t)
      armsDown(t)
      head(0, -8 + breathe, { eyes: g.dozing ? 'closed' : eyesOpen, faceView: 'front' })
      break
    }
  }
}

// ---------------------------------------------------------------- particles

const Z = ['####', '..#.', '.#..', '####']
const NOTE = ['.##', '.#.', '.#.', '##.', '##.']
const HEART = ['##.##', '#####', '.###.', '..#..']
const PLANE = ['##.....', '.####..', '..#####', '.##....']

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    if (p.kind === 'z') glyph(ctx, Z, x, y, '#f6efe2')
    else if (p.kind === 'note') glyph(ctx, NOTE, x, y, p.color)
    else if (p.kind === 'heart') glyph(ctx, HEART, x, y, '#ff8fa3')
    else if (p.kind === 'plane') {
      glyph(ctx, PLANE, x, y + 1, INK)
      glyph(ctx, PLANE, x, y, '#ffffff')
    }
    else rect(ctx, x, y, p.size || 1, p.size || 1, p.color)
  }
}
