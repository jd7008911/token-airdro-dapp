<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { ethers, Contract } from "ethers";
import { useWalletStore } from "../stores/wallet";
import { api } from "../api";
import type { SwapStatus } from "../api";

const wallet = useWalletStore();

const swapStatus = ref<SwapStatus | null>(null);
const adrpBalance = ref<string | null>(null);
const usdtBalance = ref<string | null>(null);
const swapAmount = ref("");
const estimatedUsdt = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

// Step-based swap state
type SwapStep = "idle" | "switching" | "approving" | "approved" | "swapping" | "done";
const step = ref<SwapStep>("idle");
const approveTxHash = ref<string | null>(null);
const swapTxHash = ref<string | null>(null);
const needsApproval = ref(true);

const SWAP_ADDRESS = import.meta.env.VITE_SWAP_ADDRESS;
const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS;
const USDT_ADDRESS = import.meta.env.VITE_USDT_ADDRESS;

const ADRP_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const SWAP_ABI = [
  "function swapADRPForUSDT(uint256 adrpAmount) external",
];

const isWorking = computed(() => step.value !== "idle" && step.value !== "done");

const canSwap = computed(() => {
  if (!swapAmount.value || !swapStatus.value?.active || isWorking.value) return false;
  const val = parseFloat(swapAmount.value);
  if (isNaN(val) || val <= 0) return false;
  // Check if user has enough balance
  if (adrpBalance.value && val > parseFloat(adrpBalance.value)) return false;
  return true;
});

const insufficientBalance = computed(() => {
  if (!swapAmount.value || !adrpBalance.value) return false;
  return parseFloat(swapAmount.value) > parseFloat(adrpBalance.value);
});

const buttonLabel = computed(() => {
  if (step.value === "switching") return "Switching Network…";
  if (step.value === "approving") return "Approve ADRP in Wallet…";
  if (step.value === "approved") return "Confirm Swap in Wallet…";
  if (step.value === "swapping") return "Swapping…";
  if (insufficientBalance.value) return "Insufficient ADRP Balance";
  if (!swapAmount.value || parseFloat(swapAmount.value) <= 0) return "Enter an Amount";
  return "Swap ADRP → USDT";
});

async function loadStatus() {
  loading.value = true;
  try {
    swapStatus.value = await api.getSwapStatus();
    if (wallet.address) {
      const [tokenRes, usdtRes] = await Promise.all([
        api.getTokenBalance(wallet.address),
        api.getUsdtBalance(wallet.address),
      ]);
      adrpBalance.value = tokenRes.balance;
      usdtBalance.value = usdtRes.balance;
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "Failed to load swap info";
  } finally {
    loading.value = false;
  }
}

async function checkAllowance() {
  if (!wallet.address || !swapAmount.value) {
    needsApproval.value = true;
    return;
  }
  try {
    const signer = await wallet.getSigner();
    if (!signer) return;
    const adrpContract = new Contract(TOKEN_ADDRESS, ADRP_ABI, signer);
    const current = await adrpContract.allowance(wallet.address, SWAP_ADDRESS);
    const amountWei = ethers.parseEther(String(swapAmount.value));
    needsApproval.value = current < amountWei;
  } catch {
    needsApproval.value = true;
  }
}

async function updateEstimate() {
  if (!swapAmount.value) {
    estimatedUsdt.value = null;
    return;
  }
  const val = parseFloat(swapAmount.value);
  if (isNaN(val) || val <= 0) {
    estimatedUsdt.value = null;
    return;
  }
  try {
    const est = await api.getSwapEstimate(swapAmount.value);
    estimatedUsdt.value = est.usdtOut;
  } catch {
    estimatedUsdt.value = null;
  }
  await checkAllowance();
}

let debounceTimer: ReturnType<typeof setTimeout>;
watch(swapAmount, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updateEstimate, 300);
});

function setMax() {
  if (adrpBalance.value) {
    swapAmount.value = adrpBalance.value;
  }
}

