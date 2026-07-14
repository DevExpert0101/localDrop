import { getDeviceId } from "./device.js";
import { activatePro } from "./limits.js";
import { PRO_CONFIG } from "./config.js";
import { createFooter, createHeader } from "./ui.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

const app = document.getElementById("app");
app.innerHTML = `
  ${createHeader("")}
  <main class="container">
    <section class="tool-header">
      <h1>Activate Pro</h1>
      <p>Secure activation — your license is delivered directly to this browser</p>
    </section>

    <div class="activate-page" id="activate-panel">
      <div class="device-box">
        <label>This device</label>
        <code id="device-id">…</code>
      </div>

      <div id="token-flow" hidden>
        <p class="status info">Activating your device…</p>
        <div class="progress-wrap visible"><div class="progress-bar"><div class="fill" style="width:60%"></div></div></div>
      </div>

      <div id="email-flow">
        <p class="hint">Enter the email you used when purchasing Pro. We'll send a secure activation link — <strong>not</strong> a license key in email.</p>
        <label for="email-input">Email address</label>
        <input type="email" id="email-input" placeholder="you@example.com" autocomplete="email" />
        <p class="modal-status" id="email-status" style="min-height:1.2rem"></p>
        <button type="button" class="btn btn-primary btn-block" id="send-link-btn">Send activation link</button>
        <p class="hint" style="margin-top:1rem"><a href="/">← Back to LocalDrop</a></p>
      </div>

      <div id="success-flow" hidden>
        <p class="pro-active-msg">✓ Pro is now active on this device!</p>
        <a href="/" class="btn btn-primary btn-block" style="margin-top:1rem;text-decoration:none">Start using Pro</a>
      </div>

      <div id="error-flow" hidden>
        <p class="status error" id="error-msg"></p>
        <button type="button" class="btn btn-secondary btn-block" id="retry-btn">Try again</button>
      </div>
    </div>
  </main>
  ${createFooter()}
`;

document.querySelector("#device-id").textContent = getDeviceId();

const params = new URLSearchParams(location.search);
const token = params.get("token");

async function completeActivation(activationToken) {
  document.getElementById("email-flow").hidden = true;
  document.getElementById("token-flow").hidden = false;

  const res = await fetch(`${API_BASE}/api/complete-activation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: activationToken, deviceId: getDeviceId() }),
  });

  const data = await res.json();
  document.getElementById("token-flow").hidden = true;

  if (!res.ok || !data.license) {
    document.getElementById("error-flow").hidden = false;
    document.getElementById("error-msg").textContent = data.error || "Activation failed.";
    return;
  }

  const result = await activatePro(data.license);
  if (!result.ok) {
    document.getElementById("error-flow").hidden = false;
    document.getElementById("error-msg").textContent = result.error || "Could not store license.";
    return;
  }

  document.getElementById("success-flow").hidden = false;
  history.replaceState({}, "", "/activate.html");
}

if (token) {
  completeActivation(token);
}

document.getElementById("send-link-btn")?.addEventListener("click", async () => {
  const email = document.getElementById("email-input").value.trim();
  const status = document.getElementById("email-status");
  const btn = document.getElementById("send-link-btn");

  if (!email) {
    status.textContent = "Enter your email.";
    status.className = "modal-status error";
    return;
  }

  btn.disabled = true;
  status.textContent = "Sending…";
  status.className = "modal-status";

  try {
    const res = await fetch(`${API_BASE}/api/request-activation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!res.ok) {
      status.textContent = data.error || "Request failed.";
      status.className = "modal-status error";
      return;
    }

    status.textContent = data.message;
    status.className = "modal-status success";

    if (data.devLink && import.meta.env.DEV) {
      status.innerHTML += `<br><a href="${data.devLink}" style="color:var(--accent)">Dev: click to activate</a>`;
    }
  } catch {
    status.textContent = "Could not reach server. Deploy API or run npm run dev:api";
    status.className = "modal-status error";
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("retry-btn")?.addEventListener("click", () => {
  document.getElementById("error-flow").hidden = true;
  document.getElementById("email-flow").hidden = false;
});
