import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Alert,Button,Paper,Stack,TextField,Typography,Table,TableBody,TableCell,TableContainer,TableHead,TableRow} from '@mui/material';
import type {CurrentUser} from '../api/auth';
import {getOfficeAttendance,previewOfficeAttendance,saveOfficeAttendance,type OfficePreview} from './hr-attendance-api';

type Language='en'|'th'|'zh-TW';
const labels={
 en:{title:'Office attendance',period:'Period start (1st or 16th)',open:'Open period',load:'Refresh',empty:'No recorded office attendance.',version:'Version',file:'Select normalized UTF-8 CSV',format:'CSV header: employeeCode,workDate,startTime,endTime,workType. Use YYYY-MM-DD and HH:mm. Preview replaces the full period snapshot only after confirmation.',preview:'Preview file',previewTitle:'Preview — not saved',reason:'Reason for recording or correction',save:'Confirm and save entire period',saved:'Saved. Refresh to read the recorded version.',error:'Unable to access or process attendance. Check the file, permissions and current version.',stale:'The period changed. Preview the file again.',worker:'Employee',day:'Date',start:'In',end:'Out',work:'Work type',clear:'Clear preview',raw:'Raw time only. No payroll approval or calculation.'},
 th:{title:'เวลาทำงานสำนักงาน',period:'วันเริ่มงวด (วันที่ 1 หรือ 16)',open:'เปิดงวด',load:'รีเฟรช',empty:'ยังไม่มีข้อมูลเวลาทำงานสำนักงาน',version:'รุ่น',file:'เลือกไฟล์ CSV UTF-8 ตามรูปแบบ',format:'หัวตาราง CSV: employeeCode,workDate,startTime,endTime,workType ใช้ YYYY-MM-DD และ HH:mm ข้อมูลตัวอย่างจะแทนทั้งงวดเมื่อยืนยันเท่านั้น',preview:'ตรวจตัวอย่างไฟล์',previewTitle:'ตัวอย่าง — ยังไม่บันทึก',reason:'เหตุผลในการบันทึกหรือแก้ไข',save:'ยืนยันและบันทึกทั้งงวด',saved:'บันทึกแล้ว รีเฟรชเพื่อดูข้อมูล',error:'ไม่สามารถเข้าถึงหรือประมวลผล กรุณาตรวจสอบไฟล์ สิทธิ์ และรุ่นข้อมูล',stale:'ข้อมูลงวดเปลี่ยนแปลง กรุณาตรวจตัวอย่างใหม่',worker:'พนักงาน',day:'วันที่',start:'เข้า',end:'ออก',work:'ประเภทงาน',clear:'ล้างตัวอย่าง',raw:'ข้อมูลเวลาดิบเท่านั้น ไม่ใช่การอนุมัติหรือคำนวณค่าจ้าง'},
 'zh-TW':{title:'辦公室出勤',period:'期間開始日（1 日或 16 日）',open:'開啟期間',load:'重新整理',empty:'尚無辦公室出勤記錄。',version:'版本',file:'選擇標準 UTF-8 CSV 檔',format:'CSV 欄名：employeeCode,workDate,startTime,endTime,workType。日期與時間格式 YYYY-MM-DD、HH:mm。確認後才會取代整個期間快照。',preview:'預覽檔案',previewTitle:'預覽 — 尚未儲存',reason:'登錄或更正原因',save:'確認並儲存整個期間',saved:'已儲存。重新整理以檢視記錄版本。',error:'無法存取或處理出勤。請檢查檔案、權限與目前版本。',stale:'期間已變更，請重新預覽檔案。',worker:'員工',day:'日期',start:'上班',end:'下班',work:'工作類型',clear:'清除預覽',raw:'僅記錄原始時間，不代表薪資核准或計算。'}
} satisfies Record<Language,Record<string,string>>;
const clock=(v:number)=>String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');
export function HrOfficeAttendancePanel({user,companyId,language}:{user:CurrentUser;companyId:string;language:Language}){
  const [input,setInput]=useState('');
  const [period,setPeriod]=useState('');
  const t=labels[language];
  return <Paper variant="outlined" sx={{p:2}}><Stack spacing={2}>
    <Typography variant="h6">{t.title}</Typography><Alert severity="info">{t.raw}</Alert>
    <Stack direction={{xs:'column',sm:'row'}} gap={1}>
      <TextField size="small" type="date" label={t.period} slotProps={{inputLabel:{shrink:true}}} value={input} onChange={e=>setInput(e.target.value)}/>
      <Button disabled={!/^\d{4}-\d{2}-(01|16)$/.test(input)} onClick={()=>setPeriod(input)}>{t.open}</Button>
    </Stack>
    {period&&<Period key={companyId+':'+period} user={user} companyId={companyId} period={period} language={language}/>}
  </Stack></Paper>;
}
function Period({user,companyId,period,language}:{user:CurrentUser;companyId:string;period:string;language:Language}){
  const t=labels[language];
  const query=useQuery({queryKey:['hr02-office',user.id,user.companyId,companyId,period],
    queryFn:()=>getOfficeAttendance(companyId,period),retry:false,gcTime:0,refetchInterval:15000,refetchOnWindowFocus:true});
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<OfficePreview|null>(null);
  const [reason,setReason]=useState('');
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(false);
  const [saved,setSaved]=useState(false);
  const reset=()=>{setPreview(null);setReason('');setRequestId(crypto.randomUUID());setError(false);setSaved(false);};
  const version=query.data?.version??0;
  const stale=preview!==null&&preview.expectedVersion!==version;
  const readFile=async()=>{
    if(!file||file.size>262144||!query.isSuccess||busy)return;
    reset();setBusy(true);
    try{setPreview(await previewOfficeAttendance(companyId,period,await file.text(),version));}
    catch{setError(true);}
    finally{setBusy(false);}
  };
  const save=async()=>{
    if(!preview||!query.isSuccess||stale||!reason.trim()||busy)return;
    setBusy(true);setError(false);
    try{await saveOfficeAttendance(companyId,period,{...preview,reason:reason.trim(),requestId});reset();setFile(null);setSaved(true);await query.refetch();}
    catch{setError(true);}
    finally{setBusy(false);}
  };
  if(query.isError)return <Alert severity="warning">{t.error}</Alert>;
  if(!query.isSuccess)return <Button disabled>…</Button>;
  const rows=preview?.lines??query.data?.lines??[];
  const names=new Map(query.data?.lines.map(l=>[l.employeeId,l.employee.employeeCode+' — '+l.employee.employeeName])??[]);
  return <Stack spacing={2}>
    <Stack direction="row" justifyContent="space-between"><Typography>{period} · {t.version} {version}</Typography><Button disabled={busy} onClick={()=>void query.refetch()}>{t.load}</Button></Stack>
    {!query.data&&<Typography>{t.empty}</Typography>}
    <Typography variant="body2">{t.format}</Typography>
    <Button component="label" disabled={busy}>{t.file}<input hidden type="file" accept=".csv,text/csv" onChange={e=>{reset();const f=e.target.files?.[0]??null;setFile(f&&f.size<=262144?f:null);if(f&&f.size>262144)setError(true);e.target.value='';}}/></Button>
    {file&&<Typography variant="body2">{file.name}</Typography>}
    <Button variant="outlined" disabled={!file||busy} onClick={()=>void readFile()}>{t.preview}</Button>
    {error&&<Alert severity="warning">{t.error}</Alert>}{saved&&<Alert severity="success">{t.saved}</Alert>}
    {stale&&<Alert severity="warning">{t.stale}</Alert>}
    {preview&&<Alert severity="info">{t.previewTitle}</Alert>}
    {rows.length>0&&<TableContainer><Table size="small"><TableHead><TableRow>
      {[t.worker,t.day,t.start,t.end,t.work].map(x=><TableCell key={x}>{x}</TableCell>)}
    </TableRow></TableHead><TableBody>{rows.map((r,i)=><TableRow key={i}>
      <TableCell>{names.get(r.employeeId)??r.employeeId}</TableCell><TableCell>{r.workDate.slice(0,10)}</TableCell>
      <TableCell>{clock(r.startMinute)}</TableCell><TableCell>{clock(r.endMinute)}</TableCell><TableCell>{r.workType}</TableCell>
    </TableRow>)}</TableBody></Table></TableContainer>}
    {preview&&<><TextField label={t.reason} value={reason} disabled={busy} inputProps={{maxLength:1000}} onChange={e=>{setReason(e.target.value);setRequestId(crypto.randomUUID());setError(false);}}/>
      <Stack direction="row" gap={1}><Button onClick={reset} disabled={busy}>{t.clear}</Button>
      <Button variant="contained" disabled={busy||stale||!reason.trim()} onClick={()=>void save()}>{t.save}</Button></Stack></>}
  </Stack>;
}
