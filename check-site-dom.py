#!/usr/bin/env python3
"""Deterministic, dependency-free DOM smoke assertions for the four-page site."""
from __future__ import annotations
import argparse, sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen

# Force deterministic UTF-8 output for Windows consoles and CI logs.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PAGES = (
    "index.html",
    "download.html",
    "faq.html",
    "pricing.html",
    "activate.html",
    "buy.html",
    "membership.html",
    "setup-key.html",
    "404.html",
)
BUY_PENDING_PAGES = {"index.html", "download.html", "activate.html", "faq.html"}
RUNTIME_ASSET_PAGES = {"index.html", "download.html", "faq.html", "pricing.html", "activate.html", "membership.html", "setup-key.html"}

class Doc(HTMLParser):
    def __init__(self):
        super().__init__(); self.tags=[]; self.attrs=[]; self.text=[]
    def handle_starttag(self, tag, attrs):
        self.tags.append(tag); self.attrs.append((tag, dict(attrs)))
    def handle_startendtag(self, tag, attrs): self.handle_starttag(tag, attrs)
    def handle_data(self, data): self.text.append(data)

def read_source(root: str, page: str) -> str:
    if root.startswith(("http://", "https://")):
        with urlopen(root.rstrip("/") + "/" + page, timeout=10) as r:
            if r.status != 200: raise RuntimeError(f"{page}: HTTP {r.status}")
            return r.read().decode("utf-8", "replace")
    return (Path(root) / page).read_text(encoding="utf-8")

def has_attr(doc, key, value=None):
    return any(key in a and (value is None or a[key] == value) for _, a in doc.attrs)

def count_class(doc, name):
    return sum(name in a.get("class", "").split() for _, a in doc.attrs)

def price_consistency(root: str, index_src: str) -> None:
    """站点价格必须与 commercial/SELL.md 完全一致。

    为什么：2026-10-19 之前 index.html 写 ¥49/¥129/¥399/¥19.9 四档，
    而 commercial/SELL.md 写 ¥9.9/¥49/¥699 三档 —— 两套价格同时在世。
    SELL.md 自己声明是「销售页主展示」，所以以它为唯一数据源。
    站点是远程 URL 时跳过（拿不到本地合同文件）。
    """
    import re
    if root.startswith(("http://", "https://")):
        return
    sell = Path(root).resolve().parent / "commercial" / "SELL.md"
    if not sell.exists():
        print(f"NOTE: 跳过价格校验（找不到 {sell}）")
        return
    src = sell.read_text(encoding="utf-8")
    # 只从表格行里取价，避免命中散文里的数字
    contract = set()
    for line in src.splitlines():
        if line.strip().startswith("|") and "¥" in line:
            contract.update(re.findall(r"¥\s?(\d+(?:\.\d+)?)", line))
    if not contract:
        raise AssertionError(f"{sell}: 解析不到价格")
    onpage = set(re.findall(r"¥\s?(\d+(?:\.\d+)?)", index_src))
    missing = contract - onpage
    stale = onpage - contract
    if missing:
        raise AssertionError(f"index.html 缺少合同价 {sorted(missing)}（合同: {sorted(contract)}）")
    if stale:
        raise AssertionError(f"index.html 出现过期价 {sorted(stale)}，合同只有 {sorted(contract)}")

    # 站内任何文件都不许出现合同外价格：防止又冒出第三、第四份价目表。
    # （2026-10-19 实际发生过：site/SELL.md 写 ¥0/¥129/¥399/¥19.9。）
    bad = []
    for p in Path(root).rglob("*"):
        if p.suffix.lower() not in (".html", ".md", ".js"):
            continue
        txt = p.read_text(encoding="utf-8", errors="replace")
        for v in re.findall(r"¥\s?(\d+(?:\.\d+)?)", txt):
            if v not in contract:
                bad.append(f"{p.name}:¥{v}")
    if bad:
        raise AssertionError(f"站内出现合同外价格 {sorted(set(bad))}，合同只有 {sorted(contract)}")
    print(f"PRICE PASS tiers={sorted(contract)}")


