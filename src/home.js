import { setupProModal } from "./limits.js";
import { createFooter, createHeader, createProModal } from "./ui.js";

const app = document.getElementById("app");
app.innerHTML = `
  ${createHeader("home")}
  <main class="container">
    <section class="hero">
      <h1>Drop files. Get results.<br>Nothing leaves your device.</h1>
      <p>Fast, private file tools that run entirely in your browser. No sign-up, no uploads, no waiting.</p>
      <span class="privacy-badge">🔒 100% local processing</span>
    </section>

    <section class="tools-grid">
      <a href="/merge-pdf.html" class="tool-card">
        <div class="icon">📎</div>
        <h3>Merge PDF</h3>
        <p>Combine multiple PDFs into one file</p>
      </a>
      <a href="/compress-pdf.html" class="tool-card">
        <div class="icon">🗜️</div>
        <h3>Compress PDF</h3>
        <p>Shrink PDFs for email and sharing</p>
      </a>
      <a href="/images-to-pdf.html" class="tool-card">
        <div class="icon">🖼️</div>
        <h3>Images → PDF</h3>
        <p>Turn JPG/PNG photos into a PDF</p>
      </a>
      <a href="/split-pdf.html" class="tool-card">
        <div class="icon">✂️</div>
        <h3>Split PDF</h3>
        <p>Extract pages, split by ranges, or divide into chunks</p>
      </a>
    </section>

    <section class="features">
      <div class="feature">
        <div class="f-icon">⚡</div>
        <h4>Instant</h4>
        <p>No server round-trip. Process files in seconds.</p>
      </div>
      <div class="feature">
        <div class="f-icon">🔐</div>
        <h4>Private</h4>
        <p>Bank statements, contracts — they never leave your computer.</p>
      </div>
      <div class="feature">
        <div class="f-icon">📱</div>
        <h4>Works offline</h4>
        <p>Install as an app and use without internet.</p>
      </div>
      <div class="feature">
        <div class="f-icon">💰</div>
        <h4>Free to start</h4>
        <p>3 jobs per day free. Pro unlocks unlimited use.</p>
      </div>
    </section>
  </main>
  ${createFooter()}
  ${createProModal()}
`;

setupProModal();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
