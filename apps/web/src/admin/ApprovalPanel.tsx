import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminRole, ApprovalWorkflow, adminApi } from '../api/admin';

type DraftStep = {
  stepName: string;
  requiredApprovals: string;
  roleIds: string[];
};

function emptyStep(): DraftStep {
  return {
    stepName: '',
    requiredApprovals: '1',
    roleIds: [],
  };
}

function StepEditor({
  step,
  roles,
  index,
  onChange,
  onRemove,
}: {
  step: DraftStep;
  roles: AdminRole[];
  index: number;
  onChange: (next: DraftStep) => void;
  onRemove: () => void;
}) {
  function handleRoles(event: SelectChangeEvent<string[]>) {
    const value = event.target.value;
    onChange({
      ...step,
      roleIds: typeof value === 'string' ? value.split(',') : value,
    });
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography fontWeight={600}>Step {index + 1}</Typography>
          <TextField
            label="Step Name"
            value={step.stepName}
            onChange={(event) =>
              onChange({ ...step, stepName: event.target.value })
            }
            required
          />
          <TextField
            label="Required Approvals"
            type="number"
            value={step.requiredApprovals}
            onChange={(event) =>
              onChange({
                ...step,
                requiredApprovals: event.target.value,
              })
            }
            inputProps={{ min: 1 }}
            required
          />
          <FormControl fullWidth>
            <InputLabel id={'approval-roles-' + index}>
              Authorized Roles
            </InputLabel>
            <Select
              labelId={'approval-roles-' + index}
              multiple
              value={step.roleIds}
              onChange={handleRoles}
              input={<OutlinedInput label="Authorized Roles" />}
              renderValue={(selected) =>
                roles
                  .filter((role) => selected.includes(role.id))
                  .map((role) => role.roleName)
                  .join(', ')
              }
            >
              {roles
                .filter((role) => role.isActive)
                .map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    <Checkbox checked={step.roleIds.includes(role.id)} />
                    <ListItemText
                      primary={role.roleName}
                      secondary={role.roleCode}
                    />
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <Button
            color="warning"
            onClick={onRemove}
            disabled={index === 0}
          >
            Remove Step
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function workflowToDraft(workflow: ApprovalWorkflow): DraftStep[] {
  return workflow.steps.map((step) => ({
    stepName: step.stepName,
    requiredApprovals: String(step.requiredApprovals),
    roleIds: step.stepRoles.map((item) => item.role.id),
  }));
}

function ExistingWorkflowEditor({
  workflow,
  roles,
}: {
  workflow: ApprovalWorkflow;
  roles: AdminRole[];
}) {
  const queryClient = useQueryClient();
  const [steps, setSteps] = useState<DraftStep[]>(
    workflowToDraft(workflow),
  );

  useEffect(() => {
    setSteps(workflowToDraft(workflow));
  }, [workflow]);

  const saveSteps = useMutation({
    mutationFn: () =>
      adminApi.replaceApprovalSteps(
        workflow.id,
        steps.map((step, index) => ({
          stepNo: index + 1,
          stepName: step.stepName,
          requiredApprovals: Number(step.requiredApprovals),
          roleIds: step.roleIds,
        })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'approval-workflows'],
      });
    },
  });

  const toggle = useMutation({
    mutationFn: () =>
      adminApi.updateApprovalWorkflow(workflow.id, {
        isActive: !workflow.isActive,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'approval-workflows'],
      });
    },
  });

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography fontWeight={600}>
              {workflow.workflowName} ({workflow.workflowCode})
            </Typography>
            <Typography color="text.secondary">
              {workflow.entityType} · {workflow.isActive ? 'Active' : 'Inactive'}
            </Typography>
          </div>

          {steps.map((step, index) => (
            <StepEditor
              key={index}
              step={step}
              roles={roles}
              index={index}
              onChange={(next) =>
                setSteps((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? next : item,
                  ),
                )
              }
              onRemove={() =>
                setSteps((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            />
          ))}

          <Button
            variant="outlined"
            onClick={() => setSteps((current) => [...current, emptyStep()])}
          >
            Add Step
          </Button>

          {saveSteps.isError ? (
            <Alert severity="warning">
              Unable to change the steps. If this workflow already has approval
              history, its steps are intentionally locked. Deactivate it and
              create a new workflow instead.
            </Alert>
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              onClick={() => saveSteps.mutate()}
              disabled={saveSteps.isPending || steps.length === 0}
            >
              Save Steps
            </Button>
            <Button
              color={workflow.isActive ? 'warning' : 'success'}
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
            >
              {workflow.isActive ? 'Deactivate Workflow' : 'Activate Workflow'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ApprovalPanel() {
  const queryClient = useQueryClient();
  const workflowsQuery = useQuery({
    queryKey: ['admin', 'approval-workflows'],
    queryFn: adminApi.approvalWorkflows,
  });
  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: adminApi.roles,
  });

  const [workflowCode, setWorkflowCode] = useState('');
  const [entityType, setEntityType] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [steps, setSteps] = useState<DraftStep[]>([emptyStep()]);

  const create = useMutation({
    mutationFn: () =>
      adminApi.createApprovalWorkflow({
        workflowCode,
        entityType,
        workflowName,
        steps: steps.map((step, index) => ({
          stepNo: index + 1,
          stepName: step.stepName,
          requiredApprovals: Number(step.requiredApprovals),
          roleIds: step.roleIds,
        })),
      }),
    onSuccess: async () => {
      setWorkflowCode('');
      setEntityType('');
      setWorkflowName('');
      setSteps([emptyStep()]);
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'approval-workflows'],
      });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  const roles = rolesQuery.data?.data ?? [];

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={submit}>
            <Typography variant="h6">Create Approval Workflow</Typography>
            <Alert severity="info">
              Amount-based approval limits are intentionally not configured in
              V0.1. This matrix controls authorized Roles and approval steps.
            </Alert>
            {create.isError ? (
              <Alert severity="error">Unable to create approval workflow.</Alert>
            ) : null}

            <TextField
              label="Workflow Code"
              value={workflowCode}
              onChange={(event) => setWorkflowCode(event.target.value)}
              helperText="Example: PO_APPROVAL"
              required
            />
            <TextField
              label="Entity Type"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              helperText="Example: PURCHASE_ORDER"
              required
            />
            <TextField
              label="Workflow Name"
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              required
            />

            {steps.map((step, index) => (
              <StepEditor
                key={index}
                step={step}
                roles={roles}
                index={index}
                onChange={(next) =>
                  setSteps((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? next : item,
                    ),
                  )
                }
                onRemove={() =>
                  setSteps((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              />
            ))}

            <Button
              variant="outlined"
              onClick={() => setSteps((current) => [...current, emptyStep()])}
            >
              Add Step
            </Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>
              Create Workflow
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {(workflowsQuery.data?.data ?? []).map((workflow) => (
          <ExistingWorkflowEditor
            key={workflow.id}
            workflow={workflow}
            roles={roles}
          />
        ))}
      </Stack>
    </Stack>
  );
}
