"use client";

import { useState } from "react";
import {
  Wallet,
  Search,
  RefreshCcw,
  Loader2,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Flame,
  Activity,
  Users,
  Coins,
  Sparkles,
  ExternalLink,
  Clock,
  CheckCircle2,
  Database,
  Cpu,
  Cloud,
  HardDrive,
  Award,
} from "lucide-react";
import { CHAINS, SUPPORTED_CHAIN_IDS, type ChainId } from "@/lib/chains";
import type { AnalysisResult } from "@/lib/analyzer";
import {
  shortAddr,
  formatNumber,
  formatTs,
  formatRelative,
  categoryLabel,
  categoryColor,
} from "@/lib/format";
import { ActivityChart, CategoryPie } from "./Charts";
import { MarkdownLite } from "./MarkdownLite";

interface ProviderInfo {
  id: string;
  label: string;
  model?: string;
  isLocal?: boolean;
  notes?: string[];
  capabilities?: { nativeTxHistory: boolean; erc20TxHistory: boolean; nativeBalance: boolean };
}

interface ApiResponse {
  ok: boolean;
  cached?: boolean;
  fromCache?: { cachedAt: number; ttlSeconds: number; ageSeconds: number };
  analysis?: AnalysisResult;
  aiSummary?: string;
  aiError?: string;
  error?: string;
  providers?: { data: ProviderInfo; llm: ProviderInfo };
}

