// Everything tunable about the game lives here: projects, upgrades, shop
// items, break spots and Zaif's lines. Change numbers here, not in game.js.

// How many key presses make one "line of code" at typing speed level 0.
export const KEYS_PER_LINE = 35

// Projects, grouped into tiers. You unlock a tier by upgrading Scope.
// Zaif is ambitious, so the tiers get sillier as they go.
export const TIERS = [
  { tier: 1, name: 'Weekend hacks' },
  { tier: 2, name: 'Side projects' },
  { tier: 3, name: 'Startup ideas' },
  { tier: 4, name: 'Legendary' },
]

export const PROJECTS = [
  { id: 'dotfiles', tier: 1, name: 'My dotfiles', lines: 50, pay: 15, quip: 'everyone will want my vim config.' },
  { id: 'todo', tier: 1, name: 'A todo app', lines: 80, pay: 25, quip: "but this one's different." },
  { id: 'weather', tier: 1, name: 'Weather CLI', lines: 110, pay: 35, quip: 'in the terminal. like a pro.' },
  { id: 'site', tier: 1, name: 'Personal website', lines: 140, pay: 45, quip: "with a blog I'll post on weekly. surely." },

  { id: 'bot', tier: 2, name: 'A Discord bot', lines: 300, pay: 110, quip: 'it will moderate AND tell jokes.' },
  { id: 'editor', tier: 2, name: 'Markdown editor', lines: 420, pay: 150, quip: "obsidian who?" },
  { id: 'chess', tier: 2, name: 'Chess engine', lines: 600, pay: 220, quip: 'I will beat magnus. eventually.' },

  { id: 'saas', tier: 3, name: 'SaaS for SaaS founders', lines: 1200, pay: 480, quip: 'recurring revenue, baby.' },
  { id: 'engine', tier: 3, name: 'A game engine', lines: 1600, pay: 650, quip: 'the game comes later. engine first.' },
  { id: 'browser', tier: 3, name: 'My own browser', lines: 2200, pay: 900, quip: 'how hard can rendering be?' },

  { id: 'lang', tier: 4, name: 'A programming language', lines: 4000, pay: 1800, quip: "it'll be called zaiflang." },
  { id: 'os', tier: 4, name: 'An operating system', lines: 6000, pay: 2800, quip: 'linus did it. how hard can it be.' },
  { id: 'rust', tier: 4, name: 'Rewrite it all in Rust', lines: 9000, pay: 4500, quip: 'blazingly fast. memory safe. ambitious.' },
]

// How much a key press is worth, depending on what you're doing.
// Code you type yourself counts most. Typing into an AI chat counts less.
// Slack messages and YouTube comments don't write Zaif's code.
export const KEY_VALUE = { code: 1, learn: 1, ai: 0.5, other: 0, distract: 0 }

// Knowledge is earned, not bought: minutes spent actively learning
// (docs, courses, tutorials). Each level makes shipped projects pay more,
// because Zaif writes better code when you know more.
export const KNOWLEDGE = {
  level: (minutes) => Math.floor(Math.sqrt(minutes / 30)), // Lv1 30m, Lv2 2h, Lv3 4.5h, Lv4 8h...
  minutesFor: (level) => 30 * level * level,
  payBonus: (level) => 0.1 * level, // +10% pay per level
}

// Little Writer-style upgrades. Quality comes in v2 with code reviews.
export const UPGRADES = {
  speed: {
    name: 'Typing speed',
    desc: '+25% lines per key',
    max: 8,
    cost: (level) => Math.round(20 * 1.9 ** level),
    mult: (level) => 1 + 0.25 * level,
  },
  scope: {
    name: 'Scope',
    desc: 'unlocks bigger projects',
    max: 4, // scope level == highest tier you can take on
    cost: (level) => [0, 120, 600, 2500][level],
  },
}

