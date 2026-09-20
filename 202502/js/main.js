"use strict";

/* ==================== 基本設定 ==================== */
const W = 360, H = 548;

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
	const [daimao, daimao2, yogore, world2, sheep, earth, hansei, mofu] = await Promise.all([
		loadImage("daimao.png"),
		loadImage("daimao2.png"),
		loadImage("yogore.png"),
		loadImage("world2.png"),
		loadImage("sheep.png"),
		loadImage("earth.png"),
		loadImage("hansei.png"),
		loadImage("mofu.png"),
	]);
	IMG.daimao = daimao; IMG.daimao2 = daimao2; IMG.yogore = yogore; IMG.world2 = world2;
	IMG.sheep = sheep; IMG.earth = earth; IMG.hansei = hansei; IMG.mofu = mofu;
}

// 主人公(フーくん)・だいまおうさまのスプライトシート座標
const SHEEP_FRAMES = [
	{ x: 0, y: 0, w: 26, h: 37 },
	{ x: 26, y: 0, w: 26, h: 37 },
	{ x: 52, y: 0, w: 26, h: 37 },
	{ x: 78, y: 0, w: 26, h: 37 },
];
const DAIMAO2_FRAMES = [
	{ x: 0, y: 0, w: 64, h: 64 },
	{ x: 64, y: 0, w: 64, h: 64 },
];

/* ==================== Canvas 基本ヘルパー ==================== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

function makeSprite(img, opts) {
	return Object.assign({
		img, x: 0, y: 0, anchorX: 0, anchorY: 0,
		scaleX: 1, scaleY: 1, rotation: 0, alpha: 1,
		tint: null, visible: true,
		frame: null, // {x,y,w,h} を指定するとスプライトシートの一部を描く
	}, opts || {});
}

function spriteSize(s) {
	const w = s.frame ? s.frame.w : s.img.width;
	const h = s.frame ? s.frame.h : s.img.height;
	return { w, h };
}

function drawSprite(s) {
	if (!s.visible || !s.img) return;
	const { w, h } = spriteSize(s);
	ctx.save();
	ctx.globalAlpha = s.alpha;
	ctx.translate(s.x, s.y);
	ctx.rotate(s.rotation);
	ctx.scale(s.scaleX, s.scaleY);
	const ax = s.anchorX * w, ay = s.anchorY * h;
	if (s.frame) {
		ctx.drawImage(s.img, s.frame.x, s.frame.y, w, h, -ax, -ay, w, h);
	} else {
		ctx.drawImage(s.img, -ax, -ay);
	}
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

function measureText(text, size, weight) {
	ctx.save();
	ctx.font = `${weight || ""} ${size}px 'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif`.trim();
	const w = ctx.measureText(text).width;
	ctx.restore();
	return w;
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* 4フレームの歩行アニメで、現在表示すべきフレーム番号を返す */
function walkFrame(tick, timing, totalFrames) {
	return Math.floor(tick / timing) % totalFrames;
}

/* ==================== HUD（常時表示のスコア・ラベル） ==================== */
const hudTextStyle = { size: 20, weight: "bold", color: "#000", stroke: "#fff", strokeWidth: 4 };

const HUD_Y = 20;

function drawHud(state) {
	// 左端ギリギリだと縁取りが画面外に見切れるので、少し内側から描画する
	drawText(t("totalLabel"), 6, HUD_Y, hudTextStyle);
	drawText(String(totalScore), 6 + 32 * 2 + 8, HUD_Y, hudTextStyle);
	if (state.isBoss) {
		// ボス名はTOTALと同じy位置・同じ大きさで画面右上に揃える
		drawText(t("bossHeading"), W - 6, HUD_Y, {
			size: hudTextStyle.size, weight: "bold", align: "right",
			color: "#000", stroke: "#fff", strokeWidth: 4, shadow: true,
		});
		// HP数字はHPバーに重ねて大きく表示
		const hpText = `${state.bossHp * 2}/${state.bossMaxHp * 2}`;
		const hpSize = fitFontSize(hpText, W - 30, 26, "bold");
		drawText(hpText, W / 2, 50, {
			size: hpSize, weight: "bold", align: "center", baseline: "middle",
			color: "#fff", stroke: "#000", strokeWidth: 4, shadow: true,
		});
	} else {
		// RESTラベルは固定位置
		const restLabelX = 220;
		drawText(t("restLabel"), restLabelX, HUD_Y, hudTextStyle);
		const restValueText = String(state.yogoreArray.length);
		const restValueRightX = W - 6;
		const restValueSize = fitFontSize(restValueText, W - restLabelX - 62 - 6, 40, "bold");
		drawText(restValueText, restValueRightX, HUD_Y + 6, {
			size: restValueSize, weight: "bold", align: "right", baseline: "middle",
			color: "#000", stroke: "#fff", strokeWidth: 5, shadow: true,
		});
	}
}

/* タイトルロゴ：上下の白い太線に挟まれた、青×紫グラデーション＋白縁取りの文字 */
function drawTitleLogo(tick) {
	const text = t("titleLogo");
	const size = fitFontSize(text, W - 70, 32, "bold");
	const textW = measureText(text, size, "bold");
	const floatY = Math.sin(tick * 0.035) * 3;
	const cx = W / 2;
	const baseTop = 46;
	const top = baseTop + floatY;
	const midY = top + size / 2;
	const baseMidY = baseTop + size / 2;

	// 上下の白い太線
	const lineW = textW + 40;
	const lineGapY = size / 2 + 14;
	fillRoundRect(cx - lineW / 2, baseMidY - lineGapY - 2, lineW, 4, 2, "#ffffff");
	fillRoundRect(cx - lineW / 2, baseMidY + lineGapY - 2, lineW, 4, 2, "#ffffff");

	// 周りをふわふわ漂うコショウの粒
	const sparkles = [
		{ dx: -textW / 2 - 24, dy: -4, s: 0.55 },
		{ dx: textW / 2 + 22, dy: 6, s: 0.5 },
		{ dx: -14, dy: -size / 2 - 10, s: 0.4 },
		{ dx: textW / 2 - 6, dy: -size / 2 - 8, s: 0.42 },
	];
	sparkles.forEach((p, i) => {
		const wobble = Math.sin(tick * 0.07 + i * 1.7) * 3;
		drawSprite(makeSprite(IMG.yogore, {
			x: cx + p.dx, y: midY + p.dy + wobble,
			anchorX: 0.5, anchorY: 0.5, scaleX: p.s, scaleY: p.s,
			rotation: tick * 0.03 + i,
		}));
	});

	// 白フチの中に、タイトル画面のボタンと同じ青×紫グラデーション（#3498db → #9834db）
	drawText(text, cx, top, {
		size, weight: "bold", align: "center", baseline: "top",
		color: "#3498db", stroke: "#ffffff", strokeWidth: 8, shadow: true,
	});
	drawText(text, cx, top, {
		size, weight: "bold", align: "center", baseline: "top",
		gradient: ["#3498db", "#9834db"], gradHeight: size,
		stroke: "#ffffff", strokeWidth: 3,
	});
}

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う。 */
const BTN_LANG = { x: 258, y: 12, w: 94, h: 34 };
const BTN_START = { x: 72, y: 410, w: 216, h: 40 };
const BTN_ENDLESS = { x: 54, y: 493, w: 252, h: 30 };
const BTN_TOTITLE = { x: 58, y: 400, w: 244, h: 41 };

