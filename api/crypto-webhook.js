import { createHmac, timingSafeEqual } from "crypto";
import { markEmailPaid } from "./lib/crypto.js";

function verifyIpnSignature(body, signature) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;

  const sorted = typeof body === "string" ? body : JSON.stringify(body, Object.keys(body).sort());
  const expected = createHmac("sha512", secret).update(sorted).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["x-nowpayments-sig"];
  if (process.env.NOWPAYMENTS_IPN_SECRET && !verifyIpnSignature(req.body, sig)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const status = req.body?.payment_status;
  const description = req.body?.order_description || "";

  if (["finished", "confirmed"].includes(status)) {
    const match = description.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (match) markEmailPaid(match[0]);
  }

  return res.status(200).json({ ok: true });
}
