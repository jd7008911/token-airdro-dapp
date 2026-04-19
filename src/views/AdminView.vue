<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../api";
import type { AirdropStatus, AirdropEntry } from "../api";

const status = ref<AirdropStatus | null>(null);
const entries = ref<AirdropEntry[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const [s, e] = await Promise.all([
      api.getAirdropStatus().catch(() => null),
      api.getEntries().catch(() => ({ entries: [] })),
    ]);
    status.value = s;
    entries.value = e.entries;
  } finally {
    loading.value = false;
  }
});

function formatDeadline(ts: string): string {
  const n = parseInt(ts);
  if (!n) return "No deadline";
  return new Date(n * 1000).toLocaleString();
}
</script>

<template>
  <div class="admin-page">
    <h1>Admin Dashboard</h1>
    <p class="desc">View airdrop status and distribution list.</p>

    <div v-if="loading" style="text-align: center; padding: 40px">
      <div class="spinner" style="margin: 0 auto; width: 32px; height: 32px"></div>
    </div>

    <template v-else>
      <!-- Status cards -->
      <div class="status-grid" style="margin-top: 24px">
        <div class="card">
          <div class="label">Status</div>
          <span v-if="status?.active" class="badge badge-success">Active</span>
          <span v-else class="badge badge-error">Inactive</span>
        </div>
        <div class="card">
          <div class="label">Claim Deadline</div>
          <div class="value">{{ formatDeadline(status?.deadline ?? "0") }}</div>
        </div>
        <div class="card">
          <div class="label">Total Claimed</div>
          <div class="value">{{ status?.totalClaimed ?? "—" }}</div>
        </div>
        <div class="card">
          <div class="label">Remaining Balance</div>
          <div class="value">{{ status?.balance ?? "—" }}</div>
        </div>
      </div>

      <!-- Entries table -->
      <div class="card" style="margin-top: 24px; overflow-x: auto">
        <h2 style="margin-bottom: 16px">
          Distribution List
          <span class="badge badge-warning" style="margin-left: 8px; font-size: 0.75rem">
            {{ entries.length }} entries
          </span>
        </h2>
        <table v-if="entries.length">
          <thead>
            <tr>
              <th>#</th>
              <th>Address</th>
              <th style="text-align: right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, i) in entries" :key="entry.address">
              <td>{{ i + 1 }}</td>
              <td class="mono">{{ entry.address }}</td>
              <td style="text-align: right">{{ entry.amountFormatted }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else style="color: var(--text-muted); text-align: center; padding: 24px">
          No entries found. Generate the Merkle tree first.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.admin-page h1 {
  font-size: 2rem;
  font-weight: 800;
}

.desc {
  color: var(--text-muted);
  margin-top: 8px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.label {
  color: var(--text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.value {
  font-size: 1.15rem;
  font-weight: 600;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  color: var(--text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}

.mono {
  font-family: monospace;
  font-size: 0.85rem;
}

tr:hover td {
  background: rgba(100, 108, 255, 0.05);
}
</style>
