"use strict";

/* ==================== 基本設定 ==================== */
const W = 360, H = 548;
const PLAY_X = 20, PLAY_Y = 58, PLAY_W = 320, PLAY_H = 428;
const CX = PLAY_X + PLAY_W / 2, CY = PLAY_Y + PLAY_H / 2;
const PLAYER_RADIUS = 16;
const PLAYER_ANGLE = Math.PI / 6; // 扇形の半角
const MAX_TIME = 60000; // ms（クリアまでの時間）
const TIP_RADIUS = 6; // 先端の当たり判定円の半径（元のcircleRadius）
const WALL_HIT_RADIUS = 10; // 壁反射の判定半径
const SPEED_BASE = 1.8;
const WARNING_LIFE = 800; // ms（予告の点滅時間、元は0.4s×2）
const WARNING_FLOW_SPEED = 0.12; // px/ms（予告ライン内を流れる矢印の速さ）

// 狙い撃ち：30秒以降、予告した瞬間の自機の位置めがけて飛んでくる
const AIM_START = 30000;
const AIM_WARNING_LIFE = 900;
const AIM_SPEED_MUL = 1.4;
const COL_AIM = "#ff6a3d";
// 隊列：残り30秒・10秒の節目で一列に押し寄せる。隙間（SAFE）は自機の近くに必ず作る
const FORMATION_TIMES = [30000, 50000];
const FORMATION_COUNT = 9; // 1列の枠の数（うち2枠が隙間）
const FORMATION_WARNING_LIFE = 1500; // 通常より長めに予告して判断の時間を与える
const FORMATION_SPEED = 1.1;
const FORMATION_QUIET = 1800; // 隊列の前後は通常の敵と狙い撃ちを出さない
const COL_SAFE = "#7dff9a";

const ITEM_LIFE = 6500; // ms（アイテムが消えるまでの時間）
const GRAZE_RADIUS = 26; // かすり判定の半径（先端からの距離）
const COMBO_WINDOW = 2000; // ms（この時間かすらないとコンボが切れる）
const GRAZE_SCORE = 50; // かすり1回の基本点（×コンボ数）
const GIRI_RADIUS = 12; // ギリギリ判定の半径（先端からの距離）
const GIRI_SCORE = 150; // ギリギリの基本点（×コンボ数）。かすりの3倍
const GIRI_SLOW_HOLD = 250; // ms（ギリギリの瞬間、この間20%の速さになる）
const GIRI_SLOW_BACK = 250; // ms（そこから元の速さに戻るまで）
const GIRI_SLOW_MIN = 0.2;
const COL_GIRI = "#ff6a3d";
const KILL_SCORE = 30;
const ABSORB_SCORE = 100;
const POWER_SAFE_RADIUS = 90; // 自機からこの距離以内にはアイテムを出さない
const POWER_AHEAD_FRAMES = 45; // 約0.75秒先の進路上も避ける
const POWER_MIN_GAP = 60; // アイテム同士の最小距離
const ITEM_SCORE = 30; // アイテム取得時の点（リスクの低い行動なので撃破と同じ“おまけ”程度）
const BARRIER_REGEN = 4000; // ms（バリアが1個復活するまでの時間、Lvに関係なく固定）
const SHOCKWAVE_RADIUS = 70; // バリアが身代わりになったときの衝撃波の最大半径
const SHOCKWAVE_LIFE = 350; // ms
const SURVIVAL_SCORE_PER_SEC = 100;

// クリア演出のタイミング（ms）
const CLEAR_FREEZE = 250; // 0秒で時間を止める長さ
const CLEAR_KNOCK = 400; // 残骸が外へ弾かれる時間
const CLEAR_FLY = 550; // 残骸がスコアへ飛ぶ時間
const CLEAR_GAP = 80; // 残骸を吸い込む間隔
const CLEAR_ORBIT_R = 90; // クリア後に自機が描く円の半径
const HIT_FREEZE = 400; // 被弾の瞬間に全ての動きを止める時間（ヒットストップ）
const HIT_RESULT_DELAY = 500; // 爆発からリザルト表示開始まで

const COL_BG = "#060a1c", COL_FIELD = "#0b1230", COL_GRID = "#16204a", COL_BORDER = "#2b3f9a";
const COL_PLAYER = "#37f0ff", COL_ENEMY = "#ff3cac", COL_GRAZE = "#ffe65c", COL_DANGER = "#ff2b5e", COL_SUB = "#6b7bd6";
const ITEM_COLORS = { speed: "#aee8ff", attack: "#ffd8a8", defense: "#c8facc" };
const POWER_LABELS = { speed: "S", attack: "A", defense: "D" };
const CONFETTI_COLORS = ["#37f0ff", "#ffe65c", "#ff3cac", "#aee8ff", "#c8facc", "#ffd8a8"];
const SCORE_POS = { x: W - 60, y: 36 };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function easeOutQuad(t2) { return 1 - (1 - t2) * (1 - t2); }
function easeOutBack(t2) { const c1 = 1.7, c3 = c1 + 1; const p = t2 - 1; return 1 + c3 * p * p * p + c1 * p * p; }

/* ==================== Canvas 基本ヘルパー ==================== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const FONT = "'Hiragino Sans', 'Yu Gothic', Meiryo, Arial, sans-serif";

function drawText(text, x, y, opts) {
	opts = opts || {};
	const size = opts.size || 16;
	const weight = opts.weight || "";
	const lineHeight = opts.lineHeight || size * 1.3;
	ctx.save();
	ctx.font = (weight + " " + size + "px " + FONT).trim();
	ctx.textAlign = opts.align || "left";
	ctx.textBaseline = opts.baseline || "alphabetic";
	ctx.globalAlpha = opts.alpha != null ? clamp(opts.alpha, 0, 1) : 1;
	String(text).split("\n").forEach((line, i) => {
		const ly = y + i * lineHeight;
		if (opts.strokeWidth && opts.stroke) {
			ctx.lineWidth = opts.strokeWidth;
			ctx.strokeStyle = opts.stroke;
			ctx.lineJoin = "round";
			ctx.strokeText(line, x, ly);
		}
		if (!opts.noFill) {
			ctx.fillStyle = opts.color || "#fff";
			ctx.fillText(line, x, ly);
		}
	});
	ctx.restore();
}

/* 縁取りだけの文字（中央タイマーの数字・ロゴなど）。
 * Androidの標準フォント(Roboto)などは「8」の上下の輪のように輪郭を重ねて字形を作っているため、
 * strokeTextで縁取りだけを描くと重なった内側の線まで見えてしまう。
 * そこで別のcanvasに「太めに縁取り → 文字の塗りの部分をくり抜く」と描き、外側の輪郭だけを残してから貼る。
 * 文字・色が変わらない限り作り直さないようキャッシュする。 */
const outlineTextCache = new Map();
function drawOutlineText(text, x, y, opts) {
	const size = opts.size || 16, weight = opts.weight || "", lw = opts.strokeWidth || 3;
	const key = [text, size, weight, opts.stroke, lw].join("|");
	let img = outlineTextCache.get(key);
	if (!img) {
		const font = `${weight} ${size}px ${FONT}`.trim();
		const pad = lw * 2 + 4;
		const w = Math.ceil(measureTextWidth(text, size, weight) + pad * 2);
		const h = Math.ceil(size * 1.5 + pad * 2);
		img = document.createElement("canvas");
		img.width = w;
		img.height = h;
		const c = img.getContext("2d");
		c.font = font;
		c.textAlign = "center";
		c.textBaseline = "middle";
		c.lineJoin = "round";
		c.lineWidth = lw * 2; // 外側に残るのは半分なので2倍で描く
		c.strokeStyle = opts.stroke;
		c.strokeText(text, w / 2, h / 2);
		c.globalCompositeOperation = "destination-out"; // 文字の内側（重なった輪郭の線を含む）を消す
		c.fillText(text, w / 2, h / 2);
		if (outlineTextCache.size > 64) outlineTextCache.clear();
		outlineTextCache.set(key, img);
	}
	ctx.save();
	ctx.globalAlpha = opts.alpha != null ? clamp(opts.alpha, 0, 1) : 1;
	ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
	ctx.restore();
}

function measureTextWidth(text, size, weight) {
	ctx.save();
	ctx.font = `${weight || ""} ${size}px ${FONT}`.trim();
	const w = ctx.measureText(text).width;
	ctx.restore();
	return w;
}

function wrapText(text, maxWidth, size, weight) {
	ctx.save();
	ctx.font = `${weight || ""} ${size}px ${FONT}`.trim();
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

/* 中央揃えで複数行を描画する（英語版で長くなりがちな称号などに使う） */
function drawWrappedCentered(text, cx, cy, maxWidth, opts) {
	opts = opts || {};
	const size = opts.size || 16;
	const wrapped = wrapText(text, maxWidth, size, opts.weight);
	const lines = wrapped.split("\n");
	const lineHeight = opts.lineHeight || size * 1.25;
	const totalH = (lines.length - 1) * lineHeight;
	drawText(wrapped, cx, cy - totalH / 2, Object.assign({}, opts, { align: "center", baseline: "middle", lineHeight }));
	return lines.length;
}

function fitFontSize(text, maxWidth, initialSize, weight) {
	let size = initialSize;
	while (size > 12 && measureTextWidth(text, size, weight) > maxWidth) size -= 1;
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
function strokeRoundRect(x, y, w, h, r, stroke, lineWidth, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha != null ? alpha : 1;
	roundRectPath(x, y, w, h, r);
	ctx.strokeStyle = stroke;
	ctx.lineWidth = lineWidth || 2;
	ctx.stroke();
	ctx.restore();
}
function fillCircle(x, y, r, fill, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha != null ? clamp(alpha, 0, 1) : 1;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.restore();
}
function strokeCircle(x, y, r, stroke, lineWidth, alpha) {
	if (r <= 0) return;
	ctx.save();
	ctx.globalAlpha = alpha != null ? clamp(alpha, 0, 1) : 1;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.strokeStyle = stroke;
	ctx.lineWidth = lineWidth;
	ctx.stroke();
	ctx.restore();
}
function starPath(x, y, r) {
	ctx.beginPath();
	for (let i = 0; i < 10; i++) {
		const rr = i % 2 ? r * 0.45 : r;
		const a = -Math.PI / 2 + i * Math.PI / 5;
		ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
	}
	ctx.closePath();
}
function drawSpikyStar(x, y, rot, color, size) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rot);
	starPath(0, 0, size || 11);
	ctx.fillStyle = color;
	ctx.fill();
	ctx.restore();
}

/* ==================== 効果音（Web Audioで生成、外部ファイルなし） ==================== */
let audioCtx = null;
// 音のON/OFFは端末に保存せず、開くたびにONから始める
// （保存しても、開き直したときはタップしないと音の準備が始められないため、確認ダイアログはどのみち必要）
let soundOn = true;
// このページを開いてから音のON/OFFを選んだか（ダイアログで選んだ、またはタイトルの♪ボタンを押した）。
// まだなら、スマホで最初にゲームを始めるときに「サウンドを鳴らしますか？」の確認を出す
let soundChosen = false;
let sfxMuted = false; // タイトルのデモプレイ中は効果音を鳴らさない
function setSound(on) {
	soundOn = on;
	soundChosen = true;
}
// 全ての音はマスター音量 → リミッター（音割れ防止）を通してから出す
const MASTER_VOLUME = 0.8; // 全体の音量（0〜1）。個々の音量を変えずに全体だけ上げ下げしたい時はここ
let masterBus = null;
let sfxIn = null; // 全ての効果音の入口。ここから「素の音」と「光のにじみ（こだま・残響）」に分かれてマスターへ
let sfxTone = null; // 入口の直後の高音調整フィルター
// クリア演出とリザルトでは、メダルのきらめきなど高い音が重なって耳に痛いので、この周波数より上を下げる
const RESULT_HIGH_CUT_HZ = 3000;
const RESULT_HIGH_CUT_DB = -9; // 下げる量（dB）。0で元どおり。-6→-9に強めた（さらに丸くするなら-12）
function sfxSoftHighs(on) {
	if (!audioCtx || !sfxTone) return;
	sfxTone.gain.setTargetAtTime(on ? RESULT_HIGH_CUT_DB : 0, audioCtx.currentTime, 0.03);
}
let noiseBuf = null;
// 光のにじみ＝画面のグローの音版。音色の方向性「シンセウェーブ」で決定（効果音ラボ：音色の方向性）
const GLOW = { delay: 0.3, feedback: 0.3, delayWet: 0.14, reverbSec: 1.8, reverbWet: 0.28 };
let audioKeepAlive = null;
function ensureAudio() {
	try {
		if (!audioCtx) {
			const AC = window.AudioContext || window.webkitAudioContext;
			if (!AC) return;
			audioCtx = new AC();
			const limiter = audioCtx.createDynamicsCompressor();
			limiter.threshold.value = -6; // これを超えた分だけ強く押さえる（普段の音には触らない）
			limiter.knee.value = 0;
			limiter.ratio.value = 20;
			limiter.attack.value = 0.002;
			limiter.release.value = 0.15;
			masterBus = audioCtx.createGain();
			masterBus.gain.value = MASTER_VOLUME;
			masterBus.connect(limiter);
			limiter.connect(audioCtx.destination);
			// 光のにじみ：こだま（0.3秒ごとに少しずつ小さく・こもって繰り返す）と残響（1.8秒）
			sfxIn = audioCtx.createGain();
			// 高音を和らげるフィルター（クリア演出とリザルトの間だけ効かせる。sfxSoftHighs で切り替え）
			sfxTone = audioCtx.createBiquadFilter();
			sfxTone.type = "highshelf";
			sfxTone.frequency.value = RESULT_HIGH_CUT_HZ;
			sfxTone.gain.value = 0;
			sfxIn.connect(sfxTone);
			sfxTone.connect(masterBus);
			const echo = audioCtx.createDelay(1);
			const echoFb = audioCtx.createGain();
			const echoLp = audioCtx.createBiquadFilter();
			const echoWet = audioCtx.createGain();
			echo.delayTime.value = GLOW.delay;
			echoFb.gain.value = GLOW.feedback;
			echoLp.type = "lowpass";
			echoLp.frequency.value = 4500;
			echoWet.gain.value = GLOW.delayWet;
			sfxTone.connect(echo); echo.connect(echoLp); echoLp.connect(echoFb); echoFb.connect(echo);
			echoLp.connect(echoWet); echoWet.connect(masterBus);
			const reverb = audioCtx.createConvolver();
			const revLen = Math.floor(audioCtx.sampleRate * GLOW.reverbSec);
			const ir = audioCtx.createBuffer(2, revLen, audioCtx.sampleRate);
			for (let ch = 0; ch < 2; ch++) {
				const d = ir.getChannelData(ch);
				for (let i = 0; i < revLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 3);
			}
			reverb.buffer = ir;
			const revWet = audioCtx.createGain();
			revWet.gain.value = GLOW.reverbWet;
			sfxTone.connect(reverb); reverb.connect(revWet); revWet.connect(masterBus);
			// ノイズ系の音（爆発など）用に、1秒分のホワイトノイズを作っておく
			noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
			const nd = noiseBuf.getChannelData(0);
			for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
		}
		if (audioCtx.state !== "running") {
			// スマホではブラウザが「指を離した瞬間」しか再生の許可に数えないことがあるため、
			// 押した瞬間・離した瞬間の両方で、動き出すまで毎回再開と無音再生を試みる（古いiOS Safari対策も兼ねる）
			audioCtx.resume();
			const buf = audioCtx.createBuffer(1, 1, 22050);
			const src = audioCtx.createBufferSource();
			src.buffer = buf;
			src.connect(audioCtx.destination);
			src.start(0);
		}
		// 聞こえないほど小さな音を鳴らし続けて、スマホのスピーカー出力を起こしたままにする
		// （出力が止まっていると、次の音が鳴り始めるまでに一瞬の遅れが出るため）
		if (!audioKeepAlive) {
			const osc = audioCtx.createOscillator();
			const g = audioCtx.createGain();
			g.gain.value = 0.00001;
			osc.frequency.value = 30;
			osc.connect(g);
			g.connect(audioCtx.destination);
			osc.start();
			audioKeepAlive = osc;
		}
	} catch (e) { audioCtx = null; masterBus = null; sfxIn = null; sfxTone = null; noiseBuf = null; }
}
// 同じ音が短い間隔で重なると急に大きくなるため、sfx名ごとに最短間隔（秒）を設けて間引く
const sfxLastAt = {};
function sfxThrottle(name, minGap) {
	if (!audioCtx) return false;
	const now = audioCtx.currentTime;
	if (sfxLastAt[name] != null && now - sfxLastAt[name] < minGap) return false;
	sfxLastAt[name] = now;
	return true;
}
function tone(freq, dur, vol, type, delay) {
	// "suspended"（タップ直後でまだ再開処理中）の間も予約はしておく。再開した瞬間に鳴るので最初の「3」が落ちない
	if (!soundOn || sfxMuted || !audioCtx || !sfxIn || audioCtx.state === "closed") return;
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.type = type || "sine";
	osc.frequency.value = freq;
	const n = audioCtx.currentTime + (delay || 0);
	gain.gain.setValueAtTime(0.0001, n);
	gain.gain.linearRampToValueAtTime(vol, n + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.001, n + dur);
	osc.connect(gain);
	gain.connect(sfxIn);
	osc.start(n);
	osc.stop(n + dur + 0.05);
}
// ノイズを帯域フィルターで削って1回叩く（type: "bandpass" / "highpass" / "lowpass"、Q=帯域の鋭さ）
function noiseHit(dur, vol, type, freq, Q, delay, freqTo) {
	if (!soundOn || sfxMuted || !audioCtx || !sfxIn || !noiseBuf || audioCtx.state === "closed") return;
	const src = audioCtx.createBufferSource();
	const filter = audioCtx.createBiquadFilter();
	const gain = audioCtx.createGain();
	src.buffer = noiseBuf;
	filter.type = type;
	filter.Q.value = Q || 1;
	const n = audioCtx.currentTime + (delay || 0);
	filter.frequency.setValueAtTime(freq, n);
	if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, n + dur); // 帯域を滑らせる（風切り音など）
	gain.gain.setValueAtTime(0.0001, n);
	gain.gain.linearRampToValueAtTime(vol, n + 0.001);
	gain.gain.exponentialRampToValueAtTime(0.001, n + dur);
	src.connect(filter);
	filter.connect(gain);
	gain.connect(sfxIn);
	src.start(n, Math.random() * 0.5); // 毎回ノイズの違う場所を使って、同じ音の繰り返し感を減らす
	src.stop(n + dur + 0.05);
}
// シンセの1音。o: { freq, dur, vol, type, to(滑り先の音程), sweep(滑る時間), attack, detune, lp(こもり具合), lpTo, lpTime(こもりが変わる時間。省略時はdur), delay }
function synth(o) {
	if (!soundOn || sfxMuted || !audioCtx || !sfxIn || audioCtx.state === "closed") return;
	const n = audioCtx.currentTime + (o.delay || 0);
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.type = o.type || "sine";
	osc.frequency.setValueAtTime(o.freq, n);
	if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, n + (o.sweep || o.dur));
	if (o.detune) osc.detune.value = o.detune;
	let head = osc;
	if (o.lp) {
		const f = audioCtx.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.setValueAtTime(o.lp, n);
		if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, n + (o.lpTime || o.dur));
		osc.connect(f); head = f;
	}
	head.connect(gain);
	gain.connect(sfxIn);
	gain.gain.setValueAtTime(0.0001, n);
	gain.gain.linearRampToValueAtTime(o.vol, n + (o.attack || 0.004));
	gain.gain.exponentialRampToValueAtTime(0.001, n + o.dur);
	osc.start(n);
	osc.stop(n + o.dur + 0.05);
}
// 少し音程をずらしたノコギリ波を2本重ねる＝シンセウェーブの太い音の基本（spread＝ずらす幅）
function saw2(o) {
	const sp = o.spread || 9;
	synth(Object.assign({}, o, { type: "sawtooth", detune: -sp }));
	synth(Object.assign({}, o, { type: "sawtooth", detune: sp }));
}
// 共通の音階：ラ・ド・レ・ミ・ソ（Aマイナーペンタトニック）。音程のある音はここから選ぶと重なっても濁らない
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA_MIDI = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96]; // A4〜C7

