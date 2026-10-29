import {useEffect,useRef,useState} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import {Alert,Button,Card,CardContent,MenuItem,Stack,TextField,Typography} from '@mui/material';
import {apiDownload,apiRequest} from '../api/client';
import {saveBlob} from './CustomerBoqPanel';
import {useBoqText} from './boq-i18n';
import {useBudgetPrintSnapshot} from './budget-print';

type Summary={project:{id:string;projectCode:string;projectName:string};currencyCode:string;contractAmount:string;billedAmount:string;receivedAmount:string};
const root='/budget/summary/projects';
export function ProjectSummaryPanel(){
  const t=useBoqText(),[project,setProject]=useState('');
  const [printed,setPrinted,printSnapshot]=useBudgetPrintSnapshot<Summary>();
  const current=useRef(project),mounted=useRef(true);current.current=project;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const projects=useQuery({queryKey:['project-summary','projects'],queryFn:()=>apiRequest<{data:Summary['project'][]}>(root)});
  const summary=useQuery({queryKey:['project-summary',project],queryFn:()=>apiRequest<{data:Summary}>(root+'/'+project),enabled:Boolean(project)});
  const print=useMutation({mutationFn:async(p:string)=>({p,value:(await apiRequest<{data:Summary}>(root+'/'+p)).data}),onSuccess:({p,value})=>{
    printSnapshot(value,()=>current.current===p);
  }});
  const download=useMutation({mutationFn:async(p:string)=>({p,blob:(await apiDownload(root+'/'+p+'/export')).blob}),onSuccess:({p,blob})=>{if(mounted.current&&current.current===p)saveBlob(blob,'project-summary.csv');}});
  const unavailable=summary.isError||print.isError||download.isError;
  useEffect(()=>{if(unavailable)setPrinted(null);},[unavailable]);
  const rows=(s:Summary)=><table aria-label={t('projectSummary')}><tbody>
    <tr><th>{t('contractTotal')}</th><td>{s.currencyCode} {s.contractAmount}</td></tr>
    <tr><th>{t('billedTotal')}</th><td>{s.currencyCode} {s.billedAmount}</td></tr>
    <tr><th>{t('receivedTotal')}</th><td>{s.currencyCode} {s.receivedAmount}</td></tr>
  </tbody></table>;
  return <Card data-testid="project-summary-workspace" variant="outlined"><CardContent><Stack spacing={2}>
    <Typography variant="h6">{t('projectSummary')}</Typography><Alert severity="info">{t('summaryMeaning')}</Alert>
    <Typography>{t('summaryInference')}</Typography>
    {projects.isError||summary.isError||print.isError||download.isError?<Alert severity="error">{t('summaryError')}</Alert>:null}
    <TextField select label={t('project')} value={project} onChange={e=>{setProject(e.target.value);setPrinted(null);print.reset();download.reset();}}><MenuItem value="">—</MenuItem>{projects.data?.data.map(p=><MenuItem key={p.id} value={p.id}>{p.projectCode} · {p.projectName}</MenuItem>)}</TextField>
    {project?<Button onClick={()=>{print.reset();download.reset();void summary.refetch();}}>{t('refresh')}</Button>:null}
    {summary.isFetching?<Typography>{t('loading')}</Typography>:!unavailable&&summary.data&&project?<>
      {rows(summary.data.data)}<Stack direction="row" spacing={1}>
        <Button disabled={print.isPending} onClick={()=>print.mutate(project)}>{t('print')}</Button>
        <Button disabled={download.isPending} onClick={()=>download.mutate(project)}>{t('export')}</Button>
      </Stack></>:null}
    {printed&&!unavailable?<section id="project-summary-print" style={{display:'none'}}><style>{'@media print{body *{visibility:hidden!important}#project-summary-print,#project-summary-print *{visibility:visible!important}#project-summary-print{display:block!important;position:absolute;inset:0;background:white;color:black}#project-summary-print td,#project-summary-print th{padding:6px;border:1px solid black}}'}</style>
      <h1>{t('projectSummary')}</h1><p>{printed.project.projectCode} · {printed.project.projectName}</p>{rows(printed)}<p>{t('summaryMeaning')}</p>
    </section>:null}
  </Stack></CardContent></Card>;
}
