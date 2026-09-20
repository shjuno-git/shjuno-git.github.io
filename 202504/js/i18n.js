// 多言語辞書。lang を切り替えると t() の返す文字列が変わる。
const I18N = {
	ja: {
		pageTitle: "足して５！～または同じ数字で消すパズル～",
		langBtn: "English",
		logoMain: "足して５！",
		logoSub: "～または同じ数字で消すパズル～",
		scoreFmt: (n) => `スコア:${n}`,
		ruleTitle: "　全ての数字を消そう！",
		rule1: "　・１つ目の数字をタップ",
		rule2: "　・縦か横の２つ目の数字までスワイプ",
		rule3: "　・手を離すと数字が合体（最大値：５）",
		rule4: "　・足して５、同じ数字だと消えるよ",
		undoBtn: "一つ戻る",
		resetBtn: "最初に戻る",
		renewBtn: "問題変更",
		dialogMessage: "この問題をスキップし、\n新しい問題に変更します。\nよろしいですか？",
		yesBtn: "はい",
		noBtn: "いいえ",
		clearMessage: "お見事！",
		resultPlusFmt: (n) => `・足して５で消した数：${n}`,
		resultSameFmt: (n) => `・同じ数字で消した数：${n}`,
		resultMergeFmt: (n) => `・数字を合体させた数：${n}`,
		thanksFirst: "ここまで遊んでくれてありがとう！\n良ければぜひまた遊んでね。",
		thanksRepeatFmt: (level) => `　　クリアした回数：${level}\n　　　自分の限界に挑戦だ！`,
		nextBtn: "新しい問題へ！",
	},
	en: {
		pageTitle: "Five and Alike! - Match & Merge Puzzle",
		langBtn: "日本語",
		logoMain: "Five and Alike!",
		logoSub: "Match & Merge Puzzle",
		scoreFmt: (n) => `Score: ${n}`,
		ruleTitle: "Clear all the numbers!",
		rule1: "Tap the first number",
		rule2: "Swipe to the next number",
		rule3: "Release to merge (max: 5)",
		rule4: "Sum to 5, or match, to clear!",
		undoBtn: "Undo",
		resetBtn: "Restart",
		renewBtn: "New Puzzle",
		dialogMessage: "Skip this puzzle and\nstart a new one?\nAre you sure?",
		yesBtn: "Yes",
		noBtn: "No",
		clearMessage: "Well Done!",
		resultPlusFmt: (n) => `Cleared by summing to 5: ${n}`,
		resultSameFmt: (n) => `Cleared by matching: ${n}`,
		resultMergeFmt: (n) => `Numbers merged: ${n}`,
		thanksFirst: "Thanks for playing!\nCome back and play again sometime.",
		thanksRepeatFmt: (level) => `Puzzles cleared: ${level}\nKeep challenging yourself!`,
		nextBtn: "New Puzzle!",
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