// ---- ここから下は音色の方向性「シンセウェーブ」で決定した音 ----
// 拍：秒の頭は低めの太い「ブン」、裏拍は小さく高い「ブッ」。残り30秒で×1.2、10秒で×1.5の音程
function sfxBeat(strong, sec) {
	const hi = sec <= 10 ? 1.5 : sec <= 30 ? 1.2 : 1;
	if (strong) saw2({ freq: 220 * hi, dur: 0.12, vol: 0.06, lp: 1400, lpTo: 250 });
	else saw2({ freq: 440 * hi, dur: 0.05, vol: 0.03, lp: 900, lpTo: 300 });
}
// かすり：シンセの「ポン」を、すれ違う車のように少し上から下へ曲げる（ドップラー）。ラボの「E すれ違い」で決定
// 音の中心はコンボごとに音階を1段ずつ上がる
function sfxGraze(combo) {
	const f = midiHz(PENTA_MIDI[Math.min(Math.max(combo, 1), 10) - 1]);
	saw2({ freq: f * Math.pow(2, 2 / 12), to: f * Math.pow(2, -3 / 12), sweep: 0.15, dur: 0.18, vol: 0.045, lp: 3200, lpTo: 700 });
}
// アイテム取得：出現のチャイム（ITEM_SPAWN_NOTE）をそのまま1オクターブ上で、少し大きく鳴らす
// Lv2で「キラッ」が1つ、Lv3で2つ余韻に加わる。ラボ「アイテム取得」のBで決定
function sfxItem(type, level) {
	const m = (ITEM_SPAWN_NOTE[type] || 81) + 12;
	synth({ type: "triangle", freq: midiHz(m), dur: 0.3, vol: 0.05, attack: 0.003 });
	synth({ type: "triangle", freq: midiHz(m + 7), dur: 0.3, vol: 0.035, attack: 0.003, delay: 0.05 });
	for (let i = 1; i < Math.min(level, 3); i++) {
		synth({ freq: midiHz(m + 12 + (i - 1) * 7), dur: 0.2, vol: 0.02, attack: 0.002, delay: 0.1 + i * 0.07 });
	}
}
// バリア復活：こもった「ミ」がふわっと明るくなる「ポワン」。ラボの「B」で決定
function sfxBarrierRegen() {
	saw2({ freq: midiHz(76), dur: 0.3, vol: 0.03, attack: 0.03, lp: 800, lpTo: 3500, lpTime: 0.15 });
}
// 衝撃波：こもったラ・ミの和音がパッと開き、風のノイズが外へ広がる「ブワッ」。ラボの「B」で決定
function sfxShockwave() {
	saw2({ freq: midiHz(57), dur: 0.4, vol: 0.05, lp: 300, lpTo: 4000, lpTime: 0.18 });
	saw2({ freq: midiHz(64), dur: 0.4, vol: 0.035, lp: 300, lpTo: 4000, lpTime: 0.18 });
	noiseHit(0.35, 0.1, "bandpass", 400, 1, 0, 3000);
}
// ギリギリ：ラ・ド・ミ・シの和音を、0.5秒のスローと同じ長さでゆっくり上→下へ沈ませる（時間が伸びる感じ）
// かすりの「すれ違い」と同じ曲げ幅（+2半音→-3半音）。ラボの「D スローに合わせてゆっくり」で決定
function sfxGiri() {
	[69, 72, 76, 83].forEach((m) => {
		const f = midiHz(m);
		saw2({ freq: f * Math.pow(2, 2 / 12), to: f * Math.pow(2, -3 / 12), sweep: 0.5, dur: 0.7, vol: 0.03, lp: 4500, lpTo: 500, spread: 12 });
	});
}
// 衝撃波・隊列・連射で同時に何体倒しても1回分の音にする（50ms以内の重複は鳴らさない）
// 撃破：短い破裂音＋落ちていくシンセの「パシュッ」。ラボの「B パシュッ」で決定
function sfxKill() {
	if (!sfxThrottle("kill", 0.05)) return;
	noiseHit(0.05, 0.12, "bandpass", 3000, 1.2);
	saw2({ freq: 880, to: 220, sweep: 0.08, dur: 0.1, vol: 0.035, lp: 3000, lpTo: 600 });
}
// 被弾の瞬間：短い衝撃ノイズと、音程が落ちるシンセ
function sfxHitStop() {
	noiseHit(0.08, 0.2, "bandpass", 2500, 1);
	saw2({ freq: 440, to: 110, sweep: 0.25, dur: 0.3, vol: 0.06, lp: 2000 });
}
// 被弾の爆発（ヒットストップ明け）：控えめなノイズの爆発。ラボの「A 控えめ爆発」で決定
function sfxHit() {
	noiseHit(0.75, 0.17, "lowpass", 1500, 0.7, 0, 160);
	saw2({ freq: 220, to: 55, sweep: 0.6, dur: 0.65, vol: 0.05, lp: 1000, lpTo: 180 });
}
// クリア：Aマイナーの大きな和音＋キラキラ（和音の音だけで2オクターブ上のラまで8音）。ラボの「8音」で決定
function sfxClearChord() {
	[57, 64, 69, 72, 76, 79].forEach((m) => saw2({ freq: midiHz(m), dur: 1.8, vol: 0.028, lp: 5000, lpTo: 1200, spread: 14, attack: 0.02 }));
	[81, 84, 88, 91, 93, 96, 100, 105].forEach((m, i) =>
		saw2({ freq: midiHz(m), dur: i === 7 ? 0.5 : 0.25, vol: 0.03 - i * 0.0015, lp: 5000 - i * 300, lpTo: 1400, delay: 0.15 + i * 0.09 }));
}
// クリア：壁が砕ける「ザッ」。音程のある音は和音とぶつかるので入れない（ノイズだけ）
function sfxWallCrash() {
	noiseHit(0.35, 0.1, "bandpass", 1800, 0.8, 0, 500);
}
// ---- 自機の操作（宇宙船イメージ）。ラボ「自機の操作」で決定 ----
// 長押し中：高く細い吸い込み「スー」（だんだん静かに）＋ごく薄いプラズマの「パチ」。離すか被弾・クリアで止まる
let holdSound = null;
function sfxHoldStart() {
	sfxHoldStop();
	if (!soundOn || sfxMuted || !audioCtx || !sfxIn || !noiseBuf || audioCtx.state === "closed") return;
	const n = audioCtx.currentTime;
	const vol = 0.028, sustain = 0.012, fadeIn = 0.15, decay = 1.2;
	const g = audioCtx.createGain();
	g.gain.setValueAtTime(0.0001, n);
	g.gain.linearRampToValueAtTime(vol, n + fadeIn);
	g.gain.exponentialRampToValueAtTime(sustain, n + fadeIn + decay);
	g.connect(sfxIn);
	// 吸い込み：細い帯域のノイズが 8000Hz → 2800Hz へ0.8秒で下がる
	const src = audioCtx.createBufferSource(), bp = audioCtx.createBiquadFilter();
	src.buffer = noiseBuf; src.loop = true;
	bp.type = "bandpass"; bp.Q.value = 4;
	bp.frequency.setValueAtTime(8000, n);
	bp.frequency.exponentialRampToValueAtTime(2800, n + 0.8);
	src.connect(bp); bp.connect(g);
	src.start(n, Math.random() * 0.5);
	src.stop(n + 30);
	// プラズマ：まばらな「パチ」を0.2秒ずつ先回りして予約していく（押している間だけ）
	const crackle = audioCtx.createGain();
	crackle.connect(sfxIn);
	let nextAt = n + 0.05;
	const schedule = () => {
		const until = audioCtx.currentTime + 0.3;
		while (nextAt < until) {
			const b = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), cg = audioCtx.createGain();
			const d = 0.008 + Math.random() * 0.012, v = (0.02 + Math.random() * 0.035) * 0.3;
			b.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = 3000 + Math.random() * 3000;
			cg.gain.setValueAtTime(0.0001, nextAt);
			cg.gain.linearRampToValueAtTime(v, nextAt + 0.001);
			cg.gain.exponentialRampToValueAtTime(0.001, nextAt + d);
			b.connect(f); f.connect(cg); cg.connect(crackle);
			b.start(nextAt, Math.random() * 0.5); b.stop(nextAt + d + 0.05);
			nextAt += (0.03 + Math.random() * 0.09) / 0.65;
		}
	};
	schedule();
	const timer = setInterval(schedule, 200);
	const levelAt = (at) => {
		if (at <= n + fadeIn) return Math.max(0.0001, vol * ((at - n) / fadeIn));
		return vol * Math.pow(sustain / vol, Math.min(1, (at - n - fadeIn) / decay));
	};
	holdSound = {
		stop() {
			clearInterval(timer);
			const at = audioCtx.currentTime;
			g.gain.cancelScheduledValues(at);
			g.gain.setValueAtTime(levelAt(at), at);
			g.gain.linearRampToValueAtTime(0.0001, at + 0.04);
			crackle.gain.setValueAtTime(0, at + 0.02);
			try { src.stop(at + 0.06); } catch (e) {}
			setTimeout(() => { try { g.disconnect(); crackle.disconnect(); } catch (e) {} }, 500);
		},
	};
}
function sfxHoldStop() {
	if (holdSound) { holdSound.stop(); holdSound = null; }
}
// 方向転換（指を離して飛び出す）：空気を一気に押し出す「パシュッ」（※保留：暫定）
function sfxTurn() {
	noiseHit(0.04, 0.09, "bandpass", 1800, 2);
	noiseHit(0.12, 0.04, "lowpass", 2200, 0.8, 0.015, 700);
	synth({ type: "triangle", freq: 260, to: 150, sweep: 0.04, dur: 0.05, vol: 0.03, attack: 0.002 });
}
// 壁で跳ね返る：方向転換と同じ作りで、低く硬く（※保留：方向転換とセット）
function sfxWall() {
	if (!sfxThrottle("wall", 0.08)) return;
	noiseHit(0.04, 0.09, "bandpass", 1100, 2);
	noiseHit(0.09, 0.04, "lowpass", 1500, 0.8, 0.015, 500);
	synth({ type: "triangle", freq: 190, to: 100, sweep: 0.04, dur: 0.06, vol: 0.05, attack: 0.002 });
}

// ---- アイテムまわり。ラボ「アイテムまわり」で仮決め ----
// アイテムは「柔らかく控えめ」、敵は「鋭く目立つ」に振り分け（ラボ「敵とアイテムの入れ替え」で決定）
// アイテムは拍（ノコギリ波）と食い合わないよう、丸い三角波で鳴らす
// アイテム出現：三角波のチャイム。S・A・Dで音程を変えて、耳でも種類が分かる
const ITEM_SPAWN_NOTE = { speed: 81, attack: 76, defense: 72 }; // ラ・ミ・ド
function sfxItemSpawn(type) {
	const m = ITEM_SPAWN_NOTE[type] || 81;
	synth({ type: "triangle", freq: midiHz(m), dur: 0.28, vol: 0.04 });
	synth({ type: "triangle", freq: midiHz(m + 7), dur: 0.22, vol: 0.025, delay: 0.05 });
}
// 消える直前：点滅に合わせて、ごく小さな三角波をラ・ミと交互に刻む（点滅の「点く」タイミングごとに1回）
function sfxItemBlink(k) {
	synth({ type: "triangle", freq: midiHz(k % 2 ? 76 : 81), dur: 0.04, vol: 0.018, attack: 0.002 });
}
// 取らずに消えた：三角波が小さく下がる
function sfxItemVanish() {
	synth({ type: "triangle", freq: midiHz(81), to: midiHz(72), sweep: 0.12, dur: 0.15, vol: 0.03, attack: 0.002 });
}
// アタックの弾の発射：撃破の「パシュッ」の頭だけを小さくした「ピュ」
function sfxFire() {
	saw2({ freq: 1200, to: 600, sweep: 0.03, dur: 0.04, vol: 0.01, lp: 4000 });
}

// ---- 節目。ラボ「節目」で仮決め ----
// クリアの「0」で時間が止まる瞬間：高く短い「キン」（0.25秒後にクリアの和音）
function sfxClearFreeze() {
	saw2({ freq: midiHz(93), dur: 0.06, vol: 0.025, lp: 6000, lpTo: 2000 });
	noiseHit(0.02, 0.06, "highpass", 5000);
}
// コンボが切れた（x2以上）：音がしぼむ「ヒュゥン」。大きいコンボほど高いところから長く下がる
function sfxComboEnd(combo) {
	const c = Math.min(combo, 10);
	const len = 0.18 + c * 0.03;
	saw2({ freq: midiHz(PENTA_MIDI[c - 1]), to: midiHz(64), sweep: len, dur: len + 0.03, vol: 0.02, lp: 3000, lpTo: 400 });
}
// UIの決定音（初回のサウンド確認でONを選んだとき）：四角い波形で「ピコッ」とラ→ミ
function sfxUiConfirm() {
	synth({ type: "square", freq: midiHz(81), dur: 0.05, vol: 0.04, attack: 0.002, lp: 4000 });
	synth({ type: "square", freq: midiHz(88), dur: 0.14, vol: 0.045, attack: 0.002, lp: 4000, delay: 0.06 });
}
// RETRYで再開：決定音（sfxUiConfirm）のあとに、GO!と同じ和音が「ブワッ」と開く
function sfxRetry() {
	sfxUiConfirm();
	[57, 64, 69, 72].forEach((m) => saw2({ freq: midiHz(m), dur: 0.5, vol: 0.03, lp: 400, lpTo: 5000, lpTime: 0.15, spread: 12, delay: 0.14 }));
}
// ボタンの決定音。タイトル画面（デモ中は消音）でも、この1回だけ鳴らす
function sfxUiButton() {
	const m = sfxMuted;
	sfxMuted = false;
	sfxUiConfirm();
	sfxMuted = m;
}

