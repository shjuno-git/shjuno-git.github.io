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
	const styleStr = opts.italic ? "italic" : "";
	const align = opts.align || "left";
	const baseline = opts.baseline || "alphabetic";
	const lineHeight = opts.lineHeight || size * 1.3;
	ctx.save();
	ctx.font = `${styleStr} ${weight} ${size}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`.trim();
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

function wrapText(text, maxWidth, size, weight) {
	ctx.save();
	ctx.font = `${weight || ""} ${size}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`.trim();
	const outLines = [];
	text.split("\n").forEach((paragraph) => {
		if (paragraph === "") { outLines.push(""); return; }
		if (/\s/.test(paragraph)) {
			const words = paragraph.split(" ");
			let cur = "";
			words.forEach((w) => {
				const test = cur ? cur + " " + w : w;
				if (cur && ctx.measureText(test).width > maxWidth) {
					outLines.push(cur);
					cur = w;
				} else {
					cur = test;
				}
			});
			if (cur) outLines.push(cur);
		} else {
			let cur = "";
			for (const ch of paragraph) {
				const test = cur + ch;
				if (cur && ctx.measureText(test).width > maxWidth) {
					outLines.push(cur);
					cur = ch;
				} else {
					cur = test;
				}
			}
			if (cur) outLines.push(cur);
		}
	});
	ctx.restore();
	return outLines.join("\n");
}

