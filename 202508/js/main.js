"use strict";

/* ==================== 基本設定 ==================== */
const W = 360, H = 548;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* ==================== Canvas 基本ヘルパー ==================== */
function drawText(text, x, y, opts) {
	opts = opts || {};
	const size = opts.size || 16;
	const weight = opts.weight || "";
	const align = opts.align || "left";
	const baseline = opts.baseline || "alphabetic";
	const lineHeight = opts.lineHeight || size * 1.2;
	ctx.save();
	ctx.font = `${weight} ${size}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`.trim();
	ctx.textAlign = align;
	ctx.textBaseline = baseline;
	if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = opts.glowBlur || 8; }
	String(text).split("\n").forEach((line, i) => {
		const ly = y + i * lineHeight;
		if (opts.stroke) {
			ctx.lineWidth = opts.strokeWidth || 3;
			ctx.strokeStyle = opts.stroke;
			ctx.lineJoin = "round";
			ctx.strokeText(line, x, ly);
		}
		ctx.fillStyle = opts.color || "#000";
		ctx.fillText(line, x, ly);
	});
	ctx.restore();
}

function measureTextWidth(text, size, weight) {
	ctx.save();
	ctx.font = `${weight || ""} ${size}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`.trim();
	const w = ctx.measureText(text).width;
	ctx.restore();
	return w;
}

function fitFontSize(text, maxWidth, initialSize, weight) {
	let size = initialSize;
	while (size > 8) {
		if (measureTextWidth(text, size, weight) <= maxWidth) break;
		size -= 1;
	}
	return size;
}

function roundRectPath(x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}
function fillRoundRect(x, y, w, h, r, fill) {
	ctx.save();
	roundRectPath(x, y, w, h, r);
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.restore();
}
function strokeRoundRect(x, y, w, h, r, color, lw, glow) {
	ctx.save();
	roundRectPath(x, y, w, h, r);
	if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 8; }
	ctx.strokeStyle = color;
	ctx.lineWidth = lw || 1;
	ctx.stroke();
	ctx.restore();
}

