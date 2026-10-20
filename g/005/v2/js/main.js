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
	const lineHeight = opts.lineHeight || size * 1.3;
	ctx.save();
	ctx.font = `${weight} ${size}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`.trim();
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

/* ==================== イージング関数 ==================== */
function easeLinear(p) { return p; }
function easePower1Out(p) { return 1 - (1 - p) * (1 - p); }
function easePower1InOut(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
function easePower2Out(p) { return 1 - Math.pow(1 - p, 3); }
function easeSineInOut(p) { return -(Math.cos(Math.PI * p) - 1) / 2; }
function easeBounceOut(p) {
	const n1 = 7.5625, d1 = 2.75;
	if (p < 1 / d1) return n1 * p * p;
	if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
	if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
	return n1 * (p -= 2.625 / d1) * p + 0.984375;
}
function easeBackOut(p) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
function easeBackIn(p) { const c1 = 1.70158, c3 = c1 + 1; return c3 * p * p * p - c1 * p * p; }

/* ==================== Tweenシステム（実時間ベース） ==================== */
const activeTweens = [];
function tween(target, props, durationMs, opts) {
	opts = opts || {};
	const start = {};
	for (const k in props) start[k] = target[k];
	const tw = {
		target, start, props,
		duration: Math.max(1, durationMs),
		ease: opts.ease || easePower1Out,
		elapsed: 0,
		onComplete: opts.onComplete,
		onUpdate: opts.onUpdate,
		pausable: opts.pausable !== false,
		dead: false,
	};
	tw.wait = () => new Promise((resolve) => {
		const prev = tw.onComplete;
		tw.onComplete = () => { if (prev) prev(); resolve(); };
	});
	activeTweens.push(tw);
	return tw;
}
function killTween(tw) { if (tw) tw.dead = true; }
function updateTweens(deltaMs, allowPausable) {
	// onComplete内でswitchScene()がactiveTweensをクリアすることがあるため、
	// ループ中に配列が縮む/入れ替わるケースを想定してtwの存在チェックを行う。
	for (let i = activeTweens.length - 1; i >= 0; i--) {
		const tw = activeTweens[i];
		if (!tw) continue;
		if (tw.dead) { activeTweens.splice(i, 1); continue; }
		if (tw.pausable && !allowPausable) continue;
		tw.elapsed += deltaMs;
		const p = Math.min(1, tw.elapsed / tw.duration);
		const e = tw.ease(p);
		for (const k in tw.props) {
			tw.target[k] = tw.start[k] + (tw.props[k] - tw.start[k]) * e;
		}
		if (tw.onUpdate) tw.onUpdate();
		if (p >= 1) {
			activeTweens.splice(i, 1);
			if (tw.onComplete) tw.onComplete();
		}
	}
}
// デモ演出のシーケンス制御用。pausable(既定true)なタイマーとして使う。
function sleep(sec, pausable) {
	return new Promise((resolve) => {
		tween({}, {}, Math.max(1, sec * 1000), { onComplete: resolve, pausable: pausable !== false });
	});
}

/* ==================== 多言語対応 ==================== */
document.addEventListener("langchange", () => {
	document.title = t("pageTitle");
	if (sceneState && sceneState.onLangChange) sceneState.onLangChange();
});

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う。 */
const BTN_LANG = { x: 258, y: 12, w: 94, h: 34 };
function hitTestBtn(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
function drawButton(rect, label, opts) {
	opts = opts || {};
	fillRoundRect(rect.x, rect.y, rect.w, rect.h, opts.radius || 8, opts.bg || "rgba(0,0,0,0.6)");
	if (label) {
		drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
			size: opts.size || 16, weight: "bold", align: "center", baseline: "middle", color: opts.color || "#fff",
		});
	}
}
function drawLangButton() {
	drawButton(BTN_LANG, t("langBtn"), { bg: "rgba(0,0,0,0.6)", size: 13, color: "#fff" });
}

/* ==================== 汎用ボタン ==================== */
// label に応じた既定色（colorFlg=true時）。中央(YA)ボタンは白背景固定。
function buttonBaseColor(label, colorFlg) {
	if (!colorFlg) return "#dddddd";
	if (label === "OGI") return "#ff2222";
	if (label === "HAGI") return "#ffcc00";
	if (label === "CANCEL") return "#999999";
	return "#ffffff";
}
function drawSideButton(btn, disabledColor) {
	// btn: {x,y,scale,label,color}
	ctx.save();
	ctx.translate(btn.x, btn.y);
	ctx.scale(btn.scale, btn.scale);
	fillRoundRect(-60, -30, 120, 70, 10, disabledColor || btn.color);
	drawText(btn.label, 0, 5, { size: btn.fontSize || 40, weight: "bold", align: "center", baseline: "middle", color: "#333333" });
	ctx.restore();
}
function drawCenterButton(btn, colorTop, colorBottom, bg) {
	// btn: {x,y,scale}
	ctx.save();
	ctx.translate(btn.x, btn.y);
	ctx.scale(btn.scale, btn.scale);
	fillRoundRect(-45, -30, 90, 70, 30, bg);
	drawText(t("ohButtonCenter"), 0, 5, { size: 40, weight: "bold", align: "center", baseline: "middle", color: "#333333" });
	drawText(t("ohButtonTop"), 0, -10, { size: 26, weight: "bold", align: "center", baseline: "middle", color: colorTop });
	drawText(t("ohButtonBottom"), 0, 20, { size: 26, weight: "bold", align: "center", baseline: "middle", color: colorBottom });
	ctx.restore();
}
function hitSideButton(btn, px, py) {
	const lx = (px - btn.x) / btn.scale, ly = (py - btn.y) / btn.scale;
	return lx >= -60 && lx <= 60 && ly >= -30 && ly <= 40;
}
function hitCenterButton(btn, px, py) {
	const lx = (px - btn.x) / btn.scale, ly = (py - btn.y) / btn.scale;
	return lx >= -45 && lx <= 45 && ly >= -30 && ly <= 40;
}
function animateButtonPress(btn) {
	btn.scale = 1.2;
	setTimeout(() => { btn.scale = 1; }, 100);
}

/* ==================== ドット線 ==================== */
function drawDottedLine(x1, y1, x2, y2, dotRadius, gapLength, color) {
	const dx = x2 - x1, dy = y2 - y1;
	const distance = Math.sqrt(dx * dx + dy * dy);
	const dotCount = Math.floor(distance / (dotRadius * 2 + gapLength));
	const stepX = (dx / distance) * (dotRadius * 2 + gapLength);
	const stepY = (dy / distance) * (dotRadius * 2 + gapLength);
	let cx = x1, cy = y1;
	ctx.save();
	ctx.fillStyle = color || "#eeeeee";
	for (let i = 0; i <= dotCount; i++) {
		ctx.beginPath();
		ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
		ctx.fill();
		cx += stepX; cy += stepY;
	}
	ctx.restore();
}

/* ==================== 背景文字セット（荻/萩の表記ゆれフリップ） ==================== */
// 各コンテナは {y, alpha} のみをアニメーションさせる。x・文字内容・回転は固定。
const BG_DEFS = {
	OKN: [{ t: "荻", x: 5, y: 150, size: 124 }],
	OH: [{ t: "お", x: 5, y: 85, size: 124 }, { t: "ぎ", x: 5, y: 225, size: 124 }],
	OKT: [{ t: "オ", x: 5, y: 85, size: 124 }, { t: "ギ", x: 5, y: 225, size: 124 }],
	OE: [{ t: "OGI", x: 130, y: 110, size: 124, rot: Math.PI / 2 }],
	HKN: [{ t: "萩", x: 230, y: 150, size: 124 }],
	HH: [{ t: "は", x: 230, y: 85, size: 124 }, { t: "ぎ", x: 230, y: 225, size: 124 }],
	HKT: [{ t: "ハ", x: 230, y: 85, size: 124 }, { t: "ギ", x: 230, y: 225, size: 124 }],
	HE: [{ t: "HAGI", x: 360, y: 80, size: 124, rot: Math.PI / 2 }],
};
const OGI_KEY_BY_WORD = { OGI: "OE", おぎ: "OH", オギ: "OKT", 荻: "OKN" };
const HAGI_KEY_BY_WORD = { HAGI: "HE", はぎ: "HH", ハギ: "HKT", 萩: "HKN" };

