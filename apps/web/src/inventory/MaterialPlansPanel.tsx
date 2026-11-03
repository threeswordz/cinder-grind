import { useContext, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, MenuItem, Paper, Stack,
  TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  materialPlansApi as api,
  type MaterialPlan, type PlanChoice, type PlanContent, type PlanLineInput,
} from '../api/material-plans';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';
import { materialPlanLabels } from './material-plan-labels';

type Intent =
  | { kind: 'CREATE'; body: PlanContent & { requestKey: string; projectId: string; warehouseId: string; budgetRevisionId: string; workPackageCode: string } }
  | { kind: 'REVISE'; id: string; body: PlanContent & { requestKey: string; expectedVersion: number } }
  | { kind: 'SUBMIT'; id: string; body: { requestKey: string; expectedVersion: number } }
  | { kind: 'DECIDE'; id: string; body: { requestKey: string; expectedVersion: number; decision: 'APPROVE' | 'REJECT'; comment: string } };

const validQuantity = (v: string) =>
  /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(v) && Number(v) > 0;
const pageOptions = { retry: false, gcTime: 0, refetchOnWindowFocus: true } as const;

export function MaterialPlansPanel({ permissions }: { permissions: string[] }) {
  const t = materialPlanLabels[useContext(MonetaryLocaleContext)];
  const cache = useQueryClient();
  const can = (s: string) => permissions.includes('inventory.material_plan.' + s);
  const view = can('view');
  const [projectId, setProjectId] = useState('');
  const [planId, setPlanId] = useState('');
  const [listPages, setListPages] = useState<string[]>(['']);
  const [historyPages, setHistoryPages] = useState<string[]>(['']);
  const [choicePages, setChoicePages] = useState<Record<string, string[]>>({});
  const [mode, setMode] = useState<'CREATE' | 'REVISE'>('CREATE');
  const [warehouseId, setWarehouseId] = useState('');
  const [basisId, setBasisId] = useState('');
  const [packageCode, setPackageCode] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<PlanLineInput[]>([]);
  const [comment, setComment] = useState('');
  // Keep the exact requestKey and payload across a lost-response retry.
  // Do not permit a different action while a prior result is uncertain.
  const [pending, setPending] = useState<Intent | null>(null);
  const [saved, setSaved] = useState(false);
  const choiceKey = (kind: string) => projectId + ':' + basisId + ':' + kind;
  const pagesFor = (kind: string) => choicePages[choiceKey(kind)] ?? [''];
  const choosePage = (kind: string, pages: string[]) =>
    setChoicePages(old => ({ ...old, [choiceKey(kind)]: pages }));

  const projects = useQuery({
    queryKey: ['material-plan-ui', 'projects', permissions.join(',')],
    queryFn: api.projects, enabled: view, ...pageOptions,
  });
  const authorizedProject = projects.isSuccess && !projects.isFetching &&
    projects.data.data.some(p => p.id === projectId);
  const plans = useQuery({
    queryKey: ['material-plan-ui', 'list', projectId, listPages.at(-1)],
    queryFn: () => api.list(projectId, listPages.at(-1) ?? ''),
    enabled: view && authorizedProject, ...pageOptions,
  });
  const detail = useQuery({
    queryKey: ['material-plan-ui', 'detail', planId],
    queryFn: () => api.get(planId),
    enabled: view && authorizedProject && Boolean(planId), ...pageOptions,
  });
  const history = useQuery({
    queryKey: ['material-plan-ui', 'history', planId, historyPages.at(-1)],
    queryFn: () => api.history(planId, historyPages.at(-1) ?? ''),
    enabled: view && authorizedProject && Boolean(planId), ...pageOptions,
  });
  const editing = mode === 'CREATE' ? can('create') : can('revise');
  const choicesEnabled = view && authorizedProject && editing;
  const choices = (kind: 'warehouses' | 'materials' | 'revisions' | 'source-lines') => {
    const after = pagesFor(kind).at(-1) ?? '';
    return {
      queryKey: ['material-plan-ui', 'choices', projectId, kind, basisId, after],
      queryFn: () => api.choices(projectId, kind, basisId, after),
      enabled: choicesEnabled && (kind !== 'source-lines' || Boolean(basisId)),
      ...pageOptions,
    };
  };
  const warehouses = useQuery(choices('warehouses'));
  const revisions = useQuery(choices('revisions'));
  const materials = useQuery(choices('materials'));
  const sourceLines = useQuery(choices('source-lines'));
  // React Query can retain previously authorized data after a failed refetch.
  // Mask the old snapshot during access revalidation and on denial.
  const current: MaterialPlan | null = authorizedProject && detail.isSuccess && !detail.isFetching &&
    detail.data.data.id === planId && detail.data.data.projectId === projectId ? detail.data.data : null;
  const selected = current?.latestRevision ?? null;
  const sourceRows = authorizedProject && sourceLines.isSuccess && !sourceLines.isFetching ? sourceLines.data.data.items : [];
  const materialRows = authorizedProject && materials.isSuccess && !materials.isFetching ? materials.data.data.items : [];
  const plansPage = authorizedProject && plans.isSuccess && !plans.isFetching ? plans.data.data : null;
  const historyPage = current && history.isSuccess && !history.isFetching ? history.data.data : null;
  const warehousePage = authorizedProject && warehouses.isSuccess && !warehouses.isFetching ? warehouses.data.data : null;
  const revisionPage = authorizedProject && revisions.isSuccess && !revisions.isFetching ? revisions.data.data : null;

  const mutation = useMutation({
    mutationFn: (intent: Intent) => {
      switch (intent.kind) {
        case 'CREATE': return api.create(intent.body);
        case 'REVISE': return api.revise(intent.id, intent.body);
        case 'SUBMIT': return api.submit(intent.id, intent.body);
        case 'DECIDE': return api.decide(intent.id, intent.body);
      }
    },
    onSuccess: async result => {
      setPending(null);
      setSaved(true);
      setPlanId(result.data.id);
      setHistoryPages(['']);
      setMode('CREATE');
      await cache.invalidateQueries({ queryKey: ['material-plan-ui'] });
    },
  });
  const dispatch = (intent: Intent) => {
    if (pending || mutation.isPending) return;
    setPending(intent);
    setSaved(false);
    mutation.mutate(intent);
  };
  const refresh = async () => {
    setSaved(false);
    await cache.invalidateQueries({ queryKey: ['material-plan-ui'] });
  };
  const resetProject = (id: string) => {
    setProjectId(id); setPlanId(''); setListPages(['']); setHistoryPages(['']);
    setChoicePages({}); setMode('CREATE'); setBasisId(''); setWarehouseId('');
    setPackageCode(''); setLines([]); setReason(''); setComment('');
  };
  const fillRevision = (p: MaterialPlan) => {
    if (!p.latestRevision || !can('revise')) return;
    setMode('REVISE');
    setWarehouseId(p.warehouseId); setBasisId(p.budgetRevisionId);
    setPackageCode(p.workPackageCode);
    setValidFrom(p.latestRevision.validFrom);
    setValidTo(p.latestRevision.validTo);
    setReason('');
    setLines(p.latestRevision.lines.map(l => ({
      budgetRevisionLineId: l.budgetRevisionLineId,
      materialId: l.materialId, uomId: l.uomId, quantity: l.quantity,
    })));
  };
  const contentValid = validFrom !== '' && validTo >= validFrom && reason.trim() !== '' &&
    lines.length > 0 && lines.every(l => Boolean(l.budgetRevisionLineId && l.materialId && l.uomId) && validQuantity(l.quantity)) &&
    new Set(lines.map(l => l.budgetRevisionLineId)).size === lines.length;
  const canSave = editing && authorizedProject && Boolean(warehousePage && revisionPage) &&
    sourceLines.isSuccess && !sourceLines.isFetching && materials.isSuccess && !materials.isFetching &&
    !pending && !mutation.isPending && contentValid &&
    Boolean(projectId && warehouseId && basisId && packageCode.trim()) &&
    (mode !== 'REVISE' || Boolean(current));
  const submitForm = () => {
    if (!canSave) return;
    const body: PlanContent = { validFrom, validTo, reason: reason.trim(), lines };
    if (mode === 'CREATE') dispatch({ kind: 'CREATE', body: {
      ...body, requestKey: crypto.randomUUID(), projectId, warehouseId,
      budgetRevisionId: basisId, workPackageCode: packageCode.trim(),
    } });
    else if (current) dispatch({ kind: 'REVISE', id: current.id, body: {
      ...body, requestKey: crypto.randomUUID(), expectedVersion: current.version,
    } });
  };
  const decide = (decision: 'APPROVE' | 'REJECT') => {
    if (!current || !selected || !comment.trim() || pending) return;
    dispatch({ kind: 'DECIDE', id: current.id, body: {
      requestKey: crypto.randomUUID(), expectedVersion: current.version,
      decision, comment: comment.trim(),
    } });
  };
  const setLine = (at: number, patch: Partial<PlanLineInput>) =>
    setLines(old => old.map((l, i) => i === at ? { ...l, ...patch } : l));
  if (!view) return <Alert severity="info">{t.noRights}</Alert>;

  const chooser = (
    kind: 'warehouses' | 'materials' | 'revisions' | 'source-lines',
    rows: PlanChoice[], next: string | null, isError: boolean,
  ) => <Stack direction="row" spacing={1} alignItems="center">
    <Button size="small" disabled={pagesFor(kind).length < 2 || Boolean(pending)}
      onClick={() => choosePage(kind, pagesFor(kind).slice(0, -1))}>{t.previous}</Button>
    <Button size="small" disabled={!next || Boolean(pending) || isError}
      onClick={() => next && choosePage(kind, [...pagesFor(kind), next])}>{t.next}</Button>
    {isError ? <Typography color="error" variant="caption">{t.error}</Typography> :
      <Typography variant="caption">{rows.length}</Typography>}
  </Stack>;

  return <Stack spacing={2}>
    <Typography variant="h6">{t.title}</Typography>
    <Alert severity="info">{t.description}</Alert>
    <Alert severity="info">{t.note}</Alert>
    {projects.isError ? <Alert severity="error">{t.error}</Alert> : null}
    <TextField select size="small" label={t.project} value={projectId} sx={{ maxWidth: 520 }}
      onChange={e => resetProject(e.target.value)} disabled={Boolean(pending)}>
      <MenuItem value="">{t.select}</MenuItem>
      {(projects.isSuccess && !projects.isFetching ? projects.data.data : []).map(p =>
        <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</MenuItem>)}
    </TextField>
    {pending ? <Alert severity="warning">{t.pending}<Stack direction="row" spacing={1}>
      <Button disabled={mutation.isPending} onClick={() => mutation.mutate(pending)}>{t.retry}</Button>
      <Button disabled={mutation.isPending} onClick={() => { setPending(null); mutation.reset(); void refresh(); }}>{t.clear}</Button>
    </Stack></Alert> : null}
    {mutation.isError ? <Alert severity="error">{t.error}</Alert> : null}
    {saved ? <Alert severity="success">{t.saved}</Alert> : null}
    {projectId ? <>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1">{t.plan}</Typography>
          {plans.isError ? <Alert severity="error">{t.error}</Alert> : null}
          <Stack direction="row" gap={1} flexWrap="wrap">
            {(plansPage?.items ?? []).map(p =>
              <Chip key={p.id} variant={planId === p.id ? 'filled' : 'outlined'}
                color={planId === p.id ? 'primary' : 'default'}
                label={p.workPackageCode + ' · v' + p.version}
                onClick={() => { setPlanId(p.id); setHistoryPages(['']); setMode('CREATE'); }} />)}
          </Stack>
          {plansPage && !plansPage.items.length ? <Alert severity="info">{t.empty}</Alert> : null}
          <Stack direction="row" spacing={1}>
            <Button disabled={listPages.length < 2} onClick={() => setListPages(x => x.slice(0, -1))}>{t.previous}</Button>
            <Button disabled={!plansPage?.nextCursor}
              onClick={() => plansPage?.nextCursor && setListPages(x => [...x, plansPage.nextCursor!])}>{t.next}</Button>
            <Button onClick={() => void refresh()}>{t.refresh}</Button>
          </Stack>
        </Stack>
      </Paper>
      {planId ? <Paper variant="outlined" sx={{ p: 2 }}>
        {detail.isError ? <Alert severity="error">{t.error}</Alert> : null}
        {current && selected ? <Stack spacing={1}>
          <Typography variant="subtitle1">{current.workPackageCode}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={t.version + ': ' + current.version} />
            <Chip label={t.status + ': ' + selected.status} />
          </Stack>
          <Typography variant="body2">{t.from}: {selected.validFrom} · {t.to}: {selected.validTo}</Typography>
          <Typography variant="body2">{t.reason}: {selected.reason}</Typography>
          <Typography variant="body2">{t.preparedBy}: {selected.createdByUserId}</Typography>
          <Typography variant="subtitle2">{t.lines}</Typography>
          {selected.lines.map(l => <Typography key={l.id} variant="body2">
            {l.material.materialCode} · {l.material.materialName} · {l.quantity} {l.uom.uomCode}
          </Typography>)}
          <Typography variant="subtitle2">{t.approved}</Typography>
          <Typography variant="body2">{current.approvedRevision ?
            '#' + current.approvedRevision.revisionNo : t.unapproved}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
            {can('revise') && selected.status !== 'SUBMITTED' ?
              <Button disabled={Boolean(pending)} onClick={() => fillRevision(current)}>{t.load}</Button> : null}
            {can('submit') && selected.status === 'DRAFT' ?
              <Button disabled={Boolean(pending)} onClick={() => dispatch({
                kind: 'SUBMIT', id: current.id,
                body: { requestKey: crypto.randomUUID(), expectedVersion: current.version },
              })}>{t.submit}</Button> : null}
          </Stack>
          {selected.status === 'SUBMITTED' && can('approve') ? <Stack spacing={1}>
            <Alert severity="info">{t.cannotApprove}</Alert>
            <TextField label={t.comment} value={comment} onChange={e => setComment(e.target.value)}
              disabled={Boolean(pending)} multiline minRows={2} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" disabled={!comment.trim() || Boolean(pending)}
                onClick={() => decide('APPROVE')}>{t.approve}</Button>
              <Button disabled={!comment.trim() || Boolean(pending)}
                onClick={() => decide('REJECT')}>{t.reject}</Button>
            </Stack>
          </Stack> : null}
          <Divider />
          <Typography variant="subtitle2">{t.history}</Typography>
          {history.isError ? <Alert severity="error">{t.error}</Alert> : null}
          {(historyPage?.items ?? []).map(row =>
            <Typography key={row.id} variant="body2">#{row.revisionNo} · {row.status} · {row.reason}</Typography>)}
          <Stack direction="row" spacing={1}>
            <Button disabled={historyPages.length < 2}
              onClick={() => setHistoryPages(x => x.slice(0, -1))}>{t.previous}</Button>
            <Button disabled={!historyPage?.nextCursor}
              onClick={() => historyPage?.nextCursor && setHistoryPages(x => [...x, historyPage.nextCursor!])}>{t.next}</Button>
          </Stack>
        </Stack> : <Typography variant="body2">{t.noSelection}</Typography>}
      </Paper> : null}
      {(can('create') || can('revise')) && editing ? <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1">{mode === 'REVISE' ? t.revise : t.create}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField select fullWidth label={t.warehouse} value={warehouseId} disabled={mode === 'REVISE' || Boolean(pending) || warehouses.isError}
              onChange={e => setWarehouseId(e.target.value)}>
              <MenuItem value="">{t.select}</MenuItem>
              {(warehousePage?.items ?? []).map(w =>
                <MenuItem key={w.id} value={w.id}>{w.warehouseCode} — {w.warehouseName}</MenuItem>)}
            </TextField>
            <TextField select fullWidth label={t.basis} value={basisId} disabled={mode === 'REVISE' || Boolean(pending) || revisions.isError}
              onChange={e => { setBasisId(e.target.value); setLines([]); }}>
              <MenuItem value="">{t.select}</MenuItem>
              {(revisionPage?.items ?? []).map(r =>
                <MenuItem key={r.id} value={r.id}>{r.revisionNumber ?? r.id}</MenuItem>)}
            </TextField>
          </Stack>
          {mode === 'CREATE' ? <Stack direction="row" spacing={1}>
            {chooser('warehouses', warehousePage?.items ?? [], warehousePage?.nextCursor ?? null, warehouses.isError)}
            {chooser('revisions', revisionPage?.items ?? [], revisionPage?.nextCursor ?? null, revisions.isError)}
          </Stack> : null}
          <TextField label={t.workPackage} value={packageCode} disabled={mode === 'REVISE' || Boolean(pending)}
            inputProps={{ maxLength: 80 }} onChange={e => setPackageCode(e.target.value)} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField fullWidth type="date" label={t.from} InputLabelProps={{ shrink: true }}
              value={validFrom} disabled={Boolean(pending)} onChange={e => setValidFrom(e.target.value)} />
            <TextField fullWidth type="date" label={t.to} InputLabelProps={{ shrink: true }}
              value={validTo} disabled={Boolean(pending)} onChange={e => setValidTo(e.target.value)} />
          </Stack>
          <TextField label={t.reason} value={reason} multiline minRows={2} disabled={Boolean(pending)}
            onChange={e => setReason(e.target.value)} />
          <Typography variant="subtitle2">{t.lines}</Typography>
          {basisId && sourceLines.isError ? <Alert severity="error">{t.error}</Alert> : null}
          {basisId && sourceLines.isSuccess && !sourceLines.isFetching && sourceRows.length === 0 ? <Alert severity="info">{t.noSource}</Alert> : null}
          {lines.map((line, index) => {
            const matchingMaterials = materialRows.filter(m => m.defaultUomId === line.uomId);
            return <Box key={index} sx={{ p: 1, border: 1, borderRadius: 1, borderColor: 'divider' }}>
              <Stack spacing={1}>
                <TextField select fullWidth size="small" label={t.source} value={line.budgetRevisionLineId}
                  disabled={!basisId || Boolean(pending) || sourceLines.isError}
                  onChange={e => {
                    const chosen = sourceRows.find(s => s.id === e.target.value);
                    setLine(index, { budgetRevisionLineId: e.target.value, uomId: chosen?.uomId ?? '', materialId: '' });
                  }}>
                  <MenuItem value="">{t.select}</MenuItem>
                  {sourceRows.map(s =>
                    <MenuItem key={s.id} value={s.id}>{s.itemCode} · {s.description} · {s.quantity} {s.uomCode}</MenuItem>)}
                  {line.budgetRevisionLineId && !sourceRows.some(s => s.id === line.budgetRevisionLineId) ?
                    <MenuItem value={line.budgetRevisionLineId}>{line.budgetRevisionLineId}</MenuItem> : null}
                </TextField>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField select fullWidth size="small" label={t.material} value={line.materialId}
                    disabled={!line.uomId || Boolean(pending) || materials.isError}
                    onChange={e => setLine(index, { materialId: e.target.value })}>
                    <MenuItem value="">{t.select}</MenuItem>
                    {line.materialId && !matchingMaterials.some(m => m.id === line.materialId) ?
                      <MenuItem value={line.materialId}>{line.materialId}</MenuItem> : null}
                    {matchingMaterials.map(m =>
                      <MenuItem key={m.id} value={m.id}>{m.materialCode} · {m.materialName}</MenuItem>)}
                  </TextField>
                  <TextField fullWidth size="small" label={t.quantity} value={line.quantity}
                    inputMode="decimal" disabled={Boolean(pending)}
                    onChange={e => setLine(index, { quantity: e.target.value })} />
                </Stack>
                <Button size="small" disabled={Boolean(pending)}
                  onClick={() => setLines(old => old.filter((_, i) => i !== index))}>{t.remove}</Button>
              </Stack>
            </Box>;
          })}
          {basisId ? <Stack direction="row" spacing={1}>
            <Button disabled={Boolean(pending) || lines.length >= 100}
              onClick={() => setLines(old => [...old, { budgetRevisionLineId: '', materialId: '', uomId: '', quantity: '' }])}>{t.addLine}</Button>
            {chooser('source-lines', sourceRows, sourceLines.isSuccess && !sourceLines.isFetching ? sourceLines.data.data.nextCursor : null, sourceLines.isError)}
            {chooser('materials', materialRows, materials.isSuccess && !materials.isFetching ? materials.data.data.nextCursor : null, materials.isError)}
          </Stack> : null}
          {!contentValid && lines.length > 0 ? <Alert severity="info">{t.invalid}</Alert> : null}
          <Button variant="contained" disabled={!canSave} onClick={submitForm}>
            {mode === 'REVISE' ? t.revise : t.create}
          </Button>
        </Stack>
      </Paper> : null}
    </> : null}
  </Stack>;
}
