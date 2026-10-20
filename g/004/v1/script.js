import { TextFactory } from './class/TextFactory.js'; // BinaryTreeクラスをインポート
import { RectButtonWithText } from './class/RectButtonWithText.js'; // ButtonWithTextクラスをインポート

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
app.renderer.backgroundColor = 0xeeeeff;        // 背景色の設定
//app.renderer.view.style.border = "2px dashed black";  // canvasを点線枠で囲う（確認用）

/** 
 * ゲーム全体で使用する変数の定義
 * (AallVar)
 */
let currentScene;               // 現在のシーン
let level = 0;                  // ゲームのレベル
let mergeNum = 0;               // 数字を合体させた数
let plusFive = 0;               // 足して５で消した数
let sameNum = 0;                // 同じ数字で消した数
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

// UIエリア（上）
const uiBackgroundU = new PIXI.Graphics();
uiBackgroundU.beginFill(0xFFFFF0);  // 薄いベージュ色
uiBackgroundU.drawRect(0, 0, 360, 150);  // UIエリアの位置とサイズ
uiBackgroundU.endFill();
uiContainer.addChild(uiBackgroundU);

// UIエリア（下）
const uiBackgroundD = new PIXI.Graphics();
uiBackgroundD.beginFill(0xFFFFF0);  // 薄いベージュ色
uiBackgroundD.drawRect(0, 480, 360, 200);  // UIエリアの位置とサイズ
uiBackgroundD.endFill();
uiContainer.addChild(uiBackgroundD);

//背景：ロゴ四角
const logoBox = new PIXI.Graphics();
logoBox.lineStyle(2, 0xeeeeff, 1);
logoBox.beginFill(0xccccff);
logoBox.drawRect(0, 0, 360, 24)
logoBox.endFill();
logoBox.x = 0;
logoBox.y = 0;
uiContainer.addChild(logoBox);

//下線
var gs = new PIXI.Graphics();
gs.lineStyle(10, 0xeeeeff).moveTo(0, 16).lineTo(360, 16);
uiContainer.addChild(gs);

//デバッグ用テキスト
const logo_u = new TextFactory('足して５！', 19, '#000000');
uiContainer.addChild(logo_u); // スコア表示テキストを画面に追加する
logo_u.setBold(true);
logo_u.setItalic(true);                      // 斜体に変更
logo_u.setShadow(true, '0xFFFFF0', 5, 0);
logo_u.x = 5;
logo_u.y = 0;

//デバッグ用テキスト
const logo_u2 = new TextFactory('～または同じ数字で消すパズル～', 16, '#000000');
uiContainer.addChild(logo_u2); // スコア表示テキストを画面に追加する
logo_u2.setBold(true);
logo_u2.setItalic(true);                      // 斜体に変更
logo_u2.setShadow(true, '0xFFFFF0', 5, 0);
logo_u2.x = 102;
logo_u2.y = 2;

//デバッグ用テキスト
const text_u = new TextFactory('スコア:0', 19, '#000000');
uiContainer.addChild(text_u); // スコア表示テキストを画面に追加する
text_u.x = 10;
text_u.y = 152;

//デバッグ用テキスト
//const text_r = new TextFactory('エリア:999', 19, '#000000');
//uiContainer.addChild(text_r); // スコア表示テキストを画面に追加する
//text_r.x = 260;
//text_r.y = 152;

//背景：角丸四角形
const roundBox = new PIXI.Graphics();
roundBox.lineStyle(2, 0xeeeeff, 1);
roundBox.beginFill(0xeeeeff);
// drawRoundedRect(x, y, width, height, cornerRadius)
roundBox.drawRoundedRect(2, 0, 355, 118, 10)
roundBox.endFill();
roundBox.x = 0;
roundBox.y = 28;
uiContainer.addChild(roundBox);

//デバッグ用テキスト
const dtext = new TextFactory('　全ての数字を消そう！', 19, '#222222');
uiContainer.addChild(dtext); // スコア表示テキストを画面に追加する
dtext.x = 0;
dtext.y = 30;
//デバッグ用テキスト
const dtext1 = new TextFactory('　・１つ目の数字をタップ', 19, '#222222');
uiContainer.addChild(dtext1); // スコア表示テキストを画面に追加する
dtext1.x = 0;
dtext1.y = 53;
//デバッグ用テキスト
const dtext2 = new TextFactory('　・縦か横の２つ目の数字までスワイプ', 19, '#222222');
uiContainer.addChild(dtext2); // スコア表示テキストを画面に追加する
dtext2.x = 0;
dtext2.y = 76;
//デバッグ用テキスト
const dtext3 = new TextFactory('　・手を離すと数字が合体（最大値：５）', 19, '#222222');
uiContainer.addChild(dtext3); // スコア表示テキストを画面に追加する
dtext3.x = 0;
dtext3.y = 99;
//デバッグ用テキスト
const dtext4 = new TextFactory('　・足して５、同じ数字だと消えるよ', 19, '#222222');
uiContainer.addChild(dtext4); // スコア表示テキストを画面に追加する
dtext4.x = 0;
dtext4.y = 122;

