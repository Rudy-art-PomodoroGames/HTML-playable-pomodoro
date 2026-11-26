// Connect & Earn — core gameplay prototype.
// A Flow Free-style board inside an incremental idle. Drag a line from a
// generator to the main generator in the middle: once connected, the
// generator earns coins every tick. Lines can't cross, unless you spend a
// bridge (the line jumps over the other one). Buy gates to wake up the other
// generators, level generators up, and route lines through ×2 booster tiles.
// When every generator is connected, the next board opens.

// Build number, shown in the corner. Bump it together with the ?v= in
// index.html on every push so phones load the new version.
const BUILD = 1;

// ---- Tunable values (all in one place) ------------------------------------

const CONFIG = {
  startCoins: 0,

  grid: {
    cellSize: 48,           // size of one tile in pixels
    gap: 4,                 // space between tiles
    cellRadius: 10,         // rounded corners of the tiles
    top: 90,                // distance from the top of the screen to the board
    framePadding: 10,       // wooden frame around the board
  },

  // Income of each generator, in coins per tick.
  // income = base × perGeneratorMult^(generator number − 1) × levelMult^(level − 1)
  //          × boosterMult per booster tile its line crosses × boardMult^(board − 1)
  income: {
    base: 1,
    perGeneratorMult: 3,    // each generator earns this much more than the previous one
    tickSeconds: 1,         // coins are paid every tick
    boosterMult: 2,         // ×2 per booster tile the line goes through
    boardMult: 10,          // each new board pays this much more
  },

  // Gate price of generator 1, 2, 3… on board 1 (× gatePriceBoardMult on each next board).
  // 0 = free, already open.
  gatePrices: [0, 20, 120, 600, 3000, 15000],
  gatePriceBoardMult: 12,

  upgrade: {
    levelMult: 1.6,         // income × this per generator level
    costSeconds: 15,        // level-up price = this many ticks of the generator's current income
    costMultPerLevel: 1.35, // and × this for each level it already has
  },

  bridge: {
    startCount: 0,          // bridges you start each board with
    baseCost: 50,           // price of the first bridge on board 1
    costMultPerBuy: 2,      // each bridge bought costs this much more
    costBoardMult: 12,      // bridge prices × this on each next board
  },

  pipe: {
    width: 16,              // line thickness in pixels
    outline: 3,             // darker edge around the line
    highlight: 0.35,        // light stripe on top of the pipe (0 = none)
    jumpScale: 1.3,         // a line jumping over another (bridge) is drawn this much thicker
    jumpShadow: 0.3,        // darkness of the shadow under a jump
  },

  // Colors of generator 1, 2, 3… and their lines (candy palette from the concept).
  colors: ['#ff9f43', '#4aa8ff', '#ffcf3f', '#ff7eb0', '#6cc96c', '#a77bff'],

  coinPopup: {
    show: true,
    duration: 0.9,          // seconds until fully faded
    rise: 22,               // pixels the "+N" floats up
    fontSize: 13,
    color: '#ffe066',
  },

  ui: {
    textColor: '#ffffff',
    outlineColor: '#6b4423',
    outlineWidth: 0.28,
    coinFontSize: 20,
    coinIconSize: 30,
    boardFontSize: 16,
    cellPriceFontSize: 10,  // price under locked and connected generators
    trayHeight: 84,
    trayFontSize: 14,
    traySmallFontSize: 12,
    buttonColor: '#7cc35a',
    nextColor: '#ff9f43',
    disabledOpacity: 0.5,
    pressScale: 0.92,
    backgroundColor: '#f3dcae',
    frameColor: '#c98a4b',
    frameDarkColor: '#8a5a2b',
    cellColor: '#fbf1df',
    cellShadeColor: '#ead7b6',
    trayColor: '#a86d3a',
  },

  maxPixelRatio: 2,

  // Drawing size of each image, × its normal size (1 = unchanged). Same as the Scale slider in 🎨.
  artScale: {
    main_generator: 1, generator_1: 1, generator_2: 1, generator_3: 1, generator_4: 1, generator_5: 1, generator_6: 1,
    cell: 1, cell_booster: 1, icon_coin: 1, icon_lock: 1, icon_bridge: 1,
  },

  textWeight: 900,

  loading: {
    text: 'Loading...',
    fontSize: 20,
    backgroundColor: '#f3dcae',
    barColor: '#ff9f43',
    barWidth: 0.6,
    barHeight: 18,
    maxWait: 10,
  },
  cheat: {
    size: 50,
    doubleTapTime: 0.4,
    coinAmount: 1000000,
  },
};

