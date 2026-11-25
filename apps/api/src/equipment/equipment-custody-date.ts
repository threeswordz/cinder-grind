/** SS11: custody uses the Thailand business date, not server UTC or operator locale.
 * Date-only fields are represented as midnight UTC for Prisma @db.Date.
 * No Equipment lifecycle, role or posting side effects.
 */
import { thailandBusinessDate } from '../inventory/approved-plan-start-reminder';

export function custodyThailandDay(now: Date): Date {
  return new Date(thailandBusinessDate(now) + 'T00:00:00.000Z');
}
