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
//app.renderer.backgroundColor = 0x9999cc;        // 背景色の設定
app.renderer.backgroundColor = 0x4d4d66;        // 背景色の設定
//app.renderer.view.style.border = "2px dashed black";  // canvasを点線枠で囲う（確認用）

/** 
 * ゲーム全体で使用する変数の定義
 * (AallVar)
 */
let currentScene;               // 現在のシーン
let level = 0;                  // ゲームのレベル
let startTime = Date.now();     // ゲーム開始時間
let timeTaken = 0;              // クリアまでの時間
let isResetting = false;        // シーンリセット中かどうかのフラグ
let totalScore = 0;             // 総スコア
let gamemode = -1;              // 0：通常、1：エンドレス

// グローバルな変数でリソースを保持
let sprite;
let backgroundImage, pendulumImage, spriteImage, planetImage, daimaoImage, yogoreImage, hanseiImage, vibImage;
let background, pendulum, spritesB = [];
let totalSpritesB = 0;
let startFlg = false;           // ゲーム開始フラグ、動き始めるきっかけ
let isButtonDisabled = true;    // 回転ボタンを使えるか：デフォルトは使えない
let timeElapsed = 0;            // 経過時間（秒）
// 主人公系
const textureArray = [];        // 主人公アニメーション用配列
const totalFrames = 4;          // 主人公フレーム数
const frameWidth = 26;          // 1フレームあたりの横幅
const frameHeight = 37;         // 1フレームあたりの縦幅
let currentFrame = 0;           // 現在フレーム番号
const frameDelay = 200;         // フレーム切り替えの間隔（ミリ秒）
// まおうさま系
const textureArrayMao = [];     // まおうさまアニメーション用配列
const totalFramesMao = 2;       // まおうさまフレーム数
const frameWidthMao = 64;       // 1フレームあたりの横幅
const frameHeightMao = 64;      // 1フレームあたりの縦幅
let currentFrameMao = 0;        // 現在フレーム番号
const frameDelayMao = 200;      // フレーム切り替えの間隔（ミリ秒）

let maodamage = 0;              // まおうさまに与えたダメージ数

let debugx = -1;
let debugy = -1;
let debugr = -1;

// トリビア
let text_omake = [];     // 操作説明その他

// UI用のコンテナ（スコア表示やボタンなど）
let uiContainer = new PIXI.Container();
// テキストに関するパラメータ定義
const textStyle = new PIXI.TextStyle({
    fontFamily: "Arial",    // フォント
    fontSize: 16,           // フォントサイズ
    fill: 0xffffff,         // 色
    stroke: '#000000',      // 枠線
    strokeThickness: 2,     // 枠線の太さ
});

//デバッグ用テキスト
const dtext = new PIXI.Text("", textStyle); //デバッグ用テキスト
uiContainer.addChild(dtext); // スコア表示テキストを画面に追加する
dtext.x = 0;
dtext.y = app.screen.height - 32;

// 固定文言表示用
const textStyleKotei = new PIXI.TextStyle({
    fontFamily: "Arial", // フォント
    fontSize: 20,// フォントサイズ
    fill: 0x000000, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
    //fontWeight: 'bold',
    stroke: '#ffffff',
    strokeThickness: 4,
    dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
    dropShadowBlur: 1,
    dropShadowDistance: 2, // ドロップシャドウの影の距離
});

// 固定文言表示用テキスト1
const text_kotei1 = new PIXI.Text(`TOTAL:`, textStyleKotei); // 結果画面のテキスト
text_kotei1.x = 0; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
text_kotei1.y = 0; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
uiContainer.addChild(text_kotei1); // 結果画面シーンにテキスト追加

// 固定文言表示用テキスト2
const text_kotei2 = new PIXI.Text(`REST:`, textStyleKotei); // 結果画面のテキスト
text_kotei2.x = 32 * 7 - 4; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
text_kotei2.y = 0; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
uiContainer.addChild(text_kotei2); // 結果画面シーンにテキスト追加


// 総スコア表示用テキスト
const text_totalScore = new PIXI.Text(`${totalScore}`, textStyleKotei); // 結果画面のテキスト
text_totalScore.x = 32 * 2 + 8; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
text_totalScore.y = 32 * 0; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
uiContainer.addChild(text_totalScore); // 結果画面シーンにテキスト追加

//残り汚れ表示用
const textStyleYogore = new PIXI.TextStyle({
    fontFamily: "Arial", // フォント
    fontSize: 40,// フォントサイズ
    fill: 0x000000, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
    fontWeight: 'bold',
    stroke: '#ffffff',
    strokeThickness: 4,
    dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
    dropShadowBlur: 1,
    dropShadowDistance: 2, // ドロップシャドウの影の距離
});

//残り汚れ表示用テキスト
const text_result = new PIXI.Text(`500`, textStyleYogore); // 結果画面のテキスト
//text_result.anchor.x = 0.5; // アンカーのxを中央に指定
text_result.x = app.screen.width - 80; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
text_result.y = 32 * 0; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
uiContainer.addChild(text_result); // 結果画面シーンにテキスト追加

// リソースの事前読み込み
PIXI.loader
    .add('daimao', 'daimao.png')    // だいまおうさま
    .add('daimao2', 'daimao2.png')  // だいまおうさまアニメ用
    .add('yogore', 'yogore.png')    // 汚れ
    .add('world', 'world2.png')      // 背景
    .add('sheep', 'sheep.png')      // 主人公アニメ用
    .add('earth', 'earth.png')      // わくせい
    .add('hansei', 'hansei.png')    // だいまおうさま反省用
    .add('vib', 'mofu.png')        // 振動くん
    /** ロード状況の確認用
    .on('progress', (loader, resource) => {
        console.log(`ロード中: ${resource.name} - ${loader.progress}%`);
    })
    */
    .load(onAssetsLoaded);          // ロード後に実行される処理

// ロード後に実行される処理
function onAssetsLoaded(loader, resources) {
    // スプライトシートのロード
    // 1フレームずつ読み込んでtextureArrayに格納する
    for (let i = 0; i < totalFrames; i++) {
        textureArray.push(new PIXI.Texture(PIXI.Texture.from('sheep').baseTexture, new PIXI.Rectangle(i * frameWidth, 0, frameWidth, frameHeight)));
    }
    // まおうさまも読み込む
    for (let i = 0; i < totalFramesMao; i++) {
        textureArrayMao.push(new PIXI.Texture(PIXI.Texture.from('daimao2').baseTexture, new PIXI.Rectangle(i * frameWidthMao, 0, frameWidthMao, frameHeightMao)));
    }

    // 画像リソースをグローバルに保存
    backgroundImage = resources.world.texture;
    daimaoImage = resources.daimao.texture;
    yogoreImage = resources.yogore.texture;
    planetImage = resources.earth.texture;
    hanseiImage = resources.hansei.texture;
    vibImage = resources.vib.texture;

    switchScene('title');  // 読み込み完了後にタイトルシーンに遷移
}

// 引数のシーンを削除する関数
function removeScene(scene) {
    if (scene) {
        app.stage.removeChild(scene);
    }
}

//影付きボタンのクラス
class ButtonWithText extends PIXI.Container {
    constructor(x, y, width, height, color, text, fontSize = 24, textColor = 0xFFFFFF) {
        super();

        // ボタンの影
        this.shadow = new PIXI.Graphics();
        this.shadow.beginFill(this._darkenColor(color));  // 色を暗くした色を影として使用
        this.shadow.drawRect(0, 0, width, height);
        this.shadow.endFill();
        this.shadow.position.set(0, 4);  // 影をボタンの下にずらす

        // ボタンの背景となる四角形
        this.button = new PIXI.Graphics();
        this.button.beginFill(color);
        this.button.drawRect(0, 0, width, height);
        this.button.endFill();

        // ボタンの位置を設定
        this.position.set(x, y);

        // テキストを作成
        this.text = new PIXI.Text(text, {
            fontFamily: 'Arial',
            fontSize: fontSize,
            fill: textColor,  // テキストの色を引数で指定
            align: 'center'
        });

        // テキストをボタンの中央に配置
        this.text.anchor.set(0.5, 0.5);
        this.text.position.set(width / 2, height / 2);

        // ボタンとテキストをコンテナに追加
        this.addChild(this.shadow);  // 影を最初に追加
        this.addChild(this.button);  // ボタンをその上に追加
        this.addChild(this.text);    // テキストを一番上に追加

        // ボタンがクリックされたときの動き（初期状態では設定しない）
        this.onClick = null;

        // ボタンが押されたときの動き
        this._isPressed = false;

        // ボタンが押されたときのイベントリスナー
        this.button.interactive = true;
        this.button.buttonMode = true;
        this.button.on('pointerdown', () => {
            if (!this._isPressed) {
                this._isPressed = true;
                this._pressButton();
                if (this.onClick) {
                    // ボタンを押したアニメーションを見せるため、_pressButtonの0.3秒後にonClickを実行
                    setTimeout(() => {
                        // 追加のクリック動作を実行
                        this.onClick();
                    }, 300);  // 300ミリ秒 (0.3秒)
                }
            }
        });

        // ボタンが離されたときの動き
        this.button.on('pointerup', () => {
            if (this._isPressed) {
                this._isPressed = false;
                this._releaseButton();
            }
        });

        // ボタンが外れても元に戻る
        this.button.on('pointerout', () => {
            if (this._isPressed) {
                this._isPressed = false;
                this._releaseButton();
            }
        });
    }

    // ボタンを押したときのアニメーション（3px下がる動き）
    _pressButton() {
        // ボタンの位置を3px下げる
        this.button.position.y += 3;    // ボタン
        //this.shadow.position.y += 3;    // 影も合わせて動かす
        this.text.position.y += 3;       // テキスト
    }

    // ボタンが離されたときのアニメーション（元の位置に戻る）
    _releaseButton() {
        // ボタンの位置を元に戻す
        this.button.position.y -= 3;    // ボタン
        //this.shadow.position.y -= 3;  // 影も合わせて戻す
        this.text.position.y -= 3;       // テキスト
    }

    // 色を暗くするためのヘルパー関数
    _darkenColor(color) {
        let hex = color; // 色は0x形式の整数で取得

        let r = Math.max(((hex >> 16) & 0xFF) - 20, 0);
        let g = Math.max(((hex >> 8) & 0xFF) - 20, 0);
        let b = Math.max((hex & 0xFF) - 20, 0);

        return (r << 16) | (g << 8) | b;  // 0xRRGGBBの形式に戻す
    }

    // ボタンが押されたときのアクションを外部から設定
    setOnClick(callback) {
        this.onClick = callback;
    }
}

/**
 * // テキストクラス
 * const myText = new TextFactory('テキストを追加', 36, '#ffffff');  // 初期のテキスト
 * // 装飾の変更
 * myText.setBold(true);                    　　// 太字に変更
 * myText.setItalic(true);                      // 斜体に変更
 * myText.setUnderline(true);                   // 下線を追加
 * myText.setStroke('#ffffff', 4);              // 縁取りを追加（色、太さ）
 * myText.setFontFamily('Verdana');             // フォントを変更
 * myText.setColor('#ff0000');                  // 色を変更
 * myText.setShadow(true, '#000000', 5, 10);    // 影を追加（有効/無効、影の色、ぼかし、距離）
 * myText.setWordWrap(300);                     // 指定幅で改行
 * myText.setLineHeight(36*1.5);                // 行間を変更
 * 
 */
class TextFactory extends PIXI.Text {
    constructor(textString, fontSize, color) {
        const style = new PIXI.TextStyle({
            fontSize: fontSize,
            fill: color,  // 文字色
            fontFamily: 'Arial',  // フォントファミリー
        });

        super(textString, style); // PIXI.Text の親クラスを呼び出し、テキストを作成
    }

