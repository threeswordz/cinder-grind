import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect,useState } from 'react';

import { equipmentApi } from '../api/equipment';

function today() {
  // Date-only Equipment custody follows Thailand operations, never the
  // browser's local timezone (e.g. a Singapore operator after midnight).
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date());
  const read=(type:string)=>parts.find(p=>p.type===type)?.value??'';
  return [read('year'),read('month'),read('day')].join('-');
}

export function EquipmentCustodyPanel({equipmentId,permissions}:{equipmentId:string;permissions:string[]}) {
  const client=useQueryClient();
  const mayManage=permissions.includes('equipment.custody.manage');
  const [projectId,setProjectId]=useState('');
  const [borrowerEmployeeId,setBorrowerEmployeeId]=useState('');
  const [siteLabel,setSiteLabel]=useState('');
  const [issuedOn,setIssuedOn]=useState(today());
  const [dueOn,setDueOn]=useState(today());
  const [conditionOut,setConditionOut]=useState('');
  const [returnedOn,setReturnedOn]=useState(today());
  const [conditionIn,setConditionIn]=useState('');
  const projects=useQuery({queryKey:['equipment-custody','projects'],queryFn:equipmentApi.custodyProjects});
  const borrowers=useQuery({
    queryKey:['equipment-custody','borrowers',projectId,issuedOn],
    queryFn:()=>equipmentApi.custodyBorrowers(projectId,issuedOn),
    enabled:Boolean(projectId&&issuedOn&&mayManage),
  });
  const loans=useQuery({
    queryKey:['equipment-custody','loans',projectId,equipmentId],
    queryFn:()=>equipmentApi.custodyLoans(projectId,equipmentId),
    enabled:Boolean(projectId),
  });
  const visibleProjects=projects.isSuccess?projects.data.data:[];
  const scopeCurrent=visibleProjects.some(p=>p.id===projectId);
  const visibleLoans=scopeCurrent&&loans.isSuccess?loans.data.data:[];
  const visibleBorrowers=scopeCurrent&&borrowers.isSuccess?borrowers.data.data:[];
  const scopeDenied=projects.isError||loans.isError||borrowers.isError||
    Boolean(projectId&&projects.isSuccess&&!scopeCurrent);
  useEffect(()=>{if(scopeDenied){setBorrowerEmployeeId('');setSiteLabel('');setConditionOut('');setConditionIn('');}},[scopeDenied]);
  const refresh=()=>client.invalidateQueries({queryKey:['equipment-custody']});
  const checkout=useMutation({
    mutationFn:()=>{
      if(scopeDenied||!scopeCurrent||!loans.isSuccess||!visibleBorrowers.some(b=>b.id===borrowerEmployeeId))throw Error('Refresh current custody scope');
      return equipmentApi.custodyCheckout({equipmentId,projectId,borrowerEmployeeId,siteLabel,issuedOn,dueOn,conditionOut});
    },
    onSuccess:async()=>{setConditionOut('');setSiteLabel('');await refresh();},
  });
  const returnLoan=useMutation({
    mutationFn:(id:string)=>{
      if(scopeDenied||!visibleLoans.some(l=>l.id===id&&!l.returnedOn))throw Error('Refresh current custody scope');
      return equipmentApi.custodyReturn(id,returnedOn,conditionIn);
    },
    onSuccess:async()=>{setConditionIn('');await refresh();},
  });
  if(!permissions.includes('equipment.custody.view')) return null;
  const open=visibleLoans.find(loan=>!loan.returnedOn);
  const error=checkout.error??returnLoan.error??loans.error??borrowers.error??projects.error;
  return <Card variant="outlined"><CardContent><Stack spacing={2}>
    <Typography variant="subtitle1">SS11 — Person-level Equipment Custody (CG#####)</Typography>
    <Typography variant="body2">A loan is separate from Project Equipment assignment and never posts stock or depreciation.</Typography>
    <Button onClick={()=>void refresh()}>Refresh custody</Button>
    {error?<Alert severity="error">{error instanceof Error?error.message:'Custody request failed'}</Alert>:null}
    <TextField select label="Project / site scope" value={projectId}
      onChange={e=>{setProjectId(e.target.value);setBorrowerEmployeeId('');}} fullWidth>
      <MenuItem value="">Select Project</MenuItem>
      {visibleProjects.map(p=><MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</MenuItem>)}
    </TextField>
    {!scopeDenied&&projectId&&open?<Alert severity="warning">
      Checked out to {open.borrowerName} at {open.siteLabel}. Due {open.dueOn.slice(0,10)}.
    </Alert>:null}
    {(scopeDenied?[]:visibleLoans).map(loan=><Stack key={loan.id} spacing={0.5}>
      <Typography variant="body2">
        {loan.borrowerName} · {loan.siteLabel} · issued {loan.issuedOn.slice(0,10)}
        {' · due '+loan.dueOn.slice(0,10)}
        {' · out: '+loan.conditionOut}
        {loan.returnedOn?' · returned '+loan.returnedOn.slice(0,10)+' · in: '+loan.conditionIn:' · OPEN'}
      </Typography>
      {!loan.returnedOn&&mayManage?<Stack direction={{xs:'column',sm:'row'}} spacing={1}>
        <TextField label="Return date" type="date" value={returnedOn}
          onChange={e=>setReturnedOn(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/>
        <TextField label="Condition on return" value={conditionIn}
          onChange={e=>setConditionIn(e.target.value)} inputProps={{maxLength:300}} fullWidth/>
        <Button variant="outlined" disabled={!conditionIn.trim()||returnLoan.isPending}
          onClick={()=>returnLoan.mutate(loan.id)}>Record Return</Button>
      </Stack>:null}
    </Stack>)}
    {mayManage&&scopeCurrent&&loans.isSuccess&&borrowers.isSuccess&&!scopeDenied&&!open?<Stack spacing={1}>
      <Typography variant="subtitle2">Check out this Equipment to an active Project employee</Typography>
      <TextField select label="Named borrower" value={borrowerEmployeeId} fullWidth
        onChange={e=>setBorrowerEmployeeId(e.target.value)}>
        <MenuItem value="">Select borrower</MenuItem>
        {visibleBorrowers.map(b=><MenuItem key={b.id} value={b.id}>
          {b.employeeCode} — {b.employeeName}
        </MenuItem>)}
      </TextField>
      <TextField label="Site / location description" value={siteLabel}
        onChange={e=>setSiteLabel(e.target.value)} inputProps={{maxLength:150}}/>
      <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
        <TextField label="Issue date" type="date" value={issuedOn}
          onChange={e=>setIssuedOn(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/>
        <TextField label="Due date" type="date" value={dueOn}
          onChange={e=>setDueOn(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/>
      </Stack>
      <TextField label="Condition on issue" value={conditionOut}
        onChange={e=>setConditionOut(e.target.value)} inputProps={{maxLength:300}}/>
      <Button variant="contained" disabled={!borrowerEmployeeId||!siteLabel.trim()||!conditionOut.trim()||
        !issuedOn||dueOn<issuedOn||checkout.isPending} onClick={()=>checkout.mutate()}>
        Check Out
      </Button>
    </Stack>:null}
  </Stack></CardContent></Card>;
}
