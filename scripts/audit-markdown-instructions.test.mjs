import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname,resolve} from "node:path";
import {execFileSync} from "node:child_process";
const script=resolve(import.meta.dirname,"audit-markdown-instructions.mjs");
const docs=[
 "AGENTS.md","docs/PROJECT-GOVERNANCE.md","docs/DECISION-LOG.md",
 "docs/DEVELOPMENT-OPERATING-MODEL.md","docs/REQUIREMENTS.md",
 "docs/CURRENT-STATE.md","docs/DEVELOPMENT-ROADMAP.md",
 "docs/TESTING-UAT.md","docs/V1.1-SCOPE.md",
 "docs/V1.1-ACCEPTANCE-CRITERIA.md","docs/V1.1-E2-UAT-EXECUTION.md"
];
function git(dir, args) {
 return execFileSync("git",args,{cwd:dir,encoding:"utf8"});
}
test("covers every tracked Markdown file and line, with hashes and review leads",()=>{
 const dir=mkdtempSync(join(tmpdir(),"erp-markdown-audit-"));
 try {
  git(dir,["init","-q"]);
  git(dir,["config","user.name","Audit Test"]);
  git(dir,["config","user.email","audit@example.invalid"]);
  for (const p of docs) {
   const file=join(dir,p);mkdirSync(dirname(file),{recursive:true});
   let src="# "+p+"\nAn active process must not duplicate approval rules across owners.\n";
   if(p==="docs/CURRENT-STATE.md")src+="V1.1 release NOT accepted.\n";
   if(p==="docs/V1.1-E2-UAT-EXECUTION.md")src+="AC-V11-029 and AC-V11-030 remain human gates.\n";
   if(p==="AGENTS.md")src+="[missing link](docs/no-such-file.md)\n";
   writeFileSync(file,src);
  }
  writeFileSync(join(dir,"not-markdown.txt"),"excluded\n");
  git(dir,["add","."]);git(dir,["commit","-qm","audit fixture"]);
  const out=execFileSync(process.execPath,[script,"--full"],{cwd:dir,encoding:"utf8"});
  const parsed=JSON.parse(out);
  assert.equal(parsed.files,docs.length);
  assert.equal(parsed.lines,parsed.manifest.reduce((n,r)=>n+r.lines,0));
  assert.equal(parsed.manifest.length,docs.length);
  assert.ok(parsed.manifest.every(x=>x.sha256.length===64));
  assert.equal(parsed.findings.filter(x=>x.kind==="missing-relative-link").length,1);
  assert.ok(parsed.inventoryDigest.length===64);
 }finally{rmSync(dir,{recursive:true,force:true});}
});