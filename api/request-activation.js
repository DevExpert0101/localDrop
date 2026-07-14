import { hasPaidOrder } from "./lib/orders.js";
import { createActivationToken } from "./lib/license.js";
import { sendActivationEmail } from "./lib/email.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const email = (req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const paid = await hasPaidOrder(email);
  if (!paid) {
    return res.status(403).json({
      error: "No Pro purchase found for this email. Use the same email you paid with.",
    });
  }

  try {
    const token = createActivationToken(email);
    const result = await sendActivationEmail(email, token);

    const response = {
      ok: true,
      message: "Activation link sent. Check your inbox (and spam folder).",
    };

    if (result.dev && result.activateUrl && process.env.DEV_BYPASS_ORDERS === "true") {
      response.devLink = result.activateUrl;
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not send activation email. Try again later." });
  }
}
