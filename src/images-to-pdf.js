import {
  checkLimits,
  recordUsage,
  renderUsageBar,
  setupProModal,
} from "./limits.js";
import { imagesToPdf } from "./pdf-utils.js";
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
  ${createHeader("images")}
  <main class="container">
    <section class="tool-header">
      <h1>Images → PDF</h1>
      <p>Convert JPG and PNG images into a single PDF</p>
    </section>

    <div class="usage-bar" id="usage-bar"></div>

    <div class="drop-zone" id="drop-zone">
      <div class="drop-icon">🖼️</div>
      <h2>Drop images here</h2>
      <p>or click to browse — JPG, PNG supported</p>
      <input type="file" id="file-input" accept="image/jpeg,image/png,image/jpg" multiple />
    </div>

    <div class="file-list" id="file-list"></div>

    <div class="actions">
      <button class="btn btn-primary" id="convert-btn" disabled>Convert & Download</button>
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
const convertBtn = document.getElementById("convert-btn");
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
  convertBtn.disabled = files.length === 0;
  clearBtn.disabled = files.length === 0;
}

function addFiles(incoming) {
  const images = incoming.filter(
    (f) =>
      f.type === "image/jpeg" ||
      f.type === "image/png" ||
      f.type === "image/jpg" ||
      /\.(jpe?g|png)$/i.test(f.name)
  );
  if (!images.length) {
    setStatus(statusEl, "Please select JPG or PNG images.", "error");
    notifyResult({
      title: "Invalid file",
      message: "Please select JPG or PNG images.",
      type: "error",
    });
    return;
  }
  files.push(...images);
  setStatus(statusEl, `${files.length} image(s) ready to convert.`, "info");
  updateUI();
}

setupDropZone(dropZone, fileInput, addFiles);

clearBtn.addEventListener("click", () => {
  files = [];
  setStatus(statusEl, "");
  updateUI();
});

convertBtn.addEventListener("click", async () => {
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const limit = await checkLimits(totalBytes);
  if (!limit.ok) {
    handleLimitFailure(statusEl, limit);
    return;
  }

  convertBtn.disabled = true;
  setStatus(statusEl, "Converting…", "info");

  try {
    const blob = await imagesToPdf(files, (pct, label) => {
      setProgress(progressWrap, progressLabel, pct * 100, label);
    });
    downloadBlob(blob, "images.pdf");
    recordUsage();
    await renderUsageBar(usageBar);
    setStatus(statusEl, `Done! Saved as images.pdf (${(blob.size / 1024).toFixed(0)} KB)`, "success");
    notifyDownloadReady({
      title: "Conversion complete",
      message: `images.pdf (${(blob.size / 1024).toFixed(0)} KB) is ready.`,
    });
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
    notifyResult({ title: "Conversion failed", message: err.message, type: "error" });
  } finally {
    hideProgress(progressWrap);
    convertBtn.disabled = files.length === 0;
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
