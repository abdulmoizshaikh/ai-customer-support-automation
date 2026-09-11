import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { ApprovalsService } from './approvals.service.js';
import { ApprovalActionDto } from './dto/approval-action.dto.js';

@Controller('approvals')
@Roles(Role.AGENT, Role.ADMIN)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.approvals.list(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.approvals.approve(id, user.email);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvals.reject(id, user.email, dto.reason);
  }
}
