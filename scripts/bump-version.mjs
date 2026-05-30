#!/usr/bin/env node
/**
 * 版本号统一更新脚本
 * 用法: node scripts/bump-version.mjs 1.3.8
 *
 * 自动更新以下文件中的版本号:
 *   1. package.json
 *   2. src-tauri/tauri.conf.json
 *   3. android/app/build.gradle (versionName + versionCode)
 *   4. src/views/SettingsView.tsx (APP_VERSION + 硬编码)
 *   5. src/mobile/MobileSettingsView.tsx (currentVersion + 硬编码)
 *   6. docs/download/index.html (下载链接文件名)
 *   7. src/lib/version.ts (单一真相源)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  fail("用法: node scripts/bump-version.mjs <major.minor.patch>");
}

// 读取当前版本
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
const oldVersion = pkg.version;
if (oldVersion === newVersion) {
  fail(`版本号已经是 ${newVersion}，无需更新`);
}

const vTag = `v${newVersion}`;
const oldVTag = `v${oldVersion}`;
console.log(`📦 ${oldVTag} → ${vTag}`);

// 读取当前 versionCode
const gradlePath = resolve(ROOT, "android/app/build.gradle");
const gradleContent = readFileSync(gradlePath, "utf-8");
const vcMatch = gradleContent.match(/versionCode\s+(\d+)/);
const oldVersionCode = vcMatch ? parseInt(vcMatch[1]) : 1;
const newVersionCode = oldVersionCode + 1;

const updates = [
  {
    file: "src/lib/version.ts",
    content: `// 单一版本真相源 — 所有组件从此处读取版本号\n// 由 scripts/bump-version.mjs 自动更新\nexport const APP_VERSION = "${newVersion}";\nexport const APP_VERSION_TAG = "${vTag}";\n`,
  },
  {
    file: "package.json",
    replace: [`"version": "${oldVersion}"`, `"version": "${newVersion}"`],
  },
  {
    file: "src-tauri/tauri.conf.json",
    replace: [`"version": "${oldVersion}"`, `"version": "${newVersion}"`],
  },
  {
    file: "android/app/build.gradle",
    replace: [
      [`versionCode ${oldVersionCode}`, `versionCode ${newVersionCode}`],
      [`versionName "${oldVersion}"`, `versionName "${newVersion}"`],
    ],
  },
  {
    file: "src/views/SettingsView.tsx",
    replace: [
      [`APP_VERSION = "${oldVersion}"`, `APP_VERSION = "${newVersion}"`],
      [`v${oldVersion}`, `v${newVersion}`],
    ],
  },
  {
    file: "src/mobile/MobileSettingsView.tsx",
    replace: [
      [`currentVersion="${oldVersion}"`, `currentVersion="${newVersion}"`],
      [`v${oldVersion}`, `v${newVersion}`],
    ],
  },
  {
    file: "docs/download/index.html",
    replace: [[`Flowith_${oldVersion}_`, `Flowith_${newVersion}_`]],
  },
];

for (const u of updates) {
  const filePath = resolve(ROOT, u.file);
  if (u.content) {
    writeFileSync(filePath, u.content);
    console.log(`✅ ${u.file} — 写入`);
    continue;
  }
  let content = readFileSync(filePath, "utf-8");
  const pairs = Array.isArray(u.replace[0]) ? u.replace : [u.replace];
  for (const [from, to] of pairs) {
    if (!content.includes(from)) {
      console.log(`⚠️  ${u.file} — 找不到 "${from}"，跳过`);
      continue;
    }
    content = content.replaceAll(from, to);
  }
  writeFileSync(filePath, content);
  console.log(`✅ ${u.file}`);
}

console.log(`\n🎉 版本已更新到 ${vTag} (versionCode: ${newVersionCode})`);
console.log(`\n下一步:`);
console.log(`  npm run build && npm test`);
console.log(`  git add -A && git commit -m "chore: bump version to ${vTag}"`);
console.log(`  git tag ${vTag} && git push origin main && git push origin ${vTag}`);
