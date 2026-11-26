# Connect & Earn assets

Drop art here with these exact file names. Anything missing falls back to the
game's built-in drawn shape (or the default font), so the game never breaks.

| File | What it is | Suggested size |
| --- | --- | --- |
| `background.webp` / `.png` | Play area background (stretched to fill) | 720×1120 |
| `board_frame.webp` / `.png` | Wooden frame around the board (stretched) | ~700×800 |
| `cell.webp` / `.png` | Empty tile | 104×104 |
| `cell_booster.webp` / `.png` | Booster tile (×2 income for a line going through it) | 104×104 |
| `main_generator.webp` / `.png` | Main generator in the middle (covers 2×2 tiles) | 224×224, transparent |
| `generator_1.webp` … `generator_6.webp` (or `.png`) | Generator 1 to 6, drawn awake. The game draws it see-through when its gate is locked | 104×104, transparent |
| `icon_coin.webp` / `.png` | Coin icon (counter and prices) | 64×64, transparent |
| `icon_lock.webp` / `.png` | Lock drawn on a generator whose gate isn't bought yet | 64×64, transparent |
| `icon_bridge.webp` / `.png` | Bridge icon in the tray button | 96×96, transparent |
| `tray.webp` / `.png` | Bottom tray (stretched) | 720×184 |
| `button_bridge.webp` / `.png` | Bridge button background (text drawn on top) | ~340×140 |
| `button_next.webp` / `.png` | Next board button background (text drawn on top) | ~340×140 |
| `Nunito-VariableFont_wght.ttf` (or `font.woff2` / `.woff` / `.ttf` / `.otf`) | Font for all game text | — |

The lines (pipes) and the bridge jumps are drawn by the game in each generator's
color (⚙ → colors, pipe).

Images can be WebP or PNG. If both exist for the same name, the WebP is used.

The easiest way to get a file with the right name: in the game, open 🎨, tap
**Replace** to try your art, then **Download**. Upload the downloaded files here
with GitHub's **Add file → Upload files**.
