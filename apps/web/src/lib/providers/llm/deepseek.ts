import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { AnalysisResult } from "@/lib/analyzer";
import type { LlmProvider, LlmProviderInfo } from "./types";
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE, buildPromptPayload } from "./prompt";

export class DeepSeekProvider implements LlmProvider {
  readonly info: LlmProviderInfo;

  constructor(model = process.env.DEEPSEEK_MODEL || "deepseek-chat") {
    this.info = {
      id: "deepseek",
      label: "DeepSeek (via LangChain OpenAI-compat)",
      model,
      isLocal: false,
      notes: [
        "Membutuhkan DEEPSEEK_API_KEY dari https://platform.deepseek.com",
        `Model: ${model}`,
        "API OpenAI-compatible — diakses via baseURL https://api.deepseek.com/v1",
      ],
    };
  }

  async generateSummary(analysis: AnalysisResult): Promise<string> {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is not set");
    }

    const llm = new ChatOpenAI({
      model: this.info.model,
      temperature: 0.2,
      maxTokens: 1024,
      apiKey: process.env.DEEPSEEK_API_KEY,
      configuration: {
        baseURL: "https://api.deepseek.com/v1",
      },
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      ["human", USER_PROMPT_TEMPLATE],
    ]);

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    const text = await chain.invoke({
      payload: JSON.stringify(buildPromptPayload(analysis), null, 2),
    });

    return text.trim() || "_No output received from model._";
  }
}
