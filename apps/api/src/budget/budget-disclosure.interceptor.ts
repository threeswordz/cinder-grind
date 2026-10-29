import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import { AuthenticatedRequest } from '../auth/auth.types';
import { budgetMutationReceipt } from './budget-disclosure';

@Injectable()
export class BudgetDisclosureInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { method: string; url: string }>();
    // Only the route pathname selects a disclosure authority, never query text.
    const pathname = request.url.split('?', 1)[0] ?? '';
    const read = /\/revisions(?:\/|$)/i.test(pathname) ? 'budget.revision.view' : 'budget.boq.view';
    return next.handle().pipe(map((result: { data: unknown }) => {
      if (request.method === 'GET' || request.auth?.permissions.includes(read)) return result;
      return { data: budgetMutationReceipt(result.data) };
    }));
  }
}