    // 文字を太字にするメソッド
    setBold(isBold) {
        this.style.fontWeight = isBold ? 'bold' : 'normal';
    }

    // 文字を斜体にするメソッド
    setItalic(isItalic) {
        this.style.fontStyle = isItalic ? 'italic' : 'normal';
    }

    // 文字に下線を追加するメソッド
    setUnderline(isUnderlined) {
        this.style.decoration = isUnderlined ? 'underline' : 'none';
    }

    // 文字に縁取りを追加するメソッド
    setStroke(strokeColor, thickness) {
        this.style.stroke = strokeColor;
        this.style.strokeThickness = thickness;
    }

    // 文字のフォントファミリーを変更するメソッド
    setFontFamily(fontFamily) {
        this.style.fontFamily = fontFamily;
    }

    // 文字の色を変更するメソッド
    setColor(color) {
        this.style.fill = color;
    }

    // 影を追加するメソッド
    setShadow(isShadow, color = '#000000', blur = 0, distance = 5) {
        this.style.dropShadow = isShadow;  // 影を有効/無効にする
        this.style.dropShadowColor = color; // 影の色
        this.style.dropShadowBlur = blur;   // 影のぼかし具合
        this.style.dropShadowDistance = distance; // 影の距離
    }

    // 自動改行の設定を変更するメソッド
    setWordWrap(maxWidth) {
        this.style.wordWrap = true;           // 自動改行を有効にする
        this.style.wordWrapWidth = maxWidth;  // 最大幅を設定
    }

    // 行間を変更するメソッド
    setLineHeight(lineHeight) {
        this.style.lineHeight = lineHeight;   // 行間を設定
    }
}

// ステージクリアのメッセージ
const mes_clear = new TextFactory('お掃除大成功！', 32, '0xffffff');     // これだけでテキストを作成
mes_clear.setBold(true);                       // 太字に変更
mes_clear.setShadow(true, '#000000', 4, 4);    // 影を追加（黒、ぼかし5、距離10）
uiContainer.addChild(mes_clear);
mes_clear.x = 80;            // X座標
mes_clear.y = -180;             // Y座標

let value = 0;
// 点滅させるための変数
let fadingOut = false;

// 点滅させておく
setInterval(() => {
    if (fadingOut) {
        if (mes_clear.alpha > 0.6) {
            mes_clear.alpha -= 0.04; // 透明度を減らす（フェードアウト）
        } else {
            mes_clear.alpha -= 0.25; // 透明度を減らす（フェードアウト）
        }
        if (mes_clear.alpha <= 0) {
            fadingOut = false; // 完全に透明になったらフェードインに切り替え
        }
    } else {
        if (mes_clear.alpha > 0.6) {
            mes_clear.alpha += 0.04; // 透明度を減らす（フェードアウト）
        } else {
            mes_clear.alpha += 0.25; // 透明度を増やす（フェードイン）
        }
        if (mes_clear.alpha >= 1) {
            fadingOut = true; // 完全に不透明になったらフェードアウトに切り替え
        }
    }
}, 50); // 50msごとに透明度を更新


/** 
 * タイトルシーン
 * (Atitle)
 */
function createTitleScene() {
    mes_clear.y = -180;
    level = 0;         // 初期化(main遷移時に+1)
    gamemode = -1;     // 初期化(ボタン押下時に再設定)

    // タイトルシーン作成
    const titleScene = new PIXI.Container();

    // 背景
    const background = new PIXI.Sprite(backgroundImage);
    background.x = 0;               // x座標
    background.y = 0;               // y座標
    background.scale.x = 4;         // x方向の拡大率
    background.scale.y = 4;         // y方向の拡大率
    background.alpha = 0.5;         // 透明度
    titleScene.addChild(background); // ボールをシーンに追加

    // わくせい
    const hoshi = new PIXI.Sprite(planetImage);
    hoshi.anchor.set(0.5); // 画像の中心を基準に回転させる
    hoshi.scale.x = 9;
    hoshi.scale.y = 9;
    hoshi.x = 270;         // 初期位置x
    hoshi.y = 350;         // 初期位置y
    hoshi.alpha = 0.6;     // 透明度
    titleScene.addChild(hoshi);

    // だいまおうさま
    const mao = new PIXI.Sprite(daimaoImage);
    mao.anchor.set(0.5); // 画像の中心を基準に回転させる
    mao.scale.x = 2;
    mao.scale.y = 2;
    mao.x = 78;         // 初期位置x
    mao.y = 148;        // 初期位置y
    mao.alpha = 1;      // 透明度
    titleScene.addChild(mao);

    // だいまおうさま紹介用背景
    const mekakushi = new PIXI.Graphics(); // グラフィックオブジェクト（背景に半透明な四角を配置するために使用）
    mekakushi.beginFill("#000000", 0.8); // 色、透明度を指定して描画開始
    mekakushi.drawRect(0, 0, 134, 18); // 位置(0,0)を左上にして、width,heghtの四角形を描画
    mekakushi.pivot.x = 55;      // 回転の中心を四角形の中心に設定
    mekakushi.pivot.y = 5;      // 回転の中心を四角形の中心に設定
    mekakushi.endFill(); // 描画完了
    mekakushi.interactive = true; // クリック可能にする
    titleScene.addChild(mekakushi); // ボタンを結果画面シーンに追加
    mekakushi.x = 72; // ボタンの座標指定
    mekakushi.y = 114; // ボタンの座標指定

    // だいまおうさまの紹介
    const maoword = new TextFactory('大魔王フリカケールさま', 12, '0xffffff');     // これだけでテキストを作成
    maoword.setBold(true);                       // 太字に変更
    maoword.setShadow(true, '#000000', 1, 1);    // 影を追加（黒、ぼかし5、距離10）
    titleScene.addChild(maoword);
    maoword.setLineHeight(12 * 1.5);   // 行間を設定
    maoword.x = 18;            // X座標
    maoword.y = 110;             // Y座標


    // コショウ
    const yogoreArray = [];  // コショウ配列
    const yogoreVolume = 40; // コショウの数
    let yogorenum = 0;

    // コショウ定義
    for (let i = 0; i < yogoreVolume; i++) {
        const yogore = new PIXI.Sprite(yogoreImage);
        yogore.anchor.set(0.5);     // 画像の中心を基準に回転させる
        yogore.scale.x = 1;
        yogore.scale.y = 1;
        yogore.x = 24;             // 初期位置x
        yogore.y = app.view.height * Math.random() + 140;              // 初期位置y
        yogore.interactive = true;
        yogoreArray.push(yogore);   //配列に障害物を追加
        titleScene.addChild(yogore);
        yogorenum += 1;
    }


    // テキストを見やすくするための黒四角
    const haikei_black = new PIXI.Graphics(); // グラフィックオブジェクト（背景に半透明な四角を配置するために使用）
    haikei_black.beginFill("#000000", 0.8); // 色、透明度を指定して描画開始
    haikei_black.drawRect(0, 0, 335, 190); // 位置(0,0)を左上にして、width,heghtの四角形を描画
    haikei_black.endFill(); // 描画完了
    titleScene.addChild(haikei_black); // ボタンを結果画面シーンに追加
    haikei_black.x = 12; // ボタンの座標指定
    haikei_black.y = 152; // ボタンの座標指定
    haikei_black.alpha = 0.5



    // あらすじ
    const myText = new TextFactory('～あらすじ～\n\
大魔王フリカケールが世界中に\n\
コショウを振りかけてしまった！\n\n\
美化委員フーくんと一緒に、\n\
コショウを吹き飛ばそう！\n\n', 18, '0xffffff');  // これだけでテキストを作成
    myText.setBold(true);                       // 太字に変更
    myText.setShadow(true, '#000000', 4, 2);    // 影を追加（黒、ぼかし5、距離10）
    myText.setLineHeight(24);                   // 行間を設定
    titleScene.addChild(myText);
    myText.x = 16; // X座標
    myText.y = 160; // Y座標

    // 主人公スプライトを作成
    const sheep = PIXI.Sprite.from(textureArray[0]); // 任意の画像URLに変更
    sheep.anchor.set(0.5); // 画像の中心を基準に回転させる
    sheep.scale.x = 2;
    sheep.scale.y = 2;
    sheep.x = app.screen.width / 2 + 100 // x座標
    sheep.y = 280; // y座標
    titleScene.addChild(sheep);
    // アニメーション（時間で更新）
    currentFrame = 0;   // 現在フレーム番号
    /** 
    // 指定した間隔でアニメーション
    setInterval(() => {
        currentFrame = (currentFrame + 1) % totalFrames;    // 次のフレーム番号を設定（最大フレームを超えないように調整）
        sheep.texture = textureArray[currentFrame];      // スプライトに表示するフレーム番号を変更
    }, frameDelay);
    */

    // フーくんの紹介背景
    const haikei_sheep = new PIXI.Graphics(); // グラフィックオブジェクト（背景に半透明な四角を配置するために使用）
    haikei_sheep.beginFill("#000000", 0.8); // 色、透明度を指定して描画開始
    haikei_sheep.drawRect(0, 0, 105, 18); // 位置(0,0)を左上にして、width,heghtの四角形を描画
    haikei_sheep.pivot.x = 55;      // 回転の中心を四角形の中心に設定
    haikei_sheep.pivot.y = 5;      // 回転の中心を四角形の中心に設定
    haikei_sheep.endFill(); // 描画完了
    titleScene.addChild(haikei_sheep); // ボタンを結果画面シーンに追加
    haikei_sheep.x = 280; // ボタンの座標指定
    haikei_sheep.y = 320; // ボタンの座標指定

    // フーくんの紹介
    const word_sheep = new TextFactory('美化委員フーくん', 12, '0xffffff');     // これだけでテキストを作成
    word_sheep.setBold(true);                       // 太字に変更
    word_sheep.setShadow(true, '#000000', 1, 1);    // 影を追加（黒、ぼかし5、距離10）
    titleScene.addChild(word_sheep);
    word_sheep.setLineHeight(12 * 1.5);   // 行間を設定
    word_sheep.x = 230;            // X座標
    word_sheep.y = 316;             // Y座標


    // 操作説明用四角背景
    const bgrect = new PIXI.Graphics();
    bgrect.lineStyle(2, 0x66CCFF, 1); // 枠線の太さ、色、不透明度
    bgrect.beginFill(0x000000, 0.8);     // 塗りつぶしの色と不透明度
    bgrect.drawRect(0, 0, 335, 105); // (x, y, 幅, 高さ)
    bgrect.endFill();  // 塗りつぶし終了
    titleScene.addChild(bgrect);
    bgrect.x = 12; // ボタンの座標指定
    bgrect.y = 355; // ボタンの座標指定
    bgrect.alpha = 0.5

    const text_manual = new TextFactory('Ａ．４つのエリアをお掃除して\n\
　　大魔王を懲らしめよう！', 18, '0xffffff');  // これだけでテキストを作成
    //text_manual.setBold(true);                       // 太字に変更
    text_manual.setShadow(true, '#000000', 4, 2);    // 影を追加（黒、ぼかし5、距離10）
    text_manual.setLineHeight(24);                   // 行間を設定
    titleScene.addChild(text_manual);
    text_manual.x = 16; // X座標
    text_manual.y = 360; // Y座標

    // ボタンを作成
    let Button_boss = new ButtonWithText(app.view.width / 2 - 100, app.view.height - 138, 200, 40, 0x3498db, 'お掃除開始！', 24, 0xFFFFFF);

    // ボタンがクリックされたときのアクションを設定
    Button_boss.setOnClick(() => {
        gamemode = 0;   // 通常モード
        switchScene('main');
        // 他にもアクションを追加することができる
        // 例えば、ボタンを押した時に画面を切り替える等
    });

    // ボタンをステージに追加
    titleScene.addChild(Button_boss);

    // 操作説明用四角背景
    const bgrect2 = new PIXI.Graphics();
    bgrect2.lineStyle(2, 0x9966FF, 1); // 枠線の太さ、色、不透明度
    bgrect2.beginFill(0x000000, 0.8);     // 塗りつぶしの色と不透明度
    bgrect2.drawRect(0, 0, 335, 70); // (x, y, 幅, 高さ)
    bgrect2.endFill();  // 塗りつぶし終了
    titleScene.addChild(bgrect2);
    bgrect2.x = 12; // ボタンの座標指定
    bgrect2.y = 465; // ボタンの座標指定
    bgrect2.alpha = 0.5

    const text_manual2 = new TextFactory('Ｂ．大魔王が反省しないから無限に遊べる！', 16, '0xffffff');  // これだけでテキストを作成
    //text_manual.setBold(true);                       // 太字に変更
    text_manual2.setShadow(true, '#000000', 4, 2);    // 影を追加（黒、ぼかし5、距離10）
    text_manual2.setLineHeight(24);                   // 行間を設定
    titleScene.addChild(text_manual2);
    text_manual2.x = 16; // X座標
    text_manual2.y = 470; // Y座標


    // ボタンを作成
    let myButton = new ButtonWithText(app.view.width / 2 - 90, app.view.height - 55, 180, 30, 0x9834db, '無限お掃除', 22, 0xFFFFFF);

    // ボタンがクリックされたときのアクションを設定
    myButton.setOnClick(() => {
        gamemode = 1;   // エンドレスモード
        switchScene('main');
        // 他にもアクションを追加することができる
        // 例えば、ボタンを押した時に画面を切り替える等
    });

    // ボタンをステージに追加
    titleScene.addChild(myButton);


    // タイトル
    // テキストのスタイル設定
    const style = new PIXI.TextStyle({
        fontFamily: 'Arial',   // フォントをArialに設定（他のフォントも使えます）
        fontSize: 40,         // フォントサイズを大きめに設定
        fontWeight: 'bold',   // 太字に設定
        fill: ['#00BFFF', '#8A2BE2'],  // 宇宙をイメージした青と紫のグラデーション
        stroke: '#FFFFFF',    // 文字の縁取りを白
        strokeThickness: 6,   // 縁取りの太さ
        dropShadow: true,     // ドロップシャドウを有効に
        dropShadowColor: '#000000',  // ドロップシャドウの色（ダークブラウン）
        dropShadowBlur: 6,    // ドロップシャドウのぼかし
        dropShadowDistance: 4,  // ドロップシャドウの距離
    });

    // 「フーフーコショー」テキストを作成
    const titleText = new PIXI.Text('フーフーコショー', style);

    // テキストを中央に配置
    titleText.x = app.screen.width / 2 - titleText.width / 2;
    titleText.y = 14;
    titleScene.addChild(titleText);

    // 直線を上下に描画
    const lineHeight = 2;  // 直線の太さ

    // 上の直線
    const topLine = new PIXI.Graphics();
    topLine.lineStyle(lineHeight, 0xFFFFFF, 1);  // 白い線
    topLine.moveTo(app.screen.width / 2 - titleText.width / 2 - 5, titleText.y - 1);  // 左端の位置
    topLine.lineTo(app.screen.width / 2 + titleText.width / 2 + 5, titleText.y - 1);  // 右端の位置
    titleScene.addChild(topLine);

    // 下の直線
    const bottomLine = new PIXI.Graphics();
    bottomLine.lineStyle(lineHeight, 0xFFFFFF, 1);  // 白い線
    bottomLine.moveTo(app.screen.width / 2 - titleText.width / 2 - 5, titleText.y + titleText.height - 2);  // 左端の位置
    bottomLine.lineTo(app.screen.width / 2 + titleText.width / 2 + 5, titleText.y + titleText.height - 2);  // 右端の位置
    titleScene.addChild(bottomLine);

    // ループ処理
    // だいまおうさま回転用
    const speed = 0.005;
    let angle = speed;
    let threshold = 0.3;
    // 主人公動き用
    const timing = 15;
    let timer = 0;

    // アニメーションループ
    app.ticker.add(() => {
        // だいまおうさまの回転
        if (mao.rotation > threshold) {
            angle = -1 * speed;
        } else if (mao.rotation < -1 * threshold) {
            angle = speed;
        }
        mao.rotation += angle;

        // 主人公動き
        timer += 1;
        if (Math.floor(timer / timing) === 0) {
            sheep.texture = textureArray[0];      // スプライトに表示するフレーム番号を変更
        } else if (Math.floor(timer / timing) === 1) {
            sheep.texture = textureArray[1];      // スプライトに表示するフレーム番号を変更
        } else if (Math.floor(timer / timing) === 2) {
            sheep.texture = textureArray[2];      // スプライトに表示するフレーム番号を変更
        } else if (Math.floor(timer / timing) === 3) {
            sheep.texture = textureArray[3];      // スプライトに表示するフレーム番号を変更
        } else {
            timer = 0;
        }



        // コショウがふりかかる
        yogoreArray.forEach((yogore) => {
            yogore.moveDirection = {
                x: Math.random() * 1.4 - 0.5,           // x方向にランダムな移動方向：0.5未満なら1、0.5以上なら-1
                y: Math.random() < 0.5 ? 0.6 : -0.6,    // y方向にランダムな移動方向：0.5未満なら1、0.5以上なら-1
                r: Math.random() < 0.5 ? 1 : -1,        // y方向にランダムな移動方向：0.5未満なら1、0.5以上なら-1
                g: Math.random() < 0.5 ? 1.5 : 1.5
            };

            yogore.moveDirection.g += 0.2;
            yogore.x += yogore.moveDirection.x * 10; // x方向に移動
            yogore.y += (yogore.moveDirection.y * 1 + yogore.moveDirection.g); // y方向に移動
            yogore.rotation += yogore.moveDirection.r;

            // 画面外に出たらスプライトを消す
            if (yogore.x < -50 || yogore.x > app.screen.width + 50 || yogore.y < -50 || yogore.y > app.screen.height + 50) {
                yogore.x = 22;             // 初期位置x
                yogore.y = 146;              // 初期位置y
            }
        })


    });

    return titleScene;
}


