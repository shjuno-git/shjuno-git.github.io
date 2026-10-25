/* ---- language ---- */
const I18N = {
  ja: {
    pageTitle: 'つなげてアヒルメーカー',
    title: 'つなげてアヒルメーカー', order: 'お題', score: 'はなまる', album: '図鑑', achTitle: '★ たっせい ★',
    cvAria: 'つなげてアヒルメーカーのゲーム画面',
    mix: 'くみあわせ', mixD: 'ちがう2匹をつなぐと、\n新しいコが生まれる', stamp: 'はなまる', stampD: 'お題のアヒルを\n作ってわたそう',
    limitH: '50匹でいっぱい！ そのときは…', outing: 'おでかけ', outingD: 'おなじ2匹をつなぐ', outingD2: 'おみやげが もらえるかも', nap: 'おやすみ', napD: 'おうちへなぞる',
    red: '赤', blue: '青', yellow: '黄', legendT: '色と記号の対応：', cPurple: '紫', cOrange: '橙', cGreen: '緑', cBrown: '茶', patS: '縞', patD: '水玉', patB: '縞水玉',
    secret: 'ひみつのアヒル', close: 'とじる', closeX: '✕ とじる', tapStart: 'タップしてスタート', sndOn: 'おとあり', sndOff: 'おとなし', water: '水位',
    restartAll: 'はじめから（記録も全部消す）', restartAsk: 'もう一度押すと全部消えて最初から',
    wipe: '記録を消す', wipeAsk: 'もう一度押すと消えます', wiped: '消しました',
    tagFull: 'いっぱい！', tagPacked: 'ぎゅうぎゅう', tagLively: 'にぎやか', tagCalm: 'ゆったり',
    rules: ['ちがう2匹をなぞってつなぐと「くみあわせ」', 'おなじ2匹をなぞってつなぐと「おでかけ」', 'おうちへなぞってつなぐと「おやすみ」'],
    fullBanner: '湯船がいっぱい！\nおうちにつないで おやすみしよう', fullAlert: '湯船がいっぱい！\nおうちにつないで おやすみしよう',
    deliver: { 3: 'はなまる 3こ！\nたっせい！', 6: 'はなまる 6こ！\nいい感じ', 10: 'はなまる 10こ！\nブリーダーめざめ', 15: 'はなまる 15こ！\nアヒルはかせ', 25: 'はなまる 25こ！\nおふろの たつじん' },
    zukanMs: { 10: 'ずかん 10しゅ\nたっせい！', 20: 'ずかん 20しゅ！\nすごい', 31: 'ずかん\nコンプリート！！' },
    someone: 'だれか来た！', rareFirst: n => 'ひみつのアヒル はっけん！\n' + n, rareN: (n, c) => n + '\n' + c + '匹め ゲット！', outTxt: 'いってきまーす♪', hanamaru: 'はなまる！', napTxt: 'おやすみ〜', newTxt: 'NEW！ ',
    lucky: n => 'ラッキー！ ' + n + '（図鑑に登録）', thanks: n => n + ' ありがとう', unknown: 'まだ見つけていない',
    home: 'おうち', bNap: 'おやすみ', bOuting: 'おでかけ', bFull: 'いっぱい！',
    col: ['白', '赤', '青', '紫', '黄', '橙', '緑', '茶'], pat: ['', '縞', '水玉', '縞水玉'], patHead: ['無地', '縞', '水玉', '縞水玉'],
    rare: { gold: 'ゴールデン', rainbow: 'にじいろ', night: 'よぞら' },
    menu: 'メニュー', tabLog: 'きろく', tabStyle: 'おしゃれ', scrollCue: '▼ したにも あるよ',
    logTotal: 'いままで うまれた', logUnit: 'ひき', secColor: 'いろ べつ', secPat: 'もよう べつ', secMedal: 'じっせき', noBorn: 'まだ うまれていないよ',
    tHana: 'はなまる', tOut: 'おでかけ', tNap: 'おやすみ', tTimes: 'かい', tPcs: 'こ',
    cat: { hana: 'はなまる', zukan: 'ずかん', out: 'おでかけ', nap: 'おやすみ', born: 'うまれた' }, unit: { hana: 'こ', zukan: 'しゅ', out: 'かい', nap: 'かい', born: 'ひき' },
    medalSecret: { gold: 'ゴールデン', rainbow: 'にじいろ', night: 'よぞら', all: 'ひみつ', every: 'ぜんぶ' },
    everyTitle: '★ ぜんぶ ★', everyMsg: '全ての実績を\n達成した！！', everyDone: 'ぜんぶ たっせい！', everySub: 'すべての じっせきを そろえたよ', complete: '★ COMPLETE',
    medalMsg: m => m.secret ? (m.secret === 'all' ? 'ひみつのアヒル\nぜんぶ そろった！' : 'ひみつの じっせき\nかいじょ！') : I18N.ja.cat[m.cat] + ' ' + m.n + I18N.ja.unit[m.cat] + '！\nじっせき ゲット',
    guide1: '入浴剤で お湯の色を、\nかざりで 姿を変えられるよ！',
    secSalt: 'にゅうよくざい', secHat: 'かざり', hatClear: 'ぜんぶ外す', saltReset: '元に戻す', using: 'つかってる', newTag: 'NEW', wearTag: 'きてる', zukanBtn: 'ふやしかた ▼', backBtn: 'ふやしかた ▲', emptyS1: 'まだ にゅうよくざいが ないよ', emptyS2: 'はなまるや きろくで ふえるよ', giftNote1: 'おでかけすると おみやげで もらえるかも！', giftDone: 'おみやげの かざりは ぜんぶ そろったよ！', tutPair: 'この2わで うまれるよ！', tutTip1: 'おでかけすると', tutTip2: 'くじが ひけるよ！', tutDone: 'じゅんび OK！ たくさん つなげよう', chainBubble: n => n + '匹 おやすみ', chainDone: n => n + '匹 おやすみ〜', chainTip: 'とちゅうのコも まとめて\nおやすみ できるよ', chainRule: 'おうちへ なぞると おやすみ\nとちゅうのコも いっしょだよ', giftNote2: 'おまけは とくべつな じっせきで もらえるよ', restGift: n => 'のこり ' + n + 'こ ・ おでかけの おみやげで みつかるよ', emptyT1: 'まだ かざりが ないよ', emptyT2: 'おでかけすると おみやげで もらえるかも！', pvName: n => n + 'の おふろ',
    unlMsg: n => '「' + n + '」ゲット！\nおしゃれで つかえるよ', gotShort: n => '「' + n + '」ゲット！', giftAllTitle: '★ おみやげ コンプリート ★', giftAllMsg: 'かざりを\nぜんぶ あつめた！！', giftProg: (a, b) => 'おみやげで あつめた かざり  ' + a + ' / ' + b, statueN: n => n + 'かいめ！',
    saltN: { plain: 'ふつうのお湯', sakura: 'さくら', mint: 'ミント', yuzu: 'レモン', lav: 'ラベンダー', soda: 'ソーダ', milk: 'ミルク', ichigo: 'いちご', night: 'よぞら', gold: 'きん', rainbow: 'にじ', cocoa: 'ココア', umi: 'うみ', momiji: 'もみじ', ocha: 'おちゃ', yuki: 'ゆき' },
    hatN: { none: 'なし', ribbon: 'リボン', cap: 'ぼうし', glass: 'めがね', crown: 'かんむり', flower: 'おはな', star: 'ほしバッジ' },
    quack: ['ガー！', 'クワッ', 'ぴょん♪', 'ガーガー'],
    cheer: ['♪', 'わーい', 'やったー'],
    compC: ['赤', '青', '黄'], compP: ['縞', '水玉'], recipe: 'くみあわせ', fromFaucet: 'じゃぐちから やってくる', bornN: n => 'うまれた かず  ' + n + ' ひき', caughtN: n => 'みつけた かず  ' + n, tapClose: 'タップで とじる', remain: (n, u) => 'あと ' + n + u,
    hintMore: 'なにか ふえそう…？', hintAll: 'ぜんぶ そろったよ！',
    hintAct: (cat, left) => cat === 'born' ? 'あと' + left + 'ひき うまれたら' : I18N.ja.cat[cat] + 'を あと' + left + I18N.ja.unit[cat]
  },
  en: {
    pageTitle: 'Duck Maker',
    title: 'Duck Maker', order: 'Order', score: 'Stamps', album: 'Album', achTitle: '★ Achievement ★',
    cvAria: 'Duck Maker game screen',
    mix: 'Mix', mixD: 'Connect two different ducks\nto hatch a new one', stamp: 'Stamp', stampD: 'Make the ordered duck\nand hand it in',
    limitH: 'Tub full at 50! Then…', outing: 'Outing', outingD: 'Connect two identical ducks', outingD2: 'You may get a souvenir!', nap: 'Nap', napD: 'Drag a duck to the house',
    red: 'Red', blue: 'Blue', yellow: 'Yellow', legendT: 'Colour key:', cPurple: 'Purple', cOrange: 'Orange', cGreen: 'Green', cBrown: 'Brown', patS: 'Stripes', patD: 'Dots', patB: 'Mottled',
    secret: 'Secret Ducks', close: 'Close', closeX: '✕ Close', tapStart: 'Tap to start', sndOn: 'Sound on', sndOff: 'Sound off', water: 'Water',
    restartAll: 'Start over (erase all progress)', restartAsk: 'Tap again to erase everything',
    wipe: 'Erase records', wipeAsk: 'Tap again to erase', wiped: 'Erased',
    tagFull: 'Full!', tagPacked: 'Packed', tagLively: 'Lively', tagCalm: 'Calm',
    rules: ['Drag between two different ducks to Mix', 'Drag between two identical ducks for an Outing', 'Drag a duck to the house for a Nap'],
    fullBanner: 'The tub is full!\nDrag a duck to the house for a nap', fullAlert: 'The tub is full!\nDrag a duck to the house for a nap',
    deliver: { 3: '3 stamps!\nNice start', 6: '6 stamps!\nNice going', 10: '10 stamps!\nBreeder awakens', 15: '15 stamps!\nDuck professor', 25: '25 stamps!\nBath master' },
    zukanMs: { 10: 'Album:\n10 found!', 20: 'Album: 20 found!\nWow', 31: 'Album\ncomplete!!' },
    someone: 'Someone showed up!', rareFirst: n => 'Secret duck found!\n' + n, rareN: (n, c) => n + '\ncaught ×' + c + '!', outTxt: 'Off we go♪', hanamaru: 'Well done!', napTxt: 'Nighty-night~', newTxt: 'NEW! ',
    lucky: n => 'Lucky! ' + n + ' (added to Album)', thanks: n => 'Thanks, ' + n + '!', unknown: 'Not found yet',
    home: 'Home', bNap: 'Nap', bOuting: 'Outing', bFull: 'Full!',
    col: ['White', 'Red', 'Blue', 'Purple', 'Yellow', 'Orange', 'Green', 'Brown'], pat: ['', 'Striped', 'Dotted', 'Mottled'], patHead: ['Plain', 'Stripes', 'Dots', 'Both'],
    rare: { gold: 'Golden', rainbow: 'Rainbow', night: 'Starry' },
    menu: 'Menu', tabLog: 'Records', tabStyle: 'Style', scrollCue: '▼ more below',
    logTotal: 'Ducks hatched so far', logUnit: '', secColor: 'By colour', secPat: 'By pattern', secMedal: 'Medals', noBorn: 'None hatched yet',
    tHana: 'Stamps', tOut: 'Outings', tNap: 'Naps', tTimes: '', tPcs: '',
    cat: { hana: 'Stamps', zukan: 'Album', out: 'Outings', nap: 'Naps', born: 'Hatched' }, unit: { hana: '', zukan: '', out: '', nap: '', born: '' },
    medalSecret: { gold: 'Golden', rainbow: 'Rainbow', night: 'Starry', all: 'Secrets', every: 'All' },
    everyTitle: '★ ALL DONE ★', everyMsg: 'Every medal\nearned!!', everyDone: 'All done!', everySub: 'Every medal collected', complete: '★ COMPLETE',
    medalMsg: m => m.secret ? (m.secret === 'all' ? 'Secret ducks\nall found!' : 'Secret medal\nunlocked!') : I18N.en.cat[m.cat] + ' ' + m.n + '!\nMedal earned',
    guide1: 'Bath salts change the water colour,\ndress-ups change how ducks look!',
    secSalt: 'Bath salts', secHat: 'Dress-up', hatClear: 'Remove all', saltReset: 'Reset', using: 'In use', newTag: 'NEW', wearTag: 'On', zukanBtn: 'How to get more ▼', backBtn: 'How to get more ▲', emptyS1: 'No bath salts yet', emptyS2: 'Unlock more with stamps and records', giftNote1: 'You may get a souvenir on an outing!', giftDone: 'Every souvenir dress-up collected!', tutPair: 'These two make it!', tutTip1: 'Go on an outing', tutTip2: 'to spin the lottery!', tutDone: "You're all set! Connect lots of ducks!", chainBubble: n => n + ' ducks nap', chainDone: n => n + ' ducks, nighty-night~', chainTip: 'Ducks you pass on the way\nnap together too!', chainRule: 'Drag to the house for a nap\nducks on the way come too', giftNote2: 'Extras unlock through special goals', restGift: n => n + ' left · found in outing souvenirs', emptyT1: 'No dress-ups yet', emptyT2: 'You may get a souvenir on an outing!', pvName: n => n + ' bath',
    unlMsg: n => '"' + n + '" unlocked!\nUse it in Style', gotShort: n => 'Got "' + n + '"!', giftAllTitle: '★ Souvenirs complete ★', giftAllMsg: 'Every dress-up\ncollected!!', giftProg: (a, b) => 'Dress-ups from souvenirs  ' + a + ' / ' + b, statueN: n => 'Outing #' + n + '!',
    saltN: { plain: 'Plain', sakura: 'Sakura', mint: 'Mint', yuzu: 'Lemon', lav: 'Lavender', soda: 'Soda', milk: 'Milk', ichigo: 'Strawberry', night: 'Night sky', gold: 'Golden bath', rainbow: 'Rainbow', cocoa: 'Cocoa', umi: 'Sea', momiji: 'Maple', ocha: 'Green tea', yuki: 'Snow' },
    hatN: { none: 'None', ribbon: 'Ribbon', cap: 'Hat', glass: 'Glasses', crown: 'Crown', flower: 'Flower', star: 'Star pin' },
    quack: ['Quack!', 'Boing!', 'Hop!', 'Quack quack'],
    cheer: ['♪', 'Yay!', 'Hooray!'],
    compC: ['Red', 'Blue', 'Yellow'], compP: ['Stripes', 'Dots'], recipe: 'Recipe', fromFaucet: 'Comes from the faucet', bornN: n => 'Hatched: ' + n, caughtN: n => 'Caught: ' + n, tapClose: 'Tap to close', remain: n => n + ' to go',
    hintMore: 'Something is coming…?', hintAll: 'You have them all!',
    hintAct: (cat, left) => I18N.en.cat[cat] + ': ' + left + ' more'
  }
};
/* ---- dress-up table, shared by the list page and the in-game picker: id, name, genre, isNew ---- */
/* parts as the picker shows them (おまけ = the things that sit on top of the head, always last) */
const DRESS_SLOTS = [['head', 'あたま'], ['eyes', 'め'], ['mouth', 'くちもと'], ['body', 'からだ'], ['top', 'おまけ']];
const DRESS_ITEMS = [
  ['bcap', 'キャップ', 'cool', 0], ['towel', 'タオル', 'bath', 1], ['shampoo', 'シャンプーハット', 'bath', 1], ['shower', 'シャワーキャップ', 'bath', 1],
  ['awa', 'あわあわ', 'bath', 1], ['chibi', 'ちびアヒル', 'bath', 1], ['straw', 'むぎわらぼうし', 'cute', 1], ['bunny', 'うさみみ', 'cute', 1],
  ['knit', 'ニットぼう', 'cute', 1], ['silk', 'シルクハット', 'cool', 1], ['phones', 'ヘッドホン', 'cool', 1], ['muff', 'みみあて', 'cute', 1], ['mage', 'ちょんまげ', 'fun', 1],
  ['crown', 'かんむり', 'cool', 0], ['halo', 'てんしのわ', 'cute', 1], ['tiara', 'ティアラ', 'gal', 1], ['hearttop', 'うかぶハート', 'gal', 1], ['onpu', 'おんぷ', 'cute', 1],
  ['ribbon', 'リボン', 'cute', 0], ['bigribbon', 'おおきなリボン', 'gal', 1], ['starpin', 'キラキラピン', 'gal', 1], ['hibis', 'ハイビスカス', 'cute', 1],
  ['glass', 'めがね', 'cool', 0], ['sun', 'サングラス', 'cool', 1], ['goggle', 'ゴーグル', 'bath', 1], ['lash', 'うわまつげ', 'gal', 1],
  ['colorcon', 'カラコン', 'gal', 1], ['heartsun', 'ハートサングラス', 'gal', 1], ['mono', 'かためがね', 'fun', 1], ['patch', 'がんたい', 'cool', 1], ['patchw', 'しろいがんたい', 'fun', 1],
  ['hige', 'おひげ', 'fun', 1], ['santa', 'サンタひげ', 'fun', 1], ['mask', 'マスク', 'fun', 1], ['pipe', 'パイプ', 'cool', 1], ['bubble', 'しゃぼんだま', 'bath', 1], ['lip', 'リップ', 'gal', 1],
  ['pacif', 'おしゃぶり', 'cute', 1], ['chheart', 'ハートシール', 'gal', 1], ['chstar', 'キラキラシール', 'gal', 1], ['band', 'ばんそうこう', 'fun', 1],
  ['bowtie', 'ちょうネクタイ', 'cool', 1], ['necktie', 'ネクタイ', 'cool', 1], ['scarf', 'スカーフ', 'cool', 1], ['pearl', 'しんじゅネックレス', 'gal', 1],
  ['choker', 'チョーカー', 'gal', 1], ['bib', 'よだれかけ', 'cute', 1], ['bell', 'すずのくびわ', 'cute', 1], ['lei', 'レイ', 'cute', 1],
  ['star', 'ほしバッジ', 'cool', 0], ['hbadge', 'ハートバッジ', 'gal', 1], ['hanabadge', 'はなまるバッジ', 'cute', 1], ['medal', 'きんメダル', 'cool', 1], ['brooch', 'ブローチ', 'gal', 1],
  ['nafuda', 'なふだ', 'cute', 1], ['zekken', 'ゼッケン', 'fun', 1], ['wappen', 'ひよこワッペン', 'cute', 1], ['apron', 'エプロン', 'cute', 1],
  ['flower', 'おはな', 'cute', 0], ['wings', 'てんしのはね', 'cute', 1], ['cape', 'マント', 'cool', 1], ['pack', 'リュック', 'fun', 1], ['bat', 'こうもりのはね', 'cool', 1],
  ['koura', 'こうら', 'fun', 1], ['butterfly', 'ちょうのはね', 'gal', 1], ['randoseru', 'ランドセル', 'cute', 1], ['rocket', 'ロケット', 'cool', 1],
  ['float', 'うきわ', 'bath', 1], ['donut', 'ドーナツうきわ', 'bath', 1], ['wtowel', 'こしタオル', 'bath', 1], ['hula', 'こしみの', 'fun', 1], ['tutu', 'チュチュ', 'cute', 1],
  ['skirt', 'スカート', 'gal', 1], ['belt', 'ベルト', 'cool', 1], ['tailribbon', 'しっぽリボン', 'cute', 1], ['pochette', 'ポシェット', 'gal', 1]
];
/* the picked ones, per part and in display order. Everything in DRESS_ITEMS that is not listed here is kept as a reserve
   (still drawable, just not offered): to bring one back, add its id to the part where it should appear. */
