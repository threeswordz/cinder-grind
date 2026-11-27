// Read-only proposal from the pinned successor census. No database writes or grants.
import {createHash} from 'node:crypto';
const app='70013b5139292ef33563447f8937c8f132feabd2',tree='8152b5ac627325c91c36ed65875791966a1a8874',operator='4797928fbb06c156645dff821a1fbc3ec1fb4b11';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error('M6_FIXTURE_PLAN_'+code),{safeCode:'M6_FIXTURE_PLAN_'+code});};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const movement=['receipt','issue','return','transfer'];
const grants=actions=>movement.flatMap(k=>actions.map(a=>'inventory.'+k+'.'+a));
const view=['projects.project.view','subcontracts.certification.view'];
export function buildSuccessorFixturePlan(census){
 need(census?.status==='M6_SUCCESSOR_ROLE_COVERAGE_OBSERVED'&&census.applicationSha===app&&census.applicationTree===tree&&census.operatorSha===operator&&census.coverageOnly===true&&census.sealedReceiptMatched===true&&census.retainedRuntimeIdentityChecked===true&&census.appliedChecksumsMatched===184&&census.zeroActiveSessionsObserved===true&&census.functionalActorsBound===8&&census.requiredFunctionalActors===8&&census.ss16ProjectsObserved===2&&census.mayMutate===false&&census.authenticatedReadbackPerformed===false&&census.productionAuthorized===false&&census.milestone6Accepted===false&&census.recoveryReplayed===false&&census.secretsPrinted===false,'CENSUS');
 need(['canonicalStoreReady','canonicalPmReady','workflowReady','projectMembershipReady','ready'].every(k=>census.ss16?.[k]===false)&&census.certification?.finance===2&&['certificationOnly','unassigned','foreign'].every(k=>census.certification[k]===0)&&census.certification.ready===false,'COVERAGE_CHANGED');
 const plan={applicationSha:app,applicationTree:tree,censusOperatorSha:operator,database:'m6_successor_rehearsal',syntheticOnly:true,retainedMutationAuthorized:false,productionAuthorized:false,
  ss16:{company:'PROTO_A',roles:[{actor:'STORE_SITE',code:'STOREKEEPER',permissions:grants(['view','edit'])},{actor:'KHAIMOOK',code:'PROJECT_MANAGER',permissions:grants(['view','approve','reverse'])}],projects:['SITE_A','SITE_B'],membershipPolicy:'ADD_MISSING_ONLY',rolePolicy:'CREATE_OR_VERIFY_EXACT_NO_EXISTING_ROLE_GRANT_EDITS',workflow:{code:'SS16_MOVEMENT_CORRECTION',entityType:'MOVEMENT_CORRECTION',stepNo:1,requiredApprovals:1,role:'PROJECT_MANAGER'}},
  certification:{existingFinanceControl:'BIND_ONE_VERIFIED_ASSIGNED_ACTOR',newActors:[{key:'certificationOnly',roleCode:'PROTO_M6_CERT_ONLY',company:'PROTO_A',project:'SITE_A',permissions:[...view]},{key:'unassigned',roleCode:'PROTO_M6_CERT_UNASSIGNED',company:'PROTO_A',project:null,permissions:[...view,'finance.payment.view']},{key:'foreign',roleCode:'PROTO_M6_CERT_FOREIGN',company:'PROTO_B',project:'SITE_FOREIGN',permissions:[...view,'finance.payment.view']}],forbidPermissions:['projects.access_all'],noHrGrants:true},
  maximumNewActors:3,maximumSessionActors:12,existingRowsMustBePreserved:true,allowOnlyExplicitAdditions:true,requirePreAndPostFixturePreservation:true,requirePrivateRosterBinding:true};
 return {plan,planSha256:hash(plan),mayMutate:false};
}
// Approval is for the exact proposal, not permission to run an unbound writer.
export function verifySuccessorFixtureAuthorization(census,authorization){
 const proposal=buildSuccessorFixturePlan(census);
 need(authorization?.planSha256===proposal.planSha256&&authorization.applicationSha===app&&authorization.database===proposal.plan.database&&authorization.ownerAuthorizedFixture===true&&authorization.retainedMutationAuthorized===false&&authorization.productionAuthorized===false,'AUTHORIZATION');
 return {...proposal,ownerAuthorizedFixture:true,requiresExactNativeDeltaBinding:true,mayMutate:false};
}
