"use strict";

const VW = 360, VH = 548;
const GAME_H = Math.round(VH * 0.6);
const UI_H = VH - GAME_H;
const WALL = 12;
const STAGE_THEME = [
    { bg:'#ffd23f', dot:'rgba(255,120,40,.5)',  ui:'#ff9a3d' },
    { bg:'#ffb54a', dot:'rgba(255,70,70,.42)',  ui:'#ff7a45' },
    { bg:'#b6e86a', dot:'rgba(40,160,80,.42)',  ui:'#4fc27a' },
    { bg:'#9cc8ff', dot:'rgba(60,100,255,.38)', ui:'#5b8cff' },
    { bg:'#ff9a9a', dot:'rgba(170,0,50,.38)',   ui:'#d04a6a' },
];
const FONT = 'Impact, "Arial Black", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif';
const CRIT_MULT = 3;   // 角ヒットのダメージ倍率
// ---- バランス調整値 ----
const MAX_BEANS = 5;          // 盤面の豆の同時上限（必殺技・Luckyの追加分はこの数まで）
const GAUGE_RATE = 0.35;      // 必殺技ゲージ獲得量の倍率（時間・ヒット・撃破・Lucky 全て）
const BUFF_POW_STEP = 0.5;    // 威力強化1回あたりの通常豆ダメージ増加量
const LUCKY_FULL_GAUGE = 12;  // Lucky取得時、豆が上限で小豆を足せないときの追加ゲージ（倍率前）
function fmtNum(n){ return Number.isInteger(n) ? String(n) : n.toFixed(1); }
// 強化の効果値
function critMult(){ return CRIT_MULT + 0.5 * buffs.crit; }
function maxBeans(){ return MAX_BEANS + buffs.beans; }
function gaugeRate(){ return GAUGE_RATE * (1 + 0.25 * buffs.gauge); }
function skillSmallCount(){ return 3 + buffs.skill; }
function luckySmallCount(){ return 1 + Math.floor(buffs.lucky / 2); }
function guardReflectMul(){ return 1 + 0.5 * buffs.guard; }
function guardPenaltyMul(){ return 1 - 0.3 * buffs.guard; }
// ---- 鬼の飛び道具（鬼火）----
const THROW_TELEGRAPH = 0.8;  // 予告の秒数
const PROJ_R = 11;            // 鬼火の半径
const MAX_PROJ = 2;           // 同時に飛ぶ鬼火の上限
const PARRY_POWER = 4;        // 受け止めて反射した鬼火の威力
const PARRY_GAUGE = 8;        // 受け止めたときのPowerゲージ回復（倍率なし）
const PROJ_PENALTY = 20;      // 受け止め損ねたときのPowerゲージ減少（倍率なし）
const PROJ_BACK_SPEED = 3.4;  // 反射後の速さ
let projectiles = [];
// 豆の残数表示・ロスト演出
let fallingBeans = [];                       // 落ちていくグレーの豆
let beanHud = { prev: 2, lostT: 0, gainT: 0 };
// 操作方式：'auto'=バーが自動で動き、タップで上下反転（index.html）
//           'slider'=バー固定、下のスライダーで上下に動かす（index.html が window.CONTROL='slider' を指定）
const CONTROL = window.CONTROL === 'slider' ? 'slider' : 'auto';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function now(){ return performance.now()/1000; }

let gameClearEffectPlayed = false;
let finalGameScreen = null;
let startTime = 0;
let endTime = 0;
let inLevelClear = false;

// 強化（ステージ間バフ）・コンボ
let buffSelect = null;       // {lock} 選択中のみオブジェクト
// 強化プール（クリア時に3つ抽選）。id: 最大スタック数
const BUFF_MAX = { bar:4, power:4, crit:3, beans:2, skill:2, gauge:3, lucky:3, guard:3 };
const BUFF_COLORS = { bar:'#2e86ff', power:'#ff3b3b', crit:'#ff9a1f', beans:'#35c46a', skill:'#ffe14a', gauge:'#8a4bff', lucky:'#ff6fb5', guard:'#3fc8c0' };
const REROLLS = 2;            // 強化の引き直し回数（1ゲーム）
const REROLL_RECT = { x: VW/2 - 70, y: GAME_H/2 + 34, w: 140, h: 38 };
function newBuffs(){ return { bar:0, power:0, crit:0, beans:0, skill:0, gauge:0, lucky:0, guard:0 }; }
let buffs = newBuffs();
let rerollsLeft = REROLLS;
const BUFF_LEN_STEP = 12, LUCKY_R_BASE = 13, LUCKY_R_STEP = 4, LUCKY_GAUGE_STEP = 8;
let combo = 0, comboTimer = 0;
let maxCombo = 0, parryCount = 0;   // クリア画面の戦績用
let hornHits = 0, beansLostCount = 0;   // 鬼のセリフの条件用（角ヒット数・落とした豆の数）
const COMBO_TIME = 2.5;
let comboFX = { scale:1 };
// 最終ステージ撃破演出用：スローモーション倍率と最後に倒した敵の位置
let timeScale = 1;
let animT = 0;        // 演出用の経過時間（スロー時は遅くなる）
let shakeT = 0;       // 画面揺れの残り時間
let popups = [];      // ダメージ・CRITICAL表示
let lastKill = { x: VW/2, y: GAME_H/2 };

// =================== Tweens (軽量化) ===================
const tweens = [];
function addTween(target, props, duration=0.6, opts={ease: t=>t, yoyo:false, repeat:0, onComplete:null}){
  const t = {target, props, duration, opts, elapsed:0};
  tweens.push(t);
  return t;
}
function updateTweens(dt){
  // 単純で高速な実行。yoyo/repeat を最小限サポート（-1 は無限）
  for(let i = tweens.length - 1; i >= 0; --i){
    const t = tweens[i];
    t.elapsed += dt;
    let p = t.elapsed / t.duration;
    if(p >= 1) p = 1;
    const ease = t.opts.ease || (x=>x);
    const v = ease(p);
    for(const k in t.props){
      const pr = t.props[k];
      t.target[k] = pr[0] + (pr[1] - pr[0]) * v;
    }
    if(t.elapsed >= t.duration){
      if(t.opts.yoyo){
        // swap
        for(const k in t.props){
          const pr = t.props[k];
          t.props[k] = [pr[1], pr[0]];
        }
      }
      if(t.opts.repeat === -1 || t.opts.repeat > 0){
        if(t.opts.repeat > 0) t.opts.repeat--;
        t.elapsed = 0;
      } else {
        if(t.opts.onComplete) try{ t.opts.onComplete(); }catch(e){}
        tweens.splice(i,1);
      }
    }
  }
}

function stopTweens(target) {
  for (let i = tweens.length - 1; i >= 0; --i) {
    if (tweens[i].target === target) tweens.splice(i,1);
  }
  // reset properties if present
  if (target && typeof target === 'object') {
    if ('scale' in target) target.scale = target.scale || 1;
    if ('alpha' in target) target.alpha = target.alpha || 1;
  }
}

// =================== Paddle ===================
const PADDLE_COLOR = '#2ea6ff';
let leftPaddle  = { x:18, y:(GAME_H-60)/2, length:60, thickness:12, vy:-2.3, side:'left' };
let rightPaddle = { x:VW-18-12, y:(GAME_H-60)/2, length:60, thickness:12, vy:-2.3, side:'right' };
let paddleHitFx = [];   // バーで弾いた瞬間の衝撃線
let bumpFx = [];        // 壁・豆同士の小さな当たり（バーより控えめ）
// (nx, ny) は当たった面から外向きの向き。spread だけ左右に傾けた2本の線を出す
function addBump(x, y, nx, ny, spread){ if(bumpFx.length < 24) bumpFx.push({ x, y, nx, ny, spread, t: 0 }); }
// バーの震え（bend＞0 で外側へわずかにふくらむ）。ばねで素早く戻す
function updatePaddleBend(p, dt){
  if(!p.bend && !p.bendV) return;
  const a = -5500 * (p.bend || 0) - 40 * (p.bendV || 0);   // 硬めのばね：速く小さく震えてすぐ止まる
  p.bendV = (p.bendV || 0) + a * dt; p.bend = Math.max(-3, Math.min(3, (p.bend || 0) + p.bendV * dt));
  if(Math.abs(p.bend) < .05 && Math.abs(p.bendV) < .5){ p.bend = 0; p.bendV = 0; }
}
// 豆のつぶれ具合（当たった直後に横につぶれて、ぷるんと戻る）
function beanSquash(b){
  if(b.sqT == null) return 0;
  const k = Math.exp(-b.sqT * 16) * Math.cos(b.sqT * 38) * .32;
  return Math.abs(k) < .01 && b.sqT > .1 ? 0 : k;
}
// スライダー操作用：バーの目標位置。バーはこの位置へ素早く追従する
function initControl(){
  for(const p of [leftPaddle, rightPaddle]){
    p.target = p.y;
    if(CONTROL === 'slider') p.vy = 0;
  }
}
initControl();

// =================== Balls / Lucky spot / Particles / Spawn marker / specialGauge ===================
let balls = [];
let luckySpot = null;
let particles = [];
let minSpeed = 1.3;
let luckycount = 0;
let specialcount = 0;

let luckyFX = { active:false, x:0, y:0, alpha:1, scale:0.5 };
let spawnMarker = { x: VW / 2, y: 0, w:24, h:24, scale:1, alpha:1 };
let specialGauge = 0;     // 0〜100
let specialReady = false;
let specialReadyAt = 0;

// particle cap for performance
const MAX_PARTICLES = 300;

// Spawn marker animation
function playSpawnMarkerAnimation() {
    spawnMarker.scale = 1;
    spawnMarker.alpha = 1;
    addTween(spawnMarker, { scale:[1,1.4], alpha:[1,0.4] }, 0.15, {
      ease: t => t,
      onComplete(){
        addTween(spawnMarker, { scale:[1.4,1], alpha:[0.4,1] }, 0.25, { ease: t => 1 - Math.pow(1 - t, 3) });
      }
    });
}

function addGaugeRaw(v){
    specialGauge = Math.max(0, specialGauge + v);
    if (specialGauge >= 100){
        specialGauge = 100;
        if (!specialReady){
            specialReady = true;
            Hints.trigger('power', () => null);
            playSpecialReadyEffect();
            SFX.play('ready');
        }
    } else if (specialReady){
        specialReady = false;
        stopSpecialReadyEffect();
    }
}
function addGauge(v){ addGaugeRaw(v * gaugeRate()); }

// ゲージの時間上昇（軽量化：setInterval を継続使用して OK）
setInterval(updateSpecialGauge, 200);
function updateSpecialGauge(){
    if(typeof TITLE === 'undefined' || TITLE.on) return;
    if(gameOver || outPhase || buffSelect || inLevelClear) return;   // リザルト・クリア・強化選択中はゲージを増やさない
    let rate = 0.2;
    let normalBallCount = countNormalBalls();
    const n = balls.length;
    if (normalBallCount <= 0) rate *= 15.0;
    else if (n <= 1) rate *= 12.0;   // 残り1個：スピードが遅くて手が止まりがちなので、以前（×9）より増し
    else if (n <= 3) rate *= 5.0;
    else if (n <= 5) rate *= 3.5;
    else if (n <= 7) rate *= 2.0;
    else rate *= 1.5;
    addGauge(rate);
}

// =================== Enemies + Level ===================
let enemies = [];
let killCount = 0;
// 敵の編成（シミュレーションで調整：序盤は短すぎず、L5のボス戦が一番長い山場になるように）
const LEVEL_DATA = [
  { e:['chibi','chibi','chibi'] },
  { e:['chibi','chibi','hito','hito'] },
  { e:['chibi','hito','tora'] },
  { e:['hito','hyoro','taiko'] },
  { e:['chibi','hito','hannya','kan','boss'] } ];
let currentLevel = 0;
let levelUpFX = { active:false, alpha:0, scale:1 };
let gauge = 0;
const GAUGE_MAX = 3;
let gameOver = false;
let levelup = false;
let stageClearFX = { active:false, alpha:0, scale:1 };

// =================== Spawn Helpers ===================
let usedBall = 0;
function spawnBall(x,y,vx,vy,r=12,power=2){
  usedBall++;
  playSpawnMarkerAnimation();
  balls.push({ x,y,vx,vy,r,power,scale:1 });
}

function spawnInitialBalls(n=2){
  for(let i=0;i<n;i++){
    const vx=(Math.random()*2-1)*0.9;
    const vy=(Math.random()*2-1)*0.9;
    spawnBall(VW/2, 10, vx, vy, 14, 2);
  }
  updateLuckySpot();
}
spawnInitialBalls();

function createLucky(){
  const spot = { x: 80 + Math.random()*(VW-160), y: 50 + Math.random()*(GAME_H-100), r:LUCKY_R_BASE + buffs.lucky*LUCKY_R_STEP, scale:1, active:true };
  addTween(spot, { scale:[1,1.15] }, 0.9, {ease:t=>0.5*(1-Math.cos(Math.PI*t)), yoyo:true, repeat:-1});
  luckySpot = spot;
}
createLucky();

// =================== Particles (軽量化) ===================
function spawnParticles(x, y, color, amount = 30, type='enemy') {
    for (let i = 0; i < amount; i++) {
        if (particles.length >= MAX_PARTICLES) break;
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 0.4 + Math.random()*0.6,
            t: 0,
            color,
            type
        });
    }
}

// =================== Enemy System ===================
function spawnEnemyType(key){
  const d = ONI_DATA[key], bd = ENEMY_BD;
  const e = {
    k:key,
    x: bd.x0 + 20 + Math.random()*(bd.x1 - bd.x0 - 40),
    y: bd.y0 + 20 + Math.random()*(bd.y1 - bd.y0 - 40),
    r:d.r, hp:d.hp, maxHp:d.hp, iFrame:0, alive:true, flashT:0, flashHorn:null,
    atkT: d.atk ? d.atk.every * (0.5 + Math.random()*0.4) : 0,
  };
  mvInit(e, d, bd);
  e.px = e.x; e.py = e.y;
  enemies.push(e);
}

function updateEnemy(e,dt){
  if (e.iFrame > 0) {
    e.iFrame -= dt;
    if (e.iFrame < 0) e.iFrame = 0;
  }
  if (e.flashT > 0) e.flashT -= dt;
  const d = ONI_DATA[e.k];
  mvStep(e, d, ENEMY_BD, dt);
  if (d.atk){
    e.atkT -= dt;
    if (e.atkT <= 0){
      if (projectiles.length < MAX_PROJ) startThrow(e, d);
      e.atkT = d.atk.every * (0.85 + Math.random()*0.3);
    }
  }
}

// =================== 鬼の飛び道具（鬼火）===================
// 予告線 → 発射 → バーで受け止めると反射して鬼に当たる。受け止め損ねるとPowerゲージが減る。
function startThrow(e, d){
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const pd = side === 'left' ? leftPaddle : rightPaddle;
  const ty = Math.max(WALL + 12, Math.min(GAME_H - WALL - 12, pd.y + pd.length/2 + (Math.random() - 0.5) * 50));
  SFX.play('tele', side);
  projectiles.push({ state:'tele', src:e, x:e.px, y:e.py, tx: pd.x + pd.thickness/2, ty, t:0, side, speed:d.atk.speed, vx:0, vy:0, power:0 });
  const pj = projectiles[projectiles.length - 1];   // 初めての鬼火は、着弾点を指して教える
  Hints.trigger('oni', () => !projectiles.includes(pj) || pj.state === 'back' ? null : pj.state === 'tele' ? { x: pj.tx + (pj.side === 'left' ? 20 : -20), y: pj.ty } : { x: pj.x, y: pj.y }, true);
}

function hitEnemyWithProjectile(b){
  for(const e of enemies){
    const d = ONI_DATA[e.k];
    for(const h of d.horns){
      const tip = hornTip(d, h), tx = e.px + tip.x, ty = e.py + tip.y;
      const dx = b.x - tx, dy = b.y - ty, minD = b.r * .5 + d.r * HORN_HR;
      if(dx*dx + dy*dy <= minD*minD){ e.iFrame = 0; hitEnemy(b, e, h, tx, ty); return true; }
    }
    const dx = b.x - e.px, dy = b.y - e.py, minD = b.r + e.r;
    if(dx*dx + dy*dy <= minD*minD){ e.iFrame = 0; hitEnemy(b, e); return true; }
  }
  return false;
}

function parryProjectile(p){
  const tgt = enemies.includes(p.src) ? p.src : enemies[0];
  if(!tgt){ p.dead = true; return; }
  const dx = tgt.px - p.x, dy = tgt.py - p.y, dist = Math.hypot(dx, dy) || 1;
  p.state = 'back'; p.t = 0; p.src = tgt;
  p.vx = dx/dist * PROJ_BACK_SPEED; p.vy = dy/dist * PROJ_BACK_SPEED;
  p.power = PARRY_POWER * guardReflectMul();
  parryCount++;
  Hints.complete('oni');
  sendPowerOrbs(p.x, p.y, 7);   // パリィでPowerが増えることを、光の粒がボタンへ飛んでいく演出で見せる
  SFX.play('parry');
  addGaugeRaw(PARRY_GAUGE);
  addPopup(p.x, p.y - 12, t('parry'), 'big');
  spawnParticles(p.x, p.y, 'gold', 14);
}

function missProjectile(p){
  const pen = Math.round(PROJ_PENALTY * guardPenaltyMul());
  SFX.play('burn');
  addGaugeRaw(-pen);
  addPopup(p.side === 'left' ? 110 : VW - 110, p.y, t('penaltyFmt')(pen), 'big');
  shakeT = Math.max(shakeT, 0.15);
  p.dead = true;
}

