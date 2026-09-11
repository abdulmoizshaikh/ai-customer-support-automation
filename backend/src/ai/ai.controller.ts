import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { AiService } from './ai.service.js';
import { ClassifyTicketDto } from './dto/classify-ticket.dto.js';

@Controller('ai')
@Public() // public: dev/test endpoint, no auth required
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('classify')
  async classify(@Body() dto: ClassifyTicketDto) {
    return this.ai.classifyTicket(dto.message);
  }
}