/** 
 * メインシーン
 * (Amain)
 */
function createMainScene() {
    level += 1;
    text_kotei2.text = `REST:`;

    let text_default = ``;
    let text_rinji = ``;

    // タイトルシーン作成
    const mainScene = new PIXI.Container();
    //app.stage.addChild(mainScene);

    levelStartTime = Date.now();  // レベル開始時間

    // 背景
    const background = new PIXI.Sprite(backgroundImage); //引数には、プリロードしたURLを追加する
    background.x = 0; // x座標
    background.y = 0; // y座標
    background.scale.x = 4;   //x方向に2倍の大きさ
    background.scale.y = 4;   //y方向に2倍の大きさ
    background.alpha = 0.5;
    mainScene.addChild(background); // ボールをシーンに追加

    // 汚れ用スプライト
    const yogoreArray = [];
    const gridSizeRow = 24; //縦横に何個ずつ配置するか
    const gridSizeColumn = 21; //縦横に何個ずつ配置するか
    const yogoresize = 16; //スプライトの間隔（サイズ）
    let yogorenum = 0;

    yogoreCreate();

    function yogoreCreate() {
        for (let i = 0; i < gridSizeColumn; i++) {
            for (let j = 0; j < gridSizeRow; j++) {
                if (j === 0 && (i >= 9 && i <= 12)) { continue; }
                const yogore = new PIXI.Sprite(yogoreImage);
                yogore.anchor.set(0.5); // 画像の中心を基準に回転させる
                yogore.scale.x = 1;
                yogore.scale.y = 1;
                yogore.x = 16 + i * yogoresize; // 初期位置x
                yogore.y = 96 + j * yogoresize; // 初期位置y
                yogore.interactive = true;
                yogore.buttonMode = true;
                yogore.isMovingOut = false; // 移動中かどうかのフラグ
                yogoreArray.push(yogore); //配列に障害物を追加
                mainScene.addChild(yogore);
                yogorenum += 1;
            }
        }
    }


    // 振り子を示す直線を描画するためのGraphicsオブジェクト
    const line = new PIXI.Graphics();
    line.lineStyle(2, 0x000000, 1); // 白い線を描く
    line.moveTo(0, 0); // 直線の始点（画面の中央）
    line.lineTo(0, 0); // 直線の終点（スプライトの位置）
    mainScene.addChild(line);

    // 主人公スプライトを作成
    //const sprite = PIXI.Sprite.from(textureArray[0]); // 任意の画像URLに変更
    sprite = PIXI.Sprite.from(textureArray[0]); // 任意の画像URLに変更
    sprite.anchor.set(0.5); // 画像の中心を基準に回転させる
    sprite.scale.x = 2;
    sprite.scale.y = -2;
    sprite.x = app.screen.width / 2 + 150 * Math.sin(1.04); // x座標
    sprite.y = -150 * Math.cos(1.04); // y座標
    sprite.rotation = -1.04;
    mainScene.addChild(sprite);
    // アニメーション（時間で更新）
    currentFrame = 0;   // 現在フレーム番号
    // 指定した間隔でアニメーション
    setInterval(() => {
        currentFrame = (currentFrame + 1) % totalFrames;    // 次のフレーム番号を設定（最大フレームを超えないように調整）
        sprite.texture = textureArray[currentFrame];      // スプライトに表示するフレーム番号を変更
    }, frameDelay);

    // 複数の障害物スプライトを作成
    const barriers = [];
    const barrierVibrationDuration = 30;   //障害物の振動時間
    const vibrationOffset = 16; //衝突後にスプライトの位置をずらす量の最大値
    let barrierNum = getRandomInt(0, 4);
    if (level === 1) {
        barrierNum = 0;
    } else if (level === 2) {
        barrierNum = 1;
    } else if (level === 3) {
        barrierNum = 2;
    } else if (level === 4) {
        barrierNum = 3;
    }

    for (let i = 0; i < barrierNum; i++) {
        const barrier = PIXI.Sprite.from(vibImage); // 任意の画像URLに変更
        barrier.anchor.set(0.5); // 画像の中心を基準に回転させる
        barrier.scale.x = 1.5;
        barrier.scale.y = 1.5;
        barrier.x = Math.random() * app.screen.width; // 初期位置x
        barrier.y = Math.random() * app.screen.height; // 初期位置y
        barrier.originalX = barrier.x;  //初期位置xの保存
        barrier.collision = false;
        barrier.vibrationTime = 0;  //振動の経過時間
        barriers.push(barrier); //配列に障害物を追加
        mainScene.addChild(barrier);
    }


    // minからmaxまでのランダムな整数を生成する関数
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 振り子用変数
    let r; // 振り子の半径（動きの範囲）
    let angle = Math.PI / 2.59; // 初期角度（45度）
    angle = -Math.PI / 1.5;
    let angleVelocity; // 角速度（初期値）
    let angleAcceleration; // 角加速度（初期値）
    let gravity; // 重力定数（振り子の速度に影響）
    let damping; // 減衰率（摩擦の影響）、＜未使用＞
    let maxSpeed; // 最大速度（速すぎないように制限）
    let muteki;

    // 主人公の移動範囲制限
    let charaminy = 50;
    let charamaxy = 600;
    //初期化
    initHuriko();

    function initHuriko() {
        // 振り子用初期設定
        r = 150; // 振り子の半径（動きの範囲）
        //angle = Math.PI / 3; // 初期角度（45度）
        angleVelocity = 0.5; // 角速度（初期値）
        angleAcceleration = 0; // 角加速度（初期値）
        gravity = 0.002; // 重力定数（振り子の速度に影響）
        damping = 0.99; // 減衰率（摩擦の影響）
        maxSpeed = 0.05; // 最大速度（速すぎないように制限）
        muteki = false; //無敵判定フラグ
    }

    const controllArea = new PIXI.Graphics(); // グラフィックオブジェクト（背景に半透明な四角を配置するために使用）
    controllArea.beginFill("#ffffff", 0); // 色、透明度を指定して描画開始
    controllArea.drawRect(0, 0, app.screen.width, app.screen.height); // 位置(0,0)を左上にして、width,heghtの四角形を描画
    controllArea.endFill(); // 描画完了
    controllArea.interactive = true; // クリック可能にする
    //controllArea.on("pointerdown", onClick); // クリック時にonClickの関数を実行する
    mainScene.addChild(controllArea); // ボタンを結果画面シーンに追加
    controllArea.x = 0; // ボタンの座標指定
    controllArea.y = 0; // ボタンの座標指定
    //controllArea.alpha = 0.5;

    //衝突フラグ
    const collisionFlg = [];
    let collisionNum = -1;

    // ドラッグ開始
    controllArea.interactive = true;
    controllArea.buttonMode = true;

    // マウスドラッグ用の変数
    let isDragging = false; // ドラッグ状態を管理
    let startY = 0;         // ドラッグ開始時のY位置
    let controllY = 0;      // 初期位置

    // マウスホイールでスプライトを上下に動かす
    app.view.addEventListener('wheel', (event) => {
        controllY += event.deltaY / 8; // マウスホイールの動きに合わせてY軸移動
    });

    // ドラッグ開始
    controllArea.on('pointerdown', (event) => {
        isDragging = true;
        startY = event.data.global.y - controllY; // ドラッグ開始時のY位置を記録
        app.view.style.cursor = 'grabbing'; // ドラッグ中は手のひらカーソルに変更
    });

    // ドラッグ中の移動
    controllArea.on('pointermove', (event) => {
        if (collisionNum >= 0 && isDragging) {
            const barrier = barriers[collisionNum];
            //衝突していたら障害物を超えないようにする（突き抜け対策）
            if (sprite.y >= barrier.y) {
                //下にいかせない
                sprite.y = barrier.y - barrier.height / 2;
            } else {
                //上にいかせない
                sprite.y = barrier.y + barrier.height / 2;
            }
            //ドラッグ状態を解除
            //isDragging = false;
            //app.view.style.cursor = 'default'; // ドラッグ終了後は通常カーソルに戻す
            collisionNum = -1;
            //
            startY = event.data.global.y - controllY; // ドラッグ開始時のY位置を記録
        } else if (isDragging) {
            controllY = event.data.global.y - startY; // ドラッグ中にY位置を更新
        }
    });

    // ドラッグ終了
    controllArea.on('pointerup', () => {
        isDragging = false;
        app.view.style.cursor = 'default'; // ドラッグ終了後は通常カーソルに戻す
    });

    //ポインタが外れる
    controllArea.on('pointerout', () => {
        isDragging = false;
        app.view.style.cursor = 'default'; // ドラッグ終了後は通常カーソルに戻す
    });



    //無敵ボタン
    // ボタンのプロパティ
    const buttonRadius = 32;
    const buttonX = 32 * 10;
    const buttonY = app.screen.height - buttonRadius - 2;
    const disabledColor = 0xCCCCCC;
    const executedColor = 0x66cc66
    const defaultColor = 0x66FF66;
    //let isButtonDisabled = false;    // ボタンが無効化されているかどうか：グローバル化
    let isButtonExecuted = false;   // ボタンが実行されているかどうか
    let churgeBlockCount = 0;       // ボタン無効化中のゲージ増加用ブロック破壊数
    let churgeBoundCount = 0;       // ボタン無効化中のゲージ増加用障害物衝突数

    // ボタンのGraphicsを作成
    const button = new PIXI.Graphics();
    if (isButtonDisabled) {
        button.beginFill(disabledColor)
            .drawCircle(0, 0, buttonRadius)
            .endFill();
    } else {
        button.beginFill(defaultColor)
            .drawCircle(0, 0, buttonRadius)
            .endFill();
    }
    button.x = buttonX;
    button.y = buttonY;

    mainScene.addChild(button);


    // 操作説明用四角背景
    const bgrect_u = new PIXI.Graphics();
    bgrect_u.lineStyle(2, 0x66CCFF, 1); // 枠線の太さ、色、不透明度
    bgrect_u.beginFill(0x000000, 0.8);     // 塗りつぶしの色と不透明度
    bgrect_u.drawRect(0, 0, 280, 55); // (x, y, 幅, 高さ)
    bgrect_u.endFill();  // 塗りつぶし終了
    mainScene.addChild(bgrect_u);
    bgrect_u.x = 5; // ボタンの座標指定
    bgrect_u.y = 485; // ボタンの座標指定
    bgrect_u.alpha = 0.5;

    // 操作説明用テキスト
    const text_m = new TextFactory('', 18, '#ffffff');  // 初期のテキスト
    //text_m.setLineHeight(20*1.5);               // 行間を変更
    mainScene.addChild(text_m);
    text_m.x = 10; // ボタンの座標指定
    text_m.y = 490; // ボタンの座標指定
    text_m.text = `１２３４５６７８９０１２３４５\n１２３４５６７８９０１２３４５`;
    // 装飾の変更
    text_m.setStroke('0x66CCFF', 1);            // 縁取りを追加（色、太さ）

    // デフォルトテキストの設定
    text_rinji = `回転ボタンが使えるよ\n広範囲をテキパキお掃除だ！`;
    text_omake[0] = `そろそろ大魔王に会える予感\nコショウが苦手なんだとか`;
    text_omake[1] = `上下にスワイプして操作しよう\n触れたコショウをお掃除するよ`;
    text_omake[2] = `モフモフに触れると弾かれちゃう\n触れるたび微妙に位置が変わるよ`;
    text_omake[3] = `モフモフやコショウに触れると\n回転ゲージが増えやすいよ`;
    text_omake[4] = `回転中にブロックと触れると\n多めにコショウをお掃除するよ`;
    text_omake[5] = `大魔王の今日のお昼ご飯は\n小鯛のオートミールリゾットだ`;
    if (level === 1) {
        text_default = text_omake[1];
    } else if (level === 2) {
        text_default = text_omake[2];
    } else if (level === 3) {
        text_default = text_omake[3];
    } else if (level === 4) {
        text_default = text_omake[0];
    }else{
        if(level%4===0){
            text_default = text_omake[0];
        }else{
            text_default = text_omake[getRandomInt(1, text_omake.length-1)];
        }
    }
    if(isButtonDisabled){
        text_m.text = text_default;
    }else{
        text_m.text = text_rinji;
    }

    // 固定文言表示用
    const textStyleRoll = new PIXI.TextStyle({
        fontFamily: "Arial", // フォント
        fontSize: 20,// フォントサイズ
        fill: 0x000000, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
        //fontWeight: 'bold',
        stroke: '0xffffff',
        strokeThickness: 4,
        dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
        dropShadowBlur: 1,
        dropShadowDistance: 2, // ドロップシャドウの影の距離
    });

    // 回転ボタン用テキスト
    const text_rollButton = new PIXI.Text(`回転`, textStyleRoll); // 結果画面のテキスト
    text_rollButton.x = 32 * 9 + 8; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
    text_rollButton.y = app.screen.height - buttonRadius - 16; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
    if (isButtonDisabled) text_rollButton.style.stroke = disabledColor;
    mainScene.addChild(text_rollButton); // 結果画面シーンにテキスト追加

    // ボタンのクリックイベント処理
    button.interactive = true;
    button.buttonMode = true;
    button.on('pointerdown', onButtonClick);


    //let timeElapsed = 0; // 経過時間（秒）：グローバル化
    let maxTimeMuteki = 0.6;
    let maxTimeChurge = 5.0;

    // ボタンを押したときの処理
    function onButtonClick() {
        if (isButtonDisabled) return; // ボタンが無効化されている場合は何もしない
        text_rinji = `ぐるぐる回転トリックだー！！\n`;
        text_m.text = text_rinji;

        // 実行中フラグ
        isButtonExecuted = true;

        //無敵化
        //r = 150; // 振り子の半径（動きの範囲）
        //angle = Math.PI / 3; // 初期角度（45度）
        angleVelocity = 0.2; // 角速度（初期値）
        angleAcceleration = 0.2; // 角加速度（初期値）
        gravity = 0.0001; // 重力定数（振り子の速度に影響）
        //damping = 0.99; // 減衰率（摩擦の影響）
        maxSpeed = 0.5; // 最大速度（速すぎないように制限）
        muteki = true;  //無敵化

        // ボタンの色を変更
        button.clear();
        button.beginFill(executedColor); // 実行中の色に変更
        button.drawCircle(0, 0, buttonRadius);
        button.endFill();


        // ボタンを無効化
        isButtonDisabled = true;

        // タイマー開始
        startTimerMuteki();

    }


    // 円弧用色
    const disabledColorArc = 0x66cc66;
    const executedColorArc = 0xcccccc
    const defaultColorArc = 0x66FF66;
    // 無敵ボタン用の円弧エフェクト
    const arc = new PIXI.Graphics();
    arc.lineStyle(10, disabledColorArc, 1);
    arc.x = buttonX - 32;
    arc.y = buttonY - 32;
    mainScene.addChild(arc);
    if (isButtonDisabled) {
        // 初期状態を無効化にするならボタンのチャージ開始が必要
        startTimerChurge();
    } else {
        // 使えるなら使える色付け
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2 + 6.28);

    }

    // 無効状態のタイマーを開始（貯まったら使える）、円弧で視覚的に時間経過を表示
    function startTimerChurge() {
        // ゲージ増加用のカウント開始
        churgeBlockCount = 0;
        churgeBoundCount = 0;
        // 円弧の初期化
        //timeElapsed = 0;  //前回の状態を引き継げるようコメントアウト
        arc.clear();
        arc.lineStyle(10, 0xFFFFFF, 1);
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2);  // 円弧の初期位置
        // 毎フレーム更新処理の追加
        app.ticker.add(updateTimerChurge);
    }

    // 無効状態のタイマーを更新（毎フレーム処理）
    function updateTimerChurge(delta) {
        // ゲージが貯まったらボタンを実行可能にする
        if (timeElapsed >= maxTimeChurge) {
            // ボタン使えるよテキスト
            text_rinji = `回転ボタンが使えるよ\n広範囲をテキパキお掃除だ！`;
            text_m.text = text_rinji;

            // ボタンの有効化
            isButtonDisabled = false;

            //ボタンを有効化
            button.clear();
            button.beginFill(defaultColor); // 実行可能の色に戻す
            button.drawCircle(0, 0, buttonRadius);
            button.endFill();

            // 円弧の色を変更
            arc.clear();
            arc.lineStyle(10, disabledColorArc, 1);
            arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2 + 6.28);

            // テキストの色を変更
            text_rollButton.style.stroke = 0xFFFFFF;

            // タイマー終了後の処理
            app.ticker.remove(updateTimerChurge); // タイマーを停止
            return;
        }

        // 時間経過を円弧に反映
        timeElapsed += 0.001 * delta + 0.01 * churgeBlockCount + 0.1 * churgeBoundCount;  // タイマーの増加（deltaでフレームレートに依存しない）
        //timeElapsed += 0.001 * delta + 0.0001 * churgeBlockCount + 0.001 * churgeBoundCount;  // タイマーの増加（deltaでフレームレートに依存しない）
        churgeBlockCount = 0;
        churgeBoundCount = 0;

        let arcAngle = (timeElapsed / maxTimeChurge) * Math.PI * 2;  // 時間経過に応じた角度（0から360度）
        if (arcAngle >= 6.28) {
            arcAngle = 0; // 360度を超えたらリセット
        }

        //dtext.text = `arcAngle:${arcAngle}, yogoreNum:${yogoreArray.length}`;

        // 円弧の描画
        arc.clear();
        arc.lineStyle(10, defaultColorArc, 1);  // 色を赤に設定
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2 + arcAngle);
    }

    // 無敵状態のタイマーを開始し、円弧で視覚的に時間経過を表示
    function startTimerMuteki() {
        timeElapsed = 0;
        arc.clear();
        arc.lineStyle(10, 0xFFFFFF, 1);
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2);  // 円弧の初期位置

        app.ticker.add(updateTimerMuteki);  // 毎フレーム更新
    }

    // 無敵状態のタイマーを更新（毎フレーム処理）
    function updateTimerMuteki(delta) {
        // 時間が来たら無敵状態を解除する
        if (timeElapsed >= maxTimeMuteki) {
            // 説明用テキストも戻す
            text_m.text = text_default;

            // 無敵化の解除
            initHuriko();    //最大速度を戻す

            //ボタンを戻す
            button.clear();
            button.beginFill(disabledColor); // 非活性の色に戻す
            button.drawCircle(0, 0, buttonRadius);
            button.endFill();

            // テキストの色を変更
            text_rollButton.style.stroke = disabledColor;


            // 実行中状態の解除
            isButtonExecuted = false;

            // タイマー終了後の処理
            app.ticker.remove(updateTimerMuteki); // タイマーを停止

            // ゲージを初期化
            timeElapsed = 0;

            // ボタンのチャージを開始
            startTimerChurge();

            // 処理の終了
            return;

        }

        // 時間経過を円弧に反映
        timeElapsed += 0.01 * delta;  // タイマーの増加（deltaでフレームレートに依存しない）


        let arcAngle = (timeElapsed / maxTimeMuteki) * Math.PI * 2;  // 時間経過に応じた角度（0から360度）
        if (arcAngle >= 6.28) {
            arcAngle = 0; // 360度を超えたらリセット
        }

        //dtext.text = `arcAngle:${arcAngle}, yogoreNum:${yogoreArray.length}`

        // 円弧の描画
        arc.clear();
        arc.lineStyle(10, executedColorArc, 1);  // 色を赤に設定
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2 - arcAngle);
    }

    //汚れとの衝突判定
    function checkYogoreCollision(object, threshold) {
        // yogoreArrayのyogoreが引数objectに触れると、移動して消える
        yogoreArray.forEach((yogore, index) => {
            if (!yogore.isMovingOut) { // 移動中でないスプライトBに対して
                let distance = Math.sqrt(Math.pow(object.x - yogore.x, 2) + Math.pow(object.y - yogore.y, 2));

                // 無敵中は衝突範囲拡大
                if (muteki) {
                    distance -= 65;
                }

                // 閾値との判定
                if (distance < threshold) { // スプライトAとスプライトBが近接したら
                    yogore.isMovingOut = true; // 移動を開始する
                    yogore.moveDirection = {
                        x: Math.random() - 0.5, // x方向にランダムな移動方向：0.5未満なら1、0.5以上なら-1
                        y: Math.random() < 0.5 ? 0.5 : -0.5,  // y方向にランダムな移動方向：0.5未満なら1、0.5以上なら-1
                        r: Math.random() < 0.5 ? 1 : -1,  // y方向にランダムな移動方向：0.5未満なら1、0.5以上なら-1
                        g: Math.random() < 0.5 ? 1 : 1
                    };
                    // スコア記録用に汚れ数カウント
                    yogorenum -= 1;
                    totalScore += 1;
                    // ボタンがチャージ中ならゲージ加算
                    if (isButtonDisabled === true && isButtonExecuted === false) {
                        churgeBlockCount += 1;
                    }
                    text_result.text = `${yogorenum}`;
                    text_totalScore.text = `${totalScore}`;
                }
            }

            // 汚れが画面外に落ちていく処理
            if (yogore.isMovingOut) {
                yogore.moveDirection.g += 0.2;
                yogore.x += yogore.moveDirection.x * 10; // x方向に移動
                yogore.y += (yogore.moveDirection.y * 1 + yogore.moveDirection.g); // y方向に移動
                yogore.rotation += yogore.moveDirection.r;

                // 画面外に出たらスプライトを消す
                if (yogore.x < -50 || yogore.x > app.screen.width + 50 || yogore.y < -50 || yogore.y > app.screen.height + 50) {
                    yogore.destroy(); // スプライトBを消す
                    yogoreArray.splice(index, 1); // 配列からスプライトBを削除(indexはforEachのコールバック関数の引数)
                }

                // クリアメッセージを先出し
                if (yogorenum === 0) {
                    //isResetting = true;
                    // 説明テキスト変更
                    text_rinji = `ありがとう！綺麗になったよ！\n`;
                    text_m.text = text_rinji;
                    if(isResetting)return;
                    // クリアメッセージ
                    mes_clear.text = 'お掃除大成功！';
                    mes_clear.y = 180;

                }
                // 汚れが画面外に消えたらフェード開始
                if (yogoreArray.length === 0 && !isResetting) {
                    isResetting = true;

                    // シーンの切り替え
                    setTimeout(() => {
                        if (level % 4 === 0) {
                            changeScene(createBossScene());  // 新しいシーンを作成
                        } else {
                            changeScene(createMainScene());  // 新しいシーンを作成
                        }
                    }, 100);  // 0.1秒後に切り替え

                    //シーンの再作成
                    //resetScene();
                }

            }
        });
    }

    // 障害物との衝突検出用関数
    function checkCollision() {
        //各障害物に対して衝突判定を行う
        for (let i = 0; i < barriers.length; i++) {
            const barrier = barriers[i];
            const dx = sprite.x - barrier.x;
            const dy = sprite.y - barrier.y;
            const wt = sprite.width + barrier.width;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const threshold = Math.sqrt(wt * wt); // 衝突の閾値

            // 回転したスプライトの角度を考慮
            const spriteBounds = sprite.getBounds();
            const barrierBounds = barrier.getBounds();

            // 衝突判定
            if (spriteBounds.x < barrierBounds.x + barrierBounds.width - 16 &&
                spriteBounds.x + spriteBounds.width > barrierBounds.x + 16 &&
                spriteBounds.y < barrierBounds.y + barrierBounds.height &&
                spriteBounds.y + spriteBounds.height > barrierBounds.y) {
                //衝突フラグを立てる
                barrier.collision = true;
                barrier.vibrationTime = 0; //振動の経過時間(ms)

                // 衝突が検出された場合、反射させる
                angleVelocity *= -1.1;

                // ボタンがチャージ中ならゲージ加算
                if (isButtonDisabled === true && isButtonExecuted === false) {
                    churgeBoundCount += 1;
                }

                //　衝突していたら障害物を超えないようにする（突き抜け対策）
                if (sprite.y >= barrier.y) {
                    controllY += 8;
                    //angularVelocity *= 0.5; // 衝突後のエネルギー損失
                } else {
                    controllY -= 8;
                }

            }
        }

    }

    function barrierVibration(delta) {
        for (let i = 0; i < barriers.length; i++) {
            const barrier = barriers[i];
            if (barrier.collision) {
                barrier.vibrationTime += delta;

                // 振動の範囲を設定 (左右に2px)
                const amplitude = 5;

                // 左右に振動させる
                barrier.x = (barrier.originalX - amplitude / 2 + Math.sin(barrier.vibrationTime * 10) * amplitude);

                // 振動中の障害物と汚れの衝突判定
                checkYogoreCollision(barrier, 30);

                // 振動時間が終了したら振動を止める
                if (barrier.vibrationTime > barrierVibrationDuration) {
                    barrier.collision = false;
                    barrier.vibrationTime = 0;
                    barrier.x = barrier.originalX + Math.sin(Math.random()) * vibrationOffset;
                }
            }
        }
    }

    // シーンの切替
    function changeScene(newScene) {
        // 振り子を停止
        startFlg = false;
        // 現在のシーンをスライドアウト
        slideOut(currentScene, 500, 'left');

        // スライドアウトのアニメーション後に次のシーンを表示
        setTimeout(() => {
            // 現在のシーンを削除
            if (currentScene) {
                app.stage.removeChild(currentScene);
            }

            // 新しいシーンを追加
            currentScene = newScene;
            app.stage.addChild(currentScene);

            // uiContainerを再配置
            // uiContainerを削除
            app.stage.removeChild(uiContainer);
            // uiContainerを追加
            app.stage.addChild(uiContainer);

            // 新しいシーンをスライドイン
            slideIn(currentScene, 500, 'right');

            // スライドインのアニメーション後に次のシーンを表示
            setTimeout(() => {
                startFlg = true;        // 振り子を開始
                isResetting = false;  // シーンリセット完了
                mes_clear.alpha = 1;
                mes_clear.y = -180;
            }, 500);
        }, 500);

    }

    // シーンをスライドインさせる関数
    function slideIn(scene, duration, direction = 'left') {
        let startX = direction === 'left' ? -app.screen.width : app.screen.width;
        scene.x = startX;

        let step = (Math.abs(startX) / duration) * 16;  // 16msごとに更新

        function update() {
            scene.x += direction === 'left' ? step : -step;

            if (direction === 'left' && scene.x >= 0 || direction === 'right' && scene.x <= 0) {
                scene.x = 0;
            } else {
                requestAnimationFrame(update);
            }
        }

        update();
    }

    // シーンをスライドアウトさせる関数
    function slideOut(scene, duration, direction = 'left') {
        let endX = direction === 'left' ? -app.screen.width : app.screen.width;
        let step = (Math.abs(scene.x - endX) / duration) * 16;  // 16msごとに更新

        function update() {
            scene.x += direction === 'left' ? -step : step;

            if (direction === 'left' && scene.x <= endX || direction === 'right' && scene.x >= endX) {
                scene.x = endX;
            } else {
                requestAnimationFrame(update);
            }
        }

        update();
    }


    function resetScene() {
        isResetting = true;  // リセット開始

        app.stage.removeChildren(); // すべての小要素削除
        currentScene = createMainScene(); // ゲームシーンを生成する

        // リセット処理が完了したら、フラグをリセット
        setTimeout(() => {
            isResetting = false;  // シーンリセット完了
        }, 1000);  // 1秒待ってからフラグをリセット（処理が完了したタイミングに応じて調整）
    }

    // 主人公動き用
    const timing = 10;
    let timer = 0;

    // 振り子の運動を更新
    app.ticker.add((delta) => { //delta:現在のフレームが前回のフレームから何秒経過したかを示す値
        // 準備完了するまで動かさない
        if (!startFlg) return;

        // 主人公動き
        timer += 1;
        if (Math.floor(timer / timing) === 0) {
            sprite.texture = textureArray[0];      // スプライトに表示するフレーム番号を変更
        } else if (Math.floor(timer / timing) === 1) {
            sprite.texture = textureArray[1];      // スプライトに表示するフレーム番号を変更
        } else if (Math.floor(timer / timing) === 2) {
            sprite.texture = textureArray[2];      // スプライトに表示するフレーム番号を変更
        } else if (Math.floor(timer / timing) === 3) {
            sprite.texture = textureArray[3];      // スプライトに表示するフレーム番号を変更
        } else {
            timer = 0;
        }

        // 角加速度の計算
        angleAcceleration = -gravity * Math.sin(angle); // 振り子の動きの加速度

        // 角速度と角度を更新
        angleVelocity += angleAcceleration; // 角速度を更新
        if (angleVelocity > maxSpeed) {
            angleVelocity = maxSpeed;
        }
        //angleVelocity *= damping; // 減衰を適用（摩擦）
        angle += angleVelocity; // 角度を更新

        //dtext.text = `angle:${angle}`

        // スプライトの位置を更新
        if (controllY + r > charamaxy) {
            controllY = charamaxy - r;
        } else if (controllY + r < charaminy) {
            controllY = charaminy - r;
        }
        sprite.x = app.screen.width / 2 + r * -Math.sin(angle); // x座標
        sprite.y = controllY + r * Math.cos(angle); // y座標

        // スプライトの角度を振り子の角度に合わせて回転
        sprite.rotation = angle; // 角度をスプライトの回転に反映

        // 直線の描画位置を振り子の位置に合わせて更新
        line.clear(); // 以前の直線を消去
        line.lineStyle(2, 0x000000, 1); // 白い線を描く
        line.moveTo(app.screen.width / 2, controllY); // 直線の始点（画面の中央）
        line.lineTo(app.screen.width / 2 + (r - 32) * -Math.sin(angle), controllY + (r - 32) * Math.cos(angle)); // 直線の終点（スプライトの位置）
        mainScene.addChild(line);

        // 障害物衝突判定
        checkCollision();

        //障害物衝突アニメーション
        barrierVibration(delta);

        //汚れ衝突判定
        checkYogoreCollision(sprite, 50);


    });

    return mainScene;

}