def dd_price_check(root: str) -> None:
    import re
    expected = {"9.9", "29", "69"}
    for page in ("pricing.html", "buy.html"):
        src = read_source(root, page)
        found = set(re.findall(r"¥\s?(\d+(?:\.\d+)?)", src))
        if found != expected:
            raise AssertionError(f"{page}: 价格应为 {sorted(expected)}，实际 {sorted(found)}")
    print("PRICE PASS tiers=['29', '69', '9.9'] source=pricing.html,buy.html")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("root", nargs="?", default=str(Path(__file__).resolve().parent)); args = ap.parse_args()
    root = args.root; docs = {}
    for page in PAGES:
        src = read_source(root, page)
        d = Doc(); d.feed(src); docs[page] = d
        if not has_attr(d, "lang", "zh-CN"): raise AssertionError(f"{page}: html lang=zh-CN missing")
        if "title" not in d.tags: raise AssertionError(f"{page}: title missing")
        if "assets/style.css" not in src and "assets/home.css" not in src: raise AssertionError(f"{page}: stylesheet missing")
        if page in RUNTIME_ASSET_PAGES:
            for href in ("assets/config.js", "assets/app.js"):
                if href not in src: raise AssertionError(f"{page}: {href} missing")
        if page not in BUY_PENDING_PAGES:
            continue
        if not has_attr(d, "data-buy"): raise AssertionError(f"{page}: data-buy CTA missing")

        # 购买按钮不许是死链。
        # 2026-10-19 实况：BUY_URL 是空的，而锚点写的是 href="#buy"，可全站没有任何 id="buy" ——
        # 无 JS 时点了就是跳页首；有 JS 时只在旁边冒一行灰字。卖货站的主按钮点了没反应，比不放假按钮还糟。
        # 不变量：每个 data-buy 锚点的静态 href 要么是真实地址，要么指向页内兜底区块；
        #         且兜底区块必须存在、且起始是 hidden（BUY_URL 一填上就自动消失）。
        buy_hrefs = [a.get("href", "") for _, a in d.attrs if "data-buy" in a]
        if not any(h == "#buy-pending" or h.startswith(("http://", "https://")) for h in buy_hrefs):
            raise AssertionError(f"{page}: data-buy 锚点没有可用 href（{buy_hrefs}）")
        boxes = [a for _, a in d.attrs if a.get("id") == "buy-pending"]
        if not boxes:
            raise AssertionError(f"{page}: 缺少 id=buy-pending 兜底区块，data-buy 会变成死链")
        if "hidden" not in boxes[0]:
            raise AssertionError(f"{page}: buy-pending 缺少起始 hidden（BUY_URL 填上后会残留『还没开通』）")
    d = docs["index.html"]
    if count_class(d, "hero") != 1 or count_class(d, "pricing") != 1: raise AssertionError("index.html: hero/pricing structure missing")
    dd_price_check(root)
    d = docs["download.html"]
    for key in ("data-version", "data-size", "data-sha256", "data-release-date", "data-primary-download", "data-mirror-1", "data-mirror-2"):
        if not has_attr(d, key): raise AssertionError(f"download.html: {key} missing")
    d = docs["activate.html"]
    if count_class(d, "steps") != 1 or count_class(d, "step") != 5: raise AssertionError("activate.html: five activation steps missing")
    d = docs["faq.html"]
    if count_class(d, "faq") != 1 or d.tags.count("details") < 5: raise AssertionError("faq.html: FAQ details missing")
    print(f"DOM PASS pages={len(PAGES)} root={root}")

if __name__ == "__main__":
    try: main()
    except (AssertionError, OSError, UnicodeError, RuntimeError) as e:
        print(f"DOM FAIL: {e}"); sys.exit(1)


