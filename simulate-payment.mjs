/**
 * Simulates full BTC payment flow and shows what happens at each step.
 * Run: node simulate-payment.mjs
 * Requires: npm run dev:api (port 3002) and npm run dev (port 5173 or 5174)
 */
const API = `http://localhost:${process.env.LOCALDROP_API_PORT || 3002}`;
const APP = process.env.APP_URL || "http://localhost:5173";
const EMAIL = "demo-btc@example.com";
const DEVICE_ID = "LD-00000000-0000-4000-8000-000000000099";

function step(n, title) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`STEP ${n}: ${title}`);
  console.log("─".repeat(50));
}

async function main() {
  console.log("\n🪙 LocalDrop — Simulated BTC Payment Demo\n");

  step(1, "Customer opens Pay with Crypto page");
  console.log(`  URL: ${APP}/pay.html`);
  console.log(`  Enters email: ${EMAIL}`);
  console.log(`  Selects: BTC`);

  step(2, "App requests BTC payment address from API");
  const createRes = await fetch(`${API}/api/create-crypto-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, payCurrency: "btc" }),
  });
  const payment = await createRes.json();
  if (!createRes.ok) throw new Error(JSON.stringify(payment));

  console.log(`  Payment ID:  ${payment.paymentId}`);
  console.log(`  Send exactly: ${payment.payAmount} BTC`);
  console.log(`  To address:   ${payment.payAddress}`);
  console.log(`  QR code shown on screen for wallet scan`);
  console.log(`  (In production, customer sends BTC from their wallet)`);

  step(3, "Customer clicks 'Dev: simulate payment' (or blockchain confirms)");
  const simRes = await fetch(`${API}/api/check-crypto-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      email: EMAIL,
      simulate: true,
    }),
  });
  const sim = await simRes.json();
  if (!simRes.ok) throw new Error(JSON.stringify(sim));

  console.log(`  Status: ${sim.status}`);
  console.log(`  Message: ${sim.message}`);
  if (sim.devLink) {
    console.log(`  Activation link (would be emailed in production):`);
    console.log(`  ${sim.devLink}`);
  }

  step(4, "Customer receives email with activation link (not the license)");
  const actReq = await fetch(`${API}/api/request-activation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL }),
  });
  const actReqData = await actReq.json();
  if (!actReq.ok) throw new Error(JSON.stringify(actReqData));

  console.log(`  ${actReqData.message}`);
  if (actReqData.devLink) {
    console.log(`  Dev activation link: ${actReqData.devLink}`);
  }

  const token = (sim.devLink || actReqData.devLink || "").split("token=")[1];
  if (!token) throw new Error("No activation token generated");

  step(5, "Customer clicks activation link → license delivered to browser");
  const completeRes = await fetch(`${API}/api/complete-activation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, deviceId: DEVICE_ID }),
  });
  const complete = await completeRes.json();
  if (!completeRes.ok) throw new Error(JSON.stringify(complete));

  console.log(`  ${complete.message}`);
  console.log(`  License key (stored in browser, never emailed):`);
  console.log(`  ${complete.license.slice(0, 40)}...`);

  step(6, "Result — Pro is active on this device");
  console.log(`  ✓ Unlimited jobs per day`);
  console.log(`  ✓ Files up to 100 MB`);
  console.log(`  ✓ License bound to device: ${DEVICE_ID}`);
  console.log(`  ✓ Customer can now use all tools without limits`);

  console.log(`\n${"═".repeat(50)}`);
  console.log("Try it yourself in the browser:");
  console.log(`  1. Open ${APP}/pay.html`);
  console.log(`  2. Enter email, select BTC, click Generate payment address`);
  console.log(`  3. Click "Dev: simulate payment"`);
  console.log(`  4. Follow the activation link shown`);
  console.log("═".repeat(50) + "\n");
}

main().catch((err) => {
  console.error("\nError:", err.message);
  console.error("\nMake sure both servers are running:");
  console.error("  npm run dev:api");
  console.error("  npm run dev");
  process.exit(1);
});