function makeBgSet() {
	return {
		OKN: { y: 0, alpha: 0.3 }, OH: { y: -400, alpha: 0.3 }, OKT: { y: -400, alpha: 0.3 }, OE: { y: -400, alpha: 0.3 },
		HKN: { y: 0, alpha: 0.3 }, HH: { y: -400, alpha: 0.3 }, HKT: { y: -400, alpha: 0.3 }, HE: { y: -400, alpha: 0.3 },
	};
}
function drawBgSet(bgSet, colorOgi, colorHagi) {
	for (const key in bgSet) {
		const st = bgSet[key];
		if (st.alpha <= 0) continue;
		const color = st.color || (key[0] === "O" ? colorOgi : colorHagi);
		for (const ch of BG_DEFS[key]) {
			ctx.save();
			ctx.globalAlpha = st.alpha;
			ctx.translate(ch.x, ch.y + st.y);
			if (ch.rot) ctx.rotate(ch.rot);
			drawText(ch.t, 0, 0, { size: ch.size, color, align: "left", baseline: "top" });
			ctx.restore();
		}
	}
}
// 表示中セットを退避させ、新しいセットをスライドインさせる（原作の backgroundChange 相当）
// キー切替とリセットはonComplete(200ms後)ではなく呼び出し時点で同期的に行う。コンボが速いと
// 200ms以内に次の単語が正解して再度呼ばれることがあり、onComplete待ちにすると
// 前の呼び出しの状態を後追いで巻き戻してしまい「ランダムに見える/何も表示されない」原因になっていた。
// 各要素の直前のtweenも新しいtweenを張る前にkillし、同じ対象に重複してtweenが走らないようにする。
function flipBgSet(bgSet, beforeKeyRef, group, newKey) {
	const keys = group === "O" ? ["OKN", "OH", "OKT", "OE"] : ["HKN", "HH", "HKT", "HE"];
	const prevKey = beforeKeyRef.key;
	if (prevKey === newKey) return;
	beforeKeyRef.key = newKey;
	keys.forEach((k) => {
		if (k === newKey || k === prevKey) return;
		if (bgSet[k]._tw) killTween(bgSet[k]._tw);
		bgSet[k].y = -400;
	});
	// 目標値は必ず絶対値(400=退避 / 0=表示)で指定する。相対値(y+400)だと、コンボが速く
	// まだ前のtweenが完了していない(=中途半端なyの)状態から呼ばれたときに、退避しきらない
	// 位置で止まってしまう(実際に発生したバグ)。
	const before = bgSet[prevKey];
	if (before._tw) killTween(before._tw);
	before._tw = tween(before, { y: 400 }, 200, { ease: easePower1Out });
	const target = bgSet[newKey];
	if (target._tw) killTween(target._tw);
	target.y = -400;
	target._tw = tween(target, { y: 0 }, 200, { ease: easePower1Out });
}

