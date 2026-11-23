import {
  Alert, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack,
  TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { documentsApi } from '../api/documents';
import { inventoryApi } from '../api/inventory';
import { operationalExceptionsApi, type LossCaseInput } from '../api/operational-exceptions';

function localDay() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const validUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const validQuantity = (v: string) =>
  /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(v) && Number(v) > 0;
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Loss/damage case operation failed.';
}
export function StockLossCasesPanel({
  permissions, roleCodes, userId,
}: { permissions: string[]; roleCodes: string[]; userId: string }) {
  const client = useQueryClient();
  const view = permissions.includes('inventory.stock.view') &&
    permissions.includes('documents.document.view') &&
    roleCodes.some(role => ['STOREKEEPER','PROJECT_MANAGER','MANAGEMENT','FINANCE_MANAGER'].includes(role));
  const maker = view && roleCodes.includes('STOREKEEPER') &&
    permissions.includes('inventory.stock_count.view');
  const pm = view && roleCodes.includes('PROJECT_MANAGER');
  const ben = view && roleCodes.includes('MANAGEMENT');
  const nancy = view && roleCodes.includes('FINANCE_MANAGER');

  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [materialKey, setMaterialKey] = useState('');
  const [choicePages, setChoicePages] = useState<string[]>(['']);
  const [kind, setKind] = useState<LossCaseInput['kind']>('DAMAGE');
  const [quantity, setQuantity] = useState('');
  const [occurredOn, setOccurredOn] = useState(localDay);
  const [finderName, setFinderName] = useState('');
  const [place, setPlace] = useState('');
  const [cause, setCause] = useState('');
  const [disposition, setDisposition] = useState<LossCaseInput['proposedDisposition']>('DISPOSAL');
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [caseId, setCaseId] = useState('');
  const [caseIdInput, setCaseIdInput] = useState('');
  const [pmDecision, setPmDecision] = useState<'RETURN' | 'NONDISPOSAL_REVIEW' | 'FORWARD_DISPOSAL'>('FORWARD_DISPOSAL');
  const [escalateToBen, setEscalateToBen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [nancyDecision, setNancyDecision] = useState<'APPROVE_PROPOSAL' | 'REJECT_PROPOSAL'>('APPROVE_PROPOSAL');
  const [feedback, setFeedback] = useState('');

  const projects = useQuery({
    queryKey: ['m4-loss-projects'], queryFn: documentsApi.projects,
    enabled: view, retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const scoped = view && projects.isSuccess && !projects.isFetching &&
    projects.data.data.some(p => p.id === projectId);
  const sites = useQuery({
    queryKey: ['m4-loss-sites', projectId],
    queryFn: () => inventoryApi.stockCountWarehouses(projectId),
    enabled: maker && scoped, retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const validSite = maker && scoped && sites.isSuccess && !sites.isFetching &&
    sites.data.data.some(x => x.id === warehouseId);
  const choices = useQuery({
    queryKey: ['m4-loss-choices', projectId, warehouseId, choicePages.at(-1) ?? ''],
    queryFn: () => inventoryApi.stockCountChoices(projectId, warehouseId, choicePages.at(-1) ?? ''),
    enabled: validSite, retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const selectedStock = choices.isSuccess && !choices.isFetching ?
    choices.data.data.items.find(x => x.materialId + ':' + x.uomId === materialKey) : null;
  const documents = useQuery({
    queryKey: ['m4-loss-documents', projectId],
    queryFn: () => documentsApi.projectDocuments(projectId),
    enabled: scoped && maker, retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const types = useQuery({
    queryKey: ['m4-loss-document-types'],
    queryFn: documentsApi.typeOptions,
    enabled: maker, retry: false, gcTime: 0,
  });
  const eligibleDocs = documents.isSuccess && !documents.isFetching ?
    documents.data.data.filter(d => d.isActive && Boolean(d.checksum)) : [];
  const selectedDocsValid = documentIds.length > 0 && documentIds.length <= 20 &&
    documentIds.every(id => eligibleDocs.some(d => d.id === id));

  const caseQuery = useQuery({
    queryKey: ['m4-loss-case', projectId, caseId],
    queryFn: () => operationalExceptionsApi.lossRead(caseId),
    enabled: scoped && view && validUuid(caseId),
    retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const record = caseQuery.isSuccess && !caseQuery.isFetching &&
    caseQuery.data.data.projectId === projectId ? caseQuery.data.data : null;
  const canOpen = Boolean(maker && validSite && selectedStock && validQuantity(quantity) &&
    /^\d{4}-\d{2}-\d{2}$/.test(occurredOn) && finderName.trim() && place.trim() && cause.trim() &&
    finderName.trim().length <= 200 && place.trim().length <= 500 &&
    cause.trim().length <= 2000 && selectedDocsValid);
  const open = useMutation({
    mutationFn: (input: LossCaseInput) => operationalExceptionsApi.lossOpen(input),
    onSuccess: async response => {
      setFeedback('Case registered. Share this case reference with the next reviewer.');
      setCaseId(response.data.caseId); setCaseIdInput(response.data.caseId);
      setDocumentIds([]);
      await client.invalidateQueries({ queryKey: ['m4-loss-case', projectId] });
    },
    onError: (error: unknown) => setFeedback(errorText(error)),
  });
  const review = useMutation({
    mutationFn: (execute: () => Promise<unknown>) => execute(),
    onSuccess: async () => {
      setFeedback('Decision recorded with immutable audit history. Reloading the case.');
      setReviewNote('');
      await client.invalidateQueries({ queryKey: ['m4-loss-case', projectId, caseId] });
    },
    onError: (error: unknown) => setFeedback(errorText(error)),
  });
  const upload = useMutation({
    mutationFn: () => {
      if (!uploadFile || !documentTypeId) throw new Error('Select a document type and file.');
      return documentsApi.uploadProjectDocument(projectId, documentTypeId, uploadFile);
    },
    onSuccess: async () => {
      setFeedback('Project evidence uploaded. Select it below before creating the case.');
      setUploadFile(null);
      await client.invalidateQueries({ queryKey: ['m4-loss-documents', projectId] });
    },
    onError: (error: unknown) => setFeedback(errorText(error)),
  });
  // Stage/authority controls must remain visible BEFORE the reviewer types a note.
  // Input validity controls only the submit button, never visibility of its own fields.
  const pmStage = pm && record?.status === 'OPEN' && record.makerUserId !== userId;
  const benStage = ben && record?.status === 'BEN_PENDING' &&
    record.makerUserId !== userId && record.pmUserId !== userId;
  const nancyStage = nancy && record?.status === 'NANCY_PENDING' &&
    record.proposedDisposition === 'DISPOSAL' &&
    record.makerUserId !== userId && record.pmUserId !== userId &&
    record.benUserId !== userId;
  const pmDecisionValid = pmStage && (pmDecision === 'RETURN' ? !escalateToBen :
    pmDecision === 'FORWARD_DISPOSAL' ? record?.proposedDisposition === 'DISPOSAL' :
      record?.proposedDisposition !== 'DISPOSAL');
  const pmReady = pmDecisionValid && Boolean(reviewNote.trim());
  const benReady = benStage && Boolean(reviewNote.trim());
  const nancyReady = nancyStage && Boolean(reviewNote.trim());
  const doReview = (run: () => Promise<unknown>) => { setFeedback(''); review.mutate(run); };
  if (!view) return <Alert severity="info">This case log requires a current business role and active stock/document view permissions.</Alert>;
  return (
    <Stack spacing={2}>
      <Typography variant="h6">SS13 — loss, damage and waste cases</Typography>
      <Alert severity="info">
        Store records a real incident and evidence. Khaimook checks severity; Ben may acknowledge
        an escalated case; Nancy decides a disposal proposal. Even an approved proposal does not
        execute a stock movement or financial write-off.
      </Alert>
      <TextField select label="Project" value={projectId} sx={{ maxWidth: 520 }}
        onChange={e => {
          setProjectId(e.target.value); setWarehouseId(''); setMaterialKey('');
          setCaseId('');setCaseIdInput('');setDocumentIds([]);setChoicePages(['']);setFeedback('');
        }}>
        <MenuItem value="">Select Project</MenuItem>
        {(projects.isSuccess && !projects.isFetching ? projects.data.data : []).map(p =>
          <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</MenuItem>)}
      </TextField>
      {projects.error ? <Alert severity="error">{errorText(projects.error)}</Alert> : null}
      {maker && scoped ? (
        <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
          <Typography variant="subtitle1">Store — open a physical incident case</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField select label="Site Warehouse" value={warehouseId} sx={{ minWidth: 240 }}
              onChange={e => {setWarehouseId(e.target.value);setMaterialKey('');setChoicePages(['']);}}>
              <MenuItem value="">Choose site</MenuItem>
              {(sites.isSuccess && !sites.isFetching ? sites.data.data : []).map(site =>
                <MenuItem key={site.id} value={site.id}>{site.warehouseCode} — {site.warehouseName}</MenuItem>)}
            </TextField>
            <TextField select label="Material / valid stock UOM" value={materialKey}
              disabled={!validSite} sx={{ minWidth: 290 }}
              onChange={e => setMaterialKey(e.target.value)}>
              <MenuItem value="">Choose Material/UOM</MenuItem>
              {(choices.isSuccess && !choices.isFetching ? choices.data.data.items : []).map(c =>
                <MenuItem key={c.materialId + ':' + c.uomId} value={c.materialId + ':' + c.uomId}>
                  {c.materialCode} — {c.materialName} / {c.uomCode}
                </MenuItem>)}
            </TextField>
            <Button disabled={choicePages.length <= 1 || choices.isFetching}
              onClick={() => { setChoicePages(x => x.slice(0, -1)); setMaterialKey(''); }}>
              Previous materials
            </Button>
            <Button disabled={!choices.data?.data.nextCursor || choices.isFetching}
              onClick={() => { setChoicePages(x => [...x, choices.data!.data.nextCursor!]); setMaterialKey(''); }}>
              Next materials
            </Button>
          </Stack>
          {sites.error || choices.error ? <Alert severity="error">{errorText(sites.error ?? choices.error)}</Alert> : null}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField select label="Incident type" value={kind}
              onChange={e => setKind(e.target.value as LossCaseInput['kind'])}>
              <MenuItem value="LOSS">Loss</MenuItem><MenuItem value="DAMAGE">Damage</MenuItem>
              <MenuItem value="WASTE">Waste</MenuItem>
            </TextField>
            <TextField label="Physical quantity" value={quantity} inputMode="decimal"
              onChange={e => setQuantity(e.target.value)}
              helperText="Positive quantity, at most 4 decimals" />
            <TextField label="Discovered on" type="date" value={occurredOn}
              onChange={e => setOccurredOn(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField select label="Proposed handling" value={disposition}
              onChange={e => setDisposition(e.target.value as LossCaseInput['proposedDisposition'])}>
              <MenuItem value="REPAIR">Repair</MenuItem><MenuItem value="RETURN">Return</MenuItem>
              <MenuItem value="DISPOSAL">Disposal proposal</MenuItem>
            </TextField>
          </Stack>
          <TextField label="Who found the incident" value={finderName}
            onChange={e => setFinderName(e.target.value)} inputProps={{ maxLength: 200 }} />
          <TextField label="Exact location / site area" value={place}
            onChange={e => setPlace(e.target.value)} inputProps={{ maxLength: 500 }} />
          <TextField label="Cause / circumstances" value={cause} multiline minRows={2}
            onChange={e => setCause(e.target.value)} inputProps={{ maxLength: 2000 }} />
          <Typography variant="subtitle2">Canonical Project evidence</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField select label="Document type" value={documentTypeId}
              sx={{ minWidth: 240 }} onChange={e => setDocumentTypeId(e.target.value)}>
              <MenuItem value="">Choose type</MenuItem>
              {(types.isSuccess ? types.data.data : []).map(t =>
                <MenuItem key={t.id} value={t.id}>{t.documentTypeName}</MenuItem>)}
            </TextField>
            <Button variant="outlined" component="label">
              {uploadFile ? uploadFile.name : 'Choose real evidence file'}
              <input type="file" hidden onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            </Button>
            <Button disabled={!uploadFile || !documentTypeId || upload.isPending}
              onClick={() => {setFeedback('');upload.mutate();}}>Upload Project evidence</Button>
          </Stack>
          <Stack spacing={0.5}>
            {eligibleDocs.map(d => <FormControlLabel key={d.id}
              control={<Checkbox checked={documentIds.includes(d.id)}
                onChange={(_e, checked) => setDocumentIds(old =>
                  checked ? [...old, d.id] : old.filter(id => id !== d.id))} />}
              label={d.fileName + ' (' + d.documentType.documentTypeName + ')'} />)}
          </Stack>
          {documents.error ? <Alert severity="error">{errorText(documents.error)}</Alert> : null}
          {eligibleDocs.length === 0 ? <Alert severity="warning">Upload an actual Project document before filing this case.</Alert> : null}
          <Button variant="contained" disabled={!canOpen || open.isPending || documents.isFetching}
            onClick={() => {
              if (!selectedStock) return;
              setFeedback('');
              open.mutate({
                projectId,warehouseId,materialId:selectedStock.materialId,uomId:selectedStock.uomId,
                quantity,kind,occurredOn,finderName:finderName.trim(),place:place.trim(),
                cause:cause.trim(),proposedDisposition:disposition,evidenceDocumentIds:documentIds,
              });
            }}>Create immutable loss/damage case</Button>
        </Stack></Paper>
      ) : null}
      {scoped ? (
        <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
          <Typography variant="subtitle1">Open a case for independent review</Typography>
          <Alert severity="info">Cases have protected UUID references, not a public cross-Project list. Paste the case ID given by Store.</Alert>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField label="Case UUID" value={caseIdInput} sx={{ flexGrow: 1 }}
              onChange={e => setCaseIdInput(e.target.value)} />
            <Button variant="outlined" disabled={!validUuid(caseIdInput)}
              onClick={() => {setCaseId(caseIdInput);setReviewNote('');setFeedback('');}}>
              Open authorized case
            </Button>
            <Button disabled={!caseId || caseQuery.isFetching} onClick={() => void caseQuery.refetch()}>Refresh</Button>
          </Stack>
          {caseQuery.error ? <Alert severity="error">{errorText(caseQuery.error)}</Alert> : null}
          {record ? (
            <Stack spacing={1}>
              <Typography variant="body2">Status: {record.status} · version {record.version}</Typography>
              <Typography variant="body2">Type: {record.kind} · Quantity: {record.quantity} · Date: {record.occurredOn}</Typography>
              <Typography variant="body2">Location: {record.place}</Typography>
              <Typography variant="body2">Cause: {record.cause}</Typography>
              <Typography variant="body2">Proposed: {record.proposedDisposition}</Typography>
              <Typography variant="body2">Evidence documents: {record.evidenceDocumentIds.length} verified source references</Typography>
              <Typography variant="body2">Khaimook: {record.pmNote ?? 'Pending'} · Ben: {record.benNote ?? 'Not required / pending'} · Nancy: {record.nancyNote ?? 'Pending'}</Typography>
              {record.status === 'NANCY_APPROVED_PENDING_EXECUTION' ? (
                <Alert severity="warning">Only the proposal is approved. Actual disposal and financial write-off are NOT posted.</Alert>
              ) : null}
            </Stack>
          ) : null}
          {record && (pmStage || benStage || nancyStage) ? (
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                {pmStage ? 'Khaimook severity screen' : benStage ? 'Ben property-severity acknowledgment' : 'Nancy disposal-proposal decision'}
              </Typography>
              {pmStage ? <>
                <TextField select label="PM decision" value={pmDecision}
                  onChange={e => {
                    const value=e.target.value as typeof pmDecision;
                    setPmDecision(value);
                    if(value === 'RETURN')setEscalateToBen(false);
                  }}>
                  <MenuItem value="RETURN">Return for correction</MenuItem>
                  {record.proposedDisposition !== 'DISPOSAL' ? <MenuItem value="NONDISPOSAL_REVIEW">Review repair/return</MenuItem> : null}
                  {record.proposedDisposition === 'DISPOSAL' ? <MenuItem value="FORWARD_DISPOSAL">Forward disposal proposal</MenuItem> : null}
                </TextField>
                <TextField select label="Escalate to Ben?" value={escalateToBen ? 'yes' : 'no'}
                  disabled={pmDecision === 'RETURN'}
                  onChange={e => setEscalateToBen(e.target.value === 'yes')}>
                  <MenuItem value="no">No — Khaimook assessment sufficient</MenuItem>
                  <MenuItem value="yes">Yes — Ben must acknowledge severity</MenuItem>
                </TextField>
              </> : null}
              {nancyStage ? <TextField select label="Nancy proposal decision" value={nancyDecision}
                onChange={e => setNancyDecision(e.target.value as typeof nancyDecision)}>
                <MenuItem value="APPROVE_PROPOSAL">Approve proposal — execution still pending</MenuItem>
                <MenuItem value="REJECT_PROPOSAL">Reject proposal</MenuItem>
              </TextField> : null}
              <TextField label="Independent review reason" value={reviewNote} multiline minRows={2}
                onChange={e => setReviewNote(e.target.value)} inputProps={{ maxLength: 2000 }} />
              <Button variant="contained" disabled={!(pmReady || benReady || nancyReady) || review.isPending ||
                caseQuery.isFetching || !record.latestEventId}
                onClick={() => {
                  if (!record) return;
                  if (pmReady) doReview(() => operationalExceptionsApi.lossScreen(
                    record.caseId, record.latestEventId, pmDecision, escalateToBen, reviewNote.trim()));
                  else if (benReady) doReview(() => operationalExceptionsApi.lossBenReview(
                    record.caseId, record.latestEventId, reviewNote.trim()));
                  else if (nancyReady) doReview(() => operationalExceptionsApi.lossNancyDecision(
                    record.caseId, record.latestEventId, nancyDecision, reviewNote.trim()));
                }}>Record independent operational decision</Button>
            </Stack>
          ) : null}
        </Stack></Paper>
      ) : null}
      {feedback ? <Alert severity={open.isError || review.isError || upload.isError ? 'error' : 'success'}>{feedback}</Alert> : null}
    </Stack>
  );
}