const SAMPLES: { label: string; chainId: ChainId; address: string }[] = [
  { label: "Vitalik (ETH)", chainId: 1, address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" },
  { label: "Binance Hot Wallet (BSC)", chainId: 56, address: "0x8894e0a0c962cb723c1976a4421c95949be2d4e3" },
  { label: "Polygon Foundation", chainId: 137, address: "0x9d8c68f185a04314ddc8b8216732455e8dbb7e45" },
];

export default function Analyzer() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState<ChainId>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintResult, setMintResult] = useState<{
    analysisId: string;
    sbtTokenId: string;
    registryTxHash: string;
    sbtTxHash: string;
  } | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);

  async function run(force = false) {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), chainId, forceRefresh: force }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) {
        setError(json.error || `Request failed with ${res.status}`);
      } else {
        setResult(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function mintSbt() {
    if (!result?.analysis) return;
    setMinting(true);
    setMintError(null);
    setMintResult(null);
    try {
      const res = await fetch("/api/record-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          chainId,
          analysis: result.analysis,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        analysisId?: string;
        sbtTokenId?: string;
        registryTxHash?: string;
        sbtTxHash?: string;
      };
      if (!res.ok || !json.ok) {
        setMintError(json.error || `Mint failed with ${res.status}`);
      } else {
        setMintResult({
          analysisId: json.analysisId!,
          sbtTokenId: json.sbtTokenId!,
          registryTxHash: json.registryTxHash!,
          sbtTxHash: json.sbtTxHash!,
        });
      }
    } catch (e) {
      setMintError(e instanceof Error ? e.message : "Network error");
    } finally {
      setMinting(false);
    }
  }

  function loadSample(s: { chainId: ChainId; address: string }) {
    setChainId(s.chainId);
    setAddress(s.address);
  }

  const analysis = result?.analysis;

  return (
    <div className="space-y-6">
      <FormCard
        address={address}
        setAddress={setAddress}
        chainId={chainId}
        setChainId={setChainId}
        loading={loading}
        onSubmit={() => run(false)}
        onRefresh={() => run(true)}
        canRefresh={Boolean(result)}
        samples={SAMPLES}
        onSample={loadSample}
      />

      {error && (
        <div className="glass rounded-xl p-4 flex gap-3 items-start text-red-300 border-red-500/30">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>
            <div className="font-medium">Gagal menganalisis</div>
            <div className="text-sm text-red-200/80">{error}</div>
          </div>
        </div>
      )}

      {loading && !result && (
        <div className="glass rounded-xl p-8 flex items-center justify-center text-white/70 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Menarik data dari Etherscan & menyusun analisis…</span>
        </div>
      )}

      {result && analysis && (
        <ResultPanel
          result={result}
          analysis={analysis}
          minting={minting}
          mintResult={mintResult}
          mintError={mintError}
          onMint={() => mintSbt()}
        />
      )}
    </div>
  );
}

function FormCard(props: {
  address: string;
  setAddress: (v: string) => void;
  chainId: ChainId;
  setChainId: (v: ChainId) => void;
  loading: boolean;
  onSubmit: () => void;
  onRefresh: () => void;
  canRefresh: boolean;
  samples: { label: string; chainId: ChainId; address: string }[];
  onSample: (s: { chainId: ChainId; address: string }) => void;
}) {
  const {
    address,
    setAddress,
    chainId,
    setChainId,
    loading,
    onSubmit,
    onRefresh,
    canRefresh,
    samples,
    onSample,
  } = props;

  return (
    <div className="glass rounded-2xl p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-brand-500" />
        <h2 className="text-lg font-semibold">Analisis Wallet</h2>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <select
          value={chainId}
          onChange={(e) => setChainId(Number(e.target.value) as ChainId)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
        >
          {SUPPORTED_CHAIN_IDS.map((cid) => (
            <option key={cid} value={cid} className="bg-[#0b1020]">
              {CHAINS[cid].name}
            </option>
          ))}
        </select>

        <input
          type="text"
          spellCheck={false}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x… (EVM address)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-brand-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading && address.trim()) onSubmit();
          }}
        />

        <button
          onClick={onSubmit}
          disabled={loading || !address.trim()}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 justify-center"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Analisis
        </button>

        <button
          onClick={onRefresh}
          disabled={loading || !canRefresh}
          title="Refresh without cache"
          className="bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 justify-center border border-white/10"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 items-center text-xs text-white/50">
        <span>Coba sample:</span>
        {samples.map((s) => (
          <button
            key={s.address}
            onClick={() => onSample(s)}
            className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/70"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  analysis,
  minting,
  mintResult,
  mintError,
  onMint,
}: {
  result: ApiResponse;
  analysis: AnalysisResult;
  minting: boolean;
  mintResult: { analysisId: string; sbtTokenId: string; registryTxHash: string; sbtTxHash: string } | null;
  mintError: string | null;
  onMint: () => void;
}) {
  const chain = CHAINS[analysis.chainId as ChainId];
  return (
    <div className="space-y-6">
      <ProviderBadge providers={result.providers} />
      <CacheBanner result={result} />

      <Header analysis={analysis} explorerUrl={chain.explorerUrl} />

      <StatGrid analysis={analysis} />

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Kategori Transaksi" icon={<Activity className="w-4 h-4" />}>
          <CategoryPie data={analysis.categories} />
        </Panel>
        <Panel title="Aktivitas Harian" icon={<Activity className="w-4 h-4" />}>
          <ActivityChart data={analysis.dailyActivity} />
        </Panel>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Top Counterparties" icon={<Users className="w-4 h-4" />}>
          <CounterpartiesList analysis={analysis} explorerUrl={chain.explorerUrl} />
        </Panel>
        <Panel title="Token Activity (ERC-20)" icon={<Coins className="w-4 h-4" />}>
          <TokensList analysis={analysis} explorerUrl={chain.explorerUrl} />
        </Panel>
      </div>

      <Panel title="AI Summary" icon={<Sparkles className="w-4 h-4 text-amber-300" />}>
        {result.aiError ? (
          <div className="text-sm text-amber-300/90">
            <div className="font-medium">AI summary tidak tersedia.</div>
            <div className="text-xs text-amber-200/70 mt-1">Detail: {result.aiError}</div>
          </div>
        ) : (
          <MarkdownLite text={result.aiSummary || ""} />
        )}
      </Panel>

      <Panel title="Recent Transactions" icon={<Clock className="w-4 h-4" />}>
        <TxTable analysis={analysis} explorerUrl={chain.explorerUrl} />
      </Panel>

      {/* SBT Minting */}
      <div className="glass rounded-2xl p-5 border border-brand-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5 text-brand-500" />
          <h3 className="text-lg font-semibold">Simpan ke Blockchain</h3>
        </div>

        {!mintResult && (
          <>
            <p className="text-sm text-white/60 mb-3">
              Mint analisis ini sebagai Soulbound Token (SBT) on-chain. Hasil akan tersimpan permanen
              di contract AnalysisRegistry + ReportSBT dan terikat ke alamat wallet ini.
            </p>
            <button
              onClick={onMint}
              disabled={minting}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              {minting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Minting…
                </>
              ) : (
                <>
                  <Award className="w-4 h-4" />
                  Mint SBT
                </>
              )}
            </button>
          </>
        )}

        {mintError && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {mintError}
          </div>
        )}

        {mintResult && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              SBT berhasil di-mint!
            </div>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-white/50 text-xs">Token ID</div>
                <div className="mono font-medium">{mintResult.sbtTokenId}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-white/50 text-xs">Analysis ID</div>
                <div className="mono text-xs truncate" title={mintResult.analysisId}>
                  {mintResult.analysisId}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-white/50 text-xs">Registry Tx</div>
                <div className="mono text-xs truncate" title={mintResult.registryTxHash}>
                  {mintResult.registryTxHash}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-white/50 text-xs">SBT Tx</div>
                <div className="mono text-xs truncate" title={mintResult.sbtTxHash}>
                  {mintResult.sbtTxHash}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderBadge({
  providers,
}: {
  providers?: { data: ProviderInfo; llm: ProviderInfo };
}) {
  if (!providers) return null;
  const { data, llm } = providers;
  const dataIcon = data.id === "rpc" ? <HardDrive className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />;
  const llmIcon = llm.isLocal ? <Cpu className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 bg-white/5"
        title={data.notes?.join(" · ")}
      >
        <Database className="w-3.5 h-3.5 text-brand-500" />
        <span className="text-white/50">Data</span>
        {dataIcon}
        <span className="text-white/90">{data.label}</span>
      </span>
      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 bg-white/5"
        title={llm.notes?.join(" · ")}
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        <span className="text-white/50">LLM</span>
        {llmIcon}
        <span className="text-white/90">{llm.label}</span>
        {llm.model && (
          <span className="mono text-[10px] text-white/50 bg-black/30 px-1.5 py-0.5 rounded">
            {llm.model}
          </span>
        )}
      </span>
    </div>
  );
}

function CacheBanner({ result }: { result: ApiResponse }) {
  if (result.cached && result.fromCache) {
    return (
      <div className="text-xs flex items-center gap-2 text-emerald-300/80">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Hasil dari cache · {result.fromCache.ageSeconds}s lalu (TTL {result.fromCache.ttlSeconds}s).
        Klik tombol refresh untuk fetch ulang.
      </div>
    );
  }
  return (
    <div className="text-xs flex items-center gap-2 text-white/50">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Hasil baru di-fetch dari Etherscan V2.
    </div>
  );
}

function Header({ analysis, explorerUrl }: { analysis: AnalysisResult; explorerUrl: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-white/50 uppercase tracking-wide">{analysis.chainName}</div>
          <a
            href={`${explorerUrl}/address/${analysis.address}`}
            target="_blank"
            rel="noreferrer"
            className="text-lg md:text-xl mono font-medium hover:text-brand-500 inline-flex items-center gap-2"
          >
            {analysis.address}
            <ExternalLink className="w-4 h-4 opacity-50" />
          </a>
          <div className="text-xs text-white/50 mt-1">
            Aktif sejak {formatTs(analysis.totals.firstTxAt)} — terakhir{" "}
            {formatRelative(analysis.totals.lastTxAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50">Native Balance</div>
          <div className="text-2xl font-semibold">
            {formatNumber(analysis.totals.nativeBalance)}{" "}
            <span className="text-white/60 text-sm">{analysis.nativeSymbol}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatGrid({ analysis }: { analysis: AnalysisResult }) {
  const t = analysis.totals;
  const items = [
    { label: "Tx Count", value: t.txCount.toLocaleString(), icon: <Activity className="w-4 h-4" /> },
    {
      label: `${analysis.nativeSymbol} Masuk`,
      value: formatNumber(t.nativeIn),
      icon: <ArrowDownCircle className="w-4 h-4 text-emerald-400" />,
    },
    {
      label: `${analysis.nativeSymbol} Keluar`,
      value: formatNumber(t.nativeOut),
      icon: <ArrowUpCircle className="w-4 h-4 text-red-400" />,
    },
    {
      label: "Gas Spent",
      value: `${formatNumber(t.gasSpent)} ${analysis.nativeSymbol}`,
      icon: <Flame className="w-4 h-4 text-amber-400" />,
    },
    { label: "Token Tx", value: t.tokenTxCount.toLocaleString(), icon: <Coins className="w-4 h-4" /> },
    {
      label: "Counterparties",
      value: t.uniqueCounterparties.toLocaleString(),
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: "Active Days",
      value: t.activeDays.toLocaleString(),
      icon: <Clock className="w-4 h-4" />,
    },
    {
      label: "Failed Tx",
      value: t.failedTxCount.toLocaleString(),
      icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <div key={it.label} className="glass rounded-xl p-4">
          <div className="text-xs text-white/50 flex items-center gap-1.5 mb-1.5">
            {it.icon}
            {it.label}
          </div>
          <div className="text-lg font-semibold mono">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function CounterpartiesList({
  analysis,
  explorerUrl,
}: {
  analysis: AnalysisResult;
  explorerUrl: string;
}) {
  if (!analysis.topCounterparties.length) {
    return <p className="text-sm text-white/50">No counterparties found.</p>;
  }
  return (
    <ul className="text-sm divide-y divide-white/5">
      {analysis.topCounterparties.map((c) => (
        <li key={c.address} className="py-2 flex items-center justify-between gap-2">
          <a
            href={`${explorerUrl}/address/${c.address}`}
            target="_blank"
            rel="noreferrer"
            className="mono text-xs hover:text-brand-500 truncate"
          >
            {shortAddr(c.address, 10, 6)}
          </a>
          <div className="flex items-center gap-2 shrink-0">
            {c.isContract && (
              <span className="text-[10px] uppercase tracking-wide bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                contract
              </span>
            )}
            <span className="text-white/70 text-xs">{c.interactions} tx</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TokensList({ analysis, explorerUrl }: { analysis: AnalysisResult; explorerUrl: string }) {
  if (!analysis.tokens.length) {
    return <p className="text-sm text-white/50">No token activity found.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-white/50 uppercase">
          <tr>
            <th className="text-left py-2 font-medium">Token</th>
            <th className="text-right py-2 font-medium">In</th>
            <th className="text-right py-2 font-medium">Out</th>
            <th className="text-right py-2 font-medium">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {analysis.tokens.map((t) => (
            <tr key={t.contractAddress}>
              <td className="py-2">
                <a
                  href={`${explorerUrl}/token/${t.contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-brand-500"
                >
                  <span className="font-medium">{t.symbol}</span>{" "}
                  <span className="text-white/40 text-xs">{t.name}</span>
                </a>
              </td>
              <td className="py-2 text-right mono text-xs text-emerald-300">
                {formatNumber(t.totalIn)}
              </td>
              <td className="py-2 text-right mono text-xs text-red-300">
                {formatNumber(t.totalOut)}
              </td>
              <td className="py-2 text-right text-xs text-white/70">{t.transferCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TxTable({ analysis, explorerUrl }: { analysis: AnalysisResult; explorerUrl: string }) {
  if (!analysis.sampleTxs.length) {
    return <p className="text-sm text-white/50">No transactions found.</p>;
  }
  const me = analysis.address.toLowerCase();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-white/50 uppercase">
          <tr>
            <th className="text-left py-2 font-medium">Hash</th>
            <th className="text-left py-2 font-medium">When</th>
            <th className="text-left py-2 font-medium">Direction</th>
            <th className="text-right py-2 font-medium">Value ({analysis.nativeSymbol})</th>
            <th className="text-left py-2 font-medium">Counterparty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {analysis.sampleTxs.map((tx) => {
            const ts = Number(tx.timeStamp);
            const out = (tx.from || "").toLowerCase() === me;
            const other = out ? tx.to : tx.from;
            const valDec = formatWeiToDecimal(tx.value, 18);
            return (
              <tr key={tx.hash}>
                <td className="py-2">
                  <a
                    href={`${explorerUrl}/tx/${tx.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-xs hover:text-brand-500"
                  >
                    {shortAddr(tx.hash, 8, 4)}
                  </a>
                </td>
                <td className="py-2 text-xs text-white/60">{formatRelative(ts)}</td>
                <td className="py-2">
                  <span
                    className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{
                      background: `${categoryColor(out ? "native_transfer_out" : "native_transfer_in")}33`,
                      color: categoryColor(out ? "native_transfer_out" : "native_transfer_in"),
                    }}
                  >
                    {out ? "OUT" : "IN"}
                  </span>
                  {tx.isError === "1" && (
                    <span className="ml-1 text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      {categoryLabel("failed")}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right mono text-xs">{valDec}</td>
                <td className="py-2">
                  <a
                    href={`${explorerUrl}/address/${other}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-xs text-white/70 hover:text-brand-500"
                  >
                    {shortAddr(other, 8, 4)}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatWeiToDecimal(wei: string, decimals = 18): string {
  try {
    const v = BigInt(wei || "0");
    const base = 10n ** BigInt(decimals);
    const whole = v / base;
    const frac = v % base;
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6).replace(/0+$/, "");
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return wei;
  }
}
