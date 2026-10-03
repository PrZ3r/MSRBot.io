#!/usr/bin/env node
// Print a PDF's metadata and text, page by page, with line breaks preserved.
//
//   node .claude/skills/msrbot-extract/scripts/pdf_text.mjs <file.pdf|url> [pages]
//
// pages: "1-4", "3", "1,5-6" (default: all). A URL is downloaded first.
// Uses pdfjs-dist, installed into this skill folder on first run.

import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const skillDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(skillDir, 'node_modules', 'pdfjs-dist');
if (!existsSync(pkg)) {
  // Own package.json so npm installs here, not into the repo above.
  if (!existsSync(join(skillDir, 'package.json'))) writeFileSync(join(skillDir, 'package.json'), '{"private":true}\n');
  console.error('[pdf_text] installing pdfjs-dist@4 into the skill folder (one time)…');
  execSync('npm install --silent --no-save --no-package-lock pdfjs-dist@4', { cwd: skillDir, stdio: 'inherit' });
}
const require = createRequire(join(skillDir, 'package.json'));
const { getDocument } = await import(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'));

let [src, range] = process.argv.slice(2);
if (!src) {
  console.error('usage: pdf_text.mjs <file.pdf|url> [pages]');
  process.exit(1);
}
if (/^https?:\/\//.test(src)) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${src}`);
  const file = join(mkdtempSync(join(tmpdir(), 'pdf-')), 'doc.pdf');
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  src = file;
}

const doc = await getDocument({ url: src, verbosity: 0 }).promise;
const meta = await doc.getMetadata();
console.log(JSON.stringify({ pages: doc.numPages, info: meta.info }));

const wanted = new Set();
for (const part of (range || `1-${doc.numPages}`).split(',')) {
  const [a, b] = part.split('-').map(Number);
  for (let i = a; i <= (b || a); i++) if (i >= 1 && i <= doc.numPages) wanted.add(i);
}
for (const i of [...wanted].sort((x, y) => x - y)) {
  const page = await doc.getPage(i);
  const { items } = await page.getTextContent();
  let out = '';
  let y = null;
  for (const it of items) {
    if (y !== null && Math.abs(it.transform[5] - y) > 2) out += '\n';
    out += it.str;
    y = it.transform[5];
  }
  console.log(`--- page ${i}\n${out}`);
}
