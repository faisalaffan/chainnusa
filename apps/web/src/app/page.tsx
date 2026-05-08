import Analyzer from "@/components/Analyzer";
import { Github, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">ChainNusa</h1>
              <p className="text-xs text-white/50">
                Multi-chain wallet analyzer · Etherscan V2 + Claude AI
              </p>
            </div>
          </div>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            className="text-white/50 hover:text-white"
            aria-label="GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
        </header>

        <Analyzer />

        <footer className="mt-16 text-xs text-white/40 text-center">
          Data: Etherscan V2 multichain API · AI: Anthropic Claude · Disclaimer: ini bukan
          financial advice; analisis bersifat heuristik dan dapat keliru.
        </footer>
      </div>
    </main>
  );
}
