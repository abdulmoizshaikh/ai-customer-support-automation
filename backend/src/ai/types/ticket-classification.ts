import { z } from 'zod';

export const IntentEnum = z.enum([
  'refund',
  'order_status',
  'damaged_order',
  'cancel_order',
  'technical_issue',
  'other',
]);

export const PriorityEnum = z.enum(['low', 'medium', 'high']);

export const TicketClassificationSchema = z.object({
  intent: IntentEnum,
  orderId: z.string().nullable(),
  priority: PriorityEnum,
  confidence: z.number().min(0).max(1),
});

export type TicketClassification = z.infer<typeof TicketClassificationSchema>;
export type Intent = z.infer<typeof IntentEnum>;
export type Priority = z.infer<typeof PriorityEnum>;
