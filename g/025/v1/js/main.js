(function () {
'use strict';

/* 試作: 本体の i18n.js はさわらず、試作で変える文言だけここで上書きする */
Object.assign(I18N.ja, {
  pageTitle: 'かける！ぷるんスライム橋', titleKicker: 'かける！ぷるん',
  congrats: '5人は ぶじに もくてきちに たどりついたよ！',
  stageNames: ['段差', 'のぼり崖', 'イガの くだり'],
  stageTags: ['雲は 1回だけ！', '風に 乗って 登ろう', 'つるに つかまれ！'],
  prepTip: 'まる・ジグザグ・まっすぐで 動きが 変わる',
  countdownFmt: (s) => `人が 来るまで あと ${s}秒`,
  willCross: '渡れるかな…', prep: '準備',
  allCrossed: '全員 渡った！', almost: 'あと 少し！', allFell: '全員 落ちた…',
  drawHere: ['ここに', '一筆で 描いてね'], drawArea: '描くエリア',
  resultLineFmt: (need, made) => `使った スライム ${made}個`,
  needFmt: (n) => `クリア ${n}人以上`,
  titleCaps: ['かいた せんが スライムになって おちてくる', 'おちてくる スライムは ゆびで うごかせる', 'つみあがって はしに なった！', '5人は それぞれ 動きが ちがうよ', '5人が わたるよ！ 2人以上で クリア']
});
Object.assign(I18N.en, {
  pageTitle: 'Wobbly Slime Bridge', titleKicker: 'Wobbly!',
  congrats: 'Hooray! All 5 walkers made it to their destination!',
  stageNames: ['Step', 'Climb', 'Chestnut Drop'],
  stageTags: ['Each cloud works once!', 'Ride the wind up the cliff', 'Grab the vine!'],
  prepTip: 'Each shape moves differently',
  resultLineFmt: (need, made) => `Slimes used: ${made}`,
  needFmt: (n) => `Clear ${n}+`
});
document.title = I18N[lang].pageTitle;

/* ============================================================
   CONFIG: 調整したい数値はここだけ触ればよい
   ============================================================ */
const CONFIG = (function () {
  const c = {
    W: 360, H: 640,              // 論理解像度(縦長)
    valleyRatio: 0.6,            // 谷幅 / 画面幅
    cliffTop: 372,               // 崖の上面のy
    floorY: 596,                 // 谷底のy

    prepTime: 30,                // 人が来るまでの準備時間(秒)
    people: 5,                   // 人数
    spawnInterval: 1.1,            // 出発間隔(秒)
    firstDelay: 0.8,             // 歩行フェーズ開始から最初の出発まで(秒)
    walkSpeed: 60,               // 歩行速度(px/秒)
    startX: 16,                  // 出発位置x
    personGravity: 900,          // 落下・ジャンプの重力

    areaSize: 176,               // 手描きエリアの一辺(px)
    maxInk: 620,                 // 一筆で描ける長さの上限(px)
    minStroke: 40,               // これより短い線はスライムにならない
    slimeThick: 14,              // スライムの太さ(px)
    fallSpeed: 110,              // 降り始めの速さ(px/秒)
    fallAccel: 70,               // だんだん速くなる度合い(px/秒²)
    fallMax: 250,                // 最高の速さ(px/秒)
    gripRadius: 32,              // スライムをつかめる範囲(px)
    pointSpacing: 5,             // 形を作る点の間隔(px)
    shrink: 1.0,                 // 描いた形をこの割合に縮めてから降らせる(1.0で縮小なし)
    thickScale: 0.85,            // 縮めたあとの太さの倍率
    cliffSticky: false,          // true にすると崖にもくっつく(手描き版と同じ)
    stepH: 48,                   // ステージ1の底の段差の高さ(px)。0で平ら
    stepX: 156,                  // 段差の位置(x)。これより左が高い
    s2Rise: 64,                  // ステージ2: 右の崖が左より高い分(px)
    s2Slope: 56,                 // ステージ2: 底が右へ上がっていく高さ(px)
    pillarW: 30,                 // ステージ4: 柱の幅
    pillarDrop: 190,              // ステージ4: 柱の頂上が崖の上面より何px低いか
    springOver: 45,               // ステージ4: バネの頂点が右の崖の上面より何px高いか(全員同じ高さまで跳ぶ。重なったスライムの高さは関係なし)
    springVx: 190,               // ステージ4: バネで前へ飛ぶ速さ(px/秒)
    climbSpeed: 40,              // クライマーが崖の壁をよじ登る速さ(px/秒)
    waterLedgeL: 110, waterLedgeR: 90, waterX0: 124, waterX1: 236, waterTop: 500,   // ステージ3: 岸の高さ(崖の上面から下へ)・水の溝のx範囲・水面のy
    spikes: [[105, 576, 13], [238, 510, 13]],   // ステージ3: イガグリの位置 [x, y, 半径]
    windX: 180,                  // 下からの風: 中心x(谷は72〜288。入口側=110、まんなか=180、ゴール側=250)
    windW: 60,                   // 下からの風: 幅
    windLift: 1.6,               // 下からの風: 上向きの強さ(重力の何倍か)
    windRise: 140,               // 下からの風: 上がっていく速さの上限(px/秒)
    windDrift: 130,              // 下からの風: 前へ流す強さ(px/秒²)
    windDriftMax: 80,            // 下からの風: 前へ流される速さの上限(px/秒)
    cliffSlide: 34,              // 崖の上に落ちたとき、谷へ滑っていく速さ(px/秒)

    phys: true,                  // 着地後に転がる・ずれる・回転する(false にすると v4 と同じ「ぺたっ」)
    physGravity: 900,            // 着地後の重力(px/秒²)
    physRestitution: 0.32,       // はね返り(0〜1)。大きいほど「ぷるん」と跳ねる
    physFloorFriction: 0.7,      // 谷底との摩擦
    physSlimeFriction: 0.55,     // スライム同士の摩擦。小さいほどずるっと滑る
    physDamp: 2.5,               // 速度の減衰(1/秒)。小さいほどいつまでも転がる
    physSpinDamp: 2.5,           // 回転の減衰(1/秒)。小さいほど円が転がり続ける
    physKickSlide: 26,           // 着地の瞬間のランダムな横ずれ(px/秒)
    physKickSpin: 1.4,           // 着地の瞬間のランダムな回転(rad/秒)
    physSettleMax: 3.5,          // これ以上は待たずに固定する(秒)
    physNudge: 0.5,              // 止まりかけたときに一度だけ与える揺さぶり(rad/秒)。倒れそうなものを倒す。0で無効
    physSleepSpeed: 12,          // この速さ未満が続いたら止まったと見なす(px/秒)
    physSleepTime: 0.3,          // 止まったと見なすまでの時間(秒)
    physCliffPush: 420,          // 崖の上に乗ったとき谷へ押し戻す強さ(px/秒²)
    physSlop: 0.3,               // 許すめり込み(px)

    eraserRadius: 14,            // 針の先の当たり判定の半径(px)。小さいほど同時に当たりにくい
    eraserGrip: 50,              // 消しゴムをつかめる範囲(px)
    eraserMax: 4,                // 同時に降らせられる消しゴムの数(回数の制限はない)
    eraserFallSpeed: 130,        // 消しゴムの降り始めの速さ(px/秒)
    eraserFallAccel: 260,        // 消しゴムがだんだん速くなる度合い(px/秒²)
    eraserFallMax: 270,          // 消しゴムの最高の速さ(px/秒)
    collapseSpeed: 200,          // 支えを失ったスライムの崩れ落ちる速さ(px/秒)
    collapseAccel: 700,
    collapseMax: 620,

    jumpUp: 34,                  // 歩行者が飛び越えられる段差(px)。人ごとに±15%ばらつく
    jumpReach: 28,               // ジャンプで先読みする距離(px)
    jumpDown: 26,                // ジャンプで降りられる段差(px)
    hopTries: 3,                 // 進めないとき、その場でジャンプして乗り越えようとする回数
    nearReach: 30,               // 前にスライムがこの距離以内にあれば「進めない」と見なしてその場で跳ねる(px)
    stepUp: 4, stepDown: 8,      // ジャンプなしで追える段差(px/フレーム)
    maxSlope: 1.8,               // これより急な面は歩けない(壁扱い)

    blobClose: 26,               // 試作: 描きおわりが描きはじめからこの距離以内なら、とじて「かたまり」にする(px)
    blobClimb: 30,               // 試作: 空中でかたまりの横に当たったとき、上の面がこの高さ以内なら乗る(px)
    blobSlope: 3.2,              // 試作: かたまりの上は、この傾きまで歩ける(ふつうの線は maxSlope)
    blobMinLen: 1e9,             // 跳ばし試作: かたまりは使わない(とじても ふつうの線のまま)。もどすなら 110
    purunH: 54,                  // 試作: ぷるんで飛ぶ高さの基準(px)。ふつうの長さの線×ふつうの人
    purunBlob: 1.5,              // 試作: かたまりは何倍強く跳ねるか
    purunSizeMin: 0.6, purunSizeMax: 1.5, purunSizeLen: 440,   // 試作: 線の長さ0〜purunSizeLenで、強さがMin〜Max倍
    purunCool: 1.5,              // 試作: ぷるんしたスライムがもう一度使えるまで(秒)
    purunFwd: 0.08,               // 試作: ぷるんで前(右)へ進む勢い。上向きの速さに対する割合
    rescueRope: 320,             // 試作: レスキューのひもが届く距離(px)
    rescueToss: 58,              // 試作(旧): 手元から ほうり投げる高さ。いまは使わない
    rescueLift: 40,              // 試作: 落ちた人を、高いほうの崖の上面より何px上まで真上に引き上げるか
    rescueLiftT: 1.0,            // 試作: 引き上げる秒数
    purunReach: 20,              // 試作: タップがスライムからこの距離以内なら当たり(px)
    hopLedgeX1: 124, hopLedgeTop: 390,   // 跳ばし試作: 左の岩だな(左の崖から x=hopLedgeX1 まで・上面のy)
    hopRockX0: 174, hopRockX1: 214, hopRockTop: 340,   // 跳ばし試作: まんなかの岩の柱
    hopRightRise: 20,            // 跳ばし試作: 右の崖が左より高い分(px)
    hopGrab: 14,                 // 跳ばし試作: 岩・右の崖の角に、上面からこの深さまでなら つかまって乗れる(px)
    hopNeed: 3,                  // 跳ばし試作: クリアに必要な人数
    stackH: 42,                  // 積み試作: 1だん(谷底や崖に じかに乗っている)スライムの ぷるんの高さ(px)。ふつうの人
    stackPer: 0.35,              // 積み試作: 下に1だん ふえるごとに、ぷるんが この割合ずつ強くなる
    stackMax: 2.4,               // 積み試作: ぷるんの強さの上限(1だんの何倍か)
    purunSide: 0.5,              // 積み試作: 右下がりの面で前へ ながれる割合(前は 0.8)
    birdEvery: 2.4,              // 鳥: だいたい何秒おきに飛んでくるか
    birdMax: 3,                  // 鳥: 同時に飛んでいる数の上限
    birdSpeed: 70,               // 鳥: 飛ぶ速さ(px/秒)
    birdYMin: 220, birdYMax: 300,   // 鳥: 飛ぶ高さの範囲(y)。崖の上面は372
    birdCarry: 1.5,              // 鳥: つかまったとき運ばれる時間(秒)×人の軽さ(ショート1.5倍・トール0.6倍)
    cloudSpeed: 60,              // ステージ1: 人を乗せた くもが右へ進む速さ(px/秒)
    cloudCarry: 110,             // ステージ1: くもが運ぶ距離(px)×人の軽さ(ショート1.5・ふつう1・トール0.6)。運びきると ぽふっと消える
    climbRise: 100,              // ステージ2「のぼり がけ」: 右の崖が左より高い分(px)
    climbBranches: [[1, 486, 70], [1, 392, 44]],   // ステージ2: 右の壁の枝 [壁, 根もとのy, 長さ]
    gustX: 258, gustW: 46,       // ステージ2: ふきあげる かぜの ふきだし口の中心x・はば
    gustQuiet: 0.7, gustWarn: 0.4, gustBlow: 1.4,   // ステージ2: かぜの周期(秒)。しずか → 予告(砂ぼこり) → ふく
    gustTopOff: 0,               // ステージ2: 風の柱の上はし(右の崖の上面より何px下か。負なら上)
    gustLift: 1.6, gustRise: 180, gustPow: 2, gustDrift: 120, gustDriftMax: 60,   // ステージ2: 上向きの強さ(重力の倍)・上がる速さ・軽さの効き(軽さ^gustPow)・前へ流す強さ・上限
    isleX0: 236, isleX1: 300, isleRise: 30,   // ステージ3「イガの こじま」: 小島の上面のx範囲・左の崖より何px高いか
    isleGoalX: 252,              // ステージ3: ゴールの旗のx(小島の上)
    isleSpike: [165, 372, 13],   // ステージ3: 動かないイガグリ [x, y, 半径]
    skySpike: { y: 300, x0: 110, x1: 230, per: 8, r: 13 },   // ステージ3: 空を往復するイガグリ(往復の秒数 per)
    dropFall: 120,               // ステージ3「イガの くだり」: 右の崖が左より低い分(px)
    fence: [[264, 424], [264, 462], [264, 500], [264, 538], [264, 576]],   // ステージ3: イガの かきね [x, y]。右の崖(x288)の手前
    fenceR: 13,                  // ステージ3: かきねの イガの半径
    vine: [230, 150, 170],       // ステージ3: つるの支点x・y・長さ(静止時の持ち手は y320。x205 だと トールが左の崖から とびついて勝手に渡れた)
    vineAng: 0.62, vineT: 0.9,   // ステージ3: つかまってから 振りきるまでの角度(rad)と秒数(いつも おなじ)
    vineGrab: 20,                // ステージ3: 持ち手に ふれたと見なす距離(px)
    vineVx: 70,                  // ステージ3: はなしたときの前への速さ(px/秒)
    wallKickH: 30,               // 三角とび: 壁を けったあと、壁に当たった所から上がる高さ(px。ふつうの人。人のジャンプ力に比例)
    wallKickVx: 90,              // 三角とび: けったあと左へ はね返る横の速さ(px/秒)
    climbTryMax: 2,              // クライマーが 右の崖の壁に つかまる回数の上限(上限の高さで落ちたあとも 2回まで)
    medalY: 262,                 // メダルの高さ(y)(旧ステージ STAGE_DEEP 用)。いまのステージは STAGES の medalX / medalY
    cliffHigh: 96,               // ステージ2「たかい がけ」: 左の崖が ふつうより何px高いか
    cliffHighR: 70,              // ステージ2: 右の崖が ふつうより何px高いか
    dropMin: 70,                 // ステージ2: これ以上の高さから スライムに落ちると、はね返る(px)
    dropKeep: 0.75,              // ステージ2: 落ちた高さの何割まで はね上がるか
    dropMaxH: 300,               // ステージ2: はね上がる高さの上限(px)
    dropFwd: 0.2,                // ステージ2: はね返りで前へ進む勢い(上向きの速さに対する割合)
    branchR: 4.5,                // えだの たに: 枝の太さの半分(px)
    branches: [[-1, 468, 22], [1, 400, 20], [-1, 558, 86], [1, 496, 78]],   // えだの たに: 枝 [どちらの壁か(-1左/1右), 根もとのy, 長さ]。下の枝ほど長く、上の枝の先から はみ出す
    branchTip: 5,                // えだの たに: 枝の先が根もとより何px上がっているか
    clouds: [[330, 86, 110, 300, 9], [262, 66, 300, 130, 12]],   // くも [上面のy, はば, はじめのx(まんなか), 反対はしのx, 往復の秒数]。右の崖の上まで行く
                                 // くもに乗った人は その場で じっと乗っていき、右の崖の上に来たら おりる
    balloons: [[112, 470], [190, 545], [255, 494]],   // ふうせん: [x, y]。落ちてきたスライムが ふれると、その場で のって止まる
    balloonR: 15,                // ふうせんの半径(px)
    kite: [125, 235, 300, 8],    // たこ: [左はしのx, 右はしのx, たこのy, 往復の秒数]。持ち手(ひもの先)は たこの 34px下
    kiteVx: 100, kiteVy: 30,     // たこに つかまった人が すべるように飛ぶ 前への速さ・おりていく速さ(px/秒)
    kiteLift: 50, kiteLiftT: 1.2,   // たこ: つかまってから この秒数のあいだは この速さで上がる
    sawX: 180, sawY: 470,        // ステージ3「シーソー」: 支点の位置
    sawHalf: 100,                // ステージ3: 板の長さの半分(px)
    sawMax: 0.4,                 // ステージ3: 板が傾く最大の角度(rad)
    sawK: 0.4 / 9000,            // ステージ3: 重さ×支点からの距離 → 傾き。スライムの重さ=線の長さ、人の重さ=personKg
    personKg: 45,                // ステージ3: 人の重さ(スライムの線の長さで いうと何px分か)。軽い人ほど軽い
    sawSpring: 420, sawDamp: 24, // ステージ3: 板が目標の傾きへ向かう速さ(ばね)と、ゆれの止まり方
    sawLaunchMin: 300,           // ステージ3: 板が この速さ以上で持ち上がったら、乗っている人が とばされる(px/秒)
    sawLaunch: 1.1,              // ステージ3: とばされる速さの倍率
    sawFwd: 0.22,                // ステージ3: とばされたとき前へ進む勢い(上向きの速さに対する割合)
    sawTapW: 6,                  // ステージ3: 歩いているときに板をタップ → その側が どすんと下がる勢い(rad/秒)
    sawTapV: 620,                // ステージ3: タップの反対側に乗っている人が とぶ速さ(板のはしで。支点に近いほど弱い)
    sawTapCool: 1.2,             // ステージ3: 板のタップが もう一度使えるまで(秒)
    maruClose: 30,               // 形: 描きおわりが描きはじめから この距離以内なら「まる」(px)
    maruMinLen: 90,              // 形: 「まる」になる最低の長さ(px)
    zigSwing: 7,                 // 形: ジグザグの1回の ふれはば(px)。これ以上の ふれが…
    zigTurns: 4,                 // 形: …この回数以上あれば「ジグザグ」
    sujiStraight: 0.93,          // 形: はじめと おわりの距離 ÷ 線の長さ が これ以上なら「まっすぐ」
    sujiMinLen: 50,              // 形: 「まっすぐ」になる最低の長さ(px)
    purunGuide: true,            // 跳ばし試作: ぷるんで とぶ先を点線で見せる

    retryPrep: 10,               // 「つづきから かきたす」の準備時間(秒)
    leafDemo: true,              // 準備中に、葉っぱが仕掛けに運ばれる見本を出す
    leafEvery: 5.5, leafFirst: 1.5,   // 葉っぱの見本: 出る間隔(秒)・準備のはじめから最初までの秒数
    stageLinks: false,           // テスト用: タイトルに「ステージ2から」「ステージ3から」のボタンを出す。投稿するときは false
    devButtons: false            // タイトルに「ステージ2/3」の試遊ボタンと「プロトタイプ」の表示を出す。投稿するときは false
  };
  c.valleyW = c.W * c.valleyRatio;
  c.edgeL = (c.W - c.valleyW) / 2;
  c.edgeR = c.edgeL + c.valleyW;
  c.goalX = c.W - 60;   // ゴールの旗の位置。渡った人は旗の先に並ぶ
  c.areaX = (c.W - c.areaSize) / 2;
  c.areaY = 396;
  c.bandTop = c.cliffTop - c.jumpUp * 0.7;   // 橋の高さの帯(いちばん跳べない人でも登れる高さ)
  c.bandBottom = c.cliffTop + c.jumpDown;
  return c;
})();

const PALETTE = {
  skyTop: '#bfe6ee', skyBottom: '#f4ecd0',
  hillFar: '#cfe3cd', hillNear: '#b7d4b2',
  hazeTop: '#a4c8cb', hazeBottom: '#3b5555',
  earth: '#8a6a48', earthDark: '#6f5238', grass: '#79b957', grassDark: '#559a3f',
  floor: '#4a3a2c', floorDark: '#33281f',
  ink: '#2a2320', paper: '#fffaf0',
  slimes: [[46, 176, 96], [44, 168, 176], [128, 202, 72]],
  people: ['#e8594f', '#3d7be0', '#f0b429', '#a259d9', '#2aa198'],
  ok: '#4cc36f', fail: '#e5533f', walk: '#ffd35e', wait: '#b8c4c2', btn: '#2fa858'
};
const FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","BIZ UDPGothic","Yu Gothic UI","Yu Gothic","Meiryo",sans-serif';   // 端末のフォント(外部読み込みはしない)

const W = CONFIG.W, H = CONFIG.H, L = CONFIG.edgeL, R = CONFIG.edgeR, CT = CONFIG.cliffTop, FL = CONFIG.floorY;
let RC = true;   // 右の崖があるか(ステージ3「イガの こじま」は なし。CTR は小島の上面)
let CTL = CT, CTR = CT;   // 左右の崖の上面のy(ステージによって違う)
const AX = CONFIG.areaX, AY = CONFIG.areaY, AS = CONFIG.areaSize;
const FIXED = 1 / 60;
const BUCKET_W = 12;
const BUCKETS = Math.ceil((R - L) / BUCKET_W);
const BTN = { x: W / 2 - 78, y: 604, w: 156, h: 28 };

/* ============================================================
   地形(谷の底): 折れ線で表す。ステージ1は左が一段高い段差、タイトルは平ら
   ============================================================ */
let TER = [], TERSEGS = [];
function buildTerrain(stepH, stepX) {
  TER = stepH > 0
    ? [{ x: L - 30, y: FL - stepH }, { x: stepX, y: FL - stepH }, { x: stepX, y: FL }, { x: R + 30, y: FL }]
    : [{ x: L - 30, y: FL }, { x: R + 30, y: FL }];
  TERSEGS = [];
  for (let i = 0; i < TER.length - 1; i++) TERSEGS.push({ ax: TER[i].x, ay: TER[i].y, bx: TER[i + 1].x, by: TER[i + 1].y });
}
/* x のところの底の高さ(段差の縁では谷側) */
function floorAt(x) {
  if (x < TER[0].x) return TER[0].y;
  for (let i = 0; i < TER.length - 1; i++) {
    const a = TER[i], b = TER[i + 1];
    if (a.x !== b.x && x >= a.x && x < b.x) return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
  }
  return TER[TER.length - 1].y;
}
function terrainDist(x, y) {
  let m = 1e9;
  for (const g of TERSEGS) {
    closestOnSeg(x, y, g.ax, g.ay, g.bx, g.by);
    const d = Math.hypot(x - _cx, y - _cy);
    if (d < m) m = d;
  }
  for (const g of BRANCHES) {   // 枝も地形(太さぶん ひく)
    closestOnSeg(x, y, g.ax, g.ay, g.bx, g.by);
    const d = Math.hypot(x - _cx, y - _cy) - g.r;
    if (d < m) m = d;
  }
  return m;
}
/* 半径 r の円が底に触れている(または埋まっている)か */
function terrainHit(x, y, r) { return y + r >= floorAt(x) || terrainDist(x, y) <= r; }
buildTerrain(0, 0);
function setTerrain(pts) {
  TER = pts; TERSEGS = [];
  for (let i = 0; i < TER.length - 1; i++) TERSEGS.push({ ax: TER[i].x, ay: TER[i].y, bx: TER[i + 1].x, by: TER[i + 1].y });
}
let WIND = null;
let BIRDS_ON = false, MEDAL = null;   // 積み試作: 鳥とメダル
let BOUNCE_ON = false, SAW_ON = false, SAW = null;
let BRANCHES = [], CLOUDS = [];
let BALLOONS = [], KITE = null;   // ステージ3: ふうせん と 空の たこ   // えだの たに: 枝(スライムが ひっかかる・人が乗れる) と 空の くも(人が乗ると運ばれる)   // ステージ2: 落ちた高さで はねる / ステージ3: シーソー
let PILLAR = null, SPRING = null, PILLARS = [], WATER = null, SPIKES = [];
const STAGE_SKY = [
  null,   // だんさ: 昼の空
  { skyTop: '#ff9e7a', skyBottom: '#ffe3b0', hillFar: '#e0a989', hillNear: '#c98f72', hazeTop: '#d49a86', hazeBottom: '#4a2f3a' },   // たかい がけ: 夕焼け
  { skyTop: '#7f6fc4', skyBottom: '#ffc2a2', hillFar: '#a99ac9', hillNear: '#9486b8', hazeTop: '#8f86b8', hazeBottom: '#2f2c4a' }
];
const SKY_DAY = {};
for (const k of ['skyTop', 'skyBottom', 'hillFar', 'hillNear', 'hazeTop', 'hazeBottom']) SKY_DAY[k] = PALETTE[k];
const TITLE_SKY = { skyTop: '#a9d6f0', skyBottom: '#ffe0c4', hillFar: '#d6e4c8', hillNear: '#bdd6b0', hazeTop: '#b3cdc8', hazeBottom: '#3f5252' };
Object.assign(PALETTE, TITLE_SKY);
const STAGES_OLD = [
  { need: 2, build: function () { buildTerrain(CONFIG.stepH, CONFIG.stepX); CTL = CT; CTR = CT; } },
  { need: 3, wind: function () { return { x0: CONFIG.windX - CONFIG.windW / 2, x1: CONFIG.windX + CONFIG.windW / 2, top: CTR - 30 }; }, build: function () {
      setTerrain([{ x: L - 30, y: FL }, { x: R + 30, y: FL - CONFIG.s2Slope }]);
      CTL = CT; CTR = CT - CONFIG.s2Rise;
  } },
  { need: 4, build: function () {
      buildTerrain(0, 0); CTL = CT; CTR = CT;
      SPIKES = CONFIG.spikes.map(function (q, k) { return { x: q[0], y: q[1], r: q[2] || 13, ph: k * 1.7 }; });
  } }
];
/* 跳ばし試作: 「なかの いわ」。左の岩だな・まんなかの岩の柱・少し高い右の崖。
   橋をかけて歩かせても、岩の上のスライムから ぷるんで跳ばしても わたれる */
const STAGES = [
  { need: 2, medalX: 204, medalY: 300, info: { ja: 'スライムを 積むほど タップで 高く ジャンプ！', en: 'Stack slimes higher for a bigger tap jump!' }, info2: { ja: '雲に 乗ると 運ばれる。1回 使うと 消える', en: 'Clouds carry you. Each one vanishes after use' }, build: function () {
      // ステージ1: 元の「だんさ」。谷底の左が一段高い
      buildTerrain(CONFIG.stepH, CONFIG.stepX); CTL = CT; CTR = CT;
      makeClouds(); MEDAL = { x: this.medalX, y: this.medalY };   // 空: くも(やさしい)
  } },
  { need: 3, medalX: 212, medalY: 312, info: { ja: '右の崖が 高い！ 積んで 登ろう', en: 'The right cliff is high! Stack up to climb' }, info2: { ja: '風で ふわっと 浮く。軽い人ほど 高く 飛ぶ', en: 'Wind lifts you up. Lighter walkers go higher' }, build: function () {
      // ステージ2「のぼり がけ」: 右の崖が高い。谷底に ふきあげる かぜ。鳥は出さない
      const C = CONFIG;
      buildTerrain(0, 0); CTL = CT; CTR = CT - C.climbRise;
      makeBranches(C.climbBranches);
      MEDAL = { x: this.medalX, y: this.medalY };   // とびながら・風に のりながらでも とれる
  }, wind: function () { return gustWind(); } },
  { need: 3, medalX: 232, medalY: 410, info: { ja: 'イガに 当たると スライムが 割れる！', en: 'Spikes pop slimes!' }, info2: { ja: 'つるに つかまると 向こうへ 運ばれる', en: 'Grab the vine to swing across' }, build: function () {
      // ステージ3「イガの くだり」: 右の崖がかなり低い。右の崖の手前に動かないイガの かきね。空にはつる
      const C = CONFIG;
      buildTerrain(0, 0); CTL = CT; CTR = CT + C.dropFall;
      SPIKES = C.fence.map(function (q, k) { return { x: q[0], y: q[1], r: C.fenceR, ph: k * 1.7 }; });
      makeVine();
      MEDAL = { x: this.medalX, y: this.medalY };   // 空中。とびながら とる
  } }
];
/* 前のステージ2「えだの たに」(鳥・低いメダル)。いまは使っていない */
const STAGE_BRANCH = { need: 3, medalX: 184, medalY: 488, info: 'スライムは えだに ひっかかる！ そらに 足場を つくろう', info2: 'たかく とぶと とりに つかまるかも。メダルは ひくい ところ', build: function () {
      buildTerrain(0, 0); CTL = CT; CTR = CT;
      makeBranches(); BIRDS_ON = true;
      MEDAL = { x: this.medalX, y: this.medalY, walk: true };
  } };
/* 前のステージ3「イガの こじま」(右の崖なし・空のうごくイガ)。いまは使っていない */
const STAGE_ISLE = { need: 3, medalX: 165, medalY: 470, demo: false, info: { ja: 'イガに さわると スライムが われる！ うえか したを とおろう', en: 'Spikes pop slimes! Go over or under' }, info2: { ja: 'こじまは せまい。とばしすぎに ちゅうい', en: 'The isle is tiny. Careful not to overshoot' }, build: function () {
      // ステージ3「イガの こじま」: 右の崖はなく、谷底から立つ細い岩の小島がゴール。まんなかに動かないイガ、空に往復するイガ
      const C = CONFIG, top = CT - C.isleRise, sk = C.skySpike;
      setTerrain([{ x: L - 30, y: FL }, { x: C.isleX0, y: FL }, { x: C.isleX0, y: top }, { x: C.isleX1, y: top }, { x: C.isleX1, y: FL }, { x: W + 30, y: FL }]);
      CTL = CT; CTR = top; RC = false; C.goalX = C.isleGoalX;
      PILLAR = { x0: C.isleX0, x1: C.isleX1, top: top };
      SPIKES = [{ x: C.isleSpike[0], y: C.isleSpike[1], r: C.isleSpike[2], ph: 0 }, { x: (sk.x0 + sk.x1) / 2, y: sk.y, r: sk.r, ph: 1.7, mv: sk }];
      MEDAL = { x: this.medalX, y: this.medalY, walk: true };
  } };
/* 前のステージ3「ふうせん」(たこ つき)。いまは使っていない */
const STAGE_BALLOON = { need: 3, medalX: 190, medalY: 508, info: 'スライムは ふうせんに のって ういたまま！', info2: 'そらの たこに つかまると すいーっと とぶ。メダルは ひくい ところ', build: function () {
      // ステージ3: ふうせん。谷に高さちがいの ふうせん。空に たこ
      buildTerrain(0, 0); CTL = CT; CTR = CT;
      makeBalloons(); makeKite();
      MEDAL = { x: this.medalX, y: this.medalY, walk: true };
  } };
/* 前のステージ3「シーソー」。いまは使っていない */
const STAGE_SAW = { need: 2, medalX: 258, medalY: 500, info: 'わたる ときに いたを タップで どすん！ はんたいがわの 人が とぶ', info2: 'のせた スライムの おもさで かたむきが かわる', build: function () {
      // ステージ3: 谷のまんなかに シーソー。支点は地形(三角の台)、板は動く足場
      const C = CONFIG;
      setTerrain([{ x: L - 30, y: FL }, { x: C.sawX - 34, y: FL }, { x: C.sawX, y: C.sawY + 8 }, { x: C.sawX + 34, y: FL }, { x: R + 30, y: FL }]);
      CTL = CT; CTR = CT;
      SAW_ON = true; MEDAL = { x: this.medalX, y: this.medalY };
  } };
/* 前のステージ2「たかい がけ」(落ちた高さで はねる)。いまは使っていない */
const STAGE_HIGH = { need: 2, medalX: 216, medalY: 530, info: 'たかい ところから スライムに おちると ぼよーん！', info2: 'ひくい スライムほど たかく はねる。メダルは したの ほう', build: function () {
      // ステージ2: 左の崖が高い。高いところから落ちてスライムに着地すると、落ちた高さに応じて はね返る
      buildTerrain(0, 0); CTL = CT - CONFIG.cliffHigh; CTR = CT - CONFIG.cliffHighR;
      BOUNCE_ON = true; MEDAL = { x: this.medalX, y: this.medalY };
  } };
/* 前のステージ2(ふかい たに・鳥)。いまは使っていない */
const STAGE_DEEP = { need: CONFIG.hopNeed, medalX: 180, build: function () { buildTerrain(0, 0); CTL = CT; CTR = CT - CONFIG.hopRightRise; BIRDS_ON = true; MEDAL = { x: this.medalX, y: CONFIG.medalY }; } };
function stInfo(v) { return typeof v === 'string' ? v : v[lang === 'ja' ? 'ja' : 'en']; }
function stageName(i) { return i18n('stageNames')[i]; }
function needOf() { return STAGES[G.stage || 0].need; }
function applyStage(i) {
  RC = true; CONFIG.goalX = CONFIG.W - 60;
  VINE = null;
  PILLAR = null; SPRING = null; PILLARS = []; WATER = null; SPIKES = []; BIRDS_ON = false; MEDAL = null; BOUNCE_ON = false; SAW_ON = false; SAW = null; BRANCHES = []; CLOUDS = []; BALLOONS = []; KITE = null;
  Object.assign(PALETTE, SKY_DAY, STAGE_SKY[i] || {});
  STAGES[i].build(); if (PILLAR) PILLARS = [PILLAR];
  G.waterDemo = false; G.demo = null;
  WIND = STAGES[i].wind ? STAGES[i].wind() : null;
  CONFIG.bandTop = Math.min(CTL, CTR) - CONFIG.jumpUp * 0.7;
  CONFIG.bandBottom = Math.max(CTL, CTR) + CONFIG.jumpDown;
}

const cv = document.getElementById('c');
let ctx = cv.getContext('2d');
let scale = 1, dpr = 1;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }

function resize() {
  const bw = document.body.clientWidth || window.innerWidth || W;
  const bh = document.body.clientHeight || window.innerHeight || H;
  const availW = Math.max(120, bw - 32);
  const availH = Math.max(160, bh - 24);
  scale = Math.min(availW / W, availH / H, 2.2);
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.style.width = Math.floor(W * scale) + 'px';
  cv.style.height = Math.floor(H * scale) + 'px';
  cv.width = Math.round(W * scale * dpr);
  cv.height = Math.round(H * scale * dpr);
}
window.addEventListener('resize', resize);
resize();

/* ============================================================
   ゲーム状態
   state: title / prep(準備) / walk(歩行) / result
   ============================================================ */
const G = {
  state: 'title', clock: 0, t: 0,
  slimes: [], people: [], particles: [], popups: [], pile: [], erasers: [], fades: [],
  drawing: null, drag: null, made: 0,
  spawned: 0, crossed: 0, fell: 0, status: [],
  shake: 0, endT: 0, resultT: 0
};
const pebbles = [];
for (let i = 0; i < 40; i++) pebbles.push({ x: rand(L, R), y: rand(FL + 4, H - 4), r: rand(1.5, 4) });
const tufts = [];
for (let i = 0; i < 14; i++) tufts.push({ x: rand(2, L - 4), s: rand(3, 6) });
for (let i = 0; i < 14; i++) tufts.push({ x: rand(R + 4, W - 2), s: rand(3, 6) });

/* 試遊用: URLの末尾に #2 を付けるとステージ2から始まる */
function startStage() {
  try { const n = parseInt(String(location.hash).replace('#', ''), 10); if (n >= 1 && n <= STAGES.length) return n - 1; } catch (e) {}
  return 0;
}
function newStage() {
  G.shots = G.shots || {}; G.shotDone = false; G.viewer = null;
  applyStage(G.stage || 0);
  G.introAt = G.clock; SFX.intro();
  G.state = 'prep';
  G.t = 0; G.slimes = []; G.people = []; G.particles = []; G.popups = []; G.erasers = []; G.fades = [];
  G.pile = new Array(BUCKETS).fill(0);
  G.drawing = null; G.drag = null; G.made = 0;
  G.spawned = 0; G.crossed = 0; G.fell = 0; G.purunN = 0; G.bridge = null;
  G.birds = []; G.birdT = 0.6; G.medalGot = false; G.medalRing = null;
  if (SAW_ON) makeSaw();
  G.status = new Array(CONFIG.people).fill('wait');
  G.shake = 0; G.endT = 0; G.resultT = 0;
  G.windT0 = 0; G.windPrev = null; G.leaf = null; G.leafAt = G.clock + CONFIG.leafFirst + (SPIKES.length && (STAGES[G.stage || 0] || {}).demo !== false ? 2.6 : 0); G.keepNote = false;   // イガの ステージは、イガの見本(われる)を先に見せる
}
/* 失敗のあとの「つづきから かきたす」: 固まっているスライムを その位置のまま残し、ほかは ふつうのステージ開始と同じに戻す */
function keepRetry() {
  const keep = G.slimes.filter(function (q) { return q.state === 'fixed' && !q.plank; });
  const made = G.made, got = G.medalGot;
  newStage();
  for (const q of keep) { q.purunAt = -99; q.ghost = null; q.collapse = false; q.vx = 0; q.vy = 0; q.w = 0; q.riders = 0; q.born = G.clock - 5; q.stuckAt = G.clock - 10; q.state = 'fixed'; q.bb = bboxOf(q.pts); }
  G.slimes = keep; G.made = made; G.medalGot = got;
  G.t = Math.max(0, CONFIG.prepTime - CONFIG.retryPrep); G.keepNote = true;
}

function startWalk() {
  se('walk');
  G.state = 'walk';
  G.t = 0; G.drawing = null; G.erasers = []; G.windT0 = G.clock; G.windPrev = null; G.leaf = null;
  if (VINE && VINE.holder && VINE.holder.isLeaf) { VINE.holder = null; VINE.state = 'back'; VINE.t = 0; }
  if (G.drag) { if (!G.drag.eraser) G.drag.s.state = 'free'; G.drag = null; }
}

/* 効果音(js/sfx.js)。タイトル画面の自動デモでは鳴らさない */
function se(name, a) { if (G.state !== 'title') SFX[name](a); }

/* 試作: 個性が活きる場面の専用セリフ(同じ人が続けて言わないよう間をあける) */
const PERSONA_SAYS = {
  cliff: { ja: '崖は のぼれる！', en: 'I can climb cliffs!' },
  steep: { ja: 'ぐいぐい のぼるぞ！', en: 'Up we go!' },
  wait: { ja: 'とどくかな…', en: 'Can I make it…?' },
  dive: { ja: 'えいっ！', en: 'Here goes!' },
  look: { ja: 'あっちが たかい！', en: 'Higher up there!' },
  leap: { ja: 'ひとっとび！', en: 'One big leap!' }
};
function persona(p, key) {
  if ((p.sayCool || 0) > 0) return;
  p.sayCool = 0.9;
  popup(p.x - 4, p.y - 40 * p.sh, PERSONA_SAYS[key][lang === 'ja' ? 'ja' : 'en'], 11.5, '#fff', PALETTE.ink, 1.1, 24); se('say', p.id);
}
function popup(x, y, text, size, color, stroke, life, vy) {
  G.popups.push({ x: x, y: y, text: text, size: size, color: color, stroke: stroke, life: life || 0.9, age: 0, vy: vy === undefined ? 24 : vy });
}

/* ============================================================
   幾何ヘルパー
   ============================================================ */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function bboxOf(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}
function shiftSlime(s, dx, dy) { for (const p of s.pts) { p.x += dx; p.y += dy; } }

function smooth(raw) {
  let P = raw;
  for (let pass = 0; pass < 2; pass++) {
    const Q = [P[0]];
    for (let i = 1; i < P.length - 1; i++) Q.push({ x: (P[i - 1].x + P[i].x + P[i + 1].x) / 3, y: (P[i - 1].y + P[i].y + P[i + 1].y) / 3 });
    Q.push(P[P.length - 1]);
    P = Q;
  }
  return P;
}
function resample(raw, sp) {
  const out = [{ x: raw[0].x, y: raw[0].y }];
  let acc = 0;
  for (let i = 1; i < raw.length; i++) {
    let a = raw[i - 1];
    const b = raw[i];
    let d = Math.hypot(b.x - a.x, b.y - a.y);
    while (d > 0 && acc + d >= sp) {
      const t = (sp - acc) / d;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      out.push({ x: x, y: y });
      a = { x: x, y: y };
      d = Math.hypot(b.x - a.x, b.y - a.y);
      acc = 0;
    }
    acc += d;
  }
  const l = raw[raw.length - 1], e = out[out.length - 1];
  if (Math.hypot(l.x - e.x, l.y - e.y) > sp * 0.4) out.push({ x: l.x, y: l.y });
  return out;
}

/* ============================================================
   スライム(手描きの形)
   state: free(降ってくる・動かせる) / held(つかんでいる) / fixed(くっついた)
   ============================================================ */
/* ============================================================
   形のごほうび: まる=ころころ転がる / ジグザグ=ぷるんで よく はねる / まっすぐ=すべらない(急でも歩ける・ぴたっと止まる)
   mu: 摩擦の倍率 damp/spin: 減速・回転の減り方の倍率 e: 着地の はね返り settle: 止まるまで待つ最長(秒)
   ============================================================ */
const SHAPE_KINDS = {
  maru: { ja: 'まる！ ころころ', en: 'Round! Rolls', col: '#3d7be0', mu: 1, damp: 0.35, spin: 0.2, e: 0.3, settle: 5.5, purun: 1 },
  zig: { ja: 'ジグザグ！ ぼよよん', en: 'Zigzag! Boing', col: '#d9487a', mu: 1, damp: 1, spin: 1, e: 0.6, settle: 4, purun: 1.4 },
  suji: { ja: 'まっすぐ！ すべらない', en: 'Straight! Grippy', col: '#2a8f4d', mu: 2.4, damp: 2, spin: 2, e: 0, settle: 3.5, purun: 1, slope: 3 }
};
const SHAPE_NONE = { mu: 1, damp: 1, spin: 1, purun: 1 };
function shapeOf(s) { return (s && SHAPE_KINDS[s.kind]) || SHAPE_NONE; }
/* 描いた線(なめらかにして等間隔にした点)から形を決める */
function shapeKind(pts, len) {
  const C = CONFIG, a0 = pts[0], z0 = pts[pts.length - 1], gap = Math.hypot(z0.x - a0.x, z0.y - a0.y);
  const bb = bboxOf(pts);
  if (len >= C.maruMinLen && gap <= C.maruClose && Math.min(bb.x1 - bb.x0, bb.y1 - bb.y0) >= 24) return 'maru';
  if (gap >= 20) {
    // はじめ→おわりの向きに直角な方向へ、何回 ふれたか
    const ux = (z0.x - a0.x) / gap, uy = (z0.y - a0.y) / gap, nx = -uy, ny = ux;
    let turns = 0, dir = 0, ext = 0;
    for (const q of pts) {
      const v = (q.x - a0.x) * nx + (q.y - a0.y) * ny;
      if (dir >= 0 && v > ext) { ext = v; if (dir === 0 && v > C.zigSwing) dir = 1; }
      else if (dir <= 0 && v < ext) { ext = v; if (dir === 0 && v < -C.zigSwing) dir = -1; }
      if (dir === 1 && v < ext - C.zigSwing) { turns++; dir = -1; ext = v; }
      else if (dir === -1 && v > ext + C.zigSwing) { turns++; dir = 1; ext = v; }
    }
    if (turns >= C.zigTurns) return 'zig';
  }
  if (len >= C.sujiMinLen && gap / len >= C.sujiStraight) return 'suji';
  return null;
}
/* 形の印(○ 〰 ―)。スライムの顔の横に小さく */
function drawShapeMark(x, y, kind) {
  const k = SHAPE_KINDS[kind];
  if (!k) return;
  ctx.save();
  circ(x, y, 7.5); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.strokeStyle = k.col; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'maru') { circ(x, y, 3.6); ctx.stroke(); }
  else if (kind === 'zig') { ctx.beginPath(); ctx.moveTo(x - 4.5, y + 1.5); ctx.lineTo(x - 2, y - 2); ctx.lineTo(x + 0.5, y + 2); ctx.lineTo(x + 3, y - 2); ctx.lineTo(x + 4.8, y + 0.8); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(x - 4.5, y); ctx.lineTo(x + 4.5, y); ctx.stroke(); }
  ctx.restore();
}
function spawnSlime(pts, blob) {
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= pts.length; my /= pts.length;
  for (const p of pts) { p.x = mx + (p.x - mx) * CONFIG.shrink; p.y = my + (p.y - my) * CONFIG.shrink; }
  const bb = bboxOf(pts);
  const dy = -4 - bb.y1;                       // 画面の上端のすぐ外から降ってくる
  let cx = 0, cy = 0;
  for (const p of pts) { p.y += dy; cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  let face = 0, bd = 1e9;
  pts.forEach(function (p, i) { const d = Math.hypot(p.x - cx, p.y - cy); if (d < bd) { bd = d; face = i; } });
  const s = { pts: pts, thick: CONFIG.slimeThick * CONFIG.thickScale, state: 'free', ci: G.made % PALETTE.slimes.length, born: G.clock, stuckAt: -99, face: face, bb: null, vy: CONFIG.fallSpeed, ghost: null, blob: !!blob, purunAt: -99, riders: 0 };
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  s.len = len;
  G.made++;   // 降り始めの「ぽこっ」は、描きおわりのぷるん(drawEnd)と重なるので鳴らさない
  G.slimes.push(s);
  return s;
}

function touching(s) {
  const r = s.thick / 2;
  if (BALLOONS.length && balloonHit(s)) return 'balloon';
  for (const p of s.pts) {
    if (terrainHit(p.x, p.y, r)) return 'floor';
    if (CONFIG.cliffSticky && p.y + r >= CT && (p.x - r <= L || p.x + r >= R)) return 'cliff';
  }
  const bb = bboxOf(s.pts);
  for (const o of G.slimes) {
    if (o === s || o.state !== 'fixed') continue;
    const rr_ = r + o.thick / 2;
    if (bb.x1 + rr_ < o.bb.x0 || bb.x0 - rr_ > o.bb.x1 || bb.y1 + rr_ < o.bb.y0 || bb.y0 - rr_ > o.bb.y1) continue;
    for (const p of s.pts) {
      for (let i = 0; i < o.pts.length - 1; i++) {
        if (segDist(p.x, p.y, o.pts[i].x, o.pts[i].y, o.pts[i + 1].x, o.pts[i + 1].y) <= rr_) return 'slime';
      }
    }
  }
  return null;
}

function stick(s, kind) {
  se('land');
  s.state = 'fixed'; s.stuckAt = G.clock; s.bb = bboxOf(s.pts); s.ghost = null;
  if (G.drag && G.drag.s === s) G.drag = null;
  const f = s.pts[s.face];
  popup(f.x, f.y - 22, i18n('splat'), 14, '#fff', '#2a8f4d', 0.7);
  if (G.state === 'prep' && stackOf(s) >= 2) popup(f.x, f.y - 44, lang === 'ja' ? 'ぷるん UP！' : 'Bounce UP!', 13, '#fff', '#e0951a', 1.0, 22);   // 積み試作
  const c = PALETTE.slimes[s.ci];
  for (let i = 0; i < 10; i++) {
    const p = s.pts[Math.floor(Math.random() * s.pts.length)];
    G.particles.push({ x: p.x, y: p.y, vx: rand(-50, 50), vy: rand(-90, -20), r: rand(1.5, 3.2), life: rand(0.3, 0.6), age: 0, col: rgb(c) });
  }
}

/* ============================================================
   着地後の挙動(v5): 触れた瞬間に固定せず、剛体として少しのあいだ動かす
   重力・はね返り・摩擦・回転があり、落ち着いたら従来どおり固定される。
   動くのは着地したばかりの1つだけ。固定済みのスライムと崖は動かない
   ============================================================ */
let _cx = 0, _cy = 0;
function closestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  _cx = ax + dx * t; _cy = ay + dy * t;
}
function centroidOf(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function beginSettle(s, kind) {
  if (kind === 'balloon') { s.onBalloon = true; stick(s, kind); return; }   // ステージ3: ふうせんに のって その場で止まる
  if (!CONFIG.phys) { stick(s, kind); return; }
  if (G.drag && G.drag.s === s) G.drag = null;
  const wasHeld = s.state === 'held';
  const c = centroidOf(s.pts);
  let sum = 0, far = 0;
  for (const p of s.pts) { const d2 = (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y); sum += d2; if (d2 > far) far = d2; }
  const r = s.thick / 2;
  s.inertia = sum / s.pts.length + r * r / 2;   // 質量1あたりの慣性モーメント
  s.rad = Math.sqrt(far) + r;
  s.state = 'settle'; s.settleAt = G.clock; s.sleepT = 0; s.nudged = !!s.demo; s.ghost = null; s.stuckAt = -99;
  const vy = wasHeld ? 40 : Math.min(s.vy || CONFIG.fallSpeed, CONFIG.collapseMax);
  s.vx = s.demo ? 0 : rand(-1, 1) * CONFIG.physKickSlide;
  s.vy = vy;
  s.w = s.demo ? 0 : rand(-1, 1) * CONFIG.physKickSpin;
  if (s.kind === 'maru') { const dir = s.roll || (s.vx >= 0 ? 1 : -1); s.w += dir * 1.6; s.vx += dir * 20; }   // デモは roll で向きを決める(毎回おなじ)   // まる: 着地で ころがり出す
  if (vy > 150) G.shake = Math.max(G.shake, 2.5);
}

/* 動いているスライムが、谷底・崖・固定済みスライムにめり込んでいる箇所を集める。
   法線(nx,ny)は「相手から自分へ」向き。崖は摩擦なし(はさまって止まらないように) */
function gatherContacts(s, out) {
  out.length = 0;
  const C = CONFIG, r = s.thick / 2, P = s.pts, n = P.length, bb = bboxOf(P);
  function add(x, y, nx, ny, pen, mu, cliff) { out.push({ x: x, y: y, nx: nx, ny: ny, pen: pen, mu: mu, cliff: cliff }); }

  for (let i = 0; i < n; i++) {
    const p = P[i], fy = floorAt(p.x);
    if (p.y > fy) { add(p.x, p.y, 0, -1, p.y - fy + r, C.physFloorFriction, false); continue; }   // 底の中まで入った
    for (const g of TERSEGS) {
      closestOnSeg(p.x, p.y, g.ax, g.ay, g.bx, g.by);
      const dx = p.x - _cx, dy = p.y - _cy, d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d > 1e-6) add(p.x, p.y, dx / d, dy / d, r - d, C.physFloorFriction, false);
      else add(p.x, p.y, 0, -1, r, C.physFloorFriction, false);
    }
    for (const g of BRANCHES) {   // えだの たに: 枝
      closestOnSeg(p.x, p.y, g.ax, g.ay, g.bx, g.by);
      const dx = p.x - _cx, dy = p.y - _cy, d = Math.hypot(dx, dy), rr2 = r + g.r;
      if (d >= rr2) continue;
      if (d > 1e-6) add(p.x, p.y, dx / d, dy / d, rr2 - d, C.physFloorFriction, false);
      else add(p.x, p.y, 0, -1, rr2, C.physFloorFriction, false);
    }
  }
  // 枝の先(スライムの線分の途中が 枝の先に乗る場合)
  for (const g of BRANCHES) {
    const qx = g.bx, qy = g.by, rr2 = r + g.r;
    if (qx < bb.x0 - rr2 || qx > bb.x1 + rr2 || qy < bb.y0 - rr2 || qy > bb.y1 + rr2) continue;
    for (let i = 0; i < n - 1; i++) {
      closestOnSeg(qx, qy, P[i].x, P[i].y, P[i + 1].x, P[i + 1].y);
      const dx = _cx - qx, dy = _cy - qy, d = Math.hypot(dx, dy);
      if (d >= rr2) continue;
      if (d > 1e-6) add(_cx, _cy, dx / d, dy / d, rr2 - d, C.physFloorFriction, false);
      else add(_cx, _cy, 0, -1, rr2, C.physFloorFriction, false);
    }
  }
  // 段差の角(線分の途中が角に乗る場合)
  for (let k = 1; k < TER.length - 1; k++) {
    const qx = TER[k].x, qy = TER[k].y;
    if (qx < bb.x0 - r || qx > bb.x1 + r || qy < bb.y0 - r || qy > bb.y1 + r) continue;
    for (let i = 0; i < n - 1; i++) {
      closestOnSeg(qx, qy, P[i].x, P[i].y, P[i + 1].x, P[i + 1].y);
      const dx = _cx - qx, dy = _cy - qy, d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d > 1e-6) add(_cx, _cy, dx / d, dy / d, r - d, C.physFloorFriction, false);
      else add(_cx, _cy, 0, -1, r, C.physFloorFriction, false);
    }
  }
  if (bb.y1 + r > Math.min(CTL, CTR)) {
    for (let i = 0; i < n; i++) {
      const p = P[i];
      for (let side = -1; side <= 1; side += 2) {
        if (side > 0 && !RC) continue;
        const x0 = side < 0 ? -60 : R, x1 = side < 0 ? L : W + 60, y0 = side < 0 ? CTL : CTR, y1 = H + 60;
        const qx = clamp(p.x, x0, x1), qy = clamp(p.y, y0, y1);
        const dx = p.x - qx, dy = p.y - qy, d = Math.hypot(dx, dy);
        if (d >= r) continue;
        if (d > 1e-6) add(p.x, p.y, dx / d, dy / d, r - d, 0, true);
        else {
          const up = p.y - y0 + r, inward = side < 0 ? (x1 - p.x + r) : (p.x - x0 + r);
          if (up <= inward) add(p.x, p.y, 0, -1, up, 0, true);
          else add(p.x, p.y, side < 0 ? 1 : -1, 0, inward, 0, true);
        }
      }
    }
    // 崖のふちの角(線分の途中が角に乗る場合)
    for (let k = 0; k < 2; k++) {
      if (k && !RC) continue;
      const qx = k ? R : L, qy = k ? CTR : CTL;
      for (let i = 0; i < n - 1; i++) {
        closestOnSeg(qx, qy, P[i].x, P[i].y, P[i + 1].x, P[i + 1].y);
        const dx = _cx - qx, dy = _cy - qy, d = Math.hypot(dx, dy);
        if (d >= r) continue;
        if (d > 1e-6) add(_cx, _cy, dx / d, dy / d, r - d, 0, true);
        else add(_cx, _cy, 0, -1, r, 0, true);
      }
    }
  }

  for (const o of G.slimes) {
    if (o.state !== 'fixed') continue;
    const ro = o.thick / 2, S = r + ro, ob = o.bb, Q = o.pts;
    if (bb.x1 + S < ob.x0 || bb.x0 - S > ob.x1 || bb.y1 + S < ob.y0 || bb.y0 - S > ob.y1) continue;
    // 自分の点 × 相手の線分
    for (let i = 0; i < n; i++) {
      const p = P[i];
      if (p.x + S < ob.x0 || p.x - S > ob.x1 || p.y + S < ob.y0 || p.y - S > ob.y1) continue;
      for (let j = 0; j < Q.length - 1; j++) {
        const a = Q[j], b = Q[j + 1];
        if (p.x < (a.x < b.x ? a.x : b.x) - S || p.x > (a.x > b.x ? a.x : b.x) + S || p.y < (a.y < b.y ? a.y : b.y) - S || p.y > (a.y > b.y ? a.y : b.y) + S) continue;
        closestOnSeg(p.x, p.y, a.x, a.y, b.x, b.y);
        const dx = p.x - _cx, dy = p.y - _cy, d = Math.hypot(dx, dy);
        if (d >= S) continue;
        if (d > 1e-6) add(p.x, p.y, dx / d, dy / d, S - d, C.physSlimeFriction, false);
        else add(p.x, p.y, 0, -1, S, C.physSlimeFriction, false);
      }
    }
    // 相手の点 × 自分の線分
    for (let j = 0; j < Q.length; j++) {
      const q = Q[j];
      if (q.x < bb.x0 - S || q.x > bb.x1 + S || q.y < bb.y0 - S || q.y > bb.y1 + S) continue;
      for (let i = 0; i < n - 1; i++) {
        const a = P[i], b = P[i + 1];
        if (q.x < (a.x < b.x ? a.x : b.x) - S || q.x > (a.x > b.x ? a.x : b.x) + S || q.y < (a.y < b.y ? a.y : b.y) - S || q.y > (a.y > b.y ? a.y : b.y) + S) continue;
        closestOnSeg(q.x, q.y, a.x, a.y, b.x, b.y);
        const dx = _cx - q.x, dy = _cy - q.y, d = Math.hypot(dx, dy);
        if (d >= S) continue;
        if (d > 1e-6) add(_cx, _cy, dx / d, dy / d, S - d, C.physSlimeFriction, false);
        else add(_cx, _cy, 0, -1, S, C.physSlimeFriction, false);
      }
    }
  }
}

