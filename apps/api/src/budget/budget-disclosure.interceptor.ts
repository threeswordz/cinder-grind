import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import { AuthenticatedRequest } from '../auth/auth.types';
import { COST_FULL_VIEW, QUANTITY_VIEW, budgetMutationReceipt, quantityRecord } from './budget-disclosure';

@Injectable()
export class BudgetDisclosureInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { method: string; url: string }>();
    // Only the route pathname selects a disclosure authority, never query text.
    const pathname = request.url.split('?', 1)[0] ?? '';
    const read = /\/revisions(?:\/|$)/i.test(pathname) ? 'budget.revision.view' : 'budget.boq.view';
    return next.handle().pipe(map((result: { data: unknown }) => {
      const full = request.auth?.permissions.includes(COST_FULL_VIEW);
      if (request.method === 'GET') {
        if (full) return result;
        if (!request.auth?.permissions.includes(QUANTITY_VIEW)) {
          throw new ForbiddenException({ code:'BOQ_COST_DISCLOSURE_DENIED',
            detail:'Explicit full Cost BOQ or Quantity Only authority is required.' });
        }
        return { data: quantityRecord(result.data) };
      }
      if (full && request.auth?.permissions.includes(read)) return result;
      return { data: budgetMutationReceipt(result.data) };
    }));
  }
}
