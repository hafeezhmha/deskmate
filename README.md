# deskmate

A desktop companion for coding and learning.

The little pixel guy in it is Zaif. He lives in the corner of my screen and wants to build an operating system. He has the attention span of a goldfish, so he only writes code when I type.

I made this because I've been handing more and more of my coding to AI and could feel myself getting worse at it. So Zaif keeps an eye on what kind of work I'm actually doing: writing code myself, learning (docs, courses, tutorials), coding with AI, or watching YouTube and calling it research. He reacts to all of it, and at the end of the week I get an honest split of where my time went.

## running it

```sh
npm install
npm start
```

I don't autostart it. It lives in my dock and I open it when I sit down to actually work:

```sh
npm run install-launcher
```

That adds it to the app menu and pins it to Plank if you use Plank (other docks: just pin "deskmate" from the menu). Clicking it while it's already open brings Zaif back instead of starting a second one. The icon is drawn from his sprite; `npm run icon` redraws it if you change his look.

You need Linux on X11 and `xinput`. On Wayland it still runs, but it can only count keys while its own window is focused, because Wayland won't let apps see keys aimed at other windows. The panel footer says "this window only" when that's happening.

## how I use it (read this when you forget)

**starting**
- [ ] open Zaif from the dock. that means work mode. don't open him "just to have him open"
- [ ] pick a project, or keep the one he's on

**the loop**
1. **learn**, ~25 min. docs or a course. scrolling counts, so actually read
2. **code**, ~45 min. use the thing you just read. write some of it yourself, no AI
3. **hit Break.** stand up. when Zaif starts nagging, go back. don't close him
4. repeat. normal work with Claude is fine, it's tracked

**rules**
- Zaif on his phone = you're distracted too. close the tab, don't argue
- he says his brain is soup = take the break
- Claude wrote something = read the diff and explain it in one sentence. can't? rewrite the hard part yourself
- code you want counted as yours goes in the editor, not a terminal with an agent running in it

**end of day** (2 min)
- [ ] Today → sort the unsorted stuff
- [ ] look at the split. does it match your day?
- [ ] close Zaif

**fridays**
- week goals: which ones are still empty? two days left, go
- learning time steady, or did it die on wednesday?
- coding without AI: keep it above 30%
- find the distracted day, figure out why, change one thing

## how it works

- Pick a project in **Projects**. Start with the todo app. Everyone starts with the todo app.
- Work. About 35 key presses = 1 line of Zaif's code, but it depends where you type (see below). Shift/ctrl/alt don't count, and neither does holding a key down, so don't bother.
- Finish a project and you get coins. He immediately starts on v2, because of course he does.
- Spend the coins on upgrades (type faster, unlock bigger projects) or stuff for the room.
- Energy drops while you type. Under 35% he asks for a break (click the yellow bubble). At 0 he writes at half speed, same as me.

### mail

Ship a project and a few seconds later a paper plane flies in through the window with a letter. You don't know what's in it until you finish something, which is the whole point.

Could be fan mail, GitHub stars, a bug report, a recruiter offering exposure, the newsletter, your mom asking if you're eating, a hackathon prize, or a box with furniture in it. Two things in the game only ever come by mail. Bigger projects get better mail.

Open it with the envelope next to your coins, or click the letters on Zaif's desk. Gifts sit in the letter until you hit "take it".

### week goals

Five goals, reset every monday. They tick themselves, you just do the work:

- ship 3 projects
- learn for 5 hours
- code 3 hours without AI
- take a real break on 4 days
- show up on 5 days (30+ min of actual work)

Each one is +40 coins. All five gets +250 and a trophy on Zaif's wall shelf. The pips in the today card show where you're at. Goals only count up, so nothing unticks itself on thursday because you had a bad day. Want different targets? They're in `GOALS` in `data.js`.

Leave him alone and he gets distracted: phone after 45 seconds, asleep after 4 minutes. Click him and he says something.

### what counts as what

Zaif checks which window you're in every second or so (app name + window title; for browsers that's the page title). That gives one of:

- **coding**: editors and terminals. Full speed.
- **learning**: docs sites, MDN, Stack Overflow, GitHub, course sites, and YouTube when the title says tutorial/course/etc. Scrolling counts here, so reading the Rust book for an hour counts even if you never type. Learning time levels up **Knowledge**, which makes every project pay more. You can't buy it.
- **with AI**: a terminal with Claude Code or Codex running in it, or claude.ai/ChatGPT in the browser. Typing counts at half speed. The monitor turns into a chat.
- **distracted**: YouTube (the rest of it), Reddit, X, Instagram, Netflix... Zaif pulls out his phone too. He's not judging. He's joining.
- **other**: everything else. Doesn't move the project, doesn't count against you.

