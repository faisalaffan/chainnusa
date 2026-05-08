import { NextResponse } from "next/server";
import { isSupportedChain, type ChainId } from "@/lib/chains";
import { getNativeBalance, getNormalTxs, getTokenTxs, EtherscanError } from "@/lib/etherscan";
import { analyze, type AnalysisResult } from "@/lib/analyzer";
import { generateSummary } from "@/lib/claude";
import { readCache, writeCache, recordScan } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

interface AnalyzeBody {
  address?: string;
  chainId?: number;
  forceRefresh?: boolean;
}

interface AnalyzeApiResponse {
  ok: boolean;
  cached: boolean;
  fromCache?: { cachedAt: number; ttlSeconds: number; ageSeconds: number };
  analysis: AnalysisResult;
  aiSummary: string;
  aiError?: string;
}

export async function POST(req: Request) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const address = (body.address || "").trim();
  const chainId = Number(body.chainId);
  const forceRefresh = Boolean(body.forceRefresh);

  if (!ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      { ok: false, error: "Invalid EVM address (expected 0x + 40 hex chars)" },
      { status: 400 }
    );
  }

  if (!isSupportedChain(chainId)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported chainId. Supported: 1, 56, 137` },
      { status: 400 }
    );
  }

  const typedChain = chainId as ChainId;

  // 1) Try cache
  if (!forceRefresh) {
    const cached = readCache(typedChain, address);
    if (cached && cached.fresh) {
      const ageSec = Math.floor((Date.now() - cached.cachedAt) / 1000);
      const aiSummary = await safeAi(cached.payload);
      const resp: AnalyzeApiResponse = {
        ok: true,
        cached: true,
        fromCache: { cachedAt: cached.cachedAt, ttlSeconds: cached.ttlSeconds, ageSeconds: ageSec },
        analysis: cached.payload,
        aiSummary: aiSummary.text,
        aiError: aiSummary.error,
      };
      return NextResponse.json(resp);
    }
  }

  // 2) Fresh fetch
  try {
    const [balance, normalTxs, tokenTxs] = await Promise.all([
      getNativeBalance(typedChain, address),
      getNormalTxs(typedChain, address, { offset: 500 }),
      getTokenTxs(typedChain, address, { offset: 500 }),
    ]);

    const analysis = analyze({
      chainId: typedChain,
      address,
      nativeBalanceWei: balance,
      normalTxs,
      tokenTxs,
    });

    writeCache(typedChain, address, analysis);
    recordScan(typedChain, address, normalTxs.length, tokenTxs.length);

    const aiSummary = await safeAi(analysis);

    const resp: AnalyzeApiResponse = {
      ok: true,
      cached: false,
      analysis,
      aiSummary: aiSummary.text,
      aiError: aiSummary.error,
    };
    return NextResponse.json(resp);
  } catch (err) {
    const message =
      err instanceof EtherscanError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

async function safeAi(analysis: AnalysisResult): Promise<{ text: string; error?: string }> {
  try {
    const text = await generateSummary(analysis);
    return { text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI summary failed";
    return {
      text: "_AI summary tidak tersedia._\n\nDetail: " + msg,
      error: msg,
    };
  }
}