function fitFontSize(text, maxWidth, initialSize, weight) {
	let size = initialSize;
	ctx.save();
	while (size > 10) {
		ctx.font = `${weight || ""} ${size}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`.trim();
		if (ctx.measureText(text).width <= maxWidth) break;
		size -= 1;
	}
	ctx.restore();
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
function strokeRoundRect(x, y, w, h, r, color, width) {
	ctx.save();
	roundRectPath(x, y, w, h, r);
	ctx.lineWidth = width;
	ctx.strokeStyle = color;
	ctx.stroke();
	ctx.restore();
}
function drawStarPath(cx, cy, spikes, outerR, innerR) {
	let rot = (Math.PI / 2) * 3;
	const step = Math.PI / spikes;
	ctx.beginPath();
	ctx.moveTo(cx, cy - outerR);
	for (let i = 0; i < spikes; i++) {
		ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
		rot += step;
		ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
		rot += step;
	}
	ctx.closePath();
}
function easeOutBack(p) {
	const c1 = 1.70158, c3 = c1 + 1;
	return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

/* ==================== Tweenシステム（実時間ベース） ==================== */
const activeTweens = [];
function tween(target, props, durationMs, ease, onComplete) {
	// 同じtarget×同じプロパティに対する既存tweenが残っていると、両方が毎フレーム値を
	// 奪い合って表示が壊れる（例：ダイアログのフェードイン中に素早く閉じると起きる）ため、
	// 新しいtweenを張る前に重複分を打ち切る
	for (let i = activeTweens.length - 1; i >= 0; i--) {
		const tw = activeTweens[i];
		if (tw.target !== target) continue;
		for (const k in props) {
			if (k in tw.props) { activeTweens.splice(i, 1); break; }
		}
	}
	const start = {};
	for (const k in props) start[k] = target[k];
	const tw = { target, start, props, duration: Math.max(1, durationMs), ease: ease || easeLinear, elapsed: 0, onComplete };
	activeTweens.push(tw);
	return tw;
}
function updateTweens(deltaMs) {
	for (let i = activeTweens.length - 1; i >= 0; i--) {
		const tw = activeTweens[i];
		tw.elapsed += deltaMs;
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
function easeLinear(p) { return p; }
function easeOutQuad(p) { return 1 - (1 - p) * (1 - p); }
function easeInSine(p) { return 1 - Math.cos((p * Math.PI) / 2); }
/* 何もアニメーションさせず、ms後にcallbackだけ呼ぶタイマー（tweenの仕組みに相乗り） */
function delay(ms, callback) {
	tween({}, {}, ms, easeLinear, callback);
}

/* ==================== グリッド設定 ==================== */
const GRID_SIZE = 5;
const CELL_SIZE = 60;
const OFFSET_X = 60;
const OFFSET_Y = 205;
const CONFETTI_COLORS = ["#ff6b6b", "#ffa94d", "#ffd93d", "#69db7c", "#4dabf7", "#e599f7"];

/* ==================== ポップな配色 ====================
 * 数字ごとにキャンディカラーを割り当てる。0/5は合体成功で消える直前に一瞬だけ見える色
 * （0=同じ数字消去の紫、5=足して5のマゼンタピンク。3の黄色と紛らわしかったので離した）。 */
const CELL_COLORS = {
	0: { light: "#eebefa", base: "#e599f7", dark: "#be4bdb" },
	1: { light: "#ffa8a8", base: "#ff6b6b", dark: "#e03131" },
	2: { light: "#ffc078", base: "#ff922b", dark: "#e8590c" },
	3: { light: "#ffe066", base: "#ffd43b", dark: "#f08c00" },
	4: { light: "#8ce99a", base: "#51cf66", dark: "#2f9e44" },
	5: { light: "#ffb3d9", base: "#ff2d95", dark: "#c2185b" },
};

/* 事前生成した背景の水玉（毎フレーム乱数を振ると点滅して見えるので固定配置にする） */
const BG_DOTS = Array.from({ length: 18 }, () => ({
	x: Math.random() * W, y: Math.random() * H, r: 8 + Math.random() * 18,
}));

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う（style.cssにあった
 * 旧#xxx-btnの位置%指定をW×H基準のpxに変換した値）。 */
const BTN_LANG = { x: 254, y: 8, w: 96, h: 22 };
const BTN_UNDO = { x: 2, y: 490, w: 120, h: 50 };
const BTN_RESET = { x: 130, y: 490, w: 120, h: 50 };
const BTN_RENEW = { x: 260, y: 495, w: 95, h: 40 };
const BTN_YES = { x: 55, y: 335, w: 110, h: 50 };
const BTN_NO = { x: 195, y: 335, w: 110, h: 50 };
const BTN_NEXT = { x: 70, y: 490, w: 210, h: 50 };

function hitTestBtn(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/* 元のCSSボタンの「二層構造の押しボタン」見た目（box-shadowが下の板、本体が上の板）を再現する。
 * ポップな見た目にするため、上の板はグラデーション＋白フチを付ける。 */
function drawUIButton(rect, label, opts) {
	opts = opts || {};
	const radius = opts.radius != null ? opts.radius : 16;
	const shadowOffset = opts.shadowOffset != null ? opts.shadowOffset : 4;
	ctx.save();
	ctx.globalAlpha = opts.disabled ? 0.45 : 1;
	fillRoundRect(rect.x, rect.y + shadowOffset, rect.w, rect.h, radius, opts.shadow || "rgba(0,0,0,0.25)");
	const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
	grad.addColorStop(0, opts.top || opts.bg || "#ffffff");
	grad.addColorStop(1, opts.bg || "#ffffff");
	fillRoundRect(rect.x, rect.y, rect.w, rect.h, radius, grad);
	strokeRoundRect(rect.x + 1.5, rect.y + 1.5, rect.w - 3, rect.h - 3, radius - 1.5, "rgba(255,255,255,0.85)", 3);
	const size = fitFontSize(label, rect.w - 8, opts.size || 18, "bold");
	drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
		size, weight: "bold", align: "center", baseline: "middle",
		color: opts.color || "#ffffff", stroke: opts.textStroke, strokeWidth: 3,
	});
	ctx.restore();
}

/* シーン（ダイアログ表示中／クリア演出中／通常プレイ中）ごとに「今表示されているボタン」だけを描く */
function drawButtons() {
	const disabled = game.dialogVisible;
	if (!game.clearing) {
		drawUIButton(BTN_UNDO, t("undoBtn"), { top: "#74c0fc", bg: "#4dabf7", shadow: "#2f7dc9", disabled });
		drawUIButton(BTN_RESET, t("resetBtn"), { top: "#ff8fb3", bg: "#f06595", shadow: "#c23c6d", disabled });
		drawUIButton(BTN_RENEW, t("renewBtn"), { top: "#ffc078", bg: "#ff922b", shadow: "#d9720f", size: 16, disabled });
	}
	if (game.dialogButtonsVisible) {
		drawUIButton(BTN_YES, t("yesBtn"), { top: "#8ce99a", bg: "#51cf66", shadow: "#37a84a" });
		drawUIButton(BTN_NO, t("noBtn"), { top: "#ff8787", bg: "#fa5252", shadow: "#d9382e" });
	}
	if (game.clearing && game.nextBtnVisible) {
		drawUIButton(BTN_NEXT, t("nextBtn"), { top: "#ffe066", bg: "#fcc419", shadow: "#d9a300", size: 20, color: "#5c4400" });
	}
	drawUIButton(BTN_LANG, t("langBtn"), {
		top: "#e2d0ff", bg: "#c298f0", shadow: "rgba(0,0,0,0.25)", shadowOffset: 3,
		color: "#4a2b7a", size: 12, radius: 10,
	});
}

/* ==================== ゲーム全体で使用する変数 ==================== */
let level = 0;
let mergeNum = 0;
let plusFive = 0;
let sameNum = 0;
let answerCount = 0;
let game = null;

function createCell(number) {
	return { number, x: 0, y: 0, alpha: 1, scaleMul: 1, highlighted: false, shakeOffset: 0 };
}
function getGridX(cell) { return Math.round((cell.x - OFFSET_X) / CELL_SIZE); }
function getGridY(cell) { return Math.round((cell.y - OFFSET_Y) / CELL_SIZE); }

function gridView() {
	for (let x = 0; x < GRID_SIZE; x++) {
		for (let y = 0; y < GRID_SIZE; y++) {
			const cell = game.grid[x][y];
			if (cell) {
				cell.x = x * CELL_SIZE + OFFSET_X;
				cell.y = y * CELL_SIZE + OFFSET_Y;
			}
		}
	}
}

function createGrid() {
	let isSolvable = false;
	let grid;
	while (!isSolvable) {
		grid = [];
		let sum = 0;
		for (let x = 0; x < GRID_SIZE; x++) {
			grid[x] = [];
			for (let y = 0; y < GRID_SIZE; y++) {
				const number = Math.floor(Math.random() * 4) + 1;
				sum += number;
				grid[x][y] = createCell(number);
			}
		}
		if (sum % 2 === 0) isSolvable = true;
	}
	game.grid = grid;
	game.allCells = grid.flat();
	gridView();
	game.initialGrid = copyGrid();
}

function copyGrid() {
	return game.grid.map((row) =>
		row.map((cell) => (cell ? { x: getGridX(cell), y: getGridY(cell), number: cell.number } : null))
	);
}

function rebuildGridFrom(savedGrid) {
	game.grid = [];
	game.allCells = [];
	for (let x = 0; x < GRID_SIZE; x++) {
		game.grid[x] = [];
		for (let y = 0; y < GRID_SIZE; y++) {
			const data = savedGrid[x][y];
			if (data) {
				const cell = createCell(data.number);
				game.grid[x][y] = cell;
				game.allCells.push(cell);
			} else {
				game.grid[x][y] = null;
			}
		}
	}
	gridView();
}

/* ==================== 選択・操作ロジック ==================== */
function highlightSelectedCell(cell, highlight) {
	if (!cell) return;
	cell.highlighted = highlight;
}
function areAdjacent(cell1, cell2) {
	const dx = Math.abs(getGridX(cell1) - getGridX(cell2));
	const dy = Math.abs(getGridY(cell1) - getGridY(cell2));
	return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}
function startSelection(cell) {
	if (game.flgMoving) return;
	highlightSelectedCell(game.selectedCell, false);
	highlightSelectedCell(game.dragTarget, false);
	game.dragTarget = null;
	game.selectedCell = cell;
	highlightSelectedCell(cell, true);
}
function dragOver(cell) {
	if (game.flgMoving) return;
	if (game.selectedCell && areAdjacent(game.selectedCell, cell)) {
		if (game.dragTarget && game.dragTarget !== cell) {
			highlightSelectedCell(game.dragTarget, false);
		}
		game.dragTarget = cell;
		highlightSelectedCell(cell, true);
	}
}
function endSelection(cell) {
	if (game.flgMoving) return;
	if (!game.selectedCell) return;
	if (game.selectedCell !== cell) {
		if (game.dragTarget && areAdjacent(game.selectedCell, game.dragTarget)) {
			handleCellClick(game.dragTarget);
		} else if (areAdjacent(game.selectedCell, cell)) {
			handleCellClick(cell);
		}
	}
	highlightSelectedCell(game.selectedCell, false);
	highlightSelectedCell(game.dragTarget, false);
	game.selectedCell = null;
	game.dragTarget = null;
}

function removeCellFromView(cell) {
	const idx = game.allCells.indexOf(cell);
	if (idx >= 0) game.allCells.splice(idx, 1);
}

/* 合体成功時にスコアがふわっと浮かんで消えるポップアップ演出。原作にはない新規演出。
 * 次の操作をブロックしないので、目立たせるためにゆっくりめ。 */
function spawnScorePopup(x, y, text, color) {
	const popup = { x, y, alpha: 1, text, color };
	game.popups.push(popup);
	tween(popup, { y: y - 46, alpha: 0 }, 650, easeOutQuad, () => {
		const idx = game.popups.indexOf(popup);
		if (idx >= 0) game.popups.splice(idx, 1);
	});
}

/* 合体が成立した位置に星の欠片が弾ける演出（足して5用。派手さの主役なので個数・飛距離・
 * 持続時間を指定できる）。次の操作をブロックしないので、目立つようゆっくりめ・大きめにしている。
 * 原作にはない新規演出。 */
function spawnBurst(x, y, color, count, extraDist, duration) {
	count = count || 8;
	extraDist = extraDist != null ? extraDist : 16;
	duration = duration || 500;
	for (let i = 0; i < count; i++) {
		const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
		const dist = 30 + Math.random() * extraDist;
		const piece = { x, y, angle, color, size: 7 + Math.random() * 6, alpha: 1 };
		game.bursts.push(piece);
		tween(piece, {
			x: x + Math.cos(angle) * dist,
			y: y + Math.sin(angle) * dist,
			alpha: 0,
		}, duration, easeOutQuad, () => {
			const idx = game.bursts.indexOf(piece);
			if (idx >= 0) game.bursts.splice(idx, 1);
		});
	}
}

/* 同じ数字が消えるときに弾ける、小さな色の粒。次の操作をブロックしないので、
 * 目立つようゆっくりめ・大きめ・多めにしている。原作にはない新規演出。 */
function spawnCircleBurst(x, y, color, count) {
	count = count || 11;
	for (let i = 0; i < count; i++) {
		const angle = Math.random() * Math.PI * 2;
		const dist = 24 + Math.random() * 30;
		const piece = { x, y, color, size: 4 + Math.random() * 4, alpha: 1 };
		game.circleBursts.push(piece);
		tween(piece, {
			x: x + Math.cos(angle) * dist,
			y: y + Math.sin(angle) * dist,
			alpha: 0,
		}, 500 + Math.random() * 220, easeOutQuad, () => {
			const idx = game.circleBursts.indexOf(piece);
			if (idx >= 0) game.circleBursts.splice(idx, 1);
		});
	}
}

/* 足して5がそろった瞬間にパッと広がる光の輪。原作にはない新規演出。 */
function spawnSparkleRing(x, y) {
	const ring = { x, y, radius: 4, alpha: 0.9 };
	game.sparkles.push(ring);
	tween(ring, { radius: 48, alpha: 0 }, 450, easeOutQuad, () => {
		const idx = game.sparkles.indexOf(ring);
		if (idx >= 0) game.sparkles.splice(idx, 1);
	});
}

/* 左右に小刻みに揺れてから止まる「ぷるぷる」演出。原作にはない新規演出。
 * 振れ幅は控えめにしてある（大きく揺らすと「失敗した」ようなネガティブな印象になるため）。 */
function shakeCell(cellObj, onComplete) {
	const seq = [1.5, -1.5, 0.3, -0.3];
	let i = 0;
	function step() {
		if (i >= seq.length) {
			tween(cellObj, { shakeOffset: 0 }, 29, easeLinear, onComplete);
			return;
		}
		tween(cellObj, { shakeOffset: seq[i] }, 25, easeLinear, step);
		i++;
	}
	step();
}

/* 「イコールだから消える」を見せる演出：点滅を2往復してから、その場で拡大しつつ
 * 色の粒が弾けて消える。原作にはない新規演出（ユーザー要望）。 */
function playMatchClear(a, b, gainedScore, onComplete) {
	const color = CELL_COLORS[0];
	let blinkCount = 0;
	function blinkOut() {
		tween(a, { alpha: 0.2 }, 65, easeLinear);
		tween(b, { alpha: 0.2 }, 65, easeLinear, blinkIn);
	}
	function blinkIn() {
		tween(a, { alpha: 1 }, 65, easeLinear);
		tween(b, { alpha: 1 }, 65, easeLinear, () => {
			blinkCount++;
			if (blinkCount < 2) blinkOut();
			else popAndBurst();
		});
	}
	function popAndBurst() {
		tween(a, { scaleMul: 1.35 }, 101, easeOutBack);
		tween(b, { scaleMul: 1.35 }, 101, easeOutBack, () => {
			spawnCircleBurst(a.x, a.y, color.base);
			spawnCircleBurst(b.x, b.y, color.base);
			tween(a, { alpha: 0, scaleMul: 1.6 }, 158, easeLinear, () => removeCellFromView(a));
			tween(b, { alpha: 0, scaleMul: 1.6 }, 158, easeLinear, () => {
				removeCellFromView(b);
				spawnScorePopup((a.x + b.x) / 2, (a.y + b.y) / 2 - 15, "+" + gainedScore, color.dark);
				onComplete();
			});
		});
	}
	blinkOut();
}

/* 「足して5」を盛大に祝う演出：拡大→くっつく→「5」がドンと弾けるように大きくなって強調→
 * ピカピカ光る→最大の破裂。5になった瞬間が一番の見せ場になるよう、数字を切り替えるのは
 * くっついた後にして、そこで一番大きなパンチ拡大を入れている。原作にはない新規演出（ユーザー要望）。 */
function playFiveCelebration(selectedCell, cell, gainedScore, onComplete) {
	const color = CELL_COLORS[5];
	tween(selectedCell, { scaleMul: 1.15 }, 90, easeOutBack);
	tween(cell, { scaleMul: 1.15 }, 90, easeOutBack, () => {
		tween(selectedCell, { x: cell.x, y: cell.y, scaleMul: 1.1 }, 187, easeOutQuad, () => {
			tween(cell, { scaleMul: 1.1 }, 90, easeLinear);
			// くっついた瞬間に5へ切り替え、ここが一番大きく弾む「見せ場」
			selectedCell.number = 5;
			cell.number = 5;
			tween(selectedCell, { scaleMul: 1.9 }, 100, easeOutBack);
			tween(cell, { scaleMul: 1.9 }, 100, easeOutBack, () => {
				tween(selectedCell, { scaleMul: 1.4 }, 70, easeLinear);
				tween(cell, { scaleMul: 1.4 }, 70, easeLinear, () => {
					spawnSparkleRing(cell.x, cell.y);
					delay(60, () => spawnSparkleRing(cell.x, cell.y));
					delay(120, () => spawnSparkleRing(cell.x, cell.y));
					delay(180, () => {
						// 破裂本体は次の操作をブロックしないので、目立つよう大きく・長くしてある
						spawnBurst(cell.x, cell.y, color.base, 20, 34, 800);
						tween(selectedCell, { scaleMul: 2.1, alpha: 0 }, 160, easeLinear, () => removeCellFromView(selectedCell));
						tween(cell, { scaleMul: 2.1, alpha: 0 }, 160, easeLinear, () => {
							removeCellFromView(cell);
							spawnScorePopup(cell.x, cell.y - 24, "+" + gainedScore, color.dark);
							onComplete();
						});
					});
				});
			});
		});
	});
}

/* 通常の合体演出：スワイプ元がスワイプ先まで移動してくっつく→重なった状態で拡大→
 * 数字が足した数字に変わって震える→元のサイズに戻る→スワイプ元だけフェードして消える。
 * （合体前に両方の数字が変わると違和感があるため、数字は「くっついた後」に変える）
 * 原作にはない新規演出（ユーザー要望）。 */
function playNormalMerge(selectedCell, cell, diff, onComplete) {
	tween(selectedCell, { x: cell.x, y: cell.y }, 144, easeOutQuad, () => {
		tween(selectedCell, { scaleMul: 1.3 }, 101, easeOutBack);
		tween(cell, { scaleMul: 1.3 }, 101, easeOutBack, () => {
			selectedCell.number = diff;
			cell.number = diff;
			shakeCell(selectedCell);
			shakeCell(cell, () => {
				tween(selectedCell, { scaleMul: 1 }, 101, easeLinear);
				tween(cell, { scaleMul: 1 }, 101, easeLinear, () => {
					tween(selectedCell, { alpha: 0 }, 144, easeLinear, () => {
						removeCellFromView(selectedCell);
						onComplete();
					});
				});
			});
		});
	});
}

function handleCellClick(cell) {
	const selectedCell = game.selectedCell;
	if (!selectedCell) return;

	game.history.push(copyGrid());
	mergeNum++;
	game.flgMoving = true;

	let diff;
	if (selectedCell.number === cell.number) {
		diff = 0;
	} else {
		diff = selectedCell.number + cell.number;
		if (diff > 5) {
			answerCount += (5 * 11);
			diff -= 5;
		}
	}

	function finishMerge() {
		collapseGrid();
		shiftColumns();
		shiftColumns();
		game.flgMoving = false;

		if (checkClear()) {
			startClearEffect();
		} else {
			gridView();
		}
	}

	if (diff === 0) {
		sameNum++;
		const gainedScore = (selectedCell.number * 2) * 100;
		answerCount += gainedScore;
		game.grid[getGridX(cell)][getGridY(cell)] = null;
		game.grid[getGridX(selectedCell)][getGridY(selectedCell)] = null;
		playMatchClear(selectedCell, cell, gainedScore, finishMerge);
	} else if (diff === 5) {
		plusFive++;
		const gainedScore = 5 * 1111;
		answerCount += gainedScore;
		game.grid[getGridX(cell)][getGridY(cell)] = null;
		game.grid[getGridX(selectedCell)][getGridY(selectedCell)] = null;
		playFiveCelebration(selectedCell, cell, gainedScore, finishMerge);
	} else {
		game.grid[getGridX(selectedCell)][getGridY(selectedCell)] = null;
		playNormalMerge(selectedCell, cell, diff, finishMerge);
	}
}

function collapseGrid() {
	for (let x = 0; x < GRID_SIZE; x++) {
		let emptyCount = 0;
		for (let y = GRID_SIZE - 1; y >= 0; y--) {
			if (!game.grid[x][y]) {
				emptyCount++;
			} else if (emptyCount > 0) {
				game.grid[x][y + emptyCount] = game.grid[x][y];
				game.grid[x][y] = null;
			}
		}
	}
}
function shiftColumns() {
	for (let x = 0; x < GRID_SIZE; x++) {
		if (game.grid[x].every((cell) => !cell)) {
			for (let shiftX = x; shiftX < GRID_SIZE - 1; shiftX++) {
				game.grid[shiftX] = game.grid[shiftX + 1];
			}
			game.grid[GRID_SIZE - 1] = Array(GRID_SIZE).fill(null);
		}
	}
}
function checkClear() {
	return game.grid.flat().every((cell) => !cell);
}

function undo() {
	if (game.flgMoving || game.clearing) return;
	if (game.history.length === 0) return;
	const prevGrid = game.history.pop();
	rebuildGridFrom(prevGrid);
}
function resetGame() {
	if (game.flgMoving || game.clearing) return;
	game.history = [];
	rebuildGridFrom(game.initialGrid);
}
function startNewGame() {
	level++;
	createGrid();
}
function renewGame() {
	game.history = [];
	startNewGame();
}

/* ==================== 問題変更ダイアログ ==================== */
function showDialog() {
	if (game.flgMoving || game.clearing) return;
	game.dialogVisible = true;
	game.dialogButtonsVisible = true;
	tween(game, { dialogAlpha: 1 }, 360, easeLinear);
}
function hideDialog(after) {
	game.dialogButtonsVisible = false;
	tween(game, { dialogAlpha: 0 }, 216, easeLinear, () => {
		game.dialogVisible = false;
		if (after) after();
	});
}
function onYesClick() {
	hideDialog(() => {
		level--;
		renewGame();
	});
}
function onNoClick() {
	hideDialog();
}

/* ==================== クリア演出 ==================== */
function spawnConfettiPiece() {
	const size = Math.random() * 8 + 6;
	const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
	const shape = Math.random() < 0.5 ? "star" : "square";
	const piece = { size, color, shape, x: Math.random() * W, y: -size, rotation: Math.random() * Math.PI };
	game.confetti.push(piece);
	const duration = (3 + Math.random() * 2) * 1000;
	tween(piece, {
		y: H + 20,
		x: piece.x + (Math.random() * 100 - 50),
		rotation: piece.rotation + Math.PI * 4,
	}, duration, easeInSine, () => {
		const idx = game.confetti.indexOf(piece);
		if (idx >= 0) game.confetti.splice(idx, 1);
	});
}

function startClearEffect() {
	game.clearing = true;
	game.nextBtnVisible = false;

	game.circle = { x: W / 2, y: 350, scale: 0.01 };
	game.message = { alpha: 0, scale: 0.3 };
	game.resultPlus = { alpha: 0 };
	game.resultSame = { alpha: 0 };
	game.resultMerge = { alpha: 0 };
	game.resultThanks = { alpha: 0 };
	game.confetti = [];
	game.confettiTimer = 0;

	tween(game.circle, { scale: 35 }, 650, easeOutQuad, () => {
		game.nextBtnVisible = true;
		tween(game.message, { alpha: 1, scale: 1 }, 400, easeOutBack, () => {
			tween(game.resultPlus, { alpha: 1 }, 200, easeLinear, () => {
				tween(game.resultSame, { alpha: 1 }, 200, easeLinear, () => {
					tween(game.resultMerge, { alpha: 1 }, 200, easeLinear, () => {
						tween(game.resultThanks, { alpha: 1 }, 200, easeLinear);
					});
				});
			});
		});
	});
}
function onNextClick() {
	game.nextBtnVisible = false;
	game.clearing = false;
	game.confetti = [];
	renewGame();
}

/* ==================== 初期化 ==================== */
function initGame() {
	level = 0;
	answerCount = 0;
	mergeNum = 0; plusFive = 0; sameNum = 0;
	game = {
		grid: [], allCells: [], history: [], initialGrid: [],
		selectedCell: null, dragTarget: null, flgMoving: false,
		dialogVisible: false, dialogButtonsVisible: false, dialogAlpha: 0,
		clearing: false, nextBtnVisible: false, circle: null, message: null,
		resultPlus: null, resultSame: null, resultMerge: null, resultThanks: null,
		confetti: [], confettiTimer: 0, popups: [], bursts: [], circleBursts: [], sparkles: [],
	};
	startNewGame();
}

/* ==================== ポインター操作 ==================== */
function hitTestCell(px, py) {
	for (const cell of game.allCells) {
		const dx = px - cell.x, dy = py - cell.y;
		if (dx * dx + dy * dy <= 27 * 27) return cell;
	}
	return null;
}
function canvasPos(clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) };
}
function inputBlocked() {
	return game.flgMoving || game.dialogVisible || game.clearing;
}
canvas.addEventListener("pointerdown", (e) => {
	const p = canvasPos(e.clientX, e.clientY);

	if (hitTestBtn(BTN_LANG, p.x, p.y)) {
		e.preventDefault();
		setLang(lang === "ja" ? "en" : "ja");
		return;
	}
	if (game.dialogVisible) {
		if (game.dialogButtonsVisible) {
			if (hitTestBtn(BTN_YES, p.x, p.y)) { e.preventDefault(); onYesClick(); return; }
			if (hitTestBtn(BTN_NO, p.x, p.y)) { e.preventDefault(); onNoClick(); return; }
		}
		return; // ダイアログ表示中は背後のグリッド操作を受け付けない
	}
	if (game.clearing) {
		if (game.nextBtnVisible && hitTestBtn(BTN_NEXT, p.x, p.y)) { e.preventDefault(); onNextClick(); }
		return; // クリア演出中はグリッド操作を受け付けない
	}
	if (hitTestBtn(BTN_UNDO, p.x, p.y)) { e.preventDefault(); undo(); return; }
	if (hitTestBtn(BTN_RESET, p.x, p.y)) { e.preventDefault(); resetGame(); return; }
	if (hitTestBtn(BTN_RENEW, p.x, p.y)) { e.preventDefault(); showDialog(); return; }

	if (inputBlocked()) return;
	const cell = hitTestCell(p.x, p.y);
	if (cell) { startSelection(cell); e.preventDefault(); }
});
canvas.addEventListener("pointermove", (e) => {
	if (inputBlocked()) return;
	const p = canvasPos(e.clientX, e.clientY);
	const cell = hitTestCell(p.x, p.y);
	if (cell) dragOver(cell);
});
canvas.addEventListener("pointerup", (e) => {
	if (inputBlocked()) return;
	const p = canvasPos(e.clientX, e.clientY);
	const cell = hitTestCell(p.x, p.y);
	if (cell) endSelection(cell);
});

/* ==================== 描画 ==================== */
function drawBackground() {
	const grad = ctx.createLinearGradient(0, 0, 0, H);
	grad.addColorStop(0, "#fff3e0");
	grad.addColorStop(0.5, "#ffe3ef");
	grad.addColorStop(1, "#e3f5ff");
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, W, H);
	ctx.save();
	ctx.globalAlpha = 0.35;
	ctx.fillStyle = "#ffffff";
	BG_DOTS.forEach((d) => {
		ctx.beginPath();
		ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
		ctx.fill();
	});
	ctx.restore();
}

