"use strict";

/* ==================== 基本設定 ==================== */
const W = 360, H = 548, GRID = 32;
// 打った瞬間の真のヒットストップ（フレーム数）
const IMPACT_STOP_FRAMES = 3;
// ホームランの瞬間はもう少し長くヒットストップ
const HOMERUN_IMPACT_STOP_FRAMES = 10;
// ホームラン時に広がる光の輪の演出時間（フレーム数）
const HOMERUN_RING_FRAMES = 28;
// 5円玉を打ってしまった時のペナルティ点
const GOEN_PENALTY = 30;
// ヒットゾーン（上端〜ホームラン帯〜下端）。中心はホームラン判定の中心。
const ZONE_CENTER = 440;
const ZONE_HR_LOW = ZONE_CENTER - 3;
const ZONE_HR_HIGH = ZONE_CENTER + 3;
const ZONE_TOP = ZONE_CENTER - 24;
const ZONE_BOTTOM = ZONE_CENTER + 24;
const ZONE_UPPER_SPAN = ZONE_HR_LOW - ZONE_TOP;
const ZONE_LOWER_SPAN = ZONE_BOTTOM - ZONE_HR_HIGH;
const ZONE_X = GRID * 4.5, ZONE_W = GRID * 2.25;
const ZONE_CX = ZONE_X + ZONE_W / 2;
// ボール/5円玉の当たり判定用の半径（一部でも重なっていればヒットとみなす）
const OBJ_HALF = 32;
// ホームラン判定だけは緩和幅を狭くする（OBJ_HALFのままだとヒットゾーン全体より広くなり出やすすぎるため）
const HR_OBJ_HALF = 8;
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
// スコア表示などで使う金色グラデーション
const GOLD_GRADIENT = ["#fff6c8", "#ffc107"];
// 球速がこの値を超えると炎のオーラをまとう（ストレートは赤、変化球は球種色、打ち返し後も速度次第で発動）
const FAST_BALL_THRESHOLD = 7;
// 「さいごの一球」用にゲーム画面から切り出す範囲（バット～ヒットゾーン周辺が収まる帯）
const MISS_CROP_X = 0, MISS_CROP_Y = 330, MISS_CROP_W = 360, MISS_CROP_H = 140;
// ナックル球はスコアがこの値を超えてから混ざり始める
const KNUCKLE_UNLOCK_SCORE = 1200;
// レア5円玉（金色）の抽選確率（%）とボーナス/ペナルティ倍率
const RARE_GOEN_CHANCE = 12;
const RARE_GOEN_BONUS_MULT = 5;
const RARE_GOEN_PENALTY_MULT = 3;
// 球種ごとの見た目（常時まとうオーラ色とボールの色味）
const BALL_TYPE_STYLE = {
	straight: null,
	curve: { aura: "70,170,255", tint: "rgba(70,170,255,0.4)" },
	shoot: { aura: "140,225,90", tint: "rgba(140,225,90,0.4)" },
	knuckle: { aura: "215,110,240", tint: "rgba(215,110,240,0.42)" },
};

/* ==================== 通知バナー ==================== */
const NOTIFY_LIFE = 64;
const NOTIFY_Y = GRID * 2.7;
const NOTIFY_GAP = 40;
const NOTIFY_STYLES = {
	hit: { accent: "#7ee787", confetti: ["#7ee787", "#c8ffb0", "#ffffff"], size: 20 },
	homerun: { accent: "#ffd23f", confetti: ["#ffd23f", "#ff9f43", "#ff6b6b", "#ffffff"], size: 27, big: true },
	osaisen: { accent: "#ffd23f", confetti: ["#ffd23f", "#fff3b0"], size: 20 },
	bonus: { accent: "#ff9f43", confetti: ["#ff9f43", "#ffd23f", "#ffffff"], size: 22 },
	penalty: { accent: "#ff6b6b", size: 20 },
	rareBonus: { accent: "#ffe066", confetti: ["#ffe066", "#fff3b0", "#ffd700", "#ffffff"], size: 26, big: true },
};
// 花吹雪（良いことが起きた時にパネルの周りに散らす紙吹雪パーティクル）
function spawnConfetti(s, x, y, colors) {
	for (let i = 0; i < 22; i++) {
		s.confetti.push({
			x, y,
			vx: (Math.random() - 0.5) * 7,
			vy: -Math.random() * 4.5 - 2,
			rot: Math.random() * Math.PI * 2,
			vrot: (Math.random() - 0.5) * 0.5,
			color: colors[Math.floor(Math.random() * colors.length)],
			size: 6 + Math.random() * 6,
			age: 0,
			life: 40 + Math.random() * 24,
		});
	}
}

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
	const [ball, ssn, goen, bat, hako, box] = await Promise.all([
		loadImage("ball.png"),
		loadImage("box.png"),
		loadImage("goen.png"),
		loadImage("bat.png"),
		loadImage("bonus.png"),
		loadImage("kusa.png"),
	]);
	IMG.ball = ball; IMG.ssn = ssn; IMG.goen = goen; IMG.bat = bat; IMG.hako = hako; IMG.box = box;
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
	ctx.save();
	ctx.globalAlpha = s.alpha;
	ctx.translate(s.x, s.y);
	ctx.rotate(s.rotation);
	ctx.scale(s.scaleX, s.scaleY);
	const w = s.img.width, h = s.img.height;
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

/* ボールのオーラ：変化球は常時その球種色の円形オーラをまとう。ストレートは球速がしきい値を超えた時だけ赤くオーラをまとう
 * （遅いストレートはオーラなし）。さらに球速が速いときは、進行方向の逆側にオーラと同じ色の炎の尾を引かせる。
 * 打ち返した後もこの判定はそのまま効くので、ヒットの瞬間に球種色が消えても速度が出ていれば炎で賑やかになる。 */
function drawBallAura(x, y, vx, vy, rgb, age) {
	const speed = Math.abs(vy);
	const isFast = speed >= FAST_BALL_THRESHOLD;
	const color = rgb || (isFast ? "255,50,20" : null);
	if (!color) return;
	const pulse = 0.75 + 0.25 * Math.sin(age * 0.25);
	const radius = Math.min(45 + speed * 6, 100);
	ctx.save();
	const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
	grad.addColorStop(0, `rgba(${color},${0.55 * pulse})`);
	grad.addColorStop(0.6, `rgba(${color},${0.3 * pulse})`);
	grad.addColorStop(1, `rgba(${color},0)`);
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
	if (isFast) drawFireTrail(x, y, vx, vy, color, speed);
}

