import {
  checkLimits,
  recordUsage,
  renderUsageBar,
  setupProModal,
} from "./limits.js";
import { mergePdfs } from "./pdf-utils.js";
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

let files = [];

const app = document.getElementById("app");
app.innerHTML = `
  ${createHeader("merge")}
  <main class="container">
    <section class="tool-header">
      <h1>Merge PDF</h1>
      <p>Combine multiple PDF files into one document</p>
    </section>

    <div class="usage-bar" id="usage-bar"></div>

    <div class="drop-zone" id="drop-zone">
      <div class="drop-icon">📎</div>
      <h2>Drop PDF files here</h2>
      <p>or click to browse — add 2 or more files</p>
      <input type="file" id="file-input" accept="application/pdf" multiple />
    </div>

    <div class="file-list" id="file-list"></div>

    <div class="actions">
      <button class="btn btn-primary" id="merge-btn" disabled>Merge & Download</button>
      <button class="btn btn-secondary" id="clear-btn" disabled>Clear all</button>
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
const mergeBtn = document.getElementById("merge-btn");
const clearBtn = document.getElementById("clear-btn");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progress-wrap");
const progressLabel = document.getElementById("progress-label");
const usageBar = document.getElementById("usage-bar");

renderUsageBar(usageBar);
setupProModal();

function updateUI() {
  renderFileList(fileList, files, (i) => {
    files.splice(i, 1);
    updateUI();
  });
  mergeBtn.disabled = files.length < 2;
  clearBtn.disabled = files.length === 0;
}

function addFiles(incoming) {
  const pdfs = incoming.filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
  if (!pdfs.length) {
    setStatus(statusEl, "Please select PDF files only.", "error");
    notifyResult({
      title: "Invalid file",
      message: "Please select PDF files only.",
      type: "error",
    });
    return;
  }
  files.push(...pdfs);
  setStatus(statusEl, `${files.length} file(s) ready to merge.`, "info");
  updateUI();
}

setupDropZone(dropZone, fileInput, addFiles);

clearBtn.addEventListener("click", () => {
  files = [];
  setStatus(statusEl, "");
  updateUI();
});

mergeBtn.addEventListener("click", async () => {
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const limit = await checkLimits(totalBytes);
  if (!limit.ok) {
    handleLimitFailure(statusEl, limit);
    return;
  }

  mergeBtn.disabled = true;
  setStatus(statusEl, "Merging…", "info");

  try {
    const blob = await mergePdfs(files, (pct, label) => {
      setProgress(progressWrap, progressLabel, pct * 100, label);
    });
    downloadBlob(blob, "merged.pdf");
    recordUsage();
    await renderUsageBar(usageBar);
    setStatus(statusEl, `Done! Saved as merged.pdf (${(blob.size / 1024).toFixed(0)} KB)`, "success");
    notifyDownloadReady({
      title: "Merge complete",
      message: `merged.pdf (${(blob.size / 1024).toFixed(0)} KB) is ready.`,
    });
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
    notifyResult({ title: "Merge failed", message: err.message, type: "error" });
  } finally {
    hideProgress(progressWrap);
    mergeBtn.disabled = files.length < 2;
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