// ---- 敵の予告・出現（危険の音：ごほうびより鋭く、少し濁らせる）。ラボ「敵の予告・出現」で決定 ----
// 通常の敵の予告：半音ぶつかるミ・ファを同時に鳴らす短いブザーを2回「ブブッ」。1〜6体まとめて来ても1回だけ
// 隊列（サイレン＋ドン）・狙い撃ち（高いピピッ）と同じ「危険」の系統で、短く目立つように。ラボ「通常の敵」のD2
function sfxEnemyWarn() {
	if (!sfxThrottle("enemyWarn", 0.05)) return;
	[0, 0.09].forEach((d) => [64, 65].forEach((m) => saw2({ freq: midiHz(m), dur: 0.055, vol: 0.03, lp: 3000, attack: 0.004, delay: d })));
}
// 通常の敵の出現：隊列の「ドン」を短く小さくした「ドッ」
function sfxEnemySpawn() {
	if (!sfxThrottle("enemySpawn", 0.05)) return;
	[52, 57].forEach((m) => saw2({ freq: midiHz(m), dur: 0.18, vol: 0.03, lp: 2200, lpTo: 200 }));
	noiseHit(0.12, 0.08, "lowpass", 1500, 0.7, 0, 200);
}
// 狙い撃ちの予告：ぶつかり合う2つの高音で鋭く「ピピッ」
function sfxAimWarn() {
	[0, 0.15].forEach((d) => { tone(1760, 0.07, 0.04, "triangle", d); tone(1865, 0.07, 0.04, "triangle", d); });
}
// 狙い撃ちの出現：落ちていく「ピュン」
function sfxAimSpawn() {
	saw2({ freq: 1200, to: 300, sweep: 0.12, dur: 0.13, vol: 0.03, lp: 4000 });
}
// 隊列の予告：上下に3回揺れるサイレン（予告の1.5秒ぴったり）。「あと30秒」「ラスト10秒」の節目の音も兼ねる
function sfxFormationWarn() {
	if (!soundOn || sfxMuted || !audioCtx || !sfxIn || audioCtx.state === "closed") return;
	const n = audioCtx.currentTime, dur = 1.45, lo = 600, hi = 820, cycles = 3, vol = 0.022;
	[-8, 8].forEach((dt) => {
		const osc = audioCtx.createOscillator(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
		osc.type = "sawtooth";
		osc.detune.value = dt;
		osc.frequency.setValueAtTime(lo, n);
		const half = dur / (cycles * 2);
		for (let k = 0; k < cycles * 2; k++) osc.frequency.linearRampToValueAtTime(k % 2 ? lo : hi, n + half * (k + 1));
		f.type = "lowpass";
		f.frequency.value = 2800;
		osc.connect(f); f.connect(g); g.connect(sfxIn);
		g.gain.setValueAtTime(0.0001, n);
		g.gain.linearRampToValueAtTime(vol, n + 0.05);
		g.gain.setValueAtTime(vol, n + dur - 0.1);
		g.gain.exponentialRampToValueAtTime(0.001, n + dur);
		osc.start(n);
		osc.stop(n + dur + 0.05);
	});
}
// 隊列の出現：低い和音の「ドン」＋こもった衝撃
function sfxFormationSpawn() {
	[45, 52, 57].forEach((m) => saw2({ freq: midiHz(m), dur: 0.5, vol: 0.04, lp: 2500, lpTo: 200 }));
	noiseHit(0.35, 0.12, "lowpass", 1500, 0.7, 0, 150);
}
// カウントダウン（step: 0=「3」、1=「2」、2=「1」、3=「GO!」）。ラボの「D 拍とつながる」で決定
// 3・2・1は拍と同じ「ブン」が回ごとに明るくなり、GO!はこもった和音が「ブワッ」と開く
function sfxCountdown(step) {
	if (step < 3) {
		saw2({ freq: 220, dur: 0.14, vol: 0.06, lp: [1000, 1800, 2800][step], lpTo: 250 });
	} else {
		[57, 64, 69, 72].forEach((m) => saw2({ freq: midiHz(m), dur: 0.55, vol: 0.035, lp: 400, lpTo: 5000, lpTime: 0.15, spread: 12 }));
		noiseHit(0.3, 0.08, "bandpass", 500, 1, 0, 4000);
	}
}
// 音程は16体目（約1220Hz）で頭打ちにする。敵が多くても耳に刺さる高さまで上がらない
const ABSORB_PITCH_STEPS = 16;
// 音色はそのまま、耳に痛くないよう音量を約7割にして高い成分を少し削る（ラボ「リザルト」の「少し弱め」）
function sfxAbsorb(i) {
	synth({ type: "square", freq: 500 + Math.min(i, ABSORB_PITCH_STEPS) * 45, dur: 0.09, vol: 0.05, attack: 0.01, lp: 3500 });
}
// ---- リザルト画面 ----
// スコア集計のロールアップ：高いラを細かく連打（行が出るたびに1回、TOTALの数え上げ中は35msごと）
function sfxRollTick(strong) {
	synth({ type: "square", freq: midiHz(81), dur: 0.02, vol: strong ? 0.014 : 0.011, attack: 0.001, lp: 4000 });
}
const ROLL_TICK_MS = 35;
// ロードマップ（60秒トラック）を進む音：吸い込みと同じ四角い波形で、トラック上の位置に応じて音階を上がる
// 3秒進むごとに1回。60秒で「ソ」に着き、ゴールの解決音「ラ」へつながる。早く被弾すると低いところで止まる
const ROAD_NOTES = [67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91];
function sfxRoadTick(sec) {
	const m = ROAD_NOTES[Math.round(sec / 60 * (ROAD_NOTES.length - 1))];
	synth({ type: "square", freq: midiHz(m), dur: 0.09, vol: 0.06, attack: 0.005, lp: 4000 });
}
// ゴール（クリア時、トラックが60秒に着いた0.12秒後）：同じ音色でラから1オクターブ上のラへ跳ねて解決
function sfxGoal() {
	synth({ type: "square", freq: midiHz(81), dur: 0.08, vol: 0.05, attack: 0.003, lp: 4000 });
	synth({ type: "square", freq: midiHz(93), dur: 0.5, vol: 0.06, attack: 0.003, lp: 4000, delay: 0.09 });
}
// FMのベル（澄んだ金属音）。ratio＝倍音の比率
function bellTone(m, dur, vol, delay) {
	if (!soundOn || sfxMuted || !audioCtx || !sfxIn || audioCtx.state === "closed") return;
	const n = audioCtx.currentTime + (delay || 0), f = midiHz(m);
	const car = audioCtx.createOscillator(), mod = audioCtx.createOscillator(), mg = audioCtx.createGain(), g = audioCtx.createGain();
	car.frequency.value = f;
	mod.frequency.value = f * 3.5;
	mg.gain.setValueAtTime(f * 1.6, n);
	mg.gain.exponentialRampToValueAtTime(1, n + dur);
	mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(sfxIn);
	g.gain.setValueAtTime(0.0001, n);
	g.gain.linearRampToValueAtTime(vol, n + 0.002);
	g.gain.exponentialRampToValueAtTime(0.001, n + dur);
	car.start(n); mod.start(n); car.stop(n + dur + 0.05); mod.stop(n + dur + 0.05);
}
// メダル獲得（着地の瞬間）：澄んだベルが3音「キラリーン」。ラボ「メダル」のBで決定
// 段階（0=BRONZE〜4=NEON）ごとに演出を強める：きらめきが3つずつ増え、GOLD以上は下にベルの厚み、
// PLATINUM以上は高音が上から降る「キラキラの雨」（NEONは2回降って、澄んだ「リーン」で締める）。ラボのP2
// 小さな高音は立ち上がりが速すぎると「プチッ」と鳴るので、立ち上がりを12msにしている
function sfxMedal(tier) {
	[93, 100, 105].forEach((m, i) => bellTone(m, 1.2 - i * 0.2, 0.05, i * 0.07));
	for (let i = 0; i < tier * 3; i++) {
		synth({ freq: midiHz([100, 105, 108, 112][i % 4]), dur: 0.22, vol: 0.02, attack: 0.012, delay: 0.22 + i * 0.07 + Math.random() * 0.03 });
	}
	if (tier >= 2) bellTone(88, 1.0, 0.03, 0.02);
	const rain = (at) => [112, 108, 105, 100, 96, 93].forEach((m, i) => synth({ freq: midiHz(m), dur: 0.3, vol: 0.02, attack: 0.012, delay: at + i * 0.04 }));
	if (tier >= 3) rain(0.3);
	if (tier >= 4) {
		rain(0.6);
		// 締めは高い金属ベルだと音が割れて聞こえるため、澄んだサイン波にする
		[100, 105, 108].forEach((m, i) => synth({ freq: midiHz(m), dur: 0.8, vol: 0.018, attack: 0.012, delay: 0.9 + i * 0.05 }));
	}
}
// リザルトの経過時間が prevT → T に進んだ間にある音を鳴らす（毎フレーム呼ぶ）
function sfxResultTicks(s, prevT, T) {
	const times = resultTimes(s);
	// ロードマップ：自機が RESULT_TRACK.dur かけて easeOutQuad で生存時間の位置まで進む
	const survived = Math.min(s.elapsedTime, MAX_TIME) / 1000;
	for (let sec = 3; sec <= survived + 1e-6; sec += 3) {
		const at = RESULT_TRACK.dur * (1 - Math.sqrt(1 - Math.min(1, sec / survived)));
		if (prevT < at && at <= T) sfxRoadTick(sec);
	}
	const goalAt = RESULT_TRACK.dur + 120;
	if (s.cleared && prevT < goalAt && goalAt <= T) sfxGoal();
	// メダルは rankAt から大きい状態で出て、約0.16秒後に着地する（スコア確定前は rankAt が Infinity なので鳴らない）
	const medalAt = times.rankAt + 160;
	if (prevT < medalAt && medalAt <= T) sfxMedal(medalTier(s.total));
	const n = resultRows(s).length;
	for (let i = 0; i < n; i++) {
		const at = times.rowsStart + i * 150;
		if (prevT < at && at <= T) sfxRollTick(true);
	}
	for (let at = times.totalStart; at < times.totalStart + 600; at += ROLL_TICK_MS) {
		if (prevT < at && at <= T) sfxRollTick(false);
	}
}

/* ==================== canvas内ボタン ====================
 * ふりーむ掲載規約でbodyタグ内にHTML/CSS製のUI・文字列を置けないため、
 * ボタンは全てcanvas上にJSで描画し、クリック判定も自前で行う。 */
const BTN_LANG = { x: 284, y: 8, w: 70, h: 24 };
const BTN_SOUND = { x: 6, y: 8, w: 70, h: 24 };
const BTN_RETRY = { x: 28, y: 476, w: 196, h: 46 };
const BTN_TITLE = { x: 234, y: 476, w: 98, h: 46 };
// 初回のサウンド確認ダイアログ
const ASK_BOX = { x: 36, y: 176, w: 288, h: 196 };
const BTN_ASK_ON = { x: 56, y: 296, w: 120, h: 48 };
const BTN_ASK_OFF = { x: 184, y: 296, w: 120, h: 48 };

function hitTestBtn(rect, x, y) {
	return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
function drawLangButton() {
	fillRoundRect(BTN_LANG.x, BTN_LANG.y, BTN_LANG.w, BTN_LANG.h, 8, "rgba(0,0,0,0.55)");
	strokeRoundRect(BTN_LANG.x, BTN_LANG.y, BTN_LANG.w, BTN_LANG.h, 8, COL_SUB, 1);
	drawText(t("langBtn"), BTN_LANG.x + BTN_LANG.w / 2, BTN_LANG.y + BTN_LANG.h / 2 + 1, {
		size: 12, weight: "bold", align: "center", baseline: "middle", color: "#fff",
	});
}

function drawSoundButton() {
	fillRoundRect(BTN_SOUND.x, BTN_SOUND.y, BTN_SOUND.w, BTN_SOUND.h, 8, "rgba(0,0,0,0.55)");
	strokeRoundRect(BTN_SOUND.x, BTN_SOUND.y, BTN_SOUND.w, BTN_SOUND.h, 8, COL_SUB, 1);
	drawText(soundOn ? t("soundOn") : t("soundOff"), BTN_SOUND.x + BTN_SOUND.w / 2, BTN_SOUND.y + BTN_SOUND.h / 2 + 1, {
		size: 12, weight: "bold", align: "center", baseline: "middle", color: soundOn ? "#fff" : COL_SUB,
	});
}

/* ==================== ベストスコア保存 ==================== */
const BEST_KEY = "nige_best_score";
function loadBest() {
	try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
}
function saveBest(v) {
	try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* 保存できない環境では無視 */ }
}
let bestScore = loadBest();

/* ==================== ゲーム状態 ==================== */
let game = null;

function createGameState() {
	const s = {
		phase: "play", // "play" | "hit" | "clear"
		player: { x: PLAY_X + PLAY_W / 2, y: PLAY_Y + PLAY_H / 2 },
		vx: SPEED_BASE, vy: 0,
		playerAngle: 0,
		playerType: null,
		speedStacks: 0, attackStacks: 0, defenseStacks: 0,
		attackTimer: 0,
		attackProjectiles: [],
		defenseBarriers: [],
		enemies: [],
		warnings: [],
		powers: [],
		effects: [],
		particles: [],
		pops: [],
		trail: [],

		elapsedTime: 0,
		lastEnemySpawn: 0, enemySpawnInterval: 3000,
		enemySpawnCount: 1, baseEnemySpeed: 1.2, lastDifficultyIncrease: 0,
		lastPowerSpawn: 0, powerSpawnInterval: 2000,
		lastAimSpawn: AIM_START, formationIndex: 0, quietUntil: 0,

		running: true, cleared: false,
		resultTitleIndex: 0,

		// スコア
		grazeCount: 0, grazePts: 0, combo: 0, maxCombo: 0, comboTimer: 0,
		killCount: 0, killPts: 0, absorbCount: 0, absorbPts: 0,
		displayScore: 0, scorePulse: 999,
		total: 0, newRecord: false,

		// 中央タイマーの拍
		beatRings: [], beatKey: "", strongAge: 999, beatAge: 999,
		shake: 0, flashAlpha: 0, itemPopAge: 999,
		itemCount: 0, itemPts: 0, giriCount: 0,
		slowAge: -1, edgeFlash: 0, // ギリギリのスロー演出
		barrierRegenTimer: 0, shockwaves: [],

		leftHeld: false, rightHeld: false,
		guideVisible: false, guideAngle: 0,
		tapFlash: null,

		hitAge: 0,
		clear: null,
		resultAge: -1, finalized: false, finalizedAt: 0, // リザルト表示の経過時間（-1＝未開始）
		medalTwinkles: [],
		formFx: null, // 隊列の予告で場の敵が消える演出（startFormationFx）
	};
	setVelocityFromAngle(s, 0);
	spawnEnemyBatch(s, s.enemySpawnCount);
	return s;
}

function resetGame() {
	sfxSoftHighs(false);
	game = createGameState();
	for (const k in activePointers) delete activePointers[k];
}

function currentScore(s) {
	const survival = Math.floor(Math.min(s.elapsedTime, MAX_TIME) / 1000 * SURVIVAL_SCORE_PER_SEC);
	return survival + s.grazePts + s.killPts + s.itemPts + s.absorbPts;
}
function remainMs(s) { return Math.max(0, MAX_TIME - s.elapsedTime); }
function remainSec(s) { return Math.ceil(remainMs(s) / 1000); }

function setVelocityFromAngle(s, angle) {
	const sp = SPEED_BASE * (12 - s.speedStacks * 2) / 12;
	s.vx = Math.cos(angle) * sp;
	s.vy = Math.sin(angle) * sp;
	s.playerAngle = angle;
}
function normalizeVelocityToSpeed(s) {
	const speed = SPEED_BASE * (12 - s.speedStacks * 2) / 12;
	const n = Math.hypot(s.vx, s.vy) || 1e-6;
	s.vx = s.vx / n * speed;
	s.vy = s.vy / n * speed;
}
function getPlayerTipPos(s) {
	const tipOffset = PLAYER_RADIUS - 23; // -7（先端は進行方向と逆側に少し寄る）
	return {
		x: s.player.x + Math.cos(s.playerAngle) * tipOffset,
		y: s.player.y + Math.sin(s.playerAngle) * tipOffset,
	};
}

function addPop(s, x, y, text, color, size) {
	s.pops.push({ x, y, text, color, size: size || 15, age: 0, life: 900 });
}
function spawnBurst(s, x, y, colors, count, speedMul) {
	for (let i = 0; i < count; i++) {
		const a = Math.random() * Math.PI * 2;
		const v = (0.08 + Math.random() * 0.2) * (speedMul || 1);
		s.particles.push({
			kind: "dot", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.0002,
			age: 0, life: 600 + Math.random() * 500, color: colors[i % colors.length], size: 2 + Math.random() * 2.5,
		});
	}
}

/* ---- 敵のスポーン ---- */
const SIDE_GAP = 36;
function sideSpawnInfo(side) {
	let ex, ey, angle, wx, wy;
	if (side === 0) { // 上から下へ
		ex = PLAY_X + Math.random() * PLAY_W; ey = PLAY_Y - SIDE_GAP; angle = Math.PI / 2;
		wx = ex; wy = PLAY_Y;
	} else if (side === 1) { // 右から左へ
		ex = PLAY_X + PLAY_W + SIDE_GAP; ey = PLAY_Y + Math.random() * PLAY_H; angle = Math.PI;
		wx = PLAY_X + PLAY_W; wy = ey;
	} else if (side === 2) { // 下から上へ
		ex = PLAY_X + Math.random() * PLAY_W; ey = PLAY_Y + PLAY_H + SIDE_GAP; angle = -Math.PI / 2;
		wx = ex; wy = PLAY_Y + PLAY_H;
	} else { // 左から右へ
		ex = PLAY_X - SIDE_GAP; ey = PLAY_Y + Math.random() * PLAY_H; angle = 0;
		wx = PLAY_X; wy = ey;
	}
	return { ex, ey, angle, wx, wy };
}
function spawnEnemyAtWithWarning(s, side) {
	const info = sideSpawnInfo(side);
	s.warnings.push({ x: info.wx, y: info.wy, age: 0, life: WARNING_LIFE, ex: info.ex, ey: info.ey, angle: info.angle });
}
function spawnEnemyBatch(s, count) {
	for (let i = 0; i < count; i++) spawnEnemyAtWithWarning(s, Math.floor(Math.random() * 4));
	if (count > 0) sfxEnemyWarn();
}
// 狙い撃ち：辺上のランダムな位置から、予告時点の自機の位置へ向けて飛ぶ
function spawnAimedWithWarning(s) {
	const side = Math.floor(Math.random() * 4);
	const info = sideSpawnInfo(side);
	const angle = Math.atan2(s.player.y - info.wy, s.player.x - info.wx);
	s.warnings.push({
		kind: "aim", x: info.wx, y: info.wy, angle, age: 0, life: AIM_WARNING_LIFE,
		ex: info.wx - Math.cos(angle) * SIDE_GAP, ey: info.wy - Math.sin(angle) * SIDE_GAP,
		aimX: s.player.x, aimY: s.player.y,
	});
	sfxAimWarn();
}
// 隊列：1辺から横一列に並んで直進。2枠分の隙間を自機の近く（間に合う距離）に作る
function spawnFormationWithWarning(s) {
	const side = Math.floor(Math.random() * 4);
	const horizontal = side === 0 || side === 2; // 上下の辺から来る＝横に並ぶ
	const span = horizontal ? PLAY_W : PLAY_H;
	const cell = span / FORMATION_COUNT;
	const playerU = horizontal ? s.player.x - PLAY_X : s.player.y - PLAY_Y;
	const aimCell = playerU / cell - 1 + (Math.random() - 0.5) * 2; // 自機の位置から±1枠ずらす
	const gap = clamp(Math.round(aimCell), 0, FORMATION_COUNT - 2);
	const angle = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][side];
	const members = [];
	for (let i = 0; i < FORMATION_COUNT; i++) {
		if (i === gap || i === gap + 1) continue;
		const u = cell * (i + 0.5);
		const wx = horizontal ? PLAY_X + u : (side === 1 ? PLAY_X + PLAY_W : PLAY_X);
		const wy = horizontal ? (side === 0 ? PLAY_Y : PLAY_Y + PLAY_H) : PLAY_Y + u;
		members.push({ x: wx, y: wy, ex: wx - Math.cos(angle) * SIDE_GAP, ey: wy - Math.sin(angle) * SIDE_GAP });
	}
	// 隊列に集中させるため、出現待ちの予告は取り消し、場に残っている敵も消滅させる
	// （予告だけ止めると、隊列の出現と同時に残りの敵が出てきて戸惑うため）
	// 消え方は「隊列の辺から波が来て、触れた敵が粒になって隊列の出発位置へ戻る」演出で見せる（startFormationFx）
	s.warnings.length = 0;
	const fw = { kind: "formation", side, angle, members, gapStart: cell * gap, gapSize: cell * 2, age: 0, life: FORMATION_WARNING_LIFE };
	startFormationFx(s, fw);
	s.warnings.push(fw);
	s.quietUntil = s.elapsedTime + FORMATION_WARNING_LIFE + FORMATION_QUIET;
	sfxFormationWarn();
}

/* ---- 隊列の予告で場の敵が消える演出（ラボ「隊列と消える敵」のG） ----
 * 1. 予告と同時に、場の敵は当たり判定から外す（見た目だけ残して動き続ける。ゲームの難しさは今までと同じ）
 * 2. 隊列が来る辺から光の波が画面を横切り、触れた敵が白く光る
 * 3. 光った敵は粒にほどけ、隊列の出発位置（辺のすぐ外）へ流れて集まる。粒は自機の近くを通らないよう回り込む
 * 4. 出発位置で粒が隊列の敵の形になっていき、予告が終わると本物の隊列が出てくる */
const FORM_WAVE_MS = 550; // 波が画面を横切る時間
const FORM_WHITEN_MS = 120; // 波に触れてから粒になるまで（白く光る）
const FORM_PART_MS = 500; // 粒が出発位置へ流れる時間
const FORM_SLOT_OUT = 12; // 出発位置の目印を、辺からどれだけ外に描くか（左右の辺でも画面内に収まる距離）
function formSideDist(side, x, y) { return [y - PLAY_Y, PLAY_X + PLAY_W - x, PLAY_Y + PLAY_H - y, x - PLAY_X][side]; }
function startFormationFx(s, w) {
	const slots = w.members.map((m) => ({ x: m.x - Math.cos(w.angle) * FORM_SLOT_OUT, y: m.y - Math.sin(w.angle) * FORM_SLOT_OUT, got: 0, flash: 0 }));
	s.formFx = {
		side: w.side, horizontal: w.side === 0 || w.side === 2, age: 0, wave: 0, slots, parts: [],
		pending: s.enemies.map((e) => ({ x: e.x, y: e.y, angle: e.angle, v: e.v, rot: e.rot, kind: e.kind, hitAt: -1 })),
	};
	s.enemies.length = 0; // ここで当たり判定から外れる
}
// 光った敵を粒にして、一番近い出発位置へ流す。自機が通り道の近くにあれば、反対側へ大きく回り込ませる
function dissolveToFormation(s, fx, e) {
	let slot = null, bd = Infinity;
	fx.slots.forEach((sl) => { const d = Math.hypot(sl.x - e.x, sl.y - e.y); if (d < bd) { bd = d; slot = sl; } });
	for (let i = 0; i < 12; i++) {
		const sx = e.x + (Math.random() - 0.5) * 16, sy = e.y + (Math.random() - 0.5) * 16;
		const dx = slot.x - sx, dy = slot.y - sy, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
		let bend = 20 + (i % 2 ? 15 : -15);
		const px = s.player.x - sx, py = s.player.y - sy, along = clamp((px * dx + py * dy) / (len * len), 0, 1);
		const cx0 = sx + dx * along, cy0 = sy + dy * along, dist = Math.hypot(s.player.x - cx0, s.player.y - cy0);
		if (dist < 80) bend = (((s.player.x - cx0) * nx + (s.player.y - cy0) * ny) > 0 ? -1 : 1) * (160 - dist);
		fx.parts.push({
			sx, sy, x: sx, y: sy, mx: (sx + slot.x) / 2 + nx * bend, my: (sy + slot.y) / 2 + ny * bend,
			slot, age: -i * 18, white: i % 3 === 0,
		});
	}
}
function updateFormationFx(s, deltaMs, delta) {
	const fx = s.formFx;
	if (!fx) return;
	fx.age += deltaMs;
	fx.wave = easeOutQuad(clamp(fx.age / FORM_WAVE_MS, 0, 1)) * (fx.horizontal ? PLAY_H : PLAY_W) * 1.05;
	const speedMul = (4 - s.speedStacks) / 4;
	for (let i = fx.pending.length - 1; i >= 0; i--) {
		const e = fx.pending[i];
		if (e.hitAt < 0) {
			e.x += Math.cos(e.angle) * e.v * delta * speedMul;
			e.y += Math.sin(e.angle) * e.v * delta * speedMul;
			e.rot += 0.004 * deltaMs;
			// 波に触れた（波が通り過ぎても触れなかった画面外の敵も、ここで光らせる）
			if (formSideDist(fx.side, e.x, e.y) <= fx.wave || fx.age >= FORM_WAVE_MS) e.hitAt = fx.age;
		} else if (fx.age - e.hitAt >= FORM_WHITEN_MS) {
			dissolveToFormation(s, fx, e);
			fx.pending.splice(i, 1);
		}
	}
	fx.slots.forEach((sl) => { sl.flash = Math.max(0, sl.flash - deltaMs / 300); });
	for (let i = fx.parts.length - 1; i >= 0; i--) {
		const p = fx.parts[i];
		p.age += deltaMs;
		if (p.age < 0) continue;
		const k = clamp(p.age / FORM_PART_MS, 0, 1), q = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
		p.x = (1 - q) * (1 - q) * p.sx + 2 * (1 - q) * q * p.mx + q * q * p.slot.x;
		p.y = (1 - q) * (1 - q) * p.sy + 2 * (1 - q) * q * p.my + q * q * p.slot.y;
		if (k >= 1) { p.slot.got++; p.slot.flash = 1; fx.parts.splice(i, 1); }
	}
	if (fx.age > FORMATION_WARNING_LIFE + 400 && !fx.pending.length && !fx.parts.length) s.formFx = null;
}

/* ---- パワーアップの出現 ---- */
function spawnPower(s) {
	if (s.demo) return;
	const types = ["speed", "attack", "defense"];
	const type = types[Math.floor(Math.random() * types.length)];
	if (s.powers.some((p) => p.type === type)) return; // 同じタイプが既にあれば出さない（空振り）
	// 意図せず取ってしまわないよう、自機の今の位置と少し先の進路の近くには出さない
	const ahead = { x: s.player.x + s.vx * POWER_AHEAD_FRAMES, y: s.player.y + s.vy * POWER_AHEAD_FRAMES };
	for (let tries = 0; tries < 10; tries++) {
		const x = PLAY_X + 30 + Math.random() * (PLAY_W - 60);
		const y = PLAY_Y + 30 + Math.random() * (PLAY_H - 60);
		if (Math.hypot(x - s.player.x, y - s.player.y) < POWER_SAFE_RADIUS) continue;
		if (Math.hypot(x - ahead.x, y - ahead.y) < POWER_SAFE_RADIUS) continue;
		// 既に出ているアイテムと重ならないようにする（寿命リングの外側同士で間隔をあける）
		if (s.powers.some((p) => Math.hypot(x - p.x, y - p.y) < POWER_MIN_GAP)) continue;
		s.powers.push({ type, x, y, age: 0 });
		sfxItemSpawn(type);
		return;
	}
}

/* ---- アイテム効果の適用 ---- */
function makeDefenseBarriers(s) {
	s.defenseBarriers.length = 0;
	s.barrierRegenTimer = 0;
	const count = s.defenseStacks;
	for (let i = 0; i < count; i++) {
		s.defenseBarriers.push({ x: 0, y: 0, angle: (i / count) * Math.PI * 2, speed: 0.08 });
	}
}
// バリアを1個復活させ、周回位置を等間隔に並べ直す
function regenBarrier(s) {
	const base = s.defenseBarriers.length ? s.defenseBarriers[0].angle : 0;
	s.defenseBarriers.push({ x: 0, y: 0, angle: 0, speed: 0.08 });
	const n = s.defenseBarriers.length;
	s.defenseBarriers.forEach((b, i) => { b.angle = base + (i / n) * Math.PI * 2; });
	const tip = getPlayerTipPos(s);
	spawnBurst(s, tip.x, tip.y, [ITEM_COLORS.defense, "#ffffff"], 8, 0.5);
	sfxBarrierRegen();
}
// バリアが身代わりになった瞬間の衝撃波：範囲内の敵をまとめて倒す
function spawnShockwave(s, x, y) {
	s.shockwaves.push({ x, y, age: 0 });
	s.shake = Math.max(s.shake, 120);
	sfxShockwave();
}
function currentLevel(s) {
	return s.playerType === "speed" ? s.speedStacks : s.playerType === "attack" ? s.attackStacks : s.playerType === "defense" ? s.defenseStacks : 0;
}
function applyPower(s, type) {
	s.playerType = type;
	s.defenseBarriers.length = 0;
	if (type === "speed") {
		s.attackStacks = 0; s.defenseStacks = 0;
		s.attackProjectiles.length = 0;
		s.speedStacks = Math.min(3, s.speedStacks + 1);
	} else if (type === "attack") {
		s.speedStacks = 0; s.defenseStacks = 0;
		s.attackStacks = Math.min(3, s.attackStacks + 1);
	} else if (type === "defense") {
		s.speedStacks = 0; s.attackStacks = 0;
		s.attackProjectiles.length = 0;
		s.defenseStacks = Math.min(3, s.defenseStacks + 1);
		makeDefenseBarriers(s);
	}
	normalizeVelocityToSpeed(s);
	s.itemPopAge = 0;

	const level = currentLevel(s);
	const tip = getPlayerTipPos(s);
	// 取りに行くリスクへのリターンとして、Lvに応じて少しスコアを加算
	const pts = ITEM_SCORE;
	s.itemCount++;
	s.itemPts += pts;
	s.scorePulse = 0;
	addPop(s, tip.x, tip.y - 10, t("itemLevelFmt")(t("itemLabels")[type], level) + "  +" + pts, ITEM_COLORS[type], 16 + level * 2);
	spawnBurst(s, tip.x, tip.y, [ITEM_COLORS[type]], level * 6, 0.6 + level * 0.3);
	sfxItem(type, level);
}

