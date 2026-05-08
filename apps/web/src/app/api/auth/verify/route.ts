import { NextResponse } from "next/server";
import { consumeNonce, verifySiweSignature } from "@/lib/siwe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VerifyBody {
  message?: string;
  signature?: string;
  address?: string;
}

export async function POST(req: Request) {
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { message, signature, address } = body;
  if (!message || !signature || !address) {
    return NextResponse.json(
      { ok: false, error: "Missing message, signature, or address" },
      { status: 400 }
    );
  }

  // Extract nonce from message and verify
  const nonceMatch = message.match(/Nonce:\s*(\S+)/);
  if (!nonceMatch) {
    return NextResponse.json({ ok: false, error: "Invalid SIWE message: no nonce" }, { status: 400 });
  }

  const nonce = nonceMatch[1];
  if (!consumeNonce(address, nonce)) {
    return NextResponse.json(
      { ok: false, error: "Nonce expired or not found" },
      { status: 401 }
    );
  }

  const recovered = await verifySiweSignature(message, signature);
  if (!recovered || recovered !== address.toLowerCase()) {
    return NextResponse.json(
      { ok: false, error: "Signature verification failed" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    address: recovered,
    verified: true,
  });
}
