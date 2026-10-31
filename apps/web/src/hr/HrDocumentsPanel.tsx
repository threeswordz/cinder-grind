import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { downloadHrDocument, getHrDocumentHistory, safeHrFileName } from './hr-documents-api';

type Language = 'en' | 'th' | 'zh-TW';
const translations = {
  en: { title: 'Protected HR documents', note: 'Only metadata is displayed. Files require an authorized download.',
    empty: 'No protected documents.', version: 'Version', download: 'Download',
    error: 'Protected documents are unavailable or access has changed.',
    previous: 'Previous', next: 'Next' },
  th: { title: 'เอกสารฝ่ายบุคคลที่ปกป้อง', note: 'แสดงเฉพาะข้อมูลเอกสาร การดาวน์โหลดต้องได้รับสิทธิ์',
    empty: 'ยังไม่มีเอกสารส่วนตัว', version: 'เวอร์ชัน', download: 'ดาวน์โหลด',
    error: 'ไม่สามารถเข้าถึงเอกสารส่วนตัวหรือสิทธิ์เปลี่ยนแปลง',
    previous: 'ก่อนหน้า', next: 'ถัดไป' },
  'zh-TW': { title: '受保護人事文件', note: '僅顯示文件中繼資料；下載需要權限。',
    empty: '尚無私人文件', version: '版本', download: '下載',
    error: '私人文件無法使用或權限已變更',
    previous: '上一頁', next: '下一頁' },
} satisfies Record<Language, Record<string, string>>;

export function HrDocumentsPanel({ userId, companyId, employeeId, language, revalidating }: {
  userId: string; companyId: string; employeeId: string; language: Language; revalidating: boolean;
}) {
  const t = translations[language];
  const [pages, setPages] = useState<number[]>([0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const cursor = pages[pages.length - 1] ?? 0;
  const docs = useQuery({
    queryKey: ['hr1-a', userId, companyId, employeeId, 'documents', cursor],
    queryFn: () => getHrDocumentHistory(companyId, employeeId, cursor),
    retry: false, gcTime: 0, refetchInterval: 15000, refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (revalidating || docs.isFetching || docs.isError) generation.current++;
  }, [revalidating, docs.isFetching, docs.isError]);
  useEffect(() => () => { generation.current++; }, []);
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
            <Button size="small" disabled={busy} onClick={() => void doDownload(item.id,item.version)}>{t.download}</Button>
          </Stack>)}
        <Stack direction="row" gap={1}>
          <Button disabled={pages.length <= 1 || busy}
            onClick={() => setPages(old => old.slice(0,-1))}>{t.previous}</Button>
          <Button disabled={docs.data.nextCursor === null || busy}
            onClick={() => setPages(old => [...old,docs.data.nextCursor!])}>{t.next}</Button>
        </Stack>
      </>}
      {error && <Alert severity="warning">{t.error}</Alert>}
    </Stack>
  </Paper>;
}
