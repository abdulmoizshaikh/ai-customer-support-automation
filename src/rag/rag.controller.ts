import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RagService } from './rag.service.js';
import { IngestDocumentDto } from './dto/ingest-document.dto.js';

@Controller('knowledge')
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Post()
  ingest(@Body() dto: IngestDocumentDto) {
    return this.rag.ingestDocument(dto.filename, dto.content);
  }

  @Get('search')
  search(@Query('q') q: string, @Query('topK') topK?: string) {
    const k = topK ? Math.min(Math.max(parseInt(topK, 10) || 3, 1), 20) : 3;
    return this.rag.searchKnowledge(q, k);
  }
}
