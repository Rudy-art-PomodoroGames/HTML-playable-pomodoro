---
name: html-playable
description: Build and iterate Rudy's HTML5 playables (small canvas games for ads and prototypes) in the GitHub repo Rudy-art-PomodoroGames/HTML-playable-pomodoro, published with GitHub Pages. Use this whenever Rudy asks to create a new playable, change or tune a playable's gameplay, add settings, push or "make a build", apply settings JSON he pastes, change art/assets or the font, or asks why a playable behaves oddly, even if he only says "the game", "the proto", "minion swarm" or "push these specs".
---

# HTML playables (Pomodoro Games)

Rudy is a game designer and artist. He plays every build **on his iPhone** through
GitHub Pages and tunes it with the in-game ⚙ panel, so each change has to reach a
live link fast, be testable on a phone, and expose its numbers as settings. He
prefers quick, plain answers, and dislikes work he did not ask for.

## The repo

- GitHub: `Rudy-art-PomodoroGames/HTML-playable-pomodoro` (public, branch `main`).
  If it isn't in the session, attach it with `add_repo` and clone it.
- Live builds: `https://rudy-art-pomodorogames.github.io/HTML-playable-pomodoro/<game>/`
  (Pages deploys from `main` / root about a minute after a push).
- Layout: one folder per playable, reusable code in `shared/`:

```
shared/settings-panel.js   ⚙  every CONFIG value, editable live, saved per browser, Copy JSON / Reset / Restart, tap a name for help
shared/asset-panel.js      🎨 every image + the font, Replace / Download / Reset, fallback to drawn shapes
<game>/index.html          canvas 360×560 inside .stage, button bar, script tags with ?v=BUILD
<game>/game.js             BUILD, CONFIG, CONFIG_HELP, ASSETS, state, update/draw loop, panel init
<game>/assets/README.md    the file names the game looks for
```

`minion-swarm/` is the reference implementation: read it before starting a new game
or adding a system, and copy its patterns rather than inventing new ones.

## Ground rules (learned the hard way)

- **Do only what was asked.** If Rudy asks a question, answer it; build only when he asks.
  If he says "don't push yet", commit locally and wait for his go.
- **Pushing:** when he asks for a build or a push, push straight to `main` (that is what
  updates his link). Never create a PR unless asked.
- **Every push bumps the build.** Increase `const BUILD` in `game.js` and the `?v=` on
  *every* `<script>` tag in `index.html` (they must match). Phones cache old scripts; the
  build number in the corner is how Rudy checks he's on the new version. If he reports
  something that a recent build already fixed, it's the cache: check the Pages deploy run
  (GitHub Actions list, "pages build and deployment") and tell him to reload.
- **Every tunable number goes in `CONFIG`**, never hard-coded, and **every CONFIG key gets a
  `CONFIG_HELP` entry** (one plain sentence; say when it applies, e.g. "Applies on Restart"
  or "from the next zone"). Use `PerLevel` for minion/merge level and `PerZone` for zones,
  and say which in the help, since Rudy reads these names literally.
- **Every drawn thing is an asset.** Add it to `ASSETS` with a `draw(c, w, h)` fallback that
  reuses the same drawing function the game uses, and draw it in the game via
  `art(key)` → `drawImage`, else the shape. Images are PNG; the font is any web font.
  Use `gameFont()` for all canvas text.
- **No model names** in commits, code or files.
- Keep answers short: what changed, the build number, the link, and anything he must do
  (e.g. "⚙ → Reset defaults").

## Applying settings JSON Rudy pastes ("push these specs")

He copies JSON from ⚙ → Copy JSON. Diff it against `CONFIG` in code (eval the CONFIG
literal in node, walk both objects), change **only the keys that differ**, keep comments
accurate, bump the build, push, and list the changed keys with old → new values. Remind
him to tap ⚙ → Reset defaults once so his phone drops its saved copy (the panel saves
only values that differ from defaults, so new defaults reach him after that).

If a value he set makes the game behave badly (e.g. `dmgMultPerLevel` 1 makes merging
useless), explain the math in a small table instead of "fixing" it silently.

## Testing before every push

Serve the repo and drive it with Playwright as an iPhone; check numbers, not vibes:

```bash
cd <repo> && (python3 -m http.server 8765 >/dev/null 2>&1 &)
# node script: chromium.launch(), newContext({ ...devices['iPhone 13'] }),
# collect page.on('pageerror'), goto http://127.0.0.1:8765/<game>/,
# clear localStorage (and the 'playable-assets' IndexedDB for asset tests),
# poke state via window.game / window.CONFIG / top-level functions,
# assert the behaviour (positions, counts, levels), screenshot and look at it.
pkill -f "http.server 8765"
```

- Use `page.touchscreen.tap` for taps (convert canvas coords with the canvas bounding box ×
  width/360).
- Look at a screenshot of anything visual (layout on iPhone 13 and SE, panels, effects).
- The session can't open `github.io` (proxy), so verify locally, not on the live link.

## Gotchas already hit

- Movement to a target: compare with a tolerance (`d > reach + 1`), or minions creep forever.
- Frame time: compute `dt` from `performance.now()`, clamp to 0.05 s.
- Hire prices should depend on total purchases, not current count (merging would lower them).
- Overlays (HP bars/numbers, damage popups) draw in a second pass, after minions.
- Resource colliders are circles (`resRadius`), diameter = art size × `zone.colliderScale`.

## Starting a new playable

1. Create `<game>/` by following `minion-swarm/index.html` and `game.js` structure
   (stage + canvas 360×560, `--w` width rule, button bar, both shared panels, BUILD 1).
2. Draw everything with simple shapes first and register each in `ASSETS`.
3. Add a row to the README's Games table and an `assets/README.md` with file names.
4. Test as above, push, give Rudy the link.
