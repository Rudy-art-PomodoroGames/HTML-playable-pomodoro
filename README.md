# HTML playables

One repo, one folder per playable. Shared code goes in `shared/`.

## Layout

```
html-playable-pomodoro/
├── shared/            # reusable code: settings-panel.js (⚙ tuning), asset-panel.js (🎨 art & font)
├── source-art/        # working files (PSD, Blender, Aseprite, video…), stored with Git LFS
├── minion-swarm/      # playable: open index.html in a browser
└── README.md
```

## Games

| Game | Folder | Status |
| --- | --- | --- |
| Minion Swarm | `minion-swarm/` | Prototype: auto-harvest, zones, small/big merge |
| Connect & Earn | `connect-and-earn/` | Prototype: draw lines to the main generator, gates, bridges, ×2 boosters |

## Checklist for each playable

- Runs by opening `index.html` directly (no build step needed yet).
- Single-file or small-bundle output, checked against the ad network size limit before publishing.
- Notes on what is still a placeholder.

## Big files (Git LFS)

Heavy source formats (PSD, PSB, Krita, Clip Studio, Procreate, Aseprite, AI,
Affinity, TIFF, EXR, Blender, FBX, GLB, Substance, MP4, MOV, WAV, AIFF, FLAC,
ZIP, 7z, RAR) are stored with Git LFS anywhere in the repo; see `.gitattributes`.

Game files (`.png`, `.webp`, fonts, code, `.mp3`/`.ogg`) must stay normal files:
GitHub Pages can't serve LFS files. Put working files in `source-art/` and export
the finished art to the game's `assets/` folder.