let oniEmbers = [];   // 鬼火から散る火の粉
// Powerボタンへ飛んでいく光の粒（パリィのご褒美）
let powerOrbs = [];
function sendPowerOrbs(x, y, n){
  for(let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2;
    powerOrbs.push({ sx: x, sy: y, ox: Math.cos(a) * (18 + Math.random() * 16), oy: Math.sin(a) * (18 + Math.random() * 16), t: -i * .035, dur: .5 + Math.random() * .12, first: i === 0 });
  }
  addPopup(x, y + 16, '+Power', 'small');
}
function updatePowerOrbs(dt){
  for(let i = powerOrbs.length - 1; i >= 0; --i){
    const o = powerOrbs[i]; o.t += dt;
    if(o.t >= o.dur){
      if(o.first && !specialReady){ specialButton.scale = 1.1; addTween(specialButton, { scale:[1.1, 1] }, .25, { ease: t => 1 - Math.pow(1 - t, 3) }); }
      powerOrbs.splice(i, 1);
    }
  }
}
function drawPowerOrbs(){
  const tx = skillBtnRect.x + skillBtnRect.w/2, ty = SP_Y + SP_H * .45;
  for(const o of powerOrbs){
    if(o.t < 0) continue;
    const k = Math.min(1, o.t / o.dur), e = k * k * (3 - 2 * k);
    // いったん外へふわっと広がってから、ボタンへ吸い込まれる
    const spread = Math.sin(Math.min(1, k * 2.2) * Math.PI) * (1 - k);
    const x = o.sx + (tx - o.sx) * e + o.ox * spread, y = o.sy + (ty - o.sy) * e + o.oy * spread;
    const r = 4.5 * (1 - k * .4);
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, 'rgba(255,225,74,.85)'); g.addColorStop(1, 'rgba(255,225,74,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}
// =================== 豆の大きさが変わる（成長・縮み・焦げ）===================
// 小豆がLuckyに触れる→ボンッと普通の豆に。普通の豆が鬼火に当たる→ボンッと縮んで焦げる。小豆が鬼火に当たる→少し焦げるだけ。
const SMALL_R = 6, NORMAL_R = 14;
function growBall(b){
  b.power = 2; b.r = NORMAL_R; b.morph = { t: 0, s0: SMALL_R / NORMAL_R };
  beanFx.push({ type:'grow', x:b.x, y:b.y, t:0, life:.5 });
}
function shrinkBall(b){
  b.power = 1; b.r = SMALL_R; b.morph = { t: 0, s0: NORMAL_R / SMALL_R }; b.scorch = { t: 0, k: 1 };
  beanFx.push({ type:'burst', x:b.x, y:b.y, t:0, life:.25 });
  for(let i = 0; i < 5; i++) beanFx.push({ type:'smoke', x:b.x + (i - 2) * 6, y:b.y, t:-i * .06, life:.7, r:6 });
  SFX.play('scorch');
  updateLuckySpot();
}
function scorchBall(b){
  b.scorch = { t: 0, k: .5 };
  for(let i = 0; i < 2; i++) beanFx.push({ type:'smoke', x:b.x + (i - .5) * 6, y:b.y, t:-i * .08, life:.5, r:4.5 });
  SFX.play('scorchSoft');
}
function updateBeanMorph(b, dt){
  if(b.morph){
    b.morph.t += dt;
    if(b.morph.t >= .5){ b.morph = null; b.scale = 1; }
    else b.scale = 1 + (b.morph.s0 - 1) * Math.exp(-b.morph.t * 14) * Math.cos(b.morph.t * 30);
  }
  if(b.scorch){ b.scorch.t += dt; if(b.scorch.t > .6) b.scorch = null; }
}
function updateBeanFx(dt){
  for(let i = beanFx.length - 1; i >= 0; --i){ beanFx[i].t += dt; if(beanFx[i].t >= beanFx[i].life) beanFx.splice(i, 1); }
}
function drawBeanFx(){
  for(const f of beanFx){
    const k = f.t / f.life; if(k < 0) continue;
    ctx.save();
    if(f.type === 'grow'){
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for(let i = 0; i < 10; i++){ const a = i * Math.PI / 5, d0 = 14 + 20*k, d1 = 26 + 40*k; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a)*d0, f.y + Math.sin(a)*d0); ctx.lineTo(f.x + Math.cos(a)*d1, f.y + Math.sin(a)*d1); ctx.stroke(); }
      ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(f.x, f.y, 14 + 40*k, 0, Math.PI*2); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    } else if(f.type === 'burst'){
      ctx.translate(f.x, f.y); ctx.beginPath();
      for(let i = 0; i < 18; i++){ const a = k * 2 + i * Math.PI / 9, r = (i % 2 ? .55 : 1) * (26 * (1 - k) + 6); i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
      ctx.closePath(); ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
    } else if(f.type === 'smoke'){
      ctx.globalAlpha = .6 * (1 - k); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(f.x, f.y - k*34, f.r + k*7, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke();
    }
    ctx.restore();
  }
}
function updateProjectiles(dt){
  const f = dt * 60;
  for(let i = oniEmbers.length - 1; i >= 0; --i){ const e = oniEmbers[i]; e.t += dt; e.x += e.vx * f; e.y += e.vy * f; e.vy -= .02 * f; if(e.t > e.life) oniEmbers.splice(i, 1); }
  for(let i = projectiles.length - 1; i >= 0; --i){
    const p = projectiles[i];
    p.t += dt;
    if(p.state === 'tele'){
      if(!enemies.includes(p.src)){ p.dead = true; }
      else {
        p.x = p.src.px; p.y = p.src.py;
        if(p.t >= THROW_TELEGRAPH){
          const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy) || 1;
          p.vx = dx/dist * p.speed; p.vy = dy/dist * p.speed; p.state = 'fly'; p.t = 0; p.d0 = dist; p.trail = [];
          SFX.play('launch', p.side);
        }
      }
    } else if(p.state === 'fly'){
      p.x += p.vx * f; p.y += p.vy * f;
      // 軌跡と火の粉（迫ってくるのが分かるように）
      (p.trail ||= []).push({ x: p.x, y: p.y }); if(p.trail.length > 16) p.trail.shift();
      if(oniEmbers.length < 80 && Math.random() < .7) oniEmbers.push({ x: p.x + (Math.random()-.5)*10, y: p.y + (Math.random()-.5)*10, vx: -p.vx*.15 + (Math.random()-.5)*.6, vy: -p.vy*.15 + (Math.random()-.5)*.6, t: 0, life: .35 + Math.random()*.3, back: false });
      for(const pd of [leftPaddle, rightPaddle]){
        if((pd.side === 'left' ? p.vx < 0 : p.vx > 0) && rectCircle(p.x, p.y, PROJ_R, pd.x, pd.y, pd.thickness, pd.length)){ parryProjectile(p); break; }
      }
      // 豆に当たる：普通の豆は縮んで焦げ、小豆は少し焦げるだけ（鬼火はそのまま飛び続ける）
      if(p.state === 'fly'){
        const tc = p.touched || (p.touched = new Set());
        for(const b of balls){
          if(tc.has(b)) continue;
          const dx = b.x - p.x, dy = b.y - p.y, rr = b.r + PROJ_R * .8;
          if(dx*dx + dy*dy <= rr*rr){ tc.add(b); if(b.power === 1) scorchBall(b); else shrinkBall(b); }
        }
      }
      if(p.state === 'fly'){
        if(p.vx < 0 && p.x < leftPaddle.x - 4) { p.side = 'left'; missProjectile(p); }
        else if(p.vx > 0 && p.x > rightPaddle.x + rightPaddle.thickness + 4) { p.side = 'right'; missProjectile(p); }
      }
    } else {
      const tgt = enemies.includes(p.src) ? p.src : enemies[0];
      if(!tgt){ p.dead = true; }
      else {
        const dx = tgt.px - p.x, dy = tgt.py - p.y, dist = Math.hypot(dx, dy) || 1;
        p.vx += (dx/dist * PROJ_BACK_SPEED - p.vx) * 0.15 * f; p.vy += (dy/dist * PROJ_BACK_SPEED - p.vy) * 0.15 * f;
        p.x += p.vx * f; p.y += p.vy * f;
        (p.trail ||= []).push({ x: p.x, y: p.y }); if(p.trail.length > 12) p.trail.shift();
        if(oniEmbers.length < 80 && Math.random() < .5) oniEmbers.push({ x: p.x, y: p.y, vx: (Math.random()-.5)*.8, vy: (Math.random()-.5)*.8, t: 0, life: .3 + Math.random()*.25, back: true });
        if(hitEnemyWithProjectile({ x:p.x, y:p.y, r:PROJ_R, power:p.power })){ spawnParticles(p.x, p.y, 'gold', 12); p.dead = true; }
        else if(p.x < -30 || p.x > VW + 30 || p.y < -30 || p.y > GAME_H + 30) p.dead = true;
      }
    }
    if(p.dead) projectiles.splice(i, 1);
  }
}

function drawFireball(x, y, r, vx, vy, col, inner, tt){
  ctx.save();
  const sp = Math.hypot(vx, vy) || 1, ux = vx/sp, uy = vy/sp;
  for(let k = 3; k >= 1; k--){
    ctx.fillStyle = col; ctx.globalAlpha = 0.55 - k*0.12;
    ctx.beginPath(); ctx.arc(x - ux*k*7, y - uy*k*7 + Math.sin(tt*14 + k)*1.5, r*(1 - k*0.18), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(x - r*.15, y - r*.15, r*.5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawProjectiles(){
  for(const p of projectiles){
    if(p.state === 'tele'){
      const k = p.t / THROW_TELEGRAPH, pulse = 0.5 + 0.5 * Math.sin(p.t * 22);
      // 鬼のまわりの光る輪
      ctx.save();
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 3; ctx.globalAlpha = 0.4 + 0.4*pulse;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.src.r * (1.3 + 0.25*pulse), 0, Math.PI*2); ctx.stroke();
      // 予告線と着弾点の「!」
      ctx.globalAlpha = 0.35 + 0.4*k; ctx.setLineDash([6, 6]); ctx.lineWidth = 2.5;
      const mx = p.tx + (p.side === 'left' ? 20 : -20);   // バーに隠れないよう少し内側に表示
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mx, p.ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(mx, p.ty, 11 + 3*pulse, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.stroke();
      popText('!', mx, p.ty + 1, 18, '#fff', 'center', 4);
      ctx.restore();
    } else if(p.state === 'fly'){
      // 着弾点：赤い輪が鬼火の接近に合わせて縮んでいく
      const mx = p.tx + (p.side === 'left' ? 20 : -20), left = Math.hypot(p.tx - p.x, p.ty - p.y) / (p.d0 || 1);
      ctx.save();
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 3; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.arc(mx, p.ty, 10 + 26 * Math.max(0, left), 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = .55; ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(mx, p.ty, 9, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      drawOniTrail(p, ['rgba(122,92,255,', 'rgba(205,190,255,'], 1.25);
      drawFireballGlow(p.x, p.y, 'rgba(150,120,255,');
      drawFireball(p.x, p.y, PROJ_R, p.vx, p.vy, '#7a5cff', '#d9ccff', animT);
    } else {
      drawOniTrail(p, ['rgba(255,140,30,', 'rgba(255,230,140,'], 1);
      drawFireballGlow(p.x, p.y, 'rgba(255,170,60,');
      drawFireball(p.x, p.y, PROJ_R, p.vx, p.vy, '#ff9a1f', '#fff1a0', animT);
    }
  }
  // 火の粉
  for(const e of oniEmbers){
    const k = 1 - e.t / e.life;
    ctx.fillStyle = e.back ? 'rgba(255,190,70,' + k + ')' : 'rgba(170,140,255,' + k + ')';
    ctx.beginPath(); ctx.arc(e.x, e.y, 1.5 + 2.5 * k, 0, Math.PI*2); ctx.fill();
  }
}
// 鬼火の尾：通ってきた道に、ゆらめく炎のオーラを残す（古いほど細く薄く）
function drawOniTrail(p, cols, w){
  const tr = p.trail; if(!tr || tr.length < 2) return;
  ctx.save();
  for(let i = 0; i < tr.length; i++){
    const k = (i + 1) / tr.length, wob = Math.sin(animT * 18 + i * 1.3) * 2 * (1 - k);
    ctx.fillStyle = cols[0] + (.08 + .32 * k) + ')';
    ctx.beginPath(); ctx.arc(tr[i].x + wob, tr[i].y - wob * .6, PROJ_R * w * (.35 + .75 * k), 0, Math.PI*2); ctx.fill();
  }
  for(let i = Math.floor(tr.length / 2); i < tr.length; i++){
    const k = (i + 1) / tr.length;
    ctx.fillStyle = cols[1] + (.25 * k) + ')';
    ctx.beginPath(); ctx.arc(tr[i].x, tr[i].y, PROJ_R * w * .4 * k, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
// 鬼火のまわりのぼんやりした光（ゆっくり脈打つ）
function drawFireballGlow(x, y, col){
  const r = PROJ_R * (2.3 + .25 * Math.sin(animT * 12));
  const g = ctx.createRadialGradient(x, y, PROJ_R * .6, x, y, r);
  g.addColorStop(0, col + '.45)'); g.addColorStop(1, col + '0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
}

function addPopup(x, y, txt, kind){
  popups.push({ x, y, txt, kind, t:0, life: kind === 'small' ? 0.6 : 1.0 });
}

// horn: 角に当たった場合はその角オブジェクト（弱点：ダメージ×CRIT_MULT）、体なら未指定
function hitEnemy(ball, enemy, horn, hx, hy){
  if (enemy.iFrame > 0) return;
  const crit = !!horn;
  if(crit) Hints.complete('horn');
  else if(!Hints.done.horn){   // 体に当たったら、その鬼の角を指して教える
    const d = ONI_DATA[enemy.k], hh = d.horns[0];
    Hints.trigger('horn', () => { if(!enemies.includes(enemy)) return null; const tp = hornTip(d, hh); return { x: enemy.px + tp.x, y: enemy.py + tp.y }; });
  }
  const base = (ball.power || 2) + ((ball.power || 2) >= 2 ? buffs.power * BUFF_POW_STEP : 0);
  const dmg = crit ? base * critMult() : base;
  enemy.hp -= dmg;
  combo += crit ? 2 : 1; comboTimer = COMBO_TIME;
  if(combo > maxCombo) maxCombo = combo;
  comboFX.scale = 1.4; addTween(comboFX, { scale:[1.4,1] }, 0.2, { ease: t => 1 - Math.pow(1 - t, 3) });
  const comboMul = 1 + Math.min(combo - 1, 10) * 0.1;
  addGauge((crit ? 16.0 : 8.0) * comboMul);
  enemy.iFrame = 0.5;
  if (crit){
    hornHits++;
    enemy.flashHorn = horn; enemy.flashT = 0.3;
    shakeT = 0.25;
    addPopup(hx, hy - 14, t('critical'), 'crit');
    addPopup(hx + 24, hy + 18, '-' + fmtNum(dmg), 'big');
  } else {
    addPopup(enemy.px, enemy.py - enemy.r - 6, '-' + fmtNum(dmg), 'small');
  }
  SFX.play(crit ? 'crit' : 'hit');
  SFX.play('combo', combo);
  if(enemy.hp <= 0){
    SFX.play('kill');
    enemy.alive=false;
    spawnParticles(enemy.px, enemy.py, 'red', 18, 'enemy');
    enemies.splice(enemies.indexOf(enemy),1);
    killCount++;
    lastKill = { x: enemy.px, y: enemy.py };
    if(enemies.length === 0) spawnBigBurst(enemy.px, enemy.py);
    addGauge(18.0 * comboMul);
  }
}

function checkEnemyCollision(ball){
  for(const e of enemies){
    if(!e.alive) continue;
    const d = ONI_DATA[e.k];
    // 角（弱点）：先端の円との当たり判定を体より先に見る
    if(e.iFrame <= 0){
      for(const h of d.horns){
        const tip = hornTip(d, h), tx = e.px + tip.x, ty = e.py + tip.y;
        const dx = ball.x - tx, dy = ball.y - ty, minD = ball.r * .5 + d.r * HORN_HR;
        if(dx*dx + dy*dy <= minD*minD){
          const dist = Math.sqrt(dx*dx + dy*dy) || 1, nx = dx/dist, ny = dy/dist;
          ball.x = tx + nx*minD; ball.y = ty + ny*minD;
          const vn = ball.vx*nx + ball.vy*ny;
          if(vn < 0){ ball.vx -= 2*vn*nx; ball.vy -= 2*vn*ny; }
          hitEnemy(ball, e, h, tx, ty);
          return true;
        }
      }
    }
    const dx=ball.x-e.px, dy=ball.y-e.py;
    const dist2 = dx*dx + dy*dy;
    const minD = (ball.r + e.r);
    if(dist2 <= minD*minD){
      resolveEnemyPushOut(ball, e);
      // 体に当たったら、当たった面で正しく反射させる（以前は真逆に返していたため、縦向きの豆が鬼と壁の間を往復し続けていた）
      const dd = Math.sqrt(dist2) || 1, nx = dx/dd, ny = dy/dd, vn = ball.vx*nx + ball.vy*ny;
      if(vn < 0){ ball.vx -= 2*vn*nx; ball.vy -= 2*vn*ny; }
      ball.vx *= 0.9; ball.vy *= 0.9;
      if (e.iFrame > 0) return true;
      hitEnemy(ball, e);
      return true;
    }
  }
  return false;
}

function resolveEnemyPushOut(ball, enemy){
    const dx = ball.x - enemy.px;
    const dy = ball.y - enemy.py;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const minDist = ball.r + enemy.r;
    if (dist === 0) return;
    if (dist < minDist) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
    }
}

// =================== Player input ===================
const colW = VW/3;
const leftBtnRect  = {x:0, y:GAME_H, w:colW, h:UI_H};
const skillBtnRect = {x:colW, y:GAME_H, w:colW, h:UI_H};
const rightBtnRect = {x:colW*2, y:GAME_H, w:colW, h:UI_H};
const langBtnRect = { x: VW-66, y:4, w:58, h:20 };
const sfxBtnRect = { x: VW-98, y:4, w:28, h:20 };

function mapClient(px,py){
  const r = canvas.getBoundingClientRect();
  const sx = VW / r.width;
  const sy = VH / r.height;
  return { x:(px-r.left)*sx, y:(py-r.top)*sy };
}

canvas.addEventListener('mousedown', e=>{
  const p = mapClient(e.clientX, e.clientY);
  // タイトルの「サウンド／ミュート」2択：どちらを押してもいまと逆に切り替える
  if(typeof TITLE !== 'undefined' && TITLE.on && inTitleSound(p)){ toggleTitleSound(); return; }
  if(p.x>=sfxBtnRect.x && p.x<=sfxBtnRect.x+sfxBtnRect.w && p.y>=sfxBtnRect.y && p.y<=sfxBtnRect.y+sfxBtnRect.h){
    SFX.toggle();
    return;
  }
  if(p.x>=langBtnRect.x && p.x<=langBtnRect.x+langBtnRect.w && p.y>=langBtnRect.y && p.y<=langBtnRect.y+langBtnRect.h){
    setLang(lang === 'ja' ? 'en' : 'ja');
    SFX.play('ui');
    return;
  }
  if(buffSelect && p.x >= REROLL_RECT.x && p.x <= REROLL_RECT.x + REROLL_RECT.w && p.y >= REROLL_RECT.y && p.y <= REROLL_RECT.y + REROLL_RECT.h){
    rerollBuffs();
    return;
  }
  if(p.y < GAME_H) return;
  if(buffSelect){
    pickBuff(p.x < colW ? 0 : p.x < colW*2 ? 1 : 2);
    return;
  }
  if(CONTROL === 'slider') return;
  if(p.x < colW){
    leftPaddle.vy *= -1; Hints.complete('slide');
  } else if(p.x < colW*2){
    useSkill();
  } else {
    rightPaddle.vy *= -1; Hints.complete('slide');
  }
});
canvas.addEventListener('mousedown', e => {
    if(gameOver){
        const p = mapClient(e.clientX, e.clientY);
        if(gameClearEffectPlayed){ if(inBtn(p, BTN_TITLE_ONE)) backToTitle(); }
        else if(balls.length === 0){
          if(inBtn(p, BTN_CONT)) continueGame();
          else if(inBtn(p, BTN_TITLE_SMALL)) backToTitle();
        }
    }
});

// =================== Keyboard input ===================
// auto  : ← 左反転、→ 右反転、Enter/↑ 必殺技
// slider: W/S 左バー上下、↑/↓ 右バー上下、Enter/Space 必殺技
// キー状態は物理キー(e.code)だけで管理する（IME等でe.keyが変わっても同じキーとして扱える）
const keyState = {};          // code -> { down, t }
let keyRepeatSeen = false;    // 長押しの自動リピートを一度でも観測したか
const KEY_STALE_MS = 1300;    // 自動リピートが止まったまま押下扱いが続いたら離したとみなす（keyup取りこぼし対策）
const KEY_OPPOSITE = { KeyW:'KeyS', KeyS:'KeyW', ArrowUp:'ArrowDown', ArrowDown:'ArrowUp' };
function keyIs(e, ...names){ return names.includes(e.key) || names.includes(e.code); }
function setKey(e, v){
  const c = e.code || ('key:' + (e.key || '').toLowerCase());
  const st = keyState[c] || (keyState[c] = { down:false, t:0 });
  st.down = v; st.t = performance.now();
  if(v && e.repeat) keyRepeatSeen = true;
  // 反対方向のキーを押したら、前のキーは離したものとみなす（keyupが届かず固まるのを防ぐ）
  if(v && !e.repeat && KEY_OPPOSITE[c] && keyState[KEY_OPPOSITE[c]]) keyState[KEY_OPPOSITE[c]].down = false;
}
function isHeld(code){
  const st = keyState[code];
  if(!st || !st.down) return false;
  if(keyRepeatSeen && performance.now() - st.t > KEY_STALE_MS){ st.down = false; return false; }
  return true;
}
function clearKeys(){ for(const k in keyState) keyState[k].down = false; for(const id in sliderPointers) delete sliderPointers[id]; }
window.addEventListener('keyup', e => { setKey(e, false); });
window.addEventListener('blur', clearKeys);
document.addEventListener('visibilitychange', () => { if(document.hidden) clearKeys(); });
window.addEventListener('keydown', e => {
  setKey(e, true);
  if(e.repeat) return;
  if(keyIs(e, 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'NumpadEnter', ' ', 'Space')) e.preventDefault();
  const enter = keyIs(e, 'Enter', 'NumpadEnter', ' ', 'Space');
  if(gameOver){
    const retryKey = enter || (CONTROL === 'auto' && keyIs(e, 'ArrowUp'));
    // Enter：ゲームオーバーなら「つづきから」、クリア後なら「はじめから」
    if(retryKey && gameClearEffectPlayed) backToTitle();
    else if(retryKey && balls.length === 0) continueGame();
    return;
  }
  if(buffSelect){
    if(keyIs(e, 'ArrowLeft', '1', 'Digit1', 'Numpad1')) pickBuff(0);
    else if(enter || keyIs(e, 'ArrowUp', '2', 'Digit2', 'Numpad2')) pickBuff(1);
    else if(keyIs(e, 'ArrowRight', '3', 'Digit3', 'Numpad3')) pickBuff(2);
    else if(keyIs(e, 'KeyR', 'r', 'R')) rerollBuffs();
    return;
  }
  if(CONTROL === 'slider'){
    if(enter) useSkill();
    return;
  }
  if(keyIs(e, 'ArrowLeft')){
    leftPaddle.vy *= -1;
  } else if(keyIs(e, 'ArrowRight')){
    rightPaddle.vy *= -1;
  } else if(enter || keyIs(e, 'ArrowUp')){
    useSkill();
  }
});

// =================== Slider input (CONTROL === 'slider') ===================
const SLIDER_Y = GAME_H + 18, SLIDER_H = VH - GAME_H - 32, SLIDER_KNOB_H = 48;
const KEY_PADDLE_SPEED = 5.5;      // キー操作時のバー速度（px/フレーム@60fps）
const PADDLE_FOLLOW_SPEED = 18;    // 目標位置への追従速度（px/フレーム@60fps）
const sliderPointers = {};         // pointerId -> 'left' | 'right'（両手同時操作用）

function paddleRange(p){ return GAME_H - WALL - p.length - WALL; }
function setSliderFromY(side, y){
  const p = side === 'left' ? leftPaddle : rightPaddle;
  const frac = Math.max(0, Math.min(1, (y - SLIDER_Y - SLIDER_KNOB_H/2) / (SLIDER_H - SLIDER_KNOB_H)));
  p.target = WALL + frac * paddleRange(p);
}
function updateSliderPaddle(p, dt){
  const f = dt * 60;
  const dir = p.side === 'left' ? (isHeld('KeyS')?1:0) - (isHeld('KeyW')?1:0)
                                : (isHeld('ArrowDown')?1:0) - (isHeld('ArrowUp')?1:0);
  if(dir) p.target += dir * KEY_PADDLE_SPEED * f;
  p.target = Math.max(WALL, Math.min(GAME_H - WALL - p.length, p.target));
  const diff = p.target - p.y, step = PADDLE_FOLLOW_SPEED * f;
  p.y += Math.max(-step, Math.min(step, diff));
  p.vy = 0;
}
if(CONTROL === 'slider'){
  canvas.addEventListener('pointerdown', e => {
    if(gameOver || buffSelect) return;
    const p = mapClient(e.clientX, e.clientY);
    if(p.y < GAME_H) return;
    if(p.x >= colW && p.x < colW*2){ useSkill(); return; }
    const side = p.x < colW ? 'left' : 'right';
    sliderPointers[e.pointerId] = side;
    Hints.complete('slide');
    window.focus();   // 埋め込み表示でもキー入力がこのページに届くように
    if(canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    setSliderFromY(side, p.y);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    const side = sliderPointers[e.pointerId];
    if(!side) return;
    if(e.pointerType === 'mouse' && e.buttons === 0){ delete sliderPointers[e.pointerId]; return; }   // ウィンドウ外で離した場合
    setSliderFromY(side, mapClient(e.clientX, e.clientY).y);
    e.preventDefault();
  });
  const endPointer = e => { delete sliderPointers[e.pointerId]; };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
}

// =================== Skill ===================
// Power演出オブジェクト
let beanFx = [];              // 豆の大きさが変わるときの煙・放射線など {type,x,y,t,life,...}
let lastBeanT = 0;            // 残り1個になってからの経過秒（豆の輪を出す時間の管理）
let outPhase = null;          // 最後の豆が消えてからリザルトまでの間 {t}（なければnull）
const OUT_TIME = 1.0;
let powerBlast = { t:-1 };   // Power発動の衝撃演出の経過秒（-1=なし）
let powerFX = { active:false, x:VW/2, y:GAME_H/2, scale:1, alpha:1 };
let powerRings = []; // 光のリング

let specialButton = { x: skillBtnRect.x + 6, y: skillBtnRect.y + 6, w: skillBtnRect.w - 12, h: skillBtnRect.h - 12, scale:1, glow:0 };

function playPowerEffect() {
    // 穴から衝撃波が広がる：ギザギザの爆発・黒縁の波・「ドンッ！」・画面揺れ
    powerBlast.t = 0;
    shakeT = Math.max(shakeT, 0.2);
}
const BLAST_LIFE = 1.2;
const blastEase = p => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 2);
function blastPulse(){
  const u = powerBlast.t;
  if(u < 0) return 1;
  return u < .1 ? 1 + u / .1 * .7 : Math.max(1, 1.7 - (u - .1) * 2.5);
}
function blastStar(x, y, r, rot, fill, pts){
  ctx.beginPath();
  for(let i = 0; i < pts * 2; i++){ const a = rot + i * Math.PI / pts, rr = i % 2 ? r * .55 : r; i ? ctx.lineTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr) : ctx.moveTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
}
function drawPowerBlast(){
  const u = powerBlast.t; if(u < 0 || u >= BLAST_LIFE) return;
  const hx = spawnMarker.x, hy = 4;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, VW, GAME_H); ctx.clip();
  if(u < .5){ const k = u / .5; blastStar(hx, hy, 34 + 90*k, u*2, k < .5 ? '#ffe14a' : 'rgba(255,225,74,.2)', 12); }
  [0, .12].forEach(d => {
    const k = (u - d) / .6; if(k < 0 || k > 1) return;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
    ctx.lineWidth = 11; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(hx, hy, 18 + 170*blastEase(k), 0, Math.PI); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  });
  const sc = u < .12 ? .4 + u / .12 * 1.2 : 1.6 - Math.min(.4, (u - .12) * .8), al = u < .9 ? 1 : Math.max(0, 1 - (u - .9) / .3);
  ctx.save(); ctx.globalAlpha = al; ctx.translate(hx, hy + 96); ctx.rotate(-.06); ctx.scale(sc, sc);
  popText(t('powerHit'), 0, 0, 34, '#ffe14a'); ctx.restore();
  ctx.restore();
}

function useSkill(){
  if (outPhase) return;
  if (specialReady){
    Hints.complete('power');
    specialcount++;
    if(balls.length < maxBeans()) spawnSkillBall(14, 2);
    for(let i=0;i<skillSmallCount();i++) if(balls.length < maxBeans()) spawnSkillBall(6, 1);
    specialGauge = 0;
    playPowerEffect();
    SFX.play('power');
    specialReady = false;
    stopSpecialReadyEffect();
  }
}
function spawnSkillBall(r, power){
  playSpawnMarkerAnimation();
  const angle = Math.random()*Math.PI*2;
  const speed = 2.0 + Math.random()*0.5;
  balls.push({ x:VW/2, y:10, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, r, power, scale:1 });
  updateLuckySpot();
  usedBall++;
}

// 豆が画面の外に出たときの演出：赤い「-1」、グレーの豆がポトッと落ちる、破片
function onBeanLost(b){
  beansLostCount++;
  SFX.play('lost');
  const left = b.x < 0, y = Math.max(40, Math.min(GAME_H - 40, b.y));
  addPopup(left ? 48 : VW - 48, y, '-1', 'lost');
  fallingBeans.push({ x: left ? 16 : VW - 16, y, t:0, small: b.power === 1, rot:0, vy:-1.5, vx: left ? 0.6 : -0.6 });
  spawnParticles(left ? 10 : VW - 10, y, 'red', 8, 'enemy');
  beanHud.lostT = 0.9;
}
function updateBeanHud(dt){
  if(balls.length > beanHud.prev) beanHud.gainT = 0.35;
  beanHud.prev = balls.length;
  beanHud.lostT = Math.max(0, beanHud.lostT - dt);
  beanHud.gainT = Math.max(0, beanHud.gainT - dt);
  for(let i = fallingBeans.length - 1; i >= 0; --i){
    const f = fallingBeans[i];
    f.t += dt; f.vy += 9 * dt; f.y += f.vy * dt * 60 * 0.35; f.x += f.vx * dt * 60 * 0.3; f.rot += dt * 6;
    if(f.t > 1.1) fallingBeans.splice(i, 1);
  }
}

// =================== Lucky Spot ===================
function checkLucky(ball){
    if(!luckySpot || !luckySpot.active) return false;
    const dx = ball.x - luckySpot.x;
    const dy = ball.y - luckySpot.y;
    if(ball.power === 1){
        // 小豆がLuckyに触れる：ボンッと普通の豆に成長（Lucky演出とゲージは控えめ、豆の追加はなし）
        if(dx*dx + dy*dy > (ball.r + luckySpot.r)**2) return false;
        luckycount++;
        Hints.complete('lucky');
        SFX.play('grow');
        growBall(ball);
        spawnAbsorbParticles(luckySpot.x, luckySpot.y, 'yellow', true);
        addGauge((30 + buffs.lucky * LUCKY_GAUGE_STEP) * 0.5);
        spawnParticles(luckySpot.x, luckySpot.y, 'gold', 8);
        luckySpot.x = 60 + Math.random()*(VW - 120);
        luckySpot.y = 40 + Math.random()*(GAME_H - 80);
        addTween(luckySpot, { scale:[0.4,1] }, 0.45, { ease:t=>0.5*(1-Math.cos(Math.PI*t)) });
        updateLuckySpot();
        return true;
    }
    if(dx*dx + dy*dy <= (ball.r + luckySpot.r)**2){
        luckycount++;
        Hints.complete('lucky');
        SFX.play('lucky');
        const bi = balls.indexOf(ball);
        if(bi>=0) balls.splice(bi,1);
        spawnAbsorbParticles(luckySpot.x, luckySpot.y);
        const vx=(Math.random()*2-1)*0.9;
        const vy=(Math.random()*2-1)*0.9;
        spawnBall(VW/2, 10, vx, vy, 14, 2);
        addGauge(30 + buffs.lucky * LUCKY_GAUGE_STEP);
        // 小豆を1つ追加（上限なら代わりにゲージを多めに加算）
        for(let i=0;i<luckySmallCount();i++){
          if(balls.length < maxBeans()) spawnSkillBall(6, 1);
          else addGauge(LUCKY_FULL_GAUGE);
        }
        spawnParticles(luckySpot.x, luckySpot.y, 'gold', 16);
        luckySpot.x = 60 + Math.random()*(VW - 120);
        luckySpot.y = 40 + Math.random()*(GAME_H - 80);
        addTween(luckySpot, { scale:[0.4,1] }, 0.45, { ease:t=>0.5*(1-Math.cos(Math.PI*t)) });
        return true;
    }
    return false;
}

// =================== Collisions ===================
function rectCircle(cx,cy,cr, x,y,w,h){
  const nx = Math.max(x, Math.min(cx, x+w));
  const ny = Math.max(y, Math.min(cy, y+h));
  const dx = cx-nx, dy = cy-ny;
  return dx*dx + dy*dy <= cr*cr;
}
function paddleCollision(ball, p){
  const hit = rectCircle(ball.x, ball.y, ball.r, p.x,p.y,p.thickness,p.length);
  if(hit){
    const incoming = p.side === 'left' ? ball.vx < 0 : ball.vx > 0;   // 向かってきた豆だけ演出（重なり続けても1回）
    const pos = (ball.y - p.y) / p.length - 0.5;
    const base = Math.max(Math.abs(ball.vx), 0.5);
    const spd = Math.min(base*1.01 + 0.02, 3.2);
    ball.vx = p.side==='left' ? Math.abs(spd) : -Math.abs(spd);
    ball.vy = pos * 1.6;
    if(!incoming) return;
    // ぽよん：バーが当たった所で外側にたわみ、豆はつぶれて跳ね返る
    p.bendAt = Math.max(.15, Math.min(.85, (ball.y - p.y) / p.length));
    p.bendV = (p.bendV || 0) + 90 + spd * 25;   // 軽く「ぷるっ」と震える程度
    ball.sqT = 0; ball.sqAxis = 'x';
    paddleHitFx.push({ x: p.side === 'left' ? p.x + p.thickness : p.x, y: ball.y, dir: p.side === 'left' ? 1 : -1, t: 0 });
    SFX.play('paddle');
  }
}

// =================== Level Control ===================
function startLevel(lv){
  enemies.length = 0;
  if (currentLevel === 0) startTime = Date.now();
  const cfg = LEVEL_DATA[lv];
  for(const k of cfg.e) spawnEnemyType(k);
}
startLevel(0);

// ステージクリア演出：最後の一撃をスローで見せる → 敵が弾ける → STAGE CLEAR!(ALL CLEAR!)を表示 → 強化選択(最終ならクリア画面)
function startStageClear(isFinal){
  const key = isFinal ? 'allClear' : 'stageClear';
  timeScale = 0.2;
  shakeT = 0.35;
  powerRings.push({ x:lastKill.x, y:lastKill.y, r:10, alpha:1, life:0.7, t:0 });
  powerRings.push({ x:lastKill.x, y:lastKill.y, r:10, alpha:0.7, life:0.9, t:-0.15 });
  setTimeout(() => {
    timeScale = 1;
    stageClearFX.key = key;
    SFX.play(isFinal ? 'allclearRoll' : 'clear');
    stageClearFX.active = true; stageClearFX.alpha = 1; stageClearFX.scale = 0.2;
    addTween(stageClearFX, { scale:[0.2,1.1] }, 0.25, { ease: t => 1 - Math.pow(1 - t, 3), onComplete(){
      addTween(stageClearFX, { scale:[1.1,1.0] }, 0.15);
    }});
    spawnStageFlash();
    spawnStageClearStars();
    // 文字をしっかり読ませてから次へ
    setTimeout(() => {
      addTween(stageClearFX, { alpha:[1,0] }, 0.2, { onComplete(){ stageClearFX.active = false; stageClearFX.key = null; } });
      setTimeout(() => {
        if(isFinal) advanceLevel();
        else openBuffSelect();
      }, 200);
    }, isFinal ? 900 : 1100);
  }, 350);
}

// 次ステージへ進行（最終ステージ後はゲームクリア）
function advanceLevel(){
  if(currentLevel + 1 >= LEVEL_DATA.length){
    // クリア画面に演出が焼き付かないよう消す
    stageClearFX.active = false; levelUpFX.active = false; luckyFX.active = false; powerFX.active = false;
    combo = 0;
    currentLevel++;
    gameOver = true;
  } else {
    playLevelClearEffect();
    currentLevel++;
    startLevel(currentLevel);
    // 速度UP
    leftPaddle.vy*=1.07;
    rightPaddle.vy*=1.07;
    minSpeed*=1.11;
  }
  levelup = false;
  inLevelClear = false;
}

// 強化の抽選：まだ最大スタックに達していないものから3つ（excludeに入っているものは極力避ける）
function rollBuffs(exclude){
  const ids = Object.keys(BUFF_MAX).filter(id => buffs[id] < BUFF_MAX[id]);
  const fresh = ids.filter(id => !(exclude && exclude.includes(id)));
  const pool = fresh.length >= 3 ? fresh : ids;
  for(let i = pool.length - 1; i > 0; --i){ const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}
function openBuffSelect(){ buffSelect = { lock: 0.6, options: rollBuffs() }; SFX.play('buffOpen'); }
function rerollBuffs(){
  if(!buffSelect || buffSelect.lock > 0 || rerollsLeft <= 0) return;
  rerollsLeft--;
  SFX.play('reroll');
  buffSelect.options = rollBuffs(buffSelect.options);
  buffSelect.lock = 0.25;
}

// 強化選択
function pickBuff(i){
  if(!buffSelect || buffSelect.lock > 0) return;
  const id = buffSelect.options[i];
  if(!id) return;
  buffs[id]++;
  SFX.play('buffPick');
  if(id === 'bar'){
    for(const p of [leftPaddle, rightPaddle]){
      p.length += BUFF_LEN_STEP;
      p.y = Math.max(WALL, Math.min(GAME_H - WALL - p.length, p.y - BUFF_LEN_STEP/2));
      p.target = p.y;
    }
  } else if(id === 'lucky'){
    if(luckySpot) luckySpot.r = LUCKY_R_BASE + buffs.lucky * LUCKY_R_STEP;
  }
  buffSelect = null;
  advanceLevel();
}

// =================== Spatial Hash for ball-ball collisions ===================
const CELL_SIZE = 48; // 調整ポイント: 小さすぎるとオーバーヘッド、大きすぎると効果薄
let grid = {};
function gridKey(cx, cy){ return cx + ',' + cy; }
function resetGrid(){
  grid = {};
  for(const b of balls){
    const cx = (b.x / CELL_SIZE)|0;
    const cy = (b.y / CELL_SIZE)|0;
    const k = gridKey(cx,cy);
    if(!grid[k]) grid[k] = [];
    grid[k].push(b);
  }
}
function neighborsForCell(cx, cy){
  const out = [];
  for(let yy = cy-1; yy <= cy+1; yy++){
    for(let xx = cx-1; xx <= cx+1; xx++){
      out.push(gridKey(xx,yy));
    }
  }
  return out;
}
function checkBallCollisions() {
  // Iterate cells only
  for (const key in grid){
    const [cx, cy] = key.split(',').map(n=>parseInt(n));
    const cellList = grid[key];
    // collect neighbors' balls into combined array to avoid duplicate across cells
    const neighKeys = neighborsForCell(cx,cy);
    // we'll check pairs within combined (but avoid duplicate by index tracking)
    for (let i = 0; i < cellList.length; i++){
      const a = cellList[i];
      for (const nk of neighKeys){
        const arr = grid[nk];
        if(!arr) continue;
        for (let j = 0; j < arr.length; j++){
          const b = arr[j];
          if (a === b) continue;
          // to avoid checking twice, only process if a._id < b._id (assign ids once)
          if (!a._id) a._id = Math.random().toString(36).slice(2);
          if (!b._id) b._id = Math.random().toString(36).slice(2);
          if (a._id >= b._id) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist2 = dx*dx + dy*dy;
          const minDist = a.r + b.r;
          if (dist2 < minDist*minDist && dist2 > 0.0001) {
            const dist = Math.sqrt(dist2);
            const nx = dx / dist;
            const ny = dy / dist;
            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              if (vn < -0.3) { SFX.play('clink'); addBump(a.x + nx * a.r, a.y + ny * a.r, nx, ny, Math.PI / 2); }   // 接点から両わきへ線を出す
              const imp = -vn;
              a.vx -= imp * nx;
              a.vy -= imp * ny;
              b.vx += imp * nx;
              b.vy += imp * ny;
            }
            const overlap = (minDist - dist);
            const half = overlap / 2;
            a.x -= nx * half;
            a.y -= ny * half;
            b.x += nx * half;
            b.y += ny * half;
          }
        }
      }
    }
  }
}

// =================== Ball control ===================
const MIN_SIDE_RATIO = 0.5;    // 豆の速さのうち、左右方向に最低これだけは残す（縦に跳ね続けてバーに届かないのを防ぐ）
function enforceBallMinSpeed(ball){
    const sp = Math.hypot(ball.vx, ball.vy);
    if(sp > 0.00001 && Math.abs(ball.vx) < sp * MIN_SIDE_RATIO){
      const sx = ball.vx !== 0 ? Math.sign(ball.vx) : (ball.x < VW/2 ? 1 : -1);
      ball.vx = sx * sp * MIN_SIDE_RATIO;
      ball.vy = Math.sign(ball.vy || 1) * sp * Math.sqrt(1 - MIN_SIDE_RATIO * MIN_SIDE_RATIO);
    }
    const vx = ball.vx, vy = ball.vy;
    const speed2 = vx*vx + vy*vy;
    const minS2 = minSpeed*minSpeed;
    if (speed2 < minS2 && speed2 > 0.00001){
        const scale = minSpeed / Math.sqrt(speed2);
        ball.vx *= scale;
        ball.vy *= scale;
    } else if (speed2 === 0){
        ball.vx = minSpeed * (Math.random() > 0.5 ? 1 : -1);
        ball.vy = 0;
    }
}
function countNormalBalls() {
    let ballcount = 0;
    for (const ball of balls) {
        if (ball.power === 2) {
            ballcount++;
            if (ballcount >= 3) return ballcount;
        }
    }
    return ballcount;
}

// =================== Rendering helpers ===================
function roundRect(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y, x+w,y+h, r);
  ctx.arcTo(x+w,y+h, x,y+h, r);
  ctx.arcTo(x,y+h, x,y, r);
  ctx.arcTo(x,y, x+w,y, r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

// star drawing kept same
function drawStar(ctx, x, y, points, outerRadius, innerRadius, color){
    ctx.save();
    ctx.beginPath();
    ctx.translate(x, y);
    ctx.moveTo(0, -outerRadius);
    for(let i=0;i<points;i++){
        ctx.rotate(Math.PI / points);
        ctx.lineTo(0, -innerRadius);
        ctx.rotate(Math.PI / points);
        ctx.lineTo(0, -outerRadius);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

// =================== Special ready effect ===================
let specialButtonAnim = null;
function playSpecialReadyEffect(){
    if (specialButtonAnim) return;
    specialButtonAnim = true;
    specialReadyAt = animT;   // 満タンの瞬間（縁の波紋の起点）
}
function stopSpecialReadyEffect(){
    if (!specialButtonAnim) return;
    specialButtonAnim = null;
    stopTweens(specialButton);
}

// =================== Drawing / UI ===================
function fitFontSize(text, maxWidth, initialSize){
  let size = initialSize;
  ctx.save();
  while(size > 8){
    ctx.font = size+'px '+FONT;
    if(ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  ctx.restore();
  return size;
}

// 黒フチ付きの文字（アメコミ風）
function popText(text, x, y, size, fill, align, lw){
  ctx.font = size+'px '+FONT;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw || Math.max(3, size/4.5);
  ctx.strokeStyle = '#111';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

const BTN_Y = GAME_H + 40, BTN_H = 150;
const SP_Y = GAME_H + 58, SP_H = VH - 14 - SP_Y;   // Powerボタン（上に威力表示と強化アイコンの行を確保。下端は左右のスライダーに揃える）
function drawFlipButton(rect, col, label){
  const x = rect.x + 8, w = rect.w - 16;
  ctx.fillStyle = '#111'; roundRect(ctx, x+5, BTN_Y+7, w, BTN_H, 16, true, false);
  ctx.fillStyle = col;    roundRect(ctx, x, BTN_Y, w, BTN_H, 16, true, false);
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, x, BTN_Y, w, BTN_H, 16, false, true);
  popText(label, x + w/2, BTN_Y + BTN_H/2, fitFontSize(label, w - 16, 24), '#fff');
}

// スライダー：バー位置と連動するつまみ付きの縦レール
function drawSlider(rect, side, col){
  const p = side === 'left' ? leftPaddle : rightPaddle;
  const x = rect.x + 8, w = rect.w - 16, y = SLIDER_Y, h = SLIDER_H;
  ctx.fillStyle = '#111'; roundRect(ctx, x+5, y+7, w, h, 16, true, false);
  ctx.fillStyle = col;    roundRect(ctx, x, y, w, h, 16, true, false);
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, x, y, w, h, 16, false, true);
  // 溝
  const gw = 18, gx = x + w/2 - gw/2;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(ctx, gx, y + 16, gw, h - 32, 9, true, false);
  // 上下の矢印
  ctx.fillStyle = '#fff'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#111';
  ctx.beginPath(); ctx.moveTo(x + w/2, y + 8); ctx.lineTo(x + w/2 - 11, y + 24); ctx.lineTo(x + w/2 + 11, y + 24); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w/2, y + h - 8); ctx.lineTo(x + w/2 - 11, y + h - 24); ctx.lineTo(x + w/2 + 11, y + h - 24); ctx.closePath(); ctx.fill(); ctx.stroke();
  // つまみ
  const frac = Math.max(0, Math.min(1, (p.y - WALL) / paddleRange(p)));
  const ky = y + frac * (h - SLIDER_KNOB_H);
  ctx.fillStyle = '#111'; roundRect(ctx, x + 3, ky + 3 + 4, w - 6, SLIDER_KNOB_H, 12, true, false);
  ctx.fillStyle = '#fff7e0'; roundRect(ctx, x + 3, ky + 4, w - 6, SLIDER_KNOB_H, 12, true, false);
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, x + 3, ky + 4, w - 6, SLIDER_KNOB_H, 12, false, true);
  ctx.lineWidth = 3;
  for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(x + 14, ky + 4 + SLIDER_KNOB_H/2 + i*9); ctx.lineTo(x + w - 14, ky + 4 + SLIDER_KNOB_H/2 + i*9); ctx.stroke(); }
}

function drawLangButton(){
  const b = langBtnRect;
  ctx.save();
  ctx.fillStyle = '#fff'; roundRect(ctx, b.x, b.y, b.w, b.h, 8, true, false);
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; roundRect(ctx, b.x, b.y, b.w, b.h, 8, false, true);
  ctx.fillStyle = '#111';
  ctx.font = fitFontSize(t('langBtn'), b.w-10, 12)+'px '+FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t('langBtn'), b.x + b.w/2, b.y + b.h/2 + 1);
  ctx.restore();
  if(typeof TITLE === 'undefined' || !TITLE.on) drawSfxButton();   // タイトルでは専用の2択ボタンを使う
}

// 効果音ON/OFFボタン（スピーカーのアイコン。OFFのときは×）
function drawSfxButton(){
  const b = sfxBtnRect, off = SFX.muted;
  ctx.save();
  ctx.fillStyle = off ? '#bbb' : '#fff'; roundRect(ctx, b.x, b.y, b.w, b.h, 8, true, false);
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; roundRect(ctx, b.x, b.y, b.w, b.h, 8, false, true);
  const cx = b.x + 10, cy = b.y + b.h/2;
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.moveTo(cx-5, cy-3); ctx.lineTo(cx-2, cy-3); ctx.lineTo(cx+3, cy-7); ctx.lineTo(cx+3, cy+7); ctx.lineTo(cx-2, cy+3); ctx.lineTo(cx-5, cy+3); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2; ctx.lineCap = 'round';
  if(off){
    ctx.beginPath(); ctx.moveTo(cx+7, cy-4); ctx.lineTo(cx+13, cy+4); ctx.moveTo(cx+13, cy-4); ctx.lineTo(cx+7, cy+4); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx+4, cy, 4, -0.9, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx+4, cy, 8, -0.9, 0.9); ctx.stroke();
  }
  ctx.restore();
}

function drawSpecialButton() {
    const b = specialButton;
    const x = skillBtnRect.x + 8, w = skillBtnRect.w - 16, y = SP_Y, h = SP_H;
    const p = specialGauge / 100;
    ctx.save();
    const bounce = specialReady ? 1 + .025 * Math.abs(Math.sin(animT * 3.5)) : 1;   // 満タン中はゆっくり弾む
    ctx.translate(x + w/2, y + h/2);
    ctx.scale(b.scale * bounce, b.scale * bounce);
    ctx.translate(-(x + w/2), -(y + h/2));
    ctx.fillStyle = '#111'; roundRect(ctx, x+5, y+7, w, h, 16, true, false);
    ctx.fillStyle = '#ffe14a'; roundRect(ctx, x, y, w, h, 16, true, false);
    if (!specialReady){
      ctx.save(); roundRect(ctx, x, y, w, h, 16, false, false); ctx.clip();
      ctx.fillStyle = '#fff7e0'; ctx.fillRect(x, y, w, h * (1 - p));
      ctx.restore();
    }
    ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, x, y, w, h, 16, false, true);
    popText(t('powerLabel'), x + w/2, y + h/2 - 14, fitFontSize(t('powerLabel'), w - 16, 26), '#ff3b3b');
    if(specialReady) popText(t('tapLabel'), x + w/2, y + h/2 + 22, fitFontSize(t('tapLabel'), w - 16, 18), '#fff');
    else popText(Math.floor(specialGauge) + '%', x + w/2, y + h/2 + 22, 20, '#fff');
    // 取得済みの強化アイコン（下段）と、ゲージ強化の稲妻
    drawBuffChips(x + w/2, y + h - 22, w - 14);
    for(let i = 0; i < buffs.gauge; i++) drawBuffGlyph('gauge', x + 16 + i*16, y + 18, 0.85);
    if(specialReady){
      // 縁日のランプ：光が縁を周回する（点滅はしない）
      const N = 26, step = Math.floor(animT * 10);
      for(let i = 0; i < N; i++){
        const q = perimPoint(x, y, w, h, 16, i / N), lit = (((i - step) % 3) + 3) % 3 === 0, r = lit ? 5.2 : 4;
        if(lit){ ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI*2); ctx.fillStyle = lit ? '#fff' : '#7a4a1a'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke();
      }
      // 満タンの瞬間だけ、縁から波紋がひとつ広がる
      const rel = animT - specialReadyAt;
      if(rel >= 0 && rel < .5){
        const k = rel / .5;
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineWidth = 6; ctx.strokeStyle = '#fff';
        roundRect(ctx, x - 4 - 30*k, y - 4 - 30*k, w + 8 + 60*k, h + 8 + 60*k, 16 + 20*k, false, true); ctx.restore();
      }
    }
    ctx.restore();
}
// 角丸四角の外周を 0〜1 でたどった点
function perimPoint(x, y, w, h, r, s){
  const L = [w-2*r, Math.PI*r/2, h-2*r, Math.PI*r/2, w-2*r, Math.PI*r/2, h-2*r, Math.PI*r/2], tot = L.reduce((a, b) => a + b, 0);
  let d = (((s % 1) + 1) % 1) * tot, i = 0;
  while(d > L[i]){ d -= L[i]; i++; }
  const k = d / L[i];
  switch(i){
    case 0: return { x: x + r + k*L[0], y };
    case 1: { const a = -Math.PI/2 + k*Math.PI/2; return { x: x + w - r + Math.cos(a)*r, y: y + r + Math.sin(a)*r }; }
    case 2: return { x: x + w, y: y + r + k*L[2] };
    case 3: { const a = k*Math.PI/2; return { x: x + w - r + Math.cos(a)*r, y: y + h - r + Math.sin(a)*r }; }
    case 4: return { x: x + w - r - k*L[4], y: y + h };
    case 5: { const a = Math.PI/2 + k*Math.PI/2; return { x: x + r + Math.cos(a)*r, y: y + h - r + Math.sin(a)*r }; }
    case 6: return { x, y: y + h - r - k*L[6] };
    default: { const a = Math.PI + k*Math.PI/2; return { x: x + r + Math.cos(a)*r, y: y + r + Math.sin(a)*r }; }
  }
}

// =================== Stage clear / level up / particles effects ===================
// 最後の敵が弾ける演出（星と破片が放射状に飛ぶ）
function spawnBigBurst(x, y){
  for(let i = 0; i < 56; i++){
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 5.5;
    const star = i % 3 !== 0;
    particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 0.6 + Math.random()*0.7, t:0,
      color: i % 2 ? 'gold' : 'red', star, size: star ? 9 + Math.random()*6 : 0, type: star ? undefined : 'enemy' });
  }
}

function spawnStageFlash(){
    for (let i = 0; i < 60; i++){
        if (particles.length >= MAX_PARTICLES) break;
        particles.push({ x: Math.random()*VW, y: Math.random()*GAME_H, vx:0, vy:0, life:0.25, t:0, color:"white", type:"flash" });
    }
}
function spawnStageClearStars() {
    for (let i = 0; i < 45; i++) {
        if (particles.length >= MAX_PARTICLES) break;
        const x = Math.random() * VW;
        const y = Math.random() * GAME_H;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        particles.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life: 1.4 + Math.random()*0.6, t:0, color:"white", star:true });
    }
}
function playLevelClearEffect() {
    levelUpFX.active = true; levelUpFX.alpha = 1; levelUpFX.scale = 0.4;
    addTween(levelUpFX, { alpha: [1, 0] }, 0.8);
    addTween(levelUpFX, { scale: [0.4, 1.5], alpha: [1, 0] }, 1.2, { ease: t => 1 - Math.pow(1 - t, 3), onComplete() { levelUpFX.active = false; }});
    // particles (throttled)
    for (let i = 0; i < 24; i++) spawnParticles(VW/2, GAME_H/2, 'yellow', 1);
}
function spawnAbsorbParticles(x, y, color='yellow', mild=false){
    for(let i=0;i<(mild ? 8 : 15);i++){
        if (particles.length >= MAX_PARTICLES) break;
        const angle = Math.random() * Math.PI * 2;
        const dist = 25 + Math.random() * 20;
        const sx = x + Math.cos(angle) * dist;
        const sy = y + Math.sin(angle) * dist;
        particles.push({ x: sx, y: sy, vx: (x - sx) * (0.05 + Math.random()*0.03), vy: (y - sy) * (0.05 + Math.random()*0.03), life: 0.6, t: 0, color: 'white', star: true });
    }
    luckyFX.active = true; luckyFX.x = x; luckyFX.y = y; luckyFX.alpha = 1; luckyFX.scale = 0.5; luckyFX.size = mild ? 20 : 26;
    addTween(luckyFX, { alpha:[1,0], scale:[0.5, mild ? 1.0 : 1.2] }, 0.8, { ease: t => 1 - Math.pow(1 - t, 3), onComplete(){ luckyFX.active = false; } });
}

function updateLuckySpot() {
  if (!luckySpot) return;
  let normalBallCount = countNormalBalls();
  if (normalBallCount >= 3) {
      if (luckySpot.active) {
          luckySpot.active = false;
          luckySpot.scale = 0;
          stopTweens(luckySpot);
      }
  } else {
      if (!luckySpot.active) {
          luckySpot.active = true;
          luckySpot.x = 60 + Math.random() * (VW - 120);
          luckySpot.y = 40 + Math.random() * (GAME_H - 80);
          luckySpot.scale = 0.4;
          addTween(luckySpot, { scale:[0.4,1] }, 0.45, { ease:t=>0.5*(1-Math.cos(Math.PI*t)) });
          addTween(luckySpot, { scale:[1,1.15] }, 0.9, { ease:t=>0.5*(1-Math.cos(Math.PI*t)), yoyo:true, repeat:-1 });
      }
  }
}

// =================== Rendering ===================
const bgCache = {};
function getBg(level){
  const k = Math.min(level, STAGE_THEME.length - 1);
  if(bgCache[k]) return bgCache[k];
  const th = STAGE_THEME[k];
  const cv = document.createElement('canvas'); cv.width = VW; cv.height = VH;
  const c = cv.getContext('2d');
  c.fillStyle = th.bg; c.fillRect(0, 0, VW, VH);
  c.fillStyle = th.dot;
  for(let y = 0; y < VH + 10; y += 12) for(let x = ((y/12|0)%2)*6; x < VW + 10; x += 12){
    c.beginPath(); c.arc(x, y, 1 + 3.2*(y/VH), 0, Math.PI*2); c.fill();
  }
  c.fillStyle = th.ui; c.fillRect(0, GAME_H + 10, VW, VH);
  c.fillStyle = '#111'; roundRect(c, 10, 12, VW-14, GAME_H-10, 12, true, false);
  c.fillStyle = '#fff7e0'; roundRect(c, 6, 6, VW-14, GAME_H-10, 12, true, false);
  c.lineWidth = 4; c.strokeStyle = '#111'; roundRect(c, 6, 6, VW-14, GAME_H-10, 12, false, true);
  c.fillStyle = 'rgba(255,170,60,.25)';
  for(let y = 20; y < GAME_H - 6; y += 10) for(let x = 16 + ((y/10|0)%2)*5; x < VW - 10; x += 10){
    c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI*2); c.fill();
  }
  bgCache[k] = cv;
  return cv;
}

const PCOL = { white:'#ff6a3d', yellow:'#ff9a1f', gold:'#ff9a1f' };

// tier: 威力強化の段階(0〜4)。段階が上がるほど金色→燃える豆になり、オーラや尾が付く
const BEAN_TIER_COL = ['#f6dca8', '#f9d878', '#ffc83a', '#ffae2e', '#ff8a2e'];
function drawBean(x, y, r, rot, small, tier, vx, vy){
  tier = small ? 0 : (tier || 0);
  ctx.save();
  if(tier >= 3 && (vx || vy)){
    const sp = Math.hypot(vx, vy) || 1;
    for(let k = 3; k >= 1; k--){
      ctx.globalAlpha = 0.35 - k*0.07; ctx.fillStyle = tier >= 4 ? '#ff5a1f' : '#ffb02e';
      ctx.beginPath(); ctx.arc(x - vx/sp*k*7, y - vy/sp*k*7, r*(1 - k*0.16), 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if(tier >= 2){
    const g = ctx.createRadialGradient(x, y, r*0.4, x, y, r*(1.6 + 0.12*tier));
    g.addColorStop(0, tier >= 4 ? 'rgba(255,110,40,.6)' : 'rgba(255,190,50,.5)'); g.addColorStop(1, 'rgba(255,190,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r*(1.6 + 0.12*tier), 0, Math.PI*2); ctx.fill();
  }
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(2.5, 2.5, r*1.08, r*.88, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = small ? '#e0a85c' : BEAN_TIER_COL[Math.min(tier, 4)]; ctx.beginPath(); ctx.ellipse(0, 0, r*1.08, r*.88, 0, 0, Math.PI*2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.strokeStyle = 'rgba(120,70,20,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-r*.5, r*.05); ctx.quadraticCurveTo(0, -r*.25, r*.5, r*.05); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(-r*.35, -r*.35, r*.28, r*.14, -.5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  if(tier >= 2){
    const a = animT * 3 + x * 0.1;
    drawSparkle4(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, 3 + tier, a, '#fff7a0');
  }
}

const LUCKY_COLORS = ['#ff6fb5', '#ff9a5a', '#ffd23f', '#fff08a'];
function drawLuckySpot(l){
  const lv = buffs.lucky, s = l.scale * (l.r / LUCKY_R_BASE);
  ctx.save(); ctx.translate(l.x, l.y);
  // 強化の段階ぶん、まわりをキラキラが回る
  for(let i = 0; i < lv; i++){
    const a = animT * 2.4 + i * Math.PI * 2 / lv;
    drawSparkle4(Math.cos(a) * 26 * s, Math.sin(a) * 26 * s, 5, -a, '#fff7a0');
  }
  ctx.rotate(animT);
  ctx.scale(s, s);
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.fillStyle = LUCKY_COLORS[Math.min(lv, 3)];
  ctx.beginPath();
  for(let i=0;i<10;i++){ const r = i%2 ? 7 : 17, a = -Math.PI/2 + i*Math.PI/5; i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// 点滅用の下書きキャンバス。鬼を一枚の絵として描いてから、まとめて半透明にする
// （直接半透明で描くと、重なった部品が透けて体の内側が見えてしまうため）
const oniLayer = document.createElement('canvas'), oniLayerCtx = oniLayer.getContext('2d');
function drawEnemy(e){
  const d = ONI_DATA[e.k], opt = { flashHorn: e.flashT > 0 ? e.flashHorn : null, critLv: buffs.crit };
  const faded = e.iFrame > 0 && Math.sin(Date.now() * 20) > 0;
  if(faded){
    const S = Math.ceil(d.r * 8);   // 角や金棒まで入る大きさ
    if(oniLayer.width < S || oniLayer.height < S){ oniLayer.width = oniLayer.height = S; }
    oniLayerCtx.clearRect(0, 0, S, S);
    drawOni(oniLayerCtx, e.k, S/2, S/2, animT, opt);
    ctx.save(); ctx.globalAlpha = 0.35;
    ctx.drawImage(oniLayer, 0, 0, S, S, Math.round(e.px - S/2), Math.round(e.py - S/2), S, S);
    ctx.restore();
  } else {
    drawOni(ctx, e.k, e.px, e.py, animT, opt);
  }
  // HPバー
  const w = Math.max(24, d.r * 2), bx = e.px - w/2, by = e.py - d.r - 26;
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#111';
  ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, w, 7);
  ctx.fillStyle = '#ff4040'; ctx.fillRect(bx, by, w * Math.max(0, e.hp) / e.maxHp, 7);
  ctx.strokeRect(bx, by, w, 7);
}

function drawPaddle(p){
  const col = p.side === 'left' ? '#2e86ff' : '#ff3b3b';
  if(buffs.guard > 0){
    // パリィ強化：バーを包むシールド
    const g = buffs.guard, pu = 0.5 + 0.5 * Math.sin(animT * 4);
    ctx.save();
    ctx.fillStyle = 'rgba(63,200,192,' + (0.18 + 0.05*g + 0.05*pu) + ')';
    roundRect(ctx, p.x - 5, p.y - 5, p.thickness + 10, p.length + 10, 10, true, false);
    ctx.lineWidth = 2 + g; ctx.strokeStyle = 'rgba(63,200,192,' + (0.6 + 0.1*g) + ')';
    roundRect(ctx, p.x - 5, p.y - 5, p.thickness + 10, p.length + 10, 10, false, true);
    ctx.restore();
  }
  if(p.bend){
    // たわんだバー：当たった位置を頂点に外側へ弓なりにする（両端は固定）
    const dir = p.side === 'left' ? -1 : 1, a = p.bendAt || .5, L = p.length, t = p.thickness, r = t/2, N = 14;
    const off = s => dir * p.bend * (s < a ? Math.sin(Math.PI/2 * s/a) : Math.sin(Math.PI/2 * (1 - s)/(1 - a)));
    const body = (dx, dy) => {
      ctx.beginPath();
      ctx.arc(p.x + r + dx, p.y + r + dy, r, Math.PI, 0);
      for(let i = 0; i <= N; i++){ const s = i / N, yy = p.y + r + s * (L - 2*r); ctx.lineTo(p.x + t + dx + off((yy - p.y) / L), yy + dy); }
      ctx.arc(p.x + r + dx, p.y + L - r + dy, r, 0, Math.PI);
      for(let i = N; i >= 0; i--){ const s = i / N, yy = p.y + r + s * (L - 2*r); ctx.lineTo(p.x + dx + off((yy - p.y) / L), yy + dy); }
      ctx.closePath();
    };
    body(3, 3); ctx.fillStyle = '#111'; ctx.fill();
    body(0, 0); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath();
    for(let i = 0; i <= N; i++){ const yy = p.y + 6 + i / N * (L - 12); i ? ctx.lineTo(p.x + 4.5 + off((yy - p.y) / L), yy) : ctx.moveTo(p.x + 4.5 + off((yy - p.y) / L), yy); }
    ctx.stroke();
  } else {
    ctx.fillStyle = '#111'; roundRect(ctx, p.x+3, p.y+3, p.thickness, p.length, 6, true, false);
    ctx.fillStyle = col;    roundRect(ctx, p.x, p.y, p.thickness, p.length, 6, true, false);
    ctx.lineWidth = 3; ctx.strokeStyle = '#111'; roundRect(ctx, p.x, p.y, p.thickness, p.length, 6, false, true);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(p.x+3, p.y+6, 3, p.length-12);
  }
  if(CONTROL === 'slider') return;
  // 進行方向の矢印
  const mx = p.x + p.thickness/2, sz = 12;
  ctx.beginPath();
  if(p.vy < 0){ ctx.moveTo(mx, p.y - sz); ctx.lineTo(mx - sz/2, p.y - 1); ctx.lineTo(mx + sz/2, p.y - 1); }
  else { ctx.moveTo(mx, p.y + p.length + sz); ctx.lineTo(mx - sz/2, p.y + p.length + 1); ctx.lineTo(mx + sz/2, p.y + p.length + 1); }
  ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
}

// 強化のアイコン（色は強化カードと同じ）
function drawBuffGlyph(id, x, y, s){
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath();
  switch(id){
    case 'bar':   ctx.rect(-2.5, -7, 5, 14); break;
    case 'power': ctx.ellipse(0, 0, 7, 5.4, -.5, 0, Math.PI*2); break;
    case 'crit':  ctx.moveTo(0, -8); ctx.lineTo(-5.5, 6); ctx.lineTo(5.5, 6); ctx.closePath(); break;
    case 'beans': ctx.arc(-4.5, 3, 3.2, 0, Math.PI*2); ctx.moveTo(7.7, 3); ctx.arc(4.5, 3, 3.2, 0, Math.PI*2); ctx.moveTo(3.2, -4); ctx.arc(0, -4, 3.2, 0, Math.PI*2); break;
    case 'skill': for(let i=0;i<8;i++){ const a = i*Math.PI/4, r = i%2 ? 3 : 8; i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); } ctx.closePath(); break;
    case 'gauge': ctx.moveTo(2, -8); ctx.lineTo(-5, 1); ctx.lineTo(-.5, 1); ctx.lineTo(-2, 8); ctx.lineTo(5, -2); ctx.lineTo(.5, -2); ctx.closePath(); break;
    case 'lucky': for(let i=0;i<10;i++){ const a = -Math.PI/2 + i*Math.PI/5, r = i%2 ? 3.4 : 8; i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); } ctx.closePath(); break;
    case 'guard': ctx.moveTo(0, -8); ctx.lineTo(7, -5); ctx.lineTo(6, 3); ctx.lineTo(0, 8); ctx.lineTo(-6, 3); ctx.lineTo(-7, -5); ctx.closePath(); break;
  }
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawBuffChip(id, x, y, r, count){
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + 1.5, y + 2, r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = BUFF_COLORS[id]; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.stroke();
  drawBuffGlyph(id, x, y, r / 12);
  if(count > 1) popText(String(count), x + r*0.8, y + r*0.85, Math.max(9, Math.round(r*0.95)), '#fff', 'center', 3.5);
}
// 取得済みの強化を左上に並べる
// 取得済みの強化アイコン（Powerボタンの中の下段）
function drawBuffChips(cx, cy, maxW){
  const ids = Object.keys(BUFF_MAX).filter(id => buffs[id] > 0), n = ids.length;
  if(!n) return;
  const step = Math.min(19, maxW / n), x0 = cx - (n - 1) * step / 2;
  ids.forEach((id, i) => drawBuffChip(id, x0 + i*step, cy, 8.5, buffs[id]));
}

// 豆の残数：盤面の豆の数だけ色付き、空きは枠だけ。最後の1個は赤くドクドク脈打つ
// 残り1個の予告：盤面の縁の赤み（弱め）＋最後の豆に回る破線の輪。色だけに頼らず形と動きでも伝える
function lastBeanOnly(){ return balls.length === 1 && !gameOver && !outPhase && !inLevelClear && !buffSelect; }
function drawLastBeanWarning(){
  if(!lastBeanOnly()) return;
  const k = Math.abs(Math.sin(animT * 5.2)), b = balls[0];
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, VW, GAME_H); ctx.clip();
  const g = ctx.createRadialGradient(VW/2, GAME_H/2, GAME_H*.28, VW/2, GAME_H/2, GAME_H*.78);
  g.addColorStop(0, 'rgba(232,53,43,0)'); g.addColorStop(1, 'rgba(232,53,43,' + (.24 * (.6 + .4*k)) + ')');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, GAME_H);
  ctx.restore();
  const R = b.r + 10, ra = lastBeanT < 3 ? 1 : Math.max(0, 1 - (lastBeanT - 3) / .5);
  if(ra <= 0) return;
  ctx.save(); ctx.globalAlpha = ra; ctx.translate(b.x, b.y); ctx.rotate(animT * 1.8); ctx.setLineDash([6, 6]); ctx.lineCap = 'round';
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawBeanStock(){
  const n = maxBeans(), cy = GAME_H + 46, step = Math.min(19, (colW - 10) / n), x0 = VW/2 - (n - 1) * step / 2;
  const sorted = balls.slice().sort((a, b) => b.power - a.power);
  const low = balls.length <= 1 && !gameOver;
  const bk = Math.abs(Math.sin(animT * 5.2)), beat = low ? 1 + bk * 0.4 : 1;
  for(let i = 0; i < n; i++){
    const x = x0 + i*step, b = sorted[i];
    ctx.save(); ctx.translate(x, cy);
    if(b){
      const small = b.power === 1, rx = small ? 6.5 : 8.5, ry = rx * 0.8;
      let sc = beat;
      if(beanHud.gainT > 0 && i === sorted.length - 1) sc *= 1 + beanHud.gainT / 0.35 * 0.5;
      ctx.scale(sc, sc);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(1.5, 2, rx, ry, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = low ? '#ff7a6a' : (small ? '#e0a85c' : '#f6dca8'); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = '#111'; ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 5.6, 0, 0, Math.PI*2); ctx.fill();
      // 直前に失った分だけ、一瞬グレーの豆を残す
      if(i === sorted.length && beanHud.lostT > 0){
        ctx.globalAlpha = Math.min(1, beanHud.lostT / 0.9 * 1.4);
        ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 6.8, 0, 0, Math.PI*2); ctx.fill();
        ctx.lineWidth = 2.2; ctx.strokeStyle = '#111'; ctx.stroke();
      }
    }
    ctx.restore();
  }
  if(low && balls.length === 1){
    const p = (animT * .83) % 1;
    ctx.save(); ctx.globalAlpha = (1 - p) * .8; ctx.lineWidth = 3; ctx.strokeStyle = '#ff5a4a';
    ctx.beginPath(); ctx.ellipse(x0, cy, 10 + 26*p, 8 + 18*p, 0, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    popText('!', x0 - 20, cy - bk * 3, 16, '#ffe14a', 'center', 4);
  }
}

function drawPopups(){
  for(const p of popups){
    const k = p.t / p.life;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
    if(p.kind === 'crit'){
      const cx = Math.max(46, Math.min(VW - 46, p.x));
      ctx.translate(cx, p.y - k*20); ctx.rotate(-.12);
      const sc = Math.min(1, p.t*8) * (1 + Math.sin(p.t*20)*.04) * 0.8;
      ctx.scale(sc, sc);
      ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.fillStyle = '#ff3b3b';
      ctx.beginPath();
      for(let i=0;i<20;i++){ const r = i%2 ? 22 : 44, a = i*Math.PI/10; i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      popText(p.txt, 0, 1, fitFontSize(p.txt, 74, 24), '#ffe14a');
    } else if(p.kind === 'lost'){
      popText(p.txt, p.x, p.y - k*26, 40, '#ff3b3b', 'center', 9);
    } else {
      const big = p.kind === 'big', size = fitFontSize(p.txt, big ? 200 : 120, big ? 38 : 18);
      ctx.font = size + 'px ' + FONT;
      const hw = ctx.measureText(p.txt).width / 2 + 10;
      const cx = Math.max(hw + 4, Math.min(VW - hw - 4, p.x));
      popText(p.txt, cx, p.y - k*(big ? 18 : 14), size, '#fff', 'center', big ? 8 : 5);
    }
    ctx.restore();
  }
}

function render(){
  ctx.clearRect(0,0,VW,VH);
  ctx.textBaseline = 'alphabetic';
  ctx.drawImage(getBg(currentLevel), 0, 0);

  // 最後の1個アラーム（点滅ではなくゆっくりした明暗）
  if(!gameOver && !buffSelect && !inLevelClear && balls.length === 1){
    const a = 0.10 + 0.14 * (0.5 + 0.5 * Math.sin(animT * 4.5));
    const g = ctx.createRadialGradient(VW/2, GAME_H/2, GAME_H*0.30, VW/2, GAME_H/2, GAME_H*0.85);
    g.addColorStop(0, 'rgba(255,50,50,0)'); g.addColorStop(1, 'rgba(255,50,50,' + a + ')');
    ctx.fillStyle = g; ctx.fillRect(6, 6, VW - 14, GAME_H - 10);
  }

  ctx.save();
  if(shakeT > 0){ const a = shakeT * 28; ctx.translate((Math.random()-.5)*a, (Math.random()-.5)*a); }

  // lucky
  if(luckySpot && luckySpot.active) drawLuckySpot(luckySpot);

  // 豆の影（床に落ちる。敵の下）
  for(const b of balls){
    const r = b.r * (b.scale || 1);
    ctx.fillStyle = 'rgba(60,30,0,.28)';
    ctx.beginPath(); ctx.ellipse(b.x + 7, b.y + r*0.95 + 7, r*1.15, r*0.5, 0, 0, Math.PI*2); ctx.fill();
  }

  // enemies
  for(const e of enemies) drawEnemy(e);
  drawProjectiles();

  // Stage clear text（帯付きで目立たせる）
  if (stageClearFX.active) {
    ctx.save();
    ctx.globalAlpha = stageClearFX.alpha;
    ctx.translate(VW/2, GAME_H/2);
    ctx.rotate(-0.05);
    ctx.scale(stageClearFX.scale, stageClearFX.scale);
    const key = stageClearFX.key || 'stageClear';
    const size = fitFontSize(t(key), VW - 100, 52), bh = size * 1.7;
    ctx.fillStyle = '#111'; ctx.fillRect(-VW/2 - 6 + 5, -bh/2 + 7, VW + 20, bh);
    ctx.fillStyle = key === 'allClear' ? '#ffb000' : '#ff3b3b'; ctx.fillRect(-VW/2 - 6, -bh/2, VW + 20, bh);
    ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.strokeRect(-VW/2 - 6, -bh/2, VW + 20, bh);
    popText(t(key), 0, 2, size, '#fff', 'center', 9);
    ctx.restore();
  }

  // level up
  if (levelUpFX.active){
    ctx.save();
    ctx.globalAlpha = levelUpFX.alpha * 0.7;
    ctx.fillStyle = "rgba(255,255,200,1)";
    ctx.fillRect(0, 0, VW, GAME_H);
    ctx.restore();

    ctx.save();
    ctx.translate(VW / 2, GAME_H / 2);
    ctx.scale(levelUpFX.scale, levelUpFX.scale);
    ctx.globalAlpha = levelUpFX.alpha;
    popText(t('levelUp'), 0, 0, fitFontSize(t('levelUp'), VW-40, 48), '#fff');
    ctx.restore();
  }

  if(luckyFX.active){
    ctx.save();
    ctx.translate(luckyFX.x, luckyFX.y);
    ctx.scale(luckyFX.scale, luckyFX.scale);
    ctx.globalAlpha = luckyFX.alpha;
    popText(t('luckyText'), 0, 0, luckyFX.size || 26, '#ffe14a');
    ctx.restore();
  }

  // spawn marker
  ctx.save();
  ctx.globalAlpha = spawnMarker.alpha;
  ctx.translate(spawnMarker.x, spawnMarker.y);
  ctx.scale(spawnMarker.scale * blastPulse(), spawnMarker.scale * blastPulse());
  ctx.fillStyle = '#111';
  ctx.fillRect(-spawnMarker.w/2, -spawnMarker.h/2, spawnMarker.w, spawnMarker.h);
  ctx.restore();

  // paddles
  drawPaddle(leftPaddle);
  drawPaddle(rightPaddle);
  // 壁・豆同士の小さな当たり：細い線が2本だけ、一瞬ひらく
  for(const f of bumpFx){
    const k = f.t / .16, a = (1 - k) * .85, r0 = 5 + k * 6, len = 4 + k * 5;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
    for(const sgn of [-1, 1]){
      const c = Math.cos(f.spread * sgn), sn = Math.sin(f.spread * sgn);
      const dx = f.nx * c - f.ny * sn, dy = f.nx * sn + f.ny * c;
      ctx.strokeStyle = '#111'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(f.x + dx*r0, f.y + dy*r0); ctx.lineTo(f.x + dx*(r0+len), f.y + dy*(r0+len)); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.restore();
  }
  // 弾いた瞬間の衝撃線（アメコミの「ポン！」線）
  for(const f of paddleHitFx){
    const k = f.t / .22, len = 6 + k * 14, a = 1 - k;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
    for(const ang of [-.7, 0, .7]){
      const ux = Math.cos(ang) * f.dir, uy = Math.sin(ang), r0 = 10 + k * 10;
      ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(f.x + ux*r0, f.y + uy*r0); ctx.lineTo(f.x + ux*(r0+len), f.y + uy*(r0+len)); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.restore();
  }

  // 予測線
  if(!gameOver && !buffSelect){
    for(const b of balls){
      drawPrediction(b, leftPaddle);
      drawPrediction(b, rightPaddle);
    }
  }

  // particles
  for (let i = 0; i < particles.length; i++){
    const p = particles[i];
    const ratio = 1 - p.t / p.life;
    const col = PCOL[p.color] || p.color || '#ff6a3d';
    ctx.globalAlpha = ratio;
    if (p.type === 'enemy'){
      ctx.fillStyle = p.color === 'red' ? 'rgba(255,60,60,1)' : 'rgba(255,150,40,1)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5 * ratio, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; continue;
    }
    if (p.star){
      drawStar(ctx, p.x, p.y, 5, (p.size || 6) * ratio, (p.size || 6) / 3 * ratio, col);
      ctx.globalAlpha = 1; continue;
    }
    ctx.fillStyle = col;
    const s = Math.max(1, Math.floor(3 * ratio));
    ctx.fillRect(Math.round(p.x - s/2), Math.round(p.y - s/2), s, s);
    ctx.globalAlpha = 1;
  }

  drawPopups();

  drawPowerBlast();
  // Power! テキスト
  if (powerFX.active) {
    ctx.save();
    ctx.translate(powerFX.x, powerFX.y);
    ctx.scale(powerFX.scale, powerFX.scale);
    ctx.globalAlpha = powerFX.alpha;
    popText(t('powerText'), 0, 0, 48, '#ffe14a');
    ctx.restore();
  }
  // 光のリング（更新はloop側でdt加算）
  for (let i = 0; i < powerRings.length; i++) {
    const r = powerRings[i];
    const ratio = Math.max(0, Math.min(1, r.t / r.life));
    ctx.save();
    ctx.globalAlpha = (1-ratio) * r.alpha;
    ctx.strokeStyle = "#ff9a1f";
    ctx.lineWidth = 5 * (1-ratio) + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r + ratio * 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawLastBeanWarning();
  drawBeanFx();
  // balls（豆）：数字・パーティクル・光の輪より前面に描き、演出に隠れないようにする
  for(const b of balls){
    const sq = beanSquash(b);
    if(sq){ const k = b.sqAxis === 'y' ? .5 : 1; ctx.save(); ctx.translate(b.x, b.y); if(b.sqAxis === 'y') ctx.scale(1 + sq * .7 * k, 1 - sq * k); else ctx.scale(1 - sq, 1 + sq * .7); drawBean(0, 0, b.r * (b.scale || 1), (b.x + b.y) * 0.05, b.power === 1, buffs.power, b.vx, b.vy); ctx.restore(); }
    else drawBean(b.x, b.y, b.r * (b.scale || 1), (b.x + b.y) * 0.05, b.power === 1, buffs.power, b.vx, b.vy);
    if(b.scorch){
      // 焦げ：オレンジに焼けて、火花が散りながら元に戻る
      const sc = b.scorch, q = sc.t / .6, rr = b.r * (b.scale || 1);
      ctx.save(); ctx.globalAlpha = .65 * sc.k * (1 - q); ctx.fillStyle = '#ff5a2a';
      ctx.beginPath(); ctx.ellipse(b.x, b.y, rr*1.08, rr*.88, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
      const n = sc.k >= 1 ? 6 : 3;
      for(let i = 0; i < n; i++){ const a = i * Math.PI * 2 / n + animT * 5, d = rr + 4 + ((animT * 30 + i * 7) % 16); drawSparkle4(b.x + Math.cos(a)*d, b.y + Math.sin(a)*d, 3, a, i % 2 ? '#ffd23f' : '#ff7a3a'); }
    }
    if(b.power !== 1){
      // 大きい豆だけ、ときどき右上で小さな星がキラッと光る
      const ph = (animT * 1.6 + b.x * 0.01) % 1;
      if(ph < 0.5){
        const k = Math.sin(ph / 0.5 * Math.PI), r = b.r * (b.scale || 1);
        const tx = b.x + r*0.85, ty = b.y - r*0.75;
        ctx.save();
        ctx.beginPath();
        for(let i = 0; i < 8; i++){ const a = animT * 3 + i*Math.PI/4, q = i % 2 ? (4 + 5*k)*0.35 : (4 + 5*k); i ? ctx.lineTo(tx + Math.cos(a)*q, ty + Math.sin(a)*q) : ctx.moveTo(tx + Math.cos(a)*q, ty + Math.sin(a)*q); }
        ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,60,' + (0.9*k) + ')'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(tx, ty, 7*k + 2, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }
    }
  }
  // 落ちていくグレーの豆
  for(const f of fallingBeans){
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    const r = f.small ? 8 : 14;
    ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.ellipse(0, 0, r*1.08, r*.88, 0, 0, Math.PI*2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // UI
  if(CONTROL === 'slider'){
    drawSlider(leftBtnRect, 'left', '#2e86ff');
    drawSlider(rightBtnRect, 'right', '#ff3b3b');
  } else {
    drawFlipButton(leftBtnRect, '#2e86ff', '◀ ' + t('btnLeftFlip'));
    drawFlipButton(rightBtnRect, '#ff3b3b', t('btnRightFlip') + ' ▶');
  }
  drawSpecialButton();
  {
    const atk = 2 + buffs.power * BUFF_POW_STEP, atkText = t('atkFmt')(fmtNum(atk), fmtNum(atk * critMult()));
    popText(atkText, VW/2, GAME_H + 23, fitFontSize(atkText, colW - 6, 15), '#fff', 'center', 4);
  }

  // HUD
  if(currentLevel < LEVEL_DATA.length){
    const label = currentLevel + 1 >= LEVEL_DATA.length ? t('hudFinal') : t('levelFmt')(currentLevel + 1);
    popText(label, 16, 32, 20, '#fff', 'left', 5);
  }

  drawBeanStock();
  drawCombo();
  drawPowerOrbs();
  drawHints();
  if(buffSelect) drawBuffSelect();

  // ゲームオーバー判定
  if (balls.length === 0 && !gameOver && !inLevelClear && !outPhase) {
    outPhase = { t: 0 };      // ズシンと揺れて暗くなり、少し止まってからリザルトへ
    shakeT = Math.max(shakeT, 0.32);
    SFX.play('thud');
  }
  if(outPhase){
    ctx.fillStyle = 'rgba(0,0,0,' + Math.min(.55, outPhase.t / .35 * .55) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  // game over / result
  if(gameOver){
    stopTweens(luckySpot);
    stopTweens(specialButton);
    if(currentLevel >= LEVEL_DATA.length && !gameClearEffectPlayed){
      captureFinalGameScreen();
      endTime = Date.now();
      cancelAnimationFrame(mainLoopId);
      spawnGameClearEffects();
      SFX.play('allclear');
      gameClearEffectPlayed = true;
      loopGameClear();
    }
    if(balls.length === 0){
      drawGameOverScreen();
    }
  }

  drawLangButton();
}

// ゲームオーバー画面：夕暮れの背景、提灯で進捗、倒れた枡と残った鬼のあざけり、紺の暖簾の看板
function drawDuskBackdrop(){
  ctx.fillStyle = '#7a78b8'; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.translate(VW/2, 120); ctx.rotate(-animT * .1);
  for(let i = 0; i < 18; i += 2){ ctx.fillStyle = '#908ecb'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 700, i*Math.PI*2/18, (i+1)*Math.PI*2/18); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, 'rgba(30,20,70,0)'); g.addColorStop(1, 'rgba(30,20,70,.45)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
}
function drawGrayBean(x, y, r, rot){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.ellipse(0, 0, r*1.08, r*.88, 0, 0, Math.PI*2); ctx.fill();
  ctx.lineWidth = Math.max(2, r*.22); ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r*.35, -r*.35, r*.28, r*.14, -.5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}
// 提灯：lit=明かり、cur=現在地（ゆらめく）。上のヒモは短め
function drawLantern(x, y, lit, cur, num){
  const sway = Math.sin(animT * 1.6 + x * .05) * .07;
  ctx.save(); ctx.translate(x, y); ctx.rotate(sway);
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 0); ctx.stroke();
  const fl = cur ? .75 + .25 * Math.sin(animT * 9) : 1;
  if(lit){ const g = ctx.createRadialGradient(0, 20, 4, 0, 20, 44); g.addColorStop(0, 'rgba(255,200,80,' + (.55*fl) + ')'); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 20, 44, 0, Math.PI*2); ctx.fill(); }
  ctx.fillStyle = '#111'; roundRect(ctx, -8+1.5, 2.5, 16, 6, 2, true, false); ctx.fillStyle = '#3b2410'; roundRect(ctx, -8, 0, 16, 6, 2, true, false);
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(1.5, 23.5, 15, 17, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = lit ? (cur ? '#ffb830' : '#ff4a3a') : '#59597a'; ctx.beginPath(); ctx.ellipse(0, 21, 15, 17, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = lit ? 'rgba(120,20,10,.5)' : 'rgba(20,20,50,.5)'; ctx.lineWidth = 1.8;
  for(const k of [-7, 0, 7]){ ctx.beginPath(); ctx.ellipse(0, 21, Math.abs(k) || 14, 17, 0, 0, Math.PI*2); ctx.stroke(); }
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, 21, 15, 17, 0, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#111'; roundRect(ctx, -8+1.5, 37.5, 16, 5, 2, true, false); ctx.fillStyle = '#3b2410'; roundRect(ctx, -8, 35, 16, 5, 2, true, false);
  boldText(String(num), 0, 22, 14, lit ? '#fff' : '#9a9ab5', 'center', lit ? '#7a1a0a' : null, 3);
  ctx.restore();
}
function drawTiltPlate(x, y, rot, txt){
  ctx.save(); ctx.font = 'bold 21px ' + BODY_FONT;
  let size = 21; while(size > 12){ ctx.font = 'bold ' + size + 'px ' + BODY_FONT; if(ctx.measureText(txt).width <= 176) break; size--; }
  const pw = Math.max(196, ctx.measureText(txt).width + 28), ph = 36;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#111'; roundRect(ctx, -pw/2+3, -ph/2+4, pw, ph, 10, true, false);
  ctx.fillStyle = '#3a4a8a'; roundRect(ctx, -pw/2, -ph/2, pw, ph, 10, true, false);
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, -pw/2, -ph/2, pw, ph, 10, false, true);
  boldText(txt, 0, 1, size, '#fff', 'center', '#0e1430', 5);
  ctx.restore();
}
function drawGameOverScreen(){
  drawDuskBackdrop();
  for(let i = 0; i < 10; i++) drawGrayBean((i*71 + 30) % VW, 80 + ((i*43) % 150), 6, i);
  // 上辺の梁と、ステージの進捗を示す提灯（クリア済み＝赤、現在地＝ゆらめく橙、未到達＝消灯）
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(VW, 10); ctx.stroke();
  for(let i = 0; i < LEVEL_DATA.length; i++) drawLantern(50 + i*65, 21, i <= currentLevel, i === currentLevel, i + 1);
  popText(t('resultTitle'), VW/2, 80, fitFontSize(t('resultTitle'), VW - 100, 42), '#ff3b3b', 'center', 11);
  // 倒れた枡とこぼれた豆
  ctx.save(); ctx.translate(150, 178); ctx.rotate(-.4); ctx.scale(.52, .52); drawMasuBox(0, 0, 170, 74); ctx.restore();
  [[56,206,.4],[44,220,1.3],[92,222,2.2],[168,206,3],[122,224,.9]].forEach(([x, y, r]) => drawGrayBean(x, y, 8, r));
  // 残った鬼（HPの大きい順に最大2体）。笑って体を揺らす
  const left = enemies.slice().sort((a, b) => b.r - a.r).slice(0, 2);
  const pos = [[240, 188], [304, 216]], sc = left.map((e, i) => Math.max(i ? .3 : .35, Math.min(i ? .55 : .7, (i ? 17 : 24) / e.r)));
  const PER = [3.6, 5.1], PH = [.5, 2.2];
  left.forEach((e, i) => {
    const u = (animT + PH[i]) % PER[i], lau = u < 1.2 ? Math.sin(u*28) * 2.2 : 0;
    ctx.save(); ctx.translate(pos[i][0], pos[i][1] + lau); ctx.rotate(Math.sin(animT*3 + i) * .06); ctx.scale(sc[i], sc[i]);
    drawOni(ctx, e.k, 0, 0, animT, { still:true }); ctx.restore();
  });
  // 札（RESULTの下、枡と鬼の上に置く）
  drawTiltPlate(100, 152, -.28, t('gameOverMsg'));
  // あざけりの吹き出し
  left.forEach((e, i) => {
    const d = ONI_DATA[e.k], tt = animT + PH[i], u = tt % PER[i], n = Math.floor(tt / PER[i]);
    if(u < .2 || u > 1.9) return;
    const a = Math.min(1, (u - .2)/.12) * Math.min(1, (1.9 - u)/.25), pop = .6 + .4 * Math.min(1, (u - .2)/.15);
    const lines = resultLines(e.k), txt = lines[n % lines.length];
    ctx.font = 'bold 12px ' + BODY_FONT; const w = Math.max(60, ctx.measureText(txt).width + 20);
    const x = Math.max(w/2 + 6, Math.min(VW - w/2 - 6, pos[i][0])), by = pos[i][1] - d.r*sc[i]*1.5 - 30;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, by); ctx.scale(pop, pop);
    ctx.fillStyle = '#111'; roundRect(ctx, -w/2+2, -12+3, w, 24, 9, true, false);
    ctx.fillStyle = '#fff'; roundRect(ctx, -w/2, -12, w, 24, 9, true, false);
    ctx.lineWidth = 3; ctx.strokeStyle = '#111'; roundRect(ctx, -w/2, -12, w, 24, 9, false, true);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-5, 11); ctx.lineTo(5, 11); ctx.lineTo(0, 19); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(0, 20); ctx.lineTo(6, 12); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-4, 10, 8, 3);
    boldText(txt, 0, 0, 12, '#222');
    ctx.restore();
  });
  drawClearRibbon(246, '#4a5ab0');
  drawNorenSign(10, 124, 170, 266, 0, t('signStats'), drawClearStatsBody, '#2f3d7a', '#1a1a40');
  drawNorenSign(148, 196, 186, 266, 1.4, t('signBuffs'), drawClearBuffsBody, '#2f3d7a', '#1a1a40');
  drawResultButtons(false);
}

// =================== Prediction line ===================
function foldY(y, lo, hi){
  const range = hi - lo;
  let v = (y - lo) % (range * 2);
  if(v < 0) v += range * 2;
  if(v > range) v = range * 2 - v;
  return lo + v;
}
const PREDICT_DIST = CONTROL === 'slider' ? 170 : 110;
function drawPrediction(b, p){
  const left = p.side === 'left';
  if(left ? b.vx >= 0 : b.vx <= 0) return;
  const faceX = left ? p.x + p.thickness + b.r : p.x - b.r;
  const dx = faceX - b.x;
  if(left ? dx > 0 : dx < 0) return;
  if(Math.abs(dx) > PREDICT_DIST + 40 * buffs.bar) return;
  const n = Math.abs(dx) / Math.abs(b.vx);   // 到達までのフレーム数(60fps基準)
  if(n > 75 + 25 * buffs.bar) return;   // ほぼ垂直に動く玉は到達が遠く予測が乱れるので出さない
  const lo = WALL + b.r, hi = GAME_H - WALL - b.r;
  const yEnd = foldY(b.y + b.vy * n, lo, hi);
  const pyEnd = foldY(p.y + p.vy * n, WALL, GAME_H - WALL - p.length);
  const hit = yEnd >= pyEnd - b.r && yEnd <= pyEnd + p.length + b.r;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = hit ? 'rgba(17,17,17,0.45)' : 'rgba(255,59,59,0.75)';
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  const steps = 14;
  for(let i = 1; i <= steps; i++){
    const f = n * i / steps;
    ctx.lineTo(b.x + b.vx * f, foldY(b.y + b.vy * f, lo, hi));
  }
  ctx.stroke();
  if(hit){
    // 反射後の進行方向（paddleCollisionと同じ式）
    const pos = (yEnd - pyEnd) / p.length - 0.5;
    const ovx = left ? 1 : -1, ovy = pos * 1.6;
    const len = Math.hypot(ovx, ovy);
    ctx.strokeStyle = '#ff7a00';
    ctx.beginPath();
    ctx.moveTo(faceX, yEnd);
    ctx.lineTo(faceX + ovx / len * (46 + 30 * buffs.bar), yEnd + ovy / len * (46 + 30 * buffs.bar));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = hit ? 'rgba(17,17,17,0.7)' : 'rgba(255,59,59,0.9)';
  ctx.beginPath(); ctx.arc(faceX, yEnd, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCombo(){
  if(combo < 2) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, comboTimer / 0.6);
  ctx.translate(16, GAME_H - 44);
  ctx.rotate(-.08);
  ctx.transform(1, 0, -.2, 1, 0, 0);
  ctx.save();
  ctx.scale(comboFX.scale, comboFX.scale);
  const label = t('comboFmt')(combo);
  popText(label, 0, 0, fitFontSize(label, 190, 34), '#ff3b3b', 'left', 8);
  ctx.restore();
  // コンボの残り時間と、いまのボーナス（Powerゲージの溜まりやすさ）
  const k = Math.max(0, Math.min(1, comboTimer / COMBO_TIME)), hurry = comboTimer < 0.8;
  const bw = 112, bh = 9, by = 21, blink = hurry && Math.sin(animT * 30) > 0;
  ctx.fillStyle = '#111'; roundRect(ctx, 2, by + 2, bw, bh, 4, true, false);
  ctx.fillStyle = '#fff'; roundRect(ctx, 0, by, bw, bh, 4, true, false);
  if(k > 0){ ctx.fillStyle = blink ? '#fff' : (hurry ? '#ff3b3b' : '#ffd23f'); roundRect(ctx, 0, by, Math.max(8, bw * k), bh, 4, true, false); }
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; roundRect(ctx, 0, by, bw, bh, 4, false, true);
  const mul = 1 + Math.min(combo - 1, 10) * 0.1;
  popText(t('comboBonusFmt')(mul.toFixed(1)), bw + 8, by + 5, 14, '#ffe14a', 'left', 4);
  ctx.restore();
}

// 強化カードの「現在 → 強化後」の値
function buffValues(id){
  switch(id){
    case 'bar':   return [leftPaddle.length, leftPaddle.length + BUFF_LEN_STEP];
    case 'power': { const a = 2 + buffs.power * BUFF_POW_STEP; return [fmtNum(a), fmtNum(a + BUFF_POW_STEP)]; }
    case 'crit':  return ['×' + fmtNum(critMult()), '×' + fmtNum(critMult() + 0.5)];
    case 'beans': return [maxBeans(), maxBeans() + 1];
    case 'skill': return [skillSmallCount(), skillSmallCount() + 1];
    case 'gauge': return ['×' + fmtNum(1 + 0.25 * buffs.gauge), '×' + fmtNum(1 + 0.25 * (buffs.gauge + 1))];
    default:      return ['', ''];
  }
}

function drawBuffSelect(){
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, VW, GAME_H);
  t('buffTitle').split('\n').forEach((ln, i, arr) => {
    popText(ln, VW/2, GAME_H/2 - 6 + (i - (arr.length - 1)/2) * 34, fitFontSize(ln, VW - 40, 28), '#ffe14a');
  });
  // 引き直しボタン
  const rb = REROLL_RECT, can = rerollsLeft > 0 && buffSelect.lock <= 0;
  ctx.globalAlpha = can ? 1 : 0.5;
  ctx.fillStyle = '#111'; roundRect(ctx, rb.x+3, rb.y+4, rb.w, rb.h, 12, true, false);
  ctx.fillStyle = '#fff7e0'; roundRect(ctx, rb.x, rb.y, rb.w, rb.h, 12, true, false);
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#111'; roundRect(ctx, rb.x, rb.y, rb.w, rb.h, 12, false, true);
  ctx.font = fitFontSize(t('rerollBtn')(rerollsLeft), rb.w - 14, 18) + 'px ' + FONT;
  ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t('rerollBtn')(rerollsLeft), rb.x + rb.w/2, rb.y + rb.h/2 + 1);
  ctx.globalAlpha = 1;

  const rects = [leftBtnRect, skillBtnRect, rightBtnRect];
  const ready = buffSelect.lock <= 0;
  ctx.fillStyle = STAGE_THEME[Math.min(currentLevel, STAGE_THEME.length-1)].ui;
  ctx.fillRect(0, GAME_H + 10, VW, UI_H);
  buffSelect.options.forEach((id, i) => {
    const r = rects[i], col = BUFF_COLORS[id], cnt = buffs[id];
    const [a, b] = buffValues(id), txt = t('buffCard')[id](a, b);
    ctx.globalAlpha = ready ? 1 : 0.5;
    const x = r.x + 8, w = r.w - 16;
    ctx.fillStyle = '#111'; roundRect(ctx, x+5, BTN_Y+7, w, BTN_H, 16, true, false);
    ctx.fillStyle = col;    roundRect(ctx, x, BTN_Y, w, BTN_H, 16, true, false);
    ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, x, BTN_Y, w, BTN_H, 16, false, true);
    const cx = x + w/2, cy = BTN_Y + BTN_H/2;
    drawBuffChip(id, cx, cy - 56, 14, 0);
    popText(txt[0], cx, cy - 28, fitFontSize(txt[0], w - 14, 20), '#fff');
    popText(txt[1], cx, cy + 2,  fitFontSize(txt[1], w - 14, 13), '#fff', 'center', 3.5);
    popText(txt[2], cx, cy + 22, fitFontSize(txt[2], w - 14, 13), '#fff', 'center', 3.5);
    if(cnt > 0) popText(t('buffStackFmt')(cnt), cx, cy + 50, fitFontSize(t('buffStackFmt')(cnt), w - 14, 13), '#fff7a0', 'center', 3.5);
  });
  ctx.restore();
}

// =================== Game clear loop (reuse particle update) ===================
let mainLoopId = null;
let last = now();
function loop(){
  const cur = now();
  const rawDt = Math.min(0.05, cur - last);
  const dt = rawDt * timeScale;
  last = cur;
  updateTweens(dt);
  animT += dt;
  // タイトル画面の間はゲームを進めない
  if(typeof TITLE === 'undefined' || TITLE.on){ if(typeof TITLE !== 'undefined') drawTitle(); mainLoopId = requestAnimationFrame(loop); return; }
  Hints.update(dt);
  if(shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  for(let i = popups.length - 1; i >= 0; --i){
    popups[i].t += dt;
    if(popups[i].t >= popups[i].life) popups.splice(i, 1);
  }

  // 最後の豆が消えた直後：動きを止めて、揺れと暗転のあとリザルトへ
  if(outPhase){
    outPhase.t += dt;
    updateBeanHud(dt);
    updateClearParticles(dt);
    if(outPhase.t >= OUT_TIME){ outPhase = null; endTime = Date.now(); gameOver = true; SFX.play('over'); }
    render();
    mainLoopId = requestAnimationFrame(loop);
    return;
  }

  // ゲームオーバー画面の間は、敵・鬼火・豆などゲーム内の動きを進めない
  if(gameOver && balls.length === 0){
    updateBeanHud(dt);
    render();
    mainLoopId = requestAnimationFrame(loop);
    return;
  }

  // 強化選択中はゲームを止める（パーティクルと演出のみ進める）
  if(buffSelect){
    buffSelect.lock = Math.max(0, buffSelect.lock - dt);
    updateClearParticles(dt);
    render();
    mainLoopId = requestAnimationFrame(loop);
    return;
  }

  if(combo > 0){
    comboTimer -= dt;
    if(comboTimer <= 0) combo = 0;
  }
  if(powerBlast.t >= 0){ powerBlast.t += dt; if(powerBlast.t >= BLAST_LIFE) powerBlast.t = -1; outPhase = null; beanFx.length = 0; }
  for(let i = powerRings.length - 1; i >= 0; i--){
    powerRings[i].t += dt;
    if(powerRings[i].t >= powerRings[i].life) powerRings.splice(i, 1);
  }

  // paddles
  for(const b of balls) if(b.sqT != null){ b.sqT += dt; if(b.sqT > .5) b.sqT = null; }
  updatePowerOrbs(dt);
  for(let i = bumpFx.length - 1; i >= 0; --i){ bumpFx[i].t += dt; if(bumpFx[i].t > .16) bumpFx.splice(i, 1); }
  for(let i = paddleHitFx.length - 1; i >= 0; --i){ paddleHitFx[i].t += dt; if(paddleHitFx[i].t > .22) paddleHitFx.splice(i, 1); }
  [leftPaddle,rightPaddle].forEach(p=>{
    updatePaddleBend(p, dt);
    if(CONTROL === 'slider'){ updateSliderPaddle(p, rawDt); return; }
    p.y += p.vy * dt * 60;
    if(p.y < WALL){ p.y=WALL ; p.vy*=-1; }
    if(p.y+p.length > GAME_H-WALL){ p.y=GAME_H-WALL-p.length; p.vy*=-1; }
  });

  // enemies update
  for(const e of enemies) updateEnemy(e, dt);
  updateProjectiles(dt);
  updateBeanHud(dt);
  lastBeanT = lastBeanOnly() ? lastBeanT + dt : 0;
  updateBeanFx(dt);

  // balls movement & collision (optimized)
  for(let i = balls.length - 1; i >= 0; --i){
    const b = balls[i];
    updateBeanMorph(b, dt);
    enforceBallMinSpeed(b);
    b.x += b.vx * dt * 60;
    b.y += b.vy * dt * 60;
    if(b.y - b.r <= WALL){ b.y = WALL + b.r; b.vy *= -1; SFX.play('wall'); addBump(b.x, WALL, 0, 1, .75); b.sqT = 0; b.sqAxis = 'y'; }
    if(b.y + b.r >= GAME_H-WALL){ b.y = GAME_H-WALL-b.r; b.vy *= -1; SFX.play('wall'); addBump(b.x, GAME_H - WALL, 0, -1, .75); b.sqT = 0; b.sqAxis = 'y'; }
    paddleCollision(b, leftPaddle);
    paddleCollision(b, rightPaddle);
    checkEnemyCollision(b);
    checkLucky(b);
    if(b.x + b.r < 0 || b.x - b.r > VW){
      onBeanLost(b);
      balls.splice(i,1);
      updateLuckySpot();
    }
  }

  // ball-ball collisions via spatial hash
  resetGrid();
  checkBallCollisions();

  // update particles (throttled)
  for (let i = particles.length - 1; i >= 0; --i){
    const p = particles[i];
    p.t += dt;
    if (p.t >= p.life){ particles.splice(i,1); continue; }
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
  }

  // next level?
  if(enemies.length === 0 && !gameOver && !levelup){
    projectiles.length = 0;
    levelup = true;
    inLevelClear = true;
    startStageClear(currentLevel + 1 >= LEVEL_DATA.length);
  }

  render();
  if(!gameOver || !gameClearEffectPlayed) mainLoopId = requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// game clear loop (particles-only display)
let gameClearLoopId = null;
function loopGameClear(){
  if (!(gameOver && gameClearEffectPlayed)) { gameClearLoopId = null; return; }
  const cur = now();
  const dt = Math.min(0.05, cur - last);
  last = cur;
  animT += dt;
  updateClearParticles(dt);
  renderGameClearScreen();
  if (gameOver && gameClearEffectPlayed) gameClearLoopId = requestAnimationFrame(loopGameClear);
  else gameClearLoopId = null;
}
function updateClearParticles(dt){
  for (let i = particles.length - 1; i >= 0; --i){
    const p = particles[i];
    p.t += dt;
    if (p.t >= p.life){ particles.splice(i,1); continue; }
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
  }
}
function captureFinalGameScreen(){
  finalGameScreen = document.createElement("canvas");
  finalGameScreen.width = VW; finalGameScreen.height = VH;
  const ctx2 = finalGameScreen.getContext("2d");
  ctx2.drawImage(canvas, 0, 0);
}

// game clear effects
function spawnGameClearEffects(){
    for (let i = 0; i < 60 && particles.length < MAX_PARTICLES; i++){
        particles.push({ x: Math.random()*VW, y: Math.random()*VH, vx:0, vy:0, color:"white", t:0, life:0.4, type:"flash" });
    }
    for (let i = 0; i < 80 && particles.length < MAX_PARTICLES; i++){
        const angle = Math.random()*Math.PI*2; const speed = 1.5 + Math.random()*2;
        particles.push({ x: VW/2, y: VH/2, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, color:'gold', t:0, life:1 + Math.random()*1.5, star:true });
    }
    for (let j = 0; j < 4; j++){
        setTimeout(()=> spawnFirework(100 + Math.random()*(VW-200), 100 + Math.random()*(VH-200)), j*250);
    }
}
function spawnFirework(px, py){
    for (let i = 0; i < 40 && particles.length < MAX_PARTICLES; i++){
        const angle = Math.random()*Math.PI*2; const speed = 1 + Math.random()*3;
        particles.push({ x:px, y:py, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, color: ["#ffcc00", "#ff6699", "#66ccff"][Math.floor(Math.random()*3)], t:0, life:1 + Math.random()*1, sparkle:true });
    }
}

// =================== Game clear screen（文字なし）===================

function drawSparkle4(x, y, r, rot, fill){
  ctx.beginPath();
  for(let i=0;i<8;i++){ const a = rot + i*Math.PI/4, rr1 = i%2 ? r*.35 : r; i ? ctx.lineTo(x+Math.cos(a)*rr1, y+Math.sin(a)*rr1) : ctx.moveTo(x+Math.cos(a)*rr1, y+Math.sin(a)*rr1); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
}

function drawClearBackdrop(){
  ctx.save();
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 0, VW, VH);
  ctx.translate(VW/2, 170); ctx.rotate(animT * 0.18);
  const n = 18;
  for(let i=0;i<n;i+=2){
    ctx.fillStyle = '#fff1a0';
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, 700, i*Math.PI*2/n, (i+1)*Math.PI*2/n);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // 下に向かって少し暗く
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, 'rgba(255,120,40,.45)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
}

function drawMasuBox(cx, y, w, h){
  const x = cx - w/2;
  ctx.fillStyle = '#111'; roundRect(ctx, x+5, y+6, w, h, 6, true, false);
  const wg = ctx.createLinearGradient(0, y, 0, y+h); wg.addColorStop(0, '#e8b56e'); wg.addColorStop(1, '#c98a46');
  ctx.fillStyle = wg; roundRect(ctx, x, y, w, h, 6, true, false);
  ctx.strokeStyle = 'rgba(120,70,20,.5)'; ctx.lineWidth = 2;
  for(let i=1;i<4;i++){ ctx.beginPath(); ctx.moveTo(x+8, y+i*h/4); ctx.bezierCurveTo(x+w*.3, y+i*h/4-4, x+w*.6, y+i*h/4+4, x+w-8, y+i*h/4); ctx.stroke(); }
  ctx.fillStyle = '#9a5f24'; roundRect(ctx, x, y, w, 14, 6, true, false);
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, x, y, w, h, 6, false, true);
  ctx.beginPath(); ctx.moveTo(x, y+14); ctx.lineTo(x+w, y+14); ctx.stroke();
}

// 豆が山盛りの枡（base=箱の上辺のy、sc=大きさ）
function drawMasu(base, sc, tt){
  ctx.save(); ctx.translate(VW/2, base); ctx.scale(sc, sc);
  const rows = [[-60,-40,-20,0,20,40,60], [-50,-30,-10,10,30,50], [-36,-12,12,36], [-18,18], [0]];
  let k = 0;
  rows.forEach((row, ri) => row.forEach(dx => {
    drawBean(dx + (ri%2 ? 3 : -3), -8 - ri*17 + Math.sin(tt*3 + k) * 1.5, 12, k*1.7, false);
    k++;
  }));
  drawMasuBox(0, 0, 170, 74);
  ctx.restore();
}

function drawIconOni(x, y){ ctx.save(); ctx.translate(x, y); ctx.scale(.85, .85); drawOni(ctx, 'chibi', 0, 0, animT, { still:true }); ctx.restore(); }
function drawIconStar(x, y){
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.fillStyle = '#ff6fb5';
  ctx.beginPath(); for(let i=0;i<10;i++){ const r = i%2 ? 5.5 : 13, a = -Math.PI/2 + i*Math.PI/5; i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function drawIconBolt(x, y){
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.fillStyle = '#ffe14a';
  ctx.beginPath(); ctx.moveTo(3, -14); ctx.lineTo(-9, 2); ctx.lineTo(-1, 2); ctx.lineTo(-4, 14); ctx.lineTo(9, -3); ctx.lineTo(1, -3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function drawIconClock(x, y){
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.moveTo(0, 0); ctx.lineTo(6, 3); ctx.stroke(); ctx.restore();
}

// 結果画面のボタン。ゲームオーバーは「つづきから」と「はじめから」の2つ、クリア後は「はじめから」だけ
// 押し間違えないように「つづきから」は大きく中央、「はじめから」は右下に小さく離して置く
const BTN_CONT = { x: 40, y: 456, w: 280, h: 56 }, BTN_TITLE_SMALL = { x: 252, y: 518, w: 92, h: 26 }, BTN_TITLE_ONE = { x: VW/2 - 80, y: 486, w: 160, h: 50 };   // y はクリア画面の CLEAR_RETRY_Y と同じ
function inBtn(p, r){ return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
function drawResultButtons(isClear){
  if(isClear){ drawRetryButton(false, BTN_TITLE_ONE.y, { ...BTN_TITLE_ONE, label: t('titleBtn'), col: '#2f3d7a' }); return; }
  const pu = 1 + Math.sin(animT * 3) * .02;   // 「つづきから」はゆっくり脈打たせて目立たせる
  ctx.save(); ctx.translate(VW/2, BTN_CONT.y + BTN_CONT.h/2); ctx.scale(pu, pu); ctx.translate(-VW/2, -(BTN_CONT.y + BTN_CONT.h/2));
  drawRetryButton(true, BTN_CONT.y, { ...BTN_CONT, label: t('continueBtn'), col: '#ff3b3b', size: 28 });
  ctx.restore();
  // 小さな「はじめから」：控えめな色の細いボタン
  const r = BTN_TITLE_SMALL;
  ctx.fillStyle = 'rgba(17,17,17,.55)'; roundRect(ctx, r.x, r.y, r.w, r.h, 8, true, false);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,243,216,.6)'; roundRect(ctx, r.x, r.y, r.w, r.h, 8, false, true);
  boldText(t('titleBtn'), r.x + r.w/2, r.y + r.h/2 + 1, 12, '#fff3d8');
}
function drawRetryButton(withIcon, by, o){
  by = by || 462; o = o || {};
  const bx = o.x != null ? o.x : VW/2 - 80, bw = o.w || 160, bh = o.h || 50;
  ctx.fillStyle = '#111'; roundRect(ctx, bx+4, by+5, bw, bh, 12, true, false);
  ctx.fillStyle = o.col || '#ff3b3b'; roundRect(ctx, bx, by, bw, bh, 12, true, false);
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, bx, by, bw, bh, 12, false, true);
  let tx = VW/2;
  if(withIcon){
    const cx = bx + 36, cy = by + bh/2, ar = 10, a0 = -Math.PI*0.2, a1 = Math.PI*1.45;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, ar, a0, a1); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, ar, a0, a1); ctx.stroke();
    const ex = cx + Math.cos(a1)*ar, ey = cy + Math.sin(a1)*ar;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a1 + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, 2); ctx.lineTo(-7, 2); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
    tx = bx + 36 + (bw - 36)/2 + 2;
  }
  const label = o.label || t('retryBtn'), room = withIcon ? bw - 66 : bw - 24;
  if(!withIcon) tx = bx + bw/2;
  popText(label, tx, by + bh/2 + 1, fitFontSize(label, room, o.size || 24), '#fff');
}

// =================== クリア画面：豆の雨・福の落款・鬼のセリフ・暖簾の看板 ===================
const CLEAR_RETRY_Y = 486;
const BODY_FONT = '"Hiragino Sans","Yu Gothic",Meiryo,sans-serif';
const CLEAR_ENEMIES = ['chibi', 'tora', 'taiko', 'hannya', 'boss'];
const CLEAR_PERIOD = [3.2, 4.4, 5.3, 3.7, 6.1], CLEAR_PHASE = [.4, 1.7, .9, 2.6, 3.3];   // 鬼ごとにセリフの間隔を変える
function clearEnemyX(i){ return 46 + i * (VW - 92) / 4; }

function boldText(txt, x, y, size, fill, align, edge, edgeW){
  ctx.font = 'bold ' + size + 'px ' + BODY_FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if(edge){ ctx.lineWidth = edgeW; ctx.strokeStyle = edge; ctx.strokeText(txt, x, y); }
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}
function numText(txt, x, y, size, fill, edge, align){
  ctx.font = size + 'px ' + FONT; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = size / 5; ctx.strokeStyle = edge; ctx.strokeText(txt, x, y); ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}
function drawIconShield(x, y, s){
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#3fc8c0'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, -5); ctx.lineTo(6, 3); ctx.lineTo(0, 8); ctx.lineTo(-6, 3); ctx.lineTo(-7, -5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function drawLvPips(x, y, n, max, col){
  for(let i = 0; i < max; i++){
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + i*10 + 1, y + 1.5, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = i < n ? col : '#e8dcc0'; ctx.beginPath(); ctx.arc(x + i*10, y, 4, 0, Math.PI*2); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = '#111'; ctx.stroke();
  }
}

// 上部：豆の雨、放射線、ALL CLEAR!、福の落款、豆山盛りの枡、キラキラ
function drawClearHero(){
  drawClearBackdrop();
  for(let i = 0; i < 24; i++){ drawBean((i*47 + 20) % VW, ((animT*70 + i*53) % 264) - 20, 6 + (i%3)*1.5, animT*3 + i, false); }
  ctx.save(); ctx.translate(VW/2, 42);
  for(let i = 0; i < 14; i++){ const a = i*Math.PI*2/14 + animT*.15; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(Math.cos(a)*118, Math.sin(a)*34); ctx.lineTo(Math.cos(a)*140, Math.sin(a)*42); ctx.stroke(); }
  ctx.restore(); ctx.lineCap = 'butt';
  ctx.save(); ctx.translate(VW/2 - 8, 42); const pu = 1 + Math.sin(animT*4)*0.03; ctx.scale(pu, pu);
  popText(t('allClear'), 0, 0, fitFontSize(t('allClear'), VW - 90, 46), '#ff3b3b', 'center', 11); ctx.restore();
  // 福の落款
  ctx.save(); ctx.translate(308, 50); ctx.rotate(.14 + Math.sin(animT*2)*.02);
  ctx.fillStyle = '#111'; roundRect(ctx, -24+3, -24+4, 48, 48, 8, true, false);
  ctx.fillStyle = '#c0202c'; roundRect(ctx, -24, -24, 48, 48, 8, true, false);
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; roundRect(ctx, -24, -24, 48, 48, 8, false, true);
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; roundRect(ctx, -18, -18, 36, 36, 5, false, true);
  popText('福', 0, 2, 32, '#fff', 'center', 0); ctx.restore();
  drawMasu(148, .6, animT);
  const cx = VW/2, cy = 148 - 34*.6*1.6;
  for(let i = 0; i < 9; i++){ const a = animT*1.1 + i*Math.PI*2/9; drawSparkle4(cx + Math.cos(a)*108, cy + Math.sin(a)*40, 6 + (i%3)*3, -a*2, i%2 ? '#fff' : '#ffe14a'); }
  for(let i = 0; i < 5; i++){ const ph = (animT*1.3 + i*.23) % 1; if(ph < .5){ const k = Math.sin(ph/.5*Math.PI); ctx.save(); ctx.globalAlpha = k; drawSparkle4(cx - 50 + i*25, cy - 12 - ((i%2)*8), 5 + 6*k, animT*3 + i, '#fff'); ctx.restore(); } }
}

// 鬼：降ってくる豆に当たって、ときどき震える
function drawClearEnemies(y, sc){
  CLEAR_ENEMIES.forEach((k, i) => {
    const d = ONI_DATA[k], s = sc, u = (animT + CLEAR_PHASE[i]) % CLEAR_PERIOD[i];
    const shake = u < .55 ? (1 - u/.55) : 0;
    const ox = Math.sin(u*70) * 3 * shake, rot = (i%2 ? .1 : -.1) + Math.sin(u*55) * .07 * shake;
    const x = clearEnemyX(i), yy = y + (k === 'boss' ? 10 : 0);
    ctx.save(); ctx.translate(x + ox, yy); ctx.rotate(rot); ctx.scale(s, s); drawOni(ctx, k, 0, 0, animT, { still:true }); ctx.restore();
    if(u < .2){ drawBean(x - 6, yy - d.r*s*1.6 - 60*(1 - u/.2), 5.5, animT*8, false); }
    if(u >= .2 && u < .4){
      const f = (u - .2) / .2; ctx.save(); ctx.globalAlpha = 1 - f;
      drawSparkle4(x + 4, yy - d.r*s*1.5, 5 + 7*f, animT*6, '#fff'); drawBean(x + 8 + f*18, yy - d.r*s*1.5 - 4 + f*f*40, 5, animT*9, false); ctx.restore();
    }
    for(let j = 0; j < 3; j++){ const a = animT*3 + j*Math.PI*2/3; drawSparkle4(x + Math.cos(a)*d.r*s*.9, yy - d.r*s*1.5 + Math.sin(a)*5, 4.5, a, '#ffe14a'); }
  });
}
// セリフ：条件に合う状況別セリフを先に、そのあと鬼ごとの固有セリフ
function playSeconds(){ return Math.max(0, Math.floor((endTime - startTime) / 1000)); }
function clearLines(i, key){
  const cond = t('oniClearCond')[key] || {}, out = [];
  if(beansLostCount === 0 && cond.noLoss) out.push(cond.noLoss);
  if(playSeconds() < 105 && cond.fast) out.push(cond.fast);
  if(parryCount >= 8 && cond.parry) out.push(cond.parry);
  if(Object.keys(BUFF_MAX).some(id => buffs[id] >= 3) && cond.buffMax) out.push(cond.buffMax);
  return out.concat(t('oniSay')[i]);
}
function resultLines(key){
  const cond = t('oniResultCond')[key] || {}, out = [];
  if(parryCount >= 5 && cond.parry) out.push(cond.parry);
  if(maxCombo >= 20 && cond.combo) out.push(cond.combo);
  if(playSeconds() >= 120 && cond.long) out.push(cond.long);
  if(specialcount === 0 && cond.noSkill) out.push(cond.noSkill);
  if(hornHits < 3 && cond.fewHorn) out.push(cond.fewHorn);
  if(luckycount === 0 && cond.noLucky) out.push(cond.noLucky);
  return out.concat(t('oniResultSay')[key] || []);
}

function drawClearBubbles(y, sc){
  CLEAR_ENEMIES.forEach((k, i) => {
    const d = ONI_DATA[k], P = CLEAR_PERIOD[i], tt = animT + CLEAR_PHASE[i], u = tt % P, n = Math.floor(tt / P);
    if(u < .25 || u > 1.8) return;
    const a = Math.min(1, (u - .25)/.12) * Math.min(1, (1.8 - u)/.25), pop = .6 + .4 * Math.min(1, (u - .25)/.15);
    const lines = clearLines(i, k), txt = lines[n % lines.length];
    ctx.font = 'bold 12px ' + BODY_FONT; const w = Math.max(58, ctx.measureText(txt).width + 20);
    const x = Math.max(w/2 + 6, Math.min(VW - w/2 - 6, clearEnemyX(i))), by = y - d.r*sc*1.5 - 34 + (k === 'boss' ? 10 : 0);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, by); ctx.scale(pop, pop);
    ctx.fillStyle = '#111'; roundRect(ctx, -w/2+2, -12+3, w, 24, 9, true, false);
    ctx.fillStyle = '#fff'; roundRect(ctx, -w/2, -12, w, 24, 9, true, false);
    ctx.lineWidth = 3; ctx.strokeStyle = '#111'; roundRect(ctx, -w/2, -12, w, 24, 9, false, true);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-5, 11); ctx.lineTo(5, 11); ctx.lineTo(0, 19); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(0, 20); ctx.lineTo(6, 12); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-4, 10, 8, 3);
    boldText(txt, 0, 0, 12, '#222');
    ctx.restore();
  });
}
// 札：赤地に白文字
function drawClearPlate(y){
  const txt = t('clearSub'), ph = 38;
  ctx.save(); ctx.font = 'bold 24px ' + BODY_FONT;
  let size = 24; while(size > 12){ ctx.font = 'bold ' + size + 'px ' + BODY_FONT; if(ctx.measureText(txt).width <= 230) break; size--; }
  const pw = Math.max(230, ctx.measureText(txt).width + 36);
  ctx.translate(VW/2, y); ctx.rotate(-.015);
  ctx.fillStyle = '#111'; roundRect(ctx, -pw/2+3, -ph/2+4, pw, ph, 10, true, false);
  ctx.fillStyle = '#ff3b3b'; roundRect(ctx, -pw/2, -ph/2, pw, ph, 10, true, false);
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, -pw/2, -ph/2, pw, ph, 10, false, true);
  boldText(txt, 0, 1, size, '#fff', 'center', '#7a0a0a', 5);
  ctx.restore();
}
// 赤い縞リボン：時間・最大コンボ・パリィ回数
function drawClearRibbon(y, col){
  const sec = Math.max(0, Math.floor((endTime - startTime) / 1000)), time = Math.floor(sec/60) + ':' + String(sec % 60).padStart(2, '0');
  ctx.save(); ctx.translate(VW/2, y); ctx.rotate(-.02);
  ctx.fillStyle = '#111'; roundRect(ctx, -160+4, -18+5, 320, 36, 6, true, false);
  ctx.fillStyle = col || '#ff3b3b'; roundRect(ctx, -160, -18, 320, 36, 6, true, false);
  ctx.save(); roundRect(ctx, -160, -18, 320, 36, 6, false, false); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 8; for(let x = -200; x < 200; x += 22){ ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + 30, 20); ctx.stroke(); }
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; roundRect(ctx, -160, -18, 320, 36, 6, false, true);
  drawIconClock(-136, 0); popText(time, -116, 1, 18, '#fff', 'left', 5);
  popText(t('comboMaxFmt')(maxCombo), 10, 1, fitFontSize(t('comboMaxFmt')(maxCombo), 130, 15), '#fff', 'center', 4);
  drawIconShield(96, 0, 1.5); popText('×' + parryCount, 116, 1, 16, '#fff', 'left', 4);
  ctx.restore();
}
// 暖簾の看板：竿・赤い布の見出し（切れ込みは両脇だけ）・クリームの紙
function drawNorenSign(x, w, h, pivotY, phase, title, bodyFn, cloth, clothEdge){
  const px = x + w/2, ang = Math.sin(animT*1.5 + phase) * .025, d = 14, ch = 38;
  ctx.save(); ctx.translate(px, pivotY); ctx.rotate(ang);
  ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-w*.3, 0); ctx.lineTo(-w*.38, d); ctx.moveTo(w*.3, 0); ctx.lineTo(w*.38, d); ctx.stroke();
  ctx.fillStyle = '#7a4a1a'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
  ctx.translate(-w/2, d);
  // 竿
  ctx.fillStyle = '#111'; roundRect(ctx, -6+2, -8+3, w+12, 12, 6, true, false);
  ctx.fillStyle = '#8a5a22'; roundRect(ctx, -6, -8, w+12, 12, 6, true, false);
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; roundRect(ctx, -6, -8, w+12, 12, 6, false, true);
  // 紙
  ctx.fillStyle = '#111'; roundRect(ctx, 4, 5, w, h, 8, true, false);
  ctx.fillStyle = '#fff3d8'; roundRect(ctx, 0, 0, w, h, 8, true, false);
  ctx.lineWidth = 4.5; ctx.strokeStyle = '#111'; roundRect(ctx, 0, 0, w, h, 8, false, true);
  // 赤い布
  ctx.fillStyle = cloth || '#c0202c'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, ch);
  for(const nx of [w*.83, w*.17]){ ctx.lineTo(nx + 6, ch); ctx.lineTo(nx, ch - 7); ctx.lineTo(nx - 6, ch); }
  ctx.lineTo(0, ch); ctx.closePath(); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.stroke();
  boldText(title, w/2, ch/2 + 2, 20, '#fff3d8', 'center', clothEdge || '#5a0a0a', 4);
  bodyFn(w, h);
  ctx.restore();
}
function drawClearStatsBody(w, h){
  const top = 62, rows = [[drawIconOni, killCount, t('labelEnemy')], [(x, y) => drawBean(x, y, 9, .5, false), usedBall - luckycount, t('labelBeans')], [drawIconStar, luckycount, t('labelLucky')], [drawIconBolt, specialcount, t('labelPower')]];
  rows.forEach(([ic, v, label], i) => {
    const yy = top + i * (h - top - 18) / 3;
    ic(26, yy); numText(String(v), 46, yy + 1, 24, '#cf4a30', '#fff3d8', 'left');
    boldText(label, w - 14, yy + 1, 11, '#3b2410', 'right');
  });
}
function drawClearBuffsBody(w, h){
  const ids = Object.keys(BUFF_MAX).filter(id => buffs[id] > 0), top = 66;
  if(!ids.length){ boldText(t('noBuffs'), w/2, h/2 + 14, 16, '#3b2410'); return; }
  ids.forEach((id, i) => {
    const col = i % 2, row = (i / 2) | 0, xx = 30 + col*84, yy = top + row * ((h - top - 22) / 3);
    drawBuffChip(id, xx, yy, 11, 0);
    boldText(t('buffName')[id], xx + 16, yy - 7, 12, '#3b2410', 'left');
    drawLvPips(xx + 16, yy + 9, buffs[id], BUFF_MAX[id] === 2 ? 2 : 4, BUFF_COLORS[id]);
  });
}

function renderGameClearScreen() {
    drawClearHero();
    drawClearEnemies(204, .5);
    drawClearPlate(86);
    drawClearBubbles(204, .5);
    drawClearRibbon(242);
    drawNorenSign(10, 124, 170, 262, 0, t('signStats'), drawClearStatsBody);
    drawNorenSign(148, 196, 186, 262, 1.4, t('signBuffs'), drawClearBuffsBody);
    drawResultButtons(true);
    for (const p of particles) {
        ctx.fillStyle = PCOL[p.color] || p.color;
        ctx.globalAlpha = 1 - (p.t / p.life);
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawLangButton();
}

// =================== Restart ===================
// つづきから：やられたレベルを、それまでの強化を持ったまま最初からやり直す（ペナルティなし）
function continueGame(){
    Hints.cur = null; Hints.queue = []; paddleHitFx = []; bumpFx = []; oniEmbers = []; powerOrbs = [];
    for(const pd of [leftPaddle, rightPaddle]){ pd.bend = 0; pd.bendV = 0; }
    SFX.play('retry');
    balls = []; enemies = []; particles = []; projectiles = []; popups = []; fallingBeans = []; powerRings = [];
    endTime = 0; gameOver = false; levelup = false; inLevelClear = false; timeScale = 1; shakeT = 0;
    specialGauge = 0; specialReady = false; stopSpecialReadyEffect();
    combo = 0; comboTimer = 0; buffSelect = null;
    stageClearFX = { active:false, alpha:0, scale:1 };
    luckyFX = { active:false, x:0, y:0, alpha:1, scale:0.5 };
    levelUpFX = { active:false, alpha:0, scale:1 };
    powerFX = { active:false, x:VW/2, y:GAME_H/2, scale:1, alpha:1 }; powerBlast.t = -1; outPhase = null; beanFx.length = 0;
    beanHud = { prev: 2, lostT: 0, gainT: 0 };
    initControl();
    spawnInitialBalls(2);
    last = now();
    cancelAnimationFrame(mainLoopId);
    mainLoopId = requestAnimationFrame(loop);
    startLevel(currentLevel);
}

function restartGame(){
    Hints.cur = null; Hints.queue = []; Hints.playT = 0; paddleHitFx = []; bumpFx = []; oniEmbers = []; powerOrbs = [];
    for(const pd of [leftPaddle, rightPaddle]){ pd.bend = 0; pd.bendV = 0; }
    SFX.play('retry');
    balls = []; enemies = []; particles = [];
    minSpeed = 1.3; currentLevel = 0; gauge = 0; luckycount = 0; killCount = 0; specialcount = 0; usedBall = 0;
    startTime = 0; endTime = 0; gameOver = false; levelup = false; specialGauge = 0; specialReady = false; inLevelClear = false;
    gameClearEffectPlayed = false;
    stageClearFX = { active:false, alpha:0, scale:1 }; timeScale = 1;
    luckyFX = { active:false, x:0, y:0, alpha:1, scale:0.5 };
    levelUpFX = { active:false, alpha:0, scale:1 };
    powerFX = { active:false, x:VW/2, y:GAME_H/2, scale:1, alpha:1 }; powerBlast.t = -1; outPhase = null; beanFx.length = 0;
    popups = []; shakeT = 0;
    maxCombo = 0; parryCount = 0; hornHits = 0; beansLostCount = 0;
    projectiles = []; buffs = newBuffs(); rerollsLeft = REROLLS; fallingBeans = []; beanHud = { prev: 2, lostT: 0, gainT: 0 };
    buffSelect = null; combo = 0; comboTimer = 0; powerRings = [];
    if(luckySpot) luckySpot.r = LUCKY_R_BASE;
    leftPaddle.length = 60; rightPaddle.length = 60;
    leftPaddle.y = (GAME_H-60)/2; leftPaddle.vy = -2.3;
    rightPaddle.y = (GAME_H-60)/2; rightPaddle.vy = -2.3;
    initControl();
    spawnInitialBalls(2);
    last = now();
    cancelAnimationFrame(mainLoopId);
    mainLoopId = requestAnimationFrame(loop);
    startLevel(0);
}

document.addEventListener('langchange', () => {
  if (!gameOver) return;
  if (gameClearEffectPlayed) {
    if (finalGameScreen) ctx.drawImage(finalGameScreen, 0, 0);
    renderGameClearScreen();
  } else {
    render();
  }
});
