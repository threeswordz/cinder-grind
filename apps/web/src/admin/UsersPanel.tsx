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

import { AdminRole, AdminUser, adminApi } from '../api/admin';

function UserEditor({
  user,
  roles,
}: {
  user: AdminUser;
  roles: AdminRole[];
}) {
  const queryClient = useQueryClient();
  const [roleIds, setRoleIds] = useState<string[]>(
    user.userRoles.map((item) => item.role.id),
  );
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    setRoleIds(user.userRoles.map((item) => item.role.id));
  }, [user.userRoles]);

  const saveRoles = useMutation({
    mutationFn: () => adminApi.replaceUserRoles(user.id, roleIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: () =>
      adminApi.updateUser(user.id, { isActive: !user.isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const resetPassword = useMutation({
    mutationFn: () => adminApi.resetUserPassword(user.id, newPassword),
    onSuccess: () => setNewPassword(''),
  });

  function handleRoles(event: SelectChangeEvent<string[]>) {
    const value = event.target.value;
    setRoleIds(typeof value === 'string' ? value.split(',') : value);
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography fontWeight={600}>{user.displayName}</Typography>
            <Typography color="text.secondary">{user.email}</Typography>
            <Typography variant="body2" color="text.secondary">
              {user.isActive ? 'Active' : 'Inactive'}
            </Typography>
          </div>

          <FormControl fullWidth>
            <InputLabel id={'roles-' + user.id}>Roles</InputLabel>
            <Select
              labelId={'roles-' + user.id}
              multiple
              value={roleIds}
              onChange={handleRoles}
              input={<OutlinedInput label="Roles" />}
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
                    <Checkbox checked={roleIds.includes(role.id)} />
                    <ListItemText primary={role.roleName} />
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {saveRoles.isError ? (
            <Alert severity="error">
              Unable to change this user's Roles. You cannot change your own
              Role assignments through normal User Management.
            </Alert>
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              onClick={() => saveRoles.mutate()}
              disabled={saveRoles.isPending}
            >
              Save Roles
            </Button>
            <Button
              color={user.isActive ? 'warning' : 'success'}
              onClick={() => toggleActive.mutate()}
              disabled={toggleActive.isPending}
            >
              {user.isActive ? 'Deactivate User' : 'Activate User'}
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              helperText="Minimum 12 characters. Reset revokes existing sessions."
              fullWidth
            />
            <Button
              variant="outlined"
              onClick={() => resetPassword.mutate()}
              disabled={
                resetPassword.isPending || newPassword.trim().length < 12
              }
            >
              Reset Password
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function UsersPanel() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminApi.users,
  });
  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: adminApi.roles,
  });

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      adminApi.createUser({
        email,
        displayName,
        password,
        roleIds,
      }),
    onSuccess: async () => {
      setEmail('');
      setDisplayName('');
      setPassword('');
      setRoleIds([]);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  function handleRoles(event: SelectChangeEvent<string[]>) {
    const value = event.target.value;
    setRoleIds(typeof value === 'string' ? value.split(',') : value);
  }

  const roles = rolesQuery.data?.data ?? [];

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={submit}>
            <Typography variant="h6">Create User</Typography>
            <Alert severity="info">
              New accounts require an administrator-provided initial password.
              Password-reset/self-service recovery is not exposed publicly.
            </Alert>
            {create.isError ? (
              <Alert severity="error">Unable to create User.</Alert>
            ) : null}
            <TextField
              label="Display Name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <TextField
              label="Initial Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              helperText="Minimum 12 characters."
              required
            />
            <FormControl fullWidth>
              <InputLabel id="new-user-roles">Roles</InputLabel>
              <Select
                labelId="new-user-roles"
                multiple
                value={roleIds}
                onChange={handleRoles}
                input={<OutlinedInput label="Roles" />}
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
                      <Checkbox checked={roleIds.includes(role.id)} />
                      <ListItemText primary={role.roleName} />
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <Button
              type="submit"
              variant="contained"
              disabled={create.isPending || password.length < 12}
            >
              Create User
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {(usersQuery.data?.data ?? []).map((user) => (
          <UserEditor key={user.id} user={user} roles={roles} />
        ))}
      </Stack>
    </Stack>
  );
}