function drawUIFrame() {
	// ヘッダーカード（ピンク→オレンジ→イエローのグラデーション）。
	// 1段目にロゴ本体＋言語切替ボタン、2段目にサブタイトルを幅いっぱい使って配置する
	// （英語版はサブタイトルが長く、1段組だとlang-btnと衝突していたため2段組にした）。
	const headerGrad = ctx.createLinearGradient(4, 0, W - 4, 0);
	headerGrad.addColorStop(0, "#ff6ec7");
	headerGrad.addColorStop(0.55, "#ff9f43");
	headerGrad.addColorStop(1, "#ffd93d");
	fillRoundRect(4, 4, W - 8, 52, 18, headerGrad);
	strokeRoundRect(4, 4, W - 8, 52, 18, "rgba(255,255,255,0.6)", 3);

	const logoMain = t("logoMain");
	const logoMaxWidth = BTN_LANG.x - 14 - 8;
	const logoSize = fitFontSize(logoMain, logoMaxWidth, 19, "bold");
	drawText(logoMain, 14, 18, {
		size: logoSize, weight: "bold", italic: true, align: "left", baseline: "middle",
		color: "#ffffff", stroke: "#c2255c", strokeWidth: 4,
	});
	const subSize = fitFontSize(t("logoSub"), W - 28, 13, "bold");
	drawText(t("logoSub"), 14, 42, {
		size: subSize, weight: "bold", align: "left", baseline: "middle",
		color: "#ffffff", stroke: "#c2255c", strokeWidth: 2,
	});

	// スコアバッジ（文字量に応じて幅が伸びる丸ピル）
	const scoreText = t("scoreFmt")(answerCount);
	ctx.save();
	ctx.font = "bold 16px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif";
	const scoreTextW = ctx.measureText(scoreText).width;
	ctx.restore();
	const badgeW = scoreTextW + 26;
	const scoreGrad = ctx.createLinearGradient(8, 60, 8, 82);
	scoreGrad.addColorStop(0, "#ffe066");
	scoreGrad.addColorStop(1, "#fcc419");
	fillRoundRect(8, 60, badgeW, 22, 11, scoreGrad);
	strokeRoundRect(8, 60, badgeW, 22, 11, "#ffffff", 2.5);
	drawText(scoreText, 8 + badgeW / 2, 72, {
		size: 16, weight: "bold", align: "center", baseline: "middle", color: "#5c4400",
	});

	// ルールカード（グリッド1行目の直前=y:180ぎりぎりまでを使う）
	fillRoundRect(4, 86, W - 8, 90, 16, "#fffdf6");
	strokeRoundRect(4, 86, W - 8, 90, 16, "#ffd0e8", 3);
	const ruleKeys = ["ruleTitle", "rule1", "rule2", "rule3", "rule4"];
	const ruleColors = ["#e8590c", "#495057", "#495057", "#495057", "#495057"];
	const ruleWeights = ["bold", "", "", "", ""];
	const ruleYs = [94, 109, 124, 139, 154];
	ruleKeys.forEach((key, i) => {
		const size = fitFontSize(t(key), W - 24, 14, ruleWeights[i]);
		drawText(t(key), 14, ruleYs[i], {
			size, weight: ruleWeights[i], align: "left", baseline: "top", color: ruleColors[i],
		});
	});
}