/* ---- 当たり判定 ---- */
function killEnemy(s, index) {
	const e = s.enemies[index];
	s.enemies.splice(index, 1);
	s.killCount++;
	s.killPts += KILL_SCORE;
	spawnBurst(s, e.x, e.y, [COL_ENEMY, "#ffffff"], 8, 0.7);
	addPop(s, e.x, e.y - 8, "+" + KILL_SCORE, "#ffffff", 13);
	sfxKill();
}
function checkCollisions(s) {
	for (let i = s.powers.length - 1; i >= 0; i--) {
		const p = s.powers[i];
		if (Math.hypot(p.x - s.player.x, p.y - s.player.y) < 20) {
			applyPower(s, p.type);
			s.powers.splice(i, 1);
		}
	}
	for (let i = s.attackProjectiles.length - 1; i >= 0; i--) {
		const a = s.attackProjectiles[i];
		for (let j = s.enemies.length - 1; j >= 0; j--) {
			const e = s.enemies[j];
			if (Math.hypot(a.x - e.x, a.y - e.y) < 12) {
				s.attackProjectiles.splice(i, 1);
				killEnemy(s, j);
				break;
			}
		}
	}
	for (let i = s.enemies.length - 1; i >= 0; i--) {
		const e = s.enemies[i];
		for (const b of s.defenseBarriers) {
			if (Math.hypot(e.x - b.x, e.y - b.y) < 10) {
				killEnemy(s, i);
				const bi = s.defenseBarriers.indexOf(b);
				if (bi !== -1) s.defenseBarriers.splice(bi, 1);
				spawnShockwave(s, b.x, b.y);
				break;
			}
		}
	}
	const tip = getPlayerTipPos(s);
	for (let i = s.enemies.length - 1; i >= 0; i--) {
		const e = s.enemies[i];
		const d = Math.hypot(e.x - tip.x, e.y - tip.y);
		if (s.demo) continue; // タイトルのデモは無敵でスコアもなし
		if (d <= TIP_RADIUS) {
			doGameOver(s, e);
			return;
		}
		// かすり：判定のすぐ近くを通った敵1体につき1回
		if (!e.grazed && d < GRAZE_RADIUS) {
			e.grazed = true;
			s.grazeCount++;
			s.combo++;
			s.maxCombo = Math.max(s.maxCombo, s.combo);
			s.comboTimer = COMBO_WINDOW;
			e.grazeMult = Math.min(s.combo, 10);
			const pts = GRAZE_SCORE * e.grazeMult;
			s.grazePts += pts;
			addPop(s, tip.x, tip.y - 12, t("grazePopFmt")(pts), COL_GRAZE, 14 + Math.min(s.combo, 5));
			sfxGraze(s.combo);
		}
		// ギリギリ：かすった敵がさらに近づいた瞬間に格上げ（差額を加算）してスロー
		if (e.grazed && !e.giri && d <= GIRI_RADIUS) {
			e.giri = true;
			s.giriCount++;
			s.grazePts += (GIRI_SCORE - GRAZE_SCORE) * e.grazeMult;
			s.comboTimer = COMBO_WINDOW;
			addPop(s, tip.x, tip.y - 34, t("giriPopFmt")(GIRI_SCORE * e.grazeMult), COL_GIRI, 20);
			s.slowAge = 0;
			s.edgeFlash = 1;
			sfxGiri();
		}
	}
}

/* ---- 壁反射 ---- */
function reflectWalls(s) {
	const tip = getPlayerTipPos(s);
	let reflected = false;
	const rTotal = PLAYER_RADIUS + TIP_RADIUS;

	if (tip.x - WALL_HIT_RADIUS < PLAY_X) {
		s.player.x = PLAY_X + WALL_HIT_RADIUS - Math.cos(s.playerAngle) * rTotal;
		const dot = s.vx * 1 + s.vy * 0; s.vx -= 2 * dot * 1; s.vy -= 2 * dot * 0;
		reflected = true;
	}
	if (tip.x + WALL_HIT_RADIUS > PLAY_X + PLAY_W) {
		s.player.x = PLAY_X + PLAY_W - WALL_HIT_RADIUS - Math.cos(s.playerAngle) * rTotal;
		const dot = s.vx * -1 + s.vy * 0; s.vx -= 2 * dot * -1; s.vy -= 2 * dot * 0;
		reflected = true;
	}
	if (tip.y - WALL_HIT_RADIUS < PLAY_Y) {
		s.player.y = PLAY_Y + WALL_HIT_RADIUS - Math.sin(s.playerAngle) * rTotal;
		const dot = s.vx * 0 + s.vy * 1; s.vx -= 2 * dot * 0; s.vy -= 2 * dot * 1;
		reflected = true;
	}
	if (tip.y + WALL_HIT_RADIUS > PLAY_Y + PLAY_H) {
		s.player.y = PLAY_Y + PLAY_H - WALL_HIT_RADIUS - Math.sin(s.playerAngle) * rTotal;
		const dot = s.vx * 0 + s.vy * -1; s.vx -= 2 * dot * 0; s.vy -= 2 * dot * -1;
		reflected = true;
	}
	if (reflected) {
		normalizeVelocityToSpeed(s);
		s.playerAngle = Math.atan2(s.vy, s.vx);
		if (!s.demo) sfxWall();
	}
}

/* ---- ゲームオーバー / クリア ---- */
function releaseAllInput(s) {
	s.leftHeld = false; s.rightHeld = false; s.guideVisible = false;
	sfxHoldStop();
	for (const k in activePointers) delete activePointers[k];
}
function doGameOver(s, enemy) {
	s.running = false;
	s.cleared = false;
	s.phase = "hit";
	s.hitAge = 0;
	s.exploded = false;
	s.hitEnemy = enemy;
	s.shake = 0;
	releaseAllInput(s);
	sfxHitStop();
}
// ヒットストップ明けに自機を爆発させる：機体の破片＋火花＋衝撃波（敵の撃破より派手に）
function explodePlayer(s) {
	s.formFx = null;
	s.exploded = true;
	s.warnings.length = 0;
	s.powers.length = 0;
	s.attackProjectiles.length = 0;
	s.defenseBarriers.length = 0;
	s.shake = 450;
	s.flashAlpha = 0.7;
	const x = s.player.x, y = s.player.y;
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
		const v = 0.12 + Math.random() * 0.28;
		s.particles.push({
			kind: "frag", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, drag: 0.97,
			age: 0, life: 900 + Math.random() * 500, color: i % 3 === 0 ? "#ffffff" : COL_PLAYER,
			size: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.03,
		});
	}
	spawnBurst(s, x, y, [COL_PLAYER, "#ffffff", COL_DANGER, COL_GRAZE], 50, 2);
	s.hitRings = [{ age: 0, color: "#ffffff" }, { age: -90, color: COL_PLAYER }, { age: -180, color: COL_DANGER }];
	s.hitPos = { x, y };
	sfxHit();
}
function doGameClear(s) {
	s.formFx = null;
	s.running = false;
	s.cleared = true;
	s.phase = "clear";
	s.elapsedTime = MAX_TIME;
	releaseAllInput(s);
	sfxSoftHighs(true); // クリア演出から高音を和らげる
	sfxClearFreeze();
	s.warnings.length = 0;
	s.powers.length = 0;
	s.attackProjectiles.length = 0;
	s.defenseBarriers.length = 0;
	s.shockwaves.length = 0;

	// 残っていた敵はスコアへ吸い込まれる残骸になる（スコアに近い順）
	const remnants = s.enemies.map((e) => {
		const an = Math.atan2(e.y - CY, e.x - CX);
		return { sx: e.x, sy: e.y, rot: e.rot, kx: Math.cos(an), ky: Math.sin(an), dead: false, delay: 0 };
	});
	s.enemies.length = 0;
	remnants.sort((a, b) => Math.hypot(a.sx - SCORE_POS.x, a.sy - SCORE_POS.y) - Math.hypot(b.sx - SCORE_POS.x, b.sy - SCORE_POS.y));
	// 敵が多くても吸い込みが長引かないよう、間隔を詰める
	const gap = Math.min(CLEAR_GAP, 1500 / Math.max(1, remnants.length));
	remnants.forEach((r, i) => { r.delay = CLEAR_FREEZE + CLEAR_KNOCK + i * gap; });

	// 解放後の周回軌道：今の位置・向きから接線でつながる円を作る。
	// 円の中心は左右のうち画面中央に近い側に置き、以後は画面中央へ寄せていく（壁に当たらない）
	const th = s.playerAngle;
	let best = null;
	[1, -1].forEach((dir) => {
		const cx = s.player.x - Math.sin(th) * CLEAR_ORBIT_R * dir;
		const cy = s.player.y + Math.cos(th) * CLEAR_ORBIT_R * dir;
		const d = Math.hypot(cx - W / 2, cy - H / 2);
		if (!best || d < best.d) best = { d, cx, cy, dir };
	});
	s.clear = {
		age: 0, boomed: false, remnants, rings: [],
		orbit: { cx: best.cx, cy: best.cy, dir: best.dir, phi: Math.atan2(s.player.y - best.cy, s.player.x - best.cx) },
	};
}
// 最終スコアを確定する（クリアは吸い込み完了時、やられた時はリザルト開始時）
function finalizeResult(s) {
	if (s.finalized) return;
	s.finalized = true;
	s.finalizedAt = s.resultAge;
	s.total = currentScore(s);
	s.newRecord = s.total > bestScore;
	if (s.newRecord) { bestScore = s.total; saveBest(bestScore); }
	const survivedSeconds = Math.floor(s.elapsedTime / 1000);
	s.resultTitleIndex = Math.min(Math.floor(survivedSeconds / 10), 5);
}
function startResult(s) {
	if (s.resultAge < 0) { s.resultAge = 0; sfxSoftHighs(true); } // 被弾時はリザルトから高音を和らげる
}

// 評価はメダルで表す（どの段階でも「もらえた」形にしてネガティブに見せない）
const MEDALS = [
	{ min: 0, name: "BRONZE", color: "#d08a4a", sparkle: 1 },
	{ min: 3000, name: "SILVER", color: "#d6dde9", sparkle: 2 },
	{ min: 6000, name: "GOLD", color: "#ffd24a", sparkle: 3 },
	{ min: 9000, name: "PLATINUM", color: "#c9f6ff", sparkle: 4 },
	{ min: 12000, name: "NEON", color: COL_ENEMY, sparkle: 6 },
];
function medalTier(total) {
	let tier = 0;
	MEDALS.forEach((m, i) => { if (total >= m.min) tier = i; });
	return tier;
}

/* ---- 中央タイマーの拍（残り時間の秒と完全に同期） ---- */
// 残り31秒以上は1秒1拍、30秒以下で2倍、10秒以下で3倍、3秒以下で4倍
function beatMultiplier(sec) {
	if (sec > 30) return 1;
	if (sec > 10) return 2;
	if (sec > 3) return 3;
	return 4;
}
function updateBeat(s) {
	if (s.demo) return;
	const sec = remainSec(s);
	const bps = beatMultiplier(sec);
	const inSec = s.elapsedTime % 1000;
	const interval = 1000 / bps;
	const idx = Math.floor(inSec / interval);
	const key = sec + ":" + idx;
	if (key === s.beatKey) return;
	const first = s.beatKey === "";
	s.beatKey = key;
	const strong = idx === 0;
	s.beatRings.push({
		age: first ? inSec - idx * interval : 0,
		life: Math.min(strong ? 850 : 600, interval * (strong ? 1.8 : 1.5)),
		strong, sec,
	});
	s.beatAge = 0;
	if (strong) {
		s.strongAge = 0;
		if (sec <= 10) s.shake = sec <= 5 ? 220 : 150;
	}
	if (!first) sfxBeat(strong, sec);
}

/* ==================== メインループ ==================== */
function updateGameplay(s, deltaMs, delta) {
	s.elapsedTime += deltaMs;

	if (!s.demo && s.elapsedTime - s.lastDifficultyIncrease > 10000) {
		s.lastDifficultyIncrease = s.elapsedTime;
		if (s.enemySpawnInterval > 400) s.enemySpawnInterval = Math.max(400, s.enemySpawnInterval - 75);
		s.enemySpawnCount = Math.min(6, s.enemySpawnCount + 1);
		s.baseEnemySpeed += 0.10;
	}
	// 残り30秒・10秒の節目で隊列（前後は他の敵を止めて隊列だけに集中させる）
	if (!s.demo && s.formationIndex < FORMATION_TIMES.length && s.elapsedTime >= FORMATION_TIMES[s.formationIndex]) {
		s.formationIndex++;
		spawnFormationWithWarning(s);
	}
	const quiet = s.elapsedTime < s.quietUntil;
	if (s.elapsedTime - s.lastEnemySpawn > s.enemySpawnInterval) {
		s.lastEnemySpawn = s.elapsedTime;
		if (!quiet) spawnEnemyBatch(s, s.enemySpawnCount);
	}
	// 30秒以降は狙い撃ちが混ざる（2.4秒→後半1.6秒ごと）
	if (!s.demo && s.elapsedTime >= AIM_START) {
		const aimInterval = s.elapsedTime >= 45000 ? 1600 : 2400;
		if (s.elapsedTime - s.lastAimSpawn > aimInterval) {
			s.lastAimSpawn = s.elapsedTime;
			if (!quiet) spawnAimedWithWarning(s);
		}
	}
	if (s.elapsedTime - s.lastPowerSpawn > s.powerSpawnInterval) {
		s.lastPowerSpawn = s.elapsedTime;
		spawnPower(s);
	}

	updateFormationFx(s, deltaMs, delta);
	// 予告演出→実スポーン
	for (let i = s.warnings.length - 1; i >= 0; i--) {
		const w = s.warnings[i];
		w.age += deltaMs;
		if (w.age >= w.life) {
			if (w.kind === "formation") {
				w.members.forEach((m) => s.enemies.push({ x: m.ex, y: m.ey, v: FORMATION_SPEED, angle: w.angle, rot: Math.random() * 6, grazed: false }));
				sfxFormationSpawn();
			} else if (w.kind === "aim") {
				s.enemies.push({ kind: "aim", x: w.ex, y: w.ey, v: (s.baseEnemySpeed + 0.3) * AIM_SPEED_MUL, angle: w.angle, rot: Math.random() * 6, grazed: false });
				sfxAimSpawn();
			} else {
				s.enemies.push({ x: w.ex, y: w.ey, v: s.baseEnemySpeed + Math.random() * 0.6, angle: w.angle, rot: Math.random() * 6, grazed: false });
				sfxEnemySpawn();
			}
			s.warnings.splice(i, 1);
		}
	}

	// 敵の移動
	const speedMul = (4 - s.speedStacks) / 4;
	for (let i = s.enemies.length - 1; i >= 0; i--) {
		const e = s.enemies[i];
		e.x += Math.cos(e.angle) * e.v * delta * speedMul;
		e.y += Math.sin(e.angle) * e.v * delta * speedMul;
		e.rot += 0.004 * deltaMs;
		if (e.x < PLAY_X - 60 || e.x > PLAY_X + PLAY_W + 60 || e.y < PLAY_Y - 60 || e.y > PLAY_Y + PLAY_H + 60) {
			s.enemies.splice(i, 1);
		}
	}

	// アイテムの寿命（スロー中は自機の移動速度と同じ割合でカウントダウンも遅くなる）
	const itemTimeMul = (12 - s.speedStacks * 2) / 12;
	for (let i = s.powers.length - 1; i >= 0; i--) {
		const p = s.powers[i];
		p.age += deltaMs * itemTimeMul;
		if (p.age >= ITEM_LIFE) { s.powers.splice(i, 1); sfxItemVanish(); continue; }
		// 最後の25%は点滅（描画側と同じく120msごと）。点く瞬間＝240msごとに小さな音
		if (p.age >= ITEM_LIFE * 0.75) {
			const k = Math.floor(p.age / 240);
			if (p.blinkTick !== k) { p.blinkTick = k; sfxItemBlink(k); }
		}
	}

	// ガイド回転
	const rotateSpeed = 0.06;
	if (s.leftHeld) s.guideAngle -= rotateSpeed * delta;
	if (s.rightHeld) s.guideAngle += rotateSpeed * delta;

	// プレイヤー移動
	s.player.x += s.vx * delta;
	s.player.y += s.vy * delta;

	reflectWalls(s);
	checkCollisions(s);
	if (!s.running) return;

	// コンボ切れ（自機の周りの円タイマーが0になった瞬間に途切れる）
	if (s.combo > 0) {
		s.comboTimer -= deltaMs;
		if (s.comboTimer <= 0) {
			if (s.combo > 1) {
				addPop(s, s.player.x, s.player.y - 40, t("comboEndFmt")(s.combo), COL_SUB, 13);
				sfxComboEnd(s.combo);
			}
			s.combo = 0;
		}
	}

	// 攻撃（自動発射）
	s.attackTimer += delta;
	if (s.attackStacks > 0) {
		const interval = [0, 60, 40, 25][s.attackStacks];
		if (s.attackTimer >= interval) {
			s.attackTimer = 0;
			s.attackProjectiles.push({
				x: s.player.x, y: s.player.y,
				vx: Math.cos(s.playerAngle) * 4, vy: Math.sin(s.playerAngle) * 4,
			});
			sfxFire();
		}
	}
	for (let i = s.attackProjectiles.length - 1; i >= 0; i--) {
		const b = s.attackProjectiles[i];
		b.x += b.vx * delta; b.y += b.vy * delta;
		if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) s.attackProjectiles.splice(i, 1);
	}

	// バリアの時限復活（Lvの数まで、BARRIER_REGEN msごとに1個）
	if (s.defenseStacks > 0 && s.defenseBarriers.length < s.defenseStacks) {
		s.barrierRegenTimer += deltaMs;
		if (s.barrierRegenTimer >= BARRIER_REGEN) {
			s.barrierRegenTimer = 0;
			regenBarrier(s);
		}
	} else {
		s.barrierRegenTimer = 0;
	}

	// 衝撃波：広がりながら範囲内の敵を倒す
	for (let i = s.shockwaves.length - 1; i >= 0; i--) {
		const w = s.shockwaves[i];
		w.age += deltaMs;
		const r = SHOCKWAVE_RADIUS * easeOutQuad(clamp(w.age / SHOCKWAVE_LIFE, 0, 1));
		for (let j = s.enemies.length - 1; j >= 0; j--) {
			const e = s.enemies[j];
			if (Math.hypot(e.x - w.x, e.y - w.y) < r) killEnemy(s, j);
		}
		if (w.age >= SHOCKWAVE_LIFE) s.shockwaves.splice(i, 1);
	}

	// バリア更新（自機先端の周囲を周回）
	if (s.defenseBarriers.length) {
		const radius = 24;
		const tip = getPlayerTipPos(s);
		s.defenseBarriers.forEach((b) => {
			b.angle += b.speed * delta;
			b.x = tip.x + Math.cos(b.angle) * radius;
			b.y = tip.y + Math.sin(b.angle) * radius;
		});
	}

	if (s.elapsedTime >= MAX_TIME) {
		doGameClear(s);
		return;
	}
	updateBeat(s);
}

/* ---- クリア演出：0.25秒停止 → 爆発＋壁崩壊 → 残骸がスコアへ ---- */
function wallBreakProgress(s) {
	if (!s.clear || !s.clear.boomed) return 0;
	return clamp((s.clear.age - CLEAR_FREEZE) / 600, 0, 1);
}
function fieldBounds(s) {
	const k = wallBreakProgress(s);
	return {
		x0: PLAY_X * (1 - k), y0: PLAY_Y * (1 - k),
		x1: PLAY_X + PLAY_W + (W - PLAY_X - PLAY_W) * k,
		y1: PLAY_Y + PLAY_H + (H - PLAY_Y - PLAY_H) * k,
	};
}
function spawnWallShards(s) {
	const n = 48;
	const per = 2 * (PLAY_W + PLAY_H) / n;
	for (let i = 0; i < n; i++) {
		let d = i * per, x, y;
		if (d < PLAY_W) { x = PLAY_X + d; y = PLAY_Y; }
		else if ((d -= PLAY_W) < PLAY_H) { x = PLAY_X + PLAY_W; y = PLAY_Y + d; }
		else if ((d -= PLAY_H) < PLAY_W) { x = PLAY_X + PLAY_W - d; y = PLAY_Y + PLAY_H; }
		else { d -= PLAY_W; x = PLAY_X; y = PLAY_Y + PLAY_H - d; }
		const a = Math.atan2(y - CY, x - CX) + (Math.random() - 0.5) * 0.6;
		const v = 0.15 + Math.random() * 0.25;
		s.particles.push({
			kind: "shard", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.0003,
			age: 0, life: 1400, color: "#5b78ff", size: 10 + Math.random() * 10, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.03,
		});
	}
}
function spawnConfetti(s, n) {
	for (let i = 0; i < n; i++) {
		s.particles.push({
			kind: "confetti", x: Math.random() * W, y: -10 - Math.random() * 40,
			vx: (Math.random() - 0.5) * 0.05, vy: 0.08 + Math.random() * 0.08, g: 0.00005,
			age: 0, life: 3500, color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
			size: 4 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02,
		});
	}
}
function updateClear(s, deltaMs, delta) {
	const c = s.clear;
	c.age += deltaMs;
	const a = c.age;
	if (a < CLEAR_FREEZE) return; // 時間停止中

	if (!c.boomed) {
		c.boomed = true;
		s.flashAlpha = 1;
		s.shake = 260;
		for (let i = 0; i < 6; i++) c.rings.push({ age: -i * 90, color: CONFETTI_COLORS[i] });
		spawnBurst(s, CX, CY, CONFETTI_COLORS, 60, 1.6);
		c.remnants.forEach((r) => spawnBurst(s, r.sx, r.sy, [COL_GRAZE, COL_ENEMY, "#ffffff"], 8, 0.8));
		spawnWallShards(s);
		sfxClearChord();
		sfxWallCrash();
	}
	c.rings.forEach((r) => { r.age += deltaMs; });
	if (a < CLEAR_FREEZE + 2200 && Math.random() < deltaMs / 40) spawnConfetti(s, 2);

	c.remnants.forEach((r, i) => {
		if (!r.dead && a > r.delay + CLEAR_FLY) {
			r.dead = true;
			s.absorbCount++;
			s.absorbPts += ABSORB_SCORE;
			s.scorePulse = 0;
			sfxAbsorb(i);
		}
	});
	// SURVIVED!と60秒トラックは爆発直後から、スコア確定は吸い込み完了時
	if (a >= CLEAR_FREEZE + 200) startResult(s);
	if (s.resultAge >= 0 && c.remnants.every((r) => r.dead)) finalizeResult(s);

	// 解放後は自機が加速しながら円を描いて飛び回る（操作不要、壁には当たらない）
	const k = wallBreakProgress(s);
	const o = c.orbit;
	const sp = SPEED_BASE * (1 + 1.2 * k);
	o.phi += o.dir * sp * delta / CLEAR_ORBIT_R;
	const ease = Math.min(1, deltaMs / 900);
	o.cx += (W / 2 - o.cx) * ease;
	o.cy += (H / 2 - o.cy) * ease;
	s.player.x = o.cx + Math.cos(o.phi) * CLEAR_ORBIT_R;
	s.player.y = o.cy + Math.sin(o.phi) * CLEAR_ORBIT_R;
	s.playerAngle = o.phi + o.dir * Math.PI / 2;
}

