import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { TicketService } from './ticket.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';

@Controller('tickets')
@Public() // public: customer-facing ticket submission and readback
export class TicketController {
  constructor(private readonly tickets: TicketService) {}

  @Post()
  create(@Body() dto: CreateTicketDto) {
    return this.tickets.processTicket(dto.message, dto.customerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tickets.findById(id);
  }

  @Get()
  findAll() {
    return this.tickets.findAll();
  }
}
