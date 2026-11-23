// Minion Swarm — core gameplay prototype.
// An invisible leader (the future player) walks to resources. The swarm
// follows it with a delay, harvests what is near it, and minions push each
// other like physics bodies. Clear a zone and the next one starts
// automatically (Auto Drill style).

// Build number, shown in the corner. Bump it together with the ?v= in
// index.html on every push so phones load the new version.
const BUILD = 22;

// ---- Tunable values (all in one place) ------------------------------------

const CONFIG = {
  startMinions: 10,

  // Minion stats by level. Level 1 uses the base values; each level up
  // multiplies them. Merging two minions of the same level makes one of the
  // next level (2048 style). Merging is free.
  minion: {
    baseDmg: 1, dmgMultPerLevel: 2.5,             // damage per hit (rounded)
    baseInterval: 0.4, intervalMultPerLevel: 1.2, // seconds between hits
    baseSpeed: 110, speedMultPerLevel: 0.93,
    baseRadius: 16.2, radiusPerLevel: 8.1,          // size keeps growing with every level
    showLevel: true,                              // level number on minions of level 2+
    colors: ['#7bd389', '#f2a65a', '#6ec6ff', '#c792ea', '#ff6b6b', '#ffd93d', '#ffffff', '#a0e7e5'],
  },

  // Price of the Nth minion bought. Based on total purchases, so merging
  // never makes hiring cheaper.
  mergeHighestFirst: true,  // Merge button: off = lowest level pair first, on = highest level pair first

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
    colliderScale: 1,               // collider circle diameter = resource size × this
  },

  guide: {
    speed: 120,             // how fast the swarm heads to a tapped point
    showMarker: true,       // draw a ring where the player tapped
  },

  bounce: {
    show: true,
    amount: 0.1,            // squash & stretch strength (0.1 = 10% wider/taller)
    stepLength: 14,         // pixels travelled per bounce
    variation: 0.2,         // each minion's rhythm differs by up to ±20% so they don't bounce in sync
    minSpeed: 15,           // below this speed a minion counts as standing still
    fade: 8,                // how fast the bounce fades in and out
  },

  // Wobble: the minion rocks left and right from its feet while it walks,
  // on top of the bounce (fades in and out with it).
  wobble: {
    show: true,
    angle: 5,               // max tilt in degrees each side
    perBounce: 0.5,         // tilt cycles per bounce; 0.5 = left on one step, right on the next
  },

  // Round shadow under each minion's feet. Doesn't wobble or bounce.
  shadow: {
    show: true,
    opacity: 0.15,          // 0 = invisible, 1 = solid black
    width: 0.7,             // shadow width × minion width
    flatness: 0.45,         // height ÷ width; 1 = full circle, lower = flatter oval
    offsetY: 0,             // move the shadow down (+) or up (−), × minion radius
  },

  facing: {
    flip: true,             // mirror the minion art so it faces the way it moves
    artFacesRight: true,    // which way your minion art looks; off = it looks left
    deadZone: 20,           // sideways speed (px/s) needed to turn, so minions don't flicker moving up/down
    faceTargetWhenHitting: true, // while hitting, face the resource
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
  showColliders: false,     // debug: draw resource collider circles
};

