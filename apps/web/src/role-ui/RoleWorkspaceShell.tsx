import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert, AppBar, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
  Divider, Drawer, FormControl, InputLabel, List, ListItemButton,
  ListItemText, MenuItem, Select, Stack, Toolbar, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';

import type { CurrentUser } from '../api/auth';
import { procurementApi } from '../api/procurement';
import { projectsApi } from '../api/projects';
import { translate, type Locale } from './role-workspace-i18n';
import {
  visibleNavigationKeys, mayReadMyPurchaseRequests, selectedAccessibleProject,
  isAccessibleProject, ownEditablePurchaseRequests, verifiedPurchaseRequestLink,
} from './role-workspace-policy';

export type SourceSection = {
  key: string;
  label: string;
  content: ReactNode;
};

type Screen = 'home' | 'work' | 'module';
type ProjectOption = { id: string; label: string };

const groups = [
  { key: 'projectsGroup', keys: ['projects', 'wbs', 'scheduling', 'site-execution', 'equipment', 'project-engineer', 'documents'] },
  { key: 'procurementGroup', keys: ['purchase-requests', 'sourcing', 'purchase-orders', 'inventory', 'procurement-report'] },
  { key: 'commercialGroup', keys: ['budget', 'subcontracts', 'cost-control', 'finance', 'client-finance', 'payments', 'retention', 'finance-reports'] },
  { key: 'managementGroup', keys: ['management'] },
  { key: 'adminGroup', keys: ['master-data', 'company', 'users', 'roles', 'approvals', 'statuses', 'numbering', 'system'] },
] as const;

