import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTenant } from "@/lib/auth";
import { getTenantSubscriptionInfo } from "@/lib/billing/subscription-guard";
import {
  TEMPLATES,
  editSectionWithAi,
  generateWebsiteFromPrompt,
  type WebsiteSection,
} from "@/lib/website/builder";

/**
 * Multi-Tenant Website Builder API.
 *
 * Supported operations:
 * - list: returns websites owned by tenant
 * - templates: returns list of curated templates
 * - create: creates new website draft
 * - generate_ai: generates full website content from prompt
 * - edit_section_ai: updates a single block section using AI structured JSON
 * - save_draft: updates draft sections & metadata
 * - publish: sets status to PUBLISHED & snapshots published_sections
 * - unpublish: reverts status to DRAFT
 * - delete: removes website
 */

export async function GET() {
  try {
    const session = await requireTenant();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = session.sub;

    const websites = await prisma.website.findMany({
      where: { tenant_id: tenantId },
      orderBy: { updated_at: "desc" },
    });

    return NextResponse.json({ ok: true, websites, templates: TEMPLATES });
  } catch (err: any) {
    console.error("[api/websites] GET error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: "Gagal memuat daftar website, server database sedang sibuk. Silakan coba lagi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await requireTenant();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = session.sub;

  const subInfo = await getTenantSubscriptionInfo(tenantId);
  if (subInfo.isExpired) {
    return NextResponse.json(
      { ok: false, error: "Langganan Anda telah berakhir. Perbarui paket untuk menggunakan fitur ini." },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action || "list";

  if (action === "templates") {
    return NextResponse.json({ ok: true, templates: TEMPLATES });
  }

  if (action === "create") {
    const { name, template_id, slug: requestedSlug, replace_existing } = body;
    const template = TEMPLATES.find((t) => t.id === template_id) || TEMPLATES[0];

    // Enforce 1 website per tenant
    const existingWebsite = await prisma.website.findFirst({
      where: { tenant_id: tenantId },
    });

    if (existingWebsite) {
      if (replace_existing !== true) {
        return NextResponse.json(
          {
            ok: false,
            error: "Toko Anda sudah memiliki 1 website aktif. Setiap akun toko hanya dapat memiliki 1 website resmi. Anda dapat mengedit website yang ada atau menggantinya.",
            existing_website: existingWebsite,
          },
          { status: 400 }
        );
      }
      // If replace_existing is requested, safely remove existing websites first
      await prisma.website.deleteMany({
        where: { tenant_id: tenantId },
      });
    }

    // Generate unique slug
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { business_name: true },
    });
    const baseSlug = (requestedSlug || name || tenant?.business_name || "store")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let slug = baseSlug;
    let count = 1;
    while (await prisma.website.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${count++}`;
    }

    const website = await prisma.website.create({
      data: {
        tenant_id: tenantId,
        name: name?.trim() || `${tenant?.business_name || "Toko"} Official`,
        slug,
        template_id: template.id,
        title: `${name || tenant?.business_name} - Toko Online`,
        description: template.description,
        theme_config: template.theme,
        status: "DRAFT",
        sections: template.default_sections,
      },
    });

    return NextResponse.json({ ok: true, website });
  }

  if (action === "generate_ai") {
    const { prompt, template_id, replace_existing } = body;
    if (!prompt?.trim()) {
      return NextResponse.json({ ok: false, error: "Prompt instruksi website wajib diisi." }, { status: 400 });
    }

    // Enforce 1 website per tenant
    const existingWebsite = await prisma.website.findFirst({
      where: { tenant_id: tenantId },
    });

    if (existingWebsite) {
      if (replace_existing !== true) {
        return NextResponse.json(
          {
            ok: false,
            error: "Toko Anda sudah memiliki 1 website aktif. Setiap akun toko hanya dapat memiliki 1 website resmi. Anda dapat mengedit website yang ada atau menimpanya.",
            existing_website: existingWebsite,
          },
          { status: 400 }
        );
      }
      // If replace_existing is requested, safely remove existing websites first
      await prisma.website.deleteMany({
        where: { tenant_id: tenantId },
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { business_name: true },
    });

    const businessName = tenant?.business_name || "Toko Saya";
    const generated = await generateWebsiteFromPrompt({
      businessName,
      userPrompt: prompt.trim(),
      templateId: template_id,
    });

    const baseSlug = generated.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let slug = baseSlug;
    let count = 1;
    while (await prisma.website.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${count++}`;
    }

    const template = TEMPLATES.find((t) => t.id === template_id) || TEMPLATES[0];

    const website = await prisma.website.create({
      data: {
        tenant_id: tenantId,
        name: generated.name,
        slug,
        template_id: template.id,
        title: generated.title,
        description: generated.description,
        theme_config: template.theme,
        status: "DRAFT",
        sections: generated.sections,
      },
    });

    return NextResponse.json({ ok: true, website });
  }

  if (action === "edit_section_ai") {
    const { website_id, section, prompt } = body;
    if (!section || !prompt?.trim()) {
      return NextResponse.json({ ok: false, error: "Target section dan prompt wajib disertakan." }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { business_name: true },
    });

    const result = await editSectionWithAi({
      section: section as WebsiteSection,
      userPrompt: prompt.trim(),
      businessName: tenant?.business_name || "Toko",
    });

    if (!result.ok || !result.updatedSection) {
      return NextResponse.json({ ok: false, error: result.error || "Gagal memperbarui section dengan AI." }, { status: 400 });
    }

    // If website_id is provided, auto-update the section in draft
    if (website_id) {
      const site = await prisma.website.findFirst({
        where: { id: website_id, tenant_id: tenantId },
      });
      if (site && Array.isArray(site.sections)) {
        const sections = site.sections as any[];
        const idx = sections.findIndex((s) => s.id === section.id);
        if (idx !== -1) {
          sections[idx] = result.updatedSection;
          await prisma.website.update({
            where: { id: website_id },
            data: { sections },
          });
        }
      }
    }

    return NextResponse.json({ ok: true, updatedSection: result.updatedSection });
  }

  if (action === "save_draft") {
    const { id, name, title, description, sections, theme_config, is_knowledge_source } = body;
    if (!id) return NextResponse.json({ ok: false, error: "ID website wajib diisi." }, { status: 400 });

    const updated = await prisma.website.updateMany({
      where: { id, tenant_id: tenantId },
      data: {
        ...(name && { name: String(name).trim() }),
        ...(title !== undefined && { title: String(title).trim() }),
        ...(description !== undefined && { description: String(description).trim() }),
        ...(Array.isArray(sections) && { sections }),
        ...(theme_config && typeof theme_config === "object" && { theme_config }),
        ...(is_knowledge_source !== undefined && { is_knowledge_source: Boolean(is_knowledge_source) }),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ ok: false, error: "Website tidak ditemukan atau bukan milik tenant Anda." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "publish") {
    const { id } = body;
    if (!id) return NextResponse.json({ ok: false, error: "ID website wajib diisi." }, { status: 400 });

    const site = await prisma.website.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!site) {
      return NextResponse.json({ ok: false, error: "Website tidak ditemukan." }, { status: 404 });
    }

    await prisma.website.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        published_at: new Date(),
        published_sections: (site.sections || []) as any, // atomic snapshot
      },
    });

    return NextResponse.json({ ok: true, slug: site.slug });
  }

  if (action === "unpublish") {
    const { id } = body;
    if (!id) return NextResponse.json({ ok: false, error: "ID website wajib diisi." }, { status: 400 });

    await prisma.website.updateMany({
      where: { id, tenant_id: tenantId },
      data: { status: "DRAFT" },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ ok: false, error: "ID website wajib diisi." }, { status: 400 });

    const result = await prisma.website.deleteMany({
      where: { id, tenant_id: tenantId },
    });

    if (result.count === 0) {
      return NextResponse.json({ ok: false, error: "Website tidak ditemukan atau bukan milik akun Anda." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Website berhasil dihapus." });
  }

  return NextResponse.json({ ok: false, error: "Aksi tidak dikenali." }, { status: 400 });
}
