"""kshukshu のゲーム本体を公開用にコピーする（OGP は付けない）。

ゲーム本体（kshukshu 側）はふりーむ提出版と同じく外部参照なし（OGP なし）で一本管理し、
公開先へはそのままコピーする。_tools/ は Jekyll の公開対象外。

使い方（このリポジトリのルートで）:
    python _tools/sync_game.py kurage        # GitHub Pages: 各 <dest>/index.html を更新
    python _tools/sync_game.py kurage --ks   # kshukshu.com: kshukshu/_upload/<id>/index.html を作成
                                             #   （中身をサーバーの /<id>/ へアップロードする）
"""
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
KSHUKSHU = ROOT.parent / "kshukshu"

GAMES = {
    "kurage": {
        "src": KSHUKSHU / "22.kurage" / "index.html",
        # GitHub Pages 上の置き場所（/g/NNN/vN/）。新作は g/<通し番号>/v1 の1か所だけ
        # （kshukshu.com 側はキー名 = フォルダ名）
        "dest": ["g/022/v1"],
    },
}


def main(name, target):
    g = GAMES[name]
    if target == "ks":
        outputs = [KSHUKSHU / "_upload" / name / "index.html"]
    else:
        outputs = [ROOT / d / "index.html" for d in g["dest"]]
    for dest in outputs:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(g["src"], dest)
        print(f"{g['src']} -> {dest}")


if __name__ == "__main__":
    args = sys.argv[1:]
    target = "ks" if "--ks" in args else "gh"
    args = [a for a in args if a != "--ks"]
    if len(args) != 1 or args[0] not in GAMES:
        sys.exit("usage: python _tools/sync_game.py <" + "|".join(GAMES) + "> [--ks]")
    main(args[0], target)
