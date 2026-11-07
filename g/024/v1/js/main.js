(function () {
  'use strict';
  var cv = document.getElementById('c'), g = cv.getContext('2d');
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var flip = function () { return Math.random() < 0.5 ? 1 : -1; };
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var C = {
    bg: '#12161B', panel: '#1A2129', panel2: '#222B35', line: '#35424F',
    steelA: '#2A343F', steelB: '#1E262F', brass: '#C8913A', brassHi: '#F0C674',
    chalk: '159,227,216', pin: '#F07A5A', ghost: '143,179,255', ok: '127,224,168',
    text: '#DCE3EA', muted: '#8593A2', bad: '#F08470', hole: '#0B0E12'
  };
  var FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic UI",Meiryo,sans-serif';
  var MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

  /* ---------- 見た目。爆弾処理の操作盤：緑の計器、赤の7セグ、黄黒の警告ストライプ ---------- */
  /* ABCDの色。候補カード・スイッチ・パッドの四隅で同じ色を使う */
  var ABCD_COL = ['#FF6B5E', '#4FB3FF', '#FFC94A', '#B58CFF'];
  var TH = {
    C: { bg: '#090E0B', panel: '#0E1712', panel2: '#16261C', line: '#24452F', steelA: '#10201A', steelB: '#0A1510', brass: '#A9BDB0', brassHi: '#E8FFF0', chalk: '124,255,155', ghost: '190,210,255', ok: '124,255,155', text: '#DDFFE7', muted: '#8BB89A', bad: '#FF5A3C', hole: '#030604', pin: '#FF5A3C' },
    accent: '#7CFF9B', accentInk: '#04140A', disp: MONO, flash: '#FFFFFF',
    cardTag: function (i) { return 'MK-' + 'ABCD'.charAt(i); }
  };
  for (var ck in TH.C) C[ck] = TH.C[ck];

  /* ---------- 言語。文言は js/i18n.js の I18N にある ---------- */
  var LANG = 'ja';
  try { LANG = /^ja/i.test(navigator.language || '') ? 'ja' : 'en'; } catch (e) {}
  /* よく使う文言は TH にも写しておく（TH.title など） */
  var TEXT_KEYS = ['title', 'subtitle', 'tool', 'pinName', 'tagline', 'rule', 'count', 'countLong', 'unitN', 'timerLabel', 'link', 'win', 'winClean', 'fake', 'overBig', 'clearBig', 'normal', 'normalSub', 'endless', 'endlessSub', 'review', 'hint0', 'reveal'];
  function tr(k) { return I18N[LANG][k]; }
  function applyLang(l) {
    LANG = l === 'en' ? 'en' : 'ja';
    TEXT_KEYS.forEach(function (k) { TH[k] = I18N[LANG][k]; });
    try { document.title = tr('pageTitle'); cv.setAttribute('aria-label', tr('pageTitle')); document.documentElement.lang = LANG; } catch (e) {}
  }

  /* ---------- ルール ---------- */
  /* ノーミスで開けると+5秒、偽ピンを押したあとに開けると+2秒。偽ピンは-6秒 */
  /* 開けた本数が増えるほど時間の上乗せは減る。20本で終わり */
  var START_TIME = 30, GOAL = 10;
  /* 偽ピンは最初-3秒、押すたびに1秒ずつ重くなる（-3, -4, -5…）。当てずっぽうで押す癖ほど高くつく */
  var MISS_FIRST = 3;
  function missCost() { return MISS_FIRST + (R0 ? R0.misses : 0); }
  /* エンドレスでは5本ごとに上乗せが減り続け、20本目からは0秒。うまい人でもどこかで必ず時間切れになる */
  var BONUS_TIERS = [{ clean: 4, miss: 2 }, { clean: 3, miss: 1 }, { clean: 2, miss: 1 }, { clean: 1, miss: 0 }, { clean: 0, miss: 0 }];
  function bonusFor(opened, missed) { var t = BONUS_TIERS[Math.min(4, Math.floor(opened / 5))]; return missed ? t.miss : t.clean; }
  var PLATE = 0.4, LIP = 1.0, LIP_H = 0.62, R = 0.05, NLEN = 12, PMAX = 0.55, GAIN = 1.05;
  /* スイッチの押しやすさ（2026-11-03）：URLの末尾が #oldpress のときだけ、以前の判定に戻す（触り比べ用）
     新しい判定 = C 狙いの一拍（先が頭に落ち着いてから照準が付き、照準が付いたスイッチだけゲージがたまる）
                + A 吸い付き（照準のスイッチへ押していると、先が溝の真ん中へ寄る。溝も少し広い）
                + B ロックオン（ゲージが2割たまったら、横にぶれても途切れない。指を離すか、はっきり離れるとやめる） */
  var OLD_PRESS = location.hash.indexOf('oldpress') >= 0;
  var AIM_TIME = 0.15, LOCK_AT = 0.25;
  /* パッドの左右の帯（触っても操作が始まらない幅、設計座標）。画面の端から始まる操作はブラウザの「戻る」に取られやすいので */
  var PAD_EDGE = 22, SCREEN_EDGE = 32;
  var PIN_W = 0.26, PIN_H = 0.17, PIN_TIME = 0.5, PIN_PUSH = 0.1, PIN_SLIDE = 0.9, PIN_HOLD = 0.3, GROOVE_W = OLD_PRESS ? 0.1 : 0.14, GROOVE_D = 0.08, TRACE_LIFE = 7;
  /* ピンは入口近くに並ぶ（どの候補でも同じ場所）。候補カードの並びと同じく、AとBが天井、CとDが床。形の違いはその奥にだけある */
  var PIN_POS = [{ x: 2.0, side: 1 }, { x: 3.2, side: 1 }, { x: 2.0, side: -1 }, { x: 3.2, side: -1 }], SEEN_X = 3.85;
  var END = { straight: 9.2, bend: 9.2, step: 9.4, bulge: 9.5, bump: 9.3 };
  var TYPES = ['straight', 'bend', 'step', 'bulge', 'bump'];
  var RANGE = { bend: [4.1, 6.8], step: [4.1, 7.4], bulge: [4.1, 6.2], bump: [4.0, 7.2], straight: [0, 0] };

  /* ---------- 遊び方の設定 ----------
     候補は断面図の下、パッドのすぐ上。重ねて見る候補はパッドの四隅を軽くタップして選ぶ。
     重ね表示は、通常はなぞった所の近くだけ。上級はさらに指を離している間だけ */
  var V = { layout: 'mid', pick: 'quad', ghost: 'trace' }, endless = false, hard = false;

  /* ---------- 鍵穴の形。横が深さ、縦が高さ。返り値は[下限, 上限]。針は入口(0,0)を支点に傾く ---------- */
  function rawB(c, x) {
    switch (c.type) {
      case 'bend': { var cc = x < c.pos ? 0 : (x < c.pos + 2 ? (x - c.pos) / 2 * c.h : c.h); return [cc - 1, cc + 1]; }
      case 'step': { var hw = x < c.pos ? 1 : c.w; return [-hw, hw]; }
      case 'bulge': { var hi = (x >= c.pos && x < c.pos + 3) ? 1 + c.h * (x - c.pos) / 3 : 1; return [-1, hi]; }
      case 'bump': { var t = 1 - Math.abs(x - (c.pos + 0.8)) / 0.8; return [-1 + (t > 0 ? c.hb * t : 0), 1]; }
      default: return [-1, 1];
    }
  }
  /* スイッチの頭が壁から出ている高さ（中心からの距離 d）。
     新しい形：縁の肩はごく短く、頭の上面は真ん中へ下がるすり鉢、さらに真ん中に深いくぼみ。どこに当てて押しても真ん中へ転がり込む。
     以前の形（#oldpress）：縁から0.12の斜めの肩と、真ん中だけのV字の溝。肩が広く、押すと外へ滑りやすかった */
  function pinTop(d) {
    if (OLD_PRESS) { var e0 = Math.min(1, (PIN_W - d) / 0.12); return PIN_H * e0 - (d < GROOVE_W ? GROOVE_D * (1 - d / GROOVE_W) : 0); }
    var e = Math.min(1, (PIN_W - d) / 0.05), funnel = 0.09 * Math.max(0, 1 - d / (PIN_W - 0.05)), notch = d < 0.08 ? 0.03 * (1 - d / 0.08) : 0;
    return Math.max(0, PIN_H * e - funnel - notch);
  }
  function bounds(c, x, noPin) {
    var r = rawB(c, x), b = c.flip > 0 ? [r[0], r[1]] : [-r[1], -r[0]];
    if (x < LIP) { b[0] = Math.max(b[0], -LIP_H); b[1] = Math.min(b[1], LIP_H); }
    if (c.pins && !noPin && x < SEEN_X) {
      for (var i = 0; i < c.pins.length; i++) {
        var p = c.pins[i], d = Math.abs(x - p.x);
        if (d >= PIN_W) continue;
        var h = pinTop(d) * p.scale;
        if (p.side > 0) b[1] -= h; else b[0] += h;
      }
    }
    return b;
  }
  /* 支点から(x,y)まで、まっすぐな針が壁に当たらず届くか */
  function valid(c, x, y, noPin, clear) {
    if (x < 0.15 || x > c.end - R) return false;
    var s = y / x, xi, b, yi, m;
    /* 入口の板（厚さ0.4）の穴も通っていること。急な角度で針の手元側が板にめり込まないように */
    if (Math.abs(s) * PLATE > LIP_H - R) return false;
    for (xi = 0.05; xi < x; xi += 0.05) {
      b = bounds(c, xi, noPin); yi = s * xi;
      m = (clear && xi > LIP && xi < x - 0.4) ? R + clear : R;
      if (yi < b[0] + m || yi > b[1] - m) return false;
    }
    b = bounds(c, x, noPin);
    return y >= b[0] + R && y <= b[1] - R;
  }
  function violation(c, x, y) {
    if (x < 0.15) return null;
    var s = y / x, xi, b, yi;
    for (xi = 0.05; xi <= x + 1e-9; xi += 0.05) {
      b = bounds(c, xi); yi = s * xi;
      if (yi < b[0] + R) return { x: xi, side: -1, wy: b[0] };
      if (yi > b[1] - R) return { x: xi, side: 1, wy: b[1] };
    }
    return null;
  }
  var NDIR = 24, DIRS = [];
  for (var di = 0; di < NDIR; di++) DIRS.push([Math.cos(di * 2 * Math.PI / NDIR), Math.sin(di * 2 * Math.PI / NDIR)]);
  function estNormal(c, x, y) {
    var sx = 0, sy = 0, n = 0, i;
    for (i = 0; i < NDIR; i++) if (!valid(c, x + DIRS[i][0] * 0.06, y + DIRS[i][1] * 0.06)) { sx += DIRS[i][0]; sy += DIRS[i][1]; n++; }
    var m = Math.hypot(sx, sy);
    if (!n || m < 1e-6) return null;
    return { x: -sx / m, y: -sy / m };
  }

  /* ---------- 候補の生成 ---------- */
  function mk(type, pos, fl) {
    return { type: type, flip: fl || flip(), pos: pos, h: rnd(1.15, 1.5), w: rnd(0.36, 0.5), hb: rnd(0.85, 1.15), end: END[type] + rnd(-0.35, 0.2) };
  }
  function genCands(n) {
    var list = [], i;
    if (n < 4) {
      shuffle(TYPES).slice(0, n === 0 ? 3 : 4).forEach(function (t) {
        var r = RANGE[t]; list.push(mk(t, t === 'straight' ? 0 : rnd(r[0] + 0.3, r[1] - 0.3)));
      });
    } else if (n < 7) {
      shuffle(TYPES.slice(1)).slice(0, 2).forEach(function (t) {
        var r = RANGE[t], mid = (r[0] + r[1]) / 2;
        list.push(mk(t, rnd(r[0], mid - 0.4))); list.push(mk(t, rnd(mid + 0.4, r[1])));
      });
    } else {
      var t = TYPES[1 + Math.floor(Math.random() * 4)], r = RANGE[t], fl = n >= 10 ? flip() : 0;
      for (i = 0; i < 4; i++) list.push(mk(t, r[0] + (r[1] - r[0]) * i / 3 + rnd(-0.12, 0.12), fl));
    }
    return shuffle(list);
  }

  /* ---------- 音と振動 ---------- */
  var A = { ctx: null, on: true };
  function aInit() {
    if (A.ctx) { if (A.ctx.state === 'suspended') { try { A.ctx.resume(); } catch (e) {} } return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext, c = new AC();
      A.ctx = c; A.master = c.createGain(); A.master.gain.value = A.on ? 0.9 : 0; A.master.connect(c.destination);
      var len = c.sampleRate, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), i;
      for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      A.noise = buf;
      var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2; bp.frequency.value = 1200;
      var sg = c.createGain(); sg.gain.value = 0;
      src.connect(bp); bp.connect(sg); sg.connect(A.master); src.start();
      A.scrBP = bp; A.scrG = sg;
      var o = c.createOscillator(); o.type = 'triangle'; var og = c.createGain(); og.gain.value = 0;
      o.connect(og); og.connect(A.master); o.start(); A.pinO = o; A.pinG = og;
    } catch (e) { A.ctx = null; }
  }
  function tone(f, dur, vol, type, f2, delay) {
    if (!A.ctx) return;
    try {
      var c = A.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), gg = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      gg.gain.setValueAtTime(0.0001, c.currentTime); gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gg); gg.connect(A.master); o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  /* やわらかい和音。少しずらした2本ずつの音を、ゆっくり立ち上げて長く残す */
  /* こもったブザー。カットオフを下げながら消える */
  function buzz(f, dur, vol, c0, c1, delay) {
    if (!A.ctx) return;
    try {
      var c = A.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), lp = c.createBiquadFilter(), gg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(c0, t); lp.frequency.exponentialRampToValueAtTime(c1, t + dur);
      gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(gg); gg.connect(A.master); o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  /* 1個解除したときの音：小さなクリックと、マリンバで3つ（＋1つ）上がる短いジングル（約0.6秒）。押した瞬間に正解と分かる。
     木の丸い音で、電子音っぽさを抑えた。buzz は試した「回路切断」の名残り */
  function marimba(f, vol, delay) { tone(f, 0.35, vol, 'sine', 0, delay); tone(f * 4, 0.06, vol * 0.35, 'sine', 0, delay); nz(0.01, vol * 1.5, f * 3, 3, delay); }
  function playDefuse() {
    /* 押した瞬間（0秒）に短く硬い「カッ」を鳴らす。これが鳴りだしの気持ちよさを作る（元の音と同じ）。マリンバは間を詰めて0.03秒から */
    nz(0.03, 0.35, 4200, 1); tone(1900, 0.04, 0.09, 'square');
    marimba(660, 0.15, 0.03); marimba(990, 0.13, 0.09); marimba(1320, 0.13, 0.15); marimba(1980, 0.07, 0.21);
  }
  function chord(freqs, dur, vol, delay) {
    if (!A.ctx) return;
    try {
      var c = A.ctx, t = c.currentTime + (delay || 0), lp = c.createBiquadFilter(), gg = c.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(gg); gg.connect(A.master);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(vol, t + 0.09); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      freqs.forEach(function (f) { [-4, 4].forEach(function (ct) { var o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = ct; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); }); });
    } catch (e) {}
  }
  /* 10個解除。リレーがカチッと止まり、電源が落ちる音のあとに、明るい和音と鐘。ノーミスならきらめきを足す */
  function playClear(perfect) {
    nz(0.05, 0.35, 260, 1); tone(95, 0.3, 0.25, 'sine', 45);
    tone(440, 0.6, 0.05, 'triangle', 70, 0.08);
    chord([261.6, 329.6, 392, 523.3], 2.4, 0.045, 0.6);
    chord([130.8, 196], 2.6, 0.04, 0.6);
    tone(1046.5, 1.4, 0.05, 'sine', 0, 0.62); tone(1568, 1.6, 0.035, 'sine', 0, 0.78);
    if (perfect) {
      [2093, 2637, 3136, 4186].forEach(function (f, i) { tone(f, 0.5, 0.025, 'sine', 0, 1.0 + i * 0.09); });
      chord([349.2, 440, 523.3, 659.3], 2.2, 0.035, 1.4);
    }
    vib([20, 60, 20, 60, 120]);
  }
  function nz(dur, vol, freq, q, delay) {
    if (!A.ctx) return;
    try {
      var c = A.ctx, t = c.currentTime + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), gg = c.createGain();
      s.buffer = A.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1.5;
      gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(gg); gg.connect(A.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function setGain(node, v) { if (A.ctx && node) node.gain.setTargetAtTime(v, A.ctx.currentTime, 0.03); }
  function setSound(on) {
    A.on = on; if (A.master) A.master.gain.value = on ? 0.9 : 0;
    if (on) tone(900, 0.04, 0.05, 'square');
    try { saveRec(); } catch (e) {}
  }
  var lastVib = 0;
  function vib(p) {
    if (!A.on) return;
    var n = performance.now(); if (n - lastVib < 35) return; lastVib = n;
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  }

  /* ---------- 状態 ---------- */
  var state = 'title', clock = 0, R0 = null, G = null, cur = null;
  var T = { x: 0.5, y: 0 }, Pv = { x: 0, y: 0 }, pend = { x: 0, y: 0 };
  var bow = { x: 0, y: 0 }, bowV = { x: 0, y: 0 };
  var traces = [], parts = [], floats = [], smokes = [], boomAt = -9, nextPuff = 0;
  var NEEDLE_BEND = 0.4;
  var aimIdx = -1, aimCand = -1, aimT = 0, lockIdx = -1, lockAway = 0;
  var vTip = 0, wasContact = false, lastN = null, lastCorner = 0, slideAcc = 0, vxs = 0, holdT = 0, inGroove = -1, PvS = { x: 0, y: 0 }, pinProg = 0, pinIdx = -1, pressing = false, contact = false, cp = null, pm = 0;
  var shake = 0, openT = 0, fadeIn = 0, overAt = 0, everPinned = false, slideIn = 0, flash = 0;
  /* 記録は「通常／エンドレス」×「上級かどうか」で別々。通常を一度クリアするとエンドレスと上級が遊べる */
  var bestT = {}, bestN = {}, bestP = {}, hardOpen = false, tutDone = false;
  var tutStep = 0, tutT = 0, tutWrong = false, tutSelPrev = -1, tutSelAt = 0;
  try {
    var sb = JSON.parse(localStorage.getItem('probomb_rec') || 'null');
    if (sb) { bestN = sb.n || {}; bestT = sb.t || {}; hardOpen = !!sb.open; if (sb.snd === false) A.on = false; if (sb.lang) LANG = sb.lang; bestP = sb.p || {}; tutDone = !!sb.tut || hardOpen || !!(sb.t && sb.t.normal); }
  } catch (e) {}
  function saveRec() { try { localStorage.setItem('probomb_rec', JSON.stringify({ n: bestN, t: bestT, p: bestP, open: hardOpen, snd: A.on, lang: LANG, tut: tutDone })); } catch (e) {} }
  function mkey() { return (endless ? 'endless' : 'normal') + (hard ? '_hard' : ''); }
  applyLang(LANG);

  function startRun() {
    smokes = []; boomAt = -9;
    /* 上級のルール（候補の形は指を離している間だけ重なる）は、おまけのエンドレスにだけ付く */
    hard = endless;
    R0 = { time: START_TIME, opened: 0, clean: 0, misses: 0, times: [], elapsed: 0, cleared: false, endless: endless, hard: hard, key: mkey(), streak: 0, bestStreak: 0 };
    newLock(); state = 'play'; fadeIn = 0.25;
  }
  /* 初めての1個は練習。タイマーは止めたまま、形のちがう2択で、なぞる→見比べる→押す を順に案内する */
  function startTutorial() {
    smokes = []; boomAt = -9; endless = false; hard = false;
    R0 = { time: START_TIME, opened: 0, clean: 0, misses: 0, times: [], elapsed: 0, cleared: false, endless: false, hard: false, key: 'tut', streak: 0, bestStreak: 0, tut: true };
    newLock(); state = 'play'; fadeIn = 0.25; tutStep = 0; tutT = clock; tutWrong = false;
  }
  function tutUpdate() {
    if (tutStep === 0) {
      var deep = 0; for (var i = 0; i < traces.length; i++) if (traces[i].x > 4.5) deep++;
      if (deep >= 18 || (deep >= 6 && clock - tutT > 12)) { tutStep = 1; tutT = clock; tutSelPrev = G.sel; tutSelAt = 0; tone(1200, 0.08, 0.05, 'sine'); tone(1600, 0.1, 0.04, 'sine', 0, 0.08); }
    } else if (tutStep === 1) {
      /* 重ねる段：自分でタップして形を重ねるまで待つ。重ねてから少し見比べる時間をおいて次へ */
      if (G.sel >= 0 && G.sel !== tutSelPrev && !tutSelAt) tutSelAt = clock;
      if (tutSelAt && clock - tutSelAt > 2.5) { tutStep = 2; tutT = clock; tone(1600, 0.1, 0.04, 'sine'); }
    }
  }
  function newLock() {
    var n = R0 ? R0.opened : 0, cands = R0 && R0.tut ? shuffle([mk('straight', 0, 1), mk('bend', 5.0, 1)]) : genCands(n);
    /* 候補の数だけピンが並ぶ。候補Aが本物ならAのピン、Bが本物ならBのピンが当たり。残りは偽ピン */
    var pins = cands.map(function (c, i) { return { x: PIN_POS[i].x, side: PIN_POS[i].side, scale: 1, dead: false }; });
    cands.forEach(function (c) { c.pins = pins; });
    var secret = Math.floor(Math.random() * cands.length);
    G = { cands: cands, pins: pins, secret: secret, sel: -1, cross: cands.map(function () { return false; }), start: clock, index: n, miss: 0, solved: false };
    cur = {}; for (var k in cands[secret]) cur[k] = cands[secret][k];
    T.x = 0.5; T.y = 0; Pv.x = Pv.y = 0; pend.x = pend.y = 0; bow.x = bow.y = bowV.x = bowV.y = 0;
    traces = []; pinProg = 0; pinIdx = -1; holdT = 0; aimIdx = -1; aimCand = -1; aimT = 0; lockIdx = -1; PvS.x = PvS.y = 0; pressing = false; contact = false; wasContact = false; lastN = null;
  }
  function pinBurst(p, n, col) {
    for (var i = 0; i < n; i++) { var a = rnd(0, Math.PI * 2), sp = rnd(1, 4); parts.push({ x: p.x, y: p.side, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rnd(0.3, 0.7), c: i % 3 ? col : C.pin }); }
  }
  function unlock() {
    var bonus = bonusFor(R0.opened, G.miss), p = G.pins[G.secret];
    if (state === 'review') {
      /* 時間切れ後の答え合わせ。得点にはならない */
      G.solved = true; G.solvedAt = clock; p.scale = 0.2; pinProg = 0; pinIdx = -1; setGain(A.pinG, 0);
      nz(0.03, 0.35, 4200, 1); tone(660, 0.2, 0.1, 'triangle', 0, 0.05); tone(990, 0.3, 0.08, 'triangle', 0, 0.12);
      vib([15, 40, 30]); pinBurst(p, 16, C.brassHi);
      floats.push({ t: 0, text: tr('practiceOK'), x: 5, y: 1, c: C.brassHi });
      return;
    }
    if (R0.tut) {
      /* 練習の解除。記録には数えない */
      state = 'open'; openT = 0; everPinned = true; pinProg = 1; p.scale = 0.2; setGain(A.scrG, 0); setGain(A.pinG, 0);
      playDefuse();
      vib([15, 40, 30]); if (!REDUCED) shake = 6; pinBurst(p, 22, C.brassHi);
      tutDone = true; saveRec(); return;
    }
    state = 'open'; openT = 0; R0.opened++; R0.time += bonus; R0.times.push(clock - G.start);
    if (!G.miss) { R0.clean++; R0.streak++; R0.bestStreak = Math.max(R0.bestStreak, R0.streak); }
    everPinned = true; pinProg = 1; p.scale = 0.2;
    setGain(A.scrG, 0); setGain(A.pinG, 0);
    playDefuse();
    vib([15, 40, 30]); if (!REDUCED) shake = 6;
    pinBurst(p, 22, C.brassHi);
    floats.push({ t: 0, text: tr('cut')(bonus), x: 5, y: 1.7, c: C.brassHi });
    if (R0.opened > (bestN[R0.key] || 0)) { bestN[R0.key] = R0.opened; if (R0.endless) R0.newBest = true; saveRec(); }
    /* 通常は10本でクリア。かかった時間が記録になる。エンドレスは時間切れまで続く */
    if (!R0.endless && R0.opened >= GOAL) {
      if (!R0.misses) bestP[R0.key] = true;
      R0.cleared = true;
      if (!bestT[R0.key] || R0.elapsed < bestT[R0.key]) { bestT[R0.key] = R0.elapsed; R0.newBest = true; }
      if (!hardOpen) { hardOpen = true; R0.unlockedNow = true; }
      saveRec();
    }
  }
  /* 偽ピン。押し込むと引っかかって時間を失う。そのピンは沈んだままになり、候補に×がつく */
  function falsePin(j) {
    var p = G.pins[j], rv = state === 'review';
    p.dead = true; p.scale = 0.2; G.cross[j] = true; pinProg = 0; pinIdx = -1; holdT = 0; aimIdx = -1; aimCand = -1; aimT = 0; lockIdx = -1;
    var cost = missCost();
    if (R0 && R0.tut && !rv) { G.miss++; tutWrong = true; tutStep = 2; }
    else if (!rv) { G.miss++; R0.misses++; R0.time -= cost; R0.streak = 0; }
    setGain(A.pinG, 0);
    tone(120, 0.3, 0.2, 'sawtooth', 60); nz(0.08, 0.3, 500, 1);
    vib([40, 40, 60]); if (!REDUCED) shake = 5;
    pinBurst(p, 10, C.bad);
    floats.push({ t: 0, text: rv ? TH.fake : (R0.tut ? tr('tutWrongFloat') : TH.fake + '  -' + cost + tr('sec')), x: 5, y: 1, c: C.bad });
  }
  /* 時間切れの演出（秒）：衝撃の一瞬（止まる）→ 操作盤のショート → 映像が裂ける → 線になって消える → 砂嵐 → 記録から再現して答えを見せる → 結果 */
  var BOOM = { stop: 0.12, short: 0.2, tear: 0.8, line: 1.15, noise: 1.4, back: 2.1, result: 2.2 };
  /* 時間切れの爆発からの秒。爆発していなければ -1 */
  function boomT() { return R0 && R0.boomed ? clock - boomAt : -1; }
  /* 10個クリアの演出（秒）：時間切れと対になる。止まって白→緑の光 → ランプが波のように走って全部灯る、タイマーは緑で「全回路 停止」
     → 断面図に緑の走査線 → パッドに防爆シャッターが閉まる → 信号弾10発（爆弾の数だけ）→ シャッターが開いて結果 */
  var CLR = { stop: 0.1, lamps: 0.15, scan: 0.3, shut: 0.4, flares: 0.85, open: 1.5, result: 1.75 };
  function clearT() { return R0 && R0.cleared && R0.clearAt !== undefined ? clock - R0.clearAt : -1; }
  function hiCol() { return R0 && R0.perfect ? '#FFD45E' : TH.accent; }
  function hiRGB() { return R0 && R0.perfect ? '255,212,94' : '124,255,155'; }
  function spring(u) { return u <= 0 || REDUCED ? 0 : Math.exp(-u * 5) * Math.sin(u * 14); }
  function gameOver() {
    /* そこまで。最後の鍵の答え（本物の形と正解のピン）をその場で見せる */
    state = 'over'; overAt = clock; drag.on = false; pinProg = 0; pinIdx = -1; setGain(A.scrG, 0); setGain(A.pinG, 0);
    /* ドカン。低い爆発音、閃光、大きな揺れ、火の粉。そのあと煙がプスプス上がり続ける */
    nz(1.2, 0.7, 160, 0.6); nz(0.5, 0.4, 900, 0.8); tone(110, 0.9, 0.35, 'sine', 28);
    vib([80, 30, 160]);
    boomAt = clock; nextPuff = clock + 0.9; R0.boomed = true;
    /* ショートのパチパチ、映像が消える「ヒュン」、砂嵐、復旧の「ピッ」 */
    for (var c0 = 0; c0 < 8; c0++) nz(0.04, 0.12, 3000 + c0 * 300, 2, BOOM.short + c0 * 0.08);
    tone(1500, 0.3, 0.06, 'sine', 80, BOOM.line);
    nz(BOOM.back - BOOM.noise, 0.05, 6000, 0.3, BOOM.noise);
    tone(880, 0.07, 0.05, 'square', 0, BOOM.back); tone(1320, 0.1, 0.05, 'square', 0, BOOM.back + 0.08);
    if (!REDUCED) {
      flash = 0.5; shake = 16;
      for (var i = 0; i < 46; i++) {
        var a = rnd(0, Math.PI * 2), sp = rnd(2, 9);
        parts.push({ x: rnd(4.5, 6.5), y: rnd(-0.5, 0.5), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rnd(0.4, 1.0), c: ['#FFE7A0', '#FFB347', '#FF6B3D'][i % 3] });
      }
    }
    for (var j = 0; j < 14; j++) smokes.push({ x: rnd(3.5, 7.5), y: rnd(-0.8, 0.8), r: rnd(0.5, 1.0), vx: rnd(-0.4, 0.4), vy: rnd(0.4, 1.0), t: -rnd(0, 0.5), max: rnd(2.2, 3.4), dark: 1 });
  }

  /* ---------- 針の移動。壁に当たったら、押した向きのうち壁に沿う成分だけ進む ---------- */
  function moveTip(dx, dy) {
    var res = { blocked: false, n: null, slid: 0 }, d = Math.hypot(dx, dy);
    if (d < 1e-6) return res;
    var steps = Math.min(60, Math.ceil(d / 0.025)), sx0 = dx / steps, sy0 = dy / steps, i, k;
    for (i = 0; i < steps; i++) {
      var sx = sx0, sy = sy0;
      if (valid(cur, T.x + sx, T.y + sy)) { T.x += sx; T.y += sy; continue; }
      res.blocked = true;
      var n = estNormal(cur, T.x, T.y);
      if (!n) break;
      res.n = n;
      var dot = sx * n.x + sy * n.y;
      if (dot < 0) { sx -= dot * n.x; sy -= dot * n.y; }
      /* 壁沿いに逃がした向き → 横だけ → 縦だけ の順に試す。角や入口の縁との挟まりで止まらないように */
      var tries = [[sx, sy], [sx0, 0], [0, sy0]], moved = false, ti;
      for (ti = 0; ti < tries.length && !moved; ti++) {
        var tx = tries[ti][0], ty = tries[ti][1];
        if (Math.hypot(tx, ty) < 2e-4) continue;
        for (k = 0; k < 4; k++) {
          if (valid(cur, T.x + tx, T.y + ty)) { T.x += tx; T.y += ty; res.slid += Math.hypot(tx, ty); moved = true; break; }
          tx *= 0.5; ty *= 0.5;
        }
      }
      if (!moved) break;
    }
    return res;
  }
  function contactPoint() {
    var m = Math.hypot(Pv.x, Pv.y) || 1, dx = Pv.x / m, dy = Pv.y / m;
    var qx = T.x + dx * 0.08, qy = T.y + dy * 0.08;
    if (qx > cur.end - R) return { kind: 'end', x: cur.end, y: T.y, side: 0 };
    /* 針先そのものが壁に入るなら針先の接触、そうでなければ針の胴が角に当たっている */
    var b = bounds(cur, qx);
    if (qy > b[1] - R) return { kind: 'tip', x: T.x + dx * R * 1.2, y: T.y + dy * R * 1.2, side: 1 };
    if (qy < b[0] + R) return { kind: 'tip', x: T.x + dx * R * 1.2, y: T.y + dy * R * 1.2, side: -1 };
    var v = violation(cur, qx, qy);
    if (v) return { kind: 'shaft', x: v.x, y: v.wy, side: v.side };
    return { kind: 'tip', x: T.x + dx * R * 1.2, y: T.y + dy * R * 1.2, side: 0 };
  }
  function addTrace(x, y, s) {
    var l = traces[traces.length - 1];
    if (l && Math.hypot(l.x - x, l.y - y) < 0.035) { l.t = clock; l.s = Math.max(l.s, s); return; }
    traces.push({ x: x, y: y, t: clock, s: s, brk: !l || Math.hypot(l.x - x, l.y - y) > 0.35 || clock - l.t > 0.3 });
    if (traces.length > 1500) traces.shift();
  }
  function spark(x, y, tx, ty, n, col) {
    for (var i = 0; i < n; i++) {
      var sp = rnd(0.6, 2.6), sgn = Math.random() < 0.5 ? -1 : 1;
      parts.push({ x: x, y: y, vx: tx * sp * sgn + rnd(-0.6, 0.6), vy: ty * sp * sgn + rnd(-0.6, 0.6), life: 0, max: rnd(0.12, 0.3), c: col || C.brassHi });
    }
  }

  /* 先をスイッチの溝の真ん中へ少し寄せる。寄せた先の頭の高さに合わせて、先を壁から少し浮かせる（壁を突き抜けない範囲で） */
  function magnet(q) {
    var dx = q.x - T.x; if (Math.abs(dx) < 0.004) return;
    var nx = T.x + dx * Math.min(1, magnetDt * 14), b = bounds(cur, nx);
    var ny = q.side > 0 ? Math.min(T.y, b[1] - R - 0.004) : Math.max(T.y, b[0] + R + 0.004);
    if (valid(cur, nx, ny)) { T.x = nx; T.y = ny; }
  }
  var magnetDt = 1 / 60;
  function physics(dt) {
    magnetDt = dt;
    var fx = pend.x, fy = pend.y; pend.x = pend.y = 0;
    var ox = T.x, oy = T.y, res = { blocked: false };
    if (drag.on) {
      /* 指の動きと、たまっている押す力は別々に動かす。
         一緒にすると押す力が強いときに指の横の動きが打ち消され、壁際で前に進めなくなる */
      var Px = T.x + Pv.x + fx, Py = T.y + Pv.y + fy;
      var r1 = moveTip(fx, fy), r2 = moveTip(Px - T.x, Py - T.y);
      res = { blocked: r1.blocked || r2.blocked, n: r2.n || r1.n, slid: r1.slid + r2.slid };
      Pv.x = Px - T.x; Pv.y = Py - T.y;
      var m = Math.hypot(Pv.x, Pv.y);
      if (m > PMAX) { Pv.x *= PMAX / m; Pv.y *= PMAX / m; }
      if (!res.blocked) Pv.x = Pv.y = 0;
    } else { Pv.x = Pv.y = 0; }

    var mv = Math.hypot(T.x - ox, T.y - oy);
    /* ならし具合は実時間ベース（60fpsで以前と同じ）。高フレームレートの端末でも押し込みの判定が変わらないように */
    var f60 = dt * 60;
    vTip += (mv / dt - vTip) * (1 - Math.pow(0.6, f60));
    vxs += (Math.abs(T.x - ox) / dt - vxs) * (1 - Math.pow(0.7, f60));
    pm = Math.hypot(Pv.x, Pv.y);
    contact = res.blocked && pm > 0.004 && T.x > 0.3;
    cp = contact ? contactPoint() : null;

    if (contact) {
      var str = 0.45 + 0.55 * Math.min(1, pm / 0.3), jit = Math.min(vTip, 8) * 0.006;
      addTrace(cp.x + rnd(-jit, jit), cp.y + rnd(-jit, jit), str);
      if (!wasContact && vTip > 0.8) {
        var hard = Math.min(1, vTip / 14);
        tone(cp.kind === 'shaft' ? 220 : 150, 0.09, 0.06 + 0.22 * hard, 'sine', 70);
        nz(0.025, 0.08 + 0.2 * hard, 2600, 1.2);
        vib(Math.round(6 + 22 * hard));
        if (!REDUCED) shake = Math.max(shake, 1 + 3.5 * hard);
        spark(cp.x, cp.y, -(res.n ? res.n.y : 0), res.n ? res.n.x : 1, 3 + Math.round(6 * hard));
      }
      if (wasContact && res.n && lastN && clock - lastCorner > 0.09) {
        var ang = Math.acos(clamp(res.n.x * lastN.x + res.n.y * lastN.y, -1, 1));
        if (ang > 0.7) { lastCorner = clock; tone(2300, 0.03, 0.06, 'square'); nz(0.015, 0.12, 5000, 2); vib(8); spark(cp.x, cp.y, -res.n.y, res.n.x, 4); }
      }
      var slideV = res.slid / dt;
      slideAcc += res.slid;
      if (slideAcc > 0.18) { slideAcc = 0; nz(0.012, 0.05 + 0.04 * Math.min(1, pm / 0.3), rnd(2600, 3600), 3); vib(3); }
      if (slideV > 0.6 && Math.random() < Math.min(0.9, slideV * 0.12) * f60 && res.n) spark(cp.x, cp.y, -res.n.y, res.n.x, 1);
      if (A.ctx) {
        setGain(A.scrG, slideV > 0.15 ? Math.min(0.16, 0.025 + slideV * 0.018) * (0.6 + pm) : 0);
        A.scrBP.frequency.setTargetAtTime(450 + (cp.y + 3) * 230 + slideV * 30, A.ctx.currentTime, 0.03);
      }
      if (res.n) lastN = res.n;
    } else { setGain(A.scrG, 0); lastN = null; slideAcc = 0; }
    wasContact = contact;

    /* ピン。押し込み続けると、本物なら開き、偽ピンなら引っかかる。押した感触はどちらも同じ */
    var hit = -1, j;
    /* 針先がピンの頭か肩に触れていて、横よりもピンの向きに強く押していれば「押している」。
       横に滑っている最中や、滑らせてピンの肩にぶつかっただけでは溜まらない（通り過ぎるだけで誤って押さないように）。
       押す力は少しならして使う（ピンが沈んで針先が一瞬浮いたときに途切れないように） */
    var kS = Math.min(1, dt * 10);
    PvS.x += (Pv.x - PvS.x) * kS; PvS.y += (Pv.y - PvS.y) * kS;
    var bw = bounds(cur, T.x), grooveNow = -1;
    if (OLD_PRESS) {
      if (drag.on) {
        for (j = 0; j < G.pins.length; j++) {
          var q = G.pins[j], gap = q.side > 0 ? bw[1] - T.y : T.y - bw[0], push = PvS.y * q.side;
          if (q.dead || Math.abs(T.x - q.x) >= PIN_W + 0.06 || gap >= R + 0.06) continue;
          if (Math.abs(T.x - q.x) < 0.05) grooveNow = j;
          if (push > PIN_PUSH && push > 0.6 * Math.abs(PvS.x)) hit = j;
        }
      }
    } else {
      /* いま先が触れているスイッチ（いちばん近いもの） */
      var touch = -1;
      if (drag.on) for (j = 0; j < G.pins.length; j++) {
        var q1 = G.pins[j], gap1 = q1.side > 0 ? bw[1] - T.y : T.y - bw[0];
        if (q1.dead || Math.abs(T.x - q1.x) >= PIN_W + 0.06 || gap1 >= R + 0.06) continue;
        if (Math.abs(T.x - q1.x) < 0.05) grooveNow = j;
        if (touch < 0 || Math.abs(T.x - q1.x) < Math.abs(T.x - G.pins[touch].x)) touch = j;
      }
      /* C 狙いの一拍：同じスイッチの頭にゆっくり触れたまま AIM_TIME 秒たつと照準が付く。通り過ぎる・かするだけでは付かない */
      /* 照準が付くのは、スイッチの方へまっすぐ押しているときだけ（横へ滑らせようとして肩に引っかかっただけでは付かない） */
      var aimPush = touch >= 0 ? PvS.y * G.pins[touch].side : 0, straight = aimPush > 0.05 && aimPush > 1.2 * Math.abs(PvS.x);
      /* A 吸い付き：照準が付いたスイッチの方へ押していると、先が肩を乗り越えて溝の真ん中へ寄っていく。
         頭の肩は斜めなので、何もしないと押すほど外の縁へ滑ってしまう（押しにくさの一番の原因だった） */
      if (touch >= 0 && vxs < 0.8) {
        var tq = G.pins[touch], toward = (tq.x - T.x) * PvS.x > 0.002;   // 真ん中の方へ横に押している
        if (touch === aimIdx || touch === lockIdx ? aimPush > 0 : (aimPush > 0.03 && (toward || straight))) magnet(tq);
      }
      if (touch >= 0 && touch === aimCand && straight) aimT += dt; else { aimCand = touch; aimT = 0; }
      if (touch >= 0 && aimIdx !== touch && lockIdx < 0 && aimT >= AIM_TIME) {
        aimIdx = touch; tone(2200, 0.03, 0.05, 'square'); tone(1650, 0.05, 0.04, 'sine', 0, 0.03); vib(12);
      }
      var tgt = lockIdx >= 0 ? lockIdx : aimIdx;
      if (drag.on && tgt >= 0 && !G.pins[tgt].dead) {
        var q2 = G.pins[tgt], locked = lockIdx >= 0, dx2 = Math.abs(T.x - q2.x), gap2 = q2.side > 0 ? bw[1] - T.y : T.y - bw[0], push2 = PvS.y * q2.side;
        var near = dx2 < PIN_W + (locked ? 0.15 : 0.06) && gap2 < R + (locked ? 0.14 : 0.06);
        /* ロックするまでは、まっすぐ押している間だけたまる。ロックしたら横にぶれても続く */
        if (near && push2 > PIN_PUSH * (locked ? 0.6 : 1) && (locked || push2 > 1.2 * Math.abs(PvS.x))) hit = tgt;
        if (!locked && Math.abs(PvS.x) > push2 * 1.5 && Math.abs(PvS.x) > 0.15) aimIdx = -1;   // はっきり横へ押したら照準を外す
        /* 範囲から一瞬出ただけではロックを外さない（0.25秒まで） */
        if (!near) { lockAway += dt; if (!locked || lockAway > 0.25) { lockIdx = -1; lockAway = 0; if (touch !== tgt) aimIdx = -1; } } else lockAway = 0;
      } else if (!drag.on) { lockIdx = -1; aimIdx = -1; aimCand = -1; aimT = 0; }
    }
    /* 溝にはまった瞬間に小さくカチッ */
    if (grooveNow >= 0 && grooveNow !== inGroove) { tone(1500, 0.025, 0.06, 'square'); nz(0.01, 0.08, 4000, 2); vib(10); }
    inGroove = grooveNow;
    if (hit >= 0 && hit !== pinIdx) { pinIdx = hit; pinProg = 0; }
    pressing = hit >= 0 && (OLD_PRESS ? vxs < PIN_SLIDE : true);
    /* B ロックオン：2割たまったら、そのスイッチから離れない限り途切れない */
    if (!OLD_PRESS && pressing && pinProg >= LOCK_AT) lockIdx = hit;
    /* 一瞬途切れても0.3秒は進み具合を保つ。それを過ぎたらゆっくり戻る */
    if (pressing) {
      pinProg += dt / (OLD_PRESS ? PIN_TIME : 0.4); holdT = PIN_HOLD;
      if (Math.random() < 0.3 * dt * 60) nz(0.01, 0.04, 1800 + pinProg * 2000, 4);
      if (pinProg >= 1) { if (hit === G.secret) { unlock(); return; } falsePin(hit); }
    } else if (holdT > 0) holdT -= dt;
    else pinProg = Math.max(0, pinProg - dt * 0.9);
    for (j = 0; j < G.pins.length; j++) if (!G.pins[j].dead) G.pins[j].scale = j === pinIdx ? 1 - 0.8 * Math.min(1, pinProg) : 1;
    if (A.ctx) { setGain(A.pinG, pressing ? 0.05 : 0); A.pinO.frequency.setTargetAtTime(200 + 520 * pinProg, A.ctx.currentTime, 0.03); }
    if (!valid(cur, T.x, T.y)) { var sd = T.y > 0 ? 1 : -1; for (var i = 0; i < 30 && !valid(cur, T.x, T.y); i++) T.y -= sd * 0.01; }
  }

  function update(dt) {
    clock += dt;
    var bt0 = boomT(); if (bt0 >= 0 && bt0 < BOOM.stop && !REDUCED) return;
    var ct0 = clearT(); if (ct0 >= 0 && ct0 < CLR.stop && !REDUCED) return;
    shake *= Math.exp(-dt * 14);
    fadeIn = Math.max(0, fadeIn - dt); slideIn = Math.max(0, slideIn - dt / 0.3); flash = Math.max(0, flash - dt * 1.6);
    if (state === 'play') {
      if (R0.tut) tutUpdate(); else { R0.time -= dt; R0.elapsed += dt; }
      if (R0.time <= 0) { R0.time = 0; gameOver(); }
      else physics(dt);
    } else if (state === 'review') {
      physics(dt);
    } else if (state === 'open') {
      openT += dt; pend.x = pend.y = 0;
      if (openT >= 1.15) {
        if (R0.cleared) {
          state = 'over'; overAt = clock; drag.on = false; R0.perfect = R0.misses === 0; R0.clearAt = clock;
          playClear(R0.perfect);
          /* 信号弾がはじける音（10発） */
          for (var fb = 0; fb < 10; fb++) { var ft = CLR.flares + fb * 0.11 + 0.4; nz(0.08, 0.1, 2200 + fb * 150, 1.2, ft); tone(2600 + fb * 120, 0.18, 0.012, 'sine', 0, ft + 0.02); }
        }
        else if (R0.tut) { state = 'tutEnd'; overAt = clock; drag.on = false; }
        else { newLock(); state = 'play'; fadeIn = 0.25; if (!REDUCED) slideIn = 1; }
      }
    } else { pend.x = pend.y = 0; }
    /* 針のしなり。手元は押したい向き（針先＋押す力）を向き、先だけが壁に止められて曲がる。離すとぷるんと戻る */
    var btx = Pv.x * 1.6, bty = Pv.y * 1.6;
    bowV.x += ((btx - bow.x) * 260 - bowV.x * 9) * dt; bowV.y += ((bty - bow.y) * 260 - bowV.y * 9) * dt;
    bow.x += bowV.x * dt; bow.y += bowV.y * dt;
    /* 爆発のあと、ときどきプスッと煙が上がる */
    if (state === 'over' && clock > nextPuff) {
      nextPuff = clock + rnd(0.8, 1.8);
      var px0 = rnd(3.5, 8), n0 = 2 + Math.floor(Math.random() * 3);
      for (var si = 0; si < n0; si++) smokes.push({ x: px0 + rnd(-0.3, 0.3), y: rnd(-0.4, 0.4), r: rnd(0.25, 0.45), vx: rnd(-0.15, 0.15), vy: rnd(0.5, 0.9), t: -si * 0.08, max: rnd(1.8, 2.6), dark: 0 });
      nz(0.14, 0.05, 700, 0.9);
    }
    for (var k2 = smokes.length - 1; k2 >= 0; k2--) {
      var sm = smokes[k2]; sm.t += dt; if (sm.t > sm.max) { smokes.splice(k2, 1); continue; }
      if (sm.t > 0) { sm.x += sm.vx * dt; sm.y += sm.vy * dt; sm.r += dt * 0.45; sm.vx *= Math.pow(0.99, dt * 60); }
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i]; q.life += dt; if (q.life > q.max) { parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 6 * dt; var dmp = Math.pow(0.96, dt * 60); q.vx *= dmp; q.vy *= dmp;
    }
    for (i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; if (floats[i].t > 1.3) floats.splice(i, 1); }
  }

  /* ---------- 画面配置 ---------- */
  /* 画面は360×640の設計サイズで作り、端末に合わせて拡大縮小する（アヒルメーカーと同じ）。余った所は背景色 */
  var DESIGN_W = 360, DESIGN_H = 640;
  var W = DESIGN_W, H = DESIGN_H, DPR = 1, L = {}, VW = 1, VH = 1, S = 1, OX = 0, OY = 0;
  function layout() {
    var colW = W - 24, x0 = 12, y = 8, i;
    L.hud = { x: x0, y: y - 2, w: colW, h: 54 }; y += 58;
    var cw = (colW - 8) / 2, ch = Math.round(clamp(cw * 0.36, 52, 72)), vh = Math.round(Math.min(colW * 0.5, 210));
    L.cards = [];
    function cards() { for (i = 0; i < 4; i++) L.cards.push({ x: x0 + (i % 2) * (cw + 8), y: y + Math.floor(i / 2) * (ch + 8), w: cw, h: ch }); y += 2 * (ch + 8) + 2; }
    function view() { L.view = { x: x0, y: y, w: colW, h: vh }; y += vh + 8; }
    /* 「真ん中」は断面図を上へ、候補をパッドのすぐ上へ。親指が候補に届き、ABCDの2×2も鍵穴のピン配置と揃ったまま */
    if (V.layout === 'mid') { view(); cards(); } else { cards(); view(); }
    L.pad = { x: x0, y: y, w: colW, h: Math.max(110, H - y - 12) };
    L.k = colW / 14.2; L.ox = x0 + 3.4 * L.k; L.oy = L.view.y + vh / 2;
    /* 音の切り替えはタイマーのすぐ左 */
    /* 操作盤：左に解除ランプ、右にタイマー表示、その間に音の切り替え */
    L.lcd = { x: x0 + colW - 10 - 104, y: L.hud.y + 6, w: 104, h: 42 };
    L.lamps = { x: x0 + 12, y: L.hud.y + 6, w: 116, h: 42 };
    var mid = (L.lamps.x + L.lamps.w + L.lcd.x) / 2;
    L.snd = { x: L.lcd.x - 8 - 76, y: L.hud.y + 27 - 15, w: 76, h: 30 };
    var bw = (colW - 36) / 2, byy = L.pad.y + L.pad.h - 64;
    L.btnRev = { x: x0 + 12, y: byy, w: bw, h: 50 };
    L.btnRetry = { x: x0 + 24 + bw, y: byy, w: bw, h: 50 };
    L.back = { x: x0 + colW - 118, y: L.pad.y + 8, w: 110, h: 32 };
    L.btnSkip = { x: L.pad.x + L.pad.w / 2 - 44, y: L.pad.y + L.pad.h - 32, w: 88, h: 24 };
    L.btnTutGo = { x: L.pad.x + 30, y: L.pad.y + L.pad.h - 74, w: L.pad.w - 60, h: 52 };
    L.btnTitle = { x: x0 + colW - 104, y: L.pad.y + 10, w: 92, h: 30 };
    var tb = Math.min(W - 32, 400), tx = (W - tb) / 2, hw2 = (tb - 10) / 2;
    L.btnNormal = { x: tx, y: H - 214, w: tb, h: 92 };
    L.btnEndless = { x: tx + 24, y: H - 104, w: tb - 48, h: 52 };
  }
  function resize() {
    var r = cv.getBoundingClientRect();
    VW = Math.max(1, r.width); VH = Math.max(1, r.height); DPR = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    S = Math.min(VW / DESIGN_W, VH / DESIGN_H); OX = (VW - DESIGN_W * S) / 2; OY = (VH - DESIGN_H * S) / 2;
    layout();
  }
  window.addEventListener('resize', resize);
  var shX = 0, shY = 0;
  function sx(x) { return L.ox + x * L.k + shX; }
  function sy(y) { return L.oy - y * L.k + shY; }
  /* 見た目より広く受け付ける（音の切り替えなど小さいもの用） */
  function fillAll() { g.fillRect(-OX / S, -OY / S, VW / S, VH / S); }
  function inPad(r, p, m) { return p.x >= r.x - m && p.x <= r.x + r.w + m && p.y >= r.y - m && p.y <= r.y + r.h + m; }
  function inR(r, p) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  /* ---------- 入力（相対操作。針先は指が動いた分だけ動く） ---------- */
  var drag = { on: false, id: null, lx: 0, ly: 0, fx: 0, fy: 0 }, tap = null;
  function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - OX) / S, y: (e.clientY - r.top - OY) / S }; }
  cv.addEventListener('pointerdown', function (e) {
    aInit();
    var p = pt(e);
    if (state === 'title') {
      if (L.sndTitle && inPad(L.sndTitle, p, 8)) { setSound(!A.on); return; }
      if (L.langTitle && inPad(L.langTitle, p, 8)) { applyLang(LANG === 'ja' ? 'en' : 'ja'); saveRec(); tone(900, 0.03, 0.04, 'square'); return; }
      if (L.btnPractice && inPad(L.btnPractice, p, 6)) { startTutorial(); return; }
      if (inR(L.btnNormal, p)) { endless = false; if (tutDone) startRun(); else startTutorial(); }
      else if (hardOpen && inR(L.btnEndless, p)) { endless = true; startRun(); }
      return;
    }
    if (state !== 'open') {
      for (var ci = 0; ci < G.cands.length; ci++) {
        if (inR(L.cards[ci], p)) { tap = { kind: 'card', i: ci, x: p.x, y: p.y, id: e.pointerId }; return; }
      }
    }
    /* 音はいつでも切り替えられる（結果画面や答え合わせ中も） */
    if (inPad(L.snd, p, 10)) { setSound(!A.on); return; }
    if (state === 'tutEnd') { if (clock - overAt > 0.5 && inR(L.btnTutGo, p)) { endless = false; startRun(); } return; }
    if (R0 && R0.tut && state === 'play' && inPad(L.btnSkip, p, 6)) { tutDone = true; saveRec(); endless = false; startRun(); return; }
    if (state === 'over') {
      if (R0.boomed && boomT() < BOOM.result) { boomAt = clock - BOOM.result; return; }
      if (R0.cleared && clearT() < CLR.result + 0.4) { R0.clearAt = clock - CLR.result - 0.4; return; }
      if (resultT() < 0.5) return;
      if (inR(L.btnRev, p)) {
        /* 何度でも確かめられるよう、ピンと×を元に戻してから入る */
        if (G.solved) { G.solved = false; G.pins.forEach(function (q) { q.dead = false; q.scale = 1; }); G.cross = G.cross.map(function () { return false; }); pinProg = 0; pinIdx = -1; }
        state = 'review'; return;
      }
      if (inR(L.btnRetry, p)) startRun();
      if (inR(L.btnTitle, p)) { state = 'title'; }
      return;
    }
    if (state === 'review' && inR(L.back, p)) { drag.on = false; G.sel = -1; state = 'over'; overAt = clock - 1; return; }
    if (inR(L.pad, p)) {
      if (e.clientX < SCREEN_EDGE || e.clientX > window.innerWidth - SCREEN_EDGE || p.x < L.pad.x + PAD_EDGE || p.x > L.pad.x + L.pad.w - PAD_EDGE) return;
      drag.on = true; drag.id = e.pointerId; drag.lx = e.clientX; drag.ly = e.clientY; drag.fx = p.x; drag.fy = p.y; drag.sx = p.x; drag.sy = p.y; drag.t0 = clock; drag.mv = 0;
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
    }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag.on || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.mv += Math.hypot(dx, dy);
    var p = pt(e); drag.fx = clamp(p.x, L.pad.x, L.pad.x + L.pad.w); drag.fy = clamp(p.y, L.pad.y, L.pad.y + L.pad.h);
    if (state === 'play' || state === 'review') { pend.x += dx / S / L.k * GAIN; pend.y -= dy / S / L.k * GAIN; }
  });
  function release(e) {
    if (drag.on && e.pointerId === drag.id) {
      drag.on = false;
      /* 四隅タップ：パッドを動かさずに短くタップした位置で候補を選ぶ（左上A・右上B・左下C・右下D） */
      if (V.pick === 'quad' && drag.mv < 10 && clock - drag.t0 < 0.25 && G && state !== 'open') {
        /* 候補が2つ（練習）のときは左半分がA、右半分がB */
        var qi = (drag.sx > L.pad.x + L.pad.w / 2 ? 1 : 0) + (G.cands.length > 2 && drag.sy > L.pad.y + L.pad.h / 2 ? 2 : 0);
        if (qi < G.cands.length) { G.sel = G.sel === qi ? -1 : qi; tone(900, 0.03, 0.04, 'square'); vib(8); }
      }
    }
    if (tap && e.pointerId === tap.id) {
      var p = pt(e), r = L.cards[tap.i];
      if (inR(r, p) && Math.hypot(p.x - tap.x, p.y - tap.y) < 14 && G && tap.i < G.cands.length) {
        if (p.x < r.x + 32) G.cross[tap.i] = !G.cross[tap.i];
        else G.sel = G.sel === tap.i ? -1 : tap.i;
        tone(900, 0.03, 0.04, 'square');
      }
      tap = null;
    }
  }
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);

  /* ---------- 描画 ---------- */
  function rr(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function cavPath(c, X, Y, noPin) {
    var x, b, e = c.end;
    g.beginPath();
    for (x = 0; x < e; x += 0.05) { b = bounds(c, x, noPin); if (x === 0) g.moveTo(X(x), Y(b[1])); else g.lineTo(X(x), Y(b[1])); }
    b = bounds(c, e, noPin); g.lineTo(X(e), Y(b[1])); g.lineTo(X(e), Y(b[0]));
    for (x = e; x >= 0; x -= 0.05) { b = bounds(c, Math.max(0, x), noPin); g.lineTo(X(x), Y(b[0])); }
    g.closePath();
  }
  function txt(s, x, y, size, col, align, font, weight) {
    g.font = (weight || 400) + ' ' + size + 'px ' + (font || FONT);
    g.fillStyle = col; g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillText(s, x, y);
  }
  function diamond(x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); }

  /* ノーミスの判子。結果が出てから少し遅れて、どんと押される */
  function drawStamp(cx, cy, t) {
    var k = clamp((t - 0.35) / 0.18, 0, 1); if (k <= 0) return;
    var sc = 1 + 0.8 * (1 - k);
    g.save(); g.translate(cx, cy); g.rotate(-0.16); g.scale(sc, sc); g.globalAlpha = k;
    rr(-40, -14, 80, 28, 5); g.strokeStyle = '#FFE7A0'; g.lineWidth = 2.2; g.stroke();
    rr(-36, -10, 72, 20, 3); g.strokeStyle = 'rgba(255,231,160,0.5)'; g.lineWidth = 1; g.stroke();
    txt('PERFECT', 0, 1, 14, '#FFE7A0', 'center', MONO, 800);
    g.restore();
  }
  /* 上の操作盤。爆弾のケースと同じ金属の板に、解除ランプ・音の切り替え・7セグのタイマーを並べる */
  /* ショートの火花（決まった乱数で、毎回同じ散り方） */
  function lampSparks(x, y, t, seed) {
    if (t < 0 || t > 0.6 || REDUCED) return;
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,220,140,' + (1 - t / 0.6) + ')';
    for (var i = 0; i < 7; i++) {
      var a = hash(seed + i) * 6.283, sp = 40 + 120 * hash(seed + i + 50), px = x + Math.cos(a) * sp * t, py = y + Math.sin(a) * sp * t + 80 * t * t;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.cos(a) * 6, py - Math.sin(a) * 6); g.stroke();
    }
  }
  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function drawHUD() {
    var h = L.hud, t = R0 ? Math.max(0, R0.time) : START_TIME, opened = R0 ? R0.opened : 0, en = R0 ? R0.endless : endless;
    var dead = state === 'over' || state === 'review', urgent = state === 'play' && t < 10;
    var bt = boomT(), strobe = bt > 0.15 && bt < 1.1 && Math.floor(bt * 6) % 2 === 0;
    /* 板 */
    rr(h.x, h.y, h.w, h.h, 10);
    var gr = g.createLinearGradient(0, h.y, 0, h.y + h.h); gr.addColorStop(0, '#1C2D23'); gr.addColorStop(1, '#0E1813');
    var won = clearT() >= CLR.lamps;
    g.fillStyle = gr; g.fill(); g.strokeStyle = strobe ? '#FF4B33' : (won ? hiCol() : '#2F5C40'); g.lineWidth = strobe ? 2.5 : (won ? 2 : 1.2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(h.x + 10, h.y + 1, h.w - 20, 1);
    [[h.x + 5, h.y + 5], [h.x + h.w - 5, h.y + 5], [h.x + 5, h.y + h.h - 5], [h.x + h.w - 5, h.y + h.h - 5]].forEach(function (b) { g.beginPath(); g.arc(b[0], b[1], 1.8, 0, 6.283); g.fillStyle = '#3D6B4E'; g.fill(); });

    /* 左：解除の数 */
    var lp = L.lamps;
    txt(R0 && R0.tut ? tr('practiceLabel') : TH.count + (en || LANG === 'en' ? '' : ' ' + opened + '/' + GOAL), lp.x, lp.y + 6, 10, C.muted, 'left', FONT, 700);
    if (R0 && R0.streak >= 2) txt(tr('streak') + R0.streak, lp.x + lp.w, lp.y + 6, 10, TH.accent, 'right', FONT, 700);
    if (!en) {
      /* 10個のランプ。解除した分が緑に灯る。次の1個は薄く点滅 */
      var n = GOAL, lw = 8, gap = (lp.w - n * lw) / (n - 1);
      for (var i = 0; i < n; i++) {
        var lx = lp.x + i * (lw + gap), ly = lp.y + 16, lh = 22, on = i < opened;
        var fresh = state === 'open' && i === opened - 1;
        rr(lx, ly, lw, lh, 3); g.fillStyle = '#07100B'; g.fill(); g.strokeStyle = '#24452F'; g.lineWidth = 1; g.stroke();
        var ctL = clearT();
        if (on && ctL >= CLR.lamps) {
          /* クリア：光が端から端へ2回走り、そのあと全部が明るく灯ったまま脈打つ（ノーミスなら金色） */
          var u = ctL - CLR.lamps, wv = 0;
          for (var r2 = 0; r2 < 2; r2++) { var hd = (u - r2 * 0.45) / 0.35 * 11; wv = Math.max(wv, Math.max(0, 1 - Math.abs(hd - i) / 1.6)); }
          var bri = REDUCED ? 1 : (u > 1.0 ? 0.75 + 0.25 * Math.sin(clock * 4 + i * 0.4) : Math.max(0.6, wv));
          g.save(); g.shadowColor = bri > 0.85 ? '#ffffff' : hiCol(); g.shadowBlur = 6 + 14 * bri; g.globalAlpha = 0.55 + 0.45 * bri;
          rr(lx + 1.5, ly + 1.5, lw - 3, lh - 3, 2); g.fillStyle = bri > 0.85 ? '#F4FFF7' : hiCol(); g.fill(); g.restore();
        } else if (on) {
          g.save(); g.shadowColor = TH.accent; g.shadowBlur = fresh ? 14 : 6;
          rr(lx + 1.5, ly + 1.5, lw - 3, lh - 3, 2); g.fillStyle = fresh ? '#D8FFE4' : TH.accent; g.fill(); g.restore();
        } else if (i === opened && state === 'play') {
          rr(lx + 1.5, ly + 1.5, lw - 3, lh - 3, 2); g.fillStyle = 'rgba(124,255,155,' + (0.12 + 0.12 * Math.sin(clock * 5)) + ')'; g.fill();
        }
        /* 時間切れ：まだ灯っていないランプが、端から火花を散らして割れる。解除できた分は緑のまま */
        var lt0 = BOOM.short + (i - opened) * 0.08;
        if (!on && bt >= lt0) {
          rr(lx + 1.5, ly + 1.5, lw - 3, lh - 3, 2); g.fillStyle = 'rgba(0,0,0,0.7)'; g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1; g.beginPath(); g.moveTo(lx + 2, ly + 3); g.lineTo(lx + 6, ly + 12); g.lineTo(lx + 3, ly + 19); g.stroke();
          lampSparks(lx + lw / 2, ly + lh / 2, bt - lt0, i * 13);
        }
      }
    } else {
      /* エンドレスは個数を緑の7セグで */
      rr(lp.x, lp.y + 15, lp.w, 25, 5); g.fillStyle = '#07100B'; g.fill(); g.strokeStyle = '#24452F'; g.lineWidth = 1; g.stroke();
      txt('888', lp.x + lp.w - 26, lp.y + 28, 20, 'rgba(124,255,155,0.07)', 'right', MONO, 700);
      g.save(); g.shadowColor = TH.accent; g.shadowBlur = 8;
      txt(String(opened), lp.x + lp.w - 26, lp.y + 28, 20, TH.accent, 'right', MONO, 700); g.restore();
      txt(TH.unitN, lp.x + lp.w - 8, lp.y + 29, 11, C.muted, 'right', FONT, 700);
    }

    /* 中：音 */
    drawSpeaker(L.snd);

    /* 右：連動起爆までの7セグ。残り10秒で枠が赤く脈打つ。終わったら消えた表示で止まる */
    var lc = L.lcd, ctD = clearT();
    if (ctD >= CLR.lamps) {
      /* クリア：タイマーは止まった数字のまま緑（ノーミスなら金色）になり、「全回路 停止」。はじめは点滅 */
      rr(lc.x, lc.y, lc.w, lc.h, 6); g.fillStyle = '#07140C'; g.fill(); g.strokeStyle = hiCol(); g.lineWidth = 2; g.stroke();
      txt(tr('allStop'), lc.x + 7, lc.y + 8, 9, hiCol(), 'left', FONT, 700);
      var ds2 = (t < 10 ? '0' : '') + t.toFixed(1);
      if (REDUCED || ctD > 1.2 || Math.floor(ctD * 5) % 2 === 0) { g.save(); g.shadowColor = hiCol(); g.shadowBlur = 10; txt(ds2, lc.x + lc.w - 8, lc.y + lc.h / 2 + 6, 26, hiCol(), 'right', MONO, 700); g.restore(); }
      return;
    }
    rr(lc.x, lc.y, lc.w, lc.h, 6); g.fillStyle = '#1A0705'; g.fill();
    var pulse = urgent ? 0.5 + 0.5 * Math.sin(clock * 10) : 0;
    g.strokeStyle = urgent ? 'rgba(255,75,51,' + (0.4 + 0.6 * pulse) + ')' : '#4A1A14'; g.lineWidth = urgent ? 2 : 1.2; g.stroke();
    var shortNow = bt >= 0.15 && bt < 0.95, lcdOff = R0 && R0.boomed && bt >= 0.95;
    txt(TH.timerLabel, lc.x + 7, lc.y + 8, 9, lcdOff ? '#3A1510' : (dead && !shortNow ? '#5A2018' : '#FF7A5C'), 'left', FONT, 700);
    var ds = (t < 10 ? '0' : '') + t.toFixed(1), dx = lc.x + lc.w - 8, dy = lc.y + lc.h / 2 + 6;
    if (shortNow) ds = ['8.8.8', '0E.1', '-.-.-', '7#.3', 'Er.r'][Math.floor(bt * 14) % 5];
    txt('88.8', dx, dy, 26, 'rgba(255,75,51,0.08)', 'right', MONO, 700);
    if (!lcdOff) {
      g.save(); if (!dead || shortNow) { g.shadowColor = 'rgba(255,60,40,0.85)'; g.shadowBlur = 10; }
      txt(ds, dx, dy, 26, dead && !shortNow ? '#5A2018' : (urgent && Math.floor(clock * 4) % 2 ? '#FFA48C' : '#FF4B33'), 'right', MONO, 700);
      g.restore();
    }
    if (bt >= 0.9 && bt < 1.5) lampSparks(lc.x + lc.w * 0.7, lc.y + lc.h / 2, bt - 0.9, 77);
  }

  function drawCard(i) {
    var r = L.cards[i];
    if (!G || i >= G.cands.length) { rr(r.x, r.y, r.w, r.h, 8); g.strokeStyle = C.panel2; g.setLineDash([4, 4]); g.lineWidth = 1; g.stroke(); g.setLineDash([]); return; }
    var c = G.cands[i], sel = G.sel === i, crossed = G.cross[i], col = ABCD_COL[i];
    var rev = (state === 'open' || state === 'over' || state === 'review') && i === G.secret;
    var shapeCol = '124,255,155';
    g.save();
    {
      /* 型番の設計図 */
      rr(r.x, r.y, r.w, r.h, 6); g.fillStyle = C.panel; g.fill();
      g.save(); rr(r.x, r.y, r.w, r.h, 6); g.clip(); g.strokeStyle = 'rgba(124,255,155,0.06)'; g.lineWidth = 1;
      for (var gx = r.x + 6; gx < r.x + r.w; gx += 8) { g.beginPath(); g.moveTo(gx, r.y); g.lineTo(gx, r.y + r.h); g.stroke(); }
      g.restore();
      rr(r.x, r.y, r.w, r.h, 6); g.lineWidth = rev || sel ? 2.5 : 1.2;
      g.strokeStyle = rev ? 'rgb(' + C.ok + ')' : (sel ? col : C.line); g.stroke();
    }
    /* 色つきの文字札 */
    rr(r.x + 7, r.y + 7, 20, 20, 5); g.fillStyle = col; g.fill();
    txt('ABCD'.charAt(i), r.x + 17, r.y + 17.5, 13, '#111111', 'center', MONO, 800);
    txt(TH.cardTag(i), r.x + r.w - 9, r.y + 12, 10, C.muted, 'right', MONO, 600);
    var bx = r.x + 17, by = r.y + r.h - 16;
    g.beginPath(); g.arc(bx, by, 9, 0, Math.PI * 2); g.strokeStyle = crossed ? C.bad : C.line; g.lineWidth = 1.5; g.stroke();
    if (crossed) { g.beginPath(); g.moveTo(bx - 5, by - 5); g.lineTo(bx + 5, by + 5); g.moveTo(bx + 5, by - 5); g.lineTo(bx - 5, by + 5); g.strokeStyle = C.bad; g.lineWidth = 2; g.stroke(); }
    var ix = r.x + 34, iw = r.w - 42, kc = Math.min(iw / 10, (r.h - 10) / 5.6), cy = r.y + r.h / 2 + 2;
    var X = function (x) { return ix + x * kc; }, Y = function (y) { return cy - y * kc; };
    g.globalAlpha = crossed ? 0.28 : 1;
    cavPath(c, X, Y); g.fillStyle = 'rgba(' + shapeCol + ',0.12)'; g.fill(); g.strokeStyle = 'rgba(' + shapeCol + ',0.8)'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = C.brass; g.fillRect(X(0) - 2, Y(LIP_H), 2, (2 * LIP_H) * kc);
    /* この候補が本物なら当たりになるピン */
    var p = G.pins[i];
    diamond(X(p.x), Y(p.side * 0.88), 4.5); g.fillStyle = col; g.fill();
    g.restore();
    /* 練習：見比べる段では候補カードを光らせる */
    if (R0 && R0.tut && tutStep === 1 && state === 'play') {
      rr(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 9); g.strokeStyle = 'rgba(124,255,155,' + (0.45 + 0.4 * Math.sin(clock * 6)) + ')'; g.lineWidth = 2.5; g.stroke();
    }
  }

  /* 開けた瞬間の帯 */
  function drawBanner(v, a, text) {
    {
      g.font = '900 28px ' + FONT; var bw = Math.max(140, g.measureText(text).width + 44), bh = 54, k = Math.min(1, a * 6);
      g.save(); g.globalAlpha = k; g.fillStyle = 'rgba(4,20,10,0.85)'; rr(v.x + v.w / 2 - bw / 2, v.y + v.h / 2 - bh / 2, bw, bh, 4); g.fill();
      g.shadowColor = TH.accent; g.shadowBlur = 16; g.strokeStyle = TH.accent; g.lineWidth = 2.5; g.stroke();
      txt(text, v.x + v.w / 2, v.y + v.h / 2 + 1, 28, TH.accent, 'center', FONT, 900); g.restore();
    }
  }

  function drawView() {
    var v = L.view, k = L.k;
    g.save(); rr(v.x, v.y, v.w, v.h, 10); g.clip();
    g.fillStyle = C.panel; g.fillRect(v.x, v.y, v.w, v.h);
    var bx = sx(0), bw = 10.8 * k, grd = g.createLinearGradient(0, v.y, 0, v.y + v.h);
    grd.addColorStop(0, C.steelA); grd.addColorStop(1, C.steelB);
    g.fillStyle = grd; g.fillRect(bx, v.y - 10, bw + 20, v.h + 20);
    g.strokeStyle = 'rgba(255,255,255,0.025)'; g.lineWidth = 1;
    for (var yy = v.y + 3; yy < v.y + v.h; yy += 4) { g.beginPath(); g.moveTo(bx, yy); g.lineTo(bx + bw + 20, yy); g.stroke(); }
    {
      g.strokeStyle = 'rgba(124,255,155,0.07)'; g.beginPath();
      for (var gx = v.x; gx < v.x + v.w; gx += k / 2) { g.moveTo(gx, v.y); g.lineTo(gx, v.y + v.h); }
      for (var gy = v.y; gy < v.y + v.h; gy += k / 2) { g.moveTo(v.x, gy); g.lineTo(v.x + v.w, gy); }
      g.stroke();
    }
    /* 入口の板と、見えている喉 */
    g.fillStyle = C.brass; g.fillRect(sx(-0.4), v.y - 10, 0.4 * k, v.h + 20);
    g.fillStyle = C.hole; g.fillRect(sx(-0.4), sy(LIP_H), (LIP + 0.4) * k, 2 * LIP_H * k);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(sx(LIP), sy(LIP_H)); g.lineTo(sx(LIP), sy(-LIP_H)); g.stroke(); g.setLineDash([]);
    /* 目盛り */
    g.strokeStyle = 'rgba(220,227,234,0.35)'; g.lineWidth = 1;
    for (var u = 0; u <= 10; u++) { g.beginPath(); g.moveTo(sx(u), v.y + 4); g.lineTo(sx(u), v.y + (u % 5 ? 8 : 12)); g.stroke(); if (u % 5 === 0) txt(String(u), sx(u) + 3, v.y + 17, 9, C.muted, 'left', MONO); }
    if (G && G.index === 0 && state === 'play' && traces.length < 40) txt(tr('dark'), sx(6.6), v.y + v.h - 12, 11, C.muted, 'center');

    if (!G) { g.restore(); return; }
    var X = sx, Y = sy;
    /* 手前のピン室は見えている。どの候補でも同じ形 */
    g.fillStyle = C.hole; g.beginPath(); g.moveTo(X(LIP), Y(1)); g.lineTo(X(SEEN_X), Y(1)); g.lineTo(X(SEEN_X), Y(-1)); g.lineTo(X(LIP), Y(-1)); g.closePath(); g.fill();
    var fog = g.createLinearGradient(X(SEEN_X - 0.5), 0, X(SEEN_X), 0);
    fog.addColorStop(0, 'rgba(42,52,63,0)'); fog.addColorStop(1, 'rgba(42,52,63,1)');
    g.fillStyle = fog; g.fillRect(X(SEEN_X - 0.5), Y(1), 0.5 * k, 2 * k);
    var ended = state === 'over' || state === 'review';
    G.pins.forEach(function (p, j) {
      var sd = p.side, h = PIN_H * p.scale, hw = PIN_W * k * 0.8, px = X(p.x);
      if (state === 'open' && j === G.secret) h = -0.5 * Math.min(1, openT / 0.12);
      var win = j === G.secret && (state === 'open' || ended);
      var col = p.dead ? '#4A4C52' : ABCD_COL[j];
      var y0 = Y(sd * 2.0), y1 = Y(sd * 1.0), yTop = Y(sd * 1.9), yTip = Y(sd * (1 - h));
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px - hw, Math.min(y0, y1), hw * 2, Math.abs(y1 - y0));
      if (h <= 0) {
        /* 本物が開いて引っ込んでいくところ */
        g.fillStyle = col; g.fillRect(px - hw, Math.min(yTop, yTip), hw * 2, Math.abs(yTip - yTop));
      } else {
        /* 胴（壁の中）と、壁から出た頭（当たり判定と同じ形） */
        var yWall = Y(sd * 1.0);
        g.fillStyle = col; g.fillRect(px - hw, Math.min(yTop, yWall), hw * 2, Math.abs(yWall - yTop));
        g.beginPath(); g.moveTo(X(p.x - PIN_W), yWall);
        for (var dd = -PIN_W; dd <= PIN_W + 1e-6; dd += PIN_W / 13) g.lineTo(X(p.x + dd), Y(sd * (1 - pinTop(Math.abs(dd)) * p.scale)));
        g.lineTo(X(p.x + PIN_W), yWall); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; g.beginPath();
        for (var de = -PIN_W + 0.02; de <= PIN_W - 0.02 + 1e-6; de += PIN_W / 13) { var ex = X(p.x + de), ey = Y(sd * (1 - pinTop(Math.abs(de)) * p.scale)); if (de === -PIN_W + 0.02) g.moveTo(ex, ey); else g.lineTo(ex, ey); }
        g.stroke();
      }
      var lab = p.dead ? '×' : 'ABCD'.charAt(j);
      /* 正解の文字は、そのピンの文字の真上に重ねる（下側のピンは文字を一段下げる） */
      var showWin = win && ended, ly = Y(sd * 2.32) + (showWin && sd < 0 ? 14 : 0);
      txt(lab, px, ly, 13, p.dead ? C.bad : ABCD_COL[j], 'center', MONO, 800);
      if (showWin) txt(tr('answer'), px, ly - 14, 12, ABCD_COL[j], 'center', FONT, 700);
    });
    /* 押し込む向きの矢印：照準が付いたら、先のすぐ手前にスイッチの方向（真上・真下）へ流れるシェブロン。ロックしたら明るく太く */
    if (!OLD_PRESS && aimIdx >= 0 && state === 'play' && G.pins[aimIdx] && !G.pins[aimIdx].dead) {
      var cq = G.pins[aimIdx], cdir = cq.side > 0 ? -1 : 1, clk = lockIdx >= 0;
      chevrons(X(cq.x), Y(T.y) - cdir * 22, cdir, clk ? 7 : 6, ABCD_COL[aimIdx], clk ? 1 : 0.75, clk ? 2.6 : 2);
    }
    /* 照準：狙いが付いたスイッチの頭に、四隅の枠を出す（押している間は少し縮む） */
    if (!OLD_PRESS && aimIdx >= 0 && state === 'play' && G.pins[aimIdx] && !G.pins[aimIdx].dead) {
      var ap = G.pins[aimIdx], acx = X(ap.x), acy = Y(ap.side * (1 - PIN_H * ap.scale)), ar = 13 - 3 * Math.min(1, pinProg) + (pressing ? 0 : Math.sin(clock * 8));
      g.strokeStyle = ABCD_COL[aimIdx]; g.lineWidth = 2.2;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { g.beginPath(); g.moveTo(acx + c[0] * ar, acy + c[1] * (ar - 5)); g.lineTo(acx + c[0] * ar, acy + c[1] * ar); g.lineTo(acx + c[0] * (ar - 5), acy + c[1] * ar); g.stroke(); });
    }
    /* 練習：押す段ではスイッチを脈打たせ、押す向きを矢印で */
    if (R0 && R0.tut && tutStep === 2 && state === 'play') G.pins.forEach(function (p, j) {
      if (p.dead) return;
      var cx = X(p.x), cy = Y(p.side * (1 - PIN_H)), pr = 11 + 3 * Math.sin(clock * 6);
      g.strokeStyle = ABCD_COL[j]; g.globalAlpha = 0.85; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, pr, 0, 6.283); g.stroke();
      var ay = cy + p.side * (24 + 3 * Math.sin(clock * 6));
      g.fillStyle = ABCD_COL[j]; g.beginPath(); g.moveTo(cx, ay - p.side * 8); g.lineTo(cx - 6, ay + p.side * 2); g.lineTo(cx + 6, ay + p.side * 2); g.closePath(); g.fill();
      g.globalAlpha = 1;
    });
    /* 仮説の重ね表示 */
    var ended0 = state === 'over' || state === 'review';
    var showGhost = G.sel >= 0 && state !== 'open' && (ended0 || !hard || !drag.on);
    if (showGhost) {
      var hc = G.cands[G.sel];
      g.save();
      if (V.ghost === 'trace' && !ended0 && !(R0 && R0.tut)) {
        /* なぞった所の近くだけ、候補の形が見える */
        g.beginPath();
        for (var ti = 0; ti < traces.length; ti += 2) { var tt = traces[ti]; if (clock - tt.t > TRACE_LIFE) continue; g.moveTo(X(tt.x) + 0.8 * k, Y(tt.y)); g.arc(X(tt.x), Y(tt.y), 0.8 * k, 0, 6.283); }
        g.clip();
      }
      cavPath(hc, X, Y); g.strokeStyle = 'rgba(' + C.ghost + ',0.6)'; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
      g.restore();
      var gp = G.pins[G.sel]; diamond(X(gp.x), Y(gp.side * (1 - PIN_H - 0.2)), 5); g.strokeStyle = 'rgba(' + C.ghost + ',0.8)'; g.lineWidth = 1.5; g.stroke();
    }
    /* 答え合わせ */
    if (state === 'open' || state === 'over' || state === 'review') {
      var a = state === 'open' ? Math.min(1, openT / 0.35) : 1;
      cavPath(cur, X, Y); g.fillStyle = 'rgba(' + C.ok + ',' + (0.16 * a) + ')'; g.fill(); g.strokeStyle = 'rgba(' + C.ok + ',' + (0.8 * a) + ')'; g.lineWidth = 1.5; g.stroke();
    }
    /* なぞった跡（チョークの光） */
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (var i = 1; i < traces.length; i++) {
      var q = traces[i], q0 = traces[i - 1], al = q.s * (1 - (clock - q.t) / TRACE_LIFE);
      if (al <= 0) continue;
      if (!q.brk) {
        g.strokeStyle = 'rgba(' + C.chalk + ',' + (al * 0.16) + ')'; g.lineWidth = 7; g.beginPath(); g.moveTo(X(q0.x), Y(q0.y)); g.lineTo(X(q.x), Y(q.y)); g.stroke();
        g.strokeStyle = 'rgba(' + C.chalk + ',' + (al * 0.9) + ')'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(X(q0.x), Y(q0.y)); g.lineTo(X(q.x), Y(q.y)); g.stroke();
      } else { g.fillStyle = 'rgba(' + C.chalk + ',' + (al * 0.8) + ')'; g.beginPath(); g.arc(X(q.x), Y(q.y), 1.6, 0, 6.283); g.fill(); }
    }
    while (traces.length && clock - traces[0].t > TRACE_LIFE) traces.shift();
    g.globalCompositeOperation = 'source-over';

    /* 針 */
    /* 支点から出るときは押したい向き(aim)を向き、壁に当たっている針先へ向かって曲がり込む。
       壁際ほど針が壁に寄り、手前ほど離れる曲線になる。手元側もaimの延長に傾く（てこ） */
    var len = Math.hypot(T.x, T.y) || 1, u0x = T.x / len, u0y = T.y / len;
    /* 曲がりに使うのは針に直角な成分だけ。針の向きに押しつけた分（入口側へ引いた分など）で手元が鍵穴側へ回り込まないように */
    /* 見た目のしなりは実際の力の4割だけ。操作や判定には関係しない */
    var bvx = bow.x * NEEDLE_BEND, bvy = bow.y * NEEDLE_BEND;
    var bd = bvx * u0x + bvy * u0y, bpx = bvx - bd * u0x, bpy = bvy - bd * u0y;
    var ax = T.x + bpx, ay = T.y + bpy;
    if (ax < 0.5 * T.x) ax = 0.5 * T.x;
    var amax = (LIP_H - 0.02) / PLATE * ax; if (ay > amax) ay = amax; if (ay < -amax) ay = -amax;
    var al = Math.hypot(ax, ay) || 1;
    var ux = ax / al, uy = ay / al, tx = -ux * (NLEN - len), ty = -uy * (NLEN - len);
    var ccx = ux * len * 0.5, ccy = uy * len * 0.5;
    var hot = Math.min(1, pm / PMAX);
    g.lineCap = 'round';
    for (var pass = 0; pass < 2; pass++) {
      g.beginPath(); g.moveTo(X(tx), Y(ty)); g.lineTo(X(0), Y(0));
      g.quadraticCurveTo(X(ccx), Y(ccy), X(T.x), Y(T.y));
      g.strokeStyle = pass ? 'rgba(255,240,200,0.55)' : C.brass; g.lineWidth = pass ? 1 : 3.4; g.stroke();
    }
    if (X(tx) > v.x - 20) { g.beginPath(); g.arc(X(tx), Y(ty), 7, 0, 6.283); g.fillStyle = C.brass; g.fill(); }
    if (contact) {
      var rg = g.createRadialGradient(X(T.x), Y(T.y), 0, X(T.x), Y(T.y), 10 + 10 * hot);
      rg.addColorStop(0, 'rgba(255,220,150,' + (0.35 + 0.45 * hot) + ')'); rg.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(X(T.x), Y(T.y), 10 + 10 * hot, 0, 6.283); g.fill();
    }
    g.beginPath(); g.arc(X(T.x), Y(T.y), 2.4, 0, 6.283); g.fillStyle = C.brassHi; g.fill();
    if (pinProg > 0.02 && state === 'play') {
      g.beginPath(); g.arc(X(T.x), Y(T.y), 13, -Math.PI / 2, -Math.PI / 2 + pinProg * Math.PI * 2);
      g.strokeStyle = C.pin; g.lineWidth = 3; g.stroke();
    }
    /* 火花 */
    g.globalCompositeOperation = 'lighter';
    parts.forEach(function (q) {
      var a2 = 1 - q.life / q.max; g.strokeStyle = q.c; g.globalAlpha = a2; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(X(q.x), Y(q.y)); g.lineTo(X(q.x - q.vx * 0.03), Y(q.y - q.vy * 0.03)); g.stroke();
    });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    /* 火の玉と衝撃波 */
    var bt = clock - boomAt;
    if (bt >= 0 && bt < 0.9 && !REDUCED) {
      var bx0 = X(5.5), by0 = Y(0), br = v.w * 0.75 * Math.min(1, bt / 0.35), ba = 1 - bt / 0.9;
      var fb = g.createRadialGradient(bx0, by0, 0, bx0, by0, br);
      fb.addColorStop(0, 'rgba(255,245,200,' + ba + ')'); fb.addColorStop(0.35, 'rgba(255,170,60,' + (0.85 * ba) + ')'); fb.addColorStop(1, 'rgba(255,80,30,0)');
      g.fillStyle = fb; g.beginPath(); g.arc(bx0, by0, br, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(255,230,180,' + (0.7 * ba) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(bx0, by0, v.w * 1.1 * bt, 0, 6.283); g.stroke();
    }
    /* 煙 */
    smokes.forEach(function (sm) {
      if (sm.t <= 0) return;
      var u = sm.t / sm.max, a = (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * (sm.dark ? 0.55 : 0.4);
      var rg2 = g.createRadialGradient(X(sm.x), Y(sm.y), 0, X(sm.x), Y(sm.y), sm.r * k);
      var cc = sm.dark ? '60,64,62' : '150,158,154';
      rg2.addColorStop(0, 'rgba(' + cc + ',' + a + ')'); rg2.addColorStop(1, 'rgba(' + cc + ',0)');
      g.fillStyle = rg2; g.beginPath(); g.arc(X(sm.x), Y(sm.y), sm.r * k, 0, 6.283); g.fill();
    });
    floats.forEach(function (f) {
      var a3 = f.t < 1 ? 1 : 1 - (f.t - 1) / 0.3;
      g.globalAlpha = Math.max(0, a3);
      txt(f.text, clamp(X(f.x), v.x + 60, v.x + v.w - 60), Y(f.y) - 18 - f.t * 22, 17, f.c || C.brassHi, 'center', FONT, 700);
    });
    g.globalAlpha = 1;
    if (state === 'open') drawBanner(v, openT, G.miss ? TH.win : TH.winClean);
    monitor(v);
    scanClear(v);
    g.restore();
    rr(v.x, v.y, v.w, v.h, 10); g.strokeStyle = C.line; g.lineWidth = 1.2; g.stroke();
  }
  /* クリア：緑の走査線が左から右へ走り、通ったあとの本物の形がくっきり光る。隅に「全10個 解除完了」 */
  /* 断面図の隅の表示（完了・信号なし・再現）は右下に右寄せ。左下は入口の板（縦の線）や下のスイッチの文字と重なるので避ける */
  function scanClear(v) {
    var ct = clearT(); if (ct < CLR.scan) return;
    var sp = REDUCED ? 1 : Math.min(1, (ct - CLR.scan) / 0.8), sxp = v.x + v.w * sp;
    g.save(); g.beginPath(); g.rect(v.x, v.y, sxp - v.x, v.h); g.clip();
    g.fillStyle = 'rgba(' + hiRGB() + ',0.10)'; g.fillRect(v.x, v.y, v.w, v.h);
    cavPath(cur, sx, sy); g.strokeStyle = hiCol(); g.lineWidth = 3; g.shadowColor = hiCol(); g.shadowBlur = 12; g.stroke();
    g.restore();
    if (sp < 1) {
      var lg = g.createLinearGradient(sxp - 30, 0, sxp + 4, 0); lg.addColorStop(0, 'rgba(' + hiRGB() + ',0)'); lg.addColorStop(1, 'rgba(' + hiRGB() + ',0.8)');
      g.fillStyle = lg; g.fillRect(sxp - 30, v.y, 34, v.h); g.fillStyle = '#F4FFF7'; g.fillRect(sxp, v.y, 2, v.h);
    } else txt('■ ' + tr('allClear'), v.x + v.w - 10, v.y + v.h - 12, 11, hiCol(), 'right', MONO, 700);
  }
  /* クリア：パッドに黄黒の防爆シャッターが左右から閉まり、少しして開く。開いた奥から結果がせり上がる */
  /* back=true は奥（暗がりと光）、false は手前のシャッター。奥 → 結果 → シャッターの順に描く */
  function shutters(back) {
    var ct = clearT(); if (ct < CLR.shut || REDUCED) return;
    var p = L.pad, hw = p.w / 2, dk = ct < CLR.open ? 1 - easeOut((ct - CLR.shut) / 0.35) : easeOut((ct - CLR.open) / 0.45);
    if (back) {
      if (ct < CLR.open || ct > CLR.result + 0.5) return;
      g.save(); rr(p.x, p.y, p.w, p.h, 14); g.clip(); g.fillStyle = '#050906'; g.fillRect(p.x, p.y, p.w, p.h);
      var gl = g.createRadialGradient(p.x + hw, p.y + p.h / 2, 0, p.x + hw, p.y + p.h / 2, 200); gl.addColorStop(0, 'rgba(' + hiRGB() + ',' + (0.35 * dk) + ')'); gl.addColorStop(1, 'rgba(' + hiRGB() + ',0)'); g.fillStyle = gl; g.fillRect(p.x, p.y, p.w, p.h);
      g.restore(); return;
    }
    if (dk >= 1) return;
    g.save(); rr(p.x, p.y, p.w, p.h, 14); g.clip();
    [-1, 1].forEach(function (sd) {
      var x0 = sd < 0 ? p.x - hw * dk : p.x + hw + hw * dk;
      g.save(); g.beginPath(); g.rect(x0, p.y, hw, p.h); g.clip();
      g.fillStyle = '#1B1F1C'; g.fillRect(x0, p.y, hw, p.h);
      g.fillStyle = '#F5C400'; for (var k = -p.h; k < hw + p.h; k += 34) { g.beginPath(); g.moveTo(x0 + k, p.y); g.lineTo(x0 + k + 16, p.y); g.lineTo(x0 + k + 16 - p.h * 0.6, p.y + p.h); g.lineTo(x0 + k - p.h * 0.6, p.y + p.h); g.closePath(); g.fill(); }
      g.fillStyle = '#2B302C'; g.fillRect(sd < 0 ? x0 + hw - 8 : x0, p.y, 8, p.h);
      g.restore();
    });
    g.restore();
  }
  /* クリア：信号弾10発（解除した爆弾の数だけ）。光の玉が上がって、はじけて光の粒が降る */
  function flares() {
    var ct = clearT(); if (ct < CLR.flares || REDUCED) return;
    var cols = R0.perfect ? ['#FFD45E', '#FFF3C2', '#7CFF9B'] : ['#7CFF9B', '#E8FFF0', '#4FB3FF'];
    for (var n = 0; n < GOAL; n++) {
      var u = ct - CLR.flares - n * 0.11; if (u < 0) continue;
      var x0 = 30 + n * 33, x1 = x0 + (hash(n) - 0.5) * 40, yTop = 60 + hash(n + 5) * 150, up = 0.4, sy0 = L.view.y + L.view.h;
      if (u < up) {
        var k = easeOut(u / up), fx = x0 + (x1 - x0) * k, fy = sy0 - (sy0 - yTop) * k;
        var fg = g.createRadialGradient(fx, fy, 0, fx, fy, 9); fg.addColorStop(0, 'rgba(255,255,255,0.95)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = fg; g.beginPath(); g.arc(fx, fy, 9, 0, 6.283); g.fill(); continue;
      }
      var b = u - up; if (b > 1.6) continue;
      if (b < 0.15) { var fl = g.createRadialGradient(x1, yTop, 0, x1, yTop, 40); fl.addColorStop(0, 'rgba(255,255,255,' + (1 - b / 0.15) + ')'); fl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fl; g.beginPath(); g.arc(x1, yTop, 40, 0, 6.283); g.fill(); }
      g.globalAlpha = Math.max(0, 1 - b / 1.6); g.lineWidth = 1;
      for (var q = 0; q < 26; q++) {
        var a = q / 26 * 6.283 + hash(n * 30 + q) * 0.2, vv = 60 + 40 * hash(n * 7 + q), px = x1 + Math.cos(a) * vv * b, py = yTop + Math.sin(a) * vv * b + 70 * b * b;
        g.fillStyle = cols[q % 3]; g.fillRect(px - 1.5, py - 1.5, 3, 3);
        g.strokeStyle = cols[q % 3]; g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.cos(a) * 6, py - Math.sin(a) * 6 - 3); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
  function easeOut(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }
  /* 点検モニターの映像。時間切れで焼き切れ、記録から再現して戻る */
  var tearCv = null;
  function monitor(v) {
    if (!R0 || !R0.boomed) return;
    var bt = boomT(), cxv = v.x + v.w / 2, cyv = v.y + v.h / 2;
    if (!REDUCED && bt >= BOOM.tear && bt < BOOM.line) {
      /* 横に裂けて色がずれる：いま描いた断面図を写し取り、細い帯ごとにずらして描き直す */
      var dpr = DPR * S, sx0 = (OX + v.x * S) * DPR, sy0 = (OY + v.y * S) * DPR, sw = v.w * dpr, sh = v.h * dpr, k0 = (bt - BOOM.tear) / (BOOM.line - BOOM.tear);
      if (!tearCv) tearCv = document.createElement('canvas');
      tearCv.width = Math.ceil(sw); tearCv.height = Math.ceil(sh);
      tearCv.getContext('2d').drawImage(cv, sx0, sy0, sw, sh, 0, 0, sw, sh);
      g.fillStyle = '#020403'; g.fillRect(v.x, v.y, v.w, v.h);
      for (var y = 0; y < v.h; y += 6) {
        var off = (hash(Math.floor(bt * 30) * 31 + y) - 0.5) * 60 * k0;
        g.drawImage(tearCv, 0, y * dpr, sw, 6 * dpr, v.x + off, v.y + y, v.w, 6);
      }
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 * k0; g.drawImage(tearCv, 0, 0, sw, sh, v.x + 6, v.y, v.w, v.h); g.restore();
    } else if (!REDUCED && bt >= BOOM.line && bt < BOOM.noise) {
      /* 古いブラウン管のように、縦につぶれて1本の線 → 点になって消える */
      var u = (bt - BOOM.line) / (BOOM.noise - BOOM.line);
      g.fillStyle = '#020403'; g.fillRect(v.x, v.y, v.w, v.h);
      var lh = Math.max(2, v.h * (1 - Math.min(1, u * 1.6))), lw = u < 0.6 ? v.w : v.w * (1 - (u - 0.6) / 0.4);
      var gr = g.createLinearGradient(0, cyv - lh / 2, 0, cyv + lh / 2); gr.addColorStop(0, 'rgba(210,255,225,0)'); gr.addColorStop(0.5, 'rgba(230,255,240,1)'); gr.addColorStop(1, 'rgba(210,255,225,0)');
      g.fillStyle = gr; g.fillRect(cxv - lw / 2, cyv - lh / 2, Math.max(3, lw), lh);
      g.save(); g.shadowColor = '#CFFFE0'; g.shadowBlur = 18; g.fillStyle = '#fff'; g.beginPath(); g.arc(cxv, cyv, 3 + 3 * (1 - u), 0, 6.283); g.fill(); g.restore();
    } else if (!REDUCED && bt >= BOOM.noise && bt < BOOM.back) {
      /* 砂嵐と「信号なし」 */
      g.fillStyle = '#030605'; g.fillRect(v.x, v.y, v.w, v.h);
      var f = Math.floor(bt * 24);
      for (var n = 0; n < 900; n++) { var c = 60 + 120 * hash(f + n * 7) | 0; g.fillStyle = 'rgba(' + c + ',' + (c + 20) + ',' + c + ',0.5)'; g.fillRect(v.x + hash(f * 997 + n) * v.w, v.y + hash(f * 991 + n + 3) * v.h, 2, 2); }
      txt('■ ' + tr('noSignal'), v.x + v.w - 10, v.y + v.h - 12, 11, Math.floor(bt * 2) % 2 ? TH.accent : 'rgba(124,255,155,0.4)', 'right', MONO, 700);
    } else if (bt >= BOOM.back || REDUCED) {
      /* 記録から再現した映像。戻る瞬間は少しちらつき、走査線が残る。答え合わせの間も「再現映像」と出し続ける */
      var rk = Math.min(1, (bt - BOOM.back) / 0.35), fl = rk < 1 && hash(Math.floor(bt * 30)) > 0.55;
      if (!REDUCED && rk < 1) { g.fillStyle = 'rgba(2,4,3,' + (fl ? 0.75 : 1 - rk) + ')'; g.fillRect(v.x, v.y, v.w, v.h); }
      g.fillStyle = 'rgba(0,0,0,0.14)'; for (var sl = v.y; sl < v.y + v.h; sl += 3) g.fillRect(v.x, sl, v.w, 1);
      if (bt < BOOM.back + 0.8 && !REDUCED) txt('■ ' + tr('rebuilt'), v.x + v.w - 10, v.y + v.h - 12, 11, TH.accent, 'right', MONO, 700);
      else txt(tr('rebuiltView'), v.x + v.w - 10, v.y + v.h - 12, 10, 'rgba(124,255,155,0.55)', 'right', MONO, 700);
    }
  }

  function hintText() {
    if (state === 'play') {
      if (pressing) return tr('pressing')('ABCD'.charAt(pinIdx));
      if (!OLD_PRESS && aimIdx >= 0) return tr('aiming')('ABCD'.charAt(aimIdx));
      if (!everPinned && G.index === 0) return TH.hint0;
      if (G.sel < 0) return tr('quadHint');
      if (hard && drag.on) return tr('hardHint')('ABCD'.charAt(G.sel));
      return '';
    }
    if (state === 'open') return '';
    if (state === 'review') {
      if (pressing) return tr('pressingShort')('ABCD'.charAt(pinIdx));
      return G.solved ? tr('solved') : tr('reviewing');
    }
    return '';
  }

  /* 押し込む向きのシェブロン3つ。dir=-1 で上向き。向きへ流れるように明滅する */
  function chevrons(x, y, dir, sz, col, a, lw) {
    g.save(); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    for (var i = 0; i < 3; i++) {
      var ph = REDUCED ? 1 : (clock * 3 - i * 0.33) % 1, al = REDUCED ? a * (0.5 + 0.25 * i) : a * (0.25 + 0.75 * (1 - Math.abs(ph - 0.5) * 2));
      var cy = y + dir * (i - 1) * sz * 1.1;
      g.globalAlpha = Math.max(0, al);
      g.beginPath(); g.moveTo(x - sz, cy - dir * sz * 0.5); g.lineTo(x, cy + dir * sz * 0.5); g.lineTo(x + sz, cy - dir * sz * 0.5); g.stroke();
    }
    g.restore();
  }
  function drawPad() {
    var p = L.pad;
    rr(p.x, p.y, p.w, p.h, 14); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.2; g.stroke();
    g.save(); rr(p.x, p.y, p.w, p.h, 14); g.clip();
    {
      /* 左右の縁に警告ストライプの帯（ここからは操作が始まらない） */
      [p.x, p.x + p.w - PAD_EDGE].forEach(function (ex) {
        g.save(); g.beginPath(); g.rect(ex, p.y, PAD_EDGE, p.h); g.clip();
        g.fillStyle = '#141A16'; g.fillRect(ex, p.y, PAD_EDGE, p.h);
        g.fillStyle = 'rgba(245,196,0,0.85)';
        for (var sy0 = p.y - PAD_EDGE; sy0 < p.y + p.h + PAD_EDGE; sy0 += 18) { g.beginPath(); g.moveTo(ex, sy0); g.lineTo(ex + PAD_EDGE, sy0 - PAD_EDGE * 0.8); g.lineTo(ex + PAD_EDGE, sy0 - PAD_EDGE * 0.8 + 8); g.lineTo(ex, sy0 + 8); g.closePath(); g.fill(); }
        g.restore();
      });
    }
    g.restore();
    g.fillStyle = 'rgba(220,227,234,0.07)';
    for (var yy = p.y + 14; yy < p.y + p.h - 6; yy += 18) for (var xx = p.x + PAD_EDGE + 10; xx < p.x + p.w - PAD_EDGE - 4; xx += 18) g.fillRect(xx, yy, 1.5, 1.5);
    txt(tr('shallow'), p.x + PAD_EDGE + 8, p.y + p.h - 14, 12, C.muted);
    txt(tr('deep'), p.x + p.w - PAD_EDGE - 8, p.y + p.h - 14, 12, C.muted, 'right');
    if (V.pick === 'quad' && G && state !== 'over') {
      for (var qi = 0; qi < G.cands.length; qi++) {
        var half = G.cands.length <= 2, qx = p.x + (qi % 2 ? 0.75 : 0.25) * p.w, qy = half ? p.y + 66 + (p.h - 102) / 2 : p.y + (qi > 1 ? 0.75 : 0.25) * p.h;
        g.globalAlpha = G.sel === qi ? 0.6 : (R0 && R0.tut && tutStep === 1 && state === 'play' ? 0.3 + 0.2 * Math.sin(clock * 5) : 0.16);
        txt('ABCD'.charAt(qi), qx, qy, 44, ABCD_COL[qi], 'center', MONO, 800);
        g.globalAlpha = 1;
      }
      g.strokeStyle = 'rgba(220,227,234,0.05)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x + p.w / 2, p.y + 30); g.lineTo(p.x + p.w / 2, p.y + p.h - 30); if (G.cands.length > 2) { g.moveTo(p.x + 20, p.y + p.h / 2); g.lineTo(p.x + p.w - 20, p.y + p.h / 2); } g.stroke();
    }
    var hs = hintText();
    /* 答え合わせ中は右上に「結果に戻る」があるので、その手前までに収める */
    var hx0 = p.x + PAD_EDGE + 8, hmax = state === 'review' ? L.back.x - 8 - hx0 : p.w - PAD_EDGE * 2 - 16;
    if (hs) fitTxt(hs, hx0, p.y + 17, 13, pressing ? ABCD_COL[pinIdx] || C.pin : C.muted, hmax);
    else txt(tr('up'), p.x + PAD_EDGE + 8, p.y + 17, 12, C.muted);
    if (state === 'review') {
      var b = L.back; rr(b.x, b.y, b.w, b.h, 14); g.fillStyle = C.panel2; g.fill(); g.strokeStyle = C.brassHi; g.lineWidth = 1.5; g.stroke();
      txt(tr('back'), b.x + b.w / 2, b.y + b.h / 2 + 1, 13, C.brassHi, 'center', FONT, 700);
    }
    if (R0 && R0.tut && state === 'play') drawTutPad(p);
    else if (!drag.on && state === 'play' && traces.length === 0 && T.x < 0.8) txt(tr('anywhere'), p.x + p.w / 2, p.y + p.h / 2, 14, C.text, 'center');
    if (drag.on) {
      var hot = Math.min(1, pm / PMAX), rad = 24 + 8 * hot;
      g.beginPath(); g.arc(drag.fx, drag.fy, rad, 0, 6.283);
      g.strokeStyle = pressing ? C.pin : (contact ? C.brassHi : 'rgba(220,227,234,0.5)'); g.lineWidth = 2 + 3 * hot; g.stroke();
      /* 照準が付いたら、指の先にも押し込む向き（真上・真下）の矢印 */
      if (!OLD_PRESS && aimIdx >= 0 && state === 'play' && G.pins[aimIdx] && !G.pins[aimIdx].dead) {
        var pdir = G.pins[aimIdx].side > 0 ? -1 : 1, plk = lockIdx >= 0;
        chevrons(drag.fx, drag.fy + pdir * (rad + 22), pdir, plk ? 10 : 9, ABCD_COL[aimIdx], plk ? 1 : 0.8, plk ? 3.4 : 2.6);
      }
    }
  }

  /* 1行に収まるよう、必要なら文字を小さくして書く */
  function fitTxt(sx0, x, y, size, col, maxW, weight) {
    g.font = (weight || 400) + ' ' + size + 'px ' + FONT; var w0 = g.measureText(sx0).width;
    txt(sx0, x, y, w0 > maxW ? Math.floor(size * maxW / w0) : size, col, 'left', FONT, weight);
  }
  /* 練習の案内。パッドの上に枠を出し、段ごとに言葉を変える */
  function drawTutPad(p) {
    var l1, l2;
    if (tutStep === 0) { l1 = tr('tut0'); l2 = tr('tut0b'); }
    else if (tutStep === 1) { l1 = tutSelAt ? tr('tut1c') : tr('tut1'); l2 = tr('tut1b'); }
    else if (tutWrong) { l1 = tr('tutWrong'); l2 = tr('tutWrongB'); }
    else { l1 = tr('tut2'); l2 = tr('tut2b'); }
    var bx = p.x + 8, by = p.y + 8, bw = p.w - 16, bh = 58;
    rr(bx, by, bw, bh, 10); g.fillStyle = 'rgba(4,20,10,0.94)'; g.fill(); g.strokeStyle = tutWrong && tutStep === 2 ? C.bad : TH.accent; g.lineWidth = 1.5; g.stroke();
    txt((tutStep + 1) + ' / 3', bx + bw - 10, by + 13, 10, C.muted, 'right', MONO, 700);
    fitTxt(l1, bx + 12, by + 20, 15, tutWrong && tutStep === 2 ? '#FFB4A6' : C.text, bw - 64, 700);
    fitTxt(l2, bx + 12, by + 42, 12, C.muted, bw - 24, 400);
    /* なぞる段：指の動きの見本。下向きのカーブで、床側の壁をなぞるよう促す（上だとスイッチに触れやすい） */
    if (tutStep === 1 && !tutSelAt && !drag.on) {
      /* タップの見本。左右の文字の上に、交互に波紋を出す */
      var cyc = clock % 2.4, side = cyc < 1.2 ? 0 : 1, ph = (cyc % 1.2) / 1.2;
      var rx0 = p.x + p.w * (side ? 0.75 : 0.25), ry0 = p.y + 66 + (p.h - 102) / 2;
      g.strokeStyle = 'rgba(124,255,155,' + (0.8 * (1 - ph)) + ')'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(rx0, ry0, 12 + 30 * ph, 0, 6.283); g.stroke();
      g.beginPath(); g.arc(rx0, ry0, 6, 0, 6.283); g.fillStyle = 'rgba(124,255,155,' + (0.9 * (1 - ph)) + ')'; g.fill();
    }
    if (tutStep === 0 && !drag.on) {
      var tt = (clock % 2.4) / 1.2, e0 = tt < 1 ? tt : 2 - tt; e0 = e0 * e0 * (3 - 2 * e0);
      var hx = p.x + p.w * (0.22 + 0.56 * e0), hy = p.y + p.h * 0.5 + Math.sin(e0 * Math.PI) * 26;
      g.strokeStyle = 'rgba(124,255,155,0.25)'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x + p.w * 0.22, p.y + p.h * 0.5);
      for (var q = 0; q <= 20; q++) { var e1 = q / 20; g.lineTo(p.x + p.w * (0.22 + 0.56 * e1), p.y + p.h * 0.5 + Math.sin(e1 * Math.PI) * 26); }
      g.stroke();
      g.beginPath(); g.arc(hx, hy, 18, 0, 6.283); g.strokeStyle = TH.accent; g.lineWidth = 2.5; g.stroke();
      g.beginPath(); g.arc(hx, hy, 6, 0, 6.283); g.fillStyle = TH.accent; g.fill();
    }
    var sk = L.btnSkip; rr(sk.x, sk.y, sk.w, sk.h, 12); g.fillStyle = C.panel2; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1; g.stroke();
    txt(tr('skip'), sk.x + sk.w / 2, sk.y + sk.h / 2 + 1, 12, C.muted, 'center', FONT, 700);
  }
  function drawTutEnd() {
    var p = L.pad;
    rr(p.x, p.y, p.w, p.h, 14); g.fillStyle = C.bg; g.fill(); g.strokeStyle = TH.accent; g.lineWidth = 1.5; g.stroke();
    txt(tr('tutEndHead'), p.x + 16, p.y + 34, 24, TH.accent, 'left', FONT, 900);
    fitTxt(tr('tutEnd1'), p.x + 16, p.y + 74, 14, C.text, p.w - 32, 700);
    fitTxt(tr('tutEnd2'), p.x + 16, p.y + 100, 13, C.muted, p.w - 32, 400);
    var b = L.btnTutGo, on = clock - overAt > 0.5;
    g.globalAlpha = on ? 1 : 0.4;
    rr(b.x, b.y, b.w, b.h, 12); g.fillStyle = TH.accent; g.fill();
    txt(tr('tutGo'), b.x + b.w / 2, b.y + b.h / 2 + 1, 18, TH.accentInk, 'center', FONT, 900);
    g.globalAlpha = 1;
  }
  /* 結果はパッドの上にだけ出す。上の候補と断面図に答えが見えたままになる */
  /* 結果が出てからの秒。時間切れなら映像の復旧のあと */
  function resultT() { return R0 && R0.boomed ? boomT() - BOOM.result : (clearT() >= 0 ? clearT() - CLR.result : clock - overAt); }
  function drawResult() {
    var rk = R0.boomed || clearT() >= 0 ? Math.min(1, resultT() / 0.35) : 1;
    if (rk <= 0) return;
    g.save(); g.globalAlpha = Math.min(1, rk * 2); g.translate(0, (1 - (1 - Math.pow(1 - rk, 3))) * 260);
    var p = L.pad, avg = R0.times.length ? (R0.times.reduce(function (a, b) { return a + b; }, 0) / R0.times.length).toFixed(1) + '秒' : 'ー';
    rr(p.x, p.y, p.w, p.h, 14); g.fillStyle = C.bg; g.fill(); g.strokeStyle = TH.accent; g.lineWidth = 1.5; g.stroke();
    var y = p.y + 30;
    var mname = R0.endless ? TH.endless : TH.normal;
    var stats = tr('stats')(R0.clean, R0.misses, R0.bestStreak);
    var nb = R0.newBest ? tr('newBest') : '';
    if (R0.cleared) {
      if (R0.perfect) {
        txt(tr('perfectHead'), p.x + 16, y, 22, TH.accent, 'left', FONT, 900); y += 28;
        txt(tr('perfectPraise'), p.x + 16, y, 13, '#FFE7A0', 'left', FONT, 700); y += 30;
      } else { txt(TH.clearBig, p.x + 16, y, 22, TH.accent, 'left', FONT, 900); y += 38; }
      txt(tr('time')(R0.elapsed.toFixed(1)), p.x + 16, y, 18, C.text, 'left', FONT, 700);
      if (R0.perfect) drawStamp(p.x + p.w - 58, y - 6, clock - overAt);
      y += 28;
      fitTxt(stats, p.x + 16, y, 13, C.muted, p.w - 32); y += 22;
      fitTxt(tr('bestOf')(mname, tr('secs')(bestT[R0.key].toFixed(1))) + nb, p.x + 16, y, 13, R0.newBest ? TH.accent : C.muted, p.w - 32); y += 24;
    } else {
      txt(TH.overBig, p.x + 16, y, 24, C.text, 'left', FONT, 900); y += 38;
      txt(TH.countLong + '  ' + R0.opened + (R0.endless ? TH.unitN : ' / ' + GOAL), p.x + 16, y, 18, C.text, 'left', FONT, 700); y += 28;
      fitTxt(stats, p.x + 16, y, 13, C.muted, p.w - 32); y += 22;
      fitTxt(tr('bestOf')(mname, (bestN[R0.key] || 0) + TH.unitN) + nb, p.x + 16, y, 13, R0.newBest ? TH.accent : C.muted, p.w - 32); y += 24;
    }
    if (R0.unlockedNow) fitTxt(tr('unlocked')(TH.endless), p.x + 16, y, 13, TH.accent, p.w - 32, 700);
    else txt(TH.reveal, p.x + 16, y, 12, C.muted);
    var tt = L.btnTitle; rr(tt.x, tt.y, tt.w, tt.h, 14); g.strokeStyle = C.line; g.lineWidth = 1.2; g.stroke();
    txt(tr('toTitle'), tt.x + tt.w / 2, tt.y + tt.h / 2 + 1, 12, C.muted, 'center');
    var on = resultT() > 0.5;
    g.globalAlpha *= on ? 1 : 0.4;
    var a = L.btnRev, b = L.btnRetry;
    rr(a.x, a.y, a.w, a.h, 10); g.fillStyle = C.panel2; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.5; g.stroke();
    txt(TH.review, a.x + a.w / 2, a.y + a.h / 2, 14, C.text, 'center', FONT, 700);
    rr(b.x, b.y, b.w, b.h, 10); g.fillStyle = TH.accent; g.fill();
    txt(tr('again'), b.x + b.w / 2, b.y + b.h / 2, 15, TH.accentInk, 'center', FONT, 900);
    g.restore();
  }

  function draw() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = C.bg; g.fillRect(0, 0, VW, VH);
    g.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
    shX = shake ? (Math.random() - 0.5) * shake : 0; shY = shake ? (Math.random() - 0.5) * shake : 0;
    if (slideIn > 0) shX += slideIn * slideIn * W * 0.7;
    if (fadeIn > 0) g.globalAlpha = 1 - fadeIn / 0.25;
    var bt = boomT(), ct = clearT(), push = Math.max(0, bt - 0.05), bc = { x: L.ox + 5.5 * L.k, y: L.oy };
    /* クリアのときは、衝撃波の代わりにやわらかい光で少し揺らす */
    if (ct >= 0) push = Math.max(0, ct - 0.05);
    var pk = ct >= 0 ? 0.55 : 1;
    g.save(); g.translate(0, -spring(push - 0.05) * 8 * pk); drawHUD(); g.restore();
    for (var i = 0; i < 4; i++) {
      var cr = L.cards[i], dx = cr.x + cr.w / 2 - bc.x, dy = cr.y + cr.h / 2 - bc.y, dm = Math.hypot(dx, dy) || 1, sa = spring(push - dm / 1200) * 18 * pk;
      g.save(); g.translate(dx / dm * sa, dy / dm * sa); drawCard(i); g.restore();
    }
    drawView();
    g.save(); g.translate(0, spring(push - 0.25) * 12 * pk); drawPad(); g.restore();
    g.globalAlpha = 1;
    if (state === 'title') {
      drawTitle();
      drawTitleButtons();
    } else if (state === 'over') { shutters(true); drawResult(); shutters(false); }
    if (state === 'over' || state === 'review') flares();
    if (ct >= 0 && ct < 0.8 && !REDUCED) { g.strokeStyle = 'rgba(' + hiRGB() + ',' + 0.7 * (1 - ct / 0.8) + ')'; g.lineWidth = 6 * (1 - ct / 0.8) + 1; g.beginPath(); g.arc(bc.x, bc.y, 500 * easeOut(ct / 0.8), 0, 6.283); g.stroke(); }
    /* 止まった一瞬の光。画面全体は光らせず（まぶしいので）、断面図の真ん中からやわらかく広がる光だけにする */
    if (ct >= 0 && ct < 0.6 && !REDUCED) {
      var ga = ct < CLR.stop ? 0.3 : 0.3 * (1 - (ct - CLR.stop) / (0.6 - CLR.stop)), gr0 = 60 + 260 * easeOut(ct / 0.6);
      var gw = g.createRadialGradient(bc.x, bc.y, 0, bc.x, bc.y, gr0); gw.addColorStop(0, 'rgba(' + hiRGB() + ',' + ga + ')'); gw.addColorStop(1, 'rgba(' + hiRGB() + ',0)');
      g.fillStyle = gw; g.beginPath(); g.arc(bc.x, bc.y, gr0, 0, 6.283); g.fill();
    }
    else if (state === 'tutEnd') drawTutEnd();
    if (bt >= 0 && bt < BOOM.stop && !REDUCED) {
      /* 衝撃の一瞬：白黒反転して、爆心から黒い集中線 */
      g.save(); g.globalCompositeOperation = 'difference'; g.globalAlpha = 0.6; g.fillStyle = '#ffffff'; fillAll(); g.restore();
      g.save(); g.globalAlpha = 0.6; g.fillStyle = '#000';
      for (var q = 0; q < 40; q++) { var a0 = q / 40 * 6.283, w0 = 0.02; g.beginPath(); g.moveTo(bc.x + Math.cos(a0 - w0) * 700, bc.y + Math.sin(a0 - w0) * 700); g.lineTo(bc.x + Math.cos(a0) * 70, bc.y + Math.sin(a0) * 70); g.lineTo(bc.x + Math.cos(a0 + w0) * 700, bc.y + Math.sin(a0 + w0) * 700); g.closePath(); g.fill(); }
      g.restore();
    } else if (flash > 0) { g.globalAlpha = flash * 0.75; g.fillStyle = TH.flash; fillAll(); g.globalAlpha = 1; }
  }

  /* タイトル。見出し → 爆弾の絵 → 説明 → ボタン */
  function drawTitle() {
    g.fillStyle = 'rgba(6,10,8,0.92)'; fillAll();
    var tb = Math.min(W - 32, 400), x = (W - tb) / 2, y = 12;
    /* 左上に音、右上に言語 */
    L.sndTitle = { x: x, y: y, w: 78, h: 28 };
    L.langTitle = { x: x + tb - 104, y: y, w: 104, h: 28 };
    drawSpeaker(L.sndTitle);
    drawSeg(L.langTitle, '日本語', 'EN', LANG === 'ja');
    /* 練習はいつでもやり直せる。枠のない文字のリンクにして、両隣の部品と形を変える */
    g.font = '700 12px ' + FONT; var pw0 = g.measureText(tr('practice')).width;
    var pcx = (L.sndTitle.x + L.sndTitle.w + L.langTitle.x) / 2;
    L.btnPractice = { x: pcx - pw0 / 2 - 6, y: y, w: pw0 + 12, h: 28 };
    txt(tr('practice'), pcx, y + 14, 12, C.muted, 'center', FONT, 700);
    g.fillStyle = C.muted; g.fillRect(pcx - pw0 / 2, y + 22, pw0, 1);
    y += 38;
    g.font = '900 32px ' + FONT; var ts = Math.min(32, Math.floor(32 * tb / g.measureText(TH.title).width));
    txt(TH.title, x, y + 16, ts, TH.accent, 'left', FONT, 900);
    /* 副題（英語のみ）。見出しの右に、収まる大きさで */
    if (TH.subtitle) { g.font = '900 ' + ts + 'px ' + FONT; var tw1 = g.measureText(TH.title).width; fitTxt(TH.subtitle, x + tw1 + 12, y + 21, 14, C.muted, tb - tw1 - 12, 700); }
    y += 42;
    var ih = 136, sm = 13;
    drawTitleArt(x, y, tb, ih); y += ih + 16;
    [{ t: TH.tagline, s: 15, c: C.text, gap: 10 },
     { t: tr('opLine')(), s: sm, c: C.muted, gap: 2 },
     { t: TH.link, s: sm, c: C.muted, gap: 2 },
     { t: TH.rule, s: sm, c: C.muted, gap: 2 },
     { t: tr('quadLine'), s: sm, c: C.muted, gap: 2 }
    ].forEach(function (l) {
      g.font = '400 ' + l.s + 'px ' + FONT;
      titleWrap(l.t, tb).forEach(function (ln) { txt(ln, x, y + l.s * 0.6, l.s, l.c); y += l.s * 1.55; });
      y += l.gap;
    });
  }
  /* スピーカーの絵と ON／OFF。OFFのときは音の波の代わりに × */
  function drawSpeaker(r) {
    rr(r.x, r.y, r.w, r.h, 6); g.fillStyle = C.panel; g.fill(); g.strokeStyle = A.on ? TH.accent : C.line; g.lineWidth = 1.2; g.stroke();
    var cx = r.x + 18, cy = r.y + r.h / 2, col = A.on ? TH.accent : C.muted;
    g.fillStyle = col; g.beginPath(); g.moveTo(cx - 8, cy - 4); g.lineTo(cx - 4, cy - 4); g.lineTo(cx + 2, cy - 9); g.lineTo(cx + 2, cy + 9); g.lineTo(cx - 4, cy + 4); g.lineTo(cx - 8, cy + 4); g.closePath(); g.fill();
    g.strokeStyle = col; g.lineWidth = 1.8; g.lineCap = 'round';
    if (A.on) { g.beginPath(); g.arc(cx + 3, cy, 5, -0.8, 0.8); g.stroke(); g.beginPath(); g.arc(cx + 3, cy, 9, -0.8, 0.8); g.stroke(); }
    else { g.beginPath(); g.moveTo(cx + 6, cy - 4); g.lineTo(cx + 12, cy + 4); g.moveTo(cx + 12, cy - 4); g.lineTo(cx + 6, cy + 4); g.stroke(); }
    txt(A.on ? 'ON' : 'OFF', r.x + r.w - 20, cy + 1, 12, A.on ? C.text : C.muted, 'center', FONT, 700);
  }
  /* 2つ並べた切り替え。選ばれている側が光る */
  function drawSeg(r, a, b, leftOn) {
    var hw = r.w / 2;
    rr(r.x, r.y, r.w, r.h, r.h / 2); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.2; g.stroke();
    rr(r.x + (leftOn ? 2 : hw), r.y + 2, hw - 2, r.h - 4, (r.h - 4) / 2); g.fillStyle = leftOn ? TH.accent : C.panel2; g.fill();
    if (!leftOn) { rr(r.x + hw, r.y + 2, hw - 2, r.h - 4, (r.h - 4) / 2); g.fillStyle = TH.accent; g.fill(); }
    txt(a, r.x + hw / 2 + 1, r.y + r.h / 2 + 1, 12, leftOn ? TH.accentInk : C.muted, 'center', FONT, 700);
    txt(b, r.x + hw * 1.5 - 1, r.y + r.h / 2 + 1, 12, leftOn ? C.muted : TH.accentInk, 'center', FONT, 700);
  }
  /* タイトル用の折り返し。\nで改行し、はみ出すときは近くの「、」「！」「。」の後ろで切る */
  function titleWrap(s, maxW) {
    var out = [];
    if (LANG === 'en') {
      s.split('\n').forEach(function (para) {
        var line = '';
        para.split(' ').forEach(function (w) { var tryL = line ? line + ' ' + w : w; if (line && g.measureText(tryL).width > maxW) { out.push(line); line = w; } else line = tryL; });
        if (line) out.push(line);
      });
      return out;
    }
    s.split('\n').forEach(function (para) {
      var line = '', i, ch;
      for (i = 0; i < para.length; i++) {
        ch = para.charAt(i);
        if (g.measureText(line + ch).width > maxW && line && '。、！）」'.indexOf(ch) < 0) {
          var cut = -1, j;
          for (j = line.length - 1; j >= Math.max(1, line.length - 12); j--) if ('、。！'.indexOf(line.charAt(j)) >= 0) { cut = j + 1; break; }
          if (cut > 0 && cut < line.length) { out.push(line.slice(0, cut)); line = line.slice(cut) + ch; }
          else { out.push(line); line = ch; }
        } else line += ch;
      }
      if (line) out.push(line);
    });
    return out;
  }
  /* タイトルの絵。爆弾のケースの点検窓に探針が入り、なぞった壁が緑に光っていく */
  var demo = null;
  function drawTitleArt(x, y, w, h) {
    if (!demo) { demo = mk('bulge', 4.8, 1); demo.h = 1.3; demo.end = 9.3; demo.pins = PIN_POS.map(function (p) { return { x: p.x, side: p.side, scale: 1, dead: false }; }); }
    /* 17秒で一周。前半(10秒)はなぞってBのスイッチを押して解除。後半は残り3秒、下の壁を探っている途中で爆発 */
    var ct = REDUCED ? 7 : clock % 17, scS = ct < 10, st = ct, et = ct - 10, bt = et - 3, boom = !scS && bt >= 0;
    var SWEEP = 4.5, MOVE = 5.0, DONE = 6.2, done = scS && st >= DONE;
    var press = scS && st >= MOVE ? Math.min(1, (st - MOVE) / (DONE - MOVE)) : 0;
    g.save();
    if (boom && bt < 0.7) { var sk = 1 - bt / 0.7; g.translate(rnd(-7, 7) * sk, rnd(-5, 5) * sk); }
    rr(x, y, w, h, 14);
    var gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#1C2D23'); gr.addColorStop(1, '#0E1813');
    g.fillStyle = gr; g.fill(); g.strokeStyle = '#2F5C40'; g.lineWidth = 1.5; g.stroke();
    /* 下の縁に警告ストライプ */
    g.save(); rr(x, y, w, h, 14); g.clip(); g.fillStyle = '#F5C400';
    for (var sx0 = x - 10; sx0 < x + w; sx0 += 16) { g.beginPath(); g.moveTo(sx0, y + h); g.lineTo(sx0 + 8, y + h - 8); g.lineTo(sx0 + 15, y + h - 8); g.lineTo(sx0 + 7, y + h); g.closePath(); g.fill(); }
    g.restore();
    [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 18], [x + w - 10, y + h - 18]].forEach(function (b) { g.beginPath(); g.arc(b[0], b[1], 3, 0, 6.283); g.fillStyle = '#3D6B4E'; g.fill(); });
    /* タイマー */
    var lw = Math.min(124, w * 0.33), lh = Math.min(44, h * 0.3), lx = x + 18, ly = y + (h - 8) / 2 - lh / 2 - 6;
    rr(lx, ly, lw, lh, 6); g.fillStyle = '#1A0705'; g.fill(); g.strokeStyle = '#4A1A14'; g.lineWidth = 1.2; g.stroke();
    var secs = scS ? 30 - Math.min(st, DONE) : Math.max(0, 3 - et);
    g.save(); if (!boom) { g.shadowColor = done ? 'rgba(124,255,155,0.85)' : 'rgba(255,60,40,0.85)'; g.shadowBlur = 12; }
    txt('00:' + (secs < 10 ? '0' : '') + secs.toFixed(1), lx + lw / 2, ly + lh / 2 + 1, Math.min(26, lw / 4.8), boom ? '#5A2018' : (done ? TH.accent : (!scS && Math.floor(clock * 4) % 2 ? '#FFA48C' : '#FF4B33')), 'center', MONO, 700);
    g.restore();
    txt('MK-B', lx + 2, ly + lh + 12, 10, C.muted, 'left', MONO, 600);
    if (done) txt(tr('artDone'), lx + lw - 2, ly + lh + 12, 11, TH.accent, 'right', FONT, 900);
    /* 点検窓 */
    var wx = lx + lw + 30, wy = y + 12, ww = x + w - 14 - wx, wh = h - 32;
    var cols = ['#E8463A', '#3E8BFF', '#F2C230'];
    for (var i = 0; i < 3; i++) {
      var a0 = ly + lh * (0.25 + 0.25 * i), a1 = wy + wh * (0.2 + 0.3 * i);
      g.strokeStyle = cols[i]; g.lineWidth = 3; g.beginPath(); g.moveTo(lx + lw, a0); g.bezierCurveTo(lx + lw + 22, a0 + 26 - i * 14, wx - 22, a1 - 20 + i * 12, wx, a1); g.stroke();
    }
    g.save(); rr(wx, wy, ww, wh, 8); g.clip();
    g.fillStyle = '#07100B'; g.fillRect(wx, wy, ww, wh);
    var k = Math.min(ww / 10.4, wh / 4.8), ox = wx + 0.7 * k, oy = wy + wh / 2;
    var X = function (v) { return ox + v * k; }, Y = function (v) { return oy - v * k; };
    g.strokeStyle = 'rgba(124,255,155,0.07)'; g.lineWidth = 1; g.beginPath();
    for (var gx = wx; gx < wx + ww; gx += k / 2) { g.moveTo(gx, wy); g.lineTo(gx, wy + wh); }
    for (var gy = wy; gy < wy + wh; gy += k / 2) { g.moveTo(wx, gy); g.lineTo(wx + ww, gy); }
    g.stroke();
    g.fillStyle = C.brass; g.fillRect(X(-0.35), wy, 0.35 * k, wh);
    demo.pins[1].scale = done ? 0.2 : 1 - 0.8 * press;
    demo.pins.forEach(function (p, j) {
      var hw = PIN_W * k * 0.8, y1 = Y(p.side * 2.4), y2 = Y(p.side * (1 - PIN_H * p.scale));
      g.fillStyle = ABCD_COL[j]; g.fillRect(X(p.x) - hw, Math.min(y1, y2), hw * 2, Math.abs(y2 - y1));
    });
    var rx = scS ? Math.min(demo.end, 0.8 + Math.min(st, SWEEP) / SWEEP * 8.5) : Math.min(demo.end - 0.1, 0.9 + Math.min(et, 3) / 3 * 5.5);
    var fade = scS ? (st > 8.6 ? Math.max(0, 1 - (st - 8.6) / 1.2) : 1) : (boom ? 0 : 1);
    if (fade > 0) {
      /* 後半は下側の壁だけが光る */
      g.save(); g.beginPath(); if (scS) g.rect(wx, wy, X(rx) - wx, wh); else g.rect(wx, oy, X(rx) - wx, wh); g.clip();
      g.globalCompositeOperation = 'lighter'; cavPath(demo, X, Y);
      g.strokeStyle = 'rgba(124,255,155,' + (0.2 * fade) + ')'; g.lineWidth = 7; g.stroke();
      g.strokeStyle = 'rgba(124,255,155,' + (0.95 * fade) + ')'; g.lineWidth = 1.8; g.stroke();
      g.restore();
    }
    /* 針は入口を支点にまっすぐ。壁やピンを突き抜けない高さまで下げる */
    function wallTip(xx) { var yy = bounds(demo, xx)[1] - 0.07; for (var yi = 0; yi < 60 && yy > 0 && !valid(demo, xx, yy); yi++) yy -= 0.05; return yy; }
    function wallBot(xx) { var yy = bounds(demo, xx)[0] + 0.07; for (var yi = 0; yi < 60 && yy < 0 && !valid(demo, xx, yy); yi++) yy += 0.05; return yy; }
    var tx0, ty0, PX = 3.2, PY = 1 - PIN_H * demo.pins[1].scale - 0.07;
    if (!scS) { tx0 = rx; ty0 = wallBot(rx); }
    else if (st < SWEEP) { tx0 = Math.min(rx, demo.end - 0.1); ty0 = wallTip(tx0); }
    else if (st < MOVE) { var e2 = (st - SWEEP) / (MOVE - SWEEP); e2 = e2 * e2 * (3 - 2 * e2); var ex = demo.end - 0.1, ey = wallTip(ex); tx0 = ex + (PX - ex) * e2; ty0 = ey + (PY - ey) * e2; }
    else { tx0 = PX; ty0 = PY; }
    var sl = ty0 / tx0;
    g.lineCap = 'round'; g.strokeStyle = C.brass; g.lineWidth = 2.6; g.beginPath(); g.moveTo(X(-8), Y(-8 * sl)); g.lineTo(X(tx0), Y(ty0)); g.stroke();
    var glow = (scS && st < SWEEP) || (!scS && !boom) ? fade : 0;
    var rg = g.createRadialGradient(X(tx0), Y(ty0), 0, X(tx0), Y(ty0), 12);
    rg.addColorStop(0, 'rgba(124,255,155,' + (0.7 * glow) + ')'); rg.addColorStop(1, 'rgba(124,255,155,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(X(tx0), Y(ty0), 12, 0, 6.283); g.fill();
    g.fillStyle = C.brassHi; g.beginPath(); g.arc(X(tx0), Y(ty0), 2.2, 0, 6.283); g.fill();
    /* 押し込みのゲージと、解除の表示 */
    if (press > 0 && !done) { g.strokeStyle = ABCD_COL[1]; g.lineWidth = 2.5; g.beginPath(); g.arc(X(tx0), Y(ty0), 10, -Math.PI / 2, -Math.PI / 2 + press * Math.PI * 2); g.stroke(); }
    if (done && st < 9.4) {
      var da = Math.min(1, (st - DONE) / 0.2) * (st > 8.8 ? 1 - (st - 8.8) / 0.6 : 1);
      g.save(); g.globalAlpha = da; g.shadowColor = TH.accent; g.shadowBlur = 14;
      txt(tr('artDone'), wx + ww * 0.62, wy + wh / 2 + 2, LANG === 'en' ? 20 : 26, TH.accent, 'center', FONT, 900); g.restore();
    }
    g.restore();
    rr(wx, wy, ww, wh, 8); g.strokeStyle = '#2F5C40'; g.lineWidth = 1.5; g.stroke();
    g.restore();
    if (boom) {
      var cx = wx + ww / 2, cy = wy + wh / 2;
      g.save(); rr(x, y, w, h, 14); g.clip();
      /* すす。煙が晴れるころに消える */
      g.fillStyle = 'rgba(0,0,0,' + (0.45 * Math.min(1, bt / 0.4) * (1 - Math.max(0, bt - 3.2) / 0.8)) + ')'; g.fillRect(x, y, w, h);
      if (bt < 1) {
        var fr = w * 0.6 * Math.min(1, bt / 0.3), fa = 1 - bt;
        var fb = g.createRadialGradient(cx, cy, 0, cx, cy, fr);
        fb.addColorStop(0, 'rgba(255,245,200,' + fa + ')'); fb.addColorStop(0.4, 'rgba(255,170,60,' + (0.85 * fa) + ')'); fb.addColorStop(1, 'rgba(255,80,30,0)');
        g.fillStyle = fb; g.beginPath(); g.arc(cx, cy, fr, 0, 6.283); g.fill();
      }
      if (bt < 0.35) { g.fillStyle = 'rgba(255,240,210,' + (0.9 * (1 - bt / 0.35)) + ')'; g.fillRect(x, y, w, h); }
      g.restore();
      if (bt < 0.8) { g.strokeStyle = 'rgba(255,230,180,' + (0.7 * (1 - bt / 0.8)) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, w * 1.1 * bt, 0, 6.283); g.stroke(); }
      /* 煙。点検窓からもくもく、のちにプスプス */
      for (var si = 0; si < 10; si++) {
        var st0 = si < 5 ? 0.1 + si * 0.12 : 1.2 + (si - 5) * 0.4, u = (bt - st0) / 2.2;
        if (u <= 0 || u >= 1) continue;
        var sx1 = wx + ww * (0.25 + 0.5 * ((si * 0.37) % 1)), sy1 = cy - u * h * 0.9, sr = (si < 5 ? 14 : 8) + u * 26;
        var sa = (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * (si < 5 ? 0.55 : 0.4), scc = si < 5 ? '60,64,62' : '150,158,154';
        var sg = g.createRadialGradient(sx1, sy1, 0, sx1, sy1, sr);
        sg.addColorStop(0, 'rgba(' + scc + ',' + sa + ')'); sg.addColorStop(1, 'rgba(' + scc + ',0)');
        g.fillStyle = sg; g.beginPath(); g.arc(sx1, sy1, sr, 0, 6.283); g.fill();
      }
    }
  }
  function drawTitleButtons() {
    var tb = Math.min(W - 32, 400), tx = (W - tb) / 2;
    /* おまけはクリアするまで出さない。その間は本編のボタンを少し下に置く */
    L.btnNormal = { x: tx, y: hardOpen ? H - 196 : H - 128, w: tb, h: 92 };
    L.btnEndless = { x: tx + 24, y: H - 92, w: tb - 48, h: 52 };
    var bn = L.btnNormal, be = L.btnEndless;
    rr(bn.x, bn.y, bn.w, bn.h, 14); g.fillStyle = TH.accent; g.fill();
    txt(tr('main'), bn.x + 18, bn.y + 22, 12, TH.accentInk, 'left', FONT, 700);
    g.font = '900 22px ' + FONT; var nt = tr('defuseX')(TH.normal), ns = Math.min(22, Math.floor(22 * (bn.w - 32) / g.measureText(nt).width));
    txt(nt, bn.x + bn.w / 2, bn.y + 48, ns, TH.accentInk, 'center', FONT, 900);
    var sub = bestT.normal ? tr('best')(tr('secs')(bestT.normal.toFixed(1))) : TH.normalSub;
    if (bestP.normal) {
      /* 一度でもノーミスでクリアしていれば、ベストの横にPERFECTの札 */
      g.font = '400 12px ' + FONT; var sw0 = g.measureText(sub).width, bw0 = 64, sx0 = bn.x + bn.w / 2 - (sw0 + 8 + bw0) / 2;
      txt(sub, sx0, bn.y + 74, 12, TH.accentInk, 'left');
      rr(sx0 + sw0 + 8, bn.y + 65, bw0, 18, 9); g.fillStyle = TH.accentInk; g.fill();
      txt('PERFECT', sx0 + sw0 + 8 + bw0 / 2, bn.y + 74.5, 11, '#FFE7A0', 'center', MONO, 800);
    } else txt(sub, bn.x + bn.w / 2, bn.y + 74, 12, TH.accentInk, 'center');
    if (!hardOpen) return;
    rr(be.x, be.y, be.w, be.h, 10); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.2; g.stroke();
    rr(be.x + 10, be.y + be.h / 2 - 10, 46, 20, 10); g.fillStyle = '#F5C400'; g.fill();
    txt(tr('bonus'), be.x + 33, be.y + be.h / 2 + 1, 11, '#1A1500', 'center', FONT, 900);
    txt(TH.endless, be.x + 66, be.y + 18, 14, C.text, 'left', FONT, 700);
    txt((bestN.endless_hard ? tr('best')(bestN.endless_hard + TH.unitN) + '　' : '') + TH.endlessSub, be.x + 66, be.y + 37, 11, C.muted, 'left');
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(frame);
  }
  if (location.hash.indexOf('debug') >= 0) window.__probomb = { get G() { return G; }, get cur() { return cur; }, get T() { return T; }, get state() { return state; }, get R() { return R0; }, get pin() { return pinProg; }, get L() { return L; }, get aim() { return { aim: aimIdx, lock: lockIdx }; }, get view() { return { S: S, OX: OX, OY: OY }; }, get dbg() { return { Pv: Pv, PvS: PvS, cp: cp, contact: contact, pressing: pressing, pm: pm, hold: holdT }; }, bounds: bounds, valid: valid, unlock: function () { unlock(); }, fake: function () { falsePin(G.secret ? 0 : 1); }, setTime: function (t) { R0.time = t; } };
  resize();
  newLock();
  requestAnimationFrame(frame);
})();
