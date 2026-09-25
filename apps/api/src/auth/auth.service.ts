import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async login(email: string, password: string): Promise<{
    sessionToken: string;
    csrfToken: string;
    expiresAt: Date;
    user: {
      id: string;
      companyId: string;
      email: string;
      displayName: string;
    };
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        isActive: true,
        company: { isActive: true },
      },
    });

    const valid =
      user !== null && (await this.passwords.verify(password, user.passwordHash));

    if (!user || !valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        detail: 'Email or password is invalid.',
      });
    }

    const session = await this.sessions.create(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      sessionToken: session.sessionToken,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }
}
