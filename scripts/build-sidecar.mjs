#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, copyFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { arch, platform } from "node:os";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, ".sidecar-build");
const BINARIES = resolve(ROOT, "src-tauri", "binaries");

const PLATFORM = platform() === "darwin" ? "macos" : platform() === "win32" ? "windows" : "linux";
const ARCH = arch() === "arm64" ? "aarch64" : "x86_64";
const TARGET_TRIPLE = PLATFORM === "macos" ? `${ARCH}-apple-darwin` : PLATFORM === "windows" ? `${ARCH}-pc-windows-msvc` : `${ARCH}-unknown-linux-gnu`;
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

if (platform() === "win32") {
  writeFileSync(resolve(BINARIES, `${BINARY_NAME}.bat`), `@echo off\r\nnode "%~dp0\\server.mjs" %*\r\n`);
} else {
  writeFileSync(resolve(BINARIES, BINARY_NAME), `#!/bin/sh\ndir="$(cd "$(dirname "$0")" && pwd)"\nexec node "$dir/server.mjs" "$@"\n`, { mode: 0o755 });
}

copyFileSync(resolve(DIST, "server.mjs"), resolve(BINARIES, "server.mjs"));

const size = statSync(resolve(BINARIES, "server.mjs")).size;
console.log(`Sidecar built: ${resolve(BINARIES, BINARY_NAME)}`);
console.log(`Bundled size: ${Math.round(size / 1024)}KB`);
