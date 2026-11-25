// PO line amounts persist eight decimal places; headers and VAT rate use two.
// Use exact scaled integers, rounding only for displayed THB amounts.
type PoMoneySource = {
  lines: ReadonlyArray<{ amount: string }>;
  discountAmount: string | null;
  freightAmount: string | null;
  additionalChargeAmount: string | null;
  vatRatePercent: string | null;
};
const SCALE = 100000000n;
const SATANG = 1000000n;
function decimal(raw: string, places: number, wholeDigits: number): bigint {
  // Prisma Decimal JSON may use exponent notation for very small/large
  // persisted line amounts; expand it with integer/string arithmetic only.
  if (places === 8 && /e/u.test(raw)) {
    const match = /^([1-9])(?:\.(\d{1,37}))?e([+-]?\d{1,2})$/u.exec(raw);
    if (!match) throw new Error('PO_PRINT_INVALID_MONEY_DECIMAL');
    const exponent = Number(match[3]);
    if (exponent < -8 || exponent > 29) throw new Error('PO_PRINT_INVALID_MONEY_DECIMAL');
    const digits = match[1]! + (match[2] ?? '');
    const point = exponent + 1;
    raw = point <= 0 ? '0.' + '0'.repeat(-point) + digits
      : point >= digits.length ? digits.padEnd(point, '0')
      : digits.slice(0, point) + '.' + digits.slice(point);
  }
  const pattern = new RegExp(`^(?:0|[1-9]\\d{0,${wholeDigits - 1}})(?:\\.\\d{1,${places}})?$`, 'u');
  if (!pattern.test(raw)) throw new Error('PO_PRINT_INVALID_MONEY_DECIMAL');
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole!) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'));
}
function satangText(satang: bigint): string {
  return String(satang / 100n) + '.' + String(satang % 100n).padStart(2, '0');
}
function roundedText(numerator: bigint, denominator = SATANG): string {
  return satangText((numerator + denominator / 2n) / denominator);
}
export function formatPoLineAmount(raw: string): string {
  return roundedText(decimal(raw, 8, 30));
}
export function approvedPrintTotals(order: PoMoneySource) {
  const subtotal = order.lines.reduce((sum, line) => sum + decimal(line.amount, 8, 30), 0n);
  const missing = [order.discountAmount, order.freightAmount,
    order.additionalChargeAmount, order.vatRatePercent].some(v => v === null);
  if (missing) return { subtotal: roundedText(subtotal), net: null, vatAmount: null, grandTotal: null };
  const header = (raw: string) => decimal(raw, 2, 16) * (SCALE / 100n);
  const net = subtotal - header(order.discountAmount!) + header(order.freightAmount!) + header(order.additionalChargeAmount!);
  if (net < 0n) throw new Error('PO_PRINT_NEGATIVE_NET_TOTAL');
  const rate = decimal(order.vatRatePercent!, 2, 3);
  if (rate > 10000n) throw new Error('PO_PRINT_VAT_RATE_INVALID');
  // Match server grand-total semantics: independently round the exact net,
  // VAT, and gross; never add already rounded display amounts.
  return {
    subtotal: roundedText(subtotal), net: roundedText(net),
    vatAmount: roundedText(net * rate, SATANG * 10000n),
    grandTotal: roundedText(net * (10000n + rate), SATANG * 10000n),
  };
}
