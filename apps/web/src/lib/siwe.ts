/**
 * SIWE (Sign-In with Ethereum) — server-side verification.
 * Implements EIP-4361 subset.
 *
 * Flow:
 * 1. GET /api/auth/nonce → return nonce
 * 2. Client builds SIWE message, signs with personal_sign
 * 3. POST /api/auth/verify → server verifies signature, returns JWT/session
 */

import { hashMessage, recoverAddress } from "viem";

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const nonceStore = new Map<string, { nonce: string; issuedAt: number }>();

export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function storeNonce(address: string): string {
  const nonce = generateNonce();
  nonceStore.set(address.toLowerCase(), { nonce, issuedAt: Date.now() });
  return nonce;
}

export function consumeNonce(address: string, nonce: string): boolean {
  const entry = nonceStore.get(address.toLowerCase());
  if (!entry) return false;
  if (entry.nonce !== nonce) return false;
  if (Date.now() - entry.issuedAt > NONCE_TTL_MS) {
    nonceStore.delete(address.toLowerCase());
    return false;
  }
  nonceStore.delete(address.toLowerCase());
  return true;
}

/**
 * Build SIWE message string per EIP-4361.
 */
export function buildSiweMessage(params: {
  domain: string;
  address: string;
  uri: string;
  version?: string;
  chainId?: number;
  nonce: string;
  issuedAt?: string;
}): string {
  const issuedAt = params.issuedAt || new Date().toISOString();
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    `URI: ${params.uri}`,
    `Version: ${params.version || "1"}`,
    `Chain ID: ${params.chainId || 1}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

/**
 * Verify SIWE signature. Returns the recovered address or null.
 */
export async function verifySiweSignature(
  message: string,
  signature: string,
): Promise<string | null> {
  try {
    const recovered = await recoverAddress({
      hash: hashMessage(message),
      signature: signature as `0x${string}`,
    });
    return recovered.toLowerCase();
  } catch {
    return null;
  }
}
