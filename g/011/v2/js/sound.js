"use strict";

/* ==================== サウンド ====================
 * すべてWeb Audioで合成した効果音（音源ファイル・外部通信なし）。
 * ブラウザの仕様で、最初のタップ（ユーザー操作）まで音は鳴らない。
 * BGMはなし。代わりにときどき、気にならない小さな環境音が鳴る。 */
const Sound = (() => {
	let ac = null, master, seG, ambG, enabled = false;
	const vol = { master: 0.6, se: 0.8, amb: 0.5 };
	let ambTimer = null;

	function ensure() {
		if (ac) { if (ac.state === "suspended") ac.resume(); return true; }
		const A = window.AudioContext || window.webkitAudioContext;
		if (!A) return false;
		ac = new A();
		master = ac.createGain(); seG = ac.createGain(); ambG = ac.createGain();
		seG.connect(master); ambG.connect(master); master.connect(ac.destination);
		apply();
		return true;
	}
	function apply() {
		if (!ac) return;
		master.gain.value = enabled ? vol.master : 0;
		seG.gain.value = vol.se; ambG.gain.value = vol.amb;
	}
	const now = () => ac.currentTime;
	function osc(type, f0, f1, t0, dur, g0, out) {
		const o = ac.createOscillator(), g = ac.createGain();
		o.type = type; o.frequency.setValueAtTime(f0, t0);
		if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(g0, t0 + 0.008);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		o.connect(g); g.connect(out || seG); o.start(t0); o.stop(t0 + dur + 0.02);
	}
	function noise(t0, dur, g0, f0, f1, out) {
		const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
		for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
		const s = ac.createBufferSource(); s.buffer = b;
		const f = ac.createBiquadFilter(); f.type = "lowpass";
		f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
		const g = ac.createGain(); g.gain.setValueAtTime(g0, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		s.connect(f); f.connect(g); g.connect(out || seG); s.start(t0); s.stop(t0 + dur + 0.02);
	}
	const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
	const hz = (semi, base) => (base || 392) * Math.pow(2, semi / 12);

	const SE = {
		ui: () => { const t = now(); osc("triangle", 700, 900, t, 0.08, 0.25); },
		tap: () => { const t = now(); osc("sine", 520, 780, t, 0.07, 0.35); },
		// 連鎖：段が進むほど音程が上がる
		chain: (lv) => {
			const t = now(), f = hz(PENTA[Math.min((lv || 1) - 1, PENTA.length - 1)]);
			osc("triangle", f, f, t, 0.2, 0.4); osc("sine", f * 2, f * 2, t, 0.12, 0.14); noise(t, 0.05, 0.08, 4000, 800);
		},
		bonus: () => { const t = now(); [0, 4, 7, 12].forEach((s, i) => osc("triangle", hz(s, 660), hz(s, 660), t + i * 0.06, 0.22, 0.3)); },
		charge: () => { const t = now(); osc("sawtooth", 180, 900, t, 0.28, 0.18); },
		bomb: () => { const t = now(); noise(t, 0.55, 0.55, 3200, 120); osc("sine", 140, 40, t, 0.5, 0.8); osc("square", 90, 40, t, 0.25, 0.25); },
		beam: () => { const t = now(); osc("sawtooth", 2200, 260, t, 0.42, 0.22); noise(t, 0.38, 0.22, 6000, 500); osc("sine", 880, 880, t, 0.3, 0.15); },
		merge: () => { const t = now(); osc("sawtooth", 200, 1200, t, 0.3, 0.2); [0, 7, 12, 16].forEach((s) => osc("triangle", hz(s, 523), hz(s, 523), t + 0.28, 0.6, 0.26)); },
		stock: () => { const t = now(); osc("triangle", 440, 440, t, 0.09, 0.26); osc("triangle", 660, 660, t + 0.07, 0.14, 0.26); },
		appear: () => { const t = now(); osc("triangle", hz(0, 660), hz(0, 660), t, 0.14, 0.26); osc("triangle", hz(7, 660), hz(7, 660), t + 0.09, 0.2, 0.26); },
		// ☠出現：「ポロン↓」と下がる2音（鼓動とは別の音色で、軽すぎず目立つ）
		enemy: () => { const t = now(); osc("triangle", 330, 330, t, 0.12, 0.3); osc("triangle", 247, 247, t + 0.1, 0.16, 0.3); osc("sine", 123, 90, t + 0.1, 0.14, 0.3); },
		// ピンチの鼓動（低い「ドクン」）
		danger: () => { const t = now(); osc("sine", 115, 82, t, 0.12, 0.38); osc("sine", 115, 82, t + 0.17, 0.1, 0.24); },
		// ドクロ3つ：鼓動につながる低い音を3回、最後に重いうなり
		alert: () => {
			const t = now();
			[0, 0.55].forEach((d) => { osc("sine", 105, 68, t + d, 0.15, 0.6); osc("sine", 105, 68, t + d + 0.17, 0.12, 0.38); });
			osc("sine", 80, 50, t + 1.15, 0.4, 0.7);
		},
		// ゲームオーバー：ソ→ファ→ミ（ミを伸ばす）→ド。サイン波中心のやわらかい音色で、残念感は薄め
		over: () => {
			const t = now();
			[[784, 0, 0.2], [698.46, 0.14, 0.2], [659.26, 0.28, 0.5], [523.25, 0.62, 0.9]].forEach(([f, st, d]) => {
				osc("sine", f, f, t + st, d, 0.3); osc("triangle", f, f, t + st, d * 0.8, 0.09); osc("sine", f * 2, f * 2, t + st, d * 0.5, 0.05);
			});
		},
		clear: () => {
			const t = now();
			[[0, 0], [4, 0.14], [7, 0.28], [12, 0.42]].forEach(([s, d]) => osc("square", hz(s, 523), hz(s, 523), t + d, 0.22, 0.2));
			[0, 4, 7, 12, 16].forEach((s) => osc("triangle", hz(s, 523), hz(s, 523), t + 0.7, 1.1, 0.22));
		},
		record: () => { const t = now(); for (let i = 0; i < 8; i++) osc("triangle", hz(PENTA[i % 8] + 12, 523), hz(PENTA[i % 8] + 12, 523), t + i * 0.06, 0.25, 0.24); },
		newbest: () => { const t = now(); [0, 7, 12].forEach((s, i) => osc("sine", hz(s, 784), hz(s, 784), t + i * 0.08, 0.3, 0.3)); },
	};

	// 環境音：小さくて短い、気にならない音（きらめき・鈴・やわらかい空気感）
	const AMBIENT = [
		() => { const t = now(), f = hz(PENTA[Math.floor(Math.random() * 6) + 6], 392); osc("sine", f, f, t, 0.9, 0.05, ambG); osc("sine", f * 1.5, f * 1.5, t + 0.12, 0.7, 0.03, ambG); },
		() => { const t = now(); osc("sine", hz(4, 523), hz(4, 523), t, 1.1, 0.045, ambG); osc("sine", hz(11, 523), hz(11, 523), t + 0.25, 1.3, 0.035, ambG); },
		() => { const t = now(), f = hz([-5, -3, 0][Math.floor(Math.random() * 3)], 196); osc("triangle", f, f * 1.05, t, 1.8, 0.05, ambG); },
	];
	function scheduleAmbient() {
		if (ambTimer) clearTimeout(ambTimer);
		ambTimer = setTimeout(() => {
			if (enabled && ac) AMBIENT[Math.floor(Math.random() * AMBIENT.length)]();
			scheduleAmbient();
		}, 8000 + Math.random() * 12000); // 8〜20秒おき
	}

	return {
		get enabled() { return enabled; },
		setEnabled(v) {
			enabled = !!v; apply();
			if (enabled) scheduleAmbient(); else if (ambTimer) { clearTimeout(ambTimer); ambTimer = null; }
		},
		unlock() { return ensure(); },
		play(id, arg) {
			if (!enabled || !SE[id] || !ensure()) return;
			try { SE[id](arg); } catch (e) { /* 音が出せなくてもゲームは止めない */ }
		},
	};
})();
