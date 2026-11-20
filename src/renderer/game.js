// Zaif's brain: game state, what Zaif is doing, and the main loop.
//
// The big idea: Zaif watches what *kind* of work you're doing (coding,
// learning, coding with AI, distracted; see categories.js). Typing code moves
// Zaif's project forward, learning raises Knowledge, and Zaif reacts to all of
// it. Finishing projects earns coins for upgrades and furniture.
// Breaks send Zaif wandering around the room; when a break ends, Zaif
// goes back to the desk and nags you until you start typing again.

import {
  KEYS_PER_LINE,
  KEY_VALUE,
  KNOWLEDGE,
  PROJECTS,
  UPGRADES,
  GOALS,
  GOAL_REWARD,
  WEEK_REWARD,
  SHOW_UP_SECONDS,
  BREAK_DAY_SECONDS,
  SHOP,
  STARTER_OWNED,
  SPOTS,
  LINES,
  MAIL,
  windowLine,
} from './data.js'
import { ROOM_W, ROOM_H, WALK_Y, CHAIR, COUCH, drawRoom, drawLighting, drawZaif, drawParticles } from './art.js'
import { classify, ruleFor, pageTitle, isBrowser } from './categories.js'
import { sfx, setSound } from './sound.js'
import { createUI } from './ui.js'

const canvas = document.getElementById('room')
const ctx = canvas.getContext('2d')
const bubbleEl = document.getElementById('bubble')

const WALK_SPEED = 28 // room pixels per second
const SECOND = 1000
const MINUTE = 60 * SECOND

// ------------------------------------------------------------------ state

// Everything in `save` is written to disk. Everything in `rt` is runtime only.
function freshSave() {
  return {
    version: 1,
    coins: 0,
    totalKeys: 0,
    speed: 0,
    scope: 1,
    energy: 100,
    project: null,
    progress: {}, // project id -> lines written
    shipped: {}, // project id -> times shipped
    owned: [...STARTER_OWNED],
    outfit: 'outfit-classic',
    wallpaper: 'wall-cream',
    knowledgeMinutes: 0, // time spent actively learning, ever
    goals: {}, // monday 'YYYY-MM-DD' -> { claimed: [goal ids], perfect }
    trophies: 0, // perfect weeks
    mail: [], // letters, newest first: { id, kind, from, subject, body, gift, at, read, claimed }
    mailSeq: 0,
    lastWeek: null, // the week Zaif last saw, to notice a new one
    rules: [], // your own category rules, made by sorting the unsorted list
    unsorted: {}, // windows no rule matched: key -> { app, site, label, seconds }
    days: {}, // 'YYYY-MM-DD' -> { keys, lines, shipped, time: { code, learn, ... }, pages: [] }
    settings: { scale: 3, panel: true, onTop: true, sound: true },
  }
}

let save = freshSave()

const rt = {
  now: performance.now(),
  todayKey: '',
  keySource: 'window',
  mode: 'desk', // desk | rest | returning | waiting | cheer
  activity: 'idle', // at the desk: working | reading | idle | distracted | asleep
  statusText: '',
  win: { app: '', title: '', agent: false }, // the window you're in
  category: 'other', // what kind of work that window is (categories.js)
  unsorted: null, // set when no rule knows the current window
  lastKeyAt: performance.now(), // last key that counted as work
  lastWorkAt: performance.now(), // last key or reading scroll that counted as work
  lastInputAt: performance.now(), // last input of any kind
  docLine: 0,
  pointerTicks: 0,
  restEndsAt: 0,
  waitingSince: 0,
  typedDuringReturn: false,
  plan: [], // Zaif's to-do list during a break: walk / act / sit steps
  lastSpot: null,
  cheerUntil: 0,
  fridgeOpen: false,
  coffeeOn: false,
  arcadeOn: false,
  codeLine: 0,
  typedInLine: 0,
  particles: [],
  bubble: null, // { text, until, onClick }
  timers: {}, // last time each kind of message fired, for rate limiting
  hourOverride: null,
  later: [], // things scheduled for a moment from now: { at, fn }
  coinsShown: 0, // the panel counts up to save.coins instead of jumping
  fakeTyping: false,
  fakeReading: false,
}

const zaif = { x: CHAIR.x, y: CHAIR.seatY, facing: 1, pose: 'sit-idle', frame: 0, blink: false, dozing: false, cup: null }

// ------------------------------------------------------------------ helpers

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const rand = (a, b) => a + Math.random() * (b - a)
const dayKey = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
const owned = () => new Set(save.owned)
const currentProject = () => PROJECTS.find((p) => p.id === save.project) || null
const item = (id) => SHOP.find((i) => i.id === id)

function today() {
  rt.todayKey = dayKey()
  const day = (save.days[rt.todayKey] ??= { keys: 0, lines: 0, shipped: 0 })
  day.time ??= {}
  day.pages ??= []
  return day
}

// Only let a kind of message through once per `ms`.
function every(name, ms) {
  if (rt.now - (rt.timers[name] || -Infinity) < ms) return false
  rt.timers[name] = rt.now
  return true
}

