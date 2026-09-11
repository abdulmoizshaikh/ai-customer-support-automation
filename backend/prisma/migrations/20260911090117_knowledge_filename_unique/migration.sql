-- AlterTable
-- Add unique index on KnowledgeDocument.filename (raw SQL, non-interactive apply)
CREATE UNIQUE INDEX "KnowledgeDocument_filename_key" ON "KnowledgeDocument"("filename");