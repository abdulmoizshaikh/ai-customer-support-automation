import type { TicketClassification } from '../types/ticket-classification.js';

export interface ResponseContext {
  message: string;
  decision: { action: string; amount: number | null; reason: string };
  order: { id: string; amount: number; status: string } | null;
  policyChunks: { filename: string; content: string }[];
}

export interface AIProvider {
  classifyTicket(message: string): Promise<TicketClassification>;
  generateCustomerResponse(context: ResponseContext): Promise<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