const CONFIG_HELP = {
  startCoins: 'Coins you start with. Applies on Restart.',
  'grid.cellSize': 'Size of one board tile, in pixels.',
  'grid.gap': 'Space between two tiles, in pixels.',
  'grid.cellRadius': 'Roundness of the tile corners, in pixels.',
  'grid.top': 'Distance from the top of the screen to the board, in pixels.',
  'grid.framePadding': 'Thickness of the wooden frame around the board, in pixels.',
  'income.base': 'Coins per tick earned by generator 1 at level 1, on board 1.',
  'income.perGeneratorMult': 'Each generator earns this much more than the previous one. 3 = generator 2 earns 3×, generator 3 earns 9×.',
  'income.tickSeconds': 'Coins are paid every this many seconds.',
  'income.boosterMult': 'Income × this for each booster tile a generator\'s line goes through. 2 = ×2, two boosters = ×4.',
  'income.boardMult': 'Income × this on each new board.',
  gatePrices: 'Price of the gate of generator 1, 2, 3… on board 1. 0 = free, already open. Applies on Restart or from the next board.',
  gatePriceBoardMult: 'Gate prices × this on each new board.',
  'upgrade.levelMult': 'Generator income × this for each level. Tap a connected generator to level it up.',
  'upgrade.costSeconds': 'Level-up price = this many ticks of the generator\'s current income.',
  'upgrade.costMultPerLevel': 'Level-up price also × this for each level the generator already has.',
  'bridge.startCount': 'Bridges you start each board with.',
  'bridge.baseCost': 'Price of the first bridge on board 1.',
  'bridge.costMultPerBuy': 'Each bridge bought on a board costs this much more than the previous one.',
  'bridge.costBoardMult': 'Bridge prices × this on each new board.',
  'pipe.width': 'Thickness of the lines, in pixels.',
  'pipe.outline': 'Thickness of the darker edge around the lines, in pixels.',
  'pipe.highlight': 'Strength of the light stripe on top of the pipes. 0 = flat.',
  'pipe.jumpScale': 'A line jumping over another (bridge) is drawn this much thicker, so it reads as passing above.',
  'pipe.jumpShadow': 'Darkness of the shadow a jump casts on the line below. 0 = no shadow.',
  colors: 'Color of generator 1, 2, 3… and its line, when it has no art.',
  'coinPopup.show': 'Show a "+N" above each generator when it pays.',
  'coinPopup.duration': 'Seconds a "+N" stays before it has fully faded.',
  'coinPopup.rise': 'How far a "+N" floats up, in pixels.',
  'coinPopup.fontSize': 'Text size of the "+N".',
  'coinPopup.color': 'Color of the "+N".',
  'ui.textColor': 'Color of all game text.',
  'ui.outlineColor': 'Color of the outline around all game text.',
  'ui.outlineWidth': 'Outline thickness compared to the text size.',
  'ui.coinFontSize': 'Text size of the coin counter.',
  'ui.coinIconSize': 'Size of the coin icon next to the counter.',
  'ui.boardFontSize': 'Text size of "Board N" at the top right.',
  'ui.cellPriceFontSize': 'Text size of the prices under generators (gate price, level-up price).',
  'ui.trayHeight': 'Height of the bottom tray, in pixels.',
  'ui.trayFontSize': 'Text size of the first line in the tray buttons.',
  'ui.traySmallFontSize': 'Text size of the second line in the tray buttons (price).',
  'ui.buttonColor': 'Color of the drawn bridge button (not used once you load button art in 🎨).',
  'ui.nextColor': 'Color of the drawn Next board button.',
  'ui.disabledOpacity': 'How visible a button is when you can\'t afford it.',
  'ui.pressScale': 'Button size for a moment after a tap. 1 = no bounce.',
  'ui.backgroundColor': 'Background color when there is no background art.',
  'ui.frameColor': 'Color of the wooden frame around the board.',
  'ui.frameDarkColor': 'Darker edge of the wooden frame.',
  'ui.cellColor': 'Color of an empty tile.',
  'ui.cellShadeColor': 'Color of the bottom edge of the tiles.',
  'ui.trayColor': 'Color of the bottom tray when it has no art.',
  maxPixelRatio: 'How sharp the game draws. 2 = sharp (recommended). Applies when the page is resized or reloaded.',
  textWeight: 'Thickness of all game text. 400 = regular, 700 = bold, up to 1000 with a variable font.',
};
for (const key of Object.keys(CONFIG.artScale)) {
  CONFIG_HELP[`artScale.${key}`] = `Drawing size of the ${key} image, × its normal size. 1 = unchanged. Same as the Scale slider in 🎨.`;
}

// ---- Boards ------------------------------------------------------------------
// Hand-made layouts, played in order, then repeated (prices and income keep
// growing with the board number). Coordinates are [column, row], from the top left.
// main = top-left tile of the 2×2 main generator.

const BOARDS = [
  {
    cols: 6, rows: 7, main: [2, 2],
    generators: [[0, 0], [5, 0], [0, 6], [5, 5], [2, 6]],
    boosters: [[1, 3], [4, 5]],
  },
  {
    cols: 6, rows: 7, main: [2, 3],
    generators: [[0, 1], [5, 1], [0, 6], [5, 6], [3, 0], [2, 6]],
    boosters: [[1, 4], [4, 2], [3, 6]],
  },
  {
    cols: 6, rows: 7, main: [1, 2],
    generators: [[5, 0], [0, 6], [5, 6], [0, 0], [3, 5], [5, 3]],
    boosters: [[4, 2], [2, 5], [0, 3]],
  },
];

// ---- Setup -----------------------------------------------------------------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