const _cons = [];
function settleStep(s, dt) {
  const C = CONFIG, SUB = 2, ITER = 4, h = dt / SUB, P = s.pts, I = s.inertia, sk = shapeOf(s);
  for (let k = 0; k < SUB; k++) {
    s.vy += C.physGravity * h;
    const dm = Math.max(0, 1 - C.physDamp * sk.damp * h), da = Math.max(0, 1 - C.physSpinDamp * sk.spin * h);
    s.vx *= dm; s.vy *= dm; s.w *= da;
    s.vx = clamp(s.vx, -900, 900); s.vy = clamp(s.vy, -900, 900); s.w = clamp(s.w, -14, 14);
    // 移動と回転
    const c = centroidOf(P), ang = s.w * h, cs = Math.cos(ang), sn = Math.sin(ang), mx = s.vx * h, my = s.vy * h;
    for (const p of P) {
      const rx = p.x - c.x, ry = p.y - c.y;
      p.x = c.x + rx * cs - ry * sn + mx;
      p.y = c.y + rx * sn + ry * cs + my;
    }
    // 接触の解消(めり込みを押し戻し、ぶつかる向きの速度を打ち消す)
    let onTop = false, cx = c.x;
    for (let it = 0; it < ITER; it++) {
      gatherContacts(s, _cons);
      if (!_cons.length) break;
      const c2 = centroidOf(P); cx = c2.x;
      let Tx = 0, Ty = 0;
      for (const ct of _cons) {
        const pen = ct.pen - (Tx * ct.nx + Ty * ct.ny);
        if (pen > C.physSlop) { const m = (pen - C.physSlop) * 0.8; Tx += ct.nx * m; Ty += ct.ny * m; }
        const rx = ct.x - c2.x, ry = ct.y - c2.y;
        const vn = (s.vx - s.w * ry) * ct.nx + (s.vy + s.w * rx) * ct.ny;
        if (vn < 0) {
          const rn = rx * ct.ny - ry * ct.nx;
          const e = vn < -40 ? (sk.e !== undefined ? sk.e : C.physRestitution) : 0;
          if (vn < -160) se('bounce');
          const j = -(1 + e) * vn / (1 + rn * rn / I);
          s.vx += j * ct.nx; s.vy += j * ct.ny; s.w += rn * j / I;
          if (ct.mu > 0) {
            const tx = -ct.ny, ty = ct.nx;
            const vt = (s.vx - s.w * ry) * tx + (s.vy + s.w * rx) * ty;
            const rt = rx * ty - ry * tx;
            let jt = -vt / (1 + rt * rt / I);
            const mf = ct.mu * sk.mu * j;
            jt = jt > mf ? mf : (jt < -mf ? -mf : jt);
            s.vx += jt * tx; s.vy += jt * ty; s.w += rt * jt / I;
          }
        }
        if (ct.cliff && ct.ny < -0.7) onTop = true;
      }
      if (Tx || Ty) for (const p of P) { p.x += Tx; p.y += Ty; }
    }
    // 崖の上に乗っても貼りつかず、谷のほうへ押し戻される
    if (onTop) s.vx += ((L + R) / 2 > cx ? 1 : -1) * C.physCliffPush * h;
  }
  const sp = Math.hypot(s.vx, s.vy) + Math.abs(s.w) * s.rad * 0.5;
  s.sleepT = sp < C.physSleepSpeed ? s.sleepT + dt : 0;
  if (G.clock - s.settleAt >= (sk.settle || C.physSettleMax)) { finishSettle(s); return; }
  if (s.sleepT >= C.physSleepTime) {
    // 止まったように見えても、不安定な釣り合い(立った棒など)かもしれない。一度だけ軽く揺さぶって確かめる
    if (!s.nudged && C.physNudge > 0) {
      s.nudged = true; s.sleepT = 0;
      s.w += (Math.random() < 0.5 ? -1 : 1) * C.physNudge; s.vx += rand(-1, 1) * 6;
    } else finishSettle(s);
  }
}

/* 何に支えられているか(谷底か、固定済みスライムか)。ゆるめの許容で判定する */
function supportKind(s) {
  const r = s.thick / 2, tol = 1.2;
  if (BALLOONS.length && balloonHit(s)) return 'balloon';
  for (const p of s.pts) if (terrainHit(p.x, p.y, r + 1)) return 'floor';
  const bb = bboxOf(s.pts);
  for (const o of G.slimes) {
    if (o === s || o.state !== 'fixed') continue;
    const S = r + o.thick / 2 + tol;
    if (bb.x1 + S < o.bb.x0 || bb.x0 - S > o.bb.x1 || bb.y1 + S < o.bb.y0 || bb.y0 - S > o.bb.y1) continue;
    for (const p of s.pts) for (let i = 0; i < o.pts.length - 1; i++) {
      if (segDist(p.x, p.y, o.pts[i].x, o.pts[i].y, o.pts[i + 1].x, o.pts[i + 1].y) <= S) return 'slime';
    }
    for (const q of o.pts) for (let i = 0; i < s.pts.length - 1; i++) {
      if (segDist(q.x, q.y, s.pts[i].x, s.pts[i].y, s.pts[i + 1].x, s.pts[i + 1].y) <= S) return 'slime';
    }
  }
  return null;
}

function finishSettle(s) {
  s.bb = bboxOf(s.pts);
  const k = supportKind(s);
  if (k) { stick(s, k); return; }
  // 崖の角などで止まって何にも支えられていない: もう一度落とす
  s.state = 'free'; s.collapse = false; s.vx = 0; s.w = 0; s.vy = CONFIG.fallSpeed;
}

/* 崖は壁。スライムは崖の中に入れず、貼りつかずに側面を滑り落ちる。
   崖の上に乗ったときは landed=true を返す */
function resolveWalls(s) {
  if (CONFIG.cliffSticky) return false;
  const r = s.thick / 2;
  let landed = false;
  for (let iter = 0; iter < 3; iter++) {
    let bx = 0, by = 0, bd = 0;
    for (const p of s.pts) {
      for (let side = -1; side <= 1; side += 2) {
        if (side > 0 && !RC) continue;
        const x0 = side < 0 ? -60 : R, x1 = side < 0 ? L : W + 60, y0 = side < 0 ? CTL : CTR, y1 = H + 60;
        const qx = clamp(p.x, x0, x1), qy = clamp(p.y, y0, y1);
        const ddx = p.x - qx, ddy = p.y - qy, d = Math.hypot(ddx, ddy);
        let ox = 0, oy = 0;
        if (d > 0) {
          if (d < r) { ox = ddx / d * (r - d); oy = ddy / d * (r - d); }
        } else {
          const up = p.y - y0 + r;
          const inward = side < 0 ? (x1 - p.x + r) : (p.x - x0 + r);
          if (up <= inward) oy = -up; else ox = side < 0 ? inward : -inward;
        }
        const m = Math.hypot(ox, oy);
        if (m > bd) { bd = m; bx = ox; by = oy; }
      }
    }
    if (bd < 0.01) break;
    shiftSlime(s, bx, by);
    if (by < -0.01) landed = true;
  }
  return landed;
}

/* 手を離したらどこに貼りつくか(まっすぐ落ちた場合)。崖の上に落ちるなら null */
function landingGhost(s) {
  const t = { pts: s.pts.map(function (p) { return { x: p.x, y: p.y }; }), thick: s.thick };
  for (let i = 0; i < 130; i++) {
    shiftSlime(t, 0, 6);
    if (resolveWalls(t)) return null;
    if (touching(t)) return t;
  }
  return null;
}

function moveHeld(s, dx, dy) {
  const r = s.thick / 2, bb = bboxOf(s.pts);
  dx = clamp(dx, r - bb.x0, W - r - bb.x1);
  dy = Math.max(dy, Math.min(0, r - bb.y0));
  const dist = Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(dist / 5));
  for (let i = 0; i < n; i++) {
    shiftSlime(s, dx / n, dy / n);
    resolveWalls(s);
    const k = touching(s);
    if (k) { beginSettle(s, k); break; }
  }
}

function hitFree(x, y) {
  let best = null, bd = 1e9;
  for (const s of G.slimes) {
    if (s.state !== 'free' && s.state !== 'held') continue;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const d = segDist(x, y, s.pts[i].x, s.pts[i].y, s.pts[i + 1].x, s.pts[i + 1].y) - s.thick / 2;
      if (d < bd) { bd = d; best = s; }
    }
  }
  return bd <= CONFIG.gripRadius ? best : null;
}

function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
function mix(c, t) { return 'rgb(' + Math.round(lerp(c[0], 255, t)) + ',' + Math.round(lerp(c[1], 255, t)) + ',' + Math.round(lerp(c[2], 255, t)) + ')'; }

/* ============================================================
   人(歩く・ジャンプする・落ちる)
   ============================================================ */
/* 出る順番は固定。1人目がいちばん弱く、最後がいちばん強い */
const SPR_S = 0.35, SPR_M = 0.43, SPR_C = 0.49, SPR_K = 0.47, SPR_T = 0.56;   // バネで前へ飛ぶ勢いの倍率
const PERSON_TYPES = [
  { get name() { return i18n('personNames')[0]; }, speed: 0.65, jump: 0.7, reach: 1.45, slope: 1.0, hop: 1, diag: 0, hesitate: 1.1, get say() { return i18n('personSays')[0]; }, sw: 1.5,  sh: 0.75, spr: SPR_S, acc: 'beanie', wind: 1.35, light: 1.5 },
  { get name() { return i18n('personNames')[1]; }, speed: 1.0,  jump: 1.0, reach: 1.0, slope: 1.8, hop: 2, diag: 1, hesitate: 0,   get say() { return i18n('personSays')[1]; },   sw: 1.0,  sh: 1.0,  look: true, spr: SPR_M, acc: '', wind: 1.0, light: 1.0 },
  { get name() { return lang === 'ja' ? 'レスキュー' : 'Rescue'; }, speed: 1.1,  jump: 1.0, reach: 2.6, slope: 1.8, hop: 0, diag: 3, hesitate: 0,   get say() { return i18n('personSays')[2]; }, sw: 1.0,  sh: 1.0,  look: true, spr: SPR_C, acc: 'band', wind: 1.0, light: 1.0, rescue: true },
  { get name() { return i18n('personNames')[3]; }, speed: 0.85, jump: 0.9, reach: 1.0, slope: 12, hop: 3, diag: 1, hesitate: 0,   get say() { return i18n('personSays')[3]; }, sw: 1.15, sh: 1.0,  spr: SPR_K, acc: 'pack', wind: 0.8, climb: true, climbH: 84, light: 0.8 },
  { get name() { return i18n('personNames')[4]; }, speed: 1.7,  jump: 1.5, reach: 1.5, slope: 1.8, hop: 0, diag: 1, hesitate: 0,   get say() { return i18n('personSays')[4]; }, sw: 0.7,  sh: 1.5,  spr: SPR_T, acc: 'scarf', wind: 0.9, dust: true, light: 0.6 }
];
function spawnPerson(typeIdx) {
  const id = G.spawned++;
  const T = PERSON_TYPES[(typeIdx === undefined ? id : typeIdx) % PERSON_TYPES.length];
  const up = CONFIG.jumpUp * T.jump;
  G.people.push({
    id: id, type: T, x: CONFIG.startX, y: CTL, vx: 0, vy: 0, state: 'walk', jumping: false, y0: CTL,
    tries: 0, hopping: false, bestX: CONFIG.startX, idleT: 0, pause: 0, hesitated: false, dropFrom: undefined,
    speed: CONFIG.walkSpeed * T.speed, reach: CONFIG.jumpReach * T.reach, slope: T.slope,
    jumpUp: up, jumpV: Math.sqrt(2 * CONFIG.personGravity * (up + 6)),
    sw: T.sw, sh: T.sh,
    phase: rand(0, 6), cheerT: 0, color: PALETTE.people[id % PALETTE.people.length],
    lie: (id % 2 ? 1 : -1) * rand(1.1, 1.6)
  });
  G.status[id] = 'walk';
}

/* 試作: かたまり(とじた形)は中がつまっているので、足場になるのは一番上の面だけ。そこが急すぎれば足場なし */
function blobTop(s, x, maxSlope) {
  const P = s.pts; let best = null, bk = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    if ((a.x <= x && x <= b.x) || (b.x <= x && x <= a.x)) {
      const dx = b.x - a.x;
      if (Math.abs(dx) < 0.001) continue;
      const k = (b.y - a.y) / dx, y = a.y + k * (x - a.x);
      if (best === null || y < best) { best = y; bk = k; }
    }
  }
  if (best === null || Math.abs(bk) > maxSlope) return null;
  return best - s.thick / 2;
}
/* 試作: 足元のスライムと、その面の傾き */
function slimeUnder(p) {
  let best = null, bd = 2.5;
  for (const s of G.slimes) {
    if (s.state !== 'fixed') continue;
    const P = s.pts;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      if ((a.x <= p.x && p.x <= b.x) || (b.x <= p.x && p.x <= a.x)) {
        const dx = b.x - a.x;
        if (Math.abs(dx) < 0.001) continue;
        const k = (b.y - a.y) / dx, d = Math.abs(a.y + k * (p.x - a.x) - s.thick / 2 - p.y);
        if (d < bd) { bd = d; best = { s: s, k: k }; }
      }
    }
  }
  return best;
}
function inBlob(s, x, y) {
  const P = s.pts; let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if ((P[i].y > y) !== (P[j].y > y) && x < (P[j].x - P[i].x) * (y - P[i].y) / (P[j].y - P[i].y) + P[i].x) inside = !inside;
  }
  return inside;
}
/* 試作: レスキュー。谷に落ちた人を、1ステージに1回だけ ひもで引き上げて、上へ ほうり投げる(復活のチャンス)。
   レスキュー本人が歩いているか、ゴールしたあとに働く。本人が落ちていたら助けられない */
