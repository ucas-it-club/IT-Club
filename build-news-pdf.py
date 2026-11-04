import html
import json
import os
import re
import sys
import textwrap

from arabic_reshaper import reshape
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUTPUT_DIR = r"C:\Users\hp\IT-Club\IT-Club-master\output\pdf"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "صفحة-الأخبار-كاملة.pdf")
FONT_PATH = r"C:\Windows\Fonts\arial.ttf"
FONT_BOLD_PATH = r"C:\Windows\Fonts\arialbd.ttf"


def clean_text(value):
    value = str(value or "")
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"</p>", "\n\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value)
    return re.sub(r"\n{3,}", "\n\n", value).strip()


def rtl(value):
    return get_display(reshape(clean_text(value)))


def paragraph_text(value, width=95):
    rendered = []
    for source_line in clean_text(value).splitlines():
        if not source_line.strip():
            rendered.append("")
            continue
        for line in textwrap.wrap(source_line, width=width, break_long_words=False, break_on_hyphens=False):
            rendered.append(html.escape(rtl(line)))
    return "<br/>".join(line if line else "<br/>" for line in rendered)


raw = json.load(sys.stdin)
news = []
for row in raw:
    data = row.get("data") or {}
    title = clean_text(data.get("title"))
    details = clean_text(data.get("description"))
    if title or details:
        news.append(
            {
                "title": title,
                "date": clean_text(data.get("date")),
                "details": details,
            }
        )
news.sort(key=lambda item: (item["date"], item["title"]), reverse=True)

os.makedirs(OUTPUT_DIR, exist_ok=True)
pdfmetrics.registerFont(TTFont("Arabic", FONT_PATH, shapable=False))
pdfmetrics.registerFont(TTFont("Arabic-Bold", FONT_BOLD_PATH, shapable=False))

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "ArabicTitle",
    parent=styles["Title"],
    fontName="Arabic-Bold",
    fontSize=22,
    leading=30,
    alignment=TA_CENTER,
    textColor=colors.HexColor("#143A5A"),
    spaceAfter=12,
    wordWrap="LTR",
)
count_style = ParagraphStyle(
    "ArabicCount",
    parent=styles["Normal"],
    fontName="Arabic",
    fontSize=10,
    leading=15,
    alignment=TA_CENTER,
    textColor=colors.HexColor("#64748B"),
    wordWrap="LTR",
)
news_title_style = ParagraphStyle(
    "NewsTitle",
    parent=styles["Heading2"],
    fontName="Arabic-Bold",
    fontSize=14,
    leading=22,
    alignment=TA_RIGHT,
    textColor=colors.HexColor("#173E60"),
    spaceAfter=5,
    wordWrap="LTR",
)
date_style = ParagraphStyle(
    "Date",
    parent=styles["Normal"],
    fontName="Arabic",
    fontSize=9,
    leading=13,
    alignment=TA_RIGHT,
    textColor=colors.HexColor("#64748B"),
    spaceAfter=8,
)
body_style = ParagraphStyle(
    "ArabicBody",
    parent=styles["BodyText"],
    fontName="Arabic",
    fontSize=10.5,
    leading=19,
    alignment=TA_RIGHT,
    textColor=colors.HexColor("#1F2937"),
    wordWrap="LTR",
)

doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=16 * mm,
    bottomMargin=16 * mm,
    title="أخبار موقع النادي التكنولوجي",
    author="UCAS IT Club",
)

story = [
    Paragraph(html.escape(rtl("أخبار النادي التكنولوجي")), title_style),
    Paragraph(html.escape(rtl(f"عدد الأخبار: {len(news)}")), count_style),
    Spacer(1, 8 * mm),
]

for index, item in enumerate(news):
    heading = [
        Paragraph(paragraph_text(item["title"], width=58), news_title_style),
        Paragraph(html.escape(item["date"]), date_style),
    ]
    story.append(KeepTogether(heading))
    story.append(Paragraph(paragraph_text(item["details"]), body_style))
    if index < len(news) - 1:
        story.append(Spacer(1, 5 * mm))
        rule = Table([[""]], colWidths=[174 * mm], rowHeights=[0.6])
        rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#CBD5E1"))]))
        story.append(rule)
        story.append(Spacer(1, 6 * mm))

doc.build(story)
print(json.dumps({"output": OUTPUT_PATH, "count": len(news)}, ensure_ascii=False))
