import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { AnalysisResult } from "@/lib/analyzer";
import type { LlmProvider, LlmProviderInfo } from "./types";
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE, buildPromptPayload } from "./prompt";

export class OllamaProvider implements LlmProvider {
  readonly info: LlmProviderInfo;
  private readonly baseUrl: string;

  constructor(
    model = process.env.OLLAMA_MODEL || "qwen2.5:7b",
    baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434"
  ) {
    this.baseUrl = baseUrl;
    this.info = {
      id: "ollama",
      label: "Ollama (local LLM via LangChain)",
      model,
      isLocal: true,
      notes: [
        `Server: ${baseUrl}`,
        "Pastikan Ollama running & model sudah di-pull (ollama pull <model>)",
        "Data 100% lokal — tidak ada outbound ke pihak ketiga",
      ],
    };
  }

  async generateSummary(analysis: AnalysisResult): Promise<string> {
    const llm = new ChatOllama({
      model: this.info.model,
      baseUrl: this.baseUrl,
      temperature: 0.2,
      // Ollama supports extra options. Cap context budget.
      numPredict: 1024,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      ["human", USER_PROMPT_TEMPLATE],
    ]);

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    let text: string;
    try {
      text = await chain.invoke({
        payload: JSON.stringify(buildPromptPayload(analysis), null, 2),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Ollama call failed (baseUrl=${this.baseUrl}, model=${this.info.model}): ${msg}`
      );
    }

    return text.trim() || "_No output received from model._";
  }
}