// Shop. Furniture with a `spot` gives Zaif something new to do on breaks.
export const SHOP = [
  { id: 'duck', kind: 'furniture', name: 'Rubber duck', price: 40, spot: 'duck', desc: 'Zaif explains code to it.' },
  { id: 'coffee', kind: 'furniture', name: 'Coffee machine', price: 90, spot: 'coffee', desc: 'breaks give more energy.' },
  { id: 'books', kind: 'furniture', name: 'Bookshelf', price: 160, spot: 'books', desc: 'Zaif reads on breaks.' },
  { id: 'arcade', kind: 'furniture', name: 'Arcade cabinet', price: 320, spot: 'arcade', desc: 'one more round...' },
  { id: 'poster', kind: 'furniture', name: 'Poster', price: 25, desc: 'motivational. kind of.' },
  { id: 'rug', kind: 'furniture', name: 'Rug', price: 35, desc: 'ties the room together.' },
  { id: 'lights', kind: 'furniture', name: 'Fairy lights', price: 50, desc: 'cozy glow at night.' },

  { id: 'outfit-classic', kind: 'outfit', name: 'Classic', price: 0, colors: { hat: '#e0734f', hatDark: '#b8533a', top: '#5b7bd5', topDark: '#3f5aa8' } },
  { id: 'outfit-forest', kind: 'outfit', name: 'Forest', price: 60, colors: { hat: '#e9c46a', hatDark: '#c49a3c', top: '#3f8f5a', topDark: '#2c6b42' } },
  { id: 'outfit-midnight', kind: 'outfit', name: 'Midnight', price: 90, colors: { hat: '#9b7fe6', hatDark: '#7058c0', top: '#3a3d5c', topDark: '#272944' } },
  { id: 'outfit-bubblegum', kind: 'outfit', name: 'Bubblegum', price: 90, colors: { hat: '#5bc0be', hatDark: '#3c9795', top: '#f08fb2', topDark: '#cc6b90' } },

  { id: 'wall-cream', kind: 'wallpaper', name: 'Cream', price: 0, colors: { wall: '#ead6b8', stripe: '#e2cba9', floor: '#b9835a', floorDark: '#a3714b', curtain: '#e0734f' } },
  { id: 'wall-sage', kind: 'wallpaper', name: 'Sage', price: 70, colors: { wall: '#c9d8bf', stripe: '#bccdb0', floor: '#a7774f', floorDark: '#916442', curtain: '#f2efe6' } },
  { id: 'wall-nightowl', kind: 'wallpaper', name: 'Night owl', price: 120, colors: { wall: '#3d4268', stripe: '#373c5f', floor: '#6b4a3a', floorDark: '#5a3d30', curtain: '#9b7fe6' } },
]

export const STARTER_OWNED = ['outfit-classic', 'wall-cream']

// Places Zaif goes on a break. `x` is where Zaif stands, `face` is which way
// Zaif looks (1 right, -1 left, 0 at you, 'back' away from you).
// `needs` is a shop item id; spots without it are always in the room.
export const SPOTS = {
  fridge: { x: 32, face: -1, dur: [8, 11], energy: 6, lines: ['cola time.', 'ahh. fizzy.', 'fridge check. still cola.'] },
  couch: { x: 68, face: 0, dur: [14, 20], lines: ['just resting my eyes.', 'five more minutes.', 'this couch gets me.'] },
  window: { x: 68, face: 'back', dur: [8, 11], lines: [] }, // lines depend on time of day
  plant: { x: 110, face: -1, dur: [6, 8], lines: ['grow, little guy.', 'you and me, plant.'] },
  stretch: { x: null, face: 0, dur: [4, 6], lines: ['mmmmh.', 'crack.'] },
  coffee: { needs: 'coffee', x: 35, face: 'back', dur: [9, 12], energy: 12, lines: ['coffee: compiling.', 'fuel for genius.'] },
  books: { needs: 'books', x: 116, face: 0, dur: [12, 16], lines: ['chapter one: clean code.', 'hmm. interesting.'] },
  arcade: { needs: 'arcade', x: 135, face: 'back', dur: [12, 16], lines: ['new high score!', 'one more round.'] },
  duck: { needs: 'duck', x: 196, face: 'back', dur: [8, 11], lines: ['so this function returns... oh.', "you're right, duck."] },
}

