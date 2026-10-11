import assert from "node:assert";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const SECRET = process.env.WHATSMEOW_SECRET || "whatsmeow-seco-internal-key";

type ApiResponse = {
  status: number;
  body: any;
  contentType: string;
};

async function api(path: string, options?: RequestInit): Promise<ApiResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  let body: any = null;
  if (contentType.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => "");
  }

  return { status: res.status, body, contentType };
}

export async function runApiTests(): Promise<{ total: number; passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed += 1;
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] ${name} ->`, msg);
    }
  }

  console.log(`\n=== ALL API TESTS (Target: ${BASE_URL}) ===\n`);

  // 1. /api/auth
  await test("API 1: /api/auth (Session status)", async () => {
    const res = await api("/api/auth");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body?.authenticated, "boolean");
  });

  await test("API 1b: /api/auth (Login validation requires email & password)", async () => {
    const res = await api("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email: "invalid-email" }),
    });
    assert.ok(res.status === 400 || res.status === 422);
  });

  // 2. /api/playground
  await test("API 2a: /api/playground (GET catalog preview)", async () => {
    const res = await api("/api/playground");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.ok, true);
    assert.ok(res.body?.total >= 0);
    assert.ok(Array.isArray(res.body?.preview));
  });

  await test("API 2b: /api/playground (POST chat simulation schema validation)", async () => {
    const res = await api("/api/playground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.ok(res.status === 400 || res.status === 422);
  });

  // 3. /api/maintenance
  await test("API 3: /api/maintenance (Requires authentication)", async () => {
    const res = await api("/api/maintenance");
    assert.strictEqual(res.status, 401);
  });

  // 4. /api/products
  await test("API 4: /api/products (Requires authentication)", async () => {
    const res = await api("/api/products");
    assert.strictEqual(res.status, 401);
  });

  // 5. /api/products/upload
  await test("API 5: /api/products/upload (Requires authentication)", async () => {
    const res = await api("/api/products/upload", { method: "POST" });
    assert.strictEqual(res.status, 401);
  });

  // 6. /api/orders
  await test("API 6: /api/orders (Requires authentication)", async () => {
    const res = await api("/api/orders");
    assert.strictEqual(res.status, 401);
  });

  // 7. /api/conversations
  await test("API 7: /api/conversations (Requires authentication)", async () => {
    const res = await api("/api/conversations");
    assert.strictEqual(res.status, 401);
  });

  // 8. /api/dashboard
  await test("API 8: /api/dashboard (Requires authentication)", async () => {
    const res = await api("/api/dashboard");
    assert.strictEqual(res.status, 401);
  });

  // 9. /api/simulator
  await test("API 9: /api/simulator (Requires authentication)", async () => {
    const res = await api("/api/simulator", { method: "POST" });
    assert.strictEqual(res.status, 401);
  });

  // 10. /api/knowledge
  await test("API 10: /api/knowledge (Requires authentication)", async () => {
    const res = await api("/api/knowledge");
    assert.strictEqual(res.status, 401);
  });

  // 11. /api/websites
  await test("API 11: /api/websites (Requires authentication)", async () => {
    const res = await api("/api/websites");
    assert.strictEqual(res.status, 401);
  });

  // 12. /api/wa/qr
  await test("API 12: /api/wa/qr (Requires authentication)", async () => {
    const res = await api("/api/wa/qr");
    assert.strictEqual(res.status, 401);
  });

  // 13. /api/wa-webhook
  await test("API 13a: /api/wa-webhook (Rejects request without secret)", async () => {
    const res = await api("/api/wa-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 401);
  });

  await test("API 13b: /api/wa-webhook (GET healthcheck with secret returns 200)", async () => {
    const res = await api("/api/wa-webhook", {
      method: "GET",
      headers: { "X-Noewbar-Secret": SECRET },
    });
    assert.strictEqual(res.status, 200);
  });

  await test("API 13c: /api/wa-webhook (POST rejects empty body payload)", async () => {
    const res = await api("/api/wa-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Noewbar-Secret": SECRET,
      },
      body: JSON.stringify({}),
    });
    assert.ok(res.status === 400 || res.status === 422);
  });

  // 14. /api/billing/checkout
  await test("API 14: /api/billing/checkout (Requires authentication)", async () => {
    const res = await api("/api/billing/checkout", { method: "POST" });
    assert.strictEqual(res.status, 401);
  });

  // 15. /api/billing/webhook
  await test("API 15: /api/billing/webhook (Rejects invalid signature/payload)", async () => {
    const res = await api("/api/billing/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "unknown" }),
    });
    assert.ok(res.status === 400 || res.status === 401 || res.status === 422);
  });

  // 16. /api/superadmin
  await test("API 16: /api/superadmin (Requires superadmin session)", async () => {
    const res = await api("/api/superadmin");
    assert.strictEqual(res.status, 401);
  });

  // 17. /api/realtime
  await test("API 17: /api/realtime (Requires authentication)", async () => {
    const res = await api("/api/realtime");
    assert.strictEqual(res.status, 401);
  });

  return { total: passed + failed, passed, failed };
}

if (process.argv[1]?.endsWith("all-api.test.ts")) {
  runApiTests()
    .then((r) => {
      console.log(`\nAPI Tests Finished: ${r.passed}/${r.total} passed (${r.failed} failed)\n`);
      process.exit(r.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Test runner crashed:", err);
      process.exit(1);
    });
}
