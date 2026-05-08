import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { AnalysisResult } from "@/lib/analyzer";
import type { LlmProvider, LlmProviderInfo } from "./types";
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE, buildPromptPayload } from "./prompt";

export class ClaudeProvider implements LlmProvider {
  readonly info: LlmProviderInfo;

  constructor(model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest") {
    this.info = {
      id: "claude",
      label: "Anthropic Claude (via LangChain)",
      model,
      isLocal: false,
      notes: ["Membutuhkan ANTHROPIC_API_KEY", "Hosted model — data dikirim ke Anthropic"],
    };
  }

  async generateSummary(analysis: AnalysisResult): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const llm = new ChatAnthropic({
      model: this.info.model,
      temperature: 0.2,
      maxTokens: 1024,
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      ["human", USER_PROMPT_TEMPLATE],
    ]);

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    const text = await chain.invoke({
      payload: JSON.stringify(buildPromptPayload(analysis), null, 2),
    });

    return text.trim() || "_Tidak ada output dari model._";
  }
}
