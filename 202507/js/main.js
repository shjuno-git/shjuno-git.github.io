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

// 句読点・記号・スペースの直後を折り返し候補の区切りにする（日英共通）。
// 1つの区切りだけで指定幅を超える場合のみ、文字単位に分解してフォールバックする。
const WRAP_BREAK_CHARS = new Set(["。", "、", "！", "？", "・", "…", "!", "?", ",", ".", ";", ":", " "]);
function splitIntoChunks(text, maxWidth, size, weight) {
	const rawChunks = [];
	let current = "";
	for (const ch of text) {
		current += ch;
		if (WRAP_BREAK_CHARS.has(ch)) {
			rawChunks.push(current);
			current = "";
		}
	}
	if (current) rawChunks.push(current);

	const chunks = [];
	for (const c of rawChunks) {
		if (measureTextWidth(c, size, weight) <= maxWidth) {
			chunks.push(c);
		} else {
			chunks.push(...c.split(""));
		}
	}
	return chunks;
}

// 指定幅に収まるよう改行位置を決める。句読点・記号・スペースの直後を優先して折り返す。
function wrapTextLines(text, maxWidth, size, weight) {
	const chunks = splitIntoChunks(text, maxWidth, size, weight);
	const lines = [];
	let line = "";
	for (const chunk of chunks) {
		const test = line + chunk;
		if (line && measureTextWidth(test, size, weight) > maxWidth) {
			lines.push(line.replace(/\s+$/, ""));
			line = chunk;
		} else {
			line = test;
		}
	}
	if (line) lines.push(line.replace(/\s+$/, ""));
	return lines;
}

