import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateRefundDto } from './dto/create-refund.dto.js';
import { RefundsService } from './refunds.service.js';

@Controller('refunds')
@Roles(Role.AGENT, Role.ADMIN)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  create(@Body() dto: CreateRefundDto) {
    return this.refundsService.create(dto);
  }

  @Get()
  findAll() {
    return this.refundsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.refundsService.findOne(id);
  }
}