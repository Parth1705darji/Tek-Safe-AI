/**
 * scripts/seed-kb.ts
 *
 * Seeds the Knowledge Base with articles and their vector embeddings.
 *
 * Usage:
 *   npm run seed-kb
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) {
  console.error('Missing required env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Chunk size in characters (~500 tokens) with overlap
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 300;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  title: string;
  category: 'tech_support' | 'cybersecurity';
  subcategory: string;
  tags: string[];
  content: string;
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    // Snap to paragraph boundary if possible (avoid mid-sentence cuts)
    if (end < text.length) {
      const boundary = text.lastIndexOf('\n\n', end);
      if (boundary > start + CHUNK_SIZE / 2) {
        end = boundary;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP; // overlap for context continuity
    if (start >= text.length) break;
  }

  return chunks.filter((c) => c.length > 50);
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI embedding error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const articlesPath = join(__dirname, 'kb-articles.json');
  const articles: Article[] = JSON.parse(readFileSync(articlesPath, 'utf-8'));

  console.log(`\n📚 Seeding ${articles.length} Knowledge Base articles...\n`);

  let totalChunks = 0;
  let totalErrors = 0;

  for (const [i, article] of articles.entries()) {
    console.log(`[${i + 1}/${articles.length}] ${article.title}`);

    // Insert document
    const { data: doc, error: docError } = await supabase
      .from('kb_documents')
      .upsert(
        {
          title: article.title,
          category: article.category,
          subcategory: article.subcategory,
          content: article.content,
          tags: article.tags,
        },
        { onConflict: 'title' }
      )
      .select('id')
      .single();

    if (docError || !doc) {
      console.error(`  ❌ Failed to insert document: ${docError?.message}`);
      totalErrors++;
      continue;
    }

    // Delete existing embeddings for this document (for re-seeding)
    await supabase.from('kb_embeddings').delete().eq('document_id', doc.id);

    // Chunk and embed
    const chunks = chunkText(article.content);
    console.log(`  ✂️  ${chunks.length} chunk(s)`);

    for (const [chunkIdx, chunk] of chunks.entries()) {
      try {
        const embedding = await embedText(chunk);

        const { error: embError } = await supabase.from('kb_embeddings').insert({
          document_id: doc.id,
          chunk_index: chunkIdx,
          chunk_text: chunk,
          embedding,
        });

        if (embError) {
          console.error(`  ❌ Embedding insert error: ${embError.message}`);
          totalErrors++;
        } else {
          process.stdout.write('.');
          totalChunks++;
        }

        // Respect OpenAI rate limit (3 RPM on free tier, ~1500 RPM on paid)
        await sleep(200);
      } catch (e) {
        console.error(`\n  ❌ Embedding error for chunk ${chunkIdx}: ${(e as Error).message}`);
        totalErrors++;
      }
    }

    console.log(' ✅');
  }

  console.log(`\n✨ Done! ${totalChunks} chunks embedded, ${totalErrors} errors.\n`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
