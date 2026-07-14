import { generateKeyPairSync, sign, createPrivateKey } from "crypto";
import { mkdir, writeFile, readFile, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEYS_DIR = join(ROOT, "scripts", "keys");
const PRIVATE_PATH = join(KEYS_DIR, "private.pem");
const PUBLIC_JWK_PATH = join(ROOT, "src", "license-public.js");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function bytesToBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function writePublicJwk(publicKey) {
  const jwk = publicKey.export({ format: "jwk" });
  const content = `/**
 * Ed25519 public key for license verification.
 * Regenerate with: npm run license:keys
 * NEVER commit the private key — only this file is safe in the repo.
 */
export const LICENSE_PUBLIC_JWK = ${JSON.stringify(jwk, null, 2)};

export const LICENSE_PREFIX = "LDPRO1";
`;
  await writeFile(PUBLIC_JWK_PATH, content, "utf8");
}

async function main() {
  await mkdir(KEYS_DIR, { recursive: true });

  if (await exists(PRIVATE_PATH)) {
    console.log("Keys already exist at scripts/keys/private.pem");
    console.log("Delete that file first if you want to regenerate.");
    process.exit(0);
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  await writeFile(PRIVATE_PATH, privateKey.export({ type: "pkcs8", format: "pem" }), "utf8");
  await writePublicJwk(publicKey);

  console.log("✓ Key pair created");
  console.log("  Private (KEEP SECRET): scripts/keys/private.pem");
  console.log("  Public (in app):       src/license-public.js");
  console.log("\nGenerate a license:");
  console.log("  npm run license:generate -- --device LD-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
