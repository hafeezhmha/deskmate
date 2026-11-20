// The dock icon: Zaif's face, close up, on a late-night sky.
// Drawn on a 24x24 grid and exported at 192px (8x), so a 48px dock shrinks
// it by exactly 4 and every pixel stays sharp. Regenerate with: npm run icon

import { SHOP } from './data.js'

const ctx = document.getElementById('c').getContext('2d')
const R = (x, y, w, h, color) => {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

const INK = '#2b2233'
const SKY = '#2f3a6b'
const SKY_LOW = '#3d4a85'
const SKIN = '#f2c79a'
const HAIR = '#4a3426'
const { hat, hatDark, top, topDark } = SHOP.find((i) => i.id === 'outfit-classic').colors

// Rounded square with an ink outline.
R(2, 0, 20, 24, INK)
R(1, 1, 22, 22, INK)
R(0, 2, 24, 20, INK)
R(2, 1, 20, 22, SKY)
R(1, 2, 22, 20, SKY)
R(1, 12, 22, 10, SKY_LOW)
R(2, 22, 20, 1, SKY_LOW)

// A few stars.
R(4, 4, 1, 1, '#fff6cf')
R(20, 9, 1, 1, '#fff6cf')
R(3, 12, 1, 1, '#c9cff0')
R(20, 13, 1, 3, '#ffd27f')
R(19, 14, 3, 1, '#ffd27f')
R(18, 2, 1, 1, '#c9cff0')

// Head outline, beanie and pom.
R(10, 1, 4, 3, INK)
R(11, 2, 2, 1, hatDark)
R(6, 3, 12, 1, INK)
R(5, 4, 14, 13, INK)
R(6, 4, 12, 3, hat)
R(6, 5, 1, 2, hatDark)
R(6, 7, 12, 1, hatDark)
R(14, 4, 2, 1, '#f39a7b') // a bit of shine on the beanie

// Round off the head: cut the outline's corners, tuck the beanie's.
R(5, 4, 1, 1, SKY)
R(18, 4, 1, 1, SKY)
R(5, 16, 1, 1, SKY_LOW)
R(18, 16, 1, 1, SKY_LOW)
R(6, 4, 1, 1, INK)
R(17, 4, 1, 1, INK)

// Face.
R(6, 8, 12, 8, SKIN)
R(6, 15, 1, 1, INK)
R(17, 15, 1, 1, INK)
R(6, 8, 5, 1, HAIR)
R(6, 9, 2, 1, HAIR)
R(17, 8, 1, 2, HAIR)

// Big shiny eyes, blush, small smile.
R(8, 10, 2, 3, INK)
R(14, 10, 2, 3, INK)
R(8, 10, 1, 1, '#ffffff')
R(14, 10, 1, 1, '#ffffff')
R(6, 13, 2, 1, '#ec9a8a')
R(16, 13, 2, 1, '#ec9a8a')
R(11, 14, 2, 1, '#9a4a4a')

// Hoodie.
R(3, 17, 18, 6, INK)
R(4, 18, 16, 5, top)
R(4, 18, 2, 5, topDark)
R(18, 18, 2, 5, topDark)
R(3, 17, 1, 1, SKY_LOW) // round the shoulders
R(20, 17, 1, 1, SKY_LOW)
R(4, 18, 1, 1, INK)
R(19, 18, 1, 1, INK)
R(8, 17, 8, 1, topDark)
R(9, 18, 1, 3, '#f2efe6')
R(14, 18, 1, 3, '#f2efe6')
