import http from "http";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { loadEnvFile } from "./load-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LOCALDROP_API_PORT || 3002);

await loadEnvFile();

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function loadHandler(name) {
  const mod = await import(pathToFileURL(join(ROOT, "api", `${name}.js`)).href);
  return mod.default;
}

const routes = {
  "/api/request-activation": "request-activation",
  "/api/complete-activation": "complete-activation",
  "/api/create-crypto-payment": "create-crypto-payment",
  "/api/check-crypto-payment": "check-crypto-payment",
  "/api/crypto-webhook": "crypto-webhook",
};

// Dev defaults (mock mode only when no NOWPayments key)
process.env.SITE_URL = process.env.SITE_URL || "http://localhost:5173";
if (!process.env.NOWPAYMENTS_API_KEY) {
  process.env.DEV_BYPASS_ORDERS = "true";
}

try {
  process.env.LICENSE_PRIVATE_KEY = await readFile(join(ROOT, "scripts", "keys", "private.pem"), "utf8");
} catch {
  console.warn("No private.pem — run npm run license:keys (activation will fail until then)");
}

const server = http.createServer(async (req, res) => {
  const handlerName = routes[req.url?.split("?")[0]];
  if (!handlerName) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  if (req.method === "OPTIONS") {
    const handler = await loadHandler(handlerName);
    const mockReq = { method: "OPTIONS", body: {} };
    const mockRes = createMockRes(res);
    await handler(mockReq, mockRes);
    return;
  }

  const body = await readBody(req);
  const handler = await loadHandler(handlerName);

  const mockRes = createMockRes(res);

  try {
    await handler({ method: req.method, body }, mockRes);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

function createMockRes(res) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      res.writeHead(this.statusCode, { ...this.headers, "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    },
    end() {
      res.writeHead(this.statusCode, this.headers);
      res.end();
    },
  };
}

server.listen(PORT, () => {
  const mode = process.env.NOWPAYMENTS_API_KEY
    ? process.env.NOWPAYMENTS_SANDBOX === "true"
      ? "REAL (sandbox)"
      : "REAL (live)"
    : "MOCK (dev simulate)";
  console.log(`LocalDrop API (dev) http://localhost:${PORT}  [${mode}]`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is in use. Set LOCALDROP_API_PORT to another port.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
