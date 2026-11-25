import { Alert, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import { StockCountSchedulesPanel } from './StockCountSchedulesPanel';
import { StockLossCasesPanel } from './StockLossCasesPanel';
import { UrgentIssueDocumentsPanel } from './UrgentIssueDocumentsPanel';

type Lane = 'urgent' | 'schedule' | 'loss';

export function OperationalExceptionsPanel({
  permissions, roleCodes, userId,
}: { permissions: string[]; roleCodes: string[]; userId: string }) {
  const pm09 = permissions.includes('inventory.issue.view') &&
    permissions.includes('documents.document.view') &&
    roleCodes.some(role => role === 'STOREKEEPER' || role === 'PROJECT_MANAGER');
  const schedule = permissions.includes('inventory.stock_count.view') &&
    roleCodes.some(role => ['FINANCE_MANAGER','PROJECT_MANAGER','STOREKEEPER'].includes(role));
  const ss13 = permissions.includes('inventory.stock.view') &&
    permissions.includes('documents.document.view') &&
    roleCodes.some(role =>
      ['STOREKEEPER','PROJECT_MANAGER','MANAGEMENT','FINANCE_MANAGER'].includes(role));
  const first: Lane = pm09 ? 'urgent' : schedule ? 'schedule' : 'loss';
  const [selected, setSelected] = useState<Lane>(first);
  if (!pm09 && !schedule && !ss13)
    return <Alert severity="info">No operational exception workflow is permitted in this session.</Alert>;
  const current: Lane = selected === 'urgent' && pm09 ? 'urgent' :
    selected === 'schedule' && schedule ? 'schedule' :
      selected === 'loss' && ss13 ? 'loss' : first;
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Operational exceptions / evidence decisions</Typography>
      <Alert severity="info">
        These are controlled operational records. Their approvals do not bypass ordinary stock,
        budget, purchase or Finance posting rules.
      </Alert>
      <Tabs value={current} onChange={(_e, value: Lane) => setSelected(value)}>
        {pm09 ? <Tab value="urgent" label="Urgent issue documents" /> : null}
        {schedule ? <Tab value="schedule" label="Count schedules" /> : null}
        {ss13 ? <Tab value="loss" label="Loss / damage / waste" /> : null}
      </Tabs>
      {current === 'urgent' ? <UrgentIssueDocumentsPanel
        permissions={permissions} roleCodes={roleCodes} userId={userId} /> : null}
      {current === 'schedule' ? <StockCountSchedulesPanel
        permissions={permissions} roleCodes={roleCodes} /> : null}
      {current === 'loss' ? <StockLossCasesPanel
        permissions={permissions} roleCodes={roleCodes} userId={userId} /> : null}
    </Stack>
  );
}
