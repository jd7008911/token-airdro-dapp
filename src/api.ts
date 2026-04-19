const API_BASE = import.meta.env.VITE_API_BASE || "";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface AirdropStatus {
  active: boolean;
  deadline: string;
  totalClaimed: string;
  balance: string;
  merkleRoot: string;
}

export interface ProofResponse {
  eligible: boolean;
  claimed?: boolean;
  amount?: string;
  amountFormatted?: string;
  proof?: string[];
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

export interface TokenBalance {
  address: string;
  balance: string;
}

export interface AirdropEntry {
  address: string;
  amount: string;
  amountFormatted: string;
}

export interface EntriesResponse {
  count: number;
  entries: AirdropEntry[];
}

export const api = {
  getAirdropStatus: () => fetchJson<AirdropStatus>("/api/airdrop/status"),
  getProof: (address: string) => fetchJson<ProofResponse>(`/api/airdrop/proof/${address}`),
  getEntries: () => fetchJson<EntriesResponse>("/api/airdrop/entries"),
  hasClaimed: (address: string) => fetchJson<{ address: string; claimed: boolean }>(`/api/airdrop/claimed/${address}`),
  getTokenInfo: () => fetchJson<TokenInfo>("/api/token/info"),
  getTokenBalance: (address: string) => fetchJson<TokenBalance>(`/api/token/balance/${address}`),
  healthCheck: () => fetchJson<{ status: string; timestamp: number }>("/api/health"),
};
