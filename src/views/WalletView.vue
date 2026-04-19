<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { ethers, Contract, JsonRpcProvider } from "ethers";
import { useWalletStore } from "../stores/wallet";
import { api } from "../api";
import type { TokenInfo } from "../api";

const wallet = useWalletStore();

const ethBalance = ref<string | null>(null);
const tokenBalance = ref<string | null>(null);
const tokenInfo = ref<TokenInfo | null>(null);
const loading = ref(false);

// Transfer form
const recipient = ref("");
const transferAmount = ref("");
const transferring = ref(false);
const txHash = ref<string | null>(null);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS;
const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
const TOKEN_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
];

async function loadBalances() {
  if (!wallet.address) return;
  loading.value = true;
  error.value = null;

  try {
    // ETH balance — always read from Hardhat RPC directly
    const rpcProvider = new JsonRpcProvider(RPC_URL);
    const bal = await rpcProvider.getBalance(wallet.address);
    ethBalance.value = parseFloat(ethers.formatEther(bal)).toFixed(4);

    // Token balance from API
    const res = await api.getTokenBalance(wallet.address).catch(() => null);
    tokenBalance.value = res ? res.balance : null;

    // Token info
    if (!tokenInfo.value) {
      tokenInfo.value = await api.getTokenInfo().catch(() => null);
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "Failed to load balances";
  } finally {
    loading.value = false;
  }
}

async function transferTokens() {
  if (!wallet.address || !recipient.value || !transferAmount.value) return;

  if (!ethers.isAddress(recipient.value)) {
    error.value = "Invalid recipient address";
    return;
  }

  const amount = parseFloat(transferAmount.value);
  if (isNaN(amount) || amount <= 0) {
    error.value = "Amount must be greater than 0";
    return;
  }

  // Check sufficient balance before sending the transaction
  const currentBalance = parseFloat(tokenBalance.value ?? "0");
  if (amount > currentBalance) {
    // Check if user has an unclaimed airdrop
    try {
      const proof = await api.getProof(wallet.address!);
      if (proof.eligible && !proof.claimed) {
        error.value = `Insufficient balance (${currentBalance} ${tokenInfo.value?.symbol ?? "tokens"}). You have an unclaimed airdrop of ${proof.amountFormatted} tokens — go to the Claim page first!`;
      } else {
        error.value = `Insufficient balance. You only have ${currentBalance} ${tokenInfo.value?.symbol ?? "tokens"}.`;
      }
    } catch {
      error.value = `Insufficient balance. You only have ${currentBalance} ${tokenInfo.value?.symbol ?? "tokens"}.`;
    }
    return;
  }

  const signer = await wallet.getSigner();
  if (!signer) {
    error.value = "Could not get signer";
    return;
  }

  transferring.value = true;
  error.value = null;
  success.value = null;
  txHash.value = null;

  try {
    // Ensure we're on the correct chain before transferring
    const switched = await wallet.ensureChain();
    if (!switched) {
      error.value = `Please switch your wallet to Hardhat Local (chain ${wallet.expectedChainId}) manually. Add RPC URL http://127.0.0.1:8545, Chain ID ${wallet.expectedChainId}.`;
      transferring.value = false;
      return;
    }

    const contract = new Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
    const amountWei = ethers.parseEther(String(transferAmount.value));
    const tx = await contract.transfer(recipient.value, amountWei);
    txHash.value = tx.hash;
    await tx.wait();

    success.value = `Sent ${transferAmount.value} ${tokenInfo.value?.symbol ?? "tokens"} to ${recipient.value.slice(0, 6)}…${recipient.value.slice(-4)}`;
    recipient.value = "";
    transferAmount.value = "";

    // Refresh balances
    await loadBalances();
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "Transfer failed";
  } finally {
    transferring.value = false;
  }
}

watch(() => wallet.address, () => {
  txHash.value = null;
  error.value = null;
  success.value = null;
  if (wallet.address) loadBalances();
});

function formatNumber(val: string | undefined | null): string {
  if (!val) return "—";
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

onMounted(() => {
  if (wallet.address) loadBalances();
});

async function switchNetwork() {
  error.value = null;
  const ok = await wallet.ensureChain();
  if (!ok) {
    error.value = `Could not switch automatically. Please add a custom network in your wallet: RPC URL http://127.0.0.1:8545, Chain ID ${wallet.expectedChainId}, Currency ETH.`;
  }
}
</script>

<template>
  <div class="wallet-page">
    <h1>My Wallet</h1>
    <p class="desc">View balances and transfer tokens.</p>

    <!-- Not connected -->
    <div v-if="!wallet.isConnected" class="card" style="text-align: center; margin-top: 24px">
      <p style="margin-bottom: 16px; color: var(--text-muted)">
        Please connect your wallet to continue.
      </p>
      <button class="btn-primary" @click="wallet.connect()" :disabled="wallet.isConnecting">
        Connect Wallet
      </button>
    </div>

    <!-- Connected -->
    <div v-else style="margin-top: 24px">
      <!-- Wrong network warning -->
      <div v-if="!wallet.isCorrectChain" class="card" style="margin-bottom: 16px; border-color: var(--error); background: rgba(239, 68, 68, 0.08)">
        <p style="color: var(--error); font-weight: 600; margin-bottom: 8px">⚠ Wrong Network</p>
        <p style="color: var(--text-muted); font-size: 0.9rem">
          Your wallet is on Chain ID <strong>{{ wallet.chainId }}</strong>.
          Please switch to <strong>Hardhat Local ({{ wallet.expectedChainId }})</strong> to interact with the airdrop contracts.
        </p>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px">
          If the button below doesn't work, manually add a custom network in your wallet:<br>
          <strong>RPC URL:</strong> <code>http://127.0.0.1:8545</code> &nbsp;
          <strong>Chain ID:</strong> <code>{{ wallet.expectedChainId }}</code>
        </p>
        <button class="btn-primary" style="margin-top: 12px" @click="switchNetwork">
          Switch to Hardhat Network
        </button>
      </div>

      <!-- Address -->
      <div class="card" style="margin-bottom: 16px">
        <div style="color: var(--text-muted); font-size: 0.85rem">Connected Address</div>
        <div style="font-family: monospace; margin-top: 4px">{{ wallet.address }}</div>
        <div v-if="wallet.chainId" style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px">
          Chain ID: {{ wallet.chainId }}
        </div>
      </div>

      <!-- Balances -->
      <div class="balance-grid">
        <div class="card balance-card">
          <div class="balance-label">ETH Balance</div>
          <div class="balance-value">
            <span v-if="loading" class="spinner" style="width: 18px; height: 18px"></span>
            <span v-else>{{ ethBalance ?? "—" }}</span>
          </div>
          <div class="balance-sub">ETH</div>
        </div>
        <div class="card balance-card">
          <div class="balance-label">Token Balance</div>
          <div class="balance-value">
            <span v-if="loading" class="spinner" style="width: 18px; height: 18px"></span>
            <span v-else>{{ formatNumber(tokenBalance) }}</span>
          </div>
          <div class="balance-sub">{{ tokenInfo?.symbol ?? "" }}</div>
        </div>
      </div>

      <button
        class="btn-outline"
        style="margin-top: 12px"
        @click="loadBalances"
        :disabled="loading"
      >
        ↻ Refresh Balances
      </button>

      <!-- Transfer -->
      <div class="card" style="margin-top: 24px">
        <h2 style="margin-bottom: 16px">Transfer Tokens</h2>

        <div class="form-group">
          <label>Recipient Address</label>
          <input
            v-model="recipient"
            type="text"
            placeholder="0x..."
            class="input"
            :disabled="transferring"
          />
        </div>

        <div class="form-group">
          <label>Amount ({{ tokenInfo?.symbol ?? "tokens" }})</label>
          <input
            v-model="transferAmount"
            type="number"
            placeholder="0.0"
            min="0"
            step="any"
            class="input"
            :disabled="transferring"
          />
        </div>

        <!-- Error -->
        <div v-if="error" style="margin-bottom: 12px; padding: 12px; border-radius: var(--radius); background: rgba(239, 68, 68, 0.1); border: 1px solid var(--error)">
          <p style="color: var(--error); font-size: 0.9rem">{{ error }}</p>
        </div>

        <!-- Success -->
        <div v-if="success" style="margin-bottom: 12px; padding: 12px; border-radius: var(--radius); background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success)">
          <p style="color: var(--success); font-size: 0.9rem">{{ success }}</p>
        </div>

        <button
          class="btn-primary"
          @click="transferTokens"
          :disabled="transferring || !recipient || !transferAmount"
        >
          <span v-if="transferring" class="spinner" style="width: 16px; height: 16px; display: inline-block"></span>
          <span v-else>Send Tokens</span>
        </button>

        <div v-if="txHash" style="margin-top: 12px; font-size: 0.85rem; color: var(--text-muted)">
          TX: <code>{{ txHash }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-page h1 {
  font-size: 2rem;
  font-weight: 800;
}

.desc {
  color: var(--text-muted);
  margin-top: 8px;
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.balance-card {
  text-align: center;
  padding: 24px;
}

.balance-label {
  color: var(--text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.balance-value {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--primary);
}

.balance-sub {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-top: 4px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--primary);
}

.input:disabled {
  opacity: 0.5;
}

.input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}
</style>
