// Minion Swarm — first playable slice.
// Swarm auto-harvests the current zone. Clear every resource and the game
// moves to the next zone automatically (Auto Drill style).
// Merge two small minions into one big minion (more damage, slower hits).

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const SMALL = { name: 'small', dmg: 1, interval: 0.4, speed: 130, color: '#7bd389', r: 6 };
const BIG   = { name: 'big',   dmg: 4, interval: 1.2, speed: 75,  color: '#f2a65a', r: 12 };

const HIRE_COST = (count) => 10 + count * 5;
const MERGE_COST = 5;
const CLEAR_DELAY = 1.2; // seconds between zones

const state = {
  wood: 0,
  zone: 0,
  minions: [],
  resources: [],
  clearing: 0,
  flash: '',
  flashT: 0,
};

// Zones get more resources, tougher trees, and more big trees.
function makeZone(index) {
  const count = 6 + index * 2;
  const bigChance = Math.min(0.2 + index * 0.1, 0.7);
  const list = [];
  for (let i = 0; i < count; i++) {
    const big = Math.random() < bigChance;
    const maxHp = big ? 12 + index * 6 : 3 + index * 2;
    list.push({
      x: 30 + Math.random() * (W - 60),
      y: 90 + Math.random() * (H - 200),
      r: big ? 22 : 12,
      maxHp,
      hp: maxHp,
      value: big ? 6 + index * 3 : 2 + index,
      done: false,
    });
  }
  return list;
}

function spawn(type, x, y) {
  return { type, x, y, target: null, cd: 0 };
}

function startZone() {
  state.resources = makeZone(state.zone);
  for (const m of state.minions) m.target = null;
}

function nearestAlive(m) {
  let best = null;
  let bestD = Infinity;
  for (const r of state.resources) {
    if (r.done) continue;
    const d = Math.hypot(r.x - m.x, r.y - m.y);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

function update(dt) {
  if (state.flashT > 0) state.flashT -= dt;

  if (state.clearing > 0) {
    state.clearing -= dt;
    if (state.clearing <= 0) {
      state.zone++;
      startZone();
      flash(`Zone ${state.zone + 1}`);
    }
    return;
  }

  // Harvest anything that reached zero HP, even if no minion hit it this frame.
  for (const r of state.resources) {
    if (r.hp <= 0 && !r.done) {
      r.done = true;
      state.wood += r.value;
    }
  }

  for (const m of state.minions) {
    if (!m.target || m.target.done) m.target = nearestAlive(m);
    if (!m.target) continue;

    const t = m.target;
    const dx = t.x - m.x;
    const dy = t.y - m.y;
    const d = Math.hypot(dx, dy);
    const reach = t.r + m.type.r;

    // Small tolerance so a minion parked right at its reach starts attacking
    // instead of creeping forever toward it.
    if (d > reach + 1) {
      const step = Math.min(m.type.speed * dt, d - reach);
      m.x += (dx / d) * step;
      m.y += (dy / d) * step;
    } else {
      m.cd -= dt;
      if (m.cd <= 0) {
        m.cd = m.type.interval;
        t.hp -= m.type.dmg;
      }
    }
  }

  state.resources = state.resources.filter((r) => !r.done);

  if (state.resources.length === 0) {
    state.clearing = CLEAR_DELAY;
    flash('Zone cleared!');
  }
}

function flash(text) {
  state.flash = text;
  state.flashT = 1.8;
}

// ---- Actions -------------------------------------------------------------

function hire() {
  const cost = HIRE_COST(state.minions.length);
  if (state.wood < cost) return;
  state.wood -= cost;
  const x = W / 2 + (Math.random() - 0.5) * 40;
  state.minions.push(spawn(SMALL, x, H - 60));
}

function merge() {
  const smalls = state.minions.filter((m) => m.type === SMALL);
  if (smalls.length < 2 || state.wood < MERGE_COST) return;
  state.wood -= MERGE_COST;
  const [a, b] = smalls;
  const big = spawn(BIG, a.x, a.y);
  big.target = a.target;
  state.minions = state.minions.filter((m) => m !== a && m !== b);
  state.minions.push(big);
}

document.getElementById('hire').addEventListener('click', hire);
document.getElementById('merge').addEventListener('click', merge);

// ---- Render --------------------------------------------------------------

function draw() {
  ctx.fillStyle = '#1f3a24';
  ctx.fillRect(0, 0, W, H);

  for (const r of state.resources) {
    ctx.fillStyle = r.r > 15 ? '#2e6b3a' : '#4f9a57';
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(r.x - r.r, r.y + r.r + 4, 2 * r.r, 3);
    ctx.fillStyle = '#f5e663';
    ctx.fillRect(r.x - r.r, r.y + r.r + 4, 2 * r.r * Math.max(r.hp, 0) / r.maxHp, 3);
  }

  for (const m of state.minions) {
    ctx.fillStyle = m.type.color;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.type.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#e8f5ea';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Zone ${state.zone + 1}`, 12, 24);
  ctx.fillText(`Wood ${Math.floor(state.wood)}`, 12, 46);
  ctx.textAlign = 'right';
  ctx.fillText(`Minions ${state.minions.length}`, W - 12, 24);

  if (state.flashT > 0) {
    ctx.globalAlpha = Math.min(1, state.flashT);
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(state.flash, W / 2, H / 2);
    ctx.globalAlpha = 1;
  }
}

function syncButtons() {
  const hireBtn = document.getElementById('hire');
  const mergeBtn = document.getElementById('merge');
  const cost = HIRE_COST(state.minions.length);
  hireBtn.textContent = `Hire minion (${cost} wood)`;
  hireBtn.disabled = state.wood < cost;
  const smalls = state.minions.filter((m) => m.type === SMALL).length;
  mergeBtn.disabled = smalls < 2 || state.wood < MERGE_COST;
}

// ---- Loop ----------------------------------------------------------------

let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
  last = now;
  update(dt);
  draw();
  syncButtons();
  requestAnimationFrame(frame);
}

state.minions.push(spawn(SMALL, W / 2, H - 60));
startZone();
window.game = state; // handy for testing in the console
requestAnimationFrame(frame);
