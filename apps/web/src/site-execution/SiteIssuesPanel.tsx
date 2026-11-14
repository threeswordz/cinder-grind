import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useEffect, useRef, useState } from 'react';
import type { CurrentUser } from '../api/auth';
import { ApiError } from '../api/client';
import { siteIssuesApi, type IssueCategory, type IssueOperation } from '../api/site-issues';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';
import { siteIssueLabels } from './site-issue-labels';

export type SiteIssueLink = { projectId: string; id: string };
const identity = (user: CurrentUser) => [user.companyId, user.id, [...user.permissions].sort().join(',')].join(':');

export function SiteIssueAlerts({ user, onOpen }: { user: CurrentUser; onOpen: (link: SiteIssueLink) => void }) {
  const t = siteIssueLabels[useContext(MonetaryLocaleContext)];
  const can = user.permissions.includes('site.issue.view') && user.permissions.includes('site.issue.escalation.view');
  const query = useQuery({ queryKey: ['fm03', identity(user), 'alerts'], queryFn: siteIssuesApi.alerts,
    enabled: can, retry: false, refetchInterval: 15000, gcTime: 0, refetchOnWindowFocus: true });
  if (!can) return null;
  if (query.isError) return <Alert severity="warning">{t.unavailable}</Alert>;
  if (!query.isSuccess || !query.data.data.total) return null;
  return <Alert severity="error" data-testid="site-issue-alerts" sx={{ mb: 2 }}>
    <Typography>{t.alerts}: {query.data.data.total}</Typography>
    {query.data.data.items.slice(0, 5).map(i => <Button key={i.id} onClick={() => onOpen({ projectId: i.project.id, id: i.id })}>
      {t.open}: {i.project.projectCode} · {i.description}
    </Button>)}
  </Alert>;
}

