import { useState } from 'react';
import { z } from 'zod';
import { apiRequest } from '../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import type { CurrentUser } from '../api/auth';
import { getHrCompanies, getHrEmployees, getHrEmploymentHistory } from './hr-api';
import { employmentCompanies, selectedHrCompany, selectedHrEmployee } from './hr-ui-policy';
import { HrCreateEmployee } from './HrCreateEmployee';
import { HrPrivatePanel } from './HrPrivatePanel';
import { HrDocumentsPanel } from './HrDocumentsPanel';
import { HrOfficeAttendancePanel } from './HrOfficeAttendancePanel';

type Language = 'en' | 'th' | 'zh-TW';
const labels = {
  en: {
    heading: 'Employees', language: 'Language', company: 'HR Company', employeeCode: 'Employee code',
    employeeName: 'Employee', job: 'Job title', status: 'Status', active: 'Active',
    inactive: 'Inactive', history: 'Employment history', version: 'Version',
    form: 'Employment form', basis: 'Pay basis (no salary)', site: 'Work type',
    start: 'Start', end: 'End', project: 'Project ID', created: 'Recorded',
    next: 'Next page', previous: 'Previous page', reload: 'Refresh',
    empty: 'No employee records in this page.', noHistory: 'No recorded employment history.',
    choose: 'Select an employee to view their recorded history.',
    unavailable: 'HR data is unavailable or your access has changed.',
    noCompany: 'No authorized HR employment Company is available.',
    chooseCompany: 'Previous HR Company access is no longer available. Select another authorized Company.',
    scope: 'Read-only employee and employment-history view. Financial details and private documents are excluded.',
  },
  th: {
    heading: 'ข้อมูลพนักงาน', language: 'ภาษา', company: 'บริษัทฝ่ายบุคคล', employeeCode: 'รหัสพนักงาน',
    employeeName: 'ชื่อพนักงาน', job: 'ตำแหน่ง', status: 'สถานะ', active: 'ใช้งาน',
    inactive: 'ไม่ใช้งาน', history: 'ประวัติการจ้างงาน', version: 'รุ่น',
    form: 'ประเภทการจ้าง', basis: 'เกณฑ์ค่าจ้าง (ไม่แสดงจำนวนเงิน)', site: 'ประเภทงาน',
    start: 'เริ่มต้น', end: 'สิ้นสุด', project: 'รหัสโครงการ', created: 'วันที่บันทึก',
    next: 'หน้าถัดไป', previous: 'หน้าก่อนหน้า', reload: 'รีเฟรช',
    empty: 'ไม่พบข้อมูลพนักงานในหน้านี้', noHistory: 'ยังไม่มีประวัติการจ้างงาน',
    choose: 'เลือกพนักงานเพื่อดูประวัติการจ้างงาน',
    unavailable: 'ไม่สามารถเข้าถึงข้อมูลฝ่ายบุคคลหรือสิทธิ์การเข้าถึงเปลี่ยนแปลง',
    noCompany: 'ไม่มีบริษัทที่ได้รับสิทธิ์ดูข้อมูลการจ้างงาน',
    chooseCompany: 'สิทธิ์เข้าถึงบริษัทเดิมไม่พร้อมใช้งาน กรุณาเลือกบริษัทที่ได้รับอนุญาต',
    scope: 'ดูข้อมูลพนักงานและประวัติการจ้างงานเท่านั้น ไม่แสดงข้อมูลการเงินหรือเอกสารส่วนตัว',
  },
  'zh-TW': {
    heading: '員工資料', language: '語言', company: '人事公司', employeeCode: '員工編號',
    employeeName: '員工', job: '職稱', status: '狀態', active: '在職',
    inactive: '停用', history: '聘僱歷史', version: '版本',
    form: '聘僱形式', basis: '薪資類型（不顯示金額）', site: '工作類型',
    start: '開始', end: '結束', project: '專案代碼', created: '記錄日期',
    next: '下一頁', previous: '上一頁', reload: '重新整理',
    empty: '本頁沒有員工資料', noHistory: '尚無聘僱歷史',
    choose: '請選擇員工查看聘僱記錄',
    unavailable: '人事資料無法使用，或您的存取權限已變更',
    noCompany: '沒有獲授權檢視聘僱資料的公司',
    chooseCompany: '原選定公司已無存取權限，請另選有權限的公司',
    scope: '僅供檢視員工和聘僱歷史，不包含財務資料或私人文件',
  },
} satisfies Record<Language, Record<string, string>>;