function say(text, { ms = 3800, onClick = null } = {}) {
  if (Array.isArray(text)) text = pick(text)
  rt.bubble = { text, until: rt.now + ms, onClick }
}

function schedule(ms, fn) {
  rt.later.push({ at: rt.now + ms, fn })
}

function particle(p) {
  rt.particles.push({ vx: 0, vy: 0, life: 1, ...p })
}

function persist() {
  window.zaif.save(save)
}

const knowledgeLevel = () => KNOWLEDGE.level(save.knowledgeMinutes)
const payFor = (project) => Math.round(project.pay * (1 + KNOWLEDGE.payBonus(knowledgeLevel())))

// ------------------------------------------------------------------ input

function onInput({ keys = 0, pointer = 0 }) {
  rt.now = performance.now()
  rt.lastInputAt = rt.now
  if (pointer) onPointer(pointer)
  if (keys) onKeys(keys)
}

// Mouse and scrolling only matter while learning: that's what reading looks like.
function onPointer(count) {
  if (rt.category !== 'learn' || rt.mode !== 'desk') return
  rt.lastWorkAt = rt.now
  rt.pointerTicks += count
  while (rt.pointerTicks > 40) {
    rt.pointerTicks -= 40
    rt.docLine++
  }
}

function onKeys(count) {
  save.totalKeys += count
  today().keys += count

  if (rt.mode === 'rest') {
    if (every('restTyping', 25 * SECOND)) say(LINES.restTyping)
    return
  }
  // Without global tracking we only see keys typed into Zaif: count them all.
  const value = rt.keySource === 'global' ? KEY_VALUE[rt.category] : 1
  if (!value) return // Slack messages don't write Zaif's code
  if (rt.mode === 'returning') rt.typedDuringReturn = true
  if (rt.mode === 'waiting') {
    rt.mode = 'desk'
    say(LINES.backToWork)
  }
  if (rt.mode === 'desk' && rt.activity === 'asleep') say(LINES.wake)

  rt.lastKeyAt = rt.now
  rt.lastWorkAt = rt.now
  rt.typedInLine += count
  while (rt.typedInLine > 14) {
    rt.typedInLine -= 14
    rt.codeLine++
  }
  addProgress(count * value)
}

// ------------------------------------------------------------------ windows

function onWindow(win) {
  const result = classify(win, save.rules)
  if (result.category === 'ignore') return // e.g. clicking on Zaif itself
  const before = rt.category
  rt.win = win
  rt.category = result.category
  rt.unsorted = result.unsorted || null
  if (rt.category === 'learn' && isBrowser(win.app)) countLearningPage(win)
  if (before !== rt.category && rt.mode === 'desk') react()
}

function react() {
  if (rt.category === 'learn' && every('sayLearn', 15 * MINUTE)) say(LINES.learn)
  else if (rt.category === 'ai' && every('sayAi', 20 * MINUTE)) say(LINES.ai)
  else if (rt.category === 'distract' && every('sayDistract', 10 * MINUTE)) say(LINES.distractYou)
  else if (rt.unsorted && every('sayUnsorted', 10 * MINUTE)) say(LINES.unsorted, { ms: 8000, onClick: () => ui.open('today') })
}

// Distinct learning pages you opened today. Only a hash of the title is kept.
function countLearningPage(win) {
  let h = 5381
  for (const ch of pageTitle(win)) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  const day = today()
  if (!day.pages.includes(h)) day.pages.push(h)
}

// Every frame: add time to whatever you're doing, if you're actually there.
function trackTime(dt) {
  const day = today()
  if (rt.mode === 'rest' || rt.mode === 'returning') {
    day.time.break = (day.time.break || 0) + dt
    return
  }
  const quiet = (rt.now - rt.lastInputAt) / SECOND
  // Videos need no input; reading needs the odd scroll; everything else needs you typing or clicking.
  const limit = rt.category === 'distract' ? 600 : rt.category === 'learn' ? 90 : 60
  if (quiet > limit) return
  day.time[rt.category] = (day.time[rt.category] || 0) + dt

  if (rt.category === 'learn') {
    const level = knowledgeLevel()
    save.knowledgeMinutes += dt / 60
    if (knowledgeLevel() > level) {
      say(`knowledge level ${knowledgeLevel()}! big brain.`, { ms: 5000 })
      sfx.coin()
    }
  }
  if (rt.unsorted) {
    const entry = (save.unsorted[rt.unsorted.key] ??= { ...rt.unsorted, seconds: 0 })
    entry.seconds += dt
    const keys = Object.keys(save.unsorted)
    if (keys.length > 60) {
      const smallest = keys.reduce((a, b) => (save.unsorted[a].seconds < save.unsorted[b].seconds ? a : b))
      delete save.unsorted[smallest]
    }
  }
}

