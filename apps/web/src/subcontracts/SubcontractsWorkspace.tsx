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
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  AgreementDraft,
  AgreementVersion,
  SubcontractorRecord,
  WorkOrderRecord,
  subcontractsApi,
} from '../api/subcontracts';

function SubcontractorsPanel({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canManage = permissions.includes('subcontracts.subcontractor.manage');
  const canArchive = permissions.includes('subcontracts.subcontractor.archive');
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [newMode, setNewMode] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [registration, setRegistration] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const rows = useQuery({
    queryKey: ['subcontracts', 'subcontractors', includeInactive, search],
    queryFn: () =>
      subcontractsApi.subcontractors({ includeInactive, search }),
  });
  const suppliers = useQuery({
    queryKey: ['subcontracts', 'suppliers'],
    queryFn: subcontractsApi.suppliers,
  });
  const selected = useMemo(
    () =>
      (rows.data?.data ?? []).find((row) => row.id === selectedId) ?? null,
    [rows.data?.data, selectedId],
  );

  useEffect(() => {
    if (!selected || newMode) return;
    setCode(selected.subcontractorCode);
    setName(selected.subcontractorName);
    setSupplierId(selected.supplierId ?? '');
    setRegistration(selected.registrationNumber ?? '');
    setContact(selected.contactName ?? '');
    setEmail(selected.email ?? '');
    setPhone(selected.phone ?? '');
    setAddress(selected.address ?? '');
  }, [selected, newMode]);

  const refresh = () =>
    client.invalidateQueries({ queryKey: ['subcontracts'] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        subcontractorCode: code,
        subcontractorName: name,
        registrationNumber: registration || null,
        contactName: contact || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
      };
      if (newMode || !selected) {
        return subcontractsApi.createSubcontractor({
          ...body,
          supplierId: supplierId || null,
        });
      }
      return subcontractsApi.updateSubcontractor(selected.id, {
        ...body,
        ...(supplierId !== (selected.supplierId ?? '')
          ? { supplierId: supplierId || null }
          : {}),
      });
    },
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      setNewMode(false);
      await refresh();
    },
  });
  const lifecycle = useMutation({
    mutationFn: (row: SubcontractorRecord) =>
      subcontractsApi.setSubcontractorActive(row.id, !row.isActive),
    onSuccess: refresh,
  });

  const beginNew = () => {
    setSelectedId('');
    setNewMode(true);
    setCode('');
    setName('');
    setSupplierId('');
    setRegistration('');
    setContact('');
    setEmail('');
    setPhone('');
    setAddress('');
  };

  const requestError = save.error ?? lifecycle.error;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Subcontractor Register
        </Typography>
        {canManage ? (
          <Button variant="outlined" onClick={beginNew}>
            New Subcontractor
          </Button>
        ) : null}
      </Stack>
      <Alert severity="info">
        This is the Company-owned Subcontracts register. A Supplier link is
        optional and does not replace the Subcontractor record.
      </Alert>
      {requestError ? (
        <Alert severity="error">
          {requestError instanceof Error ? requestError.message : 'Request failed.'}
        </Alert>
      ) : null}
      <Card variant="outlined">
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
          >
            <TextField
              label="Search code, name or registration"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)}
                />
              }
              label="Include archived"
            />
          </Stack>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Register</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {(rows.data?.data ?? []).map((row) => (
                <Chip
                  key={row.id}
                  label={
                    row.subcontractorCode +
                    ' · ' +
                    row.subcontractorName +
                    (row.isActive ? '' : ' · ARCHIVED')
                  }
                  color={row.id === selectedId ? 'primary' : 'default'}
                  onClick={() => {
                    setNewMode(false);
                    setSelectedId(row.id);
                  }}
                />
              ))}
            </Stack>
            {rows.isSuccess && rows.data.data.length === 0 ? (
              <Alert severity="info">No Subcontractor matches the filters.</Alert>
            ) : null}
            {(newMode && canManage) || selected ? (
              <>
                <Divider />
                <Typography variant="subtitle1">
                  {newMode
                    ? 'Create Subcontractor'
                    : canManage
                      ? 'Edit Subcontractor'
                      : 'Subcontractor details'}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    label="Code"
                    value={code}
                    disabled={!canManage}
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <TextField
                    label="Name"
                    value={name}
                    disabled={!canManage}
                    onChange={(event) => setName(event.target.value)}
                    sx={{ flexGrow: 1 }}
                  />
                  <TextField
                    select
                    label="Optional Supplier link"
                    value={supplierId}
                    disabled={!canManage}
                    onChange={(event) => setSupplierId(event.target.value)}
                    sx={{ minWidth: 260 }}
                  >
                    <MenuItem value="">No Supplier link</MenuItem>
                    {selected?.supplier && !selected.supplier.isActive ? (
                      <MenuItem value={selected.supplier.id} disabled>
                        {selected.supplier.supplierCode} —{' '}
                        {selected.supplier.supplierName} — inactive current
                      </MenuItem>
                    ) : null}
                    {(suppliers.data?.data ?? []).map((supplier) => (
                      <MenuItem key={supplier.id} value={supplier.id}>
                        {supplier.supplierCode} — {supplier.supplierName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    label="Registration number"
                    value={registration}
                    disabled={!canManage}
                    onChange={(event) => setRegistration(event.target.value)}
                  />
                  <TextField
                    label="Contact"
                    value={contact}
                    disabled={!canManage}
                    onChange={(event) => setContact(event.target.value)}
                  />
                  <TextField
                    label="Email"
                    value={email}
                    disabled={!canManage}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <TextField
                    label="Phone"
                    value={phone}
                    disabled={!canManage}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </Stack>
                <TextField
                  label="Address"
                  value={address}
                  disabled={!canManage}
                  onChange={(event) => setAddress(event.target.value)}
                  multiline
                  minRows={2}
                />
                <Stack direction="row" spacing={2}>
                  {canManage ? (
                    <Button
                      variant="contained"
                      onClick={() => save.mutate()}
                      disabled={save.isPending || !code.trim() || !name.trim()}
                    >
                      Save
                    </Button>
                  ) : null}
                  {selected && canArchive ? (
                    <Button
                      color={selected.isActive ? 'warning' : 'success'}
                      onClick={() => lifecycle.mutate(selected)}
                      disabled={lifecycle.isPending}
                    >
                      {selected.isActive ? 'Archive' : 'Reactivate'}
                    </Button>
                  ) : null}
                </Stack>
              </>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function ApprovalTrail({
  instance,
}: {
  instance: AgreementVersion['approvalInstance'] | WorkOrderRecord['approvalInstance'];
}) {
  if (!instance) {
    return <Typography color="text.secondary">No approval history yet.</Typography>;
  }
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2">
        {instance.workflow.workflowName} · {instance.approvalState}
      </Typography>
      {instance.actions.map((action) => (
        <Typography key={action.id} variant="caption" color="text.secondary">
          Step {action.approvalStep.stepNo} · {action.action} ·{' '}
          {action.actionByUser.displayName}
          {action.comment ? ' · ' + action.comment : ''}
        </Typography>
      ))}
    </Stack>
  );
}

function AgreementsPanel({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canCreate = permissions.includes('subcontracts.agreement.create');
  const canEdit = permissions.includes('subcontracts.agreement.edit');
  const canSubmit = permissions.includes('subcontracts.agreement.submit');
  const canApprove = permissions.includes('subcontracts.agreement.approve');
  const canReject = permissions.includes('subcontracts.agreement.reject');
  const canRevise = permissions.includes('subcontracts.agreement.revise');
  const canCancel = permissions.includes('subcontracts.agreement.cancel');
  const canViewWorkOrders = permissions.includes('subcontracts.work_order.view');
  const canCreateWorkOrder = permissions.includes('subcontracts.work_order.create');
  const canEditWorkOrder = permissions.includes('subcontracts.work_order.edit');
  const canSubmitWorkOrder = permissions.includes('subcontracts.work_order.submit');
  const canApproveWorkOrder = permissions.includes('subcontracts.work_order.approve');
  const canRejectWorkOrder = permissions.includes('subcontracts.work_order.reject');

  const [projectFilter, setProjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [newMode, setNewMode] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [value, setValue] = useState('');
  const [scope, setScope] = useState('');
  const [currency, setCurrency] = useState('SGD');
  const [statusId, setStatusId] = useState('');
  const [createKey, setCreateKey] = useState(() => crypto.randomUUID());

  const [agreementWorkflow, setAgreementWorkflow] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionStatusId, setRevisionStatusId] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [workOrderScope, setWorkOrderScope] = useState('');
  const [workOrderAmount, setWorkOrderAmount] = useState('');
  const [workOrderWbsId, setWorkOrderWbsId] = useState('');
  const [workOrderCostCodeId, setWorkOrderCostCodeId] = useState('');
  const [workOrderWorkflow, setWorkOrderWorkflow] = useState('');
  const [workOrderComment, setWorkOrderComment] = useState('');

  const agreements = useQuery({
    queryKey: ['subcontracts', 'agreements', projectFilter, search],
    queryFn: () =>
      subcontractsApi.agreements({
        ...(projectFilter ? { projectId: projectFilter } : {}),
        ...(search ? { search } : {}),
      }),
  });
  const projects = useQuery({
    queryKey: ['subcontracts', 'projects'],
    queryFn: subcontractsApi.projects,
  });
  const subcontractors = useQuery({
    queryKey: ['subcontracts', 'agreement-subcontractors'],
    queryFn: subcontractsApi.agreementSubcontractors,
  });
  const statuses = useQuery({
    queryKey: ['subcontracts', 'statuses'],
    queryFn: subcontractsApi.statuses,
  });
  const agreementWorkflows = useQuery({
    queryKey: ['subcontracts', 'agreement-workflows'],
    queryFn: subcontractsApi.agreementWorkflowOptions,
    enabled: canSubmit,
  });
  const workOrderWorkflows = useQuery({
    queryKey: ['subcontracts', 'work-order-workflows'],
    queryFn: subcontractsApi.workOrderWorkflowOptions,
    enabled: canSubmitWorkOrder,
  });

  const selected = useMemo(
    () =>
      (agreements.data?.data ?? []).find((row) => row.id === selectedId) ??
      null,
    [agreements.data?.data, selectedId],
  );

  const versions = useQuery({
    queryKey: ['subcontracts', 'agreement-versions', selectedId],
    queryFn: () => subcontractsApi.agreementVersions(selectedId),
    enabled: Boolean(selectedId),
  });
  const workOrders = useQuery({
    queryKey: ['subcontracts', 'work-orders', selectedId],
    queryFn: () => subcontractsApi.workOrders(selectedId),
    enabled: Boolean(selectedId) && canViewWorkOrders,
  });
  const workOrderOptions = useQuery({
    queryKey: ['subcontracts', 'work-order-options', selectedId],
    queryFn: () => subcontractsApi.workOrderOptions(selectedId),
    enabled:
      Boolean(selectedId) &&
      canViewWorkOrders &&
      selected?.approvalState === 'APPROVED' &&
      !selected?.cancelledAt,
  });

  const selectedWorkOrder = useMemo(
    () =>
      (workOrders.data?.data ?? []).find(
        (row) => row.id === selectedWorkOrderId,
      ) ?? null,
    [workOrders.data?.data, selectedWorkOrderId],
  );

  const initialVersion = useMemo(
    () =>
      (versions.data?.data ?? []).find((row) => row.versionNo === 1) ?? null,
    [versions.data?.data],
  );

  const activeRevision = useMemo(
    () =>
      (versions.data?.data ?? []).find(
        (row) =>
          row.versionNo > 1 &&
          (row.approvalState === 'DRAFT' ||
            row.approvalState === 'SUBMITTED'),
      ) ?? null,
    [versions.data?.data],
  );

  useEffect(() => {
    if (!selected || newMode) return;
    setProjectId(selected.projectId);
    setSubcontractorId(selected.subcontractorId);
    setValue(selected.originalValue);
    setScope(selected.scopeOfWork);
    setCurrency(selected.currencyCode);
    setStatusId(selected.operationalStatusId ?? '');
    setCancelReason('');
    setDecisionComment('');
    setSelectedWorkOrderId('');
  }, [selected, newMode]);

  useEffect(() => {
    if (!activeRevision) {
      setRevisionReason('');
      setRevisionStatusId(selected?.operationalStatusId ?? '');
      return;
    }
    setRevisionReason(activeRevision.reason ?? '');
    setRevisionStatusId(activeRevision.operationalStatusId ?? '');
  }, [activeRevision, selected?.operationalStatusId]);

  useEffect(() => {
    if (!selectedWorkOrder) {
      setWorkOrderScope('');
      setWorkOrderAmount('');
      setWorkOrderWbsId('');
      setWorkOrderCostCodeId('');
      setWorkOrderComment('');
      return;
    }
    setWorkOrderScope(selectedWorkOrder.scopeOfWork);
    setWorkOrderAmount(selectedWorkOrder.amount);
    setWorkOrderWbsId(selectedWorkOrder.wbsElementId ?? '');
    setWorkOrderCostCodeId(selectedWorkOrder.costCodeId ?? '');
    setWorkOrderComment('');
  }, [selectedWorkOrder]);

  const refresh = () =>
    client.invalidateQueries({ queryKey: ['subcontracts'] });

  const save = useMutation({
    mutationFn: () =>
      newMode || !selected
        ? subcontractsApi.createAgreement({
            projectId,
            subcontractorId,
            originalValue: value,
            scopeOfWork: scope,
            currencyCode: currency,
            operationalStatusId: statusId || null,
            createKey,
          })
        : subcontractsApi.updateAgreement(selected.id, {
            originalValue: value,
            scopeOfWork: scope,
            currencyCode: currency,
            ...(statusId !== (selected.operationalStatusId ?? '')
              ? { operationalStatusId: statusId || null }
              : {}),
          }),
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      setNewMode(false);
      await refresh();
    },
  });

  const agreementAction = useMutation({
    mutationFn: async (input: {
      action: 'submit' | 'approve' | 'reject' | 'cancel';
      agreement: AgreementDraft;
    }) => {
      const approvalStep =
        initialVersion?.approvalInstance?.currentStepNo ?? 0;
      const actionKey =
        input.action +
        '-agreement-' +
        input.agreement.id +
        (input.action === 'approve' || input.action === 'reject'
          ? '-step-' + approvalStep
          : '');
      if (input.action === 'submit') {
        return subcontractsApi.submitAgreement(
          input.agreement.id,
          agreementWorkflow,
          actionKey,
        );
      }
      if (input.action === 'approve') {
        return subcontractsApi.approveAgreement(
          input.agreement.id,
          actionKey,
          decisionComment || undefined,
        );
      }
      if (input.action === 'reject') {
        return subcontractsApi.rejectAgreement(
          input.agreement.id,
          actionKey,
          decisionComment || undefined,
        );
      }
      return subcontractsApi.cancelAgreement(
        input.agreement.id,
        cancelReason,
        actionKey,
      );
    },
    onSuccess: refresh,
  });

  const revisionAction = useMutation({
    mutationFn: async (input: {
      action: 'create' | 'save' | 'submit' | 'approve' | 'reject';
      revision?: AgreementVersion;
    }) => {
      if (!selected) throw new Error('Select an agreement first.');
      if (input.action === 'create') {
        return subcontractsApi.createAgreementRevision(selected.id, {
          operationalStatusId: revisionStatusId || null,
          reason: revisionReason,
        });
      }
      if (!input.revision) throw new Error('Select an agreement revision first.');
      if (input.action === 'save') {
        return subcontractsApi.updateAgreementRevision(input.revision.id, {
          operationalStatusId: revisionStatusId || null,
          reason: revisionReason,
        });
      }
      const approvalStep =
        input.revision.approvalInstance?.currentStepNo ?? 0;
      const actionKey =
        input.action +
        '-agreement-revision-' +
        input.revision.id +
        (input.action === 'approve' || input.action === 'reject'
          ? '-step-' + approvalStep
          : '');
      if (input.action === 'submit') {
        return subcontractsApi.submitAgreementRevision(
          input.revision.id,
          agreementWorkflow,
          actionKey,
        );
      }
      if (input.action === 'approve') {
        return subcontractsApi.approveAgreementRevision(
          input.revision.id,
          actionKey,
          decisionComment || undefined,
        );
      }
      return subcontractsApi.rejectAgreementRevision(
        input.revision.id,
        actionKey,
        decisionComment || undefined,
      );
    },
    onSuccess: refresh,
  });

  const workOrderAction = useMutation({
    mutationFn: async (input: {
      action: 'create' | 'save' | 'submit' | 'approve' | 'reject';
      workOrder?: WorkOrderRecord;
    }) => {
      if (!selected) throw new Error('Select an agreement first.');
      if (input.action === 'create') {
        return subcontractsApi.createWorkOrder(selected.id, {
          scopeOfWork: workOrderScope,
          amount: workOrderAmount,
          wbsElementId: workOrderWbsId || null,
          costCodeId: workOrderCostCodeId || null,
        });
      }
      if (!input.workOrder) throw new Error('Select a Work Order first.');
      if (input.action === 'save') {
        return subcontractsApi.updateWorkOrder(input.workOrder.id, {
          scopeOfWork: workOrderScope,
          amount: workOrderAmount,
          wbsElementId: workOrderWbsId || null,
          costCodeId: workOrderCostCodeId || null,
        });
      }
      const approvalStep =
        input.workOrder.approvalInstance?.currentStepNo ?? 0;
      const actionKey =
        input.action +
        '-work-order-' +
        input.workOrder.id +
        (input.action === 'approve' || input.action === 'reject'
          ? '-step-' + approvalStep
          : '');
      if (input.action === 'submit') {
        return subcontractsApi.submitWorkOrder(
          input.workOrder.id,
          workOrderWorkflow,
          actionKey,
        );
      }
      if (input.action === 'approve') {
        return subcontractsApi.approveWorkOrder(
          input.workOrder.id,
          actionKey,
          workOrderComment || undefined,
        );
      }
      return subcontractsApi.rejectWorkOrder(
        input.workOrder.id,
        actionKey,
        workOrderComment || undefined,
      );
    },
    onSuccess: async (result) => {
      if ('workOrderNumber' in result.data) {
        setSelectedWorkOrderId(result.data.id);
      }
      await refresh();
    },
  });

  const beginNew = () => {
    setSelectedId('');
    setNewMode(true);
    setProjectId('');
    setSubcontractorId('');
    setValue('');
    setScope('');
    setCurrency('SGD');
    setStatusId('');
    setCreateKey(crypto.randomUUID());
    setSelectedWorkOrderId('');
  };

  const beginNewWorkOrder = () => {
    setSelectedWorkOrderId('');
    setWorkOrderScope('');
    setWorkOrderAmount('');
    setWorkOrderWbsId('');
    setWorkOrderCostCodeId('');
    setWorkOrderComment('');
  };

  const requestError =
    save.error ??
    agreementAction.error ??
    revisionAction.error ??
    workOrderAction.error;

  const selectedIsDraft = selected?.approvalState === 'DRAFT';
  const selectedIsSubmitted = selected?.approvalState === 'SUBMITTED';
  const selectedIsApproved =
    selected?.approvalState === 'APPROVED' && !selected.cancelledAt;
  const canEditSelectedDraft =
    Boolean(selected) && selectedIsDraft && canEdit && !selected?.firstApprovedAt;
  const canEditCurrentWorkOrder =
    Boolean(selectedWorkOrder) &&
    selectedWorkOrder?.approvalState === 'DRAFT' &&
    canEditWorkOrder;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Agreements & Work Orders
        </Typography>
        {canCreate ? (
          <Button variant="outlined" onClick={beginNew}>
            New Agreement Draft
          </Button>
        ) : null}
      </Stack>
      <Alert severity="info">
        Stage B uses configured approval workflows, maker-checker controls,
        retained agreement versions and agreement-local Work Orders. Approved
        commercial agreement fields remain immutable.
      </Alert>
      {requestError ? (
        <Alert severity="error">
          {requestError instanceof Error ? requestError.message : 'Request failed.'}
        </Alert>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              label="Project"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              sx={{ minWidth: 280 }}
            >
              <MenuItem value="">All accessible Projects</MenuItem>
              {(projects.data?.data ?? []).map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.projectCode} — {project.projectName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Search number, scope or Subcontractor"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ flexGrow: 1 }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Agreements</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {(agreements.data?.data ?? []).map((row) => (
                <Chip
                  key={row.id}
                  label={
                    row.agreementNumber +
                    ' · ' +
                    row.subcontractor.subcontractorName +
                    ' · ' +
                    row.approvalState
                  }
                  color={row.id === selectedId ? 'primary' : 'default'}
                  onClick={() => {
                    setNewMode(false);
                    setSelectedId(row.id);
                  }}
                />
              ))}
            </Stack>
            {agreements.isSuccess && agreements.data.data.length === 0 ? (
              <Alert severity="info">No agreement matches the filters.</Alert>
            ) : null}

            {(newMode && canCreate) || selected ? (
              <>
                <Divider />
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  alignItems={{ md: 'center' }}
                >
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    {newMode
                      ? 'Create Agreement Draft'
                      : selected?.agreementNumber + ' · Agreement details'}
                  </Typography>
                  {selected ? (
                    <Chip
                      label={
                        selected.cancelledAt
                          ? 'CANCELLED'
                          : selected.approvalState
                      }
                      color={
                        selected.cancelledAt
                          ? 'default'
                          : selected.approvalState === 'APPROVED'
                            ? 'success'
                            : selected.approvalState === 'REJECTED'
                              ? 'error'
                              : selected.approvalState === 'SUBMITTED'
                                ? 'warning'
                                : 'default'
                      }
                    />
                  ) : null}
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    select
                    label="Project"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    disabled={!newMode}
                    sx={{ minWidth: 280, flexGrow: 1 }}
                  >
                    {!newMode &&
                    selected &&
                    projects.isSuccess &&
                    !projects.data.data.some(
                      (project) => project.id === selected.projectId,
                    ) ? (
                      <MenuItem value={selected.projectId} disabled>
                        {selected.project.projectCode} —{' '}
                        {selected.project.projectName} — inactive current
                      </MenuItem>
                    ) : null}
                    {(projects.data?.data ?? []).map((project) => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.projectCode} — {project.projectName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Subcontractor"
                    value={subcontractorId}
                    onChange={(event) => setSubcontractorId(event.target.value)}
                    disabled={!newMode}
                    sx={{ minWidth: 280, flexGrow: 1 }}
                  >
                    {!newMode &&
                    selected?.subcontractor &&
                    !selected.subcontractor.isActive ? (
                      <MenuItem value={selected.subcontractorId} disabled>
                        {selected.subcontractor.subcontractorCode} —{' '}
                        {selected.subcontractor.subcontractorName} — inactive current
                      </MenuItem>
                    ) : null}
                    {(subcontractors.data?.data ?? []).map((row) => (
                      <MenuItem key={row.id} value={row.id}>
                        {row.subcontractorCode} — {row.subcontractorName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    label="Original value (tax-exclusive)"
                    value={value}
                    disabled={!newMode && !canEditSelectedDraft}
                    onChange={(event) => setValue(event.target.value)}
                  />
                  <TextField
                    label="Currency"
                    value={currency}
                    disabled={!newMode && !canEditSelectedDraft}
                    onChange={(event) => setCurrency(event.target.value)}
                  />
                  <TextField
                    select
                    label="Operational status"
                    value={statusId}
                    disabled={!newMode && !canEditSelectedDraft}
                    onChange={(event) => setStatusId(event.target.value)}
                    sx={{ minWidth: 220 }}
                  >
                    <MenuItem value="">No configured status</MenuItem>
                    {selected?.operationalStatus &&
                    selected.operationalStatusId &&
                    !(statuses.data?.data ?? []).some(
                      (status) => status.id === selected.operationalStatusId,
                    ) ? (
                      <MenuItem
                        value={selected.operationalStatusId}
                        disabled
                      >
                        {selected.operationalStatus.statusLabel} — inactive current
                      </MenuItem>
                    ) : null}
                    {(statuses.data?.data ?? []).map((status) => (
                      <MenuItem key={status.id} value={status.id}>
                        {status.statusLabel}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <TextField
                  label="Scope of Work"
                  value={scope}
                  disabled={!newMode && !canEditSelectedDraft}
                  onChange={(event) => setScope(event.target.value)}
                  multiline
                  minRows={4}
                />

                {(newMode ? canCreate : canEditSelectedDraft) ? (
                  <Button
                    variant="contained"
                    onClick={() => save.mutate()}
                    disabled={
                      save.isPending ||
                      !projectId ||
                      !subcontractorId ||
                      !value ||
                      !scope.trim() ||
                      currency.trim().length !== 3
                    }
                  >
                    Save Draft
                  </Button>
                ) : null}

                {selected ? (
                  <>
                    <Divider />
                    <Typography variant="subtitle1">Approval lifecycle</Typography>
                    {(canSubmit || canSubmitWorkOrder) ? (
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        {canSubmit ? (
                          <TextField
                            select
                            label="Agreement approval workflow"
                            value={agreementWorkflow}
                            onChange={(event) =>
                              setAgreementWorkflow(event.target.value)
                            }
                            sx={{ minWidth: 280 }}
                          >
                            {(agreementWorkflows.data?.data ?? []).map(
                              (workflow) => (
                                <MenuItem
                                  key={workflow.id}
                                  value={workflow.workflowCode}
                                >
                                  {workflow.workflowName}
                                </MenuItem>
                              ),
                            )}
                          </TextField>
                        ) : null}
                        {(canApprove || canReject) ? (
                          <TextField
                            label="Approval / rejection comment"
                            value={decisionComment}
                            onChange={(event) =>
                              setDecisionComment(event.target.value)
                            }
                            sx={{ flexGrow: 1 }}
                          />
                        ) : null}
                      </Stack>
                    ) : null}

                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {selectedIsDraft && canSubmit ? (
                        <Button
                          variant="contained"
                          onClick={() =>
                            agreementAction.mutate({
                              action: 'submit',
                              agreement: selected,
                            })
                          }
                          disabled={
                            agreementAction.isPending || !agreementWorkflow
                          }
                        >
                          Submit Agreement
                        </Button>
                      ) : null}
                      {selectedIsSubmitted && canApprove ? (
                        <Button
                          color="success"
                          variant="contained"
                          onClick={() =>
                            agreementAction.mutate({
                              action: 'approve',
                              agreement: selected,
                            })
                          }
                          disabled={agreementAction.isPending}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {selectedIsSubmitted && canReject ? (
                        <Button
                          color="error"
                          variant="outlined"
                          onClick={() =>
                            agreementAction.mutate({
                              action: 'reject',
                              agreement: selected,
                            })
                          }
                          disabled={agreementAction.isPending}
                        >
                          Reject
                        </Button>
                      ) : null}
                    </Stack>

                    <Typography variant="subtitle2">
                      Retained agreement versions
                    </Typography>
                    {(versions.data?.data ?? []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No submitted versions yet.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {(versions.data?.data ?? []).map((version) => (
                          <Card key={version.id} variant="outlined">
                            <CardContent>
                              <Stack spacing={1}>
                                <Stack
                                  direction={{ xs: 'column', sm: 'row' }}
                                  spacing={1}
                                  alignItems={{ sm: 'center' }}
                                >
                                  <Typography sx={{ flexGrow: 1 }}>
                                    Version {version.versionNo} ·{' '}
                                    {version.approvalState}
                                  </Typography>
                                  <Typography variant="body2">
                                    {version.currencyCode} {version.originalValue}
                                  </Typography>
                                </Stack>
                                {version.reason ? (
                                  <Typography variant="body2">
                                    Reason: {version.reason}
                                  </Typography>
                                ) : null}
                                {version.approvalInstance?.actions.map(
                                  (action) => (
                                    <Typography
                                      key={action.id}
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Step {action.approvalStep.stepNo} ·{' '}
                                      {action.action} ·{' '}
                                      {action.actionByUser.displayName}
                                      {action.comment
                                        ? ' · ' + action.comment
                                        : ''}
                                    </Typography>
                                  ),
                                )}
                                {version.versionNo > 1 &&
                                version.approvalState === 'SUBMITTED' ? (
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    useFlexGap
                                    flexWrap="wrap"
                                  >
                                    {canApprove ? (
                                      <Button
                                        size="small"
                                        color="success"
                                        onClick={() =>
                                          revisionAction.mutate({
                                            action: 'approve',
                                            revision: version,
                                          })
                                        }
                                      >
                                        Approve revision
                                      </Button>
                                    ) : null}
                                    {canReject ? (
                                      <Button
                                        size="small"
                                        color="error"
                                        onClick={() =>
                                          revisionAction.mutate({
                                            action: 'reject',
                                            revision: version,
                                          })
                                        }
                                      >
                                        Reject revision
                                      </Button>
                                    ) : null}
                                  </Stack>
                                ) : null}
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}

                    {selectedIsApproved && canRevise ? (
                      <>
                        <Divider />
                        <Typography variant="subtitle1">
                          Administrative revision
                        </Typography>
                        <Alert severity="info">
                          Stage B administrative revisions may change only the
                          configured operational status. Original value, Scope
                          of Work and currency remain the approved commercial
                          snapshot.
                        </Alert>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                          <TextField
                            select
                            label="Operational status"
                            value={revisionStatusId}
                            disabled={
                              activeRevision?.approvalState === 'SUBMITTED'
                            }
                            onChange={(event) =>
                              setRevisionStatusId(event.target.value)
                            }
                            sx={{ minWidth: 240 }}
                          >
                            <MenuItem value="">No configured status</MenuItem>
                            {(statuses.data?.data ?? []).map((status) => (
                              <MenuItem key={status.id} value={status.id}>
                                {status.statusLabel}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Revision reason"
                            value={revisionReason}
                            disabled={
                              activeRevision?.approvalState === 'SUBMITTED'
                            }
                            onChange={(event) =>
                              setRevisionReason(event.target.value)
                            }
                            sx={{ flexGrow: 1 }}
                          />
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          flexWrap="wrap"
                        >
                          {!activeRevision ? (
                            <Button
                              variant="outlined"
                              onClick={() =>
                                revisionAction.mutate({ action: 'create' })
                              }
                              disabled={
                                revisionAction.isPending ||
                                !revisionReason.trim()
                              }
                            >
                              Create revision
                            </Button>
                          ) : activeRevision.approvalState === 'DRAFT' ? (
                            <>
                              <Button
                                variant="outlined"
                                onClick={() =>
                                  revisionAction.mutate({
                                    action: 'save',
                                    revision: activeRevision,
                                  })
                                }
                                disabled={
                                  revisionAction.isPending ||
                                  !revisionReason.trim()
                                }
                              >
                                Save revision
                              </Button>
                              {canSubmit ? (
                                <Button
                                  variant="contained"
                                  onClick={() =>
                                    revisionAction.mutate({
                                      action: 'submit',
                                      revision: activeRevision,
                                    })
                                  }
                                  disabled={
                                    revisionAction.isPending ||
                                    !agreementWorkflow ||
                                    !revisionReason.trim()
                                  }
                                >
                                  Submit revision
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                        </Stack>
                      </>
                    ) : null}

                    {selectedIsApproved && canCancel ? (
                      <>
                        <Divider />
                        <Typography variant="subtitle1">
                          Agreement cancellation
                        </Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                          <TextField
                            label="Cancellation reason"
                            value={cancelReason}
                            onChange={(event) =>
                              setCancelReason(event.target.value)
                            }
                            sx={{ flexGrow: 1 }}
                          />
                          <Button
                            color="warning"
                            variant="outlined"
                            onClick={() =>
                              agreementAction.mutate({
                                action: 'cancel',
                                agreement: selected,
                              })
                            }
                            disabled={
                              agreementAction.isPending ||
                              !cancelReason.trim()
                            }
                          >
                            Cancel agreement
                          </Button>
                        </Stack>
                      </>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {selected && canViewWorkOrders ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'center' }}
              >
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                  Work Orders · {selected.agreementNumber}
                </Typography>
                {selectedIsApproved && canCreateWorkOrder ? (
                  <Button variant="outlined" onClick={beginNewWorkOrder}>
                    New Work Order
                  </Button>
                ) : null}
              </Stack>
              <Alert severity="info">
                Work Orders allocate within the approved agreement ceiling and
                do not create a second commitment. Rejected numbers are retained
                and never reused.
              </Alert>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {(workOrders.data?.data ?? []).map((row) => (
                  <Chip
                    key={row.id}
                    label={
                      row.workOrderNumber +
                      ' · ' +
                      row.agreement.currencyCode +
                      ' ' +
                      row.amount +
                      ' · ' +
                      row.approvalState
                    }
                    color={
                      row.id === selectedWorkOrderId ? 'primary' : 'default'
                    }
                    onClick={() => setSelectedWorkOrderId(row.id)}
                  />
                ))}
              </Stack>

              {selectedIsApproved &&
              canCreateWorkOrder &&
              !selectedWorkOrderId ? (
                <>
                  <Divider />
                  <Typography variant="subtitle2">Create Work Order</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Amount (tax-exclusive)"
                      value={workOrderAmount}
                      onChange={(event) =>
                        setWorkOrderAmount(event.target.value)
                      }
                    />
                    <TextField
                      select
                      label="Optional WBS"
                      value={workOrderWbsId}
                      onChange={(event) =>
                        setWorkOrderWbsId(event.target.value)
                      }
                      sx={{ minWidth: 240 }}
                    >
                      <MenuItem value="">No WBS</MenuItem>
                      {(workOrderOptions.data?.data.wbs ?? []).map((wbs) => (
                        <MenuItem key={wbs.id} value={wbs.id}>
                          {wbs.wbsCode} — {wbs.wbsName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Optional Cost Code"
                      value={workOrderCostCodeId}
                      onChange={(event) =>
                        setWorkOrderCostCodeId(event.target.value)
                      }
                      sx={{ minWidth: 240 }}
                    >
                      <MenuItem value="">No Cost Code</MenuItem>
                      {(workOrderOptions.data?.data.costCodes ?? []).map(
                        (cost) => (
                          <MenuItem key={cost.id} value={cost.id}>
                            {cost.costCode} — {cost.costName}
                          </MenuItem>
                        ),
                      )}
                    </TextField>
                  </Stack>
                  <TextField
                    label="Work Order Scope"
                    value={workOrderScope}
                    onChange={(event) =>
                      setWorkOrderScope(event.target.value)
                    }
                    multiline
                    minRows={3}
                  />
                  <Button
                    variant="contained"
                    onClick={() =>
                      workOrderAction.mutate({ action: 'create' })
                    }
                    disabled={
                      workOrderAction.isPending ||
                      !workOrderScope.trim() ||
                      !workOrderAmount
                    }
                  >
                    Create Draft Work Order
                  </Button>
                </>
              ) : null}

              {selectedWorkOrder ? (
                <>
                  <Divider />
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                  >
                    <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                      {selectedWorkOrder.workOrderNumber}
                    </Typography>
                    <Chip label={selectedWorkOrder.approvalState} />
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Amount (tax-exclusive)"
                      value={workOrderAmount}
                      disabled={!canEditCurrentWorkOrder}
                      onChange={(event) =>
                        setWorkOrderAmount(event.target.value)
                      }
                    />
                    <TextField
                      select
                      label="Optional WBS"
                      value={workOrderWbsId}
                      disabled={!canEditCurrentWorkOrder}
                      onChange={(event) =>
                        setWorkOrderWbsId(event.target.value)
                      }
                      sx={{ minWidth: 240 }}
                    >
                      <MenuItem value="">No WBS</MenuItem>
                      {selectedWorkOrder.wbsElement &&
                      !(workOrderOptions.data?.data.wbs ?? []).some(
                        (wbs) => wbs.id === selectedWorkOrder.wbsElementId,
                      ) ? (
                        <MenuItem
                          value={selectedWorkOrder.wbsElementId ?? ''}
                          disabled
                        >
                          {selectedWorkOrder.wbsElement.wbsCode} —{' '}
                          {selectedWorkOrder.wbsElement.wbsName} — inactive current
                        </MenuItem>
                      ) : null}
                      {(workOrderOptions.data?.data.wbs ?? []).map((wbs) => (
                        <MenuItem key={wbs.id} value={wbs.id}>
                          {wbs.wbsCode} — {wbs.wbsName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Optional Cost Code"
                      value={workOrderCostCodeId}
                      disabled={!canEditCurrentWorkOrder}
                      onChange={(event) =>
                        setWorkOrderCostCodeId(event.target.value)
                      }
                      sx={{ minWidth: 240 }}
                    >
                      <MenuItem value="">No Cost Code</MenuItem>
                      {selectedWorkOrder.costCode &&
                      !(workOrderOptions.data?.data.costCodes ?? []).some(
                        (cost) => cost.id === selectedWorkOrder.costCodeId,
                      ) ? (
                        <MenuItem
                          value={selectedWorkOrder.costCodeId ?? ''}
                          disabled
                        >
                          {selectedWorkOrder.costCode.costCode} —{' '}
                          {selectedWorkOrder.costCode.costName} — inactive current
                        </MenuItem>
                      ) : null}
                      {(workOrderOptions.data?.data.costCodes ?? []).map(
                        (cost) => (
                          <MenuItem key={cost.id} value={cost.id}>
                            {cost.costCode} — {cost.costName}
                          </MenuItem>
                        ),
                      )}
                    </TextField>
                  </Stack>
                  <TextField
                    label="Work Order Scope"
                    value={workOrderScope}
                    disabled={!canEditCurrentWorkOrder}
                    onChange={(event) =>
                      setWorkOrderScope(event.target.value)
                    }
                    multiline
                    minRows={3}
                  />
                  {canEditCurrentWorkOrder ? (
                    <Button
                      variant="outlined"
                      onClick={() =>
                        workOrderAction.mutate({
                          action: 'save',
                          workOrder: selectedWorkOrder,
                        })
                      }
                      disabled={
                        workOrderAction.isPending ||
                        !workOrderScope.trim() ||
                        !workOrderAmount
                      }
                    >
                      Save Work Order Draft
                    </Button>
                  ) : null}

                  {canSubmitWorkOrder ? (
                    <TextField
                      select
                      label="Work Order approval workflow"
                      value={workOrderWorkflow}
                      onChange={(event) =>
                        setWorkOrderWorkflow(event.target.value)
                      }
                      sx={{ maxWidth: 360 }}
                    >
                      {(workOrderWorkflows.data?.data ?? []).map(
                        (workflow) => (
                          <MenuItem
                            key={workflow.id}
                            value={workflow.workflowCode}
                          >
                            {workflow.workflowName}
                          </MenuItem>
                        ),
                      )}
                    </TextField>
                  ) : null}

                  {selectedWorkOrder.approvalState === 'DRAFT' &&
                  canSubmitWorkOrder ? (
                    <Button
                      variant="contained"
                      onClick={() =>
                        workOrderAction.mutate({
                          action: 'submit',
                          workOrder: selectedWorkOrder,
                        })
                      }
                      disabled={
                        workOrderAction.isPending || !workOrderWorkflow
                      }
                    >
                      Submit Work Order
                    </Button>
                  ) : null}

                  {selectedWorkOrder.approvalState === 'SUBMITTED' ? (
                    <>
                      <TextField
                        label="Approval / rejection comment"
                        value={workOrderComment}
                        onChange={(event) =>
                          setWorkOrderComment(event.target.value)
                        }
                      />
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        flexWrap="wrap"
                      >
                        {canApproveWorkOrder ? (
                          <Button
                            color="success"
                            variant="contained"
                            onClick={() =>
                              workOrderAction.mutate({
                                action: 'approve',
                                workOrder: selectedWorkOrder,
                              })
                            }
                          >
                            Approve Work Order
                          </Button>
                        ) : null}
                        {canRejectWorkOrder ? (
                          <Button
                            color="error"
                            variant="outlined"
                            onClick={() =>
                              workOrderAction.mutate({
                                action: 'reject',
                                workOrder: selectedWorkOrder,
                              })
                            }
                          >
                            Reject Work Order
                          </Button>
                        ) : null}
                      </Stack>
                    </>
                  ) : null}

                  {selectedWorkOrder.approvalInstance?.actions.map(
                    (action) => (
                      <Typography
                        key={action.id}
                        variant="caption"
                        color="text.secondary"
                      >
                        Step {action.approvalStep.stepNo} · {action.action} ·{' '}
                        {action.actionByUser.displayName}
                        {action.comment ? ' · ' + action.comment : ''}
                      </Typography>
                    ),
                  )}
                </>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}

export function SubcontractsWorkspace({
  permissions,
}: {
  permissions: string[];
}) {
  const canSeeRegister = permissions.includes(
    'subcontracts.subcontractor.view',
  );
  const canSeeAgreements = permissions.includes('subcontracts.agreement.view');
  const [tab, setTab] = useState(canSeeRegister ? 'register' : 'agreements');

  if (!canSeeRegister && !canSeeAgreements) {
    return <Alert severity="warning">No Subcontracts permission is assigned.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Tabs value={tab} onChange={(_event, value: string) => setTab(value)}>
        {canSeeRegister ? <Tab value="register" label="Subcontractors" /> : null}
        {canSeeAgreements ? <Tab value="agreements" label="Agreements" /> : null}
      </Tabs>
      {tab === 'register' && canSeeRegister ? (
        <SubcontractorsPanel permissions={permissions} />
      ) : null}
      {tab === 'agreements' && canSeeAgreements ? (
        <AgreementsPanel permissions={permissions} />
      ) : null}
    </Stack>
  );
}
