<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../api";
import type { AirdropStatus, TokenInfo } from "../api";

const tokenInfo = ref<TokenInfo | null>(null);
const airdropStatus = ref<AirdropStatus | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

function formatNumber(val: string | undefined | null): string {
  if (!val) return "—";
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

onMounted(async () => {
  try {
    const [token, status] = await Promise.all([
      api.getTokenInfo().catch(() => null),
      api.getAirdropStatus().catch(() => null),
    ]);
    tokenInfo.value = token;
    airdropStatus.value = status;
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "Failed to load data";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="home">
    <section class="hero">
      <h1>Token Airdrop</h1>
      <p class="subtitle">
        Claim your share of the DeFi token distribution.
        Connect your wallet and check eligibility.
      </p>
      <RouterLink to="/claim" class="btn-primary" style="display: inline-block; margin-top: 16px">
        Check Eligibility &rarr;
      </RouterLink>
    </section>

    <div v-if="loading" style="text-align: center; padding: 40px">
      <div class="spinner" style="margin: 0 auto; width: 32px; height: 32px"></div>
    </div>

    <div v-else class="stats-grid">
      <div class="card stat-card">
        <div class="stat-label">Token</div>
        <div class="stat-value">{{ tokenInfo?.name ?? "—" }}</div>
        <div class="stat-sub">{{ tokenInfo?.symbol ?? "" }}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Total Supply</div>
        <div class="stat-value">{{ formatNumber(tokenInfo?.totalSupply) }}</div>
        <div class="stat-sub">{{ tokenInfo?.symbol ?? "" }}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Airdrop Balance</div>
        <div class="stat-value">{{ formatNumber(airdropStatus?.balance) }}</div>
        <div class="stat-sub">tokens remaining</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Status</div>
        <div class="stat-value">
          <span v-if="airdropStatus?.active" class="badge badge-success">Active</span>
          <span v-else class="badge badge-error">Inactive</span>
        </div>
        <div class="stat-sub">
          Total claimed: {{ formatNumber(airdropStatus?.totalClaimed) }}
        </div>
      </div>
    </div>

    <section class="how-it-works card" style="margin-top: 32px">
      <h2>How It Works</h2>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <h3>Connect Wallet</h3>
          <p>Connect your MetaMask or compatible Web3 wallet.</p>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <h3>Check Eligibility</h3>
          <p>We verify your address against the Merkle tree of eligible recipients.</p>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <h3>Claim Tokens</h3>
          <p>Submit the on-chain transaction to receive your airdrop allocation.</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  text-align: center;
  padding: 48px 0 32px;
}

.hero h1 {
  font-size: 2.8rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary) 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: var(--text-muted);
  font-size: 1.15rem;
  max-width: 500px;
  margin: 12px auto 0;
  line-height: 1.6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  text-align: center;
}

.stat-label {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.stat-sub {
  color: var(--text-muted);
  font-size: 0.8rem;
  margin-top: 4px;
}

.how-it-works h2 {
  margin-bottom: 24px;
}

.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.step {
  text-align: center;
}

.step-num {
  width: 40px;
  height: 40px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  margin-bottom: 12px;
}

.step h3 {
  margin-bottom: 8px;
}

.step p {
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
