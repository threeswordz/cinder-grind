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
  SubcontractorRecord,
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
        supplierId: supplierId || null,
        registrationNumber: registration || null,
        contactName: contact || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
      };
      return newMode || !selected
        ? subcontractsApi.createSubcontractor(body)
        : subcontractsApi.updateSubcontractor(selected.id, body);
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
            {(newMode || selected) && canManage ? (
              <>
                <Divider />
                <Typography variant="subtitle1">
                  {newMode ? 'Create Subcontractor' : 'Edit Subcontractor'}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    label="Code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <TextField
                    label="Name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    sx={{ flexGrow: 1 }}
                  />
                  <TextField
                    select
                    label="Optional Supplier link"
                    value={supplierId}
                    onChange={(event) => setSupplierId(event.target.value)}
                    sx={{ minWidth: 260 }}
                  >
                    <MenuItem value="">No Supplier link</MenuItem>
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
                    onChange={(event) => setRegistration(event.target.value)}
                  />
                  <TextField
                    label="Contact"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                  />
                  <TextField
                    label="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <TextField
                    label="Phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </Stack>
                <TextField
                  label="Address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  multiline
                  minRows={2}
                />
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    onClick={() => save.mutate()}
                    disabled={save.isPending || !code.trim() || !name.trim()}
                  >
                    Save
                  </Button>
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

function AgreementsPanel({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canCreate = permissions.includes('subcontracts.agreement.create');
  const canEdit = permissions.includes('subcontracts.agreement.edit');
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

  const agreements = useQuery({
    queryKey: ['subcontracts', 'agreements', projectFilter, search],
    queryFn: () =>
      subcontractsApi.agreements({
        projectId: projectFilter || undefined,
        search: search || undefined,
      }),
  });
  const projects = useQuery({
    queryKey: ['subcontracts', 'projects'],
    queryFn: subcontractsApi.projects,
  });
  const subcontractors = useQuery({
    queryKey: ['subcontracts', 'subcontractors', false, ''],
    queryFn: () => subcontractsApi.subcontractors(),
  });
  const statuses = useQuery({
    queryKey: ['subcontracts', 'statuses'],
    queryFn: subcontractsApi.statuses,
  });
  const selected = useMemo(
    () =>
      (agreements.data?.data ?? []).find((row) => row.id === selectedId) ??
      null,
    [agreements.data?.data, selectedId],
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
            operationalStatusId: statusId || null,
          }),
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      setNewMode(false);
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
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Agreement Drafts
        </Typography>
        {canCreate ? (
          <Button variant="outlined" onClick={beginNew}>
            New Agreement Draft
          </Button>
        ) : null}
      </Stack>
      <Alert severity="info">
        Stage A creates Draft agreement identity and scope. Submission,
        approval, revisions, cancellation and Work Orders begin in Stage B.
      </Alert>
      {save.error ? (
        <Alert severity="error">
          {save.error instanceof Error ? save.error.message : 'Request failed.'}
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
                  }}
                />
              ))}
            </Stack>
            {agreements.isSuccess && agreements.data.data.length === 0 ? (
              <Alert severity="info">No agreement Draft matches the filters.</Alert>
            ) : null}
            {(newMode || selected) &&
            (newMode ? canCreate : canEdit) ? (
              <>
                <Divider />
                <Typography variant="subtitle1">
                  {newMode
                    ? 'Create Agreement Draft'
                    : selected?.agreementNumber + ' · Edit Draft'}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    select
                    label="Project"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    disabled={!newMode}
                    sx={{ minWidth: 280, flexGrow: 1 }}
                  >
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
                    onChange={(event) => setValue(event.target.value)}
                  />
                  <TextField
                    label="Currency"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                  />
                  <TextField
                    select
                    label="Operational status"
                    value={statusId}
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
                  onChange={(event) => setScope(event.target.value)}
                  multiline
                  minRows={4}
                />
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
              </>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
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
