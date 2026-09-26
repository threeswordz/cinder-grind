import { FormEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Customer,
  Employee,
  Material,
  Supplier,
  UnitOfMeasure,
  masterDataApi,
} from '../api/masterData';

type ActiveFilter = 'all' | 'true' | 'false';
type MasterKey = 'customers' | 'suppliers' | 'employees' | 'uoms' | 'materials';

type PermissionMap = {
  [K in MasterKey]: { view: string; manage: string };
};

const permissionMap: PermissionMap = {
  customers: {
    view: 'master.customer.view',
    manage: 'master.customer.manage',
  },
  suppliers: {
    view: 'master.supplier.view',
    manage: 'master.supplier.manage',
  },
  employees: {
    view: 'master.employee.view',
    manage: 'master.employee.manage',
  },
  uoms: {
    view: 'master.uom.view',
    manage: 'master.uom.manage',
  },
  materials: {
    view: 'master.material.view',
    manage: 'master.material.manage',
  },
};

function MasterToolbar({
  search,
  setSearch,
  active,
  setActive,
}: {
  search: string;
  setSearch: (value: string) => void;
  active: ActiveFilter;
  setActive: (value: ActiveFilter) => void;
}) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        label="Search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        fullWidth
      />
      <FormControl sx={{ minWidth: 180 }}>
        <InputLabel id="active-filter-label">Status</InputLabel>
        <Select
          labelId="active-filter-label"
          label="Status"
          value={active}
          onChange={(event) => setActive(event.target.value as ActiveFilter)}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}

function StatusButton({
  isActive,
  disabled,
  onClick,
}: {
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      color={isActive ? 'warning' : 'success'}
      variant="outlined"
      disabled={disabled}
      onClick={onClick}
    >
      {isActive ? 'Deactivate' : 'Activate'}
    </Button>
  );
}

function CustomersSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<ActiveFilter>('all');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const query = useQuery({
    queryKey: ['master-data', 'customers', search, active],
    queryFn: () => masterDataApi.customers(search, active),
  });

  const create = useMutation({
    mutationFn: () =>
      masterDataApi.createCustomer({
        customerCode: code,
        customerName: name,
        registrationNumber: null,
        contactName: null,
        email: email || null,
        phone: null,
        address: null,
      }),
    onSuccess: async () => {
      setCode('');
      setName('');
      setEmail('');
      await queryClient.invalidateQueries({ queryKey: ['master-data', 'customers'] });
    },
  });

  const toggle = useMutation({
    mutationFn: (customer: Customer) =>
      masterDataApi.updateCustomer(customer.id, {
        isActive: !customer.isActive,
      }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['master-data', 'customers'] }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Stack spacing={3}>
      {canManage ? (
        <Card variant="outlined">
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={submit}>
              <Typography variant="h6">Create Customer</Typography>
              <TextField label="Customer Code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <TextField label="Customer Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" variant="contained" disabled={create.isPending}>Create Customer</Button>
              {create.isError ? <Alert severity="error">Unable to create Customer.</Alert> : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <MasterToolbar search={search} setSearch={setSearch} active={active} setActive={setActive} />
      <Stack spacing={1}>
        {(query.data?.data ?? []).map((item) => (
          <Card key={item.id} variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={600}>{item.customerCode} · {item.customerName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.email ?? 'No email'} · {item.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </Box>
                {canManage ? (
                  <StatusButton
                    isActive={item.isActive}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(item)}
                  />
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function SuppliersSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<ActiveFilter>('all');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const query = useQuery({
    queryKey: ['master-data', 'suppliers', search, active],
    queryFn: () => masterDataApi.suppliers(search, active),
  });

  const create = useMutation({
    mutationFn: () =>
      masterDataApi.createSupplier({
        supplierCode: code,
        supplierName: name,
        registrationNumber: null,
        contactName: null,
        email: email || null,
        phone: null,
        address: null,
      }),
    onSuccess: async () => {
      setCode('');
      setName('');
      setEmail('');
      await queryClient.invalidateQueries({ queryKey: ['master-data', 'suppliers'] });
    },
  });

  const toggle = useMutation({
    mutationFn: (supplier: Supplier) =>
      masterDataApi.updateSupplier(supplier.id, {
        isActive: !supplier.isActive,
      }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['master-data', 'suppliers'] }),
  });

  return (
    <Stack spacing={3}>
      {canManage ? (
        <Card variant="outlined">
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <Typography variant="h6">Create Supplier</Typography>
              <TextField label="Supplier Code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <TextField label="Supplier Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" variant="contained" disabled={create.isPending}>Create Supplier</Button>
              {create.isError ? <Alert severity="error">Unable to create Supplier.</Alert> : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <MasterToolbar search={search} setSearch={setSearch} active={active} setActive={setActive} />
      <Stack spacing={1}>
        {(query.data?.data ?? []).map((item) => (
          <Card key={item.id} variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={600}>{item.supplierCode} · {item.supplierName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.email ?? 'No email'} · {item.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </Box>
                {canManage ? (
                  <StatusButton
                    isActive={item.isActive}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(item)}
                  />
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function EmployeesSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<ActiveFilter>('all');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const query = useQuery({
    queryKey: ['master-data', 'employees', search, active],
    queryFn: () => masterDataApi.employees(search, active),
  });

  const create = useMutation({
    mutationFn: () =>
      masterDataApi.createEmployee({
        employeeCode: code,
        employeeName: name,
        jobTitle: jobTitle || null,
        email: null,
        phone: null,
      }),
    onSuccess: async () => {
      setCode('');
      setName('');
      setJobTitle('');
      await queryClient.invalidateQueries({ queryKey: ['master-data', 'employees'] });
    },
  });

  const toggle = useMutation({
    mutationFn: (employee: Employee) =>
      masterDataApi.updateEmployee(employee.id, {
        isActive: !employee.isActive,
      }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['master-data', 'employees'] }),
  });

  return (
    <Stack spacing={3}>
      {canManage ? (
        <Card variant="outlined">
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <Typography variant="h6">Create Employee</Typography>
              <TextField label="Employee Code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <TextField label="Employee Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField label="Job Title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              <Button type="submit" variant="contained" disabled={create.isPending}>Create Employee</Button>
              {create.isError ? <Alert severity="error">Unable to create Employee.</Alert> : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <MasterToolbar search={search} setSearch={setSearch} active={active} setActive={setActive} />
      <Stack spacing={1}>
        {(query.data?.data ?? []).map((item) => (
          <Card key={item.id} variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={600}>{item.employeeCode} · {item.employeeName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.jobTitle ?? 'No job title'} · {item.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </Box>
                {canManage ? (
                  <StatusButton
                    isActive={item.isActive}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(item)}
                  />
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function UomsSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<ActiveFilter>('all');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [decimalPlaces, setDecimalPlaces] = useState('0');

  const query = useQuery({
    queryKey: ['master-data', 'uoms', search, active],
    queryFn: () => masterDataApi.uoms(search, active),
  });

  const create = useMutation({
    mutationFn: () =>
      masterDataApi.createUom({
        uomCode: code,
        uomName: name,
        decimalPlaces: Number(decimalPlaces),
      }),
    onSuccess: async () => {
      setCode('');
      setName('');
      setDecimalPlaces('0');
      await queryClient.invalidateQueries({ queryKey: ['master-data', 'uoms'] });
    },
  });

  const toggle = useMutation({
    mutationFn: (uom: UnitOfMeasure) =>
      masterDataApi.updateUom(uom.id, { isActive: !uom.isActive }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['master-data', 'uoms'] }),
  });

  return (
    <Stack spacing={3}>
      {canManage ? (
        <Card variant="outlined">
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <Typography variant="h6">Create Unit of Measure</Typography>
              <TextField label="UOM Code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <TextField label="UOM Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField
                label="Decimal Places"
                type="number"
                inputProps={{ min: 0, max: 6 }}
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(e.target.value)}
                required
              />
              <Button type="submit" variant="contained" disabled={create.isPending}>Create UOM</Button>
              {create.isError ? <Alert severity="error">Unable to create Unit of Measure.</Alert> : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <MasterToolbar search={search} setSearch={setSearch} active={active} setActive={setActive} />
      <Stack spacing={1}>
        {(query.data?.data ?? []).map((item) => (
          <Card key={item.id} variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={600}>{item.uomCode} · {item.uomName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.decimalPlaces} decimal places · {item.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </Box>
                {canManage ? (
                  <StatusButton
                    isActive={item.isActive}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(item)}
                  />
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function MaterialsSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<ActiveFilter>('all');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [defaultUomId, setDefaultUomId] = useState('');

  const query = useQuery({
    queryKey: ['master-data', 'materials', search, active],
    queryFn: () => masterDataApi.materials(search, active),
  });
  const uomsQuery = useQuery({
    queryKey: ['master-data', 'uoms', 'material-options'],
    queryFn: () => masterDataApi.uoms('', 'true'),
  });

  const create = useMutation({
    mutationFn: () =>
      masterDataApi.createMaterial({
        materialCode: code,
        materialName: name,
        defaultUomId,
        materialCategory: category || null,
      }),
    onSuccess: async () => {
      setCode('');
      setName('');
      setCategory('');
      setDefaultUomId('');
      await queryClient.invalidateQueries({ queryKey: ['master-data', 'materials'] });
    },
  });

  const toggle = useMutation({
    mutationFn: (material: Material) =>
      masterDataApi.updateMaterial(material.id, {
        isActive: !material.isActive,
      }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['master-data', 'materials'] }),
  });

  return (
    <Stack spacing={3}>
      {canManage ? (
        <Card variant="outlined">
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <Typography variant="h6">Create Material</Typography>
              <TextField label="Material Code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <TextField label="Material Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <FormControl fullWidth required>
                <InputLabel id="material-uom-label">Default UOM</InputLabel>
                <Select
                  labelId="material-uom-label"
                  label="Default UOM"
                  value={defaultUomId}
                  onChange={(e) => setDefaultUomId(e.target.value)}
                >
                  {(uomsQuery.data?.data ?? []).map((uom) => (
                    <MenuItem key={uom.id} value={uom.id}>
                      {uom.uomCode} · {uom.uomName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                type="submit"
                variant="contained"
                disabled={create.isPending || !defaultUomId}
              >
                Create Material
              </Button>
              {create.isError ? <Alert severity="error">Unable to create Material.</Alert> : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <MasterToolbar search={search} setSearch={setSearch} active={active} setActive={setActive} />
      <Stack spacing={1}>
        {(query.data?.data ?? []).map((item) => (
          <Card key={item.id} variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={600}>{item.materialCode} · {item.materialName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.materialCategory ?? 'Uncategorised'} · UOM {item.defaultUom.uomCode} · {item.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </Box>
                {canManage ? (
                  <StatusButton
                    isActive={item.isActive}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(item)}
                  />
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

export function MasterDataPanel({ permissions }: { permissions: string[] }) {
  const available = useMemo(
    () =>
      (Object.keys(permissionMap) as MasterKey[]).filter((key) =>
        permissions.includes(permissionMap[key].view),
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

  const canManage = permissions.includes(permissionMap[activeKey].manage);

  return (
    <Stack spacing={3}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeKey}
          onChange={(_event, value: MasterKey) => setSelected(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {available.includes('customers') ? <Tab value="customers" label="Customers" /> : null}
          {available.includes('suppliers') ? <Tab value="suppliers" label="Suppliers" /> : null}
          {available.includes('employees') ? <Tab value="employees" label="Employees" /> : null}
          {available.includes('uoms') ? <Tab value="uoms" label="UOM" /> : null}
          {available.includes('materials') ? <Tab value="materials" label="Materials" /> : null}
        </Tabs>
      </Box>

      {activeKey === 'customers' ? <CustomersSection canManage={canManage} /> : null}
      {activeKey === 'suppliers' ? <SuppliersSection canManage={canManage} /> : null}
      {activeKey === 'employees' ? <EmployeesSection canManage={canManage} /> : null}
      {activeKey === 'uoms' ? <UomsSection canManage={canManage} /> : null}
      {activeKey === 'materials' ? <MaterialsSection canManage={canManage} /> : null}
    </Stack>
  );
}
