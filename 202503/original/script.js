import { TextFactory } from './class/TextFactory.js'; // BinaryTreeクラスをインポート
import { ButtonWithText } from './class/ButtonWithText.js'; // ButtonWithTextクラスをインポート
import { BinaryTree } from './class/BinaryTree.js'; // BinaryTreeクラスをインポート
import { BinaryTreeVisualizer } from './class/BinaryTreeVisualizer.js'; // BinaryTreeVisualizerクラスをインポート

// PIXI.jsアプリケーションを作成
const app = new PIXI.Application({
    width: 360,
    height: 548,
});
document.getElementById('canvas-container').appendChild(app.view);

// canvasのcss定義
app.renderer.view.style.position = "relative";  // 親要素に対して相対的に配置
app.renderer.view.style.display = "block";      // inlineではなくblockとして振る舞う
app.renderer.view.style.width = "360px";        // 実際に画面に表示する横幅
app.renderer.view.style.height = "548px";       // 実際に画面に表示する縦幅
app.renderer.backgroundColor = 0xE5F5CC;        // 背景色の設定
//app.renderer.view.style.border = "2px dashed black";  // canvasを点線枠で囲う（確認用）

/** 
 * ゲーム全体で使用する変数の定義
 * (AallVar)
 */
let currentScene;               // 現在のシーン
let level = 0;                  // ゲームのレベル
let levelStartTime = Date.now();     // ゲーム開始時間
let timeTaken = 0;              // クリアまでの時間
let isResetting = false;        // シーンリセット中かどうかのフラグ
let totalScore = 0;             // 総スコア
let gamemode = -1;              // 0：通常、1：エンドレス

// グローバルな変数でリソースを保持
let possibleNumbers = [];   // 01～99が入った要素
let inputArray = [];        // 二分木の要素
let randomIndex;            // 問題
let answerCount = 0;        // 総回答数
let quizCount = [];         // 設問ごとの回答数
let daimaoImage;
let startFlg = false;           // ゲーム開始フラグ、動き始めるきっかけ
let timeElapsed = 0;            // 経過時間（秒）

// UI用のコンテナ（スコア表示やボタンなど）
let uiContainer = new PIXI.Container();
let uiContainerD = new PIXI.Container();

// UIエリア（中）
const uiBackgroundC = new PIXI.Graphics();
uiBackgroundC.beginFill(0xFFEBEB, 1);  // 薄いベージュ色
uiBackgroundC.drawRect(0, 50, 360, 430);  // UIエリアの位置とサイズ
uiBackgroundC.endFill();
//uiContainer.addChild(uiBackgroundC);

//デバッグ用テキスト
const message_seikai = new TextFactory('正 解！', 32, '0x000000');
message_seikai.x = 134;
message_seikai.y = 490;
message_seikai.setBold(true);                    　　// 太字に変更
message_seikai.setStroke('0xFFCC66', 4);              // 縁取りを追加（色、太さ）
message_seikai.setShadow(true, '0xE5F5CC', 2, 3);    // 影を追加（有効/無効、影の色、ぼかし、距離）

// UIエリア（上）
const uiBackgroundU = new PIXI.Graphics();
uiBackgroundU.beginFill(0xFFFFF0);  // 薄いベージュ色
uiBackgroundU.drawRect(0, 0, 360, 50);  // UIエリアの位置とサイズ
uiBackgroundU.endFill();
uiContainer.addChild(uiBackgroundU);

// UIエリア（下）
const uiBackgroundD = new PIXI.Graphics();
uiBackgroundD.beginFill(0xFFFFF0);  // 薄いベージュ色
uiBackgroundD.drawRect(0, 480, 360, 200);  // UIエリアの位置とサイズ
uiBackgroundD.endFill();
uiContainer.addChild(uiBackgroundD);

//デバッグ用テキスト
const text_u = new TextFactory('Ｑ１／５　範囲:１～２０　総回答数:３３', 19, '#000000');
uiContainer.addChild(text_u); // スコア表示テキストを画面に追加する
text_u.x = 0;
text_u.y = 0;

//デバッグ用テキスト
const dtext = new TextFactory('？の数字はなんだろう？', 19, '#555555');
uiContainer.addChild(dtext); // スコア表示テキストを画面に追加する
dtext.x = 0;
dtext.y = 26;


// リソースの事前読み込み
PIXI.loader
    .add('daimao', 'daimao.png')    // だいまおうさま
    .load(onAssetsLoaded);          // ロード後に実行される処理

// ロード後に実行される処理
function onAssetsLoaded(loader, resources) {
    // 画像リソースをグローバルに保存
    daimaoImage = resources.daimao.texture;

    switchScene('title');  // 読み込み完了後にタイトルシーンに遷移
}


