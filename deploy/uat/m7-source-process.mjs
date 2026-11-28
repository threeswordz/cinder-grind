// Final M6 source is offline; the retained M4 API/web remain owned and running.
const need=(ok)=>{if(!ok)throw Error('M7_SOURCE_PROCESS_CUSTODY');};
const pid=v=>Number.isSafeInteger(v)&&v>1;
const born=v=>typeof v==='string'&&v.length>0&&v.length<=128&&v.trim()===v&&!/[\r\n\0]/.test(v);
export const protectedM7Ports=Object.freeze([33071,33072,44171,44172]);
export const m7RestorePortAllowed=p=>Number.isInteger(p)&&p>1023&&p<=65535&&!protectedM7Ports.includes(p)&&!(p>=55471&&p<=55479);
export function sourceProcessTuple(s){
  need(s?.mode==='quiescent'&&s.apiPort===33072&&s.webPort===44172&&s.apiOffline===true&&s.webOffline===true&&s.retainedApi?.port===33071&&s.retainedWeb?.port===44171&&pid(s.retainedApi.pid)&&pid(s.retainedWeb.pid)&&s.retainedApi.pid!==s.retainedWeb.pid&&born(s.retainedApi.born)&&born(s.retainedWeb.born)&&!Object.hasOwn(s,'pid'));
  return ['quiescent',33072,44172,true,true,[33071,s.retainedApi.pid,s.retainedApi.born],[44171,s.retainedWeb.pid,s.retainedWeb.born]];
}
export function sameSourceProcess(a,b){
  try{return JSON.stringify(sourceProcessTuple(a))===JSON.stringify(sourceProcessTuple(b));}catch{return false;}
}
export function quiescentSourceProcess(retained){
  const s={mode:'quiescent',apiPort:33072,webPort:44172,apiOffline:true,webOffline:true,retainedApi:{port:retained?.api?.port,pid:retained?.api?.pid,born:retained?.api?.born},retainedWeb:{port:retained?.web?.port,pid:retained?.web?.pid,born:retained?.web?.born}};
  sourceProcessTuple(s);return s;
}
export function isolatedM7Process(s,p,port){
  sourceProcessTuple(s);
  return pid(p)&&p!==s.retainedApi.pid&&p!==s.retainedWeb.pid&&m7RestorePortAllowed(port);
}
