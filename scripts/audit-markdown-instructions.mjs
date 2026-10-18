#!/usr/bin/env node
// Mechanical, exhaustive Markdown file/line inventory. NOT a semantic conflict certification.
// No external dependencies. Use --full to retain a per-file evidence manifest in CI logs.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const root = process.cwd();
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0")
  .filter(x => /\.md$/i.test(x)).sort();
const byPath = new Set(paths);
const manifest = [], findings = [], statements = new Map();
const rules = /\b(?:must|never|always|shall|must not|do not|only|not authorized|required|cannot|prohibited|should not)\b/i;
const isHistory = p => /^docs\/V(?:0\.\d+|1\.\d+)/i.test(p) || /PROPOSAL|EVIDENCE|PREFLIGHT|DECISION-LOG|CHANGE-LOG/i.test(p);
let totalLines = 0;
function flag(kind, path, line, text, refs = []) {
  findings.push({kind, path, line, text: text.slice(0, 300), refs});
}
for (const path of paths) {
  const src = readFileSync(path, "utf8"), lines = src.split(/\r?\n/);
  let fence = "", directives = 0, links = 0, codeLines = 0;
  totalLines += lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], trimmed = line.trim(), marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = "";
      codeLines++;
      continue;
    }
    if (fence) { codeLines++; continue; }
    if (rules.test(line)) {
      directives++;
      const normalized = trimmed.toLowerCase().replace(/\s+/g, " ")
        .replace(/[\*_#>|]/g, "").trim();
      if (normalized.length > 90 && normalized.length < 350 && !normalized.startsWith("|")) {
        const refs = statements.get(normalized) || [];
        refs.push({ path, line: i + 1 });
        statements.set(normalized, refs);
      }
    }
    const linkRx = /\[[^\]]+\]\(([^)]+)\)/g;
    for (const match of line.matchAll(linkRx)) {
      links++;
      let raw = match[1].split("#")[0].split("?")[0].replace(/^<|>$/g, "");
      if (!raw || /^(?:https?:|mailto:|data:|\/\/)/i.test(raw)) continue;
      try { raw = decodeURIComponent(raw); }
      catch { flag("malformed-url", path, i + 1, raw); continue; }
      const target = raw.startsWith("/") ? resolve(root, "." + raw) : resolve(root, dirname(path), raw);
      if (!(target === root || target.startsWith(root + sep))) {
        flag("out-of-root-link", path, i + 1, raw);
      } else if (!existsSync(target)) {
        flag("missing-relative-link", path, i + 1, raw, [relative(root, target)]);
      }
    }
    if (i < 16 && /^docs\/V/i.test(path) &&
        /(status|implementation authorization|current phase)/i.test(line) &&
        /\b(PENDING|BLOCKED|NOT RUN|NOT ACCEPTED|NOT AUTHORIZED)\b/i.test(line)) {
      flag("status-needs-authority-triage", path, i + 1, trimmed);
    }
  }
  manifest.push({
    path, sha256: createHash("sha256").update(src).digest("hex"),
    bytes: Buffer.byteLength(src), lines: lines.length,
    directives, links, codeLines, historyOrRelease: isHistory(path)
  });
}
for (const [statement, refs] of statements) {
  const live = refs.filter(r => !isHistory(r.path));
  if (new Set(live.map(r => r.path)).size > 1)
    flag("repeated-current-instruction", live[0].path, live[0].line,
      statement, live.slice(1, 9).map(x => x.path + ":" + x.line));
}
const owners = [
  "AGENTS.md", "docs/PROJECT-GOVERNANCE.md", "docs/DECISION-LOG.md",
  "docs/DEVELOPMENT-OPERATING-MODEL.md", "docs/REQUIREMENTS.md",
  "docs/CURRENT-STATE.md", "docs/DEVELOPMENT-ROADMAP.md",
  "docs/TESTING-UAT.md", "docs/V1.1-SCOPE.md",
  "docs/V1.1-ACCEPTANCE-CRITERIA.md", "docs/V1.1-E2-UAT-EXECUTION.md"
];
for (const path of owners)
  if (!byPath.has(path)) flag("missing-authority-file", path, 0, "Expected authority document absent");
if (byPath.has("docs/V1.1-E2-UAT-EXECUTION.md")) {
  const uat = readFileSync("docs/V1.1-E2-UAT-EXECUTION.md", "utf8");
  if (!uat.includes("AC-V11-029") || !uat.includes("AC-V11-030"))
    flag("missing-human-acceptance-gates", "docs/V1.1-E2-UAT-EXECUTION.md", 0,
      "Required human gate references missing");
}
const inventoryDigest = createHash("sha256").update(
  manifest.map(x => x.path + "\0" + x.sha256 + "\n").join("")).digest("hex");
const result = {
  interpretation: "MECHANICAL COVERAGE ONLY. A script does not judge semantic conflicts or duplicated work. Codex must report independent review scope.",
  checkout: sha, files: manifest.length, lines: totalLines, inventoryDigest,
  directiveCount: manifest.reduce((n,x) => n + x.directives, 0),
  findings, manifest
};
const summary = {
  checkout: sha, files: result.files, lines: result.lines,
  inventoryDigest, directiveCount: result.directiveCount,
  findingsByKind: Object.entries(findings.reduce((acc, x) => {
    acc[x.kind] = (acc[x.kind] || 0) + 1; return acc;
  }, {}))
};
process.stdout.write(JSON.stringify(process.argv.includes("--full") ? result : summary, null, 2) + "\n");
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    "## Markdown audit inventory (mechanical, not semantic certification)\n\n" +
    "- Exact checkout: " + sha + "\n" +
    "- Tracked Markdown scanned: " + manifest.length + " files; " + totalLines + " physical lines.\n" +
    "- Inventory SHA256: " + inventoryDigest + "\n" +
    "- Review candidates: " + findings.length + " (not confirmed conflicts).\n" +
    "- Full per-file SHA256/line manifest and candidate details are in this CI job log.\n" +
    "- Independent Codex semantic review and file-level attestation are separate gates.\n");
}
if (!paths.length || findings.some(f => f.kind.startsWith("missing-authority") ||
  f.kind === "missing-human-acceptance-gates")) process.exitCode = 1;
