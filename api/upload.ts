import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

// ─── Allowed types ────────────────────────────────────────────────────────────

const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
};

const ALLOWED_EXT: Set<string> = new Set(['png', 'jpg', 'jpeg', 'pdf', 'docx', 'xlsx', 'doc', 'xls']);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Parse multipart ──────────────────────────────────────────────────────────

async function parseUpload(req: VercelRequest): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers as Record<string, string>, limits: { fileSize: MAX_BYTES } });
    let resolved = false;

    bb.on('file', (_field, file, info) => {
      const { filename, mimeType } = info;
      const chunks: Buffer[] = [];
      let size = 0;

      file.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          file.destroy();
          if (!resolved) { resolved = true; reject(new Error('File exceeds 10 MB limit')); }
          return;
        }
        chunks.push(chunk);
      });

      file.on('end', () => {
        if (!resolved) {
          resolved = true;
          resolve({ buffer: Buffer.concat(chunks), filename: filename ?? 'upload', mimeType });
        }
      });

      file.on('error', (err) => {
        if (!resolved) { resolved = true; reject(err); }
      });
    });

    bb.on('error', (err) => {
      if (!resolved) { resolved = true; reject(err); }
    });

    bb.on('finish', () => {
      if (!resolved) { resolved = true; reject(new Error('No file received')); }
    });

    req.pipe(bb);
  });
}

// ─── Text extractors ──────────────────────────────────────────────────────────

async function extractPdf(buf: Buffer): Promise<string> {
  const pdfParse = await import('pdf-parse').then(m => (m as { default?: typeof m }).default ?? m);
  const data = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buf);
  return data.text.trim();
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value.trim();
}

async function extractXlsx(buf: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    lines.push(`Sheet: ${sheetName}`);
    lines.push(XLSX.utils.sheet_to_csv(sheet));
  }
  return lines.join('\n').trim();
}

async function describeImage(buf: Buffer, mimeType: string, openAIKey: string): Promise<string> {
  if (!openAIKey || openAIKey === 'your_key_here') {
    return '[Image attached — OpenAI API key not configured for vision analysis]';
  }
  const base64 = buf.toString('base64');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAIKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in detail. Focus on any visible text, error messages, security alerts, screenshots, data, or technical content. Be thorough.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      }],
      max_tokens: 1000,
    }),
  });
  if (!res.ok) return '[Image attached — could not analyze with vision API]';
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? '[Image — no description returned]';
}

// ─── Safety checks ────────────────────────────────────────────────────────────

function validateFile(filename: string, mimeType: string, buffer: Buffer): string | null {
  // MIME type check
  if (!ALLOWED_MIME[mimeType]) {
    return `File type "${mimeType}" is not allowed. Supported: PNG, JPEG, PDF, DOCX, XLSX`;
  }
  // Extension check
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXT.has(ext)) {
    return `File extension ".${ext}" is not allowed`;
  }
  // Magic bytes check for known formats
  const sig = buffer.slice(0, 4).toString('hex');
  if (mimeType === 'application/pdf' && !sig.startsWith('25504446')) {
    return 'File does not appear to be a valid PDF';
  }
  if ((mimeType.includes('officedocument') || mimeType.includes('msword') || mimeType.includes('ms-excel')) && sig !== '504b0304') {
    return 'File does not appear to be a valid Office document';
  }
  if (mimeType === 'image/png' && sig !== '89504e47') {
    return 'File does not appear to be a valid PNG';
  }
  if ((mimeType === 'image/jpeg' || mimeType === 'image/jpg') && !sig.startsWith('ffd8ff')) {
    return 'File does not appear to be a valid JPEG';
  }
  return null; // safe
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  let buffer: Buffer;
  let filename: string;
  let mimeType: string;

  try {
    ({ buffer, filename, mimeType } = await parseUpload(req));
  } catch (e) {
    return res.status(400).json({ safe: false, reason: (e as Error).message });
  }

  // Run magic-bytes + type validation
  const validationError = validateFile(filename, mimeType, buffer);
  if (validationError) {
    return res.status(200).json({ safe: false, reason: validationError, filename });
  }

  // Extract content
  const fileCategory = ALLOWED_MIME[mimeType];
  let extractedText = '';
  try {
    if (fileCategory === 'image') {
      const openAIKey = process.env.OPENAI_API_KEY ?? '';
      extractedText = await describeImage(buffer, mimeType, openAIKey);
    } else if (fileCategory === 'pdf') {
      extractedText = await extractPdf(buffer);
    } else if (fileCategory === 'docx' || fileCategory === 'doc') {
      extractedText = await extractDocx(buffer);
    } else if (fileCategory === 'xlsx' || fileCategory === 'xls') {
      extractedText = await extractXlsx(buffer);
    }
  } catch (e) {
    // Extraction failure may indicate corrupt/malicious file
    return res.status(200).json({
      safe: false,
      reason: `Could not read file contents — the file may be corrupt or password-protected`,
      filename,
    });
  }

  if (!extractedText.trim()) {
    return res.status(200).json({
      safe: false,
      reason: 'No readable content found in the file',
      filename,
    });
  }

  // Truncate to 4000 chars to keep context reasonable
  const truncated = extractedText.length > 4000
    ? extractedText.slice(0, 4000) + '\n\n[Content truncated to 4000 characters]'
    : extractedText;

  const fileSizeKB = Math.round(buffer.length / 1024);

  return res.status(200).json({
    safe: true,
    filename,
    mimeType,
    fileCategory,
    fileSizeKB,
    extractedText: truncated,
  });
}