/* ==================== イージング関数 ==================== */
function easePower1Out(p) { return 1 - (1 - p) * (1 - p); }
function easePower1In(p) { return p * p; }
function easeSineOut(p) { return Math.sin(p * Math.PI / 2); }
function easeSineIn(p) { return 1 - Math.cos(p * Math.PI / 2); }
function easeBackOut(p) {
	const c1 = 1.70158, c3 = c1 + 1;
	return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

/* ==================== Tweenシステム（実時間ベース） ==================== */
// setTimeout等の実時計に頼らず、フレームループのdeltaだけで駆動する。
const activeTweens = [];
function tween(target, props, durationMs, opts) {
	opts = opts || {};
	const start = {};
	for (const k in props) start[k] = target[k];
	const tw = {
		target, start, props,
		duration: Math.max(1, durationMs),
		ease: opts.ease || easePower1Out,
		delay: opts.delay || 0,
		elapsed: 0,
		onComplete: opts.onComplete,
		dead: false,
	};
	activeTweens.push(tw);
	return tw;
}
function callAfter(delayMs, onComplete) {
	return tween({}, {}, 1, { delay: delayMs, onComplete });
}
function killTweensOf(target) {
	for (const tw of activeTweens) {
		if (tw.target === target) tw.dead = true;
	}
}
function updateTweens(deltaMs) {
	for (let i = activeTweens.length - 1; i >= 0; i--) {
		const tw = activeTweens[i];
		if (!tw || tw.dead) { activeTweens.splice(i, 1); continue; }
		let dtForThis = deltaMs;
		if (tw.delay > 0) {
			tw.delay -= deltaMs;
			if (tw.delay > 0) continue;
			dtForThis = -tw.delay;
			tw.delay = 0;
		}
		tw.elapsed += dtForThis;
		const p = Math.min(1, tw.elapsed / tw.duration);
		const e = tw.ease(p);
		for (const k in tw.props) {
			tw.target[k] = tw.start[k] + (tw.props[k] - tw.start[k]) * e;
		}
		if (p >= 1) {
			activeTweens.splice(i, 1);
			if (tw.onComplete) tw.onComplete();
		}
	}
}
// パンチ（押下フィードバック）: scale 1→big→1 を1往復
function punchScale(target, big, stepMs) {
	tween(target, { scale: big }, stepMs, {
		onComplete: () => tween(target, { scale: 1 }, stepMs)
	});
}
// 無限点滅（alpha往復）。ボタンではなく常時表示テキストの明滅演出に使う。
function loopBlink(target, low, high, stepMs) {
	let dir = true;
	function step() {
		tween(target, { alpha: dir ? high : low }, stepMs, { onComplete: () => { dir = !dir; step(); } });
	}
	step();
}

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う。 */
function hitTestBtn(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// 押下時のパンチアニメーション状態をキーごとに保持
const btnAnimState = new Map();
function pressAnim(key) {
	let a = btnAnimState.get(key);
	if (!a) { a = { scale: 1 }; btnAnimState.set(key, a); }
	killTweensOf(a);
	a.scale = 1;
	punchScale(a, 1.1, 100);
}
function animScale(key) {
	const a = btnAnimState.get(key);
	return a ? a.scale : 1;
}
function drawScaled(key, cx, cy, drawFn) {
	const s = animScale(key);
	ctx.save();
	ctx.translate(cx, cy);
	ctx.scale(s, s);
	ctx.translate(-cx, -cy);
	drawFn();
	ctx.restore();
}

document.title = t("pageTitle");
document.addEventListener("langchange", () => { document.title = t("pageTitle"); });

/* ==================== 配色（スロットマシンテーマ） ==================== */
const COLORS = {
	ballWin: "#ff3333",
	ballGold: "#ffcc00",
	ballRainbow: "#aa44ff",
	ballLose: "#556",
	ballUsed: "#1a1a1a",
	panelBg: "#1a1a1a",
	panelBorder: "#ffcc00",
	creditActive: "#ffcc00",
	creditInactive: "#333333",
	scoreColor: "#ffcc00",
	upgradeOnBg: "#1a1a1a",
	upgradeOffBg: "#141414",
	upgradeOnBorder: "#ffcc00",
	upgradeOffBorder: "#3a3a3a",
	restartBtn: "#cc0000",
	continueBtn: "#00994d",
};

/* ==================== ゲーム定数 ==================== */
const MAX_STAGE = 10;
const STORAGE_KEY = "lucky_draw_save";

/* ==================== ゲーム状態 ==================== */
let initFlg = true;              // true=まだ一度もハズレを引いていない（初回はLv10=1/1024から挑戦する原作仕様）
let stage = 1;
let exp = 0;
let drawCount = 1;
let bonusWin = 0;         // 当たり+1強化
let bonusDraw = 0;        // くじ+1強化
let bonusGain = 0;        // 獲得経験値アップ
let bonusSpecial = 0;     // 金くじ出現率UP
let rainbowMode = false;  // 原作でも到達しない未使用フラグ（虹くじモード）だが忠実移植のため保持
let isBonusTime = false;  // 当たり2倍フラグ
let bonusTimerMs = 0;     // ボーナスタイム残りミリ秒（円グラフをミリ秒単位で滑らかに動かすため実数で保持）
const BONUS_TIME_MS = 10000;
let tempMsgShowing = false; // ボーナス終了メッセージの一時表示
let tempMsgTimerMs = 0;

let winStreak = 0;
let maxWinStreak = 0;

let currentLotteryPool = [];
let usedFlags = [];
let startFlg = true;
let clearFlg = false;

let totalDraw = 0;
let totalExp = 0;
const stageStats = {};

let startTime = Date.now();
let clearTime = Date.now();
let elapsedTime = 0;

let drawInProgress = false;
let omake = 0;
let omakeAccumMs = 0;

let balls = []; // {index,x,y,r,offsetX,scale,alpha,revealed}

// SCORE表示用のドラムロール演出（実際のexpとは別に、tweenで滑らかに追従させる表示専用の値）
const displayExpObj = { value: 0 };
function syncDisplayExp(immediate) {
	killTweensOf(displayExpObj);
	if (immediate) { displayExpObj.value = exp; return; }
	const diff = Math.abs(exp - displayExpObj.value);
	if (diff < 1) { displayExpObj.value = exp; return; }
	const duration = Math.min(900, Math.max(150, diff * 4));
	tween(displayExpObj, { value: exp }, duration, { ease: easePower1Out });
}
function addExp(amount) {
	exp += amount;
	totalExp += amount;
	syncDisplayExp(false);
}
function spendExp(amount) {
	exp -= amount;
	syncDisplayExp(false);
}

// 常時ループする明滅演出（表示条件はdraw側で判定するので、対象オブジェクトは常時回しておいてよい）
const blinkFirst = { alpha: 0 };
const blinkFinal = { alpha: 0 };
const blinkStreak = { alpha: 1 };
const blinkBonusMsg = { alpha: 1 };
const blinkTempMsg = { alpha: 1 };
loopBlink(blinkFirst, 0, 1, 1000);
loopBlink(blinkFinal, 0, 1, 1000);
loopBlink(blinkStreak, 0, 1, 800);
loopBlink(blinkBonusMsg, 0, 1, 500);
loopBlink(blinkTempMsg, 0, 1, 250);

// 大当たり演出等の一時ポップアップテキスト
let popupFx = null; // {kind:'aura'|'hazure', text, color, auraAlpha, auraScale, textAlpha, textY, textRotation}

/* ==================== レイアウト（動的計算） ====================
 * くじを引ける最大回数（drawMax=1+bonusDraw）によってCREDIT表示の行数が変わるため、
 * 強化購入や起動のたびに再計算する。玉グリッドの高さもそれに応じて可変になる。 */
function computeLayout() {
	const drawMax = 1 + bonusDraw;
	const roadY = 10, roadH = 46;
	let y = roadY + roadH + 6;

	const rows = drawMax > 10 ? 2 : 1;
	const perRow = Math.ceil(drawMax / rows);
	const availW = 200, gap = 4;
	let boxSize = (availW - gap * (perRow - 1)) / perRow;
	boxSize = Math.max(9, Math.min(24, boxSize));

	// infoCardにはCREDIT（ラベル＋大きめの数字＋残数ボックス）と確率の円グラフを両方収める。
	// 円グラフは「成功率」ラベルを上に外出しした分、必要な高さが変わるので両者の大きい方を採用する。
	const creditRowH = 20; // ラベル＋大きい数字を横並びにする行の高さ
	const creditAreaH = creditRowH + boxSize * rows + 4 * (rows - 1);
	const ringR = 20, probLabelH = 12, probGap = 4;
	const probAreaH = probLabelH + probGap + ringR * 2;
	const infoH = Math.max(creditAreaH, probAreaH) + 16;

	const btnH = 50, expH = 30, upgradesH = 46 * 2 + 8;
	const fixedBelow = 6 + infoH + 6 + btnH + 6 + expH + 6 + upgradesH;
	const ballBoxH = H - y - fixedBelow - 10;

	const roadmap = { x: 10, y: roadY, w: 340, h: roadH };
	const ballBox = { x: 10, y, w: 340, h: ballBoxH };
	y += ballBoxH + 6;

	const infoCard = { x: 10, y, w: 340, h: infoH, boxSize, rows, perRow, creditRowH, ringR };
	y += infoH + 6;

	const drawBtn = { x: W / 2 - 150, y, w: 300, h: btnH };
	y += btnH + 6;

	const expBar = { x: 10, y, w: 340, h: expH };
	y += expH + 6;

	const upgrades = [];
	const rowH = 46, colW = (340 - 8) / 2;
	for (let i = 0; i < 4; i++) {
		const col = i % 2, row = Math.floor(i / 2);
		upgrades.push({ x: 10 + col * (colW + 8), y: y + row * (rowH + 6), w: colW, h: rowH });
	}

	// 初期化／言語切替ボタンはロードマップカード右上に配置。
	// 初期化ボタンは誤タップ防止も兼ねて言語切替ボタンから離し、やや中央寄りに置く。
	const resetBtn = { x: roadmap.x + roadmap.w - 138, y: roadmap.y + 5, w: 57, h: 18 };
	const langBtn = { x: roadmap.x + roadmap.w - 61, y: roadmap.y + 5, w: 57, h: 18 };

	return { roadmap, ballBox, infoCard, drawBtn, expBar, upgrades, resetBtn, langBtn };
}
let LAYOUT = computeLayout();

/* ==================== 演算ヘルパー ==================== */
function getUpgradeCost(base, level) {
	return Math.floor(base * Math.pow(1.5, level));
}
function getStageExp(stg) {
	return Math.floor(totalDraw / 5 * Math.pow(stg, 1.3));
}

/* ==================== くじプール ==================== */
function generateNewLotteryPool() {
	const total = Math.pow(2, stage);
	const wins = Math.min((1 + bonusWin) * (isBonusTime ? 2 : 1), total);
	const specialRate = 0.01 * (10 - stage) + bonusSpecial * 0.002;
	const specialCount = Math.min(Math.floor(total * specialRate), bonusSpecial * (isBonusTime ? 2 : 1));

	const pool = [];
	for (let i = 0; i < total; i++) {
		if (i < specialCount) pool.push('gold');
		else if (i < specialCount + wins) pool.push('win');
		else pool.push('lose');
	}

	// 虹くじモード：loseの前半半分を'rainbow'に変換（原作でも有効化経路が無く常に不発の残骸ロジック）
	if (rainbowMode) {
		const loseIndexes = pool.map((v, i) => (v === 'lose' ? i : -1)).filter(i => i >= 0);
		const half = Math.floor(loseIndexes.length / 2);
		for (let i = 0; i < half; i++) pool[loseIndexes[i]] = 'rainbow';
	}

	if (startFlg) {
		usedFlags = Array(pool.length).fill(false);
		startFlg = false;
	}

	currentLotteryPool = pool;
}

function calculateRemainingWinRate() {
	const pool = currentLotteryPool;
	const remainingTotal = pool.reduce((n, _, i) => n + (usedFlags[i] ? 0 : 1), 0);
	const remainingWins = pool.reduce((n, v, i) => n + (!usedFlags[i] && (v === 'win' || v === 'gold' || v === 'rainbow') ? 1 : 0), 0);
	return { winCount: remainingWins, totalCount: remainingTotal, rate: remainingTotal > 0 ? remainingWins / remainingTotal : 0 };
}

// 表示用の確率スナップショット。くじを引いた直後に即座に反映すると「今引いている最中の確率」が
// 変わってしまい違和感があるため、抽選演出が完全に終わったタイミングでのみ更新する。
let displayedProb = { winCount: 0, totalCount: 0, rate: 0 };
function refreshDisplayedProb() {
	displayedProb = calculateRemainingWinRate();
}

function rebuildBalls() {
	// 現在進行中の演出（当たり/ハズレのtween連鎖）が有効なオブジェクトを掴んでいる場合があるため、
	// ここでkillTweensOfはしない（killすると連鎖onCompleteが二度と発火せず、抽選ロック解除が永久に起きなくなる）。
	balls = [];
	const pool = currentLotteryPool;
	const total = pool.length;
	const padding = 4;
	const cols = Math.ceil(Math.sqrt(total));
	const rows = Math.ceil(total / cols);
	const box = LAYOUT.ballBox;
	const spacingX = (box.w - padding * 2) / cols;
	const spacingY = (box.h - padding * 2) / rows;
	const radius = Math.min(spacingX, spacingY) * 0.4;

	for (let i = 0; i < total; i++) {
		const col = i % cols, row = Math.floor(i / cols);
		balls.push({
			index: i,
			x: box.x + padding + spacingX * (col + 0.5),
			y: box.y + padding + spacingY * (row + 0.5),
			r: radius,
			offsetX: 0, scale: 1, alpha: 1,
			revealed: true, // false中は当たり/ハズレ演出中で、usedFlags済みでも元の色のまま表示する
		});
	}
	refreshDisplayedProb();
}

function ballColor(ball) {
	if (usedFlags[ball.index] && ball.revealed) return COLORS.ballUsed;
	const type = currentLotteryPool[ball.index];
	if (type === 'win') return COLORS.ballWin;
	if (type === 'gold') return COLORS.ballGold;
	if (type === 'rainbow') return COLORS.ballRainbow;
	return COLORS.ballLose;
}

/* ==================== 演出：当たり／ハズレ ==================== */
const flashObj = { alpha: 0 };
function screenFlash() {
	killTweensOf(flashObj);
	flashObj.alpha = 0;
	tween(flashObj, { alpha: 0.8 }, 150, { onComplete: () => tween(flashObj, { alpha: 0 }, 150) });
}

// CREDITボックス消化演出。くじを引いた瞬間、消費されるボックスを白くフラッシュさせてから馴染ませる。
let creditBoxFlashes = []; // {index, alpha, scale}
function flashCreditBox(index) {
	const f = { index, alpha: 1, scale: 1.5 };
	creditBoxFlashes.push(f);
	tween(f, { alpha: 0, scale: 1 }, 350, {
		ease: easeSineOut,
		onComplete: () => {
			const idx = creditBoxFlashes.indexOf(f);
			if (idx >= 0) creditBoxFlashes.splice(idx, 1);
		}
	});
}

// JACKPOT時だけの画面シェイク。canvas全体をランダムな短いオフセットで揺らし、当たりの手応えを強める。
const screenShakeObj = { x: 0, y: 0 };
function screenShake(amp, times, stepMs) {
	killTweensOf(screenShakeObj);
	let count = 0;
	function step() {
		const nx = (Math.random() - 0.5) * 2 * amp;
		const ny = (Math.random() - 0.5) * 2 * amp;
		tween(screenShakeObj, { x: nx, y: ny }, stepMs, {
			onComplete: () => {
				count++;
				if (count < times) step();
				else tween(screenShakeObj, { x: 0, y: 0 }, stepMs);
			}
		});
	}
	step();
}

function shakeX(target, amp, stepMs, times, onComplete) {
	let count = 0;
	function step(sign) {
		tween(target, { offsetX: sign * amp }, stepMs, {
			onComplete: () => {
				count++;
				if (count < times * 2) {
					step(-sign);
				} else {
					tween(target, { offsetX: 0 }, stepMs, { onComplete });
				}
			}
		});
	}
	step(-1);
}

// 「ハズレ…」テキスト演出（hazureText、合計400ms）とテンポを揃えるため、
// 見た目の振動は短めにし、ロック解除のonCompleteはテキスト消滅と同時に発火させる。
function playMissEffect(ball, onComplete) {
	shakeX(ball, 2, 50, 3, null);
	tween(ball, { scale: 0.9 }, 80, {
		onComplete: () => tween(ball, { scale: 1 }, 80, {
			onComplete: () => tween(ball, { scale: 0.9 }, 80, {
				onComplete: () => tween(ball, { scale: 1 }, 80)
			})
		})
	});
	callAfter(400, onComplete);
}

// 当たり演出用の放射パーティクル（小さな光の玉が四方に飛び散って消える）
// くじ玉の色（赤/金/紫）と重ならないよう、玉には使われないカラフルな配色をランダムに使う。
const WIN_PARTICLE_COLORS = ["#00e5ff", "#33ff99", "#ffffff", "#ff66cc", "#7fffd4"];
let winParticles = [];
function spawnWinParticles(x, y, count) {
	for (let i = 0; i < count; i++) {
		const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
		const dist = 30 + Math.random() * 50;
		const color = WIN_PARTICLE_COLORS[Math.floor(Math.random() * WIN_PARTICLE_COLORS.length)];
		const p = { x, y, r: 2 + Math.random() * 2.5, color, alpha: 1 };
		winParticles.push(p);
		tween(p, { x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0 }, 450 + Math.random() * 250, {
			ease: easeSineOut,
			onComplete: () => {
				const idx = winParticles.indexOf(p);
				if (idx >= 0) winParticles.splice(idx, 1);
			}
		});
	}
}
function drawWinParticles() {
	for (const p of winParticles) {
		ctx.save();
		ctx.globalAlpha = p.alpha;
		ctx.shadowColor = p.color; ctx.shadowBlur = 6;
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
		ctx.fillStyle = p.color;
		ctx.fill();
		ctx.restore();
	}
}

function playWinEffect(ball, onComplete) {
	tween(ball, { scale: 2 }, 400, {
		ease: easeBackOut,
		onComplete: () => tween(ball, { scale: 1 }, 400, { ease: easeBackOut, onComplete })
	});
	tween(ball, { alpha: 0.6 }, 200, { onComplete: () => tween(ball, { alpha: 1 }, 200) });
	screenFlash();
}

// パーティクルは当たった玉ではなく、画面中央のWIN!テキストと一緒に光るオーラ（演出用の玉）から飛び散らせる。
// こうすることで玉の色/サイズ（ステージが進むと縮小する）に演出が左右されなくなる。
function createAuraText(message, color, particleCount) {
	killTweensOf(popupFx);
	const fx = { kind: 'aura', text: message, color, cx: W / 2, cy: 120, auraAlpha: 0, auraScale: 1, textAlpha: 0, textY: 0, textRotation: 0 };
	popupFx = fx;
	tween(fx, { auraAlpha: 0.8 }, 200, {
		onComplete: () => {
			tween(fx, { auraScale: 2 }, 250, { ease: easeSineOut });
			tween(fx, { auraAlpha: 0 }, 250, { ease: easeSineIn });
			spawnWinParticles(fx.cx, fx.cy - 10, particleCount || 18);
		}
	});
	tween(fx, { textAlpha: 1, textY: -20 }, 250, {
		ease: easePower1Out,
		onComplete: () => tween(fx, { textAlpha: 0, textY: -40 }, 200, { ease: easePower1In, delay: 250, onComplete: () => { if (popupFx === fx) popupFx = null; } })
	});
}

function createAuraTextBig(message, color, particleCount) {
	killTweensOf(popupFx);
	const fx = { kind: 'aura', big: true, text: message, color, cx: W / 2, cy: 120, auraAlpha: 0, auraScale: 1, textAlpha: 0, textY: 0, textRotation: 0 };
	popupFx = fx;
	tween(fx, { auraAlpha: 0.8 }, 300, {
		onComplete: () => {
			tween(fx, { auraScale: 3 }, 400, { ease: easeSineOut });
			tween(fx, { auraAlpha: 0 }, 200, { ease: easeSineIn });
			spawnWinParticles(fx.cx, fx.cy - 10, particleCount || 32);
		}
	});
	tween(fx, { textAlpha: 1, textY: -20 }, 400, {
		ease: easePower1Out,
		onComplete: () => tween(fx, { textAlpha: 0, textY: -40 }, 400, { ease: easePower1In, delay: 400, onComplete: () => { if (popupFx === fx) popupFx = null; } })
	});
}

function hazureText(message, color) {
	killTweensOf(popupFx);
	const fx = { kind: 'hazure', text: message, color, cx: W / 2, cy: 90, auraAlpha: 0, auraScale: 1, textAlpha: 0, textY: 0, textRotation: 0 };
	popupFx = fx;
	tween(fx, { textAlpha: 1, textY: 10, textRotation: 0.2 }, 150, {
		ease: easePower1Out,
		onComplete: () => tween(fx, { textAlpha: 0, textY: 20 }, 100, { ease: easePower1In, delay: 150, onComplete: () => { if (popupFx === fx) popupFx = null; } })
	});
}

/* ==================== ボーナスタイム／保持経験値タイマー ==================== */
function startBonusTime() {
	if (clearFlg) return;
	isBonusTime = true;
	generateNewLotteryPool();
	rebuildBalls();
	bonusTimerMs = BONUS_TIME_MS;
}

function bonusCheck() {
	if (!isBonusTime) {
		if (Math.random() < 1 / 50) startBonusTime();
	}
}

function updateTimers(dt) {
	if (isBonusTime) {
		bonusTimerMs -= dt;
		if (bonusTimerMs <= 0) {
			bonusTimerMs = 0;
			isBonusTime = false;
			tempMsgShowing = true;
			tempMsgTimerMs = 1000;
			generateNewLotteryPool();
			rebuildBalls();
		}
	}
	if (tempMsgTimerMs > 0) {
		tempMsgTimerMs -= dt;
		if (tempMsgTimerMs <= 0) { tempMsgTimerMs = 0; tempMsgShowing = false; }
	}

	if (!clearFlg) {
		omakeAccumMs += dt;
		while (omakeAccumMs >= 1000) {
			omakeAccumMs -= 1000;
			if (bonusGain < 1) continue;
			const currentGain = (bonusGain * 1.5 + totalDraw) * 0.1 * Math.max(1, bonusGain - 5) + omake;
			const passiveGain = Math.floor(currentGain);
			omake = currentGain - passiveGain;
			if (passiveGain > 0) addExp(passiveGain);
		}
	}
}

/* ==================== ステージ進行 ==================== */
function updateStageStats(stg, result) {
	if (!stageStats[stg]) stageStats[stg] = { draw: 0, win: 0, lose: 0 };
	stageStats[stg].draw++;
	if (result === 'win' || result === 'gold' || result === 'rainbow') stageStats[stg].win++;
	else stageStats[stg].lose++;
}

function advanceStage() {
	saveData();
	stage++;
	startFlg = true;
	if (stage > MAX_STAGE) {
		clearFlg = true;
		showResult();
	} else {
		drawCount = 1 + bonusDraw;
		generateNewLotteryPool();
		rebuildBalls();
	}
}

let resultParticles = [];
let resultElapsedMs = 0;
function showResult() {
	clearTime = Date.now();
	elapsedTime += clearTime - startTime;
	saveData();
	resultElapsedMs = 0;
	resultParticles = [];
	const colors = ["#ffcc00", "#ff3333", "#ffffff"];
	const count = initFlg ? 60 : 40; // 豪運クリア（ノーミス）はより派手に
	for (let i = 0; i < count; i++) {
		resultParticles.push({
			x: Math.random() * W,
			y: Math.random() * H,
			r: Math.random() * 2.2 + 1,
			phase: Math.random() * Math.PI * 2,
			speed: 0.5 + Math.random() * 0.8,
			color: colors[i % colors.length],
		});
	}
}

/* ==================== くじを引く ==================== */
function drawLottery() {
	if (drawInProgress || drawCount <= 0 || clearFlg) return;
	drawInProgress = true;

	const pool = currentLotteryPool;
	const availableIndexes = balls.map((_, i) => i).filter(i => !usedFlags[i]);
	const pickedIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
	const result = pool[pickedIndex];
	const pickedBall = balls[pickedIndex];
	usedFlags[pickedIndex] = true;
	pickedBall.revealed = false; // 演出が終わるまでは当たり色のまま見せる（usedFlags済みでも即グレーにしない）

	flashCreditBox(drawCount - 1); // 消費される直前のCREDITボックス（減算前のdrawCount-1番目）を光らせる
	drawCount--;
	totalDraw++;

	updateStageStats(stage, result);

	if (result === 'gold') {
		playWinEffect(pickedBall, () => {
			winStreak++;
			if (winStreak > maxWinStreak) maxWinStreak = winStreak;
			const baseGain = getStageExp(stage) * 3;
			const streakBonus = Math.floor(baseGain * 0.7 * (winStreak - 1));
			const totalGain = Math.max(
				Math.floor((baseGain + streakBonus) * (1 + bonusGain * 0.1)),
				getUpgradeCost(20, bonusGain) * 1.1,
				getUpgradeCost(25, bonusSpecial) * 1.1,
				getUpgradeCost(10, bonusWin) * 1.1,
				getUpgradeCost(15, bonusDraw) * 1.1
			);
			addExp(totalGain);
			pickedBall.revealed = true;
			drawInProgress = false;
			advanceStage();
		});
		createAuraTextBig(t("bigWinText"), COLORS.ballGold, 32);
		screenShake(4, 6, 40);
	} else if (result === 'win') {
		playWinEffect(pickedBall, () => {
			winStreak++;
			if (winStreak > maxWinStreak) maxWinStreak = winStreak;
			const baseGain = Math.max(getStageExp(stage), 5 * stage);
			const streakBonus = Math.floor(baseGain * 0.4 * (winStreak - 1));
			const totalGain = Math.floor((baseGain + streakBonus) * (1 + bonusGain * 0.05));
			addExp(totalGain);
			pickedBall.revealed = true;
			drawInProgress = false;
			advanceStage();
		});
		createAuraText(t("winText"), COLORS.ballWin, 18);
	} else {
		playMissEffect(pickedBall, () => {
			winStreak = 0;
			const gain = Math.floor(getStageExp(stage) * 0.2);
			let totalGain = 1;
			if (initFlg) {
				initFlg = false;
			} else {
				totalGain = Math.max(Math.floor(gain * (1 + bonusGain * 0.1)), 2 * stage);
			}
			addExp(totalGain);

			if (drawCount <= 0) {
				startFlg = true;
				stage = 1;
				drawCount = 1 + bonusDraw;
				bonusCheck();
				generateNewLotteryPool();
				rebuildBalls();
			} else {
				refreshDisplayedProb(); // rebuildBallsを経由しないケースなので演出完了時にここで更新する
			}
			pickedBall.revealed = true;
			drawInProgress = false;
		});
		hazureText(t("loseText"), "#dddddd");
	}

	bonusCheck();
	saveData();
}

/* ==================== 保存／読込 ==================== */
function saveData() {
	const data = { bonusWin, bonusDraw, bonusGain, bonusSpecial, exp, totalExp, totalDraw, elapsedTime };
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadData() {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (!saved) return;
	try {
		const data = JSON.parse(saved);
		bonusWin = data.bonusWin ?? 0;
		bonusDraw = data.bonusDraw ?? 0;
		bonusGain = data.bonusGain ?? 0;
		bonusSpecial = data.bonusSpecial ?? 0;
		exp = data.exp ?? 0;
		totalExp = data.totalExp ?? 0;
		totalDraw = data.totalDraw ?? 0;
		elapsedTime = data.elapsedTime ?? 0;
	} catch (e) {
		console.warn("セーブデータ読み込み失敗:", e);
	}
}

/* ==================== 初期化／リトライ ==================== */
function resetGame() {
	clearFlg = false;
	startTime = Date.now();
	clearTime = Date.now();
	stage = initFlg ? MAX_STAGE : 1;
	drawCount = 1 + bonusDraw;
	startFlg = true;
	loadData();
	syncDisplayExp(true);
	LAYOUT = computeLayout();
	generateNewLotteryPool();
	rebuildBalls();
}

function fullResetGame() {
	for (const key in stageStats) delete stageStats[key];
	elapsedTime = 0;
	exp = 0;
	bonusWin = 0;
	bonusDraw = 0;
	bonusGain = 0;
	bonusSpecial = 0;
	totalDraw = 0;
	totalExp = 0;
	winStreak = 0;
	maxWinStreak = 0;
	rainbowMode = false;
	isBonusTime = false;
	bonusTimerMs = 0;
	startFlg = true;
	initFlg = true;
	localStorage.removeItem(STORAGE_KEY);
	resetGame();
}

/* ==================== 強化ボタン定義 ==================== */
const UPGRADES = [
	{ key: 'win', labelKey: 'upgradeWinLabel', icon: '🎯', baseCost: 10, getLevel: () => bonusWin, apply: () => { bonusWin++; generateNewLotteryPool(); rebuildBalls(); } },
	{ key: 'draw', labelKey: 'upgradeDrawLabel', icon: '🎫', baseCost: 20, getLevel: () => bonusDraw, apply: () => { bonusDraw++; drawCount++; } },
	{ key: 'gain', labelKey: 'upgradeGainLabel', icon: '📈', baseCost: 50, getLevel: () => bonusGain, apply: () => { bonusGain++; } },
	{ key: 'special', labelKey: 'upgradeSpecialLabel', icon: '⭐', baseCost: 77, getLevel: () => bonusSpecial, apply: () => { bonusSpecial++; } },
];
let resultRestartRect = null;
let resultContinueRect = null;

/* ==================== 入力 ==================== */
function canvasPos(clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) };
}

canvas.addEventListener("pointerdown", (e) => {
	e.preventDefault();
	const p = canvasPos(e.clientX, e.clientY);

	if (hitTestBtn(LAYOUT.langBtn, p.x, p.y)) {
		setLang(lang === "ja" ? "en" : "ja");
		return;
	}

	if (clearFlg) {
		if (resultRestartRect && hitTestBtn(resultRestartRect, p.x, p.y)) {
			pressAnim('resultRestart');
			fullResetGame();
		} else if (resultContinueRect && hitTestBtn(resultContinueRect, p.x, p.y)) {
			pressAnim('resultContinue');
			resetGame();
		}
		return;
	}

	if (hitTestBtn(LAYOUT.resetBtn, p.x, p.y)) {
		const confirmReset = confirm(t("resetConfirm"));
		if (confirmReset) {
			pressAnim('reset');
			fullResetGame();
		}
		return;
	}

	if (hitTestBtn(LAYOUT.drawBtn, p.x, p.y)) {
		pressAnim('drawBtn');
		drawLottery();
		return;
	}

	for (let i = 0; i < UPGRADES.length; i++) {
		const u = UPGRADES[i];
		const rect = LAYOUT.upgrades[i];
		if (hitTestBtn(rect, p.x, p.y)) {
			const cost = getUpgradeCost(u.baseCost, u.getLevel());
			if (exp >= cost && !clearFlg) {
				pressAnim(u.key);
				spendExp(cost);
				u.apply();
				LAYOUT = computeLayout();
				rebuildBalls();
				saveData();
			}
			return;
		}
	}
});

/* ==================== 描画：背景／ロードマップ ==================== */
function lerpColor(c1, c2, p) {
	const n1 = parseInt(c1.slice(1), 16), n2 = parseInt(c2.slice(1), 16);
	const r1 = (n1 >> 16) & 255, g1 = (n1 >> 8) & 255, b1 = n1 & 255;
	const r2 = (n2 >> 16) & 255, g2 = (n2 >> 8) & 255, b2 = n2 & 255;
	const r = Math.round(r1 + (r2 - r1) * p), g = Math.round(g1 + (g2 - g1) * p), b = Math.round(b1 + (b2 - b1) * p);
	return `rgb(${r},${g},${b})`;
}

// ステージが進むほど背景上部の色を黒灰色から金赤系へ寄せ、緊張感を高める。Lv10だけ専用の深紅背景にする。
function drawBg() {
	const bg = ctx.createLinearGradient(0, 0, 0, H);
	if (stage >= MAX_STAGE) {
		bg.addColorStop(0, "#3d1608");
		bg.addColorStop(0.55, "#1c0a04");
		bg.addColorStop(1, "#050200");
	} else {
		const p = Math.max(0, (stage - 1) / (MAX_STAGE - 1));
		bg.addColorStop(0, lerpColor("#242424", "#3a1c08", p));
		bg.addColorStop(1, "#0a0a0a");
	}
	ctx.fillStyle = bg;
	// 画面シェイク中にcanvas端で背景の塗り残しが出ないよう、少し広めに塗る
	ctx.fillRect(-10, -10, W + 20, H + 20);
}

function drawRoadmapCard() {
	const r = LAYOUT.roadmap;
	fillRoundRect(r.x, r.y, r.w, r.h, 4, COLORS.panelBg);
	strokeRoundRect(r.x, r.y, r.w, r.h, 4, COLORS.panelBorder, 2);

	// ステージ表示は角丸バッジの上に乗せて目立たせる。オッズ「[1/1024]」も同じバッジの中に含める。
	const stageLabel = t("stageFmt")(stage);
	const oddsLabel = t("stageOddsFmt")(stage);
	const badgeX = r.x + 8, badgeY = r.y + 5, badgeH = 20;
	const stageW = measureTextWidth(stageLabel, 12, "bold");
	const oddsW = measureTextWidth(oddsLabel, 10, "");
	const badgeGap = 6;
	const badgeW = 10 + stageW + badgeGap + oddsW + 10;
	fillRoundRect(badgeX, badgeY, badgeW, badgeH, 6, "#3a0000");
	strokeRoundRect(badgeX, badgeY, badgeW, badgeH, 6, "#ff3333", 1.2, "#ff3333");
	drawText(stageLabel, badgeX + 10, badgeY + badgeH / 2 + 1, {
		size: 12, weight: "bold", color: "#ffcc00", align: "left", baseline: "middle", glow: "#ff8800", glowBlur: 4,
	});
	drawText(oddsLabel, badgeX + 10 + stageW + badgeGap, badgeY + badgeH / 2 + 1, {
		size: 10, color: "#eeeeee", align: "left", baseline: "middle",
	});

	const startX = r.x + 16, endX = r.x + r.w - 16, ny = r.y + r.h - 15;
	ctx.save();
	ctx.strokeStyle = "#333333";
	ctx.lineWidth = 3;
	ctx.beginPath(); ctx.moveTo(startX, ny); ctx.lineTo(endX, ny); ctx.stroke();
	ctx.restore();
	for (let i = 1; i <= MAX_STAGE; i++) {
		const nx = startX + (endX - startX) * (i - 1) / (MAX_STAGE - 1);
		const done = i < stage, current = i === stage;
		ctx.save();
		if (current || done) { ctx.shadowColor = "#ff3333"; ctx.shadowBlur = current ? 8 : 4; }
		ctx.beginPath(); ctx.arc(nx, ny, current ? 7 : 4.5, 0, Math.PI * 2);
		ctx.fillStyle = current ? "#ff3333" : done ? "#ffcc00" : "#333333";
		ctx.fill();
		ctx.restore();
	}
}

function drawResetButton() {
	const r = LAYOUT.resetBtn;
	drawScaled('reset', r.x + r.w / 2, r.y + r.h / 2, () => {
		fillRoundRect(r.x, r.y, r.w, r.h, 4, "#1a1a1a");
		strokeRoundRect(r.x, r.y, r.w, r.h, 4, "#666666", 1);
		const size = fitFontSize(t("resetLabel"), r.w - 8, 10, "bold");
		drawText(t("resetLabel"), r.x + r.w / 2, r.y + r.h / 2 + 1, {
			size, weight: "bold", color: "#cccccc", align: "center", baseline: "middle",
		});
	});
}
function drawLangButton() {
	const r = LAYOUT.langBtn;
	fillRoundRect(r.x, r.y, r.w, r.h, 4, "#1a1a1a");
	strokeRoundRect(r.x, r.y, r.w, r.h, 4, "#666666", 1);
	const size = fitFontSize(t("langBtn"), r.w - 8, 10, "bold");
	drawText(t("langBtn"), r.x + r.w / 2, r.y + r.h / 2 + 1, {
		size, weight: "bold", color: "#cccccc", align: "center", baseline: "middle",
	});
}

/* ==================== 描画：くじ玉（電球ランプ風） ==================== */
function drawBalls() {
	const box = LAYOUT.ballBox;
	// 玉が並ぶメインエリアの背景も、drawBg()と同じ考え方でステージが進むほど赤みを帯びさせる。
	// パネルの黒背景だけでは画面のほとんどが覆われて変化が見えないため、ここも連動させる。
	const boxBg = stage >= MAX_STAGE
		? "#2a0800"
		: lerpColor("#000000", "#1f0800", Math.max(0, (stage - 1) / (MAX_STAGE - 1)));
	fillRoundRect(box.x, box.y, box.w, box.h, 4, boxBg);
	strokeRoundRect(box.x, box.y, box.w, box.h, 4, COLORS.panelBorder, 3);
	strokeRoundRect(box.x + 4, box.y + 4, box.w - 8, box.h - 8, 2, "#3a2a10", 1);

	for (const b of balls) {
		const type = currentLotteryPool[b.index];
		const glow = (usedFlags[b.index] && b.revealed) ? null : (type === 'gold' || type === 'win' ? ballColor(b) : null);
		ctx.save();
		ctx.globalAlpha = b.alpha;
		if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 10; }
		ctx.beginPath();
		ctx.arc(b.x + b.offsetX, b.y, Math.max(0, b.r * b.scale), 0, Math.PI * 2);
		ctx.fillStyle = ballColor(b);
		ctx.fill();
		ctx.restore();
		ctx.save();
		ctx.globalAlpha = b.alpha;
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(b.x + b.offsetX, b.y, Math.max(0, b.r * b.scale), 0, Math.PI * 2);
		ctx.stroke();
		// ハイライト（電球のガラス反射）
		ctx.beginPath();
		ctx.arc(b.x + b.offsetX - b.r * 0.3, b.y - b.r * 0.3, Math.max(0, b.r * b.scale * 0.25), 0, Math.PI * 2);
		ctx.fillStyle = "rgba(255,255,255,0.45)";
		ctx.fill();
		ctx.restore();
	}
}

