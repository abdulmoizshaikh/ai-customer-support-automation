-- AlterTable (pgvector dimension reconciled to nomic-embed-text: 768)
ALTER TABLE "KnowledgeChunk" ALTER COLUMN "embedding" TYPE vector(768);