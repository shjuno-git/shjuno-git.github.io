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
app.renderer.backgroundColor = 0xffffff;        // 背景色の設定
//app.renderer.view.style.border = "2px dashed black";  // canvasを点線枠で囲う（確認用）

/** 
 * ゲーム全体で使用する変数の定義
 * (AallVar)
 */
let initFlg = true;             // 初期状態フラグ
let currentScene;               // 現在のシーン
let currentStageIndex = 0;
let missCnt = 0;
let startFlg = false;
let startTime = Date.now();     // ゲーム開始時間
let clearTime = Date.now();
let elapsedTime = 0;            // 経過時間

// UI用のコンテナ（スコア表示やボタンなど）
let uiContainer = new PIXI.Container();

/** 
 * タイトルシーン
 * (Atitle)
 */
function createTitleScene() {
    // メインシーン作成
    const titleScene = new PIXI.Container();

    // デバッグ用localstrage初期化
    localStorage.removeItem("lucky_draw_save");

    // --------------------- ゲーム変数 ---------------------
    let stage = 1;
    let exp = 0;
    let drawCount = 1;
    //let drawMax = 1;
    let bonusWin = 0;         // 当たり+1強化
    let bonusDraw = 0;        // くじ+1強化
    let bonusGain = 0;        // 獲得経験値アップ
    //let bonusPassive = 0;     // 保持経験値
    let bonusSpecial = 0;     // 金くじ出現率UP
    let rainbowMode = false;  // 虹くじフラグ
    let isBonusTime = false;     // 当たり2倍フラグ
    let bonusTimer = -1;

    let winStreak = 0;         // 現在の当たり連続数
    let maxWinStreak = 0;      // 任意：過去最高記録

    let currentLotteryPool = [];  // くじの中身
    let startFlg = true;
    let usedFlags;

    let clearFlg = false;

    let total = 2;              // 1/2から
    //let winCount = 1;
    //let usedCount = 0;
    //let restCount = total - usedCount;
    //let winRate = 50;

    const MAX_STAGE = 10;
    const STORAGE_KEY = "lucky_draw_save";  // localstrage保存用
    const stageStats = {}; // 各ステージごと

    //let resultLog = Array(MAX_STAGE).fill(0);
    let totalDraw = 0;
    let totalExp = 0;

    // --------------------- セーブ状態表示用テキスト ---------------------
    const saveText = new PIXI.Text("", {
        fontSize: 12,
        fill: 0x666666
    });
    saveText.position.set(295, 80);
    titleScene.addChild(saveText);

    // --------------------- UI ---------------------
    // 初期化時のみメッセージ
    const firstText = new PIXI.Text("豪運くじびき", {
        fontSize: 40,
        fill: ['#ffffff', '#ffd700'],
        stroke: '#000000',
        strokeThickness: 4,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowDistance: 2,
        fontWeight: 'bold'
    });
    firstText.anchor.set(0.5);
    firstText.position.set(app.screen.width / 2, 200);
    firstText.alpha = 0;
    gsap.to(firstText, {
        alpha: 1,
        duration: 1.0,
        yoyo: true,
        repeat: -1,
    });

    // 最終時のみメッセージ
    const finalText = new PIXI.Text("めざせ 1/1024！", {
        fontSize: 40,
        fill: ['#ffffff', '#ffd700'],
        stroke: '#000000',
        strokeThickness: 4,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowDistance: 2,
        fontWeight: 'bold'
    });
    finalText.anchor.set(0.5);
    finalText.position.set((app.screen.width / 2) + 10, 260);
    finalText.alpha = 0;
    gsap.to(finalText, {
        alpha: 1,
        duration: 1.0,
        yoyo: true,
        repeat: -1,
    });

    const stageText = new PIXI.Text('', { fontSize: 18, fill: 0x333 });
    stageText.position.set(8, 10);
    titleScene.addChild(stageText);

    const chanceText = new PIXI.Text('', { fontSize: 16, fill: 0x333 });
    chanceText.position.set(125, 11);
    titleScene.addChild(chanceText);

    const expText = new PIXI.Text('', {
        fontSize: 18,
        fill: 0x333,
        stroke: '#ffffff',
        strokeThickness: 2,
        fontWeight: 'bold'
    });
    expText.position.set(123, 37);
    titleScene.addChild(expText);

    const drawRemainText = new PIXI.Text('', {
        fontSize: 18,
        fill: 0x333,
        stroke: '#ffffff',
        strokeThickness: 2,
        fontWeight: 'bold'
    });
    drawRemainText.position.set(3, 37);
    titleScene.addChild(drawRemainText);


    const resetBtn = new PIXI.Graphics();
    resetBtn.beginFill(0x999999);
    resetBtn.drawRoundedRect(0, 0, 60, 30, 6);
    resetBtn.endFill();
    resetBtn.position.set(295, 100);
    resetBtn.interactive = true;
    resetBtn.buttonMode = true;

    // --------------------- リセットボタン ---------------------
    const resetLabel = new PIXI.Text("初期化", {
        fontSize: 14,
        fill: 0xffffff
    });
    resetLabel.anchor.set(0.5);
    resetLabel.position.set(30, 15);
    resetBtn.addChild(resetLabel);

    resetBtn.on("pointerdown", () => {
        const confirmReset = confirm("セーブデータを初期化して最初からにしますか？");
        if (confirmReset) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload(); // ゲームを初期化
        }
    });

    titleScene.addChild(resetBtn);

    // --------------------- くじ表示 ---------------------
    const box = new PIXI.Graphics();
    box.lineStyle(2, 0x333333);
    box.drawRect(0, 0, 345, 235);
    box.position.set(8, 135);
    titleScene.addChild(box);

    let balls = [];
    let radius;

    function updateLotteryDisplay() {
        balls.forEach(b => titleScene.removeChild(b));
        balls = [];

        const pool = currentLotteryPool;
        total = pool.length;

        const boxWidth = 345;
        const boxHeight = 235;
        const padding = 4;

        const cols = Math.ceil(Math.sqrt(total));
        const rows = Math.ceil(total / cols);

        const spacingX = (boxWidth - padding * 2) / cols;
        const spacingY = (boxHeight - padding * 2) / rows;
        radius = Math.min(spacingX, spacingY) * 0.4;

        for (let i = 0; i < total; i++) {
            //if (usedFlags[i]) {
            //    continue; // 表示スキップ
            //} else {
            const circle = new PIXI.Graphics();
            const type = pool[i];

            let color = 0xffffff;

            if (usedFlags[i]) {
                color = 0x999999;
            } else {
                if (type === 'win') color = 0xff4444;
                else if (type === 'gold') color = 0xffd700;
                else if (type === 'rainbow') color = 0xaa44ff;
            }

            circle.beginFill(color);
            circle.lineStyle(1, 0x333333);
            circle.drawCircle(0, 0, radius);
            circle.endFill();

            const col = i % cols;
            const row = Math.floor(i / cols);
            circle.x = box.x + padding + spacingX * (col + 0.5);
            circle.y = box.y + padding + spacingY * (row + 0.5);

            balls.push(circle);
            titleScene.addChild(circle);
            //}

        }
    }

    // --------------------- UI更新 ---------------------
    function updateUI() {
        // 画面表示系
        if (!drawInProgress) {
            const prob = calculateRemainingWinRate();
            const percent = (prob.rate * 100).toFixed(1);
            chanceText.text = `🎲 成功率：${prob.winCount}/${prob.totalCount}（${percent}%）`;
            //chanceText.text = `🎲 当選確率: ${winCount}/${restCount} (${winRate}%)`;

            if (!clearFlg) {
                updateLotteryDisplay();
            }
        }
        stageText.text = `Lv${stage.toString().padStart(2, '0')} [1/${Math.pow(2, stage)}]`;
        const chance = Math.min((1 + bonusWin) / Math.pow(2, stage), 1);


        expText.text = `📈 経験値：${Math.floor(exp)}P`;
        drawRemainText.text = `🎫 あと${drawCount}回`;

        // 連続ボーナステキスト
        updateStreakUI();

        // 強化ボタンの状態も更新
        upgrade1.updateVisuals();
        upgrade2.updateVisuals();
        upgradeGain.updateVisuals();
        upgradePassive.updateVisuals();

        // 背景更新
        updateBackground();

        // 最終ステージ専用テキスト
        if (stage === MAX_STAGE) {
            titleScene.addChild(firstText);
            titleScene.addChild(finalText);
        } else {
            titleScene.removeChild(firstText);
            titleScene.removeChild(finalText);
        }

        titleScene.removeChild(bonusMsg);
        titleScene.removeChild(tempMsg);
        titleScene.addChild(bonusMsg);
        titleScene.addChild(tempMsg);

    }

    function getUpgradeCost(base, level) {
        return Math.floor(base * Math.pow(1.5, level));
    }


    // 連続ボーナステキスト
    const streakText = new PIXI.Text("", {
        fontSize: 18,
        fill: ['0xff8844', '#ffff00'],
        stroke: '#000000',
        strokeThickness: 2,
        fontWeight: 'bold'
    });
    streakText.position.set(5, 65);
    titleScene.addChild(streakText);
    streakText.alpha = 0;
    gsap.to(streakText, {
        alpha: 1,
        duration: 0.8,
        yoyo: true,
        repeat: -1,
    });

    function updateStreakUI() {
        streakText.text = winStreak > 1 ? `🔥 ${winStreak}連続当たり！` : "";
    }

    // --------------------- ボーナスタイム ---------------------
    function bonusTime() {
        if (clearFlg) return;
        isBonusTime = true;
        generateNewLotteryPool(); // 新しいくじを生成＆保持
        updateLotteryDisplay();
        bonusTimer = 9;
        bonusMsg.text = `⏳当たり2倍！あと9秒`;
        const timerInterval = setInterval(() => {
            if (clearFlg) return;
            bonusMsg.text = `⏳当たり2倍！あと${bonusTimer}秒`;
            bonusTimer--;
            if (bonusTimer < -1) {
                isBonusTime = false;
                clearInterval(timerInterval);
                bonusMsg.text = ``;
                tempMsg.text = `⏳当たり２倍　終了`;
                //showResultMessage2("⏳当たり２倍　終了", 0xcccccc);
                const bonusInterval = setInterval(() => {
                    tempMsg.text = ``;
                    clearInterval(bonusInterval);
                }, 1000);
                generateNewLotteryPool(); // 新しいくじを生成＆保持
                updateLotteryDisplay();
            }
        }, 1000);
    }

    // --------------------- 当選確率 ---------------------
    function generateNewLotteryPool() {
        const total = Math.pow(2, stage);
        const wins = Math.min((1 + bonusWin) * (isBonusTime ? 2 : 1), total);
        const specialRate = 0.01 * (10 - stage) + bonusSpecial * 0.002;
        const specialCount = Math.min(Math.floor(total * specialRate), (bonusSpecial) * (isBonusTime ? 2 : 1));

        const pool = [];

        // くじ構成を順番に追加（先に金、次に赤、最後に白）
        for (let i = 0; i < total; i++) {
            if (i < specialCount) {
                pool.push('gold');
            } else if (i < specialCount + wins) {
                pool.push('win');
            } else {
                pool.push('lose');
            }
        }

        // 🌈虹くじモードの場合：loseの前半半分を'rainbow'に変換
        if (rainbowMode) {
            const loseIndexes = pool
                .map((v, i) => (v === 'lose' ? i : -1))
                .filter(i => i >= 0);

            const half = Math.floor(loseIndexes.length / 2);
            for (let i = 0; i < half; i++) {
                const index = loseIndexes[i]; // 前半固定で虹くじにする
                pool[index] = 'rainbow';
            }
        }

        if (startFlg) {
            usedFlags = Array(pool.length).fill(false);
            startFlg = false;
        }

        /**
        // 確率表示を更新（任意のTextオブジェクトを使っていれば）
        winCount = pool.filter(p => ['win', 'gold', 'rainbow'].includes(p)).length;
        usedCount = usedFlags.filter(flag => flag.used).length;
        //winRate = Math.round((winCount / restCount) * 100);
        restCount = total - usedCount;
        let raw = (winCount / restCount) * 100;
        winRate = Math.round(raw * 10) / 10;
        */

        currentLotteryPool = pool;
        //return pool;
    }

    function calculateRemainingWinRate() {
        const pool = currentLotteryPool;
        const remainingIndexes = balls
            .map((b, i) => (!b.used ? i : -1))
            .filter(i => i >= 0);

        //const remainingTotal = remainingIndexes.length;
        const remainingTotal = balls.map((_, i) => i).filter(i => !usedFlags[i]).length;
        const remainingWins = remainingIndexes.filter(i =>
            pool[i] === 'win' || pool[i] === 'gold' || pool[i] === 'rainbow'
        ).length;

        return {
            winCount: remainingWins,
            totalCount: remainingTotal,
            rate: remainingTotal > 0 ? remainingWins / remainingTotal : 0
        };
    }


    // --------------------- くじを引く ---------------------
    let drawInProgress = false;

    function drawLottery() {
        if (drawInProgress || drawCount <= 0) return;
        drawInProgress = true;

        const pool = currentLotteryPool;
        total = pool.length;

        // 残りくじに基づきランダム選択
        const availableIndexes = balls.map((_, i) => i).filter(i => !usedFlags[i]);
        const pickedIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
        const result = pool[pickedIndex];
        //const result = 'win';        // デバッグ用
        const pickedBall = balls[pickedIndex];
        //pickedBall.used = true;
        usedFlags[pickedIndex] = true;
        //pickedBall.visible = false;

        drawCount--;
        totalDraw++;

        /** 
        if (result === 'rainbow') {
            rainbowMode = false;
            tempMsg.text = ``;
 
            // 選んだ玉の色を強制変更
            pickedBall.clear();
            pickedBall.lineStyle(2, 0xaa44ff); // ふち
            pickedBall.beginFill(0xff99ff);   // 紫色（虹くじ）
            pickedBall.drawCircle(0, 0, radius);
            pickedBall.endFill();
 
            showResultMessage2("🌈虹くじ大当たり！", 0xff99ff);
 
            playWinEffect(pickedBall, () => {
                const gain = getStageExp(stage) * 5;
                exp += Math.floor(gain * (1 + bonusGain * 0.1));
                totalExp += gain;
 
                stage++;
                drawCount = 1 + bonusDraw;
                drawInProgress = false;
                updateUI();
            });
        }
        */

        updateStageStats(stage, result);

        // 判定＆演出
        if (result === 'gold') {
            playWinEffect(pickedBall, () => {
                // 連続ボーナス
                winStreak++;
                if (winStreak > maxWinStreak) {
                    maxWinStreak = winStreak;
                }

                const baseGain = getStageExp(stage) * 3;
                const streakBonus = Math.floor(baseGain * 0.7 * (winStreak - 1)); // 連続ごとに+50%
                const totalGain = Math.max(
                    Math.floor((baseGain + streakBonus) * (1 + bonusGain * 0.1)),
                    getUpgradeCost(50, bonusGain) * 1.2,
                    getUpgradeCost(77, bonusSpecial) * 1.2,
                    getUpgradeCost(10, bonusWin) * 1.2,
                    getUpgradeCost(20, bonusDraw) * 1.2);
                exp += totalGain;
                totalExp += totalGain;

                drawInProgress = false;
                advanceStage();
            });

            //showResultMessage2("🎊金くじ当たり！ボーナス大量！", 0xffd700);
            createAuraText2("🎊大当たり！経験値まみれ！", 0xffd700);

        } else if (result === 'win') {
            playWinEffect(pickedBall, () => {
                // 連続ボーナス
                winStreak++;
                if (winStreak > maxWinStreak) {
                    maxWinStreak = winStreak;
                }

                const baseGain = Math.max(getStageExp(stage), 5 * stage);
                const streakBonus = Math.floor(baseGain * 0.4 * (winStreak - 1)); // 連続ごとに+30%
                const totalGain = Math.floor((baseGain + streakBonus) * (1 + bonusGain * 0.05));
                exp += totalGain;
                totalExp += totalGain;

                drawInProgress = false;
                advanceStage();
            });

            //showResultMessage2("当たり！", 0xff4444);
            createAuraText("当たり！");

        } else {
            playMissEffect(pickedBall, () => {
                winStreak = 0; // リセット
                const gain = Math.floor(getStageExp(stage) * 0.2);
                let totalGain = 1;
                if (initFlg) {
                    initFlg = false;
                } else {
                    totalGain = Math.max(Math.floor(gain * (1 + bonusGain * 0.1)), 2 * stage);
                }
                exp += totalGain;
                totalExp += totalGain;

                if (drawCount <= 0) {
                    // ステージ1にもどる
                    startFlg = true;
                    stage = 1;
                    drawCount = 1 + bonusDraw;
                    bonusCheck();
                    generateNewLotteryPool(); // 新しいくじを生成＆保持
                    updateLotteryDisplay();
                }

                drawInProgress = false;
                updateUI();
            });

            //showResultMessage("ハズレ…", 0x555555);
            hazureText("ハズレ…", 0x555555);

        }

        //checkSpecialEvents();
        bonusCheck();
        saveData();
        updateUI();

    }

    // ステージ遷移
    function advanceStage() {
        saveData();
        stage++;
        startFlg = true;
        if (stage > MAX_STAGE) {
            clearFlg = true;
            // 強化ボタンの状態も更新
            upgrade1.updateVisuals();
            upgrade2.updateVisuals();
            upgradeGain.updateVisuals();
            upgradePassive.updateVisuals();

            showResult();
        } else {
            drawCount = 1 + bonusDraw;
            //setupBalls(); // balls を再構築
            generateNewLotteryPool(); // 新しいくじを生成＆保持
            updateLotteryDisplay();
            updateUI();
            drawInProgress = false;
        }
    }

    // ステージリザルト更新
    function updateStageStats(stage, result) {
        if (!stageStats[stage]) {
            stageStats[stage] = { draw: 0, win: 0, lose: 0 };
        }

        stageStats[stage].draw++;

        if (result === 'win' || result === 'gold' || result === 'rainbow') {
            stageStats[stage].win++;
        } else {
            stageStats[stage].lose++;
        }
    }

    // ボーナスチェック
    function bonusCheck() {
        //bonusMsg.text = ``;
        //tempMsg.text = ``;
        if (!isBonusTime) {
            isBonusTime = Math.random() < 1 / 50;
            if (isBonusTime) {
                bonusTime();
            }
        }
        /** 
        // 🌈 1/20の確率で虹くじモードを有効化
        if (!isBonusTime && !rainbowMode) {
            rainbowMode = Math.random() < 1 / 10;
            if (rainbowMode) {
                tempMsg.text = `🌈虹くじモード！`;
            }
        }
        */
    }

    // ステージ経験値
    function getStageExp(stage) {
        //return Math.floor(10 * Math.pow(stage, 1.7)); // 緩やかに指数成長
        return Math.floor(totalDraw / 5 * Math.pow(stage, 1.3)); // 緩やかに指数成長
    }

    // --------------------- くじボタン ---------------------
    const drawBtn = new PIXI.Graphics();
    //drawBtn.beginFill(0x6688cc);
    drawBtn.beginFill(0xff7777);
    drawBtn.lineStyle(4, 0xffffff, 1, 0);
    drawBtn.drawRoundedRect(-155, -25, 310, 50, 10);
    drawBtn.endFill();
    drawBtn.position.set(app.screen.width / 2, 400);
    drawBtn.interactive = true;
    drawBtn.buttonMode = true;
    titleScene.addChild(drawBtn);

    const drawLabel = new PIXI.Text("🎯 くじを引く", { fontSize: 18, fill: 0xffffff });
    drawLabel.anchor.set(0.5);
    drawLabel.position.set(-10, 0);
    drawBtn.addChild(drawLabel);

    drawBtn.on("pointerdown", () => {
        if (!clearFlg) {
            animateButton(drawBtn);
            drawLottery();
        }
    });

    // ボタンアニメーション
    function animateButton(button) {
        app.ticker.addOnce(() => {
            button.scale.set(1.1);
            setTimeout(() => button.scale.set(1), 100);
        });
    }

    // --------------------- 強化ボタン ---------------------
    // 下部に表示（drawBtn の下に配置）
    const upgrade1 = createUpgradeButton(
        "当たり +1",
        () => bonusWin,
        () => getUpgradeCost(10, bonusWin),
        () => {
            animateButton(upgrade1);
            bonusWin++;
            saveData();
            generateNewLotteryPool(); // 新しいくじを生成＆保持
            updateLotteryDisplay();
        },
        95, 438
    );

    const upgrade2 = createUpgradeButton(
        "くじ +1",
        () => bonusDraw,
        () => getUpgradeCost(20, bonusDraw),
        () => {
            animateButton(upgrade2);
            bonusDraw++;
            drawCount++;
            //drawCount = 1 + bonusDraw;
            saveData();
        },
        255, 438
    );

    const upgradeGain = createUpgradeButton(
        "経験値UP",
        () => bonusGain,
        () => getUpgradeCost(50, bonusGain),
        () => {
            animateButton(upgradeGain);
            bonusGain++;
            saveData();
        },
        95, 495
    );

    const upgradePassive = createUpgradeButton(
        "金くじUP",
        () => bonusSpecial,
        () => getUpgradeCost(77, bonusSpecial),
        () => {
            animateButton(upgradePassive);
            bonusSpecial++;
            saveData();
        },
        255, 495
    );

    // --------------------- 保持経験値：時間経過で増える処理 ---------------------
    let omake = 0;
    const omakeInterval = setInterval(() => {
        if (clearFlg) {
            return
            //clearInterval(omakeInterval);
        } else {
            if (bonusGain < 1) return;
            //let currentGain = (bonusGain * 1.5 + Math.sqrt(totalDraw)) * 0.1 + omake;
            //let currentGain = (bonusGain * 1.5 + totalDraw) * 0.1 * Math.max(1, bonusGain - 5) + omake;
            // 1/45で頭打ちにする
            let currentGain = Math.min(1/45,(bonusGain/ 1000))
             * Math.min(
                getUpgradeCost(10, bonusWin),
                getUpgradeCost(20, bonusDraw),
                getUpgradeCost(50, bonusGain),
                getUpgradeCost(77, bonusSpecial)
                )  + omake;
            const passiveGain = Math.floor(currentGain);
            omake = currentGain - passiveGain;
            if (passiveGain > 0) {
                exp += passiveGain;
                totalExp += passiveGain;
                updateUI();
            }
        }
    }, 1000);


    // --------------------- 強化ボタン作成関数 ---------------------
    function createUpgradeButton(label, getLevel, getCost, onUpgrade, x, y) {
        const container = new PIXI.Container();
        container.position.set(x, y);
        titleScene.addChild(container);

        const bg = new PIXI.Graphics();
        container.addChild(bg);

        const labelText = new PIXI.Text(label, { fontSize: 14, fill: 0x000000 });
        labelText.position.set(-65, 0);
        container.addChild(labelText);

        const levelText = new PIXI.Text('', { fontSize: 12, fill: 0x333333 });
        levelText.position.set(-65, 20);
        container.addChild(levelText);

        const costText = new PIXI.Text('', { fontSize: 12, fill: 0x333333 });
        costText.position.set(-10, 20);
        container.addChild(costText);

        // ボタンの有効状態に応じた見た目更新
        function updateVisuals() {
            const cost = getCost();
            const canAfford = (exp >= cost) && !clearFlg;

            bg.clear();
            bg.beginFill(canAfford ? 0x88cc88 : 0xcccccc); // 緑系:使える／灰色:使えない
            bg.drawRoundedRect(-75, -5, 150, 50, 10);
            bg.endFill();

            levelText.text = `所持: ${getLevel()}`;
            costText.text = `消費: ${cost}P`;

            bg.interactive = canAfford;
            bg.buttonMode = canAfford;

            bg.off("pointerdown"); // 前のイベント削除
            if (canAfford) {
                bg.on("pointerdown", () => {
                    exp -= cost;
                    onUpgrade();
                    updateUI(); // 全体更新
                    updateVisuals(); // 自身更新
                });
            }
        }

        container.updateVisuals = updateVisuals; // 外から呼べるように

        updateVisuals();
        return container;
    }



    // --------------------- フラッシュ演出（画面全体） ---------------------
    function screenFlash(color = 0xffffff, duration = 0.3) {
        const flash = new PIXI.Graphics();
        flash.beginFill(color);
        flash.drawRect(0, 0, app.screen.width, app.screen.height);
        flash.endFill();
        flash.alpha = 0;
        titleScene.addChild(flash);

        gsap.to(flash, {
            alpha: 0.8,
            duration: duration / 2,
            yoyo: true,
            repeat: 1,
            ease: "power1.inOut",
            onComplete: () => {
                titleScene.removeChild(flash);
            }
        });
    }

    // --------------------- ハズレ用：震える演出 & 暗くなる ---------------------
    function playMissEffect(target, onComplete) {
        gsap.fromTo(target, {
            x: target.x - 2
        }, {
            x: target.x + 2,
            duration: 0.1,
            yoyo: true,
            repeat: 4,
            ease: "power1.inOut",
            onComplete: onComplete // ← ここで次の処理へ
        });

        gsap.fromTo(target.scale, { x: 1, y: 1 }, {
            x: 0.9,
            y: 0.9,
            duration: 0.1,
            yoyo: true,
            repeat: 2
        });
    }

    // --------------------- 当たり用：拡大＋光る＋画面白フラッシュ ---------------------
    function playWinEffect(target, onComplete) {
        gsap.fromTo(target.scale, { x: 1, y: 1 }, {
            x: 2,
            y: 2,
            duration: 0.4,
            yoyo: true,
            repeat: 1,
            ease: "back.out(1.7)",
            onComplete: onComplete // ← ここで次の処理へ
        });

        gsap.fromTo(target, { alpha: 1 }, {
            alpha: 0.6,
            duration: 0.2,
            yoyo: true,
            repeat: 1
        });

        screenFlash(0xffffff, 0.3);
    }

    // --------------------- メッセージ表示 ---------------------
    function showResultMessage(text, color) {
        const msg = new PIXI.Text(text, {
            fontSize: 24,
            fill: color,
            fontWeight: 'bold'
        });
        msg.anchor.set(0.5);
        msg.position.set(app.screen.width / 2, 100);
        msg.alpha = 0;
        titleScene.addChild(msg);

        gsap.to(msg, {
            alpha: 1,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            onComplete: () => titleScene.removeChild(msg)
        });
    }

    function showResultMessage2(text, color) {
        const msg = new PIXI.Text(text, {
            fontSize: 24,
            fill: color,
            fontWeight: 'bold'
        });
        msg.anchor.set(0.5);
        msg.position.set(app.screen.width / 2, 100);
        msg.alpha = 0;
        titleScene.addChild(msg);

        gsap.to(msg, {
            alpha: 1,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            onComplete: () => showResultMessage(text, color)
        });
    }

    // 一時的メッセージエリア
    const bonusMsg = new PIXI.Text("", {
        fontSize: 30,
        fill: ['#ffffff', '#ff8844'],
        stroke: '#000000',
        strokeThickness: 4,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowDistance: 2,
        fontWeight: 'bold'
    });
    bonusMsg.anchor.set(0.5);
    bonusMsg.position.set((app.screen.width / 2) - 10, 320);
    bonusMsg.alpha = 1;
    titleScene.addChild(bonusMsg);

    gsap.to(bonusMsg, {
        alpha: 0,
        duration: 0.5,
        yoyo: true,
        repeat: -1,
    });

    const tempMsg = new PIXI.Text("", {
        fontSize: 30,
        fill: ['#ffffff', '#999999'],
        stroke: '#000000',
        strokeThickness: 4,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowDistance: 2,
        fontWeight: 'bold'
    });
    tempMsg.anchor.set(0.5);
    tempMsg.position.set((app.screen.width / 2) - 10, 320);
    tempMsg.alpha = 1;
    titleScene.addChild(tempMsg);
    gsap.to(tempMsg, {
        alpha: 0,
        duration: 0.25,
        yoyo: true,
        repeat: -1,
    });


    // オーラ付きテキスト
    const textScene = new PIXI.Container();
    titleScene.addChild(textScene);

    function createAuraText(message, color = 0xffff88) {
        textScene.removeChildren();
        titleScene.removeChild(textScene);
        titleScene.addChild(textScene);

        const group = new PIXI.Container();

        // オーラ
        const aura = new PIXI.Graphics();
        aura.beginFill(color, 0.4);
        aura.drawCircle(0, -10, 30);
        aura.endFill();
        aura.alpha = 0;
        group.addChild(aura); // 背面に配置（順番が大事！）

        // テキスト
        const text = new PIXI.Text(message, {
            fontSize: 28,
            fill: ['#ffffff', '#ffff88'],
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowDistance: 2,
            fontWeight: 'bold'
        });
        text.anchor.set(0.5);
        text.alpha = 0;
        group.addChild(text); // オーラより前に配置

        // 中央に配置
        group.position.set(app.screen.width / 2, 120);

        // 表示
        textScene.addChild(group);

        // オーラ拡大アニメーション
        gsap.to(aura, {
            alpha: 0.8,
            duration: 0.2,
            onComplete: () => {
                gsap.to(aura.scale, {
                    x: 2,
                    y: 2,
                    duration: 0.25,
                    ease: "sine.out"
                });
                gsap.to(aura, {
                    alpha: 0,
                    duration: 0.25,
                    ease: "sine.in"
                });
            }
        });

        // テキストアニメーション（ポップして消える）
        gsap.to(text, {
            alpha: 1,
            y: text.y - 20,
            duration: 0.25,
            ease: "power1.out",
            onComplete: () => {
                gsap.to(text, {
                    alpha: 0,
                    y: text.y - 40,
                    delay: 0.25,
                    duration: 0.2,
                    ease: "power1.in",
                    onComplete: () => {
                        textScene.removeChild(group); // 全体を削除
                    }
                });
            }
        });
    }

    // 大当たりテキスト
    function createAuraText2(message, color = 0xffff88) {
        textScene.removeChildren();
        titleScene.removeChild(textScene);
        titleScene.addChild(textScene);

        const group = new PIXI.Container();

        // オーラ
        const aura = new PIXI.Graphics();
        aura.beginFill(color, 0.4);
        aura.drawCircle(0, -10, 30);
        aura.endFill();
        aura.alpha = 0;
        group.addChild(aura); // 背面に配置（順番が大事！）

        // テキスト
        const text = new PIXI.Text(message, {
            fontSize: 28,
            fill: ['#ffffff', '#ffff88'],
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowDistance: 2,
            fontWeight: 'bold'
        });
        text.anchor.set(0.5);
        text.alpha = 0;
        group.addChild(text); // オーラより前に配置

        // 中央に配置
        group.position.set(app.screen.width / 2, 120);

        // 表示
        textScene.addChild(group);

        // オーラ拡大アニメーション
        gsap.to(aura, {
            alpha: 0.8,
            duration: 0.3,
            onComplete: () => {
                gsap.to(aura.scale, {
                    x: 3,
                    y: 3,
                    duration: 0.4,
                    ease: "sine.out"
                });
                gsap.to(aura, {
                    alpha: 0,
                    duration: 0.2,
                    ease: "sine.in"
                });
            }
        });

        // テキストアニメーション（ポップして消える）
        gsap.to(text, {
            alpha: 1,
            y: text.y - 20,
            duration: 0.4,
            ease: "power1.out",
            onComplete: () => {
                gsap.to(text, {
                    alpha: 0,
                    y: text.y - 40,
                    delay: 0.4,
                    duration: 0.4,
                    ease: "power1.in",
                    onComplete: () => {
                        textScene.removeChild(group); // 全体を削除
                    }
                });
            }
        });
    }

    // ハズレテキスト
    function hazureText(message, color = 0x555555) {
        textScene.removeChildren();
        titleScene.removeChild(textScene);
        titleScene.addChild(textScene);

        const group = new PIXI.Container();

        // テキスト
        const text = new PIXI.Text(message, {
            fontSize: 28,
            fill: ['#eeeeee', '#aaaaaa'],
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowDistance: 2,
            fontWeight: 'bold'
        });
        text.anchor.set(0.5);
        text.alpha = 0;
        group.addChild(text); // オーラより前に配置

        // 中央に配置
        group.position.set(app.screen.width / 2, 90);

        // 表示
        textScene.addChild(group);

        // テキストアニメーション（ポップして消える）
        gsap.to(text, {
            alpha: 1,
            y: text.y + 10,
            rotation: 0.2,
            duration: 0.15,
            ease: "power1.out",
            onComplete: () => {
                gsap.to(text, {
                    alpha: 0,
                    y: text.y + 20,
                    delay: 0.15,
                    duration: 0.1,
                    ease: "power1.in",
                    onComplete: () => {
                        textScene.removeChild(group); // 全体を削除
                    }
                });
            }
        });
    }

    // --------------------- 背景演出：ステージによる背景変更 ---------------------
    const background = new PIXI.Graphics();
    background.beginFill(getBackgroundColorForStage(stage));
    background.drawRect(0, 0, app.screen.width, app.screen.height);
    background.endFill();
    titleScene.addChildAt(background, 0); // 最背面

    function getBackgroundColorForStage(stage) {
        if (stage <= 3) return 0xffeedd; // 朝
        if (stage <= 6) return 0xcceeff; // 昼（空色）
        if (stage <= 8) return 0x7f93cf; // 夕（濃紺）
        return 0xffdd99;                // 終（オレンジ）
    }

    function updateBackground() {
        background.clear();
        background.beginFill(getBackgroundColorForStage(stage));
        background.drawRect(0, 0, app.screen.width, app.screen.height);
        background.endFill();
    }


    // --------------------- リザルト表示 ---------------------
    function showResult() {
        // 時間計測
        clearTime = Date.now();
        elapsedTime += clearTime - startTime;
        saveData();

        const resultBox = new PIXI.Container();
        resultBox.y = 70;
        titleScene.addChild(resultBox);

        const bg = new PIXI.Graphics();
        bg.beginFill(0xffffff);
        bg.drawRoundedRect(20, 0, 320, 470, 12);
        bg.endFill();
        bg.alpha = 0.95;
        resultBox.addChild(bg);

        const title = new PIXI.Text("🎉 全ステージクリア！", { fontSize: 18, fill: 0x222 });
        title.anchor.set(0.5);
        title.position.set(180, 25);
        resultBox.addChild(title);

        /** 
        let detail = `📊 合計くじ数: ${totalDraw}\n📈 総経験値: ${totalExp}\n\n`;
        resultLog.forEach((num, i) => {
            detail += `・ステージ${i + 1}：${num}回\n`;
        });
        */
        let y = 50;
        const stages = Object.keys(stageStats).map(Number).sort((a, b) => a - b);

        if (initFlg) {
            title.text = `🎯 豪運クリア！凄すぎる！！！`;
            y += 100;
            const stats = stageStats[10];
            const line = new PIXI.Text(
                `Lv10 [1/1024]`,
                { fontSize: 14, fill: 0x444444 }
            );
            line.position.set(50, y);
            resultBox.addChild(line);

            const line2 = new PIXI.Text(
                `：${stats.draw}回（当たり${stats.win} / ハズレ${stats.lose}）`,
                { fontSize: 14, fill: 0x444444 }
            );
            line2.position.set(135, y);
            y += 100;
            resultBox.addChild(line2);
        } else {
            stages.forEach(stageNum => {
                const stats = stageStats[stageNum];
                const line = new PIXI.Text(
                    `Lv${stageNum.toString().padStart(2, '0')} [1/${Math.pow(2, stageNum)}]`,
                    { fontSize: 14, fill: 0x444444 }
                );
                line.position.set(30, y);
                resultBox.addChild(line);

                const line2 = new PIXI.Text(
                    `：${stats.draw}回（当たり${stats.win} / ハズレ${stats.lose}）`,
                    { fontSize: 14, fill: 0x444444 }
                );
                line2.position.set(115, y);
                y += 25;
                resultBox.addChild(line2);

            });
        }


        y += 5;

        // 総合スコア
        const totalText = new PIXI.Text(
            `総合計: ${totalDraw}回 / 総経験値: ${Math.floor(totalExp)}P`,
            { fontSize: 16, fill: 0xcc4444 }
        );
        totalText.position.set(30, y);
        resultBox.addChild(totalText);


        // 経過時間を計算（ミリ秒）
        const elapsed = elapsedTime;
        // 時間（h）
        const hours = Math.floor(elapsed / 3600000);
        // 残りミリ秒から「分」を計算
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        // 「秒」を計算
        const seconds = Math.floor((elapsed % 60000) / 1000);

        // ゼロ埋めしてフォーマット
        const timeString =
            `${String(hours).padStart(2, '0')}` +
            `h${String(minutes).padStart(2, '0')}` +
            `m${String(seconds).padStart(2, '0')}` +
            `s`;

        // 連続
        const streakText = new PIXI.Text(
            `MAX: ${maxWinStreak}連続当たり！`,
            {
                fontSize: 14,
                fill: 0x444444,
                fontWeight: 'bold'
            }
        );
        streakText.position.set(30, y + 30);
        resultBox.addChild(streakText);

        // クリアタイム
        const clearTimeText = new PIXI.Text(
            `TIME: ${timeString}`,
            { fontSize: 14, fill: 0x444444 }
        );
        clearTimeText.position.set(30 + 160, y + 30);
        resultBox.addChild(clearTimeText);

        // 強化
        const powerText1 = new PIXI.Text(
            `「当たり+1」`,
            { fontSize: 14, fill: 0x444444 }
        );
        powerText1.position.set(25, y + 60);
        resultBox.addChild(powerText1);

        // 強化
        const powerText1_2 = new PIXI.Text(
            `×${bonusWin}回`,
            { fontSize: 14, fill: 0x444444 }
        );
        powerText1_2.position.set(25 + 90, y + 60);
        resultBox.addChild(powerText1_2);

        // 強化
        const powerText1_3 = new PIXI.Text(
            `「くじ+1」`,
            { fontSize: 14, fill: 0x444444 }
        );
        powerText1_3.position.set(25 + 160, y + 60);
        resultBox.addChild(powerText1_3);

        // 強化
        const powerText1_4 = new PIXI.Text(
            `×${bonusDraw}回`,
            { fontSize: 14, fill: 0x444444 }
        );
        powerText1_4.position.set(25 + 245, y + 60);
        resultBox.addChild(powerText1_4);

        // 強化
        const powerText2_1 = new PIXI.Text(
            `「経験値UP」`,
            { fontSize: 14, fill: 0x444444 }
        );
        powerText2_1.position.set(25, y + 80);
        resultBox.addChild(powerText2_1);

        // 強化
        const powerText2_2 = new PIXI.Text(
            `×${bonusGain}回`,
            { fontSize: 14, fill: 0x444444 }
        );
        powerText2_2.position.set(25 + 90, y + 80);
        resultBox.addChild(powerText2_2);
        // 強化
        const powerText2_3 = new PIXI.Text(
            `「金くじUP」`,
            { fontSize: 14, fill: 0x444444 }
        );
        powerText2_3.position.set(25 + 160, y + 80);
        resultBox.addChild(powerText2_3);
        // 強化
        const powerText2_4 = new PIXI.Text(
            `×${bonusSpecial}回`,
            { fontSize: 14, fill: 0x444444 }
        );
        powerText2_4.position.set(25 + 245, y + 80);
        resultBox.addChild(powerText2_4);

        // 再挑戦ボタン
        const restartBtn = new PIXI.Graphics();
        restartBtn.beginFill(0xff8866);
        restartBtn.drawRoundedRect(0, 0, 120, 40, 8);
        restartBtn.endFill();
        restartBtn.position.set(50, y + 110);
        restartBtn.interactive = true;
        restartBtn.buttonMode = true;
        resultBox.addChild(restartBtn);

        const restartLabel = new PIXI.Text("最初から遊ぶ", { fontSize: 14, fill: 0xffffff });
        restartLabel.anchor.set(0.5);
        restartLabel.position.set(60, 20);
        restartBtn.addChild(restartLabel);

        restartBtn.on("pointerdown", () => {
            animateButton(restartBtn);
            localStorage.removeItem(STORAGE_KEY);
            location.reload(); // ゲームを初期化
        });

        const continueBtn = new PIXI.Graphics();
        continueBtn.beginFill(0x66aa88);
        continueBtn.drawRoundedRect(0, 0, 120, 40, 8);
        continueBtn.endFill();
        continueBtn.position.set(190, y + 110);
        continueBtn.interactive = true;
        continueBtn.buttonMode = true;
        resultBox.addChild(continueBtn);

        const continueLabel = new PIXI.Text("続けて遊ぶ", { fontSize: 14, fill: 0xffffff });
        continueLabel.anchor.set(0.5);
        continueLabel.position.set(60, 20);
        continueBtn.addChild(continueLabel);

        continueBtn.on("pointerdown", () => {
            animateButton(continueBtn);
            titleScene.removeChild(resultBox);
            resetGame(false);
        });
    }

    // --------------------- 保存関数 ---------------------
    function saveData() {
        const data = {
            bonusWin,
            bonusDraw,
            bonusGain,
            bonusSpecial,
            exp,
            totalExp,
            totalDraw,
            elapsedTime
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        /** 
                // セーブ完了表示（短く色変更して戻す）
                saveText.text = "💾 セーブ";
                gsap.to(saveText, {
                    alpha: 1,
                    duration: 0.2,
                    yoyo: true,
                    repeat: 1,
                    onComplete: () => {
                        saveText.text = "";
                    }
                });
        */
    }

    // --------------------- 読み込み関数 ---------------------
    function loadData() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;

        try {
            const data = JSON.parse(saved);
            bonusWin = data.bonusWin ?? 0;
            bonusDraw = data.bonusDraw ?? 0;
            bonusGain = data.bonusGain ?? 0;
            bonusSpecial = data.bonusSpecial ?? 0;
            exp = data.exp ?? 0;
            totalExp = data.totalExp ?? 0;
            totalDraw = data.totalDraw ?? 0;
            elapsedTime = data.elapsedTime ?? 0;
        } catch (e) {
            console.warn("セーブデータ読み込み失敗:", e);
        }
    }

    // --------------------- ゲーム初期化 ---------------------
    function resetGame(fullReset = false) {
        clearFlg = false;
        startTime = Date.now();     // ゲーム開始時間
        clearTime = Date.now();

        if (initFlg) {
            stage = 10;
        } else {
            stage = 1;
        }
        drawCount = 1 + bonusDraw;
        generateNewLotteryPool(); // 新しいくじを生成＆保持

        streakText.text = ``;

        loadData(); // localstrage読み込み

        updateLotteryDisplay();
        updateUI();
    }

    // --------------------- ゲーム開始 ---------------------
    resetGame();

    /** 
    // 無理やりリザルト
    initFlg = false;
    updateStageStats(1, 'win');
    updateStageStats(2, 'win');
    updateStageStats(3, 'win');
    updateStageStats(4, 'win');
    updateStageStats(5, 'win');
    updateStageStats(6, 'win');
    updateStageStats(7, 'win');
    updateStageStats(8, 'win');
    updateStageStats(9, 'win');
    updateStageStats(10, 'win');
    showResult();
    //winStreak = 2;
    //bonusTime();
    */

    return titleScene;
}

/** 
 * メインシーン
 * (Amain)
 */
function createMainScene() {
    // メインシーン作成
    const mainScene = new PIXI.Container();

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
        //app.stage.addChild(uiContainer);
    } else if (scene === 'main') {
        currentScene = createMainScene();
        app.stage.addChild(currentScene);
        app.stage.addChild(uiContainer);
    }
}

switchScene('title');