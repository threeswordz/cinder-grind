import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

test('forward BOQ document guard adds exactly three source resolutions and preserves every prior Company/Project/linker/target assertion',()=>{
  const read=name=>readFileSync(new URL('../../apps/api/prisma/migrations/'+name+'/migration.sql',import.meta.url),'utf8').split('CREATE OR REPLACE FUNCTION')[1];
  const before=read('20261003021500_v0_6_d_finance_subcontract_document_targets');
  let after=read('20261029020000_v1_3_boq_document_targets');
  for(const [type,table] of [['BOQ','boqs'],['BUDGET_REVISION','budget_revisions'],['CUSTOMER_BOQ','customer_boq_versions']]){
    const clause='  ELSIF NEW."entity_type" = \''+type+'\' THEN\n    SELECT "company_id","project_id"\n      INTO target_company,target_project\n    FROM "'+table+'"\n    WHERE "id" = NEW."entity_id";\n';
    assert.ok(after.includes(clause),'Missing explicit scoped source '+type);after=after.replace(clause,'');
  }
  assert.equal(after,before,'An existing guard branch or denial changed');
});
