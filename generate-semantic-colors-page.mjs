import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DAY_JSON = path.resolve(__dirname, "../Semantic Colors/Day.tokens.json");
const NIGHT_JSON = path.resolve(__dirname, "../Semantic Colors/Night.tokens.json");
const OUTPUT_HTML = path.resolve(__dirname, "colors-tokens.html");

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function collectColors(obj, prefix = "", out = {}) {
  for (const key of Object.keys(obj)) {
    if (key === "$extensions") continue;
    const value = obj[key];
    const pathKey = prefix ? `${prefix}/${key}` : key;

    if (value && typeof value === "object" && value.$type === "color" && value.$value && value.$value.hex) {
      if (!out[pathKey]) out[pathKey] = {};
      out[pathKey].hex = value.$value.hex;
      const alias = value.$extensions && value.$extensions["com.figma.aliasData"];
      if (alias && alias.targetVariableName) {
        out[pathKey].alias = alias.targetVariableName;
      }
    } else if (value && typeof value === "object") {
      collectColors(value, pathKey, out);
    }
  }
  return out;
}

const dayJson = loadJson(DAY_JSON);
const nightJson = loadJson(NIGHT_JSON);

const dayColors = collectColors(dayJson);
const nightColors = collectColors(nightJson);

const allPaths = Array.from(new Set([...Object.keys(dayColors), ...Object.keys(nightColors)])).sort();

const groups = new Map();
for (const tokenPath of allPaths) {
  const [group] = tokenPath.split("/");
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(tokenPath);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Invert Design System — Цветовые токены</title>
  <style>
    body {
      margin: 0;
      padding: 32px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f5;
      color: #111827;
    }

    h1 {
      margin-bottom: 8px;
      font-size: 28px;
    }

    h2 {
      margin-top: 32px;
      margin-bottom: 12px;
      font-size: 20px;
    }

    p {
      margin: 0 0 16px;
      max-width: 720px;
      line-height: 1.5;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      max-width: 960px;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
      margin-bottom: 16px;
    }

    thead {
      background: #f9fafb;
    }

    th, td {
      padding: 10px 12px;
      font-size: 14px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
      vertical-align: middle;
      white-space: nowrap;
    }

    th {
      font-weight: 600;
      color: #4b5563;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .token-name {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13px;
      color: #111827;
    }

    .token-group {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
    }

    .swatch {
      width: 40px;
      height: 24px;
      border-radius: 999px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
    }

    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13px;
    }

    .note {
      margin-top: 8px;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <header>
    <h1>Цветовые токены</h1>
    <p>
      Страница сгенерирована из Figma‑переменных (design tokens) коллекции
      <code>Semantic Colors</code> для режимов Day и Night. Значения и пути
      соответствуют экспортированным JSON‑файлам, без выдуманных данных.
    </p>
  </header>
`;

for (const [group, paths] of groups.entries()) {
  html += `
  <section>
    <h2>${escapeHtml(group)}</h2>
    <table>
      <thead>
        <tr>
          <th>Путь токена</th>
          <th>HEX (Day)</th>
          <th>HEX (Night)</th>
          <th>Alias Day</th>
          <th>Alias Night</th>
        </tr>
      </thead>
      <tbody>
`;

  for (const tokenPath of paths) {
    const day = dayColors[tokenPath] || {};
    const night = nightColors[tokenPath] || {};
    html += `
        <tr>
          <td class="token-name">${escapeHtml(tokenPath)}</td>
          <td class="code">${escapeHtml(day.hex || "—")}</td>
          <td class="code">${escapeHtml(night.hex || "—")}</td>
          <td class="code">${escapeHtml(day.alias || "—")}</td>
          <td class="code">${escapeHtml(night.alias || "—")}</td>
        </tr>
`;
  }

  html += `
      </tbody>
    </table>
  </section>
`;
}

html += `
</body>
</html>
`;

fs.writeFileSync(OUTPUT_HTML, html, "utf8");
console.log(`Сгенерирован файл: ${OUTPUT_HTML}`);

