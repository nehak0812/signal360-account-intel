import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { 
  prisma: PrismaClient;
  cronStarted?: boolean;
};

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Start hourly background sync task
if (!globalForPrisma.cronStarted) {
  globalForPrisma.cronStarted = true;
  console.log("[CRON] Initializing hourly news signal sync...");
  
  const runSync = async () => {
    console.log("[CRON] Starting background news signal sync...");
    try {
      // Use dynamic import to avoid circular dependency with db.ts import inside sync.ts
      const { syncSignals } = await import("./sync");
      const result = await syncSignals();
      console.log(`[CRON] Background news signal sync complete. Success: ${result.success}, New Signals: ${result.count}`);
    } catch (err) {
      console.error("[CRON] Error running background news signal sync:", err);
    }
  };

  // Run first execution after a short startup delay (15 seconds) to let server initialize completely
  setTimeout(() => {
    runSync();
  }, 15000);

  // Run every 1 hour (3600000 milliseconds)
  setInterval(runSync, 3600000);
}
