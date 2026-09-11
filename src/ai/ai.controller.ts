import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { ClassifyTicketDto } from './dto/classify-ticket.dto.js';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('classify')
  async classify(@Body() dto: ClassifyTicketDto) {
    return this.ai.classifyTicket(dto.message);
  }
}
