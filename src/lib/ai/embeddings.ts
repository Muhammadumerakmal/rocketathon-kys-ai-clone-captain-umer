import "server-only";
import { models, openaiClient } from "./models";

export const EMBEDDING_DIMS = 1536;

/** text-embedding-3-small, 1536 dims (plan §4). Returns null on failure so FTS still works. */
export async function embed(text: string): Promise<number[] | null> {
  try {
    const res = await openaiClient().embeddings.create({
      model: models.embedding,
      input: text.slice(0, 8000),
      dimensions: EMBEDDING_DIMS,
    });
    return res.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn("[embed] failed, falling back to full-text only", err instanceof Error ? err.message : err);
    return null;
  }
}
