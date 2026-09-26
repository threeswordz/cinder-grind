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
  BoqItem,
  BoqSection,
  budgetApi,
} from '../api/budget';

function money(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function BudgetPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const queryClient = useQueryClient();
  const canManage = permissions.includes('budget.boq.manage');
  const canSubmit = permissions.includes('budget.revision.submit');
  const canApprove = permissions.includes('budget.revision.approve');

  const [projectId, setProjectId] = useState('');
  const [boqName, setBoqName] = useState('Project BOQ');

  const [editingSectionId, setEditingSectionId] = useState('');
  const [sectionCode, setSectionCode] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionSortOrder, setSectionSortOrder] = useState('0');

  const [editingItemId, setEditingItemId] = useState('');
  const [itemSectionId, setItemSectionId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [uomId, setUomId] = useState('');
  const [rate, setRate] = useState('');
  const [wbsId, setWbsId] = useState('');
  const [costCodeId, setCostCodeId] = useState('');
  const [itemSortOrder, setItemSortOrder] = useState('0');

  const [revisionNote, setRevisionNote] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [approvalComment, setApprovalComment] = useState('');

  const projects = useQuery({
    queryKey: ['budget', 'projects'],
    queryFn: budgetApi.projects,
  });
  const boq = useQuery({
    queryKey: ['budget', 'boq', projectId],
    queryFn: () => budgetApi.boq(projectId),
    enabled: Boolean(projectId),
  });
  const options = useQuery({
    queryKey: ['budget', 'options', projectId],
    queryFn: () => budgetApi.options(projectId),
    enabled: Boolean(projectId),
  });
  const revisions = useQuery({
    queryKey: ['budget', 'revisions', projectId],
    queryFn: () => budgetApi.revisions(projectId),
    enabled: Boolean(projectId),
  });
  const summary = useQuery({
    queryKey: ['budget', 'summary', projectId],
    queryFn: () => budgetApi.summary(projectId),
    enabled: Boolean(projectId),
  });
  const workflows = useQuery({
    queryKey: ['budget', 'workflows'],
    queryFn: budgetApi.workflows,
    enabled: canSubmit,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['budget'] });
  };

  const createBoq = useMutation({
    mutationFn: () => budgetApi.createBoq(projectId, boqName),
    onSuccess: refresh,
  });
  const updateBoq = useMutation({
    mutationFn: () => budgetApi.updateBoq(projectId, boqName),
    onSuccess: refresh,
  });

  const sectionMutation = useMutation({
    mutationFn: () =>
      editingSectionId
        ? budgetApi.updateSection(editingSectionId, {
            sectionCode,
            sectionName,
            description: sectionDescription || null,
            sortOrder: Number(sectionSortOrder || 0),
          })
        : budgetApi.createSection(boq.data!.data!.id, {
            sectionCode,
            sectionName,
            description: sectionDescription || null,
            sortOrder: Number(sectionSortOrder || 0),
          }),
    onSuccess: async () => {
      clearSection();
      await refresh();
    },
  });
  const toggleSection = useMutation({
    mutationFn: (row: BoqSection) =>
      budgetApi.updateSection(row.id, { isActive: !row.isActive }),
    onSuccess: refresh,
  });

  const itemMutation = useMutation({
    mutationFn: () => {
      const body = {
        sectionId: itemSectionId,
        itemCode,
        description: itemDescription,
        quantity,
        uomId,
        rate,
        wbsId: wbsId || null,
        costCodeId: costCodeId || null,
        sortOrder: Number(itemSortOrder || 0),
      };
      return editingItemId
        ? budgetApi.updateItem(editingItemId, body)
        : budgetApi.createItem(boq.data!.data!.id, body);
    },
    onSuccess: async () => {
      clearItem();
      await refresh();
    },
  });
  const toggleItem = useMutation({
    mutationFn: (row: BoqItem) =>
      budgetApi.updateItem(row.id, { isActive: !row.isActive }),
    onSuccess: refresh,
  });

  const createDraft = useMutation({
    mutationFn: () =>
      budgetApi.createRevisionDraft(projectId, revisionNote || null),
    onSuccess: async () => {
      setRevisionNote('');
      await refresh();
    },
  });
  const submitRevision = useMutation({
    mutationFn: (revisionId: string) =>
      budgetApi.submitRevision(revisionId, workflowCode),
    onSuccess: refresh,
  });
  const approveRevision = useMutation({
    mutationFn: (revisionId: string) =>
      budgetApi.approveRevision(revisionId, approvalComment || null),
    onSuccess: async () => {
      setApprovalComment('');
      await refresh();
    },
  });
  const rejectRevision = useMutation({
    mutationFn: (revisionId: string) =>
      budgetApi.rejectRevision(revisionId, approvalComment || null),
    onSuccess: async () => {
      setApprovalComment('');
      await refresh();
    },
  });

  const error =
    createBoq.error ??
    updateBoq.error ??
    sectionMutation.error ??
    toggleSection.error ??
    itemMutation.error ??
    toggleItem.error ??
    createDraft.error ??
    submitRevision.error ??
    approveRevision.error ??
    rejectRevision.error;

  const currentBoq = boq.data?.data ?? null;

  useEffect(() => {
    setBoqName(currentBoq?.boqName ?? 'Project BOQ');
  }, [projectId, currentBoq?.boqName]);

  const activeSections = useMemo(
    () => (currentBoq?.sections ?? []).filter((row) => row.isActive),
    [currentBoq?.sections],
  );

  function clearSection() {
    setEditingSectionId('');
    setSectionCode('');
    setSectionName('');
    setSectionDescription('');
    setSectionSortOrder('0');
  }

  function editSection(row: BoqSection) {
    setEditingSectionId(row.id);
    setSectionCode(row.sectionCode);
    setSectionName(row.sectionName);
    setSectionDescription(row.description ?? '');
    setSectionSortOrder(String(row.sortOrder));
  }

  function clearItem() {
    setEditingItemId('');
    setItemSectionId('');
    setItemCode('');
    setItemDescription('');
    setQuantity('');
    setUomId('');
    setRate('');
    setWbsId('');
    setCostCodeId('');
    setItemSortOrder('0');
  }

  function editItem(row: BoqItem) {
    setEditingItemId(row.id);
    setItemSectionId(row.sectionId);
    setItemCode(row.itemCode);
    setItemDescription(row.description);
    setQuantity(row.quantity);
    setUomId(row.uomId);
    setRate(row.rate);
    setWbsId(row.wbsId ?? '');
    setCostCodeId(row.costCodeId ?? '');
    setItemSortOrder(String(row.sortOrder));
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6">BOQ & Budget</Typography>

      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          clearSection();
          clearItem();
        }}
      >
        <MenuItem value="">Select Project</MenuItem>
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} · {project.projectName}
          </MenuItem>
        ))}
      </TextField>

      {error ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Budget request failed.'}
        </Alert>
      ) : null}

      {!projectId ? (
        <Alert severity="info">
          Select a Project to maintain its canonical BOQ and Budget history.
        </Alert>
      ) : null}

      {projectId && !currentBoq && !boq.isLoading ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Create canonical Project BOQ
              </Typography>
              <TextField
                label="BOQ name"
                value={boqName}
                onChange={(event) => setBoqName(event.target.value)}
              />
              {canManage ? (
                <Button
                  variant="contained"
                  disabled={!boqName.trim() || createBoq.isPending}
                  onClick={() => createBoq.mutate()}
                >
                  Create BOQ
                </Button>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {currentBoq ? (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Canonical BOQ</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label="BOQ name"
                    value={boqName}
                    onChange={(event) => setBoqName(event.target.value)}
                    sx={{ flexGrow: 1 }}
                  />
                  {canManage ? (
                    <Button
                      onClick={() => updateBoq.mutate()}
                      disabled={updateBoq.isPending}
                    >
                      Save Name
                    </Button>
                  ) : null}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Active BOQ total:{' '}
                  {money(
                    currentBoq.items
                      .filter((row) => row.isActive)
                      .reduce((sum, row) => sum + Number(row.amount), 0),
                  )}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">BOQ Sections</Typography>
                {(currentBoq.sections ?? []).map((row) => (
                  <Stack
                    key={row.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                  >
                    <Typography sx={{ flexGrow: 1 }}>
                      {row.sectionCode} · {row.sectionName}{' '}
                      {!row.isActive ? '· INACTIVE' : ''}
                    </Typography>
                    {canManage ? (
                      <>
                        <Button onClick={() => editSection(row)}>Edit</Button>
                        <Button onClick={() => toggleSection.mutate(row)}>
                          {row.isActive ? 'Archive' : 'Reactivate'}
                        </Button>
                      </>
                    ) : null}
                  </Stack>
                ))}
                {canManage ? (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">
                      {editingSectionId ? 'Edit Section' : 'Add Section'}
                    </Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        label="Code"
                        value={sectionCode}
                        onChange={(event) => setSectionCode(event.target.value)}
                      />
                      <TextField
                        label="Name"
                        value={sectionName}
                        onChange={(event) => setSectionName(event.target.value)}
                        sx={{ flexGrow: 1 }}
                      />
                      <TextField
                        label="Sort"
                        type="number"
                        value={sectionSortOrder}
                        onChange={(event) => setSectionSortOrder(event.target.value)}
                        sx={{ width: 120 }}
                      />
                    </Stack>
                    <TextField
                      label="Description"
                      value={sectionDescription}
                      onChange={(event) => setSectionDescription(event.target.value)}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        disabled={
                          !sectionCode.trim() ||
                          !sectionName.trim() ||
                          sectionMutation.isPending
                        }
                        onClick={() => sectionMutation.mutate()}
                      >
                        {editingSectionId ? 'Save Section' : 'Add Section'}
                      </Button>
                      {editingSectionId ? (
                        <Button onClick={clearSection}>Cancel</Button>
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
                <Typography variant="subtitle1">BOQ Items</Typography>
                {(currentBoq.items ?? []).map((row) => (
                  <Card key={row.id} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          alignItems={{ sm: 'center' }}
                        >
                          <Typography sx={{ flexGrow: 1 }}>
                            {row.itemCode} · {row.description}
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={row.isActive ? 'ACTIVE' : 'INACTIVE'}
                          />
                          {canManage ? (
                            <>
                              <Button onClick={() => editItem(row)}>Edit</Button>
                              <Button onClick={() => toggleItem.mutate(row)}>
                                {row.isActive ? 'Archive' : 'Reactivate'}
                              </Button>
                            </>
                          ) : null}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {row.section.sectionCode} · {row.quantity}{' '}
                          {row.uom.uomCode} × {money(row.rate)} ={' '}
                          <b>{money(row.amount)}</b>
                          {row.wbs ? ' · WBS ' + row.wbs.wbsCode : ''}
                          {row.costCode
                            ? ' · Cost Code ' + row.costCode.costCode
                            : ''}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {canManage ? (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">
                      {editingItemId ? 'Edit BOQ Item' : 'Add BOQ Item'}
                    </Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        select
                        label="Section"
                        value={itemSectionId}
                        onChange={(event) => setItemSectionId(event.target.value)}
                        sx={{ minWidth: 220 }}
                      >
                        {activeSections.map((row) => (
                          <MenuItem key={row.id} value={row.id}>
                            {row.sectionCode} · {row.sectionName}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Item code"
                        value={itemCode}
                        onChange={(event) => setItemCode(event.target.value)}
                      />
                      <TextField
                        label="Description"
                        value={itemDescription}
                        onChange={(event) => setItemDescription(event.target.value)}
                        sx={{ flexGrow: 1 }}
                      />
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        label="Quantity"
                        type="number"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                      />
                      <TextField
                        select
                        label="UOM"
                        value={uomId}
                        onChange={(event) => setUomId(event.target.value)}
                        sx={{ minWidth: 180 }}
                      >
                        {(options.data?.data.uoms ?? []).map((row) => (
                          <MenuItem key={row.id} value={row.id}>
                            {row.uomCode} · {row.uomName}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Rate"
                        type="number"
                        value={rate}
                        onChange={(event) => setRate(event.target.value)}
                      />
                      <TextField
                        label="Sort"
                        type="number"
                        value={itemSortOrder}
                        onChange={(event) => setItemSortOrder(event.target.value)}
                        sx={{ width: 120 }}
                      />
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        select
                        label="WBS (optional)"
                        value={wbsId}
                        onChange={(event) => setWbsId(event.target.value)}
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="">Unallocated</MenuItem>
                        {(options.data?.data.wbs ?? []).map((row) => (
                          <MenuItem key={row.id} value={row.id}>
                            {row.wbsCode} · {row.wbsName}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label="Cost Code (optional)"
                        value={costCodeId}
                        onChange={(event) => setCostCodeId(event.target.value)}
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="">Unallocated</MenuItem>
                        {(options.data?.data.costCodes ?? []).map((row) => (
                          <MenuItem key={row.id} value={row.id}>
                            {row.costCode} · {row.costName}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        disabled={
                          !itemSectionId ||
                          !itemCode.trim() ||
                          !itemDescription.trim() ||
                          !quantity ||
                          !uomId ||
                          rate === '' ||
                          itemMutation.isPending
                        }
                        onClick={() => itemMutation.mutate()}
                      >
                        {editingItemId ? 'Save Item' : 'Add Item'}
                      </Button>
                      {editingItemId ? (
                        <Button onClick={clearItem}>Cancel</Button>
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
                <Typography variant="subtitle1">
                  Budget Revisions
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    label={
                      'Original Budget · ' +
                      money(summary.data?.data.original?.total)
                    }
                    variant="outlined"
                  />
                  <Chip
                    label={
                      'Current Revised Budget · ' +
                      money(summary.data?.data.current?.total)
                    }
                    variant="outlined"
                  />
                </Stack>

                {(revisions.data?.data ?? []).map((row) => (
                  <Card key={row.id} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          alignItems={{ sm: 'center' }}
                        >
                          <Typography sx={{ flexGrow: 1 }}>
                            {row.revisionNumber} · Revision {row.revisionNo}
                          </Typography>
                          {row.isOriginal ? (
                            <Chip size="small" label="ORIGINAL" />
                          ) : null}
                          {row.isCurrent ? (
                            <Chip size="small" label="CURRENT" />
                          ) : null}
                          <Chip
                            size="small"
                            variant="outlined"
                            label={row.lifecycleState}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {row._count.lines} lines
                          {row.revisionNote ? ' · ' + row.revisionNote : ''}
                        </Typography>
                        {row.lifecycleState === 'DRAFT' && canSubmit ? (
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1}
                          >
                            <TextField
                              select
                              label="Approval workflow"
                              value={workflowCode}
                              onChange={(event) =>
                                setWorkflowCode(event.target.value)
                              }
                              sx={{ minWidth: 260 }}
                            >
                              {(workflows.data?.data ?? []).map((workflow) => (
                                <MenuItem
                                  key={workflow.id}
                                  value={workflow.workflowCode}
                                >
                                  {workflow.workflowCode} ·{' '}
                                  {workflow.workflowName}
                                </MenuItem>
                              ))}
                            </TextField>
                            <Button
                              disabled={
                                !workflowCode || submitRevision.isPending
                              }
                              onClick={() =>
                                submitRevision.mutate(row.id)
                              }
                            >
                              Submit for Approval
                            </Button>
                          </Stack>
                        ) : null}
                        {row.lifecycleState === 'SUBMITTED' && canApprove ? (
                          <Stack spacing={1}>
                            <TextField
                              label="Approval comment (optional)"
                              value={approvalComment}
                              onChange={(event) =>
                                setApprovalComment(event.target.value)
                              }
                            />
                            <Stack direction="row" spacing={1}>
                              <Button
                                variant="contained"
                                onClick={() =>
                                  approveRevision.mutate(row.id)
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                onClick={() =>
                                  rejectRevision.mutate(row.id)
                                }
                              >
                                Reject
                              </Button>
                            </Stack>
                          </Stack>
                        ) : null}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}

                {canSubmit ? (
                  <>
                    <Divider />
                    <TextField
                      label="Revision note (optional)"
                      value={revisionNote}
                      onChange={(event) => setRevisionNote(event.target.value)}
                    />
                    <Button
                      variant="outlined"
                      disabled={
                        !currentBoq.items.some((row) => row.isActive) ||
                        createDraft.isPending
                      }
                      onClick={() => createDraft.mutate()}
                    >
                      Create Draft Budget Revision
                    </Button>
                  </>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          {summary.data?.data.current ? (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">
                    Current Revised Budget by WBS / Cost Code
                  </Typography>
                  <Typography variant="subtitle2">By WBS</Typography>
                  {summary.data.data.current.byWbs.map((row) => (
                    <Typography key={row.wbsId ?? 'unallocated-wbs'}>
                      {row.wbsCode
                        ? row.wbsCode + ' · ' + row.wbsName
                        : 'Unallocated'}{' '}
                      — {money(row.amount)}
                    </Typography>
                  ))}
                  <Divider />
                  <Typography variant="subtitle2">By Cost Code</Typography>
                  {summary.data.data.current.byCostCode.map((row) => (
                    <Typography
                      key={row.costCodeId ?? 'unallocated-cost-code'}
                    >
                      {row.costCode
                        ? row.costCode + ' · ' + row.costName
                        : 'Unallocated'}{' '}
                      — {money(row.amount)}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
