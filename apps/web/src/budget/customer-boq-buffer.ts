// DEC-054: canonical pricing snapshots keep up to four decimal places even
// when the UOM supports fewer. Reopening an approved or draft Customer BOQ
// must produce valid user-input precision, without altering stored evidence.
// Only insignificant fractional zeros may be removed: never round values.
export function normalizeRetainedQuantity(value: string, decimalPlaces: number): string {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value) ||
      !Number.isSafeInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new Error('Invalid saved BOQ quantity or unit precision');
  }
  const [whole, fraction = ''] = value.split('.');
  const significant = fraction.replace(/0+$/, '');
  if (significant.length > Math.min(4, decimalPlaces)) {
    throw new Error('Saved BOQ quantity exceeds unit precision');
  }
  return significant ? whole + '.' + significant : whole!;
}