/** 
 * タイトルシーン
 * (Atitle)
 */
function createTitleScene() {
    // ローカル変数宣言
    level = 0;                // 問題数
    answerCount = 0;        // 総回答数
    inputArray = [];
    let setumeinum = 1; // いま何ページ目
    let maxnum = 9;   // 説明ページの最後

    // タイトルシーン作成
    const titleScene = new PIXI.Container();
    const demoArea = new PIXI.Container();
    app.stage.addChild(demoArea);

    // 説明エリア
    const bgArea = new PIXI.Graphics();
    bgArea.beginFill(0xcccccc, 0.2);
    bgArea.drawRoundedRect(0, 0, 340, 250, 15);
    bgArea.endFill();
    bgArea.x = 10;
    bgArea.y = 210;
    titleScene.addChild(bgArea);

    function setumei(num) {
        if (num === 1) {
            // 説明１
            // 二分木を作成
            inputArray = [2, 4, 1, 3, 5];
            const tree = new BinaryTree();
            inputArray.forEach((value) => tree.insert(value));

            // 二分木を視覚化
            const visualizer = new BinaryTreeVisualizer(app, demoArea, tree, inputArray[6]);
            visualizer.visualizeDemo(80, 250, false);

            // 説明1
            const textRule1 = new TextFactory('二分木とは…\n数字を繋げたもの。', 18, '#000000');
            textRule1.setLineHeight(20 * 1.5);                // 行間を変更
            textRule1.x = 170;
            textRule1.y = 220;
            demoArea.addChild(textRule1);

            // 説明1
            const textRule1_2 = new TextFactory('左に小さい数字を、\n右に大きい数字を、\n繋げていくよ。', 18, '#000000');
            textRule1_2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule1_2.x = 170;
            textRule1_2.y = 290;
            demoArea.addChild(textRule1_2);

            // 説明タイトル
            const textNibungi = new TextFactory('はじめに(1/4)', 28, '#000000');
            textNibungi.setLineHeight(23 * 1.5);                // 行間を変更
            textNibungi.anchor.set(0.5);
            textNibungi.x = app.view.width / 2 + 5;
            textNibungi.y = 425;
            demoArea.addChild(textNibungi);

        } else if (num === 2) {
            // 説明２
            // 二分木を作成
            inputArray = [2, 4];
            const tree2 = new BinaryTree();
            inputArray.forEach((value) => tree2.insert(value));

            // 二分木を視覚化
            const visualizer2 = new BinaryTreeVisualizer(app, demoArea, tree2, inputArray[6]);
            visualizer2.visualizeDemo(80, 250, false);

            // 説明2
            const textRule2 = new TextFactory('ためしてみよう。\n2, 4を繋げると…', 18, '#000000');
            textRule2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2.x = 170;
            textRule2.y = 220;
            demoArea.addChild(textRule2);

            // 説明2-2
            const textRule2_2 = new TextFactory('まず、2を置く。\n次に4と2を比べて、\n4は大きいから右。', 18, '#000000');
            textRule2_2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2_2.x = 170;
            textRule2_2.y = 290;
            demoArea.addChild(textRule2_2);

            // 説明タイトル
            const textNibungi = new TextFactory('はじめに(2/4)', 28, '#000000');
            textNibungi.setLineHeight(23 * 1.5);                // 行間を変更
            textNibungi.anchor.set(0.5);
            textNibungi.x = app.view.width / 2 + 5;
            textNibungi.y = 425;
            demoArea.addChild(textNibungi);

        } else if (num === 3) {
            // 説明３
            // 二分木を作成
            inputArray = [2, 4, 3];
            const tree2 = new BinaryTree();
            inputArray.forEach((value) => tree2.insert(value));

            // 二分木を視覚化
            const visualizer2 = new BinaryTreeVisualizer(app, demoArea, tree2, inputArray[6]);
            visualizer2.visualizeDemo(80, 250, false);

            // 説明2
            const textRule2 = new TextFactory('次に3を追加しよう。\n3と2を比べて、\n3は大きいから右。\n右には4がある。\n3と4を比べて、\n3は小さいから左。', 18, '#000000');
            textRule2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2.x = 170;
            textRule2.y = 220;
            demoArea.addChild(textRule2);

            // 説明タイトル
            const textNibungi = new TextFactory('はじめに(3/4)', 28, '#000000');
            textNibungi.setLineHeight(23 * 1.5);                // 行間を変更
            textNibungi.anchor.set(0.5);
            textNibungi.x = app.view.width / 2 + 5;
            textNibungi.y = 425;
            demoArea.addChild(textNibungi);

        } else if (num === 4) {
            // 説明４
            // 二分木を作成
            inputArray = [2, 4, 3, 1, 5];
            const tree2 = new BinaryTree();
            inputArray.forEach((value) => tree2.insert(value));

            // 二分木を視覚化
            const visualizer2 = new BinaryTreeVisualizer(app, demoArea, tree2, inputArray[6]);
            visualizer2.visualizeDemo(80, 250, false);

            // 説明2
            const textRule2 = new TextFactory('二分木の作り方は\nバッチリだね！', 18, '#000000');
            textRule2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2.x = 170;
            textRule2.y = 220;
            demoArea.addChild(textRule2);

            // 説明2
            const textRule2_2 = new TextFactory('このゲームは、\n二分木の数字を\n当てるゲームだよ。', 18, '#000000');
            textRule2_2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2_2.x = 170;
            textRule2_2.y = 290;
            demoArea.addChild(textRule2_2);

            // 説明タイトル
            const textNibungi = new TextFactory('はじめに(4/4)', 28, '#000000');
            textNibungi.setLineHeight(23 * 1.5);                // 行間を変更
            textNibungi.anchor.set(0.5);
            textNibungi.x = app.view.width / 2 + 5;
            textNibungi.y = 425;
            demoArea.addChild(textNibungi);

        } else if (num === 5) {
            // 説明５
            // 二分木を作成
            inputArray = [3, 5, 4, 2, 1];
            const tree5 = new BinaryTree();
            inputArray.forEach((value) => tree5.insert(value));

            // 二分木を視覚化
            const visualizer5 = new BinaryTreeVisualizer(app, demoArea, tree5, inputArray[2]);
            visualizer5.visualizeDemo(80, 250, false);

            // 説明2
            const textRule2 = new TextFactory('？の数字は？\n(１～５の数字)', 18, '#000000');
            textRule2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2.x = 170;
            textRule2.y = 220;
            demoArea.addChild(textRule2);

            // 説明2
            const textRule2_2 = new TextFactory('3より大きくて、\n5より小さいから、\n？は4なのだ！', 18, '#000000');
            textRule2_2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2_2.x = 170;
            textRule2_2.y = 290;
            demoArea.addChild(textRule2_2);

            // 説明タイトル
            const textNibungi = new TextFactory('ヒント！(1/4)', 28, '#000000');
            textNibungi.setLineHeight(23 * 1.5);                // 行間を変更
            textNibungi.anchor.set(0.5);
            textNibungi.x = app.view.width / 2 + 5;
            textNibungi.y = 425;
            demoArea.addChild(textNibungi);

        } else if (num === 6) {
            // 説明６
            // 二分木を作成
            inputArray = [1, 4, 5];
            const tree5 = new BinaryTree();
            inputArray.forEach((value) => tree5.insert(value));

            // 二分木を視覚化
            const visualizer5 = new BinaryTreeVisualizer(app, demoArea, tree5, inputArray[1]);
            visualizer5.visualizeDemo(80, 250, false);

            // 説明2
            const textRule2 = new TextFactory('候補が複数のときは？\n1と5の間だから、\n2, 3, 4が候補っぽい。', 18, '#000000');
            textRule2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2.x = 170;
            textRule2.y = 220;
            demoArea.addChild(textRule2);

            // 説明2
            const textRule2_2 = new TextFactory('\nこういうときは、\n間の3を選ぶと…', 18, '#000000');
            textRule2_2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2_2.x = 170;
            textRule2_2.y = 290;
            demoArea.addChild(textRule2_2);

            // 説明タイトル
            const textNibungi = new TextFactory('ヒント！(2/4)', 28, '#000000');
            textNibungi.setLineHeight(23 * 1.5);                // 行間を変更
            textNibungi.anchor.set(0.5);
            textNibungi.x = app.view.width / 2 + 5;
            textNibungi.y = 425;
            demoArea.addChild(textNibungi);

        } else if (num === 7) {
            // 説明７
            // 二分木を作成
            inputArray = [1, 4, 5, 3];
            const tree5 = new BinaryTree();
            inputArray.forEach((value) => tree5.insert(value));

            // 二分木を視覚化
            const visualizer5 = new BinaryTreeVisualizer(app, demoArea, tree5, inputArray[1]);
            visualizer5.visualizeDemo(80, 250, false);

            // 説明2
            const textRule2 = new TextFactory('3が追加されたね。\nハズレのときは、\n数字が繋がるんだ。', 18, '#000000');
            textRule2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2.x = 170;
            textRule2.y = 220;
            demoArea.addChild(textRule2);

            // 説明2
            const textRule2_2 = new TextFactory('\n3より大きいから、\n答えは4に絞れた！', 18, '#000000');
            textRule2_2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2_2.x = 170;
            textRule2_2.y = 290;
            demoArea.addChild(textRule2_2);

            // 説明タイトル
            const textNibungi = new TextFactory('ヒント！(3/4)', 28, '#000000');
            textNibungi.setLineHeight(23 * 1.5);                // 行間を変更
            textNibungi.anchor.set(0.5);
            textNibungi.x = app.view.width / 2 + 5;
            textNibungi.y = 425;
            demoArea.addChild(textNibungi);

        } else if (num === 8) {
            // 説明８
            // 二分木を作成
            inputArray = [1, 4, 5, 3];
            const tree5 = new BinaryTree();
            inputArray.forEach((value) => tree5.insert(value));

            // 二分木を視覚化
            const visualizer5 = new BinaryTreeVisualizer(app, demoArea, tree5, inputArray[1]);
            visualizer5.visualizeDemo(80, 250, false);
            visualizer5.correct();

            // 説明2
            const textRule2 = new TextFactory('困ったときは、\n間の数字を選べば\n正解が絞りやすい。', 18, '#000000');
            textRule2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2.x = 170;
            textRule2.y = 220;
            demoArea.addChild(textRule2);

            // 説明2
            const textRule2_2 = new TextFactory('\nただ、記録狙いで\n一発正解を目指すのも\n格好良いと思うよ！', 18, '#000000');
            textRule2_2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2_2.x = 170;
            textRule2_2.y = 290;
            demoArea.addChild(textRule2_2);

            // 説明タイトル
            const textNibungi = new TextFactory('ヒント！(4/4)', 28, '#000000');
            textNibungi.setLineHeight(23 * 1.5);                // 行間を変更
            textNibungi.anchor.set(0.5);
            textNibungi.x = app.view.width / 2 + 5;
            textNibungi.y = 425;
            demoArea.addChild(textNibungi);

        } else {
            demoArea.removeChildren();

            // だいまおうさま
            const mao = new PIXI.Sprite(daimaoImage);
            mao.anchor.set(0.5); // 画像の中心を基準に回転させる
            mao.scale.x = 2;
            mao.scale.y = 2;
            mao.x = 80;         // 初期位置x
            mao.y = 300;        // 初期位置y
            mao.alpha = 1;      // 透明度
            demoArea.addChild(mao);

            // 説明2
            const textRule2 = new TextFactory('説明はここまで。\nやってみるのじゃ。\n検討を祈るぞ。', 18, '#000000');
            textRule2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2.x = 170;
            textRule2.y = 220;
            demoArea.addChild(textRule2);

            // 説明2
            const textRule2_2 = new TextFactory('\nby超博士シリスギール', 16, '#000000');
            textRule2_2.setLineHeight(20 * 1.5);                // 行間を変更
            textRule2_2.x = 170;
            textRule2_2.y = 290;
            demoArea.addChild(textRule2_2);

            // 説明タイトル
            const textNibungi = new TextFactory('自己紹介だよ', 28, '#000000');
            textNibungi.setLineHeight(23 * 1.5);                // 行間を変更
            textNibungi.anchor.set(0.5);
            textNibungi.x = app.view.width / 2 + 5;
            textNibungi.y = 425;
            demoArea.addChild(textNibungi);

        }
    }



    // タイトル周辺に装飾図形を追加
    const shapes = [];
    for (let i = 0; i < 10; i++) {
        const shape = new PIXI.Graphics();
        shape.beginFill(0x66ccff, 0.5);
        shape.drawCircle(0, 0, Math.random() * 10 + 5);
        shape.endFill();
        shape.x = Math.random() * 360;
        shape.y = Math.random() * 50 + 30;
        titleScene.addChild(shape);
        shapes.push(shape);
    }

    // タイトルロゴの作成
    const title = new PIXI.Text('二分木クイズ', {
        fontFamily: 'Arial',
        fontSize: 40,
        fill: 0xff66cc,
        fontWeight: 'bold',
        align: 'center',
        stroke: 0x333333,
        strokeThickness: 3,
    });
    title.anchor.set(0.5);
    title.x = app.view.width / 2;
    title.y = 60;
    titleScene.addChild(title);

    // タイトルを囲むスタイリッシュな装飾
    const border = new PIXI.Graphics();
    border.lineStyle(4, 0x66ccff, 1);
    border.drawRoundedRect(title.x - 150, title.y - 30, 300, 60, 15);
    titleScene.addChild(border);

    // 説明文
    const myText = new TextFactory('３月といえば期末試験…\nだから二分木クイズをやろう！\n少ない回数で数字を当ててね。', 23, '#000000');
    myText.setLineHeight(23 * 1.5);                // 行間を変更
    myText.anchor.set(0.5);
    myText.x = app.view.width / 2;
    myText.y = 155;
    titleScene.addChild(myText);

    // ボタンを作成する関数
    const createButton = (x, y, color, shape, onClick) => {
        const button = new PIXI.Graphics();
        button.beginFill(color);
        if (shape === 'circle') {
            button.drawCircle(0, 0, 30);
        } else if (shape === 'triangleL') {
            // 左向きの三角形（マイナスボタン）
            button.moveTo(-60, 0);  // 右側の頂点
            button.lineTo(0, -30); // 左側の頂点
            button.lineTo(0, 30);    // 下側の頂点
        } else if (shape === 'triangleR') {
            // 右向きの三角形（プラスボタン）
            button.moveTo(60, 0);  // 左側の頂点
            button.lineTo(0, -30);   // 右側の頂点
            button.lineTo(0, 30);     // 下側の頂点
        } else if (shape === 'triangleRX') {
            // 右向きの大三角形（次の画面へ進む用）
            button.moveTo(75, 0);  // 左側の頂点
            button.lineTo(0, -30);   // 右側の頂点
            button.lineTo(0, 30);     // 下側の頂点
        }
        button.endFill();
        button.x = x;
        button.y = y;
        button.interactive = true;
        button.buttonMode = true;

        button.on('pointerdown', () => {
            // ボタンを押したときに色を変更
            button.tint = 0xAAAAAA;  // グレーに変更（押された状態）
            // 最初のクリックで即座に呼び出し
            onClick();
        });

        button.on('pointerup', () => {
            // ボタンを離したときに元の色に戻す
            button.tint = 0xFFFFFF;  // 元の色（デフォルトの色）に戻す
        });

        button.on('pointerout', () => {
            // ボタンを離したときに元の色に戻す
            button.tint = 0xFFFFFF;  // 元の色（デフォルトの色）に戻す
        });

        return button;
    };

    // -1 ボタン（三角形）
    const buttonL = createButton(80, 425, 0xFFCC66, 'triangleL', () => changeContext(-1));
    titleScene.addChild(buttonL);

    // +1 ボタン（三角形）
    const buttonR = createButton(280, 425, 0xFFCC66, 'triangleR', () => changeContext(1));
    titleScene.addChild(buttonR);

    function changeContext(num) {
        setumeinum += num;
        if (setumeinum < 1) {
            setumeinum = maxnum;
        } else if (setumeinum > maxnum) {
            setumeinum = 1;
        }
        setumei(setumeinum);
    }

    setumei(1);

    // スタートボタンの作成
    const button = new PIXI.Graphics();
    button.beginFill(0xFFCC66);
    button.drawRoundedRect(0, 0, 160, 50, 15);
    button.endFill();
    button.interactive = true;
    button.buttonMode = true;
    button.x = app.view.width / 2 - 80;
    button.y = 480;
    titleScene.addChild(button);

    const buttonText = new PIXI.Text('スタート', {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0x00000,
        fontWeight: 'bold',
    });
    buttonText.anchor.set(0.5);
    buttonText.x = button.x + 80;
    buttonText.y = button.y + 25;
    titleScene.addChild(buttonText);

    // スタートボタンのクリックイベント
    button.on('pointerdown', () => {
        switchScene('main');
    });

    return titleScene;
}


