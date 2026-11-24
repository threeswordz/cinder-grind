import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider,
  MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, ApiError } from '../api/client';
import { purchaseOrdersApi } from '../api/purchase-orders';

type Action = 'ACKNOWLEDGE' | 'CONFIRM_IN_TRANSIT' | 'REPORT_DELAY' |
  'REPORT_DISCREPANCY' | 'PM_REVIEW_DISCREPANCY' | 'JAI_RECORD_CLAIM' |
  'STORE_RECORD_RETURN_DISPATCH' | 'STORE_RECORD_REPLACEMENT_RECEIPT';
type Stage = 'ACKNOWLEDGED' | 'IN_TRANSIT' | 'DELAY_REPORTED' |
  'DISCREPANCY_REPORTED' | 'PM_REVIEWED' | 'CLAIM_RECORDED' |
  'RETURN_DISPATCH_RECORDED' | 'REPLACEMENT_RECEIPT_RECORDED';
type Case = {
  version: number; stage: Stage; pmDecision: string | null;
  discrepancyKind: string | null; storeReporterId: string | null;
  pmReviewerId: string | null; jaiClaimerId: string | null;
};
type State = {
  purchaseOrderId: string; projectId: string;
  approvedLatest: boolean; case: Case | null;
  expectedPreviousEventId: string | null;
  advisoryOnly: boolean; stockEffect: false; financeEffect: false;
};
type Props = { orderId: string; permissions: string[]; roleCodes: string[] };
type Data<T> = { data: T };
const url = (id: string) => '/procurement/purchase-orders/' + id + '/supplier-case';
const err = (value: unknown) =>
  value instanceof ApiError || value instanceof Error ? value.message : 'Unable to record supplier evidence.';

/**
 * PUR08/PUR14 supplementary evidence timeline, never actual supplier dispatch,
 * Goods Receipt, inventory posting, financial credit, or automatic notification.
 * The API independently rechecks live rights and canonical PO/GR/Document links.
 */
