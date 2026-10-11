/**
 * One-off cleanup: removes test tenants created by UI probes (email domain
 * @noewbar-e2e.local) and reports what remains. Never touches real tenants.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.tenant.findMany({
    select: { id: true, business_name: true, email: true, status: true },
    orderBy: { created_at: "asc" },
  });
  console.log("TENANTS_SEBELUM:", JSON.stringify(before, null, 1));

  const junk = before.filter((t) => t.email.includes("@noewbar-e2e.local"));
  console.log("AKAN_DIHAPUS:", junk.length, junk.map((t) => t.email).join(", "));

  for (const t of junk) {
    const conv = await prisma.conversation.findMany({ where: { tenant_id: t.id }, select: { id: true } });
    const ids = conv.map((c) => c.id);
    await prisma.chatMessage.deleteMany({ where: { conversation_id: { in: ids } } });
    await prisma.scheduledNudge.deleteMany({ where: { conversation_id: { in: ids } } });
    await prisma.order.deleteMany({ where: { tenant_id: t.id } });
    await prisma.conversation.deleteMany({ where: { tenant_id: t.id } });
    await prisma.waInstance.deleteMany({ where: { tenant_id: t.id } });
    await prisma.catalogSetting.deleteMany({ where: { tenant_id: t.id } });
    await prisma.subscription.deleteMany({ where: { tenant_id: t.id } });
    await prisma.tenant.delete({ where: { id: t.id } });
  }

  const after = await prisma.tenant.findMany({
    select: { business_name: true, email: true, status: true },
    orderBy: { created_at: "asc" },
  });
  console.log("TENANTS_SESUDAH:", JSON.stringify(after, null, 1));
  void after;
}

main()
  .catch((e) => {
    console.error("CLEANUP_ERROR:", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
