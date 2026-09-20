// PIXI.JSアプリケーションを呼び出す (この数字はゲーム内の画面サイズ)
const app = new PIXI.Application({ width: 360, height: 548 });

// index.htmlのbodyにapp.viewを追加する (app.viewはcanvasのdom要素)
document.body.appendChild(app.view);

// ゲームcanvasのcssを定義する
// ここで定義した画面サイズ(width,height)は実際に画面に表示するサイズ
app.renderer.view.style.position = "relative";
app.renderer.view.style.width = "360px";
app.renderer.view.style.height = "548px";
app.renderer.view.style.display = "block";

// canvasの周りを点線枠で囲う (canvasの位置がわかりやすいので入れている)
//pp.renderer.view.style.border = "2px dashed black";

// canvasの背景色
app.renderer.backgroundColor = 0xccccff;

// ゲームで使用する画像をあらかじめ読み込んでおく(プリロードという)
PIXI.loader.add('ball', 'ball.png')
    .add('ssn', 'box.png')       //賽銭箱
    .add('goen', 'goen.png')    //5円玉
    .add('bat', 'bat.png')      //バット
    .add('hako', 'bonus.png')   //ボーナスアイコン
    .add('box', 'kusa.png');    //背景

// 画像からスプライトオブジェクトを作る
var framenames = [
    "test_r1_c1.png",
    "test_r1_c2.png",
    "test_r1_c3.png",
    "test_r1_c4.png",
    "test_r2_c1.png",
    "test_r2_c2.png",
    "test_r2_c3.png",
    "test_r2_c4.png"];
var sprites = [];

var life = 3;

var debugvalue = 0; //デバッグ用

