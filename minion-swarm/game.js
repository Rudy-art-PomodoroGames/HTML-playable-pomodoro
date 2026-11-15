// Minion Swarm — core gameplay prototype.
// An invisible leader (the future player) walks to resources. The swarm
// follows it with a delay, harvests what is near it, and minions push each
// other like physics bodies. Clear a zone and the next one starts
// automatically (Auto Drill style).

// ---- Tunable values (all in one place) ------------------------------------

const CONFIG = {
  startMinions: 4,

  // Minion stats by level. Level 1 uses the base values; each level up
  // multiplies them. Merging two minions of the same level makes one of the
  // next level (2048 style). Merging is free.
  minion: {
    baseDmg: 1, dmgMultPerLevel: 2.5,             // damage per hit (rounded)
    baseInterval: 0.4, intervalMultPerLevel: 1.2, // seconds between hits
    baseSpeed: 110, speedMultPerLevel: 0.93,
    baseRadius: 6, radiusPerLevel: 2, maxRadius: 18,
    showLevel: true,                              // level number on minions of level 2+
    colors: ['#7bd389', '#f2a65a', '#6ec6ff', '#c792ea', '#ff6b6b', '#ffd93d', '#ffffff', '#a0e7e5'],
  },

  // Price of the Nth minion bought. Based on total purchases, so merging
  // never makes hiring cheaper.
  hireBaseCost: 10,
  hireCostStep: 5,

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
    smallHp: 3, bigHp: 12,          // HP in zone 1
    hpMultPerZone: 1.35,            // HP × this for each zone after
    smallValue: 2, bigValue: 6,     // wood in zone 1
    valueMultPerZone: 1.3,          // wood × this for each zone after
    smallColor: '#b5552f', bigColor: '#7d2a1c',
  },

  guide: {
    speed: 120,             // how fast the swarm heads to a tapped point
    showMarker: true,       // draw a ring where the player tapped
  },

  shake: {
    duration: 0.15,         // seconds a resource shakes after a hit
    amount: 2.5,            // shake strength in pixels
  },

  hpText: {
    show: true,
    smallFontSize: 11,
    bigFontSize: 16,
    color: '#ffffff',
  },

  damagePopup: {
    show: true,
    duration: 0.7,          // seconds until fully faded
    rise: 18,               // pixels the number floats up
    popScale: 1.6,          // starting size, shrinks to 1 right away
    fontSize: 13,
    color: '#ffe066',
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
  purchases: 0,             // minions bought this run (sets the hire price)
  minions: [],
  resources: [],
  leader: { x: W / 2, y: H - 90, target: null },
  guide: null,              // { x, y } tapped point the swarm is heading to
  popups: [],               // floating damage numbers
  paused: false,
  clearing: 0,
  flash: '',
  flashT: 0,
};

const hireCost = () => CONFIG.hireBaseCost + state.purchases * CONFIG.hireCostStep;

