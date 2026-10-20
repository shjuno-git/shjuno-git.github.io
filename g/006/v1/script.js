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
let currentStageIndex = 0;
let missCnt = 0;
let startFlg = false;
let startTime = Date.now();     // ゲーム開始時間
let clearTime = Date.now();

// UI用のコンテナ（スコア表示やボタンなど）
let uiContainer = new PIXI.Container();

/** 
 * タイトルシーン
 * (Atitle)
 */
function createTitleScene() {
    // メインシーン作成
    const titleScene = new PIXI.Container();

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

    const CELL = 20;
    const ROWS = 22;
    const COLS = 18;
    const gameHeight = 460;
    const controlHeight = 100;
    let isMoving = true;

    // 上IF
    const UIArea = new PIXI.Graphics();
    UIArea.beginFill(0x444444);
    UIArea.drawRect(0, 0, app.screen.width, 40);
    UIArea.endFill();

    // 下IF
    const controlArea = new PIXI.Graphics();
    controlArea.beginFill(0x444444);
    controlArea.drawRect(0, gameHeight, app.screen.width, controlHeight);
    controlArea.endFill();

    const controlText = new PIXI.Text('画面タッチで方向転換\n障害物をよけてゴールを目指そう！', {
        fill: '#ffffff',
        fontSize: 20
    });
    controlText.x = 10;
    controlText.y = gameHeight + 5;

    // ステージ定義
    const stages = [
        {
            "start": {
                "x": 2,
                "y": 4
            },
            "goal": {
                "x": 13,
                "y": 18
            },
            "walls": [[6, 10], [6, 9], [7, 9], [11, 9], [10, 9], [9, 9], [8, 9], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [11, 11], [10, 11], [9, 11], [8, 11], [7, 11], [6, 11], [6, 12], [7, 13], [8, 13], [9, 13], [10, 13], [11, 13], [11, 12], [10, 12], [9, 12], [8, 12], [7, 12], [6, 13], [6, 14], [7, 14], [9, 14], [10, 14], [11, 14], [6, 15], [6, 16], [17, 1], [17, 2], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [18, 9], [17, 8], [17, 9], [17, 10], [18, 10], [18, 11], [18, 13], [17, 12], [17, 11], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [18, 18], [17, 19], [17, 20], [17, 21], [17, 22], [17, 23], [0, 22], [0, 21], [0, 20], [0, 19], [0, 18], [0, 17], [0, 16], [0, 15], [0, 14], [0, 13], [0, 12], [0, 11], [0, 10], [0, 9], [0, 8], [0, 7], [0, 6], [0, 5], [0, 4], [0, 3], [0, 2], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [0, 23], [1, 23], [2, 23], [3, 23], [4, 23], [5, 23], [6, 23], [7, 23], [8, 23], [9, 23], [10, 23], [11, 23], [12, 23], [13, 23], [14, 23], [15, 23], [16, 23], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [1, 22], [2, 22], [3, 22], [4, 22], [5, 22], [8, 22], [10, 22], [11, 22], [12, 22], [13, 22], [14, 22], [15, 22], [16, 22], [9, 22], [7, 22], [6, 22], [11, 8], [11, 7], [8, 14], [10, 8], [10, 7], [7, 16], [7, 15], [9, 8], [9, 7], [8, 15], [8, 16]],
            "movingWalls": [

            ]
        },
        {
            "start": {
                "x": 2,
                "y": 4
            },
            "goal": {
                "x": 4,
                "y": 19
            },
            "walls": [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [11, 2], [10, 2], [9, 2], [8, 2], [7, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 15], [0, 17], [0, 18], [0, 19], [0, 20], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [16, 22], [15, 22], [14, 22], [13, 22], [12, 22], [11, 22], [10, 22], [9, 22], [8, 22], [7, 22], [6, 23], [4, 23], [3, 23], [3, 22], [4, 22], [5, 22], [6, 22], [2, 22], [1, 22], [0, 22], [0, 21], [1, 7], [2, 7], [3, 7], [3, 8], [2, 8], [1, 8], [4, 7], [4, 8], [0, 16], [8, 15], [9, 15], [10, 15], [10, 16], [9, 16], [8, 16], [11, 15], [11, 16]],
            "movingWalls": [
                {
                    type: "linear",
                    x: 6, y: 7,
                    dx: 2, dy: 0,
                    range: 60,
                    duration: 2
                },
                {
                    type: "linear",
                    x: 11, y: 11,
                    dx: 0, dy: 2,
                    range: 100,
                    duration: 2.5
                },
            ]
        },
        {
            "start": {
                "x": 2,
                "y": 4
            },
            "goal": {
                "x": 2,
                "y": 10
            },
            "walls": [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [11, 2], [10, 2], [9, 2], [8, 2], [7, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 15], [0, 17], [0, 18], [0, 19], [0, 20], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [16, 22], [15, 22], [14, 22], [13, 22], [12, 22], [11, 22], [10, 22], [9, 22], [8, 22], [7, 22], [6, 23], [4, 23], [3, 23], [3, 22], [4, 22], [5, 22], [6, 22], [2, 22], [1, 22], [0, 22], [0, 21], [0, 16], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [7, 14], [8, 14], [9, 14], [10, 14], [11, 14], [8, 15], [9, 15], [10, 15], [11, 15], [7, 15], [6, 14], [6, 15], [8, 13], [8, 16], [9, 16], [9, 13]],
            "movingWalls": [
                {
                    type: "circle",
                    cx: 9 * CELL, cy: 15 * CELL,
                    radius: 4 * CELL,
                    speed: 0.02
                },
                {
                    type: "circle",
                    cx: 9 * CELL, cy: 15 * CELL,
                    radius: 6 * CELL,
                    speed: 0.03
                },
            ]
        },
        {
            "start": {
                "x": 2,
                "y": 4
            },
            "goal": {
                "x": 13,
                "y": 4
            },
            "walls": [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [11, 2], [10, 2], [9, 2], [8, 2], [7, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 15], [0, 16], [0, 17], [0, 18], [0, 19], [0, 20], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [16, 22], [15, 22], [14, 22], [13, 22], [12, 22], [11, 22], [10, 22], [9, 22], [8, 22], [7, 22], [6, 23], [4, 23], [3, 23], [3, 22], [4, 22], [5, 22], [6, 22], [2, 22], [1, 22], [0, 22], [0, 21], [11, 3], [11, 4], [11, 5], [11, 6], [1, 10], [2, 10], [3, 10], [4, 10], [11, 10], [5, 16]],
            "movingWalls": [
                {
                    type: "linear",
                    x: 4.5, y: 10.5,
                    dx: 1, dy: 0,
                    range: 140,
                    duration: 3
                },
                {
                    "type": "snake",
                    "x": 5.5,
                    "y": 16.5,
                    "dx": 12,
                    "dy": 0,
                    "duration": 2.0,
                    "frequency": 4,
                    "amp": 30
                },
                {
                    "type": "snake",
                    "x": 11.5,
                    "y": 6.5,
                    "dx": 0,
                    "dy": 16,
                    "duration": 3.0,
                    "frequency": 8,
                    "amp": 30
                }
            ]
        },
        {
            "start": {
                "x": 2,
                "y": 4
            },
            "goal": {
                "x": 15,
                "y": 16
            },
            "walls": [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [11, 2], [10, 2], [9, 2], [8, 2], [7, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 15], [0, 16], [0, 17], [0, 18], [0, 19], [0, 20], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [18, 7], [18, 8], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [16, 22], [15, 22], [14, 22], [13, 22], [12, 22], [11, 22], [10, 22], [9, 22], [8, 22], [7, 22], [6, 23], [4, 23], [3, 23], [3, 22], [4, 22], [5, 22], [6, 22], [2, 22], [1, 22], [0, 22], [0, 21], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [11, 14], [12, 14], [13, 14], [14, 14], [15, 14], [16, 14], [1, 14], [2, 14], [3, 14], [4, 14], [16, 18], [15, 18], [14, 18], [13, 18], [12, 18], [11, 18], [4, 10], [13, 10], [4, 18], [10, 14]],
            "movingWalls": [
                {
                    type: "linear",
                    x: 4.5, y: 14.5,
                    dx: 1, dy: 0,
                    range: 120,
                    duration: 3
                },
                {
                    type: "circle",
                    cx: 13.5 * CELL, cy: 10.5 * CELL,
                    radius: 60,
                    speed: 0.02
                },
                {
                    type: "random",
                    x: 4.5, y: 18.5,
                    minX: 3 * CELL, maxX: 6 * CELL,
                    minY: 17 * CELL, maxY: 19 * CELL,
                    duration: 0.8
                },
                {
                    "type": "snake",
                    "x": 13.5,
                    "y": 10.5,
                    "dx": 0,
                    "dy": 14,
                    "duration": 3.0,
                    "frequency": 6,
                    "amp": 20
                }
            ]

        }
    ];


    const gameArea = new PIXI.Container();
    mainScene.addChild(gameArea);

    // 自機
    const player = new PIXI.Container();
    // 三角
    const pTriangle = new PIXI.Graphics();
    pTriangle.beginFill(0xff0000);
    pTriangle.moveTo(0, 0);  // 右側の頂点
    pTriangle.lineTo(20, 10); // 左側の頂点
    pTriangle.lineTo(0, 20);    // 下側の頂点
    //player.drawRect(-10, -10, 20, 20);
    pTriangle.endFill();
    // 中心円
    const pCircle = new PIXI.Graphics();
    pCircle.lineStyle(1, 0xffcccc);
    pCircle.beginFill(0xffcccc);
    pCircle.drawCircle(9, 9.5, 2);
    pCircle.endFill();
    pCircle.lineStyle();

    gameArea.addChild(player);
    player.pivot.set(10, 10);
    player.addChild(pTriangle);
    player.addChild(pCircle);


    // GOAL
    const goal = new PIXI.Container();
    const glaGoal = new PIXI.Graphics();
    glaGoal.beginFill(0x00ff00);
    glaGoal.drawRect(0, 0, CELL * 2, CELL * 2);
    glaGoal.endFill();
    // TEXT_GOAL
    const textGoal = new PIXI.Text('GOAL', {
        fill: '#000000',
        fontSize: 14
    });
    gameArea.addChild(goal);
    goal.addChild(glaGoal);
    goal.addChild(textGoal);

    // エリア
    const wallGraphics = new PIXI.Graphics();
    gameArea.addChild(wallGraphics);

    // 動く物体
    const movingWalls = [];
    const movingWallTickers = new Map(); // 壁ごとのticker関数を保存
    setupMovingWalls(getCurrentStage().movingWalls);

    function setupMovingWalls(dataArray) {
        dataArray.forEach(data => {
            const wall = new PIXI.Graphics();
            wall.beginFill(0x999999);
            wall.drawRect(-CELL / 2, -CELL / 2, CELL, CELL);
            wall.endFill();
            gameArea.addChild(wall);

            let tickerFunc;

            // 各タイプごとの処理
            switch (data.type) {
                case "linear":
                    // 初期位置
                    const baseX = data.x * CELL;
                    const baseY = data.y * CELL;
                    wall.x = baseX;
                    wall.y = baseY;

                    let time = 0;
                    const durationLnr = data.duration || 2; // 秒

                    // 補間関数（sine.inOut）を往復運動に変換
                    function easeSineWave(t) {
                        // t: 経過時間（秒単位）
                        // 戻り値: -1 ～ +1 のサイン波を 0 ～ 1 にマッピング
                        return (Math.sin((t / durationLnr) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
                    }

                    tickerFunc = (delta) => {
                        const deltaTime = delta / app.ticker.FPS; // 秒
                        time += deltaTime;

                        const eased = easeSineWave(time);

                        wall.x = baseX + data.dx * data.range * eased;
                        wall.y = baseY + data.dy * data.range * eased;
                    };

                    app.ticker.add(tickerFunc);
                    movingWallTickers.set(wall, tickerFunc); // 対応を保存
                    break;

                case "circle":
                    let angle = 0;
                    // 識別可能なticker関数を定義
                    tickerFunc = (delta) => {
                        angle += data.speed || 0.03;
                        wall.x = data.cx + Math.cos(angle) * data.radius;
                        wall.y = data.cy + Math.sin(angle) * data.radius;
                    };

                    app.ticker.add(tickerFunc);
                    movingWallTickers.set(wall, tickerFunc); // 対応を保存
                    break;

                case "random":
                    wall.x = data.x * CELL;
                    wall.y = data.y * CELL;

                    let startX, startY, targetX, targetY;
                    let elapsed = 0;
                    let duration = data.duration || 1; // 秒数（GSAPと同じスケール）

                    // 補間用の easing 関数（sine.inOut）
                    function easeSineInOut(t) {
                        return -(Math.cos(Math.PI * t) - 1) / 2;
                    }

                    // 次のランダム位置を設定
                    function setNewTarget() {
                        startX = wall.x;
                        startY = wall.y;
                        targetX = data.minX + Math.random() * (data.maxX - data.minX);
                        targetY = data.minY + Math.random() * (data.maxY - data.minY);
                        elapsed = 0;
                    }

                    setNewTarget();

                    tickerFunc = (delta) => {
                        // delta はおおよそ 1フレームあたり 1（ただし時間に応じて変動）
                        // app.ticker.maxFPS が 60 なら 1フレーム ≒ 1/60秒
                        const deltaTime = delta / app.ticker.FPS; // 実時間（秒）

                        elapsed += deltaTime;

                        const t = Math.min(elapsed / duration, 1);
                        const easedT = easeSineInOut(t);

                        wall.x = startX + (targetX - startX) * easedT;
                        wall.y = startY + (targetY - startY) * easedT;

                        if (t >= 1) {
                            setNewTarget();
                        }
                    };

                    app.ticker.add(tickerFunc);
                    movingWallTickers.set(wall, tickerFunc); // 対応を保存
                    break;

                case "snake":
                    let t = 0;
                    const totalFrames = data.duration * 60;
                    const start = { x: data.x * CELL, y: data.y * CELL };
                    const end = { x: data.x * CELL + data.dx * CELL, y: data.y * CELL + data.dy * CELL };

                    // 正規化ベクトル
                    const dir = { x: data.dx * CELL, y: data.dy * CELL };
                    const len = Math.sqrt(data.dx * CELL * data.dx * CELL + data.dy * CELL * data.dy * CELL);
                    const norm = { x: dir.x / len, y: dir.y / len };
                    // 垂直ベクトル（右手回り 90度）
                    const perp = { x: -norm.y, y: norm.x };

                    // 識別可能なticker関数を定義
                    tickerFunc = (delta) => {
                        t++;
                        const progress = (t % totalFrames) / totalFrames; // [0,1) ループ

                        // 線形移動
                        const px = start.x + data.dx * CELL * progress;
                        const py = start.y + data.dy * CELL * progress;

                        // 波形によるうねり（垂直方向）
                        const offset = Math.sin(progress * Math.PI * 2 * data.frequency) * data.amp;
                        wall.x = px + perp.x * offset;
                        wall.y = py + perp.y * offset;
                    };

                    app.ticker.add(tickerFunc);
                    movingWallTickers.set(wall, tickerFunc); // 対応を保存

                    //                    app.ticker.add(() => {
                    //                    });
                    break;
            }

            movingWalls.push(wall);
        });
    }

    // エフェクト
    const effects = new PIXI.Container();
    gameArea.addChild(effects);

    function emitSmoke(x, y, dir) {
        const size = 5;
        for (let dx = -2.5; dx < 2.5; dx += size) {
            for (let dy = -2.5; dy < 2.5; dy += size) {
                const piece = new PIXI.Graphics();
                piece.beginFill(0xcccccc);
                piece.drawRect(0, 0, size, size);
                piece.endFill();
                piece.alpha = 0.5;
                switch (direction) {
                    case 0: piece.x = player.x - 10 + dx; piece.y = player.y + dy; break;
                    case 1: piece.x = player.x + dx; piece.y = player.y - 10 + dy; break;
                    case 2: piece.x = player.x + 10 + dx; piece.y = player.y + dy; break;
                    case 3: piece.x = player.x + dx; piece.y = player.y + 10 + dy; break;
                }
                effects.addChild(piece);

                const angle = Math.random() * Math.PI * 2;
                const dist = 5 + Math.random() * 13;
                gsap.to(piece, {
                    x: piece.x + Math.cos(angle) * dist,
                    y: piece.y + Math.sin(angle) * dist,
                    alpha: 0,
                    duration: 0.6,
                    ease: "power2.out",
                    onComplete: () => effects.removeChild(piece)
                });
            }
        }
    }

    // UI定義
    const textStyle = new PIXI.TextStyle({
        fontFamily: "Arial",    // フォント
        fontSize: 20,           // フォントサイズ
        fill: 0xffffff,         // 色
        stroke: '#000000',      // 枠線
        strokeThickness: 1,     // 枠線の太さ
    });

    // ロゴUI定義
    const textStyle2 = new PIXI.TextStyle({
        fontFamily: "Arial",    // フォント
        fontStyle: 'italic',
        fontSize: 30,           // フォントサイズ
        fontWeight: 'bold',
        dropShadow: {
            color: '#00ff00',
            blur: 4,
            angle: Math.PI / 6,
            distance: 6,
        },
        fill: 0xffffff,         // 色
        stroke: '#ff0000',      // 枠線
        strokeThickness: 2,     // 枠線の太さ
    });

    // ロゴUI定義
    const textStyle3 = new PIXI.TextStyle({
        fontFamily: "Arial",    // フォント
        fontStyle: 'italic',
        fontSize: 24,           // フォントサイズ
        fontWeight: 'bold',
        dropShadow: {
            color: '#00ff00',
            blur: 4,
            angle: Math.PI / 6,
            distance: 6,
        },
        fill: 0xffffff,         // 色
        stroke: '#ff0000',      // 枠線
        strokeThickness: 2,     // 枠線の太さ
    });

    mainScene.addChild(UIArea);
    mainScene.addChild(controlArea);
    mainScene.addChild(controlText);

    // 固定文言表示用テキスト1
    const text_kotei1 = new PIXI.Text(`STAGE:1/5`, textStyle); // 結果画面のテキスト
    text_kotei1.x = 255; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
    text_kotei1.y = 10; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
    UIArea.addChild(text_kotei1); // 結果画面シーンにテキスト追加
    text_kotei1.text = `STAGE:${currentStageIndex + 1}/5`;

    // 固定文言表示用テキスト1
    const text_logo0 = new PIXI.Text(`タッチ★`, textStyle3); // 結果画面のテキスト
    text_logo0.x = 2; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
    text_logo0.y = 4; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
    UIArea.addChild(text_logo0); // 結果画面シーンにテキスト追加

    // 固定文言表示用テキスト1
    const text_logo = new PIXI.Text(`よけロケ！`, textStyle2); // 結果画面のテキスト
    text_logo.x = 95; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
    text_logo.y = 3; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
    UIArea.addChild(text_logo); // 結果画面シーンにテキスト追加

    // 固定文言表示用テキスト1
    const text_debug = new PIXI.Text(`x:0, y:0`, textStyle); // 結果画面のテキスト
    text_debug.x = 160; // 座標指定 (xのアンカーが0.5で中央指定なので、テキストのx値を画面中央にすると真ん中にテキストが表示される)
    text_debug.y = 10; // 座標指定 (yのアンカーはデフォルトの0なので、画面上から200の位置にテキスト表示)
    //UIArea.addChild(text_debug); // 結果画面シーンにテキスト追加


    let direction = 0;
    const speed = 2;

    function loadStage(index) {
        const stage = stages[index];
        wallGraphics.clear();
        wallGraphics.beginFill(0x333333);
        for (const [gx, gy] of stage.walls) {
            wallGraphics.drawRect(gx * CELL, gy * CELL, CELL, CELL);
        }
        wallGraphics.endFill();


        goal.x = stage.goal.x * CELL;
        goal.y = stage.goal.y * CELL;

        player.x = stage.start.x * CELL + CELL / 2;
        player.y = stage.start.y * CELL + CELL / 2;
        player.rotation = 0;
        direction = 0;
        startFlg = true;
    } 5

    function getCurrentStage() {
        return stages[currentStageIndex];
    }

    function checkCollision() {
        const px = Math.floor(player.x / CELL);
        const py = Math.floor(player.y / CELL);
        //text_debug.text = `x:${px}, y:${py}`;
        return getCurrentStage().walls.some(([x, y]) => x === px && y === py);
    }

    function checkMovingWallCollision() {
        for (const wall of movingWalls) {
            const dist = Math.abs(player.x - wall.x) + Math.abs(player.y - wall.y);
            if (dist < CELL * 0.5) return true;
        }
        return false;
    }

    function checkGoal() {
        const goalRect = new PIXI.Rectangle(goal.x - 5, goal.y - 5, CELL * 2 + 5, CELL * 2 + 5);
        return goalRect.contains(player.x, player.y);
    }

    function nextStage() {
        isMoving = false;
        if (!startFlg) return;
        app.ticker.remove(frameCheck);
        movingWallTickers.forEach((tickerFunc, wall) => {
            app.ticker.remove(tickerFunc);
        });
        startFlg = false;
        currentStageIndex++;
        if (currentStageIndex < stages.length) {
            switchScene('main');
            //loadStage(currentStageIndex);
        } else {
            //alert("全ステージクリア！");
            //currentStageIndex = 0;
            callResult()
            //loadStage(currentStageIndex);
            //switchScene('main');
        }
    }

    function resetPlayer() {
        missCnt++;
        text_debug.text = `${missCnt}`;
        loadStage(currentStageIndex);
    }

    app.ticker.add(frameCheck);

    function frameCheck() {
        if (!startFlg) return;
        const prevX = player.x;
        const prevY = player.y;
        //text_debug.text = `x:${prevX}, y:${prevY}`;

        switch (direction) {
            case 0: player.x += speed; break;
            case 1: player.y += speed; break;
            case 2: player.x -= speed; break;
            case 3: player.y -= speed; break;
        }

        emitSmoke(prevX, prevY, direction);

        if (checkCollision() || checkMovingWallCollision()) {
            startFlg = false;
            gsap.to(player, {
                alpha: 0, duration: 0.2, onComplete: () => {
                    resetPlayer();
                    player.alpha = 1;
                }
            });
        }

        if (checkGoal()) {
            //alert("ステージクリア！");
            //if (currentStageIndex >= 4) {
            //    callResult();
            //} else {
            nextStage();
            //}
        }
    }

    const touchArea1 = new PIXI.Graphics();
    touchArea1.beginFill(0x000000, 0).drawRect(0, 0, app.screen.width, app.screen.height).endFill();
    mainScene.addChild(touchArea1);
    touchArea1.interactive = true;
    touchArea1.buttonMode = true;
    // イベント処理
    touchArea1.on('pointerdown', () => {
        if(!startFlg)return;
        direction = (direction + 1) % 4;
        if (direction == 0) {
            gsap.to(player, {
                rotation: 4 * (Math.PI / 2) - 0.000001, duration: 0.2,
                onComplete: () => {
                    player.rotation = 0;
                }
            });
        } else {
            gsap.to(player, { rotation: direction * (Math.PI / 2), duration: 0.2 });
        }
    });
    /** 
    app.view.addEventListener('touchstart', (e) => {
        direction = (direction + 1) % 4;
        if (direction == 0) {
            gsap.to(player, {
                rotation: 4 * (Math.PI / 2) - 0.000001, duration: 0.2,
                onComplete: () => {
                    player.rotation = 0;
                }
            });
        } else {
            gsap.to(player, { rotation: direction * (Math.PI / 2), duration: 0.2 });
        }

   });
    */
    function callResult() {
        startFlg = false;

        // 時間
        clearTime = Date.now();

        // 経過時間を計算（ミリ秒）
        const elapsed = clearTime - startTime;

        // 分・秒・ミリ秒に変換
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const millis = Math.floor((elapsed % 1000) / 10);
        const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;

        const resultContainer = new PIXI.Container();
        resultContainer.alpha = 1;
        mainScene.addChild(resultContainer);

        // 背景ぼかしパネル
        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.3);
        bg.drawRoundedRect(5, 45, app.screen.width - 10, app.screen.height - 140, 20);
        bg.endFill();
        resultContainer.addChild(bg);

        // 金色グラデーションのテキストスタイル
        const redStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 36,
            fontWeight: 'bold',
            fill: ['#FF3030', '#FF0000', '#FF69B4'],
            fillGradientType: PIXI.TEXT_GRADIENT.LINEAR_VERTICAL,
            stroke: '#ffffff',
            strokeThickness: 6,
            dropShadow: true,
            dropShadowColor: '#FF4500',
            dropShadowBlur: 10,
            dropShadowAngle: Math.PI / 4,
            dropShadowDistance: 6
        });

        // 青系グラデーションのリザルトテキストスタイル
        const goldStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 46,
            fontWeight: 'bold',
            fill: ['gold', '#FFD700', '#FFA500'],
            fillGradientType: PIXI.TEXT_GRADIENT.LINEAR_VERTICAL,
            stroke: '#ffffff',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#FFD700',
            dropShadowBlur: 8,
            dropShadowAngle: Math.PI / 6,
            dropShadowDistance: 4
        });

        // 青色のリザルト
        const blueStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 24,
            fontWeight: 'bold',
            fill: ['#00BFFF', '#1E90FF', '#4169E1'],
            fillGradientType: PIXI.TEXT_GRADIENT.LINEAR_VERTICAL,
            stroke: '#ffffff',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#1E90FF',
            dropShadowBlur: 8,
            dropShadowAngle: Math.PI / 6,
            dropShadowDistance: 4
        });

        // リザルトテキスト
        const clearText = new PIXI.Text('CLEAR!!', goldStyle);
        clearText.anchor.set(0.5);
        clearText.x = app.screen.width / 2;
        clearText.y = 130;
        clearText.alpha = 0;
        resultContainer.addChild(clearText);

        // タイトルテキスト
        const title = new PIXI.Text('TOUCH★\nYOKE ROCKET', redStyle);
        title.anchor.set(0.5);
        title.x = app.screen.width / 2;
        title.y = 180;
        title.alpha = 0;
        resultContainer.addChild(title);

        // クリアタイム
        const clearTimeText = new PIXI.Text(`CLEAR TIME: ${timeString}`, blueStyle);
        clearTimeText.anchor.set(0.5);
        clearTimeText.position.set(app.screen.width / 2, 250);
        clearTimeText.alpha = 0;
        resultContainer.addChild(clearTimeText);

