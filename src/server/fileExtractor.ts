// ─── File Content Extractor ────────────────────────────────────
// Extracts readable text from various file formats for AI context.
// Uses Node.js built-in modules where possible, minimal dependencies.

import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { tmpdir } from "node:os";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { execSync } from "node:child_process";

export interface ExtractedFile {
  name: string;
  type: string;
  size: number;
  content: string;     // extracted text content
  truncated?: boolean;
}

const MAX_CONTENT_LENGTH = 50000; // ~50KB of text max per file

/**
 * Extract readable text content from an uploaded file.
 * Supports: PDF, Excel (.xlsx/.xls), Word (.docx), CSV, ZIP, plain text, code files.
 */
export async function extractFileContent(
  fileName: string,
  fileType: string,
  base64Data: string
): Promise<ExtractedFile> {
  const buffer = Buffer.from(base64Data, "base64");
  const size = buffer.length;
  const ext = extname(fileName).toLowerCase();

  let content = "";

  try {
    if (isPlainText(ext)) {
      content = buffer.toString("utf-8");
    } else if (ext === ".csv") {
      content = buffer.toString("utf-8");
    } else if (ext === ".json") {
      content = buffer.toString("utf-8");
    } else if (ext === ".pdf") {
      content = await extractPDF(buffer);
    } else if (ext === ".xlsx" || ext === ".xls") {
      content = await extractExcel(buffer);
    } else if (ext === ".docx") {
      content = await extractWord(buffer);
    } else if (ext === ".zip") {
      content = await extractZip(buffer, fileName);
    } else if (ext === ".md" || ext === ".markdown") {
      content = buffer.toString("utf-8");
    } else if (ext === ".xml" || ext === ".html" || ext === ".htm") {
      // Strip tags, return text
      content = buffer.toString("utf-8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    } else {
      // Try as text
      content = buffer.toString("utf-8");
    }
  } catch (err) {
    content = `[文件提取失败: ${err instanceof Error ? err.message : String(err)}]`;
  }

  // Truncate if too long
  let truncated = false;
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.slice(0, MAX_CONTENT_LENGTH) + "\n\n[...内容已截断，共 " + content.length + " 字符]";
    truncated = true;
  }

  return { name: fileName, type: fileType, size, content, truncated };
}

// ─── Format Detectors ──────────────────────────────────────────

function isPlainText(ext: string): boolean {
  const textExts = [".txt", ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".hpp", ".css", ".scss", ".less", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".sh", ".bash", ".zsh", ".fish", ".bat", ".cmd", ".ps1", ".sql", ".graphql", ".proto", ".dart", ".swift", ".kt", ".rb", ".php", ".lua", ".r", ".m", ".mm"];
  return textExts.includes(ext);
}

// ─── PDF Extraction ────────────────────────────────────────────
// Uses pdftotext (poppler-utils) if available, otherwise returns placeholder

async function extractPDF(buffer: Buffer): Promise<string> {
  const tmpFile = resolve(tmpdir(), `agent-pdf-${Date.now()}.pdf`);
  await writeFile(tmpFile, buffer);
  try {
    // Try pdftotext (available via `brew install poppler` on macOS)
    const text = execSync(`pdftotext "${tmpFile}" -`, { timeout: 15000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    return text.trim() || "[PDF 文件无可提取文本（可能是扫描件）]";
  } catch {
    // Try Python pdfplumber or PyPDF2
    try {
      const text = execSync(`python3 -c "
import sys
try:
    import pdfplumber
    with pdfplumber.open('${tmpFile}') as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t: print(t)
except ImportError:
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader('${tmpFile}')
        for page in reader.pages:
            t = page.extract_text()
            if t: print(t)
    except ImportError:
        print('[需要安装 poppler (brew install poppler) 或 python3 -m pip install pdfplumber]')
"`, { timeout: 15000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      return text.trim();
    } catch {
      return "[PDF 提取需要安装 poppler: brew install poppler，或 pip install pdfplumber]";
    }
  } finally {
    await rm(tmpFile, { force: true }).catch(() => {});
  }
}

// ─── Excel Extraction ──────────────────────────────────────────

async function extractExcel(buffer: Buffer): Promise<string> {
  const tmpFile = resolve(tmpdir(), `agent-xlsx-${Date.now()}.xlsx`);
  await writeFile(tmpFile, buffer);
  try {
    // Try Python openpyxl
    const text = execSync(`python3 -c "
import openpyxl
wb = openpyxl.load_workbook('${tmpFile}', read_only=True, data_only=True)
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    print(f'=== Sheet: {sheet_name} ===')
    for row in ws.iter_rows(max_row=200, values_only=True):
        cells = [str(c) if c is not None else '' for c in row]
        print('\\t'.join(cells))
    print()
wb.close()
"`, { timeout: 15000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    return text.trim();
  } catch {
    return "[Excel 提取需要安装 openpyxl: pip install openpyxl]";
  } finally {
    await rm(tmpFile, { force: true }).catch(() => {});
  }
}

// ─── Word (.docx) Extraction ───────────────────────────────────

async function extractWord(buffer: Buffer): Promise<string> {
  const tmpFile = resolve(tmpdir(), `agent-docx-${Date.now()}.docx`);
  await writeFile(tmpFile, buffer);
  try {
    // Try python-docx
    const text = execSync(`python3 -c "
from docx import Document
doc = Document('${tmpFile}')
for para in doc.paragraphs:
    if para.text.strip():
        print(para.text)
for table in doc.tables:
    print('--- Table ---')
    for row in table.rows:
        cells = [cell.text for cell in row.cells]
        print('\\t'.join(cells))
"`, { timeout: 15000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    return text.trim();
  } catch {
    return "[Word 提取需要安装 python-docx: pip install python-docx]";
  } finally {
    await rm(tmpFile, { force: true }).catch(() => {});
  }
}

// ─── ZIP Extraction ────────────────────────────────────────────

async function extractZip(buffer: Buffer, originalName: string): Promise<string> {
  const tmpDir = resolve(tmpdir(), `agent-zip-${Date.now()}`);
  const tmpFile = resolve(tmpDir, originalName);
  await mkdir(tmpDir, { recursive: true });
  await writeFile(tmpFile, buffer);

  try {
    // Use system unzip
    const extractDir = resolve(tmpDir, "extracted");
    await mkdir(extractDir, { recursive: true });
    execSync(`unzip -o "${tmpFile}" -d "${extractDir}"`, { timeout: 15000 });

    // List files and read text ones
    const listing = execSync(`find "${extractDir}" -type f | head -50`, { encoding: "utf-8" });
    const files = listing.trim().split("\n").filter(Boolean);

    let result = `ZIP 包含 ${files.length} 个文件:\n`;
    for (const file of files.slice(0, 20)) {
      const relPath = file.replace(extractDir + "/", "");
      const ext = extname(file).toLowerCase();
      result += `\n--- ${relPath} ---\n`;
      if (isPlainText(ext) || ext === ".csv" || ext === ".json" || ext === ".md") {
        try {
          const content = execSync(`head -200 "${file}"`, { encoding: "utf-8", maxBuffer: 1024 * 1024 });
          result += content;
        } catch {
          result += "[读取失败]";
        }
      } else {
        result += `[${ext || "未知"} 格式，已跳过]`;
      }
    }
    if (files.length > 20) result += `\n\n...还有 ${files.length - 20} 个文件未显示`;
    return result;
  } catch (err) {
    return `[ZIP 解压失败: ${err instanceof Error ? err.message : "系统 unzip 命令不可用"}]`;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
