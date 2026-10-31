import { useState } from 'react';
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { createHrEmployee } from './hr-api';
import type { HrEmployeeCreate } from './hr-api';

type Language = 'en' | 'th' | 'zh-TW';
const translations = {
  en: {
    title: 'Register employee', code: 'Employee code', name: 'Employee name',
    job: 'Job title (optional)', pay: 'Pay basis (no amount)', form: 'Employment form',
    site: 'Office / site', start: 'Start date', end: 'End date (optional)',
    project: 'Project UUID (optional)', approval: 'Verified hiring approval reference',
    reason: 'Registration reason', add: 'Create employee', success: 'Employee successfully registered.',
    error: 'The employee could not be registered. Check your authorization and entered information.',
    disclaimer: 'Record a real Ben (office) or Khaimook (site) hiring approval reference. This form cannot approve hiring.',
  },
  th: {
    title: 'ลงทะเบียนพนักงาน', code: 'รหัสพนักงาน', name: 'ชื่อพนักงาน',
    job: 'ตำแหน่ง (ไม่บังคับ)', pay: 'ประเภทค่าจ้าง (ไม่แสดงจำนวนเงิน)', form: 'ประเภทการจ้าง',
    site: 'สำนักงาน / ไซต์งาน', start: 'วันเริ่มงาน', end: 'วันสิ้นสุด (ไม่บังคับ)',
    project: 'รหัส UUID โครงการ (ไม่บังคับ)', approval: 'เลขอ้างอิงการอนุมัติจ้างที่ตรวจสอบแล้ว',
    reason: 'เหตุผลในการลงทะเบียน', add: 'สร้างข้อมูลพนักงาน', success: 'ลงทะเบียนพนักงานสำเร็จ',
    error: 'ไม่สามารถลงทะเบียนได้ กรุณาตรวจสอบสิทธิ์และข้อมูล',
    disclaimer: 'ต้องอ้างอิงการอนุมัติจริงจาก Ben (สำนักงาน) หรือ Khaimook (ไซต์งาน) แบบฟอร์มนี้ไม่ใช่การอนุมัติจ้าง',
  },
  'zh-TW': {
    title: '建立員工資料', code: '員工編號', name: '員工姓名',
    job: '職稱（選填）', pay: '薪資類型（不顯示金額）', form: '聘僱形式',
    site: '辦公室／工地', start: '開始日期', end: '結束日期（選填）',
    project: '專案 UUID（選填）', approval: '已核實聘僱核准參考編號',
    reason: '登錄原因', add: '建立員工', success: '員工已成功建立',
    error: '無法建立員工，請檢查權限與輸入資料',
    disclaimer: '必須填入 Ben（辦公室）或 Khaimook（工地）的真實聘僱核准參考資料；本表單不會核准聘僱',
  },
} satisfies Record<Language, Record<string, string>>;

type Fields = {
  employeeCode: string; employeeName: string; jobTitle: string;
  payBasis: HrEmployeeCreate['facts']['payBasis'];
  employmentForm: HrEmployeeCreate['facts']['employmentForm'];
  siteKind: HrEmployeeCreate['facts']['siteKind'];
  startDate: string; endDate: string; projectId: string;
  hiringApprovalReference: string; reason: string;
};
const emptyFields = (): Fields => ({
  employeeCode: '', employeeName: '', jobTitle: '', payBasis: 'MONTHLY',
  employmentForm: 'PROBATION', siteKind: 'OFFICE', startDate: '', endDate: '',
  projectId: '', hiringApprovalReference: '', reason: '',
});

