import { ReactNode, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { CurrentUser, logout } from './api/auth';
import { ApprovalPanel } from './admin/ApprovalPanel';
import { CompanyPanel } from './admin/CompanyPanel';
import { NumberingPanel } from './admin/NumberingPanel';
import { RolesPanel } from './admin/RolesPanel';
import { StatusesPanel } from './admin/StatusesPanel';
import { SystemSettingsPanel } from './admin/SystemSettingsPanel';
import { UsersPanel } from './admin/UsersPanel';

type Section = {
  key: string;
  label: string;
  permission: string;
  content: ReactNode;
};

export function AdminConsole({ user }: { user: CurrentUser }) {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sections = useMemo<Section[]>(
    () =>
      [
        {
          key: 'company',
          label: 'Company',
          permission: 'admin.company.manage',
          content: <CompanyPanel />,
        },
        {
          key: 'users',
          label: 'Users',
          permission: 'admin.users.manage',
          content: <UsersPanel />,
        },
        {
          key: 'roles',
          label: 'Roles & Permissions',
          permission: 'admin.roles.manage',
          content: <RolesPanel />,
        },
        {
          key: 'approvals',
          label: 'Approval Matrix',
          permission: 'admin.approval_matrix.manage',
          content: <ApprovalPanel />,
        },
        {
          key: 'statuses',
          label: 'Statuses',
          permission: 'admin.status.manage',
          content: <StatusesPanel />,
        },
        {
          key: 'numbering',
          label: 'Numbering',
          permission: 'admin.number_sequences.manage',
          content: <NumberingPanel />,
        },
        {
          key: 'system',
          label: 'System Settings',
          permission: 'admin.system_settings.manage',
          content: <SystemSettingsPanel />,
        },
      ].filter((section) => user.permissions.includes(section.permission)),
    [user.permissions],
  );

  const activeKey =
    selectedKey && sections.some((section) => section.key === selectedKey)
      ? selectedKey
      : (sections[0]?.key ?? null);
  const activeSection = sections.find((section) => section.key === activeKey);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
  });

  return (
    <>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ width: '100%' }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Construction ERP</Typography>
              <Typography variant="body2" color="text.secondary">
                V0.1 Administration · {user.displayName}
              </Typography>
            </Box>
            <Button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              Sign out
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        <Box sx={{ py: 3 }}>
          {sections.length === 0 ? (
            <Alert severity="warning">
              Your account is authenticated but has no Administration
              permissions.
            </Alert>
          ) : (
            <Stack spacing={3}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                  value={activeKey}
                  onChange={(_event, value: string) => setSelectedKey(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  {sections.map((section) => (
                    <Tab
                      key={section.key}
                      value={section.key}
                      label={section.label}
                    />
                  ))}
                </Tabs>
              </Box>

              {activeSection?.content}
            </Stack>
          )}
        </Box>
      </Container>
    </>
  );
}
