"use strict";

/* ==================== 基本設定 ==================== */
const W = 360, H = 548;

/* ==================== 配色パレット（クラフト紙風の薄茶色。style.cssの:root変数と対応） ==================== */
const COLOR = {
	bgGame: "#f1e6d0",
	bgPanel: "#faf3e6",
	accentBlue: "#a9855f",
	accentBlueDeep: "#7d6040",
	accentTerracotta: "#f0975c",
	accentTerracottaDeep: "#d4763a",
	textMain: "#4a3826",
	textSoft: "#6b5540",
	rose: "#c1594f",
	logo: "#c17a3f",
};

/* ==================== 画像ロード ==================== */
const IMG = {};
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("failed to load " + src));
		img.src = src;
	});
}
async function loadAllImages() {
	const [daimao] = await Promise.all([loadImage("daimao.png")]);
	IMG.daimao = daimao;
}

/* ==================== Canvas 基本ヘルパー ==================== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

function makeSprite(img, opts) {
	return Object.assign({
		img, x: 0, y: 0, anchorX: 0, anchorY: 0,
		scaleX: 1, scaleY: 1, rotation: 0, alpha: 1,
		tint: null, visible: true,
	}, opts || {});
}
function drawSprite(s) {
	if (!s.visible || !s.img) return;
	const w = s.img.width, h = s.img.height;
	ctx.save();
	ctx.globalAlpha = s.alpha;
	ctx.translate(s.x, s.y);
	ctx.rotate(s.rotation);
	ctx.scale(s.scaleX, s.scaleY);
	const ax = s.anchorX * w, ay = s.anchorY * h;
	ctx.drawImage(s.img, -ax, -ay);
	if (s.tint) {
		ctx.globalCompositeOperation = "source-atop";
		ctx.fillStyle = s.tint;
		ctx.fillRect(-ax, -ay, w, h);
		ctx.globalCompositeOperation = "source-over";
	}
	ctx.restore();
}

function drawText(text, x, y, opts) {
	opts = opts || {};
	const size = opts.size || 16;
	const weight = opts.weight || "";
	const align = opts.align || "left";
	const baseline = opts.baseline || "alphabetic";
	const lineHeight = opts.lineHeight || size * 1.3;
	ctx.save();
	ctx.font = (weight + " " + size + "px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif").trim();
	ctx.textAlign = align;
	ctx.textBaseline = baseline;
	String(text).split("\n").forEach((line, i) => {
		const ly = y + i * lineHeight;
		if (opts.shadow) {
			ctx.fillStyle = "rgba(0,0,0,0.35)";
			ctx.fillText(line, x + 1.5, ly + 2);
		}
		if (opts.strokeWidth && opts.stroke) {
			ctx.lineWidth = opts.strokeWidth;
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
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.stroke();
	ctx.restore();
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
function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
// 0→1の進行度を受け取り、少しオーバーシュートしてから収まる「ポン」というポップ感を出す
function easeOutBack(t) {
	const c1 = 1.70158, c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/* ==================== 二分木 ==================== */
class TreeNode {
	constructor(value) {
		this.value = value;
		this.left = null;
		this.right = null;
	}
}
class BinaryTree {
	constructor() { this.root = null; }
	insert(value) {
		const newNode = new TreeNode(value);
		if (!this.root) this.root = newNode;
		else this._insertRec(this.root, newNode);
	}
	_insertRec(node, newNode) {
		if (newNode.value < node.value) {
			if (!node.left) node.left = newNode;
			else this._insertRec(node.left, newNode);
		} else {
			if (!node.right) node.right = newNode;
			else this._insertRec(node.right, newNode);
		}
	}
}