// maxLines行以内に収まる最大のフォントサイズと、その行分割を返す
function fitFontSizeForLines(text, maxWidth, maxLines, initialSize, weight) {
	let size = initialSize;
	let lines = wrapTextLines(text, maxWidth, size, weight);
	while (size > 8 && lines.length > maxLines) {
		size -= 1;
		lines = wrapTextLines(text, maxWidth, size, weight);
	}
	return { size, lines };
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
function strokeRoundRect(x, y, w, h, r, color, lineWidth) {
	ctx.save();
	roundRectPath(x, y, w, h, r);
	ctx.strokeStyle = color;
	ctx.lineWidth = lineWidth || 1;
	ctx.stroke();
	ctx.restore();
}

/* ==================== イージング関数 ==================== */
function easePower1Out(p) { return 1 - (1 - p) * (1 - p); }
function easePower2Out(p) { return 1 - Math.pow(1 - p, 3); }
function easeBounceOut(p) {
	const n1 = 7.5625, d1 = 2.75;
	if (p < 1 / d1) return n1 * p * p;
	if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
	if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
	return n1 * (p -= 2.625 / d1) * p + 0.984375;
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
// 点滅（無効な移動時のフィードバック）: alpha 1→lowAlpha→1 を times 回往復する
function flashAlpha(target, times, lowAlpha, stepMs) {
	let count = 0;
	function down() {
		tween(target, { alpha: lowAlpha }, stepMs, { onComplete: up });
	}
	function up() {
		tween(target, { alpha: 1 }, stepMs, {
			onComplete: () => { count++; if (count < times) down(); }
		});
	}
	down();
}
// パンチ（移動時の拡縮フィードバック）: scale 1→big→1 を1往復
function punchScale(target, big, stepMs) {
	tween(target, { scale: big }, stepMs, {
		onComplete: () => tween(target, { scale: 1 }, stepMs)
	});
}

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う。 */
function hitTestBtn(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function drawButton(rect, label, opts) {
	opts = opts || {};
	const radius = opts.radius || 10;
	if (opts.shadow) {
		fillRoundRect(rect.x, rect.y + 3, rect.w, rect.h, radius, opts.shadow);
	}
	fillRoundRect(rect.x, rect.y, rect.w, rect.h - (opts.shadow ? 3 : 0), radius, opts.bg || "#555555");
	if (label) {
		drawText(label, rect.x + rect.w / 2, rect.y + (rect.h - (opts.shadow ? 3 : 0)) / 2 + 1, {
			size: opts.size || 20, weight: "bold", align: "center", baseline: "middle",
			color: opts.color || "#ffffff",
		});
	}
}

const BTN_LANG = { x: 254, y: 50, w: 96, h: 20 };
function drawLangButton() {
	drawButton(BTN_LANG, t("langBtn"), { bg: "rgba(255,255,255,0.9)", size: 11, color: "#6d4c33", radius: 10 });
}

document.title = t("pageTitle");
document.addEventListener("langchange", () => { document.title = t("pageTitle"); });

/* ==================== 配色パレット（親しみやすいポップトーン） ==================== */
const COLORS = {
	bg: "#fff6e5",
	infoBar: "#ffb74d",
	infoBarShadow: "#f79b3a",
	hintText: "#4a2c17",
	baseText: "#6d4c33",
	pointText: "#ffffff",
	pointShadow: "#e65100",
	opText: "#5d4037",
	stageText: "#6d4c33",
	calcText: "#6d4c33",
	cellNormal: "#fff2d6",
	cellNormalBorder: "#e8d3ab",
	cellGoal: "#ff7043",
	cellGoalBorder: "#ffd54f",
	cellRandom: "#4fc3f7",
	cellRandomBorder: "#0288d1",
	cellTextNormal: "#7a5230",
	cellTextGoal: "#ffffff",
	cellTextRandom: "#ffffff",
	player: "#ffd54f",
	playerShade: "#ffb300",
	pointGoalColor: "#fff176",
	pointGoalOutline: "#3e2723",
	pointGoalGlow: "#fff9c4",
	opBtnOn: "#66bb6a",
	opBtnOnShadow: "#43a047",
	opBtnOff: "#f0e6d2",
	opBtnOffShadow: "#d8c8a0",
	opTextOn: "#ffffff",
	opTextOff: "#8d6e4a",
	moveBtn: "#4fc3f7",
	moveBtnShadow: "#0288d1",
	undoBtn: "#ff8a65",
	undoBtnShadow: "#e64a19",
	stampAccent: "#d84315",
	sparkle: ["#ffd54f", "#ff8a65", "#4fc3f7", "#81c784", "#ba68c8"],
};

/* ==================== ステージ定義（原作のまま。warps/onceは原作でも配置ロジックが無く未使用のため省略） ==================== */
const stageData = [
	{ size: 7, goal: 1, ops: ['+'], randoms: 0 },
	{ size: 5, goal: 2, ops: ['+'], randoms: 2 },
	{ size: 7, goal: 3, ops: ['+', '-'], randoms: 2 },
	{ size: 9, goal: 4, ops: ['+', '-', '*'], randoms: 3 },
	{ size: 9, goal: 5, ops: ['+', '-', '*', '/'], randoms: 4 },
];

/* ==================== ゲーム状態 ==================== */
let currentStage = 0;
let px = 3, py = 3;
let point = 0;
let operator = '+';
let board = [];
let moveStack = [];
let CELL = 40, OFFSET_X = 0, OFFSET_Y = 78;
let stage;
let startTime = Date.now();
let stageTimes = [], allCalcs = [], currentFormula = [];
let calcTextValue = "";
let calcTextObj = { alpha: 1 };
let messageIndex = 0;
let messageTimerMs = 0;
const MESSAGE_INTERVAL_MS = 4000;

const player = { alpha: 1, scale: 1, x: 0, y: 0 };

let resultActive = false;
let resultData = null;

/* ==================== UIボタン矩形 ==================== */
let operatorButtons = []; // {x,y,w,h,op}
let undoButton = { x: 10, y: 474, w: 68, h: 28 };
const MOVE_BTN_W = 60, MOVE_BTN_H = 40;
const moveButtons = [
	{ dir: '↑', dx: 0, dy: -1, x: 150, y: 448, w: MOVE_BTN_W, h: MOVE_BTN_H },
	{ dir: '↓', dx: 0, dy: 1, x: 150, y: 500, w: MOVE_BTN_W, h: MOVE_BTN_H },
	{ dir: '←', dx: -1, dy: 0, x: 90, y: 474, w: MOVE_BTN_W, h: MOVE_BTN_H },
	{ dir: '→', dx: 1, dy: 0, x: 210, y: 474, w: MOVE_BTN_W, h: MOVE_BTN_H },
];

/* ==================== ステージ初期化 ==================== */
function initStage(stageIndex) {
	board = [];
	currentFormula = [];
	moveStack = [];
	stage = stageData[stageIndex];
	const size = stage.size;
	CELL = Math.floor(320 / size);
	OFFSET_X = (W - CELL * size) / 2;
	OFFSET_Y = 78;
	px = py = Math.floor(size / 2);
	point = 0;
	currentFormula.push(`${point}`);
	operator = stage.ops[0];

	for (let y = 0; y < size; y++) {
		board[y] = [];
		for (let x = 0; x < size; x++) {
			board[y][x] = { value: Math.floor(Math.random() * 5) + 1, type: 'normal' };
		}
	}
	board[py][px].value = null;

	// ゴール外周
	for (let i = 0; i < size; i++) {
		[[i, 0], [i, size - 1], [0, i], [size - 1, i]].forEach(([x, y]) => {
			board[y][x].value = stage.goal;
			board[y][x].type = 'goal';
		});
	}

	// ランダムマス配置
	let count = 0;
	while (count < stage.randoms) {
		const x = Math.floor(Math.random() * size);
		const y = Math.floor(Math.random() * size);
		const isStart = (x === px && y === py);
		const isOuter = (x === 0 || x === size - 1 || y === 0 || y === size - 1);
		const cell = board[y][x];
		if (!isStart && !isOuter && cell.type === 'normal') {
			cell.type = 'random';
			cell.value = Math.floor(Math.random() * 5) + 1;
			count++;
		}
	}

	operatorButtons = stage.ops.map((op, i) => ({ x: 20 + i * 80, y: 402, w: 60, h: 40, op }));

	player.alpha = 1;
	player.scale = 1;
	killTweensOf(player);
	const p0 = playerPixel();
	player.x = p0.x;
	player.y = p0.y;
	killTweensOf(calcTextObj);
	calcTextValue = "";
	calcTextObj.alpha = 1;
	messageIndex = 0;
	messageTimerMs = 0;
	startTime = Date.now();
}

function playerPixel() {
	return { x: OFFSET_X + px * CELL + CELL / 2, y: OFFSET_Y + py * CELL + CELL / 2 };
}

/* ==================== 移動処理 ==================== */
function movePlayer(dx, dy) {
	if (resultActive) return;
	const newX = px + dx, newY = py + dy;
	const size = board.length;
	if (newX < 0 || newX >= size || newY < 0 || newY >= size) return;

	const boardCopy = board.map(row => row.map(cell => ({ ...cell })));
	const target = board[newY][newX];

	if (target.type === 'goal' && target.value !== point) {
		flashAlpha(player, 4, 0.2, 100);
		return;
	}

	moveStack.push({ px, py, point, calcTextValue, board: boardCopy });

	px = newX;
	py = newY;
	killTweensOf(player); // 前回移動の残存tweenをクリアしてから新しい演出を仕込む

	if (target.value !== null && target.type !== 'goal') {
		const val = target.value;
		let newPoint = point;
		if (operator === '+') newPoint += val;
		if (operator === '-') newPoint -= val;
		if (operator === '*') newPoint *= val;
		if (operator === '/') newPoint = val !== 0 ? Math.floor(newPoint / val) : newPoint;
		newPoint = Math.abs(newPoint) % 10;
		currentFormula.push(`${operator}${val}`);

		calcTextValue = `${point} ${operator} ${val} = `;
		calcTextObj.alpha = 0;
		killTweensOf(calcTextObj);
		tween(calcTextObj, { alpha: 1 }, 300);

		point = newPoint;

		if (target.type === 'normal') {
			board[py][px].value = null;
		}
		if (target.type === 'random') {
			target.value = Math.floor(Math.random() * 5) + 1;
		}
	}

	punchScale(player, 1.2, 100);
	const p = playerPixel();
	tween(player, { x: p.x, y: p.y }, 200, { onComplete: checkGoal });
}

function undo() {
	const state = moveStack.pop();
	if (!state) return;
	px = state.px; py = state.py; point = state.point;
	board = state.board.map(row => row.map(cell => ({ ...cell })));
	calcTextValue = state.calcTextValue;
	killTweensOf(calcTextObj);
	calcTextObj.alpha = 1;
	const p = playerPixel();
	killTweensOf(player);
	player.x = p.x; player.y = p.y;
	player.alpha = 1; player.scale = 1;
}

/* ==================== ゴール判定・演出（スタンプ演出） ==================== */
const STAMP_DUR = 160; // 着地までのms
const STAMP_SHAKE_MS = 220; // 着地後に揺れる長さ
let clearBanner = { alpha: 0, scale: 2.4 };
let clearBannerLandTime = 0; // 着地した瞬間のperformance.now()。0なら未着地

function easeOutQuart(p) { return 1 - Math.pow(1 - p, 4); }

function checkGoal() {
	const cell = board[py][px];
	if (cell.type === 'goal' && cell.value === point) {
		const time = (Date.now() - startTime) / 1000;
		stageTimes.push(time);
		allCalcs.push(currentFormula.join('') + '=' + point);

		// CLEAR!スタンプ演出：勢いよく縮小しながら着地し、着地の瞬間だけ揺れる
		clearBanner.alpha = 1;
		clearBanner.scale = 2.4;
		clearBannerLandTime = 0;
		killTweensOf(clearBanner);
		tween(clearBanner, { scale: 1 }, STAMP_DUR, {
			ease: easeOutQuart,
			onComplete: () => { clearBannerLandTime = performance.now(); }
		});

		callAfter(1000, () => {
			clearBanner.alpha = 0;
			currentStage++;
			if (currentStage >= stageData.length) {
				showFinalResult();
			} else {
				initStage(currentStage);
			}
		});
	}
}

/* ==================== 最終リザルト ==================== */
function showFinalResult() {
	resultActive = true;
	let total = 0;
	stageTimes.forEach(t => total += t);
	const sparkles = [];
	for (let i = 0; i < 30; i++) {
		sparkles.push({
			x: Math.random() * W,
			y: Math.random() * H,
			r: Math.random() * 3 + 1,
			phase: Math.random() * Math.PI * 2,
			speed: 0.6 + Math.random() * 0.4,
			color: COLORS.sparkle[i % COLORS.sparkle.length],
		});
	}
	// 紙吹雪（画面上から降り続ける、時間ベースで計算するので状態を持たない）
	const confetti = [];
	for (let i = 0; i < 36; i++) {
		confetti.push({
			x: Math.random() * W,
			startY: -20 - Math.random() * H,
			size: 4 + Math.random() * 5,
			color: COLORS.sparkle[i % COLORS.sparkle.length],
			fallSpeed: 45 + Math.random() * 55,
			swayAmp: 10 + Math.random() * 15,
			swaySpeed: 0.8 + Math.random() * 1.2,
			swayPhase: Math.random() * Math.PI * 2,
			rotSpeed: (Math.random() - 0.5) * 5,
			rotStart: Math.random() * Math.PI * 2,
		});
	}
	const titleObj = { scale: 0 };
	const cardObjs = allCalcs.map(() => ({ alpha: 0, x: -24 }));
	const totalObj = { scale: 0 };
	const retryBtn = { x: 110, y: 422, w: 140, h: 44, scale: 0 };
	resultData = {
		total: total.toFixed(2),
		sparkles,
		confetti,
		titleObj,
		cardObjs,
		totalObj,
		retryBtn,
	};

	tween(titleObj, { scale: 1 }, 450, { ease: easeBounceOut, delay: 120 });
	cardObjs.forEach((c, i) => {
		tween(c, { alpha: 1, x: 0 }, 280, { ease: easePower2Out, delay: 380 + i * 110 });
	});
	const afterCards = 380 + cardObjs.length * 110;
	tween(totalObj, { scale: 1 }, 350, { ease: easeBounceOut, delay: afterCards + 100 });
	tween(retryBtn, { scale: 1 }, 400, { ease: easeBounceOut, delay: afterCards + 350 });
}

function retryGame() {
	currentStage = 0;
	stageTimes = [];
	allCalcs = [];
	resultActive = false;
	resultData = null;
	initStage(currentStage);
}

/* ==================== 入力 ==================== */
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
		if (resultData && resultData.retryBtn.scale > 0.8 && hitTestBtn(resultData.retryBtn, p.x, p.y)) {
			retryGame();
		}
		return;
	}

	for (const btn of operatorButtons) {
		if (hitTestBtn(btn, p.x, p.y)) {
			operator = btn.op;
			return;
		}
	}
	if (hitTestBtn(undoButton, p.x, p.y)) {
		undo();
		return;
	}
	for (const btn of moveButtons) {
		if (hitTestBtn(btn, p.x, p.y)) {
			movePlayer(btn.dx, btn.dy);
			return;
		}
	}
});

