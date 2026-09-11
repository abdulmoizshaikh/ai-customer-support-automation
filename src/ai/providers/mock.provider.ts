import { Injectable } from '@nestjs/common';
import { AIProvider } from './ai-provider.interface.js';
import type { TicketClassification } from '../types/ticket-classification.js';

@Injectable()
export class MockProvider implements AIProvider {
  async classifyTicket(message: string): Promise<TicketClassification> {
    const lower = message.toLowerCase();
    const orderIdMatch = message.match(/#?(\d{3,})/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    let intent: TicketClassification['intent'] = 'other';
    let priority: TicketClassification['priority'] = 'low';
    let confidence = 0.5;

    if (
      lower.includes('refund') ||
      lower.includes('damaged') ||
      lower.includes('broken')
    ) {
      intent =
        lower.includes('damaged') || lower.includes('broken')
          ? 'damaged_order'
          : 'refund';
      priority = 'high';
      confidence = 0.95;
    } else if (lower.includes('where') && lower.includes('order')) {
      intent = 'order_status';
      priority = 'medium';
      confidence = 0.9;
    } else if (lower.includes('cancel')) {
      intent = 'cancel_order';
      priority = 'medium';
      confidence = 0.9;
    } else if (lower.includes('error') || lower.includes('bug')) {
      intent = 'technical_issue';
      priority = 'medium';
      confidence = 0.85;
    }

    return { intent, orderId, priority, confidence };
  }
}
