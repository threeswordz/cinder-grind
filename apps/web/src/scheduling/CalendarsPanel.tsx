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
  CalendarException,
  CalendarWeekday,
  schedulingApi,
  WorkingCalendarRecord,
} from '../api/scheduling';

type WeekdayForm = {
  weekdayNo: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
};

type ExceptionForm = {
  exceptionDate: string;
  isWorkingOverride: boolean;
  startTime: string;
  endTime: string;
  reason: string;
};

const weekdayNames = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function dateValue(value: string): string {
  return value ? value.slice(0, 10) : '';
}

function timeValue(value: string | null): string {
  if (!value) return '';
  const t = value.includes('T') ? value.slice(11, 16) : value.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(t) ? t : '';
}

function weekdayForms(rows: CalendarWeekday[] = []): WeekdayForm[] {
  return Array.from({ length: 7 }, (_, index) => {
    const weekdayNo = index + 1;
    const row = rows.find((item) => item.weekdayNo === weekdayNo);
    return {
      weekdayNo,
      isWorking: row?.isWorking ?? false,
      startTime: timeValue(row?.startTime ?? null),
      endTime: timeValue(row?.endTime ?? null),
    };
  });
}

function exceptionForms(rows: CalendarException[] = []): ExceptionForm[] {
  return rows.map((row) => ({
    exceptionDate: dateValue(row.exceptionDate),
    isWorkingOverride: row.isWorkingOverride,
    startTime: timeValue(row.startTime),
    endTime: timeValue(row.endTime),
    reason: row.reason ?? '',
  }));
}