export function RoleWorkspaceShell({
  user, sections, activeKey, onSelect, onOpenPr, onLogout, logoutPending,
}: {
  user: CurrentUser;
  sections: SourceSection[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onOpenPr: (projectId: string, requestId: string) => void;
  onLogout: () => void;
  logoutPending: boolean;
}) {
  const [locale, setLocale] = useState<Locale>('en');
  const [screen, setScreen] = useState<Screen>('home');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const navigationRef = useRef<HTMLElement | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  // The temporary MUI Drawer traps focus and restores it to its opener on close.
  // Explicitly enter the first visible control when the mobile drawer opens.
  useEffect(() => {
    if (isMobile && mobileMenu) {
      navigationRef.current?.querySelector<HTMLElement>('button, [role="button"]')?.focus();
    }
  }, [isMobile, mobileMenu]);
  const sectionByKey = useMemo(() => new Map(sections.map((item) => [item.key, item])), [sections]);
  const sourceKeys = useMemo(() => sections.map((item) => item.key), [sections]);
  const canReadPr = mayReadMyPurchaseRequests(user.permissions, sourceKeys);
  const projectSource = canReadPr ? 'procurement' : user.permissions.includes('projects.project.view') ? 'projects' : 'none';

  const projectQuery = useQuery({
    queryKey: ['v1.1', 'project-context', user.id, user.companyId, projectSource],
    queryFn: async (): Promise<ProjectOption[]> => {
      if (projectSource === 'procurement') {
        const result = await procurementApi.projects();
        return result.data.map((p) => ({ id: p.id, label: p.projectCode + ' — ' + p.projectName }));
      }
      const result = await projectsApi.list('', 'true');
      return result.data.map((p) => ({ id: p.id, label: p.projectCode + ' — ' + p.projectName }));
    },
    enabled: projectSource !== 'none',
  });

  const projects = projectQuery.data ?? [];
  useEffect(() => {
    if (!projectQuery.isSuccess) {
      setSelectedProjectId('');
      return;
    }
    setSelectedProjectId((current) => selectedAccessibleProject(current, projects));
  }, [projectQuery.isSuccess, projectQuery.data, user.id, user.companyId]);

  const prQuery = useQuery({
    queryKey: ['v1.1', 'my-prs', user.id, user.companyId, selectedProjectId],
    queryFn: () => procurementApi.requests(selectedProjectId),
    enabled: screen === 'work' && canReadPr && Boolean(selectedProjectId) &&
      projectQuery.isSuccess && isAccessibleProject(selectedProjectId, projects),
  });
  const myEditableRequests = ownEditablePurchaseRequests(
    prQuery.data?.data ?? [], user.id, user.companyId, selectedProjectId, projects,
  );

  const openSection = (key: string) => {
    if (!sectionByKey.has(key)) return;
    onSelect(key);
    setScreen('module');
    setMobileMenu(false);
  };
  const openPr = (requestId: string) => {
    const link = verifiedPurchaseRequestLink(requestId, selectedProjectId, projects, myEditableRequests);
    if (!canReadPr || !link) return;
    onOpenPr(link.projectId, link.requestId);
    setScreen('module');
    setMobileMenu(false);
  };
  const selectScreen = (next: Screen) => {
    setScreen(next);
    setMobileMenu(false);
  };
  const activeSection = activeKey ? sectionByKey.get(activeKey) : undefined;
  const navButton = (key: 'home' | 'work', view: Screen) => (
    <ListItemButton selected={screen === view} aria-current={screen === view ? 'page' : undefined} onClick={() => selectScreen(view)} key={key}>
      <ListItemText primary={t(key, key)} sx={{ minWidth: 0, overflowWrap: 'anywhere' }} />
    </ListItemButton>
  );

  const navigation = (
    <Box component="nav" id="v11-primary-navigation" ref={navigationRef} lang={locale}
      aria-label={t('primaryNavigation', 'Main navigation')}
      sx={{ overflowY: 'auto', overflowX: 'hidden', py: 1, height: '100%' }}>
      {isMobile && <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1 }}>
        <Button size="small" onClick={() => setMobileMenu(false)}
          sx={{ minHeight: 44, minWidth: 44 }}>
          {t('closeMenu', 'Close menu')}
        </Button>
      </Box>}
      <Typography variant="overline" sx={{ px: 2, overflowWrap: 'anywhere' }} color="text.secondary">
        {t('overview', 'Overview')}
      </Typography>
      <List dense disablePadding>
        {navButton('home', 'home')}
        {navButton('work', 'work')}
      </List>
      <Divider sx={{ my: 1 }} />
      {groups.map((group) => {
        const permitted = visibleNavigationKeys(group.keys, sourceKeys);
        if (!permitted.length) return null;
        return (
          <Box key={group.key} sx={{ mb: 1 }}>
            <Typography variant="overline" sx={{ px: 2, overflowWrap: 'anywhere' }} color="text.secondary">
              {t(group.key, group.key)}
            </Typography>
            <List dense disablePadding>
              {permitted.map((key) => (
                <ListItemButton
                  key={key}
                  selected={screen === 'module' && key === activeKey}
                  aria-current={screen === 'module' && key === activeKey ? 'page' : undefined}
                  onClick={() => openSection(key)}
                  sx={{ pl: 3 }}
                >
                  <ListItemText primary={t(key, sectionByKey.get(key)?.label ?? key)} sx={{ minWidth: 0, overflowWrap: 'anywhere' }} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        );
      })}
    </Box>
  );

  const projectControl = projectSource !== 'none' ? (
    <Box sx={{ minWidth: { xs: '100%', sm: 250 }, maxWidth: 370 }}>
      {projectQuery.isError ? <Alert severity="warning">{t('error', 'Unable to load project context.')}</Alert> :
        projectQuery.isPending ? <CircularProgress size={20} aria-label={t('loading', 'Loading')} /> :
        projects.length === 0 ? <Alert severity="info" role="status">{t('noProject', 'No accessible projects')}</Alert> :
        <FormControl size="small" fullWidth>
          <InputLabel id="v11-project-label">{t('context', 'Project context')}</InputLabel>
          <Select
            labelId="v11-project-label"
            label={t('context', 'Project context')}
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            {projects.map((p) => <MenuItem key={p.id} value={p.id} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{p.label}</MenuItem>)}
          </Select>
        </FormControl>}
    </Box>
  ) : null;

  const home = (
    <Stack spacing={3} lang={locale} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>{t('welcome', 'Welcome')}, {user.displayName}</Typography>
        <Typography color="text.secondary">{t('roleHint', 'Permissions come from your signed-in account.')}</Typography>
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography color="text.secondary" variant="body2">{t('sources', 'Available modules')}</Typography>
            <Typography variant="h4">{sections.length}</Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: 2 }}>
          <CardContent>
            <Typography color="text.secondary" variant="body2">{t('role', 'Assigned roles')}</Typography>
            <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
              {user.roleCodes.map((code) => <Chip key={code} label={code} variant="outlined" size="small"
                sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: 0.5 } }} />)}
              {user.roleCodes.length === 0 && <Typography variant="body2">—</Typography>}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      <Typography variant="h6">{t('shortcuts', 'Your workspaces')}</Typography>
      {sections.length === 0 ? <Alert severity="info">{t('noModules', 'No application modules are available.')}</Alert> :
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(195px, 100%), 1fr))', gap: 2 }}>
          {sections.slice(0, 8).map((section) => (
            <Card variant="outlined" key={section.key}>
              <CardContent>
                <Button onClick={() => openSection(section.key)} sx={{ textAlign: 'left', justifyContent: 'flex-start', overflowWrap: 'anywhere' }}>
                  {t(section.key, section.label)}
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>}
    </Stack>
  );

  const work = (
    <Stack spacing={2} lang={locale} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
      aria-busy={Boolean(selectedProjectId) && canReadPr && prQuery.isPending}>
      <Typography variant="h5" fontWeight={700}>{t('work', 'My Work')}</Typography>
      <Typography color="text.secondary">{t('workIntro', 'Your purchasing work in the selected project.')}</Typography>
      {projectControl}
      {projectSource !== 'none' && <Typography variant="caption" color="text.secondary">
        {t('contextHint', 'This context is for My Work only; legacy modules keep their own authorized filters.')}
      </Typography>}
      {!canReadPr ? <Alert severity="info" role="status">{t('queueUnavailable', 'Purchasing list unavailable for your permissions.')}</Alert> :
        projectQuery.isError || projectQuery.isPending ? null :
        !selectedProjectId ? <Alert severity="info" role="status">{t('empty', 'Select an authorized project to view purchasing work.')}</Alert> :
        prQuery.isPending ? <Stack direction="row" spacing={1} alignItems="center" role="status" aria-live="polite"><CircularProgress size={20} /><Typography>{t('loading', 'Loading records…')}</Typography></Stack> :
        prQuery.isError ? <Alert severity="error">{t('error', 'Unable to load authorized source.')}</Alert> :
        myEditableRequests.length === 0 ? <Alert severity="info" role="status">{t('noQueue', 'No editable purchase requests created by you.')}</Alert> :
        <Stack spacing={1}>
          {myEditableRequests.map((pr) => (
            <Card key={pr.id} variant="outlined">
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1.5}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>{pr.prNumber}</Typography>
                    <Typography variant="body2" color="text.secondary">{t('number', 'Purchase request')} · {pr._count.lines} {t(pr._count.lines === 1 ? 'lineOne' : 'lineMany', pr._count.lines === 1 ? 'line' : 'lines')}</Typography>
                  </Box>
                  <Chip size="small" label={pr.lifecycleState === 'REJECTED' ? t('statusRejected', 'Rejected') : t('statusDraft', 'Draft')} color={pr.lifecycleState === 'REJECTED' ? 'warning' : 'default'} />
                  <Button variant="outlined" onClick={() => openPr(pr.id)}>
                    {t('open', 'Open in Purchase Requests')}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>}
      <Alert severity="info">{t('sourceOnly', 'Approval eligibility is evaluated in the source module.')}</Alert>
    </Stack>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar lang={locale} color="inherit" position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: { xs: 1, md: 2 }, flexWrap: { xs: 'wrap', md: 'nowrap' }, py: { xs: 1, md: 0 } }}>
          {isMobile && <Button onClick={() => setMobileMenu(true)} aria-label={t('menu', 'Menu')}
            aria-controls="v11-primary-navigation" aria-expanded={mobileMenu}
            sx={{ minHeight: 44, minWidth: 44 }}>{t('menu', 'Menu')}</Button>}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700}>Construction ERP</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('companySession', 'Company session')} · {user.companyId.slice(0, 8)}
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <Select aria-label={t('language', 'Interface language')} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <MenuItem value="en">EN</MenuItem>
              <MenuItem value="th">ไทย</MenuItem>
              <MenuItem value="zh-TW">繁中</MenuItem>
            </Select>
          </FormControl>
          <Button onClick={onLogout} disabled={logoutPending}>{t('signOut', 'Sign out')}</Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ display: 'flex' }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileMenu : true}
          onClose={() => setMobileMenu(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ width: isMobile ? 0 : 252, flexShrink: 0, '& .MuiDrawer-paper': {
            width: isMobile ? 'min(252px, 100vw)' : 252, boxSizing: 'border-box', position: isMobile ? 'fixed' : 'relative',
            height: isMobile ? '100%' : 'calc(100vh - 64px)',
          } }}
        >
          {navigation}
        </Drawer>
        <Container component="main" maxWidth="xl" sx={{ py: 3, minWidth: 0, flex: 1 }}>
          <Stack spacing={2}>
            {screen === 'module' && activeSection &&
              <Typography variant="body2" color="text.secondary" lang={locale} sx={{ overflowWrap: 'anywhere' }}>
                {t('home', 'Home')} / {t(activeSection.key, activeSection.label)}
              </Typography>}
            {screen === 'home' ? home : screen === 'work' ? work :
              activeSection ? activeSection.content : <Alert severity="warning">{t('noModules', 'No available module.')}</Alert>}
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
