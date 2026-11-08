import { useContext, useState } from 'react';
import { Alert, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { type MaterialIssue } from '../api/inventory';
import { materialPlansApi, type PlanSummary } from '../api/material-plans';
import {
  materialPlanIssuesApi as api,
  type PlanIssueBinding, type PlanIssueHistory, type PlanIssuePreview,
} from '../api/material-plan-issues';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';
import { materialPlanIssueLabels } from './material-plan-issue-labels';

type Line = NonNullable<MaterialIssue['items']>[number];
type Pin = { planId: string; planLineId: string; expectedPlanVersion: number };
export type PlanIssueIntent =
  | { kind: 'DIRECT' | 'SUBMIT'; issueId: string; requestKey: string; bindings: PlanIssueBinding[] }
  | { kind: 'REVIEW' | 'DECIDE'; authorizationId: string; requestKey: string; decision: 'APPROVE' | 'REJECT'; comment: string };
const noCache = { retry: false, gcTime: 0, refetchOnWindowFocus: true } as const;

function IssuePlanLine({
  line, issue, planChoices, pin, onChange, disabled,
}: {
  line: Line;
  issue: MaterialIssue;
  planChoices: PlanSummary[];
  pin: Pin | undefined;
  onChange: (next: Pin | undefined) => void;
  disabled: boolean;
}) {
  const t = materialPlanIssueLabels[useContext(MonetaryLocaleContext)];
  const detail = useQuery({
    queryKey: ['material-plan-issues', 'plan', pin?.planId],
    queryFn: () => materialPlansApi.get(pin!.planId),
    enabled: Boolean(pin?.planId),
    ...noCache,
  });
  const current = detail.isSuccess && !detail.isFetching ? detail.data.data : null;
  const approved = current?.approvedRevision;
  const matching = current && current.projectId === issue.projectId &&
    current.warehouseId === issue.warehouseId &&
    approved && issue.issueDate.slice(0, 10) >= approved.validFrom && issue.issueDate.slice(0, 10) <= approved.validTo
    ? approved.lines.filter(l => l.materialId === line.materialId && l.uomId === line.uomId)
    : [];
  const approvedPlan = Boolean(approved && current && matching.length);
  return <Paper variant="outlined" sx={{ p: 1.5 }}>
    <Stack spacing={1}>
      <Typography variant="body2">{t.source} #{line.lineNo}: {line.material?.materialCode ?? line.materialId}
        {' · '}{line.quantity} {line.uom?.uomCode ?? ''}</Typography>
      <TextField size="small" select fullWidth label={t.choosePlan}
        value={pin?.planId ?? ''} disabled={disabled}
        onChange={e => onChange(e.target.value ? { planId: e.target.value, planLineId: '', expectedPlanVersion: 0 } : undefined)}>
        <MenuItem value="">{t.select}</MenuItem>
        {pin?.planId && !planChoices.some(p => p.id === pin.planId) ?
          <MenuItem value={pin.planId}>{pin.planId}</MenuItem> : null}
        {planChoices.filter(p => p.warehouseId === issue.warehouseId).map(p =>
          <MenuItem key={p.id} value={p.id}>{p.workPackageCode} · v{p.version}</MenuItem>)}
      </TextField>
      {detail.isError ? <Alert severity="error">{t.denied}</Alert> : null}
      {pin?.planId ? <TextField select size="small" fullWidth label={t.chooseLine}
        value={pin.planLineId} disabled={disabled || !approvedPlan || detail.isError}
        onChange={e => onChange(e.target.value && current ?
          { planId: pin.planId, planLineId: e.target.value, expectedPlanVersion: current.version } :
          { planId: pin.planId, planLineId: '', expectedPlanVersion: 0 })}>
        <MenuItem value="">{t.select}</MenuItem>
        {matching.map(l => <MenuItem key={l.id} value={l.id}>
          {l.material.materialCode} · {l.quantity} {l.uom.uomCode}
        </MenuItem>)}
      </TextField> : null}
      {pin?.planLineId && current?.version !== pin.expectedPlanVersion ?
        <Alert severity="warning">{t.previewStale}</Alert> : null}
    </Stack>
  </Paper>;
}

export function MaterialPlanIssueControls({
  issue, permissions, history, onChanged, pending, onPendingChange,
}: {
  issue: MaterialIssue;
  permissions: string[];
  history: PlanIssueHistory;
  onChanged: () => Promise<void>;
  pending: PlanIssueIntent | null;
  onPendingChange: (intent: PlanIssueIntent | null, expectedRequestKey?: string) => void;
}) {
  const t = materialPlanIssueLabels[useContext(MonetaryLocaleContext)];
  const client = useQueryClient();
  const can = (key: string) => permissions.includes(key);
  const canPost = can('inventory.material_plan.issue.post');
  const canReview = can('inventory.material_plan.overage.review');
  const canApprove = can('inventory.material_plan.overage.approve');
  const [pins, setPins] = useState<Record<string, Pin>>({});
  const [pages, setPages] = useState<string[]>(['']);
  const [historyPages, setHistoryPages] = useState<string[]>(['']);
  const [preview, setPreview] = useState<{ fingerprint: string; value: PlanIssuePreview } | null>(null);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);
  const plans = useQuery({
    queryKey: ['material-plan-issues', 'plans', issue.projectId, pages.at(-1)],
    queryFn: () => materialPlansApi.list(issue.projectId, pages.at(-1) ?? ''),
    enabled: canPost && !issue.postedAt && !issue.reversedAt,
    ...noCache,
  });
  const historyPage = useQuery({
    queryKey: ['material-plan-issues', 'history', issue.id, historyPages.at(-1)],
    queryFn: () => api.history(issue.id, historyPages.at(-1) ?? ''),
    enabled: history.binding !== null, ...noCache,
  });
  const visibleHistory = historyPage.isSuccess && !historyPage.isFetching ? historyPage.data.data : null;
  const issueLines = issue.items ?? [];
  const planIds = [...new Set(Object.values(pins).map(pin => pin.planId))].sort();
  // Verify all selected sources on the current session before even enabling
  // preview/post. Old cached plan data is never a posting authority.
  const planChecks = useQueries({ queries: planIds.map(id => ({
    queryKey: ['material-plan-issues', 'plan', id],
    queryFn: () => materialPlansApi.get(id),
    enabled: canPost, ...noCache,
  })) });
  const verifiedPlans = new Map(planIds.flatMap((id, index) => {
    const check = planChecks[index];
    return check?.isSuccess && !check.isFetching ? [[id, check.data.data] as const] : [];
  }));
  const availablePlans = plans.isSuccess && !plans.isFetching ? plans.data.data : null;
  const bindings: PlanIssueBinding[] = issueLines.flatMap(l =>
    pins[l.id]?.planLineId && pins[l.id]!.expectedPlanVersion > 0 ?
      [{ issueItemId: l.id, planLineId: pins[l.id]!.planLineId, expectedPlanVersion: pins[l.id]!.expectedPlanVersion }] : []);
  const fingerprint = JSON.stringify({
    issueId: issue.id, issueDate: issue.issueDate, warehouseId: issue.warehouseId,
    items: issueLines.map(l => [l.id, l.quantity, l.materialId, l.uomId]),
    bindings: [...bindings].sort((a, b) => a.issueItemId.localeCompare(b.issueItemId)),
  });
  const complete = Boolean(availablePlans) && issueLines.length > 0 && bindings.length === issueLines.length &&
    new Set(bindings.map(x => x.issueItemId)).size === issueLines.length &&
    issueLines.every(item => {
      const pin = pins[item.id];
      if (!pin) return false;
      const plan = verifiedPlans.get(pin.planId);
      const effective = plan?.approvedRevision;
      return Boolean(plan && effective && plan.projectId === issue.projectId &&
        plan.warehouseId === issue.warehouseId && plan.version === pin.expectedPlanVersion &&
        issue.issueDate.slice(0, 10) >= effective.validFrom && issue.issueDate.slice(0, 10) <= effective.validTo &&
        effective.lines.some(line => line.id === pin.planLineId &&
          line.materialId === item.materialId && line.uomId === item.uomId));
    });
  const applicablePreview = complete && preview?.fingerprint === fingerprint ? preview.value : null;
  const previewMutation = useMutation({
    mutationFn: (value: PlanIssueBinding[]) => api.preview(issue.id, value),
    onSuccess: result => { setPreview({ fingerprint, value: result.data }); setSaved(false); },
  });
  const actionMutation = useMutation({
    mutationFn: (intent: PlanIssueIntent) => {
      switch (intent.kind) {
        case 'DIRECT': return api.withinPlan(intent.issueId, intent.requestKey, intent.bindings);
        case 'SUBMIT': return api.submitOverage(intent.issueId, intent.requestKey, intent.bindings);
        case 'REVIEW': return api.decide(intent.authorizationId, 'review', intent.requestKey, intent.decision, intent.comment);
        case 'DECIDE': return api.decide(intent.authorizationId, 'decision', intent.requestKey, intent.decision, intent.comment);
      }
    },
    onSuccess: async (_result, intent) => {
      onPendingChange(null, intent.requestKey); setPreview(null); setSaved(true);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['material-plan-issues'] }),
        client.invalidateQueries({ queryKey: ['material-plan-ui'] }),
        onChanged(),
      ]);
    },
  });
  const send = (action: PlanIssueIntent) => {
    if (pending || actionMutation.isPending) return;
    setSaved(false); onPendingChange(action); actionMutation.mutate(action);
  };
  // A lost-response intent must survive unmounting during access revalidation.
  // Parent state retains the exact request key/body; backend guards the replay.
  const retryAuthorized = pending && (
    pending.kind === 'DIRECT' || pending.kind === 'SUBMIT' ? canPost :
      pending.kind === 'REVIEW' ? canReview : canApprove
  );
  // Approve only the latest freshly authorized source record, never a stale
  // parent-prop snapshot or an older history page after a concurrent change.
  const review = historyPages.length === 1 && visibleHistory?.binding?.issueId === issue.id
    ? visibleHistory.items[0] : undefined;
  const submittedApproval = visibleHistory && review?.mode === 'OVERAGE' &&
    review.approval?.approvalState === 'SUBMITTED' ? review : null;
  const approvals = submittedApproval?.approval?.actions.filter(a => a.action === 'APPROVE').length ?? 0;
  const stage: 'REVIEW' | 'DECIDE' = approvals === 0 ? 'REVIEW' : 'DECIDE';
  const canDecide = stage === 'REVIEW' ? canReview : canApprove;

  return <Stack spacing={2}>
    <Typography variant="subtitle1">{t.title}</Typography>
    <Alert severity="info">{t.subtitle}</Alert>
    <Chip color="info" label={t.policy} sx={{ alignSelf: 'flex-start' }} />
    {pending ? <Alert severity="warning">{t.pending}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button disabled={!retryAuthorized || actionMutation.isPending} onClick={() => actionMutation.mutate(pending)}>{t.retry}</Button>
        <Button disabled={actionMutation.isPending} onClick={() => {
          onPendingChange(null, pending.requestKey); setPreview(null); actionMutation.reset(); void onChanged();
        }}>{t.clear}</Button>
      </Stack>
    </Alert> : null}
    {previewMutation.isError || actionMutation.isError ?
      <Alert severity="error">{t.error}</Alert> : null}
    {saved ? <Alert severity="success">{t.saved}</Alert> : null}
    {canPost && !issue.postedAt && !issue.reversedAt ? <Stack spacing={1}>
      {plans.isError ? <Alert severity="error">{t.denied}</Alert> : null}
      {issueLines.map(l => <IssuePlanLine key={l.id} line={l} issue={issue}
        planChoices={availablePlans?.items ?? []} pin={pins[l.id]}
        disabled={Boolean(pending) || actionMutation.isPending}
        onChange={value => {
          setPins(old => {
            const copy = { ...old }; if (value) copy[l.id] = value; else delete copy[l.id];
            return copy;
          });
          setPreview(null);
        }} />)}
      <Stack direction="row" spacing={1}>
        <Button disabled={pages.length < 2} onClick={() => setPages(old => old.slice(0, -1))}>{t.refresh}</Button>
        <Button disabled={!availablePlans?.nextCursor}
          onClick={() => availablePlans?.nextCursor && setPages(old => [...old, availablePlans.nextCursor!])}>{t.choosePlan} →</Button>
        <Button onClick={() => { setPreview(null); void client.invalidateQueries({ queryKey: ['material-plan-issues'] }); }}>{t.refresh}</Button>
      </Stack>
      {!complete ? <Alert severity="info">{t.incomplete}</Alert> : null}
      <Button variant="outlined"
        disabled={!complete || Boolean(pending) || previewMutation.isPending || plans.isError}
        onClick={() => { setPreview(null); previewMutation.mutate(bindings); }}>{t.preview}</Button>
      {applicablePreview ? <Stack spacing={1}>
        <Alert severity={applicablePreview.result === 'WITHIN_PLAN' ? 'success' : 'warning'}>
          {applicablePreview.result === 'WITHIN_PLAN' ? t.matched : t.overage}
          {' · '}{t.overageQuantity}: {applicablePreview.overageQuantity}
        </Alert>
        {applicablePreview.items.map(item => <Typography variant="caption" key={item.issueItemId}>
          {item.issueItemId.slice(0, 8)}: {t.allowance} {item.allowance}, {t.used} {item.used},
          {' '}{t.remaining} {item.remaining}
        </Typography>)}
        {applicablePreview.result === 'WITHIN_PLAN' ?
          <Button variant="contained" disabled={Boolean(pending)}
            onClick={() => send({ kind: 'DIRECT', issueId: issue.id,
              requestKey: crypto.randomUUID(), bindings })}>{t.post}</Button> :
          <Button variant="contained" disabled={Boolean(pending)}
            onClick={() => send({ kind: 'SUBMIT', issueId: issue.id,
              requestKey: crypto.randomUUID(), bindings })}>{t.submit}</Button>}
      </Stack> : preview ? <Alert severity="warning">{t.previewStale}</Alert> : null}
    </Stack> : null}
    {submittedApproval && canDecide ? <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">{stage === 'REVIEW' ? t.review : t.final}</Typography>
        <TextField fullWidth label={t.decision} multiline minRows={2}
          value={comment} disabled={Boolean(pending)} onChange={e => setComment(e.target.value)} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" disabled={!comment.trim() || Boolean(pending)}
            onClick={() => send({ kind: stage, authorizationId: submittedApproval.id,
              requestKey: crypto.randomUUID(), decision: 'APPROVE', comment: comment.trim() })}>{t.approve}</Button>
          <Button disabled={!comment.trim() || Boolean(pending)}
            onClick={() => send({ kind: stage, authorizationId: submittedApproval.id,
              requestKey: crypto.randomUUID(), decision: 'REJECT', comment: comment.trim() })}>{t.reject}</Button>
        </Stack>
      </Stack>
    </Paper> : null}
    <Typography variant="subtitle2">{t.history}</Typography>
    {historyPage.isError ? <Alert severity="error">{t.denied}</Alert> : null}
    {visibleHistory && !visibleHistory.items.length ? <Typography variant="body2">{t.none}</Typography> : null}
    {(visibleHistory?.items ?? []).map(h => <Stack key={h.id} spacing={0.5}>
      <Typography variant="body2">#{h.sequence} · {t.mode}: {h.mode} · {t.stage}: {h.approval?.approvalState ?? 'DIRECT'}</Typography>
      {h.lines.map(l => <Typography key={l.issueItemId} variant="caption">
        {l.issueItemId.slice(0, 8)} · {l.quantity} · {t.overageQuantity}: {l.overageQuantity}
      </Typography>)}
    </Stack>)}
    <Stack direction="row" spacing={1}>
      <Button disabled={historyPages.length < 2} onClick={() => setHistoryPages(old => old.slice(0, -1))}>{t.previous}</Button>
      <Button disabled={!visibleHistory?.nextCursor} onClick={() => visibleHistory?.nextCursor &&
        setHistoryPages(old => [...old, visibleHistory.nextCursor!])}>{t.next}</Button>
    </Stack>
    <Alert severity="info">{t.signed}</Alert>
  </Stack>;
}
