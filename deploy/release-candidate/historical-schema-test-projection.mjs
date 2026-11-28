// Test-only projection of the current candidate onto the pre-purchasing
// historical schema. Use exact layer validators; never edit historical SQL,
// silently omit arbitrary fields, or use this projection for release admission.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {stripSuccessorSchema} from './purchasing-successor-schema-preparation.mjs';
import {stripPur01Schema} from './pur01-schema-preparation.mjs';
import {stripPur04Schema} from './pur04-schema-preparation.mjs';
import {stripPm02Schema} from './pm02-schema-preparation.mjs';
// SS16 is a separately approved exact successor. Only the pinned integrated
// schema can be projected; missing, partial, modified or unrelated schema drift
// must fail. The old admission classifiers themselves are not broadened.
const ss16SchemaBlob='c1a4f592034353ab61e1f0a71ceeee396ea28d52';
const predecessorSchemaBlob='1a50604233a9555c206195aec2443aa5e1b27ab7';
const ss16Model="model MovementCorrectionRequest {\n  id String @id @default(uuid()) @db.Uuid\n  companyId String @map(\"company_id\") @db.Uuid\n  sourceKind String @map(\"source_kind\") @db.VarChar(30)\n  sourceId String @map(\"source_id\") @db.Uuid\n  sourcePostedAt DateTime? @map(\"source_posted_at\") @db.Timestamptz(6)\n  sourceApprovalInstanceId String? @map(\"source_approval_instance_id\") @db.Uuid\n  sourceSubmittedAt DateTime? @map(\"source_submitted_at\") @db.Timestamptz(6)\n  requestKey String @map(\"request_key\") @db.VarChar(120)\n  reason String @db.Text\n  requestedByUserId String @map(\"requested_by_user_id\") @db.Uuid\n  requestedAt DateTime @default(now()) @map(\"requested_at\") @db.Timestamptz(6)\n  approvalInstanceId String @unique @map(\"approval_instance_id\") @db.Uuid\n\n  company Company @relation(fields: [companyId], references: [id], onDelete: Restrict)\n  requestedBy User @relation(\"MovementCorrectionRequester\", fields: [companyId, requestedByUserId], references: [companyId, id], onDelete: Restrict)\n  approvalInstance ApprovalInstance @relation(\"MovementCorrectionDecision\", fields: [approvalInstanceId], references: [id], onDelete: Restrict)\n  sourceApprovalInstance ApprovalInstance? @relation(\"MovementCorrectionOriginalApproval\", fields: [sourceApprovalInstanceId], references: [id], onDelete: Restrict, map: \"movement_correction_original_approval_fk\")\n\n  @@unique([companyId, sourceKind, sourceId, requestKey], map: \"movement_correction_request_replay_key\")\n  @@index([companyId, sourceKind, sourceId], map: \"movement_correction_source_idx\")\n  @@map(\"movement_correction_requests\")\n}";
const ss16Relations=["  movementCorrectionRequests MovementCorrectionRequest[]","  movementCorrectionRequests MovementCorrectionRequest[] @relation(\"MovementCorrectionRequester\")","  movementCorrectionRequest MovementCorrectionRequest? @relation(\"MovementCorrectionDecision\")","  sourceCancellationRequests MovementCorrectionRequest[] @relation(\"MovementCorrectionOriginalApproval\")"];
const gitBlob=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
export function projectPreSs16TestSchema(schema){
 assert.equal(gitBlob(schema),ss16SchemaBlob,'Unexpected current SS16 schema blob');
 const prior=execFileSync('git',['show','9417f07c609dbc091b5bbe2e09071c5e2c316459:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
 assert.equal(gitBlob(prior),predecessorSchemaBlob,'Unexpected historical schema blob');
 assert.equal(schema.split(ss16Model).length,2,'Exact SS16 model required once');
 let text=schema.replace(ss16Model,'');
 for(const relation of ss16Relations){
  assert.equal(text.split('\n').filter(line=>line===relation).length,1,'Exact SS16 relation required once');
  text=text.replace(relation+'\n','');
 }
 assert.equal(text.trimEnd(),prior.trimEnd(),'SS16 is not the exact additive layer');
 return prior;
}
export function projectPrePurchasingTestSchema(schema){
 const successor=stripSuccessorSchema(projectPreSs16TestSchema(schema));
 const one=stripPur01Schema(successor.text),four=stripPur04Schema(one.text),pm02=stripPm02Schema(four.text);
 assert.deepEqual([successor.pur07,successor.pur12,one.present,four.present,pm02.present],[true,true,true,true,true], 'Exact current purchasing and PM02 layers must be present before historical projection');
 return pm02.text;
}