Accepting an AI autocomplete in your editor is one Tab press for maybe 20 lines, so it's worth basically nothing. That's on purpose. Keys in the editor ≈ code you actually wrote.

Terminal tabs: Zaif can't see which tab you're in, so if an agent is running in *any* tab, everything typed in that terminal counts as "with AI". Close enough. Learning site not on the list? It shows up in the unsorted list, tap "learn" once.

Windows Zaif doesn't recognise go into **Today → where does this go?**. One tap each (code / learn / AI / distr. / skip) and he remembers. Do it once a day for a few days and it fits you. Your rules live in `save.json` under `rules` if you want to edit them by hand.

Click the **today** card for today's split, the last 7 days, and how much of your coding was without AI this week.

### breaks

This one's my favourite. Hit **Break** and pick 5 to 25 minutes. Zaif gets up and wanders around: grabs a cola from the fridge, naps on the couch, waters the plant, stares out the window. Anything you buy in the shop gets used too. The duck gets your bugs explained to it, the arcade gets played, that sort of thing.

Typing during a break doesn't count (he'll tell you off). When time's up he sits back down and waits. Then he taps his foot. Then he drums on the desk. Then he starts waving and yelling at you. It stops the second you start typing again.

The window is draggable from the top edge of the room or the panel header. `≡` in the room's top-right corner hides the panel when you want just the little guy.

## is it a keylogger

Kind of, but not really. `src/main/input.js` runs `xinput test-xi2 --root` and counts key presses and mouse/scroll events. The key code gets looked at for exactly one line (to skip modifiers and repeats) and then thrown away. Only counts are saved.

Window titles are read every 1.5s to pick a category and are not saved. The exceptions: for unsorted browser pages it keeps the site part of the title (like "Google Search"), and titles of learning pages are stored as hashes just to count them. Nothing goes over the network. Read the files, they're short.

Save lives in `~/.config/deskmate/save.json`.

## where stuff is

```
src/main/main.js       window, save file, screenshot mode
src/main/input.js      counts keys and mouse/scroll
src/main/window-watch.js  which window you're in, and whether an AI agent runs in it
src/main/preload.js    the few functions the window is allowed to call
src/renderer/data.js   every number and every line Zaif says. tweak here
src/renderer/categories.js  default rules for what counts as code/learning/AI/distracted
src/renderer/art.js    all the pixel art, drawn with rectangles. no image files
src/renderer/game.js   state, typing, breaks, nagging, the main loop
src/renderer/ui.js     the side panel
src/renderer/sound.js  bleeps
src/renderer/icon.*    draws the dock icon
scripts/install-launcher.sh  app menu + Plank dock
```

Want a new break activity? Add a spot to `SPOTS` in `data.js`, give it a pose in `actPose()` in `game.js`, and draw the furniture in `art.js` if it needs any.

## screenshots without opening a window

I got tired of launching the app to check a sprite, so there's a snapshot mode:

```sh
DESKMATE_DATA_DIR=/tmp/deskmate-test npx electron . --snapshot=out.png --scene=work+all+night
```

Join scene parts with `+`: `work` `ai` `reading` `doomscroll` `phone` `asleep` `tired` `tap` `nag` `cheer` `project` `rich` `all` `week` (fake history) `trophies` `perfect` (finishes the week's goals) `mail` (one of every letter) `ship` `letter` `claim` `day` `dusk` `night` `rest-<spot>` (like `rest-couch`) `sheet-<name>` (like `sheet-goals`) `scrolldown` `outfit-<id>` `wall-<id>`. `--crop=x,y,w,h` zooms in. `DESKMATE_DATA_DIR` keeps it away from your real save.

## next

- **code reviews, by mail.** Hooks log every edit the AI agent makes. Some of them come back as letters ("a user opened an issue: what does this function do?") with the real diff attached. I explain it, an LLM grades me, and that's the only way to raise Zaif's Quality stat.
- **git credit.** Extra coins for commits I wrote myself (commits minus whatever Claude wrote).
- **quizzes on stuff I read.** Learning time is a proxy. A two-question check on a docs page I spent 20 minutes on would be the real thing.

MIT licensed. Do whatever.
