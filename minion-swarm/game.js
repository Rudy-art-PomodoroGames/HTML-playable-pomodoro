// Minion Swarm — core gameplay prototype.
// An invisible leader (the future player) walks to resources. The swarm
// follows it with a delay, harvests what is near it, and minions push each
// other like physics bodies. Clear a zone and the next one starts
// automatically (Auto Drill style).

// ---- Tunable values (all in one place) ------------------------------------

const CONFIG = {
  startMinions: 4,

  small: { dmg: 1, interval: 0.4, speed: 110, radius: 6, color: '#7bd389' },
  big:   { dmg: 4, interval: 1.2, speed: 85,  radius: 11, color: '#f2a65a' },

  hireBaseCost: 10,
  hireCostStep: 5,
  mergeCost: 5,

  leaderSpeed: 60,          // slower than minions so the swarm keeps up
  leaderStopDistance: 30,   // how close the leader walks to its resource
  leaderWaitDistance: 60,   // leader pauses if the swarm lags this far behind
  swarmRadius: 80,          // minions only attack resources this close to the leader
  formationRadius: 22,      // spread of each minion's resting spot around the leader
  followResponsiveness: 4,  // higher = minions react faster (less delay)
  crowdPenalty: 20,         // makes minions prefer resources with fewer attackers
  collisionPasses: 3,

  zone: {
    baseCount: 6, countPerZone: 2,
    bigChanceBase: 0.2, bigChancePerZone: 0.1, bigChanceMax: 0.7,
    smallSize: 20, bigSize: 40,
    smallHp: 3, smallHpPerZone: 2,
    bigHp: 12, bigHpPerZone: 6,
    smallValue: 2, smallValuePerZone: 1,
    bigValue: 6, bigValuePerZone: 3,
    smallColor: '#b5552f', bigColor: '#7d2a1c',
  },

  guide: {
    speed: 100,             // how fast the swarm heads to a tapped point
    linger: 0.4,            // seconds the swarm keeps the tapped direction after release
    showMarker: true,       // draw a ring where the player taps
  },

  shake: {
    duration: 0.15,         // seconds a resource shakes after a hit
    amount: 2.5,            // shake strength in pixels
  },

  clearDelay: 1.2,          // seconds between zones
  showLeader: false,        // debug: draw the invisible leader
};

// ---- Setup -----------------------------------------------------------------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const state = {
  wood: 0,
  zone: 0,
  minions: [],
  resources: [],
  leader: { x: W / 2, y: H - 90, target: null },
  guide: null,              // { x, y, held, linger } while the player steers
  paused: false,
  clearing: 0,
  flash: '',
  flashT: 0,
};

const hireCost = () => CONFIG.hireBaseCost + state.minions.length * CONFIG.hireCostStep;

// ---- Geometry helpers ------------------------------------------------------

function closestPoint(r, px, py) {
  const h = r.size / 2;
  return {
    x: Math.max(r.x - h, Math.min(px, r.x + h)),
    y: Math.max(r.y - h, Math.min(py, r.y + h)),
  };
}

function distToRect(r, px, py) {
  const c = closestPoint(r, px, py);
  return Math.hypot(px - c.x, py - c.y);
}

// ---- Zones -----------------------------------------------------------------

function makeZone(index) {
  const z = CONFIG.zone;
  const count = z.baseCount + index * z.countPerZone;
  const bigChance = Math.min(z.bigChanceBase + index * z.bigChancePerZone, z.bigChanceMax);
  const list = [];
  for (let i = 0; i < count; i++) {
    const big = Math.random() < bigChance;
    const size = big ? z.bigSize : z.smallSize;
    let x, y, ok = false;
    // Keep resources apart so minions can walk between them.
    for (let tries = 0; tries < 40 && !ok; tries++) {
      x = 20 + size / 2 + Math.random() * (W - 40 - size);
      y = 80 + size / 2 + Math.random() * (H - 200 - size);
      ok = list.every((r) =>
        Math.abs(r.x - x) > (r.size + size) / 2 + 16 ||
        Math.abs(r.y - y) > (r.size + size) / 2 + 16);
    }
    if (!ok) continue;
    const maxHp = big ? z.bigHp + index * z.bigHpPerZone : z.smallHp + index * z.smallHpPerZone;
    list.push({
      x, y, size, big, maxHp, hp: maxHp,
      value: big ? z.bigValue + index * z.bigValuePerZone : z.smallValue + index * z.smallValuePerZone,
      done: false,
      shake: 0,
    });
  }
  return list;
}

