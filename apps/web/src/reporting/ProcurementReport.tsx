import { useMemo, useState } from 'react';
import {
  Alert,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { reportingApi } from '../api/reporting';

function date(value: string | null) {
  return value ?? '—';
}

export function ProcurementReport() {
  const [projectId, setProjectId] = useState('');
  const [risk, setRisk] = useState('ALL');
  const [search, setSearch] = useState('');

  const projects = useQuery({
    queryKey: ['reporting', 'projects'],
    queryFn: reportingApi.projects,
  });
  const report = useQuery({
    queryKey: ['reporting', 'procurement', projectId],
    queryFn: () => reportingApi.procurement(projectId),
    enabled: Boolean(projectId),
  });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (report.data?.data.lines ?? []).filter((line) => {
      if (risk !== 'ALL' && line.scheduleRisk !== risk) return false;
      if (!needle) return true;
      return [
        line.pr.prNumber,
        line.materialCode ?? '',
        line.description,
        ...line.rfqs.map((item) => item.rfqNumber),
        ...line.purchaseOrders.map((item) => item.poNumber),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [report.data, risk, search]);

  const data = report.data?.data;

  return (
    <Stack spacing={3}>
      <BoxHeader />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <TextField
          select
          label="Project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          sx={{ flexGrow: 1 }}
        >
          <MenuItem value="">Select Project</MenuItem>
          {(projects.data?.data ?? []).map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.projectCode} · {project.projectName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Risk"
          value={risk}
          onChange={(event) => setRisk(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">All</MenuItem>
          <MenuItem value="AT_RISK">At risk</MenuItem>
          <MenuItem value="ON_TIME">On time</MenuItem>
          <MenuItem value="UNAVAILABLE">Unavailable</MenuItem>
        </TextField>
        <TextField
          label="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="PR / RFQ / PO / material"
          sx={{ minWidth: 240 }}
        />
      </Stack>

      {report.isError ? (
        <Alert severity="error">Unable to load procurement reporting.</Alert>
      ) : null}
      {!projectId ? (
        <Alert severity="info">
          Select a Project to view procurement status, dates, risk and traceability.
        </Alert>
      ) : null}

      {data ? (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={'Lines ' + data.summary.total} variant="outlined" />
                <Chip label={'At Risk ' + data.summary.AT_RISK} variant="outlined" />
                <Chip label={'On Time ' + data.summary.ON_TIME} variant="outlined" />
                <Chip label={'No Date ' + data.summary.UNAVAILABLE} variant="outlined" />
                <Chip label={'RFQ ' + data.summary.rfq} variant="outlined" />
                <Chip label={'Awarded ' + data.summary.awarded} variant="outlined" />
                <Chip label={'PO ' + data.summary.purchaseOrder} variant="outlined" />
              </Stack>
            </CardContent>
          </Card>

          {rows.length === 0 ? (
            <Alert severity="info">No procurement lines match the filters.</Alert>
          ) : null}
          {rows.map((line) => (
            <Card key={line.id} variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                  >
                    <Typography fontWeight={600}>
                      {line.pr.prNumber} · Line {line.pr.lineNo} ·{' '}
                      {line.materialCode ?? line.description}
                    </Typography>
                    <Chip size="small" label={line.scheduleRisk} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {line.description} · Qty {line.quantity} {line.uom.uomCode}
                  </Typography>
                  <Typography variant="body2">
                    Required on Site {date(line.requiredOnSite)} · Expected Delivery{' '}
                    {date(line.expectedDelivery)} · PR {line.pr.lifecycleState}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    WBS {line.context.wbs?.wbsCode ?? '—'} · Cost Code{' '}
                    {line.context.costCode?.costCode ?? '—'} · Activity{' '}
                    {line.context.activity?.activityCode ?? '—'}
                  </Typography>
                  <Typography variant="subtitle2">Forward trace</Typography>
                  {line.rfqs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No RFQ yet.
                    </Typography>
                  ) : (
                    line.rfqs.map((rfq) => (
                      <Typography key={rfq.rfqLineId} variant="body2">
                        {rfq.rfqNumber} · {rfq.quotationCount} quotation(s) ·{' '}
                        {rfq.award
                          ? 'Awarded to ' + rfq.award.supplierNameSnapshot
                          : 'Not awarded'}
                      </Typography>
                    ))
                  )}
                  {line.purchaseOrders.map((po) => (
                    <Typography key={po.id} variant="body2">
                      {po.poNumber} · Rev {po.revisionNo} · {po.lifecycleState} ·{' '}
                      {po.supplier.supplierName} · Delivery {date(po.expectedDelivery)}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </>
      ) : null}
    </Stack>
  );
}

function BoxHeader() {
  return (
    <div>
      <Typography variant="h5">Procurement Schedule & Risk</Typography>
      <Typography color="text.secondary">
        Source-derived PR → RFQ → quotation → award → PO visibility. Risk is
        informational and never changes Scheduling dates.
      </Typography>
    </div>
  );
}
