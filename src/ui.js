import { PRO_CONFIG } from "./config.js";
import { openProModal } from "./limits.js";

export function createHeader(activePage = "") {
  const pages = [
    { href: "/", label: "Home", id: "home" },
    { href: "/merge-pdf.html", label: "Merge", id: "merge" },
    { href: "/compress-pdf.html", label: "Compress", id: "compress" },
    { href: "/images-to-pdf.html", label: "Images→PDF", id: "images" },
    { href: "/split-pdf.html", label: "Split", id: "split" },
  ];

  const nav = pages
    .map(
      (p) =>
        `<a href="${p.href}" class="${activePage === p.id ? "active" : ""}">${p.label}</a>`
    )
    .join("");

  return `
    <header class="site-header container">
      <a href="/" class="logo">
        <span class="logo-icon">⬇</span>
        LocalDrop
      </a>
      <nav class="nav-links">${nav}</nav>
    </header>`;
}

export function createFooter() {
  return `
    <footer class="site-footer container">
      <p>Files are processed locally in your browser. Nothing is uploaded to any server.</p>
      <p>© ${new Date().getFullYear()} LocalDrop</p>
    </footer>`;
}

export function createProModal() {
  return `
    <div class="modal-overlay" id="pro-modal">
      <div class="modal modal-pro">
        <h3>Upgrade to Pro</h3>
        <ul class="pro-benefits">
          <li>Unlimited jobs every day</li>
          <li>Files up to 100 MB</li>
          <li>All tools included — lifetime on this device</li>
        </ul>

        <div class="pro-active-section" hidden>
          <p class="pro-active-msg">✓ Pro is active on this device.</p>
        </div>

        <div class="pro-activate-section">
          <div class="device-box">
            <label>This device</label>
            <div class="device-row">
              <code id="device-id">…</code>
              <button type="button" class="btn btn-secondary btn-sm" data-copy-device>Copy</button>
            </div>
          </div>

          <div class="buy-box">
            <p class="buy-price">One-time <strong>${PRO_CONFIG.priceLabel}</strong> — pay with crypto</p>
            <p class="hint">BTC, ETH, USDT, and more. No card required.</p>
            <a href="${PRO_CONFIG.payUrl}" class="btn btn-primary btn-block" data-buy-crypto style="text-decoration:none;text-align:center">Pay with Crypto</a>
          </div>

          <div class="license-box">
            <label for="activate-email">Already purchased? Activate with email</label>
            <p class="hint">We send a secure link — your license is <strong>never</strong> sent in email. It is delivered directly to this browser when you open the link.</p>
            <input type="email" id="activate-email" placeholder="Email used at checkout" autocomplete="email" />
            <p class="modal-status" id="email-activate-status" style="min-height:1.2rem;font-size:0.85rem"></p>
            <button type="button" class="btn btn-primary btn-block" data-send-activation>Send activation link</button>
            <p class="hint" style="margin-top:0.6rem"><a href="${PRO_CONFIG.activateUrl}">Open activation page</a></p>
          </div>

          <details class="manual-license">
            <summary>Support: enter license key manually</summary>
            <input type="text" id="license-input" placeholder="LDPRO1.xxxxx.yyyyy" spellcheck="false" />
            <p class="modal-status" style="min-height:1.2rem;font-size:0.85rem"></p>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" data-close>Cancel</button>
              <button type="button" class="btn btn-primary" data-activate>Activate key</button>
            </div>
          </details>
        </div>
      </div>
    </div>`;
}

export function setupDropZone(zone, input, onFiles) {
  const activate = () => input.click();

  zone.addEventListener("click", activate);
  input.addEventListener("change", () => {
    if (input.files?.length) onFiles(Array.from(input.files));
    input.value = "";
  });

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    if (e.dataTransfer?.files?.length) onFiles(Array.from(e.dataTransfer.files));
  });
}

export function renderFileList(container, files, onRemove) {
  if (!files.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = files
    .map(
      (f, i) => `
      <div class="file-item">
        <span class="name">${escapeHtml(f.name)}</span>
        <span class="size">${formatSize(f.size)}</span>
        <button type="button" data-remove="${i}" title="Remove">✕</button>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => onRemove(Number(btn.dataset.remove)));
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function setStatus(el, message, type = "info") {
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`;
}

export function setProgress(wrap, labelWrap, pct, label) {
  if (!wrap) return;
  wrap.classList.add("visible");
  const fill = wrap.querySelector(".fill");
  if (fill) fill.style.width = `${pct}%`;
  if (labelWrap) labelWrap.textContent = label || "";
}

export function hideProgress(wrap) {
  if (wrap) wrap.classList.remove("visible");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function handleLimitFailure(statusEl, limit) {
  setStatus(statusEl, limit.message, "error");
  showToast({ title: "Limit reached", message: limit.message, type: "error" });
  openProModal();
}

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast({ title, message, type = "success" }) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Close">✕</button>`;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  const remove = () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector(".toast-close").addEventListener("click", remove);
  setTimeout(remove, 7000);
}

/** Errors and non-download feedback — shown immediately. */
export function notifyResult({ title, message, type = "error" }) {
  showToast({ title, message, type });
}

/** After a file download — wait for the save dialog, then show toast (no OS notification). */
export function notifyDownloadReady({ title, message }) {
  setTimeout(() => {
    showToast({ title, message, type: "success" });
  }, 1200);
}
