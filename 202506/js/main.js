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
	const style = opts.italic ? "italic" : "";
	const align = opts.align || "left";
	const baseline = opts.baseline || "alphabetic";
	const lineHeight = opts.lineHeight || size * 1.2;
	ctx.save();
	ctx.font = `${style} ${weight} ${size}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`.trim();
	ctx.textAlign = align;
	ctx.textBaseline = baseline;
	String(text).split("\n").forEach((line, i) => {
		const ly = y + i * lineHeight;
		if (opts.shadowColor) {
			ctx.shadowColor = opts.shadowColor;
			ctx.shadowBlur = opts.shadowBlur || 0;
			ctx.shadowOffsetX = opts.shadowOffsetX || 0;
			ctx.shadowOffsetY = opts.shadowOffsetY || 0;
		}
		if (opts.stroke) {
			ctx.lineWidth = opts.strokeWidth || 3;
			ctx.strokeStyle = opts.stroke;
			ctx.lineJoin = "round";
			ctx.strokeText(line, x, ly);
		}
		ctx.shadowColor = "transparent";
		if (opts.gradient) {
			const grad = ctx.createLinearGradient(x, ly - size * 0.6, x, ly + size * 0.6);
			opts.gradient.forEach((c, gi) => grad.addColorStop(gi / (opts.gradient.length - 1), c));
			ctx.fillStyle = grad;
		} else {
			ctx.fillStyle = opts.color || "#000";
		}
		ctx.fillText(line, x, ly);
	});
	ctx.restore();
}

function measureTextWidth(text, size, weight, italic) {
	ctx.save();
	ctx.font = `${italic ? "italic" : ""} ${weight || ""} ${size}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`.trim();
	const w = ctx.measureText(text).width;
	ctx.restore();
	return w;
}

