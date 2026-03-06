import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function collectTokens(obj, prefix = "", out = {}) {
  for (const key of Object.keys(obj)) {
    if (key === "$extensions") continue;
    const value = obj[key];
    const pathKey = prefix ? `${prefix}/${key}` : key;

    if (value && typeof value === "object" && value.$type && "$value" in value) {
      if (!out[pathKey]) out[pathKey] = {};
      out[pathKey].type = value.$type;
      out[pathKey].value = value.$value;
      const ext = value.$extensions || {};
      const alias = ext["com.figma.aliasData"];
      if (alias && alias.targetVariableName) {
        out[pathKey].alias = alias.targetVariableName;
      }
      if (value.$description) {
        out[pathKey].description = value.$description;
      }
    } else if (value && typeof value === "object") {
      collectTokens(value, pathKey, out);
    }
  }
  return out;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "string") return String(v);
  return JSON.stringify(v);
}

function generatePage({ inputPath, outputPath, title, intro }) {
  const json = loadJson(inputPath);
  const tokens = collectTokens(json);
  const allPaths = Object.keys(tokens).sort();

  const groups = new Map();
  for (const tokenPath of allPaths) {
    const [group] = tokenPath.split("/");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(tokenPath);
  }

  let html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
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
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(intro)}</p>
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
          <th>Тип</th>
          <th>Значение</th>
          <th>Alias</th>
          <th>Описание</th>
        </tr>
      </thead>
      <tbody>
`;

    for (const tokenPath of paths) {
      const t = tokens[tokenPath];
      html += `
        <tr>
          <td class="token-name">${escapeHtml(tokenPath)}</td>
          <td class="code">${escapeHtml(t.type || "")}</td>
          <td class="code">${escapeHtml(normalizeValue(t.value))}</td>
          <td class="code">${escapeHtml(t.alias || "—")}</td>
          <td class="code">${escapeHtml(t.description || "—")}</td>
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

  fs.writeFileSync(outputPath, html, "utf8");
  console.log(`Сгенерирован файл: ${outputPath}`);
}

const configs = [
  {
    inputPath: path.resolve(__dirname, "../Mode 1.tokens 2.json"),
    outputPath: path.resolve(__dirname, "radius-spacing-tokens.html"),
    title: "Invert Design System — Radius & Spacing tokens",
    intro: "Страница сгенерирована из Mode 1.tokens 2.json и отражает все токены радиусов, отступов, spacing и gap."
  },
  {
    inputPath: path.resolve(__dirname, "../Mode 1.tokens 3.json"),
    outputPath: path.resolve(__dirname, "typography-presets-tokens.html"),
    title: "Invert Design System — Typography presets",
    intro: "Страница сгенерирована из Mode 1.tokens 3.json и отражает все типографические пресеты (h1, body, button.label и т.п.)."
  },
  {
    inputPath: path.resolve(__dirname, "../Typography/Android.tokens.json"),
    outputPath: path.resolve(__dirname, "typography-android-tokens.html"),
    title: "Invert Design System — Typography Android tokens",
    intro: "Страница сгенерирована из Typography/Android.tokens.json и отражает все типографические токены Android."
  },
  {
    inputPath: path.resolve(__dirname, "../Typography/IOS.tokens.json"),
    outputPath: path.resolve(__dirname, "typography-ios-tokens.html"),
    title: "Invert Design System — Typography iOS tokens",
    intro: "Страница сгенерирована из Typography/IOS.tokens.json и отражает все типографические токены iOS."
  }
];

for (const config of configs) {
  generatePage(config);
}

