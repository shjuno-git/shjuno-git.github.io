"use strict";

/* ==================== 基本設定 ==================== */
const W = 360, H = 500;
const COLS = 6, ROWS = 6;
const TYPES = ["gu", "ch", "pa"];
const RULE_BOX_H = 70;
const CELL = Math.min((W - 12 * 2) / COLS, (H - 86 - RULE_BOX_H) / ROWS);
const OFFSET_X = Math.floor((W - CELL * COLS) / 2);
const OFFSET_Y = 86;

const COLORS = { gu: "#ff6b6b", ch: "#5be6a0", pa: "#5bb8ff", enemy: "#161018", h: "#fff6e0", v: "#fff6e0", cross: "#fff6e0", bomb: "#fff6e0" };
const HIGHLIGHT_BY_TYPE = { gu: "#ff8a8a", ch: "#7af0b8", pa: "#7ac8ff" };
const HIGHLIGHT_CYCLE = ["#ffd166", "#ff9f6b", "#ff6b9d", "#c77dff", "#5be6a0"];
const PIECE_ICONS = { gu: "✊", ch: "✌", pa: "✋", enemy: "☠️", h: "★", v: "★", cross: "★", bomb: "💣" };
function isSpecialType(tp) { return tp === "h" || tp === "v" || tp === "cross" || tp === "bomb"; }
const BG_TOP = "#241a4a", BG_BOTTOM = "#402060";
const HAZARD_COLORS = {
	0: { stripeA: "#ffd23f", stripeB: "#161018", core: "#161018" },
	1: { stripeA: "#ff9d2e", stripeB: "#161018", core: "#2a1410" },
	2: { stripeA: "#ff2b2b", stripeB: "#161018", core: "#3a0a0a" },
};
const FONT_STACK = "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif";

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function hexToRgb(hex) { const h = hex.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function lerpColor(a, b, t) {
	const c1 = hexToRgb(a), c2 = hexToRgb(b);
	return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
}
function easeLinear(t) { return t; }
function easePower2Out(t) { return 1 - (1 - t) * (1 - t); }
function easePower2In(t) { return t * t; }
function easeBackOut(t) { const c1 = 1.7, c3 = c1 + 1; const p = t - 1; return 1 + c3 * p * p * p + c1 * p * p; }
function easeBounceOut(t) {
	const n1 = 7.5625, d1 = 2.75;
	if (t < 1 / d1) return n1 * t * t;
	if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
	if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
	return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

function weaknessOf(tp) { return tp === "gu" ? "ch" : tp === "ch" ? "pa" : "gu"; }
function posToPixel(x, y) { return { x: OFFSET_X + x * CELL + CELL / 2, y: OFFSET_Y + y * CELL + CELL / 2 }; }

/* ==================== Canvas 基本ヘルパー ==================== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function drawText(text, x, y, opts) {
	opts = opts || {};
	const size = opts.size || 16;
	const weight = opts.weight || "";
	const align = opts.align || "left";
	const baseline = opts.baseline || "alphabetic";
	const lineHeight = opts.lineHeight || size * 1.3;
	ctx.save();
	ctx.font = (weight + " " + size + "px " + FONT_STACK).trim();
	ctx.textAlign = align;
	ctx.textBaseline = baseline;
	ctx.globalAlpha = (opts.inherit ? ctx.globalAlpha : 1) * (opts.alpha != null ? opts.alpha : 1);
	String(text).split("\n").forEach((line, i) => {
		const ly = y + i * lineHeight;
		if (opts.strokeWidth && opts.stroke) {
			ctx.lineWidth = opts.strokeWidth;
			ctx.strokeStyle = opts.stroke;
			ctx.lineJoin = "round";
			ctx.strokeText(line, x, ly);
		}
		ctx.fillStyle = opts.color || "#fff";
		ctx.fillText(line, x, ly);
	});
	ctx.restore();
}
function wrapText(text, maxWidth, size, weight) {
	ctx.save();
	ctx.font = `${weight || ""} ${size}px ${FONT_STACK}`.trim();
	const outLines = [];
	text.split("\n").forEach((paragraph) => {
		if (paragraph === "") { outLines.push(""); return; }
		if (/\s/.test(paragraph)) {
			const words = paragraph.split(" ");
			let cur = "";
			words.forEach((wd) => {
				const test = cur ? cur + " " + wd : wd;
				if (cur && ctx.measureText(test).width > maxWidth) { outLines.push(cur); cur = wd; }
				else cur = test;
			});
			if (cur) outLines.push(cur);
		} else {
			let cur = "";
			for (const ch of paragraph) {
				const test = cur + ch;
				if (cur && ctx.measureText(test).width > maxWidth) { outLines.push(cur); cur = ch; }
				else cur = test;
			}
			if (cur) outLines.push(cur);
		}
	});
	ctx.restore();
	return outLines.join("\n");
}
function drawWrappedCentered(text, cx, cy, maxWidth, opts) {
	opts = opts || {};
	const size = opts.size || 16;
	const wrapped = wrapText(text, maxWidth, size, opts.weight);
	const lines = wrapped.split("\n");
	const lineHeight = opts.lineHeight || size * 1.25;
	const totalH = (lines.length - 1) * lineHeight;
	const startY = cy - totalH / 2;
	drawText(wrapped, cx, startY, Object.assign({}, opts, { align: "center", baseline: "middle", lineHeight }));
	return lines.length;
}
function fitFontSize(text, maxWidth, initialSize, weight) {
	let size = initialSize;
	ctx.save();
	while (size > 12) {
		ctx.font = `${weight || ""} ${size}px ${FONT_STACK}`.trim();
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
function fillRoundRect(x, y, w, h, r, fill, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha != null ? alpha : 1;
	roundRectPath(x, y, w, h, r);
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.restore();
}

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う。 */
const BTN_LANG = { x: W - 58, y: 6, w: 52, h: 22 };
const BTN_RETRY = { x: W / 2 - 90, y: 446, w: 180, h: 44 };

function hitTestBtn(rect, x, y) { return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h; }
function drawButton(rect, label, opts) {
	opts = opts || {};
	fillRoundRect(rect.x, rect.y, rect.w, rect.h, opts.radius != null ? opts.radius : 8, opts.bg || "rgba(255,255,255,0.18)", opts.alpha);
	ctx.save();
	ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
	roundRectPath(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, (opts.radius != null ? opts.radius : 8) - 1);
	ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
	ctx.stroke();
	ctx.restore();
	if (label) {
		drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
			size: opts.size || 16, weight: "bold", align: "center", baseline: "middle",
			color: opts.color || "#fff", alpha: opts.alpha,
		});
	}
}
// ---- 起動時のタイトル画面と、サウンド設定（「音ありではじめる／音なしではじめる」）----
const SOUND_KEY = "gcp_sound_v1";
const BTN_SOUND = { x: W - 88, y: 6, w: 26, h: 22 };
const STOCK_SLOT = { x: 276, y: H - RULE_BOX_H + 5, w: 48, h: 48 };            // ルール欄の右：ストック枠
const STOCK_HIT = { x: STOCK_SLOT.x - 8, y: STOCK_SLOT.y - 8, w: STOCK_SLOT.w + 16, h: STOCK_SLOT.h + 16 };
const TITLE_BTN_ON = { x: 50, y: 392, w: 260, h: 44 };
const TITLE_BTN_OFF = { x: 50, y: 444, w: 260, h: 38 };
let titleScreen = true;   // 起動時はタイトル画面（ここで音の有無を選んで開始）
let titleAge = 0;         // タイトル表示の経過時間(ms)
let titleLeave = null;    // 開始時のフェードアウト {age}
let lastSoundPref = true; // 前回の選択（ボタンの強調に使う）
(function initSoundSetting() {
	try { if (localStorage.getItem(SOUND_KEY) === "0") lastSoundPref = false; } catch (e) { /* 読めなくても動作に影響なし */ }
	Sound.setEnabled(false); // 開始ボタンを押すまでは鳴らさない
})();
function setSoundOn(on) {
	Sound.setEnabled(on);
	try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch (e) { /* 無視 */ }
	if (on) { Sound.unlock(); Sound.play("ui"); }
}
function startGameFromTitle(withSound) {
	if (titleLeave) return;
	setSoundOn(withSound);
	titleLeave = { age: 0 };
}
function drawSpeakerIcon(cx, cy, on, size) {
	ctx.save();
	ctx.translate(cx, cy); const k = size / 22; ctx.scale(k, k);
	ctx.fillStyle = "#fff"; ctx.beginPath();
	ctx.moveTo(-9, -3.5); ctx.lineTo(-5, -3.5); ctx.lineTo(0, -8); ctx.lineTo(0, 8); ctx.lineTo(-5, 3.5); ctx.lineTo(-9, 3.5); ctx.closePath(); ctx.fill();
	ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
	if (on) { ctx.beginPath(); ctx.arc(1, 0, 5, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(1, 0, 9, -0.9, 0.9); ctx.stroke(); }
	else { ctx.strokeStyle = "#ff6b6b"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(11, 5); ctx.moveTo(11, -5); ctx.lineTo(4, 5); ctx.stroke(); }
	ctx.restore();
}
function drawSoundButton() {
	if (titleScreen) return;
	const r = BTN_SOUND, on = Sound.enabled;
	fillRoundRect(r.x, r.y, r.w, r.h, 8, on ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)");
	ctx.save();
	roundRectPath(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7);
	ctx.strokeStyle = on ? "rgba(255,255,255,0.35)" : "rgba(255,120,120,0.5)"; ctx.lineWidth = 1; ctx.stroke();
	ctx.restore();
	drawSpeakerIcon(r.x + r.w / 2, r.y + r.h / 2, on, 18);
}
// 説明の背景パネル：濃い紫＋金の細い枠で、文字と絵文字をくっきり見せる
function titlePanel(x, y, w, h) {
	fillRoundRect(x, y, w, h, 14, "rgba(46,26,92,0.96)");
	ctx.save();
	roundRectPath(x, y, w, h, 14); ctx.strokeStyle = "rgba(255,214,90,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
	ctx.restore();
}
function titleBurst(x, y, k) {
	if (k <= 0 || k >= 1) return;
	for (let i = 0; i < 8; i++) {
		const a = Math.PI * 2 * i / 8, r = 6 + 22 * easeOutQuad(k);
		ctx.save(); ctx.globalAlpha *= 1 - k; ctx.fillStyle = ["#ffd166", "#fff6c8", "#ff9f6b"][i % 3];
		drawStarShape(x + Math.cos(a) * r, y + Math.sin(a) * r, 4, 1.8, 4, k * 4); ctx.fill(); ctx.restore();
	}
}
function titleArrow(ax, ay, bx, by) {
	const ang = Math.atan2(by - ay, bx - ax);
	ctx.save();
	ctx.strokeStyle = "#fff6c8"; ctx.fillStyle = "#fff6c8"; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 8;
	ctx.beginPath(); ctx.moveTo(ax + Math.cos(ang) * 24, ay + Math.sin(ang) * 24); ctx.lineTo(bx - Math.cos(ang) * 30, by - Math.sin(ang) * 30); ctx.stroke();
	drawTriangleArrow(bx - Math.cos(ang) * 27, by - Math.sin(ang) * 27, 7, ang);
	ctx.restore();
}
// 実演：✊をタップ → ✊が消える → ✌が消える（✊が復活）→ ✋が消える（✌が復活）→ ✋も復活してループ
function drawTitleDemo(age, cx, cy) {
	const T = age % 4400, s = 46, xs = [cx - 80, cx, cx + 80];
	const plan = [
		{ kind: "gu", out: 450, back: 1100, dur: 900 },  // out=消える時刻, back=復活を始める時刻, dur=復活にかける時間
		{ kind: "ch", out: 1050, back: 1800, dur: 900 },
		{ kind: "pa", out: 1750, back: 2500, dur: 900 },
	];
	plan.forEach((p, i) => {
		const x = xs[i];
		if (T < p.out) drawResultTile(p.kind, x, cy, s);
		else if (T < p.out + 150) drawResultTile(p.kind, x, cy, s * lerp(1, 0.2, (T - p.out) / 150)); // 縮んで消える
		else if (T >= p.back) {
			const k = clamp((T - p.back) / p.dur, 0, 1);
			ctx.save(); ctx.globalAlpha *= easeOutQuad(k);
			drawResultTile(p.kind, x, cy, s * lerp(0.55, 1, easeOutQuad(k))); // ゆっくり復活
			ctx.restore();
		}
		titleBurst(x, cy, (T - p.out) / 380);
	});
	if (T > 600 && T < 1050) titleArrow(xs[0], cy, xs[1], cy);
	if (T > 1250 && T < 1750) titleArrow(xs[1], cy, xs[2], cy);
	if (T < 650) {
		const tapK = clamp((T - 150) / 300, 0, 1);
		drawEmoji("👆", xs[0] + 6, cy + 34 + Math.abs(Math.sin(T / 130)) * 6 * (1 - tapK), 26);
		if (T > 300) {
			ctx.save(); ctx.globalAlpha *= clamp(1 - (T - 300) / 350, 0, 1); ctx.strokeStyle = "#ffe680"; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(xs[0], cy, 24 + (T - 300) / 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
		}
	}
}
function drawTitleStartButton(rect, label, on, c1, c2, pulse) {
	if (pulse > 0) {
		ctx.save();
		ctx.globalAlpha *= 0.35 + 0.35 * pulse; ctx.strokeStyle = "#fff6c8"; ctx.lineWidth = 3; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 12;
		roundRectPath(rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, (rect.h + 6) / 2); ctx.stroke();
		ctx.restore();
	}
	drawClearButton(rect, label, c1, c2, ctx.globalAlpha);
	drawSpeakerIcon(rect.x + 34, rect.y + rect.h / 2, on, 22);
}
function drawTitleScreen(nowMs) {
	if (!titleScreen) return;
	const age = titleAge;
	const fade = titleLeave ? clamp(1 - titleLeave.age / 450, 0, 1) : 1;
	ctx.save();
	ctx.globalAlpha = fade;
	// 背景の盤面が透けて文字が読みにくくならないよう、ほぼ不透明にする
	ctx.fillStyle = "rgba(21,10,46,0.97)"; ctx.fillRect(0, 0, W, H);
	drawClearTitle(age, W / 2, 76, 34, t("pageTitle"));
	drawText(t("titleTagline"), W / 2, 112, { size: 13, align: "center", baseline: "middle", color: "#ffe9a8", stroke: "rgba(20,8,40,0.8)", strokeWidth: 3, inherit: true });
	// 1つ目：実演つきの説明
	const k0 = clamp((age - 500) / 350, 0, 1);
	if (k0 > 0) {
		ctx.save();
		ctx.globalAlpha *= k0;
		titlePanel(24, 134, W - 48, 124);
		drawTitleDemo(age, W / 2, 172);
		drawText(t("titleRule1a"), W / 2, 215, { size: 14, weight: "bold", align: "center", baseline: "middle", color: "#fff", stroke: "rgba(20,8,40,0.9)", strokeWidth: 3, inherit: true });
		drawText(t("titleRule1b"), W / 2, 233, { size: 14, weight: "bold", align: "center", baseline: "middle", color: "#fff", stroke: "rgba(20,8,40,0.9)", strokeWidth: 3, inherit: true });
		drawText(t("titleRule1sub"), W / 2, 247, { size: fitSmallText(t("titleRule1sub"), W - 60, 11, "bold"), weight: "bold", align: "center", baseline: "middle", color: "#ffe9a8", stroke: "rgba(20,8,40,0.9)", strokeWidth: 3, inherit: true });
		ctx.restore();
	}
	// 2つ目・3つ目：☠と特殊マス
	[[292, 0], [358, 1]].forEach(([y, i]) => {
		const k = clamp((age - 800 - i * 220) / 350, 0, 1);
		if (k <= 0) return;
		ctx.save();
		ctx.globalAlpha *= k;
		titlePanel(24, y - 30, W - 48, 60);
		if (i === 0) drawRuleBan(84, y); else { drawResultTile("bomb", 84 - 20, y, 30); drawResultTile("star", 84 + 20, y, 30); }
		// 2枚の説明は左揃えで、文の開始位置をそろえる（複数行は上下中央に）
		const lines = t(i === 0 ? "titleRule2" : "titleRule3").split("\n");
		const size = Math.min(...lines.map((ln) => fitSmallText(ln, 194, 13, "bold")));
		lines.forEach((ln, j) => drawText(ln, 132, y + (j - (lines.length - 1) / 2) * 19, { size, weight: "bold", align: "left", baseline: "middle", color: "#fff", stroke: "rgba(20,8,40,0.9)", strokeWidth: 3, inherit: true }));
		ctx.restore();
	});
	// 開始ボタン（前回の選択を光らせる）
	const pulse = 0.5 + 0.5 * Math.sin(age / 300);
	drawTitleStartButton(TITLE_BTN_ON, t("startOn"), true, "#7be07f", "#2f9e44", lastSoundPref ? pulse : 0);
	drawTitleStartButton(TITLE_BTN_OFF, t("startOff"), false, "rgba(255,255,255,0.3)", "rgba(255,255,255,0.18)", lastSoundPref ? 0 : pulse);
	drawLangButton();
	ctx.restore();
}
function drawLangButton() {
	drawButton(BTN_LANG, t("langBtn"), { bg: "rgba(255,255,255,0.18)", size: 11, color: "#fff" });
}
function clearPopupButtonRects() {
	return {
		continueBtn: { x: W / 2 - 122, y: 434, w: 112, h: 42 },
		restartBtn: { x: W / 2 + 10, y: 434, w: 112, h: 42 },
	};
}

/* ==================== 盤面・ゲーム状態 ==================== */
const grid = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
let explodingPieces = [];
let highlights = [];
let effects = [];
let stars = [];

const initialCountersPool = [1, 2, 4, 5, 7, 8];
const enemyCounters = Array.from({ length: COLS }, () => 0);
(function assignInitialCounters() {
	const pool = initialCountersPool.slice();
	for (let x = 0; x < COLS; x++) {
		const idx = Math.floor(Math.random() * pool.length);
		enemyCounters[x] = pool.splice(idx, 1)[0];
	}
})();
const enemyPending = Array.from({ length: COLS }, () => false);
let pendingSpecial = null; // {col, type}

let totalRemoved = 0;
// ---- 自己ベスト（localStorage。使えない環境ではそのページ表示中だけ記憶）----
const BEST_KEY = "gcp_best_v1";
const best = { score: 0, total: 0, combo: 0 };
(function loadBest() {
	try {
		const o = JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
		best.score = o.score | 0; best.total = o.total | 0; best.combo = o.combo | 0;
	} catch (e) { /* 読めなくても動作に影響なし */ }
})();
function saveBest() { try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) { /* 無視 */ } }
// 今回の結果を記録に反映し、更新したかどうか（以前の記録が0より大きい場合のみ「NEW」扱い）を返す
function commitRecords(score, total, combo) {
	const prev = { score: best.score, total: best.total, combo: best.combo };
	const flags = { score: prev.score > 0 && score > prev.score, total: prev.total > 0 && total > prev.total, combo: prev.combo > 0 && combo > prev.combo };
	best.score = Math.max(best.score, score); best.total = Math.max(best.total, total); best.combo = Math.max(best.combo, combo);
	saveBest();
	return { flags, prev, best: { score: best.score, total: best.total, combo: best.combo } };
}
let comboRecordShown = 0; // この回で「自己ベスト更新」を出した最大の連鎖数
let stock = null;       // ストック枠の特殊マス（bomb/h/v/cross）。1つだけ取っておける
let stockAim = false;   // ストックを使う場所を選んでいる間
let guideStockActive = false; // ストックの使い方ガイドを表示中
let bgGlow = { value: 0, target: 0, color: "#ffd166", level: 0 }; // 連鎖が長いほど背景が明るく変化
let pinchActive = false; // ピンチ演出（音と文字）を出した後は、解消するまで繰り返さない
let dangerLevel = 0; // ドクロが2つ並んでいる間 1 に近づく（ピンチ演出の強さ）
let bonusScore = 0;   // 連鎖ボーナスの累計（100到達の判定には含めない）
let scoreShown = 0;   // HUD表示用（カウントアップ）
let maxCombo = 0;
let enemiesRemoved = 0;
let nextClearTarget = 100;
let achieveDisplayValue = null; // null: 開始メッセージ, 数値: t("achieveCurrentFmt")(n)

let busy = false;
let gameOver = false;
let lastTappedColumn = 0;
let tapChain = null;
let activeSpecial = null;
let collapsePhase = null;
let pendingPostCombo = null;
let clearPopup = null;
let resultState = null;
let shake = null;       // {amp, age, dur} 連鎖時の画面揺れ
let screenFlash = null; // {color, alpha, age, dur} 連鎖時の画面フラッシュ
let hoverCell = null;   // マウスホバー中のマス（連鎖プレビュー用）
let press = null;       // タッチ中 {id, cell, t0}。長押しでプレビュー、離したら発動
const PREVIEW_HOLD_MS = 180;

/* ==================== ピース ==================== */
function makePiece(type) {
	return {
		type, gridX: 0, gridY: 0, x: 0, y: 0,
		scale: 1, alpha: 1,
		warnLevel: 0, warnPhase: Math.random() * Math.PI * 2,
		shimmerPhase: Math.random() * Math.PI * 2,
		exploding: false, explodeAge: 0, explodeDur: 280,
		dropAnim: null,
	};
}
function placePiece(piece, x, y) {
	piece.gridX = x; piece.gridY = y;
	const p = posToPixel(x, y);
	piece.x = p.x; piece.y = p.y;
	grid[x][y] = piece;
}

function initGrid() {
	for (let x = 0; x < COLS; x++) {
		grid[x] = [];
		enemyPending[x] = false;
		for (let y = 0; y < ROWS; y++) {
			const tp = TYPES[Math.floor(Math.random() * TYPES.length)];
			const piece = makePiece(tp);
			placePiece(piece, x, y);
		}
	}
	comboRecordShown = 0; stock = null; stockAim = false; bgGlow.value = 0; bgGlow.target = 0; bgGlow.level = 0;
	totalRemoved = 0; bonusScore = 0; scoreShown = 0; maxCombo = 0; enemiesRemoved = 0; nextClearTarget = 100;
	achieveDisplayValue = null;
}
function currentScore() { return totalRemoved + bonusScore; }
function updateStats() {
	achieveDisplayValue = totalRemoved;
}

/* ==================== 連鎖判定 ==================== */
function computeChainLevels(sx, sy, type) {
	const snap = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
	for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) snap[x][y] = grid[x]?.[y]?.type || null;

	const visited = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
	const levels = [[{ x: sx, y: sy, type }]];
	visited[sx][sy] = true;

	let idx = 0;
	while (true) {
		const cur = levels[idx];
		const next = [];
		for (const node of cur) {
			const weak = weaknessOf(node.type);
			const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
			for (const d of dirs) {
				const nx = node.x + d[0], ny = node.y + d[1];
				if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
				if (visited[nx][ny]) continue;
				if (snap[nx][ny] === weak) { visited[nx][ny] = true; next.push({ x: nx, y: ny, type: snap[nx][ny], from: { x: node.x, y: node.y } }); }
			}
		}
		if (next.length === 0) break;
		levels.push(next);
		idx++;
	}
	return levels;
}

