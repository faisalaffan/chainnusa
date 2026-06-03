import type { LlmProvider, LlmProviderId } from "./types";
import { ClaudeProvider } from "./claude";
import { DeepSeekProvider } from "./deepseek";
import { OllamaProvider } from "./ollama";

function resolveLlmProviderId(): LlmProviderId {
  const raw = (process.env.LLM_PROVIDER || "claude").toLowerCase();
  if (raw === "ollama") return "ollama";
  if (raw === "deepseek") return "deepseek";
  return "claude";
}

export function getLlmProvider(): LlmProvider {
  const id = resolveLlmProviderId();
  if (id === "ollama") return new OllamaProvider();
  if (id === "deepseek") return new DeepSeekProvider();
  return new ClaudeProvider();
}

export function getActiveLlmProviderId(): LlmProviderId {
  return resolveLlmProviderId();
}
