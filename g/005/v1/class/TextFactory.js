/**
 * // テキストクラス
 * const myText = new TextFactory('テキストを追加', 36, '#ffffff');  // 初期のテキスト
 * // 装飾の変更
 * myText.setBold(true);                    　　// 太字に変更
 * myText.setItalic(true);                      // 斜体に変更
 * myText.setStroke('#ffffff', 4);              // 縁取りを追加（色、太さ）
 * myText.setFontFamily('Verdana');             // フォントを変更
 * myText.setColor('#ff0000');                  // 色を変更
 * myText.setShadow(true, '#000000', 5, 10);    // 影を追加（有効/無効、影の色、ぼかし、距離）
 * myText.setWordWrap(300);                     // 指定幅で改行
 * myText.setLineHeight(36*1.5);                // 行間を変更
 * mtText.setAlign("center");                   // 揃え位置を変更
 * 
 */
export class TextFactory extends PIXI.Text {
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

    // テキストの揃え位置を設定するメソッド
    setAlign(align) {
        // 'left', 'center', 'right' などが有効
        this.style.align = align;
    }
}