async function executeSwap() {
  if (!canSwap.value) return;

  error.value = null;
  success.value = null;
  approveTxHash.value = null;
  swapTxHash.value = null;

  try {
    // Step 1: Ensure correct chain
    step.value = "switching";
    const switched = await wallet.ensureChain();
    if (!switched) {
      error.value = `Please switch to Hardhat Local (chain ${wallet.expectedChainId}) in your wallet settings. RPC: http://127.0.0.1:8545`;
      step.value = "idle";
      return;
    }

    const signer = await wallet.getSigner();
    if (!signer) {
      error.value = "Could not get signer — please reconnect your wallet";
      step.value = "idle";
      return;
    }

    const amountWei = ethers.parseEther(String(swapAmount.value));
    const savedAmount = String(swapAmount.value);
    const savedEstimate = estimatedUsdt.value;

    // Step 2: Re-check allowance right before approving
    const adrpContract = new Contract(TOKEN_ADDRESS, ADRP_ABI, signer);
    const currentAllowance = await adrpContract.allowance(wallet.address, SWAP_ADDRESS);
    if (currentAllowance < amountWei) {
      step.value = "approving";
      const approveTx = await adrpContract.approve(SWAP_ADDRESS, ethers.MaxUint256);
      approveTxHash.value = approveTx.hash;
      await approveTx.wait();
    }

    // Step 3: Execute swap
    step.value = "swapping";

    const swapContract = new Contract(SWAP_ADDRESS, SWAP_ABI, signer);
    const tx = await swapContract.swapADRPForUSDT(amountWei);
    swapTxHash.value = tx.hash;
    await tx.wait();

    step.value = "done";
    success.value = `Successfully swapped ${savedAmount} ADRP for ${savedEstimate} USDT!`;
    swapAmount.value = "";
    estimatedUsdt.value = null;

    await loadStatus();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Swap failed";
    if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
      error.value = "Transaction was rejected in your wallet. Please try again.";
    } else if (msg.includes("insufficient funds") || msg.includes("enough funds")) {
      error.value = "Not enough ETH to pay gas. Please add ETH to your wallet on the Hardhat network.";
    } else if (msg.includes("BAD_DATA") || msg.includes("could not decode result data")) {
      error.value = "Contract not found at this address on the current network. Ensure you are on the correct chain and the contracts are deployed.";
    } else {
      error.value = msg;
    }
    step.value = "idle";
  }
}

function resetSwap() {
  step.value = "idle";
  success.value = null;
  error.value = null;
  approveTxHash.value = null;
  swapTxHash.value = null;
}

/** Ask wallet to track a custom token (ERC-20) */
async function addTokenToWallet(address: string, symbol: string, decimals: number) {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: { address, symbol, decimals },
      } as any,
    });
  } catch {
    // User rejected, no-op
  }
}

watch(() => wallet.address, () => {
  resetSwap();
  if (wallet.address) loadStatus();
});

onMounted(() => loadStatus());
</script>

