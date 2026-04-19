import { ethers } from "ethers";

const INFURA_KEY = process.env.INFURA_API_KEY || "";
const NETWORK = process.env.NETWORK || "localhost";
const RPC_URL = INFURA_KEY && NETWORK !== "localhost"
  ? `https://${NETWORK === "mainnet" ? "mainnet" : NETWORK}.infura.io/v3/${INFURA_KEY}`
  : "http://127.0.0.1:8545";
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "";
const AIRDROP_ADDRESS = process.env.AIRDROP_ADDRESS || "";

export const provider = new ethers.JsonRpcProvider(RPC_URL);

// ABIs (minimal)
const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const AIRDROP_ABI = [
  "function token() view returns (address)",
  "function merkleRoot() view returns (bytes32)",
  "function airdropActive() view returns (bool)",
  "function claimDeadline() view returns (uint256)",
  "function totalClaimed() view returns (uint256)",
  "function hasClaimed(address) view returns (bool)",
  "function airdropBalance() view returns (uint256)",
  "function isEligible(address, uint256, bytes32[]) view returns (bool)",
  "function claim(uint256, bytes32[])",
  "event Claimed(address indexed account, uint256 amount)",
];

export function getTokenContract() {
  if (!TOKEN_ADDRESS) throw new Error("TOKEN_ADDRESS not set");
  return new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
}

export function getAirdropContract() {
  if (!AIRDROP_ADDRESS) throw new Error("AIRDROP_ADDRESS not set");
  return new ethers.Contract(AIRDROP_ADDRESS, AIRDROP_ABI, provider);
}

/** Check whether a contract address actually has code on the current network. */
export async function ensureContractDeployed(address: string, label: string): Promise<void> {
  const code = await provider.getCode(address);
  if (code === "0x" || code === "0x0") {
    throw new Error(
      `${label} contract not found at ${address} on ${NETWORK}. ` +
      `Deploy contracts to ${NETWORK} first, then update the address env vars.`
    );
  }
}

export { TOKEN_ADDRESS, AIRDROP_ADDRESS, NETWORK };
