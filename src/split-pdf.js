import {
  checkLimits,
  formatBytes,
  recordUsage,
  renderUsageBar,
  setupProModal,
} from "./limits.js";
import {
  downloadAllAsZip,
  extractPages,
  getPdfPageCount,
  splitAllPages,
  splitByRanges,
  splitEveryNPages,
} from "./pdf-utils.js";
import {
  createFooter,
  createHeader,
  createProModal,
  downloadBlob,
  hideProgress,
  notifyResult,
  notifyDownloadReady,
  handleLimitFailure,
  renderFileList,
  setProgress,
  setStatus,
  setupDropZone,
} from "./ui.js";

let file = null;
let pageCount = 0;
let mode = "extract";

const app = document.getElementById("app");
app.innerHTML = `
  ${createHeader("split")}
  <main class="container">
    <section class="tool-header">
      <h1>Split PDF</h1>
      <p>Extract pages, split by ranges, or divide into chunks</p>
    </section>

    <div class="usage-bar" id="usage-bar"></div>

    <div class="drop-zone" id="drop-zone">
      <div class="drop-icon">✂️</div>
      <h2>Drop a PDF file here</h2>
      <p>or click to browse</p>
      <input type="file" id="file-input" accept="application/pdf" />
    </div>

    <div class="file-list" id="file-list"></div>

    <div class="split-options" id="split-options" hidden>
      <div class="page-info" id="page-info"></div>

      <div class="mode-tabs">
        <button type="button" class="mode-tab active" data-mode="extract">Extract pages</button>
        <button type="button" class="mode-tab" data-mode="ranges">By ranges</button>
        <button type="button" class="mode-tab" data-mode="every">Every N pages</button>
        <button type="button" class="mode-tab" data-mode="each">Each page</button>
      </div>

      <div class="mode-panel" id="panel-extract">
        <label for="extract-input">Pages to keep</label>
        <input type="text" id="extract-input" placeholder="e.g. 1, 3, 5-8" />
        <p class="hint">Downloads one PDF with only the pages you select. Use commas and dashes (1-5).</p>
      </div>

      <div class="mode-panel" id="panel-ranges" hidden>
        <label for="ranges-input">Split into parts</label>
        <input type="text" id="ranges-input" placeholder="e.g. 1-3, 4-10, 11-" />
        <p class="hint">Each range becomes a separate PDF in a ZIP. Leave end blank for last page (11-).</p>
      </div>

      <div class="mode-panel" id="panel-every" hidden>
        <label for="every-input">Pages per file</label>
        <input type="number" id="every-input" min="1" value="5" />
        <p class="hint">Splits the document into equal chunks. A 23-page PDF with N=5 gives 5 files.</p>
      </div>

      <div class="mode-panel" id="panel-each" hidden>
        <p class="hint" style="margin:0">Every page becomes its own PDF, packaged in a ZIP file.</p>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-primary" id="split-btn" disabled>Extract & Download</button>
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
const splitOptions = document.getElementById("split-options");
const pageInfo = document.getElementById("page-info");
const splitBtn = document.getElementById("split-btn");
const clearBtn = document.getElementById("clear-btn");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progress-wrap");
const progressLabel = document.getElementById("progress-label");
const usageBar = document.getElementById("usage-bar");
const extractInput = document.getElementById("extract-input");
const rangesInput = document.getElementById("ranges-input");
const everyInput = document.getElementById("every-input");

const panels = {
  extract: document.getElementById("panel-extract"),
  ranges: document.getElementById("panel-ranges"),
  every: document.getElementById("panel-every"),
  each: document.getElementById("panel-each"),
};

const modeLabels = {
  extract: "Extract & Download",
  ranges: "Split & Download ZIP",
  every: "Split & Download ZIP",
  each: "Split & Download ZIP",
};

renderUsageBar(usageBar);
setupProModal();

function setMode(next) {
  mode = next;
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  Object.entries(panels).forEach(([key, panel]) => {
    panel.hidden = key !== mode;
  });
  splitBtn.textContent = modeLabels[mode];
}

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

function updateUI() {
  renderFileList(fileList, file ? [file] : [], () => {
    file = null;
    pageCount = 0;
    updateUI();
  });
  splitOptions.hidden = !file;
  splitBtn.disabled = !file;
  clearBtn.disabled = !file;

  if (file && pageCount) {
    pageInfo.textContent = `${pageCount} page${pageCount === 1 ? "" : "s"} detected`;
  }
}

async function addFiles(incoming) {
  const pdf = incoming.find((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
  if (!pdf) {
    setStatus(statusEl, "Please select a PDF file.", "error");
    notifyResult({ title: "Invalid file", message: "Please select a PDF file.", type: "error" });
    return;
  }

  file = pdf;
  setStatus(statusEl, "Reading PDF…", "info");

  try {
    pageCount = await getPdfPageCount(pdf);
    setStatus(statusEl, `Ready — ${pdf.name} (${formatBytes(pdf.size)}, ${pageCount} pages)`, "info");
    updateUI();
  } catch (err) {
    file = null;
    pageCount = 0;
    setStatus(statusEl, `Error: ${err.message}`, "error");
    notifyResult({ title: "Could not read PDF", message: err.message, type: "error" });
    updateUI();
  }
}

setupDropZone(dropZone, fileInput, addFiles);

clearBtn.addEventListener("click", () => {
  file = null;
  pageCount = 0;
  setStatus(statusEl, "");
  updateUI();
});

splitBtn.addEventListener("click", async () => {
  const limit = await checkLimits(file.size);
  if (!limit.ok) {
    handleLimitFailure(statusEl, limit);
    return;
  }

  splitBtn.disabled = true;
  setStatus(statusEl, "Processing…", "info");

  const baseName = file.name.replace(/\.pdf$/i, "") || "document";
  const onProgress = (pct, label) => setProgress(progressWrap, progressLabel, pct * 100, label);

  try {
    if (mode === "extract") {
      const blob = await extractPages(file, extractInput.value, onProgress);
      downloadBlob(blob, `${baseName}-extracted.pdf`);
      recordUsage();
      await renderUsageBar(usageBar);
      const msg = `Saved as ${baseName}-extracted.pdf (${formatBytes(blob.size)})`;
      setStatus(statusEl, msg, "success");
      notifyDownloadReady({
        title: "Extraction complete",
        message: `${baseName}-extracted.pdf (${formatBytes(blob.size)}) is ready.`,
      });
    } else {
      let blobs;
      let zipLabel;

      if (mode === "ranges") {
        blobs = await splitByRanges(file, rangesInput.value, onProgress);
        zipLabel = "ranges";
      } else if (mode === "every") {
        const n = parseInt(everyInput.value, 10);
        blobs = await splitEveryNPages(file, n, onProgress);
        zipLabel = `every-${n}`;
      } else {
        blobs = await splitAllPages(file, onProgress);
        zipLabel = "pages";
      }

      const zipBlob = await downloadAllAsZip(blobs, baseName, (i) => {
        if (mode === "each") return `${baseName}-page-${i + 1}.pdf`;
        if (mode === "every") return `${baseName}-part-${i + 1}.pdf`;
        return `${baseName}-range-${i + 1}.pdf`;
      });

      const zipName = `${baseName}-${zipLabel}.zip`;
      downloadBlob(zipBlob, zipName);
      recordUsage();
      await renderUsageBar(usageBar);
      const msg = `${blobs.length} PDFs saved to ${zipName}`;
      setStatus(statusEl, msg, "success");
      notifyDownloadReady({
        title: "Split complete",
        message: `${blobs.length} files packaged in ${zipName}.`,
      });
    }
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
    notifyResult({ title: "Split failed", message: err.message, type: "error" });
  } finally {
    hideProgress(progressWrap);
    splitBtn.disabled = !file;
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
