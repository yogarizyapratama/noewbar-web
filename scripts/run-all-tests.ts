import { runUnitTests } from "../tests/unit/engines.test";
import { runAdvancedResilienceTests } from "../tests/unit/advanced-resilience.test";
import { runApiTests } from "../tests/api/all-api.test";
import { runE2ETests } from "../tests/e2e/user-flows.test";
import { runFrontendAllFeaturesTests } from "../tests/e2e/frontend-all-features.test";

async function main() {
  console.log("==================================================");
  console.log("   NOEWBAR CS PRO - FULL COMPREHENSIVE TEST SUITE   ");
  console.log("==================================================");
  const startTime = Date.now();

  // 1. Unit Tests
  const unitResults = await runUnitTests();

  // 2. Advanced Resilience Tests (Concurrency, Expiry, GPS, Takeover, Multi-Tenant)
  const resilienceResults = await runAdvancedResilienceTests();

  // 3. All API Tests
  const apiResults = await runApiTests();

  // 4. E2E User Flows
  const e2eResults = await runE2ETests();

  // 5. Frontend All Features (User & Superadmin)
  const feResults = await runFrontendAllFeaturesTests();

  const totalPassed = unitResults.passed + resilienceResults.passed + apiResults.passed + e2eResults.passed + feResults.passed;
  const totalFailed = unitResults.failed + resilienceResults.failed + apiResults.failed + e2eResults.failed + feResults.failed;
  const grandTotal = unitResults.total + resilienceResults.total + apiResults.total + e2eResults.total + feResults.total;
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n==================================================");
  console.log("               TEST SUITE SCORECARD               ");
  console.log("==================================================");
  console.log(`  Unit Tests (Engines & Guardrails)      : ${unitResults.passed}/${unitResults.total} [${unitResults.failed === 0 ? "PASS" : "FAIL"}]`);
  console.log(`  Advanced Resilience (Field Scenarios)  : ${resilienceResults.passed}/${resilienceResults.total} [${resilienceResults.failed === 0 ? "PASS" : "FAIL"}]`);
  console.log(`  API Tests (17 Live Endpoints)         : ${apiResults.passed}/${apiResults.total} [${apiResults.failed === 0 ? "PASS" : "FAIL"}]`);
  console.log(`  E2E User Flows (Full Lifecycles)      : ${e2eResults.passed}/${e2eResults.total} [${e2eResults.failed === 0 ? "PASS" : "FAIL"}]`);
  console.log(`  Frontend Features (User & Superadmin) : ${feResults.passed}/${feResults.total} [${feResults.failed === 0 ? "PASS" : "FAIL"}]`);
  console.log("--------------------------------------------------");
  console.log(`  Grand Total                      : ${totalPassed}/${grandTotal} passed in ${durationSec}s`);
  console.log("==================================================\n");

  if (totalFailed > 0) {
    console.error(`FAILED: ${totalFailed} tests failed.`);
    process.exit(1);
  } else {
    console.log("SUCCESS: All tests passed with 100% green coverage!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Master test runner crashed:", err);
  process.exit(1);
});
