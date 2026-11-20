// The side panel: stats, buttons and the sheets (projects, upgrades, shop,
// break, settings). It reads game state and calls back into game.js through
// `actions`; it never changes state itself.

import { PROJECTS, TIERS, UPGRADES, SHOP, BREAK_LENGTHS, KNOWLEDGE } from './data.js'
import { CATEGORIES } from './categories.js'

const $ = (id) => document.getElementById(id)
const coin = (n) => `<span class="price"><i class="coin"></i>${Math.round(n).toLocaleString()}</span>`
// 4500 seconds -> "1h 15m"
const fmtDur = (seconds) => {
  const m = Math.floor(seconds / 60)
  if (m < 1) return '0m'
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}
const TRACKED = ['code', 'learn', 'ai', 'distract', 'other']
const dot = (cat) => `<i class="dot" style="background:${CATEGORIES[cat].color}"></i>`

// A stacked bar of time per category.
function splitBar(time, widthPct = 100) {
  const total = TRACKED.reduce((sum, c) => sum + (time[c] || 0), 0)
  if (!total) return `<div class="split" style="width:${widthPct}%"></div>`
  const parts = TRACKED.map((c) => `<i style="width:${((time[c] || 0) / total) * 100}%;background:${CATEGORIES[c].color}"></i>`)
  return `<div class="split" style="width:${widthPct}%">${parts.join('')}</div>`
}
const totalOf = (time) => TRACKED.reduce((sum, c) => sum + (time?.[c] || 0), 0)

const fmtTime = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)

// Knowledge isn't bought, it's earned by learning. Shown with the upgrades.
function knowledgeRow(save) {
  const level = KNOWLEDGE.level(save.knowledgeMinutes)
  const next = KNOWLEDGE.minutesFor(level + 1)
  return `<div class="item"><div><b>Knowledge · Lv ${level}</b>
    <span class="small">+${Math.round(KNOWLEDGE.payBonus(level) * 100)}% pay · ${fmtDur(save.knowledgeMinutes * 60)} learned, next level at ${fmtDur(next * 60)}. earned by learning, not bought.</span></div></div>`
}