let renderScale = 1;
function fitCanvas() {
  const cssW = canvas.getBoundingClientRect().width || W;
  const ratio = Math.min(window.devicePixelRatio || 1, Math.max(1, CONFIG.maxPixelRatio));
  renderScale = (cssW * ratio) / W;
  const pw = Math.round(W * renderScale), ph = Math.round(H * renderScale);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const state = {
  coins: 0,
  board: 0,                 // index of the current board (0 = board 1)
  layout: null,             // BOARDS entry in use
  generators: [],           // { id, c, r, open, level, line: [{c, r}], connected, tickT }
  bridgesBought: 0,         // bought on this board
  bridgesOwned: 0,
  drag: null,               // { gen, moved } while drawing a line
  popups: [],
  press: null,
  paused: false,
  flash: '',
  flashT: 0,
};

// ---- Board geometry ------------------------------------------------------------

const cols = () => state.layout.cols;
const rows = () => state.layout.rows;
const step = () => CONFIG.grid.cellSize + CONFIG.grid.gap;
const boardW = () => cols() * step() - CONFIG.grid.gap;
const boardH = () => rows() * step() - CONFIG.grid.gap;
const boardX = () => (W - boardW()) / 2;
const boardY = () => CONFIG.grid.top;
const cellX = (c) => boardX() + c * step();
const cellY = (r) => boardY() + r * step();
const cellCX = (c) => cellX(c) + CONFIG.grid.cellSize / 2;
const cellCY = (r) => cellY(r) + CONFIG.grid.cellSize / 2;
const key = (c, r) => `${c},${r}`;
const inGrid = (c, r) => c >= 0 && r >= 0 && c < cols() && r < rows();

function cellAt(p) {
  const c = Math.floor((p.x - boardX() + CONFIG.grid.gap / 2) / step());
  const r = Math.floor((p.y - boardY() + CONFIG.grid.gap / 2) / step());
  return inGrid(c, r) ? { c, r } : null;
}

function isMain(c, r) {
  const [mc, mr] = state.layout.main;
  return c >= mc && c <= mc + 1 && r >= mr && r <= mr + 1;
}
const genAt = (c, r) => state.generators.find((g) => g.c === c && g.r === r);
const isBooster = (c, r) => state.layout.boosters.some(([bc, br]) => bc === c && br === r);

// Which lines go through each tile: key → [{ gen, i }]
function occupancy() {
  const map = new Map();
  for (const g of state.generators) {
    g.line.forEach((cell, i) => {
      if (i === 0) return; // the generator's own tile
      const k = key(cell.c, cell.r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({ gen: g, i });
    });
  }
  return map;
}
const bridgesUsed = () => [...occupancy().values()].filter((list) => list.length > 1).length;
const bridgesFree = () => state.bridgesOwned - bridgesUsed();

// ---- Economy -------------------------------------------------------------------

const boardFactor = (mult) => Math.pow(mult, state.board);

function boostersOn(g) {
  return g.line.filter((cell, i) => i > 0 && isBooster(cell.c, cell.r)).length;
}
function income(g) {
  const I = CONFIG.income;
  return I.base
    * Math.pow(I.perGeneratorMult, g.id)
    * Math.pow(CONFIG.upgrade.levelMult, g.level - 1)
    * Math.pow(I.boosterMult, boostersOn(g))
    * boardFactor(I.boardMult);
}
const gatePrice = (g) => {
  const list = CONFIG.gatePrices;
  const base = list.length ? list[Math.min(g.id, list.length - 1)] : 0;
  return Math.round(base * boardFactor(CONFIG.gatePriceBoardMult));
};
const upgradeCost = (g) => {
  const base = CONFIG.income.base * Math.pow(CONFIG.income.perGeneratorMult, g.id)
    * Math.pow(CONFIG.upgrade.levelMult, g.level - 1) * boardFactor(CONFIG.income.boardMult);
  return Math.ceil(base * CONFIG.upgrade.costSeconds * Math.pow(CONFIG.upgrade.costMultPerLevel, g.level - 1));
};
const bridgeCost = () => Math.ceil(CONFIG.bridge.baseCost
  * Math.pow(CONFIG.bridge.costMultPerBuy, state.bridgesBought) * boardFactor(CONFIG.bridge.costBoardMult));

function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return `${n}`;
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  return `${n >= 100 ? Math.floor(n) : n.toFixed(1).replace(/\.0$/, '')}${units[u]}`;
}

function flash(text) { state.flash = text; state.flashT = 1.4; }

// ---- Board setup ---------------------------------------------------------------

function startBoard(index) {
  state.board = index;
  state.layout = BOARDS[index % BOARDS.length];
  state.generators = state.layout.generators.map(([c, r], id) => ({
    id, c, r, level: 1, line: [{ c, r }], connected: false, tickT: 0, open: false,
  }));
  for (const g of state.generators) g.open = gatePrice(g) <= 0;
  state.bridgesBought = 0;
  state.bridgesOwned = CONFIG.bridge.startCount;
  state.drag = null;
  state.popups = [];
}

function restart() {
  state.coins = CONFIG.startCoins;
  state.flashT = 0;
  startBoard(0);
}

const allConnected = () => state.generators.every((g) => g.connected);

// ---- Line drawing --------------------------------------------------------------

// Can the line being drawn (g) step from its last tile into (c, r)?
// Returns 'move', 'back', 'connect', or null.
function stepInto(g, c, r) {
  const line = g.line;
  const last = line[line.length - 1];
  const dc = c - last.c, dr = r - last.r;
  if (Math.abs(dc) + Math.abs(dr) !== 1) return null;            // only one tile, no diagonals
  if (line.length > 1 && line[line.length - 2].c === c && line[line.length - 2].r === r) return 'back';
  // After jumping over a line, keep going straight.
  if (last.jump) {
    const prev = line[line.length - 2];
    if (c - last.c !== last.c - prev.c || r - last.r !== last.r - prev.r) return null;
  }
  if (isMain(c, r)) return last.jump ? null : 'connect';
  if (genAt(c, r)) return null;
  if (line.some((cell) => cell.c === c && cell.r === r)) return null;  // no loops
  const others = (occupancy().get(key(c, r)) || []).filter((o) => o.gen !== g);
  if (!others.length) return 'move';
  // Jump over another line: one line only, going straight across ours, and a free bridge.
  if (others.length > 1) return null;
  const { gen: o, i } = others[0];
  const before = o.line[i - 1], after = o.line[i + 1];
  if (!before || !after) return null;
  const straightAcross = (before.c === after.c && dc !== 0) || (before.r === after.r && dr !== 0);
  if (!straightAcross || bridgesFree() < 1) return null;
  return 'jump';
}

function dragTo(cell) {
  const d = state.drag;
  if (!d || !cell) return;
  const g = d.gen;
  if (d.fresh) {
    if (cell.c === g.c && cell.r === g.r) return;
    d.fresh = false;
    d.moved = true;
    clearLine(g);
  }
  // Walk one tile at a time toward the finger, so fast swipes don't skip tiles.
  for (let guard = 0; guard < 20 && !g.connected; guard++) {
    const last = g.line[g.line.length - 1];
    if (last.c === cell.c && last.r === cell.r) return;
    const dc = Math.sign(cell.c - last.c), dr = Math.sign(cell.r - last.r);
    // Prefer the axis with the larger distance.
    const options = Math.abs(cell.c - last.c) >= Math.abs(cell.r - last.r)
      ? [[last.c + dc, last.r], [last.c, last.r + dr]]
      : [[last.c, last.r + dr], [last.c + dc, last.r]];
    let done = false;
    for (const [nc, nr] of options) {
      if ((nc === last.c && nr === last.r) || !inGrid(nc, nr)) continue;
      const res = stepInto(g, nc, nr);
      if (!res) continue;
      d.moved = true;
      if (res === 'back') g.line.pop();
      else if (res === 'connect') { g.connected = true; g.end = { c: nc, r: nr }; flash('Connected!'); }
      else g.line.push({ c: nc, r: nr, jump: res === 'jump' });
      done = true;
      break;
    }
    if (!done) return;
  }
}

function endDrag() {
  const d = state.drag;
  if (!d) return;
  const g = d.gen;
  // A line can't stop on top of another one.
  while (!g.connected && g.line.length > 1 && g.line[g.line.length - 1].jump) g.line.pop();
  if (!d.moved && d.tapUpgrade) tryUpgrade(g);
  state.drag = null;
}

function clearLine(g) {
  g.line = [{ c: g.c, r: g.r }];
  g.connected = false;
  g.end = null;
}

// ---- Actions -------------------------------------------------------------------

function tryOpenGate(g) {
  const price = gatePrice(g);
  if (state.coins < price) { flash(`Need ${fmt(price)}`); return; }
  state.coins -= price;
  g.open = true;
  flash('Gate open!');
}

function tryUpgrade(g) {
  const cost = upgradeCost(g);
  if (state.coins < cost) { flash(`Need ${fmt(cost)}`); return; }
  state.coins -= cost;
  g.level++;
}

function buyBridge() {
  const cost = bridgeCost();
  if (state.coins < cost) { flash(`Need ${fmt(cost)}`); return; }
  state.coins -= cost;
  state.bridgesBought++;
  state.bridgesOwned++;
}

function nextBoard() {
  if (!allConnected()) return;
  startBoard(state.board + 1);
  flash(`Board ${state.board + 1}`);
}

// ---- Update --------------------------------------------------------------------

function update(dt) {
  if (state.flashT > 0) state.flashT -= dt;
  for (const p of state.popups) p.t += dt;
  state.popups = state.popups.filter((p) => p.t < CONFIG.coinPopup.duration);
  if (state.paused) return;
  const tick = Math.max(0.05, CONFIG.income.tickSeconds);
  for (const g of state.generators) {
    if (!g.connected) { g.tickT = 0; continue; }
    g.tickT += dt;
    while (g.tickT >= tick) {
      g.tickT -= tick;
      const n = income(g);
      state.coins += n;
      if (CONFIG.coinPopup.show) state.popups.push({ x: cellCX(g.c), y: cellY(g.r) + 4, text: `+${fmt(n)}`, t: 0 });
    }
  }
}

// ---- Input ---------------------------------------------------------------------

function toCanvas(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(W, ((e.clientX - rect.left) * W) / rect.width)),
    y: Math.max(0, Math.min(H, ((e.clientY - rect.top) * H) / rect.height)),
  };
}