/* ==================== ハイライト ==================== */
function addHighlight(nodes, color) {
	const rects = nodes.map((n) => ({ x: n.x, y: n.y }));
	const hl = { rects, color, alpha: 0.45 };
	highlights.push(hl);
	return hl;
}
// 矢印：from のマスが to のマスを消す、という関係を示す
function drawLinkArrow(fx, fy, tx, ty, color, alpha, thick) {
	const dx = tx - fx, dy = ty - fy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
	const sx = fx + ux * CELL * 0.3, sy = fy + uy * CELL * 0.3, ex = tx - ux * CELL * 0.34, ey = ty - uy * CELL * 0.34;
	ctx.save();
	ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = thick; ctx.lineCap = "round";
	ctx.shadowColor = color; ctx.shadowBlur = 8;
	ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex - ux * 4, ey - uy * 4); ctx.stroke();
	drawTriangleArrow(ex, ey, thick * 2.3, Math.atan2(dy, dx));
	ctx.restore();
}
function removeHighlight(hl) {
	const i = highlights.indexOf(hl);
	if (i !== -1) highlights.splice(i, 1);
}

/* ==================== 消去アニメ ==================== */
function startExplode(piece, fast, delay) {
	piece.exploding = true;
	piece.explodeAge = -(delay || 0); // 負の間は消える前の見た目のまま待つ（波のように順に消すため）
	piece.explodeDur = fast ? 190 : 240;
	explodingPieces.push(piece);
}
function updatePieceExplodeVisual(p) {
	if (p.explodeAge < 0) return;
	const t2 = clamp(p.explodeAge / p.explodeDur, 0, 1);
	const e = easePower2In(t2);
	p.scale = lerp(1.35, 0.1, e);
	p.alpha = 1 - e;
}
function particleBurst(x, y, color, n, delay) {
	for (let i = 0; i < (n || 10); i++) {
		effects.push({ kind: "particle", x, y, dx: (Math.random() - 0.5) * 80, dy: (Math.random() - 0.5) * 80, color, age: 0, life: 600, delay: delay || 0 });
	}
}
function spawnFlash(x, y, color, delay) {
	effects.push({ kind: "flash", x, y, color, age: 0, life: 260, delay: delay || 0 });
}

/* ==================== 実績・演出テキスト ==================== */
function addComboTextEffect(level) {
	const color = HIGHLIGHT_CYCLE[(level - 1) % HIGHLIGHT_CYCLE.length];
	effects = effects.filter((e) => e.kind !== "combo");
	effects.push({ kind: "combo", level, color, x: W / 2, y: H * 0.38, age: 0, life: 1200 });
}
// 連鎖段数に応じた画面演出（揺れ・フラッシュ）。段数が上がるほど強くなる
function triggerLevelFx(level, color) {
	// 背景：連鎖が進むほど明るく、6連鎖以上でゆっくり色相が回る。光の粒も増える
	bgGlow.target = clamp(level / 10, 0, 1); bgGlow.color = color; bgGlow.level = level;
	const nSpark = Math.min(3 + level * 2, 26);
	for (let i = 0; i < nSpark; i++) effects.push({ kind: "bgspark", x: Math.random() * W, y0: H * (0.55 + 0.45 * Math.random()), vy: 0.04 + Math.random() * 0.06, size: 1.6 + Math.random() * 3, color, age: 0, life: 1200 + Math.random() * 900 });
	if (level >= 2) screenFlash = { color, alpha: Math.min(0.06 + level * 0.025, 0.3), age: 0, dur: 320 };
	if (level >= 3) shake = { amp: Math.min(1.2 + level * 0.7, 7), age: 0, dur: 240 };
}
function showTotalCombo(n) {
	if (n < 4) return; // 「特殊コマゲット！」の文字は finishTapChain で連鎖中に先に出している
	for (let i = 0; i < 6; i++) {
		setTimeout(() => particleBurst(W / 2, H / 2, HIGHLIGHT_CYCLE[i % HIGHLIGHT_CYCLE.length]), i * 90);
	}
}

/* ==================== 敵の警告判定 ==================== */
function updateEnemyWarnings() {
	const allEnemies = [];
	for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
		const e = grid[x][y];
		if (e && e.type === "enemy") allEnemies.push(e);
	}
	const dangerMap = new Map();
	for (let y = 0; y < ROWS; y++) {
		let streak = [];
		for (let x = 0; x <= COLS; x++) {
			const cell = grid[x]?.[y];
			if (cell && cell.type === "enemy") streak.push(cell);
			else { if (streak.length >= 2) { const level = streak.length >= 3 ? 2 : 1; for (const e of streak) dangerMap.set(e, Math.max(dangerMap.get(e) || 0, level)); } streak = []; }
		}
	}
	for (let x = 0; x < COLS; x++) {
		let streak = [];
		for (let y = 0; y <= ROWS; y++) {
			const cell = grid[x]?.[y];
			if (cell && cell.type === "enemy") streak.push(cell);
			else { if (streak.length >= 2) { const level = streak.length >= 3 ? 2 : 1; for (const e of streak) dangerMap.set(e, Math.max(dangerMap.get(e) || 0, level)); } streak = []; }
		}
	}
	for (const e of allEnemies) {
		e.warnLevel = dangerMap.get(e) || 0;
	}
}

/* ==================== ゲームオーバー判定 ==================== */
// 敵が3つ以上並んでいる全マス（ゲームオーバー演出で強調する）
// 3つ以上並んだドクロを探す。cells=該当マス（重複なし）、runs=並びごとのマス（線を組ごとに引くため）
function findEnemyRuns() {
	const cells = new Map();
	const runs = [];
	const isE = (x, y) => grid[x][y] && grid[x][y].type === "enemy";
	const addRun = (run) => { if (run.length < 3) return; runs.push(run); run.forEach((c) => cells.set(c.x + "," + c.y, c)); };
	for (let y = 0; y < ROWS; y++) {
		let run = [];
		for (let x = 0; x <= COLS; x++) {
			if (x < COLS && isE(x, y)) run.push({ x, y });
			else { addRun(run); run = []; }
		}
	}
	for (let x = 0; x < COLS; x++) {
		let run = [];
		for (let y = 0; y <= ROWS; y++) {
			if (y < ROWS && isE(x, y)) run.push({ x, y });
			else { addRun(run); run = []; }
		}
	}
	return { cells: [...cells.values()], runs };
}
function checkGameOver() {
	const { cells, runs } = findEnemyRuns();
	if (cells.length === 0) return false;
	triggerGameOver(cells, runs);
	return true;
}
const OVER_DELAY_MS = 1700; // ドクロ3つ並びの演出を見せてからリザルトへ
function triggerGameOver(overCells, overRuns) {
	if (gameOver) return;
	gameOver = true;
	const score = totalRemoved;
	const isKing = score >= 100;
	const msgIdx = Math.min(Math.floor(score / 10), t("resultMessages").length - 1);
	const nextTarget = Math.floor(score / 10) * 10 + 10;
	resultState = {
		age: -OVER_DELAY_MS,
		enemiesSnap: enemiesRemoved, comboSnap: maxCombo, totalSnap: totalRemoved, scoreSnap: currentScore(),
		isKing, msgIdx, nextTarget, overCells: overCells || [], overRuns: overRuns || [],
		rec: commitRecords(currentScore(), totalRemoved, maxCombo),
	};
	shake = { amp: 8, age: 0, dur: 500 };
	screenFlash = { color: "#ff4040", alpha: 0.35, age: 0, dur: 450 };
	Sound.play("alert");
}
// ゲームオーバー演出：並んだドクロを強調し、何が原因かを示す
function drawOverAlert(nowMs) {
	const cells = resultState.overCells;
	if (!cells || !cells.length) return;
	const age = resultState.age + OVER_DELAY_MS; // 0 から始まる経過時間
	const pulse = 0.5 + 0.5 * Math.sin(age / 90);
	const fadeIn = clamp(age / 250, 0, 1);
	// 赤い縁
	const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
	g.addColorStop(0, "rgba(255,30,30,0)"); g.addColorStop(1, `rgba(255,30,30,${(0.28 + 0.12 * pulse) * fadeIn})`);
	ctx.save(); ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20); ctx.restore();
	// 並んだドクロを太い赤枠で囲み、線でつなぐ
	const pts = cells.map((c) => posToPixel(c.x, c.y));
	ctx.save();
	ctx.globalAlpha = fadeIn;
	ctx.strokeStyle = "#ff3b3b"; ctx.lineWidth = 5; ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 16;
	ctx.lineCap = "round";
	// 線は並びごとに1本ずつ（別々の組を1本でつながない）
	ctx.globalAlpha = fadeIn * 0.9;
	(resultState.overRuns || []).forEach((run) => {
		const a = posToPixel(run[0].x, run[0].y), b = posToPixel(run[run.length - 1].x, run[run.length - 1].y);
		ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
	});
	pts.forEach((q) => {
		ctx.globalAlpha = fadeIn * (0.65 + 0.35 * pulse);
		const sz = CELL * (0.98 + 0.06 * pulse);
		roundRectPath(q.x - sz / 2, q.y - sz / 2, sz, sz, sz * 0.22); ctx.stroke();
	});
	ctx.restore();
	// 見出し
	// 見出しはドクロに重ならない高さへ（組が上下に分かれていても被らないように候補から選ぶ）
	const midY = pts.reduce((a, q) => a + q.y, 0) / pts.length;
	const cands = midY > H * 0.5 ? [H * 0.3, H * 0.7] : [H * 0.7, H * 0.3];
	for (let y = OFFSET_Y + CELL * 0.5; y < OFFSET_Y + CELL * ROWS; y += CELL * 0.5) cands.push(y);
	const clear = (y) => pts.every((q) => Math.abs(q.y - y) >= CELL / 2 + 16);
	const ty = cands.find(clear) ?? cands[0];
	const pop = easeBackOut(clamp(age / 350, 0, 1));
	ctx.save();
	ctx.translate(W / 2, ty); ctx.scale(pop, pop);
	ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 16;
	drawText(t("overAlert"), 0, 0, { size: 26, weight: "bold", align: "center", baseline: "middle", color: "#ffffff", stroke: "#a30000", strokeWidth: 7 });
	ctx.restore();
}
function resultLines() {
	if (resultState.isKing) return [t("kingMsg"), t("kingSubMsg")];
	return [t("resultMessages")[resultState.msgIdx], t("nextTargetFmt")(resultState.nextTarget)];
}