/** 
 * メインシーン
 * (Amain)
 */
function createMainScene() {
    // グローバル変数の初期化
    possibleNumbers = [];   // 01～99が入った要素
    inputArray = [];        // 二分木の要素
    randomIndex = -1;       // 問題
    // 問題系
    let minValue = 1;         // 値の下限
    let maxValue = 20;        // 値の上限
    let defaultTreeNum = 3;   // 二分木の初期表示数
    // インタフェース系
    let currentValue = 0;      // 値の初期値
    const intervalTime = 200    // ボタンの反応感覚(ms)
    let intervalId = null;      // 数字を加減するインターバル
    const text_y = 30;          // オフセット
    let seikai = false;         // 正解フラグ

    // レベルごとの出題設定
    level++;                    // 最初はレベル1から
    if (level === 1) {
        minValue = 1;           // 値の下限
        maxValue = 5;           // 値の上限
        defaultTreeNum = 3;     // 二分木の初期表示数
    } else if (level === 2) {
        minValue = 1;           // 値の下限
        maxValue = 7;           // 値の上限
        defaultTreeNum = 4;     // 二分木の初期表示数
    } else if (level === 3) {
        minValue = 1;           // 値の下限
        maxValue = 9;           // 値の上限
        defaultTreeNum = 5;     // 二分木の初期表示数
    } else if (level === 4) {
        minValue = 1;           // 値の下限
        maxValue = 12;           // 値の上限
        defaultTreeNum = 6;     // 二分木の初期表示数
    } else if (level === 5) {
        minValue = 1;           // 値の下限
        maxValue = 15;           // 値の上限
        defaultTreeNum = 7;     // 二分木の初期表示数
    }

    // レベルの回答数の初期化
    quizCount[level] = 0;

    // 上側テキストの初期表示
    text_u.text = `Ｑ:${level}/5　　値の範囲:${minValue}～${maxValue}　　総回答数:${answerCount}`;

    // メインシーン作成
    const mainScene = new PIXI.Container();

    // minValue〜maxValueまでの2桁の整数を全て配列に格納
    for (let i = minValue; i <= maxValue; i++) {
        possibleNumbers.push(i);
    }

    // ランダムに8個の異なる数字を選んでinputArrayに追加
    for (let i = 0; i < defaultTreeNum; i++) {
        randomIndex = Math.floor(Math.random() * possibleNumbers.length);
        let randomNumber = possibleNumbers.splice(randomIndex, 1)[0]; // 数字を選んで削除
        inputArray.push(randomNumber);
    }

    // inputArrayの中からランダムに一つ番号を選ぶ
    randomIndex = Math.floor(Math.random() * inputArray.length);

    // possibleNumbersに正解の値を戻す（選択肢として再利用するため）
    possibleNumbers.push(inputArray[randomIndex]);
    possibleNumbers.sort((a, b) => a - b);  // 昇順ソート
    currentValue = 0;

    // 二分木を作成
    const tree = new BinaryTree();
    inputArray.forEach((value) => tree.insert(value));

    // 二分木を視覚化
    const visualizer = new BinaryTreeVisualizer(app, mainScene, tree, inputArray[randomIndex]);
    visualizer.visualize(0, 50, seikai);
    //dtext.text = `${possibleNumbers[currentValue]}vs${inputArray[randomIndex]}@p${possibleNumbers}:i${inputArray}`;


    // 回答用インタフェース
    // 数字表示用テキスト
    const numberText = new PIXI.Text(possibleNumbers[currentValue], {
        fontSize: 36,
        fill: 0x000000
    });
    numberText.x = app.view.width / 2;
    numberText.y = app.view.height - text_y;
    numberText.anchor.set(0.5, 0.5);
    uiContainerD.addChild(numberText);

    // 数字を変更する関数
    const changeValue = (amount) => {
        currentValue += amount;
        if (currentValue < 0) {
            currentValue += possibleNumbers.length;
        } else if (currentValue >= possibleNumbers.length) {
            currentValue -= possibleNumbers.length;
        }
        numberText.text = possibleNumbers[currentValue];
        //dtext.text = `${possibleNumbers[currentValue]}vs${inputArray[randomIndex]}@p${possibleNumbers}:i${inputArray}`;
    };

    // ボタンを作成する関数
    const createButton = (x, y, color, shape, onClick) => {
        const button = new PIXI.Graphics();
        button.beginFill(color);
        if (shape === 'circle') {
            button.drawCircle(0, 0, 30);
        } else if (shape === 'triangleL') {
            // 左向きの三角形（マイナスボタン）
            button.moveTo(-60, 0);  // 右側の頂点
            button.lineTo(0, -30); // 左側の頂点
            button.lineTo(0, 30);    // 下側の頂点
        } else if (shape === 'triangleR') {
            // 右向きの三角形（プラスボタン）
            button.moveTo(60, 0);  // 左側の頂点
            button.lineTo(0, -30);   // 右側の頂点
            button.lineTo(0, 30);     // 下側の頂点
        } else if (shape === 'triangleRX') {
            // 右向きの大三角形（次の画面へ進む用）
            button.moveTo(75, 0);  // 左側の頂点
            button.lineTo(0, -30);   // 右側の頂点
            button.lineTo(0, 30);     // 下側の頂点
        }
        button.endFill();
        button.x = x;
        button.y = y;
        button.interactive = true;
        button.buttonMode = true;

        button.on('pointerdown', () => {
            // ボタンを押したときに色を変更
            button.tint = 0xAAAAAA;  // グレーに変更（押された状態）
            // 最初のクリックで即座に呼び出し
            onClick();
            if (shape != 'triangleRX') {
                // その後intervalTimeミリ秒ごとに繰り返し呼び出す
                clearInterval(intervalId);
                intervalId = setInterval(onClick, intervalTime);
            }
        });

        // ボタンを離したときに元の色に戻し、処理を停止
        const stopAction = () => {
            button.tint = 0xFFFFFF;  // 元の色（デフォルトの色）に戻す
            clearInterval(intervalId);
        };

        button.on('pointerup', stopAction);
        button.on('pointerout', stopAction);
        button.on('touchend', stopAction);
        button.on('touchcancel', stopAction);

        uiContainerD.addChild(button);
    };

    // -1 ボタン（三角形）
    createButton(numberText.x - 60, numberText.y, 0xFFCC66, 'triangleL', () => changeValue(-1));

    // +1 ボタン（三角形）
    createButton(numberText.x + 60, numberText.y, 0xFFCC66, 'triangleR', () => changeValue(1));


    // ボタン
    const myButton = new ButtonWithText(app.view.width / 2 - 50, app.view.height - text_y - 65, 100, 40, 0xFFCC66, '回答', 20, 0x000000);
    // ボタンがクリックされたときのアクションを設定
    myButton.setOnClick(() => {
        // 総回答数の更新
        answerCount += 1;
        quizCount[level] += 1;
        text_u.text = `Ｑ:${level}/5　　値の範囲:${minValue}～${maxValue}　　総回答数:${answerCount}`;

        // この中にボタンを押したときの動きを記述
        if (possibleNumbers[currentValue] === inputArray[randomIndex]) {
            uiContainerD.removeChildren();          // UI内容を削除
            uiContainerD.addChild(uiBackgroundC);
            uiContainerD.addChild(message_seikai);  // スコア表示テキストを画面に追加する
            seikai = true;
            visualizer.correct();

            // 次の画面へ
            createButton(numberText.x + 90, numberText.y - 5, 0xFFCC66, 'triangleRX', () => resetMainScene());
            const message_next = new TextFactory('next', 22, '0x000000');
            message_next.x = numberText.x + 90;
            message_next.y = numberText.y - 20;
            message_next.setBold(true);                         // 太字に変更
            message_next.setStroke('0xFFCC66', 4);              // 縁取りを追加（色、太さ）
            uiContainerD.addChild(message_next);

        } else {
            inputArray.push(possibleNumbers[currentValue]);
            tree.insert(possibleNumbers[currentValue]);
            visualizer.visualize(0, 50, seikai);
            possibleNumbers.splice(currentValue, 1);
            currentValue -= 1;
            if (currentValue < 0) {
                currentValue = 0;
            }
            numberText.text = possibleNumbers[currentValue];
        }
    });
    uiContainerD.addChild(myButton);

    // シーンを切り替えるための前処理
    function resetMainScene() {
        // 正解表示要素の削除
        uiContainerD.removeChildren();

        // 終了判定
        if (level < 5) {
            // 次のステージへ
            switchScene('main');
        } else {
            // ゲームクリア
            switchScene('clear');
        }
    }

    // 繰り返す処理
    //app.ticker.add((delta) => { //delta:現在のフレームが前回のフレームから何秒経過したかを示す値
    // 繰り返す処理

    //});

    return mainScene;

}


