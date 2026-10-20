/**
 * // 二分木を可視化するためのクラスクラス
 * 
 */

// Pixi.jsで二分木を描画するクラス
class BinaryTreeVisualizer {
  constructor(app, scene, tree, highlightNodeValue) {
    this.app = app;
    this.currentScene = scene;
    this.tree = tree;
    this.nodeRadius = 20; // ノードの円の半径
    this.levelDistance = 60; // 各レベル間の垂直距離
    this.initialHorizontalDistance = 100; // 最初の水平方向の距離
    this.nodeGraphics = []; // ノードの描画オブジェクト
    this.lineGraphics = []; // 線の描画オブジェクト
    this.pulseSpeed = 0.004; // ぷるぷるの速さ
    this.pulseRange = 0.01; // ぷるぷるの範囲（スケールや回転の変動量）
    this.highlightNodeValue = highlightNodeValue; // 強調するノードの値
    this.currentNodeIndex = -1; // 現在のノード番号
    this.isCorrect = false;     // 正解フラグ
  }

  // 正解フラグを立てるメソッド
  correct() {
    this.isCorrect = true;
  }

    // 二分木を描画するメソッド
    visualizeDemo(x,y,flg) {
      this.currentScene.removeChildren();
      this.nodeRadius = 15; // ノードの円の半径
      this.levelDistance = 50; // 各レベル間の垂直距離
      this.initialHorizontalDistance = 50; // 最初の水平方向の距離
      this._visualizeRec(this.tree.root, x, y, 0, this.initialHorizontalDistance,flg);
      // ノードの最左端のx座標を計算
      const leftmostX = Math.min(...this.nodeGraphics.map(ng => ng.node.x));
  
      // アニメーション
      this._startAnimation();
    }
  
  // 二分木を描画するメソッド（左寄せ）
  visualize(x,y,flg) {
    this.currentScene.removeChildren();
    this._visualizeRec(this.tree.root, x, y, 0, this.initialHorizontalDistance,flg);
    // ノードの最左端のx座標を計算
    const leftmostX = Math.min(...this.nodeGraphics.map(ng => ng.node.x));

    // 全てのノードを左に移動させる
    this._adjustNodePositions(leftmostX);

    // アニメーション
    this._startAnimation();
  }

  // 再帰的にノードとその子ノードを描画
  _visualizeRec(node, x, y, level, horizontalDistance,flg) {
    if (!node) return;

    // ノードの描画
    const nodeGraphics = new PIXI.Graphics();
    // ノード番号が強調すべきインデックスかどうかをチェック
    const isHighlighted = node.value === this.highlightNodeValue;

    nodeGraphics.beginFill(isHighlighted ? 0xFFCC66 : 0x66CCFF); // 強調するノードは赤色、それ以外は青色
    nodeGraphics.drawCircle(0, 0, isHighlighted ? this.nodeRadius * 1.5 : this.nodeRadius); // 強調するノードは大きく
    nodeGraphics.endFill();
    nodeGraphics.x = x;
    nodeGraphics.y = y;

    // ノードのラベル
    let label = new PIXI.Text(isHighlighted ? '？' : node.value.toString(), {
      fontSize: isHighlighted ? 30 : 22, // 強調するノードのフォントサイズを大きく
      fill: 0x000000
    });
    if(isHighlighted && flg){
      label.text = `${this.highlightNodeValue}`;
    }
    label.anchor.set(0.5);
    label.x = nodeGraphics.x;
    label.y = nodeGraphics.y;

    // まず接続線を描画
    const newHorizontalDistance = horizontalDistance / 1.5;  // 水平距離を縮小（1.5倍で縮める）

    // 左の子ノードとの接続線
    if (node.left) {
      const lineGraphics = new PIXI.Graphics();
      lineGraphics.lineStyle(2, 0x000000, 1);
      lineGraphics.moveTo(x, y);
      lineGraphics.lineTo(x - newHorizontalDistance, y + this.levelDistance);
      this.currentScene.addChild(lineGraphics);
      this.lineGraphics.push({ line: lineGraphics, direction: 'left', parent: node });

      // 左の子ノードを再帰的に描画
      this._visualizeRec(node.left, x - newHorizontalDistance, y + this.levelDistance, level + 1, newHorizontalDistance);
    }

    // 右の子ノードとの接続線
    if (node.right) {
      const lineGraphics = new PIXI.Graphics();
      lineGraphics.lineStyle(2, 0x000000, 1);
      lineGraphics.moveTo(x, y);
      lineGraphics.lineTo(x + newHorizontalDistance, y + this.levelDistance);
      this.currentScene.addChild(lineGraphics);
      this.lineGraphics.push({ line: lineGraphics, direction: 'right', parent: node });

      // 右の子ノードを再帰的に描画
      this._visualizeRec(node.right, x + newHorizontalDistance, y + this.levelDistance, level + 1, newHorizontalDistance);
    }

    // 接続線を描画した後に親ノードを追加
    this.currentScene.addChild(nodeGraphics);
    this.currentScene.addChild(label);

    // ノードとラベルを保存
    this.nodeGraphics.push({ node: nodeGraphics, label: label });

    // ノードのタッチイベントを追加
    this._addTouchEvent(nodeGraphics, node, label);

  }

