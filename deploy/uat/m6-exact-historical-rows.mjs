// Compare original SQL JSON member bytes, not rounded JavaScript numbers.
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
function fields(row){
  const raw=row?.__fm03_exact_row_json;
  need(typeof raw==='string','M6_EXACT_HISTORICAL_SQL_REQUIRED');
  let parsed;try{parsed=JSON.parse(raw);}catch{need(false,'M6_EXACT_HISTORICAL_SQL_INVALID');}
  need(parsed&&typeof parsed==='object'&&!Array.isArray(parsed),'M6_EXACT_HISTORICAL_SQL_INVALID');
  const s=raw.trim(),out=new Map();let start=1,depth=0,quoted=false,escaped=false;
  const add=end=>{
    const part=s.slice(start,end).trim();if(!part)return;
    const match=part.match(/^("(?:[^"\\]|\\.)*")\s*:\s*([\s\S]+)$/);
    need(match,'M6_EXACT_HISTORICAL_SQL_INVALID');
    const key=JSON.parse(match[1]);need(!out.has(key),'M6_EXACT_HISTORICAL_SQL_INVALID');
    out.set(key,match[2].trim());
  };
  for(let i=1;i<s.length-1;i++){
    const c=s[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
    else if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;
    else if(c===','&&depth===0){add(i);start=i+1;}
  }
  add(s.length-1);return out;
}
export function verifyExactHistoricalRows(before,after){
  need(before&&after&&typeof before==='object'&&typeof after==='object','M6_EXACT_HISTORICAL_SNAPSHOT_INVALID');
  for(const [table,rows] of Object.entries(before)){
    need(Array.isArray(rows)&&Array.isArray(after[table]),'M6_EXACT_HISTORICAL_TABLE_MISSING');
    if(!rows.length)continue;
    const original=rows.map(fields),successor=after[table].map(fields);
    const columns=[...original[0].keys()].sort();
    const sameColumns=m=>m.size===columns.length&&columns.every(k=>m.has(k));
    need(original.every(sameColumns),'M6_EXACT_HISTORICAL_COLUMN_DRIFT');
    const key=m=>JSON.stringify(columns.map(k=>[k,m.get(k)]));
    const available=new Map();
    for(const m of successor){
      if(!columns.every(k=>m.has(k)))continue;
      const k=key(m);available.set(k,(available.get(k)??0)+1);
    }
    for(const m of original){
      const k=key(m);need((available.get(k)??0)>0,'M6_EXACT_HISTORICAL_ROW_DRIFT');available.set(k,available.get(k)-1);
    }
  }
  return true;
}
