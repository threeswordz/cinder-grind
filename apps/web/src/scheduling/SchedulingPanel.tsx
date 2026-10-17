import { Box, Tab, Tabs } from '@mui/material';
import { useEffect, useState } from 'react';

import type { SourceLinkTarget } from '../role-ui/source-link-policy';
import { ActivitiesPanel } from './ActivitiesPanel';
import { BaselinesProgressPanel } from './BaselinesProgressPanel';
import { ActivityTypesPanel } from './ActivityTypesPanel';
import { CalendarsPanel } from './CalendarsPanel';
import { GanttLookaheadPanel } from './GanttLookaheadPanel';

export function SchedulingPanel({
  permissions,
  initialProjectId,
  initialActivityId,
  initialWbsId,
  onOpenSource,
}: {
  permissions: string[];
  initialProjectId?: string | undefined;
  initialActivityId?: string | undefined;
  initialWbsId?: string | undefined;
  onOpenSource?: ((target: SourceLinkTarget) => void) | undefined;
}) {
  const canProgramme = permissions.includes('schedule.programme.view');
  const canCalendars = permissions.includes('schedule.calendar.manage');
  const canTypes = permissions.includes('admin.activity_types.manage');
  const canBaselineProgress = permissions.includes('schedule.programme.view');

  const available = [
    ...(canProgramme
      ? [
          { key: 'gantt-lookahead', label: 'Gantt & Lookahead' },
          { key: 'activities', label: 'Activities' },
        ]
      : []),
    ...(canBaselineProgress
      ? [{ key: 'baseline-progress', label: 'Baselines & Progress' }]
      : []),
    ...(canCalendars
      ? [{ key: 'calendars', label: 'Working Calendars' }]
      : []),
    ...(canTypes ? [{ key: 'types', label: 'Activity Types' }] : []),
  ];

  const [selected, setSelected] = useState(available[0]?.key ?? 'activities');

  useEffect(() => {
    if ((initialProjectId || initialActivityId || initialWbsId) && canProgramme) {
      setSelected('activities');
    }
  }, [canProgramme, initialActivityId, initialProjectId, initialWbsId]);

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
      {active === 'gantt-lookahead' ? <GanttLookaheadPanel /> : null}
      {active === 'activities' ? (
        <ActivitiesPanel
          permissions={permissions}
          initialProjectId={initialProjectId}
          initialActivityId={initialActivityId}
          initialWbsId={initialWbsId}
          onOpenSource={onOpenSource}
        />
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