export function CalendarsPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [scopeProjectId, setScopeProjectId] = useState('');
  const [active, setActive] = useState('all');
  const [selected, setSelected] = useState<WorkingCalendarRecord | null>(null);
  const [form, setForm] = useState({
    projectId: '',
    calendarName: '',
    description: '',
    timezoneName:
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    isDefault: false,
  });
  const [weekdays, setWeekdays] = useState<WeekdayForm[]>(weekdayForms());
  const [exceptions, setExceptions] = useState<ExceptionForm[]>([]);

  const projects = useQuery({
    queryKey: ['schedule', 'calendar-projects'],
    queryFn: schedulingApi.calendarProjects,
    enabled: canManage,
  });
  const calendars = useQuery({
    queryKey: ['schedule', 'calendars', scopeProjectId, active],
    queryFn: () =>
      schedulingApi.calendars(scopeProjectId || undefined, active),
    enabled: canManage,
  });

  const rows = calendars.data?.data ?? [];
  const projectMap = useMemo(
    () => new Map((projects.data?.data ?? []).map((row) => [row.id, row])),
    [projects.data?.data],
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['schedule', 'calendars'] });

  const reset = () => {
    setSelected(null);
    setForm({
      projectId: '',
      calendarName: '',
      description: '',
      timezoneName:
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      isDefault: false,
    });
    setWeekdays(weekdayForms());
    setExceptions([]);
  };

  const select = (row: WorkingCalendarRecord) => {
    setSelected(row);
    setForm({
      projectId: row.projectId ?? '',
      calendarName: row.calendarName,
      description: row.description ?? '',
      timezoneName: row.timezoneName,
      isDefault: row.isDefault,
    });
    setWeekdays(weekdayForms(row.weekdays));
    setExceptions(exceptionForms(row.exceptions));
  };

  const saveCalendar = useMutation({
    mutationFn: () =>
      selected
        ? schedulingApi.updateCalendar(selected.id, {
            projectId: form.projectId || null,
            calendarName: form.calendarName,
            description: form.description || null,
            timezoneName: form.timezoneName,
            isDefault: form.isDefault,
          })
        : schedulingApi.createCalendar({
            projectId: form.projectId || null,
            calendarName: form.calendarName,
            description: form.description || null,
            timezoneName: form.timezoneName,
            isDefault: form.isDefault,
          }),
    onSuccess: async (response) => {
      await refresh();
      const calendar = response.data;
      setSelected(calendar);
      setWeekdays(weekdayForms(calendar.weekdays));
      setExceptions(exceptionForms(calendar.exceptions));
    },
  });

  const saveRules = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a Working Calendar first.');
      await schedulingApi.replaceWeekdays(
        selected.id,
        weekdays.map((row) => ({
          weekdayNo: row.weekdayNo,
          isWorking: row.isWorking,
          startTime: row.startTime || null,
          endTime: row.endTime || null,
        })),
      );
      await schedulingApi.replaceExceptions(
        selected.id,
        exceptions.map((row) => ({
          exceptionDate: row.exceptionDate,
          isWorkingOverride: row.isWorkingOverride,
          startTime: row.startTime || null,
          endTime: row.endTime || null,
          reason: row.reason || null,
        })),
      );
    },
    onSuccess: refresh,
  });

  const toggle = useMutation({
    mutationFn: (row: WorkingCalendarRecord) =>
      schedulingApi.setCalendarActive(row.id, !row.isActive),
    onSuccess: refresh,
  });

  if (!canManage) return null;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Working Calendars</Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          select
          label="Project Filter"
          value={scopeProjectId}
          onChange={(event) => setScopeProjectId(event.target.value)}
          fullWidth
        >
          <MenuItem value="">All accessible / company calendars</MenuItem>
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
        <Button onClick={reset}>New Calendar</Button>
      </Stack>

      {calendars.isError || projects.isError ? (
        <Alert severity="error">Unable to load Working Calendars.</Alert>
      ) : null}

      {rows.map((row) => (
        <Card key={row.id} variant="outlined">
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              spacing={2}
            >
              <div>
                <Typography fontWeight={600}>{row.calendarName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.projectId
                    ? projectMap.get(row.projectId)?.projectName ??
                      'Project-specific'
                    : 'Company calendar'}
                  {' · '}
                  {row.timezoneName}
                  {' · '}
                  {row.isDefault ? 'Default · ' : ''}
                  {row.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </div>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => select(row)}>Edit</Button>
                <Button onClick={() => toggle.mutate(row)}>
                  {row.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Stack
        component="form"
        spacing={2}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          saveCalendar.mutate();
        }}
      >
        <Typography>
          {selected ? 'Edit Working Calendar' : 'Add Working Calendar'}
        </Typography>
        <TextField
          select
          label="Project"
          value={form.projectId}
          onChange={(event) =>
            setForm({ ...form, projectId: event.target.value })
          }
        >
          <MenuItem value="">Company calendar</MenuItem>
          {(projects.data?.data ?? []).map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.projectCode} · {project.projectName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Calendar Name"
          value={form.calendarName}
          onChange={(event) =>
            setForm({ ...form, calendarName: event.target.value })
          }
          required
        />
        <TextField
          label="Timezone"
          value={form.timezoneName}
          onChange={(event) =>
            setForm({ ...form, timezoneName: event.target.value })
          }
          helperText="IANA timezone, for example Asia/Singapore"
          required
        />
        <TextField
          label="Description"
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
          multiline
          minRows={2}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.isDefault}
              onChange={(event) =>
                setForm({ ...form, isDefault: event.target.checked })
              }
            />
          }
          label="Default calendar"
        />
        <Stack direction="row" spacing={1}>
          <Button
            type="submit"
            variant="contained"
            disabled={saveCalendar.isPending}
          >
            Save Calendar
          </Button>
          {selected ? <Button onClick={reset}>Cancel</Button> : null}
        </Stack>
        {saveCalendar.isError ? (
          <Alert severity="error">Unable to save Working Calendar.</Alert>
        ) : null}
      </Stack>

      {selected ? (
        <Stack spacing={3}>
          <Typography variant="subtitle1">
            Weekday Rules — {selected.calendarName}
          </Typography>
          {weekdays.map((row, index) => (
            <Stack
              key={row.weekdayNo}
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ md: 'center' }}
            >
              <Typography sx={{ minWidth: 100 }}>
                {weekdayNames[row.weekdayNo]}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={row.isWorking}
                    onChange={(event) => {
                      const next = [...weekdays];
                      next[index] = {
                        ...row,
                        isWorking: event.target.checked,
                      };
                      setWeekdays(next);
                    }}
                  />
                }
                label="Working"
              />
              <TextField
                type="time"
                label="Start"
                value={row.startTime}
                InputLabelProps={{ shrink: true }}
                onChange={(event) => {
                  const next = [...weekdays];
                  next[index] = { ...row, startTime: event.target.value };
                  setWeekdays(next);
                }}
              />
              <TextField
                type="time"
                label="End"
                value={row.endTime}
                InputLabelProps={{ shrink: true }}
                onChange={(event) => {
                  const next = [...weekdays];
                  next[index] = { ...row, endTime: event.target.value };
                  setWeekdays(next);
                }}
              />
            </Stack>
          ))}

          <Typography variant="subtitle1">Calendar Exceptions / Holidays</Typography>
          {exceptions.map((row, index) => (
            <Card key={index} variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    type="date"
                    label="Date"
                    value={row.exceptionDate}
                    InputLabelProps={{ shrink: true }}
                    onChange={(event) => {
                      const next = [...exceptions];
                      next[index] = {
                        ...row,
                        exceptionDate: event.target.value,
                      };
                      setExceptions(next);
                    }}
                    required
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={row.isWorkingOverride}
                        onChange={(event) => {
                          const next = [...exceptions];
                          next[index] = {
                            ...row,
                            isWorkingOverride: event.target.checked,
                          };
                          setExceptions(next);
                        }}
                      />
                    }
                    label="Working-day override"
                  />
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      type="time"
                      label="Start"
                      value={row.startTime}
                      InputLabelProps={{ shrink: true }}
                      onChange={(event) => {
                        const next = [...exceptions];
                        next[index] = {
                          ...row,
                          startTime: event.target.value,
                        };
                        setExceptions(next);
                      }}
                    />
                    <TextField
                      type="time"
                      label="End"
                      value={row.endTime}
                      InputLabelProps={{ shrink: true }}
                      onChange={(event) => {
                        const next = [...exceptions];
                        next[index] = {
                          ...row,
                          endTime: event.target.value,
                        };
                        setExceptions(next);
                      }}
                    />
                    <TextField
                      label="Reason"
                      value={row.reason}
                      onChange={(event) => {
                        const next = [...exceptions];
                        next[index] = { ...row, reason: event.target.value };
                        setExceptions(next);
                      }}
                      fullWidth
                    />
                  </Stack>
                  <Button
                    onClick={() =>
                      setExceptions(
                        exceptions.filter((_item, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Remove Exception
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
          <Stack direction="row" spacing={1}>
            <Button
              onClick={() =>
                setExceptions([
                  ...exceptions,
                  {
                    exceptionDate: '',
                    isWorkingOverride: false,
                    startTime: '',
                    endTime: '',
                    reason: '',
                  },
                ])
              }
            >
              Add Exception
            </Button>
            <Button
              variant="contained"
              onClick={() => saveRules.mutate()}
              disabled={saveRules.isPending}
            >
              Save Calendar Rules
            </Button>
          </Stack>
          {saveRules.isError ? (
            <Alert severity="error">Unable to save Calendar rules.</Alert>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