function updateRescue(dt) {
  const r = G.people.find(function (q) { return q.type.rescue; });
  if (!r) return;
  if (r.rope) {
    const rp = r.rope, f = rp.f; rp.t += dt;
    const hx = r.x - 5, hy = r.y - 24;
    if (rp.t < 0.3) { rp.ex = lerp(hx, rp.x0, rp.t / 0.3); rp.ey = lerp(hy, rp.y0 - 14, rp.t / 0.3); }   // ひもを投げる
    else {
      const topY = Math.min(CTL, CTR) - CONFIG.rescueLift;
      const u = clamp((rp.t - 0.3) / CONFIG.rescueLiftT, 0, 1), e = u * u * (3 - 2 * u);                  // 落ちた x のまま 真上へ
      f.x = rp.x0; f.y = lerp(rp.y0, topY, e); rp.ex = f.x; rp.ey = f.y - 14;
      if (u >= 1) {
        f.state = 'air'; f.jumping = false; f.hopping = false; f.spring = false; f.y0 = f.y; f.dropFrom = undefined;
        f.vy = 0; f.vx = 0;
        f.tries = 0; f.idleT = 0; f.bestX = f.x; f.hesitated = false; f.pileT = 0; f.purunFly = false;
        popup(f.x, f.y - 30, lang === 'ja' ? 'それっ！' : 'Heave!', 13, '#fff', '#c8781a', 0.8, 26); se('hop', f.id);
        r.rope = null;
      }
    }
    return;
  }
  if (r.rescued || !((r.state === 'walk' && !r.climbing) || r.state === 'cheer')) return;
  let f = null, bd = r.state === 'cheer' ? 1e9 : CONFIG.rescueRope;   // ゴール済みなら ひもの距離の制限なし
  for (const q of G.people) {
    if (q === r || q.state !== 'pile' || (q.pileT || 0) < 0.9) continue;
    const d = Math.hypot(q.x - r.x, q.y - r.y);
    if (d < bd) { bd = d; f = q; }
  }
  if (!f) return;
  f.viaRope = true;
  r.rescued = true; r.rope = { f: f, t: 0, x0: f.x, y0: f.y, ex: r.x, ey: r.y - 24 };
  if (r.state === 'walk') r.pause = 1.3;
  f.state = 'rope';
  const b = clamp(Math.floor((f.x - L) / BUCKET_W), 0, BUCKETS - 1);
  G.pile[b] = Math.max(0, (G.pile[b] || 0) - 9); G.fell = Math.max(0, G.fell - 1); G.status[f.id] = 'walk';
  popup(r.x, r.y - 44 * r.sh, lang === 'ja' ? 'いま たすける！' : 'Hang on!', 13, '#fff', '#c8781a', 1.0, 22); se('say', r.id);
}
/* 跳ばし試作: いま押せるスライムに乗っている人ごとに、ぷるんで とぶ先を点線で見せる */
function drawPurunGuides(t) {
  if (!CONFIG.purunGuide || G.state !== 'walk') return;
  const g = CONFIG.personGravity;
  ctx.save();
  for (const p of G.people) {
    if (p.state !== 'walk' || p.climbing) continue;
    const u = slimeUnder(p);
    if (!u || !purunReady(u.s)) continue;
    const v = purunVel(p, u.s, u.k);
    let x = p.x, y = p.y - 8, vx = v.vx, vy = v.vy;
    const h = 1 / 30;
    for (let i = 0; i < 40; i++) {
      x += vx * h; vy += g * h; y += vy * h;
      if (x > W - 4 || y > FL) break;
      if (vy > 0) { const c = candidatesAt(x); if (c.some(function (cy) { return y >= cy && y - vy * h <= cy + 1; })) break; }
      if (i % 2) continue;
      ctx.globalAlpha = 0.85 * (1 - i / 44); ctx.fillStyle = '#fff'; circ(x, y, 2.6); ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = p.color; ctx.stroke();
    }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
/* ============================================================
   積み試作: 鳥とメダル
   鳥は左右から飛んでくる。高く とんだ人が ふれると、鳥の向きへ運ばれる。
   運ばれる時間は人の軽さしだい(軽いショートは遠くまで、重いトールは ちょっとだけ)。
   画面の右はしまで運ばれたらゴール、左はしまで運ばれたらスタートに もどる
   ============================================================ */
/* ゴールした人の並ぶ場所(先の人ほど奥)。小島のときは 小島の上に収まるよう間をつめる */
function finishTx(n) { return RC ? W - 10 - n * 9 : CONFIG.isleX1 - 5 - n * 11; }
function birdGoal(p) {
  p.state = 'finish'; p.cheerT = 0; p.y = CTR; p.x = CONFIG.goalX + 2; p.vx = 0; p.vy = 0;
  p.tx = finishTx(G.crossed);
  se('goal', G.crossed); G.crossed++; G.status[p.id] = 'ok';
  popup(p.x - 8, CTR - 44, '+1', 20, '#fff', PALETTE.ok, 0.9, 30);
  popup(p.x - 20, CTR - 70, lang === 'ja' ? 'とりさん ありがとう！' : 'Thanks, bird!', 12, '#fff', PALETTE.ink, 1.2, 20);
}
function birdHome(p) {
  p.state = 'walk'; p.x = CONFIG.startX; p.y = CTL; p.vx = 0; p.vy = 0; p.jumping = false; p.hopping = false; p.dropFrom = undefined;
  p.tries = 0; p.idleT = 0; p.bestX = p.x; p.hesitated = false; p.pause = 0.6;
  popup(p.x + 14, CTL - 44, lang === 'ja' ? 'もどされた〜' : 'Back to start…', 12, '#fff', PALETTE.ink, 1.2, 20); se('say', p.id);
}
function updateBirds(dt) {
  const C = CONFIG;
  for (const p of G.people) if (p.birdCool > 0) p.birdCool -= dt;
  if (!BIRDS_ON || !(G.state === 'prep' || G.state === 'walk' || G.state === 'result')) return;
  G.birdT -= dt;
  if (G.birdT <= 0 && G.birds.length < C.birdMax) {
    let y = rand(C.birdYMin, C.birdYMax);
    for (let k = 0; k < 6 && G.birds.some(function (b) { return Math.abs(b.y - y) < 24; }); k++) y = rand(C.birdYMin, C.birdYMax);
    const dir = Math.random() < 0.5 ? 1 : -1;
    G.birds.push({ x: dir > 0 ? -24 : W + 24, y: y, y0: y, dir: dir, ph: rand(0, 6), carry: null, t: 0 });
    G.birdT = C.birdEvery * rand(0.7, 1.3);
  }
  for (const b of G.birds) {
    b.ph += dt * (b.carry ? 18 : 11);
    b.x += b.dir * C.birdSpeed * dt;
    b.y = b.y0 + Math.sin(b.ph * 0.22) * 4;
    if (b.carry) {
      const p = b.carry;
      p.x = b.x; p.y = b.y + 12 + 34 * p.sh;
      b.t -= dt;
      if (b.dir > 0 && b.x >= W - 10) { b.carry = null; birdGoal(p); continue; }
      if (b.dir < 0 && b.x <= 10) { b.carry = null; birdHome(p); continue; }
      if (b.t <= 0) {
        p.state = 'air'; p.jumping = false; p.hopping = false; p.vy = 0; p.vx = b.dir * C.birdSpeed * 0.4;
        p.dropFrom = undefined; p.purunFly = true; p.birdCool = 0.7; p.y0 = p.y; b.carry = null;
        popup(p.x, p.y - 40 * p.sh, lang === 'ja' ? 'ぽいっ' : 'Drop!', 11, '#fff', PALETTE.ink, 0.7, 24);
      }
      continue;
    }
    if (G.state !== 'walk') continue;
    for (const p of G.people) {
      if (!(p.state === 'air' || (p.state === 'walk' && !p.climbing)) || p.birdCool > 0) continue;
      if (Math.abs(p.x - b.x) < 15 && b.y > p.y - 36 * p.sh - 8 && b.y < p.y + 6) {
        p.state = 'bird'; p.flew = true; p.viaBird = true; b.carry = p; b.t = C.birdCarry * (p.type.light || 1);
        popup(p.x, p.y - 44 * p.sh, lang === 'ja' ? (b.dir > 0 ? 'つかまった！ まえへ〜' : 'つかまった！ うしろへ〜') : 'Grabbed!', 12, '#fff', b.dir > 0 ? '#2a8f4d' : '#c2402a', 1.0, 22);
        se('say', p.id);
        break;
      }
    }
  }
  G.birds = G.birds.filter(function (b) { return b.carry || (b.x > -40 && b.x < W + 40); });
}
/* メダル: 人が ふれたら ゲット(鳥のいないステージでも) */
function updateMedal() {
  if (MEDAL && !G.medalGot && G.state === 'walk') for (const p of G.people) {
    if (!(p.state === 'air' || p.state === 'bird' || p.state === 'vine' || p.state === 'walk')) continue;
    if (MEDAL.walk && p.state !== 'walk') continue;
    if (Math.abs(p.x - MEDAL.x) < 16 && MEDAL.y > p.y - 36 * p.sh - 12 && MEDAL.y < p.y + 10) {
      G.medalGot = true; G.medals = G.medals || {}; G.medals[G.stage || 0] = true;
      popup(MEDAL.x, MEDAL.y - 26, lang === 'ja' ? 'メダル ゲット！' : 'Medal get!', 26, '#fff', '#c98a12', 1.8, 18);
      for (let i = 0; i < 44; i++) { const an = rand(0, Math.PI * 2), sp = rand(60, 260); G.particles.push({ x: MEDAL.x, y: MEDAL.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 80, r: rand(1.8, 4), life: rand(0.6, 1.3), age: 0, col: ['#ffd23f', '#fff6c8', '#ff8fd0', '#4aa8ff', '#4ecb71'][i % 5] }); }
      for (let i = 0; i < 14; i++) { const an = i / 14 * Math.PI * 2; G.particles.push({ x: MEDAL.x, y: MEDAL.y, vx: Math.cos(an) * 150, vy: Math.sin(an) * 150 - 700 * 0.0, r: 3, life: 0.35, age: 0, col: '#fff' }); }
      G.medalRing = { x: MEDAL.x, y: MEDAL.y, t: 0 };
      popup(p.x - 4, p.y - 46 * p.sh, lang === 'ja' ? 'やったー！' : 'Yay!', 14, '#fff', PALETTE.ink, 1.2, 26);
      for (const q of G.people) if (q !== p && (q.state === 'walk' || q.state === 'air' || q.state === 'cheer' || q.state === 'finish') && (q.sayCool || 0) <= 0) { q.sayCool = 0.9; popup(q.x - 4, q.y - 44 * q.sh, lang === 'ja' ? 'すごーい！' : 'Wow!', 12, '#fff', PALETTE.ink, 1.1, 26); break; }
      se('goal', 5);
      break;
    }
  }
}
function drawBird(b) {
  const f = Math.sin(b.ph);
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.dir, 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (b.carry) { ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.6; line(-3, 6, -4, 13); line(3, 6, 4, 13); }
  // うしろの羽
  ctx.beginPath(); ctx.moveTo(-4, -2); ctx.quadraticCurveTo(-8, -10 - 8 * f, -15, -6 - 12 * f); ctx.lineTo(2, -1); ctx.closePath();
  ctx.fillStyle = '#d9d2c4'; ctx.fill(); ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.4; ctx.stroke();
  // からだ
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-11, -1); ctx.lineTo(-18, -5); ctx.lineTo(-17, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
  // あたま・くちばし・目
  circ(10, -5, 6); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(15, -6); ctx.lineTo(21, -4); ctx.lineTo(15, -2); ctx.closePath(); ctx.fillStyle = '#f0a020'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = PALETTE.ink; circ(11.5, -6.5, 1.4); ctx.fill();
  // まえの羽
  ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-2, -12 - 10 * f, -10, -10 - 14 * f); ctx.lineTo(5, -1); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.restore();
}
function drawMedalRing() {
  const r = G.medalRing; if (!r) return;
  const k = r.t / 0.7;
  ctx.save(); ctx.globalAlpha = 0.9 * (1 - k); circ(r.x, r.y, 12 + 70 * k); ctx.lineWidth = 5 * (1 - k) + 1; ctx.strokeStyle = '#fff3a8'; ctx.stroke(); ctx.restore();
}
function drawBirds() { if (G.birds) for (const b of G.birds) drawBird(b); }
function drawMedalIcon(x, y, r, got) {
  ctx.save();
  if (got) {
    ctx.fillStyle = '#e04848'; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.95, y - r * 1.6); ctx.lineTo(x - r * 0.2, y - r * 1.6); ctx.lineTo(x, y - r * 0.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3d7be0'; ctx.beginPath(); ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.95, y - r * 1.6); ctx.lineTo(x + r * 0.2, y - r * 1.6); ctx.lineTo(x, y - r * 0.8); ctx.closePath(); ctx.fill();
  }
  circ(x, y, r); ctx.fillStyle = got ? '#ffd23f' : 'rgba(255,255,255,0.5)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = got ? PALETTE.ink : 'rgba(42,35,32,0.45)'; ctx.stroke();
  circ(x, y, r * 0.72); ctx.lineWidth = 1.2; ctx.strokeStyle = got ? '#c98a12' : 'rgba(42,35,32,0.3)'; ctx.stroke();
  txt(got ? '★' : '?', x, y + r * 0.42, r * 1.1, got ? '#fff' : 'rgba(42,35,32,0.5)', got ? { align: 'center', stroke: '#c98a12', sw: 2.5 } : { align: 'center' });
  ctx.restore();
}
function drawMedal(t) {
  if (!MEDAL || G.medalGot || !(G.state === 'prep' || G.state === 'walk')) return;
  const y = MEDAL.y + Math.sin(t * 3) * 3, sq = Math.abs(Math.cos(t * 1.6));
  ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5); circ(MEDAL.x, y, 18); ctx.fillStyle = '#fff6c8'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(MEDAL.x, y); ctx.scale(0.35 + 0.65 * sq, 1); drawMedalIcon(0, 0, 10, true); ctx.restore();
}
/* 結果画面のメダル欄(左上)。とれたときだけ、ぽんと入って光のすじが回り、紙ふぶきが舞う。とれなかったときは何も出さない */
function drawMedalResult(y) {
  if (!MEDAL || !G.medalGot) return;
  const T = G.resultT - 0.55;
  if (T <= 0) return;
  const cx = 72, u = clamp(T / 0.45, 0, 1);
  const sc = u < 1 ? (u < 0.6 ? 3.2 - 2.2 * (u / 0.6) : 1 + 0.3 * Math.sin(Math.PI * (u - 0.6) / 0.4)) : 1 + 0.05 * Math.sin(T * 6);
  // うしろの光のすじ(回る)
  ctx.save(); ctx.translate(cx, y); ctx.rotate(T * 0.9); ctx.globalAlpha = 0.55 * clamp(T / 0.3, 0, 1);
  for (let i = 0; i < 10; i++) {
    const an = i * Math.PI / 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 38, an - 0.13, an + 0.13); ctx.closePath();
    ctx.fillStyle = i % 2 ? '#fff6c8' : '#ffd23f'; ctx.fill();
  }
  ctx.restore();
  // 広がる光の輪(最初だけ)
  if (T < 0.7) { ctx.save(); ctx.globalAlpha = 0.8 * (1 - T / 0.7); circ(cx, y, 20 + 34 * (T / 0.7)); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore(); }
  // メダル本体
  ctx.save(); ctx.globalAlpha = clamp(T / 0.15, 0, 1); ctx.translate(cx, y); ctx.scale(sc, sc);
  drawMedalIcon(0, 0, 22, true);
  ctx.restore();
  // 紙ふぶき(パネルの上から ひらひら。数字や文字の列には かからない左がわだけ)
  const cols = ['#ff6b6b', '#ffd23f', '#4ecb71', '#4aa8ff', '#ff8fd0'];
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const t0 = 0.15 + (i % 13) * 0.05, k = T - t0;
    if (k < 0 || k > 2.2) continue;
    const ph = i * 2.399, x = cx + Math.sin(ph) * 40 + Math.sin(k * 4 + ph) * 8, yy = y - 36 + k * 70 + (i % 3) * 4;
    if (yy > y + 44) continue;
    ctx.globalAlpha = clamp((2.2 - k) * 1.5, 0, 1); ctx.fillStyle = cols[i % 5];
    ctx.save(); ctx.translate(x, yy); ctx.rotate(k * 6 + ph); ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
  }
  ctx.restore();
  if (u >= 1) txt(lang === 'ja' ? 'メダル ゲット！' : 'Medal get!', cx, y + 42, 12, '#c98a12', { align: 'center', weight: 800, stroke: '#fff', sw: 4 });
}
function drawRope() {
  const r = G.people.find(function (q) { return q.type.rescue && q.rope; });
  if (!r) return;
  const rp = r.rope, hx = r.x - 5, hy = r.y - 20 * r.sh;
  ctx.save(); ctx.lineCap = 'round';
  const path = function () { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + rp.ex) / 2 - 8, (hy + rp.ey) / 2 + 10, rp.ex, rp.ey); };
  path(); ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 4; ctx.stroke();
  path(); ctx.strokeStyle = '#e9c27a'; ctx.lineWidth = 2.2; ctx.setLineDash([4, 3]); ctx.stroke();
  ctx.restore();
}
/* 積み試作: スライムAがスライムBの上に乗っているか(Aのどこかが、Bの面のすぐ上に触れている) */
function restsOn(A, B) {
  const a = A.bb || bboxOf(A.pts), b = B.bb || bboxOf(B.pts), m = 16;
  if (a.x1 < b.x0 - m || b.x1 < a.x0 - m || a.y1 < b.y0 - m || b.y1 < a.y0 - m) return false;
  const lim = (A.thick + B.thick) / 2 + 3;
  for (let i = 0; i < A.pts.length; i += 2) {
    const q = A.pts[i];
    for (let j = 0; j < B.pts.length - 1; j++) {
      const u = B.pts[j], v = B.pts[j + 1];
      closestOnSeg(q.x, q.y, u.x, u.y, v.x, v.y);
      if (_cy > q.y + 2 && Math.hypot(q.x - _cx, q.y - _cy) <= lim) return true;
    }
  }
  return false;
}
/* 積み試作: 固まったスライムごとの「だん」。谷底・崖に じかに乗っていれば1、スライムに乗っていれば その下の だん+1 */
let _stackKey = '', _stackMemo = null, _stackCovered = new Set();
function stackLayers() {
  const fx = G.slimes.filter(function (q) { return q.state === 'fixed'; });
  const key = fx.length + ':' + G.slimes.length + ':' + Math.floor(G.clock * 4);
  if (key === _stackKey && _stackMemo) return _stackMemo;
  for (const q of fx) if (!q.bb) q.bb = bboxOf(q.pts);
  const under = new Map();
  for (const A of fx) under.set(A, fx.filter(function (B) { return B !== A && restsOn(A, B); }));
  const memo = new Map(), busy = new Set();
  const lay = function (A) {
    if (memo.has(A)) return memo.get(A);
    if (busy.has(A)) return 1;
    busy.add(A);
    let n = 1;
    for (const B of under.get(A) || []) n = Math.max(n, 1 + lay(B));
    busy.delete(A); memo.set(A, n);
    return n;
  };
  for (const A of fx) lay(A);
  const cov = new Set();   // 上に別のスライムが乗っているもの(てっぺんではない)
  for (const A of fx) for (const B of under.get(A) || []) cov.add(B);
  _stackKey = key; _stackMemo = memo; _stackCovered = cov;
  return memo;
}
/* 積みの てっぺん(上に何も乗っていない)か。準備中の ▲ は てっぺんだけに出す */
function isStackTop(s) { stackLayers(); return !_stackCovered.has(s); }
/* ============================================================
   えだの たに: 枝は壁から突き出た短い棒。スライムは ひっかかって止まり(地形あつかい)、人は上を歩ける。
   くもは空を ゆっくり往復する。人だけが乗れて(スライムは すりぬける)、乗ると ゆっくり運ばれる
   ============================================================ */
function makeBranches(list) {
  const C = CONFIG;
  BRANCHES = (list || C.branches).map(function (q) {
    const side = q[0], y = q[1], len = q[2], wx = side < 0 ? L : R, tx = wx - side * len;
    return { side: side, ax: wx, ay: y, bx: tx, by: y - C.branchTip, r: C.branchR, x0: Math.min(wx, tx), x1: Math.max(wx, tx) };
  });
}
function branchTop(b, x) { return b.ay + (b.by - b.ay) * (x - b.ax) / (b.bx - b.ax) - b.r; }
function makeClouds() {
  CLOUDS = CONFIG.clouds.map(function (q, i) { return { top: q[0], w: q[1], xa: q[2], xb: q[3], per: q[4], t0: G.clock, x: q[2], dx: 0, x0: q[2] - q[1] / 2, x1: q[2] + q[1] / 2, rider: null, left: 0, gone: false }; });
}
/* くも: 人が乗ったら右へ進み(1つの くもに1人)、軽さで決まる距離を運んだら ぽふっと消える */
function poofCloud(c, drop) {
  c.gone = true;
  const p = c.rider; c.rider = null;
  for (let i = 0; i < 14; i++) G.particles.push({ x: c.x + rand(-c.w / 2, c.w / 2), y: c.top + rand(-4, 12), vx: rand(-50, 50), vy: rand(-60, 10), r: rand(3, 6), life: rand(0.4, 0.8), age: 0, col: 'rgba(255,255,255,0.95)' });
  popup(c.x, c.top - 14, lang === 'ja' ? 'ぽふっ' : 'Poof', 13, '#fff', '#5b8fd6', 0.8, 22); se('miss');
  if (p && drop && p.state === 'walk') {
    p.state = 'air'; p.jumping = false; p.hopping = false; p.spring = false; p.y0 = p.y; p.dropFrom = undefined; p.vy = 0; p.vx = 30;
    p.tries = 0; p.idleT = 0; p.bestX = p.x; p.hesitated = false; p.onCloud = null;
    popup(p.x - 4, p.y - 36 * p.sh, i18n('oops'), 12, '#fff', PALETTE.ink, 0.7, 24);
  }
}
function updateClouds(dt) {
  const C = CONFIG;
  for (const c of CLOUDS) {
    if (c.gone) continue;
    if (c.rider) {
      const p = c.rider;
      if (p.state !== 'walk' || Math.abs(p.y - c.top) > 2.5 || p.x < c.x0 - 6 || p.x > c.x1 + 6) { poofCloud(c, false); continue; }   // 乗っていた人が いなくなった
      const step = Math.min(C.cloudSpeed * dt, c.left);
      c.dx = step; c.x += step; c.x0 += step; c.x1 += step; c.left -= step;
      p.x += step; p.onCloud = c; p.idleT = 0;
      if (c.left <= 0.01) poofCloud(c, true);                 // 運びきった: 人は落ちる
      else if (p.x >= R + 2) poofCloud(c, true);              // 右の崖の上に着いた: くもは消えて、人は崖へ おりる
      continue;
    }
    const u = 0.5 - 0.5 * Math.cos((G.clock - c.t0) / c.per * Math.PI * 2);
    const nx = c.xa + (c.xb - c.xa) * u;
    c.dx = nx - c.x; c.x = nx; c.x0 = nx - c.w / 2; c.x1 = nx + c.w / 2;
    for (const p of G.people) {
      if (p.state !== 'walk' || p.viaCloud || Math.abs(p.y - c.top) > 1.5 || p.x < c.x0 - 3 - c.dx || p.x > c.x1 + 3 - c.dx) continue;
      p.x += c.dx; p.onCloud = c; p.idleT = 0;
      c.rider = p; c.left = C.cloudCarry * (p.type.light || 1); p.viaCloud = true;
      popup(p.x, p.y - 40 * p.sh, lang === 'ja' ? 'ふわ〜' : 'Floaty~', 12, '#fff', '#5b8fd6', 0.9, 20);
      break;
    }
  }
}
/* ============================================================
   ステージ3「イガの くだり」: つる。空中の人が持ち手に ふれると つかまり、いつも おなじ振れ方で右へ運ばれ、
   決まった所で手をはなして右の崖の上へ おりる。1度に1人。スライムは すりぬける
   ============================================================ */
/* ============================================================
   準備中の見本: 小さな葉っぱが、そのステージの仕掛けに運ばれる様子をくり返し見せる(見た目だけ。人と同じ計算)
   ============================================================ */
function leafKind() { return CLOUDS.length ? 'cloud' : (WIND && WIND.cyc ? 'wind' : (VINE ? 'vine' : null)); }
function spawnLeaf() {
  const kind = leafKind(); if (!kind) return;
  const L0 = { kind: kind, x: 0, y: 0, vx: 0, vy: 0, rot: 0, age: 0, state: 'fall', carried: 0, fade: 0, isLeaf: true, sh: 0.3, cloud: null };
  if (kind === 'cloud') {
    const c = CLOUDS.reduce(function (a, b) { return a.top > b.top ? a : b; });
    if (c.dx < 0.6 || c.x > c.xb - 130 || c.x < c.xa - 1) return;   // くもが右へ進んでいる間だけ
    L0.x = c.x - 6; L0.y = c.top - 70; L0.vx = c.dx * 60; L0.cloud = c;
  } else if (kind === 'wind') {
    const wp = windPhase(); if (wp.ph !== 'blow' || wp.u > 0.12) return;   // ふき始めに、ふわっと あらわれて 巻き上げられる
    L0.x = WIND.x0 + 10; L0.y = 440;
  } else {
    const h = vineHandle(); L0.x = h.x - 2; L0.y = h.y - 90;
  }
  G.leaf = L0;
}
function updateLeaf(dt) {
  if (!CONFIG.leafDemo || G.state !== 'prep') { if (G.leaf && G.state !== 'prep') G.leaf = null; return; }
  const lf = G.leaf, g = CONFIG.personGravity;
  if (!lf) { if (G.clock >= (G.leafAt || 0)) { spawnLeaf(); if (!G.leaf) G.leafAt = G.clock + 0.03; } return; }
  lf.age += dt; lf.rot += dt * 3;
  const end = function () { G.leaf = null; G.leafAt = G.clock + CONFIG.leafEvery; };
  if (lf.state === 'done') { lf.fade += dt * 3; if (lf.fade >= 1) end(); return; }
  if (lf.state === 'vine') { lf.rot = Math.sin(lf.age * 4) * 0.4; return; }   // つる(updateVine)が動かす
  if (lf.kind === 'cloud' && lf.state === 'ride') {
    const c = lf.cloud;
    if (c.dx <= 0.05 || lf.carried >= CONFIG.cloudCarry) { lf.state = 'fall'; lf.vx = 30; lf.vy = 0; return; }   // 運ぶ距離は ふつうの人(1.0)と同じ
    lf.x += c.dx; lf.y = c.top; lf.carried += c.dx; lf.rot = 0.15 * Math.sin(lf.age * 3); return;
  }
  // 落ちる・飛ぶ(人と同じ重力・かぜ)
  lf.vy += g * dt;
  if (lf.kind === 'wind' && WIND && windOn() && lf.x >= WIND.x0 && lf.x <= WIND.x1 && lf.y >= WIND.top && lf.y < floorAt(lf.x) + 2) {
    lf.vy -= WIND.lift * g * dt;
    if (lf.vy < -WIND.rise) lf.vy = -WIND.rise;
    lf.vx = Math.min(lf.vx + WIND.drift * dt, WIND.dmax);
  }
  lf.x += lf.vx * dt; lf.y += lf.vy * dt;
  if (lf.kind === 'cloud' && lf.state === 'fall' && lf.cloud && lf.vy > 0 && lf.y >= lf.cloud.top && lf.y < lf.cloud.top + 14 && Math.abs(lf.x - lf.cloud.x) < lf.cloud.w / 2 - 4 && lf.carried === 0) { lf.state = 'ride'; lf.y = lf.cloud.top; lf.vx = 0; lf.vy = 0; return; }
  if (lf.y >= CTR && lf.x >= R && lf.vy > 0 && lf.kind !== 'cloud') { lf.state = 'done'; lf.vy = 0; lf.vx = 0; lf.y = CTR; return; }   // 右の崖の上に おりた
  if (RC && lf.x > R - 10 && lf.x < R && lf.y > CTR && lf.kind === 'wind') lf.x = R - 10;   // 崖の壁
  if (lf.y >= FL - 8 || lf.age > 8) { lf.state = 'done'; lf.vx = 0; lf.vy = 0; }
}
function drawLeaf(t) {
  const lf = G.leaf; if (!lf || G.state !== 'prep') return;
  const a = clamp(lf.age / 0.4, 0, 1) * (1 - clamp(lf.fade, 0, 1));
  ctx.save(); ctx.globalAlpha = a * 0.9; ctx.translate(lf.x, lf.y - 3); ctx.rotate(lf.rot + (lf.state === 'fall' ? Math.sin(lf.age * 7) * 0.5 : 0));
  ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 3, 0, 0, Math.PI * 2); ctx.fillStyle = '#7bd35a'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.lineWidth = 0.8; ctx.strokeStyle = '#3f8f3f'; ctx.stroke();
  ctx.restore();
}
let VINE = null;
function makeVine() { const q = CONFIG.vine; VINE = { px: q[0], py: q[1], len: q[2], ang: 0, state: 'idle', t: 0, holder: null, ph: 0 }; }
function vineHandle() { return { x: VINE.px + VINE.len * Math.sin(VINE.ang), y: VINE.py + VINE.len * Math.cos(VINE.ang) }; }
function updateVine(dt) {
  const V = VINE; if (!V) return;
  const C = CONFIG;
  if (V.state === 'idle') {
    V.ang = 0.03 * Math.sin(G.clock * 1.3);
    const lf = G.leaf;
    if (lf && lf.kind === 'vine' && lf.state === 'fall' && G.state === 'prep') {   // 準備中の見本: 葉っぱが持ち手に ひっかかる
      const h0 = vineHandle();
      if (Math.hypot(lf.x - h0.x, lf.y - h0.y) <= CONFIG.vineGrab) { V.state = 'swing'; V.t = 0; V.holder = lf; lf.state = 'vine'; return; }
    }
    if (G.state !== 'walk') return;
    const h = vineHandle();
    for (const p of G.people) {
      if (p.state !== 'air' || p.hurt) continue;
      if (Math.hypot(p.x - h.x, p.y - 16 * p.sh - h.y) <= C.vineGrab + 6 * p.sh) {
        V.state = 'swing'; V.t = 0; V.holder = p; p.state = 'vine'; p.viaVine = true; p.flew = true; p.vx = 0; p.vy = 0; p.jumping = false; p.hopping = false; p.purunFly = false;
        popup(p.x - 6, p.y - 44 * p.sh, lang === 'ja' ? 'つかまった！' : 'Got it!', 12, '#fff', '#3f8f3f', 0.9, 24); se('say', p.id);
        break;
      }
    }
  } else if (V.state === 'swing') {
    V.t += dt;
    const u = clamp(V.t / C.vineT, 0, 1), e = Math.sin(u * Math.PI / 2);   // いつも おなじ動き
    V.ang = C.vineAng * e;
    const p = V.holder, h = vineHandle();
    if (p) { p.x = h.x; p.y = h.y + 20 * p.sh; }
    if (u >= 1 && p && p.isLeaf) { p.state = 'fall'; p.vx = C.vineVx; p.vy = 0; V.holder = null; V.state = 'back'; V.t = 0; }
    else if (u >= 1) {
      if (p) { p.state = 'air'; p.jumping = false; p.hopping = false; p.spring = false; p.y0 = p.y; p.dropFrom = undefined; p.vx = C.vineVx; p.vy = 0; p.tries = 0; p.idleT = 0; p.bestX = p.x; p.hesitated = false; p.windSaid = false; popup(p.x, p.y - 40 * p.sh, lang === 'ja' ? 'えいっ！' : 'Hup!', 12, '#fff', PALETTE.ink, 0.8, 24); }
      V.holder = null; V.state = 'back'; V.t = 0;
    }
  } else {
    V.t += dt;
    const u = clamp(V.t / 0.9, 0, 1); V.ang = C.vineAng * (1 - u * u * (3 - 2 * u));
    if (u >= 1) { V.state = 'idle'; V.ang = 0; }
  }
}
function drawVine(t) {
  const V = VINE; if (!V) return;
  const h = vineHandle();
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 支点の枝
  ctx.fillStyle = '#8a6a48'; ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.6;
  rr(V.px - 14, V.py - 8, 28, 10, 4); ctx.fill(); ctx.stroke();
  // つる(ゆるく波うつ)
  const wob = V.state === 'idle' ? 0 : 1;
  const path = function () { ctx.beginPath(); ctx.moveTo(V.px, V.py); for (let i = 1; i <= 10; i++) { const k = i / 10, x = V.px + (h.x - V.px) * k + Math.sin(k * 6 + t * 2) * 2.2 * wob * k, y = V.py + (h.y - V.py) * k; ctx.lineTo(x, y); } };
  path(); ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 5; ctx.stroke();
  path(); ctx.strokeStyle = '#59b04a'; ctx.lineWidth = 3; ctx.stroke();
  // 持ち手の葉っぱ
  ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(V.ang);
  ctx.beginPath(); ctx.ellipse(0, 6, 9, 14, 0, 0, Math.PI * 2); ctx.fillStyle = '#7bd35a'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 18); ctx.lineWidth = 1.2; ctx.strokeStyle = '#3f8f3f'; ctx.stroke();
  ctx.restore();
  if (V.state === 'idle' && G.state !== 'title') { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4); txt(lang === 'ja' ? 'つかまれ' : 'Grab!', h.x, h.y + 34, 9, '#fff', { align: 'center', stroke: PALETTE.ink, sw: 3, weight: 800 }); }
  ctx.restore();
}
/* ============================================================
   ステージ3: ふうせん。落ちてきた(動かしている)スライムが ふうせんに ふれたら、その場で のって止まる。
   空の たこ: 持ち手に ふれた人は たこに つかまり、すいーっと前へ飛んで ゆっくり おりる
   ============================================================ */
const BALLOON_COLS = ['#ff6b7d', '#ffc23d', '#5fb6ff'];
function makeBalloons() {
  BALLOONS = CONFIG.balloons.map(function (q, i) { return { x: q[0], y: q[1], r: CONFIG.balloonR, col: BALLOON_COLS[i % BALLOON_COLS.length], ph: i * 1.9 }; });
}
function balloonHit(s) {
  const r = s.thick / 2;
  for (const b of BALLOONS) for (const q of s.pts) if (Math.hypot(q.x - b.x, q.y - b.y) <= b.r + r) return b;
  return null;
}
function drawBalloons(t) {
  for (const b of BALLOONS) {
    const y = b.y + Math.sin(t * 1.6 + b.ph) * 1.2;
    ctx.save();
    ctx.strokeStyle = 'rgba(60,50,60,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x, y + b.r + 3);
    for (let k = 1; k <= 6; k++) ctx.lineTo(b.x + Math.sin(t * 2 + k + b.ph) * 2.5, y + b.r + 3 + k * 6);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(b.x, y, b.r * 0.92, b.r, 0, 0, Math.PI * 2); ctx.fillStyle = b.col; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x - 3, y + b.r + 4); ctx.lineTo(b.x + 3, y + b.r + 4); ctx.lineTo(b.x, y + b.r - 1); ctx.closePath(); ctx.fillStyle = b.col; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.35, y - b.r * 0.4, b.r * 0.22, b.r * 0.32, -0.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
    ctx.restore();
  }
}
function makeKite() {
  const k = CONFIG.kite;
  KITE = { xa: k[0], xb: k[1], y0: k[2], per: k[3], t0: G.clock, x: k[0], y: k[2], holder: null, back: 0 };
}
function kiteHand(K) { return { x: K.x, y: K.y + 34 }; }
function releaseKite(p) {
  if (KITE && KITE.holder === p) { KITE.holder = null; KITE.back = 1; }
  p.glide = null;
}
function updateKite(dt) {
  const K = KITE;
  if (!K) return;
  const C = CONFIG;
  if (K.holder) {
    const p = K.holder;
    if (p.state !== 'air') releaseKite(p);
    else { K.x = p.x + 6; K.y = p.y - 36 * p.sh - 30; return; }
  }
  const u = 0.5 - 0.5 * Math.cos((G.clock - K.t0) / K.per * Math.PI * 2);
  const tx = K.xa + (K.xb - K.xa) * u, ty = K.y0 + Math.sin(G.clock * 1.3) * 5;
  if (K.back > 0) { K.back = Math.max(0, K.back - dt * 0.5); K.x += (tx - K.x) * Math.min(1, dt * 2); K.y += (ty - K.y) * Math.min(1, dt * 2); }
  else { K.x = tx; K.y = ty; }
  if (G.state !== 'walk' || K.back > 0.6) return;
  const h = kiteHand(K);
  for (const p of G.people) {
    if (!(p.state === 'air' || (p.state === 'walk' && !p.climbing)) || p.glide) continue;
    if (Math.abs(p.x - h.x) < 14 && h.y > p.y - 36 * p.sh - 10 && h.y < p.y + 6) {
      K.holder = p; p.glide = K; p.glideT = 0; p.viaKite = true;
      p.state = 'air'; p.jumping = true; p.hopping = false; p.spring = false; p.y0 = p.y; p.dropFrom = undefined; p.pause = 0;
      p.vy = -60; p.vx = C.kiteVx; p.flew = true; p.purunFly = true; p.tries = 0; p.idleT = 0; p.hesitated = false;
      popup(p.x, p.y - 44 * p.sh, lang === 'ja' ? 'たこに つかまった！' : 'Kite ride!', 12, '#fff', '#3b7fc4', 1.0, 22);
      se('say', p.id);
      break;
    }
  }
}
function drawKite(t) {
  const K = KITE;
  if (!K) return;
  const x = K.x, y = K.y, sw = Math.sin(t * 3) * 0.12;
  ctx.save();
  // ひも
  const hx = K.holder ? K.holder.x + 4 : x, hy = K.holder ? K.holder.y - 30 * K.holder.sh : y + 34;
  ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.quadraticCurveTo(x + 6, (y + hy) / 2 + 6, hx, hy); ctx.stroke();
  if (!K.holder) { circ(hx, hy, 3.2); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke(); }
  // しっぽ
  ctx.strokeStyle = '#d9487a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 14);
  for (let k = 1; k <= 5; k++) ctx.lineTo(x - k * 6, y + 14 + Math.sin(t * 6 + k) * 4 + k * 2); ctx.stroke();
  // 本体(ひし形)
  ctx.translate(x, y); ctx.rotate(sw);
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 0); ctx.lineTo(0, 14); ctx.lineTo(-12, 0); ctx.closePath();
  ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 14); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = '#ff6b7d'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(-12, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = '#ff6b7d'; ctx.fill();
  ctx.restore();
}