function updateEffects(s, deltaMs) {
	for (let i = s.particles.length - 1; i >= 0; i--) {
		const p = s.particles[i];
		p.age += deltaMs;
		p.vy += p.g * deltaMs;
		p.x += p.vx * deltaMs;
		p.y += p.vy * deltaMs;
		if (p.rot != null) p.rot += p.vr * deltaMs;
		if (p.drag) {
			const d = Math.pow(p.drag, deltaMs / (1000 / 60));
			p.vx *= d; p.vy *= d;
		}
		if (p.age >= p.life) s.particles.splice(i, 1);
	}
	for (let i = s.pops.length - 1; i >= 0; i--) {
		s.pops[i].age += deltaMs;
		if (s.pops[i].age >= s.pops[i].life) s.pops.splice(i, 1);
	}
	for (let i = s.beatRings.length - 1; i >= 0; i--) {
		s.beatRings[i].age += deltaMs;
		if (s.beatRings[i].age >= s.beatRings[i].life) s.beatRings.splice(i, 1);
	}
	s.strongAge += deltaMs;
	s.beatAge += deltaMs;
	s.scorePulse += deltaMs;
	s.itemPopAge += deltaMs;
	if (s.shake > 0) s.shake -= deltaMs;
	if (s.flashAlpha > 0) s.flashAlpha = Math.max(0, s.flashAlpha - deltaMs / 450);
	if (s.tapFlash) {
		s.tapFlash.age += deltaMs;
		if (s.tapFlash.age >= 260) s.tapFlash = null;
	}
	const target = currentScore(s);
	s.displayScore += (target - s.displayScore) * Math.min(1, deltaMs / 120);
	if (Math.abs(target - s.displayScore) < 1) s.displayScore = target;

	// 軌跡（時間停止中は伸ばさない）
	const frozen = s.phase === "hit" || (s.phase === "clear" && s.clear.age < CLEAR_FREEZE);
	if (!frozen) {
		s.trail.push({ x: s.player.x, y: s.player.y });
		const maxLen = s.phase === "clear" ? 40 : 22 + currentLevel(s) * 3;
		while (s.trail.length > maxLen) s.trail.shift();
	}
}

const COUNTDOWN_STEP = 450; // 3・2・1・GO! の1コマの長さ
let appScene = "title"; // "title" | "countdown" | "game"
let demo = null;
let titleAge = 0, countdownAge = 0;

function createDemoState() {
	const s = createGameState();
	s.demo = true;
	s.warnings.length = 0;
	s.enemySpawnInterval = 900;
	s.enemySpawnCount = 2;
	s.baseEnemySpeed = 1.4;
	s.autoTimer = 800;
	s.autoSide = "left";
	return s;
}
// 初回のサウンド確認（ON/OFFを選ぶと、押した反応を見せてから開始）。askSel はキーボード用の選択（0=ON、1=OFF）
// askChoice は選んだ後の演出中の状態 { on, age }。ASK_EXIT ms たったらカウントダウンへ
const ASK_EXIT = 480;
let soundAsk = false, soundAskAge = 0, askSel = 0, askChoice = null;
// touch＝指でタップして始めたか。確認ダイアログはスマホで音の準備が整うまでの時間稼ぎも兼ねるので、
// マウスやキーボードで始めたときは出さない
function requestStart(touch) {
	// すぐ始めるときは決定音を鳴らす（スマホの初回はダイアログで選ぶまで音を出さない）
	if (soundChosen || !touch) { sfxUiButton(); startCountdown(); return; }
	soundAsk = true;
	soundAskAge = 0;
	askSel = 0;
	askChoice = null;
}
function chooseSound(on) {
	if (askChoice) return; // 演出中の連打は無視
	setSound(on);
	askSel = on ? 0 : 1;
	askChoice = { on, age: 0 };
	// ONを選んだときだけ決定音（タイトル中は効果音を止めているので、この1回だけ許可する）
	if (on) {
		sfxMuted = false;
		sfxUiConfirm();
		sfxMuted = true;
	}
}
function goTitle() {
	appScene = "title";
	titleAge = 0;
	soundAsk = false;
	askChoice = null;
	// デモを作るときに最初の敵の予告音が鳴ってしまう（タイトルに戻るで「プーン」と聞こえていた）ので、先に消音する
	sfxMuted = true;
	demo = createDemoState();
}
function startCountdown() {
	sfxSoftHighs(false);
	game = createGameState();
	for (const k in activePointers) delete activePointers[k];
	appScene = "countdown";
	countdownAge = 0;
	sfxMuted = false;
	sfxCountdown(0);
}
// デモの自機は左右の長押しをランダムに真似して、操作の見本になる
function updateDemo(s, deltaMs, delta) {
	s.autoTimer -= deltaMs;
	if (s.guideVisible) {
		if (s.autoTimer <= 0) {
			s.leftHeld = false; s.rightHeld = false; s.guideVisible = false;
			s.tapFlash = { side: s.autoSide, age: 0 };
			setVelocityFromAngle(s, s.guideAngle);
			s.autoTimer = 900 + Math.random() * 900;
		}
	} else if (s.autoTimer <= 0) {
		s.autoSide = Math.random() < 0.5 ? "left" : "right";
		if (s.autoSide === "left") s.leftHeld = true; else s.rightHeld = true;
		s.guideAngle = Math.atan2(s.vy, s.vx);
		s.guideVisible = true;
		s.autoTimer = 250 + Math.random() * 450;
	}
	updateGameplay(s, deltaMs, delta);
	// 時間が進みすぎないよう巻き戻す（中央タイマーやクリアに到達させない）
	if (s.elapsedTime > 30000) {
		s.elapsedTime -= 20000;
		s.lastEnemySpawn = s.elapsedTime;
		s.lastPowerSpawn = s.elapsedTime;
	}
	updateEffects(s, deltaMs);
}

// ギリギリ直後の時間の速さ：20%で保持 → 元の速さへ戻す
function giriTimeScale(s, deltaMs) {
	if (s.slowAge < 0) return 1;
	s.slowAge += deltaMs;
	if (s.slowAge < GIRI_SLOW_HOLD) return GIRI_SLOW_MIN;
	if (s.slowAge < GIRI_SLOW_HOLD + GIRI_SLOW_BACK) return GIRI_SLOW_MIN + (1 - GIRI_SLOW_MIN) * (s.slowAge - GIRI_SLOW_HOLD) / GIRI_SLOW_BACK;
	s.slowAge = -1;
	return 1;
}

function update(deltaMs, delta) {
	if (appScene === "title") {
		titleAge += deltaMs;
		if (soundAsk) {
			soundAskAge += deltaMs;
			if (askChoice) {
				askChoice.age += deltaMs;
				if (askChoice.age >= ASK_EXIT) { soundAsk = false; askChoice = null; startCountdown(); }
			}
		}
		updateDemo(demo, deltaMs, delta);
		return;
	}
	if (appScene === "countdown") {
		const prevStep = Math.floor(countdownAge / COUNTDOWN_STEP);
		countdownAge += deltaMs;
		const step = Math.floor(countdownAge / COUNTDOWN_STEP);
		if (step !== prevStep && step <= 3) sfxCountdown(step);
		if (countdownAge >= COUNTDOWN_STEP * 3) appScene = "game"; // GO!の表示中にもう動き出す
		return;
	}
	const s = game;
	if (countdownAge < COUNTDOWN_STEP * 4) countdownAge += deltaMs;
	if (s.resultAge >= 0) {
		const prevT = s.resultAge;
		s.resultAge += deltaMs;
		sfxResultTicks(s, prevT, s.resultAge);
	}
	if (s.phase === "play") {
		const ts = giriTimeScale(s, deltaMs);
		updateGameplay(s, deltaMs * ts, delta * ts);
		if (s.edgeFlash > 0) s.edgeFlash = Math.max(0, s.edgeFlash - deltaMs / 400);
		updateEffects(s, deltaMs * ts); // 演出もまとめてスローにする
		updateMedalTwinkles(s, deltaMs);
		return;
	}
	if (s.phase === "hit") {
		s.hitAge += deltaMs;
		if (s.hitAge < HIT_FREEZE) return; // ヒットストップ中は演出も含めて全て止める
		if (!s.exploded) explodePlayer(s);
		// 爆発後も残った敵は流れ続ける（リザルトの背景）
		s.enemies.forEach((e) => {
			e.x += Math.cos(e.angle) * e.v * delta;
			e.y += Math.sin(e.angle) * e.v * delta;
			e.rot += 0.004 * deltaMs;
		});
		if (s.hitAge >= HIT_FREEZE + HIT_RESULT_DELAY) {
			startResult(s);
			finalizeResult(s);
		}
	} else if (s.phase === "clear") updateClear(s, deltaMs, delta);
	updateEffects(s, deltaMs);
	updateMedalTwinkles(s, deltaMs);
}

/* ==================== 描画 ==================== */
function stageColor(sec) {
	return sec > 30 ? COL_PLAYER : sec > 10 ? COL_GRAZE : COL_DANGER;
}
function nearCenterFade(s) {
	const d = Math.hypot(s.player.x - CX, s.player.y - CY);
	return clamp((d - 30) / 110, 0.35, 1);
}

function drawBackground(s) {
	const cleared = s.phase === "clear";
	const boomed = cleared && s.clear.boomed;
	const sec = remainSec(s);
	const k = wallBreakProgress(s);
	ctx.fillStyle = boomed ? "#0a1330" : COL_BG;
	ctx.fillRect(-20, -20, W + 40, H + 40);
	const b = fieldBounds(s);
	ctx.fillStyle = k > 0 ? "#13275e" : cleared ? "#0f1a44" : COL_FIELD;
	ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);

	// グリッド（拍に合わせて光る）
	const beatGlow = cleared ? 0 : Math.max(0, 1 - s.beatAge / 160) * (s.strongAge === s.beatAge ? 1 : 0.5);
	const gs = 32 + k * 16;
	ctx.save();
	ctx.strokeStyle = cleared ? "#22387e" : (sec <= 10 ? "#3a1840" : COL_GRID);
	ctx.lineWidth = 1 + beatGlow * 1.5;
	ctx.beginPath();
	for (let x = CX % gs; x <= W; x += gs) {
		if (x >= b.x0 && x <= b.x1) { ctx.moveTo(x, b.y0); ctx.lineTo(x, b.y1); }
	}
	for (let y = CY % gs; y <= H; y += gs) {
		if (y >= b.y0 && y <= b.y1) { ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y); }
	}
	ctx.stroke();
	ctx.restore();

	if (!boomed) {
		ctx.save();
		ctx.globalAlpha = cleared ? 0.7 : 1;
		ctx.strokeStyle = cleared ? COL_PLAYER : COL_BORDER;
		ctx.lineWidth = 2;
		ctx.strokeRect(PLAY_X, PLAY_Y, PLAY_W, PLAY_H);
		ctx.restore();
	}

	// 操作ガイド：中央線と、押している側／離した瞬間の光
	if (s.demo) return; // タイトルのデモでは出さない（操作説明パネルと紛らわしいため）
	if (s.phase === "play") {
		ctx.save();
		ctx.setLineDash([6, 8]);
		ctx.strokeStyle = COL_PLAYER;
		ctx.globalAlpha = 0.15;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(W / 2, 0);
		ctx.lineTo(W / 2, H);
		ctx.stroke();
		ctx.restore();
		if (s.leftHeld || s.rightHeld) {
			ctx.save();
			ctx.globalAlpha = 0.08;
			ctx.fillStyle = COL_PLAYER;
			if (s.leftHeld) ctx.fillRect(0, 0, W / 2, H);
			if (s.rightHeld) ctx.fillRect(W / 2, 0, W / 2, H);
			ctx.restore();
		}
	}
	if (s.tapFlash) {
		ctx.save();
		ctx.globalAlpha = 0.2 * (1 - s.tapFlash.age / 260);
		ctx.fillStyle = COL_PLAYER;
		ctx.fillRect(s.tapFlash.side === "left" ? 0 : W / 2, 0, W / 2, H);
		ctx.restore();
	}
}

function drawCenterTimer(s) {
	if (s.demo || s.phase === "clear" || s.exploded) return;
	const sec = remainSec(s);
	const col = stageColor(sec);
	const fade = nearCenterFade(s);
	const late = sec <= 10;

	// 秒に同期した波紋（大＝秒の頭、小＝裏拍）
	s.beatRings.forEach((g) => {
		if (g.age < 0) return;
		const k = g.age / g.life;
		const r = (g.strong ? 60 : 70) + k * (g.strong ? 190 : 120);
		strokeCircle(CX, CY, r, stageColor(g.sec), g.strong ? 4 * (1 - k) + 1 : 2, (1 - k) * (g.strong ? 0.6 : 0.3) * fade);
	});

	const k = Math.max(0, 1 - s.strongAge / 200);
	const kb = Math.max(0, 1 - s.beatAge / 140);
	const size = late ? 260 : 220;
	const sc = 1 + (late ? 0.45 : 0.12) * k + 0.03 * kb;
	ctx.save();
	ctx.translate(CX, CY);
	ctx.scale(sc, sc);
	drawOutlineText(String(sec), 0, 10, { size, weight: "bold", stroke: col, strokeWidth: late ? 5 : 3, alpha: (late ? 0.6 : 0.4) * fade });
	drawText(String(sec), 0, 10, { size, weight: "bold", align: "center", baseline: "middle", color: col, alpha: (late ? 0.16 : 0.08) * k * fade });
	ctx.restore();
	drawText("♪ ×" + beatMultiplier(sec), CX, CY + 96, { size: 13, weight: "bold", align: "center", baseline: "middle", color: col, alpha: 0.45 * fade });

	// 残り30秒・10秒の節目で帯のアナウンス
	[[30, "milestone30", COL_GRAZE], [10, "milestone10", COL_DANGER]].forEach(([m, key, color]) => {
		const a = s.elapsedTime - (60 - m) * 1000;
		if (a < 0 || a >= 1600) return;
		const ph = a / 1600;
		const slide = ph < 0.2 ? (1 - ph / 0.2) : ph > 0.8 ? -(ph - 0.8) / 0.2 : 0;
		ctx.save();
		ctx.globalAlpha = 0.85;
		ctx.fillStyle = color;
		ctx.fillRect(PLAY_X + slide * PLAY_W, CY - 128, PLAY_W, 46);
		ctx.restore();
		const text = t(key);
		drawText(text, CX + slide * PLAY_W, CY - 104, { size: fitFontSize(text, PLAY_W - 20, 22, "bold"), weight: "bold", align: "center", baseline: "middle", color: COL_BG });
	});
}