/* ==================== クリアポップアップ ==================== */
function checkClear() {
	while (totalRemoved >= nextClearTarget) {
		const triggeredTarget = nextClearTarget;
		nextClearTarget += 100;
		showClearPopup(triggeredTarget);
	}
}
function showClearPopup(target) {
	if (clearPopup) return;
	clearPopup = {
		target, age: 0, closing: false, closeAge: 0, pendingRestart: false,
		enemiesSnap: enemiesRemoved, comboSnap: maxCombo, totalSnap: totalRemoved, scoreSnap: currentScore(),
		rec: commitRecords(currentScore(), totalRemoved, maxCombo),
	};
}
function spawnClearStar() {
	const startX = W + 30, startY = 20 + Math.random() * 60;
	stars.push({ x: startX, y: startY, startX, startY, endX: -80, endY: H + 100, age: 0, dur: (2 + Math.random() * 1.5) * 1000, twinklePhase: Math.random() * Math.PI * 2 });
}
function updateStars(deltaMs) {
	for (let i = stars.length - 1; i >= 0; i--) {
		const s = stars[i];
		s.age += deltaMs;
		s.twinklePhase += deltaMs * (Math.PI * 2 / 500);
		const t2 = clamp(s.age / s.dur, 0, 1);
		const e = t2 < 0.5 ? 2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 2) / 2; // power2.inOut
		s.x = lerp(s.startX, s.endX, e);
		s.y = lerp(s.startY, s.endY, e);
		if (t2 >= 1) stars.splice(i, 1);
	}
}

/* ==================== 特殊コマ発動 ==================== */
// 特殊マスの効果範囲。bomb2/h3/v3/cross3 は特殊マス同士の合体で生まれる強化版
function specialArea(type, cx, cy) {
	const cells = [], seen = new Set();
	const add = (x, y) => { if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return; const k = x + "," + y; if (!seen.has(k)) { seen.add(k); cells.push({ x, y }); } };
	const row = (w) => { for (let d = -w; d <= w; d++) for (let x = 0; x < COLS; x++) add(x, cy + d); };
	const col = (w) => { for (let d = -w; d <= w; d++) for (let y = 0; y < ROWS; y++) add(cx + d, y); };
	if (type === "h") row(0);
	else if (type === "v") col(0);
	else if (type === "cross") { row(0); col(0); }
	else if (type === "h3") row(1);
	else if (type === "v3") col(1);
	else if (type === "cross3") { row(1); col(1); }
	else if (type === "bomb") { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) add(cx + dx, cy + dy); }
	else if (type === "bomb2") { for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) add(cx + dx, cy + dy); }
	return cells;
}
// 隣り合う特殊マスを探す（合体の相手）
function findMergeNeighbor(cx, cy) {
	for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
		const x = cx + dx, y = cy + dy;
		const q = grid[x]?.[y];
		if (q && isSpecialType(q.type) && !q.exploding) return { x, y, type: q.type, piece: q };
	}
	return null;
}
function mergeTypes(a, b) {
	const t2 = [a, b].sort().join("+");
	const has = (k) => a === k || b === k;
	if (a === "bomb" && b === "bomb") return "bomb2";
	if (has("cross")) return "cross3";
	if (has("bomb")) return has("h") ? "h3" : "v3"; // 💣＋横 / 💣＋縦
	return "cross"; // 横＋縦、横＋横、縦＋縦
}
function collectSpecialRemoval(cx, cy, type) {
	const pieces = [];
	const cascade = [];
	const piece = grid[cx]?.[cy];
	if (piece && isSpecialType(piece.type)) {
		grid[cx][cy] = null;
		pieces.push(piece);
	}
	const toRemove = specialArea(type, cx, cy);

	for (const c of toRemove) {
		const p = grid[c.x]?.[c.y];
		if (!p) continue;
		if (isSpecialType(p.type)) {
			grid[c.x][c.y] = null; pieces.push(p);
			cascade.push({ x: c.x, y: c.y, type: p.type });
		} else if (p.type === "enemy") {
			grid[c.x][c.y] = null; pieces.push(p);
			enemiesRemoved++; updateStats();
		} else {
			grid[c.x][c.y] = null; pieces.push(p);
			totalRemoved++; updateStats();
			const pos = posToPixel(c.x, c.y);
			particleBurst(pos.x, pos.y, COLORS[p.type], 14, specialDelay(type, c.x - cx, c.y - cy));
			spawnFlash(pos.x, pos.y, "#ffd700", specialDelay(type, c.x - cx, c.y - cy));
		}
		p._delay = specialDelay(type, c.x - cx, c.y - cy);
	}
	pieces.forEach((p) => startExplode(p, true, p._delay || 0));
	return { pieces, cascade };
}
// 中心からの距離に応じた消去の遅れ(ms)。波が広がるように見える
function specialDelay(type, dx, dy) {
	const d = Math.abs(dx) + Math.abs(dy);
	if (type === "bomb") return d === 0 ? 0 : 80;
	if (type === "bomb2") return Math.max(Math.abs(dx), Math.abs(dy)) * 80;
	return d * 45;
}
// 発動時の衝撃演出（ビーム・衝撃波・画面の揺れとフラッシュ）
function triggerSpecialFx(cx, cy, type) {
	const o = posToPixel(cx, cy);
	Sound.play(type === "bomb" || type === "bomb2" ? "bomb" : "beam");
	if (type === "bomb2") {
		effects.push({ kind: "shock", x: o.x, y: o.y, maxR: CELL * 3.4, age: 0, life: 640 });
		effects.push({ kind: "shock", x: o.x, y: o.y, maxR: CELL * 2.3, age: 0, life: 480 });
		effects.push({ kind: "shock", x: o.x, y: o.y, maxR: CELL * 1.3, age: 0, life: 340 });
		particleBurst(o.x, o.y, "#ffb000", 30);
	} else if (type === "h3" || type === "v3" || type === "cross3") {
		if (type !== "v3") effects.push({ kind: "beam", orient: "h", wide: true, x: o.x, y: o.y, age: 0, life: 620 });
		if (type !== "h3") effects.push({ kind: "beam", orient: "v", wide: true, x: o.x, y: o.y, age: 0, life: 620 });
		effects.push({ kind: "shock", x: o.x, y: o.y, maxR: CELL * 2.2, age: 0, life: 520 });
		particleBurst(o.x, o.y, "#ffb000", 22);
	} else if (type === "bomb") {
		effects.push({ kind: "shock", x: o.x, y: o.y, maxR: CELL * 2.1, age: 0, life: 520 });
		effects.push({ kind: "shock", x: o.x, y: o.y, maxR: CELL * 1.3, age: 0, life: 360 });
		particleBurst(o.x, o.y, "#ffb000", 18);
	} else {
		if (type === "h" || type === "cross") effects.push({ kind: "beam", orient: "h", x: o.x, y: o.y, age: 0, life: 520 });
		if (type === "v" || type === "cross") effects.push({ kind: "beam", orient: "v", x: o.x, y: o.y, age: 0, life: 520 });
		if (type === "cross") effects.push({ kind: "shock", x: o.x, y: o.y, maxR: CELL * 1.6, age: 0, life: 420 });
	}
	const big = type === "bomb2" || type === "h3" || type === "v3" || type === "cross3";
	shake = { amp: big ? 10 : type === "bomb" ? 6 : type === "cross" ? 7 : 5, age: 0, dur: big ? 420 : 300 };
	screenFlash = { color: "#ffe9a0", alpha: big ? 0.38 : 0.24, age: 0, dur: big ? 420 : 300 };
}
const SPECIAL_WINDUP_MS = 280; // 発動前の溜め
function startSpecialActivation(cx, cy, type, fromStock) {
	if (busy) return;
	busy = true;
	// ストックから使うとき、置いた場所に特殊マスがあればそれと合体。なければ隣の特殊マスと合体
	const here = grid[cx]?.[cy];
	const nb = (fromStock && here && isSpecialType(here.type)) ? { x: cx, y: cy, type: here.type, piece: here } : findMergeNeighbor(cx, cy);
	const useType = nb ? mergeTypes(type, nb.type) : type;
	activeSpecial = { windup: { age: 0, cx, cy, type: useType, merged: nb }, pieces: [], cascade: [] };
	Sound.play(nb ? "merge" : "charge");
	const o = posToPixel(cx, cy);
	effects.push({ kind: "charge", x: o.x, y: o.y, age: 0, life: SPECIAL_WINDUP_MS });
	if (nb) {
		const q = posToPixel(nb.x, nb.y);
		effects.push({ kind: "charge", x: q.x, y: q.y, age: 0, life: SPECIAL_WINDUP_MS });
		effects.push({ kind: "label", text: t("mergeLabel"), x: W / 2, y: H * 0.46, age: 0, life: 1200 });
	}
}
function updateActiveSpecial(deltaMs) {
	if (!activeSpecial) return;
	const w = activeSpecial.windup;
	if (w) {
		w.age += deltaMs;
		const sp = grid[w.cx]?.[w.cy];
		if (sp) sp.scale = 1 + 0.28 * Math.sin(Math.PI * clamp(w.age / SPECIAL_WINDUP_MS, 0, 1));
		if (w.merged && w.merged.piece) w.merged.piece.scale = 1 + 0.28 * Math.sin(Math.PI * clamp(w.age / SPECIAL_WINDUP_MS, 0, 1));
		if (w.age >= SPECIAL_WINDUP_MS) {
			const extra = [];
			if (w.merged && grid[w.merged.x]?.[w.merged.y] === w.merged.piece) {
				grid[w.merged.x][w.merged.y] = null; extra.push(w.merged.piece);
				startExplode(w.merged.piece, true, 0); // 合体の相手は誘爆させず、ここで一緒に消す
			}
			const r = collectSpecialRemoval(w.cx, w.cy, w.type);
			triggerSpecialFx(w.cx, w.cy, w.type);
			activeSpecial = { pieces: r.pieces.concat(extra), cascade: r.cascade };
		}
		return;
	}
	const allDone = activeSpecial.pieces.every((p) => !p.exploding);
	if (!allDone) return;
	if (activeSpecial.cascade.length > 0) {
		const next = activeSpecial.cascade.shift();
		const nextBatch = collectSpecialRemoval(next.x, next.y, next.type);
		triggerSpecialFx(next.x, next.y, next.type);
		activeSpecial = { pieces: nextBatch.pieces, cascade: activeSpecial.cascade.concat(nextBatch.cascade) };
		return;
	}
	activeSpecial = null;
	finishSpecialActivation();
}
function finishSpecialActivation() {
	for (let x = 0; x < COLS; x++) {
		enemyCounters[x] = Math.max(0, enemyCounters[x]);
		enemyCounters[x]--;
		if (enemyCounters[x] <= 0) enemyPending[x] = true;
	}
	pendingPostCombo = null;
	startCollapseAndFill();
}

/* ==================== タップ連鎖 ==================== */
// ストックが空いていれば、連鎖で生まれた特殊マスは盤面に出ずにストック枠へ入る（満杯のときは今までどおり盤面に出る）
function autoStockPendingSpecial() {
	if (!pendingSpecial || stock) return false;
	const type = pendingSpecial.type;
	const a = { x: posToPixel(pendingSpecial.col, 0).x, y: OFFSET_Y - 4 };
	const b = { x: STOCK_SLOT.x + STOCK_SLOT.w / 2, y: STOCK_SLOT.y + STOCK_SLOT.h / 2 };
	stock = type;
	pendingSpecial = null;
	effects.push({ kind: "fly", type, fx: a.x, fy: a.y, tx: b.x, ty: b.y, age: 0, life: 700 });
	particleBurst(b.x, b.y, "#ffd166", 12, 640);
	Sound.play("stock");
	return true;
}
function handleStockSlotTap() {
	if (busy || gameOver || clearPopup || titleScreen) return;
	if (!stock) { effects.push({ kind: "label", text: t("stockHint"), x: W / 2, y: H * 0.5, age: 0, life: 1100 }); return; }
	guideSeen.stock = true; // 使い方の案内は、枠を触ったら終わり
	stockAim = !stockAim;
	Sound.play("ui");
}
// ストックした特殊マスを、選んだ場所で発動（1手として数える）
function useStockAt(cx, cy) {
	if (busy || gameOver || clearPopup || !stock) { stockAim = false; return; }
	const type = stock;
	stock = null; stockAim = false;
	guideSeen.stock = true;
	dismissGuidesOnTap();
	Sound.play("tap");
	startSpecialActivation(cx, cy, type, true);
}
function handlePieceTap(gx, gy) {
	if (busy || gameOver || clearPopup) return;
	const piece = grid[gx]?.[gy];
	if (!piece) return;
	if (piece.type === "enemy") return;
	dismissGuidesOnTap();
	Sound.play("tap");
	if (isSpecialType(piece.type)) { startSpecialActivation(gx, gy, piece.type); return; }
	startTapChain(gx, gy, piece.type);
}
function startTapChain(sx, sy, startType) {
	busy = true;
	lastTappedColumn = sx;
	const levels = computeChainLevels(sx, sy, startType);
	const totalComboForLast = levels.length;
	if (totalComboForLast > maxCombo) { maxCombo = totalComboForLast; updateStats(); }
	tapChain = { levels, levelIndex: 0, removeIdx: 0, waitingPiece: null, phase: "removingPieces", phaseAge: 0, totalComboForLast, currentHighlight: null };
	startTapLevel();
}
// 連鎖の段間隔(ms)。段が進むほど速くなり、長い連鎖ほど畳みかける
function chainStepInterval(levelIndex) { return Math.max(150, 380 - levelIndex * 25); }
function startTapLevel() {
	const levelNodes = tapChain.levels[tapChain.levelIndex];
	const centerType = levelNodes[0].type;
	const color = HIGHLIGHT_BY_TYPE[centerType] || HIGHLIGHT_CYCLE[tapChain.levelIndex % HIGHLIGHT_CYCLE.length];
	tapChain.currentHighlight = addHighlight(levelNodes, color);
	addComboTextEffect(tapChain.levelIndex + 1);
	triggerLevelFx(tapChain.levelIndex + 1, color);
	Sound.play("chain", tapChain.levelIndex + 1);
	removeTapLevelPieces();
	const nextLevel = tapChain.levels[tapChain.levelIndex + 1];
	if (nextLevel) {
		const life = chainStepInterval(tapChain.levelIndex) + 120;
		for (const n of nextLevel) {
			const a = posToPixel(n.from.x, n.from.y), b = posToPixel(n.x, n.y);
			effects.push({ kind: "link", fx: a.x, fy: a.y, tx: b.x, ty: b.y, color, age: 0, life });
		}
	}
	tapChain.phase = "wait"; tapChain.phaseAge = 0;
}
// 同じ段のマスを一斉に消す（以前は1マスずつ消えきるのを待っていて遅かった）
function removeTapLevelPieces() {
	const level = tapChain.levels[tapChain.levelIndex];
	for (const node of level) {
		const p = grid[node.x]?.[node.y];
		if (!p || p.type === "enemy") continue;
		grid[node.x][node.y] = null;
		totalRemoved++; updateStats();
		const pos = posToPixel(node.x, node.y);
		particleBurst(pos.x, pos.y, COLORS[p.type], Math.min(10 + tapChain.levelIndex * 3, 28));
		spawnFlash(pos.x, pos.y, "#ffd700");
		startExplode(p, false);
	}
}
function updateTapChain(deltaMs) {
	if (!tapChain) return;
	if (tapChain.phase === "wait") {
		tapChain.phaseAge += deltaMs;
		if (tapChain.phaseAge >= chainStepInterval(tapChain.levelIndex)) {
			tapChain.currentHighlight.fadeAge = 0; // ハイライトは次の段と並行してフェードアウト
			tapChain.levelIndex++;
			if (tapChain.levelIndex < tapChain.levels.length) startTapLevel();
			else finishTapChain();
		}
	}
}
function updateHighlightFades(deltaMs) {
	for (let i = highlights.length - 1; i >= 0; i--) {
		const hl = highlights[i];
		if (hl.fadeAge == null) continue;
		hl.fadeAge += deltaMs;
		hl.alpha = 0.45 * (1 - clamp(hl.fadeAge / 240, 0, 1));
		if (hl.fadeAge >= 240) highlights.splice(i, 1);
	}
}
// 連鎖ボーナス：3連鎖から、段数に応じたスコアを加算
function chainBonus(n) { return n >= 3 ? (n - 2) * 2 : 0; }
function finishTapChain() {
	const totalComboForLast = tapChain.totalComboForLast;
	const stockBefore = stock;
	if (best.combo > 0 && totalComboForLast > best.combo && totalComboForLast > comboRecordShown) {
		comboRecordShown = totalComboForLast;
		Sound.play("newbest");
		effects.push({ kind: "newbest", x: W / 2, y: H * 0.58, age: 0, life: 1500, level: totalComboForLast });
	}
	const bonus = chainBonus(totalComboForLast);
	if (bonus > 0) {
		bonusScore += bonus;
		Sound.play("bonus");
		effects.push({ kind: "bonus", value: bonus, x: W / 2, y: H * 0.5, age: 0, life: 1300 });
	}
	if (totalComboForLast >= 4) {
		let spType = "bomb";
		if (totalComboForLast >= 8) spType = "cross";
		else if (totalComboForLast >= 6) spType = "h";
		else if (totalComboForLast >= 5) spType = "v";
		pendingSpecial = { col: lastTappedColumn, type: spType };
	}
	for (let x = 0; x < COLS; x++) {
		enemyCounters[x] = Math.max(0, enemyCounters[x]);
		enemyCounters[x]--;
		if (enemyCounters[x] <= 0) enemyPending[x] = true;
	}
	pendingPostCombo = totalComboForLast;
	tapChain = null;
	startCollapseAndFill();
	if (totalComboForLast >= 4) {
		// 特殊コマゲットは連鎖中（まだ操作できない間）に出し、操作が戻ったら入った場所へ飛ばす
		let to = { x: STOCK_SLOT.x + STOCK_SLOT.w / 2, y: STOCK_SLOT.y + STOCK_SLOT.h / 2, s: 0.3 };
		if (stock === stockBefore) { // ストックが埋まっていて盤面に出た
			for (let y = 0; y < ROWS; y++) {
				const q = grid[lastTappedColumn][y];
				if (q && isSpecialType(q.type)) { const pp = posToPixel(lastTappedColumn, y); to = { x: pp.x, y: pp.y, s: 0.3 }; break; }
			}
		}
		effects.push({ kind: "specialGet", x: W / 2, y: H * 0.64, age: 0, life: 1600, flyTo: to });
	}
}

