import { Alert, Button, Divider, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useContext, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { documentsApi, type ProjectDocument } from '../api/documents';
import { physicalSubcontractsApi as api, type PhysicalCapture, type PhysicalDecision, type PhysicalDecisionInput,
  type PhysicalObservation, type PhysicalSource } from '../api/subcontract-physical';
import type { ClaimRecord } from '../api/subcontracts';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';
import { physicalLabels } from './physical-labels';

function quantityUnits(value: string | null): bigint | null {
  if (!value || !/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(value)) return null;
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
}
function heldQuantity(submitted: string | null, accepted: string): string | null {
  const s = quantityUnits(submitted), a = quantityUnits(accepted);
  if (s === null || a === null || a > s) return null;
  const held = s - a;
  return (held / 10000n).toString() + '.' + (held % 10000n).toString().padStart(4, '0');
}
function RequestError({ error }: { error: unknown }) {
  const t = physicalLabels[useContext(MonetaryLocaleContext)];
  return error ? <Alert severity="error">{t.error}{error instanceof ApiError && error.code ? ' · ' + error.code : ''}</Alert> : null;
}

export function PhysicalAcceptancePanel({ claim, source, permissions, onDirty, refresh }: {
  claim: ClaimRecord; source: PhysicalSource; permissions: string[]; onDirty: (value: boolean) => void; refresh: () => Promise<unknown>;
}) {
  const locale = useContext(MonetaryLocaleContext), t = physicalLabels[locale];
  const [epoch, setEpoch] = useState(0), [reloading, setReloading] = useState(false), [reloadError, setReloadError] = useState<unknown>(null);
  const reload = async () => {
    setReloading(true); setReloadError(null);
    try { await refresh(); setEpoch(value => value + 1); } catch (error) { setReloadError(error); }
    finally { setReloading(false); }
  };
  const unit = (id: string | null) => source.uoms.find(uom => uom.id === id)?.uomCode ?? '—';
  return <Stack spacing={2} data-testid="physical-acceptance" lang={locale} sx={{ minWidth: 0 }}>
    <Divider /><Typography variant="h6">{t.title}</Typography><Alert severity="info">{t.policy}</Alert>
    <RequestError error={reloadError} />
    {source.canCapture ? <CaptureEditor key={'capture-' + epoch} {...{ claim, source, permissions, onDirty }} reload={reload} reloading={reloading} /> : null}
    {source.canDecide ? <DecisionEditor key={'decision-' + epoch} {...{ claim, source, onDirty }} reload={reload} reloading={reloading} /> : null}
    <Typography variant="subtitle1">{t.history}</Typography>
    {source.revisions.map(revision => <Paper key={revision.id} variant="outlined" sx={{ p: 2, overflowWrap: 'anywhere' }}>
      <Stack spacing={1}><Typography>{t.revision} {revision.version} · {revision.actorName} · {new Date(revision.createdAt).toLocaleString(locale)}</Typography>
        <Typography>{revision.reason}</Typography>
        {revision.observations.map(o => {
          const decision = revision.id === source.submission?.revisionId ? source.decision?.decisions.find(d => d.observationId === o.id) : undefined;
          const origin = source.heldOrigins.find(held => held.id === o.heldSourceId);
          return <Stack key={o.id} spacing={0.5} data-testid="physical-history-observation">
            <Typography>{t.line} {claim.lines.find(line => line.id === o.claimLineId)?.lineNo ?? '—'} · {o.item} · {o.location}</Typography>
            <Typography>{t[o.basis]} · {o.quantity === null ? o.basisDescription : o.quantity + ' ' + unit(o.uomId)} · {t.progress}: {o.progressPercent}</Typography>
            <Typography>{o.reason}</Typography>
            {origin ? <Typography>{t.heldSource}: {origin.claimNumber} · {origin.item} · {origin.location}</Typography> : null}
            {decision ? <><Typography>{t.accepted}: {decision.acceptedQuantity ?? (decision.accepted ? t.accepted : '—')} · {t.held}: {decision.heldQuantity ?? (!decision.accepted ? t.held : '—')}{decision.heldDisposition ? ' · ' + t[decision.heldDisposition] : ''}</Typography>
              <Typography>{decision.reason}{decision.acceptedAmount === undefined ? '' : ' · ' + t.amount + ': ' + claim.currencyCode + ' ' + decision.acceptedAmount}</Typography></> : null}
          </Stack>;
        })}
      </Stack></Paper>)}
    {source.submission ? <Typography>{t.submitted} · {source.submission.actorName} · {new Date(source.submission.createdAt).toLocaleString(locale)}</Typography> : null}
    {source.decision ? <Typography>{source.decision.actorName} · {source.decision.reason}{source.decision.assessedAmount === undefined ? '' : ' · ' + t.assessment + ': ' + claim.currencyCode + ' ' + source.decision.assessedAmount}</Typography> : null}
    {permissions.includes('documents.document.view') ? <PhysicalEvidence key={claim.id} {...{ claim, permissions }} editable={source.canCapture && !reloading} /> : null}
  </Stack>;
}

function CaptureEditor({ claim, source, permissions, onDirty, reload, reloading }: {
  claim: ClaimRecord; source: PhysicalSource; permissions: string[]; onDirty: (value: boolean) => void;
  reload: () => Promise<void>; reloading: boolean;
}) {
  const t = physicalLabels[useContext(MonetaryLocaleContext)];
  const blank = (): PhysicalObservation => ({ id: crypto.randomUUID(), claimLineId: claim.lines[0]?.id ?? '', basis: 'MEASURED',
    item: '', location: '', basisDescription: '', quantity: '', uomId: null, progressPercent: '', reason: '', documentIds: [], heldSourceId: null });
  const [version] = useState(source.version), [reason, setReason] = useState(source.revisions[0]?.reason ?? '');
  const [rows, setRows] = useState<PhysicalObservation[]>(() => source.revisions[0]?.observations ?? [blank()]);
  const [baseline] = useState(() => JSON.stringify([reason, source.revisions[0]?.observations ?? []]));
  const [intent, setIntent] = useState<PhysicalCapture | null>(null);
  const files = useQuery({ queryKey: ['subcontracts', 'physical-files', claim.id], queryFn: () => documentsApi.targetDocuments(claim.projectId, 'SUBCONTRACT_CLAIM', claim.id),
    enabled: permissions.includes('documents.document.view'), retry: false, gcTime: 0 });
  const save = useMutation({ mutationFn: (body: PhysicalCapture) => api.capture(claim.id, body), retry: false, onSuccess: reload });
  const stale = source.version !== version, dirty = baseline !== JSON.stringify([reason, rows]);
  useEffect(() => { onDirty(dirty || stale || Boolean(intent)); }, [dirty, stale, intent, onDirty]);
  const disabled = Boolean(intent) || stale || reloading || save.isPending;
  const patch = (id: string, changes: Partial<PhysicalObservation>) => setRows(previous => previous.map(row => row.id === id ? { ...row, ...changes } : row));
  const send = () => {
    const body = intent ?? { requestKey: crypto.randomUUID(), expectedVersion: version, reason, observations: rows };
    setIntent(body); save.mutate(body);
  };
  return <Stack spacing={2} data-testid="physical-capture">
    {stale ? <Alert severity="warning">{t.stale}</Alert> : dirty ? <Alert severity="info">{t.dirty}</Alert> : null}
    <RequestError error={save.error ?? files.error} />
    {intent && save.isError ? <Alert severity="warning">{t.uncertain}<Button onClick={send} disabled={save.isPending || stale}>{t.retry}</Button></Alert> : null}
    <Button onClick={() => void reload()} disabled={reloading || save.isPending} sx={{ alignSelf: 'flex-start' }}>{t.reload}</Button>
    {rows.map((o, index) => <Paper key={o.id} variant="outlined" sx={{ p: 2, minWidth: 0 }}><Stack spacing={2} data-testid="physical-observation">
      <Typography>{t.item} {index + 1}</Typography>
      <TextField select label={t.line} value={o.claimLineId} disabled={disabled} onChange={e => patch(o.id, { claimLineId: e.target.value })}>
        {claim.lines.map(line => <MenuItem key={line.id} value={line.id}>{t.line} {line.lineNo}{line.workOrder ? ' · ' + line.workOrder.workOrderNumber : ''}</MenuItem>)}
      </TextField>
      <TextField select label={t.heldSource} value={o.heldSourceId ?? ''} disabled={disabled} onChange={e => {
        const held = source.heldSources.find(row => row.id === e.target.value);
        patch(o.id, held ? { heldSourceId: held.id, basis: held.basis, item: held.item, location: held.location,
          basisDescription: held.basisDescription, uomId: held.uomId, quantity: held.basis === 'MEASURED' ? '' : null } : { heldSourceId: null });
      }}><MenuItem value="">{t.newWork}</MenuItem>{source.heldSources.map(held => <MenuItem key={held.id} value={held.id} sx={{ whiteSpace: 'normal' }}>{held.claimNumber} · {held.item} · {held.location}{held.remainingQuantity === null ? '' : ' · ' + t.remaining + ': ' + held.remainingQuantity}</MenuItem>)}</TextField>
      <TextField label={t.item} value={o.item} disabled={disabled || Boolean(o.heldSourceId)} onChange={e => patch(o.id, { item: e.target.value })} />
      <TextField label={t.location} value={o.location} disabled={disabled || Boolean(o.heldSourceId)} onChange={e => patch(o.id, { location: e.target.value })} />
      <TextField select label={t.basis} value={o.basis} disabled={disabled || Boolean(o.heldSourceId)} onChange={e => {
        const basis = e.target.value as PhysicalObservation['basis'];
        patch(o.id, { basis, quantity: basis === 'MEASURED' ? '' : null, uomId: null, basisDescription: '' });
      }}>{(['MEASURED', 'MILESTONE', 'LUMP_SUM'] as const).map(basis => <MenuItem key={basis} value={basis}>{t[basis]}</MenuItem>)}</TextField>
      {o.basis === 'MEASURED' ? <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField label={t.quantity} value={o.quantity ?? ''} disabled={disabled} onChange={e => patch(o.id, { quantity: e.target.value })} inputProps={{ inputMode: 'decimal' }} sx={{ flex: 1, minWidth: 0 }} />
        <TextField select label={t.uom} value={o.uomId ?? ''} disabled={disabled || Boolean(o.heldSourceId)} onChange={e => patch(o.id, { uomId: e.target.value || null })} sx={{ flex: 1, minWidth: 0 }}>
          <MenuItem value="">{t.select}</MenuItem>{source.uoms.filter(u => u.isActive || u.id === o.uomId).map(u => <MenuItem key={u.id} value={u.id}>{u.uomCode} · {u.uomName}</MenuItem>)}
        </TextField></Stack> : <TextField label={t.basisDescription} value={o.basisDescription} disabled={disabled || Boolean(o.heldSourceId)} onChange={e => patch(o.id, { basisDescription: e.target.value })} />}
      <TextField label={t.progress} value={o.progressPercent} disabled={disabled} onChange={e => patch(o.id, { progressPercent: e.target.value })} inputProps={{ inputMode: 'decimal' }} />
      <TextField label={t.reason} value={o.reason} disabled={disabled} onChange={e => patch(o.id, { reason: e.target.value })} multiline />
      <TextField select label={t.evidence} value={o.documentIds} SelectProps={{ multiple: true }} disabled={disabled || files.isError || files.isPending} onChange={e => patch(o.id, { documentIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}>
        {!files.isError ? files.data?.data.filter(f => f.isActive).map(f => <MenuItem key={f.id} value={f.id}>{f.fileName}</MenuItem>) : null}
      </TextField>
      <Button onClick={() => setRows(previous => previous.filter(row => row.id !== o.id))} disabled={disabled || rows.length === 1}>{t.remove}</Button>
    </Stack></Paper>)}
    <Button onClick={() => setRows(previous => [...previous, blank()])} disabled={disabled || rows.length >= 100 || claim.lines.length === 0}>{t.add}</Button>
    <TextField label={t.captureReason} value={reason} disabled={disabled} onChange={e => setReason(e.target.value)} multiline />
    {!rows.some(o => o.documentIds.length > 0) ? <Alert severity="info">{t.noEvidence}</Alert> : null}
    <Button variant="contained" onClick={send} disabled={disabled || files.isError || files.isPending || !reason.trim() || rows.some(o => !o.claimLineId || !o.item.trim() || !o.location.trim() || !o.progressPercent || !o.reason.trim() || (o.basis === 'MEASURED' ? !o.quantity || !o.uomId : !o.basisDescription.trim()))}>{t.capture}</Button>
  </Stack>;
}

function DecisionEditor({ claim, source, onDirty, reload, reloading }: {
  claim: ClaimRecord; source: PhysicalSource; onDirty: (value: boolean) => void; reload: () => Promise<void>; reloading: boolean;
}) {
  const t = physicalLabels[useContext(MonetaryLocaleContext)];
  const [version] = useState(source.version), [digest] = useState(source.submission?.sourceDigest), [reason, setReason] = useState('');
  const observations = source.revisions.find(r => r.id === source.submission?.revisionId)?.observations ?? [];
  type Entry = { acceptedQuantity: string; accepted: '' | 'yes' | 'no'; acceptedAmount: string; heldDisposition: '' | 'REWORK' | 'REJECTED'; reason: string };
  const [rows, setRows] = useState<Record<string, Entry>>(() => Object.fromEntries(observations.map(o => [o.id, { acceptedQuantity: '', accepted: '', acceptedAmount: '', heldDisposition: '', reason: '' }])));
  const [intent, setIntent] = useState<PhysicalDecision | null>(null);
  const mutation = useMutation({ mutationFn: (body: PhysicalDecision) => api.decide(claim.id, body), retry: false, onSuccess: reload });
  const stale = version !== source.version || digest !== source.submission?.sourceDigest;
  const dirty = Boolean(reason) || Object.values(rows).some(row => Object.values(row).some(Boolean));
  useEffect(() => { onDirty(dirty || stale || Boolean(intent)); }, [dirty, stale, intent, onDirty]);
  const disabled = reloading || Boolean(intent) || stale || mutation.isPending;
  const patch = (id: string, changes: Partial<Entry>) => setRows(previous => ({ ...previous, [id]: { ...previous[id]!, ...changes } }));
  const decisions = observations.map(o => {
    const row = rows[o.id]!, measured = o.basis === 'MEASURED', held = measured ? heldQuantity(o.quantity, row.acceptedQuantity) : null;
    const hasHeld = measured ? held !== null && quantityUnits(held)! > 0n : row.accepted === 'no';
    return { observationId: o.id, ...(measured ? { acceptedQuantity: row.acceptedQuantity } : { accepted: row.accepted === 'yes' }),
      acceptedAmount: row.acceptedAmount, heldDisposition: hasHeld ? row.heldDisposition || null : null, reason: row.reason } satisfies PhysicalDecisionInput;
  });
  const valid = Boolean(digest) && observations.length > 0 && reason.trim() && observations.every(o => {
    const row = rows[o.id]!, held = heldQuantity(o.quantity, row.acceptedQuantity);
    return row.reason.trim() && row.acceptedAmount && (o.basis === 'MEASURED' ? held !== null && (quantityUnits(held) === 0n || Boolean(row.heldDisposition)) : row.accepted && (row.accepted === 'yes' || row.heldDisposition));
  });
  const send = () => {
    if (!digest) return;
    const body = intent ?? { requestKey: crypto.randomUUID(), expectedVersion: version, sourceDigest: digest, reason, decisions };
    setIntent(body); mutation.mutate(body);
  };
  return <Stack spacing={2} data-testid="physical-decision">
    {stale ? <Alert severity="warning">{t.stale}</Alert> : null}<RequestError error={mutation.error} />
    {intent && mutation.isError ? <Alert severity="warning">{t.uncertain}<Button onClick={send} disabled={mutation.isPending || stale}>{t.retry}</Button></Alert> : null}
    <Button onClick={() => void reload()} disabled={reloading || mutation.isPending} sx={{ alignSelf: 'flex-start' }}>{t.reload}</Button>
    {observations.map(o => { const row = rows[o.id]!, held = heldQuantity(o.quantity, row.acceptedQuantity);
      const hasHeld = o.basis === 'MEASURED' ? held !== null && quantityUnits(held)! > 0n : row.accepted === 'no';
      return <Paper key={o.id} variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
        <Typography>{o.item} · {o.location} · {t[o.basis]} · {o.quantity ?? o.basisDescription}</Typography>
        {o.basis === 'MEASURED' ? <><TextField label={t.acceptedQuantity} value={row.acceptedQuantity} disabled={disabled} onChange={e => patch(o.id, { acceptedQuantity: e.target.value })} inputProps={{ inputMode: 'decimal' }} />
          <Typography>{t.held}: {held ?? '—'}</Typography></> : <TextField select label={t.accepted} value={row.accepted} disabled={disabled} onChange={e => patch(o.id, { accepted: e.target.value as Entry['accepted'] })}>
          <MenuItem value="">{t.select}</MenuItem><MenuItem value="yes">{t.accepted}</MenuItem><MenuItem value="no">{t.held}</MenuItem></TextField>}
        {hasHeld ? <TextField select label={t.disposition} value={row.heldDisposition} disabled={disabled} onChange={e => patch(o.id, { heldDisposition: e.target.value as Entry['heldDisposition'] })}>
          <MenuItem value="">{t.select}</MenuItem><MenuItem value="REWORK">{t.REWORK}</MenuItem><MenuItem value="REJECTED">{t.REJECTED}</MenuItem></TextField> : null}
        <TextField label={t.amount + ' · ' + claim.currencyCode} value={row.acceptedAmount} disabled={disabled} onChange={e => patch(o.id, { acceptedAmount: e.target.value })} inputProps={{ inputMode: 'decimal' }} />
        <TextField label={t.reason} value={row.reason} disabled={disabled} onChange={e => patch(o.id, { reason: e.target.value })} multiline />
      </Stack></Paper>;
    })}
    <TextField label={t.decisionReason} value={reason} disabled={disabled} onChange={e => setReason(e.target.value)} multiline />
    <Button variant="contained" onClick={send} disabled={disabled || !valid}>{t.decide}</Button>
  </Stack>;
}

function PhysicalEvidence({ claim, permissions, editable }: { claim: ClaimRecord; permissions: string[]; editable: boolean }) {
  const t = physicalLabels[useContext(MonetaryLocaleContext)];
  const [type, setType] = useState(''), [file, setFile] = useState<File | null>(null);
  const canUpload = editable && permissions.includes('documents.document.upload') && permissions.includes('documents.document.link');
  const files = useQuery({ queryKey: ['subcontracts', 'physical-files', claim.id], queryFn: () => documentsApi.targetDocuments(claim.projectId, 'SUBCONTRACT_CLAIM', claim.id), retry: false, gcTime: 0 });
  const types = useQuery({ queryKey: ['subcontracts', 'physical-document-types'], queryFn: documentsApi.typeOptions, enabled: canUpload, retry: false, gcTime: 0 });
  const upload = useMutation({ mutationFn: () => documentsApi.uploadTargetDocument(claim.projectId, 'SUBCONTRACT_CLAIM', claim.id, type, file!),
    retry: false, onSuccess: async () => { setFile(null); await files.refetch(); } });
  const download = useMutation({ mutationFn: async (file: ProjectDocument) => {
    const result = await documentsApi.downloadTargetDocument(claim.projectId, 'SUBCONTRACT_CLAIM', claim.id, file.id);
    const url = URL.createObjectURL(result.blob), a = document.createElement('a');
    a.href = url; a.download = result.fileName ?? file.fileName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, retry: false });
  return <Stack spacing={1} data-testid="physical-evidence"><Typography variant="subtitle1">{t.evidence}</Typography>
    <RequestError error={files.error ?? types.error ?? upload.error ?? download.error} />
    {!files.isError ? files.data?.data.map(f => <Button key={f.id} onClick={() => download.mutate(f)} disabled={download.isPending} sx={{ alignSelf: 'flex-start', overflowWrap: 'anywhere' }}>{t.download} · {f.fileName}</Button>) : null}
    {canUpload ? <><TextField select label={t.documentType} value={type} disabled={types.isError || upload.isPending} onChange={e => setType(e.target.value)}>
      <MenuItem value="">{t.select}</MenuItem>{!types.isError ? types.data?.data.map(dt => <MenuItem key={dt.id} value={dt.id}>{dt.documentTypeName}</MenuItem>) : null}
    </TextField><input aria-label={t.evidence} type="file" disabled={upload.isPending} onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ maxWidth: '100%' }} />
      <Button onClick={() => upload.mutate()} disabled={!file || !type || types.isError || upload.isPending}>{t.upload}</Button></> : null}
  </Stack>;
}
