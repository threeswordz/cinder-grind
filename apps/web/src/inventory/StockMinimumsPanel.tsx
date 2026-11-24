import {
  Alert, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { PortfolioWorkQueuePanel } from './PortfolioWorkQueuePanel';

type Data<T> = { data: T };
type Project = { id: string; projectCode: string; projectName: string };
type Site = { id: string; warehouseCode: string; warehouseName: string };
type Choice = { materialId: string; materialCode: string; materialName: string;
  uomId: string; uomCode: string; uomName: string };
type Policy = {
  materialId: string; uomId: string; materialCode: string; materialName: string; uomCode: string;
  minimumQuantity: string; status: 'ACTIVE' | 'PAUSED'; reason: string;
  lastEventId: string; onHand: string; reserved: string; available: string;
  belowMinimum: boolean; shortage: string; configurationStale: boolean;
};
type Readback = { alerts: Policy[]; advisoryOnly: boolean;
  approvedPlanDemandAlertsIncluded: boolean; externalNotificationsSent: boolean };
type PlanStartReminder = {
  planId: string; revisionId: string; revisionNo: number;
  workPackageCode: string; validFrom: string; validTo: string;
  lineId: string; materialId: string; materialCode: string;
  materialName: string; quantity: string; uomId: string; uomCode: string;
  sourceInactive: boolean; daysUntilStart: number;
  window: 'DUE_TODAY' | 'WITHIN_7_DAYS' | 'WITHIN_14_DAYS';
  quantityBasis: 'APPROVED_PLAN_ENTERED_UOM_ONLY';
};
type PlanStartReadback = { asOfThailandDate: string;
  alerts: PlanStartReminder[]; approvedPlanStartRemindersIncluded: true;
  dayByDayDemandScheduleIncluded: false;
  supplierDueOrLateIndicatorsIncluded: false;
  externalNotificationsSent: false; stockEffect: false; financeEffect: false };

type SupplierIndicator = {
  poId: string; poNumber: string; revisionNo: number; poLineId: string; lineNo: number;
  supplierCode: string; supplierName: string; supplierInactive: boolean;
  materialCode: string; materialName: string; uomCode: string;
  orderedQuantity: string; receivedQuantity: string;
  receivedAtSelectedSite: string; pendingQuantity: string;
  requiredOnSite: string | null; expectedDelivery: string | null;
  deliveryState: 'CANCELLED' | 'FULFILLED' | 'DATE_UNKNOWN' | 'LATE' |
    'DUE_TODAY' | 'WITHIN_7_DAYS' | 'WITHIN_14_DAYS' | 'LATER' |
    'SOURCE_REVIEW_REQUIRED';
  requiredOnSiteWindow: string; dateRevisedFromPreviousApproved: boolean;
  dateRemovedFromPreviousApproved: boolean;
  previousApprovedExpectedDelivery: string | null;
  supplierAcknowledgment: 'NOT_VERIFIED'; targetSite: 'NOT_RECORDED_ON_PO';
};
type SupplierReadback = {
  asOfThailandDate: string; alerts: SupplierIndicator[];
  advisoryOnly: true; projectWidePoDates: true;
  poLineSiteAssignmentIncluded: false; supplierAcknowledgmentsVerified: false;
  externalNotificationsSent: false; stockEffect: false; financeEffect: false;
};
const supplierState = (value: SupplierIndicator['deliveryState']) => ({
  CANCELLED: 'Cancelled — no current obligation',
  FULFILLED: 'Received in full',
  DATE_UNKNOWN: 'Expected date not supplied',
  LATE: 'Past expected date — delivery not complete',
  DUE_TODAY: 'Expected today',
  WITHIN_7_DAYS: 'Expected within 7 days',
  WITHIN_14_DAYS: 'Expected within 14 days',
  LATER: 'Expected later',
  SOURCE_REVIEW_REQUIRED: 'Inactive supplier — verify source',
})[value];

const base = '/inventory/stock-minimums';
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Minimum-stock request failed.';

export function StockMinimumsPanel({ roleCodes }: { roleCodes: string[] }) {
  const canConfigure = roleCodes.includes('PROJECT_MANAGER');
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [materialKey, setMaterialKey] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');
  const [reason, setReason] = useState('');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [planStarts, setPlanStarts] = useState<PlanStartReminder[]>([]);
  const [supplierIndicators, setSupplierIndicators] = useState<SupplierIndicator[]>([]);
  const [supplierAsOf, setSupplierAsOf] = useState('');
  const [asOfThailandDate, setAsOfThailandDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const siteBase = base + '/projects/' + projectId + '/sites/' + warehouseId;

  useEffect(() => {
    let active = true;
    apiRequest<Data<Project[]>>(base + '/projects')
      .then(r => { if (active) setProjects(r.data); })
      .catch(e => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setWarehouseId(''); setSites([]); setPolicies([]); setPlanStarts([]); setAsOfThailandDate(''); setSupplierIndicators([]); setSupplierAsOf(''); setChoices([]);
    setNextCursor(null); setMaterialKey('');
    if (!projectId) return;
    let active = true;
    apiRequest<Data<Site[]>>(base + '/projects/' + projectId + '/sites')
      .then(r => { if (active) setSites(r.data); })
      .catch(e => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [projectId]);

  const refresh = useCallback(async () => {
    if (!projectId || !warehouseId) return;
    setError('');
    try {
      const [readback, options, plan, suppliers] = await Promise.all([
        apiRequest<Data<Readback>>(siteBase),
        apiRequest<Data<{ items: Choice[]; nextCursor: string | null }>>(siteBase + '/choices'),
        apiRequest<Data<PlanStartReadback>>(siteBase + '/plan-starts'),
        apiRequest<Data<SupplierReadback>>(siteBase + '/supplier-indicators'),
      ]);
      setPolicies(readback.data.alerts);
      setPlanStarts(plan.data.alerts);
      setAsOfThailandDate(plan.data.asOfThailandDate);
      setSupplierIndicators(suppliers.data.alerts);
      setSupplierAsOf(suppliers.data.asOfThailandDate);
      setChoices(options.data.items);
      setNextCursor(options.data.nextCursor);
    } catch (caught) { setError(message(caught)); }
  }, [projectId, warehouseId, siteBase]);

  useEffect(() => {
    setPolicies([]); setPlanStarts([]); setAsOfThailandDate(''); setSupplierIndicators([]); setSupplierAsOf(''); setChoices([]); setNextCursor(null); setMaterialKey('');
    void refresh();
  }, [refresh]);

  const selectMaterial = (key: string) => {
    setMaterialKey(key);
    const [materialId, uomId] = key.split(':');
    const configured = policies.find(r => r.materialId === materialId && r.uomId === uomId);
    setMinimumQuantity(configured?.minimumQuantity ?? '');
    setReason(configured?.reason ?? '');
    setStatus(configured?.status ?? 'ACTIVE');
  };

  const addChoices = async () => {
    if (!nextCursor) return;
    try {
      const response = await apiRequest<Data<{ items: Choice[]; nextCursor: string | null }>>(
        siteBase + '/choices?after=' + encodeURIComponent(nextCursor));
      setChoices(before => [...before, ...response.data.items]);
      setNextCursor(response.data.nextCursor);
    } catch (caught) { setError(message(caught)); }
  };

  const save = async () => {
    const [materialId, uomId] = materialKey.split(':');
    if (!materialId || !uomId) return;
    const current = policies.find(r => r.materialId === materialId && r.uomId === uomId);
    setError(''); setSaving(true);
    try {
      await apiRequest(siteBase, {
        method: 'POST', body: JSON.stringify({
          materialId, uomId, minimumQuantity, status, reason,
          expectedPreviousEventId: current?.lastEventId ?? null,
        }),
      });
      await refresh();
    } catch (caught) { setError(message(caught)); }
    finally { setSaving(false); }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Material / Site minimum-stock alerts</Typography>
      {canConfigure && <PortfolioWorkQueuePanel selectProject={setProjectId} />}
      <Alert severity="info">
        Read-only stock warnings use available quantity (on hand minus active reservations).
        No stock, receiving or Finance posting occurs. Approved plan start dates now
        show 14-day and 7-day reminders. These are not exact daily material demand,
        supplier delivery commitments or external notifications. Approved PO-line
        delivery dates and posted GR quantities are shown separately below.
      </Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField select label="Authorized Project" value={projectId}
          onChange={e => setProjectId(e.target.value)} sx={{ minWidth: 240 }}>
          <MenuItem value="">Select Project</MenuItem>
          {projects.map(p => <MenuItem key={p.id} value={p.id}>
            {p.projectCode} — {p.projectName}
          </MenuItem>)}
        </TextField>
        <TextField select label="Site Warehouse" value={warehouseId}
          onChange={e => setWarehouseId(e.target.value)} sx={{ minWidth: 240 }}
          disabled={!projectId}>
          <MenuItem value="">Select Site</MenuItem>
          {sites.map(s => <MenuItem key={s.id} value={s.id}>
            {s.warehouseCode} — {s.warehouseName}
          </MenuItem>)}
        </TextField>
        <Button variant="outlined" disabled={!warehouseId} onClick={() => void refresh()}>Refresh</Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {canConfigure && warehouseId &&
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Khaimook / Project Manager: set material minimum</Typography>
            <TextField select label="Material / Stock UOM" value={materialKey}
              onChange={e => selectMaterial(e.target.value)}>
              <MenuItem value="">Select Material</MenuItem>
              {choices.map(c => <MenuItem key={c.materialId + ':' + c.uomId}
                value={c.materialId + ':' + c.uomId}>
                {c.materialCode} — {c.materialName} ({c.uomCode})
              </MenuItem>)}
            </TextField>
            {nextCursor && <Button onClick={() => void addChoices()}>Load more materials</Button>}
            <TextField label="Minimum available quantity" value={minimumQuantity}
              onChange={e => setMinimumQuantity(e.target.value)} inputProps={{ maxLength: 20 }}
              helperText="Use the selected stock UOM; 0–4 decimal places." />
            <TextField select label="Status" value={status}
              onChange={e => setStatus(e.target.value as 'ACTIVE' | 'PAUSED')}>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="PAUSED">Paused</MenuItem>
            </TextField>
            <TextField label="Reason / audit note" value={reason}
              onChange={e => setReason(e.target.value)} multiline minRows={2}
              inputProps={{ maxLength: 2000 }} />
            <Button variant="contained" disabled={!materialKey || !minimumQuantity || !reason.trim() || saving}
              onClick={() => void save()}>Save minimum (audited)</Button>
          </Stack>
        </Paper>}
      {warehouseId && <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1">
            Approved material-plan start reminders — 14 / 7 days
          </Typography>
          <Alert severity="info">
            Showing the start of each latest approved material-plan revision as of
            {asOfThailandDate ? ' ' + asOfThailandDate + ' (Thailand date)' : ' the current Thailand date'}.
            The quantities below are in the entered plan unit, not converted stock shortages.
            Supplier due/late dates and daily issue schedules are not available here.
          </Alert>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Work package / approved plan</TableCell>
                <TableCell>Material</TableCell>
                <TableCell align="right">Planned quantity (entered UOM)</TableCell>
                <TableCell>Window starts</TableCell>
                <TableCell>Reminder</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {planStarts.map(item => <TableRow key={item.lineId}>
                  <TableCell>{item.workPackageCode} (Rev {item.revisionNo})</TableCell>
                  <TableCell>{item.materialCode} — {item.materialName}</TableCell>
                  <TableCell align="right">{item.quantity} {item.uomCode}</TableCell>
                  <TableCell>{item.validFrom}</TableCell>
                  <TableCell>
                    {item.sourceInactive ? 'Inactive material/UOM — verify source' :
                      item.window === 'DUE_TODAY' ? 'Starts today' :
                      item.window === 'WITHIN_7_DAYS' ?
                        item.daysUntilStart + ' days — 7-day reminder' :
                        item.daysUntilStart + ' days — 14-day reminder'}
                  </TableCell>
                </TableRow>)}
                {planStarts.length === 0 && <TableRow><TableCell colSpan={5}>
                  No latest approved material-plan revision starts in the next 14 days
                  for this authorized Site.
                </TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>}

      {warehouseId && <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1">Supplier delivery indicators — approved PO lines</Typography>
          <Alert severity="info">
            Project-wide Purchase Order expected delivery dates as of {supplierAsOf || 'today'}
            {' '} (Thailand calendar). PO lines do not record a destination Site;
            only posted, unreversed Goods Receipts can be attributed to this selected Site.
            Received totals and outstanding quantities cover the authorized Project
            and all revisions of the same PO. Dates are not verified supplier promises,
            and approved PO date changes do not prove supplier rescheduling.
            No daily requirement, alerts to suppliers, Finance or stock posting is triggered.
          </Alert>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Approved PO / revision</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Material</TableCell>
                <TableCell align="right">Ordered</TableCell>
                <TableCell align="right">Posted received (selected Site)</TableCell>
                <TableCell align="right">Outstanding</TableCell>
                <TableCell>Required on Site</TableCell>
                <TableCell>PO expected delivery</TableCell>
                <TableCell>Advisory</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {supplierIndicators.map(item => <TableRow key={item.poLineId}>
                  <TableCell>{item.poNumber} (Rev {item.revisionNo}, line {item.lineNo})</TableCell>
                  <TableCell>{item.supplierCode} — {item.supplierName}</TableCell>
                  <TableCell>{item.materialCode} — {item.materialName}</TableCell>
                  <TableCell align="right">{item.orderedQuantity} {item.uomCode}</TableCell>
                  <TableCell align="right">{item.receivedQuantity}
                    {' '}({item.receivedAtSelectedSite}) {item.uomCode}</TableCell>
                  <TableCell align="right">{item.pendingQuantity} {item.uomCode}</TableCell>
                  <TableCell>{item.requiredOnSite ?? 'Unknown / not supplied'}</TableCell>
                  <TableCell>{item.expectedDelivery ?? 'Unknown / not supplied'}</TableCell>
                  <TableCell>
                    {supplierState(item.deliveryState)}
                    {item.dateRevisedFromPreviousApproved &&
                      ' — approved PO date revised from ' +
                      (item.previousApprovedExpectedDelivery ?? 'unknown') +
                      '; supplier acceptance unverified'}
                    {item.dateRemovedFromPreviousApproved &&
                      ' — expected date removed from approved PO (previously ' +
                      (item.previousApprovedExpectedDelivery ?? 'unknown') + ')'}
                  </TableCell>
                </TableRow>)}
                {supplierIndicators.length === 0 &&
                  <TableRow><TableCell colSpan={9}>
                    No approved material PO lines for this authorized Project.
                    Unapproved POs are not supplier commitments.
                  </TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>}

      {warehouseId && <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Material / UOM</TableCell><TableCell align="right">Minimum</TableCell>
            <TableCell align="right">Available</TableCell><TableCell align="right">Shortage</TableCell>
            <TableCell>Alert state</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {policies.map(p => <TableRow key={p.materialId + ':' + p.uomId}>
              <TableCell>{p.materialCode} — {p.materialName} ({p.uomCode})</TableCell>
              <TableCell align="right">{p.minimumQuantity}</TableCell>
              <TableCell align="right">{p.available}</TableCell>
              <TableCell align="right">{p.shortage}</TableCell>
              <TableCell>{p.status === 'PAUSED' ? 'Paused' :
                p.configurationStale ? 'Stock UOM changed — review minimum' :
                p.belowMinimum ? 'Below minimum' : 'Within minimum'}</TableCell>
            </TableRow>)}
            {policies.length === 0 && <TableRow><TableCell colSpan={5}>
              No minimum thresholds configured for this Site.
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>}
    </Stack>
  );
}
