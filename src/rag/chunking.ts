export interface Chunk {
  index: number;
  content: string;
}

export interface ChunkingOptions {
  maxChars?: number;
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 800;
const DEFAULT_OVERLAP_CHARS = 80;

export function chunkMarkdown(
  markdown: string,
  options: ChunkingOptions = {},
): Chunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const step = Math.max(maxChars - overlapChars, 1);

  const sections = markdown
    .split(/\n(?=#{1,6}\s)/)
    .filter((section) => section.trim().length > 0);

  const chunks: Chunk[] = [];
  let index = 0;

  for (const section of sections) {
    if (section.length <= maxChars) {
      chunks.push({ index: index++, content: section });
      continue;
    }

    for (let offset = 0; offset < section.length; offset += step) {
      const isLast = offset + maxChars >= section.length;
      let content = section.slice(offset, offset + maxChars);

      if (!isLast) {
        const boundary = content.lastIndexOf(' ');
        if (boundary > maxChars - overlapChars) {
          content = content.slice(0, boundary);
        }
      }

      const trimmed = content.trim();
      if (trimmed.length > 0) {
        chunks.push({ index: index++, content: trimmed });
      }
    }
  }

  return chunks;
}
