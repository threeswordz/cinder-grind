import {
  Alert,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { reportingApi } from '../api/reporting';

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function dateKey(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '—';
}

export function ProjectEngineerDashboard() {
  const [projectId, setProjectId] = useState('');
  const [asOf, setAsOf] = useState(localDateValue());
  const [days, setDays] = useState<14 | 28>(14);

  const projects = useQuery({
    queryKey: ['reporting', 'projects'],
    queryFn: reportingApi.projects,
  });
  const dashboard = useQuery({
    queryKey: ['reporting', 'project-engineer', projectId, asOf, days],
    queryFn: () => reportingApi.projectEngineer(projectId, asOf, days),
    enabled: Boolean(projectId && asOf),
  });

  const data = dashboard.data?.data;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Project Engineer Dashboard</Typography>
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
          label="As of"
          type="date"
          value={asOf}
          onChange={(event) => setAsOf(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select
          label="Lookahead"
          value={days}
          onChange={(event) =>
            setDays(Number(event.target.value) as 14 | 28)
          }
          sx={{ minWidth: 160 }}
        >
          <MenuItem value={14}>2 weeks</MenuItem>
          <MenuItem value={28}>4 weeks</MenuItem>
        </TextField>
      </Stack>

      {dashboard.isError ? (
        <Alert severity="error">
          Unable to load Project Engineer operational reporting.
        </Alert>
      ) : null}

      {!projectId ? (
        <Alert severity="info">
          Select a Project to view current V0.2 execution information.
        </Alert>
      ) : null}

      {data ? (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">
                  {data.project.projectCode} · {data.project.projectName}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    label={'Activities ' + data.schedule.summary.total}
                    variant="outlined"
                  />
                  <Chip
                    label={'Critical ' + data.schedule.summary.critical}
                    variant="outlined"
                  />
                  <Chip
                    label={'Delayed ' + data.schedule.summary.delayed}
                    variant="outlined"
                  />
                  <Chip
                    label={'Completed ' + data.schedule.summary.completed}
                    variant="outlined"
                  />
                  <Chip
                    label={'Assigned Equipment ' + data.equipment.assignedCount}
                    variant="outlined"
                  />
                  <Chip
                    label={
                      data.schedule.currentBaseline
                        ? 'Baseline v' +
                          data.schedule.currentBaseline.versionNo
                        : 'No approved baseline'
                    }
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Planned {dateKey(data.project.plannedStartDate)} →{' '}
                  {dateKey(data.project.plannedCompletionDate)} · Actual{' '}
                  {dateKey(data.project.actualStartDate)} →{' '}
                  {dateKey(data.project.actualCompletionDate)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">
                  {data.schedule.lookahead.window.days === 14
                    ? '2-Week'
                    : '4-Week'}{' '}
                  Lookahead · {data.schedule.lookahead.window.asOfDate} →{' '}
                  {data.schedule.lookahead.window.endDate}
                </Typography>
                {data.schedule.lookahead.activities.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No Activities overlap the selected lookahead window.
                  </Typography>
                ) : null}
                {data.schedule.lookahead.activities.map((activity) => (
                  <Stack
                    key={activity.activityId}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                  >
                    <Typography sx={{ flexGrow: 1 }}>
                      {activity.activityCode} · {activity.activityName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dateKey(activity.forecastStartDate)} →{' '}
                      {dateKey(activity.forecastFinishDate)}
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        activity.delayStatus +
                        (activity.isCritical ? ' · CRITICAL' : '')
                      }
                      variant="outlined"
                    />
                    <Typography variant="body2">
                      {activity.currentPercentComplete ?? 0}%
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">
                  Recent Daily Site Reports
                </Typography>
                {data.siteExecution.latestReports.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No Daily Site Reports exist on or before {data.asOfDate}.
                  </Typography>
                ) : null}
                {data.siteExecution.latestReports.map((report, index) => (
                  <Stack key={report.id} spacing={1}>
                    {index > 0 ? <Divider /> : null}
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                    >
                      <Typography sx={{ flexGrow: 1 }}>
                        {dateKey(report.reportDate)} · {report.status}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Manpower {report.totalManpower} · Progress{' '}
                        {report.counts.progress} · Issues {report.counts.issues} ·
                        Delays {report.counts.delays} · Equipment{' '}
                        {report.counts.equipmentUsage}
                      </Typography>
                    </Stack>
                    {report.weatherObservation ? (
                      <Typography variant="body2">
                        Weather: {report.weatherObservation}
                      </Typography>
                    ) : null}
                    {report.generalRemarks ? (
                      <Typography variant="body2" color="text.secondary">
                        {report.generalRemarks}
                      </Typography>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">
                  Assigned Operational Equipment
                </Typography>
                {data.equipment.assignments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No active AVAILABLE Equipment is assigned on {data.asOfDate}.
                  </Typography>
                ) : null}
                {data.equipment.assignments.map((assignment) => (
                  <Stack
                    key={assignment.assignmentId}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                  >
                    <Typography sx={{ flexGrow: 1 }}>
                      {assignment.equipment.equipmentCode} ·{' '}
                      {assignment.equipment.equipmentName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {assignment.equipment.equipmentType.equipmentTypeName} ·
                      from {dateKey(assignment.assignedFrom)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
