import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CostCodeRecord, wbsApi, WbsRecord } from '../api/wbs';
import {
  canOpenSourceLink,
  consumeSourceLinkKey,
  resolveLinkedChildRecordId,
  resolveLinkedProjectId,
  sourceLinkTarget,
  type SourceLinkSection,
  type SourceLinkTarget,
} from '../role-ui/source-link-policy';

const emptyWbsForm = {
  wbsCode: '',
  wbsName: '',
  parentId: '',
  description: '',
};

export function WbsPanel({
  permissions,
  initialProjectId,
  initialWbsId,
  onOpenSource,
}: {
  permissions: string[];
  initialProjectId?: string | undefined;
  initialWbsId?: string | undefined;
  onOpenSource?: ((target: SourceLinkTarget) => void) | undefined;
}) {
  const qc = useQueryClient();
  const canWbsView = permissions.includes('wbs.wbs.view');
  const canWbsCreate = permissions.includes('wbs.wbs.create');
  const canWbsEdit = permissions.includes('wbs.wbs.edit');
  const canWbsArchive = permissions.includes('wbs.wbs.archive');
  const canCostCreate = permissions.includes('wbs.cost_code.create');
  const canCostEdit = permissions.includes('wbs.cost_code.edit');
  const canCostArchive = permissions.includes('wbs.cost_code.archive');

  const [projectId, setProjectId] = useState('');
  const [selected, setSelected] = useState<WbsRecord | null>(null);
  const [wf, setWf] = useState(emptyWbsForm);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [cost, setCost] = useState<CostCodeRecord | null>(null);
  const [cf, setCf] = useState({
    costCode: '',
    costName: '',
    description: '',
  });
  const appliedProjectSource = useRef('');
  const appliedWbsSource = useRef('');

  const projects = useQuery({
    queryKey: ['wbs', 'projects'],
    queryFn: wbsApi.projects,
    enabled: canWbsView,
  });
  const wbs = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => wbsApi.list(projectId),
    enabled: Boolean(projectId && canWbsView),
  });
  const costs = useQuery({
    queryKey: ['cost-codes', search, active],
    queryFn: () => wbsApi.costCodes(search, active),
    enabled: permissions.includes('wbs.cost_code.view'),
  });

  const refreshWbs = () => qc.invalidateQueries({ queryKey: ['wbs', projectId] });
  const refreshCost = () => qc.invalidateQueries({ queryKey: ['cost-codes'] });

  const saveWbs = useMutation({
    mutationFn: () =>
      selected
        ? wbsApi.update(projectId, selected.id, {
            ...wf,
            parentId: wf.parentId || null,
          })
        : wbsApi.create(projectId, {
            ...wf,
            parentId: wf.parentId || null,
          }),
    onSuccess: async () => {
      setSelected(null);
      setWf(emptyWbsForm);
      await refreshWbs();
    },
  });
  const toggleWbs = useMutation({
    mutationFn: (row: WbsRecord) =>
      wbsApi.setWbsActive(projectId, row.id, !row.isActive),
    onSuccess: refreshWbs,
  });
  const saveCost = useMutation({
    mutationFn: () =>
      cost ? wbsApi.updateCostCode(cost.id, cf) : wbsApi.createCostCode(cf),
    onSuccess: async () => {
      setCost(null);
      setCf({ costCode: '', costName: '', description: '' });
      await refreshCost();
    },
  });
  const toggleCost = useMutation({
    mutationFn: (row: CostCodeRecord) =>
      wbsApi.setCostCodeActive(row.id, !row.isActive),
    onSuccess: refreshCost,
  });

  const editW = (row: WbsRecord) => {
    setSelected(row);
    setWf({
      wbsCode: row.wbsCode,
      wbsName: row.wbsName,
      parentId: row.parentId ?? '',
      description: row.description ?? '',
    });
  };
  const editC = (row: CostCodeRecord) => {
    setCost(row);
    setCf({
      costCode: row.costCode,
      costName: row.costName,
      description: row.description ?? '',
    });
  };

  useEffect(() => {
    if (!initialProjectId || !projects.isSuccess || projects.isFetching) return;
    if (!consumeSourceLinkKey(appliedProjectSource, initialProjectId)) return;
    const resolved = resolveLinkedProjectId(
      initialProjectId,
      projects.data?.data ?? [],
    );
    setProjectId(resolved);
    setSelected(null);
    setWf(emptyWbsForm);
  }, [
    initialProjectId,
    projects.data,
    projects.isFetching,
    projects.isSuccess,
  ]);

  const rows = wbs.data?.data ?? [];

  useEffect(() => {
    if (
      !initialWbsId ||
      !initialProjectId ||
      projectId !== initialProjectId ||
      !wbs.isSuccess ||
      wbs.isFetching
    ) {
      return;
    }
    const sourceKey = initialProjectId + ':' + initialWbsId;
    if (!consumeSourceLinkKey(appliedWbsSource, sourceKey)) return;
    const resolved = resolveLinkedChildRecordId(initialWbsId, rows);
    const linked = rows.find((row) => row.id === resolved);
    if (linked) editW(linked);
    else {
      setSelected(null);
      setWf(emptyWbsForm);
    }
  }, [
    initialProjectId,
    initialWbsId,
    projectId,
    rows,
    wbs.isFetching,
    wbs.isSuccess,
  ]);

  const openSource = (
    sectionKey: SourceLinkSection,
    recordKind: 'project' | 'wbs',
    wbsId?: string,
  ) => {
    if (!onOpenSource || !canOpenSourceLink(sectionKey, permissions) || !projectId) {
      return;
    }
    const target = sourceLinkTarget(
      sectionKey,
      projectId,
      projectId,
      wbsId,
      recordKind,
    );
    if (target) onOpenSource(target);
  };

  const treeRows: Array<{ row: WbsRecord; depth: number }> = [];
  const seen = new Set<string>();
  const visit = (parentId: string | null, depth: number) => {
    rows
      .filter((row) => row.parentId === parentId)
      .sort((a, b) => a.wbsCode.localeCompare(b.wbsCode))
      .forEach((row) => {
        if (seen.has(row.id)) return;
        seen.add(row.id);
        treeRows.push({ row, depth });
        visit(row.id, depth + 1);
      });
  };
  visit(null, 0);
  rows
    .filter((row) => !seen.has(row.id))
    .forEach((row) => treeRows.push({ row, depth: 0 }));

  return (
    <Stack spacing={4}>
      {canWbsView ? (
        <Stack spacing={2}>
          <Typography variant="h6">Work Breakdown Structure</Typography>
          <TextField
            select
            label="Project"
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setSelected(null);
              setWf(emptyWbsForm);
            }}
          >
            <MenuItem value="">Select Project</MenuItem>
            {(projects.data?.data ?? []).map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.projectCode} · {project.projectName}
              </MenuItem>
            ))}
          </TextField>

          {projectId && onOpenSource ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {canOpenSourceLink('projects', permissions) ? (
                <Button onClick={() => openSource('projects', 'project')}>
                  Project
                </Button>
              ) : null}
              {canOpenSourceLink('budget', permissions) ? (
                <Button onClick={() => openSource('budget', 'project')}>
                  Budget
                </Button>
              ) : null}
              {canOpenSourceLink('site-execution', permissions) ? (
                <Button onClick={() => openSource('site-execution', 'project')}>
                  Site
                </Button>
              ) : null}
              {canOpenSourceLink('management', permissions) ? (
                <Button onClick={() => openSource('management', 'project')}>
                  Management
                </Button>
              ) : null}
            </Stack>
          ) : null}

          {wbs.isError ? <Alert severity="error">Unable to load WBS.</Alert> : null}
          {treeRows.map(({ row, depth }) => (
            <Card
              key={row.id}
              variant="outlined"
              sx={
                selected?.id === row.id
                  ? { borderColor: 'primary.main', borderWidth: 2 }
                  : undefined
              }
            >
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <div>
                    <Typography fontWeight={600} sx={{ pl: depth * 3 }}>
                      {row.wbsCode} · {row.wbsName}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ pl: depth * 3 }}
                    >
                      {row.isActive ? 'Active' : 'Inactive'}
                      {row.description ? ' · ' + row.description : ''}
                    </Typography>
                  </div>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Button onClick={() => editW(row)}>Open</Button>
                    {onOpenSource &&
                    canOpenSourceLink('scheduling', permissions) ? (
                      <Button
                        onClick={() =>
                          openSource('scheduling', 'wbs', row.id)
                        }
                      >
                        Activities
                      </Button>
                    ) : null}
                    {onOpenSource && canOpenSourceLink('budget', permissions) ? (
                      <Button
                        onClick={() => openSource('budget', 'wbs', row.id)}
                      >
                        Budget
                      </Button>
                    ) : null}
                    {onOpenSource &&
                    canOpenSourceLink('cost-control', permissions) ? (
                      <Button
                        onClick={() =>
                          openSource('cost-control', 'wbs', row.id)
                        }
                      >
                        Cost
                      </Button>
                    ) : null}
                    {canWbsEdit ? (
                      <Button onClick={() => editW(row)}>Edit</Button>
                    ) : null}
                    {canWbsArchive ? (
                      <Button onClick={() => toggleWbs.mutate(row)}>
                        {row.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}

          {projectId && (canWbsCreate || (selected && canWbsEdit)) ? (
            <Stack
              component="form"
              spacing={2}
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                saveWbs.mutate();
              }}
            >
              <Typography>{selected ? 'Edit WBS' : 'Add WBS'}</Typography>
              <TextField
                label="WBS Code"
                value={wf.wbsCode}
                onChange={(event) =>
                  setWf({ ...wf, wbsCode: event.target.value })
                }
                required
              />
              <TextField
                label="WBS Name"
                value={wf.wbsName}
                onChange={(event) =>
                  setWf({ ...wf, wbsName: event.target.value })
                }
                required
              />
              <TextField
                select
                label="Parent WBS"
                value={wf.parentId}
                onChange={(event) =>
                  setWf({ ...wf, parentId: event.target.value })
                }
              >
                <MenuItem value="">Root</MenuItem>
                {rows
                  .filter((row) => row.id !== selected?.id)
                  .map((row) => (
                    <MenuItem key={row.id} value={row.id}>
                      {row.wbsCode} · {row.wbsName}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                label="Description"
                value={wf.description}
                onChange={(event) =>
                  setWf({ ...wf, description: event.target.value })
                }
              />
              <Button type="submit" variant="contained">
                Save WBS
              </Button>
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {permissions.includes('wbs.cost_code.view') ? (
        <Stack spacing={2}>
          <Typography variant="h6">Cost Code Register</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Search Cost Codes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
            />
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
            {canCostCreate ? (
              <Button
                onClick={() => {
                  setCost(null);
                  setCf({ costCode: '', costName: '', description: '' });
                }}
              >
                New Cost Code
              </Button>
            ) : null}
          </Stack>

          {(costs.data?.data ?? []).map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between">
                  <div>
                    <Typography fontWeight={600}>
                      {row.costCode} · {row.costName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {row.isActive ? 'Active' : 'Inactive'}
                      {row.description ? ' · ' + row.description : ''}
                    </Typography>
                  </div>
                  <Stack direction="row">
                    {canCostEdit ? (
                      <Button onClick={() => editC(row)}>Edit</Button>
                    ) : null}
                    {canCostArchive ? (
                      <Button onClick={() => toggleCost.mutate(row)}>
                        {row.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}

          {canCostCreate || (cost && canCostEdit) ? (
            <Stack
              component="form"
              spacing={2}
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                saveCost.mutate();
              }}
            >
              <Typography>
                {cost ? 'Edit Cost Code' : 'Add Cost Code'}
              </Typography>
              <TextField
                label="Cost Code"
                value={cf.costCode}
                onChange={(event) =>
                  setCf({ ...cf, costCode: event.target.value })
                }
                required
              />
              <TextField
                label="Name"
                value={cf.costName}
                onChange={(event) =>
                  setCf({ ...cf, costName: event.target.value })
                }
                required
              />
              <TextField
                label="Description"
                value={cf.description}
                onChange={(event) =>
                  setCf({ ...cf, description: event.target.value })
                }
              />
              <Button type="submit" variant="contained">
                Save Cost Code
              </Button>
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