const DRESS_ADOPT = {
  head: ['bcap', 'towel', 'shower', 'awa', 'straw', 'knit', 'silk', 'phones', 'hibis'],
  eyes: ['glass', 'sun', 'goggle', 'lash', 'colorcon', 'heartsun', 'mono', 'patch', 'patchw'],
  mouth: ['santa', 'mask', 'lip', 'necktie', 'scarf', 'lei', 'hanabadge', 'medal', 'nafuda'],
  body: ['flower', 'wings', 'pack', 'koura', 'rocket', 'float', 'hula', 'wtowel', 'tutu'],
  top: ['crown', 'halo', 'hearttop', 'chibi', 'bunny', 'mage']
};
const DRESS_ADOPT_ALL = [].concat(...DRESS_SLOTS.map(sl => DRESS_ADOPT[sl[0]]));
const DRESS_ON = DRESS_ITEMS.filter(d => DRESS_ADOPT_ALL.includes(d[0]));
const DRESS_RESERVE = DRESS_ITEMS.filter(d => !DRESS_ADOPT_ALL.includes(d[0]));
/* how each picked item is obtained:
   - nothing is owned at the start (DRESS_STARTER can list free ones),
   - おまけ items come from achievements (the original conditions: stamps / album / hatched / naps / the golden duck),
   - everything else arrives as an おみやげ box after an outing (random pick among the ones not owned yet) */
