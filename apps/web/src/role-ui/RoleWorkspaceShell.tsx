import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

export type SourceSection = {
  key: string;
  label: string;
  content: ReactNode;
};

type Locale = 'en' | 'th' | 'zh-TW';
type Screen = 'home' | 'work' | 'module';
type ProjectOption = { id: string; label: string };

const groups = [
  { key: 'projectsGroup', keys: ['projects', 'wbs', 'scheduling', 'site-execution', 'equipment', 'project-engineer', 'documents'] },
  { key: 'procurementGroup', keys: ['purchase-requests', 'sourcing', 'purchase-orders', 'inventory', 'procurement-report'] },
  { key: 'commercialGroup', keys: ['budget', 'subcontracts', 'cost-control', 'finance', 'client-finance', 'payments', 'retention', 'finance-reports'] },
  { key: 'managementGroup', keys: ['management'] },
  { key: 'adminGroup', keys: ['master-data', 'company', 'users', 'roles', 'approvals', 'statuses', 'numbering', 'system'] },
] as const;

// Presentation-only translations. Domain codes, status values and persisted records are never translated.
const labels: Record<Locale, Record<string, string>> = {
  en: {
    home: 'Home', work: 'My Work', menu: 'Menu', signOut: 'Sign out', overview: 'Overview',
    projectsGroup: 'Projects & Site', procurementGroup: 'Purchasing & Inventory',
    commercialGroup: 'Commercial & Finance', managementGroup: 'Management', adminGroup: 'Administration',
    companySession: 'Company session', context: 'Project context', noProject: 'No accessible projects',
    chooseProject: 'Select project', role: 'Assigned roles', welcome: 'Welcome', shortcuts: 'Your workspaces',
    sources: 'Available modules', roleHint: 'Permissions come from your signed-in account.',
    noModules: 'No application modules are available to this account.',
    contextHint: 'This context is used for My Work. Existing modules retain their own authorized project filters.',
    workIntro: 'Source-owned purchasing tasks: your PR drafts and rejected requests in the selected project.',
    noQueue: 'No editable purchase requests created by you were found in this project.',
    queueUnavailable: 'A source-backed purchasing list is unavailable for your current permissions.',
    sourceOnly: 'Approval eligibility is not inferred from permissions; open the source module for configured approval steps.',
    open: 'Open in Purchase Requests', number: 'Purchase request', status: 'Status',
    lineOne: 'line', lineMany: 'lines', statusDraft: 'Draft', statusRejected: 'Rejected', language: 'Interface language',
    error: 'The authorized source could not be loaded. Try again or contact your administrator.',
    loading: 'Loading authorized records…', empty: 'Select an authorized project to see your purchasing work.',
    'projects': 'Projects', 'wbs': 'WBS & Cost Codes', 'scheduling': 'Scheduling',
    'site-execution': 'Site Execution', 'equipment': 'Equipment', 'project-engineer': 'Project Engineer',
    'documents': 'Documents', 'purchase-requests': 'Purchase Requests', 'sourcing': 'RFQ & Quotations',
    'purchase-orders': 'Purchase Orders', 'inventory': 'Inventory', 'procurement-report': 'Procurement Risk',
    'budget': 'BOQ & Budget', 'subcontracts': 'Subcontracts', 'cost-control': 'Cost Control',
    'finance': 'Supplier Finance', 'client-finance': 'Client Finance', 'payments': 'Payments',
    'retention': 'Retention', 'finance-reports': 'Finance Reports', 'management': 'Management',
    'master-data': 'Master Data', 'company': 'Company', 'users': 'Users',
    'roles': 'Roles & Permissions', 'approvals': 'Approval Matrix', 'statuses': 'Statuses',
    'numbering': 'Numbering', 'system': 'System Settings',
  },
  th: {
    home: 'หน้าหลัก', work: 'งานของฉัน', menu: 'เมนู', signOut: 'ออกจากระบบ', overview: 'ภาพรวม',
    projectsGroup: 'โครงการและหน้างาน', procurementGroup: 'จัดซื้อและคลังสินค้า',
    commercialGroup: 'ต้นทุนและการเงิน', managementGroup: 'ผู้บริหาร', adminGroup: 'การดูแลระบบ',
    companySession: 'บริษัทที่เข้าสู่ระบบ', context: 'บริบทโครงการ', noProject: 'ไม่มีโครงการที่เข้าถึงได้',
    chooseProject: 'เลือกโครงการ', role: 'บทบาทที่ได้รับ', welcome: 'ยินดีต้อนรับ', shortcuts: 'พื้นที่ทำงาน',
    sources: 'โมดูลที่เข้าถึงได้', roleHint: 'สิทธิ์มาจากบัญชีผู้ใช้ที่เข้าสู่ระบบ',
    noModules: 'บัญชีนี้ยังไม่มีสิทธิ์เข้าโมดูล', contextHint: 'เลือกโครงการสำหรับงานของฉัน โมดูลเดิมยังใช้ตัวกรองสิทธิ์ของแต่ละโมดูล',
    workIntro: 'งานจัดซื้อจากระบบจริง: ใบขอซื้อฉบับร่างหรือถูกปฏิเสธที่คุณสร้างในโครงการนี้',
    noQueue: 'ไม่พบใบขอซื้อที่คุณสร้างและยังแก้ไขได้ในโครงการนี้',
    queueUnavailable: 'สิทธิ์ปัจจุบันไม่อนุญาตให้ดูรายการงานจัดซื้อ',
    sourceOnly: 'สิทธิ์อนุมัติขึ้นกับขั้นตอนที่กำหนดในระบบ โปรดตรวจสอบในโมดูลต้นทาง',
    open: 'เปิดใบขอซื้อ', number: 'เลขที่ใบขอซื้อ', status: 'สถานะ',
    lineOne: 'รายการ', lineMany: 'รายการ', statusDraft: 'ฉบับร่าง', statusRejected: 'ถูกปฏิเสธ', language: 'ภาษาของระบบ',
    error: 'โหลดข้อมูลที่ได้รับอนุญาตไม่ได้ โปรดลองอีกครั้งหรือติดต่อผู้ดูแล',
    loading: 'กำลังโหลดข้อมูลที่ได้รับอนุญาต…', empty: 'เลือกโครงการที่เข้าถึงได้เพื่อดูงานจัดซื้อ',
    projects: 'โครงการ', wbs: 'WBS และรหัสต้นทุน', scheduling: 'แผนงาน', 'site-execution': 'งานหน้างาน',
    equipment: 'อุปกรณ์', 'project-engineer': 'วิศวกรโครงการ', documents: 'เอกสาร',
    'purchase-requests': 'ใบขอซื้อ', sourcing: 'RFQ และใบเสนอราคา',
    'purchase-orders': 'ใบสั่งซื้อ', inventory: 'คลังสินค้า', 'procurement-report': 'ความเสี่ยงจัดซื้อ',
    budget: 'BOQ และงบประมาณ', subcontracts: 'ผู้รับเหมาช่วง', 'cost-control': 'ควบคุมต้นทุน',
    finance: 'การเงินเจ้าหนี้', 'client-finance': 'การเงินลูกหนี้', payments: 'การชำระเงิน',
    retention: 'เงินประกันผลงาน', 'finance-reports': 'รายงานการเงิน', management: 'รายงานผู้บริหาร',
    'master-data': 'ข้อมูลหลัก', company: 'บริษัท', users: 'ผู้ใช้งาน',
    roles: 'บทบาทและสิทธิ์', approvals: 'ลำดับการอนุมัติ', statuses: 'สถานะ',
    numbering: 'เลขที่เอกสาร', system: 'ตั้งค่าระบบ',
  },
  'zh-TW': {
    home: '首頁', work: '我的工作', menu: '選單', signOut: '登出', overview: '總覽',
    projectsGroup: '專案與工地', procurementGroup: '採購與庫存',
    commercialGroup: '商務與財務', managementGroup: '管理階層', adminGroup: '系統管理',
    companySession: '登入公司', context: '專案範圍', noProject: '沒有可存取的專案',
    chooseProject: '選擇專案', role: '指派的角色', welcome: '歡迎', shortcuts: '可用工作區',
    sources: '可存取模組', roleHint: '權限由您登入的帳號決定。',
    noModules: '此帳號沒有可用模組。', contextHint: '此選擇僅影響「我的工作」；原有模組仍使用各自的授權專案篩選。',
    workIntro: '來自原始採購系統的工作：您在所選專案建立的草稿與遭退回採購申請。',
    noQueue: '此專案沒有由您建立且可編輯的採購申請。',
    queueUnavailable: '目前權限無法讀取採購工作清單。',
    sourceOnly: '不能僅依權限推斷審批資格；請在原模組確認設定的審批步驟。',
    open: '開啟採購申請', number: '採購申請編號', status: '狀態',
    lineOne: '筆明細', lineMany: '筆明細', statusDraft: '草稿', statusRejected: '已駁回', language: '介面語言',
    error: '無法讀取授權資料，請重試或聯絡管理員。',
    loading: '正在載入授權資料…', empty: '請選擇有權存取的專案以查看採購工作。',
    projects: '專案', wbs: 'WBS 與成本代碼', scheduling: '工程排程', 'site-execution': '工地執行',
    equipment: '設備', 'project-engineer': '專案工程師', documents: '文件',
    'purchase-requests': '採購申請', sourcing: '詢價與報價',
    'purchase-orders': '採購訂單', inventory: '庫存', 'procurement-report': '採購風險',
    budget: '工程數量與預算', subcontracts: '分包管理', 'cost-control': '成本控制',
    finance: '供應商財務', 'client-finance': '客戶財務', payments: '付款',
    retention: '保留款', 'finance-reports': '財務報表', management: '管理報表',
    'master-data': '主檔資料', company: '公司', users: '使用者',
    roles: '角色與權限', approvals: '核准矩陣', statuses: '狀態',
    numbering: '單號設定', system: '系統設定',
  },
};

