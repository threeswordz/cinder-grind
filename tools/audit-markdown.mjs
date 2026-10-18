#!/usr/bin/env node
// Advisory, dependency-free Markdown inventory and local-link check.
// Semantic policy conflicts require human/AI review; this is not a substitute.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const ignoredDirectories = new Set(['.git', 'node_modules', '.pnpm', 'dist', 'build', 'coverage', '.next']);
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(join(dir, entry.name));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(join(dir, entry.name));
    }
  }
}
walk(root);
files.sort();

const findings = [];
for (const absolutePath of files) {
  const path = relative(root, absolutePath).split(sep).join('/');
  const lines = readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  let fence = null;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    // Markdown fenced blocks allow at most three leading spaces.
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.char &&
          fenceMatch[1].length >= fence.length && fenceMatch[2].trim() === "") fence = null;
      continue;
    }
    if (/^(?: {4}|\t)/.test(line)) continue; // indented code is not a fence
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (marker[0] === "~" || !fenceMatch[2].includes("`"))
        fence = { char: marker[0], length: marker.length };
      continue;
    }
    // Link detection is intentionally conservative: skip URLs, fragments and
    // complex Markdown constructs that need a full parser. No false claim of
    // full semantic/link coverage is made.
    const linkRegex = /!?\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+['"][^'"]*['"])?\s*\)/g;
    for (const match of line.matchAll(linkRegex)) {
      let href = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) continue;
      href = href.split(/[?#]/, 1)[0];
      if (!href) continue;
      try { href = decodeURIComponent(href); } catch { /* keep raw name */ }
      const target = resolve(dirname(absolutePath), href);
      if (!existsSync(target)) {
        findings.push(`${path}:${lineIndex + 1}: missing local target ${JSON.stringify(href)}`);
      }
    }
  }
}

console.log(`Markdown inventory: ${files.length} files.`);
console.log(`Advisory local-link findings: ${findings.length}.`);
for (const item of findings.slice(0, 75)) console.log(`  - ${item}`);
if (findings.length > 75) console.log(`  ... ${findings.length - 75} more; inspect locally for the complete list.`);
console.log('Limits: does not verify anchor slugs, reference-style links, factual accuracy, policy contradictions, or runtime behavior.');
if (strict && findings.length > 0) process.exitCode = 1;
