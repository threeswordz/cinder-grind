import { useContext, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Chip, MenuItem, Stack,
  TextField, Typography,
} from '@mui/material';
import {
  closeoutCategories, CloseoutCategory, CloseoutChecklist,
  CloseoutFollowup, projectsApi,
} from '../api/projects';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';

const terms = {
  en: {
    title:'Operational Project closeout — Khaimook / Ben / Nancy',
    scope:'Six checked categories and follow-up obligations only. Signing does NOT archive the Project, pay invoices, adjust stock, change BOQ, or authorize Production.',
    empty:'No Project closeout preparation yet',version:'Preparation version',
    category:'Category',state:'Assessment',clear:'Clear',warning:'Warning: outstanding',
    evidence:'Source evidence / record reference',observation:'Evidence note and remaining concerns',
    outstanding:'Outstanding item register',add:'Add follow-up item',remove:'Remove',
    description:'Remaining item / obligation',reason:'Warning / non-settlement reason',
    owner:'Follow-up owner (active Company Employee)',due:'Due date',
    amount:'Remaining amount (THB)',quantity:'Remaining physical quantity',
    uom:'Quantity unit',nonquant:'Why no amount or quantity applies',
    overall:'Khaimook preparation summary',revision:'Reason for replacing previous preparation',
    prepare:'Save six-category preparation (append-only revision)',
    signed:'Joint operational signoffs',ben:'Ben',nancy:'Nancy',
    note:'Reviewer note (mandatory when warnings remain)',
    sign:'Sign this exact preparation (not archive/payment)',
    problem:'Unable to save closeout evidence. Check actor role, Project scope, all six references, follow-up owners and current source version.',
    projectInactive:'Project archived: new closure preparation/signature is unavailable.',
    status:'Current operational closure position',warn:'Unsettled obligations are preserved after signatures.',
    missing:'Not signed',reviewed:'Signed',noteRequired:'A reasoned reviewer note is required for outstanding items.',
    work:'Work and customer acceptance',contracts:'POs and subcontract contracts',
    finance:'AP, AR and payments',stock:'Material, tools and assets',
    budget:'BOQ, variations and cost',docs:'Handover and supporting documents',
  },
  th: {
    title:'ปิดโครงการด้านปฏิบัติการ — คุณไข่มุก / คุณเบน / คุณแนนซี่',
    scope:'ตรวจสอบ 6 หมวดและรายการคงค้างเท่านั้น การลงนามไม่ใช่การเก็บโครงการเข้าคลัง ชำระหนี้ ปรับสต็อก เปลี่ยน BOQ หรืออนุมัติขึ้นระบบจริง',
    empty:'ยังไม่มีแบบเตรียมปิดโครงการ',version:'ฉบับตรวจสอบ',
    category:'หมวด',state:'สถานะ',clear:'เรียบร้อย',warning:'มีรายการคงค้าง',
    evidence:'เลขอ้างอิงเอกสาร / แหล่งหลักฐาน',observation:'บันทึกหลักฐานและข้อค้าง',
    outstanding:'ทะเบียนรายการคงค้าง',add:'เพิ่มรายการติดตาม',remove:'ลบรายการ',
    description:'รายละเอียดรายการคงค้าง',reason:'เหตุผลที่ยังไม่แล้วเสร็จ',
    owner:'ผู้รับผิดชอบติดตาม (พนักงานบริษัทที่ยังทำงานอยู่)',due:'วันครบกำหนด',
    amount:'ยอดคงค้าง (บาท)',quantity:'ปริมาณวัสดุคงเหลือ',
    uom:'หน่วยนับ',nonquant:'เหตุผลที่ไม่มีจำนวนเงินหรือปริมาณ',
    overall:'บันทึกสรุปการตรวจสอบของคุณไข่มุก',revision:'เหตุผลแก้ไขแบบเตรียมปิดโครงการ',
    prepare:'บันทึกแบบตรวจ 6 หมวด (เก็บประวัติทุกฉบับ)',
    signed:'ลายเซ็นรับรองการปิดด้านปฏิบัติการ',ben:'คุณเบน',nancy:'คุณแนนซี่',
    note:'บันทึกผู้ตรวจ (จำเป็นเมื่อมีรายการคงค้าง)',
    sign:'ลงนามรับรองฉบับปัจจุบัน (ไม่ใช่การชำระเงินหรือจัดเก็บโครงการ)',
    problem:'บันทึกไม่สำเร็จ กรุณาตรวจสิทธิ์โครงการ หลักฐานทั้ง 6 หมวด และรายการติดตาม',
    projectInactive:'โครงการถูกเก็บเข้าคลัง ไม่สามารถจัดทำหรือลงนามใหม่',
    status:'สถานะการปิดโครงการด้านปฏิบัติการ',warn:'รายการหนี้และงานคงค้างยังคงอยู่แม้ลงนามแล้ว',
    missing:'ยังไม่ลงนาม',reviewed:'ลงนามแล้ว',noteRequired:'เมื่อมีรายการคงค้างต้องระบุบันทึกเหตุผล',
    work:'งานและการรับมอบ',contracts:'ใบสั่งซื้อและสัญญาช่วง',
    finance:'เจ้าหนี้ ลูกหนี้ และการชำระเงิน',stock:'วัสดุ เครื่องมือ และทรัพย์สิน',
    budget:'BOQ งานเพิ่มลด และต้นทุน',docs:'ส่งมอบและเอกสารประกอบ',
  },
  'zh-TW': {
    title:'專案營運結案 — Khaimook／Ben／Nancy',
    scope:'僅記錄六類檢查及未結事項。簽核不會封存專案、付款、調整庫存、改動 BOQ 或授權正式環境部署。',
    empty:'尚未建立結案準備',version:'準備版本',
    category:'分類',state:'查核狀態',clear:'無待辦',warning:'尚有待辦',
    evidence:'來源證據／文件編號',observation:'證據及未解決問題備註',
    outstanding:'未結事項清冊',add:'新增追蹤項目',remove:'移除',
    description:'待辦事項',reason:'未結原因',
    owner:'負責人（在職公司員工）',due:'到期日',
    amount:'未結金額（泰銖）',quantity:'未結實物數量',
    uom:'單位',nonquant:'未能量化的原因',
    overall:'Khaimook 查核摘要',revision:'重新準備版本原因',
    prepare:'保存六類結案準備（歷史僅追加）',
    signed:'營運結案聯合簽核',ben:'Ben',nancy:'Nancy',
    note:'審閱備註（有待辦時必填）',
    sign:'簽核目前版本（非封存或付款）',
    problem:'保存失敗。請確認權限、六類證據、待辦負責人及來源版本。',
    projectInactive:'專案已封存，無法新建或簽核結案。',
    status:'營運結案進度',warn:'簽核後未結負債及事項仍然保留。',
    missing:'未簽核',reviewed:'已簽核',noteRequired:'有未結事項時必須提供原因備註。',
    work:'施工及客戶驗收',contracts:'採購及分包合約',
    finance:'應付／應收及付款',stock:'材料、工具及資產',
    budget:'BOQ、變更及成本',docs:'移交及佐證文件',
  },
} as const;
const categoryLabel:Record<CloseoutCategory,keyof typeof terms.en>={
  WORK_ACCEPTANCE:'work',PO_CONTRACTS:'contracts',AP_AR_PAYMENTS:'finance',
  STOCK_TOOLS_ASSETS:'stock',BOQ_VO_COST:'budget',HANDOVER_DOCUMENTS:'docs',
};
const startingChecklist=():CloseoutChecklist[]=>
  closeoutCategories.map(category=>({category,state:'CLEAR',evidenceNote:'',evidenceReference:''}));
