import { FormEvent, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '../api/master-data';
import { materialUomApi, MaterialUomPreview, MaterialUomRevision } from '../api/material-uom';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';
import { ApiError } from '../api/client';

const messages = {
  en: { title: 'Material unit conversions', prepared: 'Definitions prepared. Inventory conversion is not enabled.', missing: 'Choose the stock unit to prepare conversion definitions.', stock: 'Stock unit (pinned)', source: 'Entered unit', numerator: 'Stock units in ratio', denominator: 'Entered units in ratio', effective: 'Effective from', business: 'Conversion business date', quantity: 'Entered quantity', reason: 'Reason', prepare: 'Prepare stock unit', revise: 'Append definition revision', preview: 'Preview exact quantity', close: 'Close conversions', result: 'Exact quantity preview', history: 'Definition history', older: 'Load older definitions', version: 'Version', identity: 'Stock unit identity (1:1)', error: 'Unable to complete this action. Check active units, explicit dates, exact quantity and permissions. Refresh after a version conflict.', refresh: 'Refresh definitions', required: 'Select a unit', loading: 'Loading authorized definitions…', readOnly: 'Read and preview access. Changing definitions requires explicit conversion-maintenance permission.' },
  th: { title: 'การแปลงหน่วยวัสดุ', prepared: 'เตรียมนิยามแล้ว ยังไม่เปิดใช้การแปลงหน่วยคลังสินค้า', missing: 'เลือกหน่วยสต็อกเพื่อเตรียมนิยามการแปลง', stock: 'หน่วยสต็อก (ตรึงแล้ว)', source: 'หน่วยที่กรอก', numerator: 'จำนวนหน่วยสต็อกในอัตราส่วน', denominator: 'จำนวนหน่วยที่กรอกในอัตราส่วน', effective: 'มีผลตั้งแต่', business: 'วันที่ธุรกรรมสำหรับการแปลง', quantity: 'จำนวนที่กรอก', reason: 'เหตุผล', prepare: 'เตรียมหน่วยสต็อก', revise: 'เพิ่มรุ่นนิยาม', preview: 'ดูตัวอย่างจำนวนที่แน่นอน', close: 'ปิดการแปลงหน่วย', result: 'ตัวอย่างจำนวนที่แน่นอน', history: 'ประวัตินิยาม', older: 'โหลดนิยามก่อนหน้า', version: 'รุ่น', identity: 'หน่วยสต็อกเดิม (1:1)', error: 'ดำเนินการไม่ได้ ตรวจสอบหน่วยที่ใช้งาน วันที่ จำนวนที่แน่นอน และสิทธิ์ หากรุ่นเปลี่ยนให้โหลดข้อมูลใหม่', refresh: 'โหลดนิยามใหม่', required: 'เลือกหน่วย', loading: 'กำลังโหลดนิยามที่มีสิทธิ์…', readOnly: 'ดูและทดลองคำนวณได้ การแก้นิยามต้องมีสิทธิ์ดูแลการแปลงหน่วยโดยเฉพาะ' },
  'zh-TW': { title: '材料單位換算', prepared: '定義已備妥。尚未啟用庫存換算。', missing: '請選擇庫存單位以準備換算定義。', stock: '庫存單位（已固定）', source: '輸入單位', numerator: '比例中的庫存單位數', denominator: '比例中的輸入單位數', effective: '生效日期', business: '換算業務日期', quantity: '輸入數量', reason: '原因', prepare: '準備庫存單位', revise: '新增定義版本', preview: '預覽精確數量', close: '關閉單位換算', result: '精確數量預覽', history: '定義歷史', older: '載入較早定義', version: '版本', identity: '庫存單位本身（1:1）', error: '無法完成操作。請檢查有效單位、明確日期、精確數量與權限。版本衝突後請重新整理。', refresh: '重新整理定義', required: '選擇單位', loading: '正在載入授權定義…', readOnly: '可檢視及預覽；修改定義需要明確的單位換算維護權限。' },
};

export function MaterialUomPanel({ materialId, canManage, onClose }: { materialId: string; canManage: boolean; onClose: () => void }) {
  const locale = useContext(MonetaryLocaleContext), t = messages[locale], client = useQueryClient();
  const [stockUomId, setStock] = useState(''), [sourceUomId, setSource] = useState('');
  const [numerator, setNumerator] = useState(''), [denominator, setDenominator] = useState('');
  const [effectiveFrom, setEffective] = useState(''), [reason, setReason] = useState('');
  const [businessDate, setBusinessDate] = useState(''), [quantity, setQuantity] = useState('');
  const [result, setResult] = useState<{ digest: string; value: MaterialUomPreview } | null>(null);
  const [older, setOlder] = useState<MaterialUomRevision[]>([]), [before, setBefore] = useState<number | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<{ digest: string; kind: string; body: Record<string, unknown> } | null>(null);
  const stateQuery = useQuery({ queryKey: ['material-uom', materialId], queryFn: () => materialUomApi.get(materialId), refetchOnWindowFocus: true });
  const units = useQuery({ queryKey: ['master-data', 'material-uom-options'], queryFn: masterDataApi.materialUomOptions });
  const state = stateQuery.data?.data, basis = state?.basis;
  const previewDigest = JSON.stringify([materialId, sourceUomId, businessDate, quantity, basis?.version]);
  useEffect(() => { setResult(null); }, [previewDigest]);
  useEffect(() => { setOlder([]); setBefore(state?.nextBefore ?? null); }, [state?.basis?.version, state?.nextBefore]);
  function requestBody(kind: string, values: Record<string, unknown>) {
    const digest = JSON.stringify([materialId, kind, values]);
    if (attempt.current?.digest !== digest) attempt.current = { digest, kind, body: { ...values, requestKey: crypto.randomUUID() } };
    return attempt.current.body;
  }
  const save = useMutation({
    mutationFn: () => uncertain && attempt.current ? attempt.current.kind === 'REVISE' ? materialUomApi.revise(materialId, attempt.current.body) : materialUomApi.prepare(materialId, attempt.current.body) : basis ? materialUomApi.revise(materialId, requestBody('REVISE', { expectedVersion: basis.version, sourceUomId, numerator, denominator, effectiveFrom, reason })) : materialUomApi.prepare(materialId, requestBody('PREPARE', { stockUomId, reason })),
    onError: error => setUncertain(!(error instanceof ApiError) || error.status >= 500),
    onSuccess: async () => { attempt.current = null; setUncertain(false); setReason(''); setResult(null); await client.invalidateQueries({ queryKey: ['material-uom', materialId] }); },
  });
  const preview = useMutation({ mutationFn: async () => ({ digest: previewDigest, value: (await materialUomApi.preview(materialId, { sourceUomId, businessDate, quantity })).data }), onMutate: () => setResult(null), onSuccess: setResult });
  const loadOlder = useMutation({ mutationFn: () => materialUomApi.get(materialId, before ?? undefined), onSuccess: response => { if (response.data.basis?.version !== basis?.version) { void stateQuery.refetch(); return; } setOlder(rows => [...rows, ...response.data.revisions]); setBefore(response.data.nextBefore); } });
  const options = units.data?.data ?? [];
  if (stateQuery.isError || units.isError) return <Alert severity="error" lang={locale}>{t.error}<Button onClick={() => { setResult(null); void stateQuery.refetch(); void units.refetch(); }}>{t.refresh}</Button><Button onClick={onClose}>{t.close}</Button></Alert>;
  if (!state || stateQuery.isPending) return <Alert severity="info" lang={locale}>{t.loading}</Alert>;
  const failed = save.isError || preview.isError || loadOlder.isError;
  const selectUnit = (value: string, change: (value: string) => void, label: string, stock = false) => <TextField select label={label} value={value} required onChange={e => change(e.target.value)} fullWidth><MenuItem value="">{t.required}</MenuItem>{options.filter(u => !stock || u.decimalPlaces <= 4).map(u => <MenuItem key={u.id} value={u.id}>{u.uomCode} — {u.uomName}</MenuItem>)}</TextField>;
  function submit(event: FormEvent) { event.preventDefault(); save.mutate(); }
  return <Card variant="outlined" data-testid="material-uom-panel" lang={locale}><CardContent><Stack spacing={2}>
    <Typography variant="h6">{t.title} · {state.material.materialCode}</Typography>
    <Alert severity="info">{basis ? t.prepared : t.missing}</Alert>
    {failed && <Alert severity="error" role="alert">{t.error}</Alert>}
    {uncertain && <Alert severity="warning">{locale === 'th' ? 'ยังไม่ทราบผล โปรดลองคำขอเดิมก่อนแก้ไข' : locale === 'zh-TW' ? '結果尚未確認。請先重試相同請求。' : 'The result is uncertain. Retry the same request before editing.'}<Button disabled={save.isPending} onClick={() => save.mutate()}>{locale === 'th' ? 'ลองคำขอเดิมอีกครั้ง' : locale === 'zh-TW' ? '重試相同請求' : 'Retry same request'}</Button></Alert>}
    {basis && <Typography>{t.stock}: {basis.stockUomCode} · {t.version} {basis.version}</Typography>}
    {canManage && state.material.isActive && !uncertain ? <Stack component="form" data-testid="material-uom-definition" spacing={2} onSubmit={submit}>
      {!basis ? selectUnit(stockUomId, setStock, t.stock, true) : <>
        {selectUnit(sourceUomId, setSource, t.source)}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label={t.numerator} value={numerator} onChange={e => setNumerator(e.target.value)} required inputProps={{ inputMode: 'numeric', maxLength: 38 }} fullWidth /><TextField label={t.denominator} value={denominator} onChange={e => setDenominator(e.target.value)} required inputProps={{ inputMode: 'numeric', maxLength: 38 }} fullWidth /></Stack>
        <TextField label={t.effective} type="date" value={effectiveFrom} onChange={e => setEffective(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} />
      </>}
      <TextField label={t.reason} value={reason} onChange={e => setReason(e.target.value)} required inputProps={{ maxLength: 2000 }} />
      <Button type="submit" variant="contained" disabled={save.isPending || stateQuery.isFetching}>{basis ? t.revise : t.prepare}</Button>
    </Stack> : <Alert severity="info">{t.readOnly}</Alert>}
    {basis && <Stack component="form" data-testid="material-uom-preview-form" spacing={2} onSubmit={e => { e.preventDefault(); preview.mutate(); }}>
      {selectUnit(sourceUomId, setSource, t.source)}
      <TextField label={t.business} type="date" value={businessDate} onChange={e => setBusinessDate(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label={t.quantity} value={quantity} onChange={e => setQuantity(e.target.value)} required inputProps={{ inputMode: 'decimal' }} />
      <Button type="submit" disabled={preview.isPending || stateQuery.isFetching}>{t.preview}</Button>
      {result?.digest === previewDigest && <Alert severity="success" data-testid="material-uom-preview">{t.result}: {result.value.enteredQuantity} {result.value.sourceUomCode} = {result.value.stockQuantity} {result.value.stockUomCode} · {result.value.numerator}:{result.value.denominator} · {result.value.businessDate} · {result.value.effectiveFrom ?? t.identity}</Alert>}
    </Stack>}
    {basis && <><Typography variant="subtitle1">{t.history}</Typography>{[...state.revisions, ...older].map(r => <Typography key={r.id} variant="body2">{t.version} {r.revisionNo} · {r.sourceUomCode} → {basis.stockUomCode} · {r.numerator}:{r.denominator} · {r.effectiveFrom} · {r.reason}</Typography>)}{before !== null && <Button disabled={loadOlder.isPending} onClick={() => loadOlder.mutate()}>{t.older}</Button>}</>}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button disabled={uncertain || save.isPending} onClick={() => { setResult(null); void stateQuery.refetch(); }}>{t.refresh}</Button><Button disabled={uncertain || save.isPending} onClick={onClose}>{t.close}</Button></Stack>
  </Stack></CardContent></Card>;
}
