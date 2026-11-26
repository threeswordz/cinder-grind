import { Alert,Button,Card,CardContent,Stack,TextField,Typography } from '@mui/material';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useEffect,useState } from 'react';
import { apiRequest } from '../api/client';

type Version={id:string;version:number;purchaseDate:string|null;acquisitionValueTHB:string|null;
 evidenceReference:string;recordedBaseLocation:string|null;reason:string;createdAt:string};
type Readback={current:Version|null;history:Version[];currentProject:{projectCode:string;projectName:string}|null;
 custodyVisible:boolean;currentCustody:{borrowerName:string;siteLabel:string;dueOn:string}|null;canEdit:boolean};
const blank={purchaseDate:'',acquisitionValueTHB:'',evidenceReference:'',recordedBaseLocation:'',reason:''};
export function EquipmentAssetRegisterPanel({equipmentId}:{equipmentId:string}){
 const client=useQueryClient(),path='/equipment/register/'+equipmentId+'/asset';
 const query=useQuery({queryKey:['equipment','asset',equipmentId],queryFn:()=>apiRequest<{data:Readback}>(path),retry:false});
 // React Query retains successful cached data on a failed refetch. A
 // current error must override it before rendering any protected values.
 const result=query.isSuccess?query.data?.data:undefined;
 const [form,setForm]=useState(blank);
 const [base,setBase]=useState<{id:string;versionId:string|null}|null>(null);
 useEffect(()=>{
  if(!result){setBase(null);setForm(blank);return;}
  const v=result.current;
  setBase({id:equipmentId,versionId:v?.id??null});
  setForm({purchaseDate:v?.purchaseDate?.slice(0,10)??'',acquisitionValueTHB:v?.acquisitionValueTHB??'',
    evidenceReference:v?.evidenceReference??'',recordedBaseLocation:v?.recordedBaseLocation??'',reason:''});
 },[equipmentId,result?.current?.id,result!==undefined]);
 const save=useMutation({mutationFn:()=>{
  if(!result?.canEdit||!base||base.id!==equipmentId||base.versionId!==(result?.current?.id??null))throw Error('Refresh before recording a new version');
  return apiRequest(path,{method:'POST',body:JSON.stringify({expectedVersionId:base.versionId,
   purchaseDate:form.purchaseDate||null,acquisitionValueTHB:form.acquisitionValueTHB||null,
   evidenceReference:form.evidenceReference.trim(),recordedBaseLocation:form.recordedBaseLocation.trim()||null,reason:form.reason.trim()})});
 },onSuccess:()=>client.invalidateQueries({queryKey:['equipment','asset',equipmentId]})});
 const field=(key:keyof typeof blank,label:string,type='text')=><TextField label={label} type={type} value={form[key]} fullWidth
   onChange={e=>setForm(x=>({...x,[key]:e.target.value}))} slotProps={type==='date'?{inputLabel:{shrink:true}}:undefined}/>;
 return <Card variant="outlined"><CardContent><Stack spacing={1.5}>
  <Typography variant="subtitle1">JAI-ASSET-01 — CG asset acquisition register / ทะเบียนทรัพย์สิน</Typography>
  <Alert severity="info">Operator-recorded acquisition facts (THB); unknown date/value stays blank, never assumed zero. Existing assignment and custody are the location sources. No depreciation, invoice verification, journal or payment.</Alert>
  {query.isPending&&<Typography>Loading asset register…</Typography>}
  {query.isError&&<Alert severity="warning">Asset details unavailable in your current scope. No acquisition values displayed.</Alert>}
  {result&&<>
   <Typography>Current site assignment: {result.currentProject?result.currentProject.projectCode+' — '+result.currentProject.projectName:'No effective site assignment'}</Typography>
   <Typography>Recorded base location: {result.current?.recordedBaseLocation??'Not recorded'}</Typography>
   <Typography>Current custodian: {!result.custodyVisible?'Not authorized to view custody':result.currentCustody?result.currentCustody.borrowerName+' · '+result.currentCustody.siteLabel+' · due '+result.currentCustody.dueOn.slice(0,10):'No open employee loan'}</Typography>
   <Typography>Purchase date: {result.current?.purchaseDate?.slice(0,10)??'Unknown'} · acquisition value: {result.current?.acquisitionValueTHB!=null?result.current.acquisitionValueTHB+' THB':'Unknown'}</Typography>
   {result.canEdit&&<Stack spacing={1}>
    {field('purchaseDate','Purchase date (blank if unknown)','date')}
    {field('acquisitionValueTHB','Acquisition value THB (blank if unknown)')}
    {field('evidenceReference','Purchase evidence reference (documentary note)')}
    {field('recordedBaseLocation','Recorded base location (not live custody)')}
    {field('reason','Reason for new version')}
    <Button variant="contained" disabled={!base||base.id!==equipmentId||base.versionId!==(result.current?.id??null)||!form.evidenceReference.trim()||!form.reason.trim()||save.isPending}
      onClick={()=>save.mutate()}>Record acquisition version</Button>
   </Stack>}
   {save.isError&&<Alert severity="error">{save.error instanceof Error?save.error.message:'Save failed'}</Alert>}
   <Typography variant="subtitle2">Preserved acquisition history</Typography>
   {result.history.map(v=><Typography key={v.id} variant="body2">Version {v.version} · {v.purchaseDate?.slice(0,10)??'Unknown date'} · {v.acquisitionValueTHB??'Unknown value'} THB · {v.evidenceReference} · {v.recordedBaseLocation??'No base location'} · {v.reason}</Typography>)}
  </>}
  <Button onClick={()=>void query.refetch()} disabled={query.isFetching}>Refresh register</Button>
 </Stack></CardContent></Card>;
}
