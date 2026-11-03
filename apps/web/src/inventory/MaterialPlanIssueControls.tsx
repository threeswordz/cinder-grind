import { useContext, useState } from 'react';
import { Alert, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
type Action =
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
  const current = detail.data?.data;
  const approved = current?.approvedRevision;
  const matching = current && current.projectId === issue.projectId &&
    current.warehouseId === issue.warehouseId &&
    approved && issue.issueDate >= approved.validFrom && issue.issueDate <= approved.validTo
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
  issue, permissions, history, onChanged,
}: {
  issue: MaterialIssue;
  permissions: string[];
  history: PlanIssueHistory;
  onChanged: () => Promise<void>;
}) {
  const t = materialPlanIssueLabels[useContext(MonetaryLocaleContext)];
  const client = useQueryClient();
  const can = (key: string) => permissions.includes(key);
  const canPost = can('inventory.material_plan.issue.post');
  const canReview = can('inventory.material_plan.overage.review');
  const canApprove = can('inventory.material_plan.overage.approve');
  const [pins, setPins] = useState<Record<string, Pin>>({});
  const [pages, setPages] = useState<string[]>(['']);
  const [preview, setPreview] = useState<{ fingerprint: string; value: PlanIssuePreview } | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);
  const plans = useQuery({
    queryKey: ['material-plan-issues', 'plans', issue.projectId, pages.at(-1)],
    queryFn: () => materialPlansApi.list(issue.projectId, pages.at(-1) ?? ''),
    enabled: canPost && !issue.postedAt && !issue.reversedAt,
    ...noCache,
  });
  const issueLines = issue.items ?? [];
  const bindings: PlanIssueBinding[] = issueLines.flatMap(l =>
    pins[l.id]?.planLineId && pins[l.id]!.expectedPlanVersion > 0 ?
      [{ issueItemId: l.id, planLineId: pins[l.id]!.planLineId, expectedPlanVersion: pins[l.id]!.expectedPlanVersion }] : []);
  const fingerprint = JSON.stringify({
    issueId: issue.id, issueDate: issue.issueDate, warehouseId: issue.warehouseId,
    items: issueLines.map(l => [l.id, l.quantity, l.materialId, l.uomId]),
    bindings: [...bindings].sort((a, b) => a.issueItemId.localeCompare(b.issueItemId)),
  });
  const complete = issueLines.length > 0 && bindings.length === issueLines.length &&
    new Set(bindings.map(x => x.issueItemId)).size === issueLines.length;
  const applicablePreview = preview?.fingerprint === fingerprint ? preview.value : null;
  const previewMutation = useMutation({
    mutationFn: (value: PlanIssueBinding[]) => api.preview(issue.id, value),
    onSuccess: result => { setPreview({ fingerprint, value: result.data }); setSaved(false); },
  });
  const actionMutation = useMutation({
    mutationFn: (intent: Action) => {
      switch (intent.kind) {
        case 'DIRECT': return api.withinPlan(intent.issueId, intent.requestKey, intent.bindings);
        case 'SUBMIT': return api.submitOverage(intent.issueId, intent.requestKey, intent.bindings);
        case 'REVIEW': return api.decide(intent.authorizationId, 'review', intent.requestKey, intent.decision, intent.comment);
        case 'DECIDE': return api.decide(intent.authorizationId, 'decision', intent.requestKey, intent.decision, intent.comment);
      }
    },
    onSuccess: async () => {
      setPending(null); setPreview(null); setSaved(true);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['material-plan-issues'] }),
        client.invalidateQueries({ queryKey: ['material-plan-ui'] }),
        onChanged(),
      ]);
    },
  });
  const send = (action: Action) => {
    if (pending || actionMutation.isPending) return;
    setSaved(false); setPending(action); actionMutation.mutate(action);
  };
  const review = history.items[0];
  const submittedApproval = review?.mode === 'OVERAGE' &&
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
        <Button disabled={actionMutation.isPending} onClick={() => actionMutation.mutate(pending)}>{t.retry}</Button>
        <Button disabled={actionMutation.isPending} onClick={() => {
          setPending(null); setPreview(null); actionMutation.reset(); void onChanged();
        }}>{t.clear}</Button>
      </Stack>
    </Alert> : null}
    {previewMutation.isError || actionMutation.isError ?
      <Alert severity="error">{t.error}</Alert> : null}
    {saved ? <Alert severity="success">{t.saved}</Alert> : null}
    {canPost && !issue.postedAt && !issue.reversedAt ? <Stack spacing={1}>
      {plans.isError ? <Alert severity="error">{t.denied}</Alert> : null}
      {issueLines.map(l => <IssuePlanLine key={l.id} line={l} issue={issue}
        planChoices={plans.data?.data.items ?? []} pin={pins[l.id]}
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
        <Button disabled={!plans.data?.data.nextCursor}
          onClick={() => plans.data?.data.nextCursor && setPages(old => [...old, plans.data!.data.nextCursor!])}>{t.choosePlan} →</Button>
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
    {!history.items.length ? <Typography variant="body2">{t.none}</Typography> : null}
    {history.items.map(h => <Stack key={h.id} spacing={0.5}>
      <Typography variant="body2">#{h.sequence} · {t.mode}: {h.mode} · {t.stage}: {h.approval?.approvalState ?? 'DIRECT'}</Typography>
      {h.lines.map(l => <Typography key={l.issueItemId} variant="caption">
        {l.issueItemId.slice(0, 8)} · {l.quantity} · {t.overageQuantity}: {l.overageQuantity}
      </Typography>)}
    </Stack>)}
    <Alert severity="info">{t.signed}</Alert>
  </Stack>;
}