/* ==================== パーティクル / スコアラベル演出 ==================== */
// 汎用キラキラ（★15個、対象配列に積んでdrawで描く）
function spawnStarParticles(list, x, y, count, color) {
	for (let i = 0; i < (count || 15); i++) {
		const star = { x, y, alpha: 1, color: color || "#999999" };
		list.push(star);
		tween(star, {
			x: x + (Math.random() - 0.5) * 100,
			y: y + (Math.random() - 0.5) * 100,
			alpha: 0,
		}, 1000, { onComplete: () => { const idx = list.indexOf(star); if (idx >= 0) list.splice(idx, 1); } });
	}
}
function spawnMiniParticles(list, x, y) {
	for (let i = 0; i < 30; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = 5 + Math.random() * 5;
		const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
		const p = { x: x - 40, y: y - 40, alpha: 1, rotation: 0, color: `hsl(${55 + Math.random() * 20},70%,70%)` };
		list.push(p);
		tween(p, { x: p.x + vx * 10, y: p.y + vy * 10, alpha: 0, rotation: Math.random() * Math.PI }, 800, {
			ease: easePower2Out,
			onComplete: () => { const idx = list.indexOf(p); if (idx >= 0) list.splice(idx, 1); },
		});
	}
}
function drawStarList(list) {
	list.forEach((s) => {
		ctx.save();
		ctx.globalAlpha = s.alpha;
		drawText("★", s.x, s.y, { size: 20, color: s.color, align: "center", baseline: "middle" });
		ctx.restore();
	});
}
function drawMiniParticleList(list) {
	list.forEach((p) => {
		ctx.save();
		ctx.globalAlpha = p.alpha;
		ctx.translate(p.x, p.y);
		ctx.rotate(p.rotation);
		ctx.fillStyle = p.color;
		ctx.beginPath();
		ctx.arc(0, 0, 2, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	});
}

// PERFECT!/GREAT!/NICE!/SAFE の演出付きラベル
async function showScoreLabelWithEffect(list, x, y, amount) {
	let label, color, effect;
	if (amount >= 9) { label = "PERFECT!"; color = "#ffff66"; effect = "round"; }
	else if (amount >= 8) { label = "GREAT!"; color = "#ffcc00"; effect = "jump"; }
	else if (amount >= 6) { label = "NICE!"; color = "#99ccff"; effect = "pop"; }
	else { label = "SAFE"; color = "#00ff99"; effect = "wobble"; }

	const item = { x, y: y - 30, alpha: 0, scale: 0.8, rotation: 0, label, color };
	list.push(item);
	tween(item, { alpha: 1 }, 100, { ease: easeBackOut });

	if (effect === "round") {
		await tween(item, { rotation: Math.PI * 2 }, 200, { ease: easeSineInOut }).wait();
	} else if (effect === "jump") {
		await tween(item, { y: item.y - 15 }, 100, { ease: easePower1Out }).wait();
		await tween(item, { y: item.y + 15 }, 100, { ease: easeBounceOut }).wait();
		await tween(item, { y: item.y - 10 }, 100, { ease: easePower1Out }).wait();
		await tween(item, { y: item.y + 10 }, 100, { ease: easeBounceOut }).wait();
	} else if (effect === "pop") {
		await tween(item, { y: item.y - 20 }, 400, { ease: easePower1Out }).wait();
	} else if (effect === "wobble") {
		const baseX = item.x;
		for (let i = 0; i < 3; i++) {
			await tween(item, { x: baseX + 10 }, 50, { ease: easeLinear }).wait();
			await tween(item, { x: baseX }, 50, { ease: easeLinear }).wait();
		}
	}
	await tween(item, { alpha: 0, y: item.y - 40 }, 600, { ease: easeLinear }).wait();
	const idx = list.indexOf(item);
	if (idx >= 0) list.splice(idx, 1);
}
function drawScoreLabelList(list) {
	list.forEach((it) => {
		ctx.save();
		ctx.globalAlpha = it.alpha;
		ctx.translate(it.x, it.y);
		ctx.rotate(it.rotation);
		ctx.scale(it.scale, it.scale);
		drawText(it.label, 0, 0, { size: 32, weight: "bold", align: "center", baseline: "middle", color: it.color, stroke: "#000000", strokeWidth: 4 });
		ctx.restore();
	});
}

/* ==================== Colorful! テキスト演出 ==================== */
async function showColorfulText(list, cx, cy) {
	const item = { x: cx, y: cy, alpha: 0, rotation: -0.1 };
	list.push(item);
	await tween(item, { alpha: 1 }, 100).wait();
	for (let i = 0; i < 4; i++) {
		await tween(item, { rotation: 0.1 }, 50, { ease: easeSineInOut }).wait();
		await tween(item, { rotation: -0.1 }, 50, { ease: easeSineInOut }).wait();
	}
	item.rotation = 0;
	await sleep(0.1, false);
	await tween(item, { rotation: 0, y: item.y - 80, alpha: 0 }, 500, { ease: easePower2Out }).wait();
	const idx = list.indexOf(item);
	if (idx >= 0) list.splice(idx, 1);
}
function drawColorfulList(list) {
	list.forEach((it) => {
		ctx.save();
		ctx.globalAlpha = it.alpha;
		ctx.translate(it.x, it.y);
		ctx.rotate(it.rotation);
		drawText(t("colorfulLabel"), 0, 0, {
			size: 40, weight: "bold", align: "center", baseline: "middle", color: "#ff6666", stroke: "#000000", strokeWidth: 2,
		});
		ctx.restore();
	});
}

/* ==================== ゲージ描画（円形タイマー） ==================== */
function drawGauge(cx, cy, radius, progress) {
	ctx.save();
	ctx.fillStyle = "#ffffff";
	ctx.beginPath();
	ctx.moveTo(cx, cy);
	const startAngle = -Math.PI / 2;
	const endAngle = startAngle + Math.PI * 2 * progress;
	ctx.arc(cx, cy, radius, startAngle, endAngle);
	ctx.lineTo(cx, cy);
	ctx.fill();
	ctx.restore();
}

/* ==================== タイトルシーン ==================== */
function createTitleScene() {
	const bgSet = makeBgSet();
	let colorOgi = "#cc0000", colorHagi = "#bb9900";
	let centerTopColor = "#ff2200", centerBottomColor = "#ffcc00", centerBg = "#ffffff";
	let progress = 1;
	let clearCount = 9;

	const leftButton = { x: 65, y: H - 75, scale: 1, label: "OGI", color: "#ff2222", fontSize: 40 };
	const rightButton = { x: W - 65, y: H - 75, scale: 1, label: "HAGI", color: "#ffcc00", fontSize: 40 };
	const centerButton = { x: W / 2, y: H - 75, scale: 1 };

	function makeDemoWord(word, color) {
		return { word, color, x: W / 2, y: -50, alpha: 0 };
	}
	const demoTexts = [
		makeDemoWord("荻", "red"), makeDemoWord("萩", "yellow"), makeDemoWord("おぎ", "red"), makeDemoWord("はぎ", "yellow"),
		makeDemoWord("ハギ", "yellow"), makeDemoWord("オギ", "red"), makeDemoWord("OGI", "red"), makeDemoWord("HAGI", "yellow"),
		makeDemoWord("おぎ", "red"), makeDemoWord("ハギ", "yellow"),
	];

	const comboText = { x: W - 20, y: H / 2 + 20, alpha: 0, rotation: 0, text: "COMBO x9" };
	const bonusText = { x: W - 60, y: H - 120, alpha: 1, visible: false, y0: H - 120 };
	const miniParticles = [];
	const stars = [];
	const scoreLabels = [];
	const colorfulTexts = [];
	const timingLabels = []; // 判定タイミング説明(7/7)用のPERFECT/GREAT/NICE/SAFEラベル
	const bgOYH = { y: 200, alpha: 0 };

	let msgHead = { alpha: 0, text: "" };
	let msgL1 = { alpha: 0, text: "" };
	let msgL2 = { alpha: 0, text: "" };
	let msgL3 = { alpha: 0, text: "" };
	const msgArea = { alpha: 0 };

	const timerCx = W / 2, timerCy = H / 2 - 50, radius = 180;
	const darkOverlay = { alpha: 1 };

	let overlayVisible = false;
	const overlay = { alpha: 0 };

	const buttonL = { x: 41, y: 360 };
	const buttonR = { x: 319, y: 360 };

	let currentTimelineIndex = 0;
	let loopGen = 0;
	// L/R送りボタンでloopGenが進むと、実行中のタイムライン(await待ち中)が
	// 古い世代のまま動き続けて新しいタイムラインの状態を上書きしてしまう。
	// 各awaitの直後にこれで世代チェックし、ずれていたら即座に打ち切る。
	function isStale(myGen) { return myGen !== loopGen; }

	// DEMO/TAP START のゆっくりした点滅(原作: alpha 1→0.1→1 を1.4秒周期でyoyo・無限repeat)
	let blinkPhase = 0;
	function blinkAlpha() {
		const half = 1400;
		const t = blinkPhase % (half * 2);
		return t < half ? 1 - 0.9 * (t / half) : 0.1 + 0.9 * ((t - half) / half);
	}

	function setTutorialText(i) {
		const s = t("tutorial")[i];
		msgHead.text = s.head; msgL1.text = s.l1; msgL2.text = s.l2; msgL3.text = s.l3;
	}

	// 色(colorOgi/colorHagi等)はここでリセットしない。timeline5の終わりでモノクロ化した状態が
	// timeline6の説明中も維持され、10コンボ達成時(addComboTitle)に初めて色が戻るのが正しい見せ方。
	// ループの起点であるtimeline1の先頭でのみ明示的に色を赤/黄へ戻す。
	function resetTimeline() {
		demoTexts.forEach((d, i) => {
			d.alpha = 0; d.x = W / 2;
			d.y = (i === 3 || i === 5 || i === 7) ? -130 : -50;
		});
		msgHead.alpha = 0; msgL1.alpha = 0; msgL2.alpha = 0; msgL3.alpha = 0;
		darkOverlay.alpha = 0;
		clearCount = 9;
		comboText.alpha = 0; comboText.text = `COMBO x${clearCount}`;
		centerButton.scale = 1.0; rightButton.scale = 1.0; leftButton.scale = 1.0;
		progress = 1;
		timingLabels.length = 0;
	}

	async function addComboTitle(flg, myGen) {
		comboText.text = flg ? "COMBO x10" : "COMBO x11";
		comboText.rotation = 0;
		comboText.x = W - 20;
		if (flg) {
			const baseX = comboText.x;
			await tween(comboText, { x: baseX + 10 }, 50).wait(); if (isStale(myGen)) return;
			await tween(comboText, { x: baseX - 20 }, 50).wait(); if (isStale(myGen)) return;
			await tween(comboText, { x: baseX + 10 }, 50).wait(); if (isStale(myGen)) return;
			for (let i = 0; i < 3; i++) {
				await tween(comboText, { rotation: 0.1, alpha: 0.5 }, 100).wait(); if (isStale(myGen)) return;
				await tween(comboText, { rotation: 0, alpha: 1 }, 100).wait(); if (isStale(myGen)) return;
			}
			bonusText.visible = true; bonusText.alpha = 1; bonusText.y = H / 2;
			tween(bonusText, { y: bonusText.y - 30, alpha: 0 }, 1000, { onComplete: () => { bonusText.visible = false; } });
			spawnMiniParticles(miniParticles, comboText.x, comboText.y);
		} else {
			await tween(comboText, { y: comboText.y - 10 }, 100).wait(); if (isStale(myGen)) return;
			await tween(comboText, { y: comboText.y + 10 }, 100).wait(); if (isStale(myGen)) return;
		}
		comboText.x = W - 20;
	}

	async function timeline1(myGen) {
		resetTimeline();
		// ループの起点。ここでだけ色を赤/黄に戻す(5/6のモノクロ化を6/6まで持ち越すため)。
		colorOgi = "#cc0000"; colorHagi = "#bb9900";
		centerTopColor = "#ff2200"; centerBottomColor = "#ffcc00"; centerBg = "#ffffff";
		leftButton.color = "#ff2222"; rightButton.color = "#ffcc00";
		currentTimelineIndex = 0;
		setTutorialText(0);
		tween(darkOverlay, { alpha: 0 }, 500);
		(async () => { await sleep(0.4); if (isStale(myGen)) return; tween(msgArea, { alpha: 1 }, 800); })();
		tween(msgHead, { alpha: 1 }, 800);
		tween(msgL1, { alpha: 1 }, 700);
		tween(msgL2, { alpha: 1 }, 700);
		tween(msgL3, { alpha: 1 }, 700);
		tween(demoTexts[0], { alpha: 1 }, 500);
		await tween(demoTexts[0], { y: demoTexts[0].y + 280 }, 2000).wait(); if (isStale(myGen)) return;
		await tween(leftButton, { scale: 1.2 }, 300, { ease: easeBackOut }).wait(); if (isStale(myGen)) return;
		await tween(leftButton, { scale: 1.0 }, 300, { ease: easeBackIn }).wait(); if (isStale(myGen)) return;
		await tween(demoTexts[0], { x: demoTexts[0].x - 150, alpha: 0 }, 200).wait(); if (isStale(myGen)) return;
		spawnStarParticles(stars, demoTexts[0].x + 5, demoTexts[0].y, 15);
		showScoreLabelWithEffect(scoreLabels, demoTexts[0].x + 30, demoTexts[0].y, 6);
		await sleep(0.7); if (isStale(myGen)) return;
		tween(msgHead, { alpha: 0 }, 600);
		tween(msgL1, { alpha: 0 }, 600);
		tween(msgL2, { alpha: 0 }, 600);
		tween(msgL3, { alpha: 0 }, 600);
		await sleep(0.6); if (isStale(myGen)) return;
	}

	async function timeline2(myGen) {
		resetTimeline();
		currentTimelineIndex = 1;
		setTutorialText(1);
		tween(msgHead, { alpha: 1 }, 600);
		tween(msgL1, { alpha: 1 }, 600);
		tween(msgL2, { alpha: 1 }, 600);
		tween(msgL3, { alpha: 1 }, 600);
		tween(demoTexts[1], { alpha: 1 }, 500);
		await sleep(0.6); if (isStale(myGen)) return;
		await tween(demoTexts[1], { y: demoTexts[1].y + 230 }, 1700).wait(); if (isStale(myGen)) return;
		await tween(rightButton, { scale: 1.2 }, 300, { ease: easeBackOut }).wait(); if (isStale(myGen)) return;
		await tween(rightButton, { scale: 1.0 }, 300, { ease: easeBackIn }).wait(); if (isStale(myGen)) return;
		await tween(demoTexts[1], { x: demoTexts[1].x + 150, alpha: 0 }, 200).wait(); if (isStale(myGen)) return;
		spawnStarParticles(stars, demoTexts[1].x + 5, demoTexts[1].y, 15);
		showScoreLabelWithEffect(scoreLabels, demoTexts[1].x - 30, demoTexts[1].y, 8);
		await sleep(0.7); if (isStale(myGen)) return;
		tween(msgHead, { alpha: 0 }, 600);
		tween(msgL1, { alpha: 0 }, 600);
		tween(msgL2, { alpha: 0 }, 600);
		tween(msgL3, { alpha: 0 }, 600);
		await sleep(0.6); if (isStale(myGen)) return;
	}

	async function timeline3(myGen) {
		resetTimeline();
		currentTimelineIndex = 2;
		setTutorialText(2);
		tween(msgHead, { alpha: 1 }, 600);
		tween(msgL1, { alpha: 1 }, 600);
		tween(msgL2, { alpha: 1 }, 600);
		tween(msgL3, { alpha: 1 }, 600);
		tween(demoTexts[2], { alpha: 1 }, 500);
		tween(demoTexts[3], { alpha: 1 }, 500);
		await sleep(0.6); if (isStale(myGen)) return;
		tween(demoTexts[2], { y: demoTexts[2].y + 300 }, 1800);
		await tween(demoTexts[3], { y: demoTexts[3].y + 300 }, 1800).wait(); if (isStale(myGen)) return;
		await tween(centerButton, { scale: 1.2 }, 300, { ease: easeBackOut }).wait(); if (isStale(myGen)) return;
		await tween(centerButton, { scale: 1.0 }, 300, { ease: easeBackIn }).wait(); if (isStale(myGen)) return;
		tween(demoTexts[2], { x: demoTexts[2].x - 150, alpha: 0 }, 200);
		await tween(demoTexts[3], { x: demoTexts[3].x + 150, alpha: 0 }, 200).wait(); if (isStale(myGen)) return;
		spawnStarParticles(stars, demoTexts[2].x + 5, demoTexts[2].y, 15);
		showScoreLabelWithEffect(scoreLabels, demoTexts[2].x + 40, demoTexts[2].y, 10);
		spawnStarParticles(stars, demoTexts[3].x - 5, demoTexts[3].y, 15);
		showScoreLabelWithEffect(scoreLabels, demoTexts[3].x - 40, demoTexts[3].y, 10);
		await sleep(0.7); if (isStale(myGen)) return;
		tween(msgHead, { alpha: 0 }, 600);
		tween(msgL1, { alpha: 0 }, 600);
		tween(msgL2, { alpha: 0 }, 600);
		tween(msgL3, { alpha: 0 }, 600);
		await sleep(0.6); if (isStale(myGen)) return;
	}

	async function timeline4(myGen) {
		resetTimeline();
		currentTimelineIndex = 3;
		setTutorialText(3);
		tween(msgHead, { alpha: 1 }, 600);
		tween(msgL1, { alpha: 1 }, 600);
		tween(msgL2, { alpha: 1 }, 600);
		tween(msgL3, { alpha: 1 }, 600);
		tween(demoTexts[4], { alpha: 1 }, 500);
		tween(demoTexts[5], { alpha: 1 }, 500);
		await sleep(0.6); if (isStale(myGen)) return;
		tween(demoTexts[4], { y: demoTexts[4].y + 300 }, 1700);
		await tween(demoTexts[5], { y: demoTexts[5].y + 300 }, 1700).wait(); if (isStale(myGen)) return;
		await tween(centerButton, { scale: 1.2 }, 300, { ease: easeBackOut }).wait(); if (isStale(myGen)) return;
		await tween(centerButton, { scale: 1.0 }, 300, { ease: easeBackIn }).wait(); if (isStale(myGen)) return;
		const baseX5 = demoTexts[4].x - 140, baseX6 = demoTexts[5].x + 140;
		tween(demoTexts[4], { x: baseX5 }, 200);
		await tween(demoTexts[5], { x: baseX6 }, 200).wait(); if (isStale(myGen)) return;
		for (let i = 0; i < 2; i++) {
			tween(demoTexts[4], { x: baseX5 + 8 }, 50);
			await tween(demoTexts[5], { x: baseX6 - 16 }, 50).wait(); if (isStale(myGen)) return;
			tween(demoTexts[4], { x: baseX5 - 8 }, 50);
			await tween(demoTexts[5], { x: baseX6 + 16 }, 50).wait(); if (isStale(myGen)) return;
		}
		tween(demoTexts[4], { x: baseX5 }, 50);
		await tween(demoTexts[5], { x: baseX6 }, 50).wait(); if (isStale(myGen)) return;
		tween(demoTexts[4], { alpha: 0 }, 500);
		tween(demoTexts[5], { alpha: 0 }, 500);
		tween(msgHead, { alpha: 0 }, 800);
		tween(msgL1, { alpha: 0 }, 800);
		tween(msgL2, { alpha: 0 }, 800);
		tween(msgL3, { alpha: 0 }, 800);
		await sleep(0.8); if (isStale(myGen)) return;
	}

	async function timeline5(myGen) {
		resetTimeline();
		currentTimelineIndex = 4;
		setTutorialText(4);
		tween(msgHead, { alpha: 1 }, 600);
		tween(msgL1, { alpha: 1 }, 600);
		tween(msgL2, { alpha: 1 }, 600);
		tween(msgL3, { alpha: 1 }, 600);
		tween(demoTexts[6], { alpha: 1 }, 500);
		tween(demoTexts[7], { alpha: 1 }, 500);
		await sleep(0.6); if (isStale(myGen)) return;
		tween(demoTexts[6], { y: demoTexts[6].y + 300 }, 1700);
		tween(demoTexts[7], { y: demoTexts[7].y + 300 }, 1700);
		const gaugeObj = { val: 1 };
		tween(gaugeObj, { val: 0 }, 1200, { ease: easeLinear, onUpdate: () => { if (!isStale(myGen)) progress = gaugeObj.val; }, onComplete: () => {
			if (isStale(myGen)) return;
			colorOgi = "#000000"; colorHagi = "#000000";
			centerTopColor = "#ffffff"; centerBottomColor = "#ffffff"; centerBg = "#dddddd";
			leftButton.color = "#dddddd"; rightButton.color = "#dddddd";
		} });
		await sleep(1.7); if (isStale(myGen)) return;
		await tween(centerButton, { scale: 1.2 }, 300, { ease: easeBackOut }).wait(); if (isStale(myGen)) return;
		await tween(centerButton, { scale: 1.0 }, 300, { ease: easeBackIn }).wait(); if (isStale(myGen)) return;
		tween(demoTexts[6], { x: demoTexts[6].x - 150, alpha: 0 }, 200);
		await tween(demoTexts[7], { x: demoTexts[7].x + 150, alpha: 0 }, 200).wait(); if (isStale(myGen)) return;
		spawnStarParticles(stars, demoTexts[6].x + 5, demoTexts[6].y, 15);
		showScoreLabelWithEffect(scoreLabels, demoTexts[6].x + 40, demoTexts[6].y, 10);
		spawnStarParticles(stars, demoTexts[7].x - 5, demoTexts[7].y, 15);
		showScoreLabelWithEffect(scoreLabels, demoTexts[7].x - 40, demoTexts[7].y, 10);
		colorOgi = "#cc0000"; colorHagi = "#bb9900";
		centerTopColor = "#ff2200"; centerBottomColor = "#ffcc00"; centerBg = "#ffffff";
		leftButton.color = "#ff2222"; rightButton.color = "#ffcc00";
		progress = 1;
		showColorfulText(colorfulTexts, W / 2, H / 2);
		const gaugeObj2 = { val: 1 };
		tween(gaugeObj2, { val: 0 }, 1500, { ease: easeLinear, onUpdate: () => { if (!isStale(myGen)) progress = gaugeObj2.val; }, onComplete: () => {
			if (isStale(myGen)) return;
			colorOgi = "#000000"; colorHagi = "#000000";
			centerTopColor = "#ffffff"; centerBottomColor = "#ffffff"; centerBg = "#dddddd";
			leftButton.color = "#dddddd"; rightButton.color = "#dddddd";
		} });
		await sleep(1.0); if (isStale(myGen)) return;
		tween(msgHead, { alpha: 0 }, 600);
		tween(msgL1, { alpha: 0 }, 600);
		tween(msgL2, { alpha: 0 }, 600);
		tween(msgL3, { alpha: 0 }, 600);
		await sleep(0.6); if (isStale(myGen)) return;
	}

	async function timeline6(myGen) {
		clearCount = 9;
		resetTimeline();
		currentTimelineIndex = 5;
		setTutorialText(5);
		tween(msgHead, { alpha: 1 }, 600);
		tween(msgL1, { alpha: 1 }, 600);
		tween(msgL2, { alpha: 1 }, 600);
		tween(msgL3, { alpha: 1 }, 600);
		tween(comboText, { alpha: 1 }, 800);
		tween(demoTexts[8], { alpha: 1 }, 500);
		await sleep(0.8); if (isStale(myGen)) return;
		await tween(demoTexts[8], { y: demoTexts[8].y + 200 }, 1000).wait(); if (isStale(myGen)) return;
		await tween(leftButton, { scale: 1.2 }, 300, { ease: easeBackOut }).wait(); if (isStale(myGen)) return;
		await tween(leftButton, { scale: 1.0 }, 300, { ease: easeBackIn }).wait(); if (isStale(myGen)) return;
		await tween(demoTexts[8], { x: demoTexts[8].x - 150, alpha: 0 }, 200).wait(); if (isStale(myGen)) return;
		spawnStarParticles(stars, demoTexts[8].x + 5, demoTexts[8].y, 15);
		showScoreLabelWithEffect(scoreLabels, demoTexts[8].x + 30, demoTexts[8].y, 8);
		clearCount++;
		addComboTitle(true, myGen);
		colorOgi = "#cc0000"; colorHagi = "#bb9900";
		centerTopColor = "#ff2200"; centerBottomColor = "#ffcc00"; centerBg = "#ffffff";
		leftButton.color = "#ff2222"; rightButton.color = "#ffcc00";
		progress = 1;
		await sleep(1.0); if (isStale(myGen)) return;
		tween(msgHead, { alpha: 0 }, 500);
		tween(msgL1, { alpha: 0 }, 500);
		tween(msgL2, { alpha: 0 }, 500);
		tween(msgL3, { alpha: 0 }, 500);
		await sleep(0.5); if (isStale(myGen)) return;
	}

	// 判定タイミングの説明。押すのが早いほど高得点(PERFECT>GREAT>NICE>SAFE)なことを、
	// ドット線の各区間に対応する高さにラベルを順番に並べて見せる。
	async function timeline7(myGen) {
		resetTimeline();
		currentTimelineIndex = 6;
		setTutorialText(6);
		tween(msgHead, { alpha: 1 }, 600);
		tween(msgL1, { alpha: 1 }, 600);
		tween(msgL2, { alpha: 1 }, 600);
		tween(msgL3, { alpha: 1 }, 600);
		await sleep(0.6); if (isStale(myGen)) return;

		const rows = [45, 150, 270, 393];
		const labels = t("timingLabels");
		for (let i = 0; i < rows.length; i++) {
			const item = { x: W / 2, y: rows[i], alpha: 0, text: labels[i].text, color: labels[i].color };
			timingLabels.push(item);
			tween(item, { alpha: 1 }, 300);
			await sleep(0.35); if (isStale(myGen)) return;
		}
		await sleep(1.3); if (isStale(myGen)) return;
		timingLabels.forEach((item) => tween(item, { alpha: 0 }, 400));
		await sleep(0.5); if (isStale(myGen)) return;
		timingLabels.length = 0;

		tween(msgHead, { alpha: 0 }, 600);
		tween(msgL1, { alpha: 0 }, 600);
		tween(msgL2, { alpha: 0 }, 600);
		tween(msgL3, { alpha: 0 }, 600);
		await sleep(0.6); if (isStale(myGen)) return;
	}

	async function timeline8(myGen) {
		clearCount = 10;
		resetTimeline();
		currentTimelineIndex = 7;
		setTutorialText(7);
		tween(msgHead, { alpha: 1 }, 600);
		tween(msgL1, { alpha: 1 }, 600);
		tween(msgL2, { alpha: 1 }, 600);
		tween(msgL3, { alpha: 1 }, 600);
		tween(demoTexts[9], { alpha: 1 }, 500);
		await sleep(0.6); if (isStale(myGen)) return;
		await tween(demoTexts[9], { y: demoTexts[9].y + 200 }, 1000).wait(); if (isStale(myGen)) return;
		await tween(rightButton, { scale: 1.2 }, 300, { ease: easeBackOut }).wait(); if (isStale(myGen)) return;
		await tween(rightButton, { scale: 1.0 }, 300, { ease: easeBackIn }).wait(); if (isStale(myGen)) return;
		await tween(demoTexts[9], { x: demoTexts[9].x + 150, alpha: 0 }, 200).wait(); if (isStale(myGen)) return;
		clearCount++;
		addComboTitle(false, myGen);
		spawnStarParticles(stars, demoTexts[9].x + 5, demoTexts[9].y, 15);
		showScoreLabelWithEffect(scoreLabels, demoTexts[9].x - 30, demoTexts[9].y, 8);
		await sleep(1.0); if (isStale(myGen)) return;
		await tween(darkOverlay, { alpha: 1 }, 500).wait(); if (isStale(myGen)) return;
	}

	const timelineFns = [timeline1, timeline2, timeline3, timeline4, timeline5, timeline6, timeline7, timeline8];

	async function startLoop(fromIndex) {
		loopGen++;
		const myGen = loopGen;
		const order = [];
		for (let i = 0; i < timelineFns.length; i++) order.push((fromIndex + i) % timelineFns.length);
		while (myGen === loopGen) {
			for (const idx of order) {
				if (myGen !== loopGen) return;
				await timelineFns[idx](myGen);
				if (myGen !== loopGen) return;
			}
		}
	}
	startLoop(0);

	function optionCall() {
		if (!overlayVisible) {
			overlayVisible = true;
			tween(darkOverlay, { alpha: 0.3 }, 300, { pausable: false });
			tween(overlay, { alpha: 1 }, 300, { pausable: false, onComplete: () => { demoPaused = true; } });
		} else {
			tween(darkOverlay, { alpha: 0.0 }, 300, { pausable: false });
			tween(overlay, { alpha: 0 }, 300, { pausable: false, onComplete: () => { demoPaused = false; overlayVisible = false; } });
		}
	}
	function onStartClick() {
		tween(darkOverlay, { alpha: 1 }, 300, { pausable: false, onComplete: () => { switchScene("main"); } });
	}

	function hitTriangle(btn, x, y) {
		return x >= btn.x - 40 && x <= btn.x + 40 && y >= btn.y - 25 && y <= btn.y + 25;
	}
	function hitPopupBtn(bx, by, x, y) {
		return x >= bx - 65 && x <= bx + 65 && y >= by - 20 && y <= by + 20;
	}

	return {
		update(dt) {
			if (!demoPaused) blinkPhase += dt;
		},
		draw() {
			const blink = blinkAlpha();
			ctx.save(); ctx.globalAlpha = blink;
			drawText(t("demoLabel"), 10, 10, { size: 40, color: "#333333", baseline: "top" });
			drawText(t("tapLabel"), W / 2, 2, { size: 25, color: "#333333", align: "center", baseline: "top" });
			drawText(t("startLabel"), W / 2, 25, { size: 25, color: "#333333", align: "center", baseline: "top" });
			ctx.restore();

			drawGauge(timerCx, timerCy, radius, progress);

			ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#000000"; ctx.fillRect(0, H - 110, W, 80); ctx.restore();
			drawDottedLine(0, 90, W, 90, 2, 5, "#eeeeee");
			drawDottedLine(0, 200, W, 200, 2, 5, "#eeeeee");
			drawDottedLine(0, 320, W, 320, 2, 5, "#eeeeee");

			// OGI/HAGIそれぞれのボタンで正解になる表記の一覧。英語話者にも「どの単語がどちらの
			// ボタンに対応するか」がひと目で伝わるよう、チュートリアル中は常時表示しておく。
			// 左列=OGI(赤)、右列=HAGI(黄)で、それぞれのボタンの真上あたりに縦に並べる。
			// ドット線(y≈80〜90)より後に描画することで、線より上のレイヤに乗せて重なりを回避。
			// 背景の大きな「荻/萩」(y=150〜)には少し重なるが、文字を大きく見やすくするため許容する。
			{
				const wordsOgi = ["荻", "おぎ", "オギ", "OGI"];
				const wordsHagi = ["萩", "はぎ", "ハギ", "HAGI"];
				const colXOgi = 65, colXHagi = W - 65;
				const labelY = 53;
				const wordStartY = 70, rowH = 20, wordSize = 17;
				const labelSize = Math.min(fitFontSize(t("legendOgi"), 125, 12, "bold"), fitFontSize(t("legendHagi"), 125, 12, "bold"));
				ctx.save();
				drawText(t("legendOgi"), colXOgi, labelY, { size: labelSize, weight: "bold", color: "#cc0000", align: "center", baseline: "top", stroke: "#ffffff", strokeWidth: 3 });
				drawText(t("legendHagi"), colXHagi, labelY, { size: labelSize, weight: "bold", color: "#997700", align: "center", baseline: "top", stroke: "#ffffff", strokeWidth: 3 });
				wordsOgi.forEach((w, i) => {
					drawText(w, colXOgi, wordStartY + rowH * i, { size: wordSize, weight: "bold", color: "#cc0000", align: "center", baseline: "top", stroke: "#ffffff", strokeWidth: 3 });
				});
				wordsHagi.forEach((w, i) => {
					drawText(w, colXHagi, wordStartY + rowH * i, { size: wordSize, weight: "bold", color: "#997700", align: "center", baseline: "top", stroke: "#ffffff", strokeWidth: 3 });
				});
				ctx.restore();
			}

			// 判定タイミング説明(7/7)中だけ、ドット線の区間に対応するPERFECT/GREAT/NICE/SAFEを表示
			timingLabels.forEach((item) => {
				if (item.alpha <= 0) return;
				ctx.save(); ctx.globalAlpha = item.alpha;
				drawText(item.text, item.x, item.y, { size: 30, weight: "bold", color: item.color, align: "center", baseline: "middle", stroke: "#000000", strokeWidth: 4 });
				ctx.restore();
			});

			if (bgOYH.alpha > 0) {
				ctx.save(); ctx.globalAlpha = bgOYH.alpha;
				drawText("荻", 5, 150 + bgOYH.y - 200, { size: 124, color: "#cc0000", baseline: "top" });
				drawText("や", 130, 175 + bgOYH.y - 200, { size: 100, color: "#000000", baseline: "top" });
				drawText("萩", 230, 150 + bgOYH.y - 200, { size: 124, color: "#ccaa00", baseline: "top" });
				ctx.restore();
			}

			drawBgSet(bgSet, colorOgi, colorHagi);
			ctx.save(); ctx.globalAlpha = 0.3; drawText("や", 130, 175, { size: 100, color: "#000000", baseline: "top" }); ctx.restore();

			drawSideButton(leftButton);
			drawSideButton(rightButton);
			drawCenterButton(centerButton, centerTopColor, centerBottomColor, centerBg);

			demoTexts.forEach((d) => {
				if (d.alpha <= 0) return;
				ctx.save(); ctx.globalAlpha = d.alpha;
				drawText(d.word, d.x, d.y, { size: 36, color: d.color === "red" ? "#cc0000" : "#ccaa00", align: "center", baseline: "middle", stroke: "#ffffff", strokeWidth: 4 });
				ctx.restore();
			});

			if (comboText.alpha > 0) {
				ctx.save(); ctx.globalAlpha = comboText.alpha;
				ctx.translate(comboText.x, comboText.y);
				ctx.rotate(comboText.rotation);
				drawText(comboText.text, 0, 0, { size: 20, color: "#ffd700", align: "right", baseline: "bottom", stroke: "#000000", strokeWidth: 3 });
				ctx.restore();
			}
			if (bonusText.visible) {
				ctx.save(); ctx.globalAlpha = bonusText.alpha;
				drawText(t("bonusLabel"), bonusText.x, bonusText.y, { size: 48, weight: "bold", color: "#ff4444", align: "center", baseline: "middle", stroke: "#ffffff", strokeWidth: 5 });
				ctx.restore();
			}

			drawStarList(stars);
			drawMiniParticleList(miniParticles);
			drawScoreLabelList(scoreLabels);
			drawColorfulList(colorfulTexts);

			if (msgArea.alpha > 0) {
				ctx.save(); ctx.globalAlpha = msgArea.alpha;
				ctx.strokeStyle = "#000000"; ctx.lineWidth = 2;
				roundRectPath(15, 300, 330, 120, 10);
				ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.stroke();
				ctx.restore();
			}
			if (msgHead.alpha > 0) { ctx.save(); ctx.globalAlpha = msgHead.alpha; drawText(msgHead.text, 50, 307, { size: fitFontSize(msgHead.text, 290, 18), color: "#000000", baseline: "top" }); ctx.restore(); }
			if (msgL1.alpha > 0) { ctx.save(); ctx.globalAlpha = msgL1.alpha; drawText(msgL1.text, 50, 335, { size: fitFontSize(msgL1.text, 290, 18), color: "#000000", baseline: "top" }); ctx.restore(); }
			if (msgL2.alpha > 0) { ctx.save(); ctx.globalAlpha = msgL2.alpha; drawText(msgL2.text, 50, 360, { size: fitFontSize(msgL2.text, 290, 18), color: "#000000", baseline: "top" }); ctx.restore(); }
			if (msgL3.alpha > 0) { ctx.save(); ctx.globalAlpha = msgL3.alpha; drawText(msgL3.text, 50, 385, { size: fitFontSize(msgL3.text, 290, 18), color: "#000000", baseline: "top" }); ctx.restore(); }

			if (overlayVisible || overlay.alpha > 0) {
				ctx.save(); ctx.globalAlpha = overlay.alpha;
				fillRoundRect(30, 190, 300, 110, 10, "rgba(0,0,0,0.8)");
				drawText(t("startQuestion"), W / 2, 220, { size: 24, color: "#ffffff", align: "center", baseline: "middle" });
				fillRoundRect(W / 2 - 70 - 65, 260 - 20, 130, 40, 10, "#ffffff");
				drawText(t("startBtn"), W / 2 - 70, 265, { size: 24, weight: "bold", color: "#333333", align: "center", baseline: "middle" });
				fillRoundRect(W / 2 + 70 - 65, 260 - 20, 130, 40, 10, "#dddddd");
				drawText(t("cancelBtn"), W / 2 + 70, 265, { size: 22, weight: "bold", color: "#333333", align: "center", baseline: "middle" });
				ctx.restore();
			}

			ctx.save();
			ctx.fillStyle = "#ff6666";
			ctx.beginPath(); ctx.moveTo(buttonL.x - 40, buttonL.y); ctx.lineTo(buttonL.x, buttonL.y - 25); ctx.lineTo(buttonL.x, buttonL.y + 25); ctx.closePath(); ctx.fill();
			ctx.fillStyle = "#ffcc66";
			ctx.beginPath(); ctx.moveTo(buttonR.x + 40, buttonR.y); ctx.lineTo(buttonR.x, buttonR.y - 25); ctx.lineTo(buttonR.x, buttonR.y + 25); ctx.closePath(); ctx.fill();
			ctx.restore();

			drawLangButton();

			if (darkOverlay.alpha > 0) {
				ctx.save(); ctx.globalAlpha = darkOverlay.alpha; ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, H); ctx.restore();
			}
		},
		onDown(x, y) {
			if (hitTestBtn(BTN_LANG, x, y)) { setLang(lang === "ja" ? "en" : "ja"); return; }
			if (overlayVisible) {
				if (hitPopupBtn(W / 2 - 70, 265, x, y)) { onStartClick(); }
				else if (hitPopupBtn(W / 2 + 70, 265, x, y)) { optionCall(); }
				return;
			}
			if (hitTriangle(buttonL, x, y)) { startLoop((currentTimelineIndex - 1 + timelineFns.length) % timelineFns.length); return; }
			if (hitTriangle(buttonR, x, y)) { startLoop((currentTimelineIndex + 1) % timelineFns.length); return; }
			optionCall();
		},
	};
}

