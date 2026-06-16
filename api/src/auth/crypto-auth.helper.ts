import * as crypto from 'crypto';

const NEW_ITERATIONS = 210000;
const LEGACY_ITERATIONS = 10000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, NEW_ITERATIONS, 64, 'sha512')
    .toString('hex');
  return `pbkdf2:${NEW_ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    
    let iterations = LEGACY_ITERATIONS;
    let salt = '';
    let hash = '';

    if (parts[0] === 'pbkdf2') {
      // New format: pbkdf2:iterations:salt:hash
      if (parts.length !== 4) return false;
      iterations = parseInt(parts[1], 10);
      salt = parts[2];
      hash = parts[3];
    } else {
      // Legacy format: salt:hash
      if (parts.length !== 2) return false;
      salt = parts[0];
      hash = parts[1];
    }

    if (isNaN(iterations) || !salt || !hash) return false;

    const verifyHash = crypto
      .pbkdf2Sync(password, salt, iterations, 64, 'sha512')
      .toString('hex');
      
    return timingSafeCompare(hash, verifyHash);
  } catch {
    return false;
  }
}

export function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Perform a dummy timing-safe comparison to prevent leakage
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function signJwt(
  payload: any,
  secret: string,
  expiresInSeconds: number,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64Header = Buffer.from(JSON.stringify(header)).toString(
    'base64url',
  );

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const base64Payload = Buffer.from(
    JSON.stringify({ ...payload, exp }),
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64url');

  return `${base64Header}.${base64Payload}.${signature}`;
}

export function verifyJwt(token: string, secret: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (!timingSafeCompare(signature, expectedSignature)) return null;

    const decodedPayload = JSON.parse(
      Buffer.from(payload, 'base64').toString(),
    );
    if (
      decodedPayload.exp &&
      decodedPayload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null; // Expired
    }
    return decodedPayload;
  } catch {
    return null;
  }
}

