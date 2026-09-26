import { FormEvent, useState } from 'react';
import {
  Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { projectsApi, ProjectRecord } from '../api/projects';

const emptyProject = {
  projectCode: '', projectName: '', customerId: '', statusDefinitionId: '',
  contractValue: '0.00', location: '', description: '',
  plannedStartDate: '', plannedCompletionDate: '',
};

export function ProjectsPanel({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const canCreate = permissions.includes('projects.project.create');
  const canEdit = permissions.includes('projects.project.edit');
  const canArchive = permissions.includes('projects.project.archive');
  const canViewTeam = permissions.includes('projects.team.view');
  const canManageTeam = permissions.includes('projects.team.manage');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [selected, setSelected] = useState<ProjectRecord | null>(null);
  const [form, setForm] = useState(emptyProject);
  const [employeeId, setEmployeeId] = useState('');
  const [projectRole, setProjectRole] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const projects = useQuery({
    queryKey: ['projects', search, active],
    queryFn: () => projectsApi.list(search, active),
  });
  const options = useQuery({
    queryKey: ['projects', 'edit-options'],
    queryFn: projectsApi.editOptions,
    enabled: canCreate || canEdit,
  });
  const members = useQuery({
    queryKey: ['projects', selected?.id, 'members'],
    queryFn: () => projectsApi.members(selected!.id),
    enabled: Boolean(selected && canViewTeam),
  });
  const memberOptions = useQuery({
    queryKey: ['projects', selected?.id, 'member-options'],
    queryFn: () => projectsApi.memberOptions(selected!.id),
    enabled: Boolean(selected && canManageTeam),
  });
  const contacts = useQuery({
    queryKey: ['projects', selected?.id, 'contacts'],
    queryFn: () => projectsApi.contacts(selected!.id),
    enabled: Boolean(selected && canViewTeam),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const save = useMutation({
    mutationFn: () => selected
      ? projectsApi.update(selected.id, form)
      : projectsApi.create(form),
    onSuccess: async (result) => {
      setSelected(result.data);
      await refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (project: ProjectRecord) =>
      projectsApi.setActive(project.id, !project.isActive),
    onSuccess: refresh,
  });
  const addMember = useMutation({
    mutationFn: () => projectsApi.addMember(selected!.id, { employeeId, projectRole }),
    onSuccess: async () => {
      setEmployeeId(''); setProjectRole('');
      await queryClient.invalidateQueries({ queryKey: ['projects', selected?.id, 'members'] });
    },
  });
  const addContact = useMutation({
    mutationFn: () => projectsApi.addContact(selected!.id, {
      contactName,
      ...(contactEmail ? { email: contactEmail } : {}),
    }),
    onSuccess: async () => {
      setContactName(''); setContactEmail('');
      await queryClient.invalidateQueries({ queryKey: ['projects', selected?.id, 'contacts'] });
    },
  });

  function edit(project: ProjectRecord) {
    setSelected(project);
    setForm({
      projectCode: project.projectCode,
      projectName: project.projectName,
      customerId: project.customer.id,
      statusDefinitionId: project.statusDefinition.id,
      contractValue: project.contractValue,
      location: project.location ?? '',
      description: project.description ?? '',
      plannedStartDate: project.plannedStartDate.slice(0, 10),
      plannedCompletionDate: project.plannedCompletionDate.slice(0, 10),
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField label="Search Projects" value={search} onChange={(e) => setSearch(e.target.value)} fullWidth />
        <TextField select label="Status" value={active} onChange={(e) => setActive(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Archived</MenuItem>
        </TextField>
        {canCreate ? (
          <Button variant="contained" onClick={() => { setSelected(null); setForm(emptyProject); }}>
            New Project
          </Button>
        ) : null}
      </Stack>

      {projects.isError ? <Alert severity="error">Unable to load Projects.</Alert> : null}
      <Stack spacing={1}>
        {(projects.data?.data ?? []).map((project) => (
          <Card key={project.id} variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
                <div>
                  <Typography fontWeight={600}>{project.projectCode} · {project.projectName}</Typography>
                  <Typography color="text.secondary">
                    {project.customer.customerName} · {project.statusDefinition.statusLabel} · {project.isActive ? 'Active' : 'Archived'}
                  </Typography>
                  <Typography variant="body2">
                    {project.plannedStartDate.slice(0, 10)} → {project.plannedCompletionDate.slice(0, 10)} · Contract {project.contractValue}
                  </Typography>
                </div>
                <Stack direction="row" spacing={1}>
                  {(canEdit || canViewTeam) ? <Button size="small" onClick={() => edit(project)}>Open</Button> : null}
                  {canArchive ? (
                    <Button size="small" onClick={() => toggle.mutate(project)}>
                      {project.isActive ? 'Archive' : 'Reactivate'}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {(canCreate || (selected && canEdit)) ? (
        <Card variant="outlined">
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={submit}>
              <Typography variant="h6">{selected ? 'Edit Project' : 'Create Project'}</Typography>
              {save.isError ? <Alert severity="error">Unable to save Project. Check the entered data and your access.</Alert> : null}
              <TextField label="Project Code" value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} required />
              <TextField label="Project Name" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} required />
              <TextField select label="Customer" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                {(options.data?.data.customers ?? []).map((item) => (
                  <MenuItem key={item.id} value={item.id}>{String(item.customerCode)} · {String(item.customerName)}</MenuItem>
                ))}
              </TextField>
              <TextField select label="Project Status" value={form.statusDefinitionId} onChange={(e) => setForm({ ...form, statusDefinitionId: e.target.value })} required>
                {(options.data?.data.statuses ?? []).map((item) => (
                  <MenuItem key={item.id} value={item.id}>{String(item.statusCode)} · {String(item.statusLabel)}</MenuItem>
                ))}
              </TextField>
              <TextField label="Contract Value" type="number" value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: e.target.value })} required />
              <TextField label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <TextField label="Description" multiline minRows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Planned Start" type="date" value={form.plannedStartDate} onChange={(e) => setForm({ ...form, plannedStartDate: e.target.value })} InputLabelProps={{ shrink: true }} required fullWidth />
                <TextField label="Planned Completion" type="date" value={form.plannedCompletionDate} onChange={(e) => setForm({ ...form, plannedCompletionDate: e.target.value })} InputLabelProps={{ shrink: true }} required fullWidth />
              </Stack>
              <Button type="submit" variant="contained" disabled={save.isPending}>{selected ? 'Save Changes' : 'Create Project'}</Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {selected && canViewTeam ? (
        <Stack spacing={2}>
          <Typography variant="h6">Project Team</Typography>
          {(members.data?.data ?? []).map((member) => (
            <Card key={member.id} variant="outlined"><CardContent>
              <Typography fontWeight={600}>{member.employee.employeeName} · {member.projectRole}</Typography>
              <Typography variant="body2" color="text.secondary">{member.isActive ? 'Active' : 'Inactive'}{member.employee.jobTitle ? ' · ' + member.employee.jobTitle : ''}</Typography>
            </CardContent></Card>
          ))}
          {canManageTeam ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} fullWidth>
                {(memberOptions.data?.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{String(item.employeeCode)} · {String(item.employeeName)}</MenuItem>)}
              </TextField>
              <TextField label="Project Role" value={projectRole} onChange={(e) => setProjectRole(e.target.value)} fullWidth />
              <Button variant="outlined" disabled={!employeeId || !projectRole || addMember.isPending} onClick={() => addMember.mutate()}>Add Member</Button>
            </Stack>
          ) : null}

          <Typography variant="h6">Project Contacts</Typography>
          {(contacts.data?.data ?? []).map((contact) => (
            <Card key={contact.id} variant="outlined"><CardContent>
              <Typography fontWeight={600}>{contact.contactName}{contact.roleOrTitle ? ' · ' + contact.roleOrTitle : ''}</Typography>
              <Typography variant="body2" color="text.secondary">{contact.organizationName ?? ''}{contact.email ? ' · ' + contact.email : ''}{contact.phone ? ' · ' + contact.phone : ''}</Typography>
            </CardContent></Card>
          ))}
          {canManageTeam ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} fullWidth />
              <TextField label="Email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} fullWidth />
              <Button variant="outlined" disabled={!contactName || addContact.isPending} onClick={() => addContact.mutate()}>Add Contact</Button>
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