function addProgress(count) {
  const project = currentProject()
  if (!project) {
    if (every('needProject', 40 * SECOND)) {
      say(LINES.needProject)
      ui.pulse('projects')
    }
    return
  }
  const tired = save.energy <= 0 ? 0.5 : 1
  const lines = (count * UPGRADES.speed.mult(save.speed) * tired) / KEYS_PER_LINE
  save.progress[project.id] = (save.progress[project.id] || 0) + lines
  today().lines += lines
  if (save.progress[project.id] >= project.lines) ship(project)
}

function ship(project) {
  const pay = payFor(project)
  save.coins += pay
  save.shipped[project.id] = (save.shipped[project.id] || 0) + 1
  save.progress[project.id] = 0 // keep the same project: next up is "v2"
  today().shipped++
  say(`${pick(LINES.shipped)} +${pay}`, { ms: 5000 })
  sfx.ship()
  if (rt.mode === 'desk') {
    rt.mode = 'cheer'
    rt.cheerUntil = rt.now + 2.5 * SECOND
  }
  for (let i = 0; i < 24; i++) {
    particle({
      x: rand(140, 200),
      y: rand(60, 80),
      vx: rand(-12, 12),
      vy: rand(-20, 5),
      gravity: 30,
      life: rand(1.2, 2.2),
      color: pick(['#f2b134', '#ff8fa3', '#7fd1ff', '#8be28b', '#c59bff']),
    })
  }
  sendMail(project)
  persist()
}

// ------------------------------------------------------------------ mail

// Pick a letter for a shipped project. Bigger projects get better mail.
function writeLetter(project) {
  const have = owned()
  const ctx = {
    project,
    pick,
    randInt: (a, b) => Math.floor(rand(a, b + 1)),
    owns: (id) => have.has(id),
    unownedFurniture: SHOP.filter((i) => i.kind === 'furniture' && !have.has(i.id)).sort((a, b) => a.price - b.price),
  }
  // The very first ship always gets a letter from mom.
  const firstEver = Object.values(save.shipped).reduce((a, b) => a + b, 0) === 1
  const options = firstEver ? MAIL.filter((m) => m.id === 'mom') : MAIL.filter((m) => !m.when || m.when(ctx))
  let roll = Math.random() * options.reduce((sum, m) => sum + m.weight, 0)
  const template = options.find((m) => (roll -= m.weight) < 0) || options[0]
  return { kind: template.id, ...template.make(ctx) }
}

// One letter per ship, sometimes two. It flies in a moment after the
// confetti, as a paper plane through the window.
function sendMail(project) {
  const count = Math.random() < 0.25 ? 2 : 1
  const arrivesAt = Date.now() + 2600 // hidden until the plane lands
  for (let i = 0; i < count; i++) {
    save.mail.unshift({ ...writeLetter(project), id: ++save.mailSeq, at: arrivesAt, read: false, claimed: false })
  }
  // Keep 40 letters; drop the oldest ones that are read and have nothing left to take.
  while (save.mail.length > 40) {
    const i = save.mail.findLastIndex((l) => l.read && (!l.gift || l.claimed))
    save.mail.splice(i >= 0 ? i : save.mail.length - 1, 1)
  }
  schedule(1000, () => particle({ kind: 'plane', x: 66, y: 24, vx: 70, vy: 23, gravity: 20, life: 1.6 }))
  schedule(2700, () => {
    sfx.pop()
    say(count === 2 ? 'two letters!' : LINES.mail, { ms: 9000, onClick: () => ui.open('mail') })
    ui.pulse('mail')
  })
}

const arrivedMail = () => save.mail.filter((l) => l.at <= Date.now())
const unreadMail = () => arrivedMail().filter((l) => !l.read).length

// ------------------------------------------------------------------ breaks

function startBreak(minutes) {
  rt.mode = 'rest'
  rt.restEndsAt = rt.now + minutes * MINUTE
  rt.plan = []
  rt.lastSpot = null
  zaif.x = CHAIR.standX
  zaif.y = WALK_Y
  say(['yay. break.', 'stretch time.', "brb. don't touch my code."])
}

function endBreak() {
  if (rt.mode === 'rest') rt.restEndsAt = rt.now
}

// Choose somewhere new to go and something to do there.
function planNextSpot() {
  const have = owned()
  const options = Object.entries(SPOTS).filter(([id, s]) => (!s.needs || have.has(s.needs)) && id !== rt.lastSpot)
  const [id, spot] = pick(options)
  rt.lastSpot = id
  const x = spot.x ?? rand(56, 136)
  return [
    { type: 'walk', x },
    { type: 'act', spot: id, dur: rand(spot.dur[0], spot.dur[1]) },
  ]
}

// Visual effects that need cleaning up if a break ends mid-action.
function resetProps() {
  rt.fridgeOpen = false
  rt.coffeeOn = false
  rt.arcadeOn = false
  zaif.cup = null
  zaif.dozing = false
}

function startAct(step) {
  const spot = SPOTS[step.spot]
  const line = step.spot === 'window' ? windowLine(hour()) : spot.lines.length ? pick(spot.lines) : null
  if (line && Math.random() < 0.75) say(line)
  if (step.spot === 'couch') {
    zaif.x = COUCH.x
    zaif.y = COUCH.seatY
  }
}

