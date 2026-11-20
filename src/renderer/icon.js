import { drawZaif } from './art.js'
import { SHOP } from './data.js'

const ctx = document.getElementById('c').getContext('2d')
const R = (x, y, w, h, c) => {
  ctx.fillStyle = c
  ctx.fillRect(x, y, w, h)
}

// Rounded square: ink outline, cream wall, wooden floor.
R(3, 1, 26, 30, '#2b2233')
R(1, 3, 30, 26, '#2b2233')
R(2, 2, 28, 28, '#2b2233')
R(3, 2, 26, 28, '#ead6b8')
R(2, 3, 28, 26, '#ead6b8')
for (let x = 4; x < 29; x += 6) R(x, 2, 2, 20, '#e2cba9')
R(2, 21, 28, 1, '#8a5a3c')
R(2, 22, 28, 7, '#b9835a')
R(3, 29, 26, 1, '#b9835a')
R(2, 25, 28, 1, '#a3714b')

// Zaif, front view, waving.
const colors = SHOP.find((i) => i.id === 'outfit-classic').colors
drawZaif(ctx, { x: 16, y: 27, facing: 0, pose: 'stretch', frame: 0, colors })
