import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {schemaDefinitionDigest} from './m7-source-capture-adapter.mjs';
import {restoredSchemaDefinitionDigest} from './m7-restored-schema.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const table=(name,expr,values,extra='')=>{
 const prefix="    CONSTRAINT "+name+" CHECK ("+extra+"(("+expr+")::text = ANY ";
 const source=prefix+"((ARRAY["+values.map(x=>"'"+x+"'::character varying").join(', ')+"])::text[])))"+(extra?')':'');
 const target=prefix+"(ARRAY["+values.map(x=>"('"+x+"'::character varying)::text").join(', ')+"])))"+(extra?')':'');
 return [source,target];
};
const a=table('movement_correction_requests_source_kind_check','source_kind',['GOODS_RECEIPT','MATERIAL_ISSUE','MATERIAL_RETURN','STOCK_TRANSFER']);
const b=table('ss16_transfer_event_shape','action',['CREATE','APPROVE','DISPATCH','ASSIGN','PREPARE_RECEIPT','RECEIVE','REVERSE','CANCEL'],'((version > 0) AND (length(btrim(reason)) > 0) AND ');
const dump=(owner,lines)=>['--','-- PostgreSQL database dump','--','','--','-- Name: sample; Type: TABLE; Schema: public; Owner: '+owner,'--','CREATE TABLE public.sample (',...lines,');','','--','-- PostgreSQL database dump complete','--',''].join('\n');
const source=dump('proto_runtime',[a[0],b[0]]),target=dump('m7_restore_role_abcdef012345',[a[1],b[1]]),expected=schemaDefinitionDigest(source,'proto_runtime'),role='m7_restore_role_abcdef012345';
test('exact two native diagnostic lines match recorded hashes, corrected full digest equals sealed source',()=>{
 assert.deepEqual([a[0],b[0],a[1],b[1]].map(sha),['ffb08e632cddee7561f07f643578cb75802f7576fe7897fdb2cce7f68a18ffbf','eab34c50aea48eda4bb28050fac662ea39eeb6ada2430077aea8798cbf809e6d','db8518c763d37dac69a6275ee89d30f4bc71973255efc9e4dda84fa738ce78b9','42bead5ecae9c507d98397f336be50186a4cc7ef00f760eda8424ab38ad383c0']);
 assert.notEqual(schemaDefinitionDigest(target,role),expected);
 assert.equal(restoredSchemaDefinitionDigest(target,role,expected),expected);
 assert.equal(restoredSchemaDefinitionDigest(source,'proto_runtime',expected),expected);
});
test('actual constraint, order, count, and unrelated DDL drift are not normalized away',()=>{
 for(const altered of [target.replace("'CANCEL'","'OTHER'"),target.replace('version > 0','version >= 0'),target.replace('length(btrim(reason)) > 0','length(btrim(reason)) >= 0'),target.replace(a[1],a[1]+'\n'+a[1]),target.replace(a[1],a[0]),target.replace('public.sample','public.other'),target.replace(a[1]+'\n'+b[1],b[1]+'\n'+a[1])])assert.notEqual(restoredSchemaDefinitionDigest(altered,role,expected),expected);
 assert.notEqual(restoredSchemaDefinitionDigest(target,role,'f'.repeat(64)),'f'.repeat(64));
});