let lastCheatTap = 0;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const p = toCanvas(e);
  if (p.x < CONFIG.cheat.size && p.y < CONFIG.cheat.size) {
    const now = performance.now() / 1000;
    if (now - lastCheatTap < CONFIG.cheat.doubleTapTime) { lastCheatTap = 0; document.body.classList.toggle('tools-on'); }
    else lastCheatTap = now;
    return;
  }
  if (isLoading() || state.paused) return;
  const btn = buttonAt(p);
  if (btn) {
    state.press = { key: btn, t: 0.12 };
    if (btn === 'bridge') buyBridge(); else if (btn === 'next') nextBoard();
    return;
  }
  const cell = cellAt(p);
  if (!cell) return;
  const g = genAt(cell.c, cell.r);
  if (g) {
    if (!g.open) { tryOpenGate(g); return; }
    // Tap a connected generator = level up. Drag from any open generator = redraw its line
    // (the old line is only cleared once the finger leaves the generator's tile).
    state.drag = { gen: g, moved: false, fresh: true, tapUpgrade: g.connected };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  // Continue an unfinished line from its end.
  const owner = state.generators.find((o) => o.open && !o.connected && o.line.length > 1
    && o.line[o.line.length - 1].c === cell.c && o.line[o.line.length - 1].r === cell.r);
  if (owner) { state.drag = { gen: owner, moved: true }; canvas.setPointerCapture(e.pointerId); }
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.drag) return;
  e.preventDefault();
  dragTo(cellAt(toCanvas(e)));
});
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---- Assets --------------------------------------------------------------------

const ASSETS = [
  { key: 'background', label: 'Background', size: '720×1120 (fills the play area)',
    draw: (c, w, h) => { c.fillStyle = CONFIG.ui.backgroundColor; c.fillRect(0, 0, w, h); } },
  { key: 'board_frame', label: 'Board frame', size: '~700×800, stretched around the board (transparent middle optional)',
    draw: (c, w, h) => drawFrameShape(c, 2, 2, w - 4, h - 4) },
  { key: 'cell', label: 'Empty tile', size: '104×104',
    draw: (c, w, h) => drawCellShape(c, 0, 0, w, h) },
  { key: 'cell_booster', label: 'Booster tile (×2)', size: '104×104',
    draw: (c, w, h) => { drawCellShape(c, 0, 0, w, h); drawBoosterShape(c, w / 2, h / 2, w); } },
  { key: 'main_generator', label: 'Main generator (2×2 tiles)', size: '224×224, transparent',
    draw: (c, w, h) => drawMainShape(c, w / 2, h / 2, w * 0.45, true) },
  ...CONFIG.colors.map((col, i) => ({
    key: `generator_${i + 1}`, label: `Generator ${i + 1}`, size: '104×104, transparent (drawn awake; the game greys it when locked)',
    draw: (c, w, h) => drawGeneratorShape(c, w / 2, h / 2, w * 0.4, CONFIG.colors[i], 'awake'),
  })),
  { key: 'icon_coin', label: 'Coin icon', size: '64×64, transparent',
    draw: (c, w, h) => drawCoinShape(c, w / 2, h / 2, w * 0.42) },
  { key: 'icon_lock', label: 'Lock icon (locked gate)', size: '64×64, transparent',
    draw: (c, w, h) => drawLockShape(c, w / 2, h / 2, w * 0.8) },
  { key: 'icon_bridge', label: 'Bridge icon (tray)', size: '96×96, transparent',
    draw: (c, w, h) => drawBridgeIconShape(c, w / 2, h / 2, w * 0.8) },
  { key: 'tray', label: 'Bottom tray', size: '720×184 (stretched)',
    draw: (c, w, h) => drawTrayShape(c, 0, 0, w, h) },
  { key: 'button_bridge', label: 'Bridge button', size: '~340×140 (stretched; text drawn on top)',
    draw: (c, w, h) => drawButtonShape(c, 2, h * 0.2, w - 4, h * 0.6, CONFIG.ui.buttonColor) },
  { key: 'button_next', label: 'Next board button', size: '~340×140 (stretched; text drawn on top)',
    draw: (c, w, h) => drawButtonShape(c, 2, h * 0.2, w - 4, h * 0.6, CONFIG.ui.nextColor) },
];

