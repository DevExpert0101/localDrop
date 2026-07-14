import { chromium } from "playwright";
import { PDFDocument, rgb } from "pdf-lib";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const BASE = "http://localhost:5173";
const FIXTURES = join(import.meta.dirname, "test-fixtures");
const TEST_DEVICE_ID = "LD-00000000-0000-4000-8000-000000000001";
const TEST_LICENSE =
  "LDPRO1.eyJ2IjoxLCJ0IjoicHJvIiwiZCI6IkxELTAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSIsImUiOm51bGx9.lEtt9YVF4rr3jGMzO6_T-3Adho6X5zkqP7ZJt4NjzCWaKmJ0lm8B2KQE9kY_yIB2XL47WsWhnklxE9qcXp47DA";

async function makePdf(pages, name) {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([400, 500]);
    page.drawText(`Page ${i}`, { x: 50, y: 450, size: 20, color: rgb(0, 0, 0) });
  }
  await writeFile(join(FIXTURES, name), await doc.save());
  return join(FIXTURES, name);
}

async function makePng() {
  const path = join(FIXTURES, "test.png");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  await writeFile(path, png);
  return path;
}

let bugs = [];
function bug(msg) {
  bugs.push(msg);
  console.error(`BUG: ${msg}`);
}

async function getPageErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

async function waitForDownload(page, action) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    action(),
  ]);
  return download;
}

async function run() {
  await mkdir(FIXTURES, { recursive: true });
  const pdf3 = await makePdf(3, "three-pages.pdf");
  const png = await makePng();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });

  // Enable Pro to avoid daily limit interference
  await context.addInitScript(({ deviceId, license }) => {
    localStorage.setItem("localdrop_device_id", deviceId);
    localStorage.setItem("localdrop_license", license);
    localStorage.removeItem("localdrop_usage");
  }, { deviceId: TEST_DEVICE_ID, license: TEST_LICENSE });

  const page = await context.newPage();
  const errors = await getPageErrors(page);

  // --- Every N ---
  console.log("\nTesting Split every N...");
  await page.goto(`${BASE}/split-pdf.html`);
  await page.locator("#file-input").setInputFiles(pdf3);
  await page.waitForTimeout(1000);
  await page.locator('[data-mode="every"]').click();
  await page.locator("#every-input").fill("2");

  try {
    const dl = await waitForDownload(page, () => page.locator("#split-btn").click());
    console.log(`  OK: ${dl.suggestedFilename()}`);
  } catch (e) {
    const status = await page.locator("#status").textContent();
    bug(`Split every N: ${e.message} | status: ${status}`);
  }

  // --- Compress ---
  console.log("\nTesting Compress...");
  await page.goto(`${BASE}/compress-pdf.html`);
  await page.locator("#file-input").setInputFiles(pdf3);
  await page.waitForTimeout(1000);

  try {
    const dl = await waitForDownload(page, () => page.locator("#compress-btn").click());
    console.log(`  OK: ${dl.suggestedFilename()}`);
  } catch (e) {
    const status = await page.locator("#status").textContent();
    bug(`Compress: ${e.message} | status: ${status}`);
  }

  // --- Images PNG ---
  console.log("\nTesting Images (PNG)...");
  await page.goto(`${BASE}/images-to-pdf.html`);
  await page.locator("#file-input").setInputFiles(png);
  await page.waitForTimeout(500);

  try {
    const dl = await waitForDownload(page, () => page.locator("#convert-btn").click());
    console.log(`  OK: ${dl.suggestedFilename()}`);
  } catch (e) {
    const status = await page.locator("#status").textContent();
    bug(`Images PNG: ${e.message} | status: ${status}`);
  }

  // --- Each page mode ---
  console.log("\nTesting Split each page...");
  await page.goto(`${BASE}/split-pdf.html`);
  await page.locator("#file-input").setInputFiles(pdf3);
  await page.waitForTimeout(1000);
  await page.locator('[data-mode="each"]').click();

  try {
    const dl = await waitForDownload(page, () => page.locator("#split-btn").click());
    console.log(`  OK: ${dl.suggestedFilename()}`);
  } catch (e) {
    const status = await page.locator("#status").textContent();
    bug(`Split each: ${e.message} | status: ${status}`);
  }

  // --- Toast on success ---
  console.log("\nTesting notifications...");
  await page.goto(`${BASE}/merge-pdf.html`);
  await page.locator("#file-input").setInputFiles([pdf3, pdf3]);
  await page.waitForTimeout(500);
  await page.locator("#merge-btn").click();
  await page.waitForTimeout(2000);
  if (!(await page.locator(".toast-success").isVisible())) bug("No success toast after merge");

  // --- Free limit blocks download ---
  console.log("\nTesting free limit UX...");
  const ctx2 = await browser.newContext({ acceptDownloads: true });
  await ctx2.addInitScript(({ deviceId }) => {
    localStorage.setItem("localdrop_device_id", deviceId);
    localStorage.removeItem("localdrop_license");
    localStorage.removeItem("localdrop_pro");
    localStorage.setItem("localdrop_usage", JSON.stringify({ [new Date().toISOString().slice(0, 10)]: 3 }));
  }, { deviceId: TEST_DEVICE_ID });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/merge-pdf.html`);
  await page2.locator("#file-input").setInputFiles([pdf3, pdf3]);
  await page2.waitForTimeout(500);
  await page2.locator("#merge-btn").click();
  await page2.waitForTimeout(1500);
  const limitToast = await page2.locator(".toast-error").isVisible();
  const proModal = await page2.locator("#pro-modal.open").isVisible();
  if (!limitToast) bug("Free limit: no error toast shown");
  if (!proModal) bug("Free limit: Pro modal should open automatically");

  await browser.close();

  if (errors.length) {
    console.log("\nPage errors:");
    errors.forEach((e) => console.log(" -", e));
  }

  console.log(`\n=== Found ${bugs.length} bug(s) ===`);
  bugs.forEach((b, i) => console.log(`${i + 1}. ${b}`));
  process.exit(bugs.length > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
