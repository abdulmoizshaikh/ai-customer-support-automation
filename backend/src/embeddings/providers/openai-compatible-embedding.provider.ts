import { Injectable, Logger } from '@nestjs/common';
import {
  EmbeddingProvider,
  Embedding,
} from './embedding-provider.interface.js';

@Injectable()
export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(OpenAICompatibleEmbeddingProvider.name);
  private readonly baseUrl =
    process.env.AI_BASE_URL ?? 'http://localhost:11434/v1';
  private readonly apiKey = process.env.AI_API_KEY ?? 'ollama';
  private readonly model = process.env.AI_EMBED_MODEL ?? 'nomic-embed-text';
  readonly dimensions = Number(process.env.EMBEDDING_DIMS ?? 768);

  async embed(texts: string[]): Promise<Embedding[]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Embedding provider error ${res.status}: ${body}`);
      throw new Error(`Embedding provider returned ${res.status}`);
    }

    const json = (await res.json()) as { data: { embedding: Embedding }[] };
    if (!Array.isArray(json.data) || json.data.length !== texts.length) {
      throw new Error('Embedding provider returned unexpected response shape');
    }
    return json.data.map((entry) => entry.embedding);
  }
}