function hitTestBtn(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function drawButton(rect, label, opts) {
	opts = opts || {};
	fillRoundRect(rect.x, rect.y, rect.w, rect.h, opts.radius || 6, opts.bg || "rgba(0,0,0,0.6)");
	if (label) {
		drawText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
			size: opts.size || 16, weight: "bold", align: "center", baseline: "middle",
			color: opts.color || "#fff", shadow: opts.shadow, stroke: opts.stroke, strokeWidth: opts.strokeWidth,
		});
	}
}

function drawLangButton() {
	drawButton(BTN_LANG, t("langBtn"), { bg: "rgba(0,0,0,0.6)", size: 13, color: "#fff" });
}

/* ==================== 振り子コントローラ（主人公の操作） ==================== */
function createPendulumController(opts) {
	const c = {
		centerX: opts.centerX,
		charaminy: opts.charaminy,
		charamaxy: opts.charamaxy,
		r: 150,
		angle: -Math.PI / 1.5,
		angleVelocity: 0.5,
		angleAcceleration: 0,
		gravity: 0.002,
		maxSpeed: 0.05,
		muteki: false,
		controllY: 0,
		isDragging: false,
		startY: 0,
		x: 0, y: 0, rotation: -1.04,
		trail: [], // 無敵中の残像（キャラ本体）用の位置履歴
		lightTrail: [], // 無敵中に通った道筋を光の帯として残す軌跡履歴
	};

	c.reset = function () {
		c.r = 150;
		c.angleVelocity = 0.5;
		c.angleAcceleration = 0;
		c.gravity = 0.002;
		c.maxSpeed = 0.05;
		c.muteki = false;
	};

	c.setMuteki = function (on) {
		if (on) {
			c.angleVelocity = 0.2;
			c.angleAcceleration = 0.2;
			c.gravity = 0.0001;
			c.maxSpeed = 0.5;
			c.muteki = true;
		} else {
			c.reset();
		}
	};

	c.onPointerDown = function (x, y) {
		c.isDragging = true;
		c.startY = y - c.controllY;
	};
	c.onPointerMove = function (x, y) {
		if (c.isDragging) c.controllY = y - c.startY;
	};
	c.onPointerUp = function () {
		c.isDragging = false;
	};
	c.onWheel = function (deltaY) {
		c.controllY += deltaY / 8;
	};
	c.forceMoveOutOfBarrier = function (barrierY) {
		if (c.y >= barrierY) c.controllY += 8;
		else c.controllY -= 8;
	};

	c.update = function (delta) {
		c.angleAcceleration = -c.gravity * Math.sin(c.angle);
		c.angleVelocity += c.angleAcceleration * delta;
		if (c.angleVelocity > c.maxSpeed) c.angleVelocity = c.maxSpeed;
		c.angle += c.angleVelocity * delta;

		if (c.controllY + c.r > c.charamaxy) c.controllY = c.charamaxy - c.r;
		else if (c.controllY + c.r < c.charaminy) c.controllY = c.charaminy - c.r;

		c.x = c.centerX - c.r * Math.sin(c.angle);
		c.y = c.controllY + c.r * Math.cos(c.angle);
		c.rotation = c.angle;

		if (c.muteki) {
			c.trail.push({ x: c.x, y: c.y, rotation: c.rotation });
			if (c.trail.length > 6) c.trail.shift();
			c.lightTrail.push({ x: c.x, y: c.y, age: 0 });
		} else if (c.trail.length) {
			c.trail.shift();
		}
		for (let i = c.lightTrail.length - 1; i >= 0; i--) {
			c.lightTrail[i].age += delta;
			if (c.lightTrail[i].age > 45) c.lightTrail.splice(i, 1);
		}
	};

	c.drawLine = function (offsetX) {
		ctx.save();
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(offsetX + c.centerX, c.controllY);
		ctx.lineTo(offsetX + c.centerX - (c.r - 32) * Math.sin(c.angle), c.controllY + (c.r - 32) * Math.cos(c.angle));
		ctx.stroke();
		ctx.restore();
	};

	// シーン遷移中はupdate()が呼ばれる前にdraw()が走ることがあるため、
	// 生成直後のx,yを初期値0,0（画面左上）のまま放置せず、ここで軌道上の位置を計算しておく
	c.x = c.centerX - c.r * Math.sin(c.angle);
	c.y = c.controllY + c.r * Math.cos(c.angle);
	c.rotation = c.angle;

	return c;
}

