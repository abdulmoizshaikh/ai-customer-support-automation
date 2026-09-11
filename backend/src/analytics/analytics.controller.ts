import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('analytics')
@Roles(Role.AGENT, Role.ADMIN)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  overview() {
    return this.analytics.overview();
  }
}
