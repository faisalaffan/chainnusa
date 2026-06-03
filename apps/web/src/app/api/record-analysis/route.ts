import { NextResponse } from "next/server";
import { isSupportedChain, type ChainId } from "@/lib/chains";
import { recordAndMint } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

interface RecordBody {
  address?: string;
  chainId?: number;
  analysis?: unknown;
}

interface RecordApiResponse {
  ok: boolean;
  analysisId?: string;
  sbtTokenId?: string;
  registryTxHash?: string;
  sbtTxHash?: string;
  error?: string;
}

export async function POST(req: Request) {
  let body: RecordBody;
  try {
    body = (await req.json()) as RecordBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const address = (body.address || "").trim();
  const chainId = Number(body.chainId);

  if (!ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      { ok: false, error: "Invalid EVM address (expected 0x + 40 hex chars)" },
      { status: 400 }
    );
  }

  if (!isSupportedChain(chainId)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported chainId. Supported: 1, 56, 137, 31337` },
      { status: 400 }
    );
  }

  if (!body.analysis) {
    return NextResponse.json(
      { ok: false, error: "Missing analysis data" },
      { status: 400 }
    );
  }

  try {
    const analysisJson = JSON.stringify(body.analysis);
    const result = await recordAndMint(address, chainId, analysisJson);

    const resp: RecordApiResponse = {
      ok: true,
      analysisId: result.analysisId,
      sbtTokenId: result.sbtTokenId.toString(),
      registryTxHash: result.registryTxHash,
      sbtTxHash: result.sbtTxHash,
    };
    return NextResponse.json(resp);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Contract interaction failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
