// 多言語辞書。lang を切り替えると t() の返す文字列が変わる。
const I18N = {
	ja: {
		pageTitle: "いい加減さんすう",
		langBtn: "English",
		logoText: "いい加減さんすう",
		stageFmt: (n) => `Stage:${n}/5`,
		baseMsg: "数字マスを踏んで計算し、赤いゴールと同じ数字で入ろう！",
		stageHints: [
			"マスの数字を足し算しよう。答えは1の位だけを使うよ",
			"青いマスは通るたびに数字が変わるよ",
			"下のボタンで＋－を切り替えて計算しよう",
			"＊は掛け算(×)の意味だよ。計算結果はいつも1桁になるよ",
			"最後のステージ！割り算の余りは切り捨てるよ",
		],
		undoBtn: "Undo",
		stageClearBanner: "CLEAR!",
		finalTitle: "🎉 全ステージクリア 🎉",
		stageResultFmt: (n, formula) => `Stage${n}: ${formula}`,
		totalTimeFmt: (sec) => `合計タイム: ${sec} 秒`,
		retryBtn: "🔁 リトライ",
	},
	en: {
		pageTitle: "Plus or Minus",
		langBtn: "日本語",
		logoText: "Plus or Minus",
		stageFmt: (n) => `Stage:${n}/5`,
		baseMsg: "Step on number tiles to calculate, then reach the red GOAL with a matching number!",
		stageHints: [
			"Add up the tile numbers — only the last digit counts!",
			"Blue tiles reroll their number every time you pass!",
			"Use the buttons below to switch between + and −!",
			"* means multiply (×). Results always stay a single digit!",
			"Final stage! Division results are rounded down!",
		],
		undoBtn: "Undo",
		stageClearBanner: "CLEAR!",
		finalTitle: "🎉 All Stages Clear! 🎉",
		stageResultFmt: (n, formula) => `Stage${n}: ${formula}`,
		totalTimeFmt: (sec) => `Total Time: ${sec}s`,
		retryBtn: "🔁 Retry",
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
