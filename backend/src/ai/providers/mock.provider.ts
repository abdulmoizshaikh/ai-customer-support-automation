import { Injectable } from '@nestjs/common';
import { AIProvider, ResponseContext } from './ai-provider.interface.js';
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

  async generateCustomerResponse(context: ResponseContext): Promise<string> {
    const { decision } = context;
    const amount =
      decision.amount !== null ? `$${decision.amount.toFixed(2)}` : '';

    switch (decision.action) {
      case 'AUTO_REFUND':
        return `Good news — your refund of ${amount} has been approved and is processing.`;
      case 'REQUEST_HUMAN_APPROVAL':
        return 'Your request has been received. Because of the amount, a support specialist will review it shortly.';
      case 'REJECT_REFUND':
        return `We're unable to process a refund for this order. Reason: ${decision.reason}.`;
      case 'ORDER_NOT_FOUND':
        return "We couldn't find an order matching your message. Please reply with your order number.";
      case 'NEEDS_HUMAN_REVIEW':
        return 'Thanks for reaching out. A support specialist will review your request shortly.';
      case 'NO_ACTION':
        return 'Thanks for your message. A support specialist will follow up shortly.';
      default:
        return 'Thanks for your message. A support specialist will follow up shortly.';
    }
  }
}
