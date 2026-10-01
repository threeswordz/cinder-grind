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
import { BudgetPanel } from './budget/BudgetPanel';
import { CompanyPanel } from './admin/CompanyPanel';
import { NumberingPanel } from './admin/NumberingPanel';
import { RolesPanel } from './admin/RolesPanel';
import { StatusesPanel } from './admin/StatusesPanel';
import { SystemSettingsPanel } from './admin/SystemSettingsPanel';
import { UsersPanel } from './admin/UsersPanel';
import { MasterDataPanel } from './master-data/MasterDataPanel';
import { ProjectsPanel } from './projects/ProjectsPanel';
import { PurchaseRequestsPanel } from './procurement/PurchaseRequestsPanel';
import { PurchaseOrdersPanel } from './procurement/PurchaseOrdersPanel';
import { SourcingPanel } from './procurement/SourcingPanel';
import { ProjectEngineerDashboard } from './reporting/ProjectEngineerDashboard';
import { ProcurementReport } from './reporting/ProcurementReport';
import { SchedulingPanel } from './scheduling/SchedulingPanel';
import { SiteExecutionPanel } from './site-execution/SiteExecutionPanel';
import { DocumentsPanel } from './documents/DocumentsPanel';
import { EquipmentPanel } from './equipment/EquipmentPanel';
import { FinanceWorkspace } from './finance/FinanceWorkspace';
import { InventoryWorkspace } from './inventory/InventoryWorkspace';
import { SubcontractsWorkspace } from './subcontracts/SubcontractsWorkspace';
import { WbsPanel } from './wbs/WbsPanel';

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
          key: 'finance',
          label: 'Finance',
          permission: '__finance__',
          content: <FinanceWorkspace permissions={user.permissions} />,
        },
        {
          key: 'purchase-orders',
          label: 'Purchase Orders',
          permission: '__purchase_orders__',
          content: <PurchaseOrdersPanel permissions={user.permissions} />,
        },
        {
          key: 'sourcing',
          label: 'RFQ & Quotations',
          permission: '__sourcing__',
          content: <SourcingPanel permissions={user.permissions} />,
        },
        {
          key: 'purchase-requests',
          label: 'Purchase Requests',
          permission: '__procurement__',
          content: <PurchaseRequestsPanel permissions={user.permissions} />,
        },
        {
          key: 'budget',
          label: 'BOQ & Budget',
          permission: '__budget__',
          content: <BudgetPanel permissions={user.permissions} />,
        },
        {
          key: 'procurement-report',
          label: 'Procurement Risk',
          permission: 'reporting.operational.view',
          content: <ProcurementReport />,
        },
        {
          key: 'project-engineer',
          label: 'Project Engineer',
          permission: 'reporting.operational.view',
          content: <ProjectEngineerDashboard />,
        },
        {
          key: 'subcontracts',
          label: 'Subcontracts',
          permission: '__subcontracts__',
          content: <SubcontractsWorkspace permissions={user.permissions} />,
        },
        {
          key: 'inventory',
          label: 'Inventory',
          permission: '__inventory__',
          content: <InventoryWorkspace permissions={user.permissions} />,
        },
        {
          key: 'equipment',
          label: 'Equipment',
          permission: '__equipment__',
          content: <EquipmentPanel permissions={user.permissions} />,
        },
        {
          key: 'site-execution',
          label: 'Site Execution',
          permission: '__site_execution__',
          content: <SiteExecutionPanel permissions={user.permissions} />,
        },
        {
          key: 'scheduling',
          label: 'Scheduling',
          permission: '__scheduling__',
          content: <SchedulingPanel permissions={user.permissions} />,
        },
        {
          key: 'documents',
          label: 'Documents',
          permission: '__documents__',
          content: <DocumentsPanel permissions={user.permissions} />,
        },
        {
          key: 'wbs',
          label: 'WBS & Cost Codes',
          permission: '__wbs__',
          content: <WbsPanel permissions={user.permissions} />,
        },
        {
          key: 'projects',
          label: 'Projects',
          permission: 'projects.project.view',
          content: <ProjectsPanel permissions={user.permissions} />,
        },
        {
          key: 'master-data',
          label: 'Master Data',
          permission: '__master_data__',
          content: <MasterDataPanel permissions={user.permissions} />,
        },
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
          content: (
            <RolesPanel
              canAssignPermissions={user.permissions.includes(
                'admin.permissions.assign',
              )}
            />
          ),
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
      ].filter((section) =>
        section.permission === '__finance__'
          ? user.permissions.some((permission) =>
              permission.startsWith('finance.supplier_invoice.'),
            )
          : section.permission === '__purchase_orders__'
          ? user.permissions.includes('procurement.po.view')
          : section.permission === '__sourcing__'
          ? user.permissions.some(
              (permission) =>
                permission.startsWith('procurement.rfq.') ||
                permission.startsWith('procurement.quotation.') ||
                permission.startsWith('procurement.award.'),
            )
          : section.permission === '__procurement__'
          ? user.permissions.some((permission) =>
              permission.startsWith('procurement.pr.'),
            )
          : section.permission === '__budget__'
          ? user.permissions.some((permission) =>
              permission.startsWith('budget.'),
            )
          : section.permission === '__subcontracts__'
          ? user.permissions.some((permission) =>
              permission.startsWith('subcontracts.'),
            )
          : section.permission === '__inventory__'
          ? user.permissions.some((permission) =>
              permission.startsWith('inventory.'),
            )
          : section.permission === '__equipment__'
          ? user.permissions.some((permission) =>
              permission.startsWith('equipment.'),
            )
          : section.permission === '__site_execution__'
          ? user.permissions.some((permission) =>
              permission.startsWith('site.'),
            )
          : section.permission === '__scheduling__'
          ? user.permissions.some(
              (permission) =>
                permission.startsWith('schedule.') ||
                permission === 'admin.activity_types.manage',
            )
          : section.permission === '__master_data__'
          ? user.permissions.some((permission) => permission.startsWith('master.') && permission.endsWith('.view'))
          : section.permission === '__wbs__'
            ? user.permissions.some((permission) => permission === 'wbs.wbs.view' || permission === 'wbs.cost_code.view')
            : section.permission === '__documents__'
              ? user.permissions.some((permission) => permission.startsWith('documents.'))
              : user.permissions.includes(section.permission),
      ),
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
      await queryClient.resetQueries({ queryKey: ['current-user'] });
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
                V0.6 Finance · {user.displayName}
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
              Your account is authenticated but has no available application permissions.
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
