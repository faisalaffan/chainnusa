import type { DataProvider, DataProviderId } from "./types";
import { EtherscanProvider } from "./etherscan";
import { RpcProvider } from "./rpc";

function resolveDataProviderId(): DataProviderId {
  const raw = (process.env.DATA_PROVIDER || "etherscan").toLowerCase();
  if (raw === "rpc") return "rpc";
  return "etherscan";
}

export function getDataProvider(): DataProvider {
  const id = resolveDataProviderId();
  if (id === "rpc") return new RpcProvider();
  return new EtherscanProvider();
}

export function getActiveDataProviderId(): DataProviderId {
  return resolveDataProviderId();
}
