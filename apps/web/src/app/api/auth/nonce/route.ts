import { NextResponse } from "next/server";
import { generateNonce, storeNonce, buildSiweMessage } from "@/lib/siwe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { ok: false, error: "Invalid address" },
      { status: 400 }
    );
  }

  const nonce = storeNonce(address);
  const message = buildSiweMessage({
    domain: req.headers.get("host") || "localhost:3000",
    address,
    uri: req.url.replace(/\/nonce.*/, ""),
    chainId: 1,
    nonce,
  });

  return NextResponse.json({ ok: true, nonce, message });
}
