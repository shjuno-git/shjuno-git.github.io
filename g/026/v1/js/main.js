// ===== つまみ(名前と単位付き) =====
const CFG = {
  playTime: 20,        // s    制限時間
  startFill: 0.56,     //      はじめに埋まっている高さ(バッグの深さに対する割合)
  spawnEvery: 0.62,    // s    上から荷物が降ってくる間隔
  spawnLv2: 0.18,      //      降ってくる荷物が はじめから Lv2 の確率
  maxLv: 5,            //      合体の上限
  radius: [0, 21, 26, 32, 39, 47], // px Lv ごとの半径
  followK: 0.45,       //      つかんだ荷物が指に追いつく速さ(1フレームで差の何割)
  followMax: 22,       // px/frame つかんだ荷物の最高速度(速すぎると壁をすり抜ける)
  holdMassK: 6,        // 倍   つかんでいる間の重さ(ほかの荷物を押しのける強さ)
  flingVy: 900,        // px/s はなす直前にこれより速く上に動かしていたら ポイッと放り出す
  flingUp: 28,         // px   はなす直前 0.1 秒で これ以上 上に動いていたら
  shinyRate: 0.05,     //      色違い(キンイロ)が出る確率
  itemScale: 1,
  // 軽さ
  circleSides: 12,     //      当たり判定の円の角の数(物理エンジンの下限は10)
  posIter: 4, velIter: 3, // 物理の計算回数(標準は 6 / 4。減らすと軽いが 重なりが残りやすい)
  maxSteps: 2,         //      1フレームで進める物理の最大回数(重い端末で 処理落ち→さらに重い の悪循環を防ぐ)
  maxItems: 70,        //      これ以上あるときは 新しく降らせない
  maxParts: 160,       //      パーティクルの上限
  // お気に入り: 触ったり合体させた荷物ほど 上から降ってきやすくなる(ほかの荷物は 出やすさ 1 のまま)
  // ポイントがたまるほど出やすくなるが、はじめは伸びが大きく だんだん ゆるやかになる
  //   出やすさ = 1 + favorMax × (1 - e^(-ポイント / favorK))   ※ ほかの荷物は 1 のまま
  //   例(今の値): 1pt→1.3  3pt→1.8  8pt→2.6  15pt→3.1  25pt→3.4(このとき 降ってくる荷物の約3割)
  favorTouch: 1,       // pt   つかむたびに
  favorAim: 2,         // pt   つかんだ荷物で合体させたら
  favorChain: 1,       // pt   同じドラッグで 2回目以降の合体(連鎖)は さらに(回数ぶん)
  favorMax: 2.5,       //      上乗せの上限(出やすさは最大 1 + これ)
  favorK: 8,           // pt   ゆるやかさ(大きいほど ゆっくり伸びる)
};

const W = 360, H = 640;
const BAG = { x0: 34, x1: 326, floor: 592, rim: 214, wall: 14 };
const inCircle = (p, c) => Math.hypot(p.x - c.cx, p.y - c.cy) <= c.r + 10;
const cv = document.getElementById('c'); let ctx = cv.getContext('2d'); // シェア画像を描くときだけ 一時的に別のキャンバスへ切り替える
let scale = 1, dpr = 1;
function resize(){
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  scale = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
}
addEventListener('resize', resize); resize();
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const norm = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

const { Engine, Bodies, Body, Composite, Query, Events } = Matter;

// ===== 荷物(8種類 × Lv1〜5) =====
// cat: p=実用 r=ロマン。形はすべて まる(合体しやすく、かき混ぜやすい)
// sp: この荷物をいちばん育てると その種族の相棒になる(荷物は各種族の持ち物にしてある)
const KINDS = [
  { get name() { return i18n('itemNames')[0]; },   e: '🌰', cat: 'p', col: '#f3dcc0', sp: 'squirrel' },
  { get name() { return i18n('itemNames')[1]; },   e: '🍏', cat: 'p', col: '#fff3b8', sp: 'elephant' },
  { get name() { return i18n('itemNames')[2]; },   e: '🥕', cat: 'p', col: '#cfe9f7', sp: 'rabbit' },
  { get name() { return i18n('itemNames')[3]; },   e: '🏮', cat: 'p', col: '#f5f0e6', sp: 'owl' },
  { get name() { return i18n('itemNames')[4]; },       e: '💎', cat: 'r', col: '#e4d6fb', sp: 'dragon' },
  { get name() { return i18n('itemNames')[5]; },         e: '🔔', cat: 'r', col: '#f9cfd9', sp: 'cat' },
  { get name() { return i18n('itemNames')[6]; }, e: '🕶️', cat: 'r', col: '#ffe0b5', sp: 'duck' },
  { get name() { return i18n('itemNames')[7]; },       e: '☁️', cat: 'r', col: '#8cc6ea', sp: 'sheep' },
];
// LV[k][lv] = 描画と当たり判定に使う def
const LV = KINDS.map((k, ki) => CFG.radius.map((r, lv) => ({ name: k.name, e: k.e, cat: k.cat, col: k.col, shape: 'circle', s: r, kind: ki, lv })));
const BASE_ITEMS = []; // 旧コードとの互換用(使わない)
// ===== 荷物の形 =====
// circle は s(半径)。それ以外は w×h の箱に収まる凸形(頂点の並び)で、当たり判定と見た目に同じ頂点を使う
// sym = 何度回すと同じ形に戻るか(診断の「向きのそろい具合」用)。0 = 向きなし
function roundPoly(pts, r){ // 角を丸める(凸のまま)
  if (!r) return pts;
  const out = [];
  pts.forEach((v, i) => {
    const p = pts[(i + pts.length - 1) % pts.length], n = pts[(i + 1) % pts.length];
    const lp = Math.hypot(p[0] - v[0], p[1] - v[1]), ln = Math.hypot(n[0] - v[0], n[1] - v[1]);
    const ra = Math.min(r, lp / 2 - 0.01), rb = Math.min(r, ln / 2 - 0.01);
    const a = [v[0] + (p[0] - v[0]) / lp * ra, v[1] + (p[1] - v[1]) / lp * ra], b = [v[0] + (n[0] - v[0]) / ln * rb, v[1] + (n[1] - v[1]) / ln * rb];
    for (let k = 0; k <= 4; k++){ const t = k / 4, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * v[0] + t * t * b[0], u * u * a[1] + 2 * u * t * v[1] + t * t * b[1]]); }
  });
  return out;
}
const ellPts = (w, h, egg, n = 20) => Array.from({ length: n }, (_, i) => { const a = i / n * 6.283, y = Math.sin(a) * h / 2; return [Math.cos(a) * w / 2 * (1 + egg * y / (h / 2)), y]; });
const regPts = (n, w, h, a0) => { const p = Array.from({ length: n }, (_, i) => { const a = a0 + i / n * 6.283; return [Math.cos(a), Math.sin(a)]; }); const xs = p.map(q => q[0]), ys = p.map(q => q[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); return p.map(q => [(q[0] - (x0 + x1) / 2) / (x1 - x0) * w, (q[1] - (y0 + y1) / 2) / (y1 - y0) * h]); };
const boxPts = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
const SHAPES = {
  circle:  { label: 'まる',     sym: 0 },
  rect:    { label: 'しかく',   sym: Math.PI / 2, verts: (w, h) => roundPoly(boxPts(w, h), 5) },
  roundsq: { label: 'かどまる', sym: Math.PI / 2, verts: (w, h) => roundPoly(boxPts(w, h), Math.min(w, h) * 0.3) },
  capsule: { label: 'カプセル', sym: Math.PI,     verts: (w, h) => roundPoly(boxPts(w, h), Math.min(w, h) / 2) },
  oval:    { label: 'だえん',   sym: Math.PI,     verts: (w, h) => ellPts(w, h, 0) },
  egg:     { label: 'たまご',   sym: 6.283,       verts: (w, h) => ellPts(w, h, 0.22) },
  dome:    { label: 'ドーム',   sym: 6.283,       verts: (w, h) => roundPoly(Array.from({ length: 13 }, (_, i) => { const a = Math.PI + i / 12 * Math.PI; return [Math.cos(a) * w / 2, h / 2 + Math.sin(a) * h]; }), 3) },
  tri:     { label: 'さんかく', sym: Math.PI * 2 / 3, verts: (w, h) => roundPoly([[0, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 4) },
  trap:    { label: 'だいけい', sym: 6.283,       verts: (w, h) => roundPoly([[-w * 0.3, -h / 2], [w * 0.3, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 4) },
  cup:     { label: 'さかさ台形', sym: 6.283,     verts: (w, h) => roundPoly([[-w / 2, -h / 2], [w / 2, -h / 2], [w * 0.3, h / 2], [-w * 0.3, h / 2]], 4) },
  diamond: { label: 'ひしがた', sym: Math.PI,     verts: (w, h) => roundPoly([[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]], 3) },
  shield:  { label: 'たて',     sym: 6.283,       verts: (w, h) => roundPoly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h * 0.08], [0, h / 2], [-w / 2, h * 0.08]], 4) },
  house:   { label: 'いえ',     sym: 6.283,       verts: (w, h) => roundPoly([[0, -h / 2], [w / 2, -h * 0.08], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h * 0.08]], 4) },
  pent:    { label: '五角',     sym: Math.PI * 2 / 5, verts: (w, h) => roundPoly(regPts(5, w, h, -Math.PI / 2), 3) },
  hex:     { label: '六角',     sym: Math.PI / 3, verts: (w, h) => roundPoly(regPts(6, w, h, 0), 3) },
};
// 形の計算結果(頂点・絵文字を置く内接円・はみ出し幅)を def ごとに1回だけ作る
function itemGeom(def){
  if (def._g) return def._g;
  let g;
  if (def.shape === 'circle' || !SHAPES[def.shape]) g = { v: null, ic: { x: 0, y: 0, r: def.s }, hw: def.s, top: def.s, bottom: def.s };
  else {
    let v = SHAPES[def.shape].verts(def.w, def.h);
    // 面積の重心を原点に(物理エンジンの重心と見た目を一致させる)
    let A = 0, cx = 0, cy = 0;
    v.forEach((p, i) => { const q = v[(i + 1) % v.length], c = p[0] * q[1] - q[0] * p[1]; A += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; });
    A /= 2; cx /= 6 * A; cy /= 6 * A;
    v = v.map(p => [p[0] - cx, p[1] - cy]);
    const sg = A > 0 ? 1 : -1; // 頂点の回り向き
    // 内接円: 全部の辺からいちばん遠い点(格子で探す)
    const xs = v.map(p => p[0]), ys = v.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const dEdge = (x, y) => { let m = 1e9; v.forEach((p, i) => { const q = v[(i + 1) % v.length], ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey) || 1; m = Math.min(m, sg * (ex * (y - p[1]) - ey * (x - p[0])) / L); }); return m; };
    let best = { x: 0, y: 0, r: -1 };
    for (let i = 0; i <= 30; i++) for (let j = 0; j <= 30; j++){ const x = x0 + (x1 - x0) * i / 30, y = y0 + (y1 - y0) * j / 30, d = dEdge(x, y), sc = d - 0.002 * Math.hypot(x, y); if (sc > best.sc || best.sc === undefined) best = { x, y, r: d, sc }; }
    if (best.r <= 0) best = { x: 0, y: 0, r: Math.min(x1 - x0, y1 - y0) / 2 };
    g = { v, ic: best, hw: Math.max(-x0, x1), top: -y0, bottom: y1 };
  }
  return (def._g = g);
}
function shapePath(c, def){ // c = 2D コンテキスト
  const g = itemGeom(def);
  c.beginPath();
  if (!g.v) c.arc(0, 0, def.s, 0, 6.283);
  else { g.v.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); }
}
// 絵文字は内接円の中に収める(絵文字の絵はフォントサイズの約1.1倍の四角に描かれるので 円の直径×0.78 前後)
// def.emoji があれば その大きさで固定(輪郭だけ小さくしたいとき用)
function emojiFont(def){ return def.emoji || itemGeom(def).ic.r * 1.62; }
const ITEMS = BASE_ITEMS.map(d => { const k = CFG.itemScale; const o = Object.assign({}, d); if (o.s) o.s *= k; if (o.w){ o.w *= k; o.h *= k; } if (o.emoji) o.emoji *= k; return o; });
function makeBody(def, x, y, angle){
  let b;
  const opt = { restitution: 0.12, friction: 0.6, frictionStatic: 0.8, density: 0.002, angle: angle || 0 };
  const g = itemGeom(def);
  if (!g.v) b = Bodies.circle(x, y, def.s, opt);
  else b = Bodies.fromVertices(x, y, [g.v.map(p => ({ x: p[0], y: p[1] }))], opt);
  b.def = def; b.rocket = 0; b.flying = false;
  return b;
}
function halfH(def){ return itemGeom(def).bottom; } // 中心から底まで

// ===== 音 =====
let AC = null, master = null, noiseBuf = null;
// 音のオン/オフ（タイトルと遊ぶ画面の左下のボタン）。選んだ方をこの端末に覚えておく
const MUTE_KEY = 'ikimon_mute';
let muted = false; try{ muted = localStorage.getItem(MUTE_KEY) === '1'; }catch(e){}
const MASTER_VOL = 0.8;
function setMuted(m){
  muted = m; try{ localStorage.setItem(MUTE_KEY, m ? '1' : '0'); }catch(e){}
  if (master){ master.gain.cancelScheduledValues(0); master.gain.value = m ? 0 : MASTER_VOL; }
}
function initAudio(){
  if (!AC){
    try{
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = muted ? 0 : MASTER_VOL; master.connect(AC.destination);
      const len = AC.sampleRate; noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }catch(e){ AC = null; }
  }
  if (AC && AC.state !== 'running'){ try{ AC.resume(); }catch(e){} }
}
function envG(t, peak, a, d){ const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(master); return g; }
function tone(type, f0, f1, dur, peak, delay){ if (!AC) return; const t = AC.currentTime + (delay || 0); const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.connect(envG(t, peak, 0.01, dur)); o.start(t); o.stop(t + dur + 0.05); }
// delay は tone と同じく「何秒後に鳴らすか」。以前は受け取っておらず、渡しても先頭で鳴っていた
function noise(type, f0, f1, dur, peak, delay){ if (!AC) return; const t = AC.currentTime + (delay || 0); const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); s.connect(f); f.connect(envG(t, peak, 0.01, dur)); s.start(t); s.stop(t + dur + 0.05); }
const sfx = {
  pick(){ if (FEEL){ feelBubble(480, 0, 0.11); return; } tone('triangle', 500, 700, 0.06, 0.08); },
  drop(){ tone('sine', 300, 180, 0.1, 0.1); },
  rocket(){ if (FEEL){ feelDroplet(520, 0, 0.05, 0.1); return; } noise('bandpass', 500, 3500, 0.5, 0.3); tone('sawtooth', 120, 600, 0.35, 0.05); },
  spill(){ if (FEEL){ feelDroplet(820, 0, 0.13, 0.2); noise('highpass', 2600, 3400, 0.07, 0.018); /* 遅らせず先頭で（今までの鳴り方） */ feelDroplet(1180, 0.09, 0.05, 0.09); return; } tone('sine', 400, 200, 0.2, 0.06); },
  lid(){ noise('lowpass', 1200, 200, 0.2, 0.2); tone('sine', 160, 90, 0.15, 0.2); },
  lidBy(lv){
    if (lv < 0.05){ tone('sine', 900, 600, 0.08, 0.08); tone('sine', 1300, 1100, 0.05, 0.04, 0.05); }
    else if (lv < 0.45){ tone('triangle', 320, 220, 0.1, 0.12); noise('lowpass', 900, 300, 0.08, 0.08); }
    else if (lv < 0.95){ noise('lowpass', 1200, 200, 0.2, 0.2); tone('sine', 160, 90, 0.15, 0.2); }
    else { noise('lowpass', 900, 150, 0.35, 0.25); tone('sawtooth', 180, 110, 0.32, 0.06); tone('sine', 120, 70, 0.25, 0.22); }
  },
  pop(){ if (FEEL){ tone('triangle', 300, 900, 0.12, 0.085); return; } noise('bandpass', 800, 4000, 0.35, 0.35); tone('square', 300, 900, 0.12, 0.08); },
  tick(){ if (FEEL){ tone('triangle', 880, 880, 0.06, 0.055); return; } tone('square', 1500, 1400, 0.03, 0.03); },
  fanfare(){ if (FEEL){ [523, 659, 784, 1047, 1319, 1568].forEach((fr, i) => tone('triangle', fr, fr, 0.16, i === 5 ? 0.07 : 0.085, i * 0.08)); return; } [0, 4, 7, 12, 16].forEach((s, i) => tone('triangle', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.3, 0.1, i * 0.1)); },
};


// ===== 相棒モンスターの描画(種族 × 4つの個性) =====
// ax = [きっちり0↔のびのび1, 慎重0↔大胆1, 実用0↔ロマン1, 即決0↔熟考1]
const SPECIES = {
  duck: { get label() { return i18n('spLabel').duck; }, get word() { return i18n('spWord').duck; }, h: 48, s: 90, l: 62, vh: 50, get hornNames() { return i18n('spHorn').duck; } }, // 耳がないので
  cat: { get label() { return i18n('spLabel').cat; }, get word() { return i18n('spWord').cat; }, h: 28, s: 72, l: 62, vh: 22 },
  rabbit: { get label() { return i18n('spLabel').rabbit; }, get word() { return i18n('spWord').rabbit; }, h: 20, s: 30, l: 90, vh: 335 },
  dragon: { get label() { return i18n('spLabel').dragon; }, get word() { return i18n('spWord').dragon; }, h: 135, s: 50, l: 54, vh: 140, get hornNames() { return i18n('spHorn').dragon; } }, // 耳ではなく角なので呼び名を変える
  sheep: { get label() { return i18n('spLabel').sheep; }, get word() { return i18n('spWord').sheep; }, h: 40, s: 40, l: 93, vh: 195, get hornNames() { return i18n('spHorn').sheep; } }, // 耳ではなく うずまきツノなので
  elephant: { get label() { return i18n('spLabel').elephant; }, get word() { return i18n('spWord').elephant; }, h: 210, s: 14, l: 72, vh: 245, get hornNames() { return i18n('spHorn').elephant; } }, // ツノの代わりに牙が出るので
  owl: { get label() { return i18n('spLabel').owl; }, get word() { return i18n('spWord').owl; }, h: 30, s: 40, l: 55, vh: 265 },
  squirrel: { get label() { return i18n('spLabel').squirrel; }, get word() { return i18n('spWord').squirrel; }, h: 27, s: 56, l: 52, vh: 20 },
};
const NAME_PARTS = {   // 名前の部品は i18n.js (nameCol / nameHorn / nameBody)
  get col() { return i18n('nameCol'); },
  get horn() { return i18n('nameHorn'); },
  get body() { return i18n('nameBody'); },
};
const q4 = v => v < 0.2 ? 0 : v < 0.5 ? 1 : v < 0.8 ? 2 : 3;
const L = (a, b, k) => a + (b - a) * k;
const C = (v, a, b) => v < a ? a : v > b ? b : v;
function hueLerp(a, b, k){ let d = ((b - a + 540) % 360) - 180; return (a + d * k + 360) % 360; }
// 色は4段階でくっきり分ける: モノクロ / ビビッド / パステル / ニジイロ
function palette(sp, a3, shiny){
  const b = SPECIES[sp];
  let h = b.h, s = b.s, l = b.l, tier = q4(a3);
  if (shiny){ h = 46; s = 92; l = 62; tier = -1; }
  else if (tier === 0){ s = 3; l = C(b.l - 4, 48, 86); }
  else if (tier === 1){ h = b.vh; s = 88; l = b.l > 85 ? 62 : C(b.l - 4, 50, 60); }
  else if (tier === 2){ h = hueLerp(b.vh, 320, 0.25); s = 62; l = 83; }
  else { h = b.vh; s = 75; l = 70; }
  const f = (dl, ds) => `hsl(${h.toFixed(0)},${C(s + (ds || 0), 0, 100).toFixed(0)}%,${C(l + dl, 5, 97).toFixed(0)}%)`;
  return { main: f(0), dark: f(-20), deep: tier === 0 ? 'hsl(0,0%,22%)' : f(-35, -10), light: f(10), belly: f(16, -15), h, s, l, tier };
}
function rainbow(g, R){
  const gr = g.createLinearGradient(-R, -R, R, R);
  for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, `hsl(${i * 55},80%,72%)`);
  return gr;
}
const POLE_SPECIES = [['duck', 'sheep'], ['elephant', 'dragon'], ['squirrel', 'rabbit'], ['cat', 'owl']];
// 種族は「バッグの中で いちばん育てた荷物」で決める(性格の4軸とは切りはなす)
//   1) いちばん高い Lv の荷物が候補
//   2) 同じ Lv が何種類もあれば、バッグの中の その荷物の量(面積の合計)が多いほう
//   3) 量の差が SPECIES_TIE_AREA 以内なら 僅差としてランダム。そのとき 前回と同じ種族は なるべく避ける
// 荷物8種類は 大きさ・形・降りやすさが同じなので、種族は だいたい均等に出る
const SPECIES_TIE_AREA = 0.15; // 量が 15% 以内の差なら 僅差
function speciesFromBag(inBag){
  const by = KINDS.map((_, k) => ({ k, lv: 0, area: 0 }));
  for (const b of inBag){ const o = by[b.def.kind]; if (!o) continue; o.lv = Math.max(o.lv, b.def.lv); o.area += b.def.s * b.def.s; }
  const top = Math.max(...by.map(o => o.lv));
  let cand;
  if (top <= 0) cand = by.slice(); // バッグが空: どれでも
  else {
    cand = by.filter(o => o.lv === top);
    const maxA = Math.max(...cand.map(o => o.area));
    cand = cand.filter(o => o.area >= maxA * (1 - SPECIES_TIE_AREA));
  }
  const fresh = cand.filter(o => KINDS[o.k].sp !== lastSpecies);
  if (fresh.length) cand = fresh;
  const pick = cand[Math.floor(Math.random() * cand.length)];
  lastSpecies = KINDS[pick.k].sp;
  // 次に育っていた荷物＝「迷った子」（Lv が高い順、同じ Lv なら量が多い順）
  const second = by.filter(o => o.k !== pick.k && o.lv > 0).sort((a, b) => (b.lv - a.lv) || (b.area - a.area))[0];
  return { species: KINDS[pick.k].sp, kind: pick.k, lv: pick.lv, alt: second ? { species: KINDS[second.k].sp, kind: second.k, lv: second.lv } : null };
}
let lastSpecies = null; // 前回の相棒の種族
function creatureName(sp, ax, shiny){
  return [shiny ? i18n('nameShiny') : NAME_PARTS.col[q4(ax[2])], (SPECIES[sp].hornNames || NAME_PARTS.horn)[q4(ax[1])], NAME_PARTS.body[q4(ax[0])], SPECIES[sp].word];
}
// 図鑑ナンバー: 名前の組み合わせ（色 → ツノ・耳 → 体 の順）ごとに 8種族で1番ずつ。種族の並びは SPECIES の順
//   No.001〜512 = 色4 × ツノ4 × 体4 × 種族8、No.513〜640 = キンイロ（ツノ4 × 体4 × 種族8）
function dexNo(sp, ax, shiny){
  const col = shiny ? 4 : q4(ax[2]), combo = (col * 4 + q4(ax[1])) * 4 + q4(ax[0]);
  return combo * 8 + Object.keys(SPECIES).indexOf(sp) + 1;
}
function sstar(g, x, y, r){ g.beginPath(); for (let i = 0; i < 8; i++){ const a = i / 8 * 6.283, rr = i % 2 ? r * 0.38 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }

// ===== 手で調整したイキモン（動物モックのJSON → Canvas描画 → 診断4軸で少し改変） =====
// 新しい動物は 動物モックの「JSONコピー」＋色4つ を足して IKIMON に登録する
const IKIMON = (() => {
// =====================================================================
// 1) ベース定義：動物モックの「JSONコピー」をそのまま貼る + 色4つ + 動物ごとの決まり
// =====================================================================
function fromMockJSON(j){
  const cp = o => JSON.parse(JSON.stringify(o));
  const P = j.parts || {};
  const face = {};
  ['noseSize','nosePosX','nosePosY','mouthSize','mouthPosX','mouthPosY','mouthAngle','mouthLine','cheekPosX','cheekPosY','toothShow','toothWidth','toothLength','toothAngle','toothPosX','toothPosY','toothLineLength','toothLineWidth'].forEach(k => { if (k in P) face[k] = P[k]; });
  return {
    // 「標準」の耳は動物ごとに形が決まっている（モックの resolvedEarType と同じ）
    contour: cp(j.contour), ear: cp(j.ear), earType: j.ear.type === 'standard' ? ({ cat: 'triangle', dog: 'droop', rabbit: 'wide', squirrel: 'round', duck: 'none' }[j.animal] || 'triangle') : j.ear.type,
    itemP: { size: P.itemSize ?? 100, posX: P.itemPosX || 0, posY: P.itemPosY || 0, angle: P.itemAngle || 0 },
    body: cp(j.body), belly: j.belly ? cp(j.belly) : { size: 100, posX: 0, posY: 0 },
    feet: cp(j.feet), tail: j.tail ? cp(j.tail) : null, trunk: j.trunk ? cp(j.trunk) : null,
    hands: j.hands ? cp(j.hands) : null, collar: j.collar ? cp(j.collar) : null,
    eye: cp(P.eye), nose: P.nose, mouth: P.mouth, item: P.item || 'none',
    markings: cp(P.markings || []), whiskers: cp(P.whiskers || []), whiskerStyle: P.whiskerStyle === 'wave' ? 'wave' : 'line',
    wing: j.wing && j.wing.show ? cp(j.wing) : null,
    wool: j.wool && j.wool.show ? cp(j.wool) : null, bodyWool: j.bodyWool && j.bodyWool.show ? cp(j.bodyWool) : null,
    openMouth: P.openMouth ? cp(P.openMouth) : null, fangs: P.fangs ? cp(P.fangs) : null, face,
    beak: P.beak ? cp(P.beak) : null, markColor: P.markingColor === 'belly' ? 'belly' : 'dark',
    bill: j.bill ? cp(j.bill) : null, brows: P.brows && P.brows.show ? cp(P.brows) : null, sgColor: P.sgColor || '#ff3355',
  };
}
const RISU_JSON = {"animal":"squirrel","contour":{"width":70,"height":55,"topFlatten":0,"bottomFlatten":0,"cheekHeight":66,"roundness":100,"flip":false,"cheekPouch":50},"ear":{"type":"vOnigiri","angle":38,"len":60,"thick":65,"round":19,"posX":-13,"posY":24},"body":{"shape":"shizuku","width":61,"height":50,"topWidth":38,"bottomWidth":72,"roundness":96,"angle":0,"posX":0,"posY":2},"feet":{"posX":-3,"posY":-4,"size":93,"angle":25},"tail":{"size":83,"thick":60,"base":33,"curl":125,"angle":30,"posX":-14,"posY":-11,"curlPosX":12,"curlPosY":-11},"parts":{"eye":{"layers":[{"shape":"capsule","mode":"fill","size":100,"w":78,"h":89,"angle":0,"dx":0,"dy":2}],"spacing":100,"posY":0,"scale":100,"lashes":[{"dx":-5,"dy":-6,"angle":-73,"thick":77,"len":30},{"dx":1,"dy":-2,"angle":-32,"thick":77,"len":100}]},"nose":"triangle","mouth":"omega","item":"none","markings":[{"shape":"ellipse","dx":0,"dy":-46,"angle":0,"thick":200,"len":154},{"shape":"ellipse","dx":-26,"dy":-49,"angle":0,"thick":150,"len":126},{"shape":"ellipse","dx":26,"dy":-49,"angle":0,"thick":150,"len":126}],"noseSize":79,"nosePosX":0,"nosePosY":-6,"mouthSize":100,"mouthPosX":0,"mouthPosY":-11,"mouthAngle":0,"cheekPosX":10,"cheekPosY":-5,"toothShow":true,"toothWidth":150,"toothLength":150,"toothAngle":0,"toothPosX":0,"toothPosY":2,"toothLineLength":69,"toothLineWidth":78}};
const NEKO_JSON = {"animal":"cat","contour":{"width":94,"height":70,"topFlatten":8,"bottomFlatten":0,"cheekHeight":72,"roundness":63,"flip":false,"cheekPouch":18},"ear":{"type":"standard","angle":6,"len":67,"thick":86,"round":6,"posX":1,"posY":0},"body":{"shape":"shizuku","width":54,"height":80,"topWidth":45,"bottomWidth":114,"roundness":70,"angle":0,"posX":0,"posY":-4},"belly":{"size":97,"posX":0,"posY":18},"feet":{"posX":5,"posY":1,"size":107,"angle":22},"tail":{"size":94,"angle":-11,"posX":-10,"posY":2},"hands":{"type":"gyoza","size":47,"posX":2,"posY":1,"angle":4,"bulge":87,"claws":true,"clawSize":100,"spacing":4},"collar":{"show":true,"beltThick":150,"beltSize":100,"bellSize":89,"bellPosX":0,"bellPosY":-2,"posX":0,"posY":-6},"parts":{"eye":{"layers":[{"shape":"kamaboko","mode":"outline","size":200,"w":112,"h":126,"angle":4,"dx":0,"dy":3,"line":100},{"shape":"ellipse","mode":"fill","size":60,"w":144,"h":118,"angle":0,"dx":0,"dy":-4,"line":100}],"spacing":100,"posY":0,"scale":100,"lashes":[]},"nose":"triangle","mouth":"omega","item":"none","markings":[{"shape":"ellipse","dx":0,"dy":-77,"angle":0,"thick":101,"len":200},{"shape":"ellipse","dx":-22,"dy":-80,"angle":-10,"thick":101,"len":200},{"shape":"ellipse","dx":22,"dy":-80,"angle":10,"thick":101,"len":200}],"whiskers":[{"dx":52,"dy":-11,"angle":-8,"len":67,"thick":70},{"dx":53,"dy":-5,"angle":0,"len":67,"thick":70},{"dx":53,"dy":1,"angle":6,"len":67,"thick":70}],"openMouth":{"show":true,"w":41,"h":43,"posY":2,"tongue":true},"fangs":{"show":true,"len":141,"width":126,"spacing":131,"posY":0,"angle":0},"noseSize":100,"nosePosX":0,"nosePosY":-11,"mouthSize":136,"mouthPosX":0,"mouthPosY":-15,"mouthAngle":0,"cheekPosX":5,"cheekPosY":-8,"toothShow":false,"toothWidth":100,"toothLength":100,"toothAngle":0,"toothPosX":0,"toothPosY":0,"toothLineLength":75,"toothLineWidth":100}};
// tailKind：しっぽの描き方 / tailSwing：振り方（mirror＝基準角度〜反対側、around＝基準角度±amp）
// spikeStyle：トゲトゲの出し方（tail＝しっぽにトゲ、fangsClaws＝牙と爪）/ cautiousItem：とても慎重で付くもの
const RISU = {
  label: 'リス', word: 'カリカリ',
  colors: { fur: '#c97e3f', dark: '#9c5a24', belly: '#ffedd6', inner: '#f2c49b' },
  tailKind: 'squirrel', tailSwing: { mode: 'mirror' }, spikeStyle: 'tail', cautiousItem: 'acorn',
  params: fromMockJSON(RISU_JSON),
};
const NEKO = {
  label: 'ネコ', word: 'ニャーン',
  colors: { fur: '#f6a94c', dark: '#d9822b', belly: '#fff0d6', inner: '#f8a8b8' },
  tailKind: 'cat', tailSwing: { mode: 'around', amp: 20 }, spikeStyle: 'fangsClaws', cautiousItem: 'collar', mouthAnim: 'yawn',
  params: fromMockJSON(NEKO_JSON),
};
const USAGI_JSON = {"animal":"rabbit","contour":{"width":85,"height":66,"topFlatten":100,"bottomFlatten":0,"cheekHeight":51,"roundness":100,"flip":true,"cheekPouch":22},"ear":{"type":"standard","angle":-90,"len":132,"thick":105,"round":71,"posX":-8,"posY":-19},"body":{"shape":"maru","width":80,"height":65,"topWidth":83,"bottomWidth":96,"roundness":100,"angle":0,"posX":0,"posY":-2},"belly":{"size":100,"posX":0,"posY":10},"feet":{"posX":4,"posY":3,"size":149,"angle":44},"tail":{"size":101,"angle":0,"posX":-5,"posY":-15},"hands":{"type":"round","size":95,"posX":3,"posY":-1,"angle":-19,"bulge":59,"claws":false,"clawSize":100,"spacing":6,"pads":false},"collar":{"show":false,"beltThick":100,"beltSize":100,"bellSize":100,"bellPosX":0,"bellPosY":0,"posX":0,"posY":0},"parts":{"eye":{"layers":[{"shape":"ellipse","mode":"fill","size":100,"w":100,"h":100,"angle":0,"dx":0,"dy":0,"line":100}],"spacing":100,"posY":-1,"scale":103,"lashes":[]},"nose":"small","mouth":"omega","item":"carrot","itemSize":102,"itemPosX":-1,"itemPosY":5,"itemAngle":44,"markings":[],"whiskers":[],"openMouth":{"show":false,"w":100,"h":100,"posY":0,"tongue":true},"fangs":{"show":false,"len":100,"width":100,"spacing":100,"posY":0,"angle":0},"noseSize":100,"nosePosX":0,"nosePosY":-9,"mouthSize":100,"mouthPosX":0,"mouthPosY":-16,"mouthAngle":0,"cheekPosX":1,"cheekPosY":-5,"toothShow":true,"toothWidth":80,"toothLength":105,"toothAngle":0,"toothPosX":0,"toothPosY":0,"toothLineLength":40,"toothLineWidth":56}};
const USAGI = {
  label: 'ウサギ', word: 'ウサウサ',
  colors: { fur: '#ececf4', dark: '#b9b9cc', belly: '#ffffff', inner: '#f8a8c8', tip: '#8e8ea8' },
  noseColor: '#e56b8a', tailKind: 'pompom', spikeStyle: 'ears', cautiousItem: 'carrot', mouthAnim: 'chew',
  // 個性づけ（2026-11-22 採用）：赤い目（ハイライトは左右同じ位置）＋耳の先だけ濃い灰色
  params: (() => {
    const p = fromMockJSON(USAGI_JSON);
    p.eye.layers = [{ shape: 'ellipse', mode: 'fill', color: '#e2465c', size: 100, w: 100, h: 100, dx: 0, dy: 0 }, { shape: 'circle', mode: 'fillWhite', size: 38, w: 100, h: 100, dx: -2.5, dy: -4, noMirror: true }];
    p.earTip = { len: 0.18 };
    return p;
  })(),
};
const DORA_JSON = {"animal":"dragon","contour":{"width":94,"height":55,"topFlatten":0,"bottomFlatten":0,"cheekHeight":73,"roundness":100,"flip":true,"cheekPouch":8},"ear":{"type":"horn","angle":12,"len":107,"thick":77,"round":76,"posX":-11,"posY":9,"bend":-100,"stripes":true},"body":{"shape":"maru","width":80,"height":72,"topWidth":90,"bottomWidth":104,"roundness":92,"angle":0,"posX":0,"posY":0},"belly":{"size":126,"posX":0,"posY":9},"feet":{"posX":9,"posY":-2,"size":150,"angle":45},"tail":{"size":150,"angle":11,"posX":-5,"posY":-18,"thick":100,"bend":100,"flip":true},"hands":{"type":"gyoza","size":43,"posX":0,"posY":1,"angle":33,"bulge":100,"claws":true,"clawSize":200,"spacing":6,"pads":false},"collar":{"show":false,"beltThick":100,"beltSize":100,"bellSize":100,"bellPosX":0,"bellPosY":0,"posX":0,"posY":0},"wing":{"show":true,"size":190,"angle":15,"posX":0,"posY":-20,"bulge":100},"parts":{"eye":{"layers":[{"shape":"cateye","mode":"outline","size":145,"w":136,"h":200,"angle":18,"dx":0,"dy":1,"line":98},{"shape":"circle","mode":"fill","size":90,"w":88,"h":132,"angle":-32,"dx":6,"dy":6,"line":100}],"spacing":98,"posY":-2,"scale":90,"lashes":[]},"nose":"slit","mouth":"v","item":"orb","itemSize":114,"itemPosX":-20,"itemPosY":7,"itemAngle":-8,"markings":[{"shape":"triangle","dx":-13,"dy":-19,"angle":-40,"thick":300,"len":210},{"shape":"circle","dx":0,"dy":42,"angle":0,"thick":228,"len":135},{"shape":"triangle","dx":13,"dy":-19,"angle":40,"thick":300,"len":210}],"whiskers":[{"dx":9,"dy":-1,"angle":-22,"len":130,"thick":88},{"dx":9,"dy":-2,"angle":-7,"len":120,"thick":85}],"whiskerStyle":"wave","openMouth":{"show":false,"w":100,"h":100,"posY":0,"tongue":true},"fangs":{"show":true,"len":175,"width":151,"spacing":134,"posY":0,"angle":0},"noseSize":72,"nosePosX":0,"nosePosY":-6,"mouthSize":142,"mouthPosX":0,"mouthPosY":-12,"mouthAngle":0,"mouthLine":62,"cheekPosX":-25,"cheekPosY":-4,"toothShow":false,"toothWidth":100,"toothLength":100,"toothAngle":0,"toothPosX":0,"toothPosY":0,"toothLineLength":75,"toothLineWidth":100}};
// ドラゴン：牙と爪はもとから付いている。ツノは頭の角そのもの（ツノナガで伸びる）、トゲトゲは翼の上のふちにトゲ、とても慎重で水晶（持ち物）
const DORA = {
  label: 'ドラゴン', word: 'ガオガオ',
  colors: { fur: '#93dcb4', dark: '#3f9e6d', belly: '#fff3d6', inner: '#cdeeda', horn: '#fff3d6' },
  tailKind: 'dragon', tailSwing: { mode: 'around', amp: 20 }, spikeStyle: 'wings', hornStyle: 'grow',
  cautiousItem: 'orb', mouthAnim: 'yawn', yawnSpeed: 1.8, fireBreath: true, // 口を開けたとき ときどき火を噴く
  // ネコ（0.7）より素早く開け閉め
  hornNames: ['マルツノ', 'ミニツノ', 'ツノナガ', 'トゲトゲ'], // 耳ではなく角なので 呼び名を変える
  // 口：ネコと同じ「ときどき口を開ける」（開いた口の形もネコと同じ）
  params: (() => { const p = fromMockJSON(DORA_JSON); p.openMouth = { show: true, w: 41, h: 32, posY: 3, tongue: true }; return p; })(), // 開いた口はネコより浅く・少し下（V字の下だけに見える）
};
const ZOU_JSON = {"animal":"elephant","contour":{"width":118,"height":87,"topFlatten":55,"bottomFlatten":75,"cheekHeight":58,"roundness":70,"flip":false,"cheekPouch":0},"ear":{"type":"angel","angle":65,"len":230,"thick":178,"round":100,"posX":5,"posY":3,"bend":125,"stripes":false},"body":{"shape":"daikei","width":117,"height":82,"topWidth":106,"bottomWidth":118,"roundness":25,"angle":0,"posX":0,"posY":-10},"belly":{"size":150,"posX":0,"posY":10},"feet":{"posX":17,"posY":1,"size":200,"angle":4},"tail":{"size":115,"angle":5,"posX":0,"posY":1,"flip":true},"hands":{"type":"round","size":144,"posX":0,"posY":-2,"angle":16,"bulge":71,"claws":false,"clawSize":108,"spacing":27,"pads":true},"collar":{"show":false,"beltThick":100,"beltSize":100,"bellSize":100,"bellPosX":0,"bellPosY":0,"posX":0,"posY":0},"trunk":{"len":131,"thick":150,"curl":37,"lineWidth":78,"linePos":20,"posY":-10},"parts":{"eye":{"layers":[{"shape":"circle","mode":"fill","size":100,"w":100,"h":100,"angle":0,"dx":0,"dy":0,"line":100}],"spacing":96,"posY":0,"scale":95,"lashes":[{"dx":-8,"dy":-5,"angle":-55,"thick":90,"len":30}],"lashMirror":false},"nose":"none","mouth":"arc","item":"apple","itemSize":138,"itemPosX":0,"itemPosY":20,"itemAngle":16,"markings":[],"whiskers":[],"whiskerStyle":"line","openMouth":{"show":false,"w":107,"h":100,"posY":0,"tongue":true},"fangs":{"show":true,"len":182,"width":119,"spacing":68,"posY":-12,"angle":-30},"noseSize":100,"nosePosX":0,"nosePosY":0,"mouthSize":100,"mouthPosX":0,"mouthPosY":0,"mouthAngle":0,"mouthLine":100,"cheekPosX":0,"cheekPosY":0,"toothShow":false,"toothWidth":100,"toothLength":100,"toothAngle":0,"toothPosX":0,"toothPosY":0,"toothLineLength":75,"toothLineWidth":100}};
// ゾウ：鼻があるので鼻・口は描かない。牙（マンモスの牙）は ツノアリ・トゲトゲだけ、トゲトゲは頭のてっぺんにもトゲ。とても慎重で頭の上にリンゴ
const ZOU = {
  label: 'ゾウ', word: 'パオーン',
  colors: { fur: '#aebfd6', dark: '#7e93b3', belly: '#e9eff8', inner: '#f6c3d0', tip: '#6f84a6' },
  tailKind: 'elephant', spikeStyle: 'head', hornStyle: 'tusks', cautiousItem: 'apple', mouthAnim: 'none',
  footJump: 'stretch', noLashOnCut: true, // 足は丸いまま伸ばす / 即決の削り目では まつげを出さない
  hornNames: ['マルミミ', 'ツノナシ', 'キバアリ', 'トゲトゲ'], // ツノの代わりに牙が出るので
  appleStack: true, // リンゴはいつも頭の上（慎重ほど増える）
  timeScale: 0.6, // 動きは全部ゆっくり（重さのある感じ）
  params: (() => { const p = fromMockJSON(ZOU_JSON); p.itemP.size = 185; p.itemP.posY = 15; p.earSpots = true; p.trunkTip = true; p.spray = 'tip'; p.markings = [{ shape: 'circle', dx: 0, dy: -80, angle: 0, thick: 580, len: 120 }, { shape: 'circle', dx: 0, dy: -56, angle: 0, thick: 560, len: 105 }, { shape: 'circle', dx: 0, dy: -35, angle: 0, thick: 440, len: 85 }]; return p; })(), // リンゴは大きめ。個性づけ：耳の斑点＋鼻先の色＋鼻先だけ曲げて水しぶき＋おでこの しましま（横縞3本、下ほど短い）
};
const clone = o => JSON.parse(JSON.stringify(o));

// =====================================================================
// 2) 描画エンジン（動物モックの buildSVG を Canvas2D に移植）
//    座標はモックと同じ 320x320 の原画座標で描き、最後に拡大縮小する
// =====================================================================
const INK = '#2b2320';
const D2R = Math.PI / 180;
const C = (v, a, b) => v < a ? a : v > b ? b : v;
const L = (a, b, k) => a + (b - a) * k;

const HIYO_JSON = {"animal":"duck","contour":{"width":70,"height":55,"topFlatten":0,"bottomFlatten":31,"cheekHeight":48,"roundness":100,"flip":false,"cheekPouch":38},"ear":{"type":"standard","angle":0,"len":80,"thick":100,"round":80,"posX":0,"posY":0,"bend":100},"body":{"shape":"maru","width":82,"height":72,"topWidth":39,"bottomWidth":86,"roundness":95,"angle":0,"posX":0,"posY":-14},"belly":{"size":70,"posX":0,"posY":-16,"style":"plain"},"feet":{"posX":1,"posY":-4,"size":105,"angle":20},"tail":{"size":53,"angle":76,"posX":-11,"posY":12,"flip":false},"hands":{"type":"wing","size":64,"posX":2,"posY":18,"angle":-2,"bulge":30,"claws":false,"clawSize":123,"spacing":8,"pads":true},"collar":{"show":false,"beltThick":100,"beltSize":100,"bellSize":100,"bellPosX":0,"bellPosY":0,"posX":0,"posY":0},"bill":{"shape":"normal","w":115,"h":111,"point":100,"dome":112,"upPosX":0,"upPosY":4,"lowPosX":0,"lowPosY":-3},"parts":{"eye":{"layers":[{"shape":"spiral","mode":"fill","size":83,"w":100,"h":100,"angle":82,"dx":0,"dy":15,"line":100},{"shape":"circle","mode":"fillWhite","size":41,"w":79,"h":30,"angle":0,"dx":4,"dy":12,"line":100}],"spacing":100,"posY":0,"scale":100,"lashes":[],"lashMirror":true,"mirror":false,"base":"left"},"nose":"none","mouth":"arc","item":"sunglasses","itemSize":142,"itemPosX":0,"itemPosY":23,"itemAngle":0,"markings":[],"whiskers":[],"whiskerStyle":"line","openMouth":{"show":false,"w":115,"h":100,"posY":0,"tongue":true},"fangs":{"show":false,"len":100,"width":100,"spacing":100,"posY":0,"angle":0},"brows":{"show":true,"items":[{"dx":2,"dy":8,"angle":34,"w":46,"h":78,"thick":98}],"spacing":-3,"posY":7,"mirror":true},"sgColor":"#2e7ff2","noseSize":100,"nosePosX":0,"nosePosY":0,"mouthSize":100,"mouthPosX":0,"mouthPosY":0,"mouthAngle":0,"mouthLine":100,"cheekPosX":4,"cheekPosY":-3,"toothShow":false,"toothWidth":100,"toothLength":100,"toothAngle":0,"toothPosX":0,"toothPosY":0,"toothLineLength":75,"toothLineWidth":100}};
// ヒヨコ：耳なし、クチバシ（上下2枚）、ぐるぐる目（左右同じ向き）、マロ眉、頭にサングラス、あほ毛3本。
// サングラスはふだん手に持ち、ときどき目にかける（とても慎重は ずっとかけたまま）。マロ眉を見せるため頭には乗せない。トゲトゲ＝頭のまんなかにトゲ（モヒカン）。ときどきクチバシをパクッと開ける
const HIYO = {
  label: 'ヒヨコ', word: 'ピピッコ',
  colors: { fur: '#fff1a6', dark: '#e8bd45', belly: '#ffffff', inner: '#fff6cf', bill: '#f59a23', billLow: '#f28c13', foot: '#f2a03c' },
  shinyDl: -18, // ベースが薄い黄色なので、キンイロは濃い金色にして見分けやすく
  fixedColors: ['bill', 'billLow', 'foot'], // クチバシと足はオレンジのまま（モノクロだけ灰色に）
  faceKind: 'duck', tailKind: 'duck', spikeStyle: 'mohawk', cautiousItem: 'none', sgMode: 'hand', mouthAnim: 'quack',
  hornNames: ['マルマル', 'ツノナシ', 'ツノアリ', 'トゲトゲ'], // 耳がないので
  params: fromMockJSON(HIYO_JSON),
};
const FUKU_JSON = {"animal":"owl","contour":{"width":83,"height":55,"topFlatten":50,"bottomFlatten":48,"cheekHeight":59,"roundness":100,"flip":false,"cheekPouch":0},"ear":{"type":"triangle","angle":29,"len":60,"thick":60,"round":0,"posX":-23,"posY":4,"bend":29},"body":{"shape":"maru","width":84,"height":80,"topWidth":94,"bottomWidth":104,"roundness":92,"angle":0,"posX":0,"posY":-9},"belly":{"size":150,"w":131,"posX":0,"posY":-3,"triTop":3,"triMid":4,"triBot":3,"style":"plain"},"feet":{"posX":-4,"posY":-14,"size":188,"angle":45},"hands":{"type":"owlWing","size":174,"posX":0,"posY":-17,"angle":15,"bulge":100,"claws":false,"clawSize":100,"spacing":-60,"pads":true},"collar":{"show":false,"beltThick":100,"beltSize":100,"bellSize":100,"bellPosX":0,"bellPosY":0,"posX":0,"posY":0},"parts":{"eye":{"layers":[{"shape":"circle","mode":"outline","size":81,"w":150,"h":140,"angle":1,"dx":0,"dy":2,"line":125},{"shape":"circle","mode":"fill","size":67,"w":151,"h":135,"angle":0,"dx":2,"dy":0,"line":100}],"spacing":103,"posY":-1,"scale":148,"lashes":[],"lashMirror":true,"base":"left","mirror":true},"nose":"pick","mouth":"arc","item":"lanternHang","itemSize":100,"itemPosX":0,"itemPosY":11,"itemAngle":0,"markings":[{"shape":"circle","dx":-27,"dy":-3,"angle":0,"thick":330,"len":289},{"shape":"circle","dx":27,"dy":-3,"angle":0,"thick":330,"len":300},{"shape":"circle","dx":0,"dy":23,"angle":90,"thick":91,"len":377},{"shape":"ellipse","dx":0,"dy":-40,"angle":0,"thick":84,"len":80}],"whiskers":[],"whiskerStyle":"line","openMouth":{"show":false,"w":100,"h":100,"posY":0,"tongue":true},"fangs":{"show":false,"len":100,"width":100,"spacing":100,"posY":0,"angle":0},"brows":{"show":true,"items":[{"dx":9,"dy":-6,"angle":-1,"w":67,"h":44,"thick":100}],"spacing":0,"posY":0,"mirror":true},"sgColor":"#ff3355","noseSize":97,"nosePosX":0,"nosePosY":6,"mouthSize":100,"mouthPosX":0,"mouthPosY":2,"mouthAngle":0,"mouthLine":100,"cheekPosX":0,"cheekPosY":0,"toothShow":false,"toothWidth":100,"toothLength":100,"toothAngle":0,"toothPosX":0,"toothPosY":0,"toothLineLength":75,"toothLineWidth":100,"markingColor":"belly","beak":{"w":108,"len":57,"low":100,"posY":0}}};
// フクロウ：クチバシ（ピック形）からヒモでランタンを下げる（いつも）。とても慎重でランタンが明るく光る。
// 翼は胴の後ろで ときどきバサバサ、顔（頭まるごと）を ときどき左右にかしげる。トゲトゲ＝翼の上のふちにトゲ
const FUKU = {
  label: 'フクロウ', word: 'ホッホー',
  colors: { fur: '#a97c50', dark: '#5d4028', belly: '#f7ead2', inner: '#d9b98c', beak: '#f6a83b', foot: '#f2a03c' },
  fixedColors: ['beak', 'foot'], // クチバシと足はオレンジのまま（モノクロだけ灰色に）
  faceKind: 'owl', noMouth: true, headTilt: true, spikeStyle: 'owlWings', cautiousItem: 'none', alwaysItem: 'lanternHang', mouthAnim: 'none',
  params: fromMockJSON(FUKU_JSON),
};
const HITSUJI_JSON = {"animal":"sheep","contour":{"width":97,"height":86,"topFlatten":0,"bottomFlatten":100,"cheekHeight":30,"roundness":100,"flip":false,"cheekPouch":41},"ear":{"type":"spiral","angle":-98,"len":80,"thick":200,"round":75,"posX":22,"posY":40,"bend":101},"body":{"shape":"maru","width":78,"height":68,"topWidth":95,"bottomWidth":102,"roundness":96,"angle":0,"posX":0,"posY":-10},"belly":{"size":132,"w":50,"posX":0,"posY":-5,"triTop":0,"triMid":0,"triBot":0,"style":"plain"},"feet":{"posX":12,"posY":7,"size":167,"angle":31},"hands":{"type":"gyoza","size":45,"posX":0,"posY":21,"angle":45,"bulge":79,"claws":false,"clawSize":100,"spacing":25,"pads":true},"collar":{"show":false,"beltThick":100,"beltSize":100,"bellSize":100,"bellPosX":0,"bellPosY":0,"posX":0,"posY":0},"wool":{"show":true,"size":133,"thick":337,"bump":48,"posX":0,"posY":0,"frontShow":true,"frontSize":111,"frontThick":397,"frontBump":55,"frontPosX":0,"frontPosY":10},"bodyWool":{"show":true,"size":139,"bump":40,"posX":0,"posY":0},"parts":{"eye":{"layers":[{"shape":"capsule","mode":"outline","size":100,"w":120,"h":100,"angle":0,"dx":0,"dy":20,"line":131}],"spacing":100,"posY":2,"scale":100,"lashes":[{"dx":-8,"dy":19,"angle":-52,"thick":85,"len":85}],"lashMirror":true,"base":"left","mirror":true},"nose":"small","mouth":"omega","item":"yarn","itemSize":116,"itemPosX":40,"itemPosY":27,"itemAngle":-20,"markings":[],"whiskers":[],"whiskerStyle":"line","openMouth":{"show":false,"w":100,"h":100,"posY":0,"tongue":true},"fangs":{"show":false,"len":100,"width":100,"spacing":100,"posY":0,"angle":0},"brows":{"show":false,"items":[{"dx":0,"dy":0,"angle":0,"w":100,"h":100,"thick":100}],"spacing":0,"posY":0,"mirror":true},"sgColor":"#ff3355","noseSize":100,"nosePosX":0,"nosePosY":1,"mouthSize":123,"mouthPosX":0,"mouthPosY":-10,"mouthAngle":0,"mouthLine":50,"cheekPosX":2,"cheekPosY":0,"toothShow":false,"toothWidth":100,"toothLength":100,"toothAngle":0,"toothPosX":0,"toothPosY":0,"toothLineLength":75,"toothLineWidth":100}};
// ヒツジ：頭のまわりと体はモコモコの毛（白い円の集まり）、耳の代わりに うずまきのツノ。持ち物＝毛糸玉（いつも）。
// 毛糸玉は 右手と左手のあいだで 床にバウンドさせるドリブル。口はモグモグ。トゲトゲ＝頭の毛のまわりにトゲ
const HITSUJI = {
  label: 'ヒツジ', word: 'モコモコ',
  colors: { fur: '#f3e3c2', dark: '#b98d5f', belly: '#fdf6e3', inner: '#f6b8c1', horn: '#d9b48f', wool: '#ffffff' },
  shinyDl: -22, // 白い毛だと金色が薄く見分けにくいので、キンイロは濃い金色に
  sheepLayer: true, hornStyle: 'grow', spikeStyle: 'wool', cautiousItem: 'none', alwaysItem: 'yarn', mouthAnim: 'chew',
  hornNames: ['チビツノ', 'マキツノ', 'オオツノ', 'トゲトゲ'], // 耳ではなく うずまきのツノなので
  params: fromMockJSON(HITSUJI_JSON),
};
function headGeom(c, cx, cy){
  const D = 168, W = D * c.width / 100, H = D * c.height / 100;
  let tf = c.topFlatten, bf = c.bottomFlatten, ch = c.cheekHeight;
  if (c.flip){ const t = tf; tf = bf; bf = t; ch = 100 - ch; }
  const topH = H * ch / 100, botH = H - topH, a = W / 2;
  const nx = 2 + (100 - c.roundness) / 100 * 2.2, nt = 2 + tf / 100 * 3, nb = 2 + bf / 100 * 3;
  const pouch = (c.cheekPouch || 0) / 100, pts = [], N = 144;
  for (let i = 0; i < N; i++){
    const th = i / N * Math.PI * 2, co = Math.cos(th), si = Math.sin(th);
    let x = cx + a * Math.sign(co) * Math.pow(Math.abs(co), 2 / nx);
    const y = si < 0 ? cy - topH * Math.pow(Math.abs(si), 2 / nt) : cy + botH * Math.pow(Math.abs(si), 2 / nb);
    if (pouch > 0){
      const v = C((y - (cy - topH)) / H, 0, 1), dv = v - 0.76, gauss = Math.exp(-(dv * dv) / (2 * 0.135 * 0.135));
      const bulge = pouch * a * 0.30 * gauss * Math.pow(Math.abs(co), 1.15);
      if (co !== 0) x += Math.sign(co) * bulge;
    }
    pts.push([x, y]);
  }
  return { pts, W, H, top: cy - topH, bottom: cy + botH, cx, cy, topH, botH };
}
function bodyGeom(b, cx, cy){
  const BW = 118 * b.width / 100, BH = 92 * b.height / 100, a = BW / 2, n = 2 + (100 - b.roundness) / 100 * 2.4, pts = [];
  for (let i = 0; i < 56; i++){
    const th = i / 56 * Math.PI * 2, co = Math.cos(th), si = Math.sin(th);
    let tt = C((si + 0.45) / 0.9, 0, 1); tt = tt * tt * (3 - 2 * tt);
    const f = (b.topWidth * (1 - tt) + b.bottomWidth * tt) / 100;
    pts.push([cx + a * f * Math.sign(co) * Math.pow(Math.abs(co), 2 / n), si < 0 ? cy - BH / 2 * Math.pow(Math.abs(si), 2 / n) : cy + BH / 2 * Math.pow(Math.abs(si), 2 / n)]);
  }
  return { pts, W: BW, H: BH };
}
function poly(g, pts, keep){ if (!keep) g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
function smoothClosed(g, pts){
  const n = pts.length; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++){
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  g.closePath();
}
function spiral(g, cx, cy, maxR, turns){
  g.beginPath();
  for (let i = 0; i <= 90; i++){ const t = i / 90 * Math.PI * 2 * turns, r = maxR * i / 90; g.lineTo(cx + r * Math.cos(t - Math.PI / 2), cy + r * Math.sin(t - Math.PI / 2)); }
}
function fillStroke(g, fill, lw){ g.fillStyle = fill; g.fill(); if (lw){ g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); } }
function ell(g, x, y, rx, ry, rot){ g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }

// ---- 耳（縦長おにぎり / 標準の三角系）----
function earPath(g, type, e, inner){
  const Ln = 54 * e.len / 100, T = 34 * e.thick / 100, r = e.round / 100;
  if (type === 'vOnigiri'){
    let ow = T * 1.08, oh = Ln * 1.48;
    if (inner){ const io = { w: ow * 0.54, h: oh * 0.66 }; const h = io.w / 2, tip = 4 - io.h, tr = 2 + r * 5, sh = -io.h * 0.52 + 2;
      g.beginPath(); g.moveTo(-h, 3); g.quadraticCurveTo(-h * 1.1, sh, -tr, tip); g.quadraticCurveTo(0, tip - tr * 0.55, tr, tip); g.quadraticCurveTo(h * 1.1, sh, h, 3); g.quadraticCurveTo(0, 6.5, -h, 3); g.closePath(); return; }
    const h = ow / 2, tip = -oh, tr = 3.5 + r * 9, sh = -oh * 0.52;
    g.beginPath(); g.moveTo(-h, 6); g.quadraticCurveTo(-h * 1.12, sh, -tr, tip); g.quadraticCurveTo(0, tip - tr * 0.55, tr, tip); g.quadraticCurveTo(h * 1.12, sh, h, 6); g.quadraticCurveTo(0, 11, -h, 6); g.closePath(); return;
  }
  if (type === 'angel'){ // 天使の羽の耳（ゾウ）：根元から上外へふくらみ、下のふちは3つのなみなみ
    const aw = Ln * 0.98, ah = T * 1.02;
    g.beginPath();
    if (inner){ const iw = aw * 0.58, ih = ah * 0.56, ix = aw * 0.17, iy = -ah * 0.10;
      g.moveTo(ix, iy + ih * 0.38); g.bezierCurveTo(ix, iy - ih * 0.30, ix + iw * 0.28, iy - ih * 0.60, ix + iw * 0.60, iy - ih * 0.54);
      g.bezierCurveTo(ix + iw * 0.92, iy - ih * 0.48, ix + iw * 1.03, iy - ih * 0.12, ix + iw * 0.92, iy + ih * 0.16); g.quadraticCurveTo(ix + iw * 0.42, iy + ih * 0.44, ix, iy + ih * 0.38); g.closePath(); return; }
    const sc = (0.10 + 0.13 * r) * ah;
    g.moveTo(0, 3); g.bezierCurveTo(-2, -ah * 0.52, aw * 0.22, -ah * 0.98, aw * 0.55, -ah * 0.94); g.bezierCurveTo(aw * 0.86, -ah * 0.90, aw * 1.03, -ah * 0.62, aw * 0.99, -ah * 0.30);
    g.quadraticCurveTo(aw * 0.835, -ah * 0.17 + sc, aw * 0.68, -ah * 0.04); g.quadraticCurveTo(aw * 0.53, ah * 0.01 + sc, aw * 0.38, ah * 0.06);
    g.quadraticCurveTo(aw * 0.23, ah * 0.08 + sc, aw * 0.08, ah * 0.10); g.quadraticCurveTo(aw * 0.02, ah * 0.02, 0, 3); g.closePath(); return;
  }
  if (type === 'wide'){ // 横長耳（ウサギ）：長い楕円。回転して縦に立てる
    const wl = Ln * 0.85, wt = T * 0.62;
    if (inner) ell(g, wl * 0.36, -wt * 0.3, wl * 0.58, wt * 0.5); else ell(g, wl * 0.32, -wt * 0.3, wl, wt);
    return;
  }
  const tipY = -Ln, sh = -(Ln * (0.35 + 0.3 * r)), tc = 4 + r * 16;
  if (inner){ g.beginPath(); g.moveTo(-T * 0.52, 2); g.quadraticCurveTo(-T * 0.5, sh * 0.8, 0, tipY * 0.68); g.quadraticCurveTo(T * 0.5, sh * 0.8, T * 0.52, 2); g.quadraticCurveTo(0, 8, -T * 0.52, 2); g.closePath(); return; }
  g.beginPath(); g.moveTo(-T, 6); g.quadraticCurveTo(-T * 1.02, sh, -tc, tipY); g.quadraticCurveTo(0, tipY - tc * 0.55, tc, tipY); g.quadraticCurveTo(T * 1.02, sh, T, 6); g.quadraticCurveTo(0, 16, -T, 6); g.closePath();
}
// 体が浮くほど 1 に近づく（ぴょんぴょんの山）。足・耳はこれに合わせて左右同時に動く
function jumpOf(t, seed){ return Math.pow(Math.max(0, -Math.sin(t * 2.2 + seed)), 1.5); }
function drawEars(g, s, head, A, t, seed, ext){
  if (s.earType === 'spiral') return; // ヒツジのうずまきツノは 頭のあと（drawSpiralHorns）
  if (s.earType === 'none') return; // 耳なし（ヒヨコ）
  const jumpK = jumpOf(t, seed);
  const e = s.ear, vert = s.earType === 'vOnigiri' || s.earType === 'vKamaboko';
  const baseY = head.top + head.H * (vert ? 0.20 : 0.16) + e.posY, bx = head.W * (vert ? 0.32 : 0.34) + e.posX;
  const outer = g.getTransform(), wide = s.earType === 'wide';
  for (const sd of [-1, 1]){
    if (s.earType === 'horn'){ // ドラゴンの角：耳のようには動かさない
      g.save(); g.translate(head.cx + sd * bx, baseY); g.rotate(sd * (14 + e.angle) * D2R); g.scale(sd, 1);
      drawDragonHorn(g, e, A.horn || A.belly, outer); g.restore(); continue;
    }
    // 耳：体が浮くとき 外向き → 上向き へ。立てた分だけ根元を中央へ寄せて、頭からはみ出さないようにする
    // 横長耳（ウサギ）はもともと立っているので、浮いたときに少し外へ開く
    const angel = s.earType === 'angel';
    const base = wide ? 6 + e.angle : vert ? 7 + e.angle * 0.45 : angel ? 10 + e.angle : 32 + e.angle;
    // 横長耳：浮いたときに大きく外へ開き、ふだんも速めにぴくぴく（左右同時）
    // 天使の羽の耳（ゾウ）：ゆっくり ぱたぱたあおぎ、浮くときに少し持ち上がる
    const ang = wide ? sd * (base + 26 * jumpK + 6 * Math.sin(t * 6 + seed)) : angel ? sd * (base + 7 * Math.sin(t * 3 + seed) - 14 * jumpK) : sd * base * (1 - 0.9 * jumpK);
    const halfW = 34 * e.thick / 100 * (vert ? 0.54 : 1), inward = wide || angel ? 0 : jumpK * 0.9 * halfW * Math.sin(Math.abs(base) * D2R), drop = inward * 0.55; // 中央へ寄せた分だけ少し下げて、耳の根元が頭の上に見えないように
    if (ext.earSpikes){ // トゲトゲ（ウサギ）：耳の外側のふちからトゲ（根元は耳に隠れる）
      g.save(); g.translate(head.cx + sd * bx, baseY); g.rotate(ang * D2R); g.scale(sd, 1);
      const wl = 54 * e.len / 100 * 0.85, wt = 34 * e.thick / 100 * 0.62, ecx = wl * 0.32, ecy = -wt * 0.3, len = 20 + 8 * ext.earSpikes;
      const foldAt = s.earFold && s.earFold.side === sd ? s.earFold.at : 1;
      for (const u of [0.05, 0.4, 0.75]){
        if ((u + 1) / 2 > foldAt - 0.05) continue;
        const x = ecx + u * wl, y = ecy + wt * Math.sqrt(1 - u * u), dx = 0.45, dy = 0.9;
        g.beginPath(); g.moveTo(x - 8, y - 4); g.lineTo(x + dx * len, y + dy * len); g.lineTo(x + 8, y - 4); g.closePath();
        g.lineJoin = 'round'; fillStroke(g, ext.hornCol, 4);
      }
      g.restore();
    }
    if (wide && (s.earFold || s.earTip)){ drawWideEarFancy(g, s, e, A, outer, head.cx + sd * bx, baseY, ang, sd, t, seed); continue; }
    g.save(); g.translate(head.cx + sd * (bx - inward), baseY + drop); g.rotate(ang * D2R); g.scale(sd, 1);
    // 形は耳の向きで作り、塗りは体と同じ座標で（ニジイロのグラデーションが頭とつながる）
    earPath(g, s.earType, e, false); g.setTransform(outer); fillStroke(g, A.fur, 5);
    g.restore(); g.save(); g.translate(head.cx + sd * (bx - inward), baseY + drop); g.rotate(ang * D2R); g.scale(sd, 1);
    earPath(g, s.earType, e, true); g.fillStyle = A.inner; g.fill();
    g.restore();
    if (s.earSpots && s.earType === 'angel'){ // 耳の模様（ゾウ案）：外側に濃い色の斑点。耳の形で切り抜き、輪郭線は上から引き直す
      const xf = () => { g.translate(head.cx + sd * bx, baseY); g.rotate(ang * D2R); g.scale(sd, 1); };
      const aw = 54 * e.len / 100 * 0.98, ah = 34 * e.thick / 100 * 1.02;
      g.save(); xf(); earPath(g, s.earType, e, false); g.clip(); g.fillStyle = A.dark;
      for (const [x, y, r] of [[0.84, -0.52, 0.20], [0.60, -0.84, 0.15], [0.97, -0.10, 0.15], [0.48, 0.02, 0.11]]){ ell(g, aw * x, ah * y, ah * r * 1.15, ah * r); g.fill(); }
      g.restore();
      g.save(); xf(); earPath(g, s.earType, e, false); g.setTransform(outer); g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke(); g.restore();
    }
  }
}
// ---- ドラゴンの角（モックの horn をそのまま移植。round が小さいほど先がとがる、stripes で横線）----
function drawDragonHorn(g, e, fill, outer){
  // bend：プラスで外反り、マイナスで内反り（−100 で外反りの標準とほぼ鏡像。モック「ドラゴン2」版）
  const L = 54 * e.len / 100, r = e.round / 100, bendV = e.bend ?? 100, hT = 34 * Math.pow(e.thick / 100, 1.5);
  let kTip, kQ1, kQ2, kC1, kC2, kBack, bt = 0;
  if (bendV >= 0){ const hb = bendV / 100 - 1; kTip = 0.34 + 0.50 * hb; kQ1 = 0.86 + 0.35 * hb; kQ2 = 0.80 + 0.35 * hb; kC1 = 0.74 + 0.30 * hb; kC2 = 0.94 + 0.20 * hb; kBack = 0.62 + 0.18 * hb; }
  else { bt = -bendV / 100; kTip = -0.16 - 0.18 * bt; kQ1 = 0.51 - 1.37 * bt; kQ2 = 0.45 - 1.25 * bt; kC1 = 0.44 - 1.18 * bt; kC2 = 0.74 - 1.68 * bt; kBack = 0.44 - 1.06 * bt; }
  const tipX = hT * kTip, q1x = hT * kQ1, q2x = hT * kQ2, c1x = hT * kC1, c2x = hT * kC2, backX = -hT * kBack;
  const e1x = tipX, e1y = -L * 0.97, e2x = q2x, e2y = -L * 0.52;
  let apx = q1x, apy = -L * 1.03, p1x = e1x, p1y = e1y, p2x = e2x, p2y = e2y;
  if (r < 1){
    const midX = (e1x + e2x) / 2, midY = (e1y + e2y) / 2, push = 0.55 * (1 - r), uu = 0.12 + 0.88 * r;
    apx = q1x + (q1x - midX) * push; apy = -L * 1.03 + (-L * 1.03 - midY) * push;
    p1x = apx + (e1x - apx) * uu; p1y = apy + (e1y - apy) * uu; p2x = apx + (e2x - apx) * uu; p2y = apy + (e2y - apy) * uu;
  }
  // 辺の制御点：内反りでは 外反りの鏡像へ向けて 前後の辺が入れ替わる
  let bc1x = -hT * 1.08, bc1y = -L * 0.30, bc2x = backX, bc2y = -L * 0.84, fc1x = c1x, fc1y = -L * 0.18, fc2x = c2x, fc2y = -L * 0.02, eBx = p1x, eBy = p1y, eFx = p2x, eFy = p2y;
  if (bendV < 0){
    const lp = (a, b) => a + (b - a) * bt;
    bc1x = hT * lp(-1.08, -0.94); bc1y = L * lp(-0.30, -0.02); bc2x = hT * lp(-0.44, -0.74); bc2y = L * lp(-0.84, -0.18);
    fc1x = hT * lp(0.44, 0.62); fc1y = L * lp(-0.18, -0.84); fc2x = hT * lp(0.74, 1.08); fc2y = L * lp(-0.02, -0.30);
    eBx = lp(p1x, p2x); eBy = lp(p1y, p2y); eFx = lp(p2x, p1x); eFy = lp(p2y, p1y);
  }
  g.beginPath(); g.moveTo(-hT, 6); g.bezierCurveTo(bc1x, bc1y, bc2x, bc2y, eBx, eBy); g.quadraticCurveTo(apx, apy, eFx, eFy);
  g.bezierCurveTo(fc1x, fc1y, fc2x, fc2y, hT, 6); g.quadraticCurveTo(0, 13, -hT, 6); g.closePath();
  const here = g.getTransform(); g.setTransform(outer); g.lineJoin = 'round'; fillStroke(g, fill, 5); g.setTransform(here);
  if (!e.stripes) return;
  const cub = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]; };
  const quad = (p0, p1, p2, t) => { const u = 1 - t; return [u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0], u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1]]; };
  const backPt = t => cub([-hT, 6], [bc1x, bc1y], [bc2x, bc2y], [eBx, eBy], t);
  const frontPt = u => u <= 0.45 ? quad([eBx, eBy], [apx, apy], [eFx, eFy], u / 0.45) : cub([eFx, eFy], [fc1x, fc1y], [fc2x, fc2y], [hT, 6], (u - 0.45) / 0.55);
  g.strokeStyle = INK; g.lineWidth = 2.3; g.lineCap = 'round'; g.globalAlpha = 0.55;
  let pairs;
  if (bendV < 0){ // 内反りは途中がへこむので、同じ高さの点どうしを結ぶ（線が角の外に出ない）
    const bS = [], fS = []; let topY = 1e9;
    for (let i = 0; i <= 80; i++){ const b = backPt(i / 80), f = frontPt(i / 80); bS.push(b); fS.push(f); topY = Math.min(topY, b[1], f[1]); }
    const nearY = (arr, y) => arr.reduce((best, p) => Math.abs(p[1] - y) < Math.abs(best[1] - y) ? p : best, arr[0]);
    pairs = [0.34, 0.57, 0.79].map(f => { const y = 6 + (topY - 6) * f; return [nearY(bS, y), nearY(fS, y)]; });
  } else pairs = [0.34, 0.55, 0.76].map(sv => [backPt(sv), frontPt(1 - sv)]);
  for (const [bp, fp] of pairs){
    const mx = (bp[0] + fp[0]) / 2, my = (bp[1] + fp[1]) / 2;
    const x1 = bp[0] + (mx - bp[0]) * 0.14, y1 = bp[1] + (my - bp[1]) * 0.14, x2 = fp[0] + (mx - fp[0]) * 0.14, y2 = fp[1] + (my - fp[1]) * 0.14;
    g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(mx, my - Math.abs(y2 - y1) * 0.10 - L * 0.055, x2, y2); g.stroke();
  }
  g.globalAlpha = 1;
}
// 横長耳の飾り：earFold＝片耳だけ途中で外へ折れる（ジャンプのとき少し遅れてぴょこっと持ち上がる）
//               earTip＝耳の先だけ濃い色（colors.tip、なければ dark）
function drawWideEarFancy(g, s, e, A, outer, x, y, ang, sd, t, seed){
  const wl = 54 * e.len / 100 * 0.85, wt = 34 * e.thick / 100 * 0.62, ecx = wl * 0.32, ecy = -wt * 0.3;
  const fold = s.earFold && s.earFold.side === sd ? s.earFold : null;
  const fx = fold ? ecx - wl + 2 * wl * fold.at : 0;
  const tipX = s.earTip ? ecx + wl - 2 * wl * s.earTip.len : null;
  const rot = fold ? fold.angle - 30 * jumpOf(t - 0.2, seed) : 0;
  // 折り目の支点は耳の内側のふち：外へ曲げても内側がつながったまま、外側は根元に重なる
  const hh = fold ? wt * Math.sqrt(Math.max(0, 1 - ((fx - ecx) / wl) ** 2)) : 0, py = ecy - hh;
  const xf = () => { g.translate(x, y); g.rotate(ang * D2R); g.scale(sd, 1); };
  const piece = (from, to, inner, r) => {
    g.save(); xf();
    if (r){ g.translate(fx, py); g.rotate(r * D2R); g.translate(-fx, -py); }
    g.beginPath(); g.rect(from, -300, to - from, 600); g.clip();
    const here = g.getTransform();
    ell(g, ecx, ecy, wl, wt); g.setTransform(outer); g.fillStyle = A.fur; g.fill(); g.setTransform(here);
    if (inner){ ell(g, wl * 0.36, ecy, wl * 0.58, wt * 0.5); g.fillStyle = A.inner; g.fill(); }
    if (tipX !== null){ g.save(); ell(g, ecx, ecy, wl, wt); g.clip(); g.beginPath(); g.rect(tipX, -300, 600, 600); g.fillStyle = A.tip || A.dark; g.fill(); g.restore(); }
    ell(g, ecx, ecy, wl, wt); g.setTransform(outer); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
    g.restore();
  };
  if (!fold){ piece(-600, 600, true, 0); return; }
  piece(-600, fx, true, 0);
  piece(fx, 600, false, rot); // 折れた先は耳の裏側なので内側のピンクはなし
  // 折り目の線
  g.save(); xf(); g.translate(fx, py); g.rotate(rot * D2R); g.translate(-fx, -py);
  g.beginPath(); g.moveTo(fx, ecy - hh); g.lineTo(fx, ecy + hh); g.setTransform(outer); g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = 'round'; g.stroke();
  g.restore();
}
// ---- 目（レイヤー重ね + まつげ）----
// 形ごとの外形：[半分の横幅, 上端, 下端]（レイヤー自身の座標）
const EYE_BOX = { spiral: [9.5, -9.5, 9.5], ellipse: [7.2, -12, 12], capsule: [7, -12.5, 12.5], kamaboko: [11.5, -5.5, 6], cateye: [13.5, -4.75, 4.75], circle: [9, -9, 9] };
// keep：beginPath せずに今のパスへ足す（目の全レイヤーをまとめた形を作るとき）
function eyePath(g, shape, mode, keep){
  if (!keep) g.beginPath();
  if (shape === 'ellipse'){ g.moveTo(7.2, 0); g.ellipse(0, 0, 7.2, 12, 0, 0, 6.283); }
  else if (shape === 'capsule') g.roundRect(-7, -12.5, 14, 25, 7);
  else if (shape === 'kamaboko'){ g.moveTo(-11.5, -5.5); g.lineTo(11.5, -5.5); g.ellipse(0, -5.5, 11.5, 11.5, 0, 0, Math.PI); g.closePath(); }
  else if (shape === 'cateye'){ g.moveTo(-13.5, 0); g.quadraticCurveTo(0, -9.5, 13.5, 0); g.quadraticCurveTo(0, 9.5, -13.5, 0); g.closePath(); }
  else if (shape === 'spiral'){ g.moveTo(9.5, 0); g.arc(0, 0, 9.5, 0, 6.283); } // ぐるぐる目の「形」（まぶた・切り抜き用）は丸
  else { const r = mode === 'outline' ? 9 : 8.8; g.moveTo(r, 0); g.arc(0, 0, r, 0, 6.283); }
}
// lw：輪郭線の太さ（レイヤーの拡大率で割り戻して、見た目の太さを一定に保つ）
function eyeShape(g, shape, mode, lw, color){
  if (shape === 'spiral'){ spiral(g, 0, 0, 9.5, 2.4); g.strokeStyle = mode === 'fillWhite' ? '#fff' : INK; g.lineWidth = mode === 'outline' ? lw / 2 : lw; g.lineCap = 'round'; g.stroke(); return; }
  eyePath(g, shape, mode);
  g.lineJoin = 'round';
  if (color && mode === 'fill'){ g.fillStyle = color; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.8; g.stroke(); return; } // 色つきの黒目（赤い目など）
  if (mode === 'outline'){ g.fillStyle = '#fff'; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); }
  else { g.fillStyle = mode === 'fillWhite' ? '#fff' : INK; g.fill(); }
}
function eyeLayerXf(g, Ly, cx, cy, m, gs){
  if (Ly.noMirror) m = 1; // ハイライトなど 左右の目で同じ位置に置くレイヤー
  const sz = (Ly.size || 100) / 100, sx = gs * sz * (Ly.w || 100) / 100, sy = gs * sz * (Ly.h || 100) / 100;
  g.translate(cx + (Ly.dx || 0) * m, cy + (Ly.dy || 0)); g.rotate((Ly.angle || 0) * m * D2R); g.scale(sx * m, sy);
  return { sx, sy };
}
function drawEye(g, eye, cx, cy, mirror, mod){
  const gs = (eye.scale || 100) / 100, sd = mirror ? -1 : 1, m = mirror && eye.mirror !== false ? -1 : 1; // m：目の形の向き / sd：左右（削りの向き）
  g.lineCap = 'round';
  // 目全体の外形（削り・まぶた・閉じ目の基準）
  let top = Infinity, bot = -Infinity, half = 0;
  for (const Ly of eye.layers){
    const b = EYE_BOX[Ly.shape] || EYE_BOX.circle, sz = (Ly.size || 100) / 100, sx = gs * sz * (Ly.w || 100) / 100, sy = gs * sz * (Ly.h || 100) / 100, y = cy + (Ly.dy || 0);
    top = Math.min(top, y + b[1] * sy); bot = Math.max(bot, y + b[2] * sy); half = Math.max(half, b[0] * sx);
  }
  if (mod.closed){ // まばたき・ねむり目（目の大きさに合わせた弧）
    const r = Math.max(7.5 * gs, half * 0.75), yc = (top + bot) / 2 - r * 0.35;
    g.strokeStyle = INK; g.lineWidth = 3.6; g.beginPath(); g.arc(cx, yc, r, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); return;
  }
  for (const Ls of mod.lid > 0 || mod.noLash ? [] : eye.lashes || []){ // まぶたが下りたら（noLashOnCut の動物は即決でも）まつげは出さない
    const lm = eye.lashMirror === false ? 1 : sd; // lashMirror:false＝右目も左目と同じ向き（ゾウ）
    const bx = cx + (Ls.dx || 0) * lm * gs, by = cy + (Ls.dy || 0) * gs, rad = (Ls.angle || 0) * lm * D2R;
    const dx = Math.sin(rad), dy = -Math.cos(rad), len = 11 * (Ls.len || 100) / 100 * gs, back = 2.5 * gs;
    g.strokeStyle = INK; g.lineWidth = 2.4 * (Ls.thick || 100) / 100;
    g.beginPath(); g.moveTo(bx - dx * back, by - dy * back); g.lineTo(bx + dx * len, by + dy * len); g.stroke();
  }
  // 即決：目の上側を斜めに削る（外側は少し、内側ほど深く）
  const h = bot - top, yo = top + h * 0.06 * mod.cut, yi = top + h * 0.42 * mod.cut;
  const slope = (yi - yo) / (2 * half), W = 40, yAt = x => yo + (x + half) * slope; // x：外側を -half とした座標
  g.save();
  if (mod.cut > 0){ g.beginPath(); g.moveTo(cx - sd * W, yAt(-W)); g.lineTo(cx + sd * W, yAt(W)); g.lineTo(cx + sd * W, bot + 30); g.lineTo(cx - sd * W, bot + 30); g.closePath(); g.clip(); }
  // 熟考：白目（輪郭あり）のある目は、まぶたに押されるように黒目も下へずらす（白目からははみ出さない）
  let whiteBot = -Infinity;
  for (const Ly of eye.layers) if (Ly.mode === 'outline'){ const b = EYE_BOX[Ly.shape] || EYE_BOX.circle, sy = gs * (Ly.size || 100) / 100 * (Ly.h || 100) / 100; whiteBot = Math.max(whiteBot, cy + (Ly.dy || 0) + b[2] * sy); }
  for (const Ly of eye.layers){
    let push = 0;
    if (mod.lid > 0 && whiteBot > -Infinity && Ly.mode !== 'outline'){
      const b = EYE_BOX[Ly.shape] || EYE_BOX.circle, sy = gs * (Ly.size || 100) / 100 * (Ly.h || 100) / 100, pb = cy + (Ly.dy || 0) + b[2] * sy;
      push = Math.max(0, Math.min(mod.lid * (bot - top) * 0.5, whiteBot - pb - 2));
    }
    g.save(); g.translate(0, push); const { sx, sy } = eyeLayerXf(g, Ly, cx, cy, m, gs);
    eyeShape(g, Ly.shape, Ly.mode, 3.4 * (Ly.line ?? 100) / 100 / (Math.sqrt(Math.abs(sx * sy)) || 1), Ly.color); g.restore();
  }
  g.restore();
  if (mod.cut > 0){ // 白目（輪郭あり）の削り口にも輪郭線を引く
    for (const Ly of eye.layers){
      if (Ly.mode !== 'outline') continue;
      const outer = g.getTransform();
      g.save(); eyeLayerXf(g, Ly, cx, cy, m, gs); eyePath(g, Ly.shape, Ly.mode); g.setTransform(outer); g.clip();
      g.beginPath(); g.moveTo(cx - sd * W, yAt(-W)); g.lineTo(cx + sd * W, yAt(W)); g.strokeStyle = INK; g.lineWidth = 3.4 * (Ly.line ?? 100) / 100; g.stroke();
      g.restore();
    }
  }
  if (mod.lid > 0){ // 熟考：まぶたが下りてくる
    // まぶたは「目の形の中だけ」を塗る（頭の輪郭や模様には触れない）。
    // 白目（輪郭あり）があればその形、なければ黒目の形を使う。回転した目（ドラゴンのつり目）も形そのものなので はみ出さない
    const outl = eye.layers.filter(Ly => Ly.mode === 'outline'), shapes = outl.length ? outl : eye.layers.filter(Ly => Ly.mode !== 'fillWhite');
    const outer = g.getTransform();
    const eyeArea = () => { g.beginPath(); for (const Ly of shapes){ g.save(); eyeLayerXf(g, Ly, cx, cy, m, gs); eyePath(g, Ly.shape, Ly.mode, true); g.restore(); } };
    // 下りる位置は 回転後の形の上端〜下端で決める
    let rt = Infinity, rb = -Infinity;
    for (const Ly of shapes){
      const b = EYE_BOX[Ly.shape] || EYE_BOX.circle, sz = (Ly.size || 100) / 100, sx = gs * sz * (Ly.w || 100) / 100, sy = gs * sz * (Ly.h || 100) / 100;
      const a = (Ly.angle || 0) * D2R, co = Math.cos(a), si = Math.sin(a);
      for (const [px, py] of [[-b[0], b[1]], [b[0], b[1]], [-b[0], b[2]], [b[0], b[2]]]){ const y = px * sx * si + py * sy * co + cy + (Ly.dy || 0); rt = Math.min(rt, y); rb = Math.max(rb, y); }
    }
    const ly = rt + (rb - rt) * mod.lid;
    const edge = Math.max(0, ...shapes.map(Ly => Ly.mode === 'outline' ? 3.4 * (Ly.line ?? 100) / 100 : 0)) + 2; // 目の輪郭線を隠す太さ
    g.save(); g.setTransform(outer); g.beginPath(); g.rect(cx - 80, rt - 40, 160, ly - rt + 40); g.clip();
    eyeArea(); g.fillStyle = mod.lidColor; g.fill(); g.strokeStyle = mod.lidColor; g.lineWidth = edge; g.lineJoin = 'round'; g.stroke();
    g.restore();
    // まぶたの線：目の形で切り抜くので、下がるほど 目の幅に合わせて横に伸びる
    // 白目のない黒目だけの目（リス・ウサギ）は 線が黒目に溶けるので、これまでどおり目の幅より少し長い線にする
    if (!outl.length){ g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - half - 1, ly); g.lineTo(cx + half + 1, ly); g.stroke(); }
    else { g.save(); eyeArea(); g.setTransform(outer); g.clip(); g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 60, ly); g.lineTo(cx + 60, ly); g.stroke(); g.restore(); }
  }
}
function drawNose(g, type, x, y, col, ns, bk){
  if (type === 'none') return;
  if (type === 'pick'){ // ピック形のクチバシ（フクロウ）：上が丸く広く、下がやわらかくとがる
    const b = bk || {}, hw = 10.5 * (b.w ?? 100) / 100, by = y + (b.posY || 0), topY = by - 7.5, botY = by + 11 * (b.len ?? 100) / 100, ctr = (topY + botY) / 2, lowF = (b.low ?? 100) / 100;
    const lowY = v => v <= ctr ? v : ctr + (v - ctr) * lowF;
    g.beginPath(); g.moveTo(x - hw, topY + 1.5); g.quadraticCurveTo(x, topY - 3.5, x + hw, topY + 1.5);
    g.quadraticCurveTo(x + hw * 0.66, lowY(by + 3), x, lowY(botY)); g.quadraticCurveTo(x - hw * 0.66, lowY(by + 3), x - hw, topY + 1.5); g.closePath();
    g.lineJoin = 'round'; fillStroke(g, col || '#f6a83b', 3); return;
  }
  col = col || INK;
  if (type === 'slit'){ // 斜め線2本（下ですぼまる鼻の孔）。線の太さは大きさの√でだけ太る
    g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = 1.8 / Math.sqrt(ns || 1);
    g.beginPath(); g.moveTo(x - 4, y + 3.5); g.lineTo(x - 9.5, y - 3.5); g.moveTo(x + 4, y + 3.5); g.lineTo(x + 9.5, y - 3.5); g.stroke(); return;
  }
  g.beginPath();
  if (type === 'triangle'){ g.moveTo(x - 9, y - 5); g.quadraticCurveTo(x, y - 8, x + 9, y - 5); g.quadraticCurveTo(x + 8, y + 6, x, y + 7.5); g.quadraticCurveTo(x - 8, y + 6, x - 9, y - 5); g.closePath(); }
  else if (type === 'ellipse') g.ellipse(x, y, 10.5, 7, 0, 0, 6.283);
  else g.arc(x, y, 5.4, 0, 6.283);
  g.fillStyle = type === 'ellipse' ? INK : col; g.fill();
}
// style 'wave'：黒ふち＋白の「〜」ヒゲ（ドラゴン）。t で波がゆっくり先へ流れる
function drawWhiskers(g, list, head, noseY, style, t){
  const spread = head.W * 0.13, baseY = noseY + 5;
  g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const Wk of list) for (const sd of [-1, 1]){
    const rx = head.cx + sd * (spread + (Wk.dx || 0)), ry = baseY + (Wk.dy || 0), a = (Wk.angle || 0) * D2R;
    const dx = sd * Math.cos(a), dy = Math.sin(a), len = 30 * (Wk.len || 100) / 100, sw = 1.9 * (Wk.thick || 100) / 100;
    if (style !== 'wave'){ g.strokeStyle = INK; g.lineWidth = sw; g.beginPath(); g.moveTo(rx - dx * 3, ry - dy * 3); g.lineTo(rx + dx * len, ry + dy * len); g.stroke(); continue; }
    const px = -dy, py = dx, amp = Math.max(1.6, len * 0.16 * (Wk.thick || 100) / 100);
    g.beginPath();
    for (let i = 0; i <= 18; i++){
      const u = i / 18, off = Math.sin(u * Math.PI * 3 - (t || 0) * 3) * amp * (0.35 + 0.65 * u);
      g.lineTo(rx - dx * 3 + dx * (len + 3) * u + px * off, ry - dy * 3 + dy * (len + 3) * u + py * off);
    }
    g.strokeStyle = INK; g.lineWidth = sw * 2.5; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = sw * 1.45; g.stroke();
  }
}
function omegaPath(g, x, y, oy){
  g.moveTo(x - 15, y - 2 - oy); g.quadraticCurveTo(x - 7.5, y + 8 - oy, x, y - 2 - oy); g.quadraticCurveTo(x + 7.5, y + 8 - oy, x + 15, y - 2 - oy);
}
function mouthXform(g, f, cx, my){ g.translate(f.mouthPosX || 0, f.mouthPosY || 0); g.translate(cx, my); g.rotate((f.mouthAngle || 0) * D2R); g.scale((f.mouthSize || 100) / 100 * (f.chewX || 1), (f.mouthSize || 100) / 100 * (f.chewY || 1)); g.translate(-cx, -my); }
// 口の線より下だけを見せる切り抜き（歯・牙がω線の上にはみ出さない）。呼んだ側で save/restore する
function clipBelowMouth(g, s, cx, my){
  const outer = g.getTransform();
  mouthXform(g, s.face, cx, my);
  const oy = 1.9 * (s.face.mouthLine ?? 100) / 100; // 口の線の上ふち
  g.beginPath(); g.moveTo(cx - 420, my - 2 - oy);
  if (s.mouth === 'omega'){ g.lineTo(cx - 15, my - 2 - oy); omegaPath(g, cx, my, oy); g.lineTo(cx + 420, my - 2 - oy); }
  else if (s.mouth === 'v'){ g.lineTo(cx - 420, my - 3 - oy); vPath(g, cx, my - oy); g.lineTo(cx + 420, my - 3 - oy); }
  else g.lineTo(cx + 420, my - 2 - oy);
  g.lineTo(cx + 420, my + 420); g.lineTo(cx - 420, my + 420); g.closePath(); g.clip();
  g.setTransform(outer);
}
function vPath(g, x, y){ g.lineTo(x - 13, y - 3); g.lineTo(x - 2, y + 3.6); g.quadraticCurveTo(x, y + 5.4, x + 2, y + 3.6); g.lineTo(x + 13, y - 3); }
function drawMouthParts(g, s, cx, my){
  const f = s.face, om = s.openMouth, fg = s.fangs;
  // 開いた口の中（いちばん下）
  // open：あくびの開き具合（指定がなければ全開）。ほぼ閉じているときは描かない
  const op = om ? (om.open ?? 1) : 0;
  if (om && om.show && op > 0.04){
    const rw = 13 * (om.w ?? 100) / 100 * (0.75 + 0.25 * op), rh = Math.max(0.4, 11 * (om.h ?? 100) / 100 * op), oy = my - 1 + rh + (om.posY || 0);
    g.save(); if (s.mouth === 'v') clipBelowMouth(g, s, cx, my); // V字の口は 線より上に はみ出さない
    mouthXform(g, f, cx, my);
    ell(g, cx, oy, rw, rh); fillStroke(g, '#7a2e2e', 3);
    if (om.tongue){ g.save(); ell(g, cx, oy, rw, rh); g.clip(); ell(g, cx, oy + rh * 0.52, rw * 0.58, rh * 0.52); g.fillStyle = '#f28ba0'; g.fill(); g.restore(); }
    g.restore();
  }
  // 牙
  if (fg && fg.show){
    g.save(); clipBelowMouth(g, s, cx, my);
    const ay = my - 2.5, len = 11 * (fg.len ?? 100) / 100, wid = 7.5 * (fg.width ?? 100) / 100, off = 8.5 * (fg.spacing ?? 100) / 100;
    g.translate(f.mouthPosX || 0, (f.mouthPosY || 0) + (fg.posY || 0) + (f.toothChewDy || 0));
    for (const sd of [-1, 1]){
      const fx = cx + sd * off;
      g.save(); g.translate(fx, ay); g.rotate(sd * (fg.angle || 0) * D2R); g.translate(-fx, -ay);
      g.beginPath(); g.moveTo(fx - wid / 2, ay); g.quadraticCurveTo(fx - wid * 0.3, ay + len * 0.62, fx, ay + len); g.quadraticCurveTo(fx + wid * 0.3, ay + len * 0.62, fx + wid / 2, ay); g.closePath();
      g.lineJoin = 'round'; fillStroke(g, '#fff', 2.2); g.restore();
    }
    g.restore();
  }
  // 前歯
  if (f.toothShow){
    g.save(); clipBelowMouth(g, s, cx, my);
    const ax = cx, ay = my - 2.5, top = ay, bot = ay + 10.5;
    g.translate((f.mouthPosX || 0) + (f.toothPosX || 0), (f.mouthPosY || 0) + (f.toothPosY || 0) + (f.toothChewDy || 0));
    g.translate(ax, ay); g.rotate((f.toothAngle || 0) * D2R); g.scale((f.toothWidth || 100) / 100, (f.toothLength || 100) / 100); g.translate(-ax, -ay);
    g.beginPath(); g.moveTo(ax - 4.6, top); g.lineTo(ax + 4.6, top); g.lineTo(ax + 4.6, bot - 3.2); g.quadraticCurveTo(ax + 4.6, bot, ax + 1.8, bot); g.lineTo(ax - 1.8, bot); g.quadraticCurveTo(ax - 4.6, bot, ax - 4.6, bot - 3.2); g.closePath();
    g.lineJoin = 'round'; fillStroke(g, '#fff', 2.6);
    const lf = (f.toothLineLength ?? 75) / 100;
    if (lf > 0){ const yb = bot - 0.8, yt = yb - lf * ((bot - top) - 1.6); g.globalAlpha = 0.45; g.strokeStyle = INK; g.lineWidth = 1.1 * (f.toothLineWidth ?? 100) / 100; g.lineCap = 'round'; g.beginPath(); g.moveTo(ax, yt); g.lineTo(ax, yb); g.stroke(); g.globalAlpha = 1; }
    g.restore();
  }
  // 口の線（いちばん上）
  g.save(); mouthXform(g, f, cx, my);
  g.strokeStyle = INK; g.lineWidth = 3.8 * (f.mouthLine ?? 100) / 100; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
  if (s.mouth === 'omega') omegaPath(g, cx, my, 0); else if (s.mouth === 'v'){ g.moveTo(cx - 13, my - 3); vPath(g, cx, my); } else { g.moveTo(cx - 12, my - 2); g.quadraticCurveTo(cx, my + 9, cx + 12, my - 2); }
  g.stroke(); g.restore();
}
// ---- リスのしっぽ（巻いた塊 + 渦）----
function tailPts(basePct){
  const b = (basePct ?? 40) / 100, nh = 67.5 * b, sc = 14 + nh, bc = 69, mix = (a, c, t) => a + (c - a) * t;
  const sl = [[26, sc - 3, nh + 8], [12, sc, nh + 1], [-12, sc, nh + 1], [-32, mix(sc, bc, 0.25), mix(nh, 62, 0.5)], [-56, mix(sc, bc, 0.66), 60], [-86, bc, 67.5], [-112, 68, 57], [-130, 64, 33], [-139, 60, 8]];
  const pts = []; sl.forEach(([y, cx, hw]) => pts.push([cx - hw, y])); for (let i = sl.length - 1; i >= 0; i--) pts.push([sl[i][1] + sl[i][2], sl[i][0]]);
  return { pts, stemCx: sc };
}
// angle：今の角度。spikes>0 で外側にトゲ
function drawSquirrelTail(g, T, bodyCx, bodyCy, A, angle, spikes, spikeCol){
  const tp = tailPts(T.base), sz = (T.size || 100) / 100, sx = sz * (T.thick || 100) / 100, sy = sz;
  const px = tp.stemCx * sx, py = 22 * sy, cf = (T.curl ?? 70) / 100;
  const cr = cf <= 1 ? 12 + cf * 18 : 30 + (cf - 1) * 6, ct = cf <= 1 ? 0.9 + cf * 2.0 : 2.9 + (cf - 1) * 2.2;
  g.save(); g.translate(bodyCx + (T.posX || 0), bodyCy + (T.posY || 0));
  g.translate(px, py); g.rotate(angle * D2R); g.translate(-px, -py); g.scale(sx, sy);
  g.lineJoin = 'round';
  if (spikes > 0){ // トゲはしっぽの塊の外側から生やす（根元はしっぽに隠れる）
    const len = 26 + 12 * spikes;
    for (const i of [7, 9, 11, 12, 13]){
      const [x, y] = tp.pts[i]; let dx = x - 72, dy = y + 78; const d = Math.hypot(dx, dy); dx /= d; dy /= d;
      const bx = x - dx * 6, by = y - dy * 6;
      g.beginPath(); g.moveTo(bx - dy * 10, by + dx * 10); g.lineTo(bx + dx * len, by + dy * len); g.lineTo(bx + dy * 10, by - dx * 10); g.closePath();
      fillStroke(g, spikeCol, 5);
    }
  }
  smoothClosed(g, tp.pts); fillStroke(g, A.dark, 5);
  spiral(g, 80 + (T.curlPosX || 0), -80 + (T.curlPosY || 0), cr, ct); g.strokeStyle = A.fur; g.lineWidth = 5; g.lineCap = 'round'; g.stroke();
  g.restore();
}
// ---- ネコのしっぽ（根元を支点に回る、線2本重ね）----
// モックの曲線（左へ出て上へ曲がる）を小さな節のつながりで作り直し、曲がり具合を動かす。
// bend>0：先っぽがくるんと曲がる / bend<0：まっすぐ伸びる / 0：モックの形
function drawCatTail(g, T, bodyCx, bodyCy, A, angle, bend){
  const s = (T.size ?? 100) / 100, bx = bodyCx - 20, by = bodyCy + 20, fig = g.getTransform();
  const N = 16, segL = 62 / N, k0 = 93 / N, straight = Math.max(0, -bend), curl = Math.max(0, bend) * 150;
  g.save(); g.translate(T.posX || 0, T.posY || 0); g.translate(bx, by); g.rotate(angle * D2R); g.scale(s, s); g.translate(-bx, -by);
  g.beginPath(); g.moveTo(bx, by);
  let x = bx, y = by, a = 183;
  for (let i = 0; i < N; i++){
    const u = (i + 0.5) / N, tip = C((u - 0.55) / 0.45, 0, 1), da = k0 * (1 - 0.75 * straight) + curl / N * 2.2 * tip * tip;
    a += da / 2; x += Math.cos(a * D2R) * segL; y += Math.sin(a * D2R) * segL; a += da / 2;
    g.lineTo(x, y);
  }
  g.setTransform(fig); // 線の色は体と同じ座標で（ニジイロ対策）。太さは しっぽの大きさに合わせる
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 12 * s / LWK + 8; g.stroke(); g.strokeStyle = A.fur; g.lineWidth = 12 * s / LWK; g.stroke(); // しっぽ自体の太さは変えず、ふちだけ太く
  g.restore();
}
function drawMarkings(g, marks, head, A){
  if (!marks.length) return;
  g.save(); poly(g, head.pts); g.clip(); g.fillStyle = marks.color === 'belly' ? A.belly : A.dark;
  for (const M of marks){
    g.save(); g.translate(head.cx + (M.dx || 0), head.cy + (M.dy || 0)); g.rotate((M.angle || 0) * D2R); g.scale((M.thick || 100) / 100, (M.len || 100) / 100);
    g.beginPath();
    if (M.shape === 'ellipse') g.ellipse(0, 0, 8, 14, 0, 0, 6.283);
    else if (M.shape === 'circle') g.arc(0, 0, 11, 0, 6.283);
    else if (M.shape === 'triangle'){ g.moveTo(-11, -12.5); g.quadraticCurveTo(0, -15.5, 11, -12.5); g.lineTo(3.2, 13); g.quadraticCurveTo(0, 16.5, -3.2, 13); g.closePath(); }
    else g.roundRect(-6, -16, 12, 32, 6);
    g.fill(); g.restore();
  }
  g.restore();
}
// ---- ギョーザ型の手（招き猫ふうに体の両わきで上げる）。hy(sd)：手ごとの上下ゆれ ----
function drawGyozaHands(g, H, body, bodyCx, bodyCy, A, hy){
  const hS = (H.size ?? 100) / 100, hAng = H.angle || 0, gb = (H.bulge ?? 100) / 100, hSp = (H.spacing || 0) / hS;
  const gDomeRy = 21 * gb, gLobeK = 0.8 + 0.2 * gb, gSw = 1 + 0.15 * (gb - 1), gNw = 1 - 0.25 * (gb - 1), gNotchTop = 4.5 - 2.5 * (gb - 1), gNotchCtl = 8 - 1.5 * (gb - 1);
  const gBaseY = bodyCy + body.H * 0.30, fig = g.getTransform();
  g.save(); g.translate(H.posX || 0, H.posY || 0); g.translate(bodyCx, bodyCy); g.scale(hS, hS); g.translate(-bodyCx, -bodyCy);
  for (const sd of [-1, 1]){
    const gCx = bodyCx + sd * (body.W / 2 + 10 + hSp), gCy = gBaseY - 24, wob = hy(sd) / hS;
    const Q = (c1x, c1y, x, y) => g.quadraticCurveTo(gCx + c1x, gCy + c1y, gCx + x, gCy + y);
    g.save(); g.translate(0, wob);
    g.translate(gCx, gCy + 1.75); g.rotate((sd * hAng + hy(sd) * 1.5) * D2R); g.translate(-gCx, -(gCy + 1.75));
    g.translate(gCx, gBaseY); g.rotate(sd * 7 * D2R); g.translate(-gCx, -gBaseY);
    g.beginPath(); g.moveTo(gCx - 25, gCy); g.ellipse(gCx, gCy, 25, gDomeRy, 0, Math.PI, Math.PI * 2);
    Q(26.5 * gSw, 4, 25.8 * gSw, 8); Q(25.8 * gSw, 11, 25.5 * gSw, 13);
    Q(24 * gSw, 22.5 * gLobeK, 17 * gSw, 22.5 * gLobeK); Q(10 * gSw, 22.5 * gLobeK, 9 * gNw, 14);
    Q(7.8 * gNw, gNotchCtl, 9.5 * gNw, gNotchTop); Q(11.2 * gNw, gNotchCtl, 10.5 * gNw, 14);
    Q(10 * gSw, 23.5 * gLobeK, 0, 24.5 * gLobeK); Q(-10 * gSw, 23.5 * gLobeK, -10.5 * gNw, 14);
    Q(-11.2 * gNw, gNotchCtl, -9.5 * gNw, gNotchTop); Q(-7.8 * gNw, gNotchCtl, -9 * gNw, 14);
    Q(-10 * gSw, 22.5 * gLobeK, -17 * gSw, 22.5 * gLobeK); Q(-24 * gSw, 22.5 * gLobeK, -25.5 * gSw, 13);
    Q(-25.8 * gSw, 11, -25.8 * gSw, 8); Q(-26.5 * gSw, 4, -25, 0); g.closePath();
    { const here = g.getTransform(); g.setTransform(fig); g.lineJoin = 'round'; fillStroke(g, A.fur, 4); g.setTransform(here); } // 塗りは体と同じ座標で
    if (H.claws){
      const cs = (H.clawSize ?? 100) / 100;
      for (const [lx, ly] of [[-17 * gSw, 20 * gLobeK], [0, 22.5 * gLobeK], [17 * gSw, 20 * gLobeK]]){
        g.save(); g.translate(gCx + lx, gCy + ly); g.scale(cs, cs);
        g.beginPath(); g.moveTo(-2.8, 0); g.lineTo(2.8, 0); g.lineTo(0, 7); g.closePath(); fillStroke(g, '#fff', 1.8 / hS / cs); g.restore();
      }
    }
    g.restore();
  }
  g.restore();
}
// ---- 丸い手（胸の前で両手。pads で肉球、claws で爪）。hy(sd)：手ごとの上下ゆれ ----
function drawRoundHands(g, H, body, bodyCx, bodyCy, A, hy){
  const hS = (H.size ?? 100) / 100, hAng = H.angle || 0, b = (H.bulge ?? 100) / 100, hSp = (H.spacing || 0) / hS, fig = g.getTransform();
  const rx = 11 * (1 + 0.05 * (1 - b)), ry = 11 * (0.35 + 0.65 * b), hcy = bodyCy + body.H * 0.10;
  g.save(); g.translate(H.posX || 0, H.posY || 0); g.translate(bodyCx, bodyCy); g.scale(hS, hS); g.translate(-bodyCx, -bodyCy);
  for (const sd of [-1, 1]){
    const hx = bodyCx + sd * (14 + hSp);
    g.save(); g.translate(0, hy(sd) / hS); g.translate(hx, hcy); g.rotate((sd * hAng + hy(sd) * 1.5) * D2R); g.translate(-hx, -hcy);
    ell(g, hx, hcy, rx, ry);
    { const here = g.getTransform(); g.setTransform(fig); fillStroke(g, A.fur, 4); g.setTransform(here); }
    g.translate(hx, hcy); g.scale(rx / 11, ry / 11); g.translate(-hx, -hcy);
    if (H.pads !== false){
      g.beginPath(); g.moveTo(hx - 5.4, hcy + 1); g.quadraticCurveTo(hx, hcy - 1.2, hx + 5.4, hcy + 1); g.quadraticCurveTo(hx + 6, hcy + 4.6, hx + 3.7, hcy + 6.7); g.quadraticCurveTo(hx, hcy + 8.4, hx - 3.7, hcy + 6.7); g.quadraticCurveTo(hx - 6, hcy + 4.6, hx - 5.4, hcy + 1); g.closePath();
      g.fillStyle = '#f28ba0'; g.fill();
      for (const deg of [-52, 0, 52]){ const r = deg * D2R; ell(g, hx + 6.3 * Math.sin(r), hcy - 6.3 * Math.cos(r), 1.5, 2.4, r); g.fill(); }
    }
    if (H.claws){
      const cs = (H.clawSize ?? 100) / 100;
      for (const deg of [-52, 0, 52]){
        const r = deg * D2R; g.save(); g.translate(hx + 10.4 * Math.sin(r), hcy - 10.4 * Math.cos(r)); g.rotate(r); g.scale(cs, cs);
        g.beginPath(); g.moveTo(-2.4, 2); g.lineTo(2.4, 2); g.lineTo(0, -4.8); g.closePath(); g.lineJoin = 'round'; fillStroke(g, '#fff', 1.7 / hS / cs); g.restore();
      }
    }
    g.restore();
  }
  g.restore();
}
// ---- 持ち物（モックの持ち物の大きさ・位置・角度つき）----
function drawItem(g, kind, P, cx, cy){
  g.save(); g.translate(P.posX || 0, P.posY || 0); g.translate(cx, cy); g.rotate((P.angle || 0) * D2R); g.scale((P.size ?? 100) / 100, (P.size ?? 100) / 100); g.translate(-cx, -cy);
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (kind === 'carrot'){
    g.beginPath(); g.moveTo(cx - 1.5, cy - 11); g.quadraticCurveTo(cx - 12, cy - 22, cx - 8, cy - 27); g.quadraticCurveTo(cx - 1, cy - 21, cx - 0.5, cy - 12); g.closePath(); fillStroke(g, '#57a83e', 3);
    g.beginPath(); g.moveTo(cx - 1, cy - 12); g.quadraticCurveTo(cx - 1.5, cy - 25, cx + 0.5, cy - 29); g.quadraticCurveTo(cx + 3.5, cy - 21, cx + 1.5, cy - 12); g.closePath(); fillStroke(g, '#57a83e', 3);
    g.beginPath(); g.moveTo(cx + 1.5, cy - 11); g.quadraticCurveTo(cx + 11, cy - 21, cx + 8.5, cy - 26); g.quadraticCurveTo(cx + 2, cy - 20, cx + 0.5, cy - 12); g.closePath(); fillStroke(g, '#57a83e', 3);
    g.beginPath(); g.moveTo(cx - 8.5, cy - 10.5); g.quadraticCurveTo(cx, cy - 14.5, cx + 8.5, cy - 10.5); g.quadraticCurveTo(cx + 6.8, cy + 3, cx, cy + 17); g.quadraticCurveTo(cx - 6.8, cy + 3, cx - 8.5, cy - 10.5); g.closePath(); fillStroke(g, '#f28c28', 3.2);
    g.beginPath(); g.moveTo(cx - 4.6, cy - 2.5); g.lineTo(cx + 0.6, cy - 2.5); g.moveTo(cx - 0.8, cy + 4.5); g.lineTo(cx + 4.2, cy + 4.5); g.moveTo(cx - 3.4, cy + 10.5); g.lineTo(cx + 0.8, cy + 10.5); g.strokeStyle = '#d96f16'; g.lineWidth = 2; g.stroke();
  } else if (kind === 'orb'){ // 水晶：水色の玉＋うず線＋ハイライト
    const oy = cy + 1;
    g.beginPath(); g.arc(cx, oy, 11.5, 0, 6.283); fillStroke(g, '#bfeaff', 3.2);
    g.beginPath(); g.moveTo(cx - 5, oy + 3); g.quadraticCurveTo(cx, oy - 4, cx + 5, oy + 2); g.strokeStyle = '#7cc4ea'; g.lineWidth = 2.2; g.stroke();
    g.save(); g.translate(cx, oy); g.rotate(-24 * D2R); g.translate(-cx, -oy); g.globalAlpha = 0.85; ell(g, cx - 4, oy - 4.5, 3.4, 2.2); g.fillStyle = '#fff'; g.fill(); g.restore();
  } else if (kind === 'apple'){ // リンゴ：頭のてっぺんに乗せる（中心から +12 が下端）
    g.beginPath(); g.moveTo(cx + 2.5, cy - 12.5); g.quadraticCurveTo(cx + 12.5, cy - 19.5, cx + 15.5, cy - 9.5); g.quadraticCurveTo(cx + 7.5, cy - 6.5, cx + 2.5, cy - 12.5); g.closePath(); fillStroke(g, '#57a83e', 2.6);
    g.beginPath(); g.moveTo(cx, cy - 9); g.quadraticCurveTo(cx - 3, cy - 12, cx - 7, cy - 10); g.quadraticCurveTo(cx - 14, cy - 6, cx - 12.5, cy + 2); g.quadraticCurveTo(cx - 11, cy + 11, cx, cy + 12);
    g.quadraticCurveTo(cx + 11, cy + 11, cx + 12.5, cy + 2); g.quadraticCurveTo(cx + 14, cy - 6, cx + 7, cy - 10); g.quadraticCurveTo(cx + 3, cy - 12, cx, cy - 9); g.closePath(); fillStroke(g, '#e23b3b', 3.4);
    g.beginPath(); g.moveTo(cx, cy - 9.5); g.quadraticCurveTo(cx + 0.8, cy - 14.5, cx + 3.8, cy - 17.5); g.strokeStyle = '#8a5a24'; g.lineWidth = 3.2; g.stroke();
    g.save(); g.translate(cx, cy); g.rotate(-18 * D2R); g.translate(-cx, -cy); g.globalAlpha = 0.38; ell(g, cx - 5.5, cy - 2, 3.2, 5); g.fillStyle = '#fff'; g.fill(); g.restore();
  } else if (kind === 'acorn') drawAcorn(g, cx, cy - 4);
  g.restore();
}
// ---- ドラゴンのしっぽ（太いヘビ形の筒＋先のスペード。1本の輪郭）----
// bendPct：曲がり（動かす）、flip：下向き。spikes>0 で背中側（外側のふち）にトゲ
function drawDragonTail(g, T, bodyCx, bodyCy, A, angle, bendPct, spikes, spikeCol){
  const S = (T.size ?? 100) / 100, bx = bodyCx - 20, by = bodyCy + 20, fig = g.getTransform();
  const thF = (T.thick ?? 100) / 100, bd = bendPct / 100 - 1, fy = T.flip ? -1 : 1;
  const Cp = { x: -38 - 14 * bd, y: (-4 - 12 * bd) * fy }, Tp = { x: -34 - 8 * bd, y: (-42 - 10 * bd) * fy };
  const q = t => { const u = 1 - t; return { x: 2 * u * t * Cp.x + t * t * Tp.x, y: 2 * u * t * Cp.y + t * t * Tp.y }; };
  const qd = t => ({ x: 2 * (1 - t) * Cp.x + 2 * t * (Tp.x - Cp.x), y: 2 * (1 - t) * Cp.y + 2 * t * (Tp.y - Cp.y) });
  const rB = 11 * thF, rT = 3.4 * thF, N = 9, left = [], right = [];
  for (let i = 0; i <= N; i++){
    const t = i / N, p = q(t), d = qd(t), dl = Math.hypot(d.x, d.y) || 1, nx = -d.y / dl, ny = d.x / dl, r = rB + (rT - rB) * Math.pow(t, 0.8);
    left.push([p.x + nx * r, p.y + ny * r]); right.push([p.x - nx * r, p.y - ny * r]);
  }
  const tan = qd(1), tl = Math.hypot(tan.x, tan.y) || 1, tx = tan.x / tl, ty = tan.y / tl, tnx = -ty, tny = tx;
  const spade = [[Tp.x + tnx * 8.5, Tp.y + tny * 8.5], [Tp.x + tx * 13, Tp.y + ty * 13], [Tp.x - tnx * 8.5, Tp.y - tny * 8.5]];
  g.save(); g.translate(T.posX || 0, T.posY || 0); g.translate(bx, by); g.rotate(angle * D2R); g.scale(S, S);
  g.lineJoin = 'round';
  if (spikes > 0){ // 背中側のトゲ：弧の外側（根元と先を結ぶ線から遠い側）に生やす。根元は しっぽに隠れる
    const Mx = Tp.x / 2, My = Tp.y / 2;
    for (const [t, k] of [[0.42, 1], [0.6, 0.9], [0.77, 0.75]]){ // 胴と翼に隠れない 先寄りに3本
      const p = q(t), d = qd(t), dl = Math.hypot(d.x, d.y) || 1; let nx = -d.y / dl, ny = d.x / dl;
      if (nx * (Mx - p.x) + ny * (My - p.y) > 0){ nx = -nx; ny = -ny; }
      const r = rB + (rT - rB) * Math.pow(t, 0.8), len = (10 + 6 * spikes) * k, w = 5.5 * k, ux = d.x / dl, uy = d.y / dl;
      const b0x = p.x + nx * (r - 4), b0y = p.y + ny * (r - 4);
      g.beginPath(); g.moveTo(b0x - ux * w, b0y - uy * w); g.lineTo(p.x + nx * (r + len) + ux * 2, p.y + ny * (r + len) + uy * 2); g.lineTo(b0x + ux * w, b0y + uy * w); g.closePath();
      const here = g.getTransform(); g.setTransform(fig); fillStroke(g, spikeCol, 4); g.setTransform(here);
    }
  }
  smoothClosed(g, left.concat(spade).concat(right.reverse()));
  g.setTransform(fig); fillStroke(g, A.fur, 4); // 塗りは体と同じ座標で（ニジイロ対策）、線は足と同じ太さ
  g.restore();
}
// ---- ドラゴンの翼（胴の上のわきから。ジャンプで打ち下ろし、ふだんは小さくぱたぱた）----
// spikes>0：トゲトゲ。翼の上のふち（骨の通る前縁）から外へトゲ（根元は翼に隠れる）
function drawWings(g, W, body, bodyCx, bodyCy, A, t, seed, spikes, spikeCol){
  const S = (W.size ?? 100) / 100, bu = (W.bulge ?? 100) / 100, b = v => v * bu;
  const ang = (W.angle || 0) + 7 * Math.sin(t * 7 + seed) + 22 * jumpOf(t, seed);
  for (const sd of [-1, 1]){
    g.save(); g.translate(bodyCx + sd * (body.W * 0.44 + (W.posX || 0)), bodyCy + body.H * 0.04 + (W.posY || 0)); g.rotate(sd * ang * D2R); g.scale(sd * S, S);
    if (spikes > 0){
      for (const [u, k] of [[0.48, 0.85], [0.7, 1], [0.9, 0.9]]){ // 頭に隠れない外側寄りに3本
        const v = 1 - u, px = 2 * v * u * 18 + u * u * 38, py = 2 * v * u * -22 + u * u * -27;
        const dx = 2 * v * 18 + 2 * u * 20, dy = 2 * v * -22 + 2 * u * -5, dl = Math.hypot(dx, dy), tx = dx / dl, ty = dy / dl, nx = ty, ny = -tx;
        const len = (10 + 5 * spikes) * k, w = 5.5 * k, bx = px - nx * 2, by = py - ny * 2;
        g.beginPath(); g.moveTo(bx - tx * w, by - ty * w); g.lineTo(px + nx * len + tx * 1.5, py + ny * len + ty * 1.5); g.lineTo(bx + tx * w, by + ty * w); g.closePath();
        g.lineJoin = 'round'; fillStroke(g, spikeCol, 4 / S);
      }
    }
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(18, -22, 38, -27); g.quadraticCurveTo(30, b(-15), 33, b(-6)); g.quadraticCurveTo(24, b(-10), 20, b(1)); g.quadraticCurveTo(11, b(-6), 5, b(6)); g.quadraticCurveTo(2, b(1), 0, 0); g.closePath();
    g.lineJoin = 'round'; fillStroke(g, A.dark, 5.6 / S); // 輪郭は頭（5）より少し太いくらい（翼の拡大率で割り戻す）
    g.beginPath(); g.moveTo(1, -1); g.quadraticCurveTo(18, -19, 36, -25); g.strokeStyle = INK; g.lineWidth = 3.2 / S; g.lineCap = 'round'; g.stroke();
    g.restore();
  }
}
// ---- ウサギのしっぽ（白いぽんぽん。胴の右下の後ろ）----
function drawPompomTail(g, T, body, bodyCx, bodyCy, t, seed){
  // ぴこぴこ：上下と左右に小刻みにゆれて、ふくらんだり縮んだりする
  const r = 13 * (T.size ?? 100) / 100, w = t * 9 + seed;
  const x = bodyCx + body.W * 0.46 + (T.posX || 0) + Math.cos(w * 0.5) * 2, y = bodyCy + body.H * 0.30 + (T.posY || 0) + Math.sin(w) * 3;
  g.beginPath(); g.ellipse(x, y, r * (1 + 0.1 * Math.sin(w + 1)), r * (1 - 0.08 * Math.sin(w + 1)), 0, 0, 6.283); fillStroke(g, '#ffffff', 5);
}
// ---- ゾウの鼻（トランク）：付け根から下へ垂れ、curl で先が横へ曲がる。シワ線3本は鼻の形で切り抜く ----
function drawTrunk(g, TR, cx, noseY, A, curlPct, rot, tipCol, hook){
  const thF = (TR.thick ?? 100) / 100, lenF = (TR.len ?? 100) / 100, cf = curlPct / 100;
  const w = 19 * thF, len = 56 * lenF, ry = noseY - 2 + (TR.posY || 0);
  // hook（0〜1）：鼻先だけ 外上へくるっと曲げる（付け根側は動かさない）
  const hk = hook || 0, hD = hk * 20, hL = hk * len * 0.45;
  const drift = cf * 17, lift = Math.abs(cf) * len * 0.10, off = t => drift * t * t + hD * t ** 4, liftAt = t => lift * t * t + hL * t ** 4;
  const tipX = cx + 7 * thF + off(1), tipY = ry + len - liftAt(1);
  // 先の丸いふたは 鼻先の向きに合わせて回す（まっすぐ垂れているときは今までと同じ形）
  const p8x = cx + off(0.82), p8y = ry + len * 0.82 - liftAt(0.82), tdl = Math.hypot(tipX - p8x, tipY - p8y) || 1, tdx = (tipX - p8x) / tdl, tdy = (tipY - p8y) / tdl;
  const td = hk > 0 ? [tdx, tdy] : [0, 1], nx = td[1], ny = -td[0];
  g.save(); if (rot){ g.translate(cx, ry); g.rotate(rot * D2R); g.translate(-cx, -ry); } // 水しぶき：付け根を支点に鼻を横へ振り上げる（顔にかぶらない向き）
  const path = () => {
    g.beginPath(); g.moveTo(cx - w / 2, ry);
    g.bezierCurveTo(cx - w / 2 + off(0.42), ry + len * 0.42 - liftAt(0.42), cx - w * 0.30 + off(0.82), ry + len * 0.82 - liftAt(0.82), tipX - nx * w * 0.42, tipY - ny * w * 0.42);
    g.quadraticCurveTo(tipX + td[0] * 7 * thF, tipY + td[1] * 7 * thF, tipX + nx * w * 0.42, tipY + ny * w * 0.42);
    g.bezierCurveTo(cx + w * 0.34 + off(0.80), ry + len * 0.80 - liftAt(0.80), cx + w / 2 + off(0.40), ry + len * 0.40 - liftAt(0.40), cx + w / 2, ry);
    g.quadraticCurveTo(cx, ry - 6, cx - w / 2, ry); g.closePath();
  };
  path(); g.fillStyle = A.fur; g.fill();
  if (tipCol){ g.save(); path(); g.clip(); g.fillStyle = tipCol; const bx = cx + off(0.8) + (tipX - cx) * 0, by = ry + len * 0.8 - liftAt(0.8), dd = hk > 0 ? td : [0, 1]; g.beginPath(); g.moveTo(bx - dd[1] * 90, by + dd[0] * 90); g.lineTo(bx + dd[1] * 90, by - dd[0] * 90); g.lineTo(bx + dd[1] * 90 + dd[0] * 150, by - dd[0] * 90 + dd[1] * 150); g.lineTo(bx - dd[1] * 90 + dd[0] * 150, by + dd[0] * 90 + dd[1] * 150); g.closePath(); g.fill(); g.restore(); } // 鼻先の色（ゾウ案）
  g.save(); path(); g.clip();
  const lwF = (TR.lineWidth ?? 70) / 100, lp = TR.linePos || 0;
  g.strokeStyle = INK; g.lineWidth = 2.2; g.lineCap = 'round'; g.globalAlpha = 0.45;
  for (const f0 of [0.40, 0.58, 0.76]){
    const t = C(f0 + lp * 0.004, 0.12, 0.92), ccx = cx + (tipX - cx) * Math.pow(t, 1.25), cyy = ry + len * t - liftAt(t), lw = w * (1 - 0.16 * t) * lwF;
    g.beginPath(); g.moveTo(ccx - lw / 2, cyy); g.quadraticCurveTo(ccx, cyy + len * 0.045, ccx + lw / 2, cyy); g.stroke();
  }
  g.restore();
  path(); g.strokeStyle = INK; g.lineWidth = 4.5; g.lineJoin = 'round'; g.stroke();
  g.restore();
  // 鼻先の位置と向き（回したあと）を返す：水しぶきの出どころ
  const a = (rot || 0) * D2R, rx = (x, y) => [cx + (x - cx) * Math.cos(a) - (y - ry) * Math.sin(a), ry + (x - cx) * Math.sin(a) + (y - ry) * Math.cos(a)];
  const tip = rx(tipX + td[0] * 4, tipY + td[1] * 4), mid = hk > 0 ? rx(p8x, p8y) : rx(cx + off(0.6), ry + len * 0.6);
  return { tip, dir: [tip[0] - mid[0], tip[1] - mid[1]] };
}
// ---- 水しぶき（ゾウ案）：振り上げた鼻先から 水色の粒が外へ飛ぶ ----
function drawSpray(g, tr, t, k){
  const [tx, ty] = tr.tip, dl = Math.hypot(tr.dir[0], tr.dir[1]) || 1, ux = tr.dir[0] / dl, uy = tr.dir[1] / dl;
  for (let i = 0; i < 8; i++){
    const age = (t * 2.6 + i / 8) % 1, sp = (i - 3.5) * 0.16, ca = Math.cos(sp), sa = Math.sin(sp), dx = ux * ca - uy * sa, dy = ux * sa + uy * ca;
    const d = 6 + age * 52, x = tx + dx * d, y = ty + dy * d + age * age * 22, r = (5.2 - age * 2.2) * k;
    if (r <= 0.3) continue;
    g.globalAlpha = Math.min(1, (1 - age) * 1.6) * k; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fillStyle = '#9fdcff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
  }
  g.globalAlpha = 1;
}
// ---- マンモスの牙（ゾウの fangs）：口の両わきから下へ出て、外へ曲がって先が上を向く ----
function drawTusks(g, fg, f, cx, mouthY){
  const L = 30 * (fg.len ?? 100) / 100, W = 9 * (fg.width ?? 100) / 100, off = 11 * (fg.spacing ?? 100) / 100;
  const baseY = mouthY + (f.mouthPosY || 0) + (fg.posY || 0), bx0 = cx + (f.mouthPosX || 0);
  const P0 = { x: 0, y: 0 }, P1 = { x: W * 0.18, y: L * 0.52 }, P2 = { x: L * 0.34, y: L * 0.88 }, P3 = { x: L * 0.56, y: L * 0.50 };
  const cub = t => { const u = 1 - t; return { x: u*u*u*P0.x + 3*u*u*t*P1.x + 3*u*t*t*P2.x + t*t*t*P3.x, y: u*u*u*P0.y + 3*u*u*t*P1.y + 3*u*t*t*P2.y + t*t*t*P3.y }; };
  const cubD = t => { const u = 1 - t; return { x: 3*u*u*(P1.x - P0.x) + 6*u*t*(P2.x - P1.x) + 3*t*t*(P3.x - P2.x), y: 3*u*u*(P1.y - P0.y) + 6*u*t*(P2.y - P1.y) + 3*t*t*(P3.y - P2.y) }; };
  const left = [], right = [];
  for (let i = 0; i <= 10; i++){
    const t = i / 10, p = cub(t), d = cubD(t), dl = Math.hypot(d.x, d.y) || 1, nx = -d.y / dl, ny = d.x / dl, r = W / 2 * Math.pow(1 - t, 0.65) + 0.6;
    left.push([p.x + nx * r, p.y + ny * r]); right.push([p.x - nx * r, p.y - ny * r]);
  }
  const tan = cubD(1), tl = Math.hypot(tan.x, tan.y) || 1, tip = [P3.x + tan.x / tl * 3, P3.y + tan.y / tl * 3];
  const pts = left.concat([tip]).concat(right.reverse());
  for (const sd of [-1, 1]){
    g.save(); g.translate(bx0 + sd * off, baseY); g.rotate(sd * (fg.angle || 0) * D2R); g.scale(sd, 1);
    smoothClosed(g, pts); g.lineJoin = 'round'; fillStroke(g, '#fff', 3); g.restore();
  }
}
// ---- ゾウのしっぽ：付け根は太く、細いひもから先の房へふくらむ1本の輪郭。房は おなかの色 ----
function drawElephantTail(g, T, body, bodyCx, bodyCy, A, angle){
  const S = (T.size ?? 100) / 100, fig = g.getTransform();
  const B = { x: bodyCx + body.W * 0.30, y: bodyCy + body.H * 0.30 }, Cc = { x: bodyCx + body.W * 0.66, y: bodyCy + body.H * 0.42 }, Tt = { x: bodyCx + body.W * 0.62, y: bodyCy + body.H * 0.72 };
  const q = t => { const u = 1 - t; return { x: u*u*B.x + 2*u*t*Cc.x + t*t*Tt.x, y: u*u*B.y + 2*u*t*Cc.y + t*t*Tt.y }; };
  const qd = t => ({ x: 2*(1 - t)*(Cc.x - B.x) + 2*t*(Tt.x - Cc.x), y: 2*(1 - t)*(Cc.y - B.y) + 2*t*(Tt.y - Cc.y) });
  const radius = t => { if (t < 0.45){ const u = t / 0.45; return 5.2 + (2.6 - 5.2) * (u * u * (3 - 2 * u)); } if (t < 0.75) return 2.6; const v = (t - 0.75) / 0.25; return 2.6 + (7.8 - 2.6) * (v * v * (3 - 2 * v)); };
  const side = (t0, n, pad) => { const l = [], r = []; for (let i = 0; i <= n; i++){ const t = t0 + (1 - t0) * i / n, p = q(t), d = qd(t), dl = Math.hypot(d.x, d.y) || 1, nx = -d.y / dl, ny = d.x / dl, rr = radius(t) + pad; l.push([p.x + nx * rr, p.y + ny * rr]); r.push([p.x - nx * rr, p.y - ny * rr]); } return [l, r]; };
  const tan = qd(1), tll = Math.hypot(tan.x, tan.y) || 1, tx = tan.x / tll, ty = tan.y / tll, tnx = -ty, tny = tx, rT = radius(1);
  const [l1, r1] = side(0, 14, 0);
  const cap = [[0.98, 0.45], [0.72, 0.95], [0, 1.30], [-0.72, 0.95], [-0.98, 0.45]].map(([a, b]) => [Tt.x + tnx * rT * a + tx * rT * b, Tt.y + tny * rT * a + ty * rT * b]);
  const outline = l1.concat(cap).concat(r1.reverse());
  const [l2, r2] = side(0.77, 5, 2.5);
  const tipCap = [[Tt.x + tnx * (rT + 2.5) * 0.72 + tx * (rT + 4) * 0.8, Tt.y + tny * (rT + 2.5) * 0.72 + ty * (rT + 4) * 0.8], [Tt.x + tx * (rT + 4.5), Tt.y + ty * (rT + 4.5)], [Tt.x - tnx * (rT + 2.5) * 0.72 + tx * (rT + 4) * 0.8, Tt.y - tny * (rT + 2.5) * 0.72 + ty * (rT + 4) * 0.8]];
  const px = bodyCx + body.W * 0.44, py = B.y;
  g.save(); g.translate(T.posX || 0, T.posY || 0); g.translate(px, py); g.rotate(angle * D2R); g.scale(S, T.flip ? -S : S); g.translate(-px, -py);
  const here = g.getTransform();
  smoothClosed(g, outline); g.setTransform(fig); g.fillStyle = A.fur; g.fill(); g.setTransform(here);
  g.save(); smoothClosed(g, outline); g.clip(); smoothClosed(g, l2.concat(tipCap).concat(r2.reverse())); g.fillStyle = A.belly; g.fill(); g.restore();
  smoothClosed(g, outline); g.setTransform(fig); g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
  g.restore();
}
// ---- トゲトゲ（ゾウ）：頭のてっぺんのふちから外向きにトゲ3本 ----
function drawHeadSpikes(g, head, k, col, list){
  for (const [fx, sc] of list || [[-0.34, 0.8], [-0.18, 1], [0.18, 1], [0.34, 0.8]]){ // まんなかはリンゴがあるので空ける
    const tx = head.cx + head.W * fx; let best = null;
    for (const p of head.pts) if (p[1] < head.cy && (!best || Math.abs(p[0] - tx) < Math.abs(best[0] - tx))) best = p;
    let dx = best[0] - head.cx, dy = best[1] - (head.cy + head.H * 0.2); const d = Math.hypot(dx, dy); dx /= d; dy /= d;
    const len = (22 + 12 * k) * sc, w = 10 * sc, bx = best[0] - dx * 8, by = best[1] - dy * 8;
    g.beginPath(); g.moveTo(bx - dy * w, by + dx * w); g.lineTo(best[0] + dx * len, best[1] + dy * len); g.lineTo(bx + dy * w, by - dx * w); g.closePath();
    g.lineJoin = 'round'; fillStroke(g, col, 4);
  }
}
// ---- 首輪と鈴（頭と胴の輪郭で切り抜く）----
function drawCollar(g, CO, head, body, bodyCx, bodyCy, bodyAngle){
  const cThick = 9 * (CO.beltThick ?? 100) / 100, cSizeF = (CO.beltSize ?? 100) / 100, cBellR = 9 * (CO.bellSize ?? 100) / 100;
  const cCx = head.cx + (CO.posX || 0), cCy = head.bottom + 3 + (CO.posY || 0) + (cSizeF - 1) * 6, hw = body.W * 0.62 * cSizeF, sag = 6;
  g.save();
  g.beginPath(); poly(g, head.pts, true);
  g.save(); g.translate(bodyCx, bodyCy); g.rotate(bodyAngle * D2R); g.translate(-bodyCx, -bodyCy); poly(g, body.pts, true); g.restore();
  g.clip();
  g.beginPath(); g.moveTo(cCx - hw, cCy); g.quadraticCurveTo(cCx, cCy + sag, cCx + hw, cCy); g.quadraticCurveTo(cCx, cCy + sag + cThick, cCx - hw, cCy); g.closePath();
  g.lineJoin = 'round'; fillStroke(g, '#e23b3b', 2.4);
  g.restore();
  const bx = cCx + (CO.bellPosX || 0), by = cCy + (sag + cThick) / 2 + cBellR * 0.82 + (CO.bellPosY || 0);
  g.beginPath(); g.arc(bx, by - cBellR * 0.95, cBellR * 0.30, 0, 6.283); fillStroke(g, '#f5a623', 2.2);
  g.beginPath(); g.arc(bx, by, cBellR, 0, 6.283); fillStroke(g, '#f7b731', 3);
  g.beginPath(); g.moveTo(bx - cBellR * 0.88, by + cBellR * 0.26); g.quadraticCurveTo(bx, by + cBellR * 0.5, bx + cBellR * 0.88, by + cBellR * 0.26); g.strokeStyle = INK; g.lineWidth = 2.4; g.lineCap = 'round'; g.stroke();
  g.beginPath(); g.arc(bx, by + cBellR * 0.6, cBellR * 0.15, 0, 6.283); g.fillStyle = INK; g.fill();
  g.save(); g.translate(bx, by); g.rotate(-24 * D2R); g.translate(-bx, -by); g.globalAlpha = 0.55; ell(g, bx - cBellR * 0.38, by - cBellR * 0.42, cBellR * 0.2, cBellR * 0.12); g.fillStyle = '#fff'; g.fill(); g.restore();
}

// ---- 診断で付く小物（どの動物でも「頭のてっぺん」などの基準点で付ける）----
function drawHorn(g, x, by, hl, lean, col){
  const w = 7;
  g.beginPath(); g.moveTo(x - w, by + 4); g.quadraticCurveTo(x - w * 0.6 + lean * hl * 0.2, by - hl * 0.6, x + lean * hl * 0.45, by - hl); g.quadraticCurveTo(x + w * 0.7 + lean * hl * 0.2, by - hl * 0.5, x + w, by + 4); g.closePath();
  g.lineJoin = 'round'; fillStroke(g, col, 4);
}
function drawAcorn(g, x, y){
  ell(g, x, y + 4, 9, 12); fillStroke(g, '#8a4f1d', 3.4);
  g.beginPath(); g.moveTo(x - 9.5, y + 1); g.quadraticCurveTo(x, y - 7, x + 9.5, y + 1); g.quadraticCurveTo(x, y - 1, x - 9.5, y + 1); g.closePath(); fillStroke(g, '#5e3613', 2.6);
  g.strokeStyle = INK; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 1.5, y - 9); g.stroke();
}

// ---- 1匹ぶんの描画（原画座標）----
// ---- ヒツジのパーツ ----
// モコモコの毛：だ円にそって白い円を並べた集まり。box は {cx, top, W, H}（頭 or 体）
function woolGeom(box, w){
  const sF = (w.size ?? 100) / 100, tF = (w.thick ?? 100) / 100, bF = (w.bump ?? 100) / 100;
  const cx = box.cx + (w.posX || 0), cy = box.top + box.H * 0.46 + (w.posY || 0);
  const rxO = box.W * 0.58 * sF, ryO = box.H * 0.60 * sF, r = Math.max(6, (15 + 11 * tF) * sF * bF);
  const rxM = Math.max(20, rxO - r), ryM = Math.max(12, ryO - r), M = 360, sx = [], sy = [], cum = [0];
  for (let i = 0; i <= M; i++){ const th = -Math.PI / 2 + i / M * Math.PI * 2, px = cx + rxM * Math.cos(th), py = cy + ryM * Math.sin(th); if (i) cum.push(cum[i - 1] + Math.hypot(px - sx[i - 1], py - sy[i - 1])); sx.push(px); sy.push(py); }
  const Ptot = cum[M], N = Math.max(7, Math.round(Ptot / (1.5 * r))), centers = [];
  for (let k = 0; k < N; k++){ const tg = k * Ptot / N; let j = 0; while (j < M && cum[j + 1] < tg) j++; const f = (tg - cum[j]) / ((cum[j + 1] - cum[j]) || 1), X = sx[j] + (sx[j + 1] - sx[j]) * f, Y = sy[j] + (sy[j + 1] - sy[j]) * f; centers.push({ x: X, y: Y, ang: Math.atan2((Y - cy) / ryM, (X - cx) / rxM) * 180 / Math.PI }); }
  const topDiff = a => { let d = a + 90; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
  const front = centers.filter(c => Math.abs(topDiff(c.ang)) <= 68).sort((a, b) => topDiff(a.ang) - topDiff(b.ang));
  return { cx, cy, r, centers, front, rxO, ryO };
}
function woolPair(c0, c1, r, gx, gy){
  const dx = c1.x - c0.x, dy = c1.y - c0.y, d = Math.hypot(dx, dy) || 0.001, mx = (c0.x + c1.x) / 2, my = (c0.y + c1.y) / 2, h = Math.sqrt(Math.max(0, r * r - d * d / 4)), ux = -dy / d, uy = dx / d;
  const pA = { x: mx + h * ux, y: my + h * uy }, pB = { x: mx - h * ux, y: my - h * uy };
  return (pA.x - gx) ** 2 + (pA.y - gy) ** 2 >= (pB.x - gx) ** 2 + (pB.y - gy) ** 2 ? { outer: pA, inner: pB } : { outer: pB, inner: pA };
}
function woolArc(g, cx, cy, r, from, to, mid){ // from → to を mid を通る向きで まわる円弧
  const T = Math.PI * 2, norm = a => { a %= T; return a < 0 ? a + T : a; };
  const a0 = Math.atan2(from.y - cy, from.x - cx), a1 = Math.atan2(to.y - cy, to.x - cx), am = Math.atan2(mid.y - cy, mid.x - cx);
  g.arc(cx, cy, r, a0, a1, !(norm(am - a0) <= norm(a1 - a0)));
}
const woolOut = (c, r, gx, gy) => { const dx = c.x - gx, dy = c.y - gy, d = Math.hypot(dx, dy) || 1; return { x: c.x + r * dx / d, y: c.y + r * dy / d }; };
const woolIn = (c, r, gx, gy) => { const dx = c.x - gx, dy = c.y - gy, d = Math.hypot(dx, dy) || 1; return { x: c.x - r * dx / d, y: c.y - r * dy / d }; };
function woolRingPath(g, G, inner){
  const cs = G.centers, N = cs.length, r = G.r, pairs = cs.map((c, i) => woolPair(c, cs[(i + 1) % N], r, G.cx, G.cy)), k = inner ? 'inner' : 'outer';
  g.beginPath(); g.moveTo(pairs[N - 1][k].x, pairs[N - 1][k].y);
  for (let i = 0; i < N; i++) woolArc(g, cs[i].x, cs[i].y, r, pairs[(i + N - 1) % N][k], pairs[i][k], (inner ? woolIn : woolOut)(cs[i], r, G.cx, G.cy));
  g.closePath();
}
function woolCirclesPath(g, list, r){ g.beginPath(); for (const c of list){ g.moveTo(c.x + r, c.y); g.arc(c.x, c.y, r, 0, 6.283); } }
// 後ろの毛（頭のまわりの輪 / 体そのもの）。inner:false で内側の線を引かない（体）
function drawWoolBack(g, box, w, col, inner, glint){
  const G = woolGeom(box, w);
  woolCirclesPath(g, G.centers, G.r); g.fillStyle = col; g.fill();
  if (glint != null){ // キンイロ：毛のふくらみに 白い光の点と ちらちら光る星
    G.centers.forEach((c, i) => { const ox = c.x + (G.cx - c.x) * 0.25, oy = c.y + (G.cy - c.y) * 0.25 - G.r * 0.25; g.fillStyle = 'rgba(255,255,240,.55)'; ell(g, ox, oy, G.r * 0.32, G.r * 0.2, -0.5); g.fill();
      if (i % 3 === 0){ const k = Math.max(0, Math.sin(glint * 4 + i * 1.9)), R = G.r * 0.45 * k; if (R > 0.5){ g.fillStyle = `rgba(255,255,255,${0.95 * k})`; g.beginPath(); for (let j = 0; j < 8; j++){ const a = j / 8 * 6.283, rr = j % 2 ? R * 0.28 : R; g.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr); } g.closePath(); g.fill(); } } });
  }
  g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round';
  woolRingPath(g, G, false); g.stroke();
  if (inner){ woolRingPath(g, G, true); g.stroke(); }
  return G;
}
// おでこの前髪：上の円の列を上下反転して 下向きのモコモコに。後ろの毛の外形で切り抜く
function drawWoolFront(g, head, w, col){
  const fObj = { size: w.frontSize ?? w.size, thick: w.frontThick ?? w.thick, bump: w.frontBump ?? w.bump, posX: (w.posX || 0) + (w.frontPosX || 0), posY: (w.posY || 0) + (w.frontPosY || 0) };
  const G = woolGeom(head, fObj), cs = G.front, K = cs.length, r = G.r;
  if (K < 2) return;
  const axisY = (cs[0].y + cs[K - 1].y) / 2, fc = cs.map(c => ({ x: c.x, y: 2 * axisY - c.y })), gx = G.cx, gy = 2 * axisY - G.cy;
  let maxD = 0; for (let j = 0; j < K; j++) maxD = Math.max(maxD, Math.abs(fc[j].y - cs[j].y));
  const rows = Math.max(1, Math.ceil(maxD / (1.2 * r))), fill = [];
  for (let t = 0; t <= rows; t++) for (let j = 0; j < K; j++) fill.push({ x: cs[j].x, y: cs[j].y + (fc[j].y - cs[j].y) * t / rows });
  g.save(); woolRingPath(g, woolGeom(head, w), false); g.clip();
  woolCirclesPath(g, fill, r + 0.8); g.fillStyle = col; g.fill(); // 少し大きめに塗って 下の線のすき間の点を消す
  const pairs = []; for (let j = 0; j < K - 1; j++) pairs.push(woolPair(fc[j], fc[j + 1], r, gx, gy));
  const p0 = woolOut(fc[0], r, gx, gy), pN = woolOut(fc[K - 1], r, gx, gy);
  g.beginPath(); g.moveTo(p0.x, p0.y);
  woolArc(g, fc[0].x, fc[0].y, r, p0, pairs[0].outer, { x: fc[0].x, y: fc[0].y + r });
  for (let j = 1; j < K - 1; j++) woolArc(g, fc[j].x, fc[j].y, r, pairs[j - 1].outer, pairs[j].outer, woolOut(fc[j], r, gx, gy));
  woolArc(g, fc[K - 1].x, fc[K - 1].y, r, pairs[K - 2].outer, pN, { x: fc[K - 1].x, y: fc[K - 1].y + r });
  g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
  g.restore();
}
// トゲトゲ（ヒツジ）：頭の毛の外側の上半分からトゲ（根元は毛に隠れる → 毛より先に描く）
function drawWoolSpikes(g, head, w, k, col){
  const G = woolGeom(head, w);
  for (const [deg, sc] of [[-150, 0.8], [-120, 1], [-90, 1.15], [-60, 1], [-30, 0.8]]){
    const a = deg * D2R, ex = G.cx + G.rxO * Math.cos(a), ey = G.cy + G.ryO * Math.sin(a);
    let nx = Math.cos(a) / G.rxO, ny = Math.sin(a) / G.ryO; const d = Math.hypot(nx, ny); nx /= d; ny /= d;
    const len = (20 + 12 * k) * sc, wd = 10 * sc, bx = ex - nx * 12, by = ey - ny * 12;
    g.beginPath(); g.moveTo(bx - ny * wd, by + nx * wd); g.lineTo(ex + nx * len, ey + ny * len); g.lineTo(bx + ny * wd, by - nx * wd); g.closePath();
    g.lineJoin = 'round'; fillStroke(g, col, 4);
  }
}
// うずまきのツノ：外側が太く 中心へ細くなる帯を3回まき。輪郭も外が太く中が細い
function spiralBand(cx, cy, R, turns){
  const steps = 180, TH = turns * Math.PI * 2, P = 1.7, rCore = R * 0.015, rSpan = R * 0.80 - rCore;
  const radius = t => rCore + rSpan * Math.pow(t, P), drdt = t => t <= 0 ? 0 : rSpan * P * Math.pow(t, P - 1), hw = t => Math.max(drdt(t) / turns * 0.5 * 0.92, R * 0.008);
  const side = (t, sg) => { const a = -Math.PI / 2 + t * TH, r = radius(t), c = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }, h = hw(t), k = drdt(t) / TH;
    let tx = k * Math.cos(a) - r * Math.sin(a), ty = k * Math.sin(a) + r * Math.cos(a); const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
    return { x: 2 * cx - (c.x + sg * h * -ty), y: c.y + sg * h * tx, tx: -tx, ty, c: { x: 2 * cx - c.x, y: c.y }, hw: h }; }; // 巻く向きを反転（モックの flip）
  const L = [], Rt = []; for (let i = 0; i <= steps; i++){ L.push(side(i / steps, 1)); Rt.push(side(i / steps, -1)); }
  return { L, Rt, steps };
}
function drawSpiralHorns(g, s, head, col){
  const e = s.ear, Ln = 54 * e.len / 100, T = 34 * e.thick / 100, sR = Math.max(10, Ln * 0.42 + T * 0.30), scx = sR * 0.52, scy = -sR * 0.30;
  const baseY = head.top + head.H * 0.34 + e.posY, bx = head.W * 0.42 + e.posX, outer = g.getTransform();
  const B = spiralBand(scx, scy, sR, 3), { L, Rt, steps } = B, sw = t => 5 * (0.20 + 0.80 * Math.pow(t, 1.5));
  for (const sd of [-1, 1]){
    g.save(); g.translate(head.cx + sd * bx, baseY); g.rotate(sd * (6 + e.angle) * D2R); g.scale(sd, 1);
    const eB = L[steps], tB = Rt[0];
    g.beginPath(); g.moveTo(L[0].x, L[0].y); for (let i = 1; i <= steps; i++) g.lineTo(L[i].x, L[i].y);
    g.quadraticCurveTo(eB.c.x + eB.tx * eB.hw * 1.5, eB.c.y + eB.ty * eB.hw * 1.5, Rt[steps].x, Rt[steps].y);
    for (let i = steps - 1; i >= 0; i--) g.lineTo(Rt[i].x, Rt[i].y);
    g.quadraticCurveTo(tB.c.x - tB.tx * tB.hw * 2.2, tB.c.y - tB.ty * tB.hw * 2.2, L[0].x, L[0].y); g.closePath();
    { const here = g.getTransform(); g.setTransform(outer); g.fillStyle = col; g.fill(); g.setTransform(here); }
    g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
    const seg = (pts, tm) => { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let q = 1; q < pts.length; q++) g.lineTo(pts[q].x, pts[q].y); g.lineWidth = sw(tm); g.stroke(); };
    for (let i = 0; i < steps; i += 9){ const j2 = Math.min(steps, i + 9), pts = []; for (let j = i ? i - 1 : 0; j <= j2; j++) pts.push(L[j]); seg(pts, (i + j2) / 2 / steps); }
    g.beginPath(); g.moveTo(eB.x, eB.y); g.quadraticCurveTo(eB.c.x + eB.tx * eB.hw * 1.5, eB.c.y + eB.ty * eB.hw * 1.5, Rt[steps].x, Rt[steps].y); g.lineWidth = 5; g.stroke();
    for (let i = steps; i > 0; i -= 9){ const j3 = Math.max(0, i - 9), pts = []; for (let k = i === steps ? steps : i + 1; k >= j3; k--) pts.push(Rt[k]); seg(pts, (i + j3) / 2 / steps); }
    g.beginPath(); g.moveTo(tB.x, tB.y); g.quadraticCurveTo(tB.c.x - tB.tx * tB.hw * 2.2, tB.c.y - tB.ty * tB.hw * 2.2, L[0].x, L[0].y); g.lineWidth = sw(0); g.stroke();
    g.restore();
  }
}
// ドリブルの進み具合：p＝0 左手〜1 右手、fl＝0 手もと〜1 床（まんなかで床にバウンド）
function dribblePhase(t, seed){ const u = (t * 1.15 + seed) % 2, p = u < 1 ? u : 2 - u; return { p, fl: 1 - Math.abs(2 * p - 1) }; }
// 毛糸玉（中心 x, y・大きさ k・回転 rot）
function drawYarn(g, x, y, k, rot){
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
  g.lineCap = 'round'; g.strokeStyle = '#df5f92'; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(8, 7); g.bezierCurveTo(17, 13, 26, 11, 27.5, 16.5); g.bezierCurveTo(28.6, 21, 24.2, 23.4, 22.2, 20.4); g.bezierCurveTo(20.6, 18, 22.4, 15.6, 24.3, 16.6); g.stroke();
  g.beginPath(); g.arc(0, 0, 13, 0, 6.283); fillStroke(g, '#f79ec1', 3.2);
  g.save(); g.beginPath(); g.arc(0, 0, 13, 0, 6.283); g.clip(); g.strokeStyle = '#df5f92'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-14, -5); g.quadraticCurveTo(-2, -12.5, 14, -6); g.moveTo(-14, 3); g.quadraticCurveTo(0, -4, 14, 2); g.moveTo(-3.5, -14); g.quadraticCurveTo(-12, 1, -3, 14); g.stroke();
  g.restore(); g.restore();
}
// ---- フクロウのパーツ ----
// 翼（胴の後ろ）：上のふちはなめらかな山、下のふちは根元が小さく先ほど大きい羽のなみなみ。flap で根元を支点にバサバサ
function drawOwlWings(g, H, body, bodyCx, bodyCy, A, flap, spikes, spikeCol){
  const hS = (H.size ?? 100) / 100, hAng = H.angle || 0, ob = (H.bulge ?? 100) / 100, hSp = (H.spacing || 0) / hS, outer = g.getTransform();
  const st = [[41, 10.5], [34, 11], [27.5, 10.4], [21, 9.3], [15, 8.1], [9.5, 6.7], [4, 5.3]];
  for (const sd of [-1, 1]){
    const xf = () => { g.translate(H.posX || 0, H.posY || 0); g.translate(bodyCx, bodyCy); g.scale(hS, hS); g.translate(-bodyCx, -bodyCy);
      g.translate(bodyCx + sd * (body.W / 2 + 1 + hSp), bodyCy - body.H * 0.02); g.rotate(sd * (hAng - flap) * D2R); g.scale(sd, 1); };
    if (spikes){ // トゲトゲ：翼の上のふちからトゲ（根元は翼に隠れる）
      g.save(); xf(); const len = 9 + 5 * spikes;
      for (const [x, y, a] of [[18, -13.5, -0.35], [30, -14.3, 0.05], [41, -10.5, 0.55]]){
        const dx = Math.sin(a), dy = -Math.cos(a);
        g.beginPath(); g.moveTo(x - 4.5, y + 3); g.lineTo(x + dx * len, y + dy * len); g.lineTo(x + 4.5, y + 3); g.closePath();
        g.setTransform(outer); g.lineJoin = 'round'; fillStroke(g, spikeCol, 3.5); g.restore(); g.save(); xf();
      }
      g.restore();
    }
    g.save(); xf();
    g.beginPath(); g.moveTo(0, 1); g.bezierCurveTo(3, -9, 16, -15.5, 29, -14.5); g.bezierCurveTo(39, -13.8, 46, -7, 46.5, 0.5); g.bezierCurveTo(46.8, 5.5, 44.5, 9, 41, 10.5);
    for (let i = 0; i < st.length - 1; i++){ const p0 = st[i], p1 = st[i + 1], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, dep = (1.2 + 7.4 * (mx / 46)) * (0.45 + 0.55 * ob); g.quadraticCurveTo(mx, my + dep, p1[0], p1[1]); }
    g.quadraticCurveTo(1.8, 4.2, 0, 1); g.closePath();
    g.setTransform(outer); g.lineJoin = 'round'; fillStroke(g, A.fur, 4); g.restore();
  }
}
// ランタン（ぶら下げ）：(x, y) が 輪っかのてっぺん（ヒモの先）。ang で そこを支点に揺れる。glow で まわりがぼんやり光る
function drawLantern(g, x, y, k, ang, glow){
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(k, k); g.translate(0, 23.2); // ここから先は ランタンの中心が原点
  if (glow > 0){ const gr = g.createRadialGradient(0, 3, 6, 0, 3, 42); gr.addColorStop(0, `rgba(255,214,110,${0.95 * glow})`); gr.addColorStop(1, 'rgba(255,214,110,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 3, 42, 0, 6.283); g.fill(); }
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.arc(0, -19, 4.2, 0, 6.283); g.strokeStyle = INK; g.lineWidth = 2.8; g.stroke();
  g.beginPath(); g.moveTo(0, -15); g.lineTo(0, -12); g.stroke();
  g.beginPath(); g.moveTo(-9, -8); g.lineTo(9, -8); g.lineTo(6.5, -12.5); g.lineTo(-6.5, -12.5); g.closePath(); fillStroke(g, '#37424e', 2.8);
  g.beginPath(); g.arc(0, 3, 13.5, 0, 6.283); fillStroke(g, '#ffdf9e', 3.2);
  ell(g, 0, 3, 7.5, 9.5); g.fillStyle = glow > 0 ? '#ffb347' : '#ffc46b'; g.fill(); ell(g, 0, 3, 3.6, 5.2); g.fillStyle = '#fff3c4'; g.fill();
  g.strokeStyle = '#37424e'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(-6.8, -9); g.quadraticCurveTo(-10, 3, -6.8, 15); g.moveTo(6.8, -9); g.quadraticCurveTo(10, 3, 6.8, 15); g.stroke();
  g.beginPath(); g.moveTo(-7.5, 13.5); g.lineTo(7.5, 13.5); g.lineTo(5.5, 18); g.lineTo(-5.5, 18); g.closePath(); fillStroke(g, '#37424e', 2.8);
  g.restore();
}
// ---- ヒヨコのパーツ ----
// しっぽ：体の後ろ側から ぴょこっと立つ房（根元が支点）
function drawDuckTail(g, T, body, bodyCx, bodyCy, A, angle){
  const S = (T.size ?? 100) / 100, outer = g.getTransform();
  g.save(); g.translate(T.posX || 0, T.posY || 0); g.translate(bodyCx + body.W * 0.46, bodyCy + body.H * 0.05); g.rotate(angle * D2R); g.scale(S, T.flip ? -S : S);
  g.beginPath(); g.moveTo(-3, 3); g.quadraticCurveTo(-16, -4, -19, -24); g.quadraticCurveTo(-7, -16, -4, -32); g.quadraticCurveTo(4, -17, 11, -22); g.quadraticCurveTo(13, -6, 6, 3); g.closePath();
  g.setTransform(outer); g.lineJoin = 'round'; fillStroke(g, A.fur, 4.5 * S); g.restore();
}
// 手：天使の羽の形の小さな翼（体の横から内側へ）。ぱたぱた動く
function drawWingHands(g, H, body, bodyCx, bodyCy, A, hy, up){
  const hS = (H.size ?? 100) / 100, hAng = H.angle || 0, gb = (H.bulge ?? 100) / 100, hSp = (H.spacing || 0) / hS, outer = g.getTransform();
  const wL = 38, wH = 27 + 7 * gb, wSc = (0.10 + 0.13 * gb) * wH;
  for (const sd of [-1, 1]){
    g.save(); g.translate(H.posX || 0, H.posY || 0); g.translate(bodyCx, bodyCy); g.scale(hS, hS); g.translate(-bodyCx, -bodyCy);
    g.translate(bodyCx + sd * (body.W / 2 + 1 + hSp), bodyCy - body.H * 0.02); g.rotate(sd * (hAng - hy(sd) * 5 * (1 - (up || 0)) + 55 * (up || 0)) * D2R); g.scale(-sd, 1);
    g.beginPath(); g.moveTo(0, 3);
    g.bezierCurveTo(-2, -wH * 0.52, wL * 0.22, -wH * 0.98, wL * 0.55, -wH * 0.94);
    g.bezierCurveTo(wL * 0.86, -wH * 0.90, wL * 1.03, -wH * 0.62, wL * 0.99, -wH * 0.30);
    g.quadraticCurveTo(wL * 0.835, -wH * 0.17 + wSc, wL * 0.68, -wH * 0.04);
    g.quadraticCurveTo(wL * 0.53, wH * 0.01 + wSc, wL * 0.38, wH * 0.06);
    g.quadraticCurveTo(wL * 0.23, wH * 0.08 + wSc, wL * 0.08, wH * 0.10);
    g.quadraticCurveTo(wL * 0.02, wH * 0.02, 0, 3); g.closePath();
    g.setTransform(outer); g.lineJoin = 'round'; fillStroke(g, A.fur, 4); g.restore();
  }
}
// マロ眉：目の中心から決まった高さ。反対側は左右対称（mirror）
function drawBrows(g, bw, lx, rx, eyeY, dAng){
  const sp = bw.spacing || 0, flip = bw.mirror === false ? 1 : -1;
  g.fillStyle = INK;
  for (const it of bw.items || []){
    const rxB = 11 * (it.w ?? 100) / 100, ryB = 4.6 * (it.h ?? 100) / 100 * (it.thick ?? 100) / 100, by = eyeY - 16 + (bw.posY || 0) + (it.dy || 0), a = (it.angle || 0) + dAng;
    ell(g, lx - sp + (it.dx || 0), by, rxB, ryB, a * D2R); g.fill();
    ell(g, rx + sp + (it.dx || 0) * flip, by, rxB, ryB, a * flip * D2R); g.fill();
  }
}
// クチバシ（ふつう＝上下2枚）：下を先に、上を重ねる。open で下のクチバシが下がり、上が少し持ち上がる
function drawBill(g, B, cx, noseY, A, open){
  const wF = (B.w ?? 100) / 100, hF = (B.h ?? 100) / 100, pt = (B.point ?? 50) / 100, domeF = (B.dome || 0) / 100;
  g.lineJoin = 'round';
  g.save(); g.translate(B.lowPosX || 0, (B.lowPosY || 0) + 5 * open);
  ell(g, cx, noseY + 8 * hF, 15 * wF, 6.5 * hF * (1 + 0.15 * open)); fillStroke(g, A.billLow || '#f28c13', 3.2); g.restore();
  const uhw = 22 * wF, uTY = noseY - 7 * hF, uSideY = noseY + 0.5 * hF;
  g.save(); g.translate(B.upPosX || 0, (B.upPosY || 0) - 1.5 * open);
  g.beginPath(); g.moveTo(cx - uhw, uSideY);
  g.quadraticCurveTo(cx - uhw, uTY, cx - uhw * 0.55, uTY);
  g.quadraticCurveTo(cx, noseY - (9 + 5 * domeF) * hF, cx + uhw * 0.55, uTY);
  g.quadraticCurveTo(cx + uhw, uTY, cx + uhw, uSideY);
  g.quadraticCurveTo(cx, noseY + (3.5 + 3 * pt) * hF, cx - uhw, uSideY); g.closePath();
  fillStroke(g, A.bill || '#f59a23', 3.4); g.restore();
}
// あほ毛3本（ゆらゆら）
// dx・sc：ツノがあるときは ツノの右へずらして小さく（根元は その位置の頭のてっぺんに合わせる）
function drawCowlick(g, cx, top, t, head, dx, sc){
  dx = dx || 0; sc = sc || 1;
  if (dx && head){ const tx = cx + dx + 4 * sc; let best = null; for (const p of head.pts) if (p[1] < head.cy && (!best || Math.abs(p[0] - tx) < Math.abs(best[0] - tx))) best = p; top = best[1]; }
  g.strokeStyle = INK; g.lineWidth = 3 * Math.sqrt(sc); g.lineCap = 'round';
  const hairs = [[-4, 7, -10, -9, -2, -16], [3, 6, 3, -10, 10, -15], [9, 8, 15, -4, 18, -11]];
  hairs.forEach(([x0, y0, qx, qy, x1, y1], i) => {
    const sw = 2.2 * Math.sin(t * 3 + i * 1.3), X = v => cx + dx + v * sc, Y = v => top + (v - 2) * sc + 2;
    g.beginPath(); g.moveTo(X(x0), Y(y0)); g.quadraticCurveTo(X(qx + sw * 0.5), Y(qy), X(x1 + sw), Y(y1)); g.stroke();
  });
}
// サングラス（星形レンズ）：頭のてっぺんに乗せる。down で目にかける
function drawSunglasses(g, P, head, frame){
  const cx = head.cx, cy = head.top - 1, k = (P.size ?? 100) / 100;
  g.save(); g.translate(P.posX || 0, P.posY || 0); g.translate(cx, cy); g.rotate((P.angle || 0) * D2R); g.scale(k, k); g.translate(-cx, -cy);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const star = (x, y, R, r, rot) => { g.beginPath(); for (let i = 0; i < 10; i++){ const a = (rot - 90 + i * 36) * D2R, rr = i % 2 ? r : R; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.closePath(); };
  g.strokeStyle = INK; g.lineWidth = 4;
  g.beginPath(); g.moveTo(cx - 29, cy - 5); g.lineTo(cx - 40, cy + 8); g.moveTo(cx + 29, cy - 5); g.lineTo(cx + 40, cy + 8); g.stroke();
  const bridge = () => { g.beginPath(); g.moveTo(cx - 6, cy - 6); g.quadraticCurveTo(cx, cy - 10.5, cx + 6, cy - 6); };
  bridge(); g.lineWidth = 7; g.stroke(); bridge(); g.strokeStyle = frame; g.lineWidth = 4; g.stroke();
  const lx = cx - 17, rx = cx + 17, ly = cy - 1;
  star(lx, ly, 17, 10.5, -12); fillStroke(g, frame, 3.4); star(rx, ly, 17, 10.5, 12); fillStroke(g, frame, 3.4);
  g.fillStyle = '#262b33'; star(lx, ly, 11.5, 7, -12); g.fill(); star(rx, ly, 11.5, 7, 12); g.fill();
  g.globalAlpha = 0.85; g.fillStyle = '#fff'; for (const x of [lx, rx]){ g.beginPath(); g.arc(x - 3.5, ly - 4.5, 2.4, 0, 6.283); g.fill(); }
  g.globalAlpha = 0.5; g.strokeStyle = '#fff'; g.lineWidth = 2; for (const x of [lx, rx]){ g.beginPath(); g.moveTo(x + 1, ly + 5); g.lineTo(x + 5.5, ly - 1); g.stroke(); }
  g.restore();
}
function drawFigure(g, def, s, A, ext, t, seed){
  const cx = 160, headCy = 148;
  // モグモグ：ときどき数秒、口・歯・ほっぺが一緒に動く（chew>0 で口が横に伸び、ほっぺはすぼまる）
  // あくび（mouthAnim:'yawn'）：ときどき口をゆっくり開けて閉じる。yawn 0＝閉じている〜1＝いちばん開く
  const yawnMode = def.mouthAnim === 'yawn';
  const chewOn = yawnMode || def.mouthAnim === 'none' ? 0 : C(Math.sin(t * 0.8 + seed) * 3, 0, 1), chew = Math.sin(t * 13) * chewOn;
  const yawn = yawnMode ? Math.pow(Math.max(0, Math.sin(t * (def.yawnSpeed || 0.7) + seed)), def.yawnSpeed ? 4 : 3) : 0;
  // ほっぺは もとのふくらみが最大。モグモグ中・あくび中だけ すぼめる方向へ（0〜1）
  const squeeze = yawnMode ? yawn * 0.5 : (chewOn + chew) / 2;
  s.contour.cheekPouch = C((s.contour.cheekPouch || 0) - 12 * squeeze, 0, 100);
  const head = headGeom(s.contour, cx, headCy);
  const bodyCx = cx + s.body.posX, bodyCy = head.bottom - 14 + 92 * s.body.height / 100 / 2 + s.body.posY;
  const body = bodyGeom(s.body, bodyCx, bodyCy);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // しっぽ：mirror＝基準角度〜反対側まで ぶんぶん / around＝基準角度のまわりで ゆらゆら
  if (s.tail){
    const sw = def.tailSwing || { mode: 'mirror' };
    if (def.tailKind === 'pompom') drawPompomTail(g, s.tail, body, bodyCx, bodyCy, t, seed);
    else if (def.tailKind === 'duck') drawDuckTail(g, s.tail, body, bodyCx, bodyCy, A, (s.tail.angle || 0) + 9 * Math.sin(t * 4.2 + seed)); // ヒヨコ：ぴこぴこ小刻みに
    // ドラゴン：曲がりは変えず（外へ伸ばさない）、根元を支点に角度だけ大きく素早く振る（少し体の下側寄り）
    else if (def.tailKind === 'elephant') drawElephantTail(g, s.tail, body, bodyCx, bodyCy, A, (s.tail.angle || 0) + 12 * Math.sin(t * 2 + seed));
    else if (def.tailKind === 'dragon') drawDragonTail(g, s.tail, bodyCx, bodyCy, A, (s.tail.angle || 0) - 18 + (sw.amp || 20) * Math.sin(t * 2.8 + seed), s.tail.bend ?? 100, ext.spikes, ext.hornCol);
    else if (def.tailKind === 'cat') drawCatTail(g, s.tail, bodyCx, bodyCy, A, (s.tail.angle || 0) + (sw.amp || 20) * 0.4 * Math.cos(t * 1.3 + seed), Math.sin(t * 1.7 + seed));
    else drawSquirrelTail(g, s.tail, bodyCx, bodyCy, A, (s.tail.angle || 0) * Math.cos(t * 3.4 + seed), ext.spikes, ext.hornCol);
  }
  if (s.wing) drawWings(g, s.wing, body, bodyCx, bodyCy, A, t, seed, ext.wingSpikes || 0, ext.hornCol); // 翼は胴の後ろ
  // 首かしげ（フクロウ）：ときどき 顔（頭まるごと）を左右にかしげて止まる。首もと（頭の下のまんなか）が支点
  let tilt = 0;
  if (def.headTilt){ const ph = (t * 0.13 + seed * 0.23) % 1, ss = v => { v = C(v, 0, 1); return v * v * (3 - 2 * v); };
    tilt = 15 * D2R * (ss((ph - 0.05) / 0.06) - ss((ph - 0.3) / 0.06) - ss((ph - 0.55) / 0.06) + ss((ph - 0.8) / 0.06)); }
  const tpx = cx, tpy = head.bottom - 6;
  const tiltOn = () => { g.save(); if (tilt){ g.translate(tpx, tpy); g.rotate(tilt); g.translate(-tpx, -tpy); } };
  tiltOn();
  drawEars(g, s, head, A, t, seed, ext);
  // ツノは耳より前、頭の後ろから生やす（根元が頭に隠れる）
  if (ext.horns === 1) drawHorn(g, cx, head.top + 10, 28 + 10 * ext.hornK, 0.15, ext.hornCol);
  if (ext.horns === 2){ drawHorn(g, cx - 17, head.top + 12, 24 + 10 * ext.hornK, -0.5, ext.hornCol); drawHorn(g, cx + 17, head.top + 12, 24 + 10 * ext.hornK, 0.5, ext.hornCol); }
  if (ext.headSpikes) drawHeadSpikes(g, head, ext.headSpikes, ext.hornCol, def.spikeStyle === 'mohawk' ? [[-0.14, 1.15], [0, 1.5], [0.14, 1.15]] : null); // 頭のトゲ（根元は頭に隠れる）。ヒヨコは まんなかに寄せてモヒカン
  g.restore();
  // フクロウの翼：胴の下の層。ふだんは小さく ゆらゆら、ときどき数秒 バサバサ（速く大きく）
  if (s.hands && s.hands.type === 'owlWing'){
    const env = C(Math.sin(t * 0.7 + seed * 1.7) * 4 - 3, 0, 1), flap = 4 * Math.sin(t * 2 + seed) + env * 26 * (0.5 + 0.5 * Math.sin(t * 17));
    drawOwlWings(g, s.hands, body, bodyCx, bodyCy, A, flap, ext.wingSpikes || 0, ext.hornCol);
  }
  // 足（胴の下から覗く）。体が浮くとき つま先が ハの字 → 真下 へ
  const F = s.feet, sp = body.W * 0.24 + (F.posX || 0), fy = bodyCy + body.H / 2 + 1 + (F.posY || 0), fs = (F.size || 100) / 100;
  // footJump:'stretch'（ゾウ）：足は回さず丸いまま、浮くときに少し下へ出て小さくなる（足を伸ばした感じ）
  const stretch = def.footJump === 'stretch', jk = jumpOf(t, seed);
  const fa = stretch ? (F.angle || 0) : (F.angle || 0) + (72 - (F.angle || 0)) * jk;
  const fyD = stretch ? fy + 5 * jk : fy, fsD = stretch ? fs * (1 - 0.14 * jk) : fs;
  for (const sd of [-1, 1]){
    if (s.feetClaws){ // 足の爪：つま先の下側から3本（根元は足に隠れる）
      g.save(); g.translate(bodyCx + sd * sp, fy); g.rotate(sd * fa * D2R);
      for (const lx of [-6, 0, 6]){ g.beginPath(); g.moveTo((lx - 2.8) * fs, 4.5 * fs); g.lineTo((lx + 2.8) * fs, 4.5 * fs); g.lineTo((lx + sd * 1.2) * fs, 14 * fs); g.closePath(); g.lineJoin = 'round'; fillStroke(g, '#fff', 1.8); }
      g.restore();
    }
    ell(g, bodyCx + sd * sp, fyD, 12 * fsD, 6.5 * fsD, sd * fa * D2R); fillStroke(g, A.foot || A.fur, 4);
  }
  // 胴：塗り → おなか（胴で切り抜き） → 輪郭線
  const BL = s.belly || {};
  g.save(); g.translate(bodyCx, bodyCy); g.rotate(s.body.angle * D2R); g.translate(-bodyCx, -bodyCy);
  if (s.bodyWool) drawWoolBack(g, { cx: bodyCx, top: bodyCy - body.H / 2, W: body.W, H: body.H }, { size: s.bodyWool.size, thick: 100, bump: s.bodyWool.bump, posX: s.bodyWool.posX, posY: s.bodyWool.posY }, A.wool || '#fff', false, ext.sparkle ? t + 0.5 : null); // ヒツジ：体そのものがモコモコ
  else { poly(g, body.pts); g.fillStyle = A.fur; g.fill(); }
  g.save(); poly(g, body.pts); g.clip();
  const bS = (BL.size ?? 100) / 100, brx = body.W * 0.20 * bS * (BL.w ?? 100) / 100, bry = body.H * 0.26 * bS, bCx = bodyCx + (BL.posX || 0), bCy = bodyCy + body.H * 0.16 + (BL.posY || 0);
  ell(g, bCx, bCy, brx, bry); g.fillStyle = A.belly; g.fill();
  // おなかの ▲ 羽模様（フクロウ）：上・中・下の3段、各段の数は triTop / triMid / triBot
  const rows = [BL.triTop || 0, BL.triMid || 0, BL.triBot || 0];
  if (rows[0] + rows[1] + rows[2] > 0){
    g.globalAlpha = 0.3; g.fillStyle = A.dark;
    rows.forEach((n, r) => { for (let i = 0; i < n; i++){ const x = bCx + (i - (n - 1) / 2) * brx * 0.34, y = bCy + (r - 1) * bry * 0.45; g.beginPath(); g.moveTo(x - 5.5, y - 3.5); g.lineTo(x + 5.5, y - 3.5); g.lineTo(x, y + 4); g.closePath(); g.fill(); } });
    g.globalAlpha = 1;
  }
  g.restore();
  if (!s.bodyWool){ poly(g, body.pts); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); }
  g.restore();
  // 手：左右ばらばらに上下（どんぐりを持つときは小さく揺らし、どんぐりも一緒に動かす）
  // サングラス（ヒヨコ）：sgHold＝ふだん手に持つ / sgHead＝ふだん頭の上（とても慎重）。どちらも ときどき目にかける（sgUp 0＝ふだんの位置〜1＝目）
  let sgUp = 0;
  if (s.sgHold || s.sgHead){ const ph = (t * 0.12 + seed * 0.31 + (s.sgHead ? 0.5 : 0)) % 1, u = ph < 0.07 ? ph / 0.07 : ph < 0.32 ? 1 : ph < 0.39 ? 1 - (ph - 0.32) / 0.07 : 0; sgUp = u * u * (3 - 2 * u); }
  const sgPose = k => { // ふだんの位置と目の位置（レンズが目に重なる）をなめらかにつなぐ
    const eY = head.cy - head.H * 0.10 + (s.eye.posY || 0) + 13, eS = head.W * 0.235 * (s.eye.spacing || 100) / 100 / 17;
    const eye = { size: eS * 100, posX: 0, posY: eY - (head.top - 1) + eS, angle: 0 };
    if (s.sgHead){ const P = s.itemP || {}; return { size: L(P.size ?? 100, eye.size, k), posX: L(P.posX || 0, 0, k), posY: L(P.posY || 0, eye.posY, k), angle: L(P.angle || 0, 0, k) }; } // 頭の上から すとんと下りる
    const hX = bodyCx, hY = bodyCy + 16, hS = 0.9, sc = L(hS, eS, k), x = L(hX, head.cx, k), y = L(hY, eY, k) - 10 * Math.sin(k * Math.PI);
    return { size: sc * 100, posX: x - head.cx, posY: y - (head.top - 1) + sc, angle: L(-10, 0, k) };
  };
  const hold = s.item && s.item !== 'none' && s.item !== 'apple' && s.item !== 'sunglasses' && s.item !== 'lanternHang' && s.item !== 'yarn', amp = hold ? 1.2 : 2.6; // リンゴは手で持たず頭の上
  const hy = sd => Math.sin(t * (sd > 0 ? 3.1 : 2.3) + seed + (sd > 0 ? 0.8 : 2.4)) * amp;
  if (hold) drawItem(g, s.item, s.itemP || {}, bodyCx, bodyCy + 4 + (hy(-1) + hy(1)) / 2); // 持ち物は手より下（手で持って見える）
  if (s.item === 'sunglasses' && s.sgHold && sgUp === 0) drawSunglasses(g, sgPose(sgUp), head, s.sgColor || '#ff3355'); // 手に持っている間は 翼の下
  if (def.sheepLayer){} // ヒツジの手と毛糸玉は 頭の毛のあと（下）
  else if (s.hands && s.hands.type === 'gyoza') drawGyozaHands(g, s.hands, body, bodyCx, bodyCy, A, hy);
  else if (s.hands && s.hands.type === 'round') drawRoundHands(g, s.hands, body, bodyCx, bodyCy, A, hy);
  else if (s.hands && s.hands.type === 'wing') drawWingHands(g, s.hands, body, bodyCx, bodyCy, A, hy, s.sgHold ? Math.sin(sgUp * Math.PI) : 0);
  else if (!(s.hands && s.hands.type === 'owlWing')) for (const sd of [1, -1]){ ell(g, bodyCx + sd * 10.5, bodyCy + 5 + hy(sd), 6.8, 5.8, sd * (18 + hy(sd) * 2) * D2R); fillStroke(g, A.fur, 3.2); }
  // ヒツジ：頭のまわりの毛（輪）→ 毛糸玉 → 手。毛糸玉は 右手と左手のあいだで 床にバウンドさせてドリブル
  if (def.sheepLayer){
    if (s.wool && ext.woolSpikes) drawWoolSpikes(g, head, s.wool, ext.woolSpikes, ext.hornCol);
    if (s.wool) drawWoolBack(g, head, s.wool, A.wool || '#fff', true, ext.sparkle ? t : null);
    let handDy = () => 0, lift = 0;
    if (s.item === 'yarn'){
      const P = s.itemP || {}, k = (P.size ?? 100) / 100, r = 13 * k, Hh = s.hands || {}, hS = (Hh.size ?? 100) / 100;
      lift = 14; // ドリブル中は 手を少し上げる（ボールの上半分に 手がかぶる）
      const handX = (body.W / 2 + 10 + (Hh.spacing || 0) / hS) * hS - 2, gb = (Hh.bulge ?? 100) / 100;
      const handBot = bodyCy + (body.H * 0.30 - 24 + 24.5 * (0.8 + 0.2 * gb)) * hS + (Hh.posY || 0) - lift;
      const yTop = handBot + 7 + r * 0.3, yFloor = fy + 6.5 * fs - r + 5; // 手のひら（押し下げた位置）〜 床（足もとの影にかかる）
      const { p, fl } = dribblePhase(t, seed);
      const bx = bodyCx + L(-handX, handX, p), by = yTop + (yFloor - yTop) * fl * fl;
      handDy = sd => { const d = sd < 0 ? p : 1 - p; return 7 * Math.exp(-Math.pow(d / 0.12, 2)) - 7 * Math.exp(-Math.pow((d - 0.32) / 0.16, 2)); }; // ボールが来る前に手を上げ、触れたらグッと押し下げる
      drawYarn(g, bx, by, k, (bx - bodyCx) / 14 + (P.angle || 0) * D2R);
    }
    if (s.hands && s.hands.type === 'gyoza') drawGyozaHands(g, Object.assign({}, s.hands, { posY: (s.hands.posY || 0) - lift }), body, bodyCx, bodyCy, A, sd => lift ? handDy(sd) : hy(sd));
  }
  // 頭：塗り → 模様（頭で切り抜き） → 輪郭線（首かしげは ここから ほっぺまで）
  tiltOn();
  poly(g, head.pts); g.fillStyle = A.fur; g.fill();
  if (s.markColor === 'belly') s.markings.color = 'belly';
  drawMarkings(g, s.markings, head, A);
  poly(g, head.pts); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  if (def.faceKind === 'duck' && !ext.headSpikes) drawCowlick(g, cx, head.top, t + seed, head, ext.horns === 1 ? 18 : ext.horns === 2 ? 27 : 0, ext.horns ? 0.62 : 1); // あほ毛（モヒカンのときは出さない）。ツノがあるときは ツノの右へ小さく
  // 顔（ヒヨコは目が高め、クチバシは目から決まった距離）
  const duckFace = def.faceKind === 'duck';
  const eyeY = duckFace ? head.cy - head.H * 0.10 + (s.eye.posY || 0) : head.bottom - head.H * 0.46 + (s.eye.posY || 0), noseY = duckFace ? eyeY + 30 : head.bottom - head.H * 0.27, mouthY = duckFace ? noseY + 8 : head.bottom - head.H * 0.13;
  const nDX = head.W * 0.235 * (s.eye.spacing || 100) / 100;
  const blink = Math.sin(t * 1.1 + seed * 7) > 0.992;
  const emod = { noLash: def.noLashOnCut && (ext.cut || 0) > 0, cut: ext.cut || 0, lid: ext.lid || 0, lidColor: A.furSolid, closed: blink || (ext.lid || 0) > 0.85 };
  drawEye(g, s.eye, cx - nDX, eyeY, false, emod); drawEye(g, s.eye, cx + nDX, eyeY, true, emod);
  if (s.brows) drawBrows(g, s.brows, cx - nDX, cx + nDX, eyeY, ext.browTilt || 0);
  if (s.whiskers.length) drawWhiskers(g, s.whiskers, head, noseY, s.whiskerStyle, t + seed);
  const f = s.face, ns = (f.noseSize || 100) / 100;
  if (s.trunk){ // ゾウ：鼻（トランク）が鼻と口の代わり。牙は鼻の後ろから
    if (s.fangs && s.fangs.show) drawTusks(g, s.fangs, f, cx, mouthY);
    // 水しぶき（spray）：ときどき鼻を振り上げて しぶきを飛ばす（攻撃っぽい動き）。それ以外は先がゆっくり揺れる
    const tipOnly = s.spray === 'tip', hookAmt = s.sprayHook || 1; // 'tip'：鼻先だけ曲げて しぶき（鼻全体は振り上げない）
    const sp = s.spray ? (t * 0.3 + seed * 0.37) % 1 : 1, up = sp < 0.07 ? sp / 0.07 : sp < 0.2 ? 1 : sp < 0.27 ? 1 - (sp - 0.2) / 0.07 : 0, upK = up * up * (3 - 2 * up);
    const tr = drawTrunk(g, s.trunk, cx, noseY, A, (s.trunk.curl || 0) + 35 * Math.sin(t * 1.4 + seed) * (1 - upK) + (tipOnly ? 0 : 95 * upK), tipOnly ? 0 : -72 * upK, s.trunkTip ? (A.tip || A.dark) : null, tipOnly ? upK * hookAmt : 0);
    if (upK > 0.6) drawSpray(g, tr, t, (upK - 0.6) / 0.4);
  } else if (duckFace && s.bill){ // ヒヨコ：クチバシが鼻と口の代わり。ときどきパクッと開ける
    const qk = def.mouthAnim === 'quack' ? Math.pow(Math.max(0, Math.sin(t * 1.3 + seed)), 10) * (0.6 + 0.4 * Math.sin(t * 22)) : 0;
    g.save(); g.translate(f.nosePosX || 0, f.nosePosY || 0); g.translate(cx, noseY); g.scale(ns, ns); g.translate(-cx, -noseY); drawBill(g, s.bill, cx, noseY, A, Math.max(0, qk)); g.restore();
  } else {
  g.save(); g.translate(f.nosePosX || 0, f.nosePosY || 0); g.translate(cx, noseY); g.scale(ns, ns); g.translate(-cx, -noseY); drawNose(g, s.nose, cx, noseY, A.beak || def.noseColor, ns, s.beak); g.restore();
  // 口は横に伸びると縦に縮む。歯・牙は大きさを変えず、上に引っ込む
  if (yawnMode){ f.chewX = 1 + 0.08 * yawn; f.chewY = 1 + 0.14 * yawn; f.toothChewDy = 0; if (s.openMouth) s.openMouth.open = yawn; }
  else { f.chewX = 1 + 0.14 * chew; f.chewY = 1 - 0.2 * chew; f.toothChewDy = -4 * Math.max(0, chew) + 1 * Math.max(0, -chew); }
  if (!def.noMouth) drawMouthParts(g, s, cx, mouthY); // フクロウはクチバシだけ（口の線なし）
  if (def.fireBreath && yawnMode && Math.sin(t * (def.yawnSpeed || 0.7) * 0.5 + seed * 0.5 + 0.8) > 0){ // ドラゴン：2回に1回 口を開けたときに 火を噴く
    const fk = C((yawn - 0.3) / 0.6, 0, 1);
    if (fk > 0){
      const mx = cx + (f.mouthPosX || 0), my = mouthY + (f.mouthPosY || 0) + 6;
      const fireLen = Math.max(20, bodyCy + body.H * 0.12 - my); // 火は真下へ、お腹のあたりまで
      const blobs = []; for (let i = 0; i <= 11; i++){ const q = i / 11, w = 0.85 + 0.15 * Math.sin(t * 31 + i * 2.3); blobs.push({ x: mx + Math.sin(t * 22 + i * 1.7) * 3 * q, y: my + 2 + q * fireLen * (0.4 + 0.6 * fk), r: (3.5 + 11 * q) * fk * w, a: 1 - Math.pow(q, 3) * 0.55 }); }
      for (const [col, kr] of [['#ff4a1c', 1.3], ['#ff9a1f', 0.95], ['#fff1a0', 0.5]]){ g.fillStyle = col; for (const b of blobs){ g.globalAlpha = b.a; ell(g, b.x, b.y, b.r * kr, b.r * kr * 0.85); g.fill(); } }
      g.globalAlpha = 1;
    }
  }
  }
  const chX = head.W * 0.335 + (f.cheekPosX || 0), chY = noseY + 7 + (f.cheekPosY || 0);
  g.fillStyle = 'rgba(242,139,160,.55)'; { const crx = 11 * (1 - 0.08 * squeeze), cry = 6.5, cdx = chX - 1 * squeeze; ell(g, cx - cdx, chY, crx, cry); g.fill(); ell(g, cx + cdx, chY, crx, cry); g.fill(); }
  if (s.wool && s.wool.frontShow !== false) drawWoolFront(g, head, s.wool, A.wool || '#fff'); // ヒツジの前髪（顔のパーツの上）
  if (s.earType === 'spiral') drawSpiralHorns(g, s, head, A.horn || '#d9b48f'); // うずまきツノは 前髪より上
  g.restore();
  // ランタン（フクロウ）：クチバシの先からヒモで下げる。ヒモの先を支点に ゆらゆら（首かしげ・バサバサで少し大きく）
  if (s.item === 'lanternHang'){
    const b = s.beak || {}, by = noseY + (b.posY || 0), topY = by - 7.5, botY = by + 11 * (b.len ?? 100) / 100, ctr = (topY + botY) / 2, tipY0 = botY <= ctr ? botY : ctr + (botY - ctr) * (b.low ?? 100) / 100;
    let sx = cx + (f.nosePosX || 0), sy = (f.nosePosY || 0) + noseY + (tipY0 - noseY) * ns;
    if (tilt){ const dx = sx - tpx, dy = sy - tpy, co = Math.cos(tilt), si = Math.sin(tilt); sx = tpx + dx * co - dy * si; sy = tpy + dx * si + dy * co; }
    const IP = s.itemP || {}, k = (IP.size ?? 100) / 100, rx0 = bodyCx + (IP.posX || 0), ry0 = bodyCy + 5 - 23.2 * k + (IP.posY || 0);
    const len = Math.hypot(rx0 - sx, ry0 - sy), swing = (7 + 5 * Math.abs(Math.sin(t * 0.7 + seed * 1.7))) * D2R * Math.sin(t * 2.3 + seed) - tilt * 0.5;
    const rx = sx + Math.sin(swing) * len, ry = sy + Math.cos(swing) * len;
    const mx = (sx + rx) / 2 + Math.cos(swing) * Math.min(3, len * 0.05), my = (sy + ry) / 2 - Math.sin(swing) * Math.min(3, len * 0.05);
    g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(mx, my, rx, ry); g.stroke();
    drawLantern(g, rx, ry, k, -swing, s.lanternGlow ? 0.75 + 0.25 * Math.sin(t * 3 + seed) : 0);
  }
  if (s.collar && s.collar.show) drawCollar(g, s.collar, head, body, bodyCx, bodyCy, s.body.angle);
  if (s.item === 'apple'){ // リンゴは いちばん上に描く（頭のてっぺんに乗る）。appleCount で 2個＝横並び、3個＝2個の上に1個
    const P = s.itemP || {}, k = (P.size ?? 100) / 100, n = s.appleCount || 1;
    const spots = n === 1 ? [[0, 0, 0]] : n === 2 ? [[-12, 1, -10], [12, 1, 10]] : [[-12, 1, -10], [12, 1, 10], [0, -19, 4]];
    const roll = 4.5 * Math.sin(t * 1.7 + seed); // 頭の上で 左右に少し転がる（転がった分だけ回る）。上に乗った3個目は 下と逆へ
    spots.forEach(([dx, dy, da], i) => { const o = i === 2 ? -0.7 * roll : roll; drawItem(g, 'apple', Object.assign({}, P, { posX: (P.posX || 0) + (dx + o) * k, posY: (P.posY || 0) + dy * k, angle: (P.angle || 0) + da - (n > 1 ? 16 : 0) + o / 12 * 57.3 }), head.cx, head.top - 8); });
  }
  if (s.item === 'sunglasses'){ // 目に近づいたら いちばん上（顔の上）に描く。モックそのまま（raw）は頭の上
    if (!s.sgHold && !s.sgHead) drawSunglasses(g, s.itemP || {}, head, s.sgColor || '#ff3355');
    else if (s.sgHead || sgUp > 0) drawSunglasses(g, sgPose(sgUp), head, s.sgColor || '#ff3355');
  }
  return { ground: fy + 6.5 * fs, head };
}

// =====================================================================
// 3) 診断の4軸 → ベースへの差分（ゲームの drawCreature と同じ引数）
//    ax = [きっちり0↔のびのび1, 慎重0↔大胆1, 実用0↔ロマン1, 即決0↔熟考1]
// =====================================================================
const q4 = v => v < 0.2 ? 0 : v < 0.5 ? 1 : v < 0.8 ? 2 : 3;
function hexToHsl(hex){
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d){ s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s * 100, l * 100];
}
const hsl = (h, s, l) => `hsl(${h.toFixed(0)},${C(s, 0, 100).toFixed(0)}%,${C(l, 4, 97).toFixed(0)}%)`;
function hueLerp(a, b, k){ const d = ((b - a + 540) % 360) - 180; return (a + d * k + 360) % 360; }
// 色：手で決めた4色の「明るさの関係」を保ったまま段階ごとに変える
function recolor(base, tier, shiny, shinyDl){
  const out = {};
  for (const k in base){
    const [h, s, l] = hexToHsl(base[k]);
    if (shiny) out[k] = hsl(46, Math.max(s, 78), l + (shinyDl ?? 4));
    else if (tier === 0) out[k] = hsl(h, 0, 30 + l * 0.5);                       // モノクロ：はっきり灰色（白も灰色に寄せる）
    else if (tier === 1) out[k] = hsl(h, s * 1.15 + 4, l);                       // ビビッド：手で決めた色を少し鮮やかに
    else if (tier === 2) out[k] = hsl(hueLerp(h, 340, 0.85), 70, 55 + l * 0.4);   // パステル：全体をピンク寄りに
    else out[k] = hsl(hueLerp(h, 285, 0.55), s * 0.7, l + (90 - l) * 0.25);       // ニジイロの土台
  }
  out.furSolid = out.fur;
  return out;
}

function applyPersonality(def, ax, shiny){
  const s = clone(def.params);
  const [a0, a1, a2, a3] = ax;
  const neg = v => C((0.5 - v) * 2, 0, 1), pos = v => C((v - 0.5) * 2, 0, 1);
  // きっちり ↔ のびのび：角ばり / ふくらみ
  s.contour.roundness = s.contour.roundness - 45 * neg(a0);
  s.body.roundness = s.body.roundness - 45 * neg(a0);
  s.contour.width += 6 * pos(a0);
  s.contour.cheekPouch = C(s.contour.cheekPouch + 30 * pos(a0), 0, 100);
  s.body.width += 7 * pos(a0); s.body.bottomWidth += 10 * pos(a0);
  s.feet.angle = s.feet.angle - 20 * neg(a0) + 8 * pos(a0);
  // 慎重 ↔ 大胆：耳の向き・しっぽの大きさ・耳の丸み
  s.ear.angle += 22 * neg(a1) - 16 * pos(a1);
  s.ear.len += 14 * pos(a1) - 6 * neg(a1);
  if (s.tail){ s.tail.size += 12 * pos(a1) - 8 * neg(a1); }
  const hornTier = q4(a1);
  if (hornTier === 0){ s.ear.round = 85; s.ear.len -= 6; }       // マルミミ
  // ドラゴン（hornStyle:'grow'）：角そのものが ツノアリで伸びる・マルミミで ずんぐり短く。翼は大胆ほど大きく、慎重ほど小さく垂れる
  if (def.hornStyle === 'grow'){
    if (hornTier === 0) s.ear.len *= 0.75;
    if (hornTier === 2){ const k = C((a1 - 0.5) / 0.3, 0, 1); s.ear.len *= 1.15 + 0.15 * k; s.ear.thick *= 1.08; s.ear.round = Math.min(s.ear.round, 45); }
  }
  if (s.wing){ s.wing.size *= 1 + 0.15 * pos(a1) - 0.12 * neg(a1); s.wing.angle += 14 * neg(a1); }
  // 持ち物（リスはどんぐり、ネコは鈴の首輪…）は いつも付ける。種族の決め手になった荷物と結果をつなげるため
  //（以前は「とても慎重」のときだけ付けていた。careful は ランタンの光り方・サングラスの位置に使う）
  const careful = a1 < 0.25;
  if (def.cautiousItem !== 'collar') s.item = def.cautiousItem || 'none';
  // appleStack（ゾウ）：リンゴはいつも1個。慎重ほど増える（慎重で2個、とても慎重で3個）
  if (def.appleStack){ s.item = 'apple'; s.appleCount = a1 < 0.25 ? 3 : a1 < 0.5 ? 2 : 1; }
  if (s.collar) s.collar.show = def.cautiousItem === 'collar';
  // sgMode:'hand'（ヒヨコ）：サングラスはふだん手に持ち ときどき目にかける。とても慎重は ずっとかけたまま
  if (def.alwaysItem){ s.item = def.alwaysItem; s.lanternGlow = careful; } // フクロウ：ランタンはいつも。とても慎重で明るく光る
  if (def.sgMode === 'hand'){ s.item = 'sunglasses'; s.sgHead = careful; s.sgHold = !careful; }
  // トゲトゲ：リスはしっぽにトゲ、ネコは牙と爪（それ以外では出さない）
  const spiky = hornTier === 3, spikeK = spiky ? C((a1 - 0.8) / 0.2, 0, 1) + 0.01 : 0;
  // 牙・爪を診断で出し入れするのは ネコだけ（ドラゴンは もとから付いている）
  if (def.spikeStyle === 'fangsClaws'){ if (s.fangs) s.fangs.show = spiky; if (s.hands) s.hands.claws = spiky; }
  // ゾウ（hornStyle:'tusks'）：ツノの代わりに牙。ツノアリ・トゲトゲだけ出し、大胆ほど長く
  if (def.hornStyle === 'tusks' && s.fangs){ s.fangs.show = hornTier >= 2; s.fangs.len *= 0.85 + 0.35 * C((a1 - 0.5) / 0.5, 0, 1); }
  if (def.spikeStyle === 'fangsClaws' && spiky){ // トゲトゲ感が出るよう 牙・爪は大きめ、足にも爪
    if (s.fangs){ s.fangs.len *= 1.5; s.fangs.width *= 1.15; }
    if (s.hands) s.hands.clawSize = (s.hands.clawSize ?? 100) * 1.7;
    s.feetClaws = true;
  }
  // 即決 ↔ 熟考：目つき
  const sharp = C((0.4 - a3) / 0.4, 0, 1), sleepy = C((a3 - 0.6) / 0.35, 0, 1);
  const tier = q4(a2), A = recolor(def.colors, tier, shiny, def.shinyDl);
  if (def.fixedColors && (shiny || tier !== 0)) for (const kc of def.fixedColors) A[kc] = def.colors[kc];
  const [bh] = hexToHsl(def.colors.fur);
  const ext = {
    cut: sharp, lid: sleepy * 0.75 + (sleepy > 0.85 ? 0.3 : 0),
    horns: hornTier === 2 && !def.hornStyle ? (a1 >= 0.65 ? 2 : 1) : 0, hornK: C((a1 - 0.5) / 0.3, 0, 1),
    spikes: def.spikeStyle === 'tail' ? spikeK : 0, wingSpikes: def.spikeStyle === 'wings' || def.spikeStyle === 'owlWings' ? spikeK : 0, woolSpikes: def.spikeStyle === 'wool' ? spikeK : 0, earSpikes: def.spikeStyle === 'ears' ? spikeK : 0, headSpikes: def.spikeStyle === 'head' || def.spikeStyle === 'mohawk' ? spikeK : 0,
    hornCol: shiny ? '#fff2b0' : A.horn ? A.horn : spiky ? hsl((bh + 160) % 360, 45, 74) : 'hsl(45,55%,90%)',
    sparkle: shiny, dots: a3 > 0.8, browTilt: 12 * sharp - 16 * sleepy, // 眉：即決で つり上がり、熟考で下がる
    squish: pos(a0), rainbow: tier === 3 && !shiny,
  };
  return { s, A, ext };
}

// 大きさそろえ：頭のてっぺん〜足もとの高さをリスにそろえる。耳が長い動物は 耳の先までが リスの1.12倍に収まるよう さらに縮める
function figureHeight(s){
  const head = headGeom(s.contour, 160, 148), e = s.ear, vert = s.earType === 'vOnigiri' || s.earType === 'vKamaboko', wide = s.earType === 'wide', horn = s.earType === 'horn';
  const baseY = head.top + head.H * (vert ? 0.20 : 0.16) + e.posY, Ln = 54 * e.len / 100;
  const h = s.earType === 'angel' || s.earType === 'none' || s.earType === 'spiral' ? 0 : wide ? Ln * 0.85 * 1.32 : Ln * (vert ? 1.48 : horn ? 1.03 : 1); // 天使の羽の耳は横へ広がるので高さに入れない
  const ang = (wide ? 90 - Math.abs(6 + e.angle) : vert ? 7 + e.angle * 0.45 : horn ? 14 + e.angle : 32 + e.angle) * D2R;
  const bodyCy = head.bottom - 14 + 92 * s.body.height / 200 + s.body.posY, body = bodyGeom(s.body, 160, bodyCy);
  const ground = bodyCy + body.H / 2 + 1 + (s.feet.posY || 0) + 6.5 * (s.feet.size || 100) / 100;
  let top = Math.min(head.top, baseY - h * Math.cos(ang));
  if (s.wool){ const sF = (s.wool.size ?? 100) / 100; top = Math.min(top, head.top + head.H * 0.46 + (s.wool.posY || 0) - head.H * 0.60 * sF); } // 頭のモコモコも高さに入れる
  return { body: ground - head.top, total: ground - top };
}
let LWK = 1; // 線の太さの倍率（drawIkimon の間だけ 1 以外）
function fitScale(def){
  if (!def._fit){ const r = figureHeight(RISU.params), d = figureHeight(def.params); def._fit = Math.min(1, r.body / d.body, 1.12 * r.total / d.total); }
  return def._fit;
}
// ゲームの drawCreature と同じ形：(g, 種族, 中心x, 中心y, R, 4軸, 色違い, 時間)。opt.raw でベースそのまま
function drawIkimon(g, def, cx, cy, R, ax, shiny, t, opt){
  const raw = opt && opt.raw, seed = (opt && opt.seed) || 0;
  t *= def.timeScale || 1; // 動物ごとの動きの速さ（ゾウはゆっくり）
  const v = raw ? { s: clone(def.params), A: Object.assign({ furSolid: def.colors.fur }, def.colors), ext: { cut: 0, lid: 0, horns: 0, spikes: 0, sparkle: false, dots: false, squish: 0 } } : applyPersonality(def, ax, shiny);
  const fit = fitScale(def), k = R / 58 * fit;
  // 線の太さそろえ：縮めた動物（ネコ・ウサギ）は 線を 1/縮小率 倍にして、画面上の輪郭の太さをリスと同じにする
  LWK = 1 / fit;
  const lwDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'lineWidth');
  if (LWK !== 1) Object.defineProperty(g, 'lineWidth', { configurable: true, get(){ return lwDesc.get.call(g) / LWK; }, set(v){ lwDesc.set.call(g, v * LWK); } });
  let res;
  try {
  g.save();
  g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(cx, cy + R * 1.02, R * 0.85, R * 0.13, 0, 0, 6.283); g.fill();
  const dp = v.s.item === 'yarn' && def.sheepLayer ? dribblePhase(t, seed) : null; // ヒツジ：ボールが床に行くとき 体も沈む（ドリブルと一体で上下）
  const bob = dp ? (dp.fl * dp.fl - 0.5) * R * 0.09 : Math.sin(t * 2.2 + seed) * R * 0.045, sq = 1 + v.ext.squish * 0.045 * Math.sin(t * 3.2 + seed);
  g.translate(cx, cy + R * 1.0 + bob); g.scale(k / Math.sqrt(sq), k * sq);
  // 先に地面の位置だけ測って、足もとを影に合わせる
  const head = headGeom(v.s.contour, 160, 148), bodyCy = head.bottom - 14 + 92 * v.s.body.height / 200 + v.s.body.posY, body = bodyGeom(v.s.body, 160, bodyCy);
  const ground = bodyCy + body.H / 2 + 1 + (v.s.feet.posY || 0) + 6.5 * (v.s.feet.size || 100) / 100;
  g.translate(-160, -ground);
  if (v.ext.rainbow){
    const gr = g.createLinearGradient(80, 60, 250, 230);
    for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, `hsl(${i * 55},75%,74%)`);
    v.A.fur = gr; v.A.furSolid = 'hsl(300,55%,82%)'; v.A.dark = 'hsl(275,45%,64%)'; v.A.belly = 'rgba(255,255,255,.8)';
  }
  res = drawFigure(g, def, v.s, v.A, v.ext, t, seed);
  g.restore();
  } finally { delete g.lineWidth; LWK = 1; }
  // 熟考の「…」とキラキラ（画面座標）
  if (v.ext.dots){
    g.fillStyle = 'rgba(80,60,90,.6)'; const kk = (t * 1.5) % 3;
    for (let i = 0; i < 3; i++) if (i < kk){ g.beginPath(); g.arc(cx + R * (0.95 + i * 0.17), cy - R * (1.1 + i * 0.13), R * 0.05, 0, 6.283); g.fill(); }
  }
  if (v.ext.sparkle){
    const n = shiny ? 8 : 4;
    for (let i = 0; i < n; i++){
      const a = t * 0.6 + i / n * 6.283, rr = R * (1.5 + 0.1 * Math.sin(t * 3 + i)), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8, kk = 0.5 + 0.5 * Math.sin(t * 5 + i * 2);
      g.fillStyle = shiny ? `rgba(255,215,80,${kk})` : `rgba(255,255,255,${kk * 0.9})`;
      g.beginPath(); for (let j = 0; j < 8; j++){ const aa = j / 8 * 6.283, r2 = (j % 2 ? 0.38 : 1) * R * (0.05 + 0.08 * kk); g.lineTo(x + Math.cos(aa) * r2, y + Math.sin(aa) * r2); } g.closePath(); g.fill();
    }
  }
  return res;
}
  return { defs: { squirrel: RISU, cat: NEKO, rabbit: USAGI, dragon: DORA, elephant: ZOU, duck: HIYO, owl: FUKU, sheep: HITSUJI }, draw: drawIkimon };
})();

function drawCreature(g, sp, cx, cy, R, ax, shiny, t){
  if (IKIMON.defs[sp]) return IKIMON.draw(g, IKIMON.defs[sp], cx, cy, R, ax, shiny, t);
  const [a1, a2, a3, a4] = ax;
  const P = palette(sp, a3, shiny);
  if (P.tier === 3){ P.main = rainbow(g, R); P.belly = 'rgba(255,255,255,.75)'; P.dark = 'hsl(275,45%,62%)'; P.deep = 'hsl(275,40%,35%)'; }
  const n = L(4.6, 2.0, a1);                     // 体の角ばり
  const sx = L(0.94, 1.12, a1), sy = L(1.0, 0.9, a1) * (1 + a1 * 0.045 * Math.sin(t * 3.2));
  const droop = C((0.5 - a2) * 2, 0, 1);          // 慎重ほど耳が垂れる
  const bold = C((a2 - 0.5) * 2, 0, 1);           // 大胆ほどトゲ
  g.save(); g.translate(cx, cy + Math.sin(t * 2.2) * R * 0.03);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const out = Math.max(1.2, R * 0.045);
  const stroke = () => { g.strokeStyle = P.deep; g.lineWidth = out; g.stroke(); };
  const drawNote = (nx, ny, rot, sc) => {
    g.save(); g.translate(nx, ny); g.rotate(rot); g.scale(sc, sc);
    g.fillStyle = P.tier === 0 ? 'hsl(0,0%,35%)' : 'hsl(215,45%,45%)'; g.beginPath(); g.rect(-R * 0.18, -R * 0.24, R * 0.36, R * 0.46); g.fill(); g.strokeStyle = P.deep; g.lineWidth = out / sc; g.stroke();
    g.fillStyle = '#fbf6e8'; g.fillRect(-R * 0.13, -R * 0.2, R * 0.28, R * 0.38);
    g.strokeStyle = 'rgba(80,80,120,.35)'; g.lineWidth = R * 0.02; for (let k = 0; k < 4; k++){ g.beginPath(); g.moveTo(-R * 0.1, -R * 0.12 + k * R * 0.08); g.lineTo(R * 0.12, -R * 0.12 + k * R * 0.08); g.stroke(); }
    g.restore();
  };
  const drawLoupe = (hx, hy, lx, ly) => {
    const lr = R * 0.33;
    g.strokeStyle = 'hsl(25,45%,32%)'; g.lineWidth = R * 0.09; g.beginPath(); g.moveTo(hx, hy); g.lineTo(lx + lr * 0.5, ly + lr * 0.8); g.stroke();
    g.fillStyle = 'rgba(200,235,255,.55)'; g.beginPath(); g.arc(lx, ly, lr, 0, 6.283); g.fill();
    g.strokeStyle = 'hsl(42,70%,45%)'; g.lineWidth = R * 0.07; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = R * 0.04; g.beginPath(); g.arc(lx, ly, lr * 0.62, 3.6, 4.4); g.stroke();
  };
  // 鳥は羽で持つ: 持ち物を先に描いて、羽を上から重ねる
  const birdLoupe = () => { if (a2 < 0.25) drawLoupe(-R * 0.84 * sx, R * 0.78, -R * 1.2 * sx, -R * 0.3); };
  const birdNote = () => { if (a3 < 0.35) drawNote(R * 0.88 * sx, R * 0.3, -0.35, 1.25); };
  const ell = (x, y, rx, ry, rot) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, 6.283); };
  const bodyPath = (scaleK) => {
    g.beginPath();
    for (let i = 0; i <= 72; i++){
      const th = i / 72 * 6.283, c = Math.cos(th), s = Math.sin(th);
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * R * sx * scaleK;
      const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * R * sy * scaleK;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  };
  // 影
  g.fillStyle = 'rgba(0,0,0,.15)'; ell(0, R * 1.02, R * 0.85, R * 0.13); g.fill();

  // ---- 体の後ろのパーツ ----
  if (sp === 'cat'){
    g.strokeStyle = P.deep; g.lineWidth = R * 0.2 + out * 2;
    const tw = Math.sin(t * 2) * 0.15;
    g.beginPath(); g.moveTo(R * 0.6, R * 0.6); g.quadraticCurveTo(R * 1.35, R * (0.5 + tw), R * 1.15, -R * (0.2 + tw)); g.stroke();
    g.strokeStyle = P.main; g.lineWidth = R * 0.2; g.stroke();
  }
  if (sp === 'dragon'){
    // しっぽ
    g.fillStyle = P.main; g.beginPath(); g.moveTo(R * 0.6, R * 0.35); g.quadraticCurveTo(R * 1.35, R * 0.75, R * 1.45, R * 0.05); g.lineTo(R * 0.75, R * 0.75); g.closePath(); g.fill(); stroke();
    g.fillStyle = P.light; g.beginPath(); g.moveTo(R * 1.45, R * 0.05); g.lineTo(R * 1.62, -R * 0.12); g.lineTo(R * 1.38, -R * 0.04); g.lineTo(R * 1.5, -R * 0.25); g.lineTo(R * 1.32, R * 0.12); g.closePath(); g.fill(); stroke();
    // つばさ
    for (const s of [-1, 1]){
      const fl = Math.sin(t * 4) * 0.1;
      g.save(); g.scale(s, 1); g.rotate(fl);
      g.fillStyle = P.dark; g.beginPath(); g.moveTo(R * 0.6, -R * 0.35); g.lineTo(R * 1.3, -R * 0.85); g.quadraticCurveTo(R * 1.25, -R * 0.45, R * 1.38, -R * 0.2); g.quadraticCurveTo(R * 1.1, -R * 0.2, R * 1.1, 0); g.quadraticCurveTo(R * 0.9, -R * 0.1, R * 0.75, R * 0.1); g.closePath(); g.fill(); stroke();
      g.restore();
    }
  }
  if (sp === 'rabbit'){ g.fillStyle = '#fff'; ell(R * 0.95, R * 0.5, R * 0.2, R * 0.2); g.fill(); stroke(); }
  if (sp === 'beaver'){
    // 平たいしっぽ
    g.save(); g.translate(R * 1.05, R * 0.55); g.rotate(-0.5 + Math.sin(t * 2) * 0.08);
    g.fillStyle = P.tier === 0 ? 'hsl(0,0%,30%)' : 'hsl(25,35%,28%)'; ell(0, 0, R * 0.42, R * 0.22); g.fill(); stroke();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = out * 0.7;
    for (let k = -2; k <= 2; k++){ g.beginPath(); g.moveTo(k * R * 0.12 - R * 0.06, -R * 0.18); g.lineTo(k * R * 0.12 + R * 0.06, R * 0.18); g.stroke(); g.beginPath(); g.moveTo(k * R * 0.12 + R * 0.06, -R * 0.18); g.lineTo(k * R * 0.12 - R * 0.06, R * 0.18); g.stroke(); }
    g.restore();
  }
  if (sp === 'elephant'){
    // 大きな耳(慎重ほど垂れて体に寄る)
    const fl = Math.sin(t * 2.5) * 0.06;
    for (const s of [-1, 1]){
      g.save(); g.translate(s * R * 0.7 * sx, -R * 0.35); g.rotate(s * (0.15 + droop * 0.45 + fl));
      g.fillStyle = P.main; ell(s * R * 0.32, 0, R * 0.48, R * 0.58); g.fill(); stroke();
      g.fillStyle = 'hsl(345,55%,82%)'; ell(s * R * 0.34, R * 0.02, R * 0.3, R * 0.4); g.fill();
      g.restore();
    }
  }
  if (sp === 'owl'){
    // 羽角(耳みたいな羽)
    for (const s of [-1, 1]){
      g.save(); g.translate(s * R * 0.55, -R * 0.75 * sy); g.rotate(s * (0.25 + droop * 0.7));
      g.fillStyle = P.dark; g.beginPath(); g.moveTo(-R * 0.2, R * 0.1); g.quadraticCurveTo(-R * 0.05, -R * 0.25, s > 0 ? R * 0.12 : R * 0.05, -R * 0.48); g.quadraticCurveTo(R * 0.1, -R * 0.1, R * 0.22, R * 0.1); g.closePath(); g.fill(); stroke();
      g.restore();
    }
  }
  if (sp === 'beaver'){
    for (const s of [-1, 1]){ g.fillStyle = P.dark; ell(s * R * 0.6 * sx, -R * 0.86 * sy, R * 0.18, R * 0.18); g.fill(); stroke(); g.fillStyle = P.belly; ell(s * R * 0.6 * sx, -R * 0.86 * sy, R * 0.08, R * 0.08); g.fill(); }
  }
  // 耳・ツノ(体の後ろ)
  if (sp === 'cat'){
    for (const s of [-1, 1]){
      g.save(); g.translate(s * R * 0.55, -R * 0.62); g.rotate(s * (0.15 + droop * 0.9));
      g.fillStyle = P.main; g.beginPath(); g.moveTo(-R * 0.25, R * 0.1); g.lineTo(0, -R * 0.55); g.lineTo(R * 0.25, R * 0.1); g.closePath(); g.fill(); stroke();
      g.fillStyle = 'hsl(345,70%,82%)'; g.beginPath(); g.moveTo(-R * 0.13, R * 0.02); g.lineTo(0, -R * 0.34); g.lineTo(R * 0.13, R * 0.02); g.closePath(); g.fill();
      g.restore();
    }
  }
  if (sp === 'rabbit'){
    for (const s of [-1, 1]){
      g.save(); g.translate(s * R * 0.32, -R * 0.75); g.rotate(s * (0.12 + droop * 1.25 + Math.sin(t * 2 + s) * 0.04));
      g.fillStyle = P.main; ell(0, -R * 0.5, R * 0.2, R * 0.58); g.fill(); stroke();
      g.fillStyle = 'hsl(345,70%,84%)'; ell(0, -R * 0.48, R * 0.1, R * 0.42); g.fill();
      g.restore();
    }
  }
  if (sp === 'dragon'){
    const hl = R * (0.28 + 0.4 * bold) * (a2 >= 0.8 ? 0.8 : 1);
    for (const s of [-1, 1]){
      g.fillStyle = 'hsl(45,60%,88%)'; g.beginPath(); g.moveTo(s * R * 0.25, -R * 0.75); g.quadraticCurveTo(s * R * 0.42, -R * 0.8 - hl, s * R * 0.55, -R * 0.8 - hl * 1.05); g.lineTo(s * R * 0.52, -R * 0.68); g.closePath(); g.fill(); stroke();
    }
  }
  // ---- 足 ----
  const footC = sp === 'duck' ? 'hsl(28,95%,58%)' : sp === 'sheep' ? '#4a3b36' : P.dark;
  g.fillStyle = footC;
  for (const s of [-1, 1]){ ell(s * R * 0.42, R * 0.92, R * 0.24, R * 0.13); g.fill(); stroke(); }

  // ---- 体 ----
  if (sp === 'sheep'){
    // もこもこの毛
    const woolC = shiny ? P.light : P.tier === 3 ? P.main : `hsl(${P.h},${C(P.s - 10, 0, 100)}%,${C(P.l + 2, 0, 97)}%)`;
    const bumps = 13;
    g.fillStyle = woolC;
    for (let pass = 0; pass < 2; pass++){
      for (let i = 0; i < bumps; i++){
        const th = i / bumps * 6.283 + 0.2, c = Math.cos(th), s = Math.sin(th);
        const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * R * sx * 0.82, y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * R * sy * 0.82;
        g.beginPath(); g.arc(x, y, R * 0.3, 0, 6.283);
        if (pass === 0){ g.strokeStyle = P.deep; g.lineWidth = out * 2; g.stroke(); } else g.fill();
      }
    }
    bodyPath(0.85); g.fill();
    // 顔
    const faceC = shiny ? 'hsl(40,60%,40%)' : `hsl(${hueLerp(25, P.h, 0.3)},${L(25, 45, a3)}%,${L(32, 55, a3)}%)`;
    g.fillStyle = faceC; ell(0, -R * 0.05, R * 0.58, R * 0.52); g.fill(); stroke();
    for (const s of [-1, 1]){ g.fillStyle = faceC; ell(s * R * 0.62, -R * 0.15, R * 0.18, R * 0.08, s * (0.3 + droop * 0.6)); g.fill(); stroke(); }
    // まきヅノ
    for (const s of [-1, 1]){
      g.strokeStyle = 'hsl(40,35%,72%)'; g.lineWidth = R * (0.1 + 0.07 * bold);
      g.beginPath(); for (let k = 0; k < 30; k++){ const a = k / 30 * 5.2, rr = R * (0.22 - k * 0.006) * (1 + 0.4 * bold); g.lineTo(s * (R * 0.5 + Math.cos(a) * rr * s), -R * 0.55 + Math.sin(a) * rr); } g.stroke();
    }
  } else {
    g.fillStyle = P.main; bodyPath(1); g.fill(); stroke();
    // おなか
    g.fillStyle = P.belly; ell(0, R * 0.42, R * 0.5 * sx, R * 0.38); g.fill();
    if (sp === 'dragon'){ g.strokeStyle = P.light; g.lineWidth = out; for (let k = 0; k < 3; k++){ g.beginPath(); g.moveTo(-R * 0.35, R * (0.25 + k * 0.16)); g.quadraticCurveTo(0, R * (0.3 + k * 0.16), R * 0.35, R * (0.25 + k * 0.16)); g.stroke(); } }
  }
  if (sp === 'owl'){
    // 顔のおめん(フェイシャルディスク)と、たたんだ羽、胸の模様
    for (const s of [-1, 1]){ g.fillStyle = P.belly; ell(s * R * 0.3, -R * 0.15, R * 0.3, R * 0.3); g.fill(); }
    birdNote(); birdLoupe();
    for (const s of [-1, 1]){ g.fillStyle = P.dark; ell(s * R * 0.9 * sx, R * 0.2, R * 0.17, R * 0.38, s * -0.25); g.fill(); stroke(); }
    g.strokeStyle = P.dark; g.lineWidth = out;
    for (let k = 0; k < 3; k++) for (let j = -1; j <= 1; j += 2){ const x = j * R * 0.14 + (k % 2) * R * 0.07 - R * 0.035, y = R * (0.32 + k * 0.13); g.beginPath(); g.moveTo(x - R * 0.06, y); g.lineTo(x, y + R * 0.05); g.lineTo(x + R * 0.06, y); g.stroke(); }
  }
  if (sp === 'duck'){
    // 羽(手帳と虫めがねは羽の下にはさむ)
    birdNote(); birdLoupe();
    for (const s of [-1, 1]){ g.fillStyle = P.dark; ell(s * R * 0.92 * sx, R * 0.22, R * 0.18, R * 0.3, s * -0.5 + Math.sin(t * 5) * 0.08 * s); g.fill(); stroke(); }
    // あたまの羽毛
    g.strokeStyle = P.main; g.lineWidth = R * 0.08;
    for (let k = -1; k <= 1; k++){ g.beginPath(); g.moveTo(k * R * 0.06, -R * sy * 0.95); g.quadraticCurveTo(k * R * 0.2, -R * 1.25, k * R * 0.12 + R * 0.08, -R * 1.2); g.stroke(); }
  }

  // ---- 個性: 大胆→トゲ、とても慎重→ヘルメット ----
  if (a2 >= 0.8){
    // トゲトゲ: 頭にたくさんのトゲ
    const k2 = (a2 - 0.8) / 0.2, cnt = 5, sl = R * (0.3 + 0.15 * k2);
    g.fillStyle = shiny ? '#fff2b0' : `hsl(${(P.h + 160) % 360},45%,72%)`;
    for (let k = 0; k < cnt; k++){
      const a = -0.6 + k / (cnt - 1) * 1.2, bx = Math.sin(a) * R * 0.7 * sx, by = -Math.cos(a) * R * 0.88 * sy;
      g.beginPath(); g.moveTo(bx - Math.cos(a) * R * 0.1, by - Math.sin(a) * R * 0.1); g.lineTo(bx + Math.sin(a) * sl, by - Math.cos(a) * sl); g.lineTo(bx + Math.cos(a) * R * 0.1, by + Math.sin(a) * R * 0.1); g.closePath(); g.fill(); stroke();
    }
  } else if (a2 >= 0.5 && sp !== 'dragon'){
    // ツノアリ: なめらかなツノが1本(〜0.65)か2本
    const two = a2 >= 0.65, hl = R * (0.38 + 0.2 * (a2 - 0.5) / 0.3);
    const horn = (x, lean) => {
      const by = -R * 0.86 * sy, w = R * 0.12;
      g.fillStyle = shiny ? '#fff2b0' : 'hsl(45,55%,90%)';
      g.beginPath(); g.moveTo(x - w, by + R * 0.06); g.quadraticCurveTo(x - w * 0.6 + lean * hl * 0.2, by - hl * 0.6, x + lean * hl * 0.45, by - hl); g.quadraticCurveTo(x + w * 0.7 + lean * hl * 0.2, by - hl * 0.5, x + w, by + R * 0.06); g.closePath(); g.fill(); stroke();
      g.strokeStyle = 'rgba(150,120,80,.35)'; g.lineWidth = out * 0.8;
      for (let k = 1; k <= 2; k++){ const yy = by - hl * k * 0.28; g.beginPath(); g.moveTo(x - w * (1 - k * 0.25) + lean * hl * 0.12 * k, yy); g.lineTo(x + w * (1 - k * 0.25) + lean * hl * 0.12 * k, yy - R * 0.03); g.stroke(); }
    };
    if (two){ horn(-R * 0.3 * sx, -0.5); horn(R * 0.3 * sx, 0.5); } else horn(0, 0.15);
  }

  // ---- 顔 ----
  const ey = sp === 'sheep' ? -R * 0.12 : -R * 0.15, ex = sp === 'sheep' ? R * 0.24 : R * 0.33, er = R * (sp === 'sheep' ? 0.12 : sp === 'owl' ? 0.18 : 0.155);
  const blink = Math.sin(t * 1.1) > 0.992;
  for (const s of [-1, 1]){
    const x = s * ex;
    const sleepy = C((a4 - 0.6) / 0.35, 0, 1), sharp = C((0.4 - a4) / 0.4, 0, 1);
    if (blink || sleepy > 0.85){
      g.strokeStyle = '#2a1d26'; g.lineWidth = R * 0.05; g.beginPath(); g.arc(x, ey, er * 0.8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    } else {
      const eh = er * L(1.15, 0.9, sharp);
      g.fillStyle = '#2a1d26'; ell(x, ey, er * L(1, 0.85, sharp), eh); g.fill();
      g.fillStyle = '#fff'; ell(x - er * 0.3, ey - eh * 0.4, er * 0.36, er * 0.32); g.fill();
      g.beginPath(); g.arc(x + er * 0.35, ey + eh * 0.35, er * 0.14, 0, 6.283); g.fill();
      if (sleepy > 0){ g.fillStyle = sp === 'sheep' ? (shiny ? 'hsl(40,60%,40%)' : `hsl(${hueLerp(25, P.h, 0.3)},${L(25, 45, a3)}%,${L(32, 55, a3)}%)`) : P.main; g.fillRect(x - er * 1.2, ey - eh * 1.15, er * 2.4, eh * 1.15 * sleepy * 1.1); g.strokeStyle = '#2a1d26'; g.lineWidth = R * 0.035; g.beginPath(); g.moveTo(x - er, ey - eh * 1.15 + eh * 1.15 * sleepy * 1.1); g.lineTo(x + er, ey - eh * 1.15 + eh * 1.15 * sleepy * 1.1); g.stroke(); }
      if (sharp > 0){ g.strokeStyle = '#2a1d26'; g.lineWidth = R * 0.045; g.beginPath(); g.moveTo(x - s * er * 1.0, ey - er * 1.55 - sharp * er * 0.3); g.lineTo(x + s * er * 0.9, ey - er * 1.25 + sharp * er * 0.15); g.stroke(); }
    }
  }
  // ほっぺ
  g.fillStyle = 'rgba(255,110,140,.38)';
  const cxk = sp === 'sheep' ? R * 0.38 : R * 0.55;
  ell(-cxk, ey + R * 0.2, R * 0.11, R * 0.07); g.fill(); ell(cxk, ey + R * 0.2, R * 0.11, R * 0.07); g.fill();
  // 口まわり
  const my = ey + R * 0.25;
  if (sp === 'elephant'){
    // 長い鼻: ふだんは下に垂れて先がくるん、大胆ほど横に持ち上げる
    const b = C(bold + Math.sin(t * 2) * 0.06, 0, 1);
    const p0 = [0, ey + R * 0.08];
    const c1 = [L(-R * 0.03, R * 0.05, b), ey + L(R * 0.75, R * 0.5, b)];
    const p1 = [L(R * 0.2, R * 0.45, b), ey + L(R * 0.85, R * 0.4, b)];
    const c2 = [L(R * 0.4, R * 0.75, b), ey + L(R * 0.88, R * 0.3, b)];
    const p2 = [L(R * 0.38, R * 0.78, b), ey + L(R * 0.62, R * 0.0, b)];
    const path = () => { g.beginPath(); g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]); g.quadraticCurveTo(c2[0], c2[1], p2[0], p2[1]); };
    g.lineCap = 'round';
    path(); g.strokeStyle = P.deep; g.lineWidth = R * 0.26 + out * 2; g.stroke();
    path(); g.strokeStyle = P.main; g.lineWidth = R * 0.26; g.stroke();
    // しわ
    g.strokeStyle = P.dark; g.lineWidth = out * 0.8;
    for (let k = 1; k <= 3; k++){ const tt = k * 0.2, x = (1 - tt) * (1 - tt) * p0[0] + 2 * (1 - tt) * tt * c1[0] + tt * tt * p1[0], y = (1 - tt) * (1 - tt) * p0[1] + 2 * (1 - tt) * tt * c1[1] + tt * tt * p1[1]; g.beginPath(); g.moveTo(x - R * 0.1, y); g.lineTo(x + R * 0.1, y); g.stroke(); }
    // 鼻先の穴
    g.fillStyle = P.deep; ell(p2[0], p2[1], R * 0.05, R * 0.035); g.fill();
  } else if (sp === 'owl'){
    g.fillStyle = 'hsl(40,80%,55%)'; g.beginPath(); g.moveTo(-R * 0.08, my - R * 0.08); g.lineTo(R * 0.08, my - R * 0.08); g.lineTo(0, my + R * 0.06); g.closePath(); g.fill(); stroke();
  } else if (sp === 'duck'){
    g.fillStyle = 'hsl(28,95%,58%)'; ell(0, my, R * 0.24, R * 0.11); g.fill(); stroke();
    g.strokeStyle = 'hsl(20,70%,40%)'; g.lineWidth = out; g.beginPath(); g.moveTo(-R * 0.2, my); g.lineTo(R * 0.2, my); g.stroke();
  } else {
    if (sp === 'cat' || sp === 'rabbit'){ g.fillStyle = 'hsl(345,70%,70%)'; g.beginPath(); g.moveTo(-R * 0.05, my - R * 0.06); g.lineTo(R * 0.05, my - R * 0.06); g.lineTo(0, my); g.closePath(); g.fill(); }
    g.strokeStyle = '#3a2433'; g.lineWidth = R * 0.04;
    g.beginPath(); g.arc(-R * 0.06, my, R * 0.06, 0.1, Math.PI - 0.1); g.stroke();
    g.beginPath(); g.arc(R * 0.06, my, R * 0.06, 0.1, Math.PI - 0.1); g.stroke();
    if (sp === 'beaver'){ g.fillStyle = '#fff6e0'; g.strokeStyle = '#3a2433'; g.lineWidth = R * 0.025; for (const s of [-1, 1]){ g.beginPath(); g.rect(s > 0 ? 0 : -R * 0.11, my + R * 0.03, R * 0.11, R * 0.16); g.fill(); g.stroke(); } g.fillStyle = '#3a2433'; ell(0, my - R * 0.08, R * 0.08, R * 0.05); g.fill(); }
    if (sp === 'rabbit'){ g.fillStyle = '#fff'; g.fillRect(-R * 0.05, my + R * 0.04, R * 0.1, R * 0.09); g.strokeStyle = '#3a2433'; g.lineWidth = R * 0.02; g.strokeRect(-R * 0.05, my + R * 0.04, R * 0.1, R * 0.09); }
    if (sp === 'dragon'){ g.fillStyle = '#fff'; g.beginPath(); g.moveTo(R * 0.1, my + R * 0.03); g.lineTo(R * 0.16, my + R * 0.03); g.lineTo(R * 0.13, my + R * 0.11); g.closePath(); g.fill(); g.fillStyle = P.deep; g.beginPath(); g.arc(-R * 0.06, ey + R * 0.12, R * 0.02, 0, 6.283); g.arc(R * 0.06, ey + R * 0.12, R * 0.02, 0, 6.283); g.fill(); }
    if (sp === 'cat'){ g.strokeStyle = P.deep; g.lineWidth = R * 0.02; for (const s of [-1, 1]) for (let k = -1; k <= 1; k++){ g.beginPath(); g.moveTo(s * R * 0.32, my - R * 0.02 + k * R * 0.05); g.lineTo(s * R * 0.62, my - R * 0.05 + k * R * 0.09); g.stroke(); } }
  }

  // ---- 個性: ロマン→リボン ----
  if (sp !== 'sheep' || true){
    if (a3 > 0.65){
      const rx = -R * 0.55 * sx, ry = -R * 0.72 * sy;
      g.fillStyle = shiny ? '#ff5b7a' : 'hsl(340,85%,68%)';
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - R * 0.22, ry - R * 0.13); g.lineTo(rx - R * 0.22, ry + R * 0.13); g.closePath(); g.fill(); stroke();
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + R * 0.22, ry - R * 0.13); g.lineTo(rx + R * 0.22, ry + R * 0.13); g.closePath(); g.fill(); stroke();
      g.beginPath(); g.arc(rx, ry, R * 0.06, 0, 6.283); g.fill(); stroke();
    }
  }
  // ---- 持ち物: とても慎重→虫めがね(左手)、実用→手帳とえんぴつ(右手) ----
  const paw = (x, y) => { if (sp === 'duck' || sp === 'owl') return; g.fillStyle = sp === 'sheep' ? '#4a3b36' : P.main; ell(x, y, R * 0.13, R * 0.12); g.fill(); stroke(); };
  if (a2 < 0.25 && !(sp === 'duck' || sp === 'owl')){
    drawLoupe(-R * 0.8 * sx, R * 0.45, -R * 1.12 * sx, -R * 0.12);
    paw(-R * 0.8 * sx, R * 0.45);
  }
  if (a3 < 0.35 && !(sp === 'duck' || sp === 'owl')){
    drawNote(R * 0.98 * sx, R * 0.22, 0.15, 1.4);
    paw(R * 0.93 * sx, R * 0.44);
  }
  // 熟考の「…」
  if (a4 > 0.8){
    g.fillStyle = 'rgba(80,60,90,.6)'; const k = (t * 1.5) % 3;
    for (let i = 0; i < 3; i++){ if (i < k){ g.beginPath(); g.arc(R * (0.85 + i * 0.16), -R * (1.0 + i * 0.12), R * 0.045, 0, 6.283); g.fill(); } }
  }
  g.restore();
  // きらきら
  if (a3 >= 0.8 || shiny){
    const n2 = shiny ? 8 : 4;
    for (let i = 0; i < n2; i++){
      const a = t * 0.6 + i / n2 * 6.283, rr = R * (1.45 + 0.1 * Math.sin(t * 3 + i));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8, k = 0.5 + 0.5 * Math.sin(t * 5 + i * 2);
      g.fillStyle = shiny ? `rgba(255,215,80,${k})` : `rgba(255,255,255,${k * 0.9})`;
      sstar(g, x, y, R * (0.05 + 0.08 * k));
    }
  }
}


// ===== 状態 =====
let engine, world, state = 'title', time = 0, playLeft = CFG.playTime, phaseT = 0;
let parts = [], texts = [], result = null, lastTickSec = 99;
let spawnT = 0, pendingMerges = [], held = null, introDone = false, countT = -1;
const STEP = 1 / 60; let physAcc = 0;
let stats;
// 遊び方の記録(診断と「くせ」に使う)
function newStats(){
  return { holdTime: 0, playTime: 0, drags: [], gaps: [], lastRelease: null, firstGrab: null,
    throws: 0, throwCats: [], spills: 0, merges: 0, maxLv: 1, mergeCats: [], lastReleaseLeft: null,
    selfSpills: 0, pushSpills: 0, aimed: 0, grow: { p: 0, r: 0 }, firstCat: null, reacts: [], moveDelays: [], early: 0, late: 0, touches: 0, relH: [], holdBig: 0, maxLvAt: null, maxHeldChain: 0 }; // relH：荷物を離した高さ（0＝底 1＝ふち） // touches：本番中に画面を触った回数
}
function items(){ return world ? Composite.allBodies(world).filter(b => !b.isStatic && b.def) : []; }
function inBagItems(){ return items().filter(b => !b.dead && !b.thrown && !b.spilled && b.position.x > BAG.x0 - 6 && b.position.x < BAG.x1 + 6 && b.position.y < BAG.floor + 10); }
function makeItem(def, x, y){
  // 当たり判定の円は 12角形で十分(見た目は絵なので まるのまま)。角が多いほど衝突計算が重い
  const opt = { restitution: 0.1, friction: 0.25, frictionStatic: 0.4, frictionAir: 0.012, density: 0.002 };
  // 見せ方 D(角ばる)の Lv2 以上は 多角形の当たり判定
  const b = polyShape(def) ? Bodies.fromVertices(x, y, [bodyVerts(def)], opt) : Bodies.circle(x, y, def.s, opt, CFG.circleSides);
  b.def = def; b.born = time;
  return b;
}
function randomKind(){ return Math.floor(Math.random() * KINDS.length); }
let kindW = KINDS.map(() => 1), kindPts = KINDS.map(() => 0), kindPop = KINDS.map(() => 0);
function favor(k, pts){ kindPts[k] += pts; kindW[k] = 1 + CFG.favorMax * (1 - Math.exp(-kindPts[k] / CFG.favorK)); kindPop[k] = Math.min(1, 0.4 + pts * 0.3); }
function favoredKind(){ const sum = kindW.reduce((a, b) => a + b, 0); let r = Math.random() * sum; for (let i = 0; i < kindW.length; i++){ r -= kindW[i]; if (r < 0) return i; } return kindW.length - 1; }
function resetGame(){
  engine = Engine.create({ gravity: { x: 0, y: 1 }, positionIterations: CFG.posIter, velocityIterations: CFG.velIter });
  physAcc = 0;
  world = engine.world;
  // 壁は見た目より外側に厚くして、すばやく動かしても すり抜けないように
  const st = { isStatic: true, friction: 0.3 }, T = 60;
  Composite.add(world, [
    Bodies.rectangle((BAG.x0 + BAG.x1) / 2, BAG.floor + T / 2, BAG.x1 - BAG.x0 + T * 2, T, st),
    Bodies.rectangle(BAG.x0 - T / 2, (BAG.rim + BAG.floor) / 2, T, BAG.floor - BAG.rim, st),
    Bodies.rectangle(BAG.x1 + T / 2, (BAG.rim + BAG.floor) / 2, T, BAG.floor - BAG.rim, st),
  ]);
  Events.on(engine, 'beforeUpdate', beforePhysics);
  Events.on(engine, 'collisionStart', onContact);
  Events.on(engine, 'collisionActive', onContact);
  Events.on(engine, 'collisionStart', onFeelHit);
  parts = []; texts = []; result = null; held = null; pendingMerges = [];
  kindW = KINDS.map(() => 1); kindPts = KINDS.map(() => 0); kindPop = KINDS.map(() => 0);
  playLeft = CFG.playTime; phaseT = 0; lastTickSec = 99; spawnT = 0; feverOn = false; bagFillK = 0; creakLatch = [false, false, false]; feelRings.length = 0; profLine.until = -9; nextMutterAt = time + 6;
  stats = newStats();
  prefill();
  countT = introDone ? 0 : -1; // -1 = はじめの練習中
  tut = null; if (!introDone) tutStart();
}
// はじめに半分ちょっと埋める(見えないところで落として 合体も済ませておく)
function prefill(){
  const depth = BAG.floor - BAG.rim;
  for (let round = 0; round < 14; round++){
    if (fillLevel() >= CFG.startFill) break;
    for (let i = 0; i < 9; i++){
      const lv = Math.random() < 0.3 ? 2 : 1, def = LV[randomKind()][lv];
      Composite.add(world, makeItem(def, rand(BAG.x0 + def.s, BAG.x1 - def.s), BAG.rim - 20 - i * 30));
    }
    for (let s = 0; s < 70; s++){ Engine.update(engine, 1000 / 60); processMerges(true); }
  }
  for (let s = 0; s < 40; s++){ Engine.update(engine, 1000 / 60); processMerges(true); }
  parts = []; texts = [];
  for (const b of items()) if (b.position.y > BAG.floor + 30) Composite.remove(world, b);
}
// 詰まり具合(0=空, 1=ふちまで)。表面の高さの中央値で見る
function fillLevel(){
  const tops = [];
  const its = items().filter(b => !b.dead && !b.thrown);
  for (let x = BAG.x0 + 14; x < BAG.x1 - 8; x += 20){
    let top = BAG.floor;
    for (const b of its){ if (b.bounds.min.x < x && b.bounds.max.x > x && b.position.y < BAG.floor + 10) top = Math.min(top, b.bounds.min.y); }
    tops.push(top);
  }
  tops.sort((a, b) => a - b);
  return (BAG.floor - tops[Math.floor(tops.length / 2)]) / (BAG.floor - BAG.rim);
}
function topLevel(){ // いちばん高い所(ふちを超えたか)
  let top = BAG.floor; for (const b of inBagItems()) top = Math.min(top, b.bounds.min.y);
  return (BAG.floor - top) / (BAG.floor - BAG.rim);
}
// ===== 合体 =====
function onContact(ev){
  for (const p of ev.pairs){
    const a = p.bodyA.parent, b = p.bodyB.parent;
    if (!a.def || !b.def || a.dead || b.dead || a.thrown || b.thrown) continue;
    if (a.def.kind !== b.def.kind || a.def.lv !== b.def.lv || a.def.lv >= CFG.maxLv) continue;
    a.dead = b.dead = true; pendingMerges.push([a, b]);
  }
}
function processMerges(silent){
  const list = pendingMerges; pendingMerges = [];
  for (const [a, b] of list){
    const holdA = held && held.body === a, holdB = held && held.body === b, isHeld = holdA || holdB;
    const base = holdA ? a : holdB ? b : null;
    const x = base ? base.position.x : (a.position.x + b.position.x) / 2, y = base ? base.position.y : (a.position.y + b.position.y) / 2;
    const def = LV[a.def.kind][a.def.lv + 1];
    const nb = makeItem(def, x, y);
    Body.setVelocity(nb, { x: (a.velocity.x + b.velocity.x) / 2, y: (a.velocity.y + b.velocity.y) / 2 - 1 });
    nb.pop = 1;
    Composite.remove(world, a); Composite.remove(world, b); Composite.add(world, nb);
    if (isHeld){ held.body = nb; nb.baseMass = nb.mass; Body.setMass(nb, nb.mass * CFG.holdMassK); }
    if (silent) continue;
    stats.merges++; if (def.lv > stats.maxLv) stats.maxLvAt = CFG.playTime - playLeft; stats.maxLv = Math.max(stats.maxLv, def.lv); stats.mergeCats.push(def.cat);
    if (isHeld) stats.aimed++;
    if (def.lv >= 3) stats.grow[def.cat] += def.lv - 2;
    if (held && isHeld){ held.merges++; stats.maxHeldChain = Math.max(stats.maxHeldChain, held.merges); favor(def.kind, CFG.favorAim + CFG.favorChain * (held.merges - 1)); }
    const n = 10 + def.lv * 3;
    for (let i = 0; i < n; i++){ const an = rand(0, 6.283), v = rand(60, 160 + def.lv * 30); parts.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, t: 0, life: rand(0.3, 0.6), c: i % 2 ? '255,255,255' : '255,220,120', r: rand(2, 4 + def.lv) }); }
    if (time - lastMergeAt < 1.4) mergeCombo++; else mergeCombo = 1;
    lastMergeAt = time;
    texts.push({ x, y: y - def.s - 6, t: 0, text: (def.lv >= CFG.maxLv ? 'MAX!' : 'Lv' + def.lv + '!') + (FEEL && mergeCombo >= 2 ? ' ' + i18n('comboFmt')(mergeCombo) : ''), size: 14 + def.lv * 2, col: '255,250,220' });
    sfx.merge(def.lv, FEEL ? mergeCombo : 1);
    profReact('merge'); feelRing(x, y, '255,176,0', 40 + def.lv * 9); // 合体した場所にも金のリング
    if (def.lv >= 4 || time - mergeSayAt > 1.1){
      mergeSayAt = time;
      if (def.lv >= CFG.maxLv){ profSay(i18n('say5')[Math.floor(Math.random() * 3)], 'big'); feelRing(PROF_BADGE.x, PROF_BADGE.y, '255,176,0', 74); }
      else if (def.lv === 4){ profSay(i18n('say4')[Math.floor(Math.random() * 3)], 'big'); feelRing(PROF_BADGE.x, PROF_BADGE.y, '255,176,0', 64); }
      else profSay(i18n('sayLvFmt')(def.lv, i18n('sayNice')[Math.floor(Math.random() * 3)]));
    }
    tutEvent('merge', def);
  }
}
// ===== 降ってくる荷物 =====
function spawnOne(){
  const lv = Math.random() < CFG.spawnLv2 ? 2 : 1, def = LV[favoredKind()][lv];
  const b = makeItem(def, rand(BAG.x0 + def.s + 4, BAG.x1 - def.s - 4), BAG.rim - 70); // 出やすさ表示の すぐ下から降らせる
  Body.setVelocity(b, { x: rand(-0.5, 0.5), y: FEEL && feverOn ? 5.5 : 2 }); // フィーバー中は 初速も上げて シュッと落ちる
  b.fell = true; // 降ってきた荷物(すぐ触るかを見る)
  b.bornHeld = !!held; // v43：降ってきたとき 別の荷物をつかんでいたか（手がふさがっていた分は 反応の速さに数えない）
  Composite.add(world, b);
}
// ===== 物理の前に: つかんだ荷物を指へ =====
function beforePhysics(){
  if (!held) return;
  const b = held.body;
  if (!b || b.dead && !b.def) return;
  const tx = clamp(held.px - held.ox, 0, W), ty = clamp(held.py - held.oy, 20, H);
  let vx = (tx - b.position.x) * CFG.followK, vy = (ty - b.position.y) * CFG.followK;
  const sp = Math.hypot(vx, vy); if (sp > CFG.followMax){ vx *= CFG.followMax / sp; vy *= CFG.followMax / sp; }
  Body.setVelocity(b, { x: vx, y: vy });
  Body.setAngularVelocity(b, b.angularVelocity * 0.85);
  b.lastHeld = time;
}
function release(fling){
  if (!held) return;
  const b = held.body;
  if (b && !b.dead){ if (b.baseMass) Body.setMass(b, b.baseMass); }
  // ドラッグの記録
  const pts = held.path; let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const diag = Math.max(12, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
  if (state === 'play' && countT >= 3){
    stats.drags.push({ len, ratio: len / diag, dur: time - held.t0, merges: held.merges });
    // v42：かき混ぜた動き(ぐるぐる2以上)と 上へシュッとしかけた動きは 離した高さに数えない（のびのび・実用 が 大胆 側に引っぱられるのを防ぐ）
    if (!fling && !(held.vy < -CFG.flingVy * 0.5) && len / diag < 2 && b && !b.dead) stats.relH.push((BAG.floor - b.position.y) / (BAG.floor - BAG.rim)); // 高い所に置くほど 大胆
    stats.lastRelease = time; stats.lastReleaseLeft = playLeft;
  }
  if (fling && b && !b.dead) throwOut(b, held.vx);
  held = null;
}
function throwOut(b, vx){
  if (time - throwSayAt > 1.6){ throwSayAt = time; profSay(i18n('throwSay')[Math.floor(Math.random() * 3)]); }
  b.thrown = true; b.thrownAt = time; b.collisionFilter = { group: -1, category: 0, mask: 0 };
  Body.setVelocity(b, { x: clamp(vx / 60, -6, 6), y: -21 });
  Body.setAngularVelocity(b, rand(-0.3, 0.3));
  if (state === 'play'){ stats.throws++; stats.throwCats.push(b.def.cat); }
  texts.push({ x: b.position.x, y: b.position.y - 24, t: 0, text: i18n('throwText'), size: 16, col: '255,235,200' });
  sfx.rocket();
  tutEvent('throw');
}

// ===== 入力 =====
function toLocal(e){ const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
function pickAt(p){
  let best = null, bd = 1e9;
  for (const b of items()){
    if (b.dead || b.thrown) continue;
    const d = Math.hypot(b.position.x - p.x, b.position.y - p.y) - inRadius(b.def);
    if (d < 14 && d < bd){ bd = d; best = b; }
  }
  return best;
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); initAudio();
  const p = toLocal(e);
  if ((state === 'title' || state === 'play') && soundTap(p)) return;
  if (state === 'title'){ if (langTap(p)) return; resetGame(); state = 'play'; sfx.pick(); return; }
  if (state === 'result'){ resultTap(p); return; }
  if (state !== 'play') return;
  if (tutActive() && tutTap(p)) return;
  if ((countT >= 0 && countT < 3) || held) return;
  stats.touches++; // 一度も触らなかったら 相棒は博士本人
  const b = pickAt(p);
  if (!b) return;
  held = { body: b, id: e.pointerId, px: p.x, py: p.y, ox: p.x - b.position.x, oy: p.y - b.position.y, path: [{ x: p.x, y: p.y, t: time }], t0: time, merges: 0, vx: 0 };
  b.baseMass = b.mass; Body.setMass(b, b.mass * CFG.holdMassK);
  if (stats.firstGrab === null) stats.firstGrab = CFG.playTime - playLeft;
  if (stats.firstCat === null) stats.firstCat = b.def.cat;
  // v43：手が空いているときに降ってきた荷物だけ数える（かき混ぜ続ける人が 熟考 に化けないように）
  if (b.fell && !b.touched && !b.bornHeld) stats.reacts.push(time - b.born);
  b.touched = true;
  if (countT >= 3) favor(b.def.kind, CFG.favorTouch);
  if (stats.lastRelease !== null) stats.gaps.push(time - stats.lastRelease);
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  previewPair = null; // 新しくつかんだら 予兆音をリセット
  sfx.pick();
});
cv.addEventListener('pointermove', e => {
  if (!held || e.pointerId !== held.id) return;
  const p = toLocal(e);
  held.px = p.x; held.py = p.y;
  held.path.push({ x: p.x, y: p.y, t: time });
  if (!held.moved && Math.hypot(p.x - held.path[0].x, p.y - held.path[0].y) > 8){ held.moved = true; stats.moveDelays.push(time - held.t0); }
});
function onUp(e){
  if (!held || e.pointerId !== held.id) return;
  // はなす直前 0.1 秒の動きで 上へのスワイプか判定
  const pts = held.path, now = time;
  let i = pts.length - 1; while (i > 0 && now - pts[i - 1].t < 0.1) i--;
  const a = pts[Math.max(0, i - 1)], z = pts[pts.length - 1], dt = Math.max(0.016, z.t - a.t);
  const vy = (z.y - a.y) / dt, vx = (z.x - a.x) / dt;
  held.vx = vx; held.vy = vy;
  const fling = state === 'play' && vy < -CFG.flingVy && a.y - z.y > CFG.flingUp && Math.abs(vx) < Math.abs(vy) * 0.9;
  release(fling);
}
cv.addEventListener('pointerup', onUp);
cv.addEventListener('pointercancel', e => { if (held && e.pointerId === held.id) release(false); });
addEventListener('keydown', e => {
  if (window.SHARE && SHARE.isOpen && SHARE.isOpen()) return;
  initAudio();
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (state === 'title'){ resetGame(); state = 'play'; }
  else if (state === 'result' && phaseT > 1.2){ retry(); }
  else if (tutActive() && tut.step === 2) tutFinish();
});

// ===== はじめの練習(1回目だけ。時間はすすまない) =====
// 0=合体してみる 1=上にシュッで放り出す 2=かき混ぜてみる→「準備OK!」
const TUT_BAND = { x: 14, y: 8, w: W - 28, h: 44 };
// ボタンはスマホの指が届きやすい下に。「準備OK!」だけは 荷物のいちばん上の少し上に出て、荷物が増えると上へ(いちばん上は minY)
const TUT_SKIP = { x: W - 118, y: 598, w: 106, h: 36 };
const TUT_READY = { x: 40, y: 420, w: W - 80, h: 52, minY: 172, maxY: 430, gap: 26 };
const TUT_KIND = 0;
// 練習で合体させる荷物(どんぐり)
let tut = null; // { step, t, okT, targets }
function tutActive(){ return state === 'play' && countT < 0 && tut; }
function tutClear(){ for (const b of items()) Composite.remove(world, b); pendingMerges = []; held = null; }
function tutSettle(n){ for (let s = 0; s < n; s++){ Engine.update(engine, 1000 / 60); processMerges(true); } parts = []; texts = []; }
function tutStart(){ tut = { step: 0, t: 0, okT: null, targets: [], enterT: 0 }; tutSetup(0); }
function tutSetup(step){
  tut.step = step; tut.t = 0; tut.okT = null; tut.targets = []; TUT_READY.y = TUT_READY.maxY;
  if (step === 0){
    tutClear();
    // 下にちがう荷物をしきつめて、その上の左右に どんぐりを2つ
    const ks = [1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5).slice(0, 6);
    ks.forEach((k, i) => { const d = LV[k][i % 3 === 0 ? 2 : 1]; Composite.add(world, makeItem(d, BAG.x0 + 26 + i * 48, BAG.floor - 40 - (i % 2) * 30)); });
    tutSettle(50);
    const d = LV[TUT_KIND][1], a = makeItem(d, BAG.x0 + 46, BAG.floor - 160), b = makeItem(d, BAG.x1 - 46, BAG.floor - 160);
    Composite.add(world, [a, b]); tutSettle(50);
    tut.targets = [a, b];
  } else if (step === 1){
    tutPickThrow();
  }
}
function tutPickThrow(){ // いちばん上にある荷物を「いらない荷物」に
  const c = inBagItems().filter(b => !b.dead).sort((a, b) => a.position.y - b.position.y);
  tut.targets = c.length ? [c[0]] : [];
}
function tutEvent(kind, def){
  if (!tutActive() || tut.okT !== null) return;
  if ((tut.step === 0 && kind === 'merge' && def.kind === TUT_KIND) || (tut.step === 1 && kind === 'throw')){
    tut.okT = 0; if (FEEL) feelTutOk(); else sfx.fanfare();
    texts.push({ x: W / 2, y: 260, t: 0, text: i18n('tutOk')[tut.step === 0 ? 0 : 1], size: 30, col: '255,250,220' });
  }
}
function tutUpdate(dt){
  tut.t += dt; tut.enterT += dt;
  if (tut.okT !== null){ tut.okT += dt; if (tut.okT > 1.3) tutSetup(tut.step + 1); return; }
  const alive = b => b && !b.dead && !b.thrown && !b.spilled && Composite.get(world, b.id, 'body');
  if (tut.step === 0 && !tut.targets.every(alive) && !pendingMerges.length) tutSetup(0); // こぼれたら やり直し
  if (tut.step === 1 && !tut.targets.every(alive)) tutPickThrow();
  if (tut.step === 2){
    let top = BAG.floor; for (const b of inBagItems()) if (b.position.y > BAG.rim && !b.dead && b.speed < 0.8 && !(held && held.body === b)) top = Math.min(top, b.bounds.min.y); // 落ちている途中・つかんでいる荷物は数えない
    const want = clamp(top - TUT_READY.gap - TUT_READY.h, TUT_READY.minY, TUT_READY.maxY);
    if (want < TUT_READY.y) TUT_READY.y = Math.max(want, TUT_READY.y - 120 * dt); // 上にだけ動く
  }
  if (tut.step === 2){ spawnT += dt; if (spawnT >= CFG.spawnEvery * 1.3){ spawnT = 0; if (items().length < 26) tutSpawn(); } }
}
function tutSpawn(){ // 練習では 合体しやすいように 少ない種類から
  const def = LV[[TUT_KIND, 4, 6][Math.floor(Math.random() * 3)]][1];
  const b = makeItem(def, rand(BAG.x0 + def.s + 4, BAG.x1 - def.s - 4), BAG.rim - 20);
  Body.setVelocity(b, { x: rand(-0.5, 0.5), y: 2 }); Composite.add(world, b);
}
function tutFinish(){ introDone = true; tut = null; sfx.pick(); resetGame(); }
function tutTap(p){ // true = 練習のボタンが押された
  if (inRect(p, TUT_SKIP)){ tutFinish(); return true; }
  if (tut.step === 2 && inRect(p, TUT_READY)){ tutFinish(); return true; }
  return false;
}
// 指のお手本(半透明の 👆 が動く)
function drawGhost(x, y, a){
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '38px sans-serif';
  ctx.fillText('👆', x + 4, y - 6); ctx.restore();
}
function drawTutorial(){
  const st = tut.step, done = tut.okT !== null;
  // まわりを暗くして 触ってほしい荷物だけ照らす
  if (!done && st < 2 && tut.targets.length){
    ctx.save(); ctx.globalAlpha = Math.min(1, tut.t * 3);
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    for (const b of tut.targets){ const r = b.def.s + 12; ctx.moveTo(b.position.x + r, b.position.y); ctx.arc(b.position.x, b.position.y, r, 0, 6.283); }
    ctx.fillStyle = 'rgba(25,18,10,.5)'; ctx.fill('evenodd');
    ctx.strokeStyle = `rgba(255,220,110,${0.6 + 0.4 * Math.sin(time * 6)})`; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -time * 20;
    for (const b of tut.targets){ ctx.beginPath(); ctx.arc(b.position.x, b.position.y, b.def.s + 12, 0, 6.283); ctx.stroke(); }
    ctx.setLineDash([]); ctx.restore();
  }
  // 博士とふきだし
  const lines = (done ? i18n('tutDone')[st === 0 ? 0 : 1] : i18n('tutLines')[st]).slice();
  // 博士は左の画面外から 45度ほど傾いて ふきだしの上からのぞきこむ(体の下はふきだしの裏)。最初に一度だけ すっと出てくる
  while (lines.length < 3) lines.push(''); // 2行のセリフも3行ぶんの高さにして 博士とふきだしの位置をそろえる
  const fs = fitSize(lines, W - 44, 15), lh = fs * 1.45, bh = lines.length * lh + fs * 1.1;
  let bTop, ps;
  if (st < 2){ bTop = TUT_READY.maxY - 8 - bh; ps = 1.0; } // 3/3 の始まりと同じ位置(「準備OK!」がいちばん下にあるときの場所)
  else { // 「準備OK!」のすぐ上。ボタンが上がるにつれて 博士は少し小さく
    const R = TUT_READY; bTop = R.y - 8 - bh; ps = lerp(0.6, 1.0, clamp((R.y - R.minY) / 150, 0, 1));
  }
  const ent = 1 - Math.pow(1 - clamp(tut.enterT / 0.45, 0, 1), 3);
  const rot = 0.78, px = -6 - (1 - ent) * 140, py = bTop + 6 + (1 - ent) * 60;
  ctx.save(); ctx.translate(px, py); ctx.rotate(rot); drawProf(0, 0, ps, time, 'point'); ctx.restore();
  bubble(22, bTop, W - 44, lines, fs, ent >= 1 ? profTail(px, py, ps, time, rot) : undefined, undefined, true);
  // お手本の指(つかんでいる間は出さない)
  if (!done && !held && tut.targets.length){
    if (st === 0 && tut.targets.length === 2){
      const [a, b] = tut.targets, cyc = 2.0, k = (tut.t % cyc) / cyc, m = clamp((k - 0.15) / 0.55, 0, 1), e = m * m * (3 - 2 * m);
      const x = lerp(a.position.x, b.position.x, e), y = lerp(a.position.y, b.position.y, e) - Math.sin(e * Math.PI) * 60;
      ctx.save(); ctx.strokeStyle = 'rgba(255,240,200,.7)'; ctx.lineWidth = 3; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(a.position.x, a.position.y); ctx.quadraticCurveTo((a.position.x + b.position.x) / 2, (a.position.y + b.position.y) / 2 - 120, b.position.x, b.position.y); ctx.stroke(); ctx.restore();
      drawGhost(x, y, k < 0.85 ? 0.9 : (1 - k) / 0.15 * 0.9);
    }
    if (st === 1){
      const b = tut.targets[0], cyc = 1.4, k = (tut.t % cyc) / cyc, m = clamp((k - 0.3) / 0.25, 0, 1);
      const x = b.position.x, y = b.position.y - m * m * 150;
      // 上向きの矢印
      ctx.save(); ctx.strokeStyle = 'rgba(255,230,140,.85)'; ctx.fillStyle = 'rgba(255,230,140,.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      const ax = x + 34, ay0 = b.position.y - 10, ay1 = b.position.y - 120;
      ctx.beginPath(); ctx.moveTo(ax, ay0); ctx.lineTo(ax, ay1 + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax - 11, ay1 + 14); ctx.lineTo(ax, ay1 - 4); ctx.lineTo(ax + 11, ay1 + 14); ctx.closePath(); ctx.fill(); ctx.restore();
      drawGhost(x, y, k < 0.75 ? 0.9 : (1 - k) / 0.25 * 0.9);
    }
  }
  if (st === 2){
    const r = TUT_READY, pul = 1 + 0.04 * Math.sin(time * 6);
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(pul, pul);
    ctx.fillStyle = 'rgba(40,25,15,.25)'; roundRect(-r.w / 2, -r.h / 2 + 4, r.w, r.h, r.h / 2); ctx.fill();
    ctx.fillStyle = '#f08a3c'; roundRect(-r.w / 2, -r.h / 2, r.w, r.h, r.h / 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 22px sans-serif'; ctx.fillText(i18n('ready'), 0, 1, r.w - 24);
    ctx.restore();
  }
  // 上に大きく「練習中」の帯
  const B = TUT_BAND;
  ctx.save();
  ctx.fillStyle = '#3b2a22'; roundRect(B.x, B.y, B.w, B.h, 14); ctx.fill();
  ctx.save(); roundRect(B.x, B.y, B.w, B.h, 14); ctx.clip();
  ctx.fillStyle = 'rgba(255,210,58,.16)'; for (let x = -60 + (time * 30) % 28; x < W; x += 28){ ctx.beginPath(); ctx.moveTo(x, B.y + B.h); ctx.lineTo(x + 14, B.y + B.h); ctx.lineTo(x + 36, B.y); ctx.lineTo(x + 22, B.y); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const bandEn = lang !== 'ja', bandX = bandEn ? 124 : 112;
  ctx.font = 'bold ' + (bandEn ? 20 : 24) + 'px sans-serif'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#3b2a22';
  ctx.strokeText(i18n('practice'), 28, 31); ctx.fillStyle = '#ffd23a'; ctx.fillText(i18n('practice'), 28, 31);
  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#fff8e0';
  ctx.fillText(i18n('tutStep')[st], bandX, 23);
  ctx.fillStyle = 'rgba(255,248,224,.7)'; ctx.fillText(i18n('tutNote'), bandX, 39);
  { // スキップ(右下。背景にうもれないよう こい色+白いふち+かげ)
    const s = TUT_SKIP;
    ctx.fillStyle = 'rgba(30,20,10,.3)'; roundRect(s.x, s.y + 3, s.w, s.h, s.h / 2); ctx.fill();
    ctx.fillStyle = '#3b2a22'; roundRect(s.x, s.y, s.w, s.h, s.h / 2); ctx.fill();
    ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff8e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(i18n('skip'), s.x + s.w / 2, s.y + s.h / 2 + 1, s.w - 16); // 記号はiPhoneで絵文字になるので 文字だけ
  }
  ctx.restore();
}

// ===== 更新 =====
function update(dt){
  time += dt; phaseT += dt;
  if (FEEL && world){ // 満杯度: バッグ内の荷物の いちばん上の高さから
    let ft = BAG.floor;
    for (const b of items()) if (!b.thrown && !b.spilled && b.position.x > BAG.x0 && b.position.x < BAG.x1 && b.position.y > BAG.rim - 60) ft = Math.min(ft, b.position.y - (b.def ? b.def.s : 0));
    bagFillK += (clamp((BAG.floor - ft) / (BAG.floor - BAG.rim), 0, 1) - bagFillK) * Math.min(1, dt * 2.5); // ゆっくり追随させて 壁が暴れないように
    feelCreak();
  }
  if (state === 'title' || !engine) return;
  if (state === 'play' || state === 'closing'){
    // 物理は いつも 1/60 秒きざみ(120Hz の画面でも 余計に回さない)。追いつけない分は捨てる
    physAcc = Math.min(physAcc + dt, STEP * CFG.maxSteps);
    while (physAcc >= STEP - 1e-6){ physAcc -= STEP; Engine.update(engine, STEP * 1000); processMerges(false); }
  }
  if (parts.length > CFG.maxParts) parts.splice(0, parts.length - CFG.maxParts);
  for (const b of items()){
    if (b.pop) b.pop = Math.max(0, b.pop - dt * 4);
    if (b.sq) b.sq = Math.max(0, b.sq - dt * 4.5);
    if (b.position.y < -120 || b.position.y > H + 80 || b.position.x < -80 || b.position.x > W + 80){ if (held && held.body === b) release(false); Composite.remove(world, b); }
    else if (!b.thrown && !b.spilled && (b.position.y > BAG.floor + 30 || b.position.x < BAG.x0 - 30 || b.position.x > BAG.x1 + 30) && b.position.y > BAG.rim){
      b.spilled = true; sfx.spill(); profReact('spill'); if (time - spillSayAt > 1.6){ spillSayAt = time; profSay(i18n('spillSay')[Math.floor(Math.random() * 2)]); } // 責めない、冷静に
      if (state === 'play'){ stats.spills++; if ((held && held.body === b) || time - (b.lastHeld || -9) < 1.2) stats.selfSpills++; else stats.pushSpills++; }
      texts.push({ x: clamp(b.position.x, 30, W - 30), y: BAG.floor - 10, t: 0, text: i18n('spillText'), size: 12, col: '255,230,210' });
      if (held && held.body === b) release(false);
    }
    if (b.thrown && Math.random() < 0.5) parts.push({ x: b.position.x + rand(-6, 6), y: b.position.y + b.def.s, vx: rand(-30, 30), vy: rand(80, 160), t: 0, life: rand(0.2, 0.4), c: '255,240,180', r: rand(2, 4) });
  }
  for (const p of parts){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-3 * dt); }
  parts = parts.filter(p => p.t < p.life);
  for (const t of texts) t.t += dt; texts = texts.filter(t => t.t < 1.1);
  for (let k = 0; k < kindPop.length; k++) kindPop[k] = Math.max(0, kindPop[k] - dt * 3);

  if (state === 'play'){
    if (countT >= 0 && countT < 3){
      countT += dt; const c = Math.ceil(3 - countT); if (c !== lastTickSec && c > 0){ lastTickSec = c; sfx.tick(); }
      if (countT >= 3){ lastTickSec = 99; if (FEEL) feelCountStart(); else sfx.pick(); startShownT = time; }
      return;
    }
    if (countT < 0){ if (tut) tutUpdate(dt); return; }
    playLeft -= dt; stats.playTime += dt; if (held){ stats.holdTime += dt; if (held.body && held.body.def && held.body.def.lv >= 3) stats.holdBig += dt; if (playLeft > CFG.playTime / 2) stats.early += dt; else stats.late += dt; }
    if (FEEL && !feverOn && playLeft <= 5 && playLeft > 0){ // フィーバー突入
      feverOn = true; feverT0 = time; if (engine) engine.gravity.y = 1.35; // 重力も強めて 落ち方そのものを変える
      [680, 820, 990, 1240].forEach((fr, i) => feelDroplet(fr, i * 0.08, 0.14, 0.16)); feelBubble(420, 0.26, 0.08);
      feelRing(W / 2, 330, '255,176,0', 150);
    }
    if (FEEL && !feverOn && time >= nextMutterAt && time > profLine.until){ // たまに どうでもいい独り言(ヒントに読めない他愛ない内容だけ)
      profSay(i18n('mutter')[Math.floor(Math.random() * 5)], 'mutter');
      nextMutterAt = time + rand(6, 11);
    }
    spawnT += dt; const spEvery = FEEL && feverOn ? 0.30 : CFG.spawnEvery; if (spawnT >= spEvery){ spawnT -= spEvery; if (items().length < CFG.maxItems) spawnOne(); }
    const sec = Math.ceil(playLeft);
    if (sec <= 5 && sec !== lastTickSec && sec > 0){ lastTickSec = sec; sfx.tick(); }
    if (playLeft <= 0){
      playLeft = 0; release(false); state = 'closing'; phaseT = 0; drumRolled = false;
      sfx.pop(); // 「そこまで!」は 画面まんなかの帯で出す(draw)
    }
  }
  if (FEEL && state === 'closing' && !drumRolled && phaseT >= 1.05){ drumRolled = true; feelDrumroll(); } // 博士の「フムフム…」と同時に ゆっくり目のドラムロール
  if (state === 'closing' && phaseT > 2.2){ result = judge(); state = 'reveal'; phaseT = 0; if (FEEL) feelTanOn(); else sfx.pop(); }
  if (state === 'reveal' && phaseT > 1.0){ state = 'result'; phaseT = 0; resultTab = 0; shareImg = null; if (FEEL) feelJaaan(); else sfx.fanfare(); }
}

// ===== 診断 =====
// 博士のひとこと(強く出た2つの個性について)
function profTalk(ax, habit, key){
  const order = [0, 1, 2, 3].sort((a, b) => Math.abs(ax[b] - 0.5) - Math.abs(ax[a] - 0.5));
  const prof = i18n('profLines'); // 軸ごとの博士のひとこと(文言は i18n.js)
  // 1行目は 種族の決め手(いちばん育てた荷物)。種族とコメントが食い違わないように
  const kn = key ? KINDS[key.kind].name : '';
  const first = !key ? prof[order[0]][ax[order[0]] < 0.5 ? 0 : 1]
    : key.lv >= 5 ? i18n('keyLv5Fmt')(kn)
    : key.lv >= 4 ? i18n('keyLv4Fmt')(kn)
    : key.lv >= 2 ? i18n('keyLvFmt')(kn, key.lv)
    : i18n('keyLikeFmt')(kn);
  // 1行目で Lv5 をほめたときは「合体マスター」のくせ(Lv5 をほめる)と かぶるので 性格のひとことにする
  const dup = habit && habit.id === 'merge' && key && key.lv >= 5;
  const second = habit && !dup ? habit.line : prof[order[0]][ax[order[0]] < 0.5 ? 0 : 1];
  return [first, second, i18n('profLast')]; // 「……たぶんな。」は 3行目の右はしに小さく（drawResult）
}
const DEBUG = false; // true にすると 結果画面上部のデバッグ表示が出る
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
function judge(){
  const inBag = inBagItems();
  const S = stats, T = Math.max(1, S.playTime);
  // ※ ここで出すのは「生の値」。最後に axPct で「いろんな遊び方の中で下から何割か」(0〜1) に直す
  // 1 きっちり↔のびのび: ねらった合体の割合(低いほど 混ぜて偶然まかせ) + 同じ種類のまとまり具合 + ぐるぐる度
  const dl = S.drags.filter(d => d.len > 20);
  const totLen = dl.reduce((s, d) => s + d.len, 0);
  const ratio = totLen ? dl.reduce((s, d) => s + d.ratio * d.len, 0) / totLen : 1;
  const pathPerSec = S.drags.reduce((s, d) => s + d.len, 0) / T;
  const aimRate = S.merges >= 3 ? S.aimed / S.merges : 0.5;
  // まとまり: 同じ種類どうしの いちばん近い相手までの距離(半径の和で割る)。1 に近いほど くっついている
  const near = [];
  for (const b of inBag){ let m = Infinity; for (const c of inBag){ if (c !== b && c.def.kind === b.def.kind) m = Math.min(m, Math.hypot(c.position.x - b.position.x, c.position.y - b.position.y) / (b.def.s + c.def.s)); } if (m < Infinity) near.push(Math.min(m, 5)); }
  const cluster = near.length ? avg(near) : 3;
  const a1 = 0.4 * (1 - aimRate) + 0.3 * cluster / 5 + 0.3 * Math.min(1.5, (ratio - 1) / 2.2);
  // 2 慎重↔大胆: 自分でこぼした数(重め) + 押し出されてこぼれた数 + 詰まり具合 + 大きく育てた(あふれる危険を取った)
  const lvl = topLevel(), med = fillLevel();
  const relH = S.relH.length ? avg(S.relH) : 0.3, spillRate = (S.selfSpills + 0.4 * S.pushSpills) / Math.max(4, S.drags.length);
  const a2 = lvl + 0.25 * S.selfSpills + 0.08 * S.pushSpills + 0.08 * (S.maxLv - 3) + (med > 0.9 ? 0.1 : 0);
  // 3 実用↔ロマン: 育てた荷物(Lv3以上にした物) + 放り出した荷物の逆 + 最初につかんだ物 + 面積の割合(軽め)
  const area = b => b.def.s * b.def.s; // 見た目の大きさ(形によらず Lv の大きさで比べる)
  const tot = inBag.reduce((s, b) => s + area(b), 0);
  const areaR = tot ? inBag.filter(b => b.def.cat === 'r').reduce((s, b) => s + area(b), 0) / tot : 0.5;
  const g = S.grow.p + S.grow.r, growR = g ? S.grow.r / g : 0.5;
  const tp = S.throwCats.filter(c => c === 'p').length, tr = S.throwCats.length - tp;
  const throwR = tp + tr ? 0.5 + 0.5 * (tp - tr) / (tp + tr) : 0.5; // 実用を捨てた = ロマン寄り
  const firstR = S.firstCat === 'r' ? 1 : S.firstCat === 'p' ? 0 : 0.5;
  const a3 = 0.4 * growR + 0.25 * throwR + 0.15 * firstR + 0.2 * areaR;
  // 4 即決↔熟考: 降ってきた荷物にすぐ触るか + つかんでから動かすまでの間 + 手を止めていた割合
  const idle = 1 - S.holdTime / T;
  const react = S.reacts.length >= 2 ? avg(S.reacts) : 2.5;
  const delay = S.moveDelays.length ? avg(S.moveDelays) : 0.2;
  const a4 = 0.35 * Math.min(react, 4) / 4 + 0.25 * Math.min(delay, 0.6) / 0.6 + 0.4 * idle;
  const raw = [a1, a2, a3, a4], ax = raw.map((v, i) => axPct(i, v));
  // きっちり・慎重・即決 の3軸は 自動プレイの分布ではなく、人が遊んだときの目安で直接決める
  // （自動プレイの「ぐるぐる」「こぼしまくり」「見てるだけ」に引っぱられて、人がふつうに遊ぶと 片側に寄ってしまうため）
  // 目安は 2026-11-23 に人が3回遊んだ数値（ゆっくり / ふつう / ずっと動かす）から決めた
  // きっちり↔のびのび：ねらわずに合体した割合 35%→きっちり 75%→のびのび、ぐるぐる度 1.2→2.5、まとまり 1.5→3
  // v41：2026-11-25 ねらい別に遊んだ27回のログで決め直し。まとまり は差が出ないので外した
  // v42：狙い率は 離した高さ と結びつく（大胆に遊ぶと 狙い率が下がって のびのび に化ける）ので外した
  ax[0] = lerp(0.5, norm(ratio, 1.05, 2.0), norm(S.holdTime, 0.3, 1.5)); // ほとんど触らないときだけ真ん中寄せ（ゆっくり遊ぶ人も はっきり出るように弱めた）
  // 慎重↔大胆：「量」ではなく「割合」で測る（よく動かすだけで大胆にならないように。即決と結びつかないように）
  //   いちばん高い荷物の高さ 0.65→慎重 0.95→大胆、荷物を離した高さの平均 0.45→0.85、動かした回数あたりのこぼれ 0→0.25
  // v41：積んだ高さは自動で落ちてくるので自分では変えられない → 外した。離した高さが いちばん差が出た（慎重0.11〜0.14 / 大胆0.54〜0.69）
  ax[1] = clamp(0.8 * norm(relH, 0.15, 0.5) + 0.2 * norm(spillRate, 0, 0.1), 0, 1);
  // 即決↔熟考：手を止めていた割合 45%→即決 80%→熟考（いちばん差が出た）、降ってきた荷物に触るまで 1.8秒→5秒、つかんでから動かすまで（人はほぼ差が出ない）
  // v41：反応秒を主役に。動かし回数（熟考8〜13 / 即決15〜22）を追加。つかんでから動かすまで は差が出ないので外した
  // v42：休み(かき混ぜると即決側)と 動かし回数(かき混ぜると熟考側)は ぐるぐる と結びつく。同じ重みにして打ち消し合わせ、反応秒を主役に
  ax[3] = clamp(0.6 * norm(react, 1.3, 4.0) + 0.2 * norm(idle, 0.5, 0.78) + 0.2 * (1 - norm(S.drags.length, 9, 16)), 0, 1);
  // 実用↔ロマン（2026-11-23 測り方を変更・試し中）：種族は「どの荷物を育てたか」で決まるので、
  // この軸は 荷物の種類を見ずに「育て方」で測る（種族とこの軸が くっつかないように）
  //   ロマン：1つを でっかく育てた（いちばん大きい荷物が バッグの何割か）・最高 Lv が高い
  //   実用  ：いらない物を放り出して 片付けた
  //   目安は仮。デバッグ表示の「大1つ / 最大Lv / 捨て」を人のプレイで見て決め直す
  const bigShare = tot ? Math.max(...inBag.map(area)) / tot : 0;
  const ax2Old = ax[2];
  // v41：捨てた回数を主役に。大1つ は 0.04〜0.11 しか動かないので幅を狭めた
  // v42：最大Lv・大1つ は ほかの軸を意識して遊ぶと下がる（集中が分かれる）ので軽くした
  ax[2] = clamp(0.6 * (1 - norm(S.throws, 0, 4)) + 0.25 * norm(bigShare, 0.05, 0.10) + 0.15 * norm(S.maxLv, 4, 5), 0, 1);
  // 記録だけ（式には未使用）：残りの合体できるペア数・表面のデコボコ
  const pk = {}; for (const b of inBag){ const k = b.def.kind + ':' + b.def.lv; pk[k] = (pk[k] || 0) + 1; }
  const pairsLeft = Object.values(pk).reduce((s, c) => s + Math.floor(c / 2), 0);
  const COLS = 6, colH = [];
  for (let i = 0; i < COLS; i++){ const cx0 = BAG.x0 + (BAG.x1 - BAG.x0) * i / COLS, cx1 = BAG.x0 + (BAG.x1 - BAG.x0) * (i + 1) / COLS; let top = BAG.floor; for (const b of inBag) if (b.position.x >= cx0 && b.position.x < cx1) top = Math.min(top, b.bounds.min.y); colH.push((BAG.floor - top) / (BAG.floor - BAG.rim)); }
  const colM = avg(colH), bumpy = Math.sqrt(avg(colH.map(h => (h - colM) * (h - colM)))) || 0;
  if (S.touches === 0) return { special: true, ax, bin: ax.map(v => v >= 0.5 ? 1 : 0), shiny: false, count: 0 };
  const bin = ax.map(v => v >= 0.5 ? 1 : 0);
  const shiny = Math.random() < CFG.shinyRate;
  const pickSp = speciesFromBag(inBag), species = pickSp.species;
  const nameParts = creatureName(species, ax, shiny);
  const ctxH = { inBag, lvl, ratio, pathPerSec, idle, area, tot, aimRate, cluster, react };
  const habit = pickHabit(ctxH);
  return {
    ax, bin, shiny, count: inBag.length, monName: nameParts.join(i18n('nameJoin')), nameParts, species, habit,
    typeName: i18n('typePre')['' + bin[0] + bin[1]] + i18n('typeJoin') + i18n('typeSuf')['' + bin[2] + bin[3]],
    desc: [i18n('desc').a[bin[0]], i18n('desc').b[bin[1]], i18n('desc').c[bin[2]], i18n('desc').d[bin[3]]],
    // キンイロのときは 3行目で激レアにふれる（このときは「……たぶんな。」を付けない）
    talk: shiny ? [...profTalk(ax, habit, pickSp).slice(0, 2), i18n('shinyTalk')] : profTalk(ax, habit, pickSp), keyKind: pickSp.kind, keyLv: pickSp.lv, alt: pickSp.alt,
    raw, dbg: { relH, spillRate, aimRate, cluster, ratio, lvl, selfSp: S.selfSpills, pushSp: S.pushSpills, maxLv: S.maxLv, growR, throwR, firstR, areaR, react, delay, idle, merges: S.merges, bigShare, throws: S.throws, ax2: ax[2], ax2Old, hold: S.holdTime, T, touches: S.touches, nDrags: S.drags.length, aimed: S.aimed, left: inBag.length, pairsLeft, bumpy, maxLvAt: S.maxLvAt, holdBig: S.holdBig, maxHeldChain: S.maxHeldChain, nReacts: S.reacts.length },
  };
}
// ===== ふつうの遊び方との比較 =====
// いろいろな遊び方を自動で試したときの 各軸の生の値(小さい順)。自分の値がこの中で下から何割にあたるかを 0〜1 にする
// (荷物・判定・降る速さなどを変えたら 取り直す)
// 自動プレイ265回(見せ方D=角の数がLv・お気に入りが出やすい仕組み入り。狙って合体 / ぐるぐる / めちゃくちゃ / てきとう / ほぼ見てるだけ × 放り出し・好み・ためらい・飛びつき・はみ出し いろいろ)の 2.5%きざみの分位点
const AX_SAMPLE = [
  [0.311,0.354,0.376,0.387,0.396,0.404,0.412,0.419,0.423,0.427,0.437,0.443,0.451,0.459,0.463,0.466,0.471,0.477,0.484,0.489,0.501,0.508,0.514,0.515,0.518,0.521,0.524,0.53,0.544,0.607,0.646,0.727,0.767,0.837,0.851,0.88,0.892,0.91,0.929,0.968,0.976],
  [0.655,0.8,0.852,0.882,0.911,0.923,0.939,0.954,0.979,0.997,1.004,1.011,1.029,1.045,1.056,1.066,1.077,1.087,1.1,1.111,1.121,1.136,1.148,1.151,1.158,1.163,1.17,1.177,1.185,1.195,1.208,1.217,1.232,1.246,1.268,1.281,1.307,1.319,1.365,1.41,1.59],
  [0.087,0.24,0.278,0.314,0.33,0.343,0.35,0.362,0.379,0.388,0.407,0.419,0.425,0.434,0.445,0.453,0.462,0.476,0.488,0.501,0.512,0.517,0.532,0.544,0.552,0.563,0.577,0.585,0.604,0.619,0.639,0.648,0.658,0.672,0.681,0.694,0.708,0.721,0.742,0.773,0.92],
  [0.162,0.299,0.349,0.38,0.395,0.41,0.419,0.434,0.451,0.46,0.474,0.479,0.494,0.502,0.513,0.522,0.532,0.551,0.558,0.567,0.576,0.587,0.595,0.603,0.611,0.617,0.627,0.631,0.644,0.654,0.66,0.667,0.679,0.692,0.702,0.714,0.728,0.747,0.767,0.808,0.897],
];
function axPct(i, v){
  const s = AX_SAMPLE[i], n = s.length;
  if (!n) return clamp(v, 0, 1);
  let lt = 0; while (lt < n && s[lt] < v) lt++;
  let r;
  if (lt === 0) r = 0; else if (lt === n) r = n; else r = lt - 1 + (v - s[lt - 1]) / Math.max(1e-9, s[lt] - s[lt - 1]);
  return clamp((r + 0.5) / (n + 1), 0, 1);
}
// ===== くせ =====
// 目立った遊び方を1つ選んで 結果にそえる。score >= 1 で候補、いちばん高いもの
const HABITS = [
  { id: 'merge', score: c => stats.maxLv >= 5 ? 1.3 : 0 },
  { id: 'chain', score: c => Math.max(0, ...stats.drags.map(d => d.merges)) / 3 },
  { id: 'purge', score: c => stats.throws / 5 },
  { id: 'swirl', score: c => c.ratio / 3.4 },
  { id: 'passion', score: c => stats.spills / 4 },
  { id: 'snug', score: c => c.lvl >= 0.95 && c.lvl <= 1.01 && stats.spills === 0 ? 1.02 : 0 },
  { id: 'devoted', score: c => { const n = {}; c.inBag.forEach(b => n[b.def.kind] = (n[b.def.kind] || 0) + c.area(b)); return Math.max(0, ...Object.values(n)) / c.tot / 0.4; } },
  { id: 'variety', score: c => new Set(c.inBag.filter(b => b.def.lv >= 3).map(b => b.def.kind)).size >= 7 ? 1.05 : 0 },
  { id: 'patient', score: c => c.idle / 0.85 },
  { id: 'speed', score: c => c.pathPerSec / 950 },
  { id: 'content', score: c => stats.lastReleaseLeft !== null ? stats.lastReleaseLeft / 6 : 0 },
  { id: 'early', score: c => stats.firstGrab !== null && stats.firstGrab < 0.35 ? 1.02 : 0 },
  { id: 'oops', score: c => stats.selfSpills >= 1 ? 1.04 + 0.1 * stats.selfSpills : 0 },
  { id: 'aim', score: c => stats.merges >= 6 && c.aimRate >= 0.35 ? 1 + (c.aimRate - 0.35) * 2 : 0 },
  { id: 'luck', score: c => stats.merges >= 15 && stats.holdTime >= 8 && c.aimRate <= 0.03 ? 1.05 : 0 },
  { id: 'tidy', score: c => c.inBag.length >= 8 && c.cluster <= 1.7 ? 1 + (1.7 - c.cluster) * 2 : 0 },
  { id: 'finish', score: c => stats.holdTime > 3 && stats.late > stats.early * 2.5 ? 1.05 : 0 },
  { id: 'reflex', score: c => stats.reacts.length >= 3 && c.react <= 1.85 ? 1 + (1.85 - c.react) : 0 },
];
function pickHabit(c){
  let best = null, bs = 1;
  for (const h of HABITS){ const s = h.score(c) + Math.random() * 0.05; if (s >= bs){ bs = s; best = h; } }
  return best ? { id: best.id, name: i18n('habits')[best.id].name, line: i18n('habits')[best.id].line } : null;
}

// ===== トーシロ博士(オリジナルのうさんくさい博士) =====
// 約2頭身のデフォルメ: もじゃもじゃ白髪、ぐるぐるメガネ、もこもこヒゲ、赤ネクタイ、白衣、ミトンの手
// 座標は 640x720 の原画座標で描き、足もと(320,690)を (x,y) に合わせる
// 調整値 (博士の調整モックで作って「設定をコピー」→ ここに貼る)。角度は度、0°=右・90°=真下
const PROF_CFG = {
  size: 0.3,                 // 原画座標 → 博士の大きさ(s=1 のとき)
  bob: 5,                    // ふわふわ上下の幅
  // ぐるぐるメガネ: 左右で始点・速さ・向きをずらす
  spiral: { turns: 3.3, speedL: 2.2, speedR: 2.2, phaseL: 30, phaseR: 120, dirL: -1, dirR: -1 },
  armW: 46,                  // 袖の太さ
  handR: 25,                 // 手の大きさ
  armL: { x: 262, y: 508, ang: 121, len: 100, swing: 3, hand: 28 },            // 左腕(下ろしている・手は白衣の後ろ)
  armR: { x: 386, y: 533, ang: -34, len: 87, swing: 9, speed: 5.8, hand: 14 }, // 右腕(得意げにふりふり)
  peek: { ang: -32, len: 86, hand: 14, lensX: 384, lensY: 412, lensR: 58 },    // 右腕(虫めがね)
  mouth: { x: 322, y: 502, gap: 3 },   // しっぽが向かう口の位置 / 顔の輪郭とのすきま
};
const PROF_P = {};  // Path2D のキャッシュ
function profPath(key, d){ return PROF_P[key] || (PROF_P[key] = new Path2D(d)); }
const PD = Math.PI / 180;
// ぐるぐるメガネの渦巻き(中心 cx,cy / 回転 a0 / 巻く向き dir)
function profSpiral(cx, cy, a0, dir){
  const turns = PROF_CFG.spiral.turns, n = 90, rMax = 40;
  ctx.beginPath();
  for (let k = 0; k <= n; k++){
    const u = k / n, a = a0 + dir * u * turns * 6.283, r = 0.8 + u * rMax;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
}
// 袖+ミトンの手。肩(px,py)から角度 ang(ラジアン)・長さ len で伸ばす
function profArm(px, py, ang, len, hand){
  const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len, w = PROF_CFG.armW;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey);
  ctx.strokeStyle = '#2b2320'; ctx.lineWidth = w + 13; ctx.stroke();
  ctx.strokeStyle = '#fbfaf6'; ctx.lineWidth = w; ctx.stroke();
  return { hx: ex + Math.cos(ang) * hand, hy: ey + Math.sin(ang) * hand };
}
function profHand(h){
  ctx.fillStyle = '#ffd9b3'; ctx.strokeStyle = '#2b2320'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(h.hx, h.hy, PROF_CFG.handR, 0, 6.283); ctx.fill(); ctx.stroke();
}
// 吹き出しのしっぽの行き先(足もと(x,y)・大きさ s のときの画面座標)。rot は博士ごと傾けて描いたときの角度
// しっぽは口の方を向き、顔の輪郭の手前(gap)で止まる
function profTail(x, y, s, t, rot){
  const C = PROF_CFG, k = s * C.size, bob = Math.sin(t * 2.4) * C.bob, c = Math.cos(rot || 0), sn = Math.sin(rot || 0);
  const tf = (px, py) => { const lx = (px - 320) * k, ly = (py + bob - 690) * k; return { x: x + lx * c - ly * sn, y: y + lx * sn + ly * c }; };
  const m = tf(C.mouth.x, C.mouth.y), f = tf(320, 404); // 口 / 顔の中心
  return { x: m.x, y: m.y, face: { x: f.x, y: f.y, rx: 144 * k, ry: 134 * k, rot: rot || 0 }, gap: C.mouth.gap * s };
}
function drawProf(x, y, s, t, mode){
  const C = PROF_CFG;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * C.size, s * C.size); ctx.translate(-320, -690);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ink = '#2b2320';
  const P = profPath;
  const fs = (path, fill, lw) => { ctx.fillStyle = fill; ctx.fill(path); if (lw){ ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke(path); } };
  // 影
  ctx.fillStyle = 'rgba(0,0,0,.13)'; ctx.beginPath(); ctx.ellipse(320, 692, 165, 20, 0, 0, 6.283); ctx.fill();
  // 足(ちょこん)
  fs(P('footL', 'M218 690 C214 662 240 650 272 652 C296 654 306 668 304 690 Z'), '#463c36', 5);
  fs(P('footR', 'M336 690 C334 668 344 654 368 652 C400 650 426 662 422 690 Z'), '#463c36', 5);
  // 体ごと ふわふわ上下
  ctx.translate(0, Math.sin(t * 2.4) * C.bob);
  // 腕(付け根は白衣の下に隠れる)
  const aL = C.armL, aR = C.armR, pk = C.peek;
  const armL = profArm(aL.x, aL.y, (aL.ang + Math.sin(t * 2.4 + 1) * aL.swing) * PD, aL.len, aL.hand);
  let armR, lens = null;
  if (mode === 'peek'){
    // 虫めがねを右目の前にかざす
    armR = profArm(aR.x, aR.y, pk.ang * PD, pk.len, pk.hand);
    lens = { x: pk.lensX + Math.sin(t * 2) * 3, y: pk.lensY + Math.cos(t * 2) * 2, r: pk.lensR };
  } else {
    // 手を上げて得意げにふりふり
    armR = profArm(aR.x, aR.y, (aR.ang + Math.sin(t * aR.speed) * aR.swing) * PD, aR.len, aR.hand);
  }
  // 左手は白衣より後ろ
  profHand(armL);
  // 白衣(台形)+ズボン+ベルト
  fs(P('coat', 'M238 478 L402 478 L430 654 L210 654 Z'), '#fbfaf6', 6);
  fs(P('pants', 'M294 478 L346 478 L358 654 L282 654 Z'), '#8198b0');
  ctx.fillStyle = '#463c34'; ctx.fillRect(282, 616, 76, 14);
  // ネクタイ
  fs(P('tieK', 'M304 512 L336 512 L332 544 L308 544 Z'), '#c2503f', 4);
  fs(P('tieB', 'M308 544 L332 544 L338 588 L320 612 L302 588 Z'), '#c2503f', 4);
  // 右手(ミトン)
  if (!lens) profHand(armR);
  // ===== 頭(2頭身なので 白衣の上に大きくかぶさる) =====
  ctx.save(); ctx.translate(320, 520); ctx.scale(0.8, 0.8); ctx.translate(-320, -480);
  const hairY = 4 + Math.sin(t * 2.4 + 0.6) * 3; // 髪がちょっと遅れてゆれる
  // 後ろ髪
  ctx.save(); ctx.translate(0, hairY);
  ctx.beginPath(); ctx.ellipse(320, 308, 198, 186, 0, 0, 6.283); ctx.fillStyle = '#eff0f4'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.stroke();
  ctx.restore();
  // 顔
  ctx.beginPath(); ctx.ellipse(320, 335, 180, 168, 0, 0, 6.283); ctx.fillStyle = '#ffd9b3'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.stroke();
  // 前髪(大きな塊3つ)
  ctx.save(); ctx.translate(0, hairY);
  fs(P('hair1', 'M168 270 C148 202 194 152 246 168 C278 178 278 224 252 246 C226 268 186 296 168 270 Z'), '#eff0f4', 6);
  fs(P('hair2', 'M244 170 C240 102 318 76 366 108 C398 129 388 176 352 192 C316 204 252 202 244 170 Z'), '#eff0f4', 6);
  fs(P('hair3', 'M364 116 C398 78 476 102 480 164 C483 206 446 228 414 212 C384 197 348 152 364 116 Z'), '#eff0f4', 6);
  ctx.restore();
  // ほっぺ
  ctx.fillStyle = 'rgba(255,157,138,.55)';
  ctx.beginPath(); ctx.ellipse(205, 398, 14, 8, 0, 0, 6.283); ctx.ellipse(435, 398, 14, 8, 0, 0, 6.283); ctx.fill();
  // まゆ(片方だけピクピク)
  const brow = Math.max(0, Math.sin(t * 3)) * 8;
  ctx.strokeStyle = '#8a8d99'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(240, 284); ctx.quadraticCurveTo(262, 273, 284, 284); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(356, 284 - brow); ctx.quadraticCurveTo(378, 273 - brow * 1.6, 400, 284 - brow); ctx.stroke();
  // 口(ヒゲの下からのぞくにっこり)
  ctx.strokeStyle = '#83392b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(300, 456); ctx.quadraticCurveTo(324, 468, 344, 452); ctx.stroke();
  // ぐるぐるメガネ(レンズはベタ塗りで目は見えない。左右で渦の始点・速さ・向きがずれている)
  ctx.save(); ctx.translate(320, 350); ctx.scale(1.2, 1.2); ctx.translate(-320, -350);
  ctx.strokeStyle = ink; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(208, 342); ctx.lineTo(152, 334); ctx.moveTo(432, 342); ctx.lineTo(488, 334); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(316, 342); ctx.quadraticCurveTo(320, 335, 324, 342); ctx.stroke();
  const sp = C.spiral;
  for (const [cx, ph, spd, dir] of [[262, sp.phaseL, sp.speedL, sp.dirL], [378, sp.phaseR, sp.speedR, sp.dirR]]){
    ctx.beginPath(); ctx.arc(cx, 350, 54, 0, 6.283); ctx.fillStyle = '#fffbe8'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 7; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, 350, 50, 0, 6.283); ctx.clip();
    profSpiral(cx, 350, ph * PD - dir * t * spd, dir); ctx.strokeStyle = '#37312a'; ctx.lineWidth = 5; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // もこもこヒゲ
  ctx.save(); ctx.translate(0, 15); ctx.translate(320, 420); ctx.scale(1.25, 1.25); ctx.translate(-320, -420);
  fs(P('must', 'M265 412 C285 395 305 400 320 410 C335 400 355 395 375 412 C370 432 350 435 335 428 C325 424 320 432 320 432 C320 432 315 424 305 428 C290 435 270 432 265 412 Z'), '#edeef2', 5);
  ctx.restore();
  ctx.restore(); // 頭
  // 虫めがね(頭より手前)
  if (lens){
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(lens.x + lens.r * 0.7, lens.y + lens.r * 0.7); ctx.lineTo(armR.hx, armR.hy); ctx.stroke();
    profHand(armR);
    ctx.beginPath(); ctx.arc(lens.x, lens.y, lens.r, 0, 6.283);
    ctx.fillStyle = 'rgba(200,235,255,.45)'; ctx.fill(); ctx.strokeStyle = 'hsl(42,70%,45%)'; ctx.lineWidth = 12; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(lens.x, lens.y, lens.r * 0.7, 3.6, 4.4); ctx.stroke();
  }
  ctx.restore();
}
// 吹き出し。しっぽは tail = profTail(...) なら博士の口へ向けて顔の輪郭で止める / tx,ty の数値ならその点まで
function bubble(x, y, w, lines, size, tail, ty, noFit){
  if (!noFit) size = fitSize(lines, w, size); // 英語は長いので 吹き出しに収まるまで文字を縮める(日本語はそのまま)
  const tx = tail && typeof tail === 'object' ? tail.x : tail;
  if (tail && typeof tail === 'object') ty = tail.y;
  const lh = size * 1.45, h = lines.length * lh + size * 1.1;
  let tailPath = null;
  if (tx !== undefined){
    // 先端にいちばん近い辺から しっぽを出す
    const ox = Math.max(x - tx, tx - (x + w), 0), oy = Math.max(y - ty, ty - (y + h), 0);
    const side = ox > oy ? (tx < x ? 'L' : 'R') : (ty < y ? 'T' : 'B');
    const horiz = side === 'T' || side === 'B';
    const bx = horiz ? clamp(tx, x + 18, x + w - 18) : (side === 'L' ? x : x + w);
    const by = horiz ? (side === 'T' ? y : y + h) : clamp(ty, y + 14, y + h - 14);
    let px = tx, py = ty;
    const fc = tail && tail.face;
    if (fc){ // 付け根→口 の線が顔の楕円に入るところで止める
      const c = Math.cos(-fc.rot), sn = Math.sin(-fc.rot);
      const loc = (qx, qy) => { const dx = qx - fc.x, dy = qy - fc.y; return [(dx * c - dy * sn) / fc.rx, (dx * sn + dy * c) / fc.ry]; };
      const [ax, ay] = loc(bx, by), [mx, my] = loc(tx, ty), dx = mx - ax, dy = my - ay;
      const A = dx * dx + dy * dy, B = 2 * (ax * dx + ay * dy), Cc = ax * ax + ay * ay - 1, D = B * B - 4 * A * Cc;
      if (Cc > 0 && D >= 0){
        const u = (-B - Math.sqrt(D)) / (2 * A);
        if (u > 0 && u < 1){ px = bx + (tx - bx) * u; py = by + (ty - by) * u; }
      }
      const d = Math.hypot(px - bx, py - by) || 1, k = Math.min(tail.gap || 0, d * 0.5) / d;
      px += (bx - px) * k; py += (by - py) * k;
    }
    { // しっぽが短すぎるときは 最低の長さまでのばす
      const d = Math.hypot(px - bx, py - by), minLen = 10;
      if (d < minLen){ const dx = (d ? px - bx : tx - bx), dy = (d ? py - by : ty - by), n = Math.hypot(dx, dy) || 1; px = bx + dx / n * minLen; py = by + dy / n * minLen; }
    }
    const ux = horiz ? 8 : 0, uy = horiz ? 0 : 8; // 付け根の半幅
    // v44：付け根を吹き出しの内側まで差し込む（本体としっぽの白どうしが重なり、境目に線が出ない）
    const inX = side === 'L' ? 4 : side === 'R' ? -4 : 0, inY = side === 'T' ? 4 : side === 'B' ? -4 : 0;
    tailPath = () => { ctx.beginPath(); ctx.moveTo(bx - ux + inX, by - uy + inY); ctx.lineTo(px, py); ctx.lineTo(bx + ux + inX, by + uy + inY); ctx.closePath(); };
  }
  bubbleShape(x, y, w, h, 14, tailPath, '#fffdf6', '#3b2a22');
  ctx.fillStyle = '#3a2a18'; ctx.font = `bold ${size}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x + size * 0.8, y + size * 0.55 + lh * (i + 0.5)));
  return h;
}


// 吹き出しの形（本体＋しっぽ）を描く。どの吹き出しもこれを使う
// 先に ふちを倍の太さで描き、あとから塗る → 内側半分のふちと しっぽの付け根の線は 塗りに隠れて、外側のふちだけ残る（境目に線が出ない）
// しっぽの付け根は 本体の内側まで差し込んでおくこと
function bubbleShape(x, y, w, h, r, tailPath, fill, stroke, lw = 2){
  ctx.save();
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw * 2; ctx.lineJoin = 'round';
  roundRect(x, y, w, h, r); ctx.stroke();
  if (tailPath){ tailPath(); ctx.stroke(); }
  roundRect(x, y, w, h, r); ctx.fill();
  if (tailPath){ tailPath(); ctx.fill(); }
  ctx.restore();
}
function roundRect(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function fitSize(lines, w, size){
  if (lang === 'ja') return size;
  ctx.save(); let fs = size; ctx.font = `bold ${fs}px sans-serif`;
  while (fs > 9 && Math.max(0, ...lines.map(l => ctx.measureText(l).width)) > w - fs * 1.6){ fs -= 0.5; ctx.font = `bold ${fs}px sans-serif`; }
  ctx.restore(); return fs;
}
function fitText(text, maxW, size, weight){
  let s = size; ctx.font = `${weight} ${s}px sans-serif`;
  while (ctx.measureText(text).width > maxW && s > 10){ s -= 1; ctx.font = `${weight} ${s}px sans-serif`; }
}
// ===== 描画 =====
sfx.merge = (lv, combo) => {
  if (FEEL){ // 音階ラダー: ペンタトニックを Lv とコンボで駆け上がる(マリンバ風の短い減衰)
    const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const idx = Math.min(steps.length - 1, (lv - 1) + Math.min(((combo || 1) - 1), 2)); // コンボの音程への寄与は+2段まで（終盤に高くなりすぎない）
    const f = 523.25 * Math.pow(2, steps[idx] / 12);
    feelDroplet(f, 0, 0.22, 0.17); feelBubble(250 + lv * 25, 0.03, 0.10);
  } else {
    const f = 440 * Math.pow(2, (lv - 2) * 3 / 12); tone('triangle', f, f * 1.5, 0.12, 0.11); tone('sine', f * 2, f * 2.5, 0.08, 0.05, 0.05);
  }
  if (lv >= CFG.maxLv) sfx.fanfare();
};
const TIMER_Y = 46, TIMER_R = 40;
// ===== Lv の見せ方(試し中: 下のボタンで切り替え) =====
// A=数がふえる(Lv の数だけ中身が入る) / B=わくが進化(まる→二重わく→波わく→歯車→星) / C=両方
const LV_STYLES = ['A 数がふえる', 'B わくが進化', 'C 両方', 'D 角の数=Lv', 'E 角が減る'];
let lvStyle = 3; // 最初は D
try{ const s = localStorage.getItem('kakimaze.lvStyle2'); if (s !== null && +s >= 0 && +s < LV_STYLES.length) lvStyle = +s; }catch(_){}
function setLvStyle(i){
  lvStyle = i; try{ localStorage.setItem('kakimaze.lvStyle2', i); }catch(_){}
  // 当たり判定の形も 見せ方に合わせて作り直す(D だけ多角形)
  if (world) for (const b of items()){ const a = b.angle; Body.setAngle(b, 0); Body.setVertices(b, bodyVerts(b.def)); Body.setAngle(b, a); }
}
// D 角ばる: Lv1 まる → Lv2 六角形 → Lv3 五角形 → Lv4 四角形 → Lv5 三角形(角が減るほど とがって見える)
// D 角の数=Lv: Lv1 まる(1個) → Lv2 カプセル(2個) → Lv3 三角(3個) → Lv4 四角(4個) → Lv5 五角(5個)。絵文字は角の方向に置く
// E 角が減る: Lv1 まる → Lv2 六角 → Lv3 五角 → Lv4 四角 → Lv5 三角
// k = 外接円の半径 ÷ まるの半径(角が少ないほど 中が狭いので 大きめに)
const POLY_D = [null, null, { cap: true, w: 1.42, h: 0.8 }, { n: 3, k: 1.32 }, { n: 4, k: 1.16 }, { n: 5, k: 1.1 }];
const POLY_E = [null, null, { n: 6, k: 1.06 }, { n: 5, k: 1.1 }, { n: 4, k: 1.16 }, { n: 3, k: 1.3 }];
const POLY = POLY_E; // 旧名(検証用)
function polyShape(def){ return lvStyle === 3 ? POLY_D[def.lv] : lvStyle === 4 ? POLY_E[def.lv] : null; }
const isPolyStyle = () => lvStyle === 3 || lvStyle === 4;
function polyPts(def){
  const P = polyShape(def);
  if (P.cap){ const w = def.s * P.w, h = def.s * P.h; return roundPoly([[-w, -h], [w, -h], [w, h], [-w, h]], h * 0.98); } // カプセル(横長)
  const R = def.s * P.k, a0 = Math.PI / 2 + Math.PI / P.n; // 底が平ら
  const pts = []; for (let i = 0; i < P.n; i++){ const a = a0 + i / P.n * 6.283; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
  return roundPoly(pts, def.s * 0.2);
}
function bodyVerts(def){
  if (polyShape(def)) return polyPts(def).map(p => ({ x: p[0], y: p[1] }));
  const n = CFG.circleSides; return Array.from({ length: n }, (_, i) => { const a = i / n * 6.283; return { x: Math.cos(a) * def.s, y: Math.sin(a) * def.s }; });
}
function inRadius(def){ const P = polyShape(def); return !P ? def.s : P.cap ? def.s * P.h : def.s * P.k * Math.cos(Math.PI / P.n); }
const STYLE_BTN = { x: W / 2 - 74, y: 612, w: 148, h: 24 };
// Lv の数だけ並べる位置(半径に対する割合)と 1つの大きさ
const PACK = [null,
  { s: 1.25, p: [[0, 0]] },
  { s: 0.8,  p: [[-0.4, 0.02], [0.4, -0.02]] },
  { s: 0.72, p: [[0, -0.38], [-0.38, 0.28], [0.38, 0.28]] },
  { s: 0.64, p: [[-0.36, -0.34], [0.36, -0.34], [-0.36, 0.38], [0.36, 0.38]] },
  { s: 0.62, p: [[0, 0.02], [-0.47, -0.42], [0.47, -0.42], [-0.47, 0.46], [0.47, 0.46]] },
];
const FRAME_COL = ['', 'rgba(40,25,15,.45)', '#ffffff', '#e0b030', '#f08a20', '#e0453a'];
// わくの形(まる / 波 / 歯車 / 星)。g = 描く先のコンテキスト
function framePath(g, lv, r, useShape){
  g.beginPath();
  if (!useShape || lv <= 2){ g.arc(0, 0, r, 0, 6.283); return; }
  const N = 120, bumps = lv === 3 ? 8 : 10;
  for (let i = 0; i <= N; i++){
    const a = i / N * 6.283;
    let k;
    if (lv === 3) k = 0.95 + 0.06 * Math.cos(a * bumps);                       // ふんわり波
    else if (lv === 4) k = 0.93 + 0.07 * clamp(Math.cos(a * bumps) * 2.5, -1, 1); // 歯車(角ばった山)
    else { const t = Math.abs(((a * bumps / 6.283) % 1) - 0.5) * 2; k = 0.84 + 0.24 * Math.pow(t, 1.6); } // 星
    const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}
// 絵文字を「見た目の中心」で置く。
// ☁️ 🕶️ のような 異体字セレクタ付きの絵文字は、iPhone の Canvas で 文字幅の計算がずれて 横に寄って描かれるため、
// 一度 小さなキャンバスに描いて 実際に色が付いた範囲から ずれ量を測り、それを打ち消して描く(絵文字ごとに1回だけ測る)
const EMO_OFS = new Map();
function emojiOffset(e){
  let o = EMO_OFS.get(e); if (o) return o;
  o = { x: 0, y: 0 };
  try{
    const S = 64, N = S * 2, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); g.font = `${S}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
    g.fillText(e, S, S);
    const d = g.getImageData(0, 0, N, N).data; let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 24){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 >= 0) o = { x: ((x0 + x1) / 2 - S) / S, y: ((y0 + y1) / 2 - S) / S };
  }catch(_){}
  EMO_OFS.set(e, o); return o;
}
// g.font に設定ずみの大きさで、(x, y) を中心に絵文字を描く
function emojiText(g, e, x, y){
  const m = /([\d.]+)px/.exec(g.font), size = m ? +m[1] : 16, o = emojiOffset(e);
  const ta = g.textAlign, tb = g.textBaseline; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(e, x - o.x * size, y - o.y * size);
  g.textAlign = ta; g.textBaseline = tb;
}
// 荷物1つの絵(中心が原点)。重い処理(絵文字・ぼかし)を含むので 下の SPRITES に焼いて使い回す
function paintPiece(g, def, r, isHeld){
  const lv = def.lv;
  if (isPolyStyle()) return paintPoly(g, def, isHeld);
  const useCount = lvStyle !== 1, useShape = lvStyle !== 0;
  if (isHeld){ g.shadowColor = 'rgba(255,250,200,.95)'; g.shadowBlur = 18; }
  framePath(g, lv, r, useShape);
  g.fillStyle = def.col; g.fill();
  g.shadowColor = 'transparent'; g.shadowBlur = 0;
  if (useShape){
    g.lineWidth = lv === 1 ? 1.5 : lv === 2 ? 4 : 3 + lv * 0.6;
    g.strokeStyle = isHeld ? '#fff7c2' : FRAME_COL[lv]; g.stroke();
    if (lv === 2){ g.lineWidth = 1.5; g.strokeStyle = 'rgba(40,25,15,.4)'; g.beginPath(); g.arc(0, 0, r + 2, 0, 6.283); g.stroke(); }
    if (lv >= 4){ g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(0, 0, r * 0.74, 0, 6.283); g.stroke(); }
  } else {
    g.lineWidth = 1.5 + (lv - 1) * 0.8; g.strokeStyle = isHeld ? '#fff7c2' : lv >= 2 ? '#c9a24a' : 'rgba(40,25,15,.45)'; g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-r * 0.3, -r * 0.42, r * 0.36, r * 0.17, -0.5, 0, 6.283); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
  const pk = useCount ? PACK[lv] : PACK[1];
  const sz = useCount ? pk.s : (useShape && lv >= 3 ? 1.08 : 1.25);
  g.font = `${r * sz}px sans-serif`;
  for (const q of pk.p) emojiText(g, def.e, q[0] * r, q[1] * r);
}
// D 角ばる の絵
function paintPoly(g, def, isHeld){
  const lv = def.lv, ir = inRadius(def);
  if (isHeld){ g.shadowColor = 'rgba(255,250,200,.95)'; g.shadowBlur = 18; }
  g.beginPath();
  if (lv === 1) g.arc(0, 0, def.s, 0, 6.283);
  else polyPts(def).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.closePath();
  g.fillStyle = def.col; g.fill();
  g.shadowColor = 'transparent'; g.shadowBlur = 0;
  g.lineJoin = 'round';
  g.lineWidth = lv === 1 ? 1.5 : 2 + lv * 0.9;
  g.strokeStyle = isHeld ? '#fff7c2' : FRAME_COL[lv]; g.stroke();
  if (lv >= 2){ // 内側にも細い線(角の形をくっきり)
    g.save(); g.scale(0.8, 0.8); g.beginPath(); polyPts(def).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke(); g.restore();
  }
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-ir * 0.3, -ir * 0.45, ir * 0.36, ir * 0.16, -0.5, 0, 6.283); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
  // Lv の数だけ絵文字を入れる(三角形は ピラミッドに並べる)
  const P = polyShape(def);
  if (lvStyle === 3 && P){ // D: 角の方向に 1つずつ
    if (P.cap){ const w = def.s * P.w; g.font = `${ir * 1.45}px sans-serif`; emojiText(g, def.e, -w * 0.52, 0); emojiText(g, def.e, w * 0.52, 0); return; }
    const R = def.s * P.k, a0 = Math.PI / 2 + Math.PI / P.n, d = R * [0, 0, 0, 0.44, 0.4, 0.47][lv], sz = R * [0, 0, 0, 0.5, 0.52, 0.46][lv];
    g.font = `${sz}px sans-serif`;
    for (let i = 0; i < P.n; i++){ const a = a0 + i / P.n * 6.283; emojiText(g, def.e, Math.cos(a) * d, Math.sin(a) * d); }
    return;
  }
  const pk = lv === 5 ? TRI_PACK : PACK[lv], k = lv === 1 ? 1 : 1.12;
  g.font = `${ir * pk.s * k}px sans-serif`;
  for (const q of pk.p) emojiText(g, def.e, q[0] * ir, q[1] * ir);
}
// 三角形(頂点が上)に 5つ。単位は内接円の半径
const TRI_PACK = { s: 0.62, p: [[-0.46, -0.22], [0.46, -0.22], [-0.95, 0.5], [0, 0.5], [0.95, 0.5]] }; // 中2 / 下3
// 絵のキャッシュ: 種類×Lv×見せ方×つかみ中 ごとに 1回だけ描いておく(画面の拡大率が変わったら作り直す)
const SPRITES = new Map();
function pieceSprite(def, isHeld){
  const res = scale * dpr, key = def.kind + '-' + def.lv + '-' + lvStyle + (isHeld ? 'h' : '') + '@' + res.toFixed(2);
  let s = SPRITES.get(key);
  if (!s){
    if (SPRITES.size > 400) SPRITES.clear();
    const half = def.s * 1.34 + 4 + (isHeld ? 18 : 0), px = Math.ceil(half * 2 * res);
    const c = document.createElement('canvas'); c.width = c.height = px;
    const g = c.getContext('2d'); g.scale(res, res); g.translate(half, half);
    paintPiece(g, def, def.s, isHeld);
    s = { c, half }; SPRITES.set(key, s);
  }
  return s;
}

// ===== 気持ちよさ試作（?feel=0 で全部オフにして 元の手触りと比べられる） =====
const FEEL = !/[?&]feel=0/.test(location.search);
let mergeCombo = 0, lastMergeAt = -9;   // 合体のコンボ（音階ラダーと浮き文字用）
let previewPair = null;                  // 合体予告の予兆音を鳴らした相手
let lastHitSfx = -9;                     // 接触音のクールダウン
let lastBlipAt = -9;                     // 予兆音のクールダウン
let drumRolled = false;                  // 結果発表のドラムロール済みか
let profMood = { kind: 'idle', until: -9 };
const feelNotes = [];
function profReact(kind){
  if (!FEEL) return;
  profMood = { kind, until: time + (kind === 'merge' ? 0.85 : 1.15) };
  feelRing(PROF_BADGE.x, PROF_BADGE.y, kind === 'merge' ? '255,176,0' : '90,170,230', 54);
  if (kind === 'merge') for (let i = 0; i < 2; i++) feelNotes.push({ x: PROF_BADGE.x + rand(-4, 16), y: PROF_BADGE.y - 24, t0: time, life: rand(0.7, 1), vx: rand(5, 15), c: i ? '♪' : '♫' });
}
// 衝突の強さで スカッシュ＋小さな接触音
function onFeelHit(ev){
  if (!FEEL) return;
  for (const p of ev.pairs){
    const A = p.bodyA.parent || p.bodyA, B = p.bodyB.parent || p.bodyB;
    const rs = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y);
    if (rs < 2.2) continue;
    const sq = Math.min(0.34, 0.08 + rs * 0.028);
    if (A.def && !A.thrown) A.sq = Math.max(A.sq || 0, sq);
    if (B.def && !B.thrown) B.sq = Math.max(B.sq || 0, sq);
    if ((A.def || B.def) && !A.thrown && !B.thrown && rs > 3.4 && time - lastHitSfx > 0.09 && !held && state === 'play'){ // ドラッグ中・投げ捨て・結果演出中は接触音を鳴らさない
      lastHitSfx = time;
      const v = Math.min(1, rs / 11);
      feelKnock(v); // 着地は控えめな打楽器音
    }
  }
}
// 合体予告：つかんだ荷物と くっつく相手が近いと 両方光って 点線で結ばれる
function drawMergePreview(){
  if (!held || !held.body || held.body.dead || state !== 'play') return;
  const b = held.body, def = b.def;
  if (def.lv >= CFG.maxLv) return;
  let best = null, bd = Infinity;
  for (const o of items()){
    if (o === b || o.dead || o.thrown || o.spilled || !o.def) continue;
    if (o.def.kind !== def.kind || o.def.lv !== def.lv) continue;
    const d = Math.hypot(o.position.x - b.position.x, o.position.y - b.position.y);
    if (d < bd){ bd = d; best = o; }
  }
  if (!best) return;
  const rr = def.s + best.def.s, reach = rr * 2.3;
  if (bd > reach){ return; }
  const k = clamp(1 - (bd - rr) / (reach - rr), 0, 1); // 0=遠い 1=接触寸前
  const pulse = 0.75 + 0.25 * Math.sin(time * (6 + k * 10));
  for (const o of [b, best]){
    ctx.strokeStyle = `rgba(255,190,40,${(0.35 + 0.55 * k) * pulse})`;
    ctx.lineWidth = 2.5 + 2.5 * k;
    ctx.beginPath(); ctx.arc(o.position.x, o.position.y, o.def.s + 4 + 2 * Math.sin(time * 8), 0, 6.283); ctx.stroke();
  }
  ctx.save(); ctx.strokeStyle = `rgba(255,190,40,${0.5 * k})`; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(b.position.x, b.position.y); ctx.lineTo(best.position.x, best.position.y); ctx.stroke(); ctx.restore();
  if (k > 0.72 && previewPair !== best.id && time - lastBlipAt > 1.2){ previewPair = best.id; lastBlipAt = time; feelDroplet(1020, 0, 0.055, 0.1); } // 予兆音は つかみ直すまで相手ごとに1回＋1.2秒間隔

}
// 博士の顔バッジ（左上）。合体でにっこり＋音符、こぼしで虫めがね＋汗、残り5秒で前のめり
const PROF_BADGE = { x: 46, y: 158, r: 38 };
function drawProfBadge(){
  const B = PROF_BADGE;
  const mood = time < profMood.until ? profMood.kind : (state === 'play' && playLeft <= 5 && playLeft > 0 ? 'hurry' : 'idle');
  const shake = 0; // こぼしでも慌てない(震わせない)
  const popK = mood === 'merge' ? 1.12 : mood === 'hurry' ? 1.15 : 1;
  const bg = mood === 'merge' ? '#ffcf4d' : mood === 'spill' ? '#bfe0ff' : mood === 'hurry' ? '#ffb3a0' : '#fff8e6';
  ctx.save();
  ctx.beginPath(); ctx.arc(B.x + shake, B.y, B.r * popK, 0, 6.283); ctx.fillStyle = bg; ctx.fill(); ctx.clip();
  drawProf(B.x + shake, B.y + 62 * popK, 0.72 * popK, mood === 'hurry' ? time * 1.7 : time, mood === 'spill' ? 'peek' : 'point');
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = mood === 'merge' ? '#e08a00' : mood === 'spill' ? '#2a7fd2' : mood === 'hurry' ? '#d23c28' : 'rgba(59,42,34,.55)';
  ctx.lineWidth = mood === 'idle' ? 2.5 : 4;
  ctx.beginPath(); ctx.arc(B.x + shake, B.y, B.r * popK, 0, 6.283); ctx.stroke();
  ctx.restore();
}
function drawFeelNotes(){
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = feelNotes.length - 1; i >= 0; i--){
    const n = feelNotes[i], age = time - n.t0;
    if (age > n.life){ feelNotes.splice(i, 1); continue; }
    ctx.font = 'bold 24px sans-serif';
    const nx = n.x + n.vx * age, ny = n.y - 34 * age, al = 1 - age / n.life;
    ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255,255,255,${0.9 * al})`; ctx.strokeText(n.c, nx, ny);
    ctx.fillStyle = `rgba(255,138,0,${al})`; ctx.fillText(n.c, nx, ny);
  }
  ctx.restore();
}

// ===== 気持ちよさ試作・第2弾（フィーバー / きしみ / リング） =====
let feverOn = false, feverT0 = -9;
let bagFillK = 0, creakLatch = [false, false, false], creakShakeT = -9;
const feelRings = [];
function feelRing(x, y, col, r1){ if (!FEEL) return; feelRings.push({ x, y, t0: time, life: 0.5, col, r1 }); }
function drawFeelRings(){
  for (let i = feelRings.length - 1; i >= 0; i--){
    const r = feelRings[i], age = time - r.t0;
    if (age > r.life){ feelRings.splice(i, 1); continue; }
    const k = age / r.life, e = 1 - Math.pow(1 - k, 2);
    ctx.save();
    ctx.strokeStyle = `rgba(${r.col},${0.85 * (1 - k)})`; ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, 6 + r.r1 * e, 0, 6.283); ctx.stroke();
    ctx.restore();
  }
}
// 満杯度が 72% / 86% / 95% を超えた瞬間に「ギシッ」。下がったら再セット
function feelKnock(v){ // 着地音: 控えめな打楽器（短いノック）
  const f = 460 + Math.random() * 110;
  tone('sine', f, f * 0.72, 0.055, 0.02 + v * 0.05);
  noise('bandpass', f * 2.6, f * 2, 0.025, 0.008 + v * 0.014);
}
function feelDroplet(f0, delay, vol, dur){
  tone('sine', f0, f0 * 0.55, dur * 0.6, vol, delay);
  tone('sine', f0 * 2.4, f0 * 1.5, dur * 0.35, vol * 0.18, delay);
}
function feelDrumroll(){ // 高めのスネア: 「ダトトト」×4グループ（1打目だけ強く・高く、グループごとに少し速く・強く）
  let d = 0;
  for (let g = 0; g < 4; g++){
    for (let h = 0; h < 4; h++){
      const strong = h === 0;
      const j = 1 + (Math.random() * 2 - 1) * 0.03;
      const f = (strong ? 425 : 340) * j;
      const v = (strong ? 0.115 : 0.062) + g * 0.008;
      tone('sine', f, f * 0.84, 0.028, v, d);
      noise('bandpass', (strong ? 3600 : 3200) * j, 2700 * j, 0.02, v * 0.6, d); // 各打のタイミングで（以前は全部が先頭に重なって「ツッ」と鳴っていた）
      d += 0.072 - g * 0.006;
    }
  }
}
function feelTanOn(){ // 発表直前の単音（この後 静寂が入る）
  tone('sine', 660, 660, 0.13, 0.09);
  noise('bandpass', 3000, 2400, 0.03, 0.04);
}
function feelStack(f, delay, vol, decay){ // キラキラした倍音つきの音（じゃーん用・高音は控えめ）
  tone('sine', f, f, decay, vol, delay);
  tone('sine', f * 3.98, f * 3.98, decay * 0.7, vol * 0.25, delay);
  tone('sine', f * 9.24, f * 9.24, decay * 0.45, vol * 0.05, delay);
}

function feelJaaan(){ // 結果画面の「じゃーん」（派手め: 連続音→和音＋高音のきらめき）
  [523, 659, 784, 1047].forEach((fr, i) => feelStack(fr, i * 0.055, 0.068, 0.8));
  [523, 659, 784, 1047, 1319].forEach(fr => tone('triangle', fr, fr, 0.85, 0.04, 0.22));
  tone('sine', 1568, 1568, 0.6, 0.018, 0.22);
  tone('sine', 2093, 2093, 0.4, 0.009, 0.27); noise('highpass', 6200, 5200, 0.9, 0.013); // サンプル末尾のシンバルっぽい残響
}
function feelTutOk(){ tone('triangle', 1047, 1319, 0.08, 0.06); } // チュートリアルの成功: 簡易なひと音
function feelCountStart(){ // カウントダウン開始: 黄銅っぽさのある可愛い高い音
  tone('sine', 1568, 1568, 0.32, 0.075);
  tone('sine', 1568 * 3.98, 1568 * 3.98, 0.18, 0.02);
  tone('triangle', 1319, 1319, 0.2, 0.045);
}
function feelBubble(f0, delay, vol){
  tone('sine', f0, f0 * 2.1, 0.07, vol, delay);
  tone('sine', f0 * 1.7, f0 * 3.0, 0.05, vol * 0.5, delay + 0.02);
}
function feelCreak(){
  const stages = [0.72, 0.86, 0.95];
  for (let i = 0; i < stages.length; i++){
    if (!creakLatch[i] && bagFillK >= stages[i]){
      creakLatch[i] = true; creakShakeT = time;
      tone('sine', 175, 118, 0.3, 0.055 + i * 0.02); noise('bandpass', 480, 210, 0.28, 0.028 + i * 0.01); feelBubble(220, 0.16, 0.03);
    }
    if (bagFillK < stages[i] - 0.08) creakLatch[i] = false;
  }
}

// ===== 気持ちよさ試作・第3弾（博士のセリフ） =====
let profLine = { text: '', until: -9, t0: 0 };
let mergeSayAt = -9, throwSayAt = -9, spillSayAt = -9, nextMutterAt = 1e9;
function profSay(text, kind){ if (!FEEL) return; profLine = { text, kind: kind || '', until: time + (kind === 'big' ? 1.6 : kind === 'mutter' ? 1.5 : 0.95), t0: time }; }
function drawProfLine(){
  let text = null, pop = 1, kind = '';
  if (countT >= 0 && countT < 3) text = i18n('noRule'); // 始まる前だけ 長めのひとこと
  else if (time < profLine.until){ text = profLine.text; kind = profLine.kind; const age = time - profLine.t0; pop = age < 0.12 ? 0.5 + (age / 0.12) * 0.5 : 1; }
  if (!text) return;
  const B = PROF_BADGE, big = kind === 'big', mut = kind === 'mutter';
  ctx.save();
  let fsz = big ? 19 : mut ? 12 : 15; const padW = big ? 30 : 24, pk = big ? 1.1 : 1, x = B.x + B.r + 10;
  ctx.font = 'bold ' + fsz + 'px sans-serif';
  if (lang !== 'ja') while (fsz > 8 && (ctx.measureText(text).width + padW) * pk > W - x - 6){ fsz -= 0.5; ctx.font = 'bold ' + fsz + 'px sans-serif'; } // 英語は長いので 画面に収まるまで縮める
  const w = ctx.measureText(text).width + padW, h = big ? 46 : mut ? 26 : 34, cy = B.y;
  ctx.translate(x, cy); ctx.scale(pop * (big ? 1.1 : 1), pop * (big ? 1.1 : 1)); ctx.translate(-x, -cy);
  // v45：ほかの吹き出しと同じ描き方にそろえた（つぶやきは 半透明だと重なりが透けるので、少し沈んだ色の不透明にした）
  const tail = () => { ctx.beginPath(); ctx.moveTo(x + 4, cy - 5); ctx.lineTo(x - 7, cy + 2); ctx.lineTo(x + 4, cy + 9); ctx.closePath(); };
  bubbleShape(x, cy - h / 2, w, h, 12, tail, mut ? '#f7f2e6' : '#fffdf6', mut ? '#a08b74' : '#3b2a22');
  ctx.fillStyle = mut ? '#6b5a48' : '#3b2a22'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, cy + 1);
  ctx.restore();
}
function drawPiece(b){
  const def = b.def, lv = def.lv, isHeld = held && held.body === b, k = (1 + 0.18 * (b.pop || 0)) * (FEEL && isHeld ? 1.06 : 1), r = def.s * k;
  ctx.save(); ctx.translate(b.position.x, b.position.y);
  // Lv5 は後ろで光る(わくが進化する見せ方のとき)
  if (lvStyle !== 0 && lv >= 5){ ctx.save(); ctx.rotate(time * 1.5); ctx.fillStyle = 'rgba(255,230,120,.45)'; ctx.beginPath(); for (let i = 0; i < 8; i++){ ctx.moveTo(0, 0); ctx.arc(0, 0, r * 1.35, i / 8 * 6.283, i / 8 * 6.283 + 0.25); ctx.closePath(); } ctx.fill(); ctx.restore(); }
  ctx.rotate(b.angle);
  if (FEEL && b.sq) ctx.scale(1 + b.sq, 1 - b.sq * 0.75); // ぶつかった瞬間に ぷにっと潰れる
  const s = pieceSprite(def, isHeld);
  let h = s.half * k;
  if (b.thrown){ // 放り出した荷物は もう使わない: 色がぬけて白黒に、うすく、遠くへ飛んでいくように小さく
    const a = clamp((time - (b.thrownAt || time)) / 0.35, 0, 1);
    h *= 1 - 0.35 * a; ctx.globalAlpha = 1 - 0.45 * a; ctx.filter = `grayscale(${a}) brightness(${1 - 0.15 * a})`;
  }
  ctx.drawImage(s.c, -h, -h, h * 2, h * 2);
  ctx.restore();
}
// 出やすさ: 上に8種類を並べて、出やすい物ほど大きく・明るく
function drawFavor(){
  const sum = kindW.reduce((a, b) => a + b, 0), y = 98, gap = 38, x0 = W / 2 - gap * 3.5;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,253,240,.55)'; roundRect(x0 - 22, y - 20, gap * 7 + 44, 40, 14); ctx.fill();
  for (let k = 0; k < KINDS.length; k++){
    const share = kindW[k] / sum, x = x0 + k * gap, pop = kindPop[k];
    const up = (kindW[k] - 1) / CFG.favorMax, sz = 14 + 12 * up + pop * 6; // up: 0〜1
    ctx.globalAlpha = 0.45 + 0.55 * Math.min(1, up * 2 + 0.2);
    if (kindW[k] > 1.01){ ctx.fillStyle = 'rgba(255,200,60,.55)'; ctx.beginPath(); ctx.arc(x, y, sz * 0.62, 0, 6.283); ctx.fill(); }
    ctx.font = `${sz}px sans-serif`; ctx.fillStyle = '#000'; emojiText(ctx, KINDS[k].e, x, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(58,42,24,.25)'; ctx.fillRect(x - 13, y + 15, 26, 3);
    ctx.fillStyle = '#e07b3c'; ctx.fillRect(x - 13, y + 15, 26 * Math.min(1, share / 0.35), 3);
  }
  ctx.restore();
}
function drawStyleBtn(){
  const r = STYLE_BTN;
  ctx.fillStyle = 'rgba(40,30,20,.55)'; roundRect(r.x, r.y, r.w, r.h, r.h / 2); ctx.fill();
  ctx.fillStyle = '#fffbe8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Lvの見せ方: ' + LV_STYLES[lvStyle] + ' ▶', r.x + r.w / 2, r.y + r.h / 2 + 1);
}
function drawBagMix(front){
  const w = BAG.wall;
  // きしみ: 詰まるほど 壁が外へ膨らみ、あふれ寸前では 小刻みに震えて 赤みを帯びる
  const bk = clamp((bagFillK - 0.65) / 0.35, 0, 1), shiver = FEEL && time - creakShakeT < 0.3 ? Math.sin(time * 46) * 1.2 * (1 - (time - creakShakeT) / 0.3) : 0;
  const off = FEEL ? bk * bk * 3 + shiver : 0; // 膨らみは最大3px、震えは きしんだ瞬間の0.3秒だけ
  if (!front){
    ctx.strokeStyle = '#8a5f37'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(BAG.x0 + 40, BAG.rim); ctx.quadraticCurveTo(W / 2, BAG.rim - 80, BAG.x1 - 40, BAG.rim); ctx.stroke();
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(BAG.x0 - off, BAG.rim, BAG.x1 - BAG.x0 + off * 2, BAG.floor - BAG.rim);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = BAG.rim + 22; y < BAG.floor; y += 28) ctx.fillRect(BAG.x0 - off, y, BAG.x1 - BAG.x0 + off * 2, 2);
  } else {
    ctx.fillStyle = '#a8743f';
    ctx.fillRect(BAG.x0 - w - off, BAG.rim - 4, w, BAG.floor - BAG.rim + w + 4);
    ctx.fillRect(BAG.x1 + off, BAG.rim - 4, w, BAG.floor - BAG.rim + w + 4);
    ctx.fillRect(BAG.x0 - w - off, BAG.floor, BAG.x1 - BAG.x0 + w * 2 + off * 2, w);
    if (FEEL && bagFillK > 0.88){ ctx.fillStyle = `rgba(224,69,58,${(bagFillK - 0.88) * 0.9})`; ctx.fillRect(BAG.x0 - w - off, BAG.rim - 4, w, BAG.floor - BAG.rim + w + 4); ctx.fillRect(BAG.x1 + off, BAG.rim - 4, w, BAG.floor - BAG.rim + w + 4); }
    ctx.fillStyle = '#c48b4f'; ctx.fillRect(BAG.x0 - w - off, BAG.rim - 8, w + 4, 8); ctx.fillRect(BAG.x1 - 4 + off, BAG.rim - 8, w + 4, 8);
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,240,210,.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(BAG.x0 - off, BAG.rim); ctx.lineTo(BAG.x1 + off, BAG.rim); ctx.stroke(); ctx.setLineDash([]);
  }
}
// 画面まんなかの帯(カウントダウン・そこまで!)。荷物が透けて見えるように 少し薄め
const START_HOLD = 0.8; let startShownT = -99; // s 遊びはじめてから「スタート!」を残す時間
const BAND_Y = 330, BAND_H = 100;
function drawCenterBand(txt, size, t, alpha){
  const inK = 1 - Math.pow(1 - clamp(t / 0.18, 0, 1), 3), w = W * inK;
  ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = 'rgba(43,35,32,.58)'; ctx.fillRect(W / 2 - w / 2, BAND_Y - BAND_H / 2, w, BAND_H);
  ctx.fillStyle = 'rgba(255,210,58,.85)'; ctx.fillRect(W / 2 - w / 2, BAND_Y - BAND_H / 2, w, 4); ctx.fillRect(W / 2 - w / 2, BAND_Y + BAND_H / 2 - 4, w, 4);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${size}px sans-serif`; ctx.lineJoin = 'round';
  ctx.lineWidth = 10; ctx.strokeStyle = '#3b2a22'; ctx.strokeText(txt, W / 2, BAND_Y + 4);
  ctx.fillStyle = '#ffd23a'; ctx.fillText(txt, W / 2, BAND_Y + 4);
  ctx.restore();
}
function drawTimer(){
  const k = clamp(playLeft / CFG.playTime, 0, 1), sec = Math.ceil(playLeft), hurry = playLeft <= 5 && state === 'play';
  const col = k > 0.5 ? '#43a047' : k > 0.25 ? '#f2a516' : '#e0453a';
  const cx = W / 2, cy = TIMER_Y, gw = W - 24, half = gw / 2 * k, bh = 28;
  ctx.fillStyle = 'rgba(40,30,20,.22)'; roundRect(12, cy - bh / 2, gw, bh, bh / 2); ctx.fill();
  if (half > 1){ ctx.fillStyle = col; roundRect(cx - half, cy - bh / 2, half * 2, bh, bh / 2); ctx.fill(); }
  const pul = hurry ? 1 + 0.12 * Math.max(0, Math.sin(playLeft * Math.PI * 2)) : 1;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(pul, pul);
  ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.arc(0, 0, TIMER_R, 0, 6.283); ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,20,.12)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, TIMER_R - 6, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, TIMER_R - 6, -Math.PI / 2, -Math.PI / 2 + 6.283 * k); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = hurry ? '#e0453a' : '#2d3a28'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 42px sans-serif'; ctx.fillText(sec, 0, 3);
  ctx.restore();
}
function drawIntro(){
  ctx.fillStyle = 'rgba(25,18,10,.45)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,253,240,.97)'; roundRect(22, 150, W - 44, 330, 20); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3a2a18';
  ctx.font = 'bold 20px sans-serif'; ctx.fillText(i18n('introTitle'), W / 2, 182);
  const IT = i18n('introRows'), rows = [
    ['👆', ...IT[0]],
    [LV[0][1].e + '+' + LV[0][1].e, ...IT[1]],
    ['⤴️', ...IT[2]],
    ['⏱️', ...IT[3]],
  ];
  rows.forEach((r, i) => {
    const y = 232 + i * 56;
    ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(r[0], 70, y);
    ctx.textAlign = 'left'; ctx.fillStyle = '#3a2a18'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(r[1], 106, y - 10, W - 126);
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#6b5a48'; ctx.fillText(r[2], 106, y + 10, W - 126); ctx.fillStyle = '#3a2a18';
  });
  const a = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.textAlign = 'center'; ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = `rgba(224,90,40,${0.45 + 0.55 * a})`; ctx.fillText(i18n('introTap'), W / 2, 452);
}
function draw(){
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9bd3e8'); g.addColorStop(0.7, '#d9efc4'); g.addColorStop(1, '#b9d98f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (FEEL && feverOn && (state === 'play' || state === 'closing')){ const fk = clamp((time - feverT0) / 0.5, 0, 1); ctx.fillStyle = `rgba(255,110,30,${0.15 * fk})`; ctx.fillRect(0, 0, W, H); } // フィーバー中は画面全体が暖色に
  if (state === 'title'){ drawTitle(); return; }
  if (state === 'result'){ drawResult(); return; }
  const its = items();
  for (const b of its) if (b.thrown) drawPiece(b); // 放り出した荷物は バッグの奥を通って飛んでいく(降ってくる荷物と見分けやすく)
  drawBagMix(false);
  if (FEEL && state === 'play' && !tutActive()) drawProfBadge(); // 博士が左上で見守る(荷物より後ろ。練習中は練習用の博士と重なるので出さない)
  for (const b of its) if (!(held && held.body === b) && !b.thrown) drawPiece(b);
  drawBagMix(true);
  if (held && held.body && !held.body.dead) drawPiece(held.body);
  for (const p of parts){ ctx.fillStyle = `rgba(${p.c},${1 - p.t / p.life})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
  if (FEEL){ drawFeelRings(); drawFeelNotes(); if (state === 'play' && !tutActive()) drawProfLine(); }
  if (FEEL) drawMergePreview();
  // つかんでいる指の位置
  if (held){ ctx.strokeStyle = 'rgba(255,140,40,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(held.px, held.py, 16, 0, 6.283); ctx.stroke(); }
  if (!tutActive()) drawTimer();
  if (state === 'play' && countT >= 0) drawFavor();
  // （Lvの見せ方を切りかえる開発用ボタンは 消した）
  if (tutActive()) drawTutorial();
  if (state === 'play') drawSoundBtn();
  if (state === 'play' && countT >= 0 && countT < 3){
    const c = Math.ceil(3 - countT), k = countT % 1;
    drawCenterBand(c > 0 ? String(c) : i18n('go'), c > 0 ? 84 - k * 18 : 46, countT, 1);
  }
  // 「スタート!」は 遊びはじめてからも少し残して ふっと消す(ほかの数字と同じくらいの長さ見えるように)
  if (state === 'play' && countT >= 3 && time - startShownT < START_HOLD){ const u = time - startShownT; drawCenterBand(i18n('go'), 46, 1, u < START_HOLD - 0.3 ? 1 : (START_HOLD - u) / 0.3); }
  if (state === 'closing' && phaseT < 1.1) drawCenterBand(i18n('timeUp'), 46, phaseT, phaseT > 0.85 ? 1 - (phaseT - 0.85) / 0.25 : 1);
  if (FEEL && feverOn && state === 'play'){
    const age = time - feverT0;
    if (age < 1.4){ // 「ラスト5秒!」は 博士の横から 吹き出しピルで(視線の先にある位置)
      const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.4 : 1;
      ctx.save(); ctx.globalAlpha = age > 1.1 ? (1.4 - age) / 0.3 : 1;
      ctx.translate(PROF_BADGE.x + 46, PROF_BADGE.y); ctx.scale(pop, pop);
      ctx.fillStyle = '#e0453a'; roundRect(0, -20, 168, 40, 20); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i18n('last5'), 84, 2, 150); ctx.restore();
    }
    ctx.save(); ctx.strokeStyle = `rgba(255,176,0,${0.35 + 0.2 * Math.sin(time * 6)})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8); ctx.restore();
  }
  if (state === 'closing'){
    const k = clamp((phaseT - 0.6) / 0.45, 0, 1), e = 1 - Math.pow(1 - k, 3);
    // 博士は左下から 大きめに のぞきこむ
    const px = lerp(-130, 62, e), py = lerp(H + 80, 548, e), ps = 1.05, rot = 0.35;
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
    drawProf(0, 0, ps, time, 'peek'); ctx.restore();
    if (k >= 1) bubble(112, 318, 230, i18n('closingSay'), 16, profTail(px, py, ps, time, rot));
  }
  if (state === 'reveal'){
    ctx.fillStyle = 'rgba(255,253,240,.75)'; ctx.fillRect(0, 0, W, H);
    drawProf(W / 2, 470, 1.4, time, 'point');
    const k = Math.min(1, phaseT / 0.18), sc = 0.4 + 0.6 * k + Math.sin(Math.min(1, phaseT / 0.35) * Math.PI) * 0.15;
    const ry = lang === 'ja' ? 170 : EN_LOGO.reveal.y, rs = lang === 'ja' ? 46 : EN_LOGO.reveal.size;
    ctx.save(); ctx.translate(W / 2, ry); ctx.scale(sc, sc); ctx.translate(-W / 2, -ry);
    drawLogo(ry, rs, undefined, undefined, 'reveal');
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of texts){
    const kk = t.t / 1.1, pop = t.t < 0.1 ? 0.7 + 3 * t.t : 1;
    ctx.font = `bold ${t.size * pop}px sans-serif`; ctx.lineWidth = 4; ctx.strokeStyle = `rgba(80,40,10,${0.6 * (1 - kk)})`;
    ctx.strokeText(t.text, t.x, t.y - 20 * kk); ctx.fillStyle = `rgba(${t.col},${1 - kk * kk})`; ctx.fillText(t.text, t.x, t.y - 20 * kk);
  }
}
const LOGO_FONT = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Noto Sans CJK JP','Yu Gothic','Meiryo',sans-serif";
const logoFont = px => `900 ${px}px ${LOGO_FONT}`;
const LOGO_COL = {
  red:   ['#ff7a45', '#e3262b'],   // ワシ / 決めた
  gold:  ['#fff27a', '#ffb000'],   // が・じゃ・! (つなぎの字と記号)
};
// 濁点つきの字: [清音, 濁点2つの位置(字の大きさ比)]  フォントの濁点は太いフチで潰れるので自前で描く
const LOGO_DK = { 'が': ['か', [[0.42, -0.55], [0.6, -0.49]]], 'じ': ['し', [[0.26, -0.52], [0.45, -0.46]]] };
const DOT_W = 0.14; // 濁点の太さ (字の大きさ比)
// 文字ごとの濁点調整 g.dk = {dx, dy, s, r} を反映した 濁点2本の線分 [x0,y0,x1,y1] (字の大きさ比)
function dkTransform(g){
  const base = LOGO_DK[g.ch][1], k = g.dk || {}, s = k.s || 1, r = k.r || 0, cs = Math.cos(r), sn = Math.sin(r);
  const segs = base.map(d => [d[0], d[1], d[0] + 0.06, d[1] + 0.14]);
  let cx = 0, cy = 0; segs.forEach(q => { cx += (q[0] + q[2]) / 4; cy += (q[1] + q[3]) / 4; });
  const tf = (x, y) => { const ux = (x - cx) * s, uy = (y - cy) * s; return [cx + (k.dx || 0) + ux * cs - uy * sn, cy + (k.dy || 0) + ux * sn + uy * cs]; };
  return { s, cx: cx + (k.dx || 0), cy: cy + (k.dy || 0), dots: segs.map(q => [...tf(q[0], q[1]), ...tf(q[2], q[3])]) };
}
// ロゴの配置データ
// 文字ごと: s=大きさ倍率 / c=色 / r=回転(ラジアン) / dx,dy=ずれ(ロゴの大きさ比)
const LOGO_DEFAULT = {
  layout: 'one',              // 'one'=1行 / 'two'=2段
  rot: -0.06,                 // ロゴ全体の傾き
  lineGap: 1.1,               // 行間 (2段のときだけ)
  lineX: [-0.5, 0.45],        // 1段目・2段目の横ずれ (2段のときだけ)
  titleY: 58, titleSize: 48,  // タイトル画面での位置と大きさ
  lines: [
    [{ ch: 'ワ', s: 1.46, c: 'red', r: -0.14, dx: -0.11, dy: -0.33 }, { ch: 'シ', s: 1.28, c: 'red', r: -0.07, dx: -0.11, dy: -0.15 }, { ch: 'が', s: 0.72, c: 'gold', r: 0.16, dx: -0.26, dy: 0.27, dk: { dx: -0.02, dy: 0.14, s: 1, r: 0 } }],
    [{ ch: '決', s: 1.25, c: 'red', r: -0.08, dx: -0.26, dy: -0.14 }, { ch: 'め', s: 0.92, c: 'red', r: 0.09, dx: -0.15, dy: 0.02 }, { ch: 'た', s: 1.02, c: 'red', r: -0.05, dx: -0.15, dy: 0.15 }, { ch: '!', s: 1.4, c: 'gold', r: 0.22, dx: 0, dy: 0.3 }],
  ],
};
const LOGO = LOGO_DEFAULT;
// 一度も触らなかった(トーシロ博士)ときのロゴ「ワシじゃ!」 (調整モックで作って ここに貼る)
const LOGO_JA = {
  y: 72, size: 40,  // 位置と大きさ
  glyphs: [
    { ch: 'ワ', s: 1.84, c: 'red', r: -0.14, dx: 0, dy: 0.04 },
    { ch: 'シ', s: 1.75, c: 'red', r: 0.06, dx: 0, dy: 0.37 },
    { ch: 'じ', s: 1.63, c: 'gold', r: 0.175, dx: 0.19, dy: 0.28, dk: { dx: 0, dy: 0, s: 1, r: 0 } },
    { ch: 'ゃ', s: 1.5, c: 'gold', r: 0.148, dx: -0.09, dy: 0.51 },
    { ch: '!', s: 2.2, c: 'gold', r: 0.332, dx: 0.12, dy: 0.49 },
  ],
};
function logoSpec(text, oneLine){
  if (lang !== 'ja') return logoSpecEn(text, oneLine);
  if (text === 'special') return [LOGO_JA.glyphs];
  return oneLine ? [LOGO.lines[0].concat(LOGO.lines[1])] : LOGO.lines;
}
// 英語のロゴ: 日本語ロゴ(文字ごとに大きさ・色・傾きを変えた手描き風)と同じ仕組みで、英字を1文字ずつ組む
// 数値は dev/logo_tool_en.html で目で見ながら調整して、「設定をコピー」したものをここに貼り直す
//   title / result / special / reveal = タイトル画面 / 結果画面の1行ロゴ / 博士本人の特殊結果 "It's ME!" / 結果発表のロゴ
//     y=中心の高さ  size=文字サイズ  rot=ロゴ全体の傾き(ラジアン)  track=字送り(文字幅にかける倍率。小さいほど詰まる)
//     fit=画面の左右に残す余白の合計(これより長いと縮める)  lineGap=行間  lineX=1段目・2段目の横ずれ(2段のときだけ)
//   subtitle = タイトル画面の副題(y=文字の高さ size=文字サイズ maxW=最大幅 pillY/pillW/pillH=白い台紙の位置と大きさ)
//   spaceS=単語の間の空白の大きさ  bob=ふわふわ動く量  jit=1文字ごとの自動のばらつき(s=大きさ r=傾き y=上下)
//   words=[文字列, 大きさ倍率, 色, 乱数の種]  bang=「!」(s=大きさ r=傾き dx,dy=ずれ)
//   chars=文字ごとの微調整  キー 'm0.3' = main の1段目の3文字目 / 's0.2' = special の2文字目  値 {s=大きさ(倍率) r,dx,dy=足す量}
const EN_LOGO = {
  title: { y: 54, size: 36, rot: -0.06, track: 0.9, fit: 30, lineGap: 1.1, lineX: [-0.5, 0.45] },
  result: { y: 34, size: 30, rot: -0.06, track: 0.9, fit: 30, lineGap: 1.1, lineX: [-0.5, 0.45] },
  special: { y: 72, size: 40, rot: -0.06, track: 0.9, fit: 30, lineGap: 1.1, lineX: [-0.5, 0.45] },
  reveal: { y: 170, size: 46, rot: -0.06, track: 0.9, fit: 30, lineGap: 1.1, lineX: [-0.5, 0.45] },
  subtitle: { y: 124, size: 13, maxW: 236, pillY: 124.5, pillW: 250, pillH: 30 },
  spaceS: 0.55,
  bob: 0.025,
  jit: { s: 0.07, r: 0.04, y: 0.05 },
  words: {
    main: [
      [['I', 1.1, 'red', 0], ['Choose', 1.35, 'red', 1]],
      [['For', 0.9, 'gold', 2], ['You', 1.45, 'red', 3]]
    ],
    special: [[["It's", 1.15, 'gold', 0], ['ME', 1.9, 'red', 1]]]
  },
  bang: { main: { s: 1.5, r: 0.3, dx: 0.05, dy: 0.12 }, special: { s: 2.1, r: 0.3, dx: 0.05, dy: 0.3 } },
  chars: {
    's0.0': { s: 1.21, r: -0.005, dx: -0.275, dy: 0 },
    's0.1': { s: 1, r: 0, dx: -0.145, dy: 0 },
    's0.2': { s: 1, r: 0, dx: -0.16, dy: 0 },
    's0.3': { s: 1, r: 0.18, dx: -0.195, dy: 0 },
    'm0.0': { s: 1.73, r: 0.065, dx: -0.86, dy: 0 },
    'm0.2': { s: 1.13, r: 0, dx: -0.415, dy: -0.155 },
    'm0.3': { s: 1, r: -0.115, dx: -0.33, dy: 0.1 },
    'm0.4': { s: 1, r: 0, dx: -0.265, dy: 0 },
    'm0.5': { s: 0.84, r: 0, dx: -0.285, dy: 0.18 },
    'm0.6': { s: 1, r: 0, dx: -0.295, dy: -0.11 },
    'm0.7': { s: 1, r: -0.1, dx: -0.285, dy: 0.075 },
    'm1.0': { s: 1.23, r: -0.165, dx: 0.155, dy: 0.18 },
    'm1.1': { s: 1, r: 0, dx: 0.18, dy: 0.38 },
    'm1.2': { s: 1, r: -0.115, dx: 0.225, dy: 0.285 },
    'm1.4': { s: 1.13, r: -0.05, dx: 0.58, dy: 0.18 },
    'm1.5': { s: 0.9, r: -0.03, dx: 0.51, dy: 0.44 },
    'm1.6': { s: 0.97, r: 0.08, dx: 0.57, dy: 0.33 },
    'm1.7': { s: 1.2, r: 0, dx: 1, dy: 0.155 }
  }
};
function enGlyphs(word, sc, c, seed){
  const J = EN_LOGO.jit;
  return [...word].map((ch, i) => { const q = i + seed; return { ch, s: sc * (1 + J.s * ((q * 5) % 3 - 1)), c, r: ((q * 7) % 5 - 2) * J.r, dx: 0, dy: ((q * 3) % 4 - 1.5) * J.y }; });
}
// 1行ぶんの文字を組む(単語のあいだに空白、最後に「!」があれば足す)。文字ごとの微調整(chars)もここで反映
function enLine(words, bg, pre){
  const sp = () => ({ ch: ' ', s: EN_LOGO.spaceS, c: 'gold', r: 0, dx: 0, dy: 0 });
  const ln = [];
  words.forEach((w, i) => { if (i) ln.push(sp()); ln.push(...enGlyphs(w[0], w[1], w[2], w[3])); });
  if (bg) ln.push({ ch: '!', s: bg.s, c: 'gold', r: bg.r, dx: bg.dx, dy: bg.dy });
  ln.forEach((g, i) => { const a = EN_LOGO.chars[pre + '.' + i]; if (a){ g.s *= (a.s === undefined ? 1 : a.s); g.r += a.r || 0; g.dx += a.dx || 0; g.dy += a.dy || 0; } });
  return ln;
}
function logoSpecEn(text, oneLine){
  const E = EN_LOGO;
  if (text === 'special') return [enLine(E.words.special[0], E.bang.special, 's0')];
  const l0 = enLine(E.words.main[0], null, 'm0'), l1 = enLine(E.words.main[1], E.bang.main, 'm1');
  return oneLine ? [l0.concat([{ ch: ' ', s: E.spaceS, c: 'gold', r: 0, dx: 0, dy: 0 }], l1)] : [l0, l1];
}
function drawLogo(y, size, text, oneLine, scene){
  if (lang === 'ja') oneLine = oneLine || (!text && LOGO.layout === 'one');
  const lines = logoSpec(text || 'main', oneLine);
  const E = lang === 'ja' ? null : EN_LOGO[scene || (text === 'special' ? 'special' : oneLine ? 'result' : 'title')]; // 英語のときの設定
  const lgap = E ? E.lineGap : LOGO.lineGap, lx = E ? E.lineX : LOGO.lineX, tr = E ? E.track : 0.9;
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(E ? E.rot : LOGO.rot);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const gl = [], lh = size * lgap;
  lines.forEach((ln, li) => {
    // 濁点つきの字は 濁点が右にはみ出す分だけ幅を足す (隣の字に隠れないように)
    const ext = ln.map(g => LOGO_DK[g.ch] ? size * g.s * 0.22 : 0);
    const ws = ln.map((g, i) => { ctx.font = logoFont(size * g.s); return ctx.measureText(g.ch).width * tr + ext[i]; });
    let x = -ws.reduce((a, b) => a + b, 0) / 2 + (lines.length > 1 ? lx[li] * size : 0);
    const ly = (li - (lines.length - 1) / 2) * lh;
    ln.forEach((g, i) => {
      const n = gl.length, bob = Math.sin(time * 4 + n * 0.9) * size * (E ? EN_LOGO.bob : 0.025);
      const bw = (ws[i] - ext[i]) / tr; // 字本体の見た目の幅
      gl.push({ ...g, x: x + (ws[i] - ext[i]) / 2 + (g.dx || 0) * size, y: ly + g.dy * size + bob, fs: size * g.s, bw, ext: ext[i] });
      x += ws[i];
    });
  });
  // 文字を詰めたり動かしたりしても ロゴ全体の見た目の左右の端が画面中央にそろうように寄せ直す
  let minX = 1e9, maxX = -1e9;
  gl.forEach(g => { minX = Math.min(minX, g.x - g.bw / 2); maxX = Math.max(maxX, g.x + g.bw / 2 + g.ext); });
  const shiftX = -(minX + maxX) / 2;
  gl.forEach(g => g.x += shiftX);
  if (lang !== 'ja'){ const span = maxX - minX, lim = W - E.fit; if (span > lim){ const k = lim / span; ctx.scale(k, k); } } // 英語は長いので 画面の幅に収まるまで縮める
  // 全文字まとめて 影 → 白フチ → こげ茶フチ → 塗り の順に重ねる (フチ同士がつながる)
  const pass = (fn) => gl.forEach(g => { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.r); ctx.font = logoFont(g.fs); fn(g); ctx.restore(); });
  // 濁点つきの字は 清音+自前の濁点で描く (濁点は個別に位置・大きさ・角度を調整できる)
  const shape = (g, lw, mode) => { // mode: 'stroke' | 'fill'
    const dk = LOGO_DK[g.ch], ch = dk ? dk[0] : g.ch;
    if (mode === 'stroke'){ ctx.lineWidth = lw * g.fs; ctx.strokeText(ch, 0, 0); } else ctx.fillText(ch, 0, 0);
    if (dk){
      const t = dkTransform(g);
      ctx.lineCap = 'round'; ctx.lineWidth = (DOT_W * t.s + (mode === 'stroke' ? lw : 0)) * g.fs;
      if (mode === 'fill') ctx.strokeStyle = ctx.fillStyle;
      for (const d of t.dots){ ctx.beginPath(); ctx.moveTo(d[0] * g.fs, d[1] * g.fs); ctx.lineTo(d[2] * g.fs, d[3] * g.fs); ctx.stroke(); }
    }
  };
  pass(g => { ctx.translate(size * 0.05, size * 0.09); ctx.strokeStyle = 'rgba(59,42,34,.45)'; shape(g, 0.36, 'stroke'); });
  pass(g => { ctx.strokeStyle = '#fffdf3'; shape(g, 0.36, 'stroke'); });
  pass(g => { ctx.strokeStyle = '#3b2a22'; shape(g, 0.17, 'stroke'); });
  pass(g => {
    const c = LOGO_COL[g.c], gr = ctx.createLinearGradient(0, -g.fs * 0.45, 0, g.fs * 0.45);
    gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
    ctx.fillStyle = gr; shape(g, 0, 'fill');
  });
  ctx.restore();
}
// タイトルのショーケース: 舞台にイキモンが次々登場（シルエット → ピカッと色がつく → 名前）→ 下の列へ ぴょんと仲間入り
const SHOW = { cur: null, t0: 0, sent: false, row: [], hops: [], sparks: [], off: null };
// 舞台（まんなか）と、背景いっぱいの「図鑑の壁」（カードのマス目がゆっくり斜め上へ流れる）
// 1回の登場で ちょうど1段ぶん流れる（vy = 段の高さ / 登場の間隔）ので、毎回 1段ずつ 空きマスが埋まっていく
const SHOW_P = 3.4, STAGE = { x: 180, y: 345, R: 58 }, WALL = { cw: 68, ch: 76, vx: 8, vy: 76 / 3.4, R: 19, zoneY: 500, t0: null };
const wallCells = new Map(), wallFilled = new Set();
// 種族と色の段階は「1組ぶん まとめて決めて並べかえる袋」から順に取り出す（8種族で1組、色は4段階で1組）。
// 組の切れ目でも 前と同じにならないよう、新しい組の先頭が前の最後と同じなら入れかえる
function makeBag(items){
  let bag = [], last = null;
  return () => {
    if (!bag.length){
      bag = items.slice();
      for (let i = bag.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1] === last){ const j = Math.floor(Math.random() * (bag.length - 1)); [bag[bag.length - 1], bag[j]] = [bag[j], bag[bag.length - 1]]; }
    }
    return last = bag.pop();
  };
}
const SHOW_BAGS = { stage: null, wall: null };
function newShowMon(kind){
  kind = kind || 'stage';
  const B = SHOW_BAGS[kind] || (SHOW_BAGS[kind] = { sp: makeBag(Object.keys(SPECIES)), tier: makeBag([0, 1, 2, 3]), lastShiny: false });
  const a2 = [0.1, 0.35, 0.65, 0.9][B.tier()];
  const shiny = !B.lastShiny && Math.random() < 0.08; B.lastShiny = shiny;
  return { sp: B.sp(), ax: [Math.random(), Math.random(), a2, Math.random()], shiny, ph: Math.random() * 6 };
}
const easeBack = k => { const c = 1.9; k -= 1; return 1 + (c + 1) * k * k * k + c * k * k; };
// 舞台うしろの丸い台紙（動物ごとの色）＋回る白い光線＋白いふち。shiny は金色
const stageRayCache = new Map();
function stageRayImgs(r, shiny, hue){
  const k = Math.max(1, cv.width / W), key = (shiny ? 'g' : hue) + '|' + r + '|' + k;
  let e = stageRayCache.get(key);
  if (e) return e;
  const mk = draw => { const c = document.createElement('canvas'); c.width = c.height = Math.ceil((r + 4) * 2 * k); const o = c.getContext('2d'); o.setTransform(k, 0, 0, k, (r + 4) * k, (r + 4) * k); draw(o); return c; };
  const disc = mk(o => {
    const bg = o.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r);
    if (shiny){ bg.addColorStop(0, '#fff4b8'); bg.addColorStop(1, '#f2b632'); } else { bg.addColorStop(0, `hsl(${hue},85%,92%)`); bg.addColorStop(1, `hsl(${hue},65%,74%)`); }
    o.fillStyle = bg; o.beginPath(); o.arc(0, 0, r, 0, 6.283); o.fill();
  });
  const rays = mk(o => { o.beginPath(); o.arc(0, 0, r, 0, 6.283); o.clip(); o.fillStyle = shiny ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.4)'; for (let i = 0; i < 12; i++){ o.beginPath(); o.moveTo(0, 0); o.arc(0, 0, r, i / 12 * 6.283, (i + 0.5) / 12 * 6.283); o.closePath(); o.fill(); } });
  const ring = mk(o => { o.lineWidth = 4; o.strokeStyle = '#fffdf6'; o.beginPath(); o.arc(0, 0, r - 2, 0, 6.283); o.stroke(); o.lineWidth = 2; o.strokeStyle = 'rgba(59,42,34,.35)'; o.beginPath(); o.arc(0, 0, r + 1, 0, 6.283); o.stroke(); });
  if (stageRayCache.size > 40) stageRayCache.clear();
  e = { disc, rays, ring, half: r + 4 }; stageRayCache.set(key, e); return e;
}
function stageRays(x, y, r, a, shiny, hue){
  if (a <= 0) return;
  if (!stageRays.legacy){ // 絵を使い回す版（軽い）
    const e = stageRayImgs(r, shiny, hue), sc = 0.6 + 0.4 * a, hf = e.half;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.drawImage(e.disc, -hf, -hf, hf * 2, hf * 2);
    ctx.save(); ctx.rotate(time * 0.5); ctx.drawImage(e.rays, -hf, -hf, hf * 2, hf * 2); ctx.restore();
    ctx.drawImage(e.ring, -hf, -hf, hf * 2, hf * 2);
    ctx.restore(); return;
  }
  const sc = 0.6 + 0.4 * a; // 出るときは ふわっと広がる
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(sc, sc);
  const bg = ctx.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r);
  if (shiny){ bg.addColorStop(0, '#fff4b8'); bg.addColorStop(1, '#f2b632'); }
  else { bg.addColorStop(0, `hsl(${hue},85%,92%)`); bg.addColorStop(1, `hsl(${hue},65%,74%)`); }
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
  ctx.save(); ctx.clip(); ctx.rotate(time * 0.5); ctx.fillStyle = shiny ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.4)';
  for (let i = 0; i < 12; i++){ ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i / 12 * 6.283, (i + 0.5) / 12 * 6.283); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = '#fffdf6'; ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, 6.283); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(59,42,34,.35)'; ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, 6.283); ctx.stroke();
  ctx.restore();
}
// シルエット（黒くぬりつぶしたイキモン）。別のキャンバスに描いてから 黒で塗りかえる
function drawSilhouette(m, x, y, R, sc){
  const S = 220, k = 2;
  if (!SHOW.off){ SHOW.off = document.createElement('canvas'); SHOW.off.width = S * k; SHOW.off.height = S * k; }
  const o = SHOW.off.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, S * k, S * k);
  o.setTransform(k, 0, 0, k, 0, 0); drawCreature(o, m.sp, S / 2, S / 2, R, m.ax, false, time + m.ph);
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-in'; o.fillStyle = '#2b2320'; o.fillRect(0, 0, S * k, S * k);
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.drawImage(SHOW.off, -S / 2, -S / 2, S, S); ctx.restore();
}
function nameRibbon(x, y, text, a, shiny){
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.font = 'bold 19px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.min(W - 12, ctx.measureText(text).width + 36), cx = clamp(x, w / 2 + 6, W - w / 2 - 6), dy = (1 - a) * 8;
  ctx.fillStyle = shiny ? '#b8860b' : '#3b2a22'; roundRect(cx - w / 2, y - 20 + dy, w, 40, 20); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = shiny ? '#fff3b0' : '#fffdf6'; roundRect(cx - w / 2 + 3, y - 17 + dy, w - 6, 34, 17); ctx.stroke();
  ctx.fillStyle = shiny ? '#fff3b0' : '#fffdf6'; fitText(text, w - 26, 19, 'bold'); ctx.fillText(text, cx, y + 1 + dy);
  ctx.restore();
}
// 図鑑の壁：マス (c, r) ごとに 1枚のカード。イキモンは 1回だけ別のキャンバスに描いて絵にしておき、
// 薄くするときは その絵ごと薄くする（パーツごとに透けない）
const wallHash = (c, r) => { let h = (c * 73856093) ^ (r * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// カード1枚（紙・ふち・番号・イキモン）を まとめて1枚の絵にしておく（毎フレームは drawImage 1回だけ。古いスマホでも軽く）
function wallCardImg(m){
  const no = dexNo(m.sp, m.ax, m.shiny);
  const k = 2, cv = document.createElement('canvas'); cv.width = WALL.cw * k; cv.height = WALL.ch * k;
  const o = cv.getContext('2d'); o.setTransform(k, 0, 0, k, 0, 0);
  const x = 4, y = 4, w = WALL.cw - 8, h = WALL.ch - 8;
  o.beginPath(); o.roundRect(x, y, w, h, 9); o.fillStyle = m.shiny ? '#fff3c4' : '#fffdf6'; o.fill();
  o.strokeStyle = m.shiny ? '#d9a21b' : 'rgba(59,42,34,.45)'; o.lineWidth = 1.5; o.stroke();
  drawCreature(o, m.sp, WALL.cw / 2, WALL.ch / 2 - 4, WALL.R, m.ax, m.shiny, 0.6 + m.ph);
  o.fillStyle = 'rgba(59,42,34,.6)'; o.font = 'bold 8px sans-serif'; o.textAlign = 'center'; o.textBaseline = 'middle';
  o.fillText('No.' + String(no).padStart(3, '0'), x + w / 2, y + h - 6);
  return cv;
}
let wallEmptyImg = null; // まだ見つかっていないマス（? の点線カード）も 1枚の絵を使い回す
function wallEmpty(){
  if (wallEmptyImg) return wallEmptyImg;
  const k = 2, cv = document.createElement('canvas'); cv.width = WALL.cw * k; cv.height = WALL.ch * k;
  const o = cv.getContext('2d'); o.setTransform(k, 0, 0, k, 0, 0);
  const x = 4, y = 4, w = WALL.cw - 8, h = WALL.ch - 8;
  o.setLineDash([4, 3]); o.strokeStyle = 'rgba(59,42,34,.4)'; o.lineWidth = 1.5; o.beginPath(); o.roundRect(x, y, w, h, 9); o.stroke(); o.setLineDash([]);
  o.fillStyle = 'rgba(59,42,34,.3)'; o.font = 'bold 20px sans-serif'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('?', x + w / 2, y + h / 2);
  return wallEmptyImg = cv;
}
// 壁の流れ：タイトルを開いた時から数える
const wallT = () => { if (WALL.t0 === null) WALL.t0 = time; return time - WALL.t0; };
const wallScroll = () => ({ sx: wallT() * WALL.vx, sy: wallT() * WALL.vy });
const wallPos = (c, r, sc) => ({ x: c * WALL.cw + (r & 1 ? WALL.cw / 2 : 0) - sc.sx, y: r * WALL.ch - sc.sy });
// 段 r が 登録ゾーン（zoneY）に来る時刻。開いた時点で もう通りすぎた段（画面の上半分）は ぜんぶ埋まっている
const wallRowT = r => (r * WALL.ch + WALL.ch / 2 - WALL.zoneY) / WALL.vy;
const wallHasGap = r => wallRowT(r) > 0;
// 空きマスは 1段に1つ。その段が登録ゾーンに来たとき 画面の中ほど（左右はばらばら）に来る列にする
function wallGapCol(r){
  const xt = 80 + 200 * wallHash(r, 11), sx = WALL.vx * wallRowT(r);
  return Math.round((xt + sx - (r & 1 ? WALL.cw / 2 : 0) - WALL.cw / 2) / WALL.cw);
}
function wallCell(c, r){
  const key = c + ',' + r;
  let cell = wallCells.get(key);
  if (!cell){
    cell = { m: null, img: null, isNew: 0 };
    if (!(wallHasGap(r) && !wallFilled.has(r) && c === wallGapCol(r))){ cell.m = newShowMon('wall'); cell.img = wallCardImg(cell.m); }
    wallCells.set(key, cell);
  }
  return cell;
}
function drawWall(){
  const sc = wallScroll(), r0 = Math.floor(sc.sy / WALL.ch) - 1, r1 = Math.ceil((sc.sy + H) / WALL.ch);
  for (let r = r0; r <= r1; r++){
    const c0 = Math.floor((sc.sx - WALL.cw) / WALL.cw) - 1, c1 = Math.ceil((sc.sx + W) / WALL.cw);
    for (let c = c0; c <= c1; c++){
      const p = wallPos(c, r, sc), x = p.x + 4, y = p.y + 4, w = WALL.cw - 8, h = WALL.ch - 8;
      if (x > W || x + w < 0 || y > H || y + h < 0) continue;
      const cell = wallCell(c, r), fade = clamp((y + h / 2 - 40) / 140, 0.18, 0.62); // 上のほう（ロゴのうしろ）は うすく
      ctx.globalAlpha = fade; ctx.drawImage(cell.m ? cell.img : wallEmpty(), p.x, p.y, WALL.cw, WALL.ch); ctx.globalAlpha = 1;
      if (cell.isNew > 0){ // 登録したて：ピカッと光って「NEW!」
        cell.isNew -= 1 / 60;
        const a = Math.min(1, cell.isNew);
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 3; roundRect(x - 1, y - 1, w + 2, h + 2, 10); ctx.stroke();
        ctx.fillStyle = '#e0453a'; roundRect(x + w - 30, y - 7, 34, 15, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NEW!', x + w - 13, y + 1); ctx.restore();
      }
    }
  }
  if (wallCells.size > 400){ for (const key of wallCells.keys()){ const [c, r] = key.split(',').map(Number); if (r < r0 - 2 || c < Math.floor(sc.sx / WALL.cw) - 3) wallCells.delete(key); } }
}
// 舞台の子を登録する マス：まだ埋まっていない段のうち いちばん上（でも画面の中）の空きマス
function pickWallTarget(){
  const sc = wallScroll(), lead = 0.6, sc2 = { sx: sc.sx + WALL.vx * lead, sy: sc.sy + WALL.vy * lead };
  for (let r = Math.floor((sc2.sy + 150) / WALL.ch); r <= Math.floor((sc2.sy + H + WALL.ch) / WALL.ch); r++){
    if (!wallHasGap(r) || wallFilled.has(r)) continue;
    const c = wallGapCol(r), p = wallPos(c, r, sc2);
    if (p.y + WALL.ch / 2 > H + 40) break; // まだ画面の下
    return { c, r };
  }
  return null;
}
function drawShowcase(){
  const S = SHOW;
  const dt = Math.min(0.05, Math.max(0, time - (drawShowcase.lt || time))); drawShowcase.lt = time;
  if (!S.cur){ S.cur = newShowMon(); S.t0 = time; S.sent = false; }
  let u = time - S.t0;
  if (u >= SHOW_P){ S.cur = newShowMon(); S.t0 = time; S.sent = false; u = 0; }
  const m = S.cur;
  // 舞台：台紙 → シルエットがポンと出る → ピカッと色がつく → 名前 → 図鑑のマスへ飛んで登録
  const leaveAt = SHOW_P - 0.55, k = 0.45;
  const rayA = u < k ? u / k : u > leaveAt ? Math.max(0, 1 - (u - leaveAt) / 0.35) : 1;
  stageRays(STAGE.x, STAGE.y - 4, 84, rayA, m.shiny && u > k, SPECIES[m.sp].vh ?? SPECIES[m.sp].h);
  let nameA = 0;
  if (u < k){ drawSilhouette(m, STAGE.x, STAGE.y, STAGE.R, Math.max(0.01, easeBack(u / k))); }
  else if (!S.sent){
    const pop = u < k + 0.25 ? 1 + 0.1 * Math.sin((u - k) / 0.25 * Math.PI) : 1;
    ctx.save(); ctx.translate(STAGE.x, STAGE.y); ctx.scale(pop, pop); drawCreature(ctx, m.sp, 0, 0, STAGE.R, m.ax, m.shiny, time + m.ph); ctx.restore();
    if (u < k + 0.3){ ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - (u - k) / 0.3)})`; ctx.beginPath(); ctx.arc(STAGE.x, STAGE.y, 76, 0, 6.283); ctx.fill(); } // ピカッ
    if (!S.burst){ S.burst = true; for (let i = 0; i < 16; i++){ const a = i / 16 * 6.283 + Math.random() * 0.3; S.sparks.push({ x: STAGE.x, y: STAGE.y, vx: Math.cos(a) * (100 + Math.random() * 80), vy: Math.sin(a) * (100 + Math.random() * 80) - 30, t: 0, gold: m.shiny }); } }
    nameA = clamp((u - k - 0.15) / 0.25, 0, 1) * (u > leaveAt - 0.15 ? Math.max(0, 1 - (u - leaveAt + 0.15) / 0.15) : 1);
    if (m.shiny) S.badgeA = clamp((u - k - 0.1) / 0.4, 0, 1) * (u > leaveAt - 0.15 ? Math.max(0, 1 - (u - leaveAt + 0.15) / 0.15) : 1);
    if (u >= leaveAt){ S.sent = true; S.burst = false; const tg = pickWallTarget(); if (tg){ wallFilled.add(tg.r); S.hops.push({ m, t: 0, c: tg.c, r: tg.r }); } }
  }
  // 舞台 → 図鑑のマス へ（弧をえがいて小さくなりながら、流れていくマスを追いかける）
  for (const h of S.hops){
    h.t += dt / 0.6; const kk = Math.min(1, h.t), e = kk * kk * (3 - 2 * kk);
    const p = wallPos(h.c, h.r, wallScroll()), tx = p.x + WALL.cw / 2, ty = p.y + WALL.ch / 2 - 4;
    const x = STAGE.x + (tx - STAGE.x) * e, y = STAGE.y + (ty - STAGE.y) * e - 50 * Math.sin(kk * Math.PI), R = STAGE.R + (WALL.R - STAGE.R) * e;
    drawCreature(ctx, h.m.sp, x, y, R, h.m.ax, h.m.shiny, time + h.m.ph);
    if (kk >= 1){ const cell = wallCell(h.c, h.r); cell.m = h.m; cell.img = wallCardImg(h.m); cell.isNew = 2.2; S.row.push({ m: h.m }); if (S.row.length > 4) S.row.shift(); h.done = true;
      for (let i = 0; i < 8; i++){ const a = i / 8 * 6.283; S.sparks.push({ x: tx, y: ty, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 20, t: 0.2, gold: h.m.shiny }); } }
  }
  S.hops = S.hops.filter(h => !h.done);
  // キラキラ
  for (const p of S.sparks){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.vx *= 0.97; const a = Math.max(0, 1 - p.t / 0.8); ctx.fillStyle = p.gold ? `rgba(255,200,40,${a})` : `rgba(255,236,150,${a})`; star(p.x, p.y, 3 + 4 * a); }
  S.sparks = S.sparks.filter(p => p.t < 0.8);
  if (m.shiny && S.badgeA > 0 && !S.sent) drawShinyBadge(STAGE.x + STAGE.R * 1.45, STAGE.y - STAGE.R * 1.02, 0.95, S.badgeA); // 激レアのラベル（舞台の右上、モンスターから少し離す）
  // 名前：リザルトと同じ 上下2段の大きな文字（白ふち、キンイロは金色）。ふわっと下から出る
  if (nameA > 0){ ctx.save(); ctx.globalAlpha = nameA; ctx.translate(0, (1 - nameA) * 10); const ny = STAGE.y + STAGE.R + 54; ctx.fillStyle = m.shiny ? 'rgba(255,244,200,.82)' : 'rgba(255,253,246,.78)'; ctx.strokeStyle = m.shiny ? 'rgba(214,138,0,.55)' : 'rgba(59,42,34,.22)'; ctx.lineWidth = 2; roundRect(22, ny - 42, W - 44, 84, 18); ctx.fill(); ctx.stroke(); // うすい台紙（壁の上でも読めるように）
    drawName(creatureName(m.sp, m.ax, m.shiny), ny, m.shiny, 30); ctx.restore(); }
}
// （旧）パレード
let parade = [];
function newParader(x){
  const recent = parade.slice(-2);
  const spk = Object.keys(SPECIES).filter(k => !recent.some(r => r.sp === k));
  const tiers = [0, 1, 2, 3].filter(tt => !recent.some(r => !r.shiny && q4(r.ax[2]) === tt));
  const tier = tiers[Math.floor(Math.random() * tiers.length)];
  const a3 = [0.1, 0.35, 0.65, 0.9][tier];
  return { x, sp: spk[Math.floor(Math.random() * spk.length)], ax: [Math.random(), Math.random(), a3, Math.random()], shiny: !recent.some(r => r.shiny) && Math.random() < 0.06, ph: Math.random() * 6 };
}
function nameTag(x, y, text){
  ctx.font = 'bold 13px sans-serif'; const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#3b2a22'; ctx.lineWidth = 2; roundRect(x - w / 2, y - 13, w, 26, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e0453a'; ctx.fillRect(x - w / 2 + 5, y - 8, 4, 16);
  ctx.fillStyle = '#3a2a18'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 3, y + 1);
}
// 「イキモン」に「生き物」のルビを振って1行描く（生き物と書いてイキモンと読む）。色は呼ぶ前の fillStyle、中央そろえ
function rubyText(text, cx, y, size, weight, maxW){
  if (lang !== 'ja'){ // 英語はルビなし。長いときは 幅に収まるまで縮める
    ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    let fs = size; ctx.font = (weight ? weight + ' ' : '') + fs + 'px sans-serif';
    while (maxW && ctx.measureText(text).width > maxW && fs > 8){ fs -= 0.5; ctx.font = (weight ? weight + ' ' : '') + fs + 'px sans-serif'; }
    ctx.fillText(text, cx, y); ctx.restore(); return;
  }
  const parts = text.split(/(イキモン)/), main = (weight ? weight + ' ' : '') + size + 'px sans-serif', ruby = 'bold ' + Math.max(7, Math.round(size * 0.6)) + 'px sans-serif';
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = main;
  const ws = parts.map(t => ctx.measureText(t).width);
  let x = cx - ws.reduce((a, b) => a + b, 0) / 2;
  parts.forEach((t, i) => {
    ctx.font = main; ctx.fillText(t, x, y);
    if (t === 'イキモン'){ ctx.font = ruby; ctx.textAlign = 'center'; ctx.fillText('生き物', x + ws[i] / 2, y - size * 0.85); ctx.textAlign = 'left'; }
    x += ws[i];
  });
  ctx.restore();
}
function drawSubtitle(cx, y){ const E = lang === 'ja' ? null : EN_LOGO.subtitle; ctx.fillStyle = '#3a2a18'; rubyText(i18n('subtitle'), cx, y, E ? E.size : 13, 'bold', E ? E.maxW : 236); }
// 動かないロゴは 1回だけ別のキャンバスに描いて使い回す（画面の大きさが変わったら描き直す）。共有画像など別のキャンバスに描くときは そのまま描く
const logoCache = new Map();
function drawLogoCached(y, size, text, oneLine, scene){
  if (ctx.canvas !== cv || !cv.width) return drawLogo(y, size, text, oneLine, scene); // 読み込み直後で画面幅が0のときは キャッシュを作らない
  const k = cv.width / W, top = Math.floor(y - size * 2), hgt = Math.ceil(size * 4), key = [y, size, text, oneLine, k, lang, scene].join('|');
  let c = logoCache.get(key);
  if (!c){
    c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(hgt * k);
    const keep = ctx; ctx = c.getContext('2d'); ctx.setTransform(k, 0, 0, k, 0, -top * k);
    try { drawLogo(y, size, text, oneLine, scene); } finally { ctx = keep; }
    if (logoCache.size > 12) logoCache.clear();
    logoCache.set(key, c);
  }
  ctx.drawImage(c, 0, top, W, hgt);
}
function drawTitleLogo(){ if (lang === 'ja') drawLogoCached(LOGO.titleY, LOGO.titleSize); else drawLogoCached(EN_LOGO.title.y, EN_LOGO.title.size, undefined, undefined, 'title'); }
/* タイトル下の言語切り替え(日本語 / English) */
const LANG_BTN = { x: W / 2 - 70, y: 596, w: 140, h: 30 };
function drawLangToggle(){
  const b = LANG_BTN, hw = b.w / 2;
  ctx.save();
  roundRect(b.x, b.y, b.w, b.h, 15); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#3b2a22'; ctx.stroke();
  roundRect(lang === 'ja' ? b.x + 2 : b.x + hw, b.y + 2, hw - 2, b.h - 4, 13); ctx.fillStyle = '#f08a3c'; ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = lang === 'ja' ? '#fff' : '#3a2a18'; ctx.fillText('日本語', b.x + hw / 2 + 1, b.y + b.h / 2 + 1);
  ctx.fillStyle = lang === 'en' ? '#fff' : '#3a2a18'; ctx.fillText('English', b.x + hw + hw / 2 - 1, b.y + b.h / 2 + 1);
  ctx.restore();
}
// 音のオン/オフボタン（スピーカーの絵。オフは ×）。言語切り替えと同じ白い台に こげ茶のふち
const SND_BTN = { x: 26, y: 611, r: 16 };
function drawSoundBtn(){
  const b = SND_BTN, c = '#3a2a18';
  ctx.save();
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fillStyle = '#fffdf6'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#3b2a22'; ctx.stroke();
  ctx.translate(b.x - 3, b.y); ctx.fillStyle = c;
  ctx.beginPath(); ctx.moveTo(-7, -3.5); ctx.lineTo(-3.5, -3.5); ctx.lineTo(1.5, -8); ctx.lineTo(1.5, 8); ctx.lineTo(-3.5, 3.5); ctx.lineTo(-7, 3.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineCap = 'round';
  if (muted){ ctx.beginPath(); ctx.moveTo(5, -4); ctx.lineTo(11, 4); ctx.moveTo(11, -4); ctx.lineTo(5, 4); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(2, 0, 5, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(2, 0, 9.5, -0.9, 0.9); ctx.stroke(); }
  ctx.restore();
}
function soundTap(p){
  const b = SND_BTN;
  if (Math.hypot(p.x - b.x, p.y - b.y) > b.r + 8) return false;
  setMuted(!muted); if (!muted) sfx.pick();
  return true;
}
function langTap(p){
  const b = LANG_BTN;
  if (p.x < b.x - 4 || p.x > b.x + b.w + 4 || p.y < b.y - 6 || p.y > b.y + b.h + 6) return false;
  setLang(p.x < b.x + b.w / 2 ? 'ja' : 'en');
  sfx.pick();
  return true;
}
function drawTitle(){
  drawWall(); // 図鑑の壁（いちばん奥）
  drawTitleLogo();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const pill = (y, w, h) => { ctx.save(); ctx.fillStyle = 'rgba(255,253,246,.9)'; ctx.strokeStyle = 'rgba(59,42,34,.25)'; ctx.lineWidth = 1.5; roundRect(W / 2 - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke(); ctx.restore(); }; // 図鑑の壁の上でも文字が読めるように
  pill(lang === 'ja' ? 111 : EN_LOGO.subtitle.pillY, lang === 'ja' ? 210 : EN_LOGO.subtitle.pillW, lang === 'ja' ? 30 : EN_LOGO.subtitle.pillH); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  drawSubtitle(W / 2, lang === 'ja' ? 114 : EN_LOGO.subtitle.y); // ロゴのすぐ下。「イキモン」に「生き物」のルビ
  drawShowcase(); // 舞台（博士と吹き出しより奥）
  drawProf(62, 252, 0.78, time, 'point'); // 字幕のすぐ下に 博士とセリフ
  nameTag(62, 268, i18n('profName'));
  const TALK = i18n('titleTalk'); // 冒険前に相棒をもらう／種類が多いので 博士がバッグの中身で決める
  const total = TALK.join('').length, shown = Math.floor(Math.max(0, phaseT - 0.3) * (lang === 'ja' ? 16 : 30));
  let rest = shown; const vis = TALK.map(l => { const n = clamp(rest, 0, l.length); rest -= l.length; return l.slice(0, n); });
  bubble(124, 152, 226, vis.map((l, i) => l || (i === 0 ? '…' : '')), fitSize(TALK, 226, 14), profTail(62, 252, 0.78, time), undefined, true);
  const a = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.globalAlpha = 0.55 + 0.45 * a; ctx.translate(W / 2, 562); ctx.scale(1 + 0.03 * a, 1 + 0.03 * a); // 帯なし：白い太ふちで壁の上でも読める
  ctx.font = '900 26px sans-serif'; ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = '#fffdf6'; ctx.strokeText(i18n('tapStart'), 0, 0);
  ctx.fillStyle = '#3a2a18'; ctx.fillText(i18n('tapStart'), 0, 0); ctx.restore();
  drawLangToggle();
  drawSoundBtn();
}
// 激レアのラベル（キンイロのとき）：金の帯＋燕尾＋宝石付きの王冠。帯の幅は文字に合わせる。
// ぴょこぴょこ脈打って少し揺れ、光の筋が走り、まわりで金色のキラキラ
function drawShinyBadge(x, y, s, appear){
  if (appear <= 0) return;
  const LABEL = i18n('rare'), fs = 15, pop = appear < 1 ? easeBack(appear) : 1, pul = 1 + 0.04 * Math.sin(time * 5);
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.36 + 0.03 * Math.sin(time * 2.2)); ctx.scale(s * pop * pul, s * pop * pul); // 右回りに傾けて モンスターの肩にそわせる
  ctx.font = `900 ${fs}px sans-serif`; const hw = ctx.measureText(LABEL).width / 2 + 11;
  ctx.lineJoin = 'round';
  for (const sd of [-1, 1]){ ctx.beginPath(); ctx.moveTo(sd * (hw - 6), -1); ctx.lineTo(sd * (hw + 11), -1); ctx.lineTo(sd * (hw + 5), 10); ctx.lineTo(sd * (hw + 11), 21); ctx.lineTo(sd * (hw - 6), 21); ctx.closePath(); ctx.fillStyle = '#b0700c'; ctx.fill(); ctx.strokeStyle = '#5a3500'; ctx.lineWidth = 2; ctx.stroke(); }
  const gr = ctx.createLinearGradient(0, -14, 0, 16); gr.addColorStop(0, '#fff3a8'); gr.addColorStop(0.5, '#ffc928'); gr.addColorStop(1, '#d68a00');
  const band = () => { ctx.beginPath(); ctx.moveTo(-hw, -13); ctx.quadraticCurveTo(0, -19, hw, -13); ctx.lineTo(hw, 15); ctx.quadraticCurveTo(0, 9, -hw, 15); ctx.closePath(); };
  band(); ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = '#5a3500'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.save(); band(); ctx.clip(); const sx = ((time * 0.8) % 2.4) * (hw + 40) / 1.2 - hw; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(sx, -22); ctx.lineTo(sx + 12, -22); ctx.lineTo(sx - 6, 22); ctx.lineTo(sx - 18, 22); ctx.closePath(); ctx.fill(); ctx.restore();
  // 文字：金色のグラデーション＋こげ茶の太いふち
  ctx.font = `900 ${fs}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = fs * 0.42; ctx.strokeStyle = '#5a3500'; ctx.strokeText(LABEL, 0, 0.5);
  const tg = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2); tg.addColorStop(0, '#fffbe0'); tg.addColorStop(0.45, '#ffd84a'); tg.addColorStop(1, '#e09a00'); ctx.fillStyle = tg; ctx.fillText(LABEL, 0, 0.5);
  // 王冠（宝石つき）
  ctx.translate(0, -3);
  ctx.beginPath(); ctx.moveTo(-13, -14); ctx.lineTo(-15, -28); ctx.lineTo(-7, -21); ctx.lineTo(0, -32); ctx.lineTo(7, -21); ctx.lineTo(15, -28); ctx.lineTo(13, -14); ctx.quadraticCurveTo(0, -17, -13, -14); ctx.closePath();
  const cg = ctx.createLinearGradient(0, -32, 0, -14); cg.addColorStop(0, '#fff6b0'); cg.addColorStop(1, '#f2a900'); ctx.fillStyle = cg; ctx.fill(); ctx.strokeStyle = '#5a3500'; ctx.lineWidth = 2; ctx.stroke();
  for (const [cx, cy, col] of [[0, -22, '#4fb3ff'], [-9, -18, '#ff6fa8'], [9, -18, '#7be08a']]){ ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, 6.283); ctx.fillStyle = col; ctx.fill(); }
  ctx.restore();
  // まわりのキラキラ（4つの角の星）
  for (let i = 0; i < 3; i++){
    const a = time * 1.3 + i * 2.1, k = (0.5 + 0.5 * Math.sin(time * 5 + i * 1.7)) * appear, px = x + Math.cos(a) * (hw + 16) * s, py = y - 6 * s + Math.sin(a) * 30 * s, R = (4 + 3 * k) * s, r = (1.4 + k) * s;
    ctx.fillStyle = `rgba(255,215,80,${k})`; ctx.beginPath(); for (let j = 0; j < 8; j++){ const aa = -Math.PI / 2 + j / 8 * 6.283, rr = j % 2 ? r : R; ctx.lineTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr); } ctx.closePath(); ctx.fill();
  }
}
function star(x, y, r){ ctx.beginPath(); for (let i = 0; i < 8; i++){ const a = i / 8 * 6.283, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
function drawShinyRays(cx, cy){
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * 0.25);
  for (let i = 0; i < 14; i++){
    ctx.fillStyle = i % 2 ? 'rgba(255,215,90,.22)' : 'rgba(255,245,190,.12)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 420, i / 14 * 6.283, (i + 1) / 14 * 6.283); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawName(parts, cy, shiny, forceSize){
  // 4文字ずつのパーツ: 4つなら2行(8+8)、3つ以下なら1行
  const jn = i18n('nameJoin'), lines = parts.length >= 4 ? [parts[0] + jn + parts[1], parts[2] + jn + parts[3]] : [parts.join(jn)];
  const size = forceSize || (lines.length === 2 ? 38 : 32), lh = size * 1.15;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    const y = cy + (i - (lines.length - 1) / 2) * lh;
    fitText(ln, W - 24, size, 'bold');
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = shiny ? '#7a4a00' : '#fff8ea';
    ctx.strokeText(ln, W / 2, y);
    if (shiny){ const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.5, '#ffc928'); g.addColorStop(1, '#d98a00'); ctx.fillStyle = g; }
    else ctx.fillStyle = '#3a2a18';
    ctx.fillText(ln, W / 2, y);
  });
  return lines.length * lh;
}
// ===== 結果画面: ロゴ → タイプ → イキモン → 名前 → 博士のひとこと+せいかくメーター → ボタン =====
let resultTab = 0, shareImg = null, toast = null;
// 画面は 360×640 固定で、端末に合わせて全体を拡大縮小する(余白の位置は端末で変わらない)
const RES_Y = { logo: 34, typeLabel: 75, type: 95, creature: 196, name: 294, talk: 336, meter: 424 };
const RES_METER = { x: 18, y: 424, w: W - 36, h: 98 };
// ボタンは window.SHARE(share.js)があるときだけ「画像を保存」「Xに投稿」を並べる。無いときは「もう一度あそぶ」だけを中央に
function resBtns(){
  const again = { id: 'again', label: i18n('btnAgain'), icon: '', x: 18, y: 536, w: W - 36, h: 48, bg: '#f08a3c', fg: '#fff', edge: '#a0501c', size: 18 };
  if (!window.SHARE) return [Object.assign(again, { x: 50, y: 558, w: W - 100, h: 54, size: 20 })];
  return [again,
    { id: 'img', label: i18n('btnImg'), icon: '📷', x: 18, y: 592, w: 158, h: 38, bg: '#fffdf6', fg: '#3a2a18', edge: '#3b2a22', size: 14 },
    { id: 'x', label: i18n('btnPost'), icon: '𝕏', x: 184, y: 592, w: 158, h: 38, bg: '#16181c', fg: '#fff', edge: '#000', size: 14 }];
}
const BTN_PRESS = {}; // ボタンごとの 押した時刻
const BTN_READY = 0.8; // s 結果が出てから ボタンが押せるまで(うっかり連打の防止)

function showToast(text){ toast = { text, t: time }; }
function retry(){ resetGame(); state = 'play'; sfx.pick(); }
function shareName(r){ return r.special ? i18n('profName') : r.monName; }
// share.js(window.SHARE)に渡す もろもろ
function shareCtx(){
  return { name: shareName(result), tag: i18n('shareTag'), title: i18n('pageTitle'), makeCanvas: makeShareCanvas, toast: showToast, pick: () => sfx.pick() };
}
function resultTap(p){
  if (phaseT < BTN_READY) return;
  const b = resBtns().find(b => inRect(p, b));
  if (b){
    BTN_PRESS[b.id] = time;
    if (b.id === 'again') retry();
    else if (b.id === 'x') SHARE.postX(shareCtx());
    else if (b.id === 'img') SHARE.saveImage(shareCtx());
    return;
  }
}
// シェア用の画像(1080×1440)。結果画面の上半分と せいかくメーターを1枚に
const CARD = { w: 360, h: 540, k: 3 };
// 博士のひとこと（リザルトと保存画像で共通）：3行に収めて 文字を大きく（長い行があれば 収まるまで少し小さく）。「……たぶんな。」は 3行目の右はしに小さく
function drawResultTalk(r, ty, py){
  const bw = W - 94; let fs = 14;
  ctx.font = `bold ${fs}px sans-serif`;
  while (fs > 11 && Math.max(...r.talk.map(l => ctx.measureText(l).width)) > bw - fs * 1.6){ fs -= 0.5; ctx.font = `bold ${fs}px sans-serif`; }
  bubble(76, ty, bw, r.talk, fs, profTail(40, py, 0.44, time));
  if (r.shiny) return; // キンイロは 博士も自信あり
  ctx.font = 'bold 9.5px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(58,42,24,.55)';
  ctx.fillText(i18n('maybe'), 76 + bw - 10, ty + fs * 0.55 + fs * 1.45 * (r.talk.length - 0.5) + 1);
}
function makeShareCanvas(){
  const c = document.createElement('canvas'); c.width = CARD.w * CARD.k; c.height = CARD.h * CARD.k;
  const g = c.getContext('2d'), keep = ctx;
  ctx = g;
  try{
    g.setTransform(CARD.k, 0, 0, CARD.k, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, CARD.h); bg.addColorStop(0, '#9bd3e8'); bg.addColorStop(0.7, '#d9efc4'); bg.addColorStop(1, '#b9d98f');
    g.fillStyle = bg; g.fillRect(0, 0, CARD.w, CARD.h);
    const r = result;
    if (r.special){
      g.save(); g.translate(W / 2, 0); g.scale(0.9, 0.9); g.translate(-W / 2, -10); drawSpecialTop(r, 1); g.restore();
      bubble(60, 456, 240, i18n('specialTalk'), 13, W / 2, 444); // 博士のひとこと
      g.save(); g.translate(W / 2, 0); g.scale(0.9, 0.9); g.translate(-W / 2, -10); drawSpecialTag(); g.restore(); // 吹き出しより上に
    } else {
      g.save(); g.translate(W / 2, 8); g.scale(0.95, 0.95); g.translate(-W / 2, 0); drawResultTop(r, 99, true); g.restore();
      drawProf(40, 414, 0.44, time, 'point'); drawResultTalk(r, 336, 414); // 博士のひとこと
      g.fillStyle = 'rgba(255,253,246,.8)'; roundRect(18, 420, W - 36, 106, 14); g.fill();
      drawAxes(r, 440, 22, lang === 'ja' ? 92 : 100, lang === 'ja' ? W - 92 : W - 100);
    }
  } finally { ctx = keep; }
  return c;
}
// ロゴ・タイプ・イキモン・名前(結果画面とシェア画像で共通)
// u：リザルトが始まってからの時間（共有画像などは 省略して 出きった状態）
// 相棒の登場はタイトルの舞台と同じ：台紙が広がる → シルエットがポンと出る → ピカッと色がつく → 名前
// イキモンの左右の小さな台紙：左＝決め手の荷物（ゲーム中と同じ形）、右＝次の候補（次に育っていた荷物の種族）
// 主役のイキモンが目立つように：左右は画面の端寄り・足もとの高さ・少し小さく控えめ。出るのも イキモンが出てから少し遅れて
// altDy：次の候補（右）は下寄り（右上には 激レアのラベルが来るので）
const SIDE_CARD = { dx: 134, altDy: 26, w: 64, h: 76 };
// 決め手はイキモンの左上（激レアのラベルと左右対称）
const KEY_POS = { x: W / 2 - 110, y: RES_Y.creature - 56 }; // 激レアのラベル(右上)と左右対称の位置
function sideCard(x, y, label, edge, labelCol){
  const c = SIDE_CARD; // 台紙(枠)は 窮屈に見えるので描かない。見出しだけ
  ctx.fillStyle = labelCol || 'rgba(58,42,24,.6)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y - c.h / 2 + 10);
}
function drawKeyItem(r, a){
  if (r.keyKind == null || a <= 0) return;
  // タイプの行の左はし：上に「決め手」、まんなかに荷物、下に Lv（ほめ言葉は博士が言うので 文字は付けない）
  const x = KEY_POS.x, py = KEY_POS.y, lv = clamp(r.keyLv || 1, 1, CFG.maxLv), def = LV[r.keyKind][lv];
  const big = lv >= 4, max = lv >= 5;
  ctx.save(); ctx.globalAlpha *= a;
  if (big){ // Lv4・Lv5 は後ろで光がまわる
    ctx.save(); ctx.translate(x, py); ctx.rotate(time * (max ? 1.6 : 0.8));
    ctx.fillStyle = max ? 'rgba(255,214,90,.75)' : 'rgba(255,230,120,.5)'; ctx.beginPath();
    const n = max ? 10 : 8, rr = max ? 22 : 19;
    for (let i = 0; i < n; i++){ ctx.moveTo(0, 0); ctx.arc(0, 0, rr, i / n * 6.283, i / n * 6.283 + 0.28); ctx.closePath(); }
    ctx.fill(); ctx.restore();
  }
  const pulse = max ? 1 + 0.06 * Math.sin(time * 5) : 1;
  const s = pieceSprite(def, false), k = 13 / def.s * pulse, h = s.half * k;
  ctx.drawImage(s.c, x - h, py - h, h * 2, h * 2);
  if (max){ ctx.fillStyle = 'rgba(255,250,210,.95)'; for (let i = 0; i < 3; i++){ const t = time * 2 + i * 2.1; star(x + Math.cos(t) * 17, py + Math.sin(t * 1.3) * 13, 2 + 1.2 * Math.abs(Math.sin(t * 3))); } }
  // 文字は いちばん上に描く（Lv5 のキラキラに うもれないよう 白いふち付き）
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,253,246,.95)';
  ctx.font = 'bold 10px sans-serif'; ctx.strokeText(i18n('keyLabel'), x, py - 22); ctx.fillStyle = 'rgba(58,42,24,.75)'; ctx.fillText(i18n('keyLabel'), x, py - 22);
  ctx.font = `bold ${big ? 12 : 11}px sans-serif`;
  if (r.keyLv >= 1){ ctx.strokeText('Lv' + r.keyLv, x, py + 22); ctx.fillStyle = max ? '#d0392e' : big ? '#b8860b' : '#3a2a18'; ctx.fillText('Lv' + r.keyLv, x, py + 22); }
  ctx.restore();
}
let ALT_CV = null; // 次の候補を描く 作業用キャンバス
// 図鑑ナンバーの札（台紙の左下。上の「決め手」と縦にそろえる）。キンイロは金色
function drawDexNo(r, a){
  if (a <= 0) return;
  const txt = 'No.' + String(dexNo(r.species, r.ax, r.shiny)).padStart(3, '0'), x = KEY_POS.x, y = RES_Y.creature + 52;
  ctx.save(); ctx.globalAlpha *= a; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width + 18, h = 22;
  roundRect(x - w / 2, y - h / 2, w, h, 11); ctx.fillStyle = r.shiny ? '#fff3c4' : '#fffdf6'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = r.shiny ? '#d9a21b' : 'rgba(59,42,34,.45)'; ctx.stroke();
  ctx.fillStyle = r.shiny ? '#9a6a00' : 'rgba(59,42,34,.75)'; ctx.fillText(txt, x, y + 1);
  ctx.restore();
}
function drawAltPick(r, a){
  const alt = r.alt; if (!alt || a <= 0) return;
  const x = W / 2 + SIDE_CARD.dx, y = RES_Y.creature + SIDE_CARD.altDy;
  ctx.save(); ctx.globalAlpha *= a;
  sideCard(x, y, i18n('altLabel'));
  // 同じ性格のまま ほかの種族だったら。部品ごとに透かすと重なりが透けて見えるので、別のキャンバスに描いてから 絵全体をまとめて薄くする
  const res = ctx.getTransform().a || 1, B = 44, px = Math.ceil(B * 2 * res);
  if (!ALT_CV) ALT_CV = document.createElement('canvas');
  if (ALT_CV.width !== px){ ALT_CV.width = ALT_CV.height = px; }
  const g2 = ALT_CV.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, px, px);
  g2.setTransform(res, 0, 0, res, 0, 0); g2.translate(B, B); drawCreature(g2, alt.species, 0, 0, 16, r.ax, false, time);
  ctx.save(); ctx.globalAlpha *= 0.9; ctx.drawImage(ALT_CV, x - B, y + 2 - B, B * 2, B * 2); ctx.restore();
  ctx.fillStyle = 'rgba(58,42,24,.8)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // 荷物の絵文字＋名前の最後の4文字（カリカリ など）。絵文字は iPhone でずれないよう 別に描く
  const ty = y + SIDE_CARD.h / 2 - 10, word = SPECIES[alt.species].word, ww = ctx.measureText(word).width, es = 11, gap = 2, tw = es + gap + ww, lx = x - tw / 2;
  emojiText(ctx, KINDS[alt.kind].e, lx + es / 2, ty); ctx.textAlign = 'left'; ctx.fillText(word, lx + es + gap, ty);
  ctx.restore();
}
// showAlt：次の候補も出す（結果画面・保存画像とも true）
function drawResultTop(r, u = 99, showAlt = false){
  const Y = RES_Y, k = 0.5, m = { sp: r.species, ax: r.ax, shiny: r.shiny, ph: 0 };
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (r.shiny && u > k){ ctx.save(); ctx.globalAlpha = clamp((u - k) / 0.3, 0, 1); ctx.fillStyle = 'rgba(255,236,170,.55)'; ctx.fillRect(0, 0, W, H); drawShinyRays(W / 2, Y.creature); ctx.restore(); }
  if (lang === 'ja') drawLogoCached(Y.logo, 30, null, true); else drawLogoCached(EN_LOGO.result.y, EN_LOGO.result.size, null, true, 'result');
  const txtA = clamp((u - k - 0.15) / 0.3, 0, 1);
  ctx.save(); ctx.globalAlpha = txtA;
  ctx.fillStyle = 'rgba(58,42,24,.7)'; rubyText(i18n('typeLabelFmt')(SPECIES[r.species].label), W / 2, Y.typeLabel, 12, '', W - 24);
  ctx.fillStyle = '#3a2a18'; fitText(r.typeName, W - 30, 18, 'bold'); ctx.fillText(r.typeName, W / 2, Y.type);
  ctx.restore();
  stageRays(W / 2, Y.creature - 4, 82, clamp(u / 0.35, 0, 1), r.shiny && u > k, SPECIES[r.species].vh ?? SPECIES[r.species].h);
  if (u < k) drawSilhouette(m, W / 2, Y.creature, 55, Math.max(0.01, easeBack(clamp((u - 0.1) / (k - 0.1), 0, 1))));
  else {
    const pop = u < k + 0.28 ? 1 + 0.12 * Math.sin((u - k) / 0.28 * Math.PI) : 1;
    ctx.save(); ctx.translate(W / 2, Y.creature); ctx.scale(pop, pop); drawCreature(ctx, r.species, 0, 0, 55, r.ax, r.shiny, time); ctx.restore();
    if (u < k + 0.35){ ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - (u - k) / 0.35)})`; ctx.beginPath(); ctx.arc(W / 2, Y.creature, 80, 0, 6.283); ctx.fill(); } // ピカッ
    if (u < 50 && !r._burst){ r._burst = []; for (let i = 0; i < 18; i++){ const a = i / 18 * 6.283 + Math.random() * 0.3, sp = 110 + Math.random() * 90; r._burst.push({ x: W / 2, y: Y.creature, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, t: 0 }); } sfx.pop(); }
  }
  if (r._burst && u < 50){ // キラキラ
    const dt = Math.min(0.05, Math.max(0, time - (r._bt || time))); r._bt = time;
    for (const p of r._burst){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.vx *= 0.97; const a = Math.max(0, 1 - p.t / 0.9); if (a > 0){ ctx.fillStyle = r.shiny ? `rgba(255,200,40,${a})` : `rgba(255,236,150,${a})`; star(p.x, p.y, 3 + 4 * a); } }
  }
  // 左右は イキモンが出て 名前が出たあとに 少し遅れて出す（まず主役だけを見せる）
  const sideA = clamp((u - k - 0.75) / 0.4, 0, 1);
  drawKeyItem(r, sideA);
  drawDexNo(r, sideA);
  if (showAlt) drawAltPick(r, sideA);
  if (r.shiny && u > k) drawShinyBadge(W / 2 + 110, Y.creature - 56, 1.15, clamp((u - k - 0.15) / 0.4, 0, 1)); // 激レアのラベル（タイトルと同じ金のリボン＋王冠）
  ctx.save(); ctx.globalAlpha = txtA; ctx.translate(0, (1 - txtA) * 10);
  // 名前の台紙は 窮屈に見えるので描かない（試し中）
  drawName(r.nameParts, Y.name, r.shiny, 31); ctx.restore();
}
function drawSpecialTop(r, pop){
  ctx.fillStyle = 'rgba(255,236,170,.55)'; ctx.fillRect(0, 0, W, 460); drawShinyRays(W / 2, 230);
  const ly = lang === 'ja' ? LOGO_JA.y : EN_LOGO.special.y, ls = lang === 'ja' ? LOGO_JA.size : EN_LOGO.special.size;
  ctx.save(); ctx.translate(W / 2, ly); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop); ctx.translate(-W / 2, -ly); drawLogo(ly, ls, 'special'); ctx.restore();
  drawProf(W / 2, 362, 1.5 * (0.85 + 0.15 * pop), time, 'point');
  drawName([i18n('profName')], 400, true, 42);
}
// v45：「何もしないと会える」は 吹き出しのあとに描く（吹き出しに隠れないように）
function drawSpecialTag(){ ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#b26a00'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(i18n('specialTag'), W / 2, lang === 'ja' ? 444 : 436, W - 24); ctx.restore(); }
// 4つの軸のメーター
function drawAxes(r, y0, step, x0, x1){
  r.ax.forEach((v, i) => {
    const y = y0 + i * step;
    ctx.fillStyle = 'rgba(0,0,0,.1)'; roundRect(x0, y - 3.5, x1 - x0, 7, 3.5); ctx.fill();
    ctx.fillStyle = 'rgba(58,42,24,.25)'; ctx.fillRect(W / 2 - 0.75, y - 6, 1.5, 12);
    ctx.fillStyle = r.shiny ? '#e0a800' : '#e07b3c'; ctx.beginPath(); ctx.arc(lerp(x0, x1, v), y, 6.5, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = 'bold 12px sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillStyle = r.bin[i] === 0 ? '#3a2a18' : 'rgba(58,42,24,.4)'; ctx.textAlign = 'right'; ctx.fillText(i18n('axes')[i][0], x0 - 9, y, x0 - 12);
    ctx.fillStyle = r.bin[i] === 1 ? '#3a2a18' : 'rgba(58,42,24,.4)'; ctx.textAlign = 'left'; ctx.fillText(i18n('axes')[i][1], x1 + 9, y, W - x1 - 12);
  });
}
function drawButtons(){
  const k = clamp((phaseT - 0.3) / 0.4, 0, 1);
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = k;
  for (const b of resBtns()){
    const pr = BTN_PRESS[b.id] && time - BTN_PRESS[b.id] < 0.12 ? 2 : 0, y = b.y + (1 - k) * 16 + pr;
    ctx.fillStyle = 'rgba(40,25,15,.25)'; roundRect(b.x, y + 4 - pr, b.w, b.h, 14); ctx.fill(); // かげ
    ctx.fillStyle = b.bg; roundRect(b.x, y, b.w, b.h, 14); ctx.fill();
    ctx.strokeStyle = b.edge; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = b.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // アイコン+文字を まとめて中央に
    ctx.font = `bold ${b.size}px sans-serif`; const lw = ctx.measureText(b.label).width;
    ctx.font = (b.id === 'x' ? 'bold ' : '') + (b.size + 3) + 'px sans-serif'; const iw = b.icon ? ctx.measureText(b.icon).width : 0, gap = b.icon ? 6 : 0;
    const sx = b.x + b.w / 2 - (iw + gap + lw) / 2;
    ctx.textAlign = 'left'; ctx.fillText(b.icon, sx, y + b.h / 2 + 1);
    ctx.font = `bold ${b.size}px sans-serif`; ctx.fillText(b.label, sx + iw + gap, y + b.h / 2 + 1);
  }
  ctx.restore();
}
function drawToast(){
  if (!toast) return;
  const a = time - toast.t; if (a > 2.4){ toast = null; return; }
  const k = Math.min(1, a / 0.15) * Math.min(1, (2.4 - a) / 0.3);
  ctx.save(); ctx.globalAlpha = k; ctx.font = 'bold 13px sans-serif';
  const tw = ctx.measureText(toast.text).width + 28;
  ctx.fillStyle = 'rgba(40,28,18,.9)'; roundRect(W / 2 - tw / 2, 486, tw, 30, 15); ctx.fill();
  ctx.fillStyle = '#fff8ea'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(toast.text, W / 2, 501);
  ctx.restore();
}
function drawResult(){
  const r = result;
  if (r.special){
    drawSpecialTop(r, Math.min(1, phaseT / 0.25));
    bubble(60, 458, 240, i18n('specialTalk'), 13, W / 2, 446);
    drawSpecialTag();
    drawButtons(); drawToast();
    return;
  }
  drawResultTop(r, phaseT, true);
  if (DEBUG && r.dbg){ const d = r.dbg; ctx.fillStyle = "rgba(255,253,246,.85)"; ctx.fillRect(0, 0, W, 36); ctx.font = "9px sans-serif"; ctx.fillStyle = "rgba(58,42,24,.8)"; ctx.textAlign = "center"; ctx.fillText(`狙い${(d.aimRate*100).toFixed(0)}% まとまり${d.cluster.toFixed(1)} ぐる${d.ratio.toFixed(1)} 高さ${d.lvl.toFixed(2)} 自こぼ${d.selfSp} 押こぼ${d.pushSp} 最大Lv${d.maxLv} 離し高${(d.relH*100).toFixed(0)}% こぼ率${(d.spillRate*100).toFixed(0)}%`, W / 2, 8); ctx.fillText(`実ロ${(d.ax2*100).toFixed(0)}(旧${(d.ax2Old*100).toFixed(0)}) 大1つ${(d.bigShare*100).toFixed(0)}% 捨て${d.throws} 反応${d.react.toFixed(1)}s 間${d.delay.toFixed(2)}s 休み${(d.idle*100).toFixed(0)}%`, W / 2, 19); ctx.fillText(`記録#${r.logNo || '-'} ねらい:${r.logLabel || '-'}  きっちり${(r.ax[0]*100).toFixed(0)} 慎重${(r.ax[1]*100).toFixed(0)} 実用${(r.ax[2]*100).toFixed(0)} 即決${(r.ax[3]*100).toFixed(0)}`, W / 2, 30); }
  // 博士のひとこと
  const py = RES_Y.meter - 8;
  drawProf(40, py, 0.44, time, 'point');
  drawResultTalk(r, RES_Y.talk, py);
  // せいかくメーター
  const M = RES_METER;
  ctx.fillStyle = 'rgba(255,253,246,.8)'; roundRect(M.x, M.y, M.w, M.h, 14); ctx.fill();
  ctx.fillStyle = 'rgba(58,42,24,.55)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(i18n('meterTitle'), M.x + 12, M.y + 12);
  const ax0 = lang === 'ja' ? 92 : 100; // 英語は右の言葉(Thoughtful など)が長いので 棒を少し短く
  drawAxes(r, M.y + 31, 19, ax0, W - ax0);
  drawButtons(); drawToast();
}

let last = performance.now();
function loop(now){
  const dt = Math.max(0, Math.min(0.033, (now - last) / 1000)); last = now;
  update(dt); draw(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
