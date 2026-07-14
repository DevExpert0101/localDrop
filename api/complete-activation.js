import { hasPaidOrder } from "./lib/orders.js";
import { verifyActivationToken, signLicense } from "./lib/license.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.body?.token || "").trim();
  const deviceId = (req.body?.deviceId || "").trim();

  const email = verifyActivationToken(token);
  if (!email) {
    return res.status(400).json({ error: "This activation link is invalid or expired. Request a new one." });
  }

  if (!deviceId.startsWith("LD-")) {
    return res.status(400).json({ error: "Invalid device. Open this link in the same browser where you use LocalDrop." });
  }

  const paid = await hasPaidOrder(email);
  if (!paid) {
    return res.status(403).json({ error: "No active purchase found for this email." });
  }

  try {
    const license = signLicense(deviceId, true);
    return res.status(200).json({
      ok: true,
      license,
      message: "Pro activated on this device.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server misconfigured. Contact support." });
  }
}
