import html
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

OUTPUT_DIR = r"C:\Users\hp\IT-Club\IT-Club-master\output\pdf"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "صفحة-الأخبار-كاملة.pdf")
TEMP_DIR = r"C:\Users\hp\IT-Club\IT-Club-master\tmp\pdfs"
HTML_PATH = os.path.join(TEMP_DIR, "news-page.html")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
API_URL = "https://jxweaxenswbjpxxjmihb.supabase.co/rest/v1/club_news?select=id,slug,data,created_at,updated_at&order=updated_at.desc,id.asc"
PUBLIC_KEY = "sb_publishable_kHJik-SCyMiMQ7nn2SRHbQ_0FR6CpOZ"


def clean_text(value):
    value = str(value or "")
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"</p>", "\n\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value)
    return re.sub(r"\n{3,}", "\n\n", value).strip()


payload = sys.stdin.buffer.read()
if payload.strip():
    raw = json.loads(payload.decode("utf-8"))
else:
    request = urllib.request.Request(
        API_URL,
        headers={"apikey": PUBLIC_KEY, "Authorization": f"Bearer {PUBLIC_KEY}"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = json.loads(response.read().decode("utf-8"))
news = []
for row in raw:
    data = row.get("data") or {}
    title = clean_text(data.get("title"))
    details = clean_text(data.get("description"))
    if title or details:
        news.append({"title": title, "date": clean_text(data.get("date")), "details": details})
news.sort(key=lambda item: (item["date"], item["title"]), reverse=True)

articles = []
for item in news:
    body = "".join(f"<p>{html.escape(p)}</p>" for p in item["details"].split("\n\n") if p.strip())
    articles.append(
        f"""
        <article>
          <h2>{html.escape(item['title'])}</h2>
          <time>{html.escape(item['date'])}</time>
          <div class="details">{body}</div>
        </article>
        """
    )

document = f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>أخبار النادي التكنولوجي</title>
  <style>
    @page {{ size: A4; margin: 16mm 18mm; }}
    * {{ box-sizing: border-box; }}
    html, body {{ margin: 0; padding: 0; background: #fff; color: #1f2937; }}
    body {{ font-family: Arial, Tahoma, sans-serif; direction: rtl; text-align: right; font-size: 11pt; line-height: 1.85; }}
    main {{ width: 100%; }}
    .page-title {{ text-align: center; color: #143a5a; font-size: 23pt; margin: 0 0 2mm; }}
    .count {{ text-align: center; color: #64748b; font-size: 10pt; margin: 0 0 11mm; }}
    article {{ break-inside: avoid-page; padding: 0 0 7mm; margin: 0 0 7mm; border-bottom: 1px solid #cbd5e1; }}
    article:last-child {{ border-bottom: 0; margin-bottom: 0; padding-bottom: 0; }}
    h2 {{ color: #173e60; font-size: 15pt; line-height: 1.55; margin: 0 0 1.5mm; break-after: avoid; }}
    time {{ display: block; color: #64748b; font-size: 9pt; margin: 0 0 4mm; break-after: avoid; direction: ltr; text-align: right; }}
    .details p {{ margin: 0 0 4mm; orphans: 3; widows: 3; }}
    .details p:last-child {{ margin-bottom: 0; }}
  </style>
</head>
<body>
  <main>
    <h1 class="page-title">أخبار النادي التكنولوجي</h1>
    <p class="count">عدد الأخبار: {len(news)}</p>
    {''.join(articles)}
  </main>
</body>
</html>"""

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
with open(HTML_PATH, "w", encoding="utf-8") as stream:
    stream.write(document)

url = pathlib.Path(HTML_PATH).resolve().as_uri()
subprocess.run(
    [
        EDGE,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--print-to-pdf-no-header",
        f"--print-to-pdf={OUTPUT_PATH}",
        url,
    ],
    check=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
if not os.path.exists(OUTPUT_PATH) or os.path.getsize(OUTPUT_PATH) == 0:
    raise RuntimeError("PDF was not created")
print(json.dumps({"output": OUTPUT_PATH, "count": len(news)}, ensure_ascii=False))
