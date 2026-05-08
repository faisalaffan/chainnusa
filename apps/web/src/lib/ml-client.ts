/**
 * ML Service client — calls FastAPI endpoints from Next.js API routes.
 * Uses X-Internal-Token for service-to-service auth.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const ML_INTERNAL_TOKEN = process.env.ML_INTERNAL_TOKEN || "chainnusa-internal-secret";

interface MlPredictResponse {
  address: string;
  chain_id: number;
  classification: string;
  class_probabilities: Record<string, number>;
  is_anomaly: boolean;
  anomaly_score: number;
}

interface FeatureContribution {
  feature: string;
  contribution: number;
  direction: string;
}

interface MlExplainResponse {
  address: string;
  predicted_class: string;
  top_features: FeatureContribution[];
}

async function mlFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ML_SERVICE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": ML_INTERNAL_TOKEN,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`ML service error ${res.status}: ${errBody}`);
  }
  return res.json() as Promise<T>;
}

export interface PredictInput {
  address: string;
  chainId: number;
  normalTxs: Record<string, unknown>[];
  tokenTxs: Record<string, unknown>[];
}

export interface ExplainInput {
  address: string;
  chainId: number;
  normalTxs: Record<string, unknown>[];
  tokenTxs: Record<string, unknown>[];
}

export async function predictWallet(input: PredictInput): Promise<MlPredictResponse> {
  return mlFetch<MlPredictResponse>("/predict", {
    address: input.address,
    chain_id: input.chainId,
    normal_txs: input.normalTxs.map(renameTx),
    token_txs: input.tokenTxs.map(renameTokenTx),
  });
}

export async function explainPrediction(input: ExplainInput): Promise<MlExplainResponse> {
  return mlFetch<MlExplainResponse>("/explain", {
    address: input.address,
    chain_id: input.chainId,
    normal_txs: input.normalTxs.map(renameTx),
    token_txs: input.tokenTxs.map(renameTokenTx),
  });
}

function renameTx(tx: Record<string, unknown>): Record<string, unknown> {
  return {
    hash: tx.hash,
    block_number: tx.blockNumber,
    time_stamp: tx.timeStamp,
    from_addr: tx.from,
    to_addr: tx.to,
    value: tx.value,
    gas: tx.gas,
    gas_price: tx.gasPrice,
    gas_used: tx.gasUsed,
    is_error: tx.isError,
    input: tx.input,
    contract_address: tx.contractAddress,
    method_id: tx.methodId || "",
    function_name: tx.functionName || "",
  };
}

function renameTokenTx(tx: Record<string, unknown>): Record<string, unknown> {
  return {
    hash: tx.hash,
    block_number: tx.blockNumber,
    time_stamp: tx.timeStamp,
    from_addr: tx.from,
    to_addr: tx.to,
    value: tx.value,
    token_name: tx.tokenName || "",
    token_symbol: tx.tokenSymbol || "",
    token_decimal: tx.tokenDecimal || "18",
    contract_address: tx.contractAddress || "",
  };
}
