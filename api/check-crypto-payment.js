import { getPaymentStatus, simulateDevPayment, usingRealPayments } from "./lib/crypto.js";
import { createActivationToken } from "./lib/license.js";
import { sendActivationEmail } from "./lib/email.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const paymentId = (req.body?.paymentId || "").trim();
  const email = (req.body?.email || "").trim().toLowerCase();
  const simulate = req.body?.simulate === true || req.body?.simulate === "true";
  const isDevPayment = paymentId.startsWith("dev-");

  if (!paymentId) {
    return res.status(400).json({ error: "Missing payment ID." });
  }

  if (simulate && !usingRealPayments() && (paymentId.startsWith("dev-") || process.env.DEV_BYPASS_ORDERS === "true")) {
    if (!email) return res.status(400).json({ error: "Email required for dev simulate." });
    simulateDevPayment(email);
    const token = createActivationToken(email);
    const mail = await sendActivationEmail(email, token);
    return res.status(200).json({
      status: "finished",
      finished: true,
      message: "Payment confirmed! Check your email for the activation link.",
      devLink: mail.activateUrl,
    });
  }

  try {
    const result = await getPaymentStatus(paymentId);
    const finished = ["finished", "confirmed", "sending"].includes(result.status);

    const response = {
      status: result.status,
      finished,
      message: finished
        ? "Payment confirmed! You can now activate Pro."
        : "Waiting for payment confirmation on the blockchain…",
    };

    if (finished && email) {
      const token = createActivationToken(email);
      await sendActivationEmail(email, token);
      response.message = "Payment confirmed! Check your email for the activation link.";
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Could not check payment." });
  }
}
