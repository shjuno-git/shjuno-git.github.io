"use strict";
// タイトル画面。TITLE.on の間はゲームを止めてタイトルを描く。タップ（またはEnter/Space）でスタート。
const TITLE = { on: true, startedAt: 0 };
const TFONT = '"Dela Gothic One","Hiragino Sans","Yu Gothic",Meiryo,sans-serif';

function titleLines(){ return lang === 'ja' ? ['両手で', '豆パリィ！'] : ['TWO-HAND', 'BEAN PARRY!']; }
function tapLabel(){ return lang === 'ja' ? 'タップしてスタート' : 'TAP TO START'; }

// 太い縁取りの見出し文字（ゲームの popText と同じ考え方で、和文に強い書体を使う）
function tTxt(txt, x, y, size, fill, edgeW, align, edge){
  ctx.font = size + 'px ' + TFONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if(edgeW){ ctx.lineWidth = edgeW; ctx.strokeStyle = edge || '#111'; ctx.strokeText(txt, x, y); }
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}
function tFit(txt, maxW, size){ ctx.font = size + 'px ' + TFONT; const w = ctx.measureText(txt).width; return w > maxW ? size * maxW / w : size; }
// 網点（アメコミの印刷っぽさ）。k(x,y) で点の大きさを変える
function halftone(x0, y0, w, h, col, step, k){
  ctx.fillStyle = col;
  for(let y = y0; y < y0 + h; y += step) for(let x = x0 + ((y / step) % 2 ? step/2 : 0); x < x0 + w; x += step){
    const r = k(x, y) * step * .45; if(r > .3){ ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); }
  }
}
// ゲームのバー（左は青、右は赤）
function tBar(x, y, len, rot, col){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#111'; roundRect(ctx, -9 + 4, -len/2 + 5, 18, len, 9, true, false);
  ctx.fillStyle = col; roundRect(ctx, -9, -len/2, 18, len, 9, true, false);
  ctx.fillStyle = 'rgba(255,255,255,.45)'; roundRect(ctx, -5, -len/2 + 8, 5, len - 16, 3, true, false);
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, -9, -len/2, 18, len, 9, false, true);
  ctx.restore();
}
// 吹き出し
function tBalloon(x, y, w, h, tx, ty, lines, size, dashed){
  ctx.save();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(x + 4, y + 5, w/2, h/2, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, w/2, h/2, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - w*.12, y + h*.3); ctx.lineTo(tx, ty); ctx.lineTo(x + w*.05, y + h*.38); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round';
  if(dashed) ctx.setLineDash([6, 5]);   // 小声のときは縁を破線にする
  ctx.beginPath(); ctx.ellipse(x, y, w/2, h/2, 0, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - w*.12, y + h*.36); ctx.lineTo(tx, ty); ctx.lineTo(x + w*.05, y + h*.42); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, w/2 - 2, h/2 - 2, 0, 0, Math.PI*2); ctx.fill();
  lines.forEach((l, i) => boldText(l, x, y + (i - (lines.length - 1)/2) * size * 1.2, size, '#111'));
  ctx.restore();
}
// 「タップしてスタート」：ゆっくり脈打つ
function tapPrompt(y, fill, edge, plate){
  const s = 1 + Math.sin(animT * 4) * .05, label = tapLabel();
  ctx.save(); ctx.translate(VW/2, y); ctx.scale(s, s);
  if(plate){
    ctx.font = '20px ' + TFONT; const w = ctx.measureText(label).width + 44;
    ctx.fillStyle = '#111'; roundRect(ctx, -w/2 + 4, -21 + 5, w, 42, 21, true, false);
    ctx.fillStyle = plate; roundRect(ctx, -w/2, -21, w, 42, 21, true, false);
    ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, -w/2, -21, w, 42, 21, false, true);
  }
  tTxt(label, 0, 1, 20, fill, edge ? 6 : 0, 'center', edge);
  ctx.restore();
}

// PCで遊ぶ人向けの操作説明（1行）
function pcLine(y, fill, edge){
  const txt = CONTROL === 'auto'
    ? (lang === 'ja' ? 'PC：←/→ でバー反転　Enter でパワー' : 'PC: ←/→ flip bars   ENTER: Power')
    : (lang === 'ja' ? 'PC：W/S・↑/↓ でバー　Space でパワー' : 'PC: W/S・↑/↓ move bars   SPACE: Power');
  boldText(txt, VW/2, y, 12, fill, 'center', edge, edge ? 4 : 0);
}

