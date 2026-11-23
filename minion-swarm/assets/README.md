# Minion Swarm assets

Drop art here with these exact file names. Anything missing falls back to the
game's built-in drawn shape (or the default font), so the game never breaks.

| File | What it is | Suggested size |
| --- | --- | --- |
| `background.webp` / `.png` | Play area background (stretched to fill) | 720×1120 |
| `minion_lv1.webp` … `minion_lv8.webp` (or `.png`) | Minion art per merge level (levels above 8 reuse them in a cycle) | 128×128, transparent |
| `minion_eat.webp` / `.png` | Eating animation sprite sheet, looped while a minion hits a resource: one row of square frames, frame count = width ÷ height. None = normal sprite | e.g. 512×128 (4 frames), same framing as `minion_lv1` |
| `minion_leg.webp` / `.png` | One leg, used for both (top center of the image is the hip it swings from) | 32×64, transparent |
| `minion_shadow.webp` / `.png` | Shadow under every minion (drawn see-through, set darkness with `shadow.opacity`) | 128×128, transparent |
| `resource_small.webp` / `.png` | Small resource (bush) | 64×64 |
| `resource_big.webp` / `.png` | Big resource (tree) | 128×128 |
| `tap_marker.webp` / `.png` | Marker shown where the player taps | 64×64, transparent |
| `Nunito-VariableFont_wght.ttf` (or `font.woff2` / `.woff` / `.ttf` / `.otf`) | Font for all game text. A variable font lets 🎨 → Game font → Weight (same as ⚙ → textWeight) go from thin to extra thick | — |

Images can be WebP or PNG (WebP is usually 30–50% smaller). If both exist for the same
name, the WebP is used. Keep files small: ad networks often cap a playable at 2–5 MB in total.

The easiest way to get a file with the right name: in the game, open 🎨, tap
**Replace** to try your art, then **Download**. Upload the downloaded files here
with GitHub's **Add file → Upload files**.