/* ==================== 描画：連続当たりバッジ／Lv10煽り／ボーナスタイム ==================== */
function drawEventOverlays() {
	const box = LAYOUT.ballBox;
	if (winStreak > 1) {
		const label = t("streakFmt")(winStreak);
		const tw = measureTextWidth(label, 11, "bold");
		const bw = tw + 20, bh = 22, bx = box.x + box.w - bw - 8, by = box.y + 8;
		ctx.save();
		ctx.globalAlpha = blinkStreak.alpha;
		fillRoundRect(bx, by, bw, bh, 11, "#1a1a1a");
		strokeRoundRect(bx, by, bw, bh, 11, "#ff3333", 1.5, "#ff3333");
		drawText(label, bx + bw / 2, by + bh / 2 + 1, {
			size: 11, weight: "bold", color: "#ff3333", align: "center", baseline: "middle", glow: "#ff3333", glowBlur: 4,
		});
		ctx.restore();
	}

	if (stage === MAX_STAGE) {
		ctx.save();
		ctx.globalAlpha = blinkFirst.alpha;
		drawText(t("titleFirst"), box.x + box.w / 2, box.y + box.h * 0.38, {
			size: Math.min(34, box.w * 0.11), weight: "bold", color: "#ffcc00", align: "center", baseline: "middle",
			stroke: "#000000", strokeWidth: 4, glow: "#ff8800", glowBlur: 10,
		});
		ctx.restore();
		ctx.save();
		ctx.globalAlpha = blinkFinal.alpha;
		drawText(t("titleFinal"), box.x + box.w / 2, box.y + box.h * 0.58, {
			size: Math.min(28, box.w * 0.09), weight: "bold", color: "#ffcc00", align: "center", baseline: "middle",
			stroke: "#000000", strokeWidth: 4, glow: "#ff8800", glowBlur: 10,
		});
		ctx.restore();
	}

	// ボーナスタイムは玉やLv10煽りテキストと重なっても違和感がないよう、
	// 円グラフ型のタイマー（半透明）とその下の短いラベルだけにする。中央の大きなテキストは置かない。
	if (isBonusTime) {
		const cx = box.x + box.w / 2, cy = box.y + box.h * 0.8, r2 = 22;
		ctx.save();
		ctx.globalAlpha = 0.85;
		ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(10,10,10,0.55)";
		ctx.fill();
		ctx.strokeStyle = "#333333"; ctx.lineWidth = 5;
		ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI * 2); ctx.stroke();
		const frac = Math.max(0, bonusTimerMs / BONUS_TIME_MS);
		ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 5; ctx.lineCap = "round";
		ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = 8;
		ctx.beginPath(); ctx.arc(cx, cy, r2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
		ctx.restore();
		const secDisplay = Math.max(0, Math.ceil(bonusTimerMs / 1000) - 1);
		drawText(`${secDisplay}`, cx, cy, {
			size: 16, weight: "bold", color: "#ffcc00", align: "center", baseline: "middle",
		});
		ctx.save();
		ctx.globalAlpha = blinkBonusMsg.alpha;
		drawText(t("bonusLeftLabel"), cx - r2 - 8, cy, {
			size: 19, weight: "bold", color: "#ffcc00", align: "right", baseline: "middle", stroke: "#000000", strokeWidth: 3, glow: "#ff8800", glowBlur: 8,
		});
		drawText(t("bonusRightLabel"), cx + r2 + 8, cy, {
			size: 21, weight: "bold", color: "#ffcc00", align: "left", baseline: "middle", stroke: "#000000", strokeWidth: 3, glow: "#ff8800", glowBlur: 8,
		});
		ctx.restore();
	} else if (tempMsgShowing) {
		ctx.save();
		ctx.globalAlpha = blinkTempMsg.alpha * 0.35 + 0.65;
		drawText(t("bonusTimeEndLabel"), box.x + box.w / 2, box.y + box.h * 0.8, {
			size: 18, weight: "bold", color: "#ffee88", align: "center", baseline: "middle", stroke: "#000000", strokeWidth: 3.5, glow: "#ffcc00", glowBlur: 8,
		});
		ctx.restore();
	}
}