function drawGrid() {
	const now = performance.now();
	game.allCells.forEach((cell) => {
		const colors = CELL_COLORS[cell.number] || CELL_COLORS[4];
		const r = 25 * cell.scaleMul;
		const cx = cell.x + (cell.shakeOffset || 0);
		const cy = cell.y;
		ctx.save();
		ctx.globalAlpha = cell.alpha;

		// 選択中はゴールドの光彩がゆっくり脈打つ
		if (cell.highlighted) {
			const pulse = 1 + 0.1 * Math.sin(now * 0.008);
			ctx.beginPath();
			ctx.arc(cx, cy, (r + 7) * pulse, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(255, 215, 0, 0.55)";
			ctx.fill();
		}

		// 落ち影
		ctx.beginPath();
		ctx.arc(cx + 1.5, cy + 3, r, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(0,0,0,0.15)";
		ctx.fill();

		// 本体（キャンディ玉風のラジアルグラデーション）
		const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r);
		grad.addColorStop(0, colors.light);
		grad.addColorStop(1, colors.base);
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fillStyle = grad;
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = "#ffffff";
		ctx.stroke();

		// 光沢ハイライト
		ctx.beginPath();
		ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.38, r * 0.2, -0.4, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(255,255,255,0.6)";
		ctx.fill();

		// 「5」は達成感を強調するため数字自体を一回り大きく描く
		drawText(String(cell.number), cx, cy + 1, {
			size: cell.number === 5 ? 27 : 21, weight: "bold", align: "center", baseline: "middle",
			color: "#ffffff", stroke: colors.dark, strokeWidth: 3,
		});
		ctx.restore();
	});
}

/* 合体演出のパーティクル一式（光の輪／色の粒／星の破裂／スコアポップアップ）。原作にはない新規演出。 */
function drawEffects() {
	game.sparkles.forEach((s) => {
		ctx.save();
		ctx.globalAlpha = s.alpha;
		ctx.beginPath();
		ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
		ctx.strokeStyle = "#fff3bf";
		ctx.lineWidth = 4;
		ctx.stroke();
		ctx.restore();
	});
	game.circleBursts.forEach((p) => {
		ctx.save();
		ctx.globalAlpha = p.alpha;
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
		ctx.fillStyle = p.color;
		ctx.fill();
		ctx.restore();
	});
	game.bursts.forEach((p) => {
		ctx.save();
		ctx.globalAlpha = p.alpha;
		drawStarPath(p.x, p.y, 4, p.size, p.size * 0.45);
		ctx.fillStyle = p.color;
		ctx.fill();
		ctx.restore();
	});
	game.popups.forEach((p) => {
		ctx.save();
		ctx.globalAlpha = p.alpha;
		drawText(p.text, p.x, p.y, {
			size: 22, weight: "bold", align: "center", baseline: "middle",
			color: p.color, stroke: "#ffffff", strokeWidth: 4,
		});
		ctx.restore();
	});
}

function drawDialog() {
	if (game.dialogAlpha <= 0) return;
	ctx.save();
	ctx.globalAlpha = game.dialogAlpha;
	ctx.fillStyle = "rgba(80, 40, 90, 0.55)";
	ctx.fillRect(0, 0, W, H);
	fillRoundRect(30, 230, 300, 180, 22, "#fffdf6");
	strokeRoundRect(30, 230, 300, 180, 22, "#ffb3d9", 4);
	const msg = wrapText(t("dialogMessage"), 250, 18, "");
	drawText(msg, W / 2, 252, {
		size: 18, weight: "bold", align: "center", baseline: "top", color: "#4a2b57", lineHeight: 24,
	});
	ctx.restore();
}

/* カラフルな水玉の区切り線。原作の単色線をポップにアレンジ。 */
function drawDotDivider(y) {
	const colors = ["#ff8787", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#e599f7"];
	let i = 0;
	for (let x = 14; x < W - 14; x += 18) {
		ctx.beginPath();
		ctx.arc(x, y, 4, 0, Math.PI * 2);
		ctx.fillStyle = colors[i % colors.length];
		ctx.fill();
		i++;
	}
}

function drawClearEffect() {
	const radius = Math.max(0, 5 * game.circle.scale);
	const circGrad = ctx.createRadialGradient(game.circle.x, game.circle.y, 0, game.circle.x, game.circle.y, Math.max(1, radius));
	circGrad.addColorStop(0, "#fff9db");
	circGrad.addColorStop(0.7, "#ffe066");
	circGrad.addColorStop(1, "#ffd43b");
	ctx.save();
	ctx.beginPath();
	ctx.arc(game.circle.x, game.circle.y, radius, 0, Math.PI * 2);
	ctx.fillStyle = circGrad;
	ctx.fill();
	ctx.restore();

	ctx.save();
	ctx.globalAlpha = game.message.alpha;
	ctx.translate(W / 2, 230);
	ctx.scale(game.message.scale, game.message.scale);
	drawText(t("clearMessage"), 0, 0, {
		size: fitFontSize(t("clearMessage"), W - 30, 46, "bold"), weight: "bold",
		align: "center", baseline: "middle", color: "#ff4d94", stroke: "#ffffff", strokeWidth: 6,
	});
	ctx.restore();

	drawDotDivider(275);

	const resultRows = [
		[game.resultPlus, t("resultPlusFmt")(plusFive), "#e8590c"],
		[game.resultSame, t("resultSameFmt")(sameNum), "#9c36b5"],
		[game.resultMerge, t("resultMergeFmt")(mergeNum), "#1971c2"],
	];
	const resultYs = [290, 325, 360];
	resultRows.forEach(([state, text, color], i) => {
		ctx.save();
		ctx.globalAlpha = state.alpha;
		const size = fitFontSize(text, W - 20, 22, "bold");
		drawText(text, 10, resultYs[i], { size, weight: "bold", align: "left", baseline: "top", color });
		ctx.restore();
	});

	drawDotDivider(400);

	const thanksText = level === 1 ? t("thanksFirst") : t("thanksRepeatFmt")(level);
	ctx.save();
	ctx.globalAlpha = game.resultThanks.alpha;
	drawText(wrapText(thanksText, W - 40, 18, ""), W / 2, 420, {
		size: 18, weight: "bold", align: "center", baseline: "top", color: "#7048e8", lineHeight: 27,
	});
	ctx.restore();

	game.confetti.forEach((p) => {
		ctx.save();
		ctx.globalAlpha = p.alpha != null ? p.alpha : 1;
		ctx.translate(p.x, p.y);
		ctx.rotate(p.rotation);
		ctx.fillStyle = p.color;
		if (p.shape === "star") {
			drawStarPath(0, 0, 5, p.size * 0.6, p.size * 0.28);
			ctx.fill();
		} else {
			ctx.fillRect(-p.size / 2, -p.size * 0.2, p.size, p.size * 0.4);
		}
		ctx.restore();
	});
}

function draw() {
	ctx.clearRect(0, 0, W, H);
	drawBackground();

	drawUIFrame();
	drawGrid();
	drawEffects();
	drawDialog();
	if (game.clearing) drawClearEffect();
	drawButtons();
}

/* ==================== メインループ ==================== */
let lastTime = performance.now();
function frame(now) {
	const deltaMs = Math.min(now - lastTime, 100);
	lastTime = now;

	updateTweens(deltaMs);
	if (game.clearing) {
		game.confettiTimer += deltaMs;
		while (game.confettiTimer >= 100) {
			game.confettiTimer -= 100;
			for (let i = 0; i < 5; i++) spawnConfettiPiece();
		}
	}

	draw();
	requestAnimationFrame(frame);
}

/* ==================== 起動 ==================== */
document.title = t("pageTitle");
initGame();
requestAnimationFrame(frame);