function drawBranches() {
  for (const b of BRANCHES) {
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = b.r * 2 + 3; line(b.ax, b.ay, b.bx, b.by);
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = b.r * 2; line(b.ax, b.ay, b.bx, b.by);
    ctx.strokeStyle = '#b07a42'; ctx.lineWidth = 2; line(b.ax, b.ay - b.r * 0.4, b.bx, b.by - b.r * 0.4);
    // 先の葉っぱ
    const lx = b.bx, ly = b.by;
    for (let k = 0; k < 3; k++) {
      const ax = lx - b.side * (4 + k * 7), ay = ly - 7 + (k % 2) * 3;
      ctx.beginPath(); ctx.ellipse(ax, ay, 6, 3.4, -b.side * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = k % 2 ? '#5fae4a' : '#74c25a'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    }
    ctx.restore();
  }
}
/* くも1つ分(中心 x, y・はば w)。ゲーム中の くもと、結果の「くも」アイコンで同じ描き方を使う */
function drawCloudBody(x, y, w, lw, fs) {
  lw = lw || 1.6; fs = fs || 1;
  ctx.save();
    ctx.fillStyle = 'rgba(60,80,120,0.12)'; ctx.beginPath(); ctx.ellipse(x, y + 12, w * 0.46, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + 2, w / 2, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.2, y - 3, w * 0.22, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.16, y - 4, w * 0.2, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(x, y + 2, w / 2 - 1.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - w * 0.2, y - 3, w * 0.22 - 1.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.16, y - 4, w * 0.2 - 1.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    // 顔(乗れるもの、と分かるように)
    fgDot(x - 6 * fs, y + 2, 1.4 * fs); fgDot(x + 6 * fs, y + 2, 1.4 * fs);
    ctx.beginPath(); ctx.arc(x, y + 4, 3 * fs, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = lw * 0.75; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.restore();
}
function drawClouds(t) {
  for (const c of CLOUDS) {
    if (c.gone) continue;
    const x = c.x, y = c.top + 6, w = c.w;
    drawCloudBody(x, y, w);
    ctx.save();
    // 進む向きの矢じるし
    const dir = c.dx >= 0 ? 1 : -1;
    ctx.globalAlpha = 0.55; txt(dir > 0 ? '›' : '‹', x + dir * (w / 2 + 7), y + 6, 14, PALETTE.ink, { align: 'center', weight: 800 });
    ctx.restore();
  }
}

function stackOf(s) { const n = stackLayers().get(s) || 1; return SAW && s.onSaw && !s.plank ? Math.max(1, n - 1) : n; }

/* ============================================================
   ステージ3: シーソー。板は「動かないスライム」として G.slimes に入れる(人もスライムも そのまま乗れる)。
   板に乗ったスライム(積んだものも)と人の重さで傾きが決まり、乗っているものは板といっしょに回る。
   板が すばやく持ち上がると、乗っている人が とばされる
   ============================================================ */
function makeSaw() {
  const C = CONFIG, pts = [];
  for (let x = -C.sawHalf; x <= C.sawHalf + 0.01; x += 5) pts.push({ x: C.sawX + x, y: C.sawY });
  const s = { pts: pts, thick: 12, state: 'fixed', ci: 0, born: 0, stuckAt: -99, face: Math.floor(pts.length / 2), bb: bboxOf(pts), vy: 0, ghost: null, blob: false, purunAt: -99, riders: 0, len: 0, plank: true, onSaw: true, sawChecked: true };
  SAW = { s: s, a: 0, w: 0, hitT: -9 };
  G.slimes.push(s);
}
function sawOn(s) { return !!(s && s.onSaw); }
/* 新しく固まったスライムが板(か板に乗ったスライム)に乗っているか。谷底に触れているものは別 */
function sawClassify() {
  for (const s of G.slimes) {
    if (s.state !== 'fixed') { s.sawChecked = false; continue; }
    if (s.sawChecked) continue;
    s.sawChecked = true; s.onSaw = false; s.bb = bboxOf(s.pts);
    if (s.pts.some(function (q) { return terrainHit(q.x, q.y, s.thick / 2 + 1.5); })) continue;
    for (const o of G.slimes) if (o !== s && o.onSaw && o.state === 'fixed' && restsOn(s, o)) { s.onSaw = true; break; }
  }
}
function rotPt(q, cx, cy, cs, sn) { const rx = q.x - cx, ry = q.y - cy; q.x = cx + rx * cs - ry * sn; q.y = cy + rx * sn + ry * cs; }
function sawLaunch(p, V) {
  p.state = 'air'; p.jumping = true; p.hopping = false; p.spring = false; p.y0 = p.y; p.dropFrom = undefined; p.pause = 0;
  p.vy = -V; p.vx = p.speed + V * CONFIG.sawFwd; p.flew = true; p.purunFly = true; p.sawV = 0;
  p.tries = 0; p.idleT = 0; p.hesitated = false;
  popup(p.x, p.y - 40 * p.sh, lang === 'ja' ? (V > 450 ? 'びよーん！' : 'わっ') : 'Fwoosh!', 13, '#fff', '#b4570a', 0.9, 26); se('hop', p.id);
}
function updateSaw(dt) {
  if (!SAW) return;
  const C = CONFIG, cx = C.sawX, cy = C.sawY;
  sawClassify();
  // 重さ × 支点からの距離
  let tq = 0;
  for (const s of G.slimes) if (s.onSaw && !s.plank && s.state === 'fixed') { const c = centroidOf(s.pts); tq += s.len * (c.x - cx); }
  const riders = [];
  for (const p of G.people) {
    if (p.state !== 'walk' || p.climbing) continue;
    const u = slimeUnder(p);
    if (u && sawOn(u.s)) { riders.push(p); tq += C.personKg / (p.type.light || 1) * (p.x - cx); }
  }
  const target = clamp(tq * C.sawK, -C.sawMax, C.sawMax);
  SAW.w += ((target - SAW.a) * C.sawSpring - SAW.w * C.sawDamp) * dt;
  let na = SAW.a + SAW.w * dt, stop = false;
  if (na > C.sawMax) { na = C.sawMax; stop = Math.abs(SAW.w) > 1.2; SAW.w = 0; }
  if (na < -C.sawMax) { na = -C.sawMax; stop = Math.abs(SAW.w) > 1.2; SAW.w = 0; }
  const da = na - SAW.a;
  if (stop) { SAW.hitT = G.clock; G.shake = Math.max(G.shake, 3); se('land'); }
  if (Math.abs(da) < 1e-6) { for (const p of riders) p.sawV = 0; return; }
  SAW.a = na;
  const cs = Math.cos(da), sn = Math.sin(da);
  for (const s of G.slimes) if (s.onSaw && s.state === 'fixed') { for (const q of s.pts) rotPt(q, cx, cy, cs, sn); s.bb = bboxOf(s.pts); }
  // 乗っている人は板といっしょに上下する。すばやく持ち上がったあと、止まりかけたところで とばされる
  for (const p of riders) {
    const dy = (p.x - cx) * sn + (p.y - cy) * (cs - 1), v = dy / dt;
    p.y += dy;
    if (v < (p.sawV || 0)) p.sawV = v;
    const fast = (p.sawV || 0) < -C.sawLaunchMin;
    if (fast && (stop || v > p.sawV * 0.6)) sawLaunch(p, -p.sawV * C.sawLaunch * Math.sqrt(p.type.light || 1));
  }
  for (const p of G.people) if (riders.indexOf(p) < 0) p.sawV = 0;
}
/* 歩いているときに板をタップ: タップした側が どすんと下がり、反対側が はね上がる */
function sawTap(x, y) {
  if (!SAW) return false;
  const P = SAW.s.pts, a = P[0], b = P[P.length - 1];
  if (segDist(x, y, a.x, a.y, b.x, b.y) > 26) return false;
  if (G.clock - (SAW.tapAt || -9) < CONFIG.sawTapCool) { se('short'); return true; }
  SAW.tapAt = G.clock;
  const side = x >= CONFIG.sawX ? 1 : -1;
  SAW.w += side * CONFIG.sawTapW;
  // 反対側に乗っている人を とばす(はしにいるほど高く。軽い人ほど高く)
  for (const p of G.people) {
    if (p.state !== 'walk' || p.climbing || (p.x - CONFIG.sawX) * side >= 0) continue;
    const u = slimeUnder(p);
    if (!u || !sawOn(u.s)) continue;
    const arm = Math.min(1, Math.abs(p.x - CONFIG.sawX) / CONFIG.sawHalf);
    sawLaunch(p, CONFIG.sawTapV * (0.35 + 0.65 * arm) * Math.sqrt(p.type.light || 1));
  }
  se('purun'); G.shake = Math.max(G.shake, 2);
  if (G.state === 'walk') G.purunN = (G.purunN || 0) + 1;
  popup(x, y - 18, lang === 'ja' ? 'どすん！' : 'Thump!', 15, '#fff', '#8a5a2b', 0.8, 24);
  return true;
}
function drawSawPlank(s) {
  const P = s.pts, a = P[0], b = P[P.length - 1], th = s.thick;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = th + 3; line(a.x, a.y, b.x, b.y);
  ctx.strokeStyle = '#c99a5b'; ctx.lineWidth = th; line(a.x, a.y, b.x, b.y);
  ctx.strokeStyle = '#e2bd84'; ctx.lineWidth = 3; line(a.x, a.y - th * 0.22, b.x, b.y - th * 0.22);
  const C = CONFIG; circ(C.sawX, C.sawY, 5); ctx.fillStyle = PALETTE.ink; ctx.fill();
  ctx.restore();
}

/* ステージ2: 高いところから落ちてスライムに着地 → 落ちた高さのぶん はね返る */
function dropBounce(p) {
  if (!BOUNCE_ON || p.peakY === undefined) return false;
  const C = CONFIG, fall = p.y - p.peakY;
  if (fall < C.dropMin) return false;
  const u = slimeUnder(p);
  if (!u) return false;
  const s = u.s, sk = shapeOf(s);
  const h = Math.min(C.dropMaxH, fall * C.dropKeep * purunPower(s));   // 積んだ ▲ と ジグザグで もっと はねる
  let xa = p.x - 12, xb = p.x + 12, ya = slimeTopAt(s, xa), yb = slimeTopAt(s, xb);
  if (ya === null) { xa = p.x; ya = slimeTopAt(s, xa); }
  if (yb === null) { xb = p.x; yb = slimeTopAt(s, xb); }
  const k = (ya !== null && yb !== null && xb > xa) ? clamp((yb - ya) / (xb - xa), -3, 3) : 0;
  const V = Math.sqrt(2 * C.personGravity * h), kf = Math.max(0, k), nl = Math.hypot(kf, 1);
  p.state = 'air'; p.jumping = true; p.hopping = false; p.spring = false; p.y0 = p.y; p.dropFrom = undefined; p.pause = 0;
  p.vy = -V / nl; p.vx = p.speed + V * C.dropFwd + V * kf / nl * C.purunSide;
  p.flew = true; p.purunFly = true; p.peakY = p.y; p.tries = 0; p.idleT = 0; p.hesitated = false;
  s.purunAt = G.clock; se('purun');
  popup(p.x, p.y - 40 * p.sh, h > 160 ? (lang === 'ja' ? 'ぼよーん！' : 'Boing!') : (lang === 'ja' ? 'ぼよん' : 'Boing'), 13, '#fff', '#d9487a', 0.8, 26);
  const col = PALETTE.slimes[s.ci];
  for (let i = 0; i < 6; i++) G.particles.push({ x: p.x, y: p.y, vx: rand(-60, 60), vy: rand(-120, -40), r: rand(1.5, 3), life: rand(0.3, 0.5), age: 0, col: rgb(col) });
  return true;
}
/* 積み試作: ぷるんの強さを ▲の数で見せる(1だん=▲1つ。強さの上限で止まる) */
function powerMarks(s) {
  const C = CONFIG, cap = 1 + Math.floor((C.stackMax - 1) / C.stackPer + 1e-6);
  return Math.min(stackOf(s), cap);
}
function drawPowerMarks(x, y, n) {
  const w = 9 * n + 8;
  ctx.save();
  rr(x - w / 2, y - 8, w, 16, 8); ctx.fillStyle = 'rgba(255,250,235,0.95)'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  for (let i = 0; i < n; i++) {
    const cx = x - (n - 1) * 4.5 + i * 9;
    ctx.beginPath(); ctx.moveTo(cx - 4, y + 4); ctx.lineTo(cx + 4, y + 4); ctx.lineTo(cx, y - 4); ctx.closePath();
    ctx.fillStyle = '#e0951a'; ctx.fill();
  }
  ctx.restore();
}
function purunPower(s) {
  const C = CONFIG;
  return Math.min(C.stackMax, 1 + C.stackPer * (stackOf(s) - 1)) * shapeOf(s).purun;   // ジグザグは よく はねる
}
/* 跳ばし試作: ぷるんで とぶ速さ。足もとの面が右下がりなほど前へ(のぼり坂でも後ろへは とばない) */
function slimeTopAt(s, x) {
  let best = null;
  for (let i = 0; i < s.pts.length - 1; i++) {
    const a = s.pts[i], b = s.pts[i + 1];
    if ((a.x <= x && x <= b.x) || (b.x <= x && x <= a.x)) {
      const dx = b.x - a.x, y = Math.abs(dx) < 0.001 ? Math.min(a.y, b.y) : a.y + (b.y - a.y) * (x - a.x) / dx;
      if (best === null || y < best) best = y;
    }
  }
  return best;
}
function purunVel(p, s, k) {
  // 足もとの細かいでこぼこではなく、前後12pxのスライムの上面で傾きを見る(ぐるぐる描いた線でも向きが読めるように)
  let xa = p.x - 12, xb = p.x + 12, ya = slimeTopAt(s, xa), yb = slimeTopAt(s, xb);
  if (ya === null) { xa = p.x; ya = slimeTopAt(s, xa); }   // スライムの はしでは、ある側だけで見る
  if (yb === null) { xb = p.x; yb = slimeTopAt(s, xb); }
  k = (ya !== null && yb !== null && xb > xa) ? clamp((yb - ya) / (xb - xa), -3, 3) : 0;
  const V = Math.sqrt(2 * CONFIG.personGravity * CONFIG.stackH * purunPower(s) * (p.type.light || 1));
  const kf = Math.max(0, k), nl = Math.hypot(kf, 1);
  return { V: V, vy: -V / nl, vx: V * kf / nl * CONFIG.purunSide + p.speed + V * CONFIG.purunFwd };
}
function purunReady(s) { return G.clock - s.purunAt >= CONFIG.purunCool; }
/* 試作: 歩行中にスライムをタップ → ぷるんと はずんで、上にいる人を右ななめ上(進む向き)へ とばす。
   大きいスライム・かたまりほど強く、軽い人ほど高く飛ぶ */
function purunAt(x, y) {
  let best = null, bd = 1e9;
  for (const s of G.slimes) {
    if (s.state !== 'fixed' || s.plank) continue;
    let d = 1e9;
    if (s.blob && inBlob(s, x, y)) d = 0;
    else for (let i = 0; i < s.pts.length - 1; i++) d = Math.min(d, segDist(x, y, s.pts[i].x, s.pts[i].y, s.pts[i + 1].x, s.pts[i + 1].y) - s.thick / 2);
    if (d > CONFIG.purunReach) continue;
    d -= (s.riders > 0 ? 100 : 0) + (purunReady(s) ? 50 : 0);   // 人が乗っている・いま使えるスライムを優先
    if (d < bd) { bd = d; best = s; }
  }
  if (!best) return sawTap(x, y);   // ステージ3: スライムの近くでなければ シーソーの板
  const s = best;
  if (!purunReady(s)) { se('short'); return true; }
  s.purunAt = G.clock; se('purun'); if (G.state === 'walk') G.purunN = (G.purunN || 0) + 1;
  const pw = purunPower(s), g = CONFIG.personGravity;
  popup(x, y - 20, lang === 'ja' ? 'ぷるん！' : 'Wobble!', 13 + 3 * pw, '#fff', '#2a8f4d', 0.8, 26);
  const col = PALETTE.slimes[s.ci];
  for (let i = 0; i < 8; i++) { const q = s.pts[Math.floor(Math.random() * s.pts.length)]; G.particles.push({ x: q.x, y: q.y, vx: rand(-60, 60), vy: rand(-140, -50), r: rand(1.5, 3), life: rand(0.3, 0.55), age: 0, col: rgb(col) }); }
  for (const p of G.people) {
    if (p.state !== 'walk' || p.climbing) continue;
    const u = slimeUnder(p);
    if (!u || u.s !== s) continue;
    const pv = purunVel(p, s, u.k), V = pv.V;
    p.flew = true;   // 跳ばし試作: ぷるんで とんだ人(結果の「橋派/とばし派」に使う)
    p.state = 'air'; p.jumping = true; p.hopping = false; p.spring = false; p.y0 = p.y; p.dropFrom = undefined; p.pause = 0;
    p.vy = pv.vy; p.vx = pv.vx;
    p.tries = 0; p.idleT = 0; p.hesitated = false; p.purunFly = true;
    popup(p.x, p.y - 40 * p.sh, V > 380 ? (lang === 'ja' ? 'ひゃー！' : 'Wheee!') : (lang === 'ja' ? 'わっ' : 'Whoa'), 12, '#fff', PALETTE.ink, 0.8, 26); se('hop', p.id);
  }
  return true;
}

let _curP = null;   // いま動かしている人(乗っている くもは、その人にだけ足場になる)
function candidatesAt(x, maxSlope) {
  if (maxSlope === undefined) maxSlope = CONFIG.maxSlope;
  const c = [];
  if (x <= L) c.push(CTL); else if (x >= R && RC) c.push(CTR);
  for (const PL of PILLARS) if (x >= PL.x0 && x <= PL.x1) c.push(PL.top);
  for (const b of BRANCHES) if (x >= b.x0 && x <= b.x1) c.push(branchTop(b, x));
  for (const k of CLOUDS) if (!k.gone && (!k.rider || k.rider === _curP) && x >= k.x0 && x <= k.x1) c.push(k.top);
  for (const s of G.slimes) {
    if (s.state !== 'fixed') continue;
    const P = s.pts;
    if (s.blob) { const tb = blobTop(s, x, Math.max(maxSlope, CONFIG.blobSlope)); if (tb !== null) c.push(tb); continue; }
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      if ((a.x <= x && x <= b.x) || (b.x <= x && x <= a.x)) {
        const dx = b.x - a.x;
        if (Math.abs(dx) < 0.001) continue;
        const k = (b.y - a.y) / dx;
        if (Math.abs(k) > (s.kind === 'suji' ? Math.max(maxSlope, SHAPE_KINDS.suji.slope) : maxSlope)) continue;   // まっすぐは急でも歩ける
        c.push(a.y + k * (x - a.x) - s.thick / 2);
      }
    }
  }
  return c;
}
function pick(list, lo, hi, ref) {
  let best = null;
  for (const y of list) {
    if (y < lo || y > hi) continue;
    if (best === null || Math.abs(y - ref) < Math.abs(best - ref)) best = y;
  }
  return best;
}

/* 前方(すぐ先)にスライムがあるか。壁や急な坂で進めないときの判定に使う */
function nearSlimeAhead(p) {
  const r = CONFIG.nearReach, cy = p.y - 12;
  for (const s of G.slimes) {
    if (s.state !== 'fixed') continue;
    for (const q of s.pts) {
      if (q.x > p.x + 4 && q.x <= p.x + r && Math.abs(q.y - cy) <= r + s.thick / 2) return true;
    }
  }
  return false;
}

/* 足場の候補を、どのスライム(か崖)の面かといっしょに返す */
function candSrc(x, maxSlope) {
  const c = [];
  if (x <= L) c.push({ y: CTL, s: 'L' }); else if (x >= R && RC) c.push({ y: CTR, s: 'R' });
  for (const PL of PILLARS) if (x >= PL.x0 && x <= PL.x1) c.push({ y: PL.top, s: 'P' });
  for (const b of BRANCHES) if (x >= b.x0 && x <= b.x1) c.push({ y: branchTop(b, x), s: b });
  for (const k of CLOUDS) if (!k.gone && (!k.rider || k.rider === _curP) && x >= k.x0 && x <= k.x1) c.push({ y: k.top, s: k });
  for (const s of G.slimes) {
    if (s.state !== 'fixed') continue;
    const P = s.pts;
    if (s.blob) { const tb = blobTop(s, x, Math.max(maxSlope, CONFIG.blobSlope)); if (tb !== null) c.push({ y: tb, s: s }); continue; }
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      if ((a.x <= x && x <= b.x) || (b.x <= x && x <= a.x)) {
        const dx = b.x - a.x;
        if (Math.abs(dx) < 0.001) continue;
        const k = (b.y - a.y) / dx;
        if (Math.abs(k) > (s.kind === 'suji' ? Math.max(maxSlope, SHAPE_KINDS.suji.slope) : maxSlope)) continue;   // まっすぐは急でも歩ける
        c.push({ y: a.y + k * (x - a.x) - s.thick / 2, s: s });
      }
    }
  }
  return c;
}
/* 今いる面とは別の、自分より高い(6px以上・ジャンプで届く)面が前方の届く距離にあれば、その高さと距離を返す */
function lookTarget(p, nx, c) {
  const lo = p.y - p.jumpUp, hi = p.y - 6;
  let cur = null;
  for (const q of candSrc(nx, p.slope)) if (Math.abs(q.y - c) < 0.01) cur = q.s;
  for (let d = 4; d <= p.reach; d += 3) {
    let best = null;
    for (const q of candSrc(nx + d, p.slope)) {
      if (q.s === cur || q.y < lo || q.y > hi) continue;
      if (best === null || q.y < best.y) best = q;
    }
    if (best !== null) return { y: best.y, d: d };
  }
  return null;
}

function giveUp(p, sp) {
  p.y0 = p.y; p.state = 'air'; p.jumping = false; p.hopping = false;
  p.vy = 0; p.vx = sp * 0.5;
  p.dropFrom = p.y + 14;         // これより低い面にしか着地しない
  p.tries = p.type.hop + p.type.diag; p.bestX = p.x; p.idleT = 0; p.hesitated = false;   // 降りた先で同じ壁に当たったら、すぐまた降りる
  popup(p.x - 4, p.y - 36 * p.sh, i18n('oops'), 12, '#fff', PALETTE.ink, 0.7, 24);
}

function updatePerson(p, dt) {
  p.phase += dt * 10; p.age = (p.age || 0) + dt;
  const g = CONFIG.personGravity, T = p.type;
  if (T.dust && p.state === 'walk' && p.pause <= 0 && (p.dustT = (p.dustT || 0) + dt) > 0.1) {
    p.dustT = 0;
    G.particles.push({ x: p.x - 4, y: p.y - 1, vx: -26, vy: -12, r: 1.8, life: 0.35, age: 0, col: 'rgba(255,255,255,0.85)' });
  }
  if (SPRING && p.state === 'air' && !p.spring && p.vy > 0 && p.x >= SPRING.x && p.x <= SPRING.x + SPRING.w && p.y <= SPRING.y + 3 && p.y >= SPRING.y - 55) {
    // 空中でバネの上に落ちてきた
    SPRING.hit = G.clock;
    p.state = 'air'; p.jumping = true; p.spring = true; p.hopping = false; p.y0 = p.y; p.dropFrom = undefined; p.windSaid = false;
    p.vy = -Math.sqrt(2 * g * Math.max(40, p.y - (CT - CONFIG.springOver))); p.vx = CONFIG.springVx * (T.spr === undefined ? 1 : T.spr);
    popup(p.x - 10, p.y - 40 * p.sh, i18n('boing'), 13, '#fff', '#d6482f', 0.9, 24);
    return;
  }
  if (p.state === 'walk') {
    if (p.pause > 0) { p.pause -= dt; return; }
    if (p.windWait) {   // はしで かぜを待つ(1人1回・最長1周期ぶん)
      const ww = p.windWait, ph = windPhase();
      ww.t += dt; p.idleT = 0;
      if (!ww.said) { ww.said = true; popup(p.x - 4, p.y - 40 * p.sh, lang === 'ja' ? 'かぜ まち…' : 'Waiting for wind…', 11, '#fff', '#3b7fc4', 1.6, 6); }
      if (ph.ph === 'blow' && ph.u < 0.55) {   // ふきはじめ: 柱へ とびこむ
        p.windWait = null;
        const cx = WIND.x0 + 14;
        p.y0 = p.y; p.state = 'air'; p.jumping = true; p.vy = -p.jumpV; se('hop', p.id);
        p.vx = clamp((cx - p.x) / 0.4, p.speed, p.speed * 3.2);
        return;
      }
      if (ww.t > WIND.cyc[0] + WIND.cyc[1] + WIND.cyc[2] + 0.3) { p.windWait = null; }   // 待ちきれない: いつもどおり
      return;
    }
    if (p.climbing) {
      const w = p.climbing;
      p.x += (w.x - 3 - p.x) * Math.min(1, dt * 12); p.idleT = 0;
      if (w.slip) {   // 上限まで登っても上面に届かない: ずり落ちるしぐさのあと、手をはなして真下へ
        w.slipT += dt; p.y += 26 * dt;
        if (w.slipT > 0.7) {
          p.climbing = null; p.state = 'air'; p.jumping = false; p.hopping = false; p.spring = false; p.y0 = p.y; p.vx = 0; p.vy = 0; p.dropFrom = undefined; p.tries = 0; p.idleT = 0; p.bestX = p.x; p.hesitated = false; p.noGrab = true;
        }
        return;
      }
      p.y -= CONFIG.climbSpeed * dt;
      if (p.y <= w.top) { p.y = w.top; p.x = w.x + 3; p.climbing = null; p.bestX = p.x; p.tries = 0; return; }
      if (w.lim && w.y0 - p.y >= T.climbH) { w.slip = true; w.slipT = 0; popup(p.x - 6, p.y - 40 * p.sh, lang === 'ja' ? 'もう むり〜' : "Can't go on~", 12, '#fff', PALETTE.ink, 1.0, 14); }
      return;
    }
    if (SPRING && p.x >= SPRING.x && p.x <= SPRING.x + SPRING.w && p.y <= SPRING.y + 3 && p.y >= SPRING.y - 55) {
      // バネに乗った: 人ごとのジャンプ倍率で高さが変わる
      SPRING.hit = G.clock;
      p.state = 'air'; p.jumping = true; p.spring = true; p.hopping = false; p.y0 = p.y; p.dropFrom = undefined; p.windSaid = false;
      p.vy = -Math.sqrt(2 * g * Math.max(40, p.y - (CT - CONFIG.springOver))); p.vx = CONFIG.springVx * (T.spr === undefined ? 1 : T.spr);
      popup(p.x - 10, p.y - 40 * p.sh, i18n('boing'), 13, '#fff', '#d6482f', 0.9, 24);
      return;
    }
    if (SPRING && !p.spring && p.x >= SPRING.x - 55 && p.x <= SPRING.x + SPRING.w - 6 && p.y < SPRING.y - 55 && p.y > SPRING.y - 235) {
      // バネの手前〜真上を、バネより高い橋の上で進んでいて、橋がすぐ先で切れる(または急すぎて降りられない): バネの上へ飛び降りる
      const near = p.x < SPRING.x;
      let gap = false;
      for (let d = 6; d <= (near ? 12 : 6); d += 6) { if (pick(candidatesAt(p.x + d, p.slope), p.y - CONFIG.stepUp, p.y + CONFIG.stepDown, p.y) === null) { gap = true; break; } }
      if (gap) {
        const pxc = SPRING.x + SPRING.w / 2, tf = Math.sqrt(2 * (SPRING.y - 30 - p.y) / g);
        p.state = 'air'; p.jumping = false; p.hopping = false; p.vy = 0; p.dropFrom = p.y + 14;
        if (near) p.vx = clamp((pxc - p.x) / tf, 0, 240); else { p.vx = 0; p.x = pxc; }
        popup(p.x - 4, p.y - 36 * p.sh, i18n('hup'), 12, '#fff', PALETTE.ink, 0.7, 24);
        return;
      }
    }
    const sp = p.onCloud && p.onCloud.x1 < R + 14 ? 0 : p.speed, nx = p.x + sp * dt;   // くもの上は じっと乗っていき、くもが右の崖の上まで来たら 歩いて おりる
    if (nx >= CONFIG.goalX) {
      p.x = nx; p.state = 'finish'; p.cheerT = 0; p.y = CTR;
      p.tx = finishTx(G.crossed);   // 先に着いた人ほど奥に並ぶ
      se('goal', G.crossed); G.crossed++; G.status[p.id] = 'ok';
      popup(p.x - 8, CTR - 44, '+1', 20, '#fff', PALETTE.ok, 0.9, 30); crossPopup(p);
      return;
    }
    // 長いこと前へ進めていないときの安全装置: 足元をあきらめて下へ降りる
    p.idleT += dt;
    if (p.idleT > 5) { giveUp(p, sp); return; }
    if (T.climbH) {
      // 崖(と柱)の壁が目の前にあって、登れる高さなら、よじ登る
      const ws = RC ? [{ x: R, top: CTR }] : [];
      for (const PL of PILLARS) ws.push({ x: PL.x0, top: PL.top });
      for (const w of ws) {
        const cl = RC && w.x === R;   // 右の崖: どれだけ高くても まず つかまる(登れるのは climbH まで)。柱は今までどおり
        if (nx >= w.x - 26 && p.x < w.x + 1 && p.y > w.top + 5 && (cl ? (p.climbTry || 0) < CONFIG.climbTryMax : p.y - w.top <= T.climbH)) {
          if (cl) p.climbTry = (p.climbTry || 0) + 1;
          p.climbing = { x: w.x, top: w.top, y0: p.y, lim: cl }; p.viaClimb = true; persona(p, 'cliff');
          return;
        }
      }
    }
    const c = pick(candidatesAt(nx, p.slope), p.y - (T.climb ? 10 : CONFIG.stepUp), p.y + CONFIG.stepDown, p.y);
    if (c !== null && T.look && !(p.lookCool > 0)) {
      const lt = lookTarget(p, nx, c);
      if (lt !== null) {
        // 歩けるけれど、近くにもっと高いスライムがある: そちらへ跳び移る
        const tf = (p.jumpV + Math.sqrt(p.jumpV * p.jumpV + 2 * g * Math.max(-60, lt.y - p.y))) / g;
        p.y0 = p.y; p.state = 'air'; p.x = nx; p.jumping = true; p.vy = -p.jumpV; se('hop', p.id); p.vx = clamp((lt.d + 4) / tf, sp, sp * 2.4);
        p.lookCool = 0.8; p.lookJumps = (p.lookJumps || 0) + 1; persona(p, 'look');
        return;
      }
    }
    if (p.lookCool > 0) p.lookCool -= dt;
    if (c !== null) {
      const steep = T.climb && Math.abs(c - p.y) > 1.2 * (nx - p.x);   // 急な坂は、ぐいぐいゆっくり登る
      let c2 = c, fx = 1;
      if (steep) {
        const kk = Math.abs(c - p.y) / Math.max(0.01, nx - p.x);
        fx = Math.min(0.5, 1.2 / Math.sqrt(1 + kk * kk));
        const cc = pick(candidatesAt(p.x + (nx - p.x) * fx, p.slope), p.y - 10, p.y + CONFIG.stepDown, p.y);
        if (cc !== null) c2 = cc;
      }
      p.x += (nx - p.x) * fx; p.y += (c2 - p.y) * 0.6;
      if (steep && (p.sayT = (p.sayT || 0) + dt) > 1.2) { p.sayT = 0; persona(p, 'steep'); }
      // 回数のリセットは「前へ進めたとき」だけ(同じ場所に着地しても戻らない)
      if (p.x > p.bestX + 8) { p.bestX = p.x; p.tries = 0; p.hesitated = false; p.idleT = 0; }
    } else {
      let target = null, td = 0;
      for (let d = 4; d <= p.reach; d += 3) {
        const cc = pick(candidatesAt(nx + d, p.slope), p.y - p.jumpUp, p.y + CONFIG.jumpDown, p.y);
        if (cc !== null) { target = cc; td = d; break; }
      }
      if (nx < R && R - nx + 3 <= p.reach && CTR >= p.y - p.jumpUp && CTR <= p.y + CONFIG.jumpDown && (target === null || target > CTR + 4)) {
        target = CTR; td = R - nx + 3;   // 右の崖の上が届く: そこへ(低いスライムへ降りない)
      }
      if (SPRING && p.x < SPRING.x + 4 && (target === null || nx + td > SPRING.x + SPRING.w)) {
        // バネが届く距離にあるなら、飛び越えずにバネの真ん中をねらって跳ぶ
        const pxc = SPRING.x + SPRING.w / 2, dd = pxc - nx - 4;
        if (dd >= 4 && dd <= p.reach) {
          const cp = pick(candidatesAt(pxc, p.slope), p.y - p.jumpUp, p.y + CONFIG.jumpDown, p.y);
          if (cp !== null && cp <= SPRING.y + 3 && cp >= SPRING.y - 55) { target = cp; td = dd; }
        }
      }
      p.y0 = p.y;
      if (target !== null) {
        // 届く先があるので跳び移る(遠いほど強く前へ跳ぶ)
        const tf = (p.jumpV + Math.sqrt(p.jumpV * p.jumpV + 2 * g * Math.max(-60, target - p.y))) / g;
        p.state = 'air'; p.x = nx; p.jumping = true; p.vy = -p.jumpV; se('hop', p.id); p.vx = clamp((td + 4) / tf, sp, sp * 2.4);
        if (T.dust && td >= p.reach * 0.6) persona(p, 'leap');
      } else if (nearSlimeAhead(p)) {
        // 目の前に壁や急な坂がある: ①その場でジャンプ → ②前へ斜めジャンプ → ③あきらめて下へ降りる
        p.tries++;
        if (p.tries <= T.hop) {
          p.state = 'air'; p.hopping = true; p.jumping = true; p.vy = -p.jumpV; se('hop', p.id); p.vx = 0;
          if (p.tries === 1) { popup(p.x - 4, p.y - 36 * p.sh, T.say, 12, '#fff', PALETTE.ink, 0.7, 24); se('say', p.id); }
        } else if (p.tries <= T.hop + T.diag) {
          p.state = 'air'; p.hopping = true; p.jumping = true; p.vy = -p.jumpV; se('hop', p.id); p.vx = sp * 1.5; p.x = nx;
        } else {
          giveUp(p, sp);
        }
      } else {
        // はしで かぜの柱が すぐ前にあるなら、跳ばずに かぜを待つ(1人1回)
        if (WIND && WIND.cyc && !p.windWaited && p.y > WIND.top + 20 && p.x < WIND.x0 && WIND.x0 - p.x <= p.reach + 10) {
          p.windWaited = true; p.windWait = { t: 0, said: false };
          return;
        }
        // 足場のはしで 前が右の崖の壁、上面に届かない: 壁へ跳んで けり、左ななめ上へはね返る(1人1回)
        if (RC && !T.climbH && !p.wallKicked && R - p.x <= p.reach + 6 && p.y - CTR > p.jumpUp) {
          p.wallKicked = true; p.kickWall = true; p.y0 = p.y;
          p.state = 'air'; p.jumping = true; p.hopping = false; p.vy = -p.jumpV; se('hop', p.id);
          p.vx = clamp(((R - 3) - p.x) / 0.3, sp, sp * 3.5);
          return;
        }
        // 先に何もない: 落ちる前に、とにかく前へ跳んでみる(慎重な人は少し迷う)
        if (T.hesitate > 0 && !p.hesitated) {
          p.hesitated = true; p.pause = T.hesitate;
          persona(p, 'wait');
          return;
        }
        p.state = 'air'; p.x = nx; p.jumping = true; p.vy = -p.jumpV; se('hop', p.id); p.vx = sp * 1.05;
        if (T.hesitate > 0) persona(p, 'dive');
      }
    }
  } else if (p.state === 'air') {
    if (p.peakY === undefined || p.y < p.peakY) p.peakY = p.y;   // ステージ2: いちばん高かったところ
    p.vy += g * dt;
    if (p.glide) {   // ステージ3: たこ。はじめは ふわっと上がり、そのあと ゆっくり おりる
      p.glideT = (p.glideT || 0) + dt;
      const tv = p.glideT < CONFIG.kiteLiftT ? -CONFIG.kiteLift : CONFIG.kiteVy;
      p.vx = CONFIG.kiteVx; p.vy += (tv - p.vy) * Math.min(1, dt * 6) - g * dt;   // 重力は打ち消す
      if ((p.x >= R - 10 && p.y > CTR) || p.x > R + 24) { releaseKite(p); p.vx = Math.min(p.vx, 60); }   // 崖の壁に ぶつかったら・右の崖の上まで来たら 手を はなす
    }
    p.inWind = false;
    if (WIND && windOn() && p.x >= WIND.x0 && p.x <= WIND.x1 && p.y >= WIND.top && p.y < floorAt(p.x) + 2) {
      const k = T.wind || 1, kk = Math.pow(k, WIND.pow || 1), lift = WIND.lift || CONFIG.windLift, rise = WIND.rise || CONFIG.windRise, drift = WIND.drift === undefined ? CONFIG.windDrift : WIND.drift, dmax = WIND.dmax === undefined ? CONFIG.windDriftMax : WIND.dmax;
      p.inWind = true; p.dropFrom = undefined; p.viaWind = true;
      p.vy -= lift * g * k * dt;
      if (p.vy < -rise * kk) p.vy = -rise * kk;
      p.vx = Math.min(p.vx + drift * dt, dmax);
      if (!p.windSaid) { p.windSaid = true; se('wind'); popup(p.x - 6, p.y - 40 * p.sh, i18n('whoosh'), 12, '#fff', '#3b7fc4', 0.9, 22); }
    }
    if (!p.jumping) p.vx *= 0.985;
    if (!p.spring && !p.inWind && !p.glide && !p.hurt && p.vy > 0 && p.y < FL - 30) {
      p.steerT = (p.steerT || 0) - 1;
      if (p.steerT <= 0) {
        p.steerT = 4;
        const lands = function (vx0) {
          let x = p.x, y = p.y, vy = p.vy;
          for (let k = 0; k < 120; k++) {
            const oy = y; vy += g / 30; y += vy / 30; x += vx0 / 30;
            if (y >= floorAt(x) - 2) return false;
            const lst = candidatesAt(x, Math.max(p.slope, CONFIG.maxSlope));
            for (const c of lst) {
              if (RC && x >= R && c === CTR && CTR > CTL + 60) continue;   // ステージ3: ずっと下の右の崖へは、着地点さがしで ねらわない(幅跳びで勝手に渡らない)
              if (c < FL - 4 && (p.dropFrom === undefined || c >= p.dropFrom) && oy <= c + 1 && y >= c) return true;
            }
            if (RC && x > R - 10 && y > CTR) x = R - 10; if (x < L + 10 && y > CTL) x = L + 10;
          }
          return false;
        };
        p.steerVx = null;
        if (!lands(p.vx)) {
          const dmax = p.purunFly ? 36 : 240;   // 試作: ぷるんで飛んだときは、着地点さがしで前へ流れすぎない
          for (let d = 12; d <= dmax; d += 12) {
            if (lands(p.vx + d)) { p.steerVx = p.vx + d; break; }
            if (p.vx - d >= -20 && lands(p.vx - d)) { p.steerVx = p.vx - d; break; }
          }
        } else p.steerVx = null;
      }
      if (p.steerVx !== null && p.steerVx !== undefined) {
        const dv = p.steerVx - p.vx, mx = 900 * dt;
        p.vx += Math.abs(dv) <= mx ? dv : Math.sign(dv) * mx;
      }
    }
    const oldY = p.y, ox = p.x;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kickWall && RC && p.vx > 0 && p.x >= R - 4 && p.y > CTR) {   // 壁に ふれた: けって、左ななめ上へ
      p.kickWall = false; p.x = R - 4;
      const V = Math.sqrt(2 * g * CONFIG.wallKickH * (T.jump || 1));
      popup(p.x - 14, p.y - 40 * p.sh, lang === 'ja' ? 'えいっ！' : 'Hup!', 12, '#fff', PALETTE.ink, 0.8, 24); se('hop', p.id);
      for (let i = 0; i < 6; i++) G.particles.push({ x: R - 2, y: p.y - 6 - i * 2, vx: rand(-60, -10), vy: rand(-50, 10), r: rand(1.5, 2.6), life: rand(0.25, 0.45), age: 0, col: 'rgba(214,186,140,0.95)' });
      if (p.y - V * V / (2 * g) <= CTR + CONFIG.hopGrab) {   // けった高さで上面のかどに手が届く: 今ある「角につかまる」と同じ
        p.x = R + 3; p.y = CTR; p.state = 'walk'; p.vx = 0; p.vy = 0; p.hopping = false; p.spring = false; p.dropFrom = undefined; p.jumping = false;
        popup(p.x, p.y - 40 * p.sh, lang === 'ja' ? 'よいしょ' : 'Hup!', 11, '#fff', PALETTE.ink, 0.7, 24);
        return;
      }
      p.vx = -CONFIG.wallKickVx; p.vy = -V; p.jumping = true; p.dropFrom = undefined; p.y0 = p.y; p.steerVx = null;
    }
    if (p.vx > 0 && (T.climbH || p.spring || p.purunFly)) {   // ぷるん・はね返り・シーソーで とんだときも 崖の壁で止まる
      // 崖(と柱)の壁にぶつかった。クライマーは壁に張り付いてそのまま登る(他の人はバネで飛んだときだけ壁で止まる)
      const walls = RC ? [{ x: R, top: CTR }] : [];
      for (const PL of PILLARS) walls.push({ x: PL.x0, top: PL.top });
      for (const w of walls) {
        const fx = w.x - 3, cl = RC && w.x === R;   // 右の崖: どれだけ高くても つかまる(登れるのは climbH まで。落下中は x が R-10 で止まるので、つかまる範囲は x-12 から)
        if (!p.noGrab && ox < w.x - 3 && p.y > w.top + (T.climbH ? 2 : 8) && (p.x > fx || (T.climbH && p.x >= w.x - (cl ? 12 : 8)))) {
          p.x = fx; p.vx = 0; if (p.glide) releaseKite(p);
          if (T.climbH && (cl ? (p.climbTry || 0) < CONFIG.climbTryMax : p.y - w.top <= T.climbH)) {
            if (cl) p.climbTry = (p.climbTry || 0) + 1;
            p.state = 'walk'; p.climbing = { x: w.x, top: w.top, y0: p.y, lim: cl }; p.viaClimb = true; p.vy = 0; p.jumping = false; p.hopping = false; p.spring = false; p.dropFrom = undefined;
            persona(p, 'cliff');
            return;
          }
          break;
        }
      }
    }
    if (p.jumping && p.vy > 0 && p.y > p.y0 + 30) p.jumping = false;
    if (p.vy > 0) {
      // 試作: 横に動きながら坂へ落ちると、1コマ前の高さと今の足場の高さを比べそこねて すり抜けていた。
      //       1コマ前のx での同じ面の高さと比べる
      const ls = Math.max(p.slope, CONFIG.maxSlope), list = candidatesAt(p.x, ls), was = candidatesAt(ox, ls), span = Math.abs(p.x - ox) * Math.min(ls, 4) + 0.5;
      for (const c of list) {
        if (p.dropFrom !== undefined && c < p.dropFrom) continue;
        let ref = c, bd = span;
        for (const w of was) { const d = Math.abs(w - c); if (d <= bd) { bd = d; ref = w; } }
        if (oldY <= Math.max(ref, c) + 1 && p.y >= c) { p.state = 'walk'; p.y = c; p.vy = 0; p.hopping = false; p.spring = false; p.dropFrom = undefined; dropBounce(p); break; }
      }
    }
    // 試作: かたまりは中までつまっている。横からぶつかったら、上の面が近ければ よじのぼって乗る。遠ければ はね返されて外を落ちる
    if (p.state === 'air') for (const sl of G.slimes) {
      if (sl.state !== 'fixed' || !sl.blob || !sl.bb) continue;
      if (p.x < sl.bb.x0 || p.x > sl.bb.x1 || p.y - 3 < sl.bb.y0 - 8 || p.y - 3 > sl.bb.y1 + 8) continue;
      if (!inBlob(sl, p.x, p.y - 3)) continue;
      const tb = blobTop(sl, p.x, 99);
      if (tb !== null && p.y - tb <= CONFIG.blobClimb && (p.dropFrom === undefined || tb >= p.dropFrom)) {
        p.state = 'walk'; p.y = tb; p.vy = 0; p.hopping = false; p.spring = false; p.dropFrom = undefined;
      } else if (!inBlob(sl, ox, p.y - 3)) { p.x = ox; p.vx = 0; }
      break;
    }
    // 跳ばし試作: 岩や右の崖の角に ぎりぎり届かなかったときは、ふちに つかまって上に乗る(やさしめ)
    if (p.state === 'air' && p.vx >= 0) {
      const eds = RC ? [{ x0: R, top: CTR }] : [];
      for (const PL of PILLARS) eds.push({ x0: PL.x0, top: PL.top });
      for (const e of eds) if (p.x >= e.x0 - 3 && ox < e.x0 + 4 && p.y > e.top && p.y - e.top <= CONFIG.hopGrab) {
        p.x = e.x0 + 3; p.y = e.top; p.state = 'walk'; p.vy = 0; p.hopping = false; p.spring = false; p.dropFrom = undefined; p.jumping = false;
        popup(p.x, p.y - 40 * p.sh, lang === 'ja' ? 'よいしょ' : 'Hup!', 11, '#fff', PALETTE.ink, 0.7, 24);
        break;
      }
    }
    for (const PL of PILLARS) if (p.state === 'air' && p.y > PL.top + 4 && p.x > PL.x0 && p.x < PL.x1) {
      p.x = (p.x - PL.x0 < PL.x1 - p.x) ? PL.x0 - 1 : PL.x1 + 1; p.vx = 0;   // 柱の中へはめり込まない(跳ばし試作: 柱の外へ1px出して、柱の上で「落ちた」にならないように)
    }
    if (p.state === 'air' && !p.jumping) {
      if (RC && p.x > R - 10 && p.y > CTR) p.x = R - 10;
      if (p.x < L + 10 && p.y > CTL) p.x = L + 10;
    }
    // 跳ばし試作: 岩の上(地形の一部)に落ちてきたときは、「落ちた」ではなく着地にする
    if (p.state === 'air' && p.vy > 0) for (const PL of PILLARS) if (p.x >= PL.x0 && p.x <= PL.x1 && p.y >= PL.top && p.y - PL.top < 14) {
      p.state = 'walk'; p.y = PL.top; p.vy = 0; p.hopping = false; p.spring = false; p.dropFrom = undefined; break;
    }
    if (p.state === 'air' && p.y >= floorAt(p.x) - 2) {
      if (p.y >= floorAt(clamp(p.x, L + 10, RC ? R - 10 : W - 12))) {
        // 試作: 同じ場所に落ちた人どうしが重ならないよう、あいている場所へ左右にずらして立たせる
        const ox = clamp(p.x, L + 10, RC ? R - 10 : W - 12); let nx = ox;
        for (let k = 0; k < 12; k++) {
          const cand = clamp(ox + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 22, L + 10, RC ? R - 10 : W - 12);
          if (PILLARS.some(function (PL) { return cand >= PL.x0 - 8 && cand <= PL.x1 + 8; })) continue;   // 跳ばし試作: 岩の上へは ずらさない
          if (SAW && Math.abs(cand - CONFIG.sawX) < 40) continue;   // シーソーの台の上へも ずらさない
          if (!G.people.some(function (q) { return q !== p && q.state === 'pile' && Math.abs(q.x - cand) < 20; })) { nx = cand; break; }
        }
        p.slide = ox - nx; p.x = nx;
        const level = floorAt(p.x);
        p.state = 'pile'; p.y = level; se('thud'); G.fell++; G.status[p.id] = 'fail';
        G.shake = Math.max(G.shake, 2);
        p.pileT = 0; popup(p.x, level - 30, lang === 'ja' ? 'ぽてっ' : i18n('thud'), 13, '#fff', PALETTE.floorDark, 0.8, 20);
      }
    }
  } else if (p.state === 'finish') {
    p.x += p.speed * dt;
    if (p.x >= p.tx) { p.x = p.tx; p.state = 'cheer'; p.cheerT = 0; }
  } else if (p.state === 'cheer') {
    p.cheerT += dt;   // ゴールした人はそのまま残って喜び続ける
  }
}

/* ============================================================
   消しゴム: 崖の左右のマークをタップすると降ってくる。最初に触れたスライムが消える
   ============================================================ */
const MARKS = [
  { x: 36, y: 486, r: 26, spawnX: 128, press: -9 },
  { x: 324, y: 486, r: 26, spawnX: 232, press: -9 }
];

function spawnEraser(m) {
  if (G.erasers.length >= CONFIG.eraserMax) return;
  se('pin');
  G.erasers.push({
    pts: [{ x: m.x, y: m.y }], thick: CONFIG.eraserRadius * 2, state: 'zip', zt: 0,
    x0: m.x, y0: m.y, x1: m.spawnX, y1: 34, vy: 0, rot: 0, seed: Math.random() * 6, target: null, trail: []
  });
}

function nearFixed(x, y, r) {
  let best = null, bd = 1e9;
  for (const o of G.slimes) {
    if (o.state !== 'fixed' || o.plank) continue;
    const rr_ = r + o.thick / 2, bb = o.bb;
    if (x + rr_ < bb.x0 || x - rr_ > bb.x1 || y + rr_ < bb.y0 || y - rr_ > bb.y1) continue;
    for (let i = 0; i < o.pts.length - 1; i++) {
      const d = segDist(x, y, o.pts[i].x, o.pts[i].y, o.pts[i + 1].x, o.pts[i + 1].y) - rr_;
      if (d <= 0 && d < bd) { bd = d; best = o; }
    }
  }
  return best;
}

/* いま手を離したら、どのスライムに最初に触れるか(まっすぐ落ちた場合) */
function eraserTarget(e) {
  const r = CONFIG.eraserRadius, t = { pts: [{ x: e.pts[0].x, y: e.pts[0].y }], thick: r * 2 };
  for (let i = 0; i < 160; i++) {
    t.pts[0].y += 6;
    if (resolveWalls(t)) return null;
    const p = t.pts[0];
    if (terrainHit(p.x, p.y, r)) return null;
    const s = nearFixed(p.x, p.y, r);
    if (s) return { s: s, x: p.x, y: p.y };
  }
  return null;
}

function slimesTouch(a, b) {
  const rr_ = (a.thick + b.thick) / 2 + 1.5;
  if (a.bb.x1 + rr_ < b.bb.x0 || a.bb.x0 - rr_ > b.bb.x1 || a.bb.y1 + rr_ < b.bb.y0 || a.bb.y0 - rr_ > b.bb.y1) return false;
  for (const p of a.pts) {
    for (let i = 0; i < b.pts.length - 1; i++) {
      if (segDist(p.x, p.y, b.pts[i].x, b.pts[i].y, b.pts[i + 1].x, b.pts[i + 1].y) <= rr_) return true;
    }
  }
  return false;
}

/* 谷底につながっていないスライムは、支えを失って崩れ落ちる */
function releaseOrphans() {
  const fixed = G.slimes.filter(s => s.state === 'fixed');
  const seen = new Set(), queue = [];
  for (const s of fixed) if (s.plank || s.onBalloon || s.pts.some(p => terrainHit(p.x, p.y, s.thick / 2 + 1.5))) { seen.add(s); queue.push(s); }
  while (queue.length) {
    const a = queue.pop();
    for (const b of fixed) if (!seen.has(b) && (slimesTouch(a, b) || slimesTouch(b, a))) { seen.add(b); queue.push(b); }
  }
  for (const s of fixed) {
    if (seen.has(s)) continue;
    se('collapse');
    s.state = 'free'; s.collapse = true; s.vy = CONFIG.collapseSpeed; s.ghost = null; s.stuckAt = -99;
    G.shake = Math.max(G.shake, 4);
  }
}

function eraseSlime(s) {
  G.slimes = G.slimes.filter(o => o !== s);
  G.fades.push({ pts: s.pts.map(p => ({ x: p.x, y: p.y })), thick: s.thick, ci: s.ci, age: 0, life: 0.4 });
  const c = PALETTE.slimes[s.ci];
  for (let i = 0; i < s.pts.length; i += 2) {
    const p = s.pts[i];
    for (let k = 0; k < 2; k++) G.particles.push({ x: p.x, y: p.y, vx: rand(-90, 90), vy: rand(-170, -20), r: rand(1.8, 4), life: rand(0.4, 0.8), age: 0, col: k ? '#ffffff' : rgb(c) });
  }
  G.shake = Math.max(G.shake, 6);
  releaseOrphans();
}

function poof(e, hit) {
  se(hit ? 'erase' : 'miss');
  e.state = 'gone';
  if (G.drag && G.drag.s === e) G.drag = null;
  const p = e.pts[0];
  for (let i = 0; i < 9; i++) G.particles.push({ x: p.x, y: p.y, vx: rand(-70, 70), vy: rand(-110, -10), r: rand(1.6, 3.6), life: rand(0.3, 0.6), age: 0, col: hit && i % 2 ? '#f6a5b8' : 'rgba(255,255,255,0.95)' });
}

/* 崖の中には入れない。スライムに触れたら消す。谷底や崖の上に落ちたら空振り */
function eraserContact(e) {
  const r = CONFIG.eraserRadius, p = e.pts[0], held = e.state === 'held';
  p.x = clamp(p.x, r, W - r);
  const landed = resolveWalls(e);
  if (landed && !held) { poof(e, false); return true; }
  if (terrainHit(p.x, p.y, r)) {
    if (held) { for (let k = 0; k < 90 && terrainHit(p.x, p.y, r); k++) p.y -= 1; } else { poof(e, false); return true; }
  }
  const s = nearFixed(p.x, p.y, r);
  if (s) { eraseSlime(s); poof(e, true); return true; }
  return false;
}

function updateErasers(dt) {
  for (const e of G.erasers) {
    const p = e.pts[0];
    e.trail.push({ x: p.x, y: p.y }); if (e.trail.length > 7) e.trail.shift();
    if (e.state === 'zip') {
      e.zt += dt;
      const k = Math.min(1, e.zt / 0.32), z = 1 - Math.pow(1 - k, 3);
      p.x = lerp(e.x0, e.x1, z); p.y = lerp(e.y0, e.y1, z) - Math.sin(Math.PI * k) * 60;
      e.rot = k * Math.PI * 4;
      if (k >= 1) { e.state = 'free'; e.vy = CONFIG.eraserFallSpeed; e.rot = 0; }
    } else if (e.state === 'free') {
      e.vy = Math.min(CONFIG.eraserFallMax, e.vy + CONFIG.eraserFallAccel * dt);
      const total = e.vy * dt, n = Math.max(1, Math.ceil(total / 4));
      for (let i = 0; i < n && e.state === 'free'; i++) { p.y += total / n; eraserContact(e); }
    }
    if ((e.state === 'free' || e.state === 'held') && (G.tick & 1) === 0) e.target = eraserTarget(e);
  }
  G.erasers = G.erasers.filter(e => e.state !== 'gone');
}

function moveEraser(e, dx, dy) {
  const p = e.pts[0], n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5));
  for (let i = 0; i < n; i++) {
    p.x += dx / n; p.y += dy / n;
    if (p.y < -20) p.y = -20;
    if (eraserContact(e)) return;
  }
}

