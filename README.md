# Study Tracker

A study dashboard that runs on your own machine. Log study sessions, keep every
course link / book / notebook in one place, watch a calendar fill in over
months and years, and grow a wheel of every topic you have actually studied,
threaded back to one centre.

No account, no internet, nothing uploaded, nothing to install. Your log is a
file in the repo — clone it, open one file, and it is all there.

```
Study Tracker/
├── index.html                  ← the whole app. Open this. That's it.
├── data/
│   └── study-data.js           ← your log, committed with the repo
├── README.md                   ← this file
├── serve.py                    ← optional; only if you want an http:// origin
├── build.py                    ← rebuilds index.html from src/ (only if you edit the code)
├── Study Routine AV - Dashboard.csv   ← the CSV the starter list came from
└── src/                        ← the source index.html is built from
    ├── app.css
    ├── index.template.html
    └── js/*.js
```

---

## 1. Quick start

1. Clone or copy the repo anywhere on your machine.
2. Open **`index.html`** — double-click it. No server, no terminal, no install.
3. If `data/study-data.js` already holds a log, it is loaded straight away. On a
   fresh clone the welcome screen asks three things:
   - your name (optional, just for the greeting),
   - your usual session length in minutes (the default in the log form),
   - your daily goal in minutes (0 = no goal ring).
4. Then pick how to start: **the starter list** (the 11 courses from the CSV in
   this folder), **your own CSV** (§8), or **empty**.

**Daily loop:** press <kbd>L</kbd> (or **Log a session**), pick the course, set
sessions and minutes, tick the topics you covered, press Enter. Two seconds.

### Letting the app write the data file (one click, once)

Your log is `data/study-data.js` — an ordinary file in the repo, so it commits,
pushes, pulls and diffs like anything else. Browsers will not let a web page
write to disk unasked, so grant it once:

> **Data & Backup → Connect data file** → pick `data/study-data.js` in this
> folder → allow saving.

From then on every change is written into that file as you work — no command, no
server. Chrome, Edge and Arc support this. The browser may ask you to confirm
write access again after you quit and reopen it; the Data page shows **Allow
writing again** when that is the case, and the sidebar says *"Unsaved to the repo
file"* until you do.

**Safari and Firefox** cannot write files in place. There the same page offers
**Download data file** — you get `study-data.js` and drop it into `data/`,
replacing the old one. One drag, whenever you want to commit.

Either way nothing is at risk in the meantime: every change is also written to
the browser's own storage the instant you make it, and whichever copy is ahead
is the one you get back.

### Working across machines

Commit `data/study-data.js` and push. On the other machine, pull and open
`index.html` — the app notices the file is a version it has not seen and loads
it. If that browser had a log of its own, it is **not** thrown away: it is kept
and offered back on the Data page ("A superseded copy is being held"), so a
stale commit or a wrong clock can never eat your work.

There is nothing else to sync, and no merge: the file is the record. Log on one
machine at a time and it stays simple.

### Optional: run it on localhost

Only if you specifically want an `http://` origin — for example to open the app
on your phone over the same Wi-Fi:

```bash
python3 serve.py
```

```bash
HOST=0.0.0.0 python3 serve.py
```

The app behaves identically; on a phone you would use **Download data file** to
update the repo copy.

---

## 2. The pages

| Page | What it's for |
|---|---|
| **Dashboard** | Today: goal ring, streak and totals, then the same numbers drawn — a two-week bar chart, a time-by-course donut with legend, and a weekly trend line — plus the quick-log form, today's sessions, a 30-day strip, deadline warnings and every course's progress bar. |
| **Log & Calendar** | Month grid (colour = minutes studied, dots = which courses), click a day to see/add/edit its sessions, a GitHub-style year heatmap, and a **month-by-month table of every month you have ever studied**. |
| **Classroom** | Your courses. Class/playlist link, progress, topics, deadline, and the completed/extend/drop decision. Add, edit, remove — nothing is fixed to the CSV. |
| **Resources** | Books, PDFs, playlists, sheets, folders — on the web, in OneDrive/Drive/Dropbox, or a path on this machine. Filter by course, type, status; cycle *to read → in progress → finished*. |
| **Notebooks** | Links to your notes wherever they live: Obsidian, Notion, OneNote, Evernote, Apple Notes, Logseq, GoodNotes, Google Keep, or a local folder. |
| **Brain Map** | The wheel of subjects and topics around a centre pivot (§5). |
| **Statistics** | Totals, streaks, 14-day / 12-week / month-by-month charts, weekday shape, donuts for time by course and by topic, per-course pace + projected finish, most-studied topics. |
| **Data & Backup** | Export/restore, CSV import/export, preferences, erase. |

