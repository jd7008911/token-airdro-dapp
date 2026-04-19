import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BrowserProvider, JsonRpcSigner } from "ethers";

const EXPECTED_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || "31337");
const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}

export const useWalletStore = defineStore("wallet", () => {
  const address = ref<string | null>(null);
  const chainId = ref<number | null>(null);
  const isConnecting = ref(false);
  const error = ref<string | null>(null);

  const isConnected = computed(() => !!address.value);
  const isCorrectChain = computed(() => chainId.value === EXPECTED_CHAIN_ID);
  const expectedChainId = EXPECTED_CHAIN_ID;
  const shortAddress = computed(() => {
    if (!address.value) return "";
    return `${address.value.slice(0, 6)}…${address.value.slice(-4)}`;
  });

  async function connect() {
    if (!window.ethereum) {
      error.value = "MetaMask not detected. Please install MetaMask.";
      return;
    }

    isConnecting.value = true;
    error.value = null;

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      address.value = accounts[0] ?? null;

      const chain = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      chainId.value = parseInt(chain, 16);

      // Listen for changes
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : "Connection failed";
    } finally {
      isConnecting.value = false;
    }
  }

  function disconnect() {
    address.value = null;
    chainId.value = null;
    if (window.ethereum) {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    }
  }

  async function getSigner(): Promise<JsonRpcSigner | null> {
    if (!window.ethereum || !address.value) return null;
    const provider = new BrowserProvider(window.ethereum);
    return provider.getSigner();
  }

  /** Try to add and switch to the expected chain. Returns true on success. */
  async function ensureChain(): Promise<boolean> {
    if (!window.ethereum) return false;
    if (isCorrectChain.value) return true;

    const chainHex = "0x" + EXPECTED_CHAIN_ID.toString(16);

    // Try adding the chain first (this also switches in most wallets)
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: chainHex,
          chainName: "Hardhat Local",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [RPC_URL],
        }],
      });
      // Re-read chain after add
      const chain = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      chainId.value = parseInt(chain, 16);
      if (chainId.value === EXPECTED_CHAIN_ID) return true;
    } catch {
      // wallet_addEthereumChain may not be supported, try switch
    }

    // Fallback: try switching
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
      const chain = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      chainId.value = parseInt(chain, 16);
      return chainId.value === EXPECTED_CHAIN_ID;
    } catch {
      return false;
    }
  }

  function handleAccountsChanged(accounts: unknown) {
    const accs = accounts as string[];
    if (accs.length === 0) {
      disconnect();
    } else {
      address.value = accs[0];
    }
  }

  function handleChainChanged(chain: unknown) {
    chainId.value = parseInt(chain as string, 16);
  }

  return {
    address,
    chainId,
    isConnecting,
    isConnected,
    isCorrectChain,
    expectedChainId,
    shortAddress,
    error,
    connect,
    disconnect,
    getSigner,
    ensureChain,
  };
});
