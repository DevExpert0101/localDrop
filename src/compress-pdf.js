import {
  checkLimits,
  formatBytes,
  recordUsage,
  renderUsageBar,
  setupProModal,
} from "./limits.js";
import { compressPdf } from "./pdf-utils.js";
import {
  createFooter,
  createHeader,
  createProModal,
  downloadBlob,
  hideProgress,
  renderFileList,
  setProgress,
  setStatus,
  setupDropZone,
  notifyResult,
  notifyDownloadReady,
  handleLimitFailure,
} from "./ui.js";

let file = null;
let quality = 0.65;

const app = document.getElementById("app");
app.innerHTML = `
  ${createHeader("compress")}
  <main class="container">
    <section class="tool-header">
      <h1>Compress PDF</h1>
      <p>Reduce PDF file size for email and sharing</p>
    </section>

    <div class="usage-bar" id="usage-bar"></div>

    <div class="drop-zone" id="drop-zone">
      <div class="drop-icon">🗜️</div>
      <h2>Drop a PDF file here</h2>
      <p>or click to browse</p>
      <input type="file" id="file-input" accept="application/pdf" />
    </div>

    <div class="file-list" id="file-list"></div>

    <div class="controls">
      <div class="control-row">
        <label for="quality">Quality</label>
        <input type="range" id="quality" min="30" max="90" value="65" />
        <span class="value" id="quality-val">65%</span>
      </div>
      <p style="color:var(--muted);font-size:0.82rem;margin:0">Lower quality = smaller file. Text may become slightly less sharp.</p>
    </div>

    <div class="actions">
      <button class="btn btn-primary" id="compress-btn" disabled>Compress & Download</button>
      <button class="btn btn-secondary" id="clear-btn" disabled>Clear</button>
    </div>

    <div class="progress-wrap" id="progress-wrap">
      <div class="progress-bar"><div class="fill"></div></div>
      <p class="progress-label" id="progress-label"></p>
    </div>

    <div class="status" id="status"></div>
  </main>
  ${createFooter()}
  ${createProModal()}
`;

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
const compressBtn = document.getElementById("compress-btn");
const clearBtn = document.getElementById("clear-btn");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progress-wrap");
const progressLabel = document.getElementById("progress-label");
const usageBar = document.getElementById("usage-bar");
const qualitySlider = document.getElementById("quality");
const qualityVal = document.getElementById("quality-val");

renderUsageBar(usageBar);
setupProModal();

qualitySlider.addEventListener("input", () => {
  quality = Number(qualitySlider.value) / 100;
  qualityVal.textContent = `${qualitySlider.value}%`;
});

function updateUI() {
  renderFileList(fileList, file ? [file] : [], () => {
    file = null;
    updateUI();
  });
  compressBtn.disabled = !file;
  clearBtn.disabled = !file;
}

function addFiles(incoming) {
  const pdf = incoming.find((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
  if (!pdf) {
    setStatus(statusEl, "Please select a PDF file.", "error");
    notifyResult({
      title: "Invalid file",
      message: "Please select a PDF file.",
      type: "error",
    });
    return;
  }
  file = pdf;
  setStatus(statusEl, `Ready to compress ${pdf.name} (${formatBytes(pdf.size)})`, "info");
  updateUI();
}

setupDropZone(dropZone, fileInput, addFiles);

clearBtn.addEventListener("click", () => {
  file = null;
  setStatus(statusEl, "");
  updateUI();
});

compressBtn.addEventListener("click", async () => {
  const limit = await checkLimits(file.size);
  if (!limit.ok) {
    handleLimitFailure(statusEl, limit);
    return;
  }

  compressBtn.disabled = true;
  const originalSize = file.size;
  setStatus(statusEl, "Compressing…", "info");

  try {
    const blob = await compressPdf(file, quality, (pct, label) => {
      setProgress(progressWrap, progressLabel, pct * 100, label);
    });
    const saved = ((1 - blob.size / originalSize) * 100).toFixed(0);
    const msg =
      blob.size < originalSize
        ? `Done! ${formatBytes(originalSize)} → ${formatBytes(blob.size)} (${saved}% smaller)`
        : `Done! ${formatBytes(blob.size)} (file was already optimized)`;
    downloadBlob(blob, "compressed.pdf");
    recordUsage();
    await renderUsageBar(usageBar);
    setStatus(statusEl, msg, "success");
    notifyDownloadReady({
      title: "Compression complete",
      message: msg.replace("Done! ", ""),
    });
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
    notifyResult({ title: "Compression failed", message: err.message, type: "error" });
  } finally {
    hideProgress(progressWrap);
    compressBtn.disabled = !file;
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