function fitFontSize(text, maxWidth, initialSize, weight, italic) {
	let size = initialSize;
	while (size > 8) {
		if (measureTextWidth(text, size, weight, italic) <= maxWidth) break;
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

function lerp(a, b, t) { return a + (b - a) * t; }

/* ==================== イージング関数 ==================== */
function easeLinear(p) { return p; }
function easePower1Out(p) { return 1 - (1 - p) * (1 - p); }
function easePower2Out(p) { return 1 - Math.pow(1 - p, 3); }
function easeSineInOut(p) { return -(Math.cos(Math.PI * p) - 1) / 2; }
function easeBounceOut(p) {
	const n1 = 7.5625, d1 = 2.75;
	if (p < 1 / d1) return n1 * p * p;
	if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
	if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
	return n1 * (p -= 2.625 / d1) * p + 0.984375;
}
// 原作のsine往復ウェーブ（移動壁の"linear"タイプ専用）
function easeSineWave(tSec, durationSec) {
	return (Math.sin((tSec / durationSec) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
}

/* ==================== Tweenシステム（実時間ベース） ==================== */
// setTimeout等の実時計に頼らず、フレームループのdeltaだけで駆動する。
// これによりテスト時の手動フレーム送り（frame()を任意回数呼ぶ手法）でも
// delay付き演出まで含めて確定的に検証できる。
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
// duration=0（1msに丸め）のワンショットタイマーとしても使う（星の発生間隔など）
function callAfter(delayMs, onComplete) {
	return tween({}, {}, 1, { delay: delayMs, onComplete });
}
// ステージ切り替え時などに、対象オブジェクトに紐づく進行中のtweenを打ち切る。
// 打ち切らずに放置すると、後から値をsetし直しても古いtweenが毎フレーム上書きしてしまう。
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
			dtForThis = -tw.delay; // 遅延を使い切った後の余り分だけ経過させる
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

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う。 */
const BTN_LANG = { x: 245, y: 33, w: 108, h: 22 }; // 旧CSS(#lang-btn: top6%/left68%/w30%/h4%)をW×H基準pxへ変換

function hitTestBtn(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function drawButton(rect, label, opts) {
	opts = opts || {};
	fillRoundRect(rect.x, rect.y, rect.w, rect.h, opts.radius || 6, opts.bg || "rgba(0,0,0,0.6)");
	if (label) {
		drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
			size: opts.size || 14, weight: "bold", align: "center", baseline: "middle",
			color: opts.color || "#fff",
		});
	}
}

function drawLangButton() {
	drawButton(BTN_LANG, t("langBtn"), { bg: "rgba(255,255,255,0.85)", size: 10, color: "#333333", radius: 6 });
}

document.title = t("pageTitle");
document.addEventListener("langchange", () => { document.title = t("pageTitle"); });

/* ==================== ゲーム定数 ==================== */
const CELL = 20;
const GAME_HEIGHT = 460;
const CONTROL_HEIGHT = 100;
const UI_HEIGHT = 40;
const PLAYER_SPEED = 120; // px/秒（原作は2px/フレーム@60fps相当）

/* ==================== ステージ定義（原作のまま） ==================== */
const stages = [
	{
		start: { x: 2, y: 4 },
		goal: { x: 13, y: 18 },
		walls: [[6, 10], [6, 9], [7, 9], [11, 9], [10, 9], [9, 9], [8, 9], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [11, 11], [10, 11], [9, 11], [8, 11], [7, 11], [6, 11], [6, 12], [7, 13], [8, 13], [9, 13], [10, 13], [11, 13], [11, 12], [10, 12], [9, 12], [8, 12], [7, 12], [6, 13], [6, 14], [7, 14], [9, 14], [10, 14], [11, 14], [6, 15], [6, 16], [17, 1], [17, 2], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [18, 9], [17, 8], [17, 9], [17, 10], [18, 10], [18, 11], [18, 13], [17, 12], [17, 11], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [18, 18], [17, 19], [17, 20], [17, 21], [17, 22], [17, 23], [0, 22], [0, 21], [0, 20], [0, 19], [0, 18], [0, 17], [0, 16], [0, 15], [0, 14], [0, 13], [0, 12], [0, 11], [0, 10], [0, 9], [0, 8], [0, 7], [0, 6], [0, 5], [0, 4], [0, 3], [0, 2], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [0, 23], [1, 23], [2, 23], [3, 23], [4, 23], [5, 23], [6, 23], [7, 23], [8, 23], [9, 23], [10, 23], [11, 23], [12, 23], [13, 23], [14, 23], [15, 23], [16, 23], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [1, 22], [2, 22], [3, 22], [4, 22], [5, 22], [8, 22], [10, 22], [11, 22], [12, 22], [13, 22], [14, 22], [15, 22], [16, 22], [9, 22], [7, 22], [6, 22], [11, 8], [11, 7], [8, 14], [10, 8], [10, 7], [7, 16], [7, 15], [9, 8], [9, 7], [8, 15], [8, 16]],
		movingWalls: []
	},
	{
		start: { x: 2, y: 4 },
		goal: { x: 4, y: 19 },
		walls: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [11, 2], [10, 2], [9, 2], [8, 2], [7, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 15], [0, 17], [0, 18], [0, 19], [0, 20], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [16, 22], [15, 22], [14, 22], [13, 22], [12, 22], [11, 22], [10, 22], [9, 22], [8, 22], [7, 22], [6, 23], [4, 23], [3, 23], [3, 22], [4, 22], [5, 22], [6, 22], [2, 22], [1, 22], [0, 22], [0, 21], [1, 7], [2, 7], [3, 7], [3, 8], [2, 8], [1, 8], [4, 7], [4, 8], [0, 16], [8, 15], [9, 15], [10, 15], [10, 16], [9, 16], [8, 16], [11, 15], [11, 16]],
		movingWalls: [
			{ type: "linear", x: 6, y: 7, dx: 2, dy: 0, range: 60, duration: 2 },
			{ type: "linear", x: 11, y: 11, dx: 0, dy: 2, range: 100, duration: 2.5 },
		]
	},
	{
		start: { x: 2, y: 4 },
		goal: { x: 2, y: 10 },
		walls: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [11, 2], [10, 2], [9, 2], [8, 2], [7, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 15], [0, 17], [0, 18], [0, 19], [0, 20], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [16, 22], [15, 22], [14, 22], [13, 22], [12, 22], [11, 22], [10, 22], [9, 22], [8, 22], [7, 22], [6, 23], [4, 23], [3, 23], [3, 22], [4, 22], [5, 22], [6, 22], [2, 22], [1, 22], [0, 22], [0, 21], [0, 16], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [7, 14], [8, 14], [9, 14], [10, 14], [11, 14], [8, 15], [9, 15], [10, 15], [11, 15], [7, 15], [6, 14], [6, 15], [8, 13], [8, 16], [9, 16], [9, 13]],
		movingWalls: [
			{ type: "circle", cx: 9 * CELL, cy: 15 * CELL, radius: 4 * CELL, speed: 0.02 },
			{ type: "circle", cx: 9 * CELL, cy: 15 * CELL, radius: 6 * CELL, speed: 0.03 },
		]
	},
	{
		start: { x: 2, y: 4 },
		goal: { x: 13, y: 4 },
		walls: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [11, 2], [10, 2], [9, 2], [8, 2], [7, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 15], [0, 16], [0, 17], [0, 18], [0, 19], [0, 20], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [16, 22], [15, 22], [14, 22], [13, 22], [12, 22], [11, 22], [10, 22], [9, 22], [8, 22], [7, 22], [6, 23], [4, 23], [3, 23], [3, 22], [4, 22], [5, 22], [6, 22], [2, 22], [1, 22], [0, 22], [0, 21], [11, 3], [11, 4], [11, 5], [11, 6], [1, 10], [2, 10], [3, 10], [4, 10], [11, 10], [5, 16]],
		movingWalls: [
			{ type: "linear", x: 4.5, y: 10.5, dx: 1, dy: 0, range: 140, duration: 3 },
			{ type: "snake", x: 5.5, y: 16.5, dx: 12, dy: 0, duration: 2.0, frequency: 4, amp: 30 },
			{ type: "snake", x: 11.5, y: 6.5, dx: 0, dy: 16, duration: 3.0, frequency: 8, amp: 30 }
		]
	},
	{
		start: { x: 2, y: 4 },
		goal: { x: 15, y: 16 },
		walls: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [11, 2], [10, 2], [9, 2], [8, 2], [7, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 15], [0, 16], [0, 17], [0, 18], [0, 19], [0, 20], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [16, 22], [15, 22], [14, 22], [13, 22], [12, 22], [11, 22], [10, 22], [9, 22], [8, 22], [7, 22], [6, 23], [4, 23], [3, 23], [3, 22], [4, 22], [5, 22], [6, 22], [2, 22], [1, 22], [0, 22], [0, 21], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [11, 14], [12, 14], [13, 14], [14, 14], [15, 14], [16, 14], [1, 14], [2, 14], [3, 14], [4, 14], [16, 18], [15, 18], [14, 18], [13, 18], [12, 18], [11, 18], [4, 10], [13, 10], [4, 18], [10, 14]],
		movingWalls: [
			{ type: "linear", x: 4.5, y: 14.5, dx: 1, dy: 0, range: 120, duration: 3 },
			{ type: "circle", cx: 13.5 * CELL, cy: 10.5 * CELL, radius: 60, speed: 0.02 },
			{ type: "random", x: 4.5, y: 18.5, minX: 3 * CELL, maxX: 6 * CELL, minY: 17 * CELL, maxY: 19 * CELL, duration: 0.8 },
			{ type: "snake", x: 13.5, y: 10.5, dx: 0, dy: 14, duration: 3.0, frequency: 6, amp: 20 }
		]
	}
];