/* 進行方向の後方にギザギザの炎を引かせる（速球・打ち返し後の高速球を賑やかに見せる演出） */
function drawFireTrail(x, y, vx, vy, rgb, speed) {
	const angle = Math.atan2(vy, vx || 0.0001);
	const len = Math.min(30 + speed * 9, 150);
	const baseWidth = 18;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	const grad = ctx.createLinearGradient(0, 0, -len, 0);
	grad.addColorStop(0, `rgba(${rgb},0.85)`);
	grad.addColorStop(0.45, `rgba(${rgb},0.5)`);
	grad.addColorStop(1, `rgba(${rgb},0)`);
	ctx.fillStyle = grad;
	const segs = 4;
	ctx.beginPath();
	ctx.moveTo(0, -baseWidth / 2);
	for (let i = 1; i <= segs; i++) {
		const t = i / segs;
		const wobble = i % 2 === 0 ? 0.4 : 1;
		ctx.lineTo(-len * t, (-baseWidth / 2) * (1 - t * 0.7) * wobble);
	}
	ctx.lineTo(-len, 0);
	for (let i = segs; i >= 1; i--) {
		const t = i / segs;
		const wobble = i % 2 === 0 ? 0.4 : 1;
		ctx.lineTo(-len * t, (baseWidth / 2) * (1 - t * 0.7) * wobble);
	}
	ctx.closePath();
	ctx.fill();
	// 炎の芯の明るい部分
	ctx.fillStyle = "rgba(255,255,210,0.5)";
	ctx.beginPath();
	ctx.ellipse(-len * 0.28, 0, len * 0.3, baseWidth * 0.22, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/* レア5円玉の常時金色オーラ＋キラキラ（5円玉本体(表示直径96px)より一回り大きく広げて確実に目立たせる） */
function drawRareGoenAura(x, y, age) {
	const pulse = 0.65 + 0.35 * Math.sin(age * 0.25);
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	// 5円玉の絵からはみ出す大きな金色オーラ（外周ほど広がる二重グラデーション）
	const outerR = 85;
	const grad = ctx.createRadialGradient(x, y, 0, x, y, outerR);
	grad.addColorStop(0, `rgba(255,240,150,${0.35 * pulse})`);
	grad.addColorStop(0.55, `rgba(255,210,60,${0.55 * pulse})`);
	grad.addColorStop(0.8, `rgba(255,180,20,${0.4 * pulse})`);
	grad.addColorStop(1, "rgba(255,180,20,0)");
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.arc(x, y, outerR, 0, Math.PI * 2);
	ctx.fill();

	// リング状に輝く縁取り（金色5円玉であることをさらに強調）
	ctx.strokeStyle = `rgba(255,255,210,${0.5 * pulse})`;
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.arc(x, y, 52 + 4 * Math.sin(age * 0.2), 0, Math.PI * 2);
	ctx.stroke();

	// 周囲を回るキラキラ粒子（星形の光点が5円玉の外側を大きく回りながら明滅）
	const sparkleCount = 8;
	for (let i = 0; i < sparkleCount; i++) {
		const a = age * 0.05 + (i / sparkleCount) * Math.PI * 2;
		const r = 62 + 14 * Math.sin(age * 0.09 + i * 1.3);
		const sx = x + Math.cos(a) * r;
		const sy = y + Math.sin(a) * r;
		const blink = 0.5 + 0.5 * Math.sin(age * 0.35 + i * 1.7);
		if (blink < 0.3) continue;
		const sSize = 5 + blink * 6;
		ctx.save();
		ctx.translate(sx, sy);
		ctx.rotate(age * 0.06 + i);
		ctx.fillStyle = `rgba(255,255,255,${blink})`;
		ctx.beginPath();
		ctx.moveTo(0, -sSize); ctx.lineTo(sSize * 0.3, -sSize * 0.3);
		ctx.lineTo(sSize, 0); ctx.lineTo(sSize * 0.3, sSize * 0.3);
		ctx.lineTo(0, sSize); ctx.lineTo(-sSize * 0.3, sSize * 0.3);
		ctx.lineTo(-sSize, 0); ctx.lineTo(-sSize * 0.3, -sSize * 0.3);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
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
			ctx.fillStyle = "rgba(0,0,0,0.45)";
			ctx.fillText(line, x + 2, ly + 2);
		}
		if (opts.strokeWidth && opts.stroke) {
			ctx.lineWidth = opts.strokeWidth;
			ctx.strokeStyle = opts.stroke;
			ctx.lineJoin = "round";
			ctx.strokeText(line, x, ly);
		}
		if (opts.gradient) {
			const gh = opts.gradHeight || size;
			const grad = ctx.createLinearGradient(0, ly - gh, 0, ly);
			grad.addColorStop(0, opts.gradient[0]);
			grad.addColorStop(1, opts.gradient[1]);
			ctx.fillStyle = grad;
		} else {
			ctx.fillStyle = opts.color || "#fff";
		}
		ctx.fillText(line, x, ly);
	});
	ctx.restore();
}

/* 御利益Pスコア表示：ラベル・数値・単位（英語版のみ）を実測幅に基づいて動的に並べる。
 * 英語版はラベルが日本語より長くなりがちで、固定位置だと数値やお賽銭コンボと重なってしまうため。 */
function drawScoreDisplay(x, y, score) {
	const label = t("scoreLabel");
	const suffix = t("scoreSuffix") || "";
	const scoreText = String(Math.trunc(score));
	ctx.save();
	ctx.font = "bold 24px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif";
	const labelWidth = ctx.measureText(label).width;
	ctx.font = "bold 32px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif";
	const scoreWidth = ctx.measureText(scoreText).width;
	ctx.restore();

	drawText(label, x, y, { size: 24, weight: "bold", gradient: GOLD_GRADIENT, gradHeight: 20, stroke: "#000", strokeWidth: 3, shadow: true });
	const scoreX = x + labelWidth + 8;
	drawText(scoreText, scoreX, y + 4, { size: 32, weight: "bold", gradient: GOLD_GRADIENT, gradHeight: 28, stroke: "#000", strokeWidth: 3, shadow: true });
	if (suffix) {
		drawText(suffix, scoreX + scoreWidth + 4, y, { size: 15, weight: "bold", color: "#fff6c8", stroke: "#000", strokeWidth: 2, shadow: true });
	}
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
	while (size > 16) {
		ctx.font = `${weight || ""} ${size}px Arial, sans-serif`.trim();
		if (ctx.measureText(text).width <= maxWidth) break;
		size -= 2;
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
function strokeRoundRect(x, y, w, h, r, color, width) {
	ctx.save();
	roundRectPath(x, y, w, h, r);
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.stroke();
	ctx.restore();
}
function drawCrossMark(cx, cy, r, color) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 6;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
	ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
	ctx.stroke();
	ctx.restore();
}
function drawCircleMark(cx, cy, r, color) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う。 */
const BTN_LANG = { x: 258, y: 12, w: 94, h: 34 };
const BTN_START = { x: 11, y: 449, w: 338, h: 82 };
const BTN_RETRY = { x: 11, y: 493, w: 338, h: 52 };
const BTN_TIPS_PREV = { x: 23, y: 402, w: 29, h: 36 };
const BTN_TIPS_NEXT = { x: 308, y: 402, w: 29, h: 36 };

function hitTestBtn(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function drawButton(rect, label, opts) {
	opts = opts || {};
	fillRoundRect(rect.x, rect.y, rect.w, rect.h, opts.radius || 8, opts.bg || "rgba(0,0,0,0.6)");
	if (label) {
		drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
			size: opts.size || 16, weight: "bold", align: "center", baseline: "middle",
			color: opts.color || "#fff", shadow: opts.shadow, stroke: opts.stroke, strokeWidth: opts.strokeWidth,
		});
	}
}

function drawTriangleBtn(rect, dir, opts) {
	opts = opts || {};
	fillRoundRect(rect.x, rect.y, rect.w, rect.h, opts.radius || 6, opts.bg || "rgba(163,18,28,0.85)");
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
	drawButton(BTN_LANG, t("langBtn"), { bg: "rgba(0,0,0,0.6)", size: 13, color: "#fff" });
}

/* 正規分布っぽい乱数（元のscript.jsのrnorm()を移植） */
function rnorm() {
	const z0 = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
	const normalizedValue = (1 + z0) / 2;
	return Math.min(Math.max(normalizedValue, 0), 1);
}

