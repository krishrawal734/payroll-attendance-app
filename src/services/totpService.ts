/**
 * Pure TypeScript RFC 6238 (TOTP) & RFC 4226 (HOTP) implementation
 * 100% compatible with Google Authenticator, Microsoft Authenticator, and Authy.
 * Zero Node.js or native crypto dependencies — works cleanly in React Native / Hermes / Expo.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function rotl(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function sha1(message: Uint8Array): Uint8Array {
  const msgLen = message.length;
  const bitLen = msgLen * 8;

  // Pad to 56 mod 64 bytes, plus 8 bytes for 64-bit length
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(message, 0);
  padded[msgLen] = 0x80;

  // 64-bit big-endian bit length
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  padded[paddedLen - 8] = (highBits >>> 24) & 0xff;
  padded[paddedLen - 7] = (highBits >>> 16) & 0xff;
  padded[paddedLen - 6] = (highBits >>> 8) & 0xff;
  padded[paddedLen - 5] = highBits & 0xff;
  padded[paddedLen - 4] = (lowBits >>> 24) & 0xff;
  padded[paddedLen - 3] = (lowBits >>> 16) & 0xff;
  padded[paddedLen - 2] = (lowBits >>> 8) & 0xff;
  padded[paddedLen - 1] = lowBits & 0xff;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = offset + i * 4;
      w[i] =
        ((padded[idx] << 24) |
          (padded[idx + 1] << 16) |
          (padded[idx + 2] << 8) |
          padded[idx + 3]) >>>
        0;
    }

    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = ((b & c) | (~b & d)) >>> 0;
        k = 0x5a827999;
      } else if (i < 40) {
        f = (b ^ c ^ d) >>> 0;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = ((b & c) | (b & d) | (c & d)) >>> 0;
        k = 0x8f1bbcdc;
      } else {
        f = (b ^ c ^ d) >>> 0;
        k = 0xca62c1d6;
      }

      const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const hashes = [h0, h1, h2, h3, h4];
  for (let i = 0; i < 5; i++) {
    out[i * 4] = (hashes[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (hashes[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (hashes[i] >>> 8) & 0xff;
    out[i * 4 + 3] = hashes[i] & 0xff;
  }
  return out;
}

function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  let keyBlock = new Uint8Array(blockSize);

  if (key.length > blockSize) {
    keyBlock.set(sha1(key), 0);
  } else {
    keyBlock.set(key, 0);
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);

  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = keyBlock[i] ^ 0x5c;
    iKeyPad[i] = keyBlock[i] ^ 0x36;
  }

  const innerData = new Uint8Array(blockSize + message.length);
  innerData.set(iKeyPad, 0);
  innerData.set(message, blockSize);
  const innerHash = sha1(innerData);

  const outerData = new Uint8Array(blockSize + innerHash.length);
  outerData.set(oKeyPad, 0);
  outerData.set(innerHash, blockSize);
  return sha1(outerData);
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Generates a 160-bit (20 bytes -> 32 Base32 characters) secret key
 * compatible with Google Authenticator.
 */
export function generateTotpSecret(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength);
  const gCrypto = (globalThis as any)?.crypto;
  if (gCrypto && typeof gCrypto.getRandomValues === 'function') {
    gCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return base32Encode(bytes);
}

/**
 * Builds the standard otpauth:// URI recognized by Google Authenticator.
 */
export function buildTotpUri(secret: string, accountLabel: string, issuer = 'WorkPulse'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountLabel)}`;
  const params = [
    `secret=${encodeURIComponent(secret)}`,
    `issuer=${encodeURIComponent(issuer)}`,
    'algorithm=SHA1',
    'digits=6',
    'period=30',
  ].join('&');
  return `otpauth://totp/${label}?${params}`;
}

/**
 * Generates a 6-digit TOTP code for a given Base32 secret and timestamp.
 */
export function generateTotpCode(
  secret: string,
  timestampMs = Date.now(),
  stepSeconds = 30,
  digits = 6
): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);

  const counterBytes = new Uint8Array(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  counterBytes[0] = (high >>> 24) & 0xff;
  counterBytes[1] = (high >>> 16) & 0xff;
  counterBytes[2] = (high >>> 8) & 0xff;
  counterBytes[3] = high & 0xff;
  counterBytes[4] = (low >>> 24) & 0xff;
  counterBytes[5] = (low >>> 16) & 0xff;
  counterBytes[6] = (low >>> 8) & 0xff;
  counterBytes[7] = low & 0xff;

  const digest = hmacSha1(key, counterBytes);
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) >>>
    0;

  const mod = Math.pow(10, digits);
  return (binary % mod).toString().padStart(digits, '0');
}

/**
 * Verifies a 6-digit Google Authenticator code.
 * Checks current 30s window plus +/- `window` steps (default +/- 1 step = +/- 30s)
 * to tolerate minor device clock drift.
 */
export function verifyTotpCode(
  secret: string,
  userToken: string,
  window = 1,
  timestampMs = Date.now(),
  stepSeconds = 30
): boolean {
  const cleanToken = userToken.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  for (let delta = -window; delta <= window; delta++) {
    const checkTime = timestampMs + delta * stepSeconds * 1000;
    const expected = generateTotpCode(secret, checkTime, stepSeconds, 6);
    if (expected === cleanToken) {
      return true;
    }
  }
  return false;
}

/**
 * Returns remaining seconds in the current 30-second TOTP cycle (1..30).
 */
export function getTotpRemainingSeconds(stepSeconds = 30, timestampMs = Date.now()): number {
  const elapsed = Math.floor(timestampMs / 1000) % stepSeconds;
  return stepSeconds - elapsed;
}

/**
 * Formats a Base32 secret into 4-character groups for easy manual typing.
 */
export function formatSecretKey(secret: string): string {
  return secret
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();
}
