// Test-only projection of the current candidate onto the pre-purchasing
// historical schema. Use exact layer validators; never edit historical SQL,
// silently omit arbitrary fields, or use this projection for release admission.
import assert from 'node:assert/strict';
import {stripSs16ReleaseSchema} from './ss16-release-contract.mjs';
import {stripSuccessorSchema} from './purchasing-successor-schema-preparation.mjs';
import {stripPur01Schema} from './pur01-schema-preparation.mjs';
import {stripPur04Schema} from './pur04-schema-preparation.mjs';
import {stripPm02Schema} from './pm02-schema-preparation.mjs';
// Test-only projection may consume the exact production classifier's strict
// SS16 proof, but the classifier never imports this projection.
export function projectPreSs16TestSchema(schema){
 const result=stripSs16ReleaseSchema(schema);
 assert.equal(result.present,true,'Current SS16 layer required in historical tests');
 return result.text;
}
export function projectPrePurchasingTestSchema(schema){
 const successor=stripSuccessorSchema(projectPreSs16TestSchema(schema));
 const one=stripPur01Schema(successor.text),four=stripPur04Schema(one.text),pm02=stripPm02Schema(four.text);
 assert.deepEqual([successor.pur07,successor.pur12,one.present,four.present,pm02.present],[true,true,true,true,true], 'Exact current purchasing and PM02 layers must be present before historical projection');
 return pm02.text;
}