Keyboard: <kbd>L</kbd> log · <kbd>P</kbd> start/pause timer · <kbd>C</kbd>
calendar · <kbd>M</kbd> brain map · <kbd>T</kbd> theme · <kbd>?</kbd> shortcuts
· <kbd>Esc</kbd> close a dialog. In the log form <kbd>Enter</kbd> saves.

### How it looks

The app is drawn like a drawing, not styled like a dashboard: the page sits on
graph paper, panels are drafted frames with corner ticks, section heads are
dimension lines with end ticks, fills are hatched rather than flat, and the
charts and map carry a light hand-drawn wobble. Type stays the *ekitabein* book
serif throughout.

Two themes, switched with the button under the nav or <kbd>T</kbd> (remembered):

- **paper** (default) — whiteprint: dark ink and indigo on a pale sheet;
- **blueprint** — the classic cyanotype: pale lines on deep blue.

Deliberately there are **no emoji and no icon glyphs anywhere**. Controls are
words ("Edit", "Remove", "Spin"), state is a small-caps tag, and each course is
identified by a small colour square from a printerly palette (lifted toward the
light automatically on the blueprint ground). If you add to the app, keep it
that way.

The top bar is deliberately almost empty on a desktop — only the Pomodoro
timer, which is the one control that belongs in every view. On a phone it also
carries a **Log a session** button, since the form itself is a scroll away.

---

## 3. How a session is recorded

One logged session holds:

| Field | Notes |
|---|---|
| Course | required |
| Date | defaults to today; any past date works |
| Sessions / lectures | the *count* — how many lectures/chapters you finished (preset chips 1/2/3/5) |
| Minutes | the *time* (chips 15/25/45/60/90/120) |
| Topics | any of the course's topics; drives the brain map |
| Note | optional, e.g. "finished Ch.4 problems" |

Two numbers on purpose: **count** drives course progress (`18 / 90 sessions`)
and **minutes** drive all the time statistics. A course with
`Total sessions = 0` is untracked — you just log time against it.

Both number fields have big minus/plus steppers and preset chips, so a normal
entry is two clicks and Enter. Every session can be edited or deleted later
(Edit on any session row, on the Dashboard or in the day panel of the
calendar). Adding a topic mid-entry happens inline — it never opens a dialog
over a half-filled form.

The form can be on screen twice (inline on the Dashboard, and in the pop-up
opened by <kbd>L</kbd> / the calendar / the map). It always saves the fields you
are actually looking at: the form is resolved from the button you clicked, and
if it cannot be resolved the save is refused with a message rather than writing
default values. Check the toast after saving — it repeats the minutes and the
course's new total.

**Already partway through a course?** Set *"Already finished before today"* on
the course. Progress then starts where you actually are, without inventing
fake history. (The CSV import does this for you from the `Remaining` column.)

---

## 4. Deadlines: completed / extend / drop

A deadline is always optional. Every course card has **Set a deadline**, with
quick +14/30/60/90/180-day buttons, and it tells you the pace that implies
("that is 1.2 sessions/day for 60 days").

Once a deadline exists:

- the Dashboard warns you from 7 days out, overdue in red;
- **when the date arrives** (or when you finish the last session of the target)
  the app asks the only question that matters:
  - **Completed** — moves it to the Completed list, history kept,
  - **Extend** — pick a new date; extensions are recorded and shown on the
    card (`Extended 2× (was 15 Aug)`),
  - **Drop** — off the active list, all history kept,
  - or *Ask me later* — it asks again tomorrow, not every reload.
- Statistics shows *pace needed* vs *your actual 3-week pace* and a
  **projected finish date**, marked `x days early` / `x days late`.

Completed and dropped courses can be reopened at any time.

---

## 5. The brain map

