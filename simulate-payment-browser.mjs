import { chromium } from "playwright";

const APP = process.env.APP_URL || "http://localhost:5173";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("\n🌐 Browser simulation — BTC payment UI\n");

  await page.goto(`${APP}/pay.html`);
  console.log("1. Opened /pay.html");

  await page.fill("#pay-email", "browser-demo@example.com");
  await page.selectOption("#pay-currency", "btc");
  await page.click("#create-payment-btn");
  await page.waitForTimeout(800);
  console.log("2. Generated BTC payment address");

  const amount = await page.locator("#pay-amount").textContent();
  const address = await page.locator("#pay-address").textContent();
  console.log(`   Amount: ${amount} BTC`);
  console.log(`   Address: ${address?.slice(0, 30)}...`);

  await page.click("#simulate-btn");
  await page.waitForTimeout(2000);

  const successVisible = await page.locator("#success-box").isVisible();
  if (successVisible) {
    console.log("4. ✓ Success screen: 'Payment confirmed!'");
    const devLink = await page.locator("#success-dev-link a").getAttribute("href").catch(() => null);
    if (devLink) {
      console.log("5. Opening activation link...");
      await page.goto(devLink);
      await page.waitForTimeout(2500);
      if (await page.locator("#success-flow").isVisible()) {
        console.log("6. ✓ Pro activated on this device!");
      } else {
        console.log("6. Activation page loaded — complete activation in browser");
      }
    }
  } else {
    const status = await page.locator("#payment-status").textContent();
    console.log(`4. Status: ${status}`);
  }

  await browser.close();
  console.log("\nDone. Open http://localhost:5173/pay.html to try yourself.\n");
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