const art = (k) => (window.AssetPanel ? AssetPanel.image(k) : null);
const artScale = (k) => (k in CONFIG.artScale ? Math.max(0, CONFIG.artScale[k]) : 1);
const gameFont = () => (window.AssetPanel ? AssetPanel.fontStack : 'system-ui, sans-serif');

// Draw image k centered at (x, y) in a box of size s, else run the shape fallback.
function drawArt(k, x, y, s, fallback) {
  const img = art(k);
  const sc = artScale(k);
  if (img) { const d = s * sc; ctx.drawImage(img, x - d / 2, y - d / 2, d, d); }
  else { ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y); fallback(); ctx.restore(); }
}

// ---- Shapes (fallback art) -----------------------------------------------------

function roundRectPath(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawFrameShape(c, x, y, w, h) {
  const u = CONFIG.ui;
  c.fillStyle = u.frameDarkColor; roundRectPath(c, x, y + 4, w, h, 18); c.fill();
  c.fillStyle = u.frameColor; roundRectPath(c, x, y, w, h, 18); c.fill();
  c.fillStyle = shade(u.frameColor, 0.25); roundRectPath(c, x + 4, y + 3, w - 8, 6, 3); c.fill();
}

function drawCellShape(c, x, y, w, h) {
  const r = CONFIG.grid.cellRadius * (w / CONFIG.grid.cellSize);
  c.fillStyle = CONFIG.ui.cellShadeColor; roundRectPath(c, x, y + h * 0.06, w, h * 0.94, r); c.fill();
  c.fillStyle = CONFIG.ui.cellColor; roundRectPath(c, x, y, w, h * 0.94, r); c.fill();
}

function drawStar(c, x, y, R, r, n = 5) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
}

