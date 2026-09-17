const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hashSecret(value: string, salt: string, iterations: number) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(value), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations },
    material,
    256,
  );
  return toHex(derived);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function hashPin(pin: string, salt = randomToken(16)) {
  return { salt, hash: await hashSecret(pin, salt, 120_000) };
}

export async function verifyPin(pin: string, salt: string, expectedHash: string) {
  return timingSafeEqual(await hashSecret(pin, salt, 120_000), expectedHash);
}

export async function hashPassword(password: string, salt = randomToken(16)) {
  return { salt, hash: await hashSecret(password, salt, 240_000) };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  return timingSafeEqual(await hashSecret(password, salt, 240_000), expectedHash);
}