`Brain Map` is a wheel around one centre pivot — you, and everything you study:

- **Points** — every subject and every topic is a point on a single outer
  circle. Each subject owns a contiguous arc: its own point in the middle, its
  topics either side, with a dimension bracket and the subject name outside.
- **Growth** — a point grows with every session logged against it
  (`√ sessions`). Topics you have never started stay small and **hollow**, so
  the wheel visibly fills in over a term.
- **Threads**
  - every point is tied back to the pivot with a curved thread; the control
    point is swung round, which is what gives the wheel its spin,
  - **topics studied in the same session are tied to each other** with chords
    that bow through the middle — thicker the more often that pairing repeats,
  - dashed hairlines join the same topic name in two different subjects
    (e.g. `Probability` in both Stat and Disc Math).
- **Reading it** — zoomed out the wheel is just dots. Zoom in and the subject
  names appear; zoom further and the topic names do (with their session counts).
- **Interaction** — **hover any point to isolate it**: everything else fades and
  only that point's threads, its subject and its related topics stay drawn.
  Drag to pan, scroll or the buttons to zoom, **Fit** to re-centre, **Spin** for
  a slow rotation, **Labels** to silence the names. Click (or tap) a point for
  its sessions, the topics it is usually studied with, and a *Log a session on
  this topic* button. Touch works the same way — tap to highlight, tap to open.

So the map is a by-product of honest logging: tick the topics you actually
covered and it draws itself. Plain canvas 2D, no libraries.

### Where topics come from

Topics (a.k.a. categories) are asked for **per course**, when you create it:
type your own, or click the suggestions the app offers for that subject (it
recognises maths, stats, CFA, Python, quant finance, DBMS, discrete maths, web
dev, Spanish, NISM, and falls back to a generic set). You can add one mid-log
too — **add topic** in the log form. Keep them idea-sized ("Regression",
"Normalisation"), not lecture-sized.

---

## 6. Pomodoro timer

The timer lives in the top bar on every page; ⚙ opens the panel.

- Configurable focus / short break / long break, and long-break-every-N.
- It stores an **end time**, not a countdown — switch pages, or reload, and it
  is still right. If it finishes while the tab is in the background it catches
  up and tells you.
- Chime (WebAudio) + a desktop notification if you grant permission.
- **Working on** — pick a course and each finished focus block is logged
  automatically: its minutes always, and +1 session if *"count each block as 1
  session"* is on. Turn auto-log off and you get a *Log it* button on the
  finish toast instead.

---

## 7. Your data, and backups

The record is **`data/study-data.js`**, in the repo. It is a small script that
sets `window.STUDY_DATA` — a `.js` file rather than `.json` precisely so
`index.html` can load it with a `<script>` tag, which works even when the page
is opened straight from disk (fetching a sibling file is blocked there).

- **Connected** (Chrome/Edge/Arc, after one click) — every change is written
  into that file as you work.
- **Not connected** — changes live in the browser and **Download data file**
  gives you the version to drop into `data/`.
- Either way the browser copy is written on every change, so nothing is lost
  between file writes. At startup whichever copy is ahead wins, and if the file
  wins while the browser held different work, that work is stashed and offered
  back rather than dropped.

Version history is your repo: `git log data/study-data.js`, and `git checkout`
any earlier version to roll back a bad day.

On top of that, the Data page gives you:

- **Export backup (.json)** — a full snapshot; restore replaces or merges (merge
  skips anything already there, matching sessions by id and courses by name).
- **Sessions (.csv)** — `date, course, sessions, minutes, topics, note`, one row
  per session, for Excel/Sheets.
- **Courses (.csv)** — same shape as the import format, so it round-trips.

---

## 8. CSV import format

**Classroom → Import CSV** (or Data & Backup → Import courses from CSV) takes a
file or pasted rows. The only required column is **Subject** (or `Course` /
`Name`). The header row may sit anywhere near the top, and leading empty
columns are fine — the CSV in this folder has both.

| Column | Meaning |
|---|---|
| `Subject` / `Course` / `Name` | course name (required) |
| `Course Link` / `Link` / `Playlist` | class or playlist URL |
| `Resources` / `Materials` / `Folder` | becomes a linked resource entry |
| `Total Sessions` / `Total` | session target |
| `Remaining` / `Left` | used to back out what you've already done |
| `Deadline` / `Due` | `YYYY-MM-DD` |
| `Topics` / `Categories` | separated by `;` or `|` |