function startZone() {
  state.resources = makeZone(state.zone);
  state.leader.target = null;
  for (const m of state.minions) m.target = null;
}

// ---- Minions ---------------------------------------------------------------

function spawn(type, x, y) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.random() * CONFIG.formationRadius;
  return {
    type, x, y, vx: 0, vy: 0, cd: 0, target: null,
    ox: Math.cos(a) * r, oy: Math.sin(a) * r, // resting spot around the leader
  };
}

function spawnNearLeader(type) {
  const L = state.leader;
  return spawn(type, L.x + (Math.random() - 0.5) * 30, L.y + (Math.random() - 0.5) * 30);
}

function inSwarmRange(r) {
  return !r.done && distToRect(r, state.leader.x, state.leader.y) <= CONFIG.swarmRadius;
}

function pickTarget(m, attackers) {
  let best = null;
  let bestScore = Infinity;
  for (const r of state.resources) {
    if (!inSwarmRange(r)) continue;
    const score = distToRect(r, m.x, m.y) + (attackers.get(r) || 0) * CONFIG.crowdPenalty;
    if (score < bestScore) { bestScore = score; best = r; }
  }
  return best;
}

function updateMinion(m, dt, attackers) {
  const t = m.type;
  const L = state.leader;

  if (!m.target || !inSwarmRange(m.target)) {
    if (m.target) attackers.set(m.target, (attackers.get(m.target) || 1) - 1);
    m.target = pickTarget(m, attackers);
    if (m.target) attackers.set(m.target, (attackers.get(m.target) || 0) + 1);
  }

  // Where this minion wants to be.
  let gx, gy, stop;
  if (m.target) {
    const c = closestPoint(m.target, m.x, m.y);
    gx = c.x; gy = c.y; stop = t.radius;
  } else {
    gx = L.x + m.ox; gy = L.y + m.oy; stop = 2;
  }

  // Steer toward it with some inertia, which gives the follow delay.
  const dx = gx - m.x;
  const dy = gy - m.y;
  const d = Math.hypot(dx, dy);
  let wantVx = 0, wantVy = 0;
  if (d > stop + 1) {
    const speed = t.speed * Math.min(1, (d - stop) / 30); // ease in on arrival
    wantVx = (dx / d) * speed;
    wantVy = (dy / d) * speed;
  }
  const k = Math.min(1, CONFIG.followResponsiveness * dt);
  m.vx += (wantVx - m.vx) * k;
  m.vy += (wantVy - m.vy) * k;
  m.x += m.vx * dt;
  m.y += m.vy * dt;

  // Attack when touching the resource.
  if (m.target && distToRect(m.target, m.x, m.y) <= t.radius + 3) {
    m.cd -= dt;
    if (m.cd <= 0) {
      m.cd = t.interval;
      m.target.hp -= t.dmg;
      m.target.shake = CONFIG.shake.duration;
    }
  }
}

// Minions push each other (heavier big minions push harder) and are pushed
// out of resources, like simple physics colliders.
function resolveCollisions() {
  const ms = state.minions;
  for (let pass = 0; pass < CONFIG.collisionPasses; pass++) {
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i];
      for (let j = i + 1; j < ms.length; j++) {
        const b = ms[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.type.radius + b.type.radius;
        if (d >= min) continue;
        if (d === 0) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
        const over = min - d;
        const ma = a.type.radius ** 2;
        const mb = b.type.radius ** 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * over * (mb / (ma + mb));
        a.y -= ny * over * (mb / (ma + mb));
        b.x += nx * over * (ma / (ma + mb));
        b.y += ny * over * (ma / (ma + mb));
      }
    }

    for (const m of ms) {
      const rad = m.type.radius;
      for (const r of state.resources) {
        if (r.done) continue;
        const h = r.size / 2;
        const c = closestPoint(r, m.x, m.y);
        const dx = m.x - c.x;
        const dy = m.y - c.y;
        const d = Math.hypot(dx, dy);
        if (d >= rad) continue;
        if (d > 0) {
          m.x += (dx / d) * (rad - d);
          m.y += (dy / d) * (rad - d);
        } else {
          // Center is inside the square: push out along the shortest side.
          const px = h - Math.abs(m.x - r.x);
          const py = h - Math.abs(m.y - r.y);
          if (px < py) m.x = r.x + Math.sign(m.x - r.x || 1) * (h + rad);
          else m.y = r.y + Math.sign(m.y - r.y || 1) * (h + rad);
        }
      }
      m.x = Math.max(rad, Math.min(W - rad, m.x));
      m.y = Math.max(rad, Math.min(H - rad, m.y));
    }
  }
}

