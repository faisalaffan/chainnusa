import type { LlmProvider, LlmProviderId } from "./types";
import { ClaudeProvider } from "./claude";
import { OllamaProvider } from "./ollama";

function resolveLlmProviderId(): LlmProviderId {
  const raw = (process.env.LLM_PROVIDER || "claude").toLowerCase();
  if (raw === "ollama") return "ollama";
  return "claude";
}

export function getLlmProvider(): LlmProvider {
  const id = resolveLlmProviderId();
  if (id === "ollama") return new OllamaProvider();
  return new ClaudeProvider();
}

export function getActiveLlmProviderId(): LlmProviderId {
  return resolveLlmProviderId();
}
