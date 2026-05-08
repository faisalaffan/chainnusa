"""Extract wallet data from Etherscan / RPC into normalized format."""

import asyncio
import httpx
import logging
from dataclasses import dataclass

log = logging.getLogger(__name__)


@dataclass
class RawWalletData:
    chain_id: int
    address: str
    native_balance_wei: str
    normal_txs: list[dict]
    token_txs: list[dict]


ETHERSCAN_BASE_URLS: dict[int, str] = {
    1: "https://api.etherscan.io/v2/api",
    56: "https://api.bscscan.com/api",
    137: "https://api.polygonscan.com/api",
}


class ChainDataExtractor:
    def __init__(self, api_key: str = "", timeout: float = 30.0):
        self.api_key = api_key
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def extract(
        self, chain_id: int, address: str, max_txs: int = 500,
    ) -> RawWalletData:
        client = await self._get_client()
        base_url = ETHERSCAN_BASE_URLS.get(chain_id)
        if not base_url:
            raise ValueError(f"Unsupported chain: {chain_id}")

        # parallel fetch
        balance, normal_txs, token_txs = await asyncio.gather(
            self._fetch_balance(client, base_url, address),
            self._fetch_normal_txs(client, base_url, address, max_txs),
            self._fetch_token_txs(client, base_url, address, max_txs),
        )
        return RawWalletData(
            chain_id=chain_id, address=address,
            native_balance_wei=balance,
            normal_txs=normal_txs,
            token_txs=token_txs,
        )

    async def _fetch_balance(
        self, client: httpx.AsyncClient, base_url: str, address: str,
    ) -> str:
        params = {
            "module": "account", "action": "balance",
            "address": address, "tag": "latest",
            "apikey": self.api_key,
        }
        if "v2/api" in base_url:
            params["chainid"] = "1"
        try:
            r = await client.get(base_url, params=params)
            data = r.json()
            return data.get("result", "0")
        except Exception as e:
            log.warning(f"Balance fetch failed: {e}")
            return "0"

    async def _fetch_normal_txs(
        self, client: httpx.AsyncClient, base_url: str, address: str, limit: int,
    ) -> list[dict]:
        params: dict = {
            "module": "account", "action": "txlist",
            "address": address, "page": "1",
            "offset": str(limit), "sort": "desc",
            "apikey": self.api_key,
        }
        if "v2/api" in base_url:
            params["chainid"] = "1"
        try:
            r = await client.get(base_url, params=params)
            data = r.json()
            return data.get("result", []) if isinstance(data.get("result"), list) else []
        except Exception as e:
            log.warning(f"Tx fetch failed: {e}")
            return []

    async def _fetch_token_txs(
        self, client: httpx.AsyncClient, base_url: str, address: str, limit: int,
    ) -> list[dict]:
        params: dict = {
            "module": "account", "action": "tokentx",
            "address": address, "page": "1",
            "offset": str(limit), "sort": "desc",
            "apikey": self.api_key,
        }
        if "v2/api" in base_url:
            params["chainid"] = "1"
        try:
            r = await client.get(base_url, params=params)
            data = r.json()
            return data.get("result", []) if isinstance(data.get("result"), list) else []
        except Exception as e:
            log.warning(f"Token tx fetch failed: {e}")
            return []