export function HrCreateEmployee({ companyId, language, onCreated }: {
  companyId: string; language: Language; onCreated: () => void;
}) {
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const t = translations[language];
  const change = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields(previous => ({ ...previous, [key]: value }));
    // A changed body must never reuse a previous idempotency key.
    setRequestId(crypto.randomUUID());
    setError(false);
    setSuccess(false);
  };
  const valid = Boolean(fields.employeeCode.trim() && fields.employeeName.trim() &&
    fields.startDate && fields.hiringApprovalReference.trim() && fields.reason.trim() &&
    (!fields.endDate || fields.endDate >= fields.startDate));

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(false); setSuccess(false);
    try {
      await createHrEmployee(companyId, {
        requestId,
        employeeCode: fields.employeeCode.trim(),
        employeeName: fields.employeeName.trim(),
        jobTitle: fields.jobTitle.trim() || null,
        facts: {
          payBasis: fields.payBasis, employmentForm: fields.employmentForm,
          siteKind: fields.siteKind, startDate: fields.startDate,
          endDate: fields.endDate || null, projectId: fields.projectId.trim() || null,
          hiringApprovalReference: fields.hiringApprovalReference.trim(),
          reason: fields.reason.trim(),
        },
      });
      setFields(emptyFields());
      setRequestId(crypto.randomUUID());
      setSuccess(true);
      onCreated();
    } catch {
      // Keep the same requestId on retry after a network failure: if the
      // backend committed the first attempt, replay returns that receipt.
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack spacing={2}>
      <Typography variant="h6">{t.title}</Typography>
      <Alert severity="info">{t.disclaimer}</Alert>
      {error && <Alert severity="warning">{t.error}</Alert>}
      {success && <Alert severity="success">{t.success}</Alert>}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
        <TextField fullWidth size="small" required label={t.code} value={fields.employeeCode}
          inputProps={{ maxLength: 50 }} onChange={e => change('employeeCode', e.target.value)} />
        <TextField fullWidth size="small" required label={t.name} value={fields.employeeName}
          inputProps={{ maxLength: 200 }} onChange={e => change('employeeName', e.target.value)} />
        <TextField fullWidth size="small" label={t.job} value={fields.jobTitle}
          inputProps={{ maxLength: 150 }} onChange={e => change('jobTitle', e.target.value)} />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
        <TextField select fullWidth size="small" label={t.pay} value={fields.payBasis}
          onChange={e => change('payBasis', e.target.value as Fields['payBasis'])}>
          <MenuItem value="MONTHLY">MONTHLY</MenuItem><MenuItem value="DAILY">DAILY</MenuItem>
        </TextField>
        <TextField select fullWidth size="small" label={t.form} value={fields.employmentForm}
          onChange={e => change('employmentForm', e.target.value as Fields['employmentForm'])}>
          <MenuItem value="PROBATION">PROBATION</MenuItem><MenuItem value="PERMANENT">PERMANENT</MenuItem>
          <MenuItem value="FIXED_TERM">FIXED_TERM</MenuItem><MenuItem value="TEMPORARY">TEMPORARY</MenuItem>
        </TextField>
        <TextField select fullWidth size="small" label={t.site} value={fields.siteKind}
          onChange={e => change('siteKind', e.target.value as Fields['siteKind'])}>
          <MenuItem value="OFFICE">OFFICE</MenuItem><MenuItem value="SITE">SITE</MenuItem>
        </TextField>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
        <TextField fullWidth required size="small" type="date" label={t.start} value={fields.startDate}
          InputLabelProps={{ shrink: true }} onChange={e => change('startDate', e.target.value)} />
        <TextField fullWidth size="small" type="date" label={t.end} value={fields.endDate}
          InputLabelProps={{ shrink: true }} onChange={e => change('endDate', e.target.value)} />
        <TextField fullWidth size="small" label={t.project} value={fields.projectId}
          onChange={e => change('projectId', e.target.value)} />
      </Stack>
      <TextField fullWidth required size="small" label={t.approval}
        value={fields.hiringApprovalReference} inputProps={{ maxLength: 200 }}
        onChange={e => change('hiringApprovalReference', e.target.value)} />
      <TextField fullWidth required size="small" label={t.reason} value={fields.reason}
        onChange={e => change('reason', e.target.value)} />
      <Button variant="contained" disabled={!valid || busy} onClick={() => void submit()}>{t.add}</Button>
    </Stack>
  </Paper>;
}