/* ==================== シーン管理・UI ==================== */
let scene = "title"; // "title" | "game" | "result"
let gameState = null;
let resultState = null;
// リザルト画面の背景に薄く映す、ゲーム終了時点の画面キャプチャ
let lastGameSnapshot = null;
// リザルト画面で「最後の一球」を再現するための情報（最後にヒットゾーンへ入った時の位置など）
let lastMissSnapshot = null;
function captureCanvasSnapshot() {
	const snap = document.createElement("canvas");
	snap.width = W; snap.height = H;
	snap.getContext("2d").drawImage(canvas, 0, 0);
	return snap;
}
function captureSnapshot() {
	lastGameSnapshot = captureCanvasSnapshot();
}

document.title = t("pageTitle");
document.addEventListener("langchange", () => { document.title = t("pageTitle"); });

function goToTitle() {
	scene = "title";
	gameState = null;
	resultState = null;
}
function startGame() {
	scene = "game";
	gameState = createGameState();
	resultState = null;
}
function goToResult(finalScore) {
	scene = "result";
	resultState = createResultState(finalScore);
}

/* ポインタ座標をcanvasの内部解像度(W×H)基準に変換してヒット判定する */
function getCanvasCoords(e) {
	const rect = canvas.getBoundingClientRect();
	const scaleX = W / rect.width;
	const scaleY = H / rect.height;
	return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

canvas.addEventListener("pointerdown", (e) => {
	e.preventDefault();
	const { x, y } = getCanvasCoords(e);
	if (hitTestBtn(BTN_LANG, x, y)) {
		setLang(lang === "ja" ? "en" : "ja");
		return;
	}
	if (scene === "title") {
		if (hitTestBtn(BTN_START, x, y)) startGame();
	} else if (scene === "game" && gameState) {
		gameState.onTap();
	} else if (scene === "result" && resultState) {
		if (hitTestBtn(BTN_RETRY, x, y)) startGame();
		else if (hitTestBtn(BTN_TIPS_PREV, x, y)) resultState.prevTip();
		else if (hitTestBtn(BTN_TIPS_NEXT, x, y)) resultState.nextTip();
	}
});

/* ==================== タイトル画面 ==================== */
function drawRuleCard(cx, cy, img, ok, label) {
	const boxW = 134, boxH = 130;
	const bg = ok ? "rgba(222,255,226,0.92)" : "rgba(255,222,222,0.92)";
	const line = ok ? "#2fae4a" : "#e0323f";
	fillRoundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 10, bg);
	strokeRoundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 10, line, 3);

	drawSprite(makeSprite(img, { x: cx, y: cy - 16, anchorX: 0.5, anchorY: 0.5, scaleX: 3.2, scaleY: 3.2 }));
	if (ok) {
		drawCircleMark(cx, cy - 16, 32, "#2fae4a");
	} else {
		drawCrossMark(cx, cy - 16, 28, "#e0323f");
	}
	drawText(label, cx, cy + 36, {
		size: 12, weight: "bold", align: "center", color: ok ? "#1c7a34" : "#a3121c", lineHeight: 15,
	});
}

/* ロゴに重ねる賑やかしイラスト（賽銭箱・5円玉・スイング中のバットにボールが当たる瞬間） */
function drawLogoDecor() {
	// ロゴを横切る黄色い帯（ロゴっぽい装飾）
	ctx.save();
	ctx.translate(W / 2, 50);
	ctx.fillStyle = "#ffe066";
	ctx.fillRect(-200, -28, 270, 24);
	ctx.fillRect(-160, 0, 270, 24);
	ctx.restore();

	drawSprite(makeSprite(IMG.ssn, { x: 208, y: 30, anchorX: 0.5, anchorY: 0.5, scaleX: 0.55, scaleY: 0.7, rotation: 0 }));
	drawSprite(makeSprite(IMG.goen, { x: 210, y: 22, anchorX: 0.5, anchorY: 0.5, scaleX: 1.1, scaleY: 1.1, rotation: 0.5 }));
	drawSprite(makeSprite(IMG.bat, { x: 200, y: 56, anchorX: 0, anchorY: 0.5, scaleX: 1.9, scaleY: 1.9, rotation: 0.3 }));
	drawSprite(makeSprite(IMG.ball, { x: 210, y: 48, anchorX: 0.5, anchorY: 0.5, scaleX: 1.1, scaleY: 1.1, rotation: 0.4 }));
}

function drawTitleScene() {
	ctx.clearRect(0, 0, W, H);
	ctx.save();
	ctx.fillStyle = "#eef0fb";
	ctx.fillRect(0, 0, W, H);
	ctx.restore();

	// 鳥居の背景画像をリザルト画面と同じ調子で薄く表示する
	drawSprite(makeSprite(IMG.box, { x: 0, y: H - 120 * 4, scaleX: 4, scaleY: 4, alpha: 0.3 }));

	drawLogoDecor();
	drawText(t("titleLogoLine1") + "\n" + t("titleLogoLine2"), 24, 34, {
		size: 23, weight: "bold", align: "left", lineHeight: 29,
		gradient: ["#ffff99", "#ff3333"], gradHeight: 25,
		stroke: "#000", strokeWidth: 5, shadow: true,
	});

	// あそびかたエリアを枠で囲む
	const ruleBoxX = 12, ruleBoxY = 94, ruleBoxW = W - 24, ruleBoxH = 204;
	fillRoundRect(ruleBoxX, ruleBoxY, ruleBoxW, ruleBoxH, 12, "rgba(255,255,255,0.75)");
	strokeRoundRect(ruleBoxX, ruleBoxY, ruleBoxW, ruleBoxH, 12, "#cc0000", 3);

	drawText(t("ruleHeading"), W / 2, ruleBoxY + 22, {
		size: 16, weight: "bold", align: "center", color: "#a3121c",
	});
	drawText(t("tapHint"), W / 2, ruleBoxY + 44, {
		size: 12, weight: "bold", align: "center", color: "#333",
	});

	drawRuleCard(GRID * 2.8 +10, ruleBoxY + 124, IMG.goen, false, t("ruleNgLabel"));
	drawRuleCard(GRID * 8.4 -10, ruleBoxY + 124, IMG.ball, true, t("ruleOkLabel"));

	const introWrapped = wrapText(t("intro"), W - 36, 16, "bold");
	drawText(introWrapped, 18, ruleBoxY + ruleBoxH + 28, {
		size: 16, weight: "bold", lineHeight: 20, color: "#111",
	});

	drawButton(BTN_START, t("startBtn"), { bg: "rgba(204,0,0,0.88)", size: 29, color: "#fff", shadow: true, radius: 10 });
	drawLangButton();
}

/* ==================== ゲーム画面 ==================== */
const HAKO_INIT = [
	{ x: GRID * 1, y: GRID * 6, moveyBase: GRID * 6, movexBase: GRID * 1, moveyDir0: 1, movexDir0: 1, rotDir0: 1, flg: true, ballThreshold: -40 },
	// 内側の箱は打球が届きにくい高さにあるため、当たり判定を大きく緩和して狙いやすくする
	{ x: GRID * 3, y: GRID * 4, moveyBase: GRID * 4, movexBase: GRID * 3, moveyDir0: 1, movexDir0: 1, rotDir0: -1, flg: false, ballThreshold: 10 },
	{ x: GRID * 8, y: GRID * 4, moveyBase: GRID * 4, movexBase: GRID * 8, moveyDir0: -1, movexDir0: 1, rotDir0: 1, flg: false, ballThreshold: 10 },
	{ x: GRID * 10, y: GRID * 6, moveyBase: GRID * 6, movexBase: GRID * 10, moveyDir0: -1, movexDir0: 1, rotDir0: -1, flg: true, ballThreshold: -40 },
];
const HAKO_POP_POS = [
	{ x: GRID * 1, y: GRID * 6 },
	{ x: GRID * 3, y: GRID * 4 },
	{ x: GRID * 8, y: GRID * 4 },
	{ x: GRID * 10, y: GRID * 6 },
];