const dateOnly = (value: string | null) => value ? value.slice(0, 10) : '—';

export function HrWorkspace({ user }: { user: CurrentUser }) {
  const [language, setLanguage] = useState<Language>('en');
  const [requestedCompany, setRequestedCompany] = useState('');
  const [requestedEmployee, setRequestedEmployee] = useState('');
  const [pageCursors, setPageCursors] = useState<string[]>(['']);
  const queryClient = useQueryClient();
  const t = labels[language];
  const canView = user.permissions.includes('hr.employment.view');

  const companiesQuery = useQuery({
    queryKey: ['hr1-a', user.id, user.companyId, 'companies'],
    queryFn: getHrCompanies, enabled: canView, retry: false,
    refetchOnWindowFocus: true, refetchInterval: 15000, gcTime: 0,
  });
  const companies = employmentCompanies(companiesQuery.data ?? []);
  const companyId = selectedHrCompany(requestedCompany, companies);
  const after = pageCursors[pageCursors.length - 1] ?? '';
  const employeesQuery = useQuery({
    queryKey: ['hr1-a', user.id, user.companyId, companyId, 'employees', after],
    queryFn: () => getHrEmployees(companyId, after),
    enabled: canView && Boolean(companyId) && !companiesQuery.isError,
    retry: false, refetchOnWindowFocus: true, refetchInterval: 15000, gcTime: 0,
  });
  // A stale employee selection from a different Company/page is never reused.
  const employeeId = selectedHrEmployee(requestedEmployee, employeesQuery.data?.items ?? []);
  const historyQuery = useQuery({
    queryKey: ['hr1-a', user.id, user.companyId, companyId, 'employment', employeeId],
    queryFn: () => getHrEmploymentHistory(companyId, employeeId),
    enabled: canView && Boolean(companyId && employeeId) &&
      !companiesQuery.isError && !employeesQuery.isError,
    retry: false, refetchOnWindowFocus: true, refetchInterval: 15000, gcTime: 0,
  });

  const changeCompany = (id: string) => {
    setRequestedEmployee('');
    setPageCursors(['']);
    setRequestedCompany(id);
    // Do not preserve old target-Company employee/history responses on a switch.
    queryClient.removeQueries({ queryKey: ['hr1-a', user.id, user.companyId] });
  };
  const movePage = (direction: 'next' | 'previous') => {
    setRequestedEmployee('');
    setPageCursors(current => direction === 'previous'
      ? (current.length > 1 ? current.slice(0, -1) : current)
      : [...current, employeesQuery.data?.nextCursor ?? '']);
  };

  if (!canView) return null;
  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }}>
      <Typography variant="h5" sx={{ flexGrow: 1 }}>{t.heading}</Typography>
      <TextField select size="small" label={t.language} value={language}
        onChange={event => setLanguage(event.target.value as Language)} sx={{ minWidth: 145 }}>
        <MenuItem value="en">English</MenuItem>
        <MenuItem value="th">ไทย</MenuItem>
        <MenuItem value="zh-TW">繁體中文</MenuItem>
      </TextField>
      <TextField select size="small" label={t.company} value={companyId}
        disabled={!companies.length || companiesQuery.isError}
        onChange={event => changeCompany(event.target.value)} sx={{ minWidth: 220 }}>
        <MenuItem disabled value="">—</MenuItem>
        {companies.map(company => <MenuItem key={company.id} value={company.id}>
          {company.companyCode} — {company.companyName}
        </MenuItem>)}
      </TextField>
    </Stack>
    <Alert severity="info">{t.scope}</Alert>
    {companiesQuery.isPending ? <CircularProgress size={24}/> : companiesQuery.isError ?
      <Alert severity="warning">{t.unavailable}</Alert> : !companies.length ?
      <Alert severity="info">{t.noCompany}</Alert> : !companyId ?
      <Alert severity="warning">{t.chooseCompany}</Alert> : <>
        {user.permissions.includes('hr.employment.manage') &&
          companies.some(company => company.id === companyId &&
            company.permissions.includes('hr.employment.manage')) &&
          <HrCreateEmployee key={companyId} companyId={companyId} language={language}
            onCreated={() => {
              setRequestedEmployee('');
              setPageCursors(['']);
              void queryClient.invalidateQueries({
                queryKey: ['hr1-a', user.id, user.companyId, companyId, 'employees'],
              });
            }} />}
        {!companiesQuery.isError && user.permissions.includes('hr.attendance.office.manage') &&
          <HrOfficeAttendancePanel key={user.id+':'+companyId} user={user} companyId={companyId} language={language} />}
        {user.permissions.includes('hr.attendance.review') &&
          companies.some(company => company.id === companyId && company.permissions.includes('hr.employment.view')) &&
          <HrAttendanceReview key={user.id+':'+companyId} user={user} companyId={companyId} language={language}/>}
        <Paper variant="outlined">
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
            <Button onClick={() => void employeesQuery.refetch()} disabled={employeesQuery.isFetching}>{t.reload}</Button>
          </Box>
          {employeesQuery.isPending ? <Box sx={{ p: 2 }}><CircularProgress size={24}/></Box> :
            employeesQuery.isError ? <Alert severity="warning">{t.unavailable}</Alert> :
            <TableContainer><Table size="small">
              <TableHead><TableRow>
                <TableCell>{t.employeeCode}</TableCell><TableCell>{t.employeeName}</TableCell>
                <TableCell>{t.job}</TableCell><TableCell>{t.status}</TableCell>
              </TableRow></TableHead>
              <TableBody>{employeesQuery.data.items.map(employee => <TableRow key={employee.id}
                hover selected={employee.id === employeeId}
                onClick={() => setRequestedEmployee(employee.id)}
                sx={{ cursor: 'pointer' }}>
                <TableCell>{employee.employeeCode}</TableCell><TableCell>{employee.employeeName}</TableCell>
                <TableCell>{employee.jobTitle ?? '—'}</TableCell>
                <TableCell>{employee.isActive ? t.active : t.inactive}</TableCell>
              </TableRow>)}</TableBody>
            </Table></TableContainer>}
          {employeesQuery.isSuccess && !employeesQuery.data.items.length &&
            <Typography sx={{ p: 2 }}>{t.empty}</Typography>}
          <Stack direction="row" gap={1} sx={{ p: 1 }}>
            <Button disabled={pageCursors.length <= 1 || employeesQuery.isFetching}
              onClick={() => movePage('previous')}>{t.previous}</Button>
            <Button disabled={!employeesQuery.data?.nextCursor || employeesQuery.isFetching}
              onClick={() => movePage('next')}>{t.next}</Button>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{t.history}</Typography>
          {!employeeId ? <Typography>{t.choose}</Typography> : historyQuery.isPending ?
            <CircularProgress size={24}/> : historyQuery.isError ?
            <Alert severity="warning">{t.unavailable}</Alert> : !historyQuery.data.employment?.revisions.length ?
            <Typography>{t.noHistory}</Typography> :
            <TableContainer><Table size="small">
              <TableHead><TableRow>
                <TableCell>{t.version}</TableCell><TableCell>{t.form}</TableCell>
                <TableCell>{t.basis}</TableCell><TableCell>{t.site}</TableCell>
                <TableCell>{t.start}</TableCell><TableCell>{t.end}</TableCell>
                <TableCell>{t.project}</TableCell><TableCell>{t.created}</TableCell>
              </TableRow></TableHead>
              <TableBody>{historyQuery.data.employment.revisions.map(revision =>
                <TableRow key={revision.id}>
                  <TableCell>{revision.version}</TableCell><TableCell>{revision.employmentForm}</TableCell>
                  <TableCell>{revision.payBasis}</TableCell><TableCell>{revision.siteKind}</TableCell>
                  <TableCell>{dateOnly(revision.startDate)}</TableCell>
                  <TableCell>{dateOnly(revision.endDate)}</TableCell>
                  <TableCell>{revision.projectId ?? '—'}</TableCell>
                  <TableCell>{dateOnly(revision.createdAt)}</TableCell>
                </TableRow>)}</TableBody>
            </Table></TableContainer>}
        </Paper>
        {!companiesQuery.isError && !employeesQuery.isError && employeeId &&
          (['identity', 'bank'] as const)
            .filter(kind => user.permissions.includes('hr.' + kind + '.view') &&
              companies.some(company => company.id === companyId &&
                company.categories.includes(kind) &&
                company.permissions.includes('hr.' + kind + '.view')))
            .map(kind => <HrPrivatePanel key={companyId + ':' + employeeId + ':' + kind}
              companyId={companyId} employeeId={employeeId} category={kind} language={language}
              revalidating={companiesQuery.isFetching || employeesQuery.isFetching}
              canManage={user.permissions.includes('hr.' + kind + '.manage') &&
                companies.some(company => company.id === companyId &&
                  company.permissions.includes('hr.' + kind + '.manage'))} />)}
        {!companiesQuery.isError && !employeesQuery.isError && employeeId &&
          user.permissions.includes('hr.documents.view') &&
          companies.some(company => company.id === companyId &&
            company.categories.includes('documents') &&
            company.permissions.includes('hr.documents.view')) &&
          <HrDocumentsPanel key={companyId + ':' + employeeId} userId={user.id}
            companyId={companyId} employeeId={employeeId} language={language}
            revalidating={companiesQuery.isFetching || employeesQuery.isFetching}
            canManage={user.permissions.includes('hr.documents.manage') &&
              companies.some(company => company.id === companyId &&
                company.permissions.includes('hr.documents.manage'))} />}
      </>}
  </Stack>;
}