// Explanations shown when tapping a setting's name in the ⚙ panel.
const CONFIG_HELP = {
  startMinions: 'How many level 1 minions you start with. Applies on Restart.',
  'minion.baseDmg': 'Damage per hit of a level 1 minion.',
  'minion.dmgMultPerLevel': 'Damage per hit is multiplied by this at each level (rounded). 2.5 means Lv1 = 1, Lv2 = 3, Lv3 = 6, Lv4 = 16.',
  'minion.baseInterval': 'Seconds between two hits for a level 1 minion. Lower = faster attacks.',
  'minion.intervalMultPerLevel': 'Time between hits is multiplied by this at each level. Above 1 = higher levels hit slower. Set to 1 so all levels hit at the same speed.',
  'minion.baseSpeed': 'Movement speed of a level 1 minion, in pixels per second.',
  'minion.speedMultPerLevel': 'Movement speed is multiplied by this at each level. Below 1 = higher levels move slower.',
  'minion.baseRadius': 'Size (radius in pixels) of a level 1 minion.',
  'minion.radiusPerLevel': 'Pixels added to the size at each level. Bigger minions take more room around a resource.',
  'minion.showLevel': 'Show the level number on minions of level 2 and up.',
  'minion.colors': 'Color of each level: first = level 1, second = level 2, and so on. Repeats after the last one.',
  mergeHighestFirst: 'Off: the Merge button combines the lowest-level pair first. On: it combines the highest-level pair first.',
  hireBaseCost: 'Wood price of the first minion you hire.',
  hireCostStep: 'Wood added to the price for every minion hired. Merging never lowers the price.',
  leaderSpeed: 'Speed of the invisible leader the swarm follows when it moves on its own. Keep it below the minion speed so the swarm keeps up.',
  leaderStopDistance: 'How close the leader walks to the resource it is heading for, in pixels.',
  leaderWaitDistance: 'If the swarm falls this far behind (pixels), the leader waits for it. Keeps the group together.',
  swarmRadius: 'Minions only attack resources within this distance (pixels) of the leader. Bigger = the swarm spreads over more resources at once.',
  formationRadius: 'How spread out minions rest around the leader when not attacking, in pixels.',
  followResponsiveness: 'How quickly minions react to changes of direction. Higher = snappier, lower = more delay and drift.',
  crowdPenalty: 'How strongly minions avoid resources other minions are already attacking. Higher = they spread out more.',
  collisionPasses: 'How many times per frame minion collisions are solved. Higher = less overlap, a bit more work for the phone.',
  'zone.baseCount': 'Number of resources in zone 1. Applies from the next zone or on Restart.',
  'zone.countPerZone': 'Resources added for each zone after the first. Applies from the next zone or on Restart.',
  'zone.bigChanceBase': 'Chance (0 to 1) that a resource is a big tree in zone 1. Applies from the next zone or on Restart.',
  'zone.bigChancePerZone': 'Big tree chance added for each zone after the first. Applies from the next zone or on Restart.',
  'zone.bigChanceMax': 'Highest big tree chance, whatever the zone. Applies from the next zone or on Restart.',
  'zone.smallSize': 'Size of small resources (bushes), in pixels. Applies from the next zone or on Restart.',
  'zone.bigSize': 'Size of big resources (trees), in pixels. Applies from the next zone or on Restart.',
  'zone.smallHp': 'HP of a small resource in zone 1. Applies from the next zone or on Restart.',
  'zone.bigHp': 'HP of a big resource in zone 1. Applies from the next zone or on Restart.',
  'zone.hpMultPerZone': 'Resource HP is multiplied by this for each zone after the first. 1.35 = +35% per zone. Applies from the next zone or on Restart.',
  'zone.smallValue': 'Wood earned from a small resource in zone 1. Applies from the next zone or on Restart.',
  'zone.bigValue': 'Wood earned from a big resource in zone 1. Applies from the next zone or on Restart.',
  'zone.valueMultPerZone': 'Wood earned is multiplied by this for each zone after the first. Applies from the next zone or on Restart.',
  'zone.smallColor': 'Color of small resources.',
  'zone.bigColor': 'Color of big resources.',
  'guide.speed': 'How fast the swarm heads to the point you tap, in pixels per second.',
  'guide.showMarker': 'Show a white ring where you tapped until the swarm gets there.',
  'bounce.show': 'Minions squash and stretch while they move. Never while hitting.',
  'bounce.amount': 'Strength of the squash and stretch. 0.1 = 10% wider then 10% taller. Keep it small for a subtle effect.',
  'bounce.stepLength': 'Pixels a minion travels per bounce. Lower = faster bouncing.',
  'bounce.variation': 'How different each minion\'s bounce rhythm is, so the swarm doesn\'t bounce in sync. 0 = all the same, 0.2 = each up to 20% faster or slower.',
  'bounce.minSpeed': 'Below this speed a minion counts as standing still and stops bouncing.',
  'bounce.fade': 'How quickly the bounce fades in when a minion starts moving and out when it stops.',
  'wobble.show': 'While walking, minions rock left and right from the bottom center of their sprite, on top of the bounce.',
  'wobble.angle': 'How far a minion tilts to each side while walking, in degrees.',
  'shadow.show': 'Draw a soft round shadow under each minion. It stays still while the minion wobbles and bounces.',
  'shadow.opacity': 'How dark the shadow is. 0 = invisible, 1 = solid black. The background shows through below 1.',
  'shadow.width': 'Shadow width compared to the minion. 1 = as wide as the minion.',
  'shadow.flatness': 'Shadow height divided by its width. 1 = a full circle, 0.35 = a flat oval like a shadow on the ground.',
  'shadow.offsetY': 'Moves the shadow down (positive) or up (negative), in minion radii. 0 = centered on the minion\'s feet.',
  'wobble.perBounce': 'Tilt cycles per bounce. 0.5 = tilts left on one step and right on the next. 1 = a full left-right on every bounce.',
  'facing.flip': 'Minions turn left or right to face the way they move, by mirroring their art. The level number is never mirrored.',
  'facing.artFacesRight': 'On: your minion art looks to the right. Off: it looks to the left. Set this to match your sprites so they don\'t walk backwards.',
  'facing.deadZone': 'Sideways speed (pixels per second) a minion needs before it turns. Higher = fewer turns when moving mostly up or down.',
  'facing.faceTargetWhenHitting': 'While hitting a resource, the minion faces it. Off: it keeps the direction it last moved in.',
  'shake.duration':'How long a resource shakes after a hit, in seconds.',
  'shake.amount': 'How strongly a resource shakes after a hit, in pixels.',
  'hpText.show': 'Show the remaining HP number in the middle of each resource.',
  'hpText.smallFontSize': 'Text size of the HP number on small resources.',
  'hpText.bigFontSize': 'Text size of the HP number on big resources.',
  'hpText.color': 'Color of the HP number.',
  'damagePopup.show': 'Show a number for each hit, popping where the minion touches the resource.',
  'damagePopup.duration': 'How long a damage number stays before it has fully faded, in seconds.',
  'damagePopup.rise': 'How far a damage number floats up while fading, in pixels.',
  'damagePopup.popScale': 'How big a damage number starts before shrinking to normal size. 1 = no pop.',
  'damagePopup.fontSize': 'Text size of damage numbers.',
  'damagePopup.color': 'Color of damage numbers.',
  clearDelay: 'Pause in seconds between clearing a zone and the next zone appearing.',
  'zone.colliderScale': 'Size of the round collider minions bump into and hit, compared to the resource art. 1 = a circle touching the art\'s edges, 0.8 = smaller so minions overlap the art a bit, 1.2 = bigger.',
  showColliders: 'Debug: draw each resource\'s collider circle in cyan, to check it against your art.',
  showLeader: 'Debug: show the invisible leader the swarm follows, as a small white circle.',
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
    radius: c.baseRadius + c.radiusPerLevel * n,
    color: c.colors[n % c.colors.length],
  };
}

