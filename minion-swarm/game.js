// Minion Swarm — core gameplay prototype.
// An invisible leader (the future player) walks to resources. The swarm
// follows it with a delay, harvests what is near it, and minions push each
// other like physics bodies. Clear a zone and the next one starts
// automatically (Auto Drill style).

// Build number, shown in the corner. Bump it together with the ?v= in
// index.html on every push so phones load the new version.
const BUILD = 36;

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
    showLevel: false,                             // level number on minions of level 2+
    colliderScale: 0.9,                           // collider circle = drawn body × this (legs and shadow not included)
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
    hpMultPerZone: 1.35,            // HP × this for each zone after
    valueMultPerZone: 1.3,          // wood × this for each zone after
    colliderScale: 0.75,            // collider circle diameter = resource size × this
  },

  // Resource types. Each spawned resource picks a type at random, in
  // proportion to its weight: weight + weightPerZone × (zone − 1), never below 0.
  // A type with weight 0 never appears. hp and value are for zone 1.
  resources: {
    res1: { size: 20, hp: 3, value: 2, weight: 0.8, weightPerZone: -0.1, hpFontSize: 11, color: '#20315d', splashColor: '#4369d0' },
    res2: { size: 40, hp: 12, value: 6, weight: 0.2, weightPerZone: 0.1, hpFontSize: 12, color: '#7d2a1c', splashColor: '#fc2d37' },
    res3: { size: 28, hp: 50, value: 4, weight: 0.4, weightPerZone: 0, hpFontSize: 13, color: '#c9822b', splashColor: '#7d31b7' },
    res4: { size: 32, hp: 78, value: 5, weight: 0.1, weightPerZone: 0, hpFontSize: 14, color: '#8f5fbf', splashColor: '#dd1f4b' },
    res5: { size: 44, hp: 101, value: 8, weight: 0.1, weightPerZone: 0, hpFontSize: 16, color: '#3f8fbf', splashColor: '#fba805' },
    res6: { size: 52, hp: 150, value: 12, weight: 0.1, weightPerZone: 0, hpFontSize: 18, color: '#bf3f6a', splashColor: '#f94a46' },
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

  // Two legs behind the body. Each swings from its top (the hip) while the
  // minion walks, opposite to the other; they ease back to straight when it stops.
  // Eating animation while a minion hits a resource: loops the sprite sheet
  // minion_eat (one row of square frames). With no sheet, the normal sprite is used.
  eat: {
    show: true,
    fps: 8,                 // frames per second
  },

  legs: {
    show: true,
    angle: 25,              // max swing in degrees each side
    perBounce: 0.5,         // swing cycles per bounce; 0.5 = one step per bounce
    spacing: 0.35,          // hips this far left/right of center, × minion radius
    hipY: 0.65,             // hips this far below center, × minion radius
    length: 0.45,           // leg length × minion radius
    width: 0.22,            // leg thickness × minion radius
    color: '#2b3d33',       // drawn legs only (ignored when you upload leg art)
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
    color: '#ffffff',               // text size is per resource type (resources.resN.hpFontSize)
  },

  // Juice splash on every bite: drops burst out, fall and fade. Color per
  // resource type (resources.resN.splashColor).
  splash: {
    show: true,
    count: 6,               // drops per bite
    countRandom: 0.3,       // ± share of random count (0.3 = 6 ±30%)
    speed: 70,              // how fast drops fly out (px/s)
    speedRandom: 0.5,       // ± share of random speed
    upKick: 50,             // extra upward push so it splashes up, then falls
    gravity: 300,           // pull down (px/s²)
    size: 3.5,              // drop radius in pixels
    sizeRandom: 0.4,        // ± share of random size
    shrink: 0.6,            // how much drops shrink over their life (0 = not at all, 1 = to nothing)
    life: 0.45,             // seconds a drop lives (±25%)
    spin: 6,                // max spin (radians/s), shows when you use a drop image
    tintImage: true,        // color your drop image with each resource's splashColor (draw it white/grey)
  },

  // Effect played once on the new minion after a merge: the merge_vfx sprite
  // sheet from 🎨 (one row of square frames, e.g. 6 frames). Without a sheet,
  // a simple growing ring is drawn.
  mergeVfx: {
    show: true,
    fps: 15,                // frames per second (6 frames at 15 = 0.4 s)
    size: 2,                // × the new minion's width
    followMinion: true,     // move with the minion while playing; off = stays where the merge happened
  },

  damagePopup: {
    show: true,
    duration: 0.7,          // seconds until fully faded
    rise: 18,               // pixels the number floats up
    popScale: 1.6,          // starting size, shrinks to 1 right away
    fontSize: 13,
    color: '#ffe066',
  },

  // Game UI: HUD counters and the Hire / Merge buttons inside the play area.
  ui: {
    textColor: '#ffffff',
    outlineColor: '#1b2a1e',
    outlineWidth: 0.28,       // outline thickness × text size
    hudScale: 0.85,           // size of the whole top HUD (zone, juice, minions)
    zoneFontSize: 24,
    counterFontSize: 20,
    counterIconSize: 34,      // juice and minion icons
    backdropOpacity: 0.25,
    buttonHeight: 62,
    buttonFontSize: 19,
    buttonSmallFontSize: 15,
    buttonContentTop: 0.06,   // text box inside the button art: top, as a share of the button height
    buttonContentBottom: 0.84, // bottom of the text box (your art's face ends ~85%, the rest is its shadow)
    buttonContentPadding: 0.1, // empty space left and right, as a share of the button width
    hireColor: '#3aa0f0',
    mergeColor: '#a45be8',
    disabledOpacity: 0.55,
    pressScale: 0.92,         // button size while tapped
  },

  maxPixelRatio: 2,        // sharpness cap: real pixels per screen point (1 = old soft look, 3 = full iPhone sharpness, heavier)

  // Drawing size of each image, × its normal size (1 = unchanged). Set from
  // the Scale slider on each row in 🎨. Only the picture changes, not colliders.
  artScale: {
    minion_lv1: 1, minion_lv2: 0.85, minion_lv3: 0.75, minion_lv4: 0.65,
    minion_lv5: 0.7, minion_lv6: 1, minion_lv7: 1, minion_lv8: 1,
    minion_eat: 1, minion_eat_lv2: 1, minion_eat_lv3: 1, minion_eat_lv4: 1,
    minion_eat_lv5: 1, minion_eat_lv6: 1, minion_eat_lv7: 1, minion_eat_lv8: 1,
    minion_leg: 1, minion_shadow: 1,
    resource_1: 1.4, resource_2: 1.25, resource_3: 2.25, resource_4: 1.7, resource_5: 2.2, resource_6: 1.6,
    splash_drop: 1, merge_vfx: 1, tap_marker: 1,
  },

  textWeight: 1000,         // thickness of all game text: 400 = regular, 700 = bold, up to 1000 (needs a variable font)

  clearDelay: 1.2,          // seconds between zones
  showLeader: false,        // debug: draw the invisible leader
  showColliders: false,     // debug: draw collider circles (resources cyan, minions pink)
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
  'minion.colliderScale': 'Size of the round collider minions push and bite with, compared to their body as drawn (Scale in 🎨 included). 0.9 = 10% smaller than the body. Legs and shadow are never part of it. Check it with showColliders.',
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
  'zone.hpMultPerZone': 'Resource HP is multiplied by this for each zone after the first. 1.35 = +35% per zone. Applies from the next zone or on Restart.',
  'zone.valueMultPerZone': 'Wood earned is multiplied by this for each zone after the first. Applies from the next zone or on Restart.',
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
  'eat.show': 'While hitting a resource, minions loop their level\'s eating sprite sheet from 🎨 (Minion level N → Eating): one row of square frames, the frame count is worked out from its width. A level without its own sheet uses level 1\'s; with none at all, minions keep their normal sprite.',
  'eat.fps': 'Speed of the eating animation, in frames per second.',
  'legs.show': 'Draw two legs behind each minion. They swing from the hip while walking and ease back to straight when it stops.',
  'legs.angle': 'How far each leg swings forward and back while walking, in degrees.',
  'legs.perBounce': 'Leg swing cycles per bounce. 0.5 = each bounce is one step (left leg, then right leg).',
  'legs.spacing': 'How far apart the legs are: distance of each hip from the center, in minion radii.',
  'legs.hipY': 'How low the hips sit below the minion\'s center, in minion radii. Higher = legs start lower.',
  'legs.length': 'Leg length, in minion radii. Legs scale with minion size.',
  'legs.width': 'Leg thickness, in minion radii.',
  'legs.color': 'Color of the drawn capsule legs. Not used once you upload leg art in 🎨.',
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
  'hpText.color': 'Color of the HP number.',
  'mergeVfx.show': 'Play the merge effect on the new minion after a merge. Load the sprite sheet in 🎨 → Merge effect; without it, a simple ring is drawn.',
  'mergeVfx.fps': 'Speed of the merge effect, in frames per second. 6 frames at 15 fps last 0.4 s. It plays once.',
  'mergeVfx.size': 'Size of the merge effect compared to the new minion\'s width. 2 = twice as wide as the minion.',
  'mergeVfx.followMinion': 'On: the effect moves with the new minion while it plays. Off: it stays where the merge happened.',
  'splash.show': 'Juice drops burst out every time a minion bites a resource.',
  'splash.count': 'Number of drops per bite.',
  'splash.countRandom': 'Randomness of the drop count. 0.3 = up to 30% more or fewer each bite.',
  'splash.speed': 'How fast drops fly out, in pixels per second.',
  'splash.speedRandom': 'Randomness of each drop\'s speed. 0.5 = between half and 1.5× the speed.',
  'splash.upKick': 'Extra upward push so drops jump up before falling. 0 = they spread evenly in all directions.',
  'splash.gravity': 'How fast drops fall back down (pixels per second²). 0 = no falling.',
  'splash.size': 'Drop size (radius in pixels). Also scaled by the Scale slider of the drop image in 🎨.',
  'splash.sizeRandom': 'Randomness of each drop\'s size. 0.4 = 60% to 140% of the size.',
  'splash.shrink': 'How much drops shrink before they disappear. 0 = keep their size, 1 = shrink to nothing.',
  'splash.life': 'Seconds a drop lives (each one ±25%). It fades out in the second half.',
  'splash.spin': 'How fast drops can spin (radians per second). Only visible with a drop image.',
  'splash.tintImage': 'On: your drop image is colored with each resource\'s splashColor, so draw it in white/grey. Off: drawn with its own colors.',
  'damagePopup.show': 'Show a number for each hit, popping where the minion touches the resource.',
  'damagePopup.duration': 'How long a damage number stays before it has fully faded, in seconds.',
  'damagePopup.rise': 'How far a damage number floats up while fading, in pixels.',
  'damagePopup.popScale': 'How big a damage number starts before shrinking to normal size. 1 = no pop.',
  'damagePopup.fontSize': 'Text size of damage numbers.',
  'damagePopup.color': 'Color of damage numbers.',
  textWeight: 'Thickness of all game text (HUD, HP numbers, damage numbers). 400 = regular, 700 = bold, 900+ = extra thick. Fine steps (e.g. 850) need a variable font such as Nunito-VariableFont; a normal font only has its own weight.',
  clearDelay: 'Pause in seconds between clearing a zone and the next zone appearing.',
  'zone.colliderScale': 'Size of the round collider minions bump into and hit, compared to the resource art as drawn (Scale in 🎨 included). 1 = a circle touching the art\'s edges, 0.8 = smaller so minions overlap the art a bit, 1.2 = bigger.',
  showColliders: 'Debug: draw collider circles to check them against your art: resources in cyan, minions in pink.',
  'ui.textColor': 'Color of all game text (HUD, buttons, zone banner).',
  'ui.outlineColor': 'Color of the outline around all game text.',
  'ui.outlineWidth': 'Outline thickness compared to the text size. 0.28 = thick cartoon outline, 0.15 = thin.',
  'ui.hudScale': 'Size of the whole top HUD: zone, juice counter and minion counter. 0.85 = 85%. Keeps each side in its corner.',
  'ui.buttonContentTop': 'Top of the area where button text is drawn, as a share of the button height. Raise it if text touches the top of your button art.',
  'ui.buttonContentBottom': 'Bottom of the button text area, as a share of the button height. Lower it if text sits on your art\'s bottom edge or shadow.',
  'ui.buttonContentPadding': 'Empty space kept left and right of the button text, as a share of the button width. Text shrinks to fit if it\'s too long.',
  'ui.zoneFontSize': 'Text size of "Zone N" at the top left.',
  'ui.counterFontSize': 'Text size of the juice and minion counters.',
  'ui.counterIconSize': 'Size of the juice and minion icons next to the counters.',
  'ui.backdropOpacity': 'How visible the backdrop behind the counters is. 0 = invisible, 1 = solid.',
  'ui.buttonHeight': 'Height of the Hire and Merge buttons, in pixels. The swarm can\'t be sent below them.',
  'ui.buttonFontSize': 'Text size of the first line on the buttons ("Hire minion", "Merge").',
  'ui.buttonSmallFontSize': 'Text size of the second line on the buttons (price, levels).',
  'ui.hireColor': 'Color of the drawn Hire button (not used once you load button art in 🎨).',
  'ui.mergeColor': 'Color of the drawn Merge button (not used once you load button art in 🎨).',
  'ui.disabledOpacity': 'How visible a button is when you can\'t use it (not enough juice, nothing to merge).',
  'ui.pressScale': 'Button size for a moment after a tap. 0.92 = shrinks 8%, 1 = no bounce.',
  maxPixelRatio: 'How sharp the game draws. 2 = sharp on phones and computers (recommended). 1 = softer but lighter. 3 = full iPhone sharpness, more work for the phone. Applies when the page is resized or reloaded.',
  showLeader: 'Debug: show the invisible leader the swarm follows, as a small white circle.',
};

