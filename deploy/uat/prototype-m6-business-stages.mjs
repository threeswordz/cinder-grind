// Bind only the NEW M6 Finance, HR and BOQ business slices to canonical APIs.
// Previous Procurement/Receiving/Subcontract/UOM operators MUST NOT be called.
// This binding is inert until a separately reviewed original-Mac operator uses it.
import {API,WEB,httpClient} from './prototype-actors.mjs';
import {validCompletedUomReceipt,configureVerifiedM6Business} from './prototype-m6-finance-configuration.mjs';
import {uomSnapshot,digest} from './prototype-uom-state.mjs';
import {executeM6FinanceJourney,validateM6FinanceSource} from './prototype-m6-finance-journey.mjs';
import {executeM6HrDocumentJourney,validateM6HrSource} from './prototype-m6-hr-document-journey.mjs';
import {executeM6BoqJourney} from './prototype-m6-boq-journey.mjs';

const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const SHA=/^[a-f0-9]{40}$/;
const proved=(r,status)=>r?.status===status&&r.sessionsRevoked===true&&
  r.productionAuthorized===false;

// All source suppliers must obtain fresh evidence on the actual Mac (not
// optimistic fixture IDs). No DB connection or HTTP session is created here.
export function createM6BusinessStages({releaseSha,db,binding,priorUomReceipt,
  resolveFinanceSource,resolveHrSource,verifyEncryptedHrAttachment,
  makeHttpClient=httpClient,
  configure=configureVerifiedM6Business,
  financeJourney=executeM6FinanceJourney,
  hrJourney=executeM6HrDocumentJourney,
  boqJourney=executeM6BoqJourney}={}){
  need(SHA.test(releaseSha??'')&&db&&typeof db.$transaction==='function'&&
    binding?.actors&&binding?.fixture&&validCompletedUomReceipt(priorUomReceipt)&&
    typeof resolveFinanceSource==='function'&&typeof resolveHrSource==='function'&&
    typeof verifyEncryptedHrAttachment==='function'&&
    [makeHttpClient,configure,financeJourney,hrJourney,boqJourney].every(f=>typeof f==='function'),
    'M6_BUSINESS_BINDING_INCOMPLETE');
  const {fixture,actors}=binding;
  const check=authority=>need(authority?.releaseSha===releaseSha&&
    authority?.isolatedSynthetic===true&&authority.productionAuthorized===false,
    'M6_UNRELEASED_BUSINESS_STAGE');
  let configured=false,financeDone=false,hrDone=false;
  const wrap=value=>({ok:true,releaseSha,proof:value});
  const client=makeHttpClient(API,WEB);
  need(client&&['login','logout','call'].every(n=>typeof client[n]==='function'),
    'M6_CANONICAL_HTTP_CLIENT_REQUIRED');
  return {
    async configure({authority}){
      check(authority);
      need(!configured,'M6_CONFIGURATION_CANNOT_REPLAY');
      // Measure live identity before invoking the guarded, locked, same-digest
      // synthetic configuration transaction. It refuses extra role grants.
      const before=await db.$transaction(async tx=>{
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        return uomSnapshot(tx);
      },{isolationLevel:'RepeatableRead',timeout:30000});
      const result=await configure(db,binding,digest(before),priorUomReceipt);
      need(result?.status==='M6_SYNTHETIC_FINANCE_BOQ_CONFIGURATION_APPLIED'&&
        result.workflowCount===4&&result.prototypeOnly===true&&
        result.productionAuthorized===false,'M6_FINANCE_CONFIGURATION_UNVERIFIED');
      configured=true;
      return wrap({status:result.status,addedGrantCount:result.addedGrantCount,workflowCount:4});
    },
    async finance({authority}){
      check(authority);need(configured&&!financeDone,'M6_FINANCE_SEQUENCE_INVALID');
      const obtained=await resolveFinanceSource({binding,db});
      need(obtained?.approvedPoAndGoodGrVerified===true&&
        obtained?.noProcurementReplay===true&&obtained?.source,
        'M6_PRIOR_APPROVED_FINANCE_SOURCE_NOT_ATTESTED');
      validateM6FinanceSource(fixture,obtained.source);
      const result=await financeJourney({client,actors,fixture,source:obtained.source});
      need(proved(result,'M6_SUPPLIER_INVOICE_AND_PAYMENT_HTTP_VERIFIED')&&
        result.makerDenialsVerified===true&&result.postedSyntheticOnly===true,
        'M6_FINANCE_HTTP_EVIDENCE_INCOMPLETE');
      financeDone=true;
      return wrap({status:result.status,invoiceId:result.invoiceId,paymentId:result.paymentId});
    },
    async hr({authority}){
      check(authority);need(financeDone&&!hrDone,'M6_HR_SEQUENCE_INVALID');
      const source=await resolveHrSource({binding,db});
      validateM6HrSource(fixture,source);
      const result=await hrJourney({client,actors,fixture,source,api:API,web:WEB});
      need(proved(result,'M6_ENCRYPTED_HR_ATTACHMENT_HTTP_VERIFIED')&&
        result.syntheticAttachmentId&&result.syntheticEmployeeId===source.employeeId&&
        result.uploadAndAuthorizedPlaintextReadbackVerified===true,
        'M6_HR_AUTHENTICATED_PROOF_INCOMPLETE');
      // HTTP decryption alone is NOT encryption-at-rest proof: examine the
      // specific encrypted target row/blob with the original private HR keys.
      const sealed=await verifyEncryptedHrAttachment({
        binding,db,attachmentId:result.syntheticAttachmentId,employeeId:source.employeeId
      });
      need(sealed?.attachmentId===result.syntheticAttachmentId&&
        sealed?.sourceFilesAndKeysPreserved===true&&
        sealed?.ciphertextAtRestVerified===true&&
        sealed?.plaintextNotStored===true,'M6_HR_ENCRYPTED_CUSTODY_UNVERIFIED');
      hrDone=true;
      return wrap({status:result.status,encryptedAtRestVerified:true});
    },
    async boq({authority}){
      check(authority);need(hrDone,'M6_BOQ_SEQUENCE_INVALID');
      const result=await boqJourney({client,actors,fixture});
      need(proved(result,'M6_DEC054_COST_AND_BUFFERED_CLIENT_BOQ_HTTP_VERIFIED')&&
        result.benCostSelfApprovalVerified===true&&
        result.nancyIndependentClientApprovalVerified===true&&
        result.bufferedClientRawAndBufferVerified===true&&
        result.quantityOnlyHasNoMoney===true,
        'M6_DEC054_BOQ_PROOF_INCOMPLETE');
      return wrap({status:result.status,sourceCostRevisionId:result.sourceCostRevisionId,
        clientBoqVersionId:result.clientBoqVersionId});
    },
  };
}