// ---------- アメコミの表紙風タイトル ----------
function titleComic(){
  // 放射線の背景と網点
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.translate(VW/2, 330); ctx.rotate(animT * .12);
  for(let i = 0; i < 24; i += 2){ ctx.fillStyle = '#ffe98a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 800, i*Math.PI*2/24, (i+1)*Math.PI*2/24); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  halftone(0, 150, VW, VH - 150, 'rgba(232,32,44,.22)', 11, (x, y) => Math.max(0, (y - 330) / 260));
  // ゲーム画面と同じラリー：豆が鬼に当たってはね返り、バーが豆の来る場所へ動いて受け止め、また鬼へ打ち返す
  const T = animT, CX = VW/2 + 6, CYb = 338, P = 1.2, HALF = P / 2;
  const contactY = (n, side) => 398 + (((n * 53 + side * 29) % 7) - 3) * 14;   // バーが豆を打つ高さ（毎回少し違う）
  const aimY = (n, side) => CYb + (((n * 37 + side * 11) % 5) - 2) * 9;        // 鬼の頭に当たる高さ
  const ease = x => { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
  const rally = [];
  let lastHit = { t: -9, side: 0, hy: CYb };
  const bars = [];
  for(let side = 0; side < 2; side++){
    const off = side * HALF, dir = side === 0 ? 1 : -1, bx = side === 0 ? 40 : VW - 40, hx = CX - dir * 56;
    const n = Math.floor((T - off) / P), te = n * P + off, fr = (T - te) / P;
    const y0 = contactY(n, side), y1 = contactY(n + 1, side), hy = aimY(n, side);
    // バー：次に豆が来る高さへ先回りして動き、打つ瞬間にぐっと前へ
    const barY = y0 + (y1 - y0) * ease(fr / .85), kick = Math.max(0, 1 - (T - te) / .2);
    bars.push({ x: bx + dir * kick * 9, y: barY });
    // 豆：打たれて鬼へ（前半）→ 鬼に当たってはね返り、バーの次の位置へ（後半）
    let x, y;
    if(fr < .5){ const q = fr / .5; x = bx + dir * 14 + (hx - bx - dir * 14) * q; y = y0 + (hy - y0) * q; }
    else { const q = (fr - .5) / .5; x = hx + (bx + dir * 14 - hx) * q; y = hy + (y1 - hy) * q; }
    rally.push({ x, y, dir, out: fr < .5, rot: T * 14 + side * 3 });
    // 直近の「鬼に当たった」時刻
    const th = te + HALF, tHit = T >= th ? th : th - P, nHit = T >= th ? n : n - 1;
    if(tHit > lastHit.t) lastHit = { t: tHit, side, hy: aimY(nHit, side) };
    if(kick > 0) rally[rally.length - 1].spark = { x: bx + dir * 20, y: y0, k: 1 - kick };
  }
  for(const f of rally){
    ctx.save();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    const ux = f.out ? -f.dir : f.dir;                    // 進行方向と逆に、短い集中線
    for(let k = -1; k <= 1; k++){ ctx.beginPath(); ctx.moveTo(f.x + ux * 38, f.y + k*6 + 6); ctx.lineTo(f.x + ux * 16, f.y + k*6 + 4); ctx.stroke(); }
    drawBean(f.x, f.y, 9, f.rot, false); ctx.restore();
  }
  // 大鬼王：豆が当たった瞬間にドンと揺れて、しばらく震える
  const hitAge = T - lastHit.t, react = hitAge >= 0 && hitAge < .5 ? Math.exp(-hitAge * 7) : 0;
  const shove = lastHit.side === 0 ? 1 : -1;
  ctx.save();
  ctx.translate(CX + shove * react * 7 + Math.sin(hitAge * 70) * react * 4, CYb + Math.sin(T * 2) * 4);
  ctx.scale(2.15 * (1 + react * .04), 2.15 * (1 - react * .05));
  drawOni(ctx, 'boss', 0, 0, T, { still: true, shake: react > .05 ? react * 4 : 0 });
  ctx.restore();
  if(hitAge >= 0 && hitAge < .16){   // 当たった場所に星がパッと弾ける
    const k = hitAge / .16, hx = CX - (lastHit.side === 0 ? 1 : -1) * 56, hy = lastHit.hy;
    ctx.save(); ctx.translate(hx, hy); ctx.beginPath();
    for(let i = 0; i < 16; i++){ const a = i * Math.PI / 8 + k, r = (i % 2 ? .5 : 1) * (22 * (1 - k * .5) + 6); i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
    ctx.closePath(); ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  // セリフ：普段は強がり。ときどき（7回に1回）、当たった直後だけ小さな声で本音がもれる
  const hitId = Math.round(lastHit.t / HALF), whisper = hitId % 7 === 3 && hitAge >= 0 && hitAge < 1.6;
  if(whisper){
    const LINES = lang === 'ja' ? [['ぐっ…'], ['いてて…'], ['ぬぐっ…'], ['くっ…']] : [['Ugh...'], ['Ow...'], ['Nrgh...'], ['Hrk...']];
    tBalloon(262, 222, 104, 50, 232, 262, LINES[Math.floor(hitId / 7) % LINES.length], 11, true);
  } else {
    tBalloon(262, 222, 126, 60, 232, 262, lang === 'ja' ? ['豆なんぞ', '効かんわ！'] : ['Beans?', 'Ha!'], 15);
  }
  // 両手のバー
  tBar(bars[0].x, bars[0].y, 120, -.12, '#2e86ff');
  tBar(bars[1].x, bars[1].y, 120, .12, '#ff3b3b');
  // バーで打った瞬間の小さな衝撃線
  for(const f of rally) if(f.spark){
    const q = f.spark; ctx.save(); ctx.globalAlpha = 1 - q.k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for(let i = -1; i <= 1; i++){ const a = i * .5 + (f.dir > 0 ? 0 : Math.PI); ctx.beginPath(); ctx.moveTo(q.x + Math.cos(a)*8, q.y + Math.sin(a)*8); ctx.lineTo(q.x + Math.cos(a)*(18 + q.k*40), q.y + Math.sin(a)*(18 + q.k*40)); ctx.stroke(); }
    ctx.restore();
  }
  // 題字の帯
  const [l1, l2] = titleLines();
  ctx.save(); ctx.translate(VW/2, 92); ctx.rotate(-.06);
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-200 + 6, -54 + 7); ctx.lineTo(200 + 6, -64 + 7); ctx.lineTo(200 + 6, 50 + 7); ctx.lineTo(-200 + 6, 60 + 7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8202c'; ctx.beginPath(); ctx.moveTo(-200, -54); ctx.lineTo(200, -64); ctx.lineTo(200, 50); ctx.lineTo(-200, 60); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.stroke();
  tTxt(l1, -150, -28, 26, '#ffd23f', 7, 'left');
  tTxt(l2, 0, 18, tFit(l2, 320, 70), '#fff', 11);
  ctx.restore();
  tapPrompt(494, '#ffd23f', null, '#111');
  pcLine(532, '#111');
}

// ---------- サウンド／ミュートの2択（今の状態だけが黄色く浮き上がる）----------
const titleSoundRect = { x: VW/2 - 120, y: 446 - 18, w: 240, h: 36 };
const titleSnd = { k: 1, popAt: -9 };
function inTitleSound(p){ return p.x >= titleSoundRect.x && p.x <= titleSoundRect.x + titleSoundRect.w && p.y >= titleSoundRect.y - 4 && p.y <= titleSoundRect.y + titleSoundRect.h + 4; }
function toggleTitleSound(){
  SFX.toggle();                          // どちら側を押しても、いまと逆の状態に切り替える
  titleSnd.popAt = animT;
}
// 太鼓のアイコン：音あり＝赤い太鼓が弾んで音の波、ミュート＝灰色の太鼓に赤い斜線
function tDrum(x, y, s, active, slash){
  const bob = active ? Math.abs(Math.sin(animT * 9)) * 2 : 0, pop = Math.max(0, 1 - (animT - titleSnd.popAt) / .3);
  ctx.save(); ctx.translate(x, y + bob * .5); ctx.scale(s * (1 + pop * .25 * (active ? 1 : 0)), s * (1 + pop * .25 * (active ? 1 : 0)));
  ctx.fillStyle = active ? '#c0202c' : '#bdbdbd'; roundRect(ctx, -12, -5, 24, 16, 3, true, false);
  ctx.lineWidth = 2.6; ctx.strokeStyle = '#111'; roundRect(ctx, -12, -5, 24, 16, 3, false, true);
  ctx.fillStyle = active ? '#fff0c8' : '#e6e6e6'; ctx.beginPath(); ctx.ellipse(0, -5, 12, 5.5, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; [-7, 0, 7].forEach(q => { ctx.beginPath(); ctx.arc(q, 6, 1.4, 0, Math.PI*2); ctx.fill(); });
  ctx.restore();
  if(active){
    ctx.save(); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
    [0, 1].forEach(i => { const ph = (animT * 2 + i * .5) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(x + 10*s, y - 6*s, 6*s + ph*10*s, -1.1, 1.1); ctx.stroke(); });
    ctx.restore();
  }
  if(slash){ ctx.save(); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = '#e8352b'; ctx.beginPath(); ctx.moveTo(x - 14*s, y - 14*s); ctx.lineTo(x + 14*s, y + 14*s); ctx.stroke(); ctx.restore(); }
}
function drawTitleSound(){
  const r = titleSoundRect, on = !SFX.muted, cy = r.y + r.h/2;
  titleSnd.k += ((on ? 1 : 0) - titleSnd.k) * .35;
  ctx.save();
  ctx.fillStyle = '#111'; roundRect(ctx, r.x + 4, r.y + 5, r.w, r.h, 18, true, false);
  ctx.fillStyle = '#9a9a9a'; roundRect(ctx, r.x, r.y, r.w, r.h, 18, true, false);
  const hw = r.w/2 - 3, hx = r.x + 3 + (1 - titleSnd.k) * (r.w/2 - 3);
  ctx.fillStyle = '#ffe14a'; roundRect(ctx, hx, r.y + 3, hw, r.h - 6, 15, true, false);
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; roundRect(ctx, hx, r.y + 3, hw, r.h - 6, 15, false, true);
  ctx.lineWidth = 4; roundRect(ctx, r.x, r.y, r.w, r.h, 18, false, true);
  const fs = lang === 'ja' ? 14 : 13;
  tDrum(r.x + 28, cy, .8, on, false);
  tTxt(t('soundOn'), r.x + r.w/4 + 14, cy + 1, tFit(t('soundOn'), 76, fs), on ? '#111' : '#555');
  tDrum(r.x + r.w/2 + 24, cy, .8, false, true);
  tTxt(t('soundOff'), r.x + r.w*3/4 + 14, cy + 1, tFit(t('soundOff'), 76, fs), on ? '#555' : '#111');
  ctx.restore();
}
function drawTitle(){
  ctx.save(); titleComic(); ctx.restore();
  drawTitleSound();
  drawLangButton();
}
function startFromTitle(){
  if(!TITLE.on) return;
  TITLE.on = false; TITLE.startedAt = performance.now();
  startTime = Date.now();
  SFX.play('retry');
}
function backToTitle(){ restartGame(); TITLE.on = true; }

// タイトル中の入力：言語・音ボタン以外のタップでスタート。ゲーム側のタップ処理には渡さない
function inTitleButtons(p){
  return (p.y <= langBtnRect.y + langBtnRect.h + 4 && p.x >= langBtnRect.x - 4) || inTitleSound(p);
}
window.addEventListener('pointerdown', e => {
  if(!TITLE.on || e.target !== canvas) return;
  if(inTitleButtons(mapClient(e.clientX, e.clientY))) return;
  e.stopPropagation(); e.preventDefault();
  startFromTitle();
}, true);
window.addEventListener('mousedown', e => {
  if(e.target !== canvas) return;
  if(TITLE.on && !inTitleButtons(mapClient(e.clientX, e.clientY))) { e.stopPropagation(); return; }
  if(performance.now() - TITLE.startedAt < 400) e.stopPropagation();   // スタートしたタップを二重に拾わない
}, true);
window.addEventListener('keydown', e => {
  if(!TITLE.on) return;
  if(e.key === 'Enter' || e.key === ' ' || e.code === 'Space') { startFromTitle(); e.preventDefault(); }
  e.stopPropagation();
}, true);