const newFollowup=():CloseoutFollowup=>({
  category:'AP_AR_PAYMENTS',description:'',reason:'',ownerUserId:'',dueDate:'',
  remainingAmount:null,remainingQuantity:null,quantityUom:null,notQuantifiableReason:null,
});
export function ProjectCloseoutPanel({
  projectId,permissions,roleCodes,
}:{
  projectId:string;permissions:string[];roleCodes:string[];
}) {
  const locale=useContext(MonetaryLocaleContext);
  const t=terms[locale];
  const queryClient=useQueryClient();
  const eligible=permissions.includes('projects.project.view') &&
    roleCodes.some(role=>['PROJECT_MANAGER','MANAGEMENT','FINANCE_MANAGER'].includes(role));
  const [checklist,setChecklist]=useState<CloseoutChecklist[]>(startingChecklist);
  const [outstanding,setOutstanding]=useState<CloseoutFollowup[]>([]);
  const [overallNote,setOverallNote]=useState('');
  const [revisionReason,setRevisionReason]=useState('');
  const [signNote,setSignNote]=useState('');
  const closeout=useQuery({
    queryKey:['projects','closeout',projectId],
    queryFn:()=>projectsApi.closeout(projectId),
    enabled:Boolean(projectId&&eligible),
  });
  const result=closeout.isSuccess&&!closeout.isFetching&&
    closeout.data?.data.project.id===projectId?closeout.data.data:null;
  const owners=useQuery({
    queryKey:['projects','closeout','owners',projectId],
    queryFn:()=>projectsApi.closeoutOwners(projectId),
    enabled:Boolean(result?.canPrepare),
  });
  useEffect(()=>{
    if(!result)return;
    setChecklist(result.current?.preparation.checklist??startingChecklist());
    setOutstanding(result.current?.preparation.outstandingItems??[]);
    setOverallNote(result.current?.preparation.overallNote??'');
    setRevisionReason('');
    setSignNote('');
  },[result?.current?.eventId,projectId]);
  const refresh=()=>{
    void queryClient.invalidateQueries({queryKey:['projects','closeout',projectId]});
  };
  const prepare=useMutation({
    mutationFn:()=>projectsApi.prepareCloseout(projectId,{
      checklist,outstandingItems:outstanding,overallNote,
      revisionReason:result?.current?revisionReason:null,
    }),
    onSuccess:refresh,
  });
  const sign=useMutation({
    mutationFn:()=>projectsApi.signCloseout(projectId,result!.current!.fingerprint,signNote),
    onSuccess:refresh,
  });
  function updateCheck(index:number,key:'state'|'evidenceNote'|'evidenceReference',value:string){
    setChecklist(rows=>rows.map((row,i)=>i!==index?row:{
      ...row,[key]:value,
    } as CloseoutChecklist));
  }
  function updateFollowup(index:number,key:keyof CloseoutFollowup,value:string){
    const nullable=new Set<keyof CloseoutFollowup>([
      'remainingAmount','remainingQuantity','quantityUom','notQuantifiableReason',
    ]);
    setOutstanding(rows=>rows.map((row,i)=>i!==index?row:{
      ...row,[key]:nullable.has(key)?value||null:value,
    } as CloseoutFollowup));
  }
  if(!eligible)return null;
  return <Card variant="outlined" lang={locale}><CardContent>
    <Stack spacing={2}>
      <Typography variant="h6">{t.title}</Typography>
      <Alert severity="info">{t.scope}</Alert>
      {closeout.isError?<Alert severity="error">{t.problem}</Alert>:null}
      {result?<Stack spacing={2}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
          <Chip label={t.status+': '+result.status} color={result.status==='JOINTLY_APPROVED'?'success':'default'}/>
          {result.current?<Chip label={t.version+': '+result.current.version}/>:null}
        </Stack>
        {!result.current?<Typography>{t.empty}</Typography>:null}
        {result.current?<Box>
          <Typography variant="subtitle2">{t.signed}</Typography>
          <Typography variant="body2">{t.ben}: {result.current.signatures.BEN
            ? t.reviewed+' · '+result.current.signatures.BEN.userId
            :t.missing}</Typography>
          <Typography variant="body2">{t.nancy}: {result.current.signatures.NANCY
            ? t.reviewed+' · '+result.current.signatures.NANCY.userId
            :t.missing}</Typography>
          {result.current.preparation.outstandingItems.length>0?
            <Alert severity="warning">{t.warn}</Alert>:null}
        </Box>:null}
        {!result.project.isActive?<Alert severity="warning">{t.projectInactive}</Alert>:null}
        {result.canPrepare?<Stack spacing={2}>
          <Typography fontWeight={600}>{t.prepare}</Typography>
          {checklist.map((row,index)=><Stack key={row.category} spacing={1} sx={{borderTop:1,borderColor:'divider',pt:1}}>
            <Typography fontWeight={600}>{t[categoryLabel[row.category]]}</Typography>
            <TextField select label={t.state} value={row.state}
              onChange={e=>updateCheck(index,'state',e.target.value)}>
              <MenuItem value="CLEAR">{t.clear}</MenuItem>
              <MenuItem value="WARNING">{t.warning}</MenuItem>
            </TextField>
            <TextField label={t.evidence} value={row.evidenceReference}
              onChange={e=>updateCheck(index,'evidenceReference',e.target.value)}/>
            <TextField multiline minRows={2} label={t.observation} value={row.evidenceNote}
              onChange={e=>updateCheck(index,'evidenceNote',e.target.value)}/>
          </Stack>)}
          <Typography fontWeight={600}>{t.outstanding}</Typography>
          {outstanding.map((item,index)=><Stack key={index} spacing={1} sx={{border:1,borderColor:'divider',borderRadius:1,p:2}}>
            <TextField select label={t.category} value={item.category}
              onChange={e=>updateFollowup(index,'category',e.target.value)}>
              {closeoutCategories.map(cat=><MenuItem key={cat} value={cat}>{t[categoryLabel[cat]]}</MenuItem>)}
            </TextField>
            <TextField label={t.description} multiline value={item.description}
              onChange={e=>updateFollowup(index,'description',e.target.value)}/>
            <TextField label={t.reason} multiline value={item.reason}
              onChange={e=>updateFollowup(index,'reason',e.target.value)}/>
            <TextField select label={t.owner} value={item.ownerUserId}
              onChange={e=>updateFollowup(index,'ownerUserId',e.target.value)}>
              {(owners.data?.data??[]).map(u=><MenuItem key={u.id} value={u.id}>{u.displayName}</MenuItem>)}
            </TextField>
            <TextField type="date" label={t.due} value={item.dueDate}
              slotProps={{inputLabel:{shrink:true}}}
              onChange={e=>updateFollowup(index,'dueDate',e.target.value)}/>
            <Stack direction={{xs:'column',md:'row'}} spacing={1}>
              <TextField label={t.amount} value={item.remainingAmount??''}
                onChange={e=>updateFollowup(index,'remainingAmount',e.target.value)} fullWidth/>
              <TextField label={t.quantity} value={item.remainingQuantity??''}
                onChange={e=>updateFollowup(index,'remainingQuantity',e.target.value)} fullWidth/>
              <TextField label={t.uom} value={item.quantityUom??''}
                onChange={e=>updateFollowup(index,'quantityUom',e.target.value)} fullWidth/>
            </Stack>
            {!item.remainingAmount&&!item.remainingQuantity?
              <TextField label={t.nonquant} value={item.notQuantifiableReason??''}
                onChange={e=>updateFollowup(index,'notQuantifiableReason',e.target.value)}/>:null}
            <Button variant="text" onClick={() => setOutstanding(rows=>rows.filter((_,i)=>i!==index))}>{t.remove}</Button>
          </Stack>)}
          <Button variant="outlined" onClick={()=>setOutstanding(rows=>[...rows,newFollowup()])}>
            {t.add}
          </Button>
          <TextField multiline minRows={2} label={t.overall} value={overallNote}
            onChange={e=>setOverallNote(e.target.value)}/>
          {result.current?<TextField multiline label={t.revision} value={revisionReason}
            onChange={e=>setRevisionReason(e.target.value)}/>:null}
          <Button variant="contained" disabled={prepare.isPending} onClick={()=>prepare.mutate()}>{t.prepare}</Button>
          {prepare.isError?<Alert severity="error">{t.problem}</Alert>:null}
        </Stack>:null}
        {result.current&&!result.canPrepare?<Stack spacing={1}>
          {result.current.preparation.checklist.map(row=><Box key={row.category}>
            <Typography fontWeight={600}>{t[categoryLabel[row.category]]}: {row.state==='CLEAR'?t.clear:t.warning}</Typography>
            <Typography variant="body2">{row.evidenceReference} · {row.evidenceNote}</Typography>
          </Box>)}
          {result.current.preparation.outstandingItems.map((item,i)=><Alert key={i} severity="warning">
            {t.description}: {item.description} · {t.reason}: {item.reason} · {t.owner}: {item.ownerUserId}
            {' · '}{t.due}: {item.dueDate} · {t.amount}: {item.remainingAmount??'—'}
            {' · '}{t.quantity}: {item.remainingQuantity??'—'} {item.quantityUom??''}
          </Alert>)}
        </Stack>:null}
        {result.current&&
          ((result.canSignBen&&!result.current.signatures.BEN)||
           (result.canSignNancy&&!result.current.signatures.NANCY))?
          <Stack spacing={1}>
            <TextField multiline minRows={2} label={t.note} value={signNote}
              onChange={e=>setSignNote(e.target.value)}/>
            <Button variant="outlined" disabled={sign.isPending||
              (result.current.preparation.outstandingItems.length>0&&signNote.trim().length<8)}
              onClick={()=>sign.mutate()}>{t.sign}</Button>
            {sign.isError?<Alert severity="error">{t.problem}</Alert>:null}
          </Stack>:null}
      </Stack>:null}
    </Stack>
  </CardContent></Card>;
}