/* ==================== 下詰め・補充 ==================== */
function startCollapseAndFill() {
	autoStockPendingSpecial();
	for (let x = 0; x < COLS; x++) {
		const colPieces = [];
		for (let y = ROWS - 1; y >= 0; y--) { if (grid[x][y]) { colPieces.push(grid[x][y]); grid[x][y] = null; } }
		for (let i = 0; i < colPieces.length; i++) {
			const targetY = ROWS - 1 - i;
			const p = colPieces[i];
			const fromY = p.y;
			grid[x][targetY] = p; p.gridY = targetY;
			p.x = posToPixel(x, targetY).x;
			const toY = posToPixel(x, targetY).y;
			if (Math.abs(fromY - toY) > 2) p.dropAnim = { fromY, toY, age: 0, dur: 320, bounce: false };
			else { p.y = toY; p.dropAnim = null; }
		}
		const toFill = ROWS - colPieces.length;
		for (let i = 0; i < toFill; i++) {
			const fillY = toFill - 1 - i;
			let spawnType = null;
			if (pendingSpecial && pendingSpecial.col === x) { spawnType = pendingSpecial.type; pendingSpecial = null; }
			else if (enemyPending[x]) { spawnType = "enemy"; enemyPending[x] = false; enemyCounters[x] = Math.floor(Math.random() * 5) + 3; }
			else spawnType = TYPES[Math.floor(Math.random() * TYPES.length)];
			const np = makePiece(spawnType);
			const pos = posToPixel(x, fillY);
			if (spawnType === "enemy") Sound.play("enemy");
			if (isSpecialType(spawnType)) { Sound.play("appear"); effects.push({ kind: "pillar", x: pos.x, yTop: OFFSET_Y - 20, yBottom: pos.y, age: 0, life: 1100 }); }
			np.gridX = x; np.gridY = fillY; np.x = pos.x;
			const startY = OFFSET_Y - CELL - Math.random() * 40;
			np.y = startY;
			np.dropAnim = { fromY: startY, toY: pos.y, age: 0, dur: 380, bounce: true };
			grid[x][fillY] = np;
		}
	}
	collapsePhase = { age: 0, dur: 380 };
}
function updateDrops(deltaMs) {
	for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
		const p = grid[x][y];
		if (p && p.dropAnim) {
			p.dropAnim.age += deltaMs;
			const t2 = clamp(p.dropAnim.age / p.dropAnim.dur, 0, 1);
			const e = p.dropAnim.bounce ? easeBounceOut(t2) : easePower2Out(t2);
			p.y = lerp(p.dropAnim.fromY, p.dropAnim.toY, e);
			if (t2 >= 1) { p.y = p.dropAnim.toY; p.dropAnim = null; }
		}
	}
}
function updateCollapsePhase(deltaMs) {
	if (!collapsePhase) return;
	collapsePhase.age += deltaMs;
	if (collapsePhase.age >= collapsePhase.dur) {
		collapsePhase = null;
		updateEnemyWarnings();
		checkGameOver();
		checkClear();
		if (pendingPostCombo != null) { showTotalCombo(pendingPostCombo); pendingPostCombo = null; }
		busy = false;
	}
}

/* ==================== リセット ==================== */
function resetGame() {
	gameOver = false; clearPopup = null; resultState = null;
	explodingPieces = []; highlights = []; effects = []; stars = [];
	tapChain = null; activeSpecial = null; collapsePhase = null;
	pendingSpecial = null; pendingPostCombo = null; busy = false;
	initGrid();
	guideSeen.tap = false; guideTapTarget = null; guideEnemyTarget = null; // 最初の連鎖ガイドを毎回出す
}

/* ==================== 更新ループ ==================== */
function updateAllPieces(deltaMs) {
	for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
		const p = grid[x][y]; if (!p) continue;
		if (p.type === "enemy") {
			if (p.warnLevel === 1) p.warnPhase += deltaMs * (Math.PI * 2 / 700);
		} else if (isSpecialType(p.type)) {
			p.shimmerPhase += deltaMs * (Math.PI * 2 / 1600);
		}
	}
	for (let i = explodingPieces.length - 1; i >= 0; i--) {
		const p = explodingPieces[i];
		p.explodeAge += deltaMs;
		updatePieceExplodeVisual(p);
		if (p.explodeAge >= p.explodeDur) { p.exploding = false; explodingPieces.splice(i, 1); }
	}
	updateDrops(deltaMs);
}
// COMBOなどの文字は、操作が戻った瞬間に盤面の外へ飛ばす（次に押したいマスを隠さない）
const FLY_TEXT_KINDS = ["combo", "bonus", "specialGet", "newbest"];
const FLY_MS = 260, FLY_SP_MS = 420, FLY_LINGER_MS = 300, FLY_HOLD_AGE = 600;
function flyTextDest(e) {
	if (e.kind === "combo") return { x: W / 2, y: 52, s: 0.5 };       // 上のドクロ欄
	if (e.kind === "bonus") return { x: W * 0.3, y: 74, s: 0.55 };
	if (e.kind === "newbest") return { x: W * 0.7, y: 74, s: 0.5 };
	return e.flyTo;                                                       // 特殊コマ：入った場所
}
function updateFlyingTexts(deltaMs) {
	const unlocked = !busy && !tapChain && !activeSpecial && !collapsePhase;
	for (const e of effects) {
		if (!FLY_TEXT_KINDS.includes(e.kind)) continue;
		if (!e.fly && unlocked) e.fly = { t: 0, dest: flyTextDest(e) };
		if (!e.fly) continue;
		e.fly.t += deltaMs;
		if (e.kind === "specialGet") { if (e.fly.t >= FLY_SP_MS && e.life - e.age > 150) e.age = e.life - 150; } // 枠に入ったらすぐ消える
		else if (e.fly.t < FLY_MS + FLY_LINGER_MS) e.age = Math.min(e.age, FLY_HOLD_AGE - deltaMs); // 飛んでいる間と着地後しばらくは不透明のまま
	}
}
function updateEffectsList(deltaMs) {
	updateFlyingTexts(deltaMs);
	for (let i = effects.length - 1; i >= 0; i--) {
		const e = effects[i];
		if (e.delay > 0) { e.delay -= deltaMs; continue; }
		e.age += deltaMs;
		if (e.age >= e.life) effects.splice(i, 1);
	}
}
function updateClearPopup(deltaMs) {
	if (!clearPopup) return;
	const beforeAge = clearPopup.age;
	clearPopup.age += deltaMs;
	if (beforeAge === 0) Sound.play("clear");
	if (beforeAge < 1700 && clearPopup.age >= 1700 && clearPopup.rec && clearPopup.rec.flags.score) Sound.play("record");
	if (clearPopup.closing) {
		clearPopup.closeAge += deltaMs;
		if (clearPopup.closeAge >= 400) {
			const restart = clearPopup.pendingRestart;
			clearPopup = null;
			if (restart) resetGame();
		}
	}
}
function update(deltaMs) {
	if (titleScreen) {
		titleAge += deltaMs;
		if (titleLeave) { titleLeave.age += deltaMs; if (titleLeave.age >= 450) { titleScreen = false; titleLeave = null; } }
	}
	updateAllPieces(deltaMs);
	updateTapChain(deltaMs);
	updateHighlightFades(deltaMs);
	updateGuides();
	{
		let danger = 0;
		for (let x = 0; x < COLS && !danger; x++) for (let y = 0; y < ROWS; y++) { const p = grid[x][y]; if (p && p.type === "enemy" && p.warnLevel >= 1) { danger = 1; break; } }
		if (gameOver || clearPopup) { danger = 0; dangerLevel = 0; }
		dangerLevel += (danger - dangerLevel) * Math.min(1, deltaMs / 220);
		// ピンチに入った瞬間だけ「ドクン」と鳴らして「ピンチ！」を出す（鳴り続けない）。解消後、再びピンチになればまた1回出る
		if (dangerLevel > 0.4 && !pinchActive) {
			pinchActive = true;
			Sound.play("danger");
			effects.push({ kind: "label", text: t("pinchLabel"), x: W / 2, y: H * 0.5, age: 0, life: 1100 });
		} else if (dangerLevel < 0.15) pinchActive = false;
	}
	{ const sc = currentScore(); if (scoreShown < sc) scoreShown = Math.min(sc, scoreShown + Math.max(1, (sc - scoreShown) * 0.2)); else if (scoreShown > sc) scoreShown = sc; }
	updateActiveSpecial(deltaMs);
	updateCollapsePhase(deltaMs);
	updateEffectsList(deltaMs);
	{
		if (!tapChain && !activeSpecial) bgGlow.target = 0;
		const rate = bgGlow.target > bgGlow.value ? deltaMs / 140 : deltaMs / 650;
		bgGlow.value += (bgGlow.target - bgGlow.value) * Math.min(1, rate);
		if (bgGlow.value < 0.002 && bgGlow.target === 0) { bgGlow.value = 0; bgGlow.level = 0; }
	}
	updateStars(deltaMs);
	updateClearPopup(deltaMs);
	if (gameOver && resultState) {
		const before = resultState.age;
		resultState.age += deltaMs;
		if (before < 0 && resultState.age >= 0) Sound.play(resultState.isKing ? "clear" : "over");
		if (before < 1700 && resultState.age >= 1700 && resultState.rec && resultState.rec.flags.score) Sound.play("record");
	}
	if (shake) { shake.age += deltaMs; if (shake.age >= shake.dur) shake = null; }
	if (screenFlash) { screenFlash.age += deltaMs; if (screenFlash.age >= screenFlash.dur) screenFlash = null; }
}

/* ==================== 描画 ==================== */
function drawTriangleArrow(cx, cy, size, angle) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(angle);
	ctx.beginPath();
	ctx.moveTo(size, 0);
	ctx.lineTo(-size * 0.55, size * 0.65);
	ctx.lineTo(-size * 0.55, -size * 0.65);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}
