// Actual disposable Chromium FM01-A workflow; zero live API/DB connections.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../apps/web/',import.meta.url));
const require=createRequire(path.join(root,'package.json'));
const {createServer,transformWithOxc}=await import(pathToFileURL(require.resolve('vite')).href);
const chrome=['google-chrome','chromium','chromium-browser'].find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0);
assert.ok(chrome,'Real Chromium required; no SSR fallback');
const temporary=await mkdtemp(path.join(os.tmpdir(),'erp-fm01a-browser-'));
const harness=await readFile(new URL('./material-request-browser-fixture.tsx',import.meta.url),'utf8');
const vite=await createServer({
 root,configFile:false,server:{host:'127.0.0.1',port:0,hmr:false},
 plugins:[{name:'material-request-browser-fixture',
  configureServer(server){server.middlewares.use((req,res,next)=>{
   if(req.url!=='/__material-request')return next();
   res.setHeader('Content-Type','text/html');
   res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__material-request.tsx"></script></body></html>');
  });},
  resolveId(id){if(id==='/__material-request.tsx')return '\0material-request.tsx';},
  async load(id){if(id==='\0material-request.tsx')return transformWithOxc(
    harness,path.join(root,'__material-request.tsx'),{lang:'tsx',jsx:{runtime:'automatic'}});},
 }],
});
try {
 await vite.listen();const address=vite.httpServer.address();
 const url='http://127.0.0.1:'+address.port+'/__material-request';
 const result=await new Promise((resolve,reject)=>{
  const child=spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--no-proxy-server','--user-data-dir='+temporary,'--virtual-time-budget=45000','--dump-dom',url],
  {stdio:['ignore','pipe','pipe']});
  let out='',err='';
  child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);
  const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Weekly browser timed out'));},60000);
  child.on('error',error=>{clearTimeout(timeout);reject(error);});
  child.on('close',code=>{clearTimeout(timeout);resolve({code,out,err});});
 });
 assert.equal(result.code,0,result.err.slice(-2000));
 assert.match(result.out,/data-result="PASS"/,(result.out.match(/data-error="[^"]*"/)??[result.out.slice(-4000)])[0]);
 console.log('MATERIAL_REQUEST_BROWSER_PASS — real Chromium, synthetic transport: capture/lost response, linked partial issue, explicit receipt, three locales, stale version and denied cache; no live API/DB');
} finally {await vite.close();await rm(temporary,{recursive:true,force:true});}
