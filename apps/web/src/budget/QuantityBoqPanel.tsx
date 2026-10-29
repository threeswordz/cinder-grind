import {useEffect,useRef,useState} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import {Alert,Button,Card,CardContent,MenuItem,Stack,TextField,Typography} from '@mui/material';
import {apiRequest} from '../api/client';
import {useBoqText} from './boq-i18n';
import {useBudgetPrintSnapshot} from './budget-print';

type QuantityLine={id:string;itemCode:string;description:string;quantity:string;wbsId?:string;uomCode?:string;uom?:{uomCode:string};sectionCode?:string;section?:{sectionCode:string}};
type QuantityBoq={id:string;boqName:string;items:QuantityLine[]};
type QuantityRevision={id:string;revisionNumber:string;lifecycleState:string;isOriginal:boolean;isCurrent:boolean;lines?:QuantityLine[]};
const root='/budget/quantity';
export function QuantityBoqPanel({initialProjectId,initialRevisionId,initialWbsId}:{initialProjectId?:string|undefined;initialRevisionId?:string|undefined;initialWbsId?:string|undefined}={}){
  const t=useBoqText();const [project,setProject]=useState(''),[revision,setRevision]=useState('');
  const [printRows,setPrintRows,printSnapshot]=useBudgetPrintSnapshot<QuantityLine[]>();
  const projects=useQuery({queryKey:['quantity-boq','projects'],queryFn:()=>apiRequest<{data:{id:string;projectCode:string;projectName:string}[]}>(root+'/projects')});
  const working=useQuery({queryKey:['quantity-boq','working',project],queryFn:()=>apiRequest<{data:QuantityBoq|null}>(root+'/projects/'+project+'/boq'),enabled:Boolean(project)});
  const revisions=useQuery({queryKey:['quantity-boq','revisions',project],queryFn:()=>apiRequest<{data:QuantityRevision[]}>(root+'/projects/'+project+'/revisions'),enabled:Boolean(project)});
  const selected=useQuery({queryKey:['quantity-boq','revision',project,revision],queryFn:()=>apiRequest<{data:QuantityRevision}>(root+'/projects/'+project+'/revisions/'+revision),enabled:Boolean(project&&revision)});
  const applied=useRef('');
  const [wbs,setWbs]=useState('');
  const context=useRef('');context.current=JSON.stringify([project,revision,wbs]);
  useEffect(()=>{
    if(!projects.isSuccess||projects.isFetching||!initialProjectId)return;
    const key=JSON.stringify([initialProjectId,initialRevisionId,initialWbsId]);if(applied.current===key)return;
    if(!projects.data.data.some(p=>p.id===initialProjectId)){applied.current=key;return;}
    setProject(initialProjectId);setPrintRows(null);setWbs(initialWbsId??'');
    if(initialRevisionId){
      if(project!==initialProjectId||!revisions.isSuccess||revisions.isFetching)return;
      setRevision(revisions.data.data.some(r=>r.id===initialRevisionId)?initialRevisionId:'');
    }else setRevision('');
    applied.current=key;
  },[initialProjectId,initialRevisionId,initialWbsId,projects.isSuccess,projects.isFetching,projects.data,project,revisions.isSuccess,revisions.isFetching,revisions.data]);
  const fresh=useMutation({mutationFn:async()=>{
    const requested=context.current;
    // Re-authorize before browser print rather than printing a stale cache entry.
    const path=root+'/projects/'+project+(revision?'/revisions/'+revision:'/boq');
    const response=await apiRequest<{data:{items?:QuantityLine[];lines?:QuantityLine[]}|null}>(path);
    return {requested,rows:(response.data?.lines??response.data?.items??[]).filter(l=>!wbs||l.wbsId===wbs)};
  },onSuccess:({requested,rows})=>printSnapshot(rows,()=>context.current===requested)});
  const rows=(revision?(selected.data?.data.lines??[]):(working.data?.data?.items??[])).filter(l=>!wbs||l.wbsId===wbs);
  return <Card data-testid="quantity-boq-workspace" variant="outlined"><CardContent><Stack spacing={2}>
    <Typography variant="h6">{t('quantityOnly')}</Typography><Alert severity="info">{t('quantityInfo')}</Alert>
    {projects.isError||working.isError||revisions.isError||selected.isError||fresh.isError?<Alert severity="error">{t('error')}</Alert>:null}
    <TextField select label={t('project')} value={project} onChange={e=>{setProject(e.target.value);setRevision('');setWbs('');setPrintRows(null);}}><MenuItem value="">—</MenuItem>{projects.data?.data.map(p=><MenuItem key={p.id} value={p.id}>{p.projectCode} · {p.projectName}</MenuItem>)}</TextField>
    {wbs?<Button onClick={()=>{setWbs('');setPrintRows(null);}}>{t('wholeProject')}</Button>:null}
    {project?<><TextField select label={t('revisions')} value={revision} onChange={e=>{setRevision(e.target.value);setPrintRows(null);}}><MenuItem value="">{t('working')}</MenuItem>{revisions.data?.data.map(r=><MenuItem key={r.id} value={r.id}>{r.revisionNumber} · {r.lifecycleState}{r.isOriginal?' · '+t('original'):''}{r.isCurrent?' · '+t('current'):''}</MenuItem>)}</TextField>
      <table aria-label={t('quantityOnly')}><thead><tr><th>{t('description')}</th><th>{t('quantity')}</th><th>{t('uom')}</th></tr></thead><tbody>{rows.map(l=><tr key={l.id}><td>{l.itemCode} · {l.description}</td><td>{l.quantity}</td><td>{l.uomCode??l.uom?.uomCode}</td></tr>)}</tbody></table>
      {rows.length===0?<Typography>{t('empty')}</Typography>:null}<Button disabled={fresh.isPending} onClick={()=>fresh.mutate()}>{t('print')}</Button>
    </>:null}
    {printRows?<section id="quantity-boq-print" style={{display:'none'}}><style>{'@media print{body *{visibility:hidden!important}#quantity-boq-print,#quantity-boq-print *{visibility:visible!important}#quantity-boq-print{display:block!important;position:absolute;inset:0;background:white;color:black}#quantity-boq-print td,#quantity-boq-print th{padding:6px;border:1px solid black}}'}</style><h1>{t('quantityOnly')}</h1><p>{t('quantityInfo')}</p><table><thead><tr><th>{t('description')}</th><th>{t('quantity')}</th><th>{t('uom')}</th></tr></thead><tbody>{printRows.map(l=><tr key={l.id}><td>{l.itemCode} · {l.description}</td><td>{l.quantity}</td><td>{l.uomCode??l.uom?.uomCode}</td></tr>)}</tbody></table></section>:null}
  </Stack></CardContent></Card>;
}
