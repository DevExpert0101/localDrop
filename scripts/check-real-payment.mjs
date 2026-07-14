import { loadEnvFile } from "./load-env.mjs";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

await loadEnvFile();

const key = process.env.NOWPAYMENTS_API_KEY;
const sandbox = process.env.NOWPAYMENTS_SANDBOX === "true";
const site = process.env.SITE_URL;

console.log("\nLocalDrop — Real Payment Setup Check\n");

if (!key) {
  console.log("❌ NOWPAYMENTS_API_KEY not set");
  console.log("\nTo enable real payments:");
  console.log("  1. Sign up at https://nowpayments.io");
  console.log("  2. Settings → API → copy API key");
  console.log("  3. Create .env file:");
  console.log("     NOWPAYMENTS_API_KEY=your_key_here");
  console.log("     NOWPAYMENTS_SANDBOX=true   # optional, for testing");
  console.log("     SITE_URL=http://localhost:5173");
  console.log("  4. Restart: npm run dev:api");
  process.exit(1);
}

console.log(`✓ NOWPAYMENTS_API_KEY set (${key.slice(0, 8)}...)`);
console.log(`✓ Mode: ${sandbox ? "SANDBOX (test network)" : "LIVE (real money)"}`);
console.log(`✓ SITE_URL: ${site || "not set"}`);

try {
  await readFile(join(ROOT, "scripts", "keys", "private.pem"), "utf8");
  console.log("✓ License private key found");
} catch {
  console.log("⚠ No license key — run: npm run license:keys");
}

const base = sandbox
  ? "https://api-sandbox.nowpayments.io/v1"
  : "https://api.nowpayments.io/v1";

try {
  const res = await fetch(`${base}/status`, { headers: { "x-api-key": key } });
  if (res.ok) {
    console.log("✓ NOWPayments API connection OK");
  } else {
    const err = await res.text();
    console.log(`❌ NOWPayments API error (${res.status}): ${err.slice(0, 120)}`);
    process.exit(1);
  }
} catch (e) {
  console.log(`❌ Could not reach NOWPayments: ${e.message}`);
  process.exit(1);
}

console.log("\nReady for real payments!");
console.log("  1. npm run dev:api   (should show [REAL (sandbox)] or [REAL (live)])");
console.log("  2. npm run dev");
console.log("  3. Open http://localhost:5173/pay.html\n");
