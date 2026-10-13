import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Gevoelige waarden (zoals het Google-token) versleuteld opslaan met AES-256-GCM.
// De sleutel komt uit TAKEN_SECRET; zonder die variabele wordt er niets versleuteld.

const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const secret = (process.env.TAKEN_SECRET || "").trim();
  return secret ? createHash("sha256").update(`planner-encryption:${secret}`).digest() : null;
}

export const encryptionEnabled = () => key() !== null;

export function seal(value: string): string {
  const k = key();
  if (!k || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${data.toString("base64url")}`;
}

/** Ontsleutelt een waarde; niet-versleutelde waarden komen ongewijzigd terug. Null als het niet lukt. */
export function unseal(value: string): string | null {
  if (!value.startsWith(PREFIX)) return value;
  const k = key();
  if (!k) return null;
  try {
    const [iv, tag, data] = value.slice(PREFIX.length).split(":").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
