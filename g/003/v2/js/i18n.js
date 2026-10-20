// 多言語辞書。lang を切り替えると t() の返す文字列が変わる。
const I18N = {
	ja: {
		pageTitle: "二分木クイズ",
		titleLogo: "二分木クイズ",
		langBtn: "English",
		introText: "少ない回数で数字を当てよう！",
		startBtn: "スタート",
		answerBtn: "回答",
		correctText: "正 解！",
		nextLabel: "Next",
		qLevelFmt: (level) => `Ｑ:${level}/5`,
		qRangeFmt: (min, max) => `値の範囲:${min}～${max}`,
		qCountFmt: (count) => `総回答数:${count}`,
		questionPrompt: "「？」の数字はなんだろう？",
		titlePages: [
			{ heading: "はじめに(1/4)", intro: "二分木は、数字を繋げたもの。", body: "小さい数字が左、\n大きい数字が右に繋がる。" },
			{ heading: "はじめに(2/4)", intro: "例題：２，４を繋げると…", body: "最初の２を中央に置く。\n次の４は２より大きいから右側。" },
			{ heading: "はじめに(3/4)", intro: "次に３を追加すると？\n３は２より大きいから右側。", body: "右には４がある。\n３は４より小さいから左側。" },
			{ heading: "はじめに(4/4)", intro: "二分木のルールはここまで！", body: "このゲームは、二分木の数字を当てるゲームです。" },
			{ heading: "ヒント！(1/4)", intro: "「？」の数字は？(１～５の数字)", body: "３より大きく、５より小さい。\nつまり、４だ。" },
			{ heading: "ヒント！(2/4)", intro: "候補が複数のときは？", body: "１と５の間は、２～４が候補。\nそれなら、間の３を選ぶと…" },
			{ heading: "ヒント！(3/4)", intro: "３が追加された！\nハズレのときは数字が繋がる。", body: "３より大きいから、答えは４だ！" },
			{ heading: "ヒント！(4/4)", intro: "真ん中の数字を選べば、正解が絞りやすい。", body: "ただ、一発正解を狙うのもあり！" },
			{ heading: "自己紹介だよ", intro: "説明はここまで。\n検討を祈るぞ。", body: "by超博士モノワカール" },
		],
		clearTitle: "クイズ結果",
		totalAnswerFmt: (n) => `総回答数: ${n} 回`,
		questionFmt: (i, n) => `Q${i}: ${n} 回`,
		evaluations: [
			"パーフェクト！", "素晴らしい！", "名推理！", "お見事！", "いい感じ！",
			"グッド！", "ナイス！", "いいね！", "ヨシ！", "",
		],
		summaries: [
			{ max: 5, text: "完全制覇！ありがとう！" },
			{ max: 8, text: "超高性能！すごすぎる！" },
			{ max: 10, text: "爆優秀賞！おめでとう！" },
			{ max: 13, text: "大明察！さえわたる！" },
			{ max: 15, text: "名探偵！おみごと！" },
			{ max: 18, text: "慧眼！みとおしてる！" },
			{ max: 21, text: "洞察力！あっぱれ！" },
			{ max: Infinity, text: "ありがとう、また遊んでね！" },
		],
		backToTitleBtn: "タイトルにもどる",
	},
	en: {
		pageTitle: "Binary Tree Quiz",
		titleLogo: "Binary Tree Quiz",
		langBtn: "日本語",
		introText: "Guess the number in fewer tries!",
		startBtn: "Start",
		answerBtn: "Answer",
		correctText: "Correct!",
		nextLabel: "Next",
		qLevelFmt: (level) => `Q: ${level}/5`,
		qRangeFmt: (min, max) => `Range: ${min}-${max}`,
		qCountFmt: (count) => `Total: ${count}`,
		questionPrompt: "What could the \"?\" number be?",
		titlePages: [
			{ heading: "Getting Started (1/4)", intro: "A binary tree links numbers.", body: "Smaller goes left,\nbigger goes right." },
			{ heading: "Getting Started (2/4)", intro: "Example: linking 2 and 4...", body: "Place 2 first.\n4 is bigger, so it goes right." },
			{ heading: "Getting Started (3/4)", intro: "Now add 3 -\nbigger than 2, so it goes right.", body: "There's a 4 on the right.\n3 is smaller, so go left." },
			{ heading: "Getting Started (4/4)", intro: "That's the basic rule!", body: "This game is about guessing\nthe hidden number in the tree." },
			{ heading: "Hint! (1/4)", intro: "What's the \"?\" number? (1 to 5)", body: "Bigger than 3, smaller than 5.\nThat means it's 4!" },
			{ heading: "Hint! (2/4)", intro: "Multiple candidates?\nBetween 1 and 5: 2, 3, or 4.", body: "Try picking the middle one, 3..." },
			{ heading: "Hint! (3/4)", intro: "3 got added!\nA miss just joins the tree.", body: "Bigger than 3, so the answer is 4!" },
			{ heading: "Hint! (4/4)", intro: "Picking the middle number\nnarrows it down fast.", body: "But a one-shot guess is cool too!" },
			{ heading: "About the Author", intro: "That's the tutorial.\nGood luck out there.", body: "by Dr. Know-It-All" },
		],
		clearTitle: "Quiz Results",
		totalAnswerFmt: (n) => `Total Guesses: ${n}`,
		questionFmt: (i, n) => `Q${i}: ${n}`,
		evaluations: [
			"Perfect!", "Brilliant!", "Great Guess!", "Well Done!", "Nice Job!",
			"Good!", "Nice!", "Not Bad!", "OK!", "",
		],
		summaries: [
			{ max: 5, text: "Total mastery! Thank you!" },
			{ max: 8, text: "Super sharp! Amazing!" },
			{ max: 10, text: "Excellent work, congrats!" },
			{ max: 13, text: "Brilliant deduction!" },
			{ max: 15, text: "Detective-level insight!" },
			{ max: 18, text: "Sharp eyes, well seen!" },
			{ max: 21, text: "Great insight, impressive!" },
			{ max: Infinity, text: "Thanks for playing, come again!" },
		],
		backToTitleBtn: "Back to Title",
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