/* ==================== 二分木ビュー（レイアウト計算・描画・ドラッグ操作） ==================== */
// Pixi版のBinaryTreeVisualizerに相当。ノードをつまんで動かすと少し追従し、
// 離すと元の位置へ戻る「ぷるぷる」演出つきの二分木ビジュアライザ。
function createTreeView(tree, opts) {
	const view = {
		tree,
		opts: Object.assign({
			x: 0, y: 50, nodeRadius: 20, levelDistance: 60, initialHDist: 100,
			highlightValue: null, revealAnswer: false, leftAlign: false, centerAlign: false,
			centerX: W / 2, maxWidth: W - 20, maxHeight: Infinity,
		}, opts || {}),
		nodes: [], lines: [], scale: 1, revealedAt: null,
		dragIndex: -1, dragStartX: 0, dragStartY: 0, dragOffX: 0, dragOffY: 0,
	};

	view.rebuild = function () {
		view.nodes = [];
		view.lines = [];
		// 二分探索木は中順(in-order)に並べると値が昇順になる。その順番どおりにx-indexを
		// 割り当てれば兄弟同士は交差しない。さらに祖先ノードを子孫の重心へ寄せることで、
		// 値が大きく飛ぶ親子関係でも線が離れたノード群の上を横切りにくくする。
		const order = [];
		const depthMap = new Map();
		function inorder(node, depth) {
			if (!node) return;
			inorder(node.left, depth + 1);
			depthMap.set(node, depth);
			order.push(node);
			inorder(node.right, depth + 1);
		}
		inorder(view.tree.root, 0);

		const n = order.length;
		const xIndex = new Map();
		order.forEach((node, idx) => xIndex.set(node, idx));
		function refineX(node) {
			if (!node) return;
			refineX(node.left);
			refineX(node.right);
			if (node.left && node.right) {
				xIndex.set(node, (xIndex.get(node.left) + xIndex.get(node.right)) / 2);
			} else if (node.left) {
				xIndex.set(node, (xIndex.get(node.left) + xIndex.get(node)) / 2);
			} else if (node.right) {
				xIndex.set(node, (xIndex.get(node.right) + xIndex.get(node)) / 2);
			}
		}
		refineX(view.tree.root);

		const spacing = Math.max(view.opts.nodeRadius * 2.4, 24);
		const nodeMap = new Map();
		order.forEach((node) => {
			const x = view.opts.x + (xIndex.get(node) - (n - 1) / 2) * spacing;
			const y = view.opts.y + depthMap.get(node) * view.opts.levelDistance;
			const isHL = node.value === view.opts.highlightValue;
			const nodeObj = { value: node.value, x, y, isHL };
			view.nodes.push(nodeObj);
			nodeMap.set(node, nodeObj);
		});

		function buildLines(node) {
			if (!node) return;
			const parentObj = nodeMap.get(node);
			if (node.left) {
				const childObj = nodeMap.get(node.left);
				view.lines.push({ x1: parentObj.x, y1: parentObj.y, x2: childObj.x, y2: childObj.y, dir: -1 });
				buildLines(node.left);
			}
			if (node.right) {
				const childObj = nodeMap.get(node.right);
				view.lines.push({ x1: parentObj.x, y1: parentObj.y, x2: childObj.x, y2: childObj.y, dir: 1 });
				buildLines(node.right);
			}
		}
		buildLines(view.tree.root);

		view.scale = 1;
		if (view.opts.leftAlign && view.nodes.length) {
			const leftmostX = Math.min(...view.nodes.map((n) => n.x));
			const offsetX = -leftmostX + 25;
			const offsetY = 30;
			view.nodes.forEach((n) => { n.x += offsetX; n.y += offsetY; });
			view.lines.forEach((l) => { l.x1 += offsetX; l.y1 += offsetY; l.x2 += offsetX; l.y2 += offsetY; });
		} else if (view.opts.centerAlign && view.nodes.length) {
			// 木の全体サイズが枠を超える場合は縦横とも縮小して、数字が増えても画面から見切れないようにする
			const xs = view.nodes.map((n) => n.x);
			const maxY = Math.max(...view.nodes.map((n) => n.y));
			const minX = Math.min(...xs), maxX = Math.max(...xs);
			const pad = view.opts.nodeRadius + 10;
			const treeWidth = (maxX - minX) + pad * 2;
			const treeHeight = (maxY - view.opts.y) + pad;
			const scaleX = Math.min(1, view.opts.maxWidth / treeWidth);
			const scaleY = Math.min(1, view.opts.maxHeight / treeHeight);
			const scale = Math.min(scaleX, scaleY);
			const midX = (minX + maxX) / 2;
			const cx = view.opts.centerX;
			const baseY = view.opts.y;
			view.nodes.forEach((n) => {
				n.x = (n.x - midX) * scale + cx;
				n.y = (n.y - baseY) * scale + baseY;
			});
			view.lines.forEach((l) => {
				l.x1 = (l.x1 - midX) * scale + cx;
				l.x2 = (l.x2 - midX) * scale + cx;
				l.y1 = (l.y1 - baseY) * scale + baseY;
				l.y2 = (l.y2 - baseY) * scale + baseY;
			});
			view.scale = scale;
		}
		view.dragIndex = -1;
		view.dragOffX = 0; view.dragOffY = 0;
	};
	view.rebuild();

	view.nodeRadiusAt = function (n) {
		return (n.isHL ? view.opts.nodeRadius * 1.5 : view.opts.nodeRadius) * view.scale;
	};

	view.hitTest = function (x, y) {
		for (let i = view.nodes.length - 1; i >= 0; i--) {
			const n = view.nodes[i];
			if (Math.hypot(x - n.x, y - n.y) <= view.nodeRadiusAt(n)) return i;
		}
		return -1;
	};

	view.onPointerDown = function (x, y) {
		const idx = view.hitTest(x, y);
		if (idx < 0) return false;
		view.dragIndex = idx;
		view.dragStartX = x; view.dragStartY = y;
		view.dragOffX = 0; view.dragOffY = 0;
		return true;
	};
	view.onPointerMove = function (x, y) {
		if (view.dragIndex < 0) return;
		view.dragOffX = x - view.dragStartX;
		view.dragOffY = y - view.dragStartY;
	};
	view.onPointerUp = function () {
		view.dragIndex = -1;
		view.dragOffX = 0; view.dragOffY = 0;
	};

	// timeMs: 経過ミリ秒（実時間）。ぷるぷる演出は実時間で駆動するのでdelta対応は不要。
	view.draw = function (offsetX, timeMs) {
		if (view.opts.revealAnswer && view.revealedAt === null) view.revealedAt = timeMs;
		if (!view.opts.revealAnswer) view.revealedAt = null;
		view.lines.forEach((l, i) => {
			const wob = Math.sin(timeMs * 0.002 + i) * 1.5 * -l.dir;
			ctx.save();
			ctx.strokeStyle = COLOR.textSoft;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(offsetX + l.x1 + wob, l.y1 + wob);
			ctx.lineTo(offsetX + l.x2 + wob, l.y2 + wob);
			ctx.stroke();
			ctx.restore();
		});
		// ？マーク（isHLノード）は常に最前面に描画し、後から増える数字の下に隠れないようにする
		const drawOrder = view.nodes.map((_, i) => i).sort((a, b) => (view.nodes[a].isHL ? 1 : 0) - (view.nodes[b].isHL ? 1 : 0));
		drawOrder.forEach((i) => {
			const n = view.nodes[i];
			let dx = 0, dy = 0;
			if (view.dragIndex === i) { dx = view.dragOffX; dy = view.dragOffY; }
			const pulse = 1 + 0.03 * Math.sin(timeMs * 0.004 + i * 1.3);
			// 正解が明かされた瞬間、答えのノードだけ「ポン」と弾ませて目を引く
			let popScale = 1;
			if (n.isHL && view.opts.revealAnswer && view.revealedAt !== null) {
				const dur = 480;
				const elapsed = timeMs - view.revealedAt;
				if (elapsed < dur) popScale = Math.max(0.1, easeOutBack(elapsed / dur));
			}
			const r = view.nodeRadiusAt(n) * pulse * popScale;
			const nx = offsetX + n.x + dx, ny = n.y + dy;
			ctx.save();
			ctx.beginPath();
			ctx.arc(nx, ny, r, 0, Math.PI * 2);
			ctx.fillStyle = n.isHL ? COLOR.accentTerracotta : COLOR.accentBlue;
			ctx.fill();
			ctx.strokeStyle = n.isHL ? COLOR.accentTerracottaDeep : COLOR.accentBlueDeep;
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.restore();
			const label = n.isHL && !view.opts.revealAnswer ? "？" : String(n.value);
			const rot = n.isHL && !view.opts.revealAnswer ? 0.08 * Math.sin(timeMs * 0.006) : 0;
			ctx.save();
			ctx.translate(nx, ny);
			ctx.rotate(rot);
			drawText(label, 0, 1, {
				size: (n.isHL ? 26 : 20) * view.scale * popScale,
				weight: "bold", align: "center", baseline: "middle", color: "#ffffff",
				stroke: "rgba(0,0,0,0.18)", strokeWidth: 2,
			});
			ctx.restore();
		});
	};

	return view;
}

