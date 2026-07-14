import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export async function mergePdfs(files, onProgress) {
  const merged = await PDFDocument.create();
  let done = 0;

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
    done++;
    onProgress?.(done / files.length, `Merged ${done} of ${files.length} files…`);
  }

  const out = await merged.save();
  return new Blob([out], { type: "application/pdf" });
}

export async function loadPdfDoc(file) {
  const bytes = await file.arrayBuffer();
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

export async function getPdfPageCount(file) {
  const doc = await loadPdfDoc(file);
  return doc.getPageCount();
}

export function parsePageList(spec, totalPages) {
  const pages = new Set();
  const parts = spec.split(",").map((s) => s.trim()).filter(Boolean);

  if (!parts.length) {
    throw new Error("Enter at least one page number.");
  }

  for (const part of parts) {
    if (part.includes("-")) {
      const [rawStart, rawEnd] = part.split("-");
      const startNum = rawStart.trim() ? parseInt(rawStart.trim(), 10) : 1;
      const endNum = rawEnd.trim() ? parseInt(rawEnd.trim(), 10) : totalPages;

      if (Number.isNaN(startNum) || Number.isNaN(endNum)) {
        throw new Error(`Invalid range: "${part}"`);
      }

      for (let i = startNum; i <= endNum; i++) {
        if (i >= 1 && i <= totalPages) pages.add(i - 1);
      }
    } else {
      const n = parseInt(part, 10);
      if (Number.isNaN(n)) throw new Error(`Invalid page: "${part}"`);
      if (n >= 1 && n <= totalPages) pages.add(n - 1);
    }
  }

  const result = [...pages].sort((a, b) => a - b);
  if (!result.length) {
    throw new Error("No valid pages in that selection.");
  }
  return result;
}

export function parsePageRanges(spec, totalPages) {
  const parts = spec.split(",").map((s) => s.trim()).filter(Boolean);

  if (!parts.length) {
    throw new Error("Enter at least one page range.");
  }

  const ranges = parts.map((part) => {
    if (part.includes("-")) {
      const [rawStart, rawEnd] = part.split("-");
      const startNum = rawStart.trim() ? parseInt(rawStart.trim(), 10) : 1;
      const endNum = rawEnd.trim() ? parseInt(rawEnd.trim(), 10) : totalPages;

      if (Number.isNaN(startNum) || Number.isNaN(endNum)) {
        throw new Error(`Invalid range: "${part}"`);
      }

      const indices = [];
      for (let i = startNum; i <= endNum; i++) {
        if (i >= 1 && i <= totalPages) indices.push(i - 1);
      }
      return indices;
    }

    const n = parseInt(part, 10);
    if (Number.isNaN(n)) throw new Error(`Invalid page: "${part}"`);
    return n >= 1 && n <= totalPages ? [n - 1] : [];
  });

  const valid = ranges.filter((r) => r.length);
  if (!valid.length) {
    throw new Error("No valid ranges in that selection.");
  }
  return valid;
}

async function buildPdfFromPages(doc, pageIndices) {
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(doc, pageIndices);
  pages.forEach((p) => newDoc.addPage(p));
  const out = await newDoc.save();
  return new Blob([out], { type: "application/pdf" });
}

export async function splitIntoGroups(doc, pageGroups, onProgress) {
  const blobs = [];

  for (let i = 0; i < pageGroups.length; i++) {
    blobs.push(await buildPdfFromPages(doc, pageGroups[i]));
    onProgress?.(
      (i + 1) / pageGroups.length,
      `Created part ${i + 1} of ${pageGroups.length}…`
    );
  }

  return blobs;
}

export async function extractPages(file, pageSpec, onProgress) {
  const doc = await loadPdfDoc(file);
  const total = doc.getPageCount();
  const indices = parsePageList(pageSpec, total);
  onProgress?.(1, `Extracting ${indices.length} page(s)…`);
  return buildPdfFromPages(doc, indices);
}

export async function splitByRanges(file, rangeSpec, onProgress) {
  const doc = await loadPdfDoc(file);
  const total = doc.getPageCount();
  const groups = parsePageRanges(rangeSpec, total);
  return splitIntoGroups(doc, groups, onProgress);
}

export async function splitEveryNPages(file, n, onProgress) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("Enter a valid number of pages (1 or more).");
  }

  const doc = await loadPdfDoc(file);
  const total = doc.getPageCount();
  const groups = [];

  for (let i = 0; i < total; i += n) {
    const group = [];
    for (let j = i; j < Math.min(i + n, total); j++) group.push(j);
    groups.push(group);
  }

  return splitIntoGroups(doc, groups, onProgress);
}

export async function splitAllPages(file, onProgress) {
  const doc = await loadPdfDoc(file);
  const total = doc.getPageCount();
  const groups = Array.from({ length: total }, (_, i) => [i]);
  return splitIntoGroups(doc, groups, onProgress);
}

export async function compressPdf(file, quality = 0.65, onProgress) {
  const bytes = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const outDoc = await PDFDocument.create();

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;

    const jpegBytes = await canvasToJpeg(canvas, quality);
    const image = await outDoc.embedJpg(jpegBytes);
    const newPage = outDoc.addPage([image.width, image.height]);
    newPage.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    onProgress?.(i / total, `Compressed page ${i} of ${total}…`);
  }

  const out = await outDoc.save();
  return new Blob([out], { type: "application/pdf" });
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(
      async (blob) => {
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      quality
    );
  });
}

export async function imagesToPdf(files, onProgress) {
  const doc = await PDFDocument.create();
  let done = 0;

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let image;

    if (file.type === "image/png") {
      image = await doc.embedPng(bytes);
    } else {
      image = await doc.embedJpg(bytes);
    }

    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    done++;
    onProgress?.(done / files.length, `Added image ${done} of ${files.length}…`);
  }

  const out = await doc.save();
  return new Blob([out], { type: "application/pdf" });
}

export async function downloadAllAsZip(blobs, baseName, nameFn) {
  const zip = new JSZip();

  blobs.forEach((blob, i) => {
    const name = nameFn ? nameFn(i) : `${baseName}-part-${i + 1}.pdf`;
    zip.file(name, blob);
  });

  return zip.generateAsync({ type: "blob" });
}