function drawBoosterShape(c, x, y, s) {
  c.fillStyle = 'rgba(255,207,63,0.35)';
  drawStar(c, x, y, s * 0.42, s * 0.2); c.fill();
  c.font = `${CONFIG.textWeight} ${Math.round(s * 0.3)}px ${gameFont()}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = s * 0.07; c.strokeStyle = '#c98a1b'; c.lineJoin = 'round';
  c.strokeText('×2', x, y + 1); c.fillStyle = '#fff6d6'; c.fillText('×2', x, y + 1);
}

function drawFace(c, x, y, r, mood) {
  c.strokeStyle = '#5a3a1e'; c.fillStyle = '#5a3a1e'; c.lineCap = 'round'; c.lineWidth = Math.max(1.5, r * 0.1);
  const ex = r * 0.35, ey = y - r * 0.05;
  if (mood === 'awake') {
    c.beginPath(); c.arc(x - ex, ey, r * 0.09, 0, Math.PI * 2); c.arc(x + ex, ey, r * 0.09, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x, y + r * 0.15, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  } else {
    c.beginPath();
    c.moveTo(x - ex - r * 0.12, ey); c.lineTo(x - ex + r * 0.12, ey);
    c.moveTo(x + ex - r * 0.12, ey); c.lineTo(x + ex + r * 0.12, ey);
    c.moveTo(x - r * 0.1, y + r * 0.28); c.lineTo(x + r * 0.1, y + r * 0.28);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,120,120,0.45)';
  c.beginPath(); c.ellipse(x - r * 0.55, y + r * 0.15, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
  c.ellipse(x + r * 0.55, y + r * 0.15, r * 0.14, r * 0.09, 0, 0, Math.PI * 2); c.fill();
}

// Little jelly-pot generator with a face. mood: 'awake' or 'asleep'.
function drawGeneratorShape(c, x, y, r, color, mood) {
  c.fillStyle = 'rgba(0,0,0,0.12)';
  c.beginPath(); c.ellipse(x, y + r * 0.95, r * 0.8, r * 0.2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = shade(color, -0.25); roundRectPath(c, x - r, y - r * 0.8 + 3, r * 2, r * 1.75, r * 0.55); c.fill();
  c.fillStyle = color; roundRectPath(c, x - r, y - r * 0.8, r * 2, r * 1.7, r * 0.55); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)'; roundRectPath(c, x - r * 0.7, y - r * 0.65, r * 0.6, r * 0.25, r * 0.12); c.fill();
  c.fillStyle = '#9aa3ad'; roundRectPath(c, x - r * 0.35, y - r * 1.05, r * 0.7, r * 0.3, r * 0.1); c.fill();
  drawFace(c, x, y + r * 0.05, r, mood);
}

function drawMainShape(c, x, y, r, awake) {
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.beginPath(); c.ellipse(x, y + r * 0.9, r * 0.85, r * 0.22, 0, 0, Math.PI * 2); c.fill();
  // gears behind
  c.fillStyle = '#c98a4b';
  for (const s of [-1, 1]) { drawStar(c, x + s * r * 0.9, y + r * 0.1, r * 0.36, r * 0.26, 8); c.fill(); }
  c.fillStyle = shade('#ffb347', -0.2); c.beginPath(); c.arc(x, y + 3, r * 0.8, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffb347'; c.beginPath(); c.arc(x, y, r * 0.8, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.45, r * 0.25, r * 0.12, -0.4, 0, Math.PI * 2); c.fill();
  // chimney
  c.fillStyle = '#c98a4b'; roundRectPath(c, x + r * 0.25, y - r * 1.05, r * 0.22, r * 0.45, r * 0.06); c.fill();
  // goggles
  c.fillStyle = '#8a5a2b'; roundRectPath(c, x - r * 0.75, y - r * 0.5, r * 1.5, r * 0.14, r * 0.07); c.fill();
  c.fillStyle = '#bfe6ff';
  c.beginPath(); c.arc(x - r * 0.25, y - r * 0.45, r * 0.17, 0, Math.PI * 2); c.arc(x + r * 0.25, y - r * 0.45, r * 0.17, 0, Math.PI * 2); c.fill();
  drawFace(c, x, y + r * 0.15, r * 0.8, awake ? 'awake' : 'asleep');
}

function drawCoinShape(c, x, y, r) {
  c.fillStyle = '#d99a14'; c.beginPath(); c.arc(x, y + r * 0.08, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffcf3f'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(x, y, r * 0.65, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e8a91a'; roundRectPath(c, x - r * 0.12, y - r * 0.4, r * 0.24, r * 0.8, r * 0.1); c.fill();
}

function drawLockShape(c, x, y, s) {
  c.strokeStyle = '#8a5a2b'; c.lineWidth = s * 0.1;
  c.beginPath(); c.arc(x, y - s * 0.05, s * 0.2, Math.PI, 0); c.stroke();
  c.fillStyle = '#c98a4b'; roundRectPath(c, x - s * 0.3, y - s * 0.05, s * 0.6, s * 0.42, s * 0.08); c.fill();
  c.fillStyle = '#6b4423'; c.beginPath(); c.arc(x, y + s * 0.13, s * 0.06, 0, Math.PI * 2); c.fill();
}

function drawBridgeIconShape(c, x, y, s) {
  const w = s * 0.12;
  // yellow pipe below, straight
  pipeStroke(c, [[x, y - s * 0.45], [x, y + s * 0.45]], '#ffcf3f', w);
  // blue pipe jumping over it
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y + s * 0.06, s * 0.16, s * 0.06, 0, 0, Math.PI * 2); c.fill();
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  const path = () => { c.beginPath(); c.moveTo(x - s * 0.45, y); c.quadraticCurveTo(x, y - s * 0.4, x + s * 0.45, y); };
  path(); c.strokeStyle = shade('#4aa8ff', -0.3); c.lineWidth = w * 1.3 + 4; c.stroke();
  path(); c.strokeStyle = '#4aa8ff'; c.lineWidth = w * 1.3; c.stroke();
  c.restore();
}

function drawTrayShape(c, x, y, w, h) {
  c.fillStyle = shade(CONFIG.ui.trayColor, -0.25); roundRectPath(c, x, y + 4, w, h - 4, 18); c.fill();
  c.fillStyle = CONFIG.ui.trayColor; roundRectPath(c, x, y, w, h - 6, 18); c.fill();
}

function drawButtonShape(c, x, y, w, h, color) {
  c.fillStyle = shade(color, -0.3); roundRectPath(c, x, y + 4, w, h, h * 0.35); c.fill();
  c.fillStyle = color; roundRectPath(c, x, y, w, h, h * 0.35); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.3)'; roundRectPath(c, x + 6, y + 4, w - 12, h * 0.22, h * 0.1); c.fill();
}

// Rounded pipe along a polyline: dark edge, color, light stripe.
function pipeStroke(c, pts, color, width) {
  const P = CONFIG.pipe;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  const path = () => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); };
  path(); c.strokeStyle = shade(color, -0.3); c.lineWidth = width + P.outline * 2; c.stroke();
  path(); c.strokeStyle = color; c.lineWidth = width; c.stroke();
  if (P.highlight > 0) {
    c.translate(0, -width * 0.18);
    path(); c.strokeStyle = `rgba(255,255,255,${P.highlight})`; c.lineWidth = width * 0.28; c.stroke();
  }
  c.restore();
}

// ---- Render --------------------------------------------------------------------

const genColor = (g) => CONFIG.colors[g.id % CONFIG.colors.length];

// Polyline of a generator's line, in pixels.
function linePoints(g) {
  const pts = g.line.map((cell) => [cellCX(cell.c), cellCY(cell.r)]);
  if (g.connected && g.end) {
    const last = g.line[g.line.length - 1];
    pts.push([cellCX(last.c) + (g.end.c - last.c) * step() * 0.55, cellCY(last.r) + (g.end.r - last.r) * step() * 0.55]);
  }
  return pts;
}

function drawLines() {
  const w = CONFIG.pipe.width;
  for (const g of state.generators) if (g.line.length > 1) pipeStroke(ctx, linePoints(g), genColor(g), w);
  // Jumps on top: the jumping line is redrawn thicker across its tile, with a shadow below.
  const occ = occupancy();
  for (const g of state.generators) {
    g.line.forEach((cell, i) => {
      if (!cell.jump || i === 0 || (occ.get(key(cell.c, cell.r)) || []).length < 2) return;
      const pts = linePoints(g);
      const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1] || pts[i];
      const a = [(px + cx) / 2, (py + cy) / 2], b = [(cx + nx) / 2, (cy + ny) / 2];
      ctx.fillStyle = `rgba(0,0,0,${CONFIG.pipe.jumpShadow})`;
      ctx.beginPath(); ctx.ellipse(cx + 2, cy + 6, w * 0.9, w * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      // lift: pull the middle point up a little so it reads as a hump
      pipeStroke(ctx, [a, [cx, cy - w * 0.35], b], genColor(g), w * CONFIG.pipe.jumpScale);
    });
  }
}

function draw() {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  const bg = art('background');
  if (bg) ctx.drawImage(bg, 0, 0, W, H);
  else { ctx.fillStyle = CONFIG.ui.backgroundColor; ctx.fillRect(0, 0, W, H); }

  // Frame
  const fp = CONFIG.grid.framePadding;
  const frame = art('board_frame');
  const fx = boardX() - fp, fy = boardY() - fp, fw = boardW() + fp * 2, fh = boardH() + fp * 2;
  if (frame) ctx.drawImage(frame, fx, fy, fw, fh); else drawFrameShape(ctx, fx, fy, fw, fh);

  // Tiles
  const cs = CONFIG.grid.cellSize;
  for (let r = 0; r < rows(); r++) {
    for (let c = 0; c < cols(); c++) {
      if (isMain(c, r)) continue;
      const k = isBooster(c, r) ? 'cell_booster' : 'cell';
      const img = art(k);
      if (img) ctx.drawImage(img, cellX(c), cellY(r), cs, cs);
      else {
        drawCellShape(ctx, cellX(c), cellY(r), cs, cs);
        if (k === 'cell_booster') drawBoosterShape(ctx, cellCX(c), cellCY(r), cs);
      }
    }
  }
  // Main generator tile area
  const [mc, mr] = state.layout.main;
  ctx.fillStyle = CONFIG.ui.cellShadeColor;
  roundRectPath(ctx, cellX(mc), cellY(mr), cs * 2 + CONFIG.grid.gap, cs * 2 + CONFIG.grid.gap, CONFIG.grid.cellRadius); ctx.fill();

  drawLines();

  // Main generator
  const mx = cellX(mc) + cs + CONFIG.grid.gap / 2, my = cellY(mr) + cs + CONFIG.grid.gap / 2;
  const anyConnected = state.generators.some((g) => g.connected);
  drawArt('main_generator', mx, my, cs * 2, () => drawMainShape(ctx, mx, my, cs * 0.9, anyConnected));

  // Generators
  for (const g of state.generators) {
    const x = cellCX(g.c), y = cellCY(g.r);
    ctx.save();
    if (!g.open) ctx.globalAlpha = 0.45;
    if (g.connected) { // soft glow
      ctx.fillStyle = 'rgba(255,240,160,0.55)';
      ctx.beginPath(); ctx.arc(x, y, cs * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    drawArt(`generator_${(g.id % CONFIG.colors.length) + 1}`, x, y, cs,
      () => drawGeneratorShape(ctx, x, y, cs * 0.36, genColor(g), g.connected ? 'awake' : 'asleep'));
    ctx.restore();
    const fs = CONFIG.ui.cellPriceFontSize;
    if (!g.open) {
      drawArt('icon_lock', x, y - 4, cs * 0.5, () => drawLockShape(ctx, x, y - 4, cs * 0.5));
      priceTag(x, cellY(g.r) + cs - fs * 0.5, gatePrice(g), state.coins >= gatePrice(g));
    } else if (g.connected) {
      if (g.level > 1) outlinedText(`Lv${g.level}`, cellX(g.c) + 3, cellY(g.r) + 8, { size: fs, align: 'left', width: 2.5 });
      priceTag(x, cellY(g.r) + cs - fs * 0.5, upgradeCost(g), state.coins >= upgradeCost(g), '▲');
    } else if (!state.drag || state.drag.gen !== g) {
      if (g.line.length === 1) outlinedText('zZ', x + cs * 0.3, cellY(g.r) + 8, { size: fs, width: 2.5 });
    }
  }

  // Coin popups
  for (const p of state.popups) {
    const k = p.t / CONFIG.coinPopup.duration;
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    outlinedText(p.text, p.x, p.y - CONFIG.coinPopup.rise * k, { size: CONFIG.coinPopup.fontSize, color: CONFIG.coinPopup.color, align: 'center', width: 3 });
    ctx.globalAlpha = 1;
  }

  drawHud();
  drawTray();

  // First-time hint until the first connection.
  if (!state.generators.some((g) => g.connected) && !state.drag && state.flashT <= 0) {
    outlinedText('Drag from a generator to the big one!', W / 2, boardY() - 26, { size: 13, align: 'center', width: 3 });
  }
  if (state.flashT > 0) {
    ctx.globalAlpha = Math.min(1, state.flashT * 2);
    outlinedText(state.flash, W / 2, boardY() - 26, { size: 18, align: 'center' });
    ctx.globalAlpha = 1;
  }
  if (document.body.classList.contains('tools-on')) outlinedText(`build ${BUILD}`, W / 2, 54, { size: 9, align: 'center', width: 2 });
}

function priceTag(x, y, price, affordable, prefix = '') {
  ctx.save();
  if (!affordable) ctx.globalAlpha = 0.6;
  const fs = CONFIG.ui.cellPriceFontSize;
  const text = `${prefix}${fmt(price)}`;
  ctx.font = `${CONFIG.textWeight} ${fs}px ${gameFont()}`;
  const tw = ctx.measureText(text).width + fs * 1.5;
  const icon = fs * 1.1;
  outlinedText(text, x + icon / 2, y, { size: fs, align: 'center', width: 2.5 });
  drawArt('icon_coin', x - tw / 2 + icon * 0.2, y, icon, () => drawCoinShape(ctx, x - tw / 2 + icon * 0.2, y, icon * 0.42));
  ctx.restore();
}

function outlinedText(text, x, y, { size = 16, color = CONFIG.ui.textColor, align = 'left', baseline = 'middle', width } = {}) {
  ctx.font = `${CONFIG.textWeight} ${size}px ${gameFont()}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  ctx.lineWidth = width != null ? width : Math.max(2, size * CONFIG.ui.outlineWidth);
  ctx.strokeStyle = CONFIG.ui.outlineColor;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  const w = ctx.measureText(text).width;
  ctx.textBaseline = 'alphabetic';
  return w;
}