function translate(locale: Locale, key: string, fallback: string) {
  return labels[locale][key] ?? fallback;
}

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const sectionByKey = useMemo(() => new Map(sections.map((item) => [item.key, item])), [sections]);
  const canReadPr = user.permissions.includes('procurement.pr.view') && sectionByKey.has('purchase-requests');
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
    setSelectedProjectId((current) =>
      projects.some((p) => p.id === current) ? current : (projects[0]?.id ?? ''),
    );
  }, [projectQuery.isSuccess, projectQuery.data, user.id, user.companyId]);

  const prQuery = useQuery({
    queryKey: ['v1.1', 'my-prs', user.id, user.companyId, selectedProjectId],
    queryFn: () => procurementApi.requests(selectedProjectId),
    enabled: screen === 'work' && canReadPr && Boolean(selectedProjectId) &&
      projectQuery.isSuccess && projects.some((p) => p.id === selectedProjectId),
  });
  const myEditableRequests = (prQuery.data?.data ?? []).filter(
    (item) => item.createdByUserId === user.id &&
      (item.lifecycleState === 'DRAFT' || item.lifecycleState === 'REJECTED'),
  );

  const openSection = (key: string) => {
    if (!sectionByKey.has(key)) return;
    onSelect(key);
    setScreen('module');
    setMobileMenu(false);
  };
  const openPr = (requestId: string) => {
    if (!selectedProjectId || !sectionByKey.has('purchase-requests')) return;
    onOpenPr(selectedProjectId, requestId);
    setScreen('module');
    setMobileMenu(false);
  };
  const selectScreen = (next: Screen) => {
    setScreen(next);
    setMobileMenu(false);
  };
  const activeSection = activeKey ? sectionByKey.get(activeKey) : undefined;
  const navButton = (key: 'home' | 'work', view: Screen) => (
    <ListItemButton selected={screen === view} onClick={() => selectScreen(view)} key={key}>
      <ListItemText primary={t(key, key)} />
    </ListItemButton>
  );

  const navigation = (
    <Box sx={{ overflowY: 'auto', py: 1, height: '100%' }}>
      <Typography variant="overline" sx={{ px: 2 }} color="text.secondary">
        {t('overview', 'Overview')}
      </Typography>
      <List dense disablePadding>
        {navButton('home', 'home')}
        {navButton('work', 'work')}
      </List>
      <Divider sx={{ my: 1 }} />
      {groups.map((group) => {
        const permitted = group.keys.filter((key) => sectionByKey.has(key));
        if (!permitted.length) return null;
        return (
          <Box key={group.key} sx={{ mb: 1 }}>
            <Typography variant="overline" sx={{ px: 2 }} color="text.secondary">
              {t(group.key, group.key)}
            </Typography>
            <List dense disablePadding>
              {permitted.map((key) => (
                <ListItemButton
                  key={key}
                  selected={screen === 'module' && key === activeKey}
                  onClick={() => openSection(key)}
                  sx={{ pl: 3 }}
                >
                  <ListItemText primary={t(key, sectionByKey.get(key)?.label ?? key)} />
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
        projects.length === 0 ? <Alert severity="info">{t('noProject', 'No accessible projects')}</Alert> :
        <FormControl size="small" fullWidth>
          <InputLabel id="v11-project-label">{t('context', 'Project context')}</InputLabel>
          <Select
            labelId="v11-project-label"
            label={t('context', 'Project context')}
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}
          </Select>
        </FormControl>}
    </Box>
  ) : null;

  const home = (
    <Stack spacing={3}>
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
              {user.roleCodes.map((code) => <Chip key={code} label={code} variant="outlined" size="small" />)}
              {user.roleCodes.length === 0 && <Typography variant="body2">—</Typography>}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      <Typography variant="h6">{t('shortcuts', 'Your workspaces')}</Typography>
      {sections.length === 0 ? <Alert severity="info">{t('noModules', 'No application modules are available.')}</Alert> :
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: 2 }}>
          {sections.slice(0, 8).map((section) => (
            <Card variant="outlined" key={section.key}>
              <CardContent>
                <Button onClick={() => openSection(section.key)} sx={{ textAlign: 'left', justifyContent: 'flex-start' }}>
                  {t(section.key, section.label)}
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>}
    </Stack>
  );

  const work = (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>{t('work', 'My Work')}</Typography>
      <Typography color="text.secondary">{t('workIntro', 'Your purchasing work in the selected project.')}</Typography>
      {projectControl}
      {projectSource !== 'none' && <Typography variant="caption" color="text.secondary">
        {t('contextHint', 'This context is for My Work only; legacy modules keep their own authorized filters.')}
      </Typography>}
      {!canReadPr ? <Alert severity="info">{t('queueUnavailable', 'Purchasing list unavailable for your permissions.')}</Alert> :
        !selectedProjectId ? <Alert severity="info">{t('empty', 'Select an authorized project to view purchasing work.')}</Alert> :
        prQuery.isPending ? <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={20} /><Typography>{t('loading', 'Loading records…')}</Typography></Stack> :
        prQuery.isError ? <Alert severity="error">{t('error', 'Unable to load authorized source.')}</Alert> :
        myEditableRequests.length === 0 ? <Alert severity="info">{t('noQueue', 'No editable purchase requests created by you.')}</Alert> :
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
      <AppBar color="inherit" position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          {isMobile && <Button onClick={() => setMobileMenu(true)} aria-label={t('menu', 'Menu')}>{t('menu', 'Menu')}</Button>}
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
            width: 252, boxSizing: 'border-box', position: isMobile ? 'fixed' : 'relative',
            height: isMobile ? '100%' : 'calc(100vh - 64px)',
          } }}
        >
          {navigation}
        </Drawer>
        <Container component="main" maxWidth="xl" sx={{ py: 3, minWidth: 0, flex: 1 }}>
          <Stack spacing={2}>
            {screen === 'module' && activeSection &&
              <Typography variant="body2" color="text.secondary">
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
