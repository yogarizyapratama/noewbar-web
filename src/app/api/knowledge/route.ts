import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { requireTenant } from '@/lib/auth';
import {
  listKnowledgeDocs,
  upsertKnowledgeDoc,
  toggleKnowledgeDoc,
  deleteKnowledgeDoc,
  type KnowledgeDocType,
} from '@/lib/knowledge/knowledge-store';
import { extractTextFromBuffer } from '@/lib/knowledge/text-extractor';
import { tenantDocKey, uploadObject, publicUrlFor } from '@/lib/storage/minio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['FAQ', 'SOP', 'SIZE_CHART', 'POLICY', 'OTHER'] as const;

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
  }),
  z.object({
    action: z.literal('save'),
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(120),
    doc_type: z.enum(ALLOWED_TYPES),
    content_text: z.string().min(1).max(30000),
  }),
  z.object({
    action: z.literal('toggle'),
    id: z.string().uuid(),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal('delete'),
    id: z.string().uuid(),
  }),
]);

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail('Unauthorized', 401);

  const contentType = req.headers.get('content-type') ?? '';

  // Handle multipart/form-data (File uploads: PDF, DOCX, TXT, MD, CSV)
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData().catch(() => null);
    if (!formData) return fail('Form data tidak valid', 400);

    const file = formData.get('file') as File | null;
    const docTypeRaw = (formData.get('doc_type') as string) || 'OTHER';
    const docType: KnowledgeDocType = (ALLOWED_TYPES as readonly string[]).includes(docTypeRaw)
      ? (docTypeRaw as KnowledgeDocType)
      : 'OTHER';
    let title = (formData.get('title') as string)?.trim();
    let text = (formData.get('content_text') as string)?.trim() ?? '';

    let fileKey: string | undefined;
    let fileName: string | undefined;
    let fileMime: string | undefined;

    if (file && typeof file === 'object' && file.name) {
      if (file.size > 10 * 1024 * 1024) {
        return fail('Ukuran berkas melebihi batas 10 MB', 413);
      }

      fileName = file.name;
      fileMime = file.type || 'application/octet-stream';
      if (!title) {
        title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // If no manually provided text, extract from buffer
      if (!text) {
        text = extractTextFromBuffer(buffer, file.name, fileMime);
      }

      if (!text || text.length < 5) {
        text = `Berkas ${file.name} (${fileMime}). Teks dokumen tidak dapat diekstrak secara otomatis.`;
      }

      fileKey = tenantDocKey(session.sub, file.name);
      await uploadObject(fileKey, buffer, fileMime);
    }

    if (!title) title = 'Dokumen Toko';
    if (!text) return fail('Isi atau berkas dokumen tidak boleh kosong', 422);

    const doc = await upsertKnowledgeDoc({
      tenantId: session.sub,
      title: title.slice(0, 120),
      doc_type: docType,
      content_text: text.slice(0, 30000),
      file_key: fileKey,
      file_name: fileName,
      file_mime: fileMime,
    });

    return ok({
      uploaded: true,
      id: doc.id,
      title,
      doc_type: docType,
      file_url: fileKey ? publicUrlFor(fileKey) : null,
      extracted_length: text.length,
    });
  }

  // Handle application/json
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail('Permintaan tidak valid', 422, parsed.error.issues);

  const body = parsed.data;

  if (body.action === 'list') {
    const docs = await listKnowledgeDocs(session.sub);
    return ok({ docs });
  }

  if (body.action === 'save') {
    const doc = await upsertKnowledgeDoc({
      tenantId: session.sub,
      id: body.id,
      title: body.title,
      doc_type: body.doc_type,
      content_text: body.content_text,
    });
    return ok({ id: doc.id });
  }

  if (body.action === 'toggle') {
    await toggleKnowledgeDoc(session.sub, body.id, body.active);
    return ok({ toggled: true });
  }

  if (body.action === 'delete') {
    await deleteKnowledgeDoc(session.sub, body.id);
    return ok({ deleted: true });
  }

  return fail('Aksi tidak dikenal', 400);
}

export async function GET(_req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail('Unauthorized', 401);
  const docs = await listKnowledgeDocs(session.sub);
  return ok({ docs });
}
