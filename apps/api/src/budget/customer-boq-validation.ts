import { CustomerBoqDraft } from './customer-boq.service';
import { budgetInvalid, budgetObject, budgetString, budgetUuid } from './budget-validation';

export function exactKeys(row: Record<string, unknown>, keys: string[]) {
  for (const key of Object.keys(row)) if (!keys.includes(key)) throw budgetInvalid(key, 'Unsupported field.');
}
export function canonicalUuid(value: unknown, field: string) { return (budgetUuid(value,field) as string).toLowerCase(); }
export function customerDraft(value: unknown): CustomerBoqDraft {
  const row = budgetObject(value);
  exactKeys(row,['sourceRevisionId','previousVersionId','reason','lines']);
  if (!Array.isArray(row.lines) || row.lines.length < 1 || row.lines.length > 500) throw budgetInvalid('lines','Use 1 to 500 lines.');
  return { sourceRevisionId: canonicalUuid(row.sourceRevisionId,'sourceRevisionId'), reason: budgetString(row,'reason',4000),
    ...(row.previousVersionId !== undefined ? {previousVersionId:canonicalUuid(row.previousVersionId,'previousVersionId')} : {}),
    lines: row.lines.map((value) => {
      const line = budgetObject(value);
      exactKeys(line,['lineId','description','quantity','uomId','method','manualRate','markupPercent','mappingReason','pricingReason','zeroPriceReason','mappings']);
      if (line.method !== 'MANUAL' && line.method !== 'MARKUP') throw budgetInvalid('method','Choose MANUAL or MARKUP.');
      if (!Array.isArray(line.mappings) || line.mappings.length < 1 || line.mappings.length > 500) throw budgetInvalid('mappings','Use 1 to 500 approved source mappings.');
      const optional: Record<string,string> = {};
      for (const key of ['manualRate','markupPercent','mappingReason','pricingReason','zeroPriceReason']) if (line[key] !== undefined) optional[key] = budgetString(line,key,4000);
      return {lineId:canonicalUuid(line.lineId,'lineId'), description:budgetString(line,'description',500),
        quantity:budgetString(line,'quantity',40), uomId:canonicalUuid(line.uomId,'uomId'),method:line.method,...optional,
        mappings:line.mappings.map((value) => { const m = budgetObject(value);exactKeys(m,['sourceLineId','sharePercent']);
          return {sourceLineId:canonicalUuid(m.sourceLineId,'sourceLineId'),sharePercent:budgetString(m,'sharePercent',40)};})};
    }) };
}