/* ==================== 描画：ゲーム画面 ==================== */
const CELL_STYLE = {
	normal: { fill: COLORS.cellNormal, border: COLORS.cellNormalBorder, text: COLORS.cellTextNormal },
	goal: { fill: COLORS.cellGoal, border: COLORS.cellGoalBorder, text: COLORS.cellTextGoal },
	random: { fill: COLORS.cellRandom, border: COLORS.cellRandomBorder, text: COLORS.cellTextRandom },
};

function drawBoard(isGoalMatch) {
	const size = board.length;
	const glowPulse = isGoalMatch ? (Math.sin(performance.now() / 140) + 1) / 2 : 0; // 0~1
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const cell = board[y][x];
			const gx = OFFSET_X + x * CELL, gy = OFFSET_Y + y * CELL;
			const style = CELL_STYLE[cell.type] || CELL_STYLE.normal;
			ctx.fillStyle = style.fill;
			ctx.fillRect(gx, gy, CELL, CELL);
			if (cell.type === 'goal' && isGoalMatch) {
				// ゴール一致中はマス全体を明るくハイライトして「今ここに入れる」ことをアピール
				ctx.save();
				ctx.globalAlpha = 0.4 + glowPulse * 0.3;
				ctx.fillStyle = "#fff9c4";
				ctx.fillRect(gx, gy, CELL, CELL);
				ctx.restore();
			}
			ctx.strokeStyle = style.border;
			ctx.lineWidth = cell.type === 'goal' ? 2 : 1;
			ctx.strokeRect(gx + 1, gy + 1, CELL - 2, CELL - 2);
			if (cell.value !== null) {
				drawText(cell.value, gx + CELL / 2, gy + CELL / 2 + 1, {
					size: CELL * 0.45, weight: "bold", color: style.text, align: "center", baseline: "middle",
				});
			}
		}
	}
}

