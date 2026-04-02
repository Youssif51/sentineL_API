import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventType } from '@prisma/client';

export interface LogEventDto {
  event_type: SecurityEventType;
  user_id?: string;
  ip: string;
  user_agent?: string;
}

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(private prisma: PrismaService) {}

  log(dto: LogEventDto): void {
    this.prisma.securityEvent
      .create({ data: dto })
      .catch((err: Error) => this.logger.error('Failed to log security event', err.message));
  }

  async getRecentEvents(userId: string, limit = 20) {
    return this.prisma.securityEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
