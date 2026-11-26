import { useEffect, useState } from 'react';
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
  replacementReceiptLiveStatus: 'POSTED' | 'REVERSED' | 'SOURCE_UNVERIFIED' | null;
  returnCustodyTrace?: {
    quantity: string; originalDeliveryLineId: string; warehouseId: string;
    supplierSignatory: string; signedHandoverDocumentId: string;
    signedHandoverOperatorAttested: true; stockEffect: false; financeEffect: false;
  } | null;
  financeResolution: 'REPLACEMENT_ONLY_NO_AP_CREDIT';
  nonDamagedResolution: 'DISCREPANCY_EVIDENCE_ONLY';
  replacementTrace?: { quantity: string; purchaseOrderLineId: string;
    replacementGoodsReceiptId: string; originalDeliveryId: string } | null;
};
type Props = { orderId: string; permissions: string[]; roleCodes: string[]; preferredEvidenceDocumentId?: string };
type Data<T> = { data: T };
const url = (id: string) => '/procurement/purchase-orders/' + id + '/supplier-case';
const err = (value: unknown) =>
  value instanceof ApiError || value instanceof Error ? value.message : 'Unable to record supplier evidence.';

/**
 * PUR08/PUR14 supplementary evidence timeline, never actual supplier dispatch,
 * Goods Receipt, inventory posting, financial credit, or automatic notification.
 * The API independently rechecks live rights and canonical PO/GR/Document links.
 */
