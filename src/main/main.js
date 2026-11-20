// Zaif main process: owns the window, the input counter, the window watcher
// and the save file.
// All the game itself lives in src/renderer/.

const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { startInputCounter } = require('./input')
const { watchWindow } = require('./window-watch')

// Key counting uses X11, so run Electron as an X11 client too.
// Transparent windows on Linux also need this switch.
app.commandLine.appendSwitch('ozone-platform', 'x11')
app.commandLine.appendSwitch('enable-transparent-visuals')

// DESKMATE_DATA_DIR lets you run a throwaway copy without touching your real save.
if (process.env.DESKMATE_DATA_DIR) {
  app.setPath('userData', path.resolve(process.env.DESKMATE_DATA_DIR))
}

// Optional flags, used for screenshots while developing:
//   --snapshot=out.png  render without showing a window, save a PNG, quit
//   --scene=work+night  force a scene (see debugScene in game.js)
const flag = (name) => {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.slice(name.length + 3) : ''
}
const snapshotPath = flag('snapshot')
const scene = flag('scene')
//   --page=icon         render src/renderer/icon.html instead (used to make the dock icon)
const page = flag('page')
const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png')

// Must match ROOM_W / ROOM_H in src/renderer/art.js.
const ROOM_W = 208
const ROOM_H = 112
const PANEL_W = 236
const MIN_H = 372

const dataDir = () => app.getPath('userData')
const savePath = () => path.join(dataDir(), 'save.json')
const windowPath = () => path.join(dataDir(), 'window.json')

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

// Write to a temp file and rename, so a crash mid-write can't corrupt the save.
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file)
}

function windowSize({ scale, panel }) {
  return {
    width: ROOM_W * scale + (panel ? PANEL_W : 0),
    height: Math.max(ROOM_H * scale, panel ? MIN_H : 0),
  }
}

let win = null
let stopInput = null
let stopWatch = null
let keySource = 'window'
let activeWindow = { app: '', title: '' }

function createWindow() {
  const save = readJson(savePath())
  const settings = { scale: 3, panel: true, onTop: true, ...(save?.settings || {}) }
  const size = page === 'icon' ? { width: 256, height: 256 } : windowSize(settings)

  // First run: bottom-right corner of the main screen. Later: where you left it.
  const area = screen.getPrimaryDisplay().workArea
  const saved = readJson(windowPath())
  const x = saved?.x ?? area.x + area.width - size.width - 24
  const y = saved?.y ?? area.y + area.height - size.height - 24

  win = new BrowserWindow({
    ...size,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    hasShadow: false,
    alwaysOnTop: settings.onTop,
    skipTaskbar: false,
    show: false,
    title: 'Zaif',
    icon: fs.existsSync(ICON) ? ICON : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      // Keep animating and counting even when the window isn't focused.
      backgroundThrottling: false,
      offscreen: Boolean(snapshotPath),
    },
  })
  if (settings.onTop) win.setAlwaysOnTop(true, 'floating')

  win.loadFile(path.join(__dirname, '..', 'renderer', page === 'icon' ? 'icon.html' : 'index.html'))

  if (snapshotPath) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        // --crop=x,y,w,h zooms into one area (3x, nearest-neighbour-ish).
        const crop = flag('crop').split(',').map(Number)
        let image = await win.webContents.capturePage(crop.length === 4 ? { x: crop[0], y: crop[1], width: crop[2], height: crop[3] } : undefined)
        if (crop.length === 4) image = image.resize({ width: crop[2] * 3, quality: 'good' })
        fs.writeFileSync(path.resolve(snapshotPath), image.toPNG())
        app.quit()
      }, Number(flag('delay')) || 2500)
    })
    return
  }

  win.once('ready-to-show', () => win.show())
  win.on('moved', () => {
    const [wx, wy] = win.getPosition()
    writeJson(windowPath(), { x: wx, y: wy })
  })
  win.on('closed', () => {
    win = null
  })
}

// Resize while keeping the bottom-right corner in place, since that's
// usually where the companion sits on screen.
function applyLayout(settings) {
  if (!win) return
  const [oldW, oldH] = win.getSize()
  const [oldX, oldY] = win.getPosition()
  const { width, height } = windowSize(settings)
  win.setResizable(true)
  win.setBounds({ x: oldX + oldW - width, y: oldY + oldH - height, width, height })
  win.setResizable(false)
}

ipcMain.handle('zaif:load', () => ({ save: readJson(savePath()), keySource, activeWindow, scene }))
ipcMain.on('zaif:save', (_event, data) => {
  if (!snapshotPath) writeJson(savePath(), data)
})
ipcMain.on('zaif:layout', (_event, settings) => applyLayout(settings))
ipcMain.on('zaif:on-top', (_event, on) => win?.setAlwaysOnTop(Boolean(on), 'floating'))
ipcMain.on('zaif:minimize', () => win?.minimize())
ipcMain.on('zaif:quit', () => app.quit())

// Only one Zaif at a time. Clicking the dock icon again just brings him back.
if (!snapshotPath && !app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
  app.whenReady().then(start)
}

function start() {
  // Transparent windows on Linux render black if created too early.
  setTimeout(createWindow, snapshotPath ? 0 : 300)

  if (!snapshotPath) {
    stopInput = startInputCounter({
      onInput: (counts) => win?.webContents.send('zaif:input', counts),
      onStatus: (source) => {
        keySource = source
        win?.webContents.send('zaif:key-source', source)
      },
    })
    stopWatch = watchWindow((w) => {
      activeWindow = w
      win?.webContents.send('zaif:window', w)
    })
  }
}

app.on('before-quit', () => {
  stopInput?.()
  stopWatch?.()
})
app.on('window-all-closed', () => app.quit())
