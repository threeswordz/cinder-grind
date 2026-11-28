// PostgreSQL 17.11 pg_dump/pg_restore deparses the same varchar-to-text
// array coercion in two observed forms. Admit exactly these two expressions
// for this one named constraint, not generic cast/whitespace normalization.
import assert from 'node:assert/strict';
const name="movement_correction_requests_source_kind_check";
const original="CHECK (((source_kind)::text = ANY ((ARRAY['GOODS_RECEIPT'::character varying, 'MATERIAL_ISSUE'::character varying, 'MATERIAL_RETURN'::character varying, 'STOCK_TRANSFER'::character varying])::text[])))";
const restored="CHECK (((source_kind)::text = ANY (ARRAY[('GOODS_RECEIPT'::character varying)::text, ('MATERIAL_ISSUE'::character varying)::text, ('MATERIAL_RETURN'::character varying)::text, ('STOCK_TRANSFER'::character varying)::text])))";
export function canonicalSs16RecoveryConstraints(rows){
 assert.ok(Array.isArray(rows));
 const matched=rows.filter(row=>row.name===name);
 assert.equal(matched.length,1,'Exactly one SS16 source-kind CHECK required');
 const [row]=matched;
 assert.equal(row.kind,'c','SS16 source-kind constraint must be CHECK');
 assert.equal(row.validated,true,'SS16 source-kind CHECK must be validated');
 assert.equal(row.no_inherit,false,'SS16 source-kind CHECK inheritance differs');
 assert.equal(row.deferrable,false);
 assert.equal(row.deferred,false);
 assert.ok(row.definition===original||row.definition===restored,'Unexpected SS16 source-kind CHECK expression');
 return rows.map(r=>r===row?{...r,definition:original}:r);
}
