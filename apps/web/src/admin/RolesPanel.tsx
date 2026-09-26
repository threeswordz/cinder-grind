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

import { AdminPermission, AdminRole, adminApi } from '../api/admin';

function RoleEditor({
  role,
  permissions,
}: {
  role: AdminRole;
  permissions: AdminPermission[];
}) {
  const queryClient = useQueryClient();
  const [permissionCodes, setPermissionCodes] = useState<string[]>(
    (role.rolePermissions ?? []).map(
      (item) => item.permission.permissionCode,
    ),
  );

  useEffect(() => {
    setPermissionCodes(
      (role.rolePermissions ?? []).map(
        (item) => item.permission.permissionCode,
      ),
    );
  }, [role.rolePermissions]);

  const save = useMutation({
    mutationFn: () =>
      adminApi.replaceRolePermissions(role.id, permissionCodes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });

  const toggle = useMutation({
    mutationFn: () =>
      adminApi.updateRole(role.id, { isActive: !role.isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  function handleChange(event: SelectChangeEvent<string[]>) {
    const value = event.target.value;
    setPermissionCodes(
      typeof value === 'string' ? value.split(',') : value,
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography fontWeight={600}>
              {role.roleName} ({role.roleCode})
            </Typography>
            <Typography color="text.secondary">
              {role.description || 'No description'} ·{' '}
              {role.isActive ? 'Active' : 'Inactive'}
            </Typography>
          </div>

          <FormControl fullWidth>
            <InputLabel id={'permissions-' + role.id}>
              System-defined Permissions
            </InputLabel>
            <Select
              labelId={'permissions-' + role.id}
              multiple
              value={permissionCodes}
              onChange={handleChange}
              input={<OutlinedInput label="System-defined Permissions" />}
              renderValue={(selected) => selected.join(', ')}
            >
              {permissions.map((permission) => (
                <MenuItem
                  key={permission.permissionCode}
                  value={permission.permissionCode}
                >
                  <Checkbox
                    checked={permissionCodes.includes(
                      permission.permissionCode,
                    )}
                  />
                  <ListItemText
                    primary={permission.permissionCode}
                    secondary={permission.description}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Alert severity="info">
            Permission definitions are system-defined. This screen assigns
            existing Permissions to Roles; it cannot invent permission codes.
          </Alert>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              Save Permissions
            </Button>
            <Button
              color={role.isActive ? 'warning' : 'success'}
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
            >
              {role.isActive ? 'Deactivate Role' : 'Activate Role'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function RolesPanel() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: adminApi.roles,
  });
  const permissionsQuery = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: adminApi.permissions,
  });

  const [roleCode, setRoleCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () =>
      adminApi.createRole({
        roleCode,
        roleName,
        ...(description.trim() ? { description: description.trim() } : {}),
      }),
    onSuccess: async () => {
      setRoleCode('');
      setRoleName('');
      setDescription('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={submit}>
            <Typography variant="h6">Create Role</Typography>
            {create.isError ? (
              <Alert severity="error">Unable to create Role.</Alert>
            ) : null}
            <TextField
              label="Role Code"
              value={roleCode}
              onChange={(event) => setRoleCode(event.target.value)}
              helperText="Example: PROJECT_ADMIN"
              required
            />
            <TextField
              label="Role Name"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              required
            />
            <TextField
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              multiline
              minRows={2}
            />
            <Button type="submit" variant="contained" disabled={create.isPending}>
              Create Role
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {(rolesQuery.data?.data ?? []).map((role) => (
          <RoleEditor
            key={role.id}
            role={role}
            permissions={permissionsQuery.data?.data ?? []}
          />
        ))}
      </Stack>
    </Stack>
  );
}
