// 多言語辞書。lang を切り替えると t() の返す文字列が変わる。
const I18N = {
	ja: {
		pageTitle: "タッチ★よけロケ！",
		langBtn: "English",
		logoTop: "タッチ",
		logoBottom: "よけロケ！",
		stageFmt: (n) => `STAGE:${n}/5`,
		controlLabel: "画面タッチで方向転換\n障害物をよけてゴールを目指そう！",
		clearLabel: "CLEAR!!",
		clearLogoTitle: "TOUCH★\nDODGE ROCKET",
		clearTimeFmt: (timeStr) => `CLEAR TIME: ${timeStr}`,
		retryBtn: "RETRY",
	},
	en: {
		pageTitle: "Touch★Dodge Rocket!",
		langBtn: "日本語",
		logoTop: "TOUCH",
		logoBottom: "DODGE ROCKET",
		stageFmt: (n) => `STAGE:${n}/5`,
		controlLabel: "Tap the screen to turn!\nDodge the obstacles and reach the goal!",
		clearLabel: "CLEAR!!",
		clearLogoTitle: "TOUCH★\nDODGE ROCKET",
		clearTimeFmt: (timeStr) => `CLEAR TIME: ${timeStr}`,
		retryBtn: "RETRY",
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