for (const key of Object.keys(CONFIG.artScale)) {
  CONFIG_HELP[`artScale.${key}`] = (key.startsWith('minion_lv')
    ? `Drawing size of level ${key.slice(9)} minions, × normal: body, legs, shadow, eating frames and collider together.`
    : key.startsWith('resource_')
      ? `Drawing size of ${key}, × normal. Its collider grows and shrinks with it.`
      : `Drawing size of the ${key} image, × its normal size.`) +
    ' 1 = unchanged, 1.2 = 20% bigger. Same as the Scale slider in 🎨.';
}

// Help for every resource type (resources.res1 … res6), same text for each.
for (let n = 1; n <= 6; n++) {
  const p = `resources.res${n}.`;
  Object.assign(CONFIG_HELP, {
    [p + 'size']: `Size of resource ${n} in pixels (art and collider). Applies from the next zone or on Restart.`,
    [p + 'hp']: `HP of resource ${n} in zone 1 (then × zone.hpMultPerZone each zone). Applies from the next zone or on Restart.`,
    [p + 'value']: `Wood earned from resource ${n} in zone 1 (then × zone.valueMultPerZone each zone). Applies from the next zone or on Restart.`,
    [p + 'weight']: `How often resource ${n} spawns, compared to the other types. 0 = never. E.g. weights 3 and 1 = 75% / 25%. Applies from the next zone or on Restart.`,
    [p + 'weightPerZone']: `Added to resource ${n}'s weight each zone after the first (negative = rarer over time; never below 0). Applies from the next zone or on Restart.`,
    [p + 'hpFontSize']: `Text size of the HP number on resource ${n}.`,
    [p + 'color']: `Color of resource ${n} when it has no art.`,
    [p + 'splashColor']: `Color of the juice drops when resource ${n} is bitten.`,
  });
}