// 予告ライン：敵の色の帯と、その中を進行方向へ流れる白い矢印（入口ほど明るく、奥へ行くほど薄れる）
function drawWarningLane(x, y, angle, age, p, color, width) {
	const dx = Math.cos(angle), dy = Math.sin(angle);
	ctx.save();
	ctx.globalAlpha = 0.18 + 0.17 * p + 0.08 * Math.sin(age / 80);
	ctx.strokeStyle = color;
	ctx.lineWidth = width || 12;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + dx * 900, y + dy * 900);
	ctx.stroke();
	ctx.restore();
	const spacing = 34, travel = (age * WARNING_FLOW_SPEED) % spacing;
	ctx.save();
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 2.5;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	for (let d = 30 + travel; d < 420; d += spacing) {
		const cx = x + dx * d, cy = y + dy * d;
		ctx.globalAlpha = clamp(1 - d / 420, 0, 1) * 0.85;
		ctx.beginPath();
		ctx.moveTo(cx - dx * 4 + dy * 5, cy - dy * 4 - dx * 5);
		ctx.lineTo(cx + dx * 3, cy + dy * 3);
		ctx.lineTo(cx - dx * 4 - dy * 5, cy - dy * 4 + dx * 5);
		ctx.stroke();
	}
	ctx.restore();
}
// 出現位置の「!」バッジ（丸で囲んで目立たせ、外側に広がる輪で注意を引く）
function drawWarningBadge(x, y, angle, age, color, r) {
	r = r || 12;
	const bx = x + Math.cos(angle) * (r + 4), by = y + Math.sin(angle) * (r + 4);
	const ring = (age % 400) / 400;
	strokeCircle(bx, by, r + ring * 10, color, 2, 1 - ring);
	fillCircle(bx, by, r, color);
	strokeCircle(bx, by, r, "#ffffff", 2, 0.9);
	drawText("!", bx, by + 1, { size: r * 1.33, weight: "bold", align: "center", baseline: "middle", color: "#ffffff" });
}
// 隊列の予告：各レーンと、隙間（SAFE）を緑の点線枠で示す
function drawFormationWarning(w, p) {
	w.members.forEach((m) => drawWarningLane(m.x, m.y, w.angle, w.age, p, COL_ENEMY, 10));
	const horizontal = w.side === 0 || w.side === 2;
	ctx.save();
	ctx.strokeStyle = COL_SAFE;
	ctx.lineWidth = 2;
	ctx.setLineDash([6, 5]);
	ctx.globalAlpha = 0.6 + 0.3 * Math.sin(w.age / 90);
	if (horizontal) ctx.strokeRect(PLAY_X + w.gapStart + 3, PLAY_Y + 3, w.gapSize - 6, PLAY_H - 6);
	else ctx.strokeRect(PLAY_X + 3, PLAY_Y + w.gapStart + 3, PLAY_W - 6, w.gapSize - 6);
	ctx.restore();
	const dx = Math.cos(w.angle), dy = Math.sin(w.angle);
	const gx = horizontal ? PLAY_X + w.gapStart + w.gapSize / 2 : (w.side === 1 ? PLAY_X + PLAY_W : PLAY_X);
	const gy = horizontal ? (w.side === 0 ? PLAY_Y : PLAY_Y + PLAY_H) : PLAY_Y + w.gapStart + w.gapSize / 2;
	drawText("SAFE", gx + dx * 40, gy + dy * 40, { size: 13, weight: "bold", align: "center", baseline: "middle", color: COL_SAFE, stroke: COL_BG, strokeWidth: 3 });
	w.members.forEach((m) => drawWarningBadge(m.x, m.y, w.angle, w.age, COL_ENEMY, 9));
}
// 狙い撃ちの照準：予告時点の自機の位置に縮んでいく照準マーク
function drawAimReticle(w, p) {
	const r = 22 - 10 * p;
	ctx.save();
	ctx.strokeStyle = COL_AIM;
	ctx.lineWidth = 2.5;
	ctx.globalAlpha = 0.9;
	ctx.beginPath();
	ctx.arc(w.aimX, w.aimY, r, 0, Math.PI * 2);
	ctx.stroke();
	for (let i = 0; i < 4; i++) {
		const an = i * Math.PI / 2 + w.age / 300;
		ctx.beginPath();
		ctx.moveTo(w.aimX + Math.cos(an) * (r - 6), w.aimY + Math.sin(an) * (r - 6));
		ctx.lineTo(w.aimX + Math.cos(an) * (r + 8), w.aimY + Math.sin(an) * (r + 8));
		ctx.stroke();
	}
	ctx.restore();
}
function drawWarnings(s) {
	// 進路ラインはフィールド内だけに描く（HUDに被らないように）
	ctx.save();
	ctx.beginPath();
	ctx.rect(PLAY_X, PLAY_Y, PLAY_W, PLAY_H);
	ctx.clip();
	s.warnings.forEach((w) => {
		const p = clamp(w.age / w.life, 0, 1); // 出現が近いほどラインを濃くする
		if (w.kind === "formation") {
			drawFormationWarning(w, p);
			return;
		}
		const color = w.kind === "aim" ? COL_AIM : COL_ENEMY;
		drawWarningLane(w.x, w.y, w.angle, w.age, p, color);
		if (w.kind === "aim") drawAimReticle(w, p);
		drawWarningBadge(w.x, w.y, w.angle, w.age, color);
	});
	drawFormationFxField(s);
	ctx.restore();
	drawFormationFxSlots(s);
}
// 波・消えていく敵・流れる粒（フィールド内に描く）
function drawFormationFxField(s) {
	const fx = s.formFx;
	if (!fx) return;
	if (fx.age < 750) {
		const a = 1 - fx.age / 750, wv = fx.wave;
		ctx.save();
		ctx.globalAlpha = 0.12 * a;
		ctx.fillStyle = COL_ENEMY;
		if (fx.side === 0) ctx.fillRect(PLAY_X, PLAY_Y, PLAY_W, wv);
		if (fx.side === 2) ctx.fillRect(PLAY_X, PLAY_Y + PLAY_H - wv, PLAY_W, wv);
		if (fx.side === 1) ctx.fillRect(PLAY_X + PLAY_W - wv, PLAY_Y, wv, PLAY_H);
		if (fx.side === 3) ctx.fillRect(PLAY_X, PLAY_Y, wv, PLAY_H);
		ctx.globalAlpha = 0.85 * a;
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 4;
		ctx.shadowColor = COL_ENEMY;
		ctx.shadowBlur = 16;
		ctx.beginPath();
		if (fx.side === 0) { ctx.moveTo(PLAY_X, PLAY_Y + wv); ctx.lineTo(PLAY_X + PLAY_W, PLAY_Y + wv); }
		if (fx.side === 2) { ctx.moveTo(PLAY_X, PLAY_Y + PLAY_H - wv); ctx.lineTo(PLAY_X + PLAY_W, PLAY_Y + PLAY_H - wv); }
		if (fx.side === 1) { ctx.moveTo(PLAY_X + PLAY_W - wv, PLAY_Y); ctx.lineTo(PLAY_X + PLAY_W - wv, PLAY_Y + PLAY_H); }
		if (fx.side === 3) { ctx.moveTo(PLAY_X + wv, PLAY_Y); ctx.lineTo(PLAY_X + wv, PLAY_Y + PLAY_H); }
		ctx.stroke();
		ctx.restore();
	}
	fx.pending.forEach((e) => {
		const w = e.hitAt < 0 ? 0 : clamp((fx.age - e.hitAt) / FORM_WHITEN_MS, 0, 1);
		const color = e.kind === "aim" ? COL_AIM : COL_ENEMY;
		drawSpikyStar(e.x, e.y, e.rot, color, 11 * (1 + 0.25 * w));
		fillCircle(e.x, e.y, 3, "#ffd0ec");
		if (w > 0) drawSpikyStar(e.x, e.y, e.rot, "#ffffff", 11 * (1 + 0.25 * w));
	});
	fx.parts.forEach((p) => { if (p.age >= 0) fillCircle(p.x, p.y, 2, p.white ? "#ffffff" : COL_ENEMY, 0.75); });
}
// 出発位置で、集まった粒が隊列の敵の形になっていく（フィールドの外、辺のすぐ外側に描く）
function drawFormationFxSlots(s) {
	const fx = s.formFx;
	if (!fx) return;
	const fade = fx.age > FORMATION_WARNING_LIFE ? 1 - clamp((fx.age - FORMATION_WARNING_LIFE) / 350, 0, 1) : 1;
	if (fade <= 0) return;
	fx.slots.forEach((sl) => {
		const grow = Math.max(clamp(sl.got / 12, 0, 1), clamp((fx.age - 700) / (FORMATION_WARNING_LIFE - 700), 0, 1));
		if (grow <= 0) return;
		fillCircle(sl.x, sl.y, 14 * grow + 4, COL_ENEMY, 0.25 * grow * fade);
		ctx.save();
		ctx.globalAlpha = grow * fade;
		drawSpikyStar(sl.x, sl.y, fx.age * 0.004, COL_ENEMY, 11 * (0.4 + 0.6 * grow));
		ctx.restore();
		if (sl.flash > 0) fillCircle(sl.x, sl.y, 16, "#ffffff", sl.flash * 0.5 * fade);
	});
}
function drawEnemies(s) {
	s.enemies.forEach((e) => {
		ctx.save();
		ctx.globalAlpha = 0.35;
		ctx.strokeStyle = e.kind === "aim" ? COL_AIM : COL_ENEMY;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(e.x, e.y);
		ctx.lineTo(e.x - Math.cos(e.angle) * 22, e.y - Math.sin(e.angle) * 22);
		ctx.stroke();
		ctx.restore();
		const color = e.kind === "aim" ? COL_AIM : COL_ENEMY;
		drawSpikyStar(e.x, e.y, e.rot, color, 11);
		fillCircle(e.x, e.y, 3, "#ffd0ec");
		if (e.kind === "aim") strokeCircle(e.x, e.y, 15, COL_AIM, 1.5, 0.7);
	});
}
function drawPowers(s) {
	s.powers.forEach((p) => {
		const rest = 1 - p.age / ITEM_LIFE;
		const blink = rest < 0.25 && Math.floor(p.age / 120) % 2 === 1;
		const alpha = blink ? 0.35 : 1;
		const color = ITEM_COLORS[p.type];
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.translate(p.x, p.y);
		ctx.beginPath();
		for (let j = 0; j < 6; j++) {
			const a = j * Math.PI / 3 + Math.PI / 6;
			ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
		}
		ctx.closePath();
		ctx.strokeStyle = color;
		ctx.lineWidth = 2.5;
		ctx.stroke();
		ctx.restore();
		drawText(POWER_LABELS[p.type], p.x, p.y + 1, { size: 13, weight: "bold", align: "center", baseline: "middle", color, alpha });
		// 寿命リング
		ctx.save();
		ctx.globalAlpha = 0.6 * alpha;
		ctx.beginPath();
		ctx.arc(p.x, p.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rest);
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.restore();
	});
}
function drawBullets(s) {
	s.attackProjectiles.forEach((b) => fillCircle(b.x, b.y, 4, ITEM_COLORS.attack));
}
function drawBarriers(s) {
	s.shockwaves.forEach((w) => {
		const k = clamp(w.age / SHOCKWAVE_LIFE, 0, 1);
		const r = SHOCKWAVE_RADIUS * easeOutQuad(k);
		strokeCircle(w.x, w.y, r, ITEM_COLORS.defense, 6 * (1 - k) + 1, 1 - k);
		fillCircle(w.x, w.y, r, ITEM_COLORS.defense, 0.12 * (1 - k));
	});
	s.defenseBarriers.forEach((b) => fillCircle(b.x, b.y, 5, ITEM_COLORS.defense));
	drawBarrierRegen(s);
}
// 次に復活するバリアの位置に「空き枠」を出し、復活までの残り時間を扇形で満たしていく
function drawBarrierRegen(s) {
	if (s.phase !== "play" || s.defenseStacks <= 0 || s.defenseBarriers.length >= s.defenseStacks) return;
	const n = s.defenseBarriers.length;
	// 復活時に等間隔へ並べ直したときの位置と一致させる
	const angle = n ? s.defenseBarriers[0].angle + (n / (n + 1)) * Math.PI * 2 : s.elapsedTime * 0.08 / (1000 / 60);
	const tip = getPlayerTipPos(s);
	const x = tip.x + Math.cos(angle) * 24, y = tip.y + Math.sin(angle) * 24;
	const p = clamp(s.barrierRegenTimer / BARRIER_REGEN, 0, 1);
	// 本物と区別するため薄く描き、充電中であることを点滅で示す（完成間近ほど速く点滅）
	const period = 520 - 380 * p;
	const blink = 0.5 + 0.5 * Math.sin(s.barrierRegenTimer / period * Math.PI * 2);
	strokeCircle(x, y, 5, ITEM_COLORS.defense, 1.5, 0.25 + 0.3 * blink);
	ctx.save();
	ctx.globalAlpha = 0.15 + 0.25 * blink;
	ctx.fillStyle = ITEM_COLORS.defense;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.arc(x, y, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}
function rayToWall(x, y, a) {
	const dx = Math.cos(a), dy = Math.sin(a);
	let tb = 1e9, axis = "";
	if (dx > 0) { const k = (PLAY_X + PLAY_W - x) / dx; if (k < tb) { tb = k; axis = "x"; } }
	if (dx < 0) { const k = (PLAY_X - x) / dx; if (k < tb) { tb = k; axis = "x"; } }
	if (dy > 0) { const k = (PLAY_Y + PLAY_H - y) / dy; if (k < tb) { tb = k; axis = "y"; } }
	if (dy < 0) { const k = (PLAY_Y - y) / dy; if (k < tb) { tb = k; axis = "y"; } }
	return { x: x + dx * tb, y: y + dy * tb, angle: axis === "x" ? Math.PI - a : -a };
}
function drawGuide(s) {
	if (!s.guideVisible) return;
	// 進路の予測線（壁で1回反射するところまで）
	const hit = rayToWall(s.player.x, s.player.y, s.guideAngle);
	ctx.save();
	ctx.setLineDash([4, 6]);
	ctx.strokeStyle = COL_PLAYER;
	ctx.lineWidth = 2;
	ctx.globalAlpha = 0.55;
	ctx.beginPath();
	ctx.moveTo(s.player.x, s.player.y);
	ctx.lineTo(hit.x, hit.y);
	ctx.lineTo(hit.x + Math.cos(hit.angle) * 70, hit.y + Math.sin(hit.angle) * 70);
	ctx.stroke();
	ctx.restore();

	const a = s.guideAngle, x = s.player.x, y = s.player.y;
	const bx = x + Math.cos(a) * 30, by = y + Math.sin(a) * 30;
	ctx.save();
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 4;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(bx, by);
	ctx.lineTo(bx + Math.cos(a + 2.4) * 9, by + Math.sin(a + 2.4) * 9);
	ctx.moveTo(bx, by);
	ctx.lineTo(bx + Math.cos(a - 2.4) * 9, by + Math.sin(a - 2.4) * 9);
	ctx.stroke();
	ctx.restore();
}
function drawPlayer(s) {
	if (s.phase === "hit" && s.exploded) return; // 爆発して消える
	const hitStop = s.phase === "hit";
	// 軌跡：パワーアップ中はアイテムの色になり、Lvが高いほど少し長くなる（攻撃に見えないよう控えめに）
	const lv = currentLevel(s);
	const powerColor = lv > 0 ? ITEM_COLORS[s.playerType] : COL_PLAYER;
	ctx.save();
	ctx.lineCap = "round";
	ctx.strokeStyle = powerColor;
	for (let i = 1; i < s.trail.length; i++) {
		const k = i / s.trail.length;
		ctx.globalAlpha = k * 0.55;
		ctx.lineWidth = k * (8 + lv);
		ctx.beginPath();
		ctx.moveTo(s.trail[i - 1].x, s.trail[i - 1].y);
		ctx.lineTo(s.trail[i].x, s.trail[i].y);
		ctx.stroke();
	}
	ctx.restore();
	// ぶつかった敵を強調（自機の下に描いて本体は隠さない）
	if (hitStop && s.hitEnemy) drawSpikyStar(s.hitEnemy.x, s.hitEnemy.y, s.hitEnemy.rot, COL_ENEMY, 15);
	// 本体（扇形）：パワーアップ中はアイテムの色で縁取る
	const baseAngle = s.playerAngle + Math.PI;
	ctx.save();
	ctx.translate(s.player.x, s.player.y);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.arc(0, 0, PLAYER_RADIUS + 4, baseAngle - PLAYER_ANGLE, baseAngle + PLAYER_ANGLE);
	ctx.closePath();
	ctx.fillStyle = hitStop ? "#ffffff" : COL_PLAYER;
	ctx.fill();
	if (lv > 0 && !hitStop) {
		ctx.strokeStyle = powerColor;
		ctx.lineWidth = 2;
		ctx.lineJoin = "round";
		ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(s.elapsedTime / (420 - lv * 80)));
		ctx.stroke();
	}
	ctx.restore();
	// 当たり判定のコア（ヒットストップ中は赤く光らせて、どこに当たったかを見せる）
	const tip = getPlayerTipPos(s);
	fillCircle(tip.x, tip.y, hitStop ? 7 : 5, hitStop ? COL_DANGER : "#ffffff");
	if (hitStop) strokeCircle(tip.x, tip.y, 7, "#ffffff", 2, 1);
	drawComboTimer(s);
}

// 判定ゾーン：一番近い敵が近づいた時だけ、先端の周りに かすり（黄）/ギリギリ（橙）の範囲を出す
function drawGrazeZones(s) {
	if (s.phase !== "play" || s.demo || !s.enemies.length) return;
	const tip = getPlayerTipPos(s);
	let d = Infinity;
	s.enemies.forEach((e) => { d = Math.min(d, Math.hypot(e.x - tip.x, e.y - tip.y)); });
	const near = clamp(1 - (d - GRAZE_RADIUS) / 40, 0, 1);
	if (near <= 0) return;
	const inGraze = d < GRAZE_RADIUS && d > GIRI_RADIUS, inGiri = d <= GIRI_RADIUS;
	fillCircle(tip.x, tip.y, GRAZE_RADIUS, COL_GRAZE, (inGraze ? 0.22 : 0.08) * near);
	ctx.save();
	ctx.setLineDash([4, 4]);
	strokeCircle(tip.x, tip.y, GRAZE_RADIUS, COL_GRAZE, 1.5, 0.6 * near);
	ctx.restore();
	fillCircle(tip.x, tip.y, GIRI_RADIUS, COL_GIRI, (inGiri ? 0.4 : 0.12) * near);
	ctx.save();
	ctx.setLineDash([3, 3]);
	strokeCircle(tip.x, tip.y, GIRI_RADIUS, COL_GIRI, 1.5, 0.7 * near);
	ctx.restore();
}

// コンボの残り猶予：自機の周りの円タイマー（上から時計回りに減っていく）
function drawComboTimer(s) {
	if (s.phase !== "play" || s.combo <= 0) return;
	const rest = clamp(s.comboTimer / COMBO_WINDOW, 0, 1);
	const danger = s.comboTimer < 500;
	const blink = danger && Math.floor(s.comboTimer / 80) % 2 === 0;
	const color = danger ? COL_DANGER : COL_GRAZE;
	const x = s.player.x, y = s.player.y, r = 38; // 判定ゾーン（半径26）と重ならない大きさ
	strokeCircle(x, y, r, "#ffffff", 3, 0.08);
	ctx.save();
	ctx.globalAlpha = blink ? 0.35 : 0.85;
	ctx.strokeStyle = color;
	ctx.lineWidth = 3;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rest);
	ctx.stroke();
	ctx.restore();
	drawText("x" + s.combo, x, y - r - 9, { size: 12, weight: "bold", align: "center", baseline: "middle", color, stroke: COL_BG, strokeWidth: 3 });
}

function drawClearLayer(s) {
	if (s.phase !== "clear") return;
	const c = s.clear, a = c.age;
	if (a < CLEAR_FREEZE) {
		ctx.save();
		ctx.globalAlpha = 0.6;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, W, H);
		ctx.restore();
		drawOutlineText("0", CX, CY + 10, { size: 260, weight: "bold", stroke: "#ffffff", strokeWidth: 5, alpha: 0.85 });
		c.remnants.forEach((r) => {
			drawSpikyStar(r.sx, r.sy, r.rot, "#3a3a4a", 11);
			strokeCircle(r.sx, r.sy, 12, "#ffffff", 1.5, 0.9);
		});
		return;
	}
	// 虹色の波紋
	c.rings.forEach((r) => {
		if (r.age < 0) return;
		const k = r.age / 1100;
		if (k < 1) strokeCircle(CX, CY, k * 520, r.color, 10 * (1 - k) + 1, 1 - k);
	});
	// 解放の集中線
	const fa = Math.max(0, 1 - (a - CLEAR_FREEZE) / 2500);
	if (fa > 0) {
		ctx.save();
		ctx.strokeStyle = "#aee8ff";
		ctx.lineWidth = 2;
		ctx.globalAlpha = 0.35 * fa;
		ctx.beginPath();
		for (let i = 0; i < 28; i++) {
			const an = i / 28 * Math.PI * 2 + i;
			const r0 = 60 + (((a - CLEAR_FREEZE) * 0.6 + i * 53) % 300);
			ctx.moveTo(CX + Math.cos(an) * r0, CY + Math.sin(an) * r0);
			ctx.lineTo(CX + Math.cos(an) * (r0 + 50), CY + Math.sin(an) * (r0 + 50));
		}
		ctx.stroke();
		ctx.restore();
	}
	// 残骸：外へ弾かれてからスコアへ吸い込まれる
	const knock = easeOutQuad(clamp((a - CLEAR_FREEZE) / CLEAR_KNOCK, 0, 1));
	c.remnants.forEach((r) => {
		if (r.dead) return;
		const hx = r.sx + r.kx * 34 * knock, hy = r.sy + r.ky * 34 * knock;
		const cx = hx, cy = hy - 140;
		const f = clamp((a - r.delay) / CLEAR_FLY, 0, 1);
		const q = f * f;
		const bez = (u) => ({
			x: (1 - u) * (1 - u) * hx + 2 * (1 - u) * u * cx + u * u * SCORE_POS.x,
			y: (1 - u) * (1 - u) * hy + 2 * (1 - u) * u * cy + u * u * SCORE_POS.y,
		});
		if (f > 0) {
			for (let j = 1; j < 5; j++) {
				const p = bez(Math.max(0, q - j * 0.04));
				fillCircle(p.x, p.y, 4 - j * 0.7, COL_GRAZE, 0.5);
			}
		}
		const p = bez(q);
		drawSpikyStar(p.x, p.y, r.rot + a * 0.012, COL_GRAZE, (8 - 3 * f) * (1 + 0.2 * Math.sin(a / 60)));
	});
}

function drawParticles(s) {
	s.particles.forEach((p) => {
		const k = 1 - p.age / p.life;
		if (p.kind === "dot") {
			fillCircle(p.x, p.y, p.size, p.color, k);
			return;
		}
		ctx.save();
		ctx.globalAlpha = p.kind === "confetti" ? Math.min(1, k * 3) : k;
		ctx.translate(p.x, p.y);
		ctx.rotate(p.rot);
		if (p.kind === "confetti") {
			ctx.fillStyle = p.color;
			ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
		} else if (p.kind === "frag") {
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.moveTo(p.size, 0);
			ctx.lineTo(-p.size * 0.6, p.size * 0.5);
			ctx.lineTo(-p.size * 0.4, -p.size * 0.6);
			ctx.closePath();
			ctx.fill();
		} else {
			ctx.strokeStyle = p.color;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(-p.size / 2, 0);
			ctx.lineTo(p.size / 2, 0);
			ctx.stroke();
		}
		ctx.restore();
	});
	s.pops.forEach((p) => {
		const k = p.age / p.life;
		drawText(p.text, p.x, p.y - 26 * k, { size: p.size, weight: "bold", align: "center", baseline: "middle", color: p.color, alpha: 1 - k, stroke: COL_BG, strokeWidth: 4 });
	});
}

function drawHud(s) {
	const sec = remainSec(s);
	const cleared = s.phase === "clear";
	// 残り10秒は画面の縁が拍に合わせて赤く光る
	if (s.phase === "play" && sec <= 10) {
		const k = Math.max(0, 1 - s.beatAge / 200) * (s.strongAge === s.beatAge ? 1 : 0.6);
		ctx.save();
		ctx.globalAlpha = 0.2 + 0.6 * k;
		ctx.strokeStyle = COL_DANGER;
		ctx.lineWidth = 8;
		ctx.strokeRect(4, 4, W - 8, H - 8);
		ctx.restore();
	}
	if (!(cleared && s.clear.boomed)) {
		fillRoundRect(PLAY_X, PLAY_Y - 8, PLAY_W, 4, 2, "#1c2550");
		fillRoundRect(PLAY_X, PLAY_Y - 8, PLAY_W * Math.min(1, s.elapsedTime / MAX_TIME), 4, 2, cleared ? COL_PLAYER : stageColor(sec));
	}
	// 上部HUD：左＝BEST/コンボ、中央＝パワーアップ、右＝スコア
	const pk = Math.max(0, 1 - s.scorePulse / 200);
	drawText(t("scoreLabel"), W - 16, 14, { size: 11, align: "right", baseline: "middle", color: COL_SUB });
	ctx.save();
	ctx.translate(W - 16, 34);
	ctx.scale(1 + 0.3 * pk, 1 + 0.3 * pk);
	drawText(Math.floor(s.displayScore).toLocaleString(), 0, 0, { size: 22, weight: "bold", align: "right", baseline: "middle", color: pk > 0 ? COL_GRAZE : "#ffffff" });
	ctx.restore();
	drawText(t("bestFmt")(bestScore.toLocaleString()), 16, 14, { size: 11, align: "left", baseline: "middle", color: COL_SUB });
	if (cleared) return;
	drawComboHud(s);
	drawPowerHud(s);
	// 下部：ルール・操作説明
	if (s.phase === "play" || s.phase === "hit") {
		drawText(t("howto1"), W / 2, H - 40, { size: fitFontSize(t("howto1"), W - 32, 12), align: "center", baseline: "middle", color: COL_SUB });
		drawText(t("howto2"), W / 2, H - 20, { size: fitFontSize(t("howto2"), W - 32, 12), align: "center", baseline: "middle", color: COL_SUB });
	}
}

// コンボ数（残り猶予は自機の周りの円タイマーで見せる）
function drawComboHud(s) {
	if (s.combo > 0) {
		drawText(t("comboFmt")(s.combo), 16, 32, { size: 15, weight: "bold", align: "left", baseline: "middle", color: COL_GRAZE });
	}
}

