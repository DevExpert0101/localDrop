import { createHash } from "crypto";

const API_BASE =
  process.env.NOWPAYMENTS_SANDBOX === "true"
    ? "https://api-sandbox.nowpayments.io/v1"
    : "https://api.nowpayments.io/v1";

const FINISHED = new Set(["finished", "confirmed", "sending"]);

/** Prefer low network-fee / low-min coins for a $1–$2 product price */
const PREFERRED_COINS = ["trx", "ltc", "xmr", "sol", "doge", "btc", "eth", "usdttrc20", "usdterc20"];

/** In-memory paid emails for dev / webhook cache */
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

export function getPriceUsd() {
  return Number(process.env.CRYPTO_PRICE_USD || "2");
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

/**
 * NOWPayments minimum for paying with `currency` (fiat USD equivalent).
 * Min depends on coin pair + payout wallet — always check live.
 */
export async function getMinAmountUsd(payCurrency) {
  if (isDevMock()) return 0;

  const key = apiKey();
  const coin = payCurrency.toLowerCase();
  const url = new URL(`${API_BASE}/min-amount`);
  url.searchParams.set("currency_from", coin);
  url.searchParams.set("currency_to", coin);
  url.searchParams.set("fiat_equivalent", "usd");

  const res = await fetch(url, { headers: { "x-api-key": key } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Could not check minimum for ${coin}: ${err}`);
  }

  const data = await res.json();
  return Number(data.fiat_equivalent ?? data.min_amount ?? Infinity);
}

export async function assertPriceMeetsMin(payCurrency, priceUsd = getPriceUsd()) {
  const minUsd = await getMinAmountUsd(payCurrency);
  if (priceUsd + 0.001 < minUsd) {
    throw new Error(
      `${payCurrency.toUpperCase()} minimum is about $${minUsd.toFixed(2)}. ` +
        `Our price is $${priceUsd}. Choose another coin, or ask support.`
    );
  }
  return minUsd;
}

export async function createPayment(email, payCurrency = "trx") {
  const normalized = email.toLowerCase().trim();
  const orderId = orderIdForEmail(normalized);
  const price = getPriceUsd();
  const coin = payCurrency.toLowerCase();

  if (isDevMock()) {
    const paymentId = `dev-${Date.now()}`;
    return {
      paymentId,
      orderId,
      payAddress: "dev-mock-address-for-local-testing-only",
      payAmount: "2.00",
      payCurrency: coin,
      priceUsd: price,
      dev: true,
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }

  const key = apiKey();
  if (!key) throw new Error("NOWPAYMENTS_API_KEY not configured");

  await assertPriceMeetsMin(coin, price);

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
      pay_currency: coin,
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

/**
 * Currencies that can accept our product price (below NOWPayments min for that coin are excluded).
 */
export async function getAvailableCurrencies() {
  const price = getPriceUsd();

  if (isDevMock()) {
    return {
      currencies: ["trx", "ltc", "sol", "btc", "eth"],
      currencyDetails: [
        { currency: "trx", minUsd: 0, ok: true },
        { currency: "ltc", minUsd: 0, ok: true },
        { currency: "sol", minUsd: 0, ok: true },
        { currency: "btc", minUsd: 0, ok: true },
        { currency: "eth", minUsd: 0, ok: true },
      ],
      priceUsd: price,
      warning: null,
    };
  }

  const key = apiKey();
  const res = await fetch(`${API_BASE}/currencies`, { headers: { "x-api-key": key } });
  if (!res.ok) {
    return {
      currencies: ["trx", "ltc"],
      currencyDetails: [],
      priceUsd: price,
      warning: "Could not load currencies from NOWPayments.",
    };
  }

  const data = await res.json();
  const all = data.currencies || [];
  const candidates = PREFERRED_COINS.filter((c) => all.includes(c));

  const details = [];
  for (const coin of candidates) {
    try {
      const minUsd = await getMinAmountUsd(coin);
      details.push({
        currency: coin,
        minUsd,
        ok: price + 0.001 >= minUsd,
      });
    } catch {
      details.push({ currency: coin, minUsd: null, ok: false });
    }
  }

  const usable = details.filter((d) => d.ok).map((d) => d.currency);
  let warning = null;

  if (!usable.length) {
    warning =
      `No coins currently accept $${price}. NOWPayments minimums are higher for most coins. ` +
      `Raise CRYPTO_PRICE_USD or use a payment method with lower minimums (e.g. Lightning / BTCPay).`;
  } else if (usable.length < candidates.length) {
    const blocked = details.filter((d) => !d.ok).map((d) => d.currency.toUpperCase());
    warning = `Some coins are hidden because their minimum is above $${price}: ${blocked.join(", ")}.`;
  }

  return {
    currencies: usable.length ? usable : [],
    currencyDetails: details,
    priceUsd: price,
    warning,
  };
}

export function simulateDevPayment(email) {
  markEmailPaid(email.toLowerCase().trim());
}
