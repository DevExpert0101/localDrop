import { PRO_MAX_BYTES } from "./config.js";
import { getDeviceId } from "./device.js";
import {
  clearLicense,
  getStoredLicense,
  isLicenseActive,
  storeLicense,
  verifyLicense,
  formatLicenseExpiry,
} from "./license.js";
import { PRO_CONFIG } from "./config.js";

const STORAGE_KEY = "localdrop_usage";
const LEGACY_PRO_KEY = "localdrop_pro";

export const FREE_DAILY_LIMIT = 3;
export const FREE_MAX_BYTES = 10 * 1024 * 1024;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readUsage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeUsage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function migrateLegacyPro() {
  if (localStorage.getItem(LEGACY_PRO_KEY) === "true") {
    localStorage.removeItem(LEGACY_PRO_KEY);
  }
}

migrateLegacyPro();

let proCache = null;
let proCacheAt = 0;

export async function isPro() {
  const now = Date.now();
  if (proCache !== null && now - proCacheAt < 5000) return proCache;

  if (PRO_CONFIG.demoLicense && getStoredLicense() === PRO_CONFIG.demoLicense) {
    proCache = true;
    proCacheAt = now;
    return true;
  }

  proCache = await isLicenseActive();
  proCacheAt = now;
  return proCache;
}

export function invalidateProCache() {
  proCache = null;
}

export async function activatePro(license) {
  const trimmed = license.trim();

  if (PRO_CONFIG.demoLicense && trimmed.toUpperCase() === PRO_CONFIG.demoLicense) {
    storeLicense(PRO_CONFIG.demoLicense);
    invalidateProCache();
    return { ok: true, expires: null };
  }

  const result = await verifyLicense(trimmed);
  if (!result.ok) return result;

  storeLicense(trimmed);
  invalidateProCache();
  return { ok: true, expires: result.expires };
}

export async function deactivatePro() {
  clearLicense();
  invalidateProCache();
}

export function getUsageToday() {
  const usage = readUsage();
  const key = todayKey();
  return usage[key] || 0;
}

export async function getRemainingToday() {
  if (await isPro()) return Infinity;
  return Math.max(0, FREE_DAILY_LIMIT - getUsageToday());
}

export async function recordUsage() {
  if (await isPro()) return;
  const usage = readUsage();
  const key = todayKey();
  usage[key] = (usage[key] || 0) + 1;
  writeUsage(usage);
}

export async function checkLimits(totalBytes) {
  if (await isPro()) {
    if (totalBytes > PRO_MAX_BYTES) {
      const mb = (PRO_MAX_BYTES / (1024 * 1024)).toFixed(0);
      return { ok: false, message: `File(s) exceed ${mb} MB Pro limit.` };
    }
    return { ok: true };
  }

  if (getUsageToday() >= FREE_DAILY_LIMIT) {
    return {
      ok: false,
      message: `Free limit reached (${FREE_DAILY_LIMIT} jobs/day). Upgrade to Pro for unlimited use.`,
    };
  }

  if (totalBytes > FREE_MAX_BYTES) {
    const mb = (FREE_MAX_BYTES / (1024 * 1024)).toFixed(0);
    return {
      ok: false,
      message: `File(s) exceed ${mb} MB free limit. Upgrade to Pro or use smaller files.`,
    };
  }

  return { ok: true };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function renderUsageBar(container) {
  if (!container) return;

  const remaining = await getRemainingToday();
  const pro = await isPro();

  if (pro) {
    const stored = getStoredLicense();
    let expiryLabel = "";
    if (stored && stored !== PRO_CONFIG.demoLicense) {
      const v = await verifyLicense(stored);
      if (v.ok) expiryLabel = ` · ${formatLicenseExpiry(v.expires)}`;
    }
    container.innerHTML = `<span><strong>Pro</strong> — unlimited use${expiryLabel}</span>`;
  } else {
    container.innerHTML = `<span><strong>${remaining}</strong> of ${FREE_DAILY_LIMIT} free jobs left today</span>
       <a href="#" data-pro-link>Upgrade to Pro</a>`;
  }

  container.querySelector("[data-pro-link]")?.addEventListener("click", (e) => {
    e.preventDefault();
    openProModal();
  });
}

export function openProModal() {
  const modal = document.getElementById("pro-modal");
  if (!modal) return;
  modal.classList.add("open");
  const deviceEl = modal.querySelector("#device-id");
  if (deviceEl) deviceEl.textContent = getDeviceId();
}

export function setupProModal() {
  const modal = document.getElementById("pro-modal");
  if (!modal) return;

  const close = () => modal.classList.remove("open");
  modal.querySelector("[data-close]")?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector("#device-id").textContent = getDeviceId();

  modal.querySelector("[data-copy-device]")?.addEventListener("click", async () => {
    const btn = modal.querySelector("[data-copy-device]");
    const id = getDeviceId();
    try {
      await navigator.clipboard.writeText(id);
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1500);
    } catch {
      btn.textContent = "Copy failed";
    }
  });

  modal.querySelector("[data-buy-crypto]")?.addEventListener("click", () => {
    const email = modal.querySelector("#activate-email")?.value?.trim();
    const url = email ? `${PRO_CONFIG.payUrl}?email=${encodeURIComponent(email)}` : PRO_CONFIG.payUrl;
    location.href = url;
  });

  const apiBase = import.meta.env.VITE_API_URL || "";

  modal.querySelector("[data-send-activation]")?.addEventListener("click", async () => {
    const email = modal.querySelector("#activate-email")?.value?.trim();
    const status = modal.querySelector("#email-activate-status");
    const btn = modal.querySelector("[data-send-activation]");

    if (!email) {
      status.textContent = "Enter your email.";
      status.className = "modal-status error";
      return;
    }

    btn.disabled = true;
    status.textContent = "Sending…";
    status.className = "modal-status";

    try {
      const res = await fetch(`${apiBase}/api/request-activation`, {
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
        status.innerHTML += ` <a href="${data.devLink}" style="color:var(--accent)">Dev link</a>`;
      }
    } catch {
      status.textContent = "Server unavailable. Use activation page after deploy.";
      status.className = "modal-status error";
    } finally {
      btn.disabled = false;
    }
  });

  modal.querySelector("[data-activate]")?.addEventListener("click", async () => {
    const input = modal.querySelector("#license-input");
    const status = modal.querySelector(".modal-status");
    status.textContent = "Verifying…";
    status.className = "modal-status";

    const result = await activatePro(input?.value || "");
    if (result.ok) {
      status.textContent = "Pro activated! Refreshing…";
      status.className = "modal-status success";
      setTimeout(() => location.reload(), 800);
    } else {
      status.textContent = result.error || "Invalid license key.";
      status.className = "modal-status error";
    }
  });

  isPro().then((pro) => {
    if (pro) {
      modal.querySelector(".pro-activate-section")?.setAttribute("hidden", "");
      modal.querySelector(".pro-active-section")?.removeAttribute("hidden");
    }
  });
}