export function createUI({ state, actions }) {
  let sheet = null // which sheet is open, or null
  let shopTab = 'furniture'
  let lastSheetHtml = ''

  // ---------------------------------------------------------- panel

  function renderPanel() {
    const { save, rt, payFor } = state()
    $('coins').textContent = Math.floor(save.coins).toLocaleString()

    const project = PROJECTS.find((p) => p.id === save.project)
    if (project) {
      const done = save.progress[project.id] || 0
      $('project-name').textContent = project.name
      $('project-bar').style.width = `${Math.min(100, (done / project.lines) * 100)}%`
      const shipped = save.shipped[project.id] ? ` · v${save.shipped[project.id] + 1}` : ''
      $('project-meta').innerHTML = `${Math.floor(done)} / ${project.lines} lines${shipped} · ${coin(payFor(project))}`
    } else {
      $('project-name').textContent = 'nothing yet'
      $('project-bar').style.width = '0%'
      $('project-meta').textContent = 'pick one in Projects'
    }

    $('energy-bar').style.width = `${save.energy}%`
    $('energy-bar').parentElement.classList.toggle('low', save.energy < 35)
    $('status').textContent = rt.statusText
    $('btn-break').textContent = rt.mode === 'rest' ? fmtTime(rt.restEndsAt - rt.now) : 'Break'

    const time = save.days[rt.todayKey]?.time || {}
    $('today-total').textContent = fmtDur(totalOf(time))
    const html = splitBar(time).replace(/^<div class="split"[^>]*>|<\/div>$/g, '')
    if ($('today-bar').innerHTML !== html) $('today-bar').innerHTML = html
    const legend = TRACKED.filter((c) => (time[c] || 0) >= 60)
      .map((c) => `<span>${dot(c)}${CATEGORIES[c].name} ${fmtDur(time[c])}</span>`)
      .join('')
    const legendHtml = legend || '<span>nothing yet. go do something.</span>'
    if ($('today-legend').innerHTML !== legendHtml) $('today-legend').innerHTML = legendHtml

    const unsorted = Object.keys(save.unsorted).length
    $('footer-note').textContent =
      rt.keySource !== 'global' ? 'counting this window only' : unsorted ? `${unsorted} unsorted · see Today` : ''
  }

  // ---------------------------------------------------------- sheets

  const sheets = {
    projects: {
      title: 'Projects',
      html: ({ save }) =>
        TIERS.map(({ tier, name }) => {
          const locked = tier > save.scope
          const head = `<div class="group">Tier ${tier} · ${name}${locked ? ` · needs Scope ${tier}` : ''}</div>`
          const rows = PROJECTS.filter((p) => p.tier === tier)
            .map((p) => {
              const current = save.project === p.id
              const done = Math.floor(save.progress[p.id] || 0)
              const shipped = save.shipped[p.id] ? ` · shipped ×${save.shipped[p.id]}` : ''
              const partial = done > 0 ? ` · ${done}/${p.lines}` : ''
              const button = current
                ? '<button class="btn on" disabled>on it</button>'
                : `<button class="btn" data-action="project" data-id="${p.id}" ${locked ? 'disabled' : ''}>Start</button>`
              return `<div class="item ${current ? 'current' : ''} ${locked ? 'locked' : ''}">
                <div><b>${p.name}</b><span class="small">${p.lines} lines · ${coin(p.pay)}${partial}${shipped}</span></div>
                ${button}</div>`
            })
            .join('')
          return head + rows
        }).join(''),
    },

    upgrades: {
      title: 'Upgrades',
      html: ({ save }) => {
        const row = (key, level, effect) => {
          const u = UPGRADES[key]
          const maxed = level >= u.max
          const cost = maxed ? 0 : u.cost(level)
          return `<div class="item"><div><b>${u.name} · Lv ${level}</b>
            <span class="small">${effect} · ${u.desc}</span></div>
            ${
              maxed
                ? '<button class="btn" disabled>max</button>'
                : `<button class="btn primary" data-action="upgrade" data-id="${key}" ${save.coins < cost ? 'disabled' : ''}>${coin(cost)}</button>`
            }</div>`
        }
        return (
          row('speed', save.speed, `×${UPGRADES.speed.mult(save.speed).toFixed(2)} now`) +
          row('scope', save.scope, `tier ${save.scope} unlocked`) +
          knowledgeRow(save) +
          `<div class="item locked"><div><b>Quality</b>
            <span class="small">comes with code reviews (v2): Zaif only gets better code when you understand yours.</span></div></div>`
        )
      },
    },

    today: {
      title: 'Today',
      html: ({ save, rt }) => {
        const day = save.days[rt.todayKey] || { time: {}, keys: 0, pages: [] }
        const time = day.time || {}
        const max = Math.max(60, ...TRACKED.map((c) => time[c] || 0))
        const rows = TRACKED.map(
          (c) => `<div class="stat-row"><span class="what">${dot(c)}${CATEGORIES[c].name}</span>
            <div class="bar"><div style="width:${((time[c] || 0) / max) * 100}%;background-color:${CATEGORIES[c].color}"></div></div>
            <span class="when">${fmtDur(time[c] || 0)}</span></div>`,
        ).join('')
        const extras = `<div class="note">breaks ${fmtDur(time.break || 0)} · ${day.keys.toLocaleString()} keys · ${
          (day.pages || []).length
        } learning pages</div>`

        // Last 7 days, newest first. Bar length = how long you were at it.
        const days = []
        for (let i = 0; i < 7; i++) {
          const d = new Date(Date.now() - i * 86400000)
          days.push({ key: d.toLocaleDateString('en-CA'), label: i === 0 ? 'today' : d.toLocaleDateString('en', { weekday: 'short' }).toLowerCase() })
        }
        const longest = Math.max(60, ...days.map((d) => totalOf(save.days[d.key]?.time)))
        const week = days
          .map(({ key, label }) => {
            const t = save.days[key]?.time || {}
            return `<div class="stat-row"><span class="what">${label}</span>${splitBar(t, (totalOf(t) / longest) * 100)}<span class="when">${fmtDur(totalOf(t))}</span></div>`
          })
          .join('')
        const weekTotals = {}
        for (const { key } of days) for (const c of TRACKED) weekTotals[c] = (weekTotals[c] || 0) + (save.days[key]?.time?.[c] || 0)
        const yourself = weekTotals.code + weekTotals.ai > 0 ? Math.round((weekTotals.code / (weekTotals.code + weekTotals.ai)) * 100) : null
        const weekNote = yourself === null ? '' : `<div class="note">this week ${yourself}% of your coding time was without AI.</div>`

        const entries = Object.values(save.unsorted).sort((a, b) => b.seconds - a.seconds)
        const sortButtons = (key) =>
          Object.entries({ code: 'code', learn: 'learn', ai: 'AI', distract: 'distr.' })
            .map(([c, short]) => `<button class="btn" data-action="sort" data-id="${encodeURIComponent(key)}" data-cat="${c}" title="${CATEGORIES[c].name}">${short}</button>`)
            .join('') + `<button class="btn" data-action="sort" data-id="${encodeURIComponent(key)}" data-cat="other">skip</button>`
        const unsorted = entries.length
          ? entries
              .map(
                (e) => `<div class="item" style="display:block"><b>${escapeHtml(e.label)}</b>
                <span class="small">${e.site ? escapeHtml(e.app) + ' · ' : ''}${fmtDur(e.seconds)} so far</span>
                <div class="sort">${sortButtons(e.key)}</div></div>`,
              )
              .join('')
          : '<div class="note">nothing to sort. Zaif knows all your windows.</div>'

        return `<div class="group">today</div>${rows}${extras}
          <div class="group">this week</div>${week}${weekNote}
          <div class="group">where does this go?</div>
          <div class="note">windows Zaif doesn't recognise. sort them once and Zaif remembers. "skip" counts it as other.</div>
          ${unsorted}`
      },
    },

    shop: {
      title: 'Shop',
      html: ({ save }) => {
        const tabs = ['furniture', 'outfit', 'wallpaper']
          .map((t) => `<button class="btn ${shopTab === t ? 'on' : ''}" data-action="tab" data-id="${t}">${t}</button>`)
          .join('')
        const owned = new Set(save.owned)
        const items = SHOP.filter((i) => i.kind === shopTab)
          .map((item) => {
            let button
            if (!owned.has(item.id)) {
              button = `<button class="btn primary" data-action="buy" data-id="${item.id}" ${save.coins < item.price ? 'disabled' : ''}>${coin(item.price)}</button>`
            } else if (item.kind === 'furniture') {
              button = '<button class="btn" disabled>owned</button>'
            } else {
              const using = save.outfit === item.id || save.wallpaper === item.id
              button = using
                ? '<button class="btn on" disabled>using</button>'
                : `<button class="btn" data-action="equip" data-id="${item.id}">use</button>`
            }
            const desc = item.desc || (item.kind === 'outfit' ? 'a new look for zaif.' : 'repaint the room.')
            return `<div class="item"><div><b>${item.name}</b><span class="small">${desc}</span></div>${button}</div>`
          })
          .join('')
        return `<div class="tabs">${tabs}</div>${items}`
      },
    },

    break: {
      title: 'Break',
      html: ({ rt }) => {
        if (rt.mode === 'rest') {
          return `<div class="big-time">${fmtTime(rt.restEndsAt - rt.now)}</div>
            <div class="note">Zaif is wandering around the room. typing won't count until the break is over.</div>
            <button class="btn" style="width:100%" data-action="end-break">End break now</button>`
        }
        const choices = BREAK_LENGTHS.map(
          (m) => `<button class="btn primary" data-action="start-break" data-id="${m}">${m} min</button>`,
        ).join('')
        return `<div class="note">step away for a bit. Zaif wanders the room and refills energy. when the time's up, Zaif goes back to the desk and waits for you.</div>
          <div class="choices">${choices}</div>`
      },
    },

    settings: {
      title: 'Settings',
      html: ({ save, rt }) => {
        const s = save.settings
        const sizes = [2, 3, 4]
          .map((n) => `<button class="btn ${s.scale === n ? 'on' : ''}" data-action="scale" data-id="${n}">${n}x</button>`)
          .join('')
        const toggle = (action, on) => `<button class="btn ${on ? 'on' : ''}" data-action="${action}">${on ? 'on' : 'off'}</button>`
        const keys =
          rt.keySource === 'global'
            ? 'counting keys in every app (X11). only the count is kept, never which keys.'
            : "counting keys only while this window is focused. global counting needs X11 and the 'xinput' command."
        return `<div class="item"><div><b>Size</b></div><div class="tabs" style="margin:0;flex:none">${sizes}</div></div>
          <div class="item"><div><b>Sound</b></div>${toggle('sound', s.sound)}</div>
          <div class="item"><div><b>Always on top</b></div>${toggle('on-top', s.onTop)}</div>
          <div class="note">${keys}</div>
          <button class="btn" style="width:100%" data-action="quit">Quit Zaif</button>`
      },
    },
  }

  function renderSheet(force = false) {
    if (!sheet) return
    const html = sheets[sheet].html(state())
    if (force || html !== lastSheetHtml) {
      $('sheet-body').innerHTML = html
      lastSheetHtml = html
    }
  }

  function open(name) {
    sheet = name
    $('sheet-title').textContent = sheets[name].title
    $('sheet').hidden = false
    renderSheet(true)
  }

  function close() {
    sheet = null
    $('sheet').hidden = true
  }

  // ---------------------------------------------------------- events

  document.querySelectorAll('[data-sheet]').forEach((el) => {
    el.addEventListener('click', () => open(el.dataset.sheet))
  })
  $('sheet-close').addEventListener('click', close)
  $('btn-min').addEventListener('click', () => window.zaif.minimize())
  $('btn-close').addEventListener('click', () => actions.quit())
  $('toggle-panel').addEventListener('click', () => actions.togglePanel())

  $('sheet-body').addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]')
    if (!el || el.disabled) return
    const id = el.dataset.id
    switch (el.dataset.action) {
      case 'project':
        actions.pickProject(id)
        break
      case 'upgrade':
        actions.buyUpgrade(id)
        break
      case 'tab':
        shopTab = id
        break
      case 'buy':
        actions.buyItem(id)
        break
      case 'equip':
        actions.equip(id)
        break
      case 'sort':
        actions.sortUnsorted(decodeURIComponent(id), el.dataset.cat)
        break
      case 'start-break':
        actions.startBreak(Number(id))
        close()
        return
      case 'end-break':
        actions.endBreak()
        close()
        return
      case 'scale':
        actions.setScale(Number(id))
        break
      case 'sound':
        actions.toggleSound()
        break
      case 'on-top':
        actions.toggleOnTop()
        break
      case 'quit':
        actions.quit()
        return
    }
    renderSheet(true)
    renderPanel()
  })

  function pulse(sheetName) {
    const el = document.querySelector(`.buttons [data-sheet="${sheetName}"]`)
    if (!el) return
    el.classList.remove('pulse')
    void el.offsetWidth // restart the animation
    el.classList.add('pulse')
  }

  return {
    render() {
      renderPanel()
      renderSheet()
    },
    open,
    close,
    pulse,
  }
}
