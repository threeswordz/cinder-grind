import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { equipmentApi } from '../api/equipment';
import {
  DelayLineInput,
  EquipmentUsageLineInput,
  InspectionLineInput,
  IssueLineInput,
  ManpowerLineInput,
  MaterialUsageLineInput,
  ProgressLineInput,
  siteExecutionApi,
} from '../api/site-execution';

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

const emptyManpower = (): ManpowerLineInput => ({
  tradeRole: '',
  headcount: 1,
  remarks: '',
});
const emptyMaterial = (): MaterialUsageLineInput => ({
  materialId: '',
  uomId: '',
  quantity: '',
  activityId: '',
  wbsId: '',
  remarks: '',
});
const emptyEquipment = (): EquipmentUsageLineInput => ({
  equipmentId: '',
  operatingHours: '',
  activityId: '',
  wbsId: '',
  remarks: '',
});
const emptyProgress = (): ProgressLineInput => ({
  activityId: '',
  percentComplete: '',
  note: '',
});
const emptyIssue = (): IssueLineInput => ({
  activityId: '',
  issueText: '',
  remarks: '',
});
const emptyDelay = (): DelayLineInput => ({
  activityId: '',
  delayReason: '',
  remarks: '',
});
const emptyInspection = (): InspectionLineInput => ({
  activityId: '',
  inspectionReference: '',
  remarks: '',
});

