export type Embedding = number[];

export interface EmbeddingProvider {
  readonly dimensions: number;
  embed(texts: string[]): Promise<Embedding[]>;
}

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