// プリロード処理が終わったら呼び出されるイベント
PIXI.loader.load((loader, resources) => {
    /**
     * 状態が変化する変数一覧
     */
    let gameLoops = []; // 毎フレーム毎に実行する関数たち
    let score = 0; // 表示上のスコア
    let scoreup = 0;    //スコアアップ用
    let ballVx = 0; // ボールの毎フレーム動くx方向
    let ballVy = 0; // ボールの毎フレーム動くy方向
    var scoreup_effect_k = -1;
    var scoreup_effect_k2 = -1;

    /**
     * 毎フレーム処理を追加する関数
     */
    function addGameLoop(gameLoopFunction) {
        app.ticker.add(gameLoopFunction); // 毎フレーム処理として指定した関数を追加
        gameLoops.push(gameLoopFunction); // 追加した関数は配列に保存する（後で登録を解除する時に使う）
    }

    /**
     * 登録している毎フレーム処理を全部削除する関数
     */
    function removeAllGameLoops() {
        // gameLoopsに追加した関数を全部tickerから解除する
        for (const gameLoop of gameLoops) {
            app.ticker.remove(gameLoop);
        }
        gameLoops = []; // gameLoopsを空にする
    }
    /**
     * 全てのシーンを画面から取り除く関数
     */
    function removeAllScene() {
        for (const scene of app.stage.children) {
            app.stage.removeChild(scene);
        }
    }

    /**
     * ボタンを生成してオブジェクトを返す関数
     * @param text テキスト
     * @param width 横幅
     * @param height 縦幅
     */
    function createButton(text, width, height, color, onClick) {
        const fontSize = 24; // フォントサイズ
        const buttonAlpha = 0.8; // ボタン背景の透明度
        const buttonContainer = new PIXI.Container(); // ボタンコンテナ（ここにテキストと背景色を追加して返り値とする）

        // ボタン作成
        const backColor = new PIXI.Graphics(); // グラフィックオブジェクト（背景に半透明な四角を配置するために使用）
        backColor.beginFill(color, buttonAlpha); // 色、透明度を指定して描画開始
        backColor.drawRect(0, 0, width, height); // 位置(0,0)を左上にして、width,heghtの四角形を描画
        backColor.endFill(); // 描画完了
        backColor.interactive = true; // クリック可能にする
        backColor.on("pointerdown", onClick); // クリック時にonClickの関数を実行する
        buttonContainer.addChild(backColor); // 背景をボタンコンテナに追加

        // テキストに関するパラメータを定義する(ここで定義した意外にもたくさんパラメータがある)
        const textStyle = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: fontSize,// フォントサイズ
            fontWeight: 'bold', //太字
            fill: 0xffffff, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowDistance: 2, // ドロップシャドウの影の距離
        });

        const buttonText = new PIXI.Text(text, textStyle); // テキストオブジェクトをtextStyleのパラメータで定義
        buttonText.anchor.x = 0.5; // アンカーを中央に設置する(アンカーは0~1を指定する)
        buttonText.anchor.y = 0.5; // アンカーを中央に設置する(アンカーは0~1を指定する)
        buttonText.x = width / 2;　 // ボタン中央にテキストを設置するため、width/2の値をx値に指定
        buttonText.y = height / 2; // ボタン中央テキストを設置するため、height/2の値をy値に指定
        buttonContainer.addChild(buttonText); // ボタンテキストをボタンコンテナに追加
        return buttonContainer; // ボタンコンテナを返す

    }
    /**
     * 冒頭の説明用シーン
     */
    function createStartScene() {
        // ゲーム用のシーン表示
        const startScene = new PIXI.Container();
        // シーンを画面に追加する
        app.stage.addChild(startScene);

        //背景
        const box = new PIXI.Sprite(resources.box.texture); //引数には、プリロードしたURLを追加する
        box.x = 0; // x座標
        box.y = 32 * 2; // y座標
        box.scale.x = 4;   //x方向に2倍の大きさ
        box.scale.y = 4;   //y方向に2倍の大きさ
        box.alpha = 0.5;
        startScene.addChild(box); // ボールをシーンに追加

        //ロゴを囲むやつ
        logowaku = new PIXI.Graphics();
        logowaku.beginFill(0xffffff);
        logowaku.lineStyle(2, 0x000000, 1, 0);
        logowaku.drawRect(0, 0, 32 * 10.5 + 8, 32 * 3.5);
        logowaku.endFill();
        logowaku.position.set(12, 0);
        logowaku.alpha = 0.4;
        logowaku.rotation = 0.05;
        startScene.addChild(logowaku);

        //黒い枠線1
        waku_kuro1 = new PIXI.Graphics();
        waku_kuro1.beginFill(0xffffff);
        waku_kuro1.lineStyle(3, 0x000000, 1, 0);
        waku_kuro1.drawRect(0, 0, 32 * 9 + 4, 32 * 9);
        waku_kuro1.endFill();
        waku_kuro1.position.set(32 * 1, 32 * 4 + 24);
        waku_kuro1.alpha = 0.5;
        startScene.addChild(waku_kuro1);

        //ロゴ用フォント（５円）
        const textStyle_goen = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 32,// フォントサイズ
            fill: ['#ffff99', '#ff3333'], // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 5,
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowBlur: 4,
            dropShadowDistance: 4, // ドロップシャドウの影の距離
        });

        //メッセージ表示用
        const textStyle_intro = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 22,// フォントサイズ
            fontWeight: 'bold',
            leading: 2,  //行間間隔
            letterSpacing: 1,    //文字間隔
            fill: 0x000000, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
        });


        //ロゴ用テキスト
        const text_goen = new PIXI.Text(`５円はスルー\n　ボールは打つ`, textStyle_goen); // 結果画面のテキスト
        text_goen.x = 32 * 0.6; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
        text_goen.y = 32 * 0.5 - 4; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
        text_goen.rotation = 0.05;
        startScene.addChild(text_goen); // 結果画面シーンにテキスト追加

        //説明用テキスト
        const text_intro = new PIXI.Text(`時は2025年元旦・・・\n野球部の合宿中に初詣が\n始まってしまった！\n\n賽銭箱に５円玉を集め、\nボールを打ち返すのだ！\n\n操作は簡単、タップだけ\n目指せホームラン！`, textStyle_intro); // 結果画面のテキスト
        text_intro.x = 32 * 1.5; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
        text_intro.y = 32 * 5; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
        startScene.addChild(text_intro); // 結果画面シーンにテキスト追加


        //賽銭箱を表示
        const ssn = new PIXI.Sprite(resources.ssn.texture); //引数には、プリロードしたURLを追加する
        ssn.x = 32 * 8; // x座標
        ssn.y = 32 * 1.5 + 4; // y座標
        ssn.anchor.x = 0.5;    //回転のx軸
        ssn.anchor.y = 0.5;    //回転のy軸
        ssn.scale.x = 0.75;   //x方向に2倍の大きさ
        ssn.scale.y = 1;   //y方向に2倍の大きさ
        ssn.rotation = 0.05;
        startScene.addChild(ssn); // ボールをシーンに追加

        //５円玉を表示
        const g = new PIXI.Sprite(resources.goen.texture); //引数には、プリロードしたURLを追加する
        g.x = 32 * 8 + 2; // x座標
        g.y = 32 * 1 + 6; // y座標
        g.anchor.x = 0.5;    //回転のx軸
        g.anchor.y = 0.5;    //回転のy軸
        g.scale.x = 2;   //x方向に2倍の大きさ
        g.scale.y = 2;   //y方向に2倍の大きさ
        g.rotation = 0.5;
        startScene.addChild(g); // ボールをシーンに追加

        //バットを表示
        const bat = new PIXI.Sprite(resources.bat.texture); //引数には、プリロードしたURLを追加する
        bat.x = 32 * 8.5 - 4; // x座標
        bat.y = 32 * 2.5 + 8; // y座標
        bat.anchor.x = 0.5;    //回転のx軸
        bat.anchor.y = 0.5;    //回転のy軸
        bat.scale.x = 2.5;   //x方向に2倍の大きさ
        bat.scale.y = 2.5;   //y方向に2倍の大きさ
        bat.rotation = -0.2;
        startScene.addChild(bat); // ボールをシーンに追加

        //ボールを表示
        const b = new PIXI.Sprite(resources.ball.texture); //引数には、プリロードしたURLを追加する
        b.x = 32 * 9.5 - 8; // x座標
        b.y = 32 * 3 + 8; // y座標
        b.anchor.x = 0.5;    //回転のx軸
        b.anchor.y = 0.5;    //回転のy軸
        b.scale.x = 2;   //x方向に2倍の大きさ
        b.scale.y = 2;   //y方向に2倍の大きさ
        b.rotation = 0.5
        startScene.addChild(b); // ボールをシーンに追加

        //スタートボタン
        const retryButton = createButton("スタート", 360, 64, 0xcc0000, () => {
            // クリックした時の処理
            removeAllScene();   //一応入れておく
            createGameScene(); // ゲームシーンを生成する
        });
        retryButton.x = 32 * 0; // ボタンの座標指定
        retryButton.y = 32 * 14; // ボタンの座標指定
        startScene.addChild(retryButton);　// ボタンを結果画面シーンに追加

    }

    /**
     * ゲームのメインシーンを生成する関数
     */
    function createGameScene() {
        // 他に表示しているシーンがあれば削除（シーンの数だけ実行する必要がありそう）
        removeAllScene();
        removeAllScene();
        // 毎フレームイベントを削除
        removeAllGameLoops();

        // スコアを初期化する
        score = 5;
        scoreup = 5;
        // ボールの加速度も初期化
        ballVy = 0;
        //箱１用
        var flg_hako1 = true;
        var hit_hako1 = 0;
        var hitcount_hako1 = 0;
        var movey_hako1 = 32; //移動範囲
        var movey_value_hako1 = 0.25; //移動方向
        var movex_hako1 = 32 * 0.2; //移動範囲
        var movex_value_hako1 = 0.125; //移動方向
        var rotation_hako1 = 0.25;  //回転範囲
        var rotation_value_hako1 = 0.01; //回転方向
        //箱２用
        var flg_hako2 = false;
        var hit_hako2 = 0;
        var hitcount_hako2 = 0;
        var movey_hako2 = 32; //移動範囲
        var movey_value_hako2 = 0.25; //移動方向
        var movex_hako2 = 32 * 0.2; //移動範囲
        var movex_value_hako2 = 0.125; //移動方向
        var rotation_hako2 = 0.25;  //回転範囲
        var rotation_value_hako2 = -0.01; //回転方向
        //箱３用
        var flg_hako3 = false;
        var hit_hako3 = 0;
        var hitcount_hako3 = 0;
        var movey_hako3 = 32; //移動範囲
        var movey_value_hako3 = -0.25; //移動方向
        var movex_hako3 = 32 * 0.2; //移動範囲
        var movex_value_hako3 = 0.125; //移動方向
        var rotation_hako3 = 0.25;  //回転範囲
        var rotation_value_hako3 = 0.01; //回転方向
        //箱４用
        var flg_hako4 = true;
        var hit_hako4 = 0;
        var hitcount_hako4 = 0;
        var movey_hako4 = 32; //移動範囲
        var movey_value_hako4 = -0.25; //移動方向
        var movex_hako4 = 32 * 0.2; //移動範囲
        var movex_value_hako4 = 0.125; //移動方向
        var rotation_hako4 = 0.25;  //回転範囲
        var rotation_value_hako4 = -0.01; //回転方向
        //バットスイングフラグ
        var swing = false;
        //共通ヒットカウント
        var hitvalue = 12;
        var scoreeffectvalue = 24;  //スコアアップエフェクト持続時間
        //5円エフェクト用
        var goenbonus = 0;  //連続5円ゲットカウント
        var goenbonus_max = 0;  //連続5円ゲット最大値
        var goenbonus_effect = 0;
        var goenbonus_effect_value = 12;
        //ホームランカウント用
        var hmrcount = 0;    //ホームランカウント
        var hmr_cnt = 0;
        var hmr_cnt_value = 12;
        //ボーナス出現エフェクト用
        var popbonus_effect = 0;
        var popbonus_effect_value = 36;
        //ヒットエフェクト用
        var bonus_hit = 0;
        var bonus_hit_effect = 0;
        var bonus_hit_effect_value = 30;
        //ホームランエフェクト用
        var bonus_hmr = 0;
        var bonus_hmr_effect = -1;  //初期値-1、0のときにhakopop()を呼ぶため
        var bonus_hmr_effect_value = 40;
        //その他
        var hitStop = -1;
        var random = 2;
        var count = 0;
        var apr_flg = false;
        var apr_value = 0;
        var prob_g = 60;    //5円玉の出現しやすさ
        var curve = 10;  //変化球確率
        var curveflg = false;    //変化球フラグ
        //ランダム箱生成
        var hako_num = 0;

        // ゲーム用のシーンを生成
        const gameScene = new PIXI.Container();
        // ゲームシーンを画面に追加
        app.stage.addChild(gameScene);

        /**
            //ライフを表示（1個目）
            const life1 =  new PIXI.Sprite(resources.life.texture); //引数には、プリロードしたURLを追加する
            life1.x = 32*10; // x座標
            life1.y = 32*0.5; // y座標
            life1.anchor.x = 0;    //回転のx軸
            life1.anchor.y = 0;    //回転のy軸
            life1.scale.x = 2;   //x方向に2倍の大きさ
            life1.scale.y = 2;   //y方向に2倍の大きさ
            gameScene.addChild(life1); // ボールをシーンに追加
            //ライフを表示（2個目）
            const life2 =  new PIXI.Sprite(resources.life.texture); //引数には、プリロードしたURLを追加する
            life2.x = 32*9; // x座標
            life2.y = 32*0.5; // y座標
            life2.anchor.x = 0;    //回転のx軸
            life2.anchor.y = 0;    //回転のy軸
            life2.scale.x = 2;   //x方向に2倍の大きさ
            life2.scale.y = 2;   //y方向に2倍の大きさ
            gameScene.addChild(life2); // ボールをシーンに追加
            //ライフを表示（3個目）
            const life3 =  new PIXI.Sprite(resources.life.texture); //引数には、プリロードしたURLを追加する
            life3.x = 32*8; // x座標
            life3.y = 32*0.5; // y座標
            life3.anchor.x = 0;    //回転のx軸
            life3.anchor.y = 0;    //回転のy軸
            life3.scale.x = 2;   //x方向に2倍の大きさ
            life3.scale.y = 2;   //y方向に2倍の大きさ
            gameScene.addChild(life3); // ボールをシーンに追加
        */

        //背景（賽銭箱とか）
        const box = new PIXI.Sprite(resources.box.texture); //引数には、プリロードしたURLを追加する
        box.x = 0; // x座標
        box.y = 32 * 2; // y座標
        box.scale.x = 4;   //x方向に2倍の大きさ
        box.scale.y = 4;   //y方向に2倍の大きさ
        gameScene.addChild(box); // ボールをシーンに追加

        //アイテムボックスを表示（1個目）
        const hako1 = new PIXI.Sprite(resources.hako.texture); //引数には、プリロードしたURLを追加する
        hako1.x = 32; // x座標
        hako1.y = 32 * 6; // y座標
        hako1.anchor.x = 0.5;    //回転のx軸
        hako1.anchor.y = 0.5;    //回転のy軸
        hako1.scale.x = 4;   //x方向に2倍の大きさ
        hako1.scale.y = 4;   //y方向に2倍の大きさ
        gameScene.addChild(hako1); // ボールをシーンに追加

        //アイテムボックスを表示（2個目）
        const hako2 = new PIXI.Sprite(resources.hako.texture); //引数には、プリロードしたURLを追加する
        hako2.x = 32 * 3; // x座標
        hako2.y = -32 * 4; // y座標
        hako2.anchor.x = 0.5;    //回転のx軸
        hako2.anchor.y = 0.5;    //回転のy軸
        hako2.scale.x = 4;   //x方向に2倍の大きさ
        hako2.scale.y = 4;   //y方向に2倍の大きさ
        gameScene.addChild(hako2); // ボールをシーンに追加

        //アイテムボックスを表示（3個目）
        const hako3 = new PIXI.Sprite(resources.hako.texture); //引数には、プリロードしたURLを追加する
        hako3.x = 32 * 8; // x座標
        hako3.y = -32 * 4; // y座標
        hako3.anchor.x = 0.5;    //回転のx軸
        hako3.anchor.y = 0.5;    //回転のy軸
        hako3.scale.x = 4;   //x方向に2倍の大きさ
        hako3.scale.y = 4;   //y方向に2倍の大きさ
        gameScene.addChild(hako3); // ボールをシーンに追加

        //アイテムボックスを表示（4個目）
        const hako4 = new PIXI.Sprite(resources.hako.texture); //引数には、プリロードしたURLを追加する
        hako4.x = 32 * 10; // x座標
        hako4.y = 32 * 6; // y座標
        hako4.anchor.x = 0.5;    //回転のx軸
        hako4.anchor.y = 0.5;    //回転のy軸
        hako4.scale.x = 4;   //x方向に2倍の大きさ
        hako4.scale.y = 4;   //y方向に2倍の大きさ
        gameScene.addChild(hako4); // ボールをシーンに追加

        // ボール画像を表示するスプライトオブジェクトを実体化させる
        const ball = new PIXI.Sprite(resources.ball.texture); //引数には、プリロードしたURLを追加する
        ball.x = -50; // x座標
        ball.y = -50; // y座標
        ball.anchor.x = 0.5;    //回転のx軸
        ball.anchor.y = 0.5;    //回転のy軸
        ball.scale.x = 4;   //x方向に2倍の大きさ
        ball.scale.y = 4;   //y方向に2倍の大きさ
        ball.interactive = true; // クリック可能にする
        gameScene.addChild(ball); // ボールをシーンに追加

        // 5円玉の表示
        const goen = new PIXI.Sprite(resources.goen.texture); //引数には、プリロードしたURLを追加する
        goen.x = -50; // x座標
        goen.y = -50; // y座標
        goen.anchor.x = 0.5;    //回転のx軸
        goen.anchor.y = 0.5;    //回転のy軸
        goen.scale.x = 4;   //x方向に2倍の大きさ
        goen.scale.y = 4;   //y方向に2倍の大きさ
        goen.interactive = true; // クリック可能にする
        gameScene.addChild(goen); // ボールをシーンに追加

        //バットを表示
        const bat = new PIXI.Sprite(resources.bat.texture); //引数には、プリロードしたURLを追加する
        bat.x = 32 * 4 - 16; // x座標
        bat.y = 32 * 12.5 - 8; // y座標
        bat.anchor.x = 0;    //回転のx軸
        bat.anchor.y = 1;    //回転のy軸
        bat.scale.x = 6;   //x方向に2倍の大きさ
        bat.scale.y = 6;   //y方向に2倍の大きさ
        bat.rotation = 3;
        gameScene.addChild(bat); // ボールをシーンに追加


        // テキストに関するパラメータを定義する(ここで定義した意外にもたくさんパラメータがある)
        const textStyle = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 16,// フォントサイズ
            fill: 0xffffff, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            stroke: '#000000',
            strokeThickness: 2,
        });

        // 固定用スコアテキスト
        const textStyle_score = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 32,// フォントサイズ
            fill: 0xffffff, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            fontWeight: 'bold',
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowDistance: 2, // ドロップシャドウの影の距離
            stroke: '#000000',
            strokeThickness: 3
        });

        // 固定用ミニテキスト
        const textStyle_kotei = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 24,// フォントサイズ
            fill: 0xffffff, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            fontWeight: 'bold',
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowDistance: 2, // ドロップシャドウの影の距離
            stroke: '#000000',
            strokeThickness: 3,
        });

        // 縁取りミニテキスト
        const textStyle_fuchimini = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 30,// フォントサイズ
            fill: 0xffffff, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            fontWeight: 'bold',
            fill: ['#ffffff', '#ffff99'], // gradient
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowBlur: 4,
            dropShadowDistance: 2, // ドロップシャドウの影の距離
        });

        // 五円ボーナス用ミニテキスト
        const textStyle_goenmini = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 18,// フォントサイズ
            fill: 0xffffff, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            fontWeight: 'bold',
            fill: ['#ffffff', '#ffff99'], // gradient
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowBlur: 4,
            dropShadowDistance: 2, // ドロップシャドウの影の距離
        });

        // ホームランボーナス用ミニテキスト
        const textStyle_hmrmini = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 18,// フォントサイズ
            fill: 0xffffff, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            fontWeight: 'bold',
            fill: ['#ffffff', '#ff3333'], // gradient
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowBlur: 4,
            dropShadowDistance: 2, // ドロップシャドウの影の距離
        });

        // ヒット用テキスト
        const textStyle_hit = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 26,// フォントサイズ
            fill: 0xffffff, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            fontWeight: 'bold',
            fill: ['#ffffff', '#99ff99'], // gradient
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowBlur: 4,
            dropShadowDistance: 2, // ドロップシャドウの影の距離
        });

        //ホームラン用テキスト
        const textStyle_homerun = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 36,// フォントサイズ
            fill: 0xffffff, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            fontWeight: 'bold',
            fill: ['#ffff99', '#ff3333'], // gradient
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowBlur: 4,
            dropShadowDistance: 2, // ドロップシャドウの影の距離
        });

        //デバッグ用の罫線描画
        var verticalLine = [];
        var horizontalLine = [];
        var hitRectangle = [];
        const debugStage = new PIXI.Container();
        var i;

        app.stage.addChild(debugStage);
        /** 
            //縦
            for (i = 0; i < 17; i++) {
                verticalLine.push(new PIXI.Graphics().beginFill(0xff0000).drawRect(0, 0, 360, 1));
                verticalLine[i].position.set(0, 32 * i);
                debugStage.addChild(verticalLine[i]);
            }
            //横
            for (i = 0; i < 12; i++) {
                horizontalLine.push(new PIXI.Graphics().beginFill(0xffff00).drawRect(0, 0, 1, 548));
                horizontalLine[i].position.set(32 * i, 0);
                debugStage.addChild(horizontalLine[i]);
            }
        */
        //ヒットゾーン
        hitRectangle = new PIXI.Graphics();
        hitRectangle.beginFill(0xff00ff);
        hitRectangle.drawRect(0, 2, 36 * 2, 32 * 1 - 2);
        hitRectangle.endFill();
        hitRectangle.position.set(36 * 4, 32 * 12);
        debugStage.addChild(hitRectangle);
        debugStage.alpha = 0.5;

        //打ち返す方向の補助線
        var angle_r = new PIXI.Graphics();
        angle_r.lineStyle(2, 0x0000ff);//線幅、線色
        angle_r
            .moveTo(0, 0)//原点を基準に描画
            .lineTo(-32 * 2, 0);
        angle_r.position.x = 32 * 5.5;
        angle_r.position.y = -100;
        angle_r.pivot.set(0, 0);//回転の原点をセット
        angle_r.rotation = 1;   //1周で6.28らしい
        debugStage.addChild(angle_r);

        //判定用
        var hitflg = 0;
        //打ち返しフラグ
        var flg_return = false;
        //ホームランフラグ
        var flg_homerun = false;

        //ホームラン目印の点
        const homerunguide = new PIXI.Graphics()
        homerunguide.beginFill(0x000000)
            .drawCircle(0, 0, 3)
            .endFill();
        homerunguide.position.set(32 * 5.5, 32 * 12.5);
        debugStage.addChild(homerunguide);

        /**
            //判定用（前）
            var hitpointVisible_f = [];
            
            //当たり判定用の点（前）
            const hitpoint_f = new PIXI.Point(32*5.5, 32*12);
    
            //当たり判定用の点を視認するための点（前）
            hitpointVisible_f = new PIXI.Graphics();
            hitpointVisible_f.beginFill(0x000000)
                .drawCircle(0, 0, 3)
                .endFill();
            hitpointVisible_f.position.set(hitpoint_f.x, hitpoint_f.y);
            debugStage.addChild(hitpointVisible_f);
    
            //判定用（後）
            var hitpointVisible_b = [];
            
            //当たり判定用の点（後）
            const hitpoint_b = new PIXI.Point(32*5.5, 32*13);
    
            //当たり判定用の点を視認するための点（後）
            hitpointVisible_b = new PIXI.Graphics();
            hitpointVisible_b.beginFill(0x000000)
                .drawCircle(0, 0, 3)
                .endFill();
            hitpointVisible_b.position.set(hitpoint_b.x, hitpoint_b.y);
            debugStage.addChild(hitpointVisible_b);
        
        */

        //ヒットボタンを作成（関数を拝借）
        const hitButton = createButton("ヒット！！", 360, 548, 0x00ffff, () => {
            // クリックした時の処理
            var flg_f = false;
            var flg_b = false;
            var bai = 3;
            var wk_y;
            var hitObj;
            var theta = 0;
            var ksk = ballVy * 1.5;

            //スイングフラグが降りたときだけスイングする
            if (!swing) {
                hitStop = 16;

                theta = Math.trunc(angle_r.rotation * 180 / Math.PI);
                if (hitflg == 1 || hitflg == 3) {
                    flg_return = true;
                    ballVy = Math.trunc(ksk * Math.sin(angle_r.rotation)) * -1.2;
                    ballVx = Math.trunc(ksk * Math.cos(angle_r.rotation)) * -1;
                } else if (hitflg == 2) {
                    flg_return = true;
                    flg_homerun = true;
                    ballVy = -2 * ksk;
                    ballVx = 0;
                }
                if (flg_return && apr_value == 1) {
                    goenbonus = 0;  //5円連続ゲットカウントのリセット
                }

                //スイングフラグを立てる
                swing = true;
                //dtext.text = `${swing}`
            }
            //dtext.text = `${swing}, θ:${theta}, Vx:${ballVx}, ${Math.cos(theta)}`
        });
        hitButton.x = 0; // ボタンの座標指定
        hitButton.y = 0; // ボタンの座標指定
        hitButton.alpha = 0;
        gameScene.addChild(hitButton); // ボタンを結果画面シーンに追加

        const text_gpower = new PIXI.Text("御利益Ｐ:", textStyle_kotei); //スコア表示テキスト
        gameScene.addChild(text_gpower); // スコア表示テキストを画面に追加する
        text_gpower.y = 32 * 0.5;

        const text = new PIXI.Text("5", textStyle_score); //スコア表示テキスト
        gameScene.addChild(text); // スコア表示テキストを画面に追加する
        text.x = 32 * 3 + 12;
        text.y = 32 * 0.5 - 4;

        const text_goenbonus = new PIXI.Text("お賽銭コンボ：2", textStyle_goenmini); //スコアアップエフェクト用テキスト
        gameScene.addChild(text_goenbonus); // スコア表示テキストを画面に追加する
        text_goenbonus.x = 8;
        text_goenbonus.y = -100;

        const text_hmr = new PIXI.Text("ﾎｰﾑﾗﾝ：2", textStyle_hmrmini); //スコアアップエフェクト用テキスト
        gameScene.addChild(text_hmr); // スコア表示テキストを画面に追加する
        text_hmr.x = -100;
        text_hmr.y = -100;

        const text_popbonus = new PIXI.Text("ボーナス出現！", textStyle_goenmini); //スコアアップエフェクト用テキスト
        gameScene.addChild(text_popbonus); // スコア表示テキストを画面に追加する
        text_popbonus.x = 8;
        text_popbonus.y = 32 * 10;

        const text_hit = new PIXI.Text("ヒット！\n　+10", textStyle_hit); //打球表示テキスト
        gameScene.addChild(text_hit); // スコア表示テキストを画面に追加する
        text_hit.x = 32 * 4;
        text_hit.y = -100;

        const text_homerun = new PIXI.Text("ホームラン！！\n　　+100", textStyle_homerun); //打球表示テキスト
        gameScene.addChild(text_homerun); // スコア表示テキストを画面に追加する
        text_homerun.x = 32 * 2;
        text_homerun.y = -100;

        const text_k = new PIXI.Text("お賽銭\n +50", textStyle_fuchimini); //スコアアップエフェクト用テキスト
        gameScene.addChild(text_k); // スコア表示テキストを画面に追加する
        text_k.x = 32 * 3 + text.width;
        text_k.y = -100;

        const text_k2 = new PIXI.Text("お賽銭\n +50", textStyle_fuchimini); //スコアアップエフェクト用テキスト
        gameScene.addChild(text_k2); // スコア表示テキストを画面に追加する（箱の2枚抜き対策で分ける）
        text_k2.x = 32 * 0 + text.width;
        text_k2.y = -100;

    /** 
        const dtext = new PIXI.Text("goen", textStyle); //デバッグ用テキスト
        gameScene.addChild(dtext); // スコア表示テキストを画面に追加する
        dtext.x = 0;
        dtext.y = 32 * 16;
        //ballVy = 1;
    */

        // アニメーション関数
        function animate() {
            requestAnimFrame(animate); // 次の描画タイミングでanimateを呼び出す
            renderer.render(gameScene);   // 描画する
        }

        //正規分布
        function rnorm() {
            // Box-Muller変換で標準正規分布に従う乱数を生成
            let z0 = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
            // 標準正規分布に従う乱数を0-1の範囲に変換
            // 正規分布のCDFを使って変換
            let normalizedValue = (1 + z0) / 2;
            // 0-1の範囲に収める
            return Math.min(Math.max(normalizedValue, 0), 1);
        }

        //生成関数
        function odemashi() {
            var kuji = Math.floor(Math.random() * 99);
            var dbg = (scoreup / 1000).toFixed(1);
            //dtext.text = `${dbg}`;
            //kuji=0;
            if (kuji >= prob_g) {
                apr_value = 1;
                goen.x = 178;
                goen.y = 16
                ballVx = 0;
                ballVy = (rnorm() - 0.5) * (6) + 1 + (rnorm() * dbg - dbg / 3);
                if (ballVy < 0.2) {
                    ballVy *= 1.5;
                }
            } else {
                apr_value = 2;
                ball.x = 178;
                ball.y = 16;
                ballVx = 0;
                //カーブ判定
                if (score > 500) {
                    curve = 15;
                } else if (score > 1000) {
                    curve = 20;
                } else if (score > 1500) {
                    curve = 25;
                } else if (score > 2000) {
                    curve = 30;
                } else if (score > 2500) {
                    curve = 35;
                } else if (score > 3000) {
                    curve = 40;
                }
                kuji = Math.floor(Math.random() * 99) + 1;
                if (kuji <= curve) {
                    curveflg = true;
                    ballVy = (rnorm() - 0.5) * (6) + 1 + (rnorm() * dbg - dbg / 3);
                } else {
                    curveflg = false;
                    ballVy = (rnorm()) * (9) - 3 + (rnorm() * dbg - dbg / 4);
                }
                //dtext.text = `${curveflg}, ${kuji}:${curve},`;
            }
        }

        //ヒットゾーン圏内か判定
        function hitcheck() {
            //5円玉のチェック
            if (apr_value <= 1) {
                //ヒット範囲：32*11(352)-32*14(448)
                if (goen.y >= 32 * 11 && goen.y <= 32 * 12.5 - 3) {
                    hitflg = 1;
                    goen.tint = 0xff9999;
                    //補助線は出現させないけど角度だけ変える（打球方向で使っているため）
                    if (ballVy > 0) {
                        angle_r.rotation = 0.95 + 0.62 * ((goen.y - 32 * 11) / 45);
                    }
                } else if (goen.y >= 32 * 12.5 - 3 && goen.y <= 32 * 12.5 + 3) {
                    hitflg = 2;
                    goen.tint = 0xff9999
                    //補助線は出現させないけど角度だけ変える（打球方向で使っているため）
                    if (ballVy > 0) {
                        angle_r.rotation = 1.57;
                    }
                } else if (goen.y >= 32 * 12.5 + 3 && goen.y <= 32 * 14 - 16) {
                    hitflg = 3;
                    goen.tint = 0xff9999;
                    //補助線は出現させないけど角度だけ変える（打球方向で使っているため）
                    if (ballVy > 0) {
                        angle_r.rotation = 1.57 + 0.6 * ((goen.y - 32 * 12.5 + 3) / 45);
                    }
                } else {
                    if (flg_return) {
                        if (goen.y >= 32 * 2 && goen.y <= 32 * 8) {
                            //hako1との衝突判定
                            if (flg_hako1) {
                                if (((hako1.x - goen.x) ** 2 + (hako1.y - goen.y) ** 2) <= (hako1.width + goen.width - 60) ** 2) {
                                    hit_hako1 = 1;
                                    hitcount_hako1 = hitvalue;
                                }
                            }
                            //hako2との衝突判定
                            if (flg_hako2) {
                                if (((hako2.x - goen.x) ** 2 + (hako2.y - goen.y) ** 2) <= (hako2.width + goen.width - 60) ** 2) {
                                    hit_hako2 = 1;
                                    hitcount_hako2 = hitvalue;
                                }
                            }
                            //hako3との衝突判定
                            if (flg_hako3) {
                                if (((hako3.x - goen.x) ** 2 + (hako3.y - goen.y) ** 2) <= (hako3.width + goen.width - 60) ** 2) {
                                    hit_hako3 = 1;
                                    hitcount_hako3 = hitvalue;
                                }
                            }
                            if (flg_hako4) {
                                //hako4との衝突判定
                                if (((hako4.x - goen.x) ** 2 + (hako4.y - goen.y) ** 2) <= (hako4.width + goen.width - 60) ** 2) {
                                    hit_hako4 = 1;
                                    hitcount_hako4 = hitvalue;
                                }
                            }
                        }
                    }
                    hitflg = 0;
                    goen.tint = 0xffffff;
                }
                //ボールのチェック
            } else {
                //ヒット範囲：32*11(352)-32*14(448)
                if (ball.y >= 32 * 11 && ball.y <= 32 * 12.5 - 3) {
                    hitflg = 1;
                    ball.tint = 0xff9999;
                    //補助線出現
                    angle_r.position.y = 32 * 12.5;
                    if (ballVy > 0) {
                        angle_r.rotation = 0.95 + 0.62 * ((ball.y - 32 * 11) / 45);
                    }
                    //カーブフラグを折る
                    curveflg = false;
                } else if (ball.y >= 32 * 12.5 - 3 && ball.y <= 32 * 12.5 + 3) {
                    hitflg = 2;
                    ball.tint = 0xff9999
                    //補助線出現
                    angle_r.position.y = 32 * 12.5;
                    if (ballVy > 0) {
                        angle_r.rotation = 1.57;
                    }
                    //カーブフラグを折る
                    curveflg = false;
                } else if (ball.y >= 32 * 12.5 + 3 && ball.y <= 32 * 14 - 16) {
                    hitflg = 3;
                    ball.tint = 0xff9999;
                    //補助線出現
                    angle_r.position.y = 32 * 12.5;
                    if (ballVy > 0) {
                        angle_r.rotation = 1.57 + 0.6 * ((ball.y - 32 * 12.5 + 3) / 45);
                    }
                    //カーブフラグを折る
                    curveflg = false;
                } else {
                    if (flg_return) {
                        if (ball.y >= 32 * 4 && ball.y <= 32 * 8) {
                            //hako1との衝突判定
                            if (((hako1.x - ball.x) ** 2 + (hako1.y - ball.y) ** 2) <= (hako1.width + ball.width - 40) ** 2) {
                                hit_hako1 = 1;
                                hitcount_hako1 = hitvalue;
                            }
                            //hako2との衝突判定
                            if (flg_hako2) {
                                if (((hako2.x - ball.x) ** 2 + (hako2.y - ball.y) ** 2) <= (hako2.width + ball.width - 60) ** 2) {
                                    hit_hako2 = 1;
                                    hitcount_hako2 = hitvalue;
                                }
                            }
                            //hako3との衝突判定
                            if (flg_hako3) {
                                if (((hako3.x - ball.x) ** 2 + (hako3.y - ball.y) ** 2) <= (hako3.width + ball.width - 60) ** 2) {
                                    hit_hako3 = 1;
                                    hitcount_hako3 = hitvalue;
                                }
                            }
                            //hako4との衝突判定
                            if (((hako4.x - ball.x) ** 2 + (hako4.y - ball.y) ** 2) <= (hako4.width + ball.width - 40) ** 2) {
                                hit_hako4 = 1;
                                hitcount_hako4 = hitvalue;
                            }
                        }
                    }
                    hitflg = 0;
                    ball.tint = 0xffffff;
                    //補助線排除
                    angle_r.position.y = -100;
                }
            }
        }

        //ボーナス箱生成チャンス
        function hakopop() {
            hako_num = Math.floor(Math.random() * 4);
            debugvalue = hako_num;
            if (hako_num == 0) {
                if (!flg_hako1) {
                    flg_hako1 = true;
                    hako1.rotation = 0;   //回転なし
                    hako1.scale.x = 4;
                    hako1.scale.y = 4;
                    hako1.x = 32; // x座標
                    hako1.y = 32 * 6; // y座標
                    //ボーナス出現エフェクト
                    popbonus_effect = popbonus_effect_value;
                    text_popbonus.x = 8;
                    text_popbonus.y = 32 * 10;
                }
            } else if (hako_num == 1) {
                if (!flg_hako2) {
                    flg_hako2 = true;
                    hako2.rotation = 0;   //回転なし
                    hako2.scale.x = 4;
                    hako2.scale.y = 4;
                    hako2.x = 32 * 3; // x座標
                    hako2.y = 32 * 4; // y座標
                    //ボーナス出現エフェクト
                    popbonus_effect = popbonus_effect_value;
                    text_popbonus.x = 8;
                    text_popbonus.y = 32 * 10;
                }
            } else if (hako_num == 2) {
                if (!flg_hako3) {
                    flg_hako3 = true;
                    hako3.rotation = 0;   //回転なし
                    hako3.scale.x = 4;
                    hako3.scale.y = 4;
                    hako3.x = 32 * 8; // x座標
                    hako3.y = 32 * 4; // y座標
                    //ボーナス出現エフェクト
                    popbonus_effect = popbonus_effect_value;
                    text_popbonus.x = 8;
                    text_popbonus.y = 32 * 10;
                }
            } else {
                if (!flg_hako4) {
                    flg_hako4 = true;
                    hako4.rotation = 0;   //回転なし
                    hako4.scale.x = 4;
                    hako4.scale.y = 4;
                    hako4.x = 32 * 10; // x座標
                    hako4.y = 32 * 6; // y座標                
                    //ボーナス出現エフェクト
                    popbonus_effect = popbonus_effect_value;
                    text_popbonus.x = 8;
                    text_popbonus.y = 32 * 10;
                }
            }
        }

        //落下処理
        function rakka() {
            //重力加速度増加
            ballVy += 0.1
            //5円玉
            if (apr_value <= 1) {
                //回転
                goen.rotation += 0.05
                //位置判定
                if (hitStop == 0) {
                    swing = false;
                    bat.rotation = 3;
                    hitStop -= 1;
                } else if (hitStop < 0) {
                    //速度加算
                    goen.x += ballVx;
                    goen.y += ballVy;

                    if (goen.y >= 548) { // 球が画面下に消えたら
                        if (goen.x > 0 && goen.x < 360) {
                            goenbonus += 1; //連続ゲットボーナス
                            if (goenbonus % 5 == 0) {
                                //ボーナス生成
                                hakopop();
                            }
                            if (goenbonus > 1) {
                                text_goenbonus.text = `お賽銭ｺﾝﾎﾞ：${goenbonus}`;
                                goenbonus_effect = goenbonus_effect_value;
                                text_goenbonus.x = 8;
                                text_goenbonus.y = 32 * 11 + 8;
                                if (goenbonus > goenbonus_max) {
                                    goenbonus_max = goenbonus;
                                }
                            }
                            scoreup += 50 + 10 * Math.floor(goenbonus / 5);
                            scoreup_effect_k = scoreeffectvalue;
                            text_k.text = `お賽銭\n +${50 + 10 * Math.floor(goenbonus / 5)}`;
                            text_k.x = 32 * 3 + text.width;
                            text_k.y = 32 * 2;
                        }
                        goen.x = -50;
                        goen.y = -50;
                        ballVx = 0;
                        ballVy = 0;
                        apr_value = 0;
                        apr_flg = false;
                        flg_return = false;
                        flg_homerun = false;
                    } else if (goen.y < -255) { // 球が画面上に消えたら
                        goen.x = -50;
                        goen.y = -50;
                        ballVx = 0;
                        ballVy = 0;
                        apr_value = 0;
                        apr_flg = false;
                        flg_return = false;
                        flg_homerun = false;
                    } else if (goen.x < -16 || goen.x > 360 + 16) { // 球が画面端に消えたら
                        goen.x = -50;
                        goen.y = -50;
                        ballVx = 0;
                        ballVy = 0;
                        apr_value = 0;
                        apr_flg = false;
                        flg_return = false;
                        flg_homerun = false;
                    }
                } else {
                    if (swing) {
                        bat.rotation -= 0.3925;
                    }
                    //dtext.text = `${swing}}`
                    hitStop -= 1;
                }
            } else {
                //回転
                if (curveflg) {
                    ball.rotation -= 0.1
                } else {
                    ball.rotation += 0.05
                }
                //位置判定
                if (hitStop == 0) {
                    swing = false;
                    bat.rotation = 3;
                    hitStop -= 1;
                } else if (hitStop < 0) {
                    //速度加算
                    if (curveflg) {
                        ball.x += ballVx + curve / 100;
                    } else {
                        ball.x += ballVx;
                    }
                    ball.y += ballVy;

                    if (ball.y >= 548) { // 球が画面下に消えたら
                        //加算中のスコアを最終結果に修正
                        score = scoreup;
                        text.text = `${score}`;
                        //お賽銭ｺﾝﾎﾞのテキストを見える位置に移動
                        text_goenbonus.text = `MAXお賽銭ｺﾝﾎﾞ：${goenbonus_max}`;
                        text_goenbonus.y = 32 * 14
                        //ホームラン数のテキストを見える位置に移動
                        text_hmr.y = 32 * 14
                        //ヒットゾーンを削除
                        debugStage.removeChild(hitRectangle);
                        //ホームランガイドを削除
                        debugStage.removeChild(homerunguide);
                        //ヒットボタンを削除
                        gameScene.removeChild(hitButton);
                        //半透明化
                        gameScene.alpha = 0.5;

                        // 結果画面を表示する
                        createEndScene();
                        /** 
                        ball.x = -50;
                        ball.y = -50;
                        ballVx = 0;
                        ballVy = 0;
                        apr_value = 0;
                        apr_flg = false;
                        flg_return = false;
                        flg_homerun = false;
                        */
                    } else if (ball.y < -255) { // 球が画面上に消えたら                             
                        ball.x = -50;
                        ball.y = -50;
                        ballVx = 0;
                        ballVy = 0;
                        apr_value = 0;
                        apr_flg = false;
                        //スコアアップ
                        if (flg_homerun) {
                            scoreup += 100;
                            //上段のホームランメッセージ用
                            bonus_hmr_effect = bonus_hmr_effect_value;
                            text_homerun.x = 32 * 2;
                            text_homerun.y = 32 * 3.5 - 4;
                            //下段のホームランカウント用
                            hmrcount += 1;    //ホームランカウント
                            hmr_cnt = hmr_cnt_value;
                            text_hmr.text = `ﾎｰﾑﾗﾝ：${hmrcount}`;
                            text_hmr.x = 32 * 8;
                            text_hmr.y = 32 * 11 + 8;
                        } else {
                            scoreup += 10;
                            bonus_hit_effect = bonus_hit_effect_value;
                            text_hit.x = 32 * 4;
                            text_hit.y = 32 * 3.5 - 4;
                        }
                        //最後にフラグを折る
                        flg_return = false;
                        flg_homerun = false;
                    } else if (ball.x < -80 || ball.x > 360 + 80) {    //玉が両端に消えたら
                        ball.x = -50;
                        ball.y = -50;
                        ballVx = 0;
                        ballVy = 0;
                        apr_value = 0;
                        apr_flg = false;
                        //スコアアップ
                        scoreup += 10;
                        //ヒット
                        bonus_hit_effect = bonus_hit_effect_value;
                        text_hit.x = 32 * 4;
                        text_hit.y = 32 * 3.5 - 4;
                        //最後にフラグを折る
                        flg_return = false;
                        flg_homerun = false;
                    }
                } else {
                    if (swing) {
                        bat.rotation -= 0.3925;
                    }
                    //dtext.text = `${swing}}`
                    hitStop -= 1;
                }
            }
        }

        function gameLoop() // 毎フレームごとに処理するゲームループ
        {
            //bat.rotation -= 0.01;

            if (score < scoreup) {
                if (scoreup - score > 50) {
                    score += 4;
                } else if (scoreup - score > 10) {
                    score += 2;
                } else {
                    score += 1;
                }
                text.text = `${score}`;
            }

            //デバッグ用テキスト
            //dtext.text = `Vy:${goenbonus}, R:${random}, C:${count}`;

            //apr_flg true
            if (apr_flg) {
                //箱１ヒット判定
                if (hit_hako1 == 1) {
                    hako1.rotation -= 0.4;
                    if (hitcount_hako1 > 0) {
                        hako1.scale.x -= 0.05;
                        hako1.scale.y -= 0.05;
                        hako1.y += ballVy * 0.8 - 2;
                        hako1.x -= 3;
                        hitcount_hako1 -= 1;
                    } else {
                        scoreup_effect_k = scoreeffectvalue;
                        scoreup += 250;
                        text_k.text = `ボーナス！\n +250`;
                        text_k.x = 32 * 0 + text.width;
                        text_k.y = 32 * 3;
                        hako1.y = -100;
                        hit_hako1 = 0;
                        flg_hako1 = false;
                    }
                }
                //箱２ヒット判定
                if (hit_hako2 == 1) {
                    hako2.rotation -= 0.4;
                    if (hitcount_hako2 > 0) {
                        hako2.scale.x -= 0.05;
                        hako2.scale.y -= 0.05;
                        hako2.y += ballVy * 0.8 - 2;
                        hako2.x -= 3;
                        hitcount_hako2 -= 1;
                    } else {
                        scoreup_effect_k2 = scoreeffectvalue;
                        scoreup += 250;
                        text_k2.text = `ボーナス！\n +250`;
                        text_k2.x = 32 * 1 + text.width;
                        text_k2.y = 32 * 2;
                        hako2.y = -100;
                        hit_hako2 = 0;
                        flg_hako2 = false;
                    }
                }
                //箱３ヒット判定
                if (hit_hako3 == 1) {
                    hako3.rotation -= 0.4;
                    if (hitcount_hako3 > 0) {
                        hako3.scale.x -= 0.05;
                        hako3.scale.y -= 0.05;
                        hako3.y += ballVy * 0.8 - 2;
                        hako3.x -= 3;
                        hitcount_hako3 -= 1;
                    } else {
                        scoreup_effect_k2 = scoreeffectvalue;
                        scoreup += 250;
                        text_k2.text = `ボーナス！\n +250`;
                        text_k2.x = 32 * 4.5 + text.width;
                        text_k2.y = 32 * 2;
                        hako3.y = -100;
                        hit_hako3 = 0;
                        flg_hako3 = false;
                    }
                }
                //箱４ヒット判定
                if (hit_hako4 == 1) {
                    hako4.rotation += 0.4;
                    if (hitcount_hako4 > 0) {
                        hako4.scale.x -= 0.05;
                        hako4.scale.y -= 0.05;
                        hako4.y += ballVy * 0.8 - 2;
                        hako4.x += 3;
                        hitcount_hako4 -= 1;
                    } else {
                        scoreup_effect_k = scoreeffectvalue;
                        scoreup += 250;
                        text_k.text = `ボーナス！\n +250`;
                        text_k.x = 32 * 5.5 + text.width;
                        text_k.y = 32 * 3;
                        hako4.y = -100;
                        hit_hako4 = 0;
                        flg_hako4 = false;
                    }
                }
                hitcheck();
                //apr_flg false
            } else {
                count++;
                if (count >= random * 60) {
                    count = 0;
                    random = (Math.random() * 0 + 0.2).toFixed(2);
                    apr_flg = true;
                    odemashi();
                }
            }
            rakka();

            //箱１の動き
            if (flg_hako1) {
                hako1.y += movey_value_hako1;
                if (hako1.y >= 32 * 6 + movey_hako1) {
                    movey_value_hako1 *= -1;
                } else if (hako1.y <= 32 * 6 - movey_hako1) {
                    movey_value_hako1 *= -1;
                }
                hako1.x += movex_value_hako1;
                if (hako1.x >= 32 + movex_hako1) {
                    movex_value_hako1 *= -1;
                } else if (hako1.x <= 32 - movex_hako1) {
                    movex_value_hako1 *= -1;
                }
                hako1.rotation += rotation_value_hako1;
                if (hako1.rotation >= 0 + rotation_hako1) {
                    rotation_value_hako1 *= -1;
                } else if (hako1.rotation <= 0 - rotation_hako1) {
                    rotation_value_hako1 *= -1;
                }
            }

            //箱２の動き
            if (flg_hako2) {
                hako2.y += movey_value_hako2;
                if (hako2.y >= 32 * 4 + movey_hako2) {
                    movey_value_hako2 *= -1;
                } else if (hako2.y <= 32 * 4 - movey_hako2) {
                    movey_value_hako2 *= -1;
                }
                hako2.x += movex_value_hako2;
                if (hako2.x >= 32 + movex_hako2) {
                    movex_value_hako2 *= -1;
                } else if (hako2.x <= 32 - movex_hako2) {
                    movex_value_hako2 *= -1;
                }
                hako2.rotation += rotation_value_hako2;
                if (hako2.rotation >= 0 + rotation_hako2) {
                    rotation_value_hako2 *= -1;
                } else if (hako2.rotation <= 0 - rotation_hako2) {
                    rotation_value_hako2 *= -1;
                }
            }

            //箱３の動き
            if (flg_hako3) {
                hako3.y += movey_value_hako3;
                if (hako3.y >= 32 * 4 + movey_hako3) {
                    movey_value_hako3 *= -1;
                } else if (hako3.y <= 32 * 4 - movey_hako3) {
                    movey_value_hako3 *= -1;
                }
                hako3.x += movex_value_hako3;
                if (hako3.x >= 32 + movex_hako3) {
                    movex_value_hako3 *= -1;
                } else if (hako3.x <= 32 - movex_hako3) {
                    movex_value_hako3 *= -1;
                }
                hako3.rotation += rotation_value_hako3;
                if (hako3.rotation >= 0 + rotation_hako3) {
                    rotation_value_hako3 *= -1;
                } else if (hako3.rotation <= 0 - rotation_hako3) {
                    rotation_value_hako3 *= -1;
                }
            }

            //箱４の動き
            if (flg_hako4) {
                hako4.y += movey_value_hako4;
                if (hako4.y >= 32 * 6 + movey_hako4) {
                    movey_value_hako4 *= -1;
                } else if (hako4.y <= 32 * 6 - movey_hako4) {
                    movey_value_hako4 *= -1;
                }
                hako4.x += movex_value_hako4;
                if (hako4.x >= 32 + movex_hako4) {
                    movex_value_hako4 *= -1;
                } else if (hako4.x <= 32 - movex_hako4) {
                    movex_value_hako4 *= -1;
                }
                hako4.rotation += rotation_value_hako4;
                if (hako4.rotation >= 0 + rotation_hako4) {
                    rotation_value_hako4 *= -1;
                } else if (hako4.rotation <= 0 - rotation_hako4) {
                    rotation_value_hako4 *= -1;
                }
            }

            //スコアアップ用エフェクト
            if (scoreup_effect_k > 0) {
                text_k.y -= 0.9;
                scoreup_effect_k -= 1;
            } else if (scoreup_effect_k == 0) {
                text_k.y = -100;
            }

            //スコアアップ用エフェクト２
            if (scoreup_effect_k2 > 0) {
                text_k2.y -= 0.9;
                scoreup_effect_k2 -= 1;
            } else if (scoreup_effect_k2 == 0) {
                text_k2.y = -100;
            }

            //五円ボーナス用エフェクト
            if (goenbonus > 1) {
                if (goenbonus_effect > 0) {
                    //text_goenbonus.x=32*0.5;
                    text_goenbonus.y -= 1;
                    goenbonus_effect -= 1;
                }
            } else {
                text_goenbonus.y = -100;
            }

            //ホームランカウント用エフェクト
            if (hmrcount > 0) {
                if (hmr_cnt > 0) {
                    text_hmr.y -= 1;
                    hmr_cnt -= 1;
                }
            } else {
                text_hmr.y = -100;
            }

            //ボーナス出現用エフェクト
            if (popbonus_effect > 0) {
                text_popbonus.y -= 0.5;
                popbonus_effect -= 1;
            } else if (popbonus_effect == 0) {
                text_popbonus.y = -100;
            }

            //ヒット用エフェクト
            if (bonus_hit_effect > 0) {
                text_hit.y -= 0.9;
                bonus_hit_effect -= 1;
            } else if (bonus_hit_effect == 0) {
                text_hit.y = -100;
            }

            //ホームラン用エフェクト
            if (bonus_hmr_effect > 0) {
                text_homerun.y -= 0.9;
                bonus_hmr_effect -= 1;
            } else if (bonus_hmr_effect == 0) {
                hakopop();
                bonus_hmr_effect -= 1;
            } else {
                text_homerun.y = -100;
            }

        }

        // ゲームループ関数を毎フレーム処理の関数として追加
        addGameLoop(gameLoop);
    }

    /**
     * ゲームの結果画面シーンを生成する関数
     */
    function createEndScene() {
        // 他に表示しているシーンがあれば削除
        //removeAllScene();
        //removeAllScene();

        // 毎フレームイベントを削除
        removeAllGameLoops();

        // ゲーム用のシーン表示
        const endScene = new PIXI.Container();
        // シーンを画面に追加する
        app.stage.addChild(endScene);

        //赤い背景
        akawaku = new PIXI.Graphics();
        akawaku.beginFill(0xcc0000);
        akawaku.lineStyle(1, 0x000000, 1, 0);
        akawaku.drawRect(0, 0, 32 * 9, 32 * 12);
        akawaku.endFill();
        akawaku.position.set(32 * 1, 32 * 2);
        akawaku.alpha = 0.95;
        endScene.addChild(akawaku);

        //白背景
        waku_shiro = new PIXI.Graphics();
        waku_shiro.beginFill(0xffffff);
        waku_shiro.drawRect(0, 0, 32 * 9 - 24, 32 * 12 - 24);
        waku_shiro.endFill();
        waku_shiro.position.set(32 * 1 + 12, 32 * 2 + 12);
        //waku_shiro.alpha = 0.8;
        endScene.addChild(waku_shiro);

        //黒い枠線1
        waku_kuro1 = new PIXI.Graphics();
        waku_kuro1.beginFill(0xffffff);
        waku_kuro1.lineStyle(3, 0x000000, 1, 0);
        waku_kuro1.drawRect(0, 0, 32 * 8 - 16, 32 * 8 + 4);
        waku_kuro1.endFill();
        waku_kuro1.position.set(32 * 1 + 24, 32 * 2 + 24);
        waku_kuro1.alpha = 0.95;
        endScene.addChild(waku_kuro1);

        //運勢表示用
        const textStyle = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 64,// フォントサイズ
            fill: 0xcc0000, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            fontWeight: 'bold',
            stroke: '#ffffff',
            strokeThickness: 5,
            dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            dropShadowBlur: 4,
            dropShadowDistance: 0, // ドロップシャドウの影の距離
        });

        //汎用メッセージ表示用
        const textStyle_general = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 22,// フォントサイズ
            fill: 0x000000, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
            //dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
            //dropShadowBlur: 2,
            //dropShadowDistance: 2, // ドロップシャドウの影の距離
            wordWrap: true,  //折り返し有効
            wordWrapWidth: 32 * 7,  //折り返し幅
            breakWords: true    //単語が長くても折り返す
        });

        //ミニメッセージ表示用１
        const textStyle_mini1 = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 17,// フォントサイズ
            fill: 0x000000, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
        });

        //ミニメッセージ表示用２
        const textStyle_mini2 = new PIXI.TextStyle({
            fontFamily: "Arial", // フォント
            fontSize: 14,// フォントサイズ
            fill: 0x000000, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
        });

        //運勢判定
        var unsei = "バグ吉";
        var unsei_text = "これが出るのはバグ！制作者に教えて！";
        var nextvalue = 0;
        if (score < 50) {
            unsei = "豆吉";
            unsei_text = "運気が集まっている！";
            nextvalue = 50 - score;
        } else if (score < 500) {
            unsei = "小吉";
            unsei_text = "小さい幸、見つけた！"
            nextvalue = 500 - score;
        } else if (score < 1000) {
            unsei = "蛇吉";
            unsei_text = "のびつづけている！"
            nextvalue = 1000 - score;
        } else if (score < 1500) {
            unsei = "吉";
            unsei_text = "誰よりも吉と言える！"
            nextvalue = 1500 - score;
        } else if (score < 2000) {
            unsei = "猫吉";
            unsei_text = "今なら猫になれる！"
            nextvalue = 2000 - score;
        } else if (score < 2500) {
            unsei = "大吉";
            unsei_text = "君はビッグになれる！"
            nextvalue = 2500 - score;
        } else if (score < 3000) {
            unsei = "夢吉";
            unsei_text = "どんな夢でも叶う！"
            nextvalue = 3000 - score;
        } else {
            unsei = "最強";
            unsei_text = "君も神になろう！"
            nextvalue = 0;
        }


        //運勢表示用テキスト
        const text_result = new PIXI.Text(`${unsei}`, textStyle); // 結果画面のテキスト
        text_result.anchor.x = 0.5; // アンカーのxを中央に指定
        text_result.x = 32 * 5.5; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
        text_result.y = 32 * 3; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
        endScene.addChild(text_result); // 結果画面シーンにテキスト追加

        //応援メッセージ表示用テキスト
        const text_ouen = new PIXI.Text(`${unsei_text}`, textStyle_general); // 結果画面のテキスト
        text_ouen.anchor.x = 0.5; // アンカーのxを中央に指定
        text_ouen.x = 32 * 5.5; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
        text_ouen.y = 32 * 6 - 12; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
        endScene.addChild(text_ouen); // 結果画面シーンにテキスト追加

        const negai = ['成就', '大成', '貫徹', '奏功'];
        const ryoko = ['快適', '楽々', '沖縄', 'ハワイ'];
        const yamai = ['治る', '消滅', '中二病', '反抗期'];
        const study = ['絶好調', '忍耐', '良好', '算数'];
        const usmno = ['出る', '出そう', '出た', 'メガネ'];

        var r1 = Math.floor(Math.random() * 4);
        var r2 = Math.floor(Math.random() * 4);
        var r3 = Math.floor(Math.random() * 4);
        var r4 = Math.floor(Math.random() * 4);

        //色々運勢メッセージ表示用テキスト
        const text_memo = new PIXI.Text(`願事：${negai[r1]}\n旅行：${ryoko[r2]}\n病気：${yamai[r3]}\n学問：${study[r4]}\n失物：${usmno[r4]}`, textStyle_mini1); // 結果画面のテキスト
        text_memo.x = 32 * 4; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
        text_memo.y = 32 * 7 - 8; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
        endScene.addChild(text_memo); // 結果画面シーンにテキスト追加

        //ネクストメッセージ表示用テキスト
        if (nextvalue != 0) {
            const text_next = new PIXI.Text(`あと${nextvalue}Pで運勢アップの予感…！`, textStyle_mini2); // 結果画面のテキスト
            text_next.x = 32 * 2; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
            text_next.y = 32 * 10 + 4; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
            endScene.addChild(text_next); // 結果画面シーンにテキスト追加
        } else {
            const text_next = new PIXI.Text(`最強の運勢に幸あれ…！`, textStyle_mini2); // 結果画面のテキスト
            text_next.x = 32 * 2; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
            text_next.y = 32 * 10 + 4; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
            endScene.addChild(text_next); // 結果画面シーンにテキスト追加
        }

        //攻略小話のヘッダ用テキスト
        const text_kogoto_h = new PIXI.Text(`＜まめちしき＞`, textStyle_mini2); // 結果画面のテキスト
        text_kogoto_h.x = 32 * 2 - 16; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
        text_kogoto_h.y = 32 * 11 + 12; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
        endScene.addChild(text_kogoto_h); // 結果画面シーンにテキスト追加

        var r5 = Math.floor(Math.random() * 6);
        const mamegoto = [
            'ヒットゾーンの中心とボールの中心が\n重なるとホームラン、高得点だ！',
            '５円玉を５回連続スルーするごとに\nボーナス出現のチャンスだ！',
            'ヒットゾーンの上段だと左側、\n下段だと右側へ打ち返すぞ！',
            '５円玉の連続スルーを継続するほど、\nもらえる御利益Ｐが増えるぞ！',
            '左回転のボールは魔球カーブ、\nボールが少し右に曲がり打つづらいぞ！',
            '画面上のボーナスが消えているほど、\nボーナスは出現しやすくなるぞ！'
        ];
        //攻略小話用のテキスト
        const text_kogoto = new PIXI.Text(`${mamegoto[r5]}`, textStyle_mini2); // 結果画面のテキスト
        text_kogoto.x = 32 * 2 - 8; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
        text_kogoto.y = 32 * 12; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
        endScene.addChild(text_kogoto); // 結果画面シーンにテキスト追加

        //もう一度ボタン
        const retryButton = createButton("もう一度", 360, 64, 0xcc0000, () => {
            // クリックした時の処理
            removeAllScene();   //一応入れておく
            createGameScene(); // ゲームシーンを生成する
        });
        retryButton.x = 32 * 0; // ボタンの座標指定
        retryButton.y = 32 * 14 + 8; // ボタンの座標指定
        endScene.addChild(retryButton);　// ボタンを結果画面シーンに追加
    }

    // 起動直後はゲームシーンを追加する
    createStartScene();
});