function endAct(step) {
  const spot = SPOTS[step.spot]
  if (spot.energy) save.energy = Math.min(100, save.energy + spot.energy)
  if (step.spot === 'couch') zaif.y = WALK_Y
  resetProps()
}

// Pose and props while Zaif is doing something at a spot.
function actPose(step, elapsed) {
  const share = elapsed / step.dur
  switch (step.spot) {
    case 'fridge':
      rt.fridgeOpen = elapsed < 1.6
      zaif.facing = elapsed < 1.6 ? -1 : 1
      zaif.pose = elapsed < 1.6 ? 'stand' : 'drink'
      break
    case 'coffee':
      rt.coffeeOn = share < 0.55
      zaif.facing = share < 0.55 ? 'back' : 1
      zaif.pose = share < 0.55 ? 'stand' : 'drink'
      zaif.cup = '#f2efe6'
      if (rt.coffeeOn && Math.random() < 0.08) particle({ x: rand(33, 36), y: 70, vy: -8, life: 1.2, color: '#f6efe2' })
      break
    case 'couch':
      zaif.facing = 0
      zaif.pose = 'couch'
      zaif.dozing = elapsed > 5
      if (zaif.dozing && Math.random() < 0.012) particle({ kind: 'z', x: zaif.x + 3, y: zaif.y - 20, vx: 3, vy: -6, life: 2 })
      break
    case 'window':
      zaif.facing = 'back'
      zaif.pose = 'stand'
      break
    case 'plant':
      zaif.facing = -1
      zaif.pose = 'water'
      if (Math.random() < 0.15) particle({ x: zaif.x - 10 + rand(-1, 1), y: WALK_Y - 9, vy: 18, life: 0.45, color: '#7fd1ff' })
      break
    case 'stretch':
      zaif.facing = 0
      zaif.pose = share < 0.6 ? 'stretch' : 'stand'
      break
    case 'books':
      zaif.facing = 0
      zaif.pose = 'read'
      break
    case 'arcade':
      zaif.facing = 'back'
      zaif.pose = 'play'
      rt.arcadeOn = true
      if (Math.random() < 0.03) particle({ kind: 'note', x: rand(130, 140), y: 66, vy: -7, life: 1.6, color: '#c59bff' })
      break
    case 'duck':
      zaif.facing = 'back'
      zaif.pose = 'talk'
      break
  }
}

// Work through Zaif's plan one step at a time.
function runPlan(dt) {
  const step = rt.plan[0]
  if (!step) return
  if (step.type === 'walk') {
    const dx = step.x - zaif.x
    const move = WALK_SPEED * dt
    zaif.y = WALK_Y
    zaif.pose = 'walk'
    zaif.facing = dx >= 0 ? 1 : -1
    if (Math.abs(dx) <= move) {
      zaif.x = step.x
      rt.plan.shift()
    } else {
      zaif.x += Math.sign(dx) * move
    }
  } else if (step.type === 'act') {
    step.startedAt ??= rt.now
    if (step.elapsed === undefined) startAct(step)
    step.elapsed = (rt.now - step.startedAt) / SECOND
    actPose(step, step.elapsed)
    if (step.elapsed >= step.dur) {
      endAct(step)
      rt.plan.shift()
    }
  } else if (step.type === 'sit') {
    zaif.x = CHAIR.x
    zaif.y = CHAIR.seatY
    zaif.facing = 1
    rt.plan.shift()
    if (rt.typedDuringReturn) {
      rt.mode = 'desk'
    } else {
      rt.mode = 'waiting'
      rt.waitingSince = rt.now
    }
  }
}

// ------------------------------------------------------------------ weekly goals

// Monday of the week `date` is in, as 'YYYY-MM-DD'.
function weekKeyFor(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toLocaleDateString('en-CA')
}

// Add up a week's days for the goals.
function weekSummary(weekKey) {
  const start = new Date(`${weekKey}T12:00:00`)
  const week = { shipped: 0, time: {}, breakDays: 0, showDays: 0 }
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const day = save.days[d.toLocaleDateString('en-CA')]
    if (!day) continue
    const t = day.time || {}
    week.shipped += day.shipped || 0
    for (const [cat, secs] of Object.entries(t)) week.time[cat] = (week.time[cat] || 0) + secs
    if ((t.break || 0) >= BREAK_DAY_SECONDS) week.breakDays++
    if ((t.code || 0) + (t.learn || 0) + (t.ai || 0) >= SHOW_UP_SECONDS) week.showDays++
  }
  return week
}