// ---- Leader (invisible player) ---------------------------------------------

function updateLeader(dt) {
  const L = state.leader;

  // Player tap overrides the automatic behavior while held (plus a short linger).
  const g = state.guide;
  if (g) {
    if (!g.held) {
      g.linger -= dt;
      if (g.linger <= 0) {
        state.guide = null;
        L.target = null; // pick the nearest resource from the new spot
        return;
      }
    }
    const dx = g.x - L.x;
    const dy = g.y - L.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const step = Math.min(CONFIG.guide.speed * dt, d);
      L.x += (dx / d) * step;
      L.y += (dy / d) * step;
    }
    return;
  }

  if (!L.target || L.target.done) {
    let best = null;
    let bestD = Infinity;
    for (const r of state.resources) {
      if (r.done) continue;
      const d = distToRect(r, L.x, L.y);
      if (d < bestD) { bestD = d; best = r; }
    }
    L.target = best;
  }
  if (!L.target) return;

  // Wait for the swarm if it lags behind, so the group stays together.
  if (state.minions.length) {
    let cx = 0, cy = 0;
    for (const m of state.minions) { cx += m.x; cy += m.y; }
    cx /= state.minions.length;
    cy /= state.minions.length;
    if (Math.hypot(cx - L.x, cy - L.y) > CONFIG.leaderWaitDistance) return;
  }

  const c = closestPoint(L.target, L.x, L.y);
  const dx = c.x - L.x;
  const dy = c.y - L.y;
  const d = Math.hypot(dx, dy);
  if (d > CONFIG.leaderStopDistance) {
    const step = Math.min(CONFIG.leaderSpeed * dt, d - CONFIG.leaderStopDistance);
    L.x += (dx / d) * step;
    L.y += (dy / d) * step;
  }
}

// ---- Update ----------------------------------------------------------------

function update(dt) {
  if (state.paused) return;
  if (state.flashT > 0) state.flashT -= dt;
  for (const r of state.resources) if (r.shake > 0) r.shake -= dt;

  if (state.clearing > 0) {
    state.clearing -= dt;
    if (state.clearing <= 0) {
      state.zone++;
      startZone();
      flash(`Zone ${state.zone + 1}`);
    }
  }

  updateLeader(dt);

  const attackers = new Map();
  for (const m of state.minions) {
    if (m.target && !m.target.done) attackers.set(m.target, (attackers.get(m.target) || 0) + 1);
  }
  for (const m of state.minions) updateMinion(m, dt, attackers);
  resolveCollisions();

  // Harvest everything that reached zero HP.
  for (const r of state.resources) {
    if (r.hp <= 0 && !r.done) {
      r.done = true;
      state.wood += r.value;
    }
  }
  state.resources = state.resources.filter((r) => !r.done);

  if (state.resources.length === 0 && state.clearing <= 0) {
    state.clearing = CONFIG.clearDelay;
    flash('Zone cleared!');
  }
}

function flash(text) {
  state.flash = text;
  state.flashT = 1.8;
}

// ---- Actions ---------------------------------------------------------------

function hire() {
  const cost = hireCost();
  if (state.wood < cost) return;
  state.wood -= cost;
  state.minions.push(spawnNearLeader(CONFIG.small));
}