// Stats for a minion level, from the CONFIG.minion multipliers.
function statsFor(level) {
  const c = CONFIG.minion;
  const n = level - 1;
  return {
    dmg: Math.max(1, Math.round(c.baseDmg * Math.pow(c.dmgMultPerLevel, n))),
    interval: c.baseInterval * Math.pow(c.intervalMultPerLevel, n),
    speed: c.baseSpeed * Math.pow(c.speedMultPerLevel, n),
    radius: Math.min(c.maxRadius, c.baseRadius + c.radiusPerLevel * n),
    color: c.colors[n % c.colors.length],
  };
}

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
    const maxHp = Math.max(1, Math.round((big ? z.bigHp : z.smallHp) * Math.pow(z.hpMultPerZone, index)));
    list.push({
      x, y, size, big, maxHp, hp: maxHp,
      value: Math.max(1, Math.round((big ? z.bigValue : z.smallValue) * Math.pow(z.valueMultPerZone, index))),
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

// m.type holds the stats for m.level; it's refreshed every frame so changes
// in the settings panel apply live.
function spawn(level, x, y) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.random() * CONFIG.formationRadius;
  return {
    level, type: statsFor(level), x, y, vx: 0, vy: 0, cd: 0, target: null,
    ox: Math.cos(a) * r, oy: Math.sin(a) * r, // resting spot around the leader
  };
}

function spawnNearLeader(level) {
  const L = state.leader;
  return spawn(level, L.x + (Math.random() - 0.5) * 30, L.y + (Math.random() - 0.5) * 30);
}

// The pair the Merge button will combine: lowest level that has two
// minions, and of those, the two closest to each other.
function nextMergePair() {
  const byLevel = new Map();
  for (const m of state.minions) {
    if (!byLevel.has(m.level)) byLevel.set(m.level, []);
    byLevel.get(m.level).push(m);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  for (const lvl of levels) {
    const list = byLevel.get(lvl);
    if (list.length < 2) continue;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y);
        if (d < bestD) { bestD = d; best = [list[i], list[j]]; }
      }
    }
    return best;
  }
  return null;
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

  // While heading to a tapped point, ignore resources on the way.
  if (state.guide && m.target) {
    attackers.set(m.target, (attackers.get(m.target) || 1) - 1);
    m.target = null;
  }

  if (!state.guide && (!m.target || !inSwarmRange(m.target))) {
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
      if (CONFIG.damagePopup.show) {
        const c = closestPoint(m.target, m.x, m.y); // where the minion touches it
        state.popups.push({ x: c.x, y: c.y, text: String(t.dmg), age: 0 });
      }
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

  // A tap overrides everything: go straight to the tapped point. On arrival,
  // harvest the tapped resource, or the closest one if the tap hit empty ground.
  const g = state.guide;
  if (g) {
    const dx = g.x - L.x;
    const dy = g.y - L.y;
    const d = Math.hypot(dx, dy);
    const step = CONFIG.guide.speed * dt;
    if (d > step) {
      L.x += (dx / d) * step;
      L.y += (dy / d) * step;
      return;
    }
    L.x = g.x;
    L.y = g.y;
    state.guide = null;
    L.target = state.resources.find((r) => !r.done && distToRect(r, g.x, g.y) === 0) || null;
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
  for (const m of state.minions) m.type = statsFor(m.level);
  if (state.paused) return;
  if (state.flashT > 0) state.flashT -= dt;
  for (const r of state.resources) if (r.shake > 0) r.shake -= dt;
  for (const p of state.popups) p.age += dt;
  state.popups = state.popups.filter((p) => p.age < CONFIG.damagePopup.duration);

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
  state.purchases++;
  state.minions.push(spawnNearLeader(1));
}

// Free 2048-style merge: the two closest minions of the lowest level that
// has a pair become one minion of the next level.
function merge() {
  const pair = nextMergePair();
  if (!pair) return;
  const [a, b] = pair;
  const merged = spawn(a.level + 1, (a.x + b.x) / 2, (a.y + b.y) / 2);
  state.minions = state.minions.filter((m) => m !== a && m !== b);
  state.minions.push(merged);
}

document.getElementById('hire').addEventListener('click', hire);
document.getElementById('merge').addEventListener('click', merge);

function restart() {
  state.wood = 0;
  state.zone = 0;
  state.purchases = 0;
  state.clearing = 0;
  state.flashT = 0;
  state.guide = null;
  state.popups = [];
  state.leader.x = W / 2;
  state.leader.y = H - 90;
  state.minions = [];
  for (let i = 0; i < CONFIG.startMinions; i++) state.minions.push(spawnNearLeader(1));
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

// Tap only: each tap replaces any previous move. Holding or dragging does nothing extra.
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  state.guide = toCanvas(e);
  state.leader.target = null;
});

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
    r.drawX = x; // shaken position, reused by the overlay pass
    r.drawY = y;
  }

  for (const m of state.minions) {
    ctx.fillStyle = m.type.color;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.type.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (CONFIG.minion.showLevel && m.level > 1) {
      ctx.fillStyle = '#1b2a1e';
      ctx.font = `bold ${Math.max(8, Math.round(m.type.radius * 1.1))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(m.level), m.x, m.y + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }

  // Overlays: HP bars, HP numbers and damage numbers always draw on top of
  // minions and resources.
  for (const r of state.resources) {
    const h = r.size / 2;
    const x = r.drawX;
    const y = r.drawY;
    if (r.hp < r.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(r.x - h, r.y - h - 7, r.size, 4);
      ctx.fillStyle = '#f5e663';
      ctx.fillRect(r.x - h, r.y - h - 7, r.size * Math.max(r.hp, 0) / r.maxHp, 4);
    }
    if (CONFIG.hpText.show) {
      // Drawn at the shaken position so the number shakes with the resource.
      const size = r.big ? CONFIG.hpText.bigFontSize : CONFIG.hpText.smallFontSize;
      ctx.font = `bold ${size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(String(Math.max(0, Math.ceil(r.hp))), x, y + 1);
      ctx.fillStyle = CONFIG.hpText.color;
      ctx.fillText(String(Math.max(0, Math.ceil(r.hp))), x, y + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }

  // Damage numbers: pop in big, shrink to normal, float up, fade to zero.
  const pc = CONFIG.damagePopup;
  for (const p of state.popups) {
    const k = Math.min(1, p.age / pc.duration);
    const pop = 1 + (pc.popScale - 1) * Math.max(0, 1 - p.age / 0.12);
    ctx.globalAlpha = 1 - k;
    ctx.font = `bold ${Math.round(pc.fontSize * pop)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(p.text, p.x, p.y - pc.rise * k);
    ctx.fillStyle = pc.color;
    ctx.fillText(p.text, p.x, p.y - pc.rise * k);
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  if (state.guide && CONFIG.guide.showMarker) {
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.guide.x, state.guide.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
  const pair = nextMergePair();
  mergeBtn.textContent = pair ? `Merge Lv${pair[0].level} → Lv${pair[0].level + 1}` : 'Merge';
  mergeBtn.disabled = !pair;
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
