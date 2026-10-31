import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Divider, MenuItem, Paper, Stack,
  TextField, Typography,
} from '@mui/material';
import { getHrPrivateHistory, getMaskedHrPrivate, hrPrivateFields,
  revealHrPrivate, updateHrPrivate, type HrPrivateCategory } from './hr-private-api';

type Language = 'en' | 'th' | 'zh-TW';
const translations = {
  en: {
    identity: 'Protected identity', bank: 'Protected bank details', history: 'Revision history',
    missing: 'No protected details recorded.', version: 'Current version', reveal: 'Reveal version',
    hide: 'Hide private data', manage: 'Record a new protected revision',
    field: 'Field to update', secret: 'New private value', reason: 'Reason for correction',
    save: 'Save protected revision', refresh: 'Refresh metadata',
    denied: 'Protected information is unavailable or your permission has changed.',
    saved: 'Protected revision saved.', visible: 'Explicitly revealed private values. Hide them when finished.',
    privacy: 'Private values are hidden by default. A reveal is logged and checked again by the backend.',
  },
  th: {
    identity: 'ข้อมูลประจำตัวที่ปกป้อง', bank: 'ข้อมูลบัญชีธนาคารที่ปกป้อง', history: 'ประวัติการแก้ไข',
    missing: 'ยังไม่มีข้อมูลส่วนตัว', version: 'เวอร์ชันปัจจุบัน', reveal: 'เปิดดูเวอร์ชัน',
    hide: 'ซ่อนข้อมูลส่วนตัว', manage: 'บันทึกการแก้ไขข้อมูลส่วนตัว',
    field: 'ข้อมูลที่ต้องแก้ไข', secret: 'ข้อมูลส่วนตัวใหม่', reason: 'เหตุผลการแก้ไข',
    save: 'บันทึกข้อมูลส่วนตัว', refresh: 'รีเฟรชข้อมูล',
    denied: 'ไม่สามารถเข้าถึงข้อมูลส่วนตัวได้ หรือสิทธิ์ของคุณเปลี่ยนแปลง',
    saved: 'บันทึกข้อมูลส่วนตัวสำเร็จ', visible: 'ข้อมูลส่วนตัวถูกเปิดดูแล้ว กรุณาซ่อนเมื่อเสร็จ',
    privacy: 'ข้อมูลส่วนตัวจะถูกซ่อนเป็นค่าเริ่มต้น การเปิดดูจะถูกตรวจสอบและบันทึกประวัติในระบบ',
  },
  'zh-TW': {
    identity: '受保護身分資料', bank: '受保護銀行資料', history: '修訂紀錄',
    missing: '尚無私人資料', version: '目前版本', reveal: '顯示此版本',
    hide: '隱藏私人資料', manage: '新增受保護資料修訂',
    field: '修改欄位', secret: '新的私人資料', reason: '修訂原因',
    save: '儲存受保護修訂', refresh: '重新整理資訊',
    denied: '私人資料無法使用，或您的權限已變更',
    saved: '私人資料修訂已儲存', visible: '已明確顯示私人資料，完成後請隱藏',
    privacy: '私人資料預設遮蔽；每次顯示均重新檢查後端權限並記錄',
  },
} satisfies Record<Language, Record<string, string>>;

const labelForField = (field: string) => field.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());

