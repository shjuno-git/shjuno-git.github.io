// 多言語辞書。lang を切り替えると t() の返す文字列が変わる。
const I18N = {
	ja: {
		pageTitle: "フーフーコショー",
		titleLogo: "フーフーコショー",
		langBtn: "English",
		introText: "～あらすじ～\n大魔王フリカケールが世界中に\nコショウを振りかけてしまった！\n\n美化委員フーくんと一緒に、\nコショウを吹き飛ばそう！",
		bossIntroLabel: "大魔王フリカケールさま",
		heroIntroLabel: "美化委員フーくん",
		ruleTextA: "Ａ．４つのエリアをお掃除して\n　　大魔王を懲らしめよう！",
		startBtn: "お掃除開始！",
		ruleTextB: "Ｂ．大魔王が反省しないから無限に遊べる！",
		endlessBtn: "無限お掃除",
		totalLabel: "TOTAL:",
		restLabel: "REST:",
		cleanSuccessText: "お掃除大成功！",
		bossVictoryText: "お見事大勝利！",
		rollReadyHint: "回転ボタンが使えるよ\n広範囲をテキパキお掃除だ！",
		rollActiveHint: "ぐるぐる回転トリックだー！！",
		rollButtonLabel: "回転",
		tipHints: [
			"そろそろ大魔王に会える予感\nコショウが苦手なんだとか",
			"上下にスワイプして操作しよう\n触れたコショウをお掃除するよ",
			"モフモフに触れると弾かれちゃう\n触れるたび微妙に位置が変わるよ",
			"モフモフやコショウに触れると\n回転ゲージが増えやすいよ",
			"回転中にブロックと触れると\n多めにコショウをお掃除するよ",
			"大魔王の今日のお昼ご飯は\n小鯛のオートミールリゾットだ",
		],
		bossHeading: "vs大魔王ﾌﾘｶｹｰﾙ",
		clearTitle: "表彰状",
		clearReason: "貴殿は大魔王フリカケールを\n見事に懲らしめました。",
		totalScoreFmt: (n) => `総掃除数：${n}`,
		backToTitleBtn: "タイトルにもどる",
		dateFmt: (y, m, d) => `${y}年${m}月${d}日`,
	},
	en: {
		pageTitle: "Huff Puff Pepper!",
		titleLogo: "Huff Puff Pepper!",
		langBtn: "日本語",
		introText: "~The Story~\nKing Peppercorn has sprinkled\npepper all over the world!\n\nJoin Huffy the Cleaner and\nblow all that pepper away!",
		bossIntroLabel: "Demon King Peppercorn",
		heroIntroLabel: "Cleaner Huffy",
		ruleTextA: "A. Clean up all 4 areas\n　　and teach the King a lesson!",
		startBtn: "Start Cleaning!",
		ruleTextB: "B. Play forever—he never learns!",
		endlessBtn: "Endless Cleaning",
		totalLabel: "TOTAL:",
		restLabel: "REST:",
		cleanSuccessText: "Cleanup Success!",
		bossVictoryText: "Magnificent Victory!",
		rollReadyHint: "Spin Button ready!\nClean a wide area fast!",
		rollActiveHint: "Spinning trick, go go go!!",
		rollButtonLabel: "Spin",
		tipHints: [
			"The Demon King is near...\nHe hates pepper too!",
			"Swipe up/down to fly around.\nHuffy clears pepper on contact!",
			"Wobblies bounce you back!\nThey shift a bit each bump.",
			"Flying into pepper or Wobblies\nfills the Spin Gauge faster!",
			"Fly into obstacles while spinning\nfor a bonus cleanup!",
			"The Demon King's lunch today:\nsea bream oatmeal risotto.",
		],
		bossHeading: "VS King Peppercorn",
		clearTitle: "Certificate",
		clearReason: "This certifies that you have\ndefeated King Peppercorn.",
		totalScoreFmt: (n) => `Total Cleaned: ${n}`,
		backToTitleBtn: "Back to Title",
		dateFmt: (y, m, d) => `${m}/${d}/${y}`,
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