function hitEraser(x, y) {
  let best = null, bd = 1e9;
  for (const e of G.erasers) {
    if (e.state !== 'free') continue;
    const d = Math.hypot(e.pts[0].x - x, e.pts[0].y - 20 - y);  // 針は先端の上に頭がある
    if (d < bd) { bd = d; best = e; }
  }
  return bd <= CONFIG.eraserGrip ? best : null;
}

/* 橋の高さの帯より高くはみ出しているスライム */
function highSlimes() {
  const off = -CONFIG.jumpUp * 0.7 - 1;
  return G.slimes.filter(s => s.state === 'fixed' && s.pts.some(p => p.y - s.thick / 2 < bandY(p.x, off)));
}

/* ============================================================
   更新
   ============================================================ */
function sinkSlimes() {
  if (!WATER) return;
  for (const s of G.slimes.slice()) {
    if (s.state === 'held') continue;
    let cx = 0, cy = 0; for (const q of s.pts) { cx += q.x; cy += q.y; } cx /= s.pts.length; cy /= s.pts.length;
    if (cx > WATER.x0 && cx < WATER.x1 && cy > WATER.top + 2) {
      eraseSlime(s);
      for (let i = 0; i < 8; i++) G.particles.push({ x: cx + (Math.random() - 0.5) * 30, y: WATER.top, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 60, r: 2.4, life: 0.6, age: 0, col: 'rgba(200,235,255,0.9)' });
      popup(cx - 10, WATER.top - 18, i18n('splash'), 13, '#fff', '#1f6fb5', 0.9, 24);
    }
  }
}
/* 空のイガグリ: 左右にゆっくり往復。空中の人が ふれたら「いたっ！」で前への速さを失い、真下へ落ちる */
function updateSpikes(dt) {
  for (const sp of SPIKES) {
    if (!sp.mv) continue;
    const m = sp.mv, w = Math.PI * 2 / m.per, a = (m.x1 - m.x0) / 2;
    sp.x = (m.x0 + m.x1) / 2 + a * Math.sin(w * G.clock + sp.ph); sp.vx = Math.cos(w * G.clock + sp.ph) * a * w;
    if (G.state !== 'walk') continue;
    for (const p of G.people) {
      if (p.state !== 'air' || (p.hurtT || 0) > G.clock) continue;
      if (Math.hypot(p.x - sp.x, p.y - 16 * p.sh - sp.y) < sp.r * 1.1 + 6) {
        p.hurtT = G.clock + 0.8; p.hurt = true; p.vx = 0; if (p.vy < 80) p.vy = 80; p.jumping = false; p.purunFly = false; p.spring = false; p.steerVx = null; p.dropFrom = undefined;
        popup(p.x - 6, p.y - 40 * p.sh, lang === 'ja' ? 'いたっ！' : 'Ouch!', 13, '#fff', '#b4570a', 0.9, 24); se('spike');
      }
    }
  }
}
function burstSlimes() {
  if (!SPIKES.length) return;
  for (const s of G.slimes.slice()) {
    let hit = null;
    for (const q of s.pts) { for (const sp of SPIKES) { if (Math.hypot(q.x - sp.x, q.y - sp.y) < sp.r + s.thick * 0.45) { hit = q; break; } } if (hit) break; }
    if (hit) {
      eraseSlime(s);
      const c = PALETTE.slimes[s.ci];
      for (let i = 0; i < 14; i++) G.particles.push({ x: hit.x + (Math.random() - 0.5) * 16, y: hit.y + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 200, vy: -60 - Math.random() * 120, r: 3, life: 0.6, age: 0, col: c });
      se('spike'); popup(hit.x - 12, hit.y - 22, i18n('pop'), 15, '#fff', '#b4570a', 0.9, 26);
      G.shake = Math.max(G.shake, 3);
    }
  }
}
function drawSpikes(t) {
  for (const sp of SPIKES) {
    if (!sp.mv) continue;
    ctx.save(); ctx.setLineDash([3, 6]); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; line(sp.mv.x0 - sp.r, sp.y, sp.mv.x1 + sp.r, sp.y); ctx.restore();
    const dir = (sp.vx || 0) >= 0 ? 1 : -1;
    txt(dir > 0 ? '›' : '‹', sp.x + dir * (sp.r * 1.4 + 9), sp.y + 7, 20, '#fff', { align: 'center', stroke: PALETTE.ink, sw: 4, weight: 800 });
  }
  for (const sp of SPIKES) {
    const bob = Math.sin(t * 1.6 + sp.ph) * 2.2, x = sp.x, y = sp.y + bob, r = sp.r;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.8 + sp.ph) * 0.25);
    ctx.fillStyle = '#6b3f22'; ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    const n = 14;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a0 = k / n * Math.PI * 2, a1 = (k + 0.5) / n * Math.PI * 2, a2 = (k + 1) / n * Math.PI * 2;
      if (k === 0) ctx.moveTo(Math.cos(a0) * r * 0.78, Math.sin(a0) * r * 0.78);
      ctx.lineTo(Math.cos(a1) * r * 1.38, Math.sin(a1) * r * 1.38); ctx.lineTo(Math.cos(a2) * r * 0.78, Math.sin(a2) * r * 0.78);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9a35f'; circ(0, 0, r * 0.72); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PALETTE.ink; circ(-r * 0.25, -r * 0.08, 1.7); ctx.fill(); circ(r * 0.25, -r * 0.08, 1.7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.22, 0.15, Math.PI - 0.15); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
  }
}
function drawDemo() {
  const dm = G.demo; if (!dm) return;
  ctx.save(); ctx.globalAlpha = dm.sunk ? 0 : 1;
  ctx.lineCap = 'round'; ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(dm.x - 20, dm.y); ctx.lineTo(dm.x + 20, dm.y); ctx.stroke();
  ctx.strokeStyle = PALETTE.slimes[0]; ctx.lineWidth = 11.5; ctx.beginPath(); ctx.moveTo(dm.x - 20, dm.y); ctx.lineTo(dm.x + 20, dm.y); ctx.stroke();
  ctx.fillStyle = '#fff'; circ(dm.x - 4, dm.y - 1, 3); ctx.fill(); circ(dm.x + 5, dm.y - 1, 3); ctx.fill();
  ctx.fillStyle = PALETTE.ink; circ(dm.x - 3.5, dm.y - 0.5, 1.4); ctx.fill(); circ(dm.x + 5.5, dm.y - 0.5, 1.4); ctx.fill();
  ctx.restore();
}
function drawWater(t) {
  if (!WATER) return;
  const w = WATER, g = ctx.createLinearGradient(0, w.top, 0, H);
  g.addColorStop(0, 'rgba(90,185,235,0.70)'); g.addColorStop(1, 'rgba(30,100,175,0.88)');
  ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(w.x0, w.top + 3);
  for (let x = w.x0; x <= w.x1; x += 4) ctx.lineTo(x, w.top + Math.sin(t * 3 + x * 0.12) * 2.2);
  ctx.lineTo(w.x1, H); ctx.lineTo(w.x0, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = w.x0; x <= w.x1; x += 4) { const y = w.top + Math.sin(t * 3 + x * 0.12) * 2.2; if (x === w.x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke(); ctx.restore();
}
function update(dt) {
  G.clock += dt;
  if (SPIKES.length && G.state === 'prep' && !G.waterDemo && G.t > 2.3 && (STAGES[G.stage || 0] || {}).demo !== false) {
    // 見本: 短いスライムがイガグリに当たって、ぱんっと われて きえる(本物のスライムではない・使った数には数えない)
    G.waterDemo = true; const tg = SPIKES.reduce(function (a, b) { return b.y < a.y ? b : a; }); G.demo =   /* 一番上のイガ(下のイガより先に当たる) */ { x: tg.x, y: -20, vy: 0, sunk: false, sinkT: 0, hitY: tg.y - tg.r - 6 };
  }
  if (G.demo && !SPIKES.length) G.demo = null;
  if (G.demo) {
    const dm = G.demo;
    if (!dm.sunk) {
      dm.vy += 900 * dt; dm.y += dm.vy * dt;
      if (dm.y >= dm.hitY) {
        dm.sunk = true;
        for (let i = 0; i < 12; i++) G.particles.push({ x: dm.x + (Math.random() - 0.5) * 30, y: dm.hitY, vx: (Math.random() - 0.5) * 140, vy: -90 - Math.random() * 90, r: 3, life: 0.6, age: 0, col: PALETTE.slimes[0] });
        se('spike'); popup(dm.x - 12, dm.hitY - 22, i18n('pop'), 15, '#fff', '#b4570a', 0.9, 26);
      }
    } else { dm.sinkT += dt; if (dm.sinkT > 0.25) G.demo = null; }
  }
  updateSpikes(dt);
  burstSlimes();
  if (G.state === 'title') titleScript(dt);

  if (G.state === 'prep') {
    G.t += dt;
    const sec = Math.ceil(CONFIG.prepTime - G.t);   // 残り5秒からは1秒ごとに木のチッ
    if (sec !== G.lastSec) { G.lastSec = sec; if (sec >= 1 && sec <= 5) se('tick', sec === 1); }
    if (G.t >= CONFIG.prepTime) startWalk();
  } else if (G.state === 'walk') {
    G.t += dt;
    if (G.spawned < CONFIG.people && G.t >= CONFIG.firstDelay + G.spawned * CONFIG.spawnInterval) spawnPerson();
  } else if (G.state === 'result') {
    G.resultT += dt;
  } else if (G.state === 'ending') {
    G.endingT += dt;
    for (const c of G.conf) {
      c.y += c.vy * dt; c.x += (c.vx + Math.sin(G.endingT * 2 + c.ph) * 18) * dt; c.rot += c.vr * dt;
      if (c.y > H + 14) { c.y = -14; c.x = rand(0, W); }
    }
  }

  for (const s of G.slimes) {
    if (s.state === 'free') {
      const fp = s.collapse ? { sp: CONFIG.collapseSpeed, ac: CONFIG.collapseAccel, mx: CONFIG.collapseMax } : { sp: CONFIG.fallSpeed, ac: CONFIG.fallAccel, mx: CONFIG.fallMax };
      s.vy = Math.min(fp.mx, (s.vy || fp.sp) + fp.ac * dt);
      const total = s.vy * dt, n = Math.max(1, Math.ceil(total / 4));
      for (let i = 0; i < n && s.state === 'free'; i++) {
        shiftSlime(s, 0, total / n);
        if (resolveWalls(s)) {
          const bb = bboxOf(s.pts);
          shiftSlime(s, ((L + R) / 2 > (bb.x0 + bb.x1) / 2 ? 1 : -1) * CONFIG.cliffSlide * dt / n, 0);
          s.vy = CONFIG.fallSpeed;
        }
        const k = touching(s);
        if (k) beginSettle(s, k);
      }
    }
  }
  for (const s of G.slimes) if (s.state === 'settle') settleStep(s, dt);
  G.tick = (G.tick || 0) + 1;
  if (G.tick % 2 === 0) for (const s of G.slimes) if (s.state === 'free' || s.state === 'held') s.ghost = landingGhost(s);
  updateErasers(dt);
  updateSaw(dt); updateWind(dt);
  for (const p of G.people) p.onCloud = null;
  updateClouds(dt);
  for (const p of G.people) { _curP = p; updatePerson(p, dt); }
  _curP = null;
  for (const s of G.slimes) s.riders = 0;
  for (const p of G.people) { if (p.state !== 'air') { p.purunFly = false; p.peakY = undefined; p.hurt = false; p.kickWall = false; p.noGrab = false; } if (p.state === 'pile') p.pileT = (p.pileT || 0) + dt; if (p.sayCool > 0) p.sayCool -= dt; }
  updateRescue(dt);
  updateBirds(dt);
  updateKite(dt); updateVine(dt); updateLeaf(dt);
  updateMedal();
  if (G.state === 'walk' || G.state === 'title') for (const p of G.people) if (p.state === 'walk' && !p.climbing) { const u = slimeUnder(p); if (u) u.s.riders++; }
  for (const p of G.people) {   // 吹き出し「わー」が出た瞬間に声
    const wa = p.state === 'air' && !p.jumping && !p.inWind && p.y > Math.min(CTL, CTR) + 20;   // 崖より下へ落ちていくときだけ
    if (wa && !p.waOn) se('wa', p.id);
    p.waOn = wa || (p.waOn && p.state === 'air');
  }
  G.people = G.people.filter(p => p.state !== 'gone');

  for (const p of G.particles) { p.age += dt; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  G.particles = G.particles.filter(p => p.age < p.life);
  if (G.medalRing) { G.medalRing.t += dt; if (G.medalRing.t > 0.7) G.medalRing = null; }
  for (const p of G.popups) { p.age += dt; p.y -= p.vy * dt; }
  G.popups = G.popups.filter(p => p.age < p.life);
  for (const f of G.fades) f.age += dt;
  G.fades = G.fades.filter(f => f.age < f.life);
  G.shake *= 0.88; if (G.shake < 0.2) G.shake = 0;

  if (G.state === 'walk') {
    const rr0 = G.people.find(function (q) { return q.type.rescue; });
    const rescuePending = !!rr0 && !rr0.rescued && rr0.state === 'cheer' && G.people.some(function (q) { return q.state === 'pile'; });   // ゴール済みのレスキューが、まだ助けていない: 助けるまで待つ
    const active = rescuePending || G.people.some(p => p.state === 'walk' || p.state === 'air' || p.state === 'finish' || p.state === 'rope' || p.state === 'bird' || p.state === 'vine');
    if (G.spawned >= CONFIG.people && !active) {
      G.endT += dt;
      if (G.endT > 1.1) { G.state = 'result'; G.resultT = 0; G.bridge = bridgeName(); se(G.crossed >= needOf() ? 'clear' : 'fail'); }
    } else G.endT = 0;
  }
}

/* ============================================================
   タイトル画面: 楕円と長い棒を本物の物理で積んで、橋を架ける
   傾いたり揺れたりしながら落ち着き、最後に人が渡る。毎回おなじ結果になるよう、ランダムなずれは入れない
   落とす位置と角度は TITLE_PLAN で調整
   ============================================================ */
/* 実際のゲームと同じ流れ: 下の わく(描画エリア)の中を指がなぞる → 同じ x のまま 画面の上から降ってくる。
   まる・ジグザグ・まっすぐ を1つずつ。わざと少し いいかげんな橋にして、渡れない人も出す。
   x = 描く位置と降る位置の中心x、by = わくの中で なぞる中心y。形の性質は ふつうに遊ぶときと同じ */
const TITLE_PLAN = [
  { kind: 'zig', w: 91, h: 73, n: 5, x: 219, by: 484, rot: 0, at: 3.4, trace: 1.0, ci: 1, cap: { ja: 'ジグザグは ぼよよん！\nぷるんも 強い', en: 'Zigzags are bouncy!\nThey launch higher too' } },
  { kind: 'ellipse', rx: 61, ry: 58, x: 157, by: 484, rot: 0, at: 5.6, trace: 1.0, ci: 0, roll: -0.9, cap: { ja: 'まるは ころころ 転がる', en: 'Circles roll away' } },
  { kind: 'bar', len: 121, x: 156, by: 484, rot: -0.14, at: 7.8, trace: 0.6, ci: 2, cap: { ja: 'まっすぐは ぴたっ！\nすべらない', en: 'Straight lines stick!\nNo slipping' } }
];
const TITLE_CAP_FAIL = { ja: '全員 渡れなくても\nクリアの 人数に 届けば OK！', en: 'Not everyone has to make it.\nReach the goal count to clear!' };
const TITLE_CAP_AREA = { ja: '枠の中に 描くと\n上から 降ってくる！', en: 'Draw in the box and a slime\nfalls from above!' };
let TITLE_WALK = 11.5; const TITLE_GAP = 1.1, TITLE_HOLD = 27;
/* 試作: デモの中で「歩いているときにタップ → ぷるん」を見せる相手(人の番号)と、押す位置x */
const TITLE_TAPS = [{ id: 0, x: 110 }];   // 橋の上の ショートを ぷるんで前へ(押さないと 橋の先の すきまに落ちる)
const TITLE_SUB = { ja: ['指で なぞって スライムの 橋を かけよう', '渡るときは タップで ぷるん！と ジャンプ'], en: ['Draw slimes to build a bridge', 'Tap them to bounce the walkers across!'] };
function tl(v) { return v && typeof v === 'object' && !Array.isArray(v) ? (lang === 'ja' ? v.ja : v.en) : v; }   // { ja, en } から今の言語を引く
const TITLE_CAP_BLOB = 'まる・ジグザグ・まっすぐ で スライムの せいしつが かわる';
const TITLE_CAP_PURUN = { ja: 'スライムを タップすると ぷるん！\n乗っている人が 前へ 飛ぶ', en: 'Tap a slime to make it bounce!\nThe walker on it jumps ahead' };
const TITLE_CAP_PUSH = 'とどかない ときも ぷるん！で ひとおし';
let titleT = 0, titleStep = 0, titleWalked = false, titleDrag = null, titleSpawned = 0;
let titleTrace = null, titleFinger = null, titlePress = null, titleTapN = 0, titlePurunT = -99;

function shapePts(sh, cx, cy, rot) {
  let raw = [];
  if (sh.kind === 'ellipse') {
    for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2.06; raw.push({ x: sh.rx * Math.cos(a), y: sh.ry * Math.sin(a) }); }
  } else if (sh.kind === 'zig') {
    for (let i = 0; i <= sh.n; i++) raw.push({ x: -sh.w / 2 + sh.w * i / sh.n, y: (i % 2 ? -sh.h / 2 : sh.h / 2) });
  } else {
    raw = [{ x: -sh.len / 2, y: 0 }, { x: sh.len / 2, y: 0 }];
  }
  raw = resample(raw, 2.5);                         // 描いたときと同じ処理(なめらかに、等間隔に)
  const pts = resample(smooth(raw), CONFIG.pointSpacing);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  return pts.map(function (p) { return { x: cx + p.x * cs - p.y * sn, y: cy + p.x * sn + p.y * cs }; });
}

function dropShape(pl) {
  const pts = shapePts(pl, pl.x, pl.by, pl.rot);   // わくの中で なぞった形
  const blob = false;   // 跳ばし試作: かたまりは使わない
  if (pl.kind === 'ellipse') pts.push({ x: pts[0].x, y: pts[0].y });
  const kind = shapeKind(pts, pathLen(pts));
  if (kind) { const k = SHAPE_KINDS[kind]; popup(AX + AS / 2, AY + AS / 2, lang === 'ja' ? k.ja : k.en, 17, '#fff', k.col, 1.2, 22); }   // 名札は わくの まんなか(ゲームと同じ)
  let y1 = -1e9; for (const p of pts) y1 = Math.max(y1, p.y);
  const dy = -4 - y1; for (const p of pts) p.y += dy;   // 画面の上端のすぐ外から降ってくる(spawnSlime と同じ)
  const c = centroidOf(pts);
  let face = 0, bd = 1e9;
  pts.forEach(function (p, i) { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < bd) { bd = d; face = i; } });
  const s = { pts: pts, thick: CONFIG.slimeThick * CONFIG.thickScale, state: 'free', ci: pl.ci, born: G.clock, stuckAt: -99, face: face, bb: null, vy: CONFIG.fallSpeed, ghost: null, demo: true, hint: !!pl.drag, blob: blob, purunAt: -99, riders: 0 };
  s.len = pathLen(pts);
  s.kind = kind; s.roll = pl.roll || 0;   // 形: 描いたときと同じ判定。性質もそのまま効く
  G.slimes.push(s);
  return s;
}
function pathLen(pts) { let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return len; }
/* タイトルのデモで出す 描画エリアの わく(準備中の drawArea を簡単にしたもの)。描きおわったら うすれて消える */
function drawTitleArea(t) {
  const a = clamp((TITLE_WALK - titleT) / 0.6, 0, 1) * clamp((titleT + 0.8) / 0.5, 0, 1);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  rr(AX, AY, AS, AS, 14); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 14;
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; rr(AX, AY, AS, AS, 14); ctx.stroke();
  ctx.setLineDash([]);
  txt(i18n('drawArea'), AX + 10, AY + 16, 11, 'rgba(42,35,32,0.75)', { weight: 700 });
  ctx.restore();
}

/* つかんでいる指。つかんだ点に白い丸と波紋を出す */
function drawTouch(s, t) {
  if (s.state !== 'held') return;
  const q = s.pts[Math.floor(s.pts.length * 0.3)], k = 1 + 0.08 * Math.sin(t * 10);
  ctx.save(); ctx.translate(q.x, q.y);
  circ(0, 0, 17 * k); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
  circ(0, 0, 9); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.restore();
}

function fingerDot(x, y, k, press) {
  ctx.save(); ctx.translate(x, y);
  if (press > 0) { ctx.strokeStyle = 'rgba(255,240,130,' + (1 - press).toFixed(2) + ')'; ctx.lineWidth = 3; circ(0, 0, 12 + 26 * press); ctx.stroke(); circ(0, 0, 6 + 16 * press); ctx.stroke(); }
  circ(0, 0, 17 * k); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
  circ(0, 0, 9); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.restore();
}
/* 試作: タイトルのデモで、指がなぞっている線・タップする指を描く */
function drawTitleDemo(t) {
  const k = 1 + 0.08 * Math.sin(t * 10);
  if (titleTrace) {
    const pl = titleTrace.pl, P = titleTrace.pts, u = clamp((titleT - (pl.at - pl.trace)) / pl.trace, 0, 1);
    const n = clamp(Math.round(P.length * u), 2, P.length), Q = P.slice(0, n), h = Q[n - 1];
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    slimePath(Q); ctx.lineWidth = CONFIG.slimeThick + 3.5; ctx.strokeStyle = 'rgba(20,80,50,0.5)'; ctx.stroke();
    slimePath(Q); ctx.lineWidth = CONFIG.slimeThick * 0.85; ctx.strokeStyle = mix(PALETTE.slimes[pl.ci], 0.32); ctx.stroke();
    if (pl.kind === 'ellipse' && u > 0.35) {   // 描きはじめの目印: ここへ もどると とじる
      const near = Math.hypot(h.x - P[0].x, h.y - P[0].y) <= CONFIG.maruClose;
      ctx.lineWidth = near ? 3.5 : 2.2; ctx.strokeStyle = near ? '#ffd23f' : 'rgba(255,255,255,0.95)'; ctx.setLineDash(near ? [] : [4, 4]); ctx.lineDashOffset = -t * 12;
      circ(P[0].x, P[0].y, CONFIG.maruClose * 0.8); ctx.stroke();
    }
    ctx.restore();
    fingerDot(h.x, h.y, k, 0);
  }
  if (titleFinger) fingerDot(titleFinger.x, titleFinger.y + 26 * (1 - titleFinger.u), k, 0);
  if (titlePress && titleT - titlePress.t < 0.5) fingerDot(titlePress.x, titlePress.y, k, (titleT - titlePress.t) / 0.5);
}

function titleScript(dt) {
  titleT += dt;
  // 試作: 落とす前に、指がその形をなぞる(かくと スライムになることを見せる)
  const nxt = TITLE_PLAN[titleStep];
  if (nxt && nxt.trace && titleT >= nxt.at - nxt.trace && (!titleTrace || titleTrace.pl !== nxt)) {
    const tp = shapePts(nxt, nxt.x, nxt.by, nxt.rot);
    if (nxt.kind === 'ellipse') tp.push({ x: tp[0].x, y: tp[0].y });
    titleTrace = { pl: nxt, pts: tp };
  }
  // 試作: 歩いている人の足元のスライムを指がタップ → ぷるん
  titleFinger = null;
  if (titleTapN < TITLE_TAPS.length) {
    const tp = TITLE_TAPS[titleTapN], q = G.people.find(function (o) { return o.id === tp.id; });
    if (q && q.state === 'walk' && !q.climbing && slimeUnder(q) && q.x >= tp.x - 34 && q.x <= tp.x + 40) {
      if (q.x >= tp.x) { purunAt(q.x, q.y + 6); titlePress = { x: q.x, y: q.y + 6, t: titleT }; titlePurunT = titleT; titleTapN++; }
      else titleFinger = { x: tp.x, y: q.y + 6, u: (q.x - (tp.x - 34)) / 34 };
    } else if (q && (q.state === 'pile' || q.state === 'finish' || q.state === 'cheer' || q.x > tp.x + 40)) titleTapN++;
  }
  while (titleStep < TITLE_PLAN.length && titleT >= TITLE_PLAN[titleStep].at) {
    titleTrace = null;
    const pl = TITLE_PLAN[titleStep++], s = dropShape(pl);
    if (pl.drag) titleDrag = { s: s, d: pl.drag, done: false };
  }
  // 指がスライムをつかんで運ぶ(落ちている途中でもつかめることを見せる)
  if (titleDrag && !titleDrag.done && titleT >= titleDrag.d.from) {
    const d = titleDrag.d, s = titleDrag.s, ease = function (u) { return u * u * (3 - 2 * u); };
    if (s.state === 'free') s.state = 'held';
    if (s.state === 'held') {
      const u0 = clamp((titleT - dt - d.from) / (d.to - d.from), 0, 1), u1 = clamp((titleT - d.from) / (d.to - d.from), 0, 1);
      moveHeld(s, (ease(u1) - ease(u0)) * d.dx, (ease(u1) - ease(u0)) * d.dy);
    }
    if (titleT >= d.to) { if (s.state === 'held') { s.state = 'free'; s.vy = CONFIG.fallSpeed; } titleDrag.done = true; }
  }
  while (titleSpawned < CONFIG.people && titleT >= TITLE_WALK + titleSpawned * TITLE_GAP) spawnPerson(titleSpawned++);
  if (titleT >= TITLE_HOLD) {
    for (const s of G.slimes.slice().reverse()) eraseSlime(s);   // 上から順に消してやり直す
    G.people = []; G.spawned = 0; G.crossed = 0; G.status = []; G.pile = new Array(BUCKETS).fill(0);
    titleT = -0.8; titleStep = 0; titleWalked = false; titleDrag = null; titleSpawned = 0;
    titleTrace = null; titleFinger = null; titlePress = null; titleTapN = 0; titlePurunT = -99;
  }
}

/* ============================================================
   描画ヘルパー
   ============================================================ */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function txt(s, x, y, size, fill, o) {
  o = o || {};
  ctx.font = (o.weight || 800) + ' ' + size + 'px ' + FONT;
  if (o.maxW) { const w = ctx.measureText(s).width; if (w > o.maxW) { size = size * o.maxW / w; ctx.font = (o.weight || 800) + ' ' + size + 'px ' + FONT; } }
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  if (o.stroke) { ctx.lineWidth = o.sw || 4; ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

/* ============================================================
   背景
   ============================================================ */
function drawScene(t) {
  let g = ctx.createLinearGradient(0, 0, 0, CT);
  g.addColorStop(0, PALETTE.skyTop); g.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 3; i++) {
    const cx = ((i * 150 + t * (5 + i * 2)) % (W + 140)) - 70, cy = 130 + i * 46;
    circ(cx, cy, 16); ctx.fill(); circ(cx + 16, cy + 4, 12); ctx.fill(); circ(cx - 16, cy + 5, 11); ctx.fill();
  }
  if (G.state === 'title') {
    const sx = 84, sy = CT - 56, gl = ctx.createRadialGradient(sx, sy, 6, sx, sy, 70);
    gl.addColorStop(0, 'rgba(255,244,190,0.95)'); gl.addColorStop(0.35, 'rgba(255,226,160,0.45)'); gl.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx - 80, sy - 80, 160, 160);
    ctx.fillStyle = '#fff3c4'; circ(sx, sy, 20); ctx.fill();
  }
  ctx.fillStyle = PALETTE.hillFar;
  ctx.beginPath(); ctx.moveTo(0, CT);
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, CT - 64 - 26 * Math.sin(x * 0.018 + 1.2));
  ctx.lineTo(W, CT); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PALETTE.hillNear;
  ctx.beginPath(); ctx.moveTo(0, CT);
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, CT - 26 - 16 * Math.sin(x * 0.03 + 3.1));
  ctx.lineTo(W, CT); ctx.closePath(); ctx.fill();

  g = ctx.createLinearGradient(0, Math.max(CTL, CTR), 0, FL);
  g.addColorStop(0, PALETTE.hazeTop); g.addColorStop(1, PALETTE.hazeBottom);
  const VR = RC ? R : W;
  ctx.fillStyle = g; ctx.fillRect(L, Math.max(CTL, CTR), VR - L, FL - Math.max(CTL, CTR));
  ctx.fillStyle = PALETTE.floor;
  ctx.beginPath(); ctx.moveTo(L, H);
  for (const q of TER) ctx.lineTo(clamp(q.x, L, VR), q.y);
  ctx.lineTo(VR, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PALETTE.floorDark;
  for (const p of pebbles) { circ(p.x, p.y, p.r); ctx.fill(); }
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
  TER.forEach(function (q, i) { const x = clamp(q.x, L, VR), y = q.y - 1.5; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.stroke(); ctx.restore();
  if (G.state === 'prep' && !CONFIG.cliffSticky) {
    ctx.save(); ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 18; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(150,255,170,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); TER.forEach(function (q, i) { const x = clamp(q.x, L + 3, VR - 3), y = q.y - 5; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    ctx.restore();
  }

  for (const PL of PILLARS) {
    drawCliff(PL.x0, PL.x1, PL.top);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(PL.x0, PL.top + 10, 3, FL - PL.top + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(PL.x1 - 3, PL.top + 10, 3, FL - PL.top + 20);
  }
  drawCliff(0, L, CTL);
  if (RC) drawCliff(R, W, CTR);
  drawBranches(); drawClouds(t); drawBalloons(t);
  if (WIND) drawWind(G.clock);
  if (SPRING) drawSpring(G.clock);

  ctx.fillStyle = '#c99a5b'; rr(4, CTL - 30, 26, 16, 3); ctx.fill();
  ctx.fillStyle = PALETTE.earthDark; ctx.fillRect(15, CTL - 14, 4, 14);
  txt('▶', 17, CTL - 18, 11, '#fff', { align: 'center' });
  const fx = CONFIG.goalX;
  ctx.fillStyle = '#f5f0e6'; ctx.fillRect(fx - 1.5, CTR - 46, 3, 46);
  ctx.fillStyle = PALETTE.fail;
  ctx.beginPath(); ctx.moveTo(fx + 1.5, CTR - 46); ctx.lineTo(fx + 20, CTR - 39 + Math.sin(t * 5) * 1.5); ctx.lineTo(fx + 1.5, CTR - 32); ctx.closePath(); ctx.fill();
}

/* 下からの風: 谷底の吹き出し口から、上向きの筋が立ちのぼる(スライムの後ろに描く) */
function drawSpring(t) {
  const s = SPRING, dt = s.hit === undefined ? -1 : t - s.hit;
  const sq = dt >= 0 && dt < 1.2 ? 1 + 0.45 * Math.exp(-dt * 7) * Math.cos(dt * 26) : 1;
  const h = 24 * sq, x0 = s.x, x1 = s.x + s.w, cx = (x0 + x1) / 2, y0 = s.y;
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  const gl = ctx.createRadialGradient(cx, y0 - 16, 2, cx, y0 - 16, 30 + 5 * pulse);
  gl.addColorStop(0, 'rgba(255,230,90,0.65)'); gl.addColorStop(1, 'rgba(255,230,90,0)');
  ctx.fillStyle = gl; ctx.fillRect(cx - 40, y0 - 56, 80, 70);
  ctx.fillStyle = '#5b3a1e'; rr(x0 - 4, y0 - 5, s.w + 8, 5, 2); ctx.fill();
  const coil = function () { ctx.beginPath(); ctx.moveTo(cx, y0 - 5); for (let i = 1; i <= 6; i++) ctx.lineTo(i % 2 ? x0 + 1 : x1 - 1, y0 - 5 - h * i / 6); ctx.lineTo(cx, y0 - 5 - h); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 7; coil(); ctx.stroke();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; coil(); ctx.stroke();
  ctx.fillStyle = '#5b3a1e'; rr(x0 - 6, y0 - 5 - h - 8, s.w + 12, 9, 4); ctx.fill();
  ctx.fillStyle = '#e0503a'; rr(x0 - 4, y0 - 5 - h - 7, s.w + 8, 6, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x0 - 1, y0 - 5 - h - 6, s.w + 2, 1.5);
  if (G.state === 'prep' || G.state === 'title') {
    ctx.strokeStyle = '#e0503a'; ctx.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      const u = ((t * 1.1 + k * 0.5) % 1), yy = y0 - 46 - u * 26;
      ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.moveTo(cx - 8, yy + 5); ctx.lineTo(cx, yy - 4); ctx.lineTo(cx + 8, yy + 5); ctx.stroke();
    }
  }
  ctx.restore();
}
/* ステージ2「ふきあげる かぜ」: しずか → 予告(砂ぼこり) → ふく の くりかえし */
function gustWind() {
  const C = CONFIG;
  return { x0: C.gustX - C.gustW / 2, x1: C.gustX + C.gustW / 2, top: CTR + C.gustTopOff, cyc: [C.gustQuiet, C.gustWarn, C.gustBlow], lift: C.gustLift, rise: C.gustRise, pow: C.gustPow, drift: C.gustDrift, dmax: C.gustDriftMax };
}
function windPhase() {
  const w = WIND;
  if (!w || !w.cyc) return { ph: 'blow', u: 0 };
  const q = w.cyc[0], a = w.cyc[1], b = w.cyc[2], per = q + a + b;
  const t = (((G.clock - (G.windT0 || 0)) % per) + per) % per;
  if (t < q) return { ph: 'quiet', u: t / q };
  if (t < q + a) return { ph: 'warn', u: (t - q) / a };
  return { ph: 'blow', u: (t - q - a) / b };
}
function windOn() { return !!WIND && windPhase().ph === 'blow'; }
/* 予告の砂ぼこりを出す(かぜは空中の人だけ運ぶ。倒れている人は吹き上げない) */
function updateWind(dt) {
  if (!WIND || !WIND.cyc || (G.state !== 'walk' && G.state !== 'prep')) return;
  const ph = windPhase().ph, fy = floorAt((WIND.x0 + WIND.x1) / 2);
  if (ph === 'warn' && Math.random() < dt * 40) G.particles.push({ x: rand(WIND.x0, WIND.x1), y: fy - 2, vx: rand(-14, 14), vy: rand(-70, -35), r: rand(1.4, 2.8), life: rand(0.35, 0.6), age: 0, col: 'rgba(214,186,140,0.95)' });
  G.windPrev = ph;
}
function drawWind(t) {
  const w = WIND, y0 = Math.max(floorAt(w.x0), floorAt(w.x1)), h = y0 - w.top, on = windOn();
  ctx.save();
  ctx.beginPath(); ctx.rect(w.x0, w.top, w.x1 - w.x0, h + 4); ctx.clip();
  if (!on) ctx.globalAlpha = 0;
  const g = ctx.createLinearGradient(0, y0, 0, w.top);
  g.addColorStop(0, 'rgba(255,255,255,0.30)'); g.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = g; ctx.fillRect(w.x0, w.top, w.x1 - w.x0, h + 4);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const n = 7, cw = (w.x1 - w.x0) / n;
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.55 + i * 0.37) % 1, cx = w.x0 + (i + 0.5) * cw + Math.sin(t * 2.2 + i * 1.7) * 3;
    const y = y0 - ph * h, a = Math.sin(Math.PI * ph);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * a).toFixed(2) + ')'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(cx, y + 16); ctx.quadraticCurveTo(cx + 4, y + 8, cx, y); ctx.quadraticCurveTo(cx - 4, y - 8, cx, y - 14); ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(cx - 4, y - 8); ctx.lineTo(cx, y - 14); ctx.lineTo(cx + 4, y - 8); ctx.stroke();
  }
  ctx.restore();
  // 吹き出し口(谷底にそって置く)
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a5a62'; ctx.lineWidth = 7; line(w.x0, floorAt(w.x0) - 3, w.x1, floorAt(w.x1) - 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6;
  for (let i = 1; i < 8; i++) { const x = w.x0 + (w.x1 - w.x0) * i / 8, y = floorAt(x) - 3; line(x, y - 2, x, y + 2); }
  ctx.restore();
}

function drawCliff(x0, x1, top) {
  ctx.fillStyle = PALETTE.earth; ctx.fillRect(x0, top, x1 - x0, H - top);
  ctx.fillStyle = PALETTE.earthDark;
  for (let y = top + 34; y < H; y += 38) ctx.fillRect(x0, y, x1 - x0, 3);
  ctx.fillStyle = PALETTE.grass; ctx.fillRect(x0, top, x1 - x0, 10);
  ctx.fillStyle = PALETTE.grassDark; ctx.fillRect(x0, top + 8, x1 - x0, 3);
  ctx.fillStyle = PALETTE.grass;
  for (const t of tufts) {
    if (t.x < x0 || t.x > x1) continue;
    ctx.beginPath(); ctx.moveTo(t.x - 2, top + 1); ctx.lineTo(t.x, top - t.s); ctx.lineTo(t.x + 2, top + 1); ctx.closePath(); ctx.fill();
  }
}

/* ============================================================
   スライムの描画
   free: 明るい色 + 点滅する白い縁 / held: 黄色く強く光る / fixed: 落ち着いた色
   ============================================================ */
function slimePath(P) {
  const n = P.length;
  ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
  if (n === 2) { ctx.lineTo(P[1].x, P[1].y); return; }
  for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(P[i].x, P[i].y, (P[i].x + P[i + 1].x) / 2, (P[i].y + P[i + 1].y) / 2);
  ctx.lineTo(P[n - 1].x, P[n - 1].y);
}

function drawSlime(s, t, lookX) {
  if (s.plank) { drawSawPlank(s); return; }
  const n = s.pts.length;
  const settling = s.state === 'settle';
  const fixed = s.state === 'fixed' || settling;
  const amp = settling ? 0.9 : (fixed ? 0.25 : (s.state === 'held' ? 1.8 : 1.2));
  const P = [];
  for (let i = 0; i < n; i++) {
    const env = Math.sin(Math.PI * i / Math.max(1, n - 1));
    P.push({
      x: s.pts[i].x + amp * 0.4 * Math.sin(t * 9 + i * 0.7) * env,
      y: s.pts[i].y + amp * Math.sin(t * 11 + i * 0.5) * env
    });
  }
  // 試作: ぷるん(重心まわりにふくらんで ゆれる)
  const pa = t - (s.purunAt === undefined ? -99 : s.purunAt), cool = fixed && pa < CONFIG.purunCool;
  let pk = 0;
  if (pa >= 0 && pa < 0.9) {
    pk = Math.exp(-4.5 * pa) * Math.cos(pa * 26);
    const c0 = centroidOf(P), sx = 1 + (s.blob ? 0.16 : 0.07) * pk, sy = 1 - (s.blob ? 0.2 : 0.12) * pk;
    for (const q of P) { q.x = c0.x + (q.x - c0.x) * sx; q.y = c0.y + (q.y - c0.y) * sy - (s.blob ? 0 : 5 * pk); }
  }
  let th = s.thick * (1 + 0.45 * pk);
  const age = t - s.stuckAt;
  if (fixed && age < 0.4) th *= 1 + 0.35 * (1 - age / 0.4) * Math.sin(age * 32);
  if (settling) { const sa = t - s.settleAt; th *= 1 + 0.2 * Math.exp(-2.5 * sa) * Math.sin(sa * 28); }
  const base = PALETTE.slimes[s.ci];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (!fixed) {
    ctx.save(); ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 26; ctx.lineCap = 'butt';
    slimePath(P); ctx.lineWidth = th + 12; ctx.strokeStyle = s.state === 'held' ? '#ffd23f' : '#ffffff'; ctx.stroke();
    ctx.restore();
    const pulse = 0.5 + 0.5 * Math.sin(t * 9);
    slimePath(P);
    ctx.lineWidth = th + (s.state === 'held' ? 11 : 9);
    ctx.strokeStyle = s.state === 'held' ? 'rgba(255,236,110,0.8)' : 'rgba(255,255,255,' + (0.2 + 0.5 * pulse).toFixed(2) + ')';
    ctx.stroke();
  }
  if ((G.state === 'walk' || G.state === 'title') && fixed && s.riders > 0 && !cool) {   // 試作: いま押せば人が飛ぶスライムは、ふちが光る
    slimePath(P); if (s.blob) ctx.closePath(); ctx.lineWidth = th + 8 + 3 * Math.sin(t * 12); ctx.strokeStyle = 'rgba(255,240,130,0.9)'; ctx.stroke();
  }
  slimePath(P); if (s.blob) ctx.closePath(); ctx.lineWidth = th + 3.5; ctx.strokeStyle = 'rgba(20,80,50,0.5)'; ctx.stroke();
  const bodyCol = cool ? 'rgb(' + base.map(function (v) { return Math.round(v * 0.72 + 40); }).join(',') + ')' : (fixed ? rgb(base) : mix(base, 0.32));
  if (s.blob) { slimePath(P); ctx.closePath(); ctx.fillStyle = bodyCol; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; }
  slimePath(P); ctx.lineWidth = th; ctx.strokeStyle = bodyCol; ctx.globalAlpha = s.blob ? 1 : 0.9; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(0, -th * 0.2);
  slimePath(P); ctx.lineWidth = Math.max(1.5, th * 0.28); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke();
  ctx.restore();

  const f = s.blob ? centroidOf(P) : P[s.face];
  // 試作: タップできるかどうかを見た目で出す。
  //  ・待ち時間中: ぐるっと回る輪が たまっていく(まだ押せない)
  //  ・押せて、上に人がいる: 黄色い輪と ▼ が ぴょこぴょこ(いま押すと飛ばせる)
  if (G.state === 'prep' && fixed) {   // 積み試作: 準備中は、何だん目かを小さく見せる
    const n = powerMarks(s), c2 = P[s.face];
    if (n >= 2 && isStackTop(s)) drawPowerMarks(c2.x, c2.y - th * 0.5 - 13, n);   // 塔の とちゅうには出さない
  }
  if ((G.state === 'walk' || G.state === 'title') && fixed && (cool || s.riders > 0)) {
    const c1 = s.blob ? centroidOf(P) : P[s.face], mk = c1.y - th * (s.blob ? 0.5 : 0.5) - 20;
    ctx.save(); ctx.lineCap = 'round';
    if (cool) {
      const u = clamp(pa / CONFIG.purunCool, 0, 1);
      circ(c1.x, mk, 9); ctx.fillStyle = 'rgba(60,70,70,0.55)'; ctx.fill();
      ctx.beginPath(); ctx.arc(c1.x, mk, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u); ctx.lineWidth = 3.6; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(c1.x, mk, 11.4, 0, Math.PI * 2); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(20,30,30,0.6)'; ctx.stroke();
    } else {
      const bob = Math.sin(t * 9) * 2.2, rr0 = 9 + 1.2 * Math.sin(t * 9);
      ctx.beginPath(); ctx.arc(c1.x, mk + bob, rr0 + 1.8, 0, Math.PI * 2); ctx.lineWidth = 1.6; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
      ctx.beginPath(); ctx.arc(c1.x, mk + bob, rr0, 0, Math.PI * 2); ctx.fillStyle = '#ffd23f'; ctx.fill();
      circ(c1.x, mk + bob, 3.2); ctx.fillStyle = '#fff'; ctx.fill();
      if (G.state === 'walk' && powerMarks(s) >= 2) { const n = powerMarks(s); drawPowerMarks(c1.x + rr0 + 8 + (9 * n + 8) / 2, mk + bob, n); }   // 積み試作: ぷるんの強さ(人に かくれないよう 輪の右に)
      ctx.beginPath(); ctx.moveTo(c1.x - 5, mk + bob + rr0 + 3); ctx.lineTo(c1.x + 5, mk + bob + rr0 + 3); ctx.lineTo(c1.x, mk + bob + rr0 + 9); ctx.closePath();
      ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    }
    ctx.restore();
  }
  if (s.kind) drawShapeMark(f.x + th * 0.6 + 9, f.y + 3, s.kind);   // 形の印
  drawFace(f.x, f.y, s.blob ? Math.max(th, 15) : th, settling || cool ? 'worry' : (fixed ? 'calm' : (s.state === 'held' ? 'worry' : 'excited')), t + s.born, lookX);
}

function drawFace(x, y, thick, expr, t, lookX) {
  const eyeR = clamp(thick * 0.32, 3.4, 5);
  const ex = eyeR + 1.1, ey = -1;
  const blink = ((t * 0.9) % 3.2) < 0.12 ? 0.15 : 1;
  ctx.save(); ctx.translate(x, y);
  for (let s = -1; s <= 1; s += 2) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.ellipse(s * ex, ey, eyeR, eyeR * blink, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (blink > 0.5) {
      ctx.fillStyle = PALETTE.ink;
      circ(s * ex + (lookX || 0), ey + (expr === 'worry' ? eyeR * 0.15 : 0), eyeR * (expr === 'excited' ? 0.6 : 0.5)); ctx.fill();
    }
    if (expr === 'worry') {
      ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.3;
      const inner = -s;
      line(s * ex - inner * eyeR, ey - eyeR - 0.8, s * ex + inner * eyeR, ey - eyeR - 3.6);
    }
  }
  const my = ey + eyeR + 3.4;
  ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.2;
  if (expr === 'calm') {
    ctx.beginPath(); ctx.arc(0, my - 1.8, 2.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else if (expr === 'excited') {
    ctx.fillStyle = PALETTE.ink; ctx.beginPath(); ctx.ellipse(0, my + 0.4, 2.1, 1.7 + 0.5 * Math.sin(t * 9), 0, 0, Math.PI); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-3.4, my);
    for (let k = 1; k <= 4; k++) ctx.lineTo(-3.4 + k * 1.7, my + (k % 2 ? -1.1 : 1.1));
    ctx.stroke();
  }
  ctx.restore();
}

/* 着地予想(ゴースト)の位置に置いたら ▲いくつか。乗る先のスライムの ▲+1(固まったあとに ずれることはある) */
function ghostMarks(s, g) {
  const C = CONFIG, cap = 1 + Math.floor((C.stackMax - 1) / C.stackPer + 1e-6);
  const A = { pts: g.pts, thick: s.thick };
  let n = 1;
  for (const B of G.slimes) if (B.state === 'fixed' && restsOn(A, B)) n = Math.max(n, 1 + stackOf(B));
  return Math.min(n, cap);
}
/* 準備中: つかんでいる間だけ、ゴーストのてっぺんから ふつうの人(ミディアム)が ぷるんで とぶ線をうすく出す */
function drawGhostHop(s, g, n, t) {
  const C = CONFIG;
  let top = g.pts[0];
  for (const q of g.pts) if (q.y < top.y) top = q;
  const power = Math.min(C.stackMax, 1 + C.stackPer * (n - 1)) * shapeOf(s).purun;
  const V = Math.sqrt(2 * C.personGravity * C.stackH * power);
  let x = top.x, y = top.y - s.thick / 2 - 8, vx = C.walkSpeed + V * C.purunFwd, vy = -V;
  const h = 1 / 30;
  ctx.save();
  for (let i = 0; i < 60; i++) {
    x += vx * h; vy += C.personGravity * h; y += vy * h;
    if (x > W - 4 || y > FL) break;
    if (vy > 0) { const c = candidatesAt(x), gy = slimeTopAt(g, x); if (gy !== null) c.push(gy - s.thick / 2); if (c.some(function (cy) { return y >= cy && y - vy * h <= cy + 1; })) { ctx.globalAlpha = 0.85; circ(x, y, 5); ctx.lineWidth = 2; ctx.strokeStyle = '#e0951a'; ctx.stroke(); break; } }
    if (i % 2) continue;
    ctx.globalAlpha = 0.8 * (1 - i / 80); ctx.fillStyle = '#fff'; circ(x, y, 2.8); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = '#e0951a'; ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
/* 落ちていく先の輪郭と、そこまでの落下ライン */
function drawGhost(s, t) {
  const g = s.ghost;
  if (!g) return;
  const held = s.state === 'held';
  const col = held ? 'rgba(255,215,60,0.95)' : 'rgba(255,255,255,0.9)';
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  slimePath(g.pts); ctx.lineWidth = s.thick; ctx.strokeStyle = held ? 'rgba(255,225,90,0.22)' : 'rgba(255,255,255,0.16)'; ctx.stroke();
  ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 14;
  slimePath(g.pts); ctx.lineWidth = s.thick + 2; ctx.strokeStyle = col; ctx.stroke();
  const a = bboxOf(s.pts), b = bboxOf(g.pts);
  const x1 = (a.x0 + a.x1) / 2, y1 = a.y1 + s.thick / 2 + 3, x2 = (b.x0 + b.x1) / 2, y2 = b.y0 - s.thick / 2 - 3;
  if (y2 > y1 + 16) {
    ctx.setLineDash([4, 8]); ctx.lineDashOffset = -t * 48; ctx.lineWidth = 2.4; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2 - 8); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x2 - 6, y2 - 10); ctx.lineTo(x2 + 6, y2 - 10); ctx.lineTo(x2, y2 - 1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (G.state === 'prep' && !s.demo) {   // 積み試作: 置いたら ▲いくつ・どこまで とぶか
    const n = ghostMarks(s, g);
    if (held) drawGhostHop(s, g, n, t);
    if (n >= 2) drawPowerMarks((b.x0 + b.x1) / 2, b.y0 - s.thick / 2 - 13, n);
  }
}

/* 「つかめる」の目印: スライムの上に浮かぶ四方向の矢印バッジ */
function drawHandle(s, t) {
  const bb = bboxOf(s.pts), held = s.state === 'held';
  const hx = clamp((bb.x0 + bb.x1) / 2, 24, W - 24);
  const by = bb.y0 - s.thick / 2 - 22 + Math.sin(t * 6) * 3;
  if (by < -16 || by > H) return;
  ctx.save(); ctx.translate(hx, by);
  const k = held ? 1.15 : 1 + 0.06 * Math.sin(t * 6);
  ctx.scale(k, k);
  circ(0, 0, 12.5); ctx.fillStyle = held ? '#ffd23f' : '#ffffff'; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineWidth = 1.7; ctx.strokeStyle = PALETTE.ink; ctx.fillStyle = PALETTE.ink;
  line(-6, 0, 6, 0); line(0, -6, 0, 6);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const d of dirs) {
    const px = -d[1], py = d[0];
    ctx.beginPath();
    ctx.moveTo(d[0] * 10, d[1] * 10);
    ctx.lineTo(d[0] * 5.6 + px * 2.8, d[1] * 5.6 + py * 2.8);
    ctx.lineTo(d[0] * 5.6 - px * 2.8, d[1] * 5.6 - py * 2.8);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (!G.taught && !held && by > 20) {
    const right = hx + 20 + 142 <= W - 6, x0 = right ? hx + 20 : hx - 20 - 142;
    rr(x0, by - 12, 142, 24, 12); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    txt(i18n('dragHint'), x0 + 71, by + 4.5, 12.5, PALETTE.ink, { align: 'center', maxW: 132 });
  }
}

/* ---------- 高さの帯(人が歩ける高さ)と、はみ出しの警告 ---------- */
function bandY(x, off) { const u = clamp((x - L) / (R - L), 0, 1); return CTL + (CTR - CTL) * u + off; }
function drawGuide(t, bad) {
  const top = -CONFIG.jumpUp * 0.7, bot = CONFIG.jumpDown, pulse = 0.5 + 0.5 * Math.sin(t * 8);
  ctx.fillStyle = bad ? 'rgba(255,90,70,' + (0.12 + 0.1 * pulse).toFixed(2) + ')' : 'rgba(130,255,170,0.15)';
  ctx.beginPath(); ctx.moveTo(L, bandY(L, top)); ctx.lineTo(R, bandY(R, top)); ctx.lineTo(R, bandY(R, bot)); ctx.lineTo(L, bandY(L, bot)); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 12; ctx.lineWidth = 1.8; ctx.lineCap = 'butt';
  ctx.strokeStyle = bad ? 'rgba(255,110,90,0.95)' : 'rgba(170,255,190,0.9)'; line(L, bandY(L, top), R, bandY(R, top));
  ctx.strokeStyle = 'rgba(170,255,190,0.55)'; line(L, bandY(L, bot), R, bandY(R, bot));
  ctx.restore();
  // 進む向きの矢印(帯の傾きに合わせて斜めに流れる)
  const ang = Math.atan2(CTR - CTL, R - L), span = R - L;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.4;
  for (let k = 0; k < 6; k++) {
    const x = L + ((t * 34 + k * span / 6) % span);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.75 * Math.sin(Math.PI * (x - L) / span)).toFixed(2) + ')';
    ctx.save(); ctx.translate(x, bandY(x, 0)); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(3, 0); ctx.lineTo(-3, 5); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // 左右の崖の高さが違うとき: 左の崖の高さを点線で延ばし、差を矢印とことばで見せる
  const diff = CTL - CTR;
  if (Math.abs(diff) > 8) {
    const hi = Math.min(CTL, CTR), lo = Math.max(CTL, CTR), bob = Math.sin(t * 5) * 2.5;
    ctx.save(); ctx.setLineDash([3, 5]); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    line(L, CTL, W, CTL);
    ctx.setLineDash([]); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#ffe36b';
    const ax = diff > 0 ? R + 14 : L - 14, up = diff > 0 ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(ax, lo - 3); ctx.lineTo(ax, hi + 5 + bob * (diff > 0 ? 1 : 0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax - 6, hi + 12 + bob); ctx.lineTo(ax, hi + 4 + bob); ctx.lineTo(ax + 6, hi + 12 + bob); ctx.stroke();
    ctx.restore();
    txt(i18n('higher'), ax + (diff > 0 ? 22 : -22), (hi + lo) / 2 + 4, 13, '#ffe36b', { align: 'center', stroke: PALETTE.ink, sw: 4, weight: 700 });
  }
}

function drawWarn(s, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 8);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  slimePath(s.pts); ctx.lineWidth = s.thick + 8; ctx.strokeStyle = 'rgba(255,60,50,' + (0.25 + 0.6 * pulse).toFixed(2) + ')'; ctx.stroke();
  ctx.restore();
  let top = s.pts[0];
  for (const p of s.pts) if (p.y < top.y) top = p;
  const by = top.y - s.thick / 2 - 15 + Math.sin(t * 8) * 2;
  circ(top.x, by, 9); ctx.fillStyle = PALETTE.fail; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineWidth = 2.2; line(top.x, by - 4.5, top.x, by + 1);
  circ(top.x, by + 4.6, 1.3); ctx.fillStyle = '#fff'; ctx.fill();
}

/* ---------- 消しゴム ---------- */
/* 針(画びょう)。先端が (0, 14)、頭が上。w は見た目の大きさの目安(56 で標準) */
function drawEraserIcon(w, h) {
  const k = w / 56;
  ctx.save(); ctx.scale(k, k);
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(-3.5, -6); ctx.lineTo(3.5, -6); ctx.closePath();
  ctx.fillStyle = '#d3dade'; ctx.fill(); ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  rr(-15, -13, 30, 9, 4); ctx.fillStyle = '#e5533f'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9, -13); ctx.lineTo(-6.5, -33); ctx.lineTo(6.5, -33); ctx.lineTo(9, -13); ctx.closePath();
  ctx.fillStyle = '#e5533f'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-4.5, -30, 3, 14);
  ctx.restore();
}

function drawEraser(e, t) {
  const p = e.pts[0];
  let rot = e.rot, sc = 1;
  if (e.state === 'free') rot = Math.sin(t * 5 + e.seed) * 0.18;
  else if (e.state === 'held') { rot = Math.sin(t * 9) * 0.1; sc = 1.12; }
  if (e.state === 'zip') {
    for (let i = 0; i < e.trail.length; i++) {
      const q = e.trail[i];
      ctx.globalAlpha = 0.05 + 0.04 * i; ctx.fillStyle = '#f6a5b8'; circ(q.x, q.y, 8 + i * 0.5); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot); ctx.scale(sc, sc);
  if (e.state === 'held') {
    ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 24; ctx.lineWidth = 3; ctx.strokeStyle = '#ffd23f';
    rr(-24, -40, 48, 62, 12); ctx.stroke(); ctx.setLineDash([]);
  }
  drawEraserIcon(56, 36);
  ctx.restore();
}

/* 消える相手を赤い点線で示し、そこまでの落下ラインと着地位置の消しゴムを見せる */
function drawEraserGuide(e, t) {
  if (e.state !== 'free' && e.state !== 'held') return;
  const tg = e.target, p = e.pts[0], r = CONFIG.eraserRadius;
  if (!tg) return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 10);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  slimePath(tg.s.pts); ctx.lineWidth = tg.s.thick + 10; ctx.strokeStyle = 'rgba(255,60,50,' + (0.25 + 0.6 * pulse).toFixed(2) + ')'; ctx.stroke();
  ctx.restore();
  if (tg.y - r - 2 > p.y + r + 22) {
    ctx.save(); ctx.setLineDash([4, 8]); ctx.lineDashOffset = -t * 50; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,70,70,0.9)';
    ctx.beginPath(); ctx.moveTo(p.x, p.y + r + 8); ctx.lineTo(tg.x, tg.y - r - 4); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = 0.42; ctx.translate(tg.x, tg.y); drawEraserIcon(56, 36); ctx.restore();
  const bx = tg.x + 22, by = tg.y - 22;
  circ(bx, by, 8.5); ctx.fillStyle = PALETTE.fail; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineWidth = 2.2;
  line(bx - 3.2, by - 3.2, bx + 3.2, by + 3.2); line(bx + 3.2, by - 3.2, bx - 3.2, by + 3.2);
}

function drawFade(f) {
  const k = f.age / f.life;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  slimePath(f.pts); ctx.lineWidth = f.thick * (1 + 0.7 * k); ctx.strokeStyle = mix(PALETTE.slimes[f.ci], 0.3 + 0.6 * k);
  ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.stroke();
  ctx.restore();
}

/* 崖の左右の消しゴムマーク。中の小さな絵が「消しゴムが落ちて、最初に触れたものが消える」を繰り返す */
function drawMarks(t, bad) {
  for (const m of MARKS) {
    const pk = clamp((G.clock - m.press) / 0.28, 0, 1);
    const sq = 1 - 0.2 * Math.sin(Math.PI * (1 - pk)) * (pk < 1 ? 1 : 0);
    const nerv = bad ? 1 + 0.06 * Math.sin(t * 9) : 1;
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(bad ? Math.sin(t * 14) * 0.07 : 0); ctx.scale(sq * nerv, sq * nerv);
    circ(0, 3.5, m.r); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    circ(0, 0, m.r); ctx.fillStyle = PALETTE.paper; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    if (bad) { circ(0, 0, m.r + 4.5); ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(255,90,70,' + (0.55 + 0.4 * Math.sin(t * 8)).toFixed(2) + ')'; ctx.stroke(); }
    ctx.save(); circ(0, 0, m.r - 2); ctx.clip();
    const u = (t % 2.6) / 2.6;
    ctx.fillStyle = '#d9c7a1'; ctx.fillRect(-m.r, 12, m.r * 2, 20);
    const blobOn = u < 0.36 || u > 0.74;
    if (blobOn) {
      const sk = u > 0.74 ? Math.min(1, (u - 0.74) / 0.08) : 1;
      rr(-10, 12 - 7 * sk, 20, 7 * sk, 3.5 * sk); ctx.fillStyle = rgb(PALETTE.slimes[0]); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(20,80,50,0.8)'; ctx.stroke();
    }
    let ey = -30, ea = 1, ys = 1;
    if (u < 0.36) { const k = u / 0.36; ey = -30 + 28 * k * k; }
    else if (u < 0.6) { const k = (u - 0.36) / 0.24; ey = -2; ys = 1 - 0.22 * Math.max(0, 1 - k * 3); }
    else if (u < 0.74) { const k = (u - 0.6) / 0.14; ey = -2 - 8 * k; ea = 1 - k; }
    else ea = 0;
    if (u >= 0.36 && u < 0.6) {
      const k = (u - 0.36) / 0.24;
      ctx.fillStyle = rgb(PALETTE.slimes[0]);
      for (let j = 0; j < 5; j++) {
        const a = -Math.PI * (j + 0.5) / 5;
        circ(Math.cos(a) * (6 + 16 * k), 8 + Math.sin(a) * (6 + 16 * k), 2.6 * (1 - k)); ctx.fill();
      }
    }
    if (ea > 0.02) {
      ctx.globalAlpha = ea; ctx.save(); ctx.translate(0, ey); ctx.scale(1, ys); drawEraserIcon(30, 18); ctx.restore();
      if (u < 0.36) { ctx.strokeStyle = 'rgba(42,35,32,0.35)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; line(-4, ey - 12, -4, ey - 18); line(4, ey - 10, 4, ey - 16); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.restore();
  }
}

function nearestWalkerX(x) {
  let best = null, bd = 1e9;
  for (const p of G.people) {
    if (p.state !== 'walk' && p.state !== 'air') continue;
    const d = Math.abs(p.x - x);
    if (d < bd) { bd = d; best = p; }
  }
  return best ? clamp((best.x - x) / 60, -1, 1) : 0;
}

/* ============================================================
   人の描画
   ============================================================ */
/* 試作: 5人の見た目(道具をもった人)。足もとが(0,0)・右向き。太い線とべた塗りで描く。
   体の大きさは LOOKS で人ごとに決める(以前の sw / sh の拡大縮小は使わない) */
const LOOKS = [
  { leg: 3.6, tw: 11.5, th: 7.4, hr: 5.9, col: '#e8594f', arm: '#e8594f' },    // ショート: ニットぼう・ポンチョ
  { leg: 7, tw: 9.4, th: 10, hr: 5.6, col: '#3d7be0', arm: '#ffffff' },        // ミディアム: キャップ
  { leg: 7, tw: 10.4, th: 10.4, hr: 5.7, col: '#f47b20', arm: '#f47b20' },     // レスキュー: ヘルメット・ロープ
  { leg: 6, tw: 11, th: 10, hr: 5.6, col: '#a259d9', arm: '#a259d9' },         // クライマー: リュック
  { leg: 16.5, tw: 7.6, th: 13, hr: 5.1, col: '#2aa198', arm: '#2aa198' }      // トール: マフラー
];
const FG_LW = 1.3, FG_SKIN = '#f6cfa6', FG_PANTS = '#3a3d5c';
function fgBase() { ctx.lineWidth = FG_LW; ctx.strokeStyle = PALETTE.ink; ctx.setLineDash([]); }
function fgEll(x, y, rx, ry, fill, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, 6.3); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }
function fgDot(x, y, r, col) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fillStyle = col || PALETTE.ink; ctx.fill(); }
function fgPoly(pts, fill) { ctx.beginPath(); pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }
function fgRr(x, y, w, h, r, fill) { rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }
function fgLn(x1, y1, x2, y2, w, col) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = w + FG_LW * 2; ctx.strokeStyle = PALETTE.ink; ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); fgBase(); }
function fgCv(a, b, d, w, col) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], d[0], d[1]); ctx.lineWidth = w + FG_LW * 2; ctx.strokeStyle = PALETTE.ink; ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); fgBase(); }
function fgSt(x1, y1, x2, y2, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = w || FG_LW; ctx.stroke(); fgBase(); }
function fgHalf(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }
function fgRing(x, y, r, w, col) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.lineWidth = w + FG_LW * 2; ctx.strokeStyle = PALETTE.ink; ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); fgBase(); }
function fgRect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

