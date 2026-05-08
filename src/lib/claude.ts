import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult } from "./analyzer";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

function buildPromptPayload(a: AnalysisResult) {
  return {
    chain: a.chainName,
    nativeSymbol: a.nativeSymbol,
    address: a.address,
    totals: a.totals,
    categories: a.categories,
    topCounterparties: a.topCounterparties.slice(0, 5),
    topTokens: a.tokens.slice(0, 8).map((t) => ({
      symbol: t.symbol,
      name: t.name,
      transferCount: t.transferCount,
      totalIn: t.totalIn,
      totalOut: t.totalOut,
    })),
    dailyActivity: a.dailyActivity.slice(-30),
  };
}

const SYSTEM_PROMPT = `You are a senior on-chain analyst. Given an aggregated wallet activity summary, write a concise, factual analysis in Bahasa Indonesia.

Format output dalam Markdown dengan struktur:
## Ringkasan
- 2-3 bullet point overview wallet ini

## Pola Aktivitas
- 3-5 bullet point tentang pola spending/transaksi yang terlihat (DEX swap, transfer, kontrak interaction, frekuensi)

## Token & Counterparty
- Token apa yang paling banyak dipakai (jika ada)
- Counterparty/kontrak yang paling sering diinteraksi

## Indikator Perilaku
- Klasifikasi probabilistik: trader aktif / hodler / DeFi user / casual user / smart contract / lainnya
- Berikan reasoning singkat berbasis data

Aturan:
- HANYA gunakan fakta dari data yang diberikan. JANGAN mengarang nama protokol atau kontrak yang tidak ada di data.
- Jika data sedikit (< 5 tx), nyatakan eksplisit bahwa sample terlalu kecil untuk simpulan kuat.
- Maksimum total ~250 kata.
- Jangan gunakan jargon tanpa penjelasan.`;

export async function generateSummary(analysis: AnalysisResult): Promise<string> {
  const client = getClient();
  const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest";
  const payload = buildPromptPayload(analysis);

  const msg = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Berikut data agregat wallet (JSON):\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\nBuatkan analisis sesuai format yang diminta.`,
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return text || "_Tidak ada output dari model._";
}