function fillDiagonalStripes(halfSize, colorA, colorB, stripeW) {
	const diag = halfSize * 2.6;
	ctx.save();
	ctx.rotate(Math.PI / 4);
	let idx = 0;
	for (let i = -diag; i < diag; i += stripeW) {
		ctx.fillStyle = idx % 2 === 0 ? colorA : colorB;
		ctx.fillRect(i, -diag, stripeW, diag * 2);
		idx++;
	}
	ctx.restore();
}
function drawPiece(p) {
	if (!p) return;
	const s = CELL * 0.82 * (p.scale != null ? p.scale : 1);
	const half = s / 2;
	const isSpecial = isSpecialType(p.type);
	ctx.save();
	ctx.translate(p.x, p.y);
	const pinch = p.type === "enemy" && p.warnLevel >= 1 && !gameOver && !clearPopup;
	if (pinch) ctx.translate(Math.sin(p.warnPhase * 5) * 1.6, 0); // 小刻みに震える
	ctx.globalAlpha = p.alpha != null ? p.alpha : 1;

	if (p.type === "enemy") {
		// 黒地＋黄黒ハザードストライプの縁で「触れると危険」感を強調
		const hz = HAZARD_COLORS[p.warnLevel] || HAZARD_COLORS[0];
		const flashMul = p.warnLevel === 1 ? lerp(0.55, 1, 0.5 + 0.5 * Math.sin(p.warnPhase)) : 1;

		ctx.save();
		ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
		roundRectPath(-half, -half, s, s, s * 0.22);
		ctx.fillStyle = hz.core; ctx.fill();
		ctx.restore();

		ctx.save();
		roundRectPath(-half, -half, s, s, s * 0.22);
		ctx.clip();
		ctx.globalAlpha *= flashMul;
		fillDiagonalStripes(half, hz.stripeA, hz.stripeB, s * 0.16);
		ctx.restore();

		const inset = s * 0.16;
		roundRectPath(-half + inset, -half + inset, s - inset * 2, s - inset * 2, s * 0.14);
		ctx.fillStyle = hz.core;
		ctx.fill();

		if (p.warnLevel === 2) {
			roundRectPath(-half - 2, -half - 2, s + 4, s + 4, s * 0.24);
			ctx.strokeStyle = "rgba(255,0,0,0.9)"; ctx.lineWidth = 2; ctx.stroke();
		}

		ctx.font = `${Math.floor(CELL * 0.4)}px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`;
		ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
		ctx.fillText(PIECE_ICONS.enemy, 0, s * 0.02);
		if (pinch) {
			const pulse = 0.5 + 0.5 * Math.sin(p.warnPhase * 1.5);
			ctx.fillStyle = "#ff3b3b"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.arc(half * 0.78, -half * 0.78, 7 + pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.font = `bold 11px ${FONT_STACK}`; ctx.fillStyle = "#fff"; ctx.fillText("!", half * 0.78, -half * 0.78 + 1);
		}
		ctx.restore();
		return;
	}

	if (isSpecial) ctx.globalAlpha *= (0.85 + 0.15 * Math.sin(p.shimmerPhase));

	// カード本体（影付き角丸カード）
	ctx.save();
	ctx.shadowColor = "rgba(0,0,0,0.45)";
	ctx.shadowBlur = 6;
	ctx.shadowOffsetY = 3;
	roundRectPath(-half, -half, s, s, s * 0.22);
	ctx.fillStyle = COLORS[p.type];
	ctx.fill();
	ctx.restore();

	if (isSpecial) {
		// 消える方向を示すストライプ
		ctx.save();
		roundRectPath(-half, -half, s, s, s * 0.22);
		ctx.clip();
		ctx.strokeStyle = "rgba(255,160,0,0.35)";
		ctx.lineWidth = 2;
		if (p.type === "bomb") {
			ctx.fillStyle = "rgba(255,140,0,0.4)";
			for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
				if (i === 0 && j === 0) continue;
				ctx.beginPath(); ctx.arc(i * half * 0.62, j * half * 0.62, s * 0.06, 0, Math.PI * 2); ctx.fill();
			}
		}
		if (p.type === "h" || p.type === "cross") {
			for (let ly = -half + 6; ly < half; ly += 9) { ctx.beginPath(); ctx.moveTo(-half, ly); ctx.lineTo(half, ly); ctx.stroke(); }
		}
		if (p.type === "v" || p.type === "cross") {
			for (let lx = -half + 6; lx < half; lx += 9) { ctx.beginPath(); ctx.moveTo(lx, -half); ctx.lineTo(lx, half); ctx.stroke(); }
		}
		ctx.restore();

		// 消える方向を示す矢印
		ctx.fillStyle = "#ff8c00";
		const arrowSize = s * (p.type === "cross" ? 0.18 : 0.22);
		const arrowOffset = half * 0.7;
		if (p.type === "h" || p.type === "cross") {
			drawTriangleArrow(-arrowOffset, 0, arrowSize, Math.PI);
			drawTriangleArrow(arrowOffset, 0, arrowSize, 0);
		}
		if (p.type === "v" || p.type === "cross") {
			drawTriangleArrow(0, -arrowOffset, arrowSize, -Math.PI / 2);
			drawTriangleArrow(0, arrowOffset, arrowSize, Math.PI / 2);
		}
	}

	// 内側の光沢枠
	roundRectPath(-half + 2, -half + 2, s - 4, s - 4, s * 0.18);
	ctx.strokeStyle = isSpecial ? "rgba(255,160,0,0.9)" : "rgba(255,255,255,0.55)";
	ctx.lineWidth = isSpecial ? 2.5 : 1.5;
	ctx.stroke();

	ctx.font = `${Math.floor(CELL * (isSpecial ? 0.28 : 0.42))}px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`;
	ctx.textAlign = "center"; ctx.textBaseline = "middle";
	ctx.fillStyle = isSpecial ? "#c77700" : "#2a1a1a";
	ctx.fillText(PIECE_ICONS[p.type], 0, s * 0.04);
	ctx.restore();
}
function drawBoard() {
	for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if (grid[x][y]) drawPiece(grid[x][y]);
	for (const p of explodingPieces) drawPiece(p);
}
function drawHighlights() {
	for (const hl of highlights) {
		const s = CELL * 0.92;
		for (const r of hl.rects) {
			const p = posToPixel(r.x, r.y);
			ctx.save();
			ctx.globalAlpha = hl.alpha;
			ctx.shadowColor = hl.color; ctx.shadowBlur = 14;
			roundRectPath(p.x - s / 2, p.y - s / 2, s, s, s * 0.2);
			ctx.strokeStyle = hl.color; ctx.lineWidth = 4;
			ctx.stroke();
			ctx.restore();
			ctx.save();
			ctx.globalAlpha = hl.alpha * 0.3;
			roundRectPath(p.x - s / 2, p.y - s / 2, s, s, s * 0.2);
			ctx.fillStyle = hl.color;
			ctx.fill();
			ctx.restore();
		}
	}
}
function drawStarShape(cx, cy, outerR, innerR, spikes, rotation) {
	ctx.beginPath();
	for (let i = 0; i < spikes * 2; i++) {
		const r = i % 2 === 0 ? outerR : innerR;
		const ang = (Math.PI * i) / spikes - Math.PI / 2 + (rotation || 0);
		const px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
		if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
	}
	ctx.closePath();
}
function drawEffects(list) {
	for (const e of list) {
		if (e.delay > 0) continue;
		if (e.kind === "particle") {
			const t2 = clamp(e.age / e.life, 0, 1);
			const k = easePower2Out(t2);
			const rot = t2 * Math.PI * 1.5;
			const size = lerp(6, 2, t2);
			ctx.save(); ctx.globalAlpha = 1 - t2; ctx.fillStyle = e.color;
			ctx.shadowColor = e.color; ctx.shadowBlur = 6;
			drawStarShape(e.x + e.dx * k, e.y + e.dy * k, size, size * 0.45, 4, rot);
			ctx.fill(); ctx.restore();
		} else if (e.kind === "flash") {
			const t2 = clamp(e.age / e.life, 0, 1);
			const r = lerp(6, CELL * 0.75, t2);
			ctx.save();
			ctx.globalAlpha = (1 - t2) * 0.85;
			ctx.strokeStyle = e.color; ctx.lineWidth = 3;
			ctx.shadowColor = e.color; ctx.shadowBlur = 10;
			ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		} else if (e.kind === "fly") {
			const k = clamp(e.age / e.life, 0, 1), ek = k * k * (3 - 2 * k);
			ctx.save();
			ctx.globalAlpha = 1 - 0.3 * k;
			drawSpecialIcon(e.type, lerp(e.fx, e.tx, ek), lerp(e.fy, e.ty, ek) - Math.sin(Math.PI * k) * 30, lerp(46, 34, ek));
			ctx.restore();
		} else if (e.kind === "label") {
			const k = clamp(e.age / e.life, 0, 1);
			const pop = e.age < 250 ? easeBackOut(e.age / 250) : 1;
			ctx.save();
			ctx.translate(e.x, e.y - 18 * easeOutQuad(k)); ctx.scale(0.5 + 0.5 * pop, 0.5 + 0.5 * pop); ctx.globalAlpha = k < 0.7 ? 1 : clamp(1 - (k - 0.7) / 0.3, 0, 1);
			ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 14;
			drawText(e.text, 0, 0, { size: 26, weight: "bold", align: "center", baseline: "middle", color: "#fff6c8", stroke: "#a35c00", strokeWidth: 6 });
			ctx.restore();
		} else if (e.kind === "newbest") {
			const k = clamp(e.age / e.life, 0, 1);
			const pop = e.age < 250 ? easeBackOut(e.age / 250) : 1;
			const alpha = k < 0.75 ? 1 : clamp(1 - (k - 0.75) / 0.25, 0, 1);
			ctx.save();
			ctx.translate(e.x, e.y - 14 * easeOutQuad(k)); ctx.scale(0.5 + 0.5 * pop, 0.5 + 0.5 * pop); ctx.globalAlpha = alpha;
			fillRoundRect(-92, -17, 184, 34, 17, "rgba(40,16,70,0.85)");
			roundRectPath(-92, -17, 184, 34, 17); ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 2; ctx.stroke();
			drawText("★ " + t("newBestCombo") + " x" + e.level, 0, 1, { size: 14, weight: "bold", align: "center", baseline: "middle", color: "#fff6c8" });
			ctx.restore();
		} else if (e.kind === "link") {
			const k = clamp(e.age / e.life, 0, 1);
			const grow = easeOutQuad(clamp(e.age / 90, 0, 1));
			const tx = lerp(e.fx, e.tx, grow), ty = lerp(e.fy, e.ty, grow);
			drawLinkArrow(e.fx, e.fy, tx, ty, "#fff6c8", 1 - k * k, 5);
			// 次に消えるマスを脈打つ輪で示す
			ctx.save();
			ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = e.color; ctx.lineWidth = 3; ctx.shadowColor = e.color; ctx.shadowBlur = 8;
			ctx.beginPath(); ctx.arc(e.tx, e.ty, CELL * (0.42 + 0.1 * Math.sin(e.age / 60)), 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		} else if (e.kind === "charge") {
			const k = clamp(e.age / e.life, 0, 1);
			ctx.save();
			ctx.globalAlpha = 0.25 + 0.7 * k; ctx.strokeStyle = "#ffe680"; ctx.lineWidth = 3; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 12;
			ctx.beginPath(); ctx.arc(e.x, e.y, lerp(CELL * 1.3, CELL * 0.28, k * k), 0, Math.PI * 2); ctx.stroke();
			for (let i = 0; i < 6; i++) {
				const a = Math.PI * 2 * i / 6 + k * 2, r = lerp(CELL * 1.2, CELL * 0.3, k * k);
				ctx.fillStyle = "#fff6c8";
				drawStarShape(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 3.4, 1.5, 4, k * 6); ctx.fill();
			}
			ctx.restore();
		} else if (e.kind === "shock") {
			const k = clamp(e.age / e.life, 0, 1), r = lerp(CELL * 0.3, e.maxR, easeOutQuad(k));
			ctx.save();
			const g = ctx.createRadialGradient(e.x, e.y, r * 0.2, e.x, e.y, r);
			g.addColorStop(0, "rgba(255,230,160,0)"); g.addColorStop(1, `rgba(255,190,60,${0.35 * (1 - k)})`);
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
			ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#fff0b0"; ctx.lineWidth = 2 + 6 * (1 - k); ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 14;
			ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		} else if (e.kind === "beam") {
			const k = clamp(e.age / e.life, 0, 1), ext = CELL * 6.2 * easeOutQuad(clamp(e.age / 260, 0, 1));
			const thick = CELL * (e.wide ? 1.7 : 0.62) * (1 - k * 0.7);
			ctx.save();
			ctx.globalAlpha = 1 - k * k;
			if (e.orient === "h") {
				const x0 = Math.max(OFFSET_X, e.x - ext), x1 = Math.min(OFFSET_X + COLS * CELL, e.x + ext);
				const g = ctx.createLinearGradient(0, e.y - thick / 2, 0, e.y + thick / 2);
				g.addColorStop(0, "rgba(255,200,80,0)"); g.addColorStop(0.5, "rgba(255,250,215,1)"); g.addColorStop(1, "rgba(255,200,80,0)");
				ctx.fillStyle = g; ctx.fillRect(x0, e.y - thick / 2, x1 - x0, thick);
				ctx.fillStyle = "#fffbe6"; ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 14;
				[e.x - ext, e.x + ext].forEach((ex) => { if (ex >= OFFSET_X && ex <= OFFSET_X + COLS * CELL) { ctx.beginPath(); ctx.arc(ex, e.y, thick * 0.4, 0, Math.PI * 2); ctx.fill(); } });
			} else {
				const y0 = Math.max(OFFSET_Y, e.y - ext), y1 = Math.min(OFFSET_Y + ROWS * CELL, e.y + ext);
				const g = ctx.createLinearGradient(e.x - thick / 2, 0, e.x + thick / 2, 0);
				g.addColorStop(0, "rgba(255,200,80,0)"); g.addColorStop(0.5, "rgba(255,250,215,1)"); g.addColorStop(1, "rgba(255,200,80,0)");
				ctx.fillStyle = g; ctx.fillRect(e.x - thick / 2, y0, thick, y1 - y0);
				ctx.fillStyle = "#fffbe6"; ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 14;
				[e.y - ext, e.y + ext].forEach((ey) => { if (ey >= OFFSET_Y && ey <= OFFSET_Y + ROWS * CELL) { ctx.beginPath(); ctx.arc(e.x, ey, thick * 0.4, 0, Math.PI * 2); ctx.fill(); } });
			}
			ctx.restore();
		} else if (e.kind === "bonus") {
			const k = clamp(e.age / e.life, 0, 1);
			const pop = e.age < 250 ? easeBackOut(e.age / 250) : 1;
			const alpha = k < 0.7 ? 1 : clamp(1 - (k - 0.7) / 0.3, 0, 1);
			ctx.save();
			ctx.translate(e.x, e.y - 22 * easeOutQuad(k)); ctx.scale(0.5 + 0.5 * pop, 0.5 + 0.5 * pop); ctx.globalAlpha = alpha;
			ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 12;
			drawText(t("chainBonusFmt")(e.value), 0, 0, { size: 22, weight: "bold", align: "center", baseline: "middle", color: "#fff6c8", stroke: "#a35c00", strokeWidth: 5 });
			ctx.restore();
		} else if (e.kind === "pillar") {
			const span = e.yBottom - e.yTop + CELL * 0.5;
			const grow = easeOutQuad(clamp(e.age / 260, 0, 1));
			const fade = 1 - clamp((e.age - 320) / (e.life - 320), 0, 1);
			const w = CELL * 0.7 * (1 - 0.4 * clamp((e.age - 260) / (e.life - 260), 0, 1));
			ctx.save();
			ctx.globalAlpha = 0.9 * fade;
			const g = ctx.createLinearGradient(e.x - w / 2, 0, e.x + w / 2, 0);
			g.addColorStop(0, "rgba(255,214,90,0)"); g.addColorStop(0.5, "rgba(255,246,200,0.95)"); g.addColorStop(1, "rgba(255,214,90,0)");
			ctx.fillStyle = g; ctx.fillRect(e.x - w / 2, e.yTop, w, span * grow);
			for (let i = 0; i < 8; i++) {
				const sy = e.yBottom - ((e.age * 0.14 + hash01(i + 5) * span) % span);
				ctx.fillStyle = "#fff6c8"; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 6;
				drawStarShape(e.x + (hash01(i) - 0.5) * w, sy, 3.2, 1.4, 4, e.age / 200 + i);
				ctx.fill();
			}
			const rk = clamp((e.age - 300) / 500, 0, 1);
			if (rk > 0 && rk < 1) {
				ctx.globalAlpha = (1 - rk) * 0.9; ctx.strokeStyle = "#ffe680"; ctx.lineWidth = 3; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 10;
				ctx.beginPath(); ctx.arc(e.x, e.yBottom, lerp(8, CELL * 0.95, easeOutQuad(rk)), 0, Math.PI * 2); ctx.stroke();
			}
			ctx.restore();
		} else if (e.kind === "combo" || e.kind === "specialGet") {
			const popDur = e.kind === "combo" ? 250 : 280;
			const holdEnd = e.kind === "combo" ? 750 : 900;
			let scale, alpha;
			if (e.age < popDur) { scale = lerp(0.6, e.kind === "combo" ? 1.1 : 1.0, easeBackOut(e.age / popDur)); alpha = 1; }
			else if (e.age < holdEnd) { scale = e.kind === "combo" ? 1.1 : 1.0; alpha = 1; }
			else { scale = e.kind === "combo" ? 1.1 : 1.0; alpha = clamp(1 - (e.age - holdEnd) / (e.life - holdEnd), 0, 1); }
			ctx.save(); ctx.translate(e.x, e.y); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
			if (e.kind === "combo") {
				ctx.shadowColor = e.color; ctx.shadowBlur = 12;
				drawText(t("comboFmt")(e.level), 0, 0, { size: 28 + Math.min(e.level - 1, 8) * 2.5, weight: "bold", align: "center", baseline: "middle", color: "#fffbe8", stroke: "#3a1a4a", strokeWidth: 5 });
			} else {
				ctx.shadowColor = "#ffd700"; ctx.shadowBlur = 16;
				drawText(t("specialGet"), 0, 0, { size: 26, weight: "bold", align: "center", baseline: "middle", color: "#fff8dc", stroke: "#a35c00", strokeWidth: 5 });
			}
			ctx.restore();
		}
	}
}
// 飛んでいる文字はHUD・ルール欄より手前に描く。上の欄に着地した文字の下には薄い帯を敷く
function drawFlyingTexts() {
	const flying = effects.filter((e) => e.fly);
	if (!flying.length) return;
	const top = flying.filter((e) => e.kind !== "specialGet");
	if (top.length) {
		const a = Math.max(...top.map((e) => clamp(e.fly.t / FLY_MS, 0, 1) * clamp((e.life - e.age) / 300, 0, 1)));
		ctx.save(); ctx.globalAlpha = 0.6 * a; ctx.fillStyle = "#1a0f33"; ctx.fillRect(0, 38, W, 48); ctx.restore();
	}
	for (const e of flying) {
		const k = easeOutQuad(clamp(e.fly.t / (e.kind === "specialGet" ? FLY_SP_MS : FLY_MS), 0, 1)), d = e.fly.dest;
		const sc = lerp(1, d.s, k);
		ctx.save();
		ctx.translate(lerp(e.x, d.x, k), lerp(e.y, d.y, k)); ctx.scale(sc, sc); ctx.translate(-e.x, -e.y);
		drawEffects([e]);
		ctx.restore();
	}
}
function drawStars() {
	for (const s of stars) {
		const twinkle = 1 + 0.25 * Math.sin(s.twinklePhase);
		ctx.save();
		ctx.globalAlpha = 0.9 * (1 - clamp(s.age / s.dur, 0, 1));
		ctx.translate(s.x, s.y);
		ctx.fillStyle = "rgba(255,204,51,0.6)";
		ctx.beginPath(); ctx.arc(0, 0, 8 * twinkle, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = "#ffee88";
		ctx.beginPath(); ctx.arc(0, 0, 3 * twinkle, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}
}
function drawScoreHud() {
	const pulse = Math.round(scoreShown) < currentScore() ? 1 : 0;
	drawText(t("scoreLabel"), 12, 16, { size: 9, weight: "bold", align: "left", baseline: "middle", color: "#bda8e8" });
	ctx.save();
	if (pulse) { ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 8; }
	drawText(String(Math.round(scoreShown)), 12, 31, { size: 17, weight: "bold", align: "left", baseline: "middle", color: pulse ? "#fff6c8" : "#ffd166" });
	ctx.restore();
}
function drawTopBar(nowMs) {
	const cycle = 3000;
	const p = (nowMs % cycle) / cycle;
	const wave = p < 0.5 ? p * 2 : (1 - p) * 2;
	const achieveText = achieveDisplayValue == null ? t("achieveStart") : t("achieveCurrentFmt")(achieveDisplayValue);
	const badgeLabel = `★ ${achieveText} ★`;

	const BADGE_MAX_W = 170;
	let badgeFont = 15, textW;
	ctx.save();
	do {
		ctx.font = `bold ${badgeFont}px ` + FONT_STACK;
		textW = ctx.measureText(badgeLabel).width;
		if (textW + 30 <= BADGE_MAX_W || badgeFont <= 10) break;
		badgeFont--;
	} while (true);
	ctx.restore();
	const badgeW = clamp(textW + 30, 140, BADGE_MAX_W);
	const badgeH = 30, badgeY = 8;
	const bx = W / 2 - badgeW / 2;

	ctx.save();
	ctx.shadowColor = `rgba(255,180,0,${0.5 + 0.3 * wave})`;
	ctx.shadowBlur = 8 + 8 * wave;
	const g = ctx.createLinearGradient(bx, 0, bx + badgeW, 0);
	g.addColorStop(0, "#ffd700"); g.addColorStop(1, "#ff8a3d");
	roundRectPath(bx, badgeY, badgeW, badgeH, badgeH / 2);
	ctx.fillStyle = g; ctx.fill();
	ctx.restore();
	roundRectPath(bx + 2, badgeY + 2, badgeW - 4, badgeH - 4, (badgeH - 4) / 2);
	ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();
	drawText(badgeLabel, W / 2, badgeY + badgeH / 2 + 1, { size: badgeFont, weight: "bold", align: "center", baseline: "middle", color: "#3a1a00" });

	for (let x = 0; x < COLS; x++) {
		const cx = posToPixel(x, 0).x;
		const c = Math.max(0, enemyCounters[x]);
		const isWarn = enemyPending[x];
		const pw = 40, ph = 22, py = 46;
		const pulse = 0.5 + 0.5 * Math.sin(nowMs / 120);
		let fillColor = "rgba(120,200,255,0.45)";
		if (isWarn || c <= 1) fillColor = `rgba(255,60,60,${0.7 + 0.25 * pulse})`;
		else if (c <= 3) fillColor = "rgba(255,170,60,0.7)";
		fillRoundRect(cx - pw / 2, py, pw, ph, 11, "rgba(255,255,255,0.14)");
		ctx.save();
		roundRectPath(cx - pw / 2, py, pw, ph, 11);
		ctx.clip();
		ctx.fillStyle = fillColor;
		ctx.fillRect(cx - pw / 2, py, (isWarn || c <= 1) ? pw : pw * clamp(0.2 + c / 9 * 0.8, 0, 1), ph);
		ctx.restore();
		drawText((isWarn || c <= 1) ? "☠" : "☠ " + c, cx, py + ph / 2 + 1, { size: 12, weight: "bold", align: "center", baseline: "middle", color: "#ffffff" });
	}
}
// 次の1手で敵が湧く列（カウンタ1以下）を盤面上で赤く予告する
function drawColumnWarnings(nowMs) {
	const pulse = 0.5 + 0.5 * Math.sin(nowMs / 160);
	for (let x = 0; x < COLS; x++) {
		if (!(enemyPending[x] || enemyCounters[x] <= 1)) continue;
		const cx = posToPixel(x, 0).x;
		const top = OFFSET_Y, h = CELL * ROWS;
		const g = ctx.createLinearGradient(0, top, 0, top + h);
		g.addColorStop(0, `rgba(255,60,60,${0.22 + 0.12 * pulse})`);
		g.addColorStop(1, "rgba(255,60,60,0.02)");
		ctx.fillStyle = g;
		ctx.fillRect(cx - CELL / 2, top, CELL, h);
		ctx.save();
		ctx.fillStyle = `rgba(255,90,90,${0.7 + 0.3 * pulse})`;
		drawTriangleArrow(cx, top - 5 + pulse * 2, 6, Math.PI / 2);
		ctx.restore();
	}
}
// マウスホバー中のマスから繋がる範囲を薄く表示する
function previewCell() {
	if (hoverCell) return hoverCell;
	if (press && press.cell && performance.now() - press.t0 >= PREVIEW_HOLD_MS) return press.cell;
	return null;
}
function drawBackdrop(nowMs) {
	const v = bgGlow.value;
	if (v > 0.01) {
		const [r, g, b] = hexToRgb(bgGlow.color);
		const cy = OFFSET_Y + CELL * 3;
		const grad = ctx.createRadialGradient(W / 2, cy, 10, W / 2, cy, H * 0.85);
		grad.addColorStop(0, `rgba(${r},${g},${b},${0.1 + 0.3 * v})`); grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
		ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
		if (bgGlow.level >= 6) { // 高連鎖：ゆっくり虹色に（点滅ではなく、なめらかに変化）
			ctx.fillStyle = `hsla(${(nowMs / 14) % 360},90%,60%,${0.12 * v * Math.min(1, (bgGlow.level - 5) / 5)})`;
			ctx.fillRect(0, 0, W, H);
		}
	}
	for (const e of effects) {
		if (e.kind !== "bgspark" || e.delay > 0) continue;
		const k = clamp(e.age / e.life, 0, 1);
		ctx.save();
		ctx.globalAlpha = Math.sin(Math.PI * k) * 0.8; ctx.fillStyle = e.color; ctx.shadowColor = e.color; ctx.shadowBlur = 6;
		drawStarShape(e.x, e.y0 - e.vy * e.age, e.size, e.size * 0.45, 4, e.age / 300);
		ctx.fill();
		ctx.restore();
	}
}
function drawDangerVignette(nowMs) {
	if (dangerLevel < 0.02) return;
	const beat = 0.5 + 0.5 * Math.sin(nowMs / 230);
	const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
	g.addColorStop(0, "rgba(255,40,40,0)");
	g.addColorStop(1, `rgba(255,40,40,${(0.16 + 0.14 * beat) * dangerLevel})`);
	ctx.save();
	ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
	ctx.restore();
}
function drawChainPreview(nowMs) {
	const hoverCell = previewCell();
	if (!hoverCell || busy || gameOver || clearPopup) return;
	if (stockAim && stock) {
		const here = grid[hoverCell.x]?.[hoverCell.y];
		const nbp = (here && isSpecialType(here.type)) ? { type: here.type } : findMergeNeighbor(hoverCell.x, hoverCell.y);
		const ty = nbp ? mergeTypes(stock, nbp.type) : stock;
		const s0 = CELL * 0.9, pulse0 = 0.65 + 0.35 * Math.sin(nowMs / 140);
		ctx.save();
		ctx.globalAlpha = 0.38 * pulse0; ctx.fillStyle = "#ffd700";
		for (const c of specialArea(ty, hoverCell.x, hoverCell.y)) { const q = posToPixel(c.x, c.y); roundRectPath(q.x - s0 / 2, q.y - s0 / 2, s0, s0, s0 * 0.2); ctx.fill(); }
		ctx.restore();
		return;
	}
	const piece = grid[hoverCell.x]?.[hoverCell.y];
	if (!piece || piece.type === "enemy") return;
	const pulse = 0.65 + 0.35 * Math.sin(nowMs / 140);
	const s = CELL * 0.9;
	const isSpecial = isSpecialType(piece.type);
	if (isSpecial) {
		const nb = findMergeNeighbor(hoverCell.x, hoverCell.y);
		const ty = nb ? mergeTypes(piece.type, nb.type) : piece.type;
		ctx.save();
		ctx.globalAlpha = 0.35 * pulse; ctx.fillStyle = "#ffd700";
		for (const c of specialArea(ty, hoverCell.x, hoverCell.y)) {
			const q = posToPixel(c.x, c.y); roundRectPath(q.x - s / 2, q.y - s / 2, s, s, s * 0.2); ctx.fill();
		}
		ctx.restore();
		if (nb) {
			const q = posToPixel(hoverCell.x, hoverCell.y), r2 = posToPixel(nb.x, nb.y);
			ctx.save(); ctx.globalAlpha = 0.9; ctx.strokeStyle = "#fff6c8"; ctx.lineWidth = 3; ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 10;
			ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(r2.x, r2.y); ctx.stroke(); ctx.restore();
			const bw = 74, bh = 20, bx = clamp(q.x - bw / 2, 4, W - bw - 4), by = Math.max(q.y - CELL / 2 - bh - 2, 2);
			fillRoundRect(bx, by, bw, bh, 10, "rgba(20,10,40,0.85)");
			drawText(t("mergeLabel"), bx + bw / 2, by + bh / 2 + 1, { size: 12, weight: "bold", align: "center", baseline: "middle", color: "#ffe680" });
		}
		return;
	}
	const levels = computeChainLevels(hoverCell.x, hoverCell.y, piece.type);
	levels.forEach((lv, i) => {
		const color = HIGHLIGHT_CYCLE[i % HIGHLIGHT_CYCLE.length];
		for (const n of lv) {
			const q = posToPixel(n.x, n.y);
			ctx.save();
			ctx.globalAlpha = 0.8 * pulse;
			ctx.strokeStyle = color; ctx.lineWidth = 3;
			ctx.shadowColor = color; ctx.shadowBlur = 8;
			roundRectPath(q.x - s / 2, q.y - s / 2, s, s, s * 0.2);
			ctx.stroke();
			ctx.restore();
			drawText(String(i + 1), q.x - s / 2 + 8, q.y - s / 2 + 8, { size: 11, weight: "bold", align: "center", baseline: "middle", color: "#fff", stroke: "rgba(0,0,0,0.6)", strokeWidth: 3 });
		}
	});
	levels.forEach((lv, i) => lv.forEach((n) => {
		if (!n.from) return;
		const a = posToPixel(n.from.x, n.from.y), b = posToPixel(n.x, n.y);
		drawLinkArrow(a.x, a.y, b.x, b.y, "#fff6c8", 0.85 * pulse, 3);
	}));
	const q = posToPixel(hoverCell.x, hoverCell.y);
	const label = t("previewFmt")(levels.length) + (levels.length >= 4 ? " ★" : "");
	const bw = 74, bh = 20;
	const bx = clamp(q.x - bw / 2, 4, W - bw - 4), by = Math.max(q.y - CELL / 2 - bh - 2, 2);
	fillRoundRect(bx, by, bw, bh, 10, "rgba(20,10,40,0.85)");
	drawText(label, bx + bw / 2, by + bh / 2 + 1, { size: 12, weight: "bold", align: "center", baseline: "middle", color: "#ffe680" });
}
/* ---- ルール欄（絵だけ）と、最初の数手のガイド ---- */
function fitSmallText(text, maxWidth, size, weight) {
	ctx.save();
	while (size > 8) {
		ctx.font = `${weight || ""} ${size}px ${FONT_STACK}`.trim();
		if (ctx.measureText(text).width <= maxWidth) break;
		size -= 1;
	}
	ctx.restore();
	return size;
}
function drawRuleCaption(text, cx, y) {
	const size = fitSmallText(text, 108, 11, "bold");
	drawText(text, cx, y, { size, weight: "bold", align: "center", baseline: "middle", color: "#e8dcff" });
}
// じゃんけんの3すくみ：矢印の先（負ける側）が消える。三角形に並べる
function drawRuleTriangle(cx, cy) {
	const s = 22;
	const pts = { gu: { x: cx, y: cy - 15 }, ch: { x: cx + 24, y: cy + 11 }, pa: { x: cx - 24, y: cy + 11 } };
	const order = ["gu", "ch", "pa"];
	ctx.fillStyle = "#ffd166";
	for (let i = 0; i < 3; i++) {
		const a = pts[order[i]], b = pts[order[(i + 1) % 3]];
		const ang = Math.atan2(b.y - a.y, b.x - a.x);
		ctx.save();
		ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(a.x + Math.cos(ang) * 13, a.y + Math.sin(ang) * 13);
		ctx.lineTo(b.x - Math.cos(ang) * 17, b.y - Math.sin(ang) * 17);
		ctx.stroke();
		ctx.restore();
		drawTriangleArrow(b.x - Math.cos(ang) * 16, b.y - Math.sin(ang) * 16, 4.5, ang);
	}
	order.forEach((k) => drawResultTile(k, pts[k].x, pts[k].y, s));
}
function drawRuleBan(cx, cy) {
	const s = 16;
	[-1, 0, 1].forEach((i) => drawResultTile("enemy", cx + i * (s + 3), cy, s));
	ctx.save();
	ctx.strokeStyle = "#ff4d4d"; ctx.lineWidth = 3;
	ctx.beginPath(); ctx.arc(cx, cy, s * 1.62, 0, Math.PI * 2); ctx.stroke();
	ctx.beginPath(); ctx.moveTo(cx - s * 1.15, cy - s * 1.15); ctx.lineTo(cx + s * 1.15, cy + s * 1.15); ctx.stroke();
	ctx.restore();
}
// 特殊マスのアイコン（ストック枠・ドラッグ表示用）。💣以外は★マスに向きの矢印を付ける
function drawSpecialIcon(type, x, y, size) {
	if (type === "bomb") { drawResultTile("bomb", x, y, size); return; }
	drawResultTile("star", x, y, size);
	ctx.save();
	ctx.fillStyle = "#ff8c00";
	const a = size * 0.16, o = size * 0.36;
	if (type === "h" || type === "cross") { drawTriangleArrow(x - o, y, a, Math.PI); drawTriangleArrow(x + o, y, a, 0); }
	if (type === "v" || type === "cross") { drawTriangleArrow(x, y - o, a, -Math.PI / 2); drawTriangleArrow(x, y + o, a, Math.PI / 2); }
	ctx.restore();
}
function drawStockSlot(nowMs) {
	const r = STOCK_SLOT, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
	const pulse = 0.5 + 0.5 * Math.sin(nowMs / 200);
	ctx.save();
	roundRectPath(r.x, r.y, r.w, r.h, 12);
	ctx.fillStyle = stock ? "rgba(255,230,160,0.18)" : "rgba(255,255,255,0.06)"; ctx.fill();
	ctx.lineWidth = stockAim ? 3 : 2;
	ctx.strokeStyle = stockAim ? `rgba(255,214,90,${0.6 + 0.4 * pulse})` : stock ? "rgba(255,214,90,0.85)" : "rgba(255,255,255,0.35)";
	if (!stock) ctx.setLineDash([5, 4]);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.restore();
	if (stock) {
		ctx.save();
		if (stockAim) { ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 8 + 8 * pulse; }
		drawSpecialIcon(stock, cx, cy, 34 + (stockAim ? 3 * pulse : 0));
		ctx.restore();
	} else {
		drawText("+", cx, cy + 1, { size: 24, weight: "bold", align: "center", baseline: "middle", color: "rgba(255,255,255,0.45)" });
	}
	drawRuleCaption(stockAim ? t("stockAim") : stock ? t("stockFilled") : t("stockEmpty"), 300, H - 8);
}
function drawRuleBox() {
	const y = H - RULE_BOX_H;
	ctx.save();
	ctx.fillStyle = "rgba(255,255,255,0.1)";
	ctx.fillRect(0, y, W, RULE_BOX_H);
	ctx.strokeStyle = "rgba(255,255,255,0.18)";
	ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
	ctx.fillStyle = "rgba(255,255,255,0.12)";
	ctx.fillRect(W / 3, y + 8, 1, RULE_BOX_H - 16); ctx.fillRect(W * 2 / 3, y + 8, 1, RULE_BOX_H - 16);
	ctx.restore();
	const cy = y + 29;
	drawRuleTriangle(60, cy);
	drawRuleBan(180, cy);
	drawRuleCaption(t("ruleLink"), 60, y + RULE_BOX_H - 8);
	drawRuleCaption(t("ruleBan"), 180, y + RULE_BOX_H - 8);
	drawStockSlot(performance.now());
}

// 吹き出しは盤面に重ねず、下のルール欄の中（ストック枠の左）に出して、対象マスまで曲線でつなぐ
// 吹き出しの点滅：1.3秒表示→0.5秒消える（消えている間は下のマスが見える）
function guideBubbleAlpha(nowMs) {
	const T = nowMs % 1800;
	if (T < 1300) return clamp(T / 150, 0, 1) * clamp((1300 - T) / 150, 0, 1);
	return 0;
}
const GUIDE_BOX = { x: 8, y: H - RULE_BOX_H + 5, w: STOCK_SLOT.x - 8 - 14, h: RULE_BOX_H - 10 };
let guideBubbleReq = null; // drawGuides で決めて、ルール欄を描いたあとに drawGuideBubble で描く
function requestGuideBubble(targetX, targetY, lines) { guideBubbleReq = { targetX, targetY, lines }; }
function drawGuideBubble(nowMs) {
	const req = guideBubbleReq;
	if (!req) return;
	const alpha = guideBubbleAlpha(nowMs);
	if (alpha <= 0.01) return;
	const b = GUIDE_BOX;
	ctx.save();
	ctx.globalAlpha = alpha;
	if (req.targetY > H - RULE_BOX_H) drawGuidePointerRight(b, req.targetY); // ストック枠：右へ三角
	else drawGuideCurve(b, req.targetX, req.targetY);
	ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8;
	ctx.fillStyle = "#fff6e0";
	roundRectPath(b.x, b.y, b.w, b.h, 12); ctx.fill();
	ctx.restore();
	ctx.save();
	ctx.globalAlpha = alpha;
	const two = req.lines.length > 1;
	drawText(req.lines[0], b.x + b.w / 2, b.y + (two ? 19 : b.h / 2 + 1), { size: 15, weight: "bold", align: "center", baseline: "middle", color: "#5a2a00" });
	if (two) {
		let size = 11;
		ctx.font = `${size}px ${FONT_STACK}`;
		while (size > 8 && ctx.measureText(req.lines[1]).width > b.w - 16) { size -= 0.5; ctx.font = `${size}px ${FONT_STACK}`; }
		drawText(req.lines[1], b.x + b.w / 2, b.y + 41, { size, align: "center", baseline: "middle", color: "#7a4a10" });
	}
	ctx.restore();
}
function drawGuidePointerRight(b, targetY) {
	const tipX = STOCK_SLOT.x - 3;
	ctx.fillStyle = "#fff6e0";
	ctx.beginPath(); ctx.moveTo(b.x + b.w - 1, targetY - 9); ctx.lineTo(tipX, targetY); ctx.lineTo(b.x + b.w - 1, targetY + 9); ctx.closePath(); ctx.fill();
}
// 吹き出しの上端から対象マスの下端まで、点線の曲線＋矢印
function drawGuideCurve(b, tx, ty) {
	const sx = clamp(tx, b.x + 24, b.x + b.w - 24), sy = b.y + 2;
	const ex = tx, ey = ty + CELL * 0.42;
	const side = tx < W / 2 ? 1 : -1;
	const cx = (sx + ex) / 2 + side * 46, cy = (sy + ey) / 2;
	ctx.lineCap = "round";
	for (const [col, lw, dash] of [["rgba(40,16,70,0.9)", 6, []], ["#fff6e0", 3, [7, 6]]]) {
		ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = lw;
		ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
	}
	ctx.setLineDash([]);
	ctx.save();
	ctx.fillStyle = "#fff6e0"; ctx.strokeStyle = "rgba(40,16,70,0.9)"; ctx.lineWidth = 2;
	ctx.translate(ex, ey); ctx.rotate(Math.atan2(ey - cy, ex - cx));
	ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-9, 7); ctx.lineTo(-9, -7); ctx.closePath(); ctx.stroke(); ctx.fill();
	ctx.restore();
}

// ガイドの表示済み記録。ページを開くたびに最初から表示する（保存はしない）
const guideSeen = { tap: false, enemy: false, stock: false };
function guideIsDone(key) { return guideSeen[key]; }
function guideMarkDone(key) { guideSeen[key] = true; }
let guideTapTarget = null;   // 最初のタップを促すマス
let guideEnemyTarget = null; // 最初の敵を説明するマス
function pickGuideTapTarget() {
	let best = null;
	for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
		const p = grid[x][y];
		if (!p || p.type === "enemy" || isSpecialType(p.type)) continue;
		const n = computeChainLevels(x, y, p.type).length;
		if (!best || n > best.n) best = { x, y, n };
	}
	return best;
}
function updateGuides() {
	if (titleScreen || busy || gameOver || clearPopup) return;
	if (!guideIsDone("tap")) {
		if (!guideTapTarget || !grid[guideTapTarget.x]?.[guideTapTarget.y]) guideTapTarget = pickGuideTapTarget();
		return;
	}
	guideTapTarget = null;
	// 最初にストックへ特殊マスが入ったら、「いつでも使える」ことを案内（枠を触るまで表示）
	guideStockActive = !!stock && !guideIsDone("stock") && !guideEnemyTarget;
	if (!guideIsDone("enemy") && !guideEnemyTarget) {
		for (let y = 0; y < ROWS && !guideEnemyTarget; y++) for (let x = 0; x < COLS; x++) {
			if (grid[x][y] && grid[x][y].type === "enemy") { guideEnemyTarget = { x, y }; break; }
		}
	}
}
function dismissGuidesOnTap() {
	if (guideTapTarget) { guideMarkDone("tap"); guideTapTarget = null; }
	else if (guideEnemyTarget) { guideMarkDone("enemy"); guideEnemyTarget = null; }
	else if (guideStockActive) { guideMarkDone("stock"); guideStockActive = false; } // ストック案内も次に盤面をタップしたら終わり
}
function drawGuides(nowMs) {
	guideBubbleReq = null;
	if (titleScreen || busy || gameOver || clearPopup) return;
	const pulse = 0.6 + 0.4 * Math.sin(nowMs / 150);
	if (guideTapTarget) {
		const { x: gx, y: gy } = guideTapTarget;
		const piece = grid[gx]?.[gy];
		if (!piece) return;
		if (!previewCell()) {
			computeChainLevels(gx, gy, piece.type).forEach((lv, i) => lv.forEach((n) => {
				const q = posToPixel(n.x, n.y), c = HIGHLIGHT_CYCLE[i % HIGHLIGHT_CYCLE.length];
				ctx.save();
				ctx.globalAlpha = 0.5 * pulse; ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.shadowColor = c; ctx.shadowBlur = 8;
				roundRectPath(q.x - CELL * 0.45, q.y - CELL * 0.45, CELL * 0.9, CELL * 0.9, CELL * 0.18); ctx.stroke();
				ctx.restore();
			}));
		}
		const p = posToPixel(gx, gy);
		ctx.save();
		ctx.globalAlpha = 0.9; ctx.strokeStyle = "#ffe680"; ctx.lineWidth = 4; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 14;
		ctx.beginPath(); ctx.arc(p.x, p.y, CELL * 0.5 + 4 * pulse, 0, Math.PI * 2); ctx.stroke();
		ctx.restore();
		drawEmoji("👆", p.x + 8, p.y + CELL * 0.62 + Math.abs(Math.sin(nowMs / 260)) * 8, 28);
		requestGuideBubble(p.x, p.y, [t("guideTap"), t("guideTapHold")]);
	} else if (guideEnemyTarget) {
		const { x: gx, y: gy } = guideEnemyTarget;
		const piece = grid[gx]?.[gy];
		if (!piece || piece.type !== "enemy") { guideEnemyTarget = null; return; }
		const p = posToPixel(gx, gy);
		ctx.save();
		ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.strokeStyle = "#ff4d4d"; ctx.lineWidth = 4; ctx.shadowColor = "#ff4d4d"; ctx.shadowBlur = 14;
		roundRectPath(p.x - CELL * 0.5, p.y - CELL * 0.5, CELL, CELL, CELL * 0.22); ctx.stroke();
		ctx.restore();
		requestGuideBubble(p.x, p.y, [t("guideEnemy1")]);
	} else if (guideStockActive && stock) {
		const q = { x: STOCK_SLOT.x + STOCK_SLOT.w / 2, y: STOCK_SLOT.y + STOCK_SLOT.h / 2 };
		ctx.save();
		ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 3.5; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 12;
		roundRectPath(STOCK_SLOT.x - 3, STOCK_SLOT.y - 3, STOCK_SLOT.w + 6, STOCK_SLOT.h + 6, 14); ctx.stroke();
		ctx.restore();
		requestGuideBubble(q.x, q.y, [t("guideStock1"), t("guideStock2")]);
	}
}
const RESULT_BTN_AGE = 1500; // リトライボタンが出て押せるようになるまでの時間(ms)
function drawGameOverOverlay() {
	const age = resultState.age;
	if (resultState.isKing) {
		// 100を超えてのゲームオーバー：クリア画面と同じ見た目（続きはないのでリトライのみ）
		drawClearScene({
			target: Math.floor(resultState.totalSnap / 100) * 100, totalSnap: resultState.totalSnap, scoreSnap: resultState.scoreSnap,
			enemiesSnap: resultState.enemiesSnap, comboSnap: resultState.comboSnap, rec: resultState.rec,
		}, age, 1, true);
		return;
	}
	ctx.save();
	ctx.fillStyle = "rgba(21,10,46,0.8)"; ctx.fillRect(0, 0, W, H);

	drawClearTitle(age, W / 2, 56, 34, t("resultTitle"), true);
	drawClearTiles(age, W / 2, 152, 62, 76, 450, true);
	drawText(t("clearTotalLabel"), W / 2, 214, { size: 13, weight: "bold", align: "center", baseline: "middle", color: "#ffe9a8" });
	drawClearBigNumber(age, W / 2, 262, 80, 900, resultState.totalSnap, true);
	if (age >= 1500) drawText(`${t("scoreLabel")}  ${resultState.scoreSnap}`, W / 2, 314, { size: 14, weight: "bold", align: "center", baseline: "middle", color: "#ffd166", stroke: "rgba(20,8,40,0.85)", strokeWidth: 4, alpha: clamp((age - 1500) / 300, 0, 1) });

	// ひとことコメント
	const msgAlpha = clamp((age - 1800) / 600, 0, 1);
	drawWrappedCentered(t("resultMessages")[resultState.msgIdx], W / 2, 364, W - 50, { size: 15, color: "#ffe9a8", stroke: "rgba(20,8,40,0.8)", strokeWidth: 3, alpha: msgAlpha });

	drawRecordLine(age, W / 2, 332, resultState.rec, 1700);
	drawClearChip(age, W / 2 - 80, 408, "enemy", t("clearEnemyLabel"), resultState.enemiesSnap, 1300);
	drawClearChip(age, W / 2 + 80, 408, "star", t("clearComboLabel"), resultState.comboSnap, 1500, resultState.rec && resultState.rec.flags.combo);

	const ba = clamp((age - RESULT_BTN_AGE) / 300, 0, 1);
	if (ba > 0) drawClearButton(BTN_RETRY, t("retryBtn"), "#ffd166", "#ff8a3d", ba);

	ctx.restore();
}
/* ---- クリア演出（ステージ型）---- */
const CLEAR_BTN_AGE = 1800; // ボタンが出て押せるようになるまでの時間(ms)
const TILE_COLORS = { gu: "#ff6b6b", ch: "#5be6a0", pa: "#5bb8ff" };
const CONFETTI_COLORS = ["#ff6b6b", "#5be6a0", "#5bb8ff", "#ffd166", "#ff9f6b", "#c77dff"];
function hash01(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

function drawEmoji(s, x, y, size) {
	ctx.save();
	ctx.font = `${size}px ${FONT_STACK}`;
	ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; // 文字形で描かれる環境でも黒地に埋もれないように
	ctx.fillText(s, x, y);
	ctx.restore();
}
// ゲーム内のマスと同じ見た目のタイル（kind: gu/ch/pa/enemy/star）
function drawResultTile(kind, x, y, s, rot) {
	const h = s / 2;
	ctx.save();
	ctx.translate(x, y);
	if (rot) ctx.rotate(rot);
	if (kind === "enemy") {
		ctx.save();
		ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
		roundRectPath(-h, -h, s, s, s * 0.22); ctx.fillStyle = "#161018"; ctx.fill();
		ctx.restore();
		ctx.save();
		roundRectPath(-h, -h, s, s, s * 0.22); ctx.clip();
		fillDiagonalStripes(h, "#ffd23f", "#161018", s * 0.16);
		ctx.restore();
		const ins = s * 0.16;
		roundRectPath(-h + ins, -h + ins, s - ins * 2, s - ins * 2, s * 0.14); ctx.fillStyle = "#161018"; ctx.fill();
		drawEmoji(PIECE_ICONS.enemy, 0, s * 0.02, s * 0.4);
	} else if (kind === "bomb") {
		ctx.save();
		ctx.shadowColor = "rgba(255,200,0,0.8)"; ctx.shadowBlur = 8;
		roundRectPath(-h, -h, s, s, s * 0.22); ctx.fillStyle = "#fff6e0"; ctx.fill();
		ctx.restore();
		roundRectPath(-h + 2, -h + 2, s - 4, s - 4, s * 0.18); ctx.strokeStyle = "rgba(255,160,0,0.9)"; ctx.lineWidth = 2; ctx.stroke();
		ctx.fillStyle = "rgba(255,140,0,0.4)";
		for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
			if (!i && !j) continue;
			ctx.beginPath(); ctx.arc(i * h * 0.62, j * h * 0.62, s * 0.06, 0, Math.PI * 2); ctx.fill();
		}
		drawEmoji(PIECE_ICONS.bomb, 0, s * 0.04, s * 0.4);
	} else if (kind === "star") {
		ctx.save();
		ctx.shadowColor = "rgba(255,200,0,0.9)"; ctx.shadowBlur = 10;
		roundRectPath(-h, -h, s, s, s * 0.22); ctx.fillStyle = "#fff6e0"; ctx.fill();
		ctx.restore();
		ctx.save();
		roundRectPath(-h, -h, s, s, s * 0.22); ctx.clip();
		ctx.strokeStyle = "rgba(255,160,0,0.35)"; ctx.lineWidth = 2;
		for (let ly = -h + 6; ly < h; ly += 9) { ctx.beginPath(); ctx.moveTo(-h, ly); ctx.lineTo(h, ly); ctx.stroke(); }
		ctx.restore();
		roundRectPath(-h + 2, -h + 2, s - 4, s - 4, s * 0.18); ctx.strokeStyle = "rgba(255,160,0,0.9)"; ctx.lineWidth = 2.5; ctx.stroke();
		drawText("★", 0, s * 0.03, { size: s * 0.5, weight: "bold", align: "center", baseline: "middle", color: "#ff9d1e" });
	} else {
		ctx.save();
		ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
		roundRectPath(-h, -h, s, s, s * 0.22); ctx.fillStyle = TILE_COLORS[kind]; ctx.fill();
		ctx.restore();
		roundRectPath(-h + 2, -h + 2, s - 4, s - 4, s * 0.18); ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();
		drawEmoji(PIECE_ICONS[kind], 0, s * 0.04, s * 0.5);
	}
	ctx.restore();
}
function drawCrown(x, y, sc) {
	ctx.save();
	ctx.translate(x, y); ctx.scale(sc, sc);
	ctx.shadowColor = "rgba(255,200,0,0.8)"; ctx.shadowBlur = 12;
	const g = ctx.createLinearGradient(0, -26, 0, 18);
	g.addColorStop(0, "#ffe680"); g.addColorStop(1, "#ff9d1e");
	ctx.fillStyle = g; ctx.strokeStyle = "#a35c00"; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
	ctx.beginPath();
	ctx.moveTo(-34, 18); ctx.lineTo(-38, -18); ctx.lineTo(-18, -2); ctx.lineTo(0, -26); ctx.lineTo(18, -2); ctx.lineTo(38, -18); ctx.lineTo(34, 18);
	ctx.closePath(); ctx.fill(); ctx.stroke();
	ctx.shadowBlur = 0;
	[[-38, -18], [0, -26], [38, -18]].forEach(([px, py], i) => {
		ctx.fillStyle = ["#ff6b6b", "#5bb8ff", "#5be6a0"][i];
		ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
	});
	ctx.fillStyle = "#fff6c8"; roundRectPath(-26, 8, 52, 6, 3); ctx.fill();
	ctx.restore();
}
function drawClearRays(age, cy) {
	ctx.save();
	ctx.translate(W / 2, cy); ctx.rotate(age * 0.00035);
	for (let i = 0; i < 14; i++) {
		ctx.rotate(Math.PI * 2 / 14);
		const g = ctx.createLinearGradient(0, 0, 420, 0);
		g.addColorStop(0, "rgba(255,214,90,0.38)"); g.addColorStop(1, "rgba(255,214,90,0)");
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(420, -26); ctx.lineTo(420, 26); ctx.closePath(); ctx.fill();
	}
	ctx.restore();
}
function drawClearFireworks(age) {
	const T = age % 7000;
	for (let i = 0; i < 9; i++) {
		const bt = T - (300 + i * 620);
		if (bt < 0 || bt > 1200) continue;
		const cx = 40 + hash01(i * 3 + 1) * (W - 80), cy = 40 + hash01(i * 3 + 2) * 130;
		const col = CONFETTI_COLORS[i % CONFETTI_COLORS.length], k = bt / 1200, e = easeOutQuad(k);
		for (let j = 0; j < 16; j++) {
			const a = Math.PI * 2 * j / 16, R = 40 + hash01(i * 20 + j) * 22;
			ctx.save();
			ctx.globalAlpha = 1 - k; ctx.fillStyle = j % 3 ? col : "#fff6d0"; ctx.shadowColor = col; ctx.shadowBlur = 8;
			drawStarShape(cx + Math.cos(a) * R * e, cy + Math.sin(a) * R * e + k * k * 24, 4 * (1 - k * 0.5), 1.9, 4, k * 4);
			ctx.fill();
			ctx.restore();
		}
	}
}
function drawClearConfetti(age) {
	if (age < 250) return;
	const tt = age - 250;
	for (let i = 0; i < 46; i++) {
		const sp = 0.05 + hash01(i) * 0.07, x0 = hash01(i + 50) * W;
		const y = ((tt * sp + hash01(i + 9) * H) % (H + 60)) - 30;
		ctx.save();
		ctx.translate(x0 + Math.sin(tt / 400 + i) * 14, y);
		ctx.rotate(tt * (0.004 + hash01(i + 3) * 0.006) + i);
		ctx.scale(1, Math.cos(tt / 180 + i));
		ctx.fillStyle = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
		ctx.fillRect(-4, -2.5, 8, 5);
		ctx.restore();
	}
}
function drawClearTitle(age, x, y, size, text, calm) {
	const s = text || t("clearTitle");
	ctx.save(); ctx.font = `bold ${size}px ${FONT_STACK}`;
	const ws = [...s].map((ch) => ctx.measureText(ch).width);
	ctx.restore();
	const tw = ws.reduce((a, b) => a + b, 0);
	let px = x - tw / 2;
	[...s].forEach((ch, i) => {
		const bt = (age - 300 - i * 70) / 420;
		if (bt >= 0 && calm) {
			drawText(ch, px + ws[i] / 2, y, { size, weight: "bold", align: "center", baseline: "middle", color: "#ffe9a8", stroke: "rgba(20,8,40,0.9)", strokeWidth: 5, alpha: clamp(bt * 1.5, 0, 1), inherit: true });
		} else if (bt >= 0) {
			const dy = bt < 1 ? -18 * Math.sin(Math.PI * bt) : -2.5 * Math.sin(age / 260 + i * 0.6);
			ctx.save();
			ctx.shadowColor = "rgba(255,180,0,0.8)"; ctx.shadowBlur = 12;
			drawText(ch, px + ws[i] / 2, y + dy, { size, weight: "bold", align: "center", baseline: "middle", color: "#fff6c8", stroke: "#d96a00", strokeWidth: 6, inherit: true });
			ctx.restore();
		}
		px += ws[i];
	});
}
function drawClearTiles(age, cx, cy, size, gap, start, calm) {
	const crowns = !calm;
	["gu", "ch", "pa"].forEach((kind, i) => {
		const st = start + i * 140, pk = clamp((age - st) / 450, 0, 1);
		if (age < st) return;
		const hop = (!calm && pk >= 1) ? -Math.abs(Math.sin(age / 230 + i * 1.3)) * 10 : 0;
		const sc = calm ? lerp(0.85, 1, easeOutQuad(pk)) : easeBackOut(pk) * (1 + 0.06 * Math.sin(age / 120 + i));
		const x = cx + (i - 1) * gap, y = cy + hop;
		ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
		if (calm) ctx.globalAlpha = easeOutQuad(pk);
		drawResultTile(kind, 0, 0, size, calm ? 0 : Math.sin(age / 300 + i) * 0.1);
		ctx.restore();
		const ck = clamp((age - st - 350) / 650, 0, 1);
		if (crowns && ck > 0) {
			const tilt = (i - 1) * 0.18 + Math.sin(age / 300 + i) * 0.05;
			ctx.save();
			ctx.translate(x, y + lerp(-90, -size * 0.5 - 4, easeBounceOut(ck))); ctx.rotate(tilt);
			drawCrown(0, 0, size / 118 * 0.95 * lerp(1.5, 1, easeOutQuad(ck)));
			ctx.restore();
		}
	});
}
function drawClearBigNumber(age, x, y, size, start, value, calm) {
	if (age < start) return;
	const v = Math.round(value * easeOutQuad(clamp((age - start) / 900, 0, 1)));
	const pk = (age - start - 900) / 300;
	const sc = !calm && pk > 0 && pk < 1 ? 1 + 0.3 * Math.sin(Math.PI * pk) : 1;
	ctx.save();
	ctx.translate(x, y); ctx.scale(sc, sc);
	ctx.font = `bold ${size}px ${FONT_STACK}`;
	const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
	g.addColorStop(0, "#fff6c8"); g.addColorStop(1, "#ff9d1e");
	ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
	ctx.lineWidth = 8; ctx.strokeStyle = calm ? "#4a3a5a" : "#7a3a00"; ctx.shadowColor = "rgba(255,190,0,0.9)"; ctx.shadowBlur = calm ? 0 : 14;
	ctx.strokeText(String(v), 0, 0);
	ctx.shadowBlur = 0; ctx.fillStyle = g; ctx.fillText(String(v), 0, 0);
	ctx.restore();
}
// 「NEW!」バッジ（自己ベスト更新）
function drawNewBadge(x, y, age) {
	const pulse = 0.5 + 0.5 * Math.sin(age / 140);
	ctx.save();
	ctx.translate(x, y); ctx.scale(1 + 0.06 * pulse, 1 + 0.06 * pulse);
	fillRoundRect(-22, -9, 44, 18, 9, "#ff4d4d");
	roundRectPath(-22, -9, 44, 18, 9); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
	drawText("NEW!", 0, 1, { size: 11, weight: "bold", align: "center", baseline: "middle", color: "#fff" });
	ctx.restore();
}
// SCOREの下：自己ベスト更新なら「NEW RECORD!」、そうでなければ BEST の値
function drawRecordLine(age, cx, y, rec, startAge) {
	if (!rec || age < startAge) return;
	const a = clamp((age - startAge) / 300, 0, 1);
	if (rec.flags.score) {
		const pulse = 0.5 + 0.5 * Math.sin(age / 130);
		ctx.save();
		ctx.globalAlpha = a; ctx.shadowColor = "#ff9d1e"; ctx.shadowBlur = 8 + 6 * pulse;
		drawText("★ " + t("newRecord") + " ★", cx, y, { size: 13, weight: "bold", align: "center", baseline: "middle", color: "#fff6c8", stroke: "#a35c00", strokeWidth: 4 });
		ctx.restore();
	} else if (rec.best.score > 0) {
		drawText(`${t("bestLabel")}  ${rec.best.score}`, cx, y, { size: 11, align: "center", baseline: "middle", color: "#bda8e8", alpha: a });
	}
}
function drawClearChip(age, x, y, kind, label, value, start, isNew) {
	if (age < start) return;
	const k = clamp((age - start) / 400, 0, 1), e = easeBackOut(k);
	const v = Math.round(value * easeOutQuad(clamp((age - start) / 700, 0, 1)));
	ctx.save();
	ctx.translate(x, y); ctx.scale(e, e);
	fillRoundRect(-74, -30, 148, 60, 16, "rgba(255,255,255,0.12)");
	roundRectPath(-74, -30, 148, 60, 16); ctx.strokeStyle = "rgba(255,214,90,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
	drawResultTile(kind, -44, 0, 40);
	drawText("×" + v, 22, -5, { size: 26, weight: "bold", align: "center", baseline: "middle", color: "#ffffff", stroke: "#3a1a4a", strokeWidth: 4 });
	drawText(label, 22, 19, { size: 10, align: "center", baseline: "middle", color: "#ffe9a8" });
	if (isNew && age - start > 700) drawNewBadge(66, -28, age);
	ctx.restore();
}
function drawClearButton(rect, label, c1, c2, alpha) {
	const g = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
	g.addColorStop(0, c1); g.addColorStop(1, c2);
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
	roundRectPath(rect.x, rect.y, rect.w, rect.h, rect.h / 2); ctx.fillStyle = g; ctx.fill();
	ctx.restore();
	ctx.save();
	ctx.globalAlpha = alpha;
	roundRectPath(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, rect.h / 2 - 2); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
	drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, { size: 15, weight: "bold", align: "center", baseline: "middle", color: "#ffffff", stroke: "rgba(0,0,0,0.25)", strokeWidth: 3, inherit: true });
	ctx.restore();
}
// over=true は「続きがない」版（ゲームオーバー時にクリア済みだった場合）：リトライだけ表示
function drawClearScene(src, age, bgAlpha, over) {
	ctx.save();
	ctx.globalAlpha = bgAlpha;
	ctx.fillStyle = "rgba(21,10,46,0.8)"; ctx.fillRect(0, 0, W, H);

	drawClearRays(age, 250);
	drawClearFireworks(age);
	drawClearTitle(age, W / 2, 56, 34);
	drawWrappedCentered(t("clearMsgFmt")(src.target), W / 2, 96, W - 40, { size: 14, color: "#ffe9a8", stroke: "rgba(20,8,40,0.8)", strokeWidth: 3 });
	drawClearTiles(age, W / 2, 182, 70, 82, 450);
	drawText(t("clearTotalLabel"), W / 2, 238, { size: 13, weight: "bold", align: "center", baseline: "middle", color: "#ffe9a8" });
	drawClearBigNumber(age, W / 2, 288, 92, 900, src.totalSnap);
	if (age >= 1500) drawText(`${t("scoreLabel")}  ${src.scoreSnap}`, W / 2, 346, { size: 16, weight: "bold", align: "center", baseline: "middle", color: "#ffd166", stroke: "rgba(20,8,40,0.85)", strokeWidth: 4, alpha: clamp((age - 1500) / 300, 0, 1) });
	drawRecordLine(age, W / 2, 364, src.rec, 1700);
	drawClearChip(age, W / 2 - 80, 396, "enemy", t("clearEnemyLabel"), src.enemiesSnap, 1700);
	drawClearChip(age, W / 2 + 80, 396, "star", t("clearComboLabel"), src.comboSnap, 1900, src.rec && src.rec.flags.combo);
	const ba = clamp((age - CLEAR_BTN_AGE) / 300, 0, 1);
	if (ba > 0 && over) {
		drawClearButton(BTN_RETRY, t("retryBtn"), "#ffd166", "#ff8a3d", ba);
	} else if (ba > 0) {
		const rects = clearPopupButtonRects();
		drawClearButton(rects.continueBtn, t("continueBtn"), "#7be07f", "#2f9e44", ba);
		drawClearButton(rects.restartBtn, t("restartBtn"), "#ff9d6b", "#e8433b", ba);
	}
	// 数字が出きった瞬間のフラッシュ
	const fk = (age - 1900) / 600;
	if (fk >= 0 && fk <= 1) {
		ctx.save(); ctx.globalAlpha = bgAlpha * (1 - fk) * 0.3; ctx.fillStyle = "#fff6c8"; ctx.fillRect(0, 0, W, H); ctx.restore();
		for (let j = 0; j < 14; j++) {
			const a = Math.PI * 2 * j / 14, e = easeOutQuad(fk);
			ctx.save(); ctx.globalAlpha = bgAlpha * (1 - fk); ctx.fillStyle = CONFETTI_COLORS[j % CONFETTI_COLORS.length];
			drawStarShape(W / 2 + Math.cos(a) * (30 + e * 120), 292 + Math.sin(a) * (24 + e * 80), 5, 2.2, 4, fk * 5); ctx.fill(); ctx.restore();
		}
	}
	drawClearConfetti(age);
	ctx.restore();
}
function drawClearPopup() {
	if (!clearPopup) return;
	const bgAlpha = clearPopup.closing ? clamp(1 - clearPopup.closeAge / 400, 0, 1) : 1;
	drawClearScene(clearPopup, clearPopup.age, bgAlpha, false);
}