Example:

```csv
Subject,Course Link,Resources,Total Sessions,Remaining,Deadline,Topics
Statistics,https://youtube.com/playlist?list=…,https://onedrive…,70,64,2026-12-01,Probability; Regression; ANOVA
Discrete Math,https://youtube.com/playlist?list=…,,61,61,,Sets; Logic; Graph Theory
```

Importing again later updates existing courses by name (tick the checkbox)
rather than duplicating them.

---

## 9. Resources and notebook links

Anything that has a URL or a path can go in. The app never opens or reads the
file itself — it stores a link and hands it to your OS/browser.

- **Web** — normal `https://…` links.
- **Cloud** — OneDrive / SharePoint / Google Drive / Dropbox share links work as-is.
- **On this machine** — paste `/Users/you/Books/ISL.pdf`, `~/Books`, or
  `C:\Books\ISL.pdf`; it's turned into a `file://` link. Local links open when
  you launched `index.html` directly from the folder. If you're running through
  `serve.py`, browsers block `file://` navigation from an `http://` page — use
  **⧉ Copy link** and paste it into a new tab.
- **Notebooks** — deep links open the desktop app, https links open the web
  version. How to get the link:

  | App | Where the link comes from |
  |---|---|
  | Obsidian | right-click a note → *Copy Obsidian URL* (`obsidian://open?vault=…&file=…`) |
  | Notion | page → ••• → *Copy link* |
  | OneNote | right-click the page → *Copy Link to Page* (`onenote:…` / `1drv.ms/…`) |
  | Evernote | note → ••• → *Copy internal link* (`evernote:///view/…`) |
  | Apple Notes | note → Share → *Copy Link* |
  | Logseq | page → ••• → *Copy page URL* |
  | GoodNotes / Keep | Share → *Copy link* |
  | Local folder | any path, e.g. `/Users/you/Notes/Stats` |

Link several notebooks and the Notebooks page groups them, with a per-course
roll-up once there are more than three. Every course card also links straight
to its own resources and notebooks.

---

## 10. Editing the app

`index.html` is **generated**. Edit the sources, then rebuild:

```bash
python3 build.py
```

That inlines `src/app.css` and every `src/js/*.js` (in filename order) into
`src/index.template.html` and writes `index.html`. No dependencies, no network,
nothing to install. Editing `index.html` directly is fine for a quick preview —
but the next build overwrites it, so mirror anything you want to keep into
`src/`.

| File | Contains |
|---|---|
| `src/js/00-core.js` | state, storage, date helpers, derived stats, `PALETTE`, `NOTE_APPS`, `RES_TYPES`, `TOPIC_HINTS`, `STARTER_COURSES` |
| `src/js/10-log.js` | quick-log form, topic picker, session edit/delete |
| `src/js/20-dashboard.js` | dashboard, goal ring, deadline warnings |
| `src/js/30-classroom.js` | course CRUD, deadline dialogs |
| `src/js/40-calendar.js` | month grid, day panel, year heatmap, monthly table |
| `src/js/50-resources.js` | resources page, local/cloud link handling |
| `src/js/60-notebooks.js` | notebook links |
| `src/js/03-store.js` | where the record lives: reads `data/study-data.js`, writes it back through the File System Access API (or a download), and keeps a superseded copy recoverable |
| `src/js/05-charts.js` | the drawn charts: hatched bars, donut + legend, trend line, and the hand-drawn filter |
| `src/js/70-map.js` | brain map: wheel layout, threads, hover isolation, canvas render |
| `src/js/80-stats.js` | statistics page (pace, projections, distributions) |
| `src/js/90-pomodoro.js` | timer widget |
| `src/js/95-data.js` | first-run setup, CSV import, backup/restore |
| `src/js/99-boot.js` | router, delegated `data-act` clicks, shortcuts, startup |

Conventions, if you extend it: pages render a string into `#view`; buttons
carry `data-act="name"` and the handler lives in `ACTIONS.name` (one delegated
listener does the rest); every mutation ends with `dbSave(true)` and `route()`.

