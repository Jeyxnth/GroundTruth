// Loads .env.local for integration tests and disables the Next.js data cache (no Next runtime in Vitest).
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: integration tests will skip with a clear message
}
process.env.GT_DISABLE_NEXT_CACHE = "1";