export function HrPrivatePanel({ companyId, employeeId, category, canManage, language }: {
  companyId: string; employeeId: string; category: HrPrivateCategory;
  canManage: boolean; language: Language;
}) {
  const queryClient = useQueryClient();
  const key = ['hr1-a', companyId, employeeId, 'masked', category];
  const historyKey = ['hr1-a', companyId, employeeId, 'private-history', category];
  const [revealed, setRevealed] = useState<{ version: number; values: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<string>(hrPrivateFields[category][0]);
  const [secret, setSecret] = useState('');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState<'error' | 'success' | null>(null);
  const operation = useRef(0);
  const t = translations[language];

  // A private reveal never enters React Query, persistent storage, audit
  // output, logs or a global event. Pending responses are discarded on hide,
  // browser-tab concealment, or a Company/employee component unmount.
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState !== 'hidden') return;
      operation.current++;
      setBusy(false);
      setRevealed(null);
      setSecret('');
      setReason('');
      setRequestId(crypto.randomUUID());
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      operation.current++;
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);

  const masked = useQuery({
    queryKey: key, queryFn: () => getMaskedHrPrivate(companyId, employeeId, category),
    retry: false, refetchOnWindowFocus: true, refetchInterval: 15000, gcTime: 0,
  });
  const history = useQuery({
    queryKey: historyKey, queryFn: () => getHrPrivateHistory(companyId, employeeId, category),
    retry: false, refetchOnWindowFocus: true, refetchInterval: 15000, gcTime: 0,
  });
  // Revalidating permissions/source metadata invalidates any earlier reveal,
  // including a revocation that arrives while the same employee is selected.
  useEffect(() => {
    if (masked.isFetching || history.isFetching || masked.isError || history.isError) {
      operation.current++;
      setBusy(false);
      setRevealed(null);
    }
  }, [masked.isFetching, history.isFetching, masked.isError, history.isError]);

  const hide = () => { operation.current++; setRevealed(null); };

  const reveal = async (version: number) => {
    hide();
    setNotice(null);
    const turn = ++operation.current;
    setBusy(true);
    try {
      const opened = await revealHrPrivate(companyId, employeeId, category, version);
      if (turn === operation.current && opened.version === version) {
        setRevealed(opened);
      }
    } catch {
      if (turn === operation.current) setNotice('error');
    } finally {
      if (turn === operation.current) setBusy(false);
    }
  };
  const edit = (nextField: string, nextSecret: string, nextReason: string) => {
    setField(nextField); setSecret(nextSecret); setReason(nextReason);
    setRequestId(crypto.randomUUID());
    setNotice(null);
    hide();
  };
  const save = async () => {
    if (!canManage || busy || !masked.isSuccess || masked.isFetching || !secret.trim() || !reason.trim()) return;
    if (!(hrPrivateFields[category] as readonly string[]).includes(field)) return;
    hide(); setBusy(true); setNotice(null);
    const turn = ++operation.current;
    try {
      await updateHrPrivate(companyId, employeeId, category, {
        requestId, expectedVersion: masked.data.version,
        values: { [field]: secret.trim() }, reason: reason.trim(),
      });
      if (turn !== operation.current) return;
      setSecret(''); setReason(''); setRequestId(crypto.randomUUID());
      setNotice('success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: historyKey }),
      ]);
    } catch {
      // Same-body uncertain failure reuses requestId. Changed input gets a
      // fresh key, while the server enforces version and rechecks access.
      if (turn === operation.current) setNotice('error');
    } finally {
      if (turn === operation.current) setBusy(false);
    }
  };

  const fields = hrPrivateFields[category];
  const metadataUnavailable = !masked.isSuccess || masked.isFetching ||
    history.isFetching || !history.isSuccess;
  return <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack spacing={2}>
      <Typography variant="h6">{t[category]}</Typography>
      <Alert severity="info">{t.privacy}</Alert>
      {metadataUnavailable ? (masked.isError || history.isError ?
        <Alert severity="warning">{t.denied}</Alert> : <CircularProgress size={22}/>) : <>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography>{t.version}: {masked.data.version}</Typography>
          <Button onClick={() => {
            hide();
            void Promise.all([masked.refetch(), history.refetch()]);
          }} disabled={busy}>{t.refresh}</Button>
          {revealed && <Button color="warning" onClick={hide}>{t.hide}</Button>}
        </Stack>
        {masked.data.version === 0 ? <Typography>{t.missing}</Typography> :
          <Box>
            {fields.filter(name => Object.hasOwn(masked.data.values, name)).map(name =>
              <Typography key={name}>{labelForField(name)}: {'••••'}</Typography>)}
          </Box>}
        <Typography variant="subtitle2">{t.history}</Typography>
        {history.data.map(item => <Stack key={item.id} direction="row" alignItems="center" gap={1}>
          <Typography sx={{ flexGrow: 1 }}>#{item.version} — {item.createdAt.slice(0, 10)}</Typography>
          <Button size="small" disabled={busy} onClick={() => void reveal(item.version)}>{t.reveal}</Button>
        </Stack>)}
        {revealed && <Alert severity="warning">
          <Typography>{t.visible}</Typography>
          {fields.filter(name => Object.hasOwn(revealed.values, name)).map(name =>
            <Typography key={name}>{labelForField(name)}: {revealed.values[name]}</Typography>)}
        </Alert>}
      </>}
      {notice === 'error' && <Alert severity="warning">{t.denied}</Alert>}
      {notice === 'success' && <Alert severity="success">{t.saved}</Alert>}
      {canManage && !metadataUnavailable && <>
        <Divider />
        <Typography variant="subtitle1">{t.manage}</Typography>
        <TextField select size="small" label={t.field} value={field}
          onChange={event => edit(event.target.value, secret, reason)}>
          {fields.map(name => <MenuItem key={name} value={name}>{labelForField(name)}</MenuItem>)}
        </TextField>
        <TextField size="small" label={t.secret} type="password" value={secret}
          autoComplete="off" inputProps={{ maxLength: 1000 }}
          onChange={event => edit(field, event.target.value, reason)} />
        <TextField size="small" label={t.reason} value={reason} inputProps={{ maxLength: 1000 }}
          onChange={event => edit(field, secret, event.target.value)} />
        <Button variant="contained" disabled={busy || !secret.trim() || !reason.trim()}
          onClick={() => void save()}>{t.save}</Button>
      </>}
    </Stack>
  </Paper>;
}