// ---- Setup -----------------------------------------------------------------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;   // game space stays 360×560 whatever the screen
const H = canvas.height;

// Sharp rendering: the canvas gets as many real pixels as it covers on
// screen (up to maxPixelRatio per CSS pixel); the game still draws in W×H.
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
  wood: 0,
  zone: 0,
  purchases: 0,             // minions bought this run (sets the hire price)
  minions: [],
  resources: [],
  leader: { x: W / 2, y: H - 130, target: null }, // starts above the buttons
  guide: null,              // { x, y } tapped point the swarm is heading to
  popups: [],               // floating damage numbers
  splashes: [],             // juice drops flying off eaten resources
  mergeFx: [],              // merge effects playing on new minions
  press: null,              // button just tapped { key, t }, for the press bounce
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

// Resources collide as a circle that fits inside the art as drawn
// (diameter = size × its Scale in 🎨), scaled by zone.colliderScale.
const resRadius = (r) => (r.size / 2) * artScale(resourceArtKey(r.type)) * CONFIG.zone.colliderScale;

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

const RESOURCE_TYPES = ['res1', 'res2', 'res3', 'res4', 'res5', 'res6'];
const resourceArtKey = (type) => `resource_${type.slice(3)}`; // res3 → resource_3

function makeZone(index) {
  const z = CONFIG.zone;
  const count = z.baseCount + index * z.countPerZone;
  // Weighted pick between the resource types for this zone.
  const types = RESOURCE_TYPES.map((key) => {
    const t = CONFIG.resources[key];
    return { key, t, w: Math.max(0, t.weight + t.weightPerZone * index) };
  }).filter((o) => o.w > 0);
  const total = types.reduce((s, o) => s + o.w, 0);
  const pickType = () => {
    let roll = Math.random() * total;
    for (const o of types) if ((roll -= o.w) < 0) return o;
    return types[types.length - 1];
  };
  const list = [];
  for (let i = 0; i < count && total > 0; i++) {
    const { key: type, t } = pickType();
    const size = t.size;
    const space = size * artScale(resourceArtKey(type)); // room it takes as drawn
    let x, y, ok = false;
    // Keep resources apart so minions can walk between them.
    for (let tries = 0; tries < 40 && !ok; tries++) {
      x = 20 + space / 2 + Math.random() * (W - 40 - space);
      y = 80 + space / 2 + Math.random() * (H - 200 - space);
      ok = list.every((r) =>
        Math.abs(r.x - x) > (r.space + space) / 2 + 16 ||
        Math.abs(r.y - y) > (r.space + space) / 2 + 16);
    }
    if (!ok) continue;
    const maxHp = Math.max(1, Math.round(t.hp * Math.pow(z.hpMultPerZone, index)));
    list.push({
      x, y, size, space, type, maxHp, hp: maxHp,
      value: Math.max(1, Math.round(t.value * Math.pow(z.valueMultPerZone, index))),
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
    attacking: false, eatT: 0, face: 1, bounceAmp: 0, bouncePhase: Math.random() * Math.PI * 2,
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
    gx = c.x; gy = c.y; stop = minionRadius(m);
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
  m.attacking = !!m.target && distToResource(m.target, m.x, m.y) <= minionRadius(m) + 3;

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

  // Eating animation clock: runs while hitting, restarts from frame 1 each time.
  m.eatT = m.attacking ? (m.eatT || 0) + dt : 0;

  // Attack when touching the resource.
  if (m.attacking) {
    m.cd -= dt;
    if (m.cd <= 0) {
      m.cd = t.interval;
      m.target.hp -= t.dmg;
      m.target.shake = CONFIG.shake.duration;
      const c = closestPoint(m.target, m.x, m.y); // where the minion touches it
      if (CONFIG.damagePopup.show) state.popups.push({ x: c.x, y: c.y, text: String(t.dmg), age: 0 });
      spawnSplash(c.x, c.y, m.target);
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
        const ra = minionRadius(a), rb = minionRadius(b);
        const min = ra + rb;
        if (d >= min) continue;
        if (d === 0) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
        const over = min - d;
        const ma = ra ** 2;
        const mb = rb ** 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * over * (mb / (ma + mb));
        a.y -= ny * over * (mb / (ma + mb));
        b.x += nx * over * (ma / (ma + mb));
        b.y += ny * over * (ma / (ma + mb));
      }
    }

    for (const m of ms) {
      const rad = minionRadius(m);
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
  updateSplashes(dt);
  updateMergeFx(dt);
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
  if (CONFIG.mergeVfx.show) state.mergeFx.push({ m: merged, x: merged.x, y: merged.y, age: 0 });
}

// ---- Merge VFX: a sprite sheet played once on the new minion ----------------

// Frame count and size of the merge sheet (one row of square frames).
function mergeSheet() {
  const img = art('merge_vfx');
  if (!img) return null;
  const fh = img.naturalHeight;
  const count = Math.max(1, Math.round(img.naturalWidth / fh));
  return { img, count, fw: img.naturalWidth / count, fh };
}

// How long one merge effect lasts: its frames at mergeVfx.fps, or a short
// built-in burst when there's no sheet.
function mergeFxLength() {
  const s = mergeSheet();
  return s ? s.count / Math.max(1, CONFIG.mergeVfx.fps) : 0.4;
}

function updateMergeFx(dt) {
  const len = mergeFxLength();
  for (const f of state.mergeFx) {
    f.age += dt;
    if (CONFIG.mergeVfx.followMinion && state.minions.includes(f.m)) { f.x = f.m.x; f.y = f.m.y; }
  }
  state.mergeFx = state.mergeFx.filter((f) => f.age < len);
}

function drawMergeFx() {
  const v = CONFIG.mergeVfx;
  const sheet = mergeSheet();
  for (const f of state.mergeFx) {
    const size = minionDrawRadius(f.m) * 2 * v.size * artScale('merge_vfx'); // × the new minion's width
    if (sheet) {
      const i = Math.min(sheet.count - 1, Math.floor(f.age * v.fps));
      ctx.drawImage(sheet.img, i * sheet.fw, 0, sheet.fw, sheet.fh, f.x - size / 2, f.y - size / 2, size, size);
    } else {
      // Built-in burst until you load a sheet: a ring that grows and fades.
      const k = f.age / 0.4;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#fff6b0';
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(f.x, f.y, (size / 2) * (0.4 + 0.6 * k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}


function restart() {
  state.wood = 0;
  state.zone = 0;
  state.purchases = 0;
  state.clearing = 0;
  state.flashT = 0;
  state.guide = null;
  state.popups = [];
  state.splashes = [];
  state.mergeFx = [];
  state.leader.x = W / 2;
  state.leader.y = H - 130;
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
  const p = toCanvas(e);
  const btn = buttonAt(p);
  if (btn) {
    state.press = { key: btn, t: 0.12 };
    if (btn === 'hire') hire(); else merge();
    return;
  }
  // Keep the swarm above the buttons.
  p.y = Math.min(p.y, buttonRects().hire.y - 20);
  state.guide = p;
  state.leader.target = null;
});

// ---- Assets ------------------------------------------------------------------
// Every image the game uses. Each one falls back to the built-in drawn shape
// below when there's no image (your upload in 🎨, or assets/<key>.webp / .png).

const BACKGROUND_COLOR = '#1f3a24';
const MINION_ART_LEVELS = 8; // minion_lv1..lv8; higher levels reuse them in a cycle
// Eating sprite sheet: one horizontal strip of square frames. The number of
// frames is width ÷ height (512×128 = 4 frames, 768×128 = 6…).
// Returns the frame to draw { img, sx, sw, sh }, or null for the normal sprite.
function eatFrame(m) {
  if (!CONFIG.eat.show || !m.attacking) return null;
  // This level's own sheet, else level 1's, else none (normal sprite).
  let key = eatArtKey(artLevel(m.level));
  let sheet = art(key);
  if (!sheet) { key = eatArtKey(1); sheet = art(key); }
  if (!sheet) return null;
  const sh = sheet.naturalHeight;
  const count = Math.max(1, Math.round(sheet.naturalWidth / sh));
  const sw = sheet.naturalWidth / count;
  const i = Math.floor(m.eatT * Math.max(0.1, CONFIG.eat.fps)) % count;
  return { img: sheet, sx: i * sw, sw, sh, scaleKey: key };
}

// Level 1..8 whose art a minion uses (higher levels cycle).
const artLevel = (level) => ((level - 1) % MINION_ART_LEVELS) + 1;
// Eating sheet key per art level: level 1 keeps its original name.
const eatArtKey = (lv) => (lv === 1 ? 'minion_eat' : `minion_eat_lv${lv}`);

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
  c.font = `${CONFIG.textWeight} ${Math.max(8, Math.round(radius * 1.1))}px ${gameFont()}`;
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

// Capsule leg hanging down from its pivot at 0,0 (the hip): w wide, len long.
function drawLegShape(c, w, len, color) {
  const r = w / 2;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(-r, r);
  c.arc(0, r, r, Math.PI, 0);
  c.lineTo(r, len - r);
  c.arc(0, len - r, r, 0, Math.PI);
  c.closePath();
  c.fill();
}

// Both legs of a minion, in its local space (center 0,0, radius rad).
function drawLegs(c, m, rad) {
  const L = CONFIG.legs;
  const img = art('minion_leg');
  const ls = artScale('minion_leg');
  const w = rad * L.width * ls, len = rad * L.length * ls;
  const swing = (L.angle * Math.PI / 180) * m.bounceAmp * Math.sin(m.bouncePhase * L.perBounce);
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * rad * L.spacing, rad * L.hipY);
    c.rotate(side * swing); // opposite legs swing opposite ways
    if (img) c.drawImage(img, -w / 2, 0, w, len);
    else drawLegShape(c, w, len, L.color);
    c.restore();
  }
}

// ---- Splash VFX: juice drops burst from where a minion bites -----------------

const MAX_SPLASHES = 400; // safety cap for phones

function spawnSplash(x, y, r) {
  const s = CONFIG.splash;
  if (!s.show || s.count <= 0) return;
  const color = CONFIG.resources[r.type].splashColor;
  const n = Math.round(s.count * (1 + (Math.random() * 2 - 1) * s.countRandom));
  for (let i = 0; i < n && state.splashes.length < MAX_SPLASHES; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = s.speed * (1 + (Math.random() * 2 - 1) * s.speedRandom);
    state.splashes.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - s.upKick,
      age: 0,
      life: s.life * (0.75 + Math.random() * 0.5),
      size: s.size * (1 + (Math.random() * 2 - 1) * s.sizeRandom),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() * 2 - 1) * s.spin,
      color,
    });
  }
}

function updateSplashes(dt) {
  const g = CONFIG.splash.gravity;
  for (const p of state.splashes) {
    p.age += dt;
    p.vy += g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  state.splashes = state.splashes.filter((p) => p.age < p.life);
}

// The drop image tinted to a color, cached so it's only made once per color.
const tintCache = new Map();
function tintedDrop(img, color) {
  const key = `${img.src}|${color}`;
  let c = tintCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';       // keeps the art's shading (draw it white/grey)
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; // back to the drop's own shape
    g.drawImage(img, 0, 0);
    tintCache.set(key, c);
  }
  return c;
}

function drawDropShape(c, size, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(0, 0, size, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)'; // small shine
  c.beginPath();
  c.arc(-size * 0.3, -size * 0.3, size * 0.35, 0, Math.PI * 2);
  c.fill();
}

function drawSplashes() {
  const s = CONFIG.splash;
  if (!state.splashes.length) return;
  const img = art('splash_drop');
  const sc = artScale('splash_drop');
  for (const p of state.splashes) {
    const k = p.age / p.life;              // 0 → 1 over its life
    const size = p.size * sc * (1 - k * s.shrink);
    if (size <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, (k - 0.5) / 0.5)); // fades in the second half
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (img) ctx.drawImage(s.tintImage ? tintedDrop(img, p.color) : img, -size, -size, size * 2, size * 2);
    else drawDropShape(ctx, size, p.color);
    ctx.restore();
  }
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
  // Eating sheet per level, each folded under its level in 🎨. Level 1's is
  // minion_eat; a level without its own sheet uses level 1's.
  ...Array.from({ length: MINION_ART_LEVELS }, (_, i) => ({
    key: eatArtKey(i + 1), label: `Minion level ${i + 1} eating (sprite sheet)`, parent: `minion_lv${i + 1}`, group: 'Eating',
    size: i === 0
      ? 'one row of square frames, e.g. 512×128 = 4 frames; same framing as minion_lv1 (optional)'
      : `one row of square frames, same framing as minion_lv${i + 1} (optional; empty = level 1's eating sheet)`,
    draw: (c, w, h) => {
      // Placeholder thumbnail only; the game falls back as described above.
      c.globalAlpha = 0.35;
      c.translate(w / 2, h / 2);
      drawMinionShape(c, w * 0.38, CONFIG.minion.colors[i % CONFIG.minion.colors.length]);
    },
  })),
  { key: 'minion_leg', label: 'Minion leg', size: '32×64 (transparent, top center = hip)',
    draw: (c, w, h) => { c.translate(w / 2, 0); drawLegShape(c, w * 0.5, h, CONFIG.legs.color); } },
  { key: 'minion_shadow', label: 'Minion shadow', size: '128×128 (transparent, drawn see-through by shadow.opacity)',
    draw: (c, w, h) => { c.translate(w / 2, h / 2); drawShadowShape(c, w / 2, h / 2); } },
  ...RESOURCE_TYPES.map((type, i) => ({
    key: resourceArtKey(type), label: `Resource ${i + 1}`,
    size: '128×128, or a row of square frames that get more eaten as HP drops (e.g. 512×128 = 4 states)',
    draw: (c, w, h) => drawResourceShape(c, w / 2, h / 2, w * 0.7, CONFIG.resources[type].color),
  })),
  { key: 'icon_juice', label: 'Juice icon (currency)', size: '64×64, transparent',
    draw: (c, w, h) => drawJuiceShape(c, w / 2, h / 2, h * 0.9) },
  { key: 'hud_backdrop', label: 'Counter backdrop', size: '256×64 (stretched behind the counters, drawn see-through by ui.backdropOpacity)',
    draw: (c, w, h) => { c.fillStyle = '#000'; roundRectPath(c, 0, h * 0.3, w, h * 0.4, h * 0.2); c.fill(); } },
  { key: 'button_hire', label: 'Hire button', size: '680×256 (stretched to the button; text is drawn on top, inside ui.buttonContent*)',
    draw: (c, w, h) => drawButtonShape(c, 2, h * 0.3, w - 4, h * 0.38, CONFIG.ui.hireColor) },
  { key: 'button_merge', label: 'Merge button', size: '680×256 (stretched to the button; text is drawn on top, inside ui.buttonContent*)',
    draw: (c, w, h) => drawButtonShape(c, 2, h * 0.3, w - 4, h * 0.38, CONFIG.ui.mergeColor) },
  { key: 'merge_vfx', label: 'Merge effect (sprite sheet)', size: 'one row of square frames, e.g. 6 × 256 = 1536×256; plays once on the new minion',
    draw: (c, w, h) => {
      c.strokeStyle = '#fff6b0'; c.lineWidth = 4;
      c.beginPath(); c.arc(w / 2, h / 2, w * 0.35, 0, Math.PI * 2); c.stroke();
    } },
  { key: 'splash_drop', label: 'Splash drop', size: '32×32, transparent, drawn white/grey (tinted per resource)',
    draw: (c, w, h) => { c.translate(w / 2, h / 2); drawDropShape(c, w * 0.35, '#ff8a3d'); } },
  { key: 'tap_marker', label: 'Tap marker', size: '64×64 (square, transparent)',
    draw: (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, w, h); drawMarkerShape(c, w / 2, h / 2); } },
];