/* ==================== 描画：CREDIT ==================== */
function drawInfoCard() {
	const r = LAYOUT.infoCard;
	fillRoundRect(r.x, r.y, r.w, r.h, 4, COLORS.panelBg);
	strokeRoundRect(r.x, r.y, r.w, r.h, 4, COLORS.panelBorder, 1.5);

	// CREDITはラベルの右に数字を横並びで大きく表示する（元の配置のまま数字だけ拡大）。
	// ラベルと数字はbaseline"alphabetic"を使い、同じY座標を指定することで文字の底の位置を揃える。
	const lx = r.x + 12, creditBaseY = r.y + 8 + 9;
	drawText(t("creditLabel"), lx, creditBaseY, { size: 9, weight: "bold", color: "#dddddd", align: "left", baseline: "alphabetic" });
	const creditLabelW = measureTextWidth(t("creditLabel"), 9, "bold");
	drawText(t("drawRemainFmt")(drawCount), lx + creditLabelW + 8, creditBaseY, {
		size: 16, weight: "bold", color: "#ffcc00", align: "left", baseline: "alphabetic", glow: "#ff8800", glowBlur: 5,
	});

	const perRow = r.perRow, gap = 4, rowGap = 4, boxSize = r.boxSize;
	const drawMax = 1 + bonusDraw;
	const boxesY = r.y + r.creditRowH;
	for (let i = 0; i < drawMax; i++) {
		const row = Math.floor(i / perRow), col = i % perRow;
		const bx = lx + col * (boxSize + gap), by = boxesY + row * (boxSize + rowGap);
		const active = i < drawCount;
		ctx.save();
		if (active) { ctx.shadowColor = COLORS.creditActive; ctx.shadowBlur = 4; }
		fillRoundRect(bx, by, boxSize, boxSize, 2, active ? COLORS.creditActive : COLORS.creditInactive);
		ctx.restore();

		const flash = creditBoxFlashes.find(f => f.index === i);
		if (flash) {
			ctx.save();
			const cx = bx + boxSize / 2, cy = by + boxSize / 2;
			ctx.translate(cx, cy);
			ctx.scale(flash.scale, flash.scale);
			ctx.translate(-cx, -cy);
			ctx.globalAlpha = flash.alpha;
			ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 10;
			fillRoundRect(bx, by, boxSize, boxSize, 2, "#ffffff");
			ctx.restore();
		}
	}

	// 確率の円グラフは元通りCREDITと同じカードの右側に。「成功率」ラベルはCREDITラベルと同じ高さ・
	// 同じbaselineに揃えて文字の底の位置を合わせる。
	const ringR = r.ringR, ringX = r.x + r.w - 42, ringY = r.y + r.h / 2 + 8;
	drawText(t("chancePctSuffix"), ringX, creditBaseY, { size: 9, weight: "bold", color: "#dddddd", align: "center", baseline: "alphabetic" });
	ctx.save();
	ctx.strokeStyle = "#333333"; ctx.lineWidth = 6;
	ctx.beginPath(); ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2); ctx.stroke();
	const frac = displayedProb.rate;
	ctx.strokeStyle = "#ff3333"; ctx.lineWidth = 6; ctx.lineCap = "round";
	ctx.beginPath(); ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
	ctx.restore();
	const percent = (displayedProb.rate * 100).toFixed(1);
	drawText(`${percent}%`, ringX, ringY + 1, {
		size: 15, weight: "bold", color: "#ffcc00", align: "center", baseline: "middle", glow: "#ff8800", glowBlur: 4,
	});
}

