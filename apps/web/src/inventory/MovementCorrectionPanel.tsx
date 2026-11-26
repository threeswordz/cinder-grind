import { Alert, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useState } from 'react';
import { apiRequest } from '../api/client';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';

type Kind = 'GOODS_RECEIPT' | 'MATERIAL_ISSUE' | 'MATERIAL_RETURN' | 'STOCK_TRANSFER';
type Correction = {id:string; reason:string; requestedByUserId:string; requestedAt:string; sourcePostedAt:string|null;
  approvalInstance:{approvalState:string}};
type Intent = {path:string; body:{requestKey:string;reason:string}|{comment:string}};
const prefixes:Record<Kind,string>={GOODS_RECEIPT:'receipt',MATERIAL_ISSUE:'issue',MATERIAL_RETURN:'return',STOCK_TRANSFER:'transfer'};
const labels={
 en:{title:'Movement correction',reason:'Reason',comment:'Decision reason',reverse:'Request stock reversal',cancel:'Request cancellation',approve:'Approve correction',reject:'Reject correction',pending:'Pending review',approved:'Approved',rejected:'Rejected',empty:'No correction requests',refresh:'Refresh',retry:'Retry same request',clear:'Refresh and clear request',error:'Unable to verify current correction access or state. Refresh before continuing.',uncertain:'Request result uncertain. Retry the exact request or refresh.',posted:'Posted reversal',unposted:'Unposted cancellation',loading:'Checking current correction access…'},
 th:{title:'แก้ไขรายการเคลื่อนไหว',reason:'เหตุผล',comment:'เหตุผลการตัดสินใจ',reverse:'ขอกลับรายการสต็อก',cancel:'ขอยกเลิกรายการ',approve:'อนุมัติการแก้ไข',reject:'ไม่อนุมัติการแก้ไข',pending:'รอตรวจสอบ',approved:'อนุมัติแล้ว',rejected:'ไม่อนุมัติ',empty:'ไม่มีคำขอแก้ไข',refresh:'โหลดใหม่',retry:'ลองคำขอเดิมอีกครั้ง',clear:'โหลดใหม่และล้างคำขอ',error:'ไม่สามารถยืนยันสิทธิ์หรือสถานะล่าสุด โปรดโหลดใหม่',uncertain:'ยังไม่ทราบผลคำขอ ลองคำขอเดิมหรือโหลดใหม่',posted:'กลับรายการที่ลงสต็อกแล้ว',unposted:'ยกเลิกรายการที่ยังไม่ลงสต็อก',loading:'กำลังตรวจสอบสิทธิ์…'},
 'zh-TW':{title:'庫存異動更正',reason:'原因',comment:'決策原因',reverse:'申請沖銷庫存',cancel:'申請取消',approve:'核准更正',reject:'駁回更正',pending:'待審核',approved:'已核准',rejected:'已駁回',empty:'沒有更正申請',refresh:'重新整理',retry:'重試相同請求',clear:'重新整理並清除請求',error:'無法確認目前權限或狀態，請重新整理。',uncertain:'請求結果未確認。重試相同請求或重新整理。',posted:'已過帳沖銷',unposted:'未過帳取消',loading:'正在確認更正權限…'},
};
export function MovementCorrectionPanel({kind,sourceId,permissions,roleCodes,userId,companyId,reverseEligible,cancelEligible,onChanged}:{
 kind:Kind; sourceId:string; permissions:string[];roleCodes:string[];userId:string;companyId:string;
 reverseEligible:boolean;cancelEligible:boolean;onChanged:()=>Promise<unknown>|void;
}){
 const t=labels[useContext(MonetaryLocaleContext)], client=useQueryClient();
 const prefix='inventory.'+prefixes[kind];
 const maker=roleCodes.includes('STOREKEEPER')&&['view','edit'].every(p=>permissions.includes(prefix+'.'+p));
 const reviewer=roleCodes.includes('PROJECT_MANAGER')&&['view','approve','reverse'].every(p=>permissions.includes(prefix+'.'+p));
 const enabled=Boolean(companyId&&userId&&sourceId&&(maker||reviewer));
 const root='/inventory/movement-corrections', source=root+'/sources/'+kind+'/'+sourceId;
 const queryKey=['movement-corrections',companyId,userId,kind,sourceId];
 const list=useQuery({queryKey,queryFn:()=>apiRequest<{data:Correction[]}>(source+'/requests'),enabled,retry:false,gcTime:0,refetchOnWindowFocus:true});
 const [reason,setReason]=useState(''), [comment,setComment]=useState(''),[intent,setIntent]=useState<Intent|null>(null);
 const refresh=async()=>{await onChanged();await client.invalidateQueries({queryKey});};
 const mutation=useMutation({mutationFn:(i:Intent)=>apiRequest<{data:Correction}>(i.path,{method:'POST',body:JSON.stringify(i.body)}),
  retry:false,onSuccess:async()=>{setIntent(null);setReason('');setComment('');await refresh();}});
 const send=(i:Intent)=>{if(intent||mutation.isPending||!list.isSuccess||list.isFetching)return;setIntent(i);mutation.mutate(i);};
 if(!enabled)return null;
 const rows=list.isSuccess&&!list.isFetching&&!list.isError?list.data.data:[];
 const pending=rows.some(r=>r.approvalInstance.approvalState==='SUBMITTED');
 const terminal=rows.some(r=>r.sourcePostedAt===null&&r.approvalInstance.approvalState==='APPROVED');
 const locked=Boolean(intent)||mutation.isPending||!list.isSuccess||list.isFetching;
 const stateLabel=(state:string)=>state==='SUBMITTED'?t.pending:state==='APPROVED'?t.approved:state==='REJECTED'?t.rejected:state;
 return <Paper variant="outlined" sx={{p:2}} data-testid="movement-correction-panel"><Stack spacing={1}>
  <Typography variant="subtitle1">{t.title}</Typography>
  <Button disabled={mutation.isPending} onClick={()=>void refresh()}>{t.refresh}</Button>
  {list.isFetching?<Typography variant="body2">{t.loading}</Typography>:list.isError?<Alert severity="error">{t.error}</Alert>:null}
  {mutation.isError&&intent?<Alert severity="error">{t.uncertain}<Button disabled={mutation.isPending||!list.isSuccess||list.isFetching} onClick={()=>mutation.mutate(intent)}>{t.retry}</Button><Button disabled={mutation.isPending} onClick={()=>{setIntent(null);mutation.reset();void refresh();}}>{t.clear}</Button></Alert>:null}
  {list.isSuccess&&!list.isFetching&&!rows.length?<Typography variant="body2">{t.empty}</Typography>:null}
  {rows.map(r=><Paper key={r.id} variant="outlined" sx={{p:1}}><Stack spacing={1}>
   <Stack direction="row" spacing={1}><Chip label={stateLabel(r.approvalInstance.approvalState)} size="small"/><Typography variant="body2">{r.sourcePostedAt?t.posted:t.unposted}</Typography></Stack>
   <Typography variant="body2" sx={{overflowWrap:'anywhere'}}>{r.reason}</Typography>
   <Typography variant="caption">{new Date(r.requestedAt).toLocaleString()}</Typography>
   {reviewer&&r.requestedByUserId!==userId&&r.approvalInstance.approvalState==='SUBMITTED'?<>
    <TextField label={t.comment} value={comment} onChange={e=>setComment(e.target.value)} disabled={locked} inputProps={{maxLength:1000}}/>
    <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
     <Button variant="contained" disabled={locked||!comment.trim()} onClick={()=>send({path:root+'/'+r.id+'/approve',body:{comment:comment.trim()}})}>{t.approve}</Button>
     <Button disabled={locked||!comment.trim()} onClick={()=>send({path:root+'/'+r.id+'/reject',body:{comment:comment.trim()}})}>{t.reject}</Button>
    </Stack></>:null}
  </Stack></Paper>)}
  {maker&&!pending&&!terminal&&(reverseEligible||cancelEligible)&&list.isSuccess&&!list.isFetching?<Stack spacing={1}>
   <TextField label={t.reason} value={reason} onChange={e=>setReason(e.target.value)} disabled={locked} inputProps={{maxLength:1000}}/>
   <Button variant="outlined" disabled={locked||!reason.trim()} onClick={()=>send({path:source+(reverseEligible?'/requests':'/cancellation-requests'),body:{requestKey:crypto.randomUUID(),reason:reason.trim()}})}>{reverseEligible?t.reverse:t.cancel}</Button>
  </Stack>:null}
 </Stack></Paper>;
}