function figure(p, pose, phase) {
  let k = p.type ? PERSON_TYPES.indexOf(p.type) : 1; if (k < 0) k = 1;
  const o = LOOKS[k], hip = -o.leg, sh = hip - o.th, hy = sh - o.hr + 1.4, lx = o.tw * 0.22;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; fgBase();
  // 足
  let ax, ay, bx, by;
  if (pose === 'walk') {
    const sn = Math.sin(phase), st = Math.min(4.6, 1.8 + o.leg * 0.3);
    ax = lx + sn * st; ay = -1 - Math.max(0, Math.cos(phase)) * 2.2; bx = -lx - sn * st; by = -1 - Math.max(0, -Math.cos(phase)) * 2.2;
  } else if (pose === 'jump') {
    ax = lx + 2.8; ay = -1 - o.leg * 0.4; bx = -lx - 2.2; by = -1 - o.leg * 0.22;
  } else {
    const w = Math.sin(phase * 2) * 1.6;
    ax = lx + 3 + w; ay = -1; bx = -lx - 3 - w; by = -1;
  }
  fgLn(-lx, hip, bx, by, 2.4, FG_PANTS); fgLn(lx, hip, ax, ay, 2.4, FG_PANTS);
  if (k === 2) { fgDot(ax, ay, 1.7); fgDot(bx, by, 1.7); }                                   // レスキューのブーツ
  // 背中の持ちもの
  if (k === 2) fgRing(-o.tw / 2 - 0.6, sh + 5.4, 4, 1.7, '#e9c27a');                           // ロープ
  if (k === 3) { fgRr(-o.tw / 2 - 6.6, sh + 0.8, 7.4, 9.6, 2.2, '#8a6a3f'); fgEll(-o.tw / 2 - 2.8, sh - 0.6, 4.2, 2.2, '#f0b429'); }   // リュックと ねぶくろ
  if (k === 4) { const w = Math.sin(phase * 1.3) * 1.6; fgCv([-2.6, sh + 1.2], [-9, sh - 0.6 + w], [-13.4, sh + 3.4 - w * 1.4], 2.4, '#fff'); }   // マフラーのしっぽ
  // 胴
  if (k === 0) fgPoly([[-o.tw / 2 - 0.5, hip + 0.8], [-2.2, sh - 0.4], [3.6, sh - 0.4], [o.tw / 2 + 0.5, hip + 0.8]], o.col);
  else fgRr(-o.tw / 2, sh, o.tw, o.th + 1, 3, o.col);
  if (k === 1) { fgSt(-1.6, sh + 0.4, -1.6, sh + 4.4, 1); fgSt(2.4, sh + 0.4, 2.4, sh + 4.4, 1); }
  if (k === 2) { fgRect(-o.tw / 2 + 0.7, sh + 5.4, o.tw - 1.4, 2.2, '#f4f4f0'); fgRect(-o.tw / 2 + 0.7, sh + 6.2, o.tw - 1.4, 0.6, '#b9bcc0'); }
  if (k === 3) fgSt(-2.4, sh + 0.4, -3.4, sh + 9.6, 1.2);
  // うで
  if (pose === 'walk') {
    if (k !== 0) { const sn = Math.sin(phase + Math.PI); fgLn(0.6, sh + 2.6, 3.4 + sn * 2.2, sh + o.th * 0.72, 2, o.arm); }
  } else {
    const w = pose === 'jump' ? 0 : Math.sin(phase * 2.4) * 1.8;
    fgLn(-o.tw * 0.3, sh + 2.4, -o.tw / 2 - 3.6 - w, sh - 4.6, 2, o.arm); fgLn(o.tw * 0.3, sh + 2.4, o.tw / 2 + 3.6 + w, sh - 4.6, 2, o.arm);
  }
  // 顔
  fgEll(1, hy, o.hr, o.hr, FG_SKIN);
  fgDot(1 + o.hr * 0.22, hy + 2.1, 1.05); fgDot(1 + o.hr * 0.7, hy + 2.1, 1.05);
  if (pose !== 'walk' && pose !== 'jump') { ctx.beginPath(); ctx.ellipse(1 + o.hr * 0.46, hy + 4.3, 1.1, 1.4, 0, 0, 6.3); ctx.fillStyle = PALETTE.ink; ctx.fill(); }
  if (k === 4) fgLn(-3, sh + 1.2, 4.6, sh + 1.2, 2.6, '#fff');
  // かぶりもの
  if (k === 0) { fgHalf(1, hy - 0.6, o.hr + 0.7, '#ffd24a'); fgRr(1 - o.hr - 1.4, hy - 1.6, o.hr * 2 + 2.8, 2.4, 1.1, '#fff'); fgEll(1, hy - o.hr - 2.4, 2.1, 2.1, '#fff'); }
  if (k === 1) { fgHalf(1, hy - 1, o.hr + 0.5, '#fff'); fgPoly([[o.hr - 0.4, hy - 2.6], [o.hr + 6, hy - 1.2], [o.hr - 0.4, hy - 0.4]], o.col); }
  if (k === 2) { fgHalf(1, hy - 0.8, o.hr + 1, '#fbf7ee'); fgRect(0, hy - o.hr - 1.3, 2.2, o.hr + 0.3, '#e23b3b'); fgSt(1 - o.hr - 1.6, hy - 0.8, 1 + o.hr + 2.6, hy - 0.8, 1.7); }
  if (k === 3) { fgHalf(1, hy - 1, o.hr + 0.4, '#4aa86b'); fgRr(1 - o.hr - 2.8, hy - 1.9, o.hr * 2 + 5.6, 2.1, 1, '#4aa86b'); }
  if (k === 4) { fgEll(0.4, hy - o.hr - 1.8, 2.3, 3.1, FG_PANTS); fgHalf(1, hy - 1.4, o.hr + 0.3, FG_PANTS); }
  ctx.restore();
}

