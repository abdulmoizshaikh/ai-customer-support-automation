import type { TicketClassification } from '../types/ticket-classification.js';

export interface AIProvider {
  classifyTicket(message: string): Promise<TicketClassification>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