/* ==================== 称号システム（日英で構造が異なるためここで吸収） ==================== */
function getRandomFlipColor() {
	const colors = ["#000000", "#cc0000", "#ccaa00"];
	return colors[Math.floor(Math.random() * colors.length)];
}
function getResultTitles(redCorrect, yellowCorrect, scoreM) {
	const titles1 = t("titles1");
	let title1 = titles1[titles1.length - 1];
	for (const tt of titles1) { if (scoreM < tt.max) { title1 = tt; break; } }
	const idx = titles1.indexOf(title1);
	const nextScore = idx < titles1.length - 1 ? title1.max - scoreM : null;

	function getRank(score) {
		if (score < 250) return 0;
		if (score < 1000) return 1;
		if (score < 2500) return 2;
		if (score < 5000) return 3;
		return 4;
	}
	const rankIndex = getRank(scoreM);
	let title2;
	if (redCorrect === yellowCorrect) {
		title2 = t("rankA")[rankIndex];
	} else {
		const entry = t("rankB")[rankIndex];
		if (entry.titleFmt) {
			title2 = entry.titleFmt(redCorrect > yellowCorrect ? "OGI" : "HAGI");
		} else {
			const winner = redCorrect > yellowCorrect ? "荻" : "萩";
			title2 = entry.title.slice(0, entry.insertIndex) + winner + entry.title.slice(entry.insertIndex);
		}
	}
	return { title1: title1.name, stars: title1.stars, title2, nextScore };
}
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ==================== メインシーン ==================== */
const RED_WORDS = ["荻", "OGI", "おぎ", "オギ"];
const YELLOW_WORDS = ["萩", "HAGI", "はぎ", "ハギ"];