const PILE_SAYS = [
  { ja: 'いてて…', en: 'Ouch…' }, { ja: 'がんばれー！', en: 'Go, go!', wave: true }, { ja: 'おなか すいた', en: "I'm hungry" },
  { ja: 'ここ すずしいね', en: 'Nice and cool here' }, { ja: 'だいじょうぶ！', en: "I'm OK!", wave: true }
];
function drawPerson(p) {
  if (p.state !== 'pile' && p.state !== 'finish' && p.state !== 'cheer') txt(p.type.name, p.x, p.y - 36 * p.sh - 3, 10, '#fff', { align: 'center', stroke: PALETTE.ink, sw: 3.4, weight: 800 });
  ctx.save();
  if (p.state === 'walk') {
    ctx.translate(p.x, p.y); figure(p, p.climbing ? 'up' : 'walk', p.phase);
  } else if (p.state === 'finish') {
    ctx.translate(p.x, p.y); figure(p, 'walk', p.phase);
  } else if (p.state === 'air') {
    ctx.translate(p.x, p.y);
    if (p.jumping) figure(p, 'jump', p.phase);
    else {
      figure(p, 'up', p.phase);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1;
      rr(-14, -46, 28, 15, 6); ctx.fill(); ctx.stroke();
      txt(p.inWind ? i18n('windTalk') : i18n('fallTalk'), 0, -35, 10, p.inWind ? '#2b6cb0' : PALETTE.ink, { align: 'center', maxW: 26 });
    }
  } else if (p.state === 'rope' || p.state === 'bird' || p.state === 'vine') {
    ctx.translate(p.x, p.y); figure(p, 'up', G.clock * 9);
  } else if (p.state === 'pile') {
    // 試作: ころんと落ちて目をまわす → すぐ起きあがって、のんびり しゃべったり 応援したりする
    const pt = p.pileT === undefined ? 99 : p.pileT, tt = G.clock;
    let rank = 0; for (const q of G.people) if (q !== p && q.state === 'pile' && (q.x < p.x || (q.x === p.x && q.id < p.id))) rank++;
    if (pt < 0.8) {
      ctx.translate(p.x + (p.slide || 0) * (1 - clamp(pt / 0.3, 0, 1)), p.y - 4); ctx.save(); ctx.rotate(p.lie); figure(p, 'up', 0.6 + p.id); ctx.restore();
      for (let k = 0; k < 3; k++) { const a = tt * 7 + k * 2.09; txt('★', 9 * Math.cos(a), -17 + 3 * Math.sin(a), 8, '#ffd23f', { align: 'center', stroke: PALETTE.ink, sw: 2.4 }); }
    } else {
      const up = clamp((pt - 0.8) / 0.35, 0, 1), ph = pt + p.id * 1.04, n = Math.floor(ph / 5.2), talk = pt > 1.5 && ph % 5.2 < 2.0;
      const say = PILE_SAYS[n === 0 ? 0 : (n + p.id) % PILE_SAYS.length], wave = talk && say.wave;
      ctx.translate(p.x, p.y - 4 * (1 - up)); ctx.save(); ctx.rotate(p.lie * (1 - up));
      figure(p, wave ? 'up' : 'walk', wave ? tt * 5 : 0.35 * Math.sin(tt * 2 + p.id)); ctx.restore();
      if (talk && up >= 1) {
        const text = lang === 'ja' ? say.ja : say.en;
        ctx.font = '700 10px ' + FONT; const w = ctx.measureText(text).width + 12, by = -30 * p.sh - 20 - (rank % 3) * 17;   // となりの人と ふきだしが重ならないように段をずらす
        const bx = clamp(-w / 2, L + 3 - p.x, R - 3 - w - p.x);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1; rr(bx, by, w, 15, 6); ctx.fill(); ctx.stroke();
        txt(text, bx + w / 2, by + 11, 10, PALETTE.ink, { align: 'center', weight: 700 });
      }
    }
  } else if (p.state === 'cheer') {
    const big = p.cheerT < 1.2;
    const hop = -Math.abs(Math.sin(p.cheerT * (big ? 9 : 5 + p.id))) * (big ? 12 : 4);
    ctx.translate(p.x, p.y + hop); figure(p, 'up', p.cheerT * 8);
  }
  ctx.restore();
}

/* ============================================================
   手描きエリア・HUD・各画面
   ============================================================ */
function drawArea(t) {
  rr(AX, AY, AS, AS, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  ctx.save();
  ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 14;
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; rr(AX, AY, AS, AS, 14); ctx.stroke();
  ctx.restore();
  if (!G.drawing && G.made === 0) {
    txt(i18n('drawHere')[0], W / 2, AY + AS / 2 - 8, 17, PALETTE.ink, { align: 'center', stroke: 'rgba(255,255,255,0.85)', sw: 5 });
    txt(i18n('drawHere')[1], W / 2, AY + AS / 2 + 14, 17, PALETTE.ink, { align: 'center', stroke: 'rgba(255,255,255,0.85)', sw: 5 });
  } else {
    txt(i18n('drawArea'), AX + 10, AY + 16, 11, 'rgba(42,35,32,0.75)', { weight: 700 });
  }
  if (G.drawing) {
    const d = G.drawing;
    const left = clamp(1 - d.len / CONFIG.maxInk, 0, 1);
    rr(AX + 10, AY + AS - 14, AS - 20, 6, 3); ctx.fillStyle = 'rgba(42,35,32,0.25)'; ctx.fill();
    if (left > 0.01) { rr(AX + 10, AY + AS - 14, (AS - 20) * left, 6, 3); ctx.fillStyle = left > 0.2 ? '#35b565' : PALETTE.fail; ctx.fill(); }
    if (d.len >= CONFIG.maruMinLen) {   // 形: 描きはじめに もどると「まる」
      const a0 = d.pts[0], z0 = d.pts[d.pts.length - 1], near = Math.hypot(a0.x - z0.x, a0.y - z0.y) <= CONFIG.maruClose;
      ctx.save(); ctx.lineWidth = near ? 3.5 : 2.2; ctx.strokeStyle = near ? '#ffd23f' : 'rgba(255,255,255,0.95)'; ctx.setLineDash(near ? [] : [4, 4]); ctx.lineDashOffset = -t * 12;
      circ(a0.x, a0.y, CONFIG.maruClose * (near ? 1 : 0.9 + 0.1 * Math.sin(t * 6))); ctx.stroke(); ctx.restore();
    }
    if (d.pts.length > 1) {
      const fake = { pts: d.pts, thick: CONFIG.slimeThick, state: 'held', ci: 0, born: 0, stuckAt: -99, face: 0 };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      slimePath(fake.pts); ctx.lineWidth = CONFIG.slimeThick + 3.5; ctx.strokeStyle = 'rgba(20,80,50,0.5)'; ctx.stroke();
      slimePath(fake.pts); ctx.lineWidth = CONFIG.slimeThick; ctx.strokeStyle = mix(PALETTE.slimes[G.made % 3], 0.32); ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (d.len >= CONFIG.maruMinLen) { const a0 = d.pts[0], z0 = d.pts[d.pts.length - 1]; if (Math.hypot(a0.x - z0.x, a0.y - z0.y) <= CONFIG.maruClose) txt(lang === 'ja' ? 'はなすと まる！' : 'Release for Round!', W / 2, AY + AS - 28, 12, SHAPE_KINDS.maru.col, { align: 'center', stroke: 'rgba(255,255,255,0.9)', sw: 4, weight: 800 }); }
  }
}

function drawHUD() {
  if (G.state === 'prep') {
    txt(i18n('prep'), 16, 20, 11, '#3b4a48', { weight: 800 });
    rr(16, 25, 168, 14, 7); ctx.fillStyle = 'rgba(42,35,32,0.22)'; ctx.fill();
    const left = clamp(1 - G.t / CONFIG.prepTime, 0, 1);
    if (left > 0.01) { rr(18, 27, 164 * left, 10, 5); ctx.fillStyle = left > 0.25 ? '#35b565' : PALETTE.fail; ctx.fill(); }
    rr(16, 25, 168, 14, 7); ctx.lineWidth = 1.6; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  } else {
    txt(i18n('usedFmt')(G.made), 16, 30, 13, PALETTE.ink, { weight: 800 });
    if (G.medalGot) drawMedalIcon(26, 52, 8, true);   // 積み試作: とったメダル
  }
  txt(i18n('crossedFmt')(G.crossed, CONFIG.people), W - 16, 20, 15, PALETTE.ink, { align: 'right' });
  if (G.state !== 'title') txt(i18n('needFmt')(needOf()), W - 16, 52, 11, '#3b4a48', { align: 'right', weight: 800 });
  for (let i = 0; i < CONFIG.people; i++) {
    const st = G.status[i] || 'wait';
    const x = W - 21 - (CONFIG.people - 1 - i) * 15;
    circ(x, 33, 5); ctx.fillStyle = PALETTE[st]; ctx.fill();
    ctx.lineWidth = 1.3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    if (i + 1 === needOf()) { ctx.strokeStyle = '#e0951a'; ctx.lineWidth = 2; circ(x, 33, 7.4); ctx.stroke(); }
  }
}

function drawBanner(t) {
  const o = { align: 'center', stroke: 'rgba(255,255,255,0.9)', sw: 6 };
  if (G.state === 'prep') {
    const sec = Math.max(0, Math.ceil(CONFIG.prepTime - G.t));
    const urgent = sec <= 5;
    const sc = urgent ? 1 + 0.06 * Math.sin(t * 14) : 1;
    ctx.save(); ctx.translate(W / 2, 80); ctx.scale(sc, sc);
    txt(i18n('countdownFmt')(sec), 0, 0, 22, urgent ? PALETTE.fail : PALETTE.ink, Object.assign({ maxW: W - 24 }, o));
    ctx.restore();
    txt(i18n('stageFmt')((G.stage || 0) + 1, STAGES.length, stageName(G.stage || 0)), W / 2, 134, 14, PALETTE.ink, { align: 'center', stroke: 'rgba(255,255,255,0.9)', sw: 5, weight: 700 });
    if (RC && Math.abs(CTL - CTR) > 8 && !STAGES[G.stage || 0].info) txt(CTR < CTL ? i18n('rightHigh') : i18n('leftHigh'), W / 2, 156, 14, '#b4570a', { align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 700 });
    if (WIND && !STAGES[G.stage || 0].info) txt(i18n('windInfo'), W / 2, 176, 14, '#1f6fb5', { align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 700 });
    if (SPIKES.length && !STAGES[G.stage || 0].info) txt(i18n('spikeInfo'), W / 2, 176, 14, '#b4570a', { align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 700 });
    if (WATER) txt(i18n('waterInfo'), W / 2, 176, 14, '#1f6fb5', { align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 700 });
    if (STAGES[G.stage || 0].info) txt(stInfo(STAGES[G.stage || 0].info), W / 2, 176, 14, '#1d7a43', { align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 700, maxW: W - 20 });
    if (STAGES[G.stage || 0].info2) txt(stInfo(STAGES[G.stage || 0].info2), W / 2, 196, 13, '#9a4a14', { align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 700, maxW: W - 20 });
    if (SPRING) txt(i18n('springInfo'), W / 2, 176, 14, '#c2402a', { align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 700 });
    if (G.keepNote) txt(lang === 'ja' ? 'さっきの 続き！ 描き足そう' : 'Pick up where you left off!', W / 2, 106, 14, '#1d7a43', { align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 800 });
    else txt(i18n('prepTip'), W / 2, 106, 13, PALETTE.ink, { align: 'center', stroke: 'rgba(255,255,255,0.9)', sw: 5, weight: 700 });
  } else if (G.state === 'walk') {
    txt(i18n('willCross'), W / 2, 84, 24, PALETTE.ink, o);
    txt(lang === 'ja' ? 'スライムを タップで ぷるん！' : 'Tap a slime to bounce them!', W / 2, 112, 14, '#1d7a43', { align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 700 });
  }
}

function drawButton(t) {
  const pulse = 1 + Math.sin(t * 4) * 0.02;
  ctx.save(); ctx.translate(BTN.x + BTN.w / 2, BTN.y + BTN.h / 2); ctx.scale(pulse, pulse);
  rr(-BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, 14); ctx.fillStyle = PALETTE.btn; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  txt(i18n('startNow'), 0, 5, 13, '#fff', { align: 'center', maxW: BTN.w - 16 });
  ctx.restore();
}

/* テスト用: ステージ2・3から始めるボタン(タイトルの下のすみ。高さ38px) */
const STAGE_LINKS = [{ x: 14, y: 572, w: 150, h: 38, stage: 1 }, { x: 196, y: 572, w: 150, h: 38, stage: 2 }];
function stageLinkAt(p) { if (!CONFIG.stageLinks) return null; for (const b of STAGE_LINKS) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b; return null; }
const DBG_BTNS = [];   // 跳ばし試作: ステージは1つだけ
function drawIntro() {
  const dt = G.clock - (G.introAt || 0);
  if (dt > 2.6) return;
  const i = G.stage || 0;
  const a = dt < 0.25 ? dt / 0.25 : (dt > 2.1 ? clamp(1 - (dt - 2.1) / 0.5, 0, 1) : 1);
  const sc = dt < 0.5 ? 1 + 0.5 * Math.pow(1 - dt / 0.5, 2) : 1;
  const acc = ['#2fa858', '#d9722b', '#2fa858'][i] || '#2fa858';
  ctx.save();
  if (dt < 0.35) { ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - dt / 0.35)) + ')'; ctx.fillRect(0, 0, W, H); }
  ctx.globalAlpha = a; ctx.translate(W / 2, 286); ctx.scale(sc, sc);
  rr(-140, -62, 280, 124, 26); ctx.fillStyle = 'rgba(255,250,240,0.95)'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = acc; ctx.stroke();
  txt(i18n('introStageFmt')(i + 1), 0, -20, 22, PALETTE.ink, { align: 'center', weight: 800 });
  txt(stageName(i), 0, 22, 40, acc, { align: 'center', weight: 800, stroke: '#fff', sw: 6 });
  if (i18n('stageTags')[i]) txt(i18n('stageTags')[i], 0, 48, 14, PALETTE.ink, { align: 'center', weight: 700 });
  ctx.restore();
}
/* タイトル右上の言語切り替え(日本語 / English) */
const LANG_BTN = { x: W - 120, y: 12, w: 108, h: 28 };
function drawLangToggle() {
  const b = LANG_BTN, hw = b.w / 2;
  rr(b.x, b.y, b.w, b.h, 14); ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  rr(lang === 'ja' ? b.x + 2 : b.x + hw, b.y + 2, hw - 2, b.h - 4, 12); ctx.fillStyle = PALETTE.btn; ctx.fill();
  txt('日本語', b.x + hw / 2 + 1, b.y + 19, 12, lang === 'ja' ? '#fff' : PALETTE.ink, { align: 'center', weight: 700 });
  txt('English', b.x + hw + hw / 2 - 1, b.y + 19, 12, lang === 'en' ? '#fff' : PALETTE.ink, { align: 'center', weight: 700 });
}
/* タイトルの「おと あり / おと なし」。2つ並べて、いまの方を緑で塗る(押した方に切り替わる) */
const SND_SEG = { x: W / 2 - 110, y: 200, w: 220, h: 42 };
function speakerIcon(cx, cy, col, on) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 3); ctx.lineTo(cx - 3, cy - 3); ctx.lineTo(cx + 2, cy - 7); ctx.lineTo(cx + 2, cy + 7); ctx.lineTo(cx - 3, cy + 3); ctx.lineTo(cx - 6, cy + 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  if (on) { ctx.beginPath(); ctx.arc(cx + 3, cy, 5, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 3, cy, 8.5, -0.8, 0.8); ctx.stroke(); }
  else { line(cx + 5, cy - 4, cx + 11, cy + 4); line(cx + 11, cy - 4, cx + 5, cy + 4); }
}
function drawSoundToggle(t) {
  const b = SND_SEG, hw = b.w / 2, on = !SFX.muted;
  rr(b.x, b.y + 3, b.w, b.h, b.h / 2); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();   // 影
  rr(b.x, b.y, b.w, b.h, b.h / 2); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  // 選ばれている方: 緑の丸い札(切り替えたとき少しぽよんとする)
  const k = clamp((G.clock - (G.sndAt || -9)) / 0.3, 0, 1), sq = 1 + 0.08 * Math.sin(Math.PI * k) * (1 - k);
  const sx = on ? b.x + 3 : b.x + hw, sw = hw - 3;
  ctx.save(); ctx.translate(sx + sw / 2, b.y + b.h / 2); ctx.scale(sq, 1 / sq);
  rr(-sw / 2, -(b.h - 6) / 2, sw, b.h - 6, (b.h - 6) / 2); ctx.fillStyle = PALETTE.btn; ctx.fill();
  ctx.restore();
  rr(b.x, b.y, b.w, b.h, b.h / 2); ctx.lineWidth = 2.5; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  const items = [{ on: true, label: i18n('soundOn'), x: b.x }, { on: false, label: i18n('soundOff'), x: b.x + hw }];
  for (const it of items) {
    const sel = it.on === on, col = sel ? '#fff' : 'rgba(42,35,32,0.55)';
    speakerIcon(it.x + 24, b.y + b.h / 2, col, it.on);
    txt(it.label, it.x + 24 + (hw - 24) / 2 + 2, b.y + b.h / 2 + 5.5, 14, col, { align: 'center', weight: 800, maxW: hw - 44 });
  }
}
function soundTap(p) {
  const b = SND_SEG;
  if (p.x < b.x - 6 || p.x > b.x + b.w + 6 || p.y < b.y - 8 || p.y > b.y + b.h + 8) return false;
  const want = p.x < b.x + b.w / 2;   // 左=あり 右=なし
  if (want === SFX.muted) { SFX.setMuted(!want); G.sndAt = G.clock; }
  SFX.tap();
  return true;
}
function langTap(p) {
  const b = LANG_BTN;
  if (p.x < b.x - 4 || p.x > b.x + b.w + 4 || p.y < b.y - 6 || p.y > b.y + b.h + 6) return false;
  setLang(p.x < b.x + b.w / 2 ? 'ja' : 'en');
  SFX.tap();
  return true;
}
function drawTitleOverlay(t) {
  const title = i18n('titleName'), tsz = lang === 'ja' ? 54 : 46;
  ctx.font = '800 ' + tsz + 'px ' + FONT;
  let total = 0; const ws = [];
  for (const ch of title) { const w = ctx.measureText(ch).width; ws.push(w); total += w; }
  // 上に小さく「かける！」(英語ではなし)。少し傾けて、ぴょこぴょこ弾ませる
  const kick = i18n('titleKicker');
  if (kick) {
    ctx.font = '800 30px ' + FONT;
    let kx = W / 2 - ctx.measureText(kick).width / 2, k = 0;
    ctx.save(); ctx.translate(W / 2, 70); ctx.rotate(-0.05); ctx.translate(-W / 2, -70);
    for (const ch of kick) {
      const cw = ctx.measureText(ch).width, hop = -Math.abs(Math.sin(t * 4 - k * 0.6)) * 4;
      txt(ch, kx, 74 + hop, 30, (lang === 'ja' && k >= 4) ? '#2a9a55' : '#e8862a', { stroke: '#fff', sw: 7 });
      ctx.font = '800 30px ' + FONT; kx += cw; k++;
    }
    ctx.restore();
    ctx.font = '800 ' + tsz + 'px ' + FONT;
  }
  let x = W / 2 - total / 2, i = 0;
  for (const ch of title) {
    const y = 128 + Math.sin(t * 3 + i * 0.8) * 5;
    txt(ch, x, y, tsz, PALETTE.btn, { stroke: '#fff', sw: 9 });
    x += ws[i++];
  }
  {   // 遊び方が分かる2行(なぞって橋をかける / 歩行中はタップでジャンプ)
    txt(tl(TITLE_SUB)[0], W / 2, 164, 13.5, PALETTE.ink, { align: 'center', stroke: 'rgba(255,255,255,0.85)', sw: 5, maxW: W - 20 });
    txt(tl(TITLE_SUB)[1], W / 2, 184, 13.5, PALETTE.ink, { align: 'center', stroke: 'rgba(255,255,255,0.85)', sw: 5, maxW: W - 20 });
  }
  drawSoundToggle(t);
  // どこを押してもはじまるので、ボタンではなく点滅する文字で知らせる
  const blink = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 5));
  ctx.save(); ctx.globalAlpha = blink; ctx.translate(W / 2, 274); ctx.scale(1 + 0.03 * Math.sin(t * 5), 1 + 0.03 * Math.sin(t * 5));
  txt(i18n('tapStart'), 0, 0, 24, PALETTE.btn, { align: 'center', stroke: '#fff', sw: 7, maxW: W - 40 });
  ctx.restore();
  // 場面ごとの字幕(描く → ひっぱる → 積み上がる → 渡る)
  if (titleT > 0.3) {
    let cap = '', col = PALETTE.ink, t0 = 0.3;
    const purunEnd = titlePurunT + 2.4;
    let pi = -1;
    for (let i = 0; i < TITLE_PLAN.length; i++) if (titleT >= TITLE_PLAN[i].at - TITLE_PLAN[i].trace - 0.2) pi = i;
    if (pi < 0) { cap = TITLE_CAP_AREA; col = '#1d7a43'; t0 = 0.3; }
    else if (titleT < TITLE_WALK) { const pl = TITLE_PLAN[pi]; cap = pl.cap; col = (SHAPE_KINDS[{ zig: 'zig', ellipse: 'maru', bar: 'suji' }[pl.kind]] || {}).col || '#1d7a43'; t0 = pl.at - pl.trace - 0.2; }
    else if (titleTapN === 0 || titleT < purunEnd) { cap = TITLE_CAP_PURUN; col = '#1d7a43'; t0 = TITLE_WALK; }
    else if (G.people.some(function (q) { return q.state === 'pile'; })) { cap = TITLE_CAP_FAIL; col = '#2a6f4a'; t0 = G.status.fallAt || (G.status.fallAt = titleT); }
    else { cap = i18n('titleCaps')[3]; col = '#2a6f4a'; t0 = purunEnd; }
    const a = clamp((titleT - t0) / 0.3, 0, 1);
    ctx.globalAlpha = a;
    tl(cap).split('\n').forEach(function (ln, k) { txt(ln, W / 2, 306 + k * 19 - (1 - a) * 6, 14, col, { maxW: W - 24, align: 'center', stroke: 'rgba(255,255,255,0.92)', sw: 5, weight: 800 }); });   // \n で2行
    ctx.globalAlpha = 1;
  }
  if (CONFIG.devButtons) for (const b of DBG_BTNS) {
    rr(b.x, b.y, b.w, b.h, 13); ctx.fillStyle = 'rgba(30,40,60,0.55)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
    txt(i18n('stageWordFmt')(b.label), b.x + b.w / 2, b.y + 18, 13, '#fff', { align: 'center', weight: 700 });
  }
  if (CONFIG.stageLinks) for (const b of STAGE_LINKS) {
    rr(b.x, b.y, b.w, b.h, 14); ctx.fillStyle = 'rgba(30,40,60,0.6)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
    txt(lang === 'ja' ? 'ステージ' + (b.stage + 1) + 'から' : 'Stage ' + (b.stage + 1), b.x + b.w / 2, b.y + 24, 14, '#fff', { align: 'center', weight: 700 });
  }
  drawLangToggle();
  if (CONFIG.devButtons) txt(i18n('proto'), W / 2, 626, 12, 'rgba(255,255,255,0.85)', { align: 'center', weight: 700 });
}

/* 試作: できた橋に名前をつける。「かたち」+「大きさ」+橋。おなじ橋ならおなじ名前になる(ランダムなし)。
   かたち: かたまりだけ=おだんご / かたまり多め=まるまる / 線がまっすぐ=まっすぐ / 曲がりくねり=ぐにゃぐにゃ / その間=ゆるゆる
   大きさ: 1こ=いっぽん(かたまりは ひとつ) / 高い=のっぽ / 8こ以上=てんこもり / ほかは 高さから「◯だん」
   下の1行は、その回の遊び方から(レスキュー・ぷるんの回数・全員わたった など) */
function bridgeName() {
  const F = G.slimes.filter(function (q) { return q.state === 'fixed' && !q.plank; });
  if (!F.length) return null;
  let b = 0, top = 1e9, bot = -1e9, x0 = 1e9, x1 = -1e9, strSum = 0, strLen = 0;
  for (const q of F) {
    const P = q.pts, r = q.thick / 2;
    for (const pt of P) {
      if (pt.y - r < top) top = pt.y - r; if (pt.y + r > bot) bot = pt.y + r;
      if (pt.x < x0) x0 = pt.x; if (pt.x > x1) x1 = pt.x;
    }
    if (q.blob) { b++; continue; }
    let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
    strSum += Math.hypot(P[P.length - 1].x - P[0].x, P[P.length - 1].y - P[0].y); strLen += len;
  }
  const n = F.length, straight = strLen > 0 ? strSum / strLen : 1, layers = clamp(Math.round((bot - top) / 48), 1, 9), span = x1 - x0;
  // 左3分の1と右3分の1の高さくらべ(正=右が高い)
  let yl = 0, nl = 0, yr = 0, nr = 0;
  for (const q of F) for (const pt of q.pts) { if (pt.x < x0 + span / 3) { yl += pt.y; nl++; } else if (pt.x > x1 - span / 3) { yr += pt.y; nr++; } }
  const tilt = nl && nr && span > 90 ? yl / nl - yr / nr : 0;
  // おなじ橋なら おなじ言葉になるよう、かたちから決まる数でえらぶ(ランダムなし)
  const hs = Math.abs(Math.round(n * 7 + b * 13 + top * 3 + bot * 5 + span * 11 + straight * 97 + tilt * 17));
  const pick = function (arr, k) { return arr[(hs + (k || 0) * 3) % arr.length]; };
  if (lang !== 'ja') {   // English
    const st0 = G.stage || 0, pn0 = G.purunN || 0, all0 = G.crossed === CONFIG.people, resc0 = G.people.some(function (q) { return q.rescued; });
    let a, bb, pr = '';
    if (b === n) a = pick(['Dumpling', 'Rolly-Polly', 'Bun']);
    else if (b >= 2 && b * 2 >= n) a = pick(['Lumpy', 'Squishy', 'Bouncy']);
    else if (Math.abs(tilt) >= 50 && n >= 2) a = tilt > 0 ? pick(['Uphill', 'Climbing'], 1) : pick(['Downhill', 'Slippery'], 1);
    else if (straight >= 0.88) a = pick(['Straight', 'Sleek', 'Arrow']);
    else if (straight <= 0.6) a = pick(['Wiggly', 'Squiggly', 'Noodly']);
    else a = pick(['Easygoing', 'Cozy', 'Lazy']);
    if (n === 1) bb = pick(['Single', 'Lone']);
    else if (n === 2) bb = pick(['Twin', 'Duo']);
    else if (layers >= 5) bb = pick(['Tower', 'Skyscraper']);
    else if (n >= 8) bb = pick(['Overstuffed', 'Packed']);
    else if (span >= 250) bb = pick(['Grand', 'Sprawling']);
    else if (layers <= 1) bb = pick(['Flat', 'Pancake']);
    else bb = layers + '-Layer';
    if (hs % 3 === 0) {
      if (resc0) pr = pick(['Teamwork', 'Rescue']);
      else if (pn0 >= 5) pr = pick(['Boing-Boing', 'Springy']);
      else if (st0 === 1) pr = pick(['Windy', 'Breezy']);
      else if (st0 === 2) pr = pick(['Spike-Dodging', 'Prickly']);
      else if (all0 && pn0 === 0) pr = pick(['Steady', 'Careful']);
    }
    const se2 = [];   // 下の1行は名前ではなく、橋のすがたの描写
    if (b === n) se2.push('Round lumps rolling along', 'A trail of tiny dumplings');
    else if (b >= 2 && b * 2 >= n) se2.push('Held up by plump lumps', 'Puffy and proud');
    if (Math.abs(tilt) >= 50 && n >= 2) se2.push(tilt > 0 ? 'Climbing gently upward' : 'Sliding down to the far side');
    if (b < n) {
      if (straight >= 0.88) se2.push('One clean line across', 'Stretched out straight and tall');
      else if (straight <= 0.6) se2.push('Twisting and turning along', 'Wobbling all the way over');
      else se2.push('A soft, easy curve', 'Gently linked together');
    }
    if (n === 1) se2.push('Just one slime across the gap', 'One brave little slime');
    else if (layers >= 5) se2.push('Stacked up toward the sky', 'Towering high');
    else if (n >= 8) se2.push(n + ' slimes packed tight', 'Piled high with ' + n + ' slimes');
    else if (span >= 250) se2.push('Spanning the whole gap', 'Stretching to the far side');
    else if (layers <= 1) se2.push('Low and flat', 'Spread out nice and wide');
    else se2.push('Stacked ' + layers + ' layers deep', 'Shaped from ' + n + ' slimes');
    return { name: (pr ? pr + ' ' : '') + a + ' ' + bb + ' Bridge', sub: pick(se2, 2) };
  }
  let A, B;
  if (b === n) A = pick(['おだんご', 'ころころ', 'だんご']);
  else if (b >= 2 && b * 2 >= n) A = pick(['まるまる', 'ぽこぽこ', 'もちもち']);
  else if (Math.abs(tilt) >= 50 && n >= 2) A = tilt > 0 ? pick(['のぼり', 'のぼりざか'], 1) : pick(['くだり', 'すべりだい'], 1);
  else if (straight >= 0.88) A = pick(['まっすぐ', 'ぴーん', 'すっきり']);
  else if (straight <= 0.6) A = pick(['ぐにゃぐにゃ', 'くねくね', 'うねうね']);
  else A = pick(['ゆるゆる', 'ふんわり', 'のんびり']);
  if (n === 1) B = b ? pick(['ひとつ', 'ぽつん']) : pick(['いっぽん', 'いっぱつ']);
  else if (n === 2) B = pick(['ふたつ', 'ペア', 'ふたりぐみ']);
  else if (layers >= 5) B = pick(['のっぽ', 'タワー', 'そびえ']);
  else if (n >= 8) B = pick(['てんこもり', 'もりもり', 'ぎっしり']);
  else if (span >= 250) B = pick(['ながーい', 'どーん', 'ひろびろ']);
  else if (layers <= 1) B = pick(['ぺたんこ', 'ひらたい']);
  else B = layers + 'だん';
  // ステージや遊び方の特徴を、ときどき頭につける
  const st = G.stage || 0, pn = G.purunN || 0, all = G.crossed === CONFIG.people, resc = G.people.some(function (q) { return q.rescued; });
  let pre = '';
  if (hs % 3 === 0) {
    if (resc) pre = pick(['たすけあい', 'ひっぱりあげ']);
    else if (pn >= 5) pre = pick(['ぷるぷる', 'ぽよんぽよん']);
    else if (st === 1) pre = pick(['かぜのなか', 'ふきぬけ']);
    else if (st === 2) pre = pick(['イガよけ', 'とげとげ']);
    else if (all && pn === 0) pre = pick(['てくてく', 'しっかり']);
  }
  // 下の1行は名前ではなく、橋のすがたの描写(「橋」で終わらせない)
  const ds = [];
  if (b === n) ds.push('まぁるい かたまりが ごろごろ', 'ころころ ならんだ だんごの みち');
  else if (b >= 2 && b * 2 >= n) ds.push('かたまりが どっしり ささえてる', 'ぽこぽこ ふくらんだ すがた');
  if (Math.abs(tilt) >= 50 && n >= 2) ds.push(tilt > 0 ? 'ゆるやかに のぼっていく' : 'むこうぎしへ すべりおりる');
  if (b < n) {
    if (straight >= 0.88) ds.push('すーっと むこうまで ひとすじ', 'まっすぐ のびた りっぱな せなか');
    else if (straight <= 0.6) ds.push('くねくね まがって つながってる', 'うねうね いきおいよく ぐにゃり');
    else ds.push('ふんわり やわらかな カーブ', 'のんびり ゆるやかに つながってる');
  }
  if (n === 1) ds.push('たったひとつで たにを こえた', 'ぽつんと ひとつ がんばってる');
  else if (layers >= 5) ds.push('そびえるように つみあがった', 'たかーく たかーく つみかさなる');
  else if (n >= 8) ds.push('スライム ' + n + 'こが ぎっしり', 'こんなに つかって ' + n + 'こ！');
  else if (span >= 250) ds.push('たにを ひとまたぎ', 'むこうぎしまで ながーく のびてる');
  else if (layers <= 1) ds.push('ぺたっと ひらたく のびてる', 'ひくーく おちついた すがた');
  else ds.push(layers + 'だんに つみかさなった', 'スライム ' + n + 'こで かたちづくった');
  const sub = pick(ds, 2);
  return { name: (pre ? pre + ' ' : '') + A + ' ' + B + '橋', sub: sub };
}

