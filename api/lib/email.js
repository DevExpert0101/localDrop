/**
 * Send activation link only — NEVER the license key.
 * License is delivered over HTTPS when user opens the link in their browser.
 */
export async function sendActivationEmail(email, token) {
  const siteUrl = process.env.SITE_URL || "http://localhost:5173";
  const activateUrl = `${siteUrl}/activate.html?token=${encodeURIComponent(token)}`;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "LocalDrop <onboarding@resend.dev>";

  const subject = "Activate your LocalDrop Pro";
  const html = `
    <h2>Activate LocalDrop Pro</h2>
    <p>Click the button below on the <strong>same device</strong> where you use LocalDrop.</p>
    <p><a href="${activateUrl}" style="display:inline-block;padding:12px 24px;background:#3dd6c6;color:#0b0f14;text-decoration:none;border-radius:8px;font-weight:bold">Activate Pro</a></p>
    <p style="color:#666;font-size:14px">This link expires in 30 minutes and can only be used once per open.</p>
    <p style="color:#666;font-size:14px">For security, your license is <strong>not</strong> included in this email — it is generated and delivered directly to your browser when you click the link.</p>
    <p style="color:#999;font-size:12px">If you didn't purchase LocalDrop Pro, ignore this email.</p>
  `;

  if (!resendKey) {
    console.log("\n--- EMAIL (RESEND_API_KEY not set) ---");
    console.log(`To: ${email}`);
    console.log(`Activation link: ${activateUrl}`);
    console.log("-------------------------------------\n");
    return { dev: true, activateUrl };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: email, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Email failed: ${err}`);
  }

  return { dev: false };
}
