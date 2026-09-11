import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service.js';
import { EMBEDDING_PROVIDER } from './providers/embedding-provider.interface.js';
import { MockEmbeddingProvider } from './providers/mock-embedding.provider.js';
import { OpenAICompatibleEmbeddingProvider } from './providers/openai-compatible-embedding.provider.js';

const embeddingProviderFactory = {
  provide: EMBEDDING_PROVIDER,
  useFactory: () => {
    const mode = process.env.EMBEDDING_PROVIDER ?? 'mock';
    if (mode === 'mock') return new MockEmbeddingProvider();
    return new OpenAICompatibleEmbeddingProvider();
  },
};

@Module({
  providers: [EmbeddingsService, embeddingProviderFactory],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