/* ==================== 描画：くじを引く（PUSH）ボタン ==================== */
function drawDrawButton() {
	const r = LAYOUT.drawBtn;
	drawScaled('drawBtn', r.x + r.w / 2, r.y + r.h / 2, () => {
		fillRoundRect(r.x, r.y + 4, r.w, r.h, 8, "#661111");
		const bg = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
		bg.addColorStop(0, "#ff5555"); bg.addColorStop(1, "#cc0000");
		fillRoundRect(r.x, r.y, r.w, r.h, 8, bg);
		strokeRoundRect(r.x, r.y, r.w, r.h, 8, "#ffcc00", 2);
		drawText(t("drawBtn"), r.x + r.w / 2, r.y + r.h / 2 + 1, {
			size: 20, weight: "bold", color: "#ffffff", align: "center", baseline: "middle",
		});
	});
}

/* ==================== 描画：SCORE＋強化ボタン ==================== */
function drawExpAndUpgrades() {
	const r = LAYOUT.expBar;
	fillRoundRect(r.x, r.y, r.w, r.h, 4, "#000000");
	strokeRoundRect(r.x, r.y, r.w, r.h, 4, COLORS.panelBorder, 1.5);
	drawText(t("expLabel"), r.x + 12, r.y + r.h / 2, { size: 11, weight: "bold", color: "#dddddd", align: "left", baseline: "middle" });
	// SCOREの数字は中央寄せ。ドラムロール風にexpへ滑らかに追従する表示値(displayExpObj)を使う。
	drawText(`${String(Math.floor(displayExpObj.value)).padStart(6, '0')}`, r.x + r.w / 2, r.y + r.h / 2, {
		size: 18, weight: "bold", color: COLORS.scoreColor, align: "center", baseline: "middle", glow: "#ffcc00", glowBlur: 6,
	});

	for (let i = 0; i < UPGRADES.length; i++) {
		const u = UPGRADES[i];
		const rect = LAYOUT.upgrades[i];
		const level = u.getLevel();
		const cost = getUpgradeCost(u.baseCost, level);
		const canAfford = exp >= cost && !clearFlg;
		drawScaled(u.key, rect.x + rect.w / 2, rect.y + rect.h / 2, () => {
			fillRoundRect(rect.x, rect.y, rect.w, rect.h, 4, canAfford ? COLORS.upgradeOnBg : COLORS.upgradeOffBg);
			strokeRoundRect(rect.x, rect.y, rect.w, rect.h, 4, canAfford ? COLORS.upgradeOnBorder : COLORS.upgradeOffBorder, 1.2);
			drawText(`${u.icon} ${t(u.labelKey)}`, rect.x + 10, rect.y + 9, {
				size: 12, weight: "bold", color: canAfford ? "#ffcc00" : "#777777", align: "left", baseline: "top",
			});
			drawText(t("upgradeLevelFmt")(level), rect.x + rect.w - 10, rect.y + 9, {
				size: 10, weight: "bold", color: "#ffffff", align: "right", baseline: "top", stroke: "#000000", strokeWidth: 2.5,
			});
			const barX = rect.x + 10, barY = rect.y + 28, barW = rect.w - 20, barH = 8;
			fillRoundRect(barX, barY, barW, barH, 4, "#000000");
			const p = Math.max(0, Math.min(1, exp / cost));
			fillRoundRect(barX, barY, Math.max(4, barW * p), barH, 4, canAfford ? "#ff3333" : "#663333");
			drawText(t("upgradeCostFmt")(cost), rect.x + rect.w - 10, rect.y + rect.h - 8, {
				size: 9, weight: "bold", color: "#ffffff", align: "right", baseline: "bottom", stroke: "#000000", strokeWidth: 2.5,
			});
		});
	}
}

