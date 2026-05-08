import { buildCacheKey, getDb } from "./db";
import type { AnalysisResult } from "./analyzer";

function ttlSeconds(): number {
  const raw = Number(process.env.CACHE_TTL_SECONDS || 3600);
  return Number.isFinite(raw) && raw > 0 ? raw : 3600;
}

export interface CachedEntry {
  cachedAt: number; // ms
  ttlSeconds: number;
  fresh: boolean;
  payload: AnalysisResult;
}

export function readCache(chainId: number, address: string): CachedEntry | null {
  const db = getDb();
  const key = buildCacheKey(chainId, address);
  const row = db
    .prepare<[string], { payload: string; created_at: number }>(
      "SELECT payload, created_at FROM analysis_cache WHERE cache_key = ?"
    )
    .get(key);
  if (!row) return null;
  const ttl = ttlSeconds();
  const ageSec = (Date.now() - row.created_at) / 1000;
  const fresh = ageSec <= ttl;
  try {
    const payload = JSON.parse(row.payload) as AnalysisResult;
    return { cachedAt: row.created_at, ttlSeconds: ttl, fresh, payload };
  } catch {
    return null;
  }
}

export function writeCache(chainId: number, address: string, payload: AnalysisResult): void {
  const db = getDb();
  const key = buildCacheKey(chainId, address);
  db.prepare(
    `INSERT INTO analysis_cache (cache_key, chain_id, address, payload, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at`
  ).run(key, chainId, address.toLowerCase(), JSON.stringify(payload), Date.now());
}

export function recordScan(
  chainId: number,
  address: string,
  txCount: number,
  tokenTxCount: number
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO scan_history (chain_id, address, tx_count, token_tx_count, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(chainId, address.toLowerCase(), txCount, tokenTxCount, Date.now());
}