function createGameState() {
	const s = {
		score: 5,
		scoreup: 5,
		ballVx: 0,
		ballVy: 0,
		hitvalue: 12,
		goenbonus: 0,
		goenbonus_max: 0,
		hmrcount: 0,
		random: 2,
		count: 0,
		apr_flg: false,
		apr_value: 0,
		prob_g: 60,
		curve: 10,
		ballType: "straight", // "straight" | "curve" | "shoot" | "knuckle"
		knucklePhase: 0,
		isRareGoen: false,
		goenPenalized: false,
		frameTick: 0,
		hitflg: 0,
		flg_return: false,
		flg_homerun: false,
		angleRotation: 1,
		swing: false,
		swingTimer: -1,
		impactStop: 0,
		notifications: [],
		confetti: [],
		popNotify: null,
		homerunRingEffect: 0,
		homerunRingX: 0,
		homerunRingY: 0,
		homerunBonusTimer: -1,
		ended: false,
		// リザルト画面で「なぜ終わったか」を再現するための記録
		lastZoneSnapshot: null, // ゾーンの下端をはみ出た瞬間（見逃し確定）のゲーム画面（見逃し時の表示用）
		zoneExitCaptured: false, // 今の球について「ゾーンをはみ出た瞬間」を既に撮ったか
		pitchSwung: false, // 今の球に対して一度でもタップしたか
		pitchTapSnapshot: null, // 今の球に対して最後にタップした瞬間のゲーム画面
	};

	/* イベント演出を画面上部の通知バナーに統一して表示する */
	function pushNotification(text, kind) {
		const idx = s.notifications.length;
		s.notifications.push({ text, kind, age: 0, life: NOTIFY_LIFE });
		if (s.notifications.length > 3) s.notifications.shift();
		const style = NOTIFY_STYLES[kind];
		if (style && style.confetti) {
			spawnConfetti(s, W / 2, NOTIFY_Y + idx * NOTIFY_GAP, style.confetti);
		}
	}

	s.ball = makeSprite(IMG.ball, { x: -50, y: -50, anchorX: 0.5, anchorY: 0.5, scaleX: 4, scaleY: 4 });
	s.goen = makeSprite(IMG.goen, { x: -50, y: -50, anchorX: 0.5, anchorY: 0.5, scaleX: 4, scaleY: 4 });
	s.bat = makeSprite(IMG.bat, { x: ZONE_CX - 96, y: ZONE_CENTER, anchorX: 0, anchorY: 1, scaleX: 6, scaleY: 6, rotation: 3 });
	s.bg = makeSprite(IMG.box, { x: 0, y: H - IMG.box.height * 4, scaleX: 4, scaleY: 4, alpha: 0.55 });

	s.hako = HAKO_INIT.map((init) => ({
		flg: init.flg,
		x: init.x, y: init.y,
		moveyBase: init.moveyBase, movexBase: init.movexBase,
		moveyDir: init.moveyDir0 * 0.25,
		movexDir: init.movexDir0 * 0.125,
		rotDir: init.rotDir0 * 0.01,
		rotation: 0,
		hit: 0, hitcount: 0,
		ballThreshold: init.ballThreshold,
		sprite: makeSprite(IMG.hako, { anchorX: 0.5, anchorY: 0.5, scaleX: 4, scaleY: 4 }),
	}));

	/* スコアに応じて難易度を上げる係数（速度の緩急・回転の強さの上限） */
	function difficultyFactor() {
		return Math.min(1 + s.scoreup / 1500, 2.2);
	}

	/* ---- 5円玉/ボールの出現 ---- */
	function odemashi() {
		const kuji = Math.floor(Math.random() * 99);
		const dbg = s.scoreup / 1000;
		const diff = difficultyFactor();
		// 新しい球が出るたびに「さいごの一球」用の記録をリセットする
		s.lastZoneSnapshot = null;
		s.zoneExitCaptured = false;
		s.pitchSwung = false;
		s.pitchTapSnapshot = null;
		s.goenPenalized = false;
		if (kuji >= s.prob_g) {
			s.apr_value = 1;
			s.goen.x = 178; s.goen.y = 16;
			s.ballVx = 0;
			s.ballVy = (rnorm() - 0.5) * 6 + 1 + (rnorm() * dbg - dbg / 3);
			if (s.ballVy < 0.2) s.ballVy *= 1.5;
			// たまに金色に光るレア5円玉（見逃すと連続コンボ扱いで大ボーナス、打つと重いペナルティ）
			s.isRareGoen = Math.random() * 100 < RARE_GOEN_CHANCE;
		} else {
			s.apr_value = 2;
			s.ball.x = 178; s.ball.y = 16;
			s.ballVx = 0;
			s.knucklePhase = 0;
			if (s.score > 3000) s.curve = 40;
			else if (s.score > 2500) s.curve = 35;
			else if (s.score > 2000) s.curve = 30;
			else if (s.score > 1500) s.curve = 25;
			else if (s.score > 1000) s.curve = 20;
			else if (s.score > 500) s.curve = 15;

			// 球種抽選：終盤だけナックルが混ざり、残りをカーブ／シュートで山分けする
			const knuckleChance = s.score > KNUCKLE_UNLOCK_SCORE ? 8 : 0;
			const roll = Math.random() * 100;
			if (roll < knuckleChance) {
				s.ballType = "knuckle";
				s.ballVy = (rnorm() * 9 - 3) * diff + (rnorm() * dbg - dbg / 4);
			} else if (roll < knuckleChance + s.curve / 2) {
				s.ballType = "curve";
				s.ballVy = ((rnorm() - 0.5) * 6 + 1) * diff + (rnorm() * dbg - dbg / 3);
			} else if (roll < knuckleChance + s.curve) {
				s.ballType = "shoot";
				s.ballVy = ((rnorm() - 0.5) * 6 + 1) * diff + (rnorm() * dbg - dbg / 3);
			} else {
				s.ballType = "straight";
				s.ballVy = (rnorm() * 9 - 3) * diff + (rnorm() * dbg - dbg / 4);
			}
		}
	}

	/* ---- ボーナス箱のランダム出現 ---- */
	function hakopop() {
		const num = Math.floor(Math.random() * 4);
		const h = s.hako[num];
		if (!h.flg) {
			h.flg = true;
			h.rotation = 0;
			h.x = HAKO_POP_POS[num].x;
			h.y = HAKO_POP_POS[num].y;
			// 点数系の通知バナーとは別に、出現した箱の位置に吹き出しでポップさせる
			s.popNotify = { text: t("bonusAppear"), x: h.x, y: h.y, age: 0, life: 50 };
		}
	}

	/* ---- ヒットゾーン/ボーナス箱との当たり判定 ----
	 * ボール/5円玉の矩形（中心±OBJ_HALF）がヒットゾーンの各区画に少しでも
	 * 重なっていればヒットとみなす。ホームラン帯が一番狭いので優先判定する。 */
	function classifyHit(y) {
		if (y + HR_OBJ_HALF >= ZONE_HR_LOW && y - HR_OBJ_HALF < ZONE_HR_HIGH) return 2;
		if (y + OBJ_HALF >= ZONE_TOP && y - OBJ_HALF < ZONE_HR_LOW) return 1;
		if (y + OBJ_HALF >= ZONE_HR_HIGH && y - OBJ_HALF < ZONE_BOTTOM) return 3;
		return 0;
	}

	function hitcheck() {
		if (s.apr_value <= 1) {
			const goen = s.goen;
			const flg = classifyHit(goen.y);
			s.hitflg = flg;
			if (flg === 1) {
				goen.tint = "rgba(255,60,60,0.45)";
				if (s.ballVy > 0) s.angleRotation = 0.95 + 0.62 * clamp01((goen.y - ZONE_TOP) / ZONE_UPPER_SPAN);
			} else if (flg === 2) {
				goen.tint = "rgba(255,60,60,0.45)";
				if (s.ballVy > 0) s.angleRotation = 1.57;
			} else if (flg === 3) {
				goen.tint = "rgba(255,60,60,0.45)";
				if (s.ballVy > 0) s.angleRotation = 1.57 + 0.6 * clamp01((goen.y - ZONE_HR_HIGH) / ZONE_LOWER_SPAN);
			} else {
				if (s.flg_return && goen.y >= GRID * 2 && goen.y <= GRID * 8) {
					checkHakoHit(goen);
				}
				goen.tint = null;
			}
		} else {
			const ball = s.ball;
			const flg = classifyHit(ball.y);
			s.hitflg = flg;
			if (flg !== 0) s.ballType = "straight";
			// リザルトで「なぜ終わったか」を再現できるよう、ボールの中心がヒットゾーンの下端を
			// 視覚的にはみ出た瞬間（見逃し確定）だけ1回撮る（当たり判定の緩和分は無視し、見た目基準で判定）
			if (!s.zoneExitCaptured && ball.y > ZONE_BOTTOM && !s.flg_return) {
				s.lastZoneSnapshot = captureCanvasSnapshot();
				s.zoneExitCaptured = true;
			}
			if (flg === 1) {
				ball.tint = "rgba(255,60,60,0.45)";
				if (s.ballVy > 0) s.angleRotation = 0.75 + 0.82 * clamp01((ball.y - ZONE_TOP) / ZONE_UPPER_SPAN);
			} else if (flg === 2) {
				ball.tint = "rgba(255,60,60,0.45)";
				if (s.ballVy > 0) s.angleRotation = 1.57;
			} else if (flg === 3) {
				ball.tint = "rgba(255,60,60,0.45)";
				if (s.ballVy > 0) s.angleRotation = 1.57 + 0.82 * clamp01((ball.y - ZONE_HR_HIGH) / ZONE_LOWER_SPAN);
			} else {
				if (s.flg_return && ball.y >= GRID * 4 && ball.y <= GRID * 8) {
					checkHakoHit(ball);
				}
				const style = BALL_TYPE_STYLE[s.ballType];
				ball.tint = style ? style.tint : null;
			}
		}
	}

	function checkHakoHit(obj) {
		const objWidth = obj.img.width * obj.scaleX;
		s.hako.forEach((h) => {
			if (!h.flg || h.hit) return;
			const hakoWidth = h.sprite.img.width * h.sprite.scaleX;
			const threshold = s.apr_value <= 1 ? -60 : h.ballThreshold;
			const dist2 = (h.x - obj.x) ** 2 + (h.y - obj.y) ** 2;
			if (dist2 <= (hakoWidth + objWidth + threshold) ** 2) {
				h.hit = 1;
				h.hitcount = s.hitvalue;
			}
		});
	}

	/* ---- 落下・移動処理（ヒットストップ修正版） ---- */
	function rakka() {
		s.ballVy += 0.1;

		// バットのスイング演出は物理更新と独立させる
		if (s.swingTimer >= 0) {
			if (s.swingTimer === 0) {
				s.swing = false;
				s.bat.rotation = 3;
			} else {
				s.bat.rotation -= 0.3925;
			}
			s.swingTimer -= 1;
		}

		if (s.apr_value <= 1) {
			const goen = s.goen;
			goen.rotation += 0.05;
			if (s.impactStop > 0) {
				s.impactStop -= 1;
				return;
			}
			goen.x += s.ballVx;
			goen.y += s.ballVy;

			if (goen.y >= 548) {
				if (goen.x > 0 && goen.x < 360) {
					s.goenbonus += 1;
					if (s.goenbonus % 5 === 0) hakopop();
					if (s.goenbonus > s.goenbonus_max) s.goenbonus_max = s.goenbonus;
					const baseGain = 50 + 10 * Math.floor(s.goenbonus / 5);
					if (s.isRareGoen) {
						const gain = baseGain * RARE_GOEN_BONUS_MULT;
						s.scoreup += gain;
						pushNotification(t("rareGoenBonusFmt")(gain), "rareBonus");
					} else {
						s.scoreup += baseGain;
						pushNotification(t("osaisenFmt")(baseGain), "osaisen");
					}
				}
				resetBall("goen");
			} else if (goen.y < -255) {
				resetBall("goen");
			} else if (goen.x < -16 || goen.x > 360 + 16) {
				resetBall("goen");
			}
		} else {
			const ball = s.ball;
			const rotDiff = difficultyFactor();
			if (s.ballType === "curve") ball.rotation -= 0.15 * rotDiff;
			else if (s.ballType === "shoot") ball.rotation += 0.15 * rotDiff;
			else if (s.ballType === "knuckle") ball.rotation += 0.03 * rotDiff;
			else ball.rotation += 0.05 * rotDiff;
			if (s.impactStop > 0) {
				s.impactStop -= 1;
				return;
			}
			if (s.ballType === "curve") {
				ball.x += s.ballVx + s.curve / 100;
			} else if (s.ballType === "shoot") {
				ball.x += s.ballVx - s.curve / 100;
			} else if (s.ballType === "knuckle") {
				s.knucklePhase += 0.16;
				ball.x += s.ballVx + Math.sin(s.knucklePhase) * 1.6;
			} else {
				ball.x += s.ballVx;
			}
			ball.y += s.ballVy;

			if (ball.y >= 548) {
				s.score = s.scoreup;
				s.ended = true;
				s.goenbonus_max = Math.max(s.goenbonus_max, s.goenbonus);
				lastMissSnapshot = {
					swung: s.pitchSwung,
					// 見逃し：ボールがゾーンを通過していた瞬間の画面／空振り：最後にタップした瞬間の画面
					snapshot: s.pitchSwung ? s.pitchTapSnapshot : s.lastZoneSnapshot,
				};
				draw();
				captureSnapshot();
				goToResult(s.score);
			} else if (ball.y < -255) {
				finishBallFlight();
			} else if (ball.x < -80 || ball.x > 360 + 80) {
				s.scoreup += 10;
				pushNotification(t("hitFmt")(10), "hit");
				s.flg_return = false;
				s.flg_homerun = false;
				resetBall("ball");
			}
		}
	}

	function finishBallFlight() {
		if (s.flg_homerun) {
			s.scoreup += 100;
			pushNotification(t("homerunFmt")(100), "homerun");
			s.hmrcount += 1;
			s.homerunBonusTimer = 40;
		} else {
			s.scoreup += 10;
			pushNotification(t("hitFmt")(10), "hit");
		}
		s.flg_return = false;
		s.flg_homerun = false;
		resetBall("ball");
	}

	function resetBall(which) {
		const obj = which === "goen" ? s.goen : s.ball;
		obj.x = -50; obj.y = -50;
		s.ballVx = 0; s.ballVy = 0;
		s.apr_value = 0;
		s.apr_flg = false;
		s.flg_return = false;
		s.flg_homerun = false;
		s.ballType = "straight";
		s.isRareGoen = false;
	}

	/* ---- 毎フレーム処理 ---- */
	function gameLoop() {
		s.frameTick++;
		if (s.score < s.scoreup) {
			if (s.scoreup - s.score > 50) s.score += 4;
			else if (s.scoreup - s.score > 10) s.score += 2;
			else s.score += 1;
		} else if (s.score > s.scoreup) {
			if (s.score - s.scoreup > 50) s.score -= 4;
			else if (s.score - s.scoreup > 10) s.score -= 2;
			else s.score -= 1;
			if (s.score < s.scoreup) s.score = s.scoreup;
		}

		if (s.apr_flg) {
			s.hako.forEach((h) => {
				if (h.hit !== 1) return;
				h.rotation += h === s.hako[3] ? 0.4 : -0.4;
				if (h.hitcount > 0) {
					h.sprite.scaleX -= 0.05; h.sprite.scaleY -= 0.05;
					h.y += s.ballVy * 0.8 - 2;
					h.x += h === s.hako[3] ? 3 : -3;
					h.hitcount -= 1;
				} else {
					s.scoreup += 250;
					pushNotification(t("bonusGetFmt")(250), "bonus");
					h.y = -100;
					h.hit = 0;
					h.flg = false;
					h.sprite.scaleX = 4; h.sprite.scaleY = 4;
				}
			});
		} else {
			s.count++;
			if (s.count >= s.random * 60) {
				s.count = 0;
				s.random = 0.2;
				s.apr_flg = true;
				odemashi();
			}
		}

		rakka();
		// タップ判定は常に「今フレームで動かした後」の最新位置で行う
		if (s.apr_flg) hitcheck();

		s.hako.forEach((h) => {
			if (!h.flg) return;
			h.y += h.moveyDir;
			if (h.y >= h.moveyBase + 32 || h.y <= h.moveyBase - 32) h.moveyDir *= -1;
			h.x += h.movexDir;
			if (h.x >= h.movexBase + GRID * 0.2 || h.x <= h.movexBase - GRID * 0.2) h.movexDir *= -1;
			h.rotation += h.rotDir;
			if (h.rotation >= 0.25 || h.rotation <= -0.25) h.rotDir *= -1;
		});

		// 通知バナーの寿命を進め、期限切れを取り除く
		s.notifications.forEach((n) => { n.age += 1; });
		while (s.notifications.length && s.notifications[0].age >= s.notifications[0].life) {
			s.notifications.shift();
		}

		if (s.popNotify) {
			s.popNotify.age += 1;
			if (s.popNotify.age >= s.popNotify.life) s.popNotify = null;
		}

		// 花吹雪の物理更新
		s.confetti.forEach((c) => {
			c.x += c.vx; c.y += c.vy; c.vy += 0.15; c.rot += c.vrot; c.age += 1;
		});
		if (s.confetti.length) s.confetti = s.confetti.filter((c) => c.age < c.life);

		if (s.homerunRingEffect > 0) s.homerunRingEffect -= 1;

		if (s.homerunBonusTimer > 0) {
			s.homerunBonusTimer -= 1;
		} else if (s.homerunBonusTimer === 0) {
			hakopop();
			s.homerunBonusTimer -= 1;
		}
	}

	/* ---- 入力 ---- */
	function onTap() {
		if (s.swing) return;
		const ksk = s.ballVy * 1.5;
		s.swing = true;
		s.swingTimer = 16;
		// 「さいごの一球」用に、タップした瞬間のゲーム画面を撮っておく
		if (s.apr_value === 1 || s.apr_value === 2) {
			s.pitchSwung = true;
			s.pitchTapSnapshot = captureCanvasSnapshot();
		}
		if (s.hitflg === 1 || s.hitflg === 3) {
			s.flg_return = true;
			// 上下の帯で打ち返した球がボーナス箱の高さまで届くよう、打ち上げ力を少し強める
			s.ballVy = Math.trunc(ksk * Math.sin(s.angleRotation)) * -1.4;
			s.ballVx = Math.trunc(ksk * Math.cos(s.angleRotation)) * -1;
			s.impactStop = IMPACT_STOP_FRAMES;
		} else if (s.hitflg === 2) {
			s.flg_return = true;
			s.flg_homerun = true;
			s.ballVy = -2 * ksk;
			s.ballVx = 0;
			if (s.apr_value === 1) {
				s.impactStop = IMPACT_STOP_FRAMES;
			} else {
				s.impactStop = HOMERUN_IMPACT_STOP_FRAMES;
				s.homerunRingEffect = HOMERUN_RING_FRAMES;
				s.homerunRingX = s.ball.x;
				s.homerunRingY = s.ball.y;
			}
		}
		if (s.flg_return && s.apr_value === 1 && !s.goenPenalized) {
			s.goenPenalized = true;
			s.goenbonus = 0;
			// 5円玉を打ってしまった罰当たりペナルティ（金色のレア5円玉はより重い）
			const penalty = s.isRareGoen ? GOEN_PENALTY * RARE_GOEN_PENALTY_MULT : GOEN_PENALTY;
			s.scoreup = Math.max(0, s.scoreup - penalty);
			pushNotification(t("penaltyFmt")(penalty), "penalty");
		}
	}

	/* ---- 描画 ---- */
	function draw() {
		ctx.clearRect(0, 0, W, H);
		drawSprite(s.bg);
		s.hako.forEach((h) => {
			h.sprite.x = h.x; h.sprite.y = h.y; h.sprite.rotation = h.rotation;
			h.sprite.visible = h.flg || h.hit === 1;
			drawSprite(h.sprite);
		});
		if (s.apr_value === 2 && s.impactStop <= 0) {
			const typeStyle = BALL_TYPE_STYLE[s.ballType];
			drawBallAura(s.ball.x, s.ball.y, s.ballVx, s.ballVy, typeStyle ? typeStyle.aura : null, s.frameTick);
		}
		// レア5円玉は金色オーラ＋一回り大きい表示で普通の5円玉と見分けられるようにする
		const goenScale = (s.apr_value === 1 && s.isRareGoen) ? 6 : 4;
		s.goen.scaleX = goenScale; s.goen.scaleY = goenScale;
		if (s.apr_value === 1 && s.isRareGoen) {
			drawRareGoenAura(s.goen.x, s.goen.y, s.frameTick);
		}
		drawSprite(s.ball);
		drawSprite(s.goen);
		drawSprite(s.bat);

		// ホームランの光の輪エフェクト
		if (s.homerunRingEffect > 0) {
			const progress = 1 - s.homerunRingEffect / HOMERUN_RING_FRAMES;
			ctx.save();
			ctx.globalCompositeOperation = "lighter";
			[0, 6].forEach((delay) => {
				const p = clamp01(progress - delay / HOMERUN_RING_FRAMES);
				if (p <= 0) return;
				const radius = 8 + p * 90;
				const alpha = (1 - p) * 0.8;
				ctx.strokeStyle = `rgba(255,240,120,${alpha})`;
				ctx.lineWidth = 8 * (1 - p) + 2;
				ctx.beginPath();
				ctx.arc(s.homerunRingX, s.homerunRingY, radius, 0, Math.PI * 2);
				ctx.stroke();
			});
			ctx.restore();
		}

		// ボーナス箱の出現ポップ
		if (s.popNotify) {
			const p = s.popNotify;
			const progress = p.age / p.life;
			let alpha = 1;
			if (progress < 0.15) alpha = progress / 0.15;
			else if (progress > 0.7) alpha = clamp01(1 - (progress - 0.7) / 0.3);
			const floatY = progress * 22;
			ctx.save();
			ctx.font = "bold 14px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif";
			const tw = ctx.measureText(p.text).width;
			ctx.restore();
			const bw = tw + 26, bh = 30;
			const margin = 6;
			const boxCx = Math.max(bw / 2 + margin, Math.min(W - bw / 2 - margin, p.x));
			const arrowX = Math.max(-bw / 2 + 12, Math.min(bw / 2 - 12, p.x - boxCx));
			ctx.save();
			ctx.globalAlpha = alpha;
			// 通知バナー（画面上部）と重ならないよう、箱の下に吹き出しを出す
			ctx.translate(boxCx, p.y + 48 + floatY);
			fillRoundRect(-bw / 2, -bh / 2, bw, bh, 10, "rgba(255,196,20,0.95)");
			strokeRoundRect(-bw / 2, -bh / 2, bw, bh, 10, "#fff6c8", 2.5);
			ctx.fillStyle = "rgba(255,196,20,0.95)";
			ctx.beginPath();
			ctx.moveTo(arrowX - 7, -bh / 2 + 1); ctx.lineTo(arrowX + 7, -bh / 2 + 1); ctx.lineTo(arrowX, -bh / 2 - 9);
			ctx.closePath();
			ctx.fill();
			drawText(p.text, 0, 1, { size: 14, weight: "bold", align: "center", baseline: "middle", color: "#5c3d00" });
			ctx.restore();
		}

		// ヒットゾーンの目安
		ctx.save();
		ctx.fillStyle = "rgba(255,0,255,0.22)";
		ctx.fillRect(ZONE_X, ZONE_TOP, ZONE_W, ZONE_BOTTOM - ZONE_TOP);
		ctx.strokeStyle = "rgba(255,0,255,0.55)";
		ctx.lineWidth = 2;
		ctx.strokeRect(ZONE_X, ZONE_TOP, ZONE_W, ZONE_BOTTOM - ZONE_TOP);
		// ホームランを狙う目印
		const hrCenterY = (ZONE_HR_LOW + ZONE_HR_HIGH) / 2;
		ctx.beginPath();
		ctx.arc(ZONE_CX, hrCenterY, 5, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(0,0,0,0.75)";
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = "rgba(255,255,255,0.9)";
		ctx.stroke();
		ctx.restore();

		drawScoreDisplay(6, GRID * 0.5 + 24, s.score);

		// お賽銭コンボ／ホームラン数は右側にまとめ、コンボを上・ホームランを下に並べる
		if (s.goenbonus > 1) {
			const label = s.ended ? t("goenComboMaxFmt")(s.goenbonus_max) : t("goenComboFmt")(s.goenbonus);
			drawText(label, W - 8, GRID * 11 - 12, { size: 15, weight: "bold", align: "right", gradient: GOLD_GRADIENT, gradHeight: 13, stroke: "#000", strokeWidth: 3, shadow: true });
		}
		if (s.hmrcount > 0) {
			drawText(t("homerunCountFmt")(s.hmrcount), W - 8, GRID * 11 + 8, { size: 15, weight: "bold", align: "right", gradient: GOLD_GRADIENT, gradHeight: 13, stroke: "#000", strokeWidth: 3, shadow: true });
		}

		// 統一した通知バナー（画面上部中央に集約し、新しいものを下に積む）
		s.notifications.forEach((n, i) => {
			const progress = n.age / n.life;
			let alpha = 1, yOffset = 0, scale = 1;
			if (progress < 0.12) {
				const p = progress / 0.12;
				alpha = p;
				yOffset = (1 - p) * -8;
				scale = 1.15 - p * 0.15;
			} else if (progress > 0.78) {
				const p = (progress - 0.78) / 0.22;
				alpha = 1 - p;
				yOffset = -p * 10;
			}
			const style = NOTIFY_STYLES[n.kind] || { accent: "#ffffff", size: 18 };
			const fontSize = style.size || 18;
			ctx.save();
			ctx.font = `bold ${fontSize}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`;
			const textWidth = ctx.measureText(n.text).width;
			ctx.restore();
			const panelW = textWidth + 44;
			const panelH = fontSize + 20;
			const cx = W / 2, cy = NOTIFY_Y + i * NOTIFY_GAP + yOffset;

			// 消えるまでに2回、枠・影・文字をまとめてパキッと点滅させる
			const blinkWindow = 0.7, blinkCycles = 2;
			const blinkOn = progress >= blinkWindow || Math.floor((progress / blinkWindow) * blinkCycles * 2) % 2 === 0;

			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.translate(cx, cy);
			ctx.scale(scale, scale);
			ctx.shadowColor = style.accent;
			ctx.shadowBlur = blinkOn ? 20 : 4;
			fillRoundRect(-panelW / 2, -panelH / 2, panelW, panelH, panelH / 2, "rgba(20,16,28,0.82)");
			ctx.shadowBlur = 0;
			ctx.globalAlpha = alpha * (blinkOn ? 1 : 0.3);
			strokeRoundRect(-panelW / 2, -panelH / 2, panelW, panelH, panelH / 2, style.accent, blinkOn ? 3.5 : 1.5);
			ctx.globalAlpha = alpha * (blinkOn ? 1 : 0.4);
			drawText(n.text, 0, 1, { size: fontSize, weight: "bold", align: "center", baseline: "middle", color: "#fff" });
			ctx.restore();
		});

		// 花吹雪
		s.confetti.forEach((c) => {
			const alpha = clamp01(1 - c.age / c.life);
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.translate(c.x, c.y);
			ctx.rotate(c.rot);
			ctx.fillStyle = c.color;
			ctx.fillRect(-c.size / 2, -c.size * 0.35, c.size, c.size * 0.7);
			ctx.restore();
		});

		drawLangButton();
	}

	function update() {
		gameLoop();
	}

	return { onTap, update, draw, get score() { return s.score; }, s };
}

/* ==================== 結果画面 ==================== */
function createResultState(finalScore) {
	const unseiList = t("unsei");
	let fortune = unseiList[unseiList.length - 1];
	let nextValue = 0;
	for (const u of unseiList) {
		if (finalScore < u.max) { fortune = u; nextValue = u.max === Infinity ? 0 : u.max - finalScore; break; }
	}
	const r1 = Math.floor(Math.random() * 4);
	const r2 = Math.floor(Math.random() * 4);
	const r3 = Math.floor(Math.random() * 4);
	const r4 = Math.floor(Math.random() * 4);
	// ページ0は「さいごの一球」、1〜6が既存のまめちしき
	const TIPS_PAGES = 7;
	let tipsIndex = 0;
	const miss = lastMissSnapshot;

	// レイアウト定数
	const AKA_X = 16, AKA_Y = 54, AKA_W = W - 32, AKA_H = 435;
	const SHIRO_X = AKA_X + 10, SHIRO_Y = AKA_Y + 10, SHIRO_W = AKA_W - 20, SHIRO_H = AKA_H - 20;
	const INNER_X = SHIRO_X + 8, INNER_Y = SHIRO_Y + 8, INNER_W = SHIRO_W - 16, INNER_H = 284;
	const TIPS_X = INNER_X, TIPS_Y = INNER_Y + INNER_H + 4, TIPS_W = INNER_W, TIPS_H = SHIRO_Y + SHIRO_H - TIPS_Y - 2;

	function draw() {
		ctx.clearRect(0, 0, W, H);
		ctx.save();
		ctx.fillStyle = "#ccccff";
		ctx.fillRect(0, 0, W, H);
		ctx.restore();

		// 最後にプレイしていたゲーム画面を薄く背景に映す
		if (lastGameSnapshot) {
			ctx.save();
			ctx.globalAlpha = 0.32;
			ctx.drawImage(lastGameSnapshot, 0, 0);
			ctx.restore();
			ctx.fillStyle = "#ccccff";
			ctx.fillRect(0, 0, 256, 52);
		}

		// ゲーム中と同じ位置・見た目のスコア表示（金色で強調）
		drawScoreDisplay(6, GRID * 0.5 + 24, finalScore);

		fillRoundRect(AKA_X, AKA_Y, AKA_W, AKA_H, 4, "rgba(204,0,0,0.72)");
		fillRoundRect(SHIRO_X, SHIRO_Y, SHIRO_W, SHIRO_H, 4, "rgba(255,255,255,0.68)");
		fillRoundRect(INNER_X, INNER_Y, INNER_W, INNER_H, 4, "rgba(255,255,255,0.62)");
		strokeRoundRect(INNER_X, INNER_Y, INNER_W, INNER_H, 4, "rgba(0,0,0,0.75)", 3);

		const u = t("unsei");
		const idx = unseiList.indexOf(fortune);
		const localized = u[idx] || u[u.length - 1];

		const nameMaxWidth = INNER_W - 24;
		const nameSize = fitFontSize(localized.name, nameMaxWidth, 52, "bold");
		drawText(localized.name, W / 2, INNER_Y + 56, {
			size: nameSize, weight: "bold", align: "center", color: "#cc0000",
			stroke: "#fff", strokeWidth: 5, shadow: true,
		});
		drawText(localized.text, W / 2, INNER_Y + 94, {
			size: 19, weight: "normal", align: "center", color: "#000",
		});

		const labels = t("labels");
		const negai = t("negai"), ryoko = t("ryoko"), yamai = t("yamai"), study = t("study"), usmno = t("usmno");
		const memoLineList = [
			`${labels.negai}：${negai[r1]}`,
			`${labels.ryoko}：${ryoko[r2]}`,
			`${labels.yamai}：${yamai[r3]}`,
			`${labels.study}：${study[r4]}`,
			`${labels.usmno}：${usmno[r4]}`,
		];
		ctx.save();
		ctx.font = "bold 20px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif";
		const memoMaxWidth = Math.max(...memoLineList.map((l) => ctx.measureText(l).width));
		ctx.restore();
		const memoX = INNER_X + (INNER_W - memoMaxWidth) / 2;
		drawText(memoLineList.join("\n"), memoX, INNER_Y + 134, { size: 20, weight: "bold", lineHeight: 27, color: "#000" });

		const nextText = nextValue !== 0 ? t("nextValueFmt")(nextValue) : t("nextValueMax");
		drawText(nextText, W / 2, INNER_Y + INNER_H - 10, { size: 14, align: "center", color: "#000" });

		// 枠で囲む
		fillRoundRect(TIPS_X, TIPS_Y, TIPS_W, TIPS_H, 8, "rgba(255,240,220,0.68)");
		strokeRoundRect(TIPS_X, TIPS_Y, TIPS_W, TIPS_H, 8, "rgba(163,18,28,0.85)", 2);
		if (tipsIndex === 0) {
			drawMissPanel(TIPS_X, TIPS_Y, TIPS_W, TIPS_H);
		} else {
			drawText(`${t("mameChishikiHeading")} (${tipsIndex}/6)`, W / 2, TIPS_Y + 24, { size: 17, weight: "bold", align: "center", color: "#a3121c" });
			const tipsWrapped = wrapText(t("mamegoto")[tipsIndex - 1], TIPS_W - 12, 15);
			drawText(tipsWrapped, W / 2, TIPS_Y + 54, { size: 15, lineHeight: 21, align: "center", color: "#000" });
		}
		drawTriangleBtn(BTN_TIPS_PREV, "left");
		drawTriangleBtn(BTN_TIPS_NEXT, "right");

		drawButton(BTN_RETRY, t("retryBtn"), { bg: "rgba(204,0,0,0.88)", size: 29, color: "#fff", shadow: true, radius: 10 });
		drawLangButton();
	}

	/* 「最後の打席」パネル：実際にバットを振った瞬間（または見逃した瞬間）のゲーム画面を表示 */
	function drawMissPanel(x, y, w, h) {
		const snap = miss ? miss.snapshot : null;
		const pad = 4;
		const areaX = x + pad, areaY = y + pad, areaW = w - pad * 2, areaH = h - pad * 2;
		if (snap) {
			const scale = Math.min(areaW / MISS_CROP_W, areaH / MISS_CROP_H);
			const dw = MISS_CROP_W * scale, dh = MISS_CROP_H * scale;
			const dx = areaX + (areaW - dw) / 2, dy = areaY + (areaH - dh) / 2;
			ctx.save();
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(snap, MISS_CROP_X, MISS_CROP_Y, MISS_CROP_W, MISS_CROP_H, dx, dy, dw, dh);
			ctx.strokeStyle = "rgba(163,18,28,0.6)";
			ctx.lineWidth = 1.5;
			ctx.strokeRect(dx, dy, dw, dh);
			ctx.restore();
		}
		drawText(t("missPanelHeading"), x + 12, y + 22, {
			size: 14, weight: "bold", align: "left", color: "#a3121c",
			stroke: "#fff", strokeWidth: 4,
		});
	}

	function nextTip() { tipsIndex = (tipsIndex + 1) % TIPS_PAGES; }
	function prevTip() { tipsIndex = (tipsIndex + TIPS_PAGES - 1) % TIPS_PAGES; }

	return { draw, nextTip, prevTip };
}

/* ==================== メインループ ====================
 * 実時間を積算し、1/60秒分たまるごとに1回だけupdateする固定タイムステップ方式にして、rAFの発火頻度に関係なく速度を安定。 */
const FRAME_STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5; // タブ復帰直後などの大きな経過時間で暴走しないための上限
let frameAccumulator = 0;
let lastFrameTime = null;

function frame(now) {
	if (lastFrameTime === null) lastFrameTime = now;
	let elapsed = now - lastFrameTime;
	lastFrameTime = now;
	if (elapsed > FRAME_STEP_MS * MAX_STEPS_PER_FRAME) elapsed = FRAME_STEP_MS * MAX_STEPS_PER_FRAME;

	if (scene === "game" && gameState) {
		frameAccumulator += elapsed;
		let steps = 0;
		while (frameAccumulator >= FRAME_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
			gameState.update();
			frameAccumulator -= FRAME_STEP_MS;
			steps++;
		}
	} else {
		frameAccumulator = 0;
	}

	if (scene === "title") drawTitleScene();
	else if (scene === "game" && gameState) gameState.draw();
	else if (scene === "result" && resultState) resultState.draw();

	requestAnimationFrame(frame);
}

/* ==================== 起動 ==================== */
loadAllImages().then(() => {
	requestAnimationFrame(frame);
});
