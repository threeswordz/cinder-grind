import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { downloadHrDocument, getHrDocumentHistory, getHrDocumentTypes,
  safeHrFileName, uploadHrDocument } from './hr-documents-api';

type Language = 'en' | 'th' | 'zh-TW';
const translations = {
  en: { title: 'Protected HR documents', note: 'Only metadata is shown; file contents require an authorized download.',
    empty: 'No protected documents.', version: 'Version', download: 'Download',
    error: 'Protected documents are unavailable or access has changed.',
    previous: 'Previous', next: 'Next', add: 'Upload protected document',
    file: 'Private file', type: 'Evidence type', submit: 'Encrypt and upload',
    invalid: 'Choose an authorized evidence type and a file up to 8 MiB.',
    saved: 'Protected document uploaded.', typeUnavailable: 'No authorized evidence type is available.' },
  th: { title: 'เอกสารฝ่ายบุคคลที่ปกป้อง', note: 'แสดงเฉพาะข้อมูลเอกสาร ต้องได้รับสิทธิ์ก่อนดาวน์โหลด',
    empty: 'ยังไม่มีเอกสารส่วนตัว', version: 'เวอร์ชัน', download: 'ดาวน์โหลด',
    error: 'ไม่สามารถเข้าถึงเอกสารส่วนตัวหรือสิทธิ์เปลี่ยนแปลง',
    previous: 'ก่อนหน้า', next: 'ถัดไป', add: 'อัปโหลดเอกสารส่วนตัว',
    file: 'ไฟล์ส่วนตัว', type: 'ประเภทหลักฐาน', submit: 'เข้ารหัสและอัปโหลด',
    invalid: 'เลือกประเภทหลักฐานและไฟล์ขนาดไม่เกิน 8 MiB',
    saved: 'อัปโหลดเอกสารสำเร็จ', typeUnavailable: 'ไม่พบประเภทหลักฐานที่ได้รับสิทธิ์' },
  'zh-TW': { title: '受保護人事文件', note: '只顯示文件中繼資料；下載內容需要權限。',
    empty: '尚無私人文件', version: '版本', download: '下載',
    error: '私人文件無法使用或權限已變更',
    previous: '上一頁', next: '下一頁', add: '上傳受保護文件',
    file: '私人檔案', type: '證明類型', submit: '加密並上傳',
    invalid: '請選擇獲授權的證明類型，以及不超過 8 MiB 的檔案。',
    saved: '已上傳受保護文件', typeUnavailable: '沒有可用的授權證明類型' },
} satisfies Record<Language, Record<string, string>>;
type PendingUpload = { file: File; documentTypeId: string; expectedVersion: number; requestId: string };

