import { Injectable, Logger } from '@nestjs/common';
import { AIProvider } from './ai-provider.interface.js';
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
}