/* 人1人を いったん別のキャンバスに不透明で描き、alpha をかけて1回で貼る(体や頭が透けて重ならないように)。キャンバスは使い回す */
let _figCv = null;
function drawFigureAlpha(p, pose, phase, x, y, sc, alpha) {
  if (alpha >= 0.999) { ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); figure(p, pose, phase); ctx.restore(); return; }
  const real = ctx, tr = real.getTransform(), k = Math.hypot(tr.a, tr.b) || 1, WW = 90, HH = 110;
  const pw = Math.ceil(WW * k), ph = Math.ceil(HH * k);
  if (!_figCv) _figCv = document.createElement('canvas');
  if (_figCv.width !== pw || _figCv.height !== ph) { _figCv.width = pw; _figCv.height = ph; }
  const fc = _figCv.getContext('2d'); fc.setTransform(1, 0, 0, 1, 0, 0); fc.clearRect(0, 0, pw, ph);
  fc.setTransform(k * sc, 0, 0, k * sc, WW / 2 * k, (HH - 10) * k);
  ctx = fc; try { figure(p, pose, phase); } finally { ctx = real; }
  real.save(); real.globalAlpha = real.globalAlpha * alpha; real.drawImage(_figCv, x - WW / 2, y - (HH - 10), WW, HH); real.restore();
}
/* 渡りかた: レスキューに助けられた「ひも」 > くも > かぜ > たこ > とり > ぷるんで とんだ > あるいた */
const HOW = {
  rope: { ja: 'ひも', en: 'Rope', pop: { ja: 'ひもで とうちゃく！', en: 'Rescued by rope!' } },
  cloud: { ja: 'くも', en: 'Cloud', pop: { ja: 'くもで とうちゃく！', en: 'Cloud ride!' } },
  wind: { ja: 'かぜ', en: 'Wind', pop: { ja: 'かぜで とうちゃく！', en: 'Wind ride!' } },
  climb: { ja: 'のぼった', en: 'Climbed', pop: { ja: 'のぼって とうちゃく！', en: 'Climbed up!' } },
  vine: { ja: 'つる', en: 'Vine', pop: { ja: 'つるで とうちゃく！', en: 'Vine ride!' } },
  kite: { ja: 'たこ', en: 'Kite', pop: { ja: 'たこで とうちゃく！', en: 'Kite ride!' } },
  bird: { ja: 'とり', en: 'Bird', pop: { ja: 'とりで とうちゃく！', en: 'Bird ride!' } },
  purun: { ja: 'ぷるん', en: 'Boing', pop: { ja: 'ぷるんで とうちゃく！', en: 'Boing flight!' } },
  walk: { ja: 'あるいた', en: 'Walked', pop: null }
};
function howCrossed(p) {
  if (p.viaRope) return 'rope';
  if (p.viaCloud) return 'cloud';
  if (p.viaWind) return 'wind';
  if (p.viaVine) return 'vine';
  if (p.viaClimb) return 'climb';
  if (p.viaKite) return 'kite';
  if (p.viaBird) return 'bird';
  if (p.flew) return 'purun';
  return 'walk';
}
function crossPopup(p) {
  const h = HOW[howCrossed(p)];
  if (h.pop) popup(p.x - 24, CTR - 70, h.pop[lang === 'ja' ? 'ja' : 'en'], 12, '#fff', PALETTE.ink, 1.3, 20);
}
/* 渡りかたの小さい絵(中心 x,y。幅は±8くらい) */
function drawHowIcon(kind, x, y) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 1.4; ctx.strokeStyle = PALETTE.ink;
  if (kind === 'rope') { ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.quadraticCurveTo(x - 2, y - 7, x + 2, y); ctx.quadraticCurveTo(x + 5, y + 4, x + 7, y - 5); ctx.strokeStyle = '#c8781a'; ctx.lineWidth = 2.2; ctx.stroke(); }
  else if (kind === 'cloud') { ctx.save(); ctx.translate(x, y + 2); ctx.scale(0.28, 0.28); drawCloudBody(0, 0, 60, 4.5, 2); ctx.restore(); }   // ゲーム中の くもを縮めたもの
  else if (kind === 'wind') { ctx.strokeStyle = '#3b7fc4'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x - 7, y - 3); ctx.quadraticCurveTo(x, y - 8, x + 5, y - 3); ctx.quadraticCurveTo(x + 8, y, x + 4, y + 1); ctx.moveTo(x - 7, y + 3); ctx.quadraticCurveTo(x, y + 6, x + 3, y + 4); ctx.stroke(); }
  else if (kind === 'vine') { ctx.strokeStyle = '#3f8f3f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y - 7); ctx.quadraticCurveTo(x + 4, y - 2, x - 1, y + 3); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x - 1, y + 5, 3, 4.5, 0, 0, 6.3); ctx.fillStyle = '#7bd35a'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = PALETTE.ink; ctx.stroke(); }
  else if (kind === 'climb') { ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x + 3, y + 7); ctx.lineTo(x + 3, y - 7); ctx.stroke(); ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 6, y + 6); ctx.lineTo(x - 6, y - 3); ctx.moveTo(x - 9, y); ctx.lineTo(x - 6, y - 4); ctx.lineTo(x - 3, y); ctx.stroke(); }
  else if (kind === 'kite') { ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 5.5, y - 1); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5.5, y - 1); ctx.closePath(); ctx.fillStyle = '#ff6b7d'; ctx.fill(); ctx.stroke(); }
  else if (kind === 'bird') { ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x - 3, y - 6, x, y); ctx.quadraticCurveTo(x + 3, y - 6, x + 7, y); ctx.stroke(); }
  else if (kind === 'purun') { ctx.strokeStyle = '#d9487a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y + 4); ctx.lineTo(x - 3, y - 4); ctx.lineTo(x, y + 4); ctx.lineTo(x + 3, y - 4); ctx.lineTo(x + 6, y + 3); ctx.stroke(); }
  else { ctx.fillStyle = '#8a6a48'; ctx.beginPath(); ctx.ellipse(x - 3, y + 1, 2.2, 3.6, 0.2, 0, 6.3); ctx.ellipse(x + 3, y - 1, 2.2, 3.6, 0.2, 0, 6.3); ctx.fill(); }
  ctx.restore();
}
/* 5人の わたりかた: 横1列に顔(全身)を並べ、渡れた人の下に絵と一言。落ちた人は うすく出すだけ */
function drawCrossRow(base) {
  const ppl = G.people.slice().sort(function (a, b) { return a.id - b.id; });
  const n = CONFIG.people;
  for (let i = 0; i < n; i++) {
    const p = ppl[i]; if (!p) continue;
    const u = clamp((G.resultT - 0.8 - i * 0.07) / 0.2, 0, 1); if (u <= 0) continue;
    const x = W / 2 + (i - (n - 1) / 2) * 60, ok = p.state === 'finish' || p.state === 'cheer';
    drawFigureAlpha(p, ok ? 'jump' : 'walk', 0.5, x, base, 0.8 * (0.6 + 0.4 * u), (ok ? 1 : 0.3) * u);
    if (ok && u >= 1) {
      const k = howCrossed(p), h = HOW[k], lab = h[lang === 'ja' ? 'ja' : 'en'];
      ctx.save(); ctx.translate(x, base + 11); ctx.scale(1.15, 1.15); drawHowIcon(k, 0, 0); ctx.restore();
      txt(lab, x, base + 30, 11.5, k === 'walk' ? '#6b5a48' : '#1d5a99', { align: 'center', weight: 800, maxW: 58 });
    }
  }
}
const RETRY_KEEP = { x: 45, y: 380, w: 270, h: 52 };
const RETRY_CLR = { x: 80, y: 442, w: 200, h: 38 };
/* クリアしたとき: 大きい「つぎへ」と、小さい「このステージを もういちど」(メダルを ねらいなおす人むけ)。とったメダルは のこる */
function drawClearButtons() {
  const pulse = 1 + 0.03 * Math.sin(G.clock * 6), k = RETRY_KEEP, c = RETRY_CLR, last = (G.stage || 0) + 1 >= STAGES.length;
  ctx.save(); ctx.translate(k.x + k.w / 2, k.y + k.h / 2); ctx.scale(pulse, pulse);
  rr(-k.w / 2, -k.h / 2 + 3, k.w, k.h, 24); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  rr(-k.w / 2, -k.h / 2, k.w, k.h, 24); ctx.fillStyle = PALETTE.btn; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  txt(lang === 'ja' ? (last ? 'クリア画面へ' : '次の ステージへ') : (last ? 'Continue' : 'Next stage'), 0, 8, 20, '#fff', { align: 'center', stroke: PALETTE.ink, sw: 4, maxW: k.w - 20 });
  ctx.restore();
  rr(c.x, c.y, c.w, c.h, 18); ctx.fillStyle = 'rgba(255,250,240,0.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  txt(lang === 'ja' ? 'このステージを もう一度' : 'Play this stage again', c.x + c.w / 2, c.y + 24, 13, PALETTE.ink, { align: 'center', weight: 700, maxW: c.w - 16 });
}
function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
/* 撮る画像用: 左上メダルの右から画面の右はしまで、5人を横1列に大きく。人の絵・わたりかたの絵・文字(白ふち)。渡れなかった人は うすく */
function drawCrossMini(x0) {
  const ppl = G.people.slice().sort(function (a, b) { return a.id - b.id; });
  const n = CONFIG.people, x1 = W - 6, cw = (x1 - x0) / n, base = 50;
  for (let i = 0; i < n; i++) {
    const p = ppl[i]; if (!p) continue;
    const x = x0 + cw * (i + 0.5), ok = p.state === 'finish' || p.state === 'cheer';
    drawFigureAlpha(p, ok ? 'jump' : 'walk', 0.5, x, base, 0.7, ok ? 1 : 0.3);
    if (ok) {
      const k = howCrossed(p), lab = HOW[k][lang === 'ja' ? 'ja' : 'en'];
      ctx.save(); ctx.translate(x, base + 10); drawHowIcon(k, 0, 0); ctx.restore();
      txt(lab, x, base + 29, 11, k === 'walk' ? '#5a4a38' : '#1d5a99', { align: 'center', weight: 800, stroke: '#fff', sw: 4, maxW: cw - 2 });
    }
  }
}
/* 大きい「n / 5」の右に、クリアに必要な人数。足りたら 合格色＋チェック印、足りなければ おだやかな色(責める印はなし) */
function drawNeedMark(cx, cy, n, need) {
  const ok = n >= need, col = ok ? PALETTE.ok : '#8a7f72';
  txt(lang === 'ja' ? 'クリア' : 'Clear', cx, cy - 12, 12, col, { align: 'center', weight: 800 });
  txt(lang === 'ja' ? need + '人以上' : need + '+', cx, cy + 9, lang === 'ja' ? 17 : 24, col, { align: 'center', weight: 900, maxW: 62 });
  if (ok) {
    ctx.save(); ctx.strokeStyle = PALETTE.ok; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 7, cy + 22); ctx.lineTo(cx - 2, cy + 27); ctx.lineTo(cx + 8, cy + 16); ctx.stroke(); ctx.restore();
  }
}
function drawResult() {
  const n = G.crossed, need = needOf(), pass = n >= need, all = n === CONFIG.people;
  const col = pass ? PALETTE.ok : (n === 0 ? PALETTE.fail : '#e08a1e');
  if (pass && G.bridge) {   // 試作: 橋の名前の札つき
    const br = G.bridge;
    ctx.save(); ctx.globalAlpha = 0.78;
    rr(24, 56, 312, 314, 22); ctx.fillStyle = PALETTE.paper; ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    ctx.restore();
    txt(i18n('resultHead'), W / 2, 84, 14, PALETTE.ink, { align: 'center' });
    txt(n + ' / ' + CONFIG.people, W / 2, 132, 46, col, { align: 'center' });
    drawMedalResult(108);
    drawNeedMark(288, 118, n, need);
    txt(all ? i18n('allCrossed') : i18n('cleared'), W / 2, 172, 17, PALETTE.ink, { align: 'center' });
    txt(i18n('resultLineFmt')(need, G.made), W / 2, 190, 11, '#4a5654', { align: 'center', maxW: 296 });
    // 名札(木のふだ)。少しおくれて、ぽんと出る
    const u = clamp((G.resultT - 0.35) / 0.3, 0, 1);
    if (u > 0) {
      const sc = u < 1 ? 0.7 + 0.3 * u + 0.12 * Math.sin(Math.PI * u) : 1;
      ctx.save(); ctx.translate(W / 2, 232); ctx.rotate(-0.015); ctx.scale(sc, sc); ctx.globalAlpha = u;
      rr(-136, -34 + 3, 272, 68, 12); ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fill();
      rr(-136, -34, 272, 68, 12); ctx.fillStyle = '#f7dfa6'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
      rr(-130, -28, 260, 56, 8); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(138,106,72,0.7)'; ctx.stroke();
      ctx.fillStyle = '#8a6a48'; circ(-122, -21, 2.4); ctx.fill(); circ(122, -21, 2.4); ctx.fill();
      txt(lang === 'ja' ? 'この橋の なまえ' : 'Name of this bridge', 0, -15, 10, '#8a5a2b', { align: 'center', weight: 800 });
      txt(br.name, 0, 8, 22, '#1d7a43', { align: 'center', stroke: '#fff', sw: 5, maxW: 250 });
      txt(br.sub, 0, 25, 10, '#8a5a2b', { align: 'center', weight: 700, maxW: 250 });
      ctx.restore();
    }
    drawCrossRow(322);
    if (G.resultT > 0.5) drawClearButtons();
    return;
  }
  ctx.save();
  ctx.globalAlpha = 0.72;
  rr(24, 60, 312, 306, 22); ctx.fillStyle = PALETTE.paper; ctx.fill();
  ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.restore();
  txt(i18n('resultHead'), W / 2, 90, 15, PALETTE.ink, { align: 'center' });
  txt(n + ' / ' + CONFIG.people, W / 2, 150, 56, col, { align: 'center' });
  drawMedalResult(116);
  drawNeedMark(290, 126, n, need);
  ctx.strokeStyle = 'rgba(42,35,32,0.2)'; ctx.lineWidth = 2; line(60, 184, 300, 184);
  let msg = i18n('almost');
  if (all) msg = i18n('allCrossed');
  else if (pass) msg = i18n('cleared');
  else if (n === 0) msg = i18n('allFell');
  txt(msg, W / 2, 212, 20, PALETTE.ink, { align: 'center' });
  txt(i18n('resultLineFmt')(need, G.made), W / 2, 236, 12, '#4a5654', { align: 'center', maxW: 296 });
  drawCrossRow(322);
  if (G.resultT > 0.5) {
    if (G.crossed >= needOf()) drawClearButtons();
    else {
      const pulse = 1 + 0.03 * Math.sin(G.clock * 6), k = RETRY_KEEP, c = RETRY_CLR;
      ctx.save(); ctx.translate(k.x + k.w / 2, k.y + k.h / 2); ctx.scale(pulse, pulse);
      rr(-k.w / 2, -k.h / 2 + 3, k.w, k.h, 24); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
      rr(-k.w / 2, -k.h / 2, k.w, k.h, 24); ctx.fillStyle = PALETTE.btn; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
      txt(lang === 'ja' ? '続きから 描き足す' : 'Keep building', 0, 8, 20, '#fff', { align: 'center', stroke: PALETTE.ink, sw: 4, maxW: k.w - 20 });
      ctx.restore();
      rr(c.x, c.y, c.w, c.h, 18); ctx.fillStyle = 'rgba(255,250,240,0.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
      txt(lang === 'ja' ? '全部 消して やり直す' : 'Start over', c.x + c.w / 2, c.y + 24, 13, PALETTE.ink, { align: 'center', weight: 700, maxW: c.w - 16 });
    }
  }
}

/* ============================================================
   描画
   ============================================================ */
function demoLine(x0, y0, x1, y1, ph, ci) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    pts.push({ x: lerp(x0, x1, u) + Math.sin(u * 6 + ph) * 2, y: lerp(y0, y1, u) + Math.cos(u * 6 + ph) * 2 });
  }
  return { pts: pts, thick: CONFIG.slimeThick * CONFIG.thickScale, state: 'fixed', ci: ci, born: ph, stuckAt: -99, face: 6 };
}

function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  const t = G.clock;
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  drawScene(t);

  if (G.state === 'title') {
    drawTitleArea(t);
    for (const f of G.fades) drawFade(f);
    for (const s of G.slimes) if (s.state === 'free' || s.state === 'held') drawGhost(s, t);   // 着地の予想はゲームと同じく いつも出す
    for (const s of G.slimes) drawSlime(s, t, 0);
    for (const s of G.slimes) if (s.hint && (s.state === 'free' || s.state === 'held')) { drawHandle(s, t); drawTouch(s, t); }
    drawRope();
    for (const p of G.people) drawPerson(p);
    drawTitleDemo(t);
    for (const p of G.particles) { ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.fillStyle = p.col; circ(p.x, p.y, p.r); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const p of G.popups) { ctx.globalAlpha = clamp((p.life - p.age) * 2.5, 0, 1); txt(p.text, p.x, p.y, p.size, p.color, { align: 'center', stroke: p.stroke, sw: 5 }); }
    ctx.globalAlpha = 1;
    ctx.restore();
    drawTitleOverlay(t);
    return;
  }

  const high = G.state === 'prep' ? highSlimes() : [];
  if (G.state === 'prep') drawGuide(t, high.length > 0);
  if (G.state === 'prep') drawArea(t);
  drawDemo(); drawWater(t); drawSpikes(t);
  for (const f of G.fades) drawFade(f);
  for (const s of G.slimes) if (s.state === 'fixed' || s.state === 'settle') drawSlime(s, t, nearestWalkerX(s.pts[s.face].x));
  for (const s of high) drawWarn(s, t);
  for (const s of G.slimes) if (s.state === 'free' || s.state === 'held') drawGhost(s, t);
  for (const s of G.slimes) if (s.state === 'free' || s.state === 'held') drawSlime(s, t, 0);
  for (const s of G.slimes) if (s.state === 'free' || s.state === 'held') drawHandle(s, t);
  for (const e of G.erasers) drawEraserGuide(e, t);
  for (const e of G.erasers) drawEraser(e, t);
  for (const e of G.erasers) if (e.state === 'free' || e.state === 'held') drawHandle(e, t);
  drawMedal(t);
  drawRope();
  drawPurunGuides(t);
  for (const p of G.people) if (p.state === 'pile') drawPerson(p);   // 落ちた人・セリフはスライムより手前
  for (const p of G.people) if (p.state !== 'pile') drawPerson(p);
  drawBirds(); drawKite(t); drawVine(t); drawLeaf(t); drawMedalRing();
  for (const p of G.particles) {
    ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1);
    ctx.fillStyle = p.col; circ(p.x, p.y, p.r); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const p of G.popups) {
    ctx.globalAlpha = clamp((p.life - p.age) * 2.5, 0, 1);
    txt(p.text, p.x, p.y, p.size, p.color, { align: 'center', stroke: p.stroke, sw: 5 });
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (G.state === 'result' && !G.shotDone) { G.shotDone = true; if (G.crossed >= needOf()) captureShot(); }   // 撮るのは HUD の前(上の帯を わたりかたとメダルに使う)
  if (G.state !== 'result' && G.state !== 'ending') drawBanner(t);
  if (G.state !== 'ending') drawHUD();
  if (G.state === 'prep') drawButton(t);
  if (G.state === 'prep') drawIntro();
  if (G.state === 'prep') drawMarks(t, high.length > 0);
  if (G.state === 'result') drawResult();
  if (G.state === 'ending') drawEnding(t);
  if (G.viewer) drawViewer();
}

function captureShot() {
  try {
    const full = document.createElement('canvas'); full.width = cv.width; full.height = cv.height;
    full.getContext('2d').drawImage(cv, 0, 0);
    const th = document.createElement('canvas'); th.width = 192; th.height = 341;
    th.getContext('2d').drawImage(cv, 0, 0, 192, 341);
    // 左上のメダルの下に、5人の わたりかたを小さく入れる(画面には出さず、撮った画像にだけ)
    const real = ctx, fc = full.getContext('2d');
    try {
      ctx = fc; fc.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ctx.save(); rr(5, 4, W - 10, 86, 14); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill(); ctx.restore();
      if (G.medalGot) drawMedalIcon(26, 52, 11, true);
      drawCrossMini(G.medalGot ? 46 : 8);
    } finally { ctx = real; }
    th.getContext('2d').drawImage(full, 0, 0, 192, 341);
    G.shots = G.shots || {};
    G.shots[G.stage || 0] = { full: full, thumb: th, made: G.made, crossed: G.crossed, bridge: G.bridge };
  } catch (e) {}
}

/* ---- 全ステージクリアの画面 ---- */
const END_THUMB = { w: 96, h: 170, y: 262, gap: 12 };
const END_BTN = { x: 80, y: 548, w: 200, h: 52 };
function endThumbX(i) { return (W - (3 * END_THUMB.w + 2 * END_THUMB.gap)) / 2 + i * (END_THUMB.w + END_THUMB.gap); }
function startEnding() {
  SFX.ending();
  G.state = 'ending'; G.endingT = 0; G.conf = [];
  const cols = ['#e8594f', '#3d7be0', '#f0b429', '#a259d9', '#2aa198', '#ff8fb1'];
  for (let i = 0; i < 90; i++) G.conf.push({ x: rand(0, W), y: rand(-640, -10), vy: rand(60, 140), vx: rand(-20, 20), rot: rand(0, 6), vr: rand(-6, 6), w: rand(5, 9), h: rand(8, 13), col: cols[i % cols.length], ph: rand(0, 6) });
}
function drawEnding(t) {
  const e = G.endingT;
  const pop = clamp(e / 0.5, 0, 1), ease = 1 - Math.pow(1 - pop, 3);
  ctx.save();
  ctx.globalAlpha = 0.9 * clamp(e / 0.4, 0, 1);
  rr(16, 36, 328, 586, 24); ctx.fillStyle = PALETTE.paper; ctx.fill();
  ctx.globalAlpha = clamp(e / 0.4, 0, 1); ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(W / 2, 96); ctx.scale(0.6 + 0.4 * ease, 0.6 + 0.4 * ease); ctx.globalAlpha = ease;
  txt(i18n('allClear'), 0, 0, 36, PALETTE.ok, { align: 'center', stroke: '#fff', sw: 7 });
  ctx.restore();
  ctx.save(); ctx.globalAlpha = clamp((e - 0.3) / 0.4, 0, 1);
  txt(i18n('congrats'), W / 2, 134, 14, PALETTE.ink, { align: 'center', maxW: 300 });
  // 5人がならんで万歳
  for (let i = 0; i < CONFIG.people; i++) {
    const T = PERSON_TYPES[i], fp = { type: T, sw: T.sw, sh: T.sh, color: PALETTE.people[i % PALETTE.people.length], id: i };
    const x = 50 + i * 65, hop = -Math.abs(Math.sin(e * 5 + i * 1.3)) * 9;
    ctx.save(); ctx.translate(x, 198 + hop); figure(fp, 'up', e * 8 + i); ctx.restore();
    txt(T.name, x, 220, 8.5, PALETTE.ink, { align: 'center', weight: 800, maxW: 62 });
  }
  ctx.restore();
  txt(i18n('clearedScenes'), W / 2, 252, 13, '#4a5654', { align: 'center' });
  // 縮小したクリア画面
  for (let i = 0; i < 3; i++) {
    const x = endThumbX(i), y = END_THUMB.y, w = END_THUMB.w, h = END_THUMB.h, sh = G.shots && G.shots[i];
    const a = clamp((e - 0.5 - i * 0.18) / 0.35, 0, 1);
    if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate((i - 1) * 0.035 * (1 - a * 0.0)); ctx.translate(-w / 2, -h / 2);
    rr(0, 0, w, h, 8);
    if (sh) {
      ctx.save(); ctx.clip(); ctx.drawImage(sh.thumb, 0, 0, w, h); ctx.restore();
      rr(0, 0, w, h, 8); ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
      rr(w - 26, h - 26, 22, 22, 11); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.lineWidth = 1.8; ctx.strokeStyle = PALETTE.ink; ctx.beginPath(); ctx.arc(w - 15, h - 15, 4.2, 0, 7); ctx.moveTo(w - 15, h - 15); ctx.stroke();
      ctx.beginPath(); ctx.arc(w - 15, h - 15, 6.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(42,35,32,0.08)'; ctx.fill();
      ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(42,35,32,0.4)'; ctx.stroke(); ctx.setLineDash([]);
      txt(i18n('notTried'), w / 2, h / 2 + 4, 11, 'rgba(42,35,32,0.55)', { align: 'center' });
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = a;
    txt(i18n('stageWordFmt')(i + 1) + ' ' + stageName(i), x + w / 2, y + h + 18, 11, PALETTE.ink, { align: 'center', maxW: w + 10 });
    if (sh && sh.bridge) {
      txt(sh.bridge.name, x + w / 2, y + h + 32, 10.5, '#1d7a43', { align: 'center', weight: 800, maxW: w + 12 });
    }
    ctx.restore();
  }
  if (e > 1.2) {
    const ha = 0.8 + 0.2 * Math.sin(G.clock * 4);
    ctx.save(); ctx.globalAlpha = ha;
    txt(i18n('tapEnlarge'), W / 2, 484, 11.5, '#3b4a48', { align: 'center' });
    ctx.restore();
    txt(i18n('viewerTip1'), W / 2, 504, 10.5, '#4a5654', { align: 'center', maxW: W - 40 });
    txt(i18n('viewerTip2'), W / 2, 519, 10.5, '#4a5654', { align: 'center', maxW: W - 40 });
    rr(END_BTN.x, END_BTN.y, END_BTN.w, END_BTN.h, 26); ctx.fillStyle = PALETTE.ok; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    txt(i18n('playAgain'), W / 2, END_BTN.y + 33, 19, '#fff', { align: 'center', stroke: PALETTE.ink, sw: 4 });
  }
  // 紙ふぶき
  for (const c of G.conf) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(1, Math.cos(e * 3 + c.ph));
    ctx.fillStyle = c.col; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
  }
}

/* ---- 画像を大きく開く(canvasの上に重ねて描く。タップでとじる・左右スライドで切りかえ) ---- */
const VIEW_BTNS = [
  { k: 'close', x: 12, y: 98, w: 44, h: 42, label: 'close' },
  { k: 'hide', x: 304, y: 98, w: 44, h: 42, label: 'hide' }
];
function shotIds() { return [0, 1, 2].filter(function (k) { return G.shots && G.shots[k]; }); }
function viewerBtns() { return VIEW_BTNS; }
function openShot(i) {
  if (!(G.shots && G.shots[i])) return;
  SFX.tap();
  G.viewer = { cur: i, at: G.clock, down: null, hidden: false, hideAt: 0, moved: false, tip: !G.tipShown };
  G.tipShown = true;
}
function viewerGo(d) {
  const ids = shotIds(), v = G.viewer;
  if (ids.length < 2) return;
  v.cur = ids[(ids.indexOf(v.cur) + d + ids.length) % ids.length];
  v.moved = true;
}
function drawEyeIcon(cx, cy) {
  ctx.save(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.quadraticCurveTo(cx, cy - 10, cx + 10, cy); ctx.quadraticCurveTo(cx, cy + 10, cx - 10, cy); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 9, cy + 9); ctx.lineTo(cx + 9, cy - 9); ctx.stroke();
  ctx.restore();
}
function drawCloseIcon(cx, cy) {
  ctx.save(); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(cx - 7, cy - 7); ctx.lineTo(cx + 7, cy + 7); ctx.moveTo(cx + 7, cy - 7); ctx.lineTo(cx - 7, cy + 7); ctx.stroke();
  ctx.restore();
}
function drawViewer() {
  const v = G.viewer, sh = G.shots[v.cur], ids = shotIds();
  ctx.fillStyle = '#141c1a'; ctx.fillRect(0, 0, W, H);
  // スワイプのヒント: 切りかえるまで、画像がちょっと左にずれて次の画像がのぞく動きをくり返す
  let hint = 0;
  if (ids.length > 1 && !v.moved && !v.hidden) {
    const ph = (G.clock - v.at - 0.7) % 4.5;
    if (ph >= 0 && ph < 1.2) hint = Math.sin(ph / 1.2 * Math.PI);
  }
  const ox = -34 * hint;
  ctx.drawImage(sh.full, ox, 0, W, H);
  if (hint > 0) {
    ctx.drawImage(G.shots[ids[(ids.indexOf(v.cur) + 1) % ids.length]].full, ox + W, 0, W, H);
    ctx.save(); ctx.globalAlpha = hint * 0.75; circ(262 + ox, H * 0.55, 15); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  }
  if (v.hidden) {
    const a = clamp(1.6 - (G.clock - v.hideAt), 0, 1);
    if (a > 0) { ctx.save(); ctx.globalAlpha = a * 0.85; txt(i18n('tapShowButtons'), W / 2, H - 22, 12, '#fff', { align: 'center', stroke: PALETTE.ink, sw: 4 }); ctx.restore(); }
    return;
  }
  const g = ctx.createLinearGradient(0, 92, 0, 148); g.addColorStop(0, 'rgba(20,28,26,0)'); g.addColorStop(0.5, 'rgba(20,28,26,0.45)'); g.addColorStop(1, 'rgba(20,28,26,0)');   // 上のHUD(クリア人数など)は隠さない
  ctx.fillStyle = g; ctx.fillRect(0, 92, W, 56);
  const g2 = ctx.createLinearGradient(0, H - 90, 0, H); g2.addColorStop(0, 'rgba(20,28,26,0)'); g2.addColorStop(1, 'rgba(20,28,26,0.55)');
  ctx.fillStyle = g2; ctx.fillRect(0, H - 90, W, 90);
  txt(i18n('stageWordFmt')(v.cur + 1) + ' ' + stageName(v.cur) + (ids.length > 1 ? '  (' + (ids.indexOf(v.cur) + 1) + '/' + ids.length + ')' : ''), 66, 125, 14, '#fff', { stroke: PALETTE.ink, sw: 4, maxW: 230 });
  if (ids.length > 1) {
    // 何枚目かの点
    for (let k = 0; k < ids.length; k++) {
      ctx.beginPath(); ctx.arc(W / 2 + (k - (ids.length - 1) / 2) * 16, 616, ids[k] === v.cur ? 5 : 3.5, 0, 7);
      ctx.fillStyle = ids[k] === v.cur ? '#fff' : 'rgba(255,255,255,0.45)'; ctx.fill();
    }
  }
  if (v.tip && ids.length > 1) {
    // 初めて開いたときだけ、操作のヒントを少しのあいだ出す
    const te = G.clock - v.at, a = clamp(Math.min((te - 0.4) / 0.3, (4.2 - te) / 0.8), 0, 1);
    if (a > 0) { ctx.save(); ctx.globalAlpha = a * 0.9; txt(i18n('viewerTip'), W / 2, 590, 12, '#fff', { align: 'center', stroke: PALETTE.ink, sw: 4, maxW: W - 24 }); ctx.restore(); }
  }
  ctx.save(); ctx.globalAlpha = 0.82;
  for (const b of viewerBtns()) {
    const dn = v.down && v.down.k === b.k;
    rr(b.x, b.y + (dn ? 2 : 0), b.w, b.h, 19); ctx.fillStyle = '#5f6f6b'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
    if (b.k === 'hide') drawEyeIcon(b.x + b.w / 2, b.y + b.h / 2 + (dn ? 2 : 0));
    else drawCloseIcon(b.x + b.w / 2, b.y + b.h / 2 + (dn ? 2 : 0));
  }
  ctx.restore();
}
function viewerBtnAt(p) {
  if (G.viewer.hidden) return null;
  for (const b of viewerBtns()) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
  return null;
}
function viewerDown(p) { const b = viewerBtnAt(p); G.viewer.down = { x: p.x, y: p.y, k: b ? b.k : '' }; }
function viewerUp(p) {
  const v = G.viewer, d = v.down;
  v.down = null;
  if (!d || G.clock - v.at < 0.3) return;   // 開いたときの指が離れた直後に反応しないように
  const dx = p.x - d.x, dy = p.y - d.y;
  if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.3) { viewerGo(dx < 0 ? 1 : -1); return; }   // スライドで切りかえ
  if (!v.hidden && Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx) * 1.3) { SFX.tap(); G.viewer = null; return; }   // 上下スライドでもとじる
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
  if (v.hidden) { v.hidden = false; return; }                                                         // かくしている間は、どこをタップしてもボタンが戻る
  const b = viewerBtnAt(p);
  if (!b) return;
  SFX.tap();
  if (b.k === 'hide') { v.hidden = true; v.hideAt = G.clock; }
  else G.viewer = null;                                                                              // closeボタンだけでとじる
}
function endingTap(p) {
  if (G.endingT < 0.8) return;
  for (let i = 0; i < 3; i++) {
    const x = endThumbX(i);
    if (p.x >= x - 4 && p.x <= x + END_THUMB.w + 4 && p.y >= END_THUMB.y - 4 && p.y <= END_THUMB.y + END_THUMB.h + 22) { openShot(i); return; }
  }
  if (G.endingT > 1.2 && p.x >= END_BTN.x && p.x <= END_BTN.x + END_BTN.w && p.y >= END_BTN.y && p.y <= END_BTN.y + END_BTN.h) { SFX.tap(); G.shots = {}; G.stage = 0; newStage(); }
}

/* ============================================================
   入力(pointer events)
   ============================================================ */
function toLocal(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
function clampToArea(p) {
  const m = CONFIG.slimeThick / 2 + 1;
  return { x: clamp(p.x, AX + m, AX + AS - m), y: clamp(p.y, AY + m, AY + AS - m) };
}

cv.addEventListener('pointerdown', function (e) {
  e.preventDefault();
  const p = toLocal(e);
  if (G.state === 'title') {
    if (langTap(p) || soundTap(p)) return;
    if (CONFIG.devButtons) for (const b of DBG_BTNS) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { SFX.tap(); G.stage = b.stage; newStage(); return; }
    const lk = stageLinkAt(p);
    if (lk) { SFX.tap(); G.shots = {}; G.medals = {}; G.stage = lk.stage; newStage(); return; }
    SFX.tap(); G.shots = {}; G.medals = {}; G.stage = startStage(); newStage(); return;
  }
  if (G.state === 'result') {
    if (G.resultT > 0.5 && G.crossed < needOf()) {
      if (inRect(p, RETRY_KEEP)) { SFX.tap(); keepRetry(); }
      else if (inRect(p, RETRY_CLR)) { SFX.tap(); newStage(); }
      return;
    }
    if (G.resultT > 0.5) {
      SFX.tap();
      if (inRect(p, RETRY_CLR)) { newStage(); return; }   // クリアしても同じステージを もういちど(メダルの記録は のこる)
      if (G.crossed >= needOf()) { if ((G.stage || 0) + 1 >= STAGES.length) { startEnding(); return; } G.stage = (G.stage || 0) + 1; }
      newStage();
    }
    return;
  }
  if (G.viewer) { viewerDown(p); return; }
  if (G.state === 'ending') { endingTap(p); return; }
  if (G.state === 'walk') { purunAt(p.x, p.y); return; }
  if (G.state !== 'prep' || G.drag || G.drawing) return;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  if (p.x >= BTN.x && p.x <= BTN.x + BTN.w && p.y >= BTN.y && p.y <= BTN.y + BTN.h) { SFX.tap(); startWalk(); return; }
  for (const m of MARKS) {
    if (Math.hypot(p.x - m.x, p.y - m.y) <= m.r + 8) { m.press = G.clock; spawnEraser(m); return; }
  }
  const er = hitEraser(p.x, p.y);
  if (er) {
    G.taught = true; se('grab');
    er.state = 'held';
    G.drag = { id: e.pointerId, s: er, eraser: true, lx: p.x, ly: p.y };
    return;
  }
  const s = hitFree(p.x, p.y);
  if (s) {
    G.taught = true; se('grab');
    s.collapse = false;
    s.state = 'held';
    G.drag = { id: e.pointerId, s: s, lx: p.x, ly: p.y };
    return;
  }
  if (p.x >= AX - 4 && p.x <= AX + AS + 4 && p.y >= AY - 4 && p.y <= AY + AS + 4) {
    const c = clampToArea(p);
    G.drawing = { id: e.pointerId, pts: [c], len: 0, acc: 0 };
    se('drawStart');
  }
});

cv.addEventListener('pointermove', function (e) {
  if (G.drag && e.pointerId === G.drag.id) {
    e.preventDefault();
    const p = toLocal(e);
    const d = G.drag, s = d.s;
    const dx = p.x - d.lx, dy = p.y - d.ly;
    d.lx = p.x; d.ly = p.y;
    if (d.eraser) moveEraser(s, dx, dy); else moveHeld(s, dx, dy);
    return;
  }
  if (G.drawing && e.pointerId === G.drawing.id) {
    e.preventDefault();
    const d = G.drawing;
    const c = clampToArea(toLocal(e));
    const last = d.pts[d.pts.length - 1];
    const dist = Math.hypot(c.x - last.x, c.y - last.y);
    if (dist < 2.5) return;
    if (d.len + dist > CONFIG.maxInk) return;
    d.len += dist;
    d.pts.push(c);
    d.acc += dist;
    if (d.acc >= 13) { d.acc -= 13; se('draw', d.len / CONFIG.maxInk); }
  }
});

function finishPointer(e) {
  if (G.viewer) { if (e.type === 'pointerup') viewerUp(toLocal(e)); else G.viewer.down = null; return; }
  if (G.drag && e.pointerId === G.drag.id) {
    G.drag.s.state = 'free';
    G.drag.s.vy = G.drag.eraser ? CONFIG.eraserFallSpeed : CONFIG.fallSpeed;
    G.drag = null;
    return;
  }
  if (G.drawing && e.pointerId === G.drawing.id) {
    const d = G.drawing;
    G.drawing = null;
    if (d.len < CONFIG.minStroke || d.pts.length < 3) {
      se('short');
      popup(AX + AS / 2, AY + AS / 2, i18n('tooShort'), 16, '#fff', PALETTE.fail, 0.9);
      return;
    }
    const pts = resample(smooth(d.pts), CONFIG.pointSpacing);
    if (pts.length < 3) return;
    // 試作: 描きおわりが描きはじめの近くなら、とじて「かたまり」にする
    const a0 = pts[0], z0 = pts[pts.length - 1], gap = Math.hypot(a0.x - z0.x, a0.y - z0.y);
    const blob = d.len >= CONFIG.blobMinLen && gap <= CONFIG.blobClose;
    const kind = shapeKind(pts, d.len);
    if (blob || kind === 'maru') {
      const k = Math.max(1, Math.round(gap / CONFIG.pointSpacing));
      for (let i = 1; i <= k; i++) pts.push({ x: z0.x + (a0.x - z0.x) * i / k, y: z0.y + (a0.y - z0.y) * i / k });
    }
    se('drawEnd', d.len / CONFIG.maxInk);
    const ns = spawnSlime(pts, blob); ns.kind = kind;
    if (blob) popup(AX + AS / 2, AY + AS / 2, 'かたまり！', 17, '#fff', '#2a8f4d', 0.9);
    if (kind) { const k = SHAPE_KINDS[kind]; popup(AX + AS / 2, AY + AS / 2, lang === 'ja' ? k.ja : k.en, 17, '#fff', k.col, 1.2, 22); }
  }
}
cv.addEventListener('pointerup', finishPointer);
cv.addEventListener('pointercancel', finishPointer);

/* ============================================================
   メインループ
   ============================================================ */
let last = performance.now(), acc = 0;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  acc += dt;
  while (acc >= FIXED) { update(FIXED); acc -= FIXED; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
