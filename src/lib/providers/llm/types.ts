import type { AnalysisResult } from "@/lib/analyzer";

export type LlmProviderId = "claude" | "ollama";

export interface LlmProviderInfo {
  id: LlmProviderId;
  label: string;
  model: string;
  isLocal: boolean;
  notes?: string[];
}

export interface LlmProvider {
  readonly info: LlmProviderInfo;
  generateSummary(analysis: AnalysisResult): Promise<string>;
}
