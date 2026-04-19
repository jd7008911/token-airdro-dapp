<script setup lang="ts">
import { ref, watch } from "vue";
import { ethers, Contract } from "ethers";
import { useWalletStore } from "../stores/wallet";
import { api } from "../api";
import type { ProofResponse } from "../api";

const wallet = useWalletStore();

const eligibility = ref<ProofResponse | null>(null);
const checking = ref(false);
const claiming = ref(false);
const txHash = ref<string | null>(null);
const error = ref<string | null>(null);

const AIRDROP_ADDRESS = import.meta.env.VITE_AIRDROP_ADDRESS;
const AIRDROP_ABI = [
  "function claim(uint256 amount, bytes32[] calldata proof) external",
  "function hasClaimed(address) view returns (bool)",
];

watch(
  () => wallet.address,
  () => {
    eligibility.value = null;
    txHash.value = null;
    error.value = null;
  }
);

async function checkEligibility() {
  if (!wallet.address) return;
  checking.value = true;
  error.value = null;

  try {
    eligibility.value = await api.getProof(wallet.address);
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "Failed to check eligibility";
  } finally {
    checking.value = false;
  }
}

async function claimTokens() {
  if (!eligibility.value?.proof || !eligibility.value.amount) return;

  claiming.value = true;
  error.value = null;

  try {
    // Ensure we're on the correct chain before claiming
    const switched = await wallet.ensureChain();
    if (!switched) {
      error.value = `Please switch your wallet to Hardhat Local (chain ${wallet.expectedChainId}) manually. Go to your wallet settings and add a custom network with RPC URL http://127.0.0.1:8545 and Chain ID ${wallet.expectedChainId}.`;
      claiming.value = false;
      return;
    }

    const signer = await wallet.getSigner();
    if (!signer) {
      error.value = "Could not get signer";
      claiming.value = false;
      return;
    }

    const contract = new Contract(AIRDROP_ADDRESS, AIRDROP_ABI, signer);
    const tx = await contract.claim(eligibility.value.amount, eligibility.value.proof);
    txHash.value = tx.hash;
    await tx.wait();

    // Refresh eligibility
    eligibility.value = await api.getProof(wallet.address!);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Claim transaction failed";
    if (msg.includes("BAD_DATA") || msg.includes("could not decode result data")) {
      error.value = "Contract not found at this address on the current network. Ensure you are on the correct chain and the contracts are deployed.";
    } else {
      error.value = msg;
    }
  } finally {
    claiming.value = false;
  }
}

function formatEther(val: string | undefined): string {
  if (!val) return "0";
  try {
    return parseFloat(ethers.formatEther(val)).toLocaleString();
  } catch {
    return val;
  }
}

async function switchNetwork() {
  error.value = null;
  const ok = await wallet.ensureChain();
  if (!ok) {
    error.value = `Could not switch automatically. Please add a custom network in your wallet: RPC URL http://127.0.0.1:8545, Chain ID ${wallet.expectedChainId}, Currency ETH.`;
  }
}
</script>

<template>
  <div class="claim-page">
    <h1>Claim Airdrop</h1>
    <p class="desc">Connect your wallet and check if you're eligible for the token airdrop.</p>

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
          Please switch to <strong>Hardhat Local ({{ wallet.expectedChainId }})</strong> to claim your airdrop.
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

      <div class="card" style="margin-bottom: 16px">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px">
          <div>
            <div style="color: var(--text-muted); font-size: 0.85rem">Connected Address</div>
            <div style="font-family: monospace; margin-top: 4px">{{ wallet.address }}</div>
          </div>
          <button
            class="btn-primary"
            @click="checkEligibility"
            :disabled="checking"
          >
            <span v-if="checking" class="spinner" style="width: 16px; height: 16px; display: inline-block"></span>
            <span v-else>Check Eligibility</span>
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="card" style="border-color: var(--error); margin-bottom: 16px">
        <p style="color: var(--error)">{{ error }}</p>
      </div>

      <!-- Eligibility result -->
      <div v-if="eligibility" class="card result-card">
        <!-- Not eligible -->
        <div v-if="!eligibility.eligible" style="text-align: center; padding: 24px 0">
          <div style="font-size: 3rem; margin-bottom: 12px">😔</div>
          <h2>Not Eligible</h2>
          <p style="color: var(--text-muted); margin-top: 8px">
            This address is not included in the airdrop distribution.
          </p>
        </div>

        <!-- Already claimed -->
        <div v-else-if="eligibility.claimed" style="text-align: center; padding: 24px 0">
          <div style="font-size: 3rem; margin-bottom: 12px">✅</div>
          <h2>Already Claimed</h2>
          <p style="color: var(--text-muted); margin-top: 8px">
            You've already claimed <strong>{{ eligibility.amountFormatted }}</strong> tokens.
          </p>
        </div>

        <!-- Eligible - can claim -->
        <div v-else style="text-align: center; padding: 24px 0">
          <div style="font-size: 3rem; margin-bottom: 12px">🎉</div>
          <h2>You're Eligible!</h2>
          <div class="claim-amount">
            {{ formatEther(eligibility.amount) }}
            <span class="token-label">tokens</span>
          </div>
          <button
            class="btn-primary"
            style="margin-top: 20px; padding: 14px 40px; font-size: 1.1rem"
            @click="claimTokens"
            :disabled="claiming"
          >
            <span v-if="claiming" class="spinner" style="width: 18px; height: 18px; display: inline-block"></span>
            <span v-else>Claim Now</span>
          </button>

          <div v-if="txHash" style="margin-top: 16px; font-size: 0.85rem; color: var(--text-muted)">
            TX: <code>{{ txHash }}</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.claim-page h1 {
  font-size: 2rem;
  font-weight: 800;
}

.desc {
  color: var(--text-muted);
  margin-top: 8px;
}

.result-card {
  border-color: var(--primary);
}

.claim-amount {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--primary);
  margin-top: 12px;
}

.token-label {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-muted);
}
</style>
