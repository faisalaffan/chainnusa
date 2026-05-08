import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let _db: Database.Database | null = null;

function resolveDbPath(): string {
  const raw = process.env.SQLITE_PATH || "./data/chainnusa.db";
  const abs = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return abs;
}

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = resolveDbPath();
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_cache (
      cache_key TEXT PRIMARY KEY,
      chain_id INTEGER NOT NULL,
      address TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_cache_addr ON analysis_cache(address);
    CREATE INDEX IF NOT EXISTS idx_analysis_cache_chain ON analysis_cache(chain_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_cache_created ON analysis_cache(created_at);

    CREATE TABLE IF NOT EXISTS scan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      address TEXT NOT NULL,
      tx_count INTEGER NOT NULL,
      token_tx_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scan_history_addr ON scan_history(address);
  `);

  _db = db;
  return db;
}

export function buildCacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}