function drawPlayer(isGoalMatch) {
	const r = CELL * 0.36;
	ctx.save();
	ctx.globalAlpha = player.alpha;
	ctx.translate(player.x, player.y);
	ctx.scale(player.scale, player.scale);

	// 影
	ctx.beginPath();
	ctx.ellipse(0, r * 0.75, r * 0.8, r * 0.25, 0, 0, Math.PI * 2);
	ctx.fillStyle = "rgba(0,0,0,0.15)";
	ctx.fill();

	// 本体
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, Math.PI * 2);
	const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
	grad.addColorStop(0, isGoalMatch ? "#fff9c4" : "#fff59d");
	grad.addColorStop(1, isGoalMatch ? "#ffca28" : COLORS.player);
	ctx.fillStyle = grad;
	ctx.fill();
	ctx.strokeStyle = COLORS.playerShade;
	ctx.lineWidth = 1.5;
	ctx.stroke();

	const eyeDx = r * 0.32, eyeDy = -r * 0.08, eyeR = Math.max(1.3, r * 0.13);
	if (isGoalMatch) {
		// にっこり目（^ ^）
		ctx.strokeStyle = "#4e342e";
		ctx.lineWidth = Math.max(1.2, r * 0.14);
		ctx.lineCap = "round";
		[-1, 1].forEach((s) => {
			ctx.beginPath();
			ctx.arc(s * eyeDx, eyeDy + eyeR * 0.6, eyeR * 1.4, Math.PI * 1.15, Math.PI * 1.85);
			ctx.stroke();
		});
	} else {
		// 目
		[-1, 1].forEach((s) => {
			ctx.beginPath();
			ctx.arc(s * eyeDx, eyeDy, eyeR, 0, Math.PI * 2);
			ctx.fillStyle = "#4e342e";
			ctx.fill();
		});
	}
	// ほっぺ（一致時は少し濃く）
	ctx.fillStyle = isGoalMatch ? "rgba(255,111,74,0.75)" : "rgba(255,138,101,0.55)";
	[-1, 1].forEach((s) => {
		ctx.beginPath();
		ctx.arc(s * eyeDx, eyeDy + r * 0.35, r * 0.16, 0, Math.PI * 2);
		ctx.fill();
	});
	// 口（常に同じ形。表情の変化は目とほっぺだけで表現する）
	ctx.beginPath();
	ctx.arc(0, eyeDy + r * 0.15, r * 0.32, 0.15 * Math.PI, 0.85 * Math.PI);
	ctx.strokeStyle = "#4e342e";
	ctx.lineWidth = Math.max(1, r * 0.1);
	ctx.lineCap = "round";
	ctx.stroke();

	ctx.restore();
}