  // ノードのタッチイベントを追加
  _addTouchEvent(nodeGraphics, node, label) {
    nodeGraphics.interactive = true;  // インタラクションを有効にする
    nodeGraphics.buttonMode = true;   // カーソルを手のひらに変える

    let startX = 0;
    let startY = 0;
    let startNodeX = 0;
    let startNodeY = 0;

    // ノードをタッチしたときに発生するイベント
    nodeGraphics.on('pointerdown', (event) => {
      startX = event.data.global.x;  // タッチ開始時の位置
      startY = event.data.global.y;  // タッチ開始時の位置
      startNodeX = nodeGraphics.x;   // タッチ開始時のノードの位置
      startNodeY = nodeGraphics.y;   // タッチ開始時のノードの位置

      // ノードを再描画して一番上に持ってくる
      this.currentScene.removeChild(nodeGraphics);
      this.currentScene.removeChild(label);
      this.currentScene.addChild(nodeGraphics);
      this.currentScene.addChild(label);

      // ノードをドラッグして動かす
      nodeGraphics.on('pointermove', (moveEvent) => {
        if (moveEvent.data.global.x !== startX || moveEvent.data.global.y !== startY) {
          const deltaX = moveEvent.data.global.x - startX;
          const deltaY = moveEvent.data.global.y - startY;
          nodeGraphics.x = startNodeX + deltaX;
          nodeGraphics.y = startNodeY + deltaY;
          label.x = nodeGraphics.x;  // ラベルも一緒に動かす
          label.y = nodeGraphics.y;
        }
      });

      // ドラッグ終了時
      nodeGraphics.on('pointerup', () => {
        nodeGraphics.off('pointermove');
        nodeGraphics.off('pointerup');

        // ノードが元の位置に戻る
        nodeGraphics.x = startNodeX;
        nodeGraphics.y = startNodeY;
        label.x = nodeGraphics.x;
        label.y = nodeGraphics.y;
      });

      // ポインタがノードから外れたとき
      nodeGraphics.on('pointerout', () => {
        nodeGraphics.off('pointermove');
        nodeGraphics.off('pointerup');

        // ノードが元の位置に戻る
        nodeGraphics.x = startNodeX;
        nodeGraphics.y = startNodeY;
        label.x = nodeGraphics.x;
        label.y = nodeGraphics.y;
      });
    });
  }


  // ノードのx座標を最左端に合わせて調整
  _adjustNodePositions(leftmostX) {
    const offsetX = 0 - leftmostX + 25;   // 最左端を画面の左端に合わせるためのオフセット
    const offsetY = 30;                  // Y座標のオフセット

    // すべてのノードのx座標を調整
    this.nodeGraphics.forEach(ng => {
      ng.node.x += offsetX;
      ng.node.y += offsetY;
      ng.label.x += offsetX;
      ng.label.y += offsetY;
    });

    // すべての接続線の座標を調整
    this.lineGraphics.forEach(({ line }) => {
      line.x += offsetX;
      line.y += offsetY;
    });
  }

  // アニメーションを開始するメソッド
  _startAnimation() {
    this.app.ticker.add(() => {
      // ノードのぷるぷるアニメーション
      this.nodeGraphics.forEach(({ node, label }) => {
        // ノードのスケールを少し変化させてぷるぷるさせる
        const scaleVariation = 1 + this.pulseRange * Math.sin(this.app.ticker.lastTime * this.pulseSpeed);
        node.scale.set(scaleVariation, scaleVariation);

        // ラベルにも回転やスケールを適用
        label.scale.set(scaleVariation, scaleVariation);
        const rotationVariation = this.pulseRange * Math.sin(this.app.ticker.lastTime * this.pulseSpeed);
        let rotationBase = 1;
        if (label.text === "？") {
          if(this.isCorrect){label.text = `${this.highlightNodeValue}`}
          rotationBase *= 20;
        }
        //label.rotation += 1 * rotationVariation * rotationBase;
        label.rotation = this.pulseRange * Math.sin(this.app.ticker.lastTime * this.pulseSpeed * 0.5) * rotationBase;
      });

      // 線（接続線）の回転やスケールは変化させない（動かさない）
      // 接続線のぷるぷるアニメーション
      this.lineGraphics.forEach(({ line, direction }) => {
        // 接続線の回転を少し変化させてぷるぷるさせる
        let rotationVariation = this.pulseRange * Math.sin(this.app.ticker.lastTime * this.pulseSpeed) * 0.1;

        // 接続線の位置を左右にぷるぷると動かす
        const movementVariation = this.pulseRange * Math.sin(this.app.ticker.lastTime * this.pulseSpeed * 0.5);
        if (direction === 'left') {
          line.rotation = rotationVariation;
          line.x += movementVariation;
          line.y += movementVariation;
        } else if (direction === 'right') {
          line.rotation = -rotationVariation;
          line.x -= movementVariation;
          line.y -= movementVariation;
        }
      });

      // 小ノードを接続線の終端位置に移動
      this.nodeGraphics.forEach(({ node, label }) => {
        if (parent.left && parent.left.value === node.value) {
          node.x = newLine.x - this.nodeRadius; // 左側に配置
          node.y = newLine.y + this.levelDistance;
          label.x = node.x;
          label.y = node.y;
        }
        if (parent.right && parent.right.value === node.value) {
          node.x = newLine.x + this.nodeRadius; // 右側に配置
          node.y = newLine.y + this.levelDistance;
          label.x = node.x;
          label.y = node.y;
        }
      });


    });
  }
}

export { BinaryTreeVisualizer };