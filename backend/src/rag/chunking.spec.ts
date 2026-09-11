import { describe, expect, it } from 'vitest';
import { chunkMarkdown } from './chunking.js';

describe('chunkMarkdown', () => {
  it('returns [] for an empty string', () => {
    expect(chunkMarkdown('')).toEqual([]);
  });

  it('returns a single chunk with index 0 for a short section', () => {
    const chunks = chunkMarkdown('# Refund Policy\n\nBody text.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      index: 0,
      content: '# Refund Policy\n\nBody text.',
    });
  });

  it('creates one chunk per markdown heading section', () => {
    const doc = [
      '# One',
      'first body',
      '## Two',
      'second body',
      '### Three',
      'third body',
    ].join('\n\n');
    const chunks = chunkMarkdown(doc);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(chunks[0].content).toContain('# One');
    expect(chunks[2].content).toContain('### Three');
  });

  it('splits content exceeding maxChars into multiple bounded chunks', () => {
    const longBody = 'The quick brown fox jumps over the lazy dog. '.repeat(60);
    const chunks = chunkMarkdown(longBody);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(800);
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps windowed overlap between adjacent chunks', () => {
    const longBody = 'x'.repeat(2500);
    const chunks = chunkMarkdown(longBody);
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(
        chunks[i + 1].content.startsWith(chunks[i].content.slice(-80)),
      ).toBe(true);
    }
  });

  it('produces strictly increasing, unique indices', () => {
    const longBody = 'The quick brown fox jumps over the lazy dog. '.repeat(60);
    const chunks = chunkMarkdown(longBody);
    const indices = chunks.map((c) => c.index);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('skips whitespace-only sections', () => {
    expect(chunkMarkdown('  \n\n   \n\t')).toEqual([]);
    const chunks = chunkMarkdown('\n\n   \n# Heading\n\nBody');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content.startsWith('# Heading')).toBe(true);
  });

  it('chunks a real seeded markdown document without empty chunks', () => {
    const seededDoc =
      '# Damaged Orders\n\nIf an order arrives damaged, customers must report it within 7 days of delivery.\nEligible customers receive a full refund or a free replacement.\nDamaged orders above $500 require human approval.';
    const chunks = chunkMarkdown(seededDoc);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(50);
    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });
});