function fitSize(text, size, maxW) {
  ctx.font = `${CONFIG.textWeight} ${size}px ${gameFont()}`;
  const w = ctx.measureText(text).width + size * CONFIG.ui.outlineWidth;
  return w > maxW ? size * maxW / w : size;
}

function drawHud() {
  const u = CONFIG.ui;
  const y = 34;
  const s = u.coinIconSize;
  drawArt('icon_coin', 14 + s / 2, y, s, () => drawCoinShape(ctx, 14 + s / 2, y, s * 0.42));
  outlinedText(fmt(state.coins), 14 + s + 6, y, { size: u.coinFontSize });
  outlinedText(`Board ${state.board + 1}`, W - 14, y, { size: u.boardFontSize, align: 'right' });
  const perSec = state.generators.filter((g) => g.connected).reduce((t, g) => t + income(g), 0) / Math.max(0.05, CONFIG.income.tickSeconds);
  outlinedText(`${fmt(perSec)}/s`, 14 + s + 6, y + 20, { size: 11, width: 2.5 });
}

// ---- Tray (bottom) ---------------------------------------------------------------

function trayRect() {
  const h = CONFIG.ui.trayHeight;
  return { x: 10, y: H - h - 8, w: W - 20, h };
}
function buttonRects() {
  const t = trayRect();
  const pad = 12, bh = t.h - pad * 2 - 6;
  const bw = (t.w - pad * 3) / 2;
  return {
    bridge: { x: t.x + pad, y: t.y + pad, w: bw, h: bh },
    next: { x: t.x + pad * 2 + bw, y: t.y + pad, w: bw, h: bh },
  };
}
function buttonAt(p) {
  const r = buttonRects();
  for (const k of Object.keys(r)) {
    const b = r[k];
    if (k === 'next' && !allConnected()) continue;
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return k;
  }
  return null;
}