// ---- Geometry helpers ------------------------------------------------------

// Resources collide as a circle that fits inside the art (diameter = size),
// scaled by zone.colliderScale. Works for round art and is a close enough
// fit for square art.
const resRadius = (r) => (r.size / 2) * CONFIG.zone.colliderScale;

// Closest point of the resource's collider circle (the point itself when inside).
function closestPoint(r, px, py) {
  const dx = px - r.x;
  const dy = py - r.y;
  const d = Math.hypot(dx, dy);
  const R = resRadius(r);
  if (d <= R) return { x: px, y: py };
  return { x: r.x + (dx / d) * R, y: r.y + (dy / d) * R };
}

function distToResource(r, px, py) {
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
    attacking: false, face: 1, bounceAmp: 0, bouncePhase: Math.random() * Math.PI * 2,
    bounceRand: Math.random() * 2 - 1, // this minion's own rhythm offset
    ox: Math.cos(a) * r, oy: Math.sin(a) * r, // resting spot around the leader
  };
}

function spawnNearLeader(level) {
  const L = state.leader;
  return spawn(level, L.x + (Math.random() - 0.5) * 30, L.y + (Math.random() - 0.5) * 30);
}

// The pair the Merge button will combine: the lowest (or, with
// mergeHighestFirst, the highest) level that has two minions, and of those,
// the two closest to each other.
function nextMergePair() {
  const byLevel = new Map();
  for (const m of state.minions) {
    if (!byLevel.has(m.level)) byLevel.set(m.level, []);
    byLevel.get(m.level).push(m);
  }
  const levels = [...byLevel.keys()].sort((a, b) => (CONFIG.mergeHighestFirst ? b - a : a - b));
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
  return !r.done && distToResource(r, state.leader.x, state.leader.y) <= CONFIG.swarmRadius;
}

