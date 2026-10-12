import prisma from "@/lib/prisma";

export interface TenantSubscriptionInfo {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  status: "ACTIVE" | "TRIAL" | "GRACE_PERIOD" | "EXPIRED" | "SUSPENDED";
  planName: string | null;
  expiresAt: Date | null;
  reason?: string;
}

/**
 * Calculates current subscription validity and remaining days for a tenant.
 * Enforces strict expiration when:
 * 1. Tenant is marked SUSPENDED or EXPIRED.
 * 2. Paid subscription expires_at <= now or status is EXPIRED.
 * 3. Free trial trial_expires_at <= now and no active paid subscription exists.
 */
export async function getTenantSubscriptionInfo(tenantId: string): Promise<TenantSubscriptionInfo> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptions: {
        orderBy: { created_at: "desc" },
        take: 1,
      },
    },
  });

  if (!tenant) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: 0,
      status: "SUSPENDED",
      planName: null,
      expiresAt: null,
      reason: "Tenant tidak ditemukan pada sistem.",
    };
  }

  const now = new Date();

  // 1. Manually suspended tenant
  if (tenant.status === "SUSPENDED") {
    const latestSub = tenant.subscriptions[0];
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: 0,
      status: "SUSPENDED",
      planName: latestSub?.plan_name ?? null,
      expiresAt: latestSub?.expires_at ?? tenant.trial_expires_at,
      reason: "Akun toko telah ditangguhkan (SUSPENDED).",
    };
  }

  const latestSub = tenant.subscriptions[0];

  // 2. Paid subscription evaluation
  if (latestSub && (latestSub.status === "ACTIVE" || latestSub.status === "GRACE_PERIOD")) {
    const diffMs = latestSub.expires_at.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / 86_400_000));

    if (diffMs <= 0) {
      return {
        isExpired: true,
        isExpiringSoon: false,
        daysRemaining: 0,
        status: "EXPIRED",
        planName: latestSub.plan_name,
        expiresAt: latestSub.expires_at,
        reason: "Masa aktif paket langganan telah berakhir.",
      };
    }

    return {
      isExpired: false,
      isExpiringSoon: daysRemaining <= 3,
      daysRemaining,
      status: latestSub.status as "ACTIVE" | "GRACE_PERIOD",
      planName: latestSub.plan_name,
      expiresAt: latestSub.expires_at,
    };
  }

  // 3. Free trial evaluation
  const trialDiffMs = tenant.trial_expires_at.getTime() - now.getTime();
  const trialDaysRemaining = Math.max(0, Math.ceil(trialDiffMs / 86_400_000));

  if (trialDiffMs <= 0 || tenant.status === "EXPIRED") {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: 0,
      status: "EXPIRED",
      planName: "TRIAL",
      expiresAt: tenant.trial_expires_at,
      reason: "Masa uji coba gratis (trial) telah berakhir.",
    };
  }

  return {
    isExpired: false,
    isExpiringSoon: trialDaysRemaining <= 3,
    daysRemaining: trialDaysRemaining,
    status: "TRIAL",
    planName: "TRIAL",
    expiresAt: tenant.trial_expires_at,
  };
}
