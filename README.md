# HTML playables

One repo, one folder per playable. Shared code goes in `shared/`.

## Layout

```
html-playable-pomodoro/
├── shared/            # reusable code: settings-panel.js (⚙ tuning), asset-panel.js (🎨 art & font)
├── minion-swarm/      # playable: open index.html in a browser
└── README.md
```

## Games

| Game | Folder | Status |
| --- | --- | --- |
| Minion Swarm | `minion-swarm/` | Prototype: auto-harvest, zones, small/big merge |

## Checklist for each playable

- Runs by opening `index.html` directly (no build step needed yet).
- Single-file or small-bundle output, checked against the ad network size limit before publishing.
- Notes on what is still a placeholder.