/* ==================== ゲーム状態 ==================== */
let currentStageIndex = 0;
let missCnt = 0;
let startFlg = false;
let startTime = Date.now();
let clearTime = Date.now();
let direction = 0; // 0:右 1:下 2:左 3:上
let currentWalls = [];
let movingWalls = []; // ランタイム状態
let smokeParticles = [];
let resultActive = false;
let resultElements = null;

const player = { x: 0, y: 0, rotation: 0, alpha: 1 };

/* ==================== 移動壁 ==================== */
function setupMovingWalls(dataArray) {
	movingWalls = dataArray.map((data) => {
		if (data.type === "linear") {
			const baseX = data.x * CELL, baseY = data.y * CELL;
			return { type: "linear", data, baseX, baseY, time: 0, x: baseX, y: baseY };
		}
		if (data.type === "circle") {
			return { type: "circle", data, angle: 0, x: data.cx + data.radius, y: data.cy };
		}
		if (data.type === "random") {
			const w = { type: "random", data, x: data.x * CELL, y: data.y * CELL, elapsed: 0 };
			setNewRandomTarget(w);
			return w;
		}
		if (data.type === "snake") {
			const start = { x: data.x * CELL, y: data.y * CELL };
			const dir = { x: data.dx * CELL, y: data.dy * CELL };
			const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
			const norm = { x: dir.x / len, y: dir.y / len };
			const perp = { x: -norm.y, y: norm.x };
			return { type: "snake", data, start, perp, t: 0, x: start.x, y: start.y };
		}
		return null;
	}).filter(Boolean);
}

