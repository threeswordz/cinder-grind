import {
  Alert, Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { inventoryApi } from '../api/inventory';
import { operationalExceptionsApi, type CountScheduleInput } from '../api/operational-exceptions';

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
function message(error: unknown) {
  return error instanceof Error ? error.message : 'The schedule could not be read or updated.';
}
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const result = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(result.getTime()) && result.toISOString().slice(0, 10) === value;
};

export function StockCountSchedulesPanel({
  permissions, roleCodes,
}: { permissions: string[]; roleCodes: string[] }) {
  const client = useQueryClient();
  const view = permissions.includes('inventory.stock_count.view') &&
    roleCodes.some(role => ['FINANCE_MANAGER','PROJECT_MANAGER','STOREKEEPER'].includes(role));
  const nancy = view && roleCodes.includes('FINANCE_MANAGER');
  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [asOfDate, setAsOfDate] = useState(today);
  const [category, setCategory] = useState('');
  const [uncategorized, setUncategorized] = useState(false);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [interval, setInterval] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');
  const [reason, setReason] = useState('');
  // Pin the exact event the editor originally loaded. A background refresh
  // must NEVER silently upgrade Nancy's compare-and-set expectation.
  const [expectedEventId, setExpectedEventId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const resetDraft = () => {
    setCategory(''); setUncategorized(false); setFirstDueDate('');
    setInterval(''); setStatus('ACTIVE'); setReason(''); setExpectedEventId(null);
  };
  const projects = useQuery({
    queryKey: ['m4-count-schedule-projects'],
    queryFn: inventoryApi.stockCountProjects,
    enabled: view, retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const authorizedProject = view && projects.isSuccess && !projects.isFetching &&
    projects.data.data.some(p => p.id === projectId);
  const sites = useQuery({
    queryKey: ['m4-count-schedule-sites', projectId],
    queryFn: () => inventoryApi.stockCountWarehouses(projectId),
    enabled: authorizedProject, retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const authorizedSite = authorizedProject && sites.isSuccess && !sites.isFetching &&
    sites.data.data.some(site => site.id === warehouseId);
  const schedules = useQuery({
    queryKey: ['m4-count-schedule', projectId, warehouseId, asOfDate],
    queryFn: () => operationalExceptionsApi.scheduleRead(projectId, warehouseId, asOfDate),
    enabled: authorizedSite && validDate(asOfDate), retry: false, gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const active = authorizedSite && schedules.isSuccess && !schedules.isFetching ?
    schedules.data.data : null;
  const chosenCategory = uncategorized ? null : category.trim();
  const prior = active?.schedules.find(s => s.materialCategory === chosenCategory) ?? null;
  // Covers both stale edits and another user creating the same category while
  // this form was open. Only an explicit reselect reloads the expected ID.
  const staleDraft = Boolean(active) && expectedEventId !== (prior?.lastEventId ?? null);
  const ready = nancy && Boolean(active) && !staleDraft && Boolean(firstDueDate) &&
    validDate(firstDueDate) && Boolean(reason.trim()) && reason.trim().length <= 2000 &&
    (uncategorized || Boolean(chosenCategory && chosenCategory.length <= 150)) &&
    /^\d+$/.test(interval) && Number(interval) >= 1 && Number(interval) <= 3650;
  const update = useMutation({
    mutationFn: (value: CountScheduleInput) =>
      operationalExceptionsApi.scheduleSet(projectId, warehouseId, value),
    onSuccess: async () => {
      setFeedback('Saved a new immutable site/category scheduling revision.');
      resetDraft();
      await client.invalidateQueries({ queryKey: ['m4-count-schedule', projectId, warehouseId] });
    },
    onError: (error: unknown) => setFeedback(message(error)),
  });
  if (!view) return <Alert severity="info">Stock-count schedule viewing requires the active site or Finance role and permission.</Alert>;
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Physical count scheduling — Nancy / sites</Typography>
      <Alert severity="info">
        Schedules are explicit calendar frequencies by active site and Material category.
        This does not record a physical count, approve an adjustment or authorize a financial write-off.
      </Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <TextField select label="Project" value={projectId} sx={{ minWidth: 230 }}
          onChange={e => { setProjectId(e.target.value); setWarehouseId(''); resetDraft(); setFeedback(''); }}>
          <MenuItem value="">Choose Project</MenuItem>
          {(projects.isSuccess && !projects.isFetching ? projects.data.data : []).map(p => (
            <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</MenuItem>
          ))}
        </TextField>
        <TextField select label="Site Warehouse" value={warehouseId}
          disabled={!authorizedProject} sx={{ minWidth: 230 }}
          onChange={e => { setWarehouseId(e.target.value); resetDraft(); setFeedback(''); }}>
          <MenuItem value="">Choose site</MenuItem>
          {(sites.isSuccess && !sites.isFetching ? sites.data.data : []).map(s => (
            <MenuItem key={s.id} value={s.id}>{s.warehouseCode} — {s.warehouseName}</MenuItem>
          ))}
        </TextField>
        <TextField label="As-of calendar date" type="date" value={asOfDate}
          onChange={e => setAsOfDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="outlined" disabled={!authorizedSite || schedules.isFetching}
          onClick={() => void schedules.refetch()}>Refresh</Button>
      </Stack>
      {projects.error || sites.error || schedules.error ?
        <Alert severity="error">{message(projects.error ?? sites.error ?? schedules.error)}</Alert> : null}
      {active ? (
        <TableContainer component={Paper}><Table size="small">
          <TableHead><TableRow>
            <TableCell>Material category</TableCell><TableCell>First due</TableCell>
            <TableCell>Repeat (days)</TableCell><TableCell>Next date</TableCell>
            <TableCell>Status</TableCell><TableCell>Revision</TableCell>
          </TableRow></TableHead>
          <TableBody>{active.schedules.map(row => <TableRow key={row.lastEventId}>
            <TableCell>{row.materialCategory ?? 'Unclassified materials'}</TableCell>
            <TableCell>{row.firstDueDate}</TableCell><TableCell>{row.intervalDays}</TableCell>
            <TableCell>{row.nextDueDate ?? 'Paused'}</TableCell>
            <TableCell><Chip size="small" label={row.status} /></TableCell>
            <TableCell>{row.version}</TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>
      ) : null}
      {nancy && active ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Set or revise a category schedule</Typography>
            <Alert severity="info">
              Use the exact Material master category, not an arbitrary label. Leave category empty only
              when selecting the unclassified-materials option. Select an existing row to revise it.
              Saving requires the current revision; a concurrent edit is rejected.
            </Alert>
            {staleDraft ? <Alert severity="warning">
              Another session changed or created this category, or the category selection changed.
              Your draft retains its original revision and cannot be saved against the new one.
              Explicitly choose the current schedule again to reload its latest values.
            </Alert> : null}
            <TextField select label="Existing category to revise (optional)"
              value={active.schedules.some(row => row.lastEventId === expectedEventId) ?
                (expectedEventId ?? '') : ''}
              onChange={e => {
                const row = active.schedules.find(s => s.lastEventId === e.target.value);
                if (row) {
                  setUncategorized(row.materialCategory === null); setCategory(row.materialCategory ?? '');
                  setFirstDueDate(row.firstDueDate); setInterval(String(row.intervalDays));
                  setStatus(row.status); setReason(''); setExpectedEventId(row.lastEventId);
                } else resetDraft();
              }}>
              <MenuItem value="">New category schedule</MenuItem>
              {active.schedules.map(row => <MenuItem key={row.lastEventId} value={row.lastEventId}>
                {row.materialCategory ?? 'Unclassified materials'} — revision {row.version}
              </MenuItem>)}
            </TextField>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Material category (exact)" value={category}
                disabled={uncategorized} onChange={e => {
                  if (e.target.value !== category) setExpectedEventId(null);
                  setCategory(e.target.value);
                }}
                inputProps={{ maxLength: 150 }} sx={{ flexGrow: 1 }} />
              <TextField select label="Category type" value={uncategorized ? 'none' : 'named'}
                onChange={e => {
                  const next = e.target.value === 'none';
                  if (next !== uncategorized) setExpectedEventId(null);
                  setUncategorized(next);
                }}>
                <MenuItem value="named">Named category</MenuItem>
                <MenuItem value="none">Unclassified materials only</MenuItem>
              </TextField>
              <TextField type="date" label="First due date" value={firstDueDate}
                onChange={e => setFirstDueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField label="Repeat every (days)" value={interval} type="number"
                inputProps={{ min: 1, max: 3650, step: 1 }}
                onChange={e => setInterval(e.target.value)} />
            </Stack>
            <TextField select label="Schedule state" value={status}
              onChange={e => setStatus(e.target.value as 'ACTIVE' | 'PAUSED')}>
              <MenuItem value="ACTIVE">Active</MenuItem><MenuItem value="PAUSED">Paused</MenuItem>
            </TextField>
            <TextField label="Nancy's reason" value={reason} multiline minRows={2}
              onChange={e => setReason(e.target.value)} inputProps={{ maxLength: 2000 }} />
            <Button variant="contained" disabled={!ready || update.isPending || schedules.isFetching}
              onClick={() => {
                setFeedback('');
                update.mutate({
                  materialCategory: chosenCategory,
                  firstDueDate, intervalDays: Number(interval), status, reason: reason.trim(),
                  expectedPreviousEventId: expectedEventId,
                });
              }}>Save category schedule</Button>
          </Stack>
        </Paper>
      ) : null}
      {feedback ? <Alert severity={update.isError ? 'error' : 'success'}>{feedback}</Alert> : null}
    </Stack>
  );
}
