import {Alert, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography} from '@mui/material';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {schedulingApi, type WorkPlanLineInput} from '../api/scheduling';

type ActivityLabel={activityId:string;activityName:string};
type Props={projectId:string;permissions:string[];activities:ActivityLabel[]};
/**
 * FM02 is explicitly a technical workflow. It neither grants Ben's work-plan
 * confirmation nor creates BOQ/Finance approvals. The API checks all source
 * and actor authority; client-side visibility is presentation only.
 */
export function ProjectProgressPlansPanel({projectId,permissions,activities}:Props) {
 const queryClient=useQueryClient();
 const canView=permissions.includes('schedule.programme.view');
 const canPrepare=permissions.includes('schedule.work_plan.prepare');
 const canConfirm=permissions.includes('schedule.work_plan.confirm');
 const canRecord=permissions.includes('schedule.progress.record');
 const [reason,setReason]=useState(''),[activityId,setActivityId]=useState(''),[weightPercent,setWeight]=useState('');
 const [sourceKind,setKind]=useState<'MILESTONE'|'QUANTITY'>('MILESTONE');
 const [budgetLineId,setBudgetLine]=useState(''),[lines,setLines]=useState<WorkPlanLineInput[]>([]);
 const [quantityActivity,setQuantityActivity]=useState(''),[completedQuantity,setQuantity]=useState('');
 const [quantityReason,setQuantityReason]=useState(''),[quantityDate,setQuantityDate]=useState(new Date().toISOString().slice(0,10));
 const active=Boolean(projectId&&canView);
 const key=['fm02',projectId];
 const opts=useQuery({queryKey:[...key,'options'],queryFn:()=>schedulingApi.workPlanOptions(projectId),
   enabled:active&&canPrepare,retry:false});
 const list=useQuery({queryKey:[...key,'versions'],queryFn:()=>schedulingApi.workPlans(projectId),
   enabled:active,retry:false});
 const current=useQuery({queryKey:[...key,'current'],queryFn:()=>schedulingApi.currentWorkPlan(projectId),
   enabled:active,retry:false});
 const refresh=()=>queryClient.invalidateQueries({queryKey:key});
 const prepare=useMutation({mutationFn:()=>schedulingApi.prepareWorkPlan({
   projectId,reason,lines}),onSuccess:async()=>{setLines([]);setReason('');await refresh();}});
 const confirm=useMutation({mutationFn:(item:{id:string;versionNo:number})=>schedulingApi.confirmWorkPlan(item.id,item.versionNo),
   onSuccess:refresh});
 const quantity=useMutation({mutationFn:()=>schedulingApi.recordQuantityProgress(quantityActivity,{
   progressDate:quantityDate,completedQuantity,note:quantityReason}),
   onSuccess:async()=>{setQuantity('');setQuantityReason('');await refresh();}});
 const add=()=>{
   if(!activityId||!/^\d+(?:\.\d{1,2})?$/.test(weightPercent)||Number(weightPercent)<=0||
      Number(weightPercent)>100||lines.some(x=>x.activityId===activityId)||
      (sourceKind==='QUANTITY'&&!budgetLineId))return;
   setLines(prev=>[...prev,{activityId,weightPercent,sourceKind,
     ...(sourceKind==='QUANTITY'?{approvedBudgetRevisionLineId:budgetLineId}:{})}]);
   setActivityId('');setWeight('');setBudgetLine('');
 };
 const selected=opts.data?.data.activities.find(x=>x.id===activityId);
 const candidateLines=(opts.data?.data.quantityLines??[]).filter(q=>q.wbsId===selected?.wbsId);
 const pending=(list.data?.data??[]).find(x=>!x.confirmedAt);
 const confirmed=(list.data?.data??[]).find(x=>Boolean(x.confirmedAt));
 if(!canView||!projectId)return null;
 return <Card variant="outlined"><CardContent><Stack spacing={2} data-testid="fm02-project-weighted-progress">
   <Typography variant="h6">FM02 — Project weighted progress</Typography>
   <Typography variant="body2">Uses an immutable Ben-confirmed work-plan version. Missing evidence blocks the Project total;
     Cost/Client BOQ values and historical progress are not changed by calculations.</Typography>
   {current.isError||list.isError?<Alert severity="warning">Project progress evidence is unavailable.</Alert>:null}
   {current.isSuccess?<Stack spacing={1}>
     <Chip label={current.data.data.status} size="small"/>
     <Typography>Current weighted progress: {current.data.data.percentComplete===null?'Not available':
       current.data.data.percentComplete+'%'}</Typography>
     {(current.data.data.missingActivityIds??[]).length?
       <Alert severity="warning">{current.data.data.missingActivityIds!.length} activities have missing source evidence.
         No zero or completion is assumed.</Alert>:null}
     {(current.data.data.lines??[]).map(line=><Typography variant="body2" key={line.activityId}>
       {activities.find(a=>a.activityId===line.activityId)?.activityName??line.activityId}:
       {' '}{line.weightPercent}% weight · {line.percentComplete??'Missing evidence'}%
     </Typography>)}
   </Stack>:null}
   {(list.data?.data??[]).map(plan=><Card key={plan.id} variant="outlined"><CardContent>
     <Stack spacing={1}><Typography>Version {plan.versionNo} · {plan.confirmedAt?'Ben-confirmed (configured role)':'Awaiting confirmation'}
       {' '}· {plan._count?.lines??0} work lines</Typography>
       <Typography variant="body2">{plan.reason}</Typography>
       {canConfirm&&!plan.confirmedAt&&pending?.id===plan.id?
       <Button disabled={confirm.isPending} onClick={()=>confirm.mutate({id:plan.id,versionNo:plan.versionNo})}>
         Confirm version as authorized Ben</Button>:null}
     </Stack>
   </CardContent></Card>)}
   {confirm.isError?<Alert severity="error">Confirmation blocked. A distinct authorized Ben-role actor
     and current scoped version are required.</Alert>:null}
   {canPrepare?<Card variant="outlined"><CardContent><Stack spacing={1}>
     <Typography variant="subtitle1">Prepare a new immutable weight version</Typography>
     {pending?<Alert severity="info">The pending version must be confirmed before preparing another.</Alert>:null}
     <TextField label="Plan reason" value={reason} onChange={e=>setReason(e.target.value)} disabled={Boolean(pending)}/>
     <TextField select label="Activity" value={activityId} onChange={e=>{setActivityId(e.target.value);setBudgetLine('');}}
       disabled={Boolean(pending)||opts.isLoading}>
       <MenuItem value="">Select active work activity</MenuItem>
       {(opts.data?.data.activities??[]).map(a=><MenuItem key={a.id} value={a.id}>{a.activityCode} · {a.activityName}</MenuItem>)}
     </TextField>
     <TextField label="Work weight %" value={weightPercent} onChange={e=>setWeight(e.target.value)}
       disabled={Boolean(pending)} helperText="All selected weights must sum to exactly 100.00%."/>
     <TextField select label="Source basis" value={sourceKind}
       onChange={e=>{setKind(e.target.value as 'MILESTONE'|'QUANTITY');setBudgetLine('');}} disabled={Boolean(pending)}>
       <MenuItem value="MILESTONE">Reasoned/milestone Activity progress</MenuItem>
       <MenuItem value="QUANTITY">Approved Cost BOQ quantity</MenuItem>
     </TextField>
     {sourceKind==='QUANTITY'?<TextField select label="Approved BOQ quantity line" value={budgetLineId}
       onChange={e=>setBudgetLine(e.target.value)} disabled={Boolean(pending)||!activityId}>
       <MenuItem value="">Select matching WBS and UOM source</MenuItem>
       {candidateLines.map(line=><MenuItem key={line.id} value={line.id}>
         {line.description} · {line.quantity} {line.uomCode}</MenuItem>)}
     </TextField>:null}
     <Button onClick={add} disabled={Boolean(pending)||!activityId||!weightPercent}>Add weighted line</Button>
     {lines.map((line,i)=><Stack key={line.activityId} direction="row" spacing={1} alignItems="center">
       <Typography variant="body2">{activities.find(x=>x.activityId===line.activityId)?.activityName??line.activityId}:
         {' '}{line.weightPercent}% · {line.sourceKind}</Typography>
       <Button onClick={()=>setLines(old=>old.filter((_,index)=>index!==i))}>Remove</Button>
     </Stack>)}
     <Typography variant="body2">Entered total: {lines.reduce((n,x)=>n+Number(x.weightPercent),0).toFixed(2)}%</Typography>
     <Button disabled={Boolean(pending)||prepare.isPending||lines.length===0||!reason.trim()||
        Math.round(lines.reduce((n,x)=>n+Number(x.weightPercent),0)*100)!==10000}
       onClick={()=>prepare.mutate()}>Prepare version</Button>
     {prepare.isError?<Alert severity="error">Preparation rejected. Review permissions, version, Project/BOQ
       scope, Activity ancestry and exact weights.</Alert>:null}
   </Stack></CardContent></Card>:null}
   {canRecord&&confirmed?<Card variant="outlined"><CardContent><Stack spacing={1}>
     <Typography variant="subtitle1">Record cumulative approved-BOQ quantity</Typography>
     <Typography variant="body2">Use only an Activity pinned to a QUANTITY line in the confirmed version;
       this appends a canonical ActivityProgress record, never edits an earlier record.</Typography>
     <TextField select label="Activity" value={quantityActivity} onChange={e=>setQuantityActivity(e.target.value)}>
       <MenuItem value="">Select Activity</MenuItem>
       {activities.map(a=><MenuItem key={a.activityId} value={a.activityId}>{a.activityName}</MenuItem>)}
     </TextField>
     <TextField label="Completed quantity (in pinned BOQ UOM)" value={completedQuantity}
       onChange={e=>setQuantity(e.target.value)} />
     <TextField type="date" label="Progress date" value={quantityDate}
       InputLabelProps={{shrink:true}} onChange={e=>setQuantityDate(e.target.value)}/>
     <TextField label="Evidence/reason" value={quantityReason} onChange={e=>setQuantityReason(e.target.value)}/>
     <Button disabled={quantity.isPending||!quantityActivity||!completedQuantity||!quantityReason.trim()}
       onClick={()=>quantity.mutate()}>Append measured progress</Button>
     {quantity.isError?<Alert severity="error">Quantity evidence rejected: use a current approved
       Project source and a scoped canonical Activity.</Alert>:null}
   </Stack></CardContent></Card>:null}
 </Stack></CardContent></Card>;
}
