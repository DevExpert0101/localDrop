# LocalDrop

Private file tools that run **100% in your browser**. No sign-up, no uploads, no server processing.

## Tools

| Tool | Description |
|------|-------------|
| **Merge PDF** | Combine multiple PDFs into one file |
| **Compress PDF** | Reduce PDF size for email and sharing |
| **Images → PDF** | Convert JPG/PNG images to a single PDF |
| **Split PDF** | Split each page into separate PDFs (ZIP download) |

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build for production

```bash
npm run build
npm run preview
```

Deploy the `dist/` folder to **Vercel**, **Netlify**, or **GitHub Pages** — free hosting.

## Free vs Pro

| | Free | Pro ($2 crypto) |
|---|------|-------------------|
| Jobs/day | 3 | Unlimited |
| Max file size | 10 MB | 100 MB |
| Payment | — | BTC, ETH, USDT, 100+ coins |

See **[docs/PRO-LICENSING.md](docs/PRO-LICENSING.md)** for crypto payment setup.

**Customer flow:** Pay with crypto → activation link by email → Pro unlocked.

**Seller:** [NOWPayments Dashboard](https://account.nowpayments.io) for payments and payouts.

## Privacy

All file processing happens locally using [pdf-lib](https://pdf-lib.js.org/) and [PDF.js](https://mozilla.github.io/pdf.js/). Your files never leave your device.

## Tech stack

- Vite
- pdf-lib + pdfjs-dist (client-side PDF processing)
- jszip (split PDF export)
- PWA (offline support via service worker)
