/* ---- 日英の文言 ----
   main.js の tr(key) で引く。よく使う見出しなどは applyLang() が TH にも写す（TH.title など）。
   文言を足すときは ja / en の両方に同じキーで入れる。英語は日本語より長くなりがちなので、画面で収まりを必ず確認する。 */
var I18N = {
  ja: {
    pageTitle: '手さぐり爆弾解除',
    /* 見出し・ルール */
    title: '手さぐり爆弾解除', subtitle: '', tool: '探針', pinName: 'スイッチ',
    tagline: '点検口から探針を差し込み、中の形状で爆弾の型番を見抜こう！\n対応する解除スイッチを押せば解除成功。',
    rule: 'ダミーは-3秒。ペナルティは徐々に厳しくなる。',
    link: '解除するたび連動回路が切れ、タイマーが延びる。',
    opLine: function () { return 'パッドをなぞって探針を動かす。触れた壁が光る。'; }, quadLine: 'パッドの四隅をタップで、候補の形を重ねて表示。',
    /* タイトルのボタン */
    main: '本編', defuseX: function (n) { return n + 'を解除'; }, best: function (v) { return 'ベスト ' + v; }, bonus: 'おまけ',
    normal: '10個の爆弾', normalSub: 'すべて解除してクリア', endless: '連続爆弾解除（エンドレス）', endlessSub: '指を離した時だけ形が見える',
    practice: '▶ 練習する', artDone: '解除',
    /* 上の操作盤 */
    count: '解除', countLong: '解除した爆弾', unitN: '個', timerLabel: '連動起爆まで', streak: 'ノーミス×',
    /* プレイ中 */
    win: '解除', winClean: 'ノーミス解除', fake: 'ダミー', overBig: '時間切れ', clearBig: '10個 すべて解除！',
    cut: function (b) { return b ? '回路切断 +' + b + '秒' : '回路切断（延長なし）'; }, sec: '秒',
    allStop: '全回路 停止', allClear: '全10個 解除完了',
    noSignal: '信号なし', rebuilt: '記録から再現', rebuiltView: '再現映像',
    dark: '奥は見えない。触れた所だけ光る', answer: '正解', practiceOK: '正解！',
    hint0: '奥の形で型番を見分けて、そのスイッチを押す',
    pressing: function (l) { return l + 'のスイッチを押している。離せばやめられる'; }, aiming: function (l) { return l + 'のスイッチに照準。そのまま押し込むと確定'; }, pressingShort: function (l) { return l + 'のスイッチを押している'; },
    quadHint: '四隅をタップすると、その候補の形を重ねる', hardHint: function (l) { return '指を離すと、なぞった所に' + l + 'の形が重なる'; },
    solved: '解除！ほかの形も重ねられる', reviewing: '答えを確認中',
    shallow: '← 浅く', deep: '深く →', up: '↑ 先を上へ', anywhere: 'どこでもなぞる',
    /* 結果 */
    stats: function (c, m, st) { return 'ノーミス ' + c + '　ダミー ' + m + '回　最長' + st + '連続'; }, newBest: '　記録更新！',
    perfectHead: 'ノーミス完全解除！', perfectPraise: '一度もダミーに触れず、見事な手際！',
    time: function (t) { return 'タイム  ' + t + '秒'; }, bestOf: function (m, v) { return m + 'のベスト ' + v; }, secs: function (t) { return t + '秒'; },
    unlocked: function (n) { return '「' + n + '」が解放された'; },
    reveal: '緑の線が本当の形、「正解」が解除スイッチ',
    review: '答えを確認', back: '結果に戻る', toTitle: 'タイトルへ', again: 'もう一度',
    /* 練習 */
    practiceLabel: '練習', skip: 'スキップ ›',
    tut0: 'パッドをなぞって、奥の壁を探ろう', tut0b: '触れた壁が光って、形が見えてくる',
    tut1: '左右をタップして、形を重ねてみよう', tut1b: '点線の形が光った壁と合えば、それが本物', tut1c: 'AとBを切り替えて、合う方を探そう',
    tut2: '決めたら、そのスイッチを押し込もう', tut2b: 'スイッチに探針を当て、ゲージがたまるまで押す',
    tutWrong: 'それはダミー！ 本番なら-3秒', tutWrongB: 'もう一方のスイッチを押してみよう', tutWrongFloat: 'ダミー！',
    tutEndHead: '解除成功！', tutEnd1: '本番は30秒で、10個の爆弾を解除しよう。', tutEnd2: '解除するたびタイマーが延びる。ダミーは減点。', tutGo: '本番スタート'
  },
  en: {
    pageTitle: 'Probomb: Feel, Find, Defuse',
    title: 'Probomb', subtitle: 'Feel, Find, Defuse', tool: 'probe', pinName: 'switch',
    tagline: 'Slide the probe into the hatch and read the shape inside to find the bomb model!\nPress the matching switch to defuse it.',
    rule: 'A dummy costs 3 s, and the penalty grows.',
    link: 'Each defuse cuts a linked circuit: +time.',
    opLine: function () { return 'Drag the pad to move the probe. Walls glow.'; }, quadLine: 'Tap a pad corner to overlay a shape.',
    main: 'MAIN', defuseX: function (n) { return 'Defuse ' + n; }, best: function (v) { return 'Best ' + v; }, bonus: 'BONUS',
    normal: '10 Bombs', normalSub: 'Defuse them all to clear', endless: 'Bomb Rush (Endless)', endlessSub: 'Shapes show only while lifted',
    practice: '▶ Practice', artDone: 'DEFUSED',
    count: 'DEFUSED', countLong: 'Bombs defused', unitN: '', timerLabel: 'DETONATION IN', streak: 'Clean ×',
    win: 'DEFUSED', winClean: 'CLEAN DEFUSE', fake: 'Dummy', overBig: "TIME'S UP", clearBig: 'All 10 defused!',
    cut: function (b) { return b ? 'Circuit cut +' + b + 's' : 'Circuit cut (no time)'; }, sec: 's',
    allStop: 'ALL CIRCUITS OFF', allClear: 'ALL 10 DEFUSED',
    noSignal: 'NO SIGNAL', rebuilt: 'REBUILT FROM LOG', rebuiltView: 'REBUILT VIEW',
    dark: 'Only the walls you touch light up', answer: 'Answer', practiceOK: 'Correct!',
    hint0: 'Find the model, then press its switch',
    pressing: function (l) { return 'Pressing ' + l + '. Release to stop'; }, aiming: function (l) { return 'Aimed at ' + l + '. Push in to confirm'; }, pressingShort: function (l) { return 'Pressing ' + l; },
    quadHint: 'Tap a pad corner to overlay that shape', hardHint: function (l) { return 'Lift your finger to see ' + l + ' on your traces'; },
    solved: 'Defused! Overlay others too', reviewing: 'Checking the answer',
    shallow: '← shallow', deep: 'deep →', up: '↑ tip up', anywhere: 'Drag anywhere',
    stats: function (c, m, st) { return 'Clean ' + c + '   Dummies ' + m + '   Best streak ' + st; }, newBest: '   New record!',
    perfectHead: 'Flawless defuse!', perfectPraise: 'Not a single dummy touched. Superb work!',
    time: function (t) { return 'Time  ' + t + 's'; }, bestOf: function (m, v) { return 'Best  ' + v; }, secs: function (t) { return t + 's'; },
    unlocked: function (n) { return 'Unlocked: ' + n; },
    reveal: 'Green: real shape. "Answer": correct switch',
    review: 'Check answer', back: 'Results', toTitle: 'Title', again: 'Retry',
    practiceLabel: 'PRACTICE', skip: 'Skip ›',
    tut0: 'Drag on the pad to probe the walls inside', tut0b: 'Walls you touch light up and show the shape',
    tut1: 'Tap the left or right half to overlay a shape', tut1b: 'If the dotted shape fits the glowing walls, that is it', tut1c: 'Switch between A and B to find the match',
    tut2: 'Decided? Push the switch with that letter', tut2b: 'Hold the probe on it until the gauge fills',
    tutWrong: 'That was a dummy! -3 s in a real round', tutWrongB: 'Try the other switch', tutWrongFloat: 'Dummy!',
    tutEndHead: 'Defused!', tutEnd1: 'Now for real: defuse 10 bombs in 30 seconds!', tutEnd2: 'Each defuse adds time. Dummies cost time.', tutGo: 'Start for real'
  }
};