function createMainScene() {
	const bgSet = makeBgSet();
	const ogiBefore = { key: "OKN" };
	const hagiBefore = { key: "HKN" };
	let centerTopColor = "#ff2200", centerBottomColor = "#ffcc00", centerBg = "#ffffff";
	let comboColor = "#ffd700";

	let startFlg = false;
	let gameover = false;
	let score = 0, displayScore = 0;
	let scoreLeft = 0, scoreRight = 0;
	const y_deadline = H - 92;
	let time = 0;
	let fallSpeed = 2;
	const activeWords = [];
	// 判定後(成功/失敗アニメ中)の単語。activeWordsからは外れるが描画は続ける必要がある。
	const flyingWords = [];
	let wordSpawnInterval = 2000;
	let level = 1;
	let clearCount = 0;
	let frameCount = 0;
	let resultflg = false;

	const leftButton = { x: 65, y: H - 75, scale: 1, label: "OGI", color: "#ff2222", fontSize: 40 };
	const rightButton = { x: W - 65, y: H - 75, scale: 1, label: "HAGI", color: "#ffcc00", fontSize: 40 };
	const centerButton = { x: W / 2, y: H - 75, scale: 1 };

	const maxTime = 8;
	let currentMaxTime = maxTime;
	let currentTime = maxTime;
	let progress = 1;
	const timerCx = W / 2, timerCy = H / 2 - 50, radius = 180;
	const timerTextObj = { scale: 1 };
	let timerDisplayValue = maxTime;

	const comboText = { x: W + 200, y: H - 120, alpha: 0, rotation: 0, text: "COMBO x0" };
	const bonusText = { x: W - 60, y: H - 120, alpha: 1, visible: false };
	const miniParticles = [];
	const stars = [];
	const scoreLabels = [];
	const colorfulTexts = [];
	const bgOYH = { y: 200, alpha: 0 };
	const yaChar = { y: 0 };

	let dottedLineYOffset = 0;
	function updateDottedLine() { dottedLineYOffset = Math.floor((fallSpeed / 2) * 10); }
	updateDottedLine();

	const darkOverlay = { alpha: 0 };
	const darkOverlay2 = { alpha: 0 };
	let resultState = null;

	function addTime(seconds) {
		if (score < 250) seconds += 0.5;
		else if (score < 1000) seconds -= 1;
		else if (score < 2500) seconds -= 2;
		else if (score < 5000) seconds -= 3;
		else seconds -= 3.8;
		currentTime = Math.min(currentTime + seconds, maxTime);
		if (currentTime < 0.7) currentTime = 0.7;
		currentMaxTime = currentTime;
	}

	/* ---- 単語生成 ---- */
	function spawnWord() {
		const candidates = [];
		for (let i = 0; i < level; i++) {
			candidates.push({ word: randomFrom(RED_WORDS), color: "red" });
			candidates.push({ word: randomFrom(YELLOW_WORDS), color: "yellow" });
		}
		const sel = randomFrom(candidates);
		activeWords.push({ x: W / 2, y: 0, word: sel.word, fruitColor: sel.color, color: "#cc0000", alpha: 1 });
	}
	function respawnWord() {
		if (gameover) return;
		wordSpawnInterval = Math.random() * 1500 + (500 * 2) / fallSpeed;
		spawnWord();
		setTimeout(respawnWord, wordSpawnInterval);
	}

	/* ---- 判定 ---- */
	function calculateScore(yPosition) {
		if (yPosition < 90 + dottedLineYOffset) return 9;
		if (yPosition < 200 + dottedLineYOffset) return 8;
		if (yPosition < 320 + dottedLineYOffset) return 6;
		return 5;
	}

	function backgroundChange(word) {
		if (word.fruitColor === "red") {
			const newKey = OGI_KEY_BY_WORD[word.word] || "OKN";
			flipBgSet(bgSet, ogiBefore, "O", newKey);
		} else {
			const newKey = HAGI_KEY_BY_WORD[word.word] || "HKN";
			flipBgSet(bgSet, hagiBefore, "H", newKey);
		}
	}

	async function animateSuccess(word, direction, amount) {
		const dx = direction === "left" ? -150 : 150;
		await tween(word, { x: word.x + dx, alpha: 0 }, 200).wait();
		showScoreLabelWithEffect(scoreLabels, W / 2 + dx * 0.8, word.y, amount);
		const idx = flyingWords.indexOf(word);
		if (idx >= 0) flyingWords.splice(idx, 1);
		spawnStarParticles(stars, word.x, word.y, 15);
		backgroundChange(word);
	}

	// チュートリアル4/6(OGIYAHAGIが使えない場面)と同じ「方向に飛んでから左右に4回震えて止まる」動き
	async function animateFailure(word, direction, btnflg) {
		let dx = direction === "left" ? -140 : direction === "right" ? 140 : 0;
		if (btnflg === false) dx = 0;
		const baseX = word.x + dx;
		await tween(word, { x: baseX, alpha: 1 }, 200).wait();
		const shakeOffsets = [8, -8, 8, -8, 0];
		for (const off of shakeOffsets) {
			await tween(word, { x: baseX + off }, 50).wait();
		}
		const idx = flyingWords.indexOf(word);
		if (idx >= 0) flyingWords.splice(idx, 1);
		gameover = true;
		resultFailure();
	}

	function updateScoreDisplay() {
		const interval = setInterval(() => {
			displayScore += 4;
			if (displayScore >= score) { displayScore = score; clearInterval(interval); }
		}, 20);
	}

	function handleDirection(direction, ogyYaHagi) {
		if (activeWords.length === 0) return;
		const word = activeWords.shift();
		flyingWords.push(word);
		animateButtonPress(direction === "left" ? leftButton : direction === "right" ? rightButton : centerButton);

		let scoreY = calculateScore(word.y);
		let isCorrect = false;
		let addscore;
		if (ogyYaHagi) { scoreY = 10; addscore = 125; }
		else if (scoreY >= 9) addscore = 100;
		else if (scoreY >= 7) addscore = 75;
		else if (scoreY >= 5) addscore = 50;
		else addscore = 25;

		if (direction === "left" && word.fruitColor === "red") { isCorrect = true; scoreLeft += addscore; }
		else if (direction === "right" && word.fruitColor === "yellow") { isCorrect = true; scoreRight += addscore; }

		if (isCorrect) {
			score = scoreLeft + scoreRight;
			updateScoreDisplay();
			animateSuccess(word, direction, scoreY);
			if (score % 5 === 0) {
				level += 1;
				clearCount++;
				if (clearCount % 10 === 0) fallSpeed *= 1.1;
				addComboMain();
				fallSpeed += 0.01;
				updateDottedLine();
			}
		} else {
			animateFailure(word, direction);
		}
	}

	async function addComboMain() {
		comboText.text = `COMBO x${clearCount}`;
		comboText.alpha = 1;
		comboText.rotation = 0;
		if (clearCount % 10 === 0) {
			addTime(3);
			const baseX = comboText.x;
			await tween(comboText, { x: baseX + 10 }, 50).wait();
			await tween(comboText, { x: baseX - 20 }, 50).wait();
			await tween(comboText, { x: baseX + 10 }, 50).wait();
			for (let i = 0; i < 3; i++) {
				await tween(comboText, { rotation: 0.1, alpha: 0.5 }, 100).wait();
				await tween(comboText, { rotation: 0, alpha: 1 }, 100).wait();
			}
			bonusText.visible = true; bonusText.alpha = 1; bonusText.y = H - 150;
			tween(bonusText, { y: bonusText.y - 30, alpha: 0 }, 1000, { onComplete: () => { bonusText.visible = false; } });
			spawnMiniParticles(miniParticles, comboText.x, comboText.y);
		} else {
			comboText.x = W - 20;
			await tween(comboText, { y: comboText.y - 10 }, 100).wait();
			await tween(comboText, { y: comboText.y + 10 }, 100).wait();
		}
	}

	function onCenterClick() {
		if (gameover) return;
		if (activeWords.length < 2) return;
		bgOYH.y = 255;
		bgOYH.alpha = 1;
		animateButtonPress(centerButton);
		handleDirection("left", true);
		handleDirection("right", true);
		tween(bgOYH, { y: bgOYH.y - H, alpha: 0 }, 400, { ease: easePower1InOut });
		(async () => {
			await tween(yaChar, { y: yaChar.y - 400 }, 200, { ease: easePower1Out }).wait();
			yaChar.y = 400;
			await tween(yaChar, { y: yaChar.y - 400 }, 200, { ease: easePower1Out }).wait();
			addTime(5);
			showColorfulText(colorfulTexts, W / 2, H / 2 + 100);
			for (let i = 0; i < 50; i++) {
				const color = i % 2 === 0 ? "#cc0000" : "#ccaa00";
				const star = { x: W / 2, y: W / 2, alpha: 1, color };
				stars.push(star);
				tween(star, { x: star.x + (Math.random() - 0.5) * 300, y: star.y + (Math.random() - 0.5) * 300, alpha: 0 }, 500, {
					onComplete: () => { const idx = stars.indexOf(star); if (idx >= 0) stars.splice(idx, 1); },
				});
			}
		})();
	}

	/* ---- リザルト画面 ---- */
	function resultFailure() {
		if (resultflg) return;
		clearInterval(timerInterval);
		darkOverlay.alpha = 1;
		startResult(score, scoreLeft, scoreRight);
	}
	function startResult(finalScore, redCorrect, yellowCorrect) {
		resultflg = true;
		const rs = {
			alpha: 0, currentRed: 0, currentYellow: 0, currentScore: 0,
			redCorrect, yellowCorrect, finalScore,
			rolling: true, revealed: false,
			title1: "", title2: "", stars: 0, nextText: "",
			title1Y: 290, title1Alpha: 0, starAlpha: 0, title2Y: 352, title2Alpha: 0, nextAlpha: 0,
			particles: [],
		};
		resultState = rs;
		for (let i = 0; i < 30; i++) {
			const star = { x: W / 2 + (Math.random() - 0.5) * 100, y: 110, alpha: 1, color: "#ffff00" };
			rs.particles.push(star);
			tween(star, { x: star.x + (Math.random() - 0.5) * 100, y: star.y + (Math.random() - 0.5) * 100, alpha: 0 }, 1500, {
				onComplete: () => { const idx = rs.particles.indexOf(star); if (idx >= 0) rs.particles.splice(idx, 1); },
			});
		}
		tween(rs, { alpha: 1 }, 20 * 50); // フェードイン（元は+0.05*delta毎フレーム ≈ 20フレーム=約0.33秒をtweenで近似）
	}
	async function revealResultTitles(rs) {
		rs.revealed = true;
		const info = getResultTitles(rs.redCorrect, rs.yellowCorrect, rs.finalScore);
		rs.title1 = info.title1;
		rs.stars = info.stars;
		rs.title2 = info.title2;
		rs.nextText = info.nextScore === null ? t("perfectClear") : t("nextFmt")(info.nextScore);
		await tween(rs, { title1Y: rs.title1Y + 10, title1Alpha: 1 }, 500, { ease: easePower1Out }).wait();
		tween(rs, { starAlpha: 0.5 }, 500, { ease: easePower1Out });
		await tween(rs, { title2Y: rs.title2Y - 10, title2Alpha: 1 }, 500, { ease: easePower1Out }).wait();
		await tween(rs, { nextAlpha: 1 }, 500, { ease: easePower1Out }).wait();
	}

	/* ---- タイマー / スコア表示更新 ---- */
	const timerInterval = setInterval(() => { if (!gameover) time += 1; }, 1000);

	/* ---- 初期フェードイン ---- */
	darkOverlay2.alpha = 1;
	tween(darkOverlay2, { alpha: 0 }, 500, { onComplete: () => { startFlg = true; respawnWord(); } });

	function hitRect(cx, cy, hw, hh, x, y) { return x >= cx - hw && x <= cx + hw && y >= cy - hh && y <= cy + hh; }

	return {
		update(dtMs) {
			if (!gameover) {
				const delta = dtMs / (1000 / 60);
				frameCount++;
				let colorFlg;
				if (currentTime > 0) {
					colorFlg = true;
					currentTime -= delta / 60;
					if (currentTime < 0) currentTime = 0;
					progress = currentTime / currentMaxTime;
					const displayTime = Math.ceil(currentTime);
					if (timerDisplayValue !== displayTime) {
						timerDisplayValue = displayTime;
						tween(timerTextObj, { scale: 1.3 }, 100, { onComplete: () => { tween(timerTextObj, { scale: 1.0 }, 100); } });
					}
				} else {
					colorFlg = false;
				}

				if (colorFlg) {
					["OKN", "OH", "OKT", "OE"].forEach((k) => { bgSet[k].color = "#cc0000"; });
					["HKN", "HH", "HKT", "HE"].forEach((k) => { bgSet[k].color = "#bb9900"; });
					centerTopColor = "#ff2200"; centerBottomColor = "#ffcc00"; centerBg = "#ffffff";
					leftButton.color = "#ff2222"; rightButton.color = "#ffcc00";
					comboColor = "#ffd700";
				} else if (score >= 3000) {
					if (frameCount % 8 === 0) {
						["OKN", "OH", "OKT", "OE", "HKN", "HH", "HKT", "HE"].forEach((k) => { bgSet[k].color = getRandomFlipColor(); });
						centerTopColor = "#ffffff"; centerBottomColor = "#ffffff"; centerBg = "#dddddd";
						leftButton.color = "#dddddd"; rightButton.color = "#dddddd";
						comboColor = "#ffffff";
					}
				} else {
					["OKN", "OH", "OKT", "OE", "HKN", "HH", "HKT", "HE"].forEach((k) => { bgSet[k].color = "#000000"; });
					centerTopColor = "#ffffff"; centerBottomColor = "#ffffff"; centerBg = "#dddddd";
					leftButton.color = "#dddddd"; rightButton.color = "#dddddd";
					comboColor = "#ffffff";
				}

				activeWords.forEach((word) => {
					if (colorFlg) word.color = word.fruitColor === "red" ? "#cc0000" : "#ccaa00";
					else if (score >= 3000) { if (frameCount % 45 === 0) word.color = getRandomFlipColor(); }
					else word.color = "#000000";
					word.y += fallSpeed * delta;
					if (word.y > y_deadline && !gameover) {
						gameover = true;
						animateFailure(word, 0, false);
					}
				});
			}

			if (resultState && resultState.rolling) {
				const rs = resultState;
				const step = Math.ceil(rs.finalScore / 100) * (dtMs / 16.6667);
				if (rs.currentScore < rs.finalScore) {
					rs.currentRed = Math.min(rs.redCorrect, rs.currentRed + step);
					rs.currentYellow = Math.min(rs.yellowCorrect, rs.currentYellow + step);
					rs.currentScore = Math.min(rs.finalScore, rs.currentScore + step);
				} else {
					rs.rolling = false;
					revealResultTitles(rs);
				}
			}
		},
		draw() {
			drawText(t("scoreFmt")(displayScore), 10, 10, { size: 24, color: "#333333", baseline: "top" });
			drawText(t("timeFmt")(time), W - 10, 10, { size: 24, color: "#333333", align: "right", baseline: "top" });

			drawGauge(timerCx, timerCy, radius, progress);

			ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#000000"; ctx.fillRect(0, H - 110, W, 80); ctx.restore();
			drawDottedLine(0, 90 + dottedLineYOffset, W, 90 + dottedLineYOffset, 2, 5, "#eeeeee");
			drawDottedLine(0, 200 + dottedLineYOffset, W, 200 + dottedLineYOffset, 2, 5, "#eeeeee");
			drawDottedLine(0, 320 + dottedLineYOffset, W, 320 + dottedLineYOffset, 2, 5, "#eeeeee");

			if (bgOYH.alpha > 0) {
				ctx.save(); ctx.globalAlpha = bgOYH.alpha;
				drawText("荻", 5, 150 + bgOYH.y - 200, { size: 124, color: "#cc0000", baseline: "top" });
				drawText("や", 130, 175 + bgOYH.y - 200, { size: 100, color: "#000000", baseline: "top" });
				drawText("萩", 230, 150 + bgOYH.y - 200, { size: 124, color: "#ccaa00", baseline: "top" });
				ctx.restore();
			}

			drawBgSet(bgSet);
			ctx.save(); ctx.globalAlpha = 0.3; drawText("や", 130, 175 + yaChar.y, { size: 100, color: "#000000", baseline: "top" }); ctx.restore();

			drawSideButton(leftButton);
			drawSideButton(rightButton);
			drawCenterButton(centerButton, centerTopColor, centerBottomColor, centerBg);

			activeWords.forEach((word) => {
				ctx.save(); ctx.globalAlpha = word.alpha;
				drawText(word.word, word.x, word.y, { size: 36, color: word.color, align: "center", baseline: "middle", stroke: "#ffffff", strokeWidth: 4 });
				ctx.restore();
			});
			flyingWords.forEach((word) => {
				ctx.save(); ctx.globalAlpha = word.alpha;
				drawText(word.word, word.x, word.y, { size: 36, color: word.color, align: "center", baseline: "middle", stroke: "#ffffff", strokeWidth: 4 });
				ctx.restore();
			});

			if (comboText.alpha > 0) {
				ctx.save(); ctx.globalAlpha = comboText.alpha;
				ctx.translate(comboText.x, comboText.y);
				ctx.rotate(comboText.rotation);
				drawText(comboText.text, 0, 0, { size: 20, color: comboColor, align: "right", baseline: "bottom", stroke: "#000000", strokeWidth: 3 });
				ctx.restore();
			}
			if (bonusText.visible) {
				ctx.save(); ctx.globalAlpha = bonusText.alpha;
				drawText(t("bonusLabel"), bonusText.x, bonusText.y, { size: 48, weight: "bold", color: "#ff4444", align: "center", baseline: "middle", stroke: "#ffffff", strokeWidth: 5 });
				ctx.restore();
			}

			drawStarList(stars);
			drawMiniParticleList(miniParticles);
			drawScoreLabelList(scoreLabels);
			drawColorfulList(colorfulTexts);

			if (darkOverlay.alpha > 0) { ctx.save(); ctx.globalAlpha = darkOverlay.alpha; ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, H); ctx.restore(); }

			if (resultState) {
				const rs = resultState;
				ctx.save(); ctx.globalAlpha = rs.alpha;
				fillRoundRect(35, 75, W - 70, H - 140, 20, "rgba(0,0,0,0.5)");
				drawText(t("resultTitle"), W / 2, 110, { size: 48, weight: "bold", color: "#ffffff", align: "center", baseline: "middle" });
				ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(80, 135, 200, 6);
				drawDottedLine(80, 255, 140, 255, 2, 3, "rgba(238,238,255,0.8)");
				drawDottedLine(222, 255, 280, 255, 2, 3, "rgba(238,238,255,0.8)");
				drawText("OGI", 75, 160, { size: 32, weight: "bold", color: "#ff4444", baseline: "top" });
				drawText("HAGI", 205, 160, { size: 32, weight: "bold", color: "#ffaa00", baseline: "top" });
				drawText(`${Math.floor(rs.currentRed)}`, 105, 220, { size: 32, weight: "bold", color: "#ff4444", align: "center", baseline: "middle" });
				drawText(`${Math.floor(rs.currentYellow)}`, 245, 220, { size: 32, weight: "bold", color: "#ffaa00", align: "center", baseline: "middle" });
				drawText(t("resultLabelTitle"), W / 2, 255, { size: 28, weight: "bold", color: "#ffffff", align: "center", baseline: "middle" });
				if (rs.starAlpha > 0) {
					ctx.save(); ctx.globalAlpha = rs.alpha * rs.starAlpha;
					drawText("★".repeat(rs.stars || 5), W / 2, 298, { size: 54, weight: "bold", color: "#ffff00", align: "center", baseline: "middle" });
					ctx.restore();
				}
				if (rs.title1Alpha > 0) {
					ctx.save(); ctx.globalAlpha = rs.alpha * rs.title1Alpha;
					drawText(rs.title1, W / 2, rs.title1Y, { size: fitFontSize(rs.title1, W - 40, 32, "bold"), weight: "bold", color: "#ffffff", align: "center", baseline: "middle" });
					ctx.restore();
				}
				if (rs.title2Alpha > 0) {
					ctx.save(); ctx.globalAlpha = rs.alpha * rs.title2Alpha;
					const size = fitFontSize(rs.title2, W - 40, 38, "bold");
					drawText(rs.title2, W / 2, rs.title2Y, { size, weight: "bold", color: "#ffffff", align: "center", baseline: "middle" });
					ctx.restore();
				}
				drawText(t("scoreRFmt")(Math.floor(rs.currentScore)), 50, 375, { size: 18, color: "#ffffff", baseline: "middle" });
				if (rs.nextAlpha > 0) {
					ctx.save(); ctx.globalAlpha = rs.alpha * rs.nextAlpha;
					drawText(rs.nextText, 200, 375, { size: 18, color: "#ffffff", baseline: "middle" });
					ctx.restore();
				}
				drawStarList(rs.particles);

				if (!rs.rolling) {
					drawSideButton({ x: W / 2, y: H - 115, scale: 1, label: t("retryBtn"), color: "#dddddd", fontSize: 32 });
					drawLangButton();
				}
				ctx.restore();
			}
			if (darkOverlay2.alpha > 0) { ctx.save(); ctx.globalAlpha = darkOverlay2.alpha; ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
		},
		onDown(x, y) {
			if (resultState && !resultState.rolling) {
				if (hitTestBtn(BTN_LANG, x, y)) { setLang(lang === "ja" ? "en" : "ja"); return; }
				if (hitRect(W / 2, H - 115, 60, 35, x, y)) {
					tween(darkOverlay2, { alpha: 1 }, 500, { onComplete: () => { switchScene("main"); } });
					return;
				}
				return;
			}
			if (gameover || resultState) return;
			if (hitSideButton(leftButton, x, y)) { handleDirection("left"); return; }
			if (hitSideButton(rightButton, x, y)) { handleDirection("right"); return; }
			if (hitCenterButton(centerButton, x, y)) { onCenterClick(); return; }
		},
		onLangChange() {
			// リザルト画面の称号(title1/title2)とNEXT表示は表示確定時にi18n文字列をキャッシュしているため、
			// 言語切替時は明示的に再計算しないと反映されない。
			if (resultState && resultState.revealed) {
				const info = getResultTitles(resultState.redCorrect, resultState.yellowCorrect, resultState.finalScore);
				resultState.title1 = info.title1;
				resultState.stars = info.stars;
				resultState.title2 = info.title2;
				resultState.nextText = info.nextScore === null ? t("perfectClear") : t("nextFmt")(info.nextScore);
			}
		},
	};
}

/* ==================== シーン管理 ==================== */
let sceneState = null;
let demoPaused = false;
function switchScene(name) {
	activeTweens.length = 0;
	demoPaused = false;
	sceneState = name === "title" ? createTitleScene() : createMainScene();
}

/* ==================== メインループ ==================== */
let lastTime = performance.now();
function frame(now) {
	const dt = Math.min(now - lastTime, 100);
	lastTime = now;
	updateTweens(dt, !demoPaused);
	if (sceneState && sceneState.update) sceneState.update(dt);
	ctx.clearRect(0, 0, W, H);
	if (sceneState && sceneState.draw) sceneState.draw();
	requestAnimationFrame(frame);
}

/* ==================== ポインター操作 ==================== */
function canvasPos(clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) };
}
canvas.addEventListener("pointerdown", (e) => {
	const p = canvasPos(e.clientX, e.clientY);
	if (sceneState && sceneState.onDown) sceneState.onDown(p.x, p.y);
	e.preventDefault();
});

/* ==================== 起動 ==================== */
document.title = t("pageTitle");
switchScene("title");
requestAnimationFrame(frame);
