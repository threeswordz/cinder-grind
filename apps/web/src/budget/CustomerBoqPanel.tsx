import {useEffect,useMemo,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Alert,Button,Card,CardContent,Chip,Divider,MenuItem,Stack,TextField,Typography} from '@mui/material';
import {customerBoqApi,CustomerDraft,CustomerHistory,CustomerLineInput} from '../api/customer-boq';
import {documentsApi} from '../api/documents';
import {ApiError} from '../api/client';
import {useBoqText,BoqTextKey} from './boq-i18n';

const newLine=():CustomerLineInput=>({lineId:crypto.randomUUID(),description:'',quantity:'1',uomId:'',method:'MANUAL',manualRate:'',mappings:[{sourceLineId:'',sharePercent:'100'}]});
export function saveBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
export function CustomerBoqPanel({permissions}:{permissions:string[]}){
  const t=useBoqText();const [project,setProject]=useState('');
  const projects=useQuery({queryKey:['customer-boq','projects'],queryFn:customerBoqApi.projects});
  return <Card data-testid="customer-boq-workspace" variant="outlined"><CardContent><Stack spacing={2}>
    <Typography variant="h6">{t('customer')}</Typography>
    {projects.isError?<Alert severity="error">{t('error')}</Alert>:null}
    <TextField select label={t('project')} value={project} onChange={e=>setProject(e.target.value)}><MenuItem value="">—</MenuItem>{projects.data?.data.map(p=><MenuItem key={p.id} value={p.id}>{p.projectCode} · {p.projectName}</MenuItem>)}</TextField>
    {project?<CustomerProject key={project} projectId={project} permissions={permissions}/>:null}
  </Stack></CardContent></Card>;
}
function CustomerProject({projectId,permissions}:{projectId:string;permissions:string[]}){
  const t=useBoqText(),cache=useQueryClient();
  const canManage=permissions.includes('budget.customer.manage'),canSubmit=permissions.includes('budget.customer.submit'),canApprove=permissions.includes('budget.customer.approve');
  const [id,setId]=useState(''),[sourceId,setSourceId]=useState(''),[previous,setPrevious]=useState<string|undefined>(),[reason,setReason]=useState('');
  const [lines,setLines]=useState<CustomerLineInput[]>([newLine()]),[workflow,setWorkflow]=useState(''),[note,setNote]=useState('');
  const [baseline,setBaseline]=useState(''),[hydrated,setHydrated]=useState('');
  const [editNo,setEditNo]=useState(1),[printData,setPrintData]=useState<CustomerHistory|null>(null),[historyEdit,setHistoryEdit]=useState(0);
  const options=useQuery({queryKey:['customer-boq','options',projectId],queryFn:()=>customerBoqApi.options(projectId)});
  const versions=useQuery({queryKey:['customer-boq','versions',projectId],queryFn:()=>customerBoqApi.list(projectId)});
  const history=useQuery({queryKey:['customer-boq','history',projectId,id],queryFn:()=>customerBoqApi.history(projectId,id),enabled:Boolean(id)});
  const v=history.data?.data.version;
  const state=v?.approvalInstance?.approvalState??'DRAFT';
  const loaded=!id||(v?.id===id&&!history.isFetching&&hydrated===v.id+':'+v.currentEditNo);
  const editable=canManage&&loaded&&(!id||history.data?.data.allowedActions.edit===true);
  const edit=v?.edits.find(e=>e.editNo===v.currentEditNo);
  useEffect(()=>{if(!v||!edit)return;setSourceId(v.sourceRevisionId);setPrevious(v.previousVersionId??undefined);setEditNo(v.currentEditNo);setReason(edit.reason);
    const loadedLines:CustomerLineInput[]=edit.lines.map(l=>({lineId:l.lineKey,description:l.description,quantity:l.quantity,uomId:l.uomId,method:l.pricingSnapshot.method,
      ...(l.pricingSnapshot.method==='MANUAL'?{manualRate:l.rate}:{markupPercent:l.pricingSnapshot.markupPercent??'0'}),
      ...(l.pricingSnapshot.mappingReason?{mappingReason:l.pricingSnapshot.mappingReason}:{}),
      ...(l.pricingSnapshot.pricingReason?{pricingReason:l.pricingSnapshot.pricingReason}:{}),
      ...(l.pricingSnapshot.zeroPriceReason?{zeroPriceReason:l.pricingSnapshot.zeroPriceReason}:{}),
      mappings:l.mappings.map(m=>({sourceLineId:m.sourceLineId,sharePercent:m.sharePercent}))}));
    setHydrated(v.id+':'+v.currentEditNo);setLines(loadedLines);setBaseline(JSON.stringify({sourceRevisionId:v.sourceRevisionId,reason:edit.reason,lines:loadedLines,...(v.previousVersionId?{previousVersionId:v.previousVersionId}:{})}));setHistoryEdit(v.currentEditNo);
  },[v,edit]);
  const draft:CustomerDraft={sourceRevisionId:sourceId,reason,lines,...(previous?{previousVersionId:previous}:{})};
  const serialized=JSON.stringify(draft);
  const requestId=useMemo(()=>crypto.randomUUID(),[serialized,id,editNo]);
  const submitId=useMemo(()=>crypto.randomUUID(),[id,editNo,workflow]);
  const approveId=useMemo(()=>crypto.randomUUID(),[id,v?.approvalInstanceId,note]);
  const rejectId=useMemo(()=>crypto.randomUUID(),[id,v?.approvalInstanceId,note]);
  const refresh=async()=>{await cache.invalidateQueries({queryKey:['customer-boq']});};
  const preview=useMutation({mutationFn:async()=>({payload:id+'|'+serialized,response:await customerBoqApi.preview(projectId,draft,id||undefined)})});
  const validPreview=preview.data?.payload===id+'|'+serialized?preview.data.response.data:undefined;
  const dirty=Boolean(id)&&serialized!==baseline;
  const save=useMutation({mutationFn:()=>customerBoqApi.save(projectId,requestId,draft,id||undefined,id?editNo:undefined),onSuccess:async r=>{setId(r.data.id);preview.reset();await refresh();}});
  const submit=useMutation({mutationFn:()=>customerBoqApi.submit(projectId,id,submitId,editNo,workflow),onSuccess:refresh});
  const approve=useMutation({mutationFn:()=>customerBoqApi.decide(projectId,id,approveId,v!.approvalInstanceId!,'APPROVE',note),onSuccess:refresh});
  const reject=useMutation({mutationFn:()=>customerBoqApi.decide(projectId,id,rejectId,v!.approvalInstanceId!,'REJECT',note),onSuccess:refresh});
  const exportCsv=useMutation({mutationFn:()=>customerBoqApi.export(projectId,id),onSuccess:r=>saveBlob(r.blob,r.fileName??'customer-boq.csv')});
  const print=useMutation({mutationFn:()=>customerBoqApi.history(projectId,id),onSuccess:r=>{setPrintData(r.data);requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));}});
  const failure=[options.error,versions.error,history.error,preview.error,save.error,submit.error,approve.error,reject.error,exportCsv.error,print.error].find(Boolean);
  function patch(index:number,value:Partial<CustomerLineInput>){setLines(old=>old.map((l,i)=>i===index?{...l,...value}:l));preview.reset();}
  function reset(){setId('');setSourceId('');setPrevious(undefined);setReason('');setLines([newLine()]);setEditNo(1);setBaseline('');setPrintData(null);preview.reset();save.reset();}
  const source=options.data?.data.sources.find(s=>s.id===sourceId);
  const selectedHistorical=v?.edits.find(e=>e.editNo===historyEdit);
  // A pricing preview is valid only for its exact input payload; edits clear it.
  return <Stack spacing={2}>
    {failure?<Alert severity="error">{t('error')} {failure instanceof ApiError?failure.code:''}</Alert>:null}
    {history.isFetching?<Typography>{t('loading')}</Typography>:null}
    <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
      <TextField select fullWidth label={t('version')} value={id} onChange={e=>{if(!e.target.value){reset();return;}setId(e.target.value);setPrintData(null);preview.reset();}}><MenuItem value="">{t('newDraft')}</MenuItem>{versions.data?.data.map(r=><MenuItem key={r.id} value={r.id}>#{r.versionNo} · {r.approvalState} · {r.currencyCode} {r.totalAmount}</MenuItem>)}</TextField>
      {canManage?<Button onClick={reset}>{t('newDraft')}</Button>:null}<Button onClick={()=>void refresh()}>{t('refresh')}</Button>
    </Stack>
    {id&&v?<><Chip label={state}/><Stack direction="row" spacing={1}><Button disabled={print.isPending} onClick={()=>print.mutate()}>{t('print')}</Button><Button disabled={exportCsv.isPending} onClick={()=>exportCsv.mutate()}>{t('export')}</Button>
      {canManage&&state==='APPROVED'?<Button onClick={()=>{const parent=v.id;setId('');setPrevious(parent);setReason('');setEditNo(1);preview.reset();setPrintData(null);}}>{t('newRevision')}</Button>:null}</Stack></>:null}
    {editable?<>
      <Alert severity="info">{t('rules')}</Alert>
      <TextField select label={t('source')} value={sourceId} disabled={Boolean(id)} onChange={e=>{setSourceId(e.target.value);setLines([newLine()]);preview.reset();}}><MenuItem value="">—</MenuItem>{options.data?.data.sources.map(s=><MenuItem key={s.id} value={s.id}>{s.revisionNumber}</MenuItem>)}</TextField>
      {!options.isPending&&!options.data?.data.sources.length?<Alert severity="info">{t('noSource')}</Alert>:null}
      {previous?<Typography>{t('version')}: {previous}</Typography>:null}
      <TextField label={t('reason')} required value={reason} onChange={e=>{setReason(e.target.value);preview.reset();}}/>
      {lines.map((line,index)=><Card key={line.lineId} variant="outlined"><CardContent><Stack spacing={1}>
        <TextField label={t('description')} value={line.description} onChange={e=>patch(index,{description:e.target.value})}/>
        <Stack direction={{xs:'column',md:'row'}} spacing={1}>
          <TextField label={t('quantity')} value={line.quantity} onChange={e=>patch(index,{quantity:e.target.value})} inputProps={{inputMode:'decimal'}}/>
          <TextField select label={t('uom')} value={line.uomId} onChange={e=>patch(index,{uomId:e.target.value})} sx={{minWidth:130}}><MenuItem value="">—</MenuItem>{options.data?.data.uoms.map(u=><MenuItem key={u.id} value={u.id}>{u.uomCode} · {u.decimalPlaces}</MenuItem>)}</TextField>
          <TextField select label={t('method')} value={line.method} onChange={e=>{const method=e.target.value as 'MANUAL'|'MARKUP';const next={...line,method};delete next.manualRate;delete next.markupPercent;if(method==='MANUAL')next.manualRate='';else next.markupPercent='0';setLines(old=>old.map((l,i)=>i===index?next:l));preview.reset();}} sx={{minWidth:160}}><MenuItem value="MANUAL">{t('manual')}</MenuItem><MenuItem value="MARKUP">{t('markup')}</MenuItem></TextField>
          {line.method==='MANUAL'?<TextField label={t('manual')} value={line.manualRate??''} onChange={e=>patch(index,{manualRate:e.target.value})}/>:<TextField label={t('markup')} value={line.markupPercent??''} onChange={e=>patch(index,{markupPercent:e.target.value})}/>}
        </Stack>
        {line.mappings.map((m,mi)=><Stack key={mi} direction={{xs:'column',md:'row'}} spacing={1}>
          <TextField select fullWidth label={t('sourceLine')} value={m.sourceLineId} onChange={e=>patch(index,{mappings:line.mappings.map((x,i)=>i===mi?{...x,sourceLineId:e.target.value}:x)})}><MenuItem value="">—</MenuItem>{source?.lines.map(l=><MenuItem key={l.id} value={l.id}>{l.itemCode} · {l.description} · {l.quantity} {l.uomCode} · THB {l.amount}</MenuItem>)}</TextField>
          <TextField label={t('share')} value={m.sharePercent} onChange={e=>patch(index,{mappings:line.mappings.map((x,i)=>i===mi?{...x,sharePercent:e.target.value}:x)})}/>
          <Button disabled={line.mappings.length===1} onClick={()=>patch(index,{mappings:line.mappings.filter((_,i)=>i!==mi)})}>{t('remove')}</Button>
        </Stack>)}
        <Button onClick={()=>patch(index,{mappings:[...line.mappings,{sourceLineId:'',sharePercent:'100'}]})}>{t('addMapping')}</Button>
        <TextField label={t('mappingReason')} value={line.mappingReason??''} onChange={e=>{const next={...line};if(e.target.value)next.mappingReason=e.target.value;else delete next.mappingReason;setLines(old=>old.map((l,i)=>i===index?next:l));preview.reset();}}/>
        <TextField label={t('zeroReason')} value={line.zeroPriceReason??''} onChange={e=>{const next={...line};if(e.target.value)next.zeroPriceReason=e.target.value;else delete next.zeroPriceReason;setLines(old=>old.map((l,i)=>i===index?next:l));preview.reset();}}/>
        <TextField label={t('priceReason')} value={line.pricingReason??''} onChange={e=>{const next={...line};if(e.target.value)next.pricingReason=e.target.value;else delete next.pricingReason;setLines(old=>old.map((l,i)=>i===index?next:l));preview.reset();}}/>
        <Button disabled={lines.length===1} onClick={()=>{setLines(old=>old.filter((_,i)=>i!==index));preview.reset();}}>{t('remove')}</Button>
      </Stack></CardContent></Card>)}
      <Stack direction="row" spacing={1}><Button onClick={()=>{setLines(old=>[...old,newLine()]);preview.reset();}}>{t('addLine')}</Button>
        <Button disabled={!sourceId||!reason.trim()||preview.isPending} onClick={()=>preview.mutate()}>{t('preview')}</Button>
        <Button variant="contained" disabled={!sourceId||!reason.trim()||save.isPending} onClick={()=>save.mutate()}>{t('save')}</Button></Stack>
      {validPreview?<Stack spacing={1}><Alert severity="info">{t('rounding')}</Alert>
        {validPreview.lines.map((l,i)=><Typography key={l.lineId}>{lines[i]?.description} · {t('basis')}: {l.costBasis} · {t('rate')}: THB {l.rate} · {t('amount')}: THB {l.amount} {l.targetAmount!==null?<> · {t('target')}: THB {l.targetAmount} · {t('difference')}: THB {l.rateRoundingDifference}</>:null}</Typography>)}
        <Typography>{t('total')}: THB {validPreview.totalAmount}</Typography>{validPreview.sourceCoverage.map(c=><Typography key={c.sourceLineId}>{c.sourceLineId} · {t('unused')}: {c.unallocatedPercent}</Typography>)}
      </Stack>:null}
    </>:null}
    {id&&loaded&&canSubmit&&history.data?.data.allowedActions.submit?<Stack spacing={1}>
      {dirty?<Alert severity="info">{t('unsaved')}</Alert>:null}
      <TextField select label={t('workflow')} value={workflow} onChange={e=>setWorkflow(e.target.value)}><MenuItem value="">—</MenuItem>{options.data?.data.workflows.map(w=><MenuItem key={w.workflowCode} value={w.workflowCode}>{w.workflowName}</MenuItem>)}</TextField>
      <Button variant="contained" disabled={!workflow||submit.isPending||save.isPending||dirty||!loaded} onClick={()=>submit.mutate()}>{t('submit')}</Button>
    </Stack>:null}
    {id&&loaded&&canApprove&&history.data?.data.allowedActions.decide?<Stack spacing={1}><TextField label={t('note')} value={note} onChange={e=>setNote(e.target.value)}/><Stack direction="row" spacing={1}>
      <Button disabled={approve.isPending||reject.isPending} onClick={()=>approve.mutate()}>{t('approve')}</Button><Button disabled={approve.isPending||reject.isPending} onClick={()=>reject.mutate()}>{t('reject')}</Button></Stack></Stack>:null}
    {id&&v?<><Divider/><Typography variant="h6">{t('history')}</Typography><TextField select label={t('edit')} value={historyEdit} onChange={e=>setHistoryEdit(Number(e.target.value))}>{v.edits.map(e=><MenuItem key={e.id} value={e.editNo}>#{e.editNo} · {e.createdAt} · {e.reason}</MenuItem>)}</TextField>
      {selectedHistorical?.lines.some(l=>l.pricingSnapshot.targetAmount!==null)?<Alert severity="info">{t('rounding')}</Alert>:null}
      {selectedHistorical?.lines.map(l=><Typography key={l.id}>{l.description} · {l.quantity} {l.uomSnapshot.code} · THB {l.rate} · THB {l.amount}{l.pricingSnapshot.targetAmount!==null?<> · {t('target')}: THB {l.pricingSnapshot.targetAmount} · {t('difference')}: THB {l.pricingSnapshot.rateRoundingDifference}</>:null}</Typography>)}<Typography>{t('total')}: {v.currencyCode} {selectedHistorical?.totalAmount}</Typography>
      {history.data?.data.approvals.map(a=><Stack key={a.id}><Typography>{a.approvalState} · {a.startedAt}</Typography>{a.actions.map(x=><Typography key={x.id}>{x.action} · {x.actionAt} · {x.actionByUserId} · {x.comment}</Typography>)}</Stack>)}
      <CustomerAttachments key={id} projectId={projectId} versionId={id} permissions={permissions}/>
    </>:null}
    {printData?<CustomerPrint data={printData}/>:null}
  </Stack>;
}
export function CustomerPrint({data}:{data:CustomerHistory}){
  const t=useBoqText(),v=data.version,e=v.edits.find(e=>e.editNo===v.currentEditNo)!;
  return <section id="customer-boq-print" aria-label={t('customer')} style={{display:'none'}}>
    <style>{'@media print {body *{visibility:hidden!important} #customer-boq-print,#customer-boq-print *{visibility:visible!important} #customer-boq-print{display:block!important;position:absolute;inset:0;background:white;color:black} #customer-boq-print table{width:100%;border-collapse:collapse} #customer-boq-print td,#customer-boq-print th{border:1px solid black;padding:6px}}'}</style>
    <h1>{t('customer')} #{v.versionNo}</h1><p>{t('state')}: {v.approvalInstance?.approvalState??'DRAFT'} · {t('edit')} {e.editNo} · {t('source')}: {v.sourceRevisionId}</p>
    <table><thead><tr>{['description','quantity','uom','rate','amount'].map(k=><th key={k}>{t(k as BoqTextKey)}</th>)}</tr></thead><tbody>{e.lines.map(l=><tr key={l.id}><td>{l.description}</td><td>{l.quantity}</td><td>{l.uomSnapshot.code}</td><td>{v.currencyCode} {l.rate}</td><td>{v.currencyCode} {l.amount}</td></tr>)}</tbody></table><p>{t('total')}: {v.currencyCode} {e.totalAmount}</p>
  </section>;
}
function CustomerAttachments({projectId,versionId,permissions}:{projectId:string;versionId:string;permissions:string[]}){
  const t=useBoqText(),cache=useQueryClient();const [type,setType]=useState(''),[file,setFile]=useState<File|null>(null);
  const canRead=permissions.includes('documents.document.view'),canUpload=permissions.includes('documents.document.upload')&&permissions.includes('documents.document.link')&&canRead;
  const rows=useQuery({queryKey:['customer-boq','documents',projectId,versionId],queryFn:()=>documentsApi.targetDocuments(projectId,'CUSTOMER_BOQ',versionId),enabled:canRead});
  const types=useQuery({queryKey:['customer-boq','document-types'],queryFn:documentsApi.typeOptions,enabled:canUpload});
  const upload=useMutation({mutationFn:()=>documentsApi.uploadTargetDocument(projectId,'CUSTOMER_BOQ',versionId,type,file!),onSuccess:()=>cache.invalidateQueries({queryKey:['customer-boq','documents',projectId,versionId]})});
  const download=useMutation({mutationFn:(id:string)=>documentsApi.downloadTargetDocument(projectId,'CUSTOMER_BOQ',versionId,id),onSuccess:r=>saveBlob(r.blob,r.fileName??'document')});
  if(!canRead)return null;
  return <Stack spacing={1}><Typography>{t('attachments')}</Typography>{rows.isError||upload.isError||download.isError?<Alert severity="error">{t('error')}</Alert>:null}
    {rows.data?.data.map(row=><Button key={row.id} onClick={()=>download.mutate(row.id)}>{t('download')} · {row.fileName}</Button>)}
    {canUpload?<><TextField select label={t('type')} value={type} onChange={e=>setType(e.target.value)}><MenuItem value="">—</MenuItem>{types.data?.data.map(x=><MenuItem key={x.id} value={x.id}>{x.documentTypeName}</MenuItem>)}</TextField><input aria-label={t('file')} type="file" onChange={e=>setFile(e.target.files?.[0]??null)}/><Button disabled={!type||!file||upload.isPending} onClick={()=>upload.mutate()}>{t('upload')}</Button></>:null}
  </Stack>;
}
