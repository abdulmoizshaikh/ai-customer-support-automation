import { Injectable, Logger } from '@nestjs/common';
import { AIProvider, ResponseContext } from './ai-provider.interface.js';
import {
  TicketClassification,
  TicketClassificationSchema,
} from '../types/ticket-classification.js';

@Injectable()
export class OpenAICompatibleProvider implements AIProvider {
  private readonly logger = new Logger(OpenAICompatibleProvider.name);
  private readonly baseUrl =
    process.env.AI_BASE_URL ?? 'http://localhost:11434/v1';
  private readonly apiKey = process.env.AI_API_KEY ?? 'ollama';
  private readonly model = process.env.AI_CHAT_MODEL ?? 'qwen2.5:7b';

  async classifyTicket(message: string): Promise<TicketClassification> {
    const systemPrompt = `You are a customer support ticket classifier. Return ONLY valid JSON matching this schema:
{"intent": "refund|order_status|damaged_order|cancel_order|technical_issue|other", "orderId": "string or null", "priority": "low|medium|high", "confidence": 0.0-1.0}
Extract the order ID from the message if present (e.g. #123 → "123"). No prose, no markdown, JSON only.`;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`AI provider error ${res.status}: ${body}`);
      throw new Error(`AI provider returned ${res.status}`);
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = json.choices[0]?.message?.content ?? '{}';

    const parsed = TicketClassificationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      this.logger.error(
        `Invalid classification: ${JSON.stringify(parsed.error.flatten())}`,
      );
      throw new Error('AI returned invalid classification shape');
    }
    return parsed.data;
  }

  async generateCustomerResponse(context: ResponseContext): Promise<string> {
    const policyBlock = context.policyChunks
      .map((chunk) => `--- ${chunk.filename} ---\n${chunk.content}`)
      .join('\n\n');
    const orderLine = context.order
      ? `Order ${context.order.id} (${context.order.status}, $${context.order.amount.toFixed(2)})`
      : 'No order referenced.';
    const decisionLine =
      `Decision: ${context.decision.action}` +
      (context.decision.amount !== null
        ? ` for $${context.decision.amount.toFixed(2)}`
        : '') +
      ` — ${context.decision.reason}`;

    const systemPrompt =
      'You are a customer support agent. Write a short, friendly reply (2-3 sentences) based on the decision and policy context provided. Do not invent facts. Do not promise anything beyond the decision.';

    const userMessage = [
      `Customer message: ${context.message}`,
      orderLine,
      decisionLine,
      policyBlock ? `Policy context:\n${policyBlock}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`AI provider error ${res.status}: ${body}`);
      throw new Error(`AI provider returned ${res.status}`);
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return (json.choices[0]?.message?.content ?? '').trim();
  }
}