/* ==================== 回転（無敵）ボタン ==================== */
function createRollButton(opts) {
	const b = {
		x: opts.x, y: opts.y, radius: opts.radius,
		isDisabled: true,
		isExecuted: false,
		timeElapsed: 0,
		churgeBlockCount: 0,
		churgeBoundCount: 0,
		maxTimeMuteki: 0.6,
		maxTimeChurge: 5.0,
		activateFlash: null, // 発動した瞬間に広がる白いリング演出
		onActivate: opts.onActivate || function () { },
		onDeactivate: opts.onDeactivate || function () { },
	};

	b.notifyBlockTouch = function () {
		if (b.isDisabled && !b.isExecuted) b.churgeBlockCount += 1;
	};
	b.notifyBound = function () {
		if (b.isDisabled && !b.isExecuted) b.churgeBoundCount += 1;
	};

	b.hitTest = function (x, y) {
		const dx = x - b.x, dy = y - b.y;
		return dx * dx + dy * dy <= b.radius * b.radius;
	};

	b.onPointerDown = function () {
		if (b.isDisabled) return;
		b.isExecuted = true;
		b.timeElapsed = 0;
		b.activateFlash = { age: 0, life: 22 };
		b.onActivate();
	};

	b.update = function (delta) {
		if (b.activateFlash) {
			b.activateFlash.age += delta;
			if (b.activateFlash.age >= b.activateFlash.life) b.activateFlash = null;
		}
		if (b.isExecuted) {
			b.timeElapsed += 0.01 * delta;
			if (b.timeElapsed >= b.maxTimeMuteki) {
				b.isExecuted = false;
				b.timeElapsed = 0;
				b.isDisabled = true;
				b.churgeBlockCount = 0;
				b.churgeBoundCount = 0;
				b.onDeactivate();
			}
		} else if (b.isDisabled) {
			b.timeElapsed += 0.002 * delta + 0.01 * b.churgeBlockCount + 0.1 * b.churgeBoundCount;
			b.churgeBlockCount = 0;
			b.churgeBoundCount = 0;
			if (b.timeElapsed >= b.maxTimeChurge) {
				b.isDisabled = false;
				b.timeElapsed = 0;
			}
		}
	};

	b.draw = function (offsetX) {
		const cx = offsetX + b.x, cy = b.y, r = b.radius;
		let fillColor, arcColor, arcAngle;
		if (b.isExecuted) {
			fillColor = "#66cc66"; arcColor = "#cccccc";
			arcAngle = (b.timeElapsed / b.maxTimeMuteki) * Math.PI * 2;
		} else if (b.isDisabled) {
			fillColor = "#cccccc"; arcColor = "#66ff66";
			arcAngle = (b.timeElapsed / b.maxTimeChurge) * Math.PI * 2;
		} else {
			fillColor = "#66ff66"; arcColor = "#66cc66";
			arcAngle = Math.PI * 2;
		}
		ctx.save();
		ctx.fillStyle = fillColor;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();

		ctx.strokeStyle = arcColor;
		ctx.lineWidth = 10;
		ctx.beginPath();
		if (b.isExecuted) {
			ctx.arc(cx, cy, r - 4, -Math.PI / 2, -Math.PI / 2 - arcAngle, true);
		} else {
			ctx.arc(cx, cy, r - 4, -Math.PI / 2, -Math.PI / 2 + arcAngle);
		}
		ctx.stroke();
		ctx.restore();

		// 発動した瞬間、外側へ広がりながら消える白いリングで「発動した」ことを分かりやすく
		if (b.activateFlash) {
			const pr = b.activateFlash.age / b.activateFlash.life;
			ctx.save();
			ctx.globalAlpha = (1 - pr) * 0.9;
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 6 * (1 - pr) + 1;
			ctx.beginPath();
			ctx.arc(cx, cy, r + pr * 24, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}

		// ボタン円の内側上部にラベルを重ねる（Pixi版の配置を踏襲）
		const labelSize = fitFontSize(t("rollButtonLabel"), r * 2 - 8, 20, "bold");
		drawText(t("rollButtonLabel"), cx, cy - 14, {
			size: labelSize, weight: "bold", align: "center", baseline: "top",
			color: "#000", stroke: b.isDisabled && !b.isExecuted ? "#cccccc" : "#fff", strokeWidth: 4,
		});
	};

	return b;
}

/* ==================== シーン管理 ==================== */
let scene = "title"; // "title" | "gameplay" | "clear"
let titleState = null;
let gameplayState = null;
let clearState = null;
let level = 0;
let gamemode = -1; // 0:通常 1:エンドレス
let totalScore = 0;

// スライド遷移（旧シーンを左へスライドアウト→新シーンを右からスライドイン）
// overlayTextを渡すと、遷移が完全に終わるまで画面中央固定でテキストを点滅表示し続ける
let sceneTransition = null;
const TRANSITION_FRAMES = 30;

function startTransition(buildNext, overlayText) {
	sceneTransition = {
		phase: "out", progress: 0, buildNext,
		overlayText: overlayText || null, alpha: 1, fadingOut: false,
	};
}

function updateTransition(delta) {
	const tr = sceneTransition;
	tr.progress += delta / TRANSITION_FRAMES;
	if (tr.overlayText) {
		if (tr.fadingOut) {
			tr.alpha -= (tr.alpha > 0.6 ? 0.04 : 0.25) * delta;
			if (tr.alpha <= 0) tr.fadingOut = false;
		} else {
			tr.alpha += (tr.alpha > 0.6 ? 0.04 : 0.25) * delta;
			if (tr.alpha >= 1) tr.fadingOut = true;
		}
	}
	if (tr.phase === "out") {
		if (tr.progress >= 1) {
			tr.buildNext();
			tr.phase = "in";
			tr.progress = 0;
		}
	} else {
		if (tr.progress >= 1) {
			sceneTransition = null;
		}
	}
}

function drawTransitionOverlay() {
	if (!sceneTransition || !sceneTransition.overlayText) return;
	ctx.save();
	ctx.globalAlpha = Math.max(0, Math.min(1, sceneTransition.alpha));
	drawText(sceneTransition.overlayText, W / 2, 180, {
		size: 30, weight: "bold", align: "center", color: "#fff", stroke: "#000", strokeWidth: 4, shadow: true,
	});
	ctx.restore();
}

function currentTransitionOffset() {
	if (!sceneTransition) return 0;
	if (sceneTransition.phase === "out") return -sceneTransition.progress * W;
	return W * (1 - sceneTransition.progress);
}

function updateDocumentTitle() {
	document.title = t("pageTitle");
}
document.addEventListener("langchange", updateDocumentTitle);

function goToTitle() {
	scene = "title";
	level = 0;
	gamemode = -1;
	titleState = createTitleState();
}
function goToMain(mode) {
	scene = "gameplay";
	gamemode = mode;
	level = 1;
	gameplayState = createGameplayState({ isBoss: false, level });
}
function goToClear() {
	scene = "clear";
	clearState = createClearState();
}

/* ==================== 入力（ドラッグ／ホイール／タップ） ==================== */
function canvasPos(clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	return {
		x: (clientX - rect.left) * (W / rect.width),
		y: (clientY - rect.top) * (H / rect.height),
	};
}

canvas.addEventListener("pointerdown", (e) => {
	e.preventDefault();
	if (sceneTransition) return;
	const p = canvasPos(e.clientX, e.clientY);
	if (scene === "title") {
		if (hitTestBtn(BTN_LANG, p.x, p.y)) { setLang(lang === "ja" ? "en" : "ja"); return; }
		if (hitTestBtn(BTN_START, p.x, p.y)) { goToMain(0); return; }
		if (hitTestBtn(BTN_ENDLESS, p.x, p.y)) { goToMain(1); return; }
		return;
	}
	if (scene === "clear") {
		if (hitTestBtn(BTN_LANG, p.x, p.y)) { setLang(lang === "ja" ? "en" : "ja"); return; }
		if (hitTestBtn(BTN_TOTITLE, p.x, p.y)) { goToTitle(); return; }
		return;
	}
	if (scene !== "gameplay") return;
	const g = gameplayState;
	if (g.rollButton.hitTest(p.x, p.y)) {
		g.rollButton.onPointerDown();
	} else {
		g.pendulum.onPointerDown(p.x, p.y);
	}
});
canvas.addEventListener("pointermove", (e) => {
	if (scene !== "gameplay" || sceneTransition) return;
	const p = canvasPos(e.clientX, e.clientY);
	gameplayState.pendulum.onPointerMove(p.x, p.y);
});
canvas.addEventListener("pointerup", () => {
	if (scene !== "gameplay") return;
	gameplayState.pendulum.onPointerUp();
});
canvas.addEventListener("pointerout", () => {
	if (scene !== "gameplay") return;
	gameplayState.pendulum.onPointerUp();
});
canvas.addEventListener("wheel", (e) => {
	if (scene !== "gameplay" || sceneTransition) return;
	e.preventDefault();
	gameplayState.pendulum.onWheel(e.deltaY);
}, { passive: false });

/* ==================== タイトルシーン ==================== */
function createTitleState() {
	const s = {
		frameTick: 0,
		daimaoAngle: 0,
		daimaoDir: 0.005,
		daimaoThreshold: 0.3,
		sheepFrame: 0,
		particles: [],
	};
	const PARTICLE_NUM = 40;
	for (let i = 0; i < PARTICLE_NUM; i++) {
		s.particles.push({
			x: 24,
			y: H * Math.random() + 140,
			vx: 0, vy: 0, vr: 0, g: 0,
			rotation: 0,
		});
	}

	s.update = function (delta) {
		s.frameTick += delta;
		if (s.daimaoAngle > s.daimaoThreshold) s.daimaoDir = -0.005;
		else if (s.daimaoAngle < -s.daimaoThreshold) s.daimaoDir = 0.005;
		s.daimaoAngle += s.daimaoDir * delta;

		s.sheepFrame = walkFrame(Math.floor(s.frameTick), 15, 4);

		s.particles.forEach((p) => {
			p.vx = Math.random() * 1.4 - 0.5;
			p.vy = Math.random() < 0.5 ? 0.6 : -0.6;
			p.vr = Math.random() < 0.5 ? 1 : -1;
			p.g = (Math.random() < 0.5 ? 1.5 : 1.5) + 0.2;
			p.x += p.vx * 10 * delta;
			p.y += (p.vy * 1 + p.g) * delta;
			p.rotation += p.vr * delta;
			if (p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) {
				p.x = 22; p.y = 146;
			}
		});
	};

	s.draw = function (offsetX) {
		ctx.save();
		ctx.translate(offsetX, 0);

		const bg = makeSprite(IMG.world2, { x: 0, y: 0, scaleX: 4, scaleY: 4, alpha: 0.5 });
		drawSprite(bg);

		const hoshi = makeSprite(IMG.earth, { x: 270, y: 350, anchorX: 0.5, anchorY: 0.5, scaleX: 9, scaleY: 9, alpha: 0.6 });
		drawSprite(hoshi);

		const mao = makeSprite(IMG.daimao, { x: 78, y: 148, anchorX: 0.5, anchorY: 0.5, scaleX: 2, scaleY: 2, rotation: s.daimaoAngle });
		drawSprite(mao);

		const bossLabelW = measureText(t("bossIntroLabel"), 12, "bold");
		fillRoundRect(12, 114 - 5, bossLabelW + 12, 18, 0, "rgba(0,0,0,0.8)");
		drawText(t("bossIntroLabel"), 18, 122, { size: 12, weight: "bold", color: "#fff", lineHeight: 18, shadow: true });

		s.particles.forEach((p) => {
			const sp = makeSprite(IMG.yogore, { x: p.x, y: p.y, anchorX: 0.5, anchorY: 0.5, rotation: p.rotation });
			drawSprite(sp);
		});

		fillRoundRect(12, 152, 335, 190, 0, "rgba(0,0,0,0.5)");
		const introWrapped = wrapText(t("introText"), W - 48, 17, "bold");
		drawText(introWrapped, 16, 172, { size: 17, weight: "bold", lineHeight: 23, color: "#fff", shadow: true });

		const sheep = makeSprite(IMG.sheep, {
			x: W / 2 + 100, y: 280, anchorX: 0.5, anchorY: 0.5, scaleX: 2, scaleY: 2,
			frame: SHEEP_FRAMES[s.sheepFrame],
		});
		drawSprite(sheep);
		let heroLabelSize = 12;
		let heroLabelW = measureText(t("heroIntroLabel"), heroLabelSize, "bold");
		while (280 + heroLabelW / 2 > W - 8 && heroLabelSize > 8) {
			heroLabelSize -= 1;
			heroLabelW = measureText(t("heroIntroLabel"), heroLabelSize, "bold");
		}
		const heroLabelX = 280 - heroLabelW / 2;
		fillRoundRect(heroLabelX - 6, 320 - 5, heroLabelW + 12, 18, 0, "rgba(0,0,0,0.8)");
		drawText(t("heroIntroLabel"), heroLabelX, 328, { size: heroLabelSize, weight: "bold", color: "#fff", lineHeight: 18, shadow: true });

		strokeRoundRect(12, 348, 335, 110, 0, "#66ccff", 2);
		fillRoundRect(12, 348, 335, 110, 0, "rgba(0,0,0,0.5)");
		const ruleAWrapped = wrapText(t("ruleTextA"), W - 48, 16, "");
		drawText(ruleAWrapped, 16, 372, { size: 16, lineHeight: 22, color: "#fff", shadow: true });

		strokeRoundRect(12, 465, 335, 70, 0, "#9966ff", 2);
		fillRoundRect(12, 465, 335, 70, 0, "rgba(0,0,0,0.5)");
		const ruleBSize = fitFontSize(t("ruleTextB"), W - 40, 16, "");
		drawText(t("ruleTextB"), 16, 482, { size: ruleBSize, color: "#fff", shadow: true });

		drawTitleLogo(s.frameTick);

		drawButton(BTN_START, t("startBtn"), { bg: "#3498db", size: 20, color: "#fff", shadow: true });
		drawButton(BTN_ENDLESS, t("endlessBtn"), { bg: "#9834db", size: 14, color: "#fff", shadow: true });
		drawLangButton();

		ctx.restore();
	};

	return s;
}

/* ==================== ゲームプレイシーン（メイン／ボス共通） ==================== */
function createGameplayState(config) {
	const isBoss = config.isBoss;
	const s = {
		isBoss,
		level: config.level,
		frameTick: 0,
		heroFrame: 0,
		isResetting: false,
		clearTextY: -180,
		clearFadingOut: false,
		clearAlpha: 1,
		clearText: "",
		showClearText: false,
		popEffects: [],
		hitRings: [],
		confetti: [],
		flashAlpha: 0,
		hpBarShake: 0,
	};

	// コショウが消える瞬間の小さな光の輪
	function spawnPopEffect(x, y) {
		s.popEffects.push({ x, y, age: 0, life: 14 });
	}

	const CONFETTI_COLORS = ["#ffd23f", "#ff9f43", "#ff6b6b", "#8ee3ff", "#ffffff"];
	function spawnConfettiBurst(x, y, count) {
		for (let i = 0; i < count; i++) {
			s.confetti.push({
				x, y,
				vx: (Math.random() - 0.5) * 8,
				vy: -Math.random() * 6 - 2,
				rot: Math.random() * Math.PI * 2,
				vrot: (Math.random() - 0.5) * 0.5,
				color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
				size: 5 + Math.random() * 6,
				age: 0,
				life: 60 + Math.random() * 40,
			});
		}
	}

	s.pendulum = createPendulumController({
		centerX: W / 2,
		charaminy: isBoss ? 100 : 50,
		charamaxy: isBoss ? 440 : 600,
	});

	s.rollButton = createRollButton({
		x: 32 * 10, y: H - 32 - 2, radius: 32,
		onActivate: () => { s.pendulum.setMuteki(true); },
		onDeactivate: () => { s.pendulum.setMuteki(false); },
	});
	// レベル間で回転ゲージを引き継ぐ
	if (config.rollButtonState) {
		const rb = config.rollButtonState;
		s.rollButton.isDisabled = rb.isDisabled;
		s.rollButton.isExecuted = rb.isExecuted;
		s.rollButton.timeElapsed = rb.timeElapsed;
		if (s.rollButton.isExecuted) s.pendulum.setMuteki(true);
	}

	/* ---- 汚れ（コショウ）グリッド ---- */
	s.yogoreArray = [];
	function createYogoreGrid() {
		const arr = [];
		// i:x方向のマス数, j:y方向のマス数
		const iCount = isBoss ? 21 : 21;
		const jCount = isBoss ? 21 : 24;
		const size = 16;
		for (let i = 0; i < iCount; i++) {
			for (let j = 0; j < jCount; j++) {
				if (j === 0 && i >= 9 && i <= 12) continue;
				if (isBoss && j === 20 && (i >= 20 || i <= 0)) continue;
				arr.push({
					x: 16 + i * size, y: 96 + j * size,
					isMovingOut: false, vx: 0, vy: 0, vr: 0, g: 0, rotation: 0,
				});
			}
		}
		return arr;
	}
	s.yogoreArray = createYogoreGrid();

	/* ---- 障害物（モフモフ）：メインシーンのみ ---- */
	s.barriers = [];
	if (!isBoss) {
		let barrierNum = getRandomInt(0, 4);
		if (s.level === 1) barrierNum = 0;
		else if (s.level === 2) barrierNum = 1;
		else if (s.level === 3) barrierNum = 2;
		else if (s.level === 4) barrierNum = 3;
		for (let i = 0; i < barrierNum; i++) {
			const x = Math.random() * W, y = Math.random() * H;
			s.barriers.push({
				x, y, originalX: x, rotation: 0,
				collision: false, vibrationTime: 0,
				w: IMG.mofu.width * 1.5, h: IMG.mofu.height * 1.5,
			});
		}
	}

	/* ---- ボス（だいまおうさま） ---- */
	if (isBoss) {
		s.bossX = W / 2;
		s.bossBaseY = 550;
		s.bossY = s.bossBaseY;
		s.bossRapidX = 1;
		s.bossRapidY = 0;
		s.bossFrame = 0;
		s.bossHitFlashTimer = 0;
		s.bossMaxHp = 500;
		s.bossHp = 500;
		s.bossWin = false;
	}

	/* ---- ヒント表示テキスト ---- */
	const tipHintsCount = t("tipHints").length;
	let defaultHintIndex;
	if (s.level === 1) defaultHintIndex = 1;
	else if (s.level === 2) defaultHintIndex = 2;
	else if (s.level === 3) defaultHintIndex = 3;
	else if (s.level === 4) defaultHintIndex = 0;
	else if (s.level % 4 === 0) defaultHintIndex = 0;
	else defaultHintIndex = getRandomInt(1, tipHintsCount - 1);
	s.defaultHintIndex = defaultHintIndex;
	s.hintText = t("tipHints")[s.defaultHintIndex];

	/* ---- 汚れとの当たり判定・消滅処理 ---- */
	function checkYogoreCollision(obj, threshold) {
		s.yogoreArray.forEach((yo) => {
			if (!yo.isMovingOut) {
				let distance = Math.hypot(obj.x - yo.x, obj.y - yo.y);
				if (s.pendulum.muteki) distance -= 65;
				if (distance < threshold || (isBoss && s.bossWin)) {
					yo.isMovingOut = true;
					yo.vx = Math.random() - 0.5;
					yo.vy = Math.random() < 0.5 ? 0.5 : -0.5;
					yo.vr = Math.random() < 0.5 ? 1 : -1;
					yo.g = 1;
					totalScore += 1;
					s.rollButton.notifyBlockTouch();

					// ヒットフィードバック：消えた場所に小さな光の輪
					if (!(isBoss && s.bossWin)) {
						spawnPopEffect(yo.x, yo.y);
					}
				}
			}
		});
	}

	function updateYogore(delta) {
		for (let i = s.yogoreArray.length - 1; i >= 0; i--) {
			const yo = s.yogoreArray[i];
			if (!yo.isMovingOut) continue;
			yo.g += 0.2 * delta;
			yo.x += yo.vx * 10 * delta;
			yo.y += (yo.vy * 1 + yo.g) * delta;
			yo.rotation += yo.vr * delta;

			if (isBoss) {
				const distMao = Math.hypot(s.bossX - yo.x, s.bossY - yo.y);
				if (distMao < 50 && !s.bossWin) {
					s.bossHp = Math.max(0, s.bossHp - 1);
					yo.y = H + 300;
					s.bossHitFlashTimer = 60;
					s.hitRings.push({ x: s.bossX, y: s.bossY, age: 0, life: 18 });
					if (s.bossHp <= 0) triggerBossWin();
				}
			}
			if (yo.x < -50 || yo.x > W + 50 || yo.y < -50 || yo.y > H + 50) {
				s.yogoreArray.splice(i, 1);
			}
		}

		if (s.yogoreArray.length === 0) {
			if (isBoss) {
				if (!s.bossWin) s.yogoreArray = createYogoreGrid();
			} else if (!s.isResetting) {
				s.isResetting = true;
				s.showClearText = true;
				s.clearText = t("cleanSuccessText");
				s.clearTextY = 180;
				setTimeout(() => {
					const nextLevel = s.level + 1;
					if (nextLevel % 4 === 0) {
						// ボス戦への突入はスライドなしで即時切り替え
						gameplayState = createGameplayState({ isBoss: true, level: nextLevel, rollButtonState: s.rollButton });
					} else {
						startTransition(() => {
							gameplayState = createGameplayState({ isBoss: false, level: nextLevel, rollButtonState: s.rollButton });
						}, t("cleanSuccessText"));
					}
				}, 100);
			}
		}
	}

	/* ---- 障害物との衝突判定：メインシーンのみ ---- */
	function checkBarrierCollision() {
		const heroW = SHEEP_FRAMES[0].w * 2, heroH = SHEEP_FRAMES[0].h * 2;
		s.barriers.forEach((b) => {
			const sx0 = s.pendulum.x - heroW / 2, sx1 = s.pendulum.x + heroW / 2;
			const sy0 = s.pendulum.y - heroH / 2, sy1 = s.pendulum.y + heroH / 2;
			const bx0 = b.x - b.w / 2, bx1 = b.x + b.w / 2;
			const by0 = b.y - b.h / 2, by1 = b.y + b.h / 2;
			if (sx0 < bx1 - 16 && sx1 > bx0 + 16 && sy0 < by1 && sy1 > by0) {
				b.collision = true;
				b.vibrationTime = 0;
				s.pendulum.angleVelocity *= -1.1;
				s.rollButton.notifyBound();
				s.pendulum.forceMoveOutOfBarrier(b.y);
			}
		});
	}

	function updateBarrierVibration(delta) {
		s.barriers.forEach((b) => {
			if (!b.collision) return;
			b.vibrationTime += delta;
			const amplitude = 5;
			b.x = b.originalX - amplitude / 2 + Math.sin(b.vibrationTime * 10) * amplitude;
			checkYogoreCollision(b, 30);
			if (b.vibrationTime > 30) {
				b.collision = false;
				b.vibrationTime = 0;
				b.x = b.originalX + Math.sin(Math.random()) * 16;
			}
		});
	}

	function triggerBossWin() {
		s.bossWin = true;
		s.showClearText = true;
		s.clearText = t("bossVictoryText");
		s.clearTextY = 180;
		s.hintText = "";
		s.flashAlpha = 1;
		s.hpBarShake = 20;
		spawnConfettiBurst(s.bossX, s.bossY, 70);
	}

	s.update = function (delta) {
		s.frameTick += delta;
		s.heroFrame = walkFrame(Math.floor(s.frameTick), 10, 4);

		s.pendulum.update(delta);
		s.rollButton.update(delta);

		if (s.rollButton.isExecuted) s.hintText = t("rollActiveHint");
		else if (s.rollButton.isDisabled) s.hintText = t("tipHints")[s.defaultHintIndex];
		else s.hintText = t("rollReadyHint");

		if (!isBoss) {
			checkBarrierCollision();
			updateBarrierVibration(delta);
		} else if (!s.bossWin) {
			s.bossX += s.bossRapidX * delta;
			if (s.bossX + 32 >= W || s.bossX - 32 <= 0) s.bossRapidX *= -1;
			s.bossRapidY = (s.bossRapidY + 2 * delta) % 360;
			s.bossY = s.bossBaseY + 16 * Math.sin(s.bossRapidY * Math.PI / 180);
			s.bossFrame = 0;
			if (s.bossHitFlashTimer > 0) {
				s.bossHitFlashTimer -= delta;
				s.bossFrame = 1;
				if (s.bossHitFlashTimer <= 0) { s.bossHitFlashTimer = 0; s.bossFrame = 0; }
			}
		}

		checkYogoreCollision(s.pendulum, 50);
		updateYogore(delta);

		// ヒットフィードバック演出の更新
		for (let i = s.popEffects.length - 1; i >= 0; i--) {
			const p = s.popEffects[i];
			p.age += delta;
			if (p.age >= p.life) s.popEffects.splice(i, 1);
		}
		for (let i = s.hitRings.length - 1; i >= 0; i--) {
			const r = s.hitRings[i];
			r.age += delta;
			if (r.age >= r.life) s.hitRings.splice(i, 1);
		}
		if (s.flashAlpha > 0) s.flashAlpha = Math.max(0, s.flashAlpha - 0.04 * delta);
		if (s.hpBarShake > 0) s.hpBarShake -= delta;
		for (let i = s.confetti.length - 1; i >= 0; i--) {
			const c = s.confetti[i];
			c.x += c.vx * delta; c.y += c.vy * delta; c.vy += 0.15 * delta; c.rot += c.vrot * delta; c.age += delta;
			if (c.age >= c.life) s.confetti.splice(i, 1);
		}

		if (isBoss && s.bossWin) {
			s.bossY -= 4 * delta;
			s.bossRotation = (s.bossRotation || 0) + 0.1 * delta;
			s.bossFrame = 1;
			if (s.bossY < 0) {
				if (gamemode === 0) {
					// リザルトへはスライドなしで即時切り替え
					goToClear();
				} else {
					const nextLevel = s.level + 1;
					startTransition(() => {
						gameplayState = createGameplayState({ isBoss: false, level: nextLevel, rollButtonState: s.rollButton });
					}, t("bossVictoryText"));
				}
			}
		}

		// 「お掃除大成功！」演出の点滅
		if (s.showClearText) {
			if (s.clearFadingOut) {
				s.clearAlpha -= (s.clearAlpha > 0.6 ? 0.04 : 0.25) * delta;
				if (s.clearAlpha <= 0) s.clearFadingOut = false;
			} else {
				s.clearAlpha += (s.clearAlpha > 0.6 ? 0.04 : 0.25) * delta;
				if (s.clearAlpha >= 1) s.clearFadingOut = true;
			}
		}
	};

	s.draw = function (offsetX) {
		ctx.save();
		ctx.translate(offsetX, 0);

		const bg = makeSprite(IMG.world2, { x: 0, y: 0, scaleX: 4, scaleY: 4, alpha: 0.5 });
		drawSprite(bg);

		s.yogoreArray.forEach((yo) => {
			drawSprite(makeSprite(IMG.yogore, { x: yo.x, y: yo.y, anchorX: 0.5, anchorY: 0.5, rotation: yo.rotation }));
		});

		if (isBoss) {
			const mao = makeSprite(IMG.daimao2, {
				x: s.bossX, y: s.bossY,
				anchorX: 0.5, anchorY: 0.5, scaleX: 2, scaleY: 2,
				rotation: s.bossRotation || 0,
				frame: DAIMAO2_FRAMES[s.bossFrame],
				tint: s.bossHitFlashTimer > 0 ? "rgba(204,102,102,0.6)" : null,
			});
			drawSprite(mao);

			// 被弾衝撃波リング
			s.hitRings.forEach((r) => {
				const p = r.age / r.life;
				const radius = 8 + p * 36;
				const alpha = (1 - p) * 0.85;
				ctx.save();
				ctx.globalCompositeOperation = "lighter";
				ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
				ctx.lineWidth = 4 * (1 - p) + 1;
				ctx.beginPath();
				ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();
			});
		} else {
			s.barriers.forEach((b) => {
				drawSprite(makeSprite(IMG.mofu, { x: b.x, y: b.y, anchorX: 0.5, anchorY: 0.5, scaleX: 1.5, scaleY: 1.5, rotation: b.rotation }));
			});
		}

		s.pendulum.drawLine(0);

		// 無敵中に通った道筋を光の帯として残す
		const lt = s.pendulum.lightTrail;
		if (lt.length > 1) {
			ctx.save();
			ctx.globalCompositeOperation = "lighter";
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			for (let i = 1; i < lt.length; i++) {
				const p0 = lt[i - 1], p1 = lt[i];
				const fade = Math.max(0, 1 - p1.age / 45);
				ctx.strokeStyle = `rgba(255,225,110,${fade * 0.5})`;
				ctx.lineWidth = 12 * fade + 2;
				ctx.beginPath();
				ctx.moveTo(p0.x, p0.y);
				ctx.lineTo(p1.x, p1.y);
				ctx.stroke();
			}
			ctx.restore();
		}

		// 無敵中
		if (s.pendulum.muteki) {
			const age = s.frameTick;
			const pulse = 0.7 + 0.3 * Math.sin(age * 0.35);
			const px = s.pendulum.x, py = s.pendulum.y;

			ctx.save();
			ctx.globalCompositeOperation = "lighter";

			// 大きめの二重グラデーションオーラ
			const outerR = 60;
			const grad = ctx.createRadialGradient(px, py, 0, px, py, outerR);
			grad.addColorStop(0, `rgba(255,255,210,${0.75 * pulse})`);
			grad.addColorStop(0.4, `rgba(255,225,90,${0.55 * pulse})`);
			grad.addColorStop(0.7, `rgba(255,180,40,${0.32 * pulse})`);
			grad.addColorStop(1, "rgba(255,180,40,0)");
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(px, py, outerR, 0, Math.PI * 2);
			ctx.fill();

			// 明滅するリング
			ctx.strokeStyle = `rgba(255,255,225,${0.7 * pulse})`;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(px, py, 28 + 5 * Math.sin(age * 0.25), 0, Math.PI * 2);
			ctx.stroke();

			// 周囲を回転しながら明滅する星形キラキラ
			const sparkleCount = 7;
			for (let i = 0; i < sparkleCount; i++) {
				const a = age * 0.07 + (i / sparkleCount) * Math.PI * 2;
				const r = 40 + 12 * Math.sin(age * 0.12 + i * 1.3);
				const sx = px + Math.cos(a) * r;
				const sy = py + Math.sin(a) * r;
				const blink = 0.5 + 0.5 * Math.sin(age * 0.4 + i * 1.7);
				if (blink < 0.25) continue;
				const sSize = 4 + blink * 5;
				ctx.save();
				ctx.translate(sx, sy);
				ctx.rotate(age * 0.08 + i);
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

			s.pendulum.trail.forEach((tp, i) => {
				drawSprite(makeSprite(IMG.sheep, {
					x: tp.x, y: tp.y, anchorX: 0.5, anchorY: 0.5,
					scaleX: 2, scaleY: -2, rotation: tp.rotation,
					frame: SHEEP_FRAMES[s.heroFrame],
					alpha: ((i + 1) / (s.pendulum.trail.length + 1)) * 0.4,
				}));
			});
		}

		const hero = makeSprite(IMG.sheep, {
			x: s.pendulum.x, y: s.pendulum.y, anchorX: 0.5, anchorY: 0.5,
			scaleX: 2, scaleY: -2, rotation: s.pendulum.rotation,
			frame: SHEEP_FRAMES[s.heroFrame],
		});
		drawSprite(hero);

		// コショウが消えた瞬間の小さな光の輪
		s.popEffects.forEach((p) => {
			const pr = p.age / p.life;
			const radius = 2 + pr * 12;
			const alpha = (1 - pr) * 0.85;
			ctx.save();
			ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
			ctx.lineWidth = 1.5 * (1 - pr) + 0.4;
			ctx.beginPath();
			ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		});

		if (isBoss) {
			const shakeX = s.hpBarShake > 0 ? (Math.random() - 0.5) * 6 : 0;
			const barwidth = 300 * (s.bossHp / s.bossMaxHp);
			fillRoundRect(10 + shakeX, 35, 340, 30, 0, "#000000");
			const hpColor = s.bossHp < s.bossMaxHp * 0.3 ? "#ff3333" : s.bossHp < s.bossMaxHp * 0.6 ? "#ffff66" : "#66ff66";
			fillRoundRect(10 + shakeX, 35, Math.max(0, barwidth), 30, 0, hpColor);
		}

		// 紙吹雪
		s.confetti.forEach((c) => {
			const alpha = Math.max(0, 1 - c.age / c.life);
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.translate(c.x, c.y);
			ctx.rotate(c.rot);
			ctx.fillStyle = c.color;
			ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
			ctx.restore();
		});

		drawHud(s);

		// ボス戦中はヒントウィンドウを非表示
		if (!isBoss) {
			fillRoundRect(5, 485, 272, 55, 0, "rgba(0,0,0,0.5)");
			strokeRoundRect(5, 485, 272, 55, 0, "#66ccff", 2);
			const hintWrapped = wrapText(s.hintText, 254, 15, "");
			drawText(hintWrapped, 12, 508, { size: 15, color: "#fff", stroke: "#66ccff", strokeWidth: 1, lineHeight: 18 });
		}

		s.rollButton.draw(0);

		ctx.restore();

		// ボス撃破の瞬間、画面全体を白く一瞬フラッシュさせる
		if (s.flashAlpha > 0) {
			ctx.save();
			ctx.globalAlpha = Math.min(1, s.flashAlpha);
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, W, H);
			ctx.restore();
		}

		// クリア演出テキストは画面固定表示
		if (s.showClearText) {
			ctx.save();
			ctx.globalAlpha = s.clearAlpha;
			const clearTextSize = fitFontSize(s.clearText, W - 40, 30, "bold");
			drawText(s.clearText, W / 2, s.clearTextY, {
				size: clearTextSize, weight: "bold", align: "center", color: "#fff", stroke: "#000", strokeWidth: 4, shadow: true,
			});
			ctx.restore();
		}
	};

	return s;
}

/* ==================== クリアシーン ==================== */
function createClearState() {
	const s = {};
	s.update = function () { };
	s.draw = function (offsetX) {
		ctx.save();
		ctx.translate(offsetX, 0);

		fillRoundRect(30, 50, 300, 450, 0, "#fff0e0");
		strokeRoundRect(30, 50, 300, 450, 0, "#e0ce92", 10);

		const clearTitleSize = fitFontSize(t("clearTitle"), 280, 40, "bold");
		const clearTitleTop = 110 - clearTitleSize;
		const clearTitleW = measureText(t("clearTitle"), clearTitleSize, "bold");
		drawText(t("clearTitle"), W / 2, clearTitleTop, {
			size: clearTitleSize, weight: "bold", align: "center", baseline: "top",
			color: "#e0ce92", stroke: "#3c2f2a", strokeWidth: 3,
		});

		const clearLineW = clearTitleW + 20;
		fillRoundRect(W / 2 - clearLineW / 2, 120, clearLineW, 4, 0, "rgba(110,75,61,0.5)");

		const mao = makeSprite(IMG.daimao2, { x: W / 2, y: 255, anchorX: 0.5, anchorY: 0.5, scaleX: 4, scaleY: 4, alpha: 0.3, frame: DAIMAO2_FRAMES[1] });
		drawSprite(mao);
		const gomenne = makeSprite(IMG.hansei, { x: W / 2, y: 255, anchorX: 0.5, anchorY: 0.5, scaleX: 4, scaleY: 4, alpha: 0.3 });
		drawSprite(gomenne);

		const reasonWrapped = wrapText(t("clearReason"), 280, 20, "bold");
		drawText(reasonWrapped, W / 2, 157, { size: 20, weight: "bold", align: "center", color: "#000", lineHeight: 25 });

		const today = new Date();
		const dateText = t("dateFmt")(today.getFullYear(), today.getMonth() + 1, today.getDate());
		const dateSize = 18;
		const dateJaText = I18N.ja.dateFmt(today.getFullYear(), today.getMonth() + 1, today.getDate());
		const dateRightX = W / 2 + 10 + measureText(dateJaText, dateSize, "");
		drawText(dateText, dateRightX, 465, {
			size: dateSize, align: "right", color: "#3c2f2a",
		});

		const scoreSize = fitFontSize(t("totalScoreFmt")(totalScore), 260, 28, "bold");
		drawText(t("totalScoreFmt")(totalScore), W / 2, 344, { size: scoreSize, weight: "bold", align: "center", color: "#000", stroke: "#fff0e0", strokeWidth: 1 });

		drawButton(BTN_TOTITLE, t("backToTitleBtn"), { bg: "#6fae6f", size: 22, color: "#fff", shadow: true });
		drawLangButton();

		ctx.restore();
	};
	return s;
}

/* ==================== メインループ ==================== */
let lastTime = performance.now();
function frame(now) {
	const delta = Math.min(4, (now - lastTime) / (1000 / 60));
	lastTime = now;

	if (sceneTransition) {
		updateTransition(delta);
	} else if (scene === "title") {
		titleState.update(delta);
	} else if (scene === "gameplay") {
		gameplayState.update(delta);
	}

	ctx.clearRect(0, 0, W, H);
	const offsetX = currentTransitionOffset();
	if (scene === "title") titleState.draw(offsetX);
	else if (scene === "gameplay") gameplayState.draw(offsetX);
	else if (scene === "clear") clearState.draw(offsetX);
	drawTransitionOverlay();

	requestAnimationFrame(frame);
}

/* ==================== 起動 ==================== */
loadAllImages().then(() => {
	updateDocumentTitle();
	goToTitle();
	requestAnimationFrame(frame);
});