const DRESS_STARTER = [];   /* nothing is owned at the start */
const DRESS_NEED = { bunny: ['hana', 8], hearttop: ['zukan', 14], chibi: ['born', 75], halo: ['nap', 25], mage: ['zukan', 31], crown: { secret: 'gold' } };
const DRESS_GIFT = DRESS_ADOPT_ALL.filter(id => !DRESS_NEED[id] && !DRESS_STARTER.includes(id));
/* English names of the dress-ups (the Japanese ones are in DRESS_ITEMS) */
const DRESS_EN = {
  bcap: 'Cap', towel: 'Towel', shampoo: 'Shampoo hat', shower: 'Shower cap', awa: 'Bubbles', chibi: 'Tiny duck', straw: 'Straw hat', bunny: 'Bunny ears',
  knit: 'Beanie', silk: 'Top hat', phones: 'Headphones', muff: 'Earmuffs', mage: 'Topknot', crown: 'Crown', halo: 'Halo', tiara: 'Tiara', hearttop: 'Floating heart',
  onpu: 'Music notes', ribbon: 'Ribbon', bigribbon: 'Big bow', starpin: 'Star pins', hibis: 'Hibiscus', glass: 'Glasses', sun: 'Sunglasses', goggle: 'Goggles',
  lash: 'Lashes', colorcon: 'Sparkle eyes', heartsun: 'Heart shades', mono: 'Monocle', patch: 'Eye patch', patchw: 'White eye patch', hige: 'Moustache',
  santa: 'Santa beard', mask: 'Mask', pipe: 'Pipe', bubble: 'Bubble pipe', lip: 'Lip gloss', pacif: 'Pacifier', chheart: 'Heart sticker', chstar: 'Star stickers',
  band: 'Plaster', bowtie: 'Bow tie', necktie: 'Necktie', scarf: 'Scarf', pearl: 'Pearls', choker: 'Choker', bib: 'Bib', bell: 'Bell collar', lei: 'Lei',
  star: 'Star pin', hbadge: 'Heart badge', hanabadge: 'Stamp badge', medal: 'Gold medal', brooch: 'Brooch', nafuda: 'Name tag', zekken: 'Race bib',
  wappen: 'Chick patch', apron: 'Apron', flower: 'Flower', wings: 'Angel wings', cape: 'Cape', pack: 'Backpack', bat: 'Bat wings', koura: 'Shell',
  butterfly: 'Butterfly wings', randoseru: 'School bag', rocket: 'Rocket', float: 'Swim ring', donut: 'Donut ring', wtowel: 'Waist towel', hula: 'Grass skirt',
  tutu: 'Tutu', skirt: 'Skirt', belt: 'Belt', tailribbon: 'Tail bow', pochette: 'Pochette'
};
let lang = 'ja';
try { const sv = localStorage.getItem('duckLab.lang'); lang = sv === 'en' || sv === 'ja' ? sv : ((navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en'); } catch (_) {}
function t(key) { return I18N[lang][key]; }
function setLang(l) {
  lang = l;
  try { localStorage.setItem('duckLab.lang', l); } catch (_) {}
  document.title = t('pageTitle');
  document.documentElement.lang = l;
  document.dispatchEvent(new CustomEvent('langchange'));
}
