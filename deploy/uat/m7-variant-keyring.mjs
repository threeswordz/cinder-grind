// Create negative-key configurations only in an independently claimed restored target.
import {randomBytes,createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,mkdir,open,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {normalizeInventory} from './m6-backup-receipts.mjs';
const need=(ok,c)=>{if(!ok)throw Error('M7_VARIANT_KEY_'+c);};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const bytesHash=x=>createHash('sha256').update(x).digest('hex');
const validKey=x=>typeof x==='string'&&/^[A-Za-z0-9+/]{43}=$/.test(x)&&Buffer.from(x,'base64').toString('base64')===x;
const dirId=async p=>{const s=await lstat(p);need(s.isDirectory()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(p)===p,'DIRECTORY');return [s.dev,s.ino,s.uid,s.mode];};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function readKey(p){const s=await lstat(p);need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=4096&&await realpath(p)===p,'FILE');const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const a=await f.stat();need(a.dev===s.dev&&a.ino===s.ino&&a.ctimeMs===s.ctimeMs,'FILE_DRIFT');const bytes=await f.readFile();try{const t=await f.stat();need(t.ctimeMs===s.ctimeMs&&t.size===s.size&&bytes.length===s.size,'FILE_DRIFT');const k=JSON.parse(bytes.toString('utf8'));need(Object.keys(k).length===1&&validKey(k.proto1),'ORIGINAL_KEY');return k.proto1;}finally{bytes.fill(0);}}finally{await f.close();}}
export async function prepareM7VariantKeyring({claim,binding,mode,inventory}){
 const p=claim?.plan,c=binding?.capture();need(['missing','wrong'].includes(mode)&&/^m7_restore_[a-f0-9]{12}$/.test(p?.database??'')&&p.role===p.database.replace('m7_restore_','m7_restore_role_')&&p.sha===c?.sha&&p.tree===c.tree&&typeof p.root==='string'&&resolve(p.root)===p.root&&p.storage?.hrkeys===join(p.root,'hrkeys')&&typeof inventory==='function'&&typeof claim.verifyPaths==='function'&&typeof binding.reverify==='function','CONTEXT');
 await claim.verifyPaths();await binding.reverify();const rootId=await dirId(p.root),originalId=await dirId(p.storage.hrkeys);
 const original=async()=>{need(same(rootId,await dirId(p.root))&&same(originalId,await dirId(p.storage.hrkeys))&&hash(normalizeInventory(await inventory(p.storage.hrkeys),false))===c.hrkeysSha,'ORIGINAL_DRIFT');};
 await original();const sourceKey=await readKey(join(p.storage.hrkeys,'keyring.json'));const key=randomBytes(32).toString('base64');need(key!==sourceKey,'KEY_ALIAS');const keyRoot=join(p.root,'hrkeys-'+mode);await mkdir(keyRoot,{mode:0o700});const id=await dirId(keyRoot);
 const bytes=Buffer.from(JSON.stringify({[mode==='missing'?'m7missing':'proto1']:key})+'\n');const expectedInventory=[['','directory'],['keyring.json',bytes.length,bytesHash(bytes)]];try{const f=await open(join(keyRoot,'keyring.json'),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}}finally{bytes.fill(0);}
 const expectedKeySha=hash(expectedInventory);need(expectedKeySha!==c.hrkeysSha,'KEY_ALIAS');const verifyPaths=async()=>{await claim.verifyPaths();await original();need(same(id,await dirId(keyRoot))&&same(expectedInventory,normalizeInventory(await inventory(keyRoot),false)),'VARIANT_DRIFT');};await verifyPaths();await binding.reverify();
 const plan=Object.freeze({...p,storage:Object.freeze({...p.storage,hrkeys:keyRoot})});return Object.freeze({claim:Object.freeze({plan,verifyPaths}),expectedKeySha});
}