// パワーアップ：原作のバナーと同じく上部中央に表示。取得時は拡大して弾む
const POWER_HUD = { w: 116, h: 40, y: 6 };
function drawPowerHud(s) {
	const lv = currentLevel(s);
	const color = s.playerType ? ITEM_COLORS[s.playerType] : COL_SUB;
	const popT = clamp(s.itemPopAge / 300, 0, 1);
	const sc = popT < 1 ? 1.5 + (1 - 1.5) * easeOutBack(popT) : 1;
	ctx.save();
	ctx.translate(W / 2, POWER_HUD.y + POWER_HUD.h / 2);
	ctx.scale(sc, sc);
	const x = -POWER_HUD.w / 2, y = -POWER_HUD.h / 2;
	fillRoundRect(x, y, POWER_HUD.w, POWER_HUD.h, 10, "#0b1230");
	strokeRoundRect(x, y, POWER_HUD.w, POWER_HUD.h, 10, color, s.playerType ? 2 : 1, s.playerType ? 1 : 0.6);
	const label = s.playerType ? t("itemLabels")[s.playerType] : t("noItem");
	drawText(label, 0, y + 14, { size: fitFontSize(label, POWER_HUD.w - 16, 13, "bold"), weight: "bold", align: "center", baseline: "middle", color, alpha: s.playerType ? 1 : 0.7 });
	for (let i = 0; i < 3; i++) {
		fillRoundRect(-26 + i * 18 - 7, y + 25, 14, 8, 2, i < lv ? color : "#1c2550");
	}
	ctx.restore();
}

function drawHitOverlay(s) {
	if (s.phase !== "hit" || !s.exploded) return;
	const ex = s.hitAge - HIT_FREEZE;
	const k = Math.max(0, 1 - ex / 400);
	ctx.save();
	ctx.globalAlpha = 0.35 * k;
	ctx.fillStyle = COL_DANGER;
	ctx.fillRect(0, 0, W, H);
	ctx.restore();
	// 衝撃波
	(s.hitRings || []).forEach((r) => {
		const age = ex + r.age;
		if (age < 0) return;
		const kk = age / 600;
		if (kk < 1) strokeCircle(s.hitPos.x, s.hitPos.y, 12 + easeOutQuad(kk) * 170, r.color, 8 * (1 - kk) + 1, 1 - kk);
	});
}

/* ---- リザルト：タイトル＋60秒トラック（同時に開始）→ スコアパネル → ランク → RETRY ---- */
const RESULT_TRACK = { x0: 40, x1: 316, y: 128, dur: 1000 };
const RESULT_ROW_Y = 204, RESULT_ROW_STEP = 27;

function resultRows(s) {
	const secText = (Math.min(s.elapsedTime, MAX_TIME) / 1000).toFixed(2);
	const survivalPts = Math.floor(Math.min(s.elapsedTime, MAX_TIME) / 1000 * SURVIVAL_SCORE_PER_SEC);
	const rows = [
		[t("rowSurvivalFmt")(secText), survivalPts],
		[t("rowGrazeFmt")(s.grazeCount, s.giriCount), s.grazePts],
		[t("rowKillFmt")(s.killCount), s.killPts],
		[t("rowItemFmt")(s.itemCount), s.itemPts],
	];
	if (s.cleared) rows.push([t("rowAbsorb"), s.absorbPts]);
	return rows;
}
function resultTimes(s) {
	const n = s.cleared ? 5 : 4;
	const rowsStart = 600;
	const totalStart = rowsStart + n * 150 + 100;
	// ランクはスコア確定（クリア時は吸い込み完了）を待ってから押す
	const rankAt = s.finalized ? Math.max(totalStart + 750, s.finalizedAt + 200) : Infinity;
	return { rowsStart, totalStart, rankAt, retryAt: rankAt + 350 };
}
function resultTitleText(s) {
	if (s.cleared) {
		if (s.playerType === "attack") return t("clearTitleAttack");
		if (s.playerType === "defense") return t("clearTitleDefense");
		if (s.playerType === "speed") return t("clearTitleSpeed");
		return t("clearTitleDefault");
	}
	return t("gameOverTitles")[s.resultTitleIndex];
}
// 称号：前置きを小さく、本体を大きく2行で表示
function drawTitlePair(pair, x, y, maxW, alpha) {
	drawText(pair[0], x, y - 12, { size: fitFontSize(pair[0], maxW, 12, "bold"), weight: "bold", align: "center", baseline: "middle", color: "#7fa6d6", alpha });
	drawText(pair[1], x, y + 8, { size: fitFontSize(pair[1], maxW, 19, "bold"), weight: "bold", align: "center", baseline: "middle", color: "#e8f7ff", alpha });
}

// メダル：上のメダルほど光の筋ときらめきが多い。ネオンは虹色に移り変わる
function medalColor(tier, time) {
	if (tier < 4) return MEDALS[tier].color;
	return "hsl(" + ((time / 8) % 360) + ",100%,65%)";
}
function drawMedal(s, x, y, k, time) {
	const tier = medalTier(s.total);
	const lvl = MEDALS[tier].sparkle;
	const col = medalColor(tier, time);
	const R = 26;
	// 背景で回る光の筋
	if (k >= 1) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(time / 2400);
		ctx.globalAlpha = 0.06 + 0.035 * lvl;
		ctx.fillStyle = col;
		for (let i = 0; i < 12; i++) {
			ctx.rotate(Math.PI / 6);
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(-5, -44 - lvl * 3);
			ctx.lineTo(5, -44 - lvl * 3);
			ctx.closePath();
			ctx.fill();
		}
		ctx.restore();
	}
	// 本体（拡大状態から押し込まれるように着地）
	const sc = k < 1 ? 2.2 - 1.2 * easeOutBack(k) : 1;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(sc, sc);
	ctx.globalAlpha = clamp(k * 2, 0, 1);
	ctx.fillStyle = COL_ENEMY;
	ctx.beginPath();
	ctx.moveTo(-R * 0.65, -R * 1.6); ctx.lineTo(-R * 0.15, -R * 1.6); ctx.lineTo(R * 0.2, -R * 0.7); ctx.lineTo(-R * 0.3, -R * 0.7);
	ctx.fill();
	ctx.fillStyle = COL_PLAYER;
	ctx.beginPath();
	ctx.moveTo(R * 0.65, -R * 1.6); ctx.lineTo(R * 0.15, -R * 1.6); ctx.lineTo(-R * 0.2, -R * 0.7); ctx.lineTo(R * 0.3, -R * 0.7);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(0, 0, R, 0, Math.PI * 2);
	ctx.fillStyle = col;
	ctx.fill();
	ctx.beginPath();
	ctx.arc(0, 0, R * 0.72, 0, Math.PI * 2);
	ctx.strokeStyle = "rgba(6,10,28,0.3)";
	ctx.lineWidth = 2;
	ctx.stroke();
	starPath(0, 0, R * 0.42);
	ctx.fillStyle = "rgba(255,255,255,0.55)";
	ctx.fill();
	// 表面を横切る光
	const ph = ((time % 1800) / 1800) * 3 - 1;
	ctx.save();
	ctx.beginPath();
	ctx.arc(0, 0, R, 0, Math.PI * 2);
	ctx.clip();
	ctx.rotate(-0.6);
	ctx.fillStyle = "rgba(255,255,255,0.55)";
	ctx.fillRect(ph * R * 1.6 - 6, -R * 1.5, 12, R * 3);
	ctx.fillStyle = "rgba(255,255,255,0.25)";
	ctx.fillRect(ph * R * 1.6 + 10, -R * 1.5, 5, R * 3);
	ctx.restore();
	ctx.restore();
	// 着地の光の輪
	if (k > 0.5 && k < 1.4) {
		const f = clamp((k - 0.5) / 0.9, 0, 1);
		strokeCircle(x, y, R + f * 50, col, 3 * (1 - f) + 1, 1 - f);
	}
	// きらめき
	s.medalTwinkles.forEach((p) => {
		const q = p.age / p.life, a = Math.sin(q * Math.PI), r = p.r * a;
		ctx.save();
		ctx.globalAlpha = a;
		ctx.fillStyle = tier === 4 ? medalColor(4, time + p.x * 20) : "#ffffff";
		ctx.beginPath();
		ctx.moveTo(p.x, p.y - r);
		ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
		ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
		ctx.quadraticCurveTo(p.x, p.y, p.x - r, p.y);
		ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
		ctx.fill();
		ctx.restore();
	});
}
function updateMedalTwinkles(s, deltaMs) {
	for (let i = s.medalTwinkles.length - 1; i >= 0; i--) {
		s.medalTwinkles[i].age += deltaMs;
		if (s.medalTwinkles[i].age >= s.medalTwinkles[i].life) s.medalTwinkles.splice(i, 1);
	}
	if (!s.finalized || s.resultAge < resultTimes(s).rankAt + 320) return;
	const tier = medalTier(s.total);
	const pos = medalPos(s);
	if (Math.random() < deltaMs / (700 / MEDALS[tier].sparkle)) {
		s.medalTwinkles.push({
			x: pos.x + (Math.random() - 0.5) * 110, y: pos.y + (Math.random() - 0.5) * 80,
			age: 0, life: 500 + Math.random() * 400, r: 3 + Math.random() * 4 + (tier >= 3 ? 2 : 0),
		});
	}
}
function medalPos(s) {
	const n = s.cleared ? 5 : 4;
	return { x: 92, y: RESULT_ROW_Y + n * RESULT_ROW_STEP + 14 + 80 };
}
function drawResultTrack(s, T) {
	const { x0, x1, y, dur } = RESULT_TRACK;
	const k = clamp(T / 300, 0, 1);
	const survived = Math.min(s.elapsedTime, MAX_TIME) / 1000;
	fillRoundRect(x0, y - 3, x1 - x0, 6, 3, "#1c2550", k);
	for (let sec = 0; sec <= 60; sec += 10) {
		const x = x0 + (x1 - x0) * sec / 60;
		ctx.save();
		ctx.globalAlpha = k;
		ctx.fillStyle = COL_BORDER;
		ctx.fillRect(x - 1, y + 6, 2, 6);
		ctx.restore();
		drawText(String(sec), x, y + 20, { size: 10, align: "center", baseline: "middle", color: COL_SUB, alpha: k });
	}
	// ゴール旗
	ctx.save();
	ctx.globalAlpha = k;
	ctx.fillStyle = COL_GRAZE;
	ctx.fillRect(x1 + 2, y - 26, 2, 26);
	ctx.beginPath();
	ctx.moveTo(x1 + 4, y - 26);
	ctx.lineTo(x1 + 20, y - 20);
	ctx.lineTo(x1 + 4, y - 14);
	ctx.fill();
	ctx.restore();
	// 自機が生存時間の位置まで走る
	const p = easeOutQuad(clamp(T / dur, 0, 1));
	const tt = survived * p;
	const rx = x0 + (x1 - x0) * tt / 60;
	fillRoundRect(x0, y - 3, Math.max(0, rx - x0), 6, 3, COL_PLAYER, k);
	ctx.save();
	ctx.globalAlpha = k;
	ctx.translate(rx, y);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.arc(0, 0, 14, Math.PI - PLAYER_ANGLE, Math.PI + PLAYER_ANGLE);
	ctx.closePath();
	ctx.fillStyle = "#ffffff";
	ctx.fill();
	ctx.restore();
	drawText(tt.toFixed(2) + "s", Math.min(rx, x1 - 26), y - 22, { size: 14, weight: "bold", align: "center", baseline: "middle", color: "#ffffff", alpha: k });
	if (T < dur) return;
	const k2 = clamp((T - dur) / 400, 0, 1);
	if (s.cleared) {
		strokeCircle(x1, y, 10 + k2 * 60, COL_GRAZE, 3 * (1 - k2) + 1, 1 - k2);
		drawText(t("goal"), W / 2, y + 40, { size: 16, weight: "bold", align: "center", baseline: "middle", color: COL_GRAZE, alpha: k2 });
	} else {
		ctx.save();
		ctx.globalAlpha = k2;
		ctx.setLineDash([3, 4]);
		ctx.strokeStyle = COL_DANGER;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(rx, y);
		ctx.lineTo(x1, y);
		ctx.stroke();
		ctx.restore();
		const text = t("remainToClearFmt")((60 - survived).toFixed(2));
		drawText(text, W / 2, y + 40, { size: 13, weight: "bold", align: "center", baseline: "middle", color: COL_GRAZE, alpha: k2 });
	}
}
function drawResult(s) {
	if (s.resultAge < 0) return;
	const T = s.resultAge;
	const times = resultTimes(s);
	ctx.save();
	ctx.globalAlpha = clamp(T / 400, 0, 1) * (s.cleared ? 0.35 : 0.55);
	ctx.fillStyle = COL_BG;
	ctx.fillRect(0, 0, W, H);
	ctx.restore();

	// タイトル（クリアはSURVIVED!、やられた時もネガティブにせずRESULT）
	const kt = clamp(T / 400, 0, 1);
	ctx.save();
	ctx.translate(W / 2, 66);
	const sc = 2.2 - 1.2 * easeOutBack(kt);
	ctx.scale(sc, sc);
	drawText(s.cleared ? t("survived") : t("resultTitle"), 0, 0, { size: 38, weight: "bold", align: "center", baseline: "middle", color: "#ffffff", stroke: s.cleared ? COL_PLAYER : COL_SUB, strokeWidth: 7, alpha: kt });
	ctx.restore();
	drawResultTrack(s, T);

	// スコアパネル
	const rows = resultRows(s);
	const n = rows.length;
	const ty = RESULT_ROW_Y + n * RESULT_ROW_STEP + 14;
	const panelY = RESULT_ROW_Y - 26, panelH = ty + 116 - panelY;
	const kp = clamp((T - times.rowsStart + 100) / 300, 0, 1);
	fillRoundRect(24, panelY, 312, panelH, 14, "rgba(6,10,28,0.8)", kp);
	strokeRoundRect(24, panelY, 312, panelH, 14, COL_BORDER, 1, kp);
	rows.forEach((r, i) => {
		const k = clamp((T - times.rowsStart - i * 150) / 250, 0, 1);
		if (k <= 0) return;
		const off = 30 * (1 - easeOutQuad(k));
		const y = RESULT_ROW_Y + i * RESULT_ROW_STEP;
		drawText(r[0], 44 + off, y, { size: 14, align: "left", baseline: "middle", color: "#aab4ff", alpha: k });
		drawText(r[1].toLocaleString(), 316 + off, y, { size: 15, weight: "bold", align: "right", baseline: "middle", color: "#ffffff", alpha: k });
		ctx.save();
		ctx.globalAlpha = k;
		ctx.fillStyle = "#1c2550";
		ctx.fillRect(44, y + 13, 272, 1);
		ctx.restore();
	});
	if (T >= times.totalStart - 100) {
		const p = clamp((T - times.totalStart) / 600, 0, 1);
		const total = s.finalized ? s.total : currentScore(s);
		drawText(t("totalLabel"), 44, ty, { size: 14, align: "left", baseline: "middle", color: COL_GRAZE });
		drawText(Math.round(total * easeOutQuad(p)).toLocaleString(), 316, ty, { size: 32, weight: "bold", align: "right", baseline: "middle", color: COL_GRAZE });
		drawText(t("bestFmt")(bestScore.toLocaleString()), 44, ty + 26, { size: 11, align: "left", baseline: "middle", color: COL_SUB });
	}
	if (T >= times.rankAt) {
		const kr = clamp((T - times.rankAt) / 260, 0, 1);
		if (s.newRecord) {
			ctx.save();
			ctx.translate(W - 94, ty + 28);
			const ns = 1.6 - 0.6 * easeOutBack(kr);
			ctx.scale(ns, ns);
			fillRoundRect(-62, -12, 124, 24, 12, COL_ENEMY, kr);
			drawText(t("newRecord"), 0, 1, { size: 13, weight: "bold", align: "center", baseline: "middle", color: "#ffffff", alpha: kr });
			ctx.restore();
		}
		const mp = medalPos(s);
		drawMedal(s, mp.x, mp.y, clamp((T - times.rankAt) / 320, 0, 2), T);
		const kn = clamp((T - times.rankAt - 450) / 300, 0, 1);
		const tier = medalTier(s.total);
		drawText(MEDALS[tier].name, 226, ty + 54, { size: 20, weight: "bold", align: "center", baseline: "middle", color: medalColor(tier, T), alpha: kn });
		drawTitlePair(resultTitleText(s), 226, ty + 92, 186, kn);
	}
	if (T >= times.retryAt) {
		const kb = clamp((T - times.retryAt) / 300, 0, 1);
		fillRoundRect(BTN_RETRY.x, BTN_RETRY.y, BTN_RETRY.w, BTN_RETRY.h, 8, "rgba(6,10,28,0.6)", kb);
		strokeRoundRect(BTN_RETRY.x, BTN_RETRY.y, BTN_RETRY.w, BTN_RETRY.h, 8, COL_PLAYER, 2, kb);
		drawText(t("retryBtn"), BTN_RETRY.x + BTN_RETRY.w / 2, BTN_RETRY.y + BTN_RETRY.h / 2 + 1, {
			size: 20, weight: "bold", align: "center", baseline: "middle", color: COL_PLAYER, alpha: kb,
		});
		fillRoundRect(BTN_TITLE.x, BTN_TITLE.y, BTN_TITLE.w, BTN_TITLE.h, 8, "rgba(6,10,28,0.6)", kb);
		strokeRoundRect(BTN_TITLE.x, BTN_TITLE.y, BTN_TITLE.w, BTN_TITLE.h, 8, COL_SUB, 1.5, kb);
		drawText(t("titleBtn"), BTN_TITLE.x + BTN_TITLE.w / 2, BTN_TITLE.y + BTN_TITLE.h / 2 + 1, {
			size: fitFontSize(t("titleBtn"), BTN_TITLE.w - 12, 15, "bold"), weight: "bold", align: "center", baseline: "middle", color: "#aab4ff", alpha: kb,
		});
	}
}
// スコアが確定してパネルが出たら上部HUDを隠して言語切替とRETRYを受け付ける
// （クリア時は残骸が右上のSCOREへ吸い込まれ終わるまでHUDを残す）
function resultUiVisible(s) {
	return s.finalized && s.resultAge >= resultTimes(s).rowsStart;
}

function drawWorld(s) {
	ctx.save();
	if (s.shake > 0) {
		const m = s.phase === "clear" ? 8 : (s.phase === "play" && remainSec(s) <= 5 ? 7 : 4);
		ctx.translate((Math.random() - 0.5) * m * 2, (Math.random() - 0.5) * m * 2);
	}
	drawBackground(s);
	drawCenterTimer(s);
	drawWarnings(s);
	drawEnemies(s);
	drawPowers(s);
	drawBullets(s);
	drawBarriers(s);
	drawGuide(s);
	drawGrazeZones(s);
	drawPlayer(s);
	drawClearLayer(s);
	drawParticles(s);
	if (s.flashAlpha > 0) {
		ctx.save();
		ctx.globalAlpha = s.flashAlpha * 0.8;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(-20, -20, W + 40, H + 40);
		ctx.restore();
	}
	drawHitOverlay(s);
	if (s.edgeFlash > 0) {
		ctx.save();
		ctx.globalAlpha = s.edgeFlash * 0.5;
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 10;
		ctx.strokeRect(0, 0, W, H);
		ctx.restore();
	}
	if (!s.demo && !resultUiVisible(s)) drawHud(s);
	ctx.restore();
}

function draw() {
	ctx.clearRect(0, 0, W, H);
	if (appScene === "title") {
		drawWorld(demo);
		drawTitleScreen();
		return;
	}
	const s = game;
	drawWorld(s);
	if (appScene === "countdown") {
		drawCountdown();
		return;
	}
	if (countdownAge < COUNTDOWN_STEP * 4) drawCountdown(); // GO!の残りを開始直後にも重ねる
	drawResult(s);
	if (resultUiVisible(s)) {
		drawLangButton();
		drawSoundButton();
	}
}

/* ==================== タイトル画面 ====================
 * 背景はデモプレイ（自動で逃げ回る）、手前にロゴ・操作説明・ルール・ベストを重ねる */
const HOWTO_BOX = { x: 34, y: 196, w: 292, h: 150 };
const HOWTO_SIDE_MS = 1350; // 左（右）1回分の実演の長さ
const HOWTO_HOLD_MS = 700; // そのうち長押ししている時間
const HOWTO_MOVE_SPEED = 0.1; // px/ms（離した後に進む速さ）

function drawLogo(cx, cy, k) {
	const sc = 1.6 - 0.6 * easeOutBack(k);
	ctx.save();
	ctx.translate(cx, cy);
	ctx.scale(sc, sc);
	if (lang === "ja") {
		drawOutlineText(t("logo1"), 0, -26, { size: 74, weight: "bold", stroke: COL_PLAYER, strokeWidth: 5, alpha: k });
		drawText(t("logo1"), 0, -26, { size: 74, weight: "bold", align: "center", baseline: "middle", color: COL_PLAYER, alpha: 0.15 * k });
		drawText(t("logo2"), 0, 40, { size: 46, weight: "bold", align: "center", baseline: "middle", color: "#ffffff", stroke: COL_ENEMY, strokeWidth: 7, alpha: k });
	} else {
		drawOutlineText(t("logo1"), 0, -24, { size: 64, weight: "bold", stroke: COL_PLAYER, strokeWidth: 5, alpha: k });
		drawText(t("logo1"), 0, -24, { size: 64, weight: "bold", align: "center", baseline: "middle", color: COL_PLAYER, alpha: 0.15 * k });
		drawText(t("logo2"), 0, 30, { size: 30, weight: "bold", align: "center", baseline: "middle", color: "#ffffff", stroke: COL_ENEMY, strokeWidth: 6, alpha: k });
	}
	ctx.restore();
}

