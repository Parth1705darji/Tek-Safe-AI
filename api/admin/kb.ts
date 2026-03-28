import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest, sendAuthError } from '../../lib/adminAuth.js';
import { writeAuditLog } from '../../lib/auditLog.js';

export const config = { api: { bodyParser: true } };

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 300;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    if (end < text.length) {
      const boundary = text.lastIndexOf('\n\n', end);
      if (boundary > start + CHUNK_SIZE / 2) end = boundary;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }
  return chunks.filter((c) => c.length > 50);
}

async function embedText(text: string, openAIKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let admin;
  try {
    admin = await verifyAdminRequest(req);
  } catch (e) {
    return sendAuthError(res, e);
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const OPENAI_KEY = process.env.OPENAI_API_KEY ?? '';

  // POST — Add/update a KB article and embed it
  if (req.method === 'POST') {
    const body = req.body as {
      title?: string;
      category?: string;
      subcategory?: string;
      tags?: string[];
      content?: string;
      source_url?: string;
    };

    if (!body.title || !body.content || !body.category || !body.subcategory) {
      return res.status(400).json({ error: 'Missing required fields: title, content, category, subcategory' });
    }

    const { data: doc, error: docError } = await supabase
      .from('kb_documents')
      .upsert(
        {
          title: body.title.trim(),
          category: body.category as 'tech_support' | 'cybersecurity',
          subcategory: body.subcategory.trim(),
          content: body.content.trim(),
          tags: body.tags ?? [],
          source_url: body.source_url?.trim() || null,
        },
        { onConflict: 'title' }
      )
      .select('id')
      .single();

    if (docError || !doc) {
      return res.status(500).json({ error: docError?.message ?? 'Failed to save document' });
    }

    // Delete existing embeddings before re-embedding
    await supabase.from('kb_embeddings').delete().eq('document_id', doc.id);

    const chunks = chunkText(body.content.trim());
    let embeddedCount = 0;

    if (OPENAI_KEY && OPENAI_KEY !== 'your_key_here') {
      for (const [i, chunk] of chunks.entries()) {
        try {
          const embedding = await embedText(chunk, OPENAI_KEY);
          await supabase.from('kb_embeddings').insert({
            document_id: doc.id,
            chunk_index: i,
            chunk_text: chunk,
            embedding,
          });
          embeddedCount++;
          await new Promise((r) => setTimeout(r, 200));
        } catch (e) {
          console.warn(`Chunk ${i} embedding failed:`, (e as Error).message);
        }
      }
    }

    await writeAuditLog(supabase, {
      adminClerkId: admin.clerkId,
      adminEmail: admin.email,
      action: 'save_kb',
      targetType: 'kb_document',
      targetId: doc.id,
      payload: { title: body.title, category: body.category, subcategory: body.subcategory, chunksEmbedded: embeddedCount },
      ipAddress: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim(),
    });

    return res.status(200).json({
      ok: true,
      documentId: doc.id,
      chunksEmbedded: embeddedCount,
      totalChunks: chunks.length,
    });
  }

  // DELETE — Remove a KB article and its embeddings
  if (req.method === 'DELETE') {
    const id = req.query.id as string | undefined;
    if (!id) return res.status(400).json({ error: 'Missing document id' });

    await supabase.from('kb_embeddings').delete().eq('document_id', id);
    await supabase.from('kb_documents').delete().eq('id', id);

    await writeAuditLog(supabase, {
      adminClerkId: admin.clerkId,
      adminEmail: admin.email,
      action: 'delete_kb',
      targetType: 'kb_document',
      targetId: id,
      ipAddress: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim(),
    });

    return res.status(200).json({ deleted: true });
  }

  return res.status(405).end();
}
