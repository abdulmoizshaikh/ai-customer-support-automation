import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { RagService } from './rag.service.js';
import { RagController } from './rag.controller.js';

@Module({
  imports: [EmbeddingsModule],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