// 現在ドラッグ操作を受け付けている二分木ビュー（タイトルのデモ or メインの本番）
let activeTreeView = null;

function canvasPos(clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	return {
		x: (clientX - rect.left) * (W / rect.width),
		y: (clientY - rect.top) * (H / rect.height),
	};
}
canvas.addEventListener("pointermove", (e) => {
	if (!activeTreeView) return;
	const p = canvasPos(e.clientX, e.clientY);
	activeTreeView.onPointerMove(p.x, p.y);
});
canvas.addEventListener("pointerup", () => { if (activeTreeView) activeTreeView.onPointerUp(); });
canvas.addEventListener("pointerout", () => { if (activeTreeView) activeTreeView.onPointerUp(); });

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う。
 * 矩形はstyle.css（旧HTML版）の%指定をW×H(360×548)基準のpxに変換したもの。 */
const BTN_LANG = { x: 8, y: 7, w: 94, h: 27 };
const BTN_START = { x: 100, y: 480, w: 160, h: 50 };
const BTN_PREV = { x: 20, y: 395, w: 60, h: 60 };
const BTN_NEXT = { x: 280, y: 395, w: 60, h: 60 };
const BTN_MINUS = { x: 60, y: 489, w: 60, h: 48 };
const BTN_PLUS = { x: 240, y: 489, w: 60, h: 48 };
const BTN_ANSWER = { x: 120, y: 451, w: 120, h: 34 };
const BTN_PROCEED = { x: 243, y: 486, w: 70, h: 56 };
const BTN_TOTITLE = { x: 60, y: 488, w: 240, h: 40 };

function hitTestBtn(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function drawButton(rect, label, opts) {
	opts = opts || {};
	const radius = opts.radius != null ? opts.radius : 8;
	fillRoundRect(rect.x, rect.y, rect.w, rect.h, radius, opts.bg || "rgba(0,0,0,0.6)");
	if (label) {
		// 英語版は日本語版よりテキストが長くなりがちなので、幅に収まるようfitFontSizeで自動縮小する
		const size = fitFontSize(label, rect.w - (opts.pad != null ? opts.pad : 10), opts.size || 16, "bold");
		drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
			size, weight: "bold", align: "center", baseline: "middle",
			color: opts.color || "#fff", shadow: opts.textShadow, stroke: opts.stroke, strokeWidth: opts.strokeWidth,
		});
	}
}