function drawInfoArea(isGoalMatch) {
	// 情報エリアの帯
	ctx.fillStyle = COLORS.infoBar;
	ctx.fillRect(0, 0, W, OFFSET_Y);
	ctx.fillStyle = COLORS.infoBarShadow;
	ctx.fillRect(0, OFFSET_Y - 3, W, 3);

	// ヒントメッセージ / ベースメッセージ 交互表示（フル幅、最大2行）
	const base = t("baseMsg");
	const hint = t("stageHints")[currentStage];
	const showHint = messageIndex % 2 === 0;
	const msgText = showHint ? hint : base;
	const { size: msgSize, lines: msgLines } = fitFontSizeForLines(msgText, W - 24, 2, 14, "bold");
	const msgColor = showHint ? COLORS.hintText : COLORS.baseText;
	msgLines.forEach((line, i) => {
		drawText(line, 12, 4 + i * (msgSize * 1.2), {
			size: msgSize, weight: "bold", color: msgColor, align: "left", baseline: "top",
		});
	});

	// ステージ番号（左端）
	const POINT_CX = 205, ROW_Y = 60;
	drawText(t("stageFmt")(currentStage + 1), 12, ROW_Y, { size: 15, weight: "bold", color: COLORS.stageText, align: "left", baseline: "middle" });

	// 「計算式  現在の値  次の演算子」を横一列に配置

	// 計算式（現在値の左、右揃え、フェード表示）
	ctx.save();
	ctx.globalAlpha = calcTextObj.alpha;
	drawText(calcTextValue, POINT_CX - 24, ROW_Y, { size: 13, weight: "bold", color: COLORS.calcText, align: "right", baseline: "middle" });
	ctx.restore();

	// 現在の値（中央、ゴールと一致したら拡大＋発光でアピール）
	const pulse = isGoalMatch ? 1 + Math.sin(performance.now() / 140) * 0.16 : 1;
	ctx.save();
	ctx.translate(POINT_CX, ROW_Y);
	ctx.scale(pulse, pulse);
	if (isGoalMatch) {
		ctx.shadowColor = COLORS.pointGoalGlow;
		ctx.shadowBlur = 16;
		drawText(`${point}`, 0, 0, {
			size: 32, weight: "bold", color: COLORS.pointGoalColor, align: "center", baseline: "middle",
			stroke: COLORS.pointGoalOutline, strokeWidth: 5,
		});
	} else {
		drawText(`${point}`, 1, 1, { size: 32, weight: "bold", color: COLORS.pointShadow, align: "center", baseline: "middle" });
		drawText(`${point}`, 0, 0, { size: 32, weight: "bold", color: COLORS.pointText, align: "center", baseline: "middle" });
	}
	ctx.restore();

	// 次の演算子（現在値の右、左揃え）
	drawText(operator, POINT_CX + 23, ROW_Y, { size: 20, weight: "bold", color: COLORS.opText, align: "left", baseline: "middle" });
}

