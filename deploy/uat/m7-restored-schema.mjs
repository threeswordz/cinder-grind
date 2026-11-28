// Native PG17.11 diagnostic identified exactly two equivalent CHECK deparse
// variants after pg_restore. Preserve the historical sealed source digest.
// No generic SQL rewriting, sorting, ignored constraints, or changed source witness.
import {schemaDefinitionDigest} from './m7-source-capture-adapter.mjs';
const pairs=[
  ["    CONSTRAINT movement_correction_requests_source_kind_check CHECK (((source_kind)::text = ANY (ARRAY[('GOODS_RECEIPT'::character varying)::text, ('MATERIAL_ISSUE'::character varying)::text, ('MATERIAL_RETURN'::character varying)::text, ('STOCK_TRANSFER'::character varying)::text])))",
   "    CONSTRAINT movement_correction_requests_source_kind_check CHECK (((source_kind)::text = ANY ((ARRAY['GOODS_RECEIPT'::character varying, 'MATERIAL_ISSUE'::character varying, 'MATERIAL_RETURN'::character varying, 'STOCK_TRANSFER'::character varying])::text[])))"],
  ["    CONSTRAINT ss16_transfer_event_shape CHECK (((version > 0) AND (length(btrim(reason)) > 0) AND ((action)::text = ANY (ARRAY[('CREATE'::character varying)::text, ('APPROVE'::character varying)::text, ('DISPATCH'::character varying)::text, ('ASSIGN'::character varying)::text, ('PREPARE_RECEIPT'::character varying)::text, ('RECEIVE'::character varying)::text, ('REVERSE'::character varying)::text, ('CANCEL'::character varying)::text]))))",
   "    CONSTRAINT ss16_transfer_event_shape CHECK (((version > 0) AND (length(btrim(reason)) > 0) AND ((action)::text = ANY ((ARRAY['CREATE'::character varying, 'APPROVE'::character varying, 'DISPATCH'::character varying, 'ASSIGN'::character varying, 'PREPARE_RECEIPT'::character varying, 'RECEIVE'::character varying, 'REVERSE'::character varying, 'CANCEL'::character varying])::text[]))))"]
];
// Require every exact observed restored line once, and the historical source
// form absent. The entire corrected dump must still match the sealed digest.
export function restoredSchemaDefinitionDigest(text,owner,expected){
 const original=schemaDefinitionDigest(text,owner);
 if(original===expected)return original;
 const lines=text.replace(/\r\n/g,'\n').split('\n');
 if(!pairs.every(([restored,source])=>lines.filter(l=>l===restored).length===1&&!lines.includes(source)))return original;
 const mapped=lines.map(l=>pairs.find(([restored])=>l===restored)?.[1]??l);
 const candidate=schemaDefinitionDigest(mapped.join('\n'),owner);
 return candidate===expected?candidate:original;
}