/* ==================== 描画：一時ポップアップ演出 ==================== */
function drawPopupFx() {
	if (!popupFx) return;
	const fx = popupFx;
	ctx.save();
	if (fx.kind === 'aura') {
		ctx.globalAlpha = fx.auraAlpha;
		if (fx.big) {
			// 大当たり時は放射状の光条を追加してジャックポットらしい派手さを出す
			ctx.save();
			ctx.translate(fx.cx, fx.cy - 10);
			ctx.scale(fx.auraScale, fx.auraScale);
			ctx.fillStyle = fx.color;
			for (let i = 0; i < 10; i++) {
				ctx.rotate(Math.PI / 5);
				ctx.beginPath();
				ctx.moveTo(-5, 0);
				ctx.lineTo(5, 0);
				ctx.lineTo(0, -42);
				ctx.closePath();
				ctx.fill();
			}
			ctx.restore();
		}
		ctx.beginPath();
		ctx.arc(fx.cx, fx.cy - 10, 30 * fx.auraScale, 0, Math.PI * 2);
		ctx.fillStyle = fx.color;
		ctx.fill();
	}
	ctx.restore();

	ctx.save();
	ctx.globalAlpha = fx.textAlpha;
	ctx.translate(fx.cx, fx.cy + fx.textY);
	ctx.rotate(fx.textRotation);
	if (fx.kind === 'hazure') {
		drawText(fx.text, 0, 0, {
			size: 26, weight: "bold", color: fx.color, align: "center", baseline: "middle", stroke: "#000000", strokeWidth: 3.5, glow: "#5577aa", glowBlur: 6,
		});
	} else {
		drawText(fx.text, 0, 0, {
			size: fx.big ? 34 : 28, weight: "bold", color: "#ffffff", align: "center", baseline: "middle",
			stroke: "#000000", strokeWidth: 4, glow: fx.color, glowBlur: fx.big ? 22 : 12,
		});
	}
	ctx.restore();
}

