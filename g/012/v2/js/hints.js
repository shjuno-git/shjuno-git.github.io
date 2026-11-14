"use strict";
// 遊びながら覚えるヒント。どれも1回だけ表示し、その操作をするか時間が経つと消える。
// 一度見たヒントはブラウザに覚えておき、次のプレイでは出さない。
const HINT_TEXT = {
  ja: { slide: 'なぞってバーを動かす', slideFlip: 'タップでバーの向きを反転', horn: '角をねらうと大ダメージ！', power: 'タップで豆を投入！', oni: 'バーで受け止めろ！', lucky: '当てると豆が増える！' },
  en: { slide: 'Drag to move the bars', slideFlip: 'Tap to flip the bars', horn: 'Hit the horn for big damage!', power: 'Tap to drop beans!', oni: 'Block it with a bar!', lucky: 'Hit it for more beans!' },
};
const HINT_LIFE = { slide: Infinity, horn: 4, power: 7, oni: 2.5, lucky: 4.5 };
const Hints = {
  done: {}, cur: null, queue: [], playT: 0,
  load(){ try { this.done = JSON.parse(localStorage.getItem('ryote_hints_done') || '{}'); } catch(e) { this.done = {}; } },
  save(){ try { localStorage.setItem('ryote_hints_done', JSON.stringify(this.done)); } catch(e) {} },
  reset(){ this.done = {}; this.cur = null; this.queue = []; this.playT = 0; this.save(); },
  // id のヒントを出す。target() は毎フレーム、指す場所 {x,y} を返す（null なら消す）
  trigger(id, target, urgent){
    if(this.done[id] || (this.cur && this.cur.id === id) || this.queue.some(q => q.id === id)) return;
    const h = { id, target, t: 0 };
    if(!this.cur) this.cur = h;
    else if(urgent){ this.queue.unshift(this.cur); this.cur = h; }
    else this.queue.push(h);
  },
  // その操作をしたら完了
  complete(id){
    if(this.done[id]) return;
    this.done[id] = true; this.save();
    if(this.cur && this.cur.id === id) this.next();
    this.queue = this.queue.filter(q => q.id !== id);
  },
  next(){ this.cur = this.queue.shift() || null; if(this.cur) this.cur.t = 0; },
  update(dt){
    if(TITLE.on || gameOver || buffSelect || inLevelClear) return;
    this.playT += dt;
    if(this.playT > .4) this.trigger('slide', () => null);
    if(this.playT > 9 && this.done.slide && luckySpot && luckySpot.active) this.trigger('lucky', () => luckySpot && luckySpot.active ? { x: luckySpot.x, y: luckySpot.y } : null);
    const h = this.cur; if(!h) return;
    h.t += dt;
    if(h.t > HINT_LIFE[h.id]){
      // 時間切れ：横で覚えたことにする（しつこく出さない）。操作の説明だけは続ける
      if(h.id !== 'slide'){ this.done[h.id] = true; this.save(); }
      this.next();
    }
  },
};
Hints.load();