function checkGoals() {
  const key = weekKeyFor(new Date())
  if (save.lastWeek && save.lastWeek !== key) say(LINES.newWeek, { ms: 6000 })
  save.lastWeek = key
  const state = (save.goals[key] ??= { claimed: [], perfect: false })
  const week = weekSummary(key)
  for (const goal of GOALS) {
    if (state.claimed.includes(goal.id) || goal.value(week) < goal.target) continue
    state.claimed.push(goal.id)
    save.coins += GOAL_REWARD
    say(`${pick(LINES.goal)} ${goal.text}. +${GOAL_REWARD}`, { ms: 5000 })
    sfx.coin()
  }
  if (!state.perfect && state.claimed.length === GOALS.length) {
    state.perfect = true
    save.trophies++
    save.coins += WEEK_REWARD
    say(`${pick(LINES.perfectWeek)} +${WEEK_REWARD}`, { ms: 7000 })
    sfx.ship()
    for (let i = 0; i < 30; i++) {
      particle({ x: rand(100, 140), y: rand(30, 50), vx: rand(-14, 14), vy: rand(-20, 0), gravity: 30, life: rand(1.5, 2.5), color: pick(['#f2b134', '#fff2c4', '#ff8fa3']) })
    }
  }
  // Keep the last ~12 weeks of goal state.
  for (const old of Object.keys(save.goals).sort().slice(0, -12)) delete save.goals[old]
}

// ------------------------------------------------------------------ update

