import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BrowserProvider, JsonRpcSigner } from "ethers";

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
    shortAddress,
    error,
    connect,
    disconnect,
    getSigner,
  };
});