export const BREAK_LENGTHS = [5, 10, 15, 25] // minutes

// Weekly goals (Monday to Sunday). Long-term motivation: the stuff you're
// actually trying to do more of. Every goal only counts up, so once it's
// ticked it stays ticked. `value` gets the week's summary from game.js:
//   { shipped, time: { code, learn, ai, ... } (seconds), breakDays, showDays }
const HOUR = 3600
export const GOALS = [
  { id: 'ship', text: 'ship 3 projects', target: 3, unit: 'count', value: (w) => w.shipped },
  { id: 'learn', text: 'learn for 5 hours', target: 5 * HOUR, unit: 'time', value: (w) => w.time.learn || 0 },
  { id: 'handmade', text: 'code 3 hours without AI', target: 3 * HOUR, unit: 'time', value: (w) => w.time.code || 0 },
  { id: 'breaks', text: 'take a real break on 4 days', target: 4, unit: 'days', value: (w) => w.breakDays },
  { id: 'showup', text: 'show up on 5 days', target: 5, unit: 'days', value: (w) => w.showDays },
]
export const GOAL_REWARD = 40 // coins per goal
export const WEEK_REWARD = 250 // coins for all of them, plus a trophy
export const SHOW_UP_SECONDS = 30 * 60 // coding + learning + AI time that counts as showing up
export const BREAK_DAY_SECONDS = 5 * 60

// Zaif's voice: ambitious, easily distracted, means well.
export const LINES = {
  hello: ['today I build something huge.', 'big plans today.', 'ok. focus. for real this time.'],
  needProject: ['I need a project! (projects tab)', 'give me something to build!'],
  working: ["we're cooking.", 'look at us go.', 'this is my best code yet.', 'flow state.'],
  idle: ['what if we made our own OS?', 'I should start a newsletter.', 'imagine the github stars.', 'thinking...'],
  distracted: ['researching. (watching videos)', 'just one more reel.', 'checking hacker news. for work.'],
  wake: ['I was thinking with my eyes closed.', "huh?! I'm up. I'm coding."],
  shipped: ['SHIPPED IT.', 'next: world domination.', 'it works on my machine!'],
  tired: ['my brain is soup. break?', 'eyes... blurry... break?'],
  restTyping: ["shh. we're on break.", 'hey. hands off. break time.'],
  restOver: ['break over!', 'back to it?'],
  nag: ['helloooo?', "the code won't write itself.", "I'm ready when you are..."],
  backToWork: ['ok ok. focus mode.', 'here we go!'],
  bored: ["small project? fine. warm-up.", 'this is beneath us. but ok.'],
  // reacting to what *you* are doing
  learn: ['study time.', 'ooh, docs. reading along.', 'learning! my favourite.'],
  ai: ['pair programming with a robot.', "let the robot type. I'll supervise."],
  distractYou: ['ooh, what are we watching?', 'if you scroll, I scroll.', 'I saw that.'],
  unsorted: ['where are we? (sort it in Today)', 'new place! is this work?'],
  goal: ['goal done!', 'tick!', 'look at us, being consistent.'],
  newWeek: ['new week. new goals.', "monday. let's do this. probably."],
  perfectWeek: ['ALL GOALS. TROPHY.', 'perfect week. framing this.'],
}

export function windowLine(hour) {
  if (hour >= 21 || hour < 5) return 'the stars are out.'
  if (hour < 8) return 'sunrise. nice.'
  if (hour < 17) return 'nice day out there.'
  return "sun's going down."
}