function drawTriangleBtn(rect, dir, opts) {
	opts = opts || {};
	fillRoundRect(rect.x, rect.y, rect.w, rect.h, opts.radius != null ? opts.radius : 8, opts.bg || COLOR.accentTerracotta);
	const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
	const size = Math.min(rect.w, rect.h) * 0.28;
	ctx.save();
	ctx.fillStyle = opts.color || "#fff";
	ctx.beginPath();
	if (dir === "left") {
		ctx.moveTo(cx + size * 0.6, cy - size);
		ctx.lineTo(cx - size * 0.7, cy);
		ctx.lineTo(cx + size * 0.6, cy + size);
	} else {
		ctx.moveTo(cx - size * 0.6, cy - size);
		ctx.lineTo(cx + size * 0.7, cy);
		ctx.lineTo(cx - size * 0.6, cy + size);
	}
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function drawLangButton() {
	drawButton(BTN_LANG, t("langBtn"), { bg: "rgba(58,63,75,0.85)", color: "#fff", size: 13, textShadow: true });
}

/* シーンごとに「今表示されているボタン」だけをヒットテストする。ヒットしたら true を返す。 */
function handleButtonPointerDown(x, y) {
	if (scene !== "gameplay" && hitTestBtn(BTN_LANG, x, y)) {
		setLang(lang === "ja" ? "en" : "ja");
		return true;
	}
	if (scene === "title" && titleState) {
		if (hitTestBtn(BTN_START, x, y)) { goToMain(); return true; }
		if (hitTestBtn(BTN_PREV, x, y)) { titleState.changePage(-1); return true; }
		if (hitTestBtn(BTN_NEXT, x, y)) { titleState.changePage(1); return true; }
	} else if (scene === "gameplay" && gameplayState) {
		if (gameplayState.seikai) {
			if (hitTestBtn(BTN_PROCEED, x, y)) { gameplayState.proceed(); return true; }
		} else {
			if (hitTestBtn(BTN_MINUS, x, y)) { makeHoldButton(() => gameplayState.changeValue(-1)); return true; }
			if (hitTestBtn(BTN_PLUS, x, y)) { makeHoldButton(() => gameplayState.changeValue(1)); return true; }
			if (hitTestBtn(BTN_ANSWER, x, y)) { gameplayState.submitAnswer(); return true; }
		}
	} else if (scene === "clear") {
		if (hitTestBtn(BTN_TOTITLE, x, y)) { goToTitle(); return true; }
	}
	return false;
}

canvas.addEventListener("pointerdown", (e) => {
	const p = canvasPos(e.clientX, e.clientY);
	if (handleButtonPointerDown(p.x, p.y)) { e.preventDefault(); return; }
	if (!activeTreeView) return;
	if (activeTreeView.onPointerDown(p.x, p.y)) e.preventDefault();
});

/* ==================== レベル設定・デモページ設定 ==================== */
const LEVEL_CONFIG = [
	null,
	{ min: 1, max: 5, treeNum: 3 },
	{ min: 1, max: 7, treeNum: 4 },
	{ min: 1, max: 9, treeNum: 5 },
	{ min: 1, max: 12, treeNum: 6 },
	{ min: 1, max: 15, treeNum: 7 },
];
const TITLE_DEMO_PAGES = [
	{ input: [2, 4, 1, 3, 5], highlight: null, reveal: false },
	{ input: [2, 4], highlight: null, reveal: false },
	{ input: [2, 4, 3], highlight: null, reveal: false },
	{ input: [2, 4, 3, 1, 5], highlight: null, reveal: false },
	{ input: [3, 5, 4, 2, 1], highlight: 4, reveal: false },
	{ input: [1, 4, 5], highlight: 4, reveal: false },
	{ input: [1, 4, 5, 3], highlight: 4, reveal: false },
	{ input: [1, 4, 5, 3], highlight: 4, reveal: true },
	{ special: true },
];

/* ==================== シーン管理 ==================== */
let scene = "title"; // "title" | "gameplay" | "clear"
let titleState = null;
let gameplayState = null;
let clearState = null;
let level = 0;
let answerCount = 0;
let quizCount = [];

document.addEventListener("langchange", () => {
	document.title = t("pageTitle");
	if (scene === "title" && titleState) titleState.rebuildPage();
});

function goToTitle() {
	scene = "title";
	level = 0;
	answerCount = 0;
	quizCount = [];
	titleState = createTitleState();
	activeTreeView = titleState.demoView;
}
function goToMain() {
	scene = "gameplay";
	gameplayState = createGameplayState();
	activeTreeView = gameplayState.treeView;
}
function goToClear() {
	scene = "clear";
	clearState = createClearState();
	activeTreeView = null;
}

/* ==================== タイトルシーン ==================== */
function createTitleState() {
	const s = { pageIndex: 0, shapes: [] };
	for (let i = 0; i < 10; i++) {
		s.shapes.push({ x: Math.random() * W, y: Math.random() * 50 + 30, r: Math.random() * 10 + 5 });
	}

	s.rebuildPage = function () {
		const page = TITLE_DEMO_PAGES[s.pageIndex];
		if (page.special) {
			s.demoTree = null;
			s.demoView = null;
			activeTreeView = null;
			return;
		}
		const tree = new BinaryTree();
		page.input.forEach((v) => tree.insert(v));
		s.demoTree = tree;
		s.demoView = createTreeView(tree, {
			x: W / 2, y: 200, nodeRadius: 17, levelDistance: 50, initialHDist: 52,
			highlightValue: page.highlight, revealAnswer: page.reveal, centerAlign: true,
			centerX: W / 2, maxWidth: 285, maxHeight: 150,
		});
		activeTreeView = s.demoView;
	};
	s.rebuildPage();

	s.changePage = function (dir) {
		s.pageIndex += dir;
		if (s.pageIndex < 0) s.pageIndex = TITLE_DEMO_PAGES.length - 1;
		else if (s.pageIndex >= TITLE_DEMO_PAGES.length) s.pageIndex = 0;
		s.rebuildPage();
	};

	s.update = function (delta) { };

	s.draw = function (offsetX, timeMs) {
		ctx.save();
		ctx.translate(offsetX, 0);
		ctx.clearRect(0, 0, W, H);
		ctx.fillStyle = COLOR.bgGame;
		ctx.fillRect(0, 0, W, H);

		s.shapes.forEach((sh) => {
			ctx.beginPath();
			ctx.arc(sh.x, sh.y, sh.r, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(143,163,196,0.35)";
			ctx.fill();
		});

		const logoText = t("titleLogo");
		const logoSize = fitFontSize(logoText, W - 40, 34, "bold");
		drawText(logoText, W / 2, 55, {
			size: logoSize, weight: "bold", align: "center", baseline: "middle",
			color: COLOR.logo, stroke: COLOR.textMain, strokeWidth: 3,
		});
		strokeRoundRect(W / 2 - 150, 25, 300, 55, 15, COLOR.accentBlue, 4);

		// 説明文を一文に簡略化した分、説明欄をより上・より縦長に配置できる（言語によらず1行に収まるようfitFontSize）
		const introSize = fitFontSize(t("introText"), W - 40, 17, "");
		drawText(t("introText"), W / 2, 96, { size: introSize, align: "center", baseline: "middle", color: COLOR.textMain });

		fillRoundRect(10, 116, 340, 339, 15, "rgba(143,163,196,0.18)");

		const page = TITLE_DEMO_PAGES[s.pageIndex];
		const pageText = t("titlePages")[s.pageIndex];

		// 上段：要点(intro)を全幅使って大きめに表示
		const introWrapped2 = wrapText(pageText.intro, 316, 20, "");
		drawText(introWrapped2, 22, 124, { size: 20, color: COLOR.textMain, lineHeight: 26, baseline: "top" });

		// 中段：画像（二分木のデモ or だいまお）をintroとbodyの間に挟んで中央に、大きめに配置
		if (page.special) {
			const mao = makeSprite(IMG.daimao, { x: W / 2, y: 253, anchorX: 0.5, anchorY: 0.5, scaleX: 1.75, scaleY: 1.75 });
			drawSprite(mao);
		} else {
			s.demoView.draw(0, timeMs);
		}

		// 下段：詳細(body)を全幅使って大きめに表示
		const bodyWrapped2 = wrapText(pageText.body, 316, 20, "");
		drawText(bodyWrapped2, 22, 335, { size: 20, color: COLOR.textMain, lineHeight: 26, baseline: "top" });

		// prev/nextボタン（x:20-80, x:280-340, y中心425）と重ならない幅に収め、y座標をその中心に揃える
		const headingSize = fitFontSize(pageText.heading, 190, 26, "bold");
		drawText(pageText.heading, W / 2 + 5, 425, { size: headingSize, weight: "bold", align: "center", baseline: "middle", color: COLOR.textMain });

		// 全何ページ中の何ページ目かが一目で分かるドットインジケーター
		const dotCount = TITLE_DEMO_PAGES.length;
		const dotSpacing = 13;
		const dotsStartX = W / 2 - ((dotCount - 1) * dotSpacing) / 2;
		for (let i = 0; i < dotCount; i++) {
			const isCurrent = i === s.pageIndex;
			ctx.beginPath();
			ctx.arc(dotsStartX + i * dotSpacing, 447, isCurrent ? 4 : 3, 0, Math.PI * 2);
			ctx.fillStyle = isCurrent ? COLOR.accentTerracotta : "rgba(74,56,38,0.3)";
			ctx.fill();
		}

		drawButton(BTN_START, t("startBtn"), { bg: COLOR.accentTerracotta, color: COLOR.textMain, size: 20, radius: 10 });
		drawTriangleBtn(BTN_PREV, "left", { bg: COLOR.accentTerracotta });
		drawTriangleBtn(BTN_NEXT, "right", { bg: COLOR.accentTerracotta });
		drawLangButton();

		ctx.restore();
	};

	return s;
}

/* ==================== メインシーン ==================== */
function createGameplayState() {
	level++;
	const config = LEVEL_CONFIG[level];
	quizCount[level] = 0;

	const s = {
		minValue: config.min, maxValue: config.max,
		currentValue: 0, seikai: false,
		correctStartTime: null, particles: [],
		wrongShake: false, wrongFlashStart: null,
		numberPopTrigger: 0, lastPopTrigger: -1, numberPopStart: null,
	};

	s.possibleNumbers = [];
	for (let i = s.minValue; i <= s.maxValue; i++) s.possibleNumbers.push(i);

	s.inputArray = [];
	for (let i = 0; i < config.treeNum; i++) {
		const idx = getRandomInt(0, s.possibleNumbers.length - 1);
		s.inputArray.push(s.possibleNumbers.splice(idx, 1)[0]);
	}
	s.randomIndex = getRandomInt(0, s.inputArray.length - 1);
	s.possibleNumbers.push(s.inputArray[s.randomIndex]);
	s.possibleNumbers.sort((a, b) => a - b);
	s.currentValue = 0;

	s.tree = new BinaryTree();
	s.inputArray.forEach((v) => s.tree.insert(v));
	s.treeView = createTreeView(s.tree, {
		x: W / 2, y: 104, nodeRadius: 20, levelDistance: 58, initialHDist: 100,
		highlightValue: s.inputArray[s.randomIndex], revealAnswer: false, centerAlign: true,
		centerX: W / 2, maxWidth: W - 24, maxHeight: 405,
	});

	s.changeValue = function (amount) {
		if (s.seikai) return;
		s.currentValue += amount;
		if (s.currentValue < 0) s.currentValue += s.possibleNumbers.length;
		else if (s.currentValue >= s.possibleNumbers.length) s.currentValue -= s.possibleNumbers.length;
		s.numberPopTrigger++; // 数字が変わるたびdraw側でポン、と弾ませる
	};

	s.submitAnswer = function () {
		if (s.seikai) return;
		answerCount += 1;
		quizCount[level] += 1;
		if (s.possibleNumbers[s.currentValue] === s.inputArray[s.randomIndex]) {
			s.seikai = true;
			s.treeView.opts.revealAnswer = true;
			s.correctStartTime = null; // draw側で最初のtimeMsを記録し、そこからエフェクトを開始する
			s.particles = [];
		} else {
			const wrongValue = s.possibleNumbers[s.currentValue];
			s.inputArray.push(wrongValue);
			s.tree.insert(wrongValue);
			s.treeView.rebuild();
			s.possibleNumbers.splice(s.currentValue, 1);
			s.currentValue = Math.max(0, s.currentValue - 1);
			s.wrongShake = true;
			s.wrongFlashStart = null; // draw側で最初のtimeMsを記録
		}
	};

	s.proceed = function () {
		if (level < 5) goToMain();
		else goToClear();
	};

	s.update = function (delta) {
		if (s.particles.length) {
			s.particles.forEach((p) => {
				p.x += p.vx * delta;
				p.y += p.vy * delta;
				p.vy += 0.16 * delta; // 重力で徐々に落下する
				p.life -= delta;
			});
			s.particles = s.particles.filter((p) => p.life > 0);
		}
	};

	s.draw = function (offsetX, timeMs) {
		// 不正解時：画面を短く揺らして「ハズレ」の手応えを出す
		let shakeX = 0;
		if (s.wrongShake) {
			if (s.wrongFlashStart === null) s.wrongFlashStart = timeMs;
			const elapsed = timeMs - s.wrongFlashStart;
			const dur = 280;
			if (elapsed < dur) {
				shakeX = Math.sin(elapsed * 0.09) * 6 * (1 - elapsed / dur);
			} else {
				s.wrongShake = false;
			}
		}

		ctx.save();
		ctx.translate(offsetX + shakeX, 0);
		ctx.clearRect(-10, 0, W + 20, H);
		ctx.fillStyle = COLOR.bgGame;
		ctx.fillRect(0, 0, W, H);

		fillRoundRect(0, 0, W, 50, 0, COLOR.bgPanel);
		const qLevel = t("qLevelFmt")(level);
		const qRange = t("qRangeFmt")(s.minValue, s.maxValue);
		const qCount = t("qCountFmt")(answerCount);
		const qSize = Math.min(
			fitFontSize(qLevel, 80, 19, "bold"),
			fitFontSize(qRange, 170, 19, "bold"),
			fitFontSize(qCount, 100, 19, "bold"),
		);
		drawText(qLevel, 8, 14, { size: qSize, weight: "bold", align: "left", baseline: "middle", color: COLOR.textMain });
		drawText(qRange, W / 2, 14, { size: qSize, weight: "bold", align: "center", baseline: "middle", color: COLOR.textMain });
		drawText(qCount, W - 8, 14, { size: qSize, weight: "bold", align: "right", baseline: "middle", color: COLOR.textMain });

		// 問題文（ヘッダーのすぐ下）。上のヘッダーと同じくらい目立つよう太字・はっきりした色に
		fillRoundRect(0, 50, W, 14, 0, COLOR.bgPanel);
		drawText(t("questionPrompt"), 8, 42, { size: 18, weight: "bold", align: "left", baseline: "middle", color: COLOR.textMain });

		// 正解時に桃色にするのは二分木の描画エリアだけ。下の白いエリアはメニューバーと同色のまま
		if (s.seikai) {
			fillRoundRect(0, 64, W, 479 - 64, 0, "#ecd3d0");
		}
		s.treeView.draw(0, timeMs);

		// 正解の瞬間、答えのノードから紙吹雪のようなパーティクルを散らす
		if (s.seikai) {
			if (s.correctStartTime === null) {
				s.correctStartTime = timeMs;
				const hlNode = s.treeView.nodes.find((n) => n.isHL);
				if (hlNode) {
					const colors = [COLOR.accentTerracotta, COLOR.accentBlue, COLOR.rose, "#e8c468"];
					for (let i = 0; i < 30; i++) {
						const angle = Math.random() * Math.PI * 2;
						const speed = 1.2 + Math.random() * 3;
						s.particles.push({
							x: hlNode.x, y: hlNode.y,
							vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
							life: 45 + Math.random() * 25, maxLife: 70,
							color: colors[i % colors.length], size: 2 + Math.random() * 2.5,
						});
					}
				}
			}
			s.particles.forEach((p) => {
				ctx.save();
				ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			});
		}

		// 不正解時、木のエリアを一瞬だけ薄く赤らませてフラッシュさせる
		if (s.wrongFlashStart !== null) {
			const elapsed = timeMs - s.wrongFlashStart;
			const dur = 280;
			if (elapsed < dur) {
				fillRoundRect(0, 78, W, 479 - 78, 0, `rgba(193,89,79,${0.22 * (1 - elapsed / dur)})`);
			}
		}

		fillRoundRect(0, 479, W, H - 479, 0, COLOR.bgPanel);
		if (s.seikai) {
			// 「正解！」テキストがポンと弾みながら登場する
			const elapsed = s.correctStartTime !== null ? timeMs - s.correctStartTime : 9999;
			const dur = 420;
			const textScale = elapsed < dur ? Math.max(0.05, easeOutBack(elapsed / dur)) : 1;
			ctx.save();
			ctx.translate(W / 2, 513);
			ctx.scale(textScale, textScale);
			drawText(t("correctText"), 0, 0, {
				size: 24, weight: "bold", align: "center", baseline: "middle",
				color: COLOR.textMain, stroke: COLOR.accentTerracotta, strokeWidth: 3, shadow: true,
			});
			ctx.restore();
		} else {
			// 数字を送るたびポンと弾ませて操作感を出す
			if (s.numberPopTrigger !== s.lastPopTrigger) {
				s.lastPopTrigger = s.numberPopTrigger;
				s.numberPopStart = timeMs;
			}
			let numScale = 1;
			if (s.numberPopStart !== null) {
				const elapsed = timeMs - s.numberPopStart;
				const dur = 150;
				if (elapsed < dur) numScale = 1 + 0.3 * Math.sin((elapsed / dur) * Math.PI);
			}
			ctx.save();
			ctx.translate(W / 2, 513.5);
			ctx.scale(numScale, numScale);
			drawText(String(s.possibleNumbers[s.currentValue]), 0, 0, {
				size: 36, weight: "bold", align: "center", baseline: "middle", color: COLOR.textMain,
			});
			ctx.restore();
		}

		if (s.seikai) {
			drawTriangleBtn(BTN_PROCEED, "right", { bg: COLOR.accentTerracotta, radius: 10 });
			const nextLabel = t("nextLabel");
			const nextSize = fitFontSize(nextLabel, 95, 15, "bold");
			drawText(nextLabel, 275, 530, {
				size: nextSize, weight: "bold", align: "center", baseline: "middle", color: COLOR.textMain,
			});
		} else {
			drawTriangleBtn(BTN_MINUS, "left", { bg: COLOR.accentTerracotta });
			drawTriangleBtn(BTN_PLUS, "right", { bg: COLOR.accentTerracotta });
			drawButton(BTN_ANSWER, t("answerBtn"), { bg: COLOR.accentTerracotta, color: COLOR.textMain, size: 18 });
		}

		ctx.restore();
	};

	return s;
}

let holdIntervalId = null;
function makeHoldButton(onTick) {
	onTick();
	clearInterval(holdIntervalId);
	holdIntervalId = setInterval(onTick, 200);
	const stop = () => {
		clearInterval(holdIntervalId);
		window.removeEventListener("pointerup", stop);
	};
	window.addEventListener("pointerup", stop);
}

/* ==================== クリアシーン ==================== */
function createClearState() {
	const s = { startTime: null, confetti: [], scoreReachedAt: null, confettiBurstsDone: 0 };
	s.update = function (delta) {
		if (s.confetti.length) {
			s.confetti.forEach((p) => {
				p.x += p.vx * delta;
				p.y += p.vy * delta;
				p.vy += 0.16 * delta; // ゲーム画面の正解演出と同じ重力
				p.life -= delta;
			});
			s.confetti = s.confetti.filter((p) => p.life > 0);
		}
	};
	s.draw = function (offsetX, timeMs) {
		if (s.startTime === null) s.startTime = timeMs;

		ctx.save();
		ctx.translate(offsetX, 0);
		ctx.clearRect(0, 0, W, H);
		ctx.fillStyle = COLOR.bgGame;
		ctx.fillRect(0, 0, W, H);

		const mao = makeSprite(IMG.daimao, { x: W / 2, y: 255, anchorX: 0.5, anchorY: 0.5, scaleX: 4, scaleY: 4, alpha: 0.3 });
		drawSprite(mao);

		ctx.save();
		ctx.strokeStyle = COLOR.textSoft;
		ctx.lineWidth = 2;
		ctx.strokeRect(20, 80, 320, 400);
		for (let i = 0; i < 6; i++) {
			ctx.beginPath();
			ctx.moveTo(20, 130 + i * 60);
			ctx.lineTo(340, 130 + i * 60);
			ctx.stroke();
		}
		ctx.restore();

		drawText(t("clearTitle"), 30, 46, { size: 26, weight: "bold", color: COLOR.textMain, baseline: "top" });

		// 答案用紙らしい採点マーク「100点」を0から一気にカウントアップさせて登場させる
		const countDur = 700;
		const countElapsed = timeMs - s.startTime;
		const countProgress = Math.min(1, countElapsed / countDur);
		const displayScore = Math.round((1 - Math.pow(1 - countProgress, 3)) * 100);

		const scoreText = String(displayScore), scoreSize = 52, scoreRight = 340, scoreTop = 14;
		ctx.save();
		ctx.font = `bold ${scoreSize}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`;
		ctx.textBaseline = "top";
		const scoreMetrics = ctx.measureText(scoreText);
		const scoreWidth = scoreMetrics.width;
		const scoreBottom = scoreTop + (scoreMetrics.actualBoundingBoxDescent || scoreSize * 0.75);
		ctx.restore();

		// 100に到達したら、打ち上げ花火のように「100」付近のランダムな位置から時間差で5回紙吹雪を飛び散らせる
		if (displayScore >= 100) {
			if (s.scoreReachedAt === null) s.scoreReachedAt = timeMs;
			const totalBursts = 5, burstInterval = 220;
			const targetBursts = Math.min(totalBursts, Math.floor((timeMs - s.scoreReachedAt) / burstInterval) + 1);
			const baseX = scoreRight - scoreWidth / 2;
			const baseY = scoreTop + (scoreBottom - scoreTop) / 2;
			const colors = [COLOR.accentTerracotta, COLOR.accentBlue, COLOR.rose, "#e8c468"];
			while (s.confettiBurstsDone < targetBursts) {
				s.confettiBurstsDone++;
				const originX = baseX + (Math.random() - 0.5) * 70;
				const originY = baseY + (Math.random() - 0.5) * 50;
				for (let i = 0; i < 30; i++) {
					const angle = Math.random() * Math.PI * 2;
					const speed = 1.2 + Math.random() * 3;
					s.confetti.push({
						x: originX, y: originY,
						vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
						life: 45 + Math.random() * 25, maxLife: 70,
						color: colors[i % colors.length], size: 2 + Math.random() * 2.5,
					});
				}
			}
		}
		s.confetti.forEach((p) => {
			ctx.save();
			ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		});

		drawText(scoreText, scoreRight, scoreTop, { size: scoreSize, weight: "bold", align: "right", baseline: "top", color: COLOR.rose });

		const underlineY = scoreBottom + 6;
		ctx.save();
		ctx.strokeStyle = COLOR.rose;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(scoreRight - scoreWidth, underlineY); ctx.lineTo(scoreRight, underlineY);
		ctx.moveTo(scoreRight - scoreWidth, underlineY + 7); ctx.lineTo(scoreRight, underlineY + 7);
		ctx.stroke();
		ctx.restore();

		drawText(t("totalAnswerFmt")(answerCount), 40, 90, { size: 22, weight: "bold", color: COLOR.textMain, baseline: "top" });

		const evaluations = t("evaluations");
		for (let i = 0; i < 5; i++) {
			const count = quizCount[i + 1] || 0;
			const idx = Math.min(count, evaluations.length) - 1;
			const evalText = idx >= 0 ? evaluations[idx] : "";
			const qFmt = t("questionFmt")(i + 1, count);
			const qSize = fitFontSize(qFmt, 110, 22, "bold");
			drawText(qFmt, 40, 140 + i * 60, { size: qSize, weight: "bold", color: COLOR.textMain, baseline: "top" });
			drawText(evalText, 160, 140 + i * 60, { size: 22, weight: "bold", color: COLOR.rose, baseline: "top" });
		}

		const summaries = t("summaries");
		const summary = summaries.find((sm) => answerCount <= sm.max).text;
		const summarySize = fitFontSize(summary, 300, 22, "bold");
		drawText(summary, 40, 140 + 5 * 60, { size: summarySize, weight: "bold", color: COLOR.rose, baseline: "top" });

		drawButton(BTN_TOTITLE, t("backToTitleBtn"), { bg: COLOR.accentTerracotta, color: COLOR.textMain, size: 18 });
		drawLangButton();

		ctx.restore();
	};
	return s;
}

/* ==================== メインループ ==================== */
let lastTime = performance.now();
let elapsedMs = 0;
function frame(now) {
	const delta = Math.min(4, (now - lastTime) / (1000 / 60));
	elapsedMs += Math.min(now - lastTime, 200);
	lastTime = now;

	if (scene === "title") titleState.update(delta);
	else if (scene === "gameplay") gameplayState.update(delta);
	else if (scene === "clear") clearState.update(delta);

	if (scene === "title") titleState.draw(0, elapsedMs);
	else if (scene === "gameplay") gameplayState.draw(0, elapsedMs);
	else if (scene === "clear") clearState.draw(0, elapsedMs);

	requestAnimationFrame(frame);
}

/* ==================== 起動 ==================== */
loadAllImages().then(() => {
	document.title = t("pageTitle");
	goToTitle();
	requestAnimationFrame(frame);
});
