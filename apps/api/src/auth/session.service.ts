import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUserContext } from './auth.types';
import { randomOpaqueToken, sha256Hex } from './crypto.util';

const DEFAULT_SESSION_TTL_HOURS = 8;
const MAX_SESSION_TTL_HOURS = 168;

function sessionTtlHours(): number {
  const raw = process.env.SESSION_TTL_HOURS;
  if (!raw) return DEFAULT_SESSION_TTL_HOURS;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_SESSION_TTL_HOURS) {
    throw new Error(
      `SESSION_TTL_HOURS must be an integer from 1 to ${MAX_SESSION_TTL_HOURS}.`,
    );
  }
  return value;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string): Promise<{
    sessionId: string;
    sessionToken: string;
    csrfToken: string;
    expiresAt: Date;
  }> {
    const sessionToken = randomOpaqueToken();
    const csrfToken = randomOpaqueToken();
    const expiresAt = new Date(
      Date.now() + sessionTtlHours() * 60 * 60 * 1000,
    );

    const session = await this.prisma.userSession.create({
      data: {
        userId,
        tokenHash: sha256Hex(sessionToken),
        csrfTokenHash: sha256Hex(csrfToken),
        expiresAt,
      },
      select: { id: true },
    });

    return {
      sessionId: session.id,
      sessionToken,
      csrfToken,
      expiresAt,
    };
  }

  async resolve(sessionToken: string): Promise<AuthenticatedUserContext | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash: sha256Hex(sessionToken) },
      include: {
        user: {
          include: {
            company: true,
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      !session.user.isActive ||
      !session.user.company.isActive
    ) {
      return null;
    }

    const activeRoles = session.user.userRoles
      .map((assignment) => assignment.role)
      .filter((role) => role.isActive);

    const roleCodes = [...new Set(activeRoles.map((role) => role.roleCode))].sort();
    const permissions = [
      ...new Set(
        activeRoles.flatMap((role) =>
          role.rolePermissions.map((item) => item.permission.permissionCode),
        ),
      ),
    ].sort();

    return {
      sessionId: session.id,
      userId: session.user.id,
      companyId: session.user.companyId,
      email: session.user.email,
      displayName: session.user.displayName,
      roleCodes,
      permissions,
      csrfTokenHash: session.csrfTokenHash,
    };
  }

  async rotateCsrfToken(sessionId: string): Promise<string> {
    const csrfToken = randomOpaqueToken();
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { csrfTokenHash: sha256Hex(csrfToken) },
    });
    return csrfToken;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
