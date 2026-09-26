import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Gantt, { GanttTask } from 'frappe-gantt';
import 'frappe-gantt/dist/frappe-gantt.css';

import {
  SchedulePresentationRecord,
  schedulingApi,
} from '../api/scheduling';

type Scope = 'gantt' | 'lookahead14' | 'lookahead28';
type ViewMode = 'Day' | 'Week' | 'Month';
type Activity = SchedulePresentationRecord['activities'][number];

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '—';
}

function statusLabel(activity: Activity) {
  if (activity.delayStatus === 'UNAVAILABLE') return 'No baseline';
  if (activity.delayStatus === 'ON_TIME') return 'On time';
  if (activity.delayStatus === 'AHEAD') return 'Ahead';
  return 'Delayed';
}

function taskClass(activity: Activity) {
  if (activity.isMilestone) return 'erp-milestone';
  if (activity.isCritical && activity.delayStatus === 'DELAYED') {
    return 'erp-critical-delayed';
  }
  if (activity.isCritical) return 'erp-critical';
  if (activity.delayStatus === 'DELAYED') return 'erp-delayed';
  return '';
}

export function GanttLookaheadPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [projectId, setProjectId] = useState('');
  const [scope, setScope] = useState<Scope>('gantt');
  const [viewMode, setViewMode] = useState<ViewMode>('Week');
  const [asOf, setAsOf] = useState(localDateValue());
  const [selectedActivityId, setSelectedActivityId] = useState('');

  const projects = useQuery({
    queryKey: ['schedule', 'projects'],
    queryFn: schedulingApi.projects,
  });

  const presentation = useQuery({
    queryKey: ['schedule', 'stage-d', projectId, scope, asOf],
    queryFn: () => {
      if (scope === 'lookahead14') {
        return schedulingApi.lookahead(projectId, asOf, 14);
      }
      if (scope === 'lookahead28') {
        return schedulingApi.lookahead(projectId, asOf, 28);
      }
      return schedulingApi.gantt(projectId);
    },
    enabled: Boolean(projectId),
  });

  const activities = presentation.data?.data.activities ?? [];
  const scheduledActivities = useMemo(
    () =>
      activities.filter(
        (activity) =>
          Boolean(activity.forecastStartDate) &&
          Boolean(activity.forecastFinishDate),
      ),
    [activities],
  );

  const tasks = useMemo<GanttTask[]>(
    () =>
      scheduledActivities.map((activity) => ({
        id: activity.activityId,
        name:
          (activity.isMilestone ? '◆ ' : '') +
          activity.activityCode +
          ' — ' +
          activity.activityName,
        start: activity.forecastStartDate!.slice(0, 10),
        end: activity.forecastFinishDate!.slice(0, 10),
        progress: activity.currentPercentComplete ?? 0,
        dependencies: activity.predecessorActivityIds.join(','),
        custom_class: taskClass(activity),
      })),
    [scheduledActivities],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    if (!tasks.length) return;

    new Gantt(container, tasks, {
      view_mode: viewMode,
      readonly: true,
      readonly_dates: true,
      readonly_progress: true,
      move_dependencies: false,
      view_mode_select: false,
      scroll_to: scope === 'gantt' ? 'today' : asOf,
      popup: () => false,
      on_click: (task) => setSelectedActivityId(task.id),
    });

    return () => {
      container.innerHTML = '';
    };
  }, [asOf, scope, tasks, viewMode]);

  useEffect(() => {
    if (
      selectedActivityId &&
      !activities.some(
        (activity) => activity.activityId === selectedActivityId,
      )
    ) {
      setSelectedActivityId('');
    }
  }, [activities, selectedActivityId]);

  const selectedActivity =
    activities.find(
      (activity) => activity.activityId === selectedActivityId,
    ) ?? null;

  const currentBaseline = presentation.data?.data.currentBaseline ?? null;
  const window = presentation.data?.data.window;
  const missingScheduleCount = activities.length - scheduledActivities.length;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Gantt & Lookahead</Typography>

      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          setSelectedActivityId('');
        }}
        fullWidth
      >
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} — {project.projectName}
          </MenuItem>
        ))}
      </TextField>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button
          variant={scope === 'gantt' ? 'contained' : 'outlined'}
          onClick={() => setScope('gantt')}
        >
          Master Gantt
        </Button>
        <Button
          variant={scope === 'lookahead14' ? 'contained' : 'outlined'}
          onClick={() => setScope('lookahead14')}
        >
          2-Week Lookahead
        </Button>
        <Button
          variant={scope === 'lookahead28' ? 'contained' : 'outlined'}
          onClick={() => setScope('lookahead28')}
        >
          4-Week Lookahead
        </Button>
      </Stack>

      {scope !== 'gantt' ? (
        <TextField
          label="As of"
          type="date"
          value={asOf}
          onChange={(event) => setAsOf(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ maxWidth: 260 }}
        />
      ) : null}

      {projectId ? (
        <>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {(['Day', 'Week', 'Month'] as const).map((mode) => (
              <Button
                key={mode}
                size="small"
                variant={viewMode === mode ? 'contained' : 'outlined'}
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </Button>
            ))}
            {currentBaseline ? (
              <Chip
                label={'Current approved baseline v' + currentBaseline.versionNo}
                variant="outlined"
              />
            ) : (
              <Chip label="No approved baseline" variant="outlined" />
            )}
            {window ? (
              <Chip
                label={
                  window.days +
                  '-day window: ' +
                  window.asOfDate +
                  ' to ' +
                  window.endDate
                }
                variant="outlined"
              />
            ) : null}
          </Stack>

          {presentation.isError ? (
            <Alert severity="error">
              Unable to load the schedule presentation.
            </Alert>
          ) : null}

          {!currentBaseline && presentation.data ? (
            <Alert severity="info">
              Baseline comparison is unavailable until a Schedule Baseline is
              approved. Current forecast and critical-path presentation remain
              available.
            </Alert>
          ) : null}

          {missingScheduleCount > 0 ? (
            <Alert severity="warning">
              {missingScheduleCount} Activity
              {missingScheduleCount === 1 ? '' : 'ies'} cannot be drawn because
              a current forecast start or finish is unavailable.
            </Alert>
          ) : null}

          <Card variant="outlined">
            <CardContent>
              <Box
                ref={containerRef}
                sx={{
                  minHeight: tasks.length ? 260 : 80,
                  overflowX: 'auto',
                  '& .gantt-container': { minWidth: 700 },
                  '& .erp-critical .bar, & .erp-critical-delayed .bar': {
                    strokeWidth: 2,
                  },
                  '& .erp-delayed .bar, & .erp-critical-delayed .bar': {
                    opacity: 0.78,
                  },
                  '& .erp-milestone .bar': { strokeWidth: 2 },
                }}
              />
              {!presentation.isLoading && !tasks.length ? (
                <Typography color="text.secondary">
                  No Activities fall within this view.
                </Typography>
              ) : null}
            </CardContent>
          </Card>

          {selectedActivity ? (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="subtitle1">
                    {selectedActivity.activityCode} —{' '}
                    {selectedActivity.activityName}
                  </Typography>
                  <Typography variant="body2">
                    WBS: {selectedActivity.wbs.wbsCode} —{' '}
                    {selectedActivity.wbs.wbsName}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      size="small"
                      label={
                        'Progress ' +
                        (selectedActivity.currentPercentComplete ?? 0) +
                        '%'
                      }
                    />
                    <Chip
                      size="small"
                      label={statusLabel(selectedActivity)}
                    />
                    {selectedActivity.isMilestone ? (
                      <Chip size="small" label="Milestone" />
                    ) : null}
                    {selectedActivity.isCritical ? (
                      <Chip size="small" label="Critical" />
                    ) : null}
                    {selectedActivity.activityStatus ? (
                      <Chip
                        size="small"
                        label={selectedActivity.activityStatus.statusLabel}
                      />
                    ) : null}
                    <Chip
                      size="small"
                      label={
                        'Total float ' +
                        (selectedActivity.totalFloatWorkDays ?? '—')
                      }
                    />
                  </Stack>
                  <Typography variant="body2">
                    Planned duration: {selectedActivity.plannedDurationWorkDays}{' '}
                    working day
                    {selectedActivity.plannedDurationWorkDays === 1 ? '' : 's'}
                  </Typography>
                  <Typography variant="body2">
                    Current forecast: {dateValue(selectedActivity.forecastStartDate)}
                    {' → '}
                    {dateValue(selectedActivity.forecastFinishDate)}
                  </Typography>
                  <Typography variant="body2">
                    Approved baseline: {dateValue(selectedActivity.baselineStartDate)}
                    {' → '}
                    {dateValue(selectedActivity.baselineFinishDate)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          <Card variant="outlined">
            <CardContent sx={{ overflowX: 'auto' }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Baseline / Current Reference
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Activity</TableCell>
                    <TableCell>WBS</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Activity status</TableCell>
                    <TableCell>Baseline</TableCell>
                    <TableCell>Current forecast</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Schedule status</TableCell>
                    <TableCell>Float</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow
                      key={activity.activityId}
                      hover
                      selected={activity.activityId === selectedActivityId}
                      onClick={() =>
                        setSelectedActivityId(activity.activityId)
                      }
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        {activity.activityCode} — {activity.activityName}
                        {activity.isCritical ? ' • Critical' : ''}
                      </TableCell>
                      <TableCell>{activity.wbs.wbsCode}</TableCell>
                      <TableCell>
                        {activity.isMilestone
                          ? 'Milestone'
                          : activity.isSummary
                            ? 'Summary'
                            : 'Activity'}
                      </TableCell>
                      <TableCell>
                        {activity.plannedDurationWorkDays} work day
                        {activity.plannedDurationWorkDays === 1 ? '' : 's'}
                      </TableCell>
                      <TableCell>
                        {activity.activityStatus?.statusLabel ?? '—'}
                      </TableCell>
                      <TableCell>
                        {dateValue(activity.baselineStartDate)}
                        {' → '}
                        {dateValue(activity.baselineFinishDate)}
                      </TableCell>
                      <TableCell>
                        {dateValue(activity.forecastStartDate)}
                        {' → '}
                        {dateValue(activity.forecastFinishDate)}
                      </TableCell>
                      <TableCell>
                        {activity.currentPercentComplete ?? 0}%
                      </TableCell>
                      <TableCell>{statusLabel(activity)}</TableCell>
                      <TableCell>
                        {activity.totalFloatWorkDays ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Alert severity="info">Select a Project to view its schedule.</Alert>
      )}
    </Stack>
  );
}
