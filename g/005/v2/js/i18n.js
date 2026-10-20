// 多言語辞書。lang を切り替えると t() の返す文字列が変わる。
// ゲームの核は「荻(OGI)」「萩(HAGI)」の表記ゆれ（漢字/ひらがな/カタカナ/ローマ字）を見分けて
// 振り分けるパズルなので、単語自体（redFruits/yellowFruits）は言語に関わらず変更しない。
// UI文言・チュートリアル・称号（駄洒落）だけを言語ごとに差し替える。
const I18N = {
	ja: {
		pageTitle: "荻や萩-OgiYaHagi-",
		langBtn: "English",
		demoLabel: "DEMO",
		tapLabel: "TAP",
		startLabel: "START",
		scoreFmt: (n) => `スコア: ${n}`,
		timeFmt: (n) => `時間: ${n}s`,
		comboFmt: (n) => `COMBO x${n}`,
		bonusLabel: "BONUS!!",
		colorfulLabel: "Colorful!",
		ohButtonTop: "OGI",
		ohButtonBottom: "HAGI",
		ohButtonCenter: "YA",
		legendOgi: "OGIで消える言葉:",
		legendHagi: "HAGIで消える言葉:",
		tutorial: [
			{ head: "＜遊び方(1/7)＞", l1: "「おぎ」と読む言葉が来たら、", l2: "「OGI」ボタンを押そう！", l3: "" },
			{ head: "＜遊び方(2/7)＞", l1: "「はぎ」と読む言葉が来たら、", l2: "「HAGI」ボタンを押そう！", l3: "" },
			{ head: "＜遊び方(3/7)＞", l1: "「おぎ」「はぎ」と来たら、", l2: "「OGIYAHAGI」ボタン！", l3: "  まとめて消せて高得点だ！" },
			{ head: "＜遊び方(4/7)＞", l1: "「はぎ」「おぎ」と来たら、", l2: "「OGIYAHAGI」は使えない。", l3: "  順番に気を付けて！" },
			{ head: "＜遊び方(5/7)＞", l1: "  言葉の色は時間で変わる。", l2: " 「OGIYAHAGI」に成功すると", l3: "  一時的に色が付くぞ！ " },
			{ head: "＜遊び方(6/7)＞", l1: "  10コンボでも色が付く！", l2: "  高得点のチャンスだ！", l3: " " },
			{ head: "＜遊び方(7/7)＞", l1: "  上で消すほど高得点！", l2: "  点数は点線の位置で決まるよ", l3: "" },
			{ head: "＜遊び方＞", l1: "  説明はおわり。", l2: "  タップして始めよう！", l3: "  " },
		],
		timingLabels: [
			{ text: "PERFECT!", color: "#ffff66" },
			{ text: "GREAT!", color: "#ffcc00" },
			{ text: "NICE!", color: "#99ccff" },
			{ text: "SAFE", color: "#00ff99" },
		],
		startQuestion: "ゲームを始めますか？",
		startBtn: "START",
		cancelBtn: "CANCEL",
		resultTitle: "RESULT",
		resultLabelTitle: "称号",
		scoreRFmt: (n) => `SCORE: ${n}`,
		nextFmt: (n) => `NEXT:+${n}`,
		perfectClear: "PERFECT CLEAR!",
		retryBtn: "RETRY",
		titles1: [
			{ max: 500, name: "新星", stars: 1 },
			{ max: 1500, name: "超上昇", stars: 2 },
			{ max: 3000, name: "免許皆伝", stars: 3 },
			{ max: 5000, name: "極地到達者", stars: 4 },
			{ max: Infinity, name: "天上天下荻や萩", stars: 5 },
		],
		rankA: ["荻と萩と私", "荻や萩が友", "荻と萩の間", "荻や萩の力", "荻も萩も私"],
		rankB: [
			{ title: "小さなのうた", insertIndex: 3 },
			{ title: "高嶺の子さん", insertIndex: 3 },
			{ title: "に駆ける", insertIndex: 0 },
			{ title: "になろうよ", insertIndex: 0 },
			{ title: "を愛する人", insertIndex: 0 },
		],
	},
	en: {
		pageTitle: "OGI or HAGI",
		langBtn: "日本語",
		demoLabel: "DEMO",
		tapLabel: "TAP",
		startLabel: "START",
		scoreFmt: (n) => `Score: ${n}`,
		timeFmt: (n) => `Time: ${n}s`,
		comboFmt: (n) => `COMBO x${n}`,
		bonusLabel: "BONUS!!",
		colorfulLabel: "Colorful!",
		ohButtonTop: "OGI",
		ohButtonBottom: "HAGI",
		ohButtonCenter: "YA",
		legendOgi: "OGI clears:",
		legendHagi: "HAGI clears:",
		tutorial: [
			{ head: "How To Play (1/7)", l1: "When a word that reads \"OGI\" falls,", l2: "tap the OGI button!", l3: "" },
			{ head: "How To Play (2/7)", l1: "When a word that reads \"HAGI\" falls,", l2: "tap the HAGI button!", l3: "" },
			{ head: "How To Play (3/7)", l1: "When OGI and HAGI both appear,", l2: "tap the OGIYAHAGI button!", l3: "  Clear both for a big bonus!" },
			{ head: "How To Play (4/7)", l1: "If HAGI comes before OGI,", l2: "OGIYAHAGI won't work.", l3: "  Watch the order!" },
			{ head: "How To Play (5/7)", l1: "  Word colors fade over time.", l2: "  Landing an OGIYAHAGI", l3: "  refills the color a while!" },
			{ head: "How To Play (6/7)", l1: "  A 10-combo refills it too!", l2: "  A great scoring chance!", l3: " " },
			{ head: "How To Play (7/7)", l1: "  Clear it higher for more points!", l2: "  Score depends on the dotted lines", l3: "" },
			{ head: "How To Play", l1: "  That's the tutorial.", l2: "  Tap to start!", l3: "  " },
		],
		timingLabels: [
			{ text: "PERFECT!", color: "#ffff66" },
			{ text: "GREAT!", color: "#ffcc00" },
			{ text: "NICE!", color: "#99ccff" },
			{ text: "SAFE", color: "#00ff99" },
		],
		startQuestion: "Start the game?",
		startBtn: "START",
		cancelBtn: "CANCEL",
		resultTitle: "RESULT",
		resultLabelTitle: "Title",
		scoreRFmt: (n) => `SCORE: ${n}`,
		nextFmt: (n) => `NEXT:+${n}`,
		perfectClear: "PERFECT CLEAR!",
		retryBtn: "RETRY",
		// 「見た目が似た漢字を見分ける」というゲームの本質をテーマにした称号。
		titles1: [
			{ max: 500, name: "Fresh Eyes", stars: 1 },
			{ max: 1500, name: "Quick Glance", stars: 2 },
			{ max: 3000, name: "Trained Eye", stars: 3 },
			{ max: 5000, name: "Eagle Eye", stars: 4 },
			{ max: Infinity, name: "Perfect Vision", stars: 5 },
		],
		// OGI≈"OG"（俗語で「本物・伝説」の意）、HAGI≈"high"の音をかけた駄洒落称号。
		// redCorrect === yellowCorrect（OGI/HAGIを均等に消した）場合は両方のかけ言葉を組み合わせ、
		// スコア帯が上がるごとに褒め度を上げる。
		rankA: ["Fresh OG, Flying High", "OG Energy, Riding High", "Certified OG, Soaring High", "True OG, Sky-High Status", "The Original OG, Way Up High"],
		// 片方を多く消した場合の称号。winner（OGI/HAGI）に応じて"OG"/"high"のかけ言葉を出し分ける。
		rankB: [
			{ titleFmt: (w) => (w === "OGI" ? "An OG in the Making" : "Aiming High") },
			{ titleFmt: (w) => (w === "OGI" ? "OG Vibes Only" : "Riding High") },
			{ titleFmt: (w) => (w === "OGI" ? "Certified OG" : "Flying High") },
			{ titleFmt: (w) => (w === "OGI" ? "True OG Status" : "Living the High Life") },
			{ titleFmt: (w) => (w === "OGI" ? "The Original OG" : "Sky-High Legend") },
		],
	},
};

let lang = (navigator.language || "ja").toLowerCase().startsWith("ja") ? "ja" : "en";

function t(key) {
	return I18N[lang][key];
}

function setLang(l) {
	lang = l;
	document.title = t("pageTitle");
	document.dispatchEvent(new CustomEvent("langchange"));
}
