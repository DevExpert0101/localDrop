import { PRO_CONFIG } from "./config.js";
import { createFooter, createHeader } from "./ui.js";

const API = import.meta.env.VITE_API_URL || "";
let payment = null;
let pollTimer = null;

const app = document.getElementById("app");
app.innerHTML = `
  ${createHeader("")}
  <main class="container">
    <section class="tool-header">
      <h1>Pay with Crypto</h1>
      <p>LocalDrop Pro — <strong id="price-label">${PRO_CONFIG.priceLabel}</strong> one-time, lifetime on one device</p>
      <p class="payment-mode-badge" id="payment-mode" hidden></p>
    </section>

    <div class="activate-page" id="checkout-form">
      <label for="pay-email">Your email</label>
      <p class="hint">Used to send your activation link after payment is confirmed on-chain.</p>
      <input type="email" id="pay-email" placeholder="you@example.com" autocomplete="email" />

      <label for="pay-currency">Cryptocurrency</label>
      <select id="pay-currency"></select>
      <p class="hint" id="currency-warning" hidden></p>

      <button type="button" class="btn btn-primary btn-block" id="create-payment-btn" style="margin-top:1rem">
        Generate payment address
      </button>
      <p class="modal-status" id="checkout-status" style="min-height:1.2rem"></p>
    </div>

    <div class="activate-page crypto-payment-box" id="payment-box" hidden>
      <div class="crypto-amount">
        Send exactly <strong id="pay-amount">—</strong> <span id="pay-coin">—</span>
      </div>
      <div class="crypto-address-box">
        <label>To this address</label>
        <div class="device-row">
          <code id="pay-address">—</code>
          <button type="button" class="btn btn-secondary btn-sm" id="copy-address">Copy</button>
        </div>
      </div>
      <img id="qr-code" alt="Payment QR code" class="crypto-qr" width="200" height="200" />
      <p class="hint" id="payment-status">Waiting for blockchain confirmation…</p>
      <button type="button" class="btn btn-secondary btn-block" id="check-payment-btn">Check payment status</button>
      <button type="button" class="btn btn-primary btn-block" id="activate-after-btn" hidden>
        Send activation link to my email
      </button>
      <button type="button" class="btn btn-secondary btn-block dev-only" id="simulate-btn" hidden style="margin-top:0.5rem">
        Dev: simulate payment
      </button>
    </div>

    <div class="activate-page" id="success-box" hidden>
      <p class="pro-active-msg">✓ Payment confirmed!</p>
      <p class="hint" id="success-hint">Check your email for the activation link, or <a href="/activate.html">open activation page</a>.</p>
      <p class="hint" id="success-dev-link" hidden></p>
      <a href="/" class="btn btn-primary btn-block" style="margin-top:1rem;text-decoration:none">Back to LocalDrop</a>
    </div>
  </main>
  ${createFooter()}
`;

async function loadCurrencies() {
  const select = document.getElementById("pay-currency");
  const modeEl = document.getElementById("payment-mode");
  const warnEl = document.getElementById("currency-warning");
  const createBtn = document.getElementById("create-payment-btn");

  try {
    const res = await fetch(`${API}/api/create-crypto-payment`);
    const data = await res.json();
    const coins = data.currencies || [];
    const details = data.currencyDetails || [];

    if (data.priceUsd) {
      document.getElementById("price-label").textContent = `$${data.priceUsd}`;
    }

    if (!coins.length) {
      select.innerHTML = `<option value="">No coins available at this price</option>`;
      createBtn.disabled = true;
      warnEl.hidden = false;
      warnEl.textContent =
        data.warning ||
        "No cryptocurrencies accept this price right now (NOWPayments minimums). Try again later or raise CRYPTO_PRICE_USD.";
    } else {
      select.innerHTML = coins
        .map((c) => {
          const detail = details.find((d) => d.currency === c);
          const minLabel =
            detail?.minUsd != null ? ` (min ~$${Number(detail.minUsd).toFixed(2)})` : "";
          return `<option value="${c}">${c.toUpperCase()}${minLabel}</option>`;
        })
        .join("");
      createBtn.disabled = false;
      if (data.warning) {
        warnEl.hidden = false;
        warnEl.textContent = data.warning;
      } else {
        warnEl.hidden = true;
      }
    }

    if (data.realPayments) {
      modeEl.hidden = false;
      modeEl.textContent = data.sandbox
        ? "🔗 Real payment mode (NOWPayments sandbox)"
        : "🔗 Real payment mode (NOWPayments live)";
      modeEl.className = "payment-mode-badge real";
    } else {
      modeEl.hidden = false;
      modeEl.textContent = "⚗️ Dev mock mode — add NOWPAYMENTS_API_KEY to .env for real payments";
      modeEl.className = "payment-mode-badge mock";
    }
  } catch {
    select.innerHTML = `
      <option value="trx">TRX</option>
      <option value="ltc">LTC</option>
      <option value="sol">SOL</option>
    `;
  }
}