export function SupplierDeliveryCasePanel({ orderId, permissions, roleCodes, preferredEvidenceDocumentId }: Props) {
  const client = useQueryClient();
  const [action, setAction] = useState<Action>('ACKNOWLEDGE');
  const [documentId, setDocumentId] = useState(preferredEvidenceDocumentId ?? '');
  const [ackId, setAckId] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('DAMAGED');
  const [decision, setDecision] = useState('REQUEST_REPLACEMENT');
  const [date, setDate] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [receiptItemId, setReceiptItemId] = useState('');
  const [originalLineId, setOriginalLineId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('');
  const [supplierSignatory, setSupplierSignatory] = useState('');
  const [supplierSignatureConfirmed, setSupplierSignatureConfirmed] = useState(false);
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
  const caseData = current.isSuccess&&!current.isPlaceholderData?current.data?.data:undefined;
  useEffect(()=>{
    if(current.isError||!allowedReader){setDocumentId('');setAckId('');setNote('');setReceiptId('');setReceiptItemId('');setOriginalLineId('');setSupplierSignatory('');setReturnQuantity('');setSupplierSignatureConfirmed(false);setDate('');}
    if(external.isError)setAckId('');
  },[current.isError,external.isError,allowedReader,orderId]);
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
    if (!stage || ['ACKNOWLEDGED','IN_TRANSIT','DELAY_REPORTED'].includes(stage))
      choices.push({value:'REPORT_DISCREPANCY',label:'Report short/wrong/excess/damaged delivery'});
    if (stage==='CLAIM_RECORDED'&&caseData?.case?.pmDecision==='REQUEST_RETURN'&&caseData.case.discrepancyKind==='DAMAGED')
      choices.push({value:'STORE_RECORD_RETURN_DISPATCH',label:'Record actual outward supplier return evidence'});
    if (stage==='CLAIM_RECORDED'&&caseData?.case?.pmDecision==='REQUEST_REPLACEMENT'&&caseData.case.discrepancyKind==='DAMAGED')
      choices.push({value:'STORE_RECORD_REPLACEMENT_RECEIPT',label:'Link posted replacement GR evidence'});
  }
  if (canPm&&stage==='DISCREPANCY_REPORTED')
    choices.push({value:'PM_REVIEW_DISCREPANCY',label:'Khaimook: independently review discrepancy'});
  const selected = choices.some(x=>x.value===action) ? action : choices[0]?.value;
  const save = useMutation({
    mutationFn: (choice: Action) => {
      if(!caseData?.approvedLatest||!canDocument||!choices.some(c=>c.value===choice))throw Error('Refresh current authorized supplier case before recording evidence');
      if(choice==='ACKNOWLEDGE'&&(!external.isSuccess||!external.data.data.some(e=>e.id===ackId&&e.kind==='ACKNOWLEDGMENT')))throw Error('Refresh authorized acknowledgment');
      return apiRequest<Data<unknown>>(url(orderId)+'/events',{
      method:'POST', body:JSON.stringify({
        action:choice, expectedVersion:caseData?.case?.version??0,
        expectedPreviousEventId:caseData?.expectedPreviousEventId??null,
        evidenceDocumentId:documentId.trim(), note:note.trim(),
        ...(choice==='ACKNOWLEDGE'?{recordedPoAcknowledgmentEventId:ackId}:{}),
        ...(choice==='REPORT_DISCREPANCY'?{discrepancyKind:kind}:{}),
        ...(choice==='PM_REVIEW_DISCREPANCY'?{pmDecision:decision}:{}),
        ...(choice==='REPORT_DELAY'?{newSupplierExpectedDate:date}:{}),
        ...(choice==='STORE_RECORD_RETURN_DISPATCH'?{
          originalReceivingDeliveryLineId:originalLineId.trim(),
          returnQuantity:returnQuantity.trim(),
          supplierSignatory:supplierSignatory.trim(),
          supplierSignatureConfirmed,
        }:{}),
        ...(choice==='STORE_RECORD_REPLACEMENT_RECEIPT'?{
          recordedGoodsReceiptId:receiptId.trim(),
          recordedGoodsReceiptItemId:receiptItemId.trim(),
          originalReceivingDeliveryLineId:originalLineId.trim(),
        }:{}),
      }),
    });},
    onSuccess:()=>{
      setNote('');setDocumentId('');setAckId('');setReceiptId('');setReceiptItemId('');setOriginalLineId('');setDate('');
      setReturnQuantity('');setSupplierSignatory('');setSupplierSignatureConfirmed(false);
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
            Replacement-only creates no AP credit; a genuine supplier credit or AP adjustment must
            follow a separately authorized Porn-maker / Nancy-checker Finance workflow.
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
              {caseData.case?.discrepancyKind &&
               ['SHORT','WRONG_ITEM','EXCESS'].includes(caseData.case.discrepancyKind) ? (
                <Alert severity="warning">
                  Short, wrong-item and excess discrepancies are evidence-only. A supplier claim
                  can be recorded, but physical return/replacement resolution and stock/Finance
                  quantities require separately approved material and PO-line attribution.
                </Alert>
              ):null}
              {caseData.returnCustodyTrace ? (
                <Alert severity="info">
                  Supplier signed-handover attested by operator: {caseData.returnCustodyTrace.quantity} held damaged units ·
                  warehouse {caseData.returnCustodyTrace.warehouseId} ·
                  supplier signatory {caseData.returnCustodyTrace.supplierSignatory}.
                  Document {caseData.returnCustodyTrace.signedHandoverDocumentId}.
                  This is reported unposted custody only — no stock deduction or AP credit.
                  Previously posted goods require a separate authorized canonical reversal.
                </Alert>
              ):null}
              {caseData.replacementTrace?(
                <Alert severity={caseData.replacementReceiptLiveStatus==='POSTED'?'success':'warning'}>
                  Historical linked damaged quantity: {caseData.replacementTrace.quantity} ·
                  PO item {caseData.replacementTrace.purchaseOrderLineId} ·
                  GR {caseData.replacementTrace.replacementGoodsReceiptId}.{' '}
                  {caseData.replacementReceiptLiveStatus==='POSTED'
                    ? 'Canonical replacement GR is still approved and posted.'
                    : caseData.replacementReceiptLiveStatus==='REVERSED'
                      ? 'Canonical replacement GR was reversed. Prior supplier claim is historical evidence only; do not treat this as current received stock.'
                      : 'Current canonical replacement GR source cannot be verified. Reconcile its Project, item, posting and approval before relying on this claim.'}
                  {' '}The supplier-case event never posts stock or Finance.
                </Alert>
              ):null}
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
                  {(external.isSuccess?external.data.data:[]).filter(e=>e.kind==='ACKNOWLEDGMENT').map(e=>(
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
              {selected==='STORE_RECORD_RETURN_DISPATCH'?(
                <Stack spacing={1}>
                  <Alert severity="warning">
                    Only checked DAMAGED units that were excluded from the good-quantity GR
                    can be returned through custody-only evidence. The exact rejected quantity,
                    original line, a separate signed handover document uploaded under that original Receiving Delivery (not a duplicate condition photo), named supplier
                    signatory and Store attestation are mandatory. This never reduces posted
                    warehouse stock or creates a credit note.
                  </Alert>
                  <TextField label="Original damaged Receiving Delivery LINE UUID" value={originalLineId}
                    onChange={e=>setOriginalLineId(e.target.value)} required/>
                  <TextField label="Unposted damaged quantity returned" value={returnQuantity}
                    onChange={e=>setReturnQuantity(e.target.value)} required/>
                  <TextField label="Supplier signatory recorded on handover" value={supplierSignatory}
                    onChange={e=>setSupplierSignatory(e.target.value)} required/>
                  <TextField select label="Signed supplier handover confirmed by Store" value={supplierSignatureConfirmed?'YES':'NO'}
                    onChange={e=>setSupplierSignatureConfirmed(e.target.value==='YES')} required>
                    <MenuItem value="NO">NO — do not record</MenuItem>
                    <MenuItem value="YES">YES — signed document uploaded and personally checked</MenuItem>
                  </TextField>
                </Stack>
              ):null}
              {selected==='STORE_RECORD_REPLACEMENT_RECEIPT'?(
                <Stack spacing={1}>
                  <Alert severity="info">Only DAMAGED source quantities are supported: the original receiving evidence must link to the original checked delivery; the supplier replacement must be separately received, checked and posted, with an exact item, UOM and damaged quantity match.</Alert>
                  <TextField label="Original damaged Receiving Delivery LINE UUID" value={originalLineId}
                    onChange={e=>setOriginalLineId(e.target.value)} required/>
                  <TextField label="New posted replacement Goods Receipt UUID" value={receiptId}
                    onChange={e=>setReceiptId(e.target.value)} required/>
                  <TextField label="Replacement Goods Receipt ITEM UUID" value={receiptItemId}
                    onChange={e=>setReceiptItemId(e.target.value)} required/>
                </Stack>
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
                (selected==='STORE_RECORD_RETURN_DISPATCH'&&
                  (!originalLineId.trim()||!returnQuantity.trim()||!supplierSignatory.trim()||!supplierSignatureConfirmed))||
                (selected==='STORE_RECORD_REPLACEMENT_RECEIPT'&&(!receiptId.trim()||!receiptItemId.trim()||!originalLineId.trim()))}
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