/** 
        // ハードボタン
        const retryBtn = createButton('HARD', app.screen.width / 2 + 110, app.screen.height - 140, 16, 10);
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
        resultContainer.addChild(retryBtn);
*/

        // リトライボタン
        const reverseBtn = createButton('RETRY', app.screen.width / 2 - 80, app.screen.height - 210, 34, 10);
        reverseBtn.interactive = true;
        reverseBtn.on('pointerdown', () => {
            resultContainer.removeChild(darkOverlay2);
            resultContainer.addChild(darkOverlay2);
            // フェードアウト
            gsap.to(darkOverlay2, {
                alpha: 1,
                duration: 0.5,
                onComplete: () => {
                    // 初期化処理
                    resetVar();
                    mainScene.removeChildren();
                    resultContainer.removeChildren();
                    switchScene('main');
                }
            });

        });
        resultContainer.addChild(reverseBtn);

        // 親変数初期化
        function resetVar() {
            currentStageIndex = 0;
            startFlg = false;
            startTime = Date.now();     // ゲーム開始時間
            clearTime = Date.now();
        }

        // 汎用ボタン作成
        function createButton(label, x, y, fontsize = 40, round = 10) {
            const container = new PIXI.Container();
            const bg = new PIXI.Graphics();
            if (label === 'OGI') {
                bg.beginFill(0xff2222);
            } else if (label === 'HARD') {
                bg.beginFill(0xdddddd);
                bg.drawRoundedRect(-30, -15, 60, 35, round);
            } else {
                bg.beginFill(0xffcc00);
                bg.drawRoundedRect(-60, -30, 280, 70, round);
            }
            bg.endFill();
            const text = new PIXI.Text(label, {
                fill: 0x000000, fontSize: fontsize,
                fontWeight: 'bold',
            });
            text.anchor.set(0.5);
            if (label === 'RETRY') {
                text.x += 80;
            }
            container.addChild(bg, text);
            container.position.set(x, y);
            container.alpha = 0;
            container.interactive = true;
            container.buttonMode = true;
            return container;
        }

        // フェード用
        const darkOverlay2 = new PIXI.Graphics();
        darkOverlay2.beginFill(0x000000, 1.0);
        darkOverlay2.drawRect(0, 0, app.screen.width, app.screen.height);
        darkOverlay2.endFill();
        darkOverlay2.alpha = 0;
        resultContainer.addChild(darkOverlay2);

        // アニメーション表示
        gsap.to(bg, {
            alpha: 0.5,
            onComplete: () => {
                gsap.to(clearText, { duration: 1.2, alpha: 1, y: 90, ease: "bounce.out" });
                gsap.to(title, { duration: 1.2, alpha: 1, delay: 1, ease: "power2.out" });
                gsap.to(clearTimeText, { duration: 1.2, alpha: 1, delay: 2, y: 260, ease: 'power2.out' });
                //gsap.to(retryBtn, { duration: 0.5, alpha: 1, delay: 2.5, ease: "power2.out" });
                gsap.to(reverseBtn, { duration: 0.5, alpha: 1, delay: 2.5, ease: 'power2.out' });


            }
        });

        // --- ★演出 --- //
        function createStar(x, y) {
            const star = new PIXI.Graphics();
            const size = Math.random() * 8 + 8;
            star.beginFill(0xffff66);
            for (let i = 0; i < 5; i++) {
                const angle = i * (Math.PI * 2) / 5;
                const x1 = Math.cos(angle) * size;
                const y1 = Math.sin(angle) * size;
                if (i === 0) {
                    star.moveTo(x1, y1);
                } else {
                    star.lineTo(x1, y1);
                }
            }
            star.endFill();
            star.x = x;
            star.y = y;
            star.alpha = 0;
            resultContainer.addChild(star);

            // アニメーション
            gsap.to(star, {
                duration: 2,
                alpha: 1,
                y: y + 200 + Math.random() * 100,
                x: x + (Math.random() - 0.5) * 200,
                rotation: Math.random() * Math.PI * 2,
                ease: "power1.out",
                onComplete: () => resultContainer.removeChild(star)
            });
        }

        // 星を複数発生させる
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const x = app.screen.width / 2 + (Math.random() - 0.5) * 300;
                const y = 0;
                createStar(x, y);
            }, i * 100);
        }
    }

    // 最初のステージ読み込み
    loadStage(currentStageIndex);

    startFlg = true;


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

switchScene('main');