const art = (key) => (window.AssetPanel ? AssetPanel.image(key) : null);
const artScale = (key) => (key in CONFIG.artScale ? Math.max(0, CONFIG.artScale[key]) : 1);
// How big a minion is drawn: its size × its level's Scale.
const minionDrawRadius = (m) => m.type.radius * artScale(minionArtKey(m.level));
// Minion collider: the round body as drawn × minion.colliderScale (legs and shadow stay outside it).
const minionRadius = (m) => minionDrawRadius(m) * CONFIG.minion.colliderScale;

// ---- Render ----------------------------------------------------------------

function draw() {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
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
    const artKey = resourceArtKey(r.type);
    const img = art(artKey);
    const hs = h * artScale(artKey); // drawn half-size (the collider follows it, see resRadius)
    if (img) {
      // Sprite sheet: one row of square frames, frame 1 = untouched, last = almost eaten.
      // With 4 frames: HP 100–76% → 1, 75–51% → 2, 50–26% → 3, 25–0% → 4.
      const fh = img.naturalHeight;
      const count = Math.max(1, Math.round(img.naturalWidth / fh));
      const fw = img.naturalWidth / count;
      const eaten = 1 - Math.max(0, r.hp) / r.maxHp;
      const i = Math.min(count - 1, Math.floor(eaten * count));
      ctx.drawImage(img, i * fw, 0, fw, fh, x - hs, y - hs, hs * 2, hs * 2);
    }
    else drawResourceShape(ctx, x, y, hs * 2, CONFIG.resources[r.type].color);
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
      const rad = minionDrawRadius(m); // follows the level's Scale
      const rx = rad * sh.width * artScale('minion_shadow');
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
    const eat = eatFrame(m);
    const img = eat ? null : art(minionArtKey(m.level));
    // The level's Scale (🎨) sizes the whole minion: body, legs, wobble, eating frames.
    const rad = minionDrawRadius(m);
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
    if (CONFIG.legs.show) drawLegs(ctx, m, rad); // behind the body
    // Mirror only the art, so the level number stays readable.
    const fc = CONFIG.facing;
    const mirror = fc.flip && m.face !== (fc.artFacesRight ? 1 : -1);
    if (mirror) { ctx.save(); ctx.scale(-1, 1); }
    const dr = eat ? rad * artScale(eat.scaleKey) : rad; // eating sheet can be scaled on top
    if (eat) ctx.drawImage(eat.img, eat.sx, 0, eat.sw, eat.sh, -dr, -dr, dr * 2, dr * 2);
    else if (img) ctx.drawImage(img, -dr, -dr, dr * 2, dr * 2);
    else drawMinionShape(ctx, dr, m.type.color);
    if (mirror) ctx.restore();
    if (CONFIG.minion.showLevel && m.level > 1) drawLevelNumber(ctx, rad, m.level);
    ctx.restore();
  }

  drawSplashes();
  drawMergeFx();

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
      outlinedText(String(Math.max(0, Math.ceil(r.hp))), x, y + 1,
        { size: CONFIG.resources[r.type].hpFontSize, color: CONFIG.hpText.color, align: 'center' });
    }
  }

  // Damage numbers: pop in big, shrink to normal, float up, fade to zero.
  const pc = CONFIG.damagePopup;
  for (const p of state.popups) {
    const k = Math.min(1, p.age / pc.duration);
    const pop = 1 + (pc.popScale - 1) * Math.max(0, 1 - p.age / 0.12);
    ctx.globalAlpha = 1 - k;
    outlinedText(p.text, p.x, p.y - pc.rise * k, { size: Math.round(pc.fontSize * pop), color: pc.color, align: 'center' });
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  if (state.guide && CONFIG.guide.showMarker) {
    ctx.globalAlpha = 0.7;
    const img = art('tap_marker');
    const ms = artScale('tap_marker');
    if (img) ctx.drawImage(img, state.guide.x - 14 * ms, state.guide.y - 14 * ms, 28 * ms, 28 * ms);
    else {
      ctx.save();
      ctx.translate(state.guide.x, state.guide.y);
      ctx.scale(ms, ms);
      drawMarkerShape(ctx, 0, 0);
      ctx.restore();
    }
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
    ctx.strokeStyle = '#ff4fd8';
    for (const m of state.minions) {
      ctx.beginPath();
      ctx.arc(m.x, m.y, minionRadius(m), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (CONFIG.showLeader) {
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(state.leader.x, state.leader.y, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawHud();
  drawButtons();

  ctx.globalAlpha = 0.5;
  outlinedText(`build ${BUILD}`, W / 2, 54, { size: 9, align: 'center', width: 2 }); // under ⚙ 🎨
  ctx.globalAlpha = 1;

  if (state.flashT > 0) {
    ctx.globalAlpha = Math.min(1, state.flashT);
    outlinedText(state.flash, W / 2, H / 2, { size: 30, align: 'center' });
    ctx.globalAlpha = 1;
  }
}

// ---- Game UI (HUD + buttons, all drawn on the canvas) ------------------------

// Text with an outline, the way all game text is drawn.
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

// Text size that fits maxW (never bigger than size), outline included.
function fitSize(text, size, maxW) {
  ctx.font = `${CONFIG.textWeight} ${size}px ${gameFont()}`;
  const w = ctx.measureText(text).width + size * CONFIG.ui.outlineWidth;
  return w > maxW ? size * maxW / w : size;
}

function roundRectPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Low-opacity pill behind a HUD counter (hud_backdrop art, else a dark pill).
function drawBackdrop(x, y, w, h) {
  const img = art('hud_backdrop');
  ctx.save();
  ctx.globalAlpha = CONFIG.ui.backdropOpacity;
  if (img) ctx.drawImage(img, x, y, w, h);
  else { ctx.fillStyle = '#000'; roundRectPath(ctx, x, y, w, h, h / 2); ctx.fill(); }
  ctx.restore();
}

function drawJuiceShape(c, x, y, s) {
  // A juice drop: round bottom, pointed top, with a shine.
  c.save();
  c.translate(x, y);
  c.fillStyle = '#ff9f1a';
  c.strokeStyle = '#b85c00';
  c.lineWidth = Math.max(1, s * 0.08);
  c.beginPath();
  c.moveTo(0, -s * 0.5);
  c.bezierCurveTo(s * 0.18, -s * 0.22, s * 0.4, 0, s * 0.4, s * 0.12);
  c.arc(0, s * 0.12, s * 0.4, 0, Math.PI);
  c.bezierCurveTo(-s * 0.4, 0, -s * 0.18, -s * 0.22, 0, -s * 0.5);
  c.fill();
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.beginPath();
  c.ellipse(-s * 0.15, s * 0.05, s * 0.07, s * 0.14, 0.3, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// Juice icon centered at x, y, s pixels tall.
function drawJuiceIcon(x, y, s) {
  const img = art('icon_juice');
  if (img) ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
  else drawJuiceShape(ctx, x, y, s);
}

// Minion level 1 art as an icon (falls back to the drawn minion).
function drawMinionIcon(x, y, s) {
  const img = art('minion_lv1');
  if (img) ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
  else { ctx.save(); ctx.translate(x, y); drawMinionShape(ctx, s * 0.42, CONFIG.minion.colors[0]); ctx.restore(); }
}

function drawHud() {
  const u = CONFIG.ui;
  const k = Math.max(0.1, u.hudScale);
  // Top left: zone, then the juice counter on a backdrop (scaled from the top-left corner).
  ctx.save();
  ctx.scale(k, k);
  outlinedText(`Zone ${state.zone + 1}`, 14, 26, { size: u.zoneFontSize });
  const icon = u.counterIconSize;
  const by = 46, bh = icon * 0.8;
  const juice = String(Math.floor(state.wood));
  ctx.font = `${CONFIG.textWeight} ${u.counterFontSize}px ${gameFont()}`;
  const jw = ctx.measureText(juice).width;
  drawBackdrop(14 + icon * 0.4, by + (icon - bh) / 2, icon * 0.6 + 10 + jw + 14, bh);
  drawJuiceIcon(14 + icon / 2, by + icon / 2, icon);
  outlinedText(juice, 14 + icon + 8, by + icon / 2 + 1, { size: u.counterFontSize });
  ctx.restore();

  // Top right: minion count on a backdrop, minion level 1 icon on its left
  // (scaled from the top-right corner).
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(k, k);
  ctx.translate(-W, 0);
  const count = String(state.minions.length);
  ctx.font = `${CONFIG.textWeight} ${u.counterFontSize}px ${gameFont()}`;
  const cw = ctx.measureText(count).width;
  const right = W - 14;
  const boxW = icon * 0.6 + 10 + cw + 14;
  drawBackdrop(right - boxW, 12 + (icon - bh) / 2, boxW, bh);
  drawMinionIcon(right - boxW - icon * 0.1, 12 + icon / 2, icon * 1.1);
  outlinedText(count, right - 14, 12 + icon / 2 + 1, { size: u.counterFontSize, align: 'right' });
  ctx.restore();
}

// Where the two buttons sit, in game space.
function buttonRects() {
  const u = CONFIG.ui;
  const m = 12, gap = 10;
  const w = (W - m * 2 - gap) / 2;
  const y = H - m - u.buttonHeight;
  return {
    hire: { x: m, y, w, h: u.buttonHeight },
    merge: { x: m + w + gap, y, w, h: u.buttonHeight },
  };
}

// Glossy rounded button: darker bottom edge, light top shine.
function drawButtonShape(c, x, y, w, h, color) {
  const r = h * 0.38;
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.35)';
  roundRectPath(c, x, y + 4, w, h, r); c.fill();             // bottom edge
  c.fillStyle = color;
  roundRectPath(c, x, y, w, h, r); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.28)';
  roundRectPath(c, x + 6, y + 4, w - 12, h * 0.36, r * 0.7); c.fill(); // shine
  c.lineWidth = 2.5;
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  roundRectPath(c, x, y, w, h, r); c.stroke();
  c.restore();
}

function drawButtons() {
  const u = CONFIG.ui;
  const rects = buttonRects();
  const cost = hireCost();
  const pair = nextMergePair();
  const buttons = [
    { key: 'hire', rect: rects.hire, color: u.hireColor, enabled: state.wood >= cost, art: 'button_hire',
      line1: 'Hire minion', line2: (cx, y, maxW) => {
        const txt = String(cost);
        let size = u.buttonSmallFontSize;
        ctx.font = `${CONFIG.textWeight} ${size}px ${gameFont()}`;
        const full = size * 1.25 + 4 + ctx.measureText(txt).width; // icon + gap + price
        if (full > maxW) size *= maxW / full;
        const s = size * 1.25;
        ctx.font = `${CONFIG.textWeight} ${size}px ${gameFont()}`;
        const x0 = cx - (s + 4 + ctx.measureText(txt).width) / 2;
        drawJuiceIcon(x0 + s / 2, y, s);
        outlinedText(txt, x0 + s + 4, y + 1, { size });
      } },
    { key: 'merge', rect: rects.merge, color: u.mergeColor, enabled: !!pair, art: 'button_merge',
      line1: 'Merge', line2: (cx, y, maxW) => {
        const txt = pair ? `Lv${pair[0].level} → Lv${pair[0].level + 1}` : 'No pair';
        outlinedText(txt, cx, y + 1, { size: fitSize(txt, u.buttonSmallFontSize, maxW), align: 'center' });
      } },
  ];
  for (const b of buttons) {
    const { x, y, w, h } = b.rect;
    const press = state.press && state.press.key === b.key ? 1 - u.pressScale : 0;
    ctx.save();
    ctx.globalAlpha = b.enabled ? 1 : u.disabledOpacity;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(1 - press, 1 - press);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    const img = art(b.art);
    if (img) ctx.drawImage(img, x, y, w, h);
    else drawButtonShape(ctx, x, y, w, h, b.color);
    // Text stays inside the button face: the box between buttonContentTop and
    // buttonContentBottom (share of the height), minus buttonContentPadding on each side.
    const cx = x + w / 2;
    const top = y + h * u.buttonContentTop;
    const boxH = h * (u.buttonContentBottom - u.buttonContentTop);
    const maxW = w * (1 - 2 * u.buttonContentPadding);
    outlinedText(b.line1, cx, top + boxH * 0.32, { size: fitSize(b.line1, u.buttonFontSize, maxW), align: 'center' });
    b.line2(cx, top + boxH * 0.74, maxW);
    ctx.restore();
  }
}

// The button under a game-space point, or null.
function buttonAt(p) {
  const rects = buttonRects();
  for (const key of ['hire', 'merge']) {
    const r = rects[key];
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return key;
  }
  return null;
}

// ---- Loop ------------------------------------------------------------------

let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
  last = now;
  update(dt);
  if (state.press && (state.press.t -= dt) <= 0) state.press = null; // button press bounce
  draw();
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
    // Scale slider on each image row; same values as ⚙ → artScale.
    scale: {
      min: 0.2, max: 3, step: 0.05,
      has: (key) => key in CONFIG.artScale,
      get: (key) => CONFIG.artScale[key],
      set: (key, v) => { CONFIG.artScale[key] = v; if (window.SettingsPanel) SettingsPanel.save(); },
    },
    font: {
      family: 'GameFont', fallback: 'system-ui, sans-serif',
      files: ['Nunito-VariableFont_wght.ttf'], // your font's own file name in assets/
      // Weight slider in 🎨 → Game font; same value as ⚙ → textWeight.
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
window.game = state;    // handy for testing in the console
window.CONFIG = CONFIG;
requestAnimationFrame(frame);