function merge() {
  const smalls = state.minions.filter((m) => m.type === CONFIG.small);
  if (smalls.length < 2 || state.wood < CONFIG.mergeCost) return;
  state.wood -= CONFIG.mergeCost;
  const [a, b] = smalls;
  const big = spawn(CONFIG.big, (a.x + b.x) / 2, (a.y + b.y) / 2);
  state.minions = state.minions.filter((m) => m !== a && m !== b);
  state.minions.push(big);
}

document.getElementById('hire').addEventListener('click', hire);
document.getElementById('merge').addEventListener('click', merge);

function restart() {
  state.wood = 0;
  state.zone = 0;
  state.clearing = 0;
  state.flashT = 0;
  state.guide = null;
  state.leader.x = W / 2;
  state.leader.y = H - 90;
  state.minions = [];
  for (let i = 0; i < CONFIG.startMinions; i++) state.minions.push(spawnNearLeader(CONFIG.small));
  startZone();
}

// ---- Tap to guide ----------------------------------------------------------

function toCanvas(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(W, ((e.clientX - rect.left) * W) / rect.width)),
    y: Math.max(0, Math.min(H, ((e.clientY - rect.top) * H) / rect.height)),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  state.guide = { ...toCanvas(e), held: true, linger: CONFIG.guide.linger };
});
canvas.addEventListener('pointermove', (e) => {
  if (state.guide && state.guide.held) Object.assign(state.guide, toCanvas(e));
});
const releaseGuide = () => {
  if (state.guide) {
    state.guide.held = false;
    state.guide.linger = CONFIG.guide.linger;
  }
};
canvas.addEventListener('pointerup', releaseGuide);
canvas.addEventListener('pointercancel', releaseGuide);

// ---- Render ----------------------------------------------------------------

function draw() {
  ctx.fillStyle = '#1f3a24';
  ctx.fillRect(0, 0, W, H);

  for (const r of state.resources) {
    const h = r.size / 2;
    let sx = 0, sy = 0;
    if (r.shake > 0 && CONFIG.shake.duration > 0) {
      const k = Math.min(1, r.shake / CONFIG.shake.duration) * CONFIG.shake.amount;
      sx = (Math.random() * 2 - 1) * k;
      sy = (Math.random() * 2 - 1) * k;
    }
    const x = r.x + sx;
    const y = r.y + sy;
    ctx.fillStyle = r.big ? CONFIG.zone.bigColor : CONFIG.zone.smallColor;
    ctx.fillRect(x - h, y - h, r.size, r.size);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - h, y - h, r.size, r.size);
    if (r.hp < r.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(r.x - h, r.y - h - 7, r.size, 4);
      ctx.fillStyle = '#f5e663';
      ctx.fillRect(r.x - h, r.y - h - 7, r.size * Math.max(r.hp, 0) / r.maxHp, 4);
    }
  }

  if (state.guide && CONFIG.guide.showMarker) {
    ctx.globalAlpha = state.guide.held ? 0.8 : 0.4;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.guide.x, state.guide.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const m of state.minions) {
    ctx.fillStyle = m.type.color;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.type.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (CONFIG.showLeader) {
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(state.leader.x, state.leader.y, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#e8f5ea';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Zone ${state.zone + 1}`, 54, 24); // leaves room for the ⚙ button
  ctx.fillText(`Wood ${Math.floor(state.wood)}`, 54, 46);
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
  const cost = hireCost();
  hireBtn.textContent = `Hire minion (${cost} wood)`;
  hireBtn.disabled = state.wood < cost;
  const smalls = state.minions.filter((m) => m.type === CONFIG.small).length;
  mergeBtn.textContent = `Merge 2 small → big (${CONFIG.mergeCost})`;
  mergeBtn.disabled = smalls < 2 || state.wood < CONFIG.mergeCost;
}

// ---- Loop ------------------------------------------------------------------

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

// Load saved settings before the first spawn so start values apply.
if (window.SettingsPanel) {
  SettingsPanel.init({
    config: CONFIG,
    storageKey: 'minion-swarm.config',
    mount: canvas.parentElement,
    onRestart: restart,
    onToggle: (open) => { state.paused = open; },
  });
}

restart();
window.game = state;    // handy for testing in the console
window.CONFIG = CONFIG;
requestAnimationFrame(frame);