export function SupplierDeliveryCasePanel({ orderId, permissions, roleCodes }: Props) {
  const client = useQueryClient();
  const [action, setAction] = useState<Action>('ACKNOWLEDGE');
  const [documentId, setDocumentId] = useState('');
  const [ackId, setAckId] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('DAMAGED');
  const [decision, setDecision] = useState('REQUEST_REPLACEMENT');
  const [date, setDate] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const canJai = roleCodes.includes('PROCUREMENT_OFFICER') && permissions.includes('procurement.po.view');
  const canStore = roleCodes.includes('STOREKEEPER') && permissions.includes('inventory.receiving.view');
  const canPm = roleCodes.includes('PROJECT_MANAGER') && permissions.includes('inventory.receipt.view');
  const canDocument = permissions.includes('documents.document.view');
  const allowedReader = canJai || canStore || canPm;
  const current = useQuery({
    queryKey: ['supplier-delivery-case', orderId],
    queryFn: () => apiRequest<Data<State>>(url(orderId)),
    enabled: allowedReader && Boolean(orderId),
  });
  const external = useQuery({
    queryKey: ['po-dispatch-events', orderId],
    queryFn: () => purchaseOrdersApi.dispatchEvents(orderId),
    enabled: canJai && Boolean(orderId),
  });
  const caseData = current.data?.data;
  const stage = caseData?.case?.stage ?? null;
  const choices: Array<{value:Action;label:string}> = [];
  if (canJai) {
    if (!stage) choices.push({value:'ACKNOWLEDGE',label:'Link existing PUR07 supplier acknowledgment'});
    if (stage==='ACKNOWLEDGED'||stage==='DELAY_REPORTED')
      choices.push({value:'CONFIRM_IN_TRANSIT',label:'Record supplier in-transit evidence'});
    if (['ACKNOWLEDGED','IN_TRANSIT','DELAY_REPORTED'].includes(stage ?? ''))
      choices.push({value:'REPORT_DELAY',label:'Record supplier-delayed / revised expected date'});
    if (stage==='PM_REVIEWED'&&caseData?.case?.pmDecision!=='DOCUMENT_ONLY')
      choices.push({value:'JAI_RECORD_CLAIM',label:'Record supplier claim evidence'});
  }
  if (canStore) {
    if (['ACKNOWLEDGED','IN_TRANSIT','DELAY_REPORTED'].includes(stage ?? ''))
      choices.push({value:'REPORT_DISCREPANCY',label:'Report short/wrong/excess/damaged delivery'});
    if (stage==='CLAIM_RECORDED'&&caseData?.case?.pmDecision==='REQUEST_RETURN')
      choices.push({value:'STORE_RECORD_RETURN_DISPATCH',label:'Record actual outward supplier return evidence'});
    if (stage==='CLAIM_RECORDED'&&caseData?.case?.pmDecision==='REQUEST_REPLACEMENT')
      choices.push({value:'STORE_RECORD_REPLACEMENT_RECEIPT',label:'Link posted replacement GR evidence'});
  }
  if (canPm&&stage==='DISCREPANCY_REPORTED')
    choices.push({value:'PM_REVIEW_DISCREPANCY',label:'Khaimook: independently review discrepancy'});
  const selected = choices.some(x=>x.value===action) ? action : choices[0]?.value;
  const save = useMutation({
    mutationFn: (choice: Action) => apiRequest<Data<unknown>>(url(orderId)+'/events',{
      method:'POST', body:JSON.stringify({
        action:choice, expectedVersion:caseData?.case?.version??0,
        expectedPreviousEventId:caseData?.expectedPreviousEventId??null,
        evidenceDocumentId:documentId.trim(), note:note.trim(),
        ...(choice==='ACKNOWLEDGE'?{recordedPoAcknowledgmentEventId:ackId}:{}),
        ...(choice==='REPORT_DISCREPANCY'?{discrepancyKind:kind}:{}),
        ...(choice==='PM_REVIEW_DISCREPANCY'?{pmDecision:decision}:{}),
        ...(choice==='REPORT_DELAY'?{newSupplierExpectedDate:date}:{}),
        ...(choice==='STORE_RECORD_REPLACEMENT_RECEIPT'?{recordedGoodsReceiptId:receiptId.trim()}:{}),
      }),
    }),
    onSuccess:()=>{
      setNote('');setDocumentId('');setAckId('');setReceiptId('');setDate('');
      void client.invalidateQueries({queryKey:['supplier-delivery-case',orderId]});
    },
  });
  if (!allowedReader) return null;
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Supplier delivery and discrepancy evidence (PUR08/PUR14)</Typography>
          <Alert severity="info">
            This records reported external status and supporting documents only. It does not send a
            supplier message, approve a GR, deduct stock, create a credit note, or post Finance.
            The original PUR07 dispatch/acknowledgment and canonical posted GR remain authoritative.
          </Alert>
          {current.isPending?<CircularProgress size={22}/>:null}
          {current.isError?<Alert severity="error">{err(current.error)}</Alert>:null}
          {caseData ? (
            <Stack spacing={1}>
              <Typography variant="body2">
                Case stage: <strong>{caseData.case?.stage??'NOT_STARTED'}</strong>
                {' · Version '}{caseData.case?.version??0}
                {' · Latest approved source: '}{caseData.approvedLatest?'YES':'NO'}
              </Typography>
              {caseData.case?.discrepancyKind?<Typography variant="body2">
                Discrepancy: {caseData.case.discrepancyKind} · PM decision: {caseData.case.pmDecision??'awaiting review'}
              </Typography>:null}
            </Stack>
          ):null}
          <Divider />
          {!caseData?.approvedLatest ? (
            <Typography color="text.secondary" variant="body2">
              Only the latest independently approved, non-cancelled PO revision can receive new supplier events.
            </Typography>
          ) : !canDocument ? (
            <Alert severity="warning">
              A scoped Project Document and current documents.document.view permission are required.
              Ask the authorized document owner; do not grant yourself access.
            </Alert>
          ) : choices.length===0 ? (
            <Typography color="text.secondary" variant="body2">
              No further action is allowed for this stage and your current business role.
            </Typography>
          ) : (
            <Stack spacing={2}>
              <TextField label="Evidence action" select value={selected??''}
                onChange={e=>setAction(e.target.value as Action)}>
                {choices.map(c=><MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
              {selected==='ACKNOWLEDGE'?(
                <TextField select label="Existing PUR07 external acknowledgment" value={ackId}
                  onChange={e=>setAckId(e.target.value)} required>
                  {(external.data?.data??[]).filter(e=>e.kind==='ACKNOWLEDGMENT').map(e=>(
                    <MenuItem key={e.id} value={e.id}>{e.channel} · {e.recipient} · {new Date(e.recordedAt).toLocaleString()}</MenuItem>
                  ))}
                </TextField>
              ):null}
              {selected==='REPORT_DISCREPANCY'?(
                <TextField select label="Observed discrepancy" value={kind} onChange={e=>setKind(e.target.value)}>
                  {['SHORT','WRONG_ITEM','EXCESS','DAMAGED'].map(v=><MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
              ):null}
              {selected==='PM_REVIEW_DISCREPANCY'?(
                <TextField select label="Khaimook decision" value={decision} onChange={e=>setDecision(e.target.value)}>
                  {['REQUEST_RETURN','REQUEST_REPLACEMENT','DOCUMENT_ONLY'].map(v=><MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
              ):null}
              {selected==='REPORT_DELAY'?(
                <TextField label="Supplier-reported revised date" type="date" value={date}
                  onChange={e=>setDate(e.target.value)} slotProps={{inputLabel:{shrink:true}}} required/>
              ):null}
              {selected==='STORE_RECORD_REPLACEMENT_RECEIPT'?(
                <TextField label="Existing approved/posted Goods Receipt UUID" value={receiptId}
                  onChange={e=>setReceiptId(e.target.value)} required/>
              ):null}
              <TextField label="Existing authorized Project Document UUID" value={documentId}
                onChange={e=>setDocumentId(e.target.value)} required/>
              <TextField label="Evidence notes (not a substitute for a real supplier acknowledgment)"
                multiline minRows={2} value={note} onChange={e=>setNote(e.target.value)} required/>
              {save.isError?<Alert severity="error">{err(save.error)}</Alert>:null}
              {save.isSuccess?<Alert severity="success">Evidence recorded. Stock and Finance unchanged.</Alert>:null}
              <Box><Button variant="outlined" disabled={save.isPending||!selected||!documentId.trim()||!note.trim()||
                (selected==='ACKNOWLEDGE'&&!ackId)||
                (selected==='REPORT_DELAY'&&!date)||
                (selected==='STORE_RECORD_REPLACEMENT_RECEIPT'&&!receiptId.trim())}
                onClick={()=>{if(selected)save.mutate(selected)}}>
                {save.isPending?'Recording...':'Record source-linked evidence'}
              </Button></Box>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
