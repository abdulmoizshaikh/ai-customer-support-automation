import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { TicketService } from './ticket.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';

@Controller('tickets')
export class TicketController {
  constructor(private readonly tickets: TicketService) {}

  @Post()
  @Public() // public: customer-facing ticket submission and readback
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  create(@Body() dto: CreateTicketDto) {
    return this.tickets.processTicket(dto.message, dto.customerId);
  }

  @Post(':id/retry')
  @Roles(Role.ADMIN)
  retry(@Param('id') id: string) {
    return this.tickets.retryFailedTicket(id);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.tickets.findById(id);
  }

  @Get()
  @Public()
  findAll() {
    return this.tickets.findAll();
  }
}
