import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { schedulingApi } from '../api/scheduling';

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '—';
}

export function BaselinesProgressPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const queryClient = useQueryClient();
  const canView = permissions.includes('schedule.programme.view');
  const canCreateBaseline = permissions.includes('schedule.baseline.create');
  const canApproveBaseline = permissions.includes('schedule.baseline.approve');
  const canRecordProgress = permissions.includes('schedule.progress.record');

  const [projectId, setProjectId] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [activityId, setActivityId] = useState('');
  const [progressDate, setProgressDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [percentComplete, setPercentComplete] = useState('');
  const [progressNote, setProgressNote] = useState('');

  const projects = useQuery({
    queryKey: ['schedule', 'projects'],
    queryFn: schedulingApi.projects,
    enabled: canView,
  });
  const workflows = useQuery({
    queryKey: ['schedule', 'baseline-workflows'],
    queryFn: schedulingApi.baselineWorkflows,
    enabled: canCreateBaseline,
  });
  const baselines = useQuery({
    queryKey: ['schedule', 'baselines', projectId],
    queryFn: () => schedulingApi.baselines(projectId),
    enabled: Boolean(projectId && canView),
  });
  const comparison = useQuery({
    queryKey: ['schedule', 'comparison', projectId],
    queryFn: () => schedulingApi.comparison(projectId),
    enabled: Boolean(projectId && canView),
  });
  const history = useQuery({
    queryKey: ['schedule', 'progress-history', activityId],
    queryFn: () => schedulingApi.progressHistory(activityId),
    enabled: Boolean(activityId && canView),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['schedule', 'baselines', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['schedule', 'comparison', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['schedule', 'progress-history', activityId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['schedule', 'activities', projectId],
      }),
    ]);
  };

  const submitBaseline = useMutation({
    mutationFn: () => schedulingApi.submitBaseline(projectId, workflowCode),
    onSuccess: refresh,
  });

  const approveBaseline = useMutation({
    mutationFn: (id: string) =>
      schedulingApi.approveBaseline(id, approvalComment),
    onSuccess: async () => {
      setApprovalComment('');
      await refresh();
    },
  });

  const rejectBaseline = useMutation({
    mutationFn: (id: string) =>
      schedulingApi.rejectBaseline(id, approvalComment),
    onSuccess: async () => {
      setApprovalComment('');
      await refresh();
    },
  });

  const recordProgress = useMutation({
    mutationFn: () =>
      schedulingApi.recordProgress(activityId, {
        progressDate,
        percentComplete,
        note: progressNote || null,
      }),
    onSuccess: async () => {
      setPercentComplete('');
      setProgressNote('');
      await refresh();
    },
  });

  const rows = comparison.data?.data.activities ?? [];
  const selectedActivity = useMemo(
    () => rows.find((row) => row.activityId === activityId),
    [activityId, rows],
  );

  const submitProgress = (event: FormEvent) => {
    event.preventDefault();
    recordProgress.mutate();
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Baselines & Progress</Typography>

      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          setActivityId('');
        }}
        fullWidth
      >
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} — {project.projectName}
          </MenuItem>
        ))}
      </TextField>

      {projectId && canCreateBaseline ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Submit Schedule Baseline
              </Typography>
              <TextField
                select
                label="Approval Workflow"
                value={workflowCode}
                onChange={(event) => setWorkflowCode(event.target.value)}
                fullWidth
              >
                {(workflows.data?.data ?? []).map((workflow) => (
                  <MenuItem
                    key={workflow.id}
                    value={workflow.workflowCode}
                  >
                    {workflow.workflowName} ({workflow.workflowCode})
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                disabled={!workflowCode || submitBaseline.isPending}
                onClick={() => submitBaseline.mutate()}
              >
                Submit New Baseline Version
              </Button>
              {submitBaseline.isError ? (
                <Alert severity="error">
                  Baseline submission failed. Check the configured
                  SCHEDULE_BASELINE Approval Matrix and schedule data.
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Baseline Versions
              </Typography>
              {(baselines.data?.data ?? []).length === 0 ? (
                <Typography color="text.secondary">
                  No baseline has been submitted for this Project.
                </Typography>
              ) : null}
              {(baselines.data?.data ?? []).map((baseline) => (
                <Card key={baseline.id} variant="outlined">
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Typography>
                          Version {baseline.versionNo}
                        </Typography>
                        <Chip
                          size="small"
                          label={
                            baseline.approvalInstance?.approvalState ??
                            'PENDING'
                          }
                        />
                        {baseline.isCurrent ? (
                          <Chip size="small" label="Current" />
                        ) : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Submitted by {baseline.submittedBy.displayName} ·{' '}
                        {dateValue(baseline.submittedAt)} ·{' '}
                        {baseline._count?.activities ?? 0} Activities
                      </Typography>
                      {canApproveBaseline &&
                      baseline.approvalInstance?.approvalState ===
                        'SUBMITTED' ? (
                        <Stack spacing={1}>
                          <TextField
                            label="Approval comment"
                            value={approvalComment}
                            onChange={(event) =>
                              setApprovalComment(event.target.value)
                            }
                            fullWidth
                          />
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="contained"
                              onClick={() =>
                                approveBaseline.mutate(baseline.id)
                              }
                              disabled={approveBaseline.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              onClick={() =>
                                rejectBaseline.mutate(baseline.id)
                              }
                              disabled={rejectBaseline.isPending}
                            >
                              Reject
                            </Button>
                          </Stack>
                        </Stack>
                      ) : null}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {approveBaseline.isError || rejectBaseline.isError ? (
                <Alert severity="error">
                  Approval action failed. Verify your configured approval
                  role and maker-checker separation.
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Baseline / Forecast Comparison
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current baseline:{' '}
                {comparison.data?.data.currentBaseline
                  ? 'Version ' +
                    comparison.data.data.currentBaseline.versionNo
                  : 'None approved'}
              </Typography>
              {rows.map((row) => (
                <Card key={row.activityId} variant="outlined">
                  <CardContent>
                    <Stack spacing={0.5}>
                      <Typography>
                        {row.activityCode} — {row.activityName}
                      </Typography>
                      <Typography variant="body2">
                        WBS {row.wbs.wbsCode} · Progress{' '}
                        {row.currentPercentComplete === null
                          ? '—'
                          : row.currentPercentComplete + '%'}
                      </Typography>
                      <Typography variant="body2">
                        Baseline {dateValue(row.baselineStartDate)} →{' '}
                        {dateValue(row.baselineFinishDate)}
                      </Typography>
                      <Typography variant="body2">
                        Forecast {dateValue(row.forecastStartDate)} →{' '}
                        {dateValue(row.forecastFinishDate)}
                      </Typography>
                      <Typography variant="body2">
                        Finish variance:{' '}
                        {row.finishVarianceWorkDays === null
                          ? '—'
                          : row.finishVarianceWorkDays + ' work days'}{' '}
                        · {row.delayStatus}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {projectId && canView ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Activity Progress History
              </Typography>
              <TextField
                select
                label="Activity"
                value={activityId}
                onChange={(event) => setActivityId(event.target.value)}
                fullWidth
              >
                {rows.map((row) => (
                  <MenuItem key={row.activityId} value={row.activityId}>
                    {row.activityCode} — {row.activityName}
                  </MenuItem>
                ))}
              </TextField>

              {activityId && canRecordProgress ? (
                <Stack
                  component="form"
                  spacing={2}
                  onSubmit={submitProgress}
                >
                  <Typography variant="body2">
                    Recording for{' '}
                    {selectedActivity?.activityName ?? 'selected Activity'}
                  </Typography>
                  <TextField
                    type="date"
                    label="Progress Date"
                    value={progressDate}
                    onChange={(event) => setProgressDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                  <TextField
                    label="Percent Complete"
                    value={percentComplete}
                    onChange={(event) =>
                      setPercentComplete(event.target.value)
                    }
                    inputProps={{ inputMode: 'decimal' }}
                    required
                  />
                  <TextField
                    label="Note"
                    value={progressNote}
                    onChange={(event) => setProgressNote(event.target.value)}
                    multiline
                    minRows={2}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={recordProgress.isPending}
                  >
                    Record Progress
                  </Button>
                  {recordProgress.isError ? (
                    <Alert severity="error">
                      Progress entry failed. Percent complete must be
                      between 0 and 100.
                    </Alert>
                  ) : null}
                </Stack>
              ) : null}

              {(history.data?.data ?? []).map((entry) => (
                <Card key={entry.id} variant="outlined">
                  <CardContent>
                    <Typography>
                      {dateValue(entry.progressDate)} —{' '}
                      {entry.percentComplete}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {entry.note || 'No note'} ·{' '}
                      {entry.recordedBy?.displayName ?? 'Recorded user'}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