export function SiteIssuesPanel({ user, initialLink }: { user: CurrentUser; initialLink: SiteIssueLink | null }) {
  const t = siteIssueLabels[useContext(MonetaryLocaleContext)], scope = identity(user), cache = useQueryClient();
  const text = (key: string) => (t as Record<string, string>)[key] ?? key;
  const can = (suffix: string) => user.permissions.includes('site.issue.' + suffix);
  const view = can('view'), configure = can('routing.manage');
  const [projectId, setProject] = useState(''), [selected, setSelected] = useState('');
  const [pin, setPin] = useState<number | null>(null), [pages, setPages] = useState(['']);
  const [beforeVersion, setBefore] = useState<number | undefined>();
  const [description, setDescription] = useState(''), [category, setCategory] = useState<IssueCategory>('GENERAL');
  const [reportId, setReport] = useState(''), [activityId, setActivity] = useState('');
  const [affects, setAffects] = useState(false), [stopped, setStopped] = useState(false), [delay, setDelay] = useState(false);
  const [note, setNote] = useState(''), [assetSeverity, setAsset] = useState('');
  const [owner, setOwner] = useState(''), [recipient, setRecipient] = useState(''), [reason, setReason] = useState('');
  const [pending, setPending] = useState<IssueOperation | null>(null), pendingRef = useRef<IssueOperation | null>(null);
  const [message, setMessage] = useState<'saved' | 'unavailable' | 'uncertain' | null>(null);
  const base = ['fm03', scope];
  const projects = useQuery({ queryKey: [...base, 'projects'], queryFn: siteIssuesApi.projects,
    enabled: view || configure, retry: false, gcTime: 0, refetchOnWindowFocus: true });
  const authorized = projects.isSuccess && !projects.isFetching && projects.data.data.some(p => p.id === projectId);
  const routing = useQuery({ queryKey: [...base, projectId, 'routing'], queryFn: () => siteIssuesApi.routing(projectId),
    enabled: authorized, retry: false, gcTime: 0, refetchOnWindowFocus: true });
  const candidates = useQuery({ queryKey: [...base, projectId, 'candidates'], queryFn: () => siteIssuesApi.candidates(projectId),
    enabled: authorized && configure, retry: false, gcTime: 0 });
  const options = useQuery({ queryKey: [...base, projectId, 'options'], queryFn: () => siteIssuesApi.options(projectId),
    enabled: authorized && view && can('report'), retry: false, gcTime: 0 });
  const list = useQuery({ queryKey: [...base, projectId, 'list', pages.at(-1)], queryFn: () => siteIssuesApi.list(projectId, pages.at(-1) ?? ''),
    enabled: authorized && view, retry: false, gcTime: 0, refetchInterval: 15000, refetchOnWindowFocus: true });
  const detail = useQuery({ queryKey: [...base, projectId, selected, 'detail', beforeVersion], queryFn: () => siteIssuesApi.get(selected, beforeVersion),
    enabled: authorized && view && Boolean(selected), retry: false, gcTime: 0, refetchInterval: 15000, refetchOnWindowFocus: true });
  const current = authorized && view && detail.isSuccess && !detail.isFetching && detail.data.data.projectId === projectId
    ? detail.data.data : null;
  const mutation = useMutation({
    mutationFn: siteIssuesApi.send,
    onSuccess: async result => {
      pendingRef.current = null; setPending(null); setMessage('saved'); setNote(''); setAsset(''); setReason('');
      if (result.data.id) { setSelected(result.data.id); setPin(result.data.version); setBefore(undefined); setDescription(''); }
      await cache.invalidateQueries({ queryKey: base });
    },
    onError: error => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        pendingRef.current = null; setPending(null); setMessage('unavailable');
        void cache.invalidateQueries({ queryKey: base });
      } else setMessage('uncertain');
    },
  });
  function send(path: string, body: Record<string, unknown>) {
    if (pendingRef.current || !authorized) return;
    const operation = { path, body: { ...body, requestKey: crypto.randomUUID() } };
    pendingRef.current = operation; setPending(operation); setMessage(null); mutation.mutate(operation);
  }
  useEffect(() => {
    if (!initialLink || pending) return;
    setProject(initialLink.projectId); setSelected(initialLink.id); setPin(null); setBefore(undefined);
  }, [initialLink, pending, scope]);
  useEffect(() => {
    setSelected(''); setPin(null); setBefore(undefined); setPages(['']); setReport(''); setActivity('');
    setDescription(''); setCategory('GENERAL'); setAffects(false); setStopped(false); setDelay(false);
    setOwner(''); setRecipient(''); setReason(''); setNote(''); setAsset(''); setMessage(null);
    if (initialLink?.projectId === projectId) setSelected(initialLink.id);
  }, [projectId, scope, initialLink]);
  useEffect(() => { if (pin === null && current) setPin(current.version); }, [current, pin]);
  if (!view && !configure) return null;
  const frozen = pending !== null || mutation.isPending;
  const stale = Boolean(current && pin !== current.version);
  const ownerAction = Boolean(current && current.ownerUserId === user.id);
  const verification = Boolean(current && current.reporterUserId === user.id && current.status === 'AWAITING_VERIFICATION' && can('verify'));
  const followUp = Boolean(ownerAction && current?.status === 'OPEN' && can('follow_up'));
  const close = Boolean(ownerAction && current?.status === 'VERIFIED' && can('close'));
  const actionReady = !frozen && !stale && Boolean(note.trim()) && Boolean(current);
  const label = (id: string) => current?.people.find(p => p.id === id)?.displayName ?? '';
  function act(action: string, extra = {}) {
    if (!actionReady || !current) return;
    send('/' + current.id + '/' + action, { expectedVersion: pin, note: note.trim(), ...extra });
  }
  return <Box component="section" data-testid="site-issues">
    <Stack spacing={2}>
      <Typography variant="h5">{t.title}</Typography>
      {message ? <Alert severity={message === 'saved' ? 'success' : 'warning'}>{t[message]}
        {pending && !mutation.isPending ? <Button onClick={() => {
          if (pendingRef.current) mutation.mutate(pendingRef.current);
        }}>{t.retry}</Button> : null}
      </Alert> : null}
      <TextField select label={t.project} value={projectId} disabled={frozen} onChange={e => setProject(e.target.value)}>
        <MenuItem value="">{t.select}</MenuItem>
        {projects.isSuccess ? projects.data.data.map(p => <MenuItem key={p.id} value={p.id}>{p.projectCode} · {p.projectName}</MenuItem>) : null}
      </TextField>
      {projects.isError ? <Alert severity="error">{t.unavailable}</Alert> : null}
      {authorized ? <>
        {routing.isError ? <Alert severity="error">{t.unavailable}</Alert> : null}
        {routing.isSuccess && !routing.data.data ? <Alert severity="warning">{t.routingMissing}</Alert> : null}
        {routing.isSuccess && routing.data.data ? <Typography>
          {t.owner}: {routing.data.data.owner.displayName} · {t.recipient}: {routing.data.data.escalation.displayName}
        </Typography> : null}
        {configure ? <Card variant="outlined"><CardContent><Stack spacing={1}>
          <Typography variant="h6">{t.routing}</Typography>
          {candidates.isError ? <Alert severity="error">{t.unavailable}</Alert> : null}
          <TextField select label={t.owner} value={owner} disabled={frozen} onChange={e => setOwner(e.target.value)}>
            <MenuItem value="">{t.select}</MenuItem>{candidates.isSuccess ? candidates.data.data.owners.map(p =>
              <MenuItem key={p.id} value={p.id}>{p.displayName}</MenuItem>) : null}
          </TextField>
          <TextField select label={t.recipient} value={recipient} disabled={frozen} onChange={e => setRecipient(e.target.value)}>
            <MenuItem value="">{t.select}</MenuItem>{candidates.isSuccess ? candidates.data.data.recipients.map(p =>
              <MenuItem key={p.id} value={p.id}>{p.displayName}</MenuItem>) : null}
          </TextField>
          <TextField label={t.routeReason} value={reason} disabled={frozen} onChange={e => setReason(e.target.value)}/>
          <Button disabled={frozen || !routing.isSuccess || routing.isFetching || !candidates.isSuccess || !owner || !recipient || owner === recipient || !reason.trim()}
            onClick={() => send('/projects/' + projectId + '/routing', { expectedVersion: routing.data?.data?.version ?? 0,
              ownerUserId: owner, escalationUserId: recipient, reason: reason.trim() })}>{t.saveRouting}</Button>
        </Stack></CardContent></Card> : null}
        {view && can('report') ? <Card variant="outlined"><CardContent><Stack spacing={1}>
          {options.isError ? <Alert severity="error">{t.unavailable}</Alert> : null}
          <TextField label={t.description} value={description} multiline minRows={2} disabled={frozen} onChange={e => setDescription(e.target.value)}/>
          <TextField select label={t.category} value={category} disabled={frozen} onChange={e => setCategory(e.target.value as IssueCategory)}>
            {(['GENERAL', 'SAFETY', 'QUALITY', 'ASSET_LOSS_DAMAGE'] as const).map(c => <MenuItem key={c} value={c}>{text('category_' + c)}</MenuItem>)}
          </TextField>
          <TextField select label={t.report} value={reportId} disabled={frozen} onChange={e => setReport(e.target.value)}>
            <MenuItem value="">{t.select}</MenuItem>{options.isSuccess ? options.data.data.reports.map(r =>
              <MenuItem key={r.id} value={r.id}>{r.reportDate.slice(0, 10)} · {r.status}</MenuItem>) : null}
          </TextField>
          <TextField select label={t.activity} value={activityId} disabled={frozen} onChange={e => setActivity(e.target.value)}>
            <MenuItem value="">{t.select}</MenuItem>{options.isSuccess ? options.data.data.activities.map(a =>
              <MenuItem key={a.id} value={a.id}>{a.activityCode} · {a.activityName}</MenuItem>) : null}
          </TextField>
          <FormControlLabel label={t.affects} control={<Checkbox checked={affects} disabled={frozen} onChange={e => setAffects(e.target.checked)}/>}/>
          <FormControlLabel label={t.stopped} control={<Checkbox checked={stopped} disabled={frozen} onChange={e => setStopped(e.target.checked)}/>}/>
          <FormControlLabel label={t.delay} control={<Checkbox checked={delay} disabled={frozen} onChange={e => setDelay(e.target.checked)}/>}/>
          <Alert severity="info">{t.phone}</Alert>
          <Button variant="contained" disabled={frozen || !description.trim() || !options.isSuccess || !routing.isSuccess || !routing.data.data}
            onClick={() => send('', { projectId, reportId: reportId || null, activityId: activityId || null, description: description.trim(),
              category, affectsCostOrDelivery: affects, workStopped: stopped, deliveryDelayRisk: delay })}>{t.reportIssue}</Button>
        </Stack></CardContent></Card> : null}
        {view ? <>
          <Button disabled={frozen} onClick={() => { void list.refetch(); void detail.refetch(); }}>{t.refresh}</Button>
          {list.isError ? <Alert severity="error">{t.unavailable}</Alert> : null}
          {list.isSuccess && !list.isFetching ? <Stack spacing={1}>
            {list.data.data.items.map(i => <Button key={i.id} disabled={frozen} onClick={() => {
              setSelected(i.id); setPin(i.version); setBefore(undefined); setNote(''); setAsset('');
            }}>{t.open}: {i.description} · {text(i.status)}</Button>)}
            {!list.data.data.items.length ? <Typography>{t.empty}</Typography> : null}
            <Stack direction="row">
              <Button disabled={frozen || pages.length === 1} onClick={() => setPages(p => p.slice(0, -1))}>{t.previous}</Button>
              <Button disabled={frozen || !list.data.data.nextCursor} onClick={() => setPages(p => [...p, list.data.data.nextCursor!])}>{t.next}</Button>
            </Stack>
          </Stack> : null}
          {detail.isError ? <Alert severity="error">{t.unavailable}</Alert> : null}
          {!selected ? <Typography>{t.choose}</Typography> : null}
          {current ? <Card variant="outlined"><CardContent><Stack spacing={1}>
            <Typography variant="h6">{current.description}</Typography>
            <Chip label={text(current.status)}/>
            <Typography>{t.category}: {text('category_' + current.category)}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {current.affectsCostOrDelivery ? <Chip label={t.affects}/> : null}
              {current.workStopped ? <Chip label={t.stopped} color="warning"/> : null}
              {current.deliveryDelayRisk ? <Chip label={t.delay} color="warning"/> : null}
            </Stack>
            {current.assetSeverity ? <Typography>{t.assetAssessment}: {text(current.assetSeverity)}</Typography> : null}
            <Typography>{t.reporter}: {label(current.reporterUserId)} · {t.owner}: {label(current.ownerUserId)}</Typography>
            <Typography>{t.recipient}: {label(current.escalationUserId)}</Typography>
            {current.escalatedAt ? <Alert severity="warning">{t.escalated} · {new Date(current.escalatedAt).toLocaleString()}</Alert> : null}
            {stale ? <Alert severity="warning">{t.stale}</Alert> : null}
            <Button disabled={frozen} onClick={() => { setPin(current.version); setNote(''); setAsset(''); setBefore(undefined); void detail.refetch(); }}>{t.refresh}</Button>
            {followUp || verification || close ? <>
              <TextField label={t.note} value={note} disabled={frozen || stale} onChange={e => setNote(e.target.value)}/>
              {followUp && current.category === 'ASSET_LOSS_DAMAGE' ? <TextField select label={t.assetAssessment} value={assetSeverity}
                disabled={frozen || stale} onChange={e => setAsset(e.target.value)}>
                <MenuItem value="">{t.select}</MenuItem><MenuItem value="SEVERE">{t.SEVERE}</MenuItem><MenuItem value="NOT_SEVERE">{t.NOT_SEVERE}</MenuItem>
              </TextField> : null}
              {followUp ? <Button disabled={!actionReady || current.category === 'ASSET_LOSS_DAMAGE' && !assetSeverity}
                onClick={() => act('follow-up', current.category === 'ASSET_LOSS_DAMAGE' ? { assetSeverity } : {})}>{t.followUp}</Button> : null}
              {verification ? <Stack direction="row">
                <Button disabled={!actionReady} onClick={() => act('verify', { resolved: true })}>{t.verifyResolved}</Button>
                <Button disabled={!actionReady} onClick={() => act('verify', { resolved: false })}>{t.verifyUnresolved}</Button>
              </Stack> : null}
              {close ? <Button disabled={!actionReady} onClick={() => act('close')}>{t.close}</Button> : null}
            </> : null}
            <Typography variant="h6">{t.history}</Typography>
            {current.events.map(e => <Typography key={e.id}>#{e.version} · {text(e.action)} · {text(e.status)} · {e.actor.displayName} · {new Date(e.recordedAt).toLocaleString()} · {e.note}</Typography>)}
            <Stack direction="row">
              <Button disabled={frozen || beforeVersion === undefined} onClick={() => setBefore(undefined)}>{t.latest}</Button>
              <Button disabled={frozen || current.nextBeforeVersion === null} onClick={() => setBefore(current.nextBeforeVersion ?? undefined)}>{t.older}</Button>
            </Stack>
          </Stack></CardContent></Card> : null}
        </> : null}
      </> : null}
    </Stack>
  </Box>;
}
