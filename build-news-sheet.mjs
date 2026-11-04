import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire("C:/Users/hp/IT-Club/IT-Club-master/.artifact-work/package.json");
const { SpreadsheetFile, Workbook } = require("@oai/artifact-tool");

const outputDir = "C:/Users/hp/IT-Club/IT-Club-master/outputs/news-google-sheet-2026-10-04";
const outputPath = `${outputDir}/اخبار-الموقع.xlsx`;
const previewPath = `${outputDir}/preview.png`;
const sourceUrl = "https://ucas.itclub-143.workers.dev/news";
const apiUrl =
  "https://jxweaxenswbjpxxjmihb.supabase.co/rest/v1/club_news?select=id,slug,data,created_at,updated_at&order=updated_at.desc,id.asc";
const publicKey = "sb_publishable_kHJik-SCyMiMQ7nn2SRHbQ_0FR6CpOZ";

function plainText(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeText(value) {
  const text = plainText(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

let raw;
if (!process.stdin.isTTY) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  raw = JSON.parse(input);
} else {
  const response = await fetch(apiUrl, {
    headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
  });
  if (!response.ok) throw new Error(`تعذر جلب الأخبار: ${response.status}`);
  raw = await response.json();
}
const news = raw
  .map((row) => ({
    title: safeText(row?.data?.title ?? ""),
    date: String(row?.data?.date ?? ""),
    details: safeText(row?.data?.description ?? ""),
  }))
  .filter((item) => item.title || item.details)
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "ar"));

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("الأخبار");
sheet.showGridLines = false;
sheet.tabColor = "#1F4E78";

sheet.getRange("A2:C2").merge();
sheet.getRange("A2").values = [["أخبار موقع النادي التكنولوجي"]];
sheet.getRange("A2:C2").format = {
  font: { name: "Arial", size: 16, bold: true, color: "#1F2937" },
  horizontalAlignment: "right",
  verticalAlignment: "center",
};
sheet.getRange("A3:C3").format.borders = {
  bottom: { style: "medium", color: "#1F4E78" },
};
sheet.getRange("A4").values = [["المصدر"]];
sheet.getRange("B4:C4").merge();
sheet.getRange("B4").values = [[sourceUrl]];
sheet.getRange("A4:C4").format = {
  font: { name: "Arial", size: 10, italic: true, color: "#4B5563" },
  verticalAlignment: "center",
};
sheet.getRange("A4").format.horizontalAlignment = "right";
sheet.getRange("B4:C4").format.horizontalAlignment = "left";

sheet.getRange("A6:C6").values = [["العنوان", "التاريخ", "التفاصيل"]];
const rows = news.map((item) => [
  item.title,
  /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? new Date(`${item.date}T00:00:00Z`) : item.date,
  item.details,
]);
if (rows.length) sheet.getRange("A7").write(rows);

const lastRow = Math.max(7, 6 + rows.length);
const used = sheet.getRange(`A6:C${lastRow}`);
used.format.font = { name: "Arial", size: 10, color: "#1F2937" };
used.format.verticalAlignment = "top";
sheet.getRange(`A7:A${lastRow}`).format.wrapText = true;
sheet.getRange(`C7:C${lastRow}`).format.wrapText = true;
sheet.getRange(`A7:A${lastRow}`).format.horizontalAlignment = "right";
sheet.getRange(`C7:C${lastRow}`).format.horizontalAlignment = "right";
sheet.getRange(`B7:B${lastRow}`).format.numberFormat = "yyyy-mm-dd";
sheet.getRange(`B7:B${lastRow}`).format.horizontalAlignment = "center";
sheet.getRange("A6:C6").format = {
  fill: "#1F4E78",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "inside", style: "thin", color: "#FFFFFF" },
};
sheet.getRange("A6:C6").format.rowHeightPx = 30;
if (rows.length) {
  sheet.getRange(`A7:C${lastRow}`).format.borders = {
    insideHorizontal: { style: "thin", color: "#D9E2F3" },
    bottom: { style: "thin", color: "#D9E2F3" },
  };
}
sheet.getRange(`A1:A${lastRow}`).format.columnWidthPx = 300;
sheet.getRange(`B1:B${lastRow}`).format.columnWidthPx = 115;
sheet.getRange(`C1:C${lastRow}`).format.columnWidthPx = 680;
if (rows.length) sheet.getRange(`A7:C${lastRow}`).format.autofitRows();
sheet.freezePanes.freezeRows(6);

if (rows.length) {
  const table = sheet.tables.add(`A6:C${lastRow}`, true, "NewsTable");
  table.style = "TableStyleMedium2";
  table.showBandedColumns = false;
  table.showFilterButton = true;
}

workbook.recalculate();

const check = await workbook.inspect({
  kind: "table",
  range: `الأخبار!A2:C${Math.min(lastRow, 10)}`,
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 3,
});
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "الأخبار",
  range: `A1:C${Math.min(lastRow, 10)}`,
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(
  JSON.stringify({
    outputPath,
    previewPath,
    count: rows.length,
    check: check.ndjson,
    errors: errors.ndjson,
  }),
);
