import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { activeProjectVariationValue, sumCostControlDecimals } from '../cost-control/cost-control.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { persistedBudgetActor, PROJECT_SUMMARY_VIEW } from './budget-disclosure';

export { PROJECT_SUMMARY_VIEW } from './budget-disclosure';

@Injectable()
export class ProjectSummaryService {
  constructor(private readonly prisma: PrismaService, private readonly access: ProjectAccessService) {}

  private read<T>(supplied: AuthenticatedUserContext, action: (tx: Prisma.TransactionClient, auth: AuthenticatedUserContext) => Promise<T>) {
    return this.prisma.$transaction(async tx => {
      const auth = await persistedBudgetActor(tx, supplied);
      if (!auth.permissions.includes(PROJECT_SUMMARY_VIEW)) throw new ForbiddenException({code:'PROJECT_SUMMARY_PERMISSION_DENIED',detail:'Explicit Project summary read authority is required.'});
      return action(tx, auth);
    }, {isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }

  projects(auth: AuthenticatedUserContext) {
    return this.read(auth, async (tx, actor) => tx.project.findMany({
      where:{AND:[await this.access.scopeWhere(actor,tx),{isActive:true}]},
      select:{id:true,projectCode:true,projectName:true}, orderBy:[{projectCode:'asc'},{id:'asc'}],
    }));
  }

  summary(auth: AuthenticatedUserContext, projectId: string) {
    return this.read(auth, async (tx,actor) => {
      await this.access.assertAccess(actor, projectId, tx);
      const project = await tx.project.findFirst({where:{id:projectId,companyId:actor.companyId},
        select:{id:true,projectCode:true,projectName:true,contractValue:true,contractCurrencyCode:true}});
      if (!project) throw new NotFoundException({code:'PROJECT_NOT_FOUND',detail:'Project not found.'});
      const company = await tx.company.findUniqueOrThrow({where:{id:actor.companyId},select:{baseCurrencyCode:true}});
      const scope={companyId:actor.companyId,projectId,state:'APPROVED'};
      const [variations,invoices,payments] = await Promise.all([
        tx.projectVariation.findMany({where:scope,select:{id:true,valueDelta:true,reversesVariationId:true,currencyCode:true}}),
        tx.clientInvoice.findMany({where:scope,select:{totalAmount:true,currencyCode:true}}),
        tx.payment.findMany({where:{...scope,paymentDirection:'INBOUND',cancelledAt:null},select:{amount:true,currencyCode:true}}),
      ]);
      const currency=project.contractCurrencyCode;
      // No denomination inference, silent exclusions or conversion of old sources.
      if (!currency || currency!==company.baseCurrencyCode || [...variations,...invoices,...payments].some(row=>row.currencyCode!==currency)) {
        throw new UnprocessableEntityException({code:'PROJECT_SUMMARY_CURRENCY_UNVERIFIED',detail:'Source currencies must match the recorded Project and Company currency; no conversion is performed.'});
      }
      // Reuse the canonical reversal and exact-sum semantics. This is a read
      // projection, with no BOQ, invoice lines, allocations, cost or profit graph.
      return {
        project:{id:project.id,projectCode:project.projectCode,projectName:project.projectName}, currencyCode:currency,
        contractAmount:sumCostControlDecimals([project.contractValue,activeProjectVariationValue(variations)]).toFixed(2),
        billedAmount:sumCostControlDecimals(invoices.map(row=>row.totalAmount)).toFixed(2),
        receivedAmount:sumCostControlDecimals(payments.map(row=>row.amount)).toFixed(2),
      };
    });
  }
}