export function HrDocumentsPanel({ userId, companyId, employeeId, language, revalidating, canManage }: {
  userId: string; companyId: string; employeeId: string; language: Language;
  revalidating: boolean; canManage: boolean;
}) {
  const t = translations[language];
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<number[]>([0]);
  const [typePages, setTypePages] = useState<string[]>(['']);
  const [typeId, setTypeId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const generation = useRef(0);
  const pending = useRef<PendingUpload | null>(null);
  const cursor = pages[pages.length - 1] ?? 0;
  const typeAfter = typePages[typePages.length - 1] || '';
  const key = ['hr1-a', userId, companyId, employeeId, 'documents'];
  const docs = useQuery({
    queryKey: [...key, cursor],
    queryFn: () => getHrDocumentHistory(companyId, employeeId, cursor),
    retry: false, gcTime: 0, refetchInterval: 15000, refetchOnWindowFocus: true,
  });
  const types = useQuery({
    queryKey: ['hr1-a', userId, companyId, 'document-type-options', typeAfter],
    queryFn: () => getHrDocumentTypes(companyId, typeAfter),
    enabled: canManage, retry: false, gcTime: 0,
    refetchInterval: 15000, refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (revalidating || docs.isFetching || docs.isError || (canManage && (types.isFetching || types.isError))) {
      generation.current++;
      setBusy(false);
    }
  }, [revalidating, docs.isFetching, docs.isError, types.isFetching, types.isError, canManage]);
  useEffect(() => {
    const conceal = () => {
      if (document.visibilityState !== 'hidden') return;
      generation.current++;
      pending.current = null;
      setFile(null); setTypeId(''); setRequestId(crypto.randomUUID());
      setBusy(false); setFileKey(current => current + 1);
    };
    document.addEventListener('visibilitychange', conceal);
    return () => { generation.current++; pending.current = null; document.removeEventListener('visibilitychange', conceal); };
  }, []);

  const resetUpload = () => {
    pending.current = null;
    setRequestId(crypto.randomUUID());
    setError(false); setSaved(false);
  };
  const doDownload = async (id: string, version: number) => {
    if (revalidating || docs.isFetching || !docs.isSuccess || busy) return;
    const turn = ++generation.current;
    setBusy(true); setError(false);
    try {
      const { blob, fileName } = await downloadHrDocument(companyId, employeeId, id);
      if (turn !== generation.current || document.visibilityState === 'hidden') return;
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = safeHrFileName(fileName, version);
        document.body.append(anchor); anchor.click(); anchor.remove();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { if (turn === generation.current) setError(true); }
    finally { if (turn === generation.current) setBusy(false); }
  };
  const canUpload = canManage && !revalidating && docs.isSuccess && !docs.isFetching &&
    docs.data.nextCursor === null && types.isSuccess && !types.isFetching &&
    types.data.items.some(item => item.id === typeId) &&
    file !== null && file.size > 0 && file.size <= 8 * 1024 * 1024 && !busy;
  const doUpload = async () => {
    if (!canUpload || !file) return;
    // No plaintext bytes or browser File objects go into React Query. Persist
    // the complete request body only inside the mounted editor for uncertain
    // same-body POST retries after a background metadata version refresh.
    const body = pending.current ?? {
      file, documentTypeId: typeId, requestId,
      // The final page may be empty when history has exactly 100/200/etc.
      // entries. Its server-issued cursor is then the latest observed
      // version; never silently reset the optimistic upload version to 0.
      expectedVersion: docs.data?.items.at(-1)?.version ?? cursor,
    };
    pending.current = body;
    const turn = ++generation.current;
    setBusy(true); setError(false); setSaved(false);
    try {
      await uploadHrDocument(companyId, employeeId, body);
      if (turn !== generation.current) return;
      pending.current = null;
      setFile(null); setFileKey(current => current + 1); setTypeId('');
      setRequestId(crypto.randomUUID()); setSaved(true);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch { if (turn === generation.current) setError(true); }
    finally { if (turn === generation.current) setBusy(false); }
  };
  const unavailable = revalidating || docs.isFetching || !docs.isSuccess;
  return <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack spacing={2}>
      <Typography variant="h6">{t.title}</Typography>
      <Alert severity="info">{t.note}</Alert>
      {unavailable ? (docs.isError ? <Alert severity="warning">{t.error}</Alert> :
        <CircularProgress size={22}/>) : <>
        {docs.data.items.length === 0 ? <Typography>{t.empty}</Typography> :
          docs.data.items.map(item => <Stack key={item.id} direction="row" gap={2} alignItems="center">
            <Typography sx={{ flexGrow: 1 }}>{t.version} #{item.version} — {item.createdAt.slice(0,10)}</Typography>
            <Button size="small" disabled={busy || revalidating}
              onClick={() => void doDownload(item.id,item.version)}>{t.download}</Button>
          </Stack>)}
        <Stack direction="row" gap={1}>
          <Button disabled={pages.length <= 1 || busy}
            onClick={() => setPages(old => old.slice(0,-1))}>{t.previous}</Button>
          <Button disabled={docs.data.nextCursor === null || busy}
            onClick={() => setPages(old => [...old,docs.data.nextCursor!])}>{t.next}</Button>
        </Stack>
        {canManage && <>
          <Typography variant="subtitle1">{t.add}</Typography>
          {types.isError ? <Alert severity="warning">{t.typeUnavailable}</Alert> :
            types.isFetching || !types.isSuccess ? <CircularProgress size={22}/> :
              <TextField select label={t.type} size="small" value={typeId}
                onChange={event => { setTypeId(event.target.value); resetUpload(); }}>
                {types.data.items.map(item => <MenuItem key={item.id} value={item.id}>
                  {item.documentTypeCode} — {item.documentTypeName}
                </MenuItem>)}
              </TextField>}
          {types.isSuccess && types.data.items.length > 0 &&
            <Stack direction="row" gap={1}>
              <Button disabled={typePages.length <= 1 || busy}
                onClick={() => { setTypePages(old => old.slice(0,-1)); setTypeId(''); resetUpload(); }}>{t.previous}</Button>
              <Button disabled={types.data.nextCursor === null || busy}
                onClick={() => { setTypePages(old => [...old,types.data.nextCursor!]); setTypeId(''); resetUpload(); }}>{t.next}</Button>
            </Stack>}
          <input key={fileKey} type="file" aria-label={t.file} accept=".pdf,.jpg,.jpeg,.png,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={event => { setFile(event.target.files?.[0] ?? null); resetUpload(); }} />
          <Button variant="contained" disabled={!canUpload} onClick={() => void doUpload()}>{t.submit}</Button>
          {file && (file.size < 1 || file.size > 8 * 1024 * 1024) && <Alert severity="warning">{t.invalid}</Alert>}
        </>}
      </>}
      {error && <Alert severity="warning">{t.error}</Alert>}
      {saved && <Alert severity="success">{t.saved}</Alert>}
    </Stack>
  </Paper>;
}