### Knobs worth knowing

| Knob | Where | Effect |
|---|---|---|
| `PALETTE` | `00-core.js` | course colours, in assignment order — muted printerly hues that hold up on paper and on ink |
| `TOPIC_HINTS` | `00-core.js` | suggested topics per subject keyword |
| `STARTER_COURSES` | `00-core.js` | the "starter list" (name, link, resources, total, remaining) |
| `SCHEMA` | `00-core.js` | bump it and add a migration in `dbLoad()` when the stored shape changes (v2 re-inked old course colours) |
| `MAP_RING`, `mapSizeRing()` | `70-map.js` | wheel radius (smaller on a phone so names still fit) |
| `0.34` in `mapCentrePath()` | `70-map.js` | how far the threads swing — the wheel's spin |
| `showCourse` / `showTopic` | `mapDraw()` | the zoom levels at which names replace dots |
| `m` in `mapFit()` | `70-map.js` | screen pixels reserved for labels outside the ring |
| node radius formulas | `mapBuild()` | how fast points grow with sessions |
| `chartDefs()` | `05-charts.js` | hatch spacing/angle and the turbulence that makes strokes hand-drawn |
| `mapInk()` | `70-map.js` | the map reads its colours from the CSS tokens, so it follows the theme |
| token blocks | top of `app.css` | the whole palette: `:root` is paper, `:root[data-theme="dark"]` is ink. Old names (`--panel`, `--acc`, `--txt`…) are aliases kept for inline styles |
| `--serif` | `app.css` | the book face used everywhere, including canvas labels |
| `--grid`, `--grid-major` | `app.css` | the graph-paper ground (8px minor, 48px major) |
| `--squiggle` | `app.css` | the hand-drawn rule under page titles |
| `tone()` | `00-core.js` | how far course colours are lifted on the blueprint theme |
| `isNarrow()` | `00-core.js` | the breakpoint the charts use to thin out on a phone |
| `STORE.name` | `03-store.js` | the path of the committed data file |
| `storeQueue()` debounce | `03-store.js` | how long after a change the file is written (500 ms) |
| `storeChoose()` | `03-store.js` | which copy wins at startup — by *file version seen*, not by clock |
| `#map { height }` | `app.css` | map canvas height |

---

## 11. Troubleshooting

**My data vanished.** Check `data/study-data.js` in the repo first — if it has
your log, open the app and it will load it. If the app was never connected to
the file and the browser was cleared, the log was only in the browser: restore
your last `.json` export from the Data page, then connect the data file so this
cannot happen again.

**The sidebar says "Unsaved to the repo file".** Changes are in the browser but
not yet in `data/study-data.js`. Either **Allow writing again** (Chrome/Edge:
one click after reopening the browser) or **Download data file** and drop it
into `data/`.

**"A superseded copy is being held".** The file was a version this browser had
not seen — a pull, or a hand edit — so it was loaded, and the log this browser
was holding was kept rather than discarded. The card shows both; pick one.

**The file picker does not appear.** Safari and Firefox do not implement
in-place file writing. Use **Download data file** there, or open the app in
Chrome/Edge/Arc when you want it to write the file itself.

**Everything is tiny on my phone.** It shouldn't be — the layout switches to a
single column, the readings go two-up, the charts thin out (7 days instead of
14) and the map shrinks so the subject names still fit. If it looks like the
desktop layout, your browser is probably requesting the desktop site.

**The timer didn't chime.** Browsers block audio until you've interacted with
the page, and notifications need permission — click Start once in the panel.

**Two courses look duplicated after an import.** Names must match exactly for
the update path to kick in; delete the stray one (Classroom → 🗑) and re-import.

---

## 12. Note for AI assistants

Same rule as the sibling projects in this folder: **make minimal changes**.
This app is hand-tuned in places (map physics constants, label thresholds,
theme tokens). Don't refactor working code, don't add dependencies — it must
stay a single self-contained `index.html` built by `build.py` with plain
Python. Edit `src/`, rebuild, and update this README with anything you change.

Two house rules for the interface: it is set entirely in the book serif of the
*ekitabein* style sheet, and it contains **no emoji or icon glyphs** — label
controls with words. Don't reintroduce either.