function setNewRandomTarget(w) {
	w.startX = w.x; w.startY = w.y;
	w.targetX = w.data.minX + Math.random() * (w.data.maxX - w.data.minX);
	w.targetY = w.data.minY + Math.random() * (w.data.maxY - w.data.minY);
	w.elapsed = 0;
}

function updateMovingWalls(dtMs) {
	const dtSec = dtMs / 1000;
	const dt60 = dtMs * 60 / 1000; // 60fps基準の相対フレーム数（原作の毎フレーム固定加算を再現するため）
	for (const w of movingWalls) {
		if (w.type === "linear") {
			w.time += dtSec;
			const duration = w.data.duration || 2;
			const eased = easeSineWave(w.time, duration);
			w.x = w.baseX + w.data.dx * w.data.range * eased;
			w.y = w.baseY + w.data.dy * w.data.range * eased;
		} else if (w.type === "circle") {
			w.angle += (w.data.speed || 0.03) * dt60;
			w.x = w.data.cx + Math.cos(w.angle) * w.data.radius;
			w.y = w.data.cy + Math.sin(w.angle) * w.data.radius;
		} else if (w.type === "random") {
			w.elapsed += dtSec;
			const duration = w.data.duration || 1;
			const t = Math.min(w.elapsed / duration, 1);
			const eased = easeSineInOut(t);
			w.x = lerp(w.startX, w.targetX, eased);
			w.y = lerp(w.startY, w.targetY, eased);
			if (t >= 1) setNewRandomTarget(w);
		} else if (w.type === "snake") {
			w.t += dt60;
			const totalFrames = w.data.duration * 60;
			const progress = (w.t % totalFrames) / totalFrames;
			const px = w.start.x + w.data.dx * CELL * progress;
			const py = w.start.y + w.data.dy * CELL * progress;
			const offset = Math.sin(progress * Math.PI * 2 * w.data.frequency) * w.data.amp;
			w.x = px + w.perp.x * offset;
			w.y = py + w.perp.y * offset;
		}
	}
}

/* ==================== ステージ管理 ==================== */
function loadStage(index) {
	const stage = stages[index];
	currentWalls = stage.walls;
	setupMovingWalls(stage.movingWalls);
	killTweensOf(player);
	player.x = stage.start.x * CELL + CELL / 2;
	player.y = stage.start.y * CELL + CELL / 2;
	player.rotation = 0;
	player.alpha = 1;
	direction = 0;
	smokeParticles.length = 0;
	startFlg = true;
}