export function SiteExecutionPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const queryClient = useQueryClient();
  const canCreate = permissions.includes('site.daily_report.create');
  const canEdit = permissions.includes('site.daily_report.edit');
  const canSubmit = permissions.includes('site.daily_report.submit');

  const [projectId, setProjectId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reportDate, setReportDate] = useState(localDateValue());
  const [weatherObservation, setWeatherObservation] = useState('');
  const [generalRemarks, setGeneralRemarks] = useState('');
  const [manpower, setManpower] = useState<ManpowerLineInput[]>([]);
  const [materialUsage, setMaterialUsage] = useState<
    MaterialUsageLineInput[]
  >([]);
  const [equipmentUsage, setEquipmentUsage] = useState<
    EquipmentUsageLineInput[]
  >([]);
  const [progress, setProgress] = useState<ProgressLineInput[]>([]);
  const [issues, setIssues] = useState<IssueLineInput[]>([]);
  const [delays, setDelays] = useState<DelayLineInput[]>([]);
  const [inspections, setInspections] = useState<InspectionLineInput[]>([]);
  const [correctionNote, setCorrectionNote] = useState('');
  const [correctionProgress, setCorrectionProgress] = useState<
    ProgressLineInput[]
  >([]);
  const [correctionEquipment, setCorrectionEquipment] = useState<
    EquipmentUsageLineInput[]
  >([]);
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  const projects = useQuery({
    queryKey: ['site-execution', 'projects'],
    queryFn: siteExecutionApi.projects,
  });
  const options = useQuery({
    queryKey: ['site-execution', 'options', projectId],
    queryFn: () => siteExecutionApi.options(projectId),
    enabled: Boolean(projectId),
  });
  const reports = useQuery({
    queryKey: ['site-execution', 'reports', projectId],
    queryFn: () => siteExecutionApi.reports(projectId),
    enabled: Boolean(projectId),
  });
  const detail = useQuery({
    queryKey: ['site-execution', 'report', selectedId],
    queryFn: () => siteExecutionApi.report(selectedId),
    enabled: Boolean(selectedId),
  });
  const equipmentOptions = useQuery({
    queryKey: ['equipment', 'project-available', projectId, reportDate],
    queryFn: () => equipmentApi.projectEquipment(projectId, reportDate),
    enabled: Boolean(projectId && reportDate),
  });
  const documents = useQuery({
    queryKey: ['site-execution', 'documents', selectedId],
    queryFn: () => siteExecutionApi.documents(selectedId),
    enabled: Boolean(selectedId),
  });

  const report = detail.data?.data ?? null;
  const editable = !report || report.status === 'DRAFT';

  useEffect(() => {
    if (!report) return;
    setReportDate(report.reportDate.slice(0, 10));
    setWeatherObservation(report.weatherObservation ?? '');
    setGeneralRemarks(report.generalRemarks ?? '');
    setManpower(
      report.manpowerLines.map((line) => ({
        tradeRole: line.tradeRole,
        headcount: line.headcount,
        remarks: line.remarks ?? '',
      })),
    );
    setMaterialUsage(
      report.materialUsage.map((line) => ({
        materialId: line.materialId,
        uomId: line.uomId,
        quantity: line.quantity,
        activityId: line.activityId ?? '',
        wbsId: line.wbsId ?? '',
        remarks: line.remarks ?? '',
      })),
    );
    setEquipmentUsage(
      report.equipmentUsage.map((line) => ({
        equipmentId: line.equipmentId,
        operatingHours: line.operatingHours ?? '',
        activityId: line.activityId ?? '',
        wbsId: line.wbsId ?? '',
        remarks: line.remarks ?? '',
      })),
    );
    setProgress(
      report.progressLines.map((line) => ({
        activityId: line.activityId,
        percentComplete: line.percentComplete,
        note: line.note ?? '',
      })),
    );
    setIssues(
      report.issues.map((line) => ({
        activityId: line.activityId ?? '',
        issueText: line.issueText,
        remarks: line.remarks ?? '',
      })),
    );
    setDelays(
      report.delays.map((line) => ({
        activityId: line.activityId ?? '',
        delayReason: line.delayReason,
        remarks: line.remarks ?? '',
      })),
    );
    setInspections(
      report.inspections.map((line) => ({
        activityId: line.activityId ?? '',
        inspectionReference: line.inspectionReference ?? '',
        remarks: line.remarks ?? '',
      })),
    );
  }, [report]);

  const activityOptions = options.data?.data.activities ?? [];
  const wbsOptions = options.data?.data.wbs ?? [];
  const materialOptions = options.data?.data.materials ?? [];
  const uomOptions = options.data?.data.uoms ?? [];
  const documentTypes = options.data?.data.documentTypes ?? [];
  const equipmentChoices = equipmentOptions.data?.data ?? [];

  const payload = useMemo(
    () => ({
      reportDate,
      weatherObservation: weatherObservation || null,
      generalRemarks: generalRemarks || null,
      manpower: manpower.map((line) => ({
        ...line,
        remarks: line.remarks || null,
      })),
      materialUsage: materialUsage.map((line) => ({
        ...line,
        activityId: line.activityId || null,
        wbsId: line.wbsId || null,
        remarks: line.remarks || null,
      })),
      equipmentUsage: equipmentUsage.map((line) => ({
        ...line,
        operatingHours: line.operatingHours || null,
        activityId: line.activityId || null,
        wbsId: line.wbsId || null,
        remarks: line.remarks || null,
      })),
      progress: progress.map((line) => ({
        ...line,
        note: line.note || null,
      })),
      issues: issues.map((line) => ({
        ...line,
        activityId: line.activityId || null,
        remarks: line.remarks || null,
      })),
      delays: delays.map((line) => ({
        ...line,
        activityId: line.activityId || null,
        remarks: line.remarks || null,
      })),
      inspections: inspections.map((line) => ({
        ...line,
        activityId: line.activityId || null,
        inspectionReference: line.inspectionReference || null,
        remarks: line.remarks || null,
      })),
    }),
    [
      delays,
      generalRemarks,
      inspections,
      issues,
      manpower,
      materialUsage,
      equipmentUsage,
      progress,
      reportDate,
      weatherObservation,
    ],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      selectedId
        ? siteExecutionApi.update(selectedId, payload)
        : siteExecutionApi.create({
            projectId,
            ...payload,
            reportDate,
          }),
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['site-execution', 'reports', projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['site-execution', 'report', result.data.id],
        }),
      ]);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => siteExecutionApi.submit(selectedId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['site-execution', 'reports', projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['site-execution', 'report', selectedId],
        }),
      ]);
    },
  });

  const correctionMutation = useMutation({
    mutationFn: () =>
      siteExecutionApi.addCorrection(
        selectedId,
        correctionNote,
        correctionProgress.map((line) => ({
          ...line,
          note: line.note || null,
        })),
        correctionEquipment.map((line) => ({
          ...line,
          operatingHours: line.operatingHours || null,
          activityId: line.activityId || null,
          wbsId: line.wbsId || null,
          remarks: line.remarks || null,
        })),
      ),
    onSuccess: async () => {
      setCorrectionNote('');
      setCorrectionProgress([]);
      setCorrectionEquipment([]);
      await queryClient.invalidateQueries({
        queryKey: ['site-execution', 'report', selectedId],
      });
    },
  });

  const photoMutation = useMutation({
    mutationFn: () => {
      if (!photo) throw new Error('Select a file first.');
      return siteExecutionApi.uploadPhoto(
        selectedId,
        documentTypeId,
        photo,
      );
    },
    onSuccess: async () => {
      setPhoto(null);
      await queryClient.invalidateQueries({
        queryKey: ['site-execution', 'documents', selectedId],
      });
    },
  });

  const resetForNew = () => {
    setSelectedId('');
    setReportDate(localDateValue());
    setWeatherObservation('');
    setGeneralRemarks('');
    setManpower([]);
    setMaterialUsage([]);
    setEquipmentUsage([]);
    setProgress([]);
    setIssues([]);
    setDelays([]);
    setInspections([]);
    setCorrectionNote('');
    setCorrectionProgress([]);
    setCorrectionEquipment([]);
    setDocumentTypeId('');
    setPhoto(null);
  };

  const error =
    saveMutation.error ??
    submitMutation.error ??
    correctionMutation.error ??
    photoMutation.error;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Site Execution</Typography>

      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          resetForNew();
        }}
        fullWidth
      >
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} — {project.projectName}
          </MenuItem>
        ))}
      </TextField>

      {projectId ? (
        <>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {canCreate ? (
              <Button variant="outlined" onClick={resetForNew}>
                New Daily Report
              </Button>
            ) : null}
            {(reports.data?.data ?? []).map((item) => (
              <Button
                key={item.id}
                variant={selectedId === item.id ? 'contained' : 'outlined'}
                onClick={() => setSelectedId(item.id)}
              >
                {item.reportDate.slice(0, 10)} · {item.status}
              </Button>
            ))}
          </Stack>

          {options.data?.data.equipmentIntegration.available ? (
            <Alert severity="success">
              Equipment integration is active. Select only Equipment assigned
              to this Project on the reporting date.
            </Alert>
          ) : null}

          {error ? (
            <Alert severity="error">
              {error instanceof Error ? error.message : 'Request failed.'}
            </Alert>
          ) : null}

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ sm: 'center' }}
                >
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    {report
                      ? 'Daily Site Report · ' + report.reportDate.slice(0, 10)
                      : 'New Daily Site Report'}
                  </Typography>
                  {report ? (
                    <Chip label={report.status} size="small" />
                  ) : null}
                  {report ? (
                    <Chip
                      label={'Manpower ' + report.totalManpower}
                      size="small"
                    />
                  ) : null}
                </Stack>

                <TextField
                  label="Reporting date"
                  type="date"
                  value={reportDate}
                  onChange={(event) => setReportDate(event.target.value)}
                  disabled={!editable}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Weather observation"
                  value={weatherObservation}
                  onChange={(event) =>
                    setWeatherObservation(event.target.value)
                  }
                  disabled={!editable}
                  multiline
                  minRows={2}
                />
                <TextField
                  label="General site remarks"
                  value={generalRemarks}
                  onChange={(event) => setGeneralRemarks(event.target.value)}
                  disabled={!editable}
                  multiline
                  minRows={3}
                />

                <Divider />
                <Typography variant="subtitle1">Manpower</Typography>
                {manpower.map((line, index) => (
                  <Stack
                    key={index}
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                  >
                    <TextField
                      label="Trade / role"
                      value={line.tradeRole}
                      disabled={!editable}
                      onChange={(event) =>
                        setManpower((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, tradeRole: event.target.value }
                              : row,
                          ),
                        )
                      }
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Headcount"
                      type="number"
                      value={line.headcount}
                      disabled={!editable}
                      onChange={(event) =>
                        setManpower((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  headcount: Number(event.target.value),
                                }
                              : row,
                          ),
                        )
                      }
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Remarks"
                      value={line.remarks ?? ''}
                      disabled={!editable}
                      onChange={(event) =>
                        setManpower((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, remarks: event.target.value }
                              : row,
                          ),
                        )
                      }
                      sx={{ flex: 2 }}
                    />
                    {editable ? (
                      <Button
                        onClick={() =>
                          setManpower((rows) =>
                            rows.filter((_, rowIndex) => rowIndex !== index),
                          )
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </Stack>
                ))}
                {editable ? (
                  <Button
                    onClick={() =>
                      setManpower((rows) => [...rows, emptyManpower()])
                    }
                  >
                    Add manpower
                  </Button>
                ) : null}

                <Divider />
                <Typography variant="subtitle1">
                  Activity Progress
                </Typography>
                {progress.map((line, index) => (
                  <Stack
                    key={index}
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                  >
                    <TextField
                      select
                      label="Activity"
                      value={line.activityId}
                      disabled={!editable}
                      onChange={(event) =>
                        setProgress((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, activityId: event.target.value }
                              : row,
                          ),
                        )
                      }
                      sx={{ flex: 3 }}
                    >
                      {activityOptions.map((activity) => (
                        <MenuItem key={activity.id} value={activity.id}>
                          {activity.activityCode} — {activity.activityName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="% complete"
                      type="number"
                      value={line.percentComplete}
                      disabled={!editable}
                      onChange={(event) =>
                        setProgress((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  percentComplete: event.target.value,
                                }
                              : row,
                          ),
                        )
                      }
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Note"
                      value={line.note ?? ''}
                      disabled={!editable}
                      onChange={(event) =>
                        setProgress((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, note: event.target.value }
                              : row,
                          ),
                        )
                      }
                      sx={{ flex: 2 }}
                    />
                    {editable ? (
                      <Button
                        onClick={() =>
                          setProgress((rows) =>
                            rows.filter((_, rowIndex) => rowIndex !== index),
                          )
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </Stack>
                ))}
                {editable ? (
                  <Button
                    onClick={() =>
                      setProgress((rows) => [...rows, emptyProgress()])
                    }
                  >
                    Add progress
                  </Button>
                ) : null}

                <Divider />
                <Typography variant="subtitle1">
                  Material-use observations
                </Typography>
                {materialUsage.map((line, index) => (
                  <Card key={index} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1}
                        >
                          <TextField
                            select
                            label="Material"
                            value={line.materialId}
                            disabled={!editable}
                            onChange={(event) => {
                              const materialId = event.target.value;
                              const selected = materialOptions.find(
                                (material) => material.id === materialId,
                              );
                              setMaterialUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        materialId,
                                        uomId:
                                          selected?.defaultUomId ?? row.uomId,
                                      }
                                    : row,
                                ),
                              );
                            }}
                            sx={{ flex: 3 }}
                          >
                            {materialOptions.map((material) => (
                              <MenuItem
                                key={material.id}
                                value={material.id}
                              >
                                {material.materialCode} —{' '}
                                {material.materialName}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Quantity"
                            type="number"
                            value={line.quantity}
                            disabled={!editable}
                            onChange={(event) =>
                              setMaterialUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        quantity: event.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 1 }}
                          />
                          <TextField
                            select
                            label="UOM"
                            value={line.uomId}
                            disabled={!editable}
                            onChange={(event) =>
                              setMaterialUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, uomId: event.target.value }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 1 }}
                          >
                            {uomOptions.map((uom) => (
                              <MenuItem key={uom.id} value={uom.id}>
                                {uom.uomCode}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Stack>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1}
                        >
                          <TextField
                            select
                            label="Activity (optional)"
                            value={line.activityId ?? ''}
                            disabled={!editable}
                            onChange={(event) =>
                              setMaterialUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        activityId: event.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 2 }}
                          >
                            <MenuItem value="">None</MenuItem>
                            {activityOptions.map((activity) => (
                              <MenuItem
                                key={activity.id}
                                value={activity.id}
                              >
                                {activity.activityCode} —{' '}
                                {activity.activityName}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            label="WBS (optional)"
                            value={line.wbsId ?? ''}
                            disabled={!editable}
                            onChange={(event) =>
                              setMaterialUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, wbsId: event.target.value }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 2 }}
                          >
                            <MenuItem value="">None</MenuItem>
                            {wbsOptions.map((wbs) => (
                              <MenuItem key={wbs.id} value={wbs.id}>
                                {wbs.wbsCode} — {wbs.wbsName}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Remarks"
                            value={line.remarks ?? ''}
                            disabled={!editable}
                            onChange={(event) =>
                              setMaterialUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, remarks: event.target.value }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 2 }}
                          />
                          {editable ? (
                            <Button
                              onClick={() =>
                                setMaterialUsage((rows) =>
                                  rows.filter(
                                    (_, rowIndex) => rowIndex !== index,
                                  ),
                                )
                              }
                            >
                              Remove
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {editable ? (
                  <Button
                    onClick={() =>
                      setMaterialUsage((rows) => [
                        ...rows,
                        emptyMaterial(),
                      ])
                    }
                  >
                    Add material observation
                  </Button>
                ) : null}

                <Divider />
                <Typography variant="subtitle1">
                  Equipment Used
                </Typography>
                {equipmentUsage.map((line, index) => (
                  <Card key={index} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1}
                        >
                          <TextField
                            select
                            label="Equipment"
                            value={line.equipmentId}
                            disabled={!editable}
                            onChange={(event) =>
                              setEquipmentUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        equipmentId: event.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 3 }}
                          >
                            {equipmentChoices.map((choice) => (
                              <MenuItem
                                key={choice.equipment.id}
                                value={choice.equipment.id}
                              >
                                {choice.equipment.equipmentCode} —{' '}
                                {choice.equipment.equipmentName}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Operating hours (optional)"
                            type="number"
                            value={line.operatingHours ?? ''}
                            disabled={!editable}
                            onChange={(event) =>
                              setEquipmentUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        operatingHours: event.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 1 }}
                          />
                        </Stack>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1}
                        >
                          <TextField
                            select
                            label="Activity (optional)"
                            value={line.activityId ?? ''}
                            disabled={!editable}
                            onChange={(event) =>
                              setEquipmentUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        activityId: event.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 2 }}
                          >
                            <MenuItem value="">None</MenuItem>
                            {activityOptions.map((activity) => (
                              <MenuItem
                                key={activity.id}
                                value={activity.id}
                              >
                                {activity.activityCode} —{' '}
                                {activity.activityName}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            label="WBS (optional)"
                            value={line.wbsId ?? ''}
                            disabled={!editable}
                            onChange={(event) =>
                              setEquipmentUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, wbsId: event.target.value }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 2 }}
                          >
                            <MenuItem value="">None</MenuItem>
                            {wbsOptions.map((wbs) => (
                              <MenuItem key={wbs.id} value={wbs.id}>
                                {wbs.wbsCode} — {wbs.wbsName}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Remarks"
                            value={line.remarks ?? ''}
                            disabled={!editable}
                            onChange={(event) =>
                              setEquipmentUsage((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, remarks: event.target.value }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 2 }}
                          />
                          {editable ? (
                            <Button
                              onClick={() =>
                                setEquipmentUsage((rows) =>
                                  rows.filter(
                                    (_, rowIndex) => rowIndex !== index,
                                  ),
                                )
                              }
                            >
                              Remove
                            </Button>
                          ) : null}
                        </Stack>
                        {!editable && report?.equipmentUsage[index]?.equipmentUsage ? (
                          <Typography variant="caption" color="text.secondary">
                            Canonical usage recorded ·{' '}
                            {report.equipmentUsage[index]?.equipmentUsage?.sourceType}
                          </Typography>
                        ) : null}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {editable ? (
                  <Button
                    onClick={() =>
                      setEquipmentUsage((rows) => [
                        ...rows,
                        emptyEquipment(),
                      ])
                    }
                  >
                    Add Equipment
                  </Button>
                ) : null}

                <Divider />
                <SiteTextLines
                  title="Site Issues"
                  addLabel="Add issue"
                  editable={editable}
                  rows={issues}
                  activities={activityOptions}
                  primaryLabel="Issue"
                  primaryKey="issueText"
                  onChange={setIssues}
                  createEmpty={emptyIssue}
                />
                <Divider />
                <SiteTextLines
                  title="Delay Reasons"
                  addLabel="Add delay"
                  editable={editable}
                  rows={delays}
                  activities={activityOptions}
                  primaryLabel="Delay reason"
                  primaryKey="delayReason"
                  onChange={setDelays}
                  createEmpty={emptyDelay}
                />

                <Divider />
                <Typography variant="subtitle1">Inspections</Typography>
                {inspections.map((line, index) => (
                  <Stack
                    key={index}
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                  >
                    <TextField
                      select
                      label="Activity (optional)"
                      value={line.activityId ?? ''}
                      disabled={!editable}
                      onChange={(event) =>
                        setInspections((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, activityId: event.target.value }
                              : row,
                          ),
                        )
                      }
                      sx={{ flex: 2 }}
                    >
                      <MenuItem value="">None</MenuItem>
                      {activityOptions.map((activity) => (
                        <MenuItem key={activity.id} value={activity.id}>
                          {activity.activityCode} — {activity.activityName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Inspection reference"
                      value={line.inspectionReference ?? ''}
                      disabled={!editable}
                      onChange={(event) =>
                        setInspections((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  inspectionReference: event.target.value,
                                }
                              : row,
                          ),
                        )
                      }
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Remarks"
                      value={line.remarks ?? ''}
                      disabled={!editable}
                      onChange={(event) =>
                        setInspections((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, remarks: event.target.value }
                              : row,
                          ),
                        )
                      }
                      sx={{ flex: 2 }}
                    />
                    {editable ? (
                      <Button
                        onClick={() =>
                          setInspections((rows) =>
                            rows.filter((_, rowIndex) => rowIndex !== index),
                          )
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </Stack>
                ))}
                {editable ? (
                  <Button
                    onClick={() =>
                      setInspections((rows) => [
                        ...rows,
                        emptyInspection(),
                      ])
                    }
                  >
                    Add inspection
                  </Button>
                ) : null}

                {editable && (selectedId ? canEdit : canCreate) ? (
                  <Button
                    variant="contained"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    {selectedId ? 'Save Draft' : 'Create Draft'}
                  </Button>
                ) : null}

                {report?.status === 'DRAFT' && canSubmit ? (
                  <Button
                    variant="contained"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                  >
                    Submit Daily Report
                  </Button>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          {selectedId ? (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">
                    Site photographs / documents
                  </Typography>
                  {(documents.data?.data ?? []).map((document) => (
                    <Stack
                      key={document.id}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                    >
                      <Typography sx={{ flexGrow: 1 }}>
                        {document.fileName} ·{' '}
                        {document.documentType.documentTypeName}
                      </Typography>
                      <Button
                        onClick={async () => {
                          const result =
                            await siteExecutionApi.downloadDocument(
                              selectedId,
                              document.id,
                            );
                          const url = URL.createObjectURL(result.blob);
                          const anchor = window.document.createElement('a');
                          anchor.href = url;
                          anchor.download =
                            result.fileName ?? document.fileName;
                          anchor.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        Download
                      </Button>
                    </Stack>
                  ))}
                  {report?.status === 'DRAFT' && canEdit ? (
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ sm: 'center' }}
                    >
                      <TextField
                        select
                        label="Document type"
                        value={documentTypeId}
                        onChange={(event) =>
                          setDocumentTypeId(event.target.value)
                        }
                        sx={{ minWidth: 220 }}
                      >
                        {documentTypes.map((type) => (
                          <MenuItem key={type.id} value={type.id}>
                            {type.documentTypeName}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button component="label">
                        {photo ? photo.name : 'Select photo / file'}
                        <input
                          hidden
                          type="file"
                          onChange={(event) =>
                            setPhoto(event.target.files?.[0] ?? null)
                          }
                        />
                      </Button>
                      <Button
                        variant="outlined"
                        disabled={
                          !photo ||
                          !documentTypeId ||
                          photoMutation.isPending
                        }
                        onClick={() => photoMutation.mutate()}
                      >
                        Upload
                      </Button>
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          {report?.status === 'SUBMITTED' ? (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">
                    Submitted Report Corrections
                  </Typography>
                  {report.corrections.length === 0 ? (
                    <Typography color="text.secondary">
                      No corrections recorded.
                    </Typography>
                  ) : (
                    report.corrections.map((correction) => (
                      <Box key={correction.id}>
                        <Typography variant="body2">
                          {correction.correctionNote}
                        </Typography>
                        {correction.progressCorrections.map((entry) => (
                          <Typography
                            key={entry.id}
                            variant="body2"
                            color="text.secondary"
                          >
                            {entry.activity.activityCode} —{' '}
                            {entry.activity.activityName}: {entry.percentComplete}%
                            {entry.note ? ' · ' + entry.note : ''}
                          </Typography>
                        ))}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {correction.createdBy.displayName} ·{' '}
                          {new Date(correction.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                    ))
                  )}
                  {canEdit ? (
                    <Stack spacing={1}>
                      <TextField
                        label="Append correction"
                        value={correctionNote}
                        onChange={(event) =>
                          setCorrectionNote(event.target.value)
                        }
                        fullWidth
                      />
                      {correctionProgress.map((line, index) => (
                        <Stack
                          key={index}
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1}
                        >
                          <TextField
                            select
                            label="Correct Activity progress"
                            value={line.activityId}
                            onChange={(event) =>
                              setCorrectionProgress((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        activityId: event.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 3 }}
                          >
                            {activityOptions.map((activity) => (
                              <MenuItem
                                key={activity.id}
                                value={activity.id}
                              >
                                {activity.activityCode} —{' '}
                                {activity.activityName}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Corrected %"
                            type="number"
                            value={line.percentComplete}
                            onChange={(event) =>
                              setCorrectionProgress((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        percentComplete: event.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 1 }}
                          />
                          <TextField
                            label="Progress correction note"
                            value={line.note ?? ''}
                            onChange={(event) =>
                              setCorrectionProgress((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, note: event.target.value }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 2 }}
                          />
                          <Button
                            onClick={() =>
                              setCorrectionProgress((rows) =>
                                rows.filter(
                                  (_, rowIndex) => rowIndex !== index,
                                ),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </Stack>
                      ))}
                      <Typography variant="subtitle2">
                        Equipment usage corrections
                      </Typography>
                      {correctionEquipment.map((line, index) => (
                        <Stack
                          key={index}
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1}
                        >
                          <TextField
                            select
                            label="Equipment"
                            value={line.equipmentId}
                            onChange={(event) =>
                              setCorrectionEquipment((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        equipmentId: event.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 3 }}
                          >
                            {equipmentChoices.map((choice) => (
                              <MenuItem
                                key={choice.equipment.id}
                                value={choice.equipment.id}
                              >
                                {choice.equipment.equipmentCode} —{' '}
                                {choice.equipment.equipmentName}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Hours (optional)"
                            type="number"
                            value={line.operatingHours ?? ''}
                            onChange={(event) =>
                              setCorrectionEquipment((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        operatingHours: event.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 1 }}
                          />
                          <TextField
                            label="Correction remarks"
                            value={line.remarks ?? ''}
                            onChange={(event) =>
                              setCorrectionEquipment((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, remarks: event.target.value }
                                    : row,
                                ),
                              )
                            }
                            sx={{ flex: 2 }}
                          />
                          <Button
                            onClick={() =>
                              setCorrectionEquipment((rows) =>
                                rows.filter(
                                  (_, rowIndex) => rowIndex !== index,
                                ),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </Stack>
                      ))}
                      <Button
                        onClick={() =>
                          setCorrectionEquipment((rows) => [
                            ...rows,
                            emptyEquipment(),
                          ])
                        }
                      >
                        Add Equipment correction
                      </Button>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                      >
                        <Button
                          onClick={() =>
                            setCorrectionProgress((rows) => [
                              ...rows,
                              emptyProgress(),
                            ])
                          }
                        >
                          Add progress correction
                        </Button>
                        <Button
                          variant="outlined"
                          disabled={
                            !correctionNote.trim() ||
                            correctionMutation.isPending
                          }
                          onClick={() => correctionMutation.mutate()}
                        >
                          Add Correction
                        </Button>
                      </Stack>
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <Alert severity="info">
          Select a Project to work with Daily Site Reports.
        </Alert>
      )}
    </Stack>
  );
}

function SiteTextLines<
  T extends
    | IssueLineInput
    | DelayLineInput,
>({
  title,
  addLabel,
  editable,
  rows,
  activities,
  primaryLabel,
  primaryKey,
  onChange,
  createEmpty,
}: {
  title: string;
  addLabel: string;
  editable: boolean;
  rows: T[];
  activities: Array<{
    id: string;
    activityCode: string;
    activityName: string;
  }>;
  primaryLabel: string;
  primaryKey: 'issueText' | 'delayReason';
  onChange: (rows: T[]) => void;
  createEmpty: () => T;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1">{title}</Typography>
      {rows.map((line, index) => (
        <Stack
          key={index}
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
        >
          <TextField
            select
            label="Activity (optional)"
            value={line.activityId ?? ''}
            disabled={!editable}
            onChange={(event) =>
              onChange(
                rows.map((row, rowIndex) =>
                  rowIndex === index
                    ? ({ ...row, activityId: event.target.value } as T)
                    : row,
                ),
              )
            }
            sx={{ flex: 2 }}
          >
            <MenuItem value="">None</MenuItem>
            {activities.map((activity) => (
              <MenuItem key={activity.id} value={activity.id}>
                {activity.activityCode} — {activity.activityName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={primaryLabel}
            value={
              primaryKey === 'issueText'
                ? (line as IssueLineInput).issueText
                : (line as DelayLineInput).delayReason
            }
            disabled={!editable}
            onChange={(event) =>
              onChange(
                rows.map((row, rowIndex) =>
                  rowIndex === index
                    ? ({
                        ...row,
                        [primaryKey]: event.target.value,
                      } as T)
                    : row,
                ),
              )
            }
            sx={{ flex: 3 }}
          />
          <TextField
            label="Remarks"
            value={line.remarks ?? ''}
            disabled={!editable}
            onChange={(event) =>
              onChange(
                rows.map((row, rowIndex) =>
                  rowIndex === index
                    ? ({ ...row, remarks: event.target.value } as T)
                    : row,
                ),
              )
            }
            sx={{ flex: 2 }}
          />
          {editable ? (
            <Button
              onClick={() =>
                onChange(rows.filter((_, rowIndex) => rowIndex !== index))
              }
            >
              Remove
            </Button>
          ) : null}
        </Stack>
      ))}
      {editable ? (
        <Button onClick={() => onChange([...rows, createEmpty()])}>
          {addLabel}
        </Button>
      ) : null}
    </Stack>
  );
}
