
import { Property, Customer, KnowledgeDoc, KeyRecord } from '../types';
import { dbGetAll, dbSet } from '../utils';

// Singleton for the embedding pipeline to avoid reloading
let embeddingPipeline: any = null;
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

// Simple in-memory cache for embeddings to avoid re-computation
// Key: ID + UpdatedAt timestamp, Value: number[] (embedding)
const embeddingCache: Record<string, number[]> = {};

// Migrate from localStorage if exists (one-time)
const migrateFromLocalStorage = async () => {
    try {
        const saved = localStorage.getItem('mh_embedding_cache');
        if (saved) {
            const data = JSON.parse(saved);
            const promises = Object.entries(data).map(([key, vector]) => {
                return dbSet('embeddings', { key, vector });
            });
            await Promise.all(promises);
            localStorage.removeItem('mh_embedding_cache'); // Cleanup
            console.log("Migrated embeddings to IndexedDB");
        }
    } catch (e) {
        console.warn('Migration failed', e);
    }
};

// Load cache from IndexedDB on init
const loadCache = async () => {
    try {
        await migrateFromLocalStorage();
        const records = await dbGetAll('embeddings');
        if (Array.isArray(records)) {
            records.forEach((record: any) => {
                if (record.key && record.vector) {
                    embeddingCache[record.key] = record.vector;
                }
            });
        }
    } catch (e) {
        console.warn('Failed to load embedding cache from IDB', e);
    }
};

// Start loading immediately
loadCache();

/**
 * Lazy load the Transformer pipeline
 */
const getPipeline = async () => {
    if (embeddingPipeline) return embeddingPipeline;
    
    // Dynamic import from CDN for browser compatibility
    // @ts-ignore
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0');
    
    embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME, {
        quantized: true, // Use quantized model for smaller size
    });
    return embeddingPipeline;
};

/**
 * Generate embedding for a text string.
 */
const getEmbedding = async (text: string): Promise<number[]> => {
    if (!text || !text.trim()) return [];
    try {
        const pipe = await getPipeline();
        const output = await pipe(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    } catch (e) {
        console.error("Embedding generation failed", e);
        return [];
    }
};

/**
 * Calculate Cosine Similarity between two vectors
 */
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
    }
    // Vectors are already normalized by the pipeline, so dot product is cosine similarity
    return dot;
};

/**
 * Get or Create embedding for an item, using cache
 */
const getItemEmbedding = async (id: string, text: string, updatedAt: number): Promise<number[]> => {
    const cacheKey = `${id}_${updatedAt}`;
    
    // 1. Check Memory Cache
    if (embeddingCache[cacheKey]) return embeddingCache[cacheKey];
    
    // 2. Check if we have old version in memory to cleanup (optional optimization)
    // Actually, let's clean up old versions from IDB for this ID
    // We don't have an easy way to query "startsWith" in basic IDB KeyValue, 
    // but we can do lazy cleanup or just let it grow (it's small per item).
    
    // 3. Generate new
    const embedding = await getEmbedding(text);
    
    if (embedding.length > 0) {
        // Update Memory
        embeddingCache[cacheKey] = embedding;
        // Update Disk (Async, fire and forget)
        dbSet('embeddings', { key: cacheKey, vector: embedding }).catch(console.error);
    }
    return embedding;
};

/**
 * Client-side Hybrid RAG: Retrieves relevant context using Vector Search + Keyword Search
 */
