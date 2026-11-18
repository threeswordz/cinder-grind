import { UnprocessableEntityException } from '@nestjs/common';

export const MATERIAL_UOM_VIEW = 'master.material.view';
export const MATERIAL_UOM_MANAGE = 'master.material.conversion.manage';
export function uomInvalid(field: string, code = 'MATERIAL_UOM_INPUT_INVALID'): never {
  throw new UnprocessableEntityException({ code, detail: 'Check the explicit date, active units, exact ratio and quantity precision.', errors: [{ field, message: code }] });
}
function object(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return uomInvalid('body');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !keys.includes(key))) return uomInvalid('body');
  return input;
}
export function uomId(value: unknown, field = 'id') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return uomInvalid(field);
  return value.toLowerCase();
}
export function uomVersion(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value >= 2147483647) return uomInvalid('expectedVersion');
  return value;
}
export function uomDate(value: unknown, field = 'businessDate') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000') || !Number.isFinite(Date.parse(value + 'T00:00:00.000Z')) || new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) !== value) return uomInvalid(field);
  return value;
}
function reason(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000 || /[\u0000-\u001f\u007f]/.test(value)) return uomInvalid('reason');
  return value.trim();
}
export function uomRatio(numerator: unknown, denominator: unknown) {
  const integer = (v: unknown, field: string) => {
    if (typeof v !== 'string' || !/^[1-9]\d{0,37}$/.test(v)) return uomInvalid(field);
    return BigInt(v);
  };
  let n = integer(numerator, 'numerator'), d = integer(denominator, 'denominator');
  let a = n, b = d;
  while (b) [a, b] = [b, a % b];
  n /= a; d /= a;
  return { numerator: n.toString(), denominator: d.toString() };
}
export function uomQuantity(value: unknown) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(value)) return uomInvalid('quantity');
  const [whole, fraction = ''] = value.split('.');
  const scaled = BigInt(whole!) * 10000n + BigInt(fraction.padEnd(4, '0'));
  if (scaled <= 0n) return uomInvalid('quantity');
  return scaled;
}
export function uomFixed(value: bigint) { return (value / 10000n).toString() + '.' + (value % 10000n).toString().padStart(4, '0'); }
export function exactUomQuantity(quantity: string, sourcePrecision: number, stockPrecision: number, numerator: string, denominator: string) {
  if (!Number.isInteger(sourcePrecision) || sourcePrecision < 0 || sourcePrecision > 6 || !Number.isInteger(stockPrecision) || stockPrecision < 0 || stockPrecision > 4) return uomInvalid('precision');
  const entered = uomQuantity(quantity), ratio = uomRatio(numerator, denominator);
  if (entered % (10n ** BigInt(Math.max(0, 4 - sourcePrecision)))) return uomInvalid('quantity', 'MATERIAL_UOM_SOURCE_PRECISION');
  const product = entered * BigInt(ratio.numerator), divisor = BigInt(ratio.denominator);
  if (product % divisor) return uomInvalid('quantity', 'MATERIAL_UOM_NOT_REPRESENTABLE');
  const stock = product / divisor;
  if (stock > 999999999999999999n) return uomInvalid('quantity', 'MATERIAL_UOM_OVERFLOW');
  if (stock % (10n ** BigInt(4 - stockPrecision))) return uomInvalid('quantity', 'MATERIAL_UOM_NOT_REPRESENTABLE');
  return { enteredQuantity: uomFixed(entered), stockQuantity: uomFixed(stock) };
}
export function uomPrepare(value: unknown) {
  const r = object(value, ['requestKey', 'stockUomId', 'reason']);
  return { requestKey: uomId(r.requestKey, 'requestKey'), stockUomId: uomId(r.stockUomId, 'stockUomId'), reason: reason(r.reason) };
}
export function uomRevise(value: unknown) {
  const r = object(value, ['requestKey', 'expectedVersion', 'sourceUomId', 'effectiveFrom', 'numerator', 'denominator', 'reason']);
  return { requestKey: uomId(r.requestKey, 'requestKey'), expectedVersion: uomVersion(r.expectedVersion), sourceUomId: uomId(r.sourceUomId, 'sourceUomId'), effectiveFrom: uomDate(r.effectiveFrom, 'effectiveFrom'), ...uomRatio(r.numerator, r.denominator), reason: reason(r.reason) };
}
export function uomPreview(value: unknown) {
  const r = object(value, ['sourceUomId', 'businessDate', 'quantity']);
  return { sourceUomId: uomId(r.sourceUomId, 'sourceUomId'), businessDate: uomDate(r.businessDate), quantity: uomFixed(uomQuantity(r.quantity)) };
}
