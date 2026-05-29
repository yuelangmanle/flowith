#!/usr/bin/env node
/**
 * Generate app icons from SVG for all platforms.
 * Uses sharp or canvas - but since we want zero deps, we'll use a simple SVG→PNG approach.
 * For now, we'll create a minimal PNG from the SVG data.
 * 
 * In production, use a proper tool like:
 * - tauri icon (built into @tauri-apps/cli)
 * - sharp for Node.js image processing
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ICONS_DIR = resolve(ROOT, "src-tauri", "icons");

// Try using tauri's built-in icon generator
const svgPath = resolve(ROOT, "public", "icon.svg");

if (existsSync(svgPath)) {
  console.log("Generating icons from SVG...");
  try {
    execSync(`npx tauri icon "${svgPath}"`, { cwd: ROOT, stdio: "inherit" });
    console.log("Icons generated successfully!");
  } catch (e) {
    console.log("tauri icon failed, using placeholder icons.");
    console.log("Run 'npx tauri icon public/icon.svg' manually to generate proper icons.");
  }
} else {
  console.log("No SVG icon found at public/icon.svg");
}
