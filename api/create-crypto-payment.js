import { createPayment, getAvailableCurrencies, usingRealPayments } from "./lib/crypto.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    try {
      const currencies = await getAvailableCurrencies();
      return res.status(200).json({
        currencies,
        priceUsd: Number(process.env.CRYPTO_PRICE_USD || "9"),
        realPayments: usingRealPayments(),
        sandbox: process.env.NOWPAYMENTS_SANDBOX === "true",
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const email = (req.body?.email || "").trim().toLowerCase();
  const payCurrency = (req.body?.payCurrency || "btc").toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  try {
    const payment = await createPayment(email, payCurrency);

    if (payment.alreadyPaid) {
      return res.status(200).json({
        alreadyPaid: true,
        message: "Payment already confirmed. You can activate Pro now.",
        email,
      });
    }

    return res.status(200).json({ ok: true, ...payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Could not create payment." });
  }
}