function drawTray() {
  const u = CONFIG.ui;
  const t = trayRect();
  const tray = art('tray');
  if (tray) ctx.drawImage(tray, t.x, t.y, t.w, t.h); else drawTrayShape(ctx, t.x, t.y, t.w, t.h);
  const r = buttonRects();
  const drawBtn = (k, label, sub, enabled, color, icon) => {
    const b = r[k];
    ctx.save();
    if (state.press && state.press.key === k) {
      const s = u.pressScale;
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(s, s); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    }
    if (!enabled) ctx.globalAlpha = u.disabledOpacity;
    const img = art(`button_${k}`);
    if (img) ctx.drawImage(img, b.x, b.y, b.w, b.h); else drawButtonShape(ctx, b.x, b.y, b.w, b.h - 4, color);
    let tx = b.x + b.w / 2;
    if (icon) {
      const is = b.h * 0.7;
      icon(b.x + 6 + is / 2, b.y + b.h / 2 - 2, is);
      tx = b.x + 6 + is + (b.w - 12 - is) / 2;
    }
    const maxW = b.w - (icon ? b.h * 0.7 + 18 : 16);
    outlinedText(label, tx, b.y + b.h * 0.36, { size: fitSize(label, u.trayFontSize, maxW), align: 'center' });
    if (sub) outlinedText(sub, tx, b.y + b.h * 0.7, { size: fitSize(sub, u.traySmallFontSize, maxW), align: 'center' });
    ctx.restore();
  };
  drawBtn('bridge', `Bridge ×${bridgesFree()}`, `Cost ${fmt(bridgeCost())}`, state.coins >= bridgeCost(), u.buttonColor,
    (x, y, s) => drawArt('icon_bridge', x, y, s, () => drawBridgeIconShape(ctx, x, y, s)));
  if (allConnected()) drawBtn('next', 'Next board', 'All connected!', true, u.nextColor);
  else {
    const left = state.generators.filter((g) => !g.connected).length;
    const b = r.next;
    outlinedText(`${left} to connect`, b.x + b.w / 2, b.y + b.h / 2, { size: u.traySmallFontSize, align: 'center' });
  }
}

// ---- Loop ------------------------------------------------------------------------

let loadTime = 0;
let loadShown = 0;
function isLoading() {
  return !!window.AssetPanel && !AssetPanel.ready && loadTime < CONFIG.loading.maxWait;
}
function drawLoading() {
  const L = CONFIG.loading;
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.fillStyle = L.backgroundColor;
  ctx.fillRect(0, 0, W, H);
  const target = AssetPanel.progress ? AssetPanel.progress() : 0;
  loadShown += (target - loadShown) * 0.25;
  const bw = W * L.barWidth, bh = L.barHeight, bx = (W - bw) / 2, by = H / 2;
  outlinedText(L.text, W / 2, by - 24, { size: L.fontSize, align: 'center' });
  roundRectPath(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = CONFIG.ui.outlineColor;
  ctx.fill();
  const pad = 3;
  if (loadShown > 0.01) {
    roundRectPath(ctx, bx + pad, by + pad, Math.max(bh - pad * 2, (bw - pad * 2) * loadShown), bh - pad * 2, (bh - pad * 2) / 2);
    ctx.fillStyle = L.barColor;
    ctx.fill();
  }
}

let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
  last = now;
  if (isLoading()) { loadTime += dt; drawLoading(); requestAnimationFrame(frame); return; }
  update(dt);
  if (state.press && (state.press.t -= dt) <= 0) state.press = null;
  draw();
  requestAnimationFrame(frame);
}

if (window.SettingsPanel) {
  SettingsPanel.init({
    config: CONFIG,
    storageKey: 'connect-and-earn.config',
    help: CONFIG_HELP,
    mount: canvas.parentElement,
    onRestart: restart,
    onToggle: (open) => { state.paused = open; },
    hide: ['cheat', 'loading'],
  });
}

if (window.CheatPanel) {
  CheatPanel.init({
    mount: canvas.parentElement,
    onToggle: (open) => { state.paused = open; },
    cheats: [
      { label: '+1M coins', onClick: () => { state.coins += CONFIG.cheat.coinAmount; } },
      { label: 'Open all gates', onClick: () => { for (const g of state.generators) g.open = true; } },
      { label: '+5 bridges', onClick: () => { state.bridgesOwned += 5; } },
      { label: 'Skip to next board', onClick: () => { startBoard(state.board + 1); } },
    ],
  });
}

if (window.AssetPanel) {
  AssetPanel.init({
    storageKey: 'connect-and-earn.assets',
    basePath: 'assets/',
    mount: canvas.parentElement,
    uploadUrl: 'https://github.com/Rudy-art-PomodoroGames/HTML-playable-pomodoro/upload/main/connect-and-earn/assets',
    images: ASSETS,
    scale: {
      min: 0.2, max: 3, step: 0.05,
      has: (k) => k in CONFIG.artScale,
      get: (k) => CONFIG.artScale[k],
      set: (k, v) => { CONFIG.artScale[k] = v; if (window.SettingsPanel) SettingsPanel.save(); },
    },
    font: {
      family: 'GameFont', fallback: 'system-ui, sans-serif',
      files: ['Nunito-VariableFont_wght.ttf'],
      weight: {
        min: 200, max: 1000, step: 50,
        get: () => CONFIG.textWeight,
        set: (v) => { CONFIG.textWeight = v; if (window.SettingsPanel) SettingsPanel.save(); },
      },
    },
    onFontChange: (stack) => document.documentElement.style.setProperty('--game-font', stack),
    onToggle: (open) => { state.paused = open; },
  });
}

restart();
window.game = state;
window.CONFIG = CONFIG;
requestAnimationFrame(frame);