function draw(nowMs) {
	ctx.clearRect(0, 0, W, H);
	ctx.save();
	if (shake) {
		const k = 1 - shake.age / shake.dur;
		ctx.translate((Math.random() - 0.5) * 2 * shake.amp * k, (Math.random() - 0.5) * 2 * shake.amp * k);
	}
	const bg = ctx.createLinearGradient(0, 0, 0, H);
	bg.addColorStop(0, BG_TOP); bg.addColorStop(1, BG_BOTTOM);
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, W, H);

	drawBackdrop(nowMs);
	drawColumnWarnings(nowMs);
	drawBoard();
	drawChainPreview(nowMs);
	drawGuides(nowMs);
	drawHighlights();
	drawEffects(effects.filter((e) => !e.fly));
	drawStars();
	drawDangerVignette(nowMs);
	if (screenFlash) {
		ctx.save();
		ctx.globalAlpha = screenFlash.alpha * (1 - screenFlash.age / screenFlash.dur);
		ctx.fillStyle = screenFlash.color;
		ctx.fillRect(-10, -10, W + 20, H + 20);
		ctx.restore();
	}
	drawTopBar(nowMs);
	drawScoreHud();
	drawRuleBox();
	drawLangButton();
	drawSoundButton();
	drawGuideBubble(nowMs);
	drawFlyingTexts();

	if (gameOver && resultState.age >= 0) drawGameOverOverlay();
	else if (gameOver) drawOverAlert(nowMs);
	if (clearPopup) drawClearPopup();
	ctx.restore();
	drawTitleScreen(nowMs);
}

