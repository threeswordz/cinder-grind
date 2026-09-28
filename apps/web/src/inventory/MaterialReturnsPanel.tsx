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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { inventoryApi } from '../api/inventory';

export function MaterialReturnsPanel({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const canCreate = permissions.includes('inventory.return.create');
  const canSubmit = permissions.includes('inventory.return.submit');
  const canApprove = permissions.includes('inventory.return.approve');
  const canReverse = permissions.includes('inventory.return.reverse');
  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [postKeys] = useState(() => new Map<string, string>());
  const [reversalKeys] = useState(() => new Map<string, string>());

  const projects = useQuery({
    queryKey: ['return-projects'],
    queryFn: inventoryApi.returnProjects,
  });
  const warehouses = useQuery({
    queryKey: ['return-warehouses', projectId],
    queryFn: () => inventoryApi.returnWarehouses(projectId),
    enabled: Boolean(projectId),
  });
  const eligible = useQuery({
    queryKey: ['eligible-return-issue-lines', projectId],
    queryFn: () => inventoryApi.eligibleReturnIssueLines(projectId),
    enabled: Boolean(projectId),
  });
  const returns = useQuery({
    queryKey: ['material-returns', projectId],
    queryFn: () => inventoryApi.materialReturns(projectId),
    enabled: Boolean(projectId),
  });
  const workflows = useQuery({
    queryKey: ['return-workflows'],
    queryFn: inventoryApi.returnWorkflows,
    enabled: canSubmit,
  });
  const detail = useQuery({
    queryKey: ['material-return', selectedId],
    queryFn: () => inventoryApi.materialReturn(selectedId),
    enabled: Boolean(selectedId),
  });
  const selectedSource = eligible.data?.data.find((row) => row.id === sourceId);
  const current = detail.data?.data;
  const validQuantity =
    /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(quantity) &&
    Number(quantity) > 0 &&
    (!selectedSource || Number(quantity) <= Number(selectedSource.returnable));

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['material-returns'] }),
      queryClient.invalidateQueries({ queryKey: ['material-return'] }),
      queryClient.invalidateQueries({ queryKey: ['eligible-return-issue-lines'] }),
      queryClient.invalidateQueries({ queryKey: ['issue-stock'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] }),
    ]);
  };
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<{ data: { id: string } }>) => action(),
    onSuccess: async (result) => {
      setMutationError(null);
      setSelectedId(result.data.id);
      await refresh();
    },
    onError: setMutationError,
  });
  const perform = (action: () => Promise<{ data: { id: string } }>) =>
    mutation.mutate(action);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Material Returns</Typography>
      <Alert severity="info">
        Returns must reference a posted Material Issue line. Cumulative non-reversed
        returns cannot exceed the issued quantity, and reversal cannot create negative
        or reserved-stock consumption.
      </Alert>
      {mutationError ? (
        <Alert severity="error">
          {mutationError instanceof Error ? mutationError.message : 'Request failed.'}
        </Alert>
      ) : null}

      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          setWarehouseId('');
          setSourceId('');
          setSelectedId('');
        }}
        sx={{ maxWidth: 520 }}
      >
        <MenuItem value="">Select Project</MenuItem>
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} — {project.projectName}
          </MenuItem>
        ))}
      </TextField>

      {projectId && canCreate ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Create Material Return Draft</Typography>
              <TextField
                select
                label="Posted Issue line"
                value={sourceId}
                onChange={(event) => {
                  const id = event.target.value;
                  setSourceId(id);
                  const source = eligible.data?.data.find((row) => row.id === id);
                  setQuantity(source?.returnable ?? '');
                  if (source && !warehouseId) setWarehouseId(source.materialIssue.warehouseId);
                }}
              >
                <MenuItem value="">Select Issue line</MenuItem>
                {(eligible.data?.data ?? []).map((row) => (
                  <MenuItem key={row.id} value={row.id}>
                    {row.materialIssue.issueNumber} · {row.material.materialCode} —{' '}
                    {row.material.materialName} · returnable {row.returnable} {row.uom.uomCode}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Destination Warehouse"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
              >
                <MenuItem value="">Select Warehouse</MenuItem>
                {(warehouses.data?.data ?? []).map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouseCode} — {warehouse.warehouseName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Return quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                inputMode="decimal"
                helperText={
                  selectedSource
                    ? 'Maximum remaining returnable: ' +
                      selectedSource.returnable +
                      ' ' +
                      selectedSource.uom.uomCode
                    : undefined
                }
              />
              <TextField
                label="Return date"
                type="date"
                value={returnDate}
                onChange={(event) => setReturnDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                multiline
                minRows={2}
              />
              <Button
                variant="contained"
                disabled={!selectedSource || !warehouseId || !validQuantity || !returnDate || mutation.isPending}
                onClick={() =>
                  selectedSource &&
                  perform(() =>
                    inventoryApi.createMaterialReturn({
                      projectId,
                      warehouseId,
                      returnDate,
                      remarks: remarks || null,
                      lines: [
                        {
                          materialIssueItemId: selectedSource.id,
                          quantity,
                        },
                      ],
                    }),
                  )
                }
              >
                Create Draft
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Return register</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(returns.data?.data ?? []).map((row) => (
                  <Chip
                    key={row.id}
                    label={
                      row.returnNumber +
                      ' · ' +
                      (row.reversedAt
                        ? 'REVERSED'
                        : row.postedAt
                          ? 'POSTED'
                          : row.approvalInstance?.approvalState ?? 'DRAFT')
                    }
                    color={selectedId === row.id ? 'primary' : 'default'}
                    variant={selectedId === row.id ? 'filled' : 'outlined'}
                    onClick={() => setSelectedId(row.id)}
                  />
                ))}
              </Stack>
              {returns.isSuccess && !returns.data.data.length ? (
                <Alert severity="info">No Material Returns for this Project.</Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {current ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">{current.returnNumber}</Typography>
              <Typography variant="body2">
                {(current.items ?? [])
                  .map(
                    (item) =>
                      (item.material?.materialCode ?? item.materialId) +
                      ': ' +
                      item.quantity +
                      ' ' +
                      (item.uom?.uomCode ?? ''),
                  )
                  .join(' · ')}
              </Typography>
              <Typography variant="body2">
                Stock movements:{' '}
                {current.stockTransactions
                  ?.map((row) => row.movementType + ' ' + row.quantity)
                  .join(' · ') || 'none'}
              </Typography>
              {canSubmit && !current.submittedAt ? (
                <Stack spacing={1}>
                  <TextField
                    select
                    label="Approval workflow"
                    value={workflowCode}
                    onChange={(event) => setWorkflowCode(event.target.value)}
                  >
                    <MenuItem value="">Select workflow</MenuItem>
                    {(workflows.data?.data ?? []).map((workflow) => (
                      <MenuItem key={workflow.workflowCode} value={workflow.workflowCode}>
                        {workflow.workflowName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    disabled={!workflowCode || mutation.isPending}
                    onClick={() =>
                      perform(() =>
                        inventoryApi.submitMaterialReturn(current.id, workflowCode),
                      )
                    }
                  >
                    Submit for approval
                  </Button>
                </Stack>
              ) : null}
              {canApprove &&
              current.approvalInstance?.approvalState === 'SUBMITTED' ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="contained"
                    disabled={mutation.isPending}
                    onClick={() => {
                      let key = postKeys.get(current.id);
                      if (!key) {
                        key = crypto.randomUUID();
                        postKeys.set(current.id, key);
                      }
                      perform(() =>
                        inventoryApi.approveMaterialReturn(current.id, key!),
                      );
                    }}
                  >
                    Approve and post
                  </Button>
                  <Button
                    disabled={mutation.isPending}
                    onClick={() =>
                      perform(() =>
                        inventoryApi.rejectMaterialReturn(
                          current.id,
                          'Rejected by approver',
                        ),
                      )
                    }
                  >
                    Reject
                  </Button>
                </Stack>
              ) : null}
              {canReverse && current.postedAt && !current.reversedAt ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label="Reversal reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    sx={{ flexGrow: 1 }}
                  />
                  <Button
                    disabled={!reason.trim() || mutation.isPending}
                    onClick={() => {
                      let key = reversalKeys.get(current.id);
                      if (!key) {
                        key = crypto.randomUUID();
                        reversalKeys.set(current.id, key);
                      }
                      perform(() =>
                        inventoryApi.reverseMaterialReturn(
                          current.id,
                          key!,
                          reason.trim(),
                        ),
                      );
                    }}
                  >
                    Reverse Return
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