// ---- 描画 ----
function hintLabel(x, y, txt, tx, ty){
  ctx.save();
  ctx.font = 'bold 14px ' + BODY_FONT;
  const w = ctx.measureText(txt).width + 22, h = 30;
  const bx = Math.max(6, Math.min(VW - w - 6, x - w/2)), by = Math.max(30, Math.min(GAME_H - h - 6, y - h/2));
  // 指す先への三角
  if(tx != null){
    const cx = Math.max(bx + 14, Math.min(bx + w - 14, tx)), below = ty > by + h;
    const ey = below ? by + h : by;
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(cx - 9, ey); ctx.lineTo(cx + 9, ey); ctx.lineTo(tx, ty + (below ? -6 : 6)); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#111'; roundRect(ctx, bx + 3, by + 4, w, h, 10, true, false);
  ctx.fillStyle = '#ffe14a'; roundRect(ctx, bx, by, w, h, 10, true, false);
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; roundRect(ctx, bx, by, w, h, 10, false, true);
  boldText(txt, bx + w/2, by + h/2 + 1, 14, '#111');
  ctx.restore();
}
// 上下になぞるヒント：白いタッチリング＋点線の道＋進行方向の矢印（動いている向きの矢印だけ脈打つ）
function hintArrow(x, y, dir, s, a){
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(s, s * dir);
  ctx.beginPath();
  [[0,-22],[24,2],[10,2],[10,22],[-10,22],[-10,2],[-24,2]].forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
  ctx.closePath(); ctx.fillStyle = '#ffe14a'; ctx.fill();
  ctx.lineWidth = 3 / s; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}
function drawSlideHint(cx, y, vy){
  ctx.save();
  // 点線の道
  const y0 = SLIDER_Y + 40, y1 = SLIDER_Y + SLIDER_H - 30;
  ctx.setLineDash([2, 10]); ctx.lineCap = 'round';
  ctx.strokeStyle = '#111'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, y1); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, y1); ctx.stroke();
  ctx.setLineDash([]);
  // 広がる輪
  const p = (animT * 1.6) % 1;
  ctx.save(); ctx.globalAlpha *= 1 - p; ctx.lineWidth = 7; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(cx, y, 22 + 20 * p, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(cx, y, 22, 0, Math.PI*2); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, y, 8, 0, Math.PI*2); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  // 進行方向の矢印だけ表示して脈打たせる（折り返し付近では薄くなる）
  const dir = vy < 0 ? 1 : -1, a = Math.min(1, Math.abs(vy) * 3), pulse = .72 + .12 * Math.sin(animT * 14);
  hintArrow(cx, y + dir * -46, dir, pulse, a);
  ctx.restore();
}
// タップで反転する版：ボタンの上で輪が広がり、いまバーが動いている向きの矢印が脈打つ
function drawTapHint(cx, y, vy){
  ctx.save();
  const p = (animT * 1.6) % 1;
  ctx.save(); ctx.globalAlpha *= 1 - p; ctx.lineWidth = 7; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(cx, y, 22 + 20 * p, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(cx, y, 22, 0, Math.PI*2); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, y, 8, 0, Math.PI*2); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  const dir = vy < 0 ? 1 : -1, pulse = .72 + .12 * Math.sin(animT * 14);
  hintArrow(cx + (cx < VW/2 ? 40 : -40), y, dir, pulse, 1);   // ボタンの文字に重ならないよう、輪の横に出す
  ctx.restore();
}
function drawHints(){
  const h = Hints.cur; if(!h || TITLE.on || gameOver || buffSelect || inLevelClear) return;
  const txt = HINT_TEXT[lang][h.id === 'slide' && CONTROL === 'auto' ? 'slideFlip' : h.id], fade = Math.min(1, h.t * 4), bob = Math.sin(animT * 6) * 3;
  ctx.save(); ctx.globalAlpha = fade;
  if(h.id === 'slide' && CONTROL === 'auto'){
    const cy = BTN_Y + BTN_H - 36;
    drawTapHint(leftBtnRect.x + leftBtnRect.w/2, cy, leftPaddle.vy);
    drawTapHint(rightBtnRect.x + rightBtnRect.w/2, cy, rightPaddle.vy);
    hintLabel(VW/2, GAME_H - 26 + bob, txt);
  } else if(h.id === 'slide'){
    const A = UI_H * .25, c = Math.cos(animT * 3);
    drawSlideHint(leftBtnRect.x + leftBtnRect.w/2, GAME_H + UI_H * .5 + Math.sin(animT * 3) * A, c);
    drawSlideHint(rightBtnRect.x + rightBtnRect.w/2, GAME_H + UI_H * .5 - Math.sin(animT * 3) * A, -c);
    hintLabel(VW/2, GAME_H - 26 + bob, txt);
  } else if(h.id === 'power'){
    const tx = skillBtnRect.x + skillBtnRect.w/2, ty = SP_Y - 4;
    hintLabel(tx, ty - 44 + bob, txt, tx, ty);
  } else {
    const p = h.target(); if(!p){ ctx.restore(); Hints.next(); return; }
    const above = p.y > 120;
    hintLabel(p.x, p.y + (above ? -52 : 52) + bob, txt, p.x, p.y + (above ? -10 : 10));
  }
  ctx.restore();
}
// キーでバーを動かしても「なぞる」ヒントは完了
window.addEventListener('keydown', e => {
  if(CONTROL === 'auto' ? ['ArrowLeft', 'ArrowRight'].includes(e.code) : ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(e.code)) Hints.complete('slide');
});