function drawGame() {
	ctx.fillStyle = COLORS.bg;
	ctx.fillRect(0, 0, W, H);

	const isGoalMatch = point === stage.goal;
	drawInfoArea(isGoalMatch);
	drawBoard(isGoalMatch);
	drawPlayer(isGoalMatch);

	// CLEAR!スタンプ演出
	if (clearBanner.alpha > 0) {
		let shakeX = 0, shakeY = 0;
		let speedLineAlpha = 0;
		if (clearBannerLandTime > 0) {
			const shakeT = performance.now() - clearBannerLandTime;
			if (shakeT >= 0 && shakeT < STAMP_SHAKE_MS) {
				const decay = 1 - shakeT / STAMP_SHAKE_MS;
				shakeX = Math.sin(shakeT * 0.07) * 5 * decay;
				shakeY = Math.cos(shakeT * 0.055) * 3 * decay;
				speedLineAlpha = decay;
			}
		}
		// 着地の瞬間に放射状のスピード線
		if (speedLineAlpha > 0) {
			ctx.save();
			ctx.globalAlpha = speedLineAlpha * 0.8;
			ctx.strokeStyle = COLORS.stampAccent;
			ctx.lineWidth = 3;
			for (let i = 0; i < 10; i++) {
				const ang = (i / 10) * Math.PI * 2;
				const r1 = 50, r2 = 80;
				ctx.beginPath();
				ctx.moveTo(W / 2 + Math.cos(ang) * r1, H / 2 - 10 + Math.sin(ang) * r1);
				ctx.lineTo(W / 2 + Math.cos(ang) * r2, H / 2 - 10 + Math.sin(ang) * r2);
				ctx.stroke();
			}
			ctx.restore();
		}
		ctx.save();
		ctx.globalAlpha = clearBanner.alpha;
		ctx.translate(W / 2 + shakeX, H / 2 - 10 + shakeY);
		ctx.rotate(-7 * Math.PI / 180);
		ctx.scale(clearBanner.scale, clearBanner.scale);
		ctx.strokeStyle = COLORS.stampAccent;
		ctx.lineWidth = 4;
		roundRectPath(-88, -30, 176, 60, 8);
		ctx.stroke();
		drawText(t("stageClearBanner"), 0, 2, {
			size: 38, weight: "bold", color: COLORS.stampAccent, align: "center", baseline: "middle",
		});
		ctx.restore();
	}

	// 演算子ボタン
	for (const btn of operatorButtons) {
		const on = btn.op === operator;
		drawButton(btn, btn.op, {
			bg: on ? COLORS.opBtnOn : COLORS.opBtnOff,
			shadow: on ? COLORS.opBtnOnShadow : COLORS.opBtnOffShadow,
			color: on ? COLORS.opTextOn : COLORS.opTextOff,
			radius: 12,
		});
	}
	// Undoボタン
	drawButton(undoButton, "↺ " + t("undoBtn"), { bg: COLORS.undoBtn, shadow: COLORS.undoBtnShadow, color: "#ffffff", size: 14, radius: 12 });
	// 移動ボタン
	for (const btn of moveButtons) {
		drawButton(btn, btn.dir, { bg: COLORS.moveBtn, shadow: COLORS.moveBtnShadow, radius: 12 });
	}
}

