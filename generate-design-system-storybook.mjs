import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");

const PATHS = {
  baseColors: path.resolve(ROOT, "Mode 1.tokens.json"),
  radiusSpacing: path.resolve(ROOT, "Mode 1.tokens 2.json"),
  typographyPresets: path.resolve(ROOT, "Mode 1.tokens 3.json"),
  semanticDay: path.resolve(ROOT, "Semantic Colors/Day.tokens.json"),
  semanticNight: path.resolve(ROOT, "Semantic Colors/Night.tokens.json"),
  typoAndroid: path.resolve(ROOT, "Typography/Android.tokens.json"),
  typoIOS: path.resolve(ROOT, "Typography/IOS.tokens.json")
};

const OUTPUT_HTML = path.resolve(__dirname, "design-system-storybook.html");

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isLightHex(hex) {
  const h = (hex || "").replace(/^#/, "");
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.5;
}

function normalizeValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "string") return String(v);
  return JSON.stringify(v);
}

// Load all data
const baseColorsJson = loadJson(PATHS.baseColors);
const radiusSpacingJson = loadJson(PATHS.radiusSpacing);
const typographyPresetsJson = loadJson(PATHS.typographyPresets);
const semanticDayJson = loadJson(PATHS.semanticDay);
const semanticNightJson = loadJson(PATHS.semanticNight);
const typoAndroidJson = loadJson(PATHS.typoAndroid);
const typoIOSJson = loadJson(PATHS.typoIOS);

// Base palette
const baseColorsTokens = collectTokens(baseColorsJson);
const baseColorEntries = Object.entries(baseColorsTokens)
  .filter(([, t]) => t.type === "color")
  .sort(([a], [b]) => a.localeCompare(b));

// Radius / spacing / gaps
const radiusSpacingTokens = collectTokens(radiusSpacingJson);
const radiusSpacingEntries = Object.entries(radiusSpacingTokens).sort(([a], [b]) => a.localeCompare(b));

// Typography presets
const typographyPresetsTokens = collectTokens(typographyPresetsJson);
const typographyPresetsEntries = Object.entries(typographyPresetsTokens).sort(([a], [b]) => a.localeCompare(b));

// Semantic colors
const semanticDayColors = collectColors(semanticDayJson);
const semanticNightColors = collectColors(semanticNightJson);
const semanticPaths = Array.from(
  new Set([...Object.keys(semanticDayColors), ...Object.keys(semanticNightColors)])
).sort();

// Typography platforms
const typoAndroidTokens = collectTokens(typoAndroidJson);
const typoIOSTokens = collectTokens(typoIOSJson);

function groupByFirstSegment(entries) {
  const groups = new Map();
  for (const [pathKey, value] of entries) {
    const [group] = pathKey.split("/");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push([pathKey, value]);
  }
  return groups;
}

const baseColorGroups = groupByFirstSegment(baseColorEntries);
const radiusSpacingGroups = groupByFirstSegment(radiusSpacingEntries);
const typoPresetGroups = groupByFirstSegment(typographyPresetsEntries);
const typoAndroidGroups = groupByFirstSegment(Object.entries(typoAndroidTokens).sort(([a], [b]) => a.localeCompare(b)));
const typoIOSGroups = groupByFirstSegment(Object.entries(typoIOSTokens).sort(([a], [b]) => a.localeCompare(b)));

// Build simple preset models (size/line-height/weight) for visual specimens
const typographySpecimens = new Map();
for (const [pathKey, token] of typographyPresetsEntries) {
  const segments = pathKey.split("/");
  const root = segments[0];
  const prop = segments.slice(1).join("/");
  if (!typographySpecimens.has(root)) typographySpecimens.set(root, {});
  const model = typographySpecimens.get(root);
  if (prop === "size") model.size = token.value;
  else if (prop === "line-height") model.lineHeight = token.value;
  else if (prop === "weight") model.weight = token.value;
}

