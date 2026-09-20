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
app.renderer.backgroundColor = 0xf5f5f5;        // 背景色の設定
//app.renderer.view.style.border = "2px dashed black";  // canvasを点線枠で囲う（確認用）

/** 
 * ゲーム全体で使用する変数の定義
 * (AallVar)
 */
let currentScene;               // 現在のシーン

// UI用のコンテナ（スコア表示やボタンなど）
let uiContainer = new PIXI.Container();

/** 
 * タイトルシーン
 * (Atitle)
 */
function createTitleScene() {
    // メインシーン作成
    const titleScene = new PIXI.Container();

    // 色別の果物リスト
    const redFruits = ['荻', 'OGI', 'おぎ', 'オギ'];
    const yellowFruits = ['萩', 'HAGI', 'はぎ', 'ハギ'];

    let gameover = false;
    let score = 0;
    let displayScore = 0;
    let scoreY = 0;
    let scoreLeft = 0;
    let scoreRight = 0;
    let y_deadline = app.screen.height - 92;
    let time = 0;
    let fallSpeed = 2;
    let activeWords = [];
    let wordSpawnInterval = 2000;
    let level = 1;
    let ogiBefore;
    let hagiBefore;
    let colorFlg = true;
    let clearCount = 0;

    // UIラベル
    const scoreText = new PIXI.Text('DEMO', { fill: 0x333333, fontSize: 40 });
    scoreText.position.set(10, 10);
    titleScene.addChild(scoreText);

    const introText1 = new PIXI.Text('TAP', { fill: 0x333333, fontSize: 25 });
    introText1.position.set(1, 0);
    introText1.position.set(app.screen.width - 68, 2);
    titleScene.addChild(introText1);
    const introText2 = new PIXI.Text('START', { fill: 0x333333, fontSize: 25 });
    introText2.position.set(1, 0);
    introText2.position.set(app.screen.width - 85, 25);
    titleScene.addChild(introText2);

    // カラフル用タイマー
    const maxTime = 10;      // 初期の最大タイマー秒数
    let currentMaxTime = maxTime;
    let currentTime = maxTime;
    const radius = 180;       // ゲージの半径

    // コンテナを用意
    const timerContainer = new PIXI.Container();
    timerContainer.x = app.screen.width / 2;
    timerContainer.y = app.screen.height / 2 - 50;
    titleScene.addChild(timerContainer);
    timerContainer.alpha = 1;


    // 背景（フルゲージの円）
    const bgCircle = new PIXI.Graphics();
    bgCircle.beginFill(0xdddddd);
    bgCircle.drawCircle(0, 0, radius);
    bgCircle.endFill();
    //timerContainer.addChild(bgCircle);

    // ゲージ本体
    const gauge = new PIXI.Graphics();
    timerContainer.addChild(gauge);
    gauge.beginFill(0xffffff);
    let progress = 1;
    //const startAngle = -Math.PI / 2;
    //const endAngle = startAngle + Math.PI * 2 * progress;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2;
    gauge.moveTo(0, 0); // 中心から
    gauge.arc(0, 0, radius, startAngle, endAngle); // 円弧を描く
    gauge.lineTo(0, 0); // 扇形にするため、中心に戻る
    gauge.endFill();

    // ゲージ描画関数
    function drawGauge(p) {
        gauge.clear();
        gauge.beginFill(0xffffff);
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * p;
        gauge.moveTo(0, 0);
        gauge.arc(0, 0, radius, startAngle, endAngle);
        gauge.lineTo(0, 0);
        gauge.endFill();
    }

    drawGauge(progress);

    // デッドライン把握用四角
    const rect_deadline = new PIXI.Graphics();
    rect_deadline.beginFill(0x000000);
    rect_deadline.drawRect(0, app.screen.height - 110, app.screen.width, 80);
    rect_deadline.endFill();
    titleScene.addChild(rect_deadline);
    rect_deadline.alpha = 0.5;

    // ドット線描画関数
    function drawDottedLine(graphics, x1, y1, x2, y2, dotRadius = 2, gapLength = 10) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dotCount = Math.floor(distance / (dotRadius * 2 + gapLength));
        const stepX = (dx / distance) * (dotRadius * 2 + gapLength);
        const stepY = (dy / distance) * (dotRadius * 2 + gapLength);

        let currentX = x1;
        let currentY = y1;

        for (let i = 0; i <= dotCount; i++) {
            graphics.beginFill(0xeeeeee); // 白色のドット
            graphics.drawCircle(currentX, currentY, dotRadius);
            graphics.endFill();
            currentX += stepX;
            currentY += stepY;
        }
    }
    const dottedLine1 = new PIXI.Graphics();
    const dottedLine2 = new PIXI.Graphics();
    const dottedLine3 = new PIXI.Graphics();
    // (スタートX, スタートY, 終了X, 終了Y, ドットの半径, ドット間の隙間)
    drawDottedLine(dottedLine1, 0, 90, app.screen.width, 80, 2, 5);
    drawDottedLine(dottedLine2, 0, 210, app.screen.width, 200, 2, 5);
    drawDottedLine(dottedLine3, 0, 330, app.screen.width, 320, 2, 5);
    titleScene.addChild(dottedLine1);
    titleScene.addChild(dottedLine2);
    titleScene.addChild(dottedLine3);


    // OGIYAHAGI
    const bgOYHcontainer = new PIXI.Container();
    const OYHTextO = new PIXI.Text('荻', { fill: 0xcc0000, fontSize: 124 });
    OYHTextO.position.set(5, 150);
    const OYHTextY = new PIXI.Text('や', { fill: 0x000000, fontSize: 100 });
    OYHTextY.position.set(130, 175);
    const OYHTextH = new PIXI.Text('萩', { fill: 0xccaa00, fontSize: 124 });
    OYHTextH.position.set(230, 150);
    titleScene.addChild(bgOYHcontainer);
    bgOYHcontainer.addChild(OYHTextO, OYHTextY, OYHTextH);
    bgOYHcontainer.y = 200;
    bgOYHcontainer.alpha = 0;

    // 背景用文字
    // 漢字おぎ
    const bgOKNcontainer = new PIXI.Container();
    const ogiTextKN = new PIXI.Text('荻', { fill: 0x000000, fontSize: 124 });
    ogiTextKN.position.set(5, 150);
    titleScene.addChild(bgOKNcontainer);
    bgOKNcontainer.addChild(ogiTextKN);
    bgOKNcontainer.alpha = 0.3;
    //bgOKNcontainer.y -= 400;

    // ひらがなおぎ
    const bgOHcontainer = new PIXI.Container();
    const ogiTextH1 = new PIXI.Text('お', { fill: 0x000000, fontSize: 124 });
    ogiTextH1.position.set(5, 85);
    const ogiTextH2 = new PIXI.Text('ぎ', { fill: 0x000000, fontSize: 124 });
    ogiTextH2.position.set(5, 225);
    titleScene.addChild(bgOHcontainer);
    bgOHcontainer.addChild(ogiTextH1, ogiTextH2);
    bgOHcontainer.alpha = 0.3;
    bgOHcontainer.y -= 400;

    // カタカナおぎ
    const bgOKTcontainer = new PIXI.Container();
    const ogiTextKT1 = new PIXI.Text('オ', { fill: 0x000000, fontSize: 124 });
    ogiTextKT1.position.set(5, 85);
    const ogiTextKT2 = new PIXI.Text('ギ', { fill: 0x000000, fontSize: 124 });
    ogiTextKT2.position.set(5, 225);
    titleScene.addChild(bgOKTcontainer);
    bgOKTcontainer.addChild(ogiTextKT1, ogiTextKT2);
    bgOKTcontainer.alpha = 0.3;
    bgOKTcontainer.y -= 400;

    //英字おぎ
    const bgOEcontainer = new PIXI.Container();
    const ogiTextE = new PIXI.Text('OGI', { fill: 0x000000, fontSize: 124 });
    ogiTextE.position.set(130, 110);
    ogiTextE.rotation = 3.14 / 2;
    titleScene.addChild(bgOEcontainer);
    bgOEcontainer.addChild(ogiTextE);
    bgOEcontainer.alpha = 0.3;
    bgOEcontainer.y -= 400;

    // や
    const bgYacontainer = new PIXI.Container();
    const yaText = new PIXI.Text('や', { fill: 0x000000, fontSize: 100 });
    yaText.position.set(130, 175);
    titleScene.addChild(bgYacontainer);
    bgYacontainer.addChild(yaText);
    bgYacontainer.alpha = 0.3;
    //bgYacontainer.y -= 400;   


    // 漢字はぎ
    const bgHKNcontainer = new PIXI.Container();
    const hagiTextKN = new PIXI.Text('萩', { fill: 0x000000, fontSize: 124 });
    hagiTextKN.position.set(230, 150);
    titleScene.addChild(bgHKNcontainer);
    bgHKNcontainer.addChild(hagiTextKN);
    bgHKNcontainer.alpha = 0.3;
    //hagiTextKN.y -= 400;

    // ひらがなはぎ
    const bgHHcontainer = new PIXI.Container();
    const hagiTextH1 = new PIXI.Text('は', { fill: 0x000000, fontSize: 124 });
    hagiTextH1.position.set(230, 85);
    const hagiTextH2 = new PIXI.Text('ぎ', { fill: 0x000000, fontSize: 124 });
    hagiTextH2.position.set(230, 225);
    titleScene.addChild(bgHHcontainer);
    bgHHcontainer.addChild(hagiTextH1, hagiTextH2);
    bgHHcontainer.alpha = 0.3;
    bgHHcontainer.y -= 400;

    // カタカナはぎ
    const bgHKTcontainer = new PIXI.Container();
    const hagiTextKT1 = new PIXI.Text('ハ', { fill: 0x000000, fontSize: 124 });
    hagiTextKT1.position.set(230, 85);
    const hagiTextKT2 = new PIXI.Text('ギ', { fill: 0x000000, fontSize: 124 });
    hagiTextKT2.position.set(230, 225);
    titleScene.addChild(bgHKTcontainer);
    bgHKTcontainer.addChild(hagiTextKT1, hagiTextKT2);
    bgHKTcontainer.alpha = 0.3;
    bgHKTcontainer.y -= 400;

    //英字はぎ
    const bgHEcontainer = new PIXI.Container();
    const hagiTextE = new PIXI.Text('HAGI', { fill: 0x000000, fontSize: 124 });
    hagiTextE.position.set(360, 80);
    hagiTextE.rotation = 3.14 / 2;
    titleScene.addChild(bgHEcontainer);
    bgHEcontainer.addChild(hagiTextE);
    bgHEcontainer.alpha = 0.3;
    bgHEcontainer.y -= 400;

    ogiBefore = bgOKNcontainer;
    hagiBefore = bgHKNcontainer;

    // 左右ボタン
    const leftButton = createButton('OGI', 65, app.screen.height - 75);
    const rightButton = createButton('HAGI', app.screen.width - 65, app.screen.height - 75);
    // おぎやはぎボタン
    const ohcontainer = new PIXI.Container();
    const ohbg = new PIXI.Graphics();
    ohbg.beginFill(0xffffff);
    ohbg.drawRoundedRect(-45, -30, 90, 70, 30);
    ohbg.endFill();
    const ytext = new PIXI.Text('YA', {
        fill: 0x333333, fontSize: 40,
        fontWeight: 'bold',
    });
    ytext.anchor.set(0.5);
    ytext.y += 5;
    ytext.alpha = 1.0;
    const otext = new PIXI.Text('OGI', {
        fill: 0xff2222, fontSize: 26,
        fontWeight: 'bold',
    });
    otext.anchor.set(0.5);
    otext.y -= 10;
    otext.alpha = 1;
    const htext = new PIXI.Text('HAGI', {
        fill: 0xffcc00, fontSize: 26,
        fontWeight: 'bold',
    });
    htext.anchor.set(0.5);
    htext.y += 20;
    htext.alpha = 1;
    ohcontainer.addChild(ohbg, otext, htext, ytext);
    ohcontainer.position.set(app.screen.width / 2, app.screen.height - 75);
    const centerButton = ohcontainer;

    titleScene.addChild(leftButton, rightButton, centerButton);

    // 画面遷移時の背景薄黒
    const darkOverlay = new PIXI.Graphics();
    darkOverlay.beginFill(0x000000, 1.0);
    darkOverlay.drawRect(0, 0, app.screen.width, app.screen.height);
    darkOverlay.endFill();
    darkOverlay.alpha = 1;
    uiContainer.addChild(darkOverlay);

    ogiTextKN.style.fill = '0xcc0000';
    hagiTextKN.style.fill = '0xbb9900';

    // ワード生成関数
    function demoSpawnWord(word, color) {
        const text = new PIXI.Text(word, {
            fontSize: 36,
            fill: color === 'red' ? 0xcc0000 : 0xccaa00,
            //fill: 0x000000,
            stroke: '#ffffff',
            strokeThickness: 4
        });
        text.anchor.set(0.5);
        text.x = app.screen.width / 2;
        text.y = -50;
        text.fruitColor = color;
        text.word = word;
        return text;
    }

    const demoText1 = demoSpawnWord('荻', 'red');
    titleScene.addChild(demoText1);
    demoText1.alpha = 0;

    const demoText2 = demoSpawnWord('萩', 'yellow');
    titleScene.addChild(demoText2);
    demoText2.alpha = 0;

    const demoText3 = demoSpawnWord('おぎ', 'red');
    titleScene.addChild(demoText3);
    demoText3.alpha = 0;

    const demoText4 = demoSpawnWord('はぎ', 'yellow');
    titleScene.addChild(demoText4);
    demoText4.alpha = 0;
    demoText4.y -= 80;

    const demoText5 = demoSpawnWord('ハギ', 'yellow');
    titleScene.addChild(demoText5);
    demoText5.alpha = 0;

    const demoText6 = demoSpawnWord('オギ', 'red');
    titleScene.addChild(demoText6);
    demoText6.alpha = 0;
    demoText6.y -= 80;

    const demoText7 = demoSpawnWord('OGI', 'red');
    titleScene.addChild(demoText7);
    demoText7.alpha = 0;

    const demoText8 = demoSpawnWord('HAGI', 'yellow');
    titleScene.addChild(demoText8);
    demoText8.alpha = 0;
    demoText8.y -= 80;

    const demoText9 = demoSpawnWord('おぎ', 'red');
    titleScene.addChild(demoText9);
    demoText9.alpha = 0;

    const demoText10 = demoSpawnWord('ハギ', 'yellow');
    titleScene.addChild(demoText10);
    demoText10.alpha = 0;

    // DEMOの点滅
    const demo1 = gsap.to(scoreText, {
        alpha: 0.1,
        duration: 1.4,
        yoyo: true,
        ease: 'power1.inOut',
        repeat: -1
    })

    // DEMOの点滅
    const demo2 = gsap.to(introText1, {
        alpha: 0.1,
        duration: 1.4,
        yoyo: true,
        ease: 'power1.inOut',
        repeat: -1
    })
    // DEMOの点滅
    const demo3 = gsap.to(introText2, {
        alpha: 0.1,
        duration: 1.4,
        yoyo: true,
        ease: 'power1.inOut',
        repeat: -1
    })

    // COMBOテキスト
    const comboText = new PIXI.Text('COMBO x9', {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0xffffff,
        stroke: 0x000000,
        strokeThickness: 3
    });
    comboText.anchor.set(1, 1);
    comboText.position.set(app.screen.width - 20, app.screen.height / 2 + 20);
    titleScene.addChild(comboText);
    comboText.alpha = 0;

    // --- BONUSテキスト ---
    const bonusText = new PIXI.Text('BONUS!!', {
        fontFamily: 'Impact',
        fontSize: 48,
        fill: 0xff4444,
        stroke: 0xffffff,
        strokeThickness: 5
    });
    bonusText.anchor.set(0.5);
    bonusText.position.set(app.screen.width - 60, app.screen.height - 120);
    bonusText.visible = false;
    titleScene.addChild(bonusText);

    // --- パーティクル生成関数 ---
    function createMiniParticles(x, y) {
        for (let i = 0; i < 30; i++) {
            const miniparticle = new PIXI.Graphics();
            miniparticle.beginFill(0xeeee66 + Math.random() * 0x111111);
            miniparticle.drawCircle(0, 0, 2);
            miniparticle.endFill();
            miniparticle.x = x - 40;
            miniparticle.y = y - 40;
            titleScene.addChild(miniparticle);

            const angle = Math.random() * Math.PI * 2;
            const speed = 5 + Math.random() * 5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            gsap.to(miniparticle, {
                x: miniparticle.x + vx * 10,
                y: miniparticle.y + vy * 10,
                alpha: 0,
                rotation: Math.random() * Math.PI,
                duration: 0.8,
                ease: "power2.out",
                onComplete: () => titleScene.removeChild(miniparticle)
            });
        }
    }

    // --- コンボ加算関数 ---
    function addCombo(flg) {
        if (flg) {
            comboText.text = `COMBO x10`;
        } else {
            comboText.text = `COMBO x11`;
        }
        //comboText.alpha = 1;
        comboText.rotation = 0;

        const tl = gsap.timeline();
        comboText.x = app.screen.width - 20;

        if (flg) {
            //addTime(3);
            //comboText.style.fill = 0xffd700;

            // 揺れ・点滅・回転
            tl.to(comboText, { x: comboText.x + 10, duration: 0.05 })
                .to(comboText, { x: comboText.x - 20, duration: 0.05 })
                .to(comboText, { x: comboText.x + 10, duration: 0.05 })
                .to(comboText, { rotation: 0.1, alpha: 0.5, duration: 0.1, repeat: 2, yoyo: true })
                .to(comboText, { rotation: 0, alpha: 1, duration: 0.1 });

            // BONUS文字表示
            bonusText.visible = true;
            bonusText.alpha = 1;
            bonusText.y = app.screen.height / 2;
            gsap.to(bonusText, {
                y: bonusText.y - 30,
                alpha: 0,
                duration: 1.0,
                ease: "power1.out",
                onComplete: () => bonusText.visible = false
            });

            // パーティクル発生
            createMiniParticles(comboText.x, comboText.y);
        } else {
            // 通常演出：ちょっとだけ上下揺れ
            //comboText.style.fill = 0xffffff;
            tl.to(comboText, { y: comboText.y - 10, duration: 0.1 })
                .to(comboText, { y: comboText.y, duration: 0.1 });
        }
        comboText.x = app.screen.width - 20;

    }

    // メッセージ用吹き出し
    const demoMessageArea = new PIXI.Graphics();
    demoMessageArea.lineStyle(2, 0x000000, 1);    // 線スタイル（ふちの太さ, 色, 透明度）
    demoMessageArea.beginFill(0xFFFFFF);    // 塗りつぶし（白）
    demoMessageArea.drawRoundedRect(15, 300, 330, 120, 10);    // 丸い四角形を描く (x, y, width, height, cornerRadius)
    demoMessageArea.endFill();
    titleScene.addChild(demoMessageArea);
    demoMessageArea.alpha = 0;

    let currentTimeline = 0;

    // デモメッセージ定義
    const demoMessageHead = new PIXI.Text('＜遊び方(1/6)＞', {
        fill: 0x000000, fontSize: 18,
    });
    demoMessageHead.x = 50;
    demoMessageHead.y = 307;
    titleScene.addChild(demoMessageHead);
    demoMessageHead.alpha = 0;

    const demoMessageL1 = new PIXI.Text('１２３４５６７８９０１２３４５６７８', {
        fill: 0x000000, fontSize: 18,
    });
    demoMessageL1.x = 50;
    demoMessageL1.y = 335;
    titleScene.addChild(demoMessageL1);
    demoMessageL1.alpha = 0;

    const demoMessageL2 = new PIXI.Text('１２３４５６７８９０１２３４５６７８', {
        fill: 0x000000, fontSize: 18,
    });
    demoMessageL2.x = 50;
    demoMessageL2.y = 360;
    titleScene.addChild(demoMessageL2);
    demoMessageL2.alpha = 0;

    const demoMessageL3 = new PIXI.Text('１２３４５６７８９０１２３４５６７８', {
        fill: 0x000000, fontSize: 18,
    });
    demoMessageL3.x = 50;
    demoMessageL3.y = 385;
    titleScene.addChild(demoMessageL3);
    demoMessageL3.alpha = 0;

    // 各要素の位置や透明度を初期化
    function resetTimeline() {
        demoText1.alpha = 0;
        demoText1.x = app.screen.width / 2;
        demoText1.y = -50;
        demoText1.style.fill = '0xcc0000';
        demoText2.alpha = 0;
        demoText2.x = app.screen.width / 2;
        demoText2.y = -50;
        demoText2.style.fill = '0xbb9900';
        demoText3.alpha = 0;
        demoText3.x = app.screen.width / 2;
        demoText3.y = -50;
        demoText3.style.fill = '0xcc0000';
        demoText4.alpha = 0;
        demoText4.x = app.screen.width / 2;
        demoText4.y = -130;
        demoText4.style.fill = '0xbb9900';
        demoText5.alpha = 0;
        demoText5.x = app.screen.width / 2;
        demoText5.y = -50;
        demoText5.style.fill = '0xcc0000';
        demoText6.alpha = 0;
        demoText6.x = app.screen.width / 2;
        demoText6.y = -130;
        demoText6.style.fill = '0xbb9900';
        demoText7.alpha = 0;
        demoText7.x = app.screen.width / 2;
        demoText7.y = -50;
        demoText7.style.fill = '0xcc0000';
        demoText8.alpha = 0;
        demoText8.x = app.screen.width / 2;
        demoText8.y = -130;
        demoText8.style.fill = '0xbb9900';
        demoText9.alpha = 0;
        demoText9.x = app.screen.width / 2;
        demoText9.y = -50;
        demoText9.style.fill = '0xcc0000';
        demoText10.alpha = 0;
        demoText10.x = app.screen.width / 2;
        demoText10.y = -50;
        demoText10.style.fill = '0xbb9900';

        demoMessageHead.alpha = 0;
        demoMessageL1.alpha = 0;
        demoMessageL2.alpha = 0;
        demoMessageL3.alpha = 0;

        darkOverlay.alpha = 0;

        clearCount = 9;
        comboText.alpha = 0;
        comboText.text = `COMBO x${clearCount}`;

        ogiTextKN.style.fill = '0xcc0000';
        hagiTextKN.style.fill = '0xbb9900';
        demoText7.style.fill = '0xcc0000';
        demoText8.style.fill = '0xbb9900';
        otext.style.fill = '0xff2200';
        htext.style.fill = '0xffcc00';
        changeButtonColor(ohcontainer, '0xffffff', 0);
        changeButtonColor(leftButton, '0xff2222');
        changeButtonColor(rightButton, '0xffcc00');
        ohcontainer.scale.set(1.0);
        rightButton.scale.set(1.0);
        leftButton.scale.set(1.0);
        drawGauge(1);
    }

    // 各チャプター用のアニメーションを個別のタイムラインとして定義
    function createTimeline1() {
        resetTimeline();
        const tl = gsap.timeline();
        tl.call(() => {
            currentTimeline = 0;
            demoMessageHead.text = `＜遊び方(1/6)＞`;
            demoMessageL1.text = `「おぎ」と読む言葉が来たら、`;
            demoMessageL2.text = `「OGI」ボタンを押そう！`;
            demoMessageL3.text = ``;
        })
            .to(darkOverlay, { alpha: 0, duration: 0.5 })
            .to(demoMessageArea, { delay: 0.4, alpha: 1, duration: 0.8 }, '<')
            .to(demoMessageHead, { alpha: 1, duration: 0.8 }, '<')
            .to(demoMessageL1, { alpha: 1, duration: 0.7 }, '<')
            .to(demoMessageL2, { alpha: 1, duration: 0.7 }, '<')
            .to(demoMessageL3, { alpha: 1, duration: 0.7 }, '<')
            .to(demoText1, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText1, { y: demoText1.y + 280, duration: 2.0 }, '<-0.05')
            .to(leftButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            .to(leftButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            .to(demoText1, {
                x: demoText1.x - 150,
                alpha: 0,
                duration: 0.2,
            })
            .call(() => {
                createParticles(demoText1.x + 5, demoText1.y);
                showScoreLabelWithEffect(demoText1.x + 30, demoText1.y, 6);
            })
            .to(demoMessageHead, { delay: 0.7, alpha: 0, duration: 0.6 })
            .to(demoMessageL1, { alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 0, duration: 0.6 }, '<')
            ;
        return tl;
    }
    function createTimeline2() {
        resetTimeline();
        const tl = gsap.timeline();
        tl.call(() => {
            currentTimeline = 1;
            demoMessageHead.text = `＜遊び方(2/6)＞`;
            demoMessageL1.text = `「はぎ」と読む言葉が来たら、`;
            demoMessageL2.text = `「HAGI」ボタンを押そう！`;
            demoMessageL3.text = ``;
        })
            .to(demoMessageHead, { alpha: 1, duration: 0.6 })
            .to(demoMessageL1, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 1, duration: 0.6 }, '<')
            .to(demoText2, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText2, { y: demoText2.y + 230, duration: 1.7 })
            .to(rightButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            .to(rightButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            .to(demoText2, {
                x: demoText2.x + 150,
                alpha: 0,
                duration: 0.2,
            })
            .call(() => {
                createParticles(demoText2.x + 5, demoText2.y);
                showScoreLabelWithEffect(demoText2.x - 30, demoText2.y, 8);
            })
            .to(demoMessageHead, { delay: 0.7, alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL1, { alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 0, duration: 0.6 }, '<')
            ;
        return tl;
    }
    function createTimeline3() {
        resetTimeline();
        const tl = gsap.timeline();
        tl.call(() => {
            currentTimeline = 2;
            demoMessageHead.text = `＜遊び方(3/6)＞`;
            demoMessageL1.text = `「おぎ」「はぎ」と来たら、`;
            demoMessageL2.text = `「OGIYAHAGI」ボタン！`;
            demoMessageL3.text = `  まとめて消せて高得点だ！`;
        })
            .to(demoMessageHead, { alpha: 1, duration: 0.6 })
            .to(demoMessageL1, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 1, duration: 0.6 }, '<')
            .to(demoText3, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText4, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText3, { y: demoText3.y + 300, duration: 1.8 })
            .to(demoText4, { y: demoText4.y + 300, duration: 1.8 }, '<')
            //.to(leftButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            .to(ohcontainer.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            //.to(rightButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" },'<')
            //.to(leftButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            .to(ohcontainer.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            //.to(rightButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" },'<')
            .to(demoText3, {
                x: demoText3.x - 150,
                alpha: 0,
                duration: 0.2,
            })
            .to(demoText4, {
                x: demoText4.x + 150,
                alpha: 0,
                duration: 0.2,
            }, '<')
            .call(() => {
                createParticles(demoText3.x + 5, demoText3.y);
                showScoreLabelWithEffect(demoText3.x + 40, demoText3.y, 10);
                createParticles(demoText4.x - 5, demoText4.y);
                showScoreLabelWithEffect(demoText4.x - 40, demoText4.y, 10);
            })
            .to(demoMessageHead, { delay: 0.7, alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL1, { alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 0, duration: 0.6 }, '<')
            ;
        return tl;
    }
    function createTimeline4() {
        resetTimeline();
        const tl = gsap.timeline();
        tl.call(() => {
            currentTimeline = 3;
            demoMessageHead.text = `＜遊び方(4/6)＞`;
            demoMessageL1.text = `「はぎ」「おぎ」と来たら、`;
            demoMessageL2.text = `「OGIYAHAGI」は使えない。`;
            demoMessageL3.text = `  順番に気を付けて！`;
        })
            .to(demoMessageHead, { alpha: 1, duration: 0.6 })
            .to(demoMessageL1, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 1, duration: 0.6 }, '<')
            .to(demoText5, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText6, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText5, { y: demoText5.y + 300, duration: 1.7 })
            .to(demoText6, { y: demoText6.y + 300, duration: 1.7 }, '<')
            //.to(leftButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            .to(ohcontainer.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            //.to(rightButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" },'<')
            //.to(leftButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            .to(ohcontainer.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            //.to(rightButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" },'<')
            .to(demoText5, {
                x: demoText5.x - 140,
                duration: 0.2,
            })
            .to(demoText6, {
                x: demoText6.x + 140,
                duration: 0.2,
            }, '<')
            .to(demoText5, { // 震える
                x: demoText5.x - 132,
                duration: 0.05,
                ease: 'power1.inOut'
            })
            .to(demoText6, {
                x: demoText6.x + 148,
                duration: 0.05,
                ease: 'power1.inOut'
            }, '<')
            .to(demoText5, {
                x: demoText5.x - 148,
                duration: 0.05,
                ease: 'power1.inOut'
            })
            .to(demoText6, {
                x: demoText6.x + 132,
                duration: 0.05,
                ease: 'power1.inOut'
            }, '<')
            .to(demoText5, {
                x: demoText5.x - 132,
                duration: 0.05,
                ease: 'power1.inOut'
            })
            .to(demoText6, {
                x: demoText6.x + 148,
                duration: 0.05,
                ease: 'power1.inOut'
            }, '<')
            .to(demoText5, {
                x: demoText5.x - 148,
                duration: 0.05,
                ease: 'power1.inOut'
            })
            .to(demoText6, {
                x: demoText6.x + 132,
                duration: 0.05,
                ease: 'power1.inOut'
            }, '<')
            .to(demoText5, {
                x: demoText5.x - 132,
                duration: 0.05,
                ease: 'power1.inOut'
            })
            .to(demoText6, {
                x: demoText6.x + 148,
                duration: 0.05,
                ease: 'power1.inOut'
            }, '<')
            .to(demoText5, {
                x: demoText5.x - 140,
                duration: 0.05,
                ease: 'power1.inOut'
            })
            .to(demoText6, {
                x: demoText6.x + 140,
                duration: 0.05,
                ease: 'power1.inOut'
            }, '<')
            .to(demoText5, {
                alpha: 0,
                duration: 0.5,
            })
            .to(demoText6, {
                alpha: 0,
                duration: 0.5,
            }, '<')
            .to(demoMessageHead, { alpha: 0, duration: 0.8 }, '<')
            .to(demoMessageL1, { alpha: 0, duration: 0.8 }, '<')
            .to(demoMessageL2, { alpha: 0, duration: 0.8 }, '<')
            .to(demoMessageL3, { alpha: 0, duration: 0.8 }, '<')
            ;
        return tl;
    }
    function createTimeline5() {
        resetTimeline();
        const tl = gsap.timeline();
        tl.call(() => {
            currentTimeline = 4;
            demoMessageHead.text = `＜遊び方(5/6)＞`;
            demoMessageL1.text = `  言葉の色は時間で変わる。`;
            demoMessageL2.text = ` 「OGIYAHAGI」に成功すると`;
            demoMessageL3.text = `  一時的に色が付くぞ！ `;
        })
            .to(demoMessageHead, { alpha: 1, duration: 0.6 })
            .to(demoMessageL1, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 1, duration: 0.6 }, '<')
            .to(demoText7, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText8, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText7, { y: demoText7.y + 300, duration: 1.7 })
            .to(demoText8, { y: demoText8.y + 300, duration: 1.7 }, '<')
            .to({ val: 1 }, {
                val: 0,
                duration: 1.2,
                ease: "linear",
                onUpdate: function () {
                    progress = this.targets()[0].val;
                    drawGauge(progress);
                },
                onComplete: function () {
                    ogiTextKN.style.fill = '0x000000';
                    hagiTextKN.style.fill = '0x000000';
                    demoText7.style.fill = '0x000000';
                    demoText8.style.fill = '0x000000';
                    otext.style.fill = '0xffffff';
                    htext.style.fill = '0xffffff';
                    changeButtonColor(ohcontainer, '0xdddddd', 0);
                    changeButtonColor(leftButton, '0xdddddd');
                    changeButtonColor(rightButton, '0xdddddd');
                }
            }, '<')
            //.to(leftButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            .to(ohcontainer.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            //.to(rightButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" },'<')
            //.to(leftButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            .to(ohcontainer.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            //.to(rightButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" },'<')
            .to(demoText7, {
                x: demoText7.x - 150,
                alpha: 0,
                duration: 0.2,
            })
            .to(demoText8, {
                x: demoText8.x + 150,
                alpha: 0,
                duration: 0.2,
            }, '<')
            .call(() => {
                createParticles(demoText7.x + 5, demoText7.y);
                showScoreLabelWithEffect(demoText7.x + 40, demoText7.y, 10);
                createParticles(demoText8.x - 5, demoText8.y);
                showScoreLabelWithEffect(demoText8.x - 40, demoText8.y, 10);
            })
            .call(() => {
                showTimeExtendedText();
                ogiTextKN.style.fill = '0xcc0000';
                hagiTextKN.style.fill = '0xbb9900';
                demoText7.style.fill = '0xcc0000';
                demoText8.style.fill = '0xbb9900';
                otext.style.fill = '0xff2200';
                htext.style.fill = '0xffcc00';
                changeButtonColor(ohcontainer, '0xffffff', 0);
                changeButtonColor(leftButton, '0xff2222');
                changeButtonColor(rightButton, '0xffcc00');
                drawGauge(1);
            })
            .to({ val: 1 }, {
                val: 0,
                duration: 1.5,
                ease: "linear",
                onUpdate: function () {
                    progress = this.targets()[0].val;
                    drawGauge(progress);
                },
                onComplete: function () {
                    ogiTextKN.style.fill = '0x000000';
                    hagiTextKN.style.fill = '0x000000';
                    demoText9.style.fill = '0x000000';
                    otext.style.fill = '0xffffff';
                    htext.style.fill = '0xffffff';
                    changeButtonColor(ohcontainer, '0xdddddd', 0);
                    changeButtonColor(leftButton, '0xdddddd');
                    changeButtonColor(rightButton, '0xdddddd');
                }
            }, '<')
            .to(demoMessageHead, { delay: 1.0, alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL1, { alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 0, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 0, duration: 0.6 }, '<')
            ;
        return tl;
    }
    function createTimeline6() {
        clearCount = 9;
        resetTimeline();
        const tl = gsap.timeline();
        tl.call(() => {
            currentTimeline = 5;
            demoMessageHead.text = `＜遊び方(6/6)＞`;
            demoMessageL1.text = `  10コンボでも色が付く！`;
            demoMessageL2.text = `  高得点のチャンスだ！`;
            demoMessageL3.text = ` `;
        })
            .to(demoMessageHead, { alpha: 1, duration: 0.6 })
            .to(demoMessageL1, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 1, duration: 0.6 }, '<')
            .to(comboText, { alpha: 1, duration: 0.8 }, '<')
            .to(demoText9, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText9, { y: demoText9.y + 200, duration: 1.0 })
            .to(leftButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            .to(leftButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            .to(demoText9, {
                x: demoText9.x - 150,
                alpha: 0,
                duration: 0.2,
            })
            .call(() => {
                createParticles(demoText9.x + 5, demoText9.y);
                showScoreLabelWithEffect(demoText9.x + 30, demoText9.y, 8);
                clearCount++;
                addCombo(true);
                ogiTextKN.style.fill = '0xcc0000';
                hagiTextKN.style.fill = '0xbb9900';
                demoText9.style.fill = '0xcc0000';
                demoText10.style.fill = '0xbb9900';
                otext.style.fill = '0xff2200';
                htext.style.fill = '0xffcc00';
                changeButtonColor(ohcontainer, '0xffffff', 0);
                changeButtonColor(leftButton, '0xff2222');
                changeButtonColor(rightButton, '0xffcc00');
                drawGauge(1);
            })
            .to(demoMessageHead, { delay: 1.0, alpha: 0, duration: 0.5 }, '<')
            .to(demoMessageL1, { alpha: 0, duration: 0.5 }, '<')
            .to(demoMessageL2, { alpha: 0, duration: 0.5 }, '<')
            .to(demoMessageL3, { alpha: 0, duration: 0.5 }, '<')

        return tl;
    }
    function createTimeline7() {
        clearCount = 10;
        resetTimeline();
        const tl = gsap.timeline();
        tl.call(() => {
            currentTimeline = 6;
            demoMessageHead.text = `＜遊び方＞`;
            demoMessageL1.text = `  説明はおわり。`;
            demoMessageL2.text = `  タップして始めよう！`;
            demoMessageL3.text = `  `;
        })
            .to(demoMessageHead, { alpha: 1, duration: 0.6 })
            .to(demoMessageL1, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL2, { alpha: 1, duration: 0.6 }, '<')
            .to(demoMessageL3, { alpha: 1, duration: 0.6 }, '<')
            .to(demoText10, { alpha: 1, duration: 0.5 }, '<')
            .to(demoText10, { y: demoText9.y + 200, duration: 1.0 })
            .to(rightButton.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: "back.out(0.5)" })
            .to(rightButton.scale, { x: 1.0, y: 1.0, duration: 0.3, ease: "back.in(0.5)" })
            .to(demoText10, {
                x: demoText10.x + 150,
                alpha: 0,
                duration: 0.2,
            })
            .call(() => {
                clearCount++;
                addCombo(false);
                createParticles(demoText10.x + 5, demoText10.y);
                showScoreLabelWithEffect(demoText10.x - 30, demoText10.y, 8);
            })
            .to(darkOverlay, { delay: 1.0, alpha: 1, duration: 0.5 })
            ;

        return tl;
    }
    // タイムライン一覧
    const timelines = [createTimeline1, createTimeline2, createTimeline3, createTimeline4, createTimeline5, createTimeline6, createTimeline7];

    let currentLoopTimeline = null;

    // ループ再生を開始
    function startLoop(fromIndex) {
        if (currentLoopTimeline) currentLoopTimeline.kill(); // 既存を停止

        currentLoopTimeline = gsap.timeline({ repeat: -1 });

        // ループ順に並べ替え
        const ordered = [];
        for (let i = 0; i < 7; i++) {
            const index = (fromIndex + i) % 7;
            ordered.push(timelines[index]());
        }

        // 全てのタイムラインをメインに追加
        ordered.forEach(tl => currentLoopTimeline.add(tl));
    }

    startLoop(0);

    // キラキラ演出
    function createParticles(x, y) {
        for (let i = 0; i < 15; i++) {
            const star = new PIXI.Text('★', { fill: 0x999999 });
            star.anchor.set(0.5);
            star.x = x;
            star.y = y;
            titleScene.addChild(star);
            gsap.to(star, {
                x: x + (Math.random() - 0.5) * 100,
                y: y + (Math.random() - 0.5) * 100,
                alpha: 0,
                duration: 1,
                onComplete: () => titleScene.removeChild(star)
            });
        }
    }

    function showScoreLabelWithEffect(x, y, amount) {
        //amount=10;
        let label = '';
        let color = '#ffffff';
        let effect = 'normal';

        if (amount >= 9) {
            label = 'PERFECT!';
            color = '#ffff66';
            effect = 'round';
        } else if (amount >= 8) {
            label = 'GREAT!';
            color = '#ffcc00';
            effect = 'jump';
        } else if (amount >= 6) {
            label = 'NICE!';
            color = '#99ccff';
            effect = 'pop';
        } else {
            label = 'SAFE';
            color = '#00ff99';
            effect = 'wobble';
        }

        const container = new PIXI.Container();
        const labelText = new PIXI.Text(label, {
            fontSize: 32,
            fill: color,
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        });
        labelText.anchor.set(0.5);
        container.addChild(labelText);
        container.x = x;
        container.y = y - 30;
        container.alpha = 0;
        container.scale.set(0.8);

        titleScene.addChild(container);

        // GSAPアニメーション
        gsap.to(container, {
            duration: 0.1,
            alpha: 1,
            ease: "back.out(2)"
        });

        let timeline2 = gsap.timeline();

        if (effect === 'round') {
            timeline2.to(container, {
                duration: 0.2,
                rotation: Math.PI * 2,
                ease: "sine.inOut",
            });
        } else if (effect === 'jump') {
            timeline2.to(container, {
                duration: 0.1,
                //x: container.x+5,
                y: container.y - 15,
                ease: "power1.out"
            }).to(container, {
                duration: 0.1,
                //x: container.x-5,
                y: container.y,
                ease: "bounce.out"
            });
            timeline2.to(container, {
                duration: 0.1,
                //x: container.x+5,
                y: container.y - 10,
                ease: "power1.out"
            }).to(container, {
                duration: 0.1,
                //x: container.x-5,
                y: container.y,
                ease: "bounce.out"
            });
        } else if (effect === 'pop') {
            timeline2.to(container, {
                duration: 0.4,
                y: container.y - 20,
                ease: "power1.out"
            });
        } else if (effect === 'wobble') {
            timeline2.to(container, {
                x: x + 10,
                duration: 0.05,
                //rotation: 0.1,
                yoyo: true,
                repeat: 2
            });
        }

        // 消えるアニメーション
        timeline2.to(container, {
            duration: 0.6,
            alpha: 0,
            y: container.y - 40,
            onComplete: () => {
                titleScene.removeChild(container);
            }
        });
    }

    function showTimeExtendedText() {
        const textExtended = new PIXI.Text("Colorful!", {
            fontSize: 48,
            fontFamily: 'Impact',
            fill: ["#ff6666", "#ffff66"],
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 2,
        });
        textExtended.anchor.set(0.5);
        textExtended.x = app.screen.width / 2;
        textExtended.y = app.screen.height / 2;
        textExtended.alpha = 0;
        textExtended.rotation = -0.1;

        titleScene.addChild(textExtended);

        // GSAPアニメーション
        const tl = gsap.timeline({
            onComplete: () => {
                titleScene.removeChild(textExtended);
            }
        });

        // 登場 → 揺れ → 上昇＆消滅
        tl.to(textExtended, {
            alpha: 1,
            duration: 0.1
        }).to(textExtended, {
            rotation: 0.1,
            duration: 0.05,
            yoyo: true,
            repeat: 3,
            ease: "sine.inOut",
        }).to(textExtended, {
            rotation: 0,
            y: textExtended.y - 80,
            alpha: 0,
            duration: 0.5,
            ease: "power2.out"
        }, "+=0.1");

    }

    const touchArea1 = new PIXI.Graphics();
    touchArea1.beginFill(0x000000, 0).drawRect(0, 0, app.screen.width, 325).endFill();
    titleScene.addChild(touchArea1);
    touchArea1.interactive = true;
    touchArea1.buttonMode = true;
    // イベント処理
    touchArea1.on('pointerdown', () => {
        optionCall();
    });

    const touchArea2 = new PIXI.Graphics();
    touchArea2.beginFill(0x000000, 0).drawRect(0, 395, app.screen.width, app.screen.height - 395).endFill();
    titleScene.addChild(touchArea2);
    touchArea2.interactive = true;
    touchArea2.buttonMode = true;
    // イベント処理
    touchArea2.on('pointerdown', () => {
        optionCall();
    });

    const touchArea3 = new PIXI.Graphics();
    touchArea3.beginFill(0x000000, 0).drawRect(60, 325, app.screen.width - 120, 70).endFill();
    titleScene.addChild(touchArea3);
    touchArea3.interactive = true;
    touchArea3.buttonMode = true;
    // イベント処理
    touchArea3.on('pointerdown', () => {
        optionCall();
    });

    // ポップアップ作成（最初は非表示）
    const overlay = new PIXI.Container();
    overlay.visible = false;
    titleScene.addChild(overlay);
    overlay.alpha = 0;
    overlay.y -= 10;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.8).drawRoundedRect(30, 190, 300, 110, 10).endFill();
    overlay.addChild(bg);

    const questionText = new PIXI.Text('ゲームを始めますか？', {
        fill: 0xffffff,
        fontSize: 24
    });
    questionText.anchor.set(0.5);
    questionText.x = app.screen.width / 2;
    questionText.y = 220;
    overlay.addChild(questionText);

    const yesButton = createButton('START', app.screen.width / 2 - 75, app.screen.height - 115, 30, 10, false);
    yesButton.buttonMode = true;
    yesButton.x = app.screen.width / 2 - 70;
    yesButton.y = 260;
    overlay.addChild(yesButton);

    const noButton = createButton('CANCEL', app.screen.width / 2 - 75, app.screen.height - 115, 26, 10, false);
    noButton.x = app.screen.width / 2 + 70;
    noButton.y = 260;
    overlay.addChild(noButton);

    function optionCall() {
        if (!overlay.visible) {
            overlay.visible = true;
            // フェードイン
            gsap.to(darkOverlay, {
                alpha: 0.3,
                duration: 0.3,
            });
            gsap.to(overlay, {
                alpha: 1,
                duration: 0.3,
                onComplete: () => {
                    demo1.pause();
                    demo2.pause();
                    demo3.pause();
                    currentLoopTimeline.pause();
                }
            });
        } else {
            // フェードアウト
            gsap.to(darkOverlay, {
                alpha: 0.0,
                duration: 0.3,
            });
            gsap.to(overlay, {
                alpha: 0,
                duration: 0.3,
                onComplete: () => {
                    demo1.resume();
                    demo2.resume();
                    demo3.resume();
                    currentLoopTimeline.resume();
                    overlay.visible = false;
                }
            });
        }
    }
    yesButton.on('pointerdown', () => {
        // フェードアウト
        gsap.to(darkOverlay, {
            alpha: 1,
            duration: 0.3,
            onComplete: () => {
                // 初期化処理
                titleScene.removeChildren();
                uiContainer.removeChildren();
                switchScene('main');
            }
        });


    });

    // ボタンを作成する関数
    const createTGLButton = (x, y, color, shape, onClick) => {
        const button = new PIXI.Graphics();
        button.beginFill(color);
        if (shape === 'circle') {
            button.drawCircle(0, 0, 30);
        } else if (shape === 'triangleL') {
            // 左向きの三角形（マイナスボタン）
            button.moveTo(-40, 0);  // 右側の頂点
            button.lineTo(0, -25); // 左側の頂点
            button.lineTo(0, 25);    // 下側の頂点
        } else if (shape === 'triangleR') {
            // 右向きの三角形（プラスボタン）
            button.moveTo(40, 0);  // 左側の頂点
            button.lineTo(0, -25);   // 右側の頂点
            button.lineTo(0, 25);     // 下側の頂点
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
    const buttonL = createTGLButton(41, 360, 0xff6666, 'triangleL', () => startLoop(currentTimeline - 1 < 0 ? 6 : currentTimeline - 1));
    titleScene.addChild(buttonL);

    // +1 ボタン（三角形）
    const buttonR = createTGLButton(319, 360, 0xFFCC66, 'triangleR', () => startLoop(currentTimeline + 1 > 6 ? 0 : currentTimeline + 1));
    titleScene.addChild(buttonR);

    return titleScene;

    // 汎用ボタン作成
    function createButton(label, x, y, fontsize = 40, round = 10, size = true) {
        const container = new PIXI.Container();
        const bg = new PIXI.Graphics();
        if (colorFlg && label === 'OGI') {
            bg.beginFill(0xff2222);
        } else if (colorFlg && label === 'HAGI') {
            bg.beginFill(0xffcc00);
        } else if (colorFlg && label === 'CANCEL') {
            bg.beginFill(0x999999);
        } else {
            bg.beginFill(0xffffff);
        }
        if (size) {
            bg.drawRoundedRect(-60, -30, 120, 70, round);
        } else {
            bg.drawRoundedRect(-60, -15, 120, 40, round);
        }
        bg.endFill();
        const text = new PIXI.Text(label, {
            fill: 0x333333, fontSize: fontsize,
            fontWeight: 'bold',
        });
        text.anchor.set(0.5);
        text.y += 5;
        container.addChild(bg, text);
        container.position.set(x, y);
        if (label != 'CANCEL') {
            container.interactive = true;
            container.buttonMode = true;
        }
        return container;
    }

    // 汎用ボタンの事後色替え
    function changeButtonColor(buttonContainer, newColor, flg = 1) {
        const bg = buttonContainer.getChildAt(0); // 背景 Graphics を取得
        bg.clear();
        bg.beginFill(newColor);
        if (flg === 0) {
            // 真ん中
            bg.drawRoundedRect(-45, -30, 90, 70, 30);
        } else {
            // 左右
            bg.drawRoundedRect(-60, -30, 120, 70, 10); // 元と同じサイズで再描画
        }
        bg.endFill();
    }

}

/** 
 * メインシーン
 * (Amain)
 */
function createMainScene() {
    // 最初はレベル1から
    //level++;

    // メインシーン作成
    const mainScene = new PIXI.Container();

    // 色別の果物リスト
    const redFruits = ['荻', 'OGI', 'おぎ', 'オギ'];
    const yellowFruits = ['萩', 'HAGI', 'はぎ', 'ハギ'];

    let startFlg = false;
    let gameover = false;
    let score = 0;
    let displayScore = 0;
    let scoreY = 0;
    let scoreLeft = 0;
    let scoreRight = 0;
    let y_deadline = app.screen.height - 92;
    let time = 0;
    let fallSpeed = 2;
    let activeWords = [];
    let wordSpawnInterval = 2000;
    let level = 1;
    let ogiBefore;
    let hagiBefore;
    let colorFlg = true;
    let clearCount = 0;

    // UIラベル
    const scoreText = new PIXI.Text('スコア: 0', { fill: 0x333333, fontSize: 24 });
    scoreText.position.set(10, 10);
    mainScene.addChild(scoreText);

    const timeText = new PIXI.Text('時間: 0s', { fill: 0x333333, fontSize: 24 });
    timeText.anchor.set(1, 0);
    timeText.position.set(app.screen.width - 10, 10);
    mainScene.addChild(timeText);


    // カラフル用タイマー
    const maxTime = 8;      // 初期の最大タイマー秒数
    let currentMaxTime = maxTime;
    let currentTime = maxTime;
    const radius = 180;       // ゲージの半径

    // コンテナを用意
    const timerContainer = new PIXI.Container();
    timerContainer.x = app.screen.width / 2;
    timerContainer.y = app.screen.height / 2 - 50;
    mainScene.addChild(timerContainer);
    timerContainer.alpha = 1;


    // 背景（フルゲージの円）
    const bgCircle = new PIXI.Graphics();
    bgCircle.beginFill(0xdddddd);
    bgCircle.drawCircle(0, 0, radius);
    bgCircle.endFill();
    //timerContainer.addChild(bgCircle);

    // ゲージ本体
    const gauge = new PIXI.Graphics();
    timerContainer.addChild(gauge);

    // 中央に数値表示
    const timerText = new PIXI.Text(`${Math.ceil(currentTime)}`, {
        fontSize: 32,
        fill: "#ffffff",
        fontWeight: "bold",
    });
    timerText.anchor.set(0.5);
    //timerContainer.addChild(timerText);

    // 外部イベントからタイマーを加算する関数
    function addTime(seconds) {
        if (score < 250) {
            seconds += 0.5;
        } else if (score < 1000) {
            seconds -= 1;
        } else if (score < 2500) {
            seconds -= 2;
        } else if (score < 5000) {
            seconds -= 3;
        } else {
            seconds -= 3.8;
        }
        currentTime = Math.min(currentTime + seconds, maxTime);
        if (currentTime < 0.7) {
            currentTime = 0.7;
        }
        currentMaxTime = currentTime;
    }

    let timeExtended = false;
    function showTimeExtendedText() {
        if (!timeExtended) {
            timeExtended = true;

            const textExtended = new PIXI.Text("Colorful!", {
                fontSize: 48,
                fontFamily: 'Impact',
                fill: ["#ff6666", "#ffff66"],
                fontWeight: "bold",
                stroke: "#000000",
                strokeThickness: 2,
            });
            textExtended.anchor.set(0.5);
            textExtended.x = app.screen.width / 2;
            textExtended.y = app.screen.height / 2 + 100;
            textExtended.alpha = 0;
            textExtended.rotation = -0.1;

            mainScene.addChild(textExtended);

            // GSAPアニメーション
            const tl = gsap.timeline({
                onComplete: () => {
                    mainScene.removeChild(textExtended);
                }
            });

            // 登場 → 揺れ → 上昇＆消滅
            tl.to(textExtended, {
                alpha: 1,
                duration: 0.1
            }).to(textExtended, {
                rotation: 0.1,
                duration: 0.05,
                yoyo: true,
                repeat: 3,
                ease: "sine.inOut",
            }).to(textExtended, {
                rotation: 0,
                y: textExtended.y - 80,
                alpha: 0,
                duration: 0.5,
                ease: "power2.out"
            }, "+=0.1");

            timeExtended = false;
        }

    }

    const comboText = new PIXI.Text('COMBO x0', {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0xffffff,
        stroke: 0x000000,
        strokeThickness: 3
    });
    comboText.anchor.set(1, 1);
    comboText.position.set(app.screen.width + 200, app.screen.height - 120);
    mainScene.addChild(comboText);

    // --- BONUSテキスト ---
    const bonusText = new PIXI.Text('BONUS!!', {
        fontFamily: 'Impact',
        fontSize: 48,
        fill: 0xff4444,
        stroke: 0xffffff,
        strokeThickness: 5
    });
    bonusText.anchor.set(0.5);
    bonusText.position.set(app.screen.width - 60, app.screen.height - 120);
    bonusText.visible = false;
    mainScene.addChild(bonusText);

    // --- パーティクル生成関数 ---
    function createMiniParticles(x, y) {
        for (let i = 0; i < 30; i++) {
            const miniparticle = new PIXI.Graphics();
            miniparticle.beginFill(0xeeee66 + Math.random() * 0x111111);
            miniparticle.drawCircle(0, 0, 2);
            miniparticle.endFill();
            miniparticle.x = x - 40;
            miniparticle.y = y - 40;
            app.stage.addChild(miniparticle);

            const angle = Math.random() * Math.PI * 2;
            const speed = 5 + Math.random() * 5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            gsap.to(miniparticle, {
                x: miniparticle.x + vx * 10,
                y: miniparticle.y + vy * 10,
                alpha: 0,
                rotation: Math.random() * Math.PI,
                duration: 0.8,
                ease: "power2.out",
                onComplete: () => app.stage.removeChild(miniparticle)
            });
        }
    }

    // --- コンボ加算関数 ---
    function addCombo() {
        comboText.text = `COMBO x${clearCount}`;
        comboText.alpha = 1;
        comboText.rotation = 0;

        const tl = gsap.timeline();

        if (clearCount % 10 === 0) {
            addTime(3);
            //comboText.style.fill = 0xffd700;

            // 揺れ・点滅・回転
            tl.to(comboText, { x: comboText.x + 10, duration: 0.05 })
                .to(comboText, { x: comboText.x - 20, duration: 0.05 })
                .to(comboText, { x: comboText.x + 10, duration: 0.05 })
                .to(comboText, { rotation: 0.1, alpha: 0.5, duration: 0.1, repeat: 2, yoyo: true })
                .to(comboText, { rotation: 0, alpha: 1, duration: 0.1 });

            // BONUS文字表示
            bonusText.visible = true;
            bonusText.alpha = 1;
            bonusText.y = app.screen.height - 150;
            gsap.to(bonusText, {
                y: bonusText.y - 30,
                alpha: 0,
                duration: 1.0,
                ease: "power1.out",
                onComplete: () => bonusText.visible = false
            });

            // パーティクル発生
            createMiniParticles(comboText.x, comboText.y);
        } else {
            comboText.x = app.screen.width - 20;
            // 通常演出：ちょっとだけ上下揺れ
            //comboText.style.fill = 0xffffff;
            tl.to(comboText, { y: comboText.y - 10, duration: 0.1 })
                .to(comboText, { y: comboText.y, duration: 0.1 });
        }
    }

    // デッドライン把握用四角
    const rect_deadline = new PIXI.Graphics();
    rect_deadline.beginFill(0x000000);
    rect_deadline.drawRect(0, app.screen.height - 110, app.screen.width, 80);
    rect_deadline.endFill();
    mainScene.addChild(rect_deadline);
    rect_deadline.alpha = 0.5;

    // ドット線描画関数
    function drawDottedLine(graphics, x1, y1, x2, y2, dotRadius = 2, gapLength = 10) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dotCount = Math.floor(distance / (dotRadius * 2 + gapLength));
        const stepX = (dx / distance) * (dotRadius * 2 + gapLength);
        const stepY = (dy / distance) * (dotRadius * 2 + gapLength);

        let currentX = x1;
        let currentY = y1;

        for (let i = 0; i <= dotCount; i++) {
            graphics.beginFill(0xeeeeee); // 白色のドット
            graphics.drawCircle(currentX, currentY, dotRadius);
            graphics.endFill();
            currentX += stepX;
            currentY += stepY;
        }
    }
    function updateDottedLine() {
        dottedLine1.y = Math.floor((fallSpeed / 2) * 10);
        dottedLine2.y = Math.floor((fallSpeed / 2) * 10);
        dottedLine3.y = Math.floor((fallSpeed / 2) * 10);
    }

    const dottedLine1 = new PIXI.Graphics();
    const dottedLine2 = new PIXI.Graphics();
    const dottedLine3 = new PIXI.Graphics();
    //const dottedLine4 = new PIXI.Graphics();
    // (スタートX, スタートY, 終了X, 終了Y, ドットの半径, ドット間の隙間)
    drawDottedLine(dottedLine1, 0, 90, app.screen.width, 80, 2, 5);
    drawDottedLine(dottedLine2, 0, 210, app.screen.width, 200, 2, 5);
    drawDottedLine(dottedLine3, 0, 330, app.screen.width, 320, 2, 5);
    //drawDottedLine(dottedLine4, 0, y_deadline, app.screen.width, y_deadline, 9, 14);
    updateDottedLine();
    mainScene.addChild(dottedLine1);
    mainScene.addChild(dottedLine2);
    mainScene.addChild(dottedLine3);
    //mainScene.addChild(dottedLine4);


    // OGIYAHAGI
    const bgOYHcontainer = new PIXI.Container();
    const OYHTextO = new PIXI.Text('荻', { fill: 0xcc0000, fontSize: 124 });
    OYHTextO.position.set(5, 150);
    const OYHTextY = new PIXI.Text('や', { fill: 0x000000, fontSize: 100 });
    OYHTextY.position.set(130, 175);
    const OYHTextH = new PIXI.Text('萩', { fill: 0xccaa00, fontSize: 124 });
    OYHTextH.position.set(230, 150);
    mainScene.addChild(bgOYHcontainer);
    bgOYHcontainer.addChild(OYHTextO, OYHTextY, OYHTextH);
    bgOYHcontainer.y = 200;
    bgOYHcontainer.alpha = 0;

    // 背景用文字
    // 漢字おぎ
    const bgOKNcontainer = new PIXI.Container();
    const ogiTextKN = new PIXI.Text('荻', { fill: 0x000000, fontSize: 124 });
    ogiTextKN.position.set(5, 150);
    mainScene.addChild(bgOKNcontainer);
    bgOKNcontainer.addChild(ogiTextKN);
    bgOKNcontainer.alpha = 0.3;
    //bgOKNcontainer.y -= 400;

    // ひらがなおぎ
    const bgOHcontainer = new PIXI.Container();
    const ogiTextH1 = new PIXI.Text('お', { fill: 0x000000, fontSize: 124 });
    ogiTextH1.position.set(5, 85);
    const ogiTextH2 = new PIXI.Text('ぎ', { fill: 0x000000, fontSize: 124 });
    ogiTextH2.position.set(5, 225);
    mainScene.addChild(bgOHcontainer);
    bgOHcontainer.addChild(ogiTextH1, ogiTextH2);
    bgOHcontainer.alpha = 0.3;
    bgOHcontainer.y -= 400;

    // カタカナおぎ
    const bgOKTcontainer = new PIXI.Container();
    const ogiTextKT1 = new PIXI.Text('オ', { fill: 0x000000, fontSize: 124 });
    ogiTextKT1.position.set(5, 85);
    const ogiTextKT2 = new PIXI.Text('ギ', { fill: 0x000000, fontSize: 124 });
    ogiTextKT2.position.set(5, 225);
    mainScene.addChild(bgOKTcontainer);
    bgOKTcontainer.addChild(ogiTextKT1, ogiTextKT2);
    bgOKTcontainer.alpha = 0.3;
    bgOKTcontainer.y -= 400;

    //英字おぎ
    const bgOEcontainer = new PIXI.Container();
    const ogiTextE = new PIXI.Text('OGI', { fill: 0x000000, fontSize: 124 });
    ogiTextE.position.set(130, 110);
    ogiTextE.rotation = 3.14 / 2;
    mainScene.addChild(bgOEcontainer);
    bgOEcontainer.addChild(ogiTextE);
    bgOEcontainer.alpha = 0.3;
    bgOEcontainer.y -= 400;

    // や
    const bgYacontainer = new PIXI.Container();
    const yaText = new PIXI.Text('や', { fill: 0x000000, fontSize: 100 });
    yaText.position.set(130, 175);
    mainScene.addChild(bgYacontainer);
    bgYacontainer.addChild(yaText);
    bgYacontainer.alpha = 0.3;
    //bgYacontainer.y -= 400;   


    // 漢字はぎ
    const bgHKNcontainer = new PIXI.Container();
    const hagiTextKN = new PIXI.Text('萩', { fill: 0x000000, fontSize: 124 });
    hagiTextKN.position.set(230, 150);
    mainScene.addChild(bgHKNcontainer);
    bgHKNcontainer.addChild(hagiTextKN);
    bgHKNcontainer.alpha = 0.3;
    //hagiTextKN.y -= 400;

    // ひらがなはぎ
    const bgHHcontainer = new PIXI.Container();
    const hagiTextH1 = new PIXI.Text('は', { fill: 0x000000, fontSize: 124 });
    hagiTextH1.position.set(230, 85);
    const hagiTextH2 = new PIXI.Text('ぎ', { fill: 0x000000, fontSize: 124 });
    hagiTextH2.position.set(230, 225);
    mainScene.addChild(bgHHcontainer);
    bgHHcontainer.addChild(hagiTextH1, hagiTextH2);
    bgHHcontainer.alpha = 0.3;
    bgHHcontainer.y -= 400;

    // カタカナはぎ
    const bgHKTcontainer = new PIXI.Container();
    const hagiTextKT1 = new PIXI.Text('ハ', { fill: 0x000000, fontSize: 124 });
    hagiTextKT1.position.set(230, 85);
    const hagiTextKT2 = new PIXI.Text('ギ', { fill: 0x000000, fontSize: 124 });
    hagiTextKT2.position.set(230, 225);
    mainScene.addChild(bgHKTcontainer);
    bgHKTcontainer.addChild(hagiTextKT1, hagiTextKT2);
    bgHKTcontainer.alpha = 0.3;
    bgHKTcontainer.y -= 400;

    //英字はぎ
    const bgHEcontainer = new PIXI.Container();
    const hagiTextE = new PIXI.Text('HAGI', { fill: 0x000000, fontSize: 124 });
    hagiTextE.position.set(360, 80);
    hagiTextE.rotation = 3.14 / 2;
    mainScene.addChild(bgHEcontainer);
    bgHEcontainer.addChild(hagiTextE);
    bgHEcontainer.alpha = 0.3;
    bgHEcontainer.y -= 400;

    ogiBefore = bgOKNcontainer;
    hagiBefore = bgHKNcontainer;

    // 左右ボタン
    const leftButton = createButton('OGI', 65, app.screen.height - 75);
    const rightButton = createButton('HAGI', app.screen.width - 65, app.screen.height - 75);
    // おぎやはぎボタン
    const ohcontainer = new PIXI.Container();
    const ohbg = new PIXI.Graphics();
    ohbg.beginFill(0xffffff);
    ohbg.drawRoundedRect(-45, -30, 90, 70, 30);
    ohbg.endFill();
    const ytext = new PIXI.Text('YA', {
        fill: 0x333333, fontSize: 40,
        fontWeight: 'bold',
    });
    ytext.anchor.set(0.5);
    ytext.y += 5;
    ytext.alpha = 1.0;
    const otext = new PIXI.Text('OGI', {
        fill: 0xff2222, fontSize: 26,
        fontWeight: 'bold',
    });
    otext.anchor.set(0.5);
    otext.y -= 10;
    otext.alpha = 1;
    const htext = new PIXI.Text('HAGI', {
        fill: 0xffcc00, fontSize: 26,
        fontWeight: 'bold',
    });
    htext.anchor.set(0.5);
    htext.y += 20;
    htext.alpha = 1;
    ohcontainer.addChild(ohbg, otext, htext, ytext);
    ohcontainer.position.set(app.screen.width / 2, app.screen.height - 75);
    ohcontainer.interactive = true;
    ohcontainer.buttonMode = true;
    const centerButton = ohcontainer;

    mainScene.addChild(leftButton, rightButton, centerButton);

    leftButton.interactive = true;
    rightButton.interactive = true;
    centerButton.interactive = true;

    leftButton.on('pointerdown', () => {
        if (!gameover) handleDirection('left');
    });
    rightButton.on('pointerdown', () => {
        if (!gameover) handleDirection('right');
    });
    centerButton.on('pointerdown', () => {
        if (!gameover) {
            if (activeWords.length < 2) {
                //if(ogyYaHagi){
                //    resultFailure();
                //    return;
                //}else{
                return;
                //}
            }
            bgOYHcontainer.y = 255;
            bgOYHcontainer.alpha = 1;
            animateButton(centerButton);
            handleDirection('left', true);
            handleDirection('right', true);
            const TL = gsap.timeline();
            TL.to(bgOYHcontainer, {
                y: bgOYHcontainer.y - app.screen.height,
                alpha: 0,
                duration: 0.4,
                ease: 'power1.inOut',
            }).to(bgYacontainer, {
                duration: 0.2,
                y: bgYacontainer.y - 400,
                ease: "power1.out",
                onComplete: () => {
                    bgYacontainer.y = 400;
                    gsap.to(bgYacontainer, {
                        duration: 0.2,
                        y: bgYacontainer.y - 400,
                        ease: "power1.out",
                        onComplete: () => {
                            // 空フルタイマー加算
                            addTime(5);
                            showTimeExtendedText();
                            // キラキラ演出
                            for (let i = 0; i < 50; i++) {
                                const star = new PIXI.Text('★', { fontSize: 24, fill: i % 2 === 0 ? 0xcc0000 : 0xccaa00 });
                                star.anchor.set(0.5);
                                star.x = app.screen.width / 2;
                                star.y = app.screen.width / 2;
                                mainScene.addChild(star);
                                gsap.to(star, {
                                    x: star.x + (Math.random() - 0.5) * 300,
                                    y: star.y + (Math.random() - 0.5) * 300,
                                    alpha: 0,
                                    duration: 0.5,
                                    onComplete: () => {
                                        mainScene.removeChild(star)
                                    }
                                });

                            }

                        }
                    });
                }
            }, '-=0.2');
        }

    });

    // リザルト画面のスコア
    const scoreTextR = new PIXI.Text(`SCORE: 0`, {
        fontSize: 18,
        fill: '#ffffff',
        //fontWeight: 'bold'
    });
    scoreTextR.x = 50;
    scoreTextR.y = 375;
    //scoreTextR.anchor.set(0.5);

    let nextScore = 0;
    // リザルト画面のスコア
    const scoreTextN = new PIXI.Text(``, {
        fontSize: 18,
        fill: '#ffffff',
        //fontWeight: 'bold'
    });
    scoreTextN.x = 200;
    scoreTextN.y = 375;
    //scoreTextN.anchor.set(0.5);
    scoreTextN.alpha=0;

    // リザルト画面遷移時の背景薄黒
    const darkOverlay = new PIXI.Graphics();
    darkOverlay.beginFill(0x000000, 0.7);
    darkOverlay.drawRect(0, 0, app.screen.width, app.screen.height);
    darkOverlay.endFill();
    darkOverlay.alpha = 0;
    uiContainer.addChild(darkOverlay);

    // 次の単語生成
    function respawnWord() {
        if (!gameover) {
            wordSpawnInterval = Math.random() * 1500 + 500 * 2 / fallSpeed;
            // ワード生成
            spawnWord()
            // spawn
            const respawn = setTimeout(respawnWord, wordSpawnInterval);

        }
    }

    // ワード生成関数
    function spawnWord() {
        const candidates = [];
        for (let i = 0; i < level; i++) {
            candidates.push({ word: randomFrom(redFruits), color: 'red' });
            candidates.push({ word: randomFrom(yellowFruits), color: 'yellow' });
        }
        const selected = randomFrom(candidates);
        const text = new PIXI.Text(selected.word, {
            fontSize: 36,
            fill: selected.color === 'red' ? 0xcc0000 : 0xccaa00,
            //fill: 0x000000,
            stroke: '#ffffff',
            strokeThickness: 4
        });
        text.anchor.set(0.5);
        text.x = app.screen.width / 2;
        text.y = 0;
        text.fruitColor = selected.color;
        text.word = selected.word;
        mainScene.addChild(text);
        activeWords.push(text);
    }

    // テキトーな色を返す選ぶ関数
    function getRandomColor() {
        const colors = ['0x000000', '0xcc0000', '0xccaa00']; // 黒・赤・黄
        const index = Math.floor(Math.random() * colors.length);
        return colors[index];
    }

    let frameCount = 0;
    // 落下アニメーション
    app.ticker.add((delta) => {
        if (!gameover) {
            frameCount++;
            // タイマー
            if (currentTime > 0) {
                colorFlg = true;
                currentTime -= delta / 60;
                if (currentTime < 0) currentTime = 0;

                // ゲージ描画
                gauge.clear();
                gauge.beginFill(0xffffff);
                const progress = currentTime / currentMaxTime;
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + Math.PI * 2 * progress;
                gauge.moveTo(0, 0); // 中心から
                gauge.arc(0, 0, radius, startAngle, endAngle); // 円弧を描く
                gauge.lineTo(0, 0); // 扇形にするため、中心に戻る
                gauge.endFill();

                // 数値更新（整数表示）＋ GSAPでふわっと変化
                const displayTime = Math.ceil(currentTime);
                if (timerText.text !== `${displayTime}`) {
                    gsap.to(timerText.scale, { x: 1.3, y: 1.3, duration: 0.1, yoyo: true, repeat: 1 });
                    timerText.text = `${displayTime}`;
                }
            } else {
                colorFlg = false;
            }

            // カラフル化
            if (colorFlg) {
                ogiTextKN.style.fill = '0xcc0000';
                ogiTextH1.style.fill = '0xcc0000';
                ogiTextH2.style.fill = '0xcc0000';
                ogiTextKT1.style.fill = '0xcc0000';
                ogiTextKT2.style.fill = '0xcc0000';
                ogiTextE.style.fill = '0xcc0000';
                hagiTextKN.style.fill = '0xbb9900';
                hagiTextH1.style.fill = '0xbb9900';
                hagiTextH2.style.fill = '0xbb9900';
                hagiTextKT1.style.fill = '0xbb9900';
                hagiTextKT2.style.fill = '0xbb9900';
                hagiTextE.style.fill = '0xbb9900';
                otext.style.fill = '0xff2200';
                htext.style.fill = '0xffcc00';
                comboText.style.fill = 0xffd700;
                changeButtonColor(ohcontainer, '0xffffff', 0);
                changeButtonColor(leftButton, '0xff2222');
                changeButtonColor(rightButton, '0xffcc00');
            } else if (score >= 3000) {
                if (frameCount % 8 === 0) { // 10フレームごとに色を変更（調整可）
                    ogiTextKN.style.fill = getRandomColor();
                    ogiTextH1.style.fill = getRandomColor();
                    ogiTextH2.style.fill = getRandomColor();
                    ogiTextKT1.style.fill = getRandomColor();
                    ogiTextKT2.style.fill = getRandomColor();
                    ogiTextE.style.fill = getRandomColor();
                    hagiTextKN.style.fill = getRandomColor();
                    hagiTextH1.style.fill = getRandomColor();
                    hagiTextH2.style.fill = getRandomColor();
                    hagiTextKT1.style.fill = getRandomColor();
                    hagiTextKT2.style.fill = getRandomColor();
                    hagiTextE.style.fill = getRandomColor();

                    otext.style.fill = '0xffffff';
                    htext.style.fill = '0xffffff';
                    comboText.style.fill = 0xffffff;
                    changeButtonColor(ohcontainer, '0xdddddd', 0);
                    changeButtonColor(leftButton, '0xdddddd');
                    changeButtonColor(rightButton, '0xdddddd');
                }
            } else {
                ogiTextKN.style.fill = '0x000000';
                ogiTextH1.style.fill = '0x000000';
                ogiTextH2.style.fill = '0x000000';
                ogiTextKT1.style.fill = 0x000000;
                ogiTextKT2.style.fill = 0x000000;
                ogiTextE.style.fill = 0x000000;
                hagiTextKN.style.fill = 0x000000;
                hagiTextH1.style.fill = 0x000000;
                hagiTextH2.style.fill = 0x000000;
                hagiTextKT1.style.fill = 0x000000;
                hagiTextKT2.style.fill = 0x000000;
                hagiTextE.style.fill = 0x000000;

                otext.style.fill = '0xffffff';
                htext.style.fill = '0xffffff';
                comboText.style.fill = 0xffffff;
                changeButtonColor(ohcontainer, '0xdddddd', 0);
                changeButtonColor(leftButton, '0xdddddd');
                changeButtonColor(rightButton, '0xdddddd');
            }
            activeWords.forEach(word => {
                if (colorFlg) {
                    word.style.fill = word.fruitColor === 'red' ? '0xcc0000' : '0xccaa00';
                } else if (score >= 3000) {
                    if (frameCount % 45 === 0) { // 10フレームごとに色を変更（調整可）
                        word.style.fill = getRandomColor();
                    }
                } else {
                    word.style.fill = '0x000000';
                }
                word.y += fallSpeed * delta;
                if (word.y > y_deadline && !gameover) {
                    gameover = true;
                    // 自動失敗
                    animateFailure(word, 0, false);
                    //gameOver();
                }
            });
        }
    });

    // ボタンアニメーション
    function animateButton(button) {
        app.ticker.addOnce(() => {
            button.scale.set(1.2);
            setTimeout(() => button.scale.set(1), 100);
        });
    }

    // 判定処理
    function handleDirection(direction, ogyYaHagi = false) {
        if (activeWords.length === 0) {
            //if(ogyYaHagi){
            //    resultFailure();
            //    return;
            //}else{
            return;
            //}
        }

        const word = activeWords.shift();
        animateButton(direction === 'left' ? leftButton : direction === 'right' ? rightButton : centerButton);

        scoreY = calculateScore(word.y, fallSpeed);

        let isCorrect = false;
        let addscore = 0
        if (ogyYaHagi) {
            scoreY = 10;
            addscore = 125;
        } else if (scoreY >= 9) {
            addscore = 100;
        } else if (scoreY >= 7) {
            addscore = 75;
        } else if (scoreY >= 5) {
            addscore = 50;
        } else {
            addscore = 25;
        }
        if (direction === 'left' && word.fruitColor === 'red') {
            isCorrect = true;
            scoreLeft += addscore;
        } else if (direction === 'right' && word.fruitColor === 'yellow') {
            isCorrect = true;
            scoreRight += addscore;
        }

        if (isCorrect) {
            score = scoreLeft + scoreRight;
            //score = scoreY;
            updateScore();
            animateSuccess(word, direction, scoreY);
            if (score % 5 === 0) {
                level += 1;
                clearCount++;
                if (clearCount % 10 === 0) {
                    fallSpeed *= 1.1;
                }
                addCombo();
                //if (clearCount % 10 === 0) {
                //    addTime(3);
                //    showTimeExtendedText();
                //}
                fallSpeed += 0.01;
                updateDottedLine();
            }
        } else {
            animateFailure(word, direction);
            //gameOver();
        }
    }

    function calculateScore(yPosition, fallSpeed) {
        const maxY = y_deadline; // 画面下端
        const reactionRatio = 1 - yPosition / maxY; // 高いほど早い
        let score = 0;

        y_deadline
        if (yPosition < 90 + dottedLine1.y) {
            score = 9;
        } else if (yPosition < 200 + dottedLine2.y) {
            score = 8;
        } else if (yPosition < 320 + dottedLine3.y) {
            score = 6;
        } else {
            score = 5;
        }

        // スピードを正規化（例えばスピード2~6）
        const speedWeight = Math.min(Math.max(fallSpeed / 3, 1), 2); // 倍率: 1〜2

        // 最終スコア加点値（例えば最大10点）
        //score = Math.round(4 + reactionRatio * 5 * speedWeight);

        return score;
    }

    // 成功アニメーション
    function animateSuccess(word, direction, amount) {
        const dx = direction === 'left' ? -150 : 150;
        app.ticker.addOnce(() => {
            const tw = gsap.to(word, {
                x: word.x + dx,
                //scale: 2,
                alpha: 0,
                duration: 0.2,
                onComplete: () => {
                    showScoreLabelWithEffect(app.screen.width / 2 + dx * 0.8, word.y, amount)
                    mainScene.removeChild(word);
                    createParticles(word.x, word.y);
                    backgroundChange(word);
                }
            });
        });
    }

    function backgroundChange(word) {
        if (word.fruitColor === 'red') {
            // 現在の背景を下に移動
            gsap.to(ogiBefore, {
                duration: 0.2,
                y: ogiBefore.y + 400,
                ease: "power1.out",
                onComplete: () => {
                    bgOKNcontainer.y = -400;
                    bgOHcontainer.y = -400;
                    bgOKTcontainer.y = -400;
                    bgOEcontainer.y = -400;
                    // 新しい文字を背景にする
                    if (word.word === 'OGI') {
                        gsap.to(bgOEcontainer, {
                            duration: 0.2,
                            y: bgOEcontainer.y + 400,
                            ease: "power1.out",
                            onComplete: () => {
                                bgOKNcontainer.y = -400;
                                bgOHcontainer.y = -400;
                                bgOKTcontainer.y = -400;
                            }
                        });
                        ogiBefore = bgOEcontainer;
                    } else if (word.word === 'おぎ') {
                        gsap.to(bgOHcontainer, {
                            duration: 0.2,
                            y: bgOHcontainer.y + 400,
                            ease: "power1.out",
                            onComplete: () => {
                                bgOKNcontainer.y = -400;
                                bgOKTcontainer.y = -400;
                                bgOEcontainer.y = -400;
                            }
                        });
                        ogiBefore = bgOHcontainer;
                    } else if (word.word === 'オギ') {
                        gsap.to(bgOKTcontainer, {
                            duration: 0.2,
                            y: bgOKTcontainer.y + 400,
                            ease: "power1.out",
                            onComplete: () => {
                                bgOKNcontainer.y = -400;
                                bgOHcontainer.y = -400;
                                bgOEcontainer.y = -400;
                            }
                        });
                        ogiBefore = bgOKTcontainer;
                    } else {
                        gsap.to(bgOKNcontainer, {
                            duration: 0.2,
                            y: bgOKNcontainer.y + 400,
                            ease: "power1.out",
                            onComplete: () => {
                                bgOHcontainer.y = -400;
                                bgOKTcontainer.y = -400;
                                bgOEcontainer.y = -400;
                            }
                        });
                        ogiBefore = bgOKNcontainer;
                    }
                }
            });
        } else {
            // 現在の背景を下に移動
            gsap.to(hagiBefore, {
                duration: 0.2,
                y: hagiBefore.y + 400,
                ease: "power1.out",
                onComplete: () => {
                    bgHKNcontainer.y = -400;
                    bgHHcontainer.y = -400;
                    bgHKTcontainer.y = -400;
                    bgHEcontainer.y = -400;
                    // 新しい文字を背景にする
                    if (word.word === 'HAGI') {
                        gsap.to(bgHEcontainer, {
                            duration: 0.2,
                            y: bgHEcontainer.y + 400,
                            ease: "power1.out",
                            onComplete: () => {
                                bgHKNcontainer.y = -400;
                                bgHHcontainer.y = -400;
                                bgHKTcontainer.y = -400;
                            }
                        });
                        hagiBefore = bgHEcontainer;
                    } else if (word.word === 'はぎ') {
                        gsap.to(bgHHcontainer, {
                            duration: 0.2,
                            y: bgHHcontainer.y + 400,
                            ease: "power1.out",
                            onComplete: () => {
                                bgHKNcontainer.y = -400;
                                bgHKTcontainer.y = -400;
                                bgHEcontainer.y = -400;
                            }
                        });
                        hagiBefore = bgHHcontainer;
                    } else if (word.word === 'ハギ') {
                        gsap.to(bgHKTcontainer, {
                            duration: 0.2,
                            y: bgHKTcontainer.y + 400,
                            ease: "power1.out",
                            onComplete: () => {
                                bgHKNcontainer.y = -400;
                                bgHHcontainer.y = -400;
                                bgHEcontainer.y = -400;
                            }
                        });
                        hagiBefore = bgHKTcontainer;
                    } else {
                        gsap.to(bgHKNcontainer, {
                            duration: 0.2,
                            y: bgHKNcontainer.y + 400,
                            ease: "power1.out",
                            onComplete: () => {
                                bgHHcontainer.y = -400;
                                bgHKTcontainer.y = -400;
                                bgHEcontainer.y = -400;
                            }
                        });
                        hagiBefore = bgHKNcontainer;
                    }
                }
            });
        }

    }

    function showScoreLabelWithEffect(x, y, amount) {
        //amount=10;
        let label = '';
        let color = '#ffffff';
        let effect = 'normal';

        if (amount >= 9) {
            label = 'PERFECT!';
            color = '#ffff66';
            effect = 'round';
        } else if (amount >= 8) {
            label = 'GREAT!';
            color = '#ffcc00';
            effect = 'jump';
        } else if (amount >= 6) {
            label = 'NICE!';
            color = '#99ccff';
            effect = 'pop';
        } else {
            label = 'SAFE';
            color = '#00ff99';
            effect = 'wobble';
        }

        const container = new PIXI.Container();
        const labelText = new PIXI.Text(label, {
            fontSize: 32,
            fill: color,
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        });
        labelText.anchor.set(0.5);
        container.addChild(labelText);
        container.x = x;
        container.y = y - 30;
        container.alpha = 0;
        container.scale.set(0.8);

        mainScene.addChild(container);

        // GSAPアニメーション
        gsap.to(container, {
            duration: 0.1,
            alpha: 1,
            ease: "back.out(2)"
        });

        let timeline = gsap.timeline();

        if (effect === 'round') {
            timeline.to(container, {
                duration: 0.2,
                rotation: Math.PI * 2,
                ease: "sine.inOut",
            });
        } else if (effect === 'jump') {
            timeline.to(container, {
                duration: 0.1,
                //x: container.x+5,
                y: container.y - 15,
                ease: "power1.out"
            }).to(container, {
                duration: 0.1,
                //x: container.x-5,
                y: container.y,
                ease: "bounce.out"
            });
            timeline.to(container, {
                duration: 0.1,
                //x: container.x+5,
                y: container.y - 10,
                ease: "power1.out"
            }).to(container, {
                duration: 0.1,
                //x: container.x-5,
                y: container.y,
                ease: "bounce.out"
            });
        } else if (effect === 'pop') {
            timeline.to(container, {
                duration: 0.4,
                y: container.y - 20,
                ease: "power1.out"
            });
        } else if (effect === 'wobble') {
            timeline.to(container, {
                x: x + 10,
                duration: 0.05,
                //rotation: 0.1,
                yoyo: true,
                repeat: 2
            });
        }

        // 消えるアニメーション
        timeline.to(container, {
            duration: 0.6,
            alpha: 0,
            y: container.y - 40,
            onComplete: () => {
                mainScene.removeChild(container);
            }
        });
    }

    // キラキラ演出
    function createParticles(x, y) {
        for (let i = 0; i < 15; i++) {
            const star = new PIXI.Text('★', { fill: 0x999999 });
            star.anchor.set(0.5);
            star.x = x;
            star.y = y;
            mainScene.addChild(star);
            gsap.to(star, {
                x: x + (Math.random() - 0.5) * 100,
                y: y + (Math.random() - 0.5) * 100,
                alpha: 0,
                duration: 1,
                onComplete: () => mainScene.removeChild(star)
            });
        }
    }

    // 失敗アニメーション
    function animateFailure(word, direction, btnflg = true) {


        let dx = direction === 'left' ? -140 : 140;
        if (!btnflg) { dx = 0 }
        app.ticker.addOnce(() => {
            const tw = gsap.to(word, {
                x: word.x + dx,
                //scale: 2,
                alpha: 1,
                duration: 0.2,
                onComplete: () => {
                    shakeTextHard(word, () => {
                        gameover = true;
                        resultFailure();
                    });
                }
            });
        });

        function shakeTextHard(container, onComplete) {
            const originalX = container.x;
            let times = 5;
            let amplitude = 8;

            const tl = gsap.timeline({ onComplete });

            for (let i = 0; i < times; i++) {
                const offset = i % 2 === 0 ? amplitude : -amplitude;
                tl.to(container, {
                    x: originalX + offset,
                    duration: 0.05,
                    ease: "power1.inOut"
                });
            }

            // 最後に元の位置に戻す
            tl.to(container, {
                x: originalX,
                duration: 0.05,
                ease: "power1.out"
            });
        }


    }

    let resultflg = false;
    function resultFailure() {
        if (!resultflg) {
            //clearInterval(spawn);
            clearInterval(timer);

            darkOverlay.alpha = 1;

            showResultScreen(score, scoreLeft, scoreRight);

        }
    }

    // スコア更新
    function updateScore() {
        const interval = setInterval(() => {
            displayScore += 4;
            scoreText.text = `スコア: ${displayScore}`;
            if (displayScore >= score) {
                displayScore = score;
                scoreText.text = `スコア: ${displayScore}`;
                clearInterval(interval);
            }
        }, 20);
    }

    // ゲームオーバー処理
    function gameStop() {
        gsap.to(scoreTextR, {
            //alpha: 0,
            duration: 0.5,
            //yoyo: true,
            //repeat: 3,
            //ease: 'power1.inOut',
            onComplete: () => {
                scoreTextR.text = `SCORE: ${score}`;
                gameStop();
            }
        });
    }

    // 時間更新
    const timer = setInterval(() => {
        time += 1;
        timeText.text = `時間: ${time}s`;
    }, 1000);

    // リザルト画面
    function showResultScreen(score, redCorrect, yellowCorrect) {
        resultflg = true;

        let effectEnd = 0;
        const resultContainer = new PIXI.Container();
        resultContainer.alpha = 0;
        uiContainer.addChild(resultContainer);

        // 背景ぼかしパネル
        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.5);
        bg.drawRoundedRect(35, 75, app.screen.width - 70, app.screen.height - 140, 20);
        bg.endFill();
        resultContainer.addChild(bg);

        // タイトル
        const title = new PIXI.Text("RESULT", {
            fontSize: 48,
            fill: 0xffffff,
            fontWeight: 'bold',
        });
        title.anchor.set(0.5);
        title.x = app.screen.width / 2;
        title.y = 110;
        resultContainer.addChild(title);

        // 白下線
        const bgLine = new PIXI.Graphics();
        bgLine.beginFill(0xffffff, 0.85);
        bgLine.drawRect(80, 135, 200, 6);
        bgLine.endFill();
        resultContainer.addChild(bgLine);

        // ドット線
        const dottedLineL = new PIXI.Graphics();
        // (スタートX, スタートY, 終了X, 終了Y, ドットの半径, ドット間の隙間)
        drawDottedLine(dottedLineL, 80, 255, 140, 255, 2, 3);
        resultContainer.addChild(dottedLineL);
        dottedLineL.alpha = 0.8;
        const dottedLineR = new PIXI.Graphics();
        // (スタートX, スタートY, 終了X, 終了Y, ドットの半径, ドット間の隙間)
        drawDottedLine(dottedLineR, 222, 255, 280, 255, 2, 3);
        resultContainer.addChild(dottedLineR);
        dottedLineR.alpha = 0.8;

        // ヘッダ
        const ogiresult = new PIXI.Text(`OGI`, {
            fontSize: 32,
            fill: '#ff4444',
            fontWeight: 'bold'
        });
        ogiresult.x = 75;
        ogiresult.y = 160;
        resultContainer.addChild(ogiresult);

        const hagiresult = new PIXI.Text(`HAGI`, {
            fontSize: 32,
            fill: '#ffaa00',
            fontWeight: 'bold'
        });
        hagiresult.x = 205;
        hagiresult.y = 160;
        resultContainer.addChild(hagiresult);

        // 果物の集計
        const redText = new PIXI.Text(`${redCorrect}`, {
            fontSize: 32,
            fill: '#ff4444',
            fontWeight: 'bold'
        });
        redText.x = 105;
        redText.y = 220;
        redText.anchor.set(0.5);
        resultContainer.addChild(redText);

        const yellowText = new PIXI.Text(`${yellowCorrect}`, {
            fontSize: 32,
            fill: '#ffaa00',
            fontWeight: 'bold'
        });
        yellowText.x = 245;
        yellowText.y = 220;
        yellowText.anchor.set(0.5);
        resultContainer.addChild(yellowText);

        // 称号ラベル
        const labelTitle = new PIXI.Text("称号", {
            fontSize: 28,
            fill: 0xffffff,
            fontWeight: 'bold',
        });
        labelTitle.anchor.set(0.5);
        labelTitle.x = app.screen.width / 2;
        labelTitle.y = 255;
        resultContainer.addChild(labelTitle);

        // ★
        const labelStar = new PIXI.Text("★★★★★", {
            fontSize: 54,
            fill: 0xffff00,
            fontWeight: 'bold',
        });
        labelStar.anchor.set(0.5);
        labelStar.x = app.screen.width / 2;
        labelStar.y = 298;
        resultContainer.addChild(labelStar);
        labelStar.alpha = 0;

        // 称号１
        const title1 = new PIXI.Text("新星", {
            fontSize: 32,
            fill: 0xffffff,
            fontWeight: 'bold',
        });
        title1.anchor.set(0.5);
        title1.x = app.screen.width / 2;
        title1.y = 290;
        title1.alpha = 0;
        resultContainer.addChild(title1);

        const title2 = new PIXI.Text("小さな萩のうた", {
            fontSize: 38,
            fill: 0xffffff,
            fontWeight: 'bold',
        });
        title2.anchor.set(0.5);
        title2.x = app.screen.width / 2;
        title2.y = 352;
        title2.alpha = 0;
        resultContainer.addChild(title2);

        // スコア：ドラムロール風加算
        resultContainer.addChild(scoreTextR);
        resultContainer.addChild(scoreTextN);

        let lowvalue = 0;
        if (redCorrect < yellowCorrect) {
            lowvalue = redCorrect;
        } else {
            lowvalue = yellowCorrect;
        }
        let currentRed = 0;
        let currentYellow = 0;
        let currentScore = 0;
        app.ticker.add(function scoreRoll(delta) {
            if (startFlg) {
                if (currentScore < score) {
                    currentRed += Math.ceil(score / 100); // 1秒で加算
                    currentYellow += Math.ceil(score / 100); // 1秒で加算
                    currentScore += Math.ceil(score / 100); // 1秒で加算
                    if (currentRed > redCorrect) currentRed = redCorrect;
                    if (currentYellow > yellowCorrect) currentYellow = yellowCorrect;
                    if (currentScore > score) currentScore = score;
                    redText.text = `${currentRed}`;
                    yellowText.text = `${currentYellow}`;
                    scoreTextR.text = `SCORE: ${currentScore}`;
                } else {
                    app.ticker.remove(scoreRoll);

                    //score = 13300;
                    //redCorrect = 300;
                    //yellowCorrect = 550;
                    // 称号設定1
                    if (score < 500) {
                        title1.text = `新星`;
                        labelStar.text = `★`;
                        nextScore = 500-score;
                        scoreTextN.text = `NEXT:+${nextScore}`;
                    } else if (score < 1500) {
                        title1.text = `超上昇`;
                        labelStar.text = `★★`;
                        nextScore = 1500-score;
                        scoreTextN.text = `NEXT:+${nextScore}`;
                    } else if (score < 3000) {
                        title1.text = `免許皆伝`;
                        labelStar.text = `★★★`;
                        nextScore = 3000-score;
                        scoreTextN.text = `NEXT:+${nextScore}`;
                    } else if (score < 5000) {
                        title1.text = `極地到達者`;
                        labelStar.text = `★★★★`;
                        nextScore = 5000-score;
                        scoreTextN.text = `NEXT:+${nextScore}`;
                    } else {
                        title1.text = `天上天下荻や萩`;
                        labelStar.text = `★★★★★`;
                        scoreTextN.x = 175;
                        scoreTextN.text = `PERFECT CLEAR!`;
                    }

                    title2.text = `${getTitle(redCorrect, yellowCorrect, score)}`;
                    // 称号設定2
                    function getTitle(score1, score2, scoreM) {
                        const rankA = ["荻と萩と私", "荻や萩が友", "荻と萩の間", "荻や萩の力", "荻も萩も私"];

                        // rankBは「title」と「insertIndex」を持つオブジェクト
                        const rankB = [
                            { title: "小さなのうた", insertIndex: 3 },
                            { title: "高嶺の子さん", insertIndex: 3 },
                            { title: "に駆ける", insertIndex: 0 },
                            { title: "になろうよ", insertIndex: 0 },
                            { title: "を愛する人", insertIndex: 0 },
                        ];

                        function getRank(score) {
                            if (score < 250) {
                                return 0;
                            } else if (score < 1000) {
                                return 1;
                            } else if (score < 2500) {
                                return 2;
                            } else if (score < 5000) {
                                return 3;
                            } else {
                                return 4;
                            }
                        }

                        const rankIndex = getRank(scoreM); // 同じなら score1 でOK

                        if (score1 === score2) {
                            return rankA[rankIndex];
                        } else {
                            const winner = score1 > score2 ? "荻" : "萩";
                            const { title, insertIndex } = rankB[rankIndex];
                            return title.slice(0, insertIndex) + winner + title.slice(insertIndex);
                        }
                    }
                    // 称号の表示
                    const TLR = gsap.timeline();
                    TLR
                    .to(title1, {
                        y: title1.y + 10,
                        alpha: 1,
                        duration: 0.5,
                        ease: 'power1.out',
                    })
                    .to(labelStar, {
                        alpha: 0.5,
                        duration: 0.5,
                        ease: "power1.out",
                    }, '-=0.5')
                    .to(title2, {
                        y: title2.y - 10,
                        alpha: 1,
                        duration: 0.5,
                        ease: "power1.out",
                    }).to(scoreTextN, {
                        alpha: 1,
                        duration: 0.5,
                        ease: "power1.out",
                    });

                    effectEnd++;
                    if (effectEnd > 1) {
                        // 停止
                        gameStop();
                    }
                }
            }
        });

        // キラキラ演出
        for (let i = 0; i < 30; i++) {
            const star = new PIXI.Text('★', { fill: 0xffff00 });
            star.anchor.set(0.5);
            star.x = title.x + (Math.random() - 0.5) * 100;
            star.y = title.y;
            resultContainer.addChild(star);
            gsap.to(star, {
                x: star.x + (Math.random() - 0.5) * 100,
                y: star.y + (Math.random() - 0.5) * 100,
                alpha: 0,
                duration: 1.5,
                onComplete: () => {
                    resultContainer.removeChild(star)
                    effectEnd++;
                    if (effectEnd > 1) {
                        gameStop()
                    }
                }
            });

        }

        // リトライボタン
        const retryBtn = createButton('RETRY', app.screen.width / 2 - 75, app.screen.height - 115, 32, 10);
        retryBtn.interactive = true;
        retryBtn.on('pointerdown', () => {
            uiContainer.removeChild(darkOverlay2);
            uiContainer.addChild(darkOverlay2);
            // フェードアウト
            gsap.to(darkOverlay2, {
                alpha: 1,
                duration: 0.5,
                onComplete: () => {
                    // 初期化処理
                    mainScene.removeChildren();
                    uiContainer.removeChildren();
                    switchScene('main');
                }
            });

        });
        uiContainer.addChild(retryBtn);

        // Twitterシェアボタン
        const tweetBtn = createButton("TWEET", app.screen.width / 2 + 75, app.screen.height - 115, 32, 10);
        tweetBtn.interactive = true;
        tweetBtn.on('pointerdown', () => {
            const tweetText = encodeURIComponent(`【荻や萩】\nOGI：${redCorrect}荻\nHAGI：${yellowCorrect}萩\n称号：${title1.text}-${title2.text}\nhttps://kshukshu.com/ogiyahagi/`);
            const tweetURL = `https://x.com/intent/tweet?text=${tweetText}`;
            window.open(tweetURL, "_blank");
        });
        uiContainer.addChild(tweetBtn);
        changeButtonColor(tweetBtn, '0x999999');

        // フェードイン
        app.ticker.add(function fadeInResult(delta) {
            resultContainer.alpha += 0.05 * delta;
            if (resultContainer.alpha >= 1) app.ticker.remove(fadeInResult);
        });
    }

    // 汎用ボタン作成
    function createButton(label, x, y, fontsize = 40, round = 10) {
        const container = new PIXI.Container();
        const bg = new PIXI.Graphics();
        if (colorFlg && label === 'OGI') {
            bg.beginFill(0xff2222);
        } else if (colorFlg && label === 'HAGI') {
            bg.beginFill(0xffcc00);
        } else {
            bg.beginFill(0xdddddd);
        }
        bg.drawRoundedRect(-60, -30, 120, 70, round);
        bg.endFill();
        const text = new PIXI.Text(label, {
            fill: 0x333333, fontSize: fontsize,
            fontWeight: 'bold',
        });
        text.anchor.set(0.5);
        text.y += 5;
        container.addChild(bg, text);
        container.position.set(x, y);
        container.interactive = true;
        container.buttonMode = true;
        return container;
    }

    // 汎用ボタンの事後色替え
    function changeButtonColor(buttonContainer, newColor, flg = 1) {
        const bg = buttonContainer.getChildAt(0); // 背景 Graphics を取得
        bg.clear();
        bg.beginFill(newColor);
        if (flg === 0) {
            // 真ん中
            bg.drawRoundedRect(-45, -30, 90, 70, 30);
        } else {
            // 左右
            bg.drawRoundedRect(-60, -30, 120, 70, 10); // 元と同じサイズで再描画
        }
        bg.endFill();
    }

    // ユーティリティ
    function randomFrom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // フェード用
    const darkOverlay2 = new PIXI.Graphics();
    darkOverlay2.beginFill(0x000000, 1.0);
    darkOverlay2.drawRect(0, 0, app.screen.width, app.screen.height);
    darkOverlay2.endFill();
    darkOverlay2.alpha = 0;
    uiContainer.addChild(darkOverlay2);

    if (!startFlg) {
        // フェードイン
        gsap.to(darkOverlay2, {
            alpha: 0,
            duration: 0.5,
            onComplete: () => {
                startFlg = true;
                respawnWord()
            }
        });
    }
    return mainScene;

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
        app.stage.addChild(uiContainer);
    } else if (scene === 'main') {
        currentScene = createMainScene();
        app.stage.addChild(currentScene);
        app.stage.addChild(uiContainer);
    }
}

switchScene('title');