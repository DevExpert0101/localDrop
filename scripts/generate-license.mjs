import { createPrivateKey, sign } from "crypto";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_PATH = join(ROOT, "scripts", "keys", "private.pem");
const PREFIX = "LDPRO1";

function parseArgs(argv) {
  const args = { device: null, days: null, lifetime: false, email: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--device") args.device = argv[++i];
    else if (argv[i] === "--days") args.days = Number(argv[++i]);
    else if (argv[i] === "--lifetime") args.lifetime = true;
    else if (argv[i] === "--email") args.email = argv[++i];
  }
  return args;
}

function bytesToBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.device) {
    console.log(`Usage:
  npm run license:generate -- --device LD-uuid [--lifetime]
  npm run license:generate -- --device LD-uuid --days 365
  npm run license:generate -- --device LD-uuid --lifetime --email buyer@example.com

The customer copies their Device ID from the LocalDrop upgrade screen.
Run npm run license:keys first if you have no private key yet.`);
    process.exit(1);
  }

  if (!args.device.startsWith("LD-")) {
    console.error("Device ID must start with LD- (copy it from the customer's upgrade screen).");
    process.exit(1);
  }

  let privatePem;
  try {
    privatePem = await readFile(PRIVATE_PATH, "utf8");
  } catch {
    console.error("Missing scripts/keys/private.pem — run: npm run license:keys");
    process.exit(1);
  }

  const privateKey = createPrivateKey(privatePem);

  let expires = null;
  if (!args.lifetime && args.days) {
    const d = new Date();
    d.setDate(d.getDate() + args.days);
    expires = d.toISOString();
  }

  const payload = {
    v: 1,
    t: "pro",
    d: args.device,
    e: expires,
  };

  const payloadB64 = bytesToBase64Url(Buffer.from(JSON.stringify(payload)));
  const signature = sign(null, Buffer.from(payloadB64), privateKey);
  const sigB64 = bytesToBase64Url(signature);
  const license = `${PREFIX}.${payloadB64}.${sigB64}`;

  console.log("\n=== LocalDrop Pro License ===\n");
  if (args.email) console.log(`Customer: ${args.email}`);
  console.log(`Device:   ${args.device}`);
  console.log(`Expires:  ${expires ? new Date(expires).toLocaleDateString() : "Lifetime"}`);
  console.log(`\nLicense key (send this to the customer):\n`);
  console.log(license);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
