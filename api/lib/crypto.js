import { createHash } from "crypto";

const API_BASE =
  process.env.NOWPAYMENTS_SANDBOX === "true"
    ? "https://api-sandbox.nowpayments.io/v1"
    : "https://api.nowpayments.io/v1";

const FINISHED = new Set(["finished", "confirmed", "sending"]);

/** In-memory paid emails for dev / webhook cache (use Upstash in high-volume prod) */
const paidEmails = new Set();

export function markEmailPaid(email) {
  paidEmails.add(email.toLowerCase().trim());
}

export function isEmailMarkedPaid(email) {
  return paidEmails.has(email.toLowerCase().trim());
}

export function orderIdForEmail(email) {
  const hash = createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 16);
  return `ldpro-${hash}`;
}

function apiKey() {
  return process.env.NOWPAYMENTS_API_KEY || "";
}

function isDevMock() {
  if (apiKey()) return false;
  return process.env.DEV_BYPASS_ORDERS === "true";
}

export function usingRealPayments() {
  return Boolean(apiKey());
}

export async function createPayment(email, payCurrency = "btc") {
  const normalized = email.toLowerCase().trim();
  const orderId = orderIdForEmail(normalized);
  const price = Number(process.env.CRYPTO_PRICE_USD || "9");

  if (isDevMock()) {
    const paymentId = `dev-${Date.now()}`;
    return {
      paymentId,
      orderId,
      payAddress: "bc1q-dev-mock-address-for-local-testing-only",
      payAmount: "0.00012",
      payCurrency: payCurrency.toLowerCase(),
      priceUsd: price,
      dev: true,
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }

  const key = apiKey();
  if (!key) throw new Error("NOWPAYMENTS_API_KEY not configured");

  const existing = await listPaymentsByOrder(orderId);
  const active = existing.find((p) => ["waiting", "confirming", "sending"].includes(p.payment_status));
  if (active) {
    return formatPayment(active, price);
  }

  const finished = existing.find((p) => FINISHED.has(p.payment_status));
  if (finished) {
    markEmailPaid(normalized);
    return { alreadyPaid: true, email: normalized };
  }

  const res = await fetch(`${API_BASE}/payment`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: price,
      price_currency: "usd",
      pay_currency: payCurrency.toLowerCase(),
      order_id: orderId,
      order_description: `LocalDrop Pro — ${normalized}`,
      ipn_callback_url: `${process.env.SITE_URL}/api/crypto-webhook`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Payment provider error: ${err}`);
  }

  const data = await res.json();
  return formatPayment(data, price);
}

function formatPayment(data, priceUsd) {
  return {
    paymentId: String(data.payment_id || data.id),
    orderId: data.order_id,
    payAddress: data.pay_address,
    payAmount: data.pay_amount,
    payCurrency: data.pay_currency,
    priceUsd,
    expiresAt: data.expiration_estimate_date
      ? new Date(data.expiration_estimate_date).getTime()
      : Date.now() + 60 * 60 * 1000,
  };
}

export async function listPaymentsByOrder(orderId) {
  if (isDevMock()) return [];

  const key = apiKey();
  const res = await fetch(`${API_BASE}/payment/?order_id=${orderId}&limit=20`, {
    headers: { "x-api-key": key },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.data || data.payments || (Array.isArray(data) ? data : []);
}

export async function getPaymentStatus(paymentId) {
  if (isDevMock()) {
    return { status: "waiting", email: null, dev: true };
  }

  const key = apiKey();
  const res = await fetch(`${API_BASE}/payment/${paymentId}`, {
    headers: { "x-api-key": key },
  });

  if (!res.ok) throw new Error("Payment not found");
  const data = await res.json();
  const email = extractEmail(data.order_description);

  if (FINISHED.has(data.payment_status)) {
    if (email) markEmailPaid(email);
  }

  return {
    status: data.payment_status,
    email,
    payAddress: data.pay_address,
    payAmount: data.pay_amount,
    payCurrency: data.pay_currency,
  };
}

function extractEmail(description) {
  if (!description) return null;
  const match = description.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return match ? match[0].toLowerCase() : null;
}

export async function hasPaidCryptoOrder(email) {
  const normalized = email.toLowerCase().trim();

  if (isEmailMarkedPaid(normalized)) return true;

  if (isDevMock()) return false;

  const orderId = orderIdForEmail(normalized);
  const payments = await listPaymentsByOrder(orderId);
  const paid = payments.some((p) => FINISHED.has(p.payment_status));

  if (paid) markEmailPaid(normalized);
  return paid;
}

export async function getAvailableCurrencies() {
  if (isDevMock()) {
    return ["btc", "eth", "usdttrc20", "ltc", "sol"];
  }

  const key = apiKey();
  const res = await fetch(`${API_BASE}/currencies`, { headers: { "x-api-key": key } });
  if (!res.ok) return ["btc", "eth", "usdttrc20"];
  const data = await res.json();
  const preferred = ["btc", "eth", "usdttrc20", "usdterc20", "ltc", "sol", "doge"];
  const all = data.currencies || [];
  return preferred.filter((c) => all.includes(c)).concat(all.filter((c) => !preferred.includes(c))).slice(0, 12);
}

export function simulateDevPayment(email) {
  markEmailPaid(email.toLowerCase().trim());
}
