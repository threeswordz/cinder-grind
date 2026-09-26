import { useMemo, useState } from 'react';
import { Alert, Box, Stack, Tab, Tabs } from '@mui/material';

import { MaterialsPanel } from './MaterialsPanel';
import {
  CustomersPanel,
  EmployeesPanel,
  SuppliersPanel,
  UomsPanel,
} from './StandardMasters';

type MasterKey = 'customers' | 'suppliers' | 'employees' | 'uoms' | 'materials';

const permissionsByKey: Record<
  MasterKey,
  { view: string; manage: string; label: string }
> = {
  customers: {
    view: 'master.customer.view',
    manage: 'master.customer.manage',
    label: 'Customers',
  },
  suppliers: {
    view: 'master.supplier.view',
    manage: 'master.supplier.manage',
    label: 'Suppliers',
  },
  employees: {
    view: 'master.employee.view',
    manage: 'master.employee.manage',
    label: 'Employees',
  },
  uoms: {
    view: 'master.uom.view',
    manage: 'master.uom.manage',
    label: 'UOM',
  },
  materials: {
    view: 'master.material.view',
    manage: 'master.material.manage',
    label: 'Materials',
  },
};

export function MasterDataPanel({ permissions }: { permissions: string[] }) {
  const available = useMemo(
    () =>
      (Object.keys(permissionsByKey) as MasterKey[]).filter((key) =>
        permissions.includes(permissionsByKey[key].view),
      ),
    [permissions],
  );
  const [selected, setSelected] = useState<MasterKey>('customers');
  const activeKey = available.includes(selected) ? selected : available[0];

  if (!activeKey) {
    return (
      <Alert severity="warning">
        You do not have permission to view Master Data.
      </Alert>
    );
  }

  const canManage = permissions.includes(permissionsByKey[activeKey].manage);

  return (
    <Stack spacing={3}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeKey}
          onChange={(_event, value: MasterKey) => setSelected(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {available.map((key) => (
            <Tab key={key} value={key} label={permissionsByKey[key].label} />
          ))}
        </Tabs>
      </Box>

      {activeKey === 'customers' ? (
        <CustomersPanel canManage={canManage} />
      ) : null}
      {activeKey === 'suppliers' ? (
        <SuppliersPanel canManage={canManage} />
      ) : null}
      {activeKey === 'employees' ? (
        <EmployeesPanel canManage={canManage} />
      ) : null}
      {activeKey === 'uoms' ? <UomsPanel canManage={canManage} /> : null}
      {activeKey === 'materials' ? (
        <MaterialsPanel canManage={canManage} />
      ) : null}
    </Stack>
  );
}
