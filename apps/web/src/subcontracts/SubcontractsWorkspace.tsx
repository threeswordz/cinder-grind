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
  const canWorkOrderView = permissions.includes('subcontracts.work_order.view');
  const canWorkOrderCreate = permissions.includes('subcontracts.work_order.create');
  const canWorkOrderEdit = permissions.includes('subcontracts.work_order.edit');
  const canWorkOrderSubmit = permissions.includes('subcontracts.work_order.submit');
  const canWorkOrderApprove = permissions.includes('subcontracts.work_order.approve');
  const canWorkOrderReject = permissions.includes('subcontracts.work_order.reject');

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
  const [agreementWorkflowCode, setAgreementWorkflowCode] = useState('');
  const [agreementComment, setAgreementComment] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionStatusId, setRevisionStatusId] = useState('');

  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [newWorkOrder, setNewWorkOrder] = useState(false);
  const [workOrderScope, setWorkOrderScope] = useState('');
  const [workOrderAmount, setWorkOrderAmount] = useState('');
  const [workOrderWbsId, setWorkOrderWbsId] = useState('');
  const [workOrderCostCodeId, setWorkOrderCostCodeId] = useState('');
  const [workOrderWorkflowCode, setWorkOrderWorkflowCode] = useState('');
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
    enabled: canWorkOrderSubmit,
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
  const selectedVersion = useMemo(
    () =>
      (versions.data?.data ?? []).find((row) => row.id === selectedVersionId) ??
      null,
    [versions.data?.data, selectedVersionId],
  );

  const workOrders = useQuery({
    queryKey: ['subcontracts', 'work-orders', selectedId],
    queryFn: () => subcontractsApi.workOrders(selectedId),
    enabled: Boolean(selectedId && canWorkOrderView),
  });
  const workOrderOptions = useQuery({
    queryKey: ['subcontracts', 'work-order-options', selectedId],
    queryFn: () => subcontractsApi.workOrderOptions(selectedId),
    enabled: Boolean(
      selectedId &&
        canWorkOrderView &&
        selected?.approvalState === 'APPROVED' &&
        !selected.cancelledAt,
    ),
  });
  const selectedWorkOrder = useMemo(
    () =>
      (workOrders.data?.data ?? []).find(
        (row) => row.id === selectedWorkOrderId,
      ) ?? null,
    [workOrders.data?.data, selectedWorkOrderId],
  );

  useEffect(() => {
    if (!selected || newMode) return;
    setProjectId(selected.projectId);
    setSubcontractorId(selected.subcontractorId);
    setValue(selected.originalValue);
    setScope(selected.scopeOfWork);
    setCurrency(selected.currencyCode);
    setStatusId(selected.operationalStatusId ?? '');
  }, [selected, newMode]);

  useEffect(() => {
    const rows = versions.data?.data ?? [];
    if (!rows.length) {
      setSelectedVersionId('');
      return;
    }
    if (!rows.some((row) => row.id === selectedVersionId)) {
      setSelectedVersionId(rows[rows.length - 1]!.id);
    }
  }, [versions.data?.data, selectedVersionId]);

  useEffect(() => {
    if (!selectedVersion) return;
    setRevisionReason(selectedVersion.reason ?? '');
    setRevisionStatusId(selectedVersion.operationalStatusId ?? '');
  }, [selectedVersion]);

  useEffect(() => {
    if (!selectedWorkOrder || newWorkOrder) return;
    setWorkOrderScope(selectedWorkOrder.scopeOfWork);
    setWorkOrderAmount(selectedWorkOrder.amount);
    setWorkOrderWbsId(selectedWorkOrder.wbsElementId ?? '');
    setWorkOrderCostCodeId(selectedWorkOrder.costCodeId ?? '');
  }, [selectedWorkOrder, newWorkOrder]);

  useEffect(() => {
    if (
      !agreementWorkflowCode &&
      (agreementWorkflows.data?.data.length ?? 0) > 0
    ) {
      setAgreementWorkflowCode(
        agreementWorkflows.data!.data[0]!.workflowCode,
      );
    }
  }, [agreementWorkflows.data, agreementWorkflowCode]);

  useEffect(() => {
    if (
      !workOrderWorkflowCode &&
      (workOrderWorkflows.data?.data.length ?? 0) > 0
    ) {
      setWorkOrderWorkflowCode(
        workOrderWorkflows.data!.data[0]!.workflowCode,
      );
    }
  }, [workOrderWorkflows.data, workOrderWorkflowCode]);

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
    mutationFn: async (action: 'submit' | 'approve' | 'reject' | 'cancel') => {
      if (!selected) throw new Error('Select an agreement first.');
      const actionKey = crypto.randomUUID();
      if (action === 'submit') {
        if (!agreementWorkflowCode) throw new Error('Select an approval workflow.');
        return subcontractsApi.submitAgreement(
          selected.id,
          agreementWorkflowCode,
          actionKey,
        );
      }
      if (action === 'approve') {
        return subcontractsApi.approveAgreement(
          selected.id,
          actionKey,
          agreementComment || undefined,
        );
      }
      if (action === 'reject') {
        return subcontractsApi.rejectAgreement(
          selected.id,
          actionKey,
          agreementComment || undefined,
        );
      }
      if (!cancelReason.trim()) throw new Error('Cancellation reason is required.');
      return subcontractsApi.cancelAgreement(
        selected.id,
        cancelReason,
        actionKey,
      );
    },
    onSuccess: async () => {
      setAgreementComment('');
      setCancelReason('');
      await refresh();
    },
  });

  const createRevision = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select an agreement first.');
      if (!revisionReason.trim()) throw new Error('Revision reason is required.');
      return subcontractsApi.createAgreementRevision(selected.id, {
        operationalStatusId: revisionStatusId || null,
        reason: revisionReason,
      });
    },
    onSuccess: async (result) => {
      setSelectedVersionId(result.data.id);
      await refresh();
    },
  });

  const saveRevision = useMutation({
    mutationFn: () => {
      if (!selectedVersion) throw new Error('Select a revision first.');
      return subcontractsApi.updateAgreementRevision(selectedVersion.id, {
        operationalStatusId: revisionStatusId || null,
        reason: revisionReason,
      });
    },
    onSuccess: refresh,
  });

  const revisionAction = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'reject') => {
      if (!selectedVersion) throw new Error('Select a revision first.');
      const actionKey = crypto.randomUUID();
      if (action === 'submit') {
        if (!agreementWorkflowCode) throw new Error('Select an approval workflow.');
        return subcontractsApi.submitAgreementRevision(
          selectedVersion.id,
          agreementWorkflowCode,
          actionKey,
        );
      }
      if (action === 'approve') {
        return subcontractsApi.approveAgreementRevision(
          selectedVersion.id,
          actionKey,
          agreementComment || undefined,
        );
      }
      return subcontractsApi.rejectAgreementRevision(
        selectedVersion.id,
        actionKey,
        agreementComment || undefined,
      );
    },
    onSuccess: async () => {
      setAgreementComment('');
      await refresh();
    },
  });

  const saveWorkOrder = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select an agreement first.');
      const body = {
        scopeOfWork: workOrderScope,
        amount: workOrderAmount,
        wbsElementId: workOrderWbsId || null,
        costCodeId: workOrderCostCodeId || null,
      };
      if (newWorkOrder || !selectedWorkOrder) {
        return subcontractsApi.createWorkOrder(selected.id, body);
      }
      return subcontractsApi.updateWorkOrder(selectedWorkOrder.id, body);
    },
    onSuccess: async (result) => {
      setSelectedWorkOrderId(result.data.id);
      setNewWorkOrder(false);
      await refresh();
    },
  });

  const workOrderAction = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'reject') => {
      if (!selectedWorkOrder) throw new Error('Select a Work Order first.');
      const actionKey = crypto.randomUUID();
      if (action === 'submit') {
        if (!workOrderWorkflowCode) throw new Error('Select an approval workflow.');
        return subcontractsApi.submitWorkOrder(
          selectedWorkOrder.id,
          workOrderWorkflowCode,
          actionKey,
        );
      }
      if (action === 'approve') {
        return subcontractsApi.approveWorkOrder(
          selectedWorkOrder.id,
          actionKey,
          workOrderComment || undefined,
        );
      }
      return subcontractsApi.rejectWorkOrder(
        selectedWorkOrder.id,
        actionKey,
        workOrderComment || undefined,
      );
    },
    onSuccess: async () => {
      setWorkOrderComment('');
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
    setSelectedVersionId('');
    setSelectedWorkOrderId('');
  };

  const beginNewWorkOrder = () => {
    setNewWorkOrder(true);
    setSelectedWorkOrderId('');
    setWorkOrderScope('');
    setWorkOrderAmount('');
    setWorkOrderWbsId('');
    setWorkOrderCostCodeId('');
  };

  const isEditableDraft =
    Boolean(selected) &&
    selected?.approvalState === 'DRAFT' &&
    !selected.firstApprovedAt &&
    !selected.cancelledAt;
  const canEditSelected = Boolean(isEditableDraft && canEdit);
  const agreementRequestError =
    save.error ??
    agreementAction.error ??
    createRevision.error ??
    saveRevision.error ??
    revisionAction.error;
  const workOrderRequestError = saveWorkOrder.error ?? workOrderAction.error;

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
        Stage B uses configured approval workflows and maker-checker. First-approved
        value, scope and currency are retained commercial history; administrative
        revisions can change only configured operational status.
      </Alert>
      {agreementRequestError ? (
        <Alert severity="error">
          {agreementRequestError instanceof Error
            ? agreementRequestError.message
            : 'Agreement workflow request failed.'}
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
                    setSelectedVersionId('');
                    setSelectedWorkOrderId('');
                    setNewWorkOrder(false);
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
                <Typography variant="subtitle1">
                  {newMode
                    ? 'Create Agreement Draft'
                    : selected?.agreementNumber + ' · ' + selected?.approvalState}
                </Typography>
                {selected?.cancelledAt ? (
                  <Alert severity="warning">
                    Cancelled: {selected.cancellationReason}
                  </Alert>
                ) : null}
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
                        {selected.project.projectCode} — {selected.project.projectName}
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
                    disabled={!newMode && !canEditSelected}
                    onChange={(event) => setValue(event.target.value)}
                  />
                  <TextField
                    label="Currency"
                    value={currency}
                    disabled={!newMode && !canEditSelected}
                    onChange={(event) => setCurrency(event.target.value)}
                  />
                  <TextField
                    select
                    label="Operational status"
                    value={statusId}
                    disabled={!newMode && !canEditSelected}
                    onChange={(event) => setStatusId(event.target.value)}
                    sx={{ minWidth: 220 }}
                  >
                    <MenuItem value="">No configured status</MenuItem>
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
                  disabled={!newMode && !canEditSelected}
                  onChange={(event) => setScope(event.target.value)}
                  multiline
                  minRows={4}
                />
                {(newMode ? canCreate : canEditSelected) ? (
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
                    <Typography variant="subtitle2">Agreement workflow</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      {canSubmit ? (
                        <TextField
                          select
                          label="Approval workflow"
                          value={agreementWorkflowCode}
                          onChange={(event) =>
                            setAgreementWorkflowCode(event.target.value)
                          }
                          sx={{ minWidth: 280 }}
                        >
                          {(agreementWorkflows.data?.data ?? []).map((workflow) => (
                            <MenuItem
                              key={workflow.id}
                              value={workflow.workflowCode}
                            >
                              {workflow.workflowName}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : null}
                      <TextField
                        label="Approval comment"
                        value={agreementComment}
                        onChange={(event) => setAgreementComment(event.target.value)}
                        sx={{ flexGrow: 1 }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {selected.approvalState === 'DRAFT' &&
                      !selected.firstApprovedAt &&
                      canSubmit ? (
                        <Button
                          variant="contained"
                          onClick={() => agreementAction.mutate('submit')}
                          disabled={
                            agreementAction.isPending || !agreementWorkflowCode
                          }
                        >
                          Submit Agreement
                        </Button>
                      ) : null}
                      {selected.approvalState === 'SUBMITTED' && canApprove ? (
                        <Button
                          color="success"
                          onClick={() => agreementAction.mutate('approve')}
                          disabled={agreementAction.isPending}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {selected.approvalState === 'SUBMITTED' && canReject ? (
                        <Button
                          color="warning"
                          onClick={() => agreementAction.mutate('reject')}
                          disabled={agreementAction.isPending}
                        >
                          Reject
                        </Button>
                      ) : null}
                    </Stack>
                    {selected.approvalState === 'APPROVED' && canCancel ? (
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <TextField
                          label="Cancellation reason"
                          value={cancelReason}
                          onChange={(event) => setCancelReason(event.target.value)}
                          sx={{ flexGrow: 1 }}
                        />
                        <Button
                          color="error"
                          onClick={() => agreementAction.mutate('cancel')}
                          disabled={
                            agreementAction.isPending || !cancelReason.trim()
                          }
                        >
                          Cancel Agreement
                        </Button>
                      </Stack>
                    ) : null}

                    <Divider />
                    <Typography variant="subtitle2">
                      Retained agreement versions
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {(versions.data?.data ?? []).map((version) => (
                        <Chip
                          key={version.id}
                          label={'V' + version.versionNo + ' · ' + version.approvalState}
                          color={
                            version.id === selectedVersionId
                              ? 'primary'
                              : 'default'
                          }
                          onClick={() => setSelectedVersionId(version.id)}
                        />
                      ))}
                    </Stack>
                    {selectedVersion ? (
                      <Card variant="outlined">
                        <CardContent>
                          <Stack spacing={1.5}>
                            <Typography variant="body2">
                              Version {selectedVersion.versionNo} ·{' '}
                              {selectedVersion.approvalState}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Commercial snapshot: {selectedVersion.currencyCode}{' '}
                              {selectedVersion.originalValue} ·{' '}
                              {selectedVersion.scopeOfWork}
                            </Typography>
                            {selectedVersion.versionNo > 1 ? (
                              <>
                                <TextField
                                  select
                                  label="Operational status"
                                  value={revisionStatusId}
                                  disabled={
                                    selectedVersion.approvalState !== 'DRAFT' ||
                                    !canRevise
                                  }
                                  onChange={(event) =>
                                    setRevisionStatusId(event.target.value)
                                  }
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
                                    selectedVersion.approvalState !== 'DRAFT' ||
                                    !canRevise
                                  }
                                  onChange={(event) =>
                                    setRevisionReason(event.target.value)
                                  }
                                />
                              </>
                            ) : null}
                            <ApprovalTrail
                              instance={selectedVersion.approvalInstance}
                            />
                            <Stack
                              direction="row"
                              spacing={1}
                              useFlexGap
                              flexWrap="wrap"
                            >
                              {selectedVersion.versionNo > 1 &&
                              selectedVersion.approvalState === 'DRAFT' &&
                              canRevise ? (
                                <Button
                                  onClick={() => saveRevision.mutate()}
                                  disabled={
                                    saveRevision.isPending || !revisionReason.trim()
                                  }
                                >
                                  Save Revision
                                </Button>
                              ) : null}
                              {selectedVersion.versionNo > 1 &&
                              selectedVersion.approvalState === 'DRAFT' &&
                              canSubmit ? (
                                <Button
                                  variant="contained"
                                  onClick={() => revisionAction.mutate('submit')}
                                  disabled={
                                    revisionAction.isPending ||
                                    !agreementWorkflowCode ||
                                    !revisionReason.trim()
                                  }
                                >
                                  Submit Revision
                                </Button>
                              ) : null}
                              {selectedVersion.versionNo > 1 &&
                              selectedVersion.approvalState === 'SUBMITTED' &&
                              canApprove ? (
                                <Button
                                  color="success"
                                  onClick={() => revisionAction.mutate('approve')}
                                  disabled={revisionAction.isPending}
                                >
                                  Approve Revision
                                </Button>
                              ) : null}
                              {selectedVersion.versionNo > 1 &&
                              selectedVersion.approvalState === 'SUBMITTED' &&
                              canReject ? (
                                <Button
                                  color="warning"
                                  onClick={() => revisionAction.mutate('reject')}
                                  disabled={revisionAction.isPending}
                                >
                                  Reject Revision
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ) : null}
                    {selected.approvalState === 'APPROVED' && canRevise ? (
                      <Card variant="outlined">
                        <CardContent>
                          <Stack spacing={1.5}>
                            <Typography variant="subtitle2">
                              New administrative revision
                            </Typography>
                            <TextField
                              select
                              label="New operational status"
                              value={revisionStatusId}
                              onChange={(event) =>
                                setRevisionStatusId(event.target.value)
                              }
                            >
                              <MenuItem value="">No configured status</MenuItem>
                              {(statuses.data?.data ?? []).map((status) => (
                                <MenuItem key={status.id} value={status.id}>
                                  {status.statusLabel}
                                </MenuItem>
                              ))}
                            </TextField>
                            <TextField
                              label="Required revision reason"
                              value={revisionReason}
                              onChange={(event) =>
                                setRevisionReason(event.target.value)
                              }
                            />
                            <Button
                              onClick={() => createRevision.mutate()}
                              disabled={
                                createRevision.isPending || !revisionReason.trim()
                              }
                            >
                              Create Revision Draft
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {selected && canWorkOrderView ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Work Orders
                </Typography>
                {selected.approvalState === 'APPROVED' &&
                !selected.cancelledAt &&
                canWorkOrderCreate ? (
                  <Button variant="outlined" onClick={beginNewWorkOrder}>
                    New Work Order
                  </Button>
                ) : null}
              </Stack>
              <Alert severity="info">
                Work Orders allocate within the agreement ceiling; they do not
                increase the commercial ceiling or create a second commitment.
              </Alert>
              {workOrderRequestError ? (
                <Alert severity="error">
                  {workOrderRequestError instanceof Error
                    ? workOrderRequestError.message
                    : 'Work Order request failed.'}
                </Alert>
              ) : null}
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {(workOrders.data?.data ?? []).map((workOrder) => (
                  <Chip
                    key={workOrder.id}
                    label={
                      workOrder.workOrderNumber +
                      ' · ' +
                      workOrder.approvalState +
                      ' · ' +
                      workOrder.agreement.currencyCode +
                      ' ' +
                      workOrder.amount
                    }
                    color={
                      workOrder.id === selectedWorkOrderId
                        ? 'primary'
                        : 'default'
                    }
                    onClick={() => {
                      setNewWorkOrder(false);
                      setSelectedWorkOrderId(workOrder.id);
                    }}
                  />
                ))}
              </Stack>

              {(newWorkOrder && canWorkOrderCreate) || selectedWorkOrder ? (
                <>
                  <Divider />
                  <Typography variant="subtitle2">
                    {newWorkOrder
                      ? 'Create Work Order Draft'
                      : selectedWorkOrder?.workOrderNumber +
                        ' · ' +
                        selectedWorkOrder?.approvalState}
                  </Typography>
                  <TextField
                    label="Scope of Work"
                    value={workOrderScope}
                    disabled={
                      !newWorkOrder &&
                      (selectedWorkOrder?.approvalState !== 'DRAFT' ||
                        !canWorkOrderEdit)
                    }
                    onChange={(event) => setWorkOrderScope(event.target.value)}
                    multiline
                    minRows={3}
                  />
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label={
                        'Amount (' +
                        (selectedWorkOrder?.agreement.currencyCode ??
                          selected.currencyCode) +
                        ')'
                      }
                      value={workOrderAmount}
                      disabled={
                        !newWorkOrder &&
                        (selectedWorkOrder?.approvalState !== 'DRAFT' ||
                          !canWorkOrderEdit)
                      }
                      onChange={(event) =>
                        setWorkOrderAmount(event.target.value)
                      }
                    />
                    <TextField
                      select
                      label="WBS"
                      value={workOrderWbsId}
                      disabled={
                        !newWorkOrder &&
                        (selectedWorkOrder?.approvalState !== 'DRAFT' ||
                          !canWorkOrderEdit)
                      }
                      onChange={(event) =>
                        setWorkOrderWbsId(event.target.value)
                      }
                      sx={{ minWidth: 220 }}
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
                      label="Cost Code"
                      value={workOrderCostCodeId}
                      disabled={
                        !newWorkOrder &&
                        (selectedWorkOrder?.approvalState !== 'DRAFT' ||
                          !canWorkOrderEdit)
                      }
                      onChange={(event) =>
                        setWorkOrderCostCodeId(event.target.value)
                      }
                      sx={{ minWidth: 220 }}
                    >
                      <MenuItem value="">No Cost Code</MenuItem>
                      {(workOrderOptions.data?.data.costCodes ?? []).map(
                        (costCode) => (
                          <MenuItem key={costCode.id} value={costCode.id}>
                            {costCode.costCode} — {costCode.costName}
                          </MenuItem>
                        ),
                      )}
                    </TextField>
                  </Stack>
                  {(newWorkOrder
                    ? canWorkOrderCreate
                    : selectedWorkOrder?.approvalState === 'DRAFT' &&
                      canWorkOrderEdit) ? (
                    <Button
                      onClick={() => saveWorkOrder.mutate()}
                      disabled={
                        saveWorkOrder.isPending ||
                        !workOrderScope.trim() ||
                        !workOrderAmount
                      }
                    >
                      Save Work Order Draft
                    </Button>
                  ) : null}
                  {selectedWorkOrder ? (
                    <>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        {canWorkOrderSubmit ? (
                          <TextField
                            select
                            label="Work Order approval workflow"
                            value={workOrderWorkflowCode}
                            onChange={(event) =>
                              setWorkOrderWorkflowCode(event.target.value)
                            }
                            sx={{ minWidth: 280 }}
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
                        <TextField
                          label="Approval comment"
                          value={workOrderComment}
                          onChange={(event) =>
                            setWorkOrderComment(event.target.value)
                          }
                          sx={{ flexGrow: 1 }}
                        />
                      </Stack>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {selectedWorkOrder.approvalState === 'DRAFT' &&
                        canWorkOrderSubmit ? (
                          <Button
                            variant="contained"
                            onClick={() => workOrderAction.mutate('submit')}
                            disabled={
                              workOrderAction.isPending ||
                              !workOrderWorkflowCode
                            }
                          >
                            Submit Work Order
                          </Button>
                        ) : null}
                        {selectedWorkOrder.approvalState === 'SUBMITTED' &&
                        canWorkOrderApprove ? (
                          <Button
                            color="success"
                            onClick={() => workOrderAction.mutate('approve')}
                            disabled={workOrderAction.isPending}
                          >
                            Approve Work Order
                          </Button>
                        ) : null}
                        {selectedWorkOrder.approvalState === 'SUBMITTED' &&
                        canWorkOrderReject ? (
                          <Button
                            color="warning"
                            onClick={() => workOrderAction.mutate('reject')}
                            disabled={workOrderAction.isPending}
                          >
                            Reject Work Order
                          </Button>
                        ) : null}
                      </Stack>
                      <ApprovalTrail
                        instance={selectedWorkOrder.approvalInstance}
                      />
                    </>
                  ) : null}
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
