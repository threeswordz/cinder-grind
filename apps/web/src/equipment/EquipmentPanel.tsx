import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  EquipmentUsage,
  equipmentApi,
} from '../api/equipment';
import { siteExecutionApi } from '../api/site-execution';

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function EquipmentPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const queryClient = useQueryClient();
  const canTypeManage = permissions.includes('equipment.type.manage');
  const canEquipmentManage = permissions.includes('equipment.equipment.manage');
  const canAssignmentManage = permissions.includes(
    'equipment.assignment.manage',
  );
  const canUsageCreate = permissions.includes('equipment.usage.create');
  const canUsageEdit = permissions.includes('equipment.usage.edit');

  const [asOf, setAsOf] = useState(localDateValue());
  const [selectedId, setSelectedId] = useState('');
  const [newMode, setNewMode] = useState(false);

  const [typeCode, setTypeCode] = useState('');
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');

  const [equipmentTypeId, setEquipmentTypeId] = useState('');
  const [equipmentCode, setEquipmentCode] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [description, setDescription] = useState('');
  const [operationalStatus, setOperationalStatus] =
    useState<'AVAILABLE' | 'UNAVAILABLE'>('AVAILABLE');
  const [isActive, setIsActive] = useState(true);

  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [assignedFrom, setAssignedFrom] = useState(localDateValue());
  const [assignmentRemarks, setAssignmentRemarks] = useState('');
  const [releaseDate, setReleaseDate] = useState(localDateValue());

  const [editingUsageId, setEditingUsageId] = useState('');
  const [usageProjectId, setUsageProjectId] = useState('');
  const [usageDate, setUsageDate] = useState(localDateValue());
  const [operatingHours, setOperatingHours] = useState('');
  const [usageActivityId, setUsageActivityId] = useState('');
  const [usageWbsId, setUsageWbsId] = useState('');
  const [usageRemarks, setUsageRemarks] = useState('');

  const types = useQuery({
    queryKey: ['equipment', 'types'],
    queryFn: () => equipmentApi.types(false),
  });
  const equipment = useQuery({
    queryKey: ['equipment', 'register', asOf],
    queryFn: () => equipmentApi.register(asOf),
  });
  const projects = useQuery({
    queryKey: ['equipment', 'projects'],
    queryFn: equipmentApi.projects,
  });
  const assignments = useQuery({
    queryKey: ['equipment', 'assignments', selectedId],
    queryFn: () => equipmentApi.assignments(selectedId),
    enabled: Boolean(selectedId),
  });
  const usage = useQuery({
    queryKey: ['equipment', 'usage', selectedId],
    queryFn: () => equipmentApi.usage({ equipmentId: selectedId }),
    enabled: Boolean(selectedId),
  });
  const usageOptions = useQuery({
    queryKey: ['site-execution', 'options', usageProjectId],
    queryFn: () => siteExecutionApi.options(usageProjectId),
    enabled: Boolean(usageProjectId),
  });

  const selected = useMemo(
    () =>
      (equipment.data?.data ?? []).find((row) => row.id === selectedId) ??
      null,
    [equipment.data?.data, selectedId],
  );

  useEffect(() => {
    if (!selected || newMode) return;
    setEquipmentTypeId(selected.equipmentTypeId);
    setEquipmentCode(selected.equipmentCode);
    setEquipmentName(selected.equipmentName);
    setDescription(selected.description ?? '');
    setOperationalStatus(selected.operationalStatus);
    setIsActive(selected.isActive);
  }, [selected, newMode]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['equipment'] }),
      queryClient.invalidateQueries({ queryKey: ['site-execution'] }),
    ]);
  };

  const typeMutation = useMutation({
    mutationFn: () =>
      equipmentApi.createType({
        equipmentTypeCode: typeCode,
        equipmentTypeName: typeName,
        description: typeDescription || null,
      }),
    onSuccess: async () => {
      setTypeCode('');
      setTypeName('');
      setTypeDescription('');
      await refresh();
    },
  });

  const toggleTypeMutation = useMutation({
    mutationFn: (args: { id: string; isActive: boolean }) =>
      equipmentApi.updateType(args.id, { isActive: args.isActive }),
    onSuccess: refresh,
  });

  const equipmentMutation = useMutation({
    mutationFn: () =>
      newMode || !selectedId
        ? equipmentApi.createEquipment({
            equipmentTypeId,
            equipmentCode,
            equipmentName,
            description: description || null,
            operationalStatus,
            isActive,
          })
        : equipmentApi.updateEquipment(selectedId, {
            equipmentTypeId,
            equipmentCode,
            equipmentName,
            description: description || null,
            operationalStatus,
            isActive,
          }),
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      setNewMode(false);
      await refresh();
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      equipmentApi.assign(selectedId, {
        projectId: assignmentProjectId,
        assignedFrom,
        remarks: assignmentRemarks || null,
      }),
    onSuccess: async () => {
      setAssignmentProjectId('');
      setAssignmentRemarks('');
      await refresh();
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      equipmentApi.release(assignmentId, releaseDate),
    onSuccess: refresh,
  });

  const usageMutation = useMutation({
    mutationFn: () => {
      const body = {
        equipmentId: selectedId,
        projectId: usageProjectId,
        usageDate,
        operatingHours: operatingHours || null,
        activityId: usageActivityId || null,
        wbsId: usageWbsId || null,
        remarks: usageRemarks || null,
      };
      return editingUsageId
        ? equipmentApi.updateUsage(editingUsageId, body)
        : equipmentApi.createUsage(body);
    },
    onSuccess: async () => {
      clearUsageForm();
      await refresh();
    },
  });

  const clearEquipmentForm = () => {
    setSelectedId('');
    setNewMode(true);
    setEquipmentTypeId('');
    setEquipmentCode('');
    setEquipmentName('');
    setDescription('');
    setOperationalStatus('AVAILABLE');
    setIsActive(true);
  };

  const clearUsageForm = () => {
    setEditingUsageId('');
    setUsageProjectId('');
    setUsageDate(localDateValue());
    setOperatingHours('');
    setUsageActivityId('');
    setUsageWbsId('');
    setUsageRemarks('');
  };

  const editUsage = (row: EquipmentUsage) => {
    if (row.sourceType !== 'MANUAL') return;
    setEditingUsageId(row.id);
    setUsageProjectId(row.projectId);
    setUsageDate(row.usageDate.slice(0, 10));
    setOperatingHours(row.operatingHours ?? '');
    setUsageActivityId(row.activityId ?? '');
    setUsageWbsId(row.wbsId ?? '');
    setUsageRemarks(row.remarks ?? '');
  };

  const error =
    typeMutation.error ??
    toggleTypeMutation.error ??
    equipmentMutation.error ??
    assignMutation.error ??
    releaseMutation.error ??
    usageMutation.error;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ sm: 'center' }}
      >
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Equipment
        </Typography>
        <TextField
          label="Availability as of"
          type="date"
          value={asOf}
          onChange={(event) => setAsOf(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>

      {error ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Request failed.'}
        </Alert>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Equipment Types</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {(types.data?.data ?? []).map((type) => (
                <Chip
                  key={type.id}
                  label={
                    type.equipmentTypeCode +
                    ' · ' +
                    type.equipmentTypeName +
                    (type.isActive ? '' : ' · INACTIVE')
                  }
                  variant={type.isActive ? 'filled' : 'outlined'}
                  onDelete={
                    canTypeManage
                      ? () =>
                          toggleTypeMutation.mutate({
                            id: type.id,
                            isActive: !type.isActive,
                          })
                      : undefined
                  }
                  deleteIcon={undefined}
                />
              ))}
            </Stack>
            {canTypeManage ? (
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
              >
                <TextField
                  label="Type code"
                  value={typeCode}
                  onChange={(event) => setTypeCode(event.target.value)}
                />
                <TextField
                  label="Type name"
                  value={typeName}
                  onChange={(event) => setTypeName(event.target.value)}
                />
                <TextField
                  label="Description"
                  value={typeDescription}
                  onChange={(event) =>
                    setTypeDescription(event.target.value)
                  }
                  sx={{ flexGrow: 1 }}
                />
                <Button
                  variant="outlined"
                  disabled={
                    !typeCode.trim() ||
                    !typeName.trim() ||
                    typeMutation.isPending
                  }
                  onClick={() => typeMutation.mutate()}
                >
                  Add Type
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ sm: 'center' }}
            >
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                Equipment Register
              </Typography>
              {canEquipmentManage ? (
                <Button variant="outlined" onClick={clearEquipmentForm}>
                  New Equipment
                </Button>
              ) : null}
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {(equipment.data?.data ?? []).map((row) => (
                <Button
                  key={row.id}
                  variant={selectedId === row.id ? 'contained' : 'outlined'}
                  onClick={() => {
                    setNewMode(false);
                    setSelectedId(row.id);
                  }}
                >
                  {row.equipmentCode} · {row.equipmentName} ·{' '}
                  {row.availability}
                </Button>
              ))}
            </Stack>

            {(newMode || selected) && canEquipmentManage ? (
              <>
                <Divider />
                <Typography variant="subtitle1">
                  {newMode ? 'Create Equipment' : 'Edit Equipment'}
                </Typography>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                >
                  <TextField
                    select
                    label="Equipment type"
                    value={equipmentTypeId}
                    onChange={(event) =>
                      setEquipmentTypeId(event.target.value)
                    }
                    sx={{ minWidth: 220 }}
                  >
                    {(types.data?.data ?? [])
                      .filter(
                        (type) =>
                          type.isActive || type.id === equipmentTypeId,
                      )
                      .map((type) => (
                        <MenuItem key={type.id} value={type.id}>
                          {type.equipmentTypeCode} —{' '}
                          {type.equipmentTypeName}
                        </MenuItem>
                      ))}
                  </TextField>
                  <TextField
                    label="Equipment code"
                    value={equipmentCode}
                    onChange={(event) =>
                      setEquipmentCode(event.target.value)
                    }
                  />
                  <TextField
                    label="Equipment name"
                    value={equipmentName}
                    onChange={(event) =>
                      setEquipmentName(event.target.value)
                    }
                    sx={{ flexGrow: 1 }}
                  />
                  <TextField
                    select
                    label="Operational status"
                    value={operationalStatus}
                    onChange={(event) =>
                      setOperationalStatus(
                        event.target.value as
                          | 'AVAILABLE'
                          | 'UNAVAILABLE',
                      )
                    }
                  >
                    <MenuItem value="AVAILABLE">AVAILABLE</MenuItem>
                    <MenuItem value="UNAVAILABLE">UNAVAILABLE</MenuItem>
                  </TextField>
                </Stack>
                <TextField
                  label="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  multiline
                  minRows={2}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={isActive}
                      onChange={(event) =>
                        setIsActive(event.target.checked)
                      }
                    />
                  }
                  label="Active"
                />
                <Button
                  variant="contained"
                  disabled={
                    !equipmentTypeId ||
                    !equipmentCode.trim() ||
                    !equipmentName.trim() ||
                    equipmentMutation.isPending
                  }
                  onClick={() => equipmentMutation.mutate()}
                >
                  {newMode ? 'Create Equipment' : 'Save Equipment'}
                </Button>
              </>
            ) : null}

            {selected ? (
              <Alert
                severity={
                  selected.availability === 'UNAVAILABLE'
                    ? 'warning'
                    : 'info'
                }
              >
                Derived availability: <b>{selected.availability}</b>
                {selected.currentAssignment?.project
                  ? ' · Assigned to ' +
                    selected.currentAssignment.project.projectCode +
                    ' — ' +
                    selected.currentAssignment.project.projectName
                  : selected.currentAssignment?.restrictedProject
                    ? ' · Assigned to a Project outside your visible scope'
                    : ''}
              </Alert>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {selected ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Project Assignment History
              </Typography>
              {(assignments.data?.data ?? []).map((assignment) => (
                <Stack
                  key={assignment.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                >
                  <Typography sx={{ flexGrow: 1 }}>
                    {assignment.project.projectCode} —{' '}
                    {assignment.project.projectName} ·{' '}
                    {assignment.assignedFrom.slice(0, 10)}
                    {' → '}
                    {assignment.assignedTo?.slice(0, 10) ?? 'OPEN'}
                  </Typography>
                  {!assignment.assignedTo && canAssignmentManage ? (
                    <Button
                      onClick={() => releaseMutation.mutate(assignment.id)}
                      disabled={releaseMutation.isPending}
                    >
                      Release on {releaseDate}
                    </Button>
                  ) : null}
                </Stack>
              ))}
              {canAssignmentManage ? (
                <>
                  <Divider />
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                  >
                    <TextField
                      select
                      label="Assign to Project"
                      value={assignmentProjectId}
                      onChange={(event) =>
                        setAssignmentProjectId(event.target.value)
                      }
                      sx={{ minWidth: 260 }}
                    >
                      {(projects.data?.data ?? []).map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.projectCode} — {project.projectName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Assigned from"
                      type="date"
                      value={assignedFrom}
                      onChange={(event) =>
                        setAssignedFrom(event.target.value)
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      label="Remarks"
                      value={assignmentRemarks}
                      onChange={(event) =>
                        setAssignmentRemarks(event.target.value)
                      }
                      sx={{ flexGrow: 1 }}
                    />
                    <Button
                      variant="outlined"
                      disabled={
                        !assignmentProjectId ||
                        !assignedFrom ||
                        assignMutation.isPending
                      }
                      onClick={() => assignMutation.mutate()}
                    >
                      Assign / Reassign
                    </Button>
                  </Stack>
                  <TextField
                    label="Release date"
                    type="date"
                    value={releaseDate}
                    onChange={(event) => setReleaseDate(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ maxWidth: 220 }}
                  />
                </>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {selected ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
              >
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                  Equipment Usage History
                </Typography>
                {editingUsageId ? (
                  <Button onClick={clearUsageForm}>Cancel Edit</Button>
                ) : null}
              </Stack>

              {(usage.data?.data ?? []).map((row) => (
                <Stack
                  key={row.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                >
                  <Typography sx={{ flexGrow: 1 }}>
                    {row.usageDate.slice(0, 10)} ·{' '}
                    {row.project.projectCode} ·{' '}
                    {row.operatingHours
                      ? row.operatingHours + ' h'
                      : 'hours not recorded'}{' '}
                    · {row.sourceType}
                    {row.activity
                      ? ' · ' +
                        row.activity.activityCode +
                        ' ' +
                        row.activity.activityName
                      : ''}
                  </Typography>
                  {row.sourceType === 'MANUAL' && canUsageEdit ? (
                    <Button onClick={() => editUsage(row)}>Edit</Button>
                  ) : null}
                </Stack>
              ))}

              {(canUsageCreate || (editingUsageId && canUsageEdit)) ? (
                <>
                  <Divider />
                  <Typography variant="subtitle2">
                    {editingUsageId
                      ? 'Correct Manual Usage'
                      : 'Record Manual Usage'}
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                  >
                    <TextField
                      select
                      label="Project"
                      value={usageProjectId}
                      onChange={(event) => {
                        setUsageProjectId(event.target.value);
                        setUsageActivityId('');
                        setUsageWbsId('');
                      }}
                      sx={{ minWidth: 260 }}
                    >
                      {(projects.data?.data ?? []).map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.projectCode} — {project.projectName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Usage date"
                      type="date"
                      value={usageDate}
                      onChange={(event) => setUsageDate(event.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      label="Operating hours (optional)"
                      type="number"
                      value={operatingHours}
                      onChange={(event) =>
                        setOperatingHours(event.target.value)
                      }
                    />
                  </Stack>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                  >
                    <TextField
                      select
                      label="Activity (optional)"
                      value={usageActivityId}
                      onChange={(event) =>
                        setUsageActivityId(event.target.value)
                      }
                      sx={{ flex: 2 }}
                    >
                      <MenuItem value="">None</MenuItem>
                      {(usageOptions.data?.data.activities ?? []).map(
                        (activity) => (
                          <MenuItem key={activity.id} value={activity.id}>
                            {activity.activityCode} —{' '}
                            {activity.activityName}
                          </MenuItem>
                        ),
                      )}
                    </TextField>
                    <TextField
                      select
                      label="WBS (optional)"
                      value={usageWbsId}
                      onChange={(event) =>
                        setUsageWbsId(event.target.value)
                      }
                      sx={{ flex: 2 }}
                    >
                      <MenuItem value="">None</MenuItem>
                      {(usageOptions.data?.data.wbs ?? []).map((wbs) => (
                        <MenuItem key={wbs.id} value={wbs.id}>
                          {wbs.wbsCode} — {wbs.wbsName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Remarks"
                      value={usageRemarks}
                      onChange={(event) =>
                        setUsageRemarks(event.target.value)
                      }
                      sx={{ flex: 2 }}
                    />
                  </Stack>
                  <Button
                    variant="contained"
                    disabled={
                      !usageProjectId ||
                      !usageDate ||
                      usageMutation.isPending ||
                      (!editingUsageId && !canUsageCreate)
                    }
                    onClick={() => usageMutation.mutate()}
                  >
                    {editingUsageId ? 'Save Usage Correction' : 'Record Usage'}
                  </Button>
                </>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          Select an Equipment record to view assignments and usage history.
        </Alert>
      )}
    </Stack>
  );
}
