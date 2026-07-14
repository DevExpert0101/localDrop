import { LICENSE_PREFIX, LICENSE_PUBLIC_JWK } from "./license-public.js";
import { getDeviceId } from "./device.js";

const LICENSE_STORAGE = "localdrop_license";

function base64UrlToBytes(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedKey = null;

async function getPublicKey() {
  if (cachedKey) return cachedKey;
  if (!LICENSE_PUBLIC_JWK.x || LICENSE_PUBLIC_JWK.x.startsWith("REPLACE")) {
    throw new Error("License public key not configured. Run: npm run license:keys");
  }
  cachedKey = await crypto.subtle.importKey(
    "jwk",
    LICENSE_PUBLIC_JWK,
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  return cachedKey;
}

export function getStoredLicense() {
  return localStorage.getItem(LICENSE_STORAGE) || "";
}

export function storeLicense(key) {
  localStorage.setItem(LICENSE_STORAGE, key.trim());
}

export function clearLicense() {
  localStorage.removeItem(LICENSE_STORAGE);
}

export async function verifyLicense(licenseKey, deviceId = getDeviceId()) {
  const key = licenseKey.trim();

  if (!key) {
    return { ok: false, error: "Enter your license key." };
  }

  const parts = key.split(".");
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) {
    return { ok: false, error: "Invalid license format." };
  }

  const [, payloadB64, sigB64] = parts;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  } catch {
    return { ok: false, error: "Invalid license payload." };
  }

  if (payload.v !== 1 || payload.t !== "pro") {
    return { ok: false, error: "Unsupported license version." };
  }

  if (payload.d !== deviceId) {
    return {
      ok: false,
      error: "This key is for a different device. Use the Device ID shown in this browser.",
    };
  }

  if (payload.e && new Date(payload.e) < new Date()) {
    return { ok: false, error: "This license has expired." };
  }

  try {
    const publicKey = await getPublicKey();
    const valid = await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      base64UrlToBytes(sigB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) {
      return { ok: false, error: "License signature invalid." };
    }
  } catch {
    return { ok: false, error: "Could not verify license." };
  }

  return {
    ok: true,
    expires: payload.e || null,
    deviceId: payload.d,
  };
}

export async function isLicenseActive() {
  const stored = getStoredLicense();
  if (!stored) return false;
  const result = await verifyLicense(stored);
  return result.ok;
}

export function formatLicenseExpiry(isoDate) {
  if (!isoDate) return "Lifetime";
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Used by the CLI generator — keep in sync with verifyLicense payload format */
export function encodePayload(payload) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}