/* ==================== メイン描画 ==================== */
function drawGame() {
	ctx.save();
	ctx.translate(screenShakeObj.x, screenShakeObj.y);

	drawBg();
	drawRoadmapCard();

	if (!clearFlg) {
		drawBalls();
		drawWinParticles();
		drawEventOverlays();
	}

	if (flashObj.alpha > 0) {
		ctx.save();
		ctx.globalAlpha = flashObj.alpha;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(-10, -10, W + 20, H + 20);
		ctx.restore();
	}

	drawPopupFx();
	drawInfoCard();
	drawResetButton();
	drawLangButton();
	drawDrawButton();
	drawExpAndUpgrades();

	if (clearFlg) drawResultOverlay();

	ctx.restore();
}

// 1行内に「ステージ表示」＋「回数/勝敗内訳」を並べる。英語表記は日本語より長くなりがちなので、
// ステージ表示の実測幅からstats側の開始xを動的に決め、収まらない場合はさらにfitFontSizeで縮小する。
// WIN/MISSはW/Mの略記だと分かりにくいためフル単語にし、さらにWINを金色・MISSをグレーで色分けして視認性を上げる。
function drawResultStageLine(sNum, stats, x, y, boxRight) {
	const stageLabel = t("resultStageFmt")(sNum);
	drawText(stageLabel, x, y, { size: 14, color: "#dddddd", align: "left", baseline: "top" });
	const stageW = measureTextWidth(stageLabel, 14, "");
	const statsX = Math.max(x + 85, x + stageW + 10);
	const maxStatsW = Math.max(40, boxRight - statsX - 10);

	const drawLabel = t("resultStageDrawFmt")(stats.draw);
	const winPart = `${t("resultWinLabel")} ${stats.win}`;
	const sep = " / ";
	const missPart = `${t("resultMissLabel")} ${stats.lose}`;
	const fullText = drawLabel + "  " + winPart + sep + missPart;
	const size = fitFontSize(fullText, maxStatsW, 14, "");

	let cx = statsX;
	drawText(drawLabel, cx, y, { size, color: "#dddddd", align: "left", baseline: "top" });
	cx += measureTextWidth(drawLabel + "  ", size, "");
	drawText(winPart, cx, y, { size, weight: "bold", color: "#ffcc00", align: "left", baseline: "top" });
	cx += measureTextWidth(winPart, size, "bold");
	drawText(sep, cx, y, { size, color: "#666666", align: "left", baseline: "top" });
	cx += measureTextWidth(sep, size, "");
	drawText(missPart, cx, y, { size, color: "#999999", align: "left", baseline: "top" });
}

