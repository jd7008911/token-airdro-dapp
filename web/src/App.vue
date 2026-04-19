<script setup lang="ts">
import { RouterView } from "vue-router";
import NavBar from "./components/NavBar.vue";
</script>

<template>
  <NavBar />
  <main class="container" style="padding-top: 32px; padding-bottom: 64px; flex: 1">
    <RouterView v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>
  </main>
  <footer style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem">
    Token Airdrop DApp &copy; 2025 &mdash; DeFi Token Distribution
  </footer>
</template>
