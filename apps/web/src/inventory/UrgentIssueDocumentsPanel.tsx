import {
  Alert, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { documentsApi } from '../api/documents';
import { inventoryApi } from '../api/inventory';
import { operationalExceptionsApi } from '../api/operational-exceptions';

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Urgent-issue document operation failed.';
}
export function UrgentIssueDocumentsPanel({
  permissions, roleCodes, userId,
}: { permissions: string[]; roleCodes: string[]; userId: string }) {
  const client = useQueryClient();
  const view = permissions.includes('inventory.issue.view') &&
    permissions.includes('documents.document.view') &&
    roleCodes.some(role => role === 'STOREKEEPER' || role === 'PROJECT_MANAGER');
  const maker = view && permissions.includes('inventory.issue.create') &&
    roleCodes.includes('STOREKEEPER');
  const reviewer = view && permissions.includes('inventory.issue.approve') &&
    roleCodes.includes('PROJECT_MANAGER');
  const [projectId, setProjectId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [reason, setReason] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [decision, setDecision] = useState<'CLOSE' | 'RETURN'>('CLOSE');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState('');
  const projects = useQuery({
    queryKey: ['m4-urgent-projects'],
    queryFn: inventoryApi.issueProjects,
    enabled: view, retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const scoped = projects.isSuccess && !projects.isFetching &&
    projects.data.data.some(p => p.id === projectId);
  const issues = useQuery({
    queryKey: ['m4-urgent-issues', projectId],
    queryFn: () => inventoryApi.materialIssues(projectId),
    enabled: view && scoped, retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const selectedIssue = issues.isSuccess && !issues.isFetching ?
    issues.data.data.find(i => i.id === issueId && i.projectId === projectId &&
      Boolean(i.postedAt) && !i.reversedAt) : null;
  const current = useQuery({
    queryKey: ['m4-urgent-record', projectId, issueId],
    queryFn: () => operationalExceptionsApi.urgentRead(issueId),
    enabled: Boolean(view && scoped && selectedIssue),
    retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const record = current.isSuccess && !current.isFetching &&
    current.data.data.projectId === projectId ? current.data.data.record : null;
  const hasFreshRecord = current.isSuccess && !current.isFetching &&
    current.data.data.projectId === projectId;
  const documents = useQuery({
    queryKey: ['m4-urgent-docs', projectId, issueId],
    queryFn: () => documentsApi.targetDocuments(projectId, 'MATERIAL_ISSUE', issueId),
    enabled: Boolean(scoped && selectedIssue && view),
    retry: false, gcTime: 0, refetchOnWindowFocus: true,
  });
  const types = useQuery({
    queryKey: ['m4-urgent-doc-types'],
    queryFn: documentsApi.typeOptions,
    enabled: maker, retry: false, gcTime: 0,
  });
  const allDocuments = documents.isSuccess && !documents.isFetching ? documents.data.data : [];
  const validSelection = selectedDocumentIds.length > 0 &&
    selectedDocumentIds.length <= 100 &&
    selectedDocumentIds.every(id => allDocuments.some(d => d.id === id && d.isActive));
  const originalMaker = Boolean(selectedIssue && selectedIssue.createdByUserId === userId);
  const canEdit = maker && originalMaker;
  const canReview = reviewer && Boolean(record && record.status === 'SUBMITTED' &&
    record.sourceCurrent && record.evidenceFingerprint && record.lastEventId &&
    record.createdByUserId !== userId);
  const refresh = async () => {
    setSelectedDocumentIds([]);
    await Promise.all([
      client.invalidateQueries({ queryKey: ['m4-urgent-record', projectId, issueId] }),
      client.invalidateQueries({ queryKey: ['m4-urgent-docs', projectId, issueId] }),
      client.invalidateQueries({ queryKey: ['m4-urgent-issues', projectId] }),
    ]);
  };
  const action = useMutation({
    mutationFn: async (execute: () => Promise<unknown>) => execute(),
    onSuccess: async () => { setFeedback('Saved. Reloading the canonical document state.'); await refresh(); },
    onError: (error: unknown) => setFeedback(errorText(error)),
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !documentTypeId) throw new Error('Select an evidence document and its type.');
      return documentsApi.uploadTargetDocument(
        projectId, 'MATERIAL_ISSUE', issueId, documentTypeId, uploadFile,
      );
    },
    onSuccess: async () => { setUploadFile(null); setFeedback('Document linked. Select it for submission.'); await refresh(); },
    onError: (error: unknown) => setFeedback(errorText(error)),
  });
  const doAction = (fn: () => Promise<unknown>) => { setFeedback(''); action.mutate(fn); };
  if (!view) return <Alert severity="info">This route requires a current Store Site or Project Manager document-view role.</Alert>;
  return (
    <Stack spacing={2}>
      <Typography variant="h6">PM09 — urgent material issue documents</Typography>
      <Alert severity="info">
        For an already posted material issue with incomplete documents only.
        The 48-hour deadline is measured from the original issue posting, including holidays.
        This tracker cannot post stock or authorize an unapproved material issue.
      </Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <TextField select label="Project" value={projectId} sx={{ minWidth: 230 }}
          onChange={e => { setProjectId(e.target.value); setIssueId(''); setSelectedDocumentIds([]); setFeedback(''); }}>
          <MenuItem value="">Choose Project</MenuItem>
          {(projects.isSuccess && !projects.isFetching ? projects.data.data : []).map(p =>
            <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</MenuItem>)}
        </TextField>
        <TextField select label="Posted material issue" value={issueId} sx={{ minWidth: 260 }}
          disabled={!scoped} onChange={e => { setIssueId(e.target.value); setSelectedDocumentIds([]); setFeedback(''); }}>
          <MenuItem value="">Choose a posted issue</MenuItem>
          {(issues.isSuccess && !issues.isFetching ? issues.data.data : [])
            .filter(i => i.projectId === projectId && Boolean(i.postedAt) && !i.reversedAt)
            .map(i => <MenuItem key={i.id} value={i.id}>{i.issueNumber}</MenuItem>)}
        </TextField>
        <Button variant="outlined" disabled={!selectedIssue || current.isFetching}
          onClick={() => { void current.refetch(); void documents.refetch(); }}>Refresh issue</Button>
      </Stack>
      {projects.error || issues.error || current.error || documents.error ?
        <Alert severity="error">{errorText(projects.error ?? issues.error ?? current.error ?? documents.error)}</Alert> : null}
      {hasFreshRecord && selectedIssue ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle1">Original issue: {selectedIssue.issueNumber}</Typography>
            <Typography variant="body2">Posted: {selectedIssue.postedAt ? new Date(selectedIssue.postedAt).toLocaleString() : '—'}</Typography>
            {record ? <>
              <Typography variant="body2">Document case: {record.status} · due {new Date(record.dueAt).toLocaleString()}</Typography>
              <Typography variant="body2">Reason: {record.reason}</Typography>
              <Typography variant="body2">Submission: {record.submittedAt ? new Date(record.submittedAt).toLocaleString() : 'Not yet submitted'}</Typography>
              <Typography variant="body2">Review: {record.reviewedAt ? record.reviewerNote ?? 'Reviewed' : 'Awaiting independent check'}</Typography>
              <Alert severity={record.sourceCurrent || !record.evidenceFingerprint ? 'info' : 'warning'}>
                {record.sourceCurrent || !record.evidenceFingerprint ? (
                  record.status === 'CLOSED' ? 'Closure recorded; on-time result: ' + (record.onTime ? 'yes' : 'no') :
                    record.overdue ? 'Deadline has elapsed; overdue evidence remains recorded honestly.' :
                      'Open tracker only; no stock or financial posting.'
                ) : 'Evidence checksum is stale. Refresh the source records before review.'}
              </Alert>
            </> : <Alert severity="info">No urgent-document case has been registered for this posted issue.</Alert>}
          </Stack>
        </Paper>
      ) : null}
      {canEdit && hasFreshRecord && selectedIssue && !record ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle1">Store — register missing evidence</Typography>
            <TextField multiline minRows={2} label="Why supporting documents were incomplete"
              value={reason} onChange={e => setReason(e.target.value)} inputProps={{ maxLength: 2000 }} />
            <Button variant="contained" disabled={!reason.trim() || action.isPending}
              onClick={() => doAction(() => operationalExceptionsApi.urgentRegister(issueId, reason.trim()))}>
              Register urgent-document follow-up
            </Button>
          </Stack>
        </Paper>
      ) : null}
      {canEdit && record && (record.status === 'OPEN' || record.status === 'RETURNED') ? (
        <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
          <Typography variant="subtitle1">Store — link actual issue documents and submit</Typography>
          <Alert severity="info">Only actual linked Project/Material Issue documents count. Text notes alone do not satisfy evidence.</Alert>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField select label="Document type" value={documentTypeId} sx={{ minWidth: 220 }}
              onChange={e => setDocumentTypeId(e.target.value)}>
              <MenuItem value="">Choose type</MenuItem>
              {(types.isSuccess ? types.data.data : []).map(t =>
                <MenuItem key={t.id} value={t.id}>{t.documentTypeName}</MenuItem>)}
            </TextField>
            <Button variant="outlined" component="label">
              {uploadFile ? uploadFile.name : 'Choose actual evidence file'}
              <input type="file" hidden onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            </Button>
            <Button disabled={!uploadFile || !documentTypeId || upload.isPending || action.isPending}
              onClick={() => {setFeedback('');upload.mutate();}}>Upload and link to issue</Button>
          </Stack>
          <Stack spacing={0.5}>
            {allDocuments.filter(d => d.isActive).map(doc =>
              <FormControlLabel key={doc.id} control={
                <Checkbox checked={selectedDocumentIds.includes(doc.id)}
                  onChange={(_e, checked) => setSelectedDocumentIds(old =>
                    checked ? [...old, doc.id] : old.filter(id => id !== doc.id))} />
              } label={doc.fileName + ' (' + doc.documentType.documentTypeName + ')'} />)}
          </Stack>
          {allDocuments.length === 0 ? <Alert severity="warning">No linked issue evidence is available; upload it before submission.</Alert> : null}
          <TextField label="Completion note" multiline minRows={2} value={completionNote}
            onChange={e => setCompletionNote(e.target.value)} inputProps={{ maxLength: 2000 }} />
          <Button variant="contained" disabled={!validSelection || !completionNote.trim() ||
            action.isPending || documents.isFetching || current.isFetching}
            onClick={() => doAction(() =>
              operationalExceptionsApi.urgentSubmit(issueId, selectedDocumentIds, completionNote.trim()))}>
            Submit selected documents for independent check
          </Button>
        </Stack></Paper>
      ) : null}
      {canReview && record && record.evidenceFingerprint ? (
        <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1}>
          <Typography variant="subtitle1">Khaimook — independent evidence decision</Typography>
          <Typography variant="body2">Evidence documents: {record.documentIds.length} (server-verified)</Typography>
          <TextField select label="Decision" value={decision}
            onChange={e => setDecision(e.target.value as 'CLOSE' | 'RETURN')}>
            <MenuItem value="CLOSE">Close document follow-up</MenuItem>
            <MenuItem value="RETURN">Return to Store for correction</MenuItem>
          </TextField>
          <TextField label="Reviewer note" value={reviewNote} multiline minRows={2}
            onChange={e => setReviewNote(e.target.value)} inputProps={{ maxLength: 2000 }} />
          <Button variant="contained" disabled={!reviewNote.trim() || action.isPending ||
            current.isFetching || documents.isFetching}
            onClick={() => doAction(() => operationalExceptionsApi.urgentDecide(
              issueId, decision, record.lastEventId, record.evidenceFingerprint!, reviewNote.trim(),
            ))}>Record independent decision</Button>
          <Alert severity="info">Reviewer cannot approve their own uploaded document evidence; the server checks uploader identity.</Alert>
        </Stack></Paper>
      ) : null}
      {feedback ? <Alert severity={action.isError || upload.isError ? 'error' : 'success'}>{feedback}</Alert> : null}
    </Stack>
  );
}