/** 
 * メインシーン
 * (Amain)
 */
function createMainScene() {
    // 最初はレベル1から
    level++;

    // 上側テキストの初期表示
    text_u.text = `スコア:${answerCount}`;
    //text_r.text = `エリア:${level}`;

    // メインシーン作成
    const mainScene = new PIXI.Container();

    const GRID_SIZE = 5;
    const CELL_SIZE = 60;
    const OFFSET_X = 60;
    const OFFSET_Y = 205;
    let grid = [];
    let history = [];
    let initialGrid = [];
    let selectedCell = null;
    let dragTarget = null;
    let flgMoving = false;

    function createGrid() {
        let isSolvable = false;

        while (!isSolvable) {
            grid = [];
            let sum = 0;

            for (let x = 0; x < GRID_SIZE; x++) {
                grid[x] = [];
                for (let y = 0; y < GRID_SIZE; y++) {
                    const number = Math.floor(Math.random() * 4) + 1; // 1～3のランダムな数
                    sum += number;
                    const cell = createCell(x, y, number);
                    grid[x][y] = cell;
                }
            }

            // **合計が偶数ならクリア可能なのでOK**
            if (sum % 2 === 0) {
                isSolvable = true;
            }
        }

        initialGrid = copyGrid();
        grid.flat().forEach(cell => mainScene.addChild(cell));
        gridView();
    }

    function createCell(x, y, number) {
        const container = new PIXI.Container();
        container.interactive = true;
        container.buttonMode = true;
        container.number = number;

        const circle = new PIXI.Graphics();
        circle.beginFill(0x0099ff);
        circle.drawCircle(0, 0, 25);
        circle.endFill();

        const text = new PIXI.Text(number, {
            fontSize: 20,
            fill: 0xffffff
        });
        text.anchor.set(0.5);

        container.addChild(circle);
        container.addChild(text);

        container
            .on('pointerdown', () => startSelection(container))
            .on('pointerup', () => endSelection(container))
            .on('pointerover', () => dragOver(container));

        return container;
    }

    function gridView() {
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                const cell = grid[x][y];
                if (cell) {
                    cell.x = x * CELL_SIZE + OFFSET_X;
                    cell.y = y * CELL_SIZE + OFFSET_Y;
                }
            }
        }
    }

    function startSelection(cell) {
        if (!flgMoving) {
            // 初期化
            highlightSelectedCell(selectedCell, false);
            highlightSelectedCell(dragTarget, false);
            dragTarget = null;
            // 選択処理
            selectedCell = cell;
            highlightSelectedCell(cell, true);
        }
    }

    function dragOver(cell) {
        if (selectedCell && areAdjacent(selectedCell, cell)) {
            if (dragTarget && dragTarget != cell) {
                highlightSelectedCell(dragTarget, false);
            }
            dragTarget = cell;
            highlightSelectedCell(cell, true);
        }
    }

    function endSelection(cell) {

        if (selectedCell != cell) {
            if (dragTarget && areAdjacent(selectedCell, dragTarget)) {
                handleCellClick(dragTarget);
            } else if (selectedCell && areAdjacent(selectedCell, cell)) {
                handleCellClick(cell);
            }
            highlightSelectedCell(selectedCell, false);
            highlightSelectedCell(dragTarget, false);
            selectedCell = null;
            dragTarget = null;
        } else {
            highlightSelectedCell(selectedCell, false);
            highlightSelectedCell(dragTarget, false);
            selectedCell = null;
            dragTarget = null;
        }

    }

    // 操作抑止用
    const overlay_cl = new PIXI.Graphics();
    overlay_cl.beginFill(0x000000, 0); // 黒に近いグレー、透明度0.5
    overlay_cl.drawRect(0, 150, app.screen.width, 330);
    overlay_cl.endFill();
    overlay_cl.interactive = true; // 元の画面を操作させない

    function animateCellMoveAndFade(cell, target, onComplete) {
        // 移動中の操作制御
        flgMoving = true;
        mainScene.addChild(overlay_cl);

        // 移動アニメーション
        gsap.to(cell, {
            x: target.x,
            y: target.y,
            duration: 0.2,
            ease: 'power2.out',
            onComplete: () => {
                // 移動後の拡大＆フェードアウトアニメーション
                gsap.to(cell.scale, { x: 1.5, y: 1.5, duration: 0.2 });
                gsap.to(cell, {
                    alpha: 0, duration: 0.2, onComplete: () => {
                        cell.visible = false; // 完全に消去
                        if (onComplete) onComplete(); // 後続処理を実行
                    }
                });
            }
        });
    }


    function handleCellClick(cell) {
        if (!selectedCell) return;

        history.push(copyGrid());

        mergeNum++;

        let diff;
        if (selectedCell.number === cell.number) {
            diff = 0;
        } else {
            diff = selectedCell.number + cell.number;
            if (diff > 5) {
                answerCount += (5 * 11);
                diff -= 5;
            }

        }

        selectedCell.children[1].text = diff;
        cell.number = diff;
        cell.children[1].text = diff;

        if (diff === 5 || diff === 0) {
            if (diff == 5) {
                plusFive++;
                answerCount += (5 * 1111);
            } else {
                sameNum++;
                answerCount += ((selectedCell.number * 2) * 100);
            }

            grid[getGridX(cell)][getGridY(cell)] = null;
            mainScene.removeChild(cell);


        }

        grid[getGridX(selectedCell)][getGridY(selectedCell)] = null;

        animateCellMoveAndFade(selectedCell, cell, () => {
            scoreReload();

            mainScene.removeChild(selectedCell);

            collapseGrid();
            shiftColumns();
            shiftColumns();

            // 操作制御解除
            mainScene.removeChild(overlay_cl);
            flgMoving = false;

            if (checkClear()) {
                //level++;
                showClearEffect();
                //renewGame();
            } else {
                gridView();
            }

        });

    }

    function highlightSelectedCell(cell, highlight) {
        if (!cell) return;
        cell.children[0].clear();
        cell.children[0].beginFill(highlight ? 0xff9900 : 0x0099ff);
        cell.children[0].drawCircle(0, 0, 25);
        cell.children[0].endFill();
    }

    function areAdjacent(cell1, cell2) {
        const dx = Math.abs(getGridX(cell1) - getGridX(cell2));
        const dy = Math.abs(getGridY(cell1) - getGridY(cell2));
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }

    function collapseGrid() {
        for (let x = 0; x < GRID_SIZE; x++) {
            let emptyCount = 0;
            for (let y = GRID_SIZE - 1; y >= 0; y--) {
                if (!grid[x][y]) {
                    emptyCount++;
                } else if (emptyCount > 0) {
                    grid[x][y + emptyCount] = grid[x][y];
                    grid[x][y] = null;
                }
            }
        }
    }

    function shiftColumns() {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (grid[x].every(cell => !cell)) {
                for (let shiftX = x; shiftX < GRID_SIZE - 1; shiftX++) {
                    grid[shiftX] = grid[shiftX + 1];
                }
                grid[GRID_SIZE - 1] = Array(GRID_SIZE).fill(null);
            }
        }
    }

    function scoreReload() {
        text_u.text = `スコア:${answerCount}`;
    }

    function checkClear() {
        return grid.flat().every(cell => !cell);
    }

    function copyGrid() {
        return grid.map(row =>
            row.map(cell =>
                (cell ? { x: getGridX(cell), y: getGridY(cell), number: cell.number } : null)
            )
        );
    }

    function undo() {
        if (history.length === 0) return;
        const prevGrid = history.pop();
        mainScene.removeChildren();
        prevGrid.forEach((row, x) => {
            row.forEach((cellData, y) => {
                if (cellData) {
                    const cell = createCell(cellData.x, cellData.y, cellData.number);
                    grid[x][y] = cell;
                    mainScene.addChild(cell);
                } else {
                    grid[x][y] = null;
                }
            });
        });
        gridView();
    }

    function resetGame() {
        history = [];
        mainScene.removeChildren();
        grid = initialGrid.map(row =>
            row.map(cellData =>
                cellData ? createCell(cellData.x, cellData.y, cellData.number) : null
            )
        );
        grid.flat().forEach(cell => { if (cell) mainScene.addChild(cell); });
        gridView();
    }

    function renewGame() {
        mainScene.removeChildren();
        history = [];
        //createGrid();
        // 次のステージへ
        switchScene('main');

    }

    function getGridX(cell) {
        return Math.round((cell.x - OFFSET_X) / CELL_SIZE);
    }

    function getGridY(cell) {
        return Math.round((cell.y - OFFSET_Y) / CELL_SIZE);
    }

    // 補助ボタン
    const undoButton = new RectButtonWithText(2, 490, 120, 50, 0xddffff, '一つ戻る', 22, 0x000000);
    undoButton.setOnClick(() => {
        undo();
    });
    uiContainerD.addChild(undoButton);

    const resetButton = new RectButtonWithText(130, 490, 120, 50, 0xffddff, '最初に戻る', 22, 0x000000);
    resetButton.setOnClick(() => {
        resetGame();
    });
    uiContainerD.addChild(resetButton);

    const renewButton = new RectButtonWithText(260, 495, 95, 40, 0xffdd99, '問題変更', 19, 0x000000);
    renewButton.setOnClick(() => {
        mainScene.addChild(dialogContainer);
        gsap.to(dialogContainer, { alpha: 1, duration: 0.5 });
        //dialogContainer.visible = true;
    });
    uiContainerD.addChild(renewButton);

    // 問題変更ボタンの処理
    // ダイアログ関係のコンテナ
    const dialogContainer = new PIXI.Container();
    dialogContainer.alpha = 0;
    //dialogContainer.visible = false;

    // 半透明グレーの背景
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.5); // 黒に近いグレー、透明度0.5
    overlay.drawRect(0, 0, app.screen.width, app.screen.height);
    overlay.endFill();
    overlay.interactive = true; // 元の画面を操作させない
    dialogContainer.addChild(overlay);

    // ダイアログボックス
    const dialogBox = new PIXI.Graphics();
    dialogBox.beginFill(0xffffff);
    dialogBox.drawRoundedRect(30, 205, 300, 235, 16); // 角丸
    dialogBox.endFill();
    dialogContainer.addChild(dialogBox);

    // メッセージテキスト
    const messageDialog = new TextFactory('この問題をスキップし、\n新しい問題に変更します。\nよろしいですか？', 20, '0x000000');
    messageDialog.setLineHeight(20 * 1.5);                // 行間を変更
    messageDialog.setAlign("center");                   // 揃え位置を変更
    messageDialog.x = 65;
    messageDialog.y = 235;
    dialogContainer.addChild(messageDialog);

    // 「はい」ボタン
    const yesButton = new RectButtonWithText(55, 345, 110, 50, 0xddffff, 'はい', 18, 0x000000);
    yesButton.setOnClick(() => {
        gsap.to(dialogContainer, { alpha: 0, duration: 0.3 });
        //dialogContainer.visible = false;
        level--;
        renewGame();
    });
    dialogContainer.addChild(yesButton);

    // 「いいえ」ボタン
    const noButton = new RectButtonWithText(195, 345, 110, 50, 0xffddff, 'いいえ', 18, 0x000000);
    noButton.setOnClick(() => {
        //dialogContainer.visible = false;
        gsap.to(dialogContainer, {
            alpha: 0, duration: 0.3, onComplete: () => {
                mainScene.removeChild(dialogContainer);
            }
        });
    });
    dialogContainer.addChild(noButton);

    // クリア時のお祝い
    // 紙吹雪制御用
    let confettiInterval = null;
    // 花吹雪の色の候補
    const confettiColors = [0xff6666, 0xffcc66, 0x66cc66, 0x66ccff, 0xcc99ff];

    // 花吹雪を1つ生成する関数
    function createConfettiPiece() {
        const size = Math.random() * 8 + 6;
        const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];

        const confetti = new PIXI.Graphics();
        confetti.beginFill(color);
        confetti.drawRect(0, 0, size, size * 0.4);
        confetti.endFill();

        confetti.x = Math.random() * app.screen.width;
        confetti.y = -size;
        confetti.rotation = Math.random() * Math.PI;

        mainScene.addChild(confetti);

        gsap.to(confetti, {
            y: app.screen.height + 20,
            x: confetti.x + (Math.random() * 100 - 50),
            rotation: confetti.rotation + Math.PI * 4,
            duration: 3 + Math.random() * 2,
            ease: 'sine.in',
            onComplete: () => {
                mainScene.removeChild(confetti);
            }
        });
    }

    // y座標範囲付きで花吹雪をスタート
    function startConfetti(yRange = [0, 0]) {
        confettiInterval = setInterval(() => {
            for (let i = 0; i < 5; i++) {
                createConfettiPiece();
            }
        }, 100);

    }

    // ゲームクリア演出
    function showClearEffect() {
        // 戻るボタンとかを逃がしておく
        uiContainerD.x += 400;

        // 紙吹雪
        startConfetti([0, app.screen.height]);

        // ① 円の作成
        const circle = new PIXI.Graphics();
        circle.beginFill(0xffffcc);
        circle.drawCircle(0, 0, 5);
        circle.endFill();
        circle.x = app.screen.width / 2;
        circle.y = 350;
        circle.scale.set(0.01);
        mainScene.addChild(circle);

        // ② テキストの作成（初期は透明）
        const message = new TextFactory('お見事！', 48, '0xff4081');
        message.anchor.set(0.5);
        message.x = app.screen.width / 2 + 10;
        message.y = 230;
        message.alpha = 0;
        message.setAlign("center");
        mainScene.addChild(message);

        //下線
        var mess = new PIXI.Graphics();
        mess.lineStyle(10, 0xeeeeff).moveTo(0, 275).lineTo(360, 275);
        //mess.alpha=0;
        mainScene.addChild(mess);

        const result_plus = new TextFactory('　', 22, '#000000');
        mainScene.addChild(result_plus); // スコア表示テキストを画面に追加する
        result_plus.text = `・足して５で消した数：${plusFive}`;
        result_plus.alpha = 0;
        result_plus.x = 10;
        result_plus.y = 290;

        const result_same = new TextFactory('　', 22, '#000000');
        mainScene.addChild(result_same); // スコア表示テキストを画面に追加する
        result_same.text = `・同じ数字で消した数：${sameNum}`;
        result_same.alpha = 0;
        result_same.x = 10;
        result_same.y = 325;

        const result_merge = new TextFactory('　', 22, '#000000');
        mainScene.addChild(result_merge); // スコア表示テキストを画面に追加する
        result_merge.text = `・数字を合体させた数：${mergeNum}`;
        result_merge.alpha = 0;
        result_merge.x = 10;
        result_merge.y = 360;

        //下線
        var mess2 = new PIXI.Graphics();
        mess2.lineStyle(10, 0xeeeeff).moveTo(0, 400).lineTo(360, 400);
        mainScene.addChild(mess2);

        const result_thanks = new TextFactory('', 18, '#000000');
        mainScene.addChild(result_thanks); // スコア表示テキストを画面に追加する
        result_thanks.alpha = 0;
        result_thanks.x = 35;
        result_thanks.y = 420;
        result_thanks.setLineHeight(18 * 1.5);
        result_thanks.setAlign("center");
        let resultMes = "";
        if (level == 1) {
            resultMes = "ここまで遊んでくれてありがとう！\n良ければぜひまた遊んでね。";
        } else {
            resultMes = `　　クリアした回数：${level}\n　　　自分の限界に挑戦だ！`;
        }
        result_thanks.text = resultMes;

        const nextButton = new RectButtonWithText(70, 490, 210, 50, 0xffffaa, '新しい問題へ！', 24, 0x000000);
        nextButton.setOnClick(() => {
            clearInterval(confettiInterval);    // 紙吹雪を止める
            uiContainerD.x -= 400;  // 戻るボタンとかを戻しておく
            renewGame();
        });
        nextButton.alpha = 0;
        mainScene.addChild(nextButton);

        // ③ 円を拡大 → テキストフェードイン → 紙吹雪
        const tl = gsap.timeline(); // はじめに初期化
        tl.to(circle.scale, {
            x: 35,
            y: 35,
            duration: 0.7,
            ease: 'power2.out',
        });
        tl.to(nextButton, { alpha: 1, duration: 0.0 });
        tl.to(message, {
            alpha: 1,
            duration: 0.2,
        });
        tl.to(result_plus, { alpha: 1, duration: 0.2 });
        tl.to(result_same, { alpha: 1, duration: 0.2 });
        tl.to(result_merge, { alpha: 1, duration: 0.2 });
        tl.to(result_thanks, { alpha: 1, duration: 0.2 });

    }


    // 🎯 ゲームクリア時にこの関数を呼び出す！
    //showClearEffect();

    createGrid();

    return mainScene;

}

// シーン遷移
function switchScene(scene) {
    // すべてのシーンを削除
    app.stage.removeChildren(); // すべての小要素削除
    app.ticker.remove();        // 名無しのコールバック関数削除できていると信じたい
    // シーンの遷移
    if (scene === 'main') {
        startFlg = true;
        // UIの表示
        app.stage.addChild(uiContainer);
        app.stage.addChild(uiContainerD);
        currentScene = createMainScene();
        app.stage.addChild(currentScene);
    }
}

switchScene('main');