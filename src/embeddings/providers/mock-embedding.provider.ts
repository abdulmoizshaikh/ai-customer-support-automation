import { Injectable } from '@nestjs/common';
import {
  EmbeddingProvider,
  Embedding,
} from './embedding-provider.interface.js';

@Injectable()
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = Number(process.env.EMBEDDING_DIMS ?? 768);
  private static readonly HASHES_PER_TOKEN = 4;

  async embed(texts: string[]): Promise<Embedding[]> {
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): Embedding {
    const vector = Array.from({ length: this.dimensions }, () => 0);

    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const token of tokens) {
      for (let h = 0; h < MockEmbeddingProvider.HASHES_PER_TOKEN; h++) {
        vector[this.hash(`${token}:${h}`) % this.dimensions] += 1;
      }
    }

    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / magnitude);
  }

  private hash(input: string): number {
    let value = 0;
    for (let i = 0; i < input.length; i++) {
      value = (value * 31 + input.charCodeAt(i)) >>> 0;
    }
    return value;
  }
}
