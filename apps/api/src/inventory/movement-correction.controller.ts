import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { inventoryInvalid, inventoryObject, requiredInventoryString } from './inventory-validation';
import { type MovementKind } from './movement-correction-authority';
import { MovementCorrectionService } from './movement-correction.service';

function context(request: AuthenticatedRequest) {
  if (!request.auth) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
  return { auth: request.auth, ...(request.correlationId ? { correlationId: request.correlationId } : {}) };
}
function sourceKind(value: string): MovementKind {
  switch (value) {
    case 'GOODS_RECEIPT':
    case 'MATERIAL_ISSUE':
    case 'MATERIAL_RETURN':
    case 'STOCK_TRANSFER': return value;
    default: return inventoryInvalid('kind', 'Unknown inventory movement kind.');
  }
}

@Controller('inventory/movement-corrections')
export class MovementCorrectionController {
  constructor(private readonly corrections: MovementCorrectionService) {}

  // The service enforces live, source-specific, same-role permissions and
  // Project membership, not a caller-provided Company, actor, or workflow.
  @Post('sources/:kind/:id/requests')
  @UseGuards(AuthGuard, CsrfGuard)
  async request(
    @Req() request: AuthenticatedRequest,
    @Param('kind') kind: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return { data: await this.corrections.request(context(request), sourceKind(kind), id,
      requiredInventoryString(input, 'requestKey', 120), requiredInventoryString(input, 'reason', 1000)) };
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard, CsrfGuard)
  async approve(@Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: unknown) {
    return { data: await this.corrections.decide(context(request), id, 'APPROVE',
      requiredInventoryString(inventoryObject(body), 'comment', 1000)) };
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard, CsrfGuard)
  async reject(@Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: unknown) {
    return { data: await this.corrections.decide(context(request), id, 'REJECT',
      requiredInventoryString(inventoryObject(body), 'comment', 1000)) };
  }
}