// 操作の実演：左（右）を長押し → ガイドが回る → 離すとその向きへ
function drawHowto() {
	const b = HOWTO_BOX;
	fillRoundRect(b.x, b.y, b.w, b.h, 12, "rgba(6,10,28,0.85)");
	strokeRoundRect(b.x, b.y, b.w, b.h, 12, COL_BORDER, 1);
	const cyc = titleAge % (HOWTO_SIDE_MS * 2);
	const side = cyc < HOWTO_SIDE_MS ? "left" : "right";
	const local = cyc % HOWTO_SIDE_MS;
	const held = local < HOWTO_HOLD_MS;
	ctx.save();
	roundRectPath(b.x, b.y, b.w, b.h, 12);
	ctx.clip();
	if (held) {
		ctx.globalAlpha = 0.12;
		ctx.fillStyle = COL_PLAYER;
		ctx.fillRect(side === "left" ? b.x : W / 2, b.y, b.w / 2, b.h);
	} else if (local < HOWTO_HOLD_MS + 260) {
		ctx.globalAlpha = 0.25 * (1 - (local - HOWTO_HOLD_MS) / 260);
		ctx.fillStyle = COL_PLAYER;
		ctx.fillRect(side === "left" ? b.x : W / 2, b.y, b.w / 2, b.h);
	}
	ctx.restore();
	ctx.save();
	ctx.setLineDash([4, 5]);
	ctx.strokeStyle = COL_PLAYER;
	ctx.globalAlpha = 0.3;
	ctx.beginPath();
	ctx.moveTo(W / 2, b.y + 4);
	ctx.lineTo(W / 2, b.y + b.h - 4);
	ctx.stroke();
	ctx.restore();

	const cx = W / 2, cy = b.y + 66;
	const base = -Math.PI / 2;
	const turn = (side === "left" ? -1 : 1) * Math.min(local / HOWTO_HOLD_MS, 1) * 1.2;
	const guideAngle = base + turn;
	const bodyAngle = held ? base : guideAngle;
	// 離したら、決めた向きへ実際に進んでいく（軌跡つき）。次の長押しの前にフェードして中央へ戻る
	const moveT = held ? 0 : local - HOWTO_HOLD_MS;
	const posAt = (tt) => ({ x: cx + Math.cos(guideAngle) * tt * HOWTO_MOVE_SPEED, y: cy + Math.sin(guideAngle) * tt * HOWTO_MOVE_SPEED });
	const moveMs = HOWTO_SIDE_MS - HOWTO_HOLD_MS;
	const alpha = Math.min(clamp(local / 150, 0, 1), held ? 1 : clamp((moveMs - moveT) / 200, 0, 1));
	if (moveT > 0) {
		ctx.save();
		ctx.lineCap = "round";
		ctx.strokeStyle = COL_PLAYER;
		for (let i = 1; i <= 10; i++) {
			const t0 = Math.max(0, moveT - i * 40), t1 = Math.max(0, moveT - (i - 1) * 40);
			if (t1 <= 0) break;
			const a = posAt(t0), c = posAt(t1);
			ctx.globalAlpha = (1 - i / 11) * 0.55 * alpha;
			ctx.lineWidth = (1 - i / 11) * 7;
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(c.x, c.y);
			ctx.stroke();
		}
		ctx.restore();
	}
	const pos = posAt(moveT);
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.translate(pos.x, pos.y);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.arc(0, 0, 18, bodyAngle + Math.PI - PLAYER_ANGLE, bodyAngle + Math.PI + PLAYER_ANGLE);
	ctx.closePath();
	ctx.fillStyle = COL_PLAYER;
	ctx.fill();
	ctx.restore();
	if (held) {
		const bx = cx + Math.cos(guideAngle) * 30, by = cy + Math.sin(guideAngle) * 30;
		ctx.save();
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 3;
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(bx, by);
		ctx.lineTo(bx + Math.cos(guideAngle + 2.4) * 8, by + Math.sin(guideAngle + 2.4) * 8);
		ctx.moveTo(bx, by);
		ctx.lineTo(bx + Math.cos(guideAngle - 2.4) * 8, by + Math.sin(guideAngle - 2.4) * 8);
		ctx.stroke();
		ctx.restore();
	}
	// 指のアイコン（押している間は小さく、周りに輪）。上に HOLD / RELEASE! を重ねる
	const hx = side === "left" ? W / 2 - 60 : W / 2 + 60, hy = b.y + 110;
	fillCircle(hx, hy, held ? 18 : 21, "#ffffff", held ? 0.9 : 0.45);
	if (held) strokeCircle(hx, hy, 25, "#ffffff", 2, 0.6);
	if (held) {
		drawText(t("howHold"), hx, hy + 1, { size: 11, weight: "bold", align: "center", baseline: "middle", color: COL_BG });
	} else if (local < HOWTO_HOLD_MS + 400) {
		const k = (local - HOWTO_HOLD_MS) / 400;
		drawText(t("howRelease"), hx, hy - 4 - 10 * k, { size: 13, weight: "bold", align: "center", baseline: "middle", color: COL_GRAZE, stroke: COL_BG, strokeWidth: 3, alpha: 1 - k * 0.6 });
	}
	// パソコンでは←→キーでも同じ操作（押している側のキーが沈む）
	[["left", W / 2 - 118, "←"], ["right", W / 2 + 118, "→"]].forEach(([ks, kx, label]) => {
		const down = held && side === ks;
		const ky = hy + (down ? 2 : 0);
		fillRoundRect(kx - 13, ky - 12, 26, 24, 5, down ? COL_PLAYER : "#1c2550", down ? 0.9 : 1);
		strokeRoundRect(kx - 13, ky - 12, 26, 24, 5, COL_SUB, 1);
		drawText(label, kx, ky + 1, { size: 14, weight: "bold", align: "center", baseline: "middle", color: down ? COL_BG : "#aab4ff" });
	});
	drawText(t("how1"), W / 2, b.y + 22, { size: fitFontSize(t("how1"), b.w - 20, 13, "bold"), weight: "bold", align: "center", baseline: "middle", color: "#aee8ff" });
	drawText(t("how2"), W / 2, b.y + b.h - 12, { size: fitFontSize(t("how2"), b.w - 20, 13, "bold"), weight: "bold", align: "center", baseline: "middle", color: "#aee8ff" });
}

// 判定範囲の図：自機を拡大して、当たり（白）・ギリギリ（橙）・かすり（黄）の範囲を見せ、敵が通過する様子を実演
function drawZoneDiagram(cx, cy) {
	const S = 1.35;
	fillCircle(cx, cy, GRAZE_RADIUS * S + 6, "rgba(6,10,28,0.85)");
	ctx.save();
	ctx.translate(cx + 7 * S, cy);
	ctx.globalAlpha = 0.35;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.arc(0, 0, 20 * S, Math.PI - PLAYER_ANGLE, Math.PI + PLAYER_ANGLE);
	ctx.closePath();
	ctx.fillStyle = COL_PLAYER;
	ctx.fill();
	ctx.restore();
	fillCircle(cx, cy, GRAZE_RADIUS * S, COL_GRAZE, 0.15);
	ctx.save();
	ctx.setLineDash([4, 4]);
	strokeCircle(cx, cy, GRAZE_RADIUS * S, COL_GRAZE, 1.5, 0.8);
	strokeCircle(cx, cy, GIRI_RADIUS * S, COL_GIRI, 1.5, 0.9);
	ctx.restore();
	fillCircle(cx, cy, GIRI_RADIUS * S, COL_GIRI, 0.25);
	fillCircle(cx, cy, TIP_RADIUS * S, "#ffffff", 0.95);
	// 敵がかすり → ギリギリの順に通過する。
	// ギリギリの見本は白い点（当たり）に触れて見えないよう、当たりとギリギリの境目の中間を通し、敵も小さめに描く
	const cyc = titleAge % 3200;
	const pass = Math.floor(titleAge / 3200) % 2;
	const off = (pass ? (TIP_RADIUS + GIRI_RADIUS) / 2 + 1.5 : GRAZE_RADIUS * 0.75) * S;
	const ey = cy - 60 + (cyc / 3200) * 120;
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, GRAZE_RADIUS * S + 6, 0, Math.PI * 2);
	ctx.clip();
	drawSpikyStar(cx + off, ey, titleAge * 0.004, COL_ENEMY, 4.5);
	ctx.restore();
	// 一番近づいた瞬間に「かすり!」「ギリギリ!」を出す（ゲーム中と同じ色）
	const since = cyc - 1600; // 中心の高さを通過してからの時間
	if (since >= 0 && since < 900) {
		const k = since / 900;
		drawText(pass ? t("zoneGiri") : t("zoneGraze"), cx, cy - 20 - 12 * k, {
			size: 13, weight: "bold", align: "center", baseline: "middle",
			color: pass ? COL_GIRI : COL_GRAZE, stroke: COL_BG, strokeWidth: 3, alpha: 1 - k * k,
		});
	}
}

function drawTitleScreen() {
	ctx.save();
	ctx.globalAlpha = 0.55;
	ctx.fillStyle = COL_BG;
	ctx.fillRect(0, 0, W, H);
	ctx.restore();
	drawLogo(W / 2, 112, clamp(titleAge / 500, 0, 1));
	drawHowto();
	// ルール欄（背景のデモと重なって読みにくくならないようパネルを敷く）
	fillRoundRect(HOWTO_BOX.x, 354, HOWTO_BOX.w, 112, 12, "rgba(6,10,28,0.85)");
	strokeRoundRect(HOWTO_BOX.x, 354, HOWTO_BOX.w, 112, 12, COL_BORDER, 1);
	drawZoneDiagram(78, 410);
	[["rule1", COL_PLAYER], ["ruleGraze", COL_GRAZE], ["ruleGiri", COL_GIRI], ["ruleHit", "#ffffff"], ["rule3", ITEM_COLORS.defense]].forEach(([key, color], i) => {
		const y = 368 + i * 21;
		fillCircle(128, y, 3, color);
		drawText(t(key), 138, y, { size: fitFontSize(t(key), HOWTO_BOX.x + HOWTO_BOX.w - 146, 13), align: "left", baseline: "middle", color: "#aab4ff" });
	});
	drawText(t("tapToStart"), W / 2, 484, { size: 20, weight: "bold", align: "center", baseline: "middle", color: COL_PLAYER, alpha: 0.45 + 0.45 * Math.sin(titleAge / 260) });
	// ベストスコアと最高メダル
	fillRoundRect(W / 2 - 110, 504, 220, 36, 10, "rgba(6,10,28,0.8)");
	strokeRoundRect(W / 2 - 110, 504, 220, 36, 10, COL_BORDER, 1);
	if (bestScore > 0) {
		const tier = medalTier(bestScore);
		const mx = W / 2 - 84, my = 524, R = 10;
		ctx.save();
		ctx.translate(mx, my);
		ctx.fillStyle = COL_ENEMY;
		ctx.beginPath();
		ctx.moveTo(-R * 0.65, -R * 1.6); ctx.lineTo(-R * 0.15, -R * 1.6); ctx.lineTo(R * 0.2, -R * 0.7); ctx.lineTo(-R * 0.3, -R * 0.7);
		ctx.fill();
		ctx.fillStyle = COL_PLAYER;
		ctx.beginPath();
		ctx.moveTo(R * 0.65, -R * 1.6); ctx.lineTo(R * 0.15, -R * 1.6); ctx.lineTo(-R * 0.2, -R * 0.7); ctx.lineTo(R * 0.3, -R * 0.7);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(0, 0, R, 0, Math.PI * 2);
		ctx.fillStyle = medalColor(tier, titleAge);
		ctx.fill();
		ctx.restore();
	}
	drawText(t("bestFmt")(""), W / 2 - 64, 522, { size: 12, align: "left", baseline: "middle", color: COL_SUB });
	drawText(bestScore.toLocaleString(), W / 2 + 96, 522, { size: 22, weight: "bold", align: "right", baseline: "middle", color: "#ffffff" });
	drawLangButton();
	drawSoundButton();
	if (soundAsk) drawSoundAsk();
}

// 初回のサウンド確認ダイアログ（canvasに描く。ふりーむ規約でHTMLのUIは置けない）
function drawSoundAsk() {
	const k = clamp(soundAskAge / 200, 0, 1);
	const ca = askChoice ? askChoice.age : -1;
	const fade = ca > 260 ? 1 - clamp((ca - 260) / (ASK_EXIT - 260), 0, 1) : 1; // 選んだあとは少し見せてから消える
	ctx.save();
	ctx.globalAlpha = 0.7 * k * fade;
	ctx.fillStyle = COL_BG;
	ctx.fillRect(0, 0, W, H);
	ctx.restore();
	const b = ASK_BOX;
	const sc = 0.9 + 0.1 * easeOutBack(k);
	ctx.save();
	ctx.translate(W / 2, b.y + b.h / 2);
	ctx.scale(sc, sc);
	ctx.translate(-W / 2, -(b.y + b.h / 2));
	ctx.globalAlpha = k * fade;
	fillRoundRect(b.x, b.y, b.w, b.h, 14, "rgba(6,10,28,0.95)");
	strokeRoundRect(b.x, b.y, b.w, b.h, 14, COL_PLAYER, 2);
	drawText(t("soundAskTitle"), W / 2, b.y + 42, { size: fitFontSize(t("soundAskTitle"), b.w - 32, 20, "bold"), weight: "bold", align: "center", baseline: "middle", color: "#ffffff" });
	drawText(t("soundAskSub"), W / 2, b.y + 76, { size: fitFontSize(t("soundAskSub"), b.w - 32, 12), align: "center", baseline: "middle", color: "#aab4ff" });
	drawText(t("soundAskNote"), W / 2, b.y + 96, { size: fitFontSize(t("soundAskNote"), b.w - 32, 11), align: "center", baseline: "middle", color: COL_SUB });
	[[BTN_ASK_ON, t("soundOn"), 0], [BTN_ASK_OFF, t("soundOff"), 1]].forEach(([r, label, i]) => {
		const sel = askSel === i;
		const picked = askChoice && sel;
		const other = askChoice && !sel;
		// 押した反応：一瞬へこんでから弾む＋外へ広がる光の枠。選ばなかった方は薄くする
		let bs = 1;
		if (picked) bs = ca < 70 ? 1 - 0.07 * (ca / 70) : 0.93 + 0.07 * easeOutBack(clamp((ca - 70) / 220, 0, 1));
		const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
		ctx.save();
		ctx.globalAlpha = (other ? 0.3 : 1) * k * fade;
		ctx.translate(cx, cy);
		ctx.scale(bs, bs);
		ctx.translate(-cx, -cy);
		fillRoundRect(r.x, r.y, r.w, r.h, 10, picked ? COL_PLAYER : sel ? "rgba(55,240,255,0.14)" : "rgba(6,10,28,0.6)");
		strokeRoundRect(r.x, r.y, r.w, r.h, 10, sel ? COL_PLAYER : COL_SUB, sel ? 2.5 : 1.5);
		drawText(label, cx, cy + 1, { size: 18, weight: "bold", align: "center", baseline: "middle", color: picked ? COL_BG : sel ? COL_PLAYER : "#aab4ff" });
		ctx.restore();
		if (picked) {
			const rk = clamp(ca / 360, 0, 1), g = 14 * easeOutQuad(rk);
			strokeRoundRect(r.x - g, r.y - g, r.w + g * 2, r.h + g * 2, 10 + g, COL_PLAYER, 3 * (1 - rk) + 0.5, (1 - rk) * k * fade);
		}
	});
	ctx.restore();
}

function drawCountdown() {
	const a = countdownAge;
	const step = Math.floor(a / COUNTDOWN_STEP);
	if (step > 3) return;
	if (appScene === "countdown") {
		ctx.save();
		ctx.globalAlpha = 0.45;
		ctx.fillStyle = COL_BG;
		ctx.fillRect(0, 0, W, H);
		ctx.restore();
	}
	const k = (a % COUNTDOWN_STEP) / COUNTDOWN_STEP;
	const labels = ["3", "2", "1", "GO!"];
	const sc = 1.8 - 0.8 * easeOutBack(clamp(k * 2, 0, 1));
	const alpha = 1 - Math.max(0, k - 0.7) / 0.3;
	ctx.save();
	ctx.translate(CX, CY);
	ctx.scale(sc, sc);
	drawText(labels[step], 0, 0, {
		size: step < 3 ? 120 : 80, weight: "bold", align: "center", baseline: "middle",
		color: step < 3 ? "#ffffff" : COL_PLAYER, stroke: step < 3 ? COL_PLAYER : "#ffffff", strokeWidth: 6, alpha,
	});
	ctx.restore();
	strokeCircle(CX, CY, 40 + k * 140, COL_PLAYER, 3 * (1 - k) + 1, 1 - k);
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

const activePointers = {};
canvas.addEventListener("pointerdown", (e) => {
	e.preventDefault();
	ensureAudio();
	const { x, y } = getCanvasCoords(e);
	if (appScene === "title") {
		if (soundAsk) {
			if (hitTestBtn(BTN_ASK_ON, x, y)) chooseSound(true);
			else if (hitTestBtn(BTN_ASK_OFF, x, y)) chooseSound(false);
			return; // ダイアログの外は無視
		}
		if (hitTestBtn(BTN_LANG, x, y)) { setLang(lang === "ja" ? "en" : "ja"); sfxUiButton(); }
		else if (hitTestBtn(BTN_SOUND, x, y)) { setSound(!soundOn); sfxUiButton(); } // OFFにしたときは鳴らない
		else requestStart(e.pointerType !== "mouse"); // ボタン以外のどこをタップしても開始（スマホの初回はサウンド確認を挟む）
		return;
	}
	if (appScene === "countdown") return;
	if (resultUiVisible(game)) {
		if (hitTestBtn(BTN_LANG, x, y)) { setLang(lang === "ja" ? "en" : "ja"); sfxUiButton(); }
		else if (hitTestBtn(BTN_SOUND, x, y)) { setSound(!soundOn); sfxUiButton(); }
		else if (game.resultAge >= resultTimes(game).retryAt && hitTestBtn(BTN_RETRY, x, y)) { resetGame(); sfxRetry(); }
		else if (game.resultAge >= resultTimes(game).retryAt && hitTestBtn(BTN_TITLE, x, y)) { sfxUiButton(); goTitle(); }
		return;
	}
	pressSide(e.pointerId, x < W / 2 ? "left" : "right");
}, { passive: false });

// 左右の長押し（タッチ・マウス・←→キー共通）。押している入力をidごとに持ち、左右それぞれの押下状態を集計する
function syncHeld() {
	const sides = Object.values(activePointers);
	game.leftHeld = sides.includes("left");
	game.rightHeld = sides.includes("right");
}
function pressSide(id, side) {
	if (appScene !== "game" || game.phase !== "play") return;
	activePointers[id] = side;
	syncHeld();
	if (!game.guideVisible) {
		game.guideAngle = Math.atan2(game.vy, game.vx);
		sfxHoldStart();
	}
	game.guideVisible = true;
}
function releaseInput(id) {
	if (appScene !== "game") return;
	const side = activePointers[id];
	if (!side) return;
	delete activePointers[id];
	syncHeld();
	if (game.phase === "play" && !game.leftHeld && !game.rightHeld && game.guideVisible) {
		game.guideVisible = false;
		sfxHoldStop();
		sfxTurn();
		game.tapFlash = { side, age: 0 };
		setVelocityFromAngle(game, game.guideAngle);
	}
}
function onPointerRelease(e) {
	ensureAudio(); // 指を離した瞬間も音の準備（スマホではこちらが再生の許可として扱われる）
	releaseInput(e.pointerId);
}
canvas.addEventListener("pointerup", onPointerRelease);
canvas.addEventListener("pointercancel", onPointerRelease);
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); }, { passive: false });
canvas.addEventListener("touchend", () => ensureAudio(), { passive: true });
// 別のアプリやタブから戻ったとき、止まっていた音を起こし直す（許可が要る場合は次のタップで再開）
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible" && audioCtx && audioCtx.state !== "running") {
		try { audioCtx.resume(); } catch (e) { /* 次のタップで再開 */ }
	}
});

// パソコン用：←→キーで画面の左右タップと同じ操作。タイトルやリザルトではEnter/スペースでも進める
const KEY_SIDES = { ArrowLeft: "left", ArrowRight: "right" };
window.addEventListener("keydown", (e) => {
	const side = KEY_SIDES[e.key];
	const confirmKey = e.key === "Enter" || e.key === " ";
	if (!side && !confirmKey) return;
	e.preventDefault();
	if (e.repeat) return;
	ensureAudio();
	if (appScene === "title") {
		if (soundAsk) {
			if (askChoice) return;
			if (side) askSel = side === "left" ? 0 : 1;
			else chooseSound(askSel === 0);
			return;
		}
		requestStart(false);
		return;
	}
	if (appScene === "countdown") return;
	if (resultUiVisible(game)) {
		if (confirmKey && game.resultAge >= resultTimes(game).retryAt) { resetGame(); sfxRetry(); }
		return;
	}
	if (side) pressSide("key-" + side, side);
});
window.addEventListener("keyup", (e) => {
	const side = KEY_SIDES[e.key];
	if (side) releaseInput("key-" + side);
});
// ウィンドウからフォーカスが外れたらキーの押しっぱなしを解除する
window.addEventListener("blur", () => {
	releaseInput("key-left");
	releaseInput("key-right");
});

/* ==================== メインループ ==================== */
let lastTime = performance.now();
function frame(now) {
	const rawMs = now - lastTime;
	lastTime = now;
	const deltaMs = Math.min(rawMs, 250);
	const delta = Math.min(4, deltaMs / (1000 / 60));
	update(deltaMs, delta);
	draw();
	requestAnimationFrame(frame);
}

game = createGameState();
goTitle();
requestAnimationFrame(frame);
