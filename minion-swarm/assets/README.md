# Minion Swarm assets

Drop art here with these exact file names. Anything missing falls back to the
game's built-in drawn shape (or the default font), so the game never breaks.

| File | What it is | Suggested size |
| --- | --- | --- |
| `background.webp` / `.png` | Play area background (stretched to fill) | 720×1120 |
| `minion_lv1.webp` … `minion_lv8.webp` (or `.png`) | Minion art per merge level (levels above 8 reuse them in a cycle) | 128×128, transparent |
| `minion_eat.webp` (level 1), `minion_eat_lv2.webp` … `minion_eat_lv8.webp` (or `.png`) | Eating animation sprite sheet per minion level, looped while a minion hits a resource: one row of square frames, frame count = width ÷ height. A level without its own sheet uses level 1's; none at all = normal sprite | e.g. 512×128 (4 frames), same framing as `minion_lv1` |
| `minion_leg.webp` / `.png` | One leg, used for both (top center of the image is the hip it swings from) | 32×64, transparent |
| `minion_shadow.webp` / `.png` | Shadow under every minion (drawn see-through, set darkness with `shadow.opacity`) | 128×128, transparent |
| `resource_1.webp` … `resource_6.webp` (or `.png`) | The 6 resource types (size, HP, wood and spawn weight in ⚙ → resources). One image, or a sprite sheet: one row of square frames from untouched to almost eaten, picked by HP left (4 frames = 100/75/50/25%) | 128×128, or 512×128 for 4 states |
| `icon_juice.webp` / `.png` | Currency icon (HUD counter and Hire price). The minion counter uses `minion_lv1` automatically | 64×64, transparent |
| `hud_backdrop.webp` / `.png` | Backdrop behind the HUD counters, stretched, drawn see-through by `ui.backdropOpacity` | 256×64 |
| `button_hire.webp` / `.png` | Hire button background (text is drawn on top) | ~340×124 |
| `button_merge.webp` / `.png` | Merge button background (text is drawn on top) | ~340×124 |
| `merge_vfx.webp` / `.png` | Merge effect, played once on the new minion: one row of square frames (frame count = width ÷ height) | e.g. 1536×256 for 6 frames |
| `splash_drop.webp` / `.png` | One juice drop for the bite splash. Draw it white/grey: it's tinted with each resource's `splashColor` (turn off `splash.tintImage` to keep its own colors) | 32×32, transparent |
| `tap_marker.webp` / `.png` | Marker shown where the player taps | 64×64, transparent |
| `Nunito-VariableFont_wght.ttf` (or `font.woff2` / `.woff` / `.ttf` / `.otf`) | Font for all game text. A variable font lets 🎨 → Game font → Weight (same as ⚙ → textWeight) go from thin to extra thick | — |

Images can be WebP or PNG (WebP is usually 30–50% smaller). If both exist for the same
name, the WebP is used. Keep files small: ad networks often cap a playable at 2–5 MB in total.

The easiest way to get a file with the right name: in the game, open 🎨, tap
**Replace** to try your art, then **Download**. Upload the downloaded files here
with GitHub's **Add file → Upload files**.
