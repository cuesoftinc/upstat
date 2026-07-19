#!/usr/bin/env node
/**
 * check:boundaries — the W3 enforcement gate (web-implementation.md §9),
 * wired into `npm run lint` so the CI workflow stays untouched:
 *
 *  1. Live paths import NOTHING from src/legacy (quarantine is absolute).
 *  2. Views (src/app/** minus the mock server) never fetch: no `fetch(`,
 *     no repository imports, no gRPC/proto imports (MVC + X-8).
 *  3. Controllers never fetch directly — the repositories are the only
 *     network seam.
 *  4. No raw hex in live components (design.md §7) — documented exceptions
 *     only: the §2 on-crit raw #FFFFFF (must carry a comment on the line)
 *     and the GoogleAuthButton brand glyph.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

/** Recursively list files under dir, skipping src/legacy and node_modules. */
function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(SRC, path);
    if (rel.split(sep)[0] === "legacy") continue;
    if (name === "node_modules") continue;
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|tsx|mts|js|jsx|css)$/.test(name)) files.push(path);
  }
  return files;
}

const failures = [];
const fail = (file, line, rule, text) =>
  failures.push(`${relative(ROOT, file)}:${line} [${rule}] ${text.trim()}`);

const files = walk(SRC);

for (const file of files) {
  const rel = relative(SRC, file);
  const lines = readFileSync(file, "utf8").split("\n");
  const isView =
    rel.startsWith("app" + sep) &&
    !rel.startsWith(join("app", "api") + sep);
  const isController = rel.startsWith("controllers" + sep);
  const isUiComponent = rel.startsWith(join("components", "ui") + sep);
  const isTest = /\.test\.tsx?$/.test(rel);

  lines.forEach((text, i) => {
    const line = i + 1;
    const isPureComment = /^\s*(\/\/|\*|\/\*)/.test(text);

    // 1. legacy quarantine — no live import may reach src/legacy
    if (/from\s+["'].*(\/|^)legacy\//.test(text) || /require\(["'].*legacy\//.test(text)) {
      fail(file, line, "legacy-import", text);
    }

    if (isTest || isPureComment) return; // tests stub the network; prose is prose

    // 2. views never fetch (MVC): no fetch, no repositories, no gRPC
    if (isView) {
      if (/\bfetch\s*\(/.test(text)) fail(file, line, "view-fetch", text);
      if (/from\s+["']@\/models\/repositories/.test(text)) fail(file, line, "view-repo-import", text);
      if (/from\s+["'](@\/proto|@\/client|grpc-web|google-protobuf)/.test(text)) {
        fail(file, line, "view-grpc-import", text);
      }
    }

    // 3. controllers orchestrate; only repositories talk to the network
    if (isController && /\bfetch\s*\(/.test(text)) fail(file, line, "controller-fetch", text);

    // 4. no raw hex in live components (documented exceptions carry comments)
    if (isUiComponent || (isView && /\.(tsx|css)$/.test(rel))) {
      const hexes = text.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hexes) {
        const isGoogleGlyph = rel.endsWith("GoogleAuthButton.tsx");
        // §2 on-crit: raw #FFFFFF allowed when the line or the line above
        // carries the documenting comment
        const commented = /\/\/|\/\*/.test(text) || /\/\/|\/\*|^\s*\*/.test(lines[i - 1] ?? "");
        const isCommentedWhite =
          hexes.every((h) => h.toUpperCase() === "#FFFFFF" || h.toLowerCase() === "#fff") &&
          commented;
        if (!isGoogleGlyph && !isCommentedWhite) {
          fail(file, line, "raw-hex", text);
        }
      }
    }
  });
}

if (failures.length > 0) {
  console.error(`check:boundaries — ${failures.length} violation(s):\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`check:boundaries — clean (${files.length} live files checked).`);
