import { FormEvent, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ActivityDependencyRecord,
  ActivityRecord,
  schedulingApi,
} from '../api/scheduling';

type ActivityForm = {
  wbsId: string;
  parentActivityId: string;
  activityTypeId: string;
  workingCalendarId: string;
  statusDefinitionId: string;
  activityCode: string;
  activityName: string;
  description: string;
  isSummary: boolean;
  isMilestone: boolean;
  plannedDurationWorkDays: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  actualStartDate: string;
  actualFinishDate: string;
  forecastStartDate: string;
  forecastFinishDate: string;
  responsibleEmployeeId: string;
  ownerUserId: string;
};

const emptyActivity: ActivityForm = {
  wbsId: '',
  parentActivityId: '',
  activityTypeId: '',
  workingCalendarId: '',
  statusDefinitionId: '',
  activityCode: '',
  activityName: '',
  description: '',
  isSummary: false,
  isMilestone: false,
  plannedDurationWorkDays: '',
  plannedStartDate: '',
  plannedFinishDate: '',
  actualStartDate: '',
  actualFinishDate: '',
  forecastStartDate: '',
  forecastFinishDate: '',
  responsibleEmployeeId: '',
  ownerUserId: '',
};

function dateValue(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function asBody(form: ActivityForm, projectId?: string) {
  return {
    ...(projectId ? { projectId } : {}),
    wbsId: form.wbsId,
    parentActivityId: form.parentActivityId || null,
    activityTypeId: form.activityTypeId || null,
    workingCalendarId: form.workingCalendarId,
    statusDefinitionId: form.statusDefinitionId || null,
    activityCode: form.activityCode,
    activityName: form.activityName,
    description: form.description || null,
    isSummary: form.isSummary,
    isMilestone: form.isMilestone,
    plannedDurationWorkDays: form.plannedDurationWorkDays,
    plannedStartDate: form.plannedStartDate,
    plannedFinishDate: form.plannedFinishDate,
    actualStartDate: form.actualStartDate || null,
    actualFinishDate: form.actualFinishDate || null,
    forecastStartDate: form.forecastStartDate || null,
    forecastFinishDate: form.forecastFinishDate || null,
    responsibleEmployeeId: form.responsibleEmployeeId || null,
    ownerUserId: form.ownerUserId || null,
  };
}

export function ActivitiesPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const queryClient = useQueryClient();
  const canView = permissions.includes('schedule.programme.view');
  const canCreate = permissions.includes('schedule.activity.create');
  const canEdit = permissions.includes('schedule.activity.edit');
  const canArchive = permissions.includes('schedule.activity.archive');
  const canDependencies = permissions.includes('schedule.dependency.manage');

  const [projectId, setProjectId] = useState('');
  const [active, setActive] = useState('all');
  const [selected, setSelected] = useState<ActivityRecord | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyActivity);
  const [selectedDependency, setSelectedDependency] =
    useState<ActivityDependencyRecord | null>(null);
  const [dependencyForm, setDependencyForm] = useState({
    predecessorActivityId: '',
    successorActivityId: '',
    dependencyType: 'FS',
    lagWorkDays: '0',
  });

  const projects = useQuery({
    queryKey: ['schedule', 'projects'],
    queryFn: schedulingApi.projects,
    enabled: canView,
  });
  const activities = useQuery({
    queryKey: ['schedule', 'activities', projectId, active],
    queryFn: () => schedulingApi.activities(projectId, active),
    enabled: Boolean(projectId && canView),
  });
  const options = useQuery({
    queryKey: ['schedule', 'activity-options', projectId],
    queryFn: () => schedulingApi.activityOptions(projectId),
    enabled: Boolean(projectId && canView),
  });
  const dependencies = useQuery({
    queryKey: ['schedule', 'dependencies', projectId, active],
    queryFn: () => schedulingApi.dependencies(projectId, active),
    enabled: Boolean(projectId && canView),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['schedule', 'activities', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['schedule', 'activity-options', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['schedule', 'dependencies', projectId],
      }),
    ]);
  };

  const rows = activities.data?.data ?? [];
  const optionData = options.data?.data;

  const treeRows = useMemo(() => {
    const result: Array<{ row: ActivityRecord; depth: number }> = [];
    const seen = new Set<string>();
    const visit = (parentId: string | null, depth: number) => {
      rows
        .filter((row) => row.parentActivityId === parentId)
        .sort((a, b) => a.activityCode.localeCompare(b.activityCode))
        .forEach((row) => {
          if (seen.has(row.id)) return;
          seen.add(row.id);
          result.push({ row, depth });
          visit(row.id, depth + 1);
        });
    };
    visit(null, 0);
    rows
      .filter((row) => !seen.has(row.id))
      .forEach((row) => result.push({ row, depth: 0 }));
    return result;
  }, [rows]);

  const excludedParents = useMemo(() => {
    const excluded = new Set<string>();
    if (!selected) return excluded;
    excluded.add(selected.id);
    const collect = (id: string) => {
      rows
        .filter((row) => row.parentActivityId === id)
        .forEach((child) => {
          if (excluded.has(child.id)) return;
          excluded.add(child.id);
          collect(child.id);
        });
    };
    collect(selected.id);
    return excluded;
  }, [rows, selected]);

  const resetActivity = () => {
    setSelected(null);
    setForm(emptyActivity);
  };

  const editActivity = (row: ActivityRecord) => {
    setSelected(row);
    setForm({
      wbsId: row.wbsId,
      parentActivityId: row.parentActivityId ?? '',
      activityTypeId: row.activityTypeId ?? '',
      workingCalendarId: row.workingCalendarId,
      statusDefinitionId: row.statusDefinitionId ?? '',
      activityCode: row.activityCode,
      activityName: row.activityName,
      description: row.description ?? '',
      isSummary: row.isSummary,
      isMilestone: row.isMilestone,
      plannedDurationWorkDays: String(row.plannedDurationWorkDays),
      plannedStartDate: dateValue(row.plannedStartDate),
      plannedFinishDate: dateValue(row.plannedFinishDate),
      actualStartDate: dateValue(row.actualStartDate),
      actualFinishDate: dateValue(row.actualFinishDate),
      forecastStartDate: dateValue(row.forecastStartDate),
      forecastFinishDate: dateValue(row.forecastFinishDate),
      responsibleEmployeeId: row.responsibleEmployeeId ?? '',
      ownerUserId: row.ownerUserId ?? '',
    });
  };

  const saveActivity = useMutation({
    mutationFn: () =>
      selected
        ? schedulingApi.updateActivity(selected.id, asBody(form))
        : schedulingApi.createActivity(asBody(form, projectId)),
    onSuccess: async () => {
      resetActivity();
      await refresh();
    },
  });

  const toggleActivity = useMutation({
    mutationFn: (row: ActivityRecord) =>
      schedulingApi.setActivityActive(row.id, !row.isActive),
    onSuccess: refresh,
  });

  const resetDependency = () => {
    setSelectedDependency(null);
    setDependencyForm({
      predecessorActivityId: '',
      successorActivityId: '',
      dependencyType: 'FS',
      lagWorkDays: '0',
    });
  };

  const saveDependency = useMutation({
    mutationFn: () =>
      selectedDependency
        ? schedulingApi.updateDependency(selectedDependency.id, dependencyForm)
        : schedulingApi.createDependency({
            projectId,
            ...dependencyForm,
          }),
    onSuccess: async () => {
      resetDependency();
      await refresh();
    },
  });

  const toggleDependency = useMutation({
    mutationFn: (row: ActivityDependencyRecord) =>
      schedulingApi.setDependencyActive(row.id, !row.isActive),
    onSuccess: refresh,
  });

  if (!canView) return null;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Programme Activities</Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          select
          label="Project"
          value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value);
            resetActivity();
            resetDependency();
          }}
          fullWidth
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
          label="Status"
          value={active}
          onChange={(event) => setActive(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
        {projectId && canCreate ? (
          <Button onClick={resetActivity}>New Activity</Button>
        ) : null}
      </Stack>

      {activities.isError || options.isError ? (
        <Alert severity="error">Unable to load scheduling data.</Alert>
      ) : null}

      {treeRows.map(({ row, depth }) => (
        <Card key={row.id} variant="outlined">
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              spacing={2}
            >
              <div>
                <Typography fontWeight={600} sx={{ pl: depth * 3 }}>
                  {row.activityCode} · {row.activityName}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ pl: depth * 3 }}
                >
                  {row.wbs?.wbsCode ?? 'WBS'} ·{' '}
                  {dateValue(row.plannedStartDate)} →{' '}
                  {dateValue(row.plannedFinishDate)} ·{' '}
                  {row.plannedDurationWorkDays} work days
                  {row.isSummary ? ' · Summary' : ''}
                  {row.isMilestone ? ' · Milestone' : ''}
                  {' · '}
                  {row.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </div>
              <Stack direction="row" spacing={1}>
                {canEdit ? <Button onClick={() => editActivity(row)}>Edit</Button> : null}
                {canArchive ? (
                  <Button onClick={() => toggleActivity.mutate(row)}>
                    {row.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}

      {projectId && (canCreate || (selected && canEdit)) ? (
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            saveActivity.mutate();
          }}
        >
          <Typography>{selected ? 'Edit Activity' : 'Add Activity'}</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Activity Code"
              value={form.activityCode}
              onChange={(event) =>
                setForm({ ...form, activityCode: event.target.value })
              }
              required
              fullWidth
            />
            <TextField
              label="Activity Name"
              value={form.activityName}
              onChange={(event) =>
                setForm({ ...form, activityName: event.target.value })
              }
              required
              fullWidth
            />
          </Stack>
          <TextField
            select
            label="WBS"
            value={form.wbsId}
            onChange={(event) => setForm({ ...form, wbsId: event.target.value })}
            required
          >
            <MenuItem value="">Select WBS</MenuItem>
            {(optionData?.wbs ?? []).map((row) => (
              <MenuItem key={row.id} value={row.id}>
                {row.wbsCode} · {row.wbsName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Parent Activity"
            value={form.parentActivityId}
            onChange={(event) =>
              setForm({ ...form, parentActivityId: event.target.value })
            }
          >
            <MenuItem value="">No parent</MenuItem>
            {(optionData?.parents ?? [])
              .filter((row) => !excludedParents.has(row.id))
              .map((row) => (
                <MenuItem key={row.id} value={row.id}>
                  {row.activityCode} · {row.activityName}
                </MenuItem>
              ))}
          </TextField>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              label="Activity Type"
              value={form.activityTypeId}
              onChange={(event) =>
                setForm({ ...form, activityTypeId: event.target.value })
              }
              fullWidth
            >
              <MenuItem value="">None</MenuItem>
              {(optionData?.activityTypes ?? []).map((row) => (
                <MenuItem key={row.id} value={row.id}>
                  {row.activityTypeCode} · {row.activityTypeName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Working Calendar"
              value={form.workingCalendarId}
              onChange={(event) =>
                setForm({ ...form, workingCalendarId: event.target.value })
              }
              required
              fullWidth
            >
              <MenuItem value="">Select Calendar</MenuItem>
              {(optionData?.calendars ?? []).map((row) => (
                <MenuItem key={row.id} value={row.id}>
                  {row.calendarName}
                  {row.isDefault ? ' · Default' : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Status"
              value={form.statusDefinitionId}
              onChange={(event) =>
                setForm({ ...form, statusDefinitionId: event.target.value })
              }
              fullWidth
            >
              <MenuItem value="">No configured status</MenuItem>
              {(optionData?.statuses ?? []).map((row) => (
                <MenuItem key={row.id} value={row.id}>
                  {row.statusLabel}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              type="number"
              label="Planned Duration (work days)"
              value={form.plannedDurationWorkDays}
              onChange={(event) =>
                setForm({
                  ...form,
                  plannedDurationWorkDays: event.target.value,
                })
              }
              inputProps={{ min: 0, step: 0.01 }}
              required
              fullWidth
            />
            <TextField
              type="date"
              label="Planned Start"
              value={form.plannedStartDate}
              InputLabelProps={{ shrink: true }}
              onChange={(event) =>
                setForm({ ...form, plannedStartDate: event.target.value })
              }
              required
              fullWidth
            />
            <TextField
              type="date"
              label="Planned Finish"
              value={form.plannedFinishDate}
              InputLabelProps={{ shrink: true }}
              onChange={(event) =>
                setForm({ ...form, plannedFinishDate: event.target.value })
              }
              required
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              type="date"
              label="Actual Start"
              value={form.actualStartDate}
              InputLabelProps={{ shrink: true }}
              onChange={(event) =>
                setForm({ ...form, actualStartDate: event.target.value })
              }
              fullWidth
            />
            <TextField
              type="date"
              label="Actual Finish"
              value={form.actualFinishDate}
              InputLabelProps={{ shrink: true }}
              onChange={(event) =>
                setForm({ ...form, actualFinishDate: event.target.value })
              }
              fullWidth
            />
            <TextField
              type="date"
              label="Forecast Start"
              value={form.forecastStartDate}
              InputLabelProps={{ shrink: true }}
              onChange={(event) =>
                setForm({ ...form, forecastStartDate: event.target.value })
              }
              fullWidth
            />
            <TextField
              type="date"
              label="Forecast Finish"
              value={form.forecastFinishDate}
              InputLabelProps={{ shrink: true }}
              onChange={(event) =>
                setForm({ ...form, forecastFinishDate: event.target.value })
              }
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              label="Responsible Project Engineer"
              value={form.responsibleEmployeeId}
              onChange={(event) =>
                setForm({
                  ...form,
                  responsibleEmployeeId: event.target.value,
                })
              }
              fullWidth
            >
              <MenuItem value="">None</MenuItem>
              {(optionData?.employees ?? []).map((row) => (
                <MenuItem key={row.id} value={row.id}>
                  {row.employeeCode} · {row.employeeName}
                  {row.jobTitle ? ' (' + row.jobTitle + ')' : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Owner User"
              value={form.ownerUserId}
              onChange={(event) =>
                setForm({ ...form, ownerUserId: event.target.value })
              }
              fullWidth
            >
              <MenuItem value="">None</MenuItem>
              {(optionData?.users ?? []).map((row) => (
                <MenuItem key={row.id} value={row.id}>
                  {row.displayName} · {row.email}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <TextField
            label="Description"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            multiline
            minRows={2}
          />

          <Stack direction="row" spacing={2}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.isSummary}
                  onChange={(event) =>
                    setForm({ ...form, isSummary: event.target.checked })
                  }
                />
              }
              label="Summary Activity"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.isMilestone}
                  onChange={(event) =>
                    setForm({ ...form, isMilestone: event.target.checked })
                  }
                />
              }
              label="Milestone"
            />
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              type="submit"
              variant="contained"
              disabled={saveActivity.isPending}
            >
              Save Activity
            </Button>
            {selected ? <Button onClick={resetActivity}>Cancel</Button> : null}
          </Stack>
          {saveActivity.isError ? (
            <Alert severity="error">Unable to save Activity.</Alert>
          ) : null}
        </Stack>
      ) : null}

      {projectId ? (
        <Stack spacing={2}>
          <Typography variant="h6">Activity Dependencies</Typography>
          {dependencies.isError ? (
            <Alert severity="error">Unable to load Activity Dependencies.</Alert>
          ) : null}
          {(dependencies.data?.data ?? []).map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <div>
                    <Typography fontWeight={600}>
                      {row.predecessor?.activityCode ?? 'Predecessor'} →{' '}
                      {row.successor?.activityCode ?? 'Successor'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {row.dependencyType} · Lag {row.lagWorkDays} work days ·{' '}
                      {row.isActive ? 'Active' : 'Inactive'}
                    </Typography>
                  </div>
                  {canDependencies ? (
                    <Stack direction="row" spacing={1}>
                      <Button
                        onClick={() => {
                          setSelectedDependency(row);
                          setDependencyForm({
                            predecessorActivityId: row.predecessorActivityId,
                            successorActivityId: row.successorActivityId,
                            dependencyType: row.dependencyType,
                            lagWorkDays: String(row.lagWorkDays),
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button onClick={() => toggleDependency.mutate(row)}>
                        {row.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ))}

          {canDependencies ? (
            <Stack
              component="form"
              spacing={2}
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                saveDependency.mutate();
              }}
            >
              <Typography>
                {selectedDependency ? 'Edit Dependency' : 'Add Dependency'}
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Predecessor"
                  value={dependencyForm.predecessorActivityId}
                  onChange={(event) =>
                    setDependencyForm({
                      ...dependencyForm,
                      predecessorActivityId: event.target.value,
                    })
                  }
                  required
                  fullWidth
                >
                  <MenuItem value="">Select Activity</MenuItem>
                  {rows
                    .filter((row) => row.isActive)
                    .map((row) => (
                      <MenuItem key={row.id} value={row.id}>
                        {row.activityCode} · {row.activityName}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  select
                  label="Successor"
                  value={dependencyForm.successorActivityId}
                  onChange={(event) =>
                    setDependencyForm({
                      ...dependencyForm,
                      successorActivityId: event.target.value,
                    })
                  }
                  required
                  fullWidth
                >
                  <MenuItem value="">Select Activity</MenuItem>
                  {rows
                    .filter((row) => row.isActive)
                    .map((row) => (
                      <MenuItem key={row.id} value={row.id}>
                        {row.activityCode} · {row.activityName}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  select
                  label="Type"
                  value={dependencyForm.dependencyType}
                  onChange={(event) =>
                    setDependencyForm({
                      ...dependencyForm,
                      dependencyType: event.target.value,
                    })
                  }
                  sx={{ minWidth: 120 }}
                >
                  {['FS', 'SS', 'FF', 'SF'].map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  type="number"
                  label="Lag (work days)"
                  value={dependencyForm.lagWorkDays}
                  onChange={(event) =>
                    setDependencyForm({
                      ...dependencyForm,
                      lagWorkDays: event.target.value,
                    })
                  }
                  inputProps={{ step: 0.01 }}
                  sx={{ minWidth: 180 }}
                  required
                />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saveDependency.isPending}
                >
                  Save Dependency
                </Button>
                {selectedDependency ? (
                  <Button onClick={resetDependency}>Cancel</Button>
                ) : null}
              </Stack>
              {saveDependency.isError ? (
                <Alert severity="error">Unable to save Activity Dependency.</Alert>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