/** 
 * ボスシーン
 * (Aboss)
 */
function createBossScene() {
    // 値の初期化
    maodamage = 0;
    winflg = false;

    // タイトルシーン作成
    const bossScene = new PIXI.Container();

    levelStartTime = Date.now();  // レベル開始時間

    // UIレイアウト変更
    // 残り汚れ数の表示を消す
    text_result.text = ``;
    text_kotei2.text = ``;
    // 大魔王さまテキスト
    const mes_boss = new TextFactory('vs大魔王ﾌﾘｶｹｰﾙ', 24, '0x000000');     // これだけでテキストを作成
    mes_boss.setBold(true);                       // 太字に変更
    mes_boss.setStroke('#ffffff', 4);
    uiContainer.addChild(mes_boss);
    mes_boss.x = 180;            // X座標
    mes_boss.y = 0;             // Y座標
    // HPテキスト
    const mes_hp = new TextFactory('', 24, '0x000000');     // これだけでテキストを作成
    mes_hp.setBold(true);                       // 太字に変更
    mes_hp.setStroke('#ffffff', 4);
    uiContainer.addChild(mes_hp);
    mes_hp.x = 240;            // X座標
    mes_hp.y = 32;             // Y座標


    // 背景
    const background = new PIXI.Sprite(backgroundImage); //引数には、プリロードしたURLを追加する
    background.x = 0; // x座標
    background.y = 0; // y座標
    background.scale.x = 4;   //x方向に2倍の大きさ
    background.scale.y = 4;   //y方向に2倍の大きさ
    background.alpha = 0.5;
    bossScene.addChild(background); // ボールをシーンに追加

    // 汚れ用スプライト
    const yogoreArray = [];
    const gridSizeRow = 21; //縦横に何個ずつ配置するか
    const gridSizeColumn = 21; //縦横に何個ずつ配置するか
    const yogoresize = 16; //スプライトの間隔（サイズ）
    let yogorenum = 0;

    yogoreCreate();

    function yogoreCreate() {
        for (let i = 0; i < gridSizeColumn; i++) {
            for (let j = 0; j < gridSizeRow; j++) {
                if (j === 0 && (i >= 9 && i <= 12)) { continue; }
                if (j === 20 && (i >= 20 || i <= 0)) { continue; }
                const yogore = new PIXI.Sprite(yogoreImage);
                yogore.anchor.set(0.5); // 画像の中心を基準に回転させる
                yogore.scale.x = 1;
                yogore.scale.y = 1;
                yogore.x = 16 + i * yogoresize; // 初期位置x
                yogore.y = 96 + j * yogoresize; // 初期位置y
                yogore.interactive = true;
                yogore.buttonMode = true;
                yogore.isMovingOut = false; // 移動中かどうかのフラグ
                yogoreArray.push(yogore); //配列に障害物を追加
                bossScene.addChild(yogore);
                yogorenum += 1;
            }
        }
    }

    // だいまおうさま
    // 初期位置の定義
    const maoix = app.screen.width / 2;
    const maoiy = 550;
    // まおうさまの定義
    const mao = PIXI.Sprite.from(textureArrayMao[0]); // 任意の画像URLに変更
    mao.anchor.set(0.5); // 画像の中心を基準に回転させる
    mao.scale.x = 2;
    mao.scale.y = 2;
    mao.x = maoix;         // 初期位置x
    mao.y = maoiy;          // 初期位置y
    mao.alpha = 1;     // 透明度
    bossScene.addChild(mao);



    // 振り子を示す直線を描画するためのGraphicsオブジェクト
    const line = new PIXI.Graphics();
    line.lineStyle(2, 0x000000, 1); // 白い線を描く
    line.moveTo(0, 0); // 直線の始点（画面の中央）
    line.lineTo(0, 0); // 直線の終点（スプライトの位置）
    bossScene.addChild(line);

    // 主人公スプライトを作成
    //const sprite = PIXI.Sprite.from(textureArray[0]); // 任意の画像URLに変更
    sprite = PIXI.Sprite.from(textureArray[0]); // 任意の画像URLに変更
    sprite.anchor.set(0.5); // 画像の中心を基準に回転させる
    sprite.scale.x = 2;
    sprite.scale.y = -2;
    sprite.x = app.screen.width / 2 + 150 * Math.sin(1.04); // x座標
    sprite.y = -150 * Math.cos(1.04); // y座標
    sprite.rotation = -1.04;
    bossScene.addChild(sprite);
    // アニメーション（時間で更新）
    currentFrame = 0;   // 現在フレーム番号
    // 指定した間隔でアニメーション
    setInterval(() => {
        currentFrame = (currentFrame + 1) % totalFrames;    // 次のフレーム番号を設定（最大フレームを超えないように調整）
        sprite.texture = textureArray[currentFrame];      // スプライトに表示するフレーム番号を変更
    }, frameDelay);

    // minからmaxまでのランダムな整数を生成する関数
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 振り子用変数
    let r; // 振り子の半径（動きの範囲）
    let angle = Math.PI / 2.59; // 初期角度（45度）
    angle = -Math.PI / 1.5;
    let angleVelocity; // 角速度（初期値）
    let angleAcceleration; // 角加速度（初期値）
    let gravity; // 重力定数（振り子の速度に影響）
    let damping; // 減衰率（摩擦の影響）、＜未使用＞
    let maxSpeed; // 最大速度（速すぎないように制限）
    let muteki;

    // 主人公の移動範囲制限
    let charaminy = 100;
    let charamaxy = 440;
    //初期化
    initHuriko();

    function initHuriko() {
        // 振り子用初期設定
        r = 150; // 振り子の半径（動きの範囲）
        //angle = Math.PI / 3; // 初期角度（45度）
        angleVelocity = 0.5; // 角速度（初期値）
        angleAcceleration = 0; // 角加速度（初期値）
        gravity = 0.002; // 重力定数（振り子の速度に影響）
        damping = 0.99; // 減衰率（摩擦の影響）
        maxSpeed = 0.05; // 最大速度（速すぎないように制限）
        muteki = false; //無敵判定フラグ
    }

    const controllArea = new PIXI.Graphics(); // グラフィックオブジェクト（背景に半透明な四角を配置するために使用）
    controllArea.beginFill("#ffffff", 0); // 色、透明度を指定して描画開始
    controllArea.drawRect(0, 0, app.screen.width, app.screen.height); // 位置(0,0)を左上にして、width,heghtの四角形を描画
    controllArea.endFill(); // 描画完了
    controllArea.interactive = true; // クリック可能にする
    //controllArea.on("pointerdown", onClick); // クリック時にonClickの関数を実行する
    bossScene.addChild(controllArea); // ボタンを結果画面シーンに追加
    controllArea.x = 0; // ボタンの座標指定
    controllArea.y = 0; // ボタンの座標指定
    //controllArea.alpha = 0.5;

    //衝突フラグ
    const collisionFlg = [];
    let collisionNum = -1;

    // ドラッグ開始
    controllArea.interactive = true;
    controllArea.buttonMode = true;

    // マウスドラッグ用の変数
    let isDragging = false; // ドラッグ状態を管理
    let startY = 0;         // ドラッグ開始時のY位置
    let controllY = 0;      // 初期位置

    // マウスホイールでスプライトを上下に動かす
    app.view.addEventListener('wheel', (event) => {
        controllY += event.deltaY / 8; // マウスホイールの動きに合わせてY軸移動
    });

    // ドラッグ開始
    controllArea.on('pointerdown', (event) => {
        isDragging = true;
        startY = event.data.global.y - controllY; // ドラッグ開始時のY位置を記録
        app.view.style.cursor = 'grabbing'; // ドラッグ中は手のひらカーソルに変更
    });

    // ドラッグ中の移動
    controllArea.on('pointermove', (event) => {
        if (isDragging) {
            controllY = event.data.global.y - startY; // ドラッグ中にY位置を更新
        }
    });

    // ドラッグ終了
    controllArea.on('pointerup', () => {
        isDragging = false;
        app.view.style.cursor = 'default'; // ドラッグ終了後は通常カーソルに戻す
    });

    //ポインタが外れる
    controllArea.on('pointerout', () => {
        isDragging = false;
        app.view.style.cursor = 'default'; // ドラッグ終了後は通常カーソルに戻す
    });



    //無敵ボタン
    // ボタンのプロパティ
    const buttonRadius = 32;
    const buttonX = 32 * 10;
    const buttonY = app.screen.height - buttonRadius - 2;
    const disabledColor = 0xCCCCCC;
    const executedColor = 0x66cc66
    const defaultColor = 0x66FF66;
    //let isButtonDisabled = false;    // ボタンが無効化されているかどうか：グローバル化
    let isButtonExecuted = false;   // ボタンが実行されているかどうか
    let churgeBlockCount = 0;       // ボタン無効化中のゲージ増加用ブロック破壊数
    let churgeBoundCount = 0;       // ボタン無効化中のゲージ増加用障害物衝突数

    // ボタンのGraphicsを作成
    const button = new PIXI.Graphics();
    if (isButtonDisabled) {
        button.beginFill(disabledColor)
            .drawCircle(0, 0, buttonRadius)
            .endFill();
    } else {
        button.beginFill(defaultColor)
            .drawCircle(0, 0, buttonRadius)
            .endFill();
    }
    button.x = buttonX;
    button.y = buttonY;

    bossScene.addChild(button);

    // 固定文言表示用
    const textStyleRoll = new PIXI.TextStyle({
        fontFamily: "Arial", // フォント
        fontSize: 20,// フォントサイズ
        fill: 0x000000, // 色(16進数で定義するので#ffffffと書かずに0xffffffと書く)
        //fontWeight: 'bold',
        stroke: '0xffffff',
        strokeThickness: 4,
        dropShadow: true, // ドロップシャドウを有効にする（右下に影をつける）
        dropShadowBlur: 1,
        dropShadowDistance: 2, // ドロップシャドウの影の距離
    });

    // 回転ボタン用テキスト
    const text_rollButton = new PIXI.Text(`回転`, textStyleRoll); // 結果画面のテキスト
    text_rollButton.x = 32 * 9 + 8; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
    text_rollButton.y = app.screen.height - buttonRadius - 16; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
    if (isButtonDisabled) text_rollButton.style.stroke = disabledColor;
    bossScene.addChild(text_rollButton); // 結果画面シーンにテキスト追加

    // ボタンのクリックイベント処理
    button.interactive = true;
    button.buttonMode = true;
    button.on('pointerdown', onButtonClick);


    //let timeElapsed = 0; // 経過時間（秒）：グローバル化
    let maxTimeMuteki = 0.6;
    let maxTimeChurge = 5.0;

    // ボタンを押したときの処理
    function onButtonClick() {
        if (isButtonDisabled) return; // ボタンが無効化されている場合は何もしない

        // 実行中フラグ
        isButtonExecuted = true;

        //無敵化
        //r = 150; // 振り子の半径（動きの範囲）
        //angle = Math.PI / 3; // 初期角度（45度）
        angleVelocity = 0.2; // 角速度（初期値）
        angleAcceleration = 0.2; // 角加速度（初期値）
        gravity = 0.0001; // 重力定数（振り子の速度に影響）
        //damping = 0.99; // 減衰率（摩擦の影響）
        maxSpeed = 0.5; // 最大速度（速すぎないように制限）
        muteki = true;  //無敵化

        // ボタンの色を変更
        button.clear();
        button.beginFill(executedColor); // 実行中の色に変更
        button.drawCircle(0, 0, buttonRadius);
        button.endFill();


        // ボタンを無効化
        isButtonDisabled = true;

        // タイマー開始
        startTimerMuteki();

    }


    // 円弧用色
    const disabledColorArc = 0x66cc66;
    const executedColorArc = 0xcccccc
    const defaultColorArc = 0x66FF66;
    // 無敵ボタン用の円弧エフェクト
    const arc = new PIXI.Graphics();
    arc.lineStyle(10, disabledColorArc, 1);
    arc.x = buttonX - 32;
    arc.y = buttonY - 32;
    bossScene.addChild(arc);
    if (isButtonDisabled) {
        // 初期状態を無効化にするならボタンのチャージ開始が必要
        startTimerChurge();
    } else {
        // 使えるなら使える色付け
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2 + 6.28);

    }

    // 無効状態のタイマーを開始（貯まったら使える）、円弧で視覚的に時間経過を表示
    function startTimerChurge() {
        // ゲージ増加用のカウント開始
        churgeBlockCount = 0;
        churgeBoundCount = 0;
        // 円弧の初期化
        //timeElapsed = 0;  //前回の状態を引き継げるようコメントアウト
        arc.clear();
        arc.lineStyle(10, 0xFFFFFF, 1);
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2);  // 円弧の初期位置
        // 毎フレーム更新処理の追加
        app.ticker.add(updateTimerChurge);
    }

    // 無効状態のタイマーを更新（毎フレーム処理）
    function updateTimerChurge(delta) {
        // ゲージが貯まったらボタンを実行可能にする
        if (timeElapsed >= maxTimeChurge) {
            // ボタンの有効化
            isButtonDisabled = false;

            //ボタンを有効化
            button.clear();
            button.beginFill(defaultColor); // 実行可能の色に戻す
            button.drawCircle(0, 0, buttonRadius);
            button.endFill();

            // 円弧の色を変更
            arc.clear();
            arc.lineStyle(10, disabledColorArc, 1);
            arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2 + 6.28);

            // テキストの色を変更
            text_rollButton.style.stroke = 0xFFFFFF;

            // タイマー終了後の処理
            app.ticker.remove(updateTimerChurge); // タイマーを停止
            return;
        }

        // 時間経過を円弧に反映
        timeElapsed += 0.001 * delta + 0.01 * churgeBlockCount + 0.1 * churgeBoundCount;  // タイマーの増加（deltaでフレームレートに依存しない）
        //timeElapsed += 0.001 * delta + 0.0001 * churgeBlockCount + 0.001 * churgeBoundCount;  // タイマーの増加（deltaでフレームレートに依存しない）
        churgeBlockCount = 0;
        churgeBoundCount = 0;

        let arcAngle = (timeElapsed / maxTimeChurge) * Math.PI * 2;  // 時間経過に応じた角度（0から360度）
        if (arcAngle >= 6.28) {
            arcAngle = 0; // 360度を超えたらリセット
        }

        //dtext.text = `arcAngle:${arcAngle}, yogoreNum:${yogoreArray.length}`

        // 円弧の描画
        arc.clear();
        arc.lineStyle(10, defaultColorArc, 1);  // 色を赤に設定
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2 + arcAngle);
    }

    // 無敵状態のタイマーを開始し、円弧で視覚的に時間経過を表示
    function startTimerMuteki() {
        timeElapsed = 0;
        arc.clear();
        arc.lineStyle(10, 0xFFFFFF, 1);
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2);  // 円弧の初期位置

        app.ticker.add(updateTimerMuteki);  // 毎フレーム更新
    }

    // 無敵状態のタイマーを更新（毎フレーム処理）
    function updateTimerMuteki(delta) {
        // 時間が来たら無敵状態を解除する
        if (timeElapsed >= maxTimeMuteki) {
            // 無敵化の解除
            initHuriko();    //最大速度を戻す

            //ボタンを戻す
            button.clear();
            button.beginFill(disabledColor); // 非活性の色に戻す
            button.drawCircle(0, 0, buttonRadius);
            button.endFill();

            // テキストの色を変更
            text_rollButton.style.stroke = disabledColor;


            // 実行中状態の解除
            isButtonExecuted = false;

            // タイマー終了後の処理
            app.ticker.remove(updateTimerMuteki); // タイマーを停止

            // ゲージを初期化
            timeElapsed = 0;

            // ボタンのチャージを開始
            startTimerChurge();

            // 処理の終了
            return;

        }

        // 時間経過を円弧に反映
        timeElapsed += 0.01 * delta;  // タイマーの増加（deltaでフレームレートに依存しない）


        let arcAngle = (timeElapsed / maxTimeMuteki) * Math.PI * 2;  // 時間経過に応じた角度（0から360度）
        if (arcAngle >= 6.28) {
            arcAngle = 0; // 360度を超えたらリセット
        }

        //dtext.text = `arcAngle:${arcAngle}, yogoreNum:${yogoreArray.length}`

        // 円弧の描画
        arc.clear();
        arc.lineStyle(10, executedColorArc, 1);  // 色を赤に設定
        arc.arc(buttonRadius, buttonRadius, buttonRadius - 4, -Math.PI / 2, -Math.PI / 2 - arcAngle);
    }

    //汚れとの衝突判定
    function checkYogoreCollision(object, threshold) {
        // yogoreArrayのyogoreが引数objectに触れると、移動して消える
        yogoreArray.forEach((yogore, index) => {
            if (!yogore.isMovingOut) { // 移動中でないスプライトBに対して
                let distance = Math.sqrt(Math.pow(object.x - yogore.x, 2) + Math.pow(object.y - yogore.y, 2));

                // 無敵中は衝突範囲拡大
                if (muteki) {
                    distance -= 65;
                }

                // 閾値との判定
                if (distance < threshold || winflg) { // スプライトAとスプライトBが近接したら
                    yogore.isMovingOut = true; // 移動を開始する
                    yogore.moveDirection = {
                        x: Math.random() - 0.5, // x方向にランダムな移動方向：0.5未満なら1、0.5以上なら-1
                        y: Math.random() < 0.5 ? 0.5 : -0.5,  // y方向にランダムな移動方向：0.5未満なら1、0.5以上なら-1
                        r: Math.random() < 0.5 ? 1 : -1,  // y方向にランダムな移動方向：0.5未満なら1、0.5以上なら-1
                        g: Math.random() < 0.5 ? 1 : 1
                    };
                    // スコア記録用に汚れ数カウント
                    yogorenum -= 1;
                    totalScore += 1;
                    // ボタンがチャージ中ならゲージ加算
                    if (isButtonDisabled === true && isButtonExecuted === false) {
                        churgeBlockCount += 1;
                    }
                    //text_kotei2.text = `${yogorenum}`;
                    text_totalScore.text = `${totalScore}`;
                }
            }

            // 汚れが画面外に落ちていく処理
            if (yogore.isMovingOut) {
                yogore.moveDirection.g += 0.2;
                yogore.x += yogore.moveDirection.x * 10; // x方向に移動
                yogore.y += (yogore.moveDirection.y * 1 + yogore.moveDirection.g); // y方向に移動
                yogore.rotation += yogore.moveDirection.r;

                // まおうさまとの衝突判定
                let distance_mao = Math.sqrt(Math.pow(mao.x - yogore.x, 2) + Math.pow(mao.y - yogore.y, 2));
                if (distance_mao < threshold) { // 衝突したら
                    maodamage += 1;                         // カウント
                    //dtext.text = `ダメージ:${maodamage}`     // テキスト更新
                    yogore.y = app.screen.height + 300;      // 衝突した汚れを画面外に
                    // まおうさまダメージ
                    decreaseHP(1); // 毎秒5ずつ減少
                    // まおうさま光る
                    changeColorTemporarily(mao, 1000);
                }
                // 画面外に出たらスプライトを消す
                if (yogore.x < -50 || yogore.x > app.screen.width + 50 || yogore.y < -50 || yogore.y > app.screen.height + 50) {
                    yogore.destroy(); // スプライトBを消す
                    yogoreArray.splice(index, 1); // 配列からスプライトBを削除(indexはforEachのコールバック関数の引数)
                }

                // 汚れが画面外に消えたらフェード開始
                if (yogoreArray.length === 0) {
                    if (!winflg) {
                        // 汚れ復活
                        yogoreCreate();
                        // インタフェース作り直し
                        // スワイプ操作用
                        bossScene.removeChild(controllArea);
                        bossScene.removeChild(button);
                        bossScene.removeChild(text_rollButton); // 回転ボタン
                        bossScene.removeChild(arc);             // 回転ボタン
                        bossScene.addChild(controllArea);
                        bossScene.addChild(button);
                        bossScene.addChild(text_rollButton);    // 回転ボタン
                        bossScene.addChild(arc);                // 回転ボタン
                    }
                }
            }
        });
    }

    // 衝突後に色を変化させる関数
    function changeColorTemporarily(sprite, duration) {
        if (!winflg) {
            // 色を変える
            sprite.tint = 0xcc6666;
            // アニメーション変更
            sprite.texture = textureArrayMao[1];

            // 指定した時間後に元の色に戻す
            setTimeout(() => {
                sprite.tint = 0xFFFFFF; // 元の色
                sprite.texture = textureArrayMao[0];
            }, duration);
        }
    }

    // ゲージの長さ
    let barwidth = 340; // HPゲージの長さ
    let barheight = 30; // HPゲージの高さ
    let hpbar_x = 10;   // HPゲージの開始x座標
    let hpbar_y = 35;   // HPゲージの開始y座標
    // HPゲージのバックグラウンドを作成
    const hpBarBackground = new PIXI.Graphics();
    hpBarBackground.beginFill(0x000000);
    hpBarBackground.drawRect(hpbar_x, hpbar_y, barwidth, barheight);
    hpBarBackground.endFill();
    bossScene.addChild(hpBarBackground);

    // HPゲージの前景を作成（初期HP: 100）
    const hpBar = new PIXI.Graphics();
    hpBar.beginFill(0x66FF66); // 緑色
    hpBar.drawRect(hpbar_x, hpbar_y, barwidth, barheight); // 同じ位置・サイズ
    hpBar.endFill();
    bossScene.addChild(hpBar);

    // 初期HPと最大HPの設定
    const maxHP = 500;
    let currentHP = maxHP;

    // HPを減らす関数
    function decreaseHP(amount) {
        if (!winflg) {
            currentHP -= amount;
            if (currentHP <= 0) {
                currentHP = 0;
                // 勝利テキスト
                mes_clear.y*=-1;
                mes_clear.text = 'お見事大勝利！';
                // 勝利フラグ
                winflg = true;
                // まおうさま敗北演出を毎フレーム更新処理に追加
                app.ticker.add(yararetaBoss);
            }
            updateHPBar();
        }
    }

    // HPゲージを更新する関数
    function updateHPBar() {
        hpBar.clear();
        // ゲージの幅をHPの割合に基づいて変更
        const hpPercentage = currentHP / maxHP;
        barwidth = 300 * hpPercentage; // ゲージの幅をHPの割合に基づいて更新

        // HPが0に近づくと色を変更する（例: 赤色に）
        if (currentHP < maxHP * 0.3) {
            hpBar.beginFill(0xFF3333); // 赤色
        } else if (currentHP < maxHP * 0.6) {
            hpBar.beginFill(0xFFFF66); // 黄色
        } else {
            hpBar.beginFill(0x66FF66); // 緑色
        }
        hpBar.drawRect(hpbar_x, hpbar_y, barwidth, barheight);
        hpBar.endFill();
        // テキストも更新
        mes_hp.text = `${currentHP * 2}/${maxHP * 2}`
    }

    // まおうさま敗北演出
    function yararetaBoss() {
        // アニメーション変更
        mao.texture = textureArrayMao[1];
        // 画面外へ吹っ飛ぶ
        mao.y -= 4;
        mao.rotation += 0.1;
        if (mao.y < 0) {
            if (gamemode === 0) {
                switchScene('clear');
                mes_boss.text = ``;
                mes_hp.text = ``;
                mao.y = 1000;
                app.ticker.remove(yararetaBoss);
            } else {
                app.ticker.remove(yararetaBoss);
                mes_boss.text = ``;
                mes_hp.text = ``;
                changeScene(createMainScene());
            }
        }
    }

    // シーンの切替
    function changeScene(newScene) {
        // 振り子を停止
        startFlg = false;
        // 現在のシーンをスライドアウト
        slideOut(currentScene, 500, 'left');

        // スライドアウトのアニメーション後に次のシーンを表示
        setTimeout(() => {
            // 現在のシーンを削除
            if (currentScene) {
                app.stage.removeChild(currentScene);
            }

            // 新しいシーンを追加
            currentScene = newScene;
            app.stage.addChild(currentScene);

            // uiContainerを再配置
            // uiContainerを削除
            app.stage.removeChild(uiContainer);
            // uiContainerを追加
            app.stage.addChild(uiContainer);

            // 新しいシーンをスライドイン
            slideIn(currentScene, 500, 'right');

            // スライドインのアニメーション後に次のシーンを表示
            setTimeout(() => {
                startFlg = true;        // 振り子を開始
                isResetting = false;  // シーンリセット完了
                mes_clear.alpha = 1;
                mes_clear.y = -180;
            }, 500);
        }, 500);

    }

    // シーンをスライドインさせる関数
    function slideIn(scene, duration, direction = 'left') {
        let startX = direction === 'left' ? -app.screen.width : app.screen.width;
        scene.x = startX;

        let step = (Math.abs(startX) / duration) * 16;  // 16msごとに更新

        function update() {
            scene.x += direction === 'left' ? step : -step;

            if (direction === 'left' && scene.x >= 0 || direction === 'right' && scene.x <= 0) {
                scene.x = 0;
            } else {
                requestAnimationFrame(update);
            }
        }

        update();
    }

    // シーンをスライドアウトさせる関数
    function slideOut(scene, duration, direction = 'left') {
        let endX = direction === 'left' ? -app.screen.width : app.screen.width;
        let step = (Math.abs(scene.x - endX) / duration) * 16;  // 16msごとに更新

        function update() {
            scene.x += direction === 'left' ? -step : step;

            if (direction === 'left' && scene.x <= endX || direction === 'right' && scene.x >= endX) {
                scene.x = endX;
            } else {
                requestAnimationFrame(update);
            }
        }

        update();
    }


    function resetScene() {
        isResetting = true;  // リセット開始

        app.stage.removeChildren(); // すべての小要素削除
        app.ticker.remove(); // すべてのコールバック関数削除
        currentScene = createMainScene(); // ゲームシーンを生成する

        // リセット処理が完了したら、フラグをリセット
        setTimeout(() => {
            isResetting = false;  // シーンリセット完了
        }, 1000);  // 1秒待ってからフラグをリセット（処理が完了したタイミングに応じて調整）
    }

    // 魔王さま動き用
    let rapidx = 1;
    let rapidy = 0;
    let activey = 2;
    let scaley = 16;

    // 主人公動き用
    const timing = 10;
    let timer = 0;

    // 振り子の運動を更新
    app.ticker.add((delta) => { //delta:現在のフレームが前回のフレームから何秒経過したかを示す値
        // 準備完了するまで動かさない
        if (!startFlg) return;

        // 倒されるまでの動き
        if (!winflg) {
            // 魔王さま動き
            // x軸
            mao.x += rapidx;
            if (mao.x + 32 >= app.screen.width || mao.x - 32 <= 0) {
                rapidx *= -1;
            }
            // y軸
            mao.y = maoiy + scaley * Math.sin(rapidy * Math.PI / 180);
            if (rapidy >= 360) {
                rapidy = 0;
            } else {
                rapidy += activey;
            }
        }

        // 主人公動き
        timer += 1;
        if (Math.floor(timer / timing) === 0) {
            sprite.texture = textureArray[0];      // スプライトに表示するフレーム番号を変更
        } else if (Math.floor(timer / timing) === 1) {
            sprite.texture = textureArray[1];      // スプライトに表示するフレーム番号を変更
        } else if (Math.floor(timer / timing) === 2) {
            sprite.texture = textureArray[2];      // スプライトに表示するフレーム番号を変更
        } else if (Math.floor(timer / timing) === 3) {
            sprite.texture = textureArray[3];      // スプライトに表示するフレーム番号を変更
        } else {
            timer = 0;
        }

        // 角加速度の計算
        angleAcceleration = -gravity * Math.sin(angle); // 振り子の動きの加速度

        // 角速度と角度を更新
        angleVelocity += angleAcceleration; // 角速度を更新
        if (angleVelocity > maxSpeed) {
            angleVelocity = maxSpeed;
        }
        //angleVelocity *= damping; // 減衰を適用（摩擦）
        angle += angleVelocity; // 角度を更新

        //dtext.text = `angle:${angle}`

        // スプライトの位置を更新
        sprite.x = app.screen.width / 2 + r * -Math.sin(angle); // x座標
        if (controllY + r > charamaxy) {
            controllY = charamaxy - r;
        } else if (controllY + r < charaminy) {
            controllY = charaminy - r;
        }
        sprite.y = controllY + r * Math.cos(angle); // y座標


        // スプライトの角度を振り子の角度に合わせて回転
        sprite.rotation = angle; // 角度をスプライトの回転に反映

        // 直線の描画位置を振り子の位置に合わせて更新
        line.clear(); // 以前の直線を消去
        line.lineStyle(2, 0x000000, 1); // 白い線を描く
        line.moveTo(app.screen.width / 2, controllY); // 直線の始点（画面の中央）
        line.lineTo(app.screen.width / 2 + (r - 32) * -Math.sin(angle), controllY + (r - 32) * Math.cos(angle)); // 直線の終点（スプライトの位置）

        bossScene.addChild(line);

        //汚れ衝突判定
        checkYogoreCollision(sprite, 50);


    });

    return bossScene;

}


