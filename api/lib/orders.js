import { hasPaidCryptoOrder } from "./crypto.js";

/**
 * Verify customer paid for LocalDrop Pro via crypto.
 */
export async function hasPaidOrder(email) {
  const normalized = email.toLowerCase().trim();

  // Dev bypass only when using mock payments (no NOWPayments key)
  if (process.env.DEV_BYPASS_ORDERS === "true" && !process.env.NOWPAYMENTS_API_KEY) {
    return true;
  }

  const allowlist = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.includes(normalized)) {
    return true;
  }

  return hasPaidCryptoOrder(normalized);
}
