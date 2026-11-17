import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useState } from 'react';
import { transferCustodyApi as api, transferDestinationPath, type TransferDestination } from '../api/transfer-custody';
import { documentsApi } from '../api/documents';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';
import { effectiveUiQueryScope } from '../role-ui/role-workspace-policy';
import { transferCustodyLabels } from './transfer-custody-labels';

export function TransferReceiptsPanel({ permissions, userId, companyId }: { permissions: string[]; userId: string; companyId: string }) {
  const scope = effectiveUiQueryScope(userId, companyId, permissions);
  return <DestinationProjects key={scope} scope={scope} permissions={permissions} userId={userId} />;
}
function DestinationProjects({ scope, permissions, userId }: { scope: string; permissions: string[]; userId: string }) {
  const t = transferCustodyLabels[useContext(MonetaryLocaleContext)];
  const [project, setProject] = useState(''), [selected, setSelected] = useState('');
  const projects = useQuery({ queryKey: ['transfer-custody', scope, 'projects'], queryFn: api.projects, retry: false, gcTime: 0 });
  const valid = !projects.isError && projects.data?.data.some(p => p.id === project);
  const list = useQuery({ queryKey: ['transfer-custody', scope, project, 'list'], queryFn: () => api.list(project), enabled: Boolean(valid), retry: false, gcTime: 0 });
  return <Stack spacing={2} data-testid="transfer-receipts"><Typography variant="h6">{t.title}</Typography><Alert severity="info">{t.scope}</Alert>
    <TextField select label={t.project} value={valid ? project : ''} onChange={e => { setProject(e.target.value); setSelected(''); }}><MenuItem value="">{t.select}</MenuItem>{!projects.isError ? projects.data?.data.map(p => <MenuItem key={p.id} value={p.id}>{p.projectCode} · {p.projectName}</MenuItem>) : null}</TextField>
    {projects.isError || list.isError ? <Alert severity="error">{t.error}</Alert> : null}
    {valid && !list.isError ? list.data?.data.map(row => <Button key={row.id} onClick={() => setSelected(row.id)}>{row.transferNumber}</Button>) : null}
    {valid && selected && !list.isError ? <DestinationRecord key={project + selected} {...{ scope, permissions, userId, project, selected }} /> : null}
  </Stack>;
}
function DestinationRecord({ scope, permissions, userId, project, selected }: { scope: string; permissions: string[]; userId: string; project: string; selected: string }) {
  const t = transferCustodyLabels[useContext(MonetaryLocaleContext)], cache = useQueryClient();
  const query = useQuery({ queryKey: ['transfer-custody', scope, project, selected], queryFn: () => api.get(project, selected), retry: false, gcTime: 0 });
  const [reason, setReason] = useState(''), [intent, setIntent] = useState<{ path: string; body: unknown } | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({}), [evidence, setEvidence] = useState<Record<string, string>>({});
  const refresh = async () => { await cache.invalidateQueries({ queryKey: ['transfer-custody'] }); await cache.invalidateQueries({ queryKey: ['stock-balances'] }); };
  const command = useMutation({ mutationFn: (i: { path: string; body: unknown }) => api.command(i.path, i.body), retry: false, onSuccess: async () => { setIntent(null); await refresh(); } });
  const d = query.isError ? undefined : query.data?.data;
  const send = (path: string, body: unknown) => { if (intent) return; const i = { path, body }; setIntent(i); command.mutate(i); };
  if (query.isError) return <Alert severity="error">{t.error}</Alert>;
  if (!d) return null;
  const writable = d.canReceive && !intent && !query.isFetching;
  const body = () => ({ requestKey: crypto.randomUUID(), expectedVersion: d.version, reason });
  return <Stack spacing={2} data-testid="transfer-destination-detail"><Typography variant="h6">{d.transferNumber} · {d.destinationWarehouse.warehouseName}</Typography>
    <Typography>{d.dispatchedAt ? `${t.dispatched}: ${new Date(d.dispatchedAt).toLocaleString()}` : t.awaiting}</Typography>
    {command.isError ? <Alert severity="error">{t.uncertain}<Button disabled={command.isPending} onClick={() => intent && command.mutate(intent)}>{t.retry}</Button><Button disabled={command.isPending} onClick={() => { setIntent(null); command.reset(); void refresh(); }}>{t.clear}</Button></Alert> : null}
    {d.lines.map(line => <Paper key={line.id} variant="outlined" sx={{ p: 2 }}><Stack spacing={1}><Typography>{line.material.materialCode} · {line.material.materialName}</Typography><Typography>{t.accepted}: {line.accepted} · {t.outstanding}: {line.outstanding} {line.uom.uomCode}</Typography>
      {writable && Number(line.outstanding) > 0 ? <TextField label={`${t.quantity} · ${line.material.materialCode}`} value={quantities[line.id] ?? ''} onChange={e => setQuantities(q => ({ ...q, [line.id]: e.target.value }))} inputProps={{ inputMode: 'decimal' }} /> : null}</Stack></Paper>)}
    {d.canReceive ? <><TextField label={t.reason} value={reason} onChange={e => setReason(e.target.value)} disabled={Boolean(intent)} /><Button disabled={!writable || !reason.trim()} onClick={() => send(transferDestinationPath(project, d.id) + '/receipts', body())}>{t.prepare}</Button></> : null}
    {d.receipts.map(r => <Paper key={r.id} variant="outlined" sx={{ p: 2 }}><Stack spacing={1}><Typography>{r.reason} · {t.receivedAt}: {r.postedAt ? new Date(r.postedAt).toLocaleString() : '—'}</Typography>
      {!r.postedAt && r.createdByUserId === userId && d.canReceive ? <>
        <ReceiptEvidence key={r.id} d={d} receiptId={r.id} scope={scope} permissions={permissions} disabled={!writable} saved={id => setEvidence(e => ({ ...e, [r.id]: id }))} />
        <Button disabled={!writable || !reason.trim() || !evidence[r.id] || !d.lines.some(l => Number(quantities[l.id]) > 0)} onClick={() => send(transferDestinationPath(project, d.id) + '/receipts/' + r.id + '/receive', { ...body(), documentId: evidence[r.id], lines: d.lines.filter(l => Number(quantities[l.id]) > 0).map(l => ({ transferItemId: l.id, quantity: quantities[l.id], note: reason })) })}>{t.receive}</Button>
      </> : null}
      {r.documentId && permissions.includes('documents.document.view') ? <Button onClick={() => void documentsApi.downloadTargetDocument(project, 'TRANSFER_RECEIPT', r.id, r.documentId!).then(({ blob, fileName }) => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = fileName ?? 'receipt'; a.click(); URL.revokeObjectURL(url); }).catch(() => {})}>{t.download}</Button> : null}
    </Stack></Paper>)}
  </Stack>;
}
function ReceiptEvidence({ d, receiptId, scope, permissions, disabled, saved }: { d: TransferDestination; receiptId: string; scope: string; permissions: string[]; disabled: boolean; saved: (id: string) => void }) {
  const t = transferCustodyLabels[useContext(MonetaryLocaleContext)];
  const [type, setType] = useState(''), [file, setFile] = useState<File | null>(null);
  const types = useQuery({ queryKey: ['transfer-custody', scope, 'document-types'], queryFn: documentsApi.typeOptions, retry: false, gcTime: 0 });
  const files = useQuery({ queryKey: ['transfer-custody', scope, receiptId, 'files'], queryFn: () => documentsApi.targetDocuments(d.projectId, 'TRANSFER_RECEIPT', receiptId), retry: false, gcTime: 0 });
  const upload = useMutation({ mutationFn: () => documentsApi.uploadTargetDocument(d.projectId, 'TRANSFER_RECEIPT', receiptId, type, file!), retry: false, onSuccess: async r => { saved(r.data.id); await files.refetch(); } });
  return <Stack spacing={1}>
    {types.isError || files.isError || upload.isError ? <Alert severity="error">{t.error}</Alert> : null}
    <TextField select label={t.evidence} defaultValue="" disabled={disabled || files.isError} onChange={e => saved(e.target.value)}><MenuItem value="">{t.select}</MenuItem>{!files.isError ? files.data?.data.filter(f => f.isActive).map(f => <MenuItem key={f.id} value={f.id}>{f.fileName}</MenuItem>) : null}</TextField>
    {permissions.includes('documents.document.upload') && permissions.includes('documents.document.link') ? <>
      <TextField select label={t.documentType} value={type} onChange={e => setType(e.target.value)} disabled={disabled || types.isError}><MenuItem value="">{t.select}</MenuItem>{!types.isError ? types.data?.data.map(dt => <MenuItem key={dt.id} value={dt.id}>{dt.documentTypeName}</MenuItem>) : null}</TextField>
      <input aria-label={t.evidence} type="file" disabled={disabled || upload.isPending} onChange={e => setFile(e.target.files?.[0] ?? null)} />
      <Button disabled={disabled || !type || !file || upload.isPending} onClick={() => upload.mutate()}>{t.upload}</Button>
    </> : null}
  </Stack>;
}
