# Source art

Working files for the playables: PSDs, Blender files, Aseprite files, video
masters, and so on. Use one folder per playable, e.g. `source-art/minion-swarm/`.

Heavy formats (see `.gitattributes` at the repo root) are stored with **Git LFS**,
so the repo stays light. On GitHub, an LFS file's page says "Stored with Git LFS".

The game never loads anything from here. When art is ready, export it as
**.webp or .png** into the game's `assets/` folder (for example
`minion-swarm/assets/`). Those exports stay normal files, because GitHub Pages
can't serve LFS files.
