// Test-only projection of the current candidate onto the pre-purchasing
// historical schema. Use exact layer validators; never edit historical SQL,
// silently omit arbitrary fields, or use this projection for release admission.
import assert from 'node:assert/strict';
import {stripSuccessorSchema} from './purchasing-successor-schema-preparation.mjs';
import {stripPur01Schema} from './pur01-schema-preparation.mjs';
import {stripPur04Schema} from './pur04-schema-preparation.mjs';
import {stripPm02Schema} from './pm02-schema-preparation.mjs';
export function projectPrePurchasingTestSchema(schema){
 const successor=stripSuccessorSchema(schema);
 const one=stripPur01Schema(successor.text),four=stripPur04Schema(one.text),pm02=stripPm02Schema(four.text);
 assert.deepEqual([successor.pur07,successor.pur12,one.present,four.present,pm02.present],[true,true,true,true,true], 'Exact current purchasing and PM02 layers must be present before historical projection');
 return pm02.text;
}