// Build HTML
let html = `<!DOCTYPE html>
<html lang="ru" data-theme="light">
<head>
  <meta charset="UTF-8">
  <title>Invert StoryBook</title>
  <style>
    * {
      box-sizing: border-box;
    }

    :root {
      --bg-body: #F0F0F0;
      --text-primary: #111111;
      --text-secondary: #404040;
      --text-muted: #737373;
      --bg-sidebar: #ffffff;
      --border-sidebar: #e5e5e5;
      --bg-header: #242424;
      --border-header: #333;
      --search-bg: #333;
      --search-border: #444;
      --search-color: #ffffff;
      --bg-content: #F0F0F0;
      --bg-card: #ffffff;
      --border-card: transparent;
      --nav-hover: #f0f0f0;
      --nav-active-bg: #E0F6E5;
      --nav-active-color: #0EA658;
      --demo-bg: #242424;
      --variant-bg: #f5f5f5;
      --table-bg: #ffffff;
      --thead-bg: #f5f5f5;
      --intro-link-bg: #E0F6E5;
      --intro-link-color: #0EA658;
      --spec-border: #e5e5e5;
      --comp-bg: #ffffff;
      --comp-bg-alt: #E0F6E5;
      --comp-text: #111111;
      --comp-text-muted: #5E5E5E;
      --comp-btn-sec-bg: #E0F6E5;
      --comp-btn-sec-color: #0EA658;
      --comp-btn-ter-color: #0EA658;
      --comp-grabber: #5E5E5E;
      --comp-circle-left: #F3F4F6;
      --comp-phone-bg: #F5F5F5;
      --snackbar-default-bg: #F5F5F5;
      --snackbar-default-text: #111111;
      --avatar-letters-bg: #E0F6E5;
      --avatar-icon-bg: #E0F6E5;
      --avatar-icon-color: #0DC267;
      --avatar-text: #111111;
      --avatar-image-bg: #E5E7EB;
      --avatar-status-border: #242424;
      --specimen-border: rgba(0, 0, 0, 0.2);
    }

    [data-theme="dark"] {
      --bg-body: #111111;
      --text-primary: #f5f5f5;
      --text-secondary: #d0d0d0;
      --text-muted: #a3a3a3;
      --bg-sidebar: #1a1a1a;
      --border-sidebar: #333;
      --bg-header: #0d0d0d;
      --border-header: #333;
      --search-bg: #333;
      --search-border: #555;
      --search-color: #f5f5f5;
      --bg-content: #111111;
      --bg-card: #1a1a1a;
      --border-card: #333;
      --nav-hover: #2a2a2a;
      --nav-active-bg: #1e3d2a;
      --nav-active-color: #4ade80;
      --demo-bg: #0d0d0d;
      --variant-bg: #262626;
      --table-bg: #1a1a1a;
      --thead-bg: #262626;
      --intro-link-bg: #1e3d2a;
      --intro-link-color: #4ade80;
      --spec-border: #333;
      --comp-bg: #1a1a1a;
      --comp-bg-alt: #1e3d2a;
      --comp-text: #f5f5f5;
      --comp-text-muted: #9ca3af;
      --comp-btn-sec-bg: #1e3d2a;
      --comp-btn-sec-color: #4ade80;
      --comp-btn-ter-color: #4ade80;
      --comp-grabber: #6b7280;
      --comp-circle-left: #374151;
      --comp-phone-bg: #111111;
      --snackbar-default-bg: #262626;
      --snackbar-default-text: #f5f5f5;
      --avatar-letters-bg: #1e3d2a;
      --avatar-icon-bg: #1e3d2a;
      --avatar-icon-color: #4ade80;
      --avatar-text: #f5f5f5;
      --avatar-image-bg: #374151;
      --avatar-status-border: #1a1a1a;
      --specimen-border: rgba(255, 255, 255, 0.2);
    }

    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg-body);
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
      height: 100vh;
      min-height: 100vh;
      overflow: hidden;
    }

    .content-top-bar {
      position: sticky;
      bottom: 16px;
      z-index: 50;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      pointer-events: none;
    }

    .content-top-bar .search-wrap {
      flex: 1;
      min-width: 0;
      max-width: none;
      pointer-events: auto;
      display: flex;
      align-items: center;
      padding: 10px 16px;
      min-height: 54px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(27px);
      -webkit-backdrop-filter: blur(27px);
    }

    [data-theme="dark"] .content-top-bar .search-wrap {
      background: rgba(26, 26, 26, 0.75);
    }

    .content-top-bar .search-input {
      width: 100%;
      border: none;
      outline: none;
      background-color: transparent;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: 0 50%;
      background-size: 18px 18px;
      padding: 0 0 0 28px;
      font-size: 17px;
      line-height: 1.2;
      font-weight: 500;
      color: var(--text-primary);
      opacity: 0.9;
    }

    .content-top-bar .search-input::placeholder {
      color: var(--text-muted);
      opacity: 0.7;
    }

    .content-top-bar .search-input:hover,
    .content-top-bar .search-input:focus {
      border: none;
      box-shadow: none;
    }

    [data-theme="dark"] .content-top-bar .search-input {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
    }

    .theme-toggle {
      position: relative;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 52px 6px 16px;
      min-height: 54px;
      border: none;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.9);
      color: #111111;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      pointer-events: auto;
      transition: background 0.2s ease-out;
    }

    [data-theme="dark"] .theme-toggle {
      background: rgba(26, 26, 26, 0.9);
      color: #f5f5f5;
    }

    .theme-toggle svg {
      display: none;
    }

    .theme-label {
      pointer-events: none;
      margin-right: 4px;
      white-space: nowrap;
    }

    .theme-toggle::before {
      content: "";
      position: absolute;
      top: 50%;
      right: 12px;
      width: 40px;
      height: 24px;
      border-radius: 999px;
      background: rgba(60, 60, 67, 0.3);
      transform: translateY(-50%);
    }

    .theme-toggle::after {
      content: "";
      position: absolute;
      top: 50%;
      right: 32px;
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: #ffffff;
      box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.18);
      transform: translateY(-50%);
      transition: transform 0.2s ease-out, background 0.2s ease-out, box-shadow 0.2s ease-out;
    }

    [data-theme="dark"] .theme-toggle::before {
      background: #34c759;
    }

    [data-theme="dark"] .theme-toggle::after {
      transform: translate(18px, -50%);
      box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.4);
    }

    .search-wrap {
      flex: 1;
      min-width: 0;
      max-width: 480px;
    }

    .search-input {
      width: 100%;
      padding: 10px 16px 10px 40px;
      font-size: 15px;
      line-height: 1.4;
      border: 1px solid var(--search-border);
      border-radius: 10px;
      background: var(--search-bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 12px 50%;
      background-size: 18px 18px;
      color: var(--search-color);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .search-input::placeholder {
      color: #a3a3a3;
    }

    .search-input:hover {
      border-color: #555;
    }

    .search-input:focus {
      border-color: #0DC267;
      box-shadow: 0 0 0 2px rgba(13, 194, 103, 0.3);
    }

    .app-body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      padding: 16px 16px 0 16px;
      gap: 16px;
      align-items: stretch;
    }

    .search-hidden {
      display: none !important;
    }

    .sidebar-card {
      flex-shrink: 0;
      width: 280px;
      border-radius: 24px;
      background: var(--bg-card);
      overflow: hidden;
      position: sticky;
      top: 0;
      max-height: calc(100vh - 32px);
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
      min-width: 0;
      flex: 1;
      min-height: 0;
      background: transparent;
      color: var(--text-primary);
      padding: 24px 24px 24px 28px;
      overflow-y: auto;
      font-weight: 400;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
      flex-shrink: 0;
    }

    .sidebar-brand-img {
      height: 33px;
      width: auto;
      display: block;
    }

    .sidebar-brand-title {
      font-size: 24px;
      font-weight: 400;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    .sidebar h1 {
      font-size: 18px;
      font-weight: 400;
      margin: 0;
      color: var(--text-primary);
    }

    .sidebar h2 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 20px 0 8px;
      color: var(--text-muted);
      font-weight: 400;
    }

    .nav-group {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .nav-group li {
      margin-bottom: 2px;
    }

    .nav-link {
      display: block;
      padding: 10px 12px;
      border-radius: 8px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
      transition: background 0.15s, color 0.15s;
    }

    .nav-link:hover {
      background: var(--nav-hover);
      color: var(--text-primary);
    }

    .nav-link.active {
      background: var(--nav-active-bg);
      color: var(--nav-active-color);
      font-weight: 400;
    }

    .intro-block {
      background: var(--bg-card);
      border-radius: 24px;
      padding: 28px 32px;
      margin-bottom: 24px;
    }

    .intro-block h2 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 22px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .intro-block p {
      font-size: 15px;
      line-height: 1.6;
      color: var(--text-secondary);
      margin-bottom: 14px;
      max-width: 720px;
    }

    .intro-block p:last-child {
      margin-bottom: 0;
    }

    .intro-block ul {
      margin: 12px 0 20px;
      padding-left: 24px;
      color: var(--text-secondary);
      line-height: 1.7;
      font-size: 15px;
    }

    .intro-block li {
      margin-bottom: 6px;
    }

    .intro-links {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--spec-border);
    }

    .intro-links-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }

    .intro-link-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      margin-right: 12px;
      margin-bottom: 8px;
      background: var(--intro-link-bg);
      color: var(--intro-link-color);
      border-radius: 12px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }

    .intro-link-btn:hover {
      background: #0DC267;
      color: #ffffff;
    }

    .content {
      position: relative;
      flex: 1 1 0%;
      min-width: 0;
      min-height: 0;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
      background: transparent;
    }

    .content-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: scroll;
      overflow-x: hidden;
      padding: 16px 16px 0 16px;
    }

    .content-scroll .intro-block,
    .content-scroll section {
      margin-bottom: 24px;
    }

    .content-card {
      background: var(--bg-card);
      border-radius: 24px;
      padding: 24px 28px;
      margin-bottom: 24px;
    }

    .content-card h2 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .content-card .card-description {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .content section {
      background: var(--bg-card);
      border-radius: 24px;
      padding: 24px 28px;
      margin-bottom: 24px;
      overflow: visible;
    }

    .content section h2 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .section-heading-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 0;
      margin-bottom: 8px;
    }

    .section-heading-row h2 {
      margin: 0;
    }

    .section-tag {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.3;
      border-radius: 8px;
      background: var(--nav-active-bg);
      color: var(--nav-active-color);
    }

    .section-tag--link {
      text-decoration: none;
      transition: opacity 0.2s, background 0.2s;
    }

    .section-tag--link:hover {
      opacity: 0.9;
    }

    .section-tag-wrap {
      position: relative;
      margin-left: auto;
      display: inline-flex;
    }

    .section-tag-wrap .section-tag-popover {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(-6px);
      padding: 6px 10px;
      font-size: 12px;
      line-height: 1.3;
      color: var(--text-primary);
      background: var(--bg-card);
      border: 1px solid var(--spec-border);
      border-radius: 8px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
      pointer-events: none;
      z-index: 50;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    [data-theme="dark"] .section-tag-wrap .section-tag-popover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .section-tag-wrap:hover .section-tag-popover {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(-8px);
    }

    .content section > .note {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 20px;
      line-height: 1.5;
    }

    h2 {
      margin-top: 32px;
      margin-bottom: 12px;
      font-size: 22px;
    }

    h3 {
      margin-top: 24px;
      margin-bottom: 8px;
      font-size: 16px;
    }

    p {
      margin: 0 0 16px;
      max-width: 720px;
      line-height: 1.5;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      background: var(--table-bg);
      border-radius: 0;
      overflow: hidden;
      margin-bottom: 16px;
    }

    thead {
      background: var(--thead-bg);
    }

    th, td {
      padding: 8px 10px;
      font-size: 13px;
      border-bottom: 1px solid var(--spec-border);
      text-align: left;
      vertical-align: middle;
      color: var(--text-primary);
    }

    td {
      word-break: break-word;
    }

    th {
      font-weight: 600;
      color: var(--text-muted);
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .token-name {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      color: var(--text-primary);
    }

    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
    }

    .swatch {
      width: 32px;
      height: 18px;
      border-radius: 0;
    }

    .note {
      margin-top: 4px;
      font-size: 12px;
      color: var(--text-muted);
    }

    .palette-row {
      display: flex;
      flex-wrap: nowrap;
      gap: 8px;
      padding: 4px 0 16px;
      overflow-x: auto;
    }

    .color-card {
      min-width: 100px;
      width: 100px;
      height: 120px;
      border-radius: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 12px;
      box-sizing: border-box;
      cursor: pointer;
      transition: transform 0.08s ease-out, box-shadow 0.08s ease-out;
    }

    .color-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }

    .color-card--copied {
      box-shadow: 0 0 0 2px #0DC267;
    }

    .copy-snackbar {
      position: fixed;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      padding: 10px 16px;
      border-radius: 999px;
      background: rgba(26, 26, 26, 0.9);
      color: #f5f5f5;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease-out, transform 0.2s ease-out;
      z-index: 80;
    }

    .copy-snackbar--visible {
      opacity: 1;
      transform: translate(-50%, -4px);
    }

    .color-card--light {
      color: #111111;
    }

    .color-card--dark {
      color: #ffffff;
    }

    .color-card-name {
      font-size: 18px;
      font-weight: 600;
      line-height: 1.2;
      text-align: center;
    }

    .color-card-hex {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 11px;
      opacity: 0.9;
      text-align: center;
    }

    .palette-tile {
      min-width: 80px;
      max-width: 96px;
      background: var(--bg-card);
      border-radius: 24px;
      padding: 8px 8px 6px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }

    .palette-swatch {
      width: 100%;
      height: 40px;
      border-radius: 8px;
    }

    .palette-name {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 11px;
      color: var(--text-primary);
    }

    .palette-hex {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 10px;
      color: var(--text-muted);
    }

    .type-specimens-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }

    .type-specimen {
      background: var(--bg-card);
      border: 1px solid var(--specimen-border);
      border-radius: 24px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--text-primary);
    }

    .type-specimen-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    .type-specimen-meta {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 11px;
      color: var(--text-muted);
    }

    .accordion-doc {
      margin-top: 16px;
      width: 100%;
      padding: 24px;
      background: var(--demo-bg);
      border-radius: 24px;
      display: flex;
      justify-content: center;
      overflow: visible;
    }

    .accordion-card {
      background: var(--comp-bg);
      width: 442px;
      border-radius: 24px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 16px;
      overflow: hidden;
    }

    .accordion-card[data-open="false"] {
      gap: 0;
    }

    .accordion-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 16px;
    }

    .accordion-title {
      font-family: "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 22px;
      font-weight: 600;
      color: var(--comp-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .accordion-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .accordion-icon-inner {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .accordion-icon-img {
      width: 16px;
      height: 16px;
      display: block;
      transform-origin: center;
      transition: transform 0.25s ease-out;
    }

    [data-theme="dark"] .accordion-icon-img {
      filter: invert(1);
    }

    .accordion-card[data-open="true"] .accordion-icon-img {
      transform: scaleY(-1);
    }

    .accordion-content {
      width: 100%;
      height: 128px;
      min-height: 0;
      flex-shrink: 0;
      background: var(--comp-bg-alt);
      overflow: hidden;
      max-height: 128px;
      transition: max-height 0.28s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.2s ease-out;
    }

    .accordion-card[data-open="false"] .accordion-content {
      max-height: 0;
      opacity: 0;
    }

    .accordion-card[data-open="true"] .accordion-content {
      max-height: 128px;
      opacity: 1;
    }

    .bottomsheet-doc {
      margin-top: 16px;
      padding: 24px;
      background: var(--demo-bg);
      border-radius: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      overflow: visible;
    }

    .bottomsheet-phone {
      width: 375px;
      height: 812px;
      background: var(--comp-phone-bg);
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .bottomsheet-shell {
      width: 375px;
      border-radius: 38px 38px 0 0;
      background: var(--comp-bg);
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: height 0.28s ease-out;
    }

    .bottomsheet-header {
      width: 100%;
      padding: 5px 16px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    .bottomsheet-grabber {
      width: 36px;
      height: 5px;
      border-radius: 100px;
      background: var(--comp-grabber);
    }

    .bottomsheet-toolbar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .bottomsheet-circle-btn {
      width: 44px;
      height: 44px;
      border-radius: 296px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bottomsheet-circle-btn--left {
      background: var(--comp-circle-left);
    }

    .bottomsheet-circle-btn--right {
      background: #0DC267;
    }

    .bottomsheet-circle-btn img {
      width: 24px;
      height: 24px;
      display: block;
    }

    .bottomsheet-title {
      font-family: "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 22px;
      font-weight: 600;
      color: var(--comp-text);
      white-space: nowrap;
    }

    .bottomsheet-body {
      width: 100%;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-sizing: border-box;
      transition: height 0.28s ease-out;
    }

    .bottomsheet-swapper {
      width: 343px;
      flex: 1 0 0;
      background: var(--comp-bg-alt);
      border-radius: 24px;
    }

    .bottomsheet-actions {
      width: 343px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .bottomsheet-btn {
      width: 100%;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 22px;
      font-weight: 500;
      cursor: default;
    }

    .bottomsheet-btn--primary {
      background: #0DC267;
      color: #FFFFFF;
    }

    .bottomsheet-btn--secondary {
      background: var(--comp-btn-sec-bg);
      color: var(--comp-btn-sec-color);
    }

    .snackbar-doc {
      margin-top: 16px;
      padding: 24px;
      background: var(--demo-bg);
      border-radius: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      overflow: visible;
    }

    .snackbar {
      border-radius: 56px;
      padding: 10px 12px;
      max-width: 351px;
      min-width: 0;
      font-family: "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      line-height: 16px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    .snackbar--success {
      background: #0DC267;
      color: #FFFFFF;
    }

    .snackbar--danger {
      background: #FF4D3A;
      color: #FFFFFF;
    }

    .snackbar--default {
      background: var(--snackbar-default-bg);
      color: var(--snackbar-default-text);
    }

    .component-spec {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--spec-border);
    }

    .component-spec h3 {
      margin-top: 20px;
      margin-bottom: 8px;
      font-size: 14px;
      color: var(--text-muted);
    }

    .component-spec h3:first-child {
      margin-top: 0;
    }

    .component-spec .spec-table {
      margin-bottom: 16px;
    }

    .component-spec .spec-table th {
      width: 180px;
    }

    .spec-accordion {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--spec-border);
    }

    .spec-accordion summary {
      list-style: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      padding: 4px 0;
      user-select: none;
    }

    .spec-accordion summary::-webkit-details-marker {
      display: none;
    }

    .spec-accordion summary::before {
      content: "▶";
      display: inline-block;
      margin-right: 8px;
      font-size: 10px;
      transition: transform 0.2s;
    }

    .spec-accordion[open] summary::before {
      transform: rotate(90deg);
    }

    .spec-accordion .note,
    .spec-accordion .spec-table {
      margin-top: 12px;
    }

    .actionbar-doc {
      margin-top: 16px;
      padding: 24px;
      background: var(--demo-bg);
      border-radius: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 375px));
      gap: 24px;
      justify-content: center;
      overflow: visible;
      max-width: 100%;
      box-sizing: border-box;
    }

    .actionbar-card--live {
      grid-column: 1 / -1;
      justify-self: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: opacity 0.3s ease;
    }

    .actionbar-collapse {
      overflow: hidden;
      transition: max-height 0.28s ease-out, opacity 0.28s ease-out, margin 0.28s ease-out;
    }

    .actionbar-collapse.actionbar--hidden {
      max-height: 0 !important;
      opacity: 0;
    }

    .actionbar-swapper-wrap {
      width: 100%;
      max-width: 343px;
      align-self: stretch;
    }
    .actionbar-swapper-wrap.actionbar-collapse { max-height: 48px; }
    .actionbar-swapper-wrap.actionbar-collapse.actionbar--hidden { margin-bottom: 0 !important; }
    .actionbar-swapper-wrap.actionbar-collapse:not(.actionbar--hidden) { margin-bottom: 16px; }

    .actionbar-btn-item.actionbar-collapse { max-height: 64px; }
    .actionbar-btn-item.actionbar-collapse.actionbar--hidden { margin-bottom: 0 !important; }
    .actionbar-btn-item.actionbar-collapse:not(.actionbar--hidden) { margin-bottom: 12px; }

    .actionbar-home-collapse.actionbar-collapse { max-height: 42px; }
    .actionbar-home-collapse.actionbar-collapse.actionbar--hidden { margin-bottom: 0 !important; }
    .actionbar-home-collapse.actionbar-collapse:not(.actionbar--hidden) { margin-top: 12px; }

    .actionbar-btn-item { margin-bottom: 12px; }
    .actionbar-btn-item.actionbar-collapse.actionbar--hidden { margin-bottom: 0 !important; }

    .actionbar-card {
      width: 375px;
      max-width: 100%;
      background: var(--comp-bg);
      border-radius: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      overflow: visible;
      box-sizing: border-box;
    }

    .actionbar-swapper {
      width: 100%;
      max-width: 343px;
      height: 48px;
      background: var(--comp-bg-alt);
      border: 1px dashed #0DC267;
      border-radius: 0;
      box-sizing: border-box;
    }

    .actionbar-bar {
      background: var(--comp-bg);
      border-radius: 0;
      padding: 0;
      width: 100%;
      max-width: 343px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      box-sizing: border-box;
    }

    .actionbar-buttons {
      width: 100%;
      max-width: 343px;
      display: flex;
      flex-direction: column;
      gap: 0;
      box-sizing: border-box;
    }

    .actionbar-btn {
      height: 52px;
      padding: 12px 16px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 22px;
      font-weight: 500;
      cursor: default;
      box-sizing: border-box;
      transition: opacity 0.2s ease, background 0.25s ease, color 0.25s ease;
    }

    .actionbar-btn--primary {
      background: #0DC267;
      color: #FFFFFF;
    }

    .actionbar-btn--secondary {
      background: var(--comp-btn-sec-bg);
      color: var(--comp-btn-sec-color);
    }

    .actionbar-btn--tertiary {
      background: transparent;
      color: var(--comp-btn-ter-color);
    }

    .actionbar-home-wrap {
      height: 34px;
      width: 100%;
      max-width: 343px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 8px;
      box-sizing: border-box;
    }

    .actionbar-home-indicator {
      width: 139px;
      height: 5px;
      border-radius: 100px;
      background: #111111;
      flex-shrink: 0;
    }

    [data-theme="dark"] .actionbar-home-indicator {
      background: #ffffff;
    }

    .avatar-doc {
      margin-top: 16px;
      padding: 24px;
      background: var(--demo-bg);
      border-radius: 24px;
      overflow: visible;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .avatar-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      justify-content: center;
      align-items: flex-end;
    }

    .avatar-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .avatar-group-title {
      font-size: 12px;
      color: rgba(255,255,255,0.7);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .avatar-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }

    .avatar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "SF Pro Display", system-ui, sans-serif;
      font-weight: 600;
      color: var(--avatar-text);
      overflow: hidden;
      transition: width 0.3s ease, height 0.3s ease, background 0.25s ease, color 0.25s ease, opacity 0.2s ease;
    }

    .avatar--circle {
      border-radius: 50%;
    }

    .avatar--square {
      border-radius: 10px;
    }

    .avatar--16 { width: 16px; height: 16px; font-size: 6px; }
    .avatar--24 { width: 24px; height: 24px; font-size: 8px; }
    .avatar--40 { width: 40px; height: 40px; font-size: 14px; }
    .avatar--48 { width: 48px; height: 48px; font-size: 18px; }
    .avatar--96 { width: 96px; height: 96px; font-size: 32px; }
    .avatar--208 { width: 208px; height: 208px; font-size: 72px; }

    .avatar--placeholder {
      background: #9CA3AF;
    }

    .avatar--letters {
      background: var(--avatar-letters-bg);
    }

    .avatar--icon {
      background: var(--avatar-icon-bg);
      color: var(--avatar-icon-color);
    }

    .avatar--image {
      background: var(--avatar-image-bg);
    }

    .avatar .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: inherit;
    }

    .avatar-wrap {
      position: relative;
      display: inline-flex;
    }

    .avatar-live-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .avatar-status {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 25%;
      height: 25%;
      min-width: 6px;
      min-height: 6px;
      border-radius: 50%;
      background: #0DC267;
      border: 2px solid var(--avatar-status-border);
      box-sizing: border-box;
    }

    .variant-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 16px 24px;
      margin-bottom: 20px;
      padding: 16px 20px;
      background: var(--variant-bg);
      border-radius: 12px;
    }

    .variant-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .variant-row label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      min-width: 48px;
    }

    .variant-row select {
      appearance: none;
      padding: 10px 36px 10px 14px;
      border: 1px solid var(--spec-border);
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
      background: var(--bg-card) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center;
      background-size: 16px 16px;
      color: var(--text-primary);
      min-width: 120px;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .variant-row select:hover {
      border-color: var(--text-muted);
    }

    .variant-row select:focus {
      outline: none;
      border-color: #0DC267;
      box-shadow: 0 0 0 2px rgba(13, 194, 103, 0.25);
    }

    .variant-row--full { flex: 1 1 100%; min-width: 0; }
    .variant-text-input {
      flex: 1;
      min-width: 120px;
      padding: 10px 14px;
      border: 1px solid var(--spec-border);
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
      background: var(--bg-card);
      color: var(--text-primary);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .variant-text-input::placeholder { color: var(--text-muted); }
    .variant-text-input:hover { border-color: var(--text-muted); }
    .variant-text-input:focus {
      outline: none;
      border-color: #0DC267;
      box-shadow: 0 0 0 2px rgba(13, 194, 103, 0.25);
    }

    [data-theme="dark"] .variant-row select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    }

    .btn-doc {
      margin-top: 8px;
      padding: 24px;
      background: var(--demo-bg);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
    }

    .live-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      max-width: 351px;
      min-width: 0;
      font-family: "SF Pro Display", system-ui, sans-serif;
      font-weight: 500;
      border: none;
      border-radius: 12px;
      cursor: default;
      transition: opacity 0.25s ease, background 0.25s ease, color 0.25s ease, padding 0.25s ease, font-size 0.25s ease;
    }

    .live-btn .btn-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .live-btn--xs { padding: 8px 12px; font-size: 14px; line-height: 20px; }
    .live-btn--s  { padding: 12px 16px; font-size: 16px; line-height: 22px; }
    .live-btn--m  { padding: 14px 20px; font-size: 16px; line-height: 22px; }
    .live-btn--l  { padding: 16px 24px; font-size: 18px; line-height: 24px; }

    .live-btn--primary   { background: #0DC267; color: #fff; }
    .live-btn--secondary { background: var(--comp-btn-sec-bg); color: var(--comp-btn-sec-color); }
    .live-btn--tertiary  { background: transparent; color: var(--comp-btn-ter-color); }
    .live-btn--danger    { background: #FF4D3A; color: #fff; }

    .live-btn--disabled { opacity: 0.5; pointer-events: none; }
    .live-btn--loading  { opacity: 0.8; }

    .live-btn .btn-icon { width: 20px; height: 20px; flex-shrink: 0; }

    .button-stack {
      display: flex;
      gap: 12px;
    }
    .button-stack--vertical {
      flex-direction: column;
      width: 343px;
    }
    .button-stack--vertical .button-stack__btn {
      width: 100%;
    }
    .button-stack--horizontal {
      flex-direction: row;
      width: 288px;
    }
    .button-stack--horizontal .button-stack__btn {
      width: 88px;
      flex: 0 0 88px;
    }
    .button-stack--horizontal.button-stack--count-1 .button-stack__btn {
      width: 88px;
    }
    .button-stack__btn {
      cursor: default;
      opacity: 1;
      transform: translateY(0);
      max-height: 48px;
      transition: opacity 0.22s ease-out, transform 0.22s ease-out, max-height 0.22s ease-out;
    }

    .button-stack__btn--hidden {
      opacity: 0;
      transform: translateY(-4px);
      max-height: 0;
      pointer-events: none;
    }

    .card-demo-doc {
      margin-top: 8px;
      padding: 24px;
      background: var(--demo-bg);
      border-radius: 24px;
      display: flex;
      justify-content: center;
    }

    .card-demo {
      width: 343px;
      min-width: 220px;
      min-height: 160px;
      border-radius: 16px;
      padding: 16px;
      background: var(--bg-card);
      border: none;
      box-shadow: none;
      transition: transform 0.22s ease-out, background 0.22s ease-out;
    }

    .card-demo--pressed {
      transform: translateY(2px);
    }

    .card-demo-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--text-primary);
    }

    .card-demo-text {
      font-size: 14px;
      color: var(--text-secondary);
    }

    .card-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 343px;
    }

    .card-stack--horizontal {
      flex-direction: row;
    }

    .card-stack__card {
      border-radius: 16px;
      padding: 16px;
      background: var(--bg-card);
      border: none;
      box-shadow: none;
      transition: opacity 0.22s ease-out, transform 0.22s ease-out, max-height 0.22s ease-out;
      min-width: 220px;
      min-height: 160px;
      opacity: 1;
      transform: translateY(0);
      max-height: 80px;
    }

    .card-stack__card--hidden {
      opacity: 0;
      transform: translateY(-6px);
      max-height: 0;
      min-height: 0;
      pointer-events: none;
    }

    .checkbox-demo-doc {
      margin-top: 8px;
      padding: 24px;
      background: var(--demo-bg);
      border-radius: 24px;
      display: flex;
      justify-content: center;
    }

    .checkbox-demo {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
      font-size: 14px;
      color: var(--text-primary);
      transition: opacity 0.2s ease-out, transform 0.2s ease-out;
    }

    .checkbox-demo--disabled {
      opacity: 0.5;
      cursor: default;
    }

    .checkbox-demo-box {
      position: relative;
      width: 20px;
      height: 20px;
      border-radius: 6px;
      border: 1.5px solid var(--spec-border);
      background: var(--bg-card);
      box-sizing: border-box;
      transition: background 0.2s ease-out, border-color 0.2s ease-out;
    }

    .checkbox-demo-check {
      position: absolute;
      inset: 2px 3px;
      opacity: 0;
      transform: scale(0.9);
      transform-origin: center;
      transition: opacity 0.18s ease-out, transform 0.18s ease-out;
      color: #ffffff;
      font-size: 14px;
      line-height: 1;
    }

    .checkbox-demo--checked .checkbox-demo-box {
      background: #0DC267;
      border-color: #0DC267;
    }

    .checkbox-demo--checked .checkbox-demo-check {
      opacity: 1;
      transform: scale(1);
    }

    .date-input-demo-doc {
      margin-top: 8px;
      padding: 24px;
      background: var(--demo-bg);
      border-radius: 24px;
      display: flex;
      justify-content: center;
    }

    .date-input-demo {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--bg-card);
      border: none;
      min-width: 220px;
      min-height: 40px;
      box-sizing: border-box;
      transition: box-shadow 0.18s ease-out, border-color 0.18s ease-out, background 0.18s ease-out, transform 0.18s ease-out;
    }

    .date-input-demo-field {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 10px;
      background: var(--variant-bg);
      border: 1px solid var(--spec-border);
      box-sizing: border-box;
      transition: border-color 0.18s ease-out, box-shadow 0.18s ease-out, background 0.18s ease-out;
    }

    .date-input-demo-label {
      font-size: 12px;
      color: var(--text-muted);
    }

    .date-input-demo-value {
      font-size: 14px;
      color: var(--text-primary);
    }

    .date-input-demo-icon {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: var(--spec-border);
      flex-shrink: 0;
    }

    .date-input-demo--focused .date-input-demo-field {
      border-color: #0DC267;
      box-shadow: 0 0 0 1px rgba(13, 194, 103, 0.5);
    }

    .date-input-demo--error .date-input-demo-field {
      border-color: #FF4D3A;
      box-shadow: 0 0 0 1px rgba(255, 77, 58, 0.5);
    }

    .date-input-demo--disabled {
      opacity: 0.5;
    }
  </style>
</head>
<body>
  <div class="app-body">
  <div class="sidebar-card">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <img src="logo-dark.svg" alt="Invert" class="sidebar-brand-img" id="sidebar-logo">
    </div>
    <h2>О проекте</h2>
    <ul class="nav-group">
      <li><a class="nav-link" href="#section-intro">О чём этот сайт</a></li>
    </ul>

    <h2>Colors</h2>
    <ul class="nav-group">
      <li><a class="nav-link" href="#section-palette">Palette page</a></li>
      <li><a class="nav-link" href="#section-base-colors">Base palette</a></li>
      <li><a class="nav-link" href="#section-semantic-colors">Semantic colors</a></li>
    </ul>

    <h2>Radius &amp; Spacing</h2>
    <ul class="nav-group">
      <li><a class="nav-link" href="#section-radius-spacing">Радиусы, отступы</a></li>
    </ul>

    <h2>Typography</h2>
    <ul class="nav-group">
      <li><a class="nav-link" href="#section-typography-page">Typography page</a></li>
      <li><a class="nav-link" href="#section-typography-presets">Presets</a></li>
      <li><a class="nav-link" href="#section-typography-android">Android</a></li>
      <li><a class="nav-link" href="#section-typography-ios">iOS</a></li>
    </ul>

    <h2>Components</h2>
    <ul class="nav-group">
      <li><a class="nav-link" href="#section-accordion">Accordion</a></li>
      <li><a class="nav-link" href="#section-bottomsheet">Bottom Sheet</a></li>
      <li><a class="nav-link" href="#section-actionbar">Action bar</a></li>
      <li><a class="nav-link" href="#section-snackbar">Snackbar</a></li>
      <li><a class="nav-link" href="#section-avatar">Avatar</a></li>
      <li><a class="nav-link" href="#section-button">Button</a></li>
      <li><a class="nav-link" href="#section-button-stack">Button Stack</a></li>
      <li><a class="nav-link" href="#section-card">Card</a></li>
      <li><a class="nav-link" href="#section-card-stack">Card Stack</a></li>
      <li><a class="nav-link" href="#section-checkbox">Checkbox</a></li>
      <li><a class="nav-link" href="#section-date-input">Date input</a></li>
    </ul>
  </aside>
  </div>

  <main class="content" id="main-content">
    <div class="content-top-bar">
      <div class="search-wrap">
        <input type="search" class="search-input" id="storybook-search" placeholder="Поиск по названиям разделов…" autocomplete="off" aria-label="Поиск по названиям разделов">
      </div>
      <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Переключить тему">
        <svg class="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        <svg class="theme-icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <span class="theme-label" id="theme-label">Тёмная</span>
      </button>
    </div>
    <div class="content-scroll">
    <div class="intro-block" id="section-intro">
      <h2>О чём этот сайт</h2>
      <p>
        Это документация дизайн‑системы Invert в виде мини‑сторибука:
        один сайт, где собраны основы (цвета, типографика, отступы, радиусы) и компоненты интерфейса
        с примерами и точными характеристиками.
      </p>
      <p><strong>Зачем он нужен</strong></p>
      <ul>
        <li>Единый референс для дизайнеров и разработчиков: как выглядят токены и компоненты, какие у них размеры, цвета и стили.</li>
        <li>Быстрая проверка: открыл раздел — увидел палитру, типографику или кнопки без необходимости лезть в Figma.</li>
        <li>Основа для внедрения: все значения (HEX, радиусы, отступы, шрифты) можно брать отсюда при вёрстке и в коде.</li>
      </ul>
      <p><strong>Как устроен сайт</strong></p>
      <p>
        В боковом меню — разделы по категориям. <strong>Colors</strong>: базовая палитра и семантические цвета (Day/Night).
        <strong>Radius &amp; Spacing</strong>: токены скруглений и отступов. <strong>Typography</strong>: пресеты (h1, body, caption и др.)
        и платформенные токены (Android, iOS). <strong>Components</strong>: Accordion, Bottom Sheet, Snackbar и варианты action bar —
        у каждого блока есть живой пример и таблица характеристик (размеры, цвета, шрифты).
      </p>
      <p>
        Используйте разделы как справочник: выбирайте нужный пункт в меню и ориентируйтесь на примеры и спецификации для переноса дизайна в продукт 1:1.
      </p>
      <div class="intro-links">
        <div class="intro-links-title">Полезные ссылки</div>
        <a class="intro-link-btn" href="https://www.figma.com/design/aHT592FnfHz2cuSqO9a0iU/Invert-Design-System?node-id=15-18522&t=44Y7IOurrTozRDwU-1" target="_blank" rel="noopener noreferrer">Флоу</a>
        <a class="intro-link-btn" href="https://www.figma.com/design/aHT592FnfHz2cuSqO9a0iU/Invert-Design-System" target="_blank" rel="noopener noreferrer">Дизайн‑система</a>
        <a class="intro-link-btn" href="https://www.figma.com/design/Cf7LVRyjgftxuUtH4XkIXW/Phosphor-Icons--Community---Copy-?m=auto&t=p4u24k5Lbizre1Uo-6" target="_blank" rel="noopener noreferrer">Иконки</a>
      </div>
    </div>
    <section id="section-palette">
      <h2>Palette page (из Colors)</h2>
      <p class="note">
        <strong>Что это:</strong> Визуальная палитра цветов дизайн‑системы, разбитая по семействам (серый, зелёный, красный и т.д.).<br>
        <strong>Зачем:</strong> Быстро подобрать оттенок и использовать один и тот же цвет в макетах и коде.<br>
        <strong>Как использовать:</strong> Выбери семейство, найди нужную карточку — название токена и HEX можно копировать в стили и переменные.
      </p>
`;

