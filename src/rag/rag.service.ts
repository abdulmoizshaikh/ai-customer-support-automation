import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { chunkMarkdown } from './chunking.js';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async ingestDocument(filename: string, content: string) {
    // POST /knowledge with an existing filename replaces that document and its
    // chunks. Re-ingesting is idempotent by filename.
    const document = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeDocument.findUnique({
        where: { filename },
      });
      if (existing) {
        await tx.knowledgeDocument.delete({ where: { id: existing.id } });
      }
      return tx.knowledgeDocument.create({
        data: {
          title: this.deriveTitle(content, filename),
          filename,
          content,
        },
      });
    });

    this.logger.debug(`Ingesting "${filename}" as document ${document.id}`);

    const chunks = chunkMarkdown(content);
    const vectors = await this.embeddings.embedMany(
      chunks.map((chunk) => chunk.content),
    );

    for (let i = 0; i < chunks.length; i++) {
      const vectorLiteral = `[${vectors[i].join(',')}]`;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunk" (id, "documentId", index, content, embedding, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::vector, NOW())`,
        document.id,
        chunks[i].index,
        chunks[i].content,
        vectorLiteral,
      );
    }

    return { documentId: document.id, chunkCount: chunks.length };
  }

  async searchKnowledge(query: string, topK = 3) {
    const vector = await this.embeddings.embed(query);
    const vectorLiteral = `[${vector.join(',')}]`;

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT kc.content,
              kc.index,
              kd.title,
              kd.filename,
              (1 - (kc.embedding <=> $1::vector)) AS score
         FROM "KnowledgeChunk" kc
         JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
        WHERE kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> $1::vector ASC
        LIMIT $2`,
      vectorLiteral,
      topK,
    )) as {
      content: string;
      index: number;
      title: string;
      filename: string;
      score: number;
    }[];

    return rows.map((row) => ({
      content: row.content,
      index: row.index,
      title: row.title,
      filename: row.filename,
      score: Number(row.score),
    }));
  }

  private deriveTitle(content: string, filename: string): string {
    const h1 = content.match(/^#\s+(.+)$/m);
    return h1 ? h1[1].trim() : filename;
  }
}
