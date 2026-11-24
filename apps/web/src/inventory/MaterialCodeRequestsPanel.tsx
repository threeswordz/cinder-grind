import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, CardContent, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { apiRequest } from '../api/client';
import { masterDataApi, type MaterialRecord } from '../api/master-data';

type Data<T> = { data: T };
type Project = { id:string; projectCode:string; projectName:string };
type Case = {
  requestId:string;projectId:string;requestedName:string;suggestedCode:string;
  suggestedUomCode:string;requestReason:string;requestedByUserId:string;
  pmUserId:string|null;creatorUserId:string|null;linkedMaterialId:string|null;
  status:'PENDING_PM'|'PENDING_CREATOR'|'RETURNED'|'COMPLETED';
  version:number;lastEventId:string;
};
const base='/inventory/material-code-requests';
const msg=(e:unknown)=>e instanceof Error?e.message:'Material code request failed.';

/** SS02: independently audited request and handoff. No Material is created here. */
export function MaterialCodeRequestsPanel({permissions,roleCodes}:{
  permissions:string[];roleCodes:string[];
}) {
  const store=roleCodes.includes('STOREKEEPER')&&
    permissions.includes('inventory.material_request.view');
  const pm=roleCodes.includes('PROJECT_MANAGER')&&
    permissions.includes('inventory.stock.view');
  const creator=roleCodes.some(r=>r==='PROCUREMENT_OFFICER'||r==='FINANCE_MANAGER')&&
    permissions.includes('master.material.manage');
  const [projects,setProjects]=useState<Project[]>([]);
  const [projectId,setProjectId]=useState('');
  const [cases,setCases]=useState<Case[]>([]);
  const [requestedName,setRequestedName]=useState('');
  const [suggestedCode,setSuggestedCode]=useState('');
  const [suggestedUomCode,setSuggestedUomCode]=useState('');
  const [requestReason,setRequestReason]=useState('');
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [materialIds,setMaterialIds]=useState<Record<string,string>>({});
  const [options,setOptions]=useState<Record<string,MaterialRecord[]>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const canView=store||pm||creator;

  useEffect(()=>{
    if(!canView)return;
    let active=true;
    apiRequest<Data<Project[]>>(base+'/projects')
      .then(x=>{if(active)setProjects(x.data);})
      .catch(e=>{if(active)setError(msg(e));});
    return()=>{active=false;};
  },[canView]);

  const refresh=useCallback(async()=>{
    if(!projectId)return;
    const r=await apiRequest<Data<Case[]>>(base+'/projects/'+projectId);
    setCases(r.data);
  },[projectId]);

  useEffect(()=>{
    setCases([]);setNotes({});setMaterialIds({});setOptions({});
    if(!projectId)return;
    let active=true;
    apiRequest<Data<Case[]>>(base+'/projects/'+projectId)
      .then(x=>{if(active)setCases(x.data);})
      .catch(e=>{if(active)setError(msg(e));});
    return()=>{active=false;};
  },[projectId]);

  const run=async(action:()=>Promise<unknown>,successText:string)=>{
    setBusy(true);setError('');setSuccess('');
    try{await action();await refresh();setSuccess(successText);}
    catch(e){setError(msg(e));}
    finally{setBusy(false);}
  };

  const request=()=>run(async()=>{
    await apiRequest(base+'/projects/'+projectId,{
      method:'POST',body:JSON.stringify({
        requestedName,suggestedCode,suggestedUomCode,requestReason,
      }),
    });
    setRequestedName('');setSuggestedCode('');setSuggestedUomCode('');setRequestReason('');
  },'Material code request submitted for independent PM review.');

  const decide=(item:Case,action:'PM_APPROVE'|'PM_RETURN'|'CREATOR_LINK')=>
    run(async()=>{
      await apiRequest(
        base+'/projects/'+projectId+'/requests/'+item.requestId+'/events',{
          method:'POST',body:JSON.stringify({
            action,expectedVersion:item.version,expectedEventId:item.lastEventId,
            note:notes[item.requestId]??'',
            ...(action==='CREATOR_LINK'?
              {createdMaterialId:materialIds[item.requestId]}:{}),
          }),
        });
      setNotes(old=>({...old,[item.requestId]:''}));
    },action==='CREATOR_LINK'?'Canonical material creation evidence linked.':
      action==='PM_APPROVE'?'Request forwarded to authorized material creator.':
        'Request returned without material creation.');

  const findCreated=async(item:Case)=>{
    setError('');
    try{
      // Company-owned source, not an untrusted external product lookup.
      const r=await masterDataApi.materials(item.requestedName,'true');
      setOptions(old=>({...old,[item.requestId]:
        r.data.filter(x=>x.materialName.toLocaleLowerCase()===
          item.requestedName.toLocaleLowerCase())}));
    }catch(e){setError(msg(e));}
  };

  if(!canView)return null;
  return <Stack spacing={2}>
    <Typography variant="h6">SS02 · New material code requests</Typography>
    <Alert severity="info">
      Store Site requests a new material, Khaimook reviews independently, and a
      permitted Jai/Nancy master-data creator uses the existing Materials screen.
      This workflow only records and links that verified creation: it never grants
      master-data rights or creates a material from a Store/PM request.
    </Alert>
    <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
      <TextField select fullWidth label="Authorized Project" value={projectId}
        onChange={e=>{setProjectId(e.target.value);setError('');setSuccess('');}}>
        <MenuItem value="">Select Project</MenuItem>
        {projects.map(p=><MenuItem key={p.id} value={p.id}>
          {p.projectCode} — {p.projectName}
        </MenuItem>)}
      </TextField>
      <Button variant="outlined" disabled={!projectId||busy}
        onClick={()=>void run(refresh,'Request list refreshed.')}>Refresh</Button>
    </Stack>
    {error?<Alert severity="error">{error}</Alert>:null}
    {success?<Alert severity="success">{success}</Alert>:null}
    {store&&projectId?<Card variant="outlined"><CardContent><Stack spacing={1.5}>
      <Typography variant="subtitle1">Storekeeper · request material code</Typography>
      <TextField label="Required material name" value={requestedName}
        onChange={e=>setRequestedName(e.target.value)} inputProps={{maxLength:200}}/>
      <TextField label="Suggested code (not assigned yet)" value={suggestedCode}
        onChange={e=>setSuggestedCode(e.target.value)} inputProps={{maxLength:80}}/>
      <TextField label="Suggested UOM code" value={suggestedUomCode}
        onChange={e=>setSuggestedUomCode(e.target.value)} inputProps={{maxLength:30}}/>
      <TextField label="Why the Project needs this material" multiline minRows={2}
        value={requestReason} onChange={e=>setRequestReason(e.target.value)}
        inputProps={{maxLength:2000}}/>
      <Button disabled={busy||requestedName.trim().length<2||
        requestReason.trim().length<3} onClick={()=>void request()}>
        Submit to Khaimook
      </Button>
    </Stack></CardContent></Card>:null}

    {projectId&&cases.map(item=><Paper variant="outlined" key={item.requestId}
      sx={{p:2}}>
      <Stack spacing={1}>
        <Typography fontWeight={600}>{item.requestedName}</Typography>
        <Typography variant="body2" color="text.secondary">
          Request {item.requestId} · {item.status} · v{item.version}
        </Typography>
        <Typography variant="body2">
          Suggested code: {item.suggestedCode||'To be allocated'}
          {' · '}Suggested UOM: {item.suggestedUomCode||'To be confirmed'}
        </Typography>
        <Typography variant="body2">{item.requestReason}</Typography>
        {item.linkedMaterialId?<Alert severity="success">
          Linked canonical material ID: {item.linkedMaterialId}
        </Alert>:null}
        {((pm&&item.status==='PENDING_PM')||
          (creator&&item.status==='PENDING_CREATOR'))?<TextField
            label="Decision note / evidence" multiline minRows={2}
            value={notes[item.requestId]??''}
            onChange={e=>setNotes(old=>({...old,[item.requestId]:e.target.value}))}
            inputProps={{maxLength:2000}}/>:null}
        {pm&&item.status==='PENDING_PM'?<Stack direction="row" spacing={1}>
          <Button disabled={busy||(notes[item.requestId]??'').trim().length<3}
            onClick={()=>void decide(item,'PM_APPROVE')}>Khaimook · forward</Button>
          <Button color="warning" disabled={busy||(notes[item.requestId]??'').trim().length<3}
            onClick={()=>void decide(item,'PM_RETURN')}>Return request</Button>
        </Stack>:null}
        {creator&&item.status==='PENDING_CREATOR'?<Stack spacing={1}>
          <Alert severity="warning">
            First create the material separately under Materials using your existing
            authorized permission. Then find and link the exact name here. Its
            canonical creation audit must be after PM approval and by the same user.
          </Alert>
          <Button variant="outlined" disabled={busy}
            onClick={()=>void findCreated(item)}>Find newly created material</Button>
          <TextField select label="Company material created after PM approval"
            value={materialIds[item.requestId]??''}
            onChange={e=>setMaterialIds(old=>({...old,[item.requestId]:e.target.value}))}>
            <MenuItem value="">Select canonical material</MenuItem>
            {(options[item.requestId]??[]).map(m=><MenuItem key={m.id} value={m.id}>
              {m.materialCode} — {m.materialName} ({m.defaultUom.uomCode})
            </MenuItem>)}
          </TextField>
          <Button disabled={busy||!materialIds[item.requestId]||
            (notes[item.requestId]??'').trim().length<3}
            onClick={()=>void decide(item,'CREATOR_LINK')}>Link verified creation</Button>
        </Stack>:null}
      </Stack>
    </Paper>)}
    {projectId&&cases.length===0?<Alert severity="info">
      No material-code requests currently recorded for this Project.
    </Alert>:null}
  </Stack>;
}
