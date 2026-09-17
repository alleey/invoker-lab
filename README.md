# Invoker Lab

Arsenal Magus is hard to learn, harder still to master. Try it yourself

https://alleey.github.io/invoker-lab/

```bash
npm install && npm run dev
```

## Hotkeys

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


## Not done yet

- **Sound.** The largest single upgrade available. Schedule it on
  `AudioContext.currentTime`, not DOM events.
- **Cast points and cooldowns.**
- **Deeper history.** `localStorage` holds lifetime totals per spell (hits,
  misses, total and best time, presses wasted). Per-attempt rows — enough for
  a distribution or a trend over weeks — want IndexedDB.
