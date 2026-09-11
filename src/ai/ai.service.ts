import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_PROVIDER } from './providers/ai-provider.interface.js';
import type { AIProvider } from './providers/ai-provider.interface.js';
import type { TicketClassification } from './types/ticket-classification.js';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  constructor(@Inject(AI_PROVIDER) private readonly provider: AIProvider) {}

  async classifyTicket(message: string): Promise<TicketClassification> {
    this.logger.debug(`Classifying: ${message.slice(0, 80)}`);
    return this.provider.classifyTicket(message);
  }
}
