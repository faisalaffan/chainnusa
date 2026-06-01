import type { AnalysisResult } from "@/lib/analyzer";

export function buildPromptPayload(a: AnalysisResult) {
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

export const SYSTEM_PROMPT = [
  "You are a senior on-chain analyst. Given an aggregated wallet activity summary,",
  "write a concise, factual analysis in English.",
  "",
  "Format output in Markdown with the following structure:",
  "## Summary",
  "- 2-3 bullet points overviewing this wallet",
  "",
  "## Activity Patterns",
  "- 3-5 bullet points about spending/transaction patterns observed (DEX swaps, transfers, contract interactions, frequency)",
  "",
  "## Tokens & Counterparties",
  "- Which tokens are most used (if any)",
  "- Counterparties/contracts most frequently interacted with",
  "",
  "## Behavioral Indicators",
  "- Probabilistic classification: active trader / hodler / DeFi user / casual user / smart contract / other",
  "- Provide brief data-based reasoning",
  "",
  "Rules:",
  "- ONLY use facts from the provided data. DO NOT fabricate protocol or contract names not present in the data.",
  "- If data is sparse (< 5 tx), explicitly state the sample is too small for strong conclusions.",
  "- Maximum total ~250 words.",
  "- Do not use jargon without explanation.",
].join("\n");

export const USER_PROMPT_TEMPLATE = [
  "Below is aggregated wallet data (JSON):",
  "",
  "```json",
  "{payload}",
  "```",
  "",
  "Generate an analysis following the requested format.",
].join("\n");