function getCurrentStage() { return stages[currentStageIndex]; }

function checkCollision() {
	const px = Math.floor(player.x / CELL);
	const py = Math.floor(player.y / CELL);
	return currentWalls.some(([x, y]) => x === px && y === py);
}

function checkMovingWallCollision() {
	for (const w of movingWalls) {
		const dist = Math.abs(player.x - w.x) + Math.abs(player.y - w.y);
		if (dist < CELL * 0.5) return true;
	}
	return false;
}

function checkGoal() {
	const stage = getCurrentStage();
	const gx = stage.goal.x * CELL, gy = stage.goal.y * CELL;
	const rx = gx - 5, ry = gy - 5, rw = CELL * 2 + 5, rh = CELL * 2 + 5;
	return player.x >= rx && player.x < rx + rw && player.y >= ry && player.y < ry + rh;
}

function resetPlayer() {
	missCnt++;
	loadStage(currentStageIndex);
}

function onPlayerHit() {
	startFlg = false;
	tween(player, { alpha: 0 }, 200, {
		ease: easePower1Out,
		onComplete: () => { resetPlayer(); }
	});
}

function nextStage() {
	if (!startFlg) return;
	startFlg = false;
	if (currentStageIndex + 1 < stages.length) {
		currentStageIndex++;
		loadStage(currentStageIndex);
	} else {
		// 最終ステージクリア時はcurrentStageIndexを進めない
		// （リザルト表示中もSTAGE表示・迷路の背景を最終ステージのまま残すため）
		showResult();
	}
}

function emitSmoke() {
	const size = 5;
	const piece = { x: 0, y: 0, alpha: 0.5, size };
	switch (direction) {
		case 0: piece.x = player.x - 12.5; piece.y = player.y - 2.5; break;
		case 1: piece.x = player.x - 2.5; piece.y = player.y - 12.5; break;
		case 2: piece.x = player.x + 7.5; piece.y = player.y - 2.5; break;
		case 3: piece.x = player.x - 2.5; piece.y = player.y + 7.5; break;
	}
	smokeParticles.push(piece);
	const angle = Math.random() * Math.PI * 2;
	const dist = 5 + Math.random() * 13;
	tween(piece, { x: piece.x + Math.cos(angle) * dist, y: piece.y + Math.sin(angle) * dist, alpha: 0 }, 600, {
		ease: easePower2Out,
		onComplete: () => {
			const idx = smokeParticles.indexOf(piece);
			if (idx >= 0) smokeParticles.splice(idx, 1);
		}
	});
}

function rotateTo(newDirection) {
	if (newDirection === 0) {
		tween(player, { rotation: 4 * (Math.PI / 2) - 0.000001 }, 200, {
			ease: easePower1Out,
			onComplete: () => { player.rotation = 0; }
		});
	} else {
		tween(player, { rotation: newDirection * (Math.PI / 2) }, 200, { ease: easePower1Out });
	}
}

/* ==================== 更新 ==================== */
function update(dtMs) {
	if (resultActive) { updateResult(dtMs); return; }
	if (!startFlg) return;

	const move = PLAYER_SPEED * (dtMs / 1000);
	switch (direction) {
		case 0: player.x += move; break;
		case 1: player.y += move; break;
		case 2: player.x -= move; break;
		case 3: player.y -= move; break;
	}

	updateMovingWalls(dtMs);
	emitSmoke();

	if (checkCollision() || checkMovingWallCollision()) {
		startFlg = false;
		onPlayerHit();
		return;
	}
	if (checkGoal()) {
		nextStage();
	}
}

/* ==================== 入力 ==================== */
function handleGameTap() {
	if (!startFlg) return;
	direction = (direction + 1) % 4;
	rotateTo(direction);
}