/* ==================== 描画：最終リザルト ==================== */
function drawFinalResult(timeSec) {
	ctx.fillStyle = COLORS.bg;
	ctx.fillRect(0, 0, W, H);

	// 紙吹雪（画面上から降り続ける）
	const cycleY = H + 40;
	for (const c of resultData.confetti) {
		const y = (((c.startY + timeSec * c.fallSpeed) % cycleY) + cycleY) % cycleY - 20;
		const x = c.x + Math.sin(timeSec * c.swaySpeed + c.swayPhase) * c.swayAmp;
		const rot = c.rotStart + timeSec * c.rotSpeed;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.fillStyle = c.color;
		ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
		ctx.restore();
	}

	// タイトル帯（ゲーム画面の情報エリアと統一感を出す）
	ctx.fillStyle = COLORS.infoBar;
	ctx.fillRect(0, 0, W, 76);
	ctx.fillStyle = COLORS.infoBarShadow;
	ctx.fillRect(0, 73, W, 3);

	// キラキラ（時間ベースのサイン波で明滅・上下動、無限ループ、カラフル）
	for (const s of resultData.sparkles) {
		const alpha = (Math.sin(timeSec * s.speed * 2 + s.phase) + 1) / 2;
		const yOff = Math.sin(timeSec * s.speed * 0.7 + s.phase) * 15;
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.beginPath();
		ctx.arc(s.x, s.y + yOff, s.r, 0, Math.PI * 2);
		ctx.fillStyle = s.color;
		ctx.fill();
		ctx.restore();
	}

	// タイトル（バウンスイン、帯の上で白抜き）
	ctx.save();
	ctx.translate(W / 2, 38);
	ctx.scale(resultData.titleObj.scale, resultData.titleObj.scale);
	drawText(t("finalTitle"), 0, 0, {
		size: 21, weight: "bold", color: "#ffffff", align: "center", baseline: "middle",
		stroke: COLORS.pointGoalOutline, strokeWidth: 4,
	});
	ctx.restore();

	// ステージ結果カード（丸番号バッジ＋計算式、順番にスライドイン）
	const cardX = 20, cardW = W - 40, cardH = 46, cardGap = 8, cardStartY = 90;
	allCalcs.forEach((f, i) => {
		const c = resultData.cardObjs[i];
		if (!c || c.alpha <= 0.01) return;
		const cy = cardStartY + i * (cardH + cardGap);
		ctx.save();
		ctx.globalAlpha = c.alpha;
		ctx.translate(c.x, 0);
		fillRoundRect(cardX, cy, cardW, cardH, 12, COLORS.cellNormal);
		ctx.strokeStyle = COLORS.cellNormalBorder;
		ctx.lineWidth = 1.5;
		roundRectPath(cardX, cy, cardW, cardH, 12);
		ctx.stroke();

		const bcx = cardX + 27, bcy = cy + cardH / 2;
		ctx.beginPath();
		ctx.arc(bcx, bcy, 16, 0, Math.PI * 2);
		ctx.fillStyle = COLORS.cellGoal;
		ctx.fill();
		drawText(`${i + 1}`, bcx, bcy + 1, { size: 16, weight: "bold", color: "#ffffff", align: "center", baseline: "middle" });

		const fSize = fitFontSize(f, cardW - 70, 16, "bold");
		drawText(f, bcx + 30, bcy, { size: fSize, weight: "bold", color: COLORS.calcText, align: "left", baseline: "middle" });
		ctx.restore();
	});

	// 合計タイムバッジ
	const totalY = cardStartY + allCalcs.length * (cardH + cardGap) + 14;
	if (resultData.totalObj.scale > 0.01) {
		ctx.save();
		ctx.translate(W / 2, totalY + 20);
		ctx.scale(resultData.totalObj.scale, resultData.totalObj.scale);
		fillRoundRect(-130, -20, 260, 40, 20, COLORS.moveBtn);
		drawText(t("totalTimeFmt")(resultData.total), 0, 1, {
			size: 17, weight: "bold", color: "#ffffff", align: "center", baseline: "middle",
		});
		ctx.restore();
	}

	// リトライボタン（バウンスイン）
	const rb = resultData.retryBtn;
	if (rb.scale > 0.01) {
		ctx.save();
		const cx = rb.x + rb.w / 2, cy = rb.y + rb.h / 2;
		ctx.translate(cx, cy);
		ctx.scale(rb.scale, rb.scale);
		ctx.translate(-cx, -cy);
		drawButton(rb, t("retryBtn"), { bg: COLORS.opBtnOn, shadow: COLORS.opBtnOnShadow, color: "#ffffff", size: 19, radius: 16 });
		ctx.restore();
	}
}

/* ==================== メインループ ==================== */
let lastTime = performance.now();
let resultElapsedMs = 0;
function frame(now) {
	const dt = Math.min(now - lastTime, 100);
	lastTime = now;
	updateTweens(dt);

	if (!resultActive) {
		messageTimerMs += dt;
		if (messageTimerMs >= MESSAGE_INTERVAL_MS) {
			messageTimerMs -= MESSAGE_INTERVAL_MS;
			messageIndex++;
		}
		drawGame();
	} else {
		resultElapsedMs += dt;
		drawFinalResult(resultElapsedMs / 1000);
	}
	drawLangButton();
	requestAnimationFrame(frame);
}

/* ==================== 起動 ==================== */
initStage(currentStage);
requestAnimationFrame(frame);
