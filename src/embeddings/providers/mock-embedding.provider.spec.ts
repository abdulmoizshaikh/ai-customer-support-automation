import { describe, expect, it } from 'vitest';
import { MockEmbeddingProvider } from './mock-embedding.provider.js';

describe('MockEmbeddingProvider', () => {
  const provider = new MockEmbeddingProvider();

  it('returns one vector per input text', async () => {
    const result = await provider.embed(['alpha', 'beta', 'gamma']);
    expect(result).toHaveLength(3);
  });

  it('returns vectors matching the configured dimensions', async () => {
    const [vector] = await provider.embed(['hello']);
    expect(vector).toHaveLength(provider.dimensions);
  });

  it('is deterministic for the same input', async () => {
    const [first] = await provider.embed(['refund policy']);
    const [second] = await provider.embed(['refund policy']);
    expect(second).toEqual(first);
  });

  it('produces distinct vectors for different inputs', async () => {
    const [refund] = await provider.embed(['refund policy']);
    const [shipping] = await provider.embed(['shipping policy']);
    expect(shipping).not.toEqual(refund);
  });

  it('returns unit-length normalized vectors', async () => {
    const [vector] = await provider.embed(['damaged order refund']);
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });
});
