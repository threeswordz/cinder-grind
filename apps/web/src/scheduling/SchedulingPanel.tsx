import { Box, Tab, Tabs } from '@mui/material';
import { useState } from 'react';

import { ActivitiesPanel } from './ActivitiesPanel';
import { BaselinesProgressPanel } from './BaselinesProgressPanel';
import { ActivityTypesPanel } from './ActivityTypesPanel';
import { CalendarsPanel } from './CalendarsPanel';

export function SchedulingPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const canProgramme = permissions.includes('schedule.programme.view');
  const canCalendars = permissions.includes('schedule.calendar.manage');
  const canTypes = permissions.includes('admin.activity_types.manage');
  const canBaselineProgress = permissions.includes('schedule.programme.view');

  const available = [
    ...(canProgramme ? [{ key: 'activities', label: 'Activities' }] : []),
    ...(canBaselineProgress ? [{ key: 'baseline-progress', label: 'Baselines & Progress' }] : []),
    ...(canCalendars ? [{ key: 'calendars', label: 'Working Calendars' }] : []),
    ...(canTypes ? [{ key: 'types', label: 'Activity Types' }] : []),
  ];

  const [selected, setSelected] = useState(available[0]?.key ?? 'activities');
  const active = available.some((tab) => tab.key === selected)
    ? selected
    : available[0]?.key;

  return (
    <>
      {available.length > 1 ? (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={active}
            onChange={(_event, value: string) => setSelected(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {available.map((tab) => (
              <Tab key={tab.key} value={tab.key} label={tab.label} />
            ))}
          </Tabs>
        </Box>
      ) : null}
      {active === 'activities' ? (
        <ActivitiesPanel permissions={permissions} />
      ) : null}
      {active === 'baseline-progress' ? (
        <BaselinesProgressPanel permissions={permissions} />
      ) : null}
      {active === 'calendars' ? (
        <CalendarsPanel canManage={canCalendars} />
      ) : null}
      {active === 'types' ? <ActivityTypesPanel canManage={canTypes} /> : null}
    </>
  );
}
