<script setup lang="ts">
import { useWalletStore } from "../stores/wallet";
import { RouterLink } from "vue-router";

const wallet = useWalletStore();
</script>

<template>
  <nav class="navbar">
    <div class="container navbar-inner">
      <RouterLink to="/" class="logo">
        <span class="logo-icon">◈</span> Airdrop
      </RouterLink>

      <div class="nav-links">
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/claim">Claim</RouterLink>
        <RouterLink to="/wallet">Wallet</RouterLink>
        <RouterLink to="/admin">Admin</RouterLink>
      </div>

      <div class="nav-actions">
        <template v-if="wallet.isConnected">
          <span class="badge badge-success">
            <span class="dot"></span>
            {{ wallet.shortAddress }}
          </span>
          <button class="btn-outline btn-sm" @click="wallet.disconnect()">
            Disconnect
          </button>
        </template>
        <template v-else>
          <button
            class="btn-primary btn-sm"
            :disabled="wallet.isConnecting"
            @click="wallet.connect()"
          >
            <span v-if="wallet.isConnecting" class="spinner" style="width: 14px; height: 14px"></span>
            <span v-else>Connect Wallet</span>
          </button>
        </template>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  background: rgba(26, 26, 46, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  padding: 14px 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.logo {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  color: var(--primary);
  font-size: 1.6rem;
}

.nav-links {
  display: flex;
  gap: 24px;
}

.nav-links a {
  color: var(--text-muted);
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: var(--primary);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 0.875rem;
}

.dot {
  width: 8px;
  height: 8px;
  background: var(--success);
  border-radius: 50%;
  display: inline-block;
}
</style>
