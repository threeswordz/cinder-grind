import {
  Alert,
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

import {
  procurementApi,
  PurchaseRequestLine,
} from '../api/procurement';

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

export function PurchaseRequestsPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const queryClient = useQueryClient();
  const canView = permissions.includes('procurement.pr.view');
  const canManage = permissions.includes('procurement.pr.manage');
  const canSubmit = permissions.includes('procurement.pr.submit');
  const canApprove = permissions.includes('procurement.pr.approve');
  const canCancel = permissions.includes('procurement.pr.cancel');

  const [projectId, setProjectId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [approvalComment, setApprovalComment] = useState('');

  const [editingLineId, setEditingLineId] = useState('');
  const [lineType, setLineType] = useState<'MATERIAL' | 'SERVICE'>('MATERIAL');
  const [materialId, setMaterialId] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [uomId, setUomId] = useState('');
  const [wbsId, setWbsId] = useState('');
  const [costCodeId, setCostCodeId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [requiredOnSite, setRequiredOnSite] = useState('');

  const projects = useQuery({
    queryKey: ['procurement', 'projects'],
    queryFn: procurementApi.projects,
    enabled: canView,
  });
  const options = useQuery({
    queryKey: ['procurement', 'options', projectId],
    queryFn: () => procurementApi.options(projectId),
    enabled: Boolean(canView && projectId),
  });
  const requests = useQuery({
    queryKey: ['procurement', 'requests', projectId],
    queryFn: () => procurementApi.requests(projectId),
    enabled: Boolean(canView && projectId),
  });
  const selected = useQuery({
    queryKey: ['procurement', 'request', requestId],
    queryFn: () => procurementApi.request(requestId),
    enabled: Boolean(canView && requestId),
  });
  const workflows = useQuery({
    queryKey: ['procurement', 'workflows'],
    queryFn: procurementApi.workflows,
    enabled: canSubmit,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['procurement'] });
  };

  const createRequest = useMutation({
    mutationFn: (initialRemarks: string | null) =>
      procurementApi.createRequest(projectId, initialRemarks),
    onSuccess: async (result) => {
      setRequestId(result.data.id);
      await refresh();
    },
  });
  const saveHeader = useMutation({
    mutationFn: () =>
      procurementApi.updateRequest(requestId, remarks.trim() || null),
    onSuccess: refresh,
  });
  const copyRejected = useMutation({
    mutationFn: () => procurementApi.copyRejected(requestId),
    onSuccess: async (result) => {
      setRequestId(result.data.id);
      await refresh();
    },
  });
  const saveLine = useMutation({
    mutationFn: () => {
      const body = {
        lineType,
        materialId: lineType === 'MATERIAL' ? materialId : null,
        ...(lineType === 'SERVICE' ? { description: description.trim() } : {}),
        quantity,
        uomId,
        wbsId: wbsId || null,
        costCodeId: costCodeId || null,
        activityId: activityId || null,
        requiredOnSite: requiredOnSite || null,
      };
      return editingLineId
        ? procurementApi.updateLine(editingLineId, body)
        : procurementApi.createLine(requestId, body);
    },
    onSuccess: async () => {
      clearLine();
      await refresh();
    },
  });
  const deleteLine = useMutation({
    mutationFn: (lineId: string) => procurementApi.deleteLine(lineId),
    onSuccess: refresh,
  });
  const submit = useMutation({
    mutationFn: () => procurementApi.submit(requestId, workflowCode),
    onSuccess: refresh,
  });
  const approve = useMutation({
    mutationFn: () =>
      procurementApi.approve(requestId, approvalComment.trim() || null),
    onSuccess: async () => {
      setApprovalComment('');
      await refresh();
    },
  });
  const reject = useMutation({
    mutationFn: () =>
      procurementApi.reject(requestId, approvalComment.trim() || null),
    onSuccess: async () => {
      setApprovalComment('');
      await refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: () => procurementApi.cancel(requestId),
    onSuccess: refresh,
  });

  const current = selected.data?.data ?? null;
  const isDraft = current?.lifecycleState === 'DRAFT';
  const isSubmitted = current?.lifecycleState === 'SUBMITTED';
  const isRejected = current?.lifecycleState === 'REJECTED';
  const canCancelCurrent =
    Boolean(current) &&
    current?.lifecycleState !== 'CANCELLED' &&
    current?.lifecycleState !== 'REJECTED';

  useEffect(() => {
    setRemarks(current?.remarks ?? '');
  }, [current?.id, current?.remarks]);

  useEffect(() => {
    if (
      workflowCode &&
      !(workflows.data?.data ?? []).some(
        (workflow) => workflow.workflowCode === workflowCode,
      )
    ) {
      setWorkflowCode('');
    }
  }, [workflowCode, workflows.data?.data]);

  const materialById = useMemo(
    () =>
      new Map(
        (options.data?.data.materials ?? []).map((material) => [
          material.id,
          material,
        ]),
      ),
    [options.data?.data.materials],
  );

  function clearLine() {
    setEditingLineId('');
    setLineType('MATERIAL');
    setMaterialId('');
    setDescription('');
    setQuantity('');
    setUomId('');
    setWbsId('');
    setCostCodeId('');
    setActivityId('');
    setRequiredOnSite('');
  }

  function editLine(line: PurchaseRequestLine) {
    setEditingLineId(line.id);
    setLineType(line.lineType);
    setMaterialId(line.materialId ?? '');
    setDescription(line.lineType === 'SERVICE' ? line.description : '');
    setQuantity(line.quantity);
    setUomId(line.uomId);
    setWbsId(line.wbsId ?? '');
    setCostCodeId(line.costCodeId ?? '');
    setActivityId(line.activityId ?? '');
    setRequiredOnSite(dateValue(line.requiredOnSite));
  }

  const mutationError =
    createRequest.error ??
    saveHeader.error ??
    copyRejected.error ??
    saveLine.error ??
    deleteLine.error ??
    submit.error ??
    approve.error ??
    reject.error ??
    cancel.error;

  if (!canView) {
    return (
      <Alert severity="warning">
        Purchase Request view permission is required to use this workspace.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Purchase Requests</Typography>

      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          setRequestId('');
          setRemarks('');
          clearLine();
        }}
      >
        <MenuItem value="">Select Project</MenuItem>
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} · {project.projectName}
          </MenuItem>
        ))}
      </TextField>

      {mutationError ? (
        <Alert severity="error">
          {mutationError instanceof Error
            ? mutationError.message
            : 'Purchase Request action failed.'}
        </Alert>
      ) : null}

      {!projectId ? (
        <Alert severity="info">
          Select a Project to view and maintain its Purchase Requests.
        </Alert>
      ) : null}

      {projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
              >
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                  Purchase Request history
                </Typography>
                {canManage ? (
                  <Button
                    variant="contained"
                    disabled={createRequest.isPending}
                    onClick={() => {
                      setRemarks('');
                      createRequest.mutate(null);
                    }}
                  >
                    New PR
                  </Button>
                ) : null}
              </Stack>

              {(requests.data?.data ?? []).length === 0 &&
              !requests.isLoading ? (
                <Typography color="text.secondary">
                  No Purchase Requests have been created for this Project.
                </Typography>
              ) : null}

              {(requests.data?.data ?? []).map((row) => (
                <Stack
                  key={row.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                  sx={{
                    border: 1,
                    borderColor:
                      row.id === requestId ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    p: 1.5,
                  }}
                >
                  <Typography sx={{ flexGrow: 1 }}>
                    {row.prNumber} · {row._count.lines} line
                    {row._count.lines === 1 ? '' : 's'}
                  </Typography>
                  {row.sourceRequest ? (
                    <Typography variant="body2" color="text.secondary">
                      copied from {row.sourceRequest.prNumber}
                    </Typography>
                  ) : null}
                  <Chip size="small" label={row.lifecycleState} />
                  <Button
                    size="small"
                    onClick={() => {
                      setRequestId(row.id);
                      clearLine();
                    }}
                  >
                    Open
                  </Button>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {current ? (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                >
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    {current.prNumber}
                  </Typography>
                  <Chip label={current.lifecycleState} />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  {current.project.projectCode} · {current.project.projectName}
                </Typography>

                {current.sourceRequest ? (
                  <Alert severity="info">
                    This Draft was copied from rejected request{' '}
                    {current.sourceRequest.prNumber}.
                  </Alert>
                ) : null}

                <TextField
                  label="Remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  multiline
                  minRows={2}
                  disabled={!isDraft || !canManage}
                />

                {isDraft && canManage ? (
                  <Button
                    onClick={() => saveHeader.mutate()}
                    disabled={saveHeader.isPending}
                  >
                    Save remarks
                  </Button>
                ) : null}

                {current.cancelledAt ? (
                  <Typography variant="body2" color="text.secondary">
                    Cancelled {dateValue(current.cancelledAt)}
                    {current.cancelledBy
                      ? ' by ' + current.cancelledBy.displayName
                      : ''}
                  </Typography>
                ) : current.submittedAt ? (
                  <Typography variant="body2" color="text.secondary">
                    Submitted {dateValue(current.submittedAt)}
                    {current.submittedBy
                      ? ' by ' + current.submittedBy.displayName
                      : ''}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Created by {current.createdBy.displayName}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Demand lines</Typography>

                {current.lines.map((line) => (
                  <Stack
                    key={line.id}
                    spacing={1}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ sm: 'center' }}
                    >
                      <Typography sx={{ flexGrow: 1 }}>
                        {line.lineNo}.{' '}
                        {line.material
                          ? line.material.materialCode +
                            ' · ' +
                            line.description
                          : line.description}
                      </Typography>
                      <Chip size="small" label={line.lineType} />
                      {isDraft && canManage ? (
                        <>
                          <Button size="small" onClick={() => editLine(line)}>
                            Edit
                          </Button>
                          <Button
                            size="small"
                            onClick={() => deleteLine.mutate(line.id)}
                            disabled={deleteLine.isPending}
                          >
                            Remove
                          </Button>
                        </>
                      ) : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {line.quantity} {line.uom.uomCode}
                      {line.wbs
                        ? ' · WBS ' + line.wbs.wbsCode
                        : ' · Unallocated WBS'}
                      {line.costCode
                        ? ' · Cost ' + line.costCode.costCode
                        : ' · Unallocated Cost Code'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Required on Site: {dateValue(line.requiredOnSite) || '—'}
                      {line.activity
                        ? ' · Activity ' + line.activity.activityCode
                        : ''}
                    </Typography>
                  </Stack>
                ))}

                {current.lines.length === 0 ? (
                  <Typography color="text.secondary">
                    Add at least one demand line before submission.
                  </Typography>
                ) : null}

                {isDraft && canManage ? (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">
                      {editingLineId ? 'Edit line' : 'Add line'}
                    </Typography>
                    <TextField
                      select
                      label="Line type"
                      value={lineType}
                      onChange={(event) => {
                        const next = event.target.value as
                          | 'MATERIAL'
                          | 'SERVICE';
                        setLineType(next);
                        if (next === 'SERVICE') setMaterialId('');
                        if (next === 'MATERIAL') setDescription('');
                      }}
                    >
                      <MenuItem value="MATERIAL">Material</MenuItem>
                      <MenuItem value="SERVICE">Service</MenuItem>
                    </TextField>

                    {lineType === 'MATERIAL' ? (
                      <TextField
                        select
                        label="Material"
                        value={materialId}
                        onChange={(event) => {
                          const nextId = event.target.value;
                          setMaterialId(nextId);
                          const material = materialById.get(nextId);
                          if (material) setUomId(material.defaultUomId);
                        }}
                      >
                        <MenuItem value="">Select Material</MenuItem>
                        {(options.data?.data.materials ?? []).map((material) => (
                          <MenuItem key={material.id} value={material.id}>
                            {material.materialCode} · {material.materialName}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField
                        label="Service description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                      />
                    )}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        label="Quantity"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        select
                        label="UOM"
                        value={uomId}
                        onChange={(event) => setUomId(event.target.value)}
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="">Select UOM</MenuItem>
                        {(options.data?.data.uoms ?? []).map((uom) => (
                          <MenuItem key={uom.id} value={uom.id}>
                            {uom.uomCode} · {uom.uomName}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        select
                        label="WBS"
                        value={wbsId}
                        onChange={(event) => setWbsId(event.target.value)}
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="">Unallocated</MenuItem>
                        {(options.data?.data.wbs ?? []).map((wbs) => (
                          <MenuItem key={wbs.id} value={wbs.id}>
                            {wbs.wbsCode} · {wbs.wbsName}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label="Cost Code"
                        value={costCodeId}
                        onChange={(event) => setCostCodeId(event.target.value)}
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="">Unallocated</MenuItem>
                        {(options.data?.data.costCodes ?? []).map((cost) => (
                          <MenuItem key={cost.id} value={cost.id}>
                            {cost.costCode} · {cost.costName}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        type="date"
                        label="Required on Site"
                        value={requiredOnSite}
                        onChange={(event) =>
                          setRequiredOnSite(event.target.value)
                        }
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        select
                        label="Activity (optional)"
                        value={activityId}
                        onChange={(event) => setActivityId(event.target.value)}
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="">No Activity</MenuItem>
                        {(options.data?.data.activities ?? []).map(
                          (activity) => (
                            <MenuItem key={activity.id} value={activity.id}>
                              {activity.activityCode} · {activity.activityName}
                            </MenuItem>
                          ),
                        )}
                      </TextField>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        onClick={() => saveLine.mutate()}
                        disabled={
                          saveLine.isPending ||
                          !quantity ||
                          !uomId ||
                          (lineType === 'MATERIAL' && !materialId) ||
                          (lineType === 'SERVICE' && !description.trim())
                        }
                      >
                        {editingLineId ? 'Save line' : 'Add line'}
                      </Button>
                      {editingLineId ? (
                        <Button onClick={clearLine}>Cancel edit</Button>
                      ) : null}
                    </Stack>
                  </>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Workflow</Typography>

                {isDraft && canSubmit ? (
                  <>
                    <TextField
                      select
                      label="Approval workflow"
                      value={workflowCode}
                      onChange={(event) =>
                        setWorkflowCode(event.target.value)
                      }
                    >
                      <MenuItem value="">Select workflow</MenuItem>
                      {(workflows.data?.data ?? []).map((workflow) => (
                        <MenuItem
                          key={workflow.id}
                          value={workflow.workflowCode}
                        >
                          {workflow.workflowName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      disabled={
                        !workflowCode ||
                        current.lines.length === 0 ||
                        submit.isPending
                      }
                      onClick={() => submit.mutate()}
                    >
                      Submit for approval
                    </Button>
                  </>
                ) : null}

                {isSubmitted && canApprove ? (
                  <>
                    <TextField
                      label="Approval comment"
                      value={approvalComment}
                      onChange={(event) =>
                        setApprovalComment(event.target.value)
                      }
                      multiline
                      minRows={2}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        variant="contained"
                        onClick={() => approve.mutate()}
                        disabled={approve.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => reject.mutate()}
                        disabled={reject.isPending}
                      >
                        Reject
                      </Button>
                    </Stack>
                  </>
                ) : null}

                {isRejected && canManage ? (
                  <Button
                    variant="contained"
                    onClick={() => copyRejected.mutate()}
                    disabled={copyRejected.isPending}
                  >
                    Copy rejected PR to new Draft
                  </Button>
                ) : null}

                {canCancel && canCancelCurrent ? (
                  <>
                    <Divider />
                    <Button
                      onClick={() => cancel.mutate()}
                      disabled={cancel.isPending}
                    >
                      Cancel Purchase Request
                    </Button>
                  </>
                ) : null}

                {!isDraft &&
                !isSubmitted &&
                !isRejected &&
                !canCancelCurrent ? (
                  <Typography color="text.secondary">
                    This Purchase Request is retained history.
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