<template>
  <div class="swap-page">
    <h1>Swap</h1>
    <p class="desc">Swap your ADRP tokens for USDT at a fixed rate.</p>

    <!-- Rate info -->
    <div v-if="swapStatus" class="card rate-card" style="margin-top: 24px">
      <div class="rate-grid">
        <div>
          <div class="rate-label">Rate</div>
          <div class="rate-value">1 ADRP = {{ swapStatus.rateFormatted }} USDT</div>
        </div>
        <div>
          <div class="rate-label">USDT Liquidity</div>
          <div class="rate-value">{{ Number(swapStatus.usdtLiquidity).toLocaleString() }}</div>
        </div>
        <div>
          <div class="rate-label">Status</div>
          <div class="rate-value">
            <span :style="{ color: swapStatus.active ? 'var(--success)' : 'var(--error)' }">
              {{ swapStatus.active ? '● Active' : '● Paused' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Not connected -->
    <div v-if="!wallet.isConnected" class="card" style="text-align: center; margin-top: 24px">
      <p style="margin-bottom: 16px; color: var(--text-muted)">
        Connect your wallet to swap tokens.
      </p>
      <button class="btn-primary" @click="wallet.connect()" :disabled="wallet.isConnecting">
        Connect Wallet
      </button>
    </div>

    <!-- Connected -->
    <div v-else style="margin-top: 24px">
      <!-- Wrong network -->
      <div v-if="!wallet.isCorrectChain" class="card" style="margin-bottom: 16px; border-color: var(--error); background: rgba(239, 68, 68, 0.08)">
        <p style="color: var(--error); font-weight: 600; margin-bottom: 8px">⚠ Wrong Network</p>
        <p style="color: var(--text-muted); font-size: 0.9rem">
          Switch to <strong>Hardhat Local ({{ wallet.expectedChainId }})</strong> to swap tokens.
        </p>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px">
          <strong>RPC URL:</strong> <code>http://127.0.0.1:8545</code> &nbsp;
          <strong>Chain ID:</strong> <code>{{ wallet.expectedChainId }}</code>
        </p>
      </div>

      <!-- Balances + Add Token buttons -->
      <div class="balance-row">
        <div class="card balance-mini">
          <span class="balance-label">ADRP Balance</span>
          <span class="balance-val">{{ adrpBalance ? Number(adrpBalance).toLocaleString() : '—' }}</span>
          <button class="btn-add-token" @click="addTokenToWallet(TOKEN_ADDRESS, 'ADRP', 18)">
            + Add ADRP to Wallet
          </button>
        </div>
        <div class="card balance-mini">
          <span class="balance-label">USDT Balance</span>
          <span class="balance-val">{{ usdtBalance ?? '—' }}</span>
          <button class="btn-add-token" @click="addTokenToWallet(USDT_ADDRESS, 'USDT', 6)">
            + Add USDT to Wallet
          </button>
        </div>
      </div>

      <!-- Swap form -->
      <div class="card swap-card">
        <div class="swap-form">
          <!-- From -->
          <div class="swap-input-group">
            <div class="swap-input-header">
              <span>You Send</span>
              <button v-if="adrpBalance" class="btn-max" @click="setMax">MAX</button>
            </div>
            <div class="swap-input-row">
              <input
                v-model="swapAmount"
                type="number"
                placeholder="0.0"
                min="0"
                step="any"
                class="input swap-input"
                :disabled="isWorking"
              />
              <span class="token-tag">ADRP</span>
            </div>
            <div v-if="insufficientBalance" class="input-warning">
              Exceeds your balance of {{ Number(adrpBalance).toLocaleString() }} ADRP
            </div>
          </div>

          <!-- Arrow -->
          <div class="swap-arrow">↓</div>

          <!-- To -->
          <div class="swap-input-group">
            <div class="swap-input-header">
              <span>You Receive</span>
            </div>
            <div class="swap-input-row">
              <div class="swap-output">
                {{ estimatedUsdt ?? '0.00' }}
              </div>
              <span class="token-tag usdt">USDT</span>
            </div>
          </div>

          <!-- Step progress -->
          <div v-if="isWorking" class="steps-card">
            <div class="step-item" :class="{ active: step === 'switching', done: step !== 'switching' && step !== 'idle' }">
              <span class="step-dot"></span>
              <span>Switch to Hardhat Network</span>
              <span v-if="step === 'switching'" class="spinner spinner-sm"></span>
              <span v-else-if="step !== 'idle'" class="step-check">✓</span>
            </div>
            <div class="step-item" :class="{ active: step === 'approving', done: ['approved', 'swapping', 'done'].includes(step) }">
              <span class="step-dot"></span>
              <span>Approve ADRP spending</span>
              <span v-if="step === 'approving'" class="spinner spinner-sm"></span>
              <span v-else-if="['approved', 'swapping', 'done'].includes(step)" class="step-check">✓</span>
            </div>
            <div class="step-item" :class="{ active: step === 'approved' || step === 'swapping', done: step === 'done' }">
              <span class="step-dot"></span>
              <span>Confirm Swap</span>
              <span v-if="step === 'approved' || step === 'swapping'" class="spinner spinner-sm"></span>
              <span v-else-if="step === 'done'" class="step-check">✓</span>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="msg-card msg-error">
            <p>{{ error }}</p>
          </div>

          <!-- Success -->
          <div v-if="success" class="msg-card msg-success">
            <p style="font-weight: 600; margin-bottom: 8px">{{ success }}</p>
            <div v-if="swapTxHash" style="font-size: 0.8rem; word-break: break-all; margin-bottom: 12px">
              TX: <code>{{ swapTxHash }}</code>
            </div>
            <div class="success-actions">
              <button class="btn-add-token" @click="addTokenToWallet(USDT_ADDRESS, 'USDT', 6)">
                + Add USDT to Wallet
              </button>
              <button class="btn-outline btn-sm" @click="resetSwap" style="margin-left: 8px">
                Swap Again
              </button>
            </div>
          </div>

          <button
            class="btn-primary swap-btn"
            @click="executeSwap"
            :disabled="!canSwap"
          >
            <span v-if="isWorking" class="spinner" style="width: 18px; height: 18px; display: inline-block"></span>
            <span>{{ buttonLabel }}</span>
          </button>

          <!-- Contract addresses reference -->
          <div class="contracts-ref">
            <div>ADRP: <code>{{ TOKEN_ADDRESS }}</code></div>
            <div>USDT: <code>{{ USDT_ADDRESS }}</code></div>
            <div>Swap: <code>{{ SWAP_ADDRESS }}</code></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.swap-page h1 {
  font-size: 2rem;
  font-weight: 800;
}
.desc {
  color: var(--text-muted);
  margin-top: 8px;
}
.rate-card {
  background: var(--bg-card);
}
.rate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  text-align: center;
}
.rate-label {
  color: var(--text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
.rate-value {
  font-weight: 700;
  font-size: 1.1rem;
}
.balance-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.balance-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  gap: 6px;
}
.balance-mini .balance-label {
  color: var(--text-muted);
  font-size: 0.8rem;
}
.balance-mini .balance-val {
  font-weight: 700;
  font-size: 1.2rem;
}
.btn-add-token {
  background: none;
  border: 1px dashed var(--border);
  color: var(--text-muted);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-add-token:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.swap-card {
  max-width: 500px;
}
.swap-form {
  display: flex;
  flex-direction: column;
}
.swap-input-group {
  background: var(--bg-input);
  border-radius: var(--radius);
  padding: 16px;
}
.swap-input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.btn-max {
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-max:hover {
  background: var(--primary-hover);
}
.swap-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.swap-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  outline: none;
  padding: 0;
}
.swap-input::placeholder {
  color: var(--text-muted);
}
.input-warning {
  color: var(--error);
  font-size: 0.8rem;
  margin-top: 8px;
}
.swap-output {
  flex: 1;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--success);
}
.token-tag {
  background: rgba(100, 108, 255, 0.2);
  color: var(--primary);
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.9rem;
  white-space: nowrap;
}
.token-tag.usdt {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
}
.swap-arrow {
  text-align: center;
  font-size: 1.5rem;
  color: var(--text-muted);
  padding: 8px 0;
}
.swap-btn {
  margin-top: 20px;
  width: 100%;
  padding: 16px;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Steps */
.steps-card {
  margin-top: 16px;
  background: var(--bg-input);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 0.9rem;
  transition: color 0.2s;
}
.step-item.active {
  color: var(--primary);
  font-weight: 600;
}
.step-item.done {
  color: var(--success);
}
.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  flex-shrink: 0;
}
.step-item.active .step-dot {
  background: var(--primary);
  box-shadow: 0 0 6px var(--primary);
}
.step-item.done .step-dot {
  background: var(--success);
}
.step-check {
  color: var(--success);
  font-weight: 700;
  margin-left: auto;
}
.spinner-sm {
  width: 14px;
  height: 14px;
  display: inline-block;
  margin-left: auto;
}

/* Messages */
.msg-card {
  margin-top: 16px;
  padding: 14px;
  border-radius: var(--radius);
  font-size: 0.9rem;
}
.msg-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--error);
  color: var(--error);
}
.msg-success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid var(--success);
  color: var(--success);
}
.success-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* Contracts ref */
.contracts-ref {
  margin-top: 16px;
  font-size: 0.7rem;
  color: var(--text-muted);
  opacity: 0.6;
  line-height: 1.6;
}
.contracts-ref code {
  font-size: 0.65rem;
}
.btn-sm {
  padding: 6px 14px;
  font-size: 0.8rem;
}
</style>