function setStatus(msg, type = "") {
  const el = document.getElementById("checkout-status");
  el.textContent = msg;
  el.className = `modal-status ${type}`;
}

function showPaymentBox(data) {
  payment = data;
  document.getElementById("checkout-form").hidden = true;
  document.getElementById("payment-box").hidden = false;

  document.getElementById("pay-amount").textContent = data.payAmount;
  document.getElementById("pay-coin").textContent = data.payCurrency?.toUpperCase();
  document.getElementById("pay-address").textContent = data.payAddress;

  const qr = document.getElementById("qr-code");
  const qrData = `${data.payCurrency}:${data.payAddress}?amount=${data.payAmount}`;
  qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  if (data.dev) {
    document.getElementById("simulate-btn").hidden = false;
  } else {
    document.getElementById("payment-status").textContent =
      "Send the exact amount above, then wait for blockchain confirmation (usually 10–30 min for BTC).";
    startPolling(10000);
  }
}

function startPolling(intervalMs = 15000) {
  stopPolling();
  pollTimer = setInterval(() => checkPayment(false), intervalMs);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
}

async function checkPayment(manual = true) {
  if (!payment?.paymentId) return;

  const email = document.getElementById("pay-email").value.trim();
  const statusEl = document.getElementById("payment-status");
  if (manual) statusEl.textContent = "Checking payment status…";

  try {
    const res = await fetch(`${API}/api/check-crypto-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payment.paymentId, email }),
    });
    const data = await res.json();

    if (data.finished) {
      stopPolling();
      document.getElementById("payment-box").hidden = true;
      document.getElementById("success-box").hidden = false;
      if (data.devLink) {
        const devEl = document.getElementById("success-dev-link");
        devEl.hidden = false;
        devEl.innerHTML = `Dev: <a href="${data.devLink}" style="color:var(--accent)">Activate Pro now</a>`;
      }
      return;
    }

    statusEl.textContent = data.message || `Status: ${data.status}`;
    if (["waiting", "confirming"].includes(data.status)) {
      document.getElementById("activate-after-btn").hidden = false;
    }
  } catch {
    statusEl.textContent = "Could not check status. Try again.";
  }
}

document.getElementById("create-payment-btn").addEventListener("click", async () => {
  const email = document.getElementById("pay-email").value.trim();
  const payCurrency = document.getElementById("pay-currency").value;
  const btn = document.getElementById("create-payment-btn");

  if (!email) {
    setStatus("Enter your email.", "error");
    return;
  }

  btn.disabled = true;
  setStatus("Creating payment…");

  try {
    const res = await fetch(`${API}/api/create-crypto-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, payCurrency }),
    });
    const data = await res.json();

    if (data.alreadyPaid) {
      document.getElementById("checkout-form").hidden = true;
      document.getElementById("success-box").hidden = false;
      return;
    }

    if (!res.ok) {
      setStatus(data.error || "Failed.", "error");
      return;
    }

    showPaymentBox(data);
  } catch {
    setStatus("Server unavailable. Run npm run dev:api", "error");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("copy-address")?.addEventListener("click", async () => {
  const addr = document.getElementById("pay-address").textContent;
  await navigator.clipboard.writeText(addr);
  document.getElementById("copy-address").textContent = "Copied!";
  setTimeout(() => {
    document.getElementById("copy-address").textContent = "Copy";
  }, 1500);
});

document.getElementById("check-payment-btn")?.addEventListener("click", () => checkPayment(true));
document.getElementById("activate-after-btn")?.addEventListener("click", () => checkPayment(true));

document.getElementById("simulate-btn")?.addEventListener("click", async () => {
  const email = document.getElementById("pay-email").value.trim();
  const statusEl = document.getElementById("payment-status");
  const btn = document.getElementById("simulate-btn");

  if (!email) {
    statusEl.textContent = "Enter your email first.";
    return;
  }

  stopPolling();
  btn.disabled = true;
  statusEl.textContent = "Simulating payment…";

  try {
    const res = await fetch(`${API}/api/check-crypto-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payment.paymentId, email, simulate: true }),
    });
    const data = await res.json();

    if (data.finished || data.status === "finished") {
      document.getElementById("payment-box").hidden = true;
      document.getElementById("success-box").hidden = false;
      if (data.devLink) {
        const devEl = document.getElementById("success-dev-link");
        devEl.hidden = false;
        devEl.innerHTML = `Dev: <a href="${data.devLink}" style="color:var(--accent)">Activate Pro now</a>`;
      }
      return;
    }

    statusEl.textContent = data.error || data.message || "Simulation failed.";
  } catch {
    statusEl.textContent = "Could not reach API. Run: npm run dev:api";
  } finally {
    btn.disabled = false;
  }
});

const params = new URLSearchParams(location.search);
if (params.get("email")) {
  document.getElementById("pay-email").value = params.get("email");
}

loadCurrencies();
