"use strict";
// 効果音（Web Audioで合成。外部ファイルなし）。書き方は 15.jump の js/sfx.js と同じ。
// 音の方針: スライム=ぷるんとやわらかいサイン波 / 5人=もにょもにょ声(人ごとに音程) / ボタン・ファンファーレ=木琴 / 谷底=こもった土の音。
// 2026-10-18 効果音ラボ(dev/mock/se_mock.html)の「おすすめ」案をそのまま採用し、よく鳴る音ほど小さく音量を揃えた。
// スマホは最初のタップまで音が出ないため、最初の操作で unlock() する。
const SFX = (() => {
  let ac = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('slimeBridge_mute') === '1'; } catch (e) {}
  const lastAt = {};   // 種類ごとの最終再生時刻（鳴りすぎ防止）

  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.55;
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function unlock() {
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0);
  }
  ['pointerdown', 'touchstart', 'touchend', 'keydown', 'mousedown'].forEach(ev =>
    window.addEventListener(ev, unlock, { capture: true, passive: true }));

  function ready(name, gapMs) {
    if (muted || !ac || ac.state !== 'running') return false;
    const n = performance.now();
    if (lastAt[name] && n - lastAt[name] < (gapMs || 0)) return false;
    lastAt[name] = n;
    return true;
  }
  const jit = (k) => 1 + (Math.random() * 2 - 1) * (k || 0.04);
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);   // MIDIの音番号 → Hz (60=ド)

  function tone(o) {
    const t0 = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.slide || o.dur));
    if (o.vib) {   // [速さHz, 深さHz, 終わりの深さHz] ぷるぷる揺らす
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = o.vib[0];
      lg.gain.setValueAtTime(o.vib[1], t0);
      if (o.vib[2] !== undefined) lg.gain.linearRampToValueAtTime(o.vib[2], t0 + o.dur);
      l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + o.dur + 0.02);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.g, t0 + (o.atk || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); f.connect(g); }
    else osc.connect(g);
    g.connect(master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.02);
  }
  function noise(o) {
    const t0 = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const flt = ac.createBiquadFilter(); flt.type = o.ft || 'bandpass';
    flt.frequency.setValueAtTime(o.f, t0);
    if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    flt.Q.value = o.q || 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.g, t0 + (o.atk || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.4); src.stop(t0 + o.dur + 0.02);
  }
  // 木琴: 基音 + 4倍音を短く + 打ったカチッ
  function mar(f, delay, g, dur) {
    tone({ f: f, g: g, dur: dur, delay: delay, atk: 0.002 });
    tone({ f: f * 4, g: g * 0.16, dur: dur * 0.22, delay: delay, atk: 0.002 });
    tone({ f: f * 9.8, g: g * 0.05, dur: 0.03, delay: delay, atk: 0.001 });
  }
  // 人ごとの声の高さ（ショート・ミディアム・チャレンジャー・クライマー・トール）と、かけ声の音節数
  const PEOPLE_P = [1.45, 1.15, 1.05, 0.9, 0.72];
  const SAY_N = [3, 2, 4, 2, 2];
  const pp = (i) => PEOPLE_P[((i || 0) % 5 + 5) % 5];
  function babble(n, p, delay) {   // ぷるぷるゼリー系: サイン波をふるわせた、もにょもにょ声
    for (let i = 0; i < n; i++) {
      const f = 330 * p * (1 + (i % 2 ? 0.18 : 0) + Math.random() * 0.12);
      tone({ f: f, f2: f * (i === n - 1 ? 0.82 : 1.06), dur: 0.09, g: 0.085, vib: [24, f * 0.08, 0], lp: 1500, atk: 0.008, delay: (delay || 0) + i * 0.085 });
    }
  }

  return {
    get muted() { return muted; },
    setMuted(m) {
      muted = !!m;
      try { localStorage.setItem('slimeBridge_mute', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.55;
    },
    /* ---- 描く・スライム ---- */
    // なぞる: ぷるぷるゼリー(2026-11-13 なぞる音ラボの案7を採用)。13pxなぞるごとに1回。k=使ったインク 0〜1で高くなる
    drawStart() { if (!ready('drawStart', 60)) return; tone({ f: 180, f2: 360, slide: 0.06, dur: 0.2, g: 0.10, vib: [24, 40, 0] }); },
    draw(k) {
      if (!ready('draw', 50)) return;
      const f = (200 + k * 520) * jit(0.05);
      tone({ f: f, g: 0.085, dur: 0.16, vib: [26, f * 0.12, 0], lp: 1500, atk: 0.006 });
      tone({ f: f * 2, g: 0.02, dur: 0.1, vib: [26, f * 0.2, 0] });
    },
    drawEnd(k) {
      if (!ready('drawEnd', 100)) return;
      const f = 200 + k * 520;
      tone({ f: f * 1.3, f2: f * 2, slide: 0.06, dur: 0.6, g: 0.10, vib: [18, f * 0.2, 0] });
    },
    // ぷるん: タップしたスライムが ぷるるんと揺れる(揺れているあいだ、ふるえが続く)
    purun() {
      if (!ready('purun', 120)) return;
      tone({ f: 250, f2: 640, slide: 0.07, dur: 0.75, g: 0.15, vib: [17, 55, 0] });
      tone({ f: 500, f2: 1100, slide: 0.07, dur: 0.5, g: 0.045, vib: [17, 90, 0] });
      noise({ f: 1500, q: 2, dur: 0.05, g: 0.03 });
    },
    // みじかい！: ぷすん
    short() { if (!ready('short', 200)) return; tone({ f: 420, f2: 150, dur: 0.22, g: 0.10, vib: [22, 30, 0] }); },
    // 降ってくる: ぽこっ
    spawn() { if (!ready('spawn', 60)) return; tone({ f: 520 * jit(), f2: 880, dur: 0.09, g: 0.07 }); },
    // つかむ: むにゅ
    grab() { if (!ready('grab', 60)) return; tone({ f: 230, f2: 430, dur: 0.14, g: 0.12, vib: [26, 30, 0] }); },
    // ぺたっ: ぷにっ（いちばん多く鳴るので控えめ）
    land() { if (!ready('land', 50)) return; const p = jit(0.06); tone({ f: 520 * p, f2: 240 * p, dur: 0.11, g: 0.11, lp: 1800 }); noise({ f: 1300, q: 2, dur: 0.035, g: 0.03 }); },
    // ぷるん(跳ね): ぽよん
    bounce() { if (!ready('bounce', 120)) return; tone({ f: 380 * jit(), f2: 560, dur: 0.1, g: 0.08, vib: [20, 20, 0] }); },
    /* ---- 画びょう ---- */
    // 発射: しゅぴっ
    pin() { if (!ready('pin', 60)) return; noise({ ft: 'highpass', f: 1200, f2: 5000, dur: 0.16, g: 0.07 }); tone({ f: 600, f2: 1500, dur: 0.14, g: 0.07 }); },
    // 消える: ぱちん＋しゅわっ
    erase() { if (!ready('erase', 60)) return; noise({ f: 1800, q: 1.2, dur: 0.05, g: 0.10 }); tone({ f: 900, f2: 200, dur: 0.12, g: 0.08 }); for (let i = 0; i < 6; i++) tone({ f: 1200 + Math.random() * 1400, dur: 0.03, g: 0.025, delay: 0.08 + i * 0.04 }); },
    // 空振り: ぽすっ
    miss() { if (!ready('miss', 60)) return; noise({ ft: 'lowpass', f: 700, dur: 0.08, g: 0.10 }); tone({ f: 160, f2: 90, dur: 0.07, g: 0.08 }); },
    // 崩れる: ぐらっ…
    collapse() { if (!ready('collapse', 250)) return; tone({ f: 260, f2: 110, slide: 0.45, dur: 0.5, g: 0.10, vib: [8, 30, 10] }); },
    /* ---- ギミック ---- */
    // ふわっ: ひゅーん
    wind() { if (!ready('wind', 150)) return; noise({ f: 600, f2: 1900, q: 4, dur: 0.6, g: 0.09, atk: 0.12 }); },
    // ぱんっ！: 風船ぱんっ（大きすぎたので2026-10-18に約半分へ）
    spike() { if (!ready('spike', 60)) return; noise({ ft: 'highpass', f: 800, dur: 0.07, g: 0.11, atk: 0.001 }); tone({ f: 220, f2: 60, dur: 0.12, g: 0.08 }); },
    /* ---- 5人 ---- */
    // ぴょん: i=人の番号で高さが変わる
    hop(i) { if (!ready('hop' + i, 80)) return; const p = pp(i), f = 300 * p; tone({ f: f, f2: f * 1.75, slide: 0.06, dur: 0.12, g: 0.075, vib: [22, f * 0.1, 0], lp: 1600, atk: 0.006 }); tone({ f: f * 2, f2: f * 3.2, slide: 0.06, dur: 0.07, g: 0.015, atk: 0.006 }); },
    // かけ声: もにょもにょ声
    say(i) { if (!ready('say' + i, 300)) return; babble(SAY_N[((i || 0) % 5 + 5) % 5], pp(i)); },
    // わー: 落ち始め（吹き出し「わー」が出たとき）
    wa(i) { if (!ready('wa' + i, 400)) return; const p = pp(i); tone({ f: 700 * p * 0.85, f2: 300 * p * 0.85, dur: 0.55, g: 0.065, lp: 1500, vib: [7, 30, 30] }); },
    // どさっ: 谷底にぽふっ
    thud() { if (!ready('thud', 60)) return; noise({ ft: 'lowpass', f: 380, dur: 0.14, g: 0.08 }); tone({ f: 170, f2: 80, dur: 0.24, g: 0.13, vib: [16, 22, 0], lp: 700 }); },
    // +1: 木琴ぴろん。n=何人目(0〜4)で高くなる
    goal(n) { if (!ready('goal', 60)) return; const s = [0, 2, 4, 7, 9][Math.min(4, Math.max(0, n || 0))]; mar(N(76 + s), 0, 0.14, 0.35); mar(N(83 + s), 0.07, 0.14, 0.45); },
    /* ---- 画面・結果 ---- */
    // ボタン: 木の音ころん（決定・画像の切り替えなどで何度も鳴るので小さめ。2026-10-18 に 0.14→0.07）
    tap() { if (!ready('tap', 60)) return; mar(N(79), 0, 0.09, 0.22); },
    // ステージ名: 木琴たららん
    intro() { if (!ready('intro', 300)) return; [60, 64, 67, 72].forEach((m, i) => mar(N(m + 12), i * 0.07, 0.12, 0.5)); },
    // 残り5秒: 木のチッ。last=最後の1秒は高く
    tick(last) { if (!ready('tick', 300)) return; mar(N(last ? 91 : 86), 0, 0.07, 0.08); },
    // 人が来る！: 笛ピッピッ
    walk() { if (!ready('walk', 300)) return; tone({ f: 520, f2: 780, slide: 0.08, dur: 0.14, g: 0.08, vib: [22, 50, 0], lp: 1800, atk: 0.006 }); tone({ f: 520, f2: 940, slide: 0.12, dur: 0.32, g: 0.08, vib: [22, 60, 0], lp: 1800, atk: 0.006, delay: 0.17 }); },
    // クリア！: 木琴ファンファーレ
    clear() { if (!ready('result', 500)) return; [60, 64, 67].forEach((m, i) => mar(N(m + 12), i * 0.11, 0.15, 0.3)); [72, 76, 79].forEach(m => mar(N(m + 12), 0.36, 0.1, 0.9)); },
    // ざんねん: しょぼん2音
    fail() { if (!ready('result', 500)) return; mar(N(72), 0, 0.13, 0.4); mar(N(67), 0.22, 0.13, 0.7); },
    // ぜんぶクリア: 木琴の大ファンファーレ
    ending() { if (!ready('ending', 1000)) return; [60, 64, 67, 72, 67, 72].forEach((m, i) => mar(N(m + 12), i * 0.12, 0.14, 0.3)); [72, 76, 79, 84].forEach(m => mar(N(m + 12), 0.78, 0.08, 1.3)); for (let i = 0; i < 10; i++) tone({ f: 2200 + Math.random() * 1800, dur: 0.06, g: 0.02, delay: 0.85 + i * 0.09 }); }
  };
})();
