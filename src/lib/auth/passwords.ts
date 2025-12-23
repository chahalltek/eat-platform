import crypto from "crypto";

export function hashTemporaryPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyTemporaryPassword(password: string, hash: string) {
  const digest = hashTemporaryPassword(password);

  if (digest.length !== hash.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hash));
}
