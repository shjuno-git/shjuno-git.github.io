"""kshukshu のゲーム本体を GitHub Pages 側へコピーし、<head> に OGP を差し込む。

ゲーム本体（kshukshu 側）はふりーむ提出版と同じく外部参照なし（OGP なし）で一本管理し、
GitHub Pages に置くコピーにだけ OGP を付ける。_tools/ は Jekyll の公開対象外。

使い方（リポジトリのルートで）:
    python _tools/sync_game.py kurage
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
KSHUKSHU = ROOT.parent / "kshukshu"
SITE = "https://shjuno-git.github.io"

GAMES = {
    "kurage": {
        "src": KSHUKSHU / "kurage" / "index.html",
        "dest": "202610/old",
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


def main(name):
    g = GAMES[name]
    html = g["src"].read_text(encoding="utf-8")
    if "og:image" in html:
        sys.exit(f"{g['src']} に既に OGP があります（本体は OGP なしで管理する前提）")
    ogp = OGP_TEMPLATE.format(
        url=f"{SITE}/{g['dest']}/",
        title=g["title"],
        desc=g["desc"],
        image=f"{SITE}/images/thumbnail/{g['image']}",
    )
    html, n = re.subn(r"(</title>\r?\n)", lambda m: m.group(1) + ogp, html, count=1)
    if n != 1:
        sys.exit("</title> が見つかりません")
    dest = ROOT / g["dest"] / "index.html"
    with open(dest, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    print(f"{g['src']} -> {dest} (with OGP)")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in GAMES:
        sys.exit("usage: python _tools/sync_game.py <" + "|".join(GAMES) + ">")
    main(sys.argv[1])
