#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, copyFileSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { arch, platform } from "node:os";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, ".sidecar-build");
const BINARIES = resolve(ROOT, "src-tauri", "binaries");

// 支持 --target 参数覆盖自动检测，用于 CI 交叉编译
function parseTargetTriple() {
  const targetArg = process.argv.find((a, i) => a === "--target" && process.argv[i + 1]);
  if (targetArg) {
    return process.argv[process.argv.indexOf(targetArg) + 1];
  }
  // 也支持 TAURI_TARGET_TRIPLE 环境变量
  if (process.env.TAURI_TARGET_TRIPLE) {
    return process.env.TAURI_TARGET_TRIPLE;
  }
  return null;
}

const OVERRIDE_TARGET = parseTargetTriple();

let PLATFORM, ARCH, TARGET_TRIPLE;

if (OVERRIDE_TARGET) {
  TARGET_TRIPLE = OVERRIDE_TARGET;
  // 从 triple 解析 platform 和 arch
  if (TARGET_TRIPLE.includes("apple-darwin")) {
    PLATFORM = "macos";
  } else if (TARGET_TRIPLE.includes("pc-windows")) {
    PLATFORM = "windows";
  } else {
    PLATFORM = "linux";
  }
  if (TARGET_TRIPLE.startsWith("aarch64") || TARGET_TRIPLE.startsWith("arm64")) {
    ARCH = "aarch64";
  } else {
    ARCH = "x86_64";
  }
  console.log(`Using target triple from argument: ${TARGET_TRIPLE}`);
} else {
  PLATFORM = platform() === "darwin" ? "macos" : platform() === "win32" ? "windows" : "linux";
  ARCH = arch() === "arm64" ? "aarch64" : "x86_64";
  TARGET_TRIPLE = PLATFORM === "macos" ? `${ARCH}-apple-darwin` : PLATFORM === "windows" ? `${ARCH}-pc-windows-msvc` : `${ARCH}-unknown-linux-gnu`;
  console.log(`Auto-detected target triple: ${TARGET_TRIPLE}`);
}

const BINARY_NAME = `server-${TARGET_TRIPLE}`;

console.log(`Building sidecar: ${BINARY_NAME}`);

// Step 1: Bundle with esbuild
console.log("Bundling server code...");
mkdirSync(DIST, { recursive: true });

execSync(
  `npx esbuild src/server/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=${DIST}/server.mjs "--banner:js=import {createRequire} from \\"module\\";const require=createRequire(import.meta.url);"`,
  { cwd: ROOT, stdio: "inherit" }
);

// Step 2: Create sidecar wrapper
mkdirSync(BINARIES, { recursive: true });

if (PLATFORM === "windows") {
  // Windows: 使用 pkg 创建真正的 .exe
  console.log("Building Windows executable with pkg...");
  writeFileSync(resolve(BINARIES, `${BINARY_NAME}.bat`), `@echo off\r\nnode "%~dp0\\server.mjs" %*\r\n`);
  writeFileSync(resolve(BINARIES, `${BINARY_NAME}.cmd`), `@echo off\r\nnode "%~dp0\\server.mjs" %*\r\n`);
  try {
    // 确定 pkg target
    const pkgTarget = ARCH === "aarch64" ? "node20-win-arm64" : "node20-win-x64";
    execSync(
      `npx -y @yao-pkg/pkg@latest ${DIST}/server.mjs --targets ${pkgTarget} --output ${resolve(BINARIES, `${BINARY_NAME}.exe`)} --compress GZip --public`,
      { cwd: ROOT, stdio: "inherit" }
    );
    console.log("Created Windows .exe with pkg");
  } catch (e) {
    console.error("pkg failed:", e.message);
    writeFileSync(resolve(BINARIES, `${BINARY_NAME}.exe`), Buffer.from([]));
    console.log("WARNING: Windows .exe is empty, Windows build may fail");
  }
} else {
  // macOS/Linux: 创建 shell 脚本 launcher
  writeFileSync(
    resolve(BINARIES, BINARY_NAME),
    `#!/bin/sh\ndir="$(cd "$(dirname "$0")" && pwd)"\nexec node "$dir/server.mjs" "$@"\n`,
    { mode: 0o755 }
  );
}

copyFileSync(resolve(DIST, "server.mjs"), resolve(BINARIES, "server.mjs"));

const size = statSync(resolve(BINARIES, "server.mjs")).size;
console.log(`Sidecar built: ${resolve(BINARIES, BINARY_NAME)}`);
console.log(`Bundled size: ${Math.round(size / 1024)}KB`);
