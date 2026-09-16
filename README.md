# Invoker Lab

Arsenal Magus is hard to learn, harder still to master.

```bash
npm install && npm run dev
```

## Bindings

Ships on `E R T · W` with slots on `D` and `F`. Two other presets are built in
(Dota default `Q W E · R`, and a Space-invoke variant), and every action can be
rebound by clicking it and pressing a key.

Bindings are stored as **physical key codes** (`KeyboardEvent.code`), never as
characters — the same thing Dota does. Consequences worth knowing:

- A bind is a key *position*, so it survives a layout switch.
- Mouse buttons 3, 4 and 5 are bindable through the same namespace (`Mouse4`).
  Left and right stay with the UI.
- Where Chromium exposes `navigator.keyboard.getLayoutMap()`, caps show the
  viewer's real legend; elsewhere they fall back to the US label.
- Rebinding **swaps** on a conflict rather than rejecting, so you can never
  strand yourself with a half-configured layout.

`Escape` clears orbs and cancels a rebind. `Space` starts and stops a drill,
unless you have bound it to something.

## The model

Three pieces, all in `src/engine/`, all pure and free of React:

**Orbs** (`orbs.ts`) are a FIFO of three — a fourth pushes the oldest out. Only
the multiset matters, never the order, so Quas-Quas-Wex and Wex-Quas-Quas are
both Ghost Walk. `minOrbPresses` brute-forces every sequence of length 0..3 to
find the cheapest route from where you stand to a target's reagents.

**Slots** (`slots.ts`) model both invoked-spell slots. A newly invoked spell
always lands in slot 1 and pushes the previous occupant down; invoking something
already sitting in slot 2 promotes it instead of duplicating it. Casting does
*not* clear a slot — the spell just goes on cooldown.

**Par** (`parFor`) is the consequence of those two, and the whole point of the
app: orb presses + invoke + the one cast press. If the target is already loaded,
par is **1**, and re-invoking it is pure waste. Recognising that is the skill the
drill is built to teach.

## Modes

| Mode | Trains | Scored on |
| --- | --- | --- |
| Streak | One spell at a time, no per-spell pressure | Spells landed |
| Combos | Chains of 2–4 spells in order; the chain counts only when all of it lands | Chains completed |
| Professional | The same chains, judged against the shortest route through the whole sequence | % of chains routed perfectly |
| Rapid Fire | A 1/2/3-second shot clock per spell; timing out or casting wrong both break the run and move straight on | Longest unbroken streak |
| Practice | Sandbox, untimed, nothing recorded | — |

**The weakness filter is a modifier, not a mode.** `Spell pool: All 10 / Weakest 6`
sits in every mode's brief and narrows the draw to the spells you are worst at.
Ranking puts never-cast spells first — untested is exactly the gap a weakness
drill exists to close — then sorts by accuracy, then by slowness.

Every timed mode runs 60 / 120 / 180 seconds and adds two seconds per landed
spell, so a good run extends itself.

**A spell never comes up twice in a row** — not within a chain (it would be on
cooldown) and not across the seam between one chain and the next. Every spell
stays in the pool otherwise.

Efficiency is binary per cast: you either reached the spell by the shortest key
route from where you stood, or you did not. When you did not, the verdict names
the route that would have worked, in your own keys — `T W D was enough`.

Each mode explains itself in the arena whenever a drill is not running: goal,
the three-step loop, how it is scored, and what ends it. The length picker sits
in that same panel and is deliberately unavailable mid-drill — changing the
clock during a run would make the score meaningless. Choices persist per mode.

The Grimoire's right-hand column has two views:

- **Cost** — live orb presses to reach each spell *from the reagents you are
  holding right now*, or the slot key when it is already invoked and one press
  away.
- **Stats** — lifetime average chain time and accuracy per spell, with the best
  and weakest named at the top once three attempts have been logged. Accuracy is
  colour-tiered (≥90% / ≥70% / below), so weak spells are findable at a glance.

`Reset stats` at the foot of the Stats view wipes lifetime history. It takes two
clicks and leaves your bindings alone.

## Deploying

`npm run build` emits a static `dist/`. The included workflow publishes it to
GitHub Pages on every push to `main`.

`vite.config.ts` sets `base` to `/<REPO>/` only under GitHub Actions, because a
Pages project site serves from a subpath while dev and a desktop build serve
from the root. **Rename `REPO` in that file if the repository is not called
`InvokerLab`** — a wrong `base` is a white page with 404'd assets, and it is
the cause essentially every time.

Pages from a private repo needs a paid GitHub plan.

### Desktop

Tauri wraps this same frontend without a rewrite — `npx tauri init`, point
`frontendDist` at `../dist`, and the always-on-top window can sit beside Dota.
Not set up yet.

## Not done yet

- **Sound.** The largest single upgrade available. Schedule it on
  `AudioContext.currentTime`, not DOM events.
- **Combo chains** — Meteor → Blast → Sun Strike as one scored sequence.
- **Slot Discipline mode** — targets drawn so that parking the right spell pays
  off, which is what pre-invoking actually is.
- **Cast points and cooldowns.**
- **Deeper history.** `localStorage` holds lifetime totals per spell (hits,
  misses, total and best time, presses wasted). Per-attempt rows — enough for
  a distribution or a trend over weeks — want IndexedDB.
- **Weakest-spell drilling.** The stats already identify your worst spell;
  nothing yet biases the target draw toward it.
- **Tests.** `src/engine/` is pure and was built to be unit tested; nothing is
  wired up yet. `minOrbPresses` and `invokeInto` are where the bugs would hide.

## Icons

Drop image files into `src/assets/icons/` and they are picked up at build time
by filename — no code change. Anything absent falls back to a built-in SVG
glyph tinted by the spell's dominant reagent, so a half-filled folder is a
perfectly valid state.

Names are matched case-insensitively with punctuation ignored, and both the
short spell id and the full spell name work:

```
quas  wex  exort  invoke
coldsnap  ghostwalk  icewall  emp  tornado
alacrity  sunstrike  forge_spirit  chaos_meteor  deafening_blast
```

So `meteor.png` and `Chaos Meteor.jpg` both resolve to Chaos Meteor. Accepted
extensions: png, jpg, jpeg, webp, avif, gif, svg.

They live under `src/` rather than `public/` on purpose: Vite content-hashes
them for cache-busting and rewrites their URLs for the GitHub Pages subpath
automatically. A file under 4 KB gets inlined as a data URI instead of emitted
separately — both work, so don't be alarmed when a small icon is missing from
`dist/assets/`.

The repository ships no artwork of its own beyond the SVG glyphs, which are
original geometric marks. Whatever you put in that folder is yours to clear —
worth a thought before pushing a public deployment, since Dota's spell icons
belong to Valve.
