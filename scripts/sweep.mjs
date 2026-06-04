import { runSweep } from "../src/lib/agents/sweep.js";

async function main() {
  const accountId = "00000000-0000-0000-0000-000000000001"; // Unilever PLC
  console.log(`Manually triggering agent sweep for: ${accountId}`);

  try {
    const success = await runSweep(accountId);
    if (success) {
      console.log("Sweep completed successfully! All signals crawled, classified, and persisted.");
    } else {
      console.error("Sweep failed or completed with errors.");
    }
  } catch (err) {
    console.error("Sweep script encountered an unhandled error:", err);
  }
}

main();