// クリアシーン
function createClearScene() {
    // ローカル変数宣言

    // クリアシーン作成
    const clearScene = new PIXI.Container();

    // だいまおうさま
    const mao = new PIXI.Sprite(daimaoImage);
    mao.anchor.set(0.5); // 画像の中心を基準に回転させる
    mao.scale.x = 4;
    mao.scale.y = 4;
    mao.x = app.screen.width / 2;         // 初期位置x
    mao.y = 255;        // 初期位置y
    mao.alpha = 0.3;      // 透明度
    clearScene.addChild(mao);

    // 背景（答案用紙風のデザイン）
    const graphics = new PIXI.Graphics();
    graphics.lineStyle(2, 0x000000, 1);
    graphics.drawRect(20, 80, 320, 400); // 用紙の枠

    // 答案用紙の横線（罫線風）
    for (let i = 0; i < 6; i++) {
        graphics.moveTo(20, 130 + i * 60);
        graphics.lineTo(340, 130 + i * 60);
    }
    clearScene.addChild(graphics);

    // スコア表示（右上に赤字の100）
    const scoreText = new PIXI.Text('100', {
        fontSize: 64,
        fill: 0xff0000,
        fontWeight: 'bold'
    });
    scoreText.x = 240;
    scoreText.y = 0;
    clearScene.addChild(scoreText);

    // 100の下に赤線を2本描画
    const redLine = new PIXI.Graphics();
    redLine.lineStyle(4, 0xff0000, 1); // 太さ4pxの赤線
    redLine.moveTo(252, 66);  // 1本目の線
    redLine.lineTo(340, 66);
    redLine.moveTo(252, 74); // 2本目の線
    redLine.lineTo(340, 74);
    clearScene.addChild(redLine);

    // タイトル（リザルト）
    const titleText = new PIXI.Text('クイズ結果', {
        fontSize: 28,
        fill: 0x000000
    });
    titleText.x = 30;
    titleText.y = 40;
    clearScene.addChild(titleText);

    // タイトル（リザルト）
    const nibungiText = new PIXI.Text(`総回答数: ${answerCount} 回`, {
        fontSize: 24,
        fill: 0x000000
    });
    nibungiText.x = 40;
    nibungiText.y = 90;
    clearScene.addChild(nibungiText);

    // クイズの結果データ（仮のデータ）
    const results = [1, 2, 3, 4, 5];  // 各問題の回答回数

    // 評価リスト
    const evaluations = [
        "パーフェクト！",   // 1回
        "素晴らしい！",       // 2回
        "名推理！",         // 3回
        "お見事！",         // 4回
        "いい感じ！",       // 5回
        "グッド！",         // 6回
        "ナイス！",         // 7回
        "いいね！",         // 8回
        "ヨシ！",           // 9回
        ""                  // 10回以上
    ];

    // 各問題の表示
    for (let i = 0; i < results.length; i++) {
        const attempts = results[i];
        const evaluation = evaluations[Math.min(quizCount[i + 1], evaluations.length - 1) - 1];

        // 回答数の表示
        const questionText = new PIXI.Text(`Q${i + 1}: ${quizCount[i + 1]} 回`, {
            fontSize: 24,
            fill: 0x000000
        });
        questionText.x = 40;
        questionText.y = 140 + i * 60;
        app.stage.addChild(questionText);

        // 評価の表示（赤字）
        const evaluationText = new PIXI.Text(evaluation, {
            fontSize: 22,
            fill: 0xff0000
        });
        evaluationText.x = 160;
        evaluationText.y = 140 + i * 60;
        clearScene.addChild(evaluationText);
    }

    let summary = "";
    if (answerCount <= 5) {
        summary = "完全制覇！ありがとう！";
    } else if (answerCount <= 8) {
        summary = "超高性能！すごすぎる！";
    } else if (answerCount <= 10) {
        summary = "爆優秀賞！おめでとう！";
    } else if (answerCount <= 13) {
        summary = "大明察！さえわたる！";
    } else if (answerCount <= 15) {
        summary = "名探偵！おみごと！";
    } else if (answerCount <= 18) {
        summary = "慧眼！みとおしてる！";
    } else if (answerCount <= 21) {
        summary = "洞察力！あっぱれ！";
    } else {
        summary = "ありがとう、また遊んでね！";
    }
    // 評価の表示（赤字）
    const TextSummary = new PIXI.Text(summary, {
        fontSize: 22,
        fill: 0xff0000
    });
    TextSummary.x = 40;
    TextSummary.y = 140 + 5 * 60;
    clearScene.addChild(TextSummary);

    // タイトルに戻るボタン
    let Button_title = new ButtonWithText(app.view.width / 2 - 120, app.view.height - 55, 240, 40, 0xFFCC66, 'タイトルにもどる', 24, 0x000000);

    // ボタンがクリックされたときのアクションを設定
    Button_title.setOnClick(() => {
        switchScene('title');
    });

    // ボタンをステージに追加
    clearScene.addChild(Button_title);
    return clearScene;
}

// シーン遷移
function switchScene(scene) {
    // すべてのシーンを削除
    app.stage.removeChildren(); // すべての小要素削除
    app.ticker.remove();        // 名無しのコールバック関数削除できていると信じたい
    // シーンの遷移
    if (scene === 'title') {
        currentScene = createTitleScene();
        app.stage.addChild(currentScene);
    } else if (scene === 'main') {
        startFlg = true;
        // UIの表示
        app.stage.addChild(uiContainer);
        app.stage.addChild(uiContainerD);
        currentScene = createMainScene();
        app.stage.addChild(currentScene);
    } else if (scene === 'boss') {
        startFlg = true;
        currentScene = createBossScene();
        app.stage.addChild(currentScene);
        // UIの表示
        app.stage.addChild(uiContainer);
    } else if (scene === 'clear') {
        currentScene = createClearScene();
        app.stage.addChild(currentScene);
    }
}
