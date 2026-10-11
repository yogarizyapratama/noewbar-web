import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantSession } from "@/lib/auth";

/**
 * Product Management API (Multi-Tenant).
 *
 * Supported operations:
 * - list: get products with search, category, status filters & pagination
 * - create: add new product with validated price, stock, SKU
 * - update: update product details
 * - delete: remove product
 * - archive: toggle status between ACTIVE and ARCHIVED
 * - import_csv: bulk import product list from CSV text
 */

export async function GET(req: Request) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = session.sub;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const category = searchParams.get("category")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const where: any = { tenant_id: tenantId };
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (category && category !== "ALL") {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, products, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId },
      select: { category: true },
      distinct: ["category"],
    }),
  ]);

  return NextResponse.json({
    ok: true,
    total,
    page,
    limit,
    products,
    categories: categories.map((c) => c.category).filter(Boolean),
  });
}

export async function POST(req: Request) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = session.sub;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action || "create";

  if (action === "create") {
    const { name, sku, category, description, price, discount_price, stock, images, variants, attributes } = body;
    if (!name?.trim() || !sku?.trim() || price === undefined) {
      return NextResponse.json({ ok: false, error: "Nama produk, SKU, dan harga wajib diisi." }, { status: 400 });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return NextResponse.json({ ok: false, error: "Harga produk tidak valid." }, { status: 400 });
    }

    const cleanSku = String(sku).trim().toUpperCase();
    const existing = await prisma.product.findUnique({
      where: { tenant_id_sku: { tenant_id: tenantId, sku: cleanSku } },
    });
    if (existing) {
      return NextResponse.json({ ok: false, error: `SKU "${cleanSku}" sudah digunakan produk lain.` }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        tenant_id: tenantId,
        name: String(name).trim(),
        sku: cleanSku,
        category: category?.trim() || "Umum",
        description: description?.trim() || "",
        price: numPrice,
        discount_price: discount_price ? Number(discount_price) : null,
        stock: Math.max(0, parseInt(stock || "0", 10)),
        status: body.status || "ACTIVE",
        images: Array.isArray(images) ? images : [],
        variants: Array.isArray(variants) ? variants : [],
        attributes: typeof attributes === "object" && attributes !== null ? attributes : {},
      },
    });

    return NextResponse.json({ ok: true, product });
  }

  if (action === "update") {
    const { id, name, sku, category, description, price, discount_price, stock, status, images, variants, attributes } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID produk wajib disertakan." }, { status: 400 });
    }

    const cleanSku = sku ? String(sku).trim().toUpperCase() : undefined;
    if (cleanSku) {
      const duplicate = await prisma.product.findFirst({
        where: { tenant_id: tenantId, sku: cleanSku, NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json({ ok: false, error: `SKU "${cleanSku}" sudah digunakan produk lain.` }, { status: 400 });
      }
    }

    const updated = await prisma.product.updateMany({
      where: { id, tenant_id: tenantId },
      data: {
        ...(name && { name: String(name).trim() }),
        ...(cleanSku && { sku: cleanSku }),
        ...(category !== undefined && { category: category?.trim() || "Umum" }),
        ...(description !== undefined && { description: description?.trim() || "" }),
        ...(price !== undefined && { price: Math.max(0, Number(price)) }),
        ...(discount_price !== undefined && { discount_price: discount_price ? Number(discount_price) : null }),
        ...(stock !== undefined && { stock: Math.max(0, parseInt(stock, 10)) }),
        ...(status && { status }),
        ...(Array.isArray(images) && { images }),
        ...(Array.isArray(variants) && { variants }),
        ...(attributes && typeof attributes === "object" && { attributes }),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ ok: false, error: "Produk tidak ditemukan atau bukan milik tenant Anda." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ ok: false, error: "ID produk wajib diisi." }, { status: 400 });

    const deleted = await prisma.product.deleteMany({
      where: { id, tenant_id: tenantId },
    });
    return NextResponse.json({ ok: true, deleted: deleted.count > 0 });
  }

  if (action === "archive") {
    const { id, status } = body;
    if (!id) return NextResponse.json({ ok: false, error: "ID produk wajib diisi." }, { status: 400 });

    const nextStatus = status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
    await prisma.product.updateMany({
      where: { id, tenant_id: tenantId },
      data: { status: nextStatus },
    });
    return NextResponse.json({ ok: true, status: nextStatus });
  }

  if (action === "import_csv") {
    const { csv_content } = body;
    if (!csv_content || typeof csv_content !== "string") {
      return NextResponse.json({ ok: false, error: "Konten CSV kosong." }, { status: 400 });
    }

    const lines = csv_content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return NextResponse.json({ ok: false, error: "CSV harus memiliki header dan minimal 1 baris produk." }, { status: 400 });
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const skuIdx = headers.findIndex((h) => h.includes("sku") || h.includes("kode"));
    const nameIdx = headers.findIndex((h) => h.includes("nama") || h.includes("name"));
    const priceIdx = headers.findIndex((h) => h.includes("harga") || h.includes("price"));
    const stockIdx = headers.findIndex((h) => h.includes("stok") || h.includes("stock") || h.includes("qty"));
    const catIdx = headers.findIndex((h) => h.includes("kategori") || h.includes("category"));

    if (skuIdx === -1 || nameIdx === -1 || priceIdx === -1) {
      return NextResponse.json({
        ok: false,
        error: "CSV wajib memiliki kolom: SKU, Nama Produk, dan Harga.",
      }, { status: 400 });
    }

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      const sku = parts[skuIdx]?.toUpperCase();
      const name = parts[nameIdx];
      const rawPrice = parts[priceIdx]?.replace(/[^0-9]/g, "");
      const rawStock = stockIdx !== -1 ? parts[stockIdx]?.replace(/[^0-9]/g, "") : "10";
      const cat = catIdx !== -1 ? parts[catIdx] : "Umum";

      if (!sku || !name || !rawPrice) continue;
      const price = parseInt(rawPrice, 10);
      const stock = parseInt(rawStock || "0", 10);

      await prisma.product.upsert({
        where: { tenant_id_sku: { tenant_id: tenantId, sku } },
        create: {
          tenant_id: tenantId,
          sku,
          name,
          category: cat || "Umum",
          price,
          stock,
          status: "ACTIVE",
        },
        update: {
          name,
          category: cat || "Umum",
          price,
          stock,
        },
      });
      imported++;
    }

    return NextResponse.json({ ok: true, imported });
  }

  return NextResponse.json({ ok: false, error: "Aksi tidak dikenali." }, { status: 400 });
}