/* ==================== ロゴ（フラットバッジ意匠） ==================== */
const LOGO_ICON_SIZE = 18;
const LOGO_ICON_X = 4;
function drawLogoBadge() {
	const iconY = UI_HEIGHT / 2 - LOGO_ICON_SIZE / 2;
	ctx.save();
	ctx.translate(LOGO_ICON_X, iconY);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(LOGO_ICON_SIZE, LOGO_ICON_SIZE / 2);
	ctx.lineTo(0, LOGO_ICON_SIZE);
	ctx.closePath();
	ctx.fillStyle = "#f5c542";
	ctx.fill();
	ctx.beginPath();
	ctx.arc(LOGO_ICON_SIZE * 0.35, LOGO_ICON_SIZE * 0.5, LOGO_ICON_SIZE * 0.12, 0, Math.PI * 2);
	ctx.fillStyle = "#0b1f33";
	ctx.fill();
	ctx.restore();

	const textX = LOGO_ICON_X + LOGO_ICON_SIZE + 8;
	const topWord = t("logoTop");
	const bottomWord = t("logoBottom");
	const size = fitFontSize(`${topWord} ${bottomWord}`, 250 - textX, 18, "bold");
	drawText(topWord, textX, UI_HEIGHT / 2, { size, weight: "bold", align: "left", baseline: "middle", color: "#eef3f8" });
	const topWidth = measureTextWidth(`${topWord} `, size, "bold");
	const bottomX = textX + topWidth;
	drawText(bottomWord, bottomX, UI_HEIGHT / 2, { size, weight: "bold", align: "left", baseline: "middle", color: "#f5c542" });
	const bottomWidth = measureTextWidth(bottomWord, size, "bold");
	ctx.save();
	ctx.globalAlpha = 0.6;
	ctx.fillStyle = "#f5c542";
	ctx.fillRect(bottomX, UI_HEIGHT / 2 + size * 0.4, bottomWidth, 2);
	ctx.restore();
}

/* ==================== 描画：ゲーム画面 ==================== */
function drawGame() {
	ctx.fillStyle = "#f5f5f5";
	ctx.fillRect(0, 0, W, H);

	// 壁
	ctx.fillStyle = "#333333";
	for (const [gx, gy] of currentWalls) {
		ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
	}

	// ゴール
	const stage = getCurrentStage();
	const gx = stage.goal.x * CELL, gy = stage.goal.y * CELL;
	ctx.fillStyle = "#14b8a6";
	ctx.fillRect(gx, gy, CELL * 2, CELL * 2);
	ctx.save();
	ctx.strokeStyle = "#8ff2e0";
	ctx.lineWidth = 2;
	ctx.strokeRect(gx + 1, gy + 1, CELL * 2 - 2, CELL * 2 - 2);
	ctx.restore();
	drawText("GOAL", gx, gy, { size: 14, weight: "bold", color: "#ffffff", align: "left", baseline: "top" });

	// 移動壁
	ctx.fillStyle = "#999999";
	for (const w of movingWalls) {
		ctx.fillRect(w.x - CELL / 2, w.y - CELL / 2, CELL, CELL);
	}

	// 煙
	for (const p of smokeParticles) {
		ctx.save();
		ctx.globalAlpha = p.alpha;
		ctx.fillStyle = "#cccccc";
		ctx.fillRect(p.x, p.y, p.size, p.size);
		ctx.restore();
	}

	// 自機
	ctx.save();
	ctx.globalAlpha = player.alpha;
	ctx.translate(player.x, player.y);
	ctx.rotate(player.rotation);
	ctx.beginPath();
	ctx.moveTo(-10, -10);
	ctx.lineTo(10, 0);
	ctx.lineTo(-10, 10);
	ctx.closePath();
	ctx.fillStyle = "#f5c542";
	ctx.fill();
	ctx.beginPath();
	ctx.arc(-1, -0.5, 2, 0, Math.PI * 2);
	ctx.fillStyle = "#0b1f33";
	ctx.fill();
	ctx.restore();

	// 上部UIバー
	ctx.fillStyle = "#444444";
	ctx.fillRect(0, 0, W, UI_HEIGHT);
	drawLogoBadge();
	drawText(t("stageFmt")(currentStageIndex + 1), 255, 10, {
		size: 20, align: "left", baseline: "top",
		color: "#ffffff", stroke: "#000000", strokeWidth: 1,
	});

	// 下部コントロールバー
	ctx.fillStyle = "#444444";
	ctx.fillRect(0, GAME_HEIGHT, W, CONTROL_HEIGHT);
	const lines = t("controlLabel").split("\n");
	lines.forEach((line, i) => {
		const size = fitFontSize(line, W - 20, 20, "");
		drawText(line, 10, GAME_HEIGHT + 5 + i * 24, { size, align: "left", baseline: "top", color: "#ffffff" });
	});
}