export const retrieveRelevantContext = async (
  query: string, 
  properties: Property[], 
  customers: Customer[], 
  limit: number = 20,
  knowledgeDocs: KnowledgeDoc[] = [],
  keys: KeyRecord[] = []
) => {
  if (!query || !query.trim()) return { props: [], custs: [], docs: [], keys: [] };

  // 1. Keyword Scoring (Lexical Search)
  const tokens = query.toLowerCase().split(/[\s,，.。?？]+/).filter(t => t.length > 0);
  
  const scoreKeyword = (text: string) => {
      let score = 0;
      const lowerText = text.toLowerCase();
      tokens.forEach(token => {
          if (lowerText.includes(token)) score += 1;
      });
      return score;
  };

  // 2. Vector Scoring (Semantic Search)
  // We only run vector search if the query is long enough to be semantic, otherwise keyword is faster/better
  let queryEmbedding: number[] = [];
  const useVector = tokens.length > 1 || query.length > 5;
  
  if (useVector) {
      try {
          queryEmbedding = await getEmbedding(query);
      } catch (e) {
          console.warn("Vector search unavailable, falling back to keyword only.");
      }
  }

  // Helper to process a list
  const rankItems = async <T extends { id: string, updatedAt: number }>(
      items: T[], 
      textFn: (item: T) => string, 
      typeWeight: number = 1
  ) => {
      const scoredItems = await Promise.all(items.map(async (item) => {
          const text = textFn(item);
          
          // Lexical Score
          const lexicalScore = scoreKeyword(text);
          
          // Semantic Score
          let semanticScore = 0;
          if (useVector && queryEmbedding.length > 0) {
              const itemVec = await getItemEmbedding(item.id, text, item.updatedAt || 0);
              semanticScore = cosineSimilarity(queryEmbedding, itemVec);
          }

          // Hybrid Score (Weighted)
          // Semantic score is usually 0.0-1.0. Lexical is integer count.
          // We normalize lexical slightly or just weight semantic heavily.
          const finalScore = (lexicalScore * 0.3) + (semanticScore * 10);
          
          return { item, score: finalScore };
      }));

      return scoredItems
          .filter(r => r.score > 0.45) // Slightly increased threshold
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(r => r.item);
  };

  const [rankedProps, rankedCusts, rankedDocs, rankedKeys] = await Promise.all([
      rankItems(properties, p => `${p.garden} ${p.subArea||''} ${p.building} ${p.unit||''} ${p.room} ${p.layout} ${p.floor}层 ${p.ownerName} ${p.features?.join(' ')||''} ${p.remarks||''}`),
      rankItems(customers, c => `${c.name} ${c.phone} ${c.reqGardens?.join(' ')||''} ${c.notes||''} ${c.type==='buy'?'买':'租'}`),
      rankItems(knowledgeDocs, d => `${d.title} ${d.content} ${d.tags?.join(' ')||''}`),
      rankItems(keys, k => `${k.keyNo} ${k.garden} ${k.roomNo} ${k.borrower||''} ${k.borrowReason||''} ${k.status==='borrowed'?'借出':'在库'}`)
  ]);

  return {
      props: rankedProps,
      custs: rankedCusts,
      docs: rankedDocs,
      keys: rankedKeys
  };
};

/**
 * Formats the retrieved data into a string optimized for LLM system prompts.
 */
export const formatContextForPrompt = (props: Property[], custs: Customer[], docs: KnowledgeDoc[] = [], keys: KeyRecord[] = []) => {
    let result = '';

    if (docs.length > 0) {
        result += `[Relevant Knowledge Base Documents]:\n`;
        result += docs.map(d => 
            `--- DOCUMENT: ${d.title} ---\n${d.content.slice(0, 1000)}${d.content.length > 1000 ? '...' : ''}\n----------------------------`
        ).join('\n\n') + '\n\n';
    }

    if (props.length > 0) {
        result += `[Relevant Properties (Top matches)]:\n`;
        result += props.map(p => 
            `- ID:${p.id} | ${p.garden} ${p.subArea||''} ${p.building} ${p.unit||''} ${p.room} | ${p.layout} ${p.area}㎡ | ${p.isSale ? `售${p.salePrice}万` : `租${p.rentPrice}`} | 业主:${p.ownerName} | 状态:${p.status}`
        ).join('\n') + '\n\n';
    }

    if (custs.length > 0) {
        result += `[Relevant Customers (Top matches)]:\n`;
        result += custs.map(c => 
            `- ID:${c.id} | ${c.name} (${c.phone}) | ${c.type==='buy'?'求购':'求租'} | 预算:${c.budgetMin}-${c.budgetMax} | 意向:${c.reqGardens?.join(',') || '不限'}`
        ).join('\n') + '\n\n';
    }

    if (keys.length > 0) {
        result += `[Relevant Keys (Top matches)]:\n`;
        result += keys.map(k => 
            `- ID:${k.id} | 编号:${k.keyNo} | 地址:${k.garden} ${k.roomNo} | 状态:${k.status==='in_store'?'在库':`借出给${k.borrower}(${k.borrowerPhone})`}`
        ).join('\n') + '\n\n';
    }
    
    if (!result) return "No directly relevant local data found. Respond generally.";
    return result;
};
