import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": `http://localhost:${process.env.LOCALDROP_API_PORT || 3002}`,
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        merge: resolve(__dirname, "merge-pdf.html"),
        compress: resolve(__dirname, "compress-pdf.html"),
        images: resolve(__dirname, "images-to-pdf.html"),
        split: resolve(__dirname, "split-pdf.html"),
        activate: resolve(__dirname, "activate.html"),
        pay: resolve(__dirname, "pay.html"),
      },
    },
  },
});
