import { useContext } from 'react';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';
import { transferCustodyLabels } from './transfer-custody-labels';
import { transferCustodyApi, transferRoot, transferDestinationPath } from '../api/transfer-custody';
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
import { useEffect, useState } from 'react';

import { inventoryApi } from '../api/inventory';

export function StockTransfersPanel({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const t = transferCustodyLabels[useContext(MonetaryLocaleContext)];
  const [employeeId, setEmployeeId] = useState('');
  const [assignmentProject, setAssignmentProject] = useState('');
  const [custodyIntent, setCustodyIntent] = useState<{ path: string; body: unknown } | null>(null);
  const custodyCommand = useMutation({mutationFn:(intent:{path:string;body:unknown})=>transferCustodyApi.command(intent.path,intent.body),retry:false,onSuccess:async()=>{setCustodyIntent(null);await queryClient.invalidateQueries({queryKey:['stock-transfer']});await queryClient.invalidateQueries({queryKey:['stock-balances']});await queryClient.invalidateQueries({queryKey:['transfer-custody']});}});
  const sendCustody=(path:string,body:unknown)=>{if(custodyIntent)return;const intent={path,body};setCustodyIntent(intent);custodyCommand.mutate(intent);};
  const canCreate = permissions.includes('inventory.transfer.create');
  const canEdit = permissions.includes('inventory.transfer.edit');
  const canSubmit = permissions.includes('inventory.transfer.submit');
  const canApprove = permissions.includes('inventory.transfer.approve');
  const canReverse = permissions.includes('inventory.transfer.reverse');

  const [sourceProjectId, setSourceProjectId] = useState('');
  const [destinationProjectId, setDestinationProjectId] = useState('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [stockKey, setStockKey] = useState('');
  const [quantity, setQuantity] = useState('');
  const [transferDate, setTransferDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [remarks, setRemarks] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [draftRemarks, setDraftRemarks] = useState('');
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [postKeys] = useState(() => new Map<string, string>());
  const [reversalKeys] = useState(() => new Map<string, string>());

  const projects = useQuery({
    queryKey: ['transfer-projects'],
    queryFn: inventoryApi.transferProjects,
  });
  const sourceWarehouses = useQuery({
    queryKey: ['transfer-warehouses', sourceProjectId],
    queryFn: () => inventoryApi.transferWarehouses(sourceProjectId),
    enabled: Boolean(sourceProjectId),
  });
  const destinations = useQuery({queryKey:['transfer-destinations',sourceProjectId],queryFn:()=>inventoryApi.transferDestinationProjects(sourceProjectId),enabled:Boolean(sourceProjectId&&canCreate),retry:false,gcTime:0});
  const destinationWarehouses = useQuery({
    queryKey: ['transfer-destination-warehouses', sourceProjectId, destinationProjectId],
    queryFn: () => inventoryApi.transferDestinationWarehouses(sourceProjectId, destinationProjectId),
    enabled: Boolean(sourceProjectId && destinationProjectId && canCreate),
  });
  const stock = useQuery({
    queryKey: ['transfer-stock', sourceProjectId, sourceWarehouseId],
    queryFn: () =>
      inventoryApi.transferStock(sourceProjectId, sourceWarehouseId || undefined),
    enabled: Boolean(sourceProjectId && sourceWarehouseId),
  });
  const transfers = useQuery({
    queryKey: ['stock-transfers', sourceProjectId],
    queryFn: () => inventoryApi.stockTransfers(sourceProjectId || undefined),
  });
  const workflows = useQuery({
    queryKey: ['transfer-workflows'],
    queryFn: inventoryApi.transferWorkflows,
    enabled: canSubmit,
  });
  const detail = useQuery({
    queryKey: ['stock-transfer', selectedId],
    queryFn: () => inventoryApi.stockTransfer(selectedId),
    enabled: Boolean(selectedId),
  });

  const selectedStock = stock.data?.data.find(
    (row) =>
      [row.warehouseId, row.materialId, row.uomId].join(':') === stockKey,
  );
  const validQuantity =
    /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(quantity) &&
    Number(quantity) > 0 &&
    (!selectedStock || Number(quantity) <= Number(selectedStock.available));
  const current = detail.data?.data;
  const assignmentProjectId = (current?.items ?? []).some(i => i.destinationProjectId === assignmentProject) ? assignmentProject : current?.items?.[0]?.destinationProjectId ?? '';
  const receivers = useQuery({ queryKey: ['transfer-custody', 'receivers', current?.id, assignmentProjectId], queryFn: () => transferCustodyApi.receivers(assignmentProjectId, current!.id), enabled: Boolean(current?.custody && assignmentProjectId && permissions.includes('inventory.transfer.assign_receiver')), retry: false, gcTime: 0 });

  useEffect(() => {
    if (!current) return;
    setDraftRemarks(current.remarks ?? '');
    setDraftQuantities(Object.fromEntries(
      (current.items ?? []).map((item) => [item.id, item.quantity]),
    ));
  }, [current]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-transfer'] }),
      queryClient.invalidateQueries({ queryKey: ['transfer-stock'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-report'] }),
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
      <Typography variant="h6">Stock Transfers</Typography>
      <Alert severity="info">
        {t.scope}
      </Alert>
      {mutationError ? (
        <Alert severity="error">
          {mutationError instanceof Error ? mutationError.message : 'Request failed.'}
        </Alert>
      ) : null}

      {canCreate ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Create Stock Transfer Draft</Typography>
              <TextField
                select
                label="Source Project"
                value={sourceProjectId}
                onChange={(event) => {
                  const id = event.target.value;
                  setSourceProjectId(id);
                  setDestinationProjectId((currentValue) => currentValue || id);
                  setSourceWarehouseId('');
                  setStockKey('');
                }}
              >
                <MenuItem value="">Select source Project</MenuItem>
                {(projects.data?.data ?? []).map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.projectCode} — {project.projectName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Source Warehouse"
                value={sourceWarehouseId}
                onChange={(event) => {
                  setSourceWarehouseId(event.target.value);
                  setStockKey('');
                }}
                disabled={!sourceProjectId}
              >
                <MenuItem value="">Select source Warehouse</MenuItem>
                {(sourceWarehouses.data?.data ?? []).map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouseCode} — {warehouse.warehouseName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Source stock"
                value={stockKey}
                onChange={(event) => {
                  setStockKey(event.target.value);
                  const row = stock.data?.data.find(
                    (item) =>
                      [item.warehouseId, item.materialId, item.uomId].join(':') ===
                      event.target.value,
                  );
                  setQuantity(row?.available ?? '');
                }}
                disabled={!sourceWarehouseId}
              >
                <MenuItem value="">Select material/UOM</MenuItem>
                {(stock.data?.data ?? []).map((row) => (
                  <MenuItem
                    key={[row.warehouseId, row.materialId, row.uomId].join(':')}
                    value={[row.warehouseId, row.materialId, row.uomId].join(':')}
                  >
                    {row.materialCode} — {row.materialName} · {row.uomCode} ·
                    available {row.available}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                error={Boolean(quantity) && !validQuantity}
                helperText={
                  selectedStock
                    ? 'Available: ' + selectedStock.available +
                      ' (on hand ' + selectedStock.onHand +
                      ', reserved ' + selectedStock.reserved + ')'
                    : 'Maximum 4 decimal places.'
                }
              />
              <TextField
                select
                label="Destination Project"
                value={destinationProjectId}
                onChange={(event) => {
                  setDestinationProjectId(event.target.value);
                  setDestinationWarehouseId('');
                }}
              >
                <MenuItem value="">Select destination Project</MenuItem>
                {(destinations.data?.data ?? []).map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.projectCode} — {project.projectName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Destination Warehouse"
                value={destinationWarehouseId}
                onChange={(event) => setDestinationWarehouseId(event.target.value)}
                disabled={!destinationProjectId}
              >
                <MenuItem value="">Select destination Warehouse</MenuItem>
                {(destinationWarehouses.data?.data ?? [])
                  .filter((warehouse) => warehouse.id !== sourceWarehouseId)
                  .map((warehouse) => (
                    <MenuItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.warehouseCode} — {warehouse.warehouseName}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                type="date"
                label="Transfer date"
                value={transferDate}
                onChange={(event) => setTransferDate(event.target.value)}
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
                disabled={
                  !selectedStock ||
                  !validQuantity ||
                  !destinationProjectId ||
                  !destinationWarehouseId ||
                  sourceWarehouseId === destinationWarehouseId ||
                  mutation.isPending
                }
                onClick={() =>
                  perform(() =>
                    inventoryApi.createStockTransfer({
                      sourceWarehouseId,
                      destinationWarehouseId,
                      transferDate,
                      remarks: remarks.trim() || null,
                      lines: [{
                        materialId: selectedStock!.materialId,
                        quantity,
                        uomId: selectedStock!.uomId,
                        sourceProjectId,
                        destinationProjectId,
                      }],
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

      <TextField
        select
        label="Filter Project"
        value={sourceProjectId}
        onChange={(event) => {
          setSourceProjectId(event.target.value);
          setSelectedId('');
        }}
        sx={{ maxWidth: 520 }}
      >
        <MenuItem value="">All accessible Projects</MenuItem>
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} — {project.projectName}
          </MenuItem>
        ))}
      </TextField>

      {(transfers.data?.data ?? []).map((row) => (
        <Card
          key={row.id}
          variant={selectedId === row.id ? 'elevation' : 'outlined'}
          onClick={() => setSelectedId(row.id)}
          sx={{ cursor: 'pointer' }}
        >
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <Typography fontWeight={600}>{row.transferNumber}</Typography>
              <Chip
                size="small"
                label={
                  row.reversedAt
                    ? 'REVERSED'
                    : row.postedAt
                      ? row.custody ? t.dispatched : 'POSTED'
                      : row.approvalInstance?.approvalState ??
                        (row.submittedAt ? 'SUBMITTED' : 'DRAFT')
                }
              />
              <Typography variant="body2" color="text.secondary">
                {row.sourceWarehouse?.warehouseCode ?? row.sourceWarehouseId} →{' '}
                {row.destinationWarehouse?.warehouseCode ??
                  row.destinationWarehouseId}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}

      {current ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography fontWeight={600}>
                {current.transferNumber} ·{' '}
                {current.sourceWarehouse?.warehouseCode} →{' '}
                {current.destinationWarehouse?.warehouseCode}
              </Typography>
              {(current.items ?? []).map((item) => (
                <Typography key={item.id} variant="body2">
                  {item.material?.materialCode ?? item.materialId} · {item.quantity}{' '}
                  {item.uom?.uomCode ?? item.uomId} ·{' '}
                  {item.sourceProject?.projectCode ?? item.sourceProjectId} →{' '}
                  {item.destinationProject?.projectCode ??
                    item.destinationProjectId}
                </Typography>
              ))}

              {!current.submittedAt && canEdit ? (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Edit Draft</Typography>
                  <TextField label="Remarks" value={draftRemarks}
                    onChange={(event) => setDraftRemarks(event.target.value)}
                    multiline minRows={2} />
                  <Button variant="outlined" disabled={mutation.isPending}
                    onClick={() => perform(() =>
                      inventoryApi.updateStockTransfer(current.id, {
                        remarks: draftRemarks.trim() || null,
                      })
                    )}>
                    Save remarks
                  </Button>
                  {(current.items ?? []).map((item) => {
                    const draftQuantity = draftQuantities[item.id] ?? item.quantity;
                    const validDraftQuantity =
                      /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(draftQuantity) &&
                      Number(draftQuantity) > 0;
                    return (
                      <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }}
                        spacing={1} alignItems={{ sm: 'center' }}>
                        <Typography variant="body2">
                          {item.material?.materialCode ?? item.materialId} ·
                          {item.uom?.uomCode ?? item.uomId}
                        </Typography>
                        <TextField label="Quantity" value={draftQuantity}
                          onChange={(event) => setDraftQuantities((previous) => ({
                            ...previous, [item.id]: event.target.value,
                          }))}
                          error={!validDraftQuantity} />
                        <Button variant="outlined"
                          disabled={!validDraftQuantity || mutation.isPending}
                          onClick={() => perform(async () => {
                            await inventoryApi.updateStockTransferItem(item.id, {
                              materialId: item.materialId,
                              quantity: draftQuantity,
                              uomId: item.uomId,
                              sourceProjectId: item.sourceProjectId,
                              destinationProjectId: item.destinationProjectId,
                              remarks: item.remarks ?? null,
                            });
                            return { data: { id: current.id } };
                          })}>
                          Save line
                        </Button>
                      </Stack>
                    );
                  })}
                </Stack>
              ) : null}

              {!current.submittedAt && canSubmit ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    select
                    label="Approval workflow"
                    value={workflowCode}
                    onChange={(event) => setWorkflowCode(event.target.value)}
                    sx={{ minWidth: 280 }}
                  >
                    <MenuItem value="">Select workflow</MenuItem>
                    {(workflows.data?.data ?? []).map((workflow) => (
                      <MenuItem
                        key={workflow.workflowCode}
                        value={workflow.workflowCode}
                      >
                        {workflow.workflowName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    disabled={!workflowCode || mutation.isPending}
                    onClick={() =>
                      perform(() =>
                        inventoryApi.submitStockTransfer(
                          current.id,
                          workflowCode,
                        ),
                      )
                    }
                  >
                    Submit
                  </Button>
                </Stack>
              ) : null}

              {current.custody ? <Alert severity="info">{t.scope}</Alert> : <Alert severity="info">{t.legacy}</Alert>}
              {custodyCommand.isError ? <Alert severity="error">{t.uncertain}<Button disabled={custodyCommand.isPending} onClick={()=>custodyIntent&&custodyCommand.mutate(custodyIntent)}>{t.retry}</Button><Button disabled={custodyCommand.isPending} onClick={()=>{setCustodyIntent(null);custodyCommand.reset();void refresh();}}>{t.clear}</Button></Alert>:null}
              {current.custody && current.approvalInstance?.approvalState==='APPROVED' && !current.postedAt && permissions.includes('inventory.transfer.dispatch') ? <Stack spacing={1}><TextField label={t.assignmentReason} value={reason} onChange={e=>setReason(e.target.value)} disabled={Boolean(custodyIntent)}/><Button disabled={Boolean(custodyIntent)||!reason.trim()} onClick={()=>sendCustody(transferRoot+'/transfers/'+current.id+'/dispatch',{requestKey:crypto.randomUUID(),expectedVersion:current.custody!.version,reason})}>{t.dispatch}</Button></Stack>:null}
              {current.custody && !current.reversedAt && current.approvalInstance?.approvalState!=='CANCELLED' && permissions.includes('inventory.transfer.assign_receiver') ? <Stack spacing={1}><TextField select label="Destination Project" value={assignmentProjectId} onChange={e=>{setAssignmentProject(e.target.value);setEmployeeId('');}} disabled={Boolean(custodyIntent)}>{[...new Set((current.items??[]).map(i=>i.destinationProjectId))].map(projectId=><MenuItem key={projectId} value={projectId}>{current.items?.find(i=>i.destinationProjectId===projectId)?.destinationProject?.projectName??projectId}</MenuItem>)}</TextField><TextField select label={t.employee} value={!receivers.isError&&receivers.data?.data.some(e=>e.id===employeeId)?employeeId:''} onChange={e=>setEmployeeId(e.target.value)} disabled={Boolean(custodyIntent)||receivers.isError}><MenuItem value="">{t.select}</MenuItem>{!receivers.isError?receivers.data?.data.map(e=><MenuItem key={e.id} value={e.id}>{e.employeeCode} · {e.employeeName}</MenuItem>):null}</TextField><TextField label={t.assignmentReason} value={reason} onChange={e=>setReason(e.target.value)} disabled={Boolean(custodyIntent)}/>{[assignmentProjectId].map(projectId=><Button key={projectId} disabled={Boolean(custodyIntent)||!reason.trim()||!receivers.data?.data.some(e=>e.id===employeeId)||receivers.isError} onClick={()=>sendCustody(transferDestinationPath(projectId,current.id)+'/assign',{requestKey:crypto.randomUUID(),expectedVersion:current.custody!.version,reason,employeeId})}>{t.assign} · {current.items?.find(i=>i.destinationProjectId===projectId)?.destinationProject?.projectCode}</Button>)}</Stack>:null}
              {current.submittedAt && !current.postedAt && current.approvalInstance?.approvalState==='SUBMITTED' && canApprove ? (
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
                        inventoryApi.approveStockTransfer(current.id, key!),
                      );
                    }}
                  >
                    {current.custody ? t.approved : 'Approve and post'}
                  </Button>
                  <Button
                    disabled={mutation.isPending}
                    onClick={() =>
                      perform(() =>
                        inventoryApi.rejectStockTransfer(
                          current.id,
                          'Rejected from Inventory workspace',
                        ),
                      )
                    }
                  >
                    Reject
                  </Button>
                </Stack>
              ) : null}

              {current.postedAt && !current.reversedAt && (!current.custody || current.custody.receiptComplete) && canReverse ? (
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
                        inventoryApi.reverseStockTransfer(
                          current.id,
                          key!,
                          reason.trim(),
                        ),
                      );
                    }}
                  >
                    Reverse
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
