import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';
import { AI_PROVIDER } from './providers/ai-provider.interface.js';
import { MockProvider } from './providers/mock.provider.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.provider.js';

const providerFactory = {
  provide: AI_PROVIDER,
  useFactory: () => {
    const mode = process.env.AI_PROVIDER ?? 'mock';
    if (mode === 'mock') return new MockProvider();
    return new OpenAICompatibleProvider();
  },
};

@Module({
  controllers: [AiController],
  providers: [AiService, providerFactory],
  exports: [AiService],
})
export class AiModule {}
