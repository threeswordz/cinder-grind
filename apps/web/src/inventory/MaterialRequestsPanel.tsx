import { Alert, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useContext, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialRequestsApi as api, type MaterialRequest, type RequestChoice, type RequestLink } from '../api/material-requests';
import { documentsApi } from '../api/documents';
import { inventoryApi } from '../api/inventory';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';
import { materialRequestLabels } from './material-request-labels';
type ChoiceProps = {
    projectId: string;
    kind: string;
    label: string;
    value: string;
    onChange: (row: RequestChoice | null) => void;
    disabled?: boolean;
};
function Choice({ projectId, kind, label, value, onChange, disabled = false }: ChoiceProps) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)], [cursors, setCursors] = useState(['']), saved = useRef<RequestChoice | null>(null);
    const after = cursors.at(-1) ?? '';
    const q = useQuery({ queryKey: ['material-requests', 'choices', projectId, kind, after], queryFn: () => api.choices(projectId, kind, after), enabled: Boolean(projectId), retry: false, gcTime: 0, refetchOnWindowFocus: true });
    const rows = q.isError ? [] : q.data?.data.items ?? [];
    const current = rows.find(r => r.id === value);
    if (current)
        saved.current = current;
    const options = q.isError ? [] : value && saved.current?.id === value && !current ? [saved.current, ...rows] : rows;
    const caption = (r: RequestChoice) => String(r.employeeName ?? r.warehouseName ?? r.materialName ?? r.wbsName ?? r.costName ?? r.activityName ?? r.id);
    return <Stack spacing={1}>
  <TextField select size="small" label={label} value={value} disabled={disabled || q.isError || !projectId} onChange={e => onChange(options.find(r => r.id === e.target.value) ?? null)}>
   <MenuItem value="">{t.select}</MenuItem>{options.map(r => <MenuItem key={r.id} value={r.id}>{caption(r)}</MenuItem>)}
  </TextField>
  {q.isError ? <Alert severity="error">{t.error}</Alert> : null}
  <Stack direction="row" spacing={1}><Button size="small" disabled={disabled || cursors.length === 1} onClick={() => setCursors(c => c.slice(0, -1))}>{t.previous}</Button><Button size="small" disabled={disabled || !q.data?.data.nextCursor || q.isError} onClick={() => setCursors(c => [...c, q.data!.data.nextCursor!])}>{t.next}</Button></Stack>
 </Stack>;
}
function useCommand(onSaved: (id: string, version: number) => void) {
    const cache = useQueryClient(), [pending, setPending] = useState<{
        suffix: string;
        body: unknown;
    } | null>(null);
    const mutation = useMutation({ mutationFn: (intent: {
            suffix: string;
            body: unknown;
        }) => api.command(intent.suffix, intent.body), onSuccess: async (r) => { setPending(null); onSaved(r.data.id, r.data.version); await cache.invalidateQueries({ queryKey: ['material-requests'] }); } });
    return { busy: mutation.isPending, frozen: pending !== null, error: mutation.isError, saved: mutation.isSuccess,
        send: (suffix: string, body: unknown) => { const intent = { suffix, body }; setPending(intent); mutation.mutate(intent); },
        retry: () => { if (pending)
            mutation.mutate(pending); }, clear: () => { setPending(null); mutation.reset(); } };
}
type DraftLine = {
    materialId: string;
    uomId: string;
    materialLabel: string;
    uomLabel: string;
    requestedQuantity: string;
    wbsId: string | null;
    costCodeId: string | null;
    activityId: string | null;
    remarks: string | null;
};
const emptyLine = (): DraftLine => ({ materialId: '', uomId: '', materialLabel: '', uomLabel: '', requestedQuantity: '', wbsId: null, costCodeId: null, activityId: null, remarks: null });
const positive = (s: string) => /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(s) && Number(s) > 0;
function CommandNotice({ c }: {
    c: ReturnType<typeof useCommand>;
}) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)];
    return <>{c.error ? <Alert severity="error">{t.uncertain}<Button disabled={c.busy} onClick={c.retry}>{t.retry}</Button><Button disabled={c.busy} onClick={c.clear}>{t.clear}</Button></Alert> : c.saved ? <Alert severity="success">{t.saved}</Alert> : null}</>;
}
export function MaterialRequestsPanel({ permissions }: {
    permissions: string[];
}) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)], can = (s: string) => permissions.includes('inventory.material_request.' + s);
    const [projectId, setProject] = useState(''), [selected, setSelected] = useState(''), [pages, setPages] = useState(['']);
    const projects = useQuery({ queryKey: ['material-requests', 'projects'], queryFn: api.projects, retry: false, gcTime: 0, refetchOnWindowFocus: true });
    const list = useQuery({ queryKey: ['material-requests', 'list', projectId, pages.at(-1)], queryFn: () => api.list(projectId, pages.at(-1)), enabled: Boolean(projectId), retry: false, gcTime: 0, refetchOnWindowFocus: true });
    if (!can('view'))
        return null;
    return <Stack spacing={2}>
  <Typography variant="h6">{t.title}</Typography><Alert severity="info">{t.scope}</Alert>
  <TextField select label={t.project} value={projectId} onChange={e => { setProject(e.target.value); setSelected(''); setPages(['']); }}>
   <MenuItem value="">{t.select}</MenuItem>{!projects.isError ? (projects.data?.data ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.projectCode} · {p.projectName}</MenuItem>) : null}
  </TextField>
  {projects.isError || list.isError ? <Alert severity="error">{t.error}</Alert> : null}
  {projectId && !projects.isError && !list.isError ? <>
   {can('create') ? <CreateRequest key={projectId} projectId={projectId} onSaved={setSelected}/> : null}
   <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1}>
    <Button onClick={() => void list.refetch()}>{t.reload}</Button>
    {(list.data?.data.items ?? []).map(r => <Button key={r.id} onClick={() => setSelected(r.id)}>{t.open}: {r.requestDate.slice(0, 10)} · {r.requester.employeeName} · {r.warehouse.warehouseName} · {r.id.slice(0, 8)}</Button>)}
    {list.data && !list.data.data.items.length ? <Typography>{t.empty}</Typography> : null}
    <Stack direction="row"><Button disabled={pages.length === 1} onClick={() => setPages(p => p.slice(0, -1))}>{t.previous}</Button><Button disabled={!list.data?.data.nextCursor} onClick={() => setPages(p => [...p, list.data!.data.nextCursor!])}>{t.next}</Button></Stack>
   </Stack></Paper>
   {selected ? <RequestDetail key={projectId + ':' + selected + ':' + [...permissions].sort().join(',')} id={selected} projectId={projectId} permissions={permissions}/> : <Typography>{t.choose}</Typography>}
  </> : null}
 </Stack>;
}
function CreateRequest({ projectId, onSaved }: {
    projectId: string;
    onSaved: (id: string) => void;
}) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)], c = useCommand(id => { onSaved(id); setLines([emptyLine()]); setNote(''); });
    const [warehouse, setWarehouse] = useState(''), [requester, setRequester] = useState(''), [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)), [note, setNote] = useState(''), [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
    const change = (i: number, patch: Partial<DraftLine>) => setLines(ls => ls.map((l, n) => n === i ? { ...l, ...patch } : l));
    const ready = Boolean(warehouse && requester && date && lines.every(l => l.materialId && l.uomId && positive(l.requestedQuantity)));
    return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
  <Typography>{t.create}</Typography><CommandNotice c={c}/>
  <Choice projectId={projectId} kind="warehouses" label={t.warehouse} value={warehouse} disabled={c.frozen} onChange={r => setWarehouse(r?.id ?? '')}/>
  <Choice projectId={projectId} kind="employees" label={t.requester} value={requester} disabled={c.frozen} onChange={r => setRequester(r?.id ?? '')}/>
  <TextField label={t.date} type="date" slotProps={{ inputLabel: { shrink: true } }} value={date} disabled={c.frozen} onChange={e => setDate(e.target.value)}/>
  <TextField label={t.note} value={note} disabled={c.frozen} onChange={e => setNote(e.target.value)}/>
  {lines.map((l, i) => <Stack key={i} spacing={1} sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
   <Choice projectId={projectId} kind="materials" label={t.material + ' ' + (i + 1)} value={l.materialId} disabled={c.frozen} onChange={r => { const u = r?.defaultUom as {
            id: string;
            uomCode: string;
        } | undefined; change(i, { materialId: r?.id ?? '', materialLabel: String(r?.materialName ?? ''), uomId: u?.id ?? '', uomLabel: u?.uomCode ?? '' }); }}/>
   <Typography>{t.uom}: {l.uomLabel || '—'}</Typography><TextField label={t.quantity} value={l.requestedQuantity} disabled={c.frozen} onChange={e => change(i, { requestedQuantity: e.target.value })}/>
   <Choice projectId={projectId} kind="wbs" label={t.wbs} value={l.wbsId ?? ''} disabled={c.frozen} onChange={r => change(i, { wbsId: r?.id ?? null, activityId: null })}/>
   <Choice projectId={projectId} kind="costCodes" label={t.cost} value={l.costCodeId ?? ''} disabled={c.frozen} onChange={r => change(i, { costCodeId: r?.id ?? null })}/>
   <Choice projectId={projectId} kind="activities" label={t.activity} value={l.activityId ?? ''} disabled={c.frozen} onChange={r => change(i, { activityId: r?.id ?? null })}/>
   <TextField label={t.note} value={l.remarks ?? ''} disabled={c.frozen} onChange={e => change(i, { remarks: e.target.value || null })}/>
   <Button disabled={c.frozen || lines.length === 1} onClick={() => setLines(ls => ls.filter((_, n) => n !== i))}>{t.remove}</Button>
  </Stack>)}
  <Button disabled={c.frozen || lines.length >= 100} onClick={() => setLines(ls => [...ls, emptyLine()])}>{t.add}</Button>
  <Button variant="contained" disabled={!ready || c.frozen} onClick={() => c.send('', { requestKey: crypto.randomUUID(), projectId, warehouseId: warehouse, requesterEmployeeId: requester, requestDate: date, remarks: note || null, lines: lines.map(({ materialLabel: _m, uomLabel: _u, ...l }) => l) })}>{t.create}</Button>
 </Stack></Paper>;
}
function RequestDetail({ id, projectId, permissions }: {
    id: string;
    projectId: string;
    permissions: string[];
}) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)], can = (s: string) => permissions.includes('inventory.material_request.' + s);
    const q = useQuery({ queryKey: ['material-requests', 'detail', projectId, id], queryFn: () => api.get(id), retry: false, gcTime: 0, refetchOnWindowFocus: true, refetchInterval: 15000 });
    const [sourceIssue, setSourceIssue] = useState('');
    const [pin, setPin] = useState<number | null>(null), [mode, setMode] = useState(''), c = useCommand((_id, version) => { setPin(version); setMode(''); });
    useEffect(() => { if (pin === null && q.data && !q.isError)
        setPin(q.data.data.version); }, [pin, q.data, q.isError]);
    if (q.isError)
        return <Alert severity="error">{t.error}</Alert>;
    const d = q.data?.data;
    if (!d || d.projectId !== projectId)
        return null;
    const stale = pin !== d.version, busy = c.frozen || stale;
    return <Paper variant="outlined" sx={{ p: 2, overflowX: 'auto' }}><Stack spacing={2}>
  <Typography variant="h6">{t.requester}: {d.requester.employeeName} · {d.requestDate.slice(0, 10)} · {t.version} {d.version}</Typography>
  <Button disabled={c.busy} onClick={() => { c.clear(); setMode(''); void q.refetch().then(result => setPin(result.isError ? null : result.data?.data.version ?? null)); }}>{t.reload}</Button><CommandNotice c={c}/>{stale ? <Alert severity="warning">{t.stale}</Alert> : null}
  <Table size="small"><TableHead><TableRow>{[t.material, t.requested, t.issued, t.acknowledged, t.state].map(x => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{d.lines.map(l => <TableRow key={l.id}><TableCell>{l.material.materialCode} · {l.material.materialName} ({l.uom.uomCode})</TableCell><TableCell>{l.requestedQuantity}</TableCell><TableCell>{l.issuedQuantity}</TableCell><TableCell>{l.acknowledgedQuantity}</TableCell><TableCell>{t[('status_' + l.fulfillment) as keyof typeof t] ?? l.fulfillment}</TableCell></TableRow>)}</TableBody></Table>
  <Stack direction="row" flexWrap="wrap">{can('edit') ? <Button disabled={busy} onClick={() => setMode('edit')}>{t.edit}</Button> : null}{can('link') && permissions.includes('inventory.issue.view') ? <Button disabled={busy} onClick={() => setMode('link')}>{t.link}</Button> : null}</Stack>
  {mode === 'edit' ? <Revision key={pin ?? 0} d={d} disabled={busy} onSend={body => c.send('/' + id + '/revisions', { ...body, requestKey: crypto.randomUUID(), expectedVersion: pin })}/> : null}
  {mode === 'link' ? <LinkIssue key={pin ?? 0} d={d} disabled={busy} onSend={body => c.send('/' + id + '/issue-links', { ...body, requestKey: crypto.randomUUID(), expectedVersion: pin })}/> : null}
  {permissions.includes('documents.document.view') ? <Evidence key={id} d={d} permissions={permissions}/> : null}
  {d.lines.flatMap(l => l.issueLinks.map(link => <Paper variant="outlined" sx={{ p: 1 }} key={link.id}>
   <Typography>{l.material.materialName} · {link.quantity} · {link.issue?.issueNumber ?? '—'}{!link.currentlyIssued ? ' · ' + t.reversed : ''}</Typography>
   {link.issue ? <Button onClick={() => setSourceIssue(link.issue!.id)}>{t.openSource}</Button> : null}
   {link.receipts.map(r => <Stack key={r.id} direction={{ xs: 'column', md: 'row' }} spacing={1}><Typography>{t.recipient}: {r.recipient.employeeName} · {t.issuer}: {r.issuer.employeeName} · {new Date(r.receivedAt).toLocaleString()} · {r.reason}{r.superseded ? ' · ' + t.superseded : ''}</Typography>{r.documentId && permissions.includes('documents.document.view') ? <Button onClick={() => void documentsApi.downloadTargetDocument(projectId, 'MATERIAL_REQUEST', id, r.documentId!)}>{t.download}</Button> : null}</Stack>)}
   {can('acknowledge') && permissions.includes('inventory.issue.view') && permissions.includes('documents.document.view') && link.currentlyIssued ? <Receipt key={link.id + ':' + pin} d={d} link={link} disabled={busy} onSend={body => c.send('/' + id + '/receipts', { ...body, requestKey: crypto.randomUUID(), expectedVersion: pin })}/> : null}
  </Paper>))}
  {sourceIssue ? <><Button onClick={() => setSourceIssue('')}>{t.closeSource}</Button><IssueSource key={sourceIssue} id={sourceIssue} projectId={projectId}/></> : null}
  <Typography variant="subtitle1">{t.history}</Typography>{d.revisions.map(v => <Typography key={v.id}>{t.version} {v.version} · {t[('action_' + v.action) as keyof typeof t] ?? v.action} · {v.actor.displayName} · {new Date(v.recordedAt).toLocaleString()} · {v.reason} · {v.facts.lines.map(l => l.requestedQuantity).join(', ')}</Typography>)}
 </Stack></Paper>;
}
function Revision({ d, disabled, onSend }: {
    d: MaterialRequest;
    disabled: boolean;
    onSend: (body: Record<string, unknown>) => void;
}) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)], [lines, setLines] = useState(() => d.lines.map(l => ({ id: l.id, requestedQuantity: l.requestedQuantity, remarks: l.remarks }))), [reason, setReason] = useState(''), [note, setNote] = useState(d.remarks ?? ''), [date, setDate] = useState(d.requestDate.slice(0, 10));
    return <Stack spacing={1}><TextField label={t.date} type="date" slotProps={{ inputLabel: { shrink: true } }} value={date} disabled={disabled} onChange={e => setDate(e.target.value)}/><TextField label={t.note} value={note} disabled={disabled} onChange={e => setNote(e.target.value)}/>{lines.map((l, i) => <TextField key={l.id} label={t.quantity + ' ' + (i + 1)} value={l.requestedQuantity} disabled={disabled} onChange={e => setLines(ls => ls.map((x, n) => n === i ? { ...x, requestedQuantity: e.target.value } : x))}/>)}<TextField label={t.reason} value={reason} disabled={disabled} onChange={e => setReason(e.target.value)}/><Button disabled={disabled || !reason.trim() || !date || !lines.every(l => positive(l.requestedQuantity))} onClick={() => onSend({ reason, requestDate: date, remarks: note || null, lines })}>{t.revision}</Button></Stack>;
}
function LinkIssue({ d, disabled, onSend }: {
    d: MaterialRequest;
    disabled: boolean;
    onSend: (body: Record<string, unknown>) => void;
}) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)], [lineId, setLine] = useState(''), [itemId, setItem] = useState(''), [reason, setReason] = useState(''), [pages, setPages] = useState(['']);
    const q = useQuery({ queryKey: ['material-requests', 'issue-choices', d.id, lineId, pages.at(-1)], queryFn: () => api.issueChoices(d.id, lineId, pages.at(-1)), enabled: Boolean(lineId), retry: false, gcTime: 0, refetchOnWindowFocus: true });
    return <Stack spacing={1}><TextField select label={t.material} value={lineId} disabled={disabled} onChange={e => { setLine(e.target.value); setItem(''); setPages(['']); }}><MenuItem value="">{t.select}</MenuItem>{d.lines.map(l => <MenuItem key={l.id} value={l.id}>{l.material.materialName} · {l.lineNo}</MenuItem>)}</TextField>
 <TextField select label={t.issue} value={itemId} disabled={disabled || q.isError} onChange={e => setItem(e.target.value)}><MenuItem value="">{t.select}</MenuItem>{!q.isError ? (q.data?.data.items ?? []).map(i => <MenuItem key={i.id} value={i.id}>{i.materialIssue.issueNumber} · {i.lineNo} · {i.quantity}</MenuItem>) : null}</TextField>
 <Stack direction="row"><Button disabled={disabled || pages.length === 1} onClick={() => { setItem(''); setPages(p => p.slice(0, -1)); }}>{t.previous}</Button><Button disabled={disabled || q.isError || !q.data?.data.nextCursor} onClick={() => { setItem(''); setPages(p => [...p, q.data!.data.nextCursor!]); }}>{t.next}</Button></Stack>
 {q.isError ? <Alert severity="error">{t.error}</Alert> : null}<TextField label={t.reason} value={reason} disabled={disabled} onChange={e => setReason(e.target.value)}/><Button disabled={disabled || q.isError || !lineId || !itemId || !reason.trim()} onClick={() => onSend({ requestLineId: lineId, materialIssueItemId: itemId, reason })}>{t.link}</Button></Stack>;
}
function Evidence({ d, permissions }: {
    d: MaterialRequest;
    permissions: string[];
}) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)], cache = useQueryClient(), [file, setFile] = useState<File | null>(null), [type, setType] = useState('');
    const canUpload = ['documents.document.upload', 'documents.document.link'].every(p => permissions.includes(p));
    const types = useQuery({ queryKey: ['material-requests', 'document-types'], queryFn: documentsApi.typeOptions, enabled: canUpload, retry: false });
    const upload = useMutation({ mutationFn: () => documentsApi.uploadTargetDocument(d.projectId, 'MATERIAL_REQUEST', d.id, type, file!), onSettled: () => cache.invalidateQueries({ queryKey: ['material-requests', 'evidence', d.id] }) });
    return <Stack spacing={1}><Typography>{t.signature}</Typography>{canUpload ? <><TextField select label={t.type} value={type} disabled={upload.isPending} onChange={e => setType(e.target.value)}><MenuItem value="">{t.select}</MenuItem>{!types.isError ? (types.data?.data ?? []).map(x => <MenuItem key={x.id} value={x.id}>{x.documentTypeName}</MenuItem>) : null}</TextField><TextField type="file" label={t.file} slotProps={{ inputLabel: { shrink: true }, htmlInput: { accept: 'application/pdf,image/jpeg,image/png' } }} disabled={upload.isPending} onChange={e => setFile((e.target as HTMLInputElement).files?.[0] ?? null)}/>{file ? <Typography>{file.name}</Typography> : null}<Button disabled={upload.isPending || !file || !type || types.isError} onClick={() => upload.mutate()}>{t.upload}</Button>{upload.isError || types.isError ? <Alert severity="error">{t.error}</Alert> : null}{upload.isSuccess ? <Alert severity="success">{t.saved}</Alert> : null}</> : null}</Stack>;
}
function Receipt({ d, link, disabled, onSend }: {
    d: MaterialRequest;
    link: RequestLink;
    disabled: boolean;
    onSend: (body: Record<string, unknown>) => void;
}) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)], latest = link.receipts.find(r => !r.superseded), [recipient, setRecipient] = useState(latest?.recipientEmployeeId ?? ''), [issuer, setIssuer] = useState(latest?.issuerEmployeeId ?? ''), [received, setReceived] = useState(''), [doc, setDoc] = useState(''), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false);
    const evidence = useQuery({ queryKey: ['material-requests', 'evidence', d.id], queryFn: () => documentsApi.targetDocuments(d.projectId, 'MATERIAL_REQUEST', d.id), retry: false, gcTime: 0, refetchOnWindowFocus: true });
    const ready = Boolean(recipient && issuer && received && doc && reason.trim() && confirmed && Number.isFinite(new Date(received).getTime()));
    return <Stack spacing={1} sx={{ mt: 1 }}><Typography>{latest ? t.correction : t.receipt}</Typography>
  <Choice projectId={d.projectId} kind="employees" label={t.recipient} value={recipient} disabled={disabled} onChange={r => setRecipient(r?.id ?? '')}/><Choice projectId={d.projectId} kind="employees" label={t.issuer} value={issuer} disabled={disabled} onChange={r => setIssuer(r?.id ?? '')}/>
  <TextField type="datetime-local" label={t.received} slotProps={{ inputLabel: { shrink: true } }} value={received} disabled={disabled} onChange={e => setReceived(e.target.value)}/>
  <TextField select label={t.evidence} value={doc} disabled={disabled || evidence.isError} onChange={e => setDoc(e.target.value)}><MenuItem value="">{t.select}</MenuItem>{!evidence.isError ? (evidence.data?.data ?? []).filter(x => x.isActive && ['application/pdf', 'image/jpeg', 'image/png'].includes(x.mimeType)).map(x => <MenuItem key={x.id} value={x.id}>{x.fileName}</MenuItem>) : null}</TextField>
  {evidence.isError ? <Alert severity="error">{t.error}</Alert> : null}<TextField label={t.reason} value={reason} disabled={disabled} onChange={e => setReason(e.target.value)}/><FormControlLabel label={t.confirm} control={<Checkbox checked={confirmed} disabled={disabled} onChange={e => setConfirmed(e.target.checked)}/>}/>
  <Button disabled={disabled || !ready || evidence.isError} onClick={() => onSend({ issueLinkId: link.id, recipientEmployeeId: recipient, issuerEmployeeId: issuer, receivedAt: new Date(received).toISOString(), documentId: doc, signedEvidenceConfirmed: true, supersedesReceiptId: latest?.id ?? null, reason })}>{latest ? t.correction : t.receipt}</Button>
 </Stack>;
}
function IssueSource({ id, projectId }: {
    id: string;
    projectId: string;
}) {
    const t = materialRequestLabels[useContext(MonetaryLocaleContext)];
    const q = useQuery({ queryKey: ['material-requests', 'issue-source', projectId, id], queryFn: () => inventoryApi.materialIssue(id), retry: false, gcTime: 0, refetchOnWindowFocus: true });
    if (q.isError)
        return <Alert severity="error">{t.error}</Alert>;
    const d = q.data?.data;
    if (!d || d.projectId !== projectId)
        return null;
    return <Paper variant="outlined" sx={{ p: 1 }}><Typography>{d.issueNumber} · {d.issueDate.slice(0, 10)} · {d.postedAt ?? '—'}{d.reversedAt ? ' · ' + t.reversed : ''}</Typography></Paper>;
}