/* ==================== 入力 ==================== */
document.title = t("pageTitle");
document.addEventListener("langchange", () => { document.title = t("pageTitle"); });

function getCanvasCoords(e) {
	const rect = canvas.getBoundingClientRect();
	const scaleX = W / rect.width;
	const scaleY = H / rect.height;
	return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}
function pixelToGrid(px, py) {
	const gx = Math.floor((px - OFFSET_X) / CELL);
	const gy = Math.floor((py - OFFSET_Y) / CELL);
	if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return null;
	return { x: gx, y: gy };
}

canvas.addEventListener("pointerdown", (e) => {
	e.preventDefault();
	const { x, y } = getCanvasCoords(e);
	Sound.unlock(); // 最初のタップで音を使えるようにする（ブラウザの仕様）
	if (titleScreen) {
		if (titleLeave) return;
		if (hitTestBtn(BTN_LANG, x, y)) { setLang(lang === "ja" ? "en" : "ja"); return; }
		if (hitTestBtn(TITLE_BTN_ON, x, y)) startGameFromTitle(true);
		else if (hitTestBtn(TITLE_BTN_OFF, x, y)) startGameFromTitle(false);
		return;
	}
	if (hitTestBtn(BTN_LANG, x, y)) { setLang(lang === "ja" ? "en" : "ja"); Sound.play("ui"); return; }
	if (hitTestBtn(BTN_SOUND, x, y)) { setSoundOn(!Sound.enabled); return; }
	if (clearPopup) {
		if (!clearPopup.closing && clearPopup.age >= CLEAR_BTN_AGE) {
			const rects = clearPopupButtonRects();
			if (hitTestBtn(rects.continueBtn, x, y)) { Sound.play("ui"); clearPopup.closing = true; clearPopup.closeAge = 0; clearPopup.pendingRestart = false; return; }
			if (hitTestBtn(rects.restartBtn, x, y)) { Sound.play("ui"); clearPopup.closing = true; clearPopup.closeAge = 0; clearPopup.pendingRestart = true; return; }
		}
		return;
	}
	if (gameOver) {
		if (resultState && resultState.age >= (resultState.isKing ? CLEAR_BTN_AGE : RESULT_BTN_AGE) && hitTestBtn(BTN_RETRY, x, y)) { Sound.play("ui"); resetGame(); }
		return;
	}
	if (hitTestBtn(STOCK_HIT, x, y)) { handleStockSlotTap(); return; }
	const g = pixelToGrid(x, y);
	if (!g) return;
	// 押している間は連鎖プレビュー、離した時点で発動（マウスもタッチも同じ）。盤面外へずらして離すとキャンセル。
	press = { id: e.pointerId, cell: g, t0: performance.now() };
	try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
}, { passive: false });
canvas.addEventListener("pointermove", (e) => {
	const { x, y } = getCanvasCoords(e);
	if (e.pointerType === "mouse") hoverCell = pixelToGrid(x, y);
	if (press && press.id === e.pointerId) press.cell = pixelToGrid(x, y);
});
function endPress(e, fire) {
	if (!press || press.id !== e.pointerId) return;
	const pr = press;
	press = null;
	if (!fire) return;
	if (pr.cell) { if (stockAim) useStockAt(pr.cell.x, pr.cell.y); else handlePieceTap(pr.cell.x, pr.cell.y); }
}
canvas.addEventListener("pointerup", (e) => endPress(e, true));
canvas.addEventListener("pointercancel", (e) => endPress(e, false));
canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hoverCell = null; });
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); }, { passive: false });

/* ==================== メインループ ==================== */
let lastTime = performance.now();
function frame(now) {
	const rawMs = now - lastTime;
	lastTime = now;
	const deltaMs = Math.min(rawMs, 250);
	update(deltaMs);
	draw(now);
	requestAnimationFrame(frame);
}

initGrid();
requestAnimationFrame(frame);
