import { ReactNode, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { CurrentUser, logout } from './api/auth';
import { RoleWorkspaceShell } from './role-ui/RoleWorkspaceShell';
import type { SourceLinkTarget } from './role-ui/source-link-policy';
import { CostControlWorkspace } from './cost-control/CostControlWorkspace';
import { ApprovalPanel } from './admin/ApprovalPanel';
import { BudgetPanel } from './budget/BudgetPanel';
import { CompanyPanel } from './admin/CompanyPanel';
import { NumberingPanel } from './admin/NumberingPanel';
import { RolesPanel } from './admin/RolesPanel';
import { StatusesPanel } from './admin/StatusesPanel';
import { SystemSettingsPanel } from './admin/SystemSettingsPanel';
import { UsersPanel } from './admin/UsersPanel';
import { MasterDataPanel } from './master-data/MasterDataPanel';
import { ManagementWorkspace } from './management/ManagementWorkspace';
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
import { ClientFinanceWorkspace } from './finance/ClientFinanceWorkspace';
import { FinanceWorkspace } from './finance/FinanceWorkspace';
import { FinanceReportingWorkspace } from './finance/FinanceReportingWorkspace';
import { PaymentFinanceWorkspace } from './finance/PaymentFinanceWorkspace';
import { RetentionFinanceWorkspace } from './finance/RetentionFinanceWorkspace';
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
  const [linkedSource, setLinkedSource] = useState<SourceLinkTarget | null>(null);
  const openSource = (target: SourceLinkTarget) => {
    setLinkedSource(target);
    setSelectedKey(target.sectionKey);
  };

  const sections = useMemo<Section[]>(
    () =>
      [
        {
          key: 'management',
          label: 'Management',
          permission: '__management__',
          content: <ManagementWorkspace permissions={user.permissions} />,
        },
        {
          key: 'cost-control',
          label: 'Cost Control',
          permission: '__cost_control__',
          content: <CostControlWorkspace permissions={user.permissions} />,
        },
        {
          key: 'finance',
          label: 'Finance',
          permission: '__finance__',
          content: <FinanceWorkspace
            permissions={user.permissions}
            initialProjectId={linkedSource?.sectionKey === 'finance' ? linkedSource.projectId : undefined}
            initialInvoiceId={linkedSource?.sectionKey === 'finance' ? linkedSource.recordId : undefined}
            onOpenSource={openSource}
          />,
        },
        {
          key: 'client-finance',
          label: 'Client Finance',
          permission: '__client_finance__',
          content: <ClientFinanceWorkspace permissions={user.permissions} />,
        },
        {
          key: 'payments',
          label: 'Payments',
          permission: '__payments__',
          content: <PaymentFinanceWorkspace
            permissions={user.permissions}
            initialProjectId={linkedSource?.sectionKey === 'payments' ? linkedSource.projectId : undefined}
            initialPaymentId={linkedSource?.sectionKey === 'payments' ? linkedSource.recordId : undefined}
            onOpenSource={openSource}
          />,
        },
        {
          key: 'retention',
          label: 'Retention',
          permission: 'finance.retention.view',
          content: <RetentionFinanceWorkspace permissions={user.permissions} />,
        },
        {
          key: 'finance-reports',
          label: 'Finance Reports',
          permission: '__finance_reports__',
          content: <FinanceReportingWorkspace permissions={user.permissions} />,
        },
        {
          key: 'purchase-orders',
          label: 'Purchase Orders',
          permission: '__purchase_orders__',
          content: <PurchaseOrdersPanel
            permissions={user.permissions}
            initialProjectId={linkedSource?.sectionKey === 'purchase-orders' ? linkedSource.projectId : undefined}
            initialOrderId={linkedSource?.sectionKey === 'purchase-orders' ? linkedSource.recordId : undefined}
            onOpenSource={openSource}
          />,
        },
        {
          key: 'sourcing',
          label: 'RFQ & Quotations',
          permission: '__sourcing__',
          content: <SourcingPanel
            permissions={user.permissions}
            initialProjectId={linkedSource?.sectionKey === 'sourcing' ? linkedSource.projectId : undefined}
            initialRfqId={linkedSource?.sectionKey === 'sourcing' ? linkedSource.recordId : undefined}
            initialQuotationId={linkedSource?.sectionKey === 'sourcing' ? linkedSource.childRecordId : undefined}
            onOpenSource={openSource}
          />,
        },
        {
          key: 'purchase-requests',
          label: 'Purchase Requests',
          permission: '__procurement__',
          content: <PurchaseRequestsPanel
            permissions={user.permissions}
            initialProjectId={linkedSource?.sectionKey === 'purchase-requests' ? linkedSource.projectId : undefined}
            initialRequestId={linkedSource?.sectionKey === 'purchase-requests' ? linkedSource.recordId : undefined}
          />,
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
          content: <InventoryWorkspace
            permissions={user.permissions}
            initialProjectId={linkedSource?.sectionKey === 'inventory' ? linkedSource.projectId : undefined}
            initialReceiptId={linkedSource?.sectionKey === 'inventory' ? linkedSource.recordId : undefined}
            onOpenSource={openSource}
          />,
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
        section.permission === '__management__'
          ? user.permissions.some((permission) =>
              [
                'management.dashboard.view',
                'management.portfolio.view',
              ].includes(permission),
            )
          : section.permission === '__cost_control__'
          ? user.permissions.some(
              (permission) =>
                permission === 'cost.control.view' ||
                permission.startsWith('cost.direct_posting.'),
            )
          : section.permission === '__finance__'
          ? user.permissions.some((permission) =>
              permission.startsWith('finance.supplier_invoice.'),
            )
          : section.permission === '__client_finance__'
          ? user.permissions.some(
              (permission) =>
                permission.startsWith('finance.client_invoice.') ||
                permission === 'finance.ap.view' ||
                permission === 'finance.ar.view',
            )
          : section.permission === '__payments__'
          ? user.permissions.some((permission) =>
              permission.startsWith('finance.payment.'),
            )
          : section.permission === '__finance_reports__'
          ? user.permissions.some((permission) =>
              [
                'finance.ap.view',
                'finance.ar.view',
                'finance.payment.view',
                'finance.retention.view',
              ].includes(permission),
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
    [user.permissions, linkedSource],
  );

  const activeKey =
    selectedKey && sections.some((section) => section.key === selectedKey)
      ? selectedKey
      : (sections[0]?.key ?? null);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.resetQueries({ queryKey: ['current-user'] });
    },
  });

  return (
    <RoleWorkspaceShell
      user={user}
      sections={sections}
      activeKey={activeKey}
      onSelect={(key) => {
        setLinkedSource(null);
        setSelectedKey(key);
      }}
      onOpenPr={(projectId, requestId) =>
        openSource({
          sectionKey: 'purchase-requests',
          projectId,
          recordId: requestId,
        })
      }
      onLogout={() => logoutMutation.mutate()}
      logoutPending={logoutMutation.isPending}
    />
  );
}
