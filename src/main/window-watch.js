// Watches which window you're in: its app (WM_CLASS) and its title.
// For browsers the title is the page title, e.g. "Lists | Boot.dev - Brave",
// which is how Zaif tells docs apart from YouTube.
//
// Polls every 1.5 s with xdotool + xprop (X11 only). Titles are passed to the
// window in memory and are never written to disk here.

const { execFile } = require('node:child_process')
const fs = require('node:fs')

// Terminals where we also check whether an AI agent (Claude Code, Codex...) is
// running inside. Keep in sync with TERMINALS in src/renderer/categories.js.
const TERMINALS = /terminal|herdr|kitty|alacritty|ghostty|wezterm|konsole|tilix|xterm|foot|warp/i
const AGENTS = new Set(['claude', 'codex', 'aider', 'gemini', 'opencode', 'goose'])

const SCRIPT = 'id=$(xdotool getactivewindow 2>/dev/null) || exit 1; xprop -id "$id" WM_CLASS _NET_WM_NAME WM_NAME'

function unescape(s) {
  return s.replace(/\\(.)/g, '$1')
}

function parse(out) {
  const cls = /WM_CLASS\(STRING\) = "([^"]*)", "([^"]*)"/.exec(out)
  const net = /_NET_WM_NAME\(UTF8_STRING\) = "((?:[^"\\]|\\.)*)"/.exec(out)
  const old = /(?<!_NET_)WM_NAME\(\w+\) = "((?:[^"\\]|\\.)*)"/.exec(out)
  return {
    app: cls ? cls[2] : '',
    title: unescape(net?.[1] ?? old?.[1] ?? ''),
  }
}

// Is an agent process running somewhere under this terminal app?
// Some terminals (like Herdr) run shells under a separate "<name>-core"
// process, so we match any ancestor whose name starts with the app name.
// Cached for a few seconds because it scans /proc.
let agentCache = { app: '', at: 0, value: false }
function agentRunningIn(app) {
  if (!TERMINALS.test(app)) return false
  if (agentCache.app === app && Date.now() - agentCache.at < 5000) return agentCache.value
  const prefix = app.toLowerCase().slice(0, 6)
  const procs = new Map()
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue
    try {
      const stat = fs.readFileSync(`/proc/${name}/stat`, 'utf8')
      const comm = stat.slice(stat.indexOf('(') + 1, stat.lastIndexOf(')'))
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
      procs.set(Number(name), { comm, ppid })
    } catch {
      // process exited while we were looking
    }
  }
  let value = false
  for (const [, proc] of procs) {
    if (!AGENTS.has(proc.comm)) continue
    for (let p = procs.get(proc.ppid), hops = 0; p && hops < 30; p = procs.get(p.ppid), hops++) {
      if (p.comm.toLowerCase().startsWith(prefix)) {
        value = true
        break
      }
    }
    if (value) break
  }
  agentCache = { app, at: Date.now(), value }
  return value
}

function watchWindow(onChange, intervalMs = 1500) {
  let last = null
  let busy = false

  const check = () => {
    if (busy) return
    busy = true
    execFile('sh', ['-c', SCRIPT], { timeout: 2000 }, (err, stdout) => {
      busy = false
      const win = err ? { app: '', title: '' } : parse(stdout)
      win.agent = agentRunningIn(win.app)
      const key = `${win.app}\n${win.title}\n${win.agent}`
      if (key !== last) {
        last = key
        onChange(win)
      }
    })
  }

  check()
  const timer = setInterval(check, intervalMs)
  return () => clearInterval(timer)
}

module.exports = { watchWindow }
