(() => {
'use strict';

/* ---- tuning knobs ---- */
const CFG = {
  CAP: 50,            // the tub is full at this many ducks: no game over, new ducks just stop coming (rare visitors not counted)
  START_EXTRA: 2,     // extra random base ducks at the start (on top of one of each base)
  SUPPLY_START: 4.5,  // seconds between faucet ducks at the start
  SUPPLY_MIN: 3.0,    // fastest interval
  SUPPLY_RAMP: 0.015, // interval shrinks by this per second
  SPEED: 20,          // drifting speed (px/s) at base size
  RARE_P: 0.07,       // chance a rare visitor comes along with each faucet duck
  RARE_LIFE: 9,       // (unused: rare visitors now stay until caught)
  PREVIEW: true,      // show the child bubble while the finger is over a duck
  GIFT_P: 0.3,        // chance that an outing wins a dress-up on the lottery drum while some are still missing
  GIFT_SURE: [1, 5, 10], // these outings always win (the first teaches that outings bring souvenirs, the misses between show it can miss)
  GIFT_PITY: 3        // after this many misses in a row the next one always wins (kept hidden: a pity win looks like any other)
};

const TAU = Math.PI * 2;
const L = () => I18N[lang];

const OUT = '#4a3a30';
/* system fonts only: no web font is loaded (freem! does not allow external references) */
const FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","BIZ UDPGothic","Yu Gothic UI","Yu Gothic","Meiryo",sans-serif';
const SVG_FONT = 'Hiragino Maru Gothic ProN,Yu Gothic,Meiryo,sans-serif';
const INK = '#35505f', INK_SOFT = '#4f6b7a', CARD = '#fffaf0', ACCENT = '#d63a79', DANGER = '#e0475b', SHADOW = '#b9d3dd';

/* colour components: red=1 blue=2 yellow=4. pattern components: stripes=1 dots=2. A child is the union of its parents. */
const COL = [
  { b: '#f6f4ee', pc: 'rgba(74,58,48,0.4)' },
  { b: '#e0483a', pc: '#ffffff' },
  { b: '#2f6fc9', pc: '#ffffff' },
  { b: '#8a4fc2', pc: '#ffffff' },
  { b: '#ffd23f', pc: 'rgba(74,58,48,0.4)' },
  { b: '#f58a1f', pc: 'rgba(74,58,48,0.4)' },
  { b: '#35a868', pc: '#ffffff' },
  { b: '#8b5a3c', pc: '#ffffff' }
];
const BASES = [[1, 0], [2, 0], [4, 0], [0, 1], [0, 2]];
const RARE = { gold: { get n() { return L().rare.gold; } }, rainbow: { get n() { return L().rare.rainbow; } }, night: { get n() { return L().rare.night; } } };
const RARE_IDS = ['gold', 'rainbow', 'night'];
const TOTAL = 31;

const bits = n => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1);
const gid = (c, p) => c * 4 + p;
const gname = (c, p) => lang === 'en' ? (c === 0 && p ? L().pat[p] : L().col[c] + (p ? ' ' + L().pat[p] : '')) : L().col[c] + L().pat[p];
const cost = (c, p) => bits(c) + bits(p) - 1;
const isBase = (c, p) => BASES.some(b => b[0] === c && b[1] === p);

const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

/* ---- screen: one fixed 360x640 design area, scaled to fit. The game itself lives in the stage rect below the HUD ---- */
const DESIGN_W = 360, DESIGN_H = 640;
const STG = { x: 12, y: 84, w: 336, h: 548 };
const W = STG.w, H = STG.h;
let S = 1, OX = 0, OY = 0, dpr = 1, VW = 0, VH = 0;
let geo = null;
let state = 'ready', paused = false;
let ducks = [], fx = [], texts = [], drag = null;
let target = null, delivered = 0;
let clock = 0, gameTime = 0, supplyTimer = 0, noticeT = 0, homeBounce = 0, lastN = -1;
let homeCall = 0, houseT = 0;
let achQueue = [], achCur = null, achTitle = '', achT = 0, achDur = 0, achDone = new Set(), achBig = false, bigT = 0;
try { achDone = new Set(JSON.parse(localStorage.getItem('duckLab.ach') || '[]')); } catch (_) {}
const ZUKAN_KEYS = [10, 20, 31];
function pushAch(msg) { achQueue.push(typeof msg === 'string' ? { m: msg, t: null } : msg); }
function checkZukanAch() {
  if (state !== 'play') return;
  for (const k of ZUKAN_KEYS) {
    if (seen.size >= +k && !achDone.has('z' + k)) {
      achDone.add('z' + k);
      try { localStorage.setItem('duckLab.ach', JSON.stringify(Array.from(achDone))); } catch (_) {}
      pushAch(L().zukanMs[k]);
    }
  }
}
let achShownAt = 0;
/* the grand finale: fireworks keep bursting over the tub while the banner is up */
function grandBurst() {
  const g = geo.tub, cols = [['#ffd23f', '#ff5d9a', '#6ec0f2', '#7fd9b0'], ['#fff6c2', '#ffb347', '#ff7aa8', '#b78cf2']];
  const x = g.x + rand(0.12, 0.88) * g.w, y = g.y + rand(0.05, 0.6) * g.h;
  stars(x, y, 22, cols[Math.floor(Math.random() * 2)]);
  petals(x, y, 12);
  ring(x, y);
}
function tickAchOrig(dt) {
  if (achCur) {
    if (achBig && achT > 0.4) { bigT -= dt; if (bigT <= 0) { bigT = reduce ? 0.9 : 0.35; grandBurst(); } }
    achT -= dt;
    if (achT <= 0) achCur = null;
    return;
  }
  if (achQueue.length && cardWait <= 0) {
    const it = achQueue.shift(); achCur = it.m; achBig = !!it.big; achT = achDur = achBig ? 7 : 1.9; bigT = 0; achShownAt = performance.now();
    achTitle = it.t || '';
    petals(geo.tub.x + geo.tub.w / 2, geo.tub.y + geo.tub.h * 0.2, 40);
    stars(geo.tub.x + geo.tub.w / 2, geo.tub.y + geo.tub.h * 0.2, 24, ['#ffd23f', '#ff5d9a', '#6ec0f2', '#7fd9b0']);
    petals(geo.tub.x + geo.tub.w * 0.2, geo.tub.y + geo.tub.h * 0.3, 14);
    petals(geo.tub.x + geo.tub.w * 0.8, geo.tub.y + geo.tub.h * 0.3, 14);
    if (achBig) sfxFinale(); else sfxAch();
    cheer();
    refreshNotice();
  }
}
let cardWait = 0, stampT = 0, bounceT = 0, noticeTxt = '', noticeShown = '', noticeRule = false;
let seen = new Set(), seenRare = new Set(), rareCount = {};
try { const rc = JSON.parse(localStorage.getItem('duckLab.rare') || '{}'); for (const k of RARE_IDS) if (rc && Number.isInteger(rc[k]) && rc[k] > 0) rareCount[k] = rc[k]; } catch (_) {}
function saveRare() { try { localStorage.setItem('duckLab.rare', JSON.stringify(rareCount)); } catch (_) {} }

try {
  const z = JSON.parse(localStorage.getItem('duckLab.zukan') || 'null');
  if (z && Array.isArray(z.g)) seen = new Set(z.g.filter(n => Number.isInteger(n) && n >= 0 && n < 32));
  if (z && Array.isArray(z.r)) seenRare = new Set(z.r.filter(n => RARE_IDS.includes(n)));
} catch (_) {}
function saveZukan() {
  try { localStorage.setItem('duckLab.zukan', JSON.stringify({ g: Array.from(seen), r: Array.from(seenRare) })); } catch (_) {}
}

/* ---- records: lifetime stats, medals, bath salts and dress-up ---- */
const K_STATS = 'duckLab.stats', K_STYLE = 'duckLab.style', K_MEDALS = 'duckLab.medals2', K_UNL = 'duckLab.unl2', K_UNLSEEN = 'duckLab.unlSeen2', K_USED = 'duckLab.used';
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
let stats = { born: new Array(32).fill(0), out: 0, nap: 0, hana: 0 };
function loadStats() {
  stats = { born: new Array(32).fill(0), out: 0, nap: 0, hana: 0 };
  const v = lsGet(K_STATS);
  if (v && typeof v === 'object') {
    if (Array.isArray(v.born)) for (let i = 0; i < 32; i++) if (Number.isInteger(v.born[i]) && v.born[i] > 0) stats.born[i] = v.born[i];
    for (const k of ['out', 'nap', 'hana']) if (Number.isInteger(v[k]) && v[k] > 0) stats[k] = v[k];
  }
}
loadStats();
const saveStats = () => lsSet(K_STATS, stats);
const bornTotal = () => stats.born.reduce((a, b) => a + b, 0);
const PROG = { hana: () => stats.hana, zukan: () => seen.size, out: () => stats.out, nap: () => stats.nap, born: bornTotal };
const MEDAL_STEPS = { hana: [1, 5, 10, 25, 50], zukan: [5, 10, 20, 31], out: [1, 5, 10, 30], nap: [1, 5, 10, 30], born: [10, 30, 50, 100] };
const MEDALS = [];
for (const cat of Object.keys(MEDAL_STEPS)) {
  for (const n of MEDAL_STEPS[cat]) MEDALS.push({ id: cat + n, cat, n, quiet: (cat === 'hana' && (n === 10 || n === 25)) || (cat === 'zukan' && n >= 10), test: () => PROG[cat]() >= n });
}
for (const id of RARE_IDS) MEDALS.push({ id: 's_' + id, secret: id, quiet: true, test: () => seenRare.has(id) });
MEDALS.push({ id: 's_all', secret: 'all', quiet: false, test: () => RARE_IDS.every(i => seenRare.has(i)) });
/* hidden until earned: every other medal collected (checked after the rest, so it must stay last) */
MEDALS.push({ id: 's_every', secret: 'every', quiet: true, test: () => MEDALS.every(x => x.id === 's_every' || medalSet.has(x.id)) });
let medalSet = new Set();
function initMedals() {
  const m = lsGet(K_MEDALS);
  if (Array.isArray(m)) { medalSet = new Set(m); return; }
  medalSet = new Set(MEDALS.filter(x => x.test()).map(x => x.id));
  lsSet(K_MEDALS, Array.from(medalSet));
}
function checkMedals() {
  let ch = false;
  for (const m of MEDALS) {
    if (medalSet.has(m.id) || !m.test()) continue;
    medalSet.add(m.id); ch = true;
    if (m.secret === 'every') { if (state === 'play') pushAch({ m: L().everyMsg, t: L().everyTitle, big: true }); }
    else if (!m.quiet && state === 'play') pushAch({ m: L().medalMsg(m), t: null });
  }
  if (ch) lsSet(K_MEDALS, Array.from(medalSet));
}
/* unlock pacing: salts are ordered so neighbouring colours differ, every threshold <= the matching medal tier (never harder than the achievement). */
const SALTS = [
  { id: 'plain', col: '#bfe9f5', free: true },
  { id: 'sakura', col: '#ffd6e4', need: ['hana', 1] }, { id: 'yuzu', col: '#ffeeaa', need: ['out', 3] },
  { id: 'soda', col: '#8fd8ff', need: ['nap', 3] }, { id: 'mint', col: '#c9f1dd', need: ['hana', 5] },
  { id: 'lav', col: '#e0d4f7', need: ['zukan', 7] }, { id: 'cocoa', col: '#c48a63', need: ['nap', 5] },
  { id: 'ichigo', col: '#ffc4cf', need: ['hana', 10] }, { id: 'umi', col: '#8fe3dc', need: ['out', 10] },
  { id: 'milk', col: '#fff6e8', need: ['nap', 10] }, { id: 'momiji', col: '#ffae9a', need: ['hana', 18] },
  { id: 'ocha', col: '#c3dc8e', need: ['zukan', 12] }, { id: 'yuki', col: '#e6f3ff', need: ['out', 20] },
  { id: 'night', col: '#6e86c9', need: ['born', 100] }, { id: 'gold', col: '#ffe58a', need: ['zukan', 25] },
  { id: 'rainbow', col: 'rainbow', secret: 'rainbow' }
];
const HATS = [{ id: 'none', free: true }].concat(DRESS_ON.map(d => {
  const id = d[0], n = DRESS_NEED[id];
  if (n) return Array.isArray(n) ? { id, need: n } : { id, secret: n.secret };
  return DRESS_STARTER.includes(id) ? { id, free: true } : { id, gift: true };
}));
DRESS_ITEMS.forEach(d => { I18N.ja.hatN[d[0]] = d[1]; I18N.en.hatN[d[0]] = DRESS_EN[d[0]] || d[1]; });
const ITEMS = SALTS.map(x => Object.assign({ k: 's:' + x.id, type: 'salt' }, x)).concat(HATS.map(x => Object.assign({ k: 'h:' + x.id, type: 'hat' }, x)));
/* dress-ups that came as omiyage */
const K_GOT = 'duckLab.got';
let gotSet = new Set();
{ const g = lsGet(K_GOT); if (Array.isArray(g)) gotSet = new Set(g.filter(id => DRESS_GIFT.includes(id))); }
const itemOpen = it => !!it.free || (it.gift ? gotSet.has(it.id) : it.secret ? seenRare.has(it.secret) : PROG[it.need[0]]() >= it.need[1]);
const itemName = it => (it.type === 'salt' ? L().saltN : L().hatN)[it.id];
const unlockedKeys = () => ITEMS.filter(itemOpen).map(i => i.k);
let unl = new Set(), unlSeen = new Set();
function initUnl() {
  const open = new Set(unlockedKeys());
  const u = lsGet(K_UNL);
  /* keep only items that are still earned, so a retuned condition is announced again when it is truly met */
  if (Array.isArray(u)) { unl = new Set(u.filter(k => open.has(k))); if (unl.size !== u.length) lsSet(K_UNL, Array.from(unl)); } else { unl = new Set(open); lsSet(K_UNL, Array.from(unl)); }
  const v = lsGet(K_UNLSEEN);
  if (Array.isArray(v)) { unlSeen = new Set(v.filter(k => open.has(k))); if (unlSeen.size !== v.length) lsSet(K_UNLSEEN, Array.from(unlSeen)); } else { unlSeen = new Set(ITEMS.filter(i => i.free).map(i => i.k)); lsSet(K_UNLSEEN, Array.from(unlSeen)); }
}
/* "used" = the player has actually picked this item at least once; unused open items keep a NEW tag */
let usedSet = new Set();
{ const u = lsGet(K_USED); if (Array.isArray(u)) usedSet = new Set(u); }
const markUsed = k => { if (!usedSet.has(k)) { usedSet.add(k); lsSet(K_USED, Array.from(usedSet)); } };
const isNewItem = it => !it.free && itemOpen(it) && !usedSet.has(it.k);
const qNew = { salt: false, hat: false }, qShown = { salt: false, hat: false };
function checkUnlocks() {
  let ch = false;
  for (const it of ITEMS) {
    if (unl.has(it.k) || !itemOpen(it)) continue;
    unl.add(it.k); ch = true;
    if (state === 'play') { pushItem(it); }
  }
  if (ch) lsSet(K_UNL, Array.from(unl));
  updateDot();
}
let style = { salt: 'plain', hats: [] };
function loadStyle() {
  style = { salt: 'plain', hats: [] };
  const v = lsGet(K_STYLE);
  if (!v) return;
  const so = SALTS.find(x => x.id === v.salt);
  if (so && itemOpen(so)) style.salt = so.id;
  const list = Array.isArray(v.hats) ? v.hats : (v.hat && v.hat !== 'none' ? [v.hat] : []);
  style.hats = list.filter(id => { const ho = HATS.find(x => x.id === id); return ho && ho.id !== 'none' && itemOpen(ho); });
}
let hatDraw = false;
initMedals(); initUnl(); loadStyle();
function afterStat() { saveStats(); checkMedals(); checkUnlocks(); }
/* ---- omiyage: every outing sends a lottery ticket up to the drum in the top-right corner; a gold ball = a dress-up.
   Once every dress-up is found the drum bursts and a golden duck statue takes its place: from then on each outing makes it celebrate ---- */
let forceGift = false;
const giftPool = () => DRESS_GIFT.filter(id => !gotSet.has(id));
/* wins already drawn but not handed out yet */
const pendingGifts = () => outQ.filter(q => q.hit).length + (cur && cur.hit && !cur.res ? 1 : 0);
/* misses in a row are remembered between plays so the pity count is fair */
const K_GMISS = 'duckLab.giftMiss', K_MIXN = 'duckLab.mixN', K_STATN = 'duckLab.statueN';
let giftMiss = Number(lsGet(K_GMISS)) || 0;
/* does this outing win? outings no. 1, 5 and 10 always do, otherwise GIFT_P, and never more than GIFT_PITY misses in a row */
function rollGift() {
  if (giftPool().length - pendingGifts() <= 0) return false;
  const hit = forceGift || CFG.GIFT_SURE.includes(stats.out) || giftMiss >= CFG.GIFT_PITY || Math.random() < CFG.GIFT_P;
  forceGift = false;
  giftMiss = hit ? 0 : giftMiss + 1; lsSet(K_GMISS, giftMiss);
  return hit;
}
/* how many times each action was done: its how-to line stops showing after 3 */
let mixN = Number(lsGet(K_MIXN)) || 0;
const TK0 = 0.35, SP0 = 1.2, SP1 = 2.3;   /* ticket leaves / lands on the drum and it starts turning / ball comes out */
const BOOM = 1.1, LAND = 1.75, ORB_T = 0.9;   /* drum bursts / statue lands / a sparkle reaches the statue */
let tickets = [], waitSpins = 0, outQ = [], cur = null, flies = [];
let boomT = null, orbs = [], reactQ = 0, react = null, shards = [], puffs = [], raysT = 0, plateBump = 0;
let statueN = Number(lsGet(K_STATN)) || 0;
const GOLDS = ['#ffd23f', '#fff6b0', '#ffb800', '#ffffff'];
const HOME_D = () => ({ x: W - 56, y: 31 });
const boomU = () => boomT !== null && boomT < BOOM ? boomT / BOOM : 0;
const boomShake = () => { const u = boomU(); return u > 0 && !reduce ? Math.sin(boomT * 70) * 3.2 * u : 0; };
const DRUM = () => ({ x: W - 56 + boomShake(), y: 31, k: 1.35 * (1 + 0.18 * Math.pow(boomU(), 2)), dir: -1 });
const statueUp = () => boomT !== null && boomT >= LAND + 0.6;
function resetDrum() {
  tickets = []; waitSpins = 0; outQ = []; cur = null; flies = [];
  orbs = []; reactQ = 0; react = null; shards = []; puffs = []; raysT = 0; plateBump = 0;
  boomT = giftPool().length ? null : 99;
}
resetDrum();
function outingLottery(x, y) {
  if (giftPool().length) { outQ.push({ hit: rollGift(), t: 0 }); tickets.push({ x, y, t: 0 }); }
  else orbs.push({ x, y, t: 0 });
}
/* give a dress-up right away and send it flying to the dress-up button */
function grantAt(x, y) {
  const pool = giftPool(); if (!pool.length) return;
  const id = pool[Math.floor(Math.random() * pool.length)];
  gotSet.add(id); lsSet(K_GOT, Array.from(gotSet));
  const it = ITEMS.find(z => z.k === 'h:' + id); unl.add(it.k); lsSet(K_UNL, Array.from(unl));
  flies.push({ it, x0: x, y0: y + 30, t: 0, done: false }); updateDot(); sfxNew();
  stars(x, y, 14, ['#ffd23f', '#ffffff', '#ff9ec1']); ring(x, y);
  if (!giftPool().length) pushAch({ m: L().giftAllMsg, t: L().giftAllTitle, big: true });
}
function burstDrum(h) {
  for (let i = 0; i < 16; i++) {
    const a = rand(0, TAU), sp = rand(130, 290);
    shards.push({ x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, a: rand(0, TAU), va: rand(-14, 14), t: 0, dur: rand(0.9, 1.4),
      kind: ['shard', 'shard', 'stick', 'ball'][i % 4], col: i % 2 ? '#ff7aa8' : '#ffc4dc', s: rand(6, 10), gold: Math.random() < 0.5 });
  }
  for (let i = 0; i < 8; i++) puffs.push({ x: h.x + rand(-24, 24), y: h.y + rand(-16, 22), r: rand(10, 18), t: -rand(0, 0.15), dur: rand(0.7, 1.05) });
  ring(h.x, h.y); ring(h.x, h.y + 10); stars(h.x, h.y, 24, ['#ffd23f', '#ff9ec1', '#ffffff', '#6ec0f2']);
  tone('sawtooth', 190, 40, 0.38, 0.13); tone('square', 900, 120, 0.25, 0.05); tone('triangle', 1300, 300, 0.3, 0.06, 0.03);
}
function landStatue(h) {
  ring(h.x, h.y + 30); stars(h.x, h.y, 20, GOLDS);
  for (let i = 0; i < 5; i++) puffs.push({ x: h.x + rand(-26, 26), y: h.y + 32, r: rand(6, 10), t: 0, dur: 0.6 });
  tone('sine', 220, 90, 0.2, 0.2); sfxNew(); raysT = 2.8;
}
/* the statue's reaction to an outing: hop / wink / glitter shower, and a fever every 10th */
function startReact() {
  reactQ--; statueN++; lsSet(K_STATN, statueN); plateBump = 0.4;
  const h = HOME_D(), r = Math.random();
  const kind = statueN % 10 === 0 ? 'fever' : r < 0.2 ? 'wink' : r < 0.42 ? 'shower' : 'hop';
  react = { kind, t: 0, dur: { hop: 0.9, wink: 1.2, shower: 1.6, fever: 2.6 }[kind] };
  if (kind === 'hop') { tone('sine', 880, 1320, 0.1, 0.1); tone('sine', 1320, 1760, 0.1, 0.08, 0.13); texts.push({ x: h.x - 40, y: h.y + 4, text: '♪', t: 0, dur: 1.0, kind: 'plain' }); }
  if (kind === 'wink') { tone('sine', 1760, 2640, 0.08, 0.08, 0.25); tone('sine', 2640, 3520, 0.12, 0.06, 0.33); }
  if (kind === 'shower') { cheer(); for (let i = 0; i < 4; i++) tone('triangle', 1400 + i * 260, 1400 + i * 260, 0.08, 0.06, i * 0.09); }
  if (kind === 'fever') {
    cheer(); raysT = 2.6;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.14, 0.09, i * 0.08));
    texts.push({ x: h.x - 30, y: h.y + 56, text: L().statueN(statueN), t: 0, dur: 1.8, kind: 'plain' });
  }
}
function updDrum(dt) {
  const h = HOME_D();
  for (const f of flies) { f.t += dt; if (f.t >= 1.25 && !f.done) { f.done = true; arrive(f.it); } }
  flies = flies.filter(f => f.t < 1.3);
  /* every outing issues its ticket at once; one that lands while the drum is busy waits beside it (×2) */
  for (const tk of tickets) {
    tk.t += dt;
    if (tk.t > TK0 && !tk.sp) { tk.sp = 1; stars(tk.x, tk.y, 6, ['#ffd23f', '#ff9ec1', '#ffffff']); tone('sine', 1200, 1800, 0.08, 0.08); }
    if (tk.t >= SP0) { tk.landed = true; waitSpins++; stars(h.x, h.y - 10, 6, ['#ffd23f', '#ff9ec1']); tone('triangle', 1500, 1100, 0.06, 0.1); }
  }
  tickets = tickets.filter(tk => !tk.landed);
  /* the drum and the achievement bubble take turns, so they never cover each other */
  if (!cur && waitSpins > 0 && outQ.length && !(celeb || achCur)) { cur = outQ.shift(); waitSpins--; cur.t = SP0; refreshNotice(); }
  if (cur) {
    cur.t += dt;
    if (cur.t > SP0 && !cur.rattle) { cur.rattle = 1; const d = DRUM(); ring(d.x, d.y); stars(d.x, d.y - 10, 8, ['#ffd23f', '#ff9ec1']); tone('triangle', 1500, 1100, 0.06, 0.12); for (let i = 0; i < 6; i++) tone('triangle', 300 + i * 40, 260, 0.05, 0.08, 0.1 + i * 0.12); }
    if (cur.t > SP1 && !cur.pop) { cur.pop = 1; tone('sine', 600, 900, 0.08, 0.1); }
    if (cur.t > SP1 + 0.6 && !cur.res) { cur.res = 1; const d = DRUM(); if (cur.hit) { grantAt(d.x + d.dir * 30 * d.k, d.y + 24 * d.k); cheer(); } else tone('sine', 520, 700, 0.1, 0.06); }
    if (cur.t >= SP1 + 1.45) { cur = null; refreshNotice(); }
  }
  /* the big "got them all" banner: the drum bursts and the statue drops in */
  if (boomT === null && !giftPool().length && !pendingGifts() && achCur && achBig) boomT = 0;
  if (boomT !== null && boomT < 99) {
    const p = boomT; boomT += dt;
    if (boomT < BOOM && Math.floor(boomT / 0.11) !== Math.floor(p / 0.11)) tone('triangle', 260 + boomT * 320, 220, 0.05, 0.07);
    if (p < BOOM && boomT >= BOOM) burstDrum(h);
    if (p < LAND && boomT >= LAND) landStatue(h);
    if (boomT > LAND + 3) boomT = 99;
  }
  for (const q of shards) { q.t += dt; q.vy += 640 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.a += q.va * dt; }
  shards = shards.filter(q => q.t < q.dur);
  for (const q of puffs) q.t += dt;
  puffs = puffs.filter(q => q.t < q.dur);
  if (raysT > 0) raysT -= dt;
  if (plateBump > 0) plateBump -= dt;
  for (const o of orbs) { o.t += dt; if (o.t >= ORB_T && !o.done) { o.done = true; reactQ++; stars(h.x, h.y - 8, 6, GOLDS); tone('sine', 1500, 2000, 0.06, 0.07); } }
  orbs = orbs.filter(o => !o.done);
  if (react) {
    const p = react.t; react.t += dt; const t = react.t, w = geo.water;
    if (react.kind === 'shower' && t > 0.25 && t < 1.2 && Math.floor(t / 0.09) !== Math.floor(p / 0.09)) stars(rand(w.x + 30, w.x + w.w - 30), rand(w.y + 20, w.y + w.h - 40), 4, GOLDS);
    if (react.kind === 'wink' && p < 0.3 && t >= 0.3) stars(h.x - 14, h.y - 18, 8, GOLDS);
    if (react.kind === 'fever') for (const a of [0.55, 0.95, 1.35]) if (p < a && t >= a) grandBurst();
    if (t >= react.dur) react = null;
  } else if (reactQ > 0 && statueUp() && !(celeb || achCur)) startReact();
}
/* the flight path of a ticket / sparkle from the outing ducks up to the drum (leads the eye there) */
function ticketPos(cd, d, u) {
  const p0 = { x: cd.x, y: cd.y }, p1 = { x: d.x, y: d.y - 18 }, cx = (p0.x + p1.x) / 2 + (p1.x > p0.x ? -30 : 30), cy = Math.min(p0.y, p1.y) - 70;
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c2 = u * u;
  return { x: a * p0.x + b * cx + c2 * p1.x, y: a * p0.y + b * cy + c2 * p1.y };
}
function drawTicketAt(c, d, tk) {
  const u = (tk.t - TK0) / (SP0 - TK0), e = u * u * (3 - 2 * u);
  for (let i = 6; i >= 1; i--) {   /* trail */
    const q = ticketPos(tk, d, Math.max(0, e - i * 0.035));
    c.save(); c.globalAlpha = 0.7 - i * 0.1; c.fillStyle = i % 2 ? '#fff6b0' : '#ffc4dc'; star4(c, q.x, q.y, 6 - i * 0.6); c.fill(); c.restore();
  }
  const p = ticketPos(tk, d, e), k = u < 0.15 ? easeOutBack(u / 0.15) : 1;
  c.save(); c.translate(p.x, p.y); c.rotate(u * 9); c.scale(k * 1.4, k * 1.4); c.lineJoin = 'round';
  c.fillStyle = '#ff9ec1'; c.strokeStyle = OUT; c.lineWidth = 2; rr(c, -10, -7, 20, 14, 3); c.fill(); c.stroke();
  c.strokeStyle = '#ffffff'; c.setLineDash([2, 2]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(4, -6); c.lineTo(4, 6); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#ffd23f'; c.strokeStyle = OUT; c.lineWidth = 1; star4(c, -3, 0, 4.2); c.fill(); c.stroke();
  c.restore();
}
/* the lottery drum in the top-right corner of the tub */
function drawDrum(c) {
  if (boomT !== null && boomT >= BOOM) { drawStatue(c); return; }
  const d = DRUM(), t = cur ? cur.t : -1;
  const spinning = t > SP0 && t < SP1, ang = spinning ? (t - SP0) * 9 : 0, hitK = t > SP0 && t < SP0 + 0.3 ? 1 + 0.18 * Math.sin((t - SP0) / 0.3 * Math.PI) : 1;
  const glow = boomU() > 0.45;   /* about to burst: the drum turns gold (steady, no flashing) */
  c.save(); c.translate(d.x, d.y + 6); c.scale(d.k, d.k); c.translate(-d.x, -d.y - 6); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = OUT;
  /* stand */
  c.lineWidth = 3; c.fillStyle = '#c48a63';
  c.beginPath(); c.moveTo(d.x - 4, d.y); c.lineTo(d.x - 18, d.y + 28); c.lineTo(d.x - 12, d.y + 28); c.lineTo(d.x, d.y + 4); c.lineTo(d.x + 12, d.y + 28); c.lineTo(d.x + 18, d.y + 28); c.lineTo(d.x + 4, d.y); c.closePath(); c.fill(); c.stroke();
  if (glow) { c.fillStyle = 'rgba(255,214,90,' + (0.35 + 0.25 * Math.sin(clock * 5)).toFixed(2) + ')'; c.beginPath(); c.arc(d.x, d.y, 30, 0, TAU); c.fill(); }
  /* drum (octagon) */
  c.save(); c.translate(d.x, d.y + (spinning ? Math.sin(t * 40) * 0.8 : 0)); c.rotate(ang); c.scale(hitK, hitK);
  c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; c.lineTo(Math.cos(a) * 21, Math.sin(a) * 21); } c.closePath();
  c.fillStyle = glow ? '#ffd23f' : '#ff7aa8'; c.lineWidth = 3; c.fill(); c.stroke();
  c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; c.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); } c.closePath();
  c.fillStyle = glow ? '#fff3a8' : '#ffc4dc'; c.lineWidth = 2; c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill(); c.stroke();
  c.restore();
  /* crank handle */
  const ha = spinning ? ang : -0.6;
  c.lineWidth = 3; c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x + Math.cos(ha) * 16, d.y + Math.sin(ha) * 16); c.stroke();
  c.fillStyle = '#6ec0f2'; c.beginPath(); c.arc(d.x + Math.cos(ha) * 16, d.y + Math.sin(ha) * 16, 4, 0, TAU); c.fill(); c.stroke();
  /* tray */
  c.fillStyle = '#fdf0d5'; c.lineWidth = 2.4; rr(c, d.x - 44, d.y + 20, 22, 9, 4); c.fill(); c.stroke();
  /* the ball drops into the tray: gold pops into a dress-up, white floats up and fades */
  if (t > SP1 && t < SP1 + 0.95) {
    const u = t - SP1, hit = cur.hit;
    const bx = d.x + d.dir * (22 + Math.min(1, u / 0.3) * 11);
    let by = d.y + 14 + Math.min(1, u / 0.3) * 8 - Math.abs(Math.sin(Math.min(u, 0.6) * 10)) * 5 * (1 - Math.min(1, u / 0.6));
    let al = 1, r = 6.5;
    if (u > 0.6) { const v = (u - 0.6) / 0.35; if (hit) { r = 6.5 + v * 8; al = 1 - v; } else { by -= v * 26; r = 6.5 + v * 3; al = 1 - v; } }
    c.save(); c.globalAlpha = Math.max(0, al);
    c.fillStyle = hit ? '#ffd23f' : '#e6f5fb'; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, r, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = hit ? '#fff' : 'rgba(255,255,255,0.9)'; if (hit) { star4(c, bx, by, r * 0.6); c.fill(); } else { c.beginPath(); c.arc(bx - r * 0.3, by - r * 0.3, r * 0.3, 0, TAU); c.fill(); }
    c.restore();
  }
  c.restore();
  const hm = HOME_D();
  for (const tk of tickets) if (tk.t >= TK0) drawTicketAt(c, hm, tk);
  if (waitSpins > 0) {   /* tickets waiting for their turn: bottom-right of the drum, clear of the ball on the left */
    const bx = hm.x + 30, by = hm.y + 44, ox = -14;
    c.save(); c.translate(bx, by); c.rotate(-0.15); c.lineJoin = 'round';
    for (let i = Math.min(2, waitSpins) - 1; i >= 0; i--) { c.fillStyle = '#ff9ec1'; c.strokeStyle = OUT; c.lineWidth = 2; rr(c, -12 + i * 3, -8 - i * 3, 24, 16, 3); c.fill(); c.stroke(); }
    c.fillStyle = '#ffd23f'; c.lineWidth = 1; star4(c, -4, 0, 5); c.fill(); c.stroke();
    c.restore();
    box(c, bx + ox, by - 22, 26, 16, 8, { fill: '#e0475b', lw: 2 }); txt(c, '×' + waitSpins, bx + ox + 13, by - 13.5, { size: 11, color: '#fff', align: 'center' });
  }
}
function statuePose() {
  const q = { dy: 0, rot: 0, lean: 0, flap: reduce ? 0 : Math.sin(clock * 2.2) * 0.1, wink: false, shine: (clock % 4.5) / 0.7 };
  if (!react || reduce) return q;
  const t = react.t;
  if (react.kind === 'hop') { const u = Math.min(1, t / 0.75); q.dy = -Math.abs(Math.sin(u * TAU)) * 9; q.flap = Math.sin(t * 28) * 0.55; }
  if (react.kind === 'wink') { q.wink = t > 0.25 && t < 0.95; q.shine = (t - 0.2) / 0.6; q.dy = -Math.sin(clamp(t / 0.35, 0, 1) * Math.PI) * 4; }
  if (react.kind === 'shower') { q.lean = -0.4 * Math.sin(clamp(t / 1.3, 0, 1) * Math.PI); q.flap = Math.sin(t * 34) * 0.6; }
  if (react.kind === 'fever') { const u = clamp((t - 0.1) / 0.8, 0, 1); q.dy = -Math.sin(u * Math.PI) * 12; q.rot = eIO(u) * TAU; q.flap = Math.sin(t * 30) * 0.6; }
  return q;
}
function goldFill(c, y0, y1) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#fff6b8'); g.addColorStop(0.45, '#ffd23f'); g.addColorStop(1, '#d99a00'); return g; }
function drawStatue(c) {
  if (boomT < LAND - 0.45) return;
  const h = HOME_D(), k = 1.35, fallU = clamp((boomT - (LAND - 0.45)) / 0.45, 0, 1);
  const fy = -110 * (1 - fallU * fallU), imp = boomT >= LAND && boomT < LAND + 0.35 ? Math.sin((boomT - LAND) / 0.35 * Math.PI) : 0, q = statuePose();
  /* light rays behind (landing / fever) */
  const ra = clamp(raysT / 0.8, 0, 1) * (reduce ? 0.5 : 1);
  if (ra > 0) {
    c.save(); c.translate(h.x, h.y); c.rotate(clock * 0.7); c.globalAlpha = 0.45 * ra; c.fillStyle = '#fff3a8';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 62, a - 0.11, a + 0.11); c.closePath(); c.fill(); }
    c.restore();
  }
  c.save(); c.translate(h.x, h.y + fy); c.scale(k, k); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = OUT;
  /* pedestal with a plate counting the outings since */
  c.lineWidth = 2.2; c.fillStyle = '#ff7aa8'; rr(c, -16, 12, 32, 15, 3); c.fill(); c.stroke();
  c.fillStyle = goldFill(c, 8, 14); rr(c, -20, 8, 40, 6, 3); c.fill(); c.stroke();
  c.fillStyle = '#fff6d6'; c.lineWidth = 1.4; rr(c, -11, 15, 22, 9, 2); c.fill(); c.stroke();
  const pb = plateBump > 0 ? 1 + 0.35 * Math.sin(plateBump / 0.4 * Math.PI) : 1;
  c.save(); c.translate(0, 19.8); c.scale(pb / k, pb / k); txt(c, String(statueN), 0, 0, { size: 9 * k * 0.85, color: '#7a4b00', align: 'center' }); c.restore();
  /* the duck */
  c.save(); c.translate(0, -1 + q.dy); c.translate(0, 9); c.scale(1 + 0.16 * imp, 1 - 0.16 * imp); c.translate(0, -9); c.rotate(q.lean + q.rot);
  c.fillStyle = goldFill(c, -21, 10); c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(12, -3); c.lineTo(23, -12); c.lineTo(18, 3); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, 0, 17, 10, 0, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.arc(-9, -12, 8.5, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#ffb347'; c.lineWidth = 1.8; c.beginPath(); c.ellipse(-18.5, -11, 5, 2.8, 0.1, 0, TAU); c.fill(); c.stroke();
  c.save(); c.translate(4, -1); c.rotate(-0.25 - q.flap); c.fillStyle = '#ffc21a'; c.lineWidth = 1.8; c.beginPath(); c.ellipse(2, 0, 8, 5, 0, 0, TAU); c.fill(); c.stroke(); c.restore();
  if (q.wink) { c.lineWidth = 1.8; c.beginPath(); c.moveTo(-13.5, -13.5); c.quadraticCurveTo(-11, -16, -8.5, -13.5); c.stroke(); }
  else { c.fillStyle = OUT; c.beginPath(); c.arc(-11, -14, 1.9, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-10.4, -14.6, 0.7, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(-6, -17.5, 2.6, 1.6, -0.5, 0, TAU); c.fill();
  if (q.shine >= 0 && q.shine <= 1) {   /* a glint sweeping across the gold */
    c.save(); c.beginPath(); c.ellipse(0, 0, 17, 10, 0, 0, TAU); c.arc(-9, -12, 8.5, 0, TAU); c.clip();
    const sx = -30 + 60 * q.shine, g = c.createLinearGradient(sx - 6, 0, sx + 6, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.rotate(0.35); c.fillRect(sx - 6, -30, 12, 60); c.restore();
  }
  c.restore();
  c.restore();
  /* idle twinkles around it */
  if (!reduce && statueUp()) {
    const slot = Math.floor(clock / 1.3), ph = (clock % 1.3) / 1.3, ox = Math.sin(slot * 12.9898) * 26, oy = Math.cos(slot * 78.233) * 18 - 6;
    if (ph < 0.5) { const s0 = Math.sin(ph / 0.5 * Math.PI); c.fillStyle = '#fff6b0'; c.strokeStyle = '#e0a100'; c.lineWidth = 1; star4(c, h.x + ox, h.y + oy, 5 * s0); c.fill(); c.stroke(); }
  }
}
/* in front of everything on the stage: dress-ups flying to their button, sparkles to the statue, drum pieces and smoke */
function drawDrumFx(c) {
  const h = HOME_D();
  for (const f of flies) {
    const t0 = 0.5; let x, y, sc;
    if (f.t < t0) { x = f.x0; y = f.y0 - 42 * Math.min(1, f.t / t0); sc = easeOutBack(Math.min(1, f.t / 0.3)); }
    else { const u = eIO(Math.min(1, (f.t - t0) / 0.75)), p = flyPath({ x: f.x0, y: f.y0 - 42 }, BTN.hat(), 30, u); x = p.x; y = p.y; sc = 1 - 0.5 * u; }
    c.save(); c.translate(x, y); c.scale(sc, sc);
    const g = c.createRadialGradient(-6, -8, 0, 0, 0, 26); g.addColorStop(0, '#fff'); g.addColorStop(0.6, '#f4fbff'); g.addColorStop(1, '#d9f0fb');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.fill(); iconDraw(c, f.it, 0, 0, 50); c.lineWidth = 3; c.strokeStyle = OUT; c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.stroke();
    c.restore();
    if (f.t < t0 + 0.15) {
      const label = L().gotShort(itemName(f.it)); setFont(c, 12, 900); const w = tw(c, label) + 18, lx = clamp(f.x0, w / 2 + 4, W - w / 2 - 4);
      c.save(); c.globalAlpha = Math.min(1, f.t / 0.2) * (f.t > t0 ? 1 - (f.t - t0) / 0.15 : 1);
      box(c, lx - w / 2, f.y0 - 12, w, 20, 10, { fill: '#e0475b', lw: 2 }); txt(c, label, lx, f.y0 - 1.5, { size: 12, color: '#fff', align: 'center' });
      c.restore();
    }
  }
  for (const o of orbs) {
    const u = clamp(o.t / ORB_T, 0, 1), e = u * u * (3 - 2 * u), d = { x: h.x, y: h.y + 10 };
    for (let i = 5; i >= 1; i--) { const p = ticketPos(o, d, Math.max(0, e - i * 0.04)); c.save(); c.globalAlpha = 0.7 - i * 0.12; c.fillStyle = i % 2 ? '#fff6b0' : '#ffd23f'; star4(c, p.x, p.y, 6 - i * 0.7); c.fill(); c.restore(); }
    const p = ticketPos(o, d, e), k = u < 0.15 ? easeOutBack(u / 0.15) : 1;
    c.save(); c.translate(p.x, p.y); c.rotate(u * 8); c.scale(k, k); c.fillStyle = '#ffd23f'; c.strokeStyle = '#b87900'; c.lineWidth = 1.5; star4(c, 0, 0, 9); c.fill(); c.stroke(); c.fillStyle = '#fff'; star4(c, 0, 0, 3.5); c.fill(); c.restore();
  }
  for (const q of puffs) {
    if (q.t < 0) continue; const u = q.t / q.dur;
    c.save(); c.globalAlpha = 0.85 * (1 - u); c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(120,100,90,0.25)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(q.x, q.y - u * 10, q.r * (0.6 + u * 0.9), 0, TAU); c.fill(); c.stroke(); c.restore();
  }
  for (const q of shards) {
    const al = q.t > q.dur * 0.7 ? 1 - (q.t - q.dur * 0.7) / (q.dur * 0.3) : 1;
    c.save(); c.globalAlpha = al; c.translate(q.x, q.y); c.rotate(q.a); c.strokeStyle = OUT; c.lineJoin = 'round';
    if (q.kind === 'shard') { c.fillStyle = q.col; c.lineWidth = 2; c.beginPath(); c.moveTo(-q.s, -q.s * 0.5); c.lineTo(q.s, -q.s * 0.3); c.lineTo(0, q.s * 0.8); c.closePath(); c.fill(); c.stroke(); }
    else if (q.kind === 'stick') { c.fillStyle = '#c48a63'; c.lineWidth = 2; rr(c, -q.s, -2, q.s * 2, 4, 2); c.fill(); c.stroke(); }
    else { c.fillStyle = q.gold ? '#ffd23f' : '#e6f5fb'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 4.5, 0, TAU); c.fill(); c.stroke(); }
    c.restore();
  }
}
function wipeAll() {
  seen = new Set(); seenRare = new Set(); achDone = new Set(); rareCount = {};
  try { for (const k of ['duckLab.zukan', 'duckLab.ach', K_USED, 'duckLab.rare', K_STATS, K_STYLE, K_MEDALS, K_UNL, K_UNLSEEN, K_GOT, K_GMISS, K_MIXN, K_STATN, K_TUT, 'duckLab.medals', 'duckLab.unl', 'duckLab.unlSeen']) localStorage.removeItem(k); } catch (_) {}
  usedSet = new Set(); gotSet = new Set(); giftMiss = 0; mixN = 0; statueN = 0; resetDrum(); TUTORIAL = true;
  loadStats(); initMedals(); initUnl(); loadStyle(); updateDot();
}
const goldGrad = stops => w => { const g = ctx.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const GOLD_WATER = goldGrad(['#ffe27a', '#fff6c2', '#f0b83a', '#ffe27a']);
function waterFill(w) {
  const so = SALTS.find(x => x.id === style.salt) || SALTS[0];
  if (so.id === 'gold') return GOLD_WATER(w);
  if (so.col !== 'rainbow') return so.col;
  const g = ctx.createLinearGradient(w.x, 0, w.x + w.w, 0);
  ['#ffc9c9', '#ffe3b0', '#fff6b0', '#c9f0c9', '#b8e4ff', '#d9c9ff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
  return g;
}

/* ---- sound (Web Audio, synthesized) ---- */
let actx = null, soundOn = true;
function ensureAudio() {
  if (!soundOn) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (_) {}
}
/* warm-up: play an inaudible (silent) buffer inside a user gesture so the first real sound is not delayed/blocked */
let warmed = false;
function warmAudio() {
  if (!soundOn) return;
  ensureAudio();
  if (!actx) return;
  try {
    if (!warmed) {
      const b = actx.createBuffer(1, 441, 22050), src = actx.createBufferSource();
      src.buffer = b; src.connect(actx.destination); src.start(0);
      tone('sine', 440, 440, 0.04, 0.00011);
      warmed = true;
    }
    if (actx.state === 'suspended') actx.resume();
  } catch (_) {}
}
['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, warmAudio, true));
function tone(type, f0, f1, dur, vol, delay) {
  if (!actx || !soundOn) return;
  try {
    const t = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (_) {}
}
const sfxBirth = () => { tone('sine', 380, 760, 0.16, 0.2); tone('triangle', 760, 1140, 0.1, 0.08, 0.05); };
const sfxClear = () => { tone('sine', 520, 780, 0.14, 0.16); tone('sine', 780, 1170, 0.16, 0.14, 0.1); };
const sfxNew = () => { tone('sine', 660, 660, 0.12, 0.16); tone('sine', 880, 880, 0.12, 0.16, 0.1); tone('sine', 1320, 1320, 0.2, 0.16, 0.2); };
const sfxDeliver = () => { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f * 1.01, 0.18, 0.18, i * 0.09)); };
/* grand finale jingle: rising sparkle run (two octaves up past 3 kHz) that settles into a bright chord */
const sfxFinale = () => {
  [523, 659, 784, 1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => tone('triangle', f, f * 1.005, 0.28, 0.15, i * 0.085));
  [1047, 1319, 1568, 2093].forEach(f => tone('sine', f, f * 1.005, 0.9, 0.1, 0.85));
};
const sfxAch = () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone('triangle', f, f * 1.01, 0.22, 0.17, i * 0.1)); };
const sfxPlop = () => tone('sine', 420, 180, 0.09, 0.12);
const sfxBoing = () => { tone('sine', 380, 900, 0.12, 0.16); tone('triangle', 900, 560, 0.14, 0.1, 0.1); };
const sfxHome = () => { tone('sine', 700, 520, 0.12, 0.14); tone('triangle', 520, 800, 0.16, 0.1, 0.1); };
const sfxFull = () => { tone('sine', 330, 220, 0.2, 0.14); };
const sfxRare = () => { tone('sine', 1500, 2200, 0.2, 0.1); tone('sine', 1800, 2600, 0.2, 0.08, 0.12); };
const sfxCatch = () => { [880, 1175, 1568].forEach((f, i) => tone('sine', f, f, 0.16, 0.16, i * 0.07)); };
function setSound(v) {
  soundOn = v; try { localStorage.setItem('duckLab.sound', v ? 'on' : 'off'); } catch (_) {}
  if (v) warmAudio();
}
try { soundOn = localStorage.getItem('duckLab.sound') !== 'off'; } catch (_) {}

/* ---- layout ---- */
function layout() {
  const faucetH = clamp(H * 0.1, 46, 70);
  const m = 6;
  const rim = clamp(W * 0.06, 14, 24);
  const tub = { x: m, y: faucetH, w: W - m * 2, h: H - faucetH - 40 };
  const water = { x: tub.x + rim, y: tub.y + rim, w: tub.w - rim * 2, h: tub.h - rim * 2 };
  const r = clamp(Math.min(water.w, water.h) / 12.5, 14, 28);
  geo = {
    faucetH, rim, tub, water, r,
    spawn: { x: tub.x + tub.w * 0.22, y: water.y + r * 1.4 },
    home: { x: tub.x + tub.w - r * 2.1, y: H - 34 + r * 0.9 * 0.15 - 13, rad: r * 0.9 }
  };
}
function fit() {
  const r = cv.getBoundingClientRect();
  VW = Math.max(1, r.width); VH = Math.max(1, r.height);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const bw = Math.round(VW * dpr), bh = Math.round(VH * dpr);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  S = Math.min(VW / DESIGN_W, VH / DESIGN_H);
  OX = (VW - DESIGN_W * S) / 2; OY = (VH - DESIGN_H * S) / 2;
}

/* ---- ducks ---- */
function makeDuck(c, p, x, y, age) {
  return { c, p, rare: null, life: 0, x, y, vx: 0, vy: 0, th: rand(0, TAU), turn: rand(-1, 1), turnT: rand(0.5, 2),
    sp: rand(0.7, 1.25), phase: rand(0, TAU), flip: Math.random() < 0.5, age, shake: 0 };
}
function count() { let n = 0; for (const d of ducks) if (!d.rare) n++; return n; }
/* once the tub is past half full the house starts calling: bigger, wobbling, a halo, little z's. level 1..5 every 5 ducks over 25 */
const HOUSE_FROM = 25, HOUSE_STEP = 5;
function houseLevel() { if (state !== 'play') return 0; const n = count(); return n <= HOUSE_FROM ? 0 : Math.min(5, 1 + Math.floor((n - HOUSE_FROM - 1) / HOUSE_STEP)); }
const houseScale = () => 1 + 0.07 * houseLevel();
function freePos() {
  const g = geo, r = g.r;
  let bestP = null, bestD = -1;
  for (let i = 0; i < 14; i++) {
    const x = rand(g.water.x + r, g.water.x + g.water.w - r);
    const y = rand(g.water.y + r, g.water.y + g.water.h - r);
    let md = Math.hypot(x - g.home.x, y - g.home.y) - r;
    for (const d of ducks) md = Math.min(md, Math.hypot(d.x - x, d.y - y));
    if (md > bestD) { bestD = md; bestP = { x, y }; }
  }
  return bestP;
}
function fillStart() {
  ducks = [];
  const list = BASES.slice();
  for (let i = 0; i < (TUTORIAL ? 0 : CFG.START_EXTRA); i++) list.push(BASES[Math.floor(Math.random() * BASES.length)]);
  for (const b of list) { const p = freePos(); ducks.push(makeDuck(b[0], b[1], p.x, p.y, 1)); }
}
function spawnSupply() {
  const g = geo;
  const cnt = BASES.map(b => ducks.filter(d => !d.rare && d.c === b[0] && d.p === b[1]).length);
  const wts = cnt.map(n => 1 / Math.pow(1 + n, 1.5));
  let sum = 0; for (const w of wts) sum += w;
  let r = Math.random() * sum, idx = 0;
  for (; idx < wts.length - 1; idx++) { r -= wts[idx]; if (r <= 0) break; }
  const b = BASES[idx];
  const d = makeDuck(b[0], b[1], g.spawn.x + rand(-6, 6), g.spawn.y + rand(-4, 4), 0);
  d.vx = rand(-20, 20); d.vy = rand(10, 30);
  ducks.push(d);
  stats.born[gid(b[0], b[1])]++; saveStats();
  discover(b[0], b[1]);
  checkMedals(); checkUnlocks();
  ring(g.spawn.x, g.spawn.y); splash(g.spawn.x, g.spawn.y, 6); sfxPlop();
  if (Math.random() < CFG.RARE_P) spawnRare();
}
function spawnRare() {
  const g = geo;
  const id = RARE_IDS[Math.floor(Math.random() * RARE_IDS.length)];  /* any number of secret visitors can be in the tub at once */
  const d = makeDuck(0, 0, g.spawn.x + rand(30, 60), g.spawn.y + rand(0, 30), 0);
  d.rare = id; d.life = CFG.RARE_LIFE;
  ducks.push(d);
  texts.push({ x: d.x, y: d.y - g.r * 1.8, text: L().someone, t: 0, dur: 1.4, kind: 'rare' });
  sfxRare();
}
function supplyInterval() { return Math.max(CFG.SUPPLY_MIN, CFG.SUPPLY_START - CFG.SUPPLY_RAMP * gameTime); }

/* ---- zukan ---- */
function discover(c, p) {
  if (c === 0 && p === 0) return false;
  const id = gid(c, p);
  if (seen.has(id)) return false;
  seen.add(id); saveZukan(); checkZukanAch(); checkMedals(); checkUnlocks();
  return true;
}

/* ---- effects ---- */
function ring(x, y) { fx.push({ kind: 'ring', x, y, t: 0, dur: 0.7 }); }
function splash(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI, 0), s = rand(60, 170);
    fx.push({ kind: 'drop', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, dur: rand(0.4, 0.7), s: rand(2.5, 4.5) });
  }
}
function stars(x, y, n, cols) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(60, 200);
    fx.push({ kind: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, dur: rand(0.5, 0.9), s: rand(5, 9), col: cols[i % cols.length] });
  }
}
function hearts(x, y, n) {
  const cols = ['#ff7aa8', '#ff9ec1', '#ff5d9a'];
  for (let i = 0; i < n; i++) {
    fx.push({ kind: 'heart', x: x + rand(-geo.r * 0.8, geo.r * 0.8), y: y + rand(-6, 6), t: 0, dur: rand(0.9, 1.4), s: rand(7, 11), col: cols[i % cols.length] });
  }
}
/* front = petals spilling from the celebration bubble: drawn in front of it and drifting down into the tub */
function petals(x, y, n, front) {
  const cols = ['#ffc2d6', '#ffffff', '#ff9ec1', '#ffe3ec'];
  for (let i = 0; i < n; i++) {
    if (front) fx.push({ kind: 'petal', front: true, x: x + rand(-14, 14), y: y + rand(-8, 8), vx: rand(-120, 120), vy: -rand(0, 60), t: 0, dur: rand(1.4, 2.0), s: rand(5, 8), rot: rand(0, TAU), col: cols[i % cols.length] });
    else fx.push({ kind: 'petal', x, y, vx: rand(-90, 90), vy: -rand(70, 170), t: 0, dur: rand(1.0, 1.6), s: rand(5, 8), rot: rand(0, TAU), col: cols[i % cols.length] });
  }
}
/* every duck in the tub hops twice for joy (staggered) when a medal or prize is celebrated */
function cheer() { if (reduce) return; for (const d of ducks) if (!d.rare) { d.cheerT = rand(0.05, 0.45); d.cheerN = 2; } }
function zzz(x, y) {
  for (let i = 0; i < 3; i++) fx.push({ kind: 'zzz', x: x + i * 9, y: y - i * 11, t: -i * 0.2, dur: 1.2, s: 13 + i * 4 });
}
function leaveFx(d, spin) {
  fx.push({ kind: 'leave', g: { c: d.c, p: d.p, rare: d.rare }, x: d.x, y: d.y, flip: d.flip, t: 0, dur: 0.6, dx: rand(-40, 40), spin });
}

/* ---- target ---- */
function pickTarget() {
  const maxC = delivered < 3 ? 1 : delivered < 6 ? 2 : delivered < 10 ? 3 : 4;
  const minC = Math.max(1, maxC - 1);
  const pool = [];
  for (let c = 0; c < 8; c++) for (let p = 0; p < 4; p++) {
    if ((c === 0 && p === 0) || isBase(c, p)) continue;
    const k = cost(c, p);
    if (k < minC || k > maxC) continue;
    if (target && target.c === c && target.p === p) continue;
    if (ducks.some(d => !d.rare && d.c === c && d.p === p)) continue;
    pool.push({ c, p });
  }
  if (!pool.length) {
    for (let c = 0; c < 8; c++) for (let p = 0; p < 4; p++) if (!((c === 0 && p === 0) || isBase(c, p))) pool.push({ c, p });
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
/* the order card shows the target once the delivered duck has landed on it */
let shownTarget = null;

/* ---- game flow ---- */
function startGame() {
  ensureAudio();
  fillStart();
  for (const b of BASES) discover(b[0], b[1]);
  fx = []; texts = []; drag = null;
  delivered = 0; gameTime = 0; supplyTimer = 2.5; noticeT = 0; homeBounce = 0;
  target = null; target = pickTarget(); shownTarget = target;
  state = 'play'; paused = false; updateQBtns();
  zOpen = false; zDetail = null; qClose(); resetDrum();
  achQueue = []; achCur = null; if (celeb) endCeleb(); pendItems = [];
  cardWait = 0; stampT = 0; bounceT = 0;
  refreshNotice();
  startGuide();
}
function showNotice(text, sec) {
  noticeTxt = text;
  noticeT = sec || 2.2;
  refreshNotice();
}
/* a short notice wins; otherwise a full tub keeps its message up for as long as it stays full */
function refreshNotice() {
  if (guide && guideNotice()) return;
  if (cur && noticeT <= 0) { noticeShown = ''; noticeRule = false; return; }   /* the drum is turning: keep the top clear */
  let txt = '';
  if (noticeT > 0) txt = noticeTxt;
  else if (state === 'play' && count() >= CFG.CAP) txt = L().fullBanner;
  else if (state === 'play' && !achCur) { const rs = L().rules.filter((r, i) => [mixN, stats.out, stats.nap][i] < 3); if (rs.length) txt = rs[Math.floor(clock / 4.5) % rs.length]; }
  if (txt === noticeShown) return;
  noticeShown = txt;
  noticeRule = !!txt && noticeT <= 0 && count() < CFG.CAP;
}
let gaugeRatio = 0, gaugeShown = 0, gaugeLevel = 'ok', gaugeCountTxt = '0 / ' + CFG.CAP, gaugeTag = '';
function updateGauge() {
  const n = count();
  if (n === lastN) return;
  lastN = n;
  gaugeRatio = clamp(n / CFG.CAP, 0, 1);
  gaugeLevel = gaugeRatio >= 0.9 ? 'danger' : gaugeRatio >= 0.6 ? 'warn' : 'ok';
  gaugeCountTxt = n + ' / ' + CFG.CAP;
  gaugeTag = n >= CFG.CAP ? L().tagFull : gaugeLevel === 'danger' ? L().tagPacked : gaugeLevel === 'warn' ? L().tagLively : L().tagCalm;
}

/* ---- actions ---- */
function remove(d) { ducks = ducks.filter(x => x !== d); }
function cross(a, b) {
  if (guideBlocks(a, b)) return;
  if (a.c === b.c && a.p === b.p) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const balloons = ['#ff9ec1', '#6ec0f2', '#ffd23f', '#7fd9b0', '#c9a6f2'];
    fx.push({ kind: 'carry', g: { c: a.c, p: a.p, rare: null }, ax: a.x, ay: a.y, bx: b.x, by: b.y, fa: a.x > b.x, mx, my,
      col: balloons[Math.floor(Math.random() * balloons.length)], t: 0, dur: 1.6 });
    hearts(mx, my - geo.r, 4);
    remove(a); remove(b);
    stats.out++; afterStat();
    texts.push({ x: mx, y: my - geo.r * 1.8, text: L().outTxt, t: 0, dur: 1.3, kind: 'plain' });
    sfxClear();
    outingLottery(mx, my - geo.r);
    guideOut();
    return;
  }
  if (count() >= CFG.CAP) {
    a.shake = 0.45; b.shake = 0.45;
    showNotice(L().fullAlert, 2.8);
    sfxFull();
    return;
  }
  const c = a.c | b.c, p = a.p | b.p;
  mixN++; lsSet(K_MIXN, mixN);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const child = makeDuck(c, p, mx, my, 0);
  stats.born[gid(c, p)]++;
  child.vx = rand(-30, 30); child.vy = rand(-30, 30);
  ducks.push(child);
  ring(mx, my); stars(mx, my, 8, ['#ffd23f', '#ff9ec1', '#ffffff']);
  const fresh = discover(c, p);
  if (fresh) {
    const hit = target && c === target.c && p === target.p;
    texts.push({ x: mx, y: hit ? my + geo.r * 1.7 : my - geo.r * 1.8, text: L().newTxt + gname(c, p), t: 0, dur: 1.5, kind: 'new' });
    sfxNew();
  } else {
    sfxBirth();
  }
  if (target && c === target.c && p === target.p) deliver(child);
  afterStat();
}
/* a finished order: petals fall, the duck flies up to the order card, the card gets a hanamaru stamp */
function deliver(child) {
  guideHit(child.x, child.y);
  remove(child);
  fx.push({ kind: 'fly', g: { c: child.c, p: child.p, rare: null }, x: child.x, y: child.y, flip: child.flip, t: 0, dur: 0.85 });
  petals(child.x, child.y, 16);
  stars(child.x, child.y, 8, ['#ffd23f', '#ffffff', '#ff9ec1']);
  delivered++; stats.hana++;
  texts.push({ x: child.x, y: child.y - geo.r * 1.4, text: L().hanamaru, t: 0, dur: 1.4, kind: 'deliver' });
  sfxDeliver();
  target = pickTarget();
  cardWait = 0.85;
}
function landCard() {
  shownTarget = target;
  if (L().deliver[delivered]) pushAch(L().deliver[delivered]);
  stampT = 1.3; bounceT = 0.5;
}
function goHome(d) {
  guideNap();
  fx.push({ kind: 'hop', g: { c: d.c, p: d.p, rare: d.rare }, x: d.x, y: d.y, t: 0, dur: 0.75 });
  remove(d);
  homeBounce = 0.5;
  stats.nap++; afterStat();
  zzz(geo.home.x + geo.r * 0.5, geo.home.y - geo.r * 1.5);
  texts.push({ x: geo.home.x - geo.r * 0.8, y: geo.home.y - geo.r * 2.3, text: L().napTxt, t: 0, dur: 1.2, kind: 'plain' });
  sfxHome();
}
/* a plain tap makes the duck hop and quack */
function tapDuck(d) {
  if (d.hop > 0) return;
  d.hop = 0.5;
  ring(d.x, d.y + geo.r * 0.5);
  if (Math.random() < 0.45) { const q = L().quack; texts.push({ x: d.x, y: d.y - geo.r * 1.9, text: q[Math.floor(Math.random() * q.length)], t: 0, dur: 0.9, kind: 'plain' }); }
  sfxBoing();
}
function catchRare(d) {
  remove(d);
  leaveFx(d, 1);
  stars(d.x, d.y, 14, ['#ffd23f', '#ffffff', '#ff9ec1', '#6ec0f2']);
  const fresh = !seenRare.has(d.rare);
  if (fresh) { seenRare.add(d.rare); saveZukan(); }
  const cnt = (rareCount[d.rare] || (fresh ? 0 : 1)) + 1;
  rareCount[d.rare] = cnt; saveRare();
  if (fresh) pushAch(L().rareFirst(RARE[d.rare].n));
  else if ([5, 10, 25, 50].includes(cnt)) pushAch(L().rareN(RARE[d.rare].n, cnt));
  texts.push({ x: d.x, y: d.y - geo.r * 1.8, text: fresh ? L().lucky(RARE[d.rare].n) : L().thanks(RARE[d.rare].n), t: 0, dur: 1.8, kind: 'rare' });
  sfxCatch();
}

/* =====================================================================
   UI drawing helpers (every piece of UI is drawn on the canvas)
   ===================================================================== */
function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
/* a rounded box with an optional solid drop shadow (like CSS box-shadow 0 Ypx 0 colour) and dashed border */
function box(c, x, y, w, h, r, o) {
  o = o || {};
  if (o.shadow) { c.fillStyle = o.shadow; rr(c, x, y + (o.sy || 4), w, h, r); c.fill(); }
  if (o.ring) { c.fillStyle = o.ring; rr(c, x - 3, y - 3, w + 6, h + 6, r + 3); c.fill(); }
  rr(c, x, y, w, h, r);
  if (o.fill) { c.fillStyle = o.fill; c.fill(); }
  if (o.lw) {
    c.lineWidth = o.lw; c.strokeStyle = o.stroke || OUT;
    if (o.dash) c.setLineDash(o.dash);
    rr(c, x + o.lw / 2, y + o.lw / 2, w - o.lw, h - o.lw, Math.max(0, r - o.lw / 2)); c.stroke();
    if (o.dash) c.setLineDash([]);
  }
}
function setFont(c, size, weight) { c.font = (weight || 700) + ' ' + size + 'px ' + FONT; }
const tw = (c, s) => c.measureText(s).width;
/* wraps on explicit \n, then by width: latin by word, Japanese by character (punctuation never starts a line) */
function wrap(c, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    if (tw(c, para) <= maxW) { out.push(para); continue; }
    const toks = para.match(/[A-Za-z0-9'’!?.,:;()%×\-+/"~]+\s*|\s+|./gu) || [];
    let line = '';
    for (const tk of toks) {
      const cand = line + tk;
      if (line.trim() && tw(c, cand.trimEnd()) > maxW && !/^[、。」』）！？ー…〜♪,.!?)]/.test(tk)) { out.push(line.trimEnd()); line = tk.trimStart(); }
      else line = cand;
    }
    if (line) out.push(line.trimEnd());
  }
  return out;
}
/* draw text. o: size, weight, color, align, base, glow (outline colour), glowW, maxW (shrink to fit) */
function txt(c, s, x, y, o) {
  o = o || {};
  let size = o.size || 14;
  setFont(c, size, o.weight || 900);
  if (o.maxW) { const w0 = tw(c, s); if (w0 > o.maxW) { size = Math.max(7, size * o.maxW / w0); setFont(c, size, o.weight || 900); } }
  c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'middle';
  if (o.glow) { c.lineJoin = 'round'; c.lineWidth = o.glowW || 4; c.strokeStyle = o.glow; c.strokeText(s, x, y); }
  c.fillStyle = o.color || INK; c.fillText(s, x, y);
  return tw(c, s);
}
/* multi-line block centred on cx (or left-aligned at x), top at y. returns the height */
function txtBlock(c, s, x, y, maxW, o) {
  o = o || {};
  setFont(c, o.size || 14, o.weight || 900);
  const lines = wrap(c, s, maxW), lh = (o.size || 14) * (o.lh || 1.35);
  if (o.draw !== false) lines.forEach((ln, i) => txt(c, ln, x, y + lh * (i + 0.5), { size: o.size, weight: o.weight, color: o.color, align: o.align || 'center', glow: o.glow, glowW: o.glowW }));
  return lines.length * lh;
}
function blockSize(c, s, maxW, size, weight, lh) {
  setFont(c, size, weight || 900);
  const lines = wrap(c, s, maxW);
  return { w: Math.max(0, ...lines.map(l => tw(c, l))), h: lines.length * size * (lh || 1.35), n: lines.length };
}

/* ---- vector art: the pictures (title art, medals, bottles, icons) are kept as small SVG-style shape lists and
   drawn straight onto the canvas with Path2D / arc / fillText / gradients. No image is created and nothing is fetched. ---- */
const DK_DEFS = '<defs><symbol id="dk" viewBox="0 0 44 36"><ellipse cx="17" cy="24" rx="14" ry="10" fill="currentColor" stroke="#4a3a30" stroke-width="2"/><path d="M9 24 q6 6 13 0" fill="none" stroke="#4a3a30" stroke-width="1.6" stroke-linecap="round" opacity=".45"/><circle cx="28" cy="12" r="8" fill="currentColor" stroke="#4a3a30" stroke-width="2"/><path d="M35 11 l7 2.5 l-7 3.5 z" fill="#ff9a2e" stroke="#4a3a30" stroke-width="1.6" stroke-linejoin="round"/><circle cx="30" cy="10" r="1.7" fill="#4a3a30"/></symbol></defs>';
/* parse the markup once into a tree of { tag, a: attributes, k: children, t: text } */
function vecParse(src) {
  const root = { tag: '#root', a: {}, k: [] }, stack = [root], re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { if (m[5].trim()) top.k.push({ tag: '#text', t: m[5], a: {}, k: [] }); continue; }
    if (m[1]) { stack.pop(); continue; }
    const a = {}, ar = /([\w:-]+)="([^"]*)"/g; let q;
    while ((q = ar.exec(m[3]))) a[q[1]] = q[2];
    const node = { tag: m[2], a, k: [] };
    top.k.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}
function vecIds(node, ids) { if (node.a.id) ids[node.a.id] = node; for (const k of node.k) vecIds(k, ids); return ids; }
const DK_IDS = vecIds(vecParse(DK_DEFS), {});
const vecCache = new Map();
function vecDoc(src) {
  let d = vecCache.get(src);
  if (!d) {
    const root = vecParse(src), svg = root.k.find(n => n.tag === 'svg');
    d = { svg, ids: Object.assign({}, DK_IDS, vecIds(root, {})), vb: (svg.a.viewBox || '0 0 100 100').trim().split(/[\s,]+/).map(Number) };
    vecCache.set(src, d);
  }
  return d;
}
const num = (v, d) => (v === undefined || v === '' ? d : parseFloat(v));
function vecTransform(c, tf) {
  if (!tf) return;
  const re = /(translate|scale|rotate)\(([^)]*)\)/g; let m;
  while ((m = re.exec(tf))) {
    const v = m[2].trim().split(/[\s,]+/).map(Number);
    if (m[1] === 'translate') c.translate(v[0], v[1] || 0);
    else if (m[1] === 'scale') c.scale(v[0], v.length > 1 ? v[1] : v[0]);
    else if (v.length >= 3) { c.translate(v[1], v[2]); c.rotate(v[0] * Math.PI / 180); c.translate(-v[1], -v[2]); }
    else c.rotate(v[0] * Math.PI / 180);
  }
}
/* rough bounding box of path data (control points included), used only to place gradients */
function pathBox(d) {
  const t = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cmd = 'M', x = 0, y = 0, sx = 0, sy = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (px, py) => { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); };
  const ARGS = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 };
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i])) cmd = t[i++];
    const C = cmd.toUpperCase(), rel = cmd !== C;
    if (C === 'Z') { x = sx; y = sy; continue; }
    const v = []; for (let k = 0; k < ARGS[C]; k++) v.push(parseFloat(t[i++]));
    if (!v.length || v.some(isNaN)) break;
    if (C === 'H') x = rel ? x + v[0] : v[0];
    else if (C === 'V') y = rel ? y + v[0] : v[0];
    else if (C === 'A') { x = rel ? x + v[5] : v[5]; y = rel ? y + v[6] : v[6]; }
    else {
      for (let k = 0; k < v.length - 2; k += 2) add(rel ? x + v[k] : v[k], rel ? y + v[k + 1] : v[k + 1]);
      x = rel ? x + v[v.length - 2] : v[v.length - 2]; y = rel ? y + v[v.length - 1] : v[v.length - 1];
    }
    add(x, y);
    if (C === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
  }
  return { x: x0, y: y0, w: Math.max(1e-3, x1 - x0), h: Math.max(1e-3, y1 - y0) };
}
function rgba(col, a) {
  if (a >= 1 || !col || col[0] !== '#') return col;
  let h = col.slice(1); if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
  return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
}
function vecPaint(c, p, st, ids, box) {
  if (!p || p === 'none') return null;
  if (p === 'currentColor') return st.color || '#000';
  const m = /^url\(#([^)]+)\)$/.exec(p);
  if (!m) return p;
  const g = ids[m[1]]; if (!g) return null;
  let gr;
  if (g.tag === 'radialGradient') {
    const cx = box.x + num(g.a.cx, 0.5) * box.w, cy = box.y + num(g.a.cy, 0.5) * box.h;
    gr = c.createRadialGradient(cx, cy, 0, cx, cy, num(g.a.r, 0.5) * Math.max(box.w, box.h));
  } else gr = c.createLinearGradient(box.x + num(g.a.x1, 0) * box.w, box.y + num(g.a.y1, 0) * box.h, box.x + num(g.a.x2, 1) * box.w, box.y + num(g.a.y2, 0) * box.h);
  for (const s of g.k) if (s.tag === 'stop') gr.addColorStop(Math.min(1, num(s.a.offset, 0)), rgba(s.a['stop-color'], num(s.a['stop-opacity'], 1)));
  return gr;
}
const INHERIT = ['fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap', 'stroke-dasharray', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight', 'text-anchor'];
const SKIP = { defs: 1, symbol: 1, linearGradient: 1, radialGradient: 1, stop: 1, '#text': 1 };
function vecNode(c, n, st0, ids) {
  if (SKIP[n.tag]) return;
  const st = Object.assign({}, st0);
  for (const k of INHERIT) if (n.a[k] !== undefined) st[k] = n.a[k];
  if (n.a.style) for (const kv of n.a.style.split(';')) { const kvp = kv.split(':'); if (kvp[0].trim() === 'color') st.color = kvp[1].trim(); }
  c.save();
  if (n.a.opacity !== undefined) c.globalAlpha *= num(n.a.opacity, 1);
  vecTransform(c, n.a.transform);
  if (n.tag === 'g') { for (const k of n.k) vecNode(c, k, st, ids); c.restore(); return; }
  if (n.tag === 'svg') { /* nested picture: fit its viewBox into x / y / width / height */
    const vb = (n.a.viewBox || '').trim().split(/[\s,]+/).map(Number), w = num(n.a.width, vb[2]), h = num(n.a.height, vb[3]);
    c.translate(num(n.a.x, 0), num(n.a.y, 0));
    if (vb.length === 4) { const k = Math.min(w / vb[2], h / vb[3]); c.translate((w - vb[2] * k) / 2, (h - vb[3] * k) / 2); c.scale(k, k); c.translate(-vb[0], -vb[1]); }
    for (const k of n.k) vecNode(c, k, st, ids);
    c.restore(); return;
  }
  if (n.tag === 'use') {
    const sym = ids[(n.a.href || n.a['xlink:href'] || '').slice(1)];
    if (sym) {
      const vb = (sym.a.viewBox || '0 0 1 1').trim().split(/[\s,]+/).map(Number);
      c.translate(num(n.a.x, 0), num(n.a.y, 0));
      c.scale(num(n.a.width, vb[2]) / vb[2], num(n.a.height, vb[3]) / vb[3]); c.translate(-vb[0], -vb[1]);
      for (const k of sym.k) vecNode(c, k, st, ids);
    }
    c.restore(); return;
  }
  if (n.tag === 'text') {
    const s = n.k.filter(k => k.tag === '#text').map(k => k.t).join('');
    c.font = (st['font-weight'] || 400) + ' ' + num(st['font-size'], 16) + 'px ' + FONT;
    c.textAlign = st['text-anchor'] === 'middle' ? 'center' : st['text-anchor'] === 'end' ? 'right' : 'left'; c.textBaseline = 'alphabetic';
    const f = vecPaint(c, st.fill === undefined ? '#000' : st.fill, st, ids, { x: 0, y: 0, w: 1, h: 1 });
    if (f) { c.fillStyle = f; c.fillText(s, num(n.a.x, 0), num(n.a.y, 0)); }
    c.restore(); return;
  }
  /* shapes: built once into a Path2D and kept on the node */
  if (!n.p) {
    const a = n.a, p = new Path2D();
    let b;
    if (n.tag === 'path') { p.addPath(new Path2D(a.d)); b = pathBox(a.d); }
    else if (n.tag === 'circle') { const r = num(a.r, 0), cx = num(a.cx, 0), cy = num(a.cy, 0); p.arc(cx, cy, r, 0, TAU); b = { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }; }
    else if (n.tag === 'ellipse') { const rx = num(a.rx, 0), ry = num(a.ry, 0), cx = num(a.cx, 0), cy = num(a.cy, 0); p.ellipse(cx, cy, rx, ry, 0, 0, TAU); b = { x: cx - rx, y: cy - ry, w: 2 * rx, h: 2 * ry }; }
    else if (n.tag === 'rect') {
      const x = num(a.x, 0), y = num(a.y, 0), w = num(a.width, 0), h = num(a.height, 0), r = Math.min(num(a.rx, num(a.ry, 0)), w / 2, h / 2);
      if (r > 0) { p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); } else p.rect(x, y, w, h);
      b = { x, y, w, h };
    } else { c.restore(); return; }
    n.p = p; n.b = b;
  }
  const fill = vecPaint(c, st.fill === undefined ? '#000' : st.fill, st, ids, n.b);
  if (fill) { const ga = c.globalAlpha; c.globalAlpha = ga * num(st['fill-opacity'], 1); c.fillStyle = fill; c.fill(n.p); c.globalAlpha = ga; }
  const stroke = vecPaint(c, st.stroke, st, ids, n.b);
  if (stroke) {
    const ga = c.globalAlpha; c.globalAlpha = ga * num(st['stroke-opacity'], 1);
    c.strokeStyle = stroke; c.lineWidth = num(st['stroke-width'], 1);
    c.lineJoin = st['stroke-linejoin'] || 'miter'; c.lineCap = st['stroke-linecap'] || 'butt';
    c.setLineDash(st['stroke-dasharray'] ? st['stroke-dasharray'].trim().split(/[\s,]+/).map(Number) : []);
    c.stroke(n.p); c.setLineDash([]); c.globalAlpha = ga;
  }
  c.restore();
}
/* draws the picture contained (aspect kept) and centred in the box */
function drawSvg(c, src, x, y, w, h, alpha) {
  const d = vecDoc(src), vb = d.vb;
  const k = Math.min(w / vb[2], h / vb[3]);
  c.save();
  if (alpha !== undefined) c.globalAlpha *= alpha;
  c.translate(x + (w - vb[2] * k) / 2, y + (h - vb[3] * k) / 2); c.scale(k, k); c.translate(-vb[0], -vb[1]);
  for (const n of d.svg.k) vecNode(c, n, {}, d.ids);
  c.restore();
}

/* ---- hit regions: rebuilt every frame in draw order, the last one drawn is on top ---- */
let hits = [], HIT_ON = true;
function hit(x, y, w, h, fn, o) {
  if (!HIT_ON) return;
  hits.push(Object.assign({ x, y, w, h, fn }, o || {}));
}
const inside = (h, p) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h;
let press = null;
const isDown = key => !!(press && press.h.key === key && !press.moved && press.over);
function topHit(p) { for (let i = hits.length - 1; i >= 0; i--) if (inside(hits[i], p)) return hits[i]; return null; }
/* small one-shot animations keyed by name (button boing, pop-in, shake) */
const anim = {};
const startAnim = (k, dur) => { anim[k] = { t: 0, dur }; };
function animP(k) { const a = anim[k]; return a ? clamp(a.t / a.dur, 0, 1) : 1; }
function boingScale(k) { const a = anim[k]; if (!a || reduce) return 1; const p = a.t / a.dur; return p < 0.35 ? 1 + 0.45 * (p / 0.35) : p < 0.65 ? 1.45 - 0.55 * ((p - 0.35) / 0.3) : 0.9 + 0.1 * ((p - 0.65) / 0.35); }
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

/* ---- symbols (colour key): red=triangle, blue=square, yellow=circle ---- */
function sym(c, k, x, y, s, lw) {
  c.save(); c.lineJoin = 'round'; c.strokeStyle = OUT; c.lineWidth = lw || 1.6;
  c.beginPath();
  if (k === 0) { c.fillStyle = '#e0483a'; c.moveTo(x, y - s * 0.75); c.lineTo(x + s * 0.75, y + s * 0.62); c.lineTo(x - s * 0.75, y + s * 0.62); c.closePath(); }
  else if (k === 1) { c.fillStyle = '#2f6fc9'; c.rect(x - s * 0.69, y - s * 0.69, s * 1.38, s * 1.38); }
  else { c.fillStyle = '#ffd23f'; c.arc(x, y, s * 0.69, 0, TAU); }
  c.fill(); c.stroke(); c.restore();
}
/* pattern chips for the album legend: stripes / dots / both */
function patIcon(c, kind, x, y, r) {
  c.save();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#f6f4ee'; c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  const k = r / 6.5;
  if (kind === 1 || kind === 3) {
    if (kind === 3) { c.beginPath(); c.rect(x, y - r, r, r * 2); c.clip(); }
    c.strokeStyle = '#8a7a6c'; c.lineWidth = 2 * k; c.beginPath();
    for (const s of [[3, 2, 0, 8], [7, 0, -1, 15], [11, 0, 3, 17], [15, 1, 7, 17]]) { c.moveTo(x + (s[0] - 8) * k, y + (s[1] - 8) * k); c.lineTo(x + (s[2] - 8) * k, y + (s[3] - 8) * k); }
    c.stroke();
  }
  c.restore();
  c.fillStyle = '#8a7a6c';
  const dots = kind === 2 ? [[5.5, 6], [10.5, 6.5], [8, 10.5]] : kind === 3 ? [[4.2, 6], [5.6, 10.4]] : [];
  for (const d of dots) { c.beginPath(); c.arc(x + (d[0] - 8) * k, y + (d[1] - 8) * k, 1.3 * k, 0, TAU); c.fill(); }
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
  c.restore();
}

/* ---- artwork (SVG sources) ---- */
const SVG_HERO = '<svg viewBox="0 8 320 108"><rect x="6" y="64" width="308" height="50" rx="24" fill="#fdf6ec" stroke="#4a3a30" stroke-width="4"/><rect x="16" y="72" width="288" height="34" rx="17" fill="#bfe9f5" stroke="#4a3a30" stroke-width="3"/><path d="M40 90 q8 -6 16 0 M130 98 q8 -6 16 0 M250 88 q8 -6 16 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/><use href="#dk" x="22" y="42" width="58" height="48" style="color:#e8564a"/><use href="#dk" x="112" y="42" width="58" height="48" style="color:#3f7fd6"/><path d="M56 84 C 74 101, 102 101, 119 82" fill="none" stroke="#ff7aa8" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 9"/><path d="M178 66 h22 m-8 -8 l8 8 l-8 8" fill="none" stroke="#4a3a30" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><g transform="translate(212 22) scale(1.9)"><use href="#dk" x="0" y="0" width="44" height="36" style="color:#9a5bd0"/></g><g transform="translate(0 -8)"><rect x="50.7" y="30.8" width="16.6" height="14.4" rx="7.2" fill="#fff" fill-opacity=".94" stroke="#4a3a30" stroke-width="1.80"/><path d="M59.0 33.0 L64.2 42.0 L53.8 42.0 Z" fill="#e0483a" stroke="#4a3a30" stroke-width="1.35" stroke-linejoin="round"/></g><g transform="translate(0 -8)"><rect x="140.7" y="30.8" width="16.6" height="14.4" rx="7.2" fill="#fff" fill-opacity=".94" stroke="#4a3a30" stroke-width="1.80"/><rect x="144.9" y="34.0" width="8.1" height="8.1" fill="#2f6fc9" stroke="#4a3a30" stroke-width="1.35"/></g><g transform="translate(0 -8)"><rect x="250.6" y="22.8" width="28.8" height="14.4" rx="7.2" fill="#fff" fill-opacity=".94" stroke="#4a3a30" stroke-width="1.80"/><path d="M258.9 25.1 L264.1 34.0 L253.7 34.0 Z" fill="#e0483a" stroke="#4a3a30" stroke-width="1.35" stroke-linejoin="round"/><rect x="267.0" y="25.9" width="8.1" height="8.1" fill="#2f6fc9" stroke="#4a3a30" stroke-width="1.35"/></g><g fill="#ffd23f" stroke="#4a3a30" stroke-width="1.5" stroke-linejoin="round"><path d="M296 20 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z"/><path d="M206 12 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z"/></g></svg>';
const SVG_TILE1 = '<svg viewBox="0 0 84 44"><use href="#dk" x="0" y="14" width="24" height="20" style="color:#e8564a"/><use href="#dk" x="25" y="14" width="24" height="20" style="color:#3f7fd6"/><path d="M11 33.5 C 16 40.5, 28 40.5, 33 33" fill="none" stroke="#ff7aa8" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 4.6"/><path d="M51 24 h8 m-3 -3 l3 3 l-3 3" fill="none" stroke="#4a3a30" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><use href="#dk" x="60" y="12" width="24" height="20" style="color:#9a5bd0"/><g><rect x="11.1" y="5.6" width="7.8" height="6.7" rx="3.4" fill="#fff" fill-opacity=".94" stroke="#4a3a30" stroke-width="0.84"/><path d="M15.0 6.7 L17.4 10.9 L12.6 10.9 Z" fill="#e0483a" stroke="#4a3a30" stroke-width="0.63" stroke-linejoin="round"/></g><g><rect x="36.1" y="5.6" width="7.8" height="6.7" rx="3.4" fill="#fff" fill-opacity=".94" stroke="#4a3a30" stroke-width="0.84"/><rect x="38.1" y="7.1" width="3.8" height="3.8" fill="#2f6fc9" stroke="#4a3a30" stroke-width="0.63"/></g><g><rect x="68.3" y="3.1" width="13.4" height="6.7" rx="3.4" fill="#fff" fill-opacity=".94" stroke="#4a3a30" stroke-width="0.84"/><path d="M72.2 4.2 L74.6 8.4 L69.7 8.4 Z" fill="#e0483a" stroke="#4a3a30" stroke-width="0.63" stroke-linejoin="round"/><rect x="75.9" y="4.6" width="3.8" height="3.8" fill="#2f6fc9" stroke="#4a3a30" stroke-width="0.63"/></g></svg>';
const SVG_STAMP = '<svg viewBox="0 0 64 64"><g fill="#ff7aa8" stroke="#4a3a30" stroke-width="3"><circle cx="32" cy="12" r="9"/><circle cx="46" cy="18" r="9"/><circle cx="52" cy="32" r="9"/><circle cx="46" cy="46" r="9"/><circle cx="32" cy="52" r="9"/><circle cx="18" cy="46" r="9"/><circle cx="12" cy="32" r="9"/><circle cx="18" cy="18" r="9"/></g><circle cx="32" cy="32" r="15" fill="#fffaf0" stroke="#4a3a30" stroke-width="3"/><path d="M32 32 a3 3 0 1 1 6 0 a6 6 0 1 1 -12 0 a9 9 0 1 1 18 0" fill="none" stroke="#e0475b" stroke-width="3.5" stroke-linecap="round"/></svg>';
const SVG_STAMP_THIN = SVG_STAMP.replace(/stroke-width="3"/g, 'stroke-width="2"').replace('stroke-width="3.5"', 'stroke-width="2.5"');
const SVG_TILE2 = '<svg viewBox="0 0 72 44"><rect x="4" y="1" width="38" height="36" rx="9" fill="#fff" stroke="#4a3a30" stroke-width="2.5"/><use href="#dk" x="9" y="13" width="28" height="23" style="color:#9a5bd0"/><g transform="translate(42 17) scale(0.42)">' + SVG_STAMP.replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g><g><rect x="19.6" y="5.3" width="14.7" height="7.4" rx="3.7" fill="#fff" fill-opacity=".94" stroke="#4a3a30" stroke-width="0.92"/><path d="M23.9 6.5 L26.6 11.1 L21.2 11.1 Z" fill="#e0483a" stroke="#4a3a30" stroke-width="0.69" stroke-linejoin="round"/><rect x="28.0" y="6.9" width="4.1" height="4.1" fill="#2f6fc9" stroke="#4a3a30" stroke-width="0.69"/></g></svg>';
const SVG_LIM_OUT = '<svg viewBox="0 0 64 44"><path d="M32 22 L16 28 M32 22 L48 28" stroke="#4a3a30" stroke-width="1.6" fill="none"/><ellipse cx="32" cy="11" rx="9" ry="10" fill="#ff9ec1" stroke="#4a3a30" stroke-width="2"/><path d="M30 21 L32 24 L34 21 Z" fill="#ff9ec1" stroke="#4a3a30" stroke-width="1.5" stroke-linejoin="round"/><ellipse cx="29" cy="8" rx="2" ry="3.2" fill="#fff" opacity=".7"/><use href="#dk" transform="translate(31 26) scale(-1 1)" width="26" height="21" style="color:#ffd23f"/><use href="#dk" transform="translate(33 26)" width="26" height="21" style="color:#ffd23f"/></svg>';
const SVG_LIM_NAP = '<svg viewBox="0 0 64 44"><rect x="14" y="20" width="32" height="22" rx="5" fill="#fdf0d5" stroke="#4a3a30" stroke-width="2.5"/><path d="M9 22 L30 4 L51 22 Z" fill="#e0483a" stroke="#4a3a30" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 42 v-9 a6 6 0 0 1 12 0 v9 z" fill="#8b5a3c" stroke="#4a3a30" stroke-width="2"/><text x="50" y="14" font-size="12" font-weight="900" fill="#5b6fb0" font-family="sans-serif">z</text><text x="56" y="7" font-size="9" font-weight="900" fill="#5b6fb0" font-family="sans-serif">z</text></svg>';
const SVG_SPK_ON = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9z" fill="#ffd23f" stroke="#4a3a30" stroke-width="2" stroke-linejoin="round"/><path d="M15.5 8.5c1.6 1.8 1.6 5.2 0 7M18.3 5.8c3.2 3.4 3.2 9 0 12.4" fill="none" stroke="#4a3a30" stroke-width="2" stroke-linecap="round"/></svg>';
const SVG_SPK_OFF = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9z" fill="#ffd23f" stroke="#4a3a30" stroke-width="2" stroke-linejoin="round"/><path d="M16 9l6 6M22 9l-6 6" stroke="#e0475b" stroke-width="2.6" stroke-linecap="round"/></svg>';
const SVG_MENU = '<svg viewBox="0 0 30 26"><use href="#dk" x="0" y="2" width="30" height="24" style="color:#ffd23f"/><path d="M19 6 l-5 -4 v8z M19 6 l5 -4 v8z" fill="#ff6fa0" stroke="#4a3a30" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const SVG_HATBTN = '<svg viewBox="0 0 24 24"><rect x="3" y="16" width="18" height="4" rx="2" fill="#4a90e2" stroke="#4a3a30" stroke-width="2"/><path d="M6 16 V7 q0 -3 3 -3 h6 q3 0 3 3 V16z" fill="#6aa9ee" stroke="#4a3a30" stroke-width="2" stroke-linejoin="round"/><rect x="6" y="11.5" width="12" height="2.8" fill="#ff9ec1" stroke="#4a3a30" stroke-width="1.5"/></svg>';
const SVG_HAT_HINT = '<svg viewBox="0 0 44 46"><rect x="7" y="31" width="30" height="7" rx="3.5" fill="#c9d4da" stroke="#8a9aa5" stroke-width="2.2"/><path d="M12 31 V15 q0 -6 6 -6 h8 q6 0 6 6 V31z" fill="#dfe8ec" stroke="#8a9aa5" stroke-width="2.2" stroke-linejoin="round"/><text x="22" y="28" text-anchor="middle" font-size="15" font-weight="900" fill="#8a9aa5" font-family="' + SVG_FONT + '">？</text></svg>';
const SVG_GUIDE = '<svg viewBox="0 0 30 30"><path d="M15 3 l3 7 7 .8 -5.3 4.8 1.6 7.1 -6.3 -3.8 -6.3 3.8 1.6 -7.1 -5.3 -4.8 7 -.8z" fill="#ffd23f" stroke="#4a3a30" stroke-width="2" stroke-linejoin="round"/></svg>';
const ICON_BALLOON = '<svg viewBox="0 0 30 34"><path d="M15 20 L15 32" stroke="#4a3a30" stroke-width="2" fill="none"/><ellipse cx="15" cy="10" rx="9" ry="10" fill="#ff9ec1" stroke="#4a3a30" stroke-width="2.2"/><path d="M13 20 l2 3.5 l2 -3.5z" fill="#ff9ec1" stroke="#4a3a30" stroke-width="1.8" stroke-linejoin="round"/><ellipse cx="11.5" cy="7" rx="2" ry="3.2" fill="#fff" opacity=".7"/></svg>';
const ICON_HOUSE = '<svg viewBox="0 0 34 30"><rect x="7" y="13" width="20" height="15" rx="3" fill="#fdf0d5" stroke="#4a3a30" stroke-width="2.2"/><path d="M3 15 L17 2 L31 15 Z" fill="#e0483a" stroke="#4a3a30" stroke-width="2.2" stroke-linejoin="round"/><path d="M14 28 v-6 a3 3 0 0 1 6 0 v6z" fill="#8b5a3c" stroke="#4a3a30" stroke-width="1.8"/></svg>';

function starPath(cx, cy, ro, ri) { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1); } return d + 'Z'; }
const medalSvg2 = () => '<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="23" fill="#ffd23f" stroke="#4a3a30" stroke-width="3"/><circle cx="28" cy="28" r="16" fill="#fff3b8" stroke="#e0a100" stroke-width="2"/><path d="' + starPath(28, 28.5, 11, 4.6) + '" fill="#ff7aa8" stroke="#4a3a30" stroke-width="2" stroke-linejoin="round"/></svg>';
const MD_OL = '#4a3a30';
const mdRib = (a, b) => '<path d="M13 34 L8 56 L18 50 L24 56 L27 34Z" fill="' + a + '" stroke="' + MD_OL + '" stroke-width="2" stroke-linejoin="round"/><path d="M35 34 L40 56 L30 50 L24 56 L21 34Z" fill="' + b + '" stroke="' + MD_OL + '" stroke-width="2" stroke-linejoin="round"/>';
const mdStar = (c, x, y, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * rr2).toFixed(1) + ' ' + (y + Math.sin(a) * rr2).toFixed(1); } return '<path d="' + d + 'Z" fill="' + c + '" stroke="' + MD_OL + '" stroke-width="1.6" stroke-linejoin="round"/>'; };
const mdSpark = (c, x, y) => { x = x == null ? 42 : x; y = y == null ? 6 : y; return '<g fill="' + c + '" stroke="' + MD_OL + '" stroke-width="1" stroke-linejoin="round"><path d="M' + x + ' ' + y + ' l1.6 3.6 l3.6 1.6 l-3.6 1.6 l-1.6 3.6 l-1.6 -3.6 l-3.6 -1.6 l3.6 -1.6z"/></g>'; };
const mdCrown = (x, y, rot, k) => '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + (k || 1) + ') translate(-24 -3)"><path d="M15 3 L18 -3 L22 1 L24 -4 L26 1 L30 -3 L33 3Z" fill="#ffd23f" stroke="' + MD_OL + '" stroke-width="1.8" stroke-linejoin="round"/></g>';
const MD_GRAD = '<defs><linearGradient id="mdPearl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd9ec"/><stop offset=".33" stop-color="#fff3b8"/><stop offset=".66" stop-color="#c8f1ff"/><stop offset="1" stop-color="#e3d2ff"/></linearGradient><linearGradient id="mdRain" x1="0" x2="1"><stop offset="0" stop-color="#ff9a9a"/><stop offset=".25" stop-color="#ffd27a"/><stop offset=".5" stop-color="#b7f0a0"/><stop offset=".75" stop-color="#8fd3ff"/><stop offset="1" stop-color="#c9a8ff"/></linearGradient></defs>';
const MD_SECRET_RING = { gold: '#ffe58a', rainbow: '#ff9ec1', night: '#9fd0ff', all: '#ffffff' };
/* one palette per category: hana = flower, zukan = book, out = balloon, nap = house, born = duck */
const MD_CAT = {
  hana: { main: '#ff9ec1', pale: '#ffe0ec', ink: '#8a2350', rA: '#e0475b', rB: '#ff9ec1', hi: '#ffc4da' },
  zukan: { main: '#7fd9b0', pale: '#dcf7ea', ink: '#1f6a49', rA: '#2f9e75', rB: '#9be3c3', hi: '#b4ecd3' },
  out: { main: '#6ec0f2', pale: '#d9f0fd', ink: '#1d5a85', rA: '#3f8fd6', rB: '#9ad4f7', hi: '#a9dcf8' },
  nap: { main: '#b79cff', pale: '#ebe2ff', ink: '#4b2f9a', rA: '#7a4fd6', rB: '#c6b2ff', hi: '#d3c4ff' },
  born: { main: '#ffc247', pale: '#ffe9c2', ink: '#7a4300', rA: '#e08a1f', rB: '#ffd27a', hi: '#ffe27a' }
};
const MD_ST = 'stroke="' + MD_OL + '" stroke-width="2.4" stroke-linejoin="round"';
const mdFlower = (cx, cy, R, r) => { let s = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += '<circle cx="' + (cx + Math.cos(a) * R).toFixed(1) + '" cy="' + (cy + Math.sin(a) * R).toFixed(1) + '" r="' + r + '"/>'; } return s; };
/* returns { art, y (number baseline centre), crown } for each category's motif */
function mdMotif(cat, c, last, done) {
  const id = 'mdg', top = done ? (last ? '#ffe98a' : c.hi) : '#dfe8ec', bot = done ? (last ? '#ffc21f' : c.main) : '#c9d4da', fill = 'url(#' + id + ')', inner = done ? c.pale : '#f1f5f7';
  const defs = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset="1" stop-color="' + bot + '"/></linearGradient></defs>';
  const gloss = done ? '<path d="M12 12 Q16 5 25 4" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="3" stroke-linecap="round"/>' : '';
  const ry = done ? c.rA : '#c9d4da', rb = done ? c.rB : '#d6dee3';
  let art, y = 22, crown, ribbon = true;
  if (cat === 'hana') { art = '<g fill="' + fill + '" ' + MD_ST + '>' + mdFlower(24, 22, 13.5, 7) + '</g><circle cx="24" cy="22" r="13" fill="' + inner + '" ' + MD_ST + '/>' + gloss; crown = mdCrown(24, 3, 0, 1); }
  else if (cat === 'zukan') { art = '<path d="M5 6 Q14 2 24 7 Q34 2 43 6 V37 Q34 33 24 38 Q14 33 5 37Z" fill="' + fill + '" ' + MD_ST + '/><path d="M10 10 Q16 8 24 11.5 Q32 8 38 10 V31 Q32 29 24 33 Q16 29 10 31Z" fill="' + inner + '" stroke="none"/><path d="M24 8 V12 M24 32 V37" stroke="' + MD_OL + '" stroke-width="1.6"/>' + gloss; crown = mdCrown(24, 4, 0, 1); }
  else if (cat === 'nap') { art = '<path d="M24 1.5 L45 19 H39 V40 Q39 42 37 42 H11 Q9 42 9 40 V19 H3Z" fill="' + fill + '" ' + MD_ST + '/><path d="M24 8 L36 18.5 V37 H12 V18.5Z" fill="' + inner + '" stroke="none"/>' + gloss; y = 28; crown = mdCrown(24, 3, 0, 1); }
  else if (cat === 'out') { /* tilted balloon with a wavy string instead of a ribbon */
    ribbon = false; y = 17.6;
    art = '<path d="M27 40 C 20 44, 32 48, 25 52 S 31 57, 27 59" fill="none" stroke="' + MD_OL + '" stroke-width="2.2" stroke-linecap="round"/><g transform="rotate(-16 24 20)"><path d="M20.2 36.8 L24 30.8 L27.8 36.8Z" fill="' + bot + '" ' + MD_ST + '/><ellipse cx="24" cy="17" rx="16.5" ry="19.5" fill="' + fill + '" ' + MD_ST + '/><ellipse cx="24" cy="17" rx="11.6" ry="14.4" fill="' + inner + '"/>' + (done ? '<path d="M11.5 12 Q13.5 5.5 20 3.8" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.8" stroke-linecap="round"/>' : '') + '</g>';
    crown = mdCrown(18.6, 1.4, -16, 1); }
  else { /* duck swimming to the right */
    const bk = done ? '#ff8a2a' : '#b9c6cd';
    art = '<path d="M6 24 L2.5 18 L11 20Z" fill="' + bot + '" ' + MD_ST + '/><ellipse cx="22" cy="27" rx="17" ry="12.5" fill="' + fill + '" ' + MD_ST + '/><circle cx="33" cy="12.5" r="9.2" fill="' + fill + '" ' + MD_ST + '/><ellipse cx="22" cy="27" rx="16" ry="11.5" fill="' + fill + '"/><circle cx="33" cy="12.5" r="8.3" fill="' + fill + '"/><path d="M40.6 12 Q47 11.5 46.5 15.2 Q41 17 40.4 15Z" fill="' + bk + '" stroke="' + MD_OL + '" stroke-width="1.8" stroke-linejoin="round"/><circle cx="35.6" cy="10.8" r="1.7" fill="' + MD_OL + '"/><ellipse cx="21" cy="28" rx="11.2" ry="7.2" fill="' + inner + '"/>';
    y = 28; crown = mdCrown(34, 4.4, 12, 1); }
  return { defs, art, y, crown, ribbon, ry, rb };
}
function medalSvg(m, done) {
  /* secret ducks: white pearl with an iridescent sheen, so they read as special next to the category medals */
  if (m.secret && done) {
    return '<svg viewBox="0 0 48 58">' + MD_GRAD + mdRib('#ff8fb8', '#8fd6ff')
      + '<circle cx="24" cy="22" r="18" fill="url(#mdPearl)" stroke="' + MD_OL + '" stroke-width="2.5"/><circle cx="24" cy="22" r="13" fill="none" stroke="' + (MD_SECRET_RING[m.secret] || '#fff') + '" stroke-width="2.5"/>'
      + mdStar('#b05fd0', 24, 22, 9) + mdSpark('#fff') + '</svg>';
  }
  const c = MD_CAT[m.cat]; if (!c) return '';
  const list = MEDAL_STEPS[m.cat];
  const last = m.n === list[list.length - 1];
  const b = mdMotif(m.cat, c, last, done);
  const t = String(m.n), fs = t.length >= 3 ? 12 : 15;
  return '<svg viewBox="0 -9 48 67">' + b.defs + (b.ribbon ? mdRib(b.ry, b.rb) : '') + b.art + (done && last ? b.crown + mdSpark('#fff') : '')
    + '<text x="' + (m.cat === 'out' ? 22.8 : 24) + '" y="' + (b.y + fs * 0.36) + '" text-anchor="middle" font-size="' + fs + '" font-weight="900" fill="' + (done ? c.ink : '#9fb4c0') + '" font-family="' + SVG_FONT + '">' + t + '</text></svg>';
}
/* the finale block under the medal grid: sunburst + big medal + garland (shown once every medal is collected) */
function everyBlockSvg() {
  const D = L();
  const hm = SVG_STAMP.replace('<svg viewBox="0 0 64 64">', '<svg x="29" y="33" width="26" height="26" viewBox="0 0 64 64">');
  const medal = mdRib('#7a4fd6', '#43c6c0') + '<circle cx="24" cy="23" r="19" fill="#2f3d6e" stroke="' + MD_OL + '" stroke-width="2.6"/><circle cx="24" cy="23" r="14" fill="none" stroke="url(#mdRain)" stroke-width="4"/>'
    + mdStar('#ffd23f', 24, 23, 9) + mdSpark('#ffd23f') + mdSpark('#fff', 5, 12) + mdCrown(24, 3, 0, 1.15) + hm;
  let rays = ''; for (let i = 0; i < 16; i++) { const a0 = i * Math.PI / 8, a1 = a0 + Math.PI / 16; rays += '<path d="M150 62 L' + (150 + Math.cos(a0) * 86).toFixed(1) + ' ' + (62 + Math.sin(a0) * 86).toFixed(1) + ' L' + (150 + Math.cos(a1) * 86).toFixed(1) + ' ' + (62 + Math.sin(a1) * 86).toFixed(1) + 'Z"/>'; }
  const CONF = [[22, 18, '#ff7aa8', 20], [60, 40, '#6ec0f2', -30], [250, 22, '#ffd23f', 40], [278, 60, '#7fd9b0', -20], [40, 92, '#ffd23f', 10], [266, 100, '#ff7aa8', -40], [100, 14, '#7fd9b0', 60], [210, 12, '#b79cff', -10], [18, 60, '#b79cff', 30], [286, 24, '#6ec0f2', 15]];
  const conf = CONF.map(q => '<rect x="' + q[0] + '" y="' + q[1] + '" width="6" height="3.4" rx="1" fill="' + q[2] + '" transform="rotate(' + q[3] + ' ' + q[0] + ' ' + q[1] + ')"/>').join('');
  /* garland: flags hang from a gentle curve and are rotated to follow it */
  const cols = ['#ff7aa8', '#ffd23f', '#6ec0f2', '#7fd9b0', '#b79cff'], y0 = 3, sag = 16, n = 11, cy = y0 + 2 * sag;
  let flags = '';
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, x = (1 - t) * (1 - t) * 4 + 2 * t * (1 - t) * 150 + t * t * 296, y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * cy + t * t * y0;
    const dx = 2 * (1 - t) * 146 + 2 * t * 146, dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y0 - cy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    flags += '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')"><path d="M-12 -1 H12 L0 22Z" fill="' + cols[k % 5] + '" stroke="' + MD_OL + '" stroke-width="2" stroke-linejoin="round"/></g>';
  }
  const tx = (x, y, sz, col, s) => '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + sz + '" font-weight="900" fill="' + col + '" font-family="' + SVG_FONT + '">' + s + '</text>';
  return '<svg viewBox="0 0 300 178">' + MD_GRAD + '<defs><radialGradient id="mdGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3a8"/><stop offset="1" stop-color="#fff3a8" stop-opacity="0"/></radialGradient></defs>'
    + '<g transform="translate(0 30)"><circle cx="150" cy="62" r="70" fill="url(#mdGlow)"/><g fill="#ffe27a55">' + rays + '</g>' + conf
    + '<svg x="100" y="2" width="100" height="107.6" viewBox="-4.5 -9 66 71" style="overflow:visible">' + medal + '</svg>'
    + tx(150, 128, 17, '#b02560', D.everyDone) + tx(150, 144, 10, '#8a6d5a', D.everySub) + '</g>'
    + '<path d="M4 ' + y0 + ' Q150 ' + cy + ' 296 ' + y0 + '" fill="none" stroke="' + MD_OL + '" stroke-width="2.4"/>' + flags + '</svg>';
}
function bottleSvg(col, lock) {
  const fill = lock ? '#c9d4da' : col === 'rainbow' ? 'url(#rbG)' : col;
  return '<svg viewBox="0 0 44 46"><defs><linearGradient id="rbG" x1="0" x2="1"><stop offset="0" stop-color="#ffc9c9"/><stop offset=".25" stop-color="#ffe3b0"/><stop offset=".5" stop-color="#fff6b0"/><stop offset=".75" stop-color="#b8e4ff"/><stop offset="1" stop-color="#d9c9ff"/></linearGradient></defs>'
    + '<rect x="16" y="2" width="12" height="7" rx="2" fill="' + (lock ? '#dfe8ec' : '#ff9ec1') + '" stroke="#4a3a30" stroke-width="2"/>'
    + '<path d="M17 9 h10 v4 q9 3 9 12 v12 q0 5 -5 5 h-18 q-5 0 -5 -5 v-12 q0 -9 9 -12z" fill="#fff" stroke="#4a3a30" stroke-width="2.2" stroke-linejoin="round"/>'
    + '<path d="M9 26 h26 v12 q0 5 -5 5 h-16 q-5 0 -5 -5z" fill="' + fill + '" stroke="#4a3a30" stroke-width="2.2" stroke-linejoin="round"/>'
    + (lock ? '<text x="22" y="38" text-anchor="middle" font-size="14" font-weight="900" fill="#6b8190" font-family="' + SVG_FONT + '">？</text>' : '') + '</svg>';
}

/* faded pictures (locked items, colours with no ducks yet): drawn opaque on a scratch canvas first and then laid down
   at once, so overlapping parts (head over body, cap over bottle) do not show through each other */
const fadeCv = document.createElement('canvas'), fadeCtx = fadeCv.getContext('2d');
function drawFaded(c, x, y, w, h, alpha, tint, fn) {
  const m = c.getTransform(), k = Math.max(1, Math.hypot(m.a, m.b)), pw = Math.ceil(w * k) + 2, ph = Math.ceil(h * k) + 2;
  if (fadeCv.width < pw) fadeCv.width = pw;
  if (fadeCv.height < ph) fadeCv.height = ph;
  const f = fadeCtx;
  f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1; f.clearRect(0, 0, fadeCv.width, fadeCv.height);
  f.setTransform(k, 0, 0, k, -x * k, -y * k);
  fn(f);
  if (tint) { f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-atop'; f.fillStyle = tint; f.fillRect(0, 0, pw, ph); f.globalCompositeOperation = 'source-over'; }
  c.save(); c.globalAlpha *= alpha; c.drawImage(fadeCv, 0, 0, pw, ph, x, y, pw / k, ph / k); c.restore();
}
const LOCK_TINT = 'rgba(214,222,227,0.75)';
/* duck pictures used by the menus (same art as the game, drawn straight onto the canvas) */
/* small dress-up pictures (picker tiles, おしゃれ tab) are drawn once into an offscreen canvas and then only stamped */
const thumbCache = new Map();
function cachedDraw(c, key, x, y, w, h, fn) {
  const m = c.getTransform(), ps = Math.ceil(Math.hypot(m.a, m.b) * 20) / 20, k = key + '|' + ps;
  let img = thumbCache.get(k);
  if (!img) {
    if (thumbCache.size >= 400) thumbCache.delete(thumbCache.keys().next().value);
    img = document.createElement('canvas'); img.width = Math.max(1, Math.ceil(w * ps)); img.height = Math.max(1, Math.ceil(h * ps));
    const sc = img.getContext('2d'); sc.setTransform(ps, 0, 0, ps, 0, 0); fn(sc);
    thumbCache.set(k, img);
  }
  c.drawImage(img, x, y, w, h);
}
function thumbDraw(c, g, x, y, w, withBadge, alpha) {
  if (typeof g.hat === 'string' && g.hat !== 'none' && !g.rare && !withBadge && alpha === undefined) {
    cachedDraw(c, 'td|' + g.c + '|' + g.p + '|' + g.hat + '|' + w, x, y, w, w * 114 / 120, sc => { sc.scale(w / 120, w / 120); drawDuck(sc, g, 60, 72, 0.74, false, 0, 1); });
    return;
  }
  c.save(); c.translate(x, y); c.scale(w / 120, w / 120);
  drawDuck(c, g, 60, 72, 0.74, false, 0, alpha === undefined ? 1 : alpha);
  if (withBadge && g.c > 0) { if (alpha !== undefined) c.globalAlpha = alpha; drawBadge(c, g.c, 60, 17, 21); }
  c.restore();
}
function badgeDuckDraw(c, col, x, y, w) {
  c.save(); c.translate(x, y); c.scale(w / 120, w / 120);
  drawDuck(c, { c: col, p: 0, rare: null, hat: 'none' }, 60, 88, 0.82, false, 0, 1);
  if (col > 0) drawBadge(c, col, 60, 20, 15);
  c.restore();
}
/* the prize icon: a bottle, or a duck's head wearing the dress-up, so it reads at a glance */
function iconDraw(c, it, cx, cy, size) {
  if (it.type === 'salt') { drawSvg(c, bottleSvg(it.col, false), cx - size * 0.31, cy - size * 0.33, size * 0.62, size * 0.65); return; }
  const w = size * 0.94;
  c.save(); c.beginPath(); c.arc(cx, cy, size / 2 - 2, 0, TAU); c.clip();
  c.translate(cx - w / 2, cy - w / 2); c.scale(w / 120, w / 120);
  drawDuck(c, { c: 4, p: 0, rare: null, hat: it.id }, 18, 96, 1.7, false, 0, 1);
  c.restore();
}

/* =====================================================================
   celebration: a solid bubble card with a medal icon; it pops, the medal flies to the menu and prizes ride bubbles into the bottom buttons
   ===================================================================== */
let celeb = null, collectT = 0, pendItems = [];
const clamp01 = x => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const eIn = x => x * x * x, eIO = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
function mkEl(kind, w, h, data) { return Object.assign({ kind, w, h, x: -999, y: -999, s: 1, r: 0, o: 0, sx: 1, sy: 1, mr: 0, ms: 1 }, data || {}); }
function place(el, x, y, s, r, o) { el.x = x; el.y = y; el.s = s === undefined ? 1 : s; el.r = r || 0; el.o = o === undefined ? 1 : o; }
const hideEl = el => { el.o = 0; };
/* button centres in stage coordinates (the menu button sits above the stage, so its y is negative) */
const stageCtr = r => ({ x: r.x + r.w / 2 - STG.x, y: r.y + r.h / 2 - STG.y });
const BTN = { salt: () => stageCtr(gbtnRect('salt')), hat: () => stageCtr(gbtnRect('hat')), menu: () => stageCtr(menuRect()) };
function flyPath(p0, p1, bend, u) {
  const mx = (p0.x + p1.x) / 2 + bend, my = (p0.y + p1.y) / 2 - 50, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  return { x: a * p0.x + b * mx + c * p1.x, y: a * p0.y + b * my + c * p1.y };
}
function arrive(it) {
  qNew[it.type] = true; updateQBtns();
  startAnim('boing_' + it.type, 0.45);
  const p = BTN[it.type](); stars(p.x, p.y, 9, ['#ffd23f', '#ffffff', '#ff9ec1']);
  tone('sine', 988, 1480, 0.12, 0.1);
}
function startCeleb(list, items) {
  const hasMedal = list.length > 0, n = items.length, extra = hasMedal ? list.length - 1 : n - 1;
  const msg = hasMedal ? list[0].m : L().unlMsg(itemName(items[0]));
  const bw = W - 56, bh = 78, cx = W / 2, cy = 8 + bh / 2;
  const c = { t: 0, dur: 2, items, popped: false, menuDone: false, popT: n ? 1.4 : 1.5 };
  celeb = c; achCur = 'x'; sfxAch(); refreshNotice();
  cheer();
  if (n) updateQBtns();
  let fs = 15;
  setFont(ctx, fs, 900);
  const widest = s => Math.max(...s.split('\n').map(l => tw(ctx, l)));
  while (widest(msg) > 180 && fs > 10) { fs -= .5; setFont(ctx, fs, 900); }
  const bub = mkEl('bub', bw, bh, { msg, fs, extra, icon: hasMedal ? null : items[0] });
  const medal = hasMedal ? mkEl('medal', 40, 40) : null, mx0 = cx - bw / 2 + 54;
  const its = items.map((it, k) => ({ it, k, ts: c.popT + 0.1 * k, done: false, ico: mkEl('pbub', 58, 58, { it }) }));
  c.els = [bub].concat(medal ? [medal] : [], its.map(s => s.ico));
  c.its = its;
  c.dur = Math.max(c.popT + (hasMedal ? .65 : .25), n ? c.popT + 0.1 * (n - 1) + 1.25 : 0);
  petals(cx - bw * 0.38, cy + 4, 12, true); petals(cx + bw * 0.38, cy + 4, 12, true); petals(cx, cy + 10, 6, true);
  c.upd = t => {
    if (t < c.popT) {
      const g = easeOutBack(seg(t, 0, .5)), j = reduce ? 0 : .04 * Math.sin(t * 11) * (1 - seg(t, .5, 1.1)), an = 1 + .1 * seg(t, c.popT - .15, c.popT);
      place(bub, cx, cy + (reduce ? 0 : Math.sin(t * 4) * 2), g * an, 0, 1); bub.sx = 1 + j; bub.sy = 1 - j;
      if (!reduce) { bub.mr = Math.sin(t * 7) * .12 * (1 - seg(t, .6, 1.2)); bub.ms = 1 + .06 * Math.sin(t * 9); }
    } else if (!c.popped) { c.popped = true; hideEl(bub); ring(cx, cy); stars(cx, cy, 18, ['#ffffff', '#bfe9f5', '#ffd23f', '#ff9ec1']); tone('sine', 700, 1200, .08, .1); }
    if (medal && t >= c.popT) {
      const u = t - c.popT;
      if (u < .55) { const f = eIn(seg(u, .08, .55)), p = flyPath({ x: mx0, y: cy }, BTN.menu(), 20, f); place(medal, p.x, p.y, lerp(1.25, .5, f), f * 1.2, 1); }
      else if (!c.menuDone) { c.menuDone = true; hideEl(medal); startAnim('boing_menu', 0.45); const p = BTN.menu(); stars(p.x, p.y, 8, ['#ffd23f', '#ffffff']); tone('sine', 880, 1320, .1, .09); }
    }
    for (const s of its) {
      const u = t - s.ts; if (u < 0) continue;
      const x0 = cx + (s.k - (n - 1) / 2) * 64 + (hasMedal ? 24 : 0), y0 = cy + 6;
      if (u < .22) place(s.ico, x0, y0, easeOutBack(u / .22), 0, 1);
      else if (u < 1.1) { const f = eIO(seg(u, .22, 1.1)), p = flyPath({ x: x0, y: y0 }, BTN[s.it.type](), (s.k % 2 ? -1 : 1) * 36, f); place(s.ico, p.x, p.y, lerp(1, .55, f), 0, 1); }
      else if (!s.done) { s.done = true; hideEl(s.ico); arrive(s.it); }
    }
  };
  c.upd(0);
}
/* force = the menu was opened mid-celebration: drop the visuals but still mark the prizes as new */
function endCeleb(force) {
  if (force && celeb) { for (const s of celeb.its) if (!s.done) qNew[s.it.type] = true; updateQBtns(); }
  celeb = null; achCur = null; refreshNotice();
}
function pushItem(it) { pendItems.push(it); }
/* normal achievements and prizes found in the same moment become ONE celebration; the all-medals finale keeps its big banner */
function tickAch(dt) {
  if (state !== 'play') { if (celeb) endCeleb(true); pendItems = []; return tickAchOrig(dt); }
  if (celeb) { celeb.t += dt; celeb.upd(celeb.t); if (celeb.t >= celeb.dur) endCeleb(); return; }
  if (achCur) return tickAchOrig(dt);
  const normal = achQueue.filter(x => !x.big);
  if (cur) { collectT = 0; return; }   /* the drum is turning: achievements wait their turn */
  if ((normal.length || pendItems.length) && cardWait <= 0) {
    collectT += dt; if (collectT < 0.15) return;
    collectT = 0; achQueue = achQueue.filter(x => x.big); startCeleb(normal, pendItems.splice(0));
  } else { collectT = 0; if (achQueue.length && cardWait <= 0) tickAchOrig(dt); }
}
function drawCeleb(c) {
  if (!celeb) return;
  for (const el of celeb.els) {
    if (el.o <= 0.001) continue;
    c.save(); c.globalAlpha = el.o; c.translate(el.x, el.y); c.rotate(el.r); c.scale(el.s * el.sx, el.s * el.sy);
    const w = el.w, h = el.h;
    if (el.kind === 'bub') {
      c.fillStyle = 'rgba(74,58,48,.2)'; c.beginPath(); c.ellipse(0, 4, w / 2, h / 2, 0, 0, TAU); c.fill();
      const g = c.createRadialGradient(-w * 0.2, -h * 0.25, 0, 0, 0, w / 2);
      g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#f6fcff'); g.addColorStop(1, '#dff3fb');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, w / 2 - 1.5, h / 2 - 1.5, 0, 0, TAU); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
      c.save(); c.translate(-w / 2 + w * 0.2, -h / 2 + h * 0.18); c.rotate(-0.52); c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(0, 0, w * 0.09, h * 0.06, 0, 0, TAU); c.fill(); c.restore();
      /* icon on the left (medal, or the prize itself) */
      c.save(); c.translate(-w / 2 + 54, 0); c.rotate(el.mr); c.scale(el.ms, el.ms);
      if (el.icon) iconDraw(c, el.icon, 0, 0, 40); else drawSvg(c, medalSvg2(), -20, -20, 40, 40);
      c.restore();
      setFont(c, el.fs, 900);
      const lines = el.msg.split('\n'), tw0 = Math.max(...lines.map(l => tw(c, l))), lh = el.fs * 1.35;
      const tx = -(46 + tw0) / 2 + 46 + tw0 / 2;
      lines.forEach((ln, i) => txt(c, ln, tx, (i - (lines.length - 1) / 2) * lh, { size: el.fs, color: INK, align: 'center' }));
      if (el.extra > 0) {
        setFont(c, 11, 900); const s = '+' + el.extra, cw = tw(c, s) + 14, cx = Math.min(w / 2 - 14 - cw / 2, tx + tw0 / 2 + 6 + cw / 2);
        box(c, cx - cw / 2, -10, cw, 19, 9.5, { fill: '#ff7aa8', lw: 2 }); txt(c, s, cx, -0.5, { size: 11, color: '#fff', align: 'center' });
      }
    } else if (el.kind === 'medal') {
      drawSvg(c, medalSvg2(), -w / 2, -h / 2, w, h);
    } else {
      c.fillStyle = 'rgba(74,58,48,.25)'; c.beginPath(); c.arc(0, 3, w / 2, 0, TAU); c.fill();
      const g = c.createRadialGradient(-w * 0.16, -w * 0.22, 0, 0, 0, w / 2);
      g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#f4fbff'); g.addColorStop(1, '#d9f0fb');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, w / 2 - 1.5, 0, TAU); c.fill();
      iconDraw(c, el.it, 0, 0, w);
      c.lineWidth = 3; c.strokeStyle = OUT; c.beginPath(); c.arc(0, 0, w / 2 - 1.5, 0, TAU); c.stroke();
      c.save(); c.translate(-w * 0.23, -w * 0.32); c.rotate(-0.52); c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(0, 0, w * 0.12, w * 0.065, 0, 0, TAU); c.fill(); c.restore();
    }
    c.restore();
  }
}

/* =====================================================================
   game input (on the stage)
   ===================================================================== */
function overTarget(p, start) {
  const dr = geo.home;
  if (houseK() > 0.5 && canLink(start, 'home') && Math.hypot(p.x - dr.x, p.y - dr.y) < geo.r * 1.5 * houseScale()) return 'home';
  let o = null, bd = geo.r * 1.3;
  for (const d of ducks) {
    if (d === start || !canLink(start, d)) continue;
    const dd = Math.hypot(d.x - p.x, d.y - p.y);
    if (dd < bd) { bd = dd; o = d; }
  }
  return o;
}
const toStage = p => ({ x: p.x - STG.x, y: p.y - STG.y });
function gameDown(dp, e) {
  if (state !== 'play' || paused || drag) return;
  const p = toStage(dp);
  let pick = null, bd = Math.max(geo.r * 1.2, 30 / S);
  for (const d of ducks) {
    const dd = Math.hypot(d.x - p.x, d.y - p.y);
    if (dd < bd) { bd = dd; pick = d; }
  }
  if (!pick) { const h = geo.home; if (h && !guide && Math.hypot(p.x - h.x, p.y - h.y) < geo.r * 1.5 * houseScale()) qOpen('hat'); return; }
  if (pick.rare) { catchRare(pick); return; }
  drag = { duck: pick, pts: [], cur: p, over: null, id: e.pointerId };
}
function gameMove(dp, e) {
  if (!drag || e.pointerId !== drag.id) return;
  const p = toStage(dp);
  drag.cur = p;
  const a = drag.pts.length ? drag.pts[drag.pts.length - 1] : { x: drag.duck.x, y: drag.duck.y };
  if (Math.hypot(p.x - a.x, p.y - a.y) >= 6) { drag.pts.push(p); if (drag.pts.length > 80) drag.pts.shift(); }
  drag.over = overTarget(p, drag.duck);
  chainPick(p);
  if (drag.over && drag.over !== 'home') { drag.last = drag.over; drag.lastT = clock; }
}
function gameUp(dp, e, cancel) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (state !== 'play') return;
  let o = cancel ? d.over : overTarget(toStage(dp), d.duck);
  /* a finger often drifts as it lifts: fall back to the duck it was on a moment ago */
  if (!o && d.last && clock - d.lastT < 0.3 && ducks.includes(d.last)) o = d.last;
  if (!ducks.includes(d.duck)) return;
  if (!o && guide && d.pts.length >= 3) guide.idle = Math.max(guide.idle || 0, IDLE_HINT);   /* let go on nothing during the lesson: show the move at once */
  if (!o && d.pts.length < 3) { tapDuck(d.duck); updateGauge(); return; }
  if (o === 'home') { if (d.chain && d.chain.size) napMany([d.duck].concat(Array.from(d.chain))); else goHome(d.duck); }
  else if (o && ducks.includes(o)) cross(d.duck, o);
  updateGauge();
}

/* ---- pointer routing: every press goes to the topmost hit region ---- */
function pos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - OX) / S, y: (e.clientY - r.top - OY) / S }; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (press) return;
  const p = pos(e), h = topHit(p);
  if (!h) return;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  press = { h, id: e.pointerId, x0: p.x, y0: p.y, s0: menuScroll, moved: false, over: true, trail: [{ t: performance.now(), y: p.y }] };
  /* a touch while the list is still gliding just stops it (and is not a tap) */
  if (h.scroller && Math.abs(menuVel) > 40) press.moved = true;
  if (h.scroller) menuVel = 0;
  if (h.down) h.down(p, e);
});
cv.addEventListener('pointermove', e => {
  if (!press || e.pointerId !== press.id) return;
  const p = pos(e), h = press.h;
  if (h.move) h.move(p, e);
  press.over = inside(h, p);
  if (h.scroller) {
    const dy = p.y - press.y0;
    if (!press.moved && Math.abs(dy) > 8) press.moved = true;
    if (press.moved) { menuScrollTo = null; menuScroll = clamp(press.s0 - dy, 0, menuMax); }
    const now = performance.now();
    press.trail.push({ t: now, y: p.y });
    while (press.trail.length > 2 && now - press.trail[0].t > 100) press.trail.shift();
  } else if (!press.moved && Math.hypot(p.x - press.x0, p.y - press.y0) > 14 && !h.move) press.moved = true;
});
function endPress(e, cancel) {
  if (!press || e.pointerId !== press.id) return;
  const pr = press, p = pos(e), h = pr.h;
  press = null;
  if (h.scroller && pr.moved && !cancel) {
    /* fling: keep the finger's speed over the last ~0.1 s and let it glide */
    const tr = pr.trail, a = tr[0], b = tr[tr.length - 1], now = performance.now();
    if (tr.length > 1 && now - b.t < 80 && b.t > a.t) menuVel = clamp(-(b.y - a.y) / (b.t - a.t) * 1000, -4500, 4500);
  }
  if (h.up) { h.up(p, e, cancel); return; }
  if (!cancel && !pr.moved && inside(h, p) && h.fn) h.fn(p);
}
cv.addEventListener('pointerup', e => endPress(e, false));
cv.addEventListener('pointercancel', e => endPress(e, true));
cv.addEventListener('wheel', e => { if ((zOpen && !zDetail) || qKind) { e.preventDefault(); menuScrollTo = null; menuVel = 0; menuScroll = clamp(menuScroll + e.deltaY, 0, menuMax); } }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());

/* =====================================================================
   HUD (order card, stamps, sound, menu)
   ===================================================================== */
const TGT = { x: 12, y: 15, w: 72, h: 56 };
const SND = { x: 308, y: 10, w: 34, h: 34 };
function menuRect() {
  setFont(ctx, 14, 900);
  const w = 3 + 8 + 30 + 6 + tw(ctx, L().menu) + 12 + 3;
  return { x: 348 - w, y: 34, w, h: 44 };
}
let dotOn = false;
function updateDot() { dotOn = unlockedKeys().some(k => !unlSeen.has(k)); }
function drawHud(c) {
  /* order card with the target duck */
  const bp = bounceT > 0 && !reduce ? 1 - bounceT / 0.5 : 1, bs = bp < 0.4 ? 1 + 0.12 * (bp / 0.4) : 1 + 0.12 * (1 - (bp - 0.4) / 0.6);
  c.save(); c.translate(TGT.x + TGT.w / 2, TGT.y + TGT.h / 2); c.scale(bs, bs); c.translate(-TGT.w / 2, -TGT.h / 2);
  box(c, 0, 0, TGT.w, TGT.h, 16, { fill: CARD, lw: 3 });
  if (shownTarget) {
    c.save(); c.translate(3, 3); c.scale(66 / 72, 50 / 56);
    drawDuck(c, Object.assign({ hat: 'none' }, shownTarget), 36, 38, 0.4, false, 0, 1);
    if (shownTarget.c > 0) drawBadge(c, shownTarget.c, 36, 9, 8);
    c.restore();
  }
  c.restore();
  /* hanamaru stamp lands on the card */
  if (stampT > 0) {
    const u = reduce ? 1 : clamp((1.3 - stampT) / 0.45, 0, 1), e = easeOutBack(u);
    c.save(); c.translate(64 + 17, 3 + 17); c.rotate((-25 + 17 * e) * Math.PI / 180); const k = 2.4 - 1.4 * e; c.scale(k, k); c.globalAlpha = u;
    drawSvg(c, SVG_STAMP_THIN, -17, -17, 34, 34); c.restore();
  }
  /* order name */
  const mr = menuRect();
  setFont(c, 14, 900);
  const sw = Math.max(60, tw(c, L().score), tw(c, String(stats.hana)) * 2);
  const statCx = mr.x - 10 - sw / 2;
  const nameX = TGT.x + TGT.w + 8, nameMax = statCx - sw / 2 - 8 - nameX;
  const nm = shownTarget ? gname(shownTarget.c, shownTarget.p).replace('縞水玉', '縞\n水玉') : '—';
  const lines = nm.split('\n'), lh = 18 * 1.15, bh = 17 + lines.length * lh, by = 43 - bh / 2;
  txt(c, L().order, nameX, by + 8.5, { size: 13, weight: 700, color: INK_SOFT });
  lines.forEach((ln, i) => txt(c, ln, nameX, by + 17 + lh * (i + 0.5), { size: 18, color: INK, maxW: nameMax }));
  /* stamp count */
  txt(c, L().score, statCx, 30, { size: 13, weight: 700, color: INK_SOFT, align: 'center', maxW: sw + 10 });
  txt(c, String(stats.hana), statCx, 54, { size: 28, color: INK, align: 'center' });
  /* sound toggle */
  const sd = isDown('snd') ? 1 : 0;
  c.save(); c.translate(0, sd);
  c.fillStyle = SHADOW; c.beginPath(); c.arc(SND.x + 17, SND.y + 19, 17, 0, TAU); c.fill();
  c.fillStyle = soundOn ? '#ffe27a' : '#fff'; c.beginPath(); c.arc(SND.x + 17, SND.y + 17, 15.5, 0, TAU); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
  drawSvg(c, soundOn ? SVG_SPK_ON : SVG_SPK_OFF, SND.x + 6, SND.y + 6, 22, 22);
  c.restore();
  hit(SND.x - 4, SND.y - 4, SND.w + 8, SND.h + 8, () => setSound(!soundOn), { key: 'snd' });
  /* menu button */
  c.save(); if (guide) c.globalAlpha = 0.35;
  const md = isDown('menu') ? 2 : 0, bk = boingScale('boing_menu');
  c.save(); c.translate(mr.x + mr.w / 2, mr.y + mr.h / 2); c.scale(bk, bk); c.translate(-mr.w / 2, -mr.h / 2 + md);
  box(c, 0, 0, mr.w, mr.h, 22, { fill: CARD, lw: 3, shadow: OUT, sy: 3 - md });
  drawSvg(c, SVG_MENU, 11, (mr.h - 26) / 2, 30, 26);
  txt(c, L().menu, 47, mr.h / 2 + 0.5, { size: 14, color: INK });
  if (dotOn) { c.fillStyle = DANGER; c.beginPath(); c.arc(mr.w - 4, 4, 8, 0, TAU); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke(); }
  c.restore();
  c.restore();
  if (!guide) hit(mr.x, mr.y, mr.w, mr.h, () => { if (zOpen) closeZukan(); else openZukan(); }, { key: 'menu' });
}

/* =====================================================================
   water gauge + quick pickers (bath salts / dress-up)
   ===================================================================== */
const GAUGE = { x: STG.x + 6, y: STG.y + STG.h - 6 - 28, right: STG.x + STG.w - 96, h: 28 };
let qVis = { salt: false, hat: false };
function updateQBtns() {
  for (const kind of ['salt', 'hat']) {
    const has = ITEMS.some(x => x.type === kind && !x.free && itemOpen(x));
    const vis = state === 'play' && has;
    if (vis && !qShown[kind]) { qShown[kind] = true; startAnim('pop_' + kind, 0.5); }
    qVis[kind] = vis;
  }
}
function barW() { let w = GAUGE.right - GAUGE.x; for (const k of ['salt', 'hat']) if (qVis[k]) w -= 31 + 6; return w; }
function gbtnRect(kind) {
  let x = GAUGE.x + barW() + 6;
  if (kind === 'hat' && qVis.salt) x += 37;
  return { x, y: GAUGE.y + (GAUGE.h - 31) / 2, w: 31, h: 31 };
}
function drawGauge(c) {
  c.save(); if (guide) c.globalAlpha = 0.35;
  const bw = barW(), x = GAUGE.x, y = GAUGE.y, h = GAUGE.h;
  box(c, x, y, bw, h, h / 2, { fill: '#fff' });
  c.save(); rr(c, x, y, bw, h, h / 2); c.clip();
  c.fillStyle = gaugeLevel === 'danger' ? DANGER : gaugeLevel === 'warn' ? '#e8a22c' : '#3aa6d8';
  c.fillRect(x, y, bw * gaugeShown, h);
  c.restore();
  box(c, x, y, bw, h, h / 2, { lw: 3 });
  txt(c, L().water, x + 12, y + h / 2 + 0.5, { size: 12, glow: '#fff', glowW: 4 });
  setFont(c, 12, 900);
  const tagW = tw(c, gaugeTag);
  txt(c, gaugeTag, x + bw - 12, y + h / 2 + 0.5, { size: 12, align: 'right', color: gaugeLevel === 'danger' ? DANGER : INK, glow: '#fff', glowW: 4 });
  txt(c, gaugeCountTxt, x + bw - 12 - tagW - 4, y + h / 2 + 0.5, { size: 12, align: 'right', glow: '#fff', glowW: 4 });
  if (!guide) hit(x, y - 4, bw, h + 8, () => qOpen('salt'), { key: 'bar' });
  for (const kind of ['salt', 'hat']) {
    if (!qVis[kind]) continue;
    const r = gbtnRect(kind), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    let k = 1;
    if (anim['pop_' + kind] && animP('pop_' + kind) < 1 && !reduce) k = easeOutBack(animP('pop_' + kind));
    const pulse = qNew[kind];
    if (pulse && !reduce) k *= 1 + 0.18 * (0.5 - 0.5 * Math.cos(uiClock * TAU));
    k *= boingScale('boing_' + kind);
    c.save(); c.translate(cx, cy); c.scale(k, k);
    if (pulse) { c.fillStyle = '#ffc2cd'; c.beginPath(); c.arc(0, 0, 19.5, 0, TAU); c.fill(); }
    c.fillStyle = SHADOW; c.beginPath(); c.arc(0, 2, 15.5, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill(); c.lineWidth = 3; c.strokeStyle = pulse ? DANGER : OUT; c.stroke();
    if (kind === 'salt') drawSvg(c, bottleSvg('#8fd8ff', false), -10, -11, 20, 22); else drawSvg(c, SVG_HATBTN, -10, -11, 20, 22);
    if (pulse) { c.fillStyle = DANGER; c.beginPath(); c.arc(11, -11, 5.5, 0, TAU); c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); }
    c.restore();
    if (!guide) hit(r.x - 3, r.y - 6, r.w + 6, r.h + 12, () => qOpen(kind), { key: 'g_' + kind });
  }
  c.restore();
}

let qKind = null, qAt = 0;
function qClose() { qKind = null; }
function qOpen(kind) {
  if (state !== 'play' || zOpen) return;
  if (qKind === kind) { qClose(); return; }
  qNew[kind] = false; updateQBtns();
  qKind = kind; qAt = performance.now(); menuScroll = 0; menuVel = 0; menuScrollTo = null;
  unlSeen = new Set(unlockedKeys()); lsSet(K_UNLSEEN, Array.from(unlSeen)); updateDot();
}
/* ---- "next one" hint inside the picker (what to do next; the item stays a secret) ---- */
function hintCand(kind) {
  const lk = ITEMS.filter(x => x.type === kind && !x.free && !x.secret && !x.gift && !itemOpen(x));
  if (!lk.length) return null;
  /* closest by ratio (current / needed) wins for everything, since players progress differently */
  lk.sort((a, b) => PROG[b.need[0]]() / b.need[1] - PROG[a.need[0]]() / a.need[1]);
  return lk[0];
}
function drawItemTag(c, label, x, y, kind) {
  setFont(c, 10, 900);
  const w = tw(c, label) + 16, h = 17;
  c.save(); c.translate(x, y);
  if (kind === 'nw') c.rotate(8 * Math.PI / 180);
  box(c, -w / 2, -h / 2, w, h, h / 2, { fill: kind === 'nw' ? '#ffb020' : DANGER, lw: 2 });
  txt(c, label, 0, 0.5, { size: 10, color: kind === 'nw' ? OUT : '#fff', align: 'center' });
  c.restore();
}
/* ---- dress-up picker: the parts on the left, the items of the chosen part on the right; one item per part ---- */
let qSlot = 'head';
/* each part is shown zoomed in on the spot where it is worn: [duck x, duck y, zoom] */
const SLOT_FOCUS = { head: [20, -26, 1.9], top: [20, -37, 1.6], eyes: [24, -18, 2.3], mouth: [28, -6, 2.2], neck: [16, 0, 1.7], back: [-20, -6, 1.5], waist: [-4, 16, 1.35] };
function thumbSlot(c, g, x, y, w, h, slot) {
  const f = SLOT_FOCUS[slot] || [0, 0, 1], k = (54 / 120) * f[2];
  cachedDraw(c, 'ts|' + slot + '|' + g.c + '|' + g.p + '|' + g.hat + '|' + w + '|' + h, x, y, w, h, sc => {
    sc.save();
    rr(sc, 0, 0, w, h, 10); sc.fillStyle = '#e6f5fb'; sc.fill(); sc.clip();
    sc.translate(w / 2, h / 2); sc.scale(k, k); sc.translate(-(60 + f[0] * 0.74), -(72 + f[1] * 0.74));
    drawDuck(sc, g, 60, 72, 0.74, false, 0, 1);
    sc.restore();
  });
}
function hatSlotItems(slot) { const o = DRESS_ADOPT[slot] || []; return ITEMS.filter(x => x.type === 'hat' && x.id !== 'none' && HAT_SLOT[x.id] === slot && o.includes(x.id) && itemOpen(x)).sort((a, b) => o.indexOf(a.id) - o.indexOf(b.id)); }
/* achievement items that are not open yet are shown as ? tiles (omiyage items stay hidden until they arrive) */
function hatSlotLocked(slot) { const o = DRESS_ADOPT[slot] || []; return o.map(id => ITEMS.find(x => x.k === 'h:' + id)).filter(it => it && !it.gift && !it.free && !itemOpen(it)); }
/* "ずかん" block of the おしゃれ tab: per part how many are owned, the conditions of the missing おまけ, and a hint about souvenirs */
function bookLayout() {
  const rows = []; let off = 0;
  rows.push({ t: 'note', y: off, h: 58 }); off += 58 + 10;
  DRESS_SLOTS.forEach(([id, label]) => {
    const tot = (DRESS_ADOPT[id] || []).length; if (!tot) return;
    const rest = hatSlotRest(id);
    rows.push({ t: 'head', y: off, h: 22, label, own: tot - rest.locks.length - rest.gifts, tot }); off += 22;
    rest.locks.forEach(it => { rows.push({ t: 'cond', y: off, h: 20, it }); off += 20; });
    if (rest.gifts) { rows.push({ t: 'rest', y: off, h: 20, n: rest.gifts }); off += 20; }
    off += 8;
  });
  return { rows, h: off - 8 };
}
function drawBook(c, bl, x, y, w) {
  const D = L();
  bl.rows.forEach(r => {
    const ry = y + r.y;
    if (r.t === 'note') {
      box(c, x, ry, w, r.h, 12, { fill: '#fff6dc', lw: 2, stroke: '#e0b050', dash: [5, 4] });
      txt(c, giftPool().length ? D.giftNote1 : D.giftDone, x + w / 2, ry + 14, { size: 11, align: 'center', maxW: w - 12, color: '#8a6420' });
      txt(c, D.giftProg(gotSet.size, DRESS_GIFT.length), x + w / 2, ry + 30, { size: 11, align: 'center', maxW: w - 12, color: '#b02560' });
      txt(c, D.giftNote2, x + w / 2, ry + 46, { size: 10, align: 'center', maxW: w - 12, color: '#8a6420', weight: 700 });
    } else if (r.t === 'head') {
      txt(c, r.label, x + 2, ry + 11, { size: 12, color: '#b02560' });
      setFont(c, 12, 900); const l0 = tw(c, r.label);
      txt(c, r.own + ' / ' + r.tot, x + 2 + l0 + 6, ry + 12, { size: 10, weight: 700, color: INK_SOFT });
    } else if (r.t === 'cond') {
      const it = r.it, need = it.secret ? 'ひみつ' : D.cat[it.need[0]] + ' ' + it.need[1] + D.unit[it.need[0]];
      txt(c, '？ ' + need, x + 10, ry + 10, { size: 11, weight: 700, color: '#6b8190', maxW: w - 14 });
    } else {
      txt(c, D.restGift(r.n), x + 10, ry + 10, { size: 10, weight: 700, color: '#6b8190', maxW: w - 14 });
    }
  });
}
/* what is still missing in a part: achievement items (with their condition) and how many come from souvenirs */
function hatSlotRest(slot) { const its = (DRESS_ADOPT[slot] || []).map(id => ITEMS.find(x => x.k === 'h:' + id)).filter(it => it && !itemOpen(it)); return { locks: its.filter(it => !it.gift && !it.free), gifts: its.filter(it => it.gift).length }; }
function drawQuickHat(c) {
  const D = L();
  const slots = DRESS_SLOTS.map(sl => ({ id: sl[0], label: sl[1], items: hatSlotItems(sl[0]) })).filter(sl => sl.items.length);
  const zk = !slots.length;   /* nothing owned yet: no tabs, just a note */
  const px = STG.x + 6, pw = STG.w - 12, inX = px + 12, inW = pw - 24;
  const TABW = 68, SP = 6, SB = 9, gx = inX + TABW + SP, gw = inW - TABW - SP - SB;
  const lstX = zk ? inX : gx, lstW = zk ? inW - SB : gw;
  const cols = 3, gap = 5, cw = (gw - gap * (cols - 1)) / cols, ih = 64, tabGap = 3, HDR = 26;
  /* the list shows about 3 rows; everything scrolls in one long list so the real duck stays visible above the panel */
  const vpH = 3 * ih + 2 * gap + 10, PADT = 5;
  const tabH = slots.length ? Math.min(34, (vpH - (slots.length - 1) * tabGap) / slots.length) : 34;
  const hint = null, hintH = 0, hintTop = 0;
  let off = PADT, noteTop = 0, contentH = vpH;
  if (!zk) {
    slots.forEach(sl => { sl.top = off; sl.rows = Math.ceil(sl.items.length / cols); sl.h = HDR + sl.rows * ih + (sl.rows - 1) * gap + 8; off += sl.h; });
    noteTop = off; off += 30 + 8;
    contentH = Math.max(off, slots[slots.length - 1].top + vpH);   /* room enough for every part to reach the top */
  }
  menuMax = Math.max(0, contentH - vpH);
  if (menuScrollTo !== null) { menuScroll += (menuScrollTo - menuScroll) * 0.25; if (Math.abs(menuScrollTo - menuScroll) < 0.5) { menuScroll = menuScrollTo; menuScrollTo = null; } }
  menuScroll = clamp(menuScroll, 0, menuMax);
  /* the highlighted tab follows what is scrolled into view */
  if (!zk && menuScrollTo === null) { let cur0 = slots[0]; for (const sl of slots) if (sl.top - 4 <= menuScroll + 10) cur0 = sl; qSlot = cur0.id; }
  const ph = 4 + 8 + 28 + 6 + vpH + 10 + 4;
  const py = STG.y + STG.h - 46 - ph;
  box(c, px, py, pw, ph, 22, { fill: CARD, lw: 4, shadow: SHADOW, sy: 5 });
  hit(px, py, pw, ph, null, { key: 'qpop' });
  /* header: title, take everything off, close */
  let y = py + 4 + 8;
  setFont(c, 13, 900);
  const xw = tw(c, D.closeX) + 20 + 5, xx = px + pw - 4 - 8 - xw;
  box(c, xx, y, xw, 28, 14, { fill: '#ffd23f', lw: 2.5, shadow: OUT, sy: 2 });
  txt(c, D.closeX, xx + xw / 2, y + 14.5, { size: 13, align: 'center' });
  hit(xx, y - 4, xw, 36, qClose, { key: 'qx' });
  const rmOff = !style.hats.length;
  setFont(c, 11, 900);
  const rw = tw(c, D.hatClear) + 24, rx = xx - 6 - rw;
  c.save(); if (rmOff) c.globalAlpha = 0.45;
  box(c, rx, y, rw, 28, 14, { fill: '#fff', lw: 2, shadow: rmOff ? null : SHADOW, sy: 2 });
  txt(c, D.hatClear, rx + rw / 2, y + 14.5, { size: 11, align: 'center' });
  c.restore();
  if (!rmOff) hit(rx, y - 4, rw, 36, () => { style.hats = []; lsSet(K_STYLE, style); }, { key: 'qrm' });
  txt(c, D.secHat, px + 14, y + 14, { size: 14, maxW: rx - (px + 14) - 6 });
  y += 28 + 6;
  /* left column: tabs jump to a part (and follow the scroll) */
  if (!zk) slots.forEach((sl, i) => {
    const ty = y + i * (tabH + tabGap), sel = sl.id === qSlot;
    const worn = style.hats.some(h => HAT_SLOT[h] === sl.id), fresh = !sel && sl.items.some(it => isNewItem(it));
    box(c, inX, ty, TABW, tabH, 11, { fill: sel ? '#ffd23f' : '#fff', lw: sel ? 3 : 2, stroke: sel ? OUT : '#9fb4c0', shadow: sel ? OUT : null, sy: 2 });
    txt(c, sl.label, inX + TABW / 2 - (worn ? 4 : 0), ty + tabH / 2 + 0.5, { size: 11, align: 'center', maxW: TABW - (worn ? 24 : 14), color: sel ? OUT : INK });
    if (worn) { c.fillStyle = DANGER; c.beginPath(); c.arc(inX + TABW - 10, ty + tabH / 2, 4.2, 0, TAU); c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#fff'; c.stroke(); }
    if (fresh) { c.fillStyle = '#ffb020'; c.beginPath(); c.arc(inX + 6, ty + 6, 4.5, 0, TAU); c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke(); }
    hit(inX, ty - 1, TABW, tabH + 2, () => { menuVel = 0; qSlot = sl.id; menuScrollTo = clamp(sl.top - 4, 0, menuMax); }, { key: 'qt_' + sl.id });
  });
  /* right: one long scrolling list, a block per part */
  const vy0 = y, vx0 = lstX - 4, vw0 = lstW + 8;
  c.save(); c.beginPath(); c.rect(vx0, vy0, vw0, vpH); c.clip();
  hit(vx0, vy0, vw0, vpH, null, { key: 'qlist', scroller: true });
  const hitC = (x, yy, w, h, fn, key) => { const t = Math.max(yy, vy0), bt = Math.min(yy + h, vy0 + vpH); if (bt - t > 4) hit(x, t, w, bt - t, fn, { key, scroller: true }); };
  const oy = y - menuScroll;
  (zk ? [] : slots).forEach(sl => {
    const by = oy + sl.top;
    if (by + sl.h < vy0 - 8 || by > vy0 + vpH + 8) return;
    const wornId = style.hats.find(h => HAT_SLOT[h] === sl.id);
    /* part header: name, how many, and "take this one off" */
    txt(c, sl.label, gx + 2, by + 11, { size: 12, color: '#b02560' });
    if (wornId) {
      setFont(c, 10, 900); const bw = tw(c, 'はずす') + 18;
      box(c, gx + gw - bw, by + 1, bw, 19, 9.5, { fill: '#fff', lw: 2, stroke: DANGER });
      txt(c, 'はずす', gx + gw - bw / 2, by + 11, { size: 10, color: DANGER, align: 'center' });
      hitC(gx + gw - bw - 4, by - 3, bw + 8, 27, () => { style.hats = style.hats.filter(z => HAT_SLOT[z] !== sl.id); lsSet(K_STYLE, style); }, 'qrm_' + sl.id);
    }
    sl.items.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = gx + col * (cw + gap), iy = by + HDR + row * (ih + gap);
      if (iy + ih < vy0 - 6 || iy > vy0 + vpH + 6) return;
      const sel = style.hats.includes(it.id);
      box(c, x, iy, cw, ih, 14, { fill: sel ? '#fff1f4' : '#fff', lw: sel ? 3 : 2.5, stroke: sel ? DANGER : OUT, ring: sel ? '#ffc2cd' : null });
      thumbSlot(c, { c: 4, p: 0, rare: null, hat: it.id }, x + 4, iy + 4, cw - 8, ih - 22, HAT_REGION[it.id]);
      txt(c, itemName(it), x + cw / 2, iy + ih - 10, { size: 9, align: 'center', maxW: cw - 4, color: sel ? DANGER : INK });
      if (sel) drawItemTag(c, D.wearTag, x + cw / 2, iy - 1, 'wr');
      else if (isNewItem(it)) drawItemTag(c, D.newTag, x + cw - 10, iy - 1, 'nw');
      hitC(x, iy, cw, ih, () => {
        const rest = style.hats.filter(z => HAT_SLOT[z] !== sl.id);
        if (style.hats.includes(it.id)) style.hats = rest;
        else { style.hats = rest.concat(it.id); markUsed(it.k); }
        lsSet(K_STYLE, style);
      }, 'qi_' + it.k);
    });
  });
  if (!zk) {
    const ny = oy + noteTop;
    if (ny + 30 > vy0 - 4 && ny < vy0 + vpH + 4) {
      box(c, gx, ny, gw, 30, 12, { fill: '#fff6dc', lw: 2, stroke: '#e0b050', dash: [5, 4] });
      txt(c, giftPool().length ? D.giftNote1 : D.giftDone, gx + gw / 2, ny + 15.5, { size: 10, align: 'center', maxW: gw - 12, color: '#8a6420' });
    }
  } else {
    txt(c, D.emptyT1, lstX + lstW / 2, vy0 + vpH / 2 - 14, { size: 14, align: 'center', color: INK });
    txt(c, D.emptyT2, lstX + lstW / 2, vy0 + vpH / 2 + 12, { size: 10.5, align: 'center', maxW: lstW - 20, color: INK_SOFT });
  }
  /* hint for the next unlock */
  if (hint) {
    const hy = oy + hintTop;
    box(c, gx, hy, gw, hintH, 14, { fill: '#f1fafd', lw: 2.5, stroke: '#9fb4c0', dash: [6, 4] });
    drawSvg(c, SVG_HAT_HINT, gx + 6, hy + 8, 30, 36);
    const hx = gx + 6 + 30 + 6, hw = gw - (hx - gx) - 8;
    const cu = PROG[hint.need[0]](), pct = Math.min(1, cu / hint.need[1]), left = Math.max(1, hint.need[1] - cu);
    txt(c, D.hintMore, hx, hy + 13, { size: 12, maxW: hw });
    txt(c, D.hintAct(hint.need[0], left), hx, hy + 29, { size: 11, weight: 700, maxW: hw });
    box(c, hx, hy + 39, hw, 8, 4, { fill: '#fff' });
    c.save(); rr(c, hx, hy + 39, hw, 8, 4); c.clip(); c.fillStyle = '#3aa6d8'; c.fillRect(hx, hy + 39, hw * pct, 8); c.restore();
    box(c, hx, hy + 39, hw, 8, 4, { lw: 2 });
  }
  c.restore();
  /* scrollbar */
  if (menuMax > 0) {
    const tx = lstX + lstW + 3, th0 = vpH - 8, thh = Math.max(24, th0 * vpH / contentH), ty = vy0 + 4 + (th0 - thh) * (menuScroll / menuMax);
    c.fillStyle = '#fff0d8'; rr(c, tx, vy0 + 4, 5, th0, 2.5); c.fill();
    c.fillStyle = DANGER; rr(c, tx, ty, 5, thh, 2.5); c.fill();
  }
}
function drawQuick(c) {
  if (!qKind) return;
  const D = L(), isS = qKind === 'salt';
  /* backdrop over the stage: taps on it close the picker (ignored for a moment after opening) */
  c.fillStyle = 'rgba(40,60,70,.12)'; c.fillRect(STG.x, STG.y, STG.w, STG.h);
  hit(STG.x, STG.y, STG.w, STG.h, () => { if (performance.now() - qAt > 450) qClose(); }, { key: 'qb' });
  if (!isS) { drawQuickHat(c); return; }
  const items = ITEMS.filter(x => x.type === (isS ? 'salt' : 'hat') && x.id !== (isS ? 'plain' : 'none') && itemOpen(x));
  const px = STG.x + 6, pw = STG.w - 12, inX = px + 4 + 8, inW = pw - 8 - 16;
  const cols = isS ? 5 : 3, gap = 5, cw = (inW - gap * (cols - 1)) / cols;
  const ih = isS ? 56 : 66, rows = Math.ceil(items.length / cols);
  const hint = hintCand(qKind);
  const hintH = hint ? 52 : 34;
  const ph = 4 + 8 + 28 + 6 + rows * ih + Math.max(0, rows - 1) * gap + 8 + hintH + 10 + 4;
  const py = STG.y + STG.h - 46 - ph;
  box(c, px, py, pw, ph, 22, { fill: CARD, lw: 4, shadow: SHADOW, sy: 5 });
  hit(px, py, pw, ph, null, { key: 'qpop' });
  /* header: title, reset, close */
  let y = py + 4 + 8;
  setFont(c, 13, 900);
  const xw = tw(c, D.closeX) + 20 + 5, xx = px + pw - 4 - 8 - xw;
  box(c, xx, y, xw, 28, 14, { fill: '#ffd23f', lw: 2.5, shadow: OUT, sy: 2 });
  txt(c, D.closeX, xx + xw / 2, y + 14.5, { size: 13, align: 'center' });
  hit(xx, y - 4, xw, 36, qClose, { key: 'qx' });
  const rmLabel = isS ? D.saltReset : D.hatClear, rmOff = isS ? style.salt === 'plain' : !style.hats.length;
  setFont(c, 11, 900);
  const rw = tw(c, rmLabel) + 24, rx = xx - 6 - rw;
  c.save(); if (rmOff) c.globalAlpha = 0.45;
  box(c, rx, y, rw, 28, 14, { fill: '#fff', lw: 2, shadow: rmOff ? null : SHADOW, sy: 2 });
  txt(c, rmLabel, rx + rw / 2, y + 14.5, { size: 11, align: 'center' });
  c.restore();
  if (!rmOff) hit(rx, y - 4, rw, 36, () => { if (isS) style.salt = 'plain'; else style.hats = []; lsSet(K_STYLE, style); }, { key: 'qrm' });
  txt(c, isS ? D.secSalt : D.secHat, px + 4 + 8 + 2, y + 14, { size: 14, maxW: rx - (px + 14) - 6 });
  y += 28 + 6;
  /* the items */
  items.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols), x = inX + col * (cw + gap), iy = y + row * (ih + gap);
    const sel = isS ? style.salt === it.id : style.hats.includes(it.id);
    box(c, x, iy, cw, ih, 14, { fill: '#fff', lw: 2.5, stroke: sel ? DANGER : OUT, ring: sel ? '#ffc2cd' : null });
    if (isS) drawSvg(c, bottleSvg(it.col, false), x + cw / 2 - 14, iy + 4, 28, 30);
    else thumbDraw(c, { c: 4, p: 0, rare: null, hat: it.id }, x + cw / 2 - 27, iy + 3, 54, false);
    txt(c, itemName(it), x + cw / 2, iy + ih - 10, { size: 9, align: 'center', maxW: cw - 4 });
    if (!isS) { box(c, x + 4, iy + 4, 16, 16, 5, { fill: sel ? DANGER : '#fff', lw: 2 }); if (sel) txt(c, '✓', x + 12, iy + 12.5, { size: 11, color: '#fff', align: 'center' }); }
    if (isNewItem(it) && !sel) drawItemTag(c, D.newTag, x + cw - 10, iy - 1, 'nw');
    hit(x, iy, cw, ih, () => {
      if (isS) style.salt = it.id; else style.hats = style.hats.includes(it.id) ? style.hats.filter(z => z !== it.id) : style.hats.concat(it.id);
      if (isS || style.hats.includes(it.id)) markUsed(it.k);
      lsSet(K_STYLE, style);
    }, { key: 'qi_' + it.k });
  });
  y += rows * ih + Math.max(0, rows - 1) * gap + 8;
  /* hint */
  if (!hint) {
    box(c, inX, y, inW, hintH, 14, { fill: '#fff3f6', lw: 2.5, stroke: '#f0b8c4', dash: [6, 4] });
    txt(c, D.hintAll, inX + inW / 2, y + hintH / 2, { size: 12, color: '#c23b55', align: 'center' });
  } else {
    box(c, inX, y, inW, hintH, 14, { fill: '#f1fafd', lw: 2.5, stroke: '#9fb4c0', dash: [6, 4] });
    if (isS) drawFaded(c, inX + 8, y + 8, 34, 36, 0.6, null, f => drawSvg(f, bottleSvg(hint.col, true), inX + 8, y + 8, 34, 36)); else drawSvg(c, SVG_HAT_HINT, inX + 8, y + 8, 34, 36);
    const hx = inX + 8 + 34 + 8, hw = inW - (hx - inX) - 8;
    const cur = PROG[hint.need[0]](), pct = Math.min(1, cur / hint.need[1]), left = Math.max(1, hint.need[1] - cur);
    txt(c, D.hintMore, hx, y + 13, { size: 13, maxW: hw });
    txt(c, D.hintAct(hint.need[0], left), hx, y + 29, { size: 12, weight: 700, maxW: hw });
    box(c, hx, y + 39, hw, 8, 4, { fill: '#fff' });
    c.save(); rr(c, hx, y + 39, hw, 8, 4); c.clip(); c.fillStyle = '#3aa6d8'; c.fillRect(hx, y + 39, hw * pct, 8); c.restore();
    box(c, hx, y + 39, hw, 8, 4, { lw: 2 });
  }
}

/* =====================================================================
   notice line, achievement banner
   ===================================================================== */
function drawNotice(c) {
  if (!noticeShown) return;
  const x = STG.x + 12, w = STG.w - 24, y = STG.y + 10;
  const size = noticeRule ? 14 : 15, weight = noticeRule ? 700 : 900;
  const b = blockSize(c, noticeShown, w - 24 - 6, size, weight, 1.4);
  const h = b.h + 16 + (noticeRule ? 4 : 6);
  if (noticeRule) box(c, x, y, w, h, 18, { fill: 'rgba(255,250,240,0.92)', lw: 2 });
  else box(c, x, y, w, h, 18, { fill: CARD, lw: 3, shadow: SHADOW, sy: 4 });
  txtBlock(c, noticeShown, x + w / 2, y + h / 2 - b.h / 2, w - 30, { size, weight, color: noticeRule ? INK_SOFT : INK, lh: 1.4 });
}
function drawAch(c) {
  if (!achCur || celeb) return;
  const D = L(), big = achBig;
  const ts = big ? 16 : 13, ms = big ? 28 : 21;
  const title = achTitle || D.achTitle;
  const lines = achCur.split('\n');
  setFont(c, ts, 900); let mw = tw(c, title);
  setFont(c, ms, 900); for (const l of lines) mw = Math.max(mw, tw(c, l));
  const padX = big ? 22 : 24, w = Math.min(STG.w - 8, mw + padX * 2 + 8), h = 4 + 14 + ts * 1.4 + 2 + lines.length * ms * 1.35 + 14 + 4;
  const cx = STG.x + STG.w / 2, cy = STG.y + STG.h * 0.3;
  const shown = achDur - achT, inP = reduce ? 1 : clamp(shown / 0.5, 0, 1), outP = achT <= 0.4 ? clamp((0.4 - achT) / 0.4, 0, 1) : 0;
  const sc = (0.5 + 0.5 * easeOutBack(inP)) * (1 - 0.1 * outP);
  c.save(); c.globalAlpha = Math.min(inP * 1.5, 1) * (1 - outP);
  c.translate(cx, cy - (reduce ? 0 : h * 0.3 * outP)); c.scale(sc, sc);
  const x = -w / 2, y = -h / 2;
  if (big) {
    c.save(); c.shadowColor = 'rgba(255,214,90,0.8)'; c.shadowBlur = 24; box(c, x, y, w, h, 24, { fill: '#ffe9a6' }); c.restore();
    c.fillStyle = '#d9a400'; rr(c, x, y + 6, w, h, 24); c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fffbe0'); g.addColorStop(1, '#ffe9a6');
    box(c, x, y, w, h, 24, { fill: g, lw: 4, stroke: '#e0a100' });
  } else box(c, x, y, w, h, 24, { fill: '#fffaf0', lw: 4, shadow: SHADOW, sy: 6 });
  /* shine sweep */
  if (!reduce && shown > 0.45 && shown < 0.45 + 2.2) {
    const sp = ((shown - 0.45) % 1.1) / 1.1, sx = x + w * (-0.6 + 1.9 * sp);
    c.save(); rr(c, x + 4, y + 4, w - 8, h - 8, 20); c.clip();
    const g = c.createLinearGradient(sx, 0, sx + w * 0.4, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(sx, y, w * 0.4, h); c.restore();
  }
  txt(c, title, 0, y + 4 + 14 + ts * 0.7, { size: ts, color: '#b02560', align: 'center' });
  const pp = reduce ? 1 : clamp((shown - 0.3) / 0.9, 0, 1), pk = pp < 0.3 ? 1 + 0.12 * pp / 0.3 : pp < 0.6 ? 1.12 - 0.15 * (pp - 0.3) / 0.3 : 0.97 + 0.03 * (pp - 0.6) / 0.4;
  const my = y + 4 + 14 + ts * 1.4 + 2;
  c.save(); c.translate(0, my + lines.length * ms * 1.35 / 2); c.scale(pk, pk);
  lines.forEach((ln, i) => txt(c, ln, 0, (i - (lines.length - 1) / 2) * ms * 1.35, { size: ms, color: big ? '#7a4b00' : INK, align: 'center' }));
  c.restore();
  c.restore();
  /* only a fresh press made after the banner appeared dismisses it */
  hit(cx - w / 2, cy - h / 2, w, h, null, { key: 'ach', down: () => { if (achCur && achT > 0.4 && performance.now() - achShownAt > 300) achT = 0.4; } });
}

/* =====================================================================
   title screen
   ===================================================================== */
let wipeArm = 0, wipeDone = 0, resetArm = 0;
function drawTitle(c) {
  const D = L();
  c.fillStyle = 'rgba(228,243,248,0.86)'; c.fillRect(-OX / S, -OY / S, VW / S, VH / S);
  /* anywhere (except the controls) starts the game */
  hit(-OX / S, -OY / S, VW / S, VH / S, startGame, { key: 'start' });
  /* card */
  const cx0 = 6, cy0 = 30, cw = 348, ch = 604;
  box(c, cx0, cy0, cw, ch, 28, { fill: CARD, lw: 4, shadow: SHADOW, sy: 6 });
  const ix = cx0 + 14, iw = cw - 28;
  /* measure the stacked blocks, then spread them evenly like the original space-evenly card */
  const tileW = [(iw - 8) * 1.16 / 2.16, (iw - 8) / 2.16];
  const tileDesc = [D.mixD, D.stampD].map((s, i) => blockSize(c, s, tileW[i] - 10, 13, 700, 1.35));
  const tileH = 3 + 10 + 56 + 2 + 24 + Math.max(tileDesc[0].h, tileDesc[1].h) + 10 + 3;
  const legendH = 24 + 2 * 22 + 4;
  const blocks = [108, 29, tileH, 44, 22, 114, legendH];
  const sum = blocks.reduce((a, b) => a + b, 0), innerTop = cy0 + 14, innerH = ch - 28;
  const gap = Math.max(4, (innerH - sum) / (blocks.length + 1));
  let y = innerTop + gap;
  /* hero picture + title */
  drawSvg(c, SVG_HERO, ix, y, iw, 108); y += 108 + gap;
  txt(c, D.title, cx0 + cw / 2, y + 14.5, { size: 24, align: 'center', maxW: iw });
  y += 29 + gap;
  /* two how-to tiles */
  let tx = ix;
  for (let i = 0; i < 2; i++) {
    const w = tileW[i];
    box(c, tx, y, w, tileH, 16, { fill: '#fff3f8', lw: 3 });
    c.fillStyle = ACCENT; c.beginPath(); c.arc(tx + 17, y + 17, 11, 0, TAU); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    txt(c, String(i + 1), tx + 17, y + 17.5, { size: 13, color: '#fff', align: 'center' });
    if (i === 0) drawSvg(c, SVG_TILE1, tx + w / 2 - 58.5, y + 13 - 2.5, 117, 61); else drawSvg(c, SVG_TILE2, tx + w / 2 - 43, y + 13, 86, 56);
    txt(c, i === 0 ? D.mix : D.stamp, tx + w / 2, y + 13 + 56 + 2 + 12, { size: 18, color: ACCENT, align: 'center', maxW: w - 8 });
    txtBlock(c, i === 0 ? D.mixD : D.stampD, tx + w / 2, y + 13 + 56 + 2 + 24, w - 10, { size: 13, weight: 700, color: INK, lh: 1.35 });
    tx += w + 8;
  }
  y += tileH + gap;
  /* sound on / off: half of the gap above the 'tub is full' box moves up here, so the buttons clear the tiles */
  const sh = gap / 2, sy = y - 8 + sh + (5 + gap) / 2;   /* and half of the space down to 'tap to start' */
  setFont(c, 14, 900);
  const sbw = [D.sndOn, D.sndOff].map(s => 3 + 14 + 22 + 6 + tw(c, s) + 14 + 3);
  let sx = cx0 + cw / 2 - (sbw[0] + 10 + sbw[1]) / 2;
  [[true, D.sndOn, SVG_SPK_ON], [false, D.sndOff, SVG_SPK_OFF]].forEach(([v, label, icon], i) => {
    const on = soundOn === v, w = sbw[i], dy = on ? -1 : 0;
    c.save(); if (!on) c.globalAlpha = 0.6;
    box(c, sx, sy + dy, w, 40, 20, { fill: on ? '#8fe3dc' : '#fff', lw: 3, shadow: on ? OUT : '#cfc6b8', sy: on ? 3 : 2 });
    drawSvg(c, icon, sx + 17, sy + dy + 9, 22, 22);
    txt(c, label, sx + 17 + 22 + 6, sy + dy + 20.5, { size: 14 });
    c.restore();
    hit(sx, sy, w, 40, () => setSound(v), { key: 'snd_' + i });
    sx += w + 10;
  });
  y += 44 + gap;
  /* blinking "tap to start" */
  c.save(); c.globalAlpha = reduce ? 1 : 0.6 + 0.4 * Math.cos(uiClock / 1.3 * TAU);
  txt(c, D.tapStart, cx0 + cw / 2, y + 11 - 8 + sh, { size: 19, color: ACCENT, align: 'center', glow: '#fff', glowW: 5 });
  c.restore();
  y += 22 + gap - sh;
  /* when the tub is full */
  box(c, ix, y, iw, 114, 16, { fill: '#f1fafd', lw: 2.5, dash: [7, 4] });
  txt(c, D.limitH, cx0 + cw / 2, y + 2.5 + 6 + 10, { size: 14, align: 'center', maxW: iw - 20 });
  [[SVG_LIM_OUT, D.outing, D.outingD], [SVG_LIM_NAP, D.nap, D.napD]].forEach(([icon, b, s], i) => {
    const ry = y + 2.5 + 6 + 21 + i * 38;
    drawSvg(c, icon, ix + 10, ry, 52, 36);
    const bx = ix + 10 + 52 + 8, bw2 = txt(c, b, bx, ry + 18, { size: 15, color: ACCENT });
    const dx = bx + bw2 + 6, dw = iw - (dx - ix) - 10;
    if (i === 0) {   /* outing: the souvenir hint goes on a second line */
      txt(c, s, dx, ry + 11, { size: 12.5, weight: 700, maxW: dw });
      txt(c, D.outingD2, dx, ry + 26, { size: 12, weight: 700, color: '#d4691c', maxW: dw });
    } else txt(c, s, dx, ry + 18.5, { size: 13, weight: 700, maxW: dw });
  });
  y += 114 + gap;
  drawLegendTitle(c, ix, y, iw);
  /* language + erase records, above the card */
  const lx = 10, ly = 4;
  setFont(c, 12, 900);
  const lw2 = ['日本語', 'English'].map(s => tw(c, s) + 28);
  box(c, lx, ly, lw2[0] + lw2[1], 40, 20, { fill: CARD, shadow: OUT, sy: 1 });
  c.save(); rr(c, lx, ly, lw2[0] + lw2[1], 40, 20); c.clip();
  c.fillStyle = ACCENT; c.fillRect(lang === 'ja' ? lx : lx + lw2[0], ly, lang === 'ja' ? lw2[0] : lw2[1], 40);
  c.restore();
  box(c, lx, ly, lw2[0] + lw2[1], 40, 20, { lw: 2 });
  txt(c, '日本語', lx + lw2[0] / 2, ly + 20.5, { size: 12, color: lang === 'ja' ? '#fff' : INK, align: 'center' });
  txt(c, 'English', lx + lw2[0] + lw2[1] / 2, ly + 20.5, { size: 12, color: lang === 'en' ? '#fff' : INK, align: 'center' });
  hit(lx, ly, lw2[0], 40, () => setLang('ja'), { key: 'ja' });
  hit(lx + lw2[0], ly, lw2[1], 40, () => setLang('en'), { key: 'en' });
  const wl = wipeArm > 0 ? D.wipeAsk : wipeDone > 0 ? D.wiped : D.wipe;
  const armed = wipeArm > 0, ww = txt(c, wl, 350 - 4, ly + 10, { size: 12, weight: armed ? 900 : 700, color: armed ? DANGER : INK_SOFT, align: 'right' });
  c.fillStyle = armed ? DANGER : INK_SOFT; c.fillRect(350 - 4 - ww, ly + 18, ww, 1.2);
  hit(350 - 8 - ww, ly - 4, ww + 12, 30, () => {
    if (wipeArm > 0) { wipeArm = 0; wipeDone = 2; wipeAll(); return; }
    wipeArm = 3;
  }, { key: 'wipe' });
}
/* colour key: base symbols + the four mixed colours (title screen) */
function drawLegendTitle(c, x, y, w) {
  const D = L();
  let cx = x + 2;
  const r1 = y + 12;
  cx += txt(c, D.legendT, cx, r1, { size: 12.5 }) + 10;
  [D.red, D.blue, D.yellow].forEach((s, i) => { sym(c, i, cx + 8, r1, 10.5); cx += 19; cx += txt(c, s, cx, r1, { size: 12.5, weight: 700 }) + 10; });
  const mixes = [['#8a4fc2', D.cPurple, [0, 1]], ['#f58a1f', D.cOrange, [0, 2]], ['#35a868', D.cGreen, [1, 2]], ['#8b5a3c', D.cBrown, [0, 1, 2]]];
  mixes.forEach(([col, name, parts], i) => {
    const mx = x + 2 + (i % 2) * (w / 2 + 3), my = y + 24 + 4 + Math.floor(i / 2) * 22 + 10;
    c.fillStyle = col; c.beginPath(); c.arc(mx + 7, my, 6.1, 0, TAU); c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
    let px = mx + 17;
    px += txt(c, name, px, my, { size: 12.5, weight: 700 }) + 3;
    px += txt(c, '＝', px, my, { size: 12.5, weight: 700, color: INK_SOFT }) + 3;
    const pw = parts.length * 12 + 8;
    box(c, px, my - 9, pw, 18, 9, { fill: 'rgba(255,255,255,0.94)', lw: 1.5 });
    parts.forEach((k, j) => sym(c, k, px + 4 + 6 + j * 12, my, 8, 1.4));
  });
}

/* =====================================================================
   menu: tabs / records / dress-up / album
   ===================================================================== */
let zOpen = false, zTab = 0, zDetail = null, menuScroll = 0, menuScrollTo = null, menuVel = 0, menuMax = 0, menuBodyH = 400;
let shakeKey = null;
const mctx = document.createElement('canvas').getContext('2d');
function openZukan() {
  qClose();
  if (celeb) endCeleb(true);
  if (achCur) { achT = 0; achCur = null; }
  paused = true; drag = null;
  zOpen = true;
  setTab(0);
}
function closeZukan() {
  zOpen = false; zDetail = null;
  resetArm = 0;
  paused = false;
}
function setTab(i) {
  zTab = i; menuScroll = 0; menuScrollTo = null; menuVel = 0; zDetail = null;
  if (i === 0) { unlSeen = new Set(unlockedKeys()); lsSet(K_UNLSEEN, Array.from(unlSeen)); updateDot(); }
  /* measure the new page before it is shown so the card is the right height on its first frame */
  const keep = HIT_ON; HIT_ON = false;
  menuBodyH = TAB_DRAW[zTab](mctx, 0, 0, 276);
  HIT_ON = keep;
}
const CARD_X = STG.x + 8, CARD_W = STG.w - 16, TABS_H = 76;
function sec2(c, x, y, w, h) { box(c, x, y, w, h, 18, { fill: '#f1fafd', lw: 2.5 }); }
/* section heading: pink dot, title, optional chip / counter / button. returns the button rect if any */
function sec2Head(c, x, y, w, title, small, btn, chip) {
  c.fillStyle = '#ff9ec1'; c.beginPath(); c.arc(x + 5, y + 9, 5, 0, TAU); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  let right = x + w, br = null;
  if (btn) {
    setFont(c, 11, 900);
    const bw = tw(c, btn.label) + 24; right -= bw;
    c.save(); if (btn.off) c.globalAlpha = 0.45;
    box(c, right, y - 5, bw, 28, 14, { fill: '#fff', lw: 2, shadow: btn.off ? null : SHADOW, sy: 2 });
    txt(c, btn.label, right + bw / 2, y + 9.5, { size: 11, align: 'center' });
    c.restore();
    br = { x: right, y: y - 5, w: bw, h: 28 };
    right -= 8;
  }
  if (small) { const sw = txt(c, small, right, y + 9.5, { size: 11, weight: 700, color: '#6b8190', align: 'right' }); right -= sw + 4; }
  if (chip) {
    setFont(c, 11, 900);
    const cw = tw(c, chip) + 16; right -= cw;
    const g = c.createLinearGradient(0, y, 0, y + 18); g.addColorStop(0, '#ffe98a'); g.addColorStop(1, '#ffc21f');
    box(c, right, y + 1, cw, 17, 8.5, { fill: g, lw: 2 }); txt(c, chip, right + cw / 2, y + 10, { size: 11, color: '#7a4300', align: 'center' });
    right -= 4;
  }
  txt(c, title, x + 16, y + 9.5, { size: 14, color: '#b02560', maxW: right - x - 18 });
  return br;
}
/* registers a tap region inside the scrolling card (clipped to the visible part) */
let VIEW = { y0: 0, y1: 0 };
function shit(x, y, w, h, fn, key) {
  const y0 = Math.max(y, VIEW.y0), y1 = Math.min(y + h, VIEW.y1);
  if (y1 - y0 < 4) return;
  hit(x, y0, w, y1 - y0, fn, { key, scroller: true });
}
function drawItemCell(c, it, x, y, w, h, sel, open, face) {
  const D = L(), shaking = shakeKey === it.k && anim.shake && animP('shake') < 1;
  const sx = shaking ? Math.sin(animP('shake') * TAU * 2) * 3 : 0;
  c.save(); c.translate(sx, 0);
  if (open) box(c, x, y, w, h, 14, { fill: '#fff', lw: 2.5, stroke: sel ? DANGER : OUT, ring: sel ? '#ffc2cd' : null });
  else box(c, x, y, w, h, 14, { fill: '#eef3f5', lw: 2.5, stroke: '#9fb4c0', dash: [5, 4] });
  face(x + w / 2, y + 4);
  let ty = y + 4 + 38 + 1 + 8;
  txt(c, itemName(it), x + w / 2, ty, { size: 11, align: 'center', maxW: w - 6 }); ty += 15;
  if (!open && !it.secret) {
    txt(c, D.remain(Math.max(1, it.need[1] - PROG[it.need[0]]()), D.unit[it.need[0]]), x + w / 2, ty, { size: 11, color: ACCENT, align: 'center', maxW: w - 6 }); ty += 14;
    txt(c, D.cat[it.need[0]] + ' ' + it.need[1] + D.unit[it.need[0]], x + w / 2, ty, { size: 10, weight: 700, color: '#8a7a6c', align: 'center', maxW: w - 6 });
  }
  if (sel) drawItemTag(c, D.using, x + w / 2, y, 'sel');
  else if (open && isNewItem(it)) drawItemTag(c, D.newTag, x + w - 8, y, 'nw');
  c.restore();
}
let styleBook = false, saltBook = false;   /* おしゃれ tab: show the ずかん block (missing items + conditions) */
function tabStyle(c, x, y, w) {
  const D = L(), y0 = y;
  /* guide band */
  setFont(c, 12.5, 900);
  const gw = w - 5 - 20 - 28 - 8, gl = wrap(c, D.guide1, gw);
  const gh = 5 + 14 + gl.length * 17.5;
  box(c, x, y, w, gh, 16, { fill: '#fff8d9', lw: 2.5, stroke: '#c9a24a', dash: [6, 4] });
  drawSvg(c, SVG_GUIDE, x + 12, y + gh / 2 - 14, 28, 28);
  gl.forEach((ln, i) => txt(c, ln, x + 12 + 28 + 8, y + 9.5 + 17.5 * (i + 0.5), { size: 12.5, color: '#5a4a1f' }));
  y += gh + 12;
  /* preview */
  const pw = w, ph = 6 + (pw - 6) * 0.4;
  c.fillStyle = '#fdf6ec'; rr(c, x, y, pw, ph, 22); c.fill();
  c.save(); rr(c, x + 3, y + 3, pw - 6, ph - 6, 19); c.clip(); c.translate(x + 3, y + 3); c.scale((pw - 6) / 300, (pw - 6) / 300); drawPreview(c); c.restore();
  box(c, x, y, pw, ph, 22, { lw: 3 });
  const so2 = SALTS.find(z => z.id === style.salt) || SALTS[0], pvt = D.pvName(D.saltN[so2.id]);
  setFont(c, 12, 900);
  const pvw = tw(c, pvt) + 25;
  box(c, x + 10, y + 8, pvw, 22, 11, { fill: '#fff', lw: 2.5 }); txt(c, pvt, x + 10 + pvw / 2, y + 19.5, { size: 12, align: 'center' });
  y += ph + 12;
  /* salts and dress-ups */
  const allSalts = ITEMS.filter(z => z.type === 'salt' && z.id !== 'plain' && (!z.secret || itemOpen(z))), salts = saltBook ? allSalts : allSalts.filter(itemOpen), hats = ITEMS.filter(z => z.type === 'hat' && z.id !== 'none' && itemOpen(z));
  const grids = [
    { title: D.secSalt, list: salts, btn: { label: D.saltReset, off: style.salt === 'plain', fn: () => { style.salt = 'plain'; lsSet(K_STYLE, style); } } },
    { title: D.secHat, list: hats, btn: { label: D.hatClear, off: !style.hats.length, fn: () => { style.hats = []; lsSet(K_STYLE, style); } } }
  ];
  grids.forEach((gr, gi) => {
    const gx = x + 12.5, gw2 = w - 25, cwid = (gw2 - 12) / 3;
    const rowsH = [];
    for (let i = 0; i < gr.list.length; i += 3) rowsH.push(gr.list.slice(i, i + 3).some(it => !itemOpen(it) && !it.secret) ? 89 : 74);
    const gridH = rowsH.reduce((a, b) => a + b, 0) + Math.max(0, rowsH.length - 1) * 6;
    const isH = gi === 1, bl = isH && styleBook ? bookLayout() : null;
    const emptyH = !gr.list.length ? 40 : 0, bookH = bl ? 10 + bl.h : 0, GT = 12.5 + 18 + 10 + 28 + 8;   /* the grid starts below the header and the ふやしかた row */
    const sh = GT + gridH + emptyH + bookH + 14.5;
    sec2(c, x, y, w, sh);
    const n = gr.list.filter(itemOpen).length;
    const br = sec2Head(c, gx, y + 12.5, gw2, gr.title, isH ? (styleBook ? n + ' / ' + DRESS_ADOPT_ALL.length : '') : (saltBook ? n + ' / ' + allSalts.length : ''), gr.btn);
    if (br && !gr.btn.off) shit(br.x, br.y - 4, br.w, br.h + 8, gr.btn.fn, 'rm' + gi);
    let ry = y + GT;
    gr.list.forEach((it, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      if (col === 0 && row > 0) ry += rowsH[row - 1] + 6;
      const ix = gx + col * (cwid + 6), open = itemOpen(it), sel = it.type === 'salt' ? style.salt === it.id : style.hats.includes(it.id), h = rowsH[row];
      drawItemCell(c, it, ix, ry, cwid, h, sel, open, (fx0, fy0) => {
        if (it.type === 'salt') { if (open) drawSvg(c, bottleSvg(it.col, false), fx0 - 18, fy0, 36, 38); else drawFaded(c, fx0 - 18, fy0, 36, 38, 0.6, null, f => drawSvg(f, bottleSvg(it.col, true), fx0 - 18, fy0, 36, 38)); }
        else if (open) thumbDraw(c, { c: 4, p: 0, rare: null, hat: it.id }, fx0 - 27, fy0 - 3, 54, false);
        else drawFaded(c, fx0 - 27, fy0 - 3, 54, 48, 0.6, LOCK_TINT, f => thumbDraw(f, { c: 4, p: 0, rare: null, hat: it.id }, fx0 - 27, fy0 - 3, 54, false));
      });
      shit(ix, ry, cwid, h, () => {
        if (!open) { shakeKey = it.k; startAnim('shake', 0.35); return; }
        if (it.type === 'salt') style.salt = it.id;
        else style.hats = style.hats.includes(it.id) ? style.hats.filter(z => z !== it.id) : style.hats.concat(it.id);
        if (it.type === 'salt' || style.hats.includes(it.id)) markUsed(it.k);
        lsSet(K_STYLE, style);
      }, 'it_' + it.k);
    });
    {
      /* the ふやしかた toggle sits right under the header, so it can be closed without scrolling to the bottom */
      const open = isH ? styleBook : saltBook, lab = open ? D.backBtn : D.zukanBtn;
      setFont(c, 11, 900);
      const bw = tw(c, lab) + 28, bx = gx + gw2 - bw, byy = y + 12.5 + 18 + 10;
      box(c, bx, byy, bw, 28, 14, { fill: open ? '#e3f3fb' : '#fff', lw: 2, stroke: '#3aa6d8', shadow: SHADOW, sy: 2 });
      txt(c, lab, bx + bw / 2, byy + 14.5, { size: 11, align: 'center', color: '#2a86b8' });
      shit(bx - 4, byy - 4, bw + 8, 36, () => { if (isH) styleBook = !styleBook; else saltBook = !saltBook; }, 'book' + gi);
      let by = y + GT + gridH;
      if (emptyH) { txt(c, isH ? D.emptyT1 : D.emptyS1, gx + gw2 / 2, by + 12, { size: 13, align: 'center' }); txt(c, isH ? D.emptyT2 : D.emptyS2, gx + gw2 / 2, by + 30, { size: 10.5, align: 'center', maxW: gw2 - 8, color: INK_SOFT }); by += emptyH; }
      if (bl) drawBook(c, bl, gx, by + 10, gw2);
    }
    y += sh + (gi ? 0 : 12);
  });
  return y - y0;
}
function drawPreview(c2) {
  const w = 300, h = 120;
  c2.fillStyle = '#fdf6ec'; c2.fillRect(0, 0, w, h);
  const so = SALTS.find(x => x.id === style.salt) || SALTS[0];
  let fill = so.col;
  if (so.id === 'gold') { const g = c2.createLinearGradient(0, 0, w, h); ['#ffe27a', '#fff6c2', '#f0b83a', '#ffe27a'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c)); fill = g; }
  if (fill === 'rainbow') { const g = c2.createLinearGradient(0, 0, w, 0); ['#ffc9c9', '#ffe3b0', '#fff6b0', '#c9f0c9', '#b8e4ff', '#d9c9ff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c)); fill = g; }
  c2.fillStyle = fill; c2.strokeStyle = OUT; c2.lineWidth = 3;
  rr(c2, 8, 8, w - 16, h - 16, 26); c2.fill(); c2.stroke();
  c2.strokeStyle = 'rgba(255,255,255,0.7)'; c2.lineWidth = 2.5; c2.lineCap = 'round';
  for (const [x, y, r] of [[60, 34, 14], [150, 90, 16], [240, 40, 12]]) { c2.beginPath(); c2.arc(x, y, r, Math.PI * 1.15, Math.PI * 1.85); c2.stroke(); }
  c2.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [x, y, r] of [[28, 86, 4], [118, 30, 3], [208, 96, 5], [274, 80, 3.5], [96, 100, 2.5]]) { c2.beginPath(); c2.arc(x, y, r, 0, TAU); c2.fill(); }
  const k = 0.82;
  drawSaltFx(c2, { x: 8, y: 8, w: w - 16, h: h - 16 }, style.salt, 1.7, true);
  c2.save(); c2.beginPath(); rr(c2, 8, 8, w - 16, h - 16, 26); c2.clip();
  drawDuck(c2, { c: 4, p: 0, rare: null, hat: style.hats }, 62, 84, k, false, 0, 1);
  drawDuck(c2, { c: 1, p: 1, rare: null, hat: style.hats }, 150, 74, k, true, 0, 1);
  drawDuck(c2, { c: 2, p: 2, rare: null, hat: style.hats }, 240, 86, k, false, 0, 1);
  c2.restore();
}
function tabAlbum(c, x, y, w) {
  const D = L(), y0 = y;
  txt(c, D.album, x, y + 8.5, { size: 13, weight: 700, color: INK_SOFT });
  txt(c, seen.size + ' / ' + TOTAL, x + w, y + 8.5, { size: 13, weight: 700, color: INK_SOFT, align: 'right' });
  y += 17 + 12;
  /* colour key */
  let cx = x;
  const r1 = y + 12;
  cx += txt(c, D.legendT, cx, r1, { size: 14 }) + 10;
  [D.red, D.blue, D.yellow].forEach((s, i) => { sym(c, i, cx + 8, r1, 10.5); cx += 19; cx += txt(c, s, cx, r1, { size: 14, weight: 700 }) + 10; });
  const r2 = y + 24 + 4 + 12;
  cx = x;
  [[1, D.patS, '＋'], [2, D.patD, '＝'], [3, D.patB, '']].forEach(([k, s, op]) => {
    patIcon(c, k, cx + 9, r2, 8); cx += 21;
    cx += txt(c, s, cx, r2, { size: 14, weight: 700 }) + 8;
    if (op) cx += txt(c, op, cx, r2, { size: 14, weight: 700, color: INK_SOFT }) + 8;
  });
  y += 24 + 4 + 24 + 12;
  /* grid: colour rows x pattern columns */
  const lw = 54, cw = (w - lw - 24) / 4;
  for (let p = 0; p < 4; p++) txt(c, D.patHead[p], x + lw + 6 + p * (cw + 6) + cw / 2, y + 8, { size: 12, color: INK_SOFT, align: 'center', maxW: cw });
  y += 16 + 6;
  const thW = cw - 8, thH = thW * 106 / 120;
  for (let col = 0; col < 8; col++) {
    let rowH = 64;
    const names = [];
    for (let p = 0; p < 4; p++) {
      if (col === 0 && p === 0) { names.push(null); continue; }
      const nm = gname(col, p).replace('縞水玉', '縞\n水玉');
      setFont(c, 11, 700);
      const ls = seen.has(gid(col, p)) ? wrap(c, nm, thW + 2) : [];
      names.push(ls);
      rowH = Math.max(rowH, 4 + 2 + thH + ls.length * 13.2 + 4);
    }
    txt(c, D.col[col], x + lw / 2, y + rowH / 2, { size: 13, align: 'center', maxW: lw - 4 });
    for (let p = 0; p < 4; p++) {
      if (col === 0 && p === 0) continue;
      const cx2 = x + lw + 6 + p * (cw + 6), id = gid(col, p);
      if (seen.has(id)) {
        box(c, cx2, y, cw, rowH, 12, { fill: '#fff', lw: 2 });
        const ls = names[p], bh = thH + ls.length * 13.2, top = y + (rowH - bh) / 2;
        thumbDraw(c, { c: col, p, rare: null, hat: 'none' }, cx2 + 4, top, thW, true);
        ls.forEach((ln, i) => txt(c, ln, cx2 + cw / 2, top + thH + 13.2 * (i + 0.5), { size: 11, weight: 700, align: 'center', maxW: cw - 4 }));
        shit(cx2, y, cw, rowH, () => { zDetail = { g: { c: col, p, rare: null, hat: 'none' }, rare: null, t: 0 }; }, 'z' + id);
      } else {
        box(c, cx2, y, cw, rowH, 12, { fill: '#e6edf0', lw: 2, stroke: '#9fb4c0', dash: [4, 3] });
        txt(c, '？', cx2 + cw / 2, y + rowH / 2, { size: 20, color: '#6b8190', align: 'center' });
      }
    }
    y += rowH + 6;
  }
  /* secret ducks (only the ones already found) */
  if (seenRare.size) {
    y += 6;
    txt(c, D.secret, x, y + 10, { size: 15 });
    y += 20 + 8;
    const rw = (w - 12) / 3;
    RARE_IDS.filter(id => seenRare.has(id)).forEach((id, i) => {
      const rx = x + i * (rw + 6), th = (rw - 8) * 106 / 120, rh = 4 + th + 14 + 6;
      box(c, rx, y, rw, rh, 12, { fill: '#fff', lw: 2 });
      thumbDraw(c, { c: 0, p: 0, rare: id, hat: 'none' }, rx + 4, y + 4, rw - 8, false);
      txt(c, RARE[id].n, rx + rw / 2, y + 4 + th + 7, { size: 11, weight: 700, align: 'center', maxW: rw - 6 });
      setFont(c, 11, 900);
      const xs = '×' + (rareCount[id] || 1), xw = tw(c, xs) + 10;
      box(c, rx + rw - 3 - xw, y + 2, xw, 15, 7.5, { fill: ACCENT }); txt(c, xs, rx + rw - 3 - xw / 2, y + 10, { size: 11, color: '#fff', align: 'center' });
      shit(rx, y, rw, rh, () => { zDetail = { g: { c: 0, p: 0, rare: id, hat: 'none' }, rare: id, t: 0 }; }, 'zr' + id);
    });
    y += 4 + ((w - 12) / 3 - 8) * 106 / 120 + 14 + 6;
  } else y -= 6;
  return y - y0;
}
function tabLog(c, x, y, w) {
  const D = L(), y0 = y, tot = bornTotal();
  const byC = new Array(8).fill(0), byP = new Array(4).fill(0);
  for (let cc = 0; cc < 8; cc++) for (let p = 0; p < 4; p++) { const n = stats.born[gid(cc, p)]; byC[cc] += n; byP[p] += n; }
  /* total */
  box(c, x, y, w, 94, 20, { fill: '#fff3f8', lw: 3 });
  txt(c, D.logTotal, x + w / 2, y + 3 + 10 + 9, { size: 13, color: '#b02560', align: 'center' });
  setFont(c, 46, 900); const nw = tw(c, String(tot)); setFont(c, 16, 900); const uw = D.logUnit ? tw(c, D.logUnit) + 4 : 0;
  txt(c, String(tot), x + w / 2 - (nw + uw) / 2, y + 60, { size: 46 });
  if (uw) txt(c, D.logUnit, x + w / 2 - (nw + uw) / 2 + nw + 4, y + 68, { size: 16 });
  y += 94 + 12;
  /* three tiles */
  const tw3 = (w - 16) / 3;
  [[SVG_STAMP, D.tHana, stats.hana, D.tPcs], [ICON_BALLOON, D.tOut, stats.out, D.tTimes], [ICON_HOUSE, D.tNap, stats.nap, D.tTimes]].forEach(([icon, label, n, unit], i) => {
    const tx = x + i * (tw3 + 8);
    box(c, tx, y, tw3, 93, 16, { fill: '#f1fafd', lw: 2.5 });
    drawSvg(c, icon, tx + tw3 / 2 - 20, y + 8.5, 40, 32);
    txt(c, label, tx + tw3 / 2, y + 8.5 + 32 + 9, { size: 12, color: INK_SOFT, align: 'center', maxW: tw3 - 8 });
    setFont(c, 22, 900); const a = tw(c, String(n)); setFont(c, 11, 900); const b = unit ? tw(c, unit) + 1 : 0;
    txt(c, String(n), tx + tw3 / 2 - (a + b) / 2, y + 8.5 + 32 + 18 + 13, { size: 22 });
    if (b) txt(c, unit, tx + tw3 / 2 - (a + b) / 2 + a + 1, y + 8.5 + 32 + 18 + 17, { size: 11 });
  });
  y += 93 + 12;
  /* by colour: duck size = share, symbol badge on top, share bubble on the back */
  const tubH = 304, s1h = 12.5 + 18 + 8 + tubH + 14.5;
  sec2(c, x, y, w, s1h);
  sec2Head(c, x + 12.5, y + 12.5, w - 25, D.secColor);
  const tb = { x: x + 12.5, y: y + 12.5 + 18 + 8, w: w - 25, h: tubH };
  const tg = c.createLinearGradient(0, tb.y, 0, tb.y + tb.h); tg.addColorStop(0, '#d9f2fb'); tg.addColorStop(1, '#bfe7f4');
  box(c, tb.x, tb.y, tb.w, tb.h, 28, { fill: tg });
  if (!tot) txt(c, D.noBorn, tb.x + tb.w / 2, tb.y + tb.h / 2, { size: 14, color: '#5b7686', align: 'center' });
  else {
    c.save(); rr(c, tb.x + 3, tb.y + 3, tb.w - 6, tb.h - 6, 25); c.clip();
    const mx = Math.max.apply(null, byC), rows = [[4, 1, 2], [0, 6, 3], [7, 5]], jy = [4, -3, 5, -2, 4, -4, 2, -3];
    const iw = tb.w - 6;
    let k = 0;
    rows.forEach((r, ri) => r.forEach((id, ci) => {
      const n = byC[id], dw = 36 + Math.sqrt(n / mx) * 40, cw = dw * 1.2, ch = cw * 230 / 240, q = Math.max(28, dw * 0.5);
      const cx = tb.x + 3 + (ci + 0.5) / r.length * iw, yy = tb.y + 3 + ri * 98 + 58 + jy[k++], pc = Math.round(n / tot * 100);
      const left = cx - cw / 2, top = yy - ch * 0.62;
      c.save();
      if (n) badgeDuckDraw(c, id, left, top, cw);
      else { drawFaded(c, left, top, cw, ch, 0.4, null, f => badgeDuckDraw(f, id, left, top, cw)); c.globalAlpha = 0.4; }
      const bx = left + cw * 0.36, by = top + ch * 0.5;
      const bg = c.createRadialGradient(bx - q * 0.18, by - q * 0.22, 0, bx, by, q / 2);
      bg.addColorStop(0, '#fff'); bg.addColorStop(0.24, 'rgba(255,255,255,.45)'); bg.addColorStop(0.7, 'rgba(190,235,250,.35)'); bg.addColorStop(1, 'rgba(120,200,235,.45)');
      c.fillStyle = bg; c.beginPath(); c.arc(bx, by, q / 2, 0, TAU); c.fill(); c.lineWidth = 2; c.strokeStyle = '#7fc3dd'; c.stroke();
      setFont(c, q * 0.4, 900); const a = tw(c, String(pc)); setFont(c, q * 0.4 * 0.62, 900); const b = tw(c, '%');
      txt(c, String(pc), bx - (a + b) / 2, by + 1, { size: q * 0.4, color: '#2a5d78' });
      txt(c, '%', bx - (a + b) / 2 + a, by + 2, { size: q * 0.4 * 0.62, color: '#2a5d78' });
      txt(c, n + D.logUnit, cx, top + ch + 3 + 7, { size: 12, color: '#5b7686', align: 'center' });
      c.restore();
    }));
    c.restore();
  }
  box(c, tb.x, tb.y, tb.w, tb.h, 28, { lw: 3 });
  y += s1h + 12;
  /* by pattern */
  const pcw = (w - 25 - 18) / 4, pth = 46 * 106 / 120, pch = 2 + 3 + pth + 13 + 20 + 4 + 2, s2h = 12.5 + 18 + 8 + pch + 14.5;
  sec2(c, x, y, w, s2h);
  sec2Head(c, x + 12.5, y + 12.5, w - 25, D.secPat);
  for (let p = 0; p < 4; p++) {
    const px = x + 12.5 + p * (pcw + 6), py = y + 12.5 + 18 + 8;
    box(c, px, py, pcw, pch, 12, { fill: '#fff', lw: 2 });
    thumbDraw(c, { c: 0, p, rare: null, hat: 'none' }, px + pcw / 2 - 23, py + 5, 46, false);
    txt(c, D.patHead[p], px + pcw / 2, py + 5 + pth + 7, { size: 11, weight: 700, align: 'center', maxW: pcw - 4 });
    txt(c, String(byP[p]), px + pcw / 2, py + 5 + pth + 13 + 10, { size: 15, align: 'center' });
  }
  y += s2h + 12;
  /* medals */
  const visMedals = MEDALS.filter(m => !m.secret || medalSet.has(m.id));
  const doneN = visMedals.filter(m => medalSet.has(m.id)).length, allDone = medalSet.has('s_every');
  const grid = visMedals.filter(m => m.secret !== 'every');
  const mw = (w - 25 - 8) / 5, rowsN = Math.ceil(grid.length / 5), mrow = 56 + 1 + 12;
  const fullH = allDone ? (w - 25 - 4) * 178 / 300 + 8 : 0;
  const gridH = rowsN * mrow + (rowsN - 1) * 8 + (allDone ? 8 + 3 + 4 + fullH : 0);
  const s3h = 12.5 + 18 + 8 + gridH + 14.5 + (allDone ? 6 : 0);
  sec2(c, x, y, w, s3h);
  sec2Head(c, x + 12.5, y + 12.5, w - 25, D.secMedal, doneN + ' / ' + visMedals.length, null, allDone ? D.complete : null);
  let gy = y + 12.5 + 18 + 8;
  if (allDone) {
    c.save(); c.shadowColor = 'rgba(255,200,40,0.55)'; c.shadowBlur = 14;
    box(c, x + 12.5, gy, w - 25, gridH, 14, { fill: '#fffdf0' }); c.restore();
    box(c, x + 12.5, gy, w - 25, gridH, 14, { lw: 3, stroke: '#ffc21f' });
    gy += 8;
  }
  grid.forEach((m, i) => {
    const done = medalSet.has(m.id), mx = x + 12.5 + (i % 5) * (mw + 2), my = gy + Math.floor(i / 5) * (mrow + 8);
    drawSvg(c, medalSvg(m, done), mx + mw / 2 - 23, my, 46, 56);
    txt(c, m.secret ? D.medalSecret[m.secret] : D.cat[m.cat], mx + mw / 2, my + 57 + 6, { size: 10, color: done ? INK_SOFT : '#9fb4c0', align: 'center', maxW: mw + 2 });
  });
  if (allDone) drawSvg(c, everyBlockSvg(), x + 12.5 + 2, gy + rowsN * mrow + (rowsN - 1) * 8 + 8, w - 25 - 4, fullH - 8);
  y += s3h;
  return y - y0;
}
const TAB_DRAW = [tabStyle, tabAlbum, tabLog];
function drawMenu(c) {
  const D = L();
  /* the panel covers the stage; the HUD above stays usable */
  c.fillStyle = 'rgba(228,243,248,0.86)'; c.fillRect(STG.x, STG.y, STG.w, STG.h);
  hit(STG.x, STG.y, STG.w, STG.h, null, { key: 'zpanel' });
  const tail = 12 + 44 + 12 + 30 + 20;
  const fullH = TABS_H + menuBodyH + tail;
  const ch = Math.min(STG.h - 16, fullH + 8);
  const cx = CARD_X, cy = STG.y + 8 + (STG.h - 16 - ch) / 2;
  menuMax = Math.max(0, fullH + 8 - ch);
  if (menuScrollTo !== null) { menuScroll += (menuScrollTo - menuScroll) * 0.25; if (Math.abs(menuScrollTo - menuScroll) < 0.5) { menuScroll = menuScrollTo; menuScrollTo = null; } }
  menuScroll = clamp(menuScroll, 0, menuMax);
  box(c, cx, cy, CARD_W, ch, 28, { fill: CARD, shadow: SHADOW, sy: 6 });
  const vx = cx + 4, vy = cy + 4, vh = ch - 8, ix = cx + 4 + 18, iw = CARD_W - 8 - 36;
  VIEW = { y0: vy + TABS_H, y1: vy + vh };
  hit(vx, vy, CARD_W - 8, vh, null, { key: 'zcard', scroller: true });
  c.save(); rr(c, vx, vy, CARD_W - 8, vh, 24); c.clip();
  /* scrolling content */
  const top = vy + TABS_H - menuScroll;
  const bh = TAB_DRAW[zTab](c, ix, top, iw);
  if (Math.abs(bh - menuBodyH) > 0.5) menuBodyH = bh;
  /* start over (two taps) */
  const ry = top + bh + 12;
  const rl = resetArm > 0 ? D.restartAsk : D.restartAll;
  const rw = txt(c, rl, cx + CARD_W / 2, ry + 22, { size: 13, weight: 700, color: resetArm > 0 ? DANGER : INK_SOFT, align: 'center', maxW: iw });
  c.fillStyle = resetArm > 0 ? DANGER : INK_SOFT; c.fillRect(cx + CARD_W / 2 - rw / 2, ry + 30, rw, 1.2);
  shit(cx + CARD_W / 2 - rw / 2 - 6, ry, rw + 12, 44, () => {
    if (resetArm > 0) { resetArm = 0; wipeAll(); closeZukan(); startGame(); return; }
    resetArm = 3;
  }, 'reset');
  /* sticky tabs */
  c.fillStyle = CARD; c.fillRect(vx, vy, CARD_W - 8, TABS_H);
  const tg = { x: ix, y: vy + 14, w: iw, h: 54 };
  box(c, tg.x, tg.y, tg.w, tg.h, 27, { fill: '#e9f4f8', lw: 3 });
  const tbw = (tg.w - 14 - 8) / 3;
  [D.tabStyle, D.album, D.tabLog].forEach((label, i) => {
    const bx = tg.x + 7 + i * (tbw + 4), by = tg.y + 7, on = zTab === i;
    if (on) { box(c, bx, by, tbw, 40, 20, { fill: DANGER, shadow: '#a82f43', sy: 3 }); }
    txt(c, label, bx + tbw / 2, by + 20.5, { size: 15, color: on ? '#fff' : '#6b8190', align: 'center', maxW: tbw - 8 });
    hit(bx, by, tbw, 40, () => setTab(i), { key: 'tab' + i });
  });
  /* sticky bottom bar: "more below" cue + close */
  const naturalY = top + bh + 12 + 44 + 12, barY = Math.min(naturalY, vy + vh - 6 - 30);
  const room = menuMax, cueOn = !(room <= 6 || menuScroll >= room - 8);
  if (cueOn) {
    setFont(c, 13, 900);
    const cw = tw(c, D.scrollCue) + 28 + 6, bob = reduce ? 0 : 1.5 - 1.5 * Math.cos(uiClock / 1.2 * TAU);
    box(c, ix, barY + bob, cw, 30, 15, { fill: DANGER, lw: 3, shadow: OUT, sy: 3 });
    txt(c, D.scrollCue, ix + cw / 2, barY + bob + 15.5, { size: 13, color: '#fff', align: 'center' });
    hit(ix, barY, cw, 30, () => { menuVel = 0; menuScrollTo = clamp(menuScroll + vh * 0.8, 0, menuMax); }, { key: 'cue' });
  }
  setFont(c, 13, 900);
  const clw = tw(c, D.closeX) + 28 + 6;
  box(c, ix + iw - clw, barY, clw, 30, 15, { fill: '#ffd23f', lw: 3, shadow: OUT, sy: 3 });
  txt(c, D.closeX, ix + iw - clw / 2, barY + 15.5, { size: 13, align: 'center' });
  hit(ix + iw - clw, barY - 4, clw, 38, closeZukan, { key: 'zclose' });
  /* scrollbar */
  if (menuMax > 0) {
    const tr = { x: cx + CARD_W - 4 - 9, y: vy + 18, w: 7, h: vh - 36 };
    c.fillStyle = '#fff0d8'; rr(c, tr.x, tr.y, tr.w, tr.h, 3.5); c.fill();
    const th = Math.max(30, tr.h * vh / (vh + menuMax)), ty = tr.y + (tr.h - th) * (menuScroll / menuMax);
    c.fillStyle = DANGER; rr(c, tr.x, ty, tr.w, th, 3.5); c.fill();
  }
  c.restore();
  box(c, cx, cy, CARD_W, ch, 28, { lw: 4 });
  if (zDetail) drawDetail(c);
}
/* tapping an album cell opens its detail card */
function drawDetail(c) {
  const D = L(), z = zDetail, g = z.g;
  c.fillStyle = 'rgba(53,80,95,0.55)'; c.fillRect(STG.x, STG.y, STG.w, STG.h);
  hit(STG.x, STG.y, STG.w, STG.h, () => { zDetail = null; }, { key: 'zdetail' });
  const w = 300, inner = w - 36;
  const name = z.rare ? RARE[z.rare].n : gname(g.c, g.p);
  let row = '';
  if (z.rare) row = D.caughtN(rareCount[z.rare] || 1);
  else {
    const comps = [];
    for (let i = 0; i < 3; i++) if (g.c & (1 << i)) comps.push(D.compC[i]);
    for (let i = 0; i < 2; i++) if (g.p & (1 << i)) comps.push(D.compP[i]);
    row = isBase(g.c, g.p) ? D.fromFaucet : D.recipe + '： ' + comps.join(' ＋ ');
  }
  const nb = blockSize(c, name, inner, 24, 900, 1.2), rb = blockSize(c, row, inner, 14, z.rare ? 900 : 700, 1.35);
  const thH = 170 * 106 / 120;
  const h = 4 + 16 + thH + 6 + nb.h + 6 + rb.h + (z.rare ? 0 : 6 + 24) + 6 + 14 + 14 + 4;
  const cx = STG.x + STG.w / 2, cy = STG.y + STG.h / 2;
  const sc = reduce ? 1 : 0.5 + 0.5 * easeOutBack(clamp(z.t / 0.3, 0, 1));
  c.save(); c.translate(cx, cy); c.scale(sc, sc); c.globalAlpha = reduce ? 1 : clamp(z.t / 0.15, 0, 1);
  const x = -w / 2, y0 = -h / 2;
  box(c, x, y0, w, h, 26, { fill: CARD, lw: 4, shadow: SHADOW, sy: 6 });
  let y = y0 + 4 + 16;
  thumbDraw(c, g, -85, y, 170, true); y += thH + 6;
  y += txtBlock(c, name, 0, y, inner, { size: 24, color: INK, lh: 1.2 }) + 6;
  y += txtBlock(c, row, 0, y, inner, { size: 14, weight: z.rare ? 900 : 700, color: z.rare ? ACCENT : INK_SOFT }) + 6;
  if (!z.rare) { txt(c, D.bornN(stats.born[gid(g.c, g.p)]), 0, y + 12, { size: 18, align: 'center', maxW: inner }); y += 24 + 6; }
  txt(c, D.tapClose, 0, y + 9, { size: 11, weight: 700, color: '#8a9aa5', align: 'center' });
  c.restore();
}

/* =====================================================================
   update
   ===================================================================== */
function physics(dt) {
  const g = geo, r = g.r;
  const minX = g.water.x + r * 0.9, maxX = g.water.x + g.water.w - r * 0.9;
  const minY = g.water.y + r * 0.9, maxY = g.water.y + g.water.h - r * 0.9;
  const speedUp = 1 + Math.min(gameTime, 120) / 120 * 0.4;
  for (const d of ducks) {
    d.age += dt;
    d.turnT -= dt;
    if (d.turnT <= 0) { d.turn = rand(-1.2, 1.2); d.turnT = rand(0.8, 2.2); }
    d.th += d.turn * dt;
    const sp = CFG.SPEED * (r / 26) * speedUp * d.sp;
    const k = Math.min(1, dt * 1.5);
    d.vx += (Math.cos(d.th) * sp - d.vx) * k;
    d.vy += (Math.sin(d.th) * sp - d.vy) * k;
    d.x += d.vx * dt; d.y += d.vy * dt;
    d.phase += dt * 2.2;
    if (d.shake > 0) d.shake -= dt;
    if (d.hop > 0) d.hop -= dt;
    if (d.cheerT > 0) {
      d.cheerT -= dt;
      if (d.cheerT <= 0) {
        d.hop = 0.5;
        if (--d.cheerN > 0) d.cheerT = 0.55;
        else if (Math.random() < 0.4) { const q = L().cheer; texts.push({ x: d.x, y: d.y - geo.r * 1.9, text: q[Math.floor(Math.random() * q.length)], t: 0, dur: 0.9, kind: 'plain' }); }
        else if (Math.random() < 0.3) hearts(d.x, d.y - geo.r, 2);
      }
    }
    if (Math.abs(d.vx) > 3) d.flip = d.vx < 0;
  }
  const minD = r * 1.65;
  for (let i = 0; i < ducks.length; i++) {
    for (let j = i + 1; j < ducks.length; j++) {
      const a = ducks[i], b = ducks[j];
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
      if (dist < minD && dist > 0.001) {
        const push = (minD - dist) * 0.5 * Math.min(1, dt * 8);
        const nx = dx / dist, ny = dy / dist;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      }
    }
  }
  const dr = g.home, keep = r * 1.7 * houseScale();
  for (const d of ducks) {
    const dx = d.x - dr.x, dy = d.y - dr.y, dist = Math.hypot(dx, dy);
    if (dist < keep) {
      const push = (keep - dist) * Math.min(1, dt * 6), m = dist || 1;
      d.x += dx / m * push; d.y += dy / m * push;
    }
    if (d.x < minX) { d.x = minX; d.vx = Math.abs(d.vx); d.th = Math.atan2(Math.sin(d.th), Math.abs(Math.cos(d.th))); }
    if (d.x > maxX) { d.x = maxX; d.vx = -Math.abs(d.vx); d.th = Math.atan2(Math.sin(d.th), -Math.abs(Math.cos(d.th))); }
    if (d.y < minY) { d.y = minY; d.vy = Math.abs(d.vy); d.th = Math.atan2(Math.abs(Math.sin(d.th)), Math.cos(d.th)); }
    if (d.y > maxY) { d.y = maxY; d.vy = -Math.abs(d.vy); d.th = Math.atan2(-Math.abs(Math.sin(d.th)), Math.cos(d.th)); }
  }
}
/* UI timers keep running while the menu pauses the game */
let uiClock = 0;
function updateUi(dt) {
  uiClock += dt;
  for (const k in anim) { anim[k].t += dt; if (anim[k].t > anim[k].dur) delete anim[k]; }
  if (stampT > 0) stampT -= dt;
  if (bounceT > 0) bounceT -= dt;
  if (zDetail) zDetail.t += dt;
  /* menu glide after a swipe: slows down smoothly, stops at either end */
  if (menuVel) {
    menuScroll += menuVel * dt;
    menuVel *= Math.pow(0.135, dt);
    if (menuScroll <= 0 || menuScroll >= menuMax) { menuScroll = clamp(menuScroll, 0, menuMax); menuVel = 0; }
    if (Math.abs(menuVel) < 8 || !(zOpen || qKind)) menuVel = 0;
  }
  gaugeShown += (gaugeRatio - gaugeShown) * (reduce ? 1 : Math.min(1, dt * 12));
}
function update(dt) {
  updateUi(dt);
  if (paused) return;
  clock += dt;
  if (state === 'play') {
    gameTime += dt;
    if (count() < CFG.CAP && !guide) supplyTimer -= dt;
    if (supplyTimer <= 0) {
      spawnSupply();
      supplyTimer = supplyInterval();
    }
  }
  if (noticeT > 0) noticeT -= dt;
  refreshNotice();
  tickAch(dt);
  updDrum(dt);
  updNapQ(dt);
  if (!guide && state === 'play' && count() >= CFG.CAP && !lsGet(K_CTIP)) { lsSet(K_CTIP, 1); showNotice(L().chainTip, 4.5); }   /* once, the first time the tub fills up */
  if (drag && ducks.includes(drag.duck)) spotDuck = drag.duck;
  dimK = clamp(dimK + (dragDim() ? dt / 0.2 : -dt / 0.25), 0, 1);   /* fade in / out instead of switching */
  updGuide(dt);
  if (cardWait > 0) { cardWait -= dt; if (cardWait <= 0) landCard(); }
  if (homeBounce > 0) homeBounce -= dt;
  const hlv = houseLevel();
  if (hlv > 0) {
    houseT -= dt;
    if (houseT <= 0) {
      houseT = Math.max(2.2, 5.4 - hlv * 0.65); homeCall = 0.8;
      if (hlv >= 2 && !reduce) zzz(geo.home.x + geo.r * 0.5, geo.home.y - geo.r * (1.5 + 0.1 * hlv));
    }
  } else houseT = 1.5;
  if (homeCall > 0) homeCall -= dt;
  physics(dt);
  const f60 = dt * 60;
  for (const f of fx) {
    f.t += dt;
    if (f.kind === 'drop') { f.vy += 420 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    if (f.kind === 'star') { f.vy += 160 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= Math.pow(0.98, f60); }
    if (f.kind === 'leave') { f.y -= 150 * (1 - f.t / f.dur) * dt; f.x += f.dx * dt; }
    if (f.kind === 'heart') { f.y -= 46 * dt; f.x += Math.sin(f.t * 6 + f.s) * 22 * dt; }
    if (f.kind === 'petal') { f.vy += 150 * dt; f.vx *= Math.pow(0.985, f60); f.x += f.vx * dt + Math.sin(f.t * 5 + f.s) * 0.5 * f60; f.y += f.vy * dt; f.rot += dt * 3; }
  }
  fx = fx.filter(f => f.t < f.dur);
  for (const t of texts) { t.t += dt; t.y -= 26 * dt; }
  texts = texts.filter(t => t.t < t.dur);
  updateGauge();
}

/* =====================================================================
   game drawing (stage coordinates)
   ===================================================================== */
function heart(c) {
  c.beginPath();
  c.moveTo(0, 4);
  c.bezierCurveTo(-8, -2, -5, -8, 0, -4);
  c.bezierCurveTo(5, -8, 8, -2, 0, 4);
  c.closePath();
  c.fill();
}
function star4(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y - s); c.quadraticCurveTo(x + s * 0.18, y - s * 0.18, x + s, y);
  c.quadraticCurveTo(x + s * 0.18, y + s * 0.18, x, y + s);
  c.quadraticCurveTo(x - s * 0.18, y + s * 0.18, x - s, y);
  c.quadraticCurveTo(x - s * 0.18, y - s * 0.18, x, y - s);
  c.closePath();
}
function badgeSize(c, s) { const n = bits(c); return n * s + (n - 1) * s * 0.25 + s * 0.7; }
function drawBadge(c2, c, x, y, s) {
  const items = [];
  if (c & 1) items.push(0);
  if (c & 2) items.push(1);
  if (c & 4) items.push(2);
  if (!items.length) return;
  const gap = s * 0.25, w = badgeSize(c, s), h = s * 1.3;
  c2.save();
  c2.fillStyle = 'rgba(255,255,255,0.94)'; c2.strokeStyle = OUT; c2.lineWidth = 1.5; c2.lineJoin = 'round';
  rr(c2, x - w / 2, y - h / 2, w, h, h / 2); c2.fill(); c2.stroke();
  let px = x - w / 2 + s * 0.35 + s / 2;
  const q = s * 0.4;
  for (const it of items) {
    c2.lineWidth = 1.4;
    if (it === 0) { c2.fillStyle = '#e0483a'; c2.beginPath(); c2.moveTo(px, y - q * 1.15); c2.lineTo(px + q * 1.1, y + q * 0.9); c2.lineTo(px - q * 1.1, y + q * 0.9); c2.closePath(); }
    else if (it === 1) { c2.fillStyle = '#2f6fc9'; c2.beginPath(); c2.rect(px - q, y - q, q * 2, q * 2); }
    else { c2.fillStyle = '#ffd23f'; c2.beginPath(); c2.arc(px, y, q * 1.05, 0, TAU); }
    c2.fill(); c2.stroke();
    px += s + gap;
  }
  c2.restore();
}
/* golden duck: polished gold-statue look so it never reads as the plain yellow duck */
function goldBody(c) {
  const q = c.createLinearGradient(-44, 0, 44, 0);
  [[0, '#8a5a0a'], [0.25, '#f7c52b'], [0.45, '#fff8d0'], [0.6, '#f7c52b'], [1, '#7a4c06']].forEach(a => q.addColorStop(a[0], a[1]));
  return q;
}
function drawDuck(c, g, x, y, k, flip, rot, alpha) {
  let body, pc = '#ffffff';
  if (g.rare) body = g.rare === 'gold' ? '#f7c52b' : g.rare === 'night' ? '#2b3a67' : '#fffdf5';
  else { body = COL[g.c].b; pc = COL[g.c].pc; }
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  c.rotate(rot);
  c.scale(flip ? -k : k, k);
  c.translate(0, -4);
  const isG = g.rare === 'gold', tt = clock;
  if (isG) body = goldBody(c);
  c.lineWidth = 4; c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = OUT; c.fillStyle = body;
  c.beginPath(); c.moveTo(-40, -2); c.quadraticCurveTo(-56, -16, -46, -28); c.quadraticCurveTo(-32, -24, -24, -10); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(-4, 10, 40, 26, 0, 0, TAU); c.fill(); c.stroke();
  c.save();
  c.beginPath(); c.ellipse(-4, 10, 37, 23, 0, 0, TAU); c.clip();
  if (g.rare === 'rainbow') {
    const cols = ['#ff6b6b', '#ffb347', '#ffe66b', '#6bd68a', '#5aa9ff', '#b583ff'];
    for (let i = 0; i < 6; i++) { c.fillStyle = cols[i]; c.fillRect(-42 + i * 14, -20, 14, 70); }
  } else if (g.rare === 'night') {
    c.fillStyle = '#fff6b0';
    for (const s of [[-26, 2, 5], [-8, 22, 4], [12, 6, 5], [-16, 18, 3], [22, 24, 3.5]]) { star4(c, s[0], s[1], s[2]); c.fill(); }
  } else if (g.rare === 'gold') {
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.arc(-4, 10, 31, Math.PI * 1.15, Math.PI * 1.6); c.stroke();
  } else {
    c.fillStyle = pc; c.strokeStyle = pc;
    const both = (g.p & 3) === 3;   /* stripes + dots: dots on the back half, stripes on the front half */
    if (g.p & 1) {
      c.save();
      if (both) { c.beginPath(); c.rect(-4, -40, 70, 120); c.clip(); }
      c.lineWidth = 7;
      c.beginPath();
      for (const s of [[-50, 36, -14, -20], [-32, 44, 4, -16], [-14, 48, 22, -8], [4, 50, 40, -4]]) { c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); }
      c.stroke();
      c.restore();
    }
    if (g.p & 2) {
      c.save();
      if (both) { c.beginPath(); c.rect(-70, -40, 66, 120); c.clip(); }
      for (const p of [[-28, 8], [-16, 24], [-2, 6], [10, 22], [20, 8], [-18, -4]]) { c.beginPath(); c.arc(p[0], p[1], 4.5, 0, TAU); c.fill(); }
      c.restore();
    }
  }
  c.restore();
  c.strokeStyle = OUT; c.fillStyle = body; c.lineWidth = 4;
  c.beginPath(); c.arc(22, -16, 19, 0, TAU); c.fill(); c.stroke();
  c.lineWidth = 3.5;
  c.beginPath(); c.moveTo(-20, 12); c.quadraticCurveTo(-6, 0, 10, 13); c.stroke();
  c.fillStyle = g.rare === 'night' ? '#ffffff' : OUT; c.beginPath(); c.arc(29, -21, 3.4, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,138,160,0.55)'; c.beginPath(); c.arc(26, -8, 4.5, 0, TAU); c.fill();
  c.fillStyle = '#ff9a3c'; c.lineWidth = 3; c.strokeStyle = OUT;
  c.beginPath(); c.moveTo(38, -17); c.quadraticCurveTo(55, -18, 53, -9); c.quadraticCurveTo(49, -3, 38, -6); c.closePath(); c.fill(); c.stroke();
  if (g.rare === 'gold') {
    const cg = c.createLinearGradient(0, -48, 0, -30); cg.addColorStop(0, '#fff7c4'); cg.addColorStop(1, '#e9a416'); c.fillStyle = cg;
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(12, -31); c.lineTo(13, -45); c.lineTo(18, -38); c.lineTo(22, -48); c.lineTo(26, -38); c.lineTo(31, -45); c.lineTo(32, -31); c.closePath(); c.fill(); c.stroke();
    const ga = c.globalAlpha;
    c.fillStyle = '#ffffff'; c.strokeStyle = '#d9a82a'; c.lineWidth = 1.2; c.globalAlpha = ga * (0.5 + 0.5 * Math.abs(Math.sin(tt * 3))); star4(c, 33, -40, 6.5); c.fill(); c.stroke(); c.globalAlpha = ga;
  } else if (g.rare === 'night') {
    c.fillStyle = '#fff6b0'; c.lineWidth = 2.5; star4(c, 22, -44, 8); c.fill(); c.stroke();
  } else if (g.rare === 'rainbow') {
    c.lineWidth = 3.5; c.lineCap = 'round';
    const cols = ['#ff6b6b', '#ffe66b', '#5aa9ff'];
    for (let i = 0; i < 3; i++) { c.strokeStyle = cols[i]; c.beginPath(); c.arc(22, -34, 12 - i * 3.6, Math.PI, TAU); c.stroke(); }
  }
  const hv = g.hat !== undefined ? g.hat : (hatDraw ? style.hats : []);
  const hl = Array.isArray(hv) ? hv : [hv];
  if (!g.rare && hl.length) drawHats(c, hl);
  c.restore();
}
/* ducks in the tub: each look (colour, pattern, dress-ups, facing) is drawn once into a small canvas at screen
   resolution and then just stamped every frame (moved / tilted / scaled). Secret ducks are drawn directly (they sparkle). */
const sprites = new Map();
/* window of the cached picture, in duck units around the duck's origin: measured so that every dress-up (and the tallest
   stacks: silk hat + mage, rocket on the back, the long pipe/bubble) stays inside; x -68..80, y -100..44 */
const SPR_X = 68, SPR_Y = 100, SPR_W = 148, SPR_H = 144;
function drawDuckFast(c, g, x, y, k, flip, rot, kBase) {
  if (g.rare) { drawDuck(c, g, x, y, k, flip, rot, 1); return; }
  const m = c.getTransform(), ps = Math.ceil(kBase * Math.hypot(m.a, m.b) * 20) / 20;
  const hats = hatDraw ? style.hats : [], key = g.c + ',' + g.p + ',' + hats.join('+') + ',' + ps;   /* facing is not part of the key: a left-facing duck is the same picture mirrored */
  let spr = sprites.get(key);
  if (spr) { sprites.delete(key); sprites.set(key, spr); }   /* keep the most recently used at the end */
  else {
    if (sprites.size >= 40) sprites.delete(sprites.keys().next().value);   /* drop only the oldest one, never everything at once */
    spr = document.createElement('canvas');
    spr.width = Math.ceil(SPR_W * ps); spr.height = Math.ceil(SPR_H * ps);
    const sc = spr.getContext('2d');
    sc.setTransform(ps, 0, 0, ps, SPR_X * ps, SPR_Y * ps);
    drawDuck(sc, { c: g.c, p: g.p, rare: null, hat: hats }, 0, 0, 1, false, 0, 1);
    sprites.set(key, spr);
  }
  c.save(); c.translate(x, y); c.rotate(rot); if (flip) c.scale(-1, 1);   /* same order as drawDuck: rotate, then mirror */
  c.drawImage(spr, -SPR_X * k, -SPR_Y * k, spr.width / ps * k, spr.height / ps * k);
  c.restore();
}
/* every dress-up has its own spot, so they can all be worn at once: back of the head (ribbon), on the back (flower),
   top of the head (hat, with the crown stacked on top of it), eyes (glasses), chest (star pin) */
/* ---- dress-ups. Duck units: head centre (22,-16) r19, eye (29,-21), cheek (26,-8),
   beak (38,-17)..tip (55,-12)..(38,-6), body centre (-4,10) 40x26 ---- */
/* slot of each dress-up: only one per slot can be worn (picking another one in the same slot swaps it) */
const HAT_SLOT = {
  bcap: 'head', towel: 'head', shampoo: 'head', shower: 'head', straw: 'head', bunny: 'head', awa: 'head', chibi: 'head', knit: 'head', silk: 'head', phones: 'head', muff: 'head', mage: 'head',
  crown: 'top', halo: 'top', tiara: 'top', hearttop: 'top', onpu: 'top', ribbon: 'top', hibis: 'top', bigribbon: 'top', starpin: 'top',
  glass: 'eyes', sun: 'eyes', goggle: 'eyes', lash: 'eyes', heartsun: 'eyes', mono: 'eyes', patch: 'eyes', patchw: 'eyes', colorcon: 'eyes',
  hige: 'mouth', santa: 'mouth', mask: 'mouth', pipe: 'mouth', bubble: 'mouth', lip: 'mouth', pacif: 'mouth', chheart: 'mouth', chstar: 'mouth', band: 'mouth',
  bowtie: 'neck', necktie: 'neck', scarf: 'neck', pearl: 'neck', choker: 'neck', bib: 'neck', bell: 'neck', lei: 'neck',
  star: 'neck', hbadge: 'neck', hanabadge: 'neck', medal: 'neck', brooch: 'neck', nafuda: 'neck', zekken: 'neck', wappen: 'neck', apron: 'neck',
  flower: 'back', wings: 'back', cape: 'back', pack: 'back', bat: 'back', koura: 'back', butterfly: 'back', randoseru: 'back', rocket: 'back',
  float: 'waist', donut: 'waist', hula: 'waist', tutu: 'waist', wtowel: 'waist', belt: 'waist', skirt: 'waist', tailribbon: 'waist', pochette: 'waist'
};
/* where each one is worn on the duck (used to zoom the thumbnail and for the lift); the three toppers live in おまけ */
const HAT_REGION = Object.assign({}, HAT_SLOT, { chibi: 'top', bunny: 'top', mage: 'top', hibis: 'head' });
/* the picker part each one belongs to: one item per part */
const GROUP_OF = { head: 'head', top: 'top', eyes: 'eyes', mouth: 'mouth', neck: 'mouth', back: 'body', waist: 'body' };
for (const k in HAT_SLOT) HAT_SLOT[k] = GROUP_OF[HAT_REGION[k]];
/* draw order: things on the back first, things on top of the head last */
const HAT_ORDER = ['cape', 'koura', 'butterfly', 'wings', 'bat', 'rocket', 'randoseru', 'pack', 'flower',
  'float', 'donut', 'hula', 'tutu', 'wtowel', 'skirt', 'belt', 'tailribbon', 'apron', 'zekken',
  'scarf', 'necktie', 'bowtie', 'pearl', 'choker', 'bib', 'bell', 'lei', 'pochette',
  'star', 'hbadge', 'hanabadge', 'medal', 'brooch', 'nafuda', 'wappen',
  'chheart', 'chstar', 'band', 'ribbon', 'bigribbon', 'starpin', 'hibis',
  'towel', 'shower', 'straw', 'bunny', 'knit', 'silk', 'awa', 'chibi', 'mage', 'bcap', 'shampoo',
  'colorcon', 'lash', 'glass', 'sun', 'goggle', 'heartsun', 'mono', 'patch', 'patchw',
  'phones', 'muff', 'hige', 'santa', 'mask', 'pipe', 'bubble', 'lip', 'pacif', 'crown', 'halo', 'tiara', 'hearttop', 'onpu'];
/* how far the things floating above the head have to go up to clear each head dress-up */
const TOP_LIFT = { bcap: -12, towel: -10, shower: -9, straw: -8, bunny: -6, shampoo: -2, awa: -8, chibi: -16, knit: -12, silk: -24, phones: -4, muff: -4, mage: -24 };
/* only these float above whatever is on the head */
const LIFTED = { crown: 1, halo: 1, tiara: 1, hearttop: 1, onpu: 1, chibi: 1, bunny: 1, mage: 1 };
function drawHats(c, list) {
  let lift = 0;
  for (const id of list) if (TOP_LIFT[id] !== undefined && HAT_REGION[id] === 'head') lift = Math.min(lift, TOP_LIFT[id]);
  for (const id of HAT_ORDER) if (list.includes(id)) drawHat(c, id, LIFTED[id] ? lift : 0);
}
const dot = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const dotS = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); };
function heartPath(c, x, y, s) { c.beginPath(); c.moveTo(x, y + s * 0.9); c.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4); c.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.5, y - s * 0.1, x, y + s * 0.9); c.closePath(); }
function star5Path(c, x, y, R, r, rot) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = (rot || 0) - Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
function drawHatNew(c, id) {
  /* ---------- head ---------- */
  if (id === 'towel') { /* folded bath towel on the head, onsen style */
    c.save(); c.translate(22, -36); c.rotate(-0.12);
    c.fillStyle = '#ffffff'; rr(c, -15, -6, 30, 12, 4); c.fill(); c.stroke();
    c.strokeStyle = '#8fd3f0'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-11, -2.5); c.lineTo(11, -2.5); c.moveTo(-11, 2.5); c.lineTo(11, 2.5); c.stroke();
    c.restore();
  } else if (id === 'shampoo') { /* shampoo hat: a soft ring around the head (the head shows through the hole) */
    c.save(); c.translate(22, -30); c.rotate(-0.08);
    c.beginPath(); c.ellipse(0, 0, 28, 8, 0, 0, TAU); c.ellipse(0, -1, 17, 4.2, 0, 0, TAU);
    c.fillStyle = '#8fd8ff'; c.fill('evenodd'); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 3.5, 22, 3.6, 0, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.restore();
  } else if (id === 'shower') { /* frilly shower cap */
    c.fillStyle = '#ffc4dc';
    c.beginPath(); c.moveTo(3, -24); c.bezierCurveTo(4, -46, 40, -46, 41, -24); c.closePath(); c.fill(); c.stroke();
    for (let i = 0; i < 7; i++) dotS(c, 4 + i * 6.1, -24, 3.6);
    c.fillStyle = '#ffffff'; for (const [x, y] of [[14, -35], [26, -38], [32, -31], [20, -30]]) dot(c, x, y, 1.8);
  } else if (id === 'straw') { /* straw hat with a red band */
    c.fillStyle = '#f3d27a';
    c.beginPath(); c.ellipse(22, -33, 28, 6.5, -0.05, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(10, -34); c.bezierCurveTo(10, -52, 34, -52, 34, -34); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e0483a'; c.beginPath(); c.moveTo(10.4, -38); c.lineTo(33.6, -38); c.lineTo(34, -34); c.lineTo(10, -34); c.closePath(); c.fill(); c.lineWidth = 1.8; c.stroke();
  } else if (id === 'bunny') { /* bunny ears */
    for (const [x, rot] of [[14, -0.25], [29, 0.15]]) {
      c.save(); c.translate(x, -34); c.rotate(rot);
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(0, -10, 5.5, 13, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#ffb3cc'; c.beginPath(); c.ellipse(0, -10, 2.6, 9, 0, 0, TAU); c.fill();
      c.restore();
    }
  } else if (id === 'awa') { /* a heap of soap foam on the head, with a few bubbles drifting off */
    c.fillStyle = '#ffffff'; c.strokeStyle = '#7fb8d6'; c.lineWidth = 2;
    for (const [x, y, r] of [[8, -30, 6], [36, -30, 6], [14, -36, 8], [30, -36, 7.5], [22, -41, 8.5]]) dotS(c, x, y, r);
    c.fillStyle = '#ffffff'; for (const [x, y, r] of [[8, -30, 4.8], [36, -30, 4.8], [14, -36, 6.8], [30, -36, 6.3]]) dot(c, x, y, r);
    c.fillStyle = 'rgba(190,235,250,0.5)'; c.lineWidth = 1.6;
    for (const [x, y, r] of [[44, -44, 3.6], [50, -36, 2.4], [-2, -40, 2.8]]) dotS(c, x, y, r);
  } else if (id === 'chibi') { /* a tiny rubber duck riding on the head */
    c.fillStyle = '#ffd23f'; c.lineWidth = 2.4;
    c.beginPath(); c.ellipse(19, -40, 10, 6.5, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(10, -42); c.lineTo(6, -47); c.lineTo(13, -45); c.closePath(); c.fill(); c.stroke();
    dotS(c, 26, -47, 6);
    c.fillStyle = '#ff9a3c'; c.beginPath(); c.moveTo(31, -48); c.lineTo(37, -46.5); c.lineTo(31, -44.5); c.closePath(); c.fill(); c.lineWidth = 1.8; c.stroke();
    c.fillStyle = OUT; dot(c, 28, -48.5, 1.3);
  } else if (id === 'knit') { /* knitted beanie with a pompom */
    c.fillStyle = '#e0475b';
    c.beginPath(); c.moveTo(3, -25); c.bezierCurveTo(4, -50, 40, -50, 41, -25); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; rr(c, 2, -29, 40, 7, 3); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.6; c.beginPath(); for (const x of [12, 22, 32]) { c.moveTo(x, -31); c.lineTo(x, -43); } c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.fillStyle = '#ffffff'; dotS(c, 22, -47, 5.5);
  } else if (id === 'silk') { /* black top hat */
    c.fillStyle = '#3a3a4a';
    c.beginPath(); c.ellipse(22, -33, 19, 4.5, 0, 0, TAU); c.fill(); c.stroke();
    rr(c, 11, -58, 22, 26, 3); c.fill(); c.stroke();
    c.fillStyle = '#e0475b'; c.fillRect(11.5, -40, 21, 5); c.lineWidth = 1.6; c.strokeRect(11.5, -40, 21, 5);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(15, -54); c.lineTo(15, -43); c.stroke();
  } else if (id === 'muff') { /* fluffy earmuffs */
    c.lineWidth = 6.5; c.beginPath(); c.moveTo(14, -25); c.bezierCurveTo(5, -28, 6, -37.5, 22, -38); c.stroke();
    c.lineWidth = 4; c.strokeStyle = '#7fd9b0'; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2.2; c.fillStyle = '#ffd6e4';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; dotS(c, 14 + Math.cos(a) * 5.5, -16 + Math.sin(a) * 6.5, 3.4); }
    c.fillStyle = '#ffd6e4'; dot(c, 14, -16, 6); c.fillStyle = '#ffffff'; dot(c, 12, -18, 1.8);
  } else if (id === 'phones') { /* black headphones: the band stops at the crown of the head; a boom mic runs from below the ear cup to the mouth */
    c.lineWidth = 7; c.beginPath(); c.moveTo(14, -25); c.bezierCurveTo(5, -28, 6, -37.5, 22, -38); c.stroke();
    c.lineWidth = 3.6; c.strokeStyle = '#3a3a4a'; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 4.6; c.beginPath(); c.moveTo(14, -10); c.quadraticCurveTo(12, 3, 28, 0.5); c.stroke();
    c.lineWidth = 2; c.strokeStyle = '#8a8a9a'; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.fillStyle = '#3a3a4a'; c.beginPath(); c.ellipse(32.5, -0.5, 5, 3.7, -0.3, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(31.2, -1.9, 1.8, 0.9, -0.3, 0, TAU); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.fillStyle = '#3a3a4a'; rr(c, 7, -25, 14, 18, 6); c.fill(); c.stroke();
    c.fillStyle = '#6b6b7b'; rr(c, 10, -21, 8, 10, 3); c.fill();
    c.fillStyle = '#7fd9b0'; dot(c, 14, -16, 1.8);
  } else if (id === 'halo') { /* floating golden ring */
    c.save(); c.translate(22, -45);
    c.lineWidth = 7; c.strokeStyle = OUT; c.beginPath(); c.ellipse(0, 0, 13, 4, 0, 0, TAU); c.stroke();
    c.lineWidth = 4; c.strokeStyle = '#ffd23f'; c.stroke();
    c.restore();
  } else if (id === 'tiara') { /* tiara: low spiky band (unlike the tall crown) with gems */
    c.fillStyle = '#e4ecf2'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(9, -31); c.lineTo(12, -39); c.lineTo(17, -35); c.lineTo(22, -45); c.lineTo(27, -35); c.lineTo(32, -39); c.lineTo(35, -31); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ff7aa8'; dotS(c, 22, -38, 3); c.fillStyle = '#8fd8ff'; dotS(c, 13.5, -35, 1.8); dotS(c, 30.5, -35, 1.8);
    c.fillStyle = '#ffffff'; for (const x of [16, 19, 25, 28]) dot(c, x, -32.5, 1.2);
    c.fillStyle = '#ffd23f'; dot(c, 22, -45.5, 1.6); dot(c, 12, -39.5, 1.2); dot(c, 32, -39.5, 1.2);
  } else if (id === 'hearttop') { /* a little heart floating above */
    c.fillStyle = '#ff7aa8'; c.lineWidth = 2.4; heartPath(c, 22, -46, 7); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.8)'; dot(c, 18.5, -48.5, 1.6);
  /* ---------- hair (back of the head) ---------- */
  } else if (id === 'hibis') { /* hibiscus behind the head */
    c.save(); c.translate(7, -28); c.fillStyle = '#ff5d7a'; c.lineWidth = 2.2;
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; c.beginPath(); c.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 5.5, 4, a, 0, TAU); c.fill(); c.stroke(); }
    c.fillStyle = '#ffd23f'; dotS(c, 0, 0, 2.8); c.restore();
  } else if (id === 'bigribbon') { /* big polka-dot ribbon */
    c.save(); c.translate(8, -33); c.rotate(-0.35); c.fillStyle = '#ff7aa8'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-8, -16, -22, -8, -14, 4); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(8, -16, 22, -8, 14, 4); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-2, 2); c.lineTo(-7, 14); c.lineTo(-3, 13); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; for (const [x, y] of [[-11, -4], [-7, -9], [11, -4], [7, -9]]) dot(c, x, y, 1.4);
    c.fillStyle = '#ffb3cc'; dotS(c, 0, 0, 4); c.restore();
  } else if (id === 'starpin') { /* sparkly hair pins */
    c.lineWidth = 2;
    c.fillStyle = '#ffd23f'; star5Path(c, 8, -30, 5.5, 2.4, 0.2); c.fill(); c.stroke();
    c.fillStyle = '#ff7aa8'; heartPath(c, 15, -37, 3.6); c.fill(); c.stroke();
    c.fillStyle = '#8fd8ff'; star5Path(c, 4, -38, 3.6, 1.6, -0.2); c.fill(); c.stroke();
  /* ---------- eyes ---------- */
  } else if (id === 'sun') { /* sunglasses */
    c.lineWidth = 2.6; c.fillStyle = '#3a3a4a';
    rr(c, 24, -27, 14, 11, 4); c.fill(); c.stroke();
    rr(c, 8.5, -27, 14, 11, 4); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(22.5, -23); c.lineTo(24, -23); c.moveTo(8.5, -22); c.lineTo(3.5, -18); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(27, -24); c.lineTo(30, -21); c.moveTo(11.5, -24); c.lineTo(14.5, -21); c.stroke();
  } else if (id === 'goggle') { /* swim goggles: two lenses like the glasses, strap round the head */
    c.lineWidth = 5; c.beginPath(); c.moveTo(9, -21); c.lineTo(2, -17); c.stroke();
    c.lineWidth = 2.6; c.strokeStyle = '#2f6fc9'; c.stroke();
    c.strokeStyle = OUT; c.fillStyle = 'rgba(160,220,250,0.75)'; c.lineWidth = 2.8;
    c.beginPath(); c.ellipse(31, -21, 7, 6, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(15.5, -21, 7, 6, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(22.5, -22); c.lineTo(24, -22); c.stroke();
    c.strokeStyle = '#2f6fc9'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(31, -21, 5, 4, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(15.5, -21, 5, 4, 0, 0, TAU); c.stroke();
    c.fillStyle = '#ffffff'; dot(c, 29, -23.5, 1.5); dot(c, 13.5, -23.5, 1.5);
  } else if (id === 'lash') { /* long lashes and a dash of pink eyeshadow */
    c.strokeStyle = 'rgba(255,122,168,0.6)'; c.lineWidth = 3.5; c.beginPath(); c.arc(29, -21, 5.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1.8; c.beginPath();
    for (const a of [1.15, 1.35, 1.55, 1.75]) { const x = 29 + Math.cos(a * Math.PI) * 4.4, y = -21 + Math.sin(a * Math.PI) * 4.4; c.moveTo(x, y); c.lineTo(29 + Math.cos(a * Math.PI) * 8, -21 + Math.sin(a * Math.PI) * 8); }
    c.stroke();
  } else if (id === 'heartsun') { /* heart-shaped pink sunglasses */
    c.lineWidth = 2.4; c.fillStyle = '#ff5d9a';
    heartPath(c, 31, -21, 6.2); c.fill(); c.stroke(); heartPath(c, 15.5, -21, 6.2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(22.5, -22); c.lineTo(24.5, -22); c.moveTo(8.5, -21); c.lineTo(3.5, -17); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)'; dot(c, 28.5, -23, 1.4); dot(c, 13, -23, 1.4);
  } else if (id === 'mono') { /* monocle on a chain */
    c.strokeStyle = '#c99400'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(25, -15); c.quadraticCurveTo(18, -2, 24, 6); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 3.4; c.fillStyle = 'rgba(255,255,255,0.35)'; dotS(c, 29.5, -21, 6.8);
    c.strokeStyle = '#ffd23f'; c.lineWidth = 1.6; c.beginPath(); c.arc(29.5, -21, 6.8, 0, TAU); c.stroke();
  /* ---------- beak ---------- */
  } else if (id === 'hige') { /* curled moustache: sits low under the beak so the beak stays visible, only the back-side lobe */
    c.fillStyle = '#5a3a24'; c.lineWidth = 2.2;
    c.save(); c.translate(0, 7); c.translate(37, -3); c.scale(1.15, 1.15); c.translate(-37, 3);
    c.beginPath(); c.moveTo(37, -10); c.bezierCurveTo(33, -3, 22, -2, 21, -9); c.bezierCurveTo(21, -13, 26, -14, 27, -11); c.bezierCurveTo(29, -8, 33, -9, 37, -13); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(28, -8, 3, 1.4, -0.3, 0, TAU); c.fill();
    c.restore();
  } else if (id === 'santa') { /* Santa-style fluffy white beard: a bushy cloud under the beak that rolls down over the chest */
    c.translate(30, -2); c.scale(1.2, 1.2); c.translate(-30, 2);
    const bl = [[33, -1, 5.2], [27, -2, 6], [20, -2, 5.4], [14, 2.5, 6.4], [22, 4, 7], [30, 4, 6], [36, 3.5, 4.4], [13, 10.5, 6.2], [20, 12, 7.4], [28, 12, 6.6], [34, 10, 4.6], [17, 19, 6], [25, 20, 6.6], [31, 17.5, 4.6], [22, 26.5, 5]];
    c.fillStyle = OUT; for (const b of bl) dot(c, b[0], b[1], b[2] + 1.5);
    c.fillStyle = '#ffffff'; for (const b of bl) dot(c, b[0], b[1], b[2]);
    c.strokeStyle = '#c5d3db'; c.lineWidth = 1.5; c.lineCap = 'round';
    for (const [x, y, r, a0, a1] of [[20, 8, 3.6, 0.9, 1.95], [29.5, 8.5, 3.2, 0.1, 1.2], [15.5, 15.5, 3.2, 0.9, 1.95], [24, 17, 3.6, 0.1, 1.2], [31, 14.5, 2.6, 0.9, 1.9], [22, 24, 2.8, 0.2, 1.3], [26, 1, 2.8, 0.9, 1.9]]) { c.beginPath(); c.arc(x, y, r, Math.PI * a0, Math.PI * a1 + Math.PI * 0.4); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.9)'; dot(c, 34, -3, 1.2);
  } else if (id === 'mask') { /* mask over the base of the beak; one ear loop from its top corner round to its bottom corner */
    c.translate(7, 3);
    c.lineWidth = 1.8; c.beginPath(); c.moveTo(36, -17); c.bezierCurveTo(26, -19, 16, -17, 16, -12); c.bezierCurveTo(16, -7, 26, -7, 36, -8); c.stroke();
    c.lineWidth = 2.6; c.fillStyle = '#ffffff'; rr(c, 35, -19, 15, 14, 5); c.fill(); c.stroke();
    c.strokeStyle = '#b9c6cd'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(38, -14.5); c.lineTo(47, -14.5); c.moveTo(38, -10); c.lineTo(47, -10); c.stroke();
  } else if (id === 'bubble') { /* soap-bubble pipe */
    c.lineWidth = 2.2; c.strokeStyle = OUT; c.fillStyle = '#ffd23f';
    c.save(); c.translate(50, -11); c.rotate(-0.6); rr(c, -1, -2, 15, 4, 2); c.fill(); c.stroke(); c.restore();
    c.fillStyle = 'rgba(190,235,250,0.45)'; c.strokeStyle = '#7fb8d6'; c.lineWidth = 1.8;
    dotS(c, 64, -24, 6); dotS(c, 72, -36, 4); dotS(c, 66, -44, 2.6);
    c.fillStyle = '#ffffff'; dot(c, 62, -26, 1.6);
  } else if (id === 'lip') { /* glossy pink beak */
    c.fillStyle = '#ff7aa8'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(38, -17); c.quadraticCurveTo(55, -18, 53, -9); c.quadraticCurveTo(49, -3, 38, -6); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(42, -14); c.quadraticCurveTo(47, -15, 49, -13); c.stroke();
    c.fillStyle = '#ffffff'; dot(c, 51, -10, 1);
  } else if (id === 'pacif') { /* baby pacifier */
    c.fillStyle = '#9be3c3'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(51, -11, 3, 7.5, 0, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = '#ff7aa8'; c.lineWidth = 2.6; c.beginPath(); c.arc(57, -11, 4.5, 0, TAU); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath(); c.arc(57, -11, 6, 0, TAU); c.arc(57, -11, 3, 0, TAU); c.stroke();
  /* ---------- cheek ---------- */

  } else if (id === 'patch') { /* black pirate eye patch: one strap running from the upper right down to the lower left */
    c.lineWidth = 2.6; c.beginPath(); c.moveTo(38, -31.5); c.lineTo(8, -3); c.stroke();
    c.fillStyle = '#2f2f3a'; c.lineWidth = 2.4; c.beginPath(); c.ellipse(29.5, -21, 7.2, 6.2, -0.76, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(27.2, -23.6, 2.2, 1.1, -0.76, 0, TAU); c.fill();
  } else if (id === 'patchw') { /* white medical eye patch: a square gauze pad with two bands */
    c.lineWidth = 2; c.beginPath(); c.moveTo(22.5, -26); c.lineTo(11, -33); c.moveTo(22.5, -17); c.lineTo(3, -14); c.stroke();
    c.save(); c.translate(29.5, -21); c.rotate(-0.1);
    c.fillStyle = '#ffffff'; c.lineWidth = 2.4; rr(c, -7.5, -8, 15, 16, 2.4); c.fill(); c.stroke();
    c.strokeStyle = '#d6dee3'; c.lineWidth = 1.2; rr(c, -4.6, -5, 9.2, 10, 1.2); c.stroke();
    c.restore();
  } else if (id === 'colorcon') { /* sparkly colour contacts: big shining eyes */
    c.fillStyle = '#7a4fd6'; c.lineWidth = 1.6; dotS(c, 29, -21, 5.2);
    c.fillStyle = '#b79cff'; dot(c, 29, -19.5, 3);
    c.fillStyle = '#ffffff'; star4(c, 27.4, -23, 2.4); c.fill(); dot(c, 31, -18.5, 1.1);
  } else if (id === 'mage') { /* lord-style topknot: wrapped in white from the root to about halfway, the tip a black pompom-like tuft that flares out */
    const qp = t => { const m = 1 - t; return [m * m * 14 + 2 * m * t * 14 + t * t * 25, m * m * -33 + 2 * m * t * -50 + t * t * -53]; };
    c.fillStyle = '#3a3a4a'; c.lineWidth = 2.4;
    c.beginPath(); c.ellipse(13, -31, 10, 5, -0.4, 0, TAU); c.fill(); c.stroke();
    c.lineWidth = 9; c.strokeStyle = OUT; c.beginPath(); c.moveTo(14, -33); c.quadraticCurveTo(14, -50, 25, -53); c.stroke();
    c.lineWidth = 5.5; c.strokeStyle = '#3a3a4a'; c.stroke();
    const part = (w, col) => { c.beginPath(); for (let i = 0; i <= 12; i++) { const q = qp(0.04 + 0.58 * i / 12); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); } c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
    part(11, OUT); part(8, '#ffffff');
    c.strokeStyle = '#aebcc4'; c.lineWidth = 1.3; c.beginPath();
    for (const t of [0.12, 0.23, 0.34, 0.45, 0.56]) { const a = qp(t), b = qp(t + 0.02), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * 3.7, ny = dx / l * 3.7; c.moveTo(a[0] - nx, a[1] - ny - 0.6); c.lineTo(a[0] + nx, a[1] + ny + 0.6); }
    c.stroke();
    const tuft = [[24.5, -55, 5.6], [30.5, -53.2, 5], [27.5, -60, 5.4], [21.2, -59.5, 4.4], [32, -59, 3.8], [21.5, -50.5, 3.6]];
    c.fillStyle = OUT; for (const t of tuft) dot(c, t[0], t[1], t[2] + 1.5);
    c.fillStyle = '#3a3a4a'; for (const t of tuft) dot(c, t[0], t[1], t[2]);
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(25, -60, 3, 1.6, -0.5, 0, TAU); c.fill();
  } else if (id === 'bcap') { /* baseball cap worn backwards: the peak points to the tail */
    c.fillStyle = '#e0475b'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(10, -30); c.quadraticCurveTo(-6, -32, -10, -26); c.quadraticCurveTo(-2, -23, 10, -26); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(4, -27); c.bezierCurveTo(5, -50, 38, -50, 38, -27); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; dotS(c, 21, -44.5, 2.4);
    c.fillStyle = '#ffd6dd'; rr(c, 27, -33, 9, 5, 2.5); c.fill(); c.lineWidth = 1.6; c.stroke();
  } else if (id === 'chheart') { /* heart sticker on the cheek */
    c.fillStyle = '#ff5d9a'; c.lineWidth = 1.6; heartPath(c, 25, -8, 4.6); c.fill(); c.stroke();
  } else if (id === 'chstar') { /* glitter star stickers */
    c.lineWidth = 1.4; c.fillStyle = '#ffd23f'; star5Path(c, 24, -8, 4.6, 2, 0.2); c.fill(); c.stroke();
    c.fillStyle = '#ff9ec1'; star5Path(c, 31, -4, 2.8, 1.2, 0); c.fill(); c.stroke();
    c.fillStyle = '#8fd8ff'; dot(c, 19, -4, 1.2);
  } else if (id === 'band') { /* sticking plaster */
    c.save(); c.translate(24, -8); c.rotate(-0.4); c.lineWidth = 1.8; c.fillStyle = '#f5d2a8'; rr(c, -7, -3, 14, 6, 3); c.fill(); c.stroke();
    c.fillStyle = '#e8b47e'; rr(c, -2.5, -2, 5, 4, 1); c.fill(); c.restore();
  /* ---------- neck ---------- */
  } else if (id === 'bowtie') { /* red bow tie with dots under the head */
    c.save(); c.translate(17, 1); c.rotate(-0.15); c.fillStyle = '#e0475b'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-11, -6); c.lineTo(-11, 6); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(11, -6); c.lineTo(11, 6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; for (const [x, y] of [[-7, -1.5], [-6, 2.5], [7, -1.5], [6, 2.5]]) dot(c, x, y, 1.1);
    c.fillStyle = '#ff8fa3'; dotS(c, 0, 0, 3.4);
    c.restore();
  } else if (id === 'scarf') { /* striped scarf with a hanging end */
    c.fillStyle = '#6ec0f2'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(4, -6); c.quadraticCurveTo(22, 4, 40, -6); c.lineTo(40, 1); c.quadraticCurveTo(22, 11, 4, 1); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(8, 2); c.lineTo(2, 17); c.lineTo(10, 18); c.lineTo(14, 4); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.moveTo(18, 1.5); c.lineTo(17, 7.5); c.moveTo(28, 1); c.lineTo(28.5, 7); c.stroke();
  } else if (id === 'pearl') { /* pearl necklace */
    c.fillStyle = '#fffaf0'; c.lineWidth = 1.4;
    for (let i = 0; i <= 8; i++) { const t = i / 8, x = 5 + 32 * t, y = -3 + Math.sin(t * Math.PI) * 7; dotS(c, x, y, 2.5); }
    c.fillStyle = '#ffb3cc'; dotS(c, 21, 6.5, 3.4);
  } else if (id === 'bib') { /* baby bib */
    c.fillStyle = '#ffffff'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(6, -4); c.quadraticCurveTo(21, 2, 36, -4); c.quadraticCurveTo(38, 14, 21, 17); c.quadraticCurveTo(4, 14, 6, -4); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#ff9ec1'; c.lineWidth = 2; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(9, 2); c.quadraticCurveTo(21, 20, 33, 2); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#ffd23f'; c.strokeStyle = OUT; c.lineWidth = 1.2; dotS(c, 21, 7, 2.6);
  } else if (id === 'bell') { /* collar with a little bell */
    c.lineWidth = 6; c.beginPath(); c.moveTo(5, -4); c.quadraticCurveTo(21, 6, 38, -5); c.stroke();
    c.lineWidth = 3.4; c.strokeStyle = '#e0475b'; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2; c.fillStyle = '#ffd23f'; dotS(c, 21, 5, 4.6);
    c.beginPath(); c.moveTo(21, 6); c.lineTo(21, 9.5); c.moveTo(17, 4); c.lineTo(25, 4); c.stroke();
  } else if (id === 'lei') { /* Hawaiian flower lei */
    const cols = ['#ff7aa8', '#ffd23f', '#ffffff', '#b79cff', '#ff9a3c'];
    c.lineWidth = 1.4;
    for (let i = 0; i <= 7; i++) { const t = i / 7, x = 5 + 32 * t, y = -3 + Math.sin(t * Math.PI) * 8; c.fillStyle = cols[i % 5]; dotS(c, x, y, 3.6); c.fillStyle = '#ffffff'; dot(c, x, y, 1); }
  /* ---------- chest ---------- */
  } else if (id === 'hbadge') { /* heart badge */
    c.fillStyle = '#ff5d9a'; c.lineWidth = 2.4; heartPath(c, 20, 16, 7); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.8)'; dot(c, 16.5, 13, 1.7);
  /* ---------- back ---------- */
  } else if (id === 'wings') { /* soft, round angel wing growing back towards the tail, with curly feathers */
    c.fillStyle = '#ffffff'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(4, -4);
    c.bezierCurveTo(-4, -22, -22, -26, -34, -20); c.bezierCurveTo(-40, -16, -38, -10, -32, -10);
    c.bezierCurveTo(-34, -4, -28, 0, -22, -2); c.bezierCurveTo(-22, 4, -14, 6, -8, 2); c.bezierCurveTo(-4, 6, 2, 4, 4, -4); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(74,58,48,0.45)'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(-30, -15, 3, 0.2, Math.PI * 1.6); c.moveTo(-14, -12); c.quadraticCurveTo(-20, -8, -18, -2); c.moveTo(-4, -10); c.quadraticCurveTo(-8, -4, -6, 1); c.stroke();
  } else if (id === 'cape') { /* hero cape covering the whole back, from the neck to the tail and down the sides */
    c.fillStyle = '#e0475b'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(12, -10); c.quadraticCurveTo(-14, -35, -44, -11);
    c.quadraticCurveTo(-53, 4, -46, 17); c.lineTo(-41, 24); c.lineTo(-34, 18); c.lineTo(-27, 26); c.lineTo(-19, 19); c.lineTo(-11, 27); c.lineTo(-3, 19); c.lineTo(4, 25);
    c.quadraticCurveTo(10, 8, 12, -10); c.closePath(); c.fill(); c.stroke();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(0,0,0,0.14)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-22, -14); c.quadraticCurveTo(-26, 4, -27, 26); c.moveTo(-5, -12); c.quadraticCurveTo(-8, 6, -11, 27); c.moveTo(-39, -2); c.quadraticCurveTo(-39, 10, -41, 24); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -20); c.quadraticCurveTo(-22, -26, -38, -10); c.stroke();
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = 2.2; c.fillStyle = '#ffd23f'; dotS(c, 11, -3, 3.4);
  } else if (id === 'pack') { /* little backpack */
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(-6, -12); c.quadraticCurveTo(6, -10, 10, 0); c.stroke();
    c.fillStyle = '#ff9a3c'; c.lineWidth = 2.6; rr(c, -24, -22, 20, 17, 5); c.fill(); c.stroke();
    c.fillStyle = '#ffc47a'; rr(c, -24, -22, 20, 7, 4); c.fill(); c.stroke();
    c.fillStyle = '#ffd23f'; dotS(c, -14, -15, 1.8);
  } else if (id === 'bat') { /* jagged bat wing growing back towards the tail */
    c.fillStyle = '#5a3fb0'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(4, -4); c.quadraticCurveTo(-12, -26, -40, -24);
    c.quadraticCurveTo(-36, -16, -34, -10); c.quadraticCurveTo(-28, -14, -24, -6); c.quadraticCurveTo(-18, -10, -14, -1); c.quadraticCurveTo(-8, -6, -4, 3); c.quadraticCurveTo(0, 0, 4, -4); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(2, -6); c.lineTo(-34, -21); c.moveTo(-6, -10); c.lineTo(-24, -7); c.stroke();
  } else if (id === 'float') { /* swim ring: thicker tube, smaller radius so it hugs the duck. the back half shows only outside the body, the front half over it */
    const RX = 43, RY = 12, CY = 20, OW = 18, IW = 13.6;
    c.save(); c.lineCap = 'butt';
    c.save(); c.beginPath(); c.rect(-200, -200, 400, 400); c.moveTo(36, 10); c.ellipse(-4, 10, 40, 26, 0, 0, TAU); c.clip('evenodd');
    c.lineWidth = OW; c.strokeStyle = OUT; c.beginPath(); c.ellipse(-4, CY, RX, RY, 0, Math.PI, TAU); c.stroke();
    c.lineWidth = IW; c.strokeStyle = '#ffffff'; c.stroke(); c.strokeStyle = '#ff7a8a'; c.setLineDash([12.4, 12.4]); c.stroke(); c.setLineDash([]);
    c.restore();
    c.lineWidth = OW; c.strokeStyle = OUT; c.beginPath(); c.ellipse(-4, CY, RX, RY, 0, -0.02, Math.PI + 0.02); c.stroke();
    c.lineWidth = IW; c.strokeStyle = '#ffffff'; c.stroke(); c.strokeStyle = '#ff7a8a'; c.setLineDash([12.4, 12.4]); c.stroke(); c.setLineDash([]);
    c.lineWidth = 2.2; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(-4, CY + 1.2, RX - 1, RY - 3.2, 0, 0.2 * Math.PI, 0.55 * Math.PI); c.stroke();
    c.restore();
  } else if (id === 'donut') { /* donut ring with icing: the duck sits in it. the back half shows only outside the body, the front half over it */
    c.save(); c.lineCap = 'butt';
    c.save(); c.beginPath(); c.rect(-200, -200, 400, 400); c.moveTo(36, 10); c.ellipse(-4, 10, 40, 26, 0, 0, TAU); c.clip('evenodd');
    c.lineWidth = 13; c.strokeStyle = OUT; c.beginPath(); c.ellipse(-4, 20, 52, 13, 0, Math.PI, TAU); c.stroke();
    c.lineWidth = 9; c.strokeStyle = '#e8a35a'; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#ff9ec1'; c.stroke();
    c.restore();
    c.lineWidth = 13; c.strokeStyle = OUT; c.beginPath(); c.ellipse(-4, 20, 52, 13, 0, -0.02, Math.PI + 0.02); c.stroke();
    c.lineWidth = 9; c.strokeStyle = '#e8a35a'; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#ff9ec1'; c.beginPath(); c.ellipse(-4, 18.5, 52, 13, 0, 0.03 * Math.PI, 0.97 * Math.PI); c.stroke(); const sp = ['#ffffff', '#8fd8ff', '#ffd23f', '#7fd9b0']; for (let i = 0; i < 10; i++) { const a = (0.1 + i * 0.085) * Math.PI, x = -4 + Math.cos(a) * 52, y = 18.5 + Math.sin(a) * 13; c.strokeStyle = sp[i % 4]; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x - 1.5, y - 1); c.lineTo(x + 1.5, y + 1); c.stroke(); }
    c.restore();
  } else if (id === 'hula') { /* grass skirt */
    c.lineWidth = 2.2;
    for (let i = 0; i < 15; i++) { const t = 0.08 + i * 0.06, x = -4 + Math.cos(t * Math.PI) * 38, y = 18 + Math.sin(t * Math.PI) * 9; c.strokeStyle = OUT; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (i % 2 ? 1.5 : -1.5), y + 11); c.stroke(); c.strokeStyle = i % 2 ? '#7fd98a' : '#35a868'; c.lineWidth = 2.2; c.stroke(); }
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.fillStyle = '#e8a35a'; c.beginPath(); c.ellipse(-4, 19, 39, 8, 0, 0.05 * Math.PI, 0.95 * Math.PI); c.lineWidth = 5; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#e8a35a'; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1.8; c.fillStyle = '#ff5d7a'; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; dotS(c, 18 + Math.cos(a) * 3, 25 + Math.sin(a) * 3, 2.4); }
  } else if (id === 'tutu') { /* frilly ballet tutu */
    c.fillStyle = '#ffc4dc'; c.lineWidth = 2;
    for (let i = 0; i < 11; i++) { const t = 0.06 + i * 0.088, x = -4 + Math.cos(t * Math.PI) * 42, y = 20 + Math.sin(t * Math.PI) * 10; dotS(c, x, y, 6); }
    c.fillStyle = '#ffffff'; for (let i = 0; i < 11; i++) { const t = 0.06 + i * 0.088, x = -4 + Math.cos(t * Math.PI) * 42, y = 20 + Math.sin(t * Math.PI) * 10; dot(c, x - 1.5, y - 1.5, 1.2); }
  } else if (id === 'onpu') { /* music notes floating above */
    c.fillStyle = '#35505f'; c.lineWidth = 2.2;
    for (const [x, y, k] of [[14, -44, 1], [28, -50, 0.85]]) { c.save(); c.translate(x, y); c.scale(k, k); c.beginPath(); c.ellipse(0, 0, 4, 3, -0.4, 0, TAU); c.fill(); c.beginPath(); c.moveTo(3.4, -1); c.lineTo(3.4, -14); c.quadraticCurveTo(8, -12, 9, -8); c.stroke(); c.restore(); }
  } else if (id === 'pipe') { /* detective's pipe */
    c.lineWidth = 2.2; c.fillStyle = '#6b4a2e';
    c.save(); c.translate(49, -9); c.rotate(0.15); rr(c, 0, -2, 14, 4, 2); c.fill(); c.stroke(); c.restore();
    c.fillStyle = '#8b5a3c'; c.beginPath(); c.moveTo(60, -14); c.lineTo(70, -14); c.quadraticCurveTo(70, -3, 65, -3); c.quadraticCurveTo(60, -3, 60, -14); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3a2a1e'; c.beginPath(); c.ellipse(65, -14, 5, 1.6, 0, 0, TAU); c.fill();
  } else if (id === 'necktie') { /* necktie */
    c.translate(4, 5);
    c.fillStyle = '#2f6fc9'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(16, -3); c.lineTo(24, -3); c.lineTo(22, 2); c.lineTo(18, 2); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(18, 2); c.lineTo(22, 2); c.lineTo(25, 20); c.lineTo(20, 25); c.lineTo(15, 20); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(17, 9); c.lineTo(23, 7); c.moveTo(16.5, 15); c.lineTo(24, 13); c.stroke();
  } else if (id === 'choker') { /* black choker with a little heart */
    c.lineWidth = 5.5; c.beginPath(); c.moveTo(5, -5); c.quadraticCurveTo(21, 5, 38, -6); c.stroke();
    c.lineWidth = 3; c.strokeStyle = '#2f2f3a'; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1.6; c.fillStyle = '#ff5d9a'; heartPath(c, 21, 5, 3.6); c.fill(); c.stroke();
  } else if (id === 'hanabadge') { /* hanamaru badge (the game's stamp) */
    c.fillStyle = '#ff7aa8'; c.lineWidth = 1.8;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; dotS(c, 20 + Math.cos(a) * 5.4, 16 + Math.sin(a) * 5.4, 2.8); }
    c.fillStyle = '#fffaf0'; dotS(c, 20, 16, 5);
    c.strokeStyle = '#e0475b'; c.lineWidth = 1.4; c.beginPath(); c.arc(20.6, 16, 1, 0, Math.PI); c.arc(20, 16, 2.2, Math.PI, TAU); c.arc(20.6, 16, 3.4, 0, Math.PI); c.stroke();
  } else if (id === 'medal') { /* gold medal on a ribbon */
    c.translate(4, -1); /* short ribbon: starts below the head */
    c.lineWidth = 2; c.fillStyle = '#e0475b';
    c.beginPath(); c.moveTo(14.4, 3); c.lineTo(16.2, 3); c.lineTo(21, 12); c.lineTo(18, 13); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2f6fc9'; c.beginPath(); c.moveTo(28.8, 2); c.lineTo(24.6, 2); c.lineTo(21, 12); c.lineTo(24, 13); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd23f'; c.lineWidth = 2.4; dotS(c, 21, 18, 6.5);
    c.fillStyle = '#fff3a8'; star5Path(c, 21, 18, 3.6, 1.6, 0); c.fill();
  } else if (id === 'brooch') { /* jewel brooch */
    c.fillStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath(); c.ellipse(20, 15, 7, 8.5, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#c86ad6'; c.beginPath(); c.ellipse(20, 15, 4.6, 6, 0, 0, TAU); c.fill(); c.lineWidth = 1.4; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.8)'; dot(c, 18.5, 12.5, 1.5);
  } else if (id === 'nafuda') { /* name tag (tulip-shaped kindergarten badge) */
    c.fillStyle = '#ff9ec1'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(12, 10); c.lineTo(15, 6); c.lineTo(18, 9); c.lineTo(21, 5); c.lineTo(24, 9); c.lineTo(27, 6); c.lineTo(29, 10); c.lineTo(29, 22); c.quadraticCurveTo(20.5, 26, 12, 22); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; rr(c, 14.5, 12, 12, 8, 2); c.fill(); c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = '#8a7a6c'; c.beginPath(); c.moveTo(16.5, 16); c.lineTo(24.5, 16); c.stroke();
  } else if (id === 'zekken') { /* race number bib */
    c.fillStyle = '#ffffff'; c.lineWidth = 2.2; rr(c, 10, 6, 20, 16, 2); c.fill(); c.stroke();
    c.fillStyle = OUT; for (const [x, y] of [[12.5, 8.5], [27.5, 8.5]]) dot(c, x, y, 1);
    c.font = '900 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e0475b'; c.fillText('1', 20, 15);
  } else if (id === 'apron') { /* frilly apron */
    c.fillStyle = '#ffffff'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(8, 0); c.lineTo(32, -2); c.lineTo(35, 26); c.quadraticCurveTo(21, 32, 6, 26); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd6e4'; for (let i = 0; i < 6; i++) dotS(c, 7.5 + i * 5.4, 27.5 + Math.sin(i) * 0.8, 2.6);
    c.fillStyle = '#ff9ec1'; heartPath(c, 20, 13, 3.6); c.fill(); c.lineWidth = 1.2; c.stroke();
  } else if (id === 'wappen') { /* chick patch */
    c.fillStyle = '#ffe98a'; c.lineWidth = 2; dotS(c, 20, 16, 7);
    c.fillStyle = OUT; dot(c, 18, 14.5, 1); dot(c, 22.5, 14.5, 1);
    c.fillStyle = '#ff9a3c'; c.beginPath(); c.moveTo(18.5, 17); c.lineTo(22, 17); c.lineTo(20.2, 19.5); c.closePath(); c.fill();
    c.strokeStyle = '#ff9a3c'; c.setLineDash([1.5, 1.5]); c.lineWidth = 1.2; c.beginPath(); c.arc(20, 16, 5.6, 0, TAU); c.stroke(); c.setLineDash([]);
  } else if (id === 'koura') { /* turtle shell on the back: a dome from the neck to the tail, reaching down the sides */
    c.fillStyle = '#5fae6a'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(6, -8); c.bezierCurveTo(0, -31, -38, -29, -43, -6); c.bezierCurveTo(-47, 7, -41, 15, -30, 18); c.quadraticCurveTo(-12, 23, 3, 14); c.quadraticCurveTo(9, 3, 6, -8); c.closePath(); c.fill(); c.stroke();
    c.save(); c.clip();
    c.strokeStyle = '#2f7a3e'; c.lineWidth = 1.8; c.beginPath();
    c.moveTo(-27, -16); c.lineTo(-18, -21); c.lineTo(-9, -16); c.lineTo(-9, -5); c.lineTo(-18, 0); c.lineTo(-27, -5); c.closePath();
    c.moveTo(-27, -16); c.lineTo(-37, -20); c.moveTo(-9, -16); c.lineTo(0, -19); c.moveTo(-27, -5); c.lineTo(-40, -2); c.moveTo(-9, -5); c.lineTo(5, -1);
    c.moveTo(-18, 0); c.lineTo(-18, 22); c.moveTo(-27, -5); c.lineTo(-31, 19); c.moveTo(-9, -5); c.lineTo(-6, 19);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(-16, -23, 9, 2.4, -0.15, 0, TAU); c.fill();
    c.restore();
  } else if (id === 'butterfly') { /* butterfly wings on the back */
    c.lineWidth = 2.2;
    c.fillStyle = '#c9a6f2'; c.beginPath(); c.ellipse(-10, -22, 9, 14, -0.7, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#ffb3cc'; c.beginPath(); c.ellipse(-22, -10, 7, 10, -1.2, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; dot(c, -11, -25, 2.4); dot(c, -22, -11, 1.8);
  } else if (id === 'randoseru') { /* school satchel on the back */
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(-4, -14); c.quadraticCurveTo(8, -12, 12, 0); c.stroke();
    c.fillStyle = '#e0483a'; c.lineWidth = 2.6; rr(c, -30, -26, 26, 22, 6); c.fill(); c.stroke();
    c.fillStyle = '#c4302a'; c.beginPath(); c.moveTo(-30, -20); c.quadraticCurveTo(-30, -27, -23, -27); c.lineTo(-11, -27); c.quadraticCurveTo(-4, -27, -4, -20); c.lineTo(-4, -12); c.lineTo(-30, -12); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd23f'; rr(c, -19.5, -15, 5, 5, 1); c.fill(); c.lineWidth = 1.4; c.stroke();
  } else if (id === 'rocket') { /* angular rocket strapped on the back: sharp nose cone, boxy body, fins, jagged flame towards the tail */
    c.save(); c.translate(-21, -16); c.rotate(-0.1); c.scale(0.86, 0.86); c.lineWidth = 2.8; c.lineJoin = 'miter';
    c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(-21, -3); c.lineTo(-33, -7); c.lineTo(-29, -1.5); c.lineTo(-40, 0); c.lineTo(-29, 1.5); c.lineTo(-33, 7); c.lineTo(-21, 3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff3a8'; c.beginPath(); c.moveTo(-23, -1.6); c.lineTo(-31, 0); c.lineTo(-23, 1.6); c.closePath(); c.fill();
    c.fillStyle = '#e0475b'; c.beginPath(); c.moveTo(-14, -6); c.lineTo(-26, -19); c.lineTo(-24, -6); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-14, 6); c.lineTo(-26, 17); c.lineTo(-24, 6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#6b7b86'; c.beginPath(); c.moveTo(-14, -5); c.lineTo(-21, -6); c.lineTo(-21, 6); c.lineTo(-14, 5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f2f5f7'; c.beginPath(); c.moveTo(-14, -7); c.lineTo(10, -7); c.lineTo(10, 7); c.lineTo(-14, 7); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e0475b'; c.beginPath(); c.moveTo(10, -7); c.lineTo(25, 0); c.lineTo(10, 7); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2f6fc9'; c.fillRect(-9, -6, 4, 12);
    c.fillStyle = '#8fd8ff'; c.beginPath(); c.moveTo(0, -3.4); c.lineTo(5.8, -3.4); c.lineTo(5.8, 3.4); c.lineTo(0, 3.4); c.closePath(); c.fill(); c.lineWidth = 1.8; c.stroke();
    c.restore();
  } else if (id === 'wtowel') { /* bath towel wrapped round the waist */
    c.fillStyle = '#ffffff'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-43, 14); c.quadraticCurveTo(-4, 26, 35, 14); c.lineTo(32, 26); c.quadraticCurveTo(-4, 40, -40, 26); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#8fd3f0'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-40, 20); c.quadraticCurveTo(-4, 31, 33, 20); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(20, 21); c.lineTo(24, 30); c.stroke();
  } else if (id === 'belt') { /* champion belt with a big gold buckle */
    c.fillStyle = '#6b4a2e'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-43, 13); c.quadraticCurveTo(-4, 25, 35, 13); c.lineTo(34, 20); c.quadraticCurveTo(-4, 33, -42, 20); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.ellipse(18, 21, 9, 7, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#fff3a8'; star5Path(c, 18, 21, 4, 1.8, 0); c.fill();
  } else if (id === 'skirt') { /* pleated skirt */
    c.fillStyle = '#ff7aa8'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-42, 12); c.quadraticCurveTo(-4, 24, 35, 12); c.lineTo(40, 28); c.quadraticCurveTo(-4, 44, -47, 28); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(74,58,48,0.45)'; c.lineWidth = 1.4; c.beginPath(); for (const x of [-32, -20, -8, 4, 16, 28]) { c.moveTo(x, 17 + Math.abs(x + 4) * -0.05); c.lineTo(x * 1.12, 33); } c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-44, 25); c.quadraticCurveTo(-4, 40, 38, 25); c.stroke();
  } else if (id === 'tailribbon') { /* bow on the tail */
    c.save(); c.translate(-44, -14); c.rotate(0.5); c.fillStyle = '#7fd9b0'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-9, -6); c.lineTo(-9, 6); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(9, -6); c.lineTo(9, 6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#c3f0dc'; dotS(c, 0, 0, 3); c.restore();
  } else if (id === 'pochette') { /* little shoulder bag at the hip */
    c.lineWidth = 1.6; c.beginPath(); c.moveTo(4, -12); c.quadraticCurveTo(-8, 4, 8, 22); c.stroke();
    c.lineWidth = 2.2; c.fillStyle = '#ff9ec1'; c.beginPath(); c.moveTo(2, 20); c.lineTo(16, 20); c.quadraticCurveTo(17, 30, 9, 30); c.quadraticCurveTo(1, 30, 2, 20); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd23f'; dot(c, 9, 23, 1.6);
  }
}

function drawHat(c, id, dy) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 3;
  if (dy) c.translate(0, dy);
  if (!['ribbon', 'cap', 'glass', 'crown', 'flower', 'star'].includes(id)) { drawHatNew(c, id); c.restore(); return; }
  if (id === 'ribbon') {
    c.translate(4, -17); c.rotate(-0.4); c.scale(0.78, 0.78);
    c.fillStyle = '#ff7aa8';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-13, -9); c.lineTo(-12, 7); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(13, -9); c.lineTo(12, 7); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffb3cc'; c.beginPath(); c.arc(0, 0, 4.6, 0, TAU); c.fill(); c.stroke();
  } else if (id === 'cap') {
    c.fillStyle = '#5b7fd6';
    c.beginPath(); c.moveTo(11, -34); c.lineTo(12, -50); c.quadraticCurveTo(22, -56, 32, -50); c.lineTo(33, -34); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd23f'; c.fillRect(11.6, -42, 20.8, 5); c.lineWidth = 1.5; c.strokeRect(11.6, -42, 20.8, 5); c.lineWidth = 3;
    c.fillStyle = '#5b7fd6'; c.beginPath(); c.ellipse(22, -34, 19, 5, 0, 0, TAU); c.fill(); c.stroke();
  } else if (id === 'glass') {
    c.lineWidth = 2.6; c.fillStyle = 'rgba(255,255,255,0.4)';
    c.beginPath(); c.arc(31, -21, 6.3, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(15.5, -21, 6.3, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(21.5, -22); c.lineTo(24.5, -22); c.moveTo(9.5, -21); c.lineTo(3.5, -17); c.stroke();
  } else if (id === 'crown') {
    c.fillStyle = '#ffd23f';
    c.beginPath(); c.moveTo(12, -31); c.lineTo(13, -46); c.lineTo(18, -39); c.lineTo(22, -49); c.lineTo(26, -39); c.lineTo(31, -46); c.lineTo(32, -31); c.closePath(); c.fill(); c.stroke();
  } else if (id === 'flower') {
    c.translate(-16, -4); c.scale(0.9, 0.9);
    c.lineWidth = 2.4; c.fillStyle = '#ff9ec1';
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; c.beginPath(); c.arc(Math.cos(a) * 6, Math.sin(a) * 6, 4.4, 0, TAU); c.fill(); c.stroke(); }
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0, 0, 3.6, 0, TAU); c.fill(); c.stroke();
  } else if (id === 'star') {
    c.translate(20, 15); c.rotate(-0.2);
    c.fillStyle = '#ffd23f'; c.lineWidth = 2.6;
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.6 : 8; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}

/* chrome faucet from the wall: the pipe and the spout have the same thickness, pink cross handle on top */
function chrome(c, y, h) { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f6f9fb'); g.addColorStop(0.5, '#cfd9df'); g.addColorStop(1, '#a9b7bf'); return g; }
function drawFaucet() {
  const sx = geo.spawn.x, fh = geo.faucetH, c = ctx, T = 14, py = 13, bottom = fh - 9;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 3;
  /* wall plate */
  c.fillStyle = chrome(c, 6, 30); c.beginPath(); c.ellipse(0, py + T / 2, 9, 15, 0, 0, TAU); c.fill(); c.stroke();
  /* pipe along the wall, then the spout going down */
  c.fillStyle = chrome(c, py, T); rr(c, 2, py, sx - 2 + T / 2, T, T / 2); c.fill(); c.stroke();
  c.fillStyle = chrome(c, py, bottom - py); rr(c, sx - T / 2, py, T, bottom - py, T / 2); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(10, py + 4); c.lineTo(sx - T / 2 - 4, py + 4); c.stroke();
  c.beginPath(); c.moveTo(sx - 3, py + 7); c.lineTo(sx - 3, bottom - 5); c.stroke();
  /* nozzle */
  c.strokeStyle = OUT; c.lineWidth = 3; c.fillStyle = '#9aa9b2'; rr(c, sx - T / 2 - 2, fh - 11, T + 4, 7, 3); c.fill(); c.stroke();
  /* handle */
  const hx = sx - 40;
  c.lineWidth = 2.5; c.fillStyle = chrome(c, 6, 8); rr(c, hx - 3.5, 6, 7, 9, 2); c.fill(); c.stroke();
  c.fillStyle = '#ff9ec1'; rr(c, hx - 16, 1.5, 32, 8, 4); c.fill(); c.stroke();
  c.fillStyle = '#ffd6e4'; c.beginPath(); c.arc(hx, 5.5, 5, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#6ec0f2'; c.beginPath(); c.moveTo(hx, 2.6); c.quadraticCurveTo(hx + 2.4, 5.6, hx, 7.6); c.quadraticCurveTo(hx - 2.4, 5.6, hx, 2.6); c.fill();
  c.restore();
}
function drawDropCue() {
  if (state !== 'play' || count() >= CFG.CAP) return;
  const sx = geo.spawn.x, y0 = geo.faucetH - 3, y1 = geo.spawn.y;
  const left = supplyTimer;
  if (left > 1 || left <= 0) return;
  const u = 1 - left;
  let y, s;
  if (u < 0.5) { y = y0 + 4; s = 2 + 8 * u; } else { const q = (u - 0.5) / 0.5; y = y0 + 4 + (y1 - y0) * q * q; s = 6; }
  ctx.fillStyle = '#8fd3f0'; ctx.strokeStyle = '#4a8fb0'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(sx, y - s * 1.2); ctx.quadraticCurveTo(sx + s, y + s * 0.2, sx, y + s); ctx.quadraticCurveTo(sx - s, y + s * 0.2, sx, y - s * 1.2);
  ctx.fill(); ctx.stroke();
}

/* ---- bath-salt water effects: every salt has its own motif, so the theme never depends on colour alone ---- */
const fxr = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
function fxHeart(c, x, y, s) { c.beginPath(); c.moveTo(x, y + s * 0.9); c.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4); c.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.5, y - s * 0.1, x, y + s * 0.9); c.closePath(); }
function fxStar5(c, x, y, R, r, rot) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
const FXK = 1.7;
const fxT = (c, x, y) => { c.translate(x, y); c.scale(FXK, FXK); };
function drawSaltFx(c, w, id, t, still) {
  if (!id || id === 'plain') return;
  const X = (f) => w.x + w.w * f, Y = (f) => w.y + w.h * f, wob = (i, sp, a) => (still ? 0 : Math.sin(t * sp + i * 2.1) * a);
  const fall = (i, sp) => (still ? fxr(i, 9) : (t * sp + fxr(i, 9)) % 1);
  c.save(); c.beginPath(); rr(c, w.x + 2, w.y + 2, w.w - 4, w.h - 4, 14); c.clip(); c.lineJoin = 'round'; c.lineCap = 'round';
  const each = (n, f) => { for (let i = 0; i < n; i++) { c.save(); f(i); c.restore(); } };
  if (id === 'gold') { /* metallic: a light band sweeps across, plus glitter */
    const bx = X(((still ? 0.4 : t * 0.16) % 1.8) - 0.4), g2 = c.createLinearGradient(bx - 40, 0, bx + 40, 0);
    g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.5, 'rgba(255,255,255,.55)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g2; c.beginPath(); c.moveTo(bx - 10, w.y); c.lineTo(bx + 70, w.y); c.lineTo(bx + 10, w.y + w.h); c.lineTo(bx - 70, w.y + w.h); c.closePath(); c.fill();
    c.fillStyle = '#ffffff'; c.strokeStyle = '#d9a82a'; c.lineWidth = 1.2;
    for (let i = 0; i < 11; i++) { c.globalAlpha = reduce || still ? 0.8 : 0.3 + 0.7 * Math.abs(Math.sin(t * 1.7 + i * 2.3)); star4(c, X(0.06 + 0.88 * fxr(i, 1)), Y(0.08 + 0.84 * fxr(i, 2)), (3 + fxr(i, 3) * 3.5) * 1.7); c.fill(); c.stroke(); }
    c.globalAlpha = 1;
  } else if (id === 'sakura') {
    each(9, i => { const u = fall(i, 0.035); fxT(c, X(fxr(i, 1)) + wob(i, 0.8, 10), Y(u)); c.rotate((still ? i : t * 0.7) + i); c.globalAlpha = 0.9; c.fillStyle = '#ffb7d0'; c.strokeStyle = 'rgba(205,90,135,.7)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, -6); c.bezierCurveTo(6, -6, 6, 4, 0, 6); c.bezierCurveTo(-6, 4, -6, -6, 0, -6); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, -6); c.lineTo(0, -2.5); c.stroke(); });
  } else if (id === 'momiji') {
    each(10, i => { const u = fall(i, 0.04); fxT(c, X(fxr(i, 1)) + wob(i, 0.7, 12), Y(u)); c.rotate((still ? i : t * 0.9) + i * 2); c.fillStyle = ['#e0483a', '#ff8a3d', '#ffb347'][i % 3]; c.strokeStyle = 'rgba(120,40,20,.75)'; c.lineWidth = 1.2;
      fxStar5(c, 0, 0, 10, 4.6, 0); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 11); c.stroke(); });
  } else if (id === 'mint') { /* tiny twin-leaf sprouts */
    each(7, i => { fxT(c, X(0.1 + 0.8 * fxr(i, 1)) + wob(i, 0.5, 8), Y(0.12 + 0.76 * fxr(i, 2)) + wob(i, 0.7, 5)); c.rotate(wob(i, 0.6, 0.5) + (i % 2 ? 0.3 : -0.3)); c.scale(1.15, 1.15);
      c.strokeStyle = '#2f8f5a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 9); c.quadraticCurveTo(1.5, 4, 0, 0); c.stroke();
      c.fillStyle = '#6fd19c'; c.strokeStyle = 'rgba(40,120,80,.9)'; c.lineWidth = 1.2;
      for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * 5, -2.5, 5.2, 3.4, sg * -0.5, 0, TAU); c.fill(); c.stroke(); } });
  } else if (id === 'milk') {
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 10;
    for (let k = 0; k < 3; k++) { c.beginPath(); for (let x = 0; x <= w.w; x += 6) { const y = Y(0.22 + 0.27 * k) + Math.sin(x * 0.035 + (still ? 0 : t * 0.7) + k * 2) * 9; c[x ? 'lineTo' : 'moveTo'](w.x + x, y); } c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.9)'; c.strokeStyle = 'rgba(200,170,140,.7)'; c.lineWidth = 1.2;
    each(6, i => { fxT(c, X(fxr(i, 3)), Y(0.15 + 0.7 * fxr(i, 4)) + wob(i, 0.9, 5)); c.beginPath(); c.arc(0, 0, 3 + fxr(i, 5) * 3, 0, TAU); c.fill(); c.stroke(); });
  } else if (id === 'yuzu') { /* lemon: many round slices */
    each(7, i => { fxT(c, X(0.08 + 0.84 * fxr(i, 1)) + wob(i, 0.5, 7), Y(0.1 + 0.8 * fxr(i, 2)) + wob(i, 0.8, 5)); c.rotate((still ? i : t * 0.25) + i);
      c.fillStyle = '#ffd23f'; c.strokeStyle = '#c99400'; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff3a8'; c.beginPath(); c.arc(0, 0, 8.3, 0, TAU); c.fill();
      c.strokeStyle = '#e0b000'; c.lineWidth = 1.2; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 8.3, Math.sin(a) * 8.3); c.stroke(); } });
  } else if (id === 'soda') {
    each(18, i => { const u = still ? fxr(i, 9) : (t * (0.1 + fxr(i, 3) * 0.1) + fxr(i, 9)) % 1; fxT(c, X(fxr(i, 4)) + wob(i, 3, 3), Y(1 - u)); const r = 2.4 + fxr(i, 5) * 5;
      c.fillStyle = 'rgba(255,255,255,.35)'; c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.7; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-r * 0.35, -r * 0.35, r * 0.25, 0, TAU); c.fill(); });
  } else if (id === 'lav') { /* butterflies */
    each(7, i => { c.translate(X(0.1 + 0.8 * fxr(i, 1)) + wob(i, 0.6, 9), Y(0.12 + 0.76 * fxr(i, 2)) + wob(i, 0.9, 7)); c.rotate(wob(i, 0.8, 0.5)); c.scale(1.45, 1.45);
      const fl = still ? 1 : 0.55 + 0.45 * Math.abs(Math.cos(t * 5 + i * 1.7)); c.lineWidth = 1.3;
      for (const sg of [-1, 1]) { c.save(); c.scale(sg * fl, 1); c.fillStyle = '#b79cff'; c.strokeStyle = '#6a4bc8'; c.beginPath(); c.ellipse(5.5, -4, 6.2, 4.4, -0.5, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#e4d6ff'; c.beginPath(); c.ellipse(4.2, 3.6, 4.4, 3.2, 0.5, 0, TAU); c.fill(); c.stroke(); c.restore(); }
      c.fillStyle = '#5a3fb0'; c.beginPath(); c.ellipse(0, 0, 1.4, 6, 0, 0, TAU); c.fill(); c.strokeStyle = '#5a3fb0'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -5.5); c.lineTo(-2.5, -9); c.moveTo(0, -5.5); c.lineTo(2.5, -9); c.stroke(); });
  } else if (id === 'ichigo') {
    each(7, i => { fxT(c, X(0.12 + 0.76 * fxr(i, 1)) + wob(i, 0.5, 7), Y(0.15 + 0.7 * fxr(i, 2)) + wob(i, 0.8, 5)); c.rotate((still ? 0 : Math.sin(t * 0.6 + i)) * 0.3);
      c.fillStyle = '#ff5d6c'; c.strokeStyle = '#a82a3a'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 10); c.bezierCurveTo(-11, 4, -10, -7, 0, -6); c.bezierCurveTo(10, -7, 11, 4, 0, 10); c.fill(); c.stroke();
      c.fillStyle = '#4caf6a'; c.beginPath(); c.moveTo(0, -5); c.lineTo(-5, -9); c.lineTo(-2, -5.5); c.lineTo(0, -10); c.lineTo(2, -5.5); c.lineTo(5, -9); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffe9a8'; for (const [px, py] of [[-5, -3], [0, -3], [5, -3], [-7.5, 1], [-2.5, 1], [2.5, 1], [7.5, 1], [-2.5, 5], [2.5, 5], [0, 8]]) { c.beginPath(); c.arc(px, py, 0.65, 0, TAU); c.fill(); } });
  } else if (id === 'night') {
    c.fillStyle = '#fff6c0'; c.strokeStyle = 'rgba(255,230,140,.9)'; c.lineWidth = 1;
    for (let i = 0; i < 14; i++) { c.globalAlpha = reduce || still ? 0.8 : 0.3 + 0.7 * Math.abs(Math.sin(t * 1.4 + i * 2.3)); star4(c, X(0.06 + 0.88 * fxr(i, 1)), Y(0.1 + 0.8 * fxr(i, 2)), (2.6 + fxr(i, 3) * 3.4) * 1.5); c.fill(); c.stroke(); }
    c.globalAlpha = 1; const mx = X(0.78), my = Y(0.24); c.fillStyle = '#ffe98a'; c.strokeStyle = '#c9a63a'; c.lineWidth = 1.4; c.beginPath(); c.arc(mx, my, 22, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#6e86c9'; c.beginPath(); c.arc(mx + 11, my - 6, 19, 0, TAU); c.fill();
  } else if (id === 'rainbow') {
    const cx = X(0.5), cy = Y(1.05), R0 = Math.min(w.w * 0.5, w.h * 0.95);
    ['#ff8f8f', '#ffc46b', '#f3ee7a', '#8fe0a0', '#7fc8ff', '#b79cff'].forEach((col, k) => { c.globalAlpha = 0.5 + (reduce || still ? 0 : 0.2 * Math.sin(t * 1.3 - k * 0.5)); c.strokeStyle = col; c.lineWidth = 9; c.beginPath(); c.arc(cx, cy, R0 - k * 10, Math.PI, TAU); c.stroke(); });
    c.globalAlpha = 1; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(160,120,200,.8)'; c.lineWidth = 1.1;
    for (let i = 0; i < 6; i++) { c.globalAlpha = reduce || still ? 0.8 : 0.3 + 0.7 * Math.abs(Math.sin(t * 1.7 + i * 2)); star4(c, X(0.08 + 0.84 * fxr(i, 1)), Y(0.1 + 0.6 * fxr(i, 2)), (3.5 + fxr(i, 3) * 2) * 1.4); c.fill(); c.stroke(); }
  } else if (id === 'cocoa') {
    each(7, i => { fxT(c, X(0.12 + 0.76 * fxr(i, 1)) + wob(i, 0.5, 6), Y(0.15 + 0.7 * fxr(i, 2)) + wob(i, 0.8, 5)); c.rotate((still ? i : t * 0.2) + i); c.fillStyle = '#fffaf2'; c.strokeStyle = '#a77a5b'; c.lineWidth = 1.4;
      rr(c, -7.5, -6.5, 15, 13, 5); c.fill(); c.stroke(); c.fillStyle = '#ffd6e4'; c.beginPath(); c.arc(-2, -1, 1.2, 0, TAU); c.fill(); });
    each(7, i => { const u = still ? fxr(i, 9) : (t * 0.08 + fxr(i, 9)) % 1; fxT(c, X(fxr(i, 4)) + wob(i, 2, 3), Y(1 - u)); c.fillStyle = '#7a4a2e'; c.globalAlpha = 0.85; fxHeart(c, 0, 0, 3.4 + fxr(i, 5) * 2); c.fill(); });
  } else if (id === 'ocha') { /* tea bags (sunk leaves) + steam */
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 4; c.lineCap = 'round';
    each(3, i => { const x0 = X(0.2 + 0.3 * i), u = still ? 0.4 : (t * 0.06 + i / 3) % 1; c.beginPath(); for (let k = 0; k <= 12; k++) { const yy = Y(0.95 - u * 0.6 - k * 0.045); c[k ? 'lineTo' : 'moveTo'](x0 + Math.sin(k * 0.8 + i + (still ? 0 : t)) * 7, yy); } c.stroke(); });
    each(4, i => { fxT(c, X(0.12 + 0.76 * fxr(i, 1)) + wob(i, 0.5, 8), Y(0.16 + 0.72 * fxr(i, 2)) + wob(i, 0.7, 5)); c.rotate(wob(i, 0.5, 0.4) + (i % 2 ? 0.2 : -0.2)); c.scale(1.25, 1.25);
      const pts = [[-10, 10], [10, 10], [7, -6], [4, -9], [-4, -9], [-7, -6]];
      const path = () => { c.beginPath(); pts.forEach((q, k) => c[k ? 'lineTo' : 'moveTo'](q[0], q[1])); c.closePath(); };
      c.strokeStyle = '#7a5a3a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(7, -14, 10, -18); c.stroke(); c.fillStyle = '#fff8e6'; c.beginPath(); c.rect(7, -24, 7, 6); c.fill(); c.stroke();
      c.fillStyle = '#fbf3df'; path(); c.fill();
      c.save(); path(); c.clip();
      c.fillStyle = '#7fa04a'; c.beginPath(); c.moveTo(-12, 12);
      c.lineTo(-12, 3); c.quadraticCurveTo(0, -5, 12, 3);
      c.lineTo(12, 12); c.closePath(); c.fill();
      c.fillStyle = '#4f7a2e'; for (const [px, py] of [[-4, 4], [2, 3], [-1, 7], [4, 6], [-6, 7.5]]) { c.beginPath(); c.ellipse(px, py, 1.7, 0.9, px, 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(138,106,72,.35)'; c.lineWidth = 0.8; for (let k = -12; k <= 12; k += 4) { c.beginPath(); c.moveTo(k, -10); c.lineTo(k + 8, 12); c.moveTo(k, -10); c.lineTo(k - 8, 12); c.stroke(); }
      c.restore(); c.strokeStyle = '#8a6a48'; c.lineWidth = 1.4; path(); c.stroke(); });
  } else if (id === 'yuki') { /* snow: petal flakes, every third one a snowman */
    const SB = '#8fb2dc';
    each(7, i => { const u = fall(i, 0.03), yv = i % 3 === 0 ? 'D' : 'B'; fxT(c, X(fxr(i, 1)) + wob(i, 0.7, 10), Y(u)); c.lineCap = 'round'; c.lineJoin = 'round';
      if (yv === 'D') { c.rotate(wob(i, 0.7, 0.25)); c.scale(1.35, 1.35); c.fillStyle = '#fff'; c.strokeStyle = SB; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 5, 6.2, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(0, -4.2, 4.4, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#3a3a4a'; c.beginPath(); c.arc(-1.7, -5, 0.8, 0, TAU); c.arc(1.7, -5, 0.8, 0, TAU); c.fill(); c.fillStyle = '#ff9a3c'; c.beginPath(); c.moveTo(0, -4); c.lineTo(3.4, -3.2); c.lineTo(0, -2.6); c.fill(); c.fillStyle = '#e0475b'; c.fillRect(-4, -0.7, 8, 1.8); return; }
      c.rotate((still ? i : t * 0.5) + i);
      c.scale(1.3, 1.3); c.fillStyle = '#fff'; c.strokeStyle = SB; c.lineWidth = 1.3; for (let k = 0; k < 6; k++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(0, -2); c.lineTo(3.4, -6.5); c.lineTo(0, -11.5); c.lineTo(-3.4, -6.5); c.closePath(); c.fill(); c.stroke(); } c.beginPath(); c.arc(0, 0, 2.6, 0, TAU); c.fill(); c.stroke(); });
  } else if (id === 'umi') { /* waves + small plain pale fish (background-quiet) */
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 5;
    for (let k = 0; k < 3; k++) { c.beginPath(); for (let x = 0; x <= w.w; x += 5) { const y = Y(0.2 + 0.3 * k) + Math.sin(x * 0.05 + (still ? 0 : t * 1.1) - k * 1.7) * 7; c[x ? 'lineTo' : 'moveTo'](w.x + x, y); } c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.55)';
    each(7, i => { const dir = i % 2 ? -1 : 1, u = still ? fxr(i, 9) : (t * (0.03 + 0.012 * fxr(i, 3)) + fxr(i, 9)) % 1, px = dir > 0 ? -0.1 + 1.2 * u : 1.1 - 1.2 * u;
      fxT(c, X(px), Y(0.18 + 0.68 * fxr(i, 2)) + wob(i, 1.4, 4)); c.scale(dir, 1);
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(-12, -4.5); c.lineTo(-12, 4.5); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(1, 0, 8, 5, 0, 0, TAU); c.fill(); });
  }
  c.restore();
}
function drawTub() {
  const t = geo.tub, w = geo.water, rim = geo.rim;
  const rad = Math.min(60, t.w * 0.18);
  ctx.fillStyle = 'rgba(185,211,221,0.7)'; rr(ctx, t.x + 4, t.y + 10, t.w, t.h, rad); ctx.fill();
  ctx.fillStyle = '#fdf6ec';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5; rr(ctx, t.x, t.y, t.w, t.h, rad); ctx.fill(); ctx.stroke();
  ctx.fillStyle = waterFill(w); ctx.strokeStyle = OUT; ctx.lineWidth = 4;
  rr(ctx, w.x, w.y, w.w, w.h, Math.max(18, rad - rim * 0.6)); ctx.fill(); ctx.stroke();
  drawSaltFx(ctx, w, style.salt, clock, false);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const fx0 = [0.2, 0.7, 0.4, 0.8, 0.3], fy0 = [0.12, 0.2, 0.5, 0.62, 0.85];
  for (let i = 0; i < 5; i++) {
    const cx = w.x + w.w * fx0[i] + Math.sin(clock * 0.5 + i) * 6, cy = w.y + w.h * fy0[i];
    ctx.beginPath(); ctx.arc(cx, cy, 24 + i * 6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  }
}
function drawHouse() {
  const hk = houseK(); if (hk <= 0) return;
  ctx.save(); if (hk < 1) { ctx.translate(geo.home.x, geo.home.y); ctx.scale(hk, hk); ctx.translate(-geo.home.x, -geo.home.y); }
  if (spotOn() && !canLink(spotDuck, 'home')) ctx.globalAlpha = 1 - 0.6 * dimK;
  const d = geo.home, R = d.rad;
  const hot = drag && drag.over === 'home';
  const hl = houseLevel(), hs = houseScale();
  const bob = reduce ? 0 : Math.sin(clock * 1.5) * 1.5;
  const sc = (homeBounce > 0 ? 1 + Math.sin(homeBounce * 24) * 0.09 * (homeBounce / 0.5) : 1) * hs;
  const cu = homeCall > 0 ? 1 - homeCall / 0.8 : 0;
  const wob = reduce || !cu ? 0 : Math.sin(cu * TAU * 3) * (1 - cu) * (0.07 + 0.015 * hl);
  const hop = reduce || !cu ? 0 : Math.abs(Math.sin(cu * Math.PI * 3)) * (1 - cu) * R * 0.3;
  const base = R * 1.1;
  /* soft halo that pulses once the tub is getting full */
  if (hl >= 3 && !hot) {
    const a = reduce ? 0.5 : 0.35 + 0.35 * Math.abs(Math.sin(clock * 3));
    ctx.save(); ctx.strokeStyle = 'rgba(255,214,90,' + a.toFixed(3) + ')'; ctx.lineWidth = 4 + (hl - 3);
    ctx.beginPath(); ctx.arc(d.x, d.y + bob - R * 0.2 * hs, R * (1.55 + 0.12 * hl), 0, TAU); ctx.stroke(); ctx.restore();
  }
  ctx.save();
  /* scale and wobble around the base of the house so it grows upward and the label stays put */
  ctx.translate(d.x, d.y + bob + base - hop);
  ctx.rotate(wob);
  ctx.scale(sc, sc);
  ctx.translate(0, -base);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, R * 1.1, R * 1.35, R * 0.28, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#fdf0d5'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  rr(ctx, -R * 0.95, -R * 0.25, R * 1.9, R * 1.35, R * 0.2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e0483a';
  ctx.beginPath(); ctx.moveTo(-R * 1.3, -R * 0.15); ctx.lineTo(0, -R * 1.3); ctx.lineTo(R * 1.3, -R * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hot ? '#ffe9a8' : '#8b5a3c';
  ctx.beginPath(); ctx.moveTo(-R * 0.38, R * 1.1); ctx.lineTo(-R * 0.38, R * 0.4); ctx.arc(0, R * 0.4, R * 0.38, Math.PI, 0); ctx.lineTo(R * 0.38, R * 1.1); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  if (hot) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, R * 0.1, R * (1.75 + Math.sin(clock * 9) * 0.08), 0, TAU); ctx.stroke(); }
  ctx.restore();
  txt(ctx, L().home, d.x, d.y + R * 1.2 + 8, { size: 12, weight: 700, color: INK, align: 'center', glow: '#bfe9f5', glowW: 4 });
  ctx.restore();
}
function drawBubble(x, y, label, g) {
  setFont(ctx, 15, 900);
  const tw0 = tw(ctx, label);
  const duckW = g ? 36 : 0;
  const bs = (g && g.c > 0) ? badgeSize(g.c, 10) + 6 : 0;
  const bw = 14 + duckW + tw0 + bs + 14, bh = 38;
  const bx = clamp(x - bw / 2, 4, W - bw - 4), by = clamp(y - bh / 2, 4, H - bh - 4);
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  rr(ctx, bx, by, bw, bh, 14); ctx.fill(); ctx.stroke();
  if (g) { const hd = hatDraw; hatDraw = false; drawDuck(ctx, g, bx + 14 + duckW / 2 - 1, by + bh / 2 + 5, 0.3, false, 0, 1); hatDraw = hd; }
  txt(ctx, label, bx + 14 + duckW, by + bh / 2 + 1, { size: 15, color: INK });
  if (g && g.c > 0) drawBadge(ctx, g.c, bx + 14 + duckW + tw0 + 6 + badgeSize(g.c, 10) / 2, by + bh / 2, 10);
}
function drawTrail() {
  if (!drag) return;
  const s = drag.duck, r = geo.r;
  const P = [{ x: s.x, y: s.y }, ...drag.pts];
  const col = s.c === 0 ? '#9fb4c0' : COL[s.c].b;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
  ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.62 + 4; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = r * 0.62; ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.26; ctx.stroke();
  const last = drag.pts.length ? drag.pts[drag.pts.length - 1] : P[0];
  ctx.beginPath(); ctx.arc(last.x, last.y, r * 0.55, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
}
function drawGame() {
  hatDraw = true;
  drawFaucet();
  ctx.save();
  drawTub();
  drawDropCue();

  for (const f of fx) {
    if (f.kind !== 'ring') continue;
    const p = f.t / f.dur;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 * (1 - p)).toFixed(3) + ')'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, 6 + p * geo.r * 1.6, 3 + p * geo.r * 0.8, 0, 0, TAU); ctx.stroke();
  }

  const k = geo.r / 38;
  const sorted = ducks.slice().sort((a, b) => a.y - b.y);
  for (const d of sorted) {
    const hu = d.hop > 0 ? 1 - d.hop / 0.5 : 0;
    const bob = Math.sin(d.phase) * 1.6 - Math.sin(hu * Math.PI) * geo.r * 1.1;
    let rot = Math.sin(d.phase * 0.8) * 0.1 + d.vx * 0.002 + (d.hop > 0 ? Math.sin(hu * TAU * 2) * 0.14 : 0);
    let dx = 0;
    if (d.shake > 0 && !reduce) { dx = Math.sin(d.shake * 60) * 3; rot += Math.sin(d.shake * 50) * 0.12; }
    const s = d.age < 0.35 ? Math.max(0.05, easeOutBack(d.age / 0.35)) : 1;
    const fa = fadeOf(d);
    if (fa < 1 && d.rare) {   /* secret ducks are drawn part by part: fade them as one picture so the body does not show through */
      ctx.globalAlpha = 1; const kk = k * s, x0 = d.x + dx - 80 * kk - 20, y0 = d.y + bob - SPR_Y * kk - 20;
      drawFaded(ctx, x0, y0, 160 * kk + 40, SPR_H * kk + 40, fa, null, f => drawDuck(f, d, d.x + dx, d.y + bob, kk, d.flip, rot, 1));
      ctx.globalAlpha = fa;
    } else { ctx.globalAlpha = fa; drawDuckFast(ctx, d, d.x + dx, d.y + bob, k * s, d.flip, rot, k); }
    if (d.rare && !reduce) {
      const a = clock * 3 + d.phase;
      ctx.fillStyle = '#fff6b0'; ctx.strokeStyle = '#c28f10'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const ang = a + i * 2.1, rad = geo.r * (1.2 + 0.2 * Math.sin(a * 1.3 + i));
        star4(ctx, d.x + Math.cos(ang) * rad, d.y + Math.sin(ang) * rad * 0.8, 5 + 2 * Math.sin(a * 2 + i));
        ctx.fill(); ctx.stroke();
      }
    }
  }

  ctx.globalAlpha = 1;
  const over = drag && drag.over && drag.over !== 'home' ? drag.over : null;
  if (drag) {
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.arc(drag.duck.x, drag.duck.y, geo.r * 1.15, 0, TAU); ctx.stroke();
    if (over) { ctx.beginPath(); ctx.arc(over.x, over.y, geo.r * (1.15 + Math.sin(clock * 9) * 0.06), 0, TAU); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  for (const d of sorted) {
    if (d.rare || d.c === 0 || d.age < 0.35) continue;
    ctx.globalAlpha = fadeOf(d);   /* the colour badge fades with its duck */
    drawBadge(ctx, d.c, d.x, d.y + Math.sin(d.phase) * 1.6 - (d.hop > 0 ? Math.sin((1 - d.hop / 0.5) * Math.PI) * geo.r * 1.1 : 0) - geo.r * 1.3, geo.r * 0.5);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  for (const f of fx) {
    const p = f.t / f.dur;
    if (f.front) continue;
    if (f.kind === 'leave') {
      const s = p < 0.3 ? 1 + p / 0.3 * 0.3 : 1.3 * (1 - (p - 0.3) / 0.7);
      drawDuck(ctx, f.g, f.x, f.y, k * Math.max(0.01, s), f.flip, p * 2.2 * f.spin, 1 - p * p);
    } else if (f.kind === 'hop') {
      const hm = geo.home, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const hx = f.x + (hm.x - f.x) * e;
      const hy = f.y + (hm.y + hm.rad * 0.3 - f.y) * e - Math.sin(Math.PI * e) * geo.r * 1.5;
      const sc = p < 0.65 ? 1 : Math.max(0.01, 1 - (p - 0.65) / 0.35);
      drawDuck(ctx, f.g, hx, hy, k * sc, hm.x < f.x, Math.sin(p * TAU * 2) * 0.15, 1);
    } else if (f.kind === 'carry') {
      const conv = clamp(p / 0.22, 0, 1), ce = conv * conv * (3 - 2 * conv);
      const u = clamp((p - 0.22) / 0.78, 0, 1);
      const rise = u * u * (f.my + geo.r * 6);
      const off = geo.r * 0.75;
      const ay = f.ay + (f.my - f.ay) * ce - rise, by = f.by + (f.my - f.by) * ce - rise;
      const ax = f.ax + (f.mx - off - f.ax) * ce, bx = f.bx + (f.mx + off - f.bx) * ce;
      const bs = clamp((p - 0.08) / 0.18, 0, 1);
      const fade = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
      const cx = f.mx, cy = f.my - rise - geo.r * 3.4, br = geo.r * 1.15 * bs;
      ctx.globalAlpha = fade;
      if (bs > 0) {
        ctx.strokeStyle = OUT; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy + br * 1.2); ctx.lineTo(ax, ay - geo.r * 1.1); ctx.moveTo(cx, cy + br * 1.2); ctx.lineTo(bx, by - geo.r * 1.1); ctx.stroke();
        ctx.fillStyle = f.col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(cx, cy, br, br * 1.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - br * 0.2, cy + br * 1.2); ctx.lineTo(cx, cy + br * 1.45); ctx.lineTo(cx + br * 0.2, cy + br * 1.2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath(); ctx.ellipse(cx - br * 0.35, cy - br * 0.45, br * 0.18, br * 0.3, -0.5, 0, TAU); ctx.fill();
      }
      drawDuck(ctx, f.g, ax, ay, k, f.fa, Math.sin(p * 9) * 0.08, 1);
      drawDuck(ctx, f.g, bx, by, k, !f.fa, Math.sin(p * 9 + 1) * 0.08, 1);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'heart') {
      ctx.globalAlpha = 1 - p * p;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.s / 6, f.s / 6);
      ctx.fillStyle = f.col; heart(ctx);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (f.kind === 'petal') {
      ctx.globalAlpha = Math.min(1, 2 * (1 - p));
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      ctx.fillStyle = f.col; ctx.strokeStyle = 'rgba(74,58,48,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, f.s, f.s * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (f.kind === 'zzz') {
      if (f.t >= 0) {
        ctx.globalAlpha = 1 - p * p;
        const zy = f.y - p * 28, zx = f.x + Math.sin(p * 6) * 4;
        txt(ctx, 'z', zx, zy, { size: Math.round(f.s), color: '#5b6fb0', align: 'center', glow: '#ffffff', glowW: 5 });
        ctx.globalAlpha = 1;
      }
    } else if (f.kind === 'drop') {
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = '#8fd3f0'; ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (f.kind === 'star') {
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = f.col; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
      star4(ctx, f.x, f.y, f.s * (1 - p * 0.4)); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  drawHouse();
  drawDrum(ctx);
  drawTrail();

  if (drag && CFG.PREVIEW) {
    if (drag.over === 'home') {
      drawBubble(geo.home.x - 20, geo.home.y - geo.r * 2.6, drag.chain && drag.chain.size ? L().chainBubble(drag.chain.size + 1) : L().bNap, null);
    } else if (over) {
      const mx = (drag.duck.x + over.x) / 2, my = Math.min(drag.duck.y, over.y) - geo.r * 2.3;
      if (over.c === drag.duck.c && over.p === drag.duck.p) drawBubble(mx, my, L().bOuting, null);
      else if (count() >= CFG.CAP) drawBubble(mx, my, L().bFull, null);
      else {
        const c = drag.duck.c | over.c, p = drag.duck.p | over.p;
        drawBubble(mx, my, gname(c, p), { c, p, rare: null });
      }
    }
  }

  for (const t of texts) {
    const p = t.t / t.dur;
    const big = t.kind === 'deliver' ? 1.25 : 0.8;
    let fs = Math.round(geo.r * big);
    setFont(ctx, fs, 900);
    const w0 = tw(ctx, t.text);
    if (w0 > W - 16) { fs = Math.floor(fs * (W - 16) / w0); setFont(ctx, fs, 900); }
    ctx.globalAlpha = 1 - p * p;
    const hw = Math.min(tw(ctx, t.text) / 2 + 6, W / 2), tx = clamp(t.x, hw, W - hw);
    txt(ctx, t.text, tx, t.y, { size: fs, align: 'center', glow: '#ffffff', glowW: 6,
      color: t.kind === 'new' ? '#b02560' : t.kind === 'rare' ? '#9a6a00' : t.kind === 'deliver' ? '#1f7a4a' : INK });
  }
  ctx.globalAlpha = 1;
  hatDraw = false;
}
/* petals spilling from the celebration bubble, drawn over it (kept inside the stage) */
function drawFrontFx(c) {
  c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
  for (const f of fx) {
    if (!f.front) continue;
    const p = f.t / f.dur;
    c.save(); c.globalAlpha = Math.min(1, 2 * (1 - p)); c.translate(f.x, f.y); c.rotate(f.rot);
    c.fillStyle = f.col; c.strokeStyle = 'rgba(74,58,48,0.5)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 0, f.s, f.s * 0.55, 0, 0, TAU); c.fill(); c.stroke();
    c.restore();
  }
  c.restore();
}
/* the delivered duck flies over the HUD to the order card (design coordinates) */
function drawFly(c) {
  const k = geo.r / 38;
  for (const f of fx) {
    if (f.kind !== 'fly') continue;
    const p = f.t / f.dur;
    const tx = TGT.x + TGT.w / 2, ty = TGT.y + TGT.h / 2;
    const e = p * p * (3 - 2 * p);
    const sx0 = f.x + STG.x, sy0 = f.y + STG.y;
    const fxp = sx0 + (tx - sx0) * e + Math.sin(p * TAU) * geo.r * 0.7;
    const fyp = sy0 + (ty - sy0) * e;
    drawDuck(c, Object.assign({ hat: 'none' }, f.g), fxp, fyp, k * (1 + 0.25 * Math.sin(p * Math.PI)) * (1 - 0.55 * e), !(tx > sx0), Math.sin(p * TAU * 2) * 0.15, 1);
  }
}
function drawWall() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#e4f3f8'; ctx.fillRect(0, 0, VW, VH);
  const step = 60 * S, lw = 3 * S;
  ctx.fillStyle = '#cde5ee';
  for (let x = OX % step; x < VW; x += step) ctx.fillRect(x, 0, lw, VH);
  for (let y = OY % step; y < VH; y += step) ctx.fillRect(0, y, VW, lw);
}
function draw() {
  if (!geo) return;
  hits = [];
  drawWall();
  ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * OX, dpr * OY);
  if (state === 'play') drawHud(ctx);
  /* the game stage */
  ctx.save(); ctx.beginPath(); ctx.rect(STG.x, STG.y, STG.w, STG.h); ctx.clip(); ctx.translate(STG.x, STG.y);
  drawGame();
  ctx.restore();
  if (state === 'play' && !zOpen) hit(STG.x, STG.y, STG.w, STG.h, null, { key: 'stage', down: gameDown, move: gameMove, up: gameUp });
  if (state === 'play') {
    drawGauge(ctx);
    drawNotice(ctx);
    drawAch(ctx);
    drawQuick(ctx);
    if (zOpen) drawMenu(ctx);
    ctx.save(); ctx.translate(STG.x, STG.y); drawChain(ctx); drawGuide(ctx); drawCeleb(ctx); drawFrontFx(ctx); if (!zOpen) drawDrumFx(ctx); ctx.restore();
    drawFly(ctx);
  } else drawTitle(ctx);
}

/* ---- language / settings ---- */
document.addEventListener('langchange', () => {
  cv.setAttribute('aria-label', L().cvAria);
  noticeShown = null; refreshNotice();
  lastN = -1; updateGauge();
  if (zOpen) setTab(zTab);
});
setInterval(() => {
  if (resetArm > 0) --resetArm;
  if (wipeArm > 0) --wipeArm;
  if (wipeDone > 0) --wipeDone;
}, 1000);


/* ===== first-play tutorial (mix -> outing -> nap) and the drag spotlight =====
   (While a duck is held, what it cannot join fades: see fadeOf.)
   While it runs the faucet waits, the menu / gauge / pickers are dimmed and inactive, the house stays hidden until the nap lesson,
   and only the move being taught can be made (anything else wobbles back and the wand shows the move), so it can never get stuck. */
const K_TUT = 'duckLab.tutDone';
var guide = null, TUTORIAL = !lsGet(K_TUT);   /* var: refreshNotice may look at guide before this line runs */
/* while a duck is held, what it cannot be joined with fades a little (the background stays as it is) */
let dimK = 0, spotDuck = null;
const spotOn = () => dimK > 0 && !!spotDuck && ducks.includes(spotDuck);
const fadeOf = d => drag && drag.chain && drag.chain.has(d) ? 1 - 0.6 * dimK * (1 - chainVis()) : spotOn() && d !== spotDuck && !canLink(spotDuck, d) ? 1 - 0.6 * dimK : 1;
let gp = [];
const IDLE_HINT = 2.0;   /* seconds without touching before the wand shows how (planned: about 3 s) */
const dragDim = () => state === 'play' && !!drag && ducks.includes(drag.duck);
/* what a held duck may connect to. Normal play: any other duck (an identical one even when the tub is full) and the house.
   In the lesson only the move being taught is allowed. */
function canLink(a, b) {
  if (!a) return false;
  if (b === 'home') return !guide || guide.ph === 'nap';
  if (!b || b === a || b.rare || a.rare) return false;
  const same = a.c === b.c && a.p === b.p;
  if (guide) {
    if (guide.ph === 'mix') return !same && (a.c | b.c) === target.c && (a.p | b.p) === target.p;
    if (guide.ph === 'out') return same;
    return false;
  }
  return same || count() < CFG.CAP;
}
/* a connection the lesson does not want: both ducks wobble and the wand shows the right move at once */
function guideBlocks(a, b) {
  if (!guide || canLink(a, b)) return false;
  a.shake = 0.45; b.shake = 0.45; tone('sine', 260, 200, 0.12, 0.08);
  guide.idle = Math.max(guide.idle || 0, IDLE_HINT);
  return true;
}
const houseK = () => !guide ? 1 : guide.ph === 'nap' ? easeOutBack(clamp(guide.t / 0.5, 0, 1)) : 0;
function guideNotice() {   /* returns true when the lesson owns the notice band */
  const ph = guide.ph, txt = ph === 'out' ? L().rules[1] : ph === 'nap' ? (guide.b ? L().chainRule : L().rules[2]) : '';
  if (ph === 'out' || ph === 'nap') { if (noticeT > 0) return false; if (noticeShown !== txt) { noticeShown = txt; noticeRule = true; } return true; }
  noticeShown = ''; noticeRule = false; return true;   /* mix / wait / tip: the card bubble or the drum talks */
}
function slow(d, on) { if (!d || d === geo.home) return; if (on) { if (d.sp0 === undefined) d.sp0 = d.sp; d.sp = 0.25; } else if (d.sp0 !== undefined) { d.sp = d.sp0; d.sp0 = undefined; } }
function setPair(a, b) { if (guide.a !== a) slow(guide.a, false); if (guide.b !== b) slow(guide.b, false); guide.a = a; guide.b = b; slow(a, true); slow(b, true); }
function findMixPair() {
  const t = target; let best = null, bd = 1e9;
  const ds = ducks.filter(d => !d.rare);
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
    const a = ds[i], b = ds[j];
    if ((a.c | b.c) !== t.c || (a.p | b.p) !== t.p || (a.c === b.c && a.p === b.p)) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}
function findSamePair() {
  const ds = ducks.filter(d => !d.rare); let best = null, bd = 1e9;
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
    const a = ds[i], b = ds[j]; if (a.c !== b.c || a.p !== b.p) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}
/* the nap lesson leads a duck the next order does not need: one whose colours are not part of the target,
   or else one that has a twin in the tub (so sending it home never takes away a needed parent) */
function nearestToHome() {
  const t = target, part = d => t && (d.c & ~t.c) === 0 && (d.p & ~t.p) === 0;
  const twin = d => ducks.some(e => e !== d && !e.rare && e.c === d.c && e.p === d.p);
  const near = list => { let best = null, bd = 1e9; for (const d of list) { const dd = Math.hypot(d.x - geo.home.x, d.y - geo.home.y); if (dd < bd) { bd = dd; best = d; } } return best; };
  const ds = ducks.filter(d => !d.rare);
  return near(ds.filter(d => !part(d))) || near(ds.filter(twin)) || near(ds);
}
function endGuide() { if (guide) { slow(guide.a, false); slow(guide.b, false); } guide = null; }
function startGuide() { endGuide(); gp = []; guide = TUTORIAL ? { ph: 'mix', t: 0, idle: 0 } : null; refreshNotice(); }
function guideHit(x, y) {
  if (!guide || guide.ph !== 'mix') return;
  ring(x, y); stars(x, y, 10, ['#ffd23f', '#ffffff']);
  slow(guide.a, false); slow(guide.b, false);
  guide = { ph: 'wait', t: 0, idle: 0 };
}
function guideOut() { if (!guide || guide.ph !== 'out') return; slow(guide.a, false); slow(guide.b, false); guide = { ph: 'tip', t: 0, idle: 0 }; }
function guideNap() {
  if (!guide || guide.ph !== 'nap') return;
  endGuide(); TUTORIAL = false; lsSet(K_TUT, 1); supplyTimer = 2.5; showNotice(L().tutDone, 4.5); cheer();
}
function updGuide(dt) {
  for (const q of gp) q.t += dt;
  gp = gp.filter(q => q.t < q.dur);
  if (!guide || state !== 'play') return;
  const g = guide; g.t += dt; g.idle = drag ? 0 : (g.idle || 0) + dt;
  if (g.ph === 'mix') {
    if (g.t > 0.4 && !g.bounced) { g.bounced = 1; bounceT = 0.5; }
    if (!g.a || !ducks.includes(g.a) || !ducks.includes(g.b)) { const p = findMixPair(); if (!p) { endGuide(); return; } setPair(p[0], p[1]); }
    if (Math.floor(g.t / 0.22) !== Math.floor((g.t - dt) / 0.22) && g.t > 0.8) { const k = Math.floor(g.t / 0.22) % 2; gp.push({ kind: 'spark', to: k ? 'b' : 'a', t: 0, dur: 0.7 }); }
  } else if (g.ph === 'wait') {
    if (g.t > 2.2) {   /* two identical ducks come out of the faucet for the outing lesson */
      const b = BASES[Math.floor(Math.random() * 3)], gg = geo, w = gg.water, mv = [];
      for (let i = 0; i < 2; i++) {
        const d = makeDuck(b[0], b[1], gg.spawn.x + (i ? 20 : 0), gg.spawn.y + (i ? 6 : 0), 0); ducks.push(d);
        mv.push({ d, x0: d.x, y0: d.y, x1: w.x + w.w * (i ? 0.62 : 0.36), y1: w.y + w.h * 0.48 + (i ? 14 : 0) });
      }
      ring(gg.spawn.x, gg.spawn.y); splash(gg.spawn.x, gg.spawn.y, 8); sfxPlop(); updateGauge();
      guide = { ph: 'out', t: 0, idle: 0, mv }; refreshNotice();
    }
  } else if (g.ph === 'out') {
    if (g.mv && g.t < 1.6) {   /* the pair glides from the faucet into the open middle of the tub */
      const e = 1 - Math.pow(1 - g.t / 1.6, 3);
      for (const m of g.mv) if (ducks.includes(m.d)) { m.d.x = lerp(m.x0, m.x1, e); m.d.y = lerp(m.y0, m.y1, e) - Math.sin(e * Math.PI) * 20; m.d.vx = m.d.vy = 0; }
      if (g.t + dt >= 1.6) { setPair(g.mv[0].d, g.mv[1].d); g.mv = null; }
      return;
    }
    if (!g.a || !ducks.includes(g.a) || !ducks.includes(g.b)) { const p = findSamePair(); if (p) setPair(p[0], p[1]); else { endGuide(); return; } }   /* safety: never stuck */
  } else if (g.ph === 'tip') {
    if (g.t > 5.2) { guide = { ph: 'nap', t: 0, idle: 0 }; ring(geo.home.x, geo.home.y); stars(geo.home.x, geo.home.y - geo.r, 10, ['#ffd23f', '#ffffff', '#ff9ec1']); sfxBirth(); refreshNotice(); }
  } else if (g.ph === 'nap') {
    if (!g.picked) { g.picked = 1; pickNapPair(g); }
    if (g.mv) {   /* the two glide into a row toward the house, and anyone on that path swims aside */
      const e = 1 - Math.pow(1 - clamp(g.t / 1.1, 0, 1), 3);
      for (const m of g.mv) if (ducks.includes(m.d)) { m.d.x = lerp(m.x0, m.x1, e); m.d.y = lerp(m.y0, m.y1, e); m.d.vx = m.d.vy = 0; }
      if (g.t >= 1.1) g.mv = null;
    }
    if (g.b && !ducks.includes(g.b)) { slow(g.b, false); g.b = null; }
    if (!g.a || !ducks.includes(g.a)) { const d = nearestToHome(); if (!d) { endGuide(); return; } if (g.a) slow(g.a, false); g.a = d; slow(d, true); }
  }
}
/* ---- the pointer: a smiling star wand with little wings ---- */
function roundStar(c, r, ri) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a0 = i / 10 * TAU - Math.PI / 2, a1 = (i + 1) / 10 * TAU - Math.PI / 2, r0 = i % 2 ? ri : r, r1 = i % 2 ? r : ri;
    const p0 = [Math.cos(a0) * r0, Math.sin(a0) * r0], p1 = [Math.cos(a1) * r1, Math.sin(a1) * r1], m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    if (i === 0) c.moveTo(m[0], m[1]); else c.quadraticCurveTo(p0[0], p0[1], m[0], m[1]);
  }
  const a = -Math.PI / 2, p = [Math.cos(a) * r, Math.sin(a) * r], a1 = 0.1 * TAU - Math.PI / 2, q = [Math.cos(a1) * ri, Math.sin(a1) * ri];
  c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); c.closePath();
}
function face(c, x, y, s) {
  c.fillStyle = OUT; c.beginPath(); c.arc(x - 3.2 * s, y, 1.4 * s, 0, TAU); c.arc(x + 3.2 * s, y, 1.4 * s, 0, TAU); c.fill();
  c.strokeStyle = OUT; c.lineWidth = 1.3 * s; c.lineCap = 'round'; c.beginPath(); c.arc(x, y + 1.2 * s, 1.8 * s, 0.2, Math.PI - 0.2); c.stroke();
  c.fillStyle = 'rgba(255,120,160,0.55)'; c.beginPath(); c.arc(x - 5.4 * s, y + 2.4 * s, 1.5 * s, 0, TAU); c.arc(x + 5.4 * s, y + 2.4 * s, 1.5 * s, 0, TAU); c.fill();
}
function stick(c, x0, y0, x1, y1, w, col, stripe) {
  const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
  c.save(); c.translate(x0, y0); c.rotate(a);
  c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 2.2; rr(c, 0, -w / 2, L, w, w / 2); c.fill();
  if (stripe) { c.save(); rr(c, 0, -w / 2, L, w, w / 2); c.clip(); c.fillStyle = stripe; for (let s = -4; s < L + 6; s += 7) { c.beginPath(); c.moveTo(s, -w); c.lineTo(s + 3.5, -w); c.lineTo(s - 1.5, w); c.lineTo(s - 5, w); c.closePath(); c.fill(); } c.restore(); }
  rr(c, 0, -w / 2, L, w, w / 2); c.stroke(); c.restore();
}
function wingShape(c) {
  c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(-10, -16, -24, -13); c.quadraticCurveTo(-29, -8, -22, -4); c.quadraticCurveTo(-26, 2, -18, 4); c.quadraticCurveTo(-20, 11, -12, 9); c.quadraticCurveTo(-6, 12, 0, 6); c.closePath();
}
function drawWand(c, press, rp) {
  const k = press ? 1.15 : 1, wob = reduce ? 0 : Math.sin(clock * 3) * 0.12, fl = reduce ? 0 : Math.sin(clock * 12) * 0.25;
  c.save(); c.rotate(-0.46 + wob * 0.4); c.lineJoin = 'round'; c.lineCap = 'round';
  stick(c, 0, -4, 0, 34, 6, '#ffffff', '#ff9ec1');
  c.save(); c.translate(0, 10);   /* little wings where the stick meets the star, and a yellow band just under it */
  for (const sx of [-1, 1]) { c.save(); c.scale(sx, 1); c.translate(-2, 0); c.rotate(-0.25 - fl); c.scale(0.5, 0.5); c.fillStyle = '#ffffff'; c.strokeStyle = OUT; c.lineWidth = 3.2; wingShape(c); c.fill(); c.stroke(); c.restore(); }
  c.fillStyle = '#ffd23f'; c.strokeStyle = OUT; c.lineWidth = 1.5; rr(c, -4.5, 0, 9, 5, 2.5); c.fill(); c.stroke();
  c.restore();
  c.save(); c.scale(k, k);
  const g = c.createRadialGradient(-3, -4, 1, 0, 0, 14); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.6, '#ffd23f'); g.addColorStop(1, '#ffb800');
  c.fillStyle = g; c.strokeStyle = OUT; c.lineWidth = 2.3; roundStar(c, 14, 7); c.fill(); c.stroke();
  face(c, 0, 0.5, 0.75);
  c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(-4.5, -6.5, 2.2, 1.3, -0.6, 0, TAU); c.fill();
  c.restore();
  c.restore();
  if (press && rp >= 0) { c.save(); c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 2.5; c.globalAlpha = 1 - rp; c.beginPath(); c.arc(0, 0, 12 + rp * 12, 0, TAU); c.stroke(); c.restore(); }
}
/* after a few idle seconds the wand traces from one thing to the other */
function drawWandHint(c, a, b) {
  const g = guide; if (g.idle < IDLE_HINT || !a || !b) return;
  const cyc = 1.9, u = ((g.idle - IDLE_HINT) % cyc) / cyc;
  const m = clamp((u - 0.15) / 0.6, 0, 1), e = eIO(m), x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e) - Math.sin(e * Math.PI) * 18;
  const al = u < 0.08 ? u / 0.08 : u > 0.88 ? (1 - u) / 0.12 : 1, press = u < 0.15 || (u > 0.75 && u < 0.88);
  const rp = u < 0.15 ? u / 0.15 : u > 0.75 && u < 0.88 ? (u - 0.75) / 0.13 : -1;
  c.save(); c.globalAlpha = al;
  if (m > 0) {
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 5; c.lineCap = 'round'; c.setLineDash([2, 9]); c.beginPath();
    for (let i = 0; i <= 16; i++) { const v = eIO(m * i / 16), px = lerp(a.x, b.x, v), py = lerp(a.y, b.y, v) - Math.sin(v * Math.PI) * 18; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.stroke(); c.setLineDash([]);
    for (let i = 1; i < 7; i++) { const v = eIO(Math.max(0, m - i * 0.055)); c.save(); c.globalAlpha *= 0.85 - i * 0.11; c.fillStyle = i % 2 ? '#fff6b0' : '#ffc4dc'; star4(c, lerp(a.x, b.x, v) + Math.sin(i * 7.3) * 6, lerp(a.y, b.y, v) - Math.sin(v * Math.PI) * 18 + Math.cos(i * 5.1) * 6, 6 - i * 0.6); c.fill(); c.restore(); }
  }
  c.save(); c.translate(x, y); drawWand(c, press, rp); c.restore();
  c.restore();
}
function glowRing(c, d, col, rx, ry) {
  const k = 1 + 0.08 * Math.sin(clock * 5);
  c.save(); c.strokeStyle = col; c.lineWidth = 3; c.globalAlpha = 0.8; c.setLineDash([5, 5]); c.lineDashOffset = -clock * 18;
  c.beginPath(); c.ellipse(d.x, d.y + geo.r * 0.35, (rx || geo.r * 1.25) * k, (ry || geo.r * 0.62) * k, 0, 0, TAU); c.stroke(); c.restore();
}
function drawGuide(c) {
  const g = guide;
  for (const q of gp) {
    const u = q.t / q.dur;
    if (q.kind === 'spark' && g && g.a && g.ph === 'mix') {
      const d = q.to === 'a' ? g.a : g.b, p0 = { x: TGT.x - STG.x + TGT.w / 2, y: TGT.y - STG.y + TGT.h }, e = eIO(u);
      const x = lerp(p0.x, d.x, e) + Math.sin(e * Math.PI) * 30, y = lerp(p0.y, d.y - geo.r, e);
      c.save(); c.globalAlpha = u > 0.85 ? (1 - u) / 0.15 : 1; c.fillStyle = '#ffd23f'; c.strokeStyle = '#b87900'; c.lineWidth = 1.2; star4(c, x, y, 6); c.fill(); c.stroke(); c.restore();
    }
  }
  if (!g || state !== 'play') return;
  const a = g.a, b = g.b;
  if (g.ph === 'mix' && a && b) {   /* the order card calls its two parents */
    const ov = clamp((g.t - 0.5) / 0.5, 0, 1) * 0.2, w = geo.water;
    if (ov > 0 && !drag) {
      c.save(); rr(c, w.x, w.y, w.w, w.h, 34); c.clip(); c.fillStyle = 'rgba(40,60,80,' + ov.toFixed(2) + ')'; c.beginPath(); c.rect(w.x, w.y, w.w, w.h);
      for (const d of [a, b]) { c.moveTo(d.x + geo.r * 1.7, d.y); c.arc(d.x, d.y, geo.r * 1.7, 0, TAU, true); }
      c.fill('evenodd'); c.restore();
    }
    glowRing(c, a, '#ffd23f'); glowRing(c, b, '#ffd23f');
    if (g.t > 0.6) {
      const bxx = TGT.x - STG.x + 4, byy = TGT.y - STG.y + TGT.h + 12, label = L().tutPair;
      setFont(c, 12.5, 900); const bw = tw(c, label) + 20, k = easeOutBack(clamp((g.t - 0.6) / 0.35, 0, 1));
      c.save(); c.translate(bxx + 20, byy); c.scale(k, k); c.translate(-bxx - 20, -byy);
      box(c, bxx, byy, bw, 26, 13, { fill: '#fffaf0', lw: 2.5 });
      c.fillStyle = '#fffaf0'; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.moveTo(bxx + 18, byy + 1); c.lineTo(bxx + 26, byy - 9); c.lineTo(bxx + 32, byy + 1); c.fill(); c.stroke();
      c.fillRect(bxx + 16, byy + 1.3, 18, 3);
      txt(c, label, bxx + bw / 2, byy + 13.5, { size: 12.5, color: '#b02560', align: 'center' });
      c.restore();
    }
    drawWandHint(c, a, b);
  }
  if (g.ph === 'out' && a && b) {   /* a balloon's shadow over the identical pair */
    const mx = (a.x + b.x) / 2, top = Math.min(a.y, b.y) - geo.r * 2.6 + (reduce ? 0 : Math.sin(clock * 2) * 3), appear = easeOutBack(clamp((g.t - 1.8) / 0.4, 0, 1));
    if (appear > 0) {
      c.save(); c.globalAlpha = 0.9; c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 2.2; c.setLineDash([3, 4]);
      for (const d of [a, b]) { c.beginPath(); c.moveTo(mx, top + 18 * appear); c.quadraticCurveTo((mx + d.x) / 2, top + 30, d.x, d.y - geo.r * 0.9); c.stroke(); }
      c.setLineDash([5, 4]); c.lineDashOffset = -clock * 10; c.fillStyle = 'rgba(255,158,193,0.6)'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(mx, top, 14 * appear, 17 * appear, 0, 0, TAU); c.fill(); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.ellipse(mx - 5, top - 6, 3, 5, -0.5, 0, TAU); c.fill();
      c.restore();
    }
    glowRing(c, a, 'rgba(255,255,255,0.95)'); glowRing(c, b, 'rgba(255,255,255,0.95)');
    drawWandHint(c, a, b);
  }
  if (g.ph === 'tip' && g.t > 1.0) {   /* above the drum, clear of the ball and the prize that pops out under it */
    const k = easeOutBack(clamp((g.t - 1.0) / 0.35, 0, 1)), al = g.t > 4.8 ? (5.2 - g.t) / 0.4 : 1;
    const h = HOME_D(), lines = [L().tutTip1, L().tutTip2], bw = 128, bh = 44, bx = h.x - 46 - bw, by = h.y - 44;
    c.save(); c.globalAlpha = Math.max(0, al); c.translate(bx + bw, by + bh / 2); c.scale(k, k); c.translate(-bx - bw, -by - bh / 2);
    box(c, bx, by, bw, bh, 14, { fill: '#fffaf0', lw: 2.5, shadow: SHADOW, sy: 3 });
    c.fillStyle = '#fffaf0'; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.moveTo(bx + bw - 1, by + 24); c.lineTo(bx + bw + 12, by + 34); c.lineTo(bx + bw - 1, by + 34); c.fill(); c.stroke(); c.fillRect(bx + bw - 3.5, by + 23, 3, 12);
    txt(c, lines[0], bx + bw / 2, by + 14, { size: 12, align: 'center' }); txt(c, lines[1], bx + bw / 2, by + 30, { size: 12.5, color: '#b02560', align: 'center' });
    c.restore();
  }
  if (g.ph === 'nap' && a) {   /* the house has just appeared: lead one duck home */
    const h = geo.home;
    glowRing(c, a, 'rgba(255,255,255,0.95)'); if (g.b) glowRing(c, g.b, 'rgba(255,255,255,0.95)');
    if (houseK() >= 1) glowRing(c, { x: h.x, y: h.y - geo.r * 0.6 }, '#ffd23f', geo.r * 1.7, geo.r * 1.4);
    if (!g.mv) drawWandPath(c, g.b ? [a, g.b, { x: h.x, y: h.y - geo.r * 0.3 }] : [a, { x: h.x, y: h.y - geo.r * 0.3 }]);
  }
}


/* ===== ducks passed on the way to the house come along (no extra mode or button) ===== */
const K_CTIP = 'duckLab.chainTip';
/* how strongly the picked-up ducks are shown: only once the finger nears the house, so a mix drag stays calm */
function chainVis() {
  if (!drag || !drag.chain || !drag.chain.size) return 0;
  if (drag.over === 'home') return 1;
  const h = geo.home, p = drag.cur || drag.duck;
  return clamp(1 - (Math.hypot(p.x - h.x, p.y - h.y) - geo.r * 1.6) / (geo.r * 3.2), 0, 1);
}
function chainPick(p) {
  if (guide && guide.ph !== 'nap') return;   /* in the lesson only the nap step takes others along */
  if (!drag.chain) drag.chain = new Set();
  for (const d of ducks) if (d !== drag.duck && !d.rare && !drag.chain.has(d) && Math.hypot(d.x - p.x, d.y - p.y) < geo.r * 0.8) {
    if (guide && !makeableWithout([drag.duck, d].concat(Array.from(drag.chain)))) continue;   /* the lesson never takes away a parent the order needs */
    drag.chain.add(d);
    if (chainVis() > 0.3) { d.hop = 0.3; tone('sine', 800, 1000, 0.05, 0.05); }
  }
}
let napQ = [], napT = 0, napDone = 0;
function napMany(list) {
  guideNap();
  napQ = list.filter(d => ducks.includes(d) && !d.rare); napDone = 0; napT = 0;
  for (const d of napQ) { d.vx = 0; d.vy = 0; }
}
function updNapQ(dt) {
  if (!napQ.length) return;
  napT -= dt;
  while (napQ.length && napT <= 0) {
    const d = napQ.shift();
    if (ducks.includes(d)) {
      fx.push({ kind: 'hop', g: { c: d.c, p: d.p, rare: d.rare }, x: d.x, y: d.y, t: 0, dur: 0.75 });
      remove(d); homeBounce = 0.5; stats.nap++; napDone++;
      tone('sine', 500 + Math.min(napDone, 25) * 25, 400, 0.06, 0.05);
    }
    napT += 0.08;
    if (!napQ.length) {   /* all in: one sleepy finish */
      afterStat(); updateGauge(); sfxHome(); zzz(geo.home.x + geo.r * 0.5, geo.home.y - geo.r * 1.5);
      texts.push({ x: geo.home.x - geo.r * 0.8, y: geo.home.y - geo.r * 2.3, text: L().chainDone(napDone), t: 0, dur: 1.6, kind: 'plain' });
    }
  }
}
function drawChain(c) {
  const v = chainVis(); if (v <= 0) return;
  let i = 0;
  for (const d of drag.chain) {
    if (!ducks.includes(d)) continue;
    c.save(); c.globalAlpha = v; c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.setLineDash([5, 4]); c.lineDashOffset = -clock * 14;
    c.beginPath(); c.ellipse(d.x, d.y + geo.r * 0.35, geo.r * 1.2, geo.r * 0.6, 0, 0, TAU); c.stroke(); c.setLineDash([]);
    txt(c, 'z', d.x + geo.r * 0.7, d.y - geo.r * 1.75 + Math.sin(clock * 3 + i++) * 2, { size: 13, color: '#6b6bd8', glow: '#ffffff', glowW: 4 });
    c.restore();
  }
}
/* the nap lesson: two spare ducks in a row toward the house (the order must stay makeable without them) */
function makeableWithout(rm) {
  const t = target, ds = ducks.filter(d => !d.rare && !rm.includes(d));
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) { const a = ds[i], b = ds[j]; if ((a.c | b.c) === t.c && (a.p | b.p) === t.p && !(a.c === b.c && a.p === b.p)) return true; }
  return false;
}
function pickNapPair(g) {
  const h = geo.home, w = geo.water, r = geo.r, ds = ducks.filter(d => !d.rare);
  const byHome = ds.slice().sort((p, q) => Math.hypot(p.x - h.x, p.y - h.y) - Math.hypot(q.x - h.x, q.y - h.y));
  /* a clear row from the house toward the middle of the tub */
  const cx = w.x + w.w / 2, cy = w.y + w.h / 2, L0 = Math.hypot(cx - h.x, cy - h.y) || 1, ux = (cx - h.x) / L0, uy = (cy - h.y) / L0;
  const spot = k => ({ x: clamp(h.x + ux * r * k, w.x + r, w.x + w.w - r), y: clamp(h.y + uy * r * k, w.y + r * 1.4, w.y + w.h - r) });
  const pb = spot(3.4), pa = spot(6.6);
  for (const b of byHome) {
    if (!makeableWithout([b])) continue;
    const as = ds.filter(a => a !== b && makeableWithout([a, b])).sort((p, q) => Math.hypot(p.x - pa.x, p.y - pa.y) - Math.hypot(q.x - pa.x, q.y - pa.y));
    if (!as.length) continue;
    const a = as[0];
    g.a = a; g.b = b; slow(a, true); slow(b, true);
    g.mv = [{ d: a, x0: a.x, y0: a.y, x1: pa.x, y1: pa.y }, { d: b, x0: b.x, y0: b.y, x1: pb.x, y1: pb.y }];
    /* everyone else within reach of the row swims sideways out of the way */
    for (const d of ds) {
      if (d === a || d === b) continue;
      const t = clamp(((d.x - h.x) * ux + (d.y - h.y) * uy) / (r * 8), 0, 1), px = h.x + ux * r * 8 * t, py = h.y + uy * r * 8 * t, dd = Math.hypot(d.x - px, d.y - py);
      if (dd > r * 2.6) continue;
      const sx = dd > 1 ? (d.x - px) / dd : -uy, sy = dd > 1 ? (d.y - py) / dd : ux;
      g.mv.push({ d, x0: d.x, y0: d.y, x1: clamp(px + sx * r * 3, w.x + r, w.x + w.w - r), y1: clamp(py + sy * r * 3, w.y + r * 1.4, w.y + w.h - r) });
    }
    return;
  }
}
/* the wand along a path of points (far duck -> near duck -> house) */
function drawWandPath(c, pts) {
  const g = guide; if (g.idle < IDLE_HINT || pts.length < 2) return;
  const segs = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(L); tot += L; }
  const at = d => { let k = 0; while (k < segs.length - 1 && d > segs[k]) { d -= segs[k]; k++; } const f = segs[k] ? clamp(d / segs[k], 0, 1) : 0; return { x: lerp(pts[k].x, pts[k + 1].x, f), y: lerp(pts[k].y, pts[k + 1].y, f) }; };
  const cyc = 1.5 + tot / 260, u = ((g.idle - IDLE_HINT) % cyc) / cyc;
  const m = clamp((u - 0.15) / 0.6, 0, 1), e = eIO(m), q = at(e * tot);
  const al = u < 0.08 ? u / 0.08 : u > 0.88 ? (1 - u) / 0.12 : 1, press = u < 0.15 || (u > 0.75 && u < 0.88);
  const rp = u < 0.15 ? u / 0.15 : u > 0.75 && u < 0.88 ? (u - 0.75) / 0.13 : -1;
  c.save(); c.globalAlpha = al;
  if (m > 0) {
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 5; c.lineCap = 'round'; c.setLineDash([2, 9]); c.beginPath();
    for (let i = 0; i <= 24; i++) { const p = at(e * tot * i / 24); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }
    c.stroke(); c.setLineDash([]);
  }
  c.save(); c.translate(q.x, q.y); drawWand(c, press, rp); c.restore();
  c.restore();
}

/* ---- loop ---- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (geo) { update(dt); draw(); }
  requestAnimationFrame(frame);
}
document.title = L().pageTitle;
document.documentElement.lang = lang;
cv.setAttribute('role', 'img');
cv.setAttribute('aria-label', L().cvAria);
fit();
layout();
fillStart();
updateDot();
window.addEventListener('resize', fit);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
if (window.ResizeObserver) new ResizeObserver(fit).observe(cv);
requestAnimationFrame(frame);
})();
