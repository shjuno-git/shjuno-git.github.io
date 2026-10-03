"""kshukshu のゲーム本体に OGP を差し込んだ公開用コピーを作る。

ゲーム本体（kshukshu 側）はふりーむ提出版と同じく外部参照なし（OGP なし）で一本管理し、
公開先ごとのコピーにだけ、その公開先の URL で OGP を付ける。_tools/ は Jekyll の公開対象外。

使い方（このリポジトリのルートで）:
    python _tools/sync_game.py kurage        # GitHub Pages: 各 <dest>/index.html を更新
    python _tools/sync_game.py kurage --ks   # kshukshu.com: kshukshu/_upload/<id>/index.html を作成
                                             #   （中身をサーバーの /<id>/ へアップロードする）
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
KSHUKSHU = ROOT.parent / "kshukshu"
GH_SITE = "https://shjuno-git.github.io"
KS_SITE = "https://kshukshu.com"

GAMES = {
    "kurage": {
        "src": KSHUKSHU / "kurage" / "index.html",
        # GitHub Pages 上の置き場所（複数可）。リメイク予定のない新しめの作品は old/ と直下の両方に置く
        # （kshukshu.com 側はキー名 = フォルダ名）
        "dest": ["202610/old", "202610"],
        "title": "バイバイクラゲ",
        "desc": "水鉄砲で倍々に増えるクラゲを退治しよう！数分で遊べるフリーのブラウザゲーム。",
        "image": "linkcard_kurage.png",
    },
}

OGP_TEMPLATE = """<meta name="twitter:site" content="@kshukshu777" />
<meta name="twitter:creator" content="@kshukshu777" />
<meta name="twitter:card" content="summary_large_image" />
<meta property="og:url" content="{url}" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:image" content="{image}" />
"""


def main(name, target):
    g = GAMES[name]
    html = g["src"].read_text(encoding="utf-8")
    if "og:image" in html:
        sys.exit(f"{g['src']} に既に OGP があります（本体は OGP なしで管理する前提）")
    if target == "ks":
        outputs = [(KS_SITE, f"{KS_SITE}/{name}/", KSHUKSHU / "_upload" / name / "index.html")]
    else:
        outputs = [(GH_SITE, f"{GH_SITE}/{d}/", ROOT / d / "index.html") for d in g["dest"]]
    for site, page, dest in outputs:
        ogp = OGP_TEMPLATE.format(
            url=page,
            title=g["title"],
            desc=g["desc"],
            image=f"{site}/images/thumbnail/{g['image']}",
        )
        out, n = re.subn(r"(</title>\r?\n)", lambda m: m.group(1) + ogp, html, count=1)
        if n != 1:
            sys.exit("</title> が見つかりません")
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "w", encoding="utf-8", newline="") as f:
            f.write(out)
        print(f"{g['src']} -> {dest} (with OGP)")


if __name__ == "__main__":
    args = sys.argv[1:]
    target = "ks" if "--ks" in args else "gh"
    args = [a for a in args if a != "--ks"]
    if len(args) != 1 or args[0] not in GAMES:
        sys.exit("usage: python _tools/sync_game.py <" + "|".join(GAMES) + "> [--ks]")
    main(args[0], target)
