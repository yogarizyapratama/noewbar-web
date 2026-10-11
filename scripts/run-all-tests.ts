import { runUnitTests } from "../tests/unit/engines.test";
import { runApiTests } from "../tests/api/all-api.test";
import { runE2ETests } from "../tests/e2e/user-flows.test";

async function main() {
  console.log("==================================================");
  console.log("   NOEWBAR CS PRO - FULL COMPREHENSIVE TEST SUITE   ");
  console.log("==================================================");
  const startTime = Date.now();

  // 1. Unit Tests
  const unitResults = await runUnitTests();

  // 2. All API Tests
  const apiResults = await runApiTests();

  // 3. E2E User Flows
  const e2eResults = await runE2ETests();

  const totalPassed = unitResults.passed + apiResults.passed + e2eResults.passed;
  const totalFailed = unitResults.failed + apiResults.failed + e2eResults.failed;
  const grandTotal = unitResults.total + apiResults.total + e2eResults.total;
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n==================================================");
  console.log("               TEST SUITE SCORECARD               ");
  console.log("==================================================");
  console.log(`  Unit Tests (Engines & Guardrails) : ${unitResults.passed}/${unitResults.total} [${unitResults.failed === 0 ? "PASS" : "FAIL"}]`);
  console.log(`  API Tests (17 Live Endpoints)    : ${apiResults.passed}/${apiResults.total} [${apiResults.failed === 0 ? "PASS" : "FAIL"}]`);
  console.log(`  E2E User Flows (Full Lifecycles) : ${e2eResults.passed}/${e2eResults.total} [${e2eResults.failed === 0 ? "PASS" : "FAIL"}]`);
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