/** Bounded HR review: existing scoped endpoints; no role grants or salary data. */
const reviewVersion=z.number().int().positive();
const reviewMeta=z.object({version:reviewVersion,state:z.enum(['DRAFT','SUBMITTED','RETURNED']),
  action:z.enum(['CREATE','EDIT','SUBMIT','RETURN','RESUBMIT','HR_CORRECT']),reason:z.string().nullable(),createdAt:z.string()});
const reviewSnapshot=reviewMeta.extend({projectId:z.string().uuid(),periodStart:z.string(),lines:z.array(z.object({
  employee:z.object({employeeCode:z.string(),employeeName:z.string()}),workDate:z.string(),
  startMinute:z.number().int().min(0).max(1439),endMinute:z.number().int().min(1).max(1440),workType:z.string(),
  allocation:z.object({targetCompanyId:z.string().uuid(),targetProjectId:z.string().uuid()}).nullable()
})).max(1000)});
const reviewHistory=z.object({items:z.array(reviewMeta).max(50),nextBefore:reviewVersion.nullable()});
const reviewLabels={
  en:{title:'Site attendance review',project:'Project ID',period:'Period start (1st or 16th)',open:'Open',refresh:'Refresh',history:'Revision history',current:'Current version',older:'Older versions',newest:'Newest versions',none:'No attendance recorded.',error:'Attendance unavailable or access changed.',reason:'Return reason',send:'Return to site for correction',returned:'Return recorded.',worker:'Employee',day:'Date',start:'In',end:'Out',work:'Work type',destination:'Allocated destination',version:'Version',state:'State'},
  th:{title:'ตรวจสอบเวลาทำงานไซต์',project:'รหัสโครงการ',period:'วันเริ่มงวด (วันที่ 1 หรือ 16)',open:'เปิด',refresh:'รีเฟรช',history:'ประวัติการแก้ไข',current:'รุ่นปัจจุบัน',older:'รุ่นเก่ากว่า',newest:'รุ่นล่าสุด',none:'ยังไม่มีข้อมูลเวลาทำงาน',error:'ไม่สามารถเข้าถึงข้อมูลหรือสิทธิ์เปลี่ยนแปลง',reason:'เหตุผลที่ส่งคืน',send:'ส่งคืนไซต์เพื่อแก้ไข',returned:'บันทึกการส่งคืนแล้ว',worker:'พนักงาน',day:'วันที่',start:'เข้า',end:'ออก',work:'ประเภทงาน',destination:'โครงการที่จัดสรร',version:'รุ่น',state:'สถานะ'},
  'zh-TW':{title:'工地出勤審查',project:'專案 ID',period:'期間開始日（1 日或 16 日）',open:'開啟',refresh:'重新整理',history:'修訂歷史',current:'目前版本',older:'較早版本',newest:'最新版本',none:'尚無出勤記錄。',error:'出勤資料無法使用或存取權限已變更。',reason:'退回原因',send:'退回工地更正',returned:'已記錄退回。',worker:'員工',day:'日期',start:'上班',end:'下班',work:'工作類型',destination:'分配目的地',version:'版本',state:'狀態'},
} satisfies Record<Language,Record<string,string>>;
function HrAttendanceReview({user,companyId,language}:{user:CurrentUser;companyId:string;language:Language}){
  const t=reviewLabels[language];
  const [project,setProject]=useState('');
  const [period,setPeriod]=useState('');
  const [target,setTarget]=useState<{project:string;period:string}|null>(null);
  return <Paper variant="outlined" sx={{p:2}}><Stack spacing={2}>
    <Typography variant="h6">{t.title}</Typography>
    <Stack direction={{xs:'column',sm:'row'}} gap={1}>
      <TextField size="small" label={t.project} value={project} onChange={e=>{setProject(e.target.value);setTarget(null);}}/>
      <TextField size="small" type="date" label={t.period} slotProps={{inputLabel:{shrink:true}}} value={period} onChange={e=>{setPeriod(e.target.value);setTarget(null);}}/>
      <Button disabled={!z.string().uuid().safeParse(project.trim()).success||!/^\d{4}-\d{2}-(01|16)$/.test(period)} onClick={()=>setTarget({project:project.trim(),period})}>{t.open}</Button>
    </Stack>
    {target&&<HrAttendanceReviewPeriod key={companyId+':'+target.project+':'+target.period} user={user} companyId={companyId} projectId={target.project} period={target.period} language={language}/>}
  </Stack></Paper>;
}
function HrAttendanceReviewPeriod({user,companyId,projectId,period,language}:{user:CurrentUser;companyId:string;projectId:string;period:string;language:Language}){
  const t=reviewLabels[language];
  const [version,setVersion]=useState<number|null>(null);
  const [before,setBefore]=useState<number|null>(null);
  const [reason,setReason]=useState('');
  const [reasonVersion,setReasonVersion]=useState<number|null>(null);
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(false);
  const [returned,setReturned]=useState(false);
  const route='/hr/companies/'+encodeURIComponent(companyId)+'/projects/'+encodeURIComponent(projectId)+'/attendance/'+encodeURIComponent(period);
  const key=['hr02-review',user.id,user.companyId,companyId,projectId,period];
  const current=useQuery({queryKey:[...key,'current'],queryFn:async()=>z.object({data:reviewSnapshot.nullable()}).parse(await apiRequest<unknown>(route)).data,
    retry:false,gcTime:0,refetchInterval:15000,refetchOnWindowFocus:true});
  const history=useQuery({queryKey:[...key,'history',before],queryFn:async()=>z.object({data:reviewHistory}).parse(await apiRequest<unknown>(route+'/history'+(before===null?'':'?before='+before))).data,
    enabled:current.isSuccess&&current.data!==null,retry:false,gcTime:0,refetchOnWindowFocus:true});
  const previous=useQuery({queryKey:[...key,'version',version],queryFn:async()=>z.object({data:reviewSnapshot.nullable()}).parse(await apiRequest<unknown>(route+'/history/'+version)).data,
    enabled:version!==null&&current.isSuccess&&current.data!==null,retry:false,gcTime:0,refetchOnWindowFocus:true});
  const clock=(m:number)=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const snapshot=version===null?current.data:previous.data;
  const selectVersion=(v:number|null)=>{setVersion(v);setReason('');setRequestId(crypto.randomUUID());setError(false);setReturned(false);};
  const submitReturn=async()=>{
    if(busy||version!==null||!current.isSuccess||current.isFetching||current.data?.state!=='SUBMITTED'||reasonVersion!==current.data.version||!reason.trim())return;
    setBusy(true);setError(false);setReturned(false);
    try{
      await apiRequest<unknown>(route,{method:'POST',body:JSON.stringify({requestId,expectedVersion:current.data.version,action:'RETURN',reason:reason.trim()})});
      setReason('');setRequestId(crypto.randomUUID());setReturned(true);setBefore(null);
      await Promise.all([current.refetch(),history.refetch()]);
    }catch{setError(true);await current.refetch();}
    finally{setBusy(false);}
  };
  if(current.isError||history.isError||previous.isError)return <Alert severity="warning">{t.error}</Alert>;
  if(!current.isSuccess)return <CircularProgress size={24}/>;
  if(!current.data)return <Typography>{t.none}</Typography>;
  return <Stack spacing={2}>
    <Stack direction="row" gap={1}><Button disabled={busy} onClick={()=>selectVersion(null)}>{t.current}</Button>
      <Button disabled={busy} onClick={()=>{void current.refetch();void history.refetch();if(version!==null)void previous.refetch();}}>{t.refresh}</Button></Stack>
    <Typography variant="subtitle2">{t.history}</Typography>
    {history.data?.items.map(r=><Stack direction="row" gap={1} key={r.version} alignItems="center">
      <Button disabled={busy} onClick={()=>selectVersion(r.version)}>{t.version} {r.version}</Button><Typography variant="body2">{r.state} · {r.action} · {r.createdAt.slice(0,10)}</Typography>
    </Stack>)}
    <Stack direction="row" gap={1}><Button disabled={before===null||busy} onClick={()=>setBefore(null)}>{t.newest}</Button>
      <Button disabled={!history.data?.nextBefore||busy} onClick={()=>setBefore(history.data?.nextBefore??null)}>{t.older}</Button></Stack>
    {snapshot&&<><Typography>{t.version} {snapshot.version} · {t.state}: {snapshot.state}</Typography>
      {snapshot.reason&&<Typography variant="body2">{snapshot.reason}</Typography>}
      <TableContainer><Table size="small"><TableHead><TableRow>{[t.worker,t.day,t.start,t.end,t.work,t.destination].map(v=><TableCell key={v}>{v}</TableCell>)}</TableRow></TableHead>
      <TableBody>{snapshot.lines.map((r,i)=><TableRow key={i}><TableCell>{r.employee.employeeCode} — {r.employee.employeeName}</TableCell>
        <TableCell>{r.workDate.slice(0,10)}</TableCell><TableCell>{clock(r.startMinute)}</TableCell><TableCell>{clock(r.endMinute)}</TableCell><TableCell>{r.workType}</TableCell>
        <TableCell>{r.allocation?r.allocation.targetCompanyId+' / '+r.allocation.targetProjectId:'—'}</TableCell></TableRow>)}</TableBody></Table></TableContainer></>}
    {error&&<Alert severity="warning">{t.error}</Alert>}{returned&&<Alert severity="success">{t.returned}</Alert>}
    {version===null&&current.data.state==='SUBMITTED'&&<><TextField label={t.reason} value={reason} disabled={busy} inputProps={{maxLength:1000}} onChange={e=>{setReason(e.target.value);setReasonVersion(current.data?.version??null);setRequestId(crypto.randomUUID());setError(false);}}/>
      <Button variant="contained" disabled={busy||current.isFetching||reasonVersion!==current.data.version||!reason.trim()} onClick={()=>void submitReturn()}>{t.send}</Button></>}
  </Stack>;
}