// クリアシーン
function createClearScene() {
    // クリアシーン作成
    const clearScene = new PIXI.Container();

    // 表彰状の枠を描く
    const frame = new PIXI.Graphics();
    frame.lineStyle(10, 0xe0ce92, 1); // 枠の色と太さ
    frame.beginFill(0xfff0e0, 1); // 白い背景（透明度80%）
    frame.drawRect(30, 50, 300, 450); // 矩形を描く
    frame.endFill();
    clearScene.addChild(frame);

    // 装飾（下線）
    const frame_mini1 = new PIXI.Graphics();
    frame_mini1.beginFill(0x6e4b3d); // 色をリボンの色に設定
    frame_mini1.drawRect(0, 0, 140, 4); // 小さな長方形を描く
    frame_mini1.endFill();
    frame_mini1.x = app.screen.width / 3 - 10; // 画面中央に配置
    frame_mini1.y = 120;
    frame_mini1.alpha = 0.5
    clearScene.addChild(frame_mini1);

    // 表彰状のタイトル
    const titleText = new PIXI.Text('表彰状', {
        fontFamily: 'Arial',
        fontSize: 38,
        fill: 0xe0ce92, // 枠の色と合わせる
        align: 'center',
        fontWeight: 'bold',
        stroke: '0x3c2f2a',      // 枠線
        strokeThickness: 4,     // 枠線の太さ

    });
    titleText.x = app.screen.width / 2 - titleText.width / 2;
    titleText.y = 70;
    clearScene.addChild(titleText);

    // だいまおうさま
    const mao = PIXI.Sprite.from(textureArrayMao[1]); // 任意の画像URLに変更
    mao.anchor.set(0.5); // 画像の中心を基準に回転させる
    mao.scale.x = 4;
    mao.scale.y = 4;
    mao.x = app.screen.width / 2;         // 初期位置x
    mao.y = 255;        // 初期位置y
    mao.alpha = 0.3;      // 透明度
    clearScene.addChild(mao);

    // だいまおうさま反省用
    const gomenne = new PIXI.Sprite(hanseiImage);
    gomenne.anchor.set(0.5); // 画像の中心を基準に回転させる
    gomenne.scale.x = 4;
    gomenne.scale.y = 4;
    gomenne.x = mao.x;         // 初期位置x
    gomenne.y = mao.y;        // 初期位置y
    gomenne.alpha = 0.3;      // 透明度
    clearScene.addChild(gomenne);


    // 表彰理由
    const reasonText = new PIXI.Text('貴殿は大魔王フリカケールを\n見事に懲らしめました。', {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0x000000,
        align: 'center',
        stroke: '0xfff0e0',      // 枠線
        strokeThickness: 1,     // 枠線の太さ
        wordWrap: true,
        wordWrapWidth: 300
    });
    reasonText.x = app.screen.width / 2 - reasonText.width / 2;
    reasonText.y = 140;
    clearScene.addChild(reasonText);


    // 日付
    const today = new Date();
    const year = today.getFullYear();   // 年
    const month = today.getMonth() + 1; // 月（0から始まるため +1）
    const day = today.getDate();        // 日
    const dateStr = `${year}年${month}月${day}日`;
    const dateText = new PIXI.Text(dateStr, {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0x3c2f2a, // ダークブラウン
        align: 'right'
    });
    dateText.x = app.screen.width / 2 + 10;
    dateText.y = 460;
    clearScene.addChild(dateText);

    // 署名部分（サンプルとして簡単に作成）
    const scoretext = `総掃除数：${totalScore}`;
    const signatureText = new PIXI.Text(scoretext, {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0x000000, // ダークブラウン
        stroke: '0xfff0e0',      // 枠線
        strokeThickness: 1,     // 枠線の太さ

    });
    signatureText.x = 100;
    signatureText.y = 320;
    clearScene.addChild(signatureText);

    // タイトルに戻るボタン
    let Button_title = new ButtonWithText(app.view.width / 2 - 120, app.view.height - 155, 240, 50, 0x99cc99, 'タイトルにもどる', 24, 0xFFFFFF);

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
        currentScene = createMainScene();
        app.stage.addChild(currentScene);
        // UIの表示
        app.stage.addChild(uiContainer);
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
    //currentScene = scene;
}