// ラベル＋回数を1つの文字列としてfitFontSizeで縮小することで、英語表記が長くなっても重ならないようにする。
function drawResultUpgradeItem(labelKey, count, x, y, maxWidth) {
	const text = `${t(labelKey)}${t("upgradeResultCountFmt")(count)}`;
	const size = fitFontSize(text, maxWidth, 14, "");
	drawText(text, x, y, { size, color: "#dddddd", align: "left", baseline: "top" });
}

function drawResultParticles() {
	const t2 = resultElapsedMs / 1000;
	for (const p of resultParticles) {
		const alpha = (Math.sin(t2 * p.speed * 2 + p.phase) + 1) / 2;
		const yOff = Math.sin(t2 * p.speed * 0.7 + p.phase) * 12;
		ctx.save();
		ctx.globalAlpha = 0.25 + alpha * 0.65;
		ctx.shadowColor = p.color; ctx.shadowBlur = 5;
		ctx.beginPath();
		ctx.arc(p.x, p.y + yOff, p.r, 0, Math.PI * 2);
		ctx.fillStyle = p.color;
		ctx.fill();
		ctx.restore();
	}
}

function drawResultTitleBadge(titleKey, cx, cy, gorgeous) {
	const text = t(titleKey);
	const size = gorgeous ? 20 : 18;
	const tw = measureTextWidth(text, size, "bold");
	const badgeW = tw + 56, badgeH = 34;
	ctx.save();
	ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = gorgeous ? 16 : 8;
	strokeRoundRect(cx - badgeW / 2, cy - badgeH / 2, badgeW, badgeH, badgeH / 2, "#ffcc00", 1.5);
	ctx.restore();
	fillRoundRect(cx - badgeW / 2 + 2, cy - badgeH / 2 + 2, badgeW - 4, badgeH - 4, badgeH / 2, "rgba(255,204,0,0.08)");
	// 左右の小さなダイヤ装飾（絵文字の代わりのゴージャス演出）
	drawDiamond(cx - badgeW / 2 + 14, cy, 5, "#ffcc00");
	drawDiamond(cx + badgeW / 2 - 14, cy, 5, "#ffcc00");
	drawText(text, cx, cy + 1, {
		size, weight: "bold", color: "#ffcc00", align: "center", baseline: "middle", stroke: "#000000", strokeWidth: 4, glow: "#ff8800", glowBlur: gorgeous ? 16 : 8,
	});
}
function drawDiamond(cx, cy, r, color) {
	ctx.save();
	ctx.shadowColor = color; ctx.shadowBlur = 6;
	ctx.beginPath();
	ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.restore();
}

function drawResultOverlay() {
	drawResultParticles();

	const boxY = 70, boxX = 20, boxW = 320;
	fillRoundRect(boxX, boxY, boxW, 470, 12, "rgba(10,10,10,0.95)");
	ctx.save();
	ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = 10;
	strokeRoundRect(boxX, boxY, boxW, 470, 12, COLORS.panelBorder, 2);
	ctx.restore();

	const titleKey = initFlg ? "resultTitlePerfect" : "resultTitle";
	drawResultTitleBadge(titleKey, 180, boxY + 25, initFlg);

	let y = 50;
	if (initFlg) {
		y += 100;
		const stats = stageStats[MAX_STAGE] || { draw: 0, win: 0, lose: 0 };
		drawResultStageLine(MAX_STAGE, stats, 50, boxY + y, boxX + boxW - 10);
		y += 100;
	} else {
		const stages = Object.keys(stageStats).map(Number).sort((a, b) => a - b);
		for (const sNum of stages) {
			drawResultStageLine(sNum, stageStats[sNum], 30, boxY + y, boxX + boxW - 10);
			y += 25;
		}
	}
	y += 5;

	drawText(t("resultTotalFmt")(totalDraw, Math.floor(totalExp)), 30, boxY + y, { size: 16, color: "#ff6666", align: "left", baseline: "top" });

	const elapsed = elapsedTime;
	const hours = Math.floor(elapsed / 3600000);
	const minutes = Math.floor((elapsed % 3600000) / 60000);
	const seconds = Math.floor((elapsed % 60000) / 1000);
	const timeString = `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;

	drawText(t("resultStreakFmt")(maxWinStreak), 30, boxY + y + 30, { size: 14, weight: "bold", color: "#dddddd", align: "left", baseline: "top" });
	drawText(t("resultTimeFmt")(timeString), 30 + 160, boxY + y + 30, { size: 14, color: "#dddddd", align: "left", baseline: "top" });

	drawResultUpgradeItem("upgradeResultWin", bonusWin, 25, boxY + y + 60, 150);
	drawResultUpgradeItem("upgradeResultDraw", bonusDraw, 25 + 160, boxY + y + 60, 150);
	drawResultUpgradeItem("upgradeResultGain", bonusGain, 25, boxY + y + 80, 150);
	drawResultUpgradeItem("upgradeResultSpecial", bonusSpecial, 25 + 160, boxY + y + 80, 150);

	resultRestartRect = { x: 50, y: boxY + y + 110, w: 120, h: 40 };
	resultContinueRect = { x: 190, y: boxY + y + 110, w: 120, h: 40 };

	drawScaled('resultRestart', resultRestartRect.x + resultRestartRect.w / 2, resultRestartRect.y + resultRestartRect.h / 2, () => {
		fillRoundRect(resultRestartRect.x, resultRestartRect.y, resultRestartRect.w, resultRestartRect.h, 8, COLORS.restartBtn);
		drawText(t("restartBtn"), resultRestartRect.x + resultRestartRect.w / 2, resultRestartRect.y + resultRestartRect.h / 2 + 1, {
			size: 14, color: "#ffffff", align: "center", baseline: "middle",
		});
	});
	drawScaled('resultContinue', resultContinueRect.x + resultContinueRect.w / 2, resultContinueRect.y + resultContinueRect.h / 2, () => {
		fillRoundRect(resultContinueRect.x, resultContinueRect.y, resultContinueRect.w, resultContinueRect.h, 8, COLORS.continueBtn);
		drawText(t("continueBtn"), resultContinueRect.x + resultContinueRect.w / 2, resultContinueRect.y + resultContinueRect.h / 2 + 1, {
			size: 14, color: "#ffffff", align: "center", baseline: "middle",
		});
	});
}

/* ==================== メインループ ==================== */
let lastTime = performance.now();
function frame(now) {
	const dt = Math.min(now - lastTime, 100);
	lastTime = now;
	updateTweens(dt);
	updateTimers(dt);
	if (clearFlg) resultElapsedMs += dt;

	drawGame();

	requestAnimationFrame(frame);
}

/* ==================== 起動 ==================== */
resetGame();
requestAnimationFrame(frame);