/* ==================== リザルト画面 ==================== */
function showResult() {
	resultActive = true;
	clearTime = Date.now();
	const elapsed = clearTime - startTime;
	const minutes = Math.floor(elapsed / 60000);
	const seconds = Math.floor((elapsed % 60000) / 1000);
	const millis = Math.floor((elapsed % 1000) / 10);
	const timeString = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(2, "0")}`;

	resultElements = {
		timeString,
		bgAlpha: 0,
		clearText: { alpha: 0, y: 130 },
		title: { alpha: 0 },
		clearTimeText: { alpha: 0, y: 250 },
		retryBtn: { alpha: 0 },
		overlayAlpha: 0,
		stars: [],
	};
	const el = resultElements;

	tween({ v: 0 }, { v: 1 }, 500, {
		ease: easePower1Out,
		onComplete: () => {
			tween(el.clearText, { alpha: 1, y: 90 }, 1200, { ease: easeBounceOut });
			tween(el.title, { alpha: 1 }, 1200, { ease: easePower2Out, delay: 1000 });
			tween(el.clearTimeText, { alpha: 1, y: 260 }, 1200, { ease: easePower2Out, delay: 2000 });
			tween(el.retryBtn, { alpha: 1 }, 500, { ease: easePower2Out, delay: 2500 });
		}
	});
	tween(el, { bgAlpha: 0.5 }, 500, { ease: easePower1Out });

	for (let i = 0; i < 50; i++) {
		callAfter(i * 100, () => spawnStar());
	}
}

function spawnStar() {
	if (!resultActive || !resultElements) return;
	const star = {
		x: W / 2 + (Math.random() - 0.5) * 300,
		y: 0,
		size: Math.random() * 8 + 8,
		rotation: 0,
		alpha: 0,
	};
	resultElements.stars.push(star);
	tween(star, {
		alpha: 1,
		y: star.y + 200 + Math.random() * 100,
		x: star.x + (Math.random() - 0.5) * 200,
		rotation: Math.random() * Math.PI * 2,
	}, 2000, {
		ease: easePower1Out,
		onComplete: () => {
			const idx = resultElements ? resultElements.stars.indexOf(star) : -1;
			if (idx >= 0) resultElements.stars.splice(idx, 1);
		}
	});
}

const RETRY_BTN = { cx: W / 2, cy: H - 210 }; // 原作のボタン中心（コンテナ+テキストオフセット込み）

function updateResult() { /* 演出はtweenが駆動するため個別処理は不要 */ }

function drawStar(star) {
	ctx.save();
	ctx.globalAlpha = star.alpha;
	ctx.translate(star.x, star.y);
	ctx.rotate(star.rotation);
	ctx.beginPath();
	for (let i = 0; i < 5; i++) {
		const angle = i * (Math.PI * 2) / 5;
		const x1 = Math.cos(angle) * star.size;
		const y1 = Math.sin(angle) * star.size;
		if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1);
	}
	ctx.closePath();
	ctx.fillStyle = "#ffff66";
	ctx.fill();
	ctx.restore();
}

function drawResult() {
	const el = resultElements;
	if (!el) return;

	ctx.save();
	ctx.globalAlpha = el.bgAlpha;
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, W, H);
	ctx.restore();

	ctx.save();
	ctx.globalAlpha = el.clearText.alpha;
	drawText(t("clearLabel"), W / 2, el.clearText.y, {
		size: 46, weight: "bold", align: "center", baseline: "middle",
		gradient: ["#ffd700", "#ffd700", "#ffa500"], stroke: "#ffffff", strokeWidth: 4,
		shadowColor: "#ffd700", shadowBlur: 8, shadowOffsetX: 3, shadowOffsetY: 2,
	});
	ctx.restore();

	ctx.save();
	ctx.globalAlpha = el.title.alpha;
	drawText(t("clearLogoTitle"), W / 2, 180, {
		size: 36, weight: "bold", align: "center", baseline: "middle", lineHeight: 40,
		gradient: ["#ff3030", "#ff0000", "#ff69b4"], stroke: "#ffffff", strokeWidth: 6,
		shadowColor: "#ff4500", shadowBlur: 10, shadowOffsetX: 4, shadowOffsetY: 4,
	});
	ctx.restore();

	ctx.save();
	ctx.globalAlpha = el.clearTimeText.alpha;
	drawText(t("clearTimeFmt")(el.timeString), W / 2, el.clearTimeText.y, {
		size: 24, weight: "bold", align: "center", baseline: "middle",
		gradient: ["#00bfff", "#1e90ff", "#4169e1"], stroke: "#ffffff", strokeWidth: 4,
		shadowColor: "#1e90ff", shadowBlur: 8, shadowOffsetX: 3, shadowOffsetY: 2,
	});
	ctx.restore();

	for (const star of el.stars) drawStar(star);

	// RETRYボタン
	ctx.save();
	ctx.globalAlpha = el.retryBtn.alpha;
	fillRoundRect(RETRY_BTN.cx - 140, RETRY_BTN.cy - 30, 280, 70, 10, "#ffcc00");
	drawText(t("retryBtn"), RETRY_BTN.cx, RETRY_BTN.cy, { size: 34, weight: "bold", align: "center", baseline: "middle", color: "#000000" });
	ctx.restore();

	// 暗転オーバーレイ（RETRYクリック後のフェード）
	if (el.overlayAlpha > 0) {
		ctx.save();
		ctx.globalAlpha = el.overlayAlpha;
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, W, H);
		ctx.restore();
	}
}

function hitRetryButton(px, py) {
	return px >= RETRY_BTN.cx - 140 && px <= RETRY_BTN.cx + 140 && py >= RETRY_BTN.cy - 30 && py <= RETRY_BTN.cy + 40;
}

function onRetryClick() {
	const el = resultElements;
	if (!el || el.retryBtn.alpha < 0.99) return;
	tween(el, { overlayAlpha: 1 }, 500, {
		ease: easePower1Out,
		onComplete: () => {
			resultActive = false;
			resultElements = null;
			currentStageIndex = 0;
			missCnt = 0;
			startTime = Date.now();
			clearTime = Date.now();
			loadStage(0);
		}
	});
}

/* ==================== ポインター操作 ==================== */
function canvasPos(clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) };
}
canvas.addEventListener("pointerdown", (e) => {
	e.preventDefault();
	const p = canvasPos(e.clientX, e.clientY);
	if (hitTestBtn(BTN_LANG, p.x, p.y)) {
		setLang(lang === "ja" ? "en" : "ja");
		return;
	}
	if (resultActive) {
		if (hitRetryButton(p.x, p.y)) onRetryClick();
	} else {
		handleGameTap();
	}
});

/* ==================== メインループ ==================== */
let lastTime = performance.now();
function frame(now) {
	const dt = Math.min(now - lastTime, 100);
	lastTime = now;
	updateTweens(dt);
	update(dt);
	if (resultActive) {
		drawGame();
		drawResult();
	} else {
		drawGame();
	}
	drawLangButton();
	requestAnimationFrame(frame);
}

/* ==================== 起動 ==================== */
loadStage(currentStageIndex);
requestAnimationFrame(frame);