for (const [group, entries] of baseColorGroups.entries()) {
  // внутри группы сортируем по числовому уровню после первого слэша, чтобы получить градиент
  const sorted = [...entries].sort(([pathA], [pathB]) => {
    const [, levelA = ""] = pathA.split("/");
    const [, levelB = ""] = pathB.split("/");
    const nA = Number(levelA.replace(/\D/g, ""));
    const nB = Number(levelB.replace(/\D/g, ""));
    if (!Number.isNaN(nA) && !Number.isNaN(nB) && nA !== nB) return nA - nB;
    return pathA.localeCompare(pathB);
  });

  html += `
      <h3>${escapeHtml(group)}</h3>
      <div class="palette-row">
`;
  for (const [tokenPath, token] of sorted) {
    const hex = typeof token.value === "object" && token.value.hex ? token.value.hex : "";
    const segments = tokenPath.split("/");
    const shortName = segments.slice(1).join("/") || tokenPath;
    const textClass = isLightHex(hex) ? "color-card--light" : "color-card--dark";
    const hexDisplay = (hex || "").replace(/^#/, "");
    html += `
        <div class="color-card ${textClass}" style="background:${escapeHtml(hex ? "#" + hex.replace(/^#/, "") : "#ffffff")};">
          <span class="color-card-name">${escapeHtml(shortName)}</span>
          <span class="color-card-hex">${escapeHtml(hexDisplay || "—")}</span>
        </div>
`;
  }
  html += `
      </div>
`;
}

html += `
    </section>

    <section id="section-base-colors">
      <h2>Base palette (из Mode 1.tokens.json)</h2>
      <p class="note">
        <strong>Что это:</strong> Справочная таблица всех базовых цветовых токенов с путём, HEX и алиасами.<br>
        <strong>Зачем:</strong> Точно знать значение каждого токена при вёрстке, в переменных CSS или в коде.<br>
        <strong>Как использовать:</strong> Найди токен по пути (например gray/50), возьми HEX или alias для подстановки в стили.
      </p>
`;

for (const [group, entries] of baseColorGroups.entries()) {
  html += `
      <h3>${escapeHtml(group)}</h3>
      <table>
        <thead>
          <tr>
            <th>Путь токена</th>
            <th>Цвет</th>
            <th>HEX</th>
            <th>Alias</th>
          </tr>
        </thead>
        <tbody>
`;
  for (const [tokenPath, token] of entries) {
    const hex = typeof token.value === "object" && token.value.hex ? token.value.hex : "";
    html += `
          <tr>
            <td class="token-name">${escapeHtml(tokenPath)}</td>
            <td><div class="swatch" style="background:${escapeHtml(hex || "#ffffff")};"></div></td>
            <td class="code">${escapeHtml(hex || "")}</td>
            <td class="code">${escapeHtml(token.alias || "—")}</td>
          </tr>
`;
  }
  html += `
        </tbody>
      </table>
`;
}

html += `
    </section>

    <section id="section-semantic-colors">
      <h2>Semantic colors (Day &amp; Night)</h2>
      <p class="note">
        <strong>Что это:</strong> Цвета по смыслу (текст, фон, границы, акцент) для светлой (Day) и тёмной (Night) темы.<br>
        <strong>Зачем:</strong> Один интерфейс корректно выглядит и днём, и ночью — подставляется нужный HEX по теме.<br>
        <strong>Как использовать:</strong> В коде используй семантический токен (например text/primary), а не конкретный HEX — значение подставится из темы.
      </p>
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

for (const tokenPath of semanticPaths) {
  const day = semanticDayColors[tokenPath] || {};
  const night = semanticNightColors[tokenPath] || {};
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

    <section id="section-radius-spacing">
      <h2>Radius &amp; Spacing</h2>
      <p class="note">
        <strong>Что это:</strong> Токены скруглений углов и отступов (padding, gap, spacing) в одном месте.<br>
        <strong>Зачем:</strong> Одинаковые радиусы и отступы во всех компонентах — интерфейс выглядит едино и предсказуемо.<br>
        <strong>Как использовать:</strong> Бери значение из таблицы для кнопок, карточек, полей ввода и отступов между элементами.
      </p>
`;

for (const [group, entries] of radiusSpacingGroups.entries()) {
  html += `
      <h3>${escapeHtml(group)}</h3>
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
  for (const [tokenPath, token] of entries) {
    html += `
          <tr>
            <td class="token-name">${escapeHtml(tokenPath)}</td>
            <td class="code">${escapeHtml(token.type || "")}</td>
            <td class="code">${escapeHtml(normalizeValue(token.value))}</td>
            <td class="code">${escapeHtml(token.alias || "—")}</td>
            <td class="code">${escapeHtml(token.description || "—")}</td>
          </tr>
`;
  }
  html += `
        </tbody>
      </table>
`;
}

html += `
    </section>

    <section id="section-typography-presets">
      <h2>Typography presets</h2>
      <p class="note">
        <strong>Что это:</strong> Набор текстовых стилей: заголовки (h1, h2, h3), основной текст, подписи, лейблы кнопок.<br>
        <strong>Зачем:</strong> Одна и та же типографика во всём продукте — размер, межстрочный интервал и насыщенность заданы токенами.<br>
        <strong>Как использовать:</strong> Выбери пресет по роли (заголовок, тело текста, подпись) и применяй его размер, line-height и weight из таблицы.
      </p>
`;

for (const [group, entries] of typoPresetGroups.entries()) {
  html += `
      <h3>${escapeHtml(group)}</h3>
      <table>
        <thead>
          <tr>
            <th>Путь токена</th>
            <th>Тип</th>
            <th>Значение</th>
            <th>Alias</th>
          </tr>
        </thead>
        <tbody>
`;
  for (const [tokenPath, token] of entries) {
    html += `
          <tr>
            <td class="token-name">${escapeHtml(tokenPath)}</td>
            <td class="code">${escapeHtml(token.type || "")}</td>
            <td class="code">${escapeHtml(normalizeValue(token.value))}</td>
            <td class="code">${escapeHtml(token.alias || "—")}</td>
          </tr>
`;
  }
  html += `
        </tbody>
      </table>
`;
}

html += `
    </section>

    <section id="section-typography-page">
      <h2>Typography page</h2>
      <p class="note">
        <strong>Что это:</strong> Образцы того, как выглядят заголовки, основной текст и подписи в интерфейсе.<br>
        <strong>Зачем:</strong> Увидеть живой результат стиля перед тем как применять его в макете или коде.<br>
        <strong>Как использовать:</strong> Сравни образцы между собой, выбери нужный пресет и используй его параметры (указаны под каждым блоком) в стилях.
      </p>
      <div class="type-specimens-grid">
`;

for (const [name, model] of Array.from(typographySpecimens.entries()).sort(([a], [b]) => a.localeCompare(b))) {
  const size = model.size || 16;
  const lineHeight = model.lineHeight || size * 1.3;
  const weight = model.weight || 400;
  const sampleText =
    name === "h1" ? "Заголовок H1 — Invert Design System" :
    name === "h2" ? "Заголовок H2 — раздел" :
    name === "h3" ? "Заголовок H3 — подсекция" :
    name === "body" ? "Основной текст. Используется для контента и описаний." :
    name === "label" ? "Метка поля ввода" :
    name === "caption" ? "Подпись или вспомогательный текст" :
    name === "button" ? "Текст кнопки" :
    `Пример текста для ${name}`;

  html += `
        <div class="type-specimen" style="font-size:${size}px; line-height:${lineHeight}px; font-weight:${weight};">
          <div class="type-specimen-label">${escapeHtml(name)}</div>
          <div>${escapeHtml(sampleText)}</div>
          <div class="type-specimen-meta">
            size: ${escapeHtml(String(size))}px · line-height: ${escapeHtml(String(lineHeight))}px · weight: ${escapeHtml(String(weight))}
          </div>
        </div>
`;
}

html += `
      </div>
    </section>
`;

function renderTypographyPlatformSection(id, title, noteHtml, groups) {
  let sectionHtml = `
    <section id="${escapeHtml(id)}">
      <h2>${escapeHtml(title)}</h2>
      <p class="note">${noteHtml}</p>
`;

  for (const [group, entries] of groups.entries()) {
    sectionHtml += `
      <h3>${escapeHtml(group)}</h3>
      <table>
        <thead>
          <tr>
            <th>Путь токена</th>
            <th>Тип</th>
            <th>Значение</th>
            <th>Alias</th>
          </tr>
        </thead>
        <tbody>
`;
    for (const [tokenPath, token] of entries) {
      sectionHtml += `
          <tr>
            <td class="token-name">${escapeHtml(tokenPath)}</td>
            <td class="code">${escapeHtml(token.type || "")}</td>
            <td class="code">${escapeHtml(normalizeValue(token.value))}</td>
            <td class="code">${escapeHtml(token.alias || "—")}</td>
          </tr>
`;
    }
    sectionHtml += `
        </tbody>
      </table>
`;
  }

  sectionHtml += `
    </section>
`;

  return sectionHtml;
}

html += renderTypographyPlatformSection(
  "section-typography-android",
  "Typography — Android",
  "<strong>Что это:</strong> Токены шрифтов и размеров для приложений на Android.<br><strong>Зачем:</strong> Одинаковая типографика в вебе и в нативном Android.<br><strong>Как использовать:</strong> Подставляй значения из таблицы в стили или в код мобильного приложения.",
  typoAndroidGroups
);

html += renderTypographyPlatformSection(
  "section-typography-ios",
  "Typography — iOS",
  "<strong>Что это:</strong> Токены шрифтов и размеров для приложений на iOS.<br><strong>Зачем:</strong> Одинаковая типографика в вебе и в нативном iOS.<br><strong>Как использовать:</strong> Подставляй значения из таблицы в стили или в код мобильного приложения.",
  typoIOSGroups
);

html += `
    <section id="section-accordion">
      <h2>Accordion</h2>
      <p class="note">
        <strong>Что это:</strong> Раскрывающийся блок: заголовок всегда виден, контент показывается по клику.<br>
        <strong>Зачем:</strong> Компактно дать доступ к дополнительной информации (FAQ, пояснения) без захламления экрана.<br>
        <strong>Как использовать:</strong> Клик по заголовку открывает или закрывает блок контента под ним.
      </p>
      <div class="accordion-doc">
        <div class="accordion-card" data-open="false">
          <div class="accordion-header">
            <div class="accordion-title">Title</div>
            <div class="accordion-icon">
              <div class="accordion-icon-inner">
                <img class="accordion-icon-img" src="../chevron-down.svg" alt="Chevron down">
              </div>
            </div>
          </div>
          <div class="accordion-content"></div>
        </div>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Спецификация для переноса в код: размеры, цвета, шрифты — используй значения из таблицы для вёрстки 1:1.</p>
        <table class="spec-table">
          <thead><tr><th>Элемент</th><th>Свойство</th><th>Значение</th></tr></thead>
          <tbody>
            <tr><td rowspan="5">.accordion-card</td><td>Ширина</td><td>442px</td></tr>
            <tr><td>Высота (закрыт)</td><td>56px</td></tr>
            <tr><td>Высота (открыт)</td><td>200px</td></tr>
            <tr><td>Padding</td><td>16px</td></tr>
            <tr><td>Фон / радиус</td><td>#FFFFFF / 16px</td></tr>
            <tr><td>.accordion-header</td><td>Layout</td><td>flex, space-between, gap 16px</td></tr>
            <tr><td rowspan="4">.accordion-title</td><td>Шрифт</td><td>SF Pro Display, 600</td></tr>
            <tr><td>Размер / line-height</td><td>16px / 22px</td></tr>
            <tr><td>Цвет</td><td>#111111</td></tr>
            <tr><td>Текст</td><td>ellipsis при переполнении</td></tr>
            <tr><td>.accordion-icon</td><td>Размер контейнера / SVG</td><td>24×24px / 16×16px</td></tr>
            <tr><td>.accordion-content</td><td>Высота / фон / рамка</td><td>128px / #E0F6E5 / 1px dashed #0DC267</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section id="section-bottomsheet">
      <div class="section-heading-row">
        <h2>Bottom Sheet</h2>
        <span class="section-tag-wrap">
          <span class="section-tag-popover">Переход в Apple Human Design</span>
          <a href="https://developer.apple.com/design/human-interface-guidelines/sheets" class="section-tag section-tag--link" target="_blank" rel="noopener noreferrer">Liquid Glass IOS 26</a>
        </span>
      </div>
      <p class="note">
        <strong>Что это:</strong> Выезжающая снизу панель поверх экрана с заголовком, контентом и кнопками.<br>
        <strong>Зачем:</strong> Показать действия или форму, не уходя со страницы — контекст остаётся видимым.<br>
        <strong>Как использовать:</strong> Выбери вариант в селекте — ниже отобразится соответствующий вид.
      </p>
      <div class="variant-controls">
        <div class="variant-row">
          <label for="bottomsheet-variant">variant</label>
          <select id="bottomsheet-variant">
            <option value="compact">compact</option>
            <option value="full">full</option>
          </select>
        </div>
      </div>
      <div class="bottomsheet-doc">
        <div class="bottomsheet-phone" id="bottomsheet-live">
          <div class="bottomsheet-shell" id="bottomsheet-live-shell">
            <div class="bottomsheet-header">
              <div class="bottomsheet-grabber"></div>
              <div class="bottomsheet-toolbar">
                <div class="bottomsheet-circle-btn bottomsheet-circle-btn--left">
                  <img src="http://localhost:3845/assets/0af1d11c0c71363dd04c300e51ee6f47065544c7.svg" alt="Close">
                </div>
                <div class="bottomsheet-title">Title</div>
                <div class="bottomsheet-circle-btn bottomsheet-circle-btn--right">
                  <img src="http://localhost:3845/assets/de0d4708e289116553c32f0e2b61b64baf017f4b.svg" alt="Acorn">
                </div>
              </div>
            </div>
            <div class="bottomsheet-body" id="bottomsheet-live-body" style="height: 387px;">
              <div class="bottomsheet-swapper"></div>
              <div class="bottomsheet-actions">
                <div class="bottomsheet-btn bottomsheet-btn--primary">Button</div>
                <div class="bottomsheet-btn bottomsheet-btn--secondary">Button</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Спецификация для переноса в код: размеры, цвета, шрифты — используй значения из таблицы для вёрстки 1:1.</p>
        <table class="spec-table">
          <thead><tr><th>Элемент</th><th>Свойство</th><th>Значение</th></tr></thead>
          <tbody>
            <tr><td>.bottomsheet-phone</td><td>Размер / фон</td><td>375×812px / #F5F5F5</td></tr>
            <tr><td>.bottomsheet-shell</td><td>Фон / радиус / тень</td><td>#FFFFFF / 38px 38px 0 0 / 0 15px 75px rgba(0,0,0,0.18)</td></tr>
            <tr><td>.bottomsheet-header</td><td>Padding / gap</td><td>5px 16px 10px / 5px</td></tr>
            <tr><td>.bottomsheet-grabber</td><td>Размер / цвет / радиус</td><td>36×5px / #5E5E5E / 100px</td></tr>
            <tr><td>.bottomsheet-circle-btn</td><td>Размер / радиус</td><td>44×44px / 296px</td></tr>
            <tr><td>.bottomsheet-circle-btn--left</td><td>Фон</td><td>#F3F4F6</td></tr>
            <tr><td>.bottomsheet-circle-btn--right</td><td>Фон</td><td>#0DC267</td></tr>
            <tr><td>.bottomsheet-title</td><td>Шрифт / размер / цвет</td><td>SF Pro Display 600 / 16px, 22px / #111111</td></tr>
            <tr><td>.bottomsheet-body</td><td>Padding / gap</td><td>16px / 16px</td></tr>
            <tr><td>.bottomsheet-swapper</td><td>Ширина / фон / радиус / рамка</td><td>343px / #E0F6E5 / 16px / 1px dashed #0DC267</td></tr>
            <tr><td>.bottomsheet-actions</td><td>Ширина / gap</td><td>343px / 12px</td></tr>
            <tr><td>.bottomsheet-btn</td><td>Высота / радиус / шрифт</td><td>52px / 12px / SF Pro Display 500, 16px, 22px</td></tr>
            <tr><td>.bottomsheet-btn--primary</td><td>Фон / текст</td><td>#0DC267 / #FFFFFF</td></tr>
            <tr><td>.bottomsheet-btn--secondary</td><td>Фон / текст</td><td>#E0F6E5 / #0EA658</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section id="section-actionbar">
      <h2>Action bar</h2>
      <p class="note">
        <strong>Что это:</strong> Блок из одной–трёх кнопок под областью контента, при необходимости с полоской home indicator.<br>
        <strong>Зачем:</strong> Единый паттерн главных действий на экране (подтвердить, отменить, вторичное действие).<br>
        <strong>Как использовать:</strong> Выбери вариант в селектах — ниже отобразится соответствующий action bar.
      </p>
      <div class="variant-controls">
        <div class="variant-row">
          <label for="actionbar-buttons">buttons</label>
          <select id="actionbar-buttons">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="actionbar-content">content</label>
          <select id="actionbar-content">
            <option value="no">no</option>
            <option value="yes">yes</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="actionbar-home">home indicator</label>
          <select id="actionbar-home">
            <option value="no" selected>no</option>
            <option value="yes">yes</option>
          </select>
        </div>
      </div>
      <div class="actionbar-doc">
        <div class="actionbar-card actionbar-card--live" id="actionbar-live-card">
          <div class="actionbar-swapper-wrap actionbar-collapse actionbar--hidden" id="actionbar-swapper-wrap">
            <div class="actionbar-swapper"></div>
          </div>
          <div class="actionbar-bar">
            <div class="actionbar-buttons">
              <div class="actionbar-btn-item">
                <div class="actionbar-btn actionbar-btn--primary">Button</div>
              </div>
              <div class="actionbar-btn-item actionbar-collapse actionbar--hidden" id="actionbar-btn-2">
                <div class="actionbar-btn actionbar-btn--secondary">Button</div>
              </div>
              <div class="actionbar-btn-item actionbar-collapse actionbar--hidden" id="actionbar-btn-3">
                <div class="actionbar-btn actionbar-btn--tertiary">Button</div>
              </div>
            </div>
            <div class="actionbar-home-collapse actionbar-collapse actionbar--hidden" id="actionbar-home-wrap">
              <div class="actionbar-home-wrap">
                <div class="actionbar-home-indicator"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="section-snackbar">
      <h2>Snackbar</h2>
      <p class="note">
        <strong>Что это:</strong> Короткое уведомление о результате действия (успех, ошибка или нейтральное сообщение).<br>
        <strong>Зачем:</strong> Дать пользователю обратную связь без модального окна — можно продолжать работать с интерфейсом.<br>
        <strong>Как использовать:</strong> Выбери тип в селекте — ниже отобразится соответствующий снэкбар.
      </p>
      <div class="variant-controls">
        <div class="variant-row variant-row--full">
          <label for="snackbar-text">Текст</label>
          <input type="text" class="variant-text-input" id="snackbar-text" placeholder="Нейтральное" aria-label="Текст снэкбара">
        </div>
        <div class="variant-row">
          <label for="snackbar-type">type</label>
          <select id="snackbar-type">
            <option value="success">success</option>
            <option value="danger">danger</option>
            <option value="default" selected>default</option>
          </select>
        </div>
      </div>
      <div class="snackbar-doc">
        <div class="snackbar snackbar--default" id="snackbar-live">Нейтральное</div>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Спецификация для переноса в код: размеры, цвета, шрифты — используй значения из таблицы для вёрстки 1:1.</p>
        <table class="spec-table">
          <thead><tr><th>Элемент</th><th>Свойство</th><th>Значение</th></tr></thead>
          <tbody>
            <tr><td>.snackbar-doc</td><td>Фон / радиус / padding / gap</td><td>#262626 / 16px / 20px / 12px</td></tr>
            <tr><td>.snackbar</td><td>Радиус / padding / шрифт</td><td>56px / 10px 12px / SF Pro Display 500, 12px, 16px</td></tr>
            <tr><td>.snackbar</td><td>Рамка</td><td>1px solid (по варианту)</td></tr>
            <tr><td>.snackbar--success</td><td>Фон / border / текст</td><td>#0DC267 / #10B55F / #FFFFFF</td></tr>
            <tr><td>.snackbar--danger</td><td>Фон / border / текст</td><td>#FF4D3A / #FE725F / #FFFFFF</td></tr>
            <tr><td>.snackbar--default</td><td>Фон / border / текст</td><td>#F5F5F5 / #E2E2E2 / #111111</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section id="section-avatar">
      <h2>Avatar</h2>
      <p class="note">
        <strong>Что это:</strong> Элемент для отображения пользователя: инициалы, фото, иконка или плейсхолдер; круг или скруглённый квадрат.<br>
        <strong>Зачем:</strong> Узнаваемое представление пользователя в списках, шапке, комментариях; единый вид по размерам и формам.<br>
        <strong>Как использовать:</strong> Выбери вариант в селектах — ниже отобразится соответствующий аватар.
      </p>
      <div class="variant-controls">
        <div class="variant-row">
          <label for="avatar-size">size</label>
          <select id="avatar-size">
            <option value="24">24</option>
            <option value="40">40</option>
            <option value="48" selected>48</option>
            <option value="96">96</option>
            <option value="208">208</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="avatar-shape">shape</label>
          <select id="avatar-shape">
            <option value="circle" selected>circle</option>
            <option value="square">square</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="avatar-mode">mode</label>
          <select id="avatar-mode">
            <option value="placeholder">placeholder</option>
            <option value="letters" selected>letters</option>
            <option value="image">image</option>
            <option value="icon">icon</option>
          </select>
        </div>
      </div>
      <div class="avatar-doc">
        <div class="avatar-live-wrap">
          <div class="avatar avatar--circle avatar--48 avatar--letters" id="avatar-live">БЯ</div>
        </div>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Спецификация по макету Figma (node 85:425): размеры, формы, режимы.</p>
        <table class="spec-table">
          <thead><tr><th>Параметр</th><th>Значения</th></tr></thead>
          <tbody>
            <tr><td>Размеры</td><td>16, 24, 40, 48, 96, 208 px</td></tr>
            <tr><td>Форма</td><td>circle (employer), square (applicant)</td></tr>
            <tr><td>Режим</td><td>placeholder, letters, image, icon</td></tr>
            <tr><td>Состояние</td><td>default (+ опционально status indicator)</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section id="section-button">
      <h2>Button</h2>
      <p class="note">
        <strong>Что это:</strong> Кнопка с вариантами типа (primary, danger, secondary, tertiary), размера и состояния.<br>
        <strong>Зачем:</strong> Единый стиль действий; выбор типа и размера под контекст экрана.<br>
        <strong>Как использовать:</strong> Выбери вариант в селектах выше — ниже отобразится соответствующая кнопка.
      </p>
      <div class="variant-controls">
        <div class="variant-row variant-row--full">
          <label for="btn-text">Текст</label>
          <input type="text" class="variant-text-input" id="btn-text" placeholder="Button" aria-label="Текст кнопки">
        </div>
        <div class="variant-row">
          <label for="btn-type">type</label>
          <select id="btn-type">
            <option value="primary">primary</option>
            <option value="danger" selected>danger</option>
            <option value="secondary">secondary</option>
            <option value="tertiary">tertiary</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="btn-state">state</label>
          <select id="btn-state">
            <option value="default" selected>default</option>
            <option value="hover">hover</option>
            <option value="pressed">pressed</option>
            <option value="disabled">disabled</option>
            <option value="loading">loading</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="btn-icon">icon</label>
          <select id="btn-icon">
            <option value="no" selected>no</option>
            <option value="yes">yes</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="btn-size">size</label>
          <select id="btn-size">
            <option value="xs">xs</option>
            <option value="s" selected>s</option>
            <option value="m">m</option>
            <option value="l">l</option>
          </select>
        </div>
      </div>
      <div class="btn-doc">
        <button type="button" id="live-button" class="live-btn live-btn--danger live-btn--s">Button</button>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Варианты кнопки по макету Figma (node 15:13751): type, state, icon, size.</p>
        <table class="spec-table">
          <thead><tr><th>Параметр</th><th>Значения</th></tr></thead>
          <tbody>
            <tr><td>type</td><td>primary, danger, secondary, tertiary</td></tr>
            <tr><td>state</td><td>default, hover, pressed, disabled, loading</td></tr>
            <tr><td>icon</td><td>yes, no</td></tr>
            <tr><td>size</td><td>xs, s, m, l</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section id="section-button-stack">
      <h2>Button Stack</h2>
      <p class="note">
        <strong>Что это:</strong> Группа из одной, двух или трёх кнопок в вертикальном или горизонтальном расположении.<br>
        <strong>Зачем:</strong> Компактно объединить связанные действия (подтвердить/отмена, несколько вариантов выбора).<br>
        <strong>Как использовать:</strong> Выбери количество кнопок, направление (vertical/horizontal) и flip — ниже отобразится соответствующий вариант.
      </p>
      <div class="variant-controls">
        <div class="variant-row">
          <label for="buttonstack-count">count</label>
          <select id="buttonstack-count">
            <option value="1">1</option>
            <option value="2" selected>2</option>
            <option value="3">3</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="buttonstack-type">type</label>
          <select id="buttonstack-type">
            <option value="vertical" selected>vertical</option>
            <option value="horizontal">horizontal</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="buttonstack-flip">flip</label>
          <select id="buttonstack-flip">
            <option value="no" selected>no</option>
            <option value="yes">yes</option>
          </select>
        </div>
      </div>
      <div class="btn-doc">
        <div class="button-stack" id="buttonstack-live">
          <button type="button" class="live-btn live-btn--primary live-btn--s button-stack__btn">Button</button>
          <button type="button" class="live-btn live-btn--secondary live-btn--s button-stack__btn">Button</button>
          <button type="button" class="live-btn live-btn--tertiary live-btn--s button-stack__btn">Button</button>
        </div>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Группа кнопок по макету Figma (node 68:2794): count, type, flip.</p>
        <table class="spec-table">
          <thead><tr><th>Параметр</th><th>Значения</th></tr></thead>
          <tbody>
            <tr><td>count</td><td>1, 2, 3</td></tr>
            <tr><td>type</td><td>vertical (343px), horizontal (288px)</td></tr>
            <tr><td>flip</td><td>no / yes (меняет порядок primary/secondary)</td></tr>
            <tr><td>gap</td><td>12px</td></tr>
            <tr><td>Кнопки</td><td>size s, padding 16px 12px, radius 12px</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section id="section-card">
      <h2>Card</h2>
      <p class="note">
        <strong>Что это:</strong> Карточка с заголовком и текстом на отдельной поверхности.<br>
        <strong>Зачем:</strong> Визуально объединять связанные блоки контента на фоне страницы.<br>
        <strong>Как использовать:</strong> Выбери состояние — ниже отобразится соответствующая карточка.
      </p>
      <div class="variant-controls">
        <div class="variant-row">
          <label for="card-state">state</label>
          <select id="card-state">
            <option value="default" selected>default</option>
            <option value="pressed">pressed</option>
          </select>
        </div>
      </div>
      <div class="card-demo-doc">
        <div class="card-demo card-demo--elevated" id="card-demo">
          <div class="card-demo-title">Заголовок карточки</div>
          <div class="card-demo-text">Краткое описание или вспомогательный текст внутри карточки.</div>
        </div>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Карточка со стандартной поверхностью и разными состояниями.</p>
        <table class="spec-table">
          <thead><tr><th>Параметр</th><th>Значения</th></tr></thead>
          <tbody>
            <tr><td>state</td><td>default, pressed</td></tr>
            <tr><td>Радиус</td><td>24px</td></tr>
            <tr><td>Отступы</td><td>20px сверху/снизу, 24px по бокам</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section id="section-card-stack">
      <h2>Card Stack</h2>
      <p class="note">
        <strong>Что это:</strong> Набор из нескольких карточек в колонке или строке.<br>
        <strong>Зачем:</strong> Показывать несколько однородных элементов (например, шаги, варианты тарифов) в одном блоке.<br>
        <strong>Как использовать:</strong> Выбери количество карточек и ориентацию — ниже отобразится соответствующий стек.
      </p>
      <div class="variant-controls">
        <div class="variant-row">
          <label for="cardstack-count">count</label>
          <select id="cardstack-count">
            <option value="1">1</option>
            <option value="2" selected>2</option>
            <option value="3">3</option>
          </select>
        </div>
        <div class="variant-row">
          <label for="cardstack-type">type</label>
          <select id="cardstack-type">
            <option value="vertical" selected>vertical</option>
            <option value="horizontal">horizontal</option>
          </select>
        </div>
      </div>
      <div class="card-demo-doc">
        <div class="card-stack" id="cardstack-live">
          <div class="card-stack__card">Первая карточка</div>
          <div class="card-stack__card">Вторая карточка</div>
          <div class="card-stack__card">Третья карточка</div>
        </div>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Стек карточек с плавным добавлением и убиранием элементов.</p>
        <table class="spec-table">
          <thead><tr><th>Параметр</th><th>Значения</th></tr></thead>
          <tbody>
            <tr><td>count</td><td>1, 2, 3</td></tr>
            <tr><td>type</td><td>vertical, horizontal</td></tr>
            <tr><td>gap</td><td>12px</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section id="section-checkbox">
      <h2>Checkbox</h2>
      <p class="note">
        <strong>Что это:</strong> Флажок для выбора одного или нескольких вариантов.<br>
        <strong>Зачем:</strong> Давать пользователю бинарный выбор (включено/выключено) в списках настроек и фильтров.<br>
        <strong>Как использовать:</strong> Выбери состояние во вкладке ниже — отобразится соответствующий чекбокс.
      </p>
      <div class="variant-controls">
        <div class="variant-row">
          <label for="checkbox-state">state</label>
          <select id="checkbox-state">
            <option value="unchecked" selected>unchecked</option>
            <option value="checked">checked</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
      </div>
      <div class="checkbox-demo-doc">
        <div class="checkbox-demo" id="checkbox-demo" role="checkbox" aria-checked="false" aria-disabled="false">
          <span class="checkbox-demo-box">
            <span class="checkbox-demo-check">✓</span>
          </span>
          <span class="checkbox-demo-label">Получать уведомления</span>
        </div>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Чекбокс по дизайн‑системе: размеры, радиус и состояния.</p>
        <table class="spec-table">
          <thead><tr><th>Параметр</th><th>Значения</th></tr></thead>
          <tbody>
            <tr><td>state</td><td>unchecked, checked, disabled</td></tr>
            <tr><td>Размер бокса</td><td>20×20px</td></tr>
            <tr><td>Радиус</td><td>6px</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section id="section-date-input">
      <h2>Date input</h2>
      <p class="note">
        <strong>Что это:</strong> Поле ввода даты с подписью и иконкой календаря.<br>
        <strong>Зачем:</strong> Позволить пользователю выбирать дату в формах (фильтры, бронирование, настройки).<br>
        <strong>Как использовать:</strong> Выбери состояние — ниже отобразится соответствующий вариант поля.
      </p>
      <div class="variant-controls">
        <div class="variant-row">
          <label for="date-state">state</label>
          <select id="date-state">
            <option value="default" selected>default</option>
            <option value="focused">focused</option>
            <option value="error">error</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
      </div>
      <div class="date-input-demo-doc">
        <div class="date-input-demo date-input-demo--default" id="date-demo">
          <div class="date-input-demo-field">
            <div class="date-input-demo-icon"></div>
            <div>
              <div class="date-input-demo-label">Дата</div>
              <div class="date-input-demo-value">24.05.2026</div>
            </div>
          </div>
        </div>
      </div>
      <details class="component-spec spec-accordion">
        <summary>Характеристики</summary>
        <p class="note">Поле даты с различными состояниями рамки и подсветки.</p>
        <table class="spec-table">
          <thead><tr><th>Параметр</th><th>Значения</th></tr></thead>
          <tbody>
            <tr><td>state</td><td>default, focused, error, disabled</td></tr>
            <tr><td>Радиус поля</td><td>12px (контейнер), 10px (внутреннее поле)</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    </div>
  </main>
  </div>
  <div class="copy-snackbar" id="copy-snackbar">HEX скопирован в буфер обмена</div>
  <script>
    (function () {
      var THEME_KEY = "storybook-theme";
      function getTheme() {
        try {
          var s = localStorage.getItem(THEME_KEY);
          return s === "dark" ? "dark" : "light";
        } catch (e) { return "light"; }
      }
      function setTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
        var label = document.getElementById("theme-label");
        if (label) label.textContent = theme === "dark" ? "Светлая" : "Тёмная";
        var logo = document.getElementById("sidebar-logo");
        if (logo) {
          logo.src = theme === "dark" ? "logo-dark.svg" : "logo-light.svg";
        }
      }
      document.addEventListener("DOMContentLoaded", function () {
        setTheme(getTheme());
        var btn = document.getElementById("theme-toggle");
        if (btn) {
          btn.addEventListener("click", function () {
            var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
            setTheme(next);
          });
        }
      });
    })();
    document.addEventListener("DOMContentLoaded", function () {
      var searchInput = document.getElementById("storybook-search");
      var navLinks = document.querySelectorAll(".nav-link");
      function getSectionId(href) {
        if (!href) return null;
        var match = href.match(/#(.+)/);
        return match ? match[1] : null;
      }
      function runSearch() {
        var q = (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : "";
        navLinks.forEach(function (link) {
          var title = (link.textContent || "").trim().toLowerCase();
          var sectionId = getSectionId(link.getAttribute("href"));
          var section = sectionId ? document.getElementById(sectionId) : null;
          var match = !q || title.indexOf(q) !== -1;
          var li = link.closest("li");
          if (li) li.classList.toggle("search-hidden", !match);
          if (section) section.classList.toggle("search-hidden", !match);
        });
        document.querySelectorAll(".sidebar h2").forEach(function (h2) {
          var group = h2.nextElementSibling;
          if (!group || group.tagName !== "UL") return;
          var visible = Array.from(group.querySelectorAll("li")).some(function (li) { return !li.classList.contains("search-hidden"); });
          h2.classList.toggle("search-hidden", !visible);
          group.classList.toggle("search-hidden", !visible);
        });
      }
      if (searchInput) {
        searchInput.addEventListener("input", runSearch);
        searchInput.addEventListener("keyup", runSearch);
      }

      var bottomsheetVariant = document.getElementById("bottomsheet-variant");
      var bottomsheetShell = document.getElementById("bottomsheet-live-shell");
      var bottomsheetBody = document.getElementById("bottomsheet-live-body");
      function updateBottomsheet() {
        if (!bottomsheetShell || !bottomsheetBody) return;
        var v = bottomsheetVariant && bottomsheetVariant.value === "full";
        bottomsheetShell.style.height = v ? "812px" : "451px";
        bottomsheetBody.style.height = v ? "706px" : "387px";
        var swapper = bottomsheetBody.querySelector(".bottomsheet-swapper");
        if (swapper) {
          swapper.style.flex = v ? "0 0 auto" : "";
          swapper.style.height = v ? "600px" : "";
          swapper.style.width = v ? "343px" : "";
        }
      }
      if (bottomsheetVariant) bottomsheetVariant.addEventListener("change", updateBottomsheet);
      updateBottomsheet();

      var snackbarType = document.getElementById("snackbar-type");
      var snackbarTextInput = document.getElementById("snackbar-text");
      var snackbarLive = document.getElementById("snackbar-live");
      var snackbarMessages = { success: "Что-то хорошее произошло", danger: "Что-то плохое произошло", default: "Нейтральное" };
      function updateSnackbar() {
        if (!snackbarLive) return;
        var t = snackbarType ? snackbarType.value : "default";
        if (!snackbarMessages[t]) t = "default";
        var text = (snackbarTextInput && snackbarTextInput.value.trim()) || snackbarMessages[t];
        snackbarLive.textContent = text;
        snackbarLive.className = "snackbar snackbar--" + t;
      }
      if (snackbarType) snackbarType.addEventListener("change", updateSnackbar);
      if (snackbarTextInput) snackbarTextInput.addEventListener("input", updateSnackbar);
      updateSnackbar();

      var avatarLive = document.getElementById("avatar-live");
      var avatarSize = document.getElementById("avatar-size");
      var avatarShape = document.getElementById("avatar-shape");
      var avatarMode = document.getElementById("avatar-mode");
      function updateAvatar() {
        if (!avatarLive) return;
        var size = (avatarSize && avatarSize.value) || "48";
        var shape = (avatarShape && avatarShape.value) || "circle";
        var mode = (avatarMode && avatarMode.value) || "letters";
        var classes = ["avatar", "avatar--" + shape, "avatar--" + size, "avatar--" + mode];
        avatarLive.className = classes.join(" ");
        avatarLive.style.opacity = "0.7";
        requestAnimationFrame(function () {
          if (mode === "image") {
            avatarLive.innerHTML = '<img src="avatar-image.svg" alt="" class="avatar-img">';
          } else if (mode === "placeholder") {
            avatarLive.innerHTML = '<img src="avatar-placeholder-man.svg" alt="" class="avatar-img">';
          } else {
            avatarLive.textContent = mode === "letters" ? "БЯ" : mode === "icon" ? "◆" : "";
          }
          requestAnimationFrame(function () {
            avatarLive.style.opacity = "1";
          });
        });
      }
      if (avatarSize) avatarSize.addEventListener("change", updateAvatar);
      if (avatarShape) avatarShape.addEventListener("change", updateAvatar);
      if (avatarMode) avatarMode.addEventListener("change", updateAvatar);
      updateAvatar();

      var actionbarSwapperWrap = document.getElementById("actionbar-swapper-wrap");
      var actionbarBtn2 = document.getElementById("actionbar-btn-2");
      var actionbarBtn3 = document.getElementById("actionbar-btn-3");
      var actionbarHomeWrap = document.getElementById("actionbar-home-wrap");
      var actionbarButtons = document.getElementById("actionbar-buttons");
      var actionbarContent = document.getElementById("actionbar-content");
      var actionbarHome = document.getElementById("actionbar-home");
      function updateActionbar() {
        var n = parseInt((actionbarButtons && actionbarButtons.value) || "1", 10);
        if (n < 1 || n > 3) n = 1;
        var hasContent = actionbarContent && actionbarContent.value === "yes";
        var hasHome = actionbarHome && actionbarHome.value === "yes";
        if (actionbarSwapperWrap) actionbarSwapperWrap.classList.toggle("actionbar--hidden", !hasContent);
        if (actionbarBtn2) actionbarBtn2.classList.toggle("actionbar--hidden", n < 2);
        if (actionbarBtn3) actionbarBtn3.classList.toggle("actionbar--hidden", n < 3);
        if (actionbarHomeWrap) actionbarHomeWrap.classList.toggle("actionbar--hidden", !hasHome);
      }
      if (actionbarButtons) actionbarButtons.addEventListener("change", updateActionbar);
      if (actionbarContent) actionbarContent.addEventListener("change", updateActionbar);
      if (actionbarHome) actionbarHome.addEventListener("change", updateActionbar);
      updateActionbar();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var colorCards = document.querySelectorAll(".color-card");
      var toast = document.getElementById("copy-snackbar");
      var toastTimer = null;
      function showToast() {
        if (!toast) return;
        toast.classList.add("copy-snackbar--visible");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
          toast.classList.remove("copy-snackbar--visible");
        }, 1200);
      }
      function copyHexFromCard(card) {
        if (!card) return;
        var hexEl = card.querySelector(".color-card-hex");
        if (!hexEl) return;
        var hex = (hexEl.textContent || "").trim();
        if (!hex) return;
        if (hex.charAt(0) !== "#") hex = "#" + hex;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(hex).catch(function () {});
        } else {
          var ta = document.createElement("textarea");
          ta.value = hex;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          try { document.execCommand("copy"); } catch (e) {}
          document.body.removeChild(ta);
        }
        colorCards.forEach(function (c) { c.classList.remove("color-card--copied"); });
        card.classList.add("color-card--copied");
        setTimeout(function () {
          card.classList.remove("color-card--copied");
        }, 800);
        showToast();
      }
      colorCards.forEach(function (card) {
        card.addEventListener("click", function () {
          copyHexFromCard(card);
        });
      });
    });
    document.addEventListener("DOMContentLoaded", function () {
      var liveBtn = document.getElementById("live-button");
      var btnTextInput = document.getElementById("btn-text");
      var typeSelect = document.getElementById("btn-type");
      var stateSelect = document.getElementById("btn-state");
      var iconSelect = document.getElementById("btn-icon");
      var sizeSelect = document.getElementById("btn-size");
      function updateButton() {
        if (!liveBtn || !typeSelect) return;
        var type = typeSelect.value;
        var state = stateSelect.value;
        var icon = iconSelect.value;
        var size = sizeSelect.value;
        var classList = liveBtn.classList;
        ["primary","secondary","tertiary","danger"].forEach(function(c){ classList.remove("live-btn--" + c); });
        classList.add("live-btn--" + type);
        ["xs","s","m","l"].forEach(function(c){ classList.remove("live-btn--" + c); });
        classList.add("live-btn--" + size);
        ["disabled","loading"].forEach(function(c){ classList.remove("live-btn--" + c); });
        if (state === "disabled") classList.add("live-btn--disabled");
        if (state === "loading") classList.add("live-btn--loading");
        var label = state === "loading" ? "Loading…" : (btnTextInput && btnTextInput.value.trim()) || "Button";
        if (icon === "yes") {
          liveBtn.innerHTML = '<span class="btn-icon">◆</span><span class="btn-text"></span>';
          var textEl = liveBtn.querySelector(".btn-text");
          if (textEl) textEl.textContent = label;
        } else {
          liveBtn.innerHTML = '<span class="btn-text"></span>';
          var textEl2 = liveBtn.querySelector(".btn-text");
          if (textEl2) textEl2.textContent = label;
        }
      }
      if (btnTextInput) btnTextInput.addEventListener("input", updateButton);
      if (typeSelect) typeSelect.addEventListener("change", updateButton);
      if (stateSelect) stateSelect.addEventListener("change", updateButton);
      if (iconSelect) iconSelect.addEventListener("change", updateButton);
      if (sizeSelect) sizeSelect.addEventListener("change", updateButton);
      updateButton();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var stackEl = document.getElementById("buttonstack-live");
      var stackCount = document.getElementById("buttonstack-count");
      var stackType = document.getElementById("buttonstack-type");
      var stackFlip = document.getElementById("buttonstack-flip");
      function updateButtonStack() {
        if (!stackEl) return;
        var count = parseInt((stackCount && stackCount.value) || "2", 10);
        if (count < 1 || count > 3) count = 2;
        var type = (stackType && stackType.value) || "vertical";
        var flip = (stackFlip && stackFlip.value) === "yes";
        var btns = stackEl.querySelectorAll(".button-stack__btn");
        stackEl.className = "button-stack button-stack--" + type + " button-stack--count-" + count;
        var types = count === 1 ? ["primary"] : count === 2
          ? (flip ? ["secondary", "primary"] : ["primary", "secondary"])
          : (flip ? ["tertiary", "secondary", "primary"] : ["primary", "secondary", "tertiary"]);
        btns.forEach(function (btn, i) {
          if (!btn.classList.contains("live-btn")) return;
          ["primary", "secondary", "tertiary"].forEach(function (c) { btn.classList.remove("live-btn--" + c); });
          if (i < types.length) btn.classList.add("live-btn--" + types[i]);
          var shouldShow = i < count;
          btn.classList.toggle("button-stack__btn--hidden", !shouldShow);
        });
      }
      if (stackCount) stackCount.addEventListener("change", updateButtonStack);
      if (stackType) stackType.addEventListener("change", updateButtonStack);
      if (stackFlip) stackFlip.addEventListener("change", updateButtonStack);
      updateButtonStack();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var cardDemo = document.getElementById("card-demo");
      var cardState = document.getElementById("card-state");
      function updateCard() {
        if (!cardDemo) return;
        var state = (cardState && cardState.value) || "default";
        cardDemo.classList.remove("card-demo--pressed");
        if (state === "pressed") cardDemo.classList.add("card-demo--pressed");
      }
      if (cardState) cardState.addEventListener("change", updateCard);
      updateCard();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var cardStackEl = document.getElementById("cardstack-live");
      var cardStackCount = document.getElementById("cardstack-count");
      var cardStackType = document.getElementById("cardstack-type");
      function updateCardStack() {
        if (!cardStackEl) return;
        var count = parseInt((cardStackCount && cardStackCount.value) || "2", 10);
        if (count < 1 || count > 3) count = 2;
        var type = (cardStackType && cardStackType.value) || "vertical";
        cardStackEl.className = "card-stack" + (type === "horizontal" ? " card-stack--horizontal" : "");
        var cards = cardStackEl.querySelectorAll(".card-stack__card");
        cards.forEach(function (card, i) {
          card.classList.toggle("card-stack__card--hidden", i >= count);
        });
      }
      if (cardStackCount) cardStackCount.addEventListener("change", updateCardStack);
      if (cardStackType) cardStackType.addEventListener("change", updateCardStack);
      updateCardStack();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var checkboxDemo = document.getElementById("checkbox-demo");
      var checkboxState = document.getElementById("checkbox-state");
      function applyCheckboxState(state) {
        if (!checkboxDemo) return;
        checkboxDemo.classList.remove("checkbox-demo--checked", "checkbox-demo--disabled");
        var isChecked = state === "checked";
        var isDisabled = state === "disabled";
        if (isChecked) checkboxDemo.classList.add("checkbox-demo--checked");
        if (isDisabled) checkboxDemo.classList.add("checkbox-demo--disabled");
        checkboxDemo.setAttribute("aria-checked", isChecked ? "true" : "false");
        checkboxDemo.setAttribute("aria-disabled", isDisabled ? "true" : "false");
      }
      function updateCheckboxFromSelect() {
        var state = (checkboxState && checkboxState.value) || "unchecked";
        applyCheckboxState(state);
      }
      if (checkboxState) checkboxState.addEventListener("change", updateCheckboxFromSelect);
      if (checkboxDemo) {
        checkboxDemo.addEventListener("click", function () {
          if (!checkboxState) return;
          var current = checkboxState.value;
          if (current === "disabled") return;
          var next = current === "checked" ? "unchecked" : "checked";
          checkboxState.value = next;
          applyCheckboxState(next);
        });
      }
      updateCheckboxFromSelect();
    });
    document.addEventListener("DOMContentLoaded", function () {
      var dateDemo = document.getElementById("date-demo");
      var dateState = document.getElementById("date-state");
      function updateDateDemo() {
        if (!dateDemo) return;
        var state = (dateState && dateState.value) || "default";
        dateDemo.classList.remove("date-input-demo--focused", "date-input-demo--error", "date-input-demo--disabled");
        if (state === "focused") dateDemo.classList.add("date-input-demo--focused");
        if (state === "error") dateDemo.classList.add("date-input-demo--error");
        if (state === "disabled") dateDemo.classList.add("date-input-demo--disabled");
      }
      if (dateState) dateState.addEventListener("change", updateDateDemo);
      updateDateDemo();
    });
    document.addEventListener("DOMContentLoaded", function () {
      function setActiveNav() {
        var hash = window.location.hash || "#section-intro";
        document.querySelectorAll(".nav-link").forEach(function (link) {
          link.classList.toggle("active", link.getAttribute("href") === hash);
        });
      }
      setActiveNav();
      window.addEventListener("hashchange", setActiveNav);
      document.querySelectorAll(".accordion-card .accordion-header").forEach(function (header) {
        header.addEventListener("click", function () {
          var card = header.closest(".accordion-card");
          if (!card) return;
          var open = card.getAttribute("data-open") === "true";
          card.setAttribute("data-open", open ? "false" : "true");
        });
      });
    });
  </script>
</body>
</html>
`;

fs.writeFileSync(OUTPUT_HTML, html, "utf8");
console.log(`Сгенерирован файл: ${OUTPUT_HTML}`);

