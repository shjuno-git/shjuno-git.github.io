/**
 * // 二分木を作成するクラス
 * 
 */

// 二分木のノードを定義
class TreeNode {
  constructor(value) {
    this.value = value;   // ノードの値
    this.left = null;      // 左の子ノード
    this.right = null;     // 右の子ノード
  }
}

// 二分木を構築するクラス
export class BinaryTree {
  constructor() {
    this.root = null;  // ルートノード
  }

  // 二分木にノードを追加するメソッド
  insert(value, index) {
    const newNode = new TreeNode(value, index);
    if (!this.root) {
      this.root = newNode;
    } else {
      this._insertRec(this.root, newNode);
    }
  }

  // 再帰的にノードを挿入
  _insertRec(node, newNode) {
    if (newNode.value < node.value) {
      if (!node.left) {
        node.left = newNode;
      } else {
        this._insertRec(node.left, newNode);
      }
    } else {
      if (!node.right) {
        node.right = newNode;
      } else {
        this._insertRec(node.right, newNode);
      }
    }
  }

  // 木の深さを計算するメソッド
  getDepth(node = this.root) {
    if (!node) return 0;
    const leftDepth = this.getDepth(node.left);
    const rightDepth = this.getDepth(node.right);
    return Math.max(leftDepth, rightDepth) + 1;
  }
}
