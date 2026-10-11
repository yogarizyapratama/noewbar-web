import prisma from '@/lib/prisma';
import { publicUrlFor } from '@/lib/storage/minio';

/**
 * Knowledge Base store (chapter 4.2 extended).
 *
 * Provides read/write access for per-tenant knowledge documents.
 * AI reads from this to answer questions about store policies,
 * size charts, material descriptions, and FAQs.
 */

export type KnowledgeDocType = 'FAQ' | 'SOP' | 'SIZE_CHART' | 'POLICY' | 'OTHER';

export type KnowledgeDocSummary = {
  id: string;
  title: string;
  doc_type: string;
  file_name: string | null;
  file_mime: string | null;
  file_key: string | null;
  file_url: string | null;
  is_active: boolean;
  created_at: string;
  preview: string;
  content_text: string;
};

export async function listKnowledgeDocs(tenantId: string): Promise<KnowledgeDocSummary[]> {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      title: true,
      doc_type: true,
      file_name: true,
      file_mime: true,
      file_key: true,
      is_active: true,
      created_at: true,
      content_text: true,
    },
  });

  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    doc_type: d.doc_type,
    file_name: d.file_name,
    file_mime: d.file_mime,
    file_key: d.file_key,
    file_url: d.file_key ? publicUrlFor(d.file_key) : null,
    is_active: d.is_active,
    created_at: d.created_at.toISOString(),
    preview: d.content_text.slice(0, 200),
    content_text: d.content_text,
  }));
}

export async function getActiveKnowledgeText(tenantId: string): Promise<string> {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: { created_at: 'asc' },
    select: { title: true, doc_type: true, content_text: true },
  });

  const sections: string[] = docs.map((d) =>
    `=== ${d.title} (${d.doc_type}) ===\n${d.content_text.slice(0, 1500)}`
  );

  // USP 3: Website as AI Knowledge Source
  try {
    const websites = await prisma.website.findMany({
      where: { tenant_id: tenantId, status: "PUBLISHED", is_knowledge_source: true },
      select: { name: true, title: true, description: true, published_sections: true, sections: true },
    });

    for (const site of websites) {
      const siteSections = (site.published_sections || site.sections) as any[];
      if (Array.isArray(siteSections)) {
        const textParts: string[] = [];
        if (site.description) textParts.push(`Tentang Toko: ${site.description}`);
        for (const sec of siteSections) {
          if (sec.type === "faq" && Array.isArray(sec.content?.items)) {
            const faqList = sec.content.items.map((item: any) => `Tanya: ${item.q}\nJawab: ${item.a}`).join("\n");
            textParts.push(`FAQ Toko:\n${faqList}`);
          } else if (sec.type === "benefits" && Array.isArray(sec.content?.items)) {
            const benList = sec.content.items.map((item: any) => `- ${item.title}: ${item.desc}`).join("\n");
            textParts.push(`Keunggulan Layanan:\n${benList}`);
          } else if (sec.type === "announcement" && sec.content?.text) {
            textParts.push(`Pengumuman: ${sec.content.text}`);
          }
        }
        if (textParts.length > 0) {
          sections.push(`=== WEBSITE TOKO (${site.name}) ===\n${textParts.join("\n\n")}`);
        }
      }
    }
  } catch {
    // Non-critical website extraction fallback
  }

  if (sections.length === 0) return '';
  return sections.join('\n\n');
}

export async function upsertKnowledgeDoc(params: {
  tenantId: string;
  id?: string;
  title: string;
  doc_type: KnowledgeDocType;
  content_text: string;
  file_key?: string;
  file_name?: string;
  file_mime?: string;
}): Promise<{ id: string }> {
  if (params.id) {
    const updated = await prisma.knowledgeDocument.updateMany({
      where: { id: params.id, tenant_id: params.tenantId },
      data: {
        title: params.title,
        doc_type: params.doc_type,
        content_text: params.content_text,
        ...(params.file_key !== undefined && { file_key: params.file_key }),
        ...(params.file_name !== undefined && { file_name: params.file_name }),
        ...(params.file_mime !== undefined && { file_mime: params.file_mime }),
      },
    });
    if (updated.count === 0) throw new Error('Document not found or wrong tenant');
    return { id: params.id };
  }

  const doc = await prisma.knowledgeDocument.create({
    data: {
      tenant_id: params.tenantId,
      title: params.title,
      doc_type: params.doc_type,
      content_text: params.content_text,
      file_key: params.file_key,
      file_name: params.file_name,
      file_mime: params.file_mime,
    },
    select: { id: true },
  });
  return { id: doc.id };
}

export async function toggleKnowledgeDoc(tenantId: string, id: string, active: boolean): Promise<void> {
  await prisma.knowledgeDocument.updateMany({
    where: { id, tenant_id: tenantId },
    data: { is_active: active },
  });
}

export async function deleteKnowledgeDoc(tenantId: string, id: string): Promise<void> {
  await prisma.knowledgeDocument.deleteMany({
    where: { id, tenant_id: tenantId },
  });
}
