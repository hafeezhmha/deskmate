// Decides what kind of work the focused window is.
//
//   code      writing code yourself (editor, terminal)
//   learn     docs, courses, tutorials. Reading counts, not just typing
//   ai        coding with an AI agent / chat
//   distract  YouTube, Reddit, X...
//   other     everything else (neutral)
//   ignore    Zaif itself, the desktop: keep whatever you were doing before
//
// Your own rules (made by sorting the "unsorted" list) are checked first,
// then the defaults below. First match wins. Patterns are case-insensitive.

export const CATEGORIES = {
  code: { name: 'coding', color: '#5b7bd5' },
  learn: { name: 'learning', color: '#6dbb6a' },
  ai: { name: 'with AI', color: '#9b7fe6' },
  distract: { name: 'distracted', color: '#e0734f' },
  other: { name: 'other', color: '#b8a88f' },
}

const TERMINALS = 'terminal|kitty|alacritty|ghostty|wezterm|konsole|tilix|xterm|foot|warp'
const EDITORS = 'cursor|^code$|codium|zed|jetbrains|idea|pycharm|webstorm|goland|clion|rustrover|sublime|gedit|kate|neovide|emacs'
const BROWSERS = 'brave|chrom|firefox|vivaldi|opera|edge|librewolf|zen'

export const DEFAULT_RULES = [
  { app: '^(deskmate|zaif|electron|nemo-desktop|plank|cinnamon)$', category: 'ignore' },

  // Terminals: AI if an agent is running inside (see window-watch.js) or the
  // title says so, otherwise you're writing code.
  { app: TERMINALS, agent: true, category: 'ai' },
  { app: TERMINALS, title: 'claude|codex|✳', category: 'ai' },
  { app: TERMINALS, category: 'code' },
  { app: EDITORS, category: 'code' },

  // Browsers, by page title.
  { app: BROWSERS, title: '\\b(claude|chatgpt|perplexity|gemini)\\b', category: 'ai' },
  { app: BROWSERS, title: 'youtube', also: 'tutorial|course|lecture|explained|crash course|how to|programming|coding|conference|talk', category: 'learn' },
  {
    app: BROWSERS,
    title: 'youtube|reddit|\\/ x$|twitter|instagram|facebook|netflix|prime video|hotstar|jiocinema|twitch|tiktok|9gag',
    category: 'distract',
  },
  {
    app: BROWSERS,
    title:
      'mdn|docs|documentation|devdocs|stack overflow|github|python\\.org|rust programming language|rust-lang|go\\.dev|node\\.js|typescript|w3schools|freecodecamp|leetcode|exercism|neetcode|roadmap\\.sh|tutorial|crates\\.io|wikipedia|hacker news',
    category: 'learn',
  },
]

const BROWSER_NAMES = / [-—] (brave|google chrome|chromium|mozilla firefox|vivaldi|opera)$/i

// Browser titles end with " - Firefox" etc.; drop that so rules see the page title.
export function pageTitle(win) {
  return win.title.replace(BROWSER_NAMES, '')
}

export function isBrowser(app) {
  return new RegExp(BROWSERS, 'i').test(app)
}

// The "site" part of a page title, used to group unsorted pages.
// "Lists | Python docs" -> "Python docs", "rust traits - Google Search" -> "Google Search"
export function siteOf(win) {
  const parts = pageTitle(win)
    .split(/ [-|—·:] /)
    .map((s) => s.trim())
    .filter(Boolean)
  return (parts[parts.length - 1] || win.app).slice(0, 40)
}

function matches(rule, win, title) {
  const test = (pattern, text) => new RegExp(pattern, 'i').test(text)
  if (rule.app && !test(rule.app, win.app)) return false
  if (rule.title && !test(rule.title, title)) return false
  if (rule.also && !test(rule.also, title)) return false
  if (rule.agent && !win.agent) return false
  return true
}

// Returns { category, unsorted } where `unsorted` is set when no rule matched.
export function classify(win, userRules = []) {
  if (!win.app) return { category: 'ignore' }
  const title = isBrowser(win.app) ? pageTitle(win) : win.title
  for (const rule of [...userRules, ...DEFAULT_RULES]) {
    if (matches(rule, win, title)) return { category: rule.category }
  }
  const browser = isBrowser(win.app)
  const label = browser ? siteOf(win) : win.app
  return {
    category: 'other',
    unsorted: { key: `${win.app}:${browser ? label : ''}`, app: win.app, site: browser ? label : '', label },
  }
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Turn an unsorted entry into a rule after you pick its category.
export function ruleFor(entry, category) {
  const rule = { app: `^${escape(entry.app)}$`, category }
  if (entry.site) rule.title = `${escape(entry.site)}$`
  return rule
}
