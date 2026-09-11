import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminService } from './admin.service.js';
import { SeedTestOrderDto } from './dto/seed-test-order.dto.js';

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('seed-test-order')
  seedTestOrder(@Body() dto: SeedTestOrderDto = {}) {
    return this.adminService.seedTestOrder(dto);
  }
}
