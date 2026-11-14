"use strict";
// 効果音（Web Audioで合成。外部ファイルなし）。和楽器（拍子木・太鼓・鈴）×アメコミの派手さ。
// スマホは最初のタップまで音が出ないため、最初の操作で unlock() する。
const SFX = (() => {
  let ac = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('ryote_sfx_muted') === '1'; } catch(e) {}
  const lastAt = {};   // 種類ごとの最終再生時刻（鳴りすぎ防止）

  function init(){
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.55;
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function unlock(){
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    // iOS向け：無音を1回鳴らして出力を有効化
    const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0);
  }
  ['pointerdown', 'touchstart', 'touchend', 'keydown', 'mousedown'].forEach(ev =>
    window.addEventListener(ev, unlock, { capture: true, passive: true }));

  function ready(name, gapMs){
    if (muted || !ac || ac.state !== 'running') return false;
    const n = performance.now();
    if (lastAt[name] && n - lastAt[name] < gapMs) return false;
    lastAt[name] = n;
    return true;
  }
  const jit = (k = 0.05) => 1 + (Math.random() * 2 - 1) * k;

  // 音程が動く単音
  // 左右に振る（pan: -1=左〜1=右）。未対応ブラウザではそのまま中央
  function out(node, pan){
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(master); }
    else node.connect(master);
  }
  function tone(o){
    const t0 = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.slide || o.dur));
    if (o.vib) {   // ビブラート（ほら貝・尺八っぽい揺れ）
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = o.vib; lg.gain.value = o.vibAmt || 6;
      l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + o.dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.g, t0 + (o.atk || 0.003));
    if (o.hold) g.gain.setValueAtTime(o.g, t0 + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    if (o.lp) {    // こもらせる（ローパス）
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.lpQ || 1;
      osc.connect(f); f.connect(g);
    } else osc.connect(g);
    out(g, o.pan);
    osc.start(t0); osc.stop(t0 + o.dur + 0.02);
  }
  // フィルタを通したノイズ（打撃の「アタック」や破裂音）
  function noise(o){
    const t0 = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const flt = ac.createBiquadFilter(); flt.type = o.ft || 'bandpass';
    flt.frequency.setValueAtTime(o.f, t0);
    if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    flt.Q.value = o.q || 1;
    const g = ac.createGain();
    if (o.atk) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.g, t0 + o.atk); }
    else g.gain.setValueAtTime(o.g, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(flt); flt.connect(g); out(g, o.pan);
    src.start(t0); src.stop(t0 + o.dur + 0.02);
  }

  // 楽器パーツ
  const YO = [587, 659, 784, 880, 988, 1175, 1319, 1568, 1760, 1976];   // 陽音階（明るい和の音階）
  function taiko(d, g, f){ tone({ f, f2: 52, g, dur: 0.32, slide: 0.18, delay: d }); noise({ f: 700, f2: 180, ft: 'lowpass', g: g * 0.5, dur: 0.08, delay: d }); }
  function kane(d, g){ tone({ f: 3400, g, dur: 0.1, type: 'square', lp: 5000, delay: d }); tone({ f: 4700, g: g * 0.5, dur: 0.08, delay: d }); }
  function fue(f, d, len){   // 篠笛
    tone({ f, g: 0.2, dur: len, atk: 0.03, hold: len * 0.6, vib: 5.5, vibAmt: f * 0.012, delay: d });
    noise({ f, q: 12, g: 0.05, dur: len * 0.8, atk: 0.03, delay: d });
  }

  function kan(d, g, f){ noise({ f, q: 9, g, dur: 0.035, delay: d }); tone({ f: f * 0.68, f2: f * 0.5, g: g * 0.4, dur: 0.06, type: 'triangle', delay: d }); }
  function clap(d, g){ [0, 0.008, 0.017].forEach(x => noise({ f: 1300 * jit(0.08), q: 1.2, g: g * (x ? 0.6 : 1), dur: 0.05, delay: d + x })); }
  function suzumushi(d, len, g){ for (let t = 0; t < len; t += 0.32) for (let k = 0; k < 5; k++) tone({ f: 4300, g, dur: 0.028, atk: 0.004, delay: d + t + k * 0.034 }); }

  const sounds = {
    // 1. バーで打ち返す：拍子木の「カッ」
    paddle(){
      if (!ready('paddle', 45)) return;
      const k = jit(0.06);
      noise({ f: 2600*k, q: 9, g: 0.9, dur: 0.035 });
      tone({ f: 1750*k, f2: 1300*k, g: 0.35, dur: 0.06, type: 'triangle' });
      tone({ f: 980*k, g: 0.18, dur: 0.05 });
    },
    // 2. 鬼の体に当たる：小太鼓の「ポコッ」
    hit(){
      if (!ready('hit', 50)) return;
      const k = jit(0.07);
      tone({ f: 460*k, f2: 190*k, g: 0.7, dur: 0.11, slide: 0.08 });
      noise({ f: 1400*k, q: 3, g: 0.35, dur: 0.03 });
    },
    // 3. 角に当たる：大鼓（おおかわ）の乾いた「カンッ」。高い余韻を残さない
    crit(){
      if (!ready('crit', 60)) return;
      noise({ f: 1800, q: 3, g: 0.6, dur: 0.05 });
      tone({ f: 1150, f2: 820, g: 0.45, dur: 0.1, slide: 0.05 });
      tone({ f: 160, f2: 70, g: 0.6, dur: 0.2 });
    },
    // 4. 鬼を倒す：「バコーン」と弾けて鈴がシャラン
    kill(){
      if (!ready('kill', 80)) return;
      noise({ f: 3500, f2: 260, ft: 'lowpass', q: 2, g: 1.0, dur: 0.32 });
      tone({ f: 220, f2: 55, g: 0.9, dur: 0.36, slide: 0.25 });
      [1568, 1976, 2349].forEach((f, i) =>
        tone({ f, g: 0.16, dur: 0.55, delay: 0.07 + i * 0.05, type: 'triangle' }));
    },
    // 5. 豆が落ちる：ちょっと残念な「ポトッ…」
    lost(){
      if (!ready('lost', 90)) return;
      tone({ f: 330, f2: 140, g: 0.55, dur: 0.14, slide: 0.12 });
      tone({ f: 220, f2: 95, g: 0.35, dur: 0.14, slide: 0.12, delay: 0.13 });
      noise({ f: 700, q: 4, g: 0.25, dur: 0.04, delay: 0.13 });
    },

    // ---- 優先度B：イベントの合図 ----
    // 6a. 鬼火の予告：歌舞伎の人魂の「ドロドロ…」（太鼓のトレモロが0.75秒かけて大きくなる）
    //     side: 飛んでくる側（'left' / 'right'）に少しだけ寄せる
    tele(side){
      if (!ready('tele', 250)) return;
      const pan = side === 'left' ? -.3 : side === 'right' ? .3 : 0;
      let i = 0;
      for (let t = 0; t < .75; t += .045, i++) {
        const k = (.35 + .65 * t / .75) * (i % 2 ? .7 : 1);
        tone({ f: 110, f2: 80, g: .32 * k, dur: .09, delay: t, pan });
        tone({ f: 220, f2: 160, g: .16 * k, dur: .05, delay: t, pan });
      }
    },
    // 6b. 鬼火が飛ぶ瞬間：能管風の細い笛「ヒュ〜」。飛んでいく側へはっきり寄せる
    launch(side){
      if (!ready('launch', 200)) return;
      const pan = side === 'left' ? -.85 : side === 'right' ? .85 : 0;
      tone({ f: 1500, f2: 900, g: .14, dur: .45, slide: .4, atk: .02, hold: .22, vib: 7, vibAmt: 18, pan });
      noise({ f: 1500, f2: 900, q: 8, g: .056, dur: .45, atk: .02, pan });
    },
    // 7. パリィ：鉦（かね）を弾く「チャンッ！」。響きは短く、高すぎない
    parry(){
      if (!ready('parry', 60)) return;
      noise({ f: 3000, q: 2, g: .45, dur: .03 });
      tone({ f: 1568, g: .3, dur: .2, type: 'triangle' });
      tone({ f: 2349, g: .16, dur: .14, type: 'triangle' });
      tone({ f: 1568 * 2.4, g: .05, dur: .08 });
      tone({ f: 330, f2: 220, g: .25, dur: .08 });   // 受け止めた手応え
    },
    // 8. 鬼火を取り逃す：「ボフッ」と燃える
    burn(){
      if (!ready('burn', 120)) return;
      noise({ f: 1600, f2: 180, ft: 'lowpass', q: 1.5, g: 0.9, dur: 0.32, atk: 0.015 });
      tone({ f: 170, f2: 60, g: 0.6, dur: 0.28, slide: 0.2 });
      noise({ f: 3000, ft: 'highpass', g: 0.08, dur: 0.4, delay: 0.05, atk: 0.05 });   // パチパチ
    },
    // 9. Powerゲージ満タン：鈴の「シャラン」
    ready(){
      if (!ready('ready', 400)) return;
      [1760, 1976, 2349, 2637, 3136].forEach((f, i) =>
        tone({ f: f * jit(0.01), g: 0.13, dur: 0.5, delay: i * 0.035, type: 'triangle' }));
      noise({ f: 7000, ft: 'highpass', g: 0.12, dur: 0.35, atk: 0.02 });
    },
    // 10. Power発動：大太鼓「ドンッ！」＋拍子木の「カッ」＋衝撃波の「ブォッ」→ 豆が飛び出す「ポポポポ」＋鈴
    power(){
      if (!ready('power', 300)) return;
      tone({ f: 120, f2: 42, g: 1.0, dur: 0.5, slide: 0.28 });                          // 大太鼓の胴
      noise({ f: 800, f2: 150, ft: 'lowpass', g: 0.8, dur: 0.22 });                      // 打面
      kan(0, .55, 2200);                                                                 // 拍子木のアタック
      noise({ f: 3800, f2: 280, q: 1.4, g: 0.42, dur: 0.5, atk: 0.02 });                // 衝撃波が広がる
      [0.09, 0.16, 0.23, 0.30].forEach((d, i) => {                                       // 豆が出る小さな木の音
        const k = 1 + i * 0.07;
        tone({ f: 760 * k, f2: 420 * k, g: 0.3, dur: 0.07, slide: 0.05, delay: d });
        noise({ f: 1500 * k, q: 5, g: 0.16, dur: 0.02, delay: d });
      });
      [1568, 1976, 2349].forEach((f, i) =>
        tone({ f, g: 0.11, dur: 0.55, delay: 0.14 + i * 0.05, type: 'triangle' }));       // 余韻の鈴
    },
    // 最後の豆がなくなった：大太鼓の低い「ズシン…」（ゲームオーバー前の間）
    thud(){
      if (!ready('thud', 500)) return;
      tone({ f: 100, f2: 36, g: 1.0, dur: 0.8, slide: 0.5 });
      noise({ f: 500, f2: 80, ft: 'lowpass', g: 0.8, dur: 0.3 });
      tone({ f: 66, f2: 50, g: 0.3, dur: 1.0, type: 'triangle', delay: 0.05 });
    },
    // 小豆が育つ：木の「ボンッ」と、上へ跳ねる音＋小さな鈴（普通のLuckyより控えめ）
    grow(){
      if (!ready('grow', 120)) return;
      tone({ f: 300, f2: 720, g: .5, dur: .14, slide: .08, type: 'triangle' });
      noise({ f: 1800, q: 3, g: .3, dur: .04 });
      [1760, 2349].forEach((f, i) => tone({ f, g: .09, dur: .35, delay: .05 + i * .04, type: 'triangle' }));
    },
    // 豆が焦げて縮む：「ボッ」と火が付き、「ジュッ」と萎む
    scorch(){
      if (!ready('scorch', 120)) return;
      noise({ f: 900, f2: 200, ft: 'lowpass', g: .45, dur: .15, atk: .008 });
      tone({ f: 260, f2: 90, g: .45, dur: .18, slide: .14 });
      noise({ f: 4000, f2: 800, ft: 'highpass', g: .3, dur: .3, atk: .01, delay: .04 });
      [.1, .17, .24].forEach(d => noise({ f: 5200, q: 6, g: .09, dur: .012, delay: d }));   // パチパチ
    },
    // 小豆が少し焦げる：scorchより短く小さく
    scorchSoft(){
      if (!ready('scorchSoft', 120)) return;
      noise({ f: 4500, f2: 1500, ft: 'highpass', g: .16, dur: .16, atk: .008 });
      tone({ f: 220, f2: 120, g: .16, dur: .1, slide: .08 });
      noise({ f: 5200, q: 6, g: .06, dur: .012, delay: .08 });
    },
    // 11. Lucky（ピンクの星）：鈴＋陽音階でキラキラ上昇
    lucky(){
      if (!ready('lucky', 150)) return;
      YO.slice(3, 9).forEach((f, i) => tone({ f, g: 0.15, dur: 0.35, delay: i * 0.045, type: 'triangle' }));
      noise({ f: 8000, ft: 'highpass', g: 0.14, dur: 0.4, delay: 0.05, atk: 0.02 });
    },
    // 12a. STAGE CLEAR：締め太鼓「ドン・ドン・ドドン」→ 小鼓「ポン！」＋鈴
    clear(){
      if (!ready('clear', 1000)) return;
      [0, 0.18, 0.36, 0.45].forEach((d, i) => {
        tone({ f: i === 3 ? 115 : 135, f2: 55, g: i === 3 ? 1.0 : 0.75, dur: 0.3, slide: 0.18, delay: d });
        noise({ f: 700, f2: 180, ft: 'lowpass', g: 0.45, dur: 0.08, delay: d });
      });
      tone({ f: 780, f2: 540, g: 0.6, dur: 0.2, slide: 0.06, delay: 0.7 });
      [1568, 1976, 2349].forEach((f, i) => tone({ f, g: 0.14, dur: 0.6, delay: 0.75 + i * 0.05, type: 'triangle' }));
    },
    // 12b-1. ALL CLEAR! の文字が出てからクリア画面まで（約1.1秒）：締め太鼓が加速して大太鼓で盛り上げる
    allclearRoll(){
      if (!ready('allclearRoll', 1500)) return;
      const hits = [0, .2, .36, .5, .6, .68, .75, .81, .86, .9, .94, .97, 1.0];
      hits.forEach((d, i) => {
        const k = .45 + .55 * i / (hits.length - 1);
        tone({ f: 430, f2: 310, g: .32 * k, dur: .08, delay: d });          // 締め太鼓「テン」
        noise({ f: 2600, q: 4, g: .2 * k, dur: .025, delay: d });
        if (i % 3 === 0) taiko(d, .45 * k, 135);
      });
    },
    // 12b-2. クリア画面が出たら：篠笛と鉦（かね）の掛け合い「ピーヒャラ、チキチン、ドドン！」（約2.4秒）
    allclear(){
      if (!ready('allclear', 1500)) return;
      let d = 0;
      [[[4, .14], [5, .14], [7, .28]], [[7, .14], [8, .14], [9, .28]]].forEach(ph => {
        ph.forEach(([n, l]) => { fue(YO[n], d, l * .92); d += l; });
        kane(d, .08); kane(d + .09, .06); kane(d + .18, .09); taiko(d, .45, 140);
        d += .27;
      });
      taiko(d, .8, 130); taiko(d + .12, 1, 110); fue(YO[9], d + .12, .6);
      for (let i = 0; i < 5; i++) taiko(i * .28, .3, 160);
    },

    // ---- ゲームオーバー / リトライ（夏祭りの夜） ----
    // ゲームオーバー：盆踊りのシメ「ドン ドン カッカ ドンカカ ドン！」→ 鈴虫が鳴いて夜になる
    over(){
      if (!ready('over', 1000)) return;
      taiko(0, .7, 125); taiko(.26, .6, 125); kan(.52, .35, 1500); kan(.65, .35, 1500);
      taiko(.78, .6, 125); kan(.91, .3, 1500); kan(.98, .3, 1500); taiko(1.04, .95, 110);
      suzumushi(1.5, 1.3, .035);
    },
    // RETRY：拍子木 1打「カンッ！」
    retry(){
      if (!ready('retry', 300)) return;
      kan(0, .9, 2300); kan(.012, .6, 2000);
    },

    // ---- 優先度C：仕上げ ----
    // 強化カードが並ぶ：札を3枚並べる「シャッ、シャッ、シャッ」
    buffOpen(){
      if (!ready('buffOpen', 500)) return;
      [0, .09, .18].forEach(d => noise({ f: 4200 * jit(.1), f2: 2000, q: 1.5, g: .3, dur: .06, atk: .005, delay: d }));
    },
    // 強化を選ぶ：鼓「ポン」＋鈴
    buffPick(){
      if (!ready('buffPick', 200)) return;
      tone({ f: 980, f2: 680, g: .6, dur: .2, slide: .06 }); tone({ f: 1960, f2: 1360, g: .12, dur: .06 });
      [1976, 2349, 2637].forEach((f, i) => tone({ f, g: .1, dur: .45, delay: .06 + i * .04, type: 'triangle' }));
    },
    // 引き直し：札をまとめてめくる「シャラッ」＋木の「カラッ」
    reroll(){
      if (!ready('reroll', 150)) return;
      noise({ f: 5000, f2: 1800, q: 1.2, g: .35, dur: .14, atk: .01 });
      kan(.1, .3, 1800);
    },
    // コンボ：段ごとに陽音階を上がっていく小さな鈴（当たり音の直後）。最高でも約2kHzまで
    combo(n){
      if (n < 2 || !ready('combo', 40)) return;
      const step = Math.min(n - 2, YO.length - 1);
      tone({ f: YO[step], g: .07 + Math.min(n, 10) * .004, dur: .22, delay: .03, type: 'triangle' });
    },
    // 壁で跳ね返る：軽い木の「コツッ」（控えめだが、ちゃんと聞こえる大きさ）
    wall(){
      if (!ready('wall', 70)) return;
      const k = jit(.08);
      noise({ f: 1500 * k, q: 6, g: .26, dur: .022 });
      tone({ f: 900 * k, f2: 640 * k, g: .2, dur: .05, type: 'triangle' });
    },
    // 豆同士がぶつかる：豆どうしの「カチッ」
    clink(){
      if (!ready('clink', 60)) return;
      const k = jit(.1);
      noise({ f: 2600 * k, q: 7, g: .2, dur: .018 });
      tone({ f: 1700 * k, f2: 1350 * k, g: .13, dur: .04, type: 'triangle' });
    },
    // UIボタン（言語切替など）：木魚「ポク」
    ui(){
      if (!ready('ui', 80)) return;
      tone({ f: 820, g: .3, dur: .08 }); noise({ f: 900, q: 6, g: .2, dur: .025 });
    },
  };

  return {
    play(name, arg){ try { const s = sounds[name]; if (s) s(arg); } catch(e) {} },
    unlock,
    get muted(){ return muted; },
    toggle(){
      muted = !muted;
      try { localStorage.setItem('ryote_sfx_muted', muted ? '1' : '0'); } catch(e) {}
      unlock();
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ac.currentTime, 0.02);
      if (!muted) { lastAt.paddle = 0; sounds.paddle(); }   // ONにしたら確認用に1音
      return muted;
    },
  };
})();
