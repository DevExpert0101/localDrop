import { createHmac, timingSafeEqual, createPrivateKey, sign } from "crypto";

const PREFIX = "LDPRO1";

export function getActivationSecret() {
  return process.env.ACTIVATION_SECRET || process.env.LICENSE_PRIVATE_KEY?.slice(0, 32) || "dev-only-change-me";
}

export function createActivationToken(email) {
  const secret = getActivationSecret();
  const exp = Date.now() + 30 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ email: email.toLowerCase(), exp, p: "activate" })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyActivationToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const secret = getActivationSecret();
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");

  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (data.p !== "activate" || !data.email || Date.now() > data.exp) return null;
  return data.email;
}

export function signLicense(deviceId, lifetime = true) {
  const privatePem = process.env.LICENSE_PRIVATE_KEY;
  if (!privatePem) throw new Error("LICENSE_PRIVATE_KEY not configured");

  const privateKey = createPrivateKey(privatePem);
  const payload = { v: 1, t: "pro", d: deviceId, e: lifetime ? null : null };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sigB64 = sign(null, Buffer.from(payloadB64), privateKey).toString("base64url");
  return `${PREFIX}.${payloadB64}.${sigB64}`;
}