function pickTarget(m, attackers) {
  let best = null;
  let bestScore = Infinity;
  for (const r of state.resources) {
    if (!inSwarmRange(r)) continue;
    const score = distToResource(r, m.x, m.y) + (attackers.get(r) || 0) * CONFIG.crowdPenalty;
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

  // Squash & stretch while moving, never while hitting.
  const b = CONFIG.bounce;
  const speedNow = Math.hypot(m.vx, m.vy);
  m.attacking = !!m.target && distToResource(m.target, m.x, m.y) <= t.radius + 3;

  // Facing: 1 = right, -1 = left. Turn only on clear sideways movement.
  const f = CONFIG.facing;
  if (m.attacking && f.faceTargetWhenHitting) {
    const side = m.target.x - m.x;
    if (Math.abs(side) > 2) m.face = Math.sign(side);
  } else if (Math.abs(m.vx) > f.deadZone) {
    m.face = Math.sign(m.vx);
  }
  const bouncing = b.show && !m.attacking && speedNow > b.minSpeed;
  m.bounceAmp += ((bouncing ? 1 : 0) - m.bounceAmp) * Math.min(1, b.fade * dt);
  const rhythm = 1 + m.bounceRand * b.variation;
  if (b.stepLength > 0) m.bouncePhase += (speedNow * dt * rhythm / b.stepLength) * Math.PI * 2;

  // Attack when touching the resource.
  if (m.attacking) {
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
        // Circle vs circle: push the minion out of the resource's collider.
        let dx = m.x - r.x;
        let dy = m.y - r.y;
        let d = Math.hypot(dx, dy);
        const min = resRadius(r) + rad;
        if (d >= min) continue;
        if (d === 0) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
        m.x = r.x + (dx / d) * min;
        m.y = r.y + (dy / d) * min;
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
    L.target = state.resources.find((r) => !r.done && distToResource(r, g.x, g.y) === 0) || null;
    return;
  }

  if (!L.target || L.target.done) {
    let best = null;
    let bestD = Infinity;
    for (const r of state.resources) {
      if (r.done) continue;
      const d = distToResource(r, L.x, L.y);
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

// ---- Assets ------------------------------------------------------------------
// Every image the game uses. Each one falls back to the built-in drawn shape
// below when there's no image (your upload in 🎨, or assets/<key>.webp / .png).

const BACKGROUND_COLOR = '#1f3a24';
const MINION_ART_LEVELS = 8; // minion_lv1..lv8; higher levels reuse them in a cycle

const gameFont = () => (window.AssetPanel ? AssetPanel.fontStack : 'system-ui, sans-serif');

function drawMinionShape(c, radius, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(0, 0, radius, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 1.5;
  c.stroke();
  // Eye on the right, so the default art shows which way it faces.
  c.fillStyle = '#1b2a1e';
  c.beginPath();
  c.arc(radius * 0.5, -radius * 0.35, Math.max(1.2, radius * 0.18), 0, Math.PI * 2);
  c.fill();
}

function drawLevelNumber(c, radius, level) {
  c.fillStyle = '#1b2a1e';
  c.font = `bold ${Math.max(8, Math.round(radius * 1.1))}px ${gameFont()}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(String(level), 0, 1);
  c.textBaseline = 'alphabetic';
}

function drawResourceShape(c, x, y, size, color) {
  const h = size / 2;
  c.fillStyle = color;
  c.fillRect(x - h, y - h, size, size);
  c.strokeStyle = 'rgba(0,0,0,0.4)';
  c.lineWidth = 2;
  c.strokeRect(x - h, y - h, size, size);
}

function drawMarkerShape(c, x, y) {
  c.strokeStyle = '#ffffff';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, 14, 0, Math.PI * 2);
  c.stroke();
}

// Solid black oval centered on 0,0; opacity is applied when drawing.
function drawShadowShape(c, rx, ry) {
  c.fillStyle = '#000';
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

const minionArtKey = (level) => `minion_lv${((level - 1) % MINION_ART_LEVELS) + 1}`;

const ASSETS = [
  { key: 'background', label: 'Background', size: '720×1120 (fills the play area)',
    draw: (c, w, h) => { c.fillStyle = BACKGROUND_COLOR; c.fillRect(0, 0, w, h); } },
  ...Array.from({ length: MINION_ART_LEVELS }, (_, i) => ({
    key: `minion_lv${i + 1}`, label: `Minion level ${i + 1}`, size: '128×128 (square, transparent)',
    draw: (c, w, h) => {
      const level = i + 1;
      c.translate(w / 2, h / 2);
      drawMinionShape(c, w * 0.38, CONFIG.minion.colors[i % CONFIG.minion.colors.length]);
      if (level > 1) drawLevelNumber(c, w * 0.38, level);
    },
  })),
  { key: 'minion_shadow', label: 'Minion shadow', size: '128×128 (transparent, drawn see-through by shadow.opacity)',
    draw: (c, w, h) => { c.translate(w / 2, h / 2); drawShadowShape(c, w / 2, h / 2); } },
  { key: 'resource_small', label: 'Small resource (bush)', size: '64×64 (square)',
    draw: (c, w, h) => drawResourceShape(c, w / 2, h / 2, w * 0.6, CONFIG.zone.smallColor) },
  { key: 'resource_big', label: 'Big resource (tree)', size: '128×128 (square)',
    draw: (c, w, h) => drawResourceShape(c, w / 2, h / 2, w * 0.8, CONFIG.zone.bigColor) },
  { key: 'tap_marker', label: 'Tap marker', size: '64×64 (square, transparent)',
    draw: (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, w, h); drawMarkerShape(c, w / 2, h / 2); } },
];

const art = (key) => (window.AssetPanel ? AssetPanel.image(key) : null);

// ---- Render ----------------------------------------------------------------

function draw() {
  const bg = art('background');
  if (bg) ctx.drawImage(bg, 0, 0, W, H);
  else { ctx.fillStyle = BACKGROUND_COLOR; ctx.fillRect(0, 0, W, H); }

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
    const img = art(r.big ? 'resource_big' : 'resource_small');
    if (img) ctx.drawImage(img, x - h, y - h, r.size, r.size);
    else drawResourceShape(ctx, x, y, r.size, r.big ? CONFIG.zone.bigColor : CONFIG.zone.smallColor);
    r.drawX = x; // shaken position, reused by the overlay pass
    r.drawY = y;
  }

  // Shadows first, so no minion's shadow covers another minion.
  const sh = CONFIG.shadow;
  if (sh.show && sh.opacity > 0) {
    const shImg = art('minion_shadow');
    ctx.save();
    ctx.globalAlpha = Math.min(1, sh.opacity);
    for (const m of state.minions) {
      const rad = m.type.radius;
      const rx = rad * sh.width;
      const ry = rx * sh.flatness;
      const y = m.y + rad + rad * sh.offsetY;
      if (shImg) ctx.drawImage(shImg, m.x - rx, y - ry, rx * 2, ry * 2);
      else { ctx.save(); ctx.translate(m.x, y); drawShadowShape(ctx, rx, ry); ctx.restore(); }
    }
    ctx.restore();
  }

  for (const m of state.minions) {
    // Squash & stretch: wider when flatter, taller when narrower.
    const k = CONFIG.bounce.amount * m.bounceAmp * Math.sin(m.bouncePhase);
    const img = art(minionArtKey(m.level));
    const rad = m.type.radius;
    ctx.save();
    // Wobble: tilt around the bottom center of the sprite.
    const w = CONFIG.wobble;
    if (w.show && m.bounceAmp > 0.001) {
      const tilt = (w.angle * Math.PI / 180) * m.bounceAmp * Math.sin(m.bouncePhase * w.perBounce);
      ctx.translate(m.x, m.y + rad);
      ctx.rotate(tilt);
      ctx.translate(0, -rad);
    } else ctx.translate(m.x, m.y);
    ctx.scale(1 + k, 1 - k);
    // Mirror only the art, so the level number stays readable.
    const fc = CONFIG.facing;
    const mirror = fc.flip && m.face !== (fc.artFacesRight ? 1 : -1);
    if (mirror) { ctx.save(); ctx.scale(-1, 1); }
    if (img) ctx.drawImage(img, -rad, -rad, rad * 2, rad * 2);
    else drawMinionShape(ctx, rad, m.type.color);
    if (mirror) ctx.restore();
    if (CONFIG.minion.showLevel && m.level > 1) drawLevelNumber(ctx, rad, m.level);
    ctx.restore();
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
      ctx.font = `bold ${size}px ${gameFont()}`;
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
    ctx.font = `bold ${Math.round(pc.fontSize * pop)}px ${gameFont()}`;
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
    const img = art('tap_marker');
    if (img) ctx.drawImage(img, state.guide.x - 14, state.guide.y - 14, 28, 28);
    else drawMarkerShape(ctx, state.guide.x, state.guide.y);
    ctx.globalAlpha = 1;
  }

  if (CONFIG.showColliders) {
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    for (const r of state.resources) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, resRadius(r), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (CONFIG.showLeader) {
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(state.leader.x, state.leader.y, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#e8f5ea';
  ctx.font = `bold 16px ${gameFont()}`;
  ctx.textAlign = 'left';
  ctx.fillText(`Zone ${state.zone + 1}`, 54, 24); // leaves room for the ⚙ button
  ctx.fillText(`Wood ${Math.floor(state.wood)}`, 54, 46);
  ctx.textAlign = 'right';
  ctx.fillText(`Minions ${state.minions.length}`, W - 12, 24);

  ctx.globalAlpha = 0.4;
  ctx.font = `11px ${gameFont()}`;
  ctx.textAlign = 'right';
  ctx.fillText(`build ${BUILD}`, W - 8, H - 8);
  ctx.globalAlpha = 1;

  if (state.flashT > 0) {
    ctx.globalAlpha = Math.min(1, state.flashT);
    ctx.textAlign = 'center';
    ctx.font = `bold 26px ${gameFont()}`;
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
    help: CONFIG_HELP,
    mount: canvas.parentElement,
    onRestart: restart,
    onToggle: (open) => { state.paused = open; },
  });
}

// Asset panel (🎨): replace any image or the font. Falls back to the drawn shapes.
if (window.AssetPanel) {
  AssetPanel.init({
    storageKey: 'minion-swarm.assets',
    basePath: 'assets/',
    mount: canvas.parentElement,
    uploadUrl: 'https://github.com/Rudy-art-PomodoroGames/HTML-playable-pomodoro/upload/main/minion-swarm/assets',
    images: ASSETS,
    font: { family: 'GameFont', fallback: 'system-ui, sans-serif' },
    onFontChange: (stack) => document.documentElement.style.setProperty('--game-font', stack),
    onToggle: (open) => { state.paused = open; },
  });
}

restart();
window.game = state;    // handy for testing in the console
window.CONFIG = CONFIG;
requestAnimationFrame(frame);