function hour() {
  if (rt.hourOverride !== null) return rt.hourOverride
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

function deskActivity() {
  const sinceKey = (rt.now - rt.lastKeyAt) / SECOND
  const sinceWork = (rt.now - rt.lastWorkAt) / SECOND
  const sinceInput = (rt.now - rt.lastInputAt) / SECOND
  if (rt.category === 'distract' && sinceInput < 600) return 'distracted' // you scroll, Zaif scrolls
  if (sinceKey < 2.5) return 'working'
  if (rt.category === 'learn' && sinceWork < 90) return 'reading'
  if (sinceWork < 45) return 'idle'
  if (sinceInput < 240) return 'distracted'
  return 'asleep'
}

function update(dt) {
  const t = rt.now / SECOND
  zaif.blink = rt.now % 4200 < 140

  // ---- energy: work drains it, breaks and naps refill it
  const before = save.energy
  if (rt.mode === 'desk' && (rt.activity === 'working' || rt.activity === 'reading')) save.energy -= (dt * 1.3) / 60
  else if (rt.mode === 'rest') save.energy += (dt * 12) / 60
  else if (rt.activity === 'asleep') save.energy += (dt * 3) / 60
  else save.energy += (dt * 0.5) / 60
  save.energy = Math.max(0, Math.min(100, save.energy))
  if (before > 35 && save.energy <= 35) rt.timers.tired = -Infinity // allow the hint right away

  // ---- what Zaif is doing
  if (rt.mode === 'rest') {
    if (rt.now >= rt.restEndsAt) {
      resetProps()
      if (zaif.y !== WALK_Y) zaif.y = WALK_Y
      rt.mode = 'returning'
      rt.typedDuringReturn = false
      rt.plan = [{ type: 'walk', x: CHAIR.standX }, { type: 'sit' }]
      say(LINES.restOver)
      sfx.pop()
    } else if (!rt.plan.length) {
      rt.plan = planNextSpot()
    }
    runPlan(dt)
    zaif.frame = Math.floor(t * 6)
    rt.statusText = 'on a break'
  } else if (rt.mode === 'returning') {
    runPlan(dt)
    zaif.frame = Math.floor(t * 6)
    rt.statusText = 'heading back'
  } else if (rt.mode === 'waiting') {
    const waited = (rt.now - rt.waitingSince) / SECOND
    zaif.frame = Math.floor(t * (waited < 40 ? 3 : 6))
    if (waited < 15) zaif.pose = 'sit-wait'
    else if (waited < 40) zaif.pose = 'sit-tap'
    else if (waited < 70) {
      zaif.pose = 'sit-drum'
      if (every('drum', 1.3 * SECOND)) sfx.drum()
    } else {
      zaif.pose = 'sit-nag'
      if (every('nag', 25 * SECOND)) {
        say(LINES.nag)
        sfx.hey()
      }
    }
    rt.statusText = 'waiting for you'
  } else if (rt.mode === 'cheer') {
    zaif.pose = 'sit-cheer'
    zaif.frame = Math.floor(t * 5)
    if (rt.now > rt.cheerUntil) rt.mode = 'desk'
    rt.statusText = 'shipped!'
  } else {
    const activity = deskActivity()
    rt.activity = activity
    if (activity === 'working') {
      zaif.pose = 'sit-type'
      zaif.frame = Math.floor(t * 10)
      if (every('working', 6 * MINUTE)) say(LINES.working)
      rt.statusText = { ai: 'coding with AI', learn: 'doing exercises' }[rt.category] || 'writing code'
    } else if (activity === 'reading') {
      zaif.pose = 'sit-idle'
      rt.statusText = 'reading docs'
    } else if (activity === 'idle') {
      zaif.pose = Math.floor(t) % 12 < 2 ? 'sit-wait' : 'sit-idle'
      if (Math.random() < 0.002 && every('quip', 2 * MINUTE)) say(LINES.idle)
      rt.statusText = 'thinking...'
    } else if (activity === 'distracted') {
      zaif.pose = 'sit-phone'
      if (Math.random() < 0.002 && every('quip', 2 * MINUTE)) say(LINES.distracted)
      rt.statusText = rt.category === 'distract' ? 'distracted (with you)' : 'on the phone'
    } else {
      zaif.pose = 'sit-sleep'
      if (every('z', 1.6 * SECOND)) particle({ kind: 'z', x: zaif.x + 6, y: zaif.y - 14, vx: 3, vy: -5, life: 2.2 })
      rt.statusText = 'asleep'
    }
    if (save.energy < 35 && (activity === 'working' || activity === 'reading') && every('tired', 20 * MINUTE)) {
      say(LINES.tired, { ms: 12000, onClick: () => ui.open('break') })
    }
  }

  // ---- particles
  for (const p of rt.particles) {
    p.vy += (p.gravity || 0) * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
  }
  rt.particles = rt.particles.filter((p) => p.life > 0 && p.y < ROOM_H)

  trackTime(dt)
  if (every('goals', 5 * SECOND)) checkGoals()
  for (const job of rt.later.filter((j) => rt.now >= j.at)) job.fn()
  rt.later = rt.later.filter((j) => rt.now < j.at)
  rt.coinsShown += (save.coins - rt.coinsShown) * Math.min(1, dt * 3)
  if (Math.abs(save.coins - rt.coinsShown) < 0.5) rt.coinsShown = save.coins
  if (rt.fakeTyping && Math.random() < 0.35) onInput({ keys: 1 })
  if (rt.fakeReading && Math.random() < 0.3) onInput({ pointer: 4 })
}

// ------------------------------------------------------------------ draw

function draw() {
  const have = owned()
  const now = new Date()
  const h = hour()
  const monitorOn = rt.mode === 'desk' ? rt.activity !== 'asleep' : rt.mode === 'waiting' || rt.mode === 'cheer'
  const view = {
    t: rt.now / SECOND,
    hour: h,
    minute: rt.hourOverride !== null ? (h % 1) * 60 : now.getMinutes(),
    owned: have,
    walls: item(save.wallpaper).colors,
    fridgeOpen: rt.fridgeOpen,
    coffeeOn: rt.coffeeOn,
    arcadeOn: rt.arcadeOn,
    monitor: monitorMode(monitorOn),
    trophies: save.trophies,
    unreadMail: unreadMail(),
    codeLine: rt.codeLine,
    docLine: rt.docLine,
    typedInLine: rt.typedInLine,
  }
  ctx.clearRect(0, 0, ROOM_W, ROOM_H)
  drawRoom(ctx, view)
  drawZaif(ctx, { ...zaif, colors: item(save.outfit).colors })
  drawLighting(ctx, view)
  drawParticles(ctx, rt.particles)
  drawBubble()
}

function monitorMode(on) {
  if (!on) return 'off'
  if (rt.mode !== 'desk') return 'idle'
  if (rt.activity === 'reading') return 'docs'
  if (rt.activity === 'working') return rt.category === 'ai' ? 'chat' : 'code'
  return 'idle'
}

// Speech bubbles are HTML so the text stays crisp; position them over zaif.
function drawBubble() {
  const b = rt.bubble
  if (!b || rt.now > b.until) {
    rt.bubble = null
    bubbleEl.hidden = true
    return
  }
  const scale = save.settings.scale
  const seated = zaif.pose.startsWith('sit') || zaif.pose === 'couch'
  const headTop = zaif.y - (seated ? 19 : 21)
  if (bubbleEl.textContent !== b.text) bubbleEl.textContent = b.text
  bubbleEl.classList.toggle('long', b.text.length > 26)
  bubbleEl.classList.toggle('clickable', Boolean(b.onClick))
  bubbleEl.hidden = false
  // Keep the bubble inside the room.
  const half = bubbleEl.offsetWidth / 2
  const x = Math.max(half + 4, Math.min(ROOM_W * scale - half - 4, zaif.x * scale))
  bubbleEl.style.left = `${x}px`
  bubbleEl.style.top = `${Math.max(bubbleEl.offsetHeight + 4, headTop * scale - 6)}px`
}

bubbleEl.addEventListener('click', () => {
  const handler = rt.bubble?.onClick
  rt.bubble = null
  handler?.()
})

// Click Zaif for a little reaction.
canvas.addEventListener('click', (event) => {
  const scale = save.settings.scale
  const x = event.offsetX / scale
  const y = event.offsetY / scale
  // The letters on the desk open the inbox.
  if (unreadMail() && x >= 173 && x <= 184 && y >= 86 && y <= 95) {
    ui.open('mail')
    return
  }
  if (Math.abs(x - zaif.x) < 8 && y > zaif.y - 24 && y < zaif.y + 4) {
    particle({ kind: 'heart', x: zaif.x - 2, y: zaif.y - 26, vy: -8, life: 1.2 })
    sfx.pop()
    if (rt.mode === 'desk') say(rt.activity === 'working' ? LINES.working : LINES.idle)
  }
})

// ------------------------------------------------------------------ actions (called by the panel)

function applyLayout() {
  const { scale, panel } = save.settings
  canvas.style.width = `${ROOM_W * scale}px`
  canvas.style.height = `${ROOM_H * scale}px`
  document.body.classList.toggle('no-panel', !panel)
  window.zaif.layout({ scale, panel })
}

const actions = {
  pickProject(id) {
    const project = PROJECTS.find((p) => p.id === id)
    if (!project || project.tier > save.scope) return
    save.project = id
    say(project.tier < save.scope ? LINES.bored : project.quip)
    persist()
  },
  buyUpgrade(key) {
    const u = UPGRADES[key]
    const level = save[key]
    if (level >= u.max || save.coins < u.cost(level)) return
    save.coins -= u.cost(level)
    save[key]++
    sfx.buy()
    say(key === 'scope' ? 'bigger projects! finally!' : 'my fingers feel faster.')
    persist()
  },
  buyItem(id) {
    const thing = item(id)
    if (!thing || save.owned.includes(id) || save.coins < thing.price) return
    save.coins -= thing.price
    save.owned.push(id)
    if (thing.kind === 'outfit') save.outfit = id
    if (thing.kind === 'wallpaper') save.wallpaper = id
    sfx.buy()
    say(thing.kind === 'furniture' ? `ooh, a new ${thing.name.toLowerCase()}!` : 'looking good.')
    persist()
  },
  equip(id) {
    const thing = item(id)
    if (!thing || !save.owned.includes(id)) return
    if (thing.kind === 'outfit') save.outfit = id
    if (thing.kind === 'wallpaper') save.wallpaper = id
    persist()
  },
  sortUnsorted(key, category) {
    const entry = save.unsorted[key]
    if (!entry) return
    save.rules.push(ruleFor(entry, category))
    delete save.unsorted[key]
    onWindow(rt.win) // re-check the window you're in now
    persist()
  },
  openLetter(id) {
    const letter = save.mail.find((l) => l.id === id)
    if (!letter || letter.read) return
    letter.read = true
    const react = MAIL.find((m) => m.id === letter.kind)?.react
    if (react) say(react)
    persist()
  },
  claimGift(id) {
    const letter = save.mail.find((l) => l.id === id)
    if (!letter?.gift || letter.claimed) return
    const gift = letter.gift
    if (gift.type === 'coins') save.coins += gift.amount
    if (gift.type === 'energy') save.energy = Math.min(100, save.energy + gift.amount)
    if (gift.type === 'item' && !save.owned.includes(gift.id)) {
      const thing = item(gift.id)
      save.owned.push(gift.id)
      if (thing.kind === 'outfit') save.outfit = gift.id
      if (thing.kind === 'wallpaper') save.wallpaper = gift.id
      say(thing.kind === 'furniture' ? `a ${thing.name.toLowerCase()}! for me?` : 'ooh. fancy.')
    }
    letter.claimed = true
    sfx.buy()
    persist()
  },
  startBreak,
  endBreak,
  setScale(scale) {
    save.settings.scale = scale
    applyLayout()
    persist()
  },
  togglePanel() {
    save.settings.panel = !save.settings.panel
    applyLayout()
    persist()
  },
  toggleSound() {
    save.settings.sound = !save.settings.sound
    setSound(save.settings.sound)
    persist()
  },
  toggleOnTop() {
    save.settings.onTop = !save.settings.onTop
    window.zaif.setOnTop(save.settings.onTop)
    persist()
  },
  quit() {
    persist()
    window.zaif.quit()
  },
}

const ui = createUI({
  state: () => {
    const weekKey = weekKeyFor(new Date())
    return {
      save,
      rt,
      knowledgeLevel: knowledgeLevel(),
      payFor,
      weekKey,
      week: weekSummary(weekKey),
      lastWeekKey: weekKeyFor(Date.now() - 7 * 86400000),
      mail: arrivedMail(),
      unread: unreadMail(),
    }
  },
  actions,
})

// ------------------------------------------------------------------ debug scenes
// `npm run snapshot -- --scene=work+all+night` renders a scene to a PNG.

function debugScene(scene) {
  for (const part of scene.split('+').filter(Boolean)) {
    if (part === 'all') save.owned = SHOP.map((i) => i.id)
    else if (part === 'night') rt.hourOverride = 22.5
    else if (part === 'day') rt.hourOverride = 13.25
    else if (part === 'dusk') rt.hourOverride = 18.5
    else if (part === 'rich') save.coins = 1234
    else if (part === 'project') {
      save.project = 'todo'
      save.progress.todo = 46
    } else if (part === 'work') Object.assign(rt, { fakeTyping: true, category: 'code' })
    else if (part === 'ai') Object.assign(rt, { fakeTyping: true, category: 'ai' })
    else if (part === 'reading') Object.assign(rt, { fakeReading: true, category: 'learn', lastKeyAt: rt.now - 60 * SECOND })
    else if (part === 'doomscroll') Object.assign(rt, { category: 'distract' })
    else if (part === 'week') fakeWeek()
    else if (part === 'trophies') save.trophies = 3
    else if (part === 'mail') {
      // One of every kind of letter, already arrived.
      const have = owned()
      const ctx = { project: PROJECTS[9], pick, randInt: (a, b) => a, owns: (id) => have.has(id), unownedFurniture: SHOP.filter((i) => i.kind === 'furniture' && !have.has(i.id)) }
      for (const m of MAIL) save.mail.unshift({ kind: m.id, ...m.make(ctx), id: ++save.mailSeq, at: 0, read: false, claimed: false })
      save.mail[3].read = true
    } else if (part === 'ship') {
      save.project = 'weather'
      schedule(300, () => ship(currentProject()))
    } else if (part === 'letter') schedule(100, () => ui.openLetter(save.mail[0].id))
    else if (part === 'claim') schedule(400, () => actions.claimGift(save.mail[0].id))
    else if (part === 'perfect') {
      fakeWeek()
      today().time.learn = 6 * 3600 // enough to finish every goal
    }
    else if (part === 'phone') Object.assign(rt, { lastKeyAt: rt.now - 60 * SECOND, lastWorkAt: rt.now - 60 * SECOND })
    else if (part === 'asleep') Object.assign(rt, { lastKeyAt: rt.now - 300 * SECOND, lastWorkAt: rt.now - 300 * SECOND, lastInputAt: rt.now - 300 * SECOND })
    else if (part === 'tired') save.energy = 20
    else if (part === 'tap') Object.assign(rt, { mode: 'waiting', waitingSince: rt.now - 20 * SECOND })
    else if (part === 'nag') Object.assign(rt, { mode: 'waiting', waitingSince: rt.now - 80 * SECOND })
    else if (part === 'cheer') Object.assign(rt, { mode: 'cheer', cheerUntil: rt.now + 60 * SECOND })
    else if (part.startsWith('outfit-') || part.startsWith('wall-')) {
      save.owned.push(part)
      if (part.startsWith('outfit-')) save.outfit = part
      else save.wallpaper = part
    } else if (part.startsWith('rest-')) {
      const spot = part.slice(5)
      startBreak(10)
      zaif.x = SPOTS[spot].x ?? 100
      rt.plan = [{ type: 'act', spot, dur: 999, startedAt: rt.now - 3 * SECOND }]
    } else if (part.startsWith('walk')) {
      startBreak(10)
      rt.plan = [{ type: 'walk', x: 20 }]
    } else if (part.startsWith('sheet-')) ui.open(part.slice(6))
    else if (part === 'scrolldown') setTimeout(() => (document.getElementById('sheet-body').scrollTop = 9999), 300)
    else if (part.startsWith('say-')) say(part.slice(4).replace(/_/g, ' '), { ms: 60000 })
  }
}

// Made-up history so the Today sheet has something to show in screenshots.
function fakeWeek() {
  const minutes = (m) => m * 60
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA')
    const r = (a, b) => minutes(Math.round(rand(a, b)))
    save.days[d] = { keys: 4000 + i * 300, lines: 80, shipped: 1, time: { code: r(40, 150), learn: r(10, 70), ai: r(30, 120), distract: r(5, 60), other: r(10, 40), break: r(10, 40) }, pages: [1, 2, 3] }
  }
  save.knowledgeMinutes = 140
  save.unsorted = {
    'Slack:': { key: 'Slack:', app: 'Slack', site: '', label: 'Slack', seconds: 3900 },
    'firefox:Google Search': { key: 'firefox:Google Search', app: 'firefox', site: 'Google Search', label: 'Google Search', seconds: 1500 },
    'Spotify:': { key: 'Spotify:', app: 'Spotify', site: '', label: 'Spotify', seconds: 240 },
  }
}

