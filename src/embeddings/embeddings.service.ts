import { Inject, Injectable, Logger } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from './providers/embedding-provider.interface.js';
import type { EmbeddingProvider } from './providers/embedding-provider.interface.js';
import type { Embedding } from './providers/embedding-provider.interface.js';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(
    @Inject(EMBEDDING_PROVIDER) private readonly provider: EmbeddingProvider,
  ) {}

  get dimensions(): number {
    return this.provider.dimensions;
  }

  async embed(text: string): Promise<Embedding> {
    const [vector] = await this.embedMany([text]);
    return vector;
  }

  async embedMany(texts: string[]): Promise<Embedding[]> {
    this.logger.debug(`Embedding ${texts.length} text(s)`);
    const vectors = await this.provider.embed(texts);
    vectors.forEach((vector, i) => {
      if (vector.length !== this.provider.dimensions) {
        throw new Error(
          `Embedding[${i}] has ${vector.length} dims, expected ${this.provider.dimensions}`,
        );
      }
    });
    return vectors;
  }
}
