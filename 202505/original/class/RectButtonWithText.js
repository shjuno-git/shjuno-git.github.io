/**
 * // 影付きボタンのクラス
 * const myButton = new RectButtonWithText(app.view.width/2- 100, app.view.height/2-20, 200, 40, 0x3498db, '押してみよう', 24);
 * 
*/
export class RectButtonWithText extends PIXI.Container {
    constructor(x, y, width, height, color, text, fontSize = 24, textColor = 0xFFFFFF) {
        super();

        // ボタンの影
        this.shadow = new PIXI.Graphics();
        this.shadow.beginFill(this._darkenColor(color));  // 色を暗くした色を影として使用
        this.shadow.drawRoundedRect(0, 0, width, height, 15);
        this.shadow.endFill();
        this.shadow.position.set(0, 4);  // 影をボタンの下にずらす

        // ボタンの背景となる四角形
        this.button = new PIXI.Graphics();
        this.button.beginFill(color);
        this.button.drawRoundedRect(0, 0, width, height, 15);
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
                        // 離したことにする
                        this._isPressed = false;
                        this._releaseButton();
                    }, 200);  // 200ミリ秒
                }
            }
        });

    }

    // ボタンを押したときのアニメーション（3px下がる動き）
    _pressButton() {
        // 色味をグレーに変更
        this.button.tint = 0xEEEEEE;  // グレーに変更（押された状態）
        // ボタンの位置を3px下げる
        this.button.position.y += 3;    // ボタン
        //this.shadow.position.y += 3;    // 影も合わせて動かす
        this.text.position.y += 3;       // テキスト
    }

    // ボタンが離されたときのアニメーション（元の位置に戻る）
    _releaseButton() {
        // 色味を戻す
        this.button.tint = 0xFFFFFF;
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