// ------------------------------------------------------------------ start

async function start() {
  const loaded = await window.zaif.load()
  if (loaded.save?.version === 1) {
    const base = freshSave()
    save = { ...base, ...loaded.save, settings: { ...base.settings, ...loaded.save.settings } }
  }
  rt.keySource = loaded.keySource
  rt.coinsShown = save.coins
  setSound(save.settings.sound)
  applyLayout()
  today()

  window.zaif.onInput(onInput)
  window.zaif.onWindow(onWindow)
  window.zaif.onKeySource((source) => {
    rt.keySource = source
  })
  if (loaded.activeWindow) onWindow(loaded.activeWindow)
  // Fallback when global counting isn't available: count keys typed into Zaif itself.
  document.addEventListener('keydown', (event) => {
    if (rt.keySource === 'global' || event.repeat) return
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return
    onInput({ keys: 1 })
  })

  if (loaded.scene) debugScene(loaded.scene)
  else say(save.project ? LINES.hello : LINES.needProject, { ms: 5000 })

  let last = performance.now()
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / SECOND)
    last = now
    rt.now = now
    update(dt)
    draw()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  setInterval(() => ui.render(), 250)
  setInterval(persist, 15 * SECOND)
  window.addEventListener('beforeunload', persist)
  ui.render()
}

start()